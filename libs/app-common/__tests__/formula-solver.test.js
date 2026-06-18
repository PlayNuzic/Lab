import { describe, test, expect } from '@jest/globals';
import { createFormulaSolver, computeField, FORMULA_KEYS } from '../formula-solver.js';

describe('computeField (Lg/V = T/60)', () => {
  test('T = Lg·60/V', () => {
    expect(computeField('T', { Lg: 4, V: 120 })).toEqual({ key: 'T', value: 2 });
    // arrodoniment a 2 decimals
    expect(computeField('T', { Lg: 3, V: 90 })).toEqual({ key: 'T', value: 2 });
    expect(computeField('T', { Lg: 5, V: 70 })).toEqual({ key: 'T', value: 4.29 });
  });

  test('V = Lg·60/T', () => {
    expect(computeField('V', { Lg: 4, T: 2 })).toEqual({ key: 'V', value: 120 });
    expect(computeField('V', { Lg: 5, T: 4.29 })).toEqual({ key: 'V', value: 69.93 });
  });

  test('Lg = V·T/60 (enter)', () => {
    expect(computeField('Lg', { V: 120, T: 2 })).toEqual({ key: 'Lg', value: 4 });
    expect(computeField('Lg', { V: 90, T: 2.05 })).toEqual({ key: 'Lg', value: 3 });
  });

  test('null si falta algun operand o no és vàlid', () => {
    expect(computeField('T', { Lg: 4 })).toBeNull();
    expect(computeField('T', { Lg: 4, V: 0 })).toBeNull();
    expect(computeField('V', { Lg: 4, T: NaN })).toBeNull();
    expect(computeField('Lg', { V: 120 })).toBeNull();
    expect(computeField('xx', { Lg: 4, V: 120 })).toBeNull();
  });
});

describe('createFormulaSolver — recència "els dos últims manen"', () => {
  test('sense prou edicions, el derivat per recència és null', () => {
    const s = createFormulaSolver();
    expect(s.derivedByRecency()).toBeNull();
    s.touch('Lg');
    expect(s.derivedByRecency()).toBeNull();
  });

  test('els dos últims editats són conductors; el tercer és el derivat', () => {
    const s = createFormulaSolver();
    s.touch('Lg');
    s.touch('V');
    expect(s.derivedByRecency()).toBe('T');
    expect(s.recency).toEqual(['Lg', 'V']);
  });

  test('editar el camp derivat li cedeix l\'auto al més antic dels altres', () => {
    const s = createFormulaSolver();
    s.touch('Lg'); // recency: [Lg]
    s.touch('V');  // recency: [Lg, V] → derivat T
    s.touch('T');  // recency: [V, T] → derivat Lg (el més antic dels conductors anteriors)
    expect(s.derivedByRecency()).toBe('Lg');
    expect(s.recency).toEqual(['V', 'T']);
  });

  test('re-tocar un conductor no canvia el derivat però actualitza la recència', () => {
    const s = createFormulaSolver();
    s.touch('Lg');
    s.touch('V'); // derivat T
    s.touch('Lg'); // segueix sent conductor; derivat segueix sent T
    expect(s.derivedByRecency()).toBe('T');
    expect(s.recency).toEqual(['V', 'Lg']);
  });
});

describe('createFormulaSolver.resolve', () => {
  test('exactament 1 buit → omple aquest, ignorant la recència', () => {
    const s = createFormulaSolver();
    s.touch('Lg');
    s.touch('T'); // recència diria derivat V, però...
    // ...si T és buit, mana el buit:
    expect(s.resolve({ Lg: 4, V: 120, T: NaN })).toEqual({ key: 'T', value: 2 });
  });

  test('0 plens o 1 ple → res a calcular', () => {
    const s = createFormulaSolver();
    expect(s.resolve({ Lg: NaN, V: NaN, T: NaN })).toBeNull();
    expect(s.resolve({ Lg: 4, V: NaN, T: NaN })).toBeNull();
  });

  test('3 plens → recalcula el derivat per recència', () => {
    const s = createFormulaSolver();
    s.touch('V');
    s.touch('T'); // derivat Lg
    expect(s.resolve({ Lg: 99, V: 120, T: 2 })).toEqual({ key: 'Lg', value: 4 });
  });

  test('3 plens sense recència suficient → null (no se sap quin derivar)', () => {
    const s = createFormulaSolver();
    expect(s.resolve({ Lg: 4, V: 120, T: 2 })).toBeNull();
  });
});

describe('FORMULA_KEYS', () => {
  test('són exactament Lg, V, T', () => {
    expect(FORMULA_KEYS).toEqual(['Lg', 'V', 'T']);
  });
});
