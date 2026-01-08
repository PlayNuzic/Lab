// App26: Fracciones Simples
// Timeline horitzontal d'App9 + lògica de fraccions d'App3 simplificada
// Lg=6 fix, BPM=85 fix, numerador=1 fix, denominador editable (1-8)
// Playback one-shot (sense loop)

import { getMixer, subscribeMixer } from '../../libs/sound/index.js';
import { createRhythmAudioInitializer } from '../../libs/app-common/audio-init.js';
import { createSchedulingBridge, bindSharedSoundEvents } from '../../libs/app-common/audio.js';
import { initAudioToggles } from '../../libs/app-common/audio-toggles.js';
import { initMixerMenu } from '../../libs/app-common/mixer-menu.js';
import { createPreferenceStorage, registerFactoryReset, setupThemeSync, setupMutePersistence } from '../../libs/app-common/preferences.js';
import createFractionEditor from '../../libs/app-common/fraction-editor.js';
import { gridFromOrigin, computeSubdivisionFontRem } from '../../libs/app-common/subdivision.js';
import { randomInt } from '../../libs/app-common/number-utils.js';
import { attachHover } from '../../libs/shared-ui/hover.js';

// ========== CONSTANTS ==========
const FIXED_LG = 6;              // 6 pulsos (0-5) + endpoint (6)
const FIXED_BPM = 85;            // BPM fix
const FIXED_NUMERATOR = 1;       // Numerador sempre 1
const DEFAULT_DENOMINATOR = 2;   // Per defecte 1/2
const MIN_DENOMINATOR = 1;
const MAX_DENOMINATOR = 8;

// ========== STATE ==========
let audio = null;
let isPlaying = false;
let currentDenominator = DEFAULT_DENOMINATOR;

// DOM elements
let pulses = [];
let bars = [];
let cycleMarkers = [];
let cycleLabels = [];
let pulseNumberLabels = [];

// Controllers
let fractionEditorController = null;
let pulseToggleController = null;
let cycleToggleController = null;

// Storage keys
const PULSE_AUDIO_KEY = 'pulseAudio';
const CYCLE_AUDIO_KEY = 'cycleAudio';

// ========== PREFERENCE STORAGE ==========
const preferenceStorage = createPreferenceStorage({ prefix: 'app26', separator: '::' });
const { load: loadOpt, save: saveOpt, clear: clearOpt } = preferenceStorage;

registerFactoryReset({
  storage: preferenceStorage,
  onBeforeReload: () => {
    setPulseAudio(true, { persist: false });
    setCycleAudio(true, { persist: false });
  }
});

// ========== SCHEDULING BRIDGE ==========
const schedulingBridge = createSchedulingBridge({ getAudio: () => audio });
window.addEventListener('sharedui:scheduling', schedulingBridge.handleSchedulingEvent);

// ========== SOUND EVENTS ==========
bindSharedSoundEvents({
  getAudio: () => audio,
  mapping: {
    baseSound: 'setBase',
    startSound: 'setStart',
    cycleSound: 'setCycle'
  }
});

// ========== DOM ELEMENTS ==========
const timeline = document.getElementById('timeline');
const timelineWrapper = document.getElementById('timelineWrapper');
const playBtn = document.getElementById('playBtn');
const randomBtn = document.getElementById('randomBtn');
const resetBtn = document.getElementById('resetBtn');
const themeSelect = document.getElementById('themeSelect');
const pulseToggleBtn = document.getElementById('pulseToggleBtn');
const cycleToggleBtn = document.getElementById('cycleToggleBtn');
const mixerMenu = document.getElementById('mixerMenu');
const baseSoundSelect = document.getElementById('baseSoundSelect');
const startSoundSelect = document.getElementById('startSoundSelect');
const cycleSoundSelect = document.getElementById('cycleSoundSelect');
const formula = document.querySelector('.middle');

// ========== MIXER SETUP ==========
const globalMixer = getMixer();
if (globalMixer) {
  globalMixer.registerChannel('pulse', { allowSolo: true, label: 'Pulso' });
  globalMixer.registerChannel('subdivision', { allowSolo: true, label: 'Subdivisión' });
}

// ========== HOVER TOOLTIPS ==========
if (playBtn) attachHover(playBtn, { text: 'Play / Stop' });
if (randomBtn) attachHover(randomBtn, { text: 'Aleatorizar denominador' });
if (resetBtn) attachHover(resetBtn, { text: 'Reset App' });
if (pulseToggleBtn) attachHover(pulseToggleBtn, { text: 'Activar o silenciar el pulso' });
if (cycleToggleBtn) attachHover(cycleToggleBtn, { text: 'Activar o silenciar el ciclo' });

