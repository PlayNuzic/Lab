/**
 * circular-timeline.js
 *
 * Timeline renderer with circular and linear layout support
 * Handles pulse positioning, bars, and number labels with smooth transitions
 *
 * @module libs/app-common/circular-timeline
 */

const NUMBER_HIDE_THRESHOLD = 100;   // Hide numbers when Lg >= 100
const NUMBER_CIRCLE_OFFSET = 44;     // Distance from circle to number label (px)

/**
 * Creates a circular timeline controller
 *
 * @param {Object} config - Configuration options
 * @param {HTMLElement} config.timeline - Timeline container element
 * @param {HTMLElement} config.timelineWrapper - Wrapper element for circular mode
 * @param {Function} config.getPulses - Returns array of pulse DOM elements
 * @param {Function} config.getNumberFontSize - Returns font size for numbers (receives lg)
 * @returns {Object} Timeline controller API
 *
 * @example
 * const timelineController = createCircularTimeline({
 *   timeline: document.getElementById('timeline'),
 *   timelineWrapper: document.getElementById('timeline-wrapper'),
 *   getPulses: () => pulses,
 *   getNumberFontSize: (lg) => computeNumberFontRem(lg)
 * });
 *
 * timelineController.render(13);  // Render 13 pulses
 * timelineController.setCircular(true);  // Switch to circular mode
 */
