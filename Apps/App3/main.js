import { TimelineAudio, ensureAudio, getMixer, subscribeMixer } from '../../libs/sound/index.js';
import { attachHover } from '../../libs/shared-ui/hover.js';
import { initSoundDropdown } from '../../libs/shared-ui/sound-dropdown.js';
import { computeNumberFontRem, solidMenuBackground } from './utils.js';
import { initRandomMenu } from '../../libs/app-common/random-menu.js';
import { createSchedulingBridge, bindSharedSoundEvents } from '../../libs/app-common/audio.js';
import { initMixerMenu } from '../../libs/app-common/mixer-menu.js';
import { fromLgAndTempo, gridFromOrigin, computeSubdivisionFontRem, toPlaybackPulseCount } from '../../libs/app-common/subdivision.js';

let audio;
const schedulingBridge = createSchedulingBridge({ getAudio: () => audio });
window.addEventListener('sharedui:scheduling', schedulingBridge.handleSchedulingEvent);
bindSharedSoundEvents({
  getAudio: () => audio,
  mapping: {
    baseSound: 'setBase',
    startSound: 'setStart',
    cycleSound: 'setCycle'
  }
});
let isPlaying = false;
let loopEnabled = false;
let circularTimeline = false;
let isUpdating = false;

const PULSE_NUMBER_HIDE_THRESHOLD = 71;
const SUBDIVISION_HIDE_THRESHOLD = 41;
const NUMBER_CIRCLE_OFFSET = 28;

const defaults = {
  Lg: 8,
  V: 120,
  numerator: 2,
  denominator: 3
};

const randomDefaults = {
  Lg: { enabled: true, range: [2, 30] },
  V: { enabled: true, range: [40, 320] },
  n: { enabled: true, range: [1, 9] },
  d: { enabled: true, range: [1, 9] },
  allowComplex: true
};

const storePrefix = 'app3';
const storeKey = (key) => `${storePrefix}::${key}`;
const loadOpt = (key) => {
  try { return localStorage.getItem(storeKey(key)); } catch { return null; }
};
const saveOpt = (key, value) => {
  try { localStorage.setItem(storeKey(key), value); } catch {}
};
const clearOpt = (key) => {
  try { localStorage.removeItem(storeKey(key)); } catch {}
};

function clearStoredPreferences() {
  try {
    const prefix = `${storePrefix}::`;
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
  setPulseAudio(true, { persist: false });
  setCycleAudio(true, { persist: false });
  window.location.reload();
});

const inputLg = document.getElementById('inputLg');
const inputV = document.getElementById('inputV');
const inputLgUp = document.getElementById('inputLgUp');
const inputLgDown = document.getElementById('inputLgDown');
const inputVUp = document.getElementById('inputVUp');
const inputVDown = document.getElementById('inputVDown');
const unitLg = document.getElementById('unitLg');
const unitV = document.getElementById('unitV');
const formula = document.getElementById('formula');
const timelineWrapper = document.getElementById('timelineWrapper');
const timeline = document.getElementById('timeline');
const playBtn = document.getElementById('playBtn');
const loopBtn = document.getElementById('loopBtn');
const randomBtn = document.getElementById('randomBtn');
const randomMenu = document.getElementById('randomMenu');
const mixerMenu = document.getElementById('mixerMenu');
const tapBtn = document.getElementById('tapTempoBtn');
const tapHelp = document.getElementById('tapHelp');
const resetBtn = document.getElementById('resetBtn');
const circularTimelineToggle = document.getElementById('circularTimelineToggle');

const randLgToggle = document.getElementById('randLgToggle');
const randLgMin = document.getElementById('randLgMin');
const randLgMax = document.getElementById('randLgMax');
const randVToggle = document.getElementById('randVToggle');
const randVMin = document.getElementById('randVMin');
const randVMax = document.getElementById('randVMax');
const randNToggle = document.getElementById('randNToggle');
const randNMin = document.getElementById('randNMin');
const randNMax = document.getElementById('randNMax');
const randDToggle = document.getElementById('randDToggle');
const randDMin = document.getElementById('randDMin');
const randDMax = document.getElementById('randDMax');
const randComplexToggle = document.getElementById('randComplexToggle');

const baseSoundSelect = document.getElementById('baseSoundSelect');
const startSoundSelect = document.getElementById('startSoundSelect');
const cycleSoundSelect = document.getElementById('cycleSoundSelect');
const themeSelect = document.getElementById('themeSelect');
const pulseToggleBtn = document.getElementById('pulseToggleBtn');
const cycleToggleBtn = document.getElementById('cycleToggleBtn');
const inputT = document.getElementById('inputT');
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
}

let numeratorInput;
let denominatorInput;
let ghostFractionContainer;
let ghostNumeratorText;
let ghostDenominatorText;
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
let pulseNumberLabels = [];

let pulses = [];
let bars = [];
let cycleMarkers = [];
let cycleLabels = [];
let lastStructureSignature = {
  lg: null,
  numerator: null,
  denominator: null
};
const T_INDICATOR_TRANSITION_DELAY = 650;
let tIndicatorRevealTimeout = null;
let pulseAudioEnabled = true;
let cycleAudioEnabled = true;
const PULSE_AUDIO_KEY = 'pulseAudio';
const CYCLE_AUDIO_KEY = 'cycleAudio';
let hasStoredPulsePref = false;
let hasStoredCyclePref = false;

const shouldRenderTIndicator = Boolean(document.querySelector('.param.t'));
const tIndicator = shouldRenderTIndicator ? (() => {
  const indicator = document.createElement('div');
  indicator.id = 'tIndicator';
  indicator.style.visibility = 'hidden';
  timeline.appendChild(indicator);
  return indicator;
})() : null;

