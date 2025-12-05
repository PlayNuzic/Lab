// libs/app-common/bpm-controller.js
// Shared BPM controller for App16, App17, and future apps

import { attachSpinnerRepeat } from './spinner-repeat.js';

/**
 * Creates a BPM controller with input validation and spinner support.
 *
 * @param {Object} config - Configuration object
 * @param {HTMLInputElement} config.inputEl - BPM input element
 * @param {HTMLElement} [config.upBtn] - Increment button
 * @param {HTMLElement} [config.downBtn] - Decrement button
 * @param {HTMLElement} [config.container] - Container element for visibility toggle
 * @param {number} [config.min=30] - Minimum BPM value
 * @param {number} [config.max=240] - Maximum BPM value
 * @param {number} [config.defaultValue=100] - Default BPM value
 * @param {Function} [config.onChange] - Callback when BPM changes
 * @returns {Object} BPM controller API
 */
export function createBpmController(config) {
  const {
    inputEl,
    upBtn,
    downBtn,
    container,
    min = 30,
    max = 240,
    defaultValue = 100,
    onChange
  } = config;

  if (!inputEl) {
    console.warn('createBpmController: inputEl is required');
    return createNullController();
  }

  let bpm = defaultValue;
  let cleanupUp = null;
  let cleanupDown = null;
  let sanitizeTimer = null;
  const SANITIZE_DELAY = 500;

  /**
   * Set BPM value with clamping and validation
   * @param {number|string} value - New BPM value
   * @param {boolean} [skipCallback=false] - Skip onChange callback
   */
  function setValue(value, skipCallback = false) {
    const parsed = parseInt(value, 10);

    if (isNaN(parsed)) return;

    const clamped = Math.min(max, Math.max(min, parsed));

    if (clamped === bpm) return;

    bpm = clamped;

    if (inputEl.value !== String(bpm)) {
      inputEl.value = bpm;
    }

    if (!skipCallback && typeof onChange === 'function') {
      onChange(bpm);
    }
  }

  /**
   * Get current BPM value
   * @returns {number} Current BPM
   */
  function getValue() {
    return bpm;
  }

  /**
   * Increment BPM by 1
   */
  function increment() {
    if (bpm < max) {
      setValue(bpm + 1);
    }
  }

  /**
   * Decrement BPM by 1
   */
  function decrement() {
    if (bpm > min) {
      setValue(bpm - 1);
    }
  }

  /**
   * Set visibility of BPM container
   * @param {boolean} visible - Whether to show BPM
   */
  function setVisible(visible) {
    if (container) {
      container.classList.toggle('visible', visible);
    }
  }

  /**
   * Attach event listeners
   */
  function attach() {
    // Input events
    inputEl.addEventListener('input', handleInput);
    inputEl.addEventListener('blur', handleBlur);

    // Spinner buttons
    if (upBtn) {
      cleanupUp = attachSpinnerRepeat(upBtn, increment);
    }
    if (downBtn) {
      cleanupDown = attachSpinnerRepeat(downBtn, decrement);
    }
  }

  /**
   * Detach event listeners
   */
  function detach() {
    inputEl.removeEventListener('input', handleInput);
    inputEl.removeEventListener('blur', handleBlur);

    if (sanitizeTimer) {
      clearTimeout(sanitizeTimer);
      sanitizeTimer = null;
    }
    if (cleanupUp) {
      cleanupUp();
      cleanupUp = null;
    }
    if (cleanupDown) {
      cleanupDown();
      cleanupDown = null;
    }
  }

  function handleInput(event) {
    // Clear any pending sanitize timer
    if (sanitizeTimer) {
      clearTimeout(sanitizeTimer);
      sanitizeTimer = null;
    }

    const parsed = parseInt(event.target.value, 10);
    // Only update BPM if value is valid and within range
    // DO NOT clamp during typing - this prevents multi-digit entry
    if (!isNaN(parsed) && parsed >= min && parsed <= max) {
      if (parsed !== bpm) {
        bpm = parsed;
        if (typeof onChange === 'function') {
          onChange(bpm);
        }
      }
    }

    // Auto-sanitize after 500ms of no typing
    sanitizeTimer = setTimeout(() => {
      sanitizeValue();
      sanitizeTimer = null;
    }, SANITIZE_DELAY);
  }

  /**
   * Sanitize (clamp) the input value to valid range
   */
  function sanitizeValue() {
    const parsed = parseInt(inputEl.value, 10);
    let newBpm;
    if (isNaN(parsed) || parsed < min) {
      newBpm = min;
    } else if (parsed > max) {
      newBpm = max;
    } else {
      newBpm = parsed;
    }
    inputEl.value = newBpm;
    if (newBpm !== bpm) {
      bpm = newBpm;
      if (typeof onChange === 'function') {
        onChange(bpm);
      }
    }
  }

  function handleBlur() {
    // Clear any pending sanitize timer
    if (sanitizeTimer) {
      clearTimeout(sanitizeTimer);
      sanitizeTimer = null;
    }
    // On blur, clamp and show final corrected value immediately
    sanitizeValue();
  }

  // Initialize input value
  inputEl.value = bpm;

  return {
    getValue,
    setValue,
    increment,
    decrement,
    setVisible,
    attach,
    detach,
    get min() { return min; },
    get max() { return max; },
    inputEl
  };
}

/**
 * Creates a null controller that does nothing (for when input is missing)
 */
function createNullController() {
  return {
    getValue: () => 100,
    setValue: () => {},
    increment: () => {},
    decrement: () => {},
    setVisible: () => {},
    attach: () => {},
    detach: () => {},
    min: 30,
    max: 240,
    inputEl: null
  };
}
