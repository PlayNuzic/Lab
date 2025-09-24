import { TimelineAudio, getMixer, subscribeMixer } from '../../libs/sound/index.js';
import { initSoundDropdown } from '../../libs/shared-ui/sound-dropdown.js';
import { attachHover } from '../../libs/shared-ui/hover.js';
import { computeHitSizePx, solidMenuBackground, computeNumberFontRem } from './utils.js';
import { FRACTION_INLINE_SLOT_ID } from '../../libs/app-common/template.js';
import { initRandomMenu } from '../../libs/app-common/random-menu.js';
import { createSchedulingBridge, bindSharedSoundEvents } from '../../libs/app-common/audio.js';
import { toRange } from '../../libs/app-common/range.js';
import { fromLgAndTempo, toPlaybackPulseCount, gridFromOrigin, computeSubdivisionFontRem } from '../../libs/app-common/subdivision.js';
import { initMixerMenu } from '../../libs/app-common/mixer-menu.js';
// Using local header controls for App2 (no shared init)

let audio;
let audioInitPromise = null;



const schedulingBridge = createSchedulingBridge({ getAudio: () => audio });
window.addEventListener('sharedui:scheduling', schedulingBridge.handleSchedulingEvent);
bindSharedSoundEvents({
  getAudio: () => audio,
  mapping: {
    baseSound: 'setBase',
    accentSound: 'setAccent',
    startSound: 'setStart'
  }
});
const inputLg = document.getElementById('inputLg');
const inputV = document.getElementById('inputV');
const inputT = document.getElementById('inputT');
const inputVUp = document.getElementById('inputVUp');
const inputVDown = document.getElementById('inputVDown');
const inputLgUp = document.getElementById('inputLgUp');
const inputLgDown = document.getElementById('inputLgDown');
const ledLg = document.getElementById('ledLg');
const ledV = document.getElementById('ledV');
const ledT = document.getElementById('ledT');
const unitLg = document.getElementById('unitLg');
const unitV = document.getElementById('unitV');
const unitT = document.getElementById('unitT');
// Pulse sequence UI element (contenteditable div in template)
const pulseSeqEl = document.getElementById('pulseSeq');
const formula = document.getElementById('formula');
const timelineWrapper = document.getElementById('timelineWrapper');
const timeline = document.getElementById('timeline');
const shouldRenderTIndicator = Boolean(inputT);
const tIndicator = shouldRenderTIndicator ? (() => {
  const indicator = document.createElement('div');
  indicator.id = 'tIndicator';
  // Start hidden to avoid flicker during first layout
  indicator.style.visibility = 'hidden';
  timeline.appendChild(indicator);
  return indicator;
})() : null;
const playBtn = document.getElementById('playBtn');
const loopBtn = document.getElementById('loopBtn');
const resetBtn = document.getElementById('resetBtn');
const tapBtn = document.getElementById('tapTempoBtn');
const tapHelp = document.getElementById('tapHelp');
const circularTimelineToggle = document.getElementById('circularTimelineToggle');
const randomBtn = document.getElementById('randomBtn');
const randomMenu = document.getElementById('randomMenu');
const randLgToggle = document.getElementById('randLgToggle');
const randLgMin = document.getElementById('randLgMin');
const randLgMax = document.getElementById('randLgMax');
const randVToggle = document.getElementById('randVToggle');
const randVMin = document.getElementById('randVMin');
const randVMax = document.getElementById('randVMax');
const randPulsesToggle = document.getElementById('randPulsesToggle');
const randomCount = document.getElementById('randomCount');
const randTToggle = document.getElementById('randTToggle');
const randTMin = document.getElementById('randTMin');
const randTMax = document.getElementById('randTMax');
const randNToggle = document.getElementById('randNToggle');
const randNMin = document.getElementById('randNMin');
const randNMax = document.getElementById('randNMax');
const randDToggle = document.getElementById('randDToggle');
const randDMin = document.getElementById('randDMin');
const randDMax = document.getElementById('randDMax');
const randComplexToggle = document.getElementById('randComplexToggle');
// Mute is managed by the shared header (#muteBtn)
const themeSelect = document.getElementById('themeSelect');
const selectColor = document.getElementById('selectColor');
const baseSoundSelect = document.getElementById('baseSoundSelect');
const accentSoundSelect = document.getElementById('accentSoundSelect');
const startSoundSelect = document.getElementById('startSoundSelect');
const pulseToggleBtn = document.getElementById('pulseToggleBtn');
const selectedToggleBtn = document.getElementById('selectedToggleBtn');
const cycleToggleBtn = document.getElementById('cycleToggleBtn');
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
const fractionDefaults = {
  numerator: null,
  denominator: null
};

let numeratorInput;
let denominatorInput;
let fractionInfoBubble;
let numeratorFieldWrapper;
let denominatorFieldWrapper;
let numeratorFieldPlaceholder;
let denominatorFieldPlaceholder;
const DEFAULT_NUMERATOR_HOVER_TEXT = 'Numerador (pulsos por ciclo)';
const DEFAULT_DENOMINATOR_HOVER_TEXT = 'Denominador (subdivisiones)';
const FRACTION_HOVER_NUMERATOR_TYPE = 'numerator';
const FRACTION_HOVER_DENOMINATOR_TYPE = 'denominator';
let currentFractionInfo = createEmptyFractionInfo();
let currentFractionMultipleMessage = '';
let fractionInfoHideTimer = null;

const randomDefaults = {
  Lg: { enabled: true, range: [2, 30] },
  V: { enabled: true, range: [40, 320] },
  T: { enabled: true, range: [0.1, 20] },
  Pulses: { enabled: true, count: '' },
  n: { enabled: true, range: [1, 9] },
  d: { enabled: true, range: [1, 9] },
  allowComplex: true
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

const randomConfig = { ...randomDefaults, ...loadRandomConfig() };

function toIntRange(minInput, maxInput, fallback) {
  const fallbackRange = Array.isArray(fallback) ? fallback : [1, 1];
  const [lo, hi] = toRange(minInput, maxInput, fallbackRange);
  const normalizedLo = Number.isFinite(lo) ? Math.max(1, Math.round(lo)) : fallbackRange[0];
  const normalizedHiRaw = Number.isFinite(hi) ? Math.round(hi) : fallbackRange[1];
  const normalizedHi = Math.max(normalizedLo, Math.max(1, normalizedHiRaw));
  return [normalizedLo, normalizedHi];
}

/**
 * Apply stored random configuration values to the associated DOM controls.
 * @param {Record<string, any>} cfg
 */
function applyRandomConfig(cfg) {
  if (randLgToggle) randLgToggle.checked = cfg.Lg.enabled;
  if (randLgMin) randLgMin.value = cfg.Lg.range[0];
  if (randLgMax) randLgMax.value = cfg.Lg.range[1];
  if (randVToggle) randVToggle.checked = cfg.V.enabled;
  if (randVMin) randVMin.value = cfg.V.range[0];
  if (randVMax) randVMax.value = cfg.V.range[1];
  if (cfg.T) {
    if (randTToggle) randTToggle.checked = cfg.T.enabled;
    if (randTMin) randTMin.value = cfg.T.range[0];
    if (randTMax) randTMax.value = cfg.T.range[1];
  }
  if (cfg.n && randNToggle && randNMin && randNMax) {
    randNToggle.checked = cfg.n.enabled;
    randNMin.value = cfg.n.range[0];
    randNMax.value = cfg.n.range[1];
  }
  if (cfg.d && randDToggle && randDMin && randDMax) {
    randDToggle.checked = cfg.d.enabled;
    randDMin.value = cfg.d.range[0];
    randDMax.value = cfg.d.range[1];
  }
  if (typeof cfg.allowComplex === 'boolean' && randComplexToggle) {
    randComplexToggle.checked = cfg.allowComplex;
  }
  if (randPulsesToggle && randomCount) {
    randPulsesToggle.checked = cfg.Pulses.enabled;
    randomCount.value = cfg.Pulses.count ?? '';
  }
}

/**
 * Persist the current random menu configuration back to storage.
 */
function updateRandomConfig() {
  randomConfig.Lg = {
    enabled: randLgToggle.checked,
    range: toRange(randLgMin?.value, randLgMax?.value, randomDefaults.Lg.range)
  };
  randomConfig.V = {
    enabled: randVToggle.checked,
    range: toRange(randVMin?.value, randVMax?.value, randomDefaults.V.range)
  };
  const previousTRange = randomConfig.T?.range ?? randomDefaults.T.range;
  const previousTEnabled = randomConfig.T?.enabled ?? randomDefaults.T.enabled;
  randomConfig.T = {
    enabled: randTToggle ? randTToggle.checked : previousTEnabled,
    range: (randTMin && randTMax)
      ? toRange(randTMin?.value, randTMax?.value, previousTRange)
      : previousTRange
  };
  const previousNRange = randomConfig.n?.range ?? randomDefaults.n.range;
  randomConfig.n = {
    enabled: randNToggle ? randNToggle.checked : (randomConfig.n?.enabled ?? randomDefaults.n.enabled),
    range: (randNMin && randNMax)
      ? toIntRange(randNMin.value, randNMax.value, previousNRange)
      : previousNRange
  };
  const previousDRange = randomConfig.d?.range ?? randomDefaults.d.range;
  randomConfig.d = {
    enabled: randDToggle ? randDToggle.checked : (randomConfig.d?.enabled ?? randomDefaults.d.enabled),
    range: (randDMin && randDMax)
      ? toIntRange(randDMin.value, randDMax.value, previousDRange)
      : previousDRange
  };
  if (randComplexToggle) {
    randomConfig.allowComplex = randComplexToggle.checked;
  } else if (typeof randomConfig.allowComplex !== 'boolean') {
    randomConfig.allowComplex = randomDefaults.allowComplex;
  }
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
  randNToggle, randNMin, randNMax,
  randDToggle, randDMin, randDMax,
  randComplexToggle,
  randPulsesToggle, randomCount
].forEach(el => el?.addEventListener('change', updateRandomConfig));

function parseIntSafe(val) {
  const n = Number.parseInt(val, 10);
  return Number.isFinite(n) ? n : NaN;
}

function createEmptyFractionInfo() {
  return {
    numerator: null,
    denominator: null,
    reducedNumerator: null,
    reducedDenominator: null,
    isMultiple: false,
    multipleFactor: 1
  };
}

function gcd(a, b) {
  let x = Math.abs(Number(a));
  let y = Math.abs(Number(b));
  if (!Number.isFinite(x) || !Number.isFinite(y) || x === 0 || y === 0) {
    return Number.isFinite(x) && x > 0 ? x : Number.isFinite(y) && y > 0 ? y : 1;
  }
  while (y !== 0) {
    const temp = x % y;
    x = y;
    y = temp;
  }
  return x || 1;
}

function lcm(a, b) {
  const x = Math.abs(Math.round(Number(a) || 0));
  const y = Math.abs(Math.round(Number(b) || 0));
  if (!Number.isFinite(x) || !Number.isFinite(y) || x === 0 || y === 0) {
    return 1;
  }
  return Math.abs((x / gcd(x, y)) * y) || 1;
}

function computeFractionInfo(numerator, denominator) {
  const info = createEmptyFractionInfo();
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || numerator <= 0 || denominator <= 0) {
    return info;
  }
  info.numerator = numerator;
  info.denominator = denominator;
  const divisor = gcd(numerator, denominator);
  if (divisor <= 1) {
    return info;
  }
  info.reducedNumerator = numerator / divisor;
  info.reducedDenominator = denominator / divisor;
  info.isMultiple = true;
  info.multipleFactor = denominator / info.reducedDenominator;
  return info;
}

