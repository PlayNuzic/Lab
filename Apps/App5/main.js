import { createRhythmAudioInitializer } from '../../libs/app-common/audio-init.js';
import { attachHover } from '../../libs/shared-ui/hover.js';
import { computeHitSizePx, solidMenuBackground, computeNumberFontRem } from './utils.js';
import { initRandomMenu, mergeRandomConfig } from '../../libs/app-common/random-menu.js';
import { applyBaseRandomConfig, updateBaseRandomConfig } from '../../libs/app-common/random-config.js';
import { createSchedulingBridge, bindSharedSoundEvents } from '../../libs/app-common/audio.js';
import { toRange } from '../../libs/app-common/range.js';
import { fromLgAndTempo, toPlaybackPulseCount } from '../../libs/app-common/subdivision.js';
import { initMixerMenu } from '../../libs/app-common/mixer-menu.js';
import createPulseSeqIntervalsController from '../../libs/app-common/pulse-seq-intervals.js';
import { bindAppRhythmElements } from '../../libs/app-common/dom.js';
import { createRhythmLEDManagers, syncLEDsWithInputs } from '../../libs/app-common/led-manager.js';
import { createPulseMemoryLoopController } from '../../libs/app-common/loop-control.js';
import { NOTATION_TOGGLE_BTN_ID } from '../../libs/app-common/template.js';
import { createNotationPanelController } from '../../libs/app-common/notation-panel.js';
import { createRhythmStaff } from '../../libs/notation/rhythm-staff.js';
import { parseNum, formatNumber, createNumberFormatter } from '../../libs/app-common/number-utils.js';
import { createSimpleVisualSync } from '../../libs/app-common/simple-visual-sync.js';
import { createIntervalHighlightController } from '../../libs/app-common/highlight-interval.js';
import { createTIndicator } from '../../libs/app-common/t-indicator.js';
import { createTimelineRenderer } from '../../libs/app-common/timeline-layout.js';
import { createInfoTooltip } from '../../libs/app-common/info-tooltip.js';
import { createIntervalRenderer } from '../../libs/temporal-intervals/index.js';
// Using local header controls for App5 (no shared init)

// Create custom formatters for App2
const formatInteger = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '';
  return Math.round(numeric).toLocaleString('ca-ES');
};

const formatBpmValue = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '';
  const rounded = Math.round(numeric * 10) / 10;
  return rounded.toLocaleString('ca-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1
  });
};

let audio;
let pendingMute = null;
const schedulingBridge = createSchedulingBridge({ getAudio: () => audio });
window.addEventListener('sharedui:scheduling', schedulingBridge.handleSchedulingEvent);
// Bind all DOM elements using app-specific utilities (no warnings for missing elements)
// App5 adds startIntervalToggle for interval 1 sound control
const { elements, leds, ledHelpers } = bindAppRhythmElements('app2', {
  startIntervalToggle: 'startIntervalToggle'
});

// Create LED managers for Lg, V, T parameters
const ledManagers = createRhythmLEDManagers(leds);

// State object for shared loop controller
const appState = {
  get loopEnabled() { return loopEnabled; },
  set loopEnabled(v) { loopEnabled = v; }
};

// Create shared loop controller with pulse memory integration
const loopController = createPulseMemoryLoopController({
  audio: { setLoop: (enabled) => audio?.setLoop?.(enabled) },
  loopBtn: elements.loopBtn,
  state: appState,
  ensureIntervalMemory,
  getLg: () => parseInt(inputLg.value),
  isPlaying: () => isPlaying,
  onToggle: (enabled) => {
    // Rebuild visible selection from memory and refresh labels
    syncSelectedFromMemory();
    updateNumbers();
    if (isPlaying && typeof audio?.setSelected === 'function') {
      audio.setSelected(selectedForAudioFromState());
    }
    animateTimelineCircle(enabled && circularTimeline);
    // Update totalPulses when loop changes during playback
    if (isPlaying) {
      handleInput();
    }
  }
});

// Extract commonly used elements for backward compatibility
const { inputLg, inputV, inputT, inputVUp, inputVDown, inputLgUp, inputLgDown,
        ledLg, ledV, ledT, unitLg, unitV, unitT, formula, timelineWrapper,
        timeline, playBtn, loopBtn, resetBtn, tapBtn, tapHelp,
        circularTimelineToggle, randomBtn, randomMenu, randLgToggle, randLgMin,
        randLgMax, randVToggle, randVMin, randVMax, randPulsesToggle, randomCount,
        randTToggle, randTMin, randTMax, themeSelect, selectColor, baseSoundSelect,
        accentSoundSelect, startSoundSelect, startIntervalToggle, notationPanel,
        notationCloseBtn, notationContent } = elements;

// Custom sound event handling for App5 to respect interval 1 checkbox
window.addEventListener('sharedui:sound', async (event) => {
  const detail = event?.detail || {};
  const { type, value } = detail;
  if (!audio || value == null) return;

  try {
    if (type === 'baseSound' && typeof audio.setBase === 'function') {
      await audio.setBase(value);
      // If interval 1 checkbox is unchecked, also update pulso0 to match base
      if (startIntervalToggle && !startIntervalToggle.checked) {
        await audio._setSound('pulso0', value, audio._defaultAssignments.pulso0);
      }
    } else if (type === 'accentSound' && typeof audio.setAccent === 'function') {
      await audio.setAccent(value);
    } else if (type === 'startSound' && typeof audio.setStart === 'function') {
      // Only apply startSound to pulso0 if checkbox is checked
      if (startIntervalToggle && startIntervalToggle.checked) {
        await audio.setStart(value);
      }
    }
  } catch (err) {
    // Silently ignore errors
  }
});

const notationContentEl = notationContent || null;
let notationRenderer = null;
let notationPanelController = null;

function buildNotationRenderState() {
  const lgValue = parseInt(inputLg.value, 10);
  if (!Number.isFinite(lgValue) || lgValue <= 0) {
    return null;
  }

  ensureIntervalMemory(lgValue);

  // Build rhythm events for ALL steps (0 to Lg inclusive = Lg+1 steps)
  // En App5: step 0 = intervalo 1, step 1 = intervalo 2, etc.
  // Cada step es un quarter note, selected si el intervalo correspondiente está activo
  const rhythm = [];
  const selectedIndices = [];
  const positions = [];

  // Renderizar Lg steps (0 to Lg-1) que corresponden a los Lg intervalos (1 to Lg)
  for (let step = 0; step < lgValue; step++) {
    const intervalNumber = step + 1; // step 0 → intervalo 1
    const isSelected = intervalMemory[intervalNumber]; // Leer de intervalMemory (1-indexed)

    rhythm.push({
      pulseIndex: step,
      duration: 'q', // quarter note
      rest: !isSelected // rest if NOT selected
    });
    positions.push(step);
    if (isSelected) {
      selectedIndices.push(step);
    }
  }

  return {
    lg: lgValue,
    rhythm,
    positions,
    selectedIndices
  };
}

function renderNotationIfVisible({ force = false } = {}) {
  if (!notationContentEl) return;
  if (!notationPanelController) return;
  if (!force && !notationPanelController.isOpen) return;

  if (!notationRenderer) {
    notationRenderer = createRhythmStaff({
      container: notationContentEl,
      pulseFilter: 'whole'
    });
  }

  const state = buildNotationRenderState();
  if (!state) {
    notationRenderer.render({ lg: 0, rhythm: [] });
    return;
  }

  notationRenderer.render({
    lg: state.lg,
    selectedIndices: state.selectedIndices,
    positions: state.positions,
    rhythm: state.rhythm
  });
}

function handleNotationClick(event) {
  if (!notationPanelController || !notationPanelController.isOpen) return;
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;
  const noteEl = target.closest('[data-pulse-index]');
  if (!noteEl) return;
  if (noteEl.dataset.nonSelectable === 'true') return;

  const step = Number.parseFloat(noteEl.dataset.pulseIndex);
  if (!Number.isFinite(step)) return;

  const lgValue = parseInt(inputLg.value, 10);
  if (!Number.isFinite(lgValue) || lgValue <= 0) return;

  // Convertir step (0-indexed) a intervalNumber (1-indexed)
  const intervalNumber = step + 1;

  // Validar que el intervalo esté en rango [1, Lg]
  if (intervalNumber < 1 || intervalNumber > lgValue) return;

  ensureIntervalMemory(lgValue);
  const shouldSelect = !intervalMemory[intervalNumber];

  // Toggle interval selection
  intervalMemory[intervalNumber] = shouldSelect;
  if (shouldSelect) {
    selectedIntervals.add(intervalNumber);
  } else {
    selectedIntervals.delete(intervalNumber);
  }

  // Update displays
  intervalRenderer.updateSelection();
  updatePulseSeqField();
  renderNotationIfVisible();

  // Update audio if playing
  if (isPlaying && audio && typeof audio.setSelected === 'function') {
    audio.setSelected(selectedForAudioFromState());
  }
}

