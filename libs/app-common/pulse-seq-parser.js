/**
 * @fileoverview Parseo y validación de tokens de secuencia de pulsos
 *
 * Este módulo proporciona funciones puras para parsear y validar el texto del campo
 * de secuencia de pulsos, que puede contener:
 * - Pulsos enteros (ej: "1", "3", "5")
 * - Fracciones con punto (ej: "3.2" = base 3, numerador 2)
 * - Fracciones iniciadas por punto (ej: ".2" = se infiere base del contexto)
 *
 * Todas las funciones son puras (sin side-effects) y pueden testearse independientemente.
 */

/**
 * Regex para capturar tokens: enteros y fracciones
 * Patrones: "1", "3.2", ".5", "0.3"
 */
const TOKEN_REGEX = /\d+\.\d+|\.\d+|\d+/g;

/**
 * Epsilon para determinar si un valor es aproximadamente un entero
 */
export const FRACTION_POSITION_EPSILON = 0.001;

/**
 * Parsea el texto del pulseSeq en tokens con posiciones
 * @param {string} text - Texto del input (ej: "  1  3.2  5  ")
 * @returns {Array<{raw: string, start: number, type: 'int'|'fraction'}>}
 */
export function parseTokens(text) {
  if (typeof text !== 'string') return [];

  const tokens = [];
  const regex = new RegExp(TOKEN_REGEX.source, TOKEN_REGEX.flags);
  let match;

  while ((match = regex.exec(text)) !== null) {
    const raw = match[0];
    tokens.push({
      raw,
      start: match.index,
      type: raw.includes('.') ? 'fraction' : 'int'
    });
  }

  return tokens;
}

/**
 * Valida un token de pulso entero
 * @param {object} token - {raw: string}
 * @param {object} context - {lg: number}
 * @returns {{valid: boolean, value?: number, error?: string}}
 */
export function validateInteger(token, { lg }) {
  const n = Number.parseInt(token.raw, 10);

  if (!Number.isFinite(n) || n <= 0) {
    return { valid: false, error: 'not-finite' };
  }

  if (!Number.isNaN(lg) && n >= lg) {
    return { valid: false, error: 'too-big', value: n };
  }

  return { valid: true, value: n };
}

/**
 * Determina si un valor fraccionario está suficientemente cerca de un entero
 * @param {number} value - Valor fraccionario
 * @returns {number|null} - Índice entero si está cerca, null si no
 */
export function nearestPulseIndex(value) {
  if (!Number.isFinite(value)) return null;
  const nearest = Math.round(value);
  return Math.abs(value - nearest) < FRACTION_POSITION_EPSILON ? nearest : null;
}

/**
 * Valida un token de fracción
 * @param {object} token - {raw: string, start: number}
 * @param {object} context - {numerator, denominator, lg, getFractionInfoByLabel, makeFractionKey, fractionValue, fractionDisplay, cycleNotationToFraction}
 * @returns {{valid: boolean, entry?: object, error?: string, snapToInteger?: number}}
 */
export function validateFraction(token, context) {
  const {
    numerator: rawNumerator,
    denominator: rawDenominator,
    lg,
    getFractionInfoByLabel,
    makeFractionKey,
    fractionValue,
    fractionDisplay,
    cycleNotationToFraction,
    resolvePulseSeqGap
  } = context;

  const denomValue = Number.isFinite(rawDenominator) && rawDenominator > 0 ? rawDenominator : null;
  const numeratorValue = Number.isFinite(rawNumerator) && rawNumerator > 0 ? rawNumerator : null;
  const raw = token.raw;
  const normalizedRaw = typeof raw === 'string' ? raw.trim() : '';

  // Caso 1: Fracción que empieza con punto (ej: ".2")
  if (raw.startsWith('.')) {
    return validateDotPrefixedFraction(token, {
      denomValue,
      lg,
      getFractionInfoByLabel,
      makeFractionKey,
      fractionValue,
      fractionDisplay,
      resolvePulseSeqGap,
      normalizedRaw
    });
  }

  // Caso 2: Fracción estándar (ej: "3.2")
  return validateStandardFraction(token, {
    denomValue,
    numeratorValue,
    lg,
    getFractionInfoByLabel,
    makeFractionKey,
    fractionValue,
    fractionDisplay,
    cycleNotationToFraction,
    normalizedRaw
  });
}

