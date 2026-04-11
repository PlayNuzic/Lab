# Migració Editor de Seqüències a estètica Nuzic

## Estat

- [x] **app13** — Editor iT implementat i funcionant
- [ ] **App12** — Editor N-P (pròxim)
- [ ] **App14** — Editor iS + iT (zigzag)
- [ ] **App15** — Editor N-P (similar a App12)
- [ ] **App26-35** — Editors diversos

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