if (notationContentEl) {
  notationContentEl.addEventListener('click', handleNotationClick);
}

// Pulse sequence UI element (contenteditable div in template)
const pulseSeqEl = elements.pulseSeq;
const pulseSeqController = createPulseSeqIntervalsController();
const intervalMemoryApi = pulseSeqController.memory;
let intervalMemory = intervalMemoryApi.data;
const { editEl: pulseSeqEditEl } = pulseSeqController.mount({ root: pulseSeqEl });
function getEditEl() {
  return pulseSeqController.getEditElement();
}
function getPulseSeqText() {
  return pulseSeqController.getText();
}
function setPulseSeqText(str) {
  pulseSeqController.setText(str);
}
function setPulseSeqSelection(start, end) {
  pulseSeqController.setSelectionRange(start, end);
}
function moveCaretToNearestMidpoint() {
  pulseSeqController.moveCaretToNearestMidpoint();
}
function moveCaretStep(dir) {
  pulseSeqController.moveCaretStep(dir);
}
// T indicator setup (App2-specific functionality)
const shouldRenderTIndicator = Boolean(inputT);
const tIndicatorController = shouldRenderTIndicator ? createTIndicator() : null;
const tIndicator = tIndicatorController ? (() => {
  const el = tIndicatorController.element;
  el.id = 'tIndicator';
  el.style.visibility = 'hidden';
  timeline.appendChild(el);
  return el;
})() : null;

const titleHeading = document.querySelector('header.top-bar h1');
const titleTextNode = titleHeading?.querySelector('.top-bar-title-text');
let titleButton = null;
if (titleHeading && titleTextNode) {
  titleButton = document.createElement('button');
  titleButton.type = 'button';
  titleButton.id = 'appTitleBtn';
  titleButton.className = 'top-bar-title-button';
  titleButton.textContent = titleTextNode.textContent?.trim() || '';
  titleHeading.replaceChild(titleButton, titleTextNode);
} else if (titleHeading) {
  titleButton = document.createElement('button');
  titleButton.type = 'button';
  titleButton.id = 'appTitleBtn';
  titleButton.className = 'top-bar-title-button';
  titleButton.textContent = titleHeading.textContent || '';
  titleHeading.textContent = '';
  titleHeading.appendChild(titleButton);
}
const notationToggleBtn = document.getElementById(NOTATION_TOGGLE_BTN_ID);
notationPanelController = createNotationPanelController({
  toggleButton: notationToggleBtn,
  panel: notationPanel,
  closeButton: notationCloseBtn,
  appId: 'app2',
  onOpen: () => renderNotationIfVisible({ force: true })
});

const randomDefaults = {
  Lg: { enabled: true, range: [2, 30] },
  V: { enabled: true, range: [40, 320] },
  T: { enabled: true, range: [0.1, 20] },
  Pulses: { enabled: true, count: '' }
};

const RANDOM_STORE_KEY = 'random';

