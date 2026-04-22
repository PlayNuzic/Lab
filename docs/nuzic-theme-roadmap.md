# Nuzic Theme Roadmap

Adaptació visual de les Apps 9+ a l'estètica de nuzic_app.

## Estat actual

- [x] **Fase 1**: Tokens de color base (light + dark) → `libs/shared-ui/nuzic-theme.css`
- [x] **Fase 4**: Graella — dots negres visibles + rectangles blau sòlid (light + dark)
- [x] **Fase 2**: Soundline — fons rosa, números centrats, `decorateLabels` a soundline.js
- [x] **Fase 3**: Timeline — fons crema, sense línia horitzontal
- [x] **Fase 5**: Botons — ordre `[vol][play][bpm][random][reset]`, play i random verds, reset/vol foscos amb intercanvi en dark mode
- [x] **Fase 6**: BPM inline horitzontal — pastilla [–] [120] [+]
- [ ] Fase 7: Triangle decoratiu
- [ ] Fase 8: Opt-in per app (27 apps)
- [x] **Fase 9**: Plano-modular (integrat dins fases 2, 3, 4 i 10)
- [x] **Fase 10**: Dark mode complet — contrast per soundline, timeline, botons, labels
- [x] **Fase 11**: Fluid font-sizes — `clamp(min, vw, max)` a nuzic-theme, plano-modular, soundlines, i totes les apps
- [x] **Fase 12**: Pastilles d'input genèriques — `.param .circle` unificades amb el patró BPM per tota app nuzic
- [x] **Fase 13**: Pastilla reforçada `.param--large` — control hero amb cercle gran + cèrcol blanc interior + spinners `−/+` flotants

## Com activar el tema

Per cada app (9+), afegir al `index.html`:

```html
<!-- Al <head>, després dels altres CSS -->
<link rel="stylesheet" href="../../libs/shared-ui/nuzic-theme.css" />

<!-- Al <body> -->
<body data-theme="system" data-visual="nuzic">
```

## Referència visual

Captura de referència: l'adjunt original de la conversa (screenshot de nuzic_app PMC).
Codi font de referència: `/Users/workingburcet/nuzic_app/App/NuzicCSS.css`

## Fases detallades

### Fase 2: Soundline (CSS + JS)

**Fitxers**: `nuzic-theme.css` + `libs/app-common/soundline.js`

CSS (musical-grid):
```css
body[data-visual="nuzic"] .soundline-wrapper { background: var(--nuzic-pink-light); }
body[data-visual="nuzic"] .soundline::before { display: none; }  /* línia vertical */
body[data-visual="nuzic"] .soundline-division { display: none; }  /* ticks horitzontals */
body[data-visual="nuzic"] .soundline-number {
  left: 0; width: 100%; text-align: center;
  font-weight: 700; font-size: 14px;
}
```

JS: Afegir opció `decorateLabels` a `createSoundline()` (línia 85 de soundline.js):
```javascript
label.innerHTML = options.decorateLabels
  ? `- ${formatLabel(labelFormatter, i, midi)} -`
  : formatLabel(labelFormatter, i, midi);
```

### Fase 3: Timeline (CSS + JS)

**Fitxers**: `nuzic-theme.css` + `libs/musical-grid/musical-grid.js`

CSS:
```css
body[data-visual="nuzic"] .timeline-wrapper { background: var(--nuzic-yellow-light); }
body[data-visual="nuzic"] .timeline-line { display: none; }
body[data-visual="nuzic"] .pulse-marker {
  font-weight: 700; font-size: 14px;
}
```

JS: Afegir pipes `|` i doble barra `||` (condicional a `document.body.dataset?.visual === 'nuzic'`).

### Fase 4: Graella — dots i rectangles (CSS only)

**Fitxer**: `nuzic-theme.css`

