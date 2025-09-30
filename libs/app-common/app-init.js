/**
 * App Initialization Helper for Lab rhythm apps
 * Centralizes common initialization patterns and resolves console warnings
 */

import { TimelineAudio, ensureAudio } from '../sound/index.js';
import { attachHover } from '../shared-ui/hover.js';
import { createSchedulingBridge, bindSharedSoundEvents } from './audio.js';
import { renderApp } from './template.js';
import { bindRhythmElements } from './dom.js';
import { createRhythmLEDManagers, syncLEDsWithInputs } from './led-manager.js';

/**
 * Initialize a rhythm app with standard configuration
 * @param {Object} config - App configuration
 * @param {string} config.title - App title
 * @param {Object} config.elementMap - Map of element keys to IDs
 * @param {Object} config.audioMapping - Audio sound mapping
 * @param {Object} config.templateConfig - Template rendering options
 * @returns {Object} Initialized app components
 */
export async function initRhythmApp({
  title,
  elementMap,
  audioMapping = {},
  templateConfig = {}
}) {
  // Render app template
  renderApp({ title, ...templateConfig });

  // Audio will be initialized lazily when needed (no immediate TimelineAudio creation)
  let audio;

  // Bind DOM elements with LED support
  const { elements, leds, ledHelpers } = bindRhythmElements(elementMap);

  // Create LED managers for rhythm parameters
  const ledManagers = createRhythmLEDManagers(leds);

  // Setup audio bridges
  const schedulingBridge = createSchedulingBridge({ getAudio: () => audio });
  bindSharedSoundEvents({
    getAudio: () => audio,
    mapping: {
      baseSound: 'setBase',
      accentSound: 'setAccent',
      startSound: 'setStart',
      ...audioMapping
    }
  });

  // Initialize shared UI components
  initSharedUIComponents(elements);

  return {
    // No audio instance returned - apps should use createRhythmAudioInitializer
    schedulingBridge,
    elements,
    leds,
    ledHelpers,
    ledManagers
  };
}

/**
 * Ensure AudioContext is ready without triggering warnings
 * @returns {Promise<void>}
 */
async function ensureAudioContextReady() {
  if (typeof Tone === 'undefined') {
    throw new Error('Tone.js not loaded');
  }

  // Don't access Tone.context.state at all - this triggers AudioContext warnings
  // Instead, just wait for user interaction before attempting to start
  return new Promise((resolve) => {
    const handleUserInteraction = async () => {
      try {
        await Tone.start();
        document.removeEventListener('click', handleUserInteraction);
        document.removeEventListener('keydown', handleUserInteraction);
        resolve();
      } catch (error) {
        // If Tone.start() fails, it's likely already started or permission denied
        // Either way, resolve to continue
        console.warn('Could not start audio context:', error);
        resolve();
      }
    };

    document.addEventListener('click', handleUserInteraction, { once: true });
    document.addEventListener('keydown', handleUserInteraction, { once: true });
  });
}

/**
 * Initialize shared UI components like hover effects
 * @param {Object} elements - Bound DOM elements
 * @remarks Sound dropdowns are initialized by header.js via initHeader()
 */
function initSharedUIComponents(elements) {
  // Sound dropdowns are initialized by header.js with proper configuration
  // (storageKey, eventType, getAudio, apply) - no need to duplicate here

  // Attach hover effects to interactive elements
  const hoverElements = [
    elements.playBtn,
    elements.loopBtn,
    elements.resetBtn,
    elements.randomBtn
  ].filter(Boolean);

  hoverElements.forEach(element => {
    if (element) {
      attachHover(element);
    }
  });
}

/**
 * Create element map for standard rhythm app UI
 * @param {Object} additionalElements - Additional elements specific to the app
 * @returns {Object} Complete element map
 */
export function createStandardElementMap(additionalElements = {}) {
  return {
    // Core rhythm parameters
    inputLg: 'inputLg',
    inputV: 'inputV',
    inputT: 'inputT',
    inputTUp: 'inputTUp',
    inputTDown: 'inputTDown',
    inputVUp: 'inputVUp',
    inputVDown: 'inputVDown',
    inputLgUp: 'inputLgUp',
    inputLgDown: 'inputLgDown',
    ledLg: 'ledLg',
    ledV: 'ledV',
    ledT: 'ledT',
    unitLg: 'unitLg',
    unitV: 'unitV',
    unitT: 'unitT',

    // Common UI elements
    formula: 'formula',
    timelineWrapper: 'timelineWrapper',
    timeline: 'timeline',
    playBtn: 'playBtn',
    loopBtn: 'loopBtn',
    resetBtn: 'resetBtn',
    tapBtn: 'tapTempoBtn',
    tapHelp: 'tapHelp',

    // Settings and controls
    themeSelect: 'themeSelect',
    baseSoundSelect: 'baseSoundSelect',
    startSoundSelect: 'startSoundSelect',
    randomBtn: 'randomBtn',
    randomMenu: 'randomMenu',

    // Random controls
    randLgToggle: 'randLgToggle',
    randLgMin: 'randLgMin',
    randLgMax: 'randLgMax',
    randVToggle: 'randVToggle',
    randVMin: 'randVMin',
    randVMax: 'randVMax',
    randTToggle: 'randTToggle',
    randTMin: 'randTMin',
    randTMax: 'randTMax',

    // Merge additional elements
    ...additionalElements
  };
}