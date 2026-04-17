# Migració Editor de Seqüències a estètica Nuzic

## Estat

- [x] **app13** — Editor iT implementat i funcionant
- [x] **App12** — Editor N-P implementat (single-column layout, validació, tooltips)
- [x] **App14** — Editor iS-only (soundline vertical, cel·les rosa dinàmiques, interval bars/numbers)
- [x] **App15** — Editor iS-iT zigzag implementat (zigzag offset, cel·les editables, cascade validation)
- [x] **App25** — Editor Nº (graus d'escala) single-row dins `.grid-container` com a grid-row 3
- [x] **App25B** — Editor iSº (intervals de graus) single-row, validació cascade, fletxes ←/→
- [x] **App26** — Timeline standalone amb fila de subdivisions (fraccions 1/d) — primera app del grup fraccions
- [x] **App27** — Fraccions complexes N/D (numerador i denominador editables, lg=numerador)
- [x] **App28** — Pulsos fraccionats simples amb editor Pfr cell-based (App12 P-row pattern)
- [ ] **App29-31** — Pendents (App29 complex, App30-31 variants)
- [ ] **App32-35** — Editors diversos

## Solucions implementades a App12 (referència per futures apps)

### S1: Layout single-column

- Treure `controlsLayout: { mode: 'vertical' }` del `renderApp` config
- Treure `@import two-column-layout.css` i `@import grid-editor.css`
- `.app12-main-grid` passa de CSS Grid 2 columnes a `display: flex; flex-direction: column`
- Controls moguts de `.timeline-wrapper` a `.app12-main-grid` via JS
- Seccions `.inputs` i `.middle` eliminades del DOM (salvar `bpmParam` ABANS)

### S2: Editor N-P alineat amb grid 2D

- `.np-editor` com `grid-row: 3; grid-column: 1 / -1` dins `.grid-container`
- `.editor-bar` usa `display: grid; grid-template-columns: 60px 1fr` (coincideix amb `.grid-container`)
- Label (N/P) ocupa 60px (= soundline), cel·les s'alineen amb matriu
- Cel·les amb `width: 6.25%` (2 per pols) + `aspect-ratio: 1` (quadrades)

### S3: Ordre d'entrada N-P

- Per cada parell: `[blanc:valor][color separador]` (valor PRIMER)
- Caret alterna N→P→N→P (cross-column) via `lastEnteredType`
- Ambdós inputs (N i P) editables des del principi
- Delay 300ms per N de 2 dígits (ex: "11")
- `commitPair()` quan N i P estan complerts

### S4: Validació i tooltips

- N: 0-11, cancel·lar timer + esborrar valor si fora de rang
- P: 0-7, no duplicats (tooltip "Pulso ya usado" + esborrar valor)
- Auto-sort per P creixent amb tooltip "Reordenado por pulso"
- P=7 auto-blur (no saltar al pròxim parell)
- Tooltip CSS: `position: fixed`, `font-size: 1rem`, vermell per errors

### S5: Controls compactes

- Reordering JS: `while(controls.firstChild) controls.removeChild(...)` + appendChild en ordre
- Ordre: Play(48px) → BPM → Random(36px) → Reset(36px)
- Nuzic-theme `body[data-visual="nuzic"] .controls:not([data-layout])` gestiona el flex row

### S6: Grid 2D expandida

- Treure `max-height`, `max-width` del `.grid-container`
- `flex: 1` per omplir tot l'espai disponible
- `grid-template-rows: 1fr 50px auto !important` (matriu + timeline + editor)

## Problemes resolts (originalment pendents)

### P1: Posicionament de l'editor

L'editor ha d'estar **a sota de la grid 2D**, NO superposat ni centrat.
Ha d'estar **alineat a l'esquerra** amb el principi de la graella 2D.

Això implica:
- L'editor s'insereix dins el contenidor de la grid (`.app12-main-grid`)
- NO dins `.timeline-wrapper` (que té `max-width: 700px` centrat)
- Ha d'ocupar la mateixa columna que la grid 2D (columna 2 del layout grid)
- L'amplada ha de coincidir amb la de la matriu (`.matrix-container`)

Estructura DOM desitjada:
```
.app12-main-grid (CSS grid)
  ├── #gridEditorContainer (fila 1, columnes 1-2) → ELIMINAR
  ├── .app12-controls-container (fila 2, columna 1)
  ├── .grid-container (fila 2, columna 2) → musical-grid
  │     ├── .soundline-wrapper
  │     ├── .matrix-container
  │     └── .timeline-wrapper
  │           ├── .timeline
  │           └── .np-editor ← AQUÍ, dins timeline-wrapper, DESPRÉS de timeline
  │                 ├── .editor-bar--n (fila N rosa)
  │                 └── .editor-bar--p (fila P crema)
```

Alternativa: l'editor com a fila 3 del grid principal:
```
.app12-main-grid (CSS grid: 3 files)
  ├── .app12-controls-container (fila 1-2, columna 1)
  ├── .grid-container (fila 1, columna 2) → musical-grid (sense timeline)
  └── .np-editor (fila 2, columna 2) → N + P + timeline integrada
```

**Decisió pendent**: quina estructura és millor?

### P2: Ordre d'entrada N-P vs iT

| | iT (app13) | N-P (App12) |
|---|---|---|
| Primera cel·la | Crema (extensió P0) | **Blanc editable** (N del primer parell) |
| Direcció | Seqüencial (un valor rere l'altre) | **Columna** (N primer, P després) |
| Extensions | Sí (iT-1 cel·les crema) | **No** (cada N i P ocupa 1 cel·la) |
| Fons per defecte | Crema | Rosa (N) / Crema (P) |

Per N-P l'estructura per parell és:
```
Columna k:  [blanc:N_k] [rosa]     ← fila N
            [blanc:P_k] [crema]    ← fila P
```

El blanc va PRIMER (valor editable) i el color va DESPRÉS (separador).
Excepció: quan la seqüència està plena, no hi ha blanc extra.

Flux d'entrada:
```
Inici:      [N] [blanc_N] [rosa] [fons...]    ← cursor a N
            [P] [blanc_P] [crema][fons...]

Entra N=4:  [N] [blanc:4] [rosa] [blanc_N] [rosa] [fons...]  ← cursor salta a P
            [P] [blanc_P] [crema][         ][     ][fons...]

Entra P=0:  [N] [blanc:4] [rosa] [blanc_N] [rosa] [fons...]  ← cursor salta a N del pròxim parell
            [P] [blanc:0] [crema][blanc_P] [crema][fons...]

Entra N=3:  [N] [blanc:4] [rosa] [blanc:3] [rosa] [blanc_N] [rosa] [fons...]
            [P] [blanc:0] [crema][blanc_P] [crema][         ][     ][fons...]  ← cursor a P
```

### P3: Regles d'entrada i validació (per app)

Cada app té regles específiques que cal migrar del grid-editor antic al nuzic editor.
Aquestes regles afecten: validació, tooltips, comportament del caret.

#### App12 (N-P)
- **N**: 0-11 (nota MIDI dins registre)
- **P**: 0-7 (pols dins el compàs)
- **Reordenar per P creixent** automàticament
- **No duplicar polsos** (en mode monofònic)
- **Tooltip**: mostrar error si P duplicat, N fora de rang, etc.

#### App13 (iT)
- **iT**: 1-8
- **Suma**: no excedir Lg (8)
- **Tooltip**: "iT debe ser ≥ 1", "iT máximo: N", "Longitud completa"

#### App14 (iS + iT)
- **iS**: interval melòdic (pot ser negatiu)
- **iT**: 1-8, mateixa regla que app13
- **Relació**: iS i iT estan aparellats

#### App15 (N-P amb intervals)
- Igual que App12 + càlcul automàtic d'intervals

#### App26-31 (Fraccions)
- Entrada de fraccions (numerador/denominador)
- Regles de simplificació

### P4: Tooltips i feedback visual

El sistema de tooltips existent (`showTooltip/hideTooltip`) s'ha de mantenir.
Regles per implementar:
- Mostrar tooltip d'error al costat de la cel·la activa
- Desaparèixer automàticament (timeout)
- Colors: vermell per error, blau per info, verd per èxit

### P5: Comportament del caret (focus)

| Acció | Resultat |
|-------|----------|
| Entra N | Focus salta a P (mateixa columna) |
| Entra P | Focus salta a N (pròxima columna) |
| Backspace en P buit | Torna a N (mateixa columna) |
| Backspace en N buit | Esborra últim parell, focus a N anterior |
| Tab | Avança al pròxim camp buit |
| Shift+Tab | Retrocedeix |
| Click en cel·la amb valor | Seleccionar per editar |
| Seqüència plena | Treure focus, mostrar tooltip "Longitud completa" |

## Aprenentatges clau (de la implementació d'app13)

### 1. Cel·les dinàmiques, NO fixes

L'editor NO crea totes les cel·les al principi. Les cel·les es creen i destrueixen dinàmicament amb `renderEditorCells()` cada cop que l'usuari entra un valor.

### 2. Patró de cel·les: valor PRIMER, extensions DESPRÉS

Per cada interval iT=N:
```
[blanc: N] [crema] [crema] ... (N-1 cremes d'extensió)
```

Sempre comença amb un **quadrat crema P0** fix (representa la columna del pols 0).

Exemple amb iT = [2, 1, 3, 2]:
```
[iT] [crema P0] [blanc:2] [crema] [blanc:1] [blanc:3] [crema] [crema] [blanc:2] [crema] [●]
```

### 3. Placeholder trick per cream/white

- Cel·la crema: `<input placeholder=" " readOnly>` → `:placeholder-shown` → fons crema
- Cel·la amb valor: `<input value="2" placeholder=" " readOnly>` → `:not(:placeholder-shown)` → fons blanc
- Input actiu: `<input>` sense placeholder ni value, `readOnly=false` → classe `.it-input` → fons blanc, cursor actiu

### 4. Amplada fixa per cel·la (NO flex)

Les cel·les tenen `width: var(--it-block, 35px)` i `min-width` fix. NO usen `flex: 1`.
El contenidor `.it-cells` usa `display: flex; justify-content: flex-start`.
El fons `background: var(--nuzic-light)` del contenidor omple l'espai restant.

### 5. Label fora del flux

El label (iT, Nm, Psg...) està posicionat **absolutament** dins el padding esquerre del contenidor:
```css
.it-label {
  position: absolute;
  left: calc(20px - var(--it-block) - 4px);  /* dins el padding */
}
```
Així les cel·les comencen alineades amb el pols 0 de la timeline.

### 6. Marcador de fi

Quadrat negre (`--nuzic-dark`) amb punt blanc. Sempre present al DOM, `display: none` fins que la seqüència és plena.

### 7. Auto-focus

Després de cada entrada, `setTimeout(() => input.focus(), 30)` mou el cursor al nou input blanc.

### 8. SVG no necessari

Les línies daurades decoratives (SVG overlay de nuzic_app) NO són necessàries pel Lab. Les cel·les crema/blanc donen prou informació visual.

### 9. Backspace per esborrar

`handleCellKeydown` amb Backspace fa `currentIntervals.pop()` i re-renderitza.

## Estructura CSS final (app13 model)

```css
.it-editor-bar {
  position: relative;
  max-width: 700px;       /* = timeline-wrapper */
  padding: 0 20px;        /* = timeline-wrapper */
  --it-block: 35px;
}

.it-label {
  position: absolute;
  left: calc(20px - var(--it-block) - 4px);
  width: var(--it-block);
  height: var(--it-block);
  background: var(--nuzic-yellow);  /* daurat per iT, rosa per N, etc. */
}

.it-cells {
  display: flex;
  justify-content: flex-start;
  height: var(--it-block);
  background: var(--nuzic-light);   /* fons crema fins al final */
}

.it-cell {
  width: var(--it-block);
  min-width: var(--it-block);
  height: 100%;
  border-width: 0;
  border-radius: 0;
}

.it-cell:placeholder-shown { background: var(--nuzic-yellow-light); }
.it-cell:not(:placeholder-shown) { background: white; z-index: 1; }
.it-cell.it-input { background: white; cursor: text; }  /* input actiu */
.it-cell.it-end { box-shadow: inset -2px 0 0 0 white; } /* separador */

.it-end-marker {
  width: var(--it-block);
  background: var(--nuzic-dark);
}
```

## Estructura JS final (renderEditorCells)

```javascript
function renderEditorCells() {
  // 1. Netejar totes les cel·les existents
  container.querySelectorAll('.it-cell').forEach(c => c.remove());

  // 2. Crear crema P0 (sempre present)
  insertCell({ cream: true });

  // 3. Per cada interval entrat: valor + extensions
  for (const iT of intervals) {
    insertCell({ value: iT });           // blanc amb número
    for (let j = 0; j < iT - 1; j++)
      insertCell({ cream: true });       // crema extensió
  }

  // 4. Si seqüència no plena: input blanc + crema
  if (sum < Lg) {
    insertInput();                        // blanc editable amb auto-focus
    insertCell({ cream: true });          // crema extensió
  }

  // 5. Mostrar/amagar marcador fi
  endMarker.style.display = sum >= Lg ? 'flex' : 'none';
}
```

## Controls compactes (compartit via nuzic-theme.css)

El layout de controls és ara compartit a `libs/shared-ui/nuzic-theme.css`.

### CSS (automàtic per totes les apps sense `data-layout`)

El selector `body[data-visual="nuzic"] .controls:not([data-layout])` aplica:
- Flex row, `gap: 8px`, centrat
- Tots els botons `position: static`
- Play: 48px, Random/Reset: 36px
- Loop i Tap amagats
- `.inputs:has(.bpm-inline)` amagat (BPM mogut dins `.controls`)

### JS (cal afegir a cada app)

Codi per moure BPM dins controls i reordenar:

```javascript
// Reorder controls: Play, BPM, Random, Reset
const bpmParam = document.getElementById('bpmParam');
const controls = document.querySelector('.controls');
if (controls) {
  const playBtn = controls.querySelector('.play') || document.getElementById('playBtn');
  const randomBtnEl = controls.querySelector('.random');
  const resetBtnEl = controls.querySelector('.reset');
  const randomMenu = controls.querySelector('.random-menu');

  while (controls.firstChild) controls.removeChild(controls.firstChild);

  if (playBtn) controls.appendChild(playBtn);
  if (bpmParam) controls.appendChild(bpmParam);
  if (randomBtnEl) controls.appendChild(randomBtnEl);
  if (randomMenu) controls.appendChild(randomMenu);
  if (resetBtnEl) controls.appendChild(resetBtnEl);
}
```

### Apps que ho necessiten

| App | Té BPM? | Té Random? | Necessita JS reorder? |
|-----|---------|------------|----------------------|
| app9 | Sí | No | Sí (Play + BPM) |
| app10 | No | No | No |
| app13 | Sí | Sí | Sí (implementat) |
| App14 | Sí | Sí | Sí |
| App16-18 | Sí | Varis | Revisar |
| App21-24 | No/Sí | Varis | Revisar |
| App26-31 | Sí | Sí | Sí |

### Neteja CSS per app

Les apps que tenien CSS legacy de controls (transforms, position absolute, offsets)
cal netejar-lo perquè no xoqui amb el nuzic-theme compartit. Patró:
- Treure qualsevol `.controls { transform: ... }` de l'app
- Treure `order: -1` o similar als botons
- Treure variables legacy (`--controls-offset-x`, `--controls-scale`, etc.)
- Mantenir només el bloc `body[data-visual="nuzic"] { --nuzic-controls-offset-x/y }`

## Solucions implementades a App15 (referència per iS-iT zigzag)

### S7: Editor iS-iT zigzag (substitueix createGridEditor mode 'interval')

L'editor iS-iT crea dues files (iS rosa, iT crema) amb un patró zigzag
on els valors iT estan desplaçats 1 cel·la a la dreta respecte als iS.

Origen del patró: `nuzic_app/App/RE_General.js` — les files iS usen
`index_columns[index]` i la fila iT usa `index_columns[index]+1`.

#### Mida de cel·les: 2 per espai de pols

```css
.editor-cell { width: 5%; aspect-ratio: 1; }  /* quadrada */
```

Cada interval de iT=N ocupa `2*N` cel·les en ambdues files.

#### Patró zigzag

Per cada interval confirmat (iT=N):
- **Fila iS**: `[valor blanc][ext rosa × (2*N - 1)]` — valor a posició 0
- **Fila iT**: `[ext crema][valor blanc][ext crema × (2*N - 2)]` — valor a posició 1

Per cel·les d'input (nou interval):
- **Fila iS**: `[input blanc][ext rosa]` — input a l'esquerra
- **Fila iT**: `[ext crema][input blanc]` — input a la dreta → ZIGZAG

**Sense P0** — iS0 comença al pols 0 (presuposa nota base N=0).

#### Cel·les editables (no readonly)

Les cel·les amb valor NO són readonly. Al fer focus: selecciona text.
Al fer blur: valida, actualitza interval, re-renderitza, sync grid.

Per iS: **validació en cascada** — verifica que TOTS els intervals posteriors
mantinguin la nota dins [0,11]:
```javascript
iv.soundInterval = num;
let note = 0, valid = true;
for (const interval of currentIntervals) {
  if (!interval.isRest) note += interval.soundInterval || 0;
  if (note < 0 || note > 11) { valid = false; break; }
}
if (!valid) { iv.soundInterval = oldIS; revert(); }
```

Per iT: verifica rang 1-8 i que la suma total no superi TOTAL_SPACES.

#### Comportament del caret

| Acció | Resultat |
|-------|----------|
| Entra iS | Timer 300ms → focus salta a iT (zigzag abaix-dreta) |
| Entra iT | Commit interval, re-render, focus a pròxim iS |
| Input invàlid | `clearTimeout(autoJumpTimer)` + clear pending + esborrar valor + quedar-se |
| Backspace en buit (iT) | Torna a iS |
| Backspace en buit (iS) | Esborra últim interval |
| Click cel·la amb valor | Selecciona per editar |

#### Imports necessaris

```javascript
import { intervalsToPairs } from '../../libs/matrix-seq/index.js';
import { pairsToIntervals, fillGapsWithSilences } from '../../libs/interval-sequencer/index.js';
```

#### API compatible amb gridEditor antic

```javascript
gridEditor = {
  getPairs: () => intervalsToPairs(basePair, currentIntervals).slice(1),
  setPairs: (pairs) => {
    currentIntervals = pairsToIntervals(pairs, basePair);
    renderEditorCells();
  },
  clear: () => { currentIntervals = []; currentPairs = []; renderEditorCells(); },
  clearHighlights: () => {},  // No-op OBLIGATORI (matrix-highlight-controller el crida)
  destroy: () => editorEl.remove()
};
```

### S8: Drag preview alineat

El drag preview de cel·les a la grid 2D (App15) tenia dos bugs:
- `bottom: -50%` → canviar a `top: 0` (igual que el fix de `.active::before`)
- Color `--select-color` (groc) → canviar a `--nuzic-blue-light` (blau)

### S9: stopPlayback simplificat

El patró correcte per mostrar l'últim highlight:
```javascript
// onComplete callback:
() => {
  const lastNoteDelay = intervalSec * 0.9 * 1000;
  setTimeout(() => stopPlayback(), lastNoteDelay);  // delay TOTA la funció
}

// stopPlayback sense delay intern:
function stopPlayback() {
  isPlaying = false;
  audio?.stop();
  highlightController?.clearHighlights();
  // reset icons, clear .playing cells...
}
```

**MAI** fer `stopPlayback(delayMs)` amb delay intern parcial — la neteja visual
s'ha de retardar TOTA junta per veure l'últim highlight.

## Solucions implementades a App14 (referència per soundline vertical)

### S10: Controls generats dins `.timeline-wrapper` pel template

`template.js` (línia 291) genera `.controls` **dins** `.timeline-wrapper`, NO dins `.middle`.
L'extracció de controls de `.middle` és innecessària i crea confusió (controls duplicats).

**Patró correcte**: simplement reordenar els fills del wrapper:
```javascript
document.querySelector('.middle')?.remove(); // netejar .middle
// controls JA estan dins timelineWrapper — només reordenar
const controls = timelineWrapper.querySelector('.controls');
timelineWrapper.appendChild(controls); // mou al final (després de l'editor)
```

### S11: `nuzic-theme.css` `top: 20% !important` en `.interval-number`

La regla `body[data-visual="nuzic"] .timeline .interval-number { top: 20% !important }`
(línia 556 de nuzic-theme.css) està pensada per timelines horitzontals (app9/13).

En apps amb soundline VERTICAL (App14) on els interval-numbers es posicionen
dinàmicament via JS, aquest `!important` sobreescriu els inline styles.

**Fix**: override a l'app's CSS amb especificitat igual o superior:
```css
body[data-visual="nuzic"] .timeline .interval-number {
  top: auto !important;
}
```

### S12: Editor iS-only (App14)

App14 té un editor iS d'una sola fila (rosa) amb patró `[rosa][valor][rosa]` per cada interval.
Diferències clau vs App15:
- **1 fila** (iS, sense iT ni zigzag)
- **Intervals fixos** (màxim 4, sense extensions temporals)
- **Sense grid 2D** ni timeline de polsos
- **Soundline vertical** amb barres d'interval animades

L'editor va DINS `.soundline-area` (entre `.timeline` i `.controls`):
```
.soundline-area (flex column, flex: 1)
  ├── .timeline (flex: 1, conté soundline)
  ├── .is-editor-bar (flex-shrink: 0)
  └── .controls (flex-shrink: 0)
```

## Solucions implementades a App16 (referència per apps amb params extra)

### S13: Params extra dins `.inputs` (Compás, etc.)

Quan una app té paràmetres propis (a més del BPM), el BPM es mou als controls
i els params queden a `.inputs` amb estil pastilla nuzic:

- **BPM** → dins `.controls` (Play | BPM | Random | Reset)
- **Params extra** → dins `.inputs` amb estil `.bpm-inline` (pastilla amb border-radius)

El nuzic-theme NO amaga `.inputs` si conté `.param`:
```css
body[data-visual="nuzic"] .inputs:has(.bpm-inline):not(:has(.param)) {
  display: none;
}
```

### S14: Estil pastilla per params

Tots els params d'entrada (Compás, cycle counter, etc.) han d'usar la classe
`bpm-inline visible` per heretar l'estil pastilla nuzic automàticament.

Afegir al HTML del param:
```html
<div class="bpm-inline visible param compas" id="compasParam">
```

CSS necessari per l'app (els spinners no hereten el daurat automàticament):
```css
/* 1/3 més gran que el BPM */
.param.compas.bpm-inline {
  transform: scale(1.33);
  transform-origin: center;
}

/* Spinners daurats circulars */
.param.compas .spin {
  background: var(--nuzic-yellow) !important;
  border-radius: 50% !important;
  aspect-ratio: 1 !important;  /* quadrat → cercle perfecte a qualsevol escala */
}
.param.compas .spin.up::before {
  border-bottom-color: white !important;
}
.param.compas .spin.down::before {
  border-top-color: white !important;
}
```

**IMPORTANT**: `aspect-ratio: 1` és necessari perquè `border-radius: 50%` faci
cercles perfectes. Sense `aspect-ratio`, els spinners escalats es tornen el·líptics.

## Solucions implementades a App16 (referència per standalone timelines amb highlight)

### S15: Highlight nuzic a `.pulse-number` (no `.pulse` dots)

El nuzic-theme amaga els `.pulse` dots (`display: none !important`). Apps que usaven
dots per highlighting (App16, App17) han de canviar a `.pulse-number` elements:

**JS**: canviar `pulses[step].classList.add('active')` per:
```javascript
const numberEl = timeline.querySelector(`.pulse-number[data-index="${step}"]`);
if (numberEl) numberEl.classList.add('active');
```

**CSS**: estil barra daurada (com `.pulse-marker.highlighted` a grid apps):
```css
.timeline .pulse-number.active {
  background: var(--nuzic-yellow, #FFBB33);
  border-radius: 2px;
  padding: 0.1rem 0.3rem;
  color: var(--nuzic-dark) !important;
}
.timeline .pulse-number.active::before,
.timeline .pulse-number.active::after {
  background: var(--nuzic-yellow) !important;
  opacity: 1 !important;
}
```

**MAI** fer `display: block !important` als `.pulse` dots — són artefactes visuals legacy
(cercles negres/blaus) que interfereixen amb el tema nuzic.

### S16: Eliminar `@import pulse-highlight.css`

El fitxer `libs/shared-ui/pulse-highlight.css` defineix estils legacy per `.pulse.active`,
`.pulse.active-zero`, `.pulse-number.active` (blau) i `.pulse-number.active-zero` (daurat)
que **conflicten** amb el highlight nuzic:
- Doble highlight (daurat nuzic + blau/daurat legacy)
- Dots visibles malgrat estar ocults pel nuzic-theme
- Escala/transformacions no desitjades als números

**Acció**: treure `@import '../../libs/shared-ui/pulse-highlight.css'` de l'app migrada.
El highlight nuzic a `.pulse-number.active` (S15) el substitueix completament.

## Solucions implementades a App9 (referència per interval-row a standalone timelines)

### S17: Interval Row (fila d'intervals sota la timeline)

Les apps amb timeline standalone (app9, app13) mostren els intervals entre polsos
en una fila dedicada SOTA la timeline. No és un editor — és visualització.

#### Estructura
- 8 cel·les `flex: 1` iguals dins un div amb vora daurada
- Línies divisòries daurades (`border-right: 2px solid nuzic-yellow`)
- Fons blanc (no crema), highlight daurat amb text blanc

#### Alineació amb timeline (CRÍTIC)
**Usar JS `ResizeObserver`** per sincronitzar amplada I posició esquerra:
```javascript
const syncRowWidth = () => {
  intervalRow.style.width = `${timeline.offsetWidth}px`;
  intervalRow.style.marginLeft = `${timeline.offsetLeft}px`;
};
syncRowWidth();
new ResizeObserver(syncRowWidth).observe(timeline);
```

**MAI** usar marges CSS fixos per alinear — mesurar la posició real de `.timeline`.

#### Highlight durant playback
```javascript
wrapper.querySelectorAll('.interval-cell.active').forEach(n => n.classList.remove('active'));
const cell = wrapper.querySelector(`.interval-cell[data-index="${step + 1}"]`);
if (cell) cell.classList.add('active');
```

### S18: Eliminar timeline-intervals.js imports obsolets

Amb la nova interval-row, les funcions de `timeline-intervals.js` ja no calen:
- `createIntervalBars` — substituïda per div cells
- `highlightIntervalBar` → `.interval-cell.active`
- `clearIntervalHighlights` → `querySelectorAll('.active').forEach(remove)`
- `layoutHorizontalIntervalBars` — no cal posicionament absolut
- `applyTimelineStyles` — no cal configuració de posicions

## Regles CSS per apps nuzic (aplicable a totes)

### R1: Sense orientation warnings

NO incloure `@media (orientation: portrait)` ni `@media (orientation: landscape)` amb
`body::before` overlays. Aquests warnings amb `z-index: 9999` bloquegen l'app completament
dins iframes. El Sistema Interactivo gestiona el responsive (single-column en mòbil).

Eliminats de: app11, App11A, App12, App15, App19, App20, App25, App25B.

### R2: Sense breakpoints de dimensions de soundline/timeline

Les soundlines i timelines usen rem — escalen naturalment. NO afegir breakpoints que
redimensionin soundline width, note-highlight width, o interval-number font-size.
Codi obsolet de l'era px.

Eliminats de: app10, App14.

### R3: Màxim 1 breakpoint per app

Si cal, usar UN sol `@media (max-width: 700px)` per ajustar font-sizes o padding.
Amb unitats relatives (rem, %), els elements escalen sols — no calen múltiples breakpoints.

Exemple (App12):
```css
@media (max-width: 700px) {
  .app12-main-grid { padding: 0.25rem; }
}
```

### R4: `width: auto !important` per standalone timelines

Les apps amb `.timeline-wrapper` standalone (app9, app13) necessiten sobreescriure
la base `width: 100%` de `timeline-intervals.css` si usen marges:
```css
.timeline-wrapper {
  width: auto !important;
  margin: 1rem 1.25rem 0 3.75rem;  /* left: label, right: pulse 8 */
  padding: 0 !important;
}
```

## Solucions implementades a App26 (referència per fraction apps — App27-31)

### S19: Fila de subdivisions sota la timeline standalone

Les apps de fraccions mostren un marcador de subdivisió (1/d, 1/3, 2/5, etc.) amb
ticks petits i labels `.1 .2 ...` sota la timeline principal. Patró inspirat al
Nuzic Main — sota (no sobre) els pulse-numbers.

#### DOM generat per JS (dins `.timeline`)

```javascript
// Label "1/N" ancorat a l'esquerra (una sola vegada per render)
const subdivisionLabel = document.createElement('div');
subdivisionLabel.className = 'subdivision-label';
subdivisionLabel.textContent = `${numerator}/${denominator}`;
timeline.appendChild(subdivisionLabel);

// Ticks + ".1 .2" per cada subdivisió fraccionària
const grid = gridFromOrigin({ lg, numerator, denominator });
grid.subdivisions.forEach(({ cycleIndex, subdivisionIndex, position }) => {
  // CRÍTIC: saltar subdivisionIndex === 0 — ja marcat pel pulse-number::before del nuzic-theme
  if (subdivisionIndex === 0) return;

  const marker = document.createElement('div');
  marker.className = 'cycle-marker';
  marker.dataset.position = String(position);
  timeline.appendChild(marker);

  const label = document.createElement('div');
  label.className = 'cycle-label';
  label.dataset.position = String(position);
  label.textContent = `.${subdivisionIndex}`;
  timeline.appendChild(label);
});
```

#### layoutTimeline simplificat (només `left: %`)

Posicionament vertical **estàtic a CSS**; només el `left: %` és dinàmic:

```javascript
function layoutTimeline() {
  pulses.forEach((num) => {
    const idx = parseInt(num.dataset.index, 10);
    num.style.left = (idx / lg) * 100 + '%';
  });
  cycleMarkers.forEach((marker) => {
    const pos = parseFloat(marker.dataset.position);
    marker.style.left = (pos / lg) * 100 + '%';
  });
  cycleLabels.forEach((label) => {
    const pos = parseFloat(label.dataset.position);
    label.style.left = (pos / lg) * 100 + '%';
  });
}
```

#### CSS: posicions fixes + mida x2 respecte al clamp habitual

```css
.timeline .cycle-marker {
  position: absolute;
  top: 2.95rem;       /* sota els pulse-number bottom ticks del nuzic-theme */
  width: 2px;
  height: 0.5rem;
  background: var(--nuzic-dark);
  opacity: 0.55;
  transform: translateX(-50%);
}

.timeline .cycle-marker.active {
  opacity: 1;
  background: var(--nuzic-yellow);
  box-shadow: 0 0 6px var(--nuzic-yellow);
}

.timeline .cycle-label {
  position: absolute;
  top: 3.8rem;                           /* sota el marker */
  font-size: clamp(0.95rem, 2vw, 1rem);  /* doble del standard nuzic small */
  opacity: 0.55;
  transform: translateX(-50%);
}

.timeline .subdivision-label {
  position: absolute;
  right: calc(100% + 0.5rem);            /* fora del timeline, a l'esquerra */
  top: 3.8rem;                           /* MATEIXA línia que .cycle-label */
  font-size: clamp(1.1rem, 2vw, 1.5rem);
  font-weight: 700;
}

/* Els cycle-labels a índex sencer coincideixen amb els pulse-numbers — amagar */
.timeline .cycle-label--integer { display: none; }
```

#### Regles clau

- **`subdivisionIndex === 0` es SALTA al JS** — aquestes posicions ja tenen el tick
  del `pulse-number::before` del nuzic-theme. Afegir-n'hi un de propi crea doble tick.
- **Vertical en CSS, no inline** — `top` és estàtic per classe, només el `left: %`
  canvia per cada element. Evita treball innecessari al render.
- **`subdivision-label` i `cycle-label` en la mateixa línia** (`top: 3.8rem`), una sola
  línia visual coherent: `1/N  .1  .2  .1  .2  ...`.
- **Mida del text doble del clamp standard "Small text"** (0.55/1vw/0.75 → 1.1/2vw/1.5
  pel subdivision-label; cycle-label ajustat a 0.95/2vw/1 a mà per l'usuari segons
  proporció visual amb els pulse-numbers).

### S20: Dead code típic en fraction apps migrades

Durant la migració de timeline-apps amb subdivision-row, buscar i eliminar:

- **`bars = []`** — array legacy dels endpoint bars verticals (el timeline del nuzic-theme
  ja té els caps extes via box-shadow)
- **`pulseNumberLabels`** — sovint és duplicat exacte de `pulses` (mateix loop fa push a
  les dues). Eliminar i usar `pulses` directament a `layoutTimeline`
- **`timelineWrapper` const** — orfe del hack `timeline-wrapper--bpm-left` (si s'ha tret)
- **`computeSubdivisionFontRem` import** — ja no es crida si la mida del `.cycle-label`
  viu a CSS amb `clamp()`

## Solucions implementades a App28 (referència per fraction-pulse apps — App29-31)

App28 afegeix al patró d'App26/27 un **editor Pfr cell-based** (App12 P-row
mechanics, App13 aesthetic) per seleccionar pulsos fraccionats.

### S21: Editor Pfr cell-based

**Estructura DOM** (creada amb `createPfrLayout` + `renderPfrEditor`):

```html
<div class="pfr-row">
  <div class="pfr-editor">
    <div class="editor-label editor-label--p">Pfr</div>
    <div class="editor-cells">
      <input class="editor-cell editor-cell--p" value="0" readonly /> <!-- valor -->
      <input class="editor-cell editor-cell--p" placeholder=" " readonly /> <!-- separador groc -->
      <input class="editor-cell editor-cell--p" value="0.1" readonly />
      <input class="editor-cell editor-cell--p" placeholder=" " readonly />
      <input class="editor-cell editor-cell--p editor-input" /> <!-- input actiu -->
      <input class="editor-cell editor-cell--p" placeholder=" " readonly />
    </div>
  </div>
</div>
```

**Ubicació** (App13-style, sota timeline):

```javascript
// createPfrLayout
timelineWrapper.parentNode.insertBefore(pfrRow, timelineWrapper.nextSibling);

// I MOURE els controls sota l'editor (regla crítica Step 7):
const controls = timelineWrapper.querySelector('.controls');
if (controls) parent.insertBefore(controls, pfrRow.nextSibling);
```

**Format del token**: `"N"` enter (0 ≤ N < Lg) o `"N.M"` subdivisió.
Les cel·les de valor són `readOnly: false` però recreen el patró "select on focus,
validate on blur". Al hover mostren cursor: text.

**Token de pulso Lg == 0**: quan l'usuari escriu `"6"` (i `Lg == 6`), es normalitza
automàticament a `"0"` amb el tooltip `"6 es el mismo pulso que 0"`. Aquest cas
és específic del glosari sistèmic Nuzic (el pols final coincideix amb P0 al loop).

### S22: Checklist exhaustiu de migració de validacions

**Abans d'eliminar cap lògica legacy**, cerca al codi antic:

1. **Missatges d'usuari**: `grep "showValidationWarning\|showTooltip\|infoTooltip\.show"`.
   Copia-les **literalment**, amb accents i puntuació. Aquests strings són
   contracte UX; qualsevol canvi és regressió visible.
2. **Helpers matemàtics**: `isValid*`, `normalize*`, `pulseTokenValue`, etc.
   Migra'ls verbatim — les validacions dependen de la seva semàntica exacta.
3. **Casos especials del sistema Nuzic**: ex. `"6" → "0"` (App28), `"0r+"`
   (App25), `P=7 auto-blur` (App12). No són convencions nuzic-theme, són
   regles del glosari. Han de viatjar amb l'app.
4. **Auto-sort i re-posicionament**: detecta la condició (generalment
   "el nou valor és menor que algun existent") i dispara el tooltip
   equivalent (`"Reposicionando pulsos"` a App28).
5. **Validació batch vs per-token**: editors antics contenteditable validaven
   tot el text al `blur`. Editors cell-based ho fan per-token al commit.
   Tradueix els missatges plurals (`"Inválidos: a, b, c"`) a equivalents
   singulars (un tooltip per token no-vàlid).

**Verificació manual** al navegador: entra seqüencialment un token invàlid,
un duplicat, un normalitzable i un que causi reordenació. Si algun dels
quatre warnings no es dispara, s'ha perdut una regla.

### S23: Pitfalls específics d'App28 (evitar a App29-31)

Errors que vaig trobar durant la migració d'App28 — tots verificats al navegador:

1. **`flex-wrap: wrap` al `.editor-cells`** → cel·les fan zigzag en 5 files.
   Usa `flex-wrap: nowrap` + `overflow-x: auto` per gestionar alts denominadors.
2. **Cel·les rectangulars** → han de ser quadrades com App13/App15.
   `width: 4%; min-width: 1.875rem; flex: none; aspect-ratio: 1`.
   Font-size `clamp(0.75rem, 1.5vw, 1.1rem)` perquè `"5.1"` hi càpiga.
3. **`initIdleCaretFlash({ targets: [() => ...] })`** → crash. La lib espera
   elements DOM, no funcions. Ancora el flash al contenidor persistent
   (`pfrEditorEl`), no a l'input actiu (es recrea a cada render).
4. **Eliminar `normalizeToken` amb el bloc legacy** → `ReferenceError` al
   commit. Reextreu-la abans de `sed`-deletar. Mou-la a la secció de helpers.
5. **`#pulseSeq` duplicat** → template.js crea un amb `pulseSequence: true`
   dins `.middle`. Si crees un altre manualment amb el mateix ID, tens
   duplicate-ID. **Detach** el del template abans de construir el teu editor.
6. **Fraction editor "inline" dins el pulseSeq** → visualment confús. La
   fracció editor viu a `.middle` en mode `block` (com App26/27). L'editor
   Pfr no inclou la fracció N/D — només els tokens.
7. **Controls entre timeline i editor** → regla crítica del Step 7. Després
   d'insertar `pfrRow` després de `timelineWrapper`, **mou `.controls`**
   a després del `pfrRow`. Template.js els posa dins `timelineWrapper` per
   defecte.
