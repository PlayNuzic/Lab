# App-Common — Context for Claude

## Role
Middleware layer between UI and TimelineAudio. 49 modules. Everything reusable across apps lives here.

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

**Utilities:**
- `subdivision.js` — `interval = 60 / bpm`, pulse count calculations
- `number-utils.js` — Consolidated: GCD, LCM, ranges, formatting, random int
- `preferences.js` — Persistent storage with namespace (`prefix::key`), theme sync, factory reset
- `logger.js` — `log` gated per `?dev` o localStorage `nuzic-debug` (H-13); console.warn/error mai hi passen
- `led-manager.js`, `utils.js`, `mixer-menu.js`

**Rhythm & Notation:**
- `pulse-selectability.js` — Pulse 0 and Lg are NOT directly selectable. Epsilon: `1e-6`

## MOVED to Sub-Packages (do NOT duplicate)
- pulse-seq → `libs/pulse-seq/`
- notation → `libs/notation/`
- random → `libs/random/`

## Key Constants
- BPM: lib default min 30, max 240, default 100 (les apps 9+ fixen 50-150 per política, 2026-06). DO NOT clamp during typing (allows multi-digit entry), auto-clamp after 1.5s or on blur.
- Circular timeline: hide numbers if Lg >= 100, number offset 44px
- Audio init order — MELODIC apps: (1) load Tone.js, (2) wait user interaction, (3) Tone.start(). RHYTHM apps (A-08): gest → TimelineAudio natiu directe (context propi a 44100; Tone NO es carrega — el playback rítmic és worklet+BufferSource+GainNode i el mixer és només estat)

## Tests
27+ suites in `__tests__/`: audio, audio-schedule, audio-toggles, fraction-editor, loop-resize, subdivision, tap-resync, simple-visual-sync, plus dedicated unit tests.