function initFractionEditor() {
  if (!formula) return;
  formula.innerHTML = '';
  const container = document.createElement('div');
  container.className = 'fraction-editor';

  const wrapper = document.createElement('div');
  wrapper.className = 'fraction-editor-wrapper';
  ghostFractionContainer = document.createElement('div');
  ghostFractionContainer.className = 'fraction-ghost fraction-ghost--hidden';
  ghostFractionContainer.setAttribute('aria-hidden', 'true');

  const ghostNumeratorWrapper = document.createElement('div');
  ghostNumeratorWrapper.className = 'fraction-ghost__numerator';
  ghostNumeratorText = document.createElement('span');
  ghostNumeratorText.className = 'fraction-ghost__number';
  ghostNumeratorWrapper.appendChild(ghostNumeratorText);

  const ghostBar = document.createElement('div');
  ghostBar.className = 'fraction-ghost__bar';

  const ghostDenominatorWrapper = document.createElement('div');
  ghostDenominatorWrapper.className = 'fraction-ghost__denominator';
  ghostDenominatorText = document.createElement('span');
  ghostDenominatorText.className = 'fraction-ghost__number';
  ghostDenominatorWrapper.appendChild(ghostDenominatorText);

  ghostFractionContainer.append(ghostNumeratorWrapper, ghostBar, ghostDenominatorWrapper);

  wrapper.appendChild(ghostFractionContainer);
  wrapper.appendChild(container);
  formula.appendChild(wrapper);

  fractionInfoBubble = document.createElement('div');
  fractionInfoBubble.className = 'fraction-info-bubble fraction-info-bubble--hidden';
  fractionInfoBubble.setAttribute('role', 'status');
  fractionInfoBubble.setAttribute('aria-live', 'polite');
  solidMenuBackground(fractionInfoBubble);
  wrapper.appendChild(fractionInfoBubble);

  const createField = ({ wrapperClass, placeholder, ariaUp, ariaDown }) => {
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
    placeholder: 'n',
    ariaUp: 'Incrementar numerador',
    ariaDown: 'Decrementar numerador'
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
    placeholder: 'd',
    ariaUp: 'Incrementar denominador',
    ariaDown: 'Decrementar denominador'
  });
  denominatorInput = denominatorField.input;
  denominatorFieldWrapper = denominatorField.wrapper;
  denominatorFieldPlaceholder = denominatorField.placeholder;
  bottom.appendChild(denominatorField.wrapper);
  registerFractionHoverTarget(denominatorField.wrapper);
  registerFractionHoverTarget(denominatorInput, { useFocus: true });

  container.appendChild(top);
  container.appendChild(bottom);

  const enforceInt = (input) => {
    input.addEventListener('input', () => {
      let val = parseInt(input.value, 10);
      if (!Number.isFinite(val) || val <= 0) {
        input.value = '';
      } else {
        input.value = String(val);
      }
      handleInput();
    });
    input.addEventListener('blur', () => {
      let val = parseInt(input.value, 10);
      if (!Number.isFinite(val) || val <= 0) {
        input.value = '';
      } else {
        input.value = String(val);
      }
      handleInput();
    });
  };

  enforceInt(numeratorInput);
  enforceInt(denominatorInput);

  addRepeatPress(numeratorField.up, () => adjustInput(numeratorInput, +1));
  addRepeatPress(numeratorField.down, () => adjustInput(numeratorInput, -1));
  addRepeatPress(denominatorField.up, () => adjustInput(denominatorInput, +1));
  addRepeatPress(denominatorField.down, () => adjustInput(denominatorInput, -1));

  updateFractionFieldState(null, null);
}

initFractionEditor();

function parseIntSafe(val) {
  const n = Number.parseInt(val, 10);
  return Number.isFinite(n) ? n : NaN;
}

function parseFloatSafe(val) {
  const n = Number.parseFloat(val);
  return Number.isFinite(n) ? n : NaN;
}

