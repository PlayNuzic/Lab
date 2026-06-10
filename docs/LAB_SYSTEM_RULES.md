# Regles del Sistema PlayNuzic Lab

Extracció completa de les regles de codi que conformen l'ecosistema d'aplicacions musicals del Lab, organitzades per capes: motor d'àudio, mòduls core compartits, UI, mòduls especialitzats i patrons d'app.

> **Arquitectura:** Monorepo amb `libs/` (mòduls compartits, ~70% del codi) i `Apps/` (App1-App35). Les apps importen dels mòduls; el codi específic d'app és l'últim recurs.

---

## 1. Motor d'Àudio

**Directori:** `libs/sound/`

### 1.1 Timing i Scheduling (AudioWorklet)

```javascript
// timeline-processor.js
const block = 128;  // Bloc de processament: 128 samples

// Epsilon per a comparació de beats (evita doble-trigger)
while (this.pulseCountdownBeats <= 1e-9) {   // Pulse event threshold
    this._emitPulse();
    this.pulseCountdownBeats += 1;
}

// Cycle event threshold
this.cycleEvents[this.nextCycleIndex].beat - 1e-9

// Voice event threshold (polirítmia)
if (voice.countdownBeats <= 1e-9) {
    voice.countdownBeats += voice.periodBeats;
}

// Mínim seconds per beat (evita divisió per zero)
this.secondsPerBeat = Math.max(1e-6, +intervalSec || 0.5);

// Tempo ramp lineal per sample
this.rampStep = (this.targetSpb - startSpb) / rampSamples;

// Beat-to-sample conversion
const beatsPerSample = this.secondsPerSample / this.secondsPerBeat;
```

### 1.2 Alineament de Canvis de Tempo

```javascript
// timeline-processor.js
// Opcions: 'immediate', 'nextPulse' (default), 'cycle'
const align = (msg.align === 'immediate' || msg.align === 'cycle')
    ? msg.align : 'nextPulse';

// 'immediate': s'aplica dins el bloc de samples actual
if (this.pendingTempoChange && this.pendingTempoChange.align === 'immediate') {
    this._applyPendingTempoChange();
}

// 'cycle': s'aplica al wrap del compàs (currentStep == 0)
if (this.loop && this.currentStep === 0) {
    if (this.pendingTempoChange && this.pendingTempoChange.align === 'cycle') {
        this._applyPendingTempoChange();
    }
}
```

### 1.3 Loop i Patrons

```javascript
// timeline-processor.js
// Loop wrap: currentStep %= totalBeats
this.currentStep = this.loop && this.totalBeats > 0
    ? (this.currentStep + 1) % this.totalBeats
    : (this.currentStep + 1);

// Measure phase wrapping amb reset de cycle index
if (this.loop && this.totalBeats > 0) {
    while (this.measurePhaseBeats >= this.totalBeats) {
        this.measurePhaseBeats -= this.totalBeats;
        this.nextCycleIndex = 0;
    }
}

// Stop condition (sense loop)
if (!this.loop && this.currentStep + 1 >= this.totalBeats) {
    this.port.postMessage({ type: 'done' });
    this.active = false;
    return;
}
```

### 1.4 Veus Polirítmiques

```javascript
// timeline-processor.js
// Període = numerador / denominador
const num = Math.max(1, +v.numerator || 1);   // Mínim 1
const den = Math.max(1, +v.denominator || 1); // Mínim 1
const periodBeats = num / den;
```

### 1.5 Volum i Mixer

```javascript
// mixer.js
// Clamping de volum: sempre [0, 1]
function clampVolume(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    return Math.max(0, Math.min(1, num));
}

// Conversió lineal → dB
function toDecibels(value) {
    const v = clampVolume(value);
    if (v <= 0) return -Infinity;
    return 20 * Math.log10(v);
}

// Defaults
volume: 0.75,  // Master volume default: 75%
// Channel volume default: 0.75

// Solo: si algun canal té solo, tots els no-solo enmudeixen
function _computeEffectiveMute(channel) {
    return !!(this.master.muted || channel.muted
        || (this._hasSolo() && !channel.solo));
}
```

### 1.5.1 Cadena FX Master (Canònic)

```javascript
// libs/sound/index.js — defaults aplicats automàticament al constructor
EQ:        highshelf, frequency 3000 Hz, gain +1.5 dB
Compressor: threshold -6 dB, knee 30, ratio 2:1, attack 20ms, release 250ms
Limiter:    threshold -0.5 dB, knee 0, ratio 20:1, attack 3ms, release 100ms
Reverb:     wet 0 (off per defecte)
```

**Regla**: cap app ha de cridar `setCompressorThreshold` / `setLimiterThreshold`
des de `main.js`. Els valors canònics estan fixats al motor i exposats a
`libs/app-common/audio-init.js → CANONICAL_FX`. Si una app necessita un
escenari especial, l'override va al `setupAudioDefaults(audio, { fx: ... })`.

### 1.5.2 Flux Canònic d'Inicialització

```javascript
// libs/app-common/audio-init.js
import { setupAudioDefaults, CHANNEL_TIERS, createMixerPersistence } from '.../audio-init.js';

// 1) Crida estàndard després de instance.ready():
setupAudioDefaults(audio, {
  channels: CHANNEL_TIERS.MELODIC_PULSE,  // tier adequat per l'app
  enableEffects: true                       // default true
});

// 2) (Opcional) volums persistents — només apps amb mixer-menu visible
const persist = createMixerPersistence({ storageKey: 'app19:mixer' });
persist.hydrate(audio);     // restaura abans del primer play
persist.subscribe(audio);   // desa canvis (debounce 120ms)
```

