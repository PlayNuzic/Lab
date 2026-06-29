/**
 * Interval Converter Module
 *
 * Bidirectional conversion between N-P pairs and iS-iT intervals.
 * Works with the pulse=START semantic where pulse indicates note start position.
 *
 * @module libs/interval-sequencer/interval-converter
 */

// Re-export useful functions from matrix-seq interval-parser
export {
  getIntervalRange,
  validateSoundInterval,
  validateTemporalInterval,
  parseIntervalPairs,
  intervalsToPairs,
  formatInterval
} from '../matrix-seq/interval-parser.js';

/**
 * Convert N-P pairs to iS-iT intervals
 * Inverse of intervalsToPairs - extracts intervals from absolute positions
 *
 * @param {Array<{note: number, pulse: number, temporalInterval?: number, isRest?: boolean}>} pairs - Note-pulse pairs
 * @param {Object} [basePair={note: 0, pulse: 0}] - Base pair for reference (N₀, P₀)
 * @returns {Array<{soundInterval: number, temporalInterval: number, isRest?: boolean}>} Interval array
 *
 * @example
 * // Convert pairs to intervals
 * pairsToIntervals([
 *   {note: 3, pulse: 0, temporalInterval: 2},
 *   {note: 5, pulse: 2, temporalInterval: 1}
 * ], {note: 0, pulse: 0})
 * // Returns: [
 * //   {soundInterval: 3, temporalInterval: 2, isRest: false},
 * //   {soundInterval: 2, temporalInterval: 1, isRest: false}
 * // ]
 */
export function pairsToIntervals(pairs, basePair = { note: 0, pulse: 0 }) {
  if (!pairs || pairs.length === 0) return [];

  const intervals = [];
  let prevNote = basePair.note ?? 0;
  let lastPlayableNote = prevNote;

  pairs.forEach((pair) => {
    const temporalInterval = pair.temporalInterval || 1;
    const isRest = !!pair.isRest;

    // For rests, soundInterval is 0 (note doesn't change)
    const soundInterval = isRest ? 0 : pair.note - prevNote;

    intervals.push({
      soundInterval,
      temporalInterval,
      isRest
    });

    // Update reference note for next interval
    if (!isRest) {
      prevNote = pair.note;
      lastPlayableNote = pair.note;
    } else {
      // After a rest, the reference note is still the last playable note
      prevNote = lastPlayableNote;
    }
  });

  return intervals;
}
