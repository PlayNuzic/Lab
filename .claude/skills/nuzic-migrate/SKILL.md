---
name: nuzic-migrate
description: Migrate PlayNuzic Lab apps to the nuzic visual theme — controls, timeline, soundline, editor
---

# Nuzic Theme Migration Skill

Migrate a PlayNuzic Lab app to the nuzic visual theme. Run with `/nuzic-migrate AppN`.

## How to navigate this skill

The skill is large (~2640 lines, 15 Steps). It mixes three reading modes:

1. **First-pass general knowledge** — concepts you should know BEFORE
   touching any app. These live in Steps 12-15 at the end of the file
   but should be read first:
   - **Step 12** — Shared modules (`scale-pill`, `output-note-pill`,
     `app-viewport`) so you know what NOT to duplicate.
   - **Step 13** — Specificity wars vs `nuzic-theme.css` and how to
     guarantee your overrides win.
   - **Step 14** — Common refactor traps (import collisions, `@import`
     duplicates, viewport boilerplate duplication, dual tooltip systems).
   - **Step 15** — Post-migration audit script (grep patterns for dead
     code, unused imports, leftover legacy CSS).

2. **Linear migration recipe** — once you know the patterns, walk
   through Steps 1-6 + 8-11 in order:
   Step 1 (audit) → Step 2 (theme activation) → Step 3 (controls
   layout) → Step 4 (CSS cleanup) → Step 5 (standalone timeline) →
   Step 6 (standalone soundline) → Step 8 (idle caret) → Step 9
   (verify) → Step 10 (commit) → Step 11 (cleanup after review).

3. **Per-app-type recipes** — Step 7 has sub-recipes (7a-7r) indexed
   by editor type. Pick the one that matches the app you're migrating.

### Recipe matrix — pick the right Step 7 sub-recipe

| App you're migrating | What it has | Step 7 sub-recipe to follow | Notes |
|---|---|---|---|
| app9, app13 | Standalone timeline + interval row | 7c + 7s (endcaps) | Interval row is a visual display, not an editor. ✅ App13 endcaps fets (commits cc121c4, 5ac4a0f). |
| App12 | 2D musical-grid + N-P editor | 7d + 7e + 7j | N + P rows, cross-column caret |
| App14 | Vertical soundline + iS-only editor | 7f (iS only — no zigzag) | |
| App15 | 2D musical-grid + iS-iT zigzag | 7f | Zigzag offset, cascade validation |
| App16, App17 | Timeline (linear / circular) + Compás disc | 7 prefaci + S5 of editor doc + 7s.10 (endcap dret per App16) | `.param--large` variant. ✅ App16 endcap dret fet (commits e48a57a→62aba63). |
| App18 | Vertical soundline + Registro pill | Step 12 + 14 (shared modules) | Inline port from App19/20 pattern |
| App19, App20 | Plano-modular (multi-pill) | 6b + 6c + 6d + 7f variant | Drag-to-create on grid |
| App21-22 | Scale apps, single column | 7e variant | |
| App23 | Scale + transposition pill + step bars | Step 12 (shared modules) | Imports `createOutputNotePill` |
| App24 | Scale chooser (custom listbox) + Transposition | Step 12 + scale-pill module | |
| App25 | Plano + degrees-of-scale editor | 7e | App25's degree editor + Transposition pill |
| App25B | Plano + degree-interval editor (iSº) | 7f variant | iSº-only. ✅ Visualització d'intervals = App15 (línies/números/handlers grab als np-dot/halters d'iT), però amb valor de GRAUS — vegeu `Apps/App25B/CLAUDE.md`. El patró del **halter discontinu** (silencis) es conserva per a App32-35. |
| App26 | Standalone timeline + simple fraction (n=1) | 7n + 7s | ✅ Visual refactor done; pattern in 7s. |
| App27 | Standalone + complex fraction (n>1) | 7n + 7s + 7s.9 | ✅ Visual refactor done. Pattern + complex adaptations in 7s.9. NO timeline math changes needed (App27 draws lg=numerator, all integers visible — no ghost-pulse-lines like App33). |
| App28 | Standalone + Pfr editor (cell-based) + simple fraction | 7o + 7s + 7o.visual | ✅ Visual refactor done (commit 19acb5b → 6b36e33). Pfr editor patterns in 7o.visual. |
| App29 | Standalone + Pfr editor + complex fraction | 7o + 7o.visual + 7s + 7s.9 | ✅ Visual refactor done (commit 7c96e29). Port literal d'App28 via `sed` + Step 7s.9 (gap: 0 + bar pseudo-element). 1 iteració. |
| App30 | Standalone + iTfr editor (cell-based) + simple fraction | 7q + 7s + 7q.visual | ✅ Visual refactor done. Step 7s (endcaps + fracció vertical) + iTfr editor + Step 7q.visual (info-pills quadrades alineades amb endcap dret + halter iT estil App13). |
| App31 | Standalone + iTfr editor + complex fraction | 7q + 7s + 7s.9 + 7q.visual + 7r math patterns | ✅ Visual refactor done (commit d865913). Port literal d'App30 via `sed` + Step 7s.9 (gap:0 + bar pseudo-element). |
| App32 | Plano-2D + simple fraction | 7r + 7r.visual | ✅ Done. + Visualització d'intervals estil App15 (mòdul `libs/interval-overlay/`): línies/números, np-dots de grab (jerarquia sencer fort / fraccionat fluix), halters, **línies de silenci** als forats. Commits `df8b7485` + `c437f9b8`. |
| App33 | Plano-2D + complex fraction | 7r + 7r.visual + 7r.complex + 7s.9 + 7r math patterns | ✅ Done (87e0a62). + Visualització App15 (interval-overlay); els pulsos fantasma queden forts (np-dots de subdivisió fluixos). `df8b7485` + `c437f9b8`. |
| App34 | Plano-2D + N-iT editor + simple fraction | 7r + 7r.visual + N-iT inline port | ✅ Done. + Visualització App15 (interval-overlay) + **halters discontinus** per als silencis de l'editor + línies de silenci als forats de grid. `df8b7485` + `c437f9b8`. |
| App35 | Plano-2D + N-iT editor + complex fraction | 7r + 7r.visual + 7r.complex + 7s.9 + N-iT inline port + 7r math | ✅ Done. + Visualització App15 (interval-overlay) + halters discontinus + línies de silenci. `df8b7485` + `c437f9b8`. |

### Critical for complex-fraction refactors (App27/29/31/35)

The math patterns for **complex fractions (n > 1)** live inside
**Step 7r** even though that Step is titled "Plano 2D apps with fraction
(App32-35)". Despite the title, the formulas, ghost-pulse rendering, and
playback timing bugs documented there apply equally to **standalone**
apps with complex fractions:

- `(colIdx * n) % d === 0` for integer-pulse detection (timeline, grid,
  highlight).
- `(startSubdiv * n) / d` for note-bar position conversion.
- Bugs 1/2/3 of timing (`scaledTotal`, `cellIndex`, `highlightBarAtPosition`).
- `renderGhostPulseLines` for integer pulses that don't sit on cell
  boundaries.
- `baseResolution = d` (NOT `n * d`) for metronome clicks.

When migrating App27/29/31 → start from the simple-fraction equivalent
(App26/28/30) per the recipe matrix, then **apply Step 7r's "Complex-
fraction adaptations" subsection** even though you're not in a plano-2D
app. The math is grid-agnostic.

### When in doubt

- **Pattern duplication ≥ 2 apps** → check Step 12 first; the module
  probably exists.
- **CSS rule doesn't apply** → check Step 13; you likely need higher
  specificity than you think.
- **App breaks at runtime with a SyntaxError** → check Step 14 Trap #1
  (import collision). Search `grep "function NAME\|const NAME"` before
  any new import.
- **Refactor done, want to confirm nothing's broken** → run Step 15's
  audit script before committing.

---

## Reference Documents

Before starting, ALWAYS read:
- `docs/nuzic-editor-migration.md` — Editor patterns, controls layout, learnings
- `docs/nuzic-theme-roadmap.md` — Theme phases and selectors reference
- `libs/shared-ui/nuzic-theme.css` — Shared theme (the source of truth)
- `SESSION_STATE.md` — Cross-app refactor history. Section "Coneixement
  consolidat" lists every shared module and pattern in use. Specific
  points worth reading: 25-26 (App21-24 baseline patterns), 35 (header
  symmetry + connection-renderer centering), 37 (vertical-mode on the
  Sistema), 40 (modular pills + import-collision lesson).

## Step 1: Audit the App

Read the app's `index.html` and `styles.css`. Determine:

1. **Theme activation**: Does it have `data-visual="nuzic"` on `<body>` and `nuzic-theme.css` link?
2. **Grid type**: `musical-grid`, `plano-modular`, or neither (standalone timeline)?
3. **Controls layout**: `data-layout="vertical"`, `data-layout="horizontal"`, or none (circular)?
4. **Has BPM?**: Does it import `bpm-inline.css` or use `bpmController`?
5. **Has Random/Reset?**: Are these buttons visible?
6. **Has editor?**: grid-editor (N-P), zigzag-editor (iS-iT), or iT-only?
7. **Has soundline?**: standalone (app10 style) or inside musical-grid?
8. **Has timeline?**: standalone (app9/13 style) or inside musical-grid?
9. **Has idle-caret-flash?**: What target element?

Report findings to user before proceeding.

## Step 2: Theme Activation (if not done)

Add to `index.html`:
```html
<!-- Before styles.css -->
<link rel="stylesheet" href="../../libs/shared-ui/nuzic-theme.css" />

<!-- On body tag -->
<body data-theme="system" data-visual="nuzic">
```

## Step 3: Controls Layout

### Apps WITHOUT `data-layout` (circular layout → compact row)

The nuzic-theme.css automatically converts `.controls:not([data-layout])` to a horizontal flex row: Play(48px) + BPM + Random(36px) + Reset(36px).

**JS required** — Add to the app's init function:
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

### Apps with extra params (Compás, etc.) inside `.inputs`

BPM always moves to `.controls` row. Other params (Compás, cycle counter,
Registro, Longitud, etc.) stay in `.inputs` and **inherit the unified pill
styling from nuzic-theme.css automatically** — no app-specific CSS needed.

The nuzic-theme rule `.inputs:has(.bpm-inline):not(:has(.param))` only hides
`.inputs` when it contains ONLY BPM. If `.param` elements exist, `.inputs`
stays visible and centers itself horizontally.

#### The 4 pill variants (all handled by nuzic-theme.css)

The theme detects the DOM shape of `.param > .circle` and applies the right
pill style. The pill height is **always** `clamp(2rem, 5vw, 3rem)` — the
same as the play/random buttons — so controls and inputs align visually.

| Variant | DOM shape | Layout | Used for |
|---|---|---|---|
| **BPM inline** | `.bpm-inline > .circle > input + .spinner` | Pill `[−] N [+]`, `.abbr` HIDDEN | BPM moved into `.controls` |
| **Input + spinner** | `.param > .circle > input + .spinner` | Pill `[−] N [+]`, `.abbr` ABOVE | Compás, Nº Compases, Registro, Nm, Psg, etc. |
| **Input-only** | `.param > .circle > input` (no spinner) | Pill with input centered, `.abbr` ABOVE | Read-only or auto-computed editable params |
| **Info-pure** | `.param > .circle > span` (no input) | Pill with span centered, `.abbr` **to the LEFT** | Longitud, displays — horizontal layout `LABEL [value]` |

#### Visual anatomy

```
Input + spinner (default for Compás, Registro, Nº Compases...):

        REGISTRO               ← .abbr (small, above, uppercase)
  ┌───────────────────┐
  │ ▼ │   3 y 4   │ ▲ │        ← pill: yellow half-pills + white center
  └───────────────────┘
    spin.down  input  spin.up

Info-pure (for Longitud-style displays):

  LONGITUD │ 12 │                ← .abbr to the LEFT of the pill
           └────┘
           span inside .circle
```

#### Centering

The `.inputs` container is **centered horizontally** by nuzic-theme.css
(overrides the legacy `left: -20px` offset from the base `index.css`).
No per-app override needed.

#### Do NOT add the following to app CSS

These are **anti-patterns** that fight the shared theme. The generic
selectors `body[data-visual="nuzic"] .param:has(.circle > input)` already
cover every app:

```css
/* ❌ DON'T add per-app pill overrides. The theme already unifies them. */
.param.compas .circle { border-radius: 1.5rem; ... }

/* ❌ DON'T force golden round spinners — the theme already uses
   yellow half-pills with white arrows across all apps. */
.inputs .param .spin { border-radius: 50% !important; ... }

/* ❌ DON'T scale params — the theme sizes them to match controls. */
.param.compas { transform: scale(1.33); }
```

The single exception is **identity colors** (e.g. App19's `.param.registro`
used to be pink). In the unified theme all pills share the same yellow/white
palette. If an app needs an identity-colored variant, add it to
`nuzic-theme.css` under a specific selector, not to the app CSS.

#### Variant `.param--large` (hero-size control)

