# Nuzic Visual System — AI Reference Guide

> Knowledge base for an AI assistant that generates web-based rhythm and music
> educational apps following the Nuzic visual system. All code is paste-ready
> and based on the PlayNuzic Lab implementations (Apps 9–35).
>
> This document is the canonical source. Training pairs (JSONL) are derived
> from this content by extracting sections and code blocks. Each pattern is
> structured as: Purpose / When to use / Code / Pitfalls.

---

## Table of Contents

1. Identity & Palette
2. Design Tokens
3. Component Library
4. Composable Features
5. Recipe Library (paste-ready starters)
6. Pitfalls & Solutions
7. Decision Rules
8. Code Conventions

---

## 1. Identity & Palette

### 1.1 Color Tokens

All apps share a single palette. Use the CSS variables, not raw hex.

```css
/* libs/shared-ui/nuzic-theme.css — applied via body[data-visual="nuzic"] */
:root {
  --nuzic-white:        white;       /* page background, default cells     */
  --nuzic-light:        #eee8d8;     /* cream — timeline base, panel bg     */
  --nuzic-grey:         #AAA699;     /* dimmed text, disabled states        */
  --nuzic-dark:         #43433b;     /* primary text, lines, ticks          */
  --nuzic-red:          #e76f68;     /* warnings, validation errors         */
  --nuzic-red-light:    #f5c6c2;     /* warning backgrounds                 */
  --nuzic-blue:         #7bb4cd;     /* active selection, playback highlight*/
  --nuzic-blue-light:   #bdd9e6;     /* note-bars default, selection bg     */
  --nuzic-green:        #7cd6b3;     /* play button, success accent         */
  --nuzic-green-light:  #cbefe1;     /* hover green                         */
  --nuzic-yellow:       #ffbb33;     /* primary accent — endcaps, halters   */
  --nuzic-yellow-light: #ffeecc;     /* cream-yellow strips, fills          */
  --nuzic-pink:         #f28aad;     /* secondary — soundline, N labels     */
  --nuzic-pink-light:   #ffe5ee;     /* soundline bg, N-row cells           */
}
```

### 1.2 Typography

- **Font family**: `'Ubuntu', sans-serif` (loaded via `<link>` in index.html).
- **Numbers**: `font-weight: 900`. Always pure black `#000` (not `--nuzic-dark`) for maximum contrast on cream/white backgrounds.
- **Labels**: `font-weight: 700`.
- **Sizes**: all `clamp(min, vw, max)`. Never fixed `rem`.

Standard clamp patterns:

```css
/* Small (tooltips, captions)  */ font-size: clamp(0.65rem, 1.2vw, 0.8rem);
/* Body (numbers, cells)        */ font-size: clamp(0.7rem, 1.4vw, 0.875rem);
/* Medium (labels)              */ font-size: clamp(0.85rem, 1.8vw, 1.4rem);
/* Large (timeline numbers)     */ font-size: clamp(0.85rem, 1.6vw, 1.2rem);
/* Fraction inputs (XL)         */ font-size: clamp(1.75rem, 3.8vw, 2.7rem);
```

### 1.3 Visual Philosophy

- **Geometric**: rectangles, dots, halters. Avoid soft rounded corners except for buttons and info pills.
- **Cream + accent**: most surfaces are cream (`--nuzic-light` or `--nuzic-yellow-light`). Yellow rectangles mark structural endpoints.
- **Generous spacing**: vertical breathing room between modules.
- **Light by default**: `<body data-theme="light">`. Dark mode supported but rarely needed.
- **No emojis** in UI text. Use SVG icons.
- **No drop shadows** except as glow effects for playback highlights.

---

## 2. Design Tokens

### 2.1 Per-app CSS Variables

Each app declares its endcap dimensions on `body.appNN`:

```css
body.app32 {
  --app32-endcap-w: clamp(1.875rem, 5.25vw, 5rem);   /* 30–80 px */
  --app32-endcap-h: clamp(3.8rem, 4vw, 4.75rem);     /* 61–76 px */
  /* Apps with timeline/grid number insets */
  --app32-timeline-left-label-inset:  clamp(0.2rem, 0.7vw, 0.45rem);
  --app32-timeline-right-label-inset: clamp(0.45rem, 1.1vw, 0.85rem);
}
```

The endcap dimensions cascade through every component: timeline endcaps,
fraction editor width, info pill size, subdivision-label position.

### 2.2 Why CSS Variables Per-App

- Multiple apps loaded in the same page (e.g. Sistema Interactivo iframes) must not collide.
- Each app's tokens are scoped to its own body class.
- Components reference `var(--appNN-endcap-w)` directly — they are not portable across apps without renaming.

### 2.3 Fluid Sizing Conventions

- **Widths / heights / paddings / margins**: `clamp(min, vw, max)` or `rem`.
- **Font sizes**: ALWAYS `clamp(min, vw, max)`. Never fixed `rem`.
- **Borders / shadows**: `px` (these are decorative, not structural).
- **Grid positioning**: percentages (so columns scale with `1fr` tracks).
- **NO `@media` breakpoints for font-size**. Use `clamp` exclusively.

### 2.4 Naming Conventions

- App body class: `body.app32` (lowercase, no hyphen).
- CSS variables: `--appNN-feature-axis` (e.g. `--app32-endcap-w`).
- Component classes: kebab-case, prefixed by component family (`.plano-cell`, `.fraction-editor`, `.note-bar`).
- State classes: `.active`, `.selected`, `.complete`, `.highlight`.

---

## 3. Component Library

Each component below is self-contained: DOM expected, CSS rules, optional JS.

### 3.1 Theme Setup (mandatory)

Every Nuzic app declares the theme at HTML level:

```html
<!-- index.html -->
<head>
  <link rel="stylesheet" href="../../libs/shared-ui/index.css" />
  <link rel="stylesheet" href="../../libs/app-common/styles.css" />
  <link rel="stylesheet" href="../../libs/shared-ui/bpm-inline.css" />
  <link rel="stylesheet" href="../../libs/shared-ui/nuzic-theme.css" />
  <link rel="stylesheet" href="styles.css" />
</head>
<body class="appNN" data-theme="light" data-visual="nuzic">
  <div id="app-root"></div>
</body>
```

The `data-visual="nuzic"` attribute is the trigger for all nuzic styles in
the shared CSS. **It is the only supported style**. There is no "no-theme"
fallback — every app uses Nuzic.

`data-theme="light"` is the default. Dark mode toggle is optional via the
header menu but rarely used.

### 3.2 Timeline (horizontal standalone)

Used for apps with a single horizontal time line: rhythm sequences, fraction
apps. Apps: app9, app13, App16, App17, App26–31.

**DOM** (generated by template.js):

```html
<section class="timeline-wrapper" id="timelineWrapper">
  <section class="timeline" id="timeline">
    <!-- pulse-numbers, cycle-markers, cycle-labels, subdivision-label generated by JS -->
  </section>
  <div class="controls"><!-- play, BPM, random, reset --></div>
</section>
```

**CSS** (per app, in styles.css):

```css
.timeline-wrapper {
  width: auto !important;            /* override width:100% from app-common */
  margin: 0.5rem var(--appNN-endcap-w) 0.75rem var(--appNN-endcap-w);
  position: relative;
}

.timeline {
  position: relative;
  margin-top: 0.75rem;
}

/* Yellow endcaps + cream-yellow gradient */
body[data-visual="nuzic"].appNN
  .timeline-wrapper:has(.timeline):not(:has(.soundline-container))
  .timeline {
  background:
    linear-gradient(
      to bottom,
      var(--nuzic-yellow-light) 0,
      var(--nuzic-yellow-light) 70%,
      var(--nuzic-yellow) 70%,
      var(--nuzic-yellow) 93%,
      var(--nuzic-yellow-light) 93%,
      var(--nuzic-yellow-light) 100%
    );
}

body[data-visual="nuzic"].appNN
  .timeline-wrapper:has(.timeline):not(:has(.soundline-container))
  .timeline::before,
body[data-visual="nuzic"].appNN
  .timeline-wrapper:has(.timeline):not(:has(.soundline-container))
  .timeline::after {
  content: '';
  display: block;
  position: absolute;
  inset: auto;                       /* cancel inset: 0 from circular mode */
  opacity: 1;
  border: 0;
  top: 0%;
  width: var(--appNN-endcap-w);
  height: var(--appNN-endcap-h);
  background: var(--nuzic-yellow);
  border-radius: 4px;
  z-index: 0;
  pointer-events: none;
}

.timeline::before { left: 0;  transform: translateX(calc(-100% - 1.25rem)); }
.timeline::after  { right: 0; transform: translateX(calc(100% + 1.25rem)); }
```

**Why `translateX(±100% ∓ 1.25rem)`**: `.timeline` has `width: calc(100% - 40px); margin: 20px auto` inherited from `app-common/styles.css`. The endcap is flush with the cream `box-shadow` extension which adds 1.25rem on each side. The transform compensates so the endcap sits exactly at the wrapper edge.

### 3.3 Soundline (vertical standalone)

Used for scale and interval apps: app10, App14, App18, App21–24.

**DOM**:

```html
<div class="soundline-container">
  <div class="soundline">
    <!-- .soundline-number elements, absolutely positioned by JS -->
  </div>
</div>
```

**CSS**:

```css
.soundline {
  background: var(--nuzic-pink-light);
  /* Width matches the longest soundline-number; auto-sizes via JS */
}

.soundline-number {
  position: absolute;
  font-weight: 700;
  font-size: clamp(0.7rem, 1.4vw, 1.2rem);
  color: var(--nuzic-dark);
}

.soundline-number::before { content: '\2013\2002'; }  /* en-dash + en-space  */
.soundline-number::after  { content: '\2002\2013'; }  /* en-space + en-dash  */
```

**JS** positions each number by percentage from top.

### 3.4 Plano 2D — musical-grid

Lib: `libs/musical-grid`. Used by app11, App12, App15, App25, App25B.

**Features**: cell-selection (single click), `np-dot` per cell, soundline on left, optional pulse highlighting on top.

**DOM** (generated by `createMusicalGrid`):

```html
<div id="gridContainer" class="grid-container">
  <div class="musical-grid">
    <div class="soundline-container">...</div>
    <div class="matrix-container">
      <div class="musical-cell" data-row="0" data-col="0">
        <div class="np-dot"></div>
      </div>
      <!-- ... rows × columns cells -->
    </div>
    <div class="timeline-row">
      <!-- pulse-number, cycle-marker elements -->
    </div>
  </div>
</div>
```

**Use when**:
- Single registry (one octave).
- Cell-based note selection (not duration-based).
- Scale apps with degree numbers as Y-axis.

### 3.5 Plano 2D — plano-modular

Lib: `libs/plano-modular`. Used by App19, App20, App32, App33, App34, App35.

**Features**: multi-registry scroll, note-bars with variable duration, drag-to-create notes, fraction overlay support.

**DOM** (generated by `buildGridDOM`):

