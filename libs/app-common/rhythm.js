const NOTE_NAMES = new Map([
  [1, 'redonda'],
  [2, 'blanca'],
  [4, 'negra'],
  [8, 'corchea'],
  [16, 'semicorchea'],
  [32, 'fusa'],
  [64, 'semifusa'],
  [128, 'garrapatea'],
  [256, 'semigarrapatea']
]);

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function isPowerOfTwo(value) {
  return value > 0 && (value & (value - 1)) === 0;
}

function nextPowerOfTwo(value) {
  if (value < 1) return 1;
  let n = 1;
  while (n < value) n <<= 1;
  return n;
}

function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const temp = y;
    y = x % y;
    x = temp;
  }
  return x || 1;
}

function simplifyFraction(numerator, denominator) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return { numerator: numerator || 0, denominator: denominator || 1 };
  }
  const sign = denominator < 0 ? -1 : 1;
  const divisor = gcd(numerator, denominator);
  return {
    numerator: (numerator / divisor) * sign,
    denominator: Math.abs(denominator / divisor)
  };
}

function denominatorToNoteName(denominator) {
  const rounded = Math.round(denominator);
  return NOTE_NAMES.get(rounded) || `figura 1/${rounded}`;
}

function denominatorToRestName(denominator) {
  const note = denominatorToNoteName(denominator);
  if (note.startsWith('figura')) {
    return `silencio ${note}`;
  }
  return `silencio de ${note}`;
}

function computeAllowedDurations(totalPulses) {
  const durations = new Set([1]);
  let value = 2;
  while (value <= totalPulses) {
    durations.add(value);
    value *= 2;
  }
  durations.add(totalPulses);
  return Array.from(durations).sort((a, b) => a - b);
}

export function generatePulsePermutations(totalPulses, { allowedDurations, maxPatterns = 512 } = {}) {
  const safeTotal = isPositiveInteger(totalPulses) ? totalPulses : 0;
  if (safeTotal === 0) return [];
  const durations = (allowedDurations && allowedDurations.length > 0)
    ? Array.from(new Set(allowedDurations.filter(isPositiveInteger))).sort((a, b) => a - b)
    : computeAllowedDurations(safeTotal);
  const patterns = [];

  function backtrack(remaining, sequence) {
    if (patterns.length >= maxPatterns) return;
    if (remaining === 0) {
      patterns.push(sequence.slice());
      return;
    }
    for (const duration of durations) {
      if (duration > remaining) break;
      sequence.push(duration);
      backtrack(remaining - duration, sequence);
      sequence.pop();
      if (patterns.length >= maxPatterns) return;
    }
  }

  backtrack(safeTotal, []);
  return patterns;
}

export function createDurationMetadata({ pulses, numerator, denominator }) {
  const safePulses = isPositiveInteger(pulses) ? pulses : 0;
  const safeNumerator = isPositiveInteger(numerator) ? numerator : 0;
  const safeDenominator = isPositiveInteger(denominator) ? denominator : 0;

  if (safePulses === 0 || safeNumerator === 0 || safeDenominator === 0) {
    return {
      pulses: 0,
      beats: 0,
      beatValue: 0,
      pulsesPerBeat: 0,
      baseFraction: { numerator: 0, denominator: 1 },
      baseNoteName: null,
      baseRestName: null,
      tupletRatio: null,
      durations: []
    };
  }

  const pulsesPerBeat = safePulses / safeNumerator;
  const isIntegerDivision = Number.isInteger(pulsesPerBeat);
  const baseDenominator = isIntegerDivision ? safeDenominator * pulsesPerBeat : safeDenominator;
  const baseFraction = simplifyFraction(1, baseDenominator);
  const baseNoteName = denominatorToNoteName(baseFraction.denominator);
  const baseRestName = denominatorToRestName(baseFraction.denominator);

  const tupletRatio = !isPowerOfTwo(safeDenominator)
    ? (() => {
        const simplified = simplifyFraction(safeNumerator, safeDenominator);
        return {
          numerator: simplified.numerator,
          denominator: simplified.denominator,
          text: `${simplified.numerator}:${simplified.denominator}`
        };
      })()
    : null;

  const allowedDurations = computeAllowedDurations(safePulses);
  const durations = allowedDurations
    .filter(value => value <= safePulses)
    .map(length => {
      const fraction = simplifyFraction(length, baseDenominator);
      const durationDenominator = baseDenominator / length;
      const isValid = Number.isInteger(durationDenominator) && durationDenominator !== 0;
      const noteName = isValid
        ? denominatorToNoteName(durationDenominator)
        : `figura ${fraction.numerator}/${fraction.denominator}`;
      const restName = isValid
        ? denominatorToRestName(durationDenominator)
        : `silencio ${fraction.numerator}/${fraction.denominator}`;
      const beatFraction = Number.isInteger(pulsesPerBeat)
        ? simplifyFraction(length, pulsesPerBeat || 1)
        : { numerator: length, denominator: pulsesPerBeat }; // fallback for compound metrics
      return {
        pulses: length,
        fraction,
        beatFraction,
        noteName,
        restName
      };
    });

  return {
    pulses: safePulses,
    beats: safeNumerator,
    beatValue: safeDenominator,
    pulsesPerBeat: isIntegerDivision ? pulsesPerBeat : 0,
    baseFraction,
    baseDenominator,
    baseNoteName,
    baseRestName,
    tupletRatio,
    durations
  };
}

function buildPatternFromPermutation(permutation, metadata) {
  const { durations, tupletRatio } = metadata;
  const byLength = new Map(durations.map(item => [item.pulses, item]));
  return permutation.map(length => {
    const base = byLength.get(length);
    if (!base) {
      const fraction = simplifyFraction(length, metadata.baseDenominator || metadata.baseFraction.denominator);
      const beatFraction = simplifyFraction(length, metadata.pulsesPerBeat || 1);
      return {
        pulses: length,
        fraction,
        beatFraction,
        noteName: `figura ${fraction.numerator}/${fraction.denominator}`,
        restName: `silencio ${fraction.numerator}/${fraction.denominator}`,
        ratio: tupletRatio
      };
    }
    return {
      ...base,
      ratio: tupletRatio
    };
  });
}

export function getRhythmPattern({ pulses, numerator, denominator, maxPatterns } = {}) {
  const metadata = createDurationMetadata({ pulses, numerator, denominator });
  if (metadata.pulses === 0 || metadata.beats === 0 || metadata.beatValue === 0) {
    return {
      metadata,
      patterns: [],
      sequence: []
    };
  }

  const allowed = metadata.durations.map(duration => duration.pulses);
  const permutations = generatePulsePermutations(metadata.pulses, {
    allowedDurations: allowed,
    maxPatterns
  });

  const patterns = permutations.map(permutation => buildPatternFromPermutation(permutation, metadata));
  return {
    metadata,
    patterns,
    sequence: patterns[0] || []
  };
}

export const __testing__ = {
  NOTE_NAMES,
  isPowerOfTwo,
  nextPowerOfTwo,
  gcd,
  simplifyFraction,
  denominatorToNoteName,
  denominatorToRestName,
  computeAllowedDurations,
  buildPatternFromPermutation
};
