## Objectiu
- Centralitzar inicialització, UI i lògica rítmica reutilitzable entre Apps.
- Servir com a capa intermèdia entre la UI i el motor `TimelineAudio`/mixer.
- Proporcionar helpers cohesionats per fomentar noves apps basades en components compartits.

## Mòduls principals
- **Inicialització**: `app-init.js` (bootstrap d'apps amb template + LEDs),
  `audio-init.js` (creació lazy de `TimelineAudio` sense warnings) i
  `app-common/dom.js` (`bindAppRhythmElements`).
- **Audio & control**: `audio.js` (ponts `sharedui:*`), `audio-schedule.js`
  (`computeResyncDelay`), `audio-toggles.js` (mute declaratiu), `loop-control.js`
  (controladors base/rhythm/pulse-memory) i `preferences.js` (persistència, theme
  sync, factory reset).
- **UI avançada**: `fraction-editor.js`, `pulse-seq.js`, `timeline-layout.js`,
  `template.js` (slots compartits) i `styles.css` (tokens comuns).
- **Utilitats**: `subdivision.js`, `number.js`, `range.js`, `utils.js`,
  `random-config.js`, `random-menu.js`, `mixer-menu.js` + `mixer-longpress.js`,
  `led-manager.js`, `events.js`.

Mantén aquestes peces modulars; si detectes lògica duplicada a les apps,
mou-la aquí i dóna-li API clara.

## Tests
- Execució amb `npm test` des de l'arrel.
- Suites actives: `__tests__/` (audio, audio-schedule, audio-toggles,
  fraction-editor, loop-resize, subdivision, tap-resync) + tests unitaris
  dedicats (`audio-init.test.js`, `loop-control.test.js`, `range.test.js`,
  `utils.test.js`).
- L'entorn és `node` amb `jsdom` puntual. Mockeja WebAudio/DOM quan ampliïs APIs.

## Bones pràctiques
- Exporta fàbriques pures; evita estat global compartit fora de `preferences`.
- Documenta noves APIs a l'arxiu (JSDoc) i actualitza els AGENTS d'apps que les
  utilitzin.
- Abans d'introduir nous paràmetres, comprova si els helpers existents (p.ex.
  `createPulseMemoryLoopController`, `mergeRandomConfig`) ja ho resolen.
