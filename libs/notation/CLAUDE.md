# Notation — Context for Claude

## Purpose
VexFlow-based SVG rhythm staff rendering and musical notation helpers.

## Main Exports
- `createRhythmStaff({ container })` → `{ render(state), destroy() }`
- `drawInterval()` — Single/double staff intervals (iS/iH modes)
- `resolveFractionNotation()`, `isSimpleFraction()` — Fraction helpers
- `buildPulseEvents()` — Builds pulse events for staff rendering
- `createNotationPanelController()`, `createNotationRenderer()` — Panel/renderer

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
