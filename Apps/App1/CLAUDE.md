# App1: Fórmula Temporal (nuzic)

## Purpose
Visualitza la fórmula temporal **Lg/V = T/60** amb tres camps (Lg, V, T) i en
deriva el tercer automàticament. Tema **nuzic**. Sincronitza la timeline
(lineal; circular en loop) amb TimelineAudio i el mixer global. Banc de proves de
randomització i tap resync.

> L'App1 **original** (sistema manual/auto amb LEDs clicables) es conserva
> congelada a **App1B**. No s'hi fa funcionalitat nova; és la referència.

## Auto-tercer "els dos últims editats manen" (clau)
- Cap sistema manual/auto, cap LED, cap bloqueig: **els tres camps sempre són
  editables**. El mòdul compartit `libs/app-common/formula-solver.js`
  (`createFormulaSolver`, amb tests) recorda quins dos camps has tocat més
  recentment; el tercer (el més antic) es recalcula sol.
  - Exactament 1 camp buit → s'omple aquest ("dos plens → el tercer").
  - 3 plens → es recalcula el derivat per recència; editar el derivat li cedeix
    l'auto al més antic dels altres dos.
- `handleInput` només fa `solver.touch(id)` + `solver.resolve(valors)` i escriu el
  resultat. La resta (àudio, timeline, formula, liveTransportPush) intacta.

## Timeline (nuzic)
- `createCircularTimeline()` (compartit amb App16) renderitza punts + números.
- El tema nuzic **amaga els punts** i mostra **números de pols** (barra cream amb
  ticks). `circular-timeline.js` crida `updateNumbers()` DINS de `render()`, però
  llavors `getPulses()` encara és l'array antic → en mode lineal els números no es
  generaven. App1 (com App16) crida `timelineController.updateNumbers()` DESPRÉS
  del render, amb `pulses` ja fresc. **Mode lineal: OK.**
- **Mode circular (loop): PENDENT.** El donut cream viu a `Apps/App17/styles.css`
  (no compartit) i el posicionament de números de `circular-timeline.js` no
  encaixa amb l'anell (no contra-rota, offset radial). Cal portar l'enfocament
  d'App17 ("Módulo Temporal - Círculo": donut + números per trigonometria).

## Flow
1. `bindAppRhythmElements('app1')` → elements (els LEDs s'eliminen a l'index.html)
2. `createSchedulingBridge` + `bindSharedSoundEvents` → esdeveniments `sharedui:*`
3. `createRhythmAudioInitializer` → TimelineAudio lazy
4. `mergeRandomConfig` + `initRandomMenu` → config random persistent (localStorage `random`)
5. `computeResyncDelay` + `scheduleTapResync` → realinear tap tempo amb l'estat visual

## State
- localStorage `app1:*` (prefix) + clau `random`: rangs Lg/V/T i toggles del menú
- Flags locals: `isPlaying`, `loopEnabled`, `circularTimeline`, `tapResyncTimeout`

## Dependencies
`libs/app-common/` (audio.js, audio-init.js, audio-schedule.js, dom.js,
**formula-solver.js**, random-menu.js, range.js, subdivision.js, utils.js,
number-utils.js, visual-sync.js, simple-highlight-controller.js,
circular-timeline.js), `libs/shared-ui/` (header, hover, nuzic-theme.css),
`libs/sound/index.js`

## Tests
`libs/app-common/__tests__/formula-solver.test.js` (lògica de la fórmula +
recència). La resta via mòduls compartits. `npm test` abans de commitejar.