function formatInteger(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '';
  return Math.round(numeric).toLocaleString('ca-ES');
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

function formatBpmValue(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '';
  const rounded = Math.round(numeric * 10) / 10;
  return rounded.toLocaleString('ca-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1
  });
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
  return `Esta fracción es múltiple de ${info.reducedNumerator}/${info.reducedDenominator}. Se repite ${accentEvery} veces la misma subdivisión en cada fracción ${info.numerator}/${info.denominator}.`;
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

function updateFractionGhost(info) {
  if (!ghostFractionContainer || !ghostNumeratorText || !ghostDenominatorText) return;
  if (!info || !info.isMultiple) {
    ghostFractionContainer.classList.add('fraction-ghost--hidden');
    ghostFractionContainer.classList.remove('fraction-ghost--visible');
    ghostNumeratorText.textContent = '';
    ghostDenominatorText.textContent = '';
    return;
  }
  ghostNumeratorText.textContent = info.reducedNumerator;
  ghostDenominatorText.textContent = info.reducedDenominator;
  ghostFractionContainer.classList.remove('fraction-ghost--hidden');
  ghostFractionContainer.classList.add('fraction-ghost--visible');
}

function updateFractionUI(numerator, denominator) {
  currentFractionInfo = computeFractionInfo(numerator, denominator);
  updateFractionFieldState(numerator, denominator);
  updateFractionInfoBubble(currentFractionInfo, { reveal: true });
  updateFractionGhost(currentFractionInfo);
}

function setValue(input, value) {
  if (!input) return;
  isUpdating = true;
  const normalized = value == null || Number.isNaN(value) ? '' : String(value);
  input.value = normalized;
  isUpdating = false;
}

function clampRange(min, max, fallbackMin, fallbackMax) {
  let lo = Number(min);
  let hi = Number(max);
  if (!Number.isFinite(lo)) lo = fallbackMin;
  if (!Number.isFinite(hi)) hi = fallbackMax;
  if (hi < lo) [lo, hi] = [hi, lo];
  return [lo, hi];
}

/**
 * Prepara i retorna l'única instància `TimelineAudio` utilitzada per App3.
 *
 * @returns {Promise<TimelineAudio>} audio configurat amb les preferències actuals.
 * @remarks Es crida abans de reproduir o quan el menú de sons necessita llistats. Depèn de WebAudio i `bindSharedSoundEvents`; habilita PulseMemory = 1..Lg-1 amb re-sync via `computeNextZero`. Efectes: crea listeners i ajusta estats del mixer global.
 */
async function initAudio() {
  if (audio) return audio;
  await ensureAudio();
  audio = new TimelineAudio();
  await audio.ready();
  schedulingBridge.applyTo(audio);
  if (typeof audio.setPulseEnabled === 'function') {
    audio.setPulseEnabled(pulseAudioEnabled);
  }
  if (typeof audio.setCycleEnabled === 'function') {
    audio.setCycleEnabled(cycleAudioEnabled);
  }
  return audio;
}

function updateAudioTotal(total) {
  if (!audio || total == null) return;
  if (typeof audio.setTotal === 'function') {
    audio.setTotal(total);
  } else if (typeof audio.updateTransport === 'function') {
    audio.updateTransport({ totalPulses: total });
  }
}

function updateAudioPattern(pattern) {
  if (!audio || pattern == null) return;
  if (typeof audio.setPattern === 'function') {
    audio.setPattern(pattern);
  } else if (typeof audio.updateTransport === 'function') {
    audio.updateTransport({ patternBeats: pattern });
  }
}

function updateAudioTempo(bpm, options = {}) {
  if (!audio || !Number.isFinite(bpm) || bpm <= 0) return;
  if (typeof audio.setTempo === 'function') {
    audio.setTempo(bpm, options);
  } else if (typeof audio.updateTransport === 'function') {
    audio.updateTransport({ bpm });
  }
}

function applyCycleConfig({ numerator, denominator, onTick }) {
  if (!audio) return;
  if (typeof audio.updateCycleConfig === 'function') {
    audio.updateCycleConfig({ numerator, denominator, onTick });
  } else if (typeof audio.updateTransport === 'function') {
    audio.updateTransport({
      cycle: {
        numerator: numerator ?? null,
        denominator: denominator ?? null,
        onTick
      }
    });
  }
}

function bindUnit(input, unit) {
  if (!input || !unit) return;
  input.addEventListener('focus', () => { unit.style.display = 'block'; });
  input.addEventListener('blur', () => { unit.style.display = 'none'; });
}

bindUnit(inputLg, unitLg);
bindUnit(inputV, unitV);

attachHover(playBtn, { text: 'Play / Stop' });
attachHover(loopBtn, { text: 'Loop' });
attachHover(randomBtn, { text: 'Aleatorizar parámetros' });
attachHover(tapBtn, { text: 'Tap Tempo' });
attachHover(resetBtn, { text: 'Reset App' });
attachHover(circularTimelineToggle, { text: 'Línea temporal circular' });
attachHover(themeSelect, { text: 'Tema' });
if (pulseToggleBtn) {
  attachHover(pulseToggleBtn, { text: 'Activar o silenciar el pulso' });
}
if (cycleToggleBtn) {
  attachHover(cycleToggleBtn, { text: 'Activar o silenciar el ciclo' });
}

function syncToggleButton(button, enabled) {
  if (!button) return;
  button.classList.toggle('active', enabled);
  button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  button.dataset.state = enabled ? 'on' : 'off';
}

/**
 * Actualitza la preferència d'àudio per al canal de polsos i sincronitza UI/Storage.
 *
 * @param {boolean} value estat desitjat.
 * @param {{ persist?: boolean }} [options] control sobre la persistència a `localStorage`.
 * @returns {void}
 * @remarks Es crida per botons, mixer global o estat inicial. Depèn de DOM, `localStorage` i mixer compartit; cap càlcul PulseMemory més enllà d'habilitar 0/Lg derivats a l'àudio.
 */
function setPulseAudio(value, { persist = true } = {}) {
  const enabled = value !== false;
  pulseAudioEnabled = enabled;
  syncToggleButton(pulseToggleBtn, enabled);
  if (persist) {
    saveOpt(PULSE_AUDIO_KEY, enabled ? '1' : '0');
    hasStoredPulsePref = true;
  }
  if (globalMixer) {
    globalMixer.setChannelMute('pulse', !enabled);
  }
  if (audio && typeof audio.setPulseEnabled === 'function') {
    audio.setPulseEnabled(enabled);
  }
}

/**
 * Sincronitza el canal d'àudio de subdivisions amb la UI i l'emmagatzematge.
 *
 * @param {boolean} value estat desitjat.
 * @param {{ persist?: boolean }} [options] configura si es desa a `localStorage`.
 * @returns {void}
 * @remarks Invocat per UI, mixer o arrencada. Depèn de DOM i mixer; comparteix supòsits PulseMemory 1..Lg-1 i 0/Lg derivats.
 */
function setCycleAudio(value, { persist = true } = {}) {
  const enabled = value !== false;
  cycleAudioEnabled = enabled;
  syncToggleButton(cycleToggleBtn, enabled);
  if (persist) {
    saveOpt(CYCLE_AUDIO_KEY, enabled ? '1' : '0');
    hasStoredCyclePref = true;
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
  hasStoredPulsePref = true;
  setPulseAudio(false, { persist: false });
} else if (storedPulseAudio === '1') {
  hasStoredPulsePref = true;
  setPulseAudio(true, { persist: false });
} else {
  hasStoredPulsePref = false;
  setPulseAudio(true, { persist: false });
}
const storedCycleAudio = loadOpt(CYCLE_AUDIO_KEY);
if (storedCycleAudio === '0') {
  hasStoredCyclePref = true;
  setCycleAudio(false, { persist: false });
} else if (storedCycleAudio === '1') {
  hasStoredCyclePref = true;
  setCycleAudio(true, { persist: false });
} else {
  hasStoredCyclePref = false;
  setCycleAudio(true, { persist: false });
}

pulseToggleBtn?.addEventListener('click', () => {
  setPulseAudio(!pulseAudioEnabled);
});

cycleToggleBtn?.addEventListener('click', () => {
  setCycleAudio(!cycleAudioEnabled);
});

const mixerTriggers = [playBtn].filter(Boolean);

initMixerMenu({
  menu: mixerMenu,
  triggers: mixerTriggers,
  channels: [
    { id: 'pulse', label: 'Pulso/Pulso 0', allowSolo: true },
    { id: 'subdivision', label: 'Subdivisión', allowSolo: true },
    { id: 'master', label: 'Master', allowSolo: false, isMaster: true }
  ]
});

subscribeMixer((snapshot) => {
  if (!snapshot || !Array.isArray(snapshot.channels)) return;
  const findChannel = (id) => snapshot.channels.find(channel => channel.id === id);

  const syncFromChannel = (channelState, setter, current) => {
    if (!channelState) return;
    const shouldEnable = !channelState.effectiveMuted;
    if (current === shouldEnable) return;
    setter(shouldEnable, { persist: false });
  };

  syncFromChannel(findChannel('pulse'), setPulseAudio, pulseAudioEnabled);
  syncFromChannel(findChannel('subdivision'), setCycleAudio, cycleAudioEnabled);
});

function applyTheme(value) {
  const val = value || 'system';
  if (val === 'system') {
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.body.dataset.theme = dark ? 'dark' : 'light';
  } else {
    document.body.dataset.theme = val;
  }
  saveOpt('theme', val);
  try {
    window.dispatchEvent(new CustomEvent('sharedui:theme', {
      detail: { value: document.body.dataset.theme, raw: val }
    }));
  } catch {}
}

const storedTheme = loadOpt('theme');
if (themeSelect) {
  if (storedTheme) themeSelect.value = storedTheme;
  applyTheme(themeSelect.value || 'system');
  themeSelect.addEventListener('change', (e) => applyTheme(e.target.value));
} else {
  applyTheme(storedTheme || 'system');
}

document.addEventListener('sharedui:mute', async (e) => {
  const val = !!(e && e.detail && e.detail.value);
  saveOpt('mute', val ? '1' : '0');
  const instance = await initAudio();
  if (instance && typeof instance.setMute === 'function') {
    instance.setMute(val);
  }
});

(function restoreMutePreference() {
  try {
    const saved = loadOpt('mute');
    if (saved === '1') document.getElementById('muteBtn')?.click();
  } catch {}
})();

function getLg() {
  return parseIntSafe(inputLg.value);
}

function getV() {
  return parseFloatSafe(inputV.value);
}

function getFraction() {
  const n = parseIntSafe(numeratorInput.value);
  const d = parseIntSafe(denominatorInput.value);
  return {
    numerator: Number.isFinite(n) && n > 0 ? n : null,
    denominator: Number.isFinite(d) && d > 0 ? d : null
  };
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

  const lgValue = getLg();
  const hasLg = Number.isFinite(lgValue) && lgValue > 0;
  const { numerator, denominator } = getFraction();
  const hasNumerator = Number.isFinite(numerator) && numerator > 0;
  const hasDenominator = Number.isFinite(denominator) && denominator > 0;
  const hasFraction = hasNumerator && hasDenominator;

  if (hasLg) {
    const lgLine = document.createElement('p');
    lgLine.className = 'top-bar-info-tip__line';
    const lgLabel = document.createElement('strong');
    lgLabel.textContent = 'Pulsos enteros (Lg):';
    lgLine.append(lgLabel, ' ', formatInteger(lgValue));
    fragment.append(lgLine);
  } else {
    const hint = document.createElement('p');
    hint.className = 'top-bar-info-tip__hint';
    hint.textContent = 'Define una Lg válida para obtener las fórmulas.';
    fragment.append(hint);
  }

  const tempoValue = getV();
  const hasTempo = Number.isFinite(tempoValue) && tempoValue > 0;
  const tValue = inputT ? parseFloatSafe(inputT.value) : NaN;
  const hasT = Number.isFinite(tValue) && tValue > 0;
  const derivedTFromTempo = hasLg && hasTempo ? (lgValue * 60) / tempoValue : null;
  const tempoFromT = hasLg && hasT ? (lgValue / tValue) * 60 : null;
  const effectiveTempo = hasTempo ? tempoValue : tempoFromT;
  const tForBaseFormula = hasT ? tValue : derivedTFromTempo;

  if (effectiveTempo != null && hasLg && tForBaseFormula != null) {
    const baseFormulaLine = document.createElement('p');
    baseFormulaLine.className = 'top-bar-info-tip__line';
    const baseLabel = document.createElement('strong');
    baseLabel.textContent = 'V base';
    baseFormulaLine.append(
      baseLabel,
      ` = (${formatInteger(lgValue)} / ${formatNumberValue(tForBaseFormula)})·60 = ${formatBpmValue(effectiveTempo)} BPM`
    );
    fragment.append(baseFormulaLine);
  } else if (hasTempo) {
    const baseLine = document.createElement('p');
    baseLine.className = 'top-bar-info-tip__line';
    const baseLabel = document.createElement('strong');
    baseLabel.textContent = 'V base:';
    baseLine.append(baseLabel, ' ', `${formatBpmValue(tempoValue)} BPM`);
    fragment.append(baseLine);
  } else {
    const hint = document.createElement('p');
    hint.className = 'top-bar-info-tip__hint';
    hint.textContent = 'Completa Lg y V para calcular la velocidad base.';
    fragment.append(hint);
  }

  if (hasLg && hasFraction) {
    const fractionalLg = (lgValue * denominator) / numerator;
    const pfrLine = document.createElement('p');
    pfrLine.className = 'top-bar-info-tip__line';
    const pfrLabel = document.createElement('strong');
    pfrLabel.textContent = 'Pfr (Lg·d/n)';
    const pfrFormula = ` = (${formatInteger(lgValue)}·${formatInteger(denominator)})/${formatInteger(numerator)} = ${formatNumberValue(fractionalLg)}`;
    pfrLine.append(pfrLabel, pfrFormula);
    fragment.append(pfrLine);
  } else {
    const hint = document.createElement('p');
    hint.className = 'top-bar-info-tip__hint';
    hint.textContent = 'Completa n y d para calcular los pulsos fraccionados.';
    fragment.append(hint);
  }

  if (effectiveTempo != null && hasFraction) {
    const fractionTempo = effectiveTempo * (denominator / numerator);
    const fractionFormulaLine = document.createElement('p');
    fractionFormulaLine.className = 'top-bar-info-tip__line';
    const fractionLabel = document.createElement('strong');
    fractionLabel.textContent = `V ${numerator}/${denominator}`;
    const fractionFormula = ` = (${formatBpmValue(effectiveTempo)}·${formatInteger(denominator)})/${formatInteger(numerator)} = ${formatBpmValue(fractionTempo)} BPM`;
    fractionFormulaLine.append(fractionLabel, fractionFormula);
    fragment.append(fractionFormulaLine);
  } else {
    const hint = document.createElement('p');
    hint.className = 'top-bar-info-tip__hint';
    hint.textContent = 'Introduce V, n y d para obtener la velocidad de la fracción.';
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
  }

  return fragment;
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

function updateTIndicatorText(value) {
  if (!tIndicator) return;
  if (value === '' || value == null) {
    tIndicator.textContent = '';
    tIndicator.style.visibility = 'hidden';
    return;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) {
    tIndicator.textContent = `T: ${String(value)}`;
    return;
  }
  const rounded = Math.round(n * 10) / 10;
  tIndicator.textContent = `T: ${rounded}`;
}

function updateTIndicatorPosition() {
  if (!timeline || !tIndicator) return false;
  const lg = getLg();
  if (!Number.isFinite(lg) || lg <= 0) return false;
  let anchor = timeline.querySelector(`.pulse-number[data-index="${lg}"]`);
  if (!anchor) anchor = timeline.querySelector(`.pulse[data-index="${lg}"]`);
  if (!anchor) anchor = pulses[pulses.length - 1] || null;
  if (!anchor) return false;
  const tlRect = timeline.getBoundingClientRect();
  const aRect = anchor.getBoundingClientRect();
  const circular = timeline.classList.contains('circular');
  const offsetY = circular ? 50 : -90;
  const centerX = aRect.left + aRect.width / 2 - tlRect.left;
  const topY = aRect.bottom - tlRect.top + offsetY;
  tIndicator.style.left = `${centerX}px`;
  tIndicator.style.top = `${topY}px`;
  tIndicator.style.transform = 'translate(-50%, 0)';
  if (tIndicator.parentNode !== timeline) timeline.appendChild(tIndicator);
  return true;
}

function scheduleTIndicatorReveal(delay = 0) {
  if (!tIndicator) return;
  if (tIndicatorRevealTimeout) {
    clearTimeout(tIndicatorRevealTimeout);
    tIndicatorRevealTimeout = null;
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
  tIndicatorRevealTimeout = setTimeout(() => {
    tIndicatorRevealTimeout = null;
    requestAnimationFrame(() => {
      const anchored = updateTIndicatorPosition();
      tIndicator.style.visibility = anchored && tIndicator.textContent ? 'visible' : 'hidden';
    });
  }, ms);
}

function clearHighlights() {
  pulses.forEach(p => p.classList.remove('active'));
  cycleMarkers.forEach(m => m.classList.remove('active'));
  cycleLabels.forEach(l => l.classList.remove('active'));
  pulseNumberLabels.forEach(label => label.classList.remove('pulse-number--flash'));
}

function renderTimeline() {
  pulseNumberLabels = [];
  pulses = [];
  cycleMarkers = [];
  cycleLabels = [];
  bars = [];
  const savedIndicator = tIndicator;
  timeline.innerHTML = '';
  if (savedIndicator) timeline.appendChild(savedIndicator);

  const lg = getLg();
  if (!Number.isFinite(lg) || lg <= 0) return;
  const numberFontRem = computeNumberFontRem(lg);
  const subdivisionFontRem = computeSubdivisionFontRem(lg);

  for (let i = 0; i <= lg; i++) {
    const pulse = document.createElement('div');
    pulse.className = 'pulse';
    pulse.dataset.index = i;
    if (i === 0 || i === lg) pulse.classList.add('endpoint');
    timeline.appendChild(pulse);
    pulses.push(pulse);
    if (i === 0 || i === lg) {
      const bar = document.createElement('div');
      bar.className = 'bar';
      timeline.appendChild(bar);
      bars.push(bar);
    }
  }

  const { numerator, denominator } = getFraction();
  const grid = gridFromOrigin({ lg, numerator, denominator });
  if (grid.cycles > 0 && grid.subdivisions.length) {
    const hideFractionLabels = lg >= SUBDIVISION_HIDE_THRESHOLD;
    const labelFormatter = (cycleIndex, subdivision) => {
      const base = cycleIndex * numerator;
      return subdivision === 0 ? String(base) : `.${subdivision}`;
    };
    grid.subdivisions.forEach(({ cycleIndex, subdivisionIndex, position }) => {
      const marker = document.createElement('div');
      marker.className = 'cycle-marker';
      if (subdivisionIndex === 0) marker.classList.add('start');
      marker.dataset.cycleIndex = String(cycleIndex);
      marker.dataset.subdivision = String(subdivisionIndex);
      marker.dataset.position = String(position);
      timeline.appendChild(marker);
      cycleMarkers.push(marker);

      if (hideFractionLabels) return;
      const formatted = labelFormatter(cycleIndex, subdivisionIndex);
      if (formatted != null) {
        const label = document.createElement('div');
        label.className = 'cycle-label';
        if (subdivisionIndex === 0) label.classList.add('cycle-label--integer');
        if (cycleIndex === 0 && subdivisionIndex === 0) label.classList.add('cycle-label--origin');
        label.dataset.cycleIndex = String(cycleIndex);
        label.dataset.subdivision = String(subdivisionIndex);
        label.dataset.position = String(position);
        label.textContent = formatted;
        label.style.fontSize = `${subdivisionFontRem}rem`;
        timeline.appendChild(label);
        cycleLabels.push(label);
      }
    });
  }

  updatePulseNumbers();
  layoutTimeline({ silent: true });
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
 * @remarks Es crida després de canvis d'inputs, resize i toggle circular. Depèn del DOM; PulseMemory 1..Lg-1 informant posicions mentre 0/Lg es deriva per sincronitzar `highlightPulse` i `computeNextZero`.
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
    });

    cycleLabels.forEach(label => {
      const pos = Number(label.dataset.position);
      const percent = (pos / lg) * 100;
      label.style.left = `${percent}%`;
      label.style.top = 'calc(100% + 12px)';
      label.style.transform = 'translate(-50%, 0)';
    });

    queueIndicatorUpdate();
  }
}

function handleInput() {
  if (isUpdating) return;
  const lg = getLg();
  const v = getV();
  const { numerator, denominator } = getFraction();

  updateFractionUI(numerator, denominator);

  const tempoInfo = fromLgAndTempo(lg, v);
  if (tempoInfo.duration != null) {
    updateTIndicatorText(tempoInfo.duration);
  } else {
    updateTIndicatorText('');
  }

  loopBtn.disabled = !(Number.isFinite(lg) && lg > 0);

  const normalizedLg = Number.isFinite(lg) && lg > 0 ? lg : null;
  const normalizedNumerator = Number.isFinite(numerator) && numerator > 0 ? numerator : null;
  const normalizedDenominator = Number.isFinite(denominator) && denominator > 0 ? denominator : null;
  const structureChanged = (
    normalizedLg !== lastStructureSignature.lg
    || normalizedNumerator !== lastStructureSignature.numerator
    || normalizedDenominator !== lastStructureSignature.denominator
  );

  if (structureChanged) {
    lastStructureSignature = {
      lg: normalizedLg,
      numerator: normalizedNumerator,
      denominator: normalizedDenominator
    };
    renderTimeline();
  } else {
    layoutTimeline({ silent: true });
  }

  if (audio) {
    const validLg = Number.isFinite(lg) && lg > 0;
    const validV = Number.isFinite(v) && v > 0;
    const playbackTotal = validLg ? toPlaybackPulseCount(lg, loopEnabled) : null;
    const hasCycle = normalizedLg != null
      && normalizedNumerator != null
      && normalizedDenominator != null
      && Math.floor(normalizedLg / normalizedNumerator) > 0;

    if (normalizedLg != null) {
      updateAudioPattern(normalizedLg);
    }

    if (isPlaying) {
      if (playbackTotal != null) updateAudioTotal(playbackTotal);
      if (validV) {
        updateAudioTempo(v, { align: loopEnabled ? 'cycle' : 'nextPulse' });
      }

      if (hasCycle) {
        applyCycleConfig({ numerator: normalizedNumerator, denominator: normalizedDenominator, onTick: highlightCycle });
      } else {
        applyCycleConfig({ numerator: 0, denominator: 0, onTick: null });
      }

      syncVisualState();
    } else {
      if (hasCycle) {
        applyCycleConfig({ numerator: normalizedNumerator, denominator: normalizedDenominator, onTick: highlightCycle });
      } else {
        applyCycleConfig({ numerator: 0, denominator: 0, onTick: null });
      }
    }
  }
}

function adjustInput(input, delta) {
  if (!input) return;
  const current = parseIntSafe(input.value);
  const next = Number.isFinite(current) ? Math.max(1, current + delta) : delta > 0 ? 1 : 1;
  setValue(input, next);
  handleInput();
}

function addRepeatPress(el, fn) {
  if (!el) return;
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
    clearTimers();
    fn();
    timeoutId = setTimeout(() => {
      intervalId = setInterval(fn, 80);
    }, 320);
    event.preventDefault();
  };

  const stop = () => {
    clearTimers();
  };

  el.addEventListener('mousedown', start);
  el.addEventListener('touchstart', start, { passive: false });
  ['mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach((name) => {
    el.addEventListener(name, stop);
  });
  document.addEventListener('mouseup', stop);
  document.addEventListener('touchend', stop);

  el.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      fn();
    }
  });
}

