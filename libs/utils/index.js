// Numeric helper functions used across multiple apps.  Keeping them in a
// dedicated module makes it easier to share behaviour and test it as the
// project grows.

/**
 * Return a random integer between `a` and `b` (both inclusive).
 */
export function randInt(a, b) {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

/**
 * Constrain `x` to the inclusive range `[min, max]`.
 */
export function clamp(x, min, max) {
  return x < min ? min : x > max ? max : x;
}

/**
 * Wrap a number symmetrically around zero with modulus `m`.
 * For example, wrapping 6 with `m = 10` yields `-4`.
 */
export function wrapSym(n, m) {
  const h = Math.floor(m / 2);
  n = ((n + h) % m + m) % m - h;
  return n === h ? -h : n;
}
