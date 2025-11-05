/**
 * Tests para parser.js
 */

import {
  validateNote,
  validatePulse,
  parseNotes,
  parsePulses,
  autoCompletePulses,
  createPairs,
  decomposePairs
} from '../parser.js';

describe('matrix-seq/parser', () => {
  describe('validateNote', () => {
    it('acepta notas válidas en rango', () => {
      expect(validateNote(0)).toEqual({ valid: true, value: 0 });
      expect(validateNote(5)).toEqual({ valid: true, value: 5 });
      expect(validateNote(11)).toEqual({ valid: true, value: 11 });
    });

    it('rechaza notas fuera de rango', () => {
      const result = validateNote(12);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('entre 0 y 11');
    });

    it('rechaza valores no numéricos', () => {
      const result = validateNote('abc');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('número');
    });
  });

  describe('validatePulse', () => {
    it('acepta pulsos válidos en rango', () => {
      expect(validatePulse(0)).toEqual({ valid: true, value: 0 });
      expect(validatePulse(4)).toEqual({ valid: true, value: 4 });
      expect(validatePulse(7)).toEqual({ valid: true, value: 7 });
    });

    it('rechaza pulsos fuera de rango', () => {
      const result = validatePulse(8);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('entre 0 y 7');
    });
  });

  describe('parseNotes', () => {
    it('parsea notas válidas', () => {
      const { notes, errors } = parseNotes('0 3 7 11');
      expect(notes).toEqual([0, 3, 7, 11]);
      expect(errors).toEqual([]);
    });

    it('permite duplicados', () => {
      const { notes, errors } = parseNotes('3 3 7 7');
      expect(notes).toEqual([3, 3, 7, 7]);
      expect(errors).toEqual([]);
    });

    it('permite cualquier orden', () => {
      const { notes, errors } = parseNotes('11 0 5 3');
      expect(notes).toEqual([11, 0, 5, 3]);
      expect(errors).toEqual([]);
    });

    it('rechaza valores inválidos', () => {
      const { notes, errors } = parseNotes('0 12 7');
      expect(notes).toEqual([0, 7]);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('retorna vacío para texto vacío', () => {
      const { notes, errors } = parseNotes('');
      expect(notes).toEqual([]);
      expect(errors).toEqual([]);
    });
  });

  describe('parsePulses', () => {
    it('parsea pulsos válidos', () => {
      const { pulses, errors } = parsePulses('0 2 4 6');
      expect(pulses).toEqual([0, 2, 4, 6]);
      expect(errors).toEqual([]);
    });

    it('elimina duplicados y marca sanitized', () => {
      const { pulses, errors, sanitized } = parsePulses('2 2 4');
      expect(pulses).toEqual([2, 4]);
      expect(sanitized).toBe(true);
      expect(errors).toContain('Pulsos duplicados eliminados');
    });

    it('ordena ascendentemente y marca sanitized', () => {
      const { pulses, errors, sanitized } = parsePulses('4 1 6');
      expect(pulses).toEqual([1, 4, 6]);
      expect(sanitized).toBe(true);
      expect(errors).toContain('Pulsos reordenados ascendentemente');
    });

    it('rechaza valores inválidos', () => {
      const { pulses, errors } = parsePulses('0 8 4');
      expect(pulses).toEqual([]);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('autoCompletePulses', () => {
    it('genera secuencia de índices', () => {
      expect(autoCompletePulses(4)).toEqual([0, 1, 2, 3]);
    });

    it('respeta máximo', () => {
      expect(autoCompletePulses(10, 7)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    });
  });

  describe('createPairs', () => {
    it('crea pares desde listas', () => {
      const pairs = createPairs([0, 3, 7], [0, 2, 4]);
      expect(pairs).toEqual([
        { note: 0, pulse: 0 },
        { note: 3, pulse: 2 },
        { note: 7, pulse: 4 }
      ]);
    });

    it('usa longitud mínima', () => {
      const pairs = createPairs([0, 3], [0, 2, 4, 6]);
      expect(pairs.length).toBe(2);
    });
  });

  describe('decomposePairs', () => {
    it('descompone pares en listas', () => {
      const pairs = [
        { note: 0, pulse: 0 },
        { note: 3, pulse: 2 }
      ];
      const { notes, pulses } = decomposePairs(pairs);
      expect(notes).toEqual([0, 3]);
      expect(pulses).toEqual([0, 2]);
    });
  });
});
