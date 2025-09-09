import { randInt } from '../utils/index.js';

export function randomize(options = {}) {
  const result = {};

  if (options.Lg?.enabled) {
    const [min, max] = options.Lg.range;
    result.Lg = randInt(min, max);
  }

  if (options.V?.enabled) {
    const [min, max] = options.V.range;
    result.V = randInt(min, max);
  }

  if (options.T?.enabled) {
    const [min, max] = options.T.range;
    result.T = Math.random() * (max - min) + min;
  }

  return result;
}
