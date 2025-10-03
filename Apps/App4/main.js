import { getMixer, subscribeMixer } from '../../libs/sound/index.js';
import { attachHover } from '../../libs/shared-ui/hover.js';
import { computeHitSizePx, solidMenuBackground, computeNumberFontRem } from './utils.js';
import { initRandomMenu } from '../../libs/app-common/random-menu.js';
import { createSchedulingBridge, bindSharedSoundEvents } from '../../libs/app-common/audio.js';
import { createRhythmAudioInitializer } from '../../libs/app-common/audio-init.js';
import { fromLgAndTempo, toPlaybackPulseCount, gridFromOrigin, computeSubdivisionFontRem } from '../../libs/app-common/subdivision.js';
import { initMixerMenu } from '../../libs/app-common/mixer-menu.js';
import { initAudioToggles } from '../../libs/app-common/audio-toggles.js';
import { createPreferenceStorage, registerFactoryReset, setupThemeSync, setupMutePersistence } from '../../libs/app-common/preferences.js';
import createFractionEditor, { createEmptyFractionInfo } from '../../libs/app-common/fraction-editor.js';
import { FRACTION_INLINE_SLOT_ID } from '../../libs/app-common/template.js';
import { randomize as randomizeValues } from '../../libs/random/index.js';
import createPulseSeqController from '../../libs/app-common/pulse-seq.js';
import { createTimelineRenderer } from '../../libs/app-common/timeline-layout.js';
import { parseIntSafe, gcd, lcm } from '../../libs/app-common/number.js';
import { bindAppRhythmElements } from '../../libs/app-common/dom.js';
import { createRhythmLEDManagers, syncLEDsWithInputs } from '../../libs/app-common/led-manager.js';
import { createPulseMemoryLoopController } from '../../libs/app-common/loop-control.js';
import {
  FRACTION_POSITION_EPSILON,
  TEXT_NODE_TYPE,
  fractionDefaults,
  randomDefaults,
  createFractionSelectionStore,
  makeFractionKey,
  registerFractionLabel as registerFractionLabelInStore,
  getFractionInfoByLabel as getFractionInfoByLabelFromStore,
  fractionValue as computeFractionValue,
  cycleNotationToFraction as computeCycleNotationToFraction,
  fractionDisplay as formatFractionDisplay,
  extractFractionInfoFromElement,
  applyFractionSelectionClasses as applyFractionSelectionClassesModule,
  rebuildFractionSelections as rebuildFractionSelectionsModule,
  setFractionSelected as setFractionSelectedModule,
  loadRandomConfig,
  saveRandomConfig,
  applyRandomConfig as applyRandomConfigModule,
  updateRandomConfig as updateRandomConfigModule,
  applyRandomFractionSelection
} from './fraction-selection.js';
// Using local header controls for App2 (no shared init)

let audio;



const schedulingBridge = createSchedulingBridge({ getAudio: () => audio });
window.addEventListener('sharedui:scheduling', schedulingBridge.handleSchedulingEvent);
bindSharedSoundEvents({
  getAudio: () => audio,
  mapping: {
    baseSound: 'setBase',
    accentSound: 'setAccent',
    startSound: 'setStart',
    cycleSound: 'setCycle'
  }
});
// Bind all DOM elements using new utilities
// Bind all DOM elements using app-specific utilities (no warnings for missing elements)
const { elements, leds, ledHelpers } = bindAppRhythmElements('app4');

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
  ensurePulseMemory,
  getLg: () => parseInt(inputLg.value),
  isPlaying: () => isPlaying,
  onToggle: (enabled) => {
    // Rebuild visible selection from memory and refresh labels
    updatePulseNumbers();
    syncSelectedFromMemory();
    if (isPlaying) {
      applySelectionToAudio();
    }
    layoutTimeline();
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
        baseSoundSelect, accentSoundSelect,
        startSoundSelect, cycleSoundSelect, themeSelect, pulseToggleBtn,
        selectedToggleBtn, cycleToggleBtn } = elements;

// App4-specific elements
const pulseSeqEl = elements.pulseSeq;
const fractionInlineSlot = document.getElementById(FRACTION_INLINE_SLOT_ID);

function applyFractionInfoBackground(panel) {
  if (!panel) return;
  const theme = document.body?.dataset?.theme === 'dark' ? 'dark' : 'light';
  const rootStyles = getComputedStyle(document.documentElement);
  const textVar = theme === 'dark' ? '--text-dark' : '--text-light';
  const fallbackText = rootStyles.getPropertyValue(textVar)?.trim() || (theme === 'dark' ? '#EEE8D8' : '#43433B');
  panel.style.backgroundColor = theme === 'dark' ? 'rgba(40, 40, 40, 0.92)' : 'rgba(255, 255, 255, 0.9)';
  panel.style.color = fallbackText;
  panel.style.borderColor = theme === 'dark' ? 'rgba(238, 232, 216, 0.2)' : 'rgba(0, 0, 0, 0.08)';
  panel.style.boxShadow = theme === 'dark'
    ? '0 18px 36px rgba(0, 0, 0, 0.6)'
    : '0 12px 28px rgba(0, 0, 0, 0.25)';
  panel.style.backdropFilter = 'blur(8px)';
}

let numeratorInput;
let denominatorInput;
let pulseSeqFractionWrapper = null;
let fractionEditorController = null;
let currentFractionInfo = createEmptyFractionInfo();
let pulseSeqFractionNumeratorEl = null;
let pulseSeqFractionDenominatorEl = null;
let pulseSeqVisualEl = null;
let pulseSeqEditWrapper = null;
let pulses = [];
let pulseNumberLabels = [];
let cycleMarkers = [];
let cycleLabels = [];
let lastStructureSignature = {
  lg: null,
  numerator: null,
  denominator: null
};
let bars = [];
let pulseHits = [];
let cycleMarkerHits = [];
const fractionStore = createFractionSelectionStore();
const fractionMemory = new Map();

const EMPTY_PULSE_SCROLL_CACHE = {
  type: null,
  index: null,
  fractionKey: null,
  trailingIndex: null,
  rect: null,
  trailingRect: null,
  scrollLeft: null
};

let lastPulseScrollCache = { ...EMPTY_PULSE_SCROLL_CACHE };
let lastPulseHighlightState = {
  type: null,
  index: null,
  fractionKey: null,
  trailingIndex: null
};

let lastFractionHighlightNodes = {
  key: null,
  marker: null,
  hit: null,
  token: null
};

let lastCycleHighlightState = {
  cycleIndex: null,
  subdivisionIndex: null,
  marker: null,
  label: null,
  trailingMarker: null,
  trailingLabel: null,
  trailingCycleIndex: null,
  trailingSubdivisionIndex: null
};

function normalizeFractionMemoryPayload(info) {
  if (!info || !info.key) return null;
  const base = Number.isFinite(info.base) ? info.base : null;
  const numerator = Number.isFinite(info.numerator) ? info.numerator : null;
  const denominator = Number.isFinite(info.denominator) ? info.denominator : null;
  const cycleIndex = Number.isFinite(info.cycleIndex) ? info.cycleIndex : null;
  const subdivisionIndex = Number.isFinite(info.subdivisionIndex) ? info.subdivisionIndex : null;
  const pulsesPerCycle = Number.isFinite(info.pulsesPerCycle) && info.pulsesPerCycle > 0
    ? info.pulsesPerCycle
    : null;
  let value = Number.isFinite(info.value) ? info.value : null;
  if (!Number.isFinite(value)
    && Number.isFinite(base)
    && Number.isFinite(numerator)
    && Number.isFinite(denominator)
    && denominator > 0) {
    value = fractionValue(base, numerator, denominator);
  }
  const displayInput = typeof info.display === 'string' ? info.display : '';
  const display = displayInput || (Number.isFinite(base)
    && Number.isFinite(numerator)
    && Number.isFinite(denominator)
    && denominator > 0
    ? fractionDisplay(base, numerator, denominator, {
      cycleIndex,
      subdivisionIndex,
      pulsesPerCycle
    })
    : '');
  const rawLabel = typeof info.rawLabel === 'string' ? info.rawLabel : '';
  return {
    key: info.key,
    base,
    numerator,
    denominator,
    value,
    display,
    rawLabel,
    cycleIndex,
    subdivisionIndex,
    pulsesPerCycle
  };
}

function rememberFractionSelectionInMemory(info, { suspended = false } = {}) {
  const payload = normalizeFractionMemoryPayload(info);
  if (!payload) return;
  const existing = fractionMemory.get(payload.key) || {};
  const entry = {
    key: payload.key,
    base: Number.isFinite(payload.base) ? payload.base : existing.base,
    numerator: Number.isFinite(payload.numerator) ? payload.numerator : existing.numerator,
    denominator: Number.isFinite(payload.denominator) ? payload.denominator : existing.denominator,
    value: Number.isFinite(payload.value) ? payload.value : existing.value,
    display: payload.display || existing.display || '',
    rawLabel: payload.rawLabel || existing.rawLabel || '',
    cycleIndex: Number.isFinite(payload.cycleIndex) ? payload.cycleIndex : existing.cycleIndex,
    subdivisionIndex: Number.isFinite(payload.subdivisionIndex) ? payload.subdivisionIndex : existing.subdivisionIndex,
    pulsesPerCycle: Number.isFinite(payload.pulsesPerCycle) ? payload.pulsesPerCycle : existing.pulsesPerCycle,
    suspended: suspended === true
  };
  fractionMemory.set(payload.key, entry);
}

function markFractionSuspended(info) {
  const payload = normalizeFractionMemoryPayload(info);
  if (!payload) return;
  const existing = fractionMemory.get(payload.key) || {};
  const entry = {
    key: payload.key,
    base: Number.isFinite(payload.base) ? payload.base : existing.base,
    numerator: Number.isFinite(payload.numerator) ? payload.numerator : existing.numerator,
    denominator: Number.isFinite(payload.denominator) ? payload.denominator : existing.denominator,
    value: Number.isFinite(payload.value) ? payload.value : existing.value,
    display: payload.display || existing.display || '',
    rawLabel: payload.rawLabel || existing.rawLabel || '',
    cycleIndex: Number.isFinite(payload.cycleIndex) ? payload.cycleIndex : existing.cycleIndex,
    subdivisionIndex: Number.isFinite(payload.subdivisionIndex) ? payload.subdivisionIndex : existing.subdivisionIndex,
    pulsesPerCycle: Number.isFinite(payload.pulsesPerCycle) ? payload.pulsesPerCycle : existing.pulsesPerCycle,
    suspended: true
  };
  fractionMemory.set(payload.key, entry);
}