export function createCircularTimeline({
  timeline,
  timelineWrapper,
  getPulses,
  getNumberFontSize = (lg) => 1.6  // Default 1.6rem
}) {

  /**
   * Render timeline with pulses and endpoint bars
   *
   * @param {number} lg - Number of pulses to create
   * @param {Object} options - Render options
   * @param {boolean} options.isCircular - Whether to render in circular mode
   * @param {boolean} options.silent - Skip animations
   * @param {boolean} [options.skipNumbers=false] - P-02: omet `updateNumbers()`
   *   intern (només circular); l'app consumidora pinta els seus propis números.
   */
  // P-03: memo de l'últim render — handleInput de les apps crida render()
  // a cada tecla (també per a V/T, que no afecten el timeline) i amb el
  // spinner premut són ~12 reconstruccions DOM per segon. Si (lg,
  // isCircular) no han canviat i els polsos segueixen al DOM, retornem el
  // mateix array sense tocar res (les classes de highlight viuen als
  // elements conservats). La clau NO inclou `skipNumbers`: quan hi ha
  // memo-hit no es torna a cridar applyLayout, així que el valor d'aquesta
  // crida és irrellevant (els números ja es van pintar, o ometre, a la
  // crida anterior amb el mateix isCircular).
  let lastLg = null;
  let lastCircular = null;
  let lastPulses = [];

  function render(lg, options = {}) {
    const { isCircular = false, silent = true, skipNumbers = false } = options;

    if (lg === lastLg && isCircular === lastCircular
        && lastPulses.length && lastPulses[0].isConnected) {
      return lastPulses;
    }

    timeline.innerHTML = '';
    const pulses = [];

    if (!Number.isFinite(lg) || lg <= 0) {
      lastLg = null;
      lastPulses = [];
      return pulses;
    }

    // Create pulses
    for (let i = 0; i <= lg; i++) {
      const p = document.createElement('div');
      p.className = 'pulse';
      p.dataset.index = i;
      if (i === 0 || i === lg) p.classList.add('endpoint');
      timeline.appendChild(p);
      pulses.push(p);

      // Create bars at endpoints
      if (i === 0 || i === lg) {
        const bar = document.createElement('div');
        bar.className = 'bar endpoint';
        timeline.appendChild(bar);
      }
    }

    // Apply layout with local pulses array (not getPulses())
    applyLayout(pulses, isCircular, { silent, skipNumbers });

    lastLg = lg;
    lastCircular = isCircular;
    lastPulses = pulses;
    return pulses;
  }

  /**
   * Apply layout to provided pulses array
   * Internal helper used by render() to avoid timing issues
   */
  function applyLayout(pulses, isCircular, options = {}) {
    const { silent = false, skipNumbers = false } = options;
    const lg = pulses.length - 1;
    const bars = timeline.querySelectorAll('.bar');

    if (lg <= 0) return;

    // P-05: updateNumbers el crida cada layout al seu moment (linear al
    // final síncron; circular DINS del rAF, quan la geometria ja és bona)
    // — abans es cridava també aquí i cada passada el feia DUES vegades.
    // P-02: skipNumbers només s'aplica al camí circular (App1 hi pinta el
    // seu propi donut); el camí lineal manté sempre la doble crida.
    if (isCircular) {
      applyCircularLayout(pulses, bars, lg, silent, skipNumbers);
    } else {
      applyLinearLayout(pulses, bars, lg);
    }
  }

  /**
   * Switch between circular and linear layout
   * Uses getPulses() to get current pulses from external scope
   *
   * @param {boolean} isCircular - True for circular, false for linear
   * @param {Object} options - Layout options
   * @param {boolean} options.silent - Skip animations (for initial render)
   * @param {boolean} [options.skipNumbers=false] - P-02: vegeu render()
   */
  function setCircular(isCircular, options = {}) {
    const pulses = getPulses();
    lastCircular = isCircular; // manté el memo de render() coherent
    applyLayout(pulses, isCircular, options);
  }

  /**
   * Apply circular layout geometry
   */
  function applyCircularLayout(pulses, bars, lg, silent, skipNumbers = false) {
    timelineWrapper.classList.add('circular');
    timeline.classList.add('circular');
    if (silent) timeline.classList.add('no-anim');

    // Create/get circle guide
    const wrapper = timeline.closest('.timeline-wrapper') || timeline.parentElement || timeline;
    let guide = wrapper.querySelector('.circle-guide');
    if (!guide) {
      guide = document.createElement('div');
      guide.className = 'circle-guide';
      guide.style.position = 'absolute';
      guide.style.border = '2px solid var(--timeline-line, #EDE6D3)';
      guide.style.borderRadius = '50%';
      guide.style.pointerEvents = 'none';
      guide.style.transition = 'opacity 300ms ease';
      guide.style.opacity = '0';
      wrapper.appendChild(guide);
    }

    // Position elements after CSS classes applied
    requestAnimationFrame(() => {
      // Position circle guide
      const wRect = wrapper.getBoundingClientRect();
      const gcx = wRect.width / 2;
      const gcy = wRect.height / 2;
      const gRadius = Math.min(wRect.width, wRect.height) / 2 - 10;

      guide.style.left = gcx + 'px';
      guide.style.top = gcy + 'px';
      guide.style.width = (gRadius * 2) + 'px';
      guide.style.height = (gRadius * 2) + 'px';
      guide.style.transform = 'translate(-50%, -50%)';
      guide.style.opacity = '1';

      // Calculate geometry based on timeline element
      const tRect = timeline.getBoundingClientRect();
      const cx = tRect.width / 2;
      const cy = tRect.height / 2;
      const radius = Math.min(tRect.width, tRect.height) / 2 - 1;

      // Position pulses on circle
      pulses.forEach((p, i) => {
        const angle = (i / lg) * 2 * Math.PI + Math.PI / 2;
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);
        p.style.left = x + 'px';
        p.style.top = y + 'px';
        p.style.transform = 'translate(-50%, -50%)';
      });

      // Position endpoint bars
      bars.forEach((bar, idx) => {
        const step = (idx === 0) ? 0 : lg;
        const angle = (step / lg) * 2 * Math.PI + Math.PI / 2;
        const bx = cx + radius * Math.cos(angle);
        const by = cy + radius * Math.sin(angle);

        // Bar length: 25% of diameter, centered on circle
        const barLen = Math.min(tRect.width, tRect.height) * 0.25;
        const intersectPx = barLen / 2;
        const topPx = by - intersectPx;

        bar.style.display = 'block';
        bar.style.left = (bx - 1) + 'px';  // -1 for 2px bar width centering
        bar.style.top = topPx + 'px';
        bar.style.height = barLen + 'px';
        bar.style.transformOrigin = '50% 50%';
        bar.style.transform = 'rotate(' + (angle + Math.PI/2) + 'rad)';
      });

      // P-02: skipNumbers evita reconstruir aquí un joc sencer de
      // .pulse-number quan l'app consumidora (App1) el llença sempre en
      // pintar el seu propi donut al rAF següent.
      if (!skipNumbers) updateNumbers();

      // Fade out guide after timeline is drawn
      if (!silent) {
        setTimeout(() => {
          if (guide && wrapper.contains(guide)) {
            guide.style.opacity = '0';
          }
        }, 400);
      }

      if (silent) {
        // Force reflow to apply styles without transitions
        void timeline.offsetHeight;
        timeline.classList.remove('no-anim');
      }
    });
  }

  /**
   * Apply linear layout geometry
   */
  function applyLinearLayout(pulses, bars, lg) {
    timelineWrapper.classList.remove('circular');
    timeline.classList.remove('circular');

    // Hide circle guide
    const wrapper = timeline.closest('.timeline-wrapper') || timeline.parentElement || timeline;
    const guide = wrapper.querySelector('.circle-guide');
    if (guide) guide.style.opacity = '0';

    // Position pulses linearly
    pulses.forEach((p, i) => {
      const percent = (i / lg) * 100;
      p.style.left = percent + '%';
      p.style.top = '50%';
      p.style.transform = 'translate(-50%, -50%)';
    });

    // Position bars linearly
    bars.forEach((bar, idx) => {
      bar.style.display = 'block';
      const i = idx === 0 ? 0 : lg;
      const percent = (i / lg) * 100;
      bar.style.left = percent + '%';
      bar.style.top = '10%';
      bar.style.height = '80%';
      bar.style.transform = '';
      bar.style.transformOrigin = '';
    });

    updateNumbers();
  }

  /**
   * Show number label at pulse index
   */
  function showNumber(i) {
    const lg = getPulses().length - 1;
    const rect = timeline.classList.contains('circular')
      ? timeline.getBoundingClientRect()
      : null;
    timeline.appendChild(buildNumber(i, lg, rect));
  }

  /**
   * P-05: construeix l'etiqueta SENSE tocar el DOM — el rect (circular)
   * arriba per paràmetre perquè updateNumbers el llegeixi UNA vegada i no
   * per etiqueta (gBCR intercalat amb appendChild = reflow forçat per
   * etiqueta, ~200 per passada a Lg=99 amb la passada doble d'abans).
   */
  function buildNumber(i, lg, rect) {
    const n = document.createElement('div');
    n.className = 'pulse-number';
    n.dataset.index = i;
    n.textContent = i;

    const fontRem = getNumberFontSize(lg);
    n.style.fontSize = fontRem + 'rem';

    if (i === 0 || i === lg) n.classList.add('endpoint');

    if (rect) {
      positionNumberCircular(n, i, lg, rect);
    } else {
      positionNumberLinear(n, i, lg);
    }
    return n;
  }

  /**
   * Position number in circular layout
   */
  function positionNumberCircular(n, i, lg, rect) {
    const radius = Math.min(rect.width, rect.height) / 2 - 10;
    const offset = NUMBER_CIRCLE_OFFSET;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const angle = (i / lg) * 2 * Math.PI + Math.PI / 2;
    const x = cx + (radius + offset) * Math.cos(angle);
    let y = cy + (radius + offset) * Math.sin(angle);

    // Shift endpoints slightly for better visibility
    const xShift = (i === 0) ? -16 : (i === lg ? 16 : 0);
    n.style.left = (x + xShift) + 'px';
    n.style.transform = 'translate(-50%, -50%)';

    if (i === 0 || i === lg) {
      n.style.top = (y + 8) + 'px';
      n.style.zIndex = (i === 0) ? '3' : '2';
    } else {
      n.style.top = y + 'px';
    }
  }

  /**
   * Position number in linear layout
   */
  function positionNumberLinear(n, i, lg) {
    const percent = (i / lg) * 100;
    n.style.left = percent + '%';
  }

  /**
   * Remove number label at index
   */
  function removeNumber(i) {
    const el = timeline.querySelector(`.pulse-number[data-index="${i}"]`);
    if (el) el.remove();
  }

  /**
   * Update all number labels
   * Shows 0 and Lg always, hides intermediate numbers if too dense
   */
  function updateNumbers() {
    const pulses = getPulses();

    // Clear existing numbers — amb scope al timeline (P-05): el query de
    // document sencer escanejava tota la pàgina i podia endur-se etiquetes
    // d'altres components (timeline-layout.js crea la mateixa classe).
    timeline.querySelectorAll('.pulse-number').forEach(n => n.remove());

    if (pulses.length === 0) return;

    const lgForNumbers = pulses.length - 1;
    const tooDense = lgForNumbers >= NUMBER_HIDE_THRESHOLD;

    // Una sola lectura de layout i una sola inserció (fragment).
    const rect = timeline.classList.contains('circular')
      ? timeline.getBoundingClientRect()
      : null;
    const fragment = document.createDocumentFragment();

    fragment.appendChild(buildNumber(0, lgForNumbers, rect));
    fragment.appendChild(buildNumber(lgForNumbers, lgForNumbers, rect));

    if (!tooDense) {
      for (let i = 1; i < lgForNumbers; i++) {
        fragment.appendChild(buildNumber(i, lgForNumbers, rect));
      }
    }
    timeline.appendChild(fragment);
  }

  return {
    render,
    setCircular,
    updateNumbers,
    showNumber,
    removeNumber
  };
}
