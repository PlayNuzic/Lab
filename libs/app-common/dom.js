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
 * @param {boolean} options.silent - Don't warn about missing elements
 * @returns {Object} Object containing elements and leds
 */
export function bindElements(elementMap, options = {}) {
  const elements = {};
  const leds = {};

  for (const [key, id] of Object.entries(elementMap)) {
    const element = $(id);
    if (!element) {
      if (!options.silent) {
        console.warn(`Element with id "${id}" not found for key "${key}"`);
      }
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

/**
 * Create app-specific element maps to avoid binding non-existent elements
 * Each app has different UI elements available
 */

// Base elements present in all rhythm apps
const BASE_RHYTHM_ELEMENTS = {
  inputLg: 'inputLg',
  inputV: 'inputV',
  inputVUp: 'inputVUp',
  inputVDown: 'inputVDown',
  inputLgUp: 'inputLgUp',
  inputLgDown: 'inputLgDown',
  unitLg: 'unitLg',
  unitV: 'unitV',
  timelineWrapper: 'timelineWrapper',
  timeline: 'timeline',
  playBtn: 'playBtn',
  loopBtn: 'loopBtn',
  resetBtn: 'resetBtn',
  tapBtn: 'tapTempoBtn',
  tapHelp: 'tapHelp',
  circularTimelineToggle: 'circularTimelineToggle',
  randomBtn: 'randomBtn',
  randomMenu: 'randomMenu',
  themeSelect: 'themeSelect',
  selectColor: 'selectColor',
  baseSoundSelect: 'baseSoundSelect',
  accentSoundSelect: 'accentSoundSelect',
  startSoundSelect: 'startSoundSelect'
};

// Elements that vary by app
const APP_SPECIFIC_ELEMENTS = {
  app1: {
    // App1 has all elements including T and LEDs
    inputT: 'inputT',
    inputTUp: 'inputTUp',
    inputTDown: 'inputTDown',
    ledLg: 'ledLg',
    ledV: 'ledV',
    ledT: 'ledT',
    unitT: 'unitT',
    formula: 'formula',
    randLgToggle: 'randLgToggle',
    randLgMin: 'randLgMin',
    randLgMax: 'randLgMax',
    randVToggle: 'randVToggle',
    randVMin: 'randVMin',
    randVMax: 'randVMax',
    randTToggle: 'randTToggle',
    randTMin: 'randTMin',
    randTMax: 'randTMax'
  },
  app2: {
    // App2: No T input, LEDs, or formula (hideT: true, hideLeds: true)
    // Has pulse sequence UI
    pulseSeq: 'pulseSeq',
    randLgToggle: 'randLgToggle',
    randLgMin: 'randLgMin',
    randLgMax: 'randLgMax',
    randVToggle: 'randVToggle',
    randVMin: 'randVMin',
    randVMax: 'randVMax',
    randPulsesToggle: 'randPulsesToggle',
    randomCount: 'randomCount'
  },
  app3: {
    // App3: T is calculated internally, has LEDs and fraction controls
    inputT: 'inputT',
    ledLg: 'ledLg',
    ledV: 'ledV',
    ledT: 'ledT',
    unitT: 'unitT',
    formula: 'formula',
    mixerMenu: 'mixerMenu',
    // Random controls for fractions
    randLgToggle: 'randLgToggle',
    randLgMin: 'randLgMin',
    randLgMax: 'randLgMax',
    randVToggle: 'randVToggle',
    randVMin: 'randVMin',
    randVMax: 'randVMax',
    randNToggle: 'randNToggle',
    randNMin: 'randNMin',
    randNMax: 'randNMax',
    randDToggle: 'randDToggle',
    randDMin: 'randDMin',
    randDMax: 'randDMax',
    randComplexToggle: 'randComplexToggle',
    // Sound controls
    cycleSoundSelect: 'cycleSoundSelect',
    // Toggle buttons
    pulseToggleBtn: 'pulseToggleBtn',
    cycleToggleBtn: 'cycleToggleBtn'
  },
  app4: {
    // App4: Like App2 but with fraction editor (hideT: true)
    pulseSeq: 'pulseSeq',
    randLgToggle: 'randLgToggle',
    randLgMin: 'randLgMin',
    randLgMax: 'randLgMax',
    randVToggle: 'randVToggle',
    randVMin: 'randVMin',
    randVMax: 'randVMax',
    randPulsesToggle: 'randPulsesToggle',
    randomCount: 'randomCount',
    cycleSoundSelect: 'cycleSoundSelect',
    // Audio toggle elements
    pulseToggleBtn: 'pulseToggleBtn',
    selectedToggleBtn: 'selectedToggleBtn',
    cycleToggleBtn: 'cycleToggleBtn'
  }
};

/**
 * Create element map for specific app
 * @param {string} appId - App identifier ('app1', 'app2', 'app3', 'app4')
 * @returns {Object} Element map with app-specific elements
 */
export function createAppElementMap(appId) {
  const appElements = APP_SPECIFIC_ELEMENTS[appId] || {};
  return {
    ...BASE_RHYTHM_ELEMENTS,
    ...appElements
  };
}

/**
 * Bind elements using app-specific map (silently ignores missing elements)
 * @param {string} appId - App identifier
 * @param {Object} additionalElements - Additional elements specific to this instance
 * @returns {Object} Object with elements, leds, and LED state helpers
 */
export function bindAppRhythmElements(appId, additionalElements = {}) {
  const elementMap = {
    ...createAppElementMap(appId),
    ...additionalElements
  };

  const { elements, leds } = bindElements(elementMap, {
    ledKeys: ['ledLg', 'ledV', 'ledT'],
    silent: true // Don't warn about missing optional elements
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