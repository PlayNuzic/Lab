# App1B: Temporal Formula (original preservada)

> **App1B és la còpia congelada de l'App1 original** (sistema manual/auto amb LEDs
> clicables), conservada mentre l'App1 es redissenya (nuzic + auto-tercer transparent).
> Única diferència funcional amb l'antiga App1: prefix de localStorage `app1b:` (aïllament)
> i `body class="app1b"`. NO s'hi fan canvis de funcionalitat; és la referència.

## Purpose
Visualize the temporal formula (Lg, V, T) and auto-recalculate the third parameter based on manual/auto mode.
Synchronize linear/circular timeline with TimelineAudio and global mixer.
Test lab for randomization and tap resync.

## Flow
1. `bindAppRhythmElements('app1')` → elements, leds, ledHelpers
2. `createSchedulingBridge` + `bindSharedSoundEvents` → handle `sharedui:*` events
3. `createRhythmAudioInitializer` → lazy TimelineAudio
4. `mergeRandomConfig` + `initRandomMenu` → persistent random config in localStorage(`random`)
5. `computeResyncDelay` + `scheduleTapResync` → realign tap tempo using visual state
6. `syncLEDsWithInputs` → coherence between manual/auto inputs and `manualHistory`

## State
- localStorage key `random`: Lg/V/T ranges and random menu toggles
- Local flags: `isPlaying`, `loopEnabled`, `circularTimeline`, `pendingMute`, `tapResyncTimeout`

## Controllers
- `createCircularTimeline()` — circular/linear rendering
- `createSimpleHighlightController()` — pulse highlighting with loop
- `createSimpleVisualSync()` — RAF-based visual sync

## Dependencies
`libs/app-common/` (audio.js, audio-init.js, audio-schedule.js, dom.js, led-manager.js, subdivision.js, utils.js, number-utils.js, visual-sync.js, simple-highlight-controller.js, circular-timeline.js), `libs/random/index.js` (initRandomMenu, mergeRandomConfig), `libs/shared-ui/hover.js`, `libs/sound/index.js`

## Tests
No app-specific tests. Relies on shared module tests. Run `npm test` before committing.
