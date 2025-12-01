/**
 * App16 - Módulo Temporal - Compás
 *
 * Enseña el concepto de aritmética modular en música.
 * Timeline de 13 pulsos con numeración cíclica basada en el valor de Compás.
 */

import { createRhythmAudioInitializer } from '../../libs/app-common/audio-init.js';
import { createSchedulingBridge, bindSharedSoundEvents } from '../../libs/app-common/audio.js';
import { createCircularTimeline } from '../../libs/app-common/circular-timeline.js';
import { initMixerMenu } from '../../libs/app-common/mixer-menu.js';
import { initRandomMenu } from '../../libs/random/index.js';
import { createPreferenceStorage, registerFactoryReset } from '../../libs/app-common/preferences.js';
import { initAudioToggles } from '../../libs/app-common/audio-toggles.js';
import { getMixer, subscribeMixer, setChannelVolume, setChannelMute, setVolume, setMute } from '../../libs/sound/index.js';

// ============================================
// CONSTANTS
// ============================================

const TOTAL_PULSES = 13;      // 0-12 (12 = end marker, no suena)
const PLAYABLE_PULSES = 12;   // Solo 0-11 suenan
const DEFAULT_COMPAS = 4;
const BPM = 100;              // Fijo, oculto al usuario

// ============================================
// STATE
// ============================================

let audio = null;
let isPlaying = false;
let compas = DEFAULT_COMPAS;
let currentCycle = 1;
let pulses = [];              // DOM pulse elements
let currentStep = -1;

// ============================================
// DOM ELEMENTS
// ============================================

let inputCompas;
let compasUpBtn;
let compasDownBtn;
let cycleDigit;
let timeline;
let timelineWrapper;
let playBtn;
let resetBtn;
let randomBtn;
let randomMenu;

// ============================================
// STORAGE
// ============================================

const preferenceStorage = createPreferenceStorage({ prefix: 'app16', separator: '-' });
const MIXER_STORAGE_KEY = 'app16-mixer';
const MIXER_CHANNELS = ['start', 'pulse'];

// ============================================
// AUDIO SETUP
// ============================================

const schedulingBridge = createSchedulingBridge({ getAudio: () => audio });
window.addEventListener('sharedui:scheduling', schedulingBridge.handleSchedulingEvent);

bindSharedSoundEvents({
  getAudio: () => audio,
  mapping: {
    baseSound: 'setBase',
    startSound: 'setStart'
  }
});

const _baseInitAudio = createRhythmAudioInitializer({
  getSoundSelects: () => ({
    baseSoundSelect: document.querySelector('[data-sound-type="base"]'),
    startSoundSelect: document.querySelector('[data-sound-type="start"]')
  }),
  schedulingBridge,
  channels: [
    { id: 'start', options: { allowSolo: true, label: 'P1' }, assignment: 'start' }
  ]
});

async function initAudio() {
  if (!audio) {
    audio = await _baseInitAudio();
    if (typeof window !== 'undefined') window.__labAudio = audio;
  }
  return audio;
}

if (typeof window !== 'undefined') {
  window.__labInitAudio = initAudio;
}

// ============================================
// MIXER STATE PERSISTENCE
// ============================================

function loadMixerState() {
  try {
    const saved = localStorage.getItem(MIXER_STORAGE_KEY);
    if (!saved) return;
    const state = JSON.parse(saved);

    if (state.master) {
      if (typeof state.master.volume === 'number') setVolume(state.master.volume);
      if (typeof state.master.muted === 'boolean') setMute(state.master.muted);
    }

    if (state.channels) {
      MIXER_CHANNELS.forEach(id => {
        const ch = state.channels[id];
        if (ch) {
          if (typeof ch.volume === 'number') setChannelVolume(id, ch.volume);
          if (typeof ch.muted === 'boolean') setChannelMute(id, ch.muted);
        }
      });
    }
  } catch (e) {
    console.warn('Error loading mixer state:', e);
  }
}

