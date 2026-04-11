# Migració Editor de Seqüències a estètica Nuzic

## Estat

- [x] **app13** — Editor iT implementat i funcionant
- [x] **App12** — Editor N-P implementat (single-column layout, validació, tooltips)
- [ ] **App14** — Editor iS + iT (zigzag)
- [ ] **App15** — Editor N-P (aplicar patró App12)
- [ ] **App26-35** — Editors diversos

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

## Per App12 (pròxim): línies N i P

App12 té un grid-editor amb línies N (nota) i P (pols). El patró serà similar:
- **Fila N** (rosa): cel·les amb fons `--nuzic-pink-light`, valors en blanc
- **Fila P** (crema): cel·les amb fons `--nuzic-yellow-light`, valors en blanc
- Labels: "N" rosa, "P" daurat
- Mateixa alineació amb timeline

Diferència clau: N i P tenen cel·les independents (no extensions), una per columna del grid-editor existent (`libs/matrix-seq/grid-editor.css`).