```css
/* Dots negres visibles */
body[data-visual="nuzic"] .np-dot::after {
  width: 4px; height: 4px;
  background: var(--nuzic-dark);
  border: none; opacity: 1;
}

/* Rectangles sòlids sense glow */
body[data-visual="nuzic"] .musical-cell.active::before {
  background: var(--nuzic-blue-light);
  box-shadow: none; opacity: 1;
}

/* Cel·les transparents */
body[data-visual="nuzic"] .musical-cell {
  background: transparent; border-color: transparent;
}
```

### Fase 5: Botons (CSS only)

**Fitxer**: `nuzic-theme.css`

Ordre fix dins `.controls:not([data-layout])`:
`[volum · play · bpm · random · reset]` aconseguit amb `order` de flex.

Mides:

- Play i Random: `clamp(2rem, 5vw, 3rem)` (cercles grans).
- Reset i Volum: `clamp(1.5rem, 3.5vw, 2.25rem)` (cercles petits).

Colors:

- **Play**: fons `#7cd6b3` (verd saturat), icona blanca. Invariant en dark.
- **Random**: fons `#7cd6b3` (mateix verd que play), icona blanca. Invariant en dark.
- **Reset**: light = fons `#43433b` fosc + icona `#eee8d8` clara. Dark = **intercanvi** (fons clar + icona fosca).
- **Volum** (`.sound-wrapper.nuzic-inline .sound`): mateix patró que Reset (light fosc/clar, dark clar/fosc).
- **Fader thumb**: light = `#43433b` (fosc, com el botó); dark = `#eee8d8` (clar).

```css
/* Exemples dels colors fixos (hex hardcoded per no flipar amb tokens) */
body[data-visual="nuzic"] .random,
body[data-visual="nuzic"] .play {
  background: #7cd6b3;
  border-color: #7cd6b3;
  color: #ffffff;
}

body[data-visual="nuzic"] .reset {
  background: #43433b;
  color: #eee8d8;
}

body[data-visual="nuzic"][data-theme="dark"] .reset {
  background: #eee8d8;
  color: #43433b;
}
```

### Fase 6: BPM inline horitzontal (CSS + possible JS)

**Fitxers**: `nuzic-theme.css` + possible `libs/app-common/bpm-inline-injector.js`

La pastilla BPM és una pill de 3 segments enganxats — **mateix patró que Fase 12**:

```css
body[data-visual="nuzic"] .bpm-inline .circle {
  width: auto;
  height: clamp(2rem, 5vw, 3rem);   /* mateixa alçada que play/random */
  border-radius: 999px;
  border: 1px solid var(--nuzic-grey);
  background: var(--nuzic-white);
  display: flex; align-items: stretch;
  padding: 0; gap: 0; overflow: hidden;
}
/* `.spin.down` → meitat esquerra groga (border-radius: 999px 0 0 999px) */
/* `.spin.up`   → meitat dreta groga   (border-radius: 0 999px 999px 0) */
/* `input`      → fons transparent, flex centre */
```

La `.abbr` queda amagada al BPM (a diferència dels `.param` genèrics, que la
mostren a sobre — veure Fase 12). Motiu: el BPM viu dins `.controls` al
costat del play, i el label "BPM" és redundant amb el valor visible.

### Fase 7: Triangle decoratiu (CSS only)

```css
body[data-visual="nuzic"] .grid-container::after {
  content: ''; position: absolute; bottom: 0; left: 0;
  border-style: solid;
  border-width: 40px 0 0 40px;
  border-color: transparent transparent transparent var(--nuzic-pink-light);
}
```

### Fase 8: Opt-in per app

Apps afectades (27): App11A, App12, App14-App35, App25B.

Per cada una:
1. `index.html`: afegir `<link>` + `data-visual="nuzic"`
2. `main.js`: si crida `createSoundline()`, afegir `decorateLabels: true`

### Fase 9: Plano-modular

Selectors equivalents per al DOM de plano-modular:

| Musical-Grid | Plano-Modular |
|---|---|
| `.soundline-wrapper` | `.plano-soundline-container` |
| `.soundline-number` | `.plano-soundline-note` |
| `.soundline::before` | (no existeix, no cal ocultar) |
| `.timeline-wrapper` | `.plano-timeline-container` |
| `.pulse-marker` | `.plano-timeline-number` |
| `.musical-cell` | `.plano-cell` |
| `.musical-cell.active::before` | `.plano-cell.plano-selected::before` |
| `.np-dot::after` | `.plano-cell .np-dot::after` (App19, App20 — gradient amagat, DOM element a divisòria) |
| Columnes fixes (px) | `columnSizing: 'fr'` + `width:100%; min-width:0` a tota la cadena (App19) |
| Scroll quantitzat (wheel) | Scroll lliure natiu + `scrollToScreen()` per spinners registre |
| Autoscroll reactiu (onPulse) | `buildScrollPlan()` pre-calculat: finestra adaptativa, moviment mínim, easeInOut |
| Random salts de registre | Mínim 3 notes per registre abans de canviar (50% prob), evita salts caòtics |
| Reset esborra graella | Reset ha de restaurar defaults (compas=4, cycles=3), MAI posar null |

### Fase 10: Dark mode complet

Repetir cada fase anterior amb selector `body[data-visual="nuzic"][data-theme="dark"]`.
Tokens dark ja definits a la Fase 1.
Cal afegir overrides específics per components (soundline, timeline, cells, buttons).

### Fase 12: Pastilles d'input genèriques

**Fitxer**: `nuzic-theme.css` (bloc "FASE 11: Pastilles d'input genèriques").

Unifica `.param .circle` a **tota app nuzic** amb el mateix patró visual
que la BPM pill. El tema detecta l'estructura DOM del `.circle` i aplica
el format adequat — zero CSS per app.

#### 4 variants

| Variant | DOM | Selector | Layout |
| --- | --- | --- | --- |
| **BPM** | `.bpm-inline > .circle > input + .spinner` | `.bpm-inline` | Pill `[−] N [+]`, `.abbr` amagada |
| **Input + spinner** | `.param > .circle > input + .spinner` | `.param:has(.circle > input)` amb `.spinner` | Pill `[−] N [+]`, `.abbr` **a sobre** |
| **Input-only** | `.param > .circle > input` (sense spinner) | `.param:has(.circle > input):not(:has(.spinner))` | Pill amb input centrat, `.abbr` **a sobre** |
| **Info-pure** | `.param > .circle > span` (sense input) | `.param:has(.circle > span):not(:has(.circle > input))` | Pill amb span centrat, `.abbr` **al costat esquerre** |

#### Dimensions invariants

- **Alçada**: `clamp(2rem, 5vw, 3rem)` (igual que play/random).
- **`+/−`**: `clamp(2rem, 4vw, 2.75rem)` d'ample, mitges pastilles als laterals (`border-radius: 999px 0 0 999px` / `0 999px 999px 0`).
- **Input/span**: `clamp(3rem, 6vw, 4.5rem)` d'ample, font Ubuntu 700 `clamp(1rem, 1.8vw, 1.35rem)`.

#### Colors (invariants entre temes)

- Fons pill: `var(--nuzic-white)`.
- Border: `1px solid var(--nuzic-grey)`.
- `.spin`: fons `var(--nuzic-yellow)`, hover `#e6a82e`.
- Fletxes: `border-*-color: #ffffff`.

#### `.unit` i `.led` interiors

El tema els amaga amb `display: none !important` (el base de `index.css`
els força amb `display: block !important`). La info la porta l'`.abbr`
a sobre/al costat.

#### `.inputs` centrat

Regla addicional que neutralitza l'offset heretat `left: -20px` de `index.css`:

```css
body[data-visual="nuzic"] .inputs {
  left: 0 !important;
  margin-left: auto !important;
  margin-right: auto !important;
  justify-content: center !important;
}
```

#### `!important` justificat

