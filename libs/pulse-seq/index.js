/**
 * Pulse Sequence Sub-Package
 *
 * Consolidated pulse sequence functionality including:
 * - Main controllers (pulse-seq.js)
 * - Parser utilities (parser.js)
 * - State management (state.js)
 * - Editor utilities (editor.js)
 */

// Main controllers
export { default } from './pulse-seq.js';
export { default as createPulseSeqController } from './pulse-seq.js';
export { createPulseSeqIntervalsController, sanitizePulseSequence } from './pulse-seq.js';

// Parser utilities
export {
  FRACTION_POSITION_EPSILON,
  parseTokens,
  validateInteger,
  nearestPulseIndex,
  validateFraction,
  resolvePulseSeqGap
} from './parser.js';

// State management
export { createPulseSeqStateManager } from './state.js';

// Editor utilities
export { getMidpoints, normalizeGaps, createPulseSeqEditor } from './editor.js';