// ========== AUDIO TOGGLES ==========
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

// ========== MIXER MENU ==========
const mixerTriggers = [playBtn].filter(Boolean);

initMixerMenu({
  menu: mixerMenu,
  triggers: mixerTriggers,
  channels: [
    { id: 'pulse', label: 'Pulso', allowSolo: true },
    { id: 'subdivision', label: 'Subdivisión', allowSolo: true },
    { id: 'master', label: 'Master', allowSolo: false, isMaster: true }
  ]
});

// ========== THEME & MUTE PERSISTENCE ==========
const muteButton = document.getElementById('muteBtn');
setupThemeSync({ storage: preferenceStorage, selectEl: themeSelect });
setupMutePersistence({
  storage: preferenceStorage,
  getAudioInstance: () => audio,
  muteButton
});

// ========== AUDIO INITIALIZATION ==========
const _baseInitAudio = createRhythmAudioInitializer({
  getSoundSelects: () => ({
    baseSoundSelect,
    startSoundSelect,
    cycleSoundSelect
  }),
  schedulingBridge,
  channels: []
});

async function initAudio() {
  if (!audio) {
    audio = await _baseInitAudio();

    // Apply audio toggles
    if (typeof audio.setPulseEnabled === 'function') {
      const pulseEnabled = pulseToggleController?.isEnabled() ?? true;
      audio.setPulseEnabled(pulseEnabled);
    }
    if (typeof audio.setCycleEnabled === 'function') {
      const cycleEnabled = cycleToggleController?.isEnabled() ?? true;
      audio.setCycleEnabled(cycleEnabled);
    }

    // Apply saved mute state
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

// ========== FRACTION EDITOR ==========
function initFractionEditorController() {
  if (!formula) return;

  // Load saved denominator
  const savedD = loadOpt('d');
  const initialD = savedD ? parseInt(savedD, 10) : DEFAULT_DENOMINATOR;
  currentDenominator = Number.isFinite(initialD) && initialD >= MIN_DENOMINATOR && initialD <= MAX_DENOMINATOR
    ? initialD
    : DEFAULT_DENOMINATOR;

  const controller = createFractionEditor({
    mode: 'block',
    host: formula,
    defaults: { numerator: FIXED_NUMERATOR, denominator: currentDenominator },
    startEmpty: false,
    storage: {
      load: loadOpt,
      save: saveOpt,
      clear: clearOpt,
      numeratorKey: 'n',
      denominatorKey: 'd'
    },
    addRepeatPress,
    labels: {
      numerator: {
        placeholder: '1',
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
      if (cause !== 'init') {
        handleFractionChange();
      }
    }
  });

  fractionEditorController = controller || null;

  // Set simple mode (numerator fixed at 1)
  if (fractionEditorController && typeof fractionEditorController.setSimpleMode === 'function') {
    fractionEditorController.setSimpleMode();
  }

  // Set denominator range
  if (fractionEditorController && typeof fractionEditorController.setDenominatorRange === 'function') {
    fractionEditorController.setDenominatorRange(MIN_DENOMINATOR, MAX_DENOMINATOR);
  }
}

function handleFractionChange() {
  if (!fractionEditorController) return;

  const fraction = fractionEditorController.getFraction();
  let newD = fraction?.denominator;

  // Validate denominator range
  if (!Number.isFinite(newD) || newD < MIN_DENOMINATOR) {
    newD = MIN_DENOMINATOR;
  } else if (newD > MAX_DENOMINATOR) {
    newD = MAX_DENOMINATOR;
  }

  currentDenominator = newD;

  // Redraw timeline with new subdivisions
  renderTimeline();

  // Update audio cycle config if playing
  if (audio && isPlaying) {
    applyCycleConfig();
  }
}

function setDenominator(d) {
  const clamped = Math.max(MIN_DENOMINATOR, Math.min(MAX_DENOMINATOR, d));
  currentDenominator = clamped;

  if (fractionEditorController && typeof fractionEditorController.setFraction === 'function') {
    fractionEditorController.setFraction(
      { numerator: FIXED_NUMERATOR, denominator: clamped },
      { cause: 'external', persist: true, silent: false, reveal: true }
    );
  }

  renderTimeline();
}

// ========== REPEAT PRESS HELPER ==========
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

// ========== TIMELINE RENDERING ==========
function renderTimeline() {
  if (!timeline) return;

  // Disable transitions during render
  timeline.classList.add('no-anim');

  // Clear previous elements
  pulses = [];
  bars = [];
  cycleMarkers = [];
  cycleLabels = [];
  pulseNumberLabels = [];
  timeline.innerHTML = '';

  const lg = FIXED_LG;
  const numerator = FIXED_NUMERATOR;
  const denominator = currentDenominator;

  // Create pulses (0 to lg inclusive for endpoint)
  for (let i = 0; i <= lg; i++) {
    const pulse = document.createElement('div');
    pulse.className = 'pulse';
    pulse.dataset.index = i;
    if (i === 0 || i === lg) pulse.classList.add('endpoint');
    timeline.appendChild(pulse);
    pulses.push(pulse);

    // Create bars at endpoints
    if (i === 0 || i === lg) {
      const bar = document.createElement('div');
      bar.className = 'bar';
      timeline.appendChild(bar);
      bars.push(bar);
    }
  }

  // Create pulse numbers
  for (let i = 0; i <= lg; i++) {
    const num = document.createElement('div');
    num.className = 'pulse-number';
    if (i === 0 || i === lg) num.classList.add('endpoint');
    num.dataset.index = i;
    num.textContent = i;
    timeline.appendChild(num);
    pulseNumberLabels.push(num);
  }

  // Calculate cycle markers using gridFromOrigin
  const grid = gridFromOrigin({ lg, numerator, denominator });
  const subdivisionFontRem = computeSubdivisionFontRem(lg);

  if (grid.cycles > 0 && grid.subdivisions.length) {
    const labelFormatter = (cycleIndex, subdivision) => {
      const base = cycleIndex * numerator;
      return subdivision === 0 ? String(base) : `.${subdivision}`;
    };

    grid.subdivisions.forEach(({ cycleIndex, subdivisionIndex, position }) => {
      // Create marker
      const marker = document.createElement('div');
      marker.className = 'cycle-marker';
      if (subdivisionIndex === 0) marker.classList.add('start');
      marker.dataset.cycleIndex = String(cycleIndex);
      marker.dataset.subdivision = String(subdivisionIndex);
      marker.dataset.position = String(position);
      timeline.appendChild(marker);
      cycleMarkers.push(marker);

      // Create label
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

  // Layout elements
  layoutTimeline();

  // Re-enable transitions
  requestAnimationFrame(() => {
    timeline.classList.remove('no-anim');
  });
}

function layoutTimeline() {
  const lg = FIXED_LG;

  // Position pulses linearly
  pulses.forEach((p, i) => {
    const pct = (i / lg) * 100;
    p.style.left = pct + '%';
    p.style.top = '50%';
    p.style.transform = 'translate(-50%, -50%)';
  });

  // Position bars at endpoints
  bars.forEach((bar, idx) => {
    const i = idx === 0 ? 0 : lg;
    const pct = (i / lg) * 100;
    bar.style.left = pct + '%';
    bar.style.top = '30%';
    bar.style.height = '40%';
    bar.style.transform = 'translateX(-50%)';
  });

  // Position pulse numbers
  pulseNumberLabels.forEach((num) => {
    const idx = parseInt(num.dataset.index, 10);
    const pct = (idx / lg) * 100;
    num.style.left = pct + '%';
    num.style.top = '-10px';
    num.style.transform = 'translate(-50%, -100%)';
  });

  // Position cycle markers and labels
  cycleMarkers.forEach((marker) => {
    const pos = parseFloat(marker.dataset.position);
    const pct = (pos / lg) * 100;
    marker.style.left = pct + '%';
    marker.style.top = '50%';
  });

  cycleLabels.forEach((label) => {
    const pos = parseFloat(label.dataset.position);
    const pct = (pos / lg) * 100;
    label.style.left = pct + '%';
    label.style.top = '75%';
  });
}

// ========== HIGHLIGHTING ==========
function clearHighlights() {
  pulses.forEach(p => p.classList.remove('active'));
  cycleMarkers.forEach(m => m.classList.remove('active'));
  cycleLabels.forEach(l => l.classList.remove('active'));
}

function highlightPulse(index) {
  if (!isPlaying) return;

  pulses.forEach(p => p.classList.remove('active'));
  const total = pulses.length > 1 ? pulses.length - 1 : 0;
  if (total <= 0) return;

  const raw = Number.isFinite(index) ? index : 0;
  const normalized = Math.max(0, Math.min(raw, total));
  const pulse = pulses[normalized];
  if (pulse) {
    void pulse.offsetWidth;
    pulse.classList.add('active');
  }
}

function highlightCycle(payload = {}) {
  if (!isPlaying) return;

  const { cycleIndex: rawCycleIndex, subdivisionIndex: rawSubdivisionIndex } = payload;
  const cycleIndex = Number(rawCycleIndex);
  const subdivisionIndex = Number(rawSubdivisionIndex);

  if (!Number.isFinite(cycleIndex) || !Number.isFinite(subdivisionIndex)) return;

  // Clear previous highlights
  cycleMarkers.forEach(m => m.classList.remove('active'));
  cycleLabels.forEach(l => l.classList.remove('active'));

  // Find and highlight matching marker/label
  const marker = cycleMarkers.find(m =>
    Number(m.dataset.cycleIndex) === cycleIndex &&
    Number(m.dataset.subdivision) === subdivisionIndex
  );
  const label = cycleLabels.find(l =>
    Number(l.dataset.cycleIndex) === cycleIndex &&
    Number(l.dataset.subdivision) === subdivisionIndex
  );

  if (marker) {
    void marker.offsetWidth;
    marker.classList.add('active');
  }
  if (label) {
    label.classList.add('active');
  }
}

// ========== AUDIO CYCLE CONFIG ==========
function applyCycleConfig() {
  if (!audio) return;

  const hasCycle = currentDenominator > 0 && Math.floor(FIXED_LG / FIXED_NUMERATOR) > 0;

  if (typeof audio.updateCycleConfig === 'function') {
    audio.updateCycleConfig({
      numerator: hasCycle ? FIXED_NUMERATOR : 0,
      denominator: hasCycle ? currentDenominator : 0,
      onTick: hasCycle ? highlightCycle : null
    });
  }
}

// ========== PLAYBACK ==========
async function startPlayback() {
  const lg = FIXED_LG;
  const bpm = FIXED_BPM;
  const interval = 60 / bpm;
  const playbackTotal = lg + 1; // One-shot: play lg+1 pulses (0 to lg inclusive)

  const audioInstance = await initAudio();

  const hasCycle = currentDenominator > 0 && Math.floor(lg / FIXED_NUMERATOR) > 0;

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

  audioInstance.play(
    playbackTotal,
    interval,
    new Set(),       // No selection
    false,           // Loop DISABLED (one-shot)
    highlightPulse,
    onFinish,
    hasCycle
      ? { cycle: { numerator: FIXED_NUMERATOR, denominator: currentDenominator, onTick: highlightCycle }, patternBeats: lg }
      : { patternBeats: lg }
  );

  isPlaying = true;
  playBtn.classList.add('active');

  const iconPlay = playBtn.querySelector('.icon-play');
  const iconStop = playBtn.querySelector('.icon-stop');
  if (iconPlay && iconStop) {
    iconPlay.style.display = 'none';
    iconStop.style.display = 'block';
  }
}

async function stopPlayback() {
  if (!audio) return;

  audio.stop();
  isPlaying = false;
  playBtn.classList.remove('active');

  const iconPlay = playBtn.querySelector('.icon-play');
  const iconStop = playBtn.querySelector('.icon-stop');
  if (iconPlay && iconStop) {
    iconPlay.style.display = 'block';
    iconStop.style.display = 'none';
  }

  clearHighlights();
}

// ========== RANDOM & RESET ==========
function randomize() {
  // Random denominator between 2 and MAX_DENOMINATOR
  const newD = randomInt(2, MAX_DENOMINATOR);
  setDenominator(newD);
}

function handleReset() {
  // Clear storage
  clearOpt('d');
  clearOpt('n');
  sessionStorage.setItem('volumeResetFlag', 'true');
  window.location.reload();
}

// ========== EVENT LISTENERS ==========
playBtn?.addEventListener('click', async () => {
  if (isPlaying) {
    await stopPlayback();
  } else {
    clearHighlights();
    await startPlayback();
  }
});

randomBtn?.addEventListener('click', randomize);
resetBtn?.addEventListener('click', handleReset);

// ========== INITIALIZATION ==========
function init() {
  // Initialize fraction editor
  initFractionEditorController();

  // Render timeline
  renderTimeline();
}

// Run init when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
