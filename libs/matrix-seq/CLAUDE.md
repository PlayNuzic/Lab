# Matrix Sequence — Context for Claude

## Purpose
Utilitats pures de **parsing d'intervals** (sound/temporal) per a l'editor
d'intervals d'App15 i `libs/interval-sequencer`.

## Història
Aquest paquet va contenir un sistema d'editor 2D N×P (`createMatrixSeqController`,
`createDualEditor`, `createGridEditor`, `createDragHandlers`, `createSyncManager`,
`createPairColumnsRenderer`, `createPairStateManager`, parser N/P + CSS). Es va
**eliminar el 2026-06** perquè cap app l'usava — totes tenen els seus editors
inline. Només va quedar `interval-parser.js`, que sí s'usa.

## Exports (`index.js` → `interval-parser.js`)
- `getIntervalRange(currentNote)`
- `validateSoundInterval(currentNote, intervalProposed)`
- `validateTemporalInterval(currentPulse, intervalProposed, maxPulse)`
- `parseIntervalPairs(pairs)`
- `intervalsToPairs(initial, intervals)` — usat per App15 i interval-sequencer
- `formatInterval(interval, type)`
