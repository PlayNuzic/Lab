import {
  isIntegerPulseSelectable,
  isPulseRemainder,
  makeFractionKey,
  isFractionSelectable,
  getRemainderRange,
  FRACTION_POSITION_EPSILON
} from '../pulse-selectability.js';

describe('pulse-selectability', () => {
  describe('isIntegerPulseSelectable', () => {
    test('múltiplos del numerador son seleccionables', () => {
      expect(isIntegerPulseSelectable(3, 3, 4, 10)).toBe(true);
      expect(isIntegerPulseSelectable(6, 3, 4, 10)).toBe(true);
      expect(isIntegerPulseSelectable(9, 3, 4, 10)).toBe(true);
    });

    test('pulsos sobrantes son seleccionables', () => {
      // Con n=3, Lg=10: lastCycleStart=9, remainder incluye 10
      // Los pulsos 10 están después de 9
      expect(isIntegerPulseSelectable(10, 3, 4, 10)).toBe(false); // endpoint
      // Pero si no es endpoint...
      expect(isIntegerPulseSelectable(7, 3, 4, 11)).toBe(false); // 7 < 9, no es remainder
      expect(isIntegerPulseSelectable(10, 3, 4, 11)).toBe(true); // 10 > 9, es remainder
    });

    test('pulsos intermedios NO múltiplos NO seleccionables', () => {
      expect(isIntegerPulseSelectable(1, 3, 4, 10)).toBe(false);
      expect(isIntegerPulseSelectable(2, 3, 4, 10)).toBe(false);
      expect(isIntegerPulseSelectable(4, 3, 4, 10)).toBe(false);
      expect(isIntegerPulseSelectable(5, 3, 4, 10)).toBe(false);
    });

    test('endpoints no seleccionables', () => {
      expect(isIntegerPulseSelectable(0, 3, 4, 10)).toBe(false);
      expect(isIntegerPulseSelectable(10, 3, 4, 10)).toBe(false);
    });

    test('sin fracción válida, todos intermedios seleccionables', () => {
      expect(isIntegerPulseSelectable(1, null, null, 10)).toBe(true);
      expect(isIntegerPulseSelectable(5, 0, 4, 10)).toBe(true);
      expect(isIntegerPulseSelectable(9, -1, 4, 10)).toBe(true);
    });

    test('casos edge: Lg múltiplo exacto del numerador', () => {
      // n=3, Lg=9: no hay remainder, solo múltiplos seleccionables
      expect(isIntegerPulseSelectable(3, 3, 4, 9)).toBe(true);
      expect(isIntegerPulseSelectable(6, 3, 4, 9)).toBe(true);
      expect(isIntegerPulseSelectable(9, 3, 4, 9)).toBe(false); // endpoint
      expect(isIntegerPulseSelectable(1, 3, 4, 9)).toBe(false);
      expect(isIntegerPulseSelectable(2, 3, 4, 9)).toBe(false);
    });

    test('casos edge: n=1 (todos seleccionables excepto endpoints)', () => {
      expect(isIntegerPulseSelectable(1, 1, 4, 10)).toBe(true);
      expect(isIntegerPulseSelectable(5, 1, 4, 10)).toBe(true);
      expect(isIntegerPulseSelectable(9, 1, 4, 10)).toBe(true);
      expect(isIntegerPulseSelectable(0, 1, 4, 10)).toBe(false);
      expect(isIntegerPulseSelectable(10, 1, 4, 10)).toBe(false);
    });

    test('validación de entradas', () => {
      expect(isIntegerPulseSelectable(NaN, 3, 4, 10)).toBe(false);
      expect(isIntegerPulseSelectable(5, 3, 4, NaN)).toBe(false);
      expect(isIntegerPulseSelectable(5, 3, 4, 0)).toBe(false);
      expect(isIntegerPulseSelectable(5, 3, 4, -10)).toBe(false);
    });
  });

  describe('isPulseRemainder', () => {
    test('detecta pulsos sobrantes correctamente', () => {
      // n=3, Lg=10: lastCycleStart=9, remainder son 10 pero 10 es endpoint
      // No hay remainder real entre pulsos intermedios
      // Probemos con Lg=11: lastCycleStart=9, remainder es 10
      expect(isPulseRemainder(10, 3, 11)).toBe(true);

      // n=4, Lg=10: lastCycleStart=8, remainder son 9
      expect(isPulseRemainder(9, 4, 10)).toBe(true);

      // n=7, Lg=10: lastCycleStart=7, remainder son 8,9
      expect(isPulseRemainder(8, 7, 10)).toBe(true);
      expect(isPulseRemainder(9, 7, 10)).toBe(true);
    });

    test('múltiplos no son remainder', () => {
      expect(isPulseRemainder(9, 3, 11)).toBe(false); // 9 es múltiplo de 3
      expect(isPulseRemainder(6, 3, 11)).toBe(false);
      expect(isPulseRemainder(3, 3, 11)).toBe(false);
    });

    test('endpoints no son remainder', () => {
      expect(isPulseRemainder(0, 3, 10)).toBe(false);
      expect(isPulseRemainder(10, 3, 10)).toBe(false);
    });

    test('sin remainder cuando Lg es múltiplo', () => {
      // n=3, Lg=9: 9 % 3 = 0, no hay remainder
      expect(isPulseRemainder(8, 3, 9)).toBe(false);
      expect(isPulseRemainder(7, 3, 9)).toBe(false);

      // n=5, Lg=10: 10 % 5 = 0, no hay remainder
      expect(isPulseRemainder(9, 5, 10)).toBe(false);
      expect(isPulseRemainder(8, 5, 10)).toBe(false);
    });

    test('pulsos antes del último ciclo no son remainder', () => {
      // n=3, Lg=10: lastCycleStart=9
      expect(isPulseRemainder(1, 3, 10)).toBe(false);
      expect(isPulseRemainder(2, 3, 10)).toBe(false);
      expect(isPulseRemainder(4, 3, 10)).toBe(false);
      expect(isPulseRemainder(5, 3, 10)).toBe(false);
    });

    test('validación de entradas', () => {
      expect(isPulseRemainder(NaN, 3, 10)).toBe(false);
      expect(isPulseRemainder(5, NaN, 10)).toBe(false);
      expect(isPulseRemainder(5, 3, NaN)).toBe(false);
      expect(isPulseRemainder(5, 0, 10)).toBe(false);
      expect(isPulseRemainder(5, -3, 10)).toBe(false);
      expect(isPulseRemainder(0, 3, 10)).toBe(false);
      expect(isPulseRemainder(11, 3, 10)).toBe(false); // fuera de rango
    });
  });

  describe('makeFractionKey', () => {
    test('genera claves válidas', () => {
      expect(makeFractionKey(3, 1, 4)).toBe('3+1/4');
      expect(makeFractionKey(5, 2, 3)).toBe('5+2/3');
      expect(makeFractionKey(0, 1, 2)).toBe('0+1/2');
      expect(makeFractionKey(10, 3, 5)).toBe('10+3/5');
    });

    test('rechaza numerador cero o negativo', () => {
      expect(makeFractionKey(3, 0, 4)).toBe(null);
      expect(makeFractionKey(3, -1, 4)).toBe(null);
    });

    test('rechaza denominador cero o negativo', () => {
      expect(makeFractionKey(3, 1, 0)).toBe(null);
      expect(makeFractionKey(3, 1, -4)).toBe(null);
    });

    test('rechaza numerador >= denominador', () => {
      expect(makeFractionKey(3, 4, 4)).toBe(null);
      expect(makeFractionKey(3, 5, 4)).toBe(null);
    });

    test('validación de entradas no finitas', () => {
      expect(makeFractionKey(NaN, 1, 4)).toBe(null);
      expect(makeFractionKey(3, NaN, 4)).toBe(null);
      expect(makeFractionKey(3, 1, NaN)).toBe(null);
      expect(makeFractionKey(Infinity, 1, 4)).toBe(null);
    });
  });

  describe('isFractionSelectable', () => {
    test('fracciones sobre pulsos múltiplos son seleccionables', () => {
      expect(isFractionSelectable(3, 3, 4, 10)).toBe(true);
      expect(isFractionSelectable(6, 3, 4, 10)).toBe(true);
      expect(isFractionSelectable(9, 3, 4, 10)).toBe(true);
    });

    test('fracciones sobre remainder son seleccionables', () => {
      // n=3, Lg=11: lastCycleStart=9, remainder es 10
      expect(isFractionSelectable(10, 3, 4, 11)).toBe(true);

      // n=4, Lg=10: lastCycleStart=8, remainder es 9
      expect(isFractionSelectable(9, 4, 4, 10)).toBe(true);
    });

    test('fracciones sobre pulsos no seleccionables se rechazan', () => {
      expect(isFractionSelectable(1, 3, 4, 10)).toBe(false);
      expect(isFractionSelectable(2, 3, 4, 10)).toBe(false);
      expect(isFractionSelectable(4, 3, 4, 10)).toBe(false);
    });

    test('fracciones sobre endpoints se rechazan', () => {
      expect(isFractionSelectable(0, 3, 4, 10)).toBe(false);
      expect(isFractionSelectable(10, 3, 4, 10)).toBe(false);
    });

    test('sin fracción activa, todas las fracciones intermedias seleccionables', () => {
      expect(isFractionSelectable(1, null, 4, 10)).toBe(true);
      expect(isFractionSelectable(5, 0, 4, 10)).toBe(true);
      expect(isFractionSelectable(9, -1, 4, 10)).toBe(true);
    });
  });

  describe('getRemainderRange', () => {
    test('calcula rango remainder correctamente', () => {
      // n=3, Lg=10: 10 % 3 = 1, lastCycleStart=9, remainder=[10]
      expect(getRemainderRange(3, 10)).toEqual({
        start: 10,
        end: 10,
        count: 1
      });

      // n=4, Lg=10: 10 % 4 = 2, lastCycleStart=8, remainder=[9,10]
      expect(getRemainderRange(4, 10)).toEqual({
        start: 9,
        end: 10,
        count: 2
      });

      // n=7, Lg=10: 10 % 7 = 3, lastCycleStart=7, remainder=[8,9,10]
      expect(getRemainderRange(7, 10)).toEqual({
        start: 8,
        end: 10,
        count: 3
      });

      // n=3, Lg=11: 11 % 3 = 2, lastCycleStart=9, remainder=[10,11]
      expect(getRemainderRange(3, 11)).toEqual({
        start: 10,
        end: 11,
        count: 2
      });
    });

    test('retorna null cuando no hay remainder', () => {
      // n=5, Lg=10: 10 % 5 = 0, no remainder
      expect(getRemainderRange(5, 10)).toBe(null);

      // n=2, Lg=10: 10 % 2 = 0, no remainder
      expect(getRemainderRange(2, 10)).toBe(null);

      // n=3, Lg=9: 9 % 3 = 0, no remainder
      expect(getRemainderRange(3, 9)).toBe(null);
    });

    test('casos edge: n=1 siempre tiene remainder', () => {
      // n=1, Lg=10: 10 % 1 = 0, pero...
      expect(getRemainderRange(1, 10)).toBe(null);
    });

    test('casos edge: n > Lg', () => {
      // n=15, Lg=10: lastCycleStart=0, remainder=[1,2,...,10]
      expect(getRemainderRange(15, 10)).toEqual({
        start: 1,
        end: 10,
        count: 10
      });
    });

    test('validación de entradas', () => {
      expect(getRemainderRange(NaN, 10)).toBe(null);
      expect(getRemainderRange(3, NaN)).toBe(null);
      expect(getRemainderRange(0, 10)).toBe(null);
      expect(getRemainderRange(-3, 10)).toBe(null);
      expect(getRemainderRange(3, 0)).toBe(null);
      expect(getRemainderRange(3, -10)).toBe(null);
    });
  });

  describe('FRACTION_POSITION_EPSILON', () => {
    test('constante exportada correctamente', () => {
      expect(FRACTION_POSITION_EPSILON).toBe(1e-6);
    });
  });
});