[inputLg, inputV].forEach(el => {
  el.addEventListener('input', () => {
    const val = el === inputV ? parseFloatSafe(el.value) : parseIntSafe(el.value);
    if (!Number.isFinite(val) || val <= 0) return handleInput();
    if (el === inputLg) setValue(el, Math.max(1, Math.round(val)));
    else setValue(el, Math.max(1, Math.round(val)));
    handleInput();
  });
  el.addEventListener('blur', () => {
    const val = el === inputV ? parseFloatSafe(el.value) : parseIntSafe(el.value);
    if (!Number.isFinite(val) || val <= 0) {
      setValue(el, '');
    } else {
      const normalized = Math.max(1, Math.round(val));
      setValue(el, normalized);
    }
    handleInput();
  });
});

addRepeatPress(inputLgUp, () => adjustInput(inputLg, +1));
addRepeatPress(inputLgDown, () => adjustInput(inputLg, -1));
addRepeatPress(inputVUp, () => adjustInput(inputV, +1));
addRepeatPress(inputVDown, () => adjustInput(inputV, -1));

function randomInt(min, max) {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

let randomConfig = (() => {
  try {
    const stored = loadOpt('random');
    return stored ? { ...randomDefaults, ...JSON.parse(stored) } : { ...randomDefaults };
  } catch {
    return { ...randomDefaults };
  }
})();

function applyRandomConfig(cfg) {
  randLgToggle.checked = cfg.Lg.enabled;
  randLgMin.value = cfg.Lg.range[0];
  randLgMax.value = cfg.Lg.range[1];
  randVToggle.checked = cfg.V.enabled;
  randVMin.value = cfg.V.range[0];
  randVMax.value = cfg.V.range[1];
  randNToggle.checked = cfg.n.enabled;
  randNMin.value = cfg.n.range[0];
  randNMax.value = cfg.n.range[1];
  randDToggle.checked = cfg.d.enabled;
  randDMin.value = cfg.d.range[0];
  randDMax.value = cfg.d.range[1];
  randComplexToggle.checked = cfg.allowComplex;
}

/**
 * Serialitza la configuració actual del menú aleatori i la desa.
 *
 * @returns {void}
 * @remarks Es crida per cada canvi al menú random. Depèn de DOM i `localStorage`; garanteix que els valors generats mantinguin PulseMemory dins 1..Lg-1 (0/Lg derivats es recalculen a `randomize`).
 */
function updateRandomConfig() {
  randomConfig = {
    Lg: {
      enabled: randLgToggle.checked,
      range: clampRange(randLgMin.value, randLgMax.value, randomDefaults.Lg.range[0], randomDefaults.Lg.range[1])
    },
    V: {
      enabled: randVToggle.checked,
      range: clampRange(randVMin.value, randVMax.value, randomDefaults.V.range[0], randomDefaults.V.range[1])
    },
    n: {
      enabled: randNToggle.checked,
      range: clampRange(randNMin.value, randNMax.value, randomDefaults.n.range[0], randomDefaults.n.range[1])
    },
    d: {
      enabled: randDToggle.checked,
      range: clampRange(randDMin.value, randDMax.value, randomDefaults.d.range[0], randomDefaults.d.range[1])
    },
    allowComplex: randComplexToggle.checked
  };
  saveOpt('random', JSON.stringify(randomConfig));
}

applyRandomConfig(randomConfig);

[
  randLgToggle, randLgMin, randLgMax,
  randVToggle, randVMin, randVMax,
  randNToggle, randNMin, randNMax,
  randDToggle, randDMin, randDMax,
  randComplexToggle
].forEach(el => el?.addEventListener('change', updateRandomConfig));

/**
 * Assigna valors aleatoris dins dels rangs configurats als camps Lg, V i fraccions.
 *
 * @returns {void}
 * @remarks Es dispara des del menú aleatori. Depèn del DOM; reutilitza `handleInput` per validar PulseMemory 1..Lg-1 i re-sync 0/Lg via càlculs derivats.
 */
function randomize() {
  const cfg = randomConfig;
  if (cfg.Lg.enabled) {
    const [min, max] = cfg.Lg.range;
    setValue(inputLg, randomInt(min, max));
  }
  if (cfg.V.enabled) {
    const [min, max] = cfg.V.range;
    setValue(inputV, randomInt(min, max));
  }
  if (cfg.n.enabled) {
    let [min, max] = cfg.n.range;
    if (!cfg.allowComplex) {
      min = 1;
      max = 1;
    }
    setValue(numeratorInput, Math.max(1, randomInt(min, max)));
  }
  if (cfg.d.enabled) {
    const [min, max] = cfg.d.range;
    setValue(denominatorInput, Math.max(1, randomInt(min, max)));
  }
  handleInput();
}

initRandomMenu(randomBtn, randomMenu, randomize);

/**
 * Activa el pols visual corresponent durant la reproducció.
 *
 * @param {number} index index de pols rebut des de l'àudio.
 * @returns {void}
 * @remarks Cridat per `TimelineAudio` en cada tick. Depèn del DOM per afegir classes; espera PulseMemory normalitzada (1..Lg-1) i deriva 0/Lg en mode loop.
 */
function highlightPulse(index) {
  if (!isPlaying) return;
  pulses.forEach(p => p.classList.remove('active'));
  const total = pulses.length > 1 ? pulses.length - 1 : 0;
  if (total <= 0) return;
  const raw = Number.isFinite(index) ? index : 0;
  const normalized = loopEnabled
    ? ((raw % total) + total) % total
    : Math.max(0, Math.min(raw, total));
  const pulse = pulses[normalized];
  if (pulse) {
    void pulse.offsetWidth;
    pulse.classList.add('active');
  }
  if (loopEnabled && normalized === 0) {
    const last = pulses[pulses.length - 1];
    if (last) last.classList.add('active');
  }
}

/**
 * Ressalta la fracció de cicle activa en funció dels ticks de subdivisions.
 *
 * @param {{ cycleIndex?: number, subdivisionIndex?: number, numerator?: number, denominator?: number, totalCycles?: number, totalSubdivisions?: number }} [payload]
 * @returns {void}
 * @remarks Cridat des d'`TimelineAudio` quan hi ha subdivisions. Depèn del DOM; assumeix PulseMemory coherent (1..Lg-1) i valida 0/Lg derivats abans de pintar.
 */
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
  const marker = cycleMarkers.find(m => Number(m.dataset.cycleIndex) === normalizedCycleIndex && Number(m.dataset.subdivision) === normalizedSubdivisionIndex);
  const label = cycleLabels.find(l => Number(l.dataset.cycleIndex) === normalizedCycleIndex && Number(l.dataset.subdivision) === normalizedSubdivisionIndex);
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

  // Migration 2024-05: removed deprecated tolerance flash (cycle-to-pulse) now handled via direct cycle highlights.
}

