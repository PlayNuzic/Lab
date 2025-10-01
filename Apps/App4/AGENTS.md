## Propòsit
- Gestionar seleccions múltiples de fraccions rítmiques sobre la timeline
  compartida (edita Lg/V/T i fraccions n/d amb memòria de selecció).
- Combinar editor de fraccions inline, seqüenciador de polsos i randomització
  avançada per generar patrons complexos.

## Flux principal
1. `bindAppRhythmElements('app4')` + `createRhythmLEDManagers` configuren inputs,
   LEDs i helpers. El loop està integrat mitjançant
   `createPulseMemoryLoopController` (reconstrueix seleccions en canviar d'estat).
2. `createSchedulingBridge` + `bindSharedSoundEvents` connecten events `sharedui`.
   `TimelineAudio` es crea amb `createRhythmAudioInitializer` quan cal.
3. `createPreferenceStorage({ prefix: 'app4', separator: ':' })` concentra
   localStorage (tema, mute, color, random i fraccions). `registerFactoryReset`,
   `setupThemeSync` i `setupMutePersistence` gestionen estat global.
4. `createPulseSeqController` munta el `contenteditable` de polsos (markup propi,
   drag, caret). La memòria persistent ve de `pulseMemoryApi`.
5. `fraction-selection.js` defineix `fractionStore`, `fractionMemory` i helpers
   (`registerFractionLabel`, `applyFractionSelectionClasses`,
   `rebuildFractionSelections`, `applyRandomFractionSelection`). Governen com es
   projecten les fraccions sobre la seqüència i el layout.
6. `createFractionEditor({ mode: 'inline' })` ocupa `FRACTION_INLINE_SLOT_ID` i
   sincronitza la UI amb el `fractionStore`. Cada canvi invoca `handleInput` per
   recalcular timeline, cicles i audio.
7. `initRandomMenu` + helpers de `fraction-selection.js` gestionen randomització de
   Lg/V/T, nombre de pulsos i fraccions (amb `allowComplex`).
8. `getMixer()` registra canals `pulse`, `subdivision` i `accent`; `initMixerMenu`
   i `initAudioToggles` sincronitzen toggles locals amb el mixer.

## Estat i emmagatzematge
- `localStorage` gestionat via `preferenceStorage` (`app4:*`): fraccions (`n/d`),
  configuració aleatòria, tema, mute, color de selecció i toggles d'àudio.
- Estructures locals: `fractionStore`, `fractionMemory` (Map), `pulseMemoryApi`,
  `pulses`, `pulseSeqRanges`, `cycleMarkers`, `cycleLabels`, `bars`,
  `pulseHits`, `voiceHighlightHandlers`.
- Flags: `isPlaying`, `loopEnabled`, `circularTimeline`, `isUpdating`,
  `currentAudioResolution`.

## Dependències compartides
- `libs/app-common/` (`audio.js`, `audio-init.js`, `dom.js`, `fraction-editor.js`,
  `fraction-selection` helpers, `led-manager.js`, `loop-control.js`,
  `mixer-menu.js`, `preferences.js`, `pulse-seq.js`, `random-menu.js`,
  `random-config.js`, `subdivision.js`, `timeline-layout.js`, `number.js`).
- `libs/shared-ui/hover.js` per tooltips i `performance-audio-menu` des de
  `index.html`.
- `libs/sound/index.js` per `TimelineAudio`, mixer i subscripcions.

## Tests
No hi ha suite específica. La lògica compartida està coberta per tests a
`libs/app-common/` (pulse-seq, loop-control, fraction-editor, random-config).
Executa `npm test` després de canvis per garantir-ne la integritat.
