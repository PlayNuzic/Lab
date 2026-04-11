# Migració iT Editor a estètica Nuzic

## Objectiu

Adaptar l'editor de seqüències (iT inputs) de les apps a l'estètica nuzic_app, on les cel·les s'alineen amb els polsos de la timeline i tenen fons de color en lloc de borders.

## Referència visual (adjunt nuzic_app)

```
┌──────┬───────┬───────┬───────┬───────┬───────┬───────┬───────┬───────┐
│  Nm  │  0r3  │   3   │   5   │   4   │   |   │   •   │       │       │  ← fila rosa
├──────┼───────┼───────┼───────┼───────┼───────┼───────┼───────┼───────┤
│  Psg │   0   │   2   │   3   │   7   │       │   •   │       │       │  ← fila crema
└──────┴───────┴───────┴───────┴───────┴───────┴───────┴───────┴───────┘
         P0      P1      P2      P3      P4      P5      P6      P7
```

Característiques:
- Cada cel·la alineada amb un pols de la timeline
- Cel·les amb fons de color (rosa per N, crema per iT) en lloc de borders
- Labels (Nm, Psg, iT) amb fons blau nuzic i text blanc
- Cantonades rectes (no arrodonides)
- Rectangle crema de fons que connecta l'editor amb la timeline

## Apps afectades

| App | Editor | Files | Prioritat |
|-----|--------|-------|-----------|
| **app13** | iT (4 inputs) | Primer model | Alta |
| App14 | iS + iT (zigzag editor) | Adaptar després | Mitjana |
| App15 | N-P grid editor | Ja usa grid-editor.css | Baixa |
| App12 | N-P grid editor | Ja usa grid-editor.css | Baixa |
| App26-31 | Fraccions + iT | Adaptar després | Mitjana |
| App32-35 | Zigzag editor | Adaptar després | Mitjana |

## Com funciona a nuzic_app (referència)

El sistema nuzic_app crea UNA cel·la `<input>` per cada pols (amplada fixa = `--RE_block` = 28px):

```
Fila iT amb seqüència [2, 1, 3, 2]:

  Col:    0    1    2    3    4    5    6    7
        ┌────┬────┬────┬────┬────┬────┬────┬────┐
        │    │ 2  │    │ 1  │    │    │ 3  │    │ ← inputs
        └────┴────┴────┴────┴────┴────┴────┴────┘
        crema crema crema crema crema crema crema crema  ← fons placeholder
              blanc                   blanc              ← fons quan té valor
        ├────┤    ├────┤    ├─────────┤    ├────┤
        crema     crema     crema (3 cols) crema          ← extensió visual

  + SVG overlay amb línies verticals daurades als polsos separadors
```

### Mecanisme clau:

1. **Totes les cel·les tenen amplada fixa** (`--RE_block` = 28px)
2. **Cel·la buida** (placeholder): fons crema (`--Nuzic_yellow_light`)
3. **Cel·la amb valor** (input): fons blanc, mostra el número
4. **L'extensió visual** NO és una cel·la ampla — són múltiples cel·les buides (crema) entre una cel·la amb valor i la següent
5. **Classe `.App_RE_end_column`**: marca la última cel·la d'un interval (separador visual)
6. **SVG overlay**: línies verticals daurades (`--Nuzic_yellow`) a les posicions dels polsos separadors, amb `pointer-events: none`

### DOM per cel·la:
```html
<input class="App_RE_inp_box App_RE_time_cell [App_RE_end_column]"
       value="{valor o buit}"
       placeholder=" "
       maxlength="3" />
```
- `placeholder=" "` → cel·la buida mostra fons crema
- `value="2"` → cel·la amb valor mostra fons blanc + número

## Canvis per app13 (model)

### 1. Estructura DOM actual (4 inputs fixos de 48px)

```html
<div class="it-editor">
  <span class="it-editor__label">iT:</span>
  <div class="it-editor__inputs">
    <input class="it-input" data-index="0" />
    <input class="it-input" data-index="1" />
    <input class="it-input" data-index="2" />
    <input class="it-input" data-index="3" />
  </div>
  <input class="it-input it-sum-display" readonly />
</div>
```

### 2. Estructura DOM nova (1 input per pols, amplada fixa)

