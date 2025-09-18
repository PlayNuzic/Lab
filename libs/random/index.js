import { randInt } from '../utils/index.js';

export const DEFAULT_RANGES = {
  Lg: { min: 2, max: 30 },
  V: { min: 40, max: 320 },
  T: { min: 0.1, max: 10 }
};

export function randomize(ranges = DEFAULT_RANGES) {
  const result = {};
  for (const [key, { min, max }] of Object.entries(ranges)) {
    const lo = Number(min);
    const hi = Number(max);
    if (Number.isNaN(lo) || Number.isNaN(hi)) continue;
    if (key === 'T') {
      result[key] = Math.random() * (hi - lo) + lo;
    } else {
      result[key] = randInt(lo, hi);
    }
  }
  return result;
}
