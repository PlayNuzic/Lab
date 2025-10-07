/**
 * @fileoverview T Indicator - Simple text indicator controller
 *
 * Creates a simple text indicator that can be shown/hidden and updated.
 * Positioning is controlled by the app via CSS - this module does NOT
 * handle automatic positioning or anchoring.
 *
 * Usage:
 * ```js
 * const tIndicator = createTIndicator({
 *   className: 'custom-indicator',
 *   formatValue: (v) => Math.round(v * 10) / 10
 * });
 *
 * tIndicator.updateText(5.234); // Shows "5.2"
 * tIndicator.show();
 * tIndicator.hide();
 * ```
 */

/**
 * Default formatter - rounds to 1 decimal place
 * @param {number|string} value
 * @returns {string}
 */
function defaultFormatValue(value) {
  if (value === '' || value == null) return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  const rounded = Math.round(n * 10) / 10;
  return String(rounded);
}

/**
 * Creates a T indicator controller
 *
 * @param {Object} options
 * @param {string} [options.className=''] - CSS class for the indicator element
 * @param {Function} [options.formatValue] - Custom formatter function
 * @returns {Object} T indicator controller API
 */
export function createTIndicator(options = {}) {
  const {
    className = '',
    formatValue = defaultFormatValue
  } = options;

  const element = document.createElement('div');
  if (className) {
    element.className = className;
  }

  /**
   * Updates the indicator text with formatted value
   * @param {number|string} value
   */
  function updateText(value) {
    const formatted = formatValue(value);
    element.textContent = formatted;
  }

  /**
   * Shows the indicator (sets visibility: visible)
   */
  function show() {
    element.style.visibility = 'visible';
  }

  /**
   * Hides the indicator (sets visibility: hidden)
   */
  function hide() {
    element.style.visibility = 'hidden';
  }

  /**
   * Returns the DOM element
   * @returns {HTMLElement}
   */
  function getElement() {
    return element;
  }

  return {
    element,
    updateText,
    show,
    hide,
    getElement
  };
}
