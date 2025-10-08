## Propòsit
- Visualitzar la fórmula temporal (Lg, V, T) i recalcular automàticament el tercer
  paràmetre segons el mode manual/auto.
- Sincronitzar el timeline lineal/circular amb `TimelineAudio` i el mixer global.
- Exposar un laboratori ràpid per provar randomització i resynchronització de tap.

## Flux principal
1. `bindAppRhythmElements('app1')` retorna `elements`, `leds` i `ledHelpers` per a
   tots els controls. `createRhythmLEDManagers` governa els LEDs auto/manual.
2. `createSchedulingBridge` + `bindSharedSoundEvents` connecten els events
   `sharedui:*` (mute, so base/accent/start) procedents de la capçalera.
3. `createRhythmAudioInitializer` prepara `TimelineAudio` lazy; `startPlayback`
   i `stopPlayback` en fan ús i sincronitzen loop/mute.
4. `mergeRandomConfig` + `initRandomMenu` gestionen la configuració persistent del
   menú aleatori (`randomDefaults` + `toRange`).
5. `computeResyncDelay` i `scheduleTapResync` reallineen el tap tempo usant
   `audio.getVisualState()` i `toPlaybackPulseCount`.
6. `syncLEDsWithInputs` manté coherència entre inputs manual/auto i lògica de
   `manualHistory` (mantenir dos camps manuals actius).

## Estat i emmagatzematge
- `localStorage` clau `random` desa rangs Lg/V/T i toggles del menú aleatori.
- `manualHistory`, `autoTarget` i `pulses` són estructures locals per evitar
  inconsistències entre UI i càlcul automàtic.
- Flags locals: `isPlaying`, `loopEnabled`, `circularTimeline`, `pendingMute` i
  `tapResyncTimeout`.

## Dependències compartides
- `libs/app-common/` (`audio.js`, `audio-init.js`, `audio-schedule.js`, `dom.js`,
  `led-manager.js`, `random-menu.js`, `range.js`, `subdivision.js`, `utils.js`,
  `number-utils.js`, `simple-visual-sync.js`, `simple-highlight-controller.js`,
  `circular-timeline.js`).
- `libs/shared-ui/hover.js` per tooltips.
- `libs/sound/index.js` indirectament via `createRhythmAudioInitializer`.

## Controllers creats
- **timelineController**: `createCircularTimeline()` - Gestiona rendering timeline circular/linear
- **highlightController**: `createSimpleHighlightController()` - Highlighting de pulsos amb loop
- **visualSync**: `createSimpleVisualSync()` - Sincronització visual amb requestAnimationFrame
- **numberFormatter**: Funcions `parseNum()` i `formatSec()` per parseo/format de números

## Tests
No hi ha suite específica d'App1; confia en les proves dels mòduls compartits.
Abans de fer commit executa `npm test` a l'arrel.