```html
<div class="it-editor-bar">                    ← flex row, mateixa amplada que .timeline
  <div class="it-label">iT</div>              ← label daurat

  <!-- 8 cel·les (una per pols), flex row -->
  <div class="it-cells">
    <input class="it-cell" placeholder=" " />  ← P0: crema (extensió) o blanc (valor)
    <input class="it-cell it-end" value="2" /> ← P1: blanc amb valor "2", fi d'interval
    <input class="it-cell" placeholder=" " />  ← P2: crema (extensió)
    <input class="it-cell it-end" value="1" /> ← P3: blanc amb valor "1"
    ...
    <div class="it-end-marker"></div>          ← marcador fi (negre)
  </div>

  <!-- SVG overlay: línies verticals daurades als separadors -->
  <svg class="it-separator-lines">
    <line x1="X" y1="8" x2="X" y2="20" />     ← tick daurat per cada pols
  </svg>
</div>
```

### 3. Comportament

```
Entra "2" al 1r input:
  [crema][blanc:2]  [input buit][···buit···]  [●]
  P0     P1          P2                        P2

Entra "1":
  [crema][blanc:2]  [blanc:1]  [input buit][···]  [●]
  P0     P1          P2         P3                  P3

Entra "3":
  [crema][blanc:2]  [blanc:1]  [crema][crema][blanc:3]  [input][●]
  P0     P1          P2         P3     P4     P5          P6    P6

Entra "2":
  [crema][blanc:2]  [blanc:1]  [crema][crema][blanc:3]  [crema][blanc:2][●]
  P0     P1          P2         P3     P4     P5          P6     P7      P8
  SEQÜÈNCIA PLENA
```

### 4. Colors i estils

```css
.it-editor-bar { display: flex; align-items: center; position: relative; }
.it-cells      { display: flex; flex: 1; height: 28px; position: relative; }

/* Cel·la base (crema quan buida via placeholder) */
.it-cell {
  width: var(--it-cell-width);  /* calculat: amplada_timeline / Lg */
  height: 100%;
  border: none;
  border-radius: 0;
  text-align: center;
  font-weight: 600;
  background: var(--nuzic-yellow-light);  /* crema placeholder */
}

/* Cel·la amb valor: fons blanc */
.it-cell:not(:placeholder-shown) {
  background: var(--nuzic-white);
  z-index: 1;
}

/* Fi d'interval: accent visual dret */
.it-cell.it-end {
  border-right: 2px solid var(--nuzic-yellow-light);
}

/* Label */
.it-label {
  background: var(--nuzic-yellow);
  color: white;
  font-weight: 700;
  padding: 4px 8px;
}

/* Marcador fi */
.it-end-marker {
  background: var(--nuzic-dark);
  width: var(--it-cell-width);
  height: 100%;
}

/* SVG separadors */
.it-separator-lines {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.it-separator-lines line {
  stroke: var(--nuzic-yellow);
  stroke-width: 2;
}

/* Highlight durant playback */
.it-cell.active {
  background: var(--nuzic-green-light);
}
```

## Fases d'implementació

- [ ] **Fase 1**: Crear DOM dinàmic amb 1 cel·la per pols (JS)
- [ ] **Fase 2**: Alinear amplada de cel·les amb polsos de timeline
- [ ] **Fase 3**: Estilitzar cel·les (crema/blanc, placeholder trick)
- [ ] **Fase 4**: Afegir SVG overlay amb línies separadores daurades
- [ ] **Fase 5**: Label daurat + marcador fi negre
- [ ] **Fase 6**: Connectar lògica d'entrada (enter valor → crear extensió crema)
- [ ] **Fase 7**: Highlight durant playback
- [ ] **Fase 8**: Responsive
- [ ] **Fase 9**: Extreure a mòdul compartit
- [ ] **Fase 10**: Aplicar a la resta d'apps

## Fitxers a modificar

| Fitxer | Canvi |
|--------|-------|
| `Apps/app13/main.js` | Reescriure editor: DOM dinàmic 1 cel·la/pols |
| `Apps/app13/styles.css` | Nous estils per `.it-editor-bar`, `.it-cell` |
| `libs/shared-ui/nuzic-theme.css` | Possibles estils compartits |