### 1.6 Canals d'Àudio per Defecte

```javascript
// melodic-audio.js — auto-registre al constructor
// (les apps NO cal que tornin a registrar-los; només personalitzar labels via tier)
this.mixer.registerChannel('instrument', {
    allowSolo: true, label: 'Instrumento', volume: 1   // volum 1.0
});
for (const ch of ['pulse', 'start', 'accent', 'subdivision']) {
    this.mixer.registerChannel(ch, { volume: 0.1 });   // volum 0.1
}
```

#### Tiers de canals (`CHANNEL_TIERS`)

| Tier | Canals | Apps típiques |
|------|--------|---------------|
| `RHYTHM_BASIC` | pulse | apps rítmiques mínimes |
| `RHYTHM_ACCENT` | pulse + accent | App5, App16, App17 |
| `RHYTHM_SUB` | pulse + subdivision | App3, App26, App27 |
| `RHYTHM_FULL` | pulse + subdivision + accent | App4, App28, App29 |
| `MELODIC_BASIC` | instrument | App9, App10, App13, App14, App18, App21-24 |
| `MELODIC_PULSE` | pulse + instrument | App11, App19, App20, App25, App25B |
| `MELODIC_FULL` | pulse + subdivision + instrument | App12, App15, App30-35 |

#### Persistència de mixer (localStorage)

Només les apps amb **mixer-menu visible** habiliten `createMixerPersistence`:
App11, App12, App15, App16, App17, App19, App20, App25, App25B. La resta
sona amb defaults a cada càrrega.

### 1.7 Sampler i ADSR

```javascript
// sampler-pool.js
const DEFAULT_POOL_SIZE = 16;  // Màx 16 veus simultànies per pitch class

const ADSR_DEFAULTS = {
    attack:  0.005,  // 5ms
    decay:   0.1,    // 100ms
    sustain: 0.8,    // 80%
    release: 0.3     // 300ms
};

// Quick release per stop-all (evita clicks)
const quickRelease = 0.05;  // 50ms

// Presets ADSR
const PRESETS = {
    piano:  { attack: 0.002, decay: 0.1,  sustain: 0.7,  release: 0.4  },
    flute:  { attack: 0.08,  decay: 0.05, sustain: 0.85, release: 0.25 },
    pluck:  { attack: 0.001, decay: 0.2,  sustain: 0.3,  release: 0.1  },
    pad:    { attack: 0.3,   decay: 0.2,  sustain: 0.8,  release: 0.5  }
};

// Detune entre samples: cents = (midi - sampleMidi) * 100
const detuneCents = (midi - sampleMidi) * 100;
```

### 1.8 Instruments Disponibles

```javascript
// piano.js - Salamander Piano
// Rang: C1-C7 (octaves 1-7), samples C i F#
for (let octave = 1; octave <= 7; octave++) {
    urls[`C${octave}`] = `C${octave}.mp3`;
    urls[`F#${octave}`] = `Fs${octave}.mp3`;
}
release: 0.8  // 800ms

// flute.js - tonejs-instruments
const FLUTE_NOTES = ['A4','A5','A6','C4','C5','C6','C7','E4','E5','E6'];
attack: 0.1   // 100ms
release: 0.8  // 800ms
```

### 1.9 Registre i MIDI

```javascript
// registry-controller.js
min = 0,               // Registre mínim
max = 7,               // Registre màxim (8 registres: 0-7)
notesPerRegistry = 12, // Notes per registre (cromàtic)
midiOffset = 12,       // C0 = MIDI 12

const TOTAL_NOTES = 13;  // Display: 12 notes + nota 0 del registre superior

// Fórmula MIDI
midi = registry * notesPerRegistry + noteIndex + midiOffset;
```

### 1.10 Mapeig de Sons Rítmics

```javascript
// sample-map.js
pulso:         'click9',   // Hi-Hat
pulso0:        'click7',   // Bombo (inici de cicle)
seleccionados: 'click8',   // Caja
start:         'click7',   // Bombo
cycle:         'click10'   // Ride
```

### 1.11 Inicialització del Context d'Àudio

```javascript
// user-interaction.js
// Requereix gest d'usuari amb event.isTrusted === true
if (event?.isTrusted === false) { return; }

// index.js
// Latència interactiva (baixa latència)
const ctx = new Ctor({ latencyHint: 'interactive' });

// melodic-audio.js
// Tone.js context ha de coincidir amb TimelineAudio
if (Tone.getContext().rawContext !== this._ctx) {
    Tone.setContext(this._ctx);
}

// Low-latency mode activat per defecte
this._useLowLatencyMode = true;
// SamplerPool: 1-3ms vs Tone.Sampler: 20-50ms
```

---

## 2. Mòduls Core Compartits

**Directori:** `libs/app-common/`

### 2.1 BPM Controller

```javascript
// bpm-controller.js
min = 30,           // BPM mínim
max = 240,          // BPM màxim
defaultValue = 100  // BPM per defecte

// NO clampar durant l'escriptura (permet entrada multi-dígit)
// Auto-clamp després de 1.5s sense teclejar
SANITIZE_DELAY = 1500  // ms