```html
<div id="gridContainer" class="grid-container">
  <div class="plano-container">          <!-- grid 2x2: cols [auto, 1fr], rows [1fr, auto] -->
    <div class="plano-soundline-container">  <!-- col 1 row 1 -->
      <div class="plano-soundline-row">
        <div class="plano-soundline-note">11</div>
        <!-- ... -->
      </div>
    </div>
    <div class="plano-grid-area">             <!-- col 2 row 1 -->
      <div class="plano-matrix-container">
        <div class="plano-matrix">
          <div class="plano-cell" data-col-index="0" data-row-id="11r3">
            <div class="np-dot"></div>
          </div>
          <!-- rows × columns cells -->
        </div>
      </div>
    </div>
    <div class="plano-timeline-container">    <!-- col 2 row 2 -->
      <div class="plano-timeline-row">
        <div class="plano-timeline-number">0</div>
        <!-- ... -->
      </div>
    </div>
    <!-- .plano-container::before fills col 1 row 2 (bottom-left corner)  -->
  </div>
</div>
```

**Important grid coords**:
- col 1 (auto width) = soundline column.
- col 2 (1fr, expands) = matrix + timeline.
- row 1 (1fr) = soundline + matrix.
- row 2 (auto) = bottom-left corner + timeline.

**Use when**:
- Multi-octave registers (App19/20 with `r3`, `r4`, `r5`).
- Notes with explicit duration (note-bars spanning multiple columns).
- Fraction overlay needed.
- Drag-to-create note workflows.

### 3.6 Endcaps (yellow rectangles)

Two variants depending on app type:

**Variant A — Standalone timeline** (sections 3.2): `::before` / `::after` on `.timeline`, projected outside via `translateX`. See section 3.2 code.

**Variant B — Plano 2D** (sections 3.4/3.5): leverage the existing `.plano-container::before` (col 1 row 2 of the grid) and add a yellow rectangle `::after` on the right side of `.plano-timeline-container`.

```css
/* Yellow rectangle right endcap on plano-timeline */
body[data-visual="nuzic"].appNN .plano-timeline-container {
  position: relative;
  height: var(--appNN-endcap-h) !important;
  min-height: var(--appNN-endcap-h) !important;
  overflow-y: visible !important;
  /* Cream + yellow gradient (same as Variant A) */
  background:
    linear-gradient(
      to bottom,
      var(--nuzic-yellow-light) 0,
      var(--nuzic-yellow-light) 70%,
      var(--nuzic-yellow) 70%,
      var(--nuzic-yellow) 93%,
      var(--nuzic-yellow-light) 93%,
      var(--nuzic-yellow-light) 100%
    ) !important;
}

body[data-visual="nuzic"].appNN .plano-timeline-container::after {
  content: '';
  display: block;
  position: absolute;
  top: 0;
  right: 0;
  width: var(--appNN-endcap-w);
  height: 100%;
  background: var(--nuzic-yellow);
  z-index: 5;
  pointer-events: none;
}

/* Reduce useful width of matrix + timeline so cells don't overflow into endcap */
body[data-visual="nuzic"].appNN .plano-matrix-container,
body[data-visual="nuzic"].appNN .plano-timeline-container {
  padding-right: var(--appNN-endcap-w) !important;
  box-sizing: border-box;
}
```

### 3.7 Triangle Corner (plano-2D)

The bottom-left corner of `.plano-container` (col 1 row 2 of the grid) gets
a diagonal pink → yellow gradient. The pink half continues the soundline
visually upward; the yellow half continues the timeline endcap leftward.

```css
body[data-visual="nuzic"].appNN .plano-container {
  gap: 0 !important;        /* matrix must touch timeline directly       */
  position: relative;       /* for subdivision-label absolute child      */
}

body[data-visual="nuzic"].appNN .plano-container::before {
  background: linear-gradient(
    to bottom right,
    var(--nuzic-pink) 0%,
    var(--nuzic-pink) 49.5%,
    var(--nuzic-yellow) 50.5%,
    var(--nuzic-yellow) 100%
  ) !important;
  /* Extend upward to cover .plano-soundline-row padding-bottom */
  margin-top: calc(-1 * var(--plano-cell-height, 32px) / 2) !important;
}
```

**Why margin-top negative**: `.plano-soundline-row` and `.plano-matrix` have `padding-bottom: cellHeight/2` to reserve space for the `-0-` text (which uses `translateY(50%)`) and row-0 note-bars. Without compensating with `margin-top: -cellHeight/2` on the corner, a visual gap appears between the `-0-` text and the timeline.

The same `margin-top` is applied to `.plano-timeline-container` to close the gap between row-0 of the matrix and the timeline.

### 3.8 Subdivision Label

A small white `1/d` (or `n/d`) inside the bottom-left corner of the plano.
Indicates the active fraction.

```css
.plano-container > .plano-subdivision-label {
  position: absolute;
  left: 0;
  bottom: 0;
  width: var(--plano-soundline-width, 50px);
  height: var(--appNN-endcap-h);
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  padding: 0 0.18rem 0.12rem 0;
  font-size: clamp(0.65rem, 1vw, 0.82rem);
  font-weight: 700;
  color: #fff;
  pointer-events: none;
  z-index: 6;
  box-sizing: border-box;
}
```

**JS** (added in `renderGridTimeline` or equivalent):

```javascript
const planoContainer = gridElements?.container;
if (planoContainer) {
  let subdivisionLabel = planoContainer.querySelector('.plano-subdivision-label');
  if (!subdivisionLabel) {
    subdivisionLabel = document.createElement('div');
    subdivisionLabel.className = 'plano-subdivision-label';
    planoContainer.appendChild(subdivisionLabel);
  }
  // Simple fraction: "1/d". Complex: "n/d".
  subdivisionLabel.textContent = `${n}/${d}`;
}
```

### 3.9 Fraction Editor (block mode)

A vertical yellow rectangle containing two stacked numbers (numerator over
denominator) with spinner controls.

**Two variants**:

| Variant | Numerator | autoReduce | Spinners visible |
|---|---|---|---|
| Simple (n=1 fixed) | readonly | false (`enableGhost: false`) | denominator only |
| Complex (n editable) | editable | true (default) | both numerator + denominator |

**JS** (creates the editor inside a host element):

```javascript
import createFractionEditor from '../../libs/app-common/fraction-editor.js';

// Simple variant
const controller = createFractionEditor({
  mode: 'block',
  host: fractionSlot,
  defaults: { numerator: 1, denominator: 2 },
  startEmpty: false,
  maxDenominator: 8,
  enableGhost: false,  // CRITICAL for simple: kills 7 ghost DOM elements
  storage: {},
  addRepeatPress,
  onChange: ({ cause }) => {
    if (cause !== 'init') handleFractionChange();
  }
});
controller.setSimpleMode();  // hides numerator spinner, sets readonly

// Complex variant
const controller = createFractionEditor({
  mode: 'block',
  host: fractionSlot,
  defaults: { numerator: 2, denominator: 3 },
  autoReduce: true,       // animates reduction when n and d share factors
  minNumerator: 2,
  maxNumerator: 6,
  minDenominator: 2,
  maxDenominator: 8,
  storage: {},
  addRepeatPress,
  onChange: ({ cause }) => {
    if (cause !== 'init') handleFractionChange();
  }
});
controller.setComplexMode();  // both inputs editable, both spinners visible
```

**CSS** (per app):

```css
.fraction-editor-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  /* CRITICAL: gap:0 prevents ghost-fraction from capturing flex gap
     (only matters for complex variant with autoReduce). */
  gap: 0;
}

.fraction-editor {
  position: relative;
  /* Standalone timeline apps: shift left to align with ::before endcap */
  left: calc(0px - var(--appNN-endcap-w));
  /* Plano-2D apps: left: 0 (the corner triangle is the implicit endcap) */
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  gap: 0.2rem;
  width: var(--appNN-endcap-w);
  box-sizing: border-box;
  padding: 0.5rem 0;
  border: 3px solid var(--nuzic-yellow);
  border-radius: 0.4rem;
  color: #000;
}

.fraction-editor .top,
.fraction-editor .bottom {
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 0;
  padding: 0;
}

/* Simple variant: bar as border-bottom of .top with constrained width */
.fraction-editor .top {
  border-bottom: 4px solid #000;
  width: 65%;
  margin: 0 auto;
}

/* Complex variant override: bar as pseudo-element so .top can be 100% width
   (both spinners project at same x). */
.fraction-editor .top {
  position: relative;
  width: 100%;
  margin: 0;
  padding-bottom: 4px;
  border-bottom: none;
}
.fraction-editor .top::after {
  content: '';
  position: absolute;
  left: 17.5%;
  right: 17.5%;
  bottom: 0;
  height: 4px;
  background: #000;
  pointer-events: none;
}

.fraction-editor input {
  width: 100%;
  text-align: center;
  font-size: clamp(1.75rem, 3.8vw, 2.7rem);
  background: none;
  border: none;
  color: #000 !important;
  font-family: 'Ubuntu', sans-serif;
  outline: none;
  font-weight: 900;
  line-height: 1;
  padding: 0;
}

.fraction-editor input:disabled,
.fraction-editor input:read-only {
  opacity: 1 !important;     /* override default 0.5 for simple readonly */
  cursor: default !important;
  color: #000 !important;
}

/* Spinner pill outside box on the right */
.fraction-field {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.fraction-field .spinner {
  position: absolute;
  left: calc(100% + 0.45rem);
  right: auto;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  gap: 4px;
  width: 1.3rem;
  height: 2.8rem;
  background: transparent;
  overflow: visible;
}

.fraction-field .spinner .spin {
  flex: 1 1 50%;
  width: 100%;
  height: auto;
  border: none;
  background: var(--nuzic-yellow);
  padding: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-family: 'Ubuntu', sans-serif;
  font-weight: 700;
  font-size: 0.8rem;
}

.fraction-field .spinner .spin.up   { border-radius: 999px 999px 0 0; }
.fraction-field .spinner .spin.down { border-radius: 0 0 999px 999px; }

.fraction-field .spinner .spin::before { content: none; border: 0; }
.fraction-field .spinner .spin.up::after   { content: '+'; }
.fraction-field .spinner .spin.down::after { content: '−'; }
```

### 3.10 Info Pills (Suma iT / iT Disponibles)

Square boxes with bold label on the left and a black numeral on the right.
Used in apps with iT counters: App30, App31, App32–35.

**DOM**:

```html
<div class="itfr-info-group">
  <div class="bpm-inline visible param sum-it">
    <span class="abbr">Suma iT</span>
    <div class="circle"><input type="text" readonly value="0"></div>
  </div>
  <div class="bpm-inline visible param it-disponibles">
    <span class="abbr">iT Disponibles</span>
    <div class="circle"><input type="text" readonly value="12"></div>
  </div>
</div>
```

**CSS** — uses **specificity boost** (every selector must include `body[data-visual="nuzic"].appNN` AND `.bpm-inline.visible.param.X`) to override the strong `nuzic-theme.css` defaults for `.param:has(.circle > input)`.

```css
.itfr-info-group {
  position: absolute;
  top: 0;
  /* Standalone apps: shift right by W so pills align with endcap.right.
     Plano-2D apps: right: 0 (pills align with viewport right edge). */
  right: calc(0px - var(--appNN-endcap-w));
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  align-items: flex-end;
}

body[data-visual="nuzic"].appNN .itfr-info-group .bpm-inline.visible.param.sum-it,
body[data-visual="nuzic"].appNN .itfr-info-group .bpm-inline.visible.param.it-disponibles {
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
  justify-content: flex-end !important;
  gap: 0.75rem !important;
  background: transparent !important;
  border-radius: 0 !important;
  padding: 0 !important;
  width: auto !important;
  height: auto !important;
  overflow: visible !important;
}

body[data-visual="nuzic"].appNN .itfr-info-group .bpm-inline.visible.param.sum-it .abbr,
body[data-visual="nuzic"].appNN .itfr-info-group .bpm-inline.visible.param.it-disponibles .abbr {
  position: static !important;
  transform: none !important;
  font-family: 'Ubuntu', sans-serif !important;
  font-weight: 900 !important;
  font-size: clamp(1rem, 2vw, 1.4rem) !important;
  color: #000 !important;
  white-space: nowrap !important;
  text-transform: none !important;
  text-align: right !important;
  order: 0 !important;
}

body[data-visual="nuzic"].appNN .itfr-info-group .bpm-inline.visible.param.sum-it .circle,
body[data-visual="nuzic"].appNN .itfr-info-group .bpm-inline.visible.param.it-disponibles .circle {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: var(--appNN-endcap-w) !important;
  height: var(--appNN-endcap-w) !important;
  min-width: 0 !important;
  padding: 0 !important;
  border-radius: 4px !important;
  background: white !important;
  overflow: visible !important;
  order: 1 !important;
  box-sizing: border-box !important;
  flex-shrink: 0 !important;
}

/* Suma iT: bright yellow border (highlight color) */
body[data-visual="nuzic"].appNN .itfr-info-group .bpm-inline.visible.param.sum-it .circle {
  border: 3px solid var(--nuzic-yellow) !important;
}

/* iT Disponibles: cream yellow border (subdued) */
body[data-visual="nuzic"].appNN .itfr-info-group .bpm-inline.visible.param.it-disponibles .circle {
  border: 3px solid var(--nuzic-yellow-light) !important;
}

body[data-visual="nuzic"].appNN .itfr-info-group .bpm-inline.visible.param.sum-it .circle input,
body[data-visual="nuzic"].appNN .itfr-info-group .bpm-inline.visible.param.it-disponibles .circle input {
  width: 100% !important;
  height: 100% !important;
  background: transparent !important;
  border: none !important;
  outline: none !important;
  text-align: center !important;
  padding: 0 !important;
  font-weight: 900 !important;
  font-size: clamp(1.1rem, 2.4vw, 1.6rem) !important;
  color: #000 !important;
  cursor: default !important;
  font-family: 'Ubuntu', sans-serif !important;
}
```

### 3.11 Halter (interval-label-bar)

Yellow `dot — line — box — line — dot` indicator showing the duration of an
interval. Used under note-bars (plano-2D) or under timeline intervals (App13).

**Library**: `libs/shared-ui/interval-label-bar.{js,css}`. Add `<link>` to
`interval-label-bar.css` in your `index.html`.

**JS**:

```javascript
import { createIntervalLabelBar } from '../../libs/shared-ui/interval-label-bar.js';

const halter = createIntervalLabelBar({
  startPercent: 25,         // left edge as % of container width
  widthPercent: 12.5,       // width as % of container width
  label: 3,                 // iT number shown in central box
  variant: 'solid'          // 'solid' or 'dashed' (for silences)
});
container.appendChild(halter);
```

**CSS** (positioning per app):

```css
/* Under a note-bar in plano-2D: */
.note-halter {
  /* Inherits from .interval-label-bar in interval-label-bar.css */
  /* Set top per-note in JS: top = barTop + barHeight (just below bar) */
}

/* Under colored interval bars on timeline (App30-style): */
.interval-bar-visual { top: -3.3rem; }
.interval-label-bar  { top: -1.9rem; }
```

### 3.12 Compás (measure-header)

Rectangle on the left side of a timeline indicating the measure/compás
structure. Used by App16, App17, App19.

**Library**: `libs/shared-ui/measure-header.{js,css}`.

**JS**:

```javascript
import { createMeasureHeader } from '../../libs/shared-ui/measure-header.js';

const measureHeader = createMeasureHeader({
  container: headerEl,
  labelText: 'Compás'        // optional, default '' for retro-compat
});
```

**CSS variables** consumed:

```css
body.appNN {
  --com-band-w: clamp(2.5rem, 7vw, 5rem);   /* width of the measure rectangle  */
  --com-band-track-right: 0;                 /* right offset alignment          */
}
```

### 3.13 Scale Pill / Output Note Pill

Pills used in scale apps (App21–25B) to select scale, transposition, or
register.

**Library**: `libs/shared-ui/{scale-pill,output-note-pill}.css` and
`libs/app-common/{scale-pill,output-note-pill}.js`.

**Scale pill** (select dropdown):

```html
<div class="bpm-inline visible param escala" id="escalaParam">
  <span class="abbr">Escala</span>
  <div class="circle escala-circle">
    <select id="escalaSelect" class="escala-select"></select>
  </div>
</div>
```

```javascript
import { createScalePill } from '../../libs/app-common/scale-pill.js';

createScalePill({
  scales: APP25_SCALES,        // [{ value, name, id, rotation, ... }]
  initial: 'DIAT-0',
  onChange: (scale) => handleScaleChange(scale),
});
```

**Output note pill** (numeric input + spinner, cyclic 0–11):

```html
<div class="bpm-inline visible param outputnote" id="outputNoteParam">
  <span class="abbr">Transposición</span>
  <div class="circle">
    <input id="inputOutputNote" type="number" min="0" max="11" value="0" />
    <div class="spinner">
      <button class="spin up"></button>
      <button class="spin down"></button>
    </div>
  </div>
</div>
```

```javascript
import { createOutputNotePill } from '../../libs/app-common/output-note-pill.js';

createOutputNotePill({
  initial: outputNote,
  range: { min: 0, max: 11, cyclic: true },
  onChange: (value) => updateForTransposeChange(value),
});
```

**Per-app override** for identity color (required):

```css
body.appNN { --nuzic-spin-bg: var(--nuzic-pink); --nuzic-spin-bg-hover: #d96a93; }
```

### 3.14 Editors — Cell-based

Single-row editors below the timeline or grid. Each "cell" is a small square
input. Two patterns:

**Pattern A — fixed cells per token** (Pfr, iTfr, nit):

```html
<div class="appNN-editor-row">
  <div class="appNN-editor">
    <div class="editor-label">Pfr</div>    <!-- or iT, N+iT, etc. -->
    <div class="editor-cells">
      <input class="editor-cell value-cell">       <!-- white, has value -->
      <input class="editor-cell separator-cell">   <!-- yellow-light, empty -->
      <input class="editor-cell value-cell">
      ...
      <input class="editor-cell active-input">     <!-- white, focused -->
    </div>
  </div>
</div>
```

**CSS** (uniform across apps 28–31 and 34–35):

```css
.appNN-editor {
  position: relative;
  display: grid;
  grid-template-columns: var(--appNN-endcap-w) 1fr;
}

.appNN-editor .editor-label {
  font-weight: 700;
  font-size: clamp(0.85rem, 1.8vw, 1.4rem);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  background: var(--nuzic-yellow);
  user-select: none;
}

.appNN-editor .editor-cells {
  display: flex;
  justify-content: flex-start;
  align-items: stretch;
  flex-wrap: nowrap;
  gap: 0;
  background: var(--nuzic-light);
  overflow-x: auto;
  overflow-y: hidden;
  padding: 0 1.25rem;          /* aligns cells with timeline cream */
}

.appNN-editor .editor-cell {
  width: 5%;                    /* 20 cells fit horizontally */
  min-width: 3rem;              /* 48 px minimum on small viewports */
  flex: none;
  aspect-ratio: 1;              /* always square */
  padding: 0;
  margin: 0;
  text-align: center;
  color: var(--nuzic-dark);
  font-size: clamp(0.85rem, 1.6vw, 1.2rem);
  font-weight: 700;
  border: none;
  outline: none;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0;
}

.appNN-editor .editor-cell.separator-cell {
  background: var(--nuzic-yellow-light);
}

.appNN-editor .editor-cell.value-cell {
  background: white;
  z-index: 1;
  cursor: text;
}

.appNN-editor .editor-cell.value-cell:focus {
  box-shadow: inset 0 0 0 2px var(--nuzic-yellow);
}

.appNN-editor .editor-cell.active-input {
  background: white !important;
  cursor: text;
  z-index: 2;
}

.appNN-editor .editor-cell.active-input:focus {
  box-shadow: inset 0 0 0 2px var(--nuzic-yellow);
}
```

**Plano-2D variant**: `.nit-editor-bar` instead of `.editor-cells`. Same
square-cell rules but without the explicit padding (the plano-2D layout
provides alignment). Critical: do NOT set `height: 2rem` on the bar — let
the `aspect-ratio: 1` of cells determine height.

```css
.nit-editor-bar {
  display: flex;
  align-items: stretch;       /* lets aspect-ratio:1 cells set the height */
  /* No `height: 2rem` here — would force rectangular cells */
}
```

### 3.15 Editors — Zigzag (iS-iT)

Two-row editor where iS values sit at column n and iT values at column n+1
(zigzag offset). Used by App15, App20, App34, App35.

See `Apps/App15/main.js` for the canonical implementation. Key API:

```javascript
gridEditor = {
  getPairs: () => [...],
  setPairs: (pairs) => { ... },
  clear: () => { ... },
  clearHighlights: () => {},  // REQUIRED no-op even if unused
  destroy: () => editorEl.remove()
};
```

`clearHighlights()` is **always required** even as a no-op — the
`matrix-highlight-controller` calls it on every pulse during playback.

### 3.16 Note-bars (plano-modular)

Colored rectangles inside `.plano-matrix` representing notes with explicit
duration. Used by App19, App20, App32–35.

```javascript
import { renderNoteBars } from '../../libs/app-common/plano-note-renderer.js';

renderNoteBars({
  matrixContainer: gridElements.matrixContainer,
  notes,                         // array of {note, startSubdiv, duration, isRest}
  cellWidth,                      // computed from DOM (1fr column)
  noteCount: 12,
  colors: ['#bdd9e6'],            // single blue for all notes (Nuzic style)
  onClickNote: removeNote
});
```

**CSS** (per app):

```css
.note-bar {
  position: absolute;
  border-radius: 0.25rem;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.1s ease, box-shadow 0.1s ease;
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.2);
}

.note-bar:hover {
  transform: scale(1.02);
  box-shadow: 0 0.1875rem 0.5rem rgba(0, 0, 0, 0.3);
}

/* Highlight during playback: bright blue + glow */
.note-bar.highlight {
  background: var(--nuzic-blue) !important;
  box-shadow: 0 0 0.75rem var(--nuzic-blue);
}

/* iT label is shown via halter below the bar — hide the in-bar label */
.note-bar__label { display: none; }
```