function loadRandomConfig() {
  try {
    const raw = loadOpt(RANDOM_STORE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveRandomConfig(cfg) {
  try { saveOpt(RANDOM_STORE_KEY, JSON.stringify(cfg)); } catch {}
}

const randomConfig = mergeRandomConfig(randomDefaults, loadRandomConfig());

/**
 * Apply stored random configuration values to the associated DOM controls.
 * @param {Record<string, any>} cfg
 */
function applyRandomConfig(cfg) {
  applyBaseRandomConfig(cfg, {
    Lg: { toggle: randLgToggle, min: randLgMin, max: randLgMax },
    V: { toggle: randVToggle, min: randVMin, max: randVMax },
    T: { toggle: randTToggle, min: randTMin, max: randTMax }
  });
  // Handle Pulses config (app-specific)
  if (randPulsesToggle && randomCount && cfg.Pulses) {
    randPulsesToggle.checked = cfg.Pulses.enabled;
    randomCount.value = cfg.Pulses.count ?? '';
  }
}

/**
 * Persist the current random menu configuration back to storage.
 */
function updateRandomConfig() {
  updateBaseRandomConfig(randomConfig, {
    Lg: { toggle: randLgToggle, min: randLgMin, max: randLgMax, integer: true, minValue: 1 },
    V: { toggle: randVToggle, min: randVMin, max: randVMax },
    T: { toggle: randTToggle, min: randTMin, max: randTMax }
  }, randomDefaults);

  // Handle Pulses config (app-specific)
  if (randPulsesToggle && randomCount) {
    randomConfig.Pulses = {
      enabled: randPulsesToggle.checked,
      count: randomCount.value
    };
  }
  saveRandomConfig(randomConfig);
}

applyRandomConfig(randomConfig);

[
  randLgToggle, randLgMin, randLgMax,
  randVToggle, randVMin, randVMax,
  randTToggle, randTMin, randTMax,
  randPulsesToggle, randomCount
].forEach(el => el?.addEventListener('change', updateRandomConfig));

// No actualitza la memòria a cada tecleig: es confirma amb Enter o blur
// pulseSeqEl?.addEventListener('input', handlePulseSeqInput);

let pulses = [];
// pulseHits removed - no longer needed (pulses are non-interactive)
// --- Selection memory across Lg changes ---
let pulseSeqRanges = {};

// Track which pulse numbers are visible (for persistence across layout changes)
const visiblePulseNumbers = new Set();

function ensureIntervalMemory(size) {
  intervalMemoryApi.ensure(size);
}

// Clear all persistent interval selection (memory beyond current Lg too)
function clearPersistentIntervals(){
  intervalMemoryApi.clear();
  try { selectedIntervals.clear(); } catch {}
  /* Keep UI consistent; will be rebuilt by subsequent calls */
  updatePulseSeqField();
}
// UI thresholds for number rendering
const NUMBER_HIDE_THRESHOLD = 100;   // from this Lg and above, hide numbers
const NUMBER_CIRCLE_OFFSET  = 34;    // px distance from circle to number label

// --- Selección para audio (App5: de 1 a Lg inclusive) ---
// IMPORTANTE: Los intervalos son 1-indexed (intervalo 1, 2, 3...)
// pero el audio usa step indices 0-indexed (step 0, 1, 2...)
// Intervalo 1 = paso entre pulso 0→1 = toca en step 0
function selectedForAudioFromState() {
  const lg = parseInt(inputLg.value);
  const set = new Set();
  if (!isNaN(lg) && lg > 0) {
    for (let i = 1; i <= lg && i < intervalMemory.length; i++) {
      if (intervalMemory[i]) {
        set.add(i - 1); // Convertir intervalo (1-indexed) a step index (0-indexed)
      }
    }
  }
  return set;
}
const selectedIntervals = new Set();
let isPlaying = false;
let loopEnabled = false;
let isUpdating = false;     // evita bucles de 'input' reentrants
let circularTimeline = false;
const T_INDICATOR_TRANSITION_DELAY = 650;
let tIndicatorRevealHandle = null;
// visualSyncHandle and lastVisualStep now managed by visualSync controller
// Progress is now driven directly from audio callbacks

// Create interval highlight controller (highlights intervals, not pulses)
const highlightController = createIntervalHighlightController({
  getIntervalBlocks: () => Array.from(document.querySelectorAll('.interval-block')),
  getLoopEnabled: () => loopEnabled,
  flashDuration: 200
});

// Create interval renderer for temporal intervals visualization
// Note: Click/drag selection handled entirely by dragController below (no separate click handler needed)
const intervalRenderer = createIntervalRenderer({
  timeline,
  getLg: () => parseInt(inputLg.value),
  isCircular: () => loopEnabled && circularTimeline,
  getSelectedIntervals: () => selectedIntervals,
  onIntervalClick: null // dragController handles both clicks and drags
});

// Create visual sync controller
const visualSync = createSimpleVisualSync({
  getAudio: () => audio,
  getIsPlaying: () => isPlaying,
  onStep: (step) => {
    // Highlight interval (step 0 → interval 1, step 1 → interval 2, etc.)
    const intervalNumber = step + 1;
    highlightController.highlightInterval(intervalNumber);

    // Handle pulse scrolling (still based on step index for pulse positions)
    handlePulseScroll(step);

    // Update notation cursor
    if (notationRenderer && typeof notationRenderer.updateCursor === 'function') {
      const index = step % pulses.length;
      notationRenderer.updateCursor(index, isPlaying);
    }
  }
});

function updateTIndicatorText(value) {
  if (!tIndicatorController) return;
  tIndicatorController.updateText(value);
}

function updateTIndicatorPosition() {
  if (!timeline || !tIndicator) return false;
  const lg = parseInt(inputLg.value);
  if (isNaN(lg) || lg <= 0) { return false; }

  // Find the Lg label element and anchor 15px below it
  let anchor = timeline.querySelector(`.pulse-number[data-index="${lg}"]`);
  if (!anchor) anchor = timeline.querySelector('.pulse.lg');
  const tlRect = timeline.getBoundingClientRect();
  const circular = timeline.classList.contains('circular');

  if (!anchor) { return false; }

  const aRect = anchor.getBoundingClientRect();
  const isLabel = anchor.classList.contains('pulse-number');
  const offsetX = circular && isLabel ? -16 : 0; // compensate label shift in circle
  const centerX = aRect.left + aRect.width / 2 - tlRect.left + offsetX;
  const topY = aRect.bottom - tlRect.top + 15; // 15px separation below

  tIndicator.style.left = `${centerX}px`;
  tIndicator.style.top = `${topY}px`;
  tIndicator.style.transform = 'translate(-50%, 0)';

  if (tIndicator.parentNode !== timeline) timeline.appendChild(tIndicator);
  return true;
}
function scheduleTIndicatorReveal(delay = 0) {
  if (!tIndicator) return;
  if (tIndicatorRevealHandle) {
    clearTimeout(tIndicatorRevealHandle);
    tIndicatorRevealHandle = null;
  }

  const ms = Math.max(0, Number(delay) || 0);
  if (ms === 0) {
    requestAnimationFrame(() => {
      const anchored = updateTIndicatorPosition();
      tIndicator.style.visibility = anchored && tIndicator.textContent ? 'visible' : 'hidden';
    });
    return;
  }

  tIndicator.style.visibility = 'hidden';
  tIndicatorRevealHandle = setTimeout(() => {
    tIndicatorRevealHandle = null;
    requestAnimationFrame(() => {
      const anchored = updateTIndicatorPosition();
      tIndicator.style.visibility = anchored && tIndicator.textContent ? 'visible' : 'hidden';
    });
  }, ms);
}
const dragController = pulseSeqController.drag;
// Drag controller for INTERVAL selection - Phase 4
dragController.attach({
  timeline,

  // Resolve which interval was targeted
  resolveTarget: ({ target }) => {
    if (!target) return null;
    const block = target.closest('.interval-block');
    if (!block) return null;

    const number = parseInt(block.dataset.intervalNumber);
    if (!Number.isFinite(number)) return null;

    return {
      key: String(number),     // Unique identifier for drag controller
      intervalNumber: number   // Interval number (1 to Lg)
    };
  },

  // Apply selection/deselection during drag
  applySelection: (info, shouldSelect) => {
    if (!info || !Number.isFinite(info.intervalNumber)) return;

    const lg = parseInt(inputLg.value);
    ensureIntervalMemory(lg);

    intervalMemory[info.intervalNumber] = shouldSelect;

    if (shouldSelect) {
      selectedIntervals.add(info.intervalNumber);
    } else {
      selectedIntervals.delete(info.intervalNumber);
    }

    intervalRenderer.updateSelection();
  },

  // Check if interval is currently selected
  isSelectionActive: (info) => {
    if (!info || !Number.isFinite(info.intervalNumber)) return false;
    return intervalMemory[info.intervalNumber] === true;
  },

  // Drag end callback - update displays
  onDragEnd: () => {
    updatePulseSeqField();
    renderNotationIfVisible(); // Sync notation with interval selection

    if (isPlaying && audio && typeof audio.setSelected === 'function') {
      audio.setSelected(selectedForAudioFromState());
    }
  }
});

// Connect drag enter handler to interval renderer
intervalRenderer.setDragEnterHandler((intervalNumber) => {
  dragController.handleEnter({
    key: String(intervalNumber),
    intervalNumber: intervalNumber
  });
});

// Create timeline renderer for circular/linear layout
const timelineRenderer = createTimelineRenderer({
  timeline,
  timelineWrapper,
  getLg: () => pulses.length - 1,
  getPulses: () => pulses,
  getBars: () => Array.from(timeline.querySelectorAll('.bar')),
  computeNumberFontRem,
  pulseNumberHideThreshold: NUMBER_HIDE_THRESHOLD,
  numberCircleOffset: NUMBER_CIRCLE_OFFSET,
  isCircularEnabled: () => loopEnabled && circularTimeline,
  scheduleIndicatorReveal: scheduleTIndicatorReveal,
  tIndicatorTransitionDelay: T_INDICATOR_TRANSITION_DELAY,
  callbacks: {
    onAfterCircularLayout: (ctx) => {
      // pulseHits positioning removed - pulses are non-interactive
      // Phase 4 will add interval positioning here
      syncSelectedFromMemory();
      updateNumbers();
    },
    onAfterLinearLayout: (ctx) => {
      // pulseHits positioning removed - pulses are non-interactive
      // Phase 4 will add interval positioning here
      syncSelectedFromMemory();
      updateNumbers();
    }
  }
});

// Hovers for LEDs and controls
// LEDs ahora indican los campos editables; el apagado se recalcula
attachHover(ledLg, { text: 'Entrada manual de "Lg"' });
attachHover(ledV, { text: 'Entrada manual de "V"' });
attachHover(ledT, { text: 'Valor calculado de "T"' });
attachHover(playBtn, { text: 'Play / Stop' });
attachHover(loopBtn, { text: 'Loop' });
attachHover(tapBtn, { text: 'Tap Tempo' });
attachHover(resetBtn, { text: 'Reset App' });
attachHover(notationToggleBtn, { text: 'Mostrar/ocultar partitura' });
attachHover(randomBtn, { text: 'Aleatorizar parámetros' });
attachHover(randLgToggle, { text: 'Aleatorizar Lg' });
attachHover(randLgMin, { text: 'Mínimo Lg' });
attachHover(randLgMax, { text: 'Máximo Lg' });
attachHover(randVToggle, { text: 'Aleatorizar V' });
attachHover(randVMin, { text: 'Mínimo V' });
attachHover(randVMax, { text: 'Máximo V' });
attachHover(randTToggle, { text: 'Aleatorizar T' });
attachHover(randTMin, { text: 'Mínimo T' });
attachHover(randTMax, { text: 'Máximo T' });
attachHover(randPulsesToggle, { text: 'Aleatorizar pulsos' });
attachHover(randomCount, { text: 'Cantidad de pulsos a seleccionar (vacío = aleatorio, 0 = ninguno)' });


const storeKey = (k) => `app2:${k}`;
const saveOpt = (k, v) => { try { localStorage.setItem(storeKey(k), v); } catch {} };
const loadOpt = (k) => { try { return localStorage.getItem(storeKey(k)); } catch { return null; } };

function clearStoredPreferences() {
  try {
    const prefix = 'app2:';
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) keysToRemove.push(key);
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));

    // Also clear shared sound preferences (no app prefix)
    ['baseSound', 'accentSound', 'startSound', 'cycleSound'].forEach(key => {
      try { localStorage.removeItem(key); } catch {}
    });
  } catch {}
}

let factoryResetPending = false;
window.addEventListener('sharedui:factoryreset', () => {
  if (factoryResetPending) return;
  factoryResetPending = true;
  clearStoredPreferences();
  window.location.reload();
});

// Local header behavior (as before)
function applyTheme(val){
  if(val === 'system'){
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.body.dataset.theme = dark ? 'dark' : 'light';
  } else {
    document.body.dataset.theme = val;
  }
  saveOpt('theme', val);
  // Notify shared listeners so dependent UI can refresh colors on the fly
  try { window.dispatchEvent(new CustomEvent('sharedui:theme', { detail: { value: document.body.dataset.theme, raw: val } })); } catch {}
}

const storedTheme = loadOpt('theme');
if (themeSelect) {
  if (storedTheme) themeSelect.value = storedTheme;
  applyTheme(themeSelect.value || 'system');
  themeSelect.addEventListener('change', e => applyTheme(e.target.value));
} else {
  applyTheme(storedTheme || 'system');
}

document.addEventListener('sharedui:mute', (e) => {
  const val = !!(e && e.detail && e.detail.value);
  saveOpt('mute', val ? '1' : '0');
  pendingMute = val;
  if (audio && typeof audio.setMute === 'function') {
    audio.setMute(val);
  }
});

// Restore previous mute preference on load
(() => {
  try{
    const saved = loadOpt('mute');
    if (saved === '1') document.getElementById('muteBtn')?.click();
  }catch{}
})();

const storedColor = loadOpt('color');
if (storedColor) {
  selectColor.value = storedColor;
  document.documentElement.style.setProperty('--selection-color', storedColor);
}
selectColor.addEventListener('input', e => {
  document.documentElement.style.setProperty('--selection-color', e.target.value);
  saveOpt('color', e.target.value);
});

updateNumbers();

