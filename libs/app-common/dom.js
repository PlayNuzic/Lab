/**
 * DOM utilities for Lab apps
 * Provides element binding with LED support and eliminates getElementById duplication
 */

export const $ = id => document.getElementById(id);
export const $$ = (selector, parent = document) => parent.querySelectorAll(selector);

/**
 * Bind multiple DOM elements at once with optional LED management
 * @param {Object} elementMap - Map of key -> element ID
 * @param {Object} options - Configuration options
 * @returns {Object} Object containing elements and leds
 */
export function bindElements(elementMap, options = {}) {
  const elements = {};
  const leds = {};

  for (const [key, id] of Object.entries(elementMap)) {
    const element = $(id);
    if (!element) {
      console.warn(`Element with id "${id}" not found for key "${key}"`);
      continue;
    }

    elements[key] = element;

    // Si es un LED, crear referencia especial para gestión de estado
    if (id.startsWith('led') || options.ledKeys?.includes(key)) {
      leds[key] = element;
    }
  }

  return { elements, leds };
}

/**
 * Bind elements with specific LED support for rhythm apps (Lg, V, T pattern)
 * @param {Object} elementMap - Map of element keys to IDs
 * @returns {Object} Object with elements, leds, and LED state helpers
 */
export function bindRhythmElements(elementMap) {
  const { elements, leds } = bindElements(elementMap, {
    ledKeys: ['ledLg', 'ledV', 'ledT']
  });

  // Add LED state management helpers
  const ledHelpers = {
    setLedAuto: (param, isAuto) => {
      const led = leds[`led${param}`];
      if (led) {
        if (isAuto) {
          led.dataset.auto = 'true';
          led.classList.add('led-auto');
        } else {
          delete led.dataset.auto;
          led.classList.remove('led-auto');
        }
      }
    },

    setLedActive: (param, isActive) => {
      const led = leds[`led${param}`];
      if (led) {
        led.classList.toggle('led-active', isActive);
      }
    },

    isLedAuto: (param) => {
      const led = leds[`led${param}`];
      return led ? led.hasAttribute('data-auto') : false;
    }
  };

  return { elements, leds, ledHelpers };
}

/**
 * Quick element creation helper
 * @param {string} tag - HTML tag name
 * @param {Object} attrs - Attributes to set
 * @param {string|Element[]} content - Text content or child elements
 * @returns {Element} Created element
 */
export function createElement(tag, attrs = {}, content = '') {
  const element = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'className') {
      element.className = value;
    } else if (key === 'dataset') {
      Object.assign(element.dataset, value);
    } else {
      element.setAttribute(key, value);
    }
  }

  if (typeof content === 'string') {
    element.textContent = content;
  } else if (Array.isArray(content)) {
    content.forEach(child => {
      if (child instanceof Element) {
        element.appendChild(child);
      }
    });
  }

  return element;
}