function syncFractionMemoryWithSelections() {
  const activeKeys = new Set();
  if (Array.isArray(fractionStore.pulseSelections)) {
    fractionStore.pulseSelections.forEach((item) => {
      if (!item || !item.key) return;
      activeKeys.add(item.key);
      rememberFractionSelectionInMemory(item, { suspended: false });
    });
  }
  fractionMemory.forEach((entry, key) => {
    if (!activeKeys.has(key) && !(entry && entry.suspended)) {
      fractionMemory.delete(key);
    }
  });
}
let pulseSeqRanges = {};
let currentAudioResolution = 1;
const raf = (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function')
  ? (cb) => window.requestAnimationFrame(cb)
  : (cb) => setTimeout(cb, 16);
const caf = (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function')
  ? (handle) => window.cancelAnimationFrame(handle)
  : (handle) => clearTimeout(handle);

if (fractionInlineSlot) {
  pulseSeqFractionWrapper = fractionInlineSlot;
}

const pulseSeqController = createPulseSeqController();
const pulseMemoryApi = pulseSeqController.memory;
const pulseMemory = pulseMemoryApi.data;
const { editEl: pulseSeqEditEl } = pulseSeqController.mount({
  root: pulseSeqEl,
  markupBuilder: buildPulseSeqMarkup,
  onTextSet: (value) => updatePulseSeqVisualLayer(value)
});
const dragController = pulseSeqController.drag;

// T indicator setup (App4-specific functionality)
const shouldRenderTIndicator = Boolean(inputT);
const tIndicator = shouldRenderTIndicator ? (() => {
  const indicator = document.createElement('div');
  indicator.id = 'tIndicator';
  // Start hidden to avoid flicker during first layout
  indicator.style.visibility = 'hidden';
  timeline.appendChild(indicator);
  return indicator;
})() : null;
// App4-specific additional elements
const randComplexToggle = document.getElementById('randComplexToggle');
const selectColor = document.getElementById('selectColor');
const randNToggle = document.getElementById('randNToggle');
const randNMin = document.getElementById('randNMin');
const randNMax = document.getElementById('randNMax');
const randDToggle = document.getElementById('randDToggle');
const randDMin = document.getElementById('randDMin');
const randDMax = document.getElementById('randDMax');
const titleHeading = document.querySelector('header.top-bar h1');
let titleButton = null;
if (titleHeading) {
  titleButton = document.createElement('button');
  titleButton.type = 'button';
  titleButton.id = 'appTitleBtn';
  titleButton.className = 'top-bar-title-button';
  titleButton.textContent = titleHeading.textContent || '';
  titleHeading.textContent = '';
  titleHeading.appendChild(titleButton);
}

const globalMixer = getMixer();
if (globalMixer) {
  globalMixer.registerChannel('pulse', { allowSolo: true, label: 'Pulso/Pulso 0' });
  globalMixer.registerChannel('subdivision', { allowSolo: true, label: 'Subdivisión' });
  globalMixer.registerChannel('accent', { allowSolo: true, label: 'Seleccionado' });
}

const FRACTION_NUMERATOR_KEY = 'n';
const FRACTION_DENOMINATOR_KEY = 'd';

const preferenceStorage = createPreferenceStorage({ prefix: 'app4', separator: ':' });
const { storeKey, save: saveOpt, load: loadOpt, clear: clearOpt } = preferenceStorage;
const muteButton = document.getElementById('muteBtn');

registerFactoryReset({ storage: preferenceStorage });
setupThemeSync({ storage: preferenceStorage, selectEl: themeSelect });
setupMutePersistence({
  storage: preferenceStorage,
  getAudioInstance: () => audio,
  muteButton
});

const randomControls = {
  randLgToggle,
  randLgMin,
  randLgMax,
  randVToggle,
  randVMin,
  randVMax,
  randNToggle,
  randNMin,
  randNMax,
  randDToggle,
  randDMin,
  randDMax,
  randComplexToggle,
  randPulsesToggle,
  randomCount
};

const randomConfig = {
  ...randomDefaults,
  ...loadRandomConfig(() => loadOpt(RANDOM_STORE_KEY))
};

function persistRandomConfig() {
  saveRandomConfig((value) => saveOpt(RANDOM_STORE_KEY, value), randomConfig);
}

function applyRandomConfig() {
  applyRandomConfigModule(randomConfig, randomControls);
}

function updateRandomConfig() {
  updateRandomConfigModule(randomConfig, randomControls);
  persistRandomConfig();
}

applyRandomConfig();

[
  randLgToggle, randLgMin, randLgMax,
  randVToggle, randVMin, randVMax,
  randNToggle, randNMin, randNMax,
  randDToggle, randDMin, randDMax,
  randComplexToggle,
  randPulsesToggle, randomCount
].forEach(el => el?.addEventListener('change', updateRandomConfig));

function getFraction() {
  if (!fractionEditorController) {
    return { numerator: null, denominator: null };
  }
  return fractionEditorController.getFraction();
}

function refreshFractionUI(options = {}) {
  if (!fractionEditorController) {
    currentFractionInfo = createEmptyFractionInfo();
    return currentFractionInfo;
  }
  currentFractionInfo = fractionEditorController.refresh(options);
  return currentFractionInfo;
}

function initFractionEditorController() {
  const host = pulseSeqFractionWrapper || fractionInlineSlot;
  if (!host) return;

  if (fractionEditorController && typeof fractionEditorController.destroy === 'function') {
    fractionEditorController.destroy();
  }
  fractionEditorController = null;

  const controller = createFractionEditor({
    mode: 'inline',
    host,
    defaults: fractionDefaults,
    startEmpty: true,
    storage: {
      load: loadOpt,
      save: saveOpt,
      clear: clearOpt,
      numeratorKey: FRACTION_NUMERATOR_KEY,
      denominatorKey: FRACTION_DENOMINATOR_KEY
    },
    addRepeatPress,
    applyMenuBackground: applyFractionInfoBackground,
    labels: {
      numerator: {
        placeholder: 'n',
        ariaUp: 'Incrementar numerador',
        ariaDown: 'Decrementar numerador'
      },
      denominator: {
        placeholder: 'd',
        ariaUp: 'Incrementar denominador',
        ariaDown: 'Decrementar denominador'
      }
    },
    onChange: ({ numerator, denominator, info, cause }) => {
      currentFractionInfo = info || createEmptyFractionInfo();
      updatePulseSeqFractionDisplay(numerator, denominator, { silent: true });
      if (fractionStore.pulseSelections.length > 0) {
        sanitizePulseSeq({ causedBy: 'fraction-change', skipCaret: true });
      }
      if (!isUpdating && cause !== 'init') {
        handleInput();
      }
    }
  });

  fractionEditorController = controller;
  if (controller && controller.elements) {
    const { numerator, denominator } = controller.elements;
    numeratorInput = numerator;
    denominatorInput = denominator;
    pulseSeqFractionNumeratorEl = numerator;
    pulseSeqFractionDenominatorEl = denominator;
  }
  refreshFractionUI({ reveal: false });
}

// No actualitza la memòria a cada tecleig: es confirma amb Enter o blur
// pulseSeqEl?.addEventListener('input', handlePulseSeqInput);

function nearestPulseIndex(value) {
  if (!Number.isFinite(value)) return null;
  const nearest = Math.round(value);
  return Math.abs(value - nearest) < FRACTION_POSITION_EPSILON ? nearest : null;
}

/**
 * Determina si un pulso entero es seleccionable según la fracción activa.
 *
 * @param {number} index - Índice del pulso a verificar
 * @param {number|null} numerator - Numerador de la fracción activa (n)
 * @param {number|null} denominator - Denominador de la fracción activa (d)
 * @param {number} lg - Longitud total de pulsos (Lg)
 * @returns {boolean} true si el pulso es seleccionable
 *
 * Regla: Para una fracción n/d, solo son seleccionables los pulsos que coinciden
 * con el inicio de cada ciclo de la fracción (múltiplos de n).
 * Si no hay fracción válida, todos los pulsos son seleccionables.
 */
function isIntegerPulseSelectable(index, numerator, denominator, lg) {
  // Validar entrada
  if (!Number.isFinite(index) || !Number.isFinite(lg) || lg <= 0) {
    return false;
  }

  // Los extremos (0 y Lg) siempre están controlados por Loop
  if (index === 0 || index === lg) {
    return false; // No seleccionables directamente, se controlan con loopEnabled
  }

  // Si no hay fracción válida, todos los pulsos intermedios son seleccionables
  if (!Number.isFinite(numerator) || numerator <= 0 || !Number.isFinite(denominator) || denominator <= 0) {
    return true;
  }

  // Solo son seleccionables los múltiplos del numerador
  return index % numerator === 0;
}

const voiceHighlightHandlers = new Map();

function ensurePulseMemory(size) {
  pulseMemoryApi.ensure(size);
}

// Clear all persistent pulse selection (memory beyond current Lg too)
function clearPersistentPulses(){
  pulseMemoryApi.clear();
  fractionMemory.clear();
  try { selectedPulses.clear(); } catch {}
  /* Keep UI consistent; will be rebuilt by subsequent calls */
  fractionStore.selectionState.clear();
  fractionStore.selectedFractionKeys.clear();
  fractionStore.pulseSelections = [];
  updatePulseSeqField();
  applyFractionSelectionClasses();
}
// UI thresholds for number rendering
const PULSE_NUMBER_HIDE_THRESHOLD = 71;
const SUBDIVISION_HIDE_THRESHOLD = 41;
const NUMBER_CIRCLE_OFFSET  = 34;    // px distance from circle to number label
const MIN_SUBDIVISION_LABEL_SPACING_PX = 40;

function registerFractionLabel(label, info) {
  registerFractionLabelInStore(fractionStore, label, info);
}

function getFractionInfoByLabel(label, opts = {}) {
  return getFractionInfoByLabelFromStore(fractionStore, label, opts);
}

function fractionValue(base, numerator, denominator) {
  return computeFractionValue(base, numerator, denominator);
}

function cycleNotationToFraction(cycleIndex, subdivisionIndex, pulsesPerCycle, denominator) {
  return computeCycleNotationToFraction(cycleIndex, subdivisionIndex, pulsesPerCycle, denominator);
}

function fractionDisplay(base, numerator, denominator, override = {}) {
  return formatFractionDisplay(base, numerator, denominator, override);
}

function getFractionInfoFromElement(el) {
  return extractFractionInfoFromElement(el, parseIntSafe);
}

function applyFractionSelectionClasses() {
  applyFractionSelectionClassesModule(fractionStore, cycleMarkers, cycleLabels);
}

function rebuildFractionSelections(opts = {}) {
  const selections = rebuildFractionSelectionsModule(fractionStore, {
    updatePulseSeqField,
    cycleMarkers,
    cycleLabels,
    skipUpdateField: opts.skipUpdateField
  });
  fractionStore.pulseSelections = selections;
  syncFractionMemoryWithSelections();
  return selections;
}

function setFractionSelected(info, shouldSelect) {
  setFractionSelectedModule(fractionStore, info, shouldSelect, {
    updatePulseSeqField,
    cycleMarkers,
    cycleLabels
  });
  if (isPlaying && audio) {
    applySelectionToAudio();
  }
}

function computeAudioSchedulingState() {
  const lg = parseInt(inputLg.value);
  const v = parseFloat(inputV.value);
  const { numerator, denominator } = getFraction();

  const validLg = Number.isFinite(lg) && lg > 0;
  const validV = Number.isFinite(v) && v > 0;

  const grid = gridFromOrigin({ lg: validLg ? lg : 0, numerator, denominator });
  const denominators = new Set([1]);
  fractionStore.pulseSelections.forEach((item) => {
    if (!item) return;
    const den = Number(item.denominator);
    if (Number.isFinite(den) && den > 0) {
      denominators.add(Math.round(den));
    }
  });

  const hasCycle = Boolean(
    validLg
    && Number.isFinite(numerator)
    && Number.isFinite(denominator)
    && numerator > 0
    && denominator > 0
    && Math.floor(lg / numerator) > 0
  );

  if (hasCycle) {
    denominators.add(Math.round(denominator));
  }

  let resolution = 1;
  denominators.forEach((den) => {
    resolution = Math.max(1, Math.round(lcm(resolution, Math.max(1, den))));
  });

  const playbackTotal = validLg ? toPlaybackPulseCount(lg, loopEnabled) : null;
  const totalPulses = playbackTotal != null ? playbackTotal : null;
  const interval = validV ? (60 / v) : null;
  const patternBeats = validLg ? lg : null;

  const cycleNumerator = hasCycle ? numerator : null;
  const cycleDenominator = hasCycle ? denominator : null;
  const cycleConfig = hasCycle
    ? { numerator: cycleNumerator, denominator: cycleDenominator, onTick: highlightCycle }
    : null;

  const voices = [];

  return {
    resolution,
    totalPulses,
    interval,
    patternBeats,
    cycleConfig,
    voices,
    validLg,
    validV,
    grid,
    lg
  };
}

// --- Selecció viva per a l'àudio (filtrada: sense 0 ni lg) ---
function selectedForAudioFromState({ scheduling } = {}) {
  const state = scheduling || computeAudioSchedulingState();
  const scale = Number.isFinite(state?.resolution) && state.resolution > 0
    ? Math.max(1, Math.round(state.resolution))
    : 1;
  const lg = Number.isFinite(state?.lg) ? state.lg : parseInt(inputLg.value);
  const baseSet = new Set();
  const cycleSet = new Set();
  const fractionSet = new Set();
  const combinedSet = new Set();
  const audioSet = new Set();
  if (!Number.isFinite(lg) || lg <= 0) {
    return {
      base: baseSet,
      cycle: cycleSet,
      fraction: fractionSet,
      combined: combinedSet,
      resolution: scale,
      audio: audioSet
    };
  }
  const maxIdx = Math.min(lg, pulseMemory.length - 1);
  for (let i = 1; i <= maxIdx; i++) {
    if (pulseMemory[i]) {
      baseSet.add(i);
      const scaled = i * scale;
      combinedSet.add(scaled);
      audioSet.add(scaled);
    }
  }
  const epsilon = 1e-6;
  if (state?.grid?.subdivisions?.length) {
    state.grid.subdivisions.forEach((subdivision) => {
      const pos = Number(subdivision?.position);
      if (!Number.isFinite(pos) || pos <= 0 || pos >= lg) return;
      cycleSet.add(pos);
      const scaled = Math.round(pos * scale);
      if (Math.abs(scaled / scale - pos) <= epsilon) {
        combinedSet.add(scaled);
      }
    });
  }
  fractionStore.pulseSelections.forEach((item) => {
    if (!item || !Number.isFinite(item.value)) return;
    if (item.value <= 0 || item.value >= lg) return;
    fractionSet.add(item.value);
    const scaled = Math.round(item.value * scale);
    if (Math.abs(scaled / scale - item.value) <= epsilon) {
      combinedSet.add(scaled);
      audioSet.add(scaled);
    }
  });
  return {
    base: baseSet,
    cycle: cycleSet,
    fraction: fractionSet,
    combined: combinedSet,
    resolution: scale,
    audio: audioSet
  };
}

function applySelectionToAudio({ scheduling, instance } = {}) {
  const target = instance || audio;
  if (!target || typeof target.setSelected !== 'function') return null;
  const selection = selectedForAudioFromState({ scheduling });
  const audioValues = selection.audio ?? selection.combined;
  const resolvedSelectionResolution = Number.isFinite(selection?.resolution)
    ? Math.max(1, Math.round(selection.resolution))
    : 1;
  target.setSelected({ values: audioValues, resolution: 1 });
  currentAudioResolution = resolvedSelectionResolution;
  return selection;
}

function updateVoiceHandlers({ scheduling } = {}) {
  voiceHighlightHandlers.clear();
  if (!scheduling || !Array.isArray(scheduling.voices)) return;
  const voices = scheduling.voices;
  const grid = scheduling.grid;
  const cycles = Number.isFinite(grid?.cycles) ? grid.cycles : null;
  voices.forEach((voice) => {
    if (!voice || !voice.id) return;
    const numerator = Number(voice.numerator);
    const denominator = Number(voice.denominator);
    if (!(Number.isFinite(numerator) && numerator > 0 && Number.isFinite(denominator) && denominator > 0)) {
      return;
    }
    if (voice.id.startsWith('cycle-') && Number.isFinite(cycles) && cycles > 0) {
      const handler = createCycleVoiceHandler({ numerator, denominator, cycles });
      if (handler) voiceHighlightHandlers.set(voice.id, handler);
    }
  });
}

function createCycleVoiceHandler({ numerator, denominator, cycles }) {
  const totalCycles = Math.max(1, Math.floor(cycles));
  const epsilon = 1e-6;
  return ({ index } = {}) => {
    if (!isPlaying) return;
    const rawIndex = Number(index);
    if (!Number.isFinite(rawIndex) || rawIndex < 0) return;
    const perCycle = Math.max(1, Math.floor(denominator));
    const cycleIndex = totalCycles > 0
      ? Math.floor(Math.floor(rawIndex / perCycle) % totalCycles)
      : Math.floor(rawIndex / perCycle);
    const subdivisionIndex = ((rawIndex % perCycle) + perCycle) % perCycle;
    const fractionalStep = numerator * cycleIndex + (numerator / perCycle) * subdivisionIndex;
    if (Math.abs(fractionalStep - Math.round(fractionalStep)) <= epsilon) {
      return;
    }
    highlightCycle({
      cycleIndex,
      subdivisionIndex,
      numerator,
      denominator: perCycle,
      totalCycles,
      totalSubdivisions: perCycle
    });
  };
}

function handleVoiceEvent(event = {}) {
  if (!event || !event.id) return;
  const handler = voiceHighlightHandlers.get(event.id);
  if (typeof handler === 'function') {
    handler(event);
  }
}
const selectedPulses = new Set();
let isPlaying = false;
let loopEnabled = false;
let isUpdating = false;     // evita bucles de 'input' reentrants
let circularTimeline = false;
const T_INDICATOR_TRANSITION_DELAY = 650;
let tIndicatorRevealHandle = null;
let visualSyncHandle = null;
let lastVisualStep = null;
let lastNormalizedStep = null;
// Progress is now driven directly from audio callbacks
// Progress is now driven directly from audio callbacks

// Build structured markup for the pulse sequence so only inner numbers are editable
function buildPulseSeqMarkup({ root, initialText }) {
  if (!root) return { editEl: null };
  root.textContent = '';
  const mk = (cls, txt) => {
    const span = document.createElement('span');
    span.className = `pz ${cls}`;
    if (txt != null) span.textContent = txt;
    return span;
  };

  const prefix = mk('prefix', 'Pfr ');

  const hostWrapper = fractionInlineSlot;
  const fractionWrapper = hostWrapper ?? (() => {
    const span = document.createElement('span');
    span.className = 'pz fraction fraction-inline-container';
    pulseSeqFractionWrapper = span;
    return span;
  })();
  const fractionDisplay = hostWrapper
    ? hostWrapper
    : fractionWrapper;
  pulseSeqFractionNumeratorEl = null;
  pulseSeqFractionDenominatorEl = null;

  const openParen = mk('open', ' (');
  const zero = mk('zero', '0');
  const editWrapper = mk('edit-wrapper', null);
  pulseSeqEditWrapper = editWrapper;
  const edit = mk('edit', initialText);
  edit.contentEditable = 'true';
  edit.addEventListener('focus', () => {
    root.classList.add('editing');
  });
  edit.addEventListener('blur', () => {
    root.classList.remove('editing');
  });
  editWrapper.append(edit);
  pulseSeqVisualEl = document.createElement('span');
  pulseSeqVisualEl.className = 'pz edit-display';
  pulseSeqVisualEl.setAttribute('aria-hidden', 'true');
  editWrapper.append(pulseSeqVisualEl);
  const suffix = mk('suffix', ')');
  const suffixSpacer = mk('suffix-spacer', ' ');
  const lgLabel = mk('lg', '');

  root.append(prefix, fractionDisplay, openParen, zero, editWrapper, suffix, suffixSpacer, lgLabel);
  updatePulseSeqFractionDisplay(null, null);
  updatePulseSeqVisualLayer(initialText);
  edit.addEventListener('input', () => updatePulseSeqVisualLayer(getPulseSeqText()));
  return { editEl: edit };
}
initFractionEditorController();

// Highlight overlay for pulse sequence numbers during playback
// Highlight overlays are managed by the shared pulse sequence controller

// Helpers for #pulseSeq (use inner span .pz.edit)
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

function normalizePulseSeqEditGaps(text) {
  if (typeof text !== 'string') return '  ';
  const trimmed = text.trim();
  if (!trimmed) return '  ';
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  return tokens.length ? `  ${tokens.join('  ')}  ` : '  ';
}

function updatePulseSeqVisualLayer(text) {
  if (!pulseSeqVisualEl) return;
  const normalized = typeof text === 'string' ? text : '';
  const displayText = normalized.replace(/\s+$/u, '');
  const fragment = document.createDocumentFragment();
  const tokenRegex = /\d+\.\d+|\.\d+|\d+/g;
  let lastIndex = 0;
  displayText.replace(tokenRegex, (match, offset) => {
    if (offset > lastIndex) {
      fragment.append(document.createTextNode(displayText.slice(lastIndex, offset)));
    }
    const span = document.createElement('span');
    span.className = 'pulse-seq-token';
    if (match.includes('.')) {
      span.classList.add('pulse-seq-token--fraction');
    } else {
      span.classList.add('pulse-seq-token--integer');
    }
    span.textContent = match;
    fragment.append(span);
    lastIndex = offset + match.length;
    return match;
  });
  if (lastIndex < displayText.length) {
    fragment.append(document.createTextNode(displayText.slice(lastIndex)));
  }
  pulseSeqVisualEl.textContent = '';
  pulseSeqVisualEl.append(fragment);
  syncPulseSeqTokenMap();
  schedulePulseSeqSpacingAdjust();
}

function syncPulseSeqTokenMap() {
  fractionStore.pulseSeqTokenMap.clear();
  if (!pulseSeqVisualEl) return;
  const tokens = pulseSeqVisualEl.querySelectorAll('.pulse-seq-token');
  fractionStore.pulseSeqEntryOrder.forEach((key, index) => {
    if (!key) return;
    const token = tokens[index];
    if (!token) return;
    token.dataset.entryKey = key;
    fractionStore.pulseSeqTokenMap.set(key, token);
    const info = fractionStore.pulseSeqEntryLookup.get(key);
    if (!info) return;
    if (info.type === 'fraction') {
      token.dataset.fractionKey = key;
      if (Number.isFinite(info.value)) {
        token.dataset.value = String(info.value);
      }
    } else if (info.type === 'int') {
      token.dataset.index = String(info.value);
    }
  });
}

function schedulePulseSeqSpacingAdjust() {
  if (!pulseSeqEditWrapper) return;
  if (fractionStore.spacingAdjustHandle != null) {
    caf(fractionStore.spacingAdjustHandle);
  }
  fractionStore.spacingAdjustHandle = raf(() => {
    fractionStore.spacingAdjustHandle = null;
    adjustPulseSeqSpacing();
  });
}

function adjustPulseSeqSpacing() {
  if (!pulseSeqEditWrapper) return;
  const edit = getEditEl();
  const node = edit && edit.firstChild;
  if (!node || node.nodeType !== TEXT_NODE_TYPE) {
    pulseSeqEditWrapper.style.removeProperty('--pulse-seq-trailing-offset');
    return;
  }
  const text = node.textContent || '';
  let trailingSpaces = 0;
  for (let i = text.length - 1; i >= 0; i--) {
    if (text[i] === ' ') trailingSpaces++;
    else break;
  }
  if (trailingSpaces <= 0) {
    pulseSeqEditWrapper.style.removeProperty('--pulse-seq-trailing-offset');
    return;
  }
  try {
    const range = document.createRange();
    range.setStart(node, Math.max(0, text.length - trailingSpaces));
    range.setEnd(node, text.length);
    const rect = range.getBoundingClientRect();
    const width = rect ? rect.width : 0;
    if (!Number.isFinite(width) || width <= 0) {
      pulseSeqEditWrapper.style.removeProperty('--pulse-seq-trailing-offset');
      return;
    }
    pulseSeqEditWrapper.style.setProperty('--pulse-seq-trailing-offset', `${-width}px`);
  } catch {
    pulseSeqEditWrapper.style.removeProperty('--pulse-seq-trailing-offset');
  }
}

function updatePulseSeqFractionDisplay(numerator, denominator, { silent = false } = {}) {
  if (fractionEditorController) {
    const updates = {};
    if (numerator !== undefined) updates.numerator = numerator;
    if (denominator !== undefined) updates.denominator = denominator;
    fractionEditorController.setFraction(updates, { silent: true, persist: false });
    if (!silent) refreshFractionUI({ reveal: true });
    return;
  }
  if (numeratorInput) {
    numeratorInput.value = Number.isFinite(numerator) && numerator > 0 ? String(numerator) : '';
  }
  if (denominatorInput) {
    denominatorInput.value = Number.isFinite(denominator) && denominator > 0 ? String(denominator) : '';
  }
}

// Caret movement entre midpoints (dos espacios)
function getMidpoints(text){ const a=[]; for(let i=1;i<text.length;i++) if(text[i-1]===' '&&text[i]===' ') a.push(i); return a; }
function moveCaretToNearestMidpoint() {
  pulseSeqController.moveCaretToNearestMidpoint();
}
function moveCaretStep(dir) {
  pulseSeqController.moveCaretStep(dir);
}
function updateTIndicatorText(value) {
  if (!tIndicator) return;
  // Only the number, no prefix
  if (value === '' || value == null) { tIndicator.textContent = ''; return; }
  const n = Number(value);
  if (!Number.isFinite(n)) { tIndicator.textContent = String(value); return; }
  // keep same rounding used for input T
  const rounded = Math.round(n * 10) / 10;
  tIndicator.textContent = String(rounded);
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

const { updatePulseNumbers, layoutTimeline } = createTimelineRenderer({
  timeline,
  timelineWrapper,
  getLg: () => (pulses.length > 0 ? pulses.length - 1 : 0),
  getPulses: () => pulses,
  getBars: () => bars,
  getCycleMarkers: () => cycleMarkers,
  getCycleLabels: () => cycleLabels,
  getPulseNumberLabels: () => pulseNumberLabels,
  setPulseNumberLabels: (labels) => { pulseNumberLabels = labels; },
  computeNumberFontRem,
  pulseNumberHideThreshold: PULSE_NUMBER_HIDE_THRESHOLD,
  numberCircleOffset: NUMBER_CIRCLE_OFFSET,
  isCircularEnabled: () => circularTimeline && loopEnabled,
  scheduleIndicatorReveal: scheduleTIndicatorReveal,
  tIndicatorTransitionDelay: T_INDICATOR_TRANSITION_DELAY,
  requestAnimationFrame: raf,
  callbacks: {
    onAfterCircularLayout: (context) => {
      const { centerX, centerY, radius, angleForIndex, angleForPosition, cycleMarkers: markerList } = context;

      pulseHits.forEach((hit, idx) => {
        if (!hit) return;
        const angle = angleForIndex(idx);
        const hx = centerX + radius * Math.cos(angle);
        const hy = centerY + radius * Math.sin(angle);
        hit.style.left = `${hx}px`;
        hit.style.top = `${hy}px`;
        hit.style.transform = 'translate(-50%, -50%)';
      });

      markerList.forEach((marker) => {
        if (!marker) return;
        const key = marker.dataset && marker.dataset.fractionKey;
        if (!key || !fractionStore.hitMap.has(key)) return;
        const pos = Number(marker.dataset.position);
        if (!Number.isFinite(pos)) return;
        const angle = angleForPosition(pos);
        const mx = centerX + radius * Math.cos(angle);
        const my = centerY + radius * Math.sin(angle);
        const hit = fractionStore.hitMap.get(key);
        if (hit) {
          hit.style.left = `${mx}px`;
          hit.style.top = `${my}px`;
          hit.style.transform = 'translate(-50%, -50%)';
        }
      });

      restoreCycleLabelDisplay();
      schedulePulseSeqSpacingAdjust();
    },
    onAfterLinearLayout: (context) => {
      const { percentForIndex, percentForPosition, cycleMarkers: markerList, lg } = context;

      pulseHits.forEach((hit, idx) => {
        if (!hit) return;
        const percent = percentForIndex(idx);
        hit.style.left = `${percent}%`;
        hit.style.top = '50%';
        hit.style.transform = 'translate(-50%, -50%)';
      });

      markerList.forEach((marker) => {
        if (!marker) return;
        const key = marker.dataset && marker.dataset.fractionKey;
        if (!key || !fractionStore.hitMap.has(key)) return;
        const pos = Number(marker.dataset.position);
        if (!Number.isFinite(pos)) return;
        const percent = percentForPosition(pos);
        const hit = fractionStore.hitMap.get(key);
        if (hit) {
          hit.style.left = `${percent}%`;
          hit.style.top = '50%';
          hit.style.transform = 'translate(-50%, -50%)';
        }
      });

      applyCycleLabelCompaction({ lg });
    },
    onAfterLayout: () => {
      schedulePulseSeqSpacingAdjust();
    }
  }
});

function getSelectionInfo(target) {
  if (!target) return null;
  if (typeof target.dataset.index !== 'undefined') {
    const idx = parseIntSafe(target.dataset.index);
    if (Number.isFinite(idx)) {
      // Validar que el pulso es seleccionable según la fracción activa
      const lg = parseIntSafe(inputLg.value);
      const { numerator, denominator } = getFraction();
      if (!isIntegerPulseSelectable(idx, numerator, denominator, lg)) {
        return null; // Bloquear pulsos no seleccionables
      }
      const key = `pulse:${idx}`;
      return { type: 'int', index: idx, selectionKey: key, key };
    }
  }
  if (target.dataset.fractionKey) {
    const info = getFractionInfoFromElement(target);
    if (info) {
      const selectionKey = `fraction:${info.key}`;
      return { ...info, selectionKey };
    }
  }
  return null;
}

function isSelectionActive(info) {
  if (!info) return false;
  if (info.type === 'fraction') {
    return fractionStore.selectionState.has(info.key);
  }
  if (info.type === 'int') {
    const lg = parseIntSafe(inputLg.value);
    if (!Number.isFinite(lg)) return false;
    if (info.index === 0 || info.index === lg) {
      return loopEnabled;
    }
    ensurePulseMemory(Math.max(info.index, lg));
    return !!pulseMemory[info.index];
  }
  return false;
}

function applySelectionInfo(info, shouldSelect) {
  if (!info) return;
  if (info.type === 'fraction') {
    setFractionSelected(info, shouldSelect);
  } else if (info.type === 'int') {
    setPulseSelected(info.index, shouldSelect);
  }
}

function toggleSelectionInfo(info) {
  if (!info) return;
  const active = isSelectionActive(info);
  applySelectionInfo(info, !active);
}

function attachSelectionListeners(el) {
  if (!el) return;
  el.addEventListener('click', (ev) => {
    const info = getSelectionInfo(ev.currentTarget);
    if (!info) return;
    const suppressionKey = info.selectionKey ?? info.key;
    if (dragController.consumeSuppressClick(suppressionKey)) {
      ev.preventDefault();
      ev.stopPropagation();
      return;
    }
    toggleSelectionInfo(info);
  });
  el.addEventListener('pointerenter', () => {
    const info = getSelectionInfo(el);
    if (!info) return;
    dragController.handleEnter(info);
  });
}

dragController.attach({
  timeline,
  resolveTarget: ({ target }) => {
    const base = target?.closest('.pulse-hit, .pulse, .fraction-hit, .cycle-marker');
    const info = getSelectionInfo(base);
    if (!info) return null;
    if (info.type === 'int') {
      const lg = parseIntSafe(inputLg.value);
      if (!Number.isFinite(lg) || info.index === 0 || info.index === lg) {
        return null;
      }
      // Validar que el pulso es seleccionable según la fracción activa
      const { numerator, denominator } = getFraction();
      if (!isIntegerPulseSelectable(info.index, numerator, denominator, lg)) {
        return null; // Bloquear drag en pulsos no seleccionables
      }
      ensurePulseMemory(Math.max(info.index, lg));
    }
    return info;
  },
  applySelection: (info, shouldSelect) => {
    applySelectionInfo(info, shouldSelect);
  },
  isSelectionActive: (info) => isSelectionActive(info)
});
// Hovers for LEDs and controls
// LEDs ahora indican los campos editables; el apagado se recalcula
attachHover(playBtn, { text: 'Play / Stop' });
attachHover(loopBtn, { text: 'Loop' });
attachHover(tapBtn, { text: 'Tap Tempo' });
attachHover(resetBtn, { text: 'Reset App' });
attachHover(randomBtn, { text: 'Aleatorizar parámetros' });
attachHover(randLgToggle, { text: 'Aleatorizar Lg' });
attachHover(randLgMin, { text: 'Mínimo Lg' });
attachHover(randLgMax, { text: 'Máximo Lg' });
attachHover(randVToggle, { text: 'Aleatorizar V' });
attachHover(randVMin, { text: 'Mínimo V' });
attachHover(randVMax, { text: 'Máximo V' });
attachHover(randPulsesToggle, { text: 'Aleatorizar pulsos' });
attachHover(randomCount, { text: 'Cantidad de pulsos a seleccionar (vacío = aleatorio, 0 = ninguno)' });
attachHover(randNToggle, { text: 'Aleatorizar numerador' });
attachHover(randNMin, { text: 'Mínimo numerador' });
attachHover(randNMax, { text: 'Máximo numerador' });
attachHover(randDToggle, { text: 'Aleatorizar denominador' });
attachHover(randDMin, { text: 'Mínimo denominador' });
attachHover(randDMax, { text: 'Máximo denominador' });
attachHover(randComplexToggle, { text: 'Permitir fracciones complejas' });
if (pulseToggleBtn) attachHover(pulseToggleBtn, { text: 'Activar o silenciar el pulso' });
if (selectedToggleBtn) attachHover(selectedToggleBtn, { text: 'Activar o silenciar la selección' });
if (cycleToggleBtn) attachHover(cycleToggleBtn, { text: 'Activar o silenciar la subdivisión' });


const PULSE_AUDIO_KEY = 'pulseAudio';
const SELECTED_AUDIO_KEY = 'selectedAudio';
const CYCLE_AUDIO_KEY = 'cycleAudio';

let pulseToggleController = null;
let selectedToggleController = null;
let cycleToggleController = null;

const soloMutedChannels = new Set();
let lastSoloActive = false;

const audioToggleManager = initAudioToggles({
  toggles: [
    {
      id: 'pulse',
      button: pulseToggleBtn,
      storageKey: PULSE_AUDIO_KEY,
      mixerChannel: 'pulse',
      defaultEnabled: true,
      onChange: (enabled) => {
        if (audio && typeof audio.setPulseEnabled === 'function') {
          audio.setPulseEnabled(enabled);
        }
      }
    },
    {
      id: 'accent',
      button: selectedToggleBtn,
      storageKey: SELECTED_AUDIO_KEY,
      mixerChannel: 'accent',
      defaultEnabled: true
    },
    {
      id: 'cycle',
      button: cycleToggleBtn,
      storageKey: CYCLE_AUDIO_KEY,
      mixerChannel: 'subdivision',
      defaultEnabled: true,
      onChange: (enabled) => {
        if (audio && typeof audio.setCycleEnabled === 'function') {
          audio.setCycleEnabled(enabled);
        }
      }
    }
  ],
  storage: {
    load: loadOpt,
    save: saveOpt
  },
  mixer: globalMixer,
  subscribeMixer,
  onMixerSnapshot: ({ snapshot, channels, setFromMixer, getState }) => {
    if (!snapshot || !Array.isArray(snapshot.channels)) return;
    const soloActive = snapshot.channels.some((channel) => channel.solo);
    const channelPairs = [
      ['pulse', 'pulse'],
      ['accent', 'accent'],
      ['cycle', 'subdivision']
    ];
    const toggleByChannel = new Map(channelPairs.map(([toggleId, channelId]) => [channelId, toggleId]));

    channelPairs.forEach(([toggleId, channelId]) => {
      const channelState = channels.get(channelId);
      if (!channelState) return;
      const forcedBySolo = soloActive && !channelState.solo && channelState.effectiveMuted && !channelState.muted;
      if (forcedBySolo) {
        if (!soloMutedChannels.has(channelId)) {
          soloMutedChannels.add(channelId);
          setFromMixer(toggleId, false);
        }
        return;
      }

      if (!soloActive && soloMutedChannels.has(channelId)) {
        soloMutedChannels.delete(channelId);
        setFromMixer(toggleId, true);
        return;
      }

      if (soloActive && soloMutedChannels.has(channelId)) {
        return;
      }

      const shouldEnable = !channelState.muted;
      if (getState(toggleId) === shouldEnable) return;
      setFromMixer(toggleId, shouldEnable);
    });

    if (!soloActive && lastSoloActive && soloMutedChannels.size) {
      soloMutedChannels.forEach((channelId) => {
        const toggleId = toggleByChannel.get(channelId);
        if (toggleId) setFromMixer(toggleId, true);
      });
      soloMutedChannels.clear();
    }

    lastSoloActive = soloActive;
  }
});

pulseToggleController = audioToggleManager.get('pulse') ?? null;
selectedToggleController = audioToggleManager.get('accent') ?? null;
cycleToggleController = audioToggleManager.get('cycle') ?? null;

function setPulseAudio(value, options) {
  pulseToggleController?.set(value, options);
}

function setSelectedAudio(value, options) {
  selectedToggleController?.set(value, options);
}

function setCycleAudio(value, options) {
  cycleToggleController?.set(value, options);
}

const storedColor = loadOpt('color');
if (storedColor) {
  selectColor.value = storedColor;
  document.documentElement.style.setProperty('--selection-color', storedColor);
}
selectColor.addEventListener('input', e => {
  document.documentElement.style.setProperty('--selection-color', e.target.value);
  saveOpt('color', e.target.value);
});

updatePulseNumbers();

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
  layoutTimeline();
});
// Keep T indicator anchored on window resizes
window.addEventListener('resize', updateTIndicatorPosition);
window.addEventListener('resize', schedulePulseSeqSpacingAdjust);
layoutTimeline();

// Initialize loop controller with shared component
loopController.attach();

resetBtn.addEventListener('click', () => {
  pulseMemoryApi.clear();
  clearOpt(FRACTION_NUMERATOR_KEY);
  clearOpt(FRACTION_DENOMINATOR_KEY);
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
/**
 * Apply random values within the configured ranges and update inputs accordingly.
 */
function randomize() {
  const cfg = randomConfig || randomDefaults;
  const randomRanges = {};
  if (cfg.Lg?.enabled) {
    const [lo, hi] = cfg.Lg.range ?? randomDefaults.Lg.range;
    randomRanges.Lg = { min: lo, max: hi };
  }
  if (cfg.V?.enabled) {
    const [lo, hi] = cfg.V.range ?? randomDefaults.V.range;
    randomRanges.V = { min: lo, max: hi };
  }
  if (cfg.n?.enabled) {
    let [min, max] = cfg.n.range ?? randomDefaults.n.range;
    if (!cfg.allowComplex) {
      min = 1;
      max = 1;
    }
    randomRanges.n = { min, max };
  }
  if (cfg.d?.enabled) {
    const [min, max] = cfg.d.range ?? randomDefaults.d.range;
    randomRanges.d = { min, max };
  }

  const randomized = randomizeValues(randomRanges);

  if (cfg.Lg?.enabled && inputLg) {
    const [lo, hi] = cfg.Lg.range ?? randomDefaults.Lg.range;
    const value = Math.max(lo, Math.min(hi, randomized.Lg ?? lo));
    setValue(inputLg, value);
    handleInput({ target: inputLg });
  }
  if (cfg.V?.enabled && inputV) {
    const [lo, hi] = cfg.V.range ?? randomDefaults.V.range;
    const value = Math.max(lo, Math.min(hi, randomized.V ?? lo));
    setValue(inputV, value);
    handleInput({ target: inputV });
  }

  const fractionUpdates = {};
  if (cfg.n?.enabled) {
    const [min, max] = cfg.n.range ?? randomDefaults.n.range;
    const bounded = cfg.allowComplex ? [min, max] : [1, 1];
    const randomValue = randomized.n ?? bounded[0];
    fractionUpdates.numerator = Math.max(1, Math.min(bounded[1], randomValue));
  }
  if (cfg.d?.enabled) {
    const [min, max] = cfg.d.range ?? randomDefaults.d.range;
    const randomValue = randomized.d ?? min;
    fractionUpdates.denominator = Math.max(1, Math.min(max, randomValue));
  }
  if (fractionEditorController && Object.keys(fractionUpdates).length > 0) {
    fractionEditorController.setFraction(fractionUpdates, { cause: 'randomize' });
  } else if (Object.keys(fractionUpdates).length > 0) {
    if (fractionUpdates.numerator != null && numeratorInput) {
      setValue(numeratorInput, fractionUpdates.numerator);
    }
    if (fractionUpdates.denominator != null && denominatorInput) {
      setValue(denominatorInput, fractionUpdates.denominator);
    }
    refreshFractionUI({ reveal: true });
    handleInput();
  }

  if (cfg.Pulses?.enabled) {
    // Reset persistent selection memory so old pulses don't reappear when Lg grows
    clearPersistentPulses();
    const lg = parseInt(inputLg.value);
    if (!isNaN(lg) && lg > 0) {
      ensurePulseMemory(lg);
      const rawCount = randomCount && typeof randomCount.value === 'string' ? randomCount.value.trim() : '';

      // Obtener la fracción actual para filtrar pulsos seleccionables
      const { numerator, denominator } = getFraction();
      const available = [];
      for (let i = 1; i < lg; i++) {
        // Solo añadir pulsos que sean seleccionables según la fracción activa
        if (isIntegerPulseSelectable(i, numerator, denominator, lg)) {
          available.push(i);
        }
      }

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
          while (selected.size < target && available.length > 0) {
            const idx = available[Math.floor(Math.random() * available.length)];
            selected.add(idx);
          }
        }
        // For parsed <= 0, keep selection empty (0 pulses)
      }
      const seq = Array.from(selected).sort((a, b) => a - b);
      for (let i = 1; i < lg; i++) pulseMemory[i] = false;
      seq.forEach(i => { pulseMemory[i] = true; });
      syncSelectedFromMemory();
      updatePulseNumbers();
      layoutTimeline({ silent: true });

      const applied = applyRandomFractionSelection(fractionStore, {
        lg,
        randomCountValue: rawCount,
        parseIntSafe,
        nearestPulseIndex
      });
      rebuildFractionSelections();
      if (applied && isPlaying) {
        applySelectionToAudio();
      }
    }
  }
}

initRandomMenu(randomBtn, randomMenu, randomize);

// All sound dropdowns (including cycleSoundSelect) are initialized by header.js via initHeader()
// No app-specific initialization needed

// Preview on sound change handled by shared header

// Create standardized audio initializer that avoids AudioContext warnings
const _baseInitAudio = createRhythmAudioInitializer({
  getSoundSelects: () => ({
    baseSoundSelect: elements.baseSoundSelect,
    startSoundSelect: elements.startSoundSelect,
    accentSoundSelect: elements.accentSoundSelect,
    cycleSoundSelect: elements.cycleSoundSelect
  }),
  schedulingBridge,
  channels: [
    {
      id: 'accent',
      options: { allowSolo: true, label: 'Seleccionado' },
      assignment: 'accent'
    }
  ]
});

async function initAudio() {
  if (!audio) {
    audio = await _baseInitAudio();

    // Apply App4-specific configurations after initialization
    if (typeof audio.setVoiceHandler === 'function') {
      audio.setVoiceHandler(handleVoiceEvent);
    }
    if (typeof audio.setPulseEnabled === 'function') {
      const pulseEnabled = pulseToggleController?.isEnabled() ?? true;
      audio.setPulseEnabled(pulseEnabled);
    }
    if (typeof audio.setCycleEnabled === 'function') {
      const cycleEnabled = cycleToggleController?.isEnabled() ?? true;
      audio.setCycleEnabled(cycleEnabled);
    }
    if (typeof audio.setLoop === 'function') {
      audio.setLoop(loopEnabled);
    }
    const savedMute = loadOpt('mute');
    if (savedMute === '1' && typeof audio.setMute === 'function') {
      audio.setMute(true);
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

getEditEl()?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const res = sanitizePulseSeq({ causedBy: 'enter' });
    // Oculta el caret al confirmar excepto si hubo números > Lg o fracciones inválidas
    if (!res || (!res.hadTooBig && !res.hadFractionTooBig)) {
      try { getEditEl()?.blur(); } catch {}
    }
    return;
  }
  if (e.key === 'ArrowLeft' || e.key === 'Home') { e.preventDefault(); moveCaretStep(-1); return; }
  if (e.key === 'ArrowRight' || e.key === 'End') { e.preventDefault(); moveCaretStep(1); return; }
  // Allow only digits, navegación y espacio (para introducir varios pulsos)
  const allowed = new Set(['Backspace','Delete','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','Tab',' ']);
  if (!/^[0-9]$/.test(e.key) && e.key !== '.' && !allowed.has(e.key)) {
    e.preventDefault();
    return;
  }
  if (e.key === ' ') {
    e.preventDefault();
    const el = getEditEl(); if (!el) return; const node = el.firstChild || el; let text = node.textContent || '';
    const sel = window.getSelection && window.getSelection(); if(!sel||sel.rangeCount===0) return; const rng = sel.getRangeAt(0); if(!el.contains(rng.startContainer)) return;
    const pos = Math.max(0, Math.min(rng.startOffset, text.length));
    const left = text.slice(0, pos);
    const right = text.slice(pos);
    const out = left + '  ' + right;
    const normalizedOut = normalizePulseSeqEditGaps(out);
    node.textContent = normalizedOut;
    updatePulseSeqVisualLayer(normalizedOut);
    const mids = getMidpoints(normalizedOut);
    if (mids.length) {
      const target = mids.find(m => m >= pos + 1) ?? mids[mids.length - 1];
      setPulseSeqSelection(target, target);
      try { moveCaretToNearestMidpoint(); } catch {}
    } else {
      setPulseSeqSelection(0, 0);
    }
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
    const isDigit = (c) => c >= '0' && c <= '9';
    let i = pos - 1;
    while (i >= 0 && text[i] === ' ') i--;
    if (i < 0) return; // no hay número a la izquierda
    if (!(isDigit(text[i]) || text[i] === '.')) return;
    const endNum = i + 1;
    let startNum = i;
    while (startNum >= 0 && isDigit(text[startNum])) startNum--;
    if (startNum >= 0 && text[startNum] === '.') {
      startNum--;
      while (startNum >= 0 && isDigit(text[startNum])) startNum--;
    }
    startNum = Math.max(0, startNum + 1);
    // Construimos: izquierda hasta startNum + '  ' + derecha saltando el espacio derecho del midpoint
    const left = text.slice(0,startNum);
    const right = text.slice(pos+1); // saltar un espacio (el derecho del midpoint)
    const out = (left + '  ' + right);
    const normalizedOut = normalizePulseSeqEditGaps(out);
    node.textContent = normalizedOut;
    updatePulseSeqVisualLayer(normalizedOut);
    const caret = Math.min(normalizedOut.length, left.length + 1);
    setPulseSeqSelection(caret, caret);
    try { moveCaretToNearestMidpoint(); } catch {}
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
    const isDigit = (c) => c >= '0' && c <= '9';
    let k = pos; while(k<text.length && text[k]===' ') k++;
    if (k >= text.length) return;
    if (!(isDigit(text[k]) || text[k] === '.')) return;
    let end = k;
    let dotConsumed = false;
    if (text[end] === '.') {
      dotConsumed = true;
      end++;
    }
    while (end < text.length) {
      const ch = text[end];
      if (isDigit(ch)) {
        end++;
        continue;
      }
      if (ch === '.' && !dotConsumed) {
        dotConsumed = true;
        end++;
        continue;
      }
      break;
    }
    // Espacios tras el número: saltar hasta 2 para no duplicar separadores
    let s=0; while(end+s<text.length && text[end+s]===' ') s++;
    const left = text.slice(0, pos-1); // elimina el espacio izquierdo del midpoint
    const right = text.slice(end + Math.min(s,2));
    const out = left + '  ' + right;
    const normalizedOut = normalizePulseSeqEditGaps(out);
    node.textContent = normalizedOut;
    updatePulseSeqVisualLayer(normalizedOut);
    const caret = Math.min(normalizedOut.length, left.length + 1);
    setPulseSeqSelection(caret, caret);
    try { moveCaretToNearestMidpoint(); } catch {}
    return;
  }
});
getEditEl()?.addEventListener('blur', () => sanitizePulseSeq({ causedBy: 'blur' }));
// Visual gap hint under caret (does not modify text)
getEditEl()?.addEventListener('mouseup', ()=> setTimeout(moveCaretToNearestMidpoint,0));
// (Sin manejador en keyup para evitar doble salto)
getEditEl()?.addEventListener('focus', ()=> setTimeout(()=>{
  const el = getEditEl(); if(!el) return;
  const node = el.firstChild || el; let text = node.textContent || '';
  if(text.length === 0){
    text = '  ';
  } else {
    const normalized = normalizePulseSeqEditGaps(text);
    if (normalized !== text) text = normalized;
  }
  node.textContent = text;
  updatePulseSeqVisualLayer(text);
  moveCaretToNearestMidpoint();
},0));

function setValue(input, value){
  isUpdating = true;
  input.value = String(value);
  isUpdating = false;
}

function parseNum(val){
  if (typeof val !== 'string') return Number(val);
  let s = val.trim();
  // Si hi ha coma i no hi ha punt: format català “1.234,56” → traiem punts (milers) i passem coma a punt
  if (s.includes(',') && !s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    // En la resta de casos, NO esborrem punts (poden ser decimals); només canviem comes per punts
    s = s.replace(/,/g, '.');
  }
  const n = parseFloat(s);
    return isNaN(n) ? NaN : n;
}
function formatNumberValue(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '';
  const rounded = Math.round(numeric * 100) / 100;
  return rounded.toLocaleString('ca-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

function formatSec(n){
  return formatNumberValue(n);
}

function formatBpmValue(value) {
  return formatNumberValue(value);
}

function formatInteger(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '';
  return Math.round(numeric).toLocaleString('ca-ES');
}

let titleInfoTipEl = null;

function ensureTitleInfoTip() {
  if (titleInfoTipEl) return titleInfoTipEl;
  const tip = document.createElement('div');
  tip.className = 'hover-tip auto-tip-below top-bar-info-tip';
  document.body.appendChild(tip);
  titleInfoTipEl = tip;
  return tip;
}

function hideTitleInfoTip() {
  if (titleInfoTipEl) {
    titleInfoTipEl.classList.remove('show');
  }
}

function showTitleInfoTip(contentFragment, anchor) {
  if (!anchor) return;
  const tip = ensureTitleInfoTip();
  if (contentFragment) {
    tip.replaceChildren(contentFragment);
  }
  const rect = anchor.getBoundingClientRect();
  tip.style.left = rect.left + rect.width / 2 + 'px';
  tip.style.top = rect.bottom + window.scrollY + 'px';
  tip.classList.add('show');
}

function buildTitleInfoContent() {
  const fragment = document.createDocumentFragment();

  const lgValue = parseIntSafe(inputLg?.value);
  const hasLg = Number.isFinite(lgValue) && lgValue > 0;
  const { numerator, denominator } = getFraction();
  const hasNumerator = Number.isFinite(numerator) && numerator > 0;
  const hasDenominator = Number.isFinite(denominator) && denominator > 0;
  const tValue = parseNum(inputT?.value ?? '');
  const hasT = Number.isFinite(tValue) && tValue > 0;

  if (hasLg) {
    const pulsesLine = document.createElement('p');
    pulsesLine.className = 'top-bar-info-tip__line';
    const pulsesLabel = document.createElement('strong');
    pulsesLabel.textContent = 'Pulsos enteros (Lg):';
    pulsesLine.append(pulsesLabel, ' ', formatInteger(lgValue));
    fragment.append(pulsesLine);

    if (hasNumerator && hasDenominator) {
      const fractionalLg = (lgValue * denominator) / numerator;
      const lgLine = document.createElement('p');
      lgLine.className = 'top-bar-info-tip__line';
      const lgLabel = document.createElement('strong');
      lgLabel.textContent = 'Pulsos fraccionados (Lg·d/n):';
      lgLine.append(lgLabel, ' ', formatNumberValue(fractionalLg));
      fragment.append(lgLine);
    }

  } else {
    const hint = document.createElement('p');
    hint.className = 'top-bar-info-tip__line';
    hint.textContent = 'Define una Lg válida para contar los Pfr.';
    fragment.append(hint);
  }

  const tempoValue = parseNum(inputV?.value ?? '');
  const hasTempo = Number.isFinite(tempoValue) && tempoValue > 0;
  const derivedTFromTempo = hasLg && hasTempo ? (lgValue * 60) / tempoValue : null;
  const tempoFromT = hasLg && hasT ? (lgValue / tValue) * 60 : null;
  const effectiveTempo = hasTempo ? tempoValue : tempoFromT;
  const tForBaseFormula = hasT ? tValue : derivedTFromTempo;

  if (hasLg && tForBaseFormula != null && effectiveTempo != null) {
    const baseFormulaLine = document.createElement('p');
    baseFormulaLine.className = 'top-bar-info-tip__line';
    const baseFormulaLabel = document.createElement('strong');
    baseFormulaLabel.textContent = 'V base';
    baseFormulaLine.append(
      baseFormulaLabel,
      ` = (${formatInteger(lgValue)} / ${formatNumberValue(tForBaseFormula)})·60 = ${formatBpmValue(effectiveTempo)} BPM`
    );
    fragment.append(baseFormulaLine);
  } else if (effectiveTempo != null) {
    const baseLine = document.createElement('p');
    baseLine.className = 'top-bar-info-tip__line';
    const baseLabel = document.createElement('strong');
    baseLabel.textContent = 'V base:';
    baseLine.append(baseLabel, ' ', `${formatBpmValue(effectiveTempo)} BPM`);
    fragment.append(baseLine);
  } else if (hasLg && !hasTempo) {
    const hint = document.createElement('p');
    hint.className = 'top-bar-info-tip__hint';
    hint.textContent = 'Completa V para calcular la fórmula de V base.';
    fragment.append(hint);
  }

  if (effectiveTempo != null && hasNumerator && hasDenominator) {
    const fractionTempo = effectiveTempo * (denominator / numerator);
    const fractionFormulaLine = document.createElement('p');
    fractionFormulaLine.className = 'top-bar-info-tip__line';
    const fractionFormulaLabel = document.createElement('strong');
    fractionFormulaLabel.textContent = `V ${numerator}/${denominator}`;
    fractionFormulaLine.append(
      fractionFormulaLabel,
      ` = (${formatBpmValue(effectiveTempo)}·${denominator})/${numerator} = ${formatBpmValue(fractionTempo)} BPM`
    );
    fragment.append(fractionFormulaLine);
  } else {
    const hint = document.createElement('p');
    hint.className = 'top-bar-info-tip__hint';
    hint.textContent = 'Completa V, n y d para obtener la velocidad de la fracción.';
    fragment.append(hint);
  }


    if (hasLg && hasTempo && derivedTFromTempo != null) {
    const tFormulaLine = document.createElement('p');
    tFormulaLine.className = 'top-bar-info-tip__line';
    const tFormulaLabel = document.createElement('strong');
    tFormulaLabel.textContent = 'T';
    tFormulaLine.append(
      tFormulaLabel,
      ` = (${formatInteger(lgValue)} / ${formatBpmValue(tempoValue)})·60 = ${formatNumberValue(derivedTFromTempo)} s`
    );
    fragment.append(tFormulaLine);
  } else if (hasT) {
    const tLine = document.createElement('p');
    tLine.className = 'top-bar-info-tip__line';
    const tLabel = document.createElement('strong');
    tLabel.textContent = 'T:';
    tLine.append(tLabel, ' ', `${formatNumberValue(tValue)} s`);
    fragment.append(tLine);
  }   return fragment;
}

if (titleButton) {
  titleButton.addEventListener('click', () => {
    const content = buildTitleInfoContent();
    if (!content) return;
    showTitleInfoTip(content, titleButton);
  });
  titleButton.addEventListener('blur', hideTitleInfoTip);
  titleButton.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' || event.key === 'Esc') {
      hideTitleInfoTip();
    }
  });
  window.addEventListener('scroll', hideTitleInfoTip, { passive: true });
  window.addEventListener('resize', hideTitleInfoTip);
}