let mixerSaveTimeout = null;
subscribeMixer((snapshot) => {
  if (mixerSaveTimeout) clearTimeout(mixerSaveTimeout);
  mixerSaveTimeout = setTimeout(() => {
    const state = {
      master: {
        volume: snapshot.master.volume,
        muted: snapshot.master.muted
      },
      channels: {}
    };
    snapshot.channels.forEach(ch => {
      if (MIXER_CHANNELS.includes(ch.id)) {
        state.channels[ch.id] = {
          volume: ch.volume,
          muted: ch.muted
        };
      }
    });
    localStorage.setItem(MIXER_STORAGE_KEY, JSON.stringify(state));
  }, 100);
});

// ============================================
// TIMELINE CONTROLLER
// ============================================

let timelineController;

/**
 * Custom pulse number creator for modular numbering
 */
function createModularPulseNumber(index, fontRem, context) {
  // Pulse 12 (end marker) doesn't get a number
  if (index >= PLAYABLE_PULSES) return null;

  const label = document.createElement('div');
  label.className = 'pulse-number';
  label.dataset.index = String(index);

  const modValue = index % compas;
  const cycleIndex = Math.floor(index / compas) + 1;

  if (modValue === 0) {
    // Cycle start: show superscript with cycle number
    label.innerHTML = `0<sup>${cycleIndex}</sup>`;
    label.classList.add('cycle-start');
  } else {
    label.textContent = String(modValue);
  }

  label.style.fontSize = `${fontRem}rem`;
  return label;
}

function renderTimeline() {
  if (!timelineController) return;

  // Use the timeline controller to render pulses
  // The controller returns the array of pulse DOM elements
  pulses = timelineController.render(TOTAL_PULSES - 1, {
    isCircular: false,
    silent: true
  });

  // Re-render numbers with our custom modular format
  renderPulseNumbers();
}

function renderPulseNumbers() {
  if (!timeline) return;

  // Remove existing numbers
  timeline.querySelectorAll('.pulse-number').forEach(n => n.remove());

  const lg = TOTAL_PULSES - 1; // 12

  // Create numbers only for pulses 0-11 (not 12)
  for (let i = 0; i < PLAYABLE_PULSES; i++) {
    const label = createModularPulseNumber(i, 1.2, { lg });
    if (label) {
      // Position linearly
      const percent = (i / lg) * 100;
      label.style.left = percent + '%';
      timeline.appendChild(label);
    }
  }
}

// ============================================
// CYCLE COUNTER
// ============================================

function updateCycleCounter(newCycle) {
  if (!cycleDigit) return;
  if (newCycle === currentCycle && cycleDigit.textContent === String(newCycle)) return;

  currentCycle = newCycle;

  // Flip animation
  cycleDigit.classList.add('flip-out');

  setTimeout(() => {
    cycleDigit.textContent = String(newCycle);
    cycleDigit.classList.remove('flip-out');
    cycleDigit.classList.add('flip-in');

    setTimeout(() => {
      cycleDigit.classList.remove('flip-in');
    }, 150);
  }, 150);
}

// ============================================
// HIGHLIGHTING
// ============================================

function highlightPulse(step) {
  // Clear previous highlights
  pulses.forEach(p => p.classList.remove('active', 'active-zero'));

  // Add highlight to current pulse
  if (pulses[step]) {
    const modValue = step % compas;
    if (modValue === 0) {
      pulses[step].classList.add('active-zero');
    } else {
      pulses[step].classList.add('active');
    }
  }
}

function highlightNumber(step) {
  // Clear previous highlights
  document.querySelectorAll('.pulse-number').forEach(n => {
    n.classList.remove('active', 'active-zero');
  });

  // Add highlight to current number
  const numberEl = document.querySelector(`.pulse-number[data-index="${step}"]`);
  if (numberEl) {
    const modValue = step % compas;
    if (modValue === 0) {
      numberEl.classList.add('active-zero');
    } else {
      numberEl.classList.add('active');
    }
  }
}

