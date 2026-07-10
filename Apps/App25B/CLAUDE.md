# App25B: Melodías con iSº — seqüenciador melòdic per intervals de grau

## Purpose

Compon melodies escrivint **intervals de grau d'escala** (iSº): `+2`, `-1`, `0`,
`+3`, `s` (silenci)… Cada interval ocupa **un pols**. El grau base sempre és **0**
(punt de partida implícit). Es visualitza sobre una **graella musical 2D**
(`musical-grid`): l'eix X són els pols (0–11), l'eix Y són 20 notes (~2 octaves).
Tema nuzic. Bidireccional: l'editor iSº i els clics a la graella editen el MATEIX
estat.

## Model (clau)

- **`TOTAL_PULSES = 13`** (pols 0–12; l'últim és cycle-end visual, no clicable),
  **`TOTAL_SPACES = 12`**, **`TOTAL_NOTES = 20`**, **`BASE_DEGREE = 0`**.
- **Una entrada per pols**: `{ degreeInterval, pulse, isRest }`. La seqüència és
  l'estat canònic; viu a l'editor iSº (`gridEditor`) i es desa a
  `currentDegreeIntervals`.
- **Escala** (pastilla "Escala", `scale-pill`): defineix quins semitons són notes
  vàlides (`getVisualScaleSemitones`) i el mapatge grau↔nota↔MIDI. **Transposición**
  (`output-note-pill`) desplaça l'arrel. Graus que surten de l'escala vigent es
  recorden a `lostDegreesMemory` per restaurar-los en canviar d'escala.

## Conversió de dades (degree ↔ absolut) — CRÍTIC

Dues funcions pures fan de pont entre l'editor (intervals relatius) i la graella
(graus absoluts):

- **`degreeIntervalsToAbsoluteDegrees(intervals)`**: acumula `degreeInterval` des de
  `BASE_DEGREE` → `[{ degree, pulse, isRest }]`. Emet un registre per a CADA entrada
  (silencis inclosos, també els finals).
- **`absoluteDegreesToIntervals(absoluteDegrees)`**: el revés. **Omple SEMPRE des del
  pols 0** fins a `lastPulse` amb silencis als forats. ⚠️ Si comencés a `firstPulse`
  (el primer pols amb nota), els pols previs no es crearien com a silenci i, com que
  `gridEditor.setPairs` reindexa els pols a `0..N`, la primera nota "cauria" al pols 0
  (bug de clic a la graella deixant silencis inicials — vegeu Notes).

## Editor iSº (fila de text)

- Fila pròpia dins `.grid-container` (grid-row 3). Cel·les `<input>`
  (`.interval-editor-cell`): es teclegen intervals `±N`, `0`, o un silenci
  (`s`/`.`/`r`/`·`). El número complet es confirma amb Enter/Tab o auto-jump;
  el silenci es confirma a l'instant. En editar una cel·la existent, es pot
  esborrar tot el contingut i escriure el valor nou. Qualsevol entrada rebutjada
  mostra el motiu amb `createInfoTooltip`.
- `commitInterval` → `notifyChange` (re-indexa, converteix a graus absoluts i crida
  `syncGridFromDegreeIntervals`) → `renderCells`. `gridEditor` exposa
  `getPairs/setPairs/clear` amb el model `{ degreeInterval, pulse, isRest }`.

## Graella (musical-grid) + interacció

- `createMusicalGrid({ notes: 20, pulses: 13,
  showIntervals:{horizontal:true, vertical:false}, onCellClick })`. El darrer pols
  és cycle-end. No hi ha `np-dot`, handles de drag ni etiquetes/halters d'iT.
- **Col·locar un grau**: clic al cos de la cel·la → `handlePlaceAtCell(noteIndex,
  pulse)` → toca la nota (`audio.playNote`) i crida `handleGridCellClick`, que
  recalcula la seqüència i re-sincronitza.
- **`handleGridCellClick`**: llegeix la seqüència de l'editor, hi aplica el clic
  (toggle/replace/afegir), recalcula `newIntervals = absoluteDegreesToIntervals(...)`,
  fa `gridEditor.setPairs(newIntervals)` i **renderitza la graella amb les MATEIXES
  dades** (`syncGridFromDegreeIntervals(degreeIntervalsToAbsoluteDegrees(newIntervals))`).
  ⚠️ Renderitzar amb els `absoluteDegrees` crus (sense els silencis dels forats que
  `absoluteDegreesToIntervals` afegeix) feia que el silenci d'un forat entre notes no
  es dibuixés fins a l'acció següent.

## Visualització d'intervals — IDÈNTICA a App15 (no compartida)

`createDegreeIntervalLine(degree1, degree2, pulse, idx)` dibuixa, al matrix
container, la geometria EXACTA d'App15 (`createIntervalLine`), però el **VALOR del
número és el delta de GRAUS** (no de semitons — el sentit propi d'aquesta app iSº;
no es pot importar la d'App15 perquè etiqueta semitons):

- Línies de divisió `(TOTAL_NOTES - note)/TOTAL_NOTES`; barra de l'extrem destí a
  l'origen, **fletxa** a destí (`.interval-bar-vertical.ascending/descending::before`)
  i **punt** d'origen (`::after`). El primer interval des de l'origen (note1==0)
  s'allarga fins al fons.
- **Interval 0** (uníson): barra curta `.interval-zero` (sense fletxa ni punt) + el
  "0" a sobre.
- **Número**: caixa plena (`.interval-number`) centrada a la barra. ⚠️ El selector
  ha de ser `body.app25b .matrix-container .interval-number` + `!important`: la cadena
  real és `.grid-container > .matrix-container > .interval-number` (no `.musical-grid`);
  si no, el pinten de blau les regles compartides de musical-grid/nuzic-theme.
- **Marge de la graella**: `.timeline-wrapper { padding: 0.6rem; box-sizing: border-
  box }` (com App15) perquè caixes/fletxes/punts no es tallin amb l'`overflow:hidden`.
- `pointer-events: none` a barres i números → els clics passen a la cel·la.

## Silencis a la graella

Un silenci (`isRest`) pinta una **línia discontínua rosa** (`.musical-cell.rest`,
linear-gradient) a la fila de l'última nota (`lastNoteIndex`), continuant-la. La
línia puntejada blava de continuació la dibuixa el propi `musical-grid`
(`intervalColor: #4A9EFF`).

## Random / Àudio / Playback

- `handleRandom`: genera intervals (notes + silencis) directament, `setPairs` i sync.
  `handleReset`: para i buida editor/graella/memòria.
- Àudio **melòdic** (Tone via `createMelodicAudioInitializer`): el primer gest
  carrega Tone i arrenca el context. `handlePlaceAtCell`/playback toquen `playNote`.
  Cursor de playback: `highlightController.highlightPulse` + `.playing` a la cel·la i
  a `.interval-editor-cell[data-pulse]`; `scrollToNoteIfNeeded` si la graella desborda.

## Dependencies

`libs/musical-grid`, `libs/app-common/` (preferences, matrix-highlight-controller,
audio-init, bpm-controller, idle-caret-flash, info-tooltip, output-note-pill,
scale-pill, mixer-menu, audio-toggles), `libs/shared-ui/sound-dropdown`,
`libs/scales/`, `libs/sound/`.

## Notes per a Claude

- **Visualització d'intervals = App15** (línies i números), però
  l'app és **degree-based**: el número és el delta de GRAUS, el commit va per
  `handleGridCellClick` (mai per la maquinària note/iT d'App15).
- **Verificació CDP**: l'editor s'omple injectant `input`+Enter a `.interval-editor-
  cell.active-input`; els clics a la graella es fan amb `Input.dispatchMouseEvent`
  reals (l'àudio Tone arrenca amb el gest de confiança i `handleGridCellClick` corre).
  jsdom no fa layout → les posicions de les línies necessiten Chrome real.
- Bugs resolts en aquesta tanda (2026-06): número d'interval blau→caixa rosa
  (selector), caixes tallades (marge graella), silenci de forat amb lag d'una acció
  (render amb dades de l'editor) i clic deixant silencis inicials movia la nota al
  pols 0 (`absoluteDegreesToIntervals` des del pols 0).
