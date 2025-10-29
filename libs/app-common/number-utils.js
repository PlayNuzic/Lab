/**
 * Number utilities for parsing and formatting numbers with locale support
 *
 * Provides utilities for:
 * - Parsing numbers with Catalan locale support (comma as decimal separator)
 * - Formatting numbers with configurable locale and precision
 *
 * @module libs/app-common/number-utils
 */

/**
 * Creates a number formatter with locale-specific parsing and formatting
 *
 * @param {Object} options - Configuration options
 * @param {string} options.locale - Locale string (default: 'ca-ES')
 * @param {number} options.maxDecimals - Maximum decimal places (default: 2)
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
