import {
  TimelineAudio,
  ensureAudio,
  getMixer,
  subscribeMixer,
  setChannelVolume,
  setChannelMute,
  setChannelSolo
} from '../../libs/sound/index.js';
import { initSoundDropdown } from '../../libs/shared-ui/sound-dropdown.js';
import { createSchedulingBridge, bindSharedSoundEvents } from '../../libs/app-common/audio.js';
import { initMixerMenu } from '../../libs/app-common/mixer-menu.js';
import { initRandomMenu } from '../../libs/app-common/random-menu.js';
import { fromLgAndTempo } from '../../libs/app-common/subdivision.js';
import { toRange } from '../../libs/app-common/range.js';

const APP_ID = 'app4';
const STORE_KEY = (key) => `${APP_ID}::${key}`;

const DEFAULT_PARAMS = Object.freeze({
  Lg: 8,
  V: 120,
  numerator: 3,
  denominator: 2
});

const selectors = {
  playBtn: () => document.getElementById('playBtn'),
  baseSoundSelect: () => document.getElementById('baseSoundSelect'),
  selectedSoundSelect: () => document.getElementById('accentSoundSelect'),
  startSoundSelect: () => document.getElementById('startSoundSelect'),
  mixerMenu: () => document.getElementById('mixerMenu'),
  inputs: () => document.querySelector('.inputs'),
  selectedToggleBtn: () => document.getElementById('selectedToggleBtn'),
  inputLg: () => document.getElementById('inputLg'),
  inputLgUp: () => document.getElementById('inputLgUp'),
  inputLgDown: () => document.getElementById('inputLgDown'),
  inputV: () => document.getElementById('inputV'),
  inputVUp: () => document.getElementById('inputVUp'),
  inputVDown: () => document.getElementById('inputVDown'),
  numeratorInput: () => document.getElementById('fractionNumerator'),
  numeratorUp: () => document.getElementById('fractionNumeratorUp'),
  numeratorDown: () => document.getElementById('fractionNumeratorDown'),
  denominatorInput: () => document.getElementById('fractionDenominator'),
  denominatorUp: () => document.getElementById('fractionDenominatorUp'),
  denominatorDown: () => document.getElementById('fractionDenominatorDown'),
  pulseSeqContainer: () => document.getElementById('pulseSeq'),
  randomBtn: () => document.getElementById('randomBtn'),
  randomMenu: () => document.getElementById('randomMenu'),
  randLgToggle: () => document.getElementById('randLgToggle'),
  randLgMin: () => document.getElementById('randLgMin'),
  randLgMax: () => document.getElementById('randLgMax'),
  randVToggle: () => document.getElementById('randVToggle'),
  randVMin: () => document.getElementById('randVMin'),
  randVMax: () => document.getElementById('randVMax'),
  randPulsesToggle: () => document.getElementById('randPulsesToggle'),
  randomCount: () => document.getElementById('randomCount')
};

const FRACTION_IDS = {
  container: 'fractionParam',
  numerator: 'fractionNumerator',
  numeratorUp: 'fractionNumeratorUp',
  numeratorDown: 'fractionNumeratorDown',
  denominator: 'fractionDenominator',
  denominatorUp: 'fractionDenominatorUp',
  denominatorDown: 'fractionDenominatorDown'
};

let audio = null;
let mixerSyncGuard = false;
let selectedChannelEnabled = true;

const RANDOM_STORE_KEY = STORE_KEY('random');

const randomDefaults = {
  Lg: { enabled: true, range: [2, 30] },
  V: { enabled: true, range: [40, 320] },
  Pulses: { enabled: true, count: '' }
};

const randomElements = {
  button: null,
  menu: null,
  randLgToggle: null,
  randLgMin: null,
  randLgMax: null,
  randVToggle: null,
  randVMin: null,
  randVMax: null,
  randPulsesToggle: null,
  randomCount: null
};

let randomConfig = mergeRandomConfig(loadRandomConfig());

const schedulingBridge = createSchedulingBridge({ getAudio: () => audio });
window.addEventListener('sharedui:scheduling', schedulingBridge.handleSchedulingEvent);

bindSharedSoundEvents({
  getAudio: () => audio,
  mapping: {
    baseSound: 'setBase',
    selectedSound: 'setAccent',
    startSound: 'setStart',
    cycleSound: 'setCycle'
  }
});

const pulseSeqElements = {
  edit: null,
  lg: null,
  fractionNumerator: null,
  fractionDenominator: null,
  help: null
};

const state = {
  params: loadStoredParams(),
  pulses: normalizePulseList(loadStoredPulses()),
  isPlaying: false,
  audioReady: false,
  pendingAudioSync: false
};

window.addEventListener('sharedui:factoryreset', () => {
  clearStoredParams();
  state.params = loadStoredParams();
  state.pulses = [];
  persistPulses();
  applyParamsToInputs();
  updateFractionDisplay();
  updateLgDisplay();
  renderPulseSequence();
  setSelectedChannelEnabled(true);
  scheduleParamSync();
});