function syncVisualState() {
  if (!isPlaying || !audio || typeof audio.getVisualState !== 'function') return;
  const state = audio.getVisualState();
  if (state && Number.isFinite(state.step)) {
    highlightPulse(state.step);
  }

  if (state && state.cycle && Number.isFinite(state.cycle.cycleIndex) && Number.isFinite(state.cycle.subdivisionIndex)) {
    highlightCycle(state.cycle);
  }
}

/**
 * Configura els sons seleccionats i inicia la seqüència principal de pulsos.
 *
 * @returns {Promise<void>}
 * @remarks Es crida quan l'usuari prem Play. Depèn de DOM (per llegir inputs) i WebAudio (`TimelineAudio`). Gestiona PulseMemory 1..Lg-1, i confia en `computeNextZero`/`highlightCycle` per re-sync 0/Lg. Side-effects: manipula botons i esdeveniments visuals.
 */
async function startPlayback() {
  const lg = getLg();
  const v = getV();
  const { numerator, denominator } = getFraction();
  if (!Number.isFinite(lg) || !Number.isFinite(v) || lg <= 0 || v <= 0) return;
  const hasCycle = Number.isFinite(numerator) && Number.isFinite(denominator)
    && numerator > 0 && denominator > 0 && Math.floor(lg / numerator) > 0;
  const playbackTotal = toPlaybackPulseCount(lg, loopEnabled);
  if (playbackTotal == null) return;

  const audioInstance = await initAudio();
  await audioInstance.setBase(baseSoundSelect?.dataset.value || baseSoundSelect?.value);
  await audioInstance.setStart(startSoundSelect?.dataset.value || startSoundSelect?.value);
  await audioInstance.setCycle(cycleSoundSelect?.dataset.value || cycleSoundSelect?.value);

  const interval = 60 / v;
  const onFinish = () => {
    isPlaying = false;
    playBtn.classList.remove('active');
    const iconPlay = playBtn.querySelector('.icon-play');
    const iconStop = playBtn.querySelector('.icon-stop');
    if (iconPlay && iconStop) {
      iconPlay.style.display = 'block';
      iconStop.style.display = 'none';
    }
    clearHighlights();
    audioInstance.stop();
  };

  const iconPlay = playBtn.querySelector('.icon-play');
  const iconStop = playBtn.querySelector('.icon-stop');

  audioInstance.play(
    playbackTotal,
    interval,
    new Set(),
    loopEnabled,
    highlightPulse,
    onFinish,
    hasCycle
      ? { cycle: { numerator, denominator, onTick: highlightCycle }, patternBeats: lg }
      : { patternBeats: lg }
  );

  isPlaying = true;
  playBtn.classList.add('active');
  if (iconPlay && iconStop) {
    iconPlay.style.display = 'none';
    iconStop.style.display = 'block';
  }
  scheduleTIndicatorReveal(0);
  syncVisualState();
}

