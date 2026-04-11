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

## Canvis per app13 (model)

### 1. Estructura DOM actual

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

### 2. Canvis CSS necessaris

| Propietat | Actual | Nuzic |
|-----------|--------|-------|
| Cel·la border | 2px color | cap |
| Cel·la background | transparent | color (rosa/crema) |
| Border-radius | 8px | 0px |
| Amplada cel·la | 48px fix | Alineada amb polsos (%) |
| Label | span rosa | div amb fons blau + text blanc |
| Sum display | input amb left-border | cel·la integrada |
| Container fons | transparent | rectangle crema |

### 3. Alineament amb timeline

L'editor ha de compartir l'amplada de la timeline. Cada cel·la ocupa l'espai d'un pols.
- Timeline: 9 polsos (0-8), amplada = 100%
- Cada pols = `100% / 8 = 12.5%` de l'amplada
- Cel·la iT amb valor 2 ocupa `2 × 12.5% = 25%`
- L'editor ha de tenir el mateix `width` i `left` que la `.timeline`

### 4. Colors nuzic per cel·les

```css
/* Cel·la iT amb valor */
background: var(--nuzic-yellow-light);  /* #ffeecc crema */

/* Cel·la iT buida */
background: transparent;

/* Cel·la iT highlighted (durant playback) */
background: var(--nuzic-green-light);  /* #cbefe1 verd clar */

/* Label */
background: var(--nuzic-yellow);  /* #ffbb33 daurat */
color: white;
```

## Fases d'implementació

- [ ] **Fase 1**: Alinear editor amb timeline (mateixa amplada i posició)
- [ ] **Fase 2**: Canviar estil de cel·les (fons en lloc de borders, cantonades rectes)
- [ ] **Fase 3**: Afegir rectangle crema de fons (connector visual amb timeline)
- [ ] **Fase 4**: Estilitzar label amb fons daurat
- [ ] **Fase 5**: Adaptar playback highlight a colors nuzic
- [ ] **Fase 6**: Validar responsive
- [ ] **Fase 7**: Aplicar patró a la resta d'apps

## Fitxers a modificar

| Fitxer | Canvi |
|--------|-------|
| `Apps/app13/styles.css` | Reescriure estils de `.it-editor` |
| `Apps/app13/main.js` | Possible ajust DOM per alineament |
| `libs/shared-ui/nuzic-theme.css` | Afegir estils compartits si són reutilitzables |