Les regles base de `index.css` tenen la mateixa especificitat i ordre de
càrrega posterior; a més, algunes (`.unit { display: block }`,
`.inputs .param .spin { border-radius: 50% }` d'App19) són pròpiament
`!important`. El bloc de Fase 12 els neutralitza tots.

### Fase 13: Pastilla reforçada (`.param--large`)

**Fitxer**: `nuzic-theme.css` (bloc "FASE 13").

Variant hero per controls destacats (App16/17 "Pulsos por Compás", possibles
usos futurs a App18/19/20). S'activa afegint la classe `param--large` al
`<div class="param">`. El CSS matcha `.param.param--large` i queda exclòs
de Fase 12 via `:not(.param--large)` als selectors de Fase 12, evitant
conflictes d'especificitat.

#### Anatomia visual

```text
    Pulsos por Compás:          ← .abbr (Ubuntu 700, gran, fosc)

  ┌───┐    ┌───────┐    ┌───┐
  │ − │    │   ┌─┐ │    │ + │    ← spinners: mitges pastilles grogues
  │   │    │   │4│ │    │   │       flotants, separades del cercle
  └───┘    │   └─┘ │    └───┘
            └───────┘
             ↑
             cercle groc gran + cèrcol blanc petit interior
```

#### Estructura DOM requerida

```html
<div class="param param--large compas" id="compasParam">
  <span class="abbr">Pulsos por Compás:</span>
  <div class="circle">
    <input id="inputCompas" type="number" min="1" max="7" value="">
    <div class="spinner">
      <button id="compasUp" class="spin up">+</button>
      <button id="compasDown" class="spin down">−</button>
    </div>
  </div>
</div>
```

Els `−`/`+` són **caràcters de text** dins els botons, no triangles
generats per `::before`. El tema neutralitza `::before` amb `content: none`
per `.param--large`.

#### Dimensions (totes relatives)

- **Cercle exterior**: `clamp(4rem, 10vw, 7rem)` × `clamp(4rem, 10vw, 7rem)`, fons `var(--nuzic-yellow)`, `border-radius: 50%`.
- **Cèrcol interior blanc** (`::before` del `.circle`): `clamp(1.8rem, 4.4vw, 3rem)` — just per als dígits.
- **Input**: centrat sobre el cèrcol, Ubuntu 700 `clamp(1rem, 1.8vw, 1.35rem)`, fosc.
- **Spinners**: `clamp(2.25rem, 4.5vw, 3rem)` × `clamp(2.6rem, 6vw, 4rem)`. `border-radius: 999px 0 0 999px` (`−`) o `0 999px 999px 0` (`+`) per forma pill completa.
- **Gap cercle→spinner**: `clamp(0.25rem, 0.8vw, 0.6rem)`.
- **Label `.abbr`**: Ubuntu 700 `clamp(1.1rem, 2.2vw, 1.75rem)` sobre el cercle.

#### Posicionament dels spinners

El `.spinner` és `position: absolute` sobre el `.circle` amb `pointer-events: none`
(no intercepta clicks al centre). Els `.spin` són `position: absolute` respecte
al `.spinner`, ancorats a `right: calc(100% + gap)` i `left: calc(100% + gap)` —
així queden fora del cercle sense tocar el seu layout intern.

## Selectors de referència ràpida

```
/* Musical-Grid */
.soundline-wrapper, .soundline, .soundline::before
.soundline-division, .soundline-number
.matrix-container, .musical-cell, .musical-cell.active
.np-dot, .np-dot::after
.timeline-wrapper, .timeline-line, .pulse-marker

/* Plano-Modular */
.plano-soundline-container, .plano-soundline-note
.plano-matrix-container, .plano-matrix, .plano-cell
.plano-cell.plano-selected, .plano-cell.plano-highlight
.plano-cell .np-dot, .plano-cell .np-dot::after
.plano-timeline-container, .plano-timeline-number

/* Botons */
.play, .spin, .reset, .random
.bpm-inline, .bpm-inline .circle, .bpm-inline .spinner

/* Tema */
body[data-visual="nuzic"]                           → light
body[data-visual="nuzic"][data-theme="dark"]         → dark
```
