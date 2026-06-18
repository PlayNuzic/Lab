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

## Timeline (nuzic) — lineal + circular en loop
- `createCircularTimeline()` (compartit amb App16) renderitza punts (amagats per
  nuzic) + classes `.circular`. Els **números** els gestiona `refreshTimelineNumbers`:
  - **Lineal** (per defecte): `timelineController.updateNumbers()` DESPRÉS del
    render (cal: `circular-timeline.js` el crida DINS de `render()` quan
    `getPulses()` encara és l'array antic → no es generaven; patró d'App16).
    El tema nuzic els pinta com a barra cream amb ticks. Els **endpoints** (pols
    0 i Lg): s'amaga la `.bar` vertical que creava circular-timeline.js i els
    ticks ::before/::after es fan **dobles+gruixuts** (`||`, estil `cycle-end`
    d'App9/11/12/15) — override scoped a `.app1` a `styles.css`. L'**últim pols**
    (Lg) es mostra com a `·` (cycle-end). **Font dels números capat** a Lg=16
    (`computeNumberFontRem(Math.max(lg,16))`): a Lg petit no creix més (els ticks
    no sobresurten); a Lg>16 s'encongeix natural.
- **Polsos que sonen**: SEMPRE Lg (0..Lg-1); el pols final Lg (el `·`) NO sona
  (marca el tancament), igual en lineal i en loop. `playbackTotal = lg` a
  startPlayback/liveTransportPush/scheduleTapResync (abans el lineal usava
  `toPlaybackPulseCount`, que fa Lg+1 → sonava un pols de més).
  - **Circular** (loop ON): donut cream estil App17. Els números els posa el mòdul
    compartit `circular-timeline-ring.js` (`renderCircularRingNumbers`): Lg punts
    (0..Lg-1; el Lg coincideix amb el 0 al cim), via trigonometria. Es crida dins
    d'un rAF perquè guanyi al rAF intern d'`applyCircularLayout`.
- **Donut compartit**: el CSS (`.timeline.circular` etc.) viu a
  `libs/shared-ui/nuzic-theme.css` i la geometria a `circular-timeline-ring.js`,
  reutilitzats per **App17** ("Módulo Temporal - Círculo") i App1. Abans tot
  vivia a `Apps/App17/styles.css`; unificat en aquesta tanda.
- **Highlight de playback**: `visualSync.onStep → highlightStep(step)` pinta el
  `.pulse-number` actiu (els `.pulse` dots els amaga nuzic). Lineal: `.active`
  sobre `data-index=step` (patró App16). Circular: `.active`/`.active-zero` sobre
  el número de l'anell a `step % Lg` (patró App17). `clearTimelineHighlights()`
  neteja en aturar. Es va treure `createSimpleHighlightController` (pintava dots).
- **Botó loop**: nuzic l'amaga per defecte (`.controls .loop { display:none }`);
  App1 el mostra (override a `styles.css`, a la dreta de random, estètica verda).
  El loop "doblega" la línia en cercle. `circularTimeline` (toggle dev) és `true`
  per defecte, així loop ON ⇒ donut.

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