playBtn.addEventListener('click', async () => {
  const audioInstance = await initAudio();
  if (isPlaying) {
    audioInstance.stop();
    isPlaying = false;
    playBtn.classList.remove('active');
    clearHighlights();
    const iconPlay = playBtn.querySelector('.icon-play');
    const iconStop = playBtn.querySelector('.icon-stop');
    if (iconPlay && iconStop) {
      iconPlay.style.display = 'block';
      iconStop.style.display = 'none';
    }
    return;
  }
  clearHighlights();
  startPlayback();
});

loopBtn.addEventListener('click', () => {
  loopEnabled = !loopEnabled;
  loopBtn.classList.toggle('active', loopEnabled);
  if (audio && typeof audio.setLoop === 'function') {
    audio.setLoop(loopEnabled);
  }
  layoutTimeline();
  handleInput();
  syncVisualState();
});

resetBtn.addEventListener('click', () => {
  ['Lg', 'V', 'n', 'd'].forEach(clearOpt);
  loopEnabled = false;
  loopBtn.classList.remove('active');
  setCircular(false);
  setPulseAudio(true, { persist: false });
  setCycleAudio(true, { persist: false });
  clearOpt(PULSE_AUDIO_KEY);
  clearOpt(CYCLE_AUDIO_KEY);
  hasStoredPulsePref = false;
  hasStoredCyclePref = false;
  if (audio) audio.stop();
  if (audio && typeof audio.resetTapTempo === 'function') {
    audio.resetTapTempo();
  }
  isPlaying = false;
  clearHighlights();
  applyInitialState();
  const iconPlay = playBtn.querySelector('.icon-play');
  const iconStop = playBtn.querySelector('.icon-stop');
  if (iconPlay && iconStop) {
    iconPlay.style.display = 'block';
    iconStop.style.display = 'none';
  }
});

