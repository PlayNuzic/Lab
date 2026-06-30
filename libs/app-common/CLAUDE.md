# App-Common — Context for Claude

## Role
Middleware layer between UI and TimelineAudio. 54 modules. Everything reusable across apps lives here.

## Modules by Function

**Initialization:**
- `audio-init.js` — Lazy TimelineAudio creation (suppresses warnings)
- `fraction-app-shell.js` — `createFractionAppShell` (App26-31): preferències + factory reset + sound events + toggles + mixer menu + theme/mute + initAudio (rhythm/melodic) en una crida declarativa
- `fraction-timeline.js` — `createFractionTimeline` (App26-31): esquelet de la línia de temps de fraccions (polsos + etiqueta n/d + ticks de subdivisió + layout %); deltes per app via decoradors
- `fraction-highlight.js` — `createFractionHighlighter` (App26-29): highlights de playback (pols enter + parella marcador/etiqueta) amb el reflow forçat load-bearing
- `fraction-editor-nuzic.css` — crom nuzic compartit del fraction-editor (spinner half-pill, endcaps, franja) amb vars `--fe-*`; les apps l'enllacen abans del seu styles.css
- `dom.js` — `bindAppRhythmElements(appId)` central DOM binding

**Audio & Control:**
- `audio.js` — Bridges for `sharedui:*` events
- `audio-schedule.js` — `computeResyncDelay`, downbeat zero-crossing with look-ahead
- `audio-toggles.js` — Declarative mute toggles (format: '1'=enabled, '0'=disabled)
- `loop-control.js` — 3 variants: `createLoopController`, `createRhythmLoopController`, `createPulseMemoryLoopController`
- `visual-sync.js` — Consolidated visual sync (simple + complete), uses RAF at 60fps

**UI:**
- `fraction-editor.js` — CRUD component with validation, modes: inline/block
- `timeline-layout.js` — DOM positioning of pulses/bars/markers, linear & circular modes (App2-5). NOT subdivision math; do not confuse with `timeline-renderer.js` (fractional timeline DOM creation, App4)
- `template.js` — Shared slots, supports `useIntervalMode` flag
- `tap-tempo-handler.js` — Tap tempo with visual feedback, requires 3 taps minimum
- `play-loading.js` — `withPlayButtonLoading(btn, task)` (U-27): estat de càrrega del Play amb llindar anti-parpelleig de 120ms; restaura sempre, també en error
- `info-tooltip.js` — `createInfoTooltip` (App17, App25/25B, App28-34…): tooltip flotant sota un ancoratge; es clampa al viewport perquè no es talli a les vores (p.ex. primera casella d'un editor); auto-hide en scroll/resize, auto-remove opcional
- `transport-live-update.js` — `createLiveTransportPush({apply, isLive})` (A-13): push d'edicions en viu al transport amb debounce trailing de 250ms — cap transitòria de tecleig (bpm=2, totalPulses=1) arriba al worklet

**Utilities:**
- `subdivision.js` — `interval = 60 / bpm`, pulse count calculations
- `number-utils.js` — Consolidated: GCD, LCM, ranges, formatting, random int
- `preferences.js` — Persistent storage with namespace (`prefix::key`), theme sync, factory reset
- `logger.js` — `log` gated per `?dev` o localStorage `nuzic-debug` (H-13); console.warn/error mai hi passen
- `led-manager.js`, `utils.js`, `mixer-menu.js`

**Rhythm & Notation:**
- `pulse-selectability.js` — Pulse 0 and Lg are NOT directly selectable. Epsilon: `1e-6`

**Polirítmia i geometria circular (redisseny App4/App1, 2026-06):**
- `circular-rings.js` (+ `.css`) — `createCircularRings`: anells concèntrics polirítmics (App4). Cercle base (pols) + un anell per fracció; radi ∝ velocitat. State-in/events-out (`render`/`highlightPosition`/`onDotClick`). Helpers purs exportats per als tests (`idealRadius`, `resolveRadii`, `RING_GEOMETRY`, `saturatedAccent`…).
- `circular-timeline-ring.js` — `renderCircularRingNumbers`: posiciona els números del donut circular per trigonometria (App1 en loop + App17). Comparteix el CSS `.timeline.circular` de `shared-ui/nuzic-theme.css`.
- `formula-solver.js` — `createFormulaSolver`: resol Lg/V = T/60 amb el model "els dos últims editats manen" (recència); `touch`/`resolve` (App1).
- `polyrhythm-info.js` — `computePolyrhythmInfo`: cicle gran (mcm dels numeradors reduïts), velocitats V·d/n, pulsos fracc/cicle i proporció polirítmica reduïda incloent el pols (panell ∑ d'App4). Mòdul pur, amb tests.

**Plano grid (App19/20, App32-35):**
- `plano-note-renderer.js` — `renderNoteBars` (barres de nota + silencis), `renderSilenceLines` (línia discontínua als forats entre notes, continuant la fila de l'última nota — estil App15/App25B), `wouldOverlap`/`removeOverlappingNotes` (mode monofònic). `renderNoteBars` accepta `totalColumns` per posicionar HORITZONTALMENT en **% EXACTE** (encaixa amb columnes 1fr sense la deriva de `índex × offsetWidth` arrodonit); el mode px legacy (`cellWidth`) es manté retrocompatible. Vertical sempre en px (cellHeight enter). Les línies/números d'interval estil App15 viuen a `libs/interval-overlay/`.

## MOVED to Sub-Packages (do NOT duplicate)
- pulse-seq → `libs/pulse-seq/`
- notation → `libs/notation/`
- random → `libs/random/`

## Key Constants
- BPM: lib default min 30, max 240, default 100 (les apps 9+ fixen 50-150 per política, 2026-06). DO NOT clamp during typing (allows multi-digit entry), auto-clamp after 1.5s or on blur.
- Circular timeline: hide numbers if Lg >= 100, number offset 44px
- Audio init order — MELODIC apps: (1) load Tone.js, (2) wait user interaction, (3) Tone.start(). RHYTHM apps (A-08): gest → TimelineAudio natiu directe (context propi a 44100; Tone NO es carrega — el playback rítmic és worklet+BufferSource+GainNode i el mixer és només estat)

## Tests
38 suites in `__tests__/`: audio, audio-schedule, audio-toggles, fraction-editor, loop-resize, subdivision, tap-resync, simple-visual-sync, circular-rings, formula-solver, polyrhythm-info, plus dedicated unit tests.