circularTimelineToggle.checked = (() => {
  const stored = loadOpt('circular');
  return stored == null ? true : stored === '1';
})();
circularTimeline = circularTimelineToggle.checked;
updateTIndicatorPosition();
updateTIndicatorText(parseNum(inputT?.value ?? '') || '');
scheduleTIndicatorReveal(350);

circularTimelineToggle?.addEventListener('change', e => {
  circularTimeline = e.target.checked;
  saveOpt('circular', e.target.checked ? '1' : '0');
  animateTimelineCircle(loopEnabled && circularTimeline);
});
// Keep T indicator anchored on window resizes
window.addEventListener('resize', updateTIndicatorPosition);
animateTimelineCircle(loopEnabled && circularTimeline);

// Initialize loop controller with shared component
loopController.attach();

resetBtn.addEventListener('click', () => {
  intervalMemory = [];
  sessionStorage.setItem('volumeResetFlag', 'true');
  window.location.reload();
});

async function handleTapTempo() {
  try {
    const audioInstance = await initAudio();
    const result = audioInstance.tapTempo(performance.now());
    if (!result) return;

    if (result.remaining > 0) {
      tapHelp.textContent = result.remaining === 2 ? '2 clicks más' : '1 click más solamente';
      tapHelp.style.display = 'block';
      return;
    }

    tapHelp.style.display = 'none';
    if (Number.isFinite(result.bpm) && result.bpm > 0) {
      const bpm = Math.round(result.bpm * 100) / 100;
      setValue(inputV, bpm);
      handleInput({ target: inputV });
    }
  } catch (error) {
    console.warn('Tap tempo failed', error);
  }
}

if (tapBtn) {
  tapBtn.addEventListener('click', () => { handleTapTempo(); });
}

if (tapHelp) {
  tapHelp.textContent = 'Se necesitan 3 clicks';
  tapHelp.style.display = 'none';
}

// --- Aleatorización de parámetros y pulsos ---
function randomInt(min, max) {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi < lo) return lo;
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

/**
 * Apply random values within the configured ranges and update inputs accordingly.
 */
function randomize() {
  if (randLgToggle?.checked) {
    const [lo, hi] = toRange(randLgMin?.value, randLgMax?.value, randomDefaults.Lg.range);
    const v = randomInt(lo, hi);
    setValue(inputLg, v);
    handleInput({ target: inputLg });
  }
  if (randVToggle?.checked) {
    const [lo, hi] = toRange(randVMin?.value, randVMax?.value, randomDefaults.V.range);
    const v = randomInt(lo, hi);
    setValue(inputV, v);
    handleInput({ target: inputV });
  }
  if (randPulsesToggle?.checked) {
    // Reset persistent selection memory so old intervals don't reappear when Lg grows
    clearPersistentIntervals();
    const lg = parseInt(inputLg.value);
    if (!isNaN(lg) && lg > 0) {
      ensureIntervalMemory(lg);
      const rawCount = typeof randomCount.value === 'string' ? randomCount.value.trim() : '';
      const available = [];
      for (let i = 1; i <= lg; i++) available.push(i);
      const selected = new Set();
      if (rawCount === '') {
        const density = 0.5;
        available.forEach(i => { if (Math.random() < density) selected.add(i); });
      } else {
        const parsed = Number.parseInt(rawCount, 10);
        if (Number.isNaN(parsed)) {
          const density = 0.5;
          available.forEach(i => { if (Math.random() < density) selected.add(i); });
        } else if (parsed > 0) {
          const target = Math.min(parsed, available.length);
          while (selected.size < target) {
            const idx = available[Math.floor(Math.random() * available.length)];
            selected.add(idx);
          }
        }
        // For parsed <= 0, keep selection empty (0 intervals)
      }
      const seq = Array.from(selected).sort((a, b) => a - b);
      for (let i = 1; i <= lg; i++) intervalMemory[i] = false;
      seq.forEach(i => { intervalMemory[i] = true; });
      syncSelectedFromMemory();
      updateNumbers();
      if (isPlaying && audio && typeof audio.setSelected === 'function') {
        audio.setSelected(selectedForAudioFromState());
      }
    }
  }
}

initRandomMenu(randomBtn, randomMenu, randomize);

// Sound dropdowns initialized by header.js via initHeader()
// No need to initialize here - header.js handles baseSoundSelect, accentSoundSelect, and startSoundSelect

// Preview on sound change handled by shared header

// Create standardized audio initializer that avoids AudioContext warnings
const _baseInitAudio = createRhythmAudioInitializer({
  getSoundSelects: () => ({
    baseSoundSelect: elements.baseSoundSelect,
    accentSoundSelect: elements.accentSoundSelect,
    startSoundSelect: elements.startSoundSelect
  }),
  schedulingBridge
});

async function initAudio() {
  if (!audio) {
    audio = await _baseInitAudio();
    if (pendingMute != null && typeof audio.setMute === 'function') {
      audio.setMute(pendingMute);
    }
    // Expose audio instance for sound dropdown preview
    if (typeof window !== 'undefined') window.__labAudio = audio;
  }
  return audio;
}

if (typeof window !== 'undefined') {
  window.__labInitAudio = initAudio;
}

// Mostrar unitats quan s'edita cada paràmetre
function bindUnit(input, unit){
  if(!input || !unit) return;
  input.addEventListener('focus', () => { unit.style.display = 'block'; });
  input.addEventListener('blur', () => { unit.style.display = 'none'; });
}

if (inputT) {
  inputT.readOnly = true;
  inputT.dataset.auto = '1';
}

bindUnit(inputLg, unitLg);
bindUnit(inputV, unitV);
bindUnit(inputT, unitT);

[inputLg, inputV].forEach(el => el.addEventListener('input', handleInput));
handleInput();

// Intervalo 1 checkbox: Enable/disable separate sound for interval 1 (step 0)
if (startIntervalToggle) {
  startIntervalToggle.addEventListener('change', async () => {
    const enabled = startIntervalToggle.checked;

    // Update startSoundSelect row visibility
    const startRow = startSoundSelect?.closest('.interval-select-row');
    if (startRow) {
      startRow.classList.toggle('enabled', enabled);
    }

    // Update audio if initialized
    if (audio) {
      if (enabled) {
        // When enabled: pulso0 uses startSound
        const startSound = startSoundSelect?.dataset?.value;
        if (startSound) {
          await audio.setStart(startSound);
        }
      } else {
        // When disabled: pulso0 uses same sound as pulso (base)
        const baseSound = baseSoundSelect?.dataset?.value;
        if (baseSound) {
          // Set pulso0 to match pulso
          await audio._setSound('pulso0', baseSound, audio._defaultAssignments.pulso0);
        }
      }
    }
  });

  // Initialize row visibility based on checkbox state
  const startRow = startSoundSelect?.closest('.interval-select-row');
  if (startRow) {
    startRow.classList.toggle('enabled', startIntervalToggle.checked);
  }
}

// Helper function to find midpoints (double spaces) in pulse sequence text
function getMidpoints(text) {
  const a = [];
  for (let i = 1; i < text.length; i++) {
    if (text[i - 1] === ' ' && text[i] === ' ') {
      a.push(i);
    }
  }
  return a;
}

