/**
 * @fileoverview Info Tooltip Controller
 *
 * Creates a floating tooltip that can be shown/hidden and positioned
 * relative to an anchor element. Automatically hides on scroll/resize.
 *
 * Usage:
 * ```js
 * const tooltip = createInfoTooltip({
 *   className: 'hover-tip auto-tip-below top-bar-info-tip'
 * });
 *
 * tooltip.show(contentFragment, anchorElement);
 * tooltip.hide();
 * tooltip.destroy();
 * ```
 */

/**
 * Creates an info tooltip controller
 *
 * @param {Object} options
 * @param {string} [options.className] - CSS classes for the tooltip element
 * @param {boolean} [options.autoHideOnScroll=true] - Auto-hide on window scroll
 * @param {boolean} [options.autoHideOnResize=true] - Auto-hide on window resize
 * @param {number} [options.verticalOffset=0] - Vertical offset in pixels from anchor bottom
 * @param {boolean} [options.useInnerHTML=false] - Allow HTML content via innerHTML
 * @param {number|null} [options.autoRemoveDelay=null] - Auto-remove after ms (null = persistent)
 * @returns {Object} Tooltip controller API
 */
export function createInfoTooltip(options = {}) {
  const {
    className = 'fraction-info-bubble auto-tip-below',
    autoHideOnScroll = true,
    autoHideOnResize = true,
    verticalOffset = 0,
    useInnerHTML = false,
    autoRemoveDelay = null
  } = options;

  let tooltipEl = null;
  let scrollListener = null;
  let resizeListener = null;

  /**
   * Ensures tooltip element exists and returns it
   * @returns {HTMLElement}
   */
  function ensureTooltipElement() {
    if (tooltipEl) return tooltipEl;

    const tip = document.createElement('div');
    tip.className = className;
    document.body.appendChild(tip);
    tooltipEl = tip;

    return tip;
  }

  /**
   * Shows the tooltip with content positioned relative to anchor
   *
   * @param {DocumentFragment|HTMLElement|string} content - Content to display
   * @param {HTMLElement} anchor - Element to position relative to
   */
  function show(content, anchor) {
    if (!anchor) return;

    const tip = ensureTooltipElement();

    // Update content (support HTML if enabled)
    if (useInnerHTML && typeof content === 'string') {
      tip.innerHTML = content;
    } else if (content instanceof DocumentFragment || content instanceof HTMLElement) {
      tip.replaceChildren(content);
    } else if (typeof content === 'string') {
      tip.textContent = content;
    }

    // Position tooltip below anchor with configurable offset
    const rect = anchor.getBoundingClientRect();
    const y = rect.bottom + window.scrollY + verticalOffset;

    // Center horizontally - need to wait for render to get tooltip width
    tip.style.top = y + 'px';
    tip.style.left = rect.left + rect.width / 2 + 'px';

    // Show with CSS class
    tip.classList.add('show');

    // Adjust horizontal position after render to center properly
    requestAnimationFrame(() => {
      if (tooltipEl) {
        const x = rect.left + rect.width / 2 - tooltipEl.offsetWidth / 2;
        tooltipEl.style.left = x + 'px';
      }
    });

    // Setup auto-hide listeners
    setupAutoHideListeners();

    // Auto-remove if configured
    if (autoRemoveDelay && Number.isFinite(autoRemoveDelay)) {
      setTimeout(() => {
        if (tooltipEl && tooltipEl.parentNode) {
          tooltipEl.parentNode.removeChild(tooltipEl);
          tooltipEl = null;
        }
        removeAutoHideListeners();
      }, autoRemoveDelay);
    }
  }

  /**
   * Hides the tooltip
   */
  function hide() {
    if (tooltipEl) {
      tooltipEl.classList.remove('show');
    }
    removeAutoHideListeners();
  }

  /**
   * Setup event listeners for auto-hide behavior
   */
  function setupAutoHideListeners() {
    if (autoHideOnScroll && !scrollListener) {
      scrollListener = hide;
      window.addEventListener('scroll', scrollListener, { passive: true });
    }
    if (autoHideOnResize && !resizeListener) {
      resizeListener = hide;
      window.addEventListener('resize', resizeListener);
    }
  }

  /**
   * Remove auto-hide event listeners
   */
  function removeAutoHideListeners() {
    if (scrollListener) {
      window.removeEventListener('scroll', scrollListener);
      scrollListener = null;
    }
    if (resizeListener) {
      window.removeEventListener('resize', resizeListener);
      resizeListener = null;
    }
  }

  /**
   * Destroys the tooltip and cleans up all resources
   */
  function destroy() {
    hide();
    if (tooltipEl && tooltipEl.parentNode) {
      tooltipEl.parentNode.removeChild(tooltipEl);
    }
    tooltipEl = null;
  }

  /**
   * Returns the tooltip element (may be null if not yet created)
   * @returns {HTMLElement|null}
   */
  function getElement() {
    return tooltipEl;
  }

  return {
    show,
    hide,
    destroy,
    getElement
  };
}
