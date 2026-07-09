# App2: Pulse Sequence Editor

## Purpose
Edit pulse sequences with memory, drag selection, and loop-synced mode.
Visualize linear/circular timeline with time indicator (T).
Integrates popup mixer and theme/selection preferences.

## Flow
1. `bindAppRhythmElements('app2')` (LEDs amagats: `hideLeds: true`, no s'usa `createRhythmLEDManagers`)
2. `createSchedulingBridge` + `bindSharedSoundEvents` → `sharedui:*` events
3. `createRhythmAudioInitializer` → lazy TimelineAudio, `pendingMute` for deferred mute
4. `createPulseSeqController` → contenteditable for pulses (text, caret, selection, memory)
5. `createPulseMemoryLoopController` → syncs loop button with TimelineAudio
6. `initRandomMenu` + `mergeRandomConfig` → Lg/V/T + extra pulse count
7. `initMixerMenu` → channels: pulse/subdivision/master

## State
- localStorage prefix `app2:`: theme, mute, selection color, circular mode, random config
- Local: `isPlaying`, `loopEnabled`, `circularTimeline`, `pendingMute`, `pulseMemory` (Map)

## Dependencies
`libs/app-common/` (audio.js, audio-init.js, dom.js, led-manager.js, loop-control.js, mixer-menu.js, random-menu.js, range.js, subdivision.js, utils.js), `libs/pulse-seq/`, `libs/shared-ui/hover.js`

## Tests
No app-specific suite. Shared tests cover: pulse-seq, loop-resize, subdivision, fraction-notation.
