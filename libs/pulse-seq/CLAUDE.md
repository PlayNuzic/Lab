# Pulse Sequence — Context for Claude

## Purpose
Interactive pulse sequence editor with contenteditable, drag selection, parsing, and persistent memory.

## Main Exports
- `createPulseSeqController(config)` — Standard editor
- `createPulseSeqIntervalsController(config)` — Variant for interval mode (App5)
- `parseTokens(text)` — Parses integers, fractions, gaps from text
- `validateInteger(token)`, `validateFraction(token)` — Validation
- `createPulseSeqStateManager()` — State management
- `createPulseSeqEditor()`, `getMidpoints()`, `normalizeGaps()` — Editor utilities

## Key Rules
- Accepts numeric pulses and fractions (e.g., "0 2 4 1/2")
- Selection via indices and callbacks
- Fragment position epsilon tolerance defined in parser
- Interval variant format: `P ( 1 2 6 ) Lg` — Lg is editable and outside parentheses

## Origin
Moved from `libs/app-common/` during Phase 2 reorganization.