// Clampar al perdre focus (blur)
Math.min(max, Math.max(min, parsed))
```

### 2.2 Subdivisió i Timing

```javascript
// subdivision.js
// Fórmula tempo → interval
interval = 60 / bpm;  // Segons per pols

// Playback pulse count: afegir +1 si no hi ha loop (downbeat final)
loopEnabled ? total : total + 1

// Font scaling per Lg
BASE_REM = 1.2, TARGET = 24, K = 0.75, MIN_REM = 0.75
```

### 2.3 Fraccions i Selectabilitat de Polsos

```javascript
// pulse-selectability.js
const FRACTION_POSITION_EPSILON = 1e-6;  // Tolerància float

// Polsos 0 i Lg NO són directament seleccionables
if (index === 0 || index === lg) return false;

// Seleccionables: múltiples del numerador O dins rang resta
index % numerator === 0  // Múltiple
// O: index > lastCycleStart (resta)
lastCycleStart = Math.floor(lg / numerator) * numerator;

// Validació de fracció
// denominator > 0, numerator > 0, numerator < denominator
if (denominator <= 0 || numerator <= 0 || numerator >= denominator) return false;

// Clau de fracció: "base+numerator/denominator"
// Exemple: makeFractionKey(3, 1, 4) → "3+1/4"
```

### 2.4 Ritme i Notació

```javascript
// rhythm.js
// Noms de notes (castellà)
const NOTE_NAMES = {
    1: 'redonda', 2: 'blanca', 4: 'negra',
    8: 'corchea', 16: 'semicorchea', 32: 'fusa', 64: 'semifusa'
};

// Reducció de fraccions amb GCD
divisor = gcd(numerator, denominator);

// Power of two check (denominadors estàndard)
isPowerOfTwo(value) = (value & (value - 1)) === 0;

// Permutacions de polsos: màxim 512 patrons per defecte
generatePulsePermutations(totalPulses, { maxPatterns = 512 });
```

### 2.5 Utilitats Numèriques

```javascript
// number-utils.js
// Positive integer parsing: ha de ser finit i > 0
Number.isFinite(parsed) && parsed > 0

// GCD: algorisme euclidià iteratiu
// LCM: lcm(a, b) = Math.abs((a / gcd(a, b)) * b)

// Random int inclusiu
Math.floor(Math.random() * (hi - lo + 1)) + lo

// Range normalization: swap si min > max
min <= max ? [min, max] : [max, min]
```

### 2.6 Control de Loop

```javascript
// loop-control.js
// Sync crític amb motor d'àudio per evitar "pulse 0 repetit"
if (audio && typeof audio.setLoop === 'function') {
    audio.setLoop(newState);
}

// Default loop state
getLoopState: () => state.loopEnabled || false
```

### 2.7 Tap Tempo

```javascript
// tap-tempo-handler.js
// Requereix 3 taps mínim per detectar BPM
// Missatges (castellà):
initial: 'Se necesitan 3 clicks'
twoMore: '2 clicks más'
oneMore: '1 click más solamente'

// BPM arrodonit a 2 decimals
Math.round(result.bpm * 100) / 100
```

### 2.8 Inicialització d'Àudio

```javascript
// audio-init.js
// Ordre crític:
// 1. Carregar Tone.js PRIMER
await ensureToneLoaded();
// 2. Esperar interacció d'usuari
await waitForUserInteraction();
// 3. Tone.start() immediatament després del gest
await Tone.start();

// Prioritat d'instrument (apps melòdiques):
// per-app localStorage > global localStorage > app prefs > config default

// Assignar sons ABANS de ready() per evitar càrrega de defaults
```

### 2.9 Scheduling i Audio Bridge

```javascript
// audio-schedule.js
// Epsilon per comparacions temporals
const DEFAULT_EPSILON = 1e-9;
// Escala amb el període
epsilon = Math.max(DEFAULT_EPSILON, safePeriod * 1e-6);

// Downbeat: trobar proper zero crossing amb look-ahead
computeNextZero({ now, period, lookAhead });

// Re-anchor quan step arriba al límit del cicle
computeResyncDelay({ stepIndex, totalPulses, bpm });
```

### 2.10 Preferències i Storage

```javascript
// preferences.js
// Namespace amb separador '::'
prefixValue = `${prefix}${sep}`;

// Mute: '1' = muted, '0' = unmuted
// Tema per defecte: 'system'
window.matchMedia('(prefers-color-scheme: dark)').matches

// Factory reset keys
['baseSound', 'accentSound', 'startSound', 'cycleSound']
```

### 2.11 Audio Toggles

```javascript
// audio-toggles.js
// Format: '1' = enabled, '0' = disabled
safeSave(entry.storageKey, enabled ? '1' : '0');

// Invers: toggle enabled = canal NO mutat
mixer.setChannelMute(entry.mixerChannel, !enabled);

// ARIA: aria-pressed, class 'active', data-state='on'/'off'
```

### 2.12 Timeline Circular

```javascript
// circular-timeline.js
const NUMBER_HIDE_THRESHOLD = 100;  // Amagar números si Lg >= 100
const NUMBER_CIRCLE_OFFSET = 44;    // px entre cercle i número

// Geometria: angle = (i / lg) * 2π + π/2
// Barres endpoints: 25% del diàmetre
```

### 2.13 Sincronització Visual

```javascript
// visual-sync.js
// RAF a 60fps, no setInterval
rafHandle = requestAnimationFrame(step);