**Halter under each note-bar** (function called after `renderNoteBars`):

```javascript
function renderNoteHalters() {
  const matrix = gridElements.matrixContainer.querySelector('.plano-matrix');
  if (!matrix) return;
  matrix.querySelectorAll('.note-halter').forEach(el => el.remove());

  const firstCell = matrix.querySelector('.plano-cell');
  const cellH = firstCell?.offsetHeight || 32;
  const matrixWidth = matrix.offsetWidth;

  notes.forEach((noteData) => {
    if (noteData.isRest) return;
    const startPx = noteData.startSubdiv * cellWidth;
    const widthPx = noteData.duration * cellWidth;
    const startPercent = (startPx / matrixWidth) * 100;
    const widthPercent = (widthPx / matrixWidth) * 100;

    const rowIndex = (NOTE_COUNT - 1) - noteData.note;
    const barHeight = cellH - 2;
    const barTop = (rowIndex + 1) * cellH - barHeight / 2;
    const halterTop = barTop + barHeight;

    const halter = createIntervalLabelBar({
      startPercent,
      widthPercent,
      label: noteData.duration,
      variant: 'solid'
    });
    halter.classList.add('note-halter');
    halter.style.top = `${halterTop}px`;
    matrix.appendChild(halter);
  });
}
```

### 3.17 Playhead Controller

Vertical line indicator that follows playback through the columns.

```javascript
import { createPlayheadController } from '../../libs/plano-modular/plano-playhead.js';

playheadController = createPlayheadController(
  gridElements.matrixContainer,
  () => 0,        // getCellWidth: 0 triggers DOM-based positioning (1fr cols)
  0,              // offset (always 0 for nuzic)
  -1              // domOffset: -1 px so playhead sits exactly on pulse-number x
);

// Cancel the default `marginLeft: -4px` from createPlayhead (legacy)
const playheadEl = gridElements.matrixContainer.querySelector('.plano-playhead');
if (playheadEl) playheadEl.style.marginLeft = '0';
```

**Playhead position formula**: `cell.offsetLeft + offset + domOffset` (when
`cellWidth === 0`, the DOM path is used). The `domOffset: -1` precisely
aligns the line with the pulse-number's center.

### 3.18 Ghost Pulse Dots (complex fractions)

For complex fractions (`n > 1`), some integer pulses don't land on
subdivision boundaries. These "ghost pulses" need a visible dot on each row.

**JS**:

```javascript
import { renderGhostPulseLines } from '../../libs/plano-fraccion/ghost-pulse.js';

renderGhostPulseLines(matrix, {
  lg: currentLg,
  numerator: currentNumerator,
  denominator: currentDenominator,
  cellWidth
});
```

**CSS** (the lib only creates the line elements; styling is per-app):

```css
body[data-visual="nuzic"].appNN .ghost-pulse-line {
  position: absolute;
  top: 0;
  bottom: calc(var(--plano-cell-height, 2rem) / 2 + 1.4rem);
  border-left: none !important;
  opacity: 1 !important;
  pointer-events: none;
  z-index: 11;              /* above .plano-cell (which is opaque) */
  width: 12px;              /* room for the dot, no clipping        */
  background-image: radial-gradient(
    circle 2px at 50% 50%,
    rgba(67, 67, 59, 0.68) 50%,
    transparent 51%
  );
  background-size: 100% var(--plano-cell-height, 2rem);
  background-position: 0 calc(var(--plano-cell-height, 2rem) / 2);
  background-repeat: repeat-y;
  transform: translateX(-50%);
}
```

### 3.19 Controls Row (compact)

Standard horizontal bar at the bottom of every Nuzic app:
`Play(48px)` + `BPM` + `Random(36px)` + `Reset(36px)`.

Auto-generated by `nuzic-theme.css` when `.controls` has no `data-layout`
attribute. JS just reorders children:

```javascript
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

---

### 3.20 Random Button + Long-Press Menu (`setupRandomMenu`)

**Filosofía Nuzic**: toda app interactiva con parámetros lleva un botón
de **aleatorización**. No es opcional — forma parte de la identidad
pedagógica: el usuario debe poder *escuchar un ejemplo* de cualquier
configuración sin tener que entender todos los parámetros primero. El
botón siempre va en la fila de controles (`Play · BPM · Random · Reset`)
y siempre acepta dos gestos:

- **Click corto** → genera valores aleatorios y reproduce automáticamente.
- **Long-press (≥500ms)** → abre un menú flotante donde el usuario acota
  los rangos del aleatorio (denominador máximo, número de notas, BPM
  min/max, etc.). Los rangos del menú son sub-conjuntos de los hard
  limits estructurales de la app — el usuario puede **estrechar** pero
  nunca exceder.

#### API: `setupRandomMenu({ spec, onRandomize })`

Helper declarativo en `libs/random/menu.js`. Reemplaza el patrón antiguo
(HTML del menú escrito a mano en `index.html` + lectura por `getElementById`
en `handleRandom`) con una sola llamada:

```javascript
import { setupRandomMenu } from '../../libs/random/menu.js';

const randomMenu = setupRandomMenu({
  spec: {
    denomMax: { label: 'Denominador máximo', min: 2, max: 8, default: 8 },
  },
  onRandomize: handleRandom,
});

function handleRandom() {
  const { denomMax } = randomMenu?.read() ?? { denomMax: MAX_DENOMINATOR };
  const d = Math.min(denomMax, MAX_DENOMINATOR);  // clamp to hard limit
  setFraction(randomInt(2, d));
  if (!isPlaying) playSequence();
}
```

`renderApp({ ..., randomMenuContent: '' })` — el helper **inyecta el HTML
del menú** dentro de `#randomMenu` después del título (`.random-menu-title`),
así que `randomMenuContent` debe quedar vacío.

Cada entrada del `spec` declara:

- `label` — texto visible al lado del input.
- `min` / `max` — atributos `min`/`max` del `<input type="number">`.
- `default` — valor inicial. También se usa como fallback si el input
  queda vacío o con valor inválido.
- `type: 'checkbox'` (opcional) — para flags booleanos. El `default` se
  interpreta como `checked` inicial.

`randomMenu.read()` devuelve un objeto con los valores actuales (con
`default` aplicado a inputs en blanco o inválidos). Llámalo dentro del
handler — los valores reflejan el estado vivo del menú.

#### Patrones de spec por familia de app

Cada family de app expone los parámetros que su `handleRandom` realmente
controla. El menú permite al usuario acotar, no agregar nuevos ejes.

| Family | Spec recomendado |
|---|---|
| Timeline simple (App9, App13) | `totalMax: { label: 'Longitud máxima', min: 1, max: MAX_LENGTH, default: MAX_LENGTH }` |
| Soundline vertical (App10, App14, App18) | `isCount: { label: 'Número de notas', min: 1, max: MAX_IS, default: 6 }` + `regMin/regMax` (si la app tiene registros) + `bpmMin/bpmMax` |
| Timeline + fracción simple (App26, App28, App30) | `denomMax: { label: 'Denominador máximo', min: 2, max: 8, default: 8 }` |
| Timeline + fracción compleja (App27, App29, App31) | `numMax: { label: 'Numerador máximo', min: 1, max: 6, default: 6 }` + `denomMax: { label: 'Denominador máximo', min: 2, max: 8, default: 8 }` |
| Plano 2D + fracción simple (App32, App34) | `denomMax` (+ opcionalmente notes range si es plano-modular multi-registro) |
| Plano 2D + fracción compleja (App33, App35) | `numMax` + `denomMax` |
| Registros + BPM (App18) | `regMin` + `regMax` + `notes` + `bpmMin` + `bpmMax` |

#### El handler `handleRandom`

Patrón canónico:

```javascript
function handleRandom() {
  if (isPlaying) return;  // ignorar mientras suena

  // 1. Leer valores del menú (con defaults seguros si el menú no existe).
  const { numMax, denomMax } = randomMenu?.read() ?? {
    numMax: MAX_NUMERATOR,
    denomMax: MAX_DENOMINATOR,
  };

  // 2. Clamp a hard limits — el menú nunca debe exceder los structural.
  const nMax = Math.min(numMax, MAX_NUMERATOR);
  const dMax = Math.min(denomMax, MAX_DENOMINATOR);

  // 3. Generar valores respetando invariantes (p.ej. gcd=1 para fracciones reducidas).
  let n, d;
  do {
    n = randomInt(1, nMax);
    d = randomInt(2, dMax);
  } while (gcd(n, d) !== 1);
  setFraction(n, d);

  // 4. Auto-play tras randomizar (consistente en todas las apps 9-35).
  if (!isPlaying) playSequence();
}
```

Los pasos 2 y 4 son obligatorios: clamp al hard limit y auto-play.

---

## 4. Composable Features

Features are **orthogonal**. Any combination is valid; pick the ones your app
needs. The recipe library (section 5) shows common combinations.

### 4.1 Plano 2D — Library Choice

Two libs implement the 2D grid. Choose based on the features required:

| Need | Use |
|---|---|
| Single registry, cell-selection | `musical-grid` |
| Multi-octave registers, scrollable | `plano-modular` |
| Note-bars with explicit duration | `plano-modular` |
| Drag-to-create notes | `plano-modular` |
| Fraction overlay (subdivisions, ghost pulses) | `plano-modular` |
| Degree (Nº) labels on Y axis | either (both support `labelFormatter`) |
| Compás header above | either |

Default to `plano-modular` unless the app is simple-cell-selection only.

### 4.2 Y-axis Labels — Note Names vs Degrees

The Y-axis can show:

- **N** (chromatic note names, 0–11): for apps without scale context.
- **Nº** (scale degree names, 0–N): for apps with scale-pill integration.

This is a labelFormatter option on the grid creator. Both libs support it.

```javascript
// Chromatic (N)
const grid = createApp19Grid({
  rows: 12,
  labelFormatter: (rowData) => rowData.note.toString(),
  ...
});

// Scale degrees (Nº)
const grid = createApp19Grid({
  rows: scaleLength,
  labelFormatter: (rowData) => `Nº${rowData.degree}`,
  ...
});
```

### 4.3 Registres (multi-octave)

Multiple registers stacked vertically, each containing a full Y-axis. Only
`plano-modular` supports this natively. Uses `createApp19Grid` with
`registries: [...]` config.

```javascript
const grid = createApp19Grid({
  columns: totalPulses,
  registries: [3, 4, 5],         // 3 registers, ids r3 r4 r5
  rowsPerRegistry: 12,
  ...
});
```

A registry spinner pill controls the focused registry; scroll syncs the
soundline ↔ matrix automatically.

### 4.4 Compás (Measure Header)

Optional rectangle above the timeline showing measure structure. Independent
of grid type — works for standalone timeline (App16/17), plano-2D, or any
other app.

See section 3.12 for code.

### 4.5 Fraction (None / Simple / Complex)

