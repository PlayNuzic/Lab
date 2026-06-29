# Interval Sequencer Module

Motor iTfr de línia de temps, renderer de barres d'interval, i utilitats de
conversió i farciment d'intervals (iS-iT) per a les apps de plano i fracció.

> **Nota (2026-06):** es va eliminar el subarbre mort de l'orquestrador
> (`createIntervalSequencer` + interval-controller.js i interval-drag-handler.js,
> més funcions de converter/gap-filler) perquè cap app l'usava — totes tenen els
> seus editors inline. Aquest README descriu el que queda viu.

## iTfr Engine (línia de temps per subdivisions)

Motor compartit d'App30/App31 (H-21): barres d'interval + halters, drag per
subdivisions amb Pointer Events (els listeners de document només viuen durant
el drag; `pointercancel` neteja sense commit) i highlights de playback. El
model (`{start, it, isSilence}` en subdivisions) viu a l'app via accessors.

```javascript
import { createItfrEngine } from '../../libs/interval-sequencer/index.js';

const engine = createItfrEngine({
  timeline,                     // element contenidor
  colors: VIBRANT_COLORS,
  getLg: () => 6,               // amplada de la línia en polsos
  getNumerator: () => 1,
  getDenominator: () => d,
  getTotalSubdivisions: () => 6 * d,
  getSequence: () => itSequence,
  setSequence: (next) => { itSequence = next; },
  onSequenceChange: () => { /* re-render de l'app */ },
  getEditorCellsHost: () => itfrCellsEl // cel·les .itfr-value a il·luminar
});

// Després de cada renderTimeline de l'app:
engine.bindTimeline({ pulses, cycleMarkers, cycleLabels });
engine.updateIntervalBars();

// Durant playback (l'app hi posa el guard d'isPlaying):
engine.highlightPulse(scaledIndex);
engine.highlightCycle({ cycleIndex, subdivisionIndex });
engine.clearHighlights();
engine.getItIndexAtScaledStart(scaledIndex); // → índex d'iT o -1
```

## Interval Renderer (App15)

Renderitza les barres d'iT a la timeline + matriu (`createIntervalRenderer`).

```javascript
import { createIntervalRenderer } from '../../libs/interval-sequencer/index.js';

const renderer = createIntervalRenderer({
  getTimelineContainer: () => timeline,
  getMatrixContainer: () => matrix,
  totalSpaces: 8
});

renderer.render(intervals);
renderer.highlightBar(1, 300);
renderer.clear();
renderer.destroy();
```

## Conversió i farciment (App15/App20)

```javascript
import {
  pairsToIntervals,       // pares N-P → intervals iS-iT
  fillGapsWithSilences,   // omple forats entre notes amb silencis
  // re-exports de matrix-seq/interval-parser:
  getIntervalRange,
  validateSoundInterval,
  validateTemporalInterval,
  parseIntervalPairs,
  intervalsToPairs,
  formatInterval
} from '../../libs/interval-sequencer/index.js';

const intervals = pairsToIntervals(pairs, { note: 0, pulse: 0 });
const filledPairs = fillGapsWithSilences(pairs, { note: 0, pulse: 0 });
```

## Semántica pulse=START

- `pulse` indica on **comença** la nota.
- `temporalInterval` (iT) indica quants polsos **dura**.
- La nota ocupa polsos des de `pulse` fins a `pulse + iT - 1`.

```javascript
{ note: 5, pulse: 2, temporalInterval: 3 }
// La nota 5 comença al pols 2 i dura 3 polsos → ocupa 2, 3, 4
```

## Tests

```bash
npm test -- --testPathPattern="interval-sequencer"
```

**Cobertura:** 49 tests en 4 suites (gap-filler, interval-converter, itfr-engine, interval-renderer).

## Apps que l'usen

- **App15**: `createIntervalRenderer`, `pairsToIntervals`, `fillGapsWithSilences`
- **App20**: `fillGapsWithSilences`
- **App30/App31**: `createItfrEngine` (via `itfr-engine.js`)

## Dependències

- `libs/matrix-seq/interval-parser.js` (re-exports)

## Fitxers

```
libs/interval-sequencer/
├── index.js                 # Exports vius
├── itfr-engine.js           # Motor iTfr App30/App31 (drag + bars + highlights)
├── interval-renderer.js     # Renderer de barres d'iT (App15)
├── interval-converter.js    # pairsToIntervals + re-exports matrix-seq
├── gap-filler.js            # fillGapsWithSilences
├── README.md                # Aquesta documentació
└── __tests__/
    ├── gap-filler.test.js
    ├── interval-converter.test.js
    ├── interval-renderer.test.js
    └── itfr-engine.test.js
```