// Skip si mateixa step visual (deduplicació)
if (lastVisualStep === state.step) return;

// Cursor notació: currentPulse = step / resolution
```

### 2.14 Highlight Controller

```javascript
// simple-highlight-controller.js
highlightClass = 'active';              // Classe CSS per pols actiu
idx = index % pulses.length;            // Wrap amb mòdulo

// Loop: doble highlight al pulse 0 (també last)
if (loopEnabled && idx === 0) highlight(last);

// Restart animació: forçar reflow
void current.offsetWidth;
```

### 2.15 Spinner Repeat

```javascript
// spinner-repeat.js
initialDelay = 320;      // ms abans de repetir
repeatInterval = 80;     // ms entre repeticions
// Callback immediat al press, després repeteix
```

### 2.16 Escalat Visual per Lg

```javascript
// utils.js
// Hit size: base 32px a Lg=30, escala sqrt, clamp 14-44px
base = 32, refLg = 30, k = 0.5, minPx = 14, maxPx = 44

// Font numbers: base 1.3rem a Lg=30, sqrt scaling
BASE_REM = 1.3
MIN_REM = 0.85 (mobile) / 1.0 (desktop)
MAX_REM = 1.1  (mobile) / 2.4 (desktop)

// Detecció mobile: screen width <= 600px
window.matchMedia('(max-width: 600px)').matches
```

### 2.17 Cycle Counter

```javascript
// cycle-counter.js
flipDuration = 150;  // ms d'animació flip

// Classes: 'playing-zero' (inici cicle), 'playing-active' (cicle actiu)
// Format total: "c<sub>r</sub>" (cicles complets + resta com subscript)
```

### 2.18 Grid 2D Sync

```javascript
// grid-2d-sync-controller.js
// Format Row ID: "NrR" (e.g., "5r4" = nota 5, registre 4)
rowId?.match(/^(\d+)r(\d+)$/);

defaultRegistry = 4;      // Registre per defecte
notesPerRegistry = 12;    // Octava cromàtica
```

### 2.19 Registry Autoscroll

```javascript
// registry-playback-autoscroll.js
minRegistry = 2;     // Registre mínim visible
maxRegistry = 5;     // Registre màxim visible
visibleRows = 15;    // Notes visibles al grid
zeroPosition = 7;    // Posició on nota 0 apareix (centre)
smoothScroll = true; // Transicions suaus
```

---

## 3. Interfície Compartida (Shared UI)

**Directori:** `libs/shared-ui/`

### 3.1 Scheduling Profiles

```javascript
// header.js
// Mobile (<=600px): alta latència per estabilitat
{ lookAhead: 0.06, updateInterval: 0.03 }

// Balanced
{ lookAhead: 0.03, updateInterval: 0.015 }

// Desktop: baixa latència per precisió
{ lookAhead: 0.02, updateInterval: 0.01 }
```

### 3.2 Sons per Defecte

```javascript
// header.js
defaultBaseSound:   'click9'   // Hi-Hat
defaultAccentSound: 'click8'   // Caja
defaultStartSound:  'click7'   // Bombo
defaultCycleSound:  'click10'  // Ride
defaultInstrument:  'piano'
```

### 3.3 Color de Selecció

```javascript
// header.js
const DEFAULT_SELECTION_COLOR = '#7BB4CD';
// Storage key: 'sharedui:selectionColor'
```

### 3.4 Volum UI

```javascript
// header.js
// Slider: rang [0, 1], step 0.01, inicial 1.0
// Hide timeout: 500ms, animació: 300ms
```

### 3.5 Wake Lock

```javascript
// header.js
// Storage key: 'sharedui:wakeLockEnabled'
// Apps 1-5: activat per defecte
// Altres apps: desactivat per defecte
```

### 3.6 Hover Tooltips

```javascript
// hover.js
color: '#fff'                  // Text blanc
background: 'rgba(0,0,0,0.6)' // Fons semi-transparent fosc
fontSize: '0.75rem'
```

### 3.7 Instruments Disponibles

```javascript
// instrument-dropdown.js
const INSTRUMENTS = ['piano', 'flute'];

// Timeout d'engine ready: 2s (20 intents × 100ms)
```

### 3.8 P1 Toggle i Fraccions Complexes

```javascript
// header.js
// P1 Toggle (so d'inici): activat per defecte
// Storage key: 'p1Toggle'

// Fraccions complexes: activades per defecte
// Storage key: 'enableComplexFractions'
```

---

## 4. Grids i Seqüenciadors

### 4.1 Matrix-Seq (Editor Grid N-P)

**Directori:** `libs/matrix-seq/`

```javascript
// state.js
// Rangs per defecte
noteRange:  [0, 11]  // 12 notes
pulseRange: [0, 7]   // 8 polsos

// Ordenació de pairs:
// Primari: per pulse (ascendent)
// Secundari: per note (ascendent)

// Modes de renderització: 'rows', 'columns' (default: 'rows')
// Auto-jump: desactivat per defecte

// drag.js
// Notes: permet duplicats, preserva ordre de drag
// Polsos: elimina duplicats, ordena ascendent
// Només botó esquerre: e.button === 0
```

### 4.2 Musical Grid (Visualització 2D)

**Directori:** `libs/musical-grid/`

```javascript
// musical-grid.js
notes:   12,     // Files per defecte (12 notes)
pulses:  9,      // Columnes per defecte (9 polsos)
startMidi: 60,   // C4

