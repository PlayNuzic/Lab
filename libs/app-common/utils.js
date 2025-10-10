export function computeHitSizePx(lg) {
  const refLg = 30;          // comfortable at 30
  const base = 32;           // px at Lg=30
  const k = 0.5;             // perceptual (sqrt) scaling
  const minPx = 14;          // never smaller
  const maxPx = 44;          // never larger
  const safe = Math.max(1, Number(lg) || 1);
  const scale = Math.pow(refLg / safe, k);
  return Math.max(minPx, Math.min(maxPx, Math.round(base * scale)));
}

export function computeNumberFontRem(lg) {
  const BASE_REM = 1.3;   // ideal size at Lg=30
  const TARGET   = 30;    // reference Lg
  const K        = 0.5;   // perceptual exponent (sqrt scaling)

  // Detect mobile screen
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 600px)').matches;

  // Adjust limits based on screen size
  const MIN_REM  = isMobile ? 0.85 : 1.0;   // Smaller min on mobile
  const MAX_REM  = isMobile ? 1.1 : 2.4;    // Much smaller max on mobile

  const safeLg   = Math.max(1, Number(lg) || 1);
  const scale    = Math.pow(TARGET / safeLg, K);
  return Math.max(MIN_REM, Math.min(MAX_REM, BASE_REM * scale));
}

export function solidMenuBackground(panel) {
  if (!panel) return;
  // Resolve background using theme variables to avoid any transparent computed styles
  const theme = document.body?.dataset?.theme || 'light';
  const rootStyles = getComputedStyle(document.documentElement);
  const bgVar = theme === 'dark' ? '--bg-dark' : '--bg-light';
  const txtVar = theme === 'dark' ? '--text-dark' : '--text-light';
  const bg =
    rootStyles.getPropertyValue(bgVar).trim() ||
    getComputedStyle(document.body).backgroundColor;
  const txt =
    rootStyles.getPropertyValue(txtVar).trim() ||
    getComputedStyle(document.body).color;
  panel.style.backgroundColor = bg;
  panel.style.color = txt;
  // Ensure no background-image sneaks in
  panel.style.backgroundImage = 'none';
}