// Long‑press auto‑repeat for spinner buttons
function addRepeatPress(el, fn){
  if (!el) return;
  let t=null, r=null;
  const start = (ev) => {
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
addRepeatPress(inputVUp,   () => stepAndDispatch(inputV, +1));
addRepeatPress(inputVDown, () => stepAndDispatch(inputV, -1));
addRepeatPress(inputLgUp,  () => stepAndDispatch(inputLg, +1));
addRepeatPress(inputLgDown,() => stepAndDispatch(inputLg, -1));

function showPulseSeqAutoTip(html) {
  try {
    const el = getEditEl();
    if (!el) return;
    const tip = document.createElement('div');
    tip.className = 'hover-tip auto-tip-below';
    tip.innerHTML = html;
    document.body.appendChild(tip);
    let rect = null;
    const sel = window.getSelection && window.getSelection();
    if (sel && sel.rangeCount) {
      const r = sel.getRangeAt(0).cloneRange();
      if (el.contains(r.startContainer)) {
        r.collapse(false);
        rect = r.getBoundingClientRect();
      }
    }
    if (!rect) rect = el.getBoundingClientRect();
    if (rect) {
      tip.style.left = rect.left + 'px';
      tip.style.top = (rect.bottom + window.scrollY) + 'px';
    }
    tip.style.fontSize = '0.95rem';
    tip.classList.add('show');
    setTimeout(() => {
      tip.classList.remove('show');
      try { document.body.removeChild(tip); } catch {}
    }, 3000);
  } catch {}
}

function resolvePulseSeqGap(position, lg) {
  const ranges = Object.entries(pulseSeqRanges)
    .map(([key, range]) => ({ key, range, num: Number(key) }))
    .filter(entry => Number.isFinite(entry.num) && Number.isInteger(entry.num))
    .sort((a, b) => a.range[0] - b.range[0]);

  let base = null;
  let next = null;
  let index = 0;
  for (let i = 0; i < ranges.length; i++) {
    const { num, range } = ranges[i];
    if (position > range[1]) {
      base = num;
      index = i + 1;
      continue;
    }
    if (position <= range[0]) {
      next = num;
      break;
    }
  }
  if (base == null) base = 0;
  if (next == null && Number.isFinite(lg)) next = lg;
  return { base, next, index };
}

function sanitizePulseSeq(opts = {}){
  if (!pulseSeqEl) return { hadTooBig: false, hadFractionTooBig: false };
  const lg = parseInt(inputLg.value);
  const caretBefore = (() => {
    const el = getEditEl();
    if (!el) return 0;
    const s = window.getSelection && window.getSelection();
    if (!s || s.rangeCount === 0) return 0;
    const r = s.getRangeAt(0);
    if (!el.contains(r.startContainer)) return 0;
    return r.startOffset;
  })();
  const text = getPulseSeqText();
  const tokenRegex = /\d+\.\d+|\.\d+|\d+/g;
  const tokens = [];
  let match;
  while ((match = tokenRegex.exec(text)) !== null) {
    tokens.push({ raw: match[0], start: match.index });
  }

  const ints = [];
  const seenInts = new Set();
  let hadTooBig = false;
  let firstTooBig = null;

  const fractions = [];
  const seenFractionKeys = new Set();
  let hadFractionTooBig = false;
  let firstFractionTooBig = null;

  const { numerator: rawNumerator, denominator: rawDenominator } = getFraction();
  const denomValue = Number.isFinite(rawDenominator) && rawDenominator > 0 ? rawDenominator : null;
  const numeratorValue = Number.isFinite(rawNumerator) && rawNumerator > 0 ? rawNumerator : null;

  const caretGap = resolvePulseSeqGap(caretBefore, lg);
  fractionStore.lastFractionGap = caretGap;

  const pushFractionEntry = (entry) => {
    if (!entry) return;
    const value = Number(entry.value);
    if (!Number.isFinite(value)) return;
    const nearest = nearestPulseIndex(value);
    if (nearest != null) {
      if (!seenInts.has(nearest)) {
        seenInts.add(nearest);
        ints.push(nearest);
      }
      return;
    }
    fractions.push(entry);
    if (entry.rawLabel) {
      registerFractionLabel(entry.rawLabel, entry);
    }
  };

  for (const token of tokens) {
    const raw = token.raw;
    const normalizedRaw = typeof raw === 'string' ? raw.trim() : '';
    if (raw.includes('.')) {
      let matchedFraction = null;
      if (raw.startsWith('.')) {
        if (!denomValue) continue;
        const digits = raw.slice(1);
        if (!digits) continue;
        const fracNumerator = Number.parseInt(digits, 10);
        if (!Number.isFinite(fracNumerator) || fracNumerator <= 0) continue;
        if (fracNumerator >= denomValue) {
          hadFractionTooBig = true;
          if (firstFractionTooBig == null) firstFractionTooBig = raw;
          continue;
        }
        const gap = resolvePulseSeqGap(token.start, lg);
        const base = Number.isFinite(gap.base) ? gap.base : 0;
        const next = Number.isFinite(gap.next) ? gap.next : (Number.isFinite(lg) ? lg : Infinity);
        if (!Number.isFinite(base)) continue;
        if (!Number.isNaN(lg) && base >= lg) continue;
        const labelCandidate = `${base}.${digits}`;
        matchedFraction = getFractionInfoByLabel(labelCandidate, { base });
        if (matchedFraction && matchedFraction.key) {
          if (!seenFractionKeys.has(matchedFraction.key)) {
            seenFractionKeys.add(matchedFraction.key);
            const entry = {
              base: matchedFraction.base,
              numerator: matchedFraction.numerator,
              denominator: matchedFraction.denominator,
              value: matchedFraction.value,
              display: matchedFraction.display,
              key: matchedFraction.key,
              cycleIndex: matchedFraction.cycleIndex,
              subdivisionIndex: matchedFraction.subdivisionIndex,
              pulsesPerCycle: matchedFraction.pulsesPerCycle,
              rawLabel: normalizedRaw || (typeof matchedFraction.rawLabel === 'string' ? matchedFraction.rawLabel : '')
            };
            pushFractionEntry(entry);
          }
          continue;
        }
        const value = base + fracNumerator / denomValue;
        if (value <= base) continue;
        if (Number.isFinite(next) && value >= next) continue;
        if (!Number.isNaN(lg) && value >= lg) continue;
        const key = makeFractionKey(base, fracNumerator, denomValue);
        if (!key) continue;
        if (!seenFractionKeys.has(key)) {
          seenFractionKeys.add(key);
          const entry = {
            base,
            numerator: fracNumerator,
            denominator: denomValue,
            value,
            display: fractionDisplay(base, fracNumerator, denomValue),
            key,
            cycleIndex: null,
            subdivisionIndex: null,
            pulsesPerCycle: null,
            rawLabel: normalizedRaw
          };
          pushFractionEntry(entry);
        }
      } else {
        const [intPart, fractionDigitsRaw] = raw.split('.', 2);
        const intVal = Number.parseInt(intPart, 10);
        if (!Number.isFinite(intVal) || intVal < 0) continue;
        if (!denomValue) continue;
        const digits = fractionDigitsRaw ?? '';
        if (!digits) continue;
        const subdivisionIndex = Number.parseInt(digits, 10);
        if (!Number.isFinite(subdivisionIndex) || subdivisionIndex <= 0) continue;
        if (subdivisionIndex >= denomValue) {
          hadFractionTooBig = true;
          if (firstFractionTooBig == null) firstFractionTooBig = raw;
          continue;
        }
      matchedFraction = getFractionInfoByLabel(raw) || getFractionInfoByLabel(`${intVal}.${subdivisionIndex}`);
      let normalizedBase = intVal;
      let normalizedNumerator = subdivisionIndex;
      let value = intVal + subdivisionIndex / denomValue;
      let displayOverride = null;
      if (Number.isFinite(numeratorValue) && numeratorValue > 0) {
        const cycleCapacity = Number.isFinite(lg) && lg > 0
          ? Math.floor(lg / numeratorValue)
          : null;
        const rawCycle = intVal / numeratorValue;
        const cycleIndexFromBase = Number.isFinite(rawCycle)
          ? Math.round(rawCycle)
          : null;
        const isCycleApproxInteger = Number.isFinite(cycleIndexFromBase)
          && Math.abs(rawCycle - cycleIndexFromBase) <= FRACTION_POSITION_EPSILON;
        const mapping = isCycleApproxInteger
          ? cycleNotationToFraction(cycleIndexFromBase, subdivisionIndex, numeratorValue, denomValue)
          : null;
        if (mapping) {
          let canonicalBase = Number.isFinite(mapping.base)
            ? Math.floor(mapping.base + FRACTION_POSITION_EPSILON)
            : null;
          let canonicalNumerator = Number.isFinite(mapping.numerator)
              ? Math.round(mapping.numerator)
              : null;
            if (Number.isFinite(canonicalNumerator) && canonicalNumerator >= denomValue) {
              const carry = Math.floor(canonicalNumerator / denomValue);
              canonicalNumerator -= carry * denomValue;
              if (Number.isFinite(canonicalBase)) {
                canonicalBase += carry;
              }
            }
            const numeratorValid = Number.isFinite(canonicalNumerator) && canonicalNumerator > 0 && canonicalNumerator < denomValue;
            const baseValid = Number.isFinite(canonicalBase);
            const canonicalValue = baseValid && numeratorValid
              ? fractionValue(canonicalBase, canonicalNumerator, denomValue)
              : NaN;
            const withinLg = Number.isFinite(canonicalValue)
              ? (!Number.isFinite(lg) || canonicalValue < lg - FRACTION_POSITION_EPSILON)
              : false;
            const cycleBase = Number.isFinite(cycleIndexFromBase) && Number.isFinite(numeratorValue)
              ? cycleIndexFromBase * numeratorValue
              : NaN;
            const cycleOriginValid = Number.isFinite(cycleBase)
              ? (!Number.isFinite(lg) || cycleBase < lg)
              : true;
            const withinCapacity = Number.isFinite(cycleCapacity)
              ? (cycleCapacity > 0 && Number.isFinite(cycleIndexFromBase) && cycleIndexFromBase < cycleCapacity)
              : true;
            if (baseValid && numeratorValid && Number.isFinite(canonicalValue) && withinLg && cycleOriginValid && withinCapacity) {
              normalizedBase = canonicalBase;
              normalizedNumerator = canonicalNumerator;
              value = canonicalValue;
              displayOverride = {
                cycleIndex: isCycleApproxInteger ? cycleIndexFromBase : null,
                subdivisionIndex,
                pulsesPerCycle: numeratorValue
              };
            }
          }
        }
        if (!Number.isFinite(value)) continue;
        if (!Number.isNaN(lg) && value >= lg) {
          hadTooBig = true;
          if (firstTooBig == null) firstTooBig = `${intVal}.${digits}`;
          continue;
        }
        const key = makeFractionKey(normalizedBase, normalizedNumerator, denomValue);
        if (!key) continue;
        if (!seenFractionKeys.has(key)) {
          if (matchedFraction && matchedFraction.key === key) {
            seenFractionKeys.add(key);
            const entry = {
              base: matchedFraction.base,
              numerator: matchedFraction.numerator,
              denominator: matchedFraction.denominator,
              value: matchedFraction.value,
              display: matchedFraction.display,
              key: matchedFraction.key,
              cycleIndex: matchedFraction.cycleIndex,
              subdivisionIndex: matchedFraction.subdivisionIndex,
              pulsesPerCycle: matchedFraction.pulsesPerCycle,
              rawLabel: normalizedRaw || (typeof matchedFraction.rawLabel === 'string' ? matchedFraction.rawLabel : '')
            };
            pushFractionEntry(entry);
            continue;
          }
          seenFractionKeys.add(key);
          const overrideCycleIndex = Number.isFinite(displayOverride?.cycleIndex) && displayOverride.cycleIndex >= 0
            ? Math.floor(displayOverride.cycleIndex)
            : null;
          const overrideSubdivisionIndex = Number.isFinite(displayOverride?.subdivisionIndex) && displayOverride.subdivisionIndex >= 0
            ? Math.floor(displayOverride.subdivisionIndex)
            : null;
          const overridePulsesPerCycle = Number.isFinite(displayOverride?.pulsesPerCycle) && displayOverride.pulsesPerCycle > 0
            ? displayOverride.pulsesPerCycle
            : null;
          const entry = {
            base: normalizedBase,
            numerator: normalizedNumerator,
            denominator: denomValue,
            value,
            display: fractionDisplay(normalizedBase, normalizedNumerator, denomValue, displayOverride || undefined),
            key,
            cycleIndex: overrideCycleIndex,
            subdivisionIndex: overrideSubdivisionIndex,
            pulsesPerCycle: overridePulsesPerCycle,
            rawLabel: normalizedRaw
          };
          pushFractionEntry(entry);
        }
      }
    } else {
      const n = Number.parseInt(raw, 10);
      if (!Number.isFinite(n) || n <= 0) continue;
      if (!Number.isNaN(lg) && n >= lg) {
        hadTooBig = true;
        if (firstTooBig == null) firstTooBig = n;
        continue;
      }
      // Validar que el pulso entero es seleccionable según la fracción activa
      if (!isIntegerPulseSelectable(n, numeratorValue, denomValue, lg)) {
        // Silenciosamente ignorar pulsos no seleccionables (no son errores)
        continue;
      }
      if (!seenInts.has(n)) {
        seenInts.add(n);
        ints.push(n);
      }
    }
  }

  ints.sort((a, b) => a - b);
  fractions.sort((a, b) => a.value - b.value);
  fractionStore.selectionState.clear();
  fractions.forEach(entry => {
    fractionStore.selectionState.set(entry.key, entry);
  });
  rebuildFractionSelections({ skipUpdateField: true });

  const hasValidLg = Number.isFinite(lg) && lg > 0;

  if (hasValidLg) {
    ensurePulseMemory(lg);
    for (let i = 1; i < lg; i++) pulseMemory[i] = false;
    ints.forEach(n => { if (n < lg) pulseMemory[n] = true; });
    renderTimeline();
  } else {
    const combined = [
      ...ints.map(n => ({ value: n, display: String(n), key: String(n) })),
      ...fractions.map(f => {
        const rawLabel = typeof f.rawLabel === 'string' ? f.rawLabel : '';
        const preferred = rawLabel ? rawLabel : f.display;
        return { value: f.value, display: preferred, key: f.key };
      })
    ].sort((a, b) => a.value - b.value);
    pulseSeqRanges = {};
    fractionStore.pulseSeqEntryOrder = combined.map(entry => entry.key);
    fractionStore.pulseSeqEntryLookup.clear();
    combined.forEach((entry) => {
      if (!entry || !entry.key) return;
      const type = entry.display.includes('.') ? 'fraction' : 'int';
      fractionStore.pulseSeqEntryLookup.set(entry.key, { ...entry, type });
    });
    let pos = 0;
    const parts = combined.map(entry => {
      const start = pos + 2;
      const end = start + entry.display.length;
      pulseSeqRanges[entry.key] = [start, end];
      pos += entry.display.length + 2;
      return entry.display;
    });
    setPulseSeqText('  ' + parts.join('  ') + '  ');
  }

  const outText = getPulseSeqText();
  const pos = Math.min(outText.length, caretBefore);
  const editEl = getEditEl();
  const isEditActive = editEl && document.activeElement === editEl;
  const shouldKeepCaret = hadTooBig || hadFractionTooBig || !(opts.causedBy === 'enter' || opts.causedBy === 'blur');
  if (!opts.skipCaret && isEditActive && shouldKeepCaret) {
    setPulseSeqSelection(pos, pos);
    try { moveCaretToNearestMidpoint(); } catch {}
  }

  if (hadTooBig && !Number.isNaN(lg)) {
    const bad = firstTooBig != null ? firstTooBig : '';
    showPulseSeqAutoTip(`El número <strong>${bad}</strong> introducido es mayor que la <span style="color: var(--color-lg); font-weight: 700;">Lg</span>. Elige un número menor que <strong>${lg}</strong>`);
  }
  if (hadFractionTooBig && denomValue) {
    const fractionLabelRaw = firstFractionTooBig != null ? String(firstFractionTooBig) : '';
    const fractionLabel = fractionLabelRaw.trim() || fractionLabelRaw;
    showPulseSeqAutoTip(`El Pfr '<strong>${fractionLabel}</strong>' es mayor que la fracción. Introduce un número menor que 'd'.`);
  }

  return { hadTooBig, hadFractionTooBig };
}

function handleInput(){
  const lg = parseNum(inputLg.value);
  const v  = parseNum(inputV.value);
  const hasLg = !isNaN(lg) && lg > 0;
  const hasV  = !isNaN(v)  && v  > 0;

  if (isUpdating) return;

  const { numerator, denominator } = getFraction();
  updatePulseSeqFractionDisplay(numerator, denominator, { silent: true });
  refreshFractionUI({ reveal: true });

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
    ensurePulseMemory(lg);
  }

  updateFormula();
  renderTimeline();
  updatePulseSeqField();
  updateAutoIndicator();

  if (isPlaying && audio) {
    const scheduling = computeAudioSchedulingState();
    const selectionForAudio = applySelectionToAudio({ scheduling })
      || selectedForAudioFromState({ scheduling });
    const resolvedSelectionResolution = Number.isFinite(selectionForAudio?.resolution)
      ? Math.max(1, Math.round(selectionForAudio.resolution))
      : 1;
    const schedulingResolution = Number.isFinite(scheduling?.resolution)
      ? Math.max(1, Math.round(scheduling.resolution))
      : 1;
    const effectiveResolution = Math.max(1, resolvedSelectionResolution, schedulingResolution);
    const normalizedLg = Number.isFinite(scheduling?.lg) ? scheduling.lg : parseInt(inputLg.value);

    let effectiveTotal = scheduling.totalPulses != null ? scheduling.totalPulses : null;
    let effectivePatternBeats = scheduling.patternBeats != null ? scheduling.patternBeats : null;
    let effectiveCycleConfig = scheduling.cycleConfig ? { ...scheduling.cycleConfig } : null;
    let effectiveVoices = Array.isArray(scheduling.voices)
      ? scheduling.voices.map((voice) => (voice ? { ...voice } : voice))
      : [];

    if (Number.isFinite(normalizedLg) && normalizedLg > 0 && effectiveResolution > 1) {
      const scaledBase = normalizedLg * effectiveResolution;
      effectiveTotal = loopEnabled
        ? Math.max(1, Math.round(scaledBase))
        : Math.max(1, Math.round(scaledBase + 1));
      if (Number.isFinite(effectivePatternBeats)) {
        effectivePatternBeats = Math.max(1, Math.round(effectivePatternBeats * effectiveResolution));
      }
      if (effectiveCycleConfig && Number.isFinite(effectiveCycleConfig.numerator)) {
        effectiveCycleConfig = {
          ...effectiveCycleConfig,
          numerator: Math.max(1, Math.round(effectiveCycleConfig.numerator * effectiveResolution))
        };
      }
      effectiveVoices = effectiveVoices.map((voice) => {
        if (!voice || !Number.isFinite(voice.numerator)) return voice;
        return {
          ...voice,
          numerator: Math.max(1, Math.round(voice.numerator * effectiveResolution))
        };
      });
    }

    currentAudioResolution = effectiveResolution;
    updateVoiceHandlers({ scheduling: { ...scheduling, voices: effectiveVoices } });
    if (typeof audio.setVoices === 'function') {
      audio.setVoices(effectiveVoices);
    }

    const transportPayload = { align: 'nextPulse' };
    if (effectiveTotal != null) {
      transportPayload.totalPulses = effectiveTotal;
    }
    const vNow = parseFloat(inputV.value);
    if (scheduling.validV && Number.isFinite(vNow) && vNow > 0) {
      const scaledBpm = effectiveResolution > 1 ? vNow * effectiveResolution : vNow;
      transportPayload.bpm = scaledBpm;
    }
    if (effectivePatternBeats != null) {
      transportPayload.patternBeats = effectivePatternBeats;
    }
    if (effectiveCycleConfig) {
      transportPayload.cycle = effectiveCycleConfig;
    }
    if (typeof audio.updateTransport === 'function' && (scheduling.validLg || scheduling.validV)) {
      audio.updateTransport(transportPayload);
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

}

function updatePulseSeqField(){
  if(!pulseSeqEl) return;
  const lg = parseInt(inputLg.value);
  if(isNaN(lg) || lg <= 0){
    setPulseSeqText('');
    try{ const s = pulseSeqEl.querySelector('.pz.lg'); if (s) s.textContent=''; }catch{}
    pulseSeqRanges = {};
    fractionStore.pulseSeqEntryOrder = [];
    fractionStore.pulseSeqEntryLookup.clear();
    fractionStore.pulseSeqTokenMap.clear();
    return;
  }
  try{ const s = pulseSeqEl.querySelector('.pz.lg'); if (s) s.textContent=String(lg); }catch{}
  const entries = [];
  const limit = Math.min(pulseMemory.length, lg);
  for(let i = 1; i < limit; i++){
    if(pulseMemory[i]) {
      entries.push({ type: 'int', value: i, display: String(i), key: String(i) });
    }
  }
  const validFractionals = fractionStore.pulseSelections
    .filter(item => item && Number.isFinite(item.value))
    .filter(item => item.value > 0 && item.value < lg);
  validFractionals.forEach(item => {
    const normalizedRaw = typeof item.rawLabel === 'string' ? item.rawLabel.trim() : '';
    const preferredDisplay = normalizedRaw ? normalizedRaw : item.display;
    entries.push({
      type: 'fraction',
      value: item.value,
      display: preferredDisplay,
      rawLabel: normalizedRaw,
      key: item.key
    });
  });
  entries.sort((a, b) => a.value - b.value);
  fractionStore.pulseSeqEntryOrder = entries.map(entry => entry.key);
  fractionStore.pulseSeqEntryLookup.clear();
  entries.forEach((entry) => {
    if (!entry || !entry.key) return;
    fractionStore.pulseSeqEntryLookup.set(entry.key, entry);
  });
  pulseSeqRanges = {};
  let pos = 0;
  const parts = entries.map(entry => {
    const str = entry.display;
    const start = pos + 2;
    const end = start + str.length;
    pulseSeqRanges[entry.key] = [start, end];
    pos += str.length + 2;
    return str;
  });
  setPulseSeqText('  ' + parts.join('  ') + '  ');
}

// Rebuild selectedPulses (visible set) from pulseMemory and current Lg, then apply DOM classes
function syncSelectedFromMemory() {
  const lg = parseInt(inputLg.value);
  if (isNaN(lg) || lg <= 0) return;

  selectedPulses.clear();

  // 1) Persistència: només índexs interns (1..lg-1)
  const maxIdx = Math.min(lg - 1, pulseMemory.length - 1);
  for (let i = 1; i <= maxIdx; i++) {
    if (pulseMemory[i]) selectedPulses.add(i);
  }

  // 2) Extrems: efímers (derivats del loop)
  if (loopEnabled) {
    selectedPulses.add(0);
    selectedPulses.add(lg);
  }

  // Aplica al DOM
  pulses.forEach((p, idx) => {
    if (!p) return;
    p.classList.toggle('selected', selectedPulses.has(idx));
  });
  const lgIndex = pulses.length - 1;
  pulseNumberLabels.forEach((label) => {
    if (!label) return;
    const idx = parseIntSafe(label.dataset.index);
    if (!Number.isFinite(idx)) return;
    const isEndpoint = idx === 0 || idx === lgIndex;
    const pulseIsLocked = !isEndpoint && Boolean(pulses[idx]?.classList.contains('non-selectable'));
    label.classList.toggle('selected', selectedPulses.has(idx) && !isEndpoint);
    label.classList.toggle('non-selectable', pulseIsLocked);
  });
  applyFractionSelectionClasses();
  updatePulseSeqField();
}

function handlePulseSeqInput(){
  const lg = parseInt(inputLg.value);
  if (isNaN(lg) || lg <= 0) {
    pulseMemoryApi.clear();
    renderTimeline();
    return;
  }
  ensurePulseMemory(lg);
  for(let i = 1; i < lg; i++) pulseMemory[i] = false;
  const nums = getPulseSeqText().trim().split(/\s+/)
    .map(n => parseInt(n,10))
    .filter(n => !isNaN(n) && n > 0 && n < lg);
  nums.sort((a,b) => a - b);
  nums.forEach(n => { pulseMemory[n] = true; });
  setPulseSeqText(nums.join(' '));
  renderTimeline();
  if (isPlaying) {
    applySelectionToAudio();
  }
}

// Deterministically set selection state for index i, respecting 0/Lg pairing when loopEnabled
function setPulseSelected(i, shouldSelect) {
  const lg = parseInt(inputLg.value);
  if (isNaN(lg) || lg < 0) return;
  ensurePulseMemory(Math.max(i, lg));

  if (i === 0 || i === lg) {
    // Extrems: controlen loopEnabled (estat efímer)
    loopEnabled = !!shouldSelect;
    loopBtn.classList.toggle('active', loopEnabled);
  } else {
    pulseMemory[i] = shouldSelect;
  }

  updatePulseNumbers();
  syncSelectedFromMemory();

  if (isPlaying && audio) {
    applySelectionToAudio();
    if (typeof audio.setLoop === 'function') {
      audio.setLoop(loopEnabled);
    }
  }

  layoutTimeline({ silent: true });
}


function clearHighlights() {
  pulses.forEach(p => p.classList.remove('active'));
  resetCycleHighlightState();
  cycleMarkers.forEach(m => m.classList.remove('active'));
  cycleLabels.forEach(l => l.classList.remove('active'));
  pulseNumberLabels.forEach(label => label.classList.remove('pulse-number--flash'));
  pulseSeqController.clearActive();
  setFractionHighlightKey(null);
  resetPulseScrollCache();
  lastNormalizedStep = null;
  fractionStore.lastHighlightType = null;
  fractionStore.lastHighlightIntIndex = null;
  fractionStore.lastHighlightFractionKey = null;
}

function renderTimeline() {
  resetPulseHighlightState({ clearFraction: false });
  resetCycleHighlightState();
  pulseNumberLabels = [];
  pulses = [];
  pulseHits = [];
  cycleMarkers = [];
  cycleMarkerHits = [];
  cycleLabels = [];
  bars = [];
  clearFractionHighlight();
  fractionStore.hitMap.clear();
  fractionStore.markerMap.clear();
  fractionStore.labelLookup.clear();
  const savedIndicator = tIndicator;
  timeline.innerHTML = '';
  if (savedIndicator) timeline.appendChild(savedIndicator);

  const lg = parseIntSafe(inputLg.value);
  if (!Number.isFinite(lg) || lg <= 0) return;

  const numberFontRem = computeNumberFontRem(lg);
  const subdivisionFontRem = computeSubdivisionFontRem(lg);

  // Obtener la fracción actual para determinar qué pulsos son seleccionables
  const { numerator, denominator } = getFraction();

  for (let i = 0; i <= lg; i++) {
    const pulse = document.createElement('div');
    pulse.className = 'pulse';
    if (i === 0) pulse.classList.add('zero');
    else if (i === lg) pulse.classList.add('lg');
    pulse.dataset.index = String(i);

    // Aplicar clase si el pulso no es seleccionable según la fracción activa
    const selectable = isIntegerPulseSelectable(i, numerator, denominator, lg);
    if (i !== 0 && i !== lg && !selectable) {
      pulse.classList.add('non-selectable');
    }

    timeline.appendChild(pulse);
    pulses.push(pulse);

    if (i === 0 || i === lg) {
      const bar = document.createElement('div');
      bar.className = 'bar';
      timeline.appendChild(bar);
      bars.push(bar);
    }

    const hit = document.createElement('div');
    hit.className = 'pulse-hit';
    hit.dataset.index = String(i);
    hit.dataset.selectionKey = `pulse:${i}`;
    hit.style.position = 'absolute';
    hit.style.borderRadius = '50%';
    hit.style.background = 'transparent';
    hit.style.zIndex = '6';
    const hitSize = computeHitSizePx(lg);
    hit.style.width = `${hitSize}px`;
    hit.style.height = `${hitSize}px`;
    if (i === 0 || i === lg) {
      hit.style.pointerEvents = 'none';
      hit.style.cursor = 'default';
    } else if (!selectable) {
      // Pulsos no seleccionables: deshabilitar interacciones
      hit.style.pointerEvents = 'none';
      hit.style.cursor = 'not-allowed';
      hit.classList.add('non-selectable');
    } else {
      hit.style.pointerEvents = 'auto';
      hit.style.cursor = 'pointer';
      attachSelectionListeners(hit);
    }
    timeline.appendChild(hit);
    pulseHits.push(hit);
  }
  const grid = gridFromOrigin({ lg, numerator, denominator });
  const normalizedLg = Number.isFinite(lg) && lg > 0 ? lg : null;
  const normalizedNumerator = Number.isFinite(grid?.numerator) && grid.numerator > 0
    ? grid.numerator
    : (Number.isFinite(numerator) && numerator > 0 ? numerator : null);
  const normalizedDenominator = Number.isFinite(grid?.denominator) && grid.denominator > 0
    ? grid.denominator
    : (Number.isFinite(denominator) && denominator > 0 ? denominator : null);

  lastStructureSignature = {
    lg: normalizedLg,
    numerator: normalizedNumerator,
    denominator: normalizedDenominator
  };

  const validFractionKeys = new Set();
  if (grid.cycles > 0 && grid.subdivisions.length && normalizedNumerator && normalizedDenominator) {
    const hideFractionLabels = lg >= SUBDIVISION_HIDE_THRESHOLD;
    const numeratorPerCycle = normalizedNumerator ?? 0;
    const labelFormatter = ({ cycleIndex, subdivisionIndex, position }) => {
      const normalizedPositionBase = Number.isFinite(position)
        ? Math.floor(position + FRACTION_POSITION_EPSILON)
        : null;
      const normalizedCycle = Number.isFinite(cycleIndex) ? Math.floor(cycleIndex) : null;
      const hasCycleBase = normalizedCycle != null && Number.isFinite(numeratorPerCycle);
      const cycleBase = hasCycleBase ? normalizedCycle * numeratorPerCycle : null;

      if (subdivisionIndex === 0) {
        if (Number.isFinite(cycleBase)) return String(cycleBase);
        return Number.isFinite(normalizedPositionBase) ? String(normalizedPositionBase) : null;
      }

      if (Number.isFinite(cycleBase)) {
        return `${cycleBase}.${subdivisionIndex}`;
      }

      if (Number.isFinite(normalizedPositionBase)) {
        return `${normalizedPositionBase}.${subdivisionIndex}`;
      }

      return `${cycleIndex}.${subdivisionIndex}`;
    };
    const denominatorValue = normalizedDenominator ?? 0;
    grid.subdivisions.forEach(({ cycleIndex, subdivisionIndex, position }) => {
      let fractionKey = null;
      const formattedLabel = labelFormatter({ cycleIndex, subdivisionIndex, position });
      let normalizedDisplay = null;
      const marker = document.createElement('div');
      marker.className = 'cycle-marker';
      if (subdivisionIndex === 0) marker.classList.add('start');
      marker.dataset.cycleIndex = String(cycleIndex);
      marker.dataset.subdivision = String(subdivisionIndex);
      marker.dataset.position = String(position);
      if (Number.isFinite(numeratorPerCycle) && numeratorPerCycle > 0) {
        marker.dataset.pulsesPerCycle = String(numeratorPerCycle);
      }
      if (Number.isFinite(lg) && lg > 0) {
        const percent = (position / lg) * 100;
        marker.style.left = `${percent}%`;
        marker.style.top = '50%';
        marker.style.transform = 'translate(-50%, -50%)';
      }
      timeline.appendChild(marker);
      cycleMarkers.push(marker);

      if (subdivisionIndex === 0) {
        const baseIndex = cycleIndex * numeratorPerCycle;
        if (Number.isFinite(baseIndex)) marker.dataset.index = String(baseIndex);
      } else {
        const snapPulse = nearestPulseIndex(position);
        if (snapPulse != null) {
          marker.dataset.index = String(snapPulse);
        }
      }

      if (subdivisionIndex > 0 && denominatorValue > 0) {
        let baseIndex = Math.floor(position);
        let fracNumerator = Math.round((position - baseIndex) * denominatorValue);
        if (fracNumerator >= denominatorValue) {
          const carry = Math.floor(fracNumerator / denominatorValue);
          baseIndex += carry;
          fracNumerator -= carry * denominatorValue;
        }
        if (fracNumerator > 0) {
          const key = makeFractionKey(baseIndex, fracNumerator, denominatorValue);
          if (key) {
            fractionKey = key;
            const value = fractionValue(baseIndex, fracNumerator, denominatorValue);
            const formattedDisplay = typeof formattedLabel === 'string'
              ? formattedLabel.trim()
              : (formattedLabel != null ? String(formattedLabel).trim() : '');
            const fallbackDisplay = fractionDisplay(baseIndex, fracNumerator, denominatorValue, {
              cycleIndex,
              subdivisionIndex,
              pulsesPerCycle: numeratorPerCycle
            });
            normalizedDisplay = formattedDisplay || (typeof fallbackDisplay === 'string'
              ? fallbackDisplay
              : String(fallbackDisplay ?? ''));
            marker.dataset.baseIndex = String(baseIndex);
            marker.dataset.fractionNumerator = String(fracNumerator);
            marker.dataset.fractionDenominator = String(denominatorValue);
            marker.dataset.fractionKey = key;
            marker.dataset.selectionKey = `fraction:${key}`;
            marker.dataset.value = String(value);
            marker.dataset.display = normalizedDisplay;
            marker.style.cursor = 'pointer';
            attachSelectionListeners(marker);
            validFractionKeys.add(key);
            fractionStore.markerMap.set(key, marker);

            const hit = document.createElement('div');
            hit.className = 'fraction-hit';
            hit.dataset.baseIndex = marker.dataset.baseIndex;
            hit.dataset.cycleIndex = marker.dataset.cycleIndex;
            hit.dataset.subdivision = marker.dataset.subdivision;
            hit.dataset.fractionNumerator = marker.dataset.fractionNumerator;
            hit.dataset.fractionDenominator = marker.dataset.fractionDenominator;
            hit.dataset.fractionKey = key;
            hit.dataset.selectionKey = `fraction:${key}`;
            hit.dataset.value = String(value);
            hit.dataset.display = normalizedDisplay;
            if (Number.isFinite(numeratorPerCycle) && numeratorPerCycle > 0) {
              hit.dataset.pulsesPerCycle = String(numeratorPerCycle);
            }
            hit.style.position = 'absolute';
            hit.style.borderRadius = '50%';
            hit.style.background = 'transparent';
            hit.style.zIndex = '6';
            const fracHitSize = computeHitSizePx(lg) * 0.75;
            hit.style.width = `${fracHitSize}px`;
            hit.style.height = `${fracHitSize}px`;
            if (Number.isFinite(lg) && lg > 0) {
              const percent = (position / lg) * 100;
              hit.style.left = `${percent}%`;
              hit.style.top = '50%';
              hit.style.transform = 'translate(-50%, -50%)';
            }
            hit.style.pointerEvents = 'auto';
            hit.style.cursor = 'pointer';
            attachSelectionListeners(hit);
            timeline.appendChild(hit);
            cycleMarkerHits.push(hit);
            fractionStore.hitMap.set(key, hit);

            const storedSelection = fractionStore.selectionState.get(key);
            const storedRawLabel = typeof storedSelection?.rawLabel === 'string'
              ? storedSelection.rawLabel.trim()
              : '';
            const effectiveRawLabel = storedRawLabel || normalizedDisplay;
            if (effectiveRawLabel) {
              marker.dataset.rawLabel = effectiveRawLabel;
              hit.dataset.rawLabel = effectiveRawLabel;
            }
            const labelInfo = {
              key,
              base: baseIndex,
              numerator: fracNumerator,
              denominator: denominatorValue,
              value,
              display: normalizedDisplay,
              cycleIndex,
              subdivisionIndex,
              pulsesPerCycle: numeratorPerCycle,
              rawLabel: storedRawLabel
            };
            registerFractionLabel(normalizedDisplay, labelInfo);
            if (storedRawLabel) {
              registerFractionLabel(storedRawLabel, labelInfo);
            }
            const cycleLabel = Number.isFinite(cycleIndex) && cycleIndex >= 0
              ? `${Math.floor(cycleIndex)}.${subdivisionIndex}`
              : null;
            if (cycleLabel) {
              registerFractionLabel(cycleLabel, labelInfo);
            }
            const absoluteLabel = Number.isFinite(labelInfo.base) && Number.isFinite(labelInfo.numerator)
              ? `${labelInfo.base}.${labelInfo.numerator}`
              : null;
            if (absoluteLabel) {
              registerFractionLabel(absoluteLabel, labelInfo);
            }
            if (Number.isFinite(cycleIndex) && Number.isFinite(subdivisionIndex) && subdivisionIndex >= 0) {
              registerFractionLabel(`${cycleIndex}.${subdivisionIndex}`, labelInfo);
            }
          }
        }
      }

      if (hideFractionLabels) return;
      const formatted = formattedLabel != null
        ? formattedLabel
        : (normalizedDisplay != null ? normalizedDisplay : labelFormatter({ cycleIndex, subdivisionIndex, position }));
      if (formatted != null) {
        const label = document.createElement('div');
        label.className = 'cycle-label';
        if (subdivisionIndex === 0) label.classList.add('cycle-label--integer');
        if (cycleIndex === 0 && subdivisionIndex === 0) label.classList.add('cycle-label--origin');
        label.dataset.cycleIndex = String(cycleIndex);
        label.dataset.subdivision = String(subdivisionIndex);
        label.dataset.position = String(position);
        if (fractionKey) {
          label.dataset.fractionKey = fractionKey;
        }
        label.textContent = formatted;
        label.dataset.fullText = String(formatted);
        const decimalIndex = typeof formatted === 'string' ? formatted.indexOf('.') : -1;
        if (decimalIndex > -1 && decimalIndex < formatted.length - 1) {
          const fractionalPart = formatted.slice(decimalIndex + 1);
          if (fractionalPart.length > 0) {
            label.dataset.isDecimal = '1';
            label.dataset.compactText = `.${fractionalPart}`;
          }
        }
        label.style.fontSize = `${subdivisionFontRem}rem`;
        if (Number.isFinite(lg) && lg > 0) {
          const percent = (position / lg) * 100;
          label.style.left = `${percent}%`;
          label.style.top = 'calc(100% + 12px)';
          label.style.transform = 'translate(-50%, 0)';
        }
        timeline.appendChild(label);
        cycleLabels.push(label);
      }
    });
  }

  const invalidFractionEntries = [];
  fractionStore.selectionState.forEach((entry, key) => {
    if (!validFractionKeys.has(key)) {
      invalidFractionEntries.push({ key, entry });
    }
  });
  if (invalidFractionEntries.length > 0) {
    invalidFractionEntries.forEach(({ key, entry }) => {
      fractionStore.selectionState.delete(key);
      markFractionSuspended({ ...entry, key });
    });
  }

  let restoredFraction = false;
  validFractionKeys.forEach((key) => {
    if (fractionStore.selectionState.has(key)) return;
    const memoryEntry = fractionMemory.get(key);
    if (!memoryEntry || memoryEntry.suspended !== true) return;
    const restoredEntry = {
      base: memoryEntry.base,
      numerator: memoryEntry.numerator,
      denominator: memoryEntry.denominator,
      value: memoryEntry.value,
      display: memoryEntry.display,
      key,
      cycleIndex: memoryEntry.cycleIndex,
      subdivisionIndex: memoryEntry.subdivisionIndex,
      pulsesPerCycle: memoryEntry.pulsesPerCycle,
      rawLabel: memoryEntry.rawLabel
    };
    fractionStore.selectionState.set(key, restoredEntry);
    rememberFractionSelectionInMemory({ ...restoredEntry, key }, { suspended: false });
    restoredFraction = true;
  });

  if (invalidFractionEntries.length > 0 || restoredFraction) {
    rebuildFractionSelections({ skipUpdateField: true });
  }

  updatePulseNumbers();
  layoutTimeline({ silent: true });
  syncSelectedFromMemory();
  applyFractionSelectionClasses();
  clearHighlights();
}

function restoreCycleLabelDisplay() {
  cycleLabels.forEach(label => {
    if (!label) return;
    const full = label.dataset.fullText;
    if (typeof full === 'string') {
      label.textContent = full;
    }
    label.classList.remove('cycle-label--compact');
  });
}

function applyCycleLabelCompaction({ lg }) {
  if (!timeline || !Array.isArray(cycleLabels)) return;
  if (!Number.isFinite(lg) || lg <= 0) {
    restoreCycleLabelDisplay();
    return;
  }
  const width = timeline.clientWidth || timeline.getBoundingClientRect().width;
  if (!Number.isFinite(width) || width <= 0) {
    restoreCycleLabelDisplay();
    return;
  }

  const sorted = [...cycleLabels].filter(Boolean).sort((a, b) => {
    const aPos = Number(a.dataset.position);
    const bPos = Number(b.dataset.position);
    if (!Number.isFinite(aPos) && !Number.isFinite(bPos)) return 0;
    if (!Number.isFinite(aPos)) return 1;
    if (!Number.isFinite(bPos)) return -1;
    return aPos - bPos;
  });

  sorted.forEach((label, idx) => {
    const full = typeof label.dataset.fullText === 'string' ? label.dataset.fullText : label.textContent;
    const compact = label.dataset.compactText;
    let useCompact = false;

    if (label.dataset.isDecimal === '1' && typeof compact === 'string') {
      const currentPos = Number(label.dataset.position);
      if (Number.isFinite(currentPos)) {
        const currentPx = (currentPos / lg) * width;

        const prevLabel = sorted[idx - 1];
        let prevPx = null;
        if (prevLabel) {
          const prevPos = Number(prevLabel.dataset.position);
          if (Number.isFinite(prevPos)) {
            prevPx = (prevPos / lg) * width;
          }
        }

        const nextLabel = sorted[idx + 1];
        let nextPx = null;
        if (nextLabel) {
          const nextPos = Number(nextLabel.dataset.position);
          if (Number.isFinite(nextPos)) {
            nextPx = (nextPos / lg) * width;
          }
        }

        if ((prevPx != null && currentPx - prevPx < MIN_SUBDIVISION_LABEL_SPACING_PX)
          || (nextPx != null && nextPx - currentPx < MIN_SUBDIVISION_LABEL_SPACING_PX)) {
          useCompact = true;
        }
      }
    }

    if (useCompact) {
      label.textContent = compact;
      label.classList.add('cycle-label--compact');
    } else {
      label.textContent = full || '';
      label.classList.remove('cycle-label--compact');
    }
  });
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
  clearHighlights();
  stopVisualSync();
  if (audioInstance && typeof audioInstance.stop === 'function') {
    try { audioInstance.stop(); } catch {}
  }
  currentAudioResolution = 1;
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

  stopVisualSync();
  audioInstance.stop();
  clearHighlights();

  // Sound selection is already applied by initAudio() from dataset.value
  // and by bindSharedSoundEvents from sharedui:sound events
  // No need to override here

  const scheduling = computeAudioSchedulingState();
  if (scheduling.interval == null || scheduling.totalPulses == null) {
    return false;
  }
  const selectionForAudio = applySelectionToAudio({
    scheduling,
    instance: audioInstance
  }) || selectedForAudioFromState({ scheduling });
  const resolvedSelectionResolution = Number.isFinite(selectionForAudio?.resolution)
    ? Math.max(1, Math.round(selectionForAudio.resolution))
    : 1;
  const schedulingResolution = Number.isFinite(scheduling?.resolution)
    ? Math.max(1, Math.round(scheduling.resolution))
    : 1;
  const effectiveResolution = Math.max(1, resolvedSelectionResolution, schedulingResolution);
  const normalizedLg = Number.isFinite(scheduling?.lg) ? scheduling.lg : lg;
  let effectiveInterval = scheduling.interval;
  let effectiveTotal = scheduling.totalPulses;
  let effectivePatternBeats = Number.isFinite(scheduling?.patternBeats)
    ? scheduling.patternBeats
    : null;
  let cycleConfig = scheduling.cycleConfig ? { ...scheduling.cycleConfig } : null;
  let voices = Array.isArray(scheduling.voices)
    ? scheduling.voices.map((voice) => ({ ...voice }))
    : [];

  if (Number.isFinite(normalizedLg) && normalizedLg > 0 && effectiveResolution > 1) {
    const scaledBase = normalizedLg * effectiveResolution;
    if (loopEnabled) {
      effectiveTotal = Math.max(1, Math.round(scaledBase));
    } else {
      effectiveTotal = Math.max(1, Math.round(scaledBase + 1));
    }
    if (Number.isFinite(scheduling.interval)) {
      effectiveInterval = scheduling.interval / effectiveResolution;
    }
    if (Number.isFinite(effectivePatternBeats)) {
      effectivePatternBeats = Math.max(1, Math.round(effectivePatternBeats * effectiveResolution));
    }
    if (cycleConfig && Number.isFinite(cycleConfig.numerator)) {
      cycleConfig = { ...cycleConfig, numerator: Math.max(1, Math.round(cycleConfig.numerator * effectiveResolution)) };
    }
    voices = voices.map((voice) => {
      if (!voice || !Number.isFinite(voice.numerator)) return voice;
      return { ...voice, numerator: Math.max(1, Math.round(voice.numerator * effectiveResolution)) };
    });
  }

  if (!Number.isFinite(effectiveInterval) || effectiveInterval <= 0) {
    return false;
  }
  if (!Number.isFinite(effectiveTotal) || effectiveTotal <= 0) {
    return false;
  }

  currentAudioResolution = effectiveResolution;
  updateVoiceHandlers({ scheduling: { ...scheduling, voices } });
  if (typeof audioInstance.setVoices === 'function') {
    audioInstance.setVoices(voices);
  }
  const iconPlay = playBtn?.querySelector('.icon-play');
  const iconStop = playBtn?.querySelector('.icon-stop');

  const onFinish = () => {
    handlePlaybackStop(audioInstance);
  };

  const playOptions = {};
  if (effectivePatternBeats != null) {
    playOptions.patternBeats = effectivePatternBeats;
  }
  if (cycleConfig) {
    playOptions.cycle = cycleConfig;
  }
  playOptions.baseResolution = effectiveResolution;

  if (typeof audioInstance.setLoop === 'function') {
    audioInstance.setLoop(loopEnabled);
  }

  const selectionValuesForAudio = selectionForAudio.audio ?? selectionForAudio.combined;
  const selectionPayload = {
    values: selectionValuesForAudio,
    resolution: 1
  };

  audioInstance.play(
    effectiveTotal,
    effectiveInterval,
    selectionPayload,
    loopEnabled,
    null,
    onFinish,
    playOptions
  );

  syncVisualState();
  startVisualSync();

  isPlaying = true;
  playBtn?.classList.add('active');
  if (iconPlay) iconPlay.style.display = 'none';
  if (iconStop) iconStop.style.display = 'block';
  const ed = getEditEl();
  if (ed) {
    ed.classList.add('playing');
    try { ed.blur(); } catch {}
  }

  scheduleTIndicatorReveal(0);

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

    clearHighlights();
    const started = await startPlayback(audioInstance);
    if (!started) {
      handlePlaybackStop(audioInstance);
    }
  } catch {}
});

function deactivateCycleHighlight() {
  const seen = new Set();
  const { marker, label, trailingMarker, trailingLabel } = lastCycleHighlightState;
  [marker, label, trailingMarker, trailingLabel].forEach((node) => {
    if (!node || seen.has(node)) return;
    if (node.classList) {
      node.classList.remove('active');
    }
    seen.add(node);
  });
}

function resetCycleHighlightState() {
  deactivateCycleHighlight();
  lastCycleHighlightState = {
    cycleIndex: null,
    subdivisionIndex: null,
    marker: null,
    label: null,
    trailingMarker: null,
    trailingLabel: null,
    trailingCycleIndex: null,
    trailingSubdivisionIndex: null
  };
}

function highlightCycle(payload = {}) {
  if (!isPlaying) return;
  const {
    cycleIndex: rawCycleIndex,
    subdivisionIndex: rawSubdivisionIndex,
    numerator: payloadNumerator,
    denominator: payloadDenominator,
    totalCycles: payloadTotalCycles,
    totalSubdivisions: payloadTotalSubdivisions
  } = payload;

  const cycleIndex = Number(rawCycleIndex);
  const subdivisionIndex = Number(rawSubdivisionIndex);
  if (!Number.isFinite(cycleIndex) || !Number.isFinite(subdivisionIndex)) return;

  const expectedNumerator = Number.isFinite(lastStructureSignature.numerator)
    ? lastStructureSignature.numerator
    : null;
  const expectedDenominator = Number.isFinite(lastStructureSignature.denominator)
    ? lastStructureSignature.denominator
    : null;
  const expectedLg = Number.isFinite(lastStructureSignature.lg)
    ? lastStructureSignature.lg
    : null;

  if (expectedNumerator == null || expectedDenominator == null || expectedLg == null) {
    return;
  }

  if (Number.isFinite(payloadNumerator) && payloadNumerator !== expectedNumerator) {
    return;
  }
  if (Number.isFinite(payloadDenominator) && payloadDenominator !== expectedDenominator) {
    return;
  }

  const expectedCycles = Math.floor(expectedLg / expectedNumerator);
  if (!Number.isFinite(expectedCycles) || expectedCycles <= 0) {
    return;
  }

  if (Number.isFinite(payloadTotalCycles) && payloadTotalCycles !== expectedCycles) {
    return;
  }
  if (Number.isFinite(payloadTotalSubdivisions) && payloadTotalSubdivisions !== expectedDenominator) {
    return;
  }

  const clampIndex = (value, maxExclusive) => {
    if (!Number.isFinite(value)) return null;
    if (loopEnabled) {
      if (maxExclusive <= 0) return null;
      const span = maxExclusive;
      return ((value % span) + span) % span;
    }
    if (maxExclusive <= 0) return null;
    return Math.max(0, Math.min(value, maxExclusive - 1));
  };

  const normalizedCycleIndex = clampIndex(cycleIndex, expectedCycles);
  const normalizedSubdivisionIndex = clampIndex(subdivisionIndex, expectedDenominator);
  if (!Number.isFinite(normalizedCycleIndex) || !Number.isFinite(normalizedSubdivisionIndex)) {
    return;
  }

  const shouldHighlightTrailing = loopEnabled
    && normalizedCycleIndex === 0
    && normalizedSubdivisionIndex === 0
    && expectedCycles > 0;
  const trailingCycleIndex = shouldHighlightTrailing ? expectedCycles - 1 : null;
  const trailingSubdivisionIndex = shouldHighlightTrailing ? 0 : null;

  const highlightUnchanged = normalizedCycleIndex === lastCycleHighlightState.cycleIndex
    && normalizedSubdivisionIndex === lastCycleHighlightState.subdivisionIndex
    && trailingCycleIndex === lastCycleHighlightState.trailingCycleIndex
    && trailingSubdivisionIndex === lastCycleHighlightState.trailingSubdivisionIndex;
  if (highlightUnchanged) {
    return;
  }

  const marker = cycleMarkers.find((m) => Number(m.dataset.cycleIndex) === normalizedCycleIndex
    && Number(m.dataset.subdivision) === normalizedSubdivisionIndex) || null;
  const label = cycleLabels.find((l) => Number(l.dataset.cycleIndex) === normalizedCycleIndex
    && Number(l.dataset.subdivision) === normalizedSubdivisionIndex) || null;

  const trailingMarker = shouldHighlightTrailing
    ? cycleMarkers.find((m) => Number(m.dataset.cycleIndex) === trailingCycleIndex
      && Number(m.dataset.subdivision) === trailingSubdivisionIndex) || null
    : null;
  const trailingLabel = shouldHighlightTrailing
    ? cycleLabels.find((l) => Number(l.dataset.cycleIndex) === trailingCycleIndex
      && Number(l.dataset.subdivision) === trailingSubdivisionIndex) || null
    : null;

  deactivateCycleHighlight();

  // Calculate adaptive animation duration based on subdivision tempo
  const v = parseNum(inputV?.value ?? '');
  const hasTempo = Number.isFinite(v) && v > 0;
  let animDuration = 350; // Default 350ms

  if (hasTempo && Number.isFinite(expectedDenominator) && expectedDenominator > 0) {
    // Subdivision interval in ms = (60 / BPM) * 1000 / denominator
    const subdivisionIntervalMs = (60 / v) * 1000 / expectedDenominator;
    // Use 80% of the interval for animation, clamped between 60ms (ultra-fast) and 400ms (slow)
    animDuration = Math.max(60, Math.min(subdivisionIntervalMs * 0.8, 400));
  }

  if (marker) {
    marker.style.setProperty('--pulse-anim-duration', `${animDuration}ms`);
    void marker.offsetWidth;
    marker.classList.add('active');
  }
  if (label) {
    label.classList.add('active');
  }
  if (trailingMarker && trailingMarker !== marker) {
    trailingMarker.style.setProperty('--pulse-anim-duration', `${animDuration}ms`);
    trailingMarker.classList.add('active');
  }
  if (trailingLabel && trailingLabel !== label) {
    trailingLabel.classList.add('active');
  }

  lastCycleHighlightState = {
    cycleIndex: normalizedCycleIndex,
    subdivisionIndex: normalizedSubdivisionIndex,
    marker,
    label,
    trailingMarker,
    trailingLabel,
    trailingCycleIndex,
    trailingSubdivisionIndex
  };
}

function getPulseSeqRectForKey(key) {
  if (!pulseSeqEl || !key) return null;
  const token = fractionStore.pulseSeqTokenMap.get(key);
  if (token && typeof token.getBoundingClientRect === 'function') {
    return token.getBoundingClientRect();
  }
  const range = pulseSeqRanges[key];
  if (range && Array.isArray(range)) {
    const el = getEditEl();
    const node = el && el.firstChild;
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

function getPulseSeqRectForIndex(index) {
  if (!pulseSeqEl || !Number.isFinite(index)) return null;
  const idx = Math.round(index);
  if (idx === 0) {
    const z = pulseSeqEl.querySelector('.pz.zero');
    return z ? z.getBoundingClientRect() : null;
  }
  if (pulses && idx === pulses.length - 1) {
    const l = pulseSeqEl.querySelector('.pz.lg');
    return l ? l.getBoundingClientRect() : null;
  }
  return getPulseSeqRectForKey(String(idx));
}

pulseSeqController.setRectResolver(getPulseSeqRectForIndex);

function scrollPulseSeqToRect(rect) {
  if (!pulseSeqEl || !rect) return pulseSeqEl ? pulseSeqEl.scrollLeft : 0;
  const parentRect = pulseSeqEl.getBoundingClientRect();
  const absLeft = rect.left - parentRect.left + pulseSeqEl.scrollLeft;
  const target = absLeft - (pulseSeqEl.clientWidth - rect.width) / 2;
  const maxScroll = pulseSeqEl.scrollWidth - pulseSeqEl.clientWidth;
  const newScrollLeft = Math.max(0, Math.min(target, maxScroll));
  pulseSeqEl.scrollLeft = newScrollLeft;
  if (typeof syncTimelineScroll === 'function') syncTimelineScroll();
  return newScrollLeft;
}

function resetPulseScrollCache() {
  lastPulseScrollCache = { ...EMPTY_PULSE_SCROLL_CACHE };
}

// Removed complex setPulseActiveNodes and deactivatePulseNodes
// Now using simple pattern from App1 directly in highlightPulse

function setFractionHighlightKey(key) {
  if (lastFractionHighlightNodes.key === key) {
    return;
  }

  const { marker, hit, token } = lastFractionHighlightNodes;
  if (marker) marker.classList.remove('fraction-active');
  if (hit && hit !== marker) hit.classList.remove('fraction-active');
  if (token) token.classList.remove('pulse-seq-token--active');

  lastFractionHighlightNodes = {
    key: null,
    marker: null,
    hit: null,
    token: null
  };

  if (!key) {
    fractionStore.lastFractionHighlightKey = null;
    return;
  }

  const nextMarker = fractionStore.markerMap.get(key) || null;
  const nextHit = fractionStore.hitMap.get(key) || null;
  const nextToken = fractionStore.pulseSeqTokenMap.get(key) || null;

  if (nextMarker) nextMarker.classList.add('fraction-active');
  if (nextHit && nextHit !== nextMarker) nextHit.classList.add('fraction-active');
  if (nextToken) nextToken.classList.add('pulse-seq-token--active');

  lastFractionHighlightNodes = {
    key,
    marker: nextMarker,
    hit: nextHit,
    token: nextToken
  };

  fractionStore.lastFractionHighlightKey = key;
}

function clearFractionHighlight() {
  setFractionHighlightKey(null);
}

function findFractionMatch(value, epsilon = FRACTION_POSITION_EPSILON) {
  if (!Number.isFinite(value)) return null;
  for (const item of fractionStore.pulseSelections) {
    if (!item || !Number.isFinite(item.value) || !item.key) continue;
    if (Math.abs(item.value - value) <= epsilon) {
      return item;
    }
  }
  for (const [key, hit] of fractionStore.hitMap.entries()) {
    if (!key || !hit) continue;
    const hitValue = Number.parseFloat(hit.dataset?.value);
    if (!Number.isFinite(hitValue)) continue;
    if (Math.abs(hitValue - value) <= epsilon) {
      return { key, value: hitValue };
    }
  }
  return null;
}

function resetPulseHighlightState({ clearFraction = true } = {}) {
  pulses.forEach(p => p.classList.remove('active'));
  if (clearFraction) {
    setFractionHighlightKey(null);
  }
  lastPulseHighlightState = {
    type: null,
    index: null,
    fractionKey: null,
    trailingIndex: null
  };
  resetPulseScrollCache();
}

// Simple integer pulse highlight - follows App1 pattern exactly
function highlightIntegerPulse(i) {
  // Clear all pulse highlights
  pulses.forEach(p => p.classList.remove('active'));

  if (!pulses || pulses.length === 0) return;

  // Highlight current pulse
  const idx = i % pulses.length;
  const current = pulses[idx];
  if (current) {
    // Force reflow so animation restarts (like App1)
    void current.offsetWidth;
    current.classList.add('active');
  }

  // If looping and at first pulse, also highlight last
  if (loopEnabled && idx === 0) {
    const last = pulses[pulses.length - 1];
    if (last) last.classList.add('active');
  }
}

function highlightPulse(payload){
  if (!isPlaying) return;

  if (!pulses || pulses.length === 0) {
    lastNormalizedStep = null;
    fractionStore.lastHighlightType = null;
    fractionStore.lastHighlightIntIndex = null;
    fractionStore.lastHighlightFractionKey = null;
    resetPulseHighlightState({ clearFraction: true });
    pulseSeqController.clearActive();
    return;
  }

  let rawStepValue = null;
  if (payload && typeof payload === 'object') {
    if (Number.isFinite(payload.step)) {
      rawStepValue = Number(payload.step);
    } else if (Number.isFinite(payload.rawStep)) {
      rawStepValue = Number(payload.rawStep);
    }
    if (Number.isFinite(payload.resolution) && payload.resolution > 0) {
      const rounded = Math.max(1, Math.round(payload.resolution));
      if (rounded !== currentAudioResolution) {
        currentAudioResolution = rounded;
      }
    }
  } else {
    const candidate = Number(payload);
    rawStepValue = Number.isFinite(candidate) ? candidate : null;
  }

  if (!Number.isFinite(rawStepValue)) {
    lastNormalizedStep = null;
    fractionStore.lastHighlightType = null;
    fractionStore.lastHighlightIntIndex = null;
    fractionStore.lastHighlightFractionKey = null;
    resetPulseScrollCache();
    return;
  }

  const baseCount = pulses.length > 1 ? pulses.length - 1 : 0;
  if (baseCount <= 0) {
    lastNormalizedStep = null;
    fractionStore.lastHighlightType = null;
    fractionStore.lastHighlightIntIndex = null;
    fractionStore.lastHighlightFractionKey = null;
    resetPulseScrollCache();
    return;
  }

  const resolution = Math.max(1, Math.round(currentAudioResolution || 1));
  const scaledSpan = baseCount * resolution;

  // Normalize without premature rounding to maintain sub-frame precision
  let normalizedScaled = rawStepValue;
  if (loopEnabled) {
    if (scaledSpan <= 0) return;
    normalizedScaled = ((rawStepValue % scaledSpan) + scaledSpan) % scaledSpan;
  } else {
    const maxStep = scaledSpan;
    normalizedScaled = Math.max(0, Math.min(rawStepValue, maxStep));
  }

  const normalizedValue = resolution > 0 ? normalizedScaled / resolution : normalizedScaled;
  const nearestInt = Math.round(normalizedValue);
  const epsilon = FRACTION_POSITION_EPSILON;
  const isIntegerStep = Math.abs(normalizedValue - nearestInt) <= epsilon
    && nearestInt >= 0
    && nearestInt <= baseCount;

  let highlightType = 'int';
  let fractionMatch = null;
  if (!isIntegerStep) {
    fractionMatch = findFractionMatch(normalizedValue, epsilon);
    if (fractionMatch && fractionMatch.key) {
      highlightType = 'fraction';
    }
  }

  const fractionKey = fractionMatch && fractionMatch.key ? fractionMatch.key : null;
  const idx = Math.max(0, Math.min(nearestInt, baseCount));
  const loopWrapped = Number.isFinite(lastNormalizedStep) && normalizedScaled < lastNormalizedStep;

  let shouldUpdate = false;
  if (highlightType === 'fraction') {
    shouldUpdate = fractionStore.lastHighlightType !== 'fraction'
      || fractionKey !== fractionStore.lastHighlightFractionKey;
  } else {
    shouldUpdate = fractionStore.lastHighlightType !== 'int'
      || idx !== fractionStore.lastHighlightIntIndex;
  }

  if (!shouldUpdate) {
    lastNormalizedStep = normalizedScaled;
    lastVisualStep = rawStepValue;
    return;
  }

  fractionStore.lastHighlightType = highlightType;
  fractionStore.lastHighlightIntIndex = highlightType === 'int' ? idx : null;
  fractionStore.lastHighlightFractionKey = highlightType === 'fraction' ? fractionKey : null;
  lastNormalizedStep = normalizedScaled;
  lastVisualStep = rawStepValue;

  let newScrollLeft = pulseSeqEl ? pulseSeqEl.scrollLeft : 0;

  if (highlightType === 'fraction' && fractionKey) {
    // Clear all pulse highlights for fractions too
    pulses.forEach(p => p.classList.remove('active'));
    setFractionHighlightKey(fractionKey);
    if (pulseSeqEl) {
      const cacheMatches = lastPulseScrollCache.type === 'fraction'
        && lastPulseScrollCache.fractionKey === fractionKey;
      const scrollAligned = cacheMatches
        && lastPulseScrollCache.scrollLeft != null
        && Math.abs(pulseSeqEl.scrollLeft - lastPulseScrollCache.scrollLeft) < 0.5;

      const rect = cacheMatches && lastPulseScrollCache.rect
        ? lastPulseScrollCache.rect
        : getPulseSeqRectForKey(fractionKey);

      if (rect) {
        newScrollLeft = scrollAligned
          ? pulseSeqEl.scrollLeft
          : scrollPulseSeqToRect(rect);
        pulseSeqController.setActiveIndex(0, {
          rect,
          scrollLeft: newScrollLeft
        });
        lastPulseScrollCache = {
          type: 'fraction',
          index: null,
          fractionKey,
          trailingIndex: null,
          rect,
          trailingRect: null,
          scrollLeft: newScrollLeft
        };
      } else {
        pulseSeqController.clearActive();
        resetPulseScrollCache();
      }
    } else {
      pulseSeqController.clearActive();
      resetPulseScrollCache();
    }
    lastPulseHighlightState = {
      type: 'fraction',
      index: null,
      fractionKey,
      trailingIndex: null
    };
  } else {
    // Clear all pulse highlights first (simple pattern from App1)
    pulses.forEach(p => p.classList.remove('active'));

    setFractionHighlightKey(null);
    const targetIndex = idx;
    const current = pulses[targetIndex];

    // Always trigger reflow before adding active (like App1)
    if (current) {
      void current.offsetWidth;
      current.classList.add('active');
    }

    // Add trailing pulse if looping back to 0
    let trailingIndex = null;
    if (loopEnabled && targetIndex === 0 && pulses.length > 0) {
      trailingIndex = pulses.length - 1;
      const last = pulses[trailingIndex];
      if (last) {
        last.classList.add('active');  // No reflow for trailing
      }
    }
    if (pulseSeqEl) {
      const cacheMatches = lastPulseScrollCache.type === 'int'
        && lastPulseScrollCache.index === targetIndex
        && lastPulseScrollCache.trailingIndex === trailingIndex;
      const scrollAligned = cacheMatches
        && lastPulseScrollCache.scrollLeft != null
        && Math.abs(pulseSeqEl.scrollLeft - lastPulseScrollCache.scrollLeft) < 0.5;

      const rect = cacheMatches && lastPulseScrollCache.rect
        ? lastPulseScrollCache.rect
        : getPulseSeqRectForIndex(targetIndex);
      let trailingRect = null;
      if (trailingIndex != null) {
        trailingRect = cacheMatches && lastPulseScrollCache.trailingRect
          ? lastPulseScrollCache.trailingRect
          : getPulseSeqRectForIndex(trailingIndex);
      }

      if (rect) {
        newScrollLeft = scrollAligned
          ? pulseSeqEl.scrollLeft
          : scrollPulseSeqToRect(rect);
        pulseSeqController.setActiveIndex(targetIndex, {
          rect,
          trailingIndex,
          trailingRect: trailingIndex != null ? trailingRect : null,
          scrollLeft: newScrollLeft
        });
        lastPulseScrollCache = {
          type: 'int',
          index: targetIndex,
          fractionKey: null,
          trailingIndex,
          rect,
          trailingRect: trailingIndex != null ? trailingRect : null,
          scrollLeft: newScrollLeft
        };
      } else {
        pulseSeqController.clearActive();
        resetPulseScrollCache();
      }
    } else {
      pulseSeqController.clearActive();
      resetPulseScrollCache();
    }
    lastPulseHighlightState = {
      type: 'int',
      index: targetIndex,
      fractionKey: null,
      trailingIndex
    };
  }
}

function stopVisualSync() {
  if (visualSyncHandle != null) {
    cancelAnimationFrame(visualSyncHandle);
    visualSyncHandle = null;
  }
  lastVisualStep = null;
  lastNormalizedStep = null;
  fractionStore.lastHighlightType = null;
  fractionStore.lastHighlightIntIndex = null;
  fractionStore.lastHighlightFractionKey = null;
}

function syncVisualState() {
  if (!isPlaying || !audio || typeof audio.getVisualState !== 'function') return;
  const state = audio.getVisualState();
  if (!state || !Number.isFinite(state.step)) return;

  // Protection against duplicate calls - like App1
  if (lastVisualStep === state.step) return;
  lastVisualStep = state.step;

  const resolution = Math.max(1, Math.round(currentAudioResolution || 1));
  const baseCount = pulses.length > 1 ? pulses.length - 1 : 0;

  // Check if this is an integer step (divisible by resolution)
  const isIntegerStep = state.step % resolution === 0;

  if (isIntegerStep && baseCount > 0) {
    // Use simple App1-style highlighting for integer pulses
    // Divide by resolution to get the actual pulse index
    const pulseIndex = state.step / resolution;
    highlightIntegerPulse(pulseIndex);
  } else {
    // Use complex logic for fractional pulses
    highlightPulse(state);
  }

  if (state.cycle && Number.isFinite(state.cycle.cycleIndex) && Number.isFinite(state.cycle.subdivisionIndex)) {
    highlightCycle(state.cycle);
  }
}

function startVisualSync() {
  stopVisualSync();
  const step = () => {
    visualSyncHandle = null;
    if (!isPlaying || !audio) return;
    syncVisualState();
    visualSyncHandle = requestAnimationFrame(step);
  };
  visualSyncHandle = requestAnimationFrame(step);
}

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
    { id: 'pulse',  label: 'Pulso/Pulso 0', allowSolo: true },
    { id: 'subdivision', label: 'Subdivisión',  allowSolo: true },
    { id: 'accent', label: 'Seleccionado',  allowSolo: true },
    { id: 'master', label: 'Master',        allowSolo: false, isMaster: true }
  ]
});