function clearHighlights() {
  pulses.forEach(p => p.classList.remove('active', 'active-zero'));
  document.querySelectorAll('.pulse-number').forEach(n => {
    n.classList.remove('active', 'active-zero');
  });
}

// ============================================
// PLAYBACK
// ============================================

async function handlePlay() {
  if (isPlaying) {
    stopPlayback();
    return;
  }

  const audioInstance = await initAudio();
  if (!audioInstance) return;

  isPlaying = true;
  currentCycle = 1;
  currentStep = -1;
  updateCycleCounter(1);

  // Update play button state
  playBtn?.classList.add('active');
  const iconPlay = playBtn?.querySelector('.icon-play');
  const iconStop = playBtn?.querySelector('.icon-stop');
  if (iconPlay) iconPlay.style.display = 'none';
  if (iconStop) iconStop.style.display = 'block';

  const intervalSec = 60 / BPM;

  // Determine which pulses are cycle starts (for P1/start sound)
  const cycleStarts = new Set();
  for (let i = 0; i < PLAYABLE_PULSES; i++) {
    if (i % compas === 0) cycleStarts.add(i);
  }

  audioInstance.play(
    PLAYABLE_PULSES,
    intervalSec,
    cycleStarts,  // P1/start sound plays on these
    false,        // NO loop (single-shot)
    (step) => {
      currentStep = step;
      highlightPulse(step);
      highlightNumber(step);

      // Update cycle counter when hitting a new cycle start (except first)
      if (step > 0 && step % compas === 0) {
        const newCycle = Math.floor(step / compas) + 1;
        updateCycleCounter(newCycle);
      }
    },
    () => {
      // onComplete callback
      stopPlayback();
    }
  );
}

function stopPlayback() {
  isPlaying = false;
  currentStep = -1;
  audio?.stop();

  // Update play button state
  playBtn?.classList.remove('active');
  const iconPlay = playBtn?.querySelector('.icon-play');
  const iconStop = playBtn?.querySelector('.icon-stop');
  if (iconPlay) iconPlay.style.display = 'block';
  if (iconStop) iconStop.style.display = 'none';

  clearHighlights();
}

// ============================================
// COMPÁS INPUT HANDLING
// ============================================

function handleCompasChange(newValue) {
  const parsed = parseInt(newValue, 10);
  if (isNaN(parsed)) return;

  // Clamp to valid range
  compas = Math.max(2, Math.min(12, parsed));
  if (inputCompas) inputCompas.value = compas;

  // Re-render numbers with new compás
  renderPulseNumbers();

  // Reset cycle counter
  updateCycleCounter(1);

  // Save state
  saveState();
}

function incrementCompas() {
  if (compas < 12) {
    handleCompasChange(compas + 1);
  }
}

function decrementCompas() {
  if (compas > 2) {
    handleCompasChange(compas - 1);
  }
}