// Scroll
scrollEnabled: false,  // Desactivat per defecte
visibleRows:    15,
visibleColumns: 12,

// Classes CSS
cellClass:      'musical-cell',
activeClass:    'active',
highlightClass: 'highlight',

// Intervals
showIntervals: false,
intervalColor: '#4A9EFF',  // Blau

// Validació: notes > 0, pulses > 0
```

### 4.3 Interval Sequencer

**Directori:** `libs/interval-sequencer/`

```javascript
// interval-converter.js
// iT (interval temporal): mínim 1
// Rang de notes per defecte: [0, 11]
// Màxim pulse: 8
// Base pair: {note: 0, pulse: 0}

// interval-renderer.js
// Highlight duration: 300ms
// Cell width: matrixWidth / totalSpaces
```

### 4.4 Pulse-Seq (Seqüències de Polsos)

**Directori:** `libs/pulse-seq/`

```javascript
// pulse-seq.js
// Overlays: màxim 2
const overlayIds = ['pulseSeqHighlight', 'pulseSeqHighlight2'];

// Mode estàndard: prefix "Pulsos (", zero mostrat
// Mode intervals: prefix "P (", sense zero

// Rang vàlid en mode interval: [1, Lg]
// Processament: eliminar duplicats, ordenar ascendent
```

### 4.5 Plano Modular

**Directori:** `libs/plano-modular/`

```javascript
// registry-helpers.js (App19)
// Registres: r3, r4, r5, r6 (48 files total)
// Notes per registre: 12, ordre descendent (11→0)
// Files visibles: 24
// MIDI offset: 12

// Format Row ID: "{noteInReg}r{registry}"
// MIDI: registry * 12 + noteInReg + 12

// plano-grid.js
cellWidth:  '50px',
cellHeight: 'var(--plano-cell-height, 32px)'
```

### 4.6 Plano Fracción

**Directori:** `libs/plano-fraccion/`

```javascript
// fraction-math.js
// Lg ajustat per fracció
Lg = Math.max(1, Math.floor(baseLg / numerator) * numerator);

// Subdivisions
// Simple (n=1): totalSubdivisions = lg * d
// Complex (n>1): totalSubdivisions = (lg * d) / n

// Posició: position = subdivision * n / d
// Decimals: .toFixed(2)

// Filtratge de notes: descartar durades <= 0 i notes >= maxSubdiv
```

---

## 5. Notació Musical

**Directori:** `libs/notation/`

### 5.1 Durades i Staff

```javascript
// rhythm-staff.js
const DEFAULT_HEIGHT = 200;    // px
const HORIZONTAL_MARGIN = 18;  // px

// Position scale factor (precisió float)
const POSITION_SCALE = 1e6;
const WHOLE_PULSE_EPSILON = 1e-6;

// Staff keys
REST_KEY:     'b/4',
NOTE_KEY:     'c/5',
DOWNBEAT_KEY: 'd/4',
SELECTED_KEY: 'c/5',

// Durades beamable: '8', '16', '32', '64'
```

### 5.2 Mapeig Durada ↔ Notació

```javascript
// utils.js / fraction-notation.js
// Durada per defecte: '8' (corchea)
'w' / 'whole':         Redonda
'h' / 'half':          Blanca
'q' / 'quarter':       Negra
'8' / 'eighth':        Corchea
'16' / 'sixteenth':    Semicorchea
'32' / 'thirtysecond': Fusa
'64' / 'sixtyfourth':  Semifusa

// Fraccions → notació (exemples clau):
(1, 1) → 'q'           // Negra
(1, 2) → '8'           // Corchea
(1, 3) → '8' + tuplet  // Treset
(1, 4) → '16'          // Semicorchea
(2, 1) → 'h'           // Blanca
(3, 1) → 'h' + 1 dot   // Blanca amb punt
(4, 1) → 'w'           // Redonda
```

### 5.3 Pentagrama

```javascript
// pentagram.js
// Single clef: 240px × auto
// Dual clef: 625px × 340px
// Stave Y: (height - 80) / 2 o 80px

// Accidental padding: 4px, border-radius: 4px, border: 2px
```

---

## 6. Escales Musicals

**Directori:** `libs/scales/`

### 6.1 Escales Mare (Mother Scales)

```javascript
// index.js
const SCALES = {
    CROM:  { ee: [1,1,1,1,1,1,1,1,1,1,1,1], rotations: 1  },  // Cromàtica
    DIAT:  { ee: [2,2,1,2,2,2,1],             rotations: 7  },  // Diatònica (7 modes)
    ACUS:  { ee: [2,2,2,1,2,1,2],             rotations: 7  },  // Acústica
    ARMme: { ee: [2,1,2,2,1,3,1],             rotations: 7  },  // Armònica Menor
    ARMma: { ee: [2,2,1,2,1,3,1],             rotations: 7  },  // Armònica Major
    PENT:  { ee: [2,2,3,2,3],                 rotations: 2  },  // Pentatònica
    OCT:   { ee: [1,2,1,2,1,2,1,2],           rotations: 2  },  // Octatònica
    HEX:   { ee: [1,3,1,3,1,3],               rotations: 2  },  // Hexatònica
    TON:   { ee: [2,2,2,2,2,2],               rotations: 1  }   // Tons Enters
};

