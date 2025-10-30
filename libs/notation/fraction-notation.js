const CLAMPED_MAX_DENOMINATOR = Number.MAX_SAFE_INTEGER;

function createSet(values = []) {
  if (!Array.isArray(values) || !values.length) return null;
  return new Set(values.map((value) => Math.max(1, Math.floor(Number(value) || 0))));
}

function createRule({ denominators, min, max, duration, dots = 0, tuplet = {} }) {
  const set = createSet(denominators);
  const lower = Number.isFinite(min) ? Math.max(1, Math.floor(min)) : null;
  const upper = Number.isFinite(max)
    ? Math.max(lower != null ? lower : 1, Math.floor(max))
    : (lower != null ? CLAMPED_MAX_DENOMINATOR : null);
  return {
    duration,
    dots: Math.max(0, Math.floor(dots)),
    tuplet,
    matches(denominator) {
      if (!Number.isFinite(denominator) || denominator <= 0) return false;
      const value = Math.floor(denominator);
      if (set) {
        return set.has(value);
      }
      if (lower != null && upper != null) {
        return value >= lower && value <= upper;
      }
      if (lower != null) {
        return value >= lower;
      }
      if (upper != null) {
        return value <= upper;
      }
      return false;
    }
  };
}

const FRACTION_RULES = new Map([
  [1, [
    createRule({ denominators: [1], duration: 'q', tuplet: { show: false, ratioed: false } }),
    createRule({ denominators: [2], duration: '8', tuplet: { show: false, ratioed: false } }),
    createRule({ denominators: [3], duration: '8', tuplet: { show: true, ratioed: false } }),
    createRule({ denominators: [4], duration: '16', tuplet: { show: false, ratioed: false } }),
    createRule({ min: 5, max: 7, duration: '16', tuplet: { show: true, ratioed: false } }),
    createRule({ min: 8, max: 15, duration: '32', tuplet: { show: true, ratioed: false } }),
    createRule({ min: 16, duration: '64', tuplet: { show: true, ratioed: false } }),
  ]],
  [2, [
    createRule({ denominators: [1], duration: 'h', tuplet: { show: false, ratioed: false } }),
    createRule({ denominators: [2], duration: 'q', tuplet: { show: false, ratioed: false } }),
    createRule({ denominators: [3], duration: 'q', tuplet: { show: true, ratioed: true } }),
    createRule({ min: 4, max: 7, duration: '8', tuplet: { show: true, ratioed: true } }),
    createRule({ min: 8, max: 15, duration: '16', tuplet: { show: true, ratioed: true } }),
    createRule({ min: 16, max: 31, duration: '32', tuplet: { show: true, ratioed: true } }),
    createRule({ min: 32, duration: '64', tuplet: { show: true, ratioed: true } }),
  ]],
  [3, [
    createRule({ denominators: [1], duration: 'h', dots: 1, tuplet: { show: false, ratioed: false } }),
    createRule({ denominators: [2], duration: 'q', dots: 1, tuplet: { show: true, ratioed: true } }),
    createRule({ min: 3, max: 5, duration: 'q', tuplet: { show: true, ratioed: true } }),
    createRule({ min: 6, max: 8, duration: '8', tuplet: { show: true, ratioed: true } }),
    createRule({ min: 9, max: 17, duration: '16', tuplet: { show: true, ratioed: true } }),
    createRule({ min: 18, duration: '32', tuplet: { show: true, ratioed: true } }),
  ]],
  [4, [
    createRule({ denominators: [1], duration: 'w', tuplet: { show: false, ratioed: false } }),
    createRule({ denominators: [2], duration: 'h', tuplet: { show: false, ratioed: false } }),
    createRule({ denominators: [3], duration: 'h', tuplet: { show: true, ratioed: true } }),
    createRule({ min: 4, max: 7, duration: 'q', tuplet: { show: true, ratioed: true } }),
    createRule({ min: 8, max: 15, duration: '8', tuplet: { show: true, ratioed: true } }),
    createRule({ min: 16, max: 31, duration: '16', tuplet: { show: true, ratioed: true } }),
    createRule({ min: 32, duration: '32', tuplet: { show: true, ratioed: true } }),
  ]],
  [5, [
    createRule({ denominators: [1], duration: 'w', tuplet: { show: false, ratioed: false } }),
    createRule({ denominators: [2], duration: 'h', dots: 1, tuplet: { show: true, ratioed: true } }),
    createRule({ denominators: [3], duration: 'h', tuplet: { show: true, ratioed: true } }),
    createRule({ min: 4, max: 7, duration: 'q', tuplet: { show: true, ratioed: true } }),
    createRule({ min: 8, max: 15, duration: '8', tuplet: { show: true, ratioed: true } }),
    createRule({ min: 16, max: 31, duration: '16', tuplet: { show: true, ratioed: true } }),
    createRule({ min: 32, duration: '32', tuplet: { show: true, ratioed: true } }),
  ]],
  [6, [
    createRule({ denominators: [1], duration: 'w', dots: 1, tuplet: { show: false, ratioed: false } }),
    createRule({ denominators: [2], duration: 'h', dots: 1, tuplet: { show: false, ratioed: false } }),
    createRule({ denominators: [3], duration: 'h', tuplet: { show: true, ratioed: true } }),
    createRule({ min: 4, max: 7, duration: 'q', tuplet: { show: true, ratioed: true } }),
    createRule({ min: 8, max: 15, duration: '8', tuplet: { show: true, ratioed: true } }),
    createRule({ min: 16, max: 31, duration: '16', tuplet: { show: true, ratioed: true } }),
    createRule({ min: 32, duration: '32', tuplet: { show: true, ratioed: true } }),
  ]],
  [7, [
    createRule({ denominators: [1], duration: 'w', dots: 2, tuplet: { show: false, ratioed: false } }),
    createRule({ denominators: [2], duration: 'w', tuplet: { show: true, ratioed: true } }),
    createRule({ denominators: [3], duration: 'h', dots: 1, tuplet: { show: true, ratioed: true } }),
    createRule({ min: 4, max: 5, duration: 'h', tuplet: { show: true, ratioed: true } }),
    createRule({ min: 6, max: 13, duration: 'q', tuplet: { show: true, ratioed: true } }),
    createRule({ min: 14, max: 21, duration: '8', tuplet: { show: true, ratioed: true } }),
    createRule({ min: 22, duration: '16', tuplet: { show: true, ratioed: true } }),
  ]],
  [8, [
    createRule({ denominators: [1], duration: 'w', tuplet: { show: false, ratioed: false } }),
    createRule({ denominators: [2], duration: 'w', tuplet: { show: false, ratioed: false } }),
    createRule({ denominators: [3], duration: 'w', tuplet: { show: true, ratioed: true } }),
    createRule({ min: 4, max: 6, duration: 'h', tuplet: { show: true, ratioed: true } }),
    createRule({ min: 7, max: 15, duration: 'q', tuplet: { show: true, ratioed: true } }),
    createRule({ min: 16, max: 31, duration: '8', tuplet: { show: true, ratioed: true } }),
    createRule({ min: 32, duration: '16', tuplet: { show: true, ratioed: true } }),
  ]],
  [9, [
    createRule({ denominators: [1], duration: 'w', dots: 1, tuplet: { show: false, ratioed: false } }),
    createRule({ min: 2, max: 3, duration: 'w', tuplet: { show: true, ratioed: true } }),
    createRule({ min: 4, max: 6, duration: 'h', tuplet: { show: true, ratioed: true } }),
    createRule({ min: 7, max: 17, duration: 'q', tuplet: { show: true, ratioed: true } }),
    createRule({ min: 18, max: 27, duration: '8', tuplet: { show: true, ratioed: true } }),
    createRule({ min: 28, duration: '16', tuplet: { show: true, ratioed: true } }),
  ]],
]);