// Long-press auto-repeat for spinner buttons
function addRepeatPress(el, fn) {
  if (!el) return;
  let t = null, r = null;
  const start = (ev) => {
    fn();
    t = setTimeout(() => { r = setInterval(fn, 80); }, 320);
    ev.preventDefault();
  };
  const stop = () => { clearTimeout(t); clearInterval(r); t = r = null; };
  el.addEventListener('mousedown', start);
  el.addEventListener('touchstart', start, { passive: false });
  ['mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach(ev => el.addEventListener(ev, stop));
  document.addEventListener('mouseup', stop);
  document.addEventListener('touchend', stop);
}

// ============================================
// RANDOM
// ============================================

function handleRandom() {
  const maxCompas = parseInt(document.getElementById('randCompasMax')?.value || '12', 10);
  const min = 2;
  const max = Math.min(Math.max(maxCompas, 2), 12);
  const newCompas = Math.floor(Math.random() * (max - min + 1)) + min;

  handleCompasChange(newCompas);
}

// ============================================
// RESET
// ============================================

function handleReset() {
  stopPlayback();
  compas = DEFAULT_COMPAS;
  if (inputCompas) inputCompas.value = DEFAULT_COMPAS;
  renderPulseNumbers();
  updateCycleCounter(1);
  saveState();
}

// ============================================
// STATE PERSISTENCE
// ============================================

function saveState() {
  preferenceStorage.save({
    compas,
    randCompasMax: parseInt(document.getElementById('randCompasMax')?.value || '12', 10)
  });
}

function loadState() {
  const prefs = preferenceStorage.load();
  if (prefs?.compas) {
    compas = Math.max(2, Math.min(12, prefs.compas));
    if (inputCompas) inputCompas.value = compas;
  }
  if (prefs?.randCompasMax) {
    const randInput = document.getElementById('randCompasMax');
    if (randInput) randInput.value = prefs.randCompasMax;
  }
}

// ============================================
// INITIALIZATION
// ============================================

async function initializeApp() {
  // Get DOM references
  inputCompas = document.getElementById('inputCompas');
  compasUpBtn = document.getElementById('compasUp');
  compasDownBtn = document.getElementById('compasDown');
  cycleDigit = document.getElementById('cycleDigit');
  timeline = document.getElementById('timeline');
  timelineWrapper = document.getElementById('timelineWrapper');
  playBtn = document.getElementById('playBtn');
  resetBtn = document.getElementById('resetBtn');
  randomBtn = document.getElementById('randomBtn');
  randomMenu = document.getElementById('randomMenu');

  // Create timeline controller
  timelineController = createCircularTimeline({
    timeline,
    timelineWrapper,
    getPulses: () => pulses,
    getNumberFontSize: () => 1.2
  });

  // Load saved state
  loadState();

  // Render initial timeline
  renderTimeline();

  // Compás input events
  inputCompas?.addEventListener('input', (e) => {
    handleCompasChange(e.target.value);
  });

  inputCompas?.addEventListener('blur', () => {
    handleCompasChange(inputCompas.value);
  });

  // Spinner buttons with auto-repeat
  addRepeatPress(compasUpBtn, incrementCompas);
  addRepeatPress(compasDownBtn, decrementCompas);

  // Play button
  playBtn?.addEventListener('click', handlePlay);

  // Reset button
  resetBtn?.addEventListener('click', handleReset);

  // Random menu
  if (randomBtn && randomMenu) {
    initRandomMenu(randomBtn, randomMenu, handleRandom);
  }

  // Initialize mixer
  const mixerMenu = document.getElementById('mixerMenu');
  if (mixerMenu && playBtn) {
    initMixerMenu({
      menu: mixerMenu,
      triggers: [playBtn].filter(Boolean),
      channels: [
        { id: 'start', label: 'P1', allowSolo: true },
        { id: 'pulse', label: 'Pulso', allowSolo: true },
        { id: 'master', label: 'Master', allowSolo: false, isMaster: true }
      ]
    });
  }

  // Load mixer state after a short delay
  setTimeout(loadMixerState, 50);

  // Initialize audio toggles for Pulse
  const pulseToggle = document.getElementById('pulseToggleBtn');
  if (pulseToggle) {
    initAudioToggles({
      toggles: [
        {
          id: 'pulse',
          button: pulseToggle,
          storageKey: 'app16:pulseAudio',
          mixerChannel: 'pulse',
          defaultEnabled: true,
          onChange: (enabled) => {
            if (audio?.setPulseEnabled) {
              audio.setPulseEnabled(enabled);
            }
          }
        }
      ],
      mixer: getMixer(),
      subscribeMixer
    });
  }

  // Register factory reset
  registerFactoryReset({
    storage: preferenceStorage,
    onBeforeReload: () => {
      stopPlayback();
      localStorage.removeItem('app16:p1Toggle');
      localStorage.removeItem('app16:pulseAudio');
      localStorage.removeItem(MIXER_STORAGE_KEY);
    }
  });

  // Listen for randCompasMax changes to save
  const randCompasMaxInput = document.getElementById('randCompasMax');
  randCompasMaxInput?.addEventListener('change', saveState);
}

// Start initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
