# App5: Pulsaciones — Temporal Intervals

## Purpose
Rhythmic training app focused on temporal intervals (spaces between positions) instead of exact pulse positions.
Unlike App2 (pulses 0 to Lg), App5 uses pulsaciones numbered 1 to Lg, where each represents a temporal interval.

## Key Differences from App2
- No pulse 0: timeline starts from pulse 1
- All pulses selectable (no special endpoints)
- Sequence format: `P ( 1 2 6 8 ) 12` — Lg outside parentheses, editable
- Audio channels: "Pulsaciones" (all), "Seleccionados" (selected), optional "Intervalo 1"
- iT blocks (visual interval blocks) appear between consecutive selected pulses

## Gamification System
4 progressive levels with two phases: Pattern Selection → Rhythm Synchronization.

**Phase 1 (Selection):** User writes correct positions per level requirement, validates with Enter.
**Phase 2 (Sync):** User synchronizes with rhythm via keyboard (Space) or microphone (experimental).

Levels: (1) Odd positions, (2) Even positions, (3) Dynamic/random, (4) Free mode.
Tolerance: 300ms, pass threshold: 40%, success: 60%.

**Capture modes:** Keyboard (recommended, default) | Microphone (experimental, -22dB threshold).
Debug: `window.debugGame` (només amb `?dev=1` a la URL, H-06) — See `GAME_DEBUG.md` for full API.

## New Modules Created
- `libs/temporal-intervals/` — `it-calculator.js`, `it-renderer.js`, `it-styles.css`
- `libs/app-common/pulse-seq-intervals.js` — Adapted sequence controller

## Compatibility
Changes to shared modules are opt-in. App2 maintains its behavior unchanged.
Memory indexing: `pulseMemory` indexed 1 to Lg (index 0 unused).
