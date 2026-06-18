/**
 * @module circular-timeline-ring
 * @rol Renderitza els números d'una timeline circular nuzic ("donut"): crea els
 *      `.pulse-number`, els col·loca per trigonometria sobre l'anell cream,
 *      hi afegeix els ticks (via CSS custom props) i contra-rota el text perquè
 *      quedi sempre dret. El CSS del donut (fons, ticks, highlight) viu a
 *      `libs/shared-ui/nuzic-theme.css` (`.timeline.circular`).
 * @dep cap (DOM + rAF). Compartit per App1 (loop) i App17.
 *
 * Geometria extreta d'App17 ("Módulo Temporal - Círculo"). Tots els valors són
 * relatius a `fullRadius = min(w,h)/2`, així que escala amb la mida real del
 * cercle (un ResizeObserver al consumidor pot reposicionar quan canvia).
 */

// Vores pintades del donut cream (sincronitzades amb el radial-gradient del CSS:
// transparent fins al 40%, cream del 40% al 100%).
const INNER_R_RATIO = 0.40;
const OUTER_R_RATIO = 1.00;
const EDGE_INSET_PX = 3;       // marge perquè la punta del tick no creui la vora
const CENTER_R_RATIO = (INNER_R_RATIO + OUTER_R_RATIO) / 2; // 0.70: centre de l'anell
const MIN_TEXT_GAP = 3;        // separació mínima text↔tick
const TICK_SCALE = 0.5;        // els ticks no omplen tota la ranura

/**
 * Crea i col·loca els números d'una timeline circular.
 * @param {HTMLElement} timeline - element `.timeline.circular`
 * @param {Object} opts
 * @param {number} opts.count - nombre de punts al cercle (índexs 0..count-1)
 * @param {(i:number)=>string} [opts.label] - HTML de cada número (per defecte `${i}`)
 * @returns {HTMLElement[]} els `.pulse-number` creats, per índex
 */
export function renderCircularRingNumbers(timeline, { count, label = (i) => String(i) } = {}) {
  if (!timeline || !Number.isFinite(count) || count <= 0) return [];

  timeline.querySelectorAll('.pulse-number').forEach(n => n.remove());

  const els = [];
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'pulse-number';
    el.dataset.index = String(i);
    // Wrapper intern: el `.pulse-number` pare es rota radialment (per alinear
    // els ticks ::before/::after); el `.pulse-number__text` es contra-rota
    // perquè el número quedi sempre dret (mira cap avall, com el 0 a les 12h).
    el.innerHTML = `<span class="pulse-number__text">${label(i)}</span>`;
    if (i === 0) el.classList.add('cycle-start');
    timeline.appendChild(el);
    els.push(el);
  }

  positionCircularRingNumbers(timeline, els);
  return els;
}

/**
 * Reposiciona uns `.pulse-number` ja existents sobre l'anell (sense recrear-los).
 * Mesura després del layout (rAF) perquè les posicions segueixin la mida real.
 * @param {HTMLElement} timeline
 * @param {HTMLElement[]} els
 */
function positionCircularRingNumbers(timeline, els) {
  if (!timeline || !els || !els.length) return;
  const n = els.length;

  requestAnimationFrame(() => {
    const rect = timeline.getBoundingClientRect();
    if (rect.width === 0) return;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const fullRadius = Math.min(rect.width, rect.height) / 2;

    const ringRadius = fullRadius * CENTER_R_RATIO;
    // Font dinàmica: escala amb el radi i la densitat de pulsos.
    const fontPx = Math.max(9, Math.min(24, (fullRadius * 0.20) / Math.sqrt(n / 4)));
    // Distàncies radials del centre del número a cada vora del donut, retallades
    // per EDGE_INSET_PX perquè la punta del tick quedi just dins de la vora.
    const outerSpan = (OUTER_R_RATIO * fullRadius - ringRadius) - EDGE_INSET_PX;
    const innerSpan = (ringRadius - INNER_R_RATIO * fullRadius) - EDGE_INSET_PX;
    // Mitja alçada REAL de la caixa del número (no fontPx/2): line-height ~1.2 +
    // padding + el superíndex (App17 mostra `i¹`, que sobresurt per dalt). Si
    // s'infravalora, el tick exterior es col·loca massa enfora i sobresurt del
    // donut a fonts grans (Lg/n baix). Amb l'estimació real, el tick sempre
    // cau dins de la vora.
    const halfFont = fontPx * 0.85 + 3;
    // Ranures "útils": de la vora del text a la vora del donut a cada costat.
    const slotOuter = Math.max(0, outerSpan - halfFont - MIN_TEXT_GAP);
    const slotInner = Math.max(0, innerSpan - halfFont - MIN_TEXT_GAP);
    // Tick simètric, dimensionat a la ranura més petita perquè càpiga als dos
    // costats; la resta de ranura va als gaps que separen el tick del número.
    const tickLength = Math.max(3, Math.min(slotOuter, slotInner) * TICK_SCALE);
    const gapBefore = MIN_TEXT_GAP + Math.max(0, slotOuter - tickLength);
    const gapAfter = MIN_TEXT_GAP + Math.max(0, slotInner - tickLength);

    els.forEach((el, i) => {
      const angle = (i / n) * 2 * Math.PI - Math.PI / 2; // pols 0 a dalt
      const x = cx + ringRadius * Math.cos(angle);
      const y = cy + ringRadius * Math.sin(angle);
      // Rota el `.pulse-number` perquè segueixi la tangent de l'anell. El
      // setProperty+important venç la regla base `.timeline .pulse-number
      // { top:50% !important; transform: translate(-50%,-50%) !important }`.
      const rotDeg = ((angle + Math.PI / 2) * 180) / Math.PI;
      el.style.setProperty('left', `${x}px`, 'important');
      el.style.setProperty('top', `${y}px`, 'important');
      el.style.setProperty('transform', `translate(-50%, -50%) rotate(${rotDeg}deg)`, 'important');
      el.style.setProperty('font-size', `${fontPx}px`, 'important');
      el.style.setProperty('--pulse-tick-length', `${tickLength}px`);
      el.style.setProperty('--pulse-tick-gap-before', `${gapBefore}px`);
      el.style.setProperty('--pulse-tick-gap-after', `${gapAfter}px`);
      el.style.setProperty('--pulse-number-counter-rot', `${-rotDeg}deg`);
    });
  });
}