Three independent levels:

| Level | Numerator | Denominator | When |
|---|---|---|---|
| **None** | (no fraction) | — | Apps that work with whole pulses only |
| **Simple** | Fixed `1` | Editable 1–8 | Single-fraction display (1/d) |
| **Complex** | Editable 2–6 | Editable 2–8 | Polyrhythm-style fractions (n/d) |

The `createFractionEditor` JS handles all three. Pass `enableGhost: false`
for the simple variant to skip the DOM ghost-fraction (a reduction-animation
preview that's unused when n is fixed).

### 4.6 Note Rendering

Two patterns:

- **Cell-selection**: clicking a cell toggles a single note. Used by
  `musical-grid` apps. Simpler, but no duration.
- **Note-bars with duration**: drag from one cell to another to create a bar
  spanning multiple subdivisions. Used by `plano-modular` apps. More
  expressive.

Adding **halters** under note-bars: see section 3.16. Strongly recommended
for plano-2D apps with `plano-modular`.

### 4.7 Editors (cell-based + zigzag)

Pluggable below the timeline / grid. Pick based on user input shape:

| Editor | Input shape | Output | Example apps |
|---|---|---|---|
| **Pfr** (cell-based) | "N" or "N.M" tokens | selectedPulses set | App28, App29 |
| **iTfr** (cell-based) | iT values (durations) | itSequence array | App30, App31 |
| **N-P** (cell-based) | N + P pairs | currentPairs | App12 |
| **N-iT** (zigzag) | N + iT pairs | entries[] | App20, App34, App35 |
| **iS-iT** (zigzag) | iS + iT pairs | currentIntervals | App14, App15 |
| **Degree** (cell-based) | iSº values | degree sequence | App25, App25B |

Editors are mostly stand-alone modules. The app's `main.js` wires their
output to the grid/timeline state via callbacks (e.g. `onPairsChange`,
`syncGridFromPairs`).

---

### 4.8 Random Parameters (mandatory feature)

Every Nuzic app with interactive parameters exposes a **randomization
button** in the controls row. This is a structural feature, not an
optional add-on — see §3.20 for the API. What changes per app is *which
parameters* the long-press menu exposes.

The parameters are derived from what the app's `handleRandom` actually
mutates. Cross-reference table:

| Feature in the app | Random param exposed in the menu |
|---|---|
| Plain timeline length | `totalMax` |
| Soundline note count | `isCount` (or `notes`) |
| Multi-octave registers | `regMin` + `regMax` |
| Tempo (BPM) | `bpmMin` + `bpmMax` |
| Simple fraction | `denomMax` |
| Complex fraction | `numMax` + `denomMax` |
| Scale degrees | `degreeMax` (when relevant) |
| Pulses-per-measure (compás) | `compasMax` |

**Composition rule**: an app that combines features composes parameters.
A plano-2D app with complex fraction *and* multi-registers exposes
`numMax + denomMax + regMin + regMax`. The user can narrow any axis
independently.

**Hard limits**: the `default` of each `min/max` pair should equal the
app's `MAX_*` structural constant. The menu lets the user **lower** the
default, never raise it. Inside `handleRandom`, always clamp:
`const x = Math.min(menuValue, HARD_MAX)`.

---

## 5. Recipe Library

Each recipe is a paste-ready skeleton. Combine features as needed.

### Recipe 1 — Timeline Horitzontal Simple

App without fraction, just a horizontal pulse sequence (like App11).

**index.html**:

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Mi App</title>
  <script src="../../libs/app-common/embed-mode.js"></script>
  <link rel="stylesheet" href="../../libs/shared-ui/index.css" />
  <link rel="stylesheet" href="../../libs/app-common/styles.css" />
  <link rel="stylesheet" href="../../libs/shared-ui/bpm-inline.css" />
  <link rel="stylesheet" href="../../libs/shared-ui/nuzic-theme.css" />
  <link rel="stylesheet" href="styles.css" />
  <link rel="stylesheet" href="../../libs/app-common/embed.css" />
</head>
<body class="myapp" data-theme="light" data-visual="nuzic">
  <div id="app-root"></div>
  <script type="module">
    import { initHeader } from '../../libs/shared-ui/header.js';
    import { renderApp } from '../../libs/app-common/template.js';

    renderApp({
      root: document.getElementById('app-root'),
      title: 'Mi App',
      pulseSequence: false,
      showAccent: false,
      hideLeds: true,
      hideT: false,
      randomMenuContent: ''
    });

    initHeader();
    import('./main.js');
  </script>
</body>
</html>
```

**styles.css**:

```css
body.myapp {
  --myapp-endcap-w: clamp(1.875rem, 5.25vw, 5rem);
  --myapp-endcap-h: clamp(3.8rem, 4vw, 4.75rem);
}

.inputs { display: none !important; }

.timeline-wrapper {
  width: auto !important;
  margin: 0.5rem var(--myapp-endcap-w) 0.75rem var(--myapp-endcap-w);
  position: relative;
}

.timeline {
  position: relative;
  margin-top: 0.75rem;
}

/* Yellow endcaps + cream-yellow gradient */
body[data-visual="nuzic"].myapp
  .timeline-wrapper:has(.timeline):not(:has(.soundline-container))
  .timeline {
  background:
    linear-gradient(
      to bottom,
      var(--nuzic-yellow-light) 0,
      var(--nuzic-yellow-light) 70%,
      var(--nuzic-yellow) 70%,
      var(--nuzic-yellow) 93%,
      var(--nuzic-yellow-light) 93%,
      var(--nuzic-yellow-light) 100%
    );
}

body[data-visual="nuzic"].myapp
  .timeline-wrapper:has(.timeline):not(:has(.soundline-container))
  .timeline::before,
body[data-visual="nuzic"].myapp
  .timeline-wrapper:has(.timeline):not(:has(.soundline-container))
  .timeline::after {
  content: '';
  display: block;
  position: absolute;
  inset: auto;
  opacity: 1;
  border: 0;
  top: 0%;
  width: var(--myapp-endcap-w);
  height: var(--myapp-endcap-h);
  background: var(--nuzic-yellow);
  border-radius: 4px;
  z-index: 0;
  pointer-events: none;
}

.timeline::before { left: 0;  transform: translateX(calc(-100% - 1.25rem)); }
.timeline::after  { right: 0; transform: translateX(calc(100% + 1.25rem)); }
```

**main.js**:

```javascript
import { bindRhythmElements } from '../../libs/app-common/dom.js';
import { createRhythmAudioInitializer } from '../../libs/app-common/audio-init.js';
import { createBpmController } from '../../libs/app-common/bpm-controller.js';
import { createSimpleHighlightController } from '../../libs/app-common/visual-sync.js';

let audio = null, isPlaying = false, bpmController = null;
let pulses = [];

const { elements, leds } = bindRhythmElements({ appId: 'myapp' });
const initAudio = createRhythmAudioInitializer({ defaultBpm: 60 });

function renderTimeline() {
  const timeline = document.getElementById('timeline');
  timeline.innerHTML = '';
  pulses = [];
  for (let i = 0; i <= 8; i++) {
    const num = document.createElement('div');
    num.className = 'pulse-number';
    num.dataset.index = i;
    num.textContent = i;
    num.style.left = `${(i / 8) * 100}%`;
    timeline.appendChild(num);
    pulses.push(num);
  }
}

renderTimeline();
```

### Recipe 2 — Timeline + Compás

Adds a measure header above the timeline. Use for apps that organize pulses
into measures (App16/17 style).

```javascript
import { createMeasureHeader } from '../../libs/shared-ui/measure-header.js';

const headerEl = document.querySelector('.measure-header-slot');
const measureHeader = createMeasureHeader({
  container: headerEl,
  labelText: 'Compás'
});

// Set columns by updating CSS variables
document.body.style.setProperty('--com-band-w', '4rem');
document.body.style.setProperty('--measure-count', '4');
```

CSS:

```css
.timeline { padding-left: var(--com-band-w); box-sizing: border-box; }
.timeline::before {
  /* App16 variant: left endcap as the 'Com.' block, not the standard yellow */
  display: block;
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  width: var(--com-band-w);
  height: var(--myapp-endcap-h);
  background: var(--nuzic-yellow);
  border-radius: 4px 0 0 4px;
}
```

### Recipe 3 — Timeline + Simple Fraction

Adds a simple-fraction editor (1/d) in `.middle` above the timeline.

`index.html` adds in renderApp config:

```javascript
renderApp({
  ...
  pulseSequence: false,
  // (no special options; .middle is default present)
});
```

**styles.css** adds (in addition to Recipe 1):

```css
/* .middle: fraction left + (optional info pills right) */
body[data-visual="nuzic"] .middle.myapp-middle {
  display: block !important;
  position: relative;
  margin: 0 var(--myapp-endcap-w) 5px var(--myapp-endcap-w);
  /* width: auto so the box doesn't overflow with margin */
}

.fraction-editor-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0;
}

.fraction-editor {
  position: relative;
  left: calc(0px - var(--myapp-endcap-w));
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  gap: 0.2rem;
  width: var(--myapp-endcap-w);
  box-sizing: border-box;
  padding: 0.5rem 0;
  border: 3px solid var(--nuzic-yellow);
  border-radius: 0.4rem;
  color: #000;
}

.fraction-editor .top {
  border-bottom: 4px solid #000;
  width: 65%;
  margin: 0 auto;
}

.fraction-editor input {
  width: 100%;
  text-align: center;
  font-size: clamp(1.75rem, 3.8vw, 2.7rem);
  background: none;
  border: none;
  color: #000 !important;
  font-weight: 900;
}

.fraction-editor input:disabled,
.fraction-editor input:read-only {
  opacity: 1 !important;
  cursor: default !important;
}

/* See section 3.9 for full spinner pill CSS */
```

**main.js** adds:

```javascript
import createFractionEditor from '../../libs/app-common/fraction-editor.js';
import { addRepeatPress } from '../../libs/app-common/spinner-repeat.js';

const middle = document.querySelector('.middle');
middle.classList.add('myapp-middle');
middle.innerHTML = '';

const fractionSlot = document.createElement('div');
middle.appendChild(fractionSlot);

const controller = createFractionEditor({
  mode: 'block',
  host: fractionSlot,
  defaults: { numerator: 1, denominator: 2 },
  startEmpty: false,
  maxDenominator: 8,
  enableGhost: false,
  addRepeatPress,
  onChange: ({ cause }) => {
    if (cause !== 'init') {
      handleFractionChange();
    }
  }
});
controller.setSimpleMode();
```

### Recipe 4 — Timeline + Pfr Editor (cell-based)

App28-style: simple fraction + a Pfr cell editor for selecting fractional
pulses ("0", "1.2", "3.1"...). See `Apps/App28/main.js` for the full
implementation. Skeleton:

```javascript
let selectedPulses = new Set();

