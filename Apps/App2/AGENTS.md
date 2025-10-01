## Propòsit
- Editar seqüències de polsos amb memòria, drag i mode loop sincronitzat.
- Visualitzar timeline lineal/circular amb indicadors de temps (`T`).
- Integrar mixer emergent i preferències de tema/selecció.

## Flux principal
1. `bindAppRhythmElements('app2')` + `createRhythmLEDManagers` configuren inputs,
   LEDs i helpers d'estat auto/manual.
2. `createSchedulingBridge` i `bindSharedSoundEvents` reaccionen a events
   `sharedui:*` (mute, canvis de so, perfils de scheduling).
3. `createRhythmAudioInitializer` crea `TimelineAudio` lazy. `pendingMute` assegura
   que els canvis de mute compartits s'apliquen quan l'àudio està llest.
4. `createPulseSeqController` governa el `contenteditable` de pulsos (text, caret,
   selecció, memòria). `pulseMemory` persisteix l'estat entre sessions.
5. `createPulseMemoryLoopController` sincronitza el botó de loop amb `TimelineAudio`
   i reconstrueix la selecció visible quan es canvia l'estat.
6. `initRandomMenu` + `mergeRandomConfig` gestionen Lg/V/T i el comptador de pulsos
   extra. Resultats guardats a `localStorage` (`app2:random`).
7. `initMixerMenu` registra canals `pulse`/`subdivision`/`master` i sincronitza
   toggles locals amb el mixer global.
8. L'indicador `tIndicator` es posiciona amb `fromLgAndTempo` i
   `toPlaybackPulseCount`; es torna a calcular en `resize` i quan canvia Lg/V/T.

## Estat i emmagatzematge
- `localStorage` prefix `app2:`: tema (`theme`), mute (`mute`), color de selecció
  (`color`), mode circular (`circular`) i configuració aleatòria (`random`).
- Estat local: `isPlaying`, `loopEnabled`, `circularTimeline`, `pendingMute`,
  `pulseMemory` (Map), `selectedFromMemory` i configuracions de caret.

## Dependències compartides
- `libs/app-common/` (`audio.js`, `audio-init.js`, `dom.js`, `led-manager.js`,
  `loop-control.js`, `mixer-menu.js`, `random-menu.js`, `range.js`,
  `subdivision.js`, `pulse-seq.js`, `utils.js`).
- `libs/shared-ui/hover.js` (tooltips) i header global.

## Tests
No hi ha suite específica d'App2. Fia't de les proves compartides i executa
`npm test` abans de pujar canvis.
