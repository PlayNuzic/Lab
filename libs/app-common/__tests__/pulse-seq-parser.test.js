/**
 * @fileoverview Tests para pulse-seq-parser
 */

import { parseTokens, validateInteger, nearestPulseIndex, resolvePulseSeqGap, FRACTION_POSITION_EPSILON } from '../../pulse-seq/index.js';

describe('pulse-seq-parser', () => {
  describe('parseTokens', () => {
    test('parsea texto vacío', () => {
      expect(parseTokens('')).toEqual([]);
      expect(parseTokens('  ')).toEqual([]);
    });

    test('parsea pulsos enteros', () => {
      const tokens = parseTokens('  1  3  5  ');
      expect(tokens).toHaveLength(3);
      expect(tokens[0]).toMatchObject({ raw: '1', type: 'int' });
      expect(tokens[1]).toMatchObject({ raw: '3', type: 'int' });
      expect(tokens[2]).toMatchObject({ raw: '5', type: 'int' });
    });

    test('parsea fracciones estándar', () => {
      const tokens = parseTokens('  3.2  5.1  ');
      expect(tokens).toHaveLength(2);
      expect(tokens[0]).toMatchObject({ raw: '3.2', type: 'fraction' });
      expect(tokens[1]).toMatchObject({ raw: '5.1', type: 'fraction' });
    });

    test('parsea fracciones con prefijo de punto', () => {
      const tokens = parseTokens('  .2  .5  ');
      expect(tokens).toHaveLength(2);
      expect(tokens[0]).toMatchObject({ raw: '.2', type: 'fraction' });
      expect(tokens[1]).toMatchObject({ raw: '.5', type: 'fraction' });
    });

    test('parsea mezcla de enteros y fracciones', () => {
      const tokens = parseTokens('  1  3.2  5  .3  ');
      expect(tokens).toHaveLength(4);
      expect(tokens.map(t => t.type)).toEqual(['int', 'fraction', 'int', 'fraction']);
    });

    test('incluye posiciones correctas', () => {
      const tokens = parseTokens('  1  3.2  ');
      expect(tokens[0].start).toBe(2);
      expect(tokens[1].start).toBe(5);
    });
  });

  describe('validateInteger', () => {
    test('valida entero válido', () => {
      const result = validateInteger({ raw: '5' }, { lg: 10 });
      expect(result.valid).toBe(true);
      expect(result.value).toBe(5);
    });

    test('rechaza entero >= lg', () => {
      const result = validateInteger({ raw: '10' }, { lg: 10 });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('too-big');
      expect(result.value).toBe(10);
    });

    test('rechaza entero <= 0', () => {
      expect(validateInteger({ raw: '0' }, { lg: 10 }).valid).toBe(false);
      expect(validateInteger({ raw: '-1' }, { lg: 10 }).valid).toBe(false);
    });

    test('rechaza no-finito', () => {
      const result = validateInteger({ raw: 'abc' }, { lg: 10 });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('not-finite');
    });
  });

  describe('nearestPulseIndex', () => {
    test('devuelve entero si está muy cerca', () => {
      // Epsilon actualizado a 1e-6, por lo que usamos valores más cercanos
      expect(nearestPulseIndex(3.0000001)).toBe(3);
      expect(nearestPulseIndex(2.9999999)).toBe(3);
      expect(nearestPulseIndex(5.0)).toBe(5);
    });

    test('devuelve null si está lejos de un entero', () => {
      expect(nearestPulseIndex(3.5)).toBe(null);
      expect(nearestPulseIndex(2.3)).toBe(null);
    });

    test('maneja valores no-finitos', () => {
      expect(nearestPulseIndex(NaN)).toBe(null);
      expect(nearestPulseIndex(Infinity)).toBe(null);
    });
  });

  describe('resolvePulseSeqGap', () => {
    test('resuelve gap entre dos pulsos', () => {
      const ranges = {
        '1': [2, 3],
        '5': [5, 6],
        '10': [8, 10]
      };
      const gap = resolvePulseSeqGap(4, 12, ranges);
      expect(gap.base).toBe(1);
      expect(gap.next).toBe(5);
    });

    test('resuelve gap al inicio', () => {
      const ranges = {
        '5': [5, 6]
      };
      const gap = resolvePulseSeqGap(0, 12, ranges);
      expect(gap.base).toBe(0);
      expect(gap.next).toBe(5);
    });

    test('resuelve gap al final', () => {
      const ranges = {
        '5': [5, 6]
      };
      const gap = resolvePulseSeqGap(10, 12, ranges);
      expect(gap.base).toBe(5);
      expect(gap.next).toBe(12);
    });

    test('maneja pulseSeqRanges vacío', () => {
      const gap = resolvePulseSeqGap(5, 12, {});
      expect(gap.base).toBe(0);
      expect(gap.next).toBe(12);
    });

    test('resuelve gap con múltiples ocurrencias de la misma base', () => {
      const ranges = {
        '0-a': [2, 5],   // 0.1
        '0-b': [7, 10],  // 0.3
        '0-c': [12, 15], // 0.4
      };
      // Cursor en posición 16 (después de 0.4)
      const gap = resolvePulseSeqGap(16, 20, ranges);
      expect(gap.base).toBe(0);  // base del token más cercano (0.4)
      expect(gap.next).toBe(20); // siguiente es lg
    });

    test('resuelve gap con keys compuestas no numéricas', () => {
      const ranges = {
        '3-first': [5, 8],
        '3-second': [10, 13],
      };
      const gap = resolvePulseSeqGap(14, 20, ranges);
      expect(gap.base).toBe(3);
      expect(gap.next).toBe(20);
    });

    test('resuelve gap entre ocurrencias de la misma base', () => {
      const ranges = {
        '0-a': [2, 3],   // 0 en posición 2-3
        '3-a': [5, 6],   // 3 en posición 5-6
        '3-b': [10, 11], // 3 en posición 10-11
      };
      // Cursor en posición 8 (después del primer 3, antes del segundo 3)
      const gap = resolvePulseSeqGap(8, 20, ranges);
      expect(gap.base).toBe(3);  // base del token más cercano
      expect(gap.next).toBe(3);  // siguiente también es 3 (segunda ocurrencia)
    });
  });
});