// Modes diatònics: Mayor, Dórica, Frigia, Lidia, Mixolidia, Eolia, Locria
```

### 6.2 Colors d'Intervals (per semitons)

```javascript
// index.js
// 0 semitons:     #7CD6B3 (Verd)       — Resonant (Uníson)
// 1, 11 semitons: #F28AAD (Rosa/Vermell) — Dissonant (2a menor, 7a major)
// 2, 10 semitons: #E8A090 (Rosa clar)    — Dissonant (2a major, 7a menor)
// 3, 9 semitons:  #9AC8D8 (Blau clar)    — Consonant (3a menor, 6a major)
// 4, 8 semitons:  #7BB4CD (Blau)         — Consonant (3a major, 6a menor)
// 5, 7 semitons:  #8DDBC5 (Verd clar)    — Resonant (4a/5a justes)
// 6 semitons:     #FFBB33 (Groc)         — Neutral (Tríton)
```

### 6.3 Scale Selector

```javascript
// scale-selector.js
// Presets disponibles: 'app21', 'all', 'diatonic', 'heptatonic',
//                      'symmetric', 'motherScalesOnly'

// Transposició: rang 0-11 semitons (12 botons cromàtics)
// Default: 0 (sense transposició)
```

### 6.4 Helpers de Notes

```javascript
// helpers.js
// Ordre diatònic: ['c','d','e','f','g','a','b']
// Letter → pitch class: {c:0, d:2, e:4, f:5, g:7, a:9, b:11}
// Ordre de sostinguts: ['F','C','G','D','A','E','B']
// Ordre de bemolls:    ['B','E','A','D','G','C','F']
// Sensibilitat cromàtica màxima: 6 semitons
```

---

## 7. Randomització

**Directori:** `libs/random/`

### 7.1 Rangs per Defecte

```javascript
// core.js
Lg: { min: 2,   max: 30  }    // Polsos
V:  { min: 40,  max: 320 }    // BPM
T:  { min: 0.1, max: 10  }    // Duració (segons)

// T: continu → Math.random() * (hi - lo) + lo
// Lg, V: enter → Math.floor(Math.random() * (hi - lo + 1)) + lo
```

### 7.2 Fraccions Aleatòries

```javascript
// fractional.js
// Mode simple (allowComplex=false): n fixat a 1, d varia
// Mode complex (allowComplex=true): n i d varien
// Densitat de selecció de polsos: 0.5 (50%)
```

---

## 8. Gamificació

**Directori:** `libs/gamification/`

### 8.1 Configuració Global

```javascript
// config.js
enabled: true,
checkInterval: 30000,    // ms (verificació d'achievements)
saveInterval:  10000,    // ms (persistència de dades)
maxStorageSize: 5 * 1024 * 1024,  // 5 MB
eventDebounce: 100       // ms (anti-spam)
```

### 8.2 Llindars de Complexitat i Precisió

```javascript
// config.js
sessionTimeout:      300,   // segons (inactivitat → nova sessió)
practiceMinDuration: 10,    // segons mínim per comptar

accuracyExcellent:   90,    // %
accuracyGood:        75,    // %
accuracyAcceptable:  60,    // %

complexityLow:    10,       // Lg < 10
complexityMedium: 30,       // Lg 10-30
complexityHigh:   50,       // Lg 30-50
// Lg >= 50: Expert

streakSmall:   5,
streakMedium:  10,
streakLarge:   20,
streakEpic:    50
```

### 8.3 Puntuació Base per Tipus d'Event

```javascript
// scoring-system.js
PRACTICE_STARTED:       10,
PRACTICE_COMPLETED:     30,
PATTERN_PLAYED:          5,
TAP_TEMPO_USED:          3,
TAP_TEMPO_ACCURATE:     15,
RHYTHM_MATCHED:         20,
PERFECT_TIMING:         30,
PARAMETER_CHANGED:       2,
RANDOMIZATION_USED:      5,
FRACTION_CREATED:        8,
PULSE_PATTERN_CREATED:  10,
LOOP_ACTIVATED:          5,
PRACTICE_TIME_MILESTONE:50,
SESSION_STREAK:         25,
DAILY_PRACTICE:        100,
COMPLEXITY_INCREASED:   15,
ADVANCED_FEATURE_USED:  20,
PATTERN_MASTERED:       50
```

### 8.4 Multiplicadors

```javascript
// scoring-system.js
// Streak: 5→1.2×, 10→1.5×, 20→2.0×, 50→3.0×
// Temps pràctica: 5min→1.1×, 10min→1.3×, 20min→1.5×, 30min→2.0×
// Complexitat: LOW→1.0×, MEDIUM→1.2×, HIGH→1.5×, EXPERT→2.0×
// Precisió: PERFECT(100%)→2.0×, EXCELLENT(90-99)→1.5×, GOOD(75-89)→1.2×

