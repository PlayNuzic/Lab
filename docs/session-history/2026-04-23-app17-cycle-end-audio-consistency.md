# Sessió 2026-04-23 / 2026-04-24 — Migració App17 + cycle-end marker + audio consistency

## Resum

Tres blocs de feina concatenats:

1. **Migració App17** al tema nuzic (timeline circular).
2. **Marcador `cycle-end`** (`·` amb dobles guions) aplicat a totes les apps que acaben amb un pols visual no-sonant.
3. **Audio consistency**: App14 i App18 migrades al motor compartit per passar per la cadena d'FX.

## Commits de la sessió

- `628763b` feat(App17): migrate to nuzic visual theme
- `8244cd9` fix(App17): nuzic dual-pill round, controls outside wrapper, radial ticks
- `9ba6a0c` refactor(App17): drop createCircularTimeline, render circular inline
- `84620f2` fix(App17): ticks touch donut edges cleanly, numbers centered on ring
- `4e40e1f` fix(App17): pulse-number superscripts always visible
- `01a9204` / `24d6b9d` Canvio texto etiqueta measure.header *(App16 cycle-end alignment; commit messages confusos, no impacten el codi finalment lliurat)*
- `0944a1c` feat(cycle-end): shared `·` endpoint marker across linear-timeline apps
- `e412525` fix(cycle-end): silence pulse Lg without losing its subdivisions
- `8e2a3eb` fix(app9, app13): apply cycle-end marker and dark-mode interval color
- `079d96c` feat(cycle-end): apply `·` endpoint marker to grid-based apps (Phase 2)
- `fb7b356` fix(audio): route App14 and App18 through the shared FX chain

## App17 — migració nuzic

**Decisions visuals preses**:

- **Pastilla `.param--large--dual`**: nova variant a `nuzic-theme.css` (FASE 14). Disc groc rodó (`aspect-ratio: 1`) que conté dos inputs niats: `.pl-primary` (cercle blanc amb Compás) + `.pl-secondary` (mini-pastilla amb Cycle). Spinners només per Compás. `margin-top: 8%` al `.pl-primary` perquè els dos quedin centrats verticalment.

- **Timeline circular** pintat com a donut crema via `radial-gradient(circle closest-side, transparent 40%, yellow-light 100%)`. El `closest-side` és crític perquè `100%` es resolgui a `min(w,h)/2` (coincidint amb el JS). Sense això el gradient va a `farthest-corner` i els números queden fora del donut pintat.

- **Pulse-numbers renderitzats inline** (es va descartar `createCircularTimeline`). JS propi amb trigonometria: pos x/y via `rect.getBoundingClientRect()`, ringRadius al 70% del fullRadius, rotació tangencial (`transform: rotate(<angle>deg)` per cada número).