function buildResult(numerator, denominator, rule) {
  const duration = typeof rule?.duration === 'string' && rule.duration.trim()
    ? rule.duration.trim()
    : '16';
  const dots = Number.isFinite(rule?.dots) && rule.dots > 0 ? Math.floor(rule.dots) : 0;
  const showTuplet = rule?.tuplet?.show;
  const ratioed = rule?.tuplet?.ratioed;
  const normalizedNumerator = Math.floor(Number(numerator) || 0);
  const normalizedDenominator = Math.floor(Number(denominator) || 0);
  const isEvenRatio = normalizedNumerator > 0
    && normalizedDenominator > 0
    && normalizedNumerator === normalizedDenominator;
  const resolvedShow = isEvenRatio
    ? false
    : (typeof showTuplet === 'boolean' ? showTuplet : null);
  const resolvedRatioed = isEvenRatio
    ? false
    : (typeof ratioed === 'boolean' ? ratioed : null);
  return {
    duration,
    dots,
    tuplet: {
      show: resolvedShow,
      ratioed: resolvedRatioed,
      notesOccupied: numerator,
      denominator
    }
  };
}

function fallbackNotation(numerator, denominator) {
  if (!Number.isFinite(numerator) || numerator <= 0 || !Number.isFinite(denominator) || denominator <= 0) {
    return {
      duration: '16',
      dots: 0,
      tuplet: {
        show: null,
        ratioed: null,
        notesOccupied: numerator || 0,
        denominator: denominator || 0
      }
    };
  }
  const ratio = denominator / numerator;
  let duration;
  if (ratio <= 1) {
    duration = 'q';
  } else if (ratio <= 2) {
    duration = '8';
  } else if (ratio <= 4) {
    duration = '16';
  } else if (ratio <= 8) {
    duration = '32';
  } else {
    duration = '64';
  }
  const shouldShow = ratio !== 1;
  return {
    duration,
    dots: 0,
    tuplet: {
      show: shouldShow,
      ratioed: shouldShow,
      notesOccupied: numerator,
      denominator
    }
  };
}

export function resolveFractionNotation(numeratorInput, denominatorInput) {
  const numerator = Number(numeratorInput);
  const denominator = Number(denominatorInput);
  if (!Number.isFinite(numerator) || numerator <= 0 || !Number.isFinite(denominator) || denominator <= 0) {
    return fallbackNotation(numerator, denominator);
  }
  const rules = FRACTION_RULES.get(Math.floor(numerator));
  if (rules) {
    for (const rule of rules) {
      if (rule.matches(denominator)) {
        return buildResult(Math.floor(numerator), Math.floor(denominator), rule);
      }
    }
  }
  return fallbackNotation(Math.floor(numerator), Math.floor(denominator));
}

export function isSimpleFraction(numeratorInput) {
  return Number.isFinite(Number(numeratorInput)) && Math.floor(Number(numeratorInput)) === 1;
}

export const __testing__ = {
  FRACTION_RULES,
  createRule,
  fallbackNotation,
  buildResult,
};