/**
 * Valida fracción con prefijo de punto (ej: ".2")
 * @private
 */
function validateDotPrefixedFraction(token, context) {
  const { denomValue, lg, getFractionInfoByLabel, makeFractionKey, fractionValue, fractionDisplay, resolvePulseSeqGap, normalizedRaw } = context;
  const { raw } = token;

  if (!denomValue) {
    return { valid: false, error: 'no-denominator' };
  }

  const digits = raw.slice(1);
  if (!digits) {
    return { valid: false, error: 'no-digits' };
  }

  const fracNumerator = Number.parseInt(digits, 10);
  if (!Number.isFinite(fracNumerator) || fracNumerator <= 0) {
    return { valid: false, error: 'invalid-numerator' };
  }

  if (fracNumerator >= denomValue) {
    return { valid: false, error: 'too-big', raw };
  }

  // Resolver gap para inferir base
  const gap = resolvePulseSeqGap(token.start, lg);
  const base = Number.isFinite(gap.base) ? gap.base : 0;
  const next = Number.isFinite(gap.next) ? gap.next : (Number.isFinite(lg) ? lg : Infinity);

  if (!Number.isFinite(base)) {
    return { valid: false, error: 'invalid-base' };
  }

  if (!Number.isNaN(lg) && base >= lg) {
    return { valid: false, error: 'base-too-big' };
  }

  // Intentar match con etiqueta existente
  const labelCandidate = `${base}.${digits}`;
  const matchedFraction = getFractionInfoByLabel(labelCandidate, { base });

  if (matchedFraction && matchedFraction.key) {
    return {
      valid: true,
      entry: {
        base: matchedFraction.base,
        numerator: matchedFraction.numerator,
        denominator: matchedFraction.denominator,
        value: matchedFraction.value,
        display: matchedFraction.display,
        key: matchedFraction.key,
        cycleIndex: matchedFraction.cycleIndex,
        subdivisionIndex: matchedFraction.subdivisionIndex,
        pulsesPerCycle: matchedFraction.pulsesPerCycle,
        rawLabel: normalizedRaw || (typeof matchedFraction.rawLabel === 'string' ? matchedFraction.rawLabel : '')
      }
    };
  }

  // Crear nueva fracción
  const value = base + fracNumerator / denomValue;

  if (value <= base) {
    return { valid: false, error: 'value-too-small' };
  }

  if (Number.isFinite(next) && value >= next) {
    return { valid: false, error: 'value-exceeds-next' };
  }

  if (!Number.isNaN(lg) && value >= lg) {
    return { valid: false, error: 'value-exceeds-lg' };
  }

  // Verificar si está demasiado cerca de un entero
  const snapToInt = nearestPulseIndex(value);
  if (snapToInt !== null) {
    return { valid: true, snapToInteger: snapToInt };
  }

  const key = makeFractionKey(base, fracNumerator, denomValue);
  if (!key) {
    return { valid: false, error: 'invalid-key' };
  }

  return {
    valid: true,
    entry: {
      base,
      numerator: fracNumerator,
      denominator: denomValue,
      value,
      display: fractionDisplay(base, fracNumerator, denomValue),
      key,
      cycleIndex: null,
      subdivisionIndex: null,
      pulsesPerCycle: null,
      rawLabel: normalizedRaw
    }
  };
}

/**
 * Valida fracción estándar (ej: "3.2")
 * @private
 */
