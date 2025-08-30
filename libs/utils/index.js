export function randInt(a, b) {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

export function clamp(x, min, max) {
  return x < min ? min : x > max ? max : x;
}

export function wrapSym(n, m) {
  const h = Math.floor(m / 2);
  n = ((n + h) % m + m) % m - h;
  return n === h ? -h : n;
}
