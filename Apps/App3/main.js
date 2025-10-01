import { getMixer, subscribeMixer } from '../../libs/sound/index.js';
import { createRhythmAudioInitializer } from '../../libs/app-common/audio-init.js';
import { attachHover } from '../../libs/shared-ui/hover.js';
import { computeNumberFontRem, solidMenuBackground } from './utils.js';
import { initRandomMenu, mergeRandomConfig } from '../../libs/app-common/random-menu.js';
import { createSchedulingBridge, bindSharedSoundEvents } from '../../libs/app-common/audio.js';
import { initAudioToggles } from '../../libs/app-common/audio-toggles.js';
import { initMixerMenu } from '../../libs/app-common/mixer-menu.js';
import { createPreferenceStorage, registerFactoryReset, setupThemeSync, setupMutePersistence } from '../../libs/app-common/preferences.js';
import createFractionEditor from '../../libs/app-common/fraction-editor.js';
import { fromLgAndTempo, gridFromOrigin, computeSubdivisionFontRem, toPlaybackPulseCount } from '../../libs/app-common/subdivision.js';
import { createTimelineRenderer } from '../../libs/app-common/timeline-layout.js';
import { parseIntSafe, parseFloatSafe } from '../../libs/app-common/number.js';
import { applyBaseRandomConfig, updateBaseRandomConfig } from '../../libs/app-common/random-config.js';
import { bindAppRhythmElements } from '../../libs/app-common/dom.js';

let audio;
let pendingMute = null;
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

const preferenceStorage = createPreferenceStorage({ prefix: 'app3', separator: '::' });
const { storeKey, load: loadOpt, save: saveOpt, clear: clearOpt } = preferenceStorage;

registerFactoryReset({
  storage: preferenceStorage,
  onBeforeReload: () => {
    setPulseAudio(true, { persist: false });
    setCycleAudio(true, { persist: false });
  }
});

// Bind all DOM elements using new utilities
// Bind all DOM elements using app-specific utilities (App3 has LEDs, no inputT binding issues)
const { elements } = bindAppRhythmElements('app3');

// Extract commonly used elements for backward compatibility
const { inputLg, inputV, inputT, inputLgUp, inputLgDown, inputVUp, inputVDown,
        unitLg, unitV, formula, timelineWrapper, timeline, playBtn, loopBtn,
        randomBtn, randomMenu, mixerMenu, tapBtn, tapHelp, resetBtn,
        circularTimelineToggle, randLgToggle, randLgMin, randLgMax, randVToggle,
        randVMin, randVMax, randNToggle, randNMin, randNMax, randDToggle,
        randDMin, randDMax, randComplexToggle, baseSoundSelect, startSoundSelect,
        cycleSoundSelect, themeSelect, pulseToggleBtn, cycleToggleBtn } = elements;
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
let fractionEditorController = null;
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
const PULSE_AUDIO_KEY = 'pulseAudio';
const CYCLE_AUDIO_KEY = 'cycleAudio';
let pulseToggleController = null;
let cycleToggleController = null;

const shouldRenderTIndicator = Boolean(document.querySelector('.param.t'));
const tIndicator = shouldRenderTIndicator ? (() => {
  const indicator = document.createElement('div');
  indicator.id = 'tIndicator';
  indicator.style.visibility = 'hidden';
  timeline.appendChild(indicator);
  return indicator;
})() : null;

function initFractionEditorController() {
  if (!formula) return;
  const controller = createFractionEditor({
    mode: 'block',
    host: formula,
    defaults: { numerator: defaults.numerator, denominator: defaults.denominator },
    startEmpty: true,
    storage: {
      load: loadOpt,
      save: saveOpt,
      clear: clearOpt,
      numeratorKey: 'n',
      denominatorKey: 'd'
    },
    addRepeatPress,
    applyMenuBackground: solidMenuBackground,
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
    onChange: ({ cause }) => {
      if (!isUpdating && cause !== 'init') {
        handleInput();
      }
    }
  });

  fractionEditorController = controller || null;
  numeratorInput = controller?.elements?.numerator ?? null;
  denominatorInput = controller?.elements?.denominator ?? null;
}

initFractionEditorController();

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

function setValue(input, value) {
  if (!input) return;
  isUpdating = true;
  const normalized = value == null || Number.isNaN(value) ? '' : String(value);
  input.value = normalized;
  isUpdating = false;
}

/**
 * Prepara i retorna l'única instància `TimelineAudio` utilitzada per App3.
 *
 * @returns {Promise<TimelineAudio>} audio configurat amb les preferències actuals.
 * @remarks Es crida abans de reproduir o quan el menú de sons necessita llistats. Depèn de WebAudio i `bindSharedSoundEvents`; habilita PulseMemory = 1..Lg-1 amb re-sync via `computeNextZero`. Efectes: crea listeners i ajusta estats del mixer global.
 */
