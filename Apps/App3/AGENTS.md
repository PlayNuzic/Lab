## Propòsit
- Representar fraccions rítmiques (n/d) amb timeline lineal/circular i audio.
- Exercir de banc de proves del `fraction-editor` i de la integració amb mixer,
  preferències i randomització compartida.

## Flux principal
1. `bindAppRhythmElements('app3')` prepara inputs i controls (inclosa la ranura
   per al `fraction-editor`).
2. `createPreferenceStorage({ prefix: 'app3', separator: '::' })` centralitza
   localStorage (`storeKey`, `load`, `save`, `clear`). `registerFactoryReset`
   reinicia l'estat i assegura que els canals d'àudio es desmutegen abans de
   recarregar.
3. `createRhythmAudioInitializer` inicialitza `TimelineAudio` i registra canals
   `pulse`/`cycle` al mixer (`getMixer`, `subscribeMixer`).
4. `createFractionEditor({ mode: 'block', defaults, storage, addRepeatPress })`
   sincronitza inputs n/d amb la UI i truca `handleInput` quan canvien.
5. `initAudioToggles` governa botons Pulse/Cycle (persistents) i els vincula amb
   `initMixerMenu` i el mixer global.
6. `createTimelineRenderer` + `gridFromOrigin` calculen subdivisions i layout
   (cicles, barres, labels) tant per timeline lineal com circular.
7. `initRandomMenu` amb `applyBaseRandomConfig`/`updateBaseRandomConfig` gestiona
   randomització de Lg/V/n/d (`allowComplex`).

## Estat i emmagatzematge
- `localStorage` prefix `app3::`: valors Lg/V, fraccions, random, preferències
  d'àudio (pulse/cycle), tema i configuració del mixer.
- Flags locals: `isPlaying`, `loopEnabled`, `circularTimeline`, `isUpdating`,
  `tIndicatorRevealTimeout`.
- Caches locals: `pulseNumberLabels`, `cycleMarkers`, `cycleLabels`, `bars`,
  `lastStructureSignature`.

## Dependències compartides
- `libs/app-common/` (`audio.js`, `audio-init.js`, `audio-toggles.js`, `dom.js`,
  `fraction-editor.js`, `loop-control.js`, `mixer-menu.js`, `preferences.js`,
  `random-config.js`, `random-menu.js`, `subdivision.js`, `timeline-layout.js`,
  `number.js`).
- `libs/shared-ui/hover.js` per tooltips.
- `libs/sound/index.js` per mixer global.

## Tests
No hi ha suite d'app dedicada. Les funcionalitats clau estan cobertes pels tests
compartits (`fraction-editor`, `audio-toggles`, `subdivision`). Executa `npm test`
per validar-los després de canvis.