function buildReductionHoverText(info) {
  if (!info || !info.isMultiple) return '';
  const accentEvery = Math.max(1, Math.round(info.multipleFactor));
  const noun = accentEvery === 1 ? 'subdivisión' : 'subdivisiones';
  return `Esta fracción es múltiple de ${info.reducedNumerator}/${info.reducedDenominator}.\nSe repite ${accentEvery} veces la misma subdivisión en cada fracción ${info.numerator}/${info.denominator}.`;
}

function clearFractionInfoHideTimer() {
  if (fractionInfoHideTimer) {
    clearTimeout(fractionInfoHideTimer);
    fractionInfoHideTimer = null;
  }
}

function hideFractionInfoBubble({ clearMessage = false } = {}) {
  if (!fractionInfoBubble) return;
  clearFractionInfoHideTimer();
  fractionInfoBubble.classList.add('fraction-info-bubble--hidden');
  fractionInfoBubble.classList.remove('fraction-info-bubble--visible');
  if (clearMessage) {
    fractionInfoBubble.textContent = '';
  }
}

function showFractionInfoBubble({ message, autoHide = false } = {}) {
  if (!fractionInfoBubble) return;
  const resolvedMessage = message || currentFractionMultipleMessage;
  if (!resolvedMessage) return;
  clearFractionInfoHideTimer();
  solidMenuBackground(fractionInfoBubble);
  fractionInfoBubble.textContent = resolvedMessage;
  fractionInfoBubble.classList.remove('fraction-info-bubble--hidden');
  fractionInfoBubble.classList.add('fraction-info-bubble--visible');
  if (autoHide) {
    fractionInfoHideTimer = setTimeout(() => {
      hideFractionInfoBubble();
    }, 3000);
  }
}

function getDefaultFractionHoverText(target) {
  if (!target || !target.dataset) return '';
  if (target.dataset.fractionHoverType === FRACTION_HOVER_NUMERATOR_TYPE) {
    return DEFAULT_NUMERATOR_HOVER_TEXT;
  }
  if (target.dataset.fractionHoverType === FRACTION_HOVER_DENOMINATOR_TYPE) {
    return DEFAULT_DENOMINATOR_HOVER_TEXT;
  }
  return '';
}

function handleFractionHoverEnter(event) {
  const target = event?.currentTarget || null;
  const message = currentFractionMultipleMessage || getDefaultFractionHoverText(target);
  if (!message) return;
  showFractionInfoBubble({ message });
}

function handleFractionHoverLeave() {
  if (!fractionInfoBubble) return;
  hideFractionInfoBubble();
}

function registerFractionHoverTarget(target, { useFocus = false } = {}) {
  if (!target) return;
  target.addEventListener('mouseenter', handleFractionHoverEnter);
  target.addEventListener('mouseleave', handleFractionHoverLeave);
  if (useFocus) {
    target.addEventListener('focus', handleFractionHoverEnter);
    target.addEventListener('blur', handleFractionHoverLeave);
  }
}

function updateFractionInfoBubble(info, { reveal = false } = {}) {
  if (!fractionInfoBubble) return;
  clearFractionInfoHideTimer();
  if (!info || !info.isMultiple) {
    currentFractionMultipleMessage = '';
    hideFractionInfoBubble({ clearMessage: true });
    return;
  }
  currentFractionMultipleMessage = buildReductionHoverText(info);
  if (reveal) {
    showFractionInfoBubble({ message: currentFractionMultipleMessage, autoHide: true });
  } else if (fractionInfoBubble.classList.contains('fraction-info-bubble--visible')) {
    showFractionInfoBubble({ message: currentFractionMultipleMessage });
  }
}

function setFractionFieldEmptyState(wrapper, placeholder, isEmpty) {
  if (!wrapper) return;
  const empty = !!isEmpty;
  wrapper.classList.toggle('fraction-field--empty', empty);
  if (placeholder) {
    placeholder.classList.toggle('fraction-field-placeholder--visible', empty);
  }
}

function updateFractionFieldState(numerator, denominator) {
  const hasNumerator = Number.isFinite(numerator) && numerator > 0;
  const hasDenominator = Number.isFinite(denominator) && denominator > 0;
  setFractionFieldEmptyState(numeratorFieldWrapper, numeratorFieldPlaceholder, !hasNumerator);
  setFractionFieldEmptyState(denominatorFieldWrapper, denominatorFieldPlaceholder, !hasDenominator);
}

function updateFractionUI(numerator, denominator) {
  currentFractionInfo = computeFractionInfo(numerator, denominator);
  updateFractionFieldState(numerator, denominator);
  updateFractionInfoBubble(currentFractionInfo, { reveal: true });
  updatePulseSeqFractionDisplay(numerator, denominator);
  if (fractionalPulseSelections.length > 0) {
    sanitizePulseSeq({ causedBy: 'fraction-change', skipCaret: true });
  }
}

function persistFractionField(input, key) {
  if (!input || !key) return;
  const value = parseIntSafe(input.value);
  if (!Number.isFinite(value) || value <= 0) {
    clearOpt(key);
    return;
  }
  saveOpt(key, String(value));
}

function adjustInput(input, delta) {
  if (!input) return;
  const current = parseIntSafe(input.value);
  const next = Number.isFinite(current) ? Math.max(1, current + delta) : 1;
  setValue(input, next);
  handleInput();
  if (input === numeratorInput) {
    persistFractionField(input, FRACTION_NUMERATOR_KEY);
  } else if (input === denominatorInput) {
    persistFractionField(input, FRACTION_DENOMINATOR_KEY);
  }
}

function initFractionEditor() {
  const slot = document.getElementById(FRACTION_INLINE_SLOT_ID);
  if (!slot) return;
  slot.innerHTML = '';
  slot.classList.add('fraction-inline-slot');

  const container = document.createElement('div');
  container.className = 'fraction-editor';

  const wrapper = document.createElement('div');
  wrapper.className = 'fraction-editor-wrapper';
  wrapper.appendChild(container);
  slot.appendChild(wrapper);

  fractionInfoBubble = document.createElement('div');
  fractionInfoBubble.className = 'fraction-info-bubble fraction-info-bubble--hidden';
  fractionInfoBubble.setAttribute('role', 'status');
  fractionInfoBubble.setAttribute('aria-live', 'polite');
  solidMenuBackground(fractionInfoBubble);
  wrapper.appendChild(fractionInfoBubble);

  const createField = ({ wrapperClass, ariaUp, ariaDown, placeholder }) => {
    const fieldWrapper = document.createElement('div');
    fieldWrapper.className = `fraction-field ${wrapperClass}`;
    fieldWrapper.classList.add('fraction-field--empty');
    fieldWrapper.dataset.fractionHoverType = wrapperClass;

    const input = document.createElement('input');
    input.type = 'number';
    input.min = '1';
    input.step = '1';
    input.value = '';
    input.className = wrapperClass;
    input.dataset.fractionHoverType = wrapperClass;
    fieldWrapper.appendChild(input);

    const placeholderEl = document.createElement('div');
    placeholderEl.className = 'fraction-field-placeholder fraction-field-placeholder--visible';
    placeholderEl.textContent = placeholder;
    placeholderEl.setAttribute('aria-hidden', 'true');
    fieldWrapper.appendChild(placeholderEl);

    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    const up = document.createElement('button');
    up.type = 'button';
    up.className = 'spin up';
    if (ariaUp) up.setAttribute('aria-label', ariaUp);
    const down = document.createElement('button');
    down.type = 'button';
    down.className = 'spin down';
    if (ariaDown) down.setAttribute('aria-label', ariaDown);
    spinner.appendChild(up);
    spinner.appendChild(down);
    fieldWrapper.appendChild(spinner);

    return { wrapper: fieldWrapper, input, up, down, placeholder: placeholderEl };
  };

  const top = document.createElement('div');
  top.className = 'top';
  const numeratorField = createField({
    wrapperClass: 'numerator',
    ariaUp: 'Incrementar numerador',
    ariaDown: 'Decrementar numerador',
    placeholder: 'n'
  });
  numeratorInput = numeratorField.input;
  numeratorFieldWrapper = numeratorField.wrapper;
  numeratorFieldPlaceholder = numeratorField.placeholder;
  top.appendChild(numeratorField.wrapper);
  registerFractionHoverTarget(numeratorField.wrapper);
  registerFractionHoverTarget(numeratorInput, { useFocus: true });

  const bottom = document.createElement('div');
  bottom.className = 'bottom';
  const denominatorField = createField({
    wrapperClass: 'denominator',
    ariaUp: 'Incrementar denominador',
    ariaDown: 'Decrementar denominador',
    placeholder: 'd'
  });
  denominatorInput = denominatorField.input;
  denominatorFieldWrapper = denominatorField.wrapper;
  denominatorFieldPlaceholder = denominatorField.placeholder;
  bottom.appendChild(denominatorField.wrapper);
  registerFractionHoverTarget(denominatorField.wrapper);
  registerFractionHoverTarget(denominatorInput, { useFocus: true });

  container.appendChild(top);
  container.appendChild(bottom);

  const enforceInt = (input, storageKey) => {
    if (!input) return;
    const normalize = () => {
      let val = parseIntSafe(input.value);
      if (!Number.isFinite(val) || val <= 0) {
        input.value = '';
      } else {
        input.value = String(val);
      }
      persistFractionField(input, storageKey);
      handleInput();
    };
    input.addEventListener('input', normalize);
    input.addEventListener('blur', normalize);
  };

  enforceInt(numeratorInput, FRACTION_NUMERATOR_KEY);
  enforceInt(denominatorInput, FRACTION_DENOMINATOR_KEY);

  addRepeatPress(numeratorField.up, () => adjustInput(numeratorInput, +1));
  addRepeatPress(numeratorField.down, () => adjustInput(numeratorInput, -1));
  addRepeatPress(denominatorField.up, () => adjustInput(denominatorInput, +1));
  addRepeatPress(denominatorField.down, () => adjustInput(denominatorInput, -1));

  updateFractionFieldState(null, null);
}