getEditEl()?.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const res = await handlePulseSeqInput({ causedBy: 'enter' });
    // Oculta el caret al confirmar excepto si hubo números > Lg
    if (!res || !res.hadTooBig) {
      try { getEditEl()?.blur(); } catch {}
    }
    return;
  }
  if (e.key === 'ArrowLeft' || e.key === 'Home') { e.preventDefault(); moveCaretStep(-1); return; }
  if (e.key === 'ArrowRight' || e.key === 'End') { e.preventDefault(); moveCaretStep(1); return; }
  // Allow only digits, navegación y espacio (para introducir varios pulsos)
  const allowed = new Set(['Backspace','Delete','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','Tab',' ']);
  if (!/^[0-9]$/.test(e.key) && !allowed.has(e.key)) {
    e.preventDefault();
    return;
  }
  if (e.key === 'Backspace') {
    // Borrar con una pulsación el número a la izquierda + un espacio
    e.preventDefault();
    const el = getEditEl(); if(!el) return; const node = el.firstChild || el; let text = node.textContent || '';
    const sel = window.getSelection && window.getSelection(); if(!sel||sel.rangeCount===0) return; const rng = sel.getRangeAt(0); if(!el.contains(rng.startContainer)) return;
    let pos = rng.startOffset; if(pos<=0 || text.length===0) return;
    // Si no estamos en midpoint, ajusta al más cercano (sin modificar texto)
    const mids = getMidpoints(text); if(mids.length){ let best=mids[0],d=Math.abs(pos-best); for(const m of mids){const dd=Math.abs(pos-m); if(dd<d){best=m; d=dd;}} pos=best; }
    // Buscamos el token a la izquierda del midpoint
    let i = pos-1; while(i>=0 && text[i]===' ') i--; if(i<0) return; // no hay número a la izquierda
    if(!(text[i]>='0' && text[i]<='9')) return;
    const endNum = i+1; let j=i; while(j>=0 && text[j]>='0' && text[j]<='9') j--; const startNum = j+1;
    // Construimos: izquierda hasta startNum + '  ' + derecha saltando el espacio derecho del midpoint
    const left = text.slice(0,startNum);
    const right = text.slice(pos+1); // saltar un espacio (el derecho del midpoint)
    const out = (left + '  ' + right);
    node.textContent = out;
    // Colocamos caret en el nuevo midpoint
    const caret = left.length + 1; // centro de '  '
    setPulseSeqSelection(caret, caret);
    return;
  }
  if (e.key === 'Delete') {
    // Borrar con una pulsación el número a la derecha + un espacio
    e.preventDefault();
    const el = getEditEl(); if(!el) return; const node = el.firstChild || el; let text = node.textContent || '';
    const sel = window.getSelection && window.getSelection(); if(!sel||sel.rangeCount===0) return; const rng = sel.getRangeAt(0); if(!el.contains(rng.startContainer)) return;
    let pos = rng.startOffset; if(pos>=text.length) return;
    // Ajusta al midpoint más cercano (sin cambiar texto)
    const mids = getMidpoints(text); if(mids.length){ let best=mids[0],d=Math.abs(pos-best); for(const m of mids){const dd=Math.abs(pos-m); if(dd<d){best=m; d=dd;}} pos=best; }
    // Buscar número a la derecha del midpoint
    let k = pos; while(k<text.length && text[k]===' ') k++;
    const isD=(c)=> c>='0'&&c<='9';
    if(k>=text.length || !isD(text[k])) return;
    let end=k; while(end<text.length && isD(text[end])) end++;
    // Espacios tras el número: saltar hasta 2 para no duplicar separadores
    let s=0; while(end+s<text.length && text[end+s]===' ') s++;
    const left = text.slice(0, pos-1); // elimina el espacio izquierdo del midpoint
    const right = text.slice(end + Math.min(s,2));
    node.textContent = left + '  ' + right;
    const caret = left.length + 1; setPulseSeqSelection(caret, caret);
    return;
  }
});
getEditEl()?.addEventListener('blur', () => handlePulseSeqInput({ causedBy: 'blur' }));
// Visual gap hint under caret (does not modify text)
getEditEl()?.addEventListener('mouseup', ()=> setTimeout(moveCaretToNearestMidpoint,0));
// (Sin manejador en keyup para evitar doble salto)
getEditEl()?.addEventListener('focus', ()=> setTimeout(()=>{
  const el = getEditEl(); if(!el) return;
  const node = el.firstChild || el; let text = node.textContent || '';
  if(text.length === 0){ text = '  '; node.textContent = text; }
  moveCaretToNearestMidpoint();
},0));

const inputToLed = new Map([
  [inputLg, ledLg],
  [inputV, ledV],
  [inputT, ledT],
]);

const autoTip = document.createElement('div');
autoTip.className = 'hover-tip auto-tip-below';
autoTip.textContent = 'Introduce valores en los otros dos círculos';
document.body.appendChild(autoTip);
let autoTipTimeout = null;

function showAutoTip(input){
  const rect = input.getBoundingClientRect();
  autoTip.style.left = rect.left + rect.width / 2 + 'px';
  // Show below the input (use bottom instead of top)
  autoTip.style.top = rect.bottom + window.scrollY + 'px';
  autoTip.classList.add('show');
  clearTimeout(autoTipTimeout);
  // Display twice as long as before
  autoTipTimeout = setTimeout(() => autoTip.classList.remove('show'), 4000);
}

function flashOtherLeds(excludeInput){
  const excludeLed = inputToLed.get(excludeInput);
  [ledLg, ledV, ledT].forEach(led => {
    if (led && led !== excludeLed) {
      led.classList.add('flash');
      setTimeout(() => led.classList.remove('flash'), 800);
    }
  });
}

[inputLg, inputV, inputT].filter(Boolean).forEach(input => {
  input.addEventListener('beforeinput', (e) => {
    if (input.dataset.auto === '1') {
      showAutoTip(input);
      flashOtherLeds(input);
      e.preventDefault();
    }
  });
});

function setValue(input, value){
  isUpdating = true;
  input.value = String(value);
  isUpdating = false;
}

// parseNum, formatInteger, formatBpmValue now imported/defined at top
// formatNumberValue replaced with formatNumber from number-utils

const titleInfoTooltip = createInfoTooltip({
  className: 'fraction-info-bubble auto-tip-below top-bar-info-tip'
});

function buildTitleInfoContent() {
  const fragment = document.createDocumentFragment();

  const lgValue = parseNum(inputLg?.value ?? '');
  const hasLg = Number.isFinite(lgValue) && lgValue > 0;

  if (hasLg) {
    const lgLine = document.createElement('p');
    lgLine.className = 'top-bar-info-tip__line';
    const lgLabel = document.createElement('strong');
    lgLabel.textContent = 'Lg:';
    lgLine.append(lgLabel, ' ', formatInteger(lgValue));
    fragment.append(lgLine);
  } else {
    const hint = document.createElement('p');
    hint.className = 'top-bar-info-tip__hint';
    hint.textContent = 'Introduce una Lg mayor que 0 para activar los cálculos.';
    fragment.append(hint);
  }

  const tempoValue = parseNum(inputV?.value ?? '');
  const hasTempo = Number.isFinite(tempoValue) && tempoValue > 0;
  const tValue = parseNum(inputT?.value ?? '');
  const hasT = Number.isFinite(tValue) && tValue > 0;
  const derivedTFromTempo = hasLg && hasTempo ? (lgValue * 60) / tempoValue : null;
  const tempoFromT = hasLg && hasT ? (lgValue / tValue) * 60 : null;
  const effectiveTempo = hasTempo ? tempoValue : tempoFromT;
  const tForFormula = hasT ? tValue : derivedTFromTempo;

  if (effectiveTempo != null && hasLg && tForFormula != null) {
    const baseFormulaLine = document.createElement('p');
    baseFormulaLine.className = 'top-bar-info-tip__line';
    const baseLabel = document.createElement('strong');
    baseLabel.textContent = 'V base';
    baseFormulaLine.append(
      baseLabel,
      ` = (${formatInteger(lgValue)} / ${formatNumber(tForFormula, 2)})·60 = ${formatBpmValue(effectiveTempo)} BPM`
    );
    fragment.append(baseFormulaLine);
  } else if (effectiveTempo != null) {
    const baseLine = document.createElement('p');
    baseLine.className = 'top-bar-info-tip__line';
    const baseLabel = document.createElement('strong');
    baseLabel.textContent = 'V base:';
    baseLine.append(baseLabel, ' ', `${formatBpmValue(effectiveTempo)} BPM`);
    fragment.append(baseLine);
  } else {
    const hint = document.createElement('p');
    hint.className = 'top-bar-info-tip__hint';
    hint.textContent = 'Completa V y Lg para calcular la velocidad base.';
    fragment.append(hint);
  }

  if (hasLg && hasTempo && derivedTFromTempo != null) {
    const tFormulaLine = document.createElement('p');
    tFormulaLine.className = 'top-bar-info-tip__line';
    const tFormulaLabel = document.createElement('strong');
    tFormulaLabel.textContent = 'T';
    tFormulaLine.append(
      tFormulaLabel,
      ` = (${formatInteger(lgValue)} / ${formatBpmValue(tempoValue)})·60 = ${formatNumber(derivedTFromTempo, 2)} s`
    );
    fragment.append(tFormulaLine);
  } else if (hasT) {
    const tLine = document.createElement('p');
    tLine.className = 'top-bar-info-tip__line';
    const tLabel = document.createElement('strong');
    tLabel.textContent = 'T:';
    tLine.append(tLabel, ' ', `${formatNumber(tValue, 2)} s`);
    fragment.append(tLine);
  }

  const selectedForAudio = selectedForAudioFromState();
  const selectedCount = selectedForAudio ? selectedForAudio.size : 0;
  const selectedLine = document.createElement('p');
  selectedLine.className = 'top-bar-info-tip__line';
  const selectedLabel = document.createElement('strong');
  selectedLabel.textContent = 'Pulsos seleccionados:';
  selectedLine.append(selectedLabel, ' ', formatInteger(selectedCount));
  fragment.append(selectedLine);

  if (selectedCount > 0) {
    const reminder = document.createElement('p');
    reminder.className = 'top-bar-info-tip__hint';
    reminder.textContent = 'Los pulsos seleccionados no incluyen los extremos 0 y Lg.';
    fragment.append(reminder);
  }

  return fragment;
}

