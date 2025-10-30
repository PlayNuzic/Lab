/**
 * Number utilities - Consolidated module for all number operations
 *
 * Provides utilities for:
 * - Safe parsing (integer, float, positive)
 * - Locale-aware parsing and formatting (Catalan support)
 * - Math operations (GCD, LCM)
 * - Range utilities (validation, normalization)
 * - Random number generation
 *
 * @module libs/app-common/number-utils
 *
 * Consolidated from:
 * - number.js (parsing, math, range resolution)
 * - number-utils.js (locale formatting, random)
 * - range.js (simple range utilities)
 */

// ============================================================================
// PARSING - Safe number parsing with validation
// ============================================================================

/**
 * Parse a positive integer, returns null if invalid or non-positive
 * @param {*} value - Value to parse
 * @returns {number|null} Parsed positive integer or null
 */
export function parsePositiveInt(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Parse an integer safely, returns NaN if invalid
 * @param {*} value - Value to parse
 * @returns {number} Parsed integer or NaN
 */
export function parseIntSafe(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : NaN;
}

/**
 * Parse a float safely, returns NaN if invalid
 * @param {*} value - Value to parse
 * @returns {number} Parsed float or NaN
 */
export function parseFloatSafe(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

/**
 * Convert value to number with fallback (simple utility)
 * @param {*} value - Value to normalize
 * @param {number} fallback - Fallback value if conversion fails
 * @returns {number} Normalized number ready for calculations
 * @remarks Useful for persisted configuration ranges
 */
export function toNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

// ============================================================================
// FORMATTING - Locale-aware number formatting
// ============================================================================

/**
 * Creates a number formatter with locale-specific parsing and formatting
 *
 * @param {Object} options - Configuration options
 * @param {string} options.locale - Locale string (default: 'ca-ES')
 * @param {number} options.maxDecimals - Maximum decimal places (default: 2)
 * @param {number} options.minDecimals - Minimum decimal places (default: 0)
 * @returns {Object} Formatter instance with parseNum and formatNumber methods
 *
 * @example
 * const { parseNum, formatNumber } = createNumberFormatter();
 * parseNum('1.234,56')  // => 1234.56
 * formatNumber(1234.56) // => '1.234,56'
 */
export function createNumberFormatter(options = {}) {
  const {
    locale = 'ca-ES',
    maxDecimals = 2,
    minDecimals = 0
  } = options;

  /**
   * Parse a number with support for Catalan locale format
   *
   * Handles:
   * - Catalan format: "1.234,56" (dot as thousands separator, comma as decimal)
   * - Standard format: "1234.56" (dot as decimal)
   * - Mixed formats: "1,234.56" (comma as thousands, dot as decimal)
   *
   * @param {string|number} val - Value to parse
   * @returns {number} Parsed number, or NaN if invalid
   *
   * @example
   * parseNum('1.234,56')  // => 1234.56 (Catalan format)
   * parseNum('1234.56')   // => 1234.56 (standard)
   * parseNum('1,234.56')  // => 1234.56 (US format)
   * parseNum(42)          // => 42 (pass-through)
   */
  function parseNum(val) {
    if (typeof val !== 'string') return Number(val);

    let s = val.trim();

    // Determine format based on separator positions
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');

    if (lastComma === -1 && lastDot === -1) {
      // No separators - just parse as integer
      const n = parseFloat(s);
      return isNaN(n) ? NaN : n;
    }

    // If comma appears after dot: Catalan format "1.234,56"
    // Remove all dots (thousands) and replace comma with dot (decimal)
    if (lastComma > lastDot) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // Dot appears after comma or only dot exists: US/standard format "1,234.56" or "1234.56"
      // Remove all commas (thousands), keep dots (decimal)
      s = s.replace(/,/g, '');
    }

    const n = parseFloat(s);
    return isNaN(n) ? NaN : n;
  }

  /**
   * Format a number with locale-specific formatting
   *
   * @param {number} n - Number to format
   * @param {number} [decimals] - Number of decimal places (defaults to maxDecimals)
   * @returns {string} Formatted number string
   *
   * @example
   * formatNumber(1234.56)     // => '1.234,56' (ca-ES)
   * formatNumber(1234.56, 1)  // => '1.234,6'
   * formatNumber(1234)        // => '1.234'
   */
  function formatNumber(n, decimals) {
    const maxDec = decimals !== undefined ? decimals : maxDecimals;
    const rounded = Math.round(Number(n) * Math.pow(10, maxDec)) / Math.pow(10, maxDec);

    return rounded.toLocaleString(locale, {
      minimumFractionDigits: minDecimals,
      maximumFractionDigits: maxDec
    });
  }

  return {
    parseNum,
    formatNumber
  };
}

/**
 * Default number formatter for Catalan locale with 2 decimal places
 */
export const { parseNum, formatNumber } = createNumberFormatter();

/**
 * Format seconds with Catalan locale (alias for formatNumber)
 *
 * @param {number} n - Number of seconds
 * @returns {string} Formatted string (e.g., '1.234,56')
 *
 * @example
 * formatSec(1234.56) // => '1.234,56'
 */
export function formatSec(n) {
  return formatNumber(n, 2);
}

// ============================================================================
// MATH UTILITIES - Mathematical operations
// ============================================================================

/**
 * Calculate Greatest Common Divisor (GCD)
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} GCD of a and b
 */
export function gcd(a, b) {
  let x = Math.abs(Number(a));
  let y = Math.abs(Number(b));
  if (!Number.isFinite(x) || !Number.isFinite(y) || x === 0 || y === 0) {
    if (Number.isFinite(x) && x > 0) return x;
    if (Number.isFinite(y) && y > 0) return y;
    return 1;
  }
  while (y !== 0) {
    const temp = x % y;
    x = y;
    y = temp;
  }
  return x || 1;
}

/**
 * Calculate Least Common Multiple (LCM)
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} LCM of a and b
 */
export function lcm(a, b) {
  const x = Math.abs(Math.round(Number(a) || 0));
  const y = Math.abs(Math.round(Number(b) || 0));
  if (!Number.isFinite(x) || !Number.isFinite(y) || x === 0 || y === 0) {
    return 1;
  }
  return Math.abs((x / gcd(x, y)) * y) || 1;
}

/**
 * Generate a random integer within a specified range (inclusive)
 *
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (inclusive)
 * @returns {number} Random integer between min and max
 *
 * @example
 * randomInt(1, 10)   // => 7 (random value between 1 and 10)
 * randomInt(40, 320) // => 156 (random value between 40 and 320)
 */
export function randomInt(min, max) {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi < lo) return lo;
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

// ============================================================================
// RANGE UTILITIES - Range validation and normalization
// ============================================================================

/**
 * Normalize a min/max pair ensuring order and valid values (simple version)
 * @param {*} minValue - Minimum value input (can be text)
 * @param {*} maxValue - Maximum value input (can be text)
 * @param {[number, number]} defaults - Fallback pair when input is invalid
 * @returns {[number, number]} Normalized range [min, max]
 * @remarks Ensures minimum is always less than or equal to maximum
 */
export function toRange(minValue, maxValue, defaults) {
  const min = toNumber(minValue, defaults[0]);
  const max = toNumber(maxValue, defaults[1]);
  return min <= max ? [min, max] : [max, min];
}

/**
 * Resolve a range with comprehensive validation and clamping
 * @param {*} minInput - Minimum value input
 * @param {*} maxInput - Maximum value input
 * @param {[number, number]} fallbackRange - Fallback range (default: [0, 0])
 * @param {Object} options - Options
 * @param {number} options.minValue - Minimum allowed value (default: -Infinity)
 * @param {number} options.maxValue - Maximum allowed value (default: Infinity)
 * @returns {[number, number]} Resolved range [min, max]
 */
export function resolveRange(minInput, maxInput, fallbackRange = [0, 0], { minValue = -Infinity, maxValue = Infinity } = {}) {
  const fallback = Array.isArray(fallbackRange) && fallbackRange.length === 2
    ? [...fallbackRange]
    : [0, 0];
  const minParsed = parseFloatSafe(minInput);
  const maxParsed = parseFloatSafe(maxInput);

  let lo;
  let hi;
  if (!Number.isFinite(minParsed) && !Number.isFinite(maxParsed)) {
    [lo, hi] = fallback;
  } else if (!Number.isFinite(minParsed)) {
    lo = fallback[0];
    const candidate = Number.isFinite(maxParsed) ? maxParsed : fallback[1];
    hi = Math.max(lo, candidate);
  } else if (!Number.isFinite(maxParsed)) {
    const candidate = minParsed;
    hi = fallback[1];
    lo = Math.min(candidate, hi);
  } else {
    lo = Math.min(minParsed, maxParsed);
    hi = Math.max(minParsed, maxParsed);
  }

  if (!Number.isFinite(lo)) lo = fallback[0];
  if (!Number.isFinite(hi)) hi = fallback[1];

  if (Number.isFinite(minValue)) {
    lo = Math.max(lo, minValue);
    hi = Math.max(hi, minValue);
  }
  if (Number.isFinite(maxValue)) {
    lo = Math.min(lo, maxValue);
    hi = Math.min(hi, maxValue);
  }
  if (hi < lo) hi = lo;
  return [lo, hi];
}

/**
 * Resolve an integer range with validation
 * @param {*} minInput - Minimum value input
 * @param {*} maxInput - Maximum value input
 * @param {[number, number]} fallbackRange - Fallback range (default: [1, 1])
 * @param {Object} options - Options
 * @param {number} options.minValue - Minimum allowed value (default: 1)
 * @returns {[number, number]} Resolved integer range [min, max]
 */
export function resolveIntRange(minInput, maxInput, fallbackRange = [1, 1], { minValue = 1 } = {}) {
  const fallback = Array.isArray(fallbackRange) && fallbackRange.length === 2
    ? [...fallbackRange]
    : [minValue, minValue];
  const [rawLo, rawHi] = resolveRange(minInput, maxInput, fallback, { minValue });
  const lo = Number.isFinite(rawLo) ? Math.max(minValue, Math.round(rawLo)) : Math.max(minValue, Math.round(fallback[0]));
  const hiCandidate = Number.isFinite(rawHi) ? Math.round(rawHi) : Math.round(fallback[1]);
  const hi = Math.max(lo, Math.max(minValue, hiCandidate));
  return [lo, hi];
}
