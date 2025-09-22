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

const APP_STORAGE_PREFIX = 'app4';
const STORE_KEY = (key) => `${APP_STORAGE_PREFIX}::${key}`;

let audio = null;
let mixerSyncGuard = false;

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

const state = {
  isPlaying: false,
  audioReady: false
};

const selectors = {
  playBtn: () => document.getElementById('playBtn'),
  baseSoundSelect: () => document.getElementById('baseSoundSelect'),
  selectedSoundSelect: () => document.getElementById('accentSoundSelect'),
  startSoundSelect: () => document.getElementById('startSoundSelect'),
  mixerMenu: () => document.getElementById('mixerMenu'),
  inputLg: () => document.getElementById('inputLg'),
  inputLgUp: () => document.getElementById('inputLgUp'),
  inputLgDown: () => document.getElementById('inputLgDown'),
  inputV: () => document.getElementById('inputV'),
  inputVUp: () => document.getElementById('inputVUp'),
  inputVDown: () => document.getElementById('inputVDown'),
  fractionParam: () => document.getElementById('fractionParam'),
  numeratorInput: () => document.getElementById('fractionNumerator'),
  numeratorUp: () => document.getElementById('fractionNumeratorUp'),
  numeratorDown: () => document.getElementById('fractionNumeratorDown'),
  denominatorInput: () => document.getElementById('fractionDenominator'),
  denominatorUp: () => document.getElementById('fractionDenominatorUp'),
  denominatorDown: () => document.getElementById('fractionDenominatorDown')
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

function renderFractionControls() {
  const inputs = document.querySelector('.inputs');
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

function sanitizeDigits(value) {
  return value.replace(/[^0-9]/g, '');
}

function bindPositiveIntegerInput(input) {
  if (!input || input.dataset.app4IntBound === '1') return;
  input.addEventListener('input', () => {
    const digits = sanitizeDigits(input.value);
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

  const inputLg = selectors.inputLg();
  const inputV = selectors.inputV();
  const numerator = selectors.numeratorInput();
  const denominator = selectors.denominatorInput();

  [inputLg, inputV, numerator, denominator].forEach(bindPositiveIntegerInput);

  bindSpinnerButtons({
    input: inputLg,
    up: selectors.inputLgUp(),
    down: selectors.inputLgDown()
  });
  bindSpinnerButtons({
    input: inputV,
    up: selectors.inputVUp(),
    down: selectors.inputVDown()
  });
  bindSpinnerButtons({
    input: numerator,
    up: selectors.numeratorUp(),
    down: selectors.numeratorDown()
  });
  bindSpinnerButtons({
    input: denominator,
    up: selectors.denominatorUp(),
    down: selectors.denominatorDown()
  });
}

function createPlaceholder() {
  const middleSection = document.querySelector('.middle');
  if (!middleSection) return null;
  const container = document.createElement('div');
  container.className = 'app4-placeholder';
  const title = document.createElement('h2');
  title.textContent = 'Pulsos Fraccionados';
  const message = document.createElement('p');
  message.textContent = 'La interfaz interactiva estará disponible en los siguientes pasos.';
  const status = document.createElement('p');
  status.className = 'app4-placeholder__status';
  status.textContent = 'Detenido';
  container.append(title, message, status);
  middleSection.appendChild(container);
  return container;
}

function updatePlaceholder(placeholder) {
  if (!placeholder) return;
  const status = placeholder.querySelector('.app4-placeholder__status');
  if (!status) return;
  status.textContent = state.isPlaying ? 'Reproduciendo (placeholder)' : 'Detenido';
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
  audio.mixer?.registerChannel('pulse', { allowSolo: true, label: 'Pulso/Pulso 0' });
  audio.mixer?.registerChannel('accent', { allowSolo: true, label: 'Seleccionados' });
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
  return audio;
}

async function handlePlayClick(placeholder) {
  try {
    await initAudio();
    state.isPlaying = !state.isPlaying;
    updatePlaceholder(placeholder);
  } catch (error) {
    console.error('No se pudo inicializar el audio de App4', error);
  }
}

function wirePlayButton(placeholder) {
  const playBtn = selectors.playBtn();
  if (!playBtn) return;
  playBtn.addEventListener('click', () => handlePlayClick(placeholder));
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

function syncSelectedChannel() {
  subscribeMixer((snapshot) => {
    if (!snapshot || mixerSyncGuard) return;
    const channels = Array.isArray(snapshot.channels) ? snapshot.channels : [];
    const selected = channels.find((ch) => ch.id === 'selected');
    if (!selected) return;
    const accent = channels.find((ch) => ch.id === 'accent');
    mixerSyncGuard = true;
    try {
      if (!accent || Math.abs((accent.volume ?? 1) - (selected.volume ?? 1)) > 0.0001) {
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

function init() {
  document.body.dataset.appId = APP_STORAGE_PREFIX;
  const placeholder = createPlaceholder();
  wirePlayButton(placeholder);
  initSoundMenus();
  initMixerMenuForApp();
  syncSelectedChannel();
  setupParameterInputs();
}

window.addEventListener('DOMContentLoaded', init);
