# 2026-04-01: Sincronització Samples-Instruments

## Problema

Desfasament audible: samples (metrònom) sonaven ~2-10ms abans que instruments (piano/flauta).

## Causa arrel

Asimetria arquitectural en l'scheduling del motor d'àudio:
- **Samples**: programats proactivament des del `tick()` del scheduler amb `source.start(when)` on `when` és un temps futur
- **Instruments**: disparats reactivament via `onPulse` callback, que arriba 2-10ms tard pel `postMessage` de l'AudioWorklet. `Math.max(when, now)` convertia temps passats a "ara", afegint retard.

## Solució (3 tiers coexistents)

### Tier 1: Offset compensatori
- `_sampleOffsetSec` retarda samples per compensar latència del callback
- Configurable via `setSampleOffset()`, `configurePerformance({sampleOffsetMs})`, presets, i menú UI
- Fixes suplementaris: cycle/voice amb `_scheduledTimes`, SamplerPool drift compensation, retry init

### Tier 2: `onSchedule` callback
- Nou callback que es dispara des de `tick()` amb el mateix `when` futur que els samples
- `onPulse` reservat per visual, `onSchedule` per àudio

### Tier 3: Providers declaratius
- `registerNoteProvider(id, (step) => [{midi, duration, velocity}])` — el motor gestiona tot l'scheduling
- 13 apps migrades al patró declaratiu

## Fitxers modificats

- `libs/sound/index.js`, `sampler-pool.js`, `melodic-audio.js`
- `libs/shared-ui/performance-audio-menu.js`
- `libs/sound/index.test.js` (17 tests nous)
- 13 apps main.js

## Tests: 73 suites, 1445 tests OK
