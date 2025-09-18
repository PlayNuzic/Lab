const DEFAULT_EPSILON = 1e-9;

function normalizeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Compute timing information for the next downbeat relative to `now`.
 *
 * @param {{ now: number, period: number, lookAhead?: number }} params
 * @returns {{ previousTime: number, eventTime: number, scheduleTime: number }|null}
 */
export function computeNextZero({ now, period, lookAhead = 0 }) {
  const safePeriod = normalizeNumber(period, null);
  if (safePeriod == null || safePeriod <= 0) return null;
  const safeNow = Math.max(0, normalizeNumber(now));
  const safeLookAhead = Math.max(0, normalizeNumber(lookAhead));
  const epsilon = Math.max(DEFAULT_EPSILON, safePeriod * 1e-6);

  const quotient = Math.floor((safeNow + epsilon) / safePeriod);
  const previousTime = quotient * safePeriod;
  const delta = safeNow - previousTime;
  let eventTime = delta <= epsilon ? previousTime : (quotient + 1) * safePeriod;

  let scheduleTime = eventTime - safeLookAhead;
  if (scheduleTime + epsilon < safeNow) {
    eventTime += safePeriod;
    scheduleTime = eventTime - safeLookAhead;
  }

  return {
    previousTime,
    eventTime,
    scheduleTime: Math.max(safeNow, scheduleTime)
  };
}

export const __testing__ = { normalizeNumber, DEFAULT_EPSILON };