function renderPfrEditor() {
  pfrCellsEl.innerHTML = '';
  const sorted = Array.from(selectedPulses).sort((a, b) => pulseTokenValue(a) - pulseTokenValue(b));
  sorted.forEach(token => {
    pfrCellsEl.appendChild(createPfrValueCell(token));
    pfrCellsEl.appendChild(createPfrSeparatorCell());
  });
  pfrCellsEl.appendChild(createPfrInputCell());
  pfrCellsEl.appendChild(createPfrSeparatorCell());
}
```

The active input commits a token on `Enter`/`Tab` or after a 1000 ms timer
for bare digits. Validation messages via
`showValidationWarning(editor, msg)`.

### Recipe 5 — Timeline + iTfr Editor + Halters

App30-style: simple fraction + cell editor for iT durations + colored
interval bars above the timeline + yellow halters under them.

```javascript
import { createIntervalLabelBar } from '../../libs/shared-ui/interval-label-bar.js';

function updateIntervalBars() {
  timeline.querySelectorAll('.interval-bar-visual, .interval-label-bar').forEach(el => el.remove());
  let currentPulse = 0;
  itSequence.forEach((item) => {
    if (item.isSilence) {
      currentPulse += item.it;
      return;
    }
    const startPercent = (currentPulse / TOTAL_PULSES) * 100;
    const widthPercent = (item.it / TOTAL_PULSES) * 100;

    const bar = document.createElement('div');
    bar.className = 'interval-bar-visual';
    bar.style.left = `${startPercent}%`;
    bar.style.width = `${widthPercent}%`;
    bar.style.background = item.color;
    timeline.appendChild(bar);

    const halter = createIntervalLabelBar({
      startPercent,
      widthPercent,
      label: item.it,
      variant: 'solid'
    });
    timeline.appendChild(halter);

    currentPulse += item.it;
  });
}
```

CSS:

```css
.interval-bar-visual {
  position: absolute;
  top: -3.3rem;
  height: 1.4rem;
  border-radius: 0;
  z-index: 5;
}
.interval-label-bar {
  top: -1.9rem;
}
```

### Recipe 6 — Timeline + Complex Fraction

Same as Recipe 3 but with editable numerator. Replace the `createFractionEditor` config:

```javascript
const controller = createFractionEditor({
  mode: 'block',
  host: fractionSlot,
  defaults: { numerator: 2, denominator: 3 },
  startEmpty: false,
  autoReduce: true,
  minNumerator: 2,
  maxNumerator: 6,
  minDenominator: 2,
  maxDenominator: 8,
  // NO enableGhost: false — ghost is needed for reduction animation
  addRepeatPress,
  onChange: ({ cause }) => {
    if (cause !== 'init') handleFractionChange();
  }
});
controller.setComplexMode();
```

**CSS additions** for complex (override Recipe 3 simple-fraction):

```css
.fraction-editor-wrapper {
  /* CRITICAL: gap:0 prevents ghost from capturing default flex gap */
  gap: 0;
}

.fraction-editor .top {
  position: relative;
  width: 100%;
  margin: 0;
  padding-bottom: 4px;
  border-bottom: none;       /* replaced by pseudo-element */
}

.fraction-editor .top::after {
  content: '';
  position: absolute;
  left: 17.5%;
  right: 17.5%;
  bottom: 0;
  height: 4px;
  background: #000;
}
```

**Math adaptations** when working with complex fractions:

```javascript
// In renderGridTimeline (and similar):
const positionNumerator = colIdx * n;
const isIntegerPulse = positionNumerator % d === 0;
const pulseIndex = positionNumerator / d;

// In note-bar position calculations:
const startPos = (noteData.startSubdiv * n) / d;
const endPos = ((noteData.startSubdiv + noteData.duration) * n) / d;

// Audio config (do NOT scale baseResolution by n):
const baseResolution = d;
const scaledInterval = (60 / bpm) / d;
const scaledTotal = lg * d;
```

### Recipe 7 — Soundline Vertical (Standalone)

App10/14/18-style. A vertical sound line on the left side of the viewport.

**DOM** (generated by JS, mounted in `app-root > main`):

```html
<div class="soundline-container">
  <div class="soundline">
    <!-- .soundline-number elements positioned absolute -->
  </div>
</div>
```

**CSS**:

```css
.soundline-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.soundline {
  position: relative;
  background: var(--nuzic-pink-light);
  width: clamp(3rem, 8vw, 5rem);
  height: 80vh;
  max-height: 700px;
}

.soundline-number {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-weight: 700;
  font-size: clamp(0.7rem, 1.4vw, 1.2rem);
  color: var(--nuzic-dark);
}

body[data-visual="nuzic"] .soundline-number::before { content: '\2013\2002'; }
body[data-visual="nuzic"] .soundline-number::after  { content: '\2002\2013'; }
```

JS positions each note at its respective percentage from the top.

### Recipe 8 — Soundline + Scale Pill

Recipe 7 + a scale-pill dropdown in `.inputs`. The pill drives an `onChange`
that recomputes the visible scale degrees.

```javascript
import { createScalePill } from '../../libs/app-common/scale-pill.js';

createScalePill({
  scales: APP_SCALES,
  initial: 'DIAT-0',
  onChange: (scale) => {
    currentScale = scale;
    rebuildSoundline();
  }
});
```

Add `--nuzic-spin-bg: var(--nuzic-pink)` to `body.myapp` for the pink
spinner identity color.

### Recipe 9 — Plano 2D (musical-grid)

App12/App25 style. Use when you need cell-selection in a single-registry
grid with degree/note labels.

```javascript
import { createMusicalGrid } from '../../libs/musical-grid/index.js';
import { createMatrixHighlightController } from '../../libs/app-common/matrix-highlight-controller.js';

const grid = createMusicalGrid({
  parent: document.getElementById('gridContainer'),
  columns: totalPulses,
  rows: 12,
  cellSelectionMode: 'single',
  labelFormatter: (rowData) => rowData.note.toString(),
  onCellToggle: (cellId, selected) => handleCellChange(cellId, selected)
});

const highlightController = createMatrixHighlightController({
  getCells: () => grid.getCells(),
});
```

```html
<link rel="stylesheet" href="../../libs/musical-grid/musical-grid.css" />
```

CSS (Nuzic look applies via `body[data-visual="nuzic"]`).

### Recipe 10 — Plano 2D (plano-modular)

App19/App20/App32-35 style. Use when you need note-bars, multi-registry, or
drag-to-create.

```html
<link rel="stylesheet" href="../../libs/plano-modular/plano-modular.css" />
<link rel="stylesheet" href="../../libs/shared-ui/interval-label-bar.css" />
```

```javascript
import { buildGridDOM, updateSoundline, updateMatrix } from '../../libs/plano-modular/plano-grid.js';
import { createPlayheadController } from '../../libs/plano-modular/plano-playhead.js';
import { setupScrollSync } from '../../libs/plano-modular/plano-scroll.js';
import { renderNoteBars } from '../../libs/app-common/plano-note-renderer.js';

let gridElements = buildGridDOM(document.getElementById('gridContainer'));

const NOTE_COUNT = 12;
let notes = [];           // [{note, startSubdiv, duration, isRest}]
let cellWidth = 0;

function renderGrid() {
  const columns = totalSubdivisions;
  const rows = buildSimple12Rows();

  updateSoundline(gridElements.soundlineContainer, rows);
  updateMatrix(gridElements.matrixContainer, rows, columns);
  renderGridTimeline();
  cellWidth = calculateCellWidth();
  renderNotes();
}

function renderNotes() {
  renderNoteBars({
    matrixContainer: gridElements.matrixContainer,
    notes,
    cellWidth,
    noteCount: NOTE_COUNT,
    colors: ['#bdd9e6'],     // single blue
    onClickNote: removeNote
  });
  renderNoteHalters();        // see section 3.16
}

playheadController = createPlayheadController(
  gridElements.matrixContainer,
  () => 0,
  0,
  -1
);

const playheadEl = gridElements.matrixContainer.querySelector('.plano-playhead');
if (playheadEl) playheadEl.style.marginLeft = '0';
```

CSS (per app, additions on top of plano-modular base): see section 3.4–3.8
for triangle corner, endcaps, padding overrides.

### Recipe 11 — Plano 2D + Multi-Registers

Recipe 10 with explicit registries. The grid creator handles soundline,
matrix, and scroll sync automatically.

```javascript
import { createApp19Grid } from '../../libs/plano-modular/index.js';

grid = createApp19Grid({
  parent: document.getElementById('gridContainer'),
  columns: totalPulses,
  rowsPerRegistry: 12,
  registries: [3, 4, 5],
  initialRegistry: 4,
  columnSizing: 'fr',       // 1fr columns fill horizontal width
  playheadOffset: 0,         // or 7 for legacy alignment
  onSelectCell: (cellId, col) => handleCellSelection(cellId, col)
});
```

Register spinner pill (similar to BPM pill but for selecting current
registry):

```html
<div class="param registro" id="registroParam">
  <span class="abbr">Registro</span>
  <div class="circle">
    <input id="inputRegistro" type="number" min="3" max="5" />
    <div class="spinner">
      <button class="spin up"></button>
      <button class="spin down"></button>
    </div>
  </div>
</div>
```

### Recipe 12 — Plano 2D + Fraction

Recipe 10 + the fraction editor + corner triangle + ghost-pulse dots
(complex).

This is the canonical pattern of App32-35. Code is the union of Recipes 3
(or 6 for complex), section 3.7 (triangle corner), section 3.18 (ghost
dots), and sections 3.6/3.10/3.16 (endcap dret, info pills, halters).

### Recipe 13 — Add Random Menu to Any App

Every Nuzic app must include this. The full skeleton:

**1. `index.html`** — leave `randomMenuContent` empty in `renderApp`:

```javascript
renderApp({
  root: document.getElementById('app-root'),
  // ... other options
  randomMenuContent: ''   // setupRandomMenu inyectará el HTML
});
```

**2. `main.js`** — import + setup + handler:

```javascript
import { setupRandomMenu } from '../../libs/random/menu.js';
import { randomInt, gcd } from '../../libs/app-common/number-utils.js';

const MAX_NUMERATOR = 6;
const MAX_DENOMINATOR = 8;

let randomMenu = null;

function init() {
  // ... resto de inicialización
  randomMenu = setupRandomMenu({
    spec: {
      numMax:   { label: 'Numerador máximo',   min: 1, max: MAX_NUMERATOR,   default: MAX_NUMERATOR },
      denomMax: { label: 'Denominador máximo', min: 2, max: MAX_DENOMINATOR, default: MAX_DENOMINATOR },
    },
    onRandomize: handleRandom,
  });
}

function handleRandom() {
  if (isPlaying) return;

  const { numMax, denomMax } = randomMenu?.read() ?? {
    numMax: MAX_NUMERATOR,
    denomMax: MAX_DENOMINATOR,
  };
  const nMax = Math.min(numMax, MAX_NUMERATOR);
  const dMax = Math.min(denomMax, MAX_DENOMINATOR);

  let n, d;
  do {
    n = randomInt(1, nMax);
    d = randomInt(2, dMax);
  } while (gcd(n, d) !== 1);
  setFraction(n, d);

  if (!isPlaying) playSequence();   // auto-play tras randomizar
}
```

**3. Anti-patterns** — NUNCA hagas esto:

```javascript
// ❌ MAL: listener directo duplicado (longpress dispara random Y abre menú).
randomBtn.addEventListener('click', handleRandom);
setupRandomMenu({ spec, onRandomize: handleRandom });