if (titleButton) {
  attachHover(titleButton, { text: 'Click para ver información detallada' });
  titleButton.addEventListener('click', () => {
    const content = buildTitleInfoContent();
    if (!content) return;
    titleInfoTooltip.show(content, titleButton);
  });
  titleButton.addEventListener('blur', () => titleInfoTooltip.hide());
  titleButton.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' || event.key === 'Esc') {
      titleInfoTooltip.hide();
    }
  });
}
function formatSec(n){
  // arrodonim a 2 decimals però sense forçar-los si són .00
  const rounded = Math.round(Number(n) * 100) / 100;
  return rounded.toLocaleString('ca-ES', {
     minimumFractionDigits: 0,
     maximumFractionDigits: 2
   });
}

// Guard: if LED is off (auto), show tip and do nothing
function guardManual(input){
  if (input?.dataset?.auto === '1'){
    showAutoTip(input);
    flashOtherLeds(input);
    return false;
  }
  return true;
}

// Long‑press auto‑repeat for spinner buttons
function addRepeatPress(el, fn, guardInput){
  if (!el) return;
  let t=null, r=null;
  const start = (ev) => {
    // When LED is off (auto), show help and do nothing
    if (guardInput && !guardManual(guardInput)) { ev.preventDefault(); return; }
    fn();
    t = setTimeout(() => { r = setInterval(fn, 80); }, 320);
    ev.preventDefault();
  };
  const stop = () => { clearTimeout(t); clearInterval(r); t=r=null; };
  el.addEventListener('mousedown', start);
  el.addEventListener('touchstart', start, { passive:false });
  ['mouseup','mouseleave','touchend','touchcancel'].forEach(ev=>el.addEventListener(ev, stop));
  // Also stop if released outside the button
  document.addEventListener('mouseup', stop);
  document.addEventListener('touchend', stop);
}


// Unified spinner behavior for number inputs (V, Lg)
function stepAndDispatch(input, dir){
  if (!input) return;
  if (dir > 0) input.stepUp(); else input.stepDown();
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
addRepeatPress(inputVUp,   () => stepAndDispatch(inputV, +1),  inputV);
addRepeatPress(inputVDown, () => stepAndDispatch(inputV, -1),  inputV);
addRepeatPress(inputLgUp,  () => stepAndDispatch(inputLg, +1), inputLg);
addRepeatPress(inputLgDown,() => stepAndDispatch(inputLg, -1), inputLg);

// OLD sanitizePulseSeq() removed - replaced by handlePulseSeqInput() which uses
// shared sanitizePulseSequence() from pulse-seq-intervals.js

function handleInput(){
  const lg = parseNum(inputLg.value);
  const v  = parseNum(inputV.value);
  const hasLg = !isNaN(lg) && lg > 0;
  const hasV  = !isNaN(v)  && v  > 0;

  if (isUpdating) return;

  let indicatorValue = '';
  if (hasLg && hasV) {
    const timing = fromLgAndTempo(lg, v);
    if (timing && timing.duration != null) {
      const rounded = Math.round(timing.duration * 100) / 100;
      if (inputT) setValue(inputT, rounded);
      indicatorValue = rounded;
    }
  } else if (inputT) {
    indicatorValue = parseNum(inputT.value);
  }
  updateTIndicatorText(indicatorValue);

  // Ensure memory capacity always (preserve selections when Lg crece manualmente)
  if (hasLg) {
    ensureIntervalMemory(lg);
  }

  updateFormula();
  renderTimeline();
  updatePulseSeqField();
  updateAutoIndicator();

  if (isPlaying && audio) {
    const lgNow = parseInt(inputLg.value);
    const vNow  = parseFloat(inputV.value);
    if (typeof audio.setSelected === 'function') {
      audio.setSelected(selectedForAudioFromState());
    }
    const validLg = Number.isFinite(lgNow) && lgNow > 0;
    const validV = Number.isFinite(vNow) && vNow > 0;
    if (typeof audio.updateTransport === 'function' && (validLg || validV)) {
      const playbackTotal = validLg ? toPlaybackPulseCount(lgNow, loopEnabled) : null;
      audio.updateTransport({
        align: 'nextPulse',
        totalPulses: playbackTotal != null ? playbackTotal : undefined,
        bpm: validV ? vNow : undefined
      });
    }
  }
}

function updateFormula(){
  if (!formula) return;
  const tNum = parseNum(inputT?.value ?? '');
  const tStr = isNaN(tNum)
    ? ((inputT?.value ?? '') || 'T')
    : formatSec(tNum).replace('.', ',');
  const lg = inputLg.value || 'Lg';
  const v  = inputV.value || 'V';
  formula.innerHTML = `
  <span class="fraction">
    <span class="top lg">${lg}</span>
    <span class="bottom v">${v}</span>
  </span>
  <span class="equal">=</span>
  <span class="fraction">
    <span class="top t">${tStr}</span>
    <span class="bottom">60</span>
  </span>`;

  attachHover(formula.querySelector('.top.lg'), { text: 'Pulsos' });
  attachHover(formula.querySelector('.bottom.v'), { text: 'PulsosPorMinuto' });
  attachHover(formula.querySelector('.top.t'), { text: 'segundos' });
  attachHover(formula.querySelector('.bottom:not(.v)'), { text: 'segundos' });
}

function updatePulseSeqField(){
  if(!pulseSeqEl) return;
  const lg = parseInt(inputLg.value);
  if(isNaN(lg) || lg <= 0){
    setPulseSeqText('');
    try{ const s = pulseSeqEl.querySelector('.pz.lg'); if (s) s.textContent=''; }catch{}
    pulseSeqRanges = {};
    return;
  }
  try{ const s = pulseSeqEl.querySelector('.pz.lg'); if (s) s.textContent=String(lg); }catch{}
  const arr = [];
  // Collect selected intervals from 1 to Lg (inclusive)
  for(let i = 1; i <= lg && i < intervalMemory.length; i++){
    if(intervalMemory[i]) arr.push(i);
  }
  arr.sort((a,b) => a - b);
  pulseSeqRanges = {};
  let pos = 0;
  const parts = arr.map(num => {
    const str = String(num);
    pulseSeqRanges[num] = [pos + 2, pos + 2 + str.length];
    pos += str.length + 2; // acumulado interno; offset global de 2 al inicio
    return str;
  });
  // añade dos espacios al inicio y al final para tener midpoints en extremos
  setPulseSeqText((parts.length? '  ' : '  ') + parts.join('  ') + (parts.length? '  ' : '  '));
}

// Rebuild selectedIntervals (visible set) from intervalMemory and current Lg, then apply DOM classes
// App5: Sin extremos efímeros, de 1 a Lg inclusive
function syncSelectedFromMemory() {
  const lg = parseInt(inputLg.value);
  if (isNaN(lg) || lg <= 0) return;

  selectedIntervals.clear();

  // Persistencia: índices de 1 a Lg (inclusive)
  const maxIdx = Math.min(lg, intervalMemory.length - 1);
  for (let i = 1; i <= maxIdx; i++) {
    if (intervalMemory[i]) selectedIntervals.add(i);
  }

  // NO apply .selected class to pulses - they are non-interactive
  // Selection styling will be applied to interval blocks instead

  // Render interval blocks (they handle their own selection styling)
  intervalRenderer.render();

  updatePulseSeqField();
  renderNotationIfVisible();
}

/**
 * Handles manual editing of pulse sequence (P field) - Phase 5
 * Parses text, validates interval numbers, updates state
 * Preserves UX features: caret positioning, error messages for invalid numbers
 */
async function handlePulseSeqInput(opts = {}){
  if (!pulseSeqEl) return;
  const lg = parseInt(inputLg.value);

  // Save caret position before sanitizing
  const caretBefore = (()=>{
    const el=getEditEl();
    if(!el) return 0;
    const s=window.getSelection&&window.getSelection();
    if(!s||s.rangeCount===0) return 0;
    const r=s.getRangeAt(0);
    if(!el.contains(r.startContainer)) return 0;
    return r.startOffset;
  })();

  const text = getPulseSeqText();

  if (isNaN(lg) || lg <= 0) {
    intervalMemory = [];
    selectedIntervals.clear();
    renderTimeline();
    updateNumbers();
    return;
  }

  ensureIntervalMemory(lg);

  // Import sanitization function
  const { sanitizePulseSequence } = await import('../../libs/app-common/pulse-seq-intervals.js');

  // Parse all numbers from text to detect invalid ones
  const matches = text.match(/\d+/g) || [];
  const allNumbers = matches.map(m => parseInt(m, 10)).filter(n => Number.isFinite(n) && n >= 1);
  const tooBigNumbers = allNumbers.filter(n => n > lg);
  const hadTooBig = tooBigNumbers.length > 0;
  const firstTooBig = tooBigNumbers[0] || null;

  // Get valid interval numbers (1 to Lg, deduplicated, sorted)
  const validIntervals = sanitizePulseSequence(text, lg);

  // Reset all intervals to unselected
  for (let i = 1; i <= lg; i++) {
    intervalMemory[i] = false;
  }

  // Mark valid intervals as selected
  validIntervals.forEach(i => {
    intervalMemory[i] = true;
  });

  // Update display with sanitized values (with padding for visual clarity)
  const joined = validIntervals.join('  ');
  const out = '  ' + joined + '  ';
  setPulseSeqText(out);

  // Rebuild selectedIntervals Set
  selectedIntervals.clear();
  validIntervals.forEach(i => selectedIntervals.add(i));

  // Re-render intervals with new selection
  intervalRenderer.render();
  updateNumbers();
  renderNotationIfVisible(); // Sync notation with P field changes

  // Restore caret in a safe position (between double spaces)
  const pos = Math.min(out.length, caretBefore);
  if (hadTooBig || !(opts.causedBy === 'enter' || opts.causedBy === 'blur')) {
    setPulseSeqSelection(pos, pos);
    // Ensure separation: jump to nearest midpoint after normalizing
    try { moveCaretToNearestMidpoint(); } catch {}
  }

  // Show temporary message if there were numbers > Lg
  if (hadTooBig) {
    try{
      const el = getEditEl();
      const tip = document.createElement('div');
      tip.className = 'hover-tip auto-tip-below';
      const bad = firstTooBig != null ? firstTooBig : '';
      tip.innerHTML = `El número <strong>${bad}</strong> introducido es mayor que la <span style="color: var(--color-lg); font-weight: 700;">Lg</span>. Elige un número menor que <strong>${lg}</strong>`;
      document.body.appendChild(tip);
      let rect = null;
      const sel = window.getSelection && window.getSelection();
      if(sel && sel.rangeCount){
        const r = sel.getRangeAt(0);
        rect = r.getBoundingClientRect();
      }
      if (!rect || rect.width === 0) rect = el.getBoundingClientRect();
      const x = rect.left + rect.width/2 - tip.offsetWidth/2;
      const y = rect.bottom + 12;
      tip.style.left = `${x}px`;
      tip.style.top = `${y}px`;
      setTimeout(() => tip.remove(), 3500);
    } catch {}
  }

  // Update audio if playing
  if (isPlaying && audio && typeof audio.setSelected === 'function') {
    audio.setSelected(selectedForAudioFromState());
  }

  return { hadTooBig, firstTooBig };
}

// Set selection state for index i (App5: todos los pulsos de 1 a Lg son seleccionables)
function setPulseSelected(i, shouldSelect) {
  const lg = parseInt(inputLg.value);
  if (isNaN(lg) || lg < 0) return;
  if (i < 1 || i > lg) return; // Solo pulsos de 1 a Lg

  ensureIntervalMemory(Math.max(i, lg));
  intervalMemory[i] = shouldSelect;

  syncSelectedFromMemory();
  updateNumbers();

  if (isPlaying && audio) {
    if (typeof audio.setSelected === 'function') {
      audio.setSelected(selectedForAudioFromState());
    }
    if (typeof audio.setLoop === 'function') {
      audio.setLoop(loopEnabled);
    }
  }

  animateTimelineCircle(loopEnabled && circularTimeline);
  renderNotationIfVisible();
}

function renderTimeline(){
  timeline.innerHTML = '';
  pulses = [];
  // pulseHits removed - no longer needed
  const lg = parseInt(inputLg.value);
  if(isNaN(lg) || lg <= 0) return;
  ensureIntervalMemory(lg);

  // App5: Render pulses 0 to Lg (pulse 0 is neutral starting point)
  for (let i = 0; i <= lg; i++) {
    const p = document.createElement('div');
    p.className = 'pulse';
    if (i === 0) p.classList.add('zero');
    if (i === lg) p.classList.add('lg');
    p.dataset.index = i;

    // Click handler for toggling pulse number visibility
    p.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent event bubbling
      togglePulseNumberVisibility(i);
    });

    timeline.appendChild(p);
    pulses.push(p);

    // Vertical bars at endpoints (pulse 0 and pulse Lg)
    if (i === 0 || i === lg) {
      const bar = document.createElement('div');
      bar.className = 'bar';
      timeline.appendChild(bar);
    }
  }
  syncSelectedFromMemory();
  animateTimelineCircle(loopEnabled && circularTimeline, { silent: true });
  updateTIndicatorPosition();
  renderNotationIfVisible();
}

