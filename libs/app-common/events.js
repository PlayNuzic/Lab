/**
 * Event Binding Utilities for Lab apps
 * Standardizes common event handling patterns
 */

/**
 * Bind number input controls (input + increment/decrement buttons)
 * @param {Object} elements - Bound DOM elements
 * @param {Object} config - Configuration for each parameter
 * @param {Object} config[param] - Configuration for parameter (Lg, V, T, etc.)
 * @param {Function} config[param].onChange - Handler for input change
 * @param {Function} config[param].onIncrement - Handler for increment button
 * @param {Function} config[param].onDecrement - Handler for decrement button
 */
export function bindNumberInputs(elements, config) {
  for (const [param, callbacks] of Object.entries(config)) {
    const input = elements[`input${param}`];
    const upBtn = elements[`input${param}Up`];
    const downBtn = elements[`input${param}Down`];

    if (input && callbacks.onChange) {
      input.addEventListener('input', callbacks.onChange);
    }

    if (upBtn && callbacks.onIncrement) {
      upBtn.addEventListener('click', callbacks.onIncrement);
    }

    if (downBtn && callbacks.onDecrement) {
      downBtn.addEventListener('click', callbacks.onDecrement);
    }
  }
}

/**
 * Bind simple button actions
 * @param {Object} elements - Bound DOM elements
 * @param {Object} actions - Map of element key to click handler
 */
export function bindButtonActions(elements, actions) {
  for (const [buttonKey, callback] of Object.entries(actions)) {
    const button = elements[buttonKey];
    if (button && typeof callback === 'function') {
      button.addEventListener('click', callback);
    }
  }
}

/**
 * Bind toggle button actions with visual feedback
 * @param {Object} elements - Bound DOM elements
 * @param {Object} toggles - Map of element key to toggle configuration
 * @param {Function} toggles[key].onToggle - Toggle handler function
 * @param {Function} toggles[key].getState - Function to get current state
 * @param {string} toggles[key].activeClass - CSS class for active state
 */
export function bindToggleButtons(elements, toggles) {
  for (const [buttonKey, config] of Object.entries(toggles)) {
    const button = elements[buttonKey];
    if (!button || typeof config.onToggle !== 'function') continue;

    const activeClass = config.activeClass || 'active';

    button.addEventListener('click', () => {
      const newState = config.onToggle();

      // Update visual state if getState function provided
      if (typeof config.getState === 'function') {
        button.classList.toggle(activeClass, config.getState());
      } else if (typeof newState === 'boolean') {
        button.classList.toggle(activeClass, newState);
      }
    });

    // Set initial state if getState function provided
    if (typeof config.getState === 'function') {
      button.classList.toggle(activeClass, config.getState());
    }
  }
}

/**
 * Bind random control inputs (checkbox + min/max inputs)
 * @param {Object} elements - Bound DOM elements
 * @param {Object} config - Configuration for each random parameter
 * @param {Function} config[param].onToggle - Handler for checkbox toggle
 * @param {Function} config[param].onMinChange - Handler for min input change
 * @param {Function} config[param].onMaxChange - Handler for max input change
 */
export function bindRandomControls(elements, config) {
  for (const [param, callbacks] of Object.entries(config)) {
    const toggle = elements[`rand${param}Toggle`];
    const minInput = elements[`rand${param}Min`];
    const maxInput = elements[`rand${param}Max`];

    if (toggle && callbacks.onToggle) {
      toggle.addEventListener('change', callbacks.onToggle);
    }

    if (minInput && callbacks.onMinChange) {
      minInput.addEventListener('input', callbacks.onMinChange);
    }

    if (maxInput && callbacks.onMaxChange) {
      maxInput.addEventListener('input', callbacks.onMaxChange);
    }
  }
}

/**
 * Bind form validation with visual feedback
 * @param {Object} elements - Bound DOM elements
 * @param {Object} validators - Map of element key to validation function
 * @param {Object} options - Validation options
 * @param {string} options.errorClass - CSS class for error state
 * @param {string} options.validClass - CSS class for valid state
 */
export function bindFormValidation(elements, validators, options = {}) {
  const errorClass = options.errorClass || 'input-error';
  const validClass = options.validClass || 'input-valid';

  for (const [elementKey, validateFn] of Object.entries(validators)) {
    const element = elements[elementKey];
    if (!element || typeof validateFn !== 'function') continue;

    const validate = () => {
      const isValid = validateFn(element.value, element);

      element.classList.remove(errorClass, validClass);
      element.classList.add(isValid ? validClass : errorClass);

      return isValid;
    };

    // Validate on input and blur
    element.addEventListener('input', validate);
    element.addEventListener('blur', validate);

    // Initial validation
    validate();
  }
}

/**
 * Bind keyboard shortcuts
 * @param {Object} shortcuts - Map of key combination to handler
 * @param {HTMLElement} scope - Element to attach listeners to (default: document)
 */
export function bindKeyboardShortcuts(shortcuts, scope = document) {
  const handleKeydown = (event) => {
    const key = event.key.toLowerCase();
    const modifiers = [];

    if (event.ctrlKey) modifiers.push('ctrl');
    if (event.metaKey) modifiers.push('meta');
    if (event.shiftKey) modifiers.push('shift');
    if (event.altKey) modifiers.push('alt');

    const combination = [...modifiers, key].join('+');

    if (shortcuts[combination]) {
      event.preventDefault();
      shortcuts[combination](event);
    }
  };

  scope.addEventListener('keydown', handleKeydown);

  // Return cleanup function
  return () => scope.removeEventListener('keydown', handleKeydown);
}

/**
 * Bind rhythm app standard events (common pattern for Apps 1-4)
 * @param {Object} elements - Bound DOM elements
 * @param {Object} handlers - Event handlers
 * @returns {Object} Cleanup functions
 */
export function bindRhythmAppEvents(elements, handlers) {
  const cleanupFunctions = [];

  // Number inputs (Lg, V, T)
  if (handlers.numberInputs) {
    bindNumberInputs(elements, handlers.numberInputs);
  }

  // Main control buttons
  if (handlers.buttons) {
    bindButtonActions(elements, handlers.buttons);
  }

  // Toggle buttons (loop, circular timeline, etc.)
  if (handlers.toggles) {
    bindToggleButtons(elements, handlers.toggles);
  }

  // Random controls
  if (handlers.randomControls) {
    bindRandomControls(elements, handlers.randomControls);
  }

  // Keyboard shortcuts
  if (handlers.shortcuts) {
    const cleanup = bindKeyboardShortcuts(handlers.shortcuts);
    cleanupFunctions.push(cleanup);
  }

  // Return cleanup function
  return () => {
    cleanupFunctions.forEach(cleanup => cleanup());
  };
}