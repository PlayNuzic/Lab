/**
 * Línia de temps de les apps de fraccions (H-15: App26-31 duien aquest
 * esquelet copiat ~100 línies per app).
 *
 * Construeix els .pulse-number (0..Lg), l'etiqueta "n/d" i els ticks +
 * etiquetes ".N" de subdivisió (via gridFromOrigin, saltant els enters,
 * que ja tenen tick del pulse-number a nuzic-theme), i els posiciona per
 * percentatge horitzontal — la vertical és cosa del CSS.
 *
 * Les diferències per app entren per callbacks de decoració:
 * - decoratePulse(el, info): classes extra del pols (endpoint/ghost/
 *   non-selectable/'·' final...). Per defecte, l'estil "cycle-end":
 *   l'últim pols es dibuixa com a '·'.
 * - decorateSubdivision(el, info): aplicat a marcador I etiqueta
 *   (p.ex. non-selectable a App29/31).
 * - onAfterRender({pulses, cycleMarkers, cycleLabels}): l'app hi recull
 *   els arrays (selection handlers, engine.bindTimeline, sync...).
 *
 * No confondre amb timeline-renderer.js (createFractionalTimelineRenderer,
 * App4) ni timeline-layout.js (layout lineal/circular d'App2-5): aquest
 * és l'esquelet fix-horitzontal de les apps de fraccions.
 */

import { gridFromOrigin } from './subdivision.js';

/** Decoració per defecte: l'últim pols és el '·' de tancament de cicle. */
export function decoratePulseWithEndDot(el, { index, lg }) {
  if (index === lg) {
    el.classList.add('cycle-end');
    el.textContent = '·';
  }
}

export function createFractionTimeline(config = {}) {
  const {
    timeline,
    getLg,
    getNumerator,
    getDenominator,
    decoratePulse = decoratePulseWithEndDot,
    decorateSubdivision = null,
    onAfterRender = null
  } = config;

  if (!timeline) throw new Error('createFractionTimeline requires a timeline element');

  let pulses = [];
  let cycleMarkers = [];
  let cycleLabels = [];

  function render() {
    // Sense transicions durant el re-render (la classe la treu el rAF final).
    timeline.classList.add('no-anim');

    pulses = [];
    cycleMarkers = [];
    cycleLabels = [];
    timeline.innerHTML = '';

    const lg = getLg();
    const numerator = getNumerator();
    const denominator = getDenominator();

    // Números de pols (nuzic-theme pinta els ticks via ::before/::after).
    for (let i = 0; i <= lg; i++) {
      const num = document.createElement('div');
      num.className = 'pulse-number';
      num.dataset.index = String(i);
      num.textContent = String(i);
      decoratePulse?.(num, { index: i, lg, numerator, denominator });
      timeline.appendChild(num);
      pulses.push(num);
    }

    // Etiqueta "n/d" ancorada a l'esquerra de la fila de subdivisions.
    const subdivisionLabel = document.createElement('div');
    subdivisionLabel.className = 'subdivision-label';
    subdivisionLabel.textContent = `${numerator}/${denominator}`;
    timeline.appendChild(subdivisionLabel);

    // Ticks + etiquetes ".N" de subdivisió. Els enters (subdivisionIndex 0)
    // se salten: ja tenen tick del pulse-number.
    const grid = gridFromOrigin({ lg, numerator, denominator });
    if (grid.cycles > 0 && grid.subdivisions.length) {
      grid.subdivisions.forEach(({ cycleIndex, subdivisionIndex, position }) => {
        if (subdivisionIndex === 0) return;

        const info = {
          cycleIndex,
          subdivisionIndex,
          position,
          base: cycleIndex * numerator,
          globalSubdiv: cycleIndex * denominator + subdivisionIndex,
          lg,
          numerator,
          denominator
        };

        const marker = document.createElement('div');
        marker.className = 'cycle-marker';
        applyDatasets(marker, info);
        decorateSubdivision?.(marker, info);
        timeline.appendChild(marker);
        cycleMarkers.push(marker);

        const label = document.createElement('div');
        label.className = 'cycle-label';
        applyDatasets(label, info);
        label.textContent = `.${subdivisionIndex}`;
        decorateSubdivision?.(label, info);
        timeline.appendChild(label);
        cycleLabels.push(label);
      });
    }

    layout();
    onAfterRender?.({ pulses, cycleMarkers, cycleLabels });

    requestAnimationFrame(() => {
      timeline.classList.remove('no-anim');
    });
  }

  function applyDatasets(el, info) {
    el.dataset.cycleIndex = String(info.cycleIndex);
    el.dataset.subdivision = String(info.subdivisionIndex);
    el.dataset.position = String(info.position);
    // Dataset que cada consumidor llegeix a la seva manera: App28/29 fan
    // tokens "base.N"; App30/31 arrosseguen per globalSubdiv.
    el.dataset.base = String(info.base);
    el.dataset.globalSubdiv = String(info.globalSubdiv);
  }

  /** Percentatge horitzontal; la vertical és estàtica al CSS de cada app. */
  function layout() {
    const lg = getLg();
    pulses.forEach((num) => {
      const idx = parseInt(num.dataset.index, 10);
      num.style.left = (idx / lg) * 100 + '%';
    });
    cycleMarkers.forEach((marker) => {
      const pos = parseFloat(marker.dataset.position);
      marker.style.left = (pos / lg) * 100 + '%';
    });
    cycleLabels.forEach((label) => {
      const pos = parseFloat(label.dataset.position);
      label.style.left = (pos / lg) * 100 + '%';
    });
  }

  return {
    render,
    layout,
    getPulses: () => pulses,
    getCycleMarkers: () => cycleMarkers,
    getCycleLabels: () => cycleLabels
  };
}
