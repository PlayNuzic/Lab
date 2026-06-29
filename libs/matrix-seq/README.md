# matrix-seq — Interval parsing utilities

Funcions pures per a parsing i validació d'**intervals** (sound i temporal),
usades per l'editor d'intervals d'App15 i per `libs/interval-sequencer`.

> **Nota (2026-06):** aquest paquet contenia un sistema d'editor 2D Nota-Pols
> (`grid-editor.js`, `matrix-seq.js` / `createMatrixSeqController`, `editor.js`,
> `drag.js`, `sync.js`, `pair-columns.js`, `state.js`, `parser.js` + CSS).
> Es va eliminar perquè cap app l'usava (totes tenen editors inline propis).
> Només es conserva `interval-parser.js`.

## API (`interval-parser.js`)

| Funció | Descripció |
|---|---|
| `getIntervalRange(currentNote)` | Rang d'intervals vàlids des d'una nota |
| `validateSoundInterval(currentNote, intervalProposed)` | Valida un interval de so |
| `validateTemporalInterval(currentPulse, intervalProposed, maxPulse)` | Valida un interval temporal |
| `parseIntervalPairs(pairs)` | Extreu intervals de posicions absolutes |
| `intervalsToPairs(initial, intervals)` | Converteix intervals en parells (inclou el parell base) |
| `formatInterval(interval, type)` | Formata un interval per a visualització |