function validateStandardFraction(token, context) {
  const {
    denomValue,
    numeratorValue,
    lg,
    getFractionInfoByLabel,
    makeFractionKey,
    fractionValue,
    fractionDisplay,
    cycleNotationToFraction,
    normalizedRaw
  } = context;

  const { raw } = token;
  const [intPart, fractionDigitsRaw] = raw.split('.', 2);
  const intVal = Number.parseInt(intPart, 10);

  if (!Number.isFinite(intVal) || intVal < 0) {
    return { valid: false, error: 'invalid-int-part' };
  }

  if (!denomValue) {
    return { valid: false, error: 'no-denominator' };
  }

  const digits = fractionDigitsRaw ?? '';
  if (!digits) {
    return { valid: false, error: 'no-digits' };
  }

  const subdivisionIndex = Number.parseInt(digits, 10);
  if (!Number.isFinite(subdivisionIndex) || subdivisionIndex <= 0) {
    return { valid: false, error: 'invalid-subdivision' };
  }

  if (subdivisionIndex >= denomValue) {
    return { valid: false, error: 'too-big', raw };
  }

  // Intentar match con etiqueta existente
  const matchedFraction = getFractionInfoByLabel(raw) || getFractionInfoByLabel(`${intVal}.${subdivisionIndex}`);

  let normalizedBase = intVal;
  let normalizedNumerator = subdivisionIndex;
  let value = intVal + subdivisionIndex / denomValue;
  let displayOverride = null;

  // Convertir notación cíclica a fraccionaria si aplica
  if (Number.isFinite(numeratorValue) && numeratorValue > 0) {
    const cycleCapacity = Number.isFinite(lg) && lg > 0
      ? Math.floor(lg / numeratorValue)
      : null;

    const rawCycle = intVal / numeratorValue;
    const cycleIndexFromBase = Number.isFinite(rawCycle)
      ? Math.round(rawCycle)
      : null;

    const isCycleApproxInteger = Number.isFinite(cycleIndexFromBase)
      && Math.abs(rawCycle - cycleIndexFromBase) <= FRACTION_POSITION_EPSILON;

    const mapping = isCycleApproxInteger
      ? cycleNotationToFraction(cycleIndexFromBase, subdivisionIndex, numeratorValue, denomValue)
      : null;

    if (mapping) {
      let canonicalBase = Number.isFinite(mapping.base)
        ? Math.floor(mapping.base + FRACTION_POSITION_EPSILON)
        : null;

      let canonicalNumerator = Number.isFinite(mapping.numerator)
        ? Math.round(mapping.numerator)
        : null;

      // Manejar carry si el numerador es >= denominador
      if (Number.isFinite(canonicalNumerator) && canonicalNumerator >= denomValue) {
        const carry = Math.floor(canonicalNumerator / denomValue);
        canonicalNumerator -= carry * denomValue;
        if (Number.isFinite(canonicalBase)) {
          canonicalBase += carry;
        }
      }

      const numeratorValid = Number.isFinite(canonicalNumerator) && canonicalNumerator > 0 && canonicalNumerator < denomValue;
      const baseValid = Number.isFinite(canonicalBase);
      const canonicalValue = baseValid && numeratorValid
        ? fractionValue(canonicalBase, canonicalNumerator, denomValue)
        : NaN;

      const withinLg = Number.isFinite(canonicalValue)
        ? (!Number.isFinite(lg) || canonicalValue < lg - FRACTION_POSITION_EPSILON)
        : false;

      const cycleBase = Number.isFinite(cycleIndexFromBase) && Number.isFinite(numeratorValue)
        ? cycleIndexFromBase * numeratorValue
        : NaN;

      const cycleOriginValid = Number.isFinite(cycleBase)
        ? (!Number.isFinite(lg) || cycleBase < lg)
        : true;

      const withinCapacity = Number.isFinite(cycleCapacity)
        ? (cycleCapacity > 0 && Number.isFinite(cycleIndexFromBase) && cycleIndexFromBase < cycleCapacity)
        : true;

      if (baseValid && numeratorValid && Number.isFinite(canonicalValue) && withinLg && cycleOriginValid && withinCapacity) {
        normalizedBase = canonicalBase;
        normalizedNumerator = canonicalNumerator;
        value = canonicalValue;
        displayOverride = {
          cycleIndex: isCycleApproxInteger ? cycleIndexFromBase : null,
          subdivisionIndex,
          pulsesPerCycle: numeratorValue
        };
      }
    }
  }

  if (!Number.isFinite(value)) {
    return { valid: false, error: 'invalid-value' };
  }

  if (!Number.isNaN(lg) && value >= lg) {
    return { valid: false, error: 'too-big', raw: `${intVal}.${digits}` };
  }

  // Verificar si está demasiado cerca de un entero
  const snapToInt = nearestPulseIndex(value);
  if (snapToInt !== null) {
    return { valid: true, snapToInteger: snapToInt };
  }

  const key = makeFractionKey(normalizedBase, normalizedNumerator, denomValue);
  if (!key) {
    return { valid: false, error: 'invalid-key' };
  }

  // Si hay match existente con la misma key, usarlo
  if (matchedFraction && matchedFraction.key === key) {
    return {
      valid: true,
      entry: {
        base: matchedFraction.base,
        numerator: matchedFraction.numerator,
        denominator: matchedFraction.denominator,
        value: matchedFraction.value,
        display: matchedFraction.display,
        key: matchedFraction.key,
        cycleIndex: matchedFraction.cycleIndex,
        subdivisionIndex: matchedFraction.subdivisionIndex,
        pulsesPerCycle: matchedFraction.pulsesPerCycle,
        rawLabel: normalizedRaw || (typeof matchedFraction.rawLabel === 'string' ? matchedFraction.rawLabel : '')
      }
    };
  }

  // Crear nueva entrada con override si aplica
  const overrideCycleIndex = Number.isFinite(displayOverride?.cycleIndex) && displayOverride.cycleIndex >= 0
    ? Math.floor(displayOverride.cycleIndex)
    : null;

  const overrideSubdivisionIndex = Number.isFinite(displayOverride?.subdivisionIndex) && displayOverride.subdivisionIndex >= 0
    ? Math.floor(displayOverride.subdivisionIndex)
    : null;

  const overridePulsesPerCycle = Number.isFinite(displayOverride?.pulsesPerCycle) && displayOverride.pulsesPerCycle > 0
    ? displayOverride.pulsesPerCycle
    : null;

  return {
    valid: true,
    entry: {
      base: normalizedBase,
      numerator: normalizedNumerator,
      denominator: denomValue,
      value,
      display: fractionDisplay(normalizedBase, normalizedNumerator, denomValue, displayOverride || undefined),
      key,
      cycleIndex: overrideCycleIndex,
      subdivisionIndex: overrideSubdivisionIndex,
      pulsesPerCycle: overridePulsesPerCycle,
      rawLabel: normalizedRaw
    }
  };
}

