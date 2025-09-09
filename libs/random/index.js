import { randInt } from '../utils/index.js';

export const DEFAULT_RANGES = {
  Lg: { min: 1, max: 100 },
  V: { min: 1, max: 1000 },
  T: { min: 1, max: 10000 }
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