For apps that need a visually dominant control (App16/17 "Pulsos por
Compás"), add the `param--large` class to the `<div class="param">`.
This activates a separate block in `nuzic-theme.css` that excludes the
generic pill treatment and renders:

- a big yellow disk (`clamp(4rem, 10vw, 7rem)` diameter),
- a small white inner circle with the input centered (just wide enough
  for 1-2 digits),
- two `−`/`+` half-pills floating at each side with a small gap
  (`clamp(0.25rem, 0.8vw, 0.6rem)`),
- the `.abbr` label above, large (`clamp(1.1rem, 2.2vw, 1.75rem)`).

Required HTML:

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

Note: `−`/`+` are **text characters** inside the buttons, not the triangle
`::before` that the other spinners use. The theme neutralizes the triangle
(`content: none`) for `.param--large`.

Do NOT pair `.param--large` with `.bpm-inline` or `visible` — those classes
belong to the BPM-as-controls layout and their sizing rules conflict.

The generic Fase 12 selectors already exclude `.param--large` via
`:not(.param--large)`, so you don't need to override anything.

### Apps WITH `data-layout="vertical"` (CONVERT to single-column)

**Remove** `controlsLayout: { mode: 'vertical' }` from `renderApp` config.
This converts the app to use the nuzic compact row layout automatically.

Also remove:
- `@import two-column-layout.css`
- `@import grid-editor.css`
- `.appN-controls-container` CSS and DOM creation
- All `--col-left` variables

The controls are moved to end of main grid via JS (see Step 7j).

## Step 4: CSS Cleanup

Remove from app's `styles.css`:
- [ ] Legacy control transforms (`transform: translate(var(--play-offset-x)...)`)
- [ ] Legacy control variables (`--play-offset-x`, `--buttons-row-offset-x`, `--bpm-offset-x`, `--controls-scale`)
- [ ] Legacy `.controls { transform: ... }` rules
- [ ] Legacy button positioning (`.random { grid-column: 1; position: absolute; }`)
- [ ] Legacy BPM positioning (`.bpm-inline { transform: translate(...) scale(...) }`)
- [ ] Duplicate responsive rules for controls (handled by nuzic-theme)
- [ ] Old color variables (`--line-color`, `--soundline-width`, `--cell-highlight-color`)
- [ ] `order: -1` on random/reset
- [ ] **Orientation warnings** (`@media orientation: portrait/landscape` with `body::before` overlay)
- [ ] **Soundline responsive breakpoints** that resize soundline/note-highlights at smaller viewports

Keep:
- Layout grid (`.appN-main-grid`, grid-template)
- Editor-specific CSS (grid-editor, zigzag-editor, seq-input)
- App-specific functional CSS (drag, iT bars, selection)
- `body[data-visual="nuzic"] { }` override block
- **At most 1 breakpoint** `@media (max-width: 700px)` for font-size adjustments

**IMPORTANT: Use relative units (%, rem, vw, vh) instead of px.**
This is a professional standard that ensures responsive consistency:
- **Widths, margins, paddings, positions, gaps** → `%` or `rem`
- **Font sizes** → `clamp(min, vw, max)` for fluid scaling (NOT fixed rem)
- **Only use px for**: borders, box-shadows, border-radius, min-width safety values
- With clamp(), elements scale naturally — NO breakpoints for font sizes

**CRITICAL: ALL font-size declarations MUST use clamp().**
Fixed `rem` font-sizes do NOT scale with viewport. Use `clamp(min, vw, max)`:

```css
/* Standard clamp patterns for nuzic apps */
/* Small text (labels, tooltips):     */ font-size: clamp(0.65rem, 1.2vw, 0.8rem);
/* Body text (numbers, cells):        */ font-size: clamp(0.7rem, 1.4vw, 0.875rem);
/* Medium text (editor labels):       */ font-size: clamp(0.85rem, 1.8vw, 1.4rem);
/* Large text (timeline, soundline):  */ font-size: clamp(0.85rem, 1.6vw, 1.2rem);
/* XL text (params, seq-input):       */ font-size: clamp(1.5rem, 3.5vw, 2.5rem);
```

Check nuzic-theme.css, plano-modular.css, and soundlines.css — they already
use clamp() on all font-sizes. App-specific CSS must do the same.
Do NOT add `@media` breakpoints to override font-sizes — clamp() replaces them.

**IMPORTANT: NO orientation warnings.**
Do NOT include `@media (orientation: portrait)` or `@media (max-width: Npx) and (orientation: landscape)` warnings. These `body::before` overlays with `z-index: 9999` block the app completely inside iframes. The Sistema Interactivo handles responsive layout (single column on mobile).

**IMPORTANT: NO soundline/timeline dimension breakpoints.**
Soundlines and timelines use rem — they scale naturally. Do NOT add breakpoints that resize soundline width, note-highlight width, or interval-number font-size at smaller viewports. This is obsolete legacy code from the px-based layout.

## Step 5: Timeline (standalone apps)

The nuzic-theme handles:
- Cream background, 60px height
- Pulse-numbers centered with ticks (::before/::after)
- Highlight with golden bar (.highlighted class)
- Dots and horizontal line hidden

**JS required for highlight** — ensure `pulses` array contains `.pulse-number` elements:
```javascript
pulses = Array.from(timeline.querySelectorAll('.pulse-number'));
```

For apps with `createSimpleHighlightController`:
```javascript
const highlightController = createSimpleHighlightController({
  getPulses: () => pulses,  // Must be .pulse-number elements
  getLoopEnabled: () => false
});
```

**Last pulse visible on stop** — save and re-apply:
```javascript
const lastHighlighted = document.querySelector('.pulse-marker.highlighted');
highlightController?.clearHighlights();
if (lastHighlighted) {
  lastHighlighted.classList.add('highlighted');
  setTimeout(() => lastHighlighted.classList.remove('highlighted'), 500);
}
```

## Step 6: Soundline (if standalone)

Nuzic-theme handles soundline inside `.grid-container` and `.plano-container`.
For standalone soundline (app10 style), ensure:
- `.soundline-number` has `position: absolute` (for JS percentage positioning)
- Soundline width matches content (`75px` for app10)
- `background: var(--nuzic-pink-light)` on `.soundline`
- Note highlights use `--note-highlight-color: var(--nuzic-blue-light)`

## Step 6b: Plano-modular np-dots (Apps with clickable grid dots)

Apps using `plano-modular` with `np-dot` elements (App19, App20, etc.) need special
handling for the nuzic dot alignment.

**Problem:** `nuzic-theme.css` renders dots via `radial-gradient` on `.plano-cell` at
`0% 100%` (bottom-left corner). This creates a quarter-circle (clipped by cell boundary)
and is NOT aligned with the soundline marks (which sit at the division line between rows
via `translateY(50%)`).

**Solution:** Hide the gradient and use `np-dot::after` elements instead. DOM elements
can straddle cell boundaries — full circles at the correct position.

Add to the app's `styles.css`:

```css
/* Hide gradient — np-dot elements provide full circles at division lines */
body[data-visual="nuzic"] .plano-cell {
  background-image: none !important;
}

/* np-dot at division line (bottom of cell = aligned with soundline marks).
   translate(−50%, 50%) centers the element ON the bottom edge. */
body[data-visual="nuzic"] .plano-cell .np-dot {
  bottom: 0;
  left: 4px;
  top: auto;
  width: 16px;
  height: 16px;
  transform: translate(-50%, 50%);
}

/* Filled dark circle (replaces gradient) */
body[data-visual="nuzic"] .plano-cell .np-dot::after {
  width: 3px;
  height: 3px;
  background: var(--nuzic-dark, #43433B);
  border: none;
  border-radius: 50%;
  opacity: 1;
}

/* Hover: orange glow */
body[data-visual="nuzic"] .plano-cell .np-dot-clickable:hover::after {
  width: 10px;
  height: 10px;
  background: rgba(255, 187, 51, 0.6);
  border: 2px solid var(--nuzic-yellow, #FFBB33);
  box-shadow: 0 0 6px var(--nuzic-yellow, #FFBB33);
}
```

**Key points:**
- `bottom: 0` + `translate(-50%, 50%)` = centered ON the division line (full circle visible)
- Do NOT use gradient `50%` or `100%` — gradient gets clipped at cell boundary
- Do NOT move the gradient position — use DOM elements instead
- The `3px` dot size matches the Nuzic Main reference

## Step 6c: Plano-modular full-width grid (columnSizing: 'fr')

Apps using `plano-modular` where the grid should fill the full horizontal space
(like App19) need `columnSizing: 'fr'` instead of the default fixed `50px` columns.

**Pass `columnSizing: 'fr'` in the grid config:**
```javascript
grid = createApp19Grid({
  parent: gridContainer,
  columns: getTotalPulses() || 1,
  columnSizing: 'fr',  // fills available width instead of fixed 50px
  // ...
});
```

**CRITICAL CSS: Force `width: 100%; min-width: 0` on the ENTIRE chain.**
With `1fr` tracks, every element from `.plano-container` down to `.plano-matrix`
must allow flexible sizing. Without this, `max-content` or `min-content` sizing
causes `1fr` tracks to collapse to their minimum intrinsic width.

```css
.plano-container {
  width: 100%;
  background: var(--bg-light);
}

[data-theme="dark"] .plano-container {
  background: var(--bg-dark);
}

/* width:100% on matrix-container, matrix, and timeline-row ONLY.
   Do NOT add plano-grid-area — width:100% on a grid item overflows
   its track and covers the soundline column. */
.plano-matrix-container,
.plano-matrix,
.plano-timeline-row {
  width: 100%;
  min-width: 0;
}

.plano-matrix,
.plano-timeline-row {
  margin-left: 0;  /* remove default 15px offset */
}

/* Grid-area: use CSS Grid to separate matrix from timeline */
.plano-grid-area {
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  min-height: 0;
}

.plano-matrix-container { grid-row: 1; min-height: 0; }
.plano-timeline-container { grid-row: 2; position: relative; z-index: 2; }

/* Scroll containers: subtract timeline height + 1 cell from visible area
   so the timeline doesn't overlap the last soundline row */
.plano-soundline-container,
.plano-matrix-container {
  max-height: calc(var(--plano-visible-rows) * var(--plano-cell-height)
    - var(--plano-timeline-height, 40px) - var(--plano-cell-height));
}
```

**CRITICAL: Do NOT add `width: 100%` to `.plano-grid-area`.**
`width: 100%` on a CSS Grid item resolves to 100% of the grid CONTAINER,
not 100% of its grid track. This causes the grid-area to overflow column 2
and cover the soundline column. The `1fr` track already handles the width.

**Why `min-width: 0` is needed:** `plano-modular.css` sets `min-width: max-content`
on `.plano-matrix` and `.plano-timeline-row`. With `1fr` columns, `max-content`
resolves to nearly zero (empty cells). `min-width: 0` lets the tracks resolve
against the container width instead.

**Background:** Use `var(--bg-light)` / `var(--bg-dark)` (NOT `var(--nuzic-white)`)
to match the body background set by `index.css`. `--nuzic-white` is `#1e1e1e`
in dark mode while `--bg-dark` is `#43433B` — using the wrong one creates
a visible color mismatch between the grid and surrounding areas.

**Do NOT use JS overrides for gridTemplateColumns.** The `columnSizing: 'fr'`
option in the lib handles this natively on every `refresh()`. Post-hoc JS
overrides get destroyed by `updateGrid()` → `refresh()` race conditions.

**Playhead with `columnSizing: 'fr'`:** The playhead uses DOM-based positioning
(`cell.offsetLeft`) instead of pixel calculation. The `plano-modular/index.js`
passes `getCellWidth = () => 0` when `columnSizing === 'fr'`, triggering the
DOM path in `plano-playhead.js`. A +7px offset aligns the playhead with the
np-dots (which sit at `left: 4px` + the `margin-left: -4px` on the playhead
element). This is hardcoded in `plano-playhead.js:47`.

**Grid background:** nuzic-theme.css sets `--plano-bg-color: var(--nuzic-white)`
and `--plano-cell-bg: transparent` for both light and dark modes. Remove any
legacy dark-mode variables (`--grid-area-bg`, `--grid-cell-bg`) from the app's
styles.css — they interfere with the nuzic plano background. The result should
match musical-grid apps (App12, App15): white in light, `#1e1e1e` in dark.

## Step 6d: Plano-modular scroll and autoscroll

Apps using `plano-modular` with multiple registries need scroll management.

### Free native scroll (NO quantization)

Do NOT block or quantize the vertical wheel scroll. Remove any `e.preventDefault()`
+ delta accumulation + cooldown patterns. Let the browser handle native scrolling.
The `setupScrollSync` in plano-modular already syncs soundline ↔ matrix.

Registry spinners (Registro up/down) use `scrollToScreen()` for deliberate jumps.
Since the user can free-scroll to any position, **detect the current screen from
`scrollTop`** before navigating:

```javascript
function detectCurrentScreen() {
  const container = document.querySelector('.plano-soundline-container');
  if (!container) return currentScreen;
  const scrollTop = container.scrollTop;
  let closest = 0, minDist = Infinity;
  for (let i = 0; i < SCREENS.length; i++) {
    const dist = Math.abs(scrollTop - getScreenScrollTop(SCREENS[i]));
    if (dist < minDist) { minDist = dist; closest = i; }
  }
  return closest;
}
```

### Screen definitions: explicit firstRow/lastRow

Define screens with explicit row ranges that fit the visible `max-height`:

```javascript
const SCREENS = [
  { label: '3 y 4', firstRow: 27, lastRow: 47 },  // 0r3 to 8r4
  { label: '4 y 5', firstRow: 12, lastRow: 35 },  // 0r4 to 0r5
  { label: '5 y 6', firstRow: 0,  lastRow: 23 }   // 0r5 to 11r6
];
```

`getScreenScrollTop` positions `lastRow` at the BOTTOM of the visible window:
```javascript
function getScreenScrollTop(screen) {
  const visibleHeight = container?.clientHeight || (24 * CELL_H);
  const bottomEdge = (screen.lastRow + 1) * CELL_H + HALF_CELL;
  return Math.max(0, bottomEdge - visibleHeight);
}
```

### Initial scroll: after preset, not before

The `createApp19Grid` preset calls `grid.setRegistry(4)` with `setTimeout(0)+rAF`.
This positions to registry 4 only. To show the full "3 y 4" screen, call
`scrollToScreen(0, false)` AFTER the preset finishes:

```javascript
setTimeout(() => {
  requestAnimationFrame(() => scrollToScreen(0, false));
}, 100);  // after preset's setTimeout(0)+rAF
```

Do NOT use `maybeApplyInitialScroll` or `isInitialized` flags — they race with
the preset and cause incorrect positioning.

### Playback autoscroll: pre-computed scroll plan

Do NOT use reactive look-ahead (checking next note in `onPulse`). Instead,
pre-compute a **scroll plan** before playback starts:

```javascript
function buildScrollPlan(selectedArray, rows) {
  // For each pulse with a note:
  // 1. Get the note's rowIndex
  // 2. Check if it's within the visible window
  // 3. If not, calculate minimum scroll to make it visible (2-row margin)
  // 4. Duration proportional to distance (300-800ms)
  // 5. Look-ahead: schedule 1 step early
  return plan;  // [{ step, scrollTop, duration }]
}
```

During `onPulse`, execute the plan with a pointer:
```javascript
while (planIdx < plan.length && plan[planIdx].step <= step) {
  smoothScrollTo(el, plan[planIdx].scrollTop, 'top', plan[planIdx].duration, 'easeInOut');
  planIdx++;
}
```

**Key properties:**
- **Adaptive window**: scrolls the minimum to keep the note visible, not fixed screens
- **Proportional duration**: 300ms for small moves, 800ms for large jumps
- **`easeInOutCubic`**: gentle start and end (not the abrupt native `behavior: 'smooth'`)
- **Cancel previous**: `smoothScrollTo` cancels any in-flight animation on the element
- **`prefers-reduced-motion`**: falls back to instant scroll

### smoothScrollTo enhancements (plano-scroll.js)

The shared `smoothScrollTo` supports:
- `easing` parameter: `'easeOut'` (default) or `'easeInOut'` (for screen transitions)
- Animation cancellation via `element._smoothScrollRafId`
- `prefers-reduced-motion` respect

## Step 7: Editor Migration (CORE TASK)

This is the main work. Read `docs/nuzic-editor-migration.md` FIRST.
Study `/Users/workingburcet/nuzic_app/App/NuzicCSS.css` and `RE_General.js` for reference.

**CRITICAL RULE: Visual stack is ALWAYS `timeline → editor → controls`.**
No exceptions. In the layout (flex/grid column), the order is:
1. Grid / Soundline / Timeline (flex: 1, fills space)
2. Editor (below, flex-shrink: 0)
3. Controls (compact row at bottom)

**Standalone-timeline apps need an EXPLICIT controls move.** The template.js
generates `.controls` INSIDE `.timeline-wrapper`, so without intervention the
DOM order ends up `[timeline + controls] → editor`. Wrong. After inserting
your editor row after `.timeline-wrapper`, move `.controls` to AFTER it:

```javascript
const parent = timelineWrapper.parentNode;
parent.insertBefore(editorRow, timelineWrapper.nextSibling);
const controls = timelineWrapper.querySelector('.controls');
if (controls) parent.insertBefore(controls, editorRow.nextSibling);
```

**Before finalizing a migration, visually verify the stack in the browser
dev tools:** `.timeline-wrapper` → your editor row → `.controls`. If controls
appear between timeline and editor, you missed this step.

**CRITICAL: Controls are generated INSIDE `.timeline-wrapper` by `template.js` (line 291).**
Do NOT extract controls from `.middle` — they are already in the wrapper.
Just reorder children via `appendChild` to move them after the editor.

**CRITICAL: Save controls BEFORE clearing `.timeline-wrapper` with `innerHTML = ''`.**
Many apps clear the timeline-wrapper to replace its content (plano-modular, musical-grid).
The `innerHTML = ''` DESTROYS the controls that template.js generated inside it.
Always save controls BEFORE clearing:

```javascript
const timelineWrapper = document.querySelector('.timeline-wrapper');
const controls = timelineWrapper.querySelector('.controls');
if (controls) controls.remove();  // detach from DOM (keeps reference)

timelineWrapper.innerHTML = '';   // now safe — controls preserved

// ... create grid, editor, etc. ...

// Re-add controls at the end
timelineWrapper.appendChild(controls);
```

This pattern was needed for App19, App20, and App25. It will likely be needed
for ALL plano-modular and musical-grid apps that build their own DOM.

**CRITICAL: `nuzic-theme.css` hides `.pulse` dots with `display: none !important`.**
Standalone timeline apps (App16, App17) that used `.pulse` dots for highlighting
must switch to highlighting `.pulse-number` elements instead. Do NOT override
with `display: block` — the dots are legacy visual artifacts (black/blue circles).
Use `.pulse-number.active` with nuzic golden bar styling:
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
And in JS, highlight `.pulse-number[data-index="${step}"]` not `.pulse[step]`.

**CRITICAL: Remove `@import pulse-highlight.css` if present.**
This shared CSS defines `.pulse.active`, `.pulse.active-zero`, and
`.pulse-number.active/active-zero` styles that conflict with nuzic highlighting.
After migrating to nuzic golden bar on `.pulse-number`, this import is obsolete
and causes interference (blue/golden distinction, dot visibility, scale transforms).

**CRITICAL: `nuzic-theme.css` sets `top: 20% !important` on `.timeline .interval-number`.**
This is for horizontal timelines (app9/13). Apps with VERTICAL soundlines
(App14) that position interval-numbers via JS must override:
```css
body[data-visual="nuzic"] .timeline .interval-number {
  top: auto !important;
}
```

### 7a. Editor Types

| Type | Apps | Rows | Reference |
|------|------|------|-----------|
| **iT only** | app13 | 1 row: iT (crema) | app13 (done) |
| **N-P grid** | App12 | 2 rows: N (rosa), P (crema) | App12 (done) |
| **iS-iT zigzag** | App14, App15 | 2 rows: iS (rosa), iT (crema) | App15 (done) |
| **N-iT zigzag (plano)** | App20, App34 | 2 rows sota plano-grid: N (rosa), iT (groga) | App20 (done), App34 (done — N-only inline port) |
| **Graus d'escala** | App25, App25B | 1 row dins `.grid-container` grid-row 3 | App25 (done) |
| **Fraccions (només fracció)** | App26, App27 | Subdivision-row sota timeline standalone | App26 (done) |
| **Fraccions + editor Pfr** | App28, App29 | Subdivision-row + cell-based Pfr editor sota timeline | App28 ✅, App29 ✅ |
| **Fraccions + editor iTfr** | App30, App31 | Subdivision-row + cell-based iT editor + interval bars sobre timeline | App30 ✅, App31 ✅ |
| **Plano 2D + fracció** | App32, App33 | plano-modular grid + fracció block + info pastilles a `.middle` + triangle a la cantonada inferior-esquerra | App32 ✅, App33 ✅ |
| **Plano 2D + fracció + N-iT** | App34, App35 | plano-modular grid + fracció + info pastilles + editor N-iT full-width sota grid | App34 ✅, App35 ✅ (+ visualització d'intervals App15) |

### 7b. Common Pattern: 2 cells per interval (value + 1 separator)

**CRITICAL: Each interval = exactly 2 cells, regardless of iT value.**
The number of colored separator cells does NOT depend on the temporal interval.
The iT value is just a NUMBER in the cell, not a visual width.

```
[Label] [white:val] [color] [white:val] [color] [...] [●] [nuzic-light background fills rest]
```

Do NOT create `2*iT` or `iT-1` extension cells. Always 1 separator per value.

**CSS classes per cell type:**
- `.it-cell:placeholder-shown` → cream background (`--nuzic-yellow-light` for iT/P, `--nuzic-pink-light` for N/iS)
- `.it-cell:not(:placeholder-shown)` → white background (has value)
- `.it-cell.it-input` → white, editable, cursor active
- `.it-cell.it-end` → end-of-interval separator (`box-shadow: inset -2px 0 0 0 white`)

**Cell dimensions:** `--it-block: 35px` (square, fixed width+height)

### 7c. Interval Row (standalone timeline apps — app9, app13)

Standalone timeline apps show interval numbers in a dedicated row BELOW the timeline.
This is NOT an editor — it's a visual display of the intervals between pulses.

**Structure:** 8 equal flex cells inside a gold-bordered row.

**HTML (created by JS):**
```javascript
const intervalRow = document.createElement('div');
intervalRow.className = 'interval-row';
timeline.insertAdjacentElement('afterend', intervalRow);

for (let i = 1; i <= 8; i++) {
  const cell = document.createElement('div');
  cell.className = 'interval-cell';
  cell.dataset.index = i;
  cell.textContent = i;
  intervalRow.appendChild(cell);
}
```

**CSS:**
```css
.interval-row {
  display: flex;
  border: 2px solid var(--nuzic-yellow);
  border-radius: 4px;
  overflow: hidden;
  margin-top: 0.25rem;
}
.interval-cell {
  flex: 1;
  text-align: center;
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--nuzic-dark);
  padding: 0.3rem 0;
  background: white;
  border-right: 2px solid var(--nuzic-yellow);
}
.interval-cell:last-child { border-right: none; }
.interval-cell.active { background: var(--nuzic-yellow); color: white; }
```

**Alignment with timeline (CRITICAL):**
Use `ResizeObserver` to sync width AND left position with the `.timeline` element:
```javascript
const syncRowWidth = () => {
  intervalRow.style.width = `${timeline.offsetWidth}px`;
  intervalRow.style.marginLeft = `${timeline.offsetLeft}px`;
};
syncRowWidth();
new ResizeObserver(syncRowWidth).observe(timeline);
```

Do NOT use CSS margins/padding to align — measure the actual `.timeline` position.

**Playback highlight:**
```javascript
// In onPulse callback:
wrapper.querySelectorAll('.interval-cell.active').forEach(n => n.classList.remove('active'));
const cell = wrapper.querySelector(`.interval-cell[data-index="${step + 1}"]`);
if (cell) cell.classList.add('active');
```

### 7c-old. iT Row (temporal intervals) — already implemented in app13

Pattern per interval iT=N: value WHITE first, then (N-1) cream extensions.
Always starts with cream P0 cell.
Dynamic creation in `renderEditorCells()`.
See app13/main.js for complete reference.

### 7d. N Row (notes) — for App12, App15

**Color:** `--nuzic-pink-light` (#ffe5ee) for cream cells, white for values.
**Label:** "N" with `background: var(--nuzic-pink)` (#f28aad).
**Values:** Note numbers (0-11), one per pulse position.
**No extensions** — each N cell occupies exactly 1 pulse.

```
[N] [cream] [white:4] [cream] [white:3] [cream] [white:5] [cream] [white:2] [●]
     P0      P1        P2      P3        P4      P5        P6      P7
```

Each cell aligns with a pulse column in the 2D grid above.

### 7e. P Row (pulse positions) — for App12, App15

**Color:** `--nuzic-yellow-light` (#ffeecc) for cream cells, white for values.
**Label:** "P" with `background: var(--nuzic-yellow)` (#ffbb33).
**Values:** Pulse index numbers (0, 1, 2...), one per pulse position.

```
[P] [cream] [white:0] [cream] [white:2] [cream] [white:3] [cream] [white:7] [●]
     P0      P1        P2      P3        P4      P5        P6      P7
```

### 7f. iS-iT Zigzag Editor — for App14, App15, App32-35

**Reference implementation: App15** (completed)

The iS-iT editor has TWO rows with a ZIGZAG offset pattern (from nuzic_app's
`RE_General.js` where iT values use `index_columns[index]+1` instead of `index`).

#### Cell sizing: 2 cells per pulse-space

```css
.editor-cell { width: 5%; aspect-ratio: 1; }  /* square, ~20 cells visible */
```

Each interval of iT=N occupies `2*N` cells in both rows.

#### Zigzag rendering pattern

iS values at position 0, iT values at position 1 (shifted right by 1 cell):

```
iS: [white:+3] [pink] [pink] [pink] [white:-2] [pink] [●]
iT: [cream] [white:2] [cream] [cream] [cream] [white:1] [●]
     ↑ offset creates diagonal zigzag
```

For each committed interval (iT=N):
- **iS row**: `[value][ext × (2*N - 1)]` — value at position 0
- **iT row**: `[ext][value][ext × (2*N - 2)]` — value at position 1

For input cells (when entering new interval):
- **iS row**: `[white input][pink ext]` — input at left
- **iT row**: `[cream ext][white input]` — input at right (zigzag)

**No P0 cells** — iS0 starts at pulse 0 (presupposes base note N=0).

#### Editable committed cells

Value cells are NOT readonly. On focus: select text. On blur: validate + update.

```javascript
function createValueCell(type, displayValue, intervalIndex) {
  cell.readOnly = false;
  cell.dataset.intervalIndex = intervalIndex;

  cell.addEventListener('focus', () => { originalValue = cell.value; cell.select(); });
  cell.addEventListener('blur', () => {
    // Validate, update currentIntervals[idx], re-render, sync grid
    // For iS: check ALL subsequent notes stay in [0,11] (cascade validation)
    // For iT: check sum ≤ TOTAL_SPACES
  });
}
```

#### Caret behavior (iS-iT zigzag)

- Focus starts on iS input (top-left)
- After entering iS → auto-jump to iT input (bottom-right) via 300ms timer
- After entering iT → commit interval, cells render, focus back to next iS
- **On invalid input**: `clearTimeout(autoJumpTimer)` + clear pending + clear value + keep caret
- Backspace on empty: delete last interval from `currentIntervals`

#### Validation rules

| Rule | Action |
|------|--------|
| First iS ≤ 0 | Tooltip, clear value, cancel timer, keep caret |
| iS out of note range | Tooltip "iS: -N a +M", clear, cancel timer |
| iT < 1 or > 8 | Tooltip "iT: 1-8", clear, cancel timer |
| iT exceeds remaining | Tooltip "iT máximo: N", clear, cancel timer |
| Edit invalidates sequence | Tooltip "Valor invalida seqüència", revert |

#### API compatibility

```javascript
gridEditor = {
  getPairs: () => intervalsToPairs(basePair, currentIntervals).slice(1),
  setPairs: (pairs) => {
    currentIntervals = pairsToIntervals(pairs, basePair);
    renderEditorCells();
  },
  clear: () => { currentIntervals = []; currentPairs = []; renderEditorCells(); },
  clearHighlights: () => {},  // REQUIRED no-op
  destroy: () => editorEl.remove()
};
```

#### Imports needed

```javascript
import { intervalsToPairs } from '../../libs/matrix-seq/index.js';
import { pairsToIntervals, fillGapsWithSilences } from '../../libs/interval-sequencer/index.js';
```

### 7g. Editor Bar CSS Structure

```css
.editor-bar {
  position: relative;
  max-width: 700px;  /* match .timeline-wrapper */
  padding: 0 20px;   /* match .timeline-wrapper */
  --it-block: 35px;
}

.editor-label {
  position: absolute;
  left: calc(20px - var(--it-block) - 4px);  /* in padding area */
  width: var(--it-block);
  height: var(--it-block);
  font-weight: 700;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  /* Color per type: */
  /* iT/P: background: var(--nuzic-yellow); */
  /* N/iS: background: var(--nuzic-pink); */
}

.editor-cells {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  height: var(--it-block);
  background: var(--nuzic-light);  /* fills remaining space */
}

.editor-cell {
  width: var(--it-block);
  min-width: var(--it-block);
  height: 100%;
  border-width: 0;
  border-radius: 0;
  text-align: center;
  font-weight: 700;
  font-size: 14px;
}

/* Placeholder trick */
.editor-cell:placeholder-shown {
  /* iT/P rows: */ background: var(--nuzic-yellow-light);
  /* N/iS rows: */ background: var(--nuzic-pink-light);
  border: 2px solid [same color];
}

.editor-cell:not(:placeholder-shown) {
  background: white;
  z-index: 1;
}

.editor-end-marker {
  width: var(--it-block);
  background: var(--nuzic-dark);
  /* ● symbol via ::after */
}
```

### 7h. Editor Bar JS Structure

```javascript
function renderEditorRow(container, endMarker, values, maxLength) {
  // 1. Clear existing cells
  container.querySelectorAll('.editor-cell').forEach(c => c.remove());

  // 2. Cream P0 (always first)
  insertReadonlyCell(container, endMarker);

  // 3. For each entered value
  for (const val of values) {
    // For N/P rows (no extensions): just white cell with value
    insertValueCell(container, endMarker, val);
    // For iT/iS rows (with extensions): value + (val-1) cream cells
    for (let j = 0; j < val - 1; j++) insertReadonlyCell(container, endMarker);
  }

  // 4. If not full: white input + cream
  if (sum < maxLength) {
    insertInputCell(container, endMarker);  // white, editable, auto-focus
    insertReadonlyCell(container, endMarker);  // cream placeholder
  }

  // 5. End marker
  endMarker.style.display = sum >= maxLength ? 'flex' : 'none';
}
```

### 7i. Alignment with Timeline/Grid

The editor MUST align with the timeline pulse positions:
- Editor bar has same `max-width` and `padding` as `.timeline-wrapper`
- Each cell is `--it-block` wide (fixed, not flex)
- Cells are created dynamically, NOT pre-allocated
- The `background: var(--nuzic-light)` on `.editor-cells` fills to the right
- Label sits in the left padding via `position: absolute`

### 7j. For N-P Editors (App12, App15, and ALL apps)

**Decision: ALWAYS replace the grid-editor with nuzic cell pattern.**
Do NOT keep the old grid-editor. Do NOT ask — this is the standard approach.

**Reference implementation: App12** (completed)

#### Layout changes required:

1. **Single-column layout**: Remove `controlsLayout: { mode: 'vertical' }` from renderApp
2. **Remove CSS imports**: `@import two-column-layout.css` and `@import grid-editor.css`
3. **Flex column**: `.appN-main-grid { display: flex; flex-direction: column }`
4. **Remove obsolete DOM**: `.inputs?.remove()` + `.middle?.remove()` (save `bpmParam` FIRST!)
5. **Grid expansion**: `.grid-container { flex: 1; max-width: none; max-height: none }`

#### Editor bar structure:

```css
.np-editor { grid-column: 1 / -1; grid-row: 3; }
.editor-bar { display: grid; grid-template-columns: 60px 1fr; }  /* matches grid-container */
.editor-cell { width: 6.25%; aspect-ratio: 1; }  /* 2 cells per pulse, square */
```

Cell order per pair: `[white:value][color separator]` (value FIRST, color AFTER)

```
[N] [white:4] [pink] [white:3] [pink] ... [●] [nuzic-light background]
[P] [white:0] [cream][white:2] [cream]... [●] [nuzic-light background]
```

#### Caret behavior (N-P cross-column):

- Track `lastEnteredType` ('n' or 'p')
- After commit, auto-focus alternates: if last was N → focus P, if last was P → focus N
- Both N and P inputs editable from start (no waiting state)
- Delay 300ms for 2-digit N input (allows "11")
- Cancel timer + clear value on invalid input

#### Validation rules:

| Rule | Action |
|------|--------|
| N: 0-11 | Tooltip "Nota: 0-11", clear value, cancel timer, keep caret |
| P: 0-7 | Tooltip "Pulso: 0-7", clear value, keep caret |
| P duplicate | Tooltip "Pulso ya usado", clear P value, keep caret on P |
| Auto-sort | Sort by P ascending, tooltip "Reordenado por pulso" if position changed |
| P=7 | Auto-blur (last pulse, don't jump to next pair) |

#### Controls:

```javascript
// Save bpmParam BEFORE removing .inputs
const bpmParam = document.getElementById('bpmParam');
document.querySelector('.inputs')?.remove();
document.querySelector('.middle')?.remove();

// Reorder and move controls to main grid
const controls = document.querySelector('.controls');
while (controls.firstChild) controls.removeChild(controls.firstChild);
if (playBtn) controls.appendChild(playBtn);
if (bpmParam) controls.appendChild(bpmParam);
if (randomBtn) controls.appendChild(randomBtn);
if (randomMenu) controls.appendChild(randomMenu);
if (resetBtn) controls.appendChild(resetBtn);
gridWrapper.appendChild(controls);  // move to end of main grid
```

#### API compatibility:

#### API compatibility — CRITICAL

**Before replacing the editor, ALWAYS:**
1. Grep for ALL calls to `gridEditor.*` in the app's main.js
2. List every method used (getPairs, setPairs, clear, clearHighlights, destroy, etc.)
3. Ensure the new editor implements ALL of them
4. Read the existing editor's event handlers, validation, and tooltips to migrate them

#### Preserve ALL legacy editor functionality — CRITICAL

**The nuzic editor MUST NOT lose any capability the legacy editor had.**
Before finalizing, verify these features are preserved:
- **Editable committed cells**: value cells must be `readOnly: false`, editable on click
- **Regex must accept `+` prefix**: use `^[+-]?\d+$` not `^-?\d+$` (cells display "+4")
- **Arrow key navigation**: ←/→ between committed value cells
- **Auto-advance delay**: match the legacy delay (300ms for 2-digit, 1000ms for single-digit)
- **Backspace navigation**: on empty input, delete last value or go to previous
- **Visual feedback**: `cursor: text` on editable cells, focus ring on active cell
- **Cascade validation**: editing a middle value must validate ALL subsequent values

The new editor MUST expose the same API:
```javascript
gridEditor = {
  getPairs: () => currentPairs.map(p => ({ ...p })),
  setPairs: (pairs) => { currentPairs = ...; renderEditor(); },
  clear: () => { currentPairs = []; renderEditor(); },
  clearHighlights: () => {},  // REQUIRED: matrix-highlight-controller calls this
  destroy: () => editorEl.remove()
};
```

**CRITICAL**: `clearHighlights()` MUST exist (even as no-op) because
`matrix-highlight-controller` calls `gridEditor.clearHighlights()` on every
pulse. Missing this method breaks ALL highlights and play/stop icon.

### 7k. Random/Reset Integration

After migrating the editor, ensure:
- `gridEditor.setPairs(pairs)` triggers `renderEditor()` internally
- `gridEditor.clear()` resets state and re-renders
- Random function uses `gridEditor.setPairs()` directly
- Reset function uses `gridEditor.clear()` + `musicalGrid.clear()`
- `syncGridFromPairs()` called after every change to update 2D grid

**CRITICAL: Reset must restore DEFAULTS, not set null.**
For plano-modular apps, setting `compas = null` / `cycles = null` makes
`getTotalPulses()` return 0, which erases the grid entirely. Always reset
to default values:

```javascript
// In CONFIG:
DEFAULT_COMPAS: 4,
DEFAULT_CYCLES: 3,

// In handleReset:
compas = CONFIG.DEFAULT_COMPAS;  // NOT null
cycles = CONFIG.DEFAULT_CYCLES;  // NOT null
```

Apply this to BOTH `handleReset()` and `registerFactoryReset({ onReset })`.
Call `scrollToScreen(0, false)` AFTER `updateGrid()` (not before) so the
grid exists when scroll positioning runs.

### 7k-plano. Random for plano-modular apps (multi-registry)

For apps with multiple registries (App19, App20), random note generation must
stay in the same registry for at least 3 consecutive notes before allowing a
registry change. This creates more musical sequences and avoids jarring jumps
that make the autoscroll chaotic.

```javascript
const MIN_NOTES_PER_REGISTRY = 3;
let currentReg = selectableRegs[Math.floor(Math.random() * selectableRegs.length)];
let notesInCurrentReg = 0;

for (let pulse = 0; pulse < totalPulses; pulse++) {
  if (notesInCurrentReg >= MIN_NOTES_PER_REGISTRY && Math.random() < 0.5) {
    const otherRegs = selectableRegs.filter(r => r !== currentReg);
    currentReg = otherRegs[Math.floor(Math.random() * otherRegs.length)];
    notesInCurrentReg = 0;
  }
  const note = Math.floor(Math.random() * NOTES_PER_REGISTRY);
  grid?.selectCell(`${note}r${currentReg}`, pulse);
  notesInCurrentReg++;
}
```

### 7l. Playback: last pulse visible + stopPlayback

The `onComplete` callback must delay `stopPlayback` so the last pulse
highlight is visible:
```javascript
() => {
  const lastNoteDelay = intervalSec * 0.9 * 1000;
  setTimeout(() => stopPlayback(), lastNoteDelay);
}
```

`stopPlayback` should be simple — no internal delays:
```javascript
function stopPlayback() {
  isPlaying = false;
  audio?.stop();
  highlightController?.clearHighlights();
  document.querySelectorAll('.musical-cell.playing').forEach(c => c.classList.remove('playing'));
  playIcon.style.display = 'block';
  stopIcon.style.display = 'none';
}
```

### 7m. Matrix container overflow

The nuzic-theme sets `overflow: visible` on `.matrix-container` so notes
at the last pulse column are not clipped. This is handled globally.

### 7n. Fraction apps — subdivision row BELOW standalone timeline

**Reference implementation: App26** (completed).

Apps de fraccions (App26–31) usen timeline standalone horitzontal + una fila
addicional de ticks de subdivisió SOTA (no sobre) els pulse-numbers. Patró
inspirat a Nuzic Main. Veure [docs/nuzic-editor-migration.md — S19](../../docs/nuzic-editor-migration.md).

**DOM generat per `renderTimeline()`** (dins `.timeline`):

```javascript
// Subdivision label "1/N" — una sola vegada
const label = document.createElement('div');
label.className = 'subdivision-label';
label.textContent = `${numerator}/${denominator}`;
timeline.appendChild(label);

// Per cada subdivisió fraccionària (usar gridFromOrigin de subdivision.js)
grid.subdivisions.forEach(({ subdivisionIndex, position }) => {
  // CRÍTIC: saltar els enters — ja tenen el tick del pulse-number::before
  if (subdivisionIndex === 0) return;

  const marker = document.createElement('div');
  marker.className = 'cycle-marker';
  marker.dataset.position = position;
  timeline.appendChild(marker);

  const fractionalLabel = document.createElement('div');
  fractionalLabel.className = 'cycle-label';
  fractionalLabel.dataset.position = position;
  fractionalLabel.textContent = `.${subdivisionIndex}`;
  timeline.appendChild(fractionalLabel);
});
```

**CSS (copiar d'App26)** — posicions verticals ESTÀTIQUES:

```css
.timeline .cycle-marker       { top: 2.95rem; width: 2px; height: 0.5rem; }
.timeline .cycle-label        { top: 3.8rem;  font-size: clamp(0.95rem, 2vw, 1rem); }
.timeline .subdivision-label  { top: 3.8rem;  right: calc(100% + 0.5rem); }
```

`layoutTimeline()` només gestiona `left: %` per cada element; no tocar `top`
per element inline.

**Dead code típic de fraction apps pre-migració** (netejar a Step 11):
- `bars = []` (endpoint bars legacy)
- `pulseNumberLabels` (duplicat exacte de `pulses`)
- `timelineWrapper` const (del hack bpm-left)
- `computeSubdivisionFontRem` import (no cal si font-size viu a CSS)

### 7o. Fraction apps WITH Pfr editor (App28–31)

**Reference implementation: App28** (completed).

Same subdivision-row pattern as 7n, PLUS a cell-based Pfr editor below the
timeline (App13 aesthetic, App12 P-row mechanics). Layout:
`.middle` fraction-editor (block mode) → timeline → subdivision-row →
`.pfr-row > .pfr-editor` → controls.

#### Fraction editor (N/D) lives in `.middle`

Use `createFractionEditor({ mode: 'block', host: document.querySelector('.middle') })`.
If `pulseSequence: true` is set in renderApp config, template.js injects an
empty `#pulseSeq` inside `.middle`. Detach it before mounting the fraction
editor so they don't share the host:

```javascript
const templatePulseSeq = document.getElementById('pulseSeq');
if (templatePulseSeq?.parentNode) templatePulseSeq.parentNode.removeChild(templatePulseSeq);
```

#### Pfr editor DOM (cell-based, App12 P-row pattern)

```javascript
pfrRow   = document.createElement('div');  pfrRow.className = 'pfr-row';
pfrEditorEl = document.createElement('div');
pfrEditorEl.className = 'pfr-editor';

const label = document.createElement('div');
label.className = 'editor-label editor-label--p';  // reuses App12 class — yellow
label.textContent = 'Pfr';                          // NOT "P" (glossary: Pulso Fraccionado)

pfrCellsEl = document.createElement('div');
pfrCellsEl.className = 'editor-cells';

pfrEditorEl.append(label, pfrCellsEl);
pfrRow.appendChild(pfrEditorEl);
timelineWrapper.parentNode.insertBefore(pfrRow, timelineWrapper.nextSibling);
// ...then move .controls below pfrRow (see Step 7 CRITICAL RULE).
```

#### Rendering the cells

Per committed token: `[white value cell][yellow separator cell]`.
At the end: `[white active-input cell][yellow separator cell]`. Classes reuse
App12's editor-cell vocabulary (`editor-cell editor-cell--p`, `.editor-input`
for the active one). Separators are empty inputs with `placeholder=" "` and
`readOnly=true` — `:placeholder-shown` triggers the yellow-light background.

#### CSS (single-line, square cells — match App13 aesthetic)

```css
.pfr-editor {
  display: grid;
  grid-template-columns: 3.75rem 1fr;  /* label + cells */
}

.pfr-editor .editor-label--p { background: var(--nuzic-yellow); color: white; }

.pfr-editor .editor-cells {
  display: flex;
  flex-wrap: nowrap;               /* MUST NOT wrap — causes zigzag */
  overflow-x: auto;                /* horizontal scroll on high denominators */
  background: var(--nuzic-light);
}

.pfr-editor .editor-cell {
  width: 4%; min-width: 1.875rem;
  flex: none;
  aspect-ratio: 1;                 /* square — same as App13/App15 */
  font-size: clamp(0.75rem, 1.5vw, 1.1rem);  /* shrunk so "5.1" fits */
}
```

#### Token format and validation

Valid tokens: `"N"` (0 ≤ N < Lg) or `"N.M"` (subdivision within cycle).
The `isValidPulseToken`, `pulseTokenValue` and `normalizeToken` helpers live
in the app's main.js — keep them verbatim from the legacy code.

Full set of warnings to migrate via `showValidationWarning(pfrEditorEl, msg)`:
- `"X" no es válido` — format invalid
- `"X" duplicado` — token already in selectedPulses
- `Corregido: orig→fixed` — normalizeToken changed the value
- `6 es el mismo pulso que 0` — special endpoint-wrap case
- `Reposicionando pulsos` — new token's value < at least one existing

#### Pitfalls learned on App28 (avoid on App29–31)

- **DO NOT use `flex-wrap: wrap` on `.editor-cells`.** It turns the editor
  into a multi-row zigzag as soon as the token count exceeds one row. Use
  `flex-wrap: nowrap` + `overflow-x: auto`.
- **DO NOT make cells rectangular.** Follow App13/App15: `width: 4%;
  min-width: 1.875rem; flex: none; aspect-ratio: 1`. Shrink the font
  (`clamp(0.75rem, 1.5vw, 1.1rem)`) so multi-char tokens like `"5.1"` fit.
- **DO NOT pass a getter function to `initIdleCaretFlash`.** It expects DOM
  elements, not thunks — it calls `.addEventListener()` on whatever you pass.
  Anchor the flash on the editor *container* (persistent across renders),
  not on the active input (recreated on every render).
- **DO NOT delete `normalizeToken` when removing the legacy editor block.**
  `parseAndValidateToken` depends on it. If you `sed`-delete the old block,
  re-add the helper (integer normalise + `"N.M"` normalise).
- **DO reuse the template's `#pulseSeq`.** `pulseSequence: true` in renderApp
  inserts an empty `#pulseSeq` into `.middle`. Detach it (don't create a
  duplicate ID) and build your editor outside. Then `.middle` is free for the
  block-mode fraction editor.
- **DO move `.controls` below the editor explicitly.** See Step 7 CRITICAL
  RULE — standalone-timeline apps need this move; template.js places controls
  inside `.timeline-wrapper` by default.

### 7o.visual. Pfr editor — visual alignment patterns (post-Step 7s)

Apply AFTER both 7o (Pfr editor mechanics) and 7s (fraction-editor visual
refactor) are done. These three patterns make the Pfr editor align
perfectly with the timeline above and play well with the selection
system.

Reference: SESSION_STATE.md punt 44. Commits 19acb5b (base),
e39b36e (label + cells), 6b36e33 (active-over-selected).

#### Pattern A: Pfr label aligned vertically with left endcap

Goal: the yellow "Pfr" label sits at the SAME x as the timeline's left
endcap (`.timeline::before`).

The naive approach `.pfr-row { margin: 0.25rem var(--endcap-w) 0 }`
(matching the timeline-wrapper) puts the label at `parent.left + W`,
NOT at the endcap position (`parent.left`).

**Fix**: `margin-left: 0` on the row, compensatory padding on cells:

```css
.pfr-row {
  /* margin-left: 0, margin-right: W. Row spans parent.left to
     parent.right - W (= timeline-wrapper.right). */
  margin: 0.25rem var(--appNN-endcap-w) 0 0;
}

.pfr-editor {
  display: grid;
  /* Column 1 (label) = W: spans parent.left to parent.left + W (same x
     as the endcap below). Column 2 (cells) = remaining. */
  grid-template-columns: var(--appNN-endcap-w) 1fr;
}

.pfr-editor .editor-cells {
  /* `.timeline` inside `.timeline-wrapper` has `margin: 20px auto` =
     1.25rem each side. Cells container starts at parent.left + W (=
     wrapper.left); add 1.25rem padding-left so cells start at
     wrapper.left + 1.25rem = .timeline.left ✓ aligned with cream. */
  padding: 0 1.25rem;
}
```

The result: label.x == endcap.x, AND cells.x == timeline.cream.x.
Vertical alignment of the editor with the timeline above is perfect.

#### Pattern B: Cells visibly square (not rectangular)

The standard cells `width: 4%; aspect-ratio: 1; min-width: 1.875rem`
INSIDE a container with `min-height: 2.5rem` apparently look
"rectangular" at narrow viewports.

Why: at narrow viewports, `min-width` (1.875rem = 30px) wins over `4%`
(< 30px). Cells become 30×30 (square by aspect-ratio). But the
container's `min-height: 2.5rem` (40px) creates 10px of empty space
above and below each cell → the STRIP looks rectangular, not the cells.

**Fix**:

```css
.pfr-editor .editor-cells {
  /* No min-height — container sizes to cell height. */
}

.pfr-editor .editor-cell {
  width: 5%;             /* bigger than 4% */
  min-width: 2.5rem;     /* bigger than 1.875rem */
  flex: none;
  aspect-ratio: 1;
  /* font-size also bigger for the larger cells */
  font-size: clamp(0.85rem, 1.6vw, 1.2rem);
}
```

Now at any viewport the strip is exactly cell-height tall, and cells
are square AND visibly bigger.

#### Pattern C: Active highlight wins over selected during playback

If the Pfr editor app supports SELECTION (cells with `.selected` class,
e.g., blue pill in App28), the playback `.active` highlight must visually
WIN when both classes are present on the same cell. Otherwise the user
can't see the playback progress over their selection.

The JS already adds `.active` to all matching cells/pulses during
playback. The visual conflict is pure CSS: `.selected` and `.active`
have the same specificity, so cascade order determines the winner.
Common trap:

- `.cycle-label.selected` declared AFTER `.cycle-label.active` in the
  app's CSS → `.selected` wins.
- `.pulse-number.selected` in app's CSS (loaded AFTER nuzic-theme.css)
  → wins over nuzic-theme's `.pulse-number.active`.

**Fix**: compound `.selected.active` rules with HIGHER specificity
(`(0,3,0)` vs `.selected` `(0,2,0)`), declared at the END of the file:

```css
/* ACTIVE WINS OVER SELECTED (cascade + specificity) */

.timeline .pulse-number.selected.active,
.timeline .pulse-number.active {
  background: var(--nuzic-yellow);
  color: var(--nuzic-dark);
  border-radius: 2px;
  padding: 0.1rem 0.3rem;
}

.timeline .pulse-number.selected.active::before,
.timeline .pulse-number.selected.active::after,
.timeline .pulse-number.active::before,
.timeline .pulse-number.active::after {
  background: var(--nuzic-yellow) !important;
  opacity: 1 !important;
}

.timeline .cycle-marker.selected.active,
.timeline .cycle-marker.active {
  opacity: 1;
  background: var(--nuzic-yellow);
  box-shadow: 0 0 6px var(--nuzic-yellow);
}

.timeline .cycle-label.selected.active,
.timeline .cycle-label.active {
  color: var(--nuzic-dark);
  background: var(--nuzic-yellow);
  border-radius: 2px;
  padding: 1px 4px;
  opacity: 1;
  font-weight: 700;
}
```

The compound `.selected.active` selector matches when BOTH classes are
present. Since it has higher specificity than either alone, it wins
unambiguously. Apply to `.pulse-number`, `.cycle-marker`, `.cycle-label`
(and any other selection-able element).

Visually: during playback, a selected cell pulses yellow as `.active`
moves through it, then returns to blue (`.selected`) when `.active` moves
to the next cell.

#### Verification

- [ ] Label "Pfr" aligned with timeline's left endcap (zoom in to
      check exact pixel alignment).
- [ ] Cells visibly square at narrow viewports (open DevTools, resize).
- [ ] Cells aligned with timeline cream (no horizontal offset).
- [ ] Select 2-3 cells (one fractional `.1`/`.2`), play → see yellow
      highlight traverse the selected cells without losing the blue.

### 7p. CHECKLIST for migrating legacy validation

**Before replacing any editor, grep the legacy code for:**
1. `showValidationWarning` / `showTooltip` / `infoTooltip.show` / `showInputTooltip` —
   list EVERY message literally (quoted strings). These are the user-facing
   contract; preserve them byte-for-byte, including accents and punctuation.
2. Helper functions like `isValid*`, `normalize*`, `pulseTokenValue` —
   migrate verbatim; don't rewrite. The maths is load-bearing.
3. Auto-reorder / auto-sort logic — re-implement it in the cell-based flow
   using the same threshold (e.g. "would the new value insert in the middle?").
4. Special cases like `"6" → "0"` or `P=7 auto-blur` — these are app-specific
   glossary rules, not nuzic-generic. Hunt them in the legacy and keep them.
5. Per-token vs batch validation — legacy contenteditable editors often
   validated on `blur` (batch). Cell-based editors validate per-commit.
   Translate batch messages to per-token equivalents (drop `"Invalidos:
   a, b, c"` plural forms — one warning per token is enough).

**Verification:** type an invalid token, a duplicate, a normalisable token,
and a reorder-causing token. All four warnings should fire. Any silence
means a rule was lost.

### 7q. Fraction apps WITH iT editor + interval bars (App30–31)

**Reference implementation: App30** (completed).

Like 7o (fraction-pulse apps) but instead of selecting pulses you build a
**sequence of iT values** (durations). Distinctive features:

1. **Cell-based iT editor below the timeline** — same `.itfr-editor` cell pattern
   as App28's Pfr editor: **1 value cell per iT + 1 yellow-light separator
   between**. NOT one cell per subdivision.
2. **Interval bars (rectangles) ON the timeline** — colored bars span each iT's
   duration horizontally, sitting above the timeline line.
3. **Info pastilles + fraction editor in `.middle`** — three-column grid:
   info pastilles on the left (aligned with timeline start), fraction centered,
   right column empty for symmetry.
4. **Drag-to-create iTs on the timeline** — users can drag from a pulse-number
   or cycle-marker to create an iT spanning that range.

#### `.middle` layout (3-column grid, width-synced with timeline)

```css
body[data-visual="nuzic"] .middle.appNN-middle {
  display: grid !important;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  width: 90%;
  max-width: 75rem;
  margin: 0 auto;
  padding: 1rem 1.25rem;
  box-sizing: border-box;
}

.itfr-info-group {
  grid-column: 1;
  justify-self: start;       /* aligned with timeline start */
  display: flex;
  align-items: center;
  gap: 1rem;
}

.itfr-fraction-slot {
  grid-column: 2;
  justify-self: center;      /* centered under timeline */
}
```

The 3-column grid (`1fr auto 1fr`) with the same `width` and `padding`
as `.timeline-wrapper` guarantees the info pastilles sit flush with the
timeline's left edge, and the fraction editor is visually centered above it.

#### Info pastilles as `bpm-inline param` (readonly)

Build the info displays (Suma iT, iT Disponibles) using the `bpm-inline visible
param` class — same golden visual language as BPM:

```javascript
const sumBox = document.createElement('div');
sumBox.className = 'bpm-inline visible param sum-it';
sumBox.innerHTML = `
  <span class="abbr">Suma iT</span>
  <div class="circle">
    <input id="sumItDisplay" type="text" value="0" readonly />
  </div>
`;
```

Readonly inputs with `cursor: default` and centered text. A `.complete`
class changes colour to `var(--nuzic-yellow)` when sum reaches total.

#### Editor cell pattern (1 cell per iT, NOT per subdivision)

Cell structure for a sequence `[iT=4, iT=4, iT=2]`:

```
[4 white][sep yellow-light][4 white][sep yellow-light][2 white][sep yellow-light][input white][sep yellow-light]
```

**Do NOT render one cell per subdivision.** That was my first attempt and it's
wrong: with `Lg=6, d=2` you'd get 12 narrow cream cells and the iT values would
be jammed into just the first cell of each group. The correct pattern (App28)
is one square white cell per iT regardless of duration.

```javascript
function renderItfrEditor() {
  itfrCellsEl.innerHTML = '';
  const realIts = itSequence.filter(it => !it.isSilence);
  realIts.forEach((item, idx) => {
    itfrCellsEl.appendChild(createItfrValueCell(item.it, idx));   // editable white
    itfrCellsEl.appendChild(createItfrSeparatorCell());           // yellow-light
  });
  const sum = realIts.reduce((a, b) => a + b.it, 0);
  if (sum < getTotalSubdivisions()) {
    itfrCellsEl.appendChild(createItfrInputCell());               // trailing input
    itfrCellsEl.appendChild(createItfrSeparatorCell());
  }
}
```

#### Editable value cells with click-to-edit

Value cells are `readOnly=false`. On `blur`:
- Empty value → delete the iT (`removeItAtIndex(entryIndex)`)
- New valid value → `updateItAtIndex(entryIndex, newValue)` + reflow starts
- Invalid → revert to `originalValue` + tooltip

After every mutation call `reflowItSequenceStarts()` so `item.start` stays
contiguous from 0:

```javascript
function reflowItSequenceStarts() {
  let pos = 0;
  for (const item of itSequence) {
    if (item.isSilence) continue;
    item.start = pos;
    pos += item.it;
  }
}
```

#### Double-commit guard (CRITICAL)

The trailing input cell listens to `input` (debounced 500ms), `keydown`
(Enter/Tab), AND `blur`. Without guards, a typed digit triggers all three
and commits twice. Use a local `committed` flag in the closure:

```javascript
function createItfrInputCell() {
  const cell = document.createElement('input');
  // ...
  let committed = false;

  cell.addEventListener('input', () => {
    /* ... */
    itfrCommitTimer = setTimeout(() => {
      if (committed) return;
      committed = true;
      const ok = tryCommitFromInput(cell);
      if (!ok) committed = false;   // allow retry after validation failure
    }, 500);
  });

  cell.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      if (cell.value.trim() && !committed) {
        committed = true;
        const ok = tryCommitFromInput(cell);
        if (!ok) committed = false;
      }
    }
    /* ... */
  });

  cell.addEventListener('blur', () => {
    if (cell.value.trim() && !committed) {
      committed = true;
      const ok = tryCommitFromInput(cell);
      if (!ok) committed = false;
    }
  });
}
```

`tryCommitFromInput` returns `true` on success, `false` on validation failure —
the caller resets `committed = false` so the user can retry without re-focusing.

#### Validation UX: clear cell + keep caret (App30 learning)

When a value fails validation (e.g. user types `0`, or a value exceeding
available subdivisions), DON'T just silently reject. Clear the cell AND
re-focus it so the caret stays active:

```javascript
function tryCommitFromInput(cell) {
  const raw = cell.value.trim();
  if (!raw) return false;

  const parsed = parseAndValidateIt(raw);
  if (!parsed) {
    cell.value = '';
    setTimeout(() => cell.focus(), 10);   // keep caret active
    return false;
  }
  // ... commit successfully
  return true;
}
```

Validation messages should be **specific, not generic**:
- `"iT debe ser ≥ 1"` (for `value < 1`), not `"no es válido"`
- `"iT ${value} excede L iTfr (${available} disponibles)"` (for over-limit),
  showing exactly how many subdivisions remain.

#### Init ordering (CRITICAL)

`initFractionEditorController()` must run BEFORE `createItfrLayout()` +
`renderItfrEditor()`, because the info pastilles (Suma/Disponibles) live in
`.middle` and are created by the fraction editor's host setup. If you render
the editor first, `sumDisplay` and `lengthDisplay` are `null` and
`updateInfoDisplays()` silently no-ops on first render.

```javascript
function init() {
  // 1. Reorder controls
  // 2. Fraction editor FIRST (creates info pastilles in .middle)
  initFractionEditorController();
  // 3. Editor row AFTER timeline
  createItfrLayout();
  // 4. Move controls below editor
  // 5. Render timeline + editor cells
  renderTimeline();
  renderItfrEditor();
}
```

#### Pitfalls learned on App30 (avoid on App31)

- **DO NOT render one cell per subdivision.** Follow App28: 1 square white
  cell per iT + yellow-light separator between. Cell width `4%`, `aspect-ratio: 1`.
- **DO NOT let `input`/`blur`/`keydown` all commit independently.** Use a
  closure-local `committed` flag that resets on validation failure.
- **DO NOT center `.middle` with just `justify-content`.** Use a 3-column grid
  that matches `.timeline-wrapper`'s width/padding so info pastilles align
  with the timeline's left edge.
- **DO NOT call `updateInfoDisplays()` before `initFractionEditorController()`**
  — the pastilles don't exist yet. Reorder init.
- **DO clear the cell + re-focus on validation failure.** A silent reject is
  confusing; the user needs to see their input was rejected AND be able to
  immediately retry.
- **DO use specific validation messages** — `"iT debe ser ≥ 1"` is clearer
  than `"no es válido"`. Show the remaining budget when exceeding limits.

### 7q.visual. iTfr editor — visual alignment patterns (post-Step 7s)

Apply AFTER both 7q (iTfr editor mechanics) and 7s (fraction-editor visual
refactor) are done. These three patterns finalize the App30 visual:
info-pills format, info-pills alignment with right endcap, and halter iT
under the colored bar.

Reference: SESSION_STATE.md punt 46. Commits d4329e8 → 32462f1.

#### Pattern A: Info pills format (no pill — caixa quadrada)

Goal: the "Suma iT" / "iT Disponibles" displays must NOT look like the
default pill ovalada inherited from `bpm-inline visible param`. They
must be a label (negre gruixut) on the left + a square box (vora groga
or cream) on the right, like a "Longitud" info display but with the
specific colors of App30.

**Specificity boost is mandatory.** The nuzic-theme rule
`body[data-visual="nuzic"] .param:not(.param--large):has(.circle > input)
.circle` is (0,5,3) with `!important`. To win, prefix with `body.app30
.itfr-info-group .bpm-inline.visible.param.*` and `!important` on every
declaration:

```css
body[data-visual="nuzic"].app30 .itfr-info-group .bpm-inline.visible.param.sum-it,
body[data-visual="nuzic"].app30 .itfr-info-group .bpm-inline.visible.param.it-disponibles {
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

/* Label (negre gruixut, sense uppercase). */
body[data-visual="nuzic"].app30 .itfr-info-group .bpm-inline.visible.param.sum-it .abbr,
body[data-visual="nuzic"].app30 .itfr-info-group .bpm-inline.visible.param.it-disponibles .abbr {
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

/* Caixa quadrada (vora gruixuda, fons blanc, número centrat). */
body[data-visual="nuzic"].app30 .itfr-info-group .bpm-inline.visible.param.sum-it .circle,
body[data-visual="nuzic"].app30 .itfr-info-group .bpm-inline.visible.param.it-disponibles .circle {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: var(--app30-endcap-w) !important;   /* mateixa amplada que endcap */
  height: var(--app30-endcap-w) !important;  /* quadrada */
  min-width: 0 !important;
  padding: 0 !important;
  border-radius: 4px !important;
  background: white !important;
  overflow: visible !important;
  order: 1 !important;
  flex-shrink: 0 !important;
}

/* Vora intensa per Suma iT (vora groga `--nuzic-yellow`). */
body[data-visual="nuzic"].app30 .itfr-info-group .bpm-inline.visible.param.sum-it .circle {
  border: 3px solid var(--nuzic-yellow, #FFBB33) !important;
}

/* Vora cream per iT Disponibles (`--nuzic-yellow-light`). */
body[data-visual="nuzic"].app30 .itfr-info-group .bpm-inline.visible.param.it-disponibles .circle {
  border: 3px solid var(--nuzic-yellow-light, #ffeecc) !important;
}

body[data-visual="nuzic"].app30 .itfr-info-group .bpm-inline.visible.param.sum-it .circle input,
body[data-visual="nuzic"].app30 .itfr-info-group .bpm-inline.visible.param.it-disponibles .circle input {
  width: 100% !important;
  height: 100% !important;
  background: transparent !important;
  border: none !important;
  text-align: center !important;
  font-weight: 900 !important;
  font-size: clamp(1.1rem, 2.4vw, 1.6rem) !important;
  color: #000 !important;
  font-family: 'Ubuntu', sans-serif !important;
}
```

#### Pattern B: Info pills alineades verticalment amb endcap dret

Goal: the right edge of both info boxes must sit at the SAME x as the
right edge of the timeline's right endcap (`.timeline::after`).

The endcap projects `+W` from `.timeline.right` via `transform:
translateX(calc(100% + 1.25rem))`. Since `.timeline` has `margin: 20px
auto` inside `.timeline-wrapper`, `.timeline.right = wrapper.right -
1.25rem` → endcap.right = `wrapper.right + W`. The wrapper and the
`.middle` share margins (`0 var(--endcap-w)`), so `wrapper.right =
.middle.right = parent.right - W`. Therefore endcap.right =
`parent.right`.

For the info group inside `.middle` to reach `parent.right`, it must
project `+W` beyond `.middle.right`. The `.middle` is
`position: relative` so the group can be absolutely positioned and
projected outside via negative `right`:

```css
.itfr-info-group {
  position: absolute;
  top: 0;
  /* Projectat fora del .middle a la dreta perquè les caixes quedin
     alineades verticalment amb l'endcap dret de la timeline
     (`.timeline::after`, també a `parent.right`). */
  right: calc(0px - var(--app30-endcap-w));
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  align-items: flex-end;
}
```

`.middle` setup (block context, alçada mínima per allotjar les dues
caixes quadrades + gap):

```css
body[data-visual="nuzic"] .middle.app30-middle {
  display: block !important;
  position: relative;
  width: auto;
  max-width: 75rem;
  margin: 0 var(--app30-endcap-w) 5px var(--app30-endcap-w);
  box-sizing: border-box;
  padding: 0;
  /* 2 caixes quadrades W × W + gap → mínim del .middle. */
  min-height: calc(var(--app30-endcap-w) * 2 + 0.4rem);
}

.itfr-fraction-slot {
  display: inline-block;
  vertical-align: top;
}
```

#### Pattern C: Halter iT estil App13

The interval bars on the timeline should use the App13 visual: a colored
rectangle ABOVE + a yellow "halter" (dot-line-box-line-dot, with the iT
number inside the box) just BELOW. This requires:

1. Import `createIntervalLabelBar` from `libs/shared-ui/interval-label-bar.js`.
2. Add `<link>` to `interval-label-bar.css` in `index.html`.
3. In `updateIntervalBars`, emit a colored bar (without internal label)
   + a halter for each iT.

```javascript
import { createIntervalLabelBar } from '../../libs/shared-ui/interval-label-bar.js';

function updateIntervalBars(previewSequence = null) {
  // Clean previous bars + halters.
  intervalBars.forEach(bar => bar.remove());
  intervalBars = [];
  timeline.querySelectorAll('.interval-label-bar').forEach(el => el.remove());

  sequence.forEach((item, idx) => {
    if (item.isSilence) return;

    const startPos = subdivToPosition(item.start);
    const endPos = subdivToPosition(item.start + item.it);
    const startPercent = (startPos / lg) * 100;
    const widthPercent = ((endPos - startPos) / lg) * 100;

    // Barra colorada (SENSE label dins — el halter porta el número).
    const bar = document.createElement('div');
    bar.className = 'interval-bar-visual';
    bar.style.left = `${startPercent}%`;
    bar.style.width = `${widthPercent}%`;
    bar.style.background = VIBRANT_COLORS[idx % VIBRANT_COLORS.length];
    timeline.appendChild(bar);
    intervalBars.push(bar);

    // Halter groc just sota.
    const halter = createIntervalLabelBar({
      startPercent,
      widthPercent,
      label: item.it
    });
    timeline.appendChild(halter);
  });
}
```

CSS necessari (el halter ja porta el seu propi CSS al `interval-label-bar.css`,
només cal posicionar les barres):

```css
/* Barra colorada amunt — deixa espai per al halter groc just sota. */
.interval-bar-visual {
  position: absolute;
  top: -3.3rem;
  height: 1.4rem;
  border-radius: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Halter groc a -1.9rem (just sota la barra colorada, mateix patró App13). */
.interval-label-bar {
  top: -1.9rem;
}
```

També augmentar el `margin-top` del `.timeline-wrapper` perquè les barres
i halter no envaeixin el `.middle` que hi ha a sobre:

```css
.timeline-wrapper {
  width: auto !important;
  max-width: 75rem;
  /* 5.5rem permet veure les barres iT (top: -3.3rem) + halter
     (top: -1.9rem) sense col·lisió amb el .middle. */
  margin: 5.5rem var(--app30-endcap-w) 0.75rem var(--app30-endcap-w);
  position: relative;
}
```

#### Pitfalls learned on App30 (avoid on App31)

- **DO NOT use `grid-template-rows: 1fr 1fr`** to split the info group
  into numerator/denominator-aligned halves. `.bpm-inline.visible.param`
  inherits `height: clamp(2rem, 5vw, 3rem) !important` from nuzic-theme
  → each pill ~48px → two pills ~96px > 76px row → overflow → pills
  centered visually in the middle, NOT at top/bottom. **Use position
  absolute + flex column + gap instead.**
- **DO NOT rely on `display: grid` on `.middle` to align infos with
  fracció**: with multiple inheritance from app-common's `.middle {
  display: flex }`, the grid can compete with content sizing. Use
  `display: block + position: relative` and let the info group be
  absolutely positioned.
- **DO project the info group OUTSIDE `.middle` with negative `right`**:
  `right: calc(0 - var(--endcap-w))` makes the group end at
  `parent.right` (= same x as endcap.right after its `translateX` +
  margin compensation).
- **DO use specificity-boosted selectors (`body.app30 .itfr-info-group
  .bpm-inline.visible.param.*`) + `!important` on EVERY declaration**
  to override nuzic-theme's `(0,5,3) !important` rules. Without this,
  pills won't lose their oval shape.
- **DO emit halter via `createIntervalLabelBar`** — don't reimplement
  inline. The shared module already handles dot-line-box-line-dot
  geometry and `--nuzic-yellow` palette.
- **DO clean halter elements on bar refresh**: `timeline.querySelectorAll(
  '.interval-label-bar').forEach(el => el.remove())` BEFORE emitting
  new halters. Without this, halters accumulate across renders.

#### Verification

- [ ] Suma iT / iT Disponibles look like the App30 reference: label
      bold black + square box with yellow/cream border + number.
- [ ] Right edge of both boxes aligned with right edge of the timeline's
      right endcap (zoom in to check exact pixel alignment).
- [ ] Suma iT just above iT Disponibles (gap ≈ 0.4rem).
- [ ] Each iT in the sequence has a colored bar ABOVE + a yellow halter
      with the iT number JUST BELOW.
- [ ] When the iT sequence changes, no stale halters remain on the
      timeline (count `.interval-label-bar` elements; should equal
      number of non-silence items).

### 7r. Plano 2D apps with fraction (App32–35)

**Reference implementations:**
- **App32** — simple fraction (n=1), fixed Lg=12. Base pattern.
- **App33** — complex fraction (n=2-6, d=2-8), variable Lg = floor(12/n)*n.
  Demonstrates the complex-fraction adaptations on top of App32.

Apps of the form "Plano con Fracción X": a **12-row musical grid** (notes 0-11)
× `Lg * d` columns (subdivisions), where the user drags to create notes on a 2D
canvas. Uses `libs/plano-modular/` (like App19/20) but with the nuzic fraction
editor on top.

Variants:
- **App32**: simple fractions (n=1, d=1-8), `Lg = 12` fixed
- **App33**: complex fractions (n=2-6, d=2-8), `Lg = floor(12/n) * n` variable
- **App34**: simple fraction + N-iT editor below grid (inline port of App20's
  nit-editor, N-only without registry). See "Plano 2D + N-iT editor" below.
- **App35**: complex fraction + N-iT editor (App33 fraction logic + App34
  editor port). Pending migration.

User explicitly requested: **grid must fill the full viewport width** (Option B,
no max-width). Everything below follows from this requirement.

#### Minimum index.html setup

DON'T use `injectBpmAndSoundGroup()` — it prepends BPM into `#gridContainer`
via MutationObserver and hijacks `.controls`, breaking the nuzic reorder logic
that runs later in `init()`. Inject BPM inline directly, like apps 26-31:

```html
<script type="module">
  import { renderApp } from '../../libs/app-common/template.js';
  renderApp({ /* ... standard config ... */ });

  // BPM pastilla directly into .inputs; main.js moves it to .controls.
  const inputsEl = document.querySelector('.inputs');
  if (inputsEl) inputsEl.innerHTML = `<div class="bpm-inline visible" id="bpmParam">...`;

  // Sound group: rename "Pulso" → "Metrónomo", add Subdivisión slot.
  // (Same block copy-pasted from apps 30-31.)

  initHeader();
  import('./main.js');
</script>
```

**ALSO remove `<link rel="stylesheet" href=".../plano-fraccion/plano-fraccion.css" />`** —
see "legacy traps" below.

#### CSS: full viewport width

The default shared-ui layout centers `main` with max-width and gutters. To get
the grid edge-to-edge:

```css
body.appNN main {
  width: 100%;
  max-width: none !important;
  padding: 0 !important;
  margin: 0 !important;
}

#gridContainer.grid-container {
  width: 100%;
  padding: 0;
  margin: 0;
  box-sizing: border-box;
}

.plano-container {
  width: 100%;
  background: var(--bg-light);
}

[data-theme="dark"] .plano-container { background: var(--bg-dark); }
```

#### CSS: CRITICAL — override `min-width: max-content`

`plano-modular.css` sets `min-width: max-content` on `.plano-matrix` and
`.plano-timeline-row`. With `columnSizing: 'fr'` and many subdivisions (e.g.
d=8 → 96 columns), this expands the grid beyond the viewport, causing the
matrix and timeline to disagree on total width:

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
  margin-left: 0 !important;  /* native: 15px */
}
```

Without these overrides, the grid "shrinks" at high d because different rows
compete for width.

#### CSS: CRITICAL — extend `max-height` to include padding-bottom

Both `.plano-soundline-container` and `.plano-matrix-container` have a native
`max-height: visible-rows * cellHeight` that does NOT include the
`padding-bottom: cellHeight/2` of their internal rows. That padding reserves
space for the `-0-` soundline text and for row-0 note bars — but without this
override, the last half-cell is clipped:

```css
.plano-container .plano-soundline-container,
.plano-container .plano-matrix-container {
  max-height: calc(
    var(--plano-visible-rows, 12) * var(--plano-cell-height, 2rem)
    + var(--plano-cell-height, 2rem) / 2
  ) !important;
}
```

This was the root cause of the "soundline pink doesn't reach -0-" and
"note bars for row 0 get cropped" bugs.

#### CSS: `.middle` as 3-column grid

Info pastilles (`Suma iT`, `iT Disponibles`) on the left, fraction centered:

```css
body[data-visual="nuzic"] .middle.appNN-middle {
  display: grid !important;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  width: 100%;
  margin: 0;
  padding: 1rem 1.5rem;
  box-sizing: border-box;
}

.itfr-info-group {
  grid-column: 1;
  justify-self: start;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.itfr-fraction-slot {
  grid-column: 2;
  justify-self: center;
}
```

Info pastilles use `bpm-inline visible param` class (readonly) — same as apps 30-31.

#### Timeline-row: absolute positioning (NOT grid)

**DO NOT** use `grid-template-columns: repeat(N, 1fr)` with `justify-content: flex-start`
and text-indent compensation. This was tried at length and failed: bearing
varies per character, 1fr has floating-point drift, and the `0` gets clipped
by the soundline on the left.

**DO** position each number absolutely by exact percentage:

```javascript
for (let colIdx = 0; colIdx < columns; colIdx++) {
  const numEl = document.createElement('div');
  numEl.className = 'plano-timeline-number';
  const pulseIndex = Math.floor(colIdx / d);
  const subdivIndex = colIdx % d;
  const leftPercent = (colIdx / columns) * 100;
  numEl.style.left = `${leftPercent}%`;

  if (subdivIndex === 0) {
    numEl.classList.add('plano-cycle-start');
    if (pulseIndex < 10) numEl.classList.add('plano-single-digit');
    numEl.textContent = String(pulseIndex);
  } else {
    numEl.classList.add('plano-subdivision');
    numEl.textContent = `.${subdivIndex}`;
  }
  timelineRow.appendChild(numEl);
}
```

```css
.plano-timeline-row {
  min-height: 2.5rem;
  position: relative;
  display: block !important;  /* override plano-modular's grid */
}

.plano-timeline-number {
  position: absolute !important;
  top: 50%;
  transform: translate(-50%, -50%);
  white-space: nowrap;
}
```

Matches exactly: cell N of the matrix is at `N/columns * 100%` (because matrix
uses `repeat(columns, 1fr)`). Numbers at the same percentage align with the
grid's vertical lines. No transforms, no bearing hacks.

**NO endpoint label at `left: 100%`** — the user rejected it.

#### Pulse-boundary lines (thick verticals at integer pulses)

Each cell has a thin line; pulse-start cells have a thick one. This replaces
the radial-gradient dots as the primary vertical grid markers:

```javascript
// In renderGrid(), after updateMatrix():
const cells = gridElements.matrixContainer.querySelectorAll('.plano-cell');
cells.forEach(cell => {
  const colIndex = parseInt(cell.dataset.colIndex, 10);
  if (colIndex % d === 0) cell.classList.add('pulse-boundary');
});
```

```css
.plano-cell {
  border-left: 0.0625rem solid rgba(67, 67, 59, 0.2) !important;
}
.plano-cell.pulse-boundary {
  border-left: 0.125rem solid var(--nuzic-dark, #43433B) !important;
}

/* Dots (radial-gradient) reinforce the border-left line. */
body[data-visual="nuzic"] .plano-cell {
  background-image: radial-gradient(
    circle 0.25rem at 0% 100%,
    var(--nuzic-dark) 45%,
    transparent 46%
  ) !important;
  background-origin: border-box !important;
  background-repeat: no-repeat !important;
}
```

`background-origin: border-box` is required — otherwise the gradient's
`0% 100%` anchor sits inside the padding-box, offset by the border width.

#### Ticks above/below integers: only for single-digit pulses

nuzic-theme's `.plano-timeline-number::before/::after` ticks default to
`left: 7px` (tuned for wide text). For single-digit pulses (0-9) this is
too far right — use `left: 4px`:

```css
body[data-visual="nuzic"] .plano-timeline-number.plano-cycle-start.plano-single-digit::before,
body[data-visual="nuzic"] .plano-timeline-number.plano-cycle-start.plano-single-digit::after {
  left: 4px;
}
```

Two-digit pulses (10, 11) keep the native 7px.

#### Subdivision text visibility: force dark color

In dark mode, `--nuzic-dark` resolves to `#eee8d8` (cream) — invisible on the
cream timeline strip background. Force a constant dark color:

```css
body[data-visual="nuzic"] .plano-timeline-number.plano-subdivision {
  font-size: clamp(0.7rem, 1.4vw, 0.875rem);  /* same as soundline-note */
  color: #43433B !important;
  opacity: 1;
  font-weight: 500;
}
```

Also note the specificity: without `body[data-visual="nuzic"]` prefix, the
app's rule loses to nuzic-theme's `.plano-timeline-number { font-size: ... }`.

#### Soundline pink gradient: stop at `-0-` line

The container is `12.5 * cellHeight` tall (12 rows + cellHeight/2 padding).
The `-0-` text sits at `12 * cellHeight = 96%`. Gradient must fade before
the `-0-`:

```css
body[data-visual="nuzic"] .plano-container .plano-soundline-container {
  background:
    linear-gradient(
      to bottom,
      var(--nuzic-pink-light) 0,
      var(--nuzic-pink-light) calc(100% - var(--plano-cell-height, 2rem) / 0.78),
      transparent calc(100% - var(--plano-cell-height, 2rem) / 0.78),
      transparent 100%
    );
}
```

The divisor `/0.78` is a visual tuning: mathematically `/2` should work (gradient
stops at 96%), but in practice `/0.78` lands the cutoff right at the `-0-`
baseline across theme switches. Do not rename without visual check.

#### Grid full-width with columnSizing='fr' — pitfalls

`calculateCellWidth()` must read the actual rendered cell width AFTER each
render, not compute a predicted value:

```javascript
function calculateCellWidth() {
  const matrix = gridElements?.matrixContainer?.querySelector('.plano-matrix');
  const firstCell = matrix?.querySelector('.plano-cell');
  return firstCell?.offsetWidth || 40;
}
```

Playhead uses DOM-based positioning (cell.offsetLeft path in plano-playhead.js):

```javascript
playheadController = createPlayheadController(
  gridElements.matrixContainer,
  () => 0,  // 0 → triggers DOM path, not cellWidth * colIndex
  0
);
```

ResizeObserver refreshes cellWidth and re-renders notes on viewport changes:

```javascript
if (gridElements?.matrixContainer && typeof ResizeObserver !== 'undefined') {
  let rafId = 0;
  const ro = new ResizeObserver(() => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      cellWidth = calculateCellWidth();
      renderNotes();
    });
  });
  ro.observe(gridElements.matrixContainer);
}
```

#### Note-bar CSS (lost with plano-fraccion.css removal)

`plano-modular.css` has NO `.note-bar` styles — they lived in
`plano-fraccion.css`. Removing that import drops the styles; copy the essentials
into the app:

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
.note-bar:hover { transform: scale(1.02); box-shadow: 0 0.1875rem 0.5rem rgba(0, 0, 0, 0.3); }
.note-bar.highlight { box-shadow: 0 0 0.75rem currentColor; }
.note-bar__label {
  font-size: clamp(0.75rem, 1.4vw, 1rem);
  font-weight: 700;
  color: var(--nuzic-dark, #43433B);
  pointer-events: none;
}
.note-bar-preview {
  position: absolute;
  border-radius: 0.25rem;
  z-index: 9;
  background: var(--nuzic-yellow, #FFBB33);
  opacity: 0.4;
  pointer-events: none;
}
body.dragging-note { cursor: grabbing !important; user-select: none; }
body.dragging-note * { cursor: grabbing !important; }
```

#### Init order (CRITICAL)

```javascript
function init() {
  // 1. BPM controller
  // 2. buildMiddleLayout()     — creates fractionSlot + info pastilles
  // 3. initFractionEditorController()  — uses fractionSlot
  // 4. createGrid()             — inserts gridContainer after timelineWrapper
  // 5. Reorder .controls: Play, BPM, Random, Reset
  // 6. Move .controls below gridContainer
}
```

Calling updateInfoDisplays() before buildMiddleLayout() silently no-ops
(sumDisplay/lengthDisplay are null).

#### Dead code inherited from App30 — DELETE

App32-35 are based on App30, which has a standalone timeline. In the
plano-2D world there's NO external `#timeline` — the grid has its own.
Delete these vestigial pieces:

- `renderTimeline()` — draws on hidden `#timeline`
- `updateIntervalBars()` — duplicate of renderNotes, targets hidden `#timeline`
- `layoutTimeline()` — positions nothing useful
- Variables `pulses`, `bars`, `cycleMarkers`, `cycleLabels`,
  `pulseNumberLabels`, `intervalBars`, `const timeline = ...`
- `attachDragHandlers()` (timeline drag — drag is on grid cells)

Adapt `clearHighlights()`, `highlightPulse()`, `highlightCycle()`, and
`highlightBarAtPosition()` to operate on `gridIntegerLabels`, `gridFractionLabels`,
and `.note-bar` elements inside the matrix.

Net savings: ~150 lines.

#### Things tried that DID NOT work (avoid on App33-35)

- **Phantom pulse (add `d` extra tracks to grid-template-columns)**: creates
  mismatch between `cellWidth` (based on 26 tracks) and logical columns (24
  tracks). Dragging produces random note positions at the phantom area.
  DON'T add extra tracks; accept that integer positions vary slightly with d.
- **`text-indent: -0.3em` on timeline-numbers**: bearing varies per character,
  doesn't compensate consistently. Use absolute positioning instead.
- **`margin-left: -0.8rem` on `.plano-timeline-container`**: same problem,
  constant offset accumulates drift across wide grids.
- **Moving lines with `::before { left: -4px }`**: creates double lines in
  dark mode due to z-index stacking with the default border-left.
- **`padding-bottom: 0` on `.plano-matrix`**: clips row-0 note bars in half.
  The right fix is to EXTEND max-height, not remove padding.
- **`margin-top: -cellHeight/2` + `z-index: 20` on `.plano-timeline-container`**:
  hack to "cover" the padding. Unnecessary with the max-height override.
- **Endpoint label at `left: 100%`**: user rejected it.
- **Centering text in cell (`justify-content: center`)**: shifts lines and
  text together off the grid's natural boundaries — user rejected it.

#### Pitfalls learned on App32 (avoid on App33-35)

- **DO remove `plano-fraccion.css`** from index.html. It contains `max-width: 1000px`
  on `.grid-container`, `display: none` on `.middle`, and a pile of legacy
  pz-row layout that fights the nuzic structure. Copy the few still-useful
  pieces (note-bar styles) into the app's styles.css.
- **DO NOT use `injectBpmAndSoundGroup()`**. Its MutationObserver moves BPM
  into `#gridContainer` async, after init()'s reorder runs. Inject BPM inline
  in index.html and reorder manually in init().
- **DO clamp font-size on the subdivision rule with higher specificity**
  (`body[data-visual="nuzic"] .plano-timeline-number.plano-subdivision`).
  Without the body prefix, nuzic-theme's rule wins and subdivisions end up
  the same size as integers.
- **DO force `color: #43433B !important`** on subdivisions. In dark mode the
  var(--nuzic-dark) resolves to cream — invisible on cream timeline strip.
- **DO use `background-origin: border-box`** on `.plano-cell` so the dot's
  `0% 100%` anchor aligns with the border-left line. Otherwise the dot is
  offset by the border width.
- **DO NOT draw integer labels at `left: 100%`** as a "grid closer" (pulse 12
  endpoint). User confirmed they don't want it.

#### Complex-fraction adaptations (App33, App35)

For apps with **editable numerator n > 1** (complex fractions). Start from the
App32 base and apply these specific changes.

##### Constants and state

```javascript
const BASE_LG = 12;
const DEFAULT_NUMERATOR = 2;
const DEFAULT_DENOMINATOR = 3;
const MIN_NUMERATOR = 2;
const MAX_NUMERATOR = 6;
const MIN_DENOMINATOR = 2;  // Complex fractions require d ≥ 2
const MAX_DENOMINATOR = 8;

let currentNumerator = DEFAULT_NUMERATOR;
let currentDenominator = DEFAULT_DENOMINATOR;
let currentLg = BASE_LG;  // Computed from `calculateVariableLg`
```

##### Imports

```javascript
import {
  calculateVariableLg as _calcLg,
  getTotalSubdivisions as _getTotalSubdivs,
  subdivToPosition as _subdivToPos,
  filterInvalidNotes as _filterInvalid
} from '../../libs/plano-fraccion/fraction-math.js';
import { renderGhostPulseLines } from '../../libs/plano-fraccion/ghost-pulse.js';
import { gcd } from '../../libs/app-common/number-utils.js';
```

##### Fraction editor in complex mode

```javascript
const controller = createFractionEditor({
  mode: 'block',
  host: fractionSlot,
  defaults: { numerator: DEFAULT_NUMERATOR, denominator: DEFAULT_DENOMINATOR },
  autoReduce: true,   // keeps gcd(n, d) = 1
  minNumerator: MIN_NUMERATOR,
  minDenominator: MIN_DENOMINATOR,
  maxNumerator: MAX_NUMERATOR,
  maxDenominator: MAX_DENOMINATOR,
  // ...
});
fractionEditorController.setComplexMode();
```

Also: in `handleFractionChange` update BOTH numerator and denominator, clamp
both, and recompute `currentLg = _calcLg(currentNumerator, BASE_LG)`.

Random generator picks a reduced fraction:
```javascript
let newN, newD;
do {
  newN = Math.floor(Math.random() * (MAX_NUMERATOR - MIN_NUMERATOR + 1)) + MIN_NUMERATOR;
  newD = Math.floor(Math.random() * (MAX_DENOMINATOR - MIN_DENOMINATOR + 1)) + MIN_DENOMINATOR;
} while (gcd(newN, newD) !== 1);
```

##### Timeline logic: App27-style `(colIdx * n) % d === 0`

In complex fractions, each grid cell represents `n/d` pulses, not `1/d`. So
integer pulses occur where `(colIdx * n) % d === 0`, and the pulse number at
that cell is `(colIdx * n) / d`. Apply this formula in THREE places:

1. **`renderGridTimeline`**: choose `plano-cycle-start` vs `plano-subdivision`
   ```javascript
   const positionNumerator = colIdx * n;
   const isIntegerPulse = positionNumerator % d === 0;
   const pulseIndex = positionNumerator / d;  // only meaningful when integer
   ```

2. **`renderGrid`** (pulse-boundary class on matrix cells):
   ```javascript
   if ((colIndex * n) % d === 0) cell.classList.add('pulse-boundary');
   ```

3. **`highlightPulse`** (detect integer pulse from cellIndex):
   ```javascript
   if ((cellIndex * n) % d !== 0) return;
   const pulseIndex = (cellIndex * n) / d;
   ```

For `n=1` all three reduce to the App32 formula, so you can keep these generic
and support both simple and complex fractions with the same code.

##### Ghost pulse lines (App33-specific)

Integer pulses that don't land on a cell boundary (e.g. pulses 1, 3, 5… in
2/3) are drawn as absolute-positioned `.ghost-pulse-line` elements **inside
`.plano-matrix`** via the shared helper:

```javascript
import { renderGhostPulseLines } from '../../libs/plano-fraccion/ghost-pulse.js';

function renderGhostLines() {
  const matrix = gridElements?.matrixContainer?.querySelector('.plano-matrix');
  if (!matrix || !cellWidth) return;
  renderGhostPulseLines(matrix, {
    lg: currentLg,
    numerator: currentNumerator,
    denominator: currentDenominator,
    cellWidth
  });
}
```

Call `renderGhostLines()` right after reading `cellWidth` in `renderGrid`,
and also inside the `ResizeObserver` callback so the positions track viewport
changes.

CSS:
```css
.plano-matrix .ghost-pulse-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 0.125rem;
  background: var(--nuzic-dark, #43433B);
  opacity: 0.4;
  pointer-events: none;
  z-index: 1;
}
```

##### Playback timing: THREE subtly different bugs

Complex fractions exposed three distinct timing bugs that are independent
and must be fixed in order. Get ALL of them right or audio/visual desync.

**Bug 1 — Playhead advances n× faster than audio.**
Cause: `scaledTotal = lg*d` ticks but grid has only `lg*d/n` cells. The
note-provider needs the scaled resolution (notes are scheduled where
`startSubdiv * n === scaledIndex`), but the playhead visual needs to match
the grid cell count.
Fix in `highlightPulse`:
```javascript
const cellIndex = Math.floor(scaledIndex / n);
playheadController.update(cellIndex);
const playheadLeft = cellIndex * cellWidth;  // autoscroll math
```

**Bug 2 — Note-bar highlight advances n× faster than audio.**
Cause: `highlightBarAtPosition` compared pulse-position to note bounds
using `startSubdiv / d`. That's correct for n=1 (cells are 1/d pulses) but
not for n>1 (cells are n/d pulses).
Fix:
```javascript
const startPos = (noteData.startSubdiv * n) / d;
const endPos = ((noteData.startSubdiv + noteData.duration) * n) / d;
```

**Bug 3 — Metronome must click every integer pulse INCLUDING ghosts.**
Cause (initially mis-fixed): for complex fractions, ghost pulses (1, 3, 5,
… in 2/3) fall between cycle boundaries but still need to sound. If you
set `baseResolution = n * d` to fix "metronome n times too fast", ghost
pulses stop sounding entirely.
Correct config:
```javascript
const baseResolution = d;                    // metronome every d ticks
const scaledInterval = (60 / bpm) / d;       // each step = 1/d of a beat
const scaledTotal = lg * d;
```
With `baseResolution = d`, the metronome ticks every `d` scaled steps =
every single real pulse (0, 1, 2, 3, …), including ghosts. Ghost pulses
ARE real pulses that just don't coincide with a subdivision in the cycle.

##### Pitfalls specific to complex fractions (App33)

- **DO keep `baseResolution = d`, NOT `n * d`**. Your first instinct when
  seeing "metronome too fast with complex fractions" is to multiply by n,
  but this kills ghost pulse audio. The metronome *is* already at the right
  rate per-pulse with `d`; the confusion comes from comparing against the
  cycle boundaries (which happen every n pulses), not against pulses.
- **DO NOT forget to adapt `highlightBarAtPosition`**. Even after
  fixing playhead and timeline, the note-bar highlight is a separate code
  path that ALSO needs the `* n / d` conversion. If playhead works but
  bars don't, you've forgotten this.
- **DO re-render ghost pulse lines in ResizeObserver**. They're positioned
  by `cellWidth` which changes with the viewport.
- **DO use `gcd` from `libs/app-common/number-utils.js`** for the random
  generator. Looping until `gcd(n, d) === 1` guarantees a reduced fraction
  that matches `autoReduce: true` on the editor.
- **Timeline of App27 and App33 look similar but aren't the same**. App27
  draws lg = currentNumerator (1 cycle total, all integers 0..n visible).
  App33 draws lg = floor(12/n)*n (multiple cycles) and only shows cycle-
  start pulses in the timeline; ghost integer pulses appear as ghost lines
  on the matrix instead. Both are correct for their app's semantics.

##### Plano 2D + N-iT editor (App34, App35)

Apps with BOTH a plano-2D grid AND an N-iT zigzag editor below it. App34
is the simple-fraction version (done); App35 is the complex-fraction
version (pending). Key additions on top of §7r base:

**Editor placement — full-width BELOW the grid (NOT inside `.middle`)**.
First-attempt mistake: putting the editor container as column 3 of
`.middle` (next to the fraction). Result: editor squeezed into a narrow
vertical column. Correct DOM order is:

```text
.middle (info pastilles | fracció | spacer)
#gridContainer              ← plano-2D grid
#zigzagEditorContainer      ← editor N-iT full-width
.controls                   ← play / bpm / random / reset
```

Create the editor container RIGHT AFTER `createGrid()` and BEFORE
`initZigzagEditor()`:

```javascript
createGrid();
const grid = document.getElementById('gridContainer');
const zig = document.createElement('div');
zig.id = 'zigzagEditorContainer';
zig.className = 'zigzag-editor-container';
grid.parentNode.insertBefore(zig, grid.nextSibling);
initZigzagEditor();
```

Then, when reordering `.controls` to the bottom, use the editor as the
anchor (NOT the grid — otherwise controls land between grid and editor):

```javascript
const anchor = document.getElementById('zigzagEditorContainer') || grid;
anchor.parentNode.insertBefore(controls, anchor.nextSibling);
```

**Port App20's `.nit-editor` implementation INLINE** (see §7f). Do NOT use
`createGridEditor` from `libs/matrix-seq/` — the library renders a
different "cells with gaps" visual that does NOT match App20. Remove the
`<link>` to `libs/matrix-seq/grid-editor.css` and the import of
`createGridEditor` from `matrix-seq/index.js`.

**App34 simplifications vs App20 port** (applicable when the app uses
notes 0-11 without registry notation):

- Drop the `registry` field from `entries[]` → `{ note, temporalInterval, isRest }`.
- Replace `parseNoteInput("5r4")` with `parseN(raw)` → integer 0-11 or `'S'`.
- Drop the `validateNoteRegistry` import → inline `0 ≤ n ≤ 11`.
- Auto-jump delays: 300ms after a complete value, 500ms while waiting for
  a possible second digit (covers "10"/"11"). App20's 800ms is for NrR.
- `formatN(entry) → "5"` or `"S"` (no "5r4" format).

**Preserve ALL validation rules inline**:

- `N: 0-11 o S` — out of range, clear cell, revert.
- `iT: 1-8` — out of range, clear, cancel auto-jump timer.
- `iT máx: N` — where N = `maxTotalPulse - currentSum`, clear cell.
- `iT máx: N` on committed cell edit → **revert to original** (not clear).
- `Longitud completa` on the `.nit-editor-end` marker when sum reaches max.

The tooltip DOM is a single shared node created on-demand at `body`, class
`.nit-editor-tooltip`, auto-hidden at 1500ms. No dependency on
`libs/app-common/info-tooltip.js`.

**Sync back from grid — avoid the infinite loop**: when manual grid edits
call `syncGridToZigzag()` → `editor.setPairs(pairs)`, the editor must NOT
re-fire `onPairsChange` back. Use a `suppressNotify` flag inside the port:

```javascript
let suppressNotify = false;
function notifyChange() { if (suppressNotify) return; handleZigzagChange(entriesToPairs()); }
setPairs: (pairs) => {
  suppressNotify = true;
  entries = ...; renderCells();
  suppressNotify = false;
}
```

**Middle layout — centered fraction with side info pastilles**: use 3-col
grid `1fr auto 1fr`. The `auto` middle column sizes to the fraction; the
two `1fr` outer columns equilibrate the surplus regardless of pastilles
width. An invisible `.itfr-spacer` at col 3 is NOT required for centering
(the `1fr` columns handle it), but can stay empty if present.

```css
body[data-visual="nuzic"] .middle.app34-middle {
  display: grid !important;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
}
.itfr-info-group   { grid-column: 1; justify-self: start; }
.itfr-fraction-slot { grid-column: 2; justify-self: center; }
.itfr-spacer       { grid-column: 3; visibility: hidden; }
```

Do NOT use `auto 1fr auto` — the `auto` at col 3 collapses to content
size (spacer is empty → 0 width) and the fraction slides right.

**Full recipe for App35** (N-iT + complex fraction):

1. **Base**: copy `Apps/App34/main.js` + `styles.css` (already has the
   inline N-iT port + full-width layout + validation tooltips).
2. **Add complex-fraction adaptations** (see "Complex-fraction adaptations"
   above):
   - `fractionEditorController.setComplexMode()` instead of `setSimpleMode()`
   - `MIN_NUMERATOR = 2`, `MAX_NUMERATOR = 6`
   - `calculateVariableLg(n, BASE_LG)` for dynamic Lg
   - `(colIdx * n) % d === 0` formulas in `renderGridTimeline`, `renderGrid`,
     `highlightPulse`
   - `(startSubdiv * n) / d` conversions in `highlightBarAtPosition`
   - `renderGhostPulseLines` in `renderGrid` + ResizeObserver
   - `baseResolution = d` (NOT `n * d` — see App33 metronome bug)
3. **Rename**: body class `app35`, middle class `app35-middle`,
   preferenceStorage prefix.
4. **setMaxTotalPulse on denominator/numerator change**: verify
   `zigzagEditor?.setMaxTotalPulse(getTotalSubdivisions())` fires from
   BOTH numerator and denominator `onChange` callbacks (App34 only needed
   denominator; App35 needs both).
5. **Test playback end-to-end**: playhead, note-bar highlight, metronome
   on every pulse (ghost pulses included). If any desyncs, the cause is
   one of the three roots in the S29 section of
   `docs/nuzic-editor-migration.md`.

Expected effort: 1-2 iterations if both App34 and App33 are solid
references. The novel risk zone is the intersection of N-iT editor with
complex fractions — `setMaxTotalPulse` with variable Lg, and whether the
editor's `maxTotalPulse` is expressed in grid-cells (`lg*d/n`) or pulses
(`lg*d`). Use grid-cells to match `noteData.duration` units in
`handleZigzagChange`.

### 7r.visual. Plano-2D visual refactor (App32 pattern → App33/34/35)

Apply AFTER Step 7r (plano-2D mechanics). This is the **visual
finishing layer** for apps de plànol: adapta el patró Step 7s d'apps
standalone (fracció caixa groga + timeline cream amb endcaps) a la
realitat estructural d'una `.plano-container` grid.

Reference: SESSION_STATE.md punt 47. Commits 44eae90 (refactor base),
fcfedda (cantonada + gap), 8c67347 (margin-top negatius), 2f15be9 /
8fd1417 / 0512661 (polishing final).

#### Why this is different from Step 7s

Apps standalone (App26-31) tenen una `.timeline` única, plana, dins
del `.timeline-wrapper`. Els endcaps grocs es projecten amb
`transform: translateX(±100% ∓ 1.25rem)` fora del cream.

Apps plano-2D (App32-35) tenen una `.plano-container` grid amb
estructura:

```
.plano-container (display: grid; grid-template: 1fr auto / auto 1fr)
├── .plano-container::before       (col 1, row 2 — bottom-left corner)
├── .plano-soundline-container     (col 1, row 1 — left side, pink)
├── .plano-grid-area               (col 2, row 1)
│   └── .plano-matrix-container    (the actual grid of cells)
└── .plano-timeline-container      (col 2, row 2 — bottom, timeline)
    └── .plano-timeline-row
        └── .plano-timeline-number*
```

El Step 7r.visual mapeja cada peça del patró standalone a aquesta
estructura.

#### Pattern A: Triangle corner com a endcap esquerre

L'endcap esquerre de la timeline a apps plano-2D NO és un overlay groc
nou. És la cel·la col 1 row 2 (sota la soundline), que plano-modular ja
implementa via `.plano-container::before` amb background
`var(--plano-soundline-bg)`. Sobreescrivim aquest `::before` amb un
linear-gradient diagonal **triangle**:

```css
body[data-visual="nuzic"].appNN .plano-container::before {
  background: linear-gradient(
    to bottom right,
    var(--nuzic-pink, #f28aad) 0%,
    var(--nuzic-pink, #f28aad) 49.5%,
    var(--nuzic-yellow, #FFBB33) 50.5%,
    var(--nuzic-yellow, #FFBB33) 100%
  ) !important;
  /* Vegeu Pattern B per al margin-top. */
}
```

Resultat: cantonada amb meitat superior-esquerra rosa (continua la
soundline) i meitat inferior-dreta groga (continua la franja groga de
la timeline). Patró com a App30 standalone però adaptat al grid.

**Important**: usar `--nuzic-pink` (intens) per al rosa, no
`--nuzic-pink-light`. El contrast amb el groc és més marcat i el
triangle es veu clarament.

#### Pattern B: Continuïtat visual matrix↔timeline (margin-top negatiu)

`.plano-soundline-row` i `.plano-matrix` tenen
`padding-bottom: cellHeight/2` per fer espai al text `-0-`
(`translateY(50%)`) i als note-bars de la fila 0. Aquest padding deixa
un buit visual entre el contingut i la timeline-row de sota, encara que
`--plano-grid-gap = 0`.

Fix: `margin-top: calc(-1 * cellHeight / 2)` a la cantonada `::before`
i al timeline-container per "menjar-se" aquest padding:

```css
body[data-visual="nuzic"].appNN .plano-container {
  gap: 0 !important;
  position: relative;   /* per al .plano-subdivision-label absolute */
}

body[data-visual="nuzic"].appNN .plano-container::before,
body[data-visual="nuzic"].appNN .plano-timeline-container {
  margin-top: calc(-1 * var(--plano-cell-height, 32px) / 2) !important;
}
```

Així la cantonada s'estén fins al text `-0-` de la soundline i el
timeline-container s'estén fins a la fila 0 del matrix. Sense buits.

#### Pattern C: Timeline cream-yellow gradient + ticks explícits

A apps standalone, la timeline és un únic `.timeline` amb
background-gradient cream/groc i pulse-numbers amb ticks via
`::before/::after` (heretats del nuzic-theme).

A plano-2D, l'estructura és en dos nivells (`.plano-timeline-container >
.plano-timeline-row`). El gradient cream-yellow s'aplica a **TOTS DOS**
amb idèntics colors per garantir continuïtat:

```css
body[data-visual="nuzic"].appNN .plano-timeline-row,
body[data-visual="nuzic"].appNN .plano-timeline-container {
  background:
    linear-gradient(
      to bottom,
      var(--nuzic-yellow-light) 0,
      var(--nuzic-yellow-light) 42px,
      var(--nuzic-yellow) 42px,
      var(--nuzic-yellow) 56px,
      var(--nuzic-yellow-light) 56px,
      var(--nuzic-yellow-light) 100%
    ) !important;
}

body[data-visual="nuzic"].appNN .plano-timeline-container {
  height: var(--appNN-endcap-h) !important;
  min-height: var(--appNN-endcap-h) !important;
  overflow-y: visible !important;
}

.plano-timeline-row {
  min-height: var(--appNN-endcap-h);
  height: var(--appNN-endcap-h);
  position: relative;
  display: block !important;
}
```

**Ticks ::before / ::after** redefinits explícitament (NO heretats del
nuzic-theme, que usen `top: 20%` per a timelines standalone):

```css
body[data-visual="nuzic"].appNN .plano-timeline-number::before {
  top: auto;
  bottom: 100%;
  left: 50%;
  height: 10px;
  transform: translateX(-50%);
  margin-bottom: 4px;
}

body[data-visual="nuzic"].appNN .plano-timeline-number::after {
  top: 100%;
  bottom: auto;
  left: 50%;
  height: 10px;
  transform: translateX(-50%);
  margin-top: 4px;
}

/* Subdivisions: NO ticks (només els enters tenen `|` a sobre/sota). */
body[data-visual="nuzic"] .plano-timeline-number.plano-subdivision::before {
  display: none;
  content: none;
}
body[data-visual="nuzic"] .plano-timeline-number.plano-subdivision::after {
  opacity: 0.55;
}
```

#### Pattern D: Endcap dret + padding-right + insets

L'endcap dret és un pseudo-element `::after` overlay sobre els últims W
px del timeline-container. Cal `padding-right: W` al matrix-container i
timeline-container perquè les divisions verticals no caiguin sota el
groc:

```css
body[data-visual="nuzic"].appNN .plano-timeline-container::after {
  content: '';
  display: block;
  position: absolute;
  top: 0;
  right: 0;
  width: var(--appNN-endcap-w);
  height: 100%;
  background: var(--nuzic-yellow, #FFBB33);
  z-index: 5;
  pointer-events: none;
}

body[data-visual="nuzic"].appNN .plano-matrix-container,
body[data-visual="nuzic"].appNN .plano-timeline-container {
  padding-right: var(--appNN-endcap-w) !important;
  box-sizing: border-box;
}
```

**Variables d'inset** per col 0 i `.plano-cycle-end` perquè caiguin DINS
la cream, no sota els endcaps:

```css
body.appNN {
  --appNN-endcap-w: clamp(1.875rem, 5.25vw, 5rem);
  --appNN-endcap-h: clamp(3.8rem, 4vw, 4.75rem);
  --appNN-timeline-left-label-inset: clamp(0.2rem, 0.7vw, 0.45rem);
  --appNN-timeline-right-label-inset: clamp(0.45rem, 1.1vw, 0.85rem);
}

.plano-timeline-number[data-col-index="0"] {
  left: var(--appNN-timeline-left-label-inset) !important;
  transform: translate(0, -50%);
}

body[data-visual="nuzic"].appNN .plano-timeline-number.plano-cycle-end {
  left: calc(100% - var(--appNN-timeline-right-label-inset)) !important;
  z-index: 6;
}
```

I a JS, afegir el `.plano-cycle-end` (text `·`) a `renderGridTimeline`:

```javascript
const endpointEl = document.createElement('div');
endpointEl.className = 'plano-timeline-number plano-cycle-end';
endpointEl.dataset.colIndex = columns;
endpointEl.style.left = '100%';
endpointEl.textContent = '·';
timelineRow.appendChild(endpointEl);
gridIntegerLabels[FIXED_LG] = endpointEl;
```

#### Pattern E: Subdivision-label a la cantonada-triangle

El label "1/d" viu DINS la zona groga del triangle (cantonada
inferior-esquerra). Com que `::before` és pseudo-element, no podem
afegir-li text amb `content`. El JS posa `.plano-subdivision-label` com
a fill de `.plano-container` (NO del timeline-container), posicionat
absolute:

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
  color: #fff;            /* blanc per contrast sobre el groc */
  pointer-events: none;
  z-index: 6;
}
```

```javascript
// A renderGridTimeline, després d'afegir el .plano-cycle-end:
const planoContainer = gridElements?.container;
if (planoContainer) {
  let subdivisionLabel = planoContainer.querySelector('.plano-subdivision-label');
  if (!subdivisionLabel) {
    subdivisionLabel = document.createElement('div');
    subdivisionLabel.className = 'plano-subdivision-label';
    planoContainer.appendChild(subdivisionLabel);
  }
  subdivisionLabel.textContent = `${FIXED_NUMERATOR}/${d}`;
}
```

#### Pattern F: `--plano-visible-rows: 12` + breakpoints responsius

El default plano-modular és `--plano-visible-rows: 15`, que deixa espai
mort entre `-0-` i la timeline en apps de 12 notes. Override per app:

```css
.plano-container {
  --plano-visible-rows: 12;
}

@media (max-width: 768px) {
  body[data-visual="nuzic"].appNN .plano-container { --plano-visible-rows: 10; }
}
@media (max-width: 600px) {
  body[data-visual="nuzic"].appNN .plano-container { --plano-visible-rows: 9; }
}
@media (max-width: 500px) {
  body[data-visual="nuzic"].appNN .plano-container { --plano-visible-rows: 8; }
}
```

#### Pattern G: `.middle` amb fracció esquerra + info pills dreta

A diferència d'apps standalone, el `.middle` aquí cobreix tot el viewport
(full-width). La fracció s'alinea amb la col 0 del plànol (límit
esquerre del viewport) i el grup d'infos amb el límit dret (NO projectat
fora):

```css
body[data-visual="nuzic"] .middle.appNN-middle {
  display: block !important;
  position: relative;
  width: 100%;
  margin: 0;
  padding: 1rem 0;
  box-sizing: border-box;
  min-height: calc(var(--appNN-endcap-w) * 2 + 0.4rem);
}

.itfr-fraction-slot {
  display: inline-block;
  vertical-align: top;
  margin-left: 0;
}

.fraction-editor {
  position: relative;
  left: 0;            /* a App32 NO és `calc(-W)` — full-width */
  /* ...resta igual que Step 7s. */
}

.itfr-info-group {
  position: absolute;
  top: 0;
  right: 0;           /* a App32 NO és `calc(-W)` — full-width */
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  align-items: flex-end;
}

/* La resta de regles (info pills format, abbr negre, circle width=height=W)
   és idèntica a Step 7q.visual A. */
```

#### Pitfalls learned on App32 (avoid on App33/34/35)

- **DO NOT use overlays grocs `::before`/`::after` NOUS al timeline-row**
  per als endcaps. El `.plano-container` JA TÉ un `::before` per la
  cantonada (col 1 row 2). Sobreescriu el que ja hi és.
- **DO NOT oblidar el `margin-top: -cellHeight/2`** al `::before` i al
  timeline-container. Sense això hi ha un gap de ~16px entre el `-0-`
  i la timeline que ningú entendrà d'on ve.
- **DO usar `--nuzic-pink` (intens), NO `--nuzic-pink-light`** al
  triangle de la cantonada. El light no contrasta prou amb el groc i
  el triangle desapareix.
- **DO aplicar el gradient cream-yellow A BOTHS** `.plano-timeline-row`
  i `.plano-timeline-container`. Si només al row, hi haurà una franja
  visible al voltant del row de l'altre color del container.
- **DO redefinir explícitament `::before`/`::after`** dels pulse-numbers.
  El nuzic-theme els declara amb `top: 20%` (per timelines standalone),
  però en plano-2D els pulse-numbers viuen dins de la fila timeline-row
  que té comportament i alçada diferents.
- **DO usar variables d'inset (`--appNN-timeline-left-label-inset` i
  `right-label-inset`)** per al col 0 i `.plano-cycle-end`. Sense
  això, queden mig-tapats pels endcaps.
- **DO afegir `.plano-cycle-end`** via JS — no existeix per defecte al
  plano-modular renderer. El text és `·` (anàleg a apps standalone).
- **DO posar `.plano-subdivision-label` com a fill de `.plano-container`**
  (no del timeline-container). Necessitem `position: relative` al
  `.plano-container` per ancorar-lo absolute.

#### Verification checklist

- [ ] Cantonada inferior-esquerra: triangle clar rosa (top-left) + groc
      (bottom-right) sense espai entre el `-0-` i el groc.
- [ ] Continuïtat visual: cap gap entre el row 0 del matrix i la
      timeline-row.
- [ ] Timeline: cream amb franja groga centrada sobre els ticks; els
      `|` apareixen damunt i sota de cada pulse-number enter.
- [ ] Pulse-numbers (enters) en negre, `--nuzic-dark`, font-weight 700.
- [ ] Subdivision-numbers (.1, .2, ...) més petits, opacity 0.55.
- [ ] Endcap dret groc al límit dret de la timeline; el `.plano-cycle-end`
      (`·`) cau dins la cream, no sota l'endcap.
- [ ] Subdivision-label "1/d" blanc dins la zona groga del triangle.
- [ ] Fracció (caixa groga vertical) alineada amb el límit esquerre
      del viewport (col 0 del plànol).
- [ ] Info pills "Suma iT" / "iT Disponibles" alineades amb el límit
      dret del viewport.

### 7r.complex. Plano-2D complex-fraction additions (App33 → App35)

Apply AFTER Step 7r.visual when the app has `autoReduce: true`
(App33, App35). On top of the simple-fraction visuals, complex
fractions need three additional patterns: ghost-pulse dots, audio
null-safety, and the same Step 7s.9 adaptations as standalone
complex apps.

Reference: SESSION_STATE.md punt 48. App33 in 8 iterations,
expected 1-2 for App35 since pattern is mature.

#### Pattern A: Step 7s.9 (gap: 0 + bar pseudo-element)

Same as standalone complex apps (App27, App29, App31). Required
because `autoReduce: true` always creates the ghost-fraction:

```css
.fraction-editor-wrapper {
  /* CRÍTIC: ghost-fraction sempre creat (autoReduce: true). Sense
     això el ghost captura el `gap: 1.125rem` default i empeny la
     fracció a la dreta. */
  gap: 0;
}

.fraction-editor .top {
  position: relative;
  width: 100%;             /* NO 65% — full-width perquè els dos
                              spinners projectin a la mateixa x */
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
```

I al `main.js`:
- **NO** passar `enableGhost: false` (App33/App35 usen el ghost).
- `setComplexMode()` enlloc de `setSimpleMode()`.

#### Pattern B: Ghost-pulse dots a tot el matrix

A fraccions complexes (n > 1) hi ha pulses sencers que NO cauen
sobre cap cel·la de la graella (les divisions són n/d, no 1/d).
Aquests "ghost pulses" els dibuixa `renderGhostPulseLines` com a
línies verticals (`<div class="ghost-pulse-line">`) dins de
`.plano-matrix`. Per consistència amb els dots de `.pulse-boundary`,
els reemplacem per **columnes de dots repetits verticalment** (un
dot per fila):

```css
body[data-visual="nuzic"].appNN .ghost-pulse-line {
  position: absolute;
  top: 0;
  /* Reduir bottom per compensar el `padding-bottom` del matrix
     (espai reservat per halters fila 0). */
  bottom: calc(var(--plano-cell-height, 2rem) / 2 + 1.4rem);
  border-left: none !important;
  opacity: 1 !important;
  pointer-events: none;
  /* z-index 11: mateix pla que `.pulse-boundary::before`, per sobre
     del fons opac de les `.plano-cell`. Sense això (a z-index 1)
     els dots quedaven tapats. */
  z-index: 11;
  /* Width 12px: el cercle (4px diameter) té marge lateral. Si el
     width fos 3px (= diameter del cercle), el cercle ocuparia tot
     el background-width i es retallaria pels costats horitzontals,
     fent-lo invisible. */
  width: 12px;
  background-image: radial-gradient(
    /* Cercle al CENTRE de la tile (no a 100% o 0% — aquells
       cauen als límits i es retallen pels stops del repeat). */
    circle 2px at 50% 50%,
    /* rgba 0.68: prou opac per ser llegible sobre fons blanc,
       però menys que el `--nuzic-dark` sòlid dels dots de
       `.pulse-boundary` (que són plens). Jerarquia visual: els
       pulses sencers a cel·les destaquen més que els ghost
       pulses. */
    rgba(67, 67, 59, 0.68) 50%,
    transparent 51%
  );
  background-size: 100% var(--plano-cell-height, 2rem);
  /* background-position-y: cellHeight/2. Desplaça l'origen de la
     repetició perquè el primer cercle (que estava al centre de la
     tile, y=cellHeight/2) caigui ara a y=cellHeight (= primera
     divisió línia entre files). Els següents a 2*cellHeight,
     3*cellHeight, etc. */
  background-position: 0 calc(var(--plano-cell-height, 2rem) / 2);
  background-repeat: repeat-y;
  transform: translateX(-50%);
}
```

#### Pitfalls learned (App33, 8 iterations to find the right combo)

Iteracions fallides abans del fix definitiu:

1. **`::before` puntual** sobre la `.ghost-pulse-line`. Resultat: un
   dot SOL a la fila 0 (no repetit verticalment).
2. **`width: 3px` + `circle 1.5px`** → el cercle ocupava tot el
   width del background, retallat pels costats laterals, invisible.
3. **`circle at 50% 100%` (bottom-center)** → cercle a la cantonada
   inferior, tallat pel límit de la tile. Sense `background-position`
   compensatori, els cercles queden a y = cellHeight, 2*cellHeight,
   ... però RETALLATS pel límit superior de cada tile.
4. **`z-index: 1`** → els `.plano-cell` (background opac per
   `display: grid`) cobrien els dots completament. **Aquesta era la
   causa principal del "no es veuen" inicial.**

Combinació correcta del fix definitiu (App33 commit 87e0a62):
- `z-index: 11` (sobre el background opac).
- `width: 12px` (marge lateral per al dot).
- `circle 2px at 50% 50%` (centre, no retallat).
- `background-position: 0 calc(cellHeight/2)` (desplaçat per
  caure a divisions de fila).
- `rgba(67, 67, 59, 0.68)` (color suau per jerarquia visual).

#### Pattern C: Null-safe audio init

`await _baseInitAudio()` (de `createMelodicAudioInitializer`) pot
retornar `null` silenciosament si:
- `melodic-audio.js` falla en càrrega dinàmica.
- Tone.js no està disponible (e.g., test environment).
- Hi ha un error a l'AudioContext init.

El següent `typeof audio.setMute === 'function'` llança
`TypeError: Cannot read properties of null (reading 'setMute')`
perquè **`typeof` NO protegeix contra `null.X`** (avalua l'accés
al property abans del `typeof`).

Fix: afegir guard `audio &&` davant de cada check:

```javascript
async function initAudio() {
  if (!audio) {
    audio = await _baseInitAudio();

    // Apply saved mute state (defensiu: `audio` pot ser null).
    const savedMute = loadOpt('mute');
    if (audio && savedMute === '1' && typeof audio.setMute === 'function') {
      audio.setMute(true);
    }

    if (audio && baseSoundSelect?.dataset?.value && typeof audio.setBase === 'function') {
      await audio.setBase(baseSoundSelect.dataset.value);
    }
    if (audio && cycleSoundSelect?.dataset?.value && typeof audio.setCycle === 'function') {
      await audio.setCycle(cycleSoundSelect.dataset.value);
    }
    // ...
  }
  return audio;
}
```

Aplicat a App32, App33, App34, App35 al commit 5fffccf. App35 ho
heretarà via `sed` quan migri d'App33.

#### Migration recipe for App35

Paral·lel a App34: combinar visual base d'App33 (complex) + N-iT
editor d'App20.

```bash
# 1. Port literal d'App33 com a baseline
sed 's/app33/app35/g; s/App33/App35/g' Apps/App33/styles.css > Apps/App35/styles.css
sed 's/app33/app35/g; s/App33/App35/g' Apps/App33/index.html > Apps/App35/index.html
# main.js es porta amb cura — la lògica matemàtica complex es manté,
# però cal afegir l'editor N-iT (vegeu Step 7r § "Plano 2D + N-iT
# editor").
```

Heretarà automàticament via sed:
- Tot el Step 7r.visual (triangle, margin-top, gradient, ticks, dots).
- Step 7s.9 (gap:0 + bar pseudo-element).
- Pattern B (ghost-pulse dots fix complet).
- Pattern C (null-safe audio init).
- Math complex (`(colIdx*n) % d === 0`, ghost-pulse-lines,
  timing bugs 1/2/3).

Caldrà afegir explícitament:
- N-iT editor inline-port d'App20, posicionat full-width SOTA el
  grid (vegeu Step 7r § "Plano 2D + N-iT editor" per al patró).
- `setMaxTotalPulse(lg*d/n)` amb Lg variable al `handleZigzagChange`
  (vegeu nota a Step 7r — l'editor expressa `maxTotalPulse` en
  grid-cells, no pulsos).

Expected effort: 1-2 iteracions si App34 i App33 són references
sòlides.

### 7s. Fraction-editor visual refactor + endcaps (App26 pattern → App28/30, then App27/29/31)

This recipe is the **visual finishing layer** on top of 7n/7o/7q. It
turns the fraction `.fraction-editor` into the yellow-bordered vertical
rectangle and adds the yellow `::before`/`::after` endcap squares to the
timeline. **Apply after** the editor migration of 7n/7o/7q is done and
playing correctly.

**Reference**: SESSION_STATE.md punt 41 has the full commit log + lessons.
Applied first in App26 (commit 6b23d3d).

#### 0. Shared CSS variables on `body.appNN`

```css
body.appNN {
  --appNN-endcap-w: clamp(1.875rem, 5.25vw, 5rem);
  --appNN-endcap-h: clamp(3.8rem, 4vw, 4.75rem);
}
```

Why on `body` and not `.middle`: the endcap/label live inside
`.timeline-wrapper`, which is a **sibling** of `.middle` (not a
descendant). Define at the closest common ancestor.

#### 1. Fraction box as vertical rectangle aligned with `::before` endcap

```css
.fraction-editor {
  position: relative;
  /* Aligned x with endcap's left edge — vegeu trap del .timeline margin */
  left: calc(0px - var(--appNN-endcap-w));
  display: flex;
  flex-direction: column;
  align-items: stretch;        /* .top/.bottom fill the inner width */
  justify-content: center;
  width: var(--appNN-endcap-w);
  box-sizing: border-box;
  padding: 0.5rem 0;            /* vertical only — width is fixed */
  border: 3px solid var(--nuzic-yellow);
  border-radius: 0.4rem;
}
```

**CRITICAL TRAP** — `.timeline { width: calc(100% - 40px); margin: 20px
auto }` (from `libs/app-common/styles.css:305`) means `.timeline`'s left
edge is **1.25rem (20px) RIGHT** of its wrapper's left edge. The
endcap's `translateX(-100% - 1.25rem)` already includes that 1.25rem in
**timeline coordinates**. In `.middle`'s coordinates (= timeline-wrapper
coordinates, since they share width), the offset cancels: `left: -W`,
**NOT** `left: -W - 1.25rem`.

#### 2. Yellow endcaps on `.timeline::before` / `::after`

```css
body[data-visual="nuzic"].appNN
  .timeline-wrapper:has(.timeline):not(:has(.soundline-container))
  .timeline::before,
body[data-visual="nuzic"].appNN
  .timeline-wrapper:has(.timeline):not(:has(.soundline-container))
  .timeline::after {
  content: '';
  display: block;
  position: absolute;
  /* Cancel inherited `inset: 0; opacity: 0; border: 2px solid` from
     libs/app-common/styles.css:328 (circular mode legacy). */
  inset: auto;
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

.timeline::before { left: 0; transform: translateX(calc(-100% - 1.25rem)); }
.timeline::after  { right: 0; transform: translateX(calc(100% + 1.25rem)); }
```

**Two critical traps to know**:

1. `nuzic-theme.css` applies `display: none` to `.timeline::before`
   (hides the legacy line). Our selector with `body.appNN` has higher
   specificity and wins.
2. `libs/app-common/styles.css:328` applies `inset: 0; opacity: 0;
   border: 2px solid; border-radius: 50%` to `.timeline::after` (for
   the invisible circular-mode ring). If you DON'T cancel `inset: auto`,
   `right: 0` is ignored (over-constrained with the inherited `left: 0`)
   and the endcap appears at the LEFT of the timeline instead of right.

`z-index: 0` keeps the endcap **below** the `.fraction-info-bubble`
tooltip.

#### 3. Subdivision label "1/N" anchored inside the left endcap

```css
.timeline .subdivision-label {
  position: absolute;
  left: 0;
  top: 0;
  transform:
    translateX(calc(-0.5 * var(--appNN-endcap-w) - 1.25rem - 50%))
    translateY(calc(var(--appNN-endcap-h) - 100% - 0.25rem));
  /* font and color: smaller than the original (it has to fit inside ~3rem wide) */
  font-size: clamp(0.95rem, 1.6vw, 1.15rem);
  font-weight: 700;
  z-index: 1;       /* above the endcap (z-index: 0) */
  /* ... */
}
```

The transform composes:

- **X**: `-0.5W - 1.25rem - 50%` →
  `-0.5W - 1.25rem` is the endcap CENTER in `.timeline` coords;
  `-50%` of the label's own width centers it on that x.
- **Y**: `endcap_h - 100% - 0.25rem` →
  bottom-align inside the endcap, with 0.25rem of internal padding.

#### 4. Intense yellow strip over the cream band (after-tick row)

```css
body[data-visual="nuzic"].appNN
  .timeline-wrapper:has(.timeline):not(:has(.soundline-container))
  .timeline {
  background:
    linear-gradient(
      to bottom,
      transparent 0, transparent 42px,
      var(--nuzic-yellow) 42px,
      var(--nuzic-yellow) 56px,
      transparent 56px, transparent 100%
    ),
    var(--nuzic-yellow-light);
}
```

The pulse-number `::after` ticks live at y ≈ 42-56px of the 60px-tall
`.timeline` (nuzic-theme default). The first layer of the gradient
paints a `--nuzic-yellow` strip; transparent zones above and below let
the `--nuzic-yellow-light` base show through.

**If the timeline height is different in your app, recompute the
gradient stops** (don't blindly copy 42/56px).

The `box-shadow` 1.25rem cream extension on each side of the `.timeline`
stays untouched — the endcaps fill the area beyond the cream, with zero
gap thanks to the `translateX(calc(±100% ∓ 1.25rem))` math.

#### 5. Spinner pill OUTSIDE the box, half-pill shape

```css
.fraction-field { width: 100%; position: relative; }

.fraction-field .spinner {
  position: absolute;
  left: calc(100% + 0.45rem);  /* outside the .fraction-editor right border */
  right: auto;                  /* override original `right: 0` */
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 4px;                     /* visible gap between + and - */
  width: 1.3rem;
  height: 2.8rem;
  background: transparent;      /* so the gap is visible */
  overflow: visible;
}

.fraction-field .spinner .spin.up   { border-radius: 999px 999px 0 0; }
.fraction-field .spinner .spin.down { border-radius: 0 0 999px 999px; }
```

Half-pill shape: rounded at outer ends (top/bottom), straight at the
inner edge facing the other half. With `gap: 4px` and transparent
spinner background, the two halves look like two domes facing each
other without touching.

#### 6. Numbers and bar in pure black (override the default and the disabled-state styles)

```css
.fraction-editor input {
  color: #000 !important;
  font-family: 'Ubuntu', sans-serif;
  font-weight: 900;
  font-size: clamp(1.75rem, 3.8vw, 2.7rem);   /* big enough to fill the rect */
}

.fraction-editor input:disabled,
.fraction-editor input:read-only {
  opacity: 1 !important;         /* override setSimpleMode()'s inline opacity: 0.5 */
  cursor: default !important;
  color: #000 !important;
}

.fraction-editor .top {
  border-bottom: 4px solid #000; /* thick black bar */
  width: 65%;                    /* narrower than full inner width */
  margin: 0 auto;
}
```

The `!important` on `color` is required: some external rule (likely
browser default or framework) paints the editable denominator a
different color from the disabled-state numerator. With `!important`,
both numerator and denominator render in pure black.

#### 7. Distance fraction ↔ timeline

```css
.timeline-wrapper {
  margin: 1.5rem auto 1.875rem;  /* was 3.75rem — too tall a gap */
}
```

The default `.timeline-wrapper` margin-top is `3.75rem`. Reducing to
`1.5rem` brings the band closer to the fraction box without the
spinner pill colliding with the endcap below.

#### 8. Ghost-fraction opt-out (simple-fraction apps only)

In `Apps/AppNN/main.js`, pass `enableGhost: false` to
`createFractionEditor`:

```js
const controller = createFractionEditor({
  mode: 'block',
  host: formula,
  defaults: { numerator: FIXED_NUMERATOR, denominator: currentDenominator },
  enableGhost: false,   // ← App26, App28, App30 (numerator fixed at 1)
  // ... rest of config
});
```

**Apply ONLY to apps with numerator fixed at 1**: App26, App28, App30.
For these, `gcd(1, d) = 1` always, so the fraction is never reducible,
so `animateReduction` is never called, so the ghost DOM (7 sub-elements)
is dead code.

**DO NOT apply to**: App27, App29, App31, App33, App35. These have
`autoReduce: true` with editable numerator — the ghost is actively used
for the reduction preview animation.

#### 9. Complex-fraction adaptations (App27, App29, App31, App33, App35)

When the numerator is editable (`setComplexMode()` + `autoReduce: true`),
the recipe above needs **three additional adaptations**. Reference
implementation: **App27** (commits f59b1f5, 88dea64).

##### 9a. `gap: 0` on `.fraction-editor-wrapper` — CRITICAL

`createFractionEditor` with `autoReduce: true` always creates the
`.fraction-ghost` DOM (used during the reduction animation). The ghost
is **visually empty but is a flex-item** in the wrapper. With the default
`gap: 1.125rem`, the ghost captures that gap and pushes the
`.fraction-editor` 1.125rem to the right. The fraction box ends up
visually misaligned with the `::before` endcap (by ~18px).

**Symptom**: caixa de fracció a la dreta del endcap esquerre, even though
`left: -W` is mathematically correct.

**Fix**:

```css
.fraction-editor-wrapper {
  gap: 0;
}
```

The `.fraction-info-bubble` (tooltip) is `position: absolute`, so it
doesn't depend on the gap.

This is a no-op for simple-fraction apps (App26 with `enableGhost: false`)
because the ghost isn't created there → no flex-item → no gap captured.
But applying `gap: 0` everywhere is safe and avoids the trap if someone
later flips `enableGhost: false` → default.

##### 9b. Fraction bar as pseudo-element (NOT `border-bottom`)

In simple-fraction apps (App26), only the denominator has a visible
spinner (`setSimpleMode()` hides the numerator's). The bar at the top
can be a `border-bottom` with constrained width (`width: 65%`) without
breaking anything.

In complex-fraction apps (App27+), BOTH numerator and denominator have
visible spinners. Each spinner is `position: absolute; left: calc(100%
+ 0.45rem)` relative to its `.fraction-field`. For the **numerator
spinner to project past the editor's right edge** (matching the
denominator spinner's x), the `.fraction-field.numerator` MUST be the
full width of the editor's content area.

If the bar is `border-bottom` of `.top` with `width: 65%`, then
`.fraction-field.numerator` inside `.top` is also 65% wide → its right
edge sits at 82.5% of the editor, and the spinner projects to 82.5% +
0.45rem → **inside** the editor (not flush with the denominator
spinner at 100% + 0.45rem).

**Fix**: keep `.top` and `.fraction-field` at `width: 100%`. Draw the
narrow visual bar as a pseudo-element of `.top`:

```css
.fraction-editor .top {
  position: relative;
  border-bottom: none;
  padding-bottom: 4px;       /* vertical reserve for the bar */
  width: 100%;
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
```

Now both spinners (numerator and denominator) project past the SAME
right edge (100% of editor inner width) and align vertically at the
same x.

The visual bar stays narrow (~65% of editor width) thanks to the
`left: 17.5%; right: 17.5%` insets on the pseudo-element.

##### 9c. Mode complex: `setComplexMode()`, not `setSimpleMode()`

```javascript
const controller = createFractionEditor({
  mode: 'block',
  host: formula,
  defaults: { numerator: DEFAULT_NUMERATOR, denominator: DEFAULT_DENOMINATOR },
  autoReduce: true,         // reduces 2/4 → 1/2 with animation
  minNumerator: 2,
  minDenominator: 2,
  maxNumerator: MAX_NUMERATOR,
  maxDenominator: MAX_DENOMINATOR,
  // NO `enableGhost: false` — keep the default true
  // ... rest of config
});

if (fractionEditorController?.setComplexMode) {
  fractionEditorController.setComplexMode();
}
```

The numerator's input becomes editable (not `readOnly`), its spinner
remains visible (not `display: none`), and the inline `opacity: 0.5`
from `setSimpleMode()` isn't applied.

##### 9d. Highlight `.cycle-label.active` as a yellow rectangle (consistency with `.pulse-number.active`)

When playback highlights a subdivision (`.cycle-label.active`), make it
look like the integer-pulse highlight (`nuzic-theme.css:749`) — same
pattern for consistency:

```css
.timeline .cycle-label.active {
  color: var(--nuzic-dark);
  background: var(--nuzic-yellow);
  border-radius: 2px;
  padding: 1px 4px;
  opacity: 1;
  font-weight: 700;
}
```

This is purely visual and is recommended for **both** simple and complex
fraction apps. Apply when migrating App26-31. The pulse-numbers `0 1 2 3`
already render as yellow rectangles when active (via `pulse-number.active`
in nuzic-theme); the fractional subdivisions `.1 .2 .3` should do the
same.

Applied to App26 and App27 (commit 88dea64) — apply to App28-31 as well
during their visual refactor.

#### Verification checklist

- [ ] Fraction box aligned vertically with the left endcap (zoom in
      to check exact pixel alignment).
- [ ] Endcaps flush with the cream `box-shadow` extension on both
      sides (no visible gap or overlap, regardless of viewport width).
- [ ] `subdivision-label` stays inside the left endcap when resizing
      the viewport between 600px and 1600px wide.
- [ ] Yellow strip stripe shows on the `::after` tick row, NOT
      stretching above the pulse-numbers.
- [ ] Spinner pill OUTSIDE the box, half-pill halves visibly separated.
- [ ] Both numerator and denominator render in pure black.
- [ ] No console errors. No DOM elements with class `fraction-ghost*`
      in `document.querySelectorAll('.fraction-ghost')` if
      `enableGhost: false` was passed.

### 7s.10. Endcaps a apps NO de fracció (App13, App16) — variants del patró

L'endcap pattern (Step 7s.2) també s'aplica a apps amb timeline
standalone que NO són de fracció (App13 "Intervalos Temporales", App16
"Módulo Temporal - Línea"). Aquestes apps tenen estructures pròpies que
requereixen petites adaptacions.

Reference: SESSION_STATE punt 43. Commits cc121c4, 5ac4a0f (App13);
e48a57a, 1f172cf, e6c1454 (App16).

#### App13 pattern (timeline + interval bars + iT editor)

App13 té un `.it-label` groc fix (3.75rem) a l'esquerra del `.it-cells`
(editor). Aplicació estàndard amb dues adaptacions:

1. **Afegir `class="appNN"` al body** si no hi és. Necessari per als
   selectors `body.appNN`. App13 no el tenia.

2. **`.it-label` responsive** amb la mateixa variable de l'endcap:
   ```css
   .it-label {
     width: var(--app13-endcap-w, 3.75rem);  /* era 3.75rem fix */
   }
   ```
   Així l'iT label i l'endcap esquerre escalen junts a qualsevol viewport.

3. **`.timeline-wrapper` margins responsives**:
   ```css
   .timeline-wrapper {
     width: auto !important;  /* override width: 100% de app-common */
     margin: 1rem var(--app13-endcap-w) 0 var(--app13-endcap-w);
   }
   ```
   Math: amb `wrapper.margin-right = W + .timeline.margin auto =
   1.25rem`, l'endcap dret acaba exactament al `parent.right` edge sense
   clipping.

#### App16 pattern (timeline + measure-header)

App16 ja tenia `.timeline::before` com a block "Com." propi (esquerra,
OVERLAPPING la zona del cream esquerre eliminat). Només cal afegir
endcap dret + actualitzar wrapper. **3 traps específics**:

##### Trap A: `transform` falla amb `padding-left + box-sizing: border-box`

App16 té `.timeline { padding-left: var(--com-band-w); box-sizing:
border-box }` per fer espai al "Com." block. Amb aquest setup, el patró
estàndard `right: 0; transform: translateX(calc(100% + 1.25rem))` deixa
l'endcap dret tapat per la timeline (no s'aplica correctament).

**Fix**: posicionament directe sense transform:

```css
.timeline::after {
  display: block;
  content: '';
  position: absolute;
  inset: auto;
  opacity: 1;
  border: 0;
  top: 0;
  left: calc(100% + 1.25rem);   /* past cream box-shadow */
  right: auto;
  width: var(--com-band-w);
  height: 3.75rem;
  background: var(--nuzic-yellow);
  border-radius: 0 4px 4px 0;
  z-index: 1;
  pointer-events: none;
  transform: none;
}
```

Mirror exacte del `.timeline::before` ja existent a App16 (que també usa
`left: -1.25rem` explícit, sense transform).

##### Trap B: `width: 100%` (heretat de app-common) + `margin-right` = overflow

Si fas `.timeline-wrapper { margin-right: var(--com-band-w) }` per
deixar espai al endcap dret, el wrapper continua amb `width: 100%`
heretat de `libs/app-common/styles.css:300`. Amb width:100%, els margins
ADDICIONEN al box (overflow del parent), NO redueixen el content area.
Resultat: el `.timeline.right` segueix al `parent.right` edge i
l'endcap es talla al viewport.

**Fix**: combinar `width: auto !important` + `margin-right`:

```css
.timeline-wrapper {
  width: auto !important;  /* override width: 100% de app-common */
  margin-right: var(--com-band-w);
}
```

Amb width:auto, els margins SÍ redueixen l'available content (com en
App13).

##### Trap C: `width: calc(100% - W)` pot fer desaparèixer altres elements

Un intent alternatiu a Trap B amb `width: calc(100% - var(--com-band-w))`
feia desaparèixer el `.timeline::before` ("Com." block) i la
measure-header. Causa probable: el width literal es resol abans que
algunes regles d'alineament hereters, trencant la cascada.

**Fix**: preferir `width: auto !important + margin-right` (Trap B) per
sobre de `width: calc(...)`.

#### App16 — text "Compás" al measure-header label

Per defecte, `createMeasureHeader` deixa el `.measure-header__label`
sense text (decoratiu). App16 vol mostrar "Compás" dins:

```javascript
measureHeader = createMeasureHeader({
  container: headerEl,
  labelText: 'Compás'  // nova opció (default '' = retro-compat)
});
```

La lib `libs/shared-ui/measure-header.js` accepta `labelText` (default
`''`). Quan passes una cadena no buida, s'aplica com a `textContent` al
label. App19/App20 segueixen sense passar-lo → retro-compat preservada.

#### Variants per a apps similars

| App | Pattern | Notes |
|---|---|---|
| App10 (circular) | Standalone endcaps com App26 | Sense block esquerre propi |
| App11 (timeline simple) | Standalone endcaps com App26 | Sense block esquerre propi |
| App13 ✅ | Endcap + .it-label responsive | Tractat al punt 43 |
| App16 ✅ | .timeline::before (Com.) + .timeline::after (endcap dret) | Tractat al punt 43 |
| App17 (circular + Compás) | TBD — circular pot necessitar pseudos diferents | Aplicar 7s.10 si té timeline lineal embedded |

## Step 8: Idle Caret Flash

Ensure `initIdleCaretFlash` targets the right element:
- Play-only apps: `[document.getElementById('playBtn')]`
- Grid apps: `[document.querySelector('#grid-container')]` or `[gridEditorContainer]`
- Scale apps: `[document.getElementById('scaleSelectorContainer')]`

## Step 9: Verify

1. Open app in browser — check visual consistency
2. Play sequence — verify timeline/soundline highlight
3. Test random/reset buttons
4. Test dark mode (if applicable)
5. Run `npm test` — all tests must pass
6. Compare with reference apps: app13 (standalone), App11A (musical-grid), App20 (plano-modular + N-iT editor), App32 (plano-modular + simple fraction), App33 (plano-modular + complex fraction), App34 (plano-modular + simple fraction + N-iT editor)

## Step 10: First Commit (migració)

Commit amb els canvis nuzic SENSE eliminar codi antic:
```
feat(AppN): migrate to nuzic visual theme

Apply nuzic theme: compact controls, timeline/soundline styling,
editor migration. Legacy CSS preserved pending human review.
```

**IMPORTANT**: Informar l'usuari que cal revisar visualment l'app al navegador
abans de continuar. NO eliminar codi antic sense aprovació.

## Step 11: Neteja post-validació (NOMÉS després d'aprovació humana)

Un cop l'usuari confirma que l'app es veu correcta:

1. **Eliminar CSS legacy** dels controls:
   - Transforms, position absolute, offset variables
   - Responsive breakpoints de controls (mides de play, etc.)
   - `.controls { transform: ... }` duplicats

2. **Eliminar JS legacy** si existeix:
   - `handleItInput`/`handleItKeydown` antics (si s'han substituït)
   - Variables no usades (`sumDisplay`, etc.)

3. **Eliminar imports no usats** (si s'ha tret `initIdleCaretFlash` i reanexat, etc.)

4. **Commit de neteja**:
```
refactor(AppN): remove legacy CSS/JS after nuzic validation

Remove legacy control positioning, old editor handlers, and
unused imports. Validated by human review.
```

**MAI fer Step 11 sense confirmació explícita de l'usuari.**

## Step 12: Mòduls compartits reutilitzables

Quan dues o més apps necessiten el mateix component, el patró nuzic és
extreure-ho a `libs/shared-ui/` (CSS) + `libs/app-common/` (JS) en lloc
de copiar-ho a cada app. Aquesta secció documenta els mòduls existents
i quan fer-los servir.

### Components disponibles

| Component | CSS | JS | Apps que el fan servir |
|---|---|---|---|
| Pastilla "Escala" | `libs/shared-ui/scale-pill.css` | `libs/app-common/scale-pill.js` | App25, App25B |
| Pastilla "Transposición" / "Registro" | `libs/shared-ui/output-note-pill.css` | `libs/app-common/output-note-pill.js` | App18 (Registro, només CSS), App23, App24, App25, App25B |
| Boilerplate viewport | `libs/shared-ui/app-viewport.css` | — | App18, App19, App20, App25, App25B |

### Quan extreure un mòdul nou

Regla pragmàtica: **2 còpies = duplicat**. **3 còpies = mòdul**. Si el
mateix patró apareix a 3 o més apps i és estructural (no només estètic
local), extreure-ho ja val la pena. El cost de moure un patró 1→2 cops
és igual al cost de mantenir-lo, però el cost a 3+ s'amplia.

Característiques que fan un patró candidat:
- Markup HTML similar amb només diferències de label/id/text.
- CSS que combina 50+ línies, més de mitja dotzena de selectors.
- JS amb listeners equivalents (`input`/`keydown`/`blur` + spinners).
- Comportament mantingut entre apps (no és estètica local).

### Pastilla "Escala" (`scale-pill`)

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
  scales: APP25_SCALES, // [{ value, name, id, rotation, ... }]
  initial: 'DIAT-0',
  onChange: (scale) => handleScaleChange({ scaleId: scale.id, rotation: scale.rotation, value: scale.value }),
});
```

CSS-side detall: el `<select>` té un caret SVG inline (cercle rosa
farcit + fletxa blanca cap avall, idèntic al `.spin.down`). Mai
afegir `text-indent` o `padding-right` extra a l'app — ja gestionat al
mòdul.

### Pastilla "Transposición" / "Registro" (`output-note-pill`)

```html
<div class="bpm-inline visible param outputnote" id="outputNoteParam">
  <span class="abbr">Transposición</span>
  <div class="circle">
    <input id="inputOutputNote" type="number" min="0" max="11" value="0" />
    <div class="spinner">
      <button id="outputNoteUp" class="spin up" type="button" aria-label="..."></button>
      <button id="outputNoteDown" class="spin down" type="button" aria-label="..."></button>
    </div>
  </div>
</div>
```

```javascript
import { createOutputNotePill } from '../../libs/app-common/output-note-pill.js';
createOutputNotePill({
  initial: outputNote,
  range: { min: 0, max: 11, cyclic: true },  // o linear clamp si no és cíclic
  onChange: (value) => {
    outputNote = value;
    updateForTransposeChange();
  },
});
```

L'app ha de:
- Afegir `body.appNN { --nuzic-spin-bg: var(--nuzic-pink); --nuzic-spin-bg-hover: #d96a93 }`
  al seu styles.css (override de color).
- Posar `class="appNN"` al `<body>` (sense això el selector no aplica).

La classe `.outputnote` és per "Transposición" i `.registro` és per
"Registro" (App18). Tots dos comparteixen el mateix mòdul CSS amb
selectors duals.

### Boilerplate viewport (`app-viewport`)

```html
<link rel="stylesheet" href="../../libs/shared-ui/app-viewport.css" />
```

Substitueix el bloc:

```css
html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
#app-root { width: 100%; height: 100%; display: flex; flex-direction: column; overflow: hidden; }
#app-root > main, .app-scale-wrapper > main { flex: 1; ... overflow: hidden; }
.app-scale-wrapper { ... }
```

Si l'app necessita scroll dins el `main` (ex. App18 al sistema vertical),
afegeix override amb specificity superior:

```css
@media (max-width: 900px) {
  html[data-embed="true"] body.app18 #app-root > main {
    overflow-y: auto;
  }
}
```

L'`#app-root` (specificity (0,1,0,1)) supera el selector base del mòdul.

## Step 13: Specificity wars amb el nuzic-theme

El `nuzic-theme.css` aplica regles agressives a `.bpm-inline .abbr`,
`.param:has(.circle > input) .abbr` (etc.) amb `!important`. Si una
app vol sobreescriure-les, **NO és suficient** una regla amb la
mateixa specificity al CSS local, perquè `nuzic-theme.css` es carrega
DESPRÉS dels styles.css de l'app a la majoria d'`index.html`. En
empat d'specificity, l'ordre guanya, i el tema mana.

### Càlcul real d'specificity

Regla del nuzic-theme:
```
body[data-visual="nuzic"] .param:not(.param--large):has(.circle > input) .abbr
                   1 attr        1 class    1 class       (0,1,1)         1 class
                                                          dins :has()
→ Total: (0, 5, 3) amb !important
```

El selector `:has(X > Y)` aporta la specificity màxima del contingut
(en aquest cas `.circle` + `input` = (0,1,1)). El `:not(.x)` es compta
com un `class`.

### Patró robust per al mòdul

Per garantir victòria independent de l'ordre de càrrega:

```css
body[data-visual="nuzic"] .bpm-inline.visible.param.outputnote:has(.circle > input) .abbr,
body[data-visual="nuzic"] .bpm-inline.visible.param.outputnote .abbr {
  /* (0, 7, 3) — guanya per specificity, no per ordre */
  font-size: clamp(0.95rem, 1.6vw, 1.25rem) !important;
  font-weight: 700 !important;
  /* ... */
}
```

Pugem amb dos `.classes` extra (`bpm-inline` + `visible`) i mantenim
`!important` a totes les declaracions per resoldre empats amb el
`!important` del nuzic-theme.

### Test pràctic d'specificity

Per saber si el teu fix guanya, **NO et fiïs del càlcul mental** —
obre DevTools a `Computed` i comprova la regla que efectivament
s'aplica. Si veus la regla del nuzic-theme guanyant, augmenta
specificity (afegint més classes a la cadena) o `!important`.

## Step 14: Traps comunes que han bloquejat refactors anteriors

### Trap #1 — Import collision amb funció local existent

Si refactoritzes una app perquè faci servir un mòdul nou, **abans
d'afegir l'`import`** comprova si l'app ja té una funció local amb el
mateix nom:

```bash
grep -nE "function NAME|const NAME =" Apps/AppNN/main.js
```

A l'extracció de `createOutputNotePill` cap a `libs/app-common`, les
apps App23 i App24 ja tenien una funció local del mateix nom (que
generava HTML del template). En afegir l'import nou:

```
Uncaught SyntaxError: Identifier 'createOutputNotePill' has already
been declared.
```

ESM falla al parse → l'app no carrega. **Els tests jest no detecten
això** perquè no executen el bundle. Verifica visualment al navegador.

Solució: renombrar la funció local. Convenció:
- `createXxx()` = helper de cableig/init (mòdul comú).
- `createXxxMarkup()` = helper que només genera HTML.

### Trap #2 — `@import` al `styles.css` duplicat amb `<link>` a HTML

Algunes apps tenen `@import url('libs/musical-grid/musical-grid.css')`
al `styles.css` mentre el `index.html` ja inclou un `<link>` al mateix
fitxer. Doble càrrega + ordre de cascada confús.

```bash
# Detecció:
grep -l "musical-grid.css" Apps/AppNN/index.html
grep -l "musical-grid.css" Apps/AppNN/styles.css
# Si surt a tots dos, eliminar el @import.
```

### Trap #3 — Sistemes de tooltip duplicats

Apps post-migració poden tenir alhora:
- `createInfoTooltip` del mòdul comú (importat).
- Funció local `showTooltip()` amb classe CSS pròpia
  (`.<editor>-tooltip`).

Refactor: la funció local ha de delegar a `infoTooltip.show()` i el
CSS local de la classe s'elimina. Veure el patró net a App25B.

### Trap #4 — `.inputs { display: flex; justify-content: center }` redundant

Aquesta declaració ja ve d'`index.css:535` i `nuzic-theme.css:891`.
A `styles.css` només cal el que és específic d'aquesta app: `gap`,
`padding`, `align-items: flex-end`, `position: relative`, `z-index`.

### Trap #5 — Boilerplate viewport duplicat a 5+ apps

Vegeu Step 12: ja existeix `libs/shared-ui/app-viewport.css`. Substituir
el bloc local d'`html/body/#app-root/main/.app-scale-wrapper` per
l'import del mòdul. Apps que necessiten override (ex. scroll vertical)
ho fan amb selector amb `#app-root` per pujar specificity.

## Step 15: Auditoria post-migració

Quan acabes un refactor, fes una auditoria de codi residual amb
`grep`. Patrons que pots cercar:

```bash
# Imports/símbols no usats:
for sym in $(grep -oE "^import.*{[^}]+}" main.js | ...); do
  count=$(grep -c "\b$sym\b" main.js)
  if [ "$count" -le 1 ]; then echo "UNUSED: $sym"; fi
done

# Funcions definides però no cridades:
fns=$(grep -oE "^function [a-zA-Z][a-zA-Z0-9_]+" main.js | awk '{print $2}')
for f in $fns; do
  count=$(grep -cE "\b${f}\b" main.js)
  if [ "$count" -le 1 ]; then echo "UNUSED: $f"; fi
done

# Patrons pre-nuzic residuals:
grep -nE "two-column-layout|grid-editor.css|controlsLayout|--play-offset|--bpm-offset|--col-left|--controls-scale|order:\s*-1|@media.*orientation|Courier" Apps/AppNN/

# Tooltip duplicat (un sol punt d'ús d'infoTooltip + funció local showTooltip):
grep -n "infoTooltip\|showTooltip" Apps/AppNN/main.js | wc -l
```

Si la skill detecta troballes a apps ja "migrades", reporta-les sense
aplicar canvis directament — proposa el cleanup com a iteració
separada amb l'aprovació de l'usuari.