/**
 * Resuelve el gap (base, next) para una posición del caret
 * @param {number} position - Posición del caret en el texto
 * @param {number} lg - Longitud del grid
 * @param {object} pulseSeqRanges - Mapa de key → [start, end] de rangos de texto
 * @returns {{base: number|null, next: number|null, index: number}}
 */
export function resolvePulseSeqGap(position, lg, pulseSeqRanges) {
  const ranges = Object.entries(pulseSeqRanges || {})
    .map(([key, range]) => {
      // Extraer número: si la key contiene guión, tomar solo la parte antes del guión
      const numericPart = key.includes('-') ? key.split('-')[0] : key;
      const num = Number(numericPart);
      return { key, range, num };
    })
    .filter(entry => Number.isFinite(entry.num) && entry.num >= 0)
    .sort((a, b) => a.range[0] - b.range[0]);

  let base = null;
  let next = null;
  let index = 0;

  for (let i = 0; i < ranges.length; i++) {
    const { num, range } = ranges[i];
    if (position > range[1]) {
      base = num;
      index = i + 1;
      continue;
    }
    if (position <= range[0]) {
      next = num;
      break;
    }
  }

  if (base == null) base = 0;
  if (next == null && Number.isFinite(lg)) next = lg;

  return { base, next, index };
}
