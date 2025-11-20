/**
 * Interval Parser for App15
 * Handles validation and parsing of interval pairs (iS-iT) with dynamic range checking
 */

/**
 * Calculate valid interval range based on current note
 * @param {number} currentNote - Current note value (0-11)
 * @returns {{min: number, max: number}} Valid interval range
 */
export function getIntervalRange(currentNote) {
  // Notes range from 0 to 11
  const minInterval = 0 - currentNote;      // Can go down to note 0
  const maxInterval = 11 - currentNote;     // Can go up to note 11

  return { min: minInterval, max: maxInterval };
}

/**
 * Validate a sound interval (iS) based on current note
 * @param {number} currentNote - Current note value (0-11)
 * @param {number} intervalProposed - Proposed interval value
 * @returns {{valid: boolean, error?: string}} Validation result
 */
export function validateSoundInterval(currentNote, intervalProposed) {
  const { min, max } = getIntervalRange(currentNote);

  // Check if interval is within valid range
  if (intervalProposed < min || intervalProposed > max) {
    return {
      valid: false,
      error: 'Intervalo demasiado grande'
    };
  }

  return { valid: true };
}

/**
 * Validate a temporal interval (iT) based on current pulse
 * @param {number} currentPulse - Current pulse value (0-7)
 * @param {number} intervalProposed - Proposed interval value
 * @param {number} maxPulse - Maximum pulse value (default 8)
 * @returns {{valid: boolean, adjusted?: number, error?: string}} Validation result
 */
export function validateTemporalInterval(currentPulse, intervalProposed, maxPulse = 8) {
  const remainingPulses = maxPulse - currentPulse;

  // iT must be positive
  if (intervalProposed <= 0) {
    return {
      valid: false,
      error: 'El intervalo temporal debe ser positivo'
    };
  }

  // Check if interval exceeds available space
  if (intervalProposed > remainingPulses) {
    return {
      valid: true,
      adjusted: remainingPulses,
      error: 'Ajustando longitud del iT'
    };
  }

  return { valid: true };
}

/**
 * Parse interval pairs from grid data
 * First pair is N-P (position), rest are iS-iT (intervals)
 * @param {Array} pairs - Array of pair objects
 * @returns {Object} Parsed interval data
 */
export function parseIntervalPairs(pairs) {
  if (!pairs || pairs.length === 0) {
    return {
      initial: null,
      intervals: []
    };
  }

  // First pair is the initial position (N-P)
  const initial = pairs[0];

  // Rest are intervals (iS-iT)
  const intervals = [];
  let currentNote = initial?.note || 0;
  let currentPulse = initial?.pulse || 0;

  for (let i = 1; i < pairs.length; i++) {
    const pair = pairs[i];
    if (pair.soundInterval !== undefined && pair.temporalInterval !== undefined) {
      // Validate sound interval
      const soundValidation = validateSoundInterval(currentNote, pair.soundInterval);
      if (!soundValidation.valid) {
        console.warn(`Invalid sound interval at position ${i}:`, soundValidation.error);
        continue;
      }

      // Validate temporal interval
      const temporalValidation = validateTemporalInterval(currentPulse, pair.temporalInterval);
      if (!temporalValidation.valid) {
        console.warn(`Invalid temporal interval at position ${i}:`, temporalValidation.error);
        continue;
      }

      // Add interval with possible adjustment
      intervals.push({
        soundInterval: pair.soundInterval,
        temporalInterval: temporalValidation.adjusted || pair.temporalInterval,
        originalTemporal: pair.temporalInterval,
        wasAdjusted: !!temporalValidation.adjusted
      });

      // Update current position
      currentNote = (currentNote + pair.soundInterval + 12) % 12;  // Wrap around 0-11
      currentPulse += temporalValidation.adjusted || pair.temporalInterval;
    }
  }

  return {
    initial,
    intervals,
    finalNote: currentNote,
    finalPulse: currentPulse
  };
}

/**
 * Convert intervals back to N-P pairs for visualization
 * @param {Object} initial - Initial N-P pair
 * @param {Array} intervals - Array of interval objects
 * @returns {Array} Array of N-P pairs
 */
export function intervalsToPairs(initial, intervals) {
  if (!initial) return [];

  const pairs = [initial];
  let currentNote = initial.note;
  let currentPulse = initial.pulse;

  for (const interval of intervals) {
    currentNote = (currentNote + interval.soundInterval + 12) % 12;
    currentPulse += interval.temporalInterval;

    pairs.push({
      note: currentNote,
      pulse: currentPulse
    });
  }

  return pairs;
}

/**
 * Format interval for display
 * @param {number} interval - Interval value
 * @param {string} type - 'sound' or 'temporal'
 * @returns {string} Formatted interval string
 */
export function formatInterval(interval, type = 'sound') {
  if (type === 'sound') {
    // Show + for positive intervals, - is implicit
    return interval > 0 ? `+${interval}` : `${interval}`;
  } else {
    // Temporal intervals are always positive
    return `${interval}`;
  }
}