// Create standardized audio initializer that avoids AudioContext warnings
const _baseInitAudio = createRhythmAudioInitializer({
  getSoundSelects: () => ({
    baseSoundSelect: elements.baseSoundSelect,
    startSoundSelect: elements.startSoundSelect,
    cycleSoundSelect: elements.cycleSoundSelect
  }),
  schedulingBridge,
  channels: [] // App3 doesn't use accent channel
});

async function initAudio() {
  if (!audio) {
    audio = await _baseInitAudio();

    // Apply App3-specific audio toggles
    if (typeof audio.setPulseEnabled === 'function') {
      const pulseEnabled = pulseToggleController?.isEnabled() ?? true;
      audio.setPulseEnabled(pulseEnabled);
    }
    if (typeof audio.setCycleEnabled === 'function') {
      const cycleEnabled = cycleToggleController?.isEnabled() ?? true;
      audio.setCycleEnabled(cycleEnabled);
    }
    if (pendingMute != null && typeof audio.setMute === 'function') {
      audio.setMute(pendingMute);
    }
    // Expose audio instance for sound dropdown preview
    if (typeof window !== 'undefined') window.__labAudio = audio;
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
  onMixerSnapshot: ({ channels, setFromMixer, getState }) => {
    if (!channels) return;
    const channelPairs = [
      ['pulse', 'pulse'],
      ['cycle', 'subdivision']
    ];
    channelPairs.forEach(([toggleId, channelId]) => {
      const channelState = channels.get(channelId);
      if (!channelState) return;
      const shouldEnable = !channelState.muted;
      if (getState(toggleId) === shouldEnable) return;
      setFromMixer(toggleId, shouldEnable);
    });
  }
});

pulseToggleController = audioToggleManager.get('pulse') ?? null;
cycleToggleController = audioToggleManager.get('cycle') ?? null;

function setPulseAudio(value, options) {
  pulseToggleController?.set(value, options);
}

function setCycleAudio(value, options) {
  cycleToggleController?.set(value, options);
}

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

document.addEventListener('sharedui:mute', (e) => {
  const val = !!(e && e.detail && e.detail.value);
  saveOpt('mute', val ? '1' : '0');
  pendingMute = val;
  if (audio && typeof audio.setMute === 'function') {
    audio.setMute(val);
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
  if (fractionEditorController && typeof fractionEditorController.getFraction === 'function') {
    const raw = fractionEditorController.getFraction();
    const n = Number.isFinite(raw?.numerator) && raw.numerator > 0 ? raw.numerator : null;
    const d = Number.isFinite(raw?.denominator) && raw.denominator > 0 ? raw.denominator : null;
    return { numerator: n, denominator: d };
  }
  const n = parseIntSafe(numeratorInput?.value);
  const d = parseIntSafe(denominatorInput?.value);
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
  tIndicatorTransitionDelay: T_INDICATOR_TRANSITION_DELAY
});

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

function handleInput() {
  if (isUpdating) return;
  const lg = getLg();
  const v = getV();
  const { numerator, denominator } = getFraction();
  if (fractionEditorController && typeof fractionEditorController.refresh === 'function') {
    fractionEditorController.refresh({ reveal: true });
  }

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
    const cycleConfig = hasCycle
      ? { numerator: normalizedNumerator, denominator: normalizedDenominator, onTick: highlightCycle }
      : { numerator: 0, denominator: 0, onTick: null };
    const supportsUnifiedTransport = typeof audio.updateTransport === 'function';

    if (normalizedLg != null && (!supportsUnifiedTransport || !isPlaying)) {
      updateAudioPattern(normalizedLg);
    }

    if (isPlaying) {
      if (supportsUnifiedTransport) {
        const payload = { align: 'nextPulse', cycle: cycleConfig };
        if (playbackTotal != null) payload.totalPulses = playbackTotal;
        if (validV) payload.bpm = v;
        if (normalizedLg != null) payload.patternBeats = normalizedLg;
        audio.updateTransport(payload);
      } else {
        if (playbackTotal != null) updateAudioTotal(playbackTotal);
        if (validV) {
          updateAudioTempo(v, { align: 'nextPulse' });
        }
        applyCycleConfig(cycleConfig);
      }

      syncVisualState();
    } else {
      applyCycleConfig(cycleConfig);
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
    return mergeRandomConfig(randomDefaults, stored ? JSON.parse(stored) : {});
  } catch {
    return mergeRandomConfig(randomDefaults, {});
  }
})();

function applyRandomConfig(cfg) {
  applyBaseRandomConfig(cfg, {
    Lg: { toggle: randLgToggle, min: randLgMin, max: randLgMax },
    V: { toggle: randVToggle, min: randVMin, max: randVMax },
    n: { toggle: randNToggle, min: randNMin, max: randNMax },
    d: { toggle: randDToggle, min: randDMin, max: randDMax },
    allowComplex: randComplexToggle
  });
}

/**
 * Serialitza la configuració actual del menú aleatori i la desa.
 *
 * @returns {void}
 * @remarks Es crida per cada canvi al menú random. Depèn de DOM i `localStorage`; garanteix que els valors generats mantinguin PulseMemory dins 1..Lg-1 (0/Lg derivats es recalculen a `randomize`).
 */
function updateRandomConfig() {
  randomConfig = updateBaseRandomConfig(randomConfig, {
    Lg: { toggle: randLgToggle, min: randLgMin, max: randLgMax },
    V: { toggle: randVToggle, min: randVMin, max: randVMax },
    n: { toggle: randNToggle, min: randNMin, max: randNMax, integer: true, minValue: 1 },
    d: { toggle: randDToggle, min: randDMin, max: randDMax, integer: true, minValue: 1 },
    allowComplex: randComplexToggle
  }, randomDefaults);
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
  const fractionUpdates = {};
  if (cfg.n.enabled) {
    let [min, max] = cfg.n.range;
    if (!cfg.allowComplex) {
      min = 1;
      max = 1;
    }
    fractionUpdates.numerator = Math.max(1, randomInt(min, max));
  }
  if (cfg.d.enabled) {
    const [min, max] = cfg.d.range;
    fractionUpdates.denominator = Math.max(1, randomInt(min, max));
  }
  if (fractionEditorController && Object.keys(fractionUpdates).length > 0) {
    fractionEditorController.setFraction(fractionUpdates, { cause: 'randomize', persist: false, silent: true, reveal: true });
  } else {
    if (fractionUpdates.numerator != null) {
      setValue(numeratorInput, fractionUpdates.numerator);
    }
    if (fractionUpdates.denominator != null) {
      setValue(denominatorInput, fractionUpdates.denominator);
    }
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
  // Sound selection is already applied by initAudio() from dataset.value
  // and by bindSharedSoundEvents from sharedui:sound events
  // No need to override here

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
  pulseToggleController?.markStored(false);
  cycleToggleController?.markStored(false);
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
  sessionStorage.setItem('volumeResetFlag', 'true');
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
 * Sound dropdowns are now initialized by header.js via initHeader().
 * This includes baseSoundSelect, startSoundSelect, and cycleSoundSelect.
 * No need for app-specific initialization anymore.
 *
 * @remarks All sound dropdowns (including cycleSoundSelect) are now managed centrally in header.js.
 */
// Sound dropdowns initialized by header.js - no app-specific setup needed

/**
 * Restaura valors buits i preferències per defecte quan no hi ha estat guardat.
 *
 * @returns {void}
 * @remarks S'executa durant el bootstrap i quan l'usuari fa reset. Depèn de DOM i `localStorage`; sincronitza toggles d'àudio sense alterar PulseMemory.
 */
function applyInitialState() {
  setValue(inputLg, '');
  setValue(inputV, '');
  if (fractionEditorController) {
    fractionEditorController.setFraction({ numerator: null, denominator: null }, {
      cause: 'reset',
      persist: false,
      silent: true,
      reveal: false
    });
  } else {
    setValue(numeratorInput, '');
    setValue(denominatorInput, '');
  }
  if (!pulseToggleController || !pulseToggleController.hasStored()) {
    setPulseAudio(true, { persist: false });
  }
  if (!cycleToggleController || !cycleToggleController.hasStored()) {
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
  if (fractionEditorController) {
    fractionEditorController.setFraction({
      numerator: Number.isFinite(storedN) && storedN > 0 ? storedN : null,
      denominator: Number.isFinite(storedD) && storedD > 0 ? storedD : null
    }, {
      cause: 'restore',
      persist: false,
      silent: true,
      reveal: true
    });
  } else {
    setValue(numeratorInput, Number.isFinite(storedN) && storedN > 0 ? storedN : '');
    setValue(denominatorInput, Number.isFinite(storedD) && storedD > 0 ? storedD : '');
  }
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
  el?.addEventListener('change', () => {
    const keys = ['Lg', 'V', 'n', 'd'];
    const raw = typeof el.value === 'string' ? el.value.trim() : el.value;
    if (raw === '' || raw == null) clearOpt(keys[idx]);
    else saveOpt(keys[idx], raw);
  });
});

window.addEventListener('resize', () => layoutTimeline({ silent: true }));

handleInput();