// ❌ MAL: omitir el clamp con MAX_*. El usuario podría haber editado el HTML.
const { denomMax } = randomMenu.read();
setFraction(randomInt(2, denomMax));  // sin Math.min(denomMax, MAX_DENOMINATOR)

// ❌ MAL: HTML escrito a mano en randomMenuContent.
renderApp({ randomMenuContent: '<label>...<input id="rand_denomMax">...</label>' });
```

`setupRandomMenu` ya gestiona el shortpress (random) y el longpress (menú)
con un único par de listeners pointerdown/pointerup. Es la fuente única
de verdad.

### Cross-Recipe: Combining Features

The recipes above cover the most common combinations. For non-standard
combinations, follow these rules:

1. **Library choice**: pick `plano-modular` if you need any of: registers,
   note-bars, fraction overlay, drag-to-create. Otherwise `musical-grid`.

2. **Feature stacking order in CSS**:
   - Base lib CSS first (`plano-modular.css` or `musical-grid.css`).
   - Component shared CSS (`interval-label-bar.css`, `bpm-inline.css`).
   - Nuzic theme (`nuzic-theme.css`).
   - Per-app overrides (`styles.css`).

3. **Feature stacking order in JS init**:
   - BPM controller.
   - `buildMiddleLayout()` — creates fraction slot and info pill containers.
   - `initFractionEditorController()` — uses the fraction slot.
   - `createGrid()` — inserts grid container.
   - Reorder `.controls` row.
   - Move controls below the grid.

4. **Always include null-safe audio guards**:

```javascript
async function initAudio() {
  if (!audio) {
    audio = await _baseInitAudio();
    if (audio && typeof audio.setMute === 'function') audio.setMute(savedMute);
    if (audio && baseSoundSelect?.dataset?.value && typeof audio.setBase === 'function') {
      await audio.setBase(baseSoundSelect.dataset.value);
    }
    if (audio && cycleSoundSelect?.dataset?.value && typeof audio.setCycle === 'function') {
      await audio.setCycle(cycleSoundSelect.dataset.value);
    }
  }
  return audio;
}
```

5. **Always add `clearHighlights()`** to your editor API (even as a no-op).
   The matrix-highlight-controller depends on it.

---

## 6. Pitfalls & Solutions

Each pitfall: **Symptom** / **Cause** / **Fix** / **Why**.

### Pitfall 1 — Fraction box doesn't align with left endcap

- **Symptom**: The yellow fraction rectangle appears shifted ~18 px to the right of the timeline's left endcap.
- **Cause**: `createFractionEditor` with `autoReduce: true` always creates a ghost-fraction DOM element. It's invisible (`width ≈ 0`), but it's a flex-item in the wrapper. The default `gap: 1.125rem` of `.fraction-editor-wrapper` gets captured by the ghost, pushing the visible fraction 1.125 rem to the right.
- **Fix**: `.fraction-editor-wrapper { gap: 0; }`.
- **Why**: With `gap: 0`, the ghost still exists but doesn't claim flex spacing.

### Pitfall 2 — Both fraction spinners not aligned at same x (complex)

- **Symptom**: In complex variant, the numerator's spinner pill sits inside the editor while the denominator's projects outside on the right.
- **Cause**: `.fraction-editor .top { width: 65%; border-bottom: 4px solid }` constrains the numerator's `.fraction-field` to 65% of editor width. Its spinner projects to `82.5% + 0.45rem`, still inside the editor box. The denominator's `.bottom` is 100% width, so its spinner projects to `100% + 0.45rem`.
- **Fix**: Use a `::after` pseudo-element for the bar:

```css
.fraction-editor .top {
  position: relative;
  width: 100%;
  padding-bottom: 4px;
  border-bottom: none;
}
.fraction-editor .top::after {
  content: '';
  position: absolute;
  left: 17.5%;
  right: 17.5%;
  bottom: 0;
  height: 4px;
  background: #000;
}
```

- **Why**: The pseudo-element draws a narrow visual bar without constraining the parent's width.

### Pitfall 3 — Endcap appears at left instead of right

- **Symptom**: `.timeline::after` (right endcap) appears stacked with `.timeline::before` at the left.
- **Cause**: `libs/app-common/styles.css:328` sets `inset: 0; opacity: 0; border: 2px solid; border-radius: 50%` on `.timeline::after` for the invisible circular-mode ring. `right: 0` is ignored because `inset: 0` already constrains both sides.
- **Fix**: Always include in your custom endcap rule:

```css
.timeline::after {
  inset: auto;
  opacity: 1;
  border: 0;
  /* ...then your normal properties */
}
```

### Pitfall 4 — `.pulse-number` ticks at wrong y (plano-2D)

- **Symptom**: The `|` ticks above and below pulse-numbers appear at unexpected positions in a plano-2D app.
- **Cause**: `nuzic-theme.css` defines `.plano-timeline-number::before/::after` with `top: 20%` and various offsets intended for the standalone-timeline visual. In plano-2D the timeline-row has a different height and the `top: 20%` calc doesn't match.
- **Fix**: Redefine the ticks explicitly per app:

```css
body[data-visual="nuzic"].appNN .plano-timeline-number::before {
  top: auto;
  bottom: 100%;
  left: 50%;
  height: clamp(0.5rem, 1vw, 0.75rem);
  transform: translateX(-50%);
  margin-bottom: clamp(0.2rem, 0.5vw, 0.35rem);
}
body[data-visual="nuzic"].appNN .plano-timeline-number::after {
  top: 100%;
  bottom: auto;
  left: 50%;
  height: clamp(0.5rem, 1vw, 0.75rem);
  transform: translateX(-50%);
  margin-top: clamp(0.2rem, 0.5vw, 0.35rem);
}
```

### Pitfall 5 — Plano-2D: gap between matrix and timeline

- **Symptom**: A 16 px visual gap appears between the bottom of the plano matrix (or the `-0-` text of the soundline) and the timeline-row.
- **Cause**: `.plano-soundline-row` and `.plano-matrix` have `padding-bottom: cellHeight/2` to reserve space for the `-0-` (via `translateY(50%)`) and row-0 note-bars. This padding sits *inside* the matrix box but doesn't extend the visible content.
- **Fix**: Pull the timeline-container and the corner up by `cellHeight/2`:

```css
body[data-visual="nuzic"].appNN .plano-container::before,
body[data-visual="nuzic"].appNN .plano-timeline-container {
  margin-top: calc(-1 * var(--plano-cell-height, 32px) / 2) !important;
}
```

### Pitfall 6 — Ghost-pulse dots invisible

- **Symptom**: In a complex-fraction plano-2D app, the ghost-pulse-line elements (between integer pulses on the matrix) don't display.
- **Cause**: Multiple possible causes:
  1. `z-index: 1` → `.plano-cell` (with opaque background) covers them.
  2. `width: 3px` + `radial-gradient` circle of 3px diameter → clipped to invisible by background-clip.
  3. `background-image: radial-gradient(circle at 50% 100%)` → bottom half of dot falls outside tile.
- **Fix**: Apply all three:

```css
body[data-visual="nuzic"].appNN .ghost-pulse-line {
  z-index: 11;                                          /* above .plano-cell */
  width: 12px;                                          /* room around dot */
  background-image: radial-gradient(
    circle 2px at 50% 50%,                              /* dot at center */
    rgba(67, 67, 59, 0.68) 50%,
    transparent 51%
  );
  background-size: 100% var(--plano-cell-height, 2rem);
  background-position: 0 calc(var(--plano-cell-height, 2rem) / 2);
  background-repeat: repeat-y;
  /* ...rest of properties from section 3.18 */
}
```

### Pitfall 7 — Editor cells rectangular (plano-2D nit-editor)

- **Symptom**: nit-editor cells appear as 48 × 32 px rectangles instead of squares.
- **Cause**: `.nit-editor-bar { height: 2rem }` (= 32 px) + `align-items: stretch` forces cells to 32 px height, overriding their `aspect-ratio: 1`.
- **Fix**: Remove `height: 2rem` from `.nit-editor-bar`:

```css
.nit-editor-bar {
  display: flex;
  align-items: stretch;
  /* No `height` — cells determine height via aspect-ratio: 1 */
}
```

### Pitfall 8 — Specificity wars with nuzic-theme.css

- **Symptom**: Per-app CSS rules silently fail to override `nuzic-theme.css` defaults for `.bpm-inline .abbr`, `.param .circle`, etc.
- **Cause**: `nuzic-theme.css` rules use `!important` with selectors like `body[data-visual="nuzic"] .param:not(.param--large):has(.circle > input) .abbr` (specificity ≈ 0,5,3) and load AFTER the per-app CSS, so order favors the theme.
- **Fix**: Use longer selector chains plus `!important`:

```css
body[data-visual="nuzic"].appNN .my-group .bpm-inline.visible.param.kind .abbr,
body[data-visual="nuzic"].appNN .my-group .bpm-inline.visible.param.kind .abbr {
  font-size: ... !important;
  /* ... */
}
```

Two `.bpm-inline.visible` extra classes give specificity ≈ (0,7,3), winning regardless of order.

### Pitfall 9 — Audio null-safety

- **Symptom**: `Uncaught TypeError: Cannot read properties of null (reading 'setBase')`.
- **Cause**: `await _baseInitAudio()` returns `null` on silent failure (Tone.js fails to load, melodic-audio.js dynamic import fails, etc.). The subsequent `typeof audio.setBase === 'function'` accesses `audio.setBase` BEFORE the `typeof` check, throwing on null.
- **Fix**: Always guard with `audio &&`:

```javascript
if (audio && savedMute === '1' && typeof audio.setMute === 'function') {
  audio.setMute(true);
}
if (audio && baseSoundSelect?.dataset?.value && typeof audio.setBase === 'function') {
  await audio.setBase(baseSoundSelect.dataset.value);
}
```

### Pitfall 10 — `.timeline { margin: 20px auto }` offset

- **Symptom**: An element positioned with `left: -W` relative to `.middle` (or `.timeline-wrapper`) is 1.25 rem (20 px) further left than expected.
- **Cause**: `.timeline` has `width: calc(100% - 40px); margin: 20px auto` (from `app-common/styles.css:305`). The element's `.left` edge is 1.25 rem (20 px) to the RIGHT of its wrapper's `.left` edge.
- **Fix**: When converting from `.timeline` coordinates to `.middle`/`wrapper` coordinates, subtract or add 1.25 rem as needed. For example: in standalone-timeline apps, the fraction's `left: calc(-W)` is correct (the `+ 1.25rem` from the cream extension is already baked into the endcap's `translateX(-100% - 1.25rem)`).

### Pitfall 11 — `clearHighlights()` missing breaks playback

- **Symptom**: Play/stop button icon doesn't toggle; no playback highlight shown.
- **Cause**: The `matrix-highlight-controller` calls `editor.clearHighlights()` on every pulse. If the editor's API doesn't include this method, it throws and silently breaks the highlight loop.
- **Fix**: Always export `clearHighlights` even as a no-op:

```javascript
editor = {
  getPairs: () => [...],
  setPairs: (pairs) => { ... },
  clear: () => { ... },
  clearHighlights: () => {},       /* REQUIRED — even empty */
  destroy: () => editorEl.remove()
};
```

### Pitfall 12 — Import collision with existing function

- **Symptom**: `Uncaught SyntaxError: Identifier 'X' has already been declared`.
- **Cause**: The app already has a local `function X()` or `const X = ...` and an import is added that names the same symbol.
- **Fix**: Before adding any new import, `grep` for the symbol:

```bash
grep -nE "function NAME|const NAME =" Apps/AppNN/main.js
```

Rename the local function to `createXxxMarkup()` (or similar) if it just generates HTML.

### Pitfall 13 — `@import` duplicated with `<link>`

- **Symptom**: Some styles load twice with confusing cascade order.
- **Cause**: `styles.css` has `@import url('lib/X.css')` AND `index.html` has `<link rel="stylesheet" href="lib/X.css">`.
- **Fix**: Remove the `@import`; keep only the `<link>`.

### Pitfall 14 — `data-theme="system"` produces inconsistent visual

- **Symptom**: App appearance depends on the user's OS theme preference, breaking visual consistency.
- **Cause**: `<body data-theme="system">` follows OS preference.
- **Fix**: Always use `<body data-theme="light">`. The header menu still allows manual switch to dark, but the default is consistent.

### Pitfall 15 — `pulse-highlight.css` `@import` causes wrong highlight color

- **Symptom**: Active pulses appear blue or with rendering glitches; nuzic golden highlight doesn't show.
- **Cause**: `pulse-highlight.css` defines `.pulse.active`, `.pulse-number.active` styles that conflict with nuzic-theme's golden-bar style.
- **Fix**: Remove `@import 'pulse-highlight.css'` from the app's CSS if present. The nuzic-theme handles highlighting via its own selectors.

### Pitfall 16 — Endpoint click pulse is audible

- **Symptom**: The "Lg" endpoint pulse (the `·` marker after the last integer pulse) plays a click sound.
- **Cause**: The metronome schedules at every pulse including the endpoint.
- **Fix**: Mute the `pulse` channel for the endpoint step:

```javascript
let endpointPulseMuted = false;
let endpointPulseMuteWasMuted = false;

