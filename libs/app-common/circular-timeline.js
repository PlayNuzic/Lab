/**
 * circular-timeline.js
 *
 * Timeline renderer with circular and linear layout support
 * Handles pulse positioning, bars, and number labels with smooth transitions
 *
 * @module libs/app-common/circular-timeline
 */

const NUMBER_HIDE_THRESHOLD = 100;   // Hide numbers when Lg >= 100
const NUMBER_CIRCLE_OFFSET = 34;     // Distance from circle to number label (px)

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
   */
  function render(lg, options = {}) {
    const { isCircular = false, silent = true } = options;

    timeline.innerHTML = '';
    const pulses = [];

    if (!Number.isFinite(lg) || lg <= 0) return pulses;

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
    applyLayout(pulses, isCircular, { silent });

    return pulses;
  }

  /**
   * Apply layout to provided pulses array
   * Internal helper used by render() to avoid timing issues
   */
  function applyLayout(pulses, isCircular, options = {}) {
    const { silent = false } = options;
    const lg = pulses.length - 1;
    const bars = timeline.querySelectorAll('.bar');

    if (lg <= 0) return;

    if (isCircular) {
      applyCircularLayout(pulses, bars, lg, silent);
    } else {
      applyLinearLayout(pulses, bars, lg);
    }

    updateNumbers();
  }

  /**
   * Switch between circular and linear layout
   * Uses getPulses() to get current pulses from external scope
   *
   * @param {boolean} isCircular - True for circular, false for linear
   * @param {Object} options - Layout options
   * @param {boolean} options.silent - Skip animations (for initial render)
   */
  function setCircular(isCircular, options = {}) {
    const pulses = getPulses();
    applyLayout(pulses, isCircular, options);
  }

  /**
   * Apply circular layout geometry
   */
  function applyCircularLayout(pulses, bars, lg, silent) {
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

      updateNumbers();

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
    const pulses = getPulses();
    const n = document.createElement('div');
    n.className = 'pulse-number';
    n.dataset.index = i;
    n.textContent = i;

    const lgForFont = pulses.length - 1;
    const fontRem = getNumberFontSize(lgForFont);
    n.style.fontSize = fontRem + 'rem';

    if (i === 0 || i === lgForFont) n.classList.add('endpoint');

    if (timeline.classList.contains('circular')) {
      positionNumberCircular(n, i, pulses.length - 1);
    } else {
      positionNumberLinear(n, i, pulses.length - 1);
    }

    timeline.appendChild(n);
  }

  /**
   * Position number in circular layout
   */
  function positionNumberCircular(n, i, lg) {
    const rect = timeline.getBoundingClientRect();
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

    // Clear existing numbers
    document.querySelectorAll('.pulse-number').forEach(n => n.remove());

    if (pulses.length === 0) return;

    const lgForNumbers = pulses.length - 1;
    const tooDense = lgForNumbers >= NUMBER_HIDE_THRESHOLD;

    // Always show endpoints
    showNumber(0);
    showNumber(lgForNumbers);

    // Show intermediate numbers if not too dense
    if (!tooDense) {
      for (let i = 1; i < lgForNumbers; i++) {
        showNumber(i);
      }
    }
  }

  return {
    render,
    setCircular,
    updateNumbers,
    showNumber,
    removeNumber
  };
}
