# Notation — Context for Claude

## Purpose
VexFlow-based SVG rhythm staff rendering and musical notation helpers.

## Main Exports

- `createRhythmStaff({ container })` → `{ render(state), destroy() }` — UN
  pentagrama (App2/App5 i la via single de `createNotationRenderer`). NO el
  toquis sense córrer App2/App5: el seu camí és delicat (història de fixes).
- `createNotationSystem({ container, onPulseSelected, onFractionSelected })` →
  `{ render({lg, staves}), updateCursor, clearCursor, destroy }` — SISTEMA de
  N pentagrames apilats en UN SOL SVG amb UN Formatter compartit (App4
  multi-fracció). Cops simultanis alineats per temps, scroll horitzontal únic,
  un sol playhead. Les notes es posicionen per TEMPS (`setXShift`), no pels
  ticks de VexFlow (que es corrompen amb tuplets densos no-2ⁿ: 5/11, 7/10,
  7/11). Reutilitza `buildPulseEvents` + `resolveFractionNotation`.
- `drawInterval()` — Single/double staff intervals (iS/iH modes)
- `resolveFractionNotation()`, `isSimpleFraction()` — Fraction helpers
- `buildPulseEvents()` — Builds pulse events for staff rendering
- `createNotationPanelController()`, `createNotationRenderer()` — Panel/renderer.
  `createNotationRenderer` tria sistema (si rep `getActiveFractions`, App4) o
  rhythm-staff (single, back-compat) i fa fan-out de `updateCursor`/`resetCursor`.

## Key Rules
- State accepts: `lg` (cycle length), `selectedIndices`, `fraction`, `positions`, `rhythm`
- Note names in Spanish: redonda, blanca, negra, corchea, semicorchea, fusa, semifusa
- Pitch mapping: D3 for pulse 0, C4 for selected, B3 for others
- Supports tuplet grouping and explicit rests
- VexFlow fonts MUST be ready before rendering
- Pulse 0 always renders as note (never rest)
- Pulse Lg excluded from staff (it's a final marker, not selectable)
- Remainder pulses always render as quarter notes, no dots

## Origin
Moved from `libs/app-common/` during Phase 2. Former `notation-utils.js` → now `utils.js`.

## Tests
`fraction-notation.test.js` — Exhaustive coverage of pulse events, remainders, tuplets.