// togglePulse removed - pulses are no longer interactive in App5
// Intervals will be selectable instead

// Toggle visibility of pulse number label on click
// En circular, Lg y 0 comparten posición, así que se muestran/ocultan juntos
function togglePulseNumberVisibility(pulseIndex) {
  const lg = parseInt(inputLg.value);
  const isCircular = timeline.classList.contains('circular');

  // En circular, si clickeas Lg, también toggle 0 (están en la misma posición)
  const indicesToToggle = [];
  if (isCircular && (pulseIndex === 0 || pulseIndex === lg)) {
    indicesToToggle.push(0, lg);
  } else {
    indicesToToggle.push(pulseIndex);
  }

  indicesToToggle.forEach(index => {
    const numberEl = timeline.querySelector(`.pulse-number[data-index="${index}"]`);
    if (numberEl) {
      const willBeVisible = numberEl.classList.contains('hidden');
      numberEl.classList.toggle('hidden');

      // Track visibility state for persistence across layout changes
      if (willBeVisible) {
        visiblePulseNumbers.add(index);
      } else {
        visiblePulseNumbers.delete(index);
      }
    }
  });
}

function animateTimelineCircle(isCircular, opts = {}) {
  const silent = !!opts.silent;
  timelineRenderer.layoutTimeline(isCircular, { silent });
}

function showNumber(i, options = {}){
  const { selected = false, hidden = false, endpoint = false } = options;
  const n = document.createElement('div');
  n.className = 'pulse-number';

  const lg = parseInt(inputLg.value);
  if (isNaN(lg) || lg <= 0) return;

  // Clases especiales para endpoints (pulso 0 y Lg)
  if (i === 0) n.classList.add('zero');
  if (i === lg) n.classList.add('lg');
  if (endpoint) n.classList.add('endpoint');

  // Esconder por defecto si se indica
  if (hidden) {
    n.classList.add('hidden');
  }

  // La clase 'selected' ya no se usa para números de pulso
  // (solo los intervalos tienen selección)

  n.dataset.index = i;
  n.textContent = i;
  const fontRem = computeNumberFontRem(lg);
  n.style.fontSize = fontRem + 'rem';

   if (timeline.classList.contains('circular')) {
     const rect = timeline.getBoundingClientRect();
     const radius = Math.min(rect.width, rect.height) / 2 - 10;
     const offset = NUMBER_CIRCLE_OFFSET;
     const cx = rect.width / 2;
     const cy = rect.height / 2;
     // App5: ángulo de 0 a Lg
     const normalizedIndex = lg > 0 ? i / lg : 0; // normalizado de 0 a 1
     const angle = normalizedIndex * 2 * Math.PI + Math.PI / 2;
     const x = cx + (radius + offset) * Math.cos(angle);
     let y = cy + (radius + offset) * Math.sin(angle);

     const xShift = (i === 0) ? -16 : (i === lg ? 16 : 0); // 0 a l'esquerra, Lg a la dreta
     n.style.left = (x + xShift) + 'px';
     n.style.transform = 'translate(-50%, -50%)';

     if (i === 0 || i === lg) {
       n.style.top = (y + 8) + 'px';
       n.style.zIndex = (i === 0) ? '3' : '2';
     } else {
       n.style.top = y + 'px';
     }

  } else {
    // App5: posición lineal de 0 a Lg
    const normalizedIndex = lg > 0 ? i / lg : 0;
    const percent = normalizedIndex * 100;
    n.style.left = percent + '%';
  }

  timeline.appendChild(n);
}

function removeNumber(i){
  const el = timeline.querySelector(`.pulse-number[data-index="${i}"]`);
  if(el) el.remove();
}

function updateNumbers(){
  document.querySelectorAll('.pulse-number').forEach(n => n.remove());
  if (pulses.length === 0) return;

  const lg = parseInt(inputLg.value);
  if (isNaN(lg) || lg <= 0) return;

  // Clean up visibility tracking for pulse numbers that no longer exist (> Lg)
  const indicesToRemove = Array.from(visiblePulseNumbers).filter(i => i > lg);
  indicesToRemove.forEach(i => visiblePulseNumbers.delete(i));

  const tooDense = lg >= NUMBER_HIDE_THRESHOLD;
  if (tooDense) {
    try { updateTIndicatorPosition(); } catch {}
    return;
  }

  // App5: Renderizar números de 0 a Lg (pulsos empiezan en 0)
  // Restaurar visibilidad desde visiblePulseNumbers Set
  for (let i = 0; i <= lg; i++) {
    const isEndpoint = i === 0 || i === lg;
    const shouldBeVisible = visiblePulseNumbers.has(i);
    // Los números NO reflejan selección de intervalos (solo pulsos son marcadores)
    showNumber(i, { selected: false, hidden: !shouldBeVisible, endpoint: isEndpoint });
  }
  // Re-anchor T to the (possibly) re-generated Lg label
  try { updateTIndicatorPosition(); } catch {}
}

