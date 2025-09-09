/**
 * Random value generation for common musical parameters.
 *
 * Usage:
 *   import { randomize } from './libs/random/index.js';
 *   const params = randomize({ Lg: { min: 1, max: 12 } });
 *
 * Each key accepts an optional `{min, max}` filter.  Missing keys use the
 * defaults defined by this module and new keys can be added on the fly.
 */
import { randInt } from '../utils/index.js';

const DEFAULT_RANGES = {
  Lg: { min: 1, max: 12 },
  V: { min: 1, max: 7 },
  T: { min: 1, max: 4 },
  Pulsos: { min: 1, max: 16 },
};

export function randomize(filters = {}) {
  const ranges = { ...DEFAULT_RANGES, ...filters };
  const result = {};
  for (const [key, range] of Object.entries(ranges)) {
    const { min, max } = range;
    result[key] = randInt(min, max);
  }
  return result;
}

export { DEFAULT_RANGES };