async function tapTempo() {
  try {
    const audioInstance = await initAudio();
    const result = audioInstance.tapTempo(performance.now());
    if (!result) return;

    if (result.remaining > 0) {
      if (tapHelp) {
        tapHelp.textContent = result.remaining === 2 ? '2 clicks más' : '1 click más solamente';
        tapHelp.style.display = 'block';
      }
      return;
    }

    if (tapHelp) {
      tapHelp.style.display = 'none';
    }

    if (Number.isFinite(result.bpm) && result.bpm > 0) {
      const bpm = Math.round(result.bpm * 100) / 100;
      setValue(inputV, bpm);
      handleInput();
    }
  } catch (error) {
    console.warn('Tap tempo failed', error);
  }
}

if (tapBtn) {
  tapBtn.addEventListener('click', () => { tapTempo(); });
}

/**
 * Actualitza el mode de presentació circular i conserva la preferència.
 *
 * @param {boolean} value nou estat per la línia temporal circular.
 * @returns {void}
 * @remarks Invocat en arrencada i per l'interruptor. Depèn del DOM i `localStorage`; força recalcul de PulseMemory 1..Lg-1 a `layoutTimeline`.
 */
function setCircular(value) {
  circularTimeline = value;
  if (circularTimelineToggle) {
    circularTimelineToggle.checked = value;
  }
  saveOpt('circular', value ? '1' : '0');
  layoutTimeline();
}