function updateAutoIndicator(){
  // Los LEDs encendidos son los campos editables; el apagado se recalcula
  ledLg?.classList.toggle('on', inputLg.dataset.auto !== '1');
  ledV?.classList.toggle('on', inputV.dataset.auto !== '1');
  ledT?.classList.toggle('on', (inputT?.dataset?.auto) !== '1');
}

function handlePlaybackStop(audioInstance) {
  const iconPlay = playBtn?.querySelector('.icon-play');
  const iconStop = playBtn?.querySelector('.icon-stop');
  isPlaying = false;
  playBtn?.classList.remove('active');
  if (iconPlay) iconPlay.style.display = 'block';
  if (iconStop) iconStop.style.display = 'none';
  highlightController.clearHighlights();
  visualSync.stop();
  if (audioInstance && typeof audioInstance.stop === 'function') {
    try { audioInstance.stop(); } catch {}
  }

  // Resetear cursor de notación
  if (notationRenderer && typeof notationRenderer.resetCursor === 'function') {
    notationRenderer.resetCursor();
  }
  const ed = getEditEl();
  if (ed) {
    ed.classList.remove('playing');
    try { ed.blur(); } catch {}
    try {
      const sel = window.getSelection && window.getSelection();
      sel && sel.removeAllRanges && sel.removeAllRanges();
    } catch {}
  }
  pulseSeqController.clearActive();
}

async function startPlayback(providedAudio) {
  const lg = parseInt(inputLg.value);
  const v  = parseFloat(inputV.value);
  if (!Number.isFinite(lg) || !Number.isFinite(v) || lg <= 0 || v <= 0) {
    return false;
  }

  const audioInstance = providedAudio || await initAudio();
  if (!audioInstance) return false;

  visualSync.stop();
  audioInstance.stop();
  highlightController.clearHighlights();

  // Sound selection is already applied by initAudio() from dataset.value
  // and by bindSharedSoundEvents from sharedui:sound events
  // No need to override here

  const timing = fromLgAndTempo(lg, v);
  if (!timing || timing.interval == null) {
    return false;
  }

  const interval = timing.interval;
  const playbackTotal = toPlaybackPulseCount(lg, loopEnabled);
  if (playbackTotal == null) {
    return false;
  }
  const selectedForAudio = selectedForAudioFromState();
  const iconPlay = playBtn?.querySelector('.icon-play');
  const iconStop = playBtn?.querySelector('.icon-stop');

  const onFinish = () => {
    handlePlaybackStop(audioInstance);
  };

  const onPulse = (step) => {
    // Convert step index (0-indexed) to interval number (1-indexed)
    const intervalNumber = step + 1;
    highlightController.highlightInterval(intervalNumber);
  };

  audioInstance.play(playbackTotal, interval, selectedForAudio, loopEnabled, onPulse, onFinish);

  visualSync.syncVisualState();
  visualSync.start();

  isPlaying = true;
  playBtn?.classList.add('active');
  if (iconPlay) iconPlay.style.display = 'none';
  if (iconStop) iconStop.style.display = 'block';
  const ed = getEditEl();
  if (ed) {
    ed.classList.add('playing');
    try { ed.blur(); } catch {}
  }

  return true;
}

function syncTimelineScroll(){
  if (!pulseSeqEl || !timelineWrapper) return;
  const maxSeq = pulseSeqEl.scrollWidth - pulseSeqEl.clientWidth;
  const maxTl = timelineWrapper.scrollWidth - timelineWrapper.clientWidth;
  if (maxSeq <= 0) return;
  const ratio = pulseSeqEl.scrollLeft / maxSeq;
  timelineWrapper.scrollLeft = maxTl * ratio;
}

playBtn.addEventListener('click', async () => {
  try {
    const audioInstance = await initAudio();
    if (!audioInstance) return;

    if (isPlaying) {
      handlePlaybackStop(audioInstance);
      return;
    }

    await startPlayback(audioInstance);
  } catch {}
});

function getPulseSeqRect(index) {
  if (!pulseSeqEl || !Number.isFinite(index)) return null;
  const idx = Math.round(index);
  if (idx === 0) {
    const zero = pulseSeqEl.querySelector('.pz.zero');
    return zero ? zero.getBoundingClientRect() : null;
  }
  if (pulses && idx === pulses.length - 1) {
    const lgEl = pulseSeqEl.querySelector('.pz.lg');
    return lgEl ? lgEl.getBoundingClientRect() : null;
  }
  const range = pulseSeqRanges[idx];
  if (range && Array.isArray(range)) {
    const edit = getEditEl();
    const node = edit && edit.firstChild;
    if (node) {
      try {
        const r = document.createRange();
        const start = Math.max(0, Number(range[0]) || 0);
        const end = Math.max(start, Number(range[1]) || start);
        r.setStart(node, start);
        r.setEnd(node, end);
        return r.getBoundingClientRect();
      } catch {}
    }
  }
  return null;
}

pulseSeqController.setRectResolver(getPulseSeqRect);

// Handle pulse scrolling in pulse sequence panel
function handlePulseScroll(i) {
  if (!pulseSeqEl || !pulses || pulses.length === 0) return;

  const idx = i % pulses.length;
  const rect = getPulseSeqRect(idx);
  let newScrollLeft = pulseSeqEl.scrollLeft;

  if (rect) {
    const parentRect = pulseSeqEl.getBoundingClientRect();
    const absLeft = rect.left - parentRect.left + pulseSeqEl.scrollLeft;
    const target = absLeft - (pulseSeqEl.clientWidth - rect.width) / 2;
    const maxScroll = pulseSeqEl.scrollWidth - pulseSeqEl.clientWidth;
    newScrollLeft = Math.max(0, Math.min(target, maxScroll));
    pulseSeqEl.scrollLeft = newScrollLeft;
    if (typeof syncTimelineScroll === 'function') syncTimelineScroll();
  }

  let trailingIndex = null;
  let trailingRect = null;
  if (idx === 0 && loopEnabled) {
    trailingIndex = pulses.length - 1;
    trailingRect = getPulseSeqRect(trailingIndex);
  }

  if (rect) {
    pulseSeqController.setActiveIndex(idx, {
      rect,
      trailingIndex,
      trailingRect,
      scrollLeft: newScrollLeft
    });
  } else {
    pulseSeqController.clearActive();
  }
}

// highlightInterval now handled by highlightController.highlightInterval(intervalNumber)
// Converts step index (0-indexed) to interval number (1-indexed): step 0 → interval 1
// Pulse scrolling logic extracted to handlePulseScroll()
// stopVisualSync, syncVisualState, startVisualSync replaced by visualSync controller
// Use visualSync.stop(), visualSync.syncVisualState(), visualSync.start()

const menu = document.querySelector('.menu');
const optionsContent = document.querySelector('.menu .options-content');

if (menu && optionsContent) {
  menu.addEventListener('toggle', () => {
    if (menu.open) {
      // enforce solid background on open
      solidMenuBackground(optionsContent);
      optionsContent.classList.add('opening');
      optionsContent.classList.remove('closing');
      optionsContent.style.maxHeight = optionsContent.scrollHeight + "px";

      optionsContent.addEventListener('transitionend', () => {
        optionsContent.classList.remove('opening');
        optionsContent.style.maxHeight = "500px"; // estat estable
      }, { once: true });

    } else {
      optionsContent.classList.add('closing');
      optionsContent.classList.remove('opening');
      optionsContent.style.maxHeight = optionsContent.scrollHeight + "px";
      optionsContent.offsetHeight; // força reflow
      optionsContent.style.maxHeight = "0px";

      optionsContent.addEventListener('transitionend', () => {
        optionsContent.classList.remove('closing');
      }, { once: true });
    }
  });

  // Also re-apply if theme changes while menu is open
  window.addEventListener('sharedui:theme', () => {
    if (menu.open) solidMenuBackground(optionsContent);
  });
}
// Initialize mixer UI and sync accent/master controls
const mixerMenu = document.getElementById('mixerMenu');
const mixerTriggers = [playBtn, tapBtn].filter(Boolean);

initMixerMenu({
  menu: mixerMenu,
  triggers: mixerTriggers,
  channels: [
    { id: 'pulse',  label: 'Pulsaciones', allowSolo: true },
    { id: 'accent', label: 'Seleccionados',  allowSolo: true },
    { id: 'master', label: 'Master',        allowSolo: false, isMaster: true }
  ]
});