function getFraction() {
  const rawNumerator = numeratorInput ? parseIntSafe(numeratorInput.value) : NaN;
  const rawDenominator = denominatorInput ? parseIntSafe(denominatorInput.value) : NaN;
  return {
    numerator: Number.isFinite(rawNumerator) && rawNumerator > 0 ? rawNumerator : null,
    denominator: Number.isFinite(rawDenominator) && rawDenominator > 0 ? rawDenominator : null
  };
}

function initFractionState() {
  if (!numeratorInput || !denominatorInput) return;
  const storedNumerator = parseIntSafe(loadOpt(FRACTION_NUMERATOR_KEY));
  const storedDenominator = parseIntSafe(loadOpt(FRACTION_DENOMINATOR_KEY));

  const numerator = Number.isFinite(storedNumerator) && storedNumerator > 0
    ? storedNumerator
    : fractionDefaults.numerator;
  const denominator = Number.isFinite(storedDenominator) && storedDenominator > 0
    ? storedDenominator
    : fractionDefaults.denominator;

  isUpdating = true;
  numeratorInput.value = Number.isFinite(numerator) && numerator > 0 ? String(numerator) : '';
  denominatorInput.value = Number.isFinite(denominator) && denominator > 0 ? String(denominator) : '';
  isUpdating = false;

  if (!(Number.isFinite(numerator) && numerator > 0)) {
    clearOpt(FRACTION_NUMERATOR_KEY);
  }
  if (!(Number.isFinite(denominator) && denominator > 0)) {
    clearOpt(FRACTION_DENOMINATOR_KEY);
  }

  updateFractionUI(numerator, denominator);
}

// No actualitza la memòria a cada tecleig: es confirma amb Enter o blur
// pulseSeqEl?.addEventListener('input', handlePulseSeqInput);

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
const fractionalSelectionState = new Map();
const selectedFractionKeys = new Set();
const fractionHitMap = new Map();
// Hit targets (separate from the visual dots) and drag mode
let dragMode = 'select'; // 'select' | 'deselect'
// --- Selection memory across Lg changes ---
let pulseMemory = []; // index -> selected
let pulseSeqRanges = {};
let fractionalPulseSelections = [];
let pulseSeqFractionNumeratorEl = null;
let pulseSeqFractionDenominatorEl = null;
let lastFractionGap = null;
let currentAudioResolution = 1;
const FRACTION_POSITION_EPSILON = 1e-6;

function nearestPulseIndex(value) {
  if (!Number.isFinite(value)) return null;
  const nearest = Math.round(value);
  return Math.abs(value - nearest) < FRACTION_POSITION_EPSILON ? nearest : null;
}
const voiceHighlightHandlers = new Map();

function ensurePulseMemory(size) {
  if (size >= pulseMemory.length) {
    for (let i = pulseMemory.length; i <= size; i++) pulseMemory[i] = false;
  }
}

// Clear all persistent pulse selection (memory beyond current Lg too)
function clearPersistentPulses(){
  pulseMemory = [];
  try { selectedPulses.clear(); } catch {}
  /* Keep UI consistent; will be rebuilt by subsequent calls */
  fractionalSelectionState.clear();
  selectedFractionKeys.clear();
  fractionalPulseSelections = [];
  updatePulseSeqField();
  applyFractionSelectionClasses();
}
// UI thresholds for number rendering
const PULSE_NUMBER_HIDE_THRESHOLD = 71;
const SUBDIVISION_HIDE_THRESHOLD = 41;
const NUMBER_CIRCLE_OFFSET  = 34;    // px distance from circle to number label
const MIN_SUBDIVISION_LABEL_SPACING_PX = 40;

function makeFractionKey(base, numerator, denominator) {
  if (!Number.isFinite(base) || !Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return null;
  }
  return `${base}+${numerator}/${denominator}`;
}

function fractionValue(base, numerator, denominator) {
  if (!Number.isFinite(base) || !Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return NaN;
  }
  return base + numerator / denominator;
}

function cycleNotationToFraction(cycleIndex, subdivisionIndex, pulsesPerCycle, denominator) {
  if (!(Number.isFinite(cycleIndex) && cycleIndex >= 0)) return null;
  if (!(Number.isFinite(subdivisionIndex) && subdivisionIndex >= 0)) return null;
  if (!(Number.isFinite(pulsesPerCycle) && pulsesPerCycle > 0)) return null;
  if (!(Number.isFinite(denominator) && denominator > 0)) return null;

  const step = pulsesPerCycle / denominator;
  const rawValue = cycleIndex * pulsesPerCycle + subdivisionIndex * step;
  let base = Math.floor(rawValue + FRACTION_POSITION_EPSILON);
  let fractional = rawValue - base;
  if (fractional < FRACTION_POSITION_EPSILON) {
    return null;
  }
  let numerator = Math.round(fractional * denominator);
  if (numerator <= 0) {
    return null;
  }
  while (numerator >= denominator) {
    numerator -= denominator;
    base += 1;
  }
  const value = base + numerator / denominator;
  return { base, numerator, value };
}

function fractionDisplay(base, numerator, denominator, { cycleIndex, subdivisionIndex, pulsesPerCycle } = {}) {
  const safeBase = Number.isFinite(base) ? base : 0;
  const safeNumerator = Number.isFinite(numerator) ? numerator : 0;
  const den = Number.isFinite(denominator) && denominator > 0 ? denominator : null;
  const resolvedPulsesPerCycle = Number.isFinite(pulsesPerCycle) && pulsesPerCycle > 0
    ? pulsesPerCycle
    : (() => {
        const { numerator: activeNumerator } = getFraction();
        return Number.isFinite(activeNumerator) && activeNumerator > 0 ? activeNumerator : null;
      })();

  const value = den ? safeBase + safeNumerator / den : safeBase;
  const maybePulse = nearestPulseIndex(value);
  if (maybePulse != null) {
    return String(maybePulse);
  }

  if (den && resolvedPulsesPerCycle) {
    let cycle = Number.isFinite(cycleIndex) && cycleIndex >= 0 ? Math.floor(cycleIndex) : null;
    let subdivision = Number.isFinite(subdivisionIndex) && subdivisionIndex >= 0 ? Math.floor(subdivisionIndex) : null;
    if (cycle == null || subdivision == null) {
      const cycleFloat = value / resolvedPulsesPerCycle;
      cycle = Math.floor(cycleFloat + FRACTION_POSITION_EPSILON);
      const cycleStart = cycle * resolvedPulsesPerCycle;
      const step = resolvedPulsesPerCycle / den;
      const normalized = (value - cycleStart) / step;
      subdivision = Math.floor(normalized + FRACTION_POSITION_EPSILON);
      if (subdivision < 0) subdivision = 0;
      if (subdivision >= den) {
        const carry = Math.floor(subdivision / den);
        cycle += carry;
        subdivision -= carry * den;
      }
    }
    const baseIndex = Number.isFinite(value)
      ? Math.floor(value + FRACTION_POSITION_EPSILON)
      : (Number.isFinite(safeBase) ? Math.floor(safeBase) : null);
    if (Number.isFinite(baseIndex)) {
      if (subdivision === 0) {
        return String(baseIndex);
      }
      return `${baseIndex}.${subdivision}`;
    }
    return `${cycle}.${subdivision}`;
  }

  return `${safeBase}.${safeNumerator}`;
}

function getFractionInfoFromElement(el) {
  if (!el) return null;
  const base = parseIntSafe(el.dataset.baseIndex);
  const numerator = parseIntSafe(el.dataset.fractionNumerator);
  const denominator = parseIntSafe(el.dataset.fractionDenominator);
  if (!Number.isFinite(base) || !Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return null;
  }
  const key = el.dataset.fractionKey || makeFractionKey(base, numerator, denominator);
  if (!key) return null;
  const value = Number.isFinite(parseFloat(el.dataset.value))
    ? parseFloat(el.dataset.value)
    : fractionValue(base, numerator, denominator);
  const display = el.dataset.display || fractionDisplay(base, numerator, denominator);
  return { type: 'fraction', base, numerator, denominator, key, value, display };
}

function applyFractionSelectionClasses() {
  cycleMarkers.forEach(marker => {
    const key = marker.dataset.fractionKey;
    if (!key) {
      marker.classList.remove('selected');
      return;
    }
    marker.classList.toggle('selected', selectedFractionKeys.has(key));
  });
}

function rebuildFractionSelections(opts = {}) {
  selectedFractionKeys.clear();
  fractionalPulseSelections = Array.from(fractionalSelectionState.values())
    .filter(item => item && Number.isFinite(item.value))
    .map(item => ({
      ...item,
      display: fractionDisplay(item.base, item.numerator, item.denominator)
    }))
    .sort((a, b) => a.value - b.value);
  fractionalPulseSelections.forEach(item => selectedFractionKeys.add(item.key));
  applyFractionSelectionClasses();
  if (!opts.skipUpdateField) {
    updatePulseSeqField();
  }
}

function setFractionSelected(info, shouldSelect) {
  if (!info || !info.key) return;
  const { key, base, numerator, denominator } = info;
  const value = Number.isFinite(info.value) ? info.value : fractionValue(base, numerator, denominator);
  if (!Number.isFinite(value)) return;
  if (shouldSelect) {
    const display = info.display || fractionDisplay(base, numerator, denominator);
    fractionalSelectionState.set(key, { base, numerator, denominator, value, display, key });
  } else {
    fractionalSelectionState.delete(key);
  }
  rebuildFractionSelections();
}

