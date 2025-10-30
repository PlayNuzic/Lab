/**
 * Random Sub-Package
 *
 * Consolidated random/randomization functionality including:
 * - Basic randomization (legacy randomize function)
 * - Random configuration management (config.js)
 * - Random menu UI (menu.js)
 * - Fractional randomization (fractional.js)
 */

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

// Random configuration management
export { applyBaseRandomConfig, updateBaseRandomConfig } from './config.js';

// Random menu UI
export { mergeRandomConfig, initRandomMenu } from './menu.js';

// Fractional randomization
export { randomizeFractional } from './fractional.js';