- **Ticks radials**: els pseudo `::before/::after` viuen dins del número rotat → hereten la rotació automàticament. Mides dinàmiques:
  - `tickLength = Math.min(slotOuter, slotInner) * 0.5` (l'usuari va demanar factor 0.5).
  - `OUTER_R_RATIO = 1.00`, `INNER_R_RATIO = 0.40`, `CENTER_R_RATIO = 0.70`.
  - `gapBefore`/`gapAfter` calculats per arribar exactament a la vora, menys `EDGE_INSET_PX = 3`.

- **Superíndexs sempre visibles**: `<sup>1</sup>` al render inicial (no via `superscriptController.updateAll(1)`), `updateAll(cycleNumber)` durant play per canviar el cicle, `reset()` al stop per tornar a `1`.

- **Longitud total al centre** del cercle intern, `clamp(1.25rem, 2.4vw, 1.6rem)` (mida del `.measure-marker__circle` d'App16).

- **Controls fora del wrapper** (Play · BPM · Random · Reset) — JS ho insertBefore després de `.timeline-wrapper` perquè la regla CSS base `.timeline-wrapper.circular > .controls { position: absolute }` no els aplani al centre del cercle.

**Fitxers tocats**: `Apps/App17/index.html`, `Apps/App17/main.js`, `Apps/App17/styles.css`, `libs/shared-ui/nuzic-theme.css` (FASE 14).

## Cycle-end marker — fase 1 (linear timelines)

**Concepte**: el darrer pols d'una seqüència es dibuixa com a `·` amb dobles guions `||` a dalt i a baix, i NO sona. Actua com a "tancament visual" de la seqüència.

**CSS compartit** (`libs/shared-ui/nuzic-theme.css`): regla `.timeline .pulse-number.cycle-end` amb `height: 1.2em; display: inline-flex; align-items: center; justify-content: center` per fixar el bounding box (el `·` té bounding box petit al baseline, descentraria els ticks). Els pseudos `::before/::after` dupliquen la línia amb `box-shadow: 5px 0 0 0 var(--nuzic-dark)` i un shift `translateX(calc(-50% - 2.5px))`.

**Apps migrades**:
- **App9, App13, App26, App28, App30**: canvi visual (darrer `.pulse-number` amb classe `cycle-end` i text `·`).
- **App9**: `audio.play(TOTAL_PULSES - 1)` per no sonar el darrer.
- **App26, App28**: pattern **"endpoint pulse mute"** — `scaledTotal = lg*d + 1` perquè els cycle events del subdivision abans del pols Lg s'emetin (el motor talla just després del pulse final amb `active=false`). `patternBeats = lg*d` perquè NO es generin cycle events dins del pols Lg. `onSchedule(stepIndex === lg*d)` → `setChannelMute('pulse', true)` per silenciar el base sample del pols Lg. `onFinish`/`stopPlayback` restaura el canal.
- **App30**: només canvi visual (l'últim iT segueix sonant).

**App16**: només alineació dels dobles guions (ja tenia el `·`). Els `::before/::after` es descentraven perquè el `·` té bounding box més petit que un dígit — fixar `height: 1.2em` al parent els torna a lloc. CSS mogut d'App16 al tema compartit.

**App9 dark mode**: fixat `color: #43433b` a `.interval-cell` perquè `--nuzic-dark` gira a cream en dark i quedava invisible sobre fons blanc.

**App32 i App34** (plano 2D + fracció): mateix endpoint-mute pattern. Utilitzen estat module-level (`endpointPulseMuted` + `endpointPulseMuteWasMuted` + `restoreEndpointPulseMute`) perquè `stopPlayback` (user) i `onFinish` (auto) han de restaurar el canal.

## Cycle-end marker — fase 2 (grid apps)

**Libs modificats**:

- **`libs/musical-grid/musical-grid.js`**: nou config `showCycleEnd` (default `false`). Quan `true`, el darrer pulse-marker (index `pulses - 1`) renderitza com `·` amb classe `cycle-end` i sense click handler.
- **`libs/plano-modular/plano-grid.js`**: nou option `showCycleEnd` a `updateTimeline`. Quan `true`, la darrera columna renderitza com `·` amb classe `plano-cycle-end`.
- **`libs/plano-modular/index.js`**: `showCycleEnd` s'exposa al `createPlanoModular` i es passa a `updateTimeline` a cada refresh.

**CSS compartit** al nuzic-theme: regles bessones per `.pulse-marker.cycle-end` i `.plano-timeline-number.plano-cycle-end`.

**Gotcha: clipping al marge dret del grid** (App25/App25B). El darrer marker seu just a la vora dreta del `.timeline-wrapper` (que té `overflow: hidden` heretat del `main`). Amb `box-shadow: 5px 0 0 0` (rightward), el segon guió es retallava fora del container.

**Solució**: projectar la duplicació cap a l'**esquerra** (`box-shadow: -5px 0 0 0`). Llavors el `·` text queda a `matrixWidth` i els `||` a `matrixWidth - 5px`. Per alinear el `·` amb el midpoint del `||`, s'aplica `text-indent: -6.5px` al marker (els 5px del shift del tick + ~1.5px per compensar que el glyph `·` d'Ubuntu no està centrat perfectament dins el character cell).

**Apps migrades**: App11, App11A, App12, App15, App25, App25B. Cap playback tocat — totes passaven ja `SEQUENCE_PULSES` / `TOTAL_SPACES` (= `TOTAL_PULSES - 1`) al play.

**Apps excloses** (per l'usuari): App17 (circular), App18/21-24 (soundlines verticals), App10 (soundline), App19/20/27/29/31/32 onwards (en bucle o no apliquen).

## Patró "endpoint pulse mute" (referència futura)

Per apps on **l'últim pols visual no ha de sonar PERÒ** les subdivisions just abans sí que han de sonar:

```js
const baseResolution = d;                 // o 1, segons l'app
const endpointStep = lg * d;
const scaledTotal = endpointStep + 1;     // engine arriba fins al pols Lg
const scaledInterval = (60 / bpm) / d;

// record + helper
let endpointPulseMuted = false;
let endpointPulseMuteWasMuted = false;
function restoreEndpointPulseMute() {
  if (endpointPulseMuted) {
    setChannelMute('pulse', endpointPulseMuteWasMuted);
    endpointPulseMuted = false;
  }
}

endpointPulseMuteWasMuted = !!getMixer()?.getChannelState?.('pulse')?.muted;
endpointPulseMuted = false;

audioInstance.play(scaledTotal, scaledInterval, selectedPulses, false,
  highlightPulse,
  () => { /* onFinish */ restoreEndpointPulseMute(); /* stop logic */ },
  {
    baseResolution,
    patternBeats: endpointStep,           // cycle events dins [0, lg*d)
    cycle: { numerator: n * d, denominator: d, onTick: highlightCycle },
    onSchedule: (stepIndex) => {
      if (stepIndex === endpointStep && !endpointPulseMuted) {
        setChannelMute('pulse', true);
        endpointPulseMuted = true;
      }
    }
  }
);
```

També cridar `restoreEndpointPulseMute()` a `stopPlayback` per quan l'usuari para manualment.

**Per què funciona**: el motor emet cycle events a beats < `patternBeats`. Amb `patternBeats = endpointStep`, els beats generats son 0, 1, ..., endpointStep-1 (exactament les subdivisions fins just abans del pols Lg). El pulse a `endpointStep` sí s'emet (totalBeats = endpointStep+1), però el canal `pulse` està mutat → el sample base `pulso` no sona.

## Audio consistency — App14 i App18

**Motor compartit**: `libs/sound/index.js` exposa `TimelineAudio` (assignada a `window.NuzicAudioEngine`). `libs/sound/piano.js` → `loadPiano()` mira si `window.NuzicAudioEngine.getMelodicChannel()` existeix; si sí, connecta el sampler al canal (amb FX). Si no, `sampler.toDestination()` → **bypass total** (sense reverb, més fort).

**App14 i App18** no usaven `TimelineAudio`. Feien `loadPiano()` directament + `piano.triggerAttackRelease()` + `Tone.getDestination().volume = dB` per volum/mute. Resultat: sonaven més fort i sense reverb.

**Migració**:
- Imports: `createMelodicAudioInitializer` del `libs/app-common/audio-init.js`.
- `piano.triggerAttackRelease(noteName, dur, when)` → `audio.playNote(midi, dur, when)`. App14 fa conversió directa `START_MIDI + noteIndex`. App18 ja tenia MIDI via `registryController.getMidiForNote`.
- Tret `setupVolumeControl`: el header ja connecta amb `setVolume/setMute` del mixer compartit, no cal listener local.
- Tret `piano.dispose()` / `piano.releaseAll()`: el motor gestiona el seu cicle. App18 ara `audio.stop()` per parar notes en vol.
- `window.__labAudio = audio` perquè el header pugui trobar la instància.

**Totes les apps restants** (App1-13, 15-17, 19-35, 11A, 25B) ja estaven en Category A (clean). L'auditoria de l'agent Explore va tenir errors (deia App21-25 eren C), però verificació manual va confirmar que només 14 i 18 eren bypass.

**Codi mort a App14**: `NOTE_NAMES`, `OCTAVE`, `getNoteName()` ara no s'usen (playback via MIDI). Deixats al fitxer — no és prioritat netejar.

## Coses que no ens hem atrevit a tocar

- **`libs/sound/timeline-processor.js`** — es va provar canviar l'ordre (emetre cycle events ABANS del pulse dins el mateix sample) per solucionar que l'últim cycle event no s'emet quan el motor marca `active=false`. **Va trencar P0 i la darrera subdivision**. El canvi es va revertir. El patró "endpoint pulse mute" + `scaledTotal = lg*d + 1` és la solució que evita tocar el motor.

## Memòria memoritzable (candidates per escriure a memory/)

- Patró "endpoint pulse mute" (descrit a sobre) — reusable per qualsevol app que vulgui silenciar un pols específic sense trencar els cycle events que el precedeixen.
- Regla CSS compartida `cycle-end` als tres selectors (`.pulse-number`, `.pulse-marker`, `.plano-timeline-number`) amb `height: 1.2em; display: inline-flex`.
- `radial-gradient(circle closest-side, ...)` vs `farthest-corner` — si es mescla càlcul CSS amb JS trigonometria sobre el mateix radi, el `closest-side` alinea el `100%` del gradient amb `min(width, height) / 2` (el que fa servir el JS).
- `.pulse-marker.cycle-end` als grid-apps ha de projectar el box-shadow cap a l'esquerra (no dreta) perquè el darrer marker està al 100% de la timeline i `overflow: hidden` del `main` talla el que surt a la dreta.