function computeAudioSchedulingState() {
  const lg = parseInt(inputLg.value);
  const v = parseFloat(inputV.value);
  const { numerator, denominator } = getFraction();

  const validLg = Number.isFinite(lg) && lg > 0;
  const validV = Number.isFinite(v) && v > 0;

  const grid = gridFromOrigin({ lg: validLg ? lg : 0, numerator, denominator });
  const denominators = new Set([1]);
  if (Number.isFinite(grid.denominator) && grid.denominator > 0) {
    denominators.add(Math.round(grid.denominator));
  }
  fractionalPulseSelections.forEach((item) => {
    if (!item) return;
    const den = Number(item.denominator);
    if (Number.isFinite(den) && den > 0) {
      denominators.add(Math.round(den));
    }
  });

  let resolution = 1;
  denominators.forEach((den) => {
    resolution = Math.max(1, Math.round(lcm(resolution, Math.max(1, den))));
  });

  const playbackTotal = validLg ? toPlaybackPulseCount(lg, loopEnabled) : null;
  const totalPulses = playbackTotal != null ? playbackTotal : null;
  const interval = validV ? (60 / v) : null;
  const patternBeats = validLg ? lg : null;

  const cycleNumerator = Number.isFinite(grid?.numerator) && grid.numerator > 0 ? grid.numerator : null;
  const cycleDenominator = Number.isFinite(grid?.denominator) && grid.denominator > 0 ? grid.denominator : null;
  const hasCycle = grid && grid.cycles > 0 && cycleNumerator != null && cycleDenominator != null;
  const cycleConfig = hasCycle
    ? { numerator: cycleNumerator, denominator: cycleDenominator, onTick: highlightCycle }
    : null;

  const voices = [];
  if (hasCycle) {
    const period = cycleNumerator / cycleDenominator;
    if (Number.isFinite(period) && Math.abs(period - Math.round(period)) > 1e-6) {
      voices.push({ id: `cycle-${cycleNumerator}x${cycleDenominator}`, numerator: cycleNumerator, denominator: cycleDenominator });
    }
  }

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
  if (!Number.isFinite(lg) || lg <= 0) {
    return { base: baseSet, cycle: cycleSet, fraction: fractionSet, combined: combinedSet, resolution: scale };
  }
  const maxIdx = Math.min(lg, pulseMemory.length - 1);
  for (let i = 1; i <= maxIdx; i++) {
    if (pulseMemory[i]) {
      baseSet.add(i);
      combinedSet.add(i * scale);
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
  fractionalPulseSelections.forEach((item) => {
    if (!item || !Number.isFinite(item.value)) return;
    if (item.value <= 0 || item.value >= lg) return;
    fractionSet.add(item.value);
    const scaled = Math.round(item.value * scale);
    if (Math.abs(scaled / scale - item.value) <= epsilon) {
      combinedSet.add(scaled);
    }
  });
  return { base: baseSet, cycle: cycleSet, fraction: fractionSet, combined: combinedSet, resolution: scale };
}

function applySelectionToAudio({ scheduling, instance } = {}) {
  const target = instance || audio;
  if (!target || typeof target.setSelected !== 'function') return null;
  const selection = selectedForAudioFromState({ scheduling });
  target.setSelected({ values: selection.combined, resolution: selection.resolution });
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
function setupPulseSeqMarkup(){
  if (!pulseSeqEl) return;
  if (pulseSeqEl.querySelector('.pz.edit')) return; // already prepared
  const initial = (pulseSeqEl.textContent || '').trim();
  pulseSeqEl.textContent = '';
  const mk = (cls, txt) => {
    const s = document.createElement('span');
    s.className = 'pz ' + cls;
    if (txt != null) s.textContent = txt;
    return s;
  };

  const prefix = mk('prefix', 'Pfr ');

  const fractionWrapper = document.createElement('span');
  fractionWrapper.className = 'pz fraction';
  pulseSeqFractionNumeratorEl = document.createElement('span');
  pulseSeqFractionNumeratorEl.className = 'fraction-number numerator';
  pulseSeqFractionNumeratorEl.dataset.fractionHoverType = FRACTION_HOVER_NUMERATOR_TYPE;
  const fractionBar = document.createElement('span');
  fractionBar.className = 'fraction-bar';
  pulseSeqFractionDenominatorEl = document.createElement('span');
  pulseSeqFractionDenominatorEl.className = 'fraction-number denominator';
  pulseSeqFractionDenominatorEl.dataset.fractionHoverType = FRACTION_HOVER_DENOMINATOR_TYPE;
  fractionWrapper.append(
    pulseSeqFractionNumeratorEl,
    fractionBar,
    pulseSeqFractionDenominatorEl
  );
  registerFractionHoverTarget(pulseSeqFractionNumeratorEl);
  registerFractionHoverTarget(pulseSeqFractionDenominatorEl);

  const spacer = mk('spacer', ' ');
  const openParen = mk('open', '(');
  const zero = mk('zero', '0');
  const edit = (() => {
    const e = mk('edit', initial);
    e.contentEditable = 'true';
    return e;
  })();
  const suffix = mk('suffix', ')');
  const suffixSpacer = mk('suffix-spacer', ' ');
  const lgLabel = mk('lg', '');

  pulseSeqEl.append(prefix, fractionWrapper, spacer, openParen, zero, edit, suffix, suffixSpacer, lgLabel);
  updatePulseSeqFractionDisplay(null, null);
}
setupPulseSeqMarkup();
initFractionEditor();

// Highlight overlay for pulse sequence numbers during playback
const pulseSeqHighlight = document.createElement('div');
const pulseSeqHighlight2 = document.createElement('div');
if (pulseSeqEl) {
  pulseSeqHighlight.id = 'pulseSeqHighlight';
  pulseSeqHighlight2.id = 'pulseSeqHighlight2';
  pulseSeqEl.appendChild(pulseSeqHighlight);
  pulseSeqEl.appendChild(pulseSeqHighlight2);
}

// Helpers for #pulseSeq (use inner span .pz.edit)
function getEditEl(){
  if(!pulseSeqEl) return null;
  return pulseSeqEl.querySelector('.pz.edit') || pulseSeqEl;
}
function getPulseSeqText(){
  const el = getEditEl();
  return el ? (el.textContent || '') : '';
}
function setPulseSeqText(str){
  const el = getEditEl();
  if(!el) return;
  el.textContent = String(str);
}
function setPulseSeqSelection(start, end){
  const el = getEditEl();
  if(!el) return;
  try{
    const sel = window.getSelection();
    const range = document.createRange();
    let node = el.firstChild;
    if(!node){ node = document.createTextNode(''); el.appendChild(node); }
    const len = node.textContent.length;
    const s = Math.max(0, Math.min(start, len));
    const e = Math.max(0, Math.min(end, len));
    range.setStart(node, s);
    range.setEnd(node, e);
    sel.removeAllRanges();
    sel.addRange(range);
  }catch{}
}

function updatePulseSeqFractionDisplay(numerator, denominator) {
  const validNumerator = Number.isFinite(numerator) && numerator > 0 ? numerator : 'n';
  const validDenominator = Number.isFinite(denominator) && denominator > 0 ? denominator : 'd';
  if (pulseSeqFractionNumeratorEl) {
    pulseSeqFractionNumeratorEl.textContent = String(validNumerator);
  }
  if (pulseSeqFractionDenominatorEl) {
    pulseSeqFractionDenominatorEl.textContent = String(validDenominator);
  }
}

// Caret movement entre midpoints (dos espacios)
function getMidpoints(text){ const a=[]; for(let i=1;i<text.length;i++) if(text[i-1]===' '&&text[i]===' ') a.push(i); return a; }
function caretPos(){ const el=getEditEl(); if(!el) return 0; const s=window.getSelection&&window.getSelection(); if(!s||s.rangeCount===0) return 0; const r=s.getRangeAt(0); if(!el.contains(r.startContainer)) return 0; return r.startOffset; }
function moveCaretToNearestMidpoint(){ const el=getEditEl(); if(!el) return; const n=el.firstChild||el; const t=n.textContent||''; const mids=getMidpoints(t); if(!mids.length) return; const p=caretPos(); let best=mids[0],d=Math.abs(p-best); for(const m of mids){const dd=Math.abs(p-m); if(dd<d){best=m; d=dd;}} setPulseSeqSelection(best,best); }
function moveCaretStep(dir){ const el=getEditEl(); if(!el) return; const n=el.firstChild||el; const t=n.textContent||''; const mids=getMidpoints(t); if(!mids.length) return; const p=caretPos(); if(dir>0){ for(const m of mids){ if(m>p){ setPulseSeqSelection(m,m); return; } } setPulseSeqSelection(mids[mids.length-1],mids[mids.length-1]); } else { for(let i=mids.length-1;i>=0;i--){ const m=mids[i]; if(m<p){ setPulseSeqSelection(m,m); return; } } setPulseSeqSelection(mids[0],mids[0]); } }
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
let suppressClickKey = null;       // avoid double-toggle on drag start
// --- Drag selection state ---
let isDragging = false;
let lastDragKey = null;

function getSelectionInfo(target) {
  if (!target) return null;
  if (typeof target.dataset.index !== 'undefined') {
    const idx = parseIntSafe(target.dataset.index);
    if (Number.isFinite(idx)) {
      return { type: 'int', index: idx, selectionKey: `pulse:${idx}` };
    }
  }
  if (target.dataset.fractionKey) {
    const info = getFractionInfoFromElement(target);
    if (info) {
      return { ...info, selectionKey: `fraction:${info.key}` };
    }
  }
  return null;
}

function isSelectionActive(info) {
  if (!info) return false;
  if (info.type === 'fraction') {
    return fractionalSelectionState.has(info.key);
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
    if (suppressClickKey === info.selectionKey) {
      suppressClickKey = null;
      ev.preventDefault();
      ev.stopPropagation();
      return;
    }
    toggleSelectionInfo(info);
  });
  el.addEventListener('pointerenter', () => {
    if (!isDragging) return;
    const info = getSelectionInfo(el);
    if (!info || lastDragKey === info.selectionKey) return;
    lastDragKey = info.selectionKey;
    applySelectionInfo(info, dragMode === 'select');
  });
}

// Start drag on the timeline area and decide drag mode based on first target under pointer
timeline.addEventListener('pointerdown', (e) => {
  isDragging = true;
  lastDragKey = null;
  dragMode = 'select';
  const target = e.target.closest('.pulse-hit, .pulse, .fraction-hit, .cycle-marker');
  const info = getSelectionInfo(target);
  if (info) {
    if (info.type === 'int') {
      const lg = parseIntSafe(inputLg.value);
      if (!Number.isFinite(lg) || info.index === 0 || info.index === lg) {
        suppressClickKey = null;
        lastDragKey = null;
        isDragging = false;
        return;
      }
      ensurePulseMemory(Math.max(info.index, lg));
    }
    dragMode = isSelectionActive(info) ? 'deselect' : 'select';
    applySelectionInfo(info, dragMode === 'select');
    suppressClickKey = info.selectionKey;
    lastDragKey = info.selectionKey;
  }
});
// End/Cancel drag globally
document.addEventListener('pointerup', () => {
  isDragging = false;
  lastDragKey = null;
  // Do not clear suppressClickKey here; allow click handler to consume it
});
document.addEventListener('pointercancel', () => {
  isDragging = false;
  lastDragKey = null;
  suppressClickKey = null;
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


const STORE_PREFIX = 'app4:';
const storeKey = (k) => `${STORE_PREFIX}${k}`;
const saveOpt = (k, v) => { try { localStorage.setItem(storeKey(k), v); } catch {} };
const loadOpt = (k) => { try { return localStorage.getItem(storeKey(k)); } catch { return null; } };
const clearOpt = (k) => { try { localStorage.removeItem(storeKey(k)); } catch {} };

const PULSE_AUDIO_KEY = 'pulseAudio';
const SELECTED_AUDIO_KEY = 'selectedAudio';
const CYCLE_AUDIO_KEY = 'cycleAudio';

let pulseAudioEnabled = true;
let selectedAudioEnabled = true;
let cycleAudioEnabled = true;

function syncToggleButton(button, enabled) {
  if (!button) return;
  button.classList.toggle('active', enabled);
  button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  button.dataset.state = enabled ? 'on' : 'off';
}

function setPulseAudio(value, { persist = true } = {}) {
  const enabled = value !== false;
  pulseAudioEnabled = enabled;
  syncToggleButton(pulseToggleBtn, enabled);
  if (persist) {
    saveOpt(PULSE_AUDIO_KEY, enabled ? '1' : '0');
  }
  if (globalMixer) {
    globalMixer.setChannelMute('pulse', !enabled);
  }
  if (audio && typeof audio.setPulseEnabled === 'function') {
    audio.setPulseEnabled(enabled);
  }
}

function setSelectedAudio(value, { persist = true } = {}) {
  const enabled = value !== false;
  selectedAudioEnabled = enabled;
  syncToggleButton(selectedToggleBtn, enabled);
  if (persist) {
    saveOpt(SELECTED_AUDIO_KEY, enabled ? '1' : '0');
  }
  if (globalMixer) {
    globalMixer.setChannelMute('accent', !enabled);
  }
}

function setCycleAudio(value, { persist = true } = {}) {
  const enabled = value !== false;
  cycleAudioEnabled = enabled;
  syncToggleButton(cycleToggleBtn, enabled);
  if (persist) {
    saveOpt(CYCLE_AUDIO_KEY, enabled ? '1' : '0');
  }
  if (globalMixer) {
    globalMixer.setChannelMute('subdivision', !enabled);
  }
  if (audio && typeof audio.setCycleEnabled === 'function') {
    audio.setCycleEnabled(enabled);
  }
}

const storedPulseAudio = loadOpt(PULSE_AUDIO_KEY);
if (storedPulseAudio === '0') {
  setPulseAudio(false, { persist: false });
} else {
  setPulseAudio(true, { persist: false });
}

const storedSelectedAudio = loadOpt(SELECTED_AUDIO_KEY);
if (storedSelectedAudio === '0') {
  setSelectedAudio(false, { persist: false });
} else {
  setSelectedAudio(true, { persist: false });
}

const storedCycleAudio = loadOpt(CYCLE_AUDIO_KEY);
if (storedCycleAudio === '0') {
  setCycleAudio(false, { persist: false });
} else {
  setCycleAudio(true, { persist: false });
}

pulseToggleBtn?.addEventListener('click', () => {
  setPulseAudio(!pulseAudioEnabled);
});

selectedToggleBtn?.addEventListener('click', () => {
  setSelectedAudio(!selectedAudioEnabled);
});

cycleToggleBtn?.addEventListener('click', () => {
  setCycleAudio(!cycleAudioEnabled);
});

const soloMutedChannels = new Set();
let lastSoloActive = false;

subscribeMixer((snapshot) => {
  if (!snapshot || !Array.isArray(snapshot.channels)) return;
  const findChannel = (id) => snapshot.channels.find(channel => channel.id === id);
  const soloActive = snapshot.channels.some(channel => channel.solo);

  const setters = new Map([
    ['pulse', setPulseAudio],
    ['accent', setSelectedAudio],
    ['subdivision', setCycleAudio]
  ]);

  const currentStates = {
    pulse: pulseAudioEnabled,
    accent: selectedAudioEnabled,
    subdivision: cycleAudioEnabled
  };

  const syncFromChannel = (channelState, setter, current) => {
    if (!channelState) return;
    const channelId = channelState.id;
    const forcedBySolo = soloActive && !channelState.solo && channelState.effectiveMuted && !channelState.muted;
    if (forcedBySolo) {
      if (!soloMutedChannels.has(channelId)) {
        soloMutedChannels.add(channelId);
        setter(false, { persist: false });
      }
      return;
    }

    if (!soloActive && soloMutedChannels.has(channelId)) {
      soloMutedChannels.delete(channelId);
      setter(true, { persist: false });
      return;
    }

    if (soloActive && soloMutedChannels.has(channelId)) {
      return;
    }

    const shouldEnable = !channelState.muted;
    if (current === shouldEnable) return;
    setter(shouldEnable, { persist: false });
  };

  ['pulse', 'accent', 'subdivision'].forEach((id) => {
    const channel = findChannel(id);
    const setter = setters.get(id);
    const current = currentStates[id];
    if (setter) syncFromChannel(channel, setter, current);
  });

  if (!soloActive && lastSoloActive && soloMutedChannels.size) {
    soloMutedChannels.forEach((id) => {
      const setter = setters.get(id);
      if (setter) setter(true, { persist: false });
    });
    soloMutedChannels.clear();
  }

  lastSoloActive = soloActive;
});

function clearStoredPreferences() {
  try {
    const prefix = STORE_PREFIX;
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) keysToRemove.push(key);
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch {}
}

let factoryResetPending = false;
window.addEventListener('sharedui:factoryreset', () => {
  if (factoryResetPending) return;
  factoryResetPending = true;
  clearStoredPreferences();
  window.location.reload();
});

initFractionState();

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

document.addEventListener('sharedui:mute', async (e) => {
  const val = !!(e && e.detail && e.detail.value);
  saveOpt('mute', val ? '1' : '0');
  const a = await initAudio();
  if (a && typeof a.setMute === 'function') a.setMute(val);
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
layoutTimeline();

loopBtn.addEventListener('click', () => {
  loopEnabled = !loopEnabled;
  loopBtn.classList.toggle('active', loopEnabled);
  const lg = parseInt(inputLg.value);
  if (!isNaN(lg)) {
    ensurePulseMemory(lg);
    // Rebuild visible selection from memory and refresh labels
    syncSelectedFromMemory();
    updatePulseNumbers();
    if (isPlaying) {
      applySelectionToAudio();
    }
  }
  // Sincronitza amb el motor en temps real si està sonant
  if (isPlaying && audio && typeof audio.setLoop === 'function') {
    audio.setLoop(loopEnabled);
  }
  layoutTimeline();
});

resetBtn.addEventListener('click', () => {
  pulseMemory = [];
  clearOpt(FRACTION_NUMERATOR_KEY);
  clearOpt(FRACTION_DENOMINATOR_KEY);
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
  const cfg = randomConfig || randomDefaults;
  if (cfg.Lg?.enabled && inputLg) {
    const [lo, hi] = cfg.Lg.range ?? randomDefaults.Lg.range;
    const value = randomInt(lo, hi);
    setValue(inputLg, value);
    handleInput({ target: inputLg });
  }
  if (cfg.V?.enabled && inputV) {
    const [lo, hi] = cfg.V.range ?? randomDefaults.V.range;
    const value = randomInt(lo, hi);
    setValue(inputV, value);
    handleInput({ target: inputV });
  }
  let fractionChanged = false;
  if (cfg.n?.enabled && numeratorInput) {
    let [min, max] = cfg.n.range ?? randomDefaults.n.range;
    if (!cfg.allowComplex) {
      min = 1;
      max = 1;
    }
    const value = Math.max(1, randomInt(min, max));
    setValue(numeratorInput, value);
    fractionChanged = true;
  }
  if (cfg.d?.enabled && denominatorInput) {
    const [min, max] = cfg.d.range ?? randomDefaults.d.range;
    const value = Math.max(1, randomInt(min, max));
    setValue(denominatorInput, value);
    fractionChanged = true;
  }
  if (fractionChanged) {
    persistFractionField(numeratorInput, FRACTION_NUMERATOR_KEY);
    persistFractionField(denominatorInput, FRACTION_DENOMINATOR_KEY);
    handleInput();
  }
  if (cfg.Pulses?.enabled) {
    // Reset persistent selection memory so old pulses don't reappear when Lg grows
    clearPersistentPulses();
    const lg = parseInt(inputLg.value);
    if (!isNaN(lg) && lg > 0) {
      ensurePulseMemory(lg);
      const rawCount = randomCount && typeof randomCount.value === 'string' ? randomCount.value.trim() : '';
      const available = [];
      for (let i = 1; i < lg; i++) available.push(i);
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
        // For parsed <= 0, keep selection empty (0 pulses)
      }
      const seq = Array.from(selected).sort((a, b) => a - b);
      for (let i = 1; i < lg; i++) pulseMemory[i] = false;
      seq.forEach(i => { pulseMemory[i] = true; });
      syncSelectedFromMemory();
      updatePulseNumbers();
      layoutTimeline({ silent: true });
      if (isPlaying) {
        applySelectionToAudio();
      }
    }
  }
}

initRandomMenu(randomBtn, randomMenu, randomize);

initSoundDropdown(baseSoundSelect, {
  storageKey: storeKey('baseSound'),
  eventType: 'baseSound',
  getAudio: initAudio,
  apply: (a, val) => a.setBase(val)
});
initSoundDropdown(accentSoundSelect, {
  storageKey: storeKey('accentSound'),
  eventType: 'accentSound',
  getAudio: initAudio,
  apply: (a, val) => a.setAccent(val)
});
initSoundDropdown(startSoundSelect, {
  storageKey: storeKey('startSound'),
  eventType: 'startSound',
  getAudio: initAudio,
  apply: (a, val) => a.setStart(val)
});

// Preview on sound change handled by shared header

async function initAudio(){
  if (audio) {
    await audio.ready();
    return audio;
  }
  if (!audioInitPromise) {
    audioInitPromise = (async () => {
      const instance = new TimelineAudio();
      await instance.ready();
      // Ensure accent channel is registered and routed separately for the mixer
      if (instance.mixer && typeof instance.mixer.registerChannel === 'function') {
        instance.mixer.registerChannel('accent', { allowSolo: true, label: 'Seleccionado' });
      }
      if (instance._channelAssignments) {
        instance._channelAssignments.accent = 'accent';
      }
      instance.setBase(baseSoundSelect.dataset.value);
      instance.setAccent(accentSoundSelect.dataset.value);
      instance.setStart(startSoundSelect.dataset.value);
      if (typeof instance.setVoiceHandler === 'function') {
        instance.setVoiceHandler(handleVoiceEvent);
      }
      schedulingBridge.applyTo(instance);
      if (typeof instance.setPulseEnabled === 'function') {
        instance.setPulseEnabled(pulseAudioEnabled);
      }
      if (typeof instance.setCycleEnabled === 'function') {
        instance.setCycleEnabled(cycleAudioEnabled);
      }
      if (typeof instance.setLoop === 'function') {
        instance.setLoop(loopEnabled);
      }
      audio = instance;
      return instance;
    })();
  }
  try {
    return await audioInitPromise;
  } finally {
    audioInitPromise = null;
  }
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
    node.textContent = left + '  ' + right;
    const caret = left.length + 1; setPulseSeqSelection(caret, caret);
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
  if(text.length === 0){ text = '  '; node.textContent = text; }
  moveCaretToNearestMidpoint();
},0));

const inputToLed = new Map([
  [inputLg, ledLg],
  [inputV, ledV],
  [inputT, ledT]
].filter(([input, led]) => input && led));

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
  const leds = [ledLg, ledV];
  if (ledT) leds.push(ledT);
  leds.forEach(led => {
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
  const tokenRegex = /(\d+\.\d+|\.\d+|\d+)/g;
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
  lastFractionGap = caretGap;

  for (const token of tokens) {
    const raw = token.raw;
    if (raw.includes('.')) {
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
        const value = base + fracNumerator / denomValue;
        if (value <= base) continue;
        if (Number.isFinite(next) && value >= next) continue;
        if (!Number.isNaN(lg) && value >= lg) continue;
        const key = makeFractionKey(base, fracNumerator, denomValue);
        if (!key) continue;
        if (!seenFractionKeys.has(key)) {
          seenFractionKeys.add(key);
          fractions.push({
            base,
            numerator: fracNumerator,
            denominator: denomValue,
            value,
            display: fractionDisplay(base, fracNumerator, denomValue),
            key
          });
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
        let normalizedBase = intVal;
        let normalizedNumerator = subdivisionIndex;
        let value = intVal + subdivisionIndex / denomValue;
        let displayOverride = null;
        if (Number.isFinite(numeratorValue) && numeratorValue > 0) {
          const totalCycles = Number.isFinite(lg) && lg > 0 && numeratorValue > 0
            ? Math.ceil(lg / numeratorValue)
            : null;
          const mapping = cycleNotationToFraction(intVal, subdivisionIndex, numeratorValue, denomValue);
          const canUseCycleNotation = Boolean(
            mapping &&
            Number.isFinite(mapping.value) &&
            (!Number.isFinite(lg) || mapping.value < lg) &&
            Number.isFinite(totalCycles) &&
            totalCycles > 0 &&
            intVal < totalCycles
          );
          if (canUseCycleNotation) {
            normalizedBase = mapping.base;
            normalizedNumerator = mapping.numerator;
            value = mapping.value;
            displayOverride = {
              cycleIndex: intVal,
              subdivisionIndex,
              pulsesPerCycle: numeratorValue
            };
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
          seenFractionKeys.add(key);
          fractions.push({
            base: normalizedBase,
            numerator: normalizedNumerator,
            denominator: denomValue,
            value,
            display: fractionDisplay(normalizedBase, normalizedNumerator, denomValue, displayOverride || undefined),
            key
          });
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
      if (!seenInts.has(n)) {
        seenInts.add(n);
        ints.push(n);
      }
    }
  }

  ints.sort((a, b) => a - b);
  fractions.sort((a, b) => a.value - b.value);
  fractionalSelectionState.clear();
  fractions.forEach(entry => {
    fractionalSelectionState.set(entry.key, entry);
  });
  rebuildFractionSelections({ skipUpdateField: true });

  const hasValidLg = Number.isFinite(lg) && lg > 0;

  if (hasValidLg) {
    ensurePulseMemory(lg);
    for (let i = 1; i < lg; i++) pulseMemory[i] = false;
    ints.forEach(n => { if (n < lg) pulseMemory[n] = true; });
    syncSelectedFromMemory();
    updatePulseNumbers();
    layoutTimeline({ silent: true });
  } else {
    const combined = [
      ...ints.map(n => ({ value: n, display: String(n), key: String(n) })),
      ...fractions.map(f => ({ value: f.value, display: f.display, key: f.key }))
    ].sort((a, b) => a.value - b.value);
    pulseSeqRanges = {};
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
  updateFractionUI(numerator, denominator);

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
    applySelectionToAudio({ scheduling });
    currentAudioResolution = 1;
    updateVoiceHandlers({ scheduling });
    if (typeof audio.setVoices === 'function') {
      audio.setVoices(scheduling.voices || []);
    }
    const vNow = parseFloat(inputV.value);
    const transportPayload = {};
    if (scheduling.totalPulses != null) {
      transportPayload.totalPulses = scheduling.totalPulses;
    }
    if (scheduling.validV && Number.isFinite(vNow) && vNow > 0) {
      transportPayload.bpm = vNow;
    }
    if (scheduling.patternBeats != null) {
      transportPayload.patternBeats = scheduling.patternBeats;
    }
    if (scheduling.cycleConfig) {
      transportPayload.cycle = scheduling.cycleConfig;
    }
    if (typeof audio.updateTransport === 'function' && (scheduling.validLg || scheduling.validV)) {
      audio.updateTransport(transportPayload);
    }
    if (scheduling.validLg && scheduling.validV && Number.isFinite(vNow) && vNow > 0) {
      scheduleZeroResync(vNow);
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
  const entries = [];
  const limit = Math.min(pulseMemory.length, lg);
  for(let i = 1; i < limit; i++){
    if(pulseMemory[i]) {
      entries.push({ type: 'int', value: i, display: String(i), key: String(i) });
    }
  }
  const validFractionals = fractionalPulseSelections
    .filter(item => item && Number.isFinite(item.value))
    .filter(item => item.value > 0 && item.value < lg);
  validFractionals.forEach(item => {
    entries.push({
      type: 'fraction',
      value: item.value,
      display: item.display,
      key: item.key
    });
  });
  entries.sort((a, b) => a.value - b.value);
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
  applyFractionSelectionClasses();
  updatePulseSeqField();
}

function handlePulseSeqInput(){
  const lg = parseInt(inputLg.value);
  if (isNaN(lg) || lg <= 0) {
    pulseMemory = [];
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

  syncSelectedFromMemory();
  updatePulseNumbers();

  if (isPlaying && audio) {
    applySelectionToAudio();
    if (typeof audio.setLoop === 'function') {
      audio.setLoop(loopEnabled);
    }
  }

  layoutTimeline();
}


function clearHighlights() {
  pulses.forEach(p => p.classList.remove('active'));
  cycleMarkers.forEach(m => m.classList.remove('active'));
  cycleLabels.forEach(l => l.classList.remove('active'));
  pulseNumberLabels.forEach(label => label.classList.remove('pulse-number--flash'));
  lastNormalizedStep = null;
}

function renderTimeline() {
  pulseNumberLabels = [];
  pulses = [];
  pulseHits = [];
  cycleMarkers = [];
  cycleMarkerHits = [];
  cycleLabels = [];
  bars = [];
  fractionHitMap.clear();
  const savedIndicator = tIndicator;
  timeline.innerHTML = '';
  if (savedIndicator) timeline.appendChild(savedIndicator);

  const lg = parseIntSafe(inputLg.value);
  if (!Number.isFinite(lg) || lg <= 0) return;

  const numberFontRem = computeNumberFontRem(lg);
  const subdivisionFontRem = computeSubdivisionFontRem(lg);

  for (let i = 0; i <= lg; i++) {
    const pulse = document.createElement('div');
    pulse.className = 'pulse';
    if (i === 0) pulse.classList.add('zero');
    else if (i === lg) pulse.classList.add('lg');
    pulse.dataset.index = String(i);
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
    } else {
      hit.style.pointerEvents = 'auto';
      hit.style.cursor = 'pointer';
      attachSelectionListeners(hit);
    }
    timeline.appendChild(hit);
    pulseHits.push(hit);
  }

  const { numerator, denominator } = getFraction();
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
      const marker = document.createElement('div');
      marker.className = 'cycle-marker';
      if (subdivisionIndex === 0) marker.classList.add('start');
      marker.dataset.cycleIndex = String(cycleIndex);
      marker.dataset.subdivision = String(subdivisionIndex);
      marker.dataset.position = String(position);
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
            const value = fractionValue(baseIndex, fracNumerator, denominatorValue);
            const display = fractionDisplay(baseIndex, fracNumerator, denominatorValue, {
              cycleIndex,
              subdivisionIndex,
              pulsesPerCycle: numeratorPerCycle
            });
            marker.dataset.baseIndex = String(baseIndex);
            marker.dataset.fractionNumerator = String(fracNumerator);
            marker.dataset.fractionDenominator = String(denominatorValue);
            marker.dataset.fractionKey = key;
            marker.dataset.selectionKey = `fraction:${key}`;
            marker.dataset.value = String(value);
            marker.dataset.display = display;
            marker.style.cursor = 'pointer';
            attachSelectionListeners(marker);
            validFractionKeys.add(key);

            const hit = document.createElement('div');
            hit.className = 'fraction-hit';
            hit.dataset.baseIndex = marker.dataset.baseIndex;
            hit.dataset.fractionNumerator = marker.dataset.fractionNumerator;
            hit.dataset.fractionDenominator = marker.dataset.fractionDenominator;
            hit.dataset.fractionKey = key;
            hit.dataset.selectionKey = `fraction:${key}`;
            hit.dataset.value = String(value);
            hit.dataset.display = display;
            hit.style.position = 'absolute';
            hit.style.borderRadius = '50%';
            hit.style.background = 'transparent';
            hit.style.zIndex = '6';
            const fracHitSize = computeHitSizePx(lg) * 0.75;
            hit.style.width = `${fracHitSize}px`;
            hit.style.height = `${fracHitSize}px`;
            hit.style.pointerEvents = 'auto';
            hit.style.cursor = 'pointer';
            attachSelectionListeners(hit);
            timeline.appendChild(hit);
            cycleMarkerHits.push(hit);
            fractionHitMap.set(key, hit);
          }
        }
      }

      if (hideFractionLabels) return;
      const formatted = labelFormatter({ cycleIndex, subdivisionIndex, position });
      if (formatted != null) {
        const label = document.createElement('div');
        label.className = 'cycle-label';
        if (subdivisionIndex === 0) label.classList.add('cycle-label--integer');
        if (cycleIndex === 0 && subdivisionIndex === 0) label.classList.add('cycle-label--origin');
        label.dataset.cycleIndex = String(cycleIndex);
        label.dataset.subdivision = String(subdivisionIndex);
        label.dataset.position = String(position);
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
        timeline.appendChild(label);
        cycleLabels.push(label);
      }
    });
  }

  let removedFraction = false;
  fractionalSelectionState.forEach((_, key) => {
    if (!validFractionKeys.has(key)) {
      fractionalSelectionState.delete(key);
      removedFraction = true;
    }
  });
  if (removedFraction) {
    rebuildFractionSelections({ skipUpdateField: true });
  }

  updatePulseNumbers();
  layoutTimeline({ silent: true });
  syncSelectedFromMemory();
  applyFractionSelectionClasses();
  clearHighlights();
}

function showNumber(i, fontRem) {
  const label = document.createElement('div');
  label.className = 'pulse-number';
  label.dataset.index = i;
  label.textContent = i;
  const lg = pulses.length - 1;
  const sizeRem = typeof fontRem === 'number' ? fontRem : computeNumberFontRem(lg);
  label.style.fontSize = `${sizeRem}rem`;
  if (i === 0 || i === lg) label.classList.add('endpoint');
  timeline.appendChild(label);
  pulseNumberLabels.push(label);
}

function updatePulseNumbers() {
  timeline.querySelectorAll('.pulse-number').forEach(n => n.remove());
  pulseNumberLabels = [];
  if (!pulses.length) return;
  const lg = pulses.length - 1;
  if (lg >= PULSE_NUMBER_HIDE_THRESHOLD) return;
  const fontRem = computeNumberFontRem(lg);
  showNumber(0, fontRem);
  showNumber(lg, fontRem);
  for (let i = 1; i < lg; i++) {
    showNumber(i, fontRem);
  }
}

/**
 * Distribueix els polsos i marques en mode lineal o circular segons l'estat actual.
 *
 * @param {{ silent?: boolean }} [opts] permet saltar animacions en re-renderitzats silenciosos.
 * @returns {void}
 */
function layoutTimeline(opts = {}) {
  const silent = !!opts.silent;
  const lg = pulses.length - 1;
  const useCircular = circularTimeline && loopEnabled;
  const wasCircular = timeline.classList.contains('circular');
  const desiredCircular = !!useCircular;
  const delay = (!silent && wasCircular !== desiredCircular) ? T_INDICATOR_TRANSITION_DELAY : 0;
  const queueIndicatorUpdate = () => scheduleTIndicatorReveal(delay);

  if (lg <= 0) {
    timelineWrapper.classList.remove('circular');
    timeline.classList.remove('circular');
    const wrapper = timeline.closest('.timeline-wrapper') || timeline.parentElement || timeline;
    const guide = wrapper.querySelector('.circle-guide');
    if (guide) guide.style.opacity = '0';
    queueIndicatorUpdate();
    return;
  }

  if (desiredCircular) {
    timelineWrapper.classList.add('circular');
    timeline.classList.add('circular');
    if (silent) timeline.classList.add('no-anim');
    const wrapper = timeline.closest('.timeline-wrapper') || timeline.parentElement || timeline;
    let guide = wrapper.querySelector('.circle-guide');
    if (!guide) {
      guide = document.createElement('div');
      guide.className = 'circle-guide';
      guide.style.position = 'absolute';
      guide.style.border = '2px solid var(--line-color)';
      guide.style.borderRadius = '50%';
      guide.style.pointerEvents = 'none';
      guide.style.opacity = '0';
      wrapper.appendChild(guide);
    }

    requestAnimationFrame(() => {
      const tRect = timeline.getBoundingClientRect();
      const cx = tRect.width / 2;
      const cy = tRect.height / 2;
      const radius = Math.min(tRect.width, tRect.height) / 2 - 1;

      pulses.forEach((pulse, idx) => {
        const angle = (idx / lg) * 2 * Math.PI + Math.PI / 2;
        const px = cx + radius * Math.cos(angle);
        const py = cy + radius * Math.sin(angle);
        pulse.style.left = `${px}px`;
        pulse.style.top = `${py}px`;
        pulse.style.transform = 'translate(-50%, -50%)';
      });

      pulseHits.forEach((hit, idx) => {
        const angle = (idx / lg) * 2 * Math.PI + Math.PI / 2;
        const hx = cx + radius * Math.cos(angle);
        const hy = cy + radius * Math.sin(angle);
        hit.style.left = `${hx}px`;
        hit.style.top = `${hy}px`;
        hit.style.transform = 'translate(-50%, -50%)';
      });

      bars.forEach((bar, idx) => {
        const step = idx === 0 ? 0 : lg;
        const angle = (step / lg) * 2 * Math.PI + Math.PI / 2;
        const bx = cx + radius * Math.cos(angle);
        const by = cy + radius * Math.sin(angle);
        const barLen = Math.min(tRect.width, tRect.height) * 0.25;
        const topPx = by - barLen / 2;
        bar.style.display = 'block';
        bar.style.left = `${bx - 1}px`;
        bar.style.top = `${topPx}px`;
        bar.style.height = `${barLen}px`;
        bar.style.transformOrigin = '50% 50%';
        bar.style.transform = `rotate(${angle + Math.PI / 2}rad)`;
      });

      const numbers = timeline.querySelectorAll('.pulse-number');
      numbers.forEach(label => {
        const idx = parseIntSafe(label.dataset.index);
        const angle = (idx / lg) * 2 * Math.PI + Math.PI / 2;
        const innerRadius = radius - NUMBER_CIRCLE_OFFSET;
        let x = cx + innerRadius * Math.cos(angle);
        let y = cy + innerRadius * Math.sin(angle);
        if (idx === 0) x -= 16;
        else if (idx === lg) x += 16;
        if (idx === 0 || idx === lg) y += 8;
        label.style.left = `${x}px`;
        label.style.top = `${y}px`;
        label.style.transform = 'translate(-50%, -50%)';
      });

      cycleMarkers.forEach(marker => {
        const pos = Number(marker.dataset.position);
        const angle = (pos / lg) * 2 * Math.PI + Math.PI / 2;
        const mx = cx + radius * Math.cos(angle);
        const my = cy + radius * Math.sin(angle);
        marker.style.left = `${mx}px`;
        marker.style.top = `${my}px`;
        marker.style.transformOrigin = '50% 50%';
        marker.style.transform = `translate(-50%, -50%) rotate(${angle + Math.PI / 2}rad)`;
        const key = marker.dataset.fractionKey;
        if (key && fractionHitMap.has(key)) {
          const hit = fractionHitMap.get(key);
          hit.style.left = `${mx}px`;
          hit.style.top = `${my}px`;
          hit.style.transform = 'translate(-50%, -50%)';
        }
      });

      const labelOffset = 36;
      cycleLabels.forEach(label => {
        const pos = Number(label.dataset.position);
        const angle = (pos / lg) * 2 * Math.PI + Math.PI / 2;
        const lx = cx + (radius + labelOffset) * Math.cos(angle);
        const ly = cy + (radius + labelOffset) * Math.sin(angle);
        label.style.left = `${lx}px`;
        label.style.top = `${ly}px`;
        label.style.transform = 'translate(-50%, -50%)';
      });

      restoreCycleLabelDisplay();

      guide.style.left = `${cx}px`;
      guide.style.top = `${cy}px`;
      guide.style.width = `${radius * 2}px`;
      guide.style.height = `${radius * 2}px`;
      guide.style.transform = 'translate(-50%, -50%)';
      guide.style.opacity = '0';

      queueIndicatorUpdate();

      if (silent) {
        void timeline.offsetHeight;
        timeline.classList.remove('no-anim');
      }
    });
  } else {
    timelineWrapper.classList.remove('circular');
    timeline.classList.remove('circular');
    const wrapper = timeline.closest('.timeline-wrapper') || timeline.parentElement || timeline;
    const guide = wrapper.querySelector('.circle-guide');
    if (guide) guide.style.opacity = '0';

    pulses.forEach((pulse, idx) => {
      const percent = (idx / lg) * 100;
      pulse.style.left = `${percent}%`;
      pulse.style.top = '50%';
      pulse.style.transform = 'translate(-50%, -50%)';
    });

    pulseHits.forEach((hit, idx) => {
      const percent = (idx / lg) * 100;
      hit.style.left = `${percent}%`;
      hit.style.top = '50%';
      hit.style.transform = 'translate(-50%, -50%)';
    });

    bars.forEach((bar, idx) => {
      const step = idx === 0 ? 0 : lg;
      const percent = (step / lg) * 100;
      bar.style.display = 'block';
      bar.style.left = `${percent}%`;
      bar.style.top = '15%';
      bar.style.height = '70%';
      bar.style.transform = '';
    });

    const numbers = timeline.querySelectorAll('.pulse-number');
    numbers.forEach(label => {
      const idx = parseIntSafe(label.dataset.index);
      const percent = (idx / lg) * 100;
      label.style.left = `${percent}%`;
      label.style.top = '-28px';
      label.style.transform = 'translate(-50%, 0)';
    });

    cycleMarkers.forEach(marker => {
      const pos = Number(marker.dataset.position);
      const percent = (pos / lg) * 100;
      marker.style.left = `${percent}%`;
      marker.style.top = '50%';
      marker.style.transformOrigin = '50% 50%';
      marker.style.transform = 'translate(-50%, -50%)';
      const key = marker.dataset.fractionKey;
      if (key && fractionHitMap.has(key)) {
        const hit = fractionHitMap.get(key);
        hit.style.left = `${percent}%`;
        hit.style.top = '50%';
        hit.style.transform = 'translate(-50%, -50%)';
      }
    });

    cycleLabels.forEach(label => {
      const pos = Number(label.dataset.position);
      const percent = (pos / lg) * 100;
      label.style.left = `${percent}%`;
      label.style.top = 'calc(100% + 12px)';
      label.style.transform = 'translate(-50%, 0)';
    });

    applyCycleLabelCompaction({ lg });

    queueIndicatorUpdate();
  }
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
  if (pulseSeqHighlight) pulseSeqHighlight.classList.remove('active');
  if (pulseSeqHighlight2) pulseSeqHighlight2.classList.remove('active');
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

  await audioInstance.setBase(baseSoundSelect.dataset.value);
  await audioInstance.setAccent(accentSoundSelect.dataset.value);
  await audioInstance.setStart(startSoundSelect.dataset.value);

  const scheduling = computeAudioSchedulingState();
  if (scheduling.interval == null || scheduling.totalPulses == null) {
    return false;
  }
  const selectionForAudio = applySelectionToAudio({
    scheduling,
    instance: audioInstance
  }) || selectedForAudioFromState({ scheduling });
  currentAudioResolution = 1;
  updateVoiceHandlers({ scheduling });
  if (typeof audioInstance.setVoices === 'function') {
    audioInstance.setVoices(scheduling.voices || []);
  }
  const iconPlay = playBtn?.querySelector('.icon-play');
  const iconStop = playBtn?.querySelector('.icon-stop');

  const onFinish = () => {
    handlePlaybackStop(audioInstance);
  };

  const playOptions = {};
  if (scheduling.patternBeats != null) {
    playOptions.patternBeats = scheduling.patternBeats;
  }
  if (scheduling.cycleConfig) {
    playOptions.cycle = scheduling.cycleConfig;
  }
  playOptions.baseResolution = 1;

  if (typeof audioInstance.setLoop === 'function') {
    audioInstance.setLoop(loopEnabled);
  }

  audioInstance.play(
    scheduling.totalPulses,
    scheduling.interval,
    selectionForAudio.combined,
    loopEnabled,
    highlightPulse,
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

  cycleMarkers.forEach(m => m.classList.remove('active'));
  cycleLabels.forEach(l => l.classList.remove('active'));
  const marker = cycleMarkers.find(m => Number(m.dataset.cycleIndex) === normalizedCycleIndex
    && Number(m.dataset.subdivision) === normalizedSubdivisionIndex);
  const label = cycleLabels.find(l => Number(l.dataset.cycleIndex) === normalizedCycleIndex
    && Number(l.dataset.subdivision) === normalizedSubdivisionIndex);
  if (marker) {
    void marker.offsetWidth;
    marker.classList.add('active');
  }
  if (label) label.classList.add('active');

  if (loopEnabled && normalizedCycleIndex === 0 && normalizedSubdivisionIndex === 0 && expectedCycles > 0) {
    const lastCycleIndex = expectedCycles - 1;
    const lastMarker = cycleMarkers.find(m => Number(m.dataset.cycleIndex) === lastCycleIndex && Number(m.dataset.subdivision) === 0);
    const lastLabel = cycleLabels.find(l => Number(l.dataset.cycleIndex) === lastCycleIndex && Number(l.dataset.subdivision) === 0);
    if (lastMarker) lastMarker.classList.add('active');
    if (lastLabel) lastLabel.classList.add('active');
  }
}

function highlightPulse(payload){
  // Si no està en reproducció, no tornem a canviar seleccions ni highlights
  if (!isPlaying) return;

  if (!pulses || pulses.length === 0) {
    lastNormalizedStep = null;
    return;
  }

  const total = pulses.length;
  const baseLength = Math.max(1, total - 1);

  let rawStepValue = null;
  let providedResolution = null;
  if (payload && typeof payload === 'object') {
    const candidate = Number.isFinite(payload.rawStep) ? Number(payload.rawStep) : Number(payload.step);
    rawStepValue = Number.isFinite(candidate) ? candidate : null;
    if (Number.isFinite(payload.resolution)) {
      providedResolution = Number(payload.resolution);
    }
  } else {
    const candidate = Number(payload);
    rawStepValue = Number.isFinite(candidate) ? candidate : null;
  }

  const normalizedResolution = Number.isFinite(providedResolution) && providedResolution > 0
    ? Math.max(1, Math.round(providedResolution))
    : Math.max(1, Math.round(currentAudioResolution || 1));

  if (Number.isFinite(providedResolution) && providedResolution > 0) {
    const rounded = Math.max(1, Math.round(providedResolution));
    if (rounded !== currentAudioResolution) {
      currentAudioResolution = rounded;
    }
  }

  const normalizedIndex = Number.isFinite(rawStepValue)
    ? Math.floor(rawStepValue / normalizedResolution)
    : null;

  if (normalizedIndex == null) {
    lastNormalizedStep = null;
    if (Number.isFinite(rawStepValue)) {
      lastVisualStep = rawStepValue;
    }
    return;
  }

  if (lastNormalizedStep === normalizedIndex) {
    if (Number.isFinite(rawStepValue)) {
      lastVisualStep = rawStepValue;
    }
    return;
  }

  lastNormalizedStep = normalizedIndex;

  // esborra il·luminació anterior
  pulses.forEach(p => p.classList.remove('active'));

  let idx;
  if (loopEnabled) {
    idx = baseLength > 0 ? ((normalizedIndex % baseLength) + baseLength) % baseLength : 0;
  } else {
    idx = Math.max(0, Math.min(normalizedIndex, total - 1));
  }

  // il·lumina el pols actual
  const current = pulses[idx];
  if (current) {
    // Força un reflow perquè l'animació es reiniciï encara que es repeteixi el mateix pols
    void current.offsetWidth;
    current.classList.add('active');
  }

  // si hi ha loop i som al primer pols, també il·lumina l’últim
  if (loopEnabled && idx === 0) {
    const last = pulses[pulses.length - 1];
    if (last) last.classList.add('active');
  }
  if (pulseSeqEl) {
    const parentRect = pulseSeqEl.getBoundingClientRect();
    const getRect = (index) => {
      if (index === 0) {
        const z = pulseSeqEl.querySelector('.pz.zero');
        return z ? z.getBoundingClientRect() : null;
      }
      if (index === pulses.length - 1) {
        const l = pulseSeqEl.querySelector('.pz.lg');
        return l ? l.getBoundingClientRect() : null;
      }
      const range = pulseSeqRanges[index];
      if (range) {
        const el = getEditEl();
        const node = el && el.firstChild;
        if (node) {
          const r = document.createRange();
          r.setStart(node, range[0]);
          r.setEnd(node, range[1]);
          return r.getBoundingClientRect();
        }
      }
      return null;
    };

    const rect = getRect(idx);
    let newScrollLeft = pulseSeqEl.scrollLeft;
    if (rect) {
      const absLeft = rect.left - parentRect.left + pulseSeqEl.scrollLeft;
      const target = absLeft - (pulseSeqEl.clientWidth - rect.width) / 2;
      const maxScroll = pulseSeqEl.scrollWidth - pulseSeqEl.clientWidth;
      newScrollLeft = Math.max(0, Math.min(target, maxScroll));
      pulseSeqEl.scrollLeft = newScrollLeft;
      if (typeof syncTimelineScroll === 'function') syncTimelineScroll();
    }

    const parent = pulseSeqEl.getBoundingClientRect();
    const place = (r, el) => {
      if (!r || !el) return;
      const cx = r.left - parent.left + newScrollLeft + r.width / 2;
      const cy = r.top - parent.top + pulseSeqEl.scrollTop + r.height / 2;
      const size = Math.max(r.width, r.height) * 0.75;
      el.style.width = size + 'px';
      el.style.height = size + 'px';
      el.style.left = cx + 'px';
      el.style.top = cy + 'px';
      el.classList.remove('active');
      void el.offsetWidth;
      el.classList.add('active');
    };

    const currentRect = getRect(idx);
    if (currentRect) place(currentRect, pulseSeqHighlight);
    else pulseSeqHighlight.classList.remove('active');

    if (idx === 0 && loopEnabled) {
      const lastRect = getRect(pulses.length - 1);
      if (lastRect) place(lastRect, pulseSeqHighlight2);
      else pulseSeqHighlight2.classList.remove('active');
    } else {
      pulseSeqHighlight2.classList.remove('active');
    }
  }

  if (Number.isFinite(rawStepValue)) {
    lastVisualStep = rawStepValue;
  }
}

function stopVisualSync() {
  if (visualSyncHandle != null) {
    cancelAnimationFrame(visualSyncHandle);
    visualSyncHandle = null;
  }
  lastVisualStep = null;
  lastNormalizedStep = null;
}

function syncVisualState() {
  if (!isPlaying || !audio || typeof audio.getVisualState !== 'function') return;
  const state = audio.getVisualState();
  if (!state) return;

  if (Number.isFinite(state.step) && lastVisualStep !== state.step) {
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
const mixerTriggers = [playBtn];

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
