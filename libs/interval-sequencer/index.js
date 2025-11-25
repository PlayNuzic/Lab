/**
 * Interval Sequencer Module
 *
 * Complete interval-based musical sequencer system.
 * Provides drag-based iT modification, visualization, and conversion utilities.
 *
 * @module libs/interval-sequencer
 *
 * @example
 * // Basic usage with all-in-one controller
 * import { createIntervalSequencer } from '../../libs/interval-sequencer/index.js';
 *
 * const sequencer = createIntervalSequencer({
 *   musicalGrid,
 *   gridEditor,
 *   totalSpaces: 8,
 *   basePair: { note: 0, pulse: 0 },
 *   autoFillGaps: true,
 *   onIntervalsChange: (intervals, pairs) => {
 *     console.log('Intervals changed:', intervals);
 *   }
 * });
 *
 * sequencer.setPairs(initialPairs);
 *
 * @example
 * // Using individual components
 * import {
 *   createIntervalDragHandler,
 *   createIntervalRenderer,
 *   fillGapsWithSilences,
 *   pairsToIntervals
 * } from '../../libs/interval-sequencer/index.js';
 *
 * // Manual setup for custom integration
 * const renderer = createIntervalRenderer({ ... });
 * const dragHandler = createIntervalDragHandler({ ... });
 */

// Main controller (recommended entry point)
export { createIntervalSequencer } from './interval-controller.js';

// Individual components (for custom setups)
export { createIntervalDragHandler, getSpaceIndexFromPair, getEndSpaceFromPair } from './interval-drag-handler.js';
export { createIntervalRenderer, DEFAULT_INTERVAL_BAR_STYLES, injectIntervalBarStyles } from './interval-renderer.js';

// Conversion utilities
export {
  pairsToIntervals,
  buildPairsFromIntervals,
  validatePairSequence,
  validateIntervalSequence,
  // Re-exports from matrix-seq
  getIntervalRange,
  validateSoundInterval,
  validateTemporalInterval,
  parseIntervalPairs,
  intervalsToPairs,
  formatInterval
} from './interval-converter.js';

// Gap filler utilities
export {
  fillGapsWithSilences,
  detectGaps,
  hasGaps,
  calculateTotalDuration,
  removeSilences
} from './gap-filler.js';
