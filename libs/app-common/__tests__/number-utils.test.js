/**
 * @jest-environment node
 */
import { createNumberFormatter, parseNum, formatNumber, formatSec } from '../number-utils.js';

describe('createNumberFormatter', () => {
  describe('parseNum', () => {
    it('should parse Catalan format with comma as decimal', () => {
      const { parseNum } = createNumberFormatter();
      expect(parseNum('1234,56')).toBe(1234.56);
    });

    it('should parse Catalan format with thousands separator', () => {
      const { parseNum } = createNumberFormatter();
      expect(parseNum('1.234,56')).toBe(1234.56);
    });

    it('should parse standard format with dot as decimal', () => {
      const { parseNum } = createNumberFormatter();
      expect(parseNum('1234.56')).toBe(1234.56);
    });

    it('should parse US format with comma as thousands and dot as decimal', () => {
      const { parseNum } = createNumberFormatter();
      expect(parseNum('1,234.56')).toBe(1234.56);
    });

    it('should parse integer values', () => {
      const { parseNum } = createNumberFormatter();
      expect(parseNum('1234')).toBe(1234);
    });

    it('should pass through numeric values', () => {
      const { parseNum } = createNumberFormatter();
      expect(parseNum(1234.56)).toBe(1234.56);
    });

    it('should handle zero', () => {
      const { parseNum } = createNumberFormatter();
      expect(parseNum('0')).toBe(0);
      expect(parseNum(0)).toBe(0);
    });

    it('should return NaN for invalid input', () => {
      const { parseNum } = createNumberFormatter();
      expect(parseNum('abc')).toBeNaN();
      expect(parseNum('')).toBeNaN();
    });

    it('should trim whitespace', () => {
      const { parseNum } = createNumberFormatter();
      expect(parseNum('  1234.56  ')).toBe(1234.56);
    });

    it('should handle negative numbers in Catalan format', () => {
      const { parseNum } = createNumberFormatter();
      expect(parseNum('-1.234,56')).toBe(-1234.56);
    });

    it('should handle negative numbers in standard format', () => {
      const { parseNum } = createNumberFormatter();
      expect(parseNum('-1234.56')).toBe(-1234.56);
    });
  });

  describe('formatNumber', () => {
    it('should format with Catalan locale by default', () => {
      const { formatNumber } = createNumberFormatter();
      expect(formatNumber(1234.56)).toBe('1.234,56');
    });

    it('should format integers without decimals', () => {
      const { formatNumber } = createNumberFormatter();
      expect(formatNumber(1234)).toBe('1.234');
    });

    it('should round to specified decimals', () => {
      const { formatNumber } = createNumberFormatter();
      expect(formatNumber(1234.5678, 2)).toBe('1.234,57');
    });

    it('should format with custom decimal places', () => {
      const { formatNumber } = createNumberFormatter();
      expect(formatNumber(1234.5, 1)).toBe('1.234,5');
    });

    it('should handle zero', () => {
      const { formatNumber } = createNumberFormatter();
      expect(formatNumber(0)).toBe('0');
    });

    it('should handle negative numbers', () => {
      const { formatNumber } = createNumberFormatter();
      expect(formatNumber(-1234.56)).toBe('-1.234,56');
    });

    it('should respect maxDecimals option', () => {
      const { formatNumber } = createNumberFormatter({ maxDecimals: 3 });
      expect(formatNumber(1234.5678)).toBe('1.234,568');
    });

    it('should respect locale option', () => {
      const { formatNumber } = createNumberFormatter({ locale: 'en-US' });
      expect(formatNumber(1234.56)).toBe('1,234.56');
    });

    it('should not force trailing zeros by default', () => {
      const { formatNumber } = createNumberFormatter();
      expect(formatNumber(1234.5)).toBe('1.234,5');
      expect(formatNumber(1234)).toBe('1.234');
    });
  });

  describe('formatSec', () => {
    it('should format seconds with 2 decimals', () => {
      const { formatNumber } = createNumberFormatter();
      // formatSec is an alias for formatNumber with 2 decimals
      expect(formatNumber(1234.56, 2)).toBe('1.234,56');
    });

    it('should round to 2 decimals', () => {
      const { formatNumber } = createNumberFormatter();
      expect(formatNumber(1234.5678, 2)).toBe('1.234,57');
    });

    it('should handle values less than 1', () => {
      const { formatNumber } = createNumberFormatter();
      expect(formatNumber(0.56, 2)).toBe('0,56');
    });
  });

  describe('default exports', () => {
    it('should export default parseNum', () => {
      expect(typeof parseNum).toBe('function');
      expect(parseNum('1.234,56')).toBe(1234.56);
    });

    it('should export default formatNumber', () => {
      expect(typeof formatNumber).toBe('function');
      expect(formatNumber(1234.56)).toBe('1.234,56');
    });

    it('should export formatSec', () => {
      expect(typeof formatSec).toBe('function');
      expect(formatSec(1234.56)).toBe('1.234,56');
    });
  });

  describe('edge cases', () => {
    it('should handle very large numbers', () => {
      const { parseNum, formatNumber } = createNumberFormatter();
      const large = 1234567890.12;
      expect(parseNum('1.234.567.890,12')).toBe(large);
      expect(formatNumber(large)).toBe('1.234.567.890,12');
    });

    it('should handle very small decimals', () => {
      const { parseNum, formatNumber } = createNumberFormatter();
      expect(parseNum('0,001')).toBe(0.001);
      expect(formatNumber(0.001)).toBe('0');
    });

    it('should handle scientific notation input', () => {
      const { parseNum } = createNumberFormatter();
      expect(parseNum('1.23e3')).toBe(1230);
    });
  });
});
