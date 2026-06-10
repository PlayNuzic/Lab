/**
 * Highlights de playback de les apps de fraccions (H-16: el trio
 * clearHighlights/highlightPulse/highlightCycle estava copiat a cada app).
 *
 * Sap il·luminar el pols enter actiu i la parella marcador+etiqueta de la
 * subdivisió actual (cerca per dataset.cycleIndex/subdivision). El
 * `void el.offsetWidth` abans d'afegir 'active' és load-bearing: força el
 * reflow perquè l'animació CSS es reiniciï encara que la classe es
 * re-apliqui al mateix element en ticks consecutius.
 *
 * El guard d'estat (isPlaying) i la conversió d'índexs escalats
 * (scaledIndex % d) queden a l'app — varien per transport. Els extres
 * per app (cel·les de l'editor Pfr, tokens) entren per hooks.
 */

export function createFractionHighlighter(config = {}) {
  const {
    getPulses,
    getCycleMarkers,
    getCycleLabels,
    onClear = null,
    onPulseHighlight = null,
    onCycleHighlight = null
  } = config;

  function clear() {
    getPulses().forEach(p => p.classList.remove('active'));
    getCycleMarkers().forEach(m => m.classList.remove('active'));
    getCycleLabels().forEach(l => l.classList.remove('active'));
    onClear?.();
  }

  /** Il·lumina el pols ENTER pulseIndex (l'app ja ha desescalat l'índex). */
  function highlightPulseIndex(pulseIndex) {
    const pulses = getPulses();
    pulses.forEach(p => p.classList.remove('active'));

    const total = pulses.length > 1 ? pulses.length - 1 : 0;
    if (total <= 0) return;

    const raw = Number.isFinite(pulseIndex) ? pulseIndex : 0;
    const normalized = Math.max(0, Math.min(raw, total));
    const pulse = pulses[normalized];
    if (pulse) {
      void pulse.offsetWidth;
      pulse.classList.add('active');
    }

    onPulseHighlight?.(normalized);
  }

  /** Il·lumina la subdivisió del payload {cycleIndex, subdivisionIndex}. */
  function highlightCycle(payload = {}) {
    const cycleIndex = Number(payload.cycleIndex);
    const subdivisionIndex = Number(payload.subdivisionIndex);
    if (!Number.isFinite(cycleIndex) || !Number.isFinite(subdivisionIndex)) return;

    const cycleMarkers = getCycleMarkers();
    const cycleLabels = getCycleLabels();
    cycleMarkers.forEach(m => m.classList.remove('active'));
    cycleLabels.forEach(l => l.classList.remove('active'));

    const matches = (el) =>
      Number(el.dataset.cycleIndex) === cycleIndex &&
      Number(el.dataset.subdivision) === subdivisionIndex;

    const marker = cycleMarkers.find(matches);
    const label = cycleLabels.find(matches);

    if (marker) {
      void marker.offsetWidth;
      marker.classList.add('active');
    }
    if (label) label.classList.add('active');

    onCycleHighlight?.({
      cycleIndex,
      subdivisionIndex,
      base: marker ? Number(marker.dataset.base) : null
    });
  }

  return { clear, highlightPulseIndex, highlightCycle };
}