function toPositiveInt(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function toNonNegativeInt(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function loadStoredParam(key) {
  try {
    const raw = localStorage.getItem(STORE_KEY(key));
    const parsed = toPositiveInt(raw);
    return parsed;
  } catch {
    return null;
  }
}

function loadStoredParams() {
  const base = { ...DEFAULT_PARAMS };
  const overrides = {
    Lg: loadStoredParam('Lg'),
    V: loadStoredParam('V'),
    numerator: loadStoredParam('numerator'),
    denominator: loadStoredParam('denominator')
  };
  Object.entries(overrides).forEach(([key, value]) => {
    if (Number.isFinite(value) && value > 0) {
      base[key] = value;
    }
  });
  return base;
}

function loadStoredPulses() {
  try {
    const raw = localStorage.getItem(STORE_KEY('pulses'));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const base = toNonNegativeInt(item.base);
        if (base == null) return null;
        const numerator = toPositiveInt(item.numerator);
        return { base, numerator: Number.isFinite(numerator) ? numerator : null };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function persistParam(key, value) {
  const storageKey = STORE_KEY(key);
  try {
    if (!Number.isFinite(value) || value <= 0) {
      localStorage.removeItem(storageKey);
    } else {
      localStorage.setItem(storageKey, String(value));
    }
  } catch {}
}

function persistPulses() {
  try {
    const payload = state.pulses.map((pulse) => ({
      base: pulse.base,
      numerator: pulse.numerator != null ? pulse.numerator : null
    }));
    localStorage.setItem(STORE_KEY('pulses'), JSON.stringify(payload));
  } catch {}
}

function clearStoredParams() {
  const keys = ['Lg', 'V', 'numerator', 'denominator', 'pulses', 'baseSound', 'selectedSound', 'startSound'];
  keys.forEach((key) => {
    try { localStorage.removeItem(STORE_KEY(key)); } catch {}
  });
}

function mergeRandomConfig(stored) {
  const source = stored && typeof stored === 'object' ? stored : {};
  return {
    Lg: { ...randomDefaults.Lg, ...(source.Lg && typeof source.Lg === 'object' ? source.Lg : {}) },
    V: { ...randomDefaults.V, ...(source.V && typeof source.V === 'object' ? source.V : {}) },
    Pulses: { ...randomDefaults.Pulses, ...(source.Pulses && typeof source.Pulses === 'object' ? source.Pulses : {}) }
  };
}

function loadRandomConfig() {
  try {
    const raw = localStorage.getItem(RANDOM_STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveRandomConfig(cfg) {
  try {
    localStorage.setItem(RANDOM_STORE_KEY, JSON.stringify(cfg));
  } catch {}
}

function collectRandomElements() {
  randomElements.button = selectors.randomBtn();
  randomElements.menu = selectors.randomMenu();
  randomElements.randLgToggle = selectors.randLgToggle();
  randomElements.randLgMin = selectors.randLgMin();
  randomElements.randLgMax = selectors.randLgMax();
  randomElements.randVToggle = selectors.randVToggle();
  randomElements.randVMin = selectors.randVMin();
  randomElements.randVMax = selectors.randVMax();
  randomElements.randPulsesToggle = selectors.randPulsesToggle();
  randomElements.randomCount = selectors.randomCount();
}

function applyRandomConfigToInputs(cfg = randomConfig) {
  const lgRange = Array.isArray(cfg?.Lg?.range) ? cfg.Lg.range : randomDefaults.Lg.range;
  const vRange = Array.isArray(cfg?.V?.range) ? cfg.V.range : randomDefaults.V.range;
  if (randomElements.randLgToggle) randomElements.randLgToggle.checked = !!cfg?.Lg?.enabled;
  if (randomElements.randLgMin) randomElements.randLgMin.value = lgRange?.[0] ?? '';
  if (randomElements.randLgMax) randomElements.randLgMax.value = lgRange?.[1] ?? '';
  if (randomElements.randVToggle) randomElements.randVToggle.checked = !!cfg?.V?.enabled;
  if (randomElements.randVMin) randomElements.randVMin.value = vRange?.[0] ?? '';
  if (randomElements.randVMax) randomElements.randVMax.value = vRange?.[1] ?? '';
  if (randomElements.randPulsesToggle) randomElements.randPulsesToggle.checked = !!cfg?.Pulses?.enabled;
  if (randomElements.randomCount) randomElements.randomCount.value = cfg?.Pulses?.count ?? '';
}

function persistRandomConfig() {
  randomConfig = {
    Lg: {
      enabled: !!randomElements.randLgToggle?.checked,
      range: toRange(
        randomElements.randLgMin?.value,
        randomElements.randLgMax?.value,
        randomDefaults.Lg.range
      )
    },
    V: {
      enabled: !!randomElements.randVToggle?.checked,
      range: toRange(
        randomElements.randVMin?.value,
        randomElements.randVMax?.value,
        randomDefaults.V.range
      )
    },
    Pulses: {
      enabled: !!randomElements.randPulsesToggle?.checked,
      count: typeof randomElements.randomCount?.value === 'string'
        ? randomElements.randomCount.value.trim()
        : ''
    }
  };
  saveRandomConfig(randomConfig);
}

function setNumberInputValue(input, value) {
  if (!input || !Number.isFinite(value)) return;
  input.value = String(value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function randomInt(min, max) {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi < lo) return lo;
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

function computePulseValue(pulse, denominator) {
  if (!pulse) return 0;
  const base = Number.isFinite(pulse.base) ? pulse.base : 0;
  const numerator = Number.isFinite(pulse.numerator) ? pulse.numerator : null;
  if (numerator == null) return base;
  const d = Number.isFinite(denominator) && denominator > 0 ? denominator : 1;
  return base + numerator / d;
}

function normalizePulseList(list) {
  if (!Array.isArray(list)) return [];
  const denominator = state?.params?.denominator;
  const lg = state?.params?.Lg;
  const seen = new Set();
  const normalized = [];

  list.forEach((item) => {
    if (!item) return;
    const base = Math.max(0, Math.round(Number(item.base)) || 0);
    const rawNumerator = Number(item.numerator);
    const numerator = Number.isFinite(rawNumerator) ? Math.max(1, Math.round(rawNumerator)) : null;

    if (numerator != null) {
      if (!Number.isFinite(denominator) || denominator <= 0) return;
      if (numerator >= denominator) return;
      if (Number.isFinite(lg) && lg > 0 && base >= lg) return;
    } else {
      if (base <= 0) return;
      if (Number.isFinite(lg) && lg > 0 && base >= lg) return;
    }

    const key = `${base}:${numerator ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    normalized.push({ base, numerator: numerator != null ? numerator : null });
  });

  normalized.sort((a, b) => {
    const diff = computePulseValue(a, denominator) - computePulseValue(b, denominator);
    if (Math.abs(diff) < 1e-6) return 0;
    return diff < 0 ? -1 : 1;
  });

  return normalized;
}

function renderFractionControls() {
  const inputs = selectors.inputs();
  if (!inputs || document.getElementById(FRACTION_IDS.container)) return;

  const fractionParam = document.createElement('div');
  fractionParam.className = 'param fraction';
  fractionParam.id = FRACTION_IDS.container;

  const abbr = document.createElement('span');
  abbr.className = 'abbr';
  abbr.textContent = 'n/d';
  fractionParam.appendChild(abbr);

  const wrapper = document.createElement('div');
  wrapper.className = 'fraction-wrapper';

  const topRow = document.createElement('div');
  topRow.className = 'fraction-row fraction-row--top';
  const numerator = createFractionField({
    inputId: FRACTION_IDS.numerator,
    upId: FRACTION_IDS.numeratorUp,
    downId: FRACTION_IDS.numeratorDown,
    placeholder: 'n',
    ariaUp: 'Incrementar numerador',
    ariaDown: 'Decrementar numerador'
  });
  topRow.appendChild(numerator.field);

  const divider = document.createElement('div');
  divider.className = 'fraction-divider';
  divider.setAttribute('aria-hidden', 'true');

  const bottomRow = document.createElement('div');
  bottomRow.className = 'fraction-row fraction-row--bottom';
  const denominator = createFractionField({
    inputId: FRACTION_IDS.denominator,
    upId: FRACTION_IDS.denominatorUp,
    downId: FRACTION_IDS.denominatorDown,
    placeholder: 'd',
    ariaUp: 'Incrementar denominador',
    ariaDown: 'Decrementar denominador'
  });
  bottomRow.appendChild(denominator.field);

  wrapper.append(topRow, divider, bottomRow);
  fractionParam.appendChild(wrapper);

  const vParam = document.querySelector('.param.v');
  if (vParam) {
    inputs.insertBefore(fractionParam, vParam);
  } else {
    inputs.appendChild(fractionParam);
  }
}

function createFractionField({ inputId, upId, downId, placeholder, ariaUp, ariaDown }) {
  const field = document.createElement('div');
  field.className = 'fraction-field';

  const input = document.createElement('input');
  input.type = 'number';
  input.id = inputId;
  input.min = '1';
  input.step = '1';
  input.placeholder = placeholder;
  input.inputMode = 'numeric';
  field.appendChild(input);

  const spinner = document.createElement('div');
  spinner.className = 'spinner';

  const up = document.createElement('button');
  up.type = 'button';
  up.id = upId;
  up.className = 'spin up';
  if (ariaUp) up.setAttribute('aria-label', ariaUp);
  spinner.appendChild(up);

  const down = document.createElement('button');
  down.type = 'button';
  down.id = downId;
  down.className = 'spin down';
  if (ariaDown) down.setAttribute('aria-label', ariaDown);
  spinner.appendChild(down);

  field.appendChild(spinner);

  return { field, input, up, down };
}

function addRepeatPress(element, fn) {
  if (!element || typeof fn !== 'function') return;
  let timeoutId = null;
  let intervalId = null;

  const clearTimers = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  const start = (event) => {
    if (event.type === 'mousedown' && event.button !== 0) return;
    fn();
    timeoutId = setTimeout(() => {
      intervalId = setInterval(fn, 80);
    }, 320);
    event.preventDefault();
  };

  const stop = () => {
    clearTimers();
  };

  element.addEventListener('mousedown', start);
  element.addEventListener('touchstart', start, { passive: false });
  ['mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach((name) => {
    element.addEventListener(name, stop);
  });
  document.addEventListener('mouseup', stop);
  document.addEventListener('touchend', stop);

  element.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      fn();
    }
  });
}

function bindPositiveIntegerInput(input) {
  if (!input || input.dataset.app4IntBound === '1') return;
  input.addEventListener('input', () => {
    const digits = (input.value || '').replace(/[^0-9]/g, '');
    if (digits !== input.value) input.value = digits;
  });
  input.addEventListener('blur', () => {
    const parsed = Number.parseInt(input.value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      input.value = '';
    } else {
      input.value = String(parsed);
    }
  });
  input.dataset.app4IntBound = '1';
}

function stepNumberInput(input, delta) {
  if (!input) return;
  const parsed = Number.parseInt(input.value, 10);
  let next = Number.isFinite(parsed) ? parsed + delta : delta > 0 ? 1 : 1;
  if (next < 1) next = 1;
  input.value = String(next);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function bindSpinnerButtons({ input, up, down }) {
  if (!input) return;
  if (up && !up.dataset.app4SpinnerBound) {
    addRepeatPress(up, () => stepNumberInput(input, +1));
    up.dataset.app4SpinnerBound = '1';
  }
  if (down && !down.dataset.app4SpinnerBound) {
    addRepeatPress(down, () => stepNumberInput(input, -1));
    down.dataset.app4SpinnerBound = '1';
  }
}

function setupParameterInputs() {
  renderFractionControls();

  const lg = selectors.inputLg();
  const v = selectors.inputV();
  const numerator = selectors.numeratorInput();
  const denominator = selectors.denominatorInput();

  [lg, v, numerator, denominator].forEach(bindPositiveIntegerInput);

  bindSpinnerButtons({ input: lg, up: selectors.inputLgUp(), down: selectors.inputLgDown() });
  bindSpinnerButtons({ input: v, up: selectors.inputVUp(), down: selectors.inputVDown() });
  bindSpinnerButtons({ input: numerator, up: selectors.numeratorUp(), down: selectors.numeratorDown() });
  bindSpinnerButtons({ input: denominator, up: selectors.denominatorUp(), down: selectors.denominatorDown() });

  applyParamsToInputs();
  bindParameterStateSync();
  scheduleParamSync();
}

function applyParamsToInputs() {
  const { Lg, V, numerator, denominator } = state.params;
  const bindings = [
    { input: selectors.inputLg(), value: Lg },
    { input: selectors.inputV(), value: V },
    { input: selectors.numeratorInput(), value: numerator },
    { input: selectors.denominatorInput(), value: denominator }
  ];
  bindings.forEach(({ input, value }) => {
    if (!input) return;
    const next = Number.isFinite(value) && value > 0 ? String(value) : '';
    if (input.value !== next) {
      input.value = next;
    }
  });
}

function bindParameterStateSync() {
  const bindings = [
    { key: 'Lg', getter: selectors.inputLg },
    { key: 'V', getter: selectors.inputV },
    { key: 'numerator', getter: selectors.numeratorInput },
    { key: 'denominator', getter: selectors.denominatorInput }
  ];

  bindings.forEach(({ key, getter }) => {
    const input = getter();
    if (!input || input.dataset.app4ParamBound === '1') return;

    const handle = (opts = {}) => handleParamInput(key, input, opts);
    input.addEventListener('input', () => handle());
    input.addEventListener('change', () => handle({ coerce: true }));
    input.addEventListener('blur', () => handle({ coerce: true }));
    input.dataset.app4ParamBound = '1';
  });
}

function handleParamInput(key, input, { coerce = false } = {}) {
  if (!input) return;
  const rawValue = input.value;
  const parsed = toPositiveInt(rawValue);
  if (!Number.isFinite(parsed)) {
    if (coerce) {
      const fallback = state.params[key];
      const fallbackValue = Number.isFinite(fallback) && fallback > 0 ? String(fallback) : '';
      if (fallbackValue !== rawValue) {
        input.value = fallbackValue;
      }
    }
    return;
  }

  if (state.params[key] === parsed) return;
  state.params[key] = parsed;
  persistParam(key, parsed);
  if (key === 'denominator') {
    state.pulses = normalizePulseList(state.pulses);
    renderPulseSequence();
    persistPulses();
  }
  if (key === 'Lg') {
    state.pulses = normalizePulseList(state.pulses);
    renderPulseSequence();
    persistPulses();
    updateLgDisplay();
  }
  if (key === 'numerator' || key === 'denominator') {
    updateFractionDisplay();
  }
  scheduleParamSync();
}

function scheduleParamSync() {
  const applied = applyParamsToAudio();
  state.pendingAudioSync = !applied;
  return applied;
}

function applyParamsToAudio(target = audio) {
  const instance = target || audio;
  if (!instance || !state.audioReady) return false;

  const { Lg, V, numerator, denominator } = state.params;
  const payload = {};
  if (Number.isFinite(Lg) && Lg > 0) payload.totalPulses = Lg;
  if (Number.isFinite(V) && V > 0) payload.bpm = V;
  const cycle = {};
  if (Number.isFinite(numerator) && numerator > 0) cycle.numerator = numerator;
  if (Number.isFinite(denominator) && denominator > 0) cycle.denominator = denominator;
  if (Object.keys(cycle).length > 0) payload.cycle = cycle;

  if (Object.keys(payload).length === 0) return false;
  if (typeof instance.updateTransport === 'function') {
    instance.updateTransport(payload);
    return true;
  }
  if (payload.totalPulses != null && typeof instance.setTotal === 'function') {
    instance.setTotal(payload.totalPulses);
  }
  if (payload.bpm != null && typeof instance.setTempo === 'function') {
    instance.setTempo(payload.bpm);
  }
  if (payload.cycle && typeof instance.updateCycleConfig === 'function') {
    instance.updateCycleConfig(payload.cycle);
  }
  return true;
}

function setupPulseSequence() {
  const container = selectors.pulseSeqContainer();
  if (!container) return;

  container.textContent = '';

  const prefix = document.createElement('span');
  prefix.className = 'pz prefix';
  prefix.textContent = 'Pfr';

  const fraction = document.createElement('span');
  fraction.className = 'fraction pulse-fraction';

  const fractionTop = document.createElement('span');
  fractionTop.className = 'top';
  fractionTop.textContent = 'n';

  const fractionBottom = document.createElement('span');
  fractionBottom.className = 'bottom';
  fractionBottom.textContent = 'd';

  fraction.append(fractionTop, fractionBottom);

  const parenOpen = document.createElement('span');
  parenOpen.className = 'pz prefix';
  parenOpen.textContent = '(';

  const zero = document.createElement('span');
  zero.className = 'pz zero';
  zero.textContent = '0';

  const edit = document.createElement('span');
  edit.className = 'pz edit';
  edit.contentEditable = 'true';
  edit.spellcheck = false;
  edit.inputMode = 'numeric';

  const parenClose = document.createElement('span');
  parenClose.className = 'pz suffix';
  parenClose.textContent = ')';

  const lgSpan = document.createElement('span');
  lgSpan.className = 'pz lg';
  lgSpan.textContent = 'Lg';

  container.append(prefix, fraction, parenOpen, zero, edit, parenClose, lgSpan);

  const help = document.createElement('div');
  help.id = 'pulseSeqHelp';
  help.setAttribute('role', 'status');
  help.setAttribute('aria-live', 'polite');
  container.insertAdjacentElement('afterend', help);

  pulseSeqElements.edit = edit;
  pulseSeqElements.lg = lgSpan;
  pulseSeqElements.fractionNumerator = fractionTop;
  pulseSeqElements.fractionDenominator = fractionBottom;
  pulseSeqElements.help = help;

  edit.addEventListener('keydown', handlePulseSeqKeydown);
  edit.addEventListener('input', handlePulseSeqInput);
  edit.addEventListener('blur', () => confirmPulseSequence({ reason: 'blur' }));
  edit.addEventListener('paste', handlePulseSeqPaste);

  renderPulseSequence();
}

function handlePulseSeqKeydown(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    confirmPulseSequence({ reason: 'enter' });
    try { event.currentTarget?.blur(); } catch {}
    return;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    renderPulseSequence();
    clearPulseHelp();
  }
}

function sanitizePulseText(text) {
  return (text || '').replace(/[^0-9.\s]/g, ' ');
}

function handlePulseSeqInput() {
  if (!pulseSeqElements.edit) return;
  const sanitized = sanitizePulseText(pulseSeqElements.edit.textContent || '');
  if (sanitized !== pulseSeqElements.edit.textContent) {
    pulseSeqElements.edit.textContent = sanitized;
  }
}

function handlePulseSeqPaste(event) {
  event.preventDefault();
  const text = (event.clipboardData || window.clipboardData)?.getData('text') || '';
  const sanitized = sanitizePulseText(text);
  document.execCommand('insertText', false, sanitized);
}

function getPulseSeqText() {
  return pulseSeqElements.edit ? (pulseSeqElements.edit.textContent || '') : '';
}

function setPulseSeqText(str) {
  if (!pulseSeqElements.edit) return;
  pulseSeqElements.edit.textContent = str;
}

function formatPulseToken(pulse) {
  if (!pulse) return '';
  if (pulse.numerator != null) {
    return `${pulse.base}.${pulse.numerator}`;
  }
  return String(pulse.base);
}

function renderPulseSequence() {
  if (!pulseSeqElements.edit) return;
  const tokens = state.pulses.map(formatPulseToken);
  const text = tokens.length ? `  ${tokens.join('  ')}  ` : '  ';
  setPulseSeqText(text);
}

function showPulseHelp(message) {
  if (!pulseSeqElements.help) return;
  pulseSeqElements.help.textContent = message;
  pulseSeqElements.help.classList.add('show');
}

function clearPulseHelp() {
  if (!pulseSeqElements.help) return;
  pulseSeqElements.help.textContent = '';
  pulseSeqElements.help.classList.remove('show');
}

function randomize() {
  if (randomElements.randLgToggle?.checked) {
    const [lo, hi] = toRange(
      randomElements.randLgMin?.value,
      randomElements.randLgMax?.value,
      randomDefaults.Lg.range
    );
    const nextLg = randomInt(lo, hi);
    setNumberInputValue(selectors.inputLg(), nextLg);
  }

  if (randomElements.randVToggle?.checked) {
    const [lo, hi] = toRange(
      randomElements.randVMin?.value,
      randomElements.randVMax?.value,
      randomDefaults.V.range
    );
    const nextV = randomInt(lo, hi);
    setNumberInputValue(selectors.inputV(), nextV);
  }

  if (randomElements.randPulsesToggle?.checked) {
    const lgValue = toPositiveInt(selectors.inputLg()?.value);
    const available = [];
    if (Number.isFinite(lgValue) && lgValue > 1) {
      for (let i = 1; i < lgValue; i++) available.push(i);
    }

    const rawCount = typeof randomElements.randomCount?.value === 'string'
      ? randomElements.randomCount.value.trim()
      : '';

    const selected = new Set();
    if (!rawCount) {
      const density = 0.5;
      available.forEach((idx) => { if (Math.random() < density) selected.add(idx); });
    } else {
      const parsed = Number.parseInt(rawCount, 10);
      if (Number.isNaN(parsed)) {
        const density = 0.5;
        available.forEach((idx) => { if (Math.random() < density) selected.add(idx); });
      } else if (parsed > 0) {
        const target = Math.min(parsed, available.length);
        while (selected.size < target) {
          const idx = available[Math.floor(Math.random() * available.length)];
          selected.add(idx);
        }
      }
    }

    const pulses = Array.from(selected)
      .sort((a, b) => a - b)
      .map((base) => ({ base, numerator: null }));
    state.pulses = normalizePulseList(pulses);
    persistPulses();
    renderPulseSequence();
    clearPulseHelp();
  }
}

function parsePulseTokens(text) {
  const raw = (text || '').trim();
  if (!raw) return { pulses: [] };

  const tokens = raw.split(/\s+/).filter(Boolean);
  const pulses = [];
  let lastInteger = 0;

  for (const token of tokens) {
    if (!token) continue;
    let base = null;
    let numerator = null;

    if (token.includes('.')) {
      const [intPart, fracPart] = token.split('.');
      if (!fracPart) {
        return { error: `El Pfr '${token}' no es válido.` };
      }
      const parsedNumerator = Number.parseInt(fracPart, 10);
      if (!Number.isFinite(parsedNumerator) || parsedNumerator <= 0) {
        return { error: `El Pfr '${token}' no es válido.` };
      }
      if (!Number.isFinite(state.params.denominator) || state.params.denominator <= 0) {
        return { error: 'Define la fracción n/d antes de añadir pulsos fraccionados.' };
      }
      if (parsedNumerator >= state.params.denominator) {
        return {
          error: `El Pfr '${token}' es mayor que la fracción. Introduce un número menor que '${state.params.denominator}'.`
        };
      }
      numerator = parsedNumerator;
      if (intPart === '') {
        base = Number.isFinite(lastInteger) ? lastInteger : 0;
      } else {
        const parsedBase = Number.parseInt(intPart, 10);
        if (!Number.isFinite(parsedBase)) {
          return { error: `El Pfr '${token}' no es válido.` };
        }
        base = parsedBase;
      }
    } else {
      const parsedBase = Number.parseInt(token, 10);
      if (!Number.isFinite(parsedBase)) continue;
      base = parsedBase;
      numerator = null;
      lastInteger = base;
    }

    base = Math.max(0, Math.round(Number(base) || 0));
    pulses.push({ base, numerator });
  }

  return { pulses };
}

function confirmPulseSequence({ reason } = {}) {
  const text = sanitizePulseText(getPulseSeqText());
  const parsed = parsePulseTokens(text);
  if (parsed.error) {
    showPulseHelp(parsed.error);
    renderPulseSequence();
    return false;
  }

  const normalized = normalizePulseList(parsed.pulses);
  state.pulses = normalized;
  persistPulses();
  renderPulseSequence();
  clearPulseHelp();
  if (reason === 'enter' && pulseSeqElements.edit) {
    try { pulseSeqElements.edit.blur(); } catch {}
  }
  return true;
}

function updateFractionDisplay() {
  const numerator = state.params.numerator;
  const denominator = state.params.denominator;
  if (pulseSeqElements.fractionNumerator) {
    pulseSeqElements.fractionNumerator.textContent = Number.isFinite(numerator) && numerator > 0 ? String(numerator) : 'n';
  }
  if (pulseSeqElements.fractionDenominator) {
    pulseSeqElements.fractionDenominator.textContent = Number.isFinite(denominator) && denominator > 0 ? String(denominator) : 'd';
  }
}

function updateLgDisplay() {
  if (!pulseSeqElements.lg) return;
  const { Lg } = state.params;
  pulseSeqElements.lg.textContent = Number.isFinite(Lg) && Lg > 0 ? String(Lg) : 'Lg';
}

function ensureMixerChannels() {
  const mixer = getMixer();
  if (!mixer || ensureMixerChannels._done) return;
  mixer.registerChannel('pulse', { allowSolo: true, label: 'Pulso/Pulso 0' });
  mixer.registerChannel('selected', { allowSolo: true, label: 'Seleccionados' });
  ensureMixerChannels._done = true;
}

async function initAudio() {
  if (audio) return audio;
  await ensureAudio();
  audio = new TimelineAudio();
  await audio.ready();
  ensureMixerChannels();

  const baseSoundSelect = selectors.baseSoundSelect();
  const selectedSoundSelect = selectors.selectedSoundSelect();
  const startSoundSelect = selectors.startSoundSelect();

  if (baseSoundSelect?.dataset.value) {
    audio.setBase(baseSoundSelect.dataset.value);
  }
  if (selectedSoundSelect?.dataset.value) {
    audio.setAccent(selectedSoundSelect.dataset.value);
  }
  if (startSoundSelect?.dataset.value) {
    audio.setStart(startSoundSelect.dataset.value);
  }

  schedulingBridge.applyTo(audio);
  state.audioReady = true;
  applyParamsToAudio(audio);
  return audio;
}

async function startPlayback() {
  const instance = await initAudio();
  if (!instance) return false;

  const { Lg, V } = state.params;
  if (!Number.isFinite(Lg) || !Number.isFinite(V) || Lg <= 0 || V <= 0) {
    return false;
  }

  const timing = fromLgAndTempo(Lg, V);
  if (!timing || !Number.isFinite(timing.interval)) return false;

  instance.stop();
  await instance.play(Lg, timing.interval, new Set(), true);

  state.isPlaying = true;
  updatePlayVisual(true);
  return true;
}

function stopPlayback() {
  if (!audio) return;
  try { audio.stop(); } catch {}
  state.isPlaying = false;
  updatePlayVisual(false);
}

function updatePlayVisual(isPlaying) {
  const playBtn = selectors.playBtn();
  if (!playBtn) return;
  const iconPlay = playBtn.querySelector('.icon-play');
  const iconStop = playBtn.querySelector('.icon-stop');
  playBtn.classList.toggle('active', !!isPlaying);
  if (iconPlay) iconPlay.style.display = isPlaying ? 'none' : 'block';
  if (iconStop) iconStop.style.display = isPlaying ? 'block' : 'none';
  if (!isPlaying) {
    pulseSeqElements.edit?.classList.remove('playing');
  } else {
    pulseSeqElements.edit?.classList.add('playing');
  }
}

function wirePlayButton() {
  const playBtn = selectors.playBtn();
  if (!playBtn) return;
  playBtn.addEventListener('click', async () => {
    try {
      if (state.isPlaying) {
        stopPlayback();
        return;
      }
      await startPlayback();
    } catch (error) {
      console.error('No se pudo iniciar la reproducción en App4', error);
    }
  });
}

function initMixerMenuForApp() {
  const mixerMenu = selectors.mixerMenu();
  const playBtn = selectors.playBtn();
  ensureMixerChannels();
  initMixerMenu({
    menu: mixerMenu,
    triggers: [playBtn].filter(Boolean),
    channels: [
      { id: 'pulse', label: 'Pulso/Pulso 0', allowSolo: true },
      { id: 'selected', label: 'Seleccionados', allowSolo: true },
      { id: 'master', label: 'Master', allowSolo: false, isMaster: true }
    ]
  });
}

function syncToggleButton(button, enabled) {
  if (!button) return;
  const isActive = enabled !== false;
  button.classList.toggle('active', isActive);
  button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  button.dataset.state = isActive ? 'on' : 'off';
}

function updateSelectedToggleUI(enabled) {
  selectedChannelEnabled = enabled !== false;
  syncToggleButton(selectors.selectedToggleBtn(), selectedChannelEnabled);
}

function setSelectedChannelEnabled(value) {
  const enabled = value !== false;
  const already = selectedChannelEnabled === enabled;
  ensureMixerChannels();
  updateSelectedToggleUI(enabled);
  if (already) return;

  const shouldMute = !enabled;
  mixerSyncGuard = true;
  try {
    setChannelMute('selected', shouldMute);
    setChannelMute('accent', shouldMute);
    if (shouldMute) {
      setChannelSolo('selected', false);
      setChannelSolo('accent', false);
    } else {
      const mixer = getMixer();
      const selectedState = mixer?.getChannelState?.('selected');
      if (selectedState) {
        setChannelSolo('accent', !!selectedState.solo);
      }
    }
  } finally {
    mixerSyncGuard = false;
  }
}

function initSelectedToggle() {
  const button = selectors.selectedToggleBtn();
  if (!button) return;

  ensureMixerChannels();
  const mixer = getMixer();
  const selectedState = mixer?.getChannelState?.('selected');
  if (selectedState) {
    updateSelectedToggleUI(!selectedState.muted);
  } else {
    updateSelectedToggleUI(selectedChannelEnabled);
  }

  button.addEventListener('click', () => {
    setSelectedChannelEnabled(!selectedChannelEnabled);
  });
}

function syncSelectedChannel() {
  subscribeMixer((snapshot) => {
    if (!snapshot || mixerSyncGuard) return;
    const channels = Array.isArray(snapshot.channels) ? snapshot.channels : [];
    const selected = channels.find((ch) => ch.id === 'selected');
    const accent = channels.find((ch) => ch.id === 'accent');
    if (!selected) return;

    updateSelectedToggleUI(!selected.muted);

    mixerSyncGuard = true;
    try {
      if (!accent || Math.abs((accent.volume ?? 1) - (selected.volume ?? 1)) > 1e-4) {
        setChannelVolume('accent', selected.volume ?? 1);
      }
      if (!accent || !!accent.muted !== !!selected.muted) {
        setChannelMute('accent', !!selected.muted);
      }
      if (!accent || !!accent.solo !== !!selected.solo) {
        setChannelSolo('accent', !!selected.solo);
      }
    } finally {
      mixerSyncGuard = false;
    }
  });
}

function initSoundMenus() {
  const baseSoundSelect = selectors.baseSoundSelect();
  const selectedSoundSelect = selectors.selectedSoundSelect();
  const startSoundSelect = selectors.startSoundSelect();

  initSoundDropdown(baseSoundSelect, {
    storageKey: STORE_KEY('baseSound'),
    eventType: 'baseSound',
    getAudio: initAudio,
    apply: (instance, value) => instance?.setBase(value)
  });
  initSoundDropdown(selectedSoundSelect, {
    storageKey: STORE_KEY('selectedSound'),
    eventType: 'selectedSound',
    getAudio: initAudio,
    apply: (instance, value) => instance?.setAccent(value)
  });
  initSoundDropdown(startSoundSelect, {
    storageKey: STORE_KEY('startSound'),
    eventType: 'startSound',
    getAudio: initAudio,
    apply: (instance, value) => instance?.setStart(value)
  });
}

function initRandomization() {
  collectRandomElements();
  if (!randomElements.button || !randomElements.menu) return;

  applyRandomConfigToInputs(randomConfig);
  persistRandomConfig();

  const persist = () => persistRandomConfig();
  [
    randomElements.randLgToggle,
    randomElements.randLgMin,
    randomElements.randLgMax,
    randomElements.randVToggle,
    randomElements.randVMin,
    randomElements.randVMax,
    randomElements.randPulsesToggle,
    randomElements.randomCount
  ].forEach((element) => {
    element?.addEventListener('change', persist);
  });

  randomElements.randomCount?.addEventListener('input', persist);

  initRandomMenu(randomElements.button, randomElements.menu, randomize);
}

function init() {
  document.body.dataset.appId = APP_ID;
  setupParameterInputs();
  setupPulseSequence();
  updateFractionDisplay();
  updateLgDisplay();
  renderPulseSequence();
  initRandomization();
  initSoundMenus();
  initMixerMenuForApp();
  initSelectedToggle();
  syncSelectedChannel();
  wirePlayButton();
}

window.addEventListener('DOMContentLoaded', init);
