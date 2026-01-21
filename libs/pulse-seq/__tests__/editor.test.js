/**
 * Tests for pulse-seq editor utilities
 */
import { getMidpoints, normalizeGaps } from '../editor.js';

describe('getMidpoints', () => {
  test('finds midpoints (double spaces) in text', () => {
    const text = '  1  2  3  ';
    const mids = getMidpoints(text);

    expect(mids).toEqual([1, 4, 7, 10]);
  });

  test('returns empty array for empty string', () => {
    expect(getMidpoints('')).toEqual([]);
  });

  test('returns empty array for single space', () => {
    expect(getMidpoints(' ')).toEqual([]);
  });

  test('finds single midpoint', () => {
    expect(getMidpoints('  ')).toEqual([1]);
  });

  test('handles text with no double spaces', () => {
    expect(getMidpoints('1 2 3')).toEqual([]);
  });

  test('handles consecutive double spaces', () => {
    // "    " has midpoints at 1, 2, 3
    expect(getMidpoints('    ')).toEqual([1, 2, 3]);
  });

  test('handles fractional tokens', () => {
    const text = '  1.2  3.4  ';
    const mids = getMidpoints(text);

    expect(mids).toEqual([1, 6, 11]);
  });

  test('handles mixed tokens', () => {
    const text = '  1  2.3  4  ';
    const mids = getMidpoints(text);

    expect(mids).toEqual([1, 4, 9, 12]);
  });
});

describe('normalizeGaps', () => {
  test('normalizes whitespace to double spaces', () => {
    expect(normalizeGaps('1 2 3')).toBe('  1  2  3  ');
  });

  test('handles already normalized text', () => {
    expect(normalizeGaps('  1  2  3  ')).toBe('  1  2  3  ');
  });

  test('handles empty string', () => {
    expect(normalizeGaps('')).toBe('  ');
  });

  test('handles whitespace-only string', () => {
    expect(normalizeGaps('   ')).toBe('  ');
  });

  test('handles single token', () => {
    expect(normalizeGaps('1')).toBe('  1  ');
  });

  test('handles multiple spaces between tokens', () => {
    expect(normalizeGaps('1    2     3')).toBe('  1  2  3  ');
  });

  test('handles leading/trailing spaces', () => {
    expect(normalizeGaps('   1  2   ')).toBe('  1  2  ');
  });

  test('handles fractional tokens', () => {
    expect(normalizeGaps('1.2 3.4')).toBe('  1.2  3.4  ');
  });

  test('handles non-string input', () => {
    expect(normalizeGaps(null)).toBe('  ');
    expect(normalizeGaps(undefined)).toBe('  ');
    expect(normalizeGaps(123)).toBe('  ');
  });

  test('handles tabs and newlines', () => {
    expect(normalizeGaps('1\t2\n3')).toBe('  1  2  3  ');
  });
});
