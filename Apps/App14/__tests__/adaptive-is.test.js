import { describe, test, expect } from '@jest/globals';
import { applyAdaptiveChange, formatAdjustNotice } from '../adaptive-is.js';

describe('applyAdaptiveChange', () => {
  test('cas del test P2-02: +5 −1 −1 −1, el primer iS passa a 1', () => {
    const before = [5, -1, -1, -1];
    const r = applyAdaptiveChange(before, 0, 1);
    expect(r.ok).toBe(true);
    // L'iS₂ absorbeix la diferència: les notes posteriors (4, 3, 2) no es mouen
    expect(r.intervals).toEqual([1, 3, -1, -1]);
    expect(r.adjustedIndex).toBe(1);
    expect(r.adjustedDelta).toBe(4);
    // No modifica l'entrada
    expect(before).toEqual([5, -1, -1, -1]);
  });

  test('després escriu 9 a l\'iS₂: l\'iS₃ passa a −7', () => {
    const r = applyAdaptiveChange([1, 3, -1, -1], 1, 9);
    expect(r.ok).toBe(true);
    expect(r.intervals).toEqual([1, 9, -7, -1]);
    expect(r.adjustedIndex).toBe(2);
  });

  test('l\'últim iS no ajusta res', () => {
    const r = applyAdaptiveChange([1, 9, -2, -1], 3, -2);
    expect(r.ok).toBe(true);
    expect(r.intervals).toEqual([1, 9, -2, -2]);
    expect(r.adjustedIndex).toBeNull();
  });

  test('el mateix valor no ajusta res', () => {
    const r = applyAdaptiveChange([2, 3], 0, 2);
    expect(r.ok).toBe(true);
    expect(r.adjustedIndex).toBeNull();
  });

  test('rebutja un primer iS negatiu', () => {
    expect(applyAdaptiveChange([2, 3], 0, -1)).toEqual({ ok: false, message: 'Primer iS ≥ 0' });
  });

  test('rebutja una nota fora de 0-11 i diu el rang vàlid', () => {
    // Abans de l'iS₂ som a la nota 1: l'iS₂ pot anar de −1 a +10
    const r = applyAdaptiveChange([1, 3, -1], 1, 11);
    expect(r).toEqual({ ok: false, message: 'iS fuera de rango [-1, 10]' });
  });
});

describe('formatAdjustNotice', () => {
  test('diu el valor que queda a la casella, amb signe', () => {
    expect(formatAdjustNotice(1, 3)).toBe('iS₍2₎ ajustado a +3');
    expect(formatAdjustNotice(2, -7)).toBe('iS₍3₎ ajustado a -7');
    expect(formatAdjustNotice(1, 0)).toBe('iS₍2₎ ajustado a 0');
  });
});