function restoreEndpointPulseMute() {
  if (endpointPulseMuted) {
    setChannelMute('pulse', endpointPulseMuteWasMuted);
    endpointPulseMuted = false;
  }
}

// In onSchedule(scaledIndex):
if (scaledIndex === patternBeats) {           /* patternBeats = lg * d */
  endpointPulseMuteWasMuted = isChannelMuted('pulse');
  setChannelMute('pulse', true);
  endpointPulseMuted = true;
}
```

Setup: `scaledTotal = lg * d + 1`, `patternBeats = lg * d`.

### Pitfall 17 — `min-height: max-content` collapses `1fr` columns

- **Symptom**: With `columnSizing: 'fr'` and many subdivisions (e.g. d=8 → 96 columns), the matrix and timeline-row disagree on total width.
- **Cause**: `plano-modular.css` sets `min-width: max-content` on `.plano-matrix` and `.plano-timeline-row`. With `1fr` columns, `max-content` expands beyond viewport.
- **Fix**: Override:

```css
.plano-matrix-container,
.plano-matrix,
.plano-timeline-row {
  width: 100% !important;
  min-width: 0 !important;
  max-width: 100% !important;
}
.plano-matrix,
.plano-timeline-row {
  margin-left: 0 !important;
}
```

### Pitfall 18 — Tooltips duplicated (infoTooltip + local showTooltip)

- **Symptom**: Two tooltips appear (one styled, one unstyled) for the same validation event.
- **Cause**: The app uses both `infoTooltip` from `libs/app-common` and a local `showTooltip()` function with its own CSS class.
- **Fix**: Pick one. Recommended: delegate to `infoTooltip.show()`:

```javascript
function showError(cell, msg) {
  infoTooltip.show(msg, cell);
}
```

Remove the local `.appNN-tooltip` CSS.

### Pitfall 19 — `container-type` breaks `position: absolute` children

- **Symptom**: Absolutely positioned numbers or labels collapse to a single column.
- **Cause**: A parent with `container-type: inline-size` becomes the containing block for `position: absolute` descendants, breaking their intended anchor.
- **Fix**: Do NOT use `container-type` on parents of components that rely on absolute positioning. Use viewport-relative units (`vw`) instead of container queries.

### Pitfall 20 — Audio context `InvalidAccessError`

- **Symptom**: First-time playback fails with `InvalidAccessError`.
- **Cause**: `new TimelineAudio()` runs before `await Tone.start()` after the user gesture, so the AudioContext is in an invalid state.
- **Fix**: Always await both:

```javascript
await ensureToneLoaded();           // waits for user interaction
if (typeof Tone !== 'undefined' && typeof Tone.start === 'function') {
  try { await Tone.start(); } catch (err) { /* may already be running */ }
}
const { MelodicTimelineAudio } = await import('../sound/melodic-audio.js');
const instance = new MelodicTimelineAudio();
await instance.ready();
```

### Pitfall 21 — Duplicate `click` listener on `randomBtn` fires random on longpress

- **Symptom**: Long-press del botón Random abre el menú Y dispara la
  aleatorización simultáneamente. El usuario ve cómo el ejemplo cambia
  cada vez que intenta abrir las opciones.
- **Cause**: La app registra un listener directo `randomBtn.addEventListener('click', handleRandom)`
  AND llama a `setupRandomMenu({ onRandomize: handleRandom })` (o `initRandomMenu`)
  más abajo. El `click` directo dispara en cada `pointerup`, incluido el
  que cierra un long-press.
- **Fix**: Elimina el listener directo. `setupRandomMenu` / `initRandomMenu`
  ya cablean shortpress (random) + longpress (menú) vía pointerdown/pointerup
  con guard explícito `pressDuration < longPress * 0.9`. Es la fuente
  única de verdad.

```javascript
// ❌ MAL
randomBtn.addEventListener('click', handleRandom);
setupRandomMenu({ spec, onRandomize: handleRandom });

// ✅ BIEN
setupRandomMenu({ spec, onRandomize: handleRandom });
```

---

## 7. Decision Rules

Quick answers to common design questions.

### When to use `enableGhost: false`?

Only when the numerator is fixed (always 1). This skips creating 7 DOM
elements that exist solely for the reduction animation, which `autoReduce`
never triggers when n=1.

| Variant | enableGhost |
|---|---|
| Simple fraction (n=1) | `false` |
| Complex fraction (n>1, autoReduce) | omit (defaults to true) |

### When `setSimpleMode()` vs `setComplexMode()`?

- `setSimpleMode()`: hides the numerator's spinner, sets the numerator
  input to readonly. Visual: only the denominator is editable.
- `setComplexMode()`: shows both spinners, both inputs editable.

### When to use plano-modular vs musical-grid?

Use **plano-modular** if you need any of:
- Multiple registers (octaves stacked).
- Note-bars with explicit duration.
- Drag-to-create note workflow.
- Fraction overlay (subdivisions of pulses).
- Ghost-pulse-lines.

Use **musical-grid** if:
- Single registry.
- Cell-selection only (no duration).
- Simpler use case.

### Standalone timeline vs plano-2D timeline?

- **Standalone**: `.timeline-wrapper > .timeline` with `::before`/`::after`
  yellow endcaps projected via `translateX`. Used when the app is just a
  rhythm sequence (no notes/registries).
- **Plano-2D**: `.plano-container::before` triangle corner + endcap on
  `.plano-timeline-container::after`. Used when there's a 2D grid above
  the timeline.

### Domain offset for playhead

- App32 (single fraction): `domOffset: 0`.
- App33-App35: `domOffset: -1` (adjusted by user testing).
- App19/App20 legacy: `playheadOffset: 7` (the historical default).

For new apps with `columnSizing: 'fr'`, start with `domOffset: 0` and
adjust by inspection.

### Halter under note-bars: always or sometimes?

Always, for plano-2D apps. The halter is the primary visual indicator of
note duration. Without it, the user sees colored bars but no number.

For standalone-timeline apps (App30-style), halters appear *under* the
colored interval-bar-visual (not under timeline pulses).

### Subdivision-label: `1/d` or `n/d`?

- Simple fraction apps (App26, App28, App30, App32, App34): `1/d`.
- Complex fraction apps (App27, App29, App31, App33, App35): `n/d` (dynamic
  with the current numerator).

### Sistema iframe aspect / max-height for new app

- Timeline-only app, no editor: `aspect: 5/2` (wide).
- Timeline + cell editor (Pfr/iTfr): `aspect: 2/1` or wider.
- Plano-2D + small editor: `aspect: 4/3`.
- Plano-2D + nit-editor (App34/35): `aspect: 3/4` portrait, `max-height: 900px`.
- Scale apps with vertical soundline: `aspect: 2/3` portrait.

---

## 8. Code Conventions

### CSS

- Selectors prefixed with `body.appNN` for app-scoped rules.
- CSS variables `--appNN-feature-axis` for per-app tokens.
- `!important` only when competing with `nuzic-theme.css` defaults; never as a default.
- No fixed `px` for font-size — always `clamp(min, vw, max)`.
- No `@media` breakpoints for font-size or component dimensions — use `clamp`.
- Comments in Catalan, Spanish, or English are all acceptable (match project context).

### JavaScript

- ES2022 modules, no build step. Direct `import` from `libs/`.
- Always export a `clearHighlights()` no-op on editor objects.
- Always guard audio access with `audio &&`.
- Use the standard initialization pattern:

```javascript
import { bindRhythmElements } from '../../libs/app-common/dom.js';
import { createRhythmAudioInitializer } from '../../libs/app-common/audio-init.js';

const { elements, leds, ledHelpers } = bindRhythmElements({...});
const initAudio = createRhythmAudioInitializer({...});
const audio = await initAudio();
```

NOT the legacy `initRhythmApp()`, `createStandardElementMap()`, or
`bindRhythmAppEvents()`.

### HTML

- `<body class="appNN" data-theme="light" data-visual="nuzic">`.
- Always include `<script src="../../libs/app-common/embed-mode.js"></script>`
  before `index.css` for sistema iframe support.
- Standard `<link>` order:
  1. `shared-ui/index.css`
  2. `app-common/styles.css`
  3. lib-specific CSS (musical-grid, plano-modular, etc.)
  4. `shared-ui/bpm-inline.css`
  5. `shared-ui/nuzic-theme.css`
  6. `shared-ui/interval-label-bar.css` (if halters used)
  7. `styles.css` (your app)
  8. `app-common/embed.css`

---

*End of Nuzic Visual System AI Reference Guide.*