// Bonus especials
FIRST_TIME:       50,
DAILY_BONUS:     100,
PERFECT_SESSION: 200,
EXPLORATION:      25,
CREATIVE:         30
```

### 8.5 Progressió de Nivells

```javascript
// scoring-system.js
//  1:     0 pts → Principiante
//  2:   100 pts → Aprendiz
//  3:   300 pts → Estudiante
//  4:   600 pts → Practicante
//  5:  1000 pts → Competente
//  6:  1500 pts → Avanzado
//  7:  2500 pts → Experto
//  8:  4000 pts → Maestro
//  9:  6000 pts → Virtuoso
// 10: 10000 pts → Gran Maestro
```

### 8.6 Achievements

```javascript
// achievements.js (exemples clau)
// Inici: total_practices >= 1 → 10 pts
// Ritme: patterns_played >= 10/50/200 → 15/30/100 pts
// Precisió: perfect_streak >= 5 → 50 pts, accurate_taps >= 10 → 40 pts
// Temps: sessió >= 300s/900s/1800s → 10/25/50 pts
// Creativitat: patterns_created >= 20 → 30 pts
// Constància: dies consecutius >= 7/14/30 → 100/200/500 pts
```

---

## 9. Captura d'Àudio i Anàlisi Rítmica

**Directori:** `libs/audio-capture/`

### 9.1 Micròfon

```javascript
// microphone.js
threshold:          -30,   // dB (llindar de detecció)
minInterval:        100,   // ms (debounce entre beats)
smoothing:          0.8,   // Factor de suavitzat (0-1)
detectionIntervalMs: 50,   // ms (freqüència de polling)
MINIMUM_THRESHOLD:  -22,   // dB (terra de seguretat per calibració)

// Calibració: duració 2000ms, interval 50ms
// Marge: max(5, stdDev × 1.5), clamp a 8 dB
// Detecció: sistema GATE (rising edge triggering)
```

### 9.2 Anàlisi Rítmica

```javascript
// rhythm-analysis.js
timingTolerance:    200,   // ms
tempoTolerance:     15,    // BPM
consistencyWindow:  500,   // ms

// Pesos de puntuació
timingWeight:       0.5,
consistencyWeight:  0.3,
tempoWeight:        0.2,

// Feedback (castellà)
// >= 90%: "¡Excelente! Ritmo casi perfecto."
// >= 75%: "¡Muy bien! Buen ritmo con pequeñas desviaciones."
// >= 60%: "Bien. Intenta mantener el tempo más constante."
// >= 40%: "Regular. Practica para mejorar la precisión."
// <  40%: "Sigue practicando. Concéntrate en el tempo."
```

---

## 10. Entrenament Auditiu

**Directori:** `libs/ear-training/`

### 10.1 Exercici 1: Captura Lliure

```javascript
// exercise-definitions.js
// Nivell 1: Lg=4,  posicions=[1,3], tolerància=150ms, min_accuracy=70%
// Nivell 2: Lg=4,  posicions=[0,2], tolerància=150ms, min_accuracy=75%
// Nivell 3: Lg=10, posicions=[0,2,5], tolerància=120ms, min_accuracy=80%
// Nivell 4: Lg=10, posicions=[1,3,6], tolerància=100ms, min_accuracy=85%
// Pesos: timing=0.4, consistency=0.3, tempo=0.3
```

### 10.2 Exercici 2: Sync amb Referència

```javascript
// BPM: 60-240, repeticions per nivell: 3
// Count-in: 4 beats (visual + àudio)
// Nota count-in: 76 (E5), nota referència: 60 (C4)
// Duració click referència: 0.1s
// Pesos: timing=0.5, consistency=0.3, tempo=0.2
```

### 10.3 Exercici 3: Tap Tempo Sync

```javascript
// Lg=8 (totes les posicions), tolerància=±100ms
// Min accuracy: 80%, repeticions: 3, BPM: 60-240
// Count-in: 4 beats
// Pesos: timing=0.6, consistency=0.4, tempo=0
```

### 10.4 Exercici 4: Reconeixement de Fraccions

```javascript
// Nivell 1: n=[1,1] fix, d=[1,12], Lg=[6,16], accuracy=80%, 10 preguntes
// Nivell 2: n=[1,7],    d=[1,12], Lg=[6,20], accuracy=85%, 15 preguntes
// Àudio: BPM=120 fix, loopCount=2
```

### 10.5 Fórmula de Timestamps

```javascript
// exercise-runner.js
// T = (Lg × 60) / BPM (duració total en segons)
// timestamps[i] = posició en ms
// Detecció BPM: BPM = 60000 / avgInterval
```

---

## 11. Intervals Temporals

**Directori:** `libs/temporal-intervals/`

```javascript
// it-calculator.js
// Per un Lg donat:
// Total intervals = Lg
// Interval k: pulse (k-1) → pulse (k)
// Polsos: 0 a Lg

// Exemple Lg=3:
// Interval 1: pulse 0 → pulse 1
// Interval 2: pulse 1 → pulse 2
// Interval 3: pulse 2 → pulse 3
```

---

## 12. Utilitats Matemàtiques

**Directori:** `libs/utils/`

```javascript
// index.js
// Random int inclusiu
randInt(a, b) = Math.floor(Math.random() * (b - a + 1)) + a;

// Clamping
clamp(x, min, max) = x < min ? min : x > max ? max : x;

// Wrapping simètric
wrapSym(n, m)  // Ex: wrapSym(6, 10) = -4
```

---

## 13. Patrons d'Inicialització d'App

### 13.1 Seqüència Estàndard

```javascript
// 1. index.html → renderApp() + initHeader()
import { renderApp } from '../../libs/app-common/template.js';
import { initHeader } from '../../libs/shared-ui/header.js';
renderApp({ root, title, /* config */ });
initHeader();
import('./main.js');

// 2. main.js → Audio bridge + DOM binding
const schedulingBridge = createSchedulingBridge({ getAudio: () => audio });
window.addEventListener('sharedui:scheduling', schedulingBridge.handleSchedulingEvent);
const { elements, leds, ledHelpers } = bindAppRhythmElements('appN');

