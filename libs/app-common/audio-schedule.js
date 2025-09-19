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

/**
 * Compute how long to wait before re-anchoring a running sequence so the next
 * cycle starts exactly on the downbeat (step index 0).
 *
 * @param {{ stepIndex: number, totalPulses: number, bpm: number }} params
 * @returns {{ delaySeconds: number, targetStepIndex: number }|null}
 */
export function computeResyncDelay({ stepIndex, totalPulses, bpm }) {
  const total = normalizeNumber(totalPulses, null);
  const currentStep = normalizeNumber(stepIndex, null);
  const tempo = normalizeNumber(bpm, null);
  if (total == null || total <= 0) return null;
  if (currentStep == null || currentStep < 0) return null;
  if (tempo == null || tempo <= 0) return null;

  const zeroInfo = computeNextZero({ now: currentStep, period: total, lookAhead: 0 });
  if (!zeroInfo) return null;

  const stepsUntilZero = Math.max(0, zeroInfo.eventTime - currentStep);
  const intervalSeconds = 60 / tempo;
  const delaySeconds = stepsUntilZero * intervalSeconds;
  const target = total > 0 ? ((zeroInfo.eventTime % total) + total) % total : 0;

  return {
    delaySeconds,
    targetStepIndex: target
  };
}

export const __testing__ = { normalizeNumber, DEFAULT_EPSILON };
