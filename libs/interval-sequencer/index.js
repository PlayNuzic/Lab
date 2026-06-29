/**
 * Interval Sequencer Module — utilitats d'intervals vives
 *
 * Nota (2026-06): es va eliminar el subarbre mort de l'orquestrador
 * (`createIntervalSequencer` + interval-controller.js i interval-drag-handler.js,
 * més funcions de converter/gap-filler) perquè cap app l'usava. Queda el que
 * s'usa: motor iTfr (App30/31), createIntervalRenderer i pairsToIntervals (App15),
 * fillGapsWithSilences (App15/20) i els re-exports de matrix-seq.
 *
 * @module libs/interval-sequencer
 */

// Motor iTfr de línia de temps (App30/App31)
export { createItfrEngine } from './itfr-engine.js';

// Renderer de barres d'interval (App15)
export { createIntervalRenderer } from './interval-renderer.js';

// Conversion utilities + re-exports de matrix-seq
export {
  pairsToIntervals,
  getIntervalRange,
  validateSoundInterval,
  validateTemporalInterval,
  parseIntervalPairs,
  intervalsToPairs,
  formatInterval
} from './interval-converter.js';

// Gap filler
export { fillGapsWithSilences } from './gap-filler.js';
