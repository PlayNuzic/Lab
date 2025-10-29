/**
 * UI Helper utilities for Lab rhythm apps
 * Provides shared UI initialization patterns for common controls
 */

/**
 * Initialize circular timeline toggle with persistence
 * @param {Object} options - Configuration options
 * @param {HTMLInputElement} options.toggle - Checkbox element for circular timeline
 * @param {Object} options.storage - Storage instance with load/save methods
 * @param {Function} [options.onToggle] - Callback when state changes (receives checked state)
 * @param {boolean} [options.defaultValue] - Default value if no stored value (default: true)
 * @returns {Object} Helper with getState and setState methods
 */
export function initCircularTimelineToggle({ toggle, storage, onToggle, defaultValue = true }) {
  if (!toggle) return { getState: () => defaultValue, setState: () => {} };

  // Initialize from storage
  const stored = storage?.load?.('circular');
  toggle.checked = stored == null ? defaultValue : stored === '1';

  // Listen for changes
  toggle.addEventListener('change', (e) => {
    const checked = e.target.checked;
    storage?.save?.('circular', checked ? '1' : '0');
    if (typeof onToggle === 'function') {
      onToggle(checked);
    }
  });

  return {
    getState: () => toggle.checked,
    setState: (value) => {
      toggle.checked = !!value;
      storage?.save?.('circular', value ? '1' : '0');
      if (typeof onToggle === 'function') {
        onToggle(!!value);
      }
    }
  };
}

/**
 * Initialize color selector with persistence
 * @param {Object} options - Configuration options
 * @param {HTMLInputElement} options.selector - Color input element
 * @param {Object} options.storage - Storage instance with load/save methods
 * @param {string} [options.cssVariable] - CSS variable name (default: '--selection-color')
 * @param {Function} [options.onColorChange] - Callback when color changes (receives color value)
 * @returns {Object} Helper with getColor and setColor methods
 */
export function initColorSelector({ selector, storage, cssVariable = '--selection-color', onColorChange }) {
  if (!selector) return { getColor: () => null, setColor: () => {} };

  // Initialize from storage
  const storedColor = storage?.load?.('color');
  if (storedColor) {
    selector.value = storedColor;
    document.documentElement.style.setProperty(cssVariable, storedColor);
  }

  // Listen for changes
  selector.addEventListener('input', (e) => {
    const color = e.target.value;
    document.documentElement.style.setProperty(cssVariable, color);
    storage?.save?.('color', color);
    if (typeof onColorChange === 'function') {
      onColorChange(color);
    }
  });

  return {
    getColor: () => selector.value,
    setColor: (color) => {
      selector.value = color;
      document.documentElement.style.setProperty(cssVariable, color);
      storage?.save?.('color', color);
      if (typeof onColorChange === 'function') {
        onColorChange(color);
      }
    }
  };
}

/**
 * Bind unit label visibility to input focus/blur events
 * @param {Object} options - Configuration options
 * @param {HTMLInputElement} options.input - Input element
 * @param {HTMLElement} options.unit - Unit label element
 * @returns {Object} Helper with attach and detach methods
 */
export function bindUnitVisibility({ input, unit }) {
  if (!input || !unit) return { attach: () => {}, detach: () => {} };

  const handleFocus = () => { unit.style.display = 'block'; };
  const handleBlur = () => { unit.style.display = 'none'; };

  return {
    attach: () => {
      input.addEventListener('focus', handleFocus);
      input.addEventListener('blur', handleBlur);
    },
    detach: () => {
      input.removeEventListener('focus', handleFocus);
      input.removeEventListener('blur', handleBlur);
    }
  };
}

/**
 * Batch bind multiple input/unit pairs for visibility
 * @param {Array<{input: HTMLInputElement, unit: HTMLElement}>} pairs - Array of input/unit pairs
 * @returns {Object} Helper with attachAll and detachAll methods
 */
export function bindUnitsVisibility(pairs) {
  const bindings = pairs
    .filter(pair => pair.input && pair.unit)
    .map(pair => bindUnitVisibility(pair));

  return {
    attachAll: () => bindings.forEach(b => b.attach()),
    detachAll: () => bindings.forEach(b => b.detach())
  };
}
