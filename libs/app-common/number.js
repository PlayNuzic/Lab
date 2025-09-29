export function parsePositiveInt(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function parseIntSafe(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function parseFloatSafe(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function gcd(a, b) {
  let x = Math.abs(Number(a));
  let y = Math.abs(Number(b));
  if (!Number.isFinite(x) || !Number.isFinite(y) || x === 0 || y === 0) {
    if (Number.isFinite(x) && x > 0) return x;
    if (Number.isFinite(y) && y > 0) return y;
    return 1;
  }
  while (y !== 0) {
    const temp = x % y;
    x = y;
    y = temp;
  }
  return x || 1;
}

export function lcm(a, b) {
  const x = Math.abs(Math.round(Number(a) || 0));
  const y = Math.abs(Math.round(Number(b) || 0));
  if (!Number.isFinite(x) || !Number.isFinite(y) || x === 0 || y === 0) {
    return 1;
  }
  return Math.abs((x / gcd(x, y)) * y) || 1;
}

export function resolveRange(minInput, maxInput, fallbackRange = [0, 0], { minValue = -Infinity, maxValue = Infinity } = {}) {
  const fallback = Array.isArray(fallbackRange) && fallbackRange.length === 2
    ? [...fallbackRange]
    : [0, 0];
  const minParsed = parseFloatSafe(minInput);
  const maxParsed = parseFloatSafe(maxInput);

  let lo;
  let hi;
  if (!Number.isFinite(minParsed) && !Number.isFinite(maxParsed)) {
    [lo, hi] = fallback;
  } else if (!Number.isFinite(minParsed)) {
    lo = fallback[0];
    const candidate = Number.isFinite(maxParsed) ? maxParsed : fallback[1];
    hi = Math.max(lo, candidate);
  } else if (!Number.isFinite(maxParsed)) {
    const candidate = minParsed;
    hi = fallback[1];
    lo = Math.min(candidate, hi);
  } else {
    lo = Math.min(minParsed, maxParsed);
    hi = Math.max(minParsed, maxParsed);
  }

  if (!Number.isFinite(lo)) lo = fallback[0];
  if (!Number.isFinite(hi)) hi = fallback[1];

  if (Number.isFinite(minValue)) {
    lo = Math.max(lo, minValue);
    hi = Math.max(hi, minValue);
  }
  if (Number.isFinite(maxValue)) {
    lo = Math.min(lo, maxValue);
    hi = Math.min(hi, maxValue);
  }
  if (hi < lo) hi = lo;
  return [lo, hi];
}

export function resolveIntRange(minInput, maxInput, fallbackRange = [1, 1], { minValue = 1 } = {}) {
  const fallback = Array.isArray(fallbackRange) && fallbackRange.length === 2
    ? [...fallbackRange]
    : [minValue, minValue];
  const [rawLo, rawHi] = resolveRange(minInput, maxInput, fallback, { minValue });
  const lo = Number.isFinite(rawLo) ? Math.max(minValue, Math.round(rawLo)) : Math.max(minValue, Math.round(fallback[0]));
  const hiCandidate = Number.isFinite(rawHi) ? Math.round(rawHi) : Math.round(fallback[1]);
  const hi = Math.max(lo, Math.max(minValue, hiCandidate));
  return [lo, hi];
}
