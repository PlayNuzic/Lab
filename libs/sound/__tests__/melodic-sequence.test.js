// libs/sound/__tests__/melodic-sequence.test.js

import {
  generateMelodicSequence,
  getRandomBPM,
  getRandomRegistry,
  getRandomNoteIndex,
  createSequenceGenerator
} from '../melodic-sequence.js';

describe('melodic-sequence', () => {
  describe('generateMelodicSequence', () => {
    test('returns empty array for null registry', () => {
      const result = generateMelodicSequence({ registry: null });

      expect(result).toEqual([]);
    });

    test('returns empty array for undefined registry', () => {
      const result = generateMelodicSequence({});

      expect(result).toEqual([]);
    });

    test('generates sequence with correct length', () => {
      const result = generateMelodicSequence({ registry: 3, length: 6 });

      expect(result.length).toBe(6);
    });

    test('generates sequence with custom length', () => {
      const result = generateMelodicSequence({ registry: 3, length: 4 });

      expect(result.length).toBe(4);
    });

    test('includes inside notes (0-11)', () => {
      const result = generateMelodicSequence({
        registry: 3,
        length: 10,
        outsideMin: 0,
        outsideMax: 0
      });

      result.forEach(note => {
        expect(note).toBeGreaterThanOrEqual(0);
        expect(note).toBeLessThan(12);
      });
    });

    test('includes outside notes for middle registry', () => {
      // Generate many sequences to statistically ensure outside notes appear
      const results = [];
      for (let i = 0; i < 20; i++) {
        results.push(...generateMelodicSequence({
          registry: 3,
          length: 6,
          outsideMin: 2,
          outsideMax: 2
        }));
      }

      const outsideNotes = results.filter(n => n === -1 || n >= 12);
      expect(outsideNotes.length).toBeGreaterThan(0);
    });

    test('only includes next notes for min registry', () => {
      const results = [];
      for (let i = 0; i < 20; i++) {
        results.push(...generateMelodicSequence({
          registry: 0,
          length: 6,
          outsideMin: 2,
          outsideMax: 2,
          minRegistry: 0
        }));
      }

      const prevNotes = results.filter(n => n === -1);
      const nextNotes = results.filter(n => n >= 12);

      expect(prevNotes.length).toBe(0);  // No -1 notes
      expect(nextNotes.length).toBeGreaterThan(0);  // Some 12, 13 notes
    });

    test('only includes prev notes for max registry', () => {
      const results = [];
      for (let i = 0; i < 20; i++) {
        results.push(...generateMelodicSequence({
          registry: 7,
          length: 6,
          outsideMin: 2,
          outsideMax: 2,
          maxRegistry: 7
        }));
      }

      const prevNotes = results.filter(n => n === -1);
      const nextNotes = results.filter(n => n >= 12);

      expect(prevNotes.length).toBeGreaterThan(0);  // Some -1 notes
      expect(nextNotes.length).toBe(0);  // No 12, 13 notes
    });

    test('respects outsideMin constraint', () => {
      const result = generateMelodicSequence({
        registry: 3,
        length: 6,
        outsideMin: 2,
        outsideMax: 2
      });

      const outsideNotes = result.filter(n => n === -1 || n >= 12);
      expect(outsideNotes.length).toBe(2);
    });
  });

  describe('getRandomBPM', () => {
    test('returns value within default range', () => {
      for (let i = 0; i < 50; i++) {
        const bpm = getRandomBPM();
        expect(bpm).toBeGreaterThanOrEqual(75);
        expect(bpm).toBeLessThanOrEqual(200);
      }
    });

    test('returns value within custom range', () => {
      for (let i = 0; i < 50; i++) {
        const bpm = getRandomBPM(100, 150);
        expect(bpm).toBeGreaterThanOrEqual(100);
        expect(bpm).toBeLessThanOrEqual(150);
      }
    });

    test('returns integer values', () => {
      for (let i = 0; i < 20; i++) {
        const bpm = getRandomBPM();
        expect(Number.isInteger(bpm)).toBe(true);
      }
    });
  });

  describe('getRandomRegistry', () => {
    test('returns value within default range', () => {
      for (let i = 0; i < 50; i++) {
        const reg = getRandomRegistry();
        expect(reg).toBeGreaterThanOrEqual(0);
        expect(reg).toBeLessThanOrEqual(7);
      }
    });

    test('returns value within custom range', () => {
      for (let i = 0; i < 50; i++) {
        const reg = getRandomRegistry(2, 5);
        expect(reg).toBeGreaterThanOrEqual(2);
        expect(reg).toBeLessThanOrEqual(5);
      }
    });

    test('returns integer values', () => {
      for (let i = 0; i < 20; i++) {
        const reg = getRandomRegistry();
        expect(Number.isInteger(reg)).toBe(true);
      }
    });
  });

  describe('getRandomNoteIndex', () => {
    test('returns value within default range', () => {
      for (let i = 0; i < 50; i++) {
        const note = getRandomNoteIndex();
        expect(note).toBeGreaterThanOrEqual(0);
        expect(note).toBeLessThan(12);
      }
    });

    test('returns value within custom range', () => {
      for (let i = 0; i < 50; i++) {
        const note = getRandomNoteIndex(7);
        expect(note).toBeGreaterThanOrEqual(0);
        expect(note).toBeLessThan(7);
      }
    });

    test('returns integer values', () => {
      for (let i = 0; i < 20; i++) {
        const note = getRandomNoteIndex();
        expect(Number.isInteger(note)).toBe(true);
      }
    });
  });

  describe('createSequenceGenerator', () => {
    test('creates generator with default config', () => {
      const generator = createSequenceGenerator();

      expect(typeof generator.generate).toBe('function');
      expect(typeof generator.randomBPM).toBe('function');
      expect(typeof generator.randomRegistry).toBe('function');
      expect(typeof generator.randomNote).toBe('function');
    });

    test('generate creates sequence with preset length', () => {
      const generator = createSequenceGenerator({ length: 8 });

      const result = generator.generate(3);

      expect(result.length).toBe(8);
    });

    test('randomBPM uses preset range', () => {
      const generator = createSequenceGenerator({ minBPM: 100, maxBPM: 110 });

      for (let i = 0; i < 20; i++) {
        const bpm = generator.randomBPM();
        expect(bpm).toBeGreaterThanOrEqual(100);
        expect(bpm).toBeLessThanOrEqual(110);
      }
    });

    test('randomRegistry uses preset range', () => {
      const generator = createSequenceGenerator({ minRegistry: 2, maxRegistry: 4 });

      for (let i = 0; i < 20; i++) {
        const reg = generator.randomRegistry();
        expect(reg).toBeGreaterThanOrEqual(2);
        expect(reg).toBeLessThanOrEqual(4);
      }
    });

    test('randomNote uses preset notesPerRegistry', () => {
      const generator = createSequenceGenerator({ notesPerRegistry: 7 });

      for (let i = 0; i < 20; i++) {
        const note = generator.randomNote();
        expect(note).toBeGreaterThanOrEqual(0);
        expect(note).toBeLessThan(7);
      }
    });
  });
});