const storedCircularRaw = loadOpt('circular');
const initialCircular = storedCircularRaw == null ? true : storedCircularRaw === '1';
setCircular(initialCircular);

if (circularTimelineToggle) {
  circularTimelineToggle.addEventListener('change', () => {
    setCircular(circularTimelineToggle.checked);
  });
}

/**
 * Inicialitza els desplegables de sons per pulso, inici i cicle.
 *
 * @returns {void}
 * @remarks Es crida un cop hi ha DOM disponible. Depèn de `initSoundDropdown` (DOM+Audio). Manté supòsits PulseMemory en delegar la sincronització a `TimelineAudio`.
 */
function setupSoundDropdowns() {
  initSoundDropdown(baseSoundSelect, {
    storageKey: storeKey('baseSound'),
    eventType: 'baseSound',
    getAudio: initAudio,
    apply: (a, val) => a.setBase(val)
  });
  initSoundDropdown(startSoundSelect, {
    storageKey: storeKey('startSound'),
    eventType: 'startSound',
    getAudio: initAudio,
    apply: (a, val) => a.setStart(val)
  });
  initSoundDropdown(cycleSoundSelect, {
    storageKey: storeKey('cycleSound'),
    eventType: 'cycleSound',
    getAudio: initAudio,
    apply: (a, val) => a.setCycle(val)
  });
}

setupSoundDropdowns();

/**
 * Restaura valors buits i preferències per defecte quan no hi ha estat guardat.
 *
 * @returns {void}
 * @remarks S'executa durant el bootstrap i quan l'usuari fa reset. Depèn de DOM i `localStorage`; sincronitza toggles d'àudio sense alterar PulseMemory.
 */
function applyInitialState() {
  setValue(inputLg, '');
  setValue(inputV, '');
  setValue(numeratorInput, '');
  setValue(denominatorInput, '');
  if (!hasStoredPulsePref) {
    setPulseAudio(true, { persist: false });
  }
  if (!hasStoredCyclePref) {
    setCycleAudio(true, { persist: false });
  }
  if (audio && typeof audio.resetTapTempo === 'function') {
    audio.resetTapTempo();
  }
  if (tapHelp) {
    tapHelp.textContent = 'Se necesitan 3 clicks';
    tapHelp.style.display = 'none';
  }
  handleInput();
}

/**
 * Llegeix estat guardat (Lg, V, fraccions) i el carrega en la UI.
 *
 * @returns {void}
 * @remarks Es crida una vegada a l'inici. Depèn de `localStorage` i DOM; prepara el context perquè `computeNextZero` pugui re-sync amb valors coherents.
 */
function initDefaults() {
  const storedLg = parseIntSafe(loadOpt('Lg'));
  const storedV = parseFloatSafe(loadOpt('V'));
  const storedN = parseIntSafe(loadOpt('n'));
  const storedD = parseIntSafe(loadOpt('d'));
  const hasStored = (
    (Number.isFinite(storedLg) && storedLg > 0)
    || (Number.isFinite(storedV) && storedV > 0)
    || (Number.isFinite(storedN) && storedN > 0)
    || (Number.isFinite(storedD) && storedD > 0)
  );

  if (!hasStored) {
    applyInitialState();
    return;
  }

  setValue(inputLg, Number.isFinite(storedLg) && storedLg > 0 ? storedLg : '');
  const validV = Number.isFinite(storedV) && storedV > 0 ? Math.round(storedV) : '';
  setValue(inputV, validV);
  setValue(numeratorInput, Number.isFinite(storedN) && storedN > 0 ? storedN : '');
  setValue(denominatorInput, Number.isFinite(storedD) && storedD > 0 ? storedD : '');
  handleInput();
  if (audio && typeof audio.resetTapTempo === 'function') {
    audio.resetTapTempo();
  }
  if (tapHelp) {
    tapHelp.textContent = 'Se necesitan 3 clicks';
    tapHelp.style.display = 'none';
  }
}

initDefaults();

[inputLg, inputV, numeratorInput, denominatorInput].forEach((el, idx) => {
  el.addEventListener('change', () => {
    const keys = ['Lg', 'V', 'n', 'd'];
    const raw = typeof el.value === 'string' ? el.value.trim() : el.value;
    if (raw === '' || raw == null) clearOpt(keys[idx]);
    else saveOpt(keys[idx], raw);
  });
});

window.addEventListener('resize', () => layoutTimeline({ silent: true }));

handleInput();
