# App-Common — Context for Claude

## Role
Middleware layer between UI and TimelineAudio. 43 modules. Everything reusable across apps lives here.

## Modules by Function

**Initialization:**
- `app-init.js` — App bootstrap with template + LEDs
- `audio-init.js` — Lazy TimelineAudio creation (suppresses warnings)
- `dom.js` — `bindAppRhythmElements(appId)` central DOM binding

**Audio & Control:**
- `audio.js` — Bridges for `sharedui:*` events
- `audio-schedule.js` — `computeResyncDelay`, downbeat zero-crossing with look-ahead
- `audio-toggles.js` — Declarative mute toggles (format: '1'=enabled, '0'=disabled)
- `loop-control.js` — 3 variants: `createLoopController`, `createRhythmLoopController`, `createPulseMemoryLoopController`
- `visual-sync.js` — Consolidated visual sync (simple + complete), uses RAF at 60fps

**UI:**
- `fraction-editor.js` — CRUD component with validation, modes: inline/block
- `timeline-layout.js` — Subdivision layout calculations
- `template.js` — Shared slots, supports `useIntervalMode` flag
- `tap-tempo-handler.js` — Tap tempo with visual feedback, requires 3 taps minimum

**Utilities:**
- `subdivision.js` — `interval = 60 / bpm`, pulse count calculations
- `number-utils.js` — Consolidated: GCD, LCM, ranges, formatting, random int
- `preferences.js` — Persistent storage with namespace (`prefix::key`), theme sync, factory reset
- `led-manager.js`, `events.js`, `utils.js`, `mixer-menu.js`

**Rhythm & Notation:**
- `rhythm.js` — Note names (Spanish), GCD reduction, permutations (max 512)
- `pulse-selectability.js` — Pulse 0 and Lg are NOT directly selectable. Epsilon: `1e-6`

## MOVED to Sub-Packages (do NOT duplicate)
- pulse-seq → `libs/pulse-seq/`
- notation → `libs/notation/`
- random → `libs/random/`

## Key Constants
- BPM: min 30, max 240, default 100. DO NOT clamp during typing (allows multi-digit entry), auto-clamp after 1.5s or on blur.
- Circular timeline: hide numbers if Lg >= 100, number offset 44px
- Audio init order: (1) load Tone.js, (2) wait user interaction, (3) Tone.start()

## Tests
27+ suites in `__tests__/`: audio, audio-schedule, audio-toggles, fraction-editor, loop-resize, subdivision, tap-resync, simple-visual-sync, plus dedicated unit tests.
