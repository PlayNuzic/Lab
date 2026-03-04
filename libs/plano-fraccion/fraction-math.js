/**
 * fraction-math.js — Pure math utilities for plano-fraccion apps.
 *
 * Shared by Apps 32-35.
 */

/**
 * Calculate the variable Lg (total length in pulses) for complex fractions.
 * Returns the largest multiple of `numerator` that fits within `baseLg`.
 *
 * @param {number} numerator  — fraction numerator (cycle length)
 * @param {number} baseLg     — maximum length reference (typically 12)
 * @returns {number}
 *
 * Examples (baseLg=12):
 *   5/7 → floor(12/5)=2 → Lg=10
 *   2/3 → floor(12/2)=6 → Lg=12
 *   3/4 → floor(12/3)=4 → Lg=12
 */
export function calculateVariableLg(numerator, baseLg = 12) {
  const completeCycles = Math.floor(baseLg / numerator);
  return Math.max(1, completeCycles) * numerator;
}

/**
 * Total subdivisions for the given fraction and length.
 *
 * Simple  (n=1): lg * d
 * Complex (n>1): (lg * d) / n
 *
 * @param {number} lg  — total pulses
 * @param {number} n   — numerator
 * @param {number} d   — denominator
 * @returns {number}
 */
export function getTotalSubdivisions(lg, n, d) {
  return (lg * d) / n;
}

/**
 * Convert a subdivision index to its position in pulse-space.
 *
 * @param {number} subdiv — subdivision index
 * @param {number} n      — numerator
 * @param {number} d      — denominator
 * @returns {number}
 */
export function subdivToPosition(subdiv, n, d) {
  return subdiv * n / d;
}

/**
 * Format a pulse value for display (remove trailing decimals when integer).
 *
 * @param {number} value
 * @returns {string}
 */
export function formatPulseValue(value) {
  if (!Number.isFinite(value)) return '0';
  if (Number.isInteger(value)) return String(value);
  return String(Number(value.toFixed(2)));
}

/**
 * Filter notes that exceed the current subdivision count.
 * Trims duration of notes that extend past the boundary.
 * Returns a new array (does not mutate).
 *
 * @param {Array<{startSubdiv:number, duration:number}>} notes
 * @param {number} maxSubdiv — total subdivisions
 * @returns {Array}
 */
export function filterInvalidNotes(notes, maxSubdiv) {
  return notes
    .filter(n => n.startSubdiv < maxSubdiv)
    .map(n => {
      if (n.startSubdiv + n.duration > maxSubdiv) {
        return { ...n, duration: maxSubdiv - n.startSubdiv };
      }
      return n;
    })
    .filter(n => n.duration > 0);
}
