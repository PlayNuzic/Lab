// libs/app-common/cycle-counter.js
// Shared cycle counter functionality for App16, App17, and future apps

/**
 * Creates a cycle counter controller with flip animation and color states.
 *
 * @param {Object} config - Configuration object
 * @param {HTMLElement} config.element - The digit display element
 * @param {string} [config.zeroClass='playing-zero'] - CSS class for zero position
 * @param {string} [config.activeClass='playing-active'] - CSS class for active position
 * @param {number} [config.flipDuration=150] - Animation duration in ms
 * @returns {Object} Counter controller API
 */
export function createCycleCounter(config) {
  const {
    element,
    zeroClass = 'playing-zero',
    activeClass = 'playing-active',
    flipDuration = 150
  } = config;

  if (!element) {
    console.warn('createCycleCounter: element is required');
    return createNullController();
  }

  let currentValue = null;
  let flipTimeout = null;

  /**
   * Update counter with flip animation
   * @param {number} value - New counter value
   * @param {boolean} isZero - Whether current position is zero
   */
  function update(value, isZero = false) {
    // Skip if same value and element already shows it
    if (value === currentValue && element.textContent === String(value)) {
      updateColor(isZero);
      return;
    }

    currentValue = value;

    // Clear any pending animation
    if (flipTimeout) {
      clearTimeout(flipTimeout);
    }

    // Start flip-out animation
    element.classList.add('flip-out');

    flipTimeout = setTimeout(() => {
      element.textContent = String(value);
      element.classList.remove('flip-out');
      element.classList.add('flip-in');

      flipTimeout = setTimeout(() => {
        element.classList.remove('flip-in');
      }, flipDuration);
    }, flipDuration);

    updateColor(isZero);
  }

  /**
   * Update color state without animation
   * @param {boolean} isZero - Whether current position is zero
   */
  function updateColor(isZero) {
    element.classList.remove(zeroClass, activeClass);

    if (isZero) {
      element.classList.add(zeroClass);
    } else {
      element.classList.add(activeClass);
    }
  }

  /**
   * Clear counter display and remove all states
   */
  function clear() {
    if (flipTimeout) {
      clearTimeout(flipTimeout);
      flipTimeout = null;
    }

    currentValue = null;
    element.textContent = '';
    element.classList.remove('flip-out', 'flip-in', zeroClass, activeClass);
  }

  /**
   * Show total cycles display (stopped state)
   * @param {number} complete - Number of complete cycles
   * @param {number} [remainder=0] - Remainder pulses
   */
  function showTotal(complete, remainder = 0) {
    if (flipTimeout) {
      clearTimeout(flipTimeout);
      flipTimeout = null;
    }

    element.classList.remove('flip-out', 'flip-in', zeroClass, activeClass);
    currentValue = null;

    if (complete === 0 && remainder === 0) {
      element.innerHTML = '';
    } else if (remainder === 0) {
      element.innerHTML = String(complete);
    } else {
      element.innerHTML = `${complete}<sub>${remainder}</sub>`;
    }
  }

  /**
   * Set value without animation
   * @param {number} value - Counter value
   * @param {boolean} isZero - Whether current position is zero
   */
  function setValue(value, isZero = false) {
    currentValue = value;
    element.textContent = String(value);
    updateColor(isZero);
  }

  /**
   * Get current counter value
   * @returns {number|null} Current value or null if not set
   */
  function getValue() {
    return currentValue;
  }

  return {
    update,
    updateColor,
    clear,
    showTotal,
    setValue,
    getValue,
    element
  };
}

/**
 * Creates a null controller that does nothing (for when element is missing)
 */
function createNullController() {
  return {
    update: () => {},
    updateColor: () => {},
    clear: () => {},
    showTotal: () => {},
    setValue: () => {},
    getValue: () => null,
    element: null
  };
}
