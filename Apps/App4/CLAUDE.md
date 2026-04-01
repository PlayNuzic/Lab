# App4: Multi-Fraction Selection

## Purpose
Manage multiple rhythmic fraction selections over the shared timeline.
Combines inline fraction editor, pulse sequencer, and advanced randomization for complex pattern generation.

## Flow
1. `bindAppRhythmElements('app4')` + `createRhythmLEDManagers`
2. `createSchedulingBridge` + `bindSharedSoundEvents` → `sharedui:*`
3. `createPreferenceStorage({ prefix: 'app4', separator: ':' })`
4. `createPulseSeqController` → contenteditable with drag, caret, persistent `pulseMemoryApi`
5. `fraction-selection.js` → `fractionStore`, `fractionMemory`, helpers for projection and rebuild
6. `createFractionEditor({ mode: 'inline' })` → occupies `FRACTION_INLINE_SLOT_ID`
7. `initRandomMenu` → Lg/V/T, pulse count, fractions (`allowComplex`)
8. Mixer channels: pulse, subdivision, accent

## Key Module: fraction-selection.js
- `registerFractionLabel`, `applyFractionSelectionClasses`
- `rebuildFractionSelections`, `applyRandomFractionSelection`
- Governs how fractions project onto the sequence and layout

## State
- localStorage via `preferenceStorage` (`app4:*`): fractions, random, theme, mute, color, toggles
- Local structures: `fractionStore`, `fractionMemory` (Map), `pulseMemoryApi`, `pulseHits`, `voiceHighlightHandlers`

## Dependencies
All of `libs/app-common/` audio/dom/fraction/loop/mixer/preferences + `libs/shared-ui/` + `libs/sound/`
