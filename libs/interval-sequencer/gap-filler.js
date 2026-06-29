/**
 * Gap Filler Module
 *
 * Automatically inserts silences (rests) when notes don't touch each other.
 * Essential for interval mode to maintain temporal continuity.
 *
 * @module libs/interval-sequencer/gap-filler
 */

/**
 * Fill gaps between notes with automatic silences
 * When a note doesn't touch the previous note, the gap becomes a rest
 *
 * @param {Array<{note: number, pulse: number, temporalInterval?: number, isRest?: boolean}>} pairs - Note-pulse pairs
 * @param {Object} [basePair={note: 0, pulse: 0}] - Base pair for reference (N₀, P₀)
 * @returns {Array} Pairs with gaps filled by silences
 *
 * @example
 * // Input: Note at pulse 0 (iT=2), Note at pulse 5 (gap at 2-4)
 * fillGapsWithSilences([
 *   {note: 3, pulse: 0, temporalInterval: 2},
 *   {note: 5, pulse: 5, temporalInterval: 1}
 * ])
 * // Output: [
 * //   {note: 3, pulse: 0, temporalInterval: 2},
 * //   {note: 3, pulse: 2, temporalInterval: 3, isRest: true},  // Gap filled
 * //   {note: 5, pulse: 5, temporalInterval: 1}
 * // ]
 */
export function fillGapsWithSilences(pairs, basePair = { note: 0, pulse: 0 }) {
  if (!pairs || pairs.length === 0) return pairs || [];

  // Sort pairs by pulse (START position)
  const sorted = [...pairs].sort((a, b) => a.pulse - b.pulse);
  const result = [];

  // Start from base pair pulse position
  let expectedPulse = basePair.pulse ?? 0;
  const baseNote = basePair.note ?? 0;

  sorted.forEach(pair => {
    // If there's a gap, fill with silence
    if (pair.pulse > expectedPulse) {
      const gapSize = pair.pulse - expectedPulse;
      // Use previous note for rest, or base note if first
      const restNote = result.length > 0 ? result[result.length - 1].note : baseNote;
      result.push({
        note: restNote,
        pulse: expectedPulse,
        temporalInterval: gapSize,
        isRest: true
      });
    }

    result.push(pair);
    expectedPulse = pair.pulse + (pair.temporalInterval || 1);
  });

  return result;
}
