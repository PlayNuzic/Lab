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

/**
 * Build N-P pairs from interval sequence
 * Creates absolute positions from relative intervals
 *
 * @param {Object} basePair - Starting position {note, pulse}
 * @param {Array<{soundInterval?: number, temporalInterval?: number, temporal?: number, isRest?: boolean}>} intervals - Interval array
 * @param {Object} [options={}] - Options
 * @param {boolean} [options.wrapAround=false] - If true, wrap notes around 0-11 range (mod 12)
 * @param {number[]} [options.noteRange=[0, 11]] - Valid note range [min, max]
 * @returns {Array<{note: number, pulse: number, temporalInterval?: number, isRest?: boolean}>} Note-pulse pairs
 *
 * @example
 * // Build pairs from intervals
 * buildPairsFromIntervals(
 *   {note: 0, pulse: 0},
 *   [{soundInterval: 3, temporalInterval: 2}, {soundInterval: 2, temporalInterval: 1}]
 * )
 * // Returns: [
 * //   {note: 0, pulse: 0, isRest: false},  // Base pair
 * //   {note: 3, pulse: 0, temporalInterval: 2, isRest: false},
 * //   {note: 5, pulse: 2, temporalInterval: 1, isRest: false}
 * // ]
 */
export function buildPairsFromIntervals(basePair, intervals = [], options = {}) {
  if (!basePair) return [];

  const { wrapAround = false, noteRange = [0, 11] } = options;
  const [minNote, maxNote] = noteRange;
  const noteRangeSize = maxNote - minNote + 1;

  let currentNote = basePair.note ?? 0;
  let currentPulse = basePair.pulse ?? 0;
  let lastPlayableNote = currentNote;

  // First pair is the base position
  const pairs = [{
    note: currentNote,
    pulse: currentPulse,
    isRest: false
  }];

  intervals.forEach((interval) => {
    // Support both temporalInterval and temporal property names
    const temporal = interval?.temporalInterval ?? interval?.temporal ?? 0;

    // iT must be positive (≥1) - skip invalid intervals
    if (!temporal || temporal <= 0) return;

    const isRest = !!interval.isRest;
    const notePulse = currentPulse;  // Store START position BEFORE advancing
    currentPulse += temporal;         // Advance for NEXT note

    if (isRest) {
      pairs.push({
        note: lastPlayableNote,
        pulse: notePulse,
        temporalInterval: temporal,
        isRest: true
      });
      return;
    }

    const soundInterval = interval.soundInterval ?? 0;
    currentNote += soundInterval;

    // Optional wrap-around (mod 12 for musical notes)
    if (wrapAround) {
      currentNote = ((currentNote - minNote) % noteRangeSize + noteRangeSize) % noteRangeSize + minNote;
    }

    lastPlayableNote = currentNote;

    pairs.push({
      note: currentNote,
      pulse: notePulse,
      temporalInterval: temporal,
      isRest: false
    });
  });

  return pairs;
}

/**
 * Validate that a pair sequence is consistent (no gaps, valid ranges)
 *
 * @param {Array<{note: number, pulse: number, temporalInterval?: number}>} pairs - Pairs to validate
 * @param {Object} [config={}] - Validation config
 * @param {number[]} [config.noteRange=[0, 11]] - Valid note range
 * @param {number} [config.maxPulse=8] - Maximum pulse value
 * @returns {{valid: boolean, errors: string[]}} Validation result
 */
export function validatePairSequence(pairs, config = {}) {
  const { noteRange = [0, 11], maxPulse = 8 } = config;
  const [minNote, maxNote] = noteRange;
  const errors = [];

  if (!pairs || pairs.length === 0) {
    return { valid: true, errors: [] };
  }

  let expectedPulse = pairs[0].pulse;

  pairs.forEach((pair, index) => {
    // Check note range
    if (pair.note < minNote || pair.note > maxNote) {
      errors.push(`Pair ${index}: note ${pair.note} out of range [${minNote}, ${maxNote}]`);
    }

    // Check pulse continuity (for index > 0)
    if (index > 0 && pair.pulse !== expectedPulse) {
      errors.push(`Pair ${index}: expected pulse ${expectedPulse}, got ${pair.pulse}`);
    }

    // Check pulse doesn't exceed max
    const endPulse = pair.pulse + (pair.temporalInterval || 1);
    if (endPulse > maxPulse) {
      errors.push(`Pair ${index}: end pulse ${endPulse} exceeds max ${maxPulse}`);
    }

    // Advance expected pulse
    expectedPulse = pair.pulse + (pair.temporalInterval || 1);
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate that an interval sequence produces valid notes
 *
 * @param {Array<{soundInterval: number, temporalInterval: number}>} intervals - Intervals to validate
 * @param {Object} basePair - Starting position {note, pulse}
 * @param {Object} [config={}] - Validation config
 * @param {number[]} [config.noteRange=[0, 11]] - Valid note range
 * @param {number} [config.maxPulse=8] - Maximum pulse value
 * @returns {{valid: boolean, errors: string[], invalidIndex?: number}} Validation result
 */
export function validateIntervalSequence(intervals, basePair, config = {}) {
  const { noteRange = [0, 11], maxPulse = 8 } = config;
  const [minNote, maxNote] = noteRange;
  const errors = [];
  let invalidIndex = null;

  if (!intervals || intervals.length === 0) {
    return { valid: true, errors: [] };
  }

  let currentNote = basePair?.note ?? 0;
  let currentPulse = basePair?.pulse ?? 0;

  for (let i = 0; i < intervals.length; i++) {
    const interval = intervals[i];
    const iT = interval.temporalInterval ?? interval.temporal ?? 0;
    const iS = interval.soundInterval ?? 0;

    // Check iT is positive
    if (iT <= 0) {
      errors.push(`Interval ${i}: iT must be positive, got ${iT}`);
      if (invalidIndex === null) invalidIndex = i;
      continue;
    }

    // Check resulting note
    const newNote = currentNote + iS;
    if (newNote < minNote || newNote > maxNote) {
      errors.push(`Interval ${i}: iS=${iS} puts note at ${newNote}, out of range [${minNote}, ${maxNote}]`);
      if (invalidIndex === null) invalidIndex = i;
    }

    // Check resulting pulse
    const newPulse = currentPulse + iT;
    if (newPulse > maxPulse) {
      errors.push(`Interval ${i}: iT=${iT} puts pulse at ${newPulse}, exceeds max ${maxPulse}`);
      if (invalidIndex === null) invalidIndex = i;
    }

    // Update position (even if invalid, to continue checking)
    if (!interval.isRest) {
      currentNote = newNote;
    }
    currentPulse = newPulse;
  }

  return {
    valid: errors.length === 0,
    errors,
    invalidIndex
  };
}
