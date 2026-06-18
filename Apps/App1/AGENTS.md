## Propòsit
- Visualitzar la fórmula temporal **Lg/V = T/60** amb tres camps (Lg, V, T) i
  derivar-ne el tercer automàticament. Tema nuzic.
- Sincronitzar la timeline (lineal; circular en loop) amb `TimelineAudio` i el
  mixer global. Laboratori ràpid de randomització i resync de tap.

> Detall complet a `Apps/App1/CLAUDE.md`. L'App1 original (sistema manual/auto amb
> LEDs clicables) es conserva CONGELADA a **App1B** — no es toca.

## Flux principal
1. `bindAppRhythmElements('app1')` retorna `elements` (els LEDs s'han eliminat de
   l'index.html; NO hi ha `createRhythmLEDManagers`). `reorderControls()` munta la
   fila nuzic; el botó **loop** es fa visible (override a styles.css) perquè
   "doblega" la línia en cercle.
2. `createSchedulingBridge` + `bindSharedSoundEvents` connecten els events
   `sharedui:*` (mute, so base/accent/start) de la capçalera.
3. `createRhythmAudioInitializer` prepara `TimelineAudio` lazy; `startPlayback` /
   `stopPlayback` sincronitzen loop/mute. `playbackTotal = lg` (no Lg+1).
4. **Auto-tercer "els dos últims editats manen"**: NO hi ha mode manual/auto ni
   bloquejos — els tres camps sempre són editables. `formula-solver.js`
   (`createFormulaSolver`) recorda els dos camps tocats més recentment i recalcula
   el tercer. `handleInput` només fa `solver.touch(id)` + `solver.resolve(valors)`.
5. `mergeRandomConfig` + `initRandomMenu` gestionen la config persistent del menú
   aleatori (clau `random`). `randomize()` randomitza els 2 conductors marcats i el
   solver deriva el tercer (el primer NO marcat; tots marcats → deriva T). ⚠️
   `preferenceStorage` es declara ABANS del bloc random (si no, TDZ → persistència
   sempre a defaults).
6. `computeResyncDelay` + `scheduleTapResync` reallineen el tap tempo amb
   `audio.getVisualState()`.

## Timeline i highlight
- `createCircularTimeline()` (compartit amb App16) renderitza punts + classes;
  els números els gestiona `refreshTimelineNumbers(isCircular)`:
  - **Lineal**: `timelineController.updateNumbers()` després del render; endpoints
    (0 i Lg) amb ticks dobles+gruixuts (`||`); l'últim pols Lg com a `·`.
  - **Circular** (loop ON): donut cream; els números via
    `circular-timeline-ring.js` (`renderCircularRingNumbers`, trigonometria),
    CSS `.timeline.circular` compartit a `shared-ui/nuzic-theme.css` (App17 + App1).
- **Highlight de playback**: `visualSync.onStep → highlightStep(step)` pinta el
  `.pulse-number` actiu (lineal `.active` sobre `data-index`; circular
  `.active`/`.active-zero` sobre `step % Lg`). NO s'usa
  `simple-highlight-controller` (pintava dots) — substituït per `visual-sync.js`.

## Estat i emmagatzematge
- `localStorage` `app1:*` + clau `random` (rangs Lg/V/T i toggles). Defaults
  Lg [2,16], V [40,200], T [0.1,20].
- Flags locals: `isPlaying`, `loopEnabled`, `circularTimeline`, `tapResyncTimeout`.

## Dependències compartides
- `libs/app-common/` (`audio.js`, `audio-init.js`, `audio-schedule.js`, `dom.js`,
  **`formula-solver.js`**, `random-menu.js`, `range.js`, `subdivision.js`,
  `utils.js`, `number-utils.js`, `visual-sync.js`, `circular-timeline.js`,
  **`circular-timeline-ring.js`**).
- `libs/shared-ui/` (header, hover, nuzic-theme.css), `libs/sound/index.js`.

## Controllers creats
- **timelineController**: `createCircularTimeline()` — render lineal/circular.
- **visualSync**: `createSimpleVisualSync()` — sync visual amb requestAnimationFrame.
- **numberFormatter**: `parseNum()` / `formatSec()` per parseig/format.

## Tests
`libs/app-common/__tests__/formula-solver.test.js` cobreix la lògica de la fórmula
i la recència. La resta via mòduls compartits. `npm test` abans de fer commit.