// 3. Preferences + Theme
const preferenceStorage = createPreferenceStorage({ prefix: 'appN', separator: ':' });
registerFactoryReset({ storage: preferenceStorage });
setupThemeSync({ storage: preferenceStorage, selectEl: themeSelect });

// 4. Audio init (lazy, al primer play/tap)
async function initAudio() {
    if (!audio) {
        audio = await _baseInitAudio();
        window.__labAudio = audio;
    }
    return audio;
}

// 5. Playback
const timing = fromLgAndTempo(lg, v);
const playbackTotal = toPlaybackPulseCount(lg, loopEnabled);
audio.play(playbackTotal, interval, selectedForAudio, loopEnabled, onStep, onFinish);
visualSync.start();
```

### 13.2 Regla dels 3 Valors (Lg, V, T)

```
Mantenir exactament 2 camps manuals + 1 auto.
Quan 2 camps tenen valor → calcular el 3r automàticament.
Recalcular a cada canvi de valor.
LED states: 'led-auto' (calculat) vs 'led-active' (manual)
```

---

## 14. Fitxers PROHIBITS de Modificar

```
libs/sound/timeline-processor.js — Timing crític del motor (AudioWorklet) + sincronització de veus
libs/app-common/subdivision.js   — Càlculs d'intervals (60/bpm)
libs/app-common/audio-schedule.js — Matemàtica de resync/look-ahead (computeResyncDelay)
```

---

## 15. Resum de Restriccions Clau

| Regla | Valor | Font |
|-------|-------|------|
| **Timing** | | |
| Bloc processament AudioWorklet | 128 samples | sound/timeline-processor.js |
| Epsilon de beat | 1e-9 | sound/timeline-processor.js |
| Mínim seconds/beat | 1e-6 | sound/timeline-processor.js |
| Epsilon de fracció | 1e-6 | app-common/pulse-selectability.js |
| **BPM** | | |
| Rang global | 30 - 240 | app-common/bpm-controller.js |
| Default | 100 | app-common/bpm-controller.js |
| Rang melodic | 75 - 200 | sound/melodic-sequence.js |
| Sanitize delay | 1500 ms | app-common/bpm-controller.js |
| **Volum** | | |
| Rang | [0, 1] | sound/mixer.js |
| Master default | 0.75 | sound/mixer.js |
| Instrument channel | 1.0 | sound/melodic-audio.js |
| Rhythm channels | 0.1 | sound/melodic-audio.js |
| **Registre/MIDI** | | |
| Registres | 0-7 (8 total) | sound/registry-controller.js |
| Notes per registre | 12 | sound/registry-controller.js |
| MIDI offset | 12 | sound/registry-controller.js |
| Display notes | 13 | sound/registry-controller.js |
| **Sampler** | | |
| Pool size | 16 veus | sound/sampler-pool.js |
| ADSR default | A=5ms D=100ms S=80% R=300ms | sound/sampler-pool.js |
| Quick release | 50 ms | sound/sampler-pool.js |
| Low-latency mode | 1-3 ms | sound/sampler-pool.js |
| **Veus polirítmiques** | | |
| Numerador mínim | 1 | sound/timeline-processor.js |
| Denominador mínim | 1 | sound/timeline-processor.js |
| **Randomització** | | |
| Lg rang | 2 - 30 | random/core.js |
| V rang | 40 - 320 | random/core.js |
| T rang | 0.1 - 10 | random/core.js |
| Densitat polsos | 0.5 (50%) | random/fractional.js |
| **Visual** | | |
| Hit size | 14-44 px (base 32 a Lg=30) | app-common/utils.js |
| Font numbers | 0.85-2.4 rem (base 1.3) | app-common/utils.js |
| Mobile threshold | <=600 px | app-common/utils.js |
| Timeline hide numbers | Lg >= 100 | app-common/circular-timeline.js |
| Circle offset | 44 px | app-common/circular-timeline.js |
| Spinner initial delay | 320 ms | app-common/spinner-repeat.js |
| Spinner repeat | 80 ms | app-common/spinner-repeat.js |
| **Gamificació** | | |
| Session timeout | 300 s | gamification/config.js |
| Practice min duration | 10 s | gamification/config.js |
| Accuracy excellent | 90% | gamification/config.js |
| Max level | 10 (Gran Maestro) | gamification/scoring-system.js |
| Max level score | 10000 pts | gamification/scoring-system.js |
| **Audio Capture** | | |
| Mic threshold | -30 dB | audio-capture/microphone.js |
| Min beat interval | 100 ms | audio-capture/microphone.js |
| Timing tolerance | 200 ms | audio-capture/rhythm-analysis.js |
| **Ear Training** | | |
| BPM range | 60 - 240 | ear-training/exercise-definitions.js |
| Count-in beats | 4 | ear-training/exercise-definitions.js |
| Max timing tolerance | 150 ms | ear-training/exercise-definitions.js |
| Min accuracy | 70% | ear-training/exercise-definitions.js |
| **Notació** | | |
| Staff height | 200 px | notation/rhythm-staff.js |
| Position scale | 1e6 | notation/rhythm-staff.js |
| Default duration | '8' (corchea) | notation/utils.js |
| **Escales** | | |
| Mother scales | 9 | scales/index.js |
| Transposició rang | 0-11 semitons | scale-selector.js |
| Colors d'interval | 7 categories (12 semitons) | scales/index.js |
