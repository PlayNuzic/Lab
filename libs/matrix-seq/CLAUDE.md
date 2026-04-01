# Matrix Sequence — Context for Claude

## Purpose
2D grid sequencer for Note-Pulse (N-P) pairs. Dual contenteditable inputs, dynamic column generation, multi-voice polyphony.

## Main Exports
- `createGridEditor(config)` — Production grid editor with scroll, multi-voice, auto-merge, auto-sort, keyboard nav
- `createMatrixSeqController(config)` — Dual editor for notes + pulses
- `createPairStateManager()` — N-P pair state
- `parseNotes()`, `parsePulses()`, `validateNote()`, `validatePulse()` — Parsing
- `createIntervalDragHandler()` — Drag handlers for interval mode

## Key Rules
- Notes: free input
- Pulses: must be in ascending order, no duplicates
- Grid auto-sorts columns by pulse value when order changes
- Pulse=7 auto-blur (doesn't jump to note input)
- Dynamic columns created on demand
- Responsive: 4-breakpoint design, optional scroll mode
