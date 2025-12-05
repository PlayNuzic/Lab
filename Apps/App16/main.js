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
import { showValidationWarning } from '../../libs/app-common/info-tooltip.js';
import { subscribeMixer, setChannelVolume, setChannelMute, setVolume, setMute } from '../../libs/sound/index.js';
import { createTapTempoHandler } from '../../libs/app-common/tap-tempo-handler.js';
import { attachSpinnerRepeat } from '../../libs/app-common/spinner-repeat.js';
import { createCycleSuperscript } from '../../libs/app-common/cycle-superscript.js';
import { createBpmController } from '../../libs/app-common/bpm-controller.js';

// ============================================
// CONSTANTS
// ============================================

const TOTAL_PULSES = 13;      // 0-12 (12 = end marker, no suena)
const PLAYABLE_PULSES = 12;   // Solo 0-11 suenan
const DEFAULT_COMPAS = 4;
const DEFAULT_BPM = 100;
const MIN_BPM = 30;
const MAX_BPM = 300;

// ============================================
// STATE
// ============================================

let audio = null;
let isPlaying = false;
let compas = null;            // Starts as null (empty input)
let currentCycle = 1;
let pulses = [];              // DOM pulse elements
let currentStep = -1;
let p0Enabled = true;         // P0 toggle state (not persisted between sessions)
let cycleHighlightTimeout = null;  // For auto-dimming cycle circle
let cycleHighlightEnabled = true; // Cycle highlight toggle state
let bpm = DEFAULT_BPM;        // Current BPM value
let showBpmEnabled = false;   // BPM visibility toggle state (not persisted)

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
let inputBpm;
let bpmUpBtn;
let bpmDownBtn;
let bpmParam;
let tapTempoBtn;
let tapHelp;
let showBpmToggle;
let tapTempoHandler = null;
let bpmController = null;

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
    { id: 'start', options: { allowSolo: true, label: 'P0' }, assignment: 'start' }
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
let superscriptController;

/**
 * Render pulse numbers using shared superscript module (linear mode)
 */
function renderPulseNumbers() {
  if (!timeline || !superscriptController) return;

  // Remove existing numbers
  timeline.querySelectorAll('.pulse-number').forEach(n => n.remove());

  const lg = TOTAL_PULSES - 1; // 12

  // Create numbers only for pulses 0-11 (not 12)
  for (let i = 0; i < PLAYABLE_PULSES; i++) {
    const label = superscriptController.createNumberElement(i);
    // Position linearly
    const percent = (i / lg) * 100;
    label.style.left = percent + '%';
    timeline.appendChild(label);
  }
}

/**
 * Create the "12" end label above the final bar
 */
function renderEndLabel() {
  if (!timeline) return;

  // Remove existing end label if any
  timeline.querySelector('.timeline-end-label')?.remove();

  const endLabel = document.createElement('div');
  endLabel.className = 'timeline-end-label';
  endLabel.textContent = '12';
  timeline.appendChild(endLabel);
}

// ============================================
// CYCLE COUNTER
// ============================================

/**
 * Calculate complete cycles and remainder beats
 */
function getCycleInfo() {
  if (compas === null || compas < 1) return { complete: 0, remainder: 0 };
  const complete = Math.floor(PLAYABLE_PULSES / compas);
  const remainder = PLAYABLE_PULSES % compas;
  return { complete, remainder };
}

/**
 * Show total cycles (when stopped) - uses Compás color (text-color)
 * Shows complete cycles with remainder in subscript: "2₍₃₎" means 2 complete cycles + 3 extra beats
 */
function showTotalCycles() {
  if (!cycleDigit) return;

  const { complete, remainder } = getCycleInfo();

  if (complete === 0 && remainder === 0) {
    cycleDigit.innerHTML = '';
  } else if (remainder === 0) {
    // Perfect fit - no remainder
    cycleDigit.innerHTML = String(complete);
  } else {
    // Show complete cycles + remainder in subscript
    cycleDigit.innerHTML = `${complete}<sub>${remainder}</sub>`;
  }

  cycleDigit.classList.remove('playing-zero', 'playing-active');
}

/**
 * Update cycle counter during playback (with animation)
 */
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

/**
 * Update cycle digit color based on current step
 */
function updateCycleDigitColor(step) {
  if (!cycleDigit || compas === null) return;

  cycleDigit.classList.remove('playing-zero', 'playing-active');

  const modValue = step % compas;
  if (modValue === 0) {
    cycleDigit.classList.add('playing-zero');
  } else {
    cycleDigit.classList.add('playing-active');
  }
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

function highlightCycleCircle(step) {
  const cycleCircle = document.querySelector('.cycle-circle');
  if (!cycleCircle) return;

  // Clear any pending timeout
  if (cycleHighlightTimeout) {
    clearTimeout(cycleHighlightTimeout);
    cycleHighlightTimeout = null;
  }

  cycleCircle.classList.remove('active', 'active-zero');

  if (!cycleHighlightEnabled) return;
  if (compas === null) return;

  const modValue = step % compas;
  if (modValue === 0) {
    cycleCircle.classList.add('active-zero');
  } else {
    cycleCircle.classList.add('active');
  }

  // Auto-dim after 300ms
  cycleHighlightTimeout = setTimeout(() => {
    cycleCircle.classList.remove('active', 'active-zero');
    cycleHighlightTimeout = null;
  }, 300);
}

function clearHighlights() {
  pulses.forEach(p => p.classList.remove('active', 'active-zero'));
  document.querySelectorAll('.pulse-number').forEach(n => {
    n.classList.remove('active', 'active-zero');
  });
  // Clear cycle circle highlight
  const cycleCircle = document.querySelector('.cycle-circle');
  cycleCircle?.classList.remove('active', 'active-zero');
}

// ============================================
// PLAYBACK
// ============================================

async function handlePlay() {
  if (isPlaying) {
    stopPlayback();
    return;
  }

  if (compas === null) return; // Can't play without compás

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

  // Disable random button during playback
  if (randomBtn) randomBtn.disabled = true;

  const intervalSec = 60 / bpm;

  // Configure Measure system: P0 sounds at 0, compás, compás*2, etc.
  audioInstance.configureMeasure(compas, PLAYABLE_PULSES);
  audioInstance.setMeasureEnabled(p0Enabled);

  audioInstance.play(
    PLAYABLE_PULSES,
    intervalSec,
    new Set(),    // No selected pulses
    false,        // NO loop (single-shot)
    (step) => {
      currentStep = step;
      highlightPulse(step);
      highlightNumber(step);
      highlightCycleCircle(step);
      updateCycleDigitColor(step);

      // Update cycle counter when hitting a new cycle start (except first)
      if (step > 0 && step % compas === 0) {
        const newCycle = Math.floor(step / compas) + 1;
        updateCycleCounter(newCycle);
      }
    },
    () => {
      // onComplete callback - delay 590ms to let last pulse ring out (10ms silence before end)
      // This is App16-specific timing, not applied globally
      setTimeout(() => {
        audio?.stop();  // Stop audio after delay
        stopPlayback(false);  // Update UI without calling stop again
      }, 590);
    }
  );
}

/**
 * Stop playback and reset UI.
 * @param {boolean} forceStop - If true, calls audio.stop(). If false (onComplete), audio engine handles timing.
 */
function stopPlayback(forceStop = true) {
  isPlaying = false;
  currentStep = -1;

  // Only force stop if user clicked stop (not on natural completion)
  // The audio engine already handles the delay to let the last pulse finish
  if (forceStop) {
    audio?.stop();
  }

  // Update play button state
  playBtn?.classList.remove('active');
  const iconPlay = playBtn?.querySelector('.icon-play');
  const iconStop = playBtn?.querySelector('.icon-stop');
  if (iconPlay) iconPlay.style.display = 'block';
  if (iconStop) iconStop.style.display = 'none';

  // Re-enable random button after playback
  if (randomBtn) randomBtn.disabled = false;

  clearHighlights();

  // Show total cycles again (stopped state)
  showTotalCycles();
}

// ============================================
// COMPÁS INPUT HANDLING
// ============================================

function handleCompasChange(newValue) {
  // Handle empty input - clear numbers and cycles
  if (newValue === '' || newValue === null || newValue === undefined) {
    compas = null;
    timeline?.querySelectorAll('.pulse-number').forEach(n => n.remove());
    showTotalCycles();  // Shows empty when no compás
    return;
  }

  const parsed = parseInt(newValue, 10);

  // Invalid number - clear input and keep focus
  if (isNaN(parsed)) {
    showValidationWarning(inputCompas, 'Introduce un número válido', 2000);
    if (inputCompas) {
      inputCompas.value = '';
      inputCompas.focus();
    }
    return;
  }

  // Validate range with tooltips - clear input and keep focus on error
  if (parsed < 1) {
    showValidationWarning(inputCompas, 'El Compás mínimo es <strong>1</strong>', 2000);
    if (inputCompas) {
      inputCompas.value = '';
      inputCompas.focus();
    }
    return;
  } else if (parsed > 12) {
    showValidationWarning(inputCompas, 'El Compás máximo es <strong>12</strong>', 2000);
    if (inputCompas) {
      inputCompas.value = '';
      inputCompas.focus();
    }
    return;
  } else {
    compas = parsed;
    if (inputCompas) inputCompas.value = compas;
  }

  // Re-render numbers with new compás
  renderPulseNumbers();

  // Show total cycles (stopped state)
  showTotalCycles();

  // Save state
  saveState();
}

function incrementCompas() {
  const current = compas ?? 0;
  if (current < 12) {
    handleCompasChange(current + 1);
  }
}

function decrementCompas() {
  const current = compas ?? 2;
  if (current > 1) {
    handleCompasChange(current - 1);
  }
}

// ============================================
// RANDOM
// ============================================

function handleRandom() {
  const maxCompas = parseInt(document.getElementById('randCompasMax')?.value || '12', 10);
  const min = 1;
  const max = Math.min(Math.max(maxCompas, 1), 12);
  const newCompas = Math.floor(Math.random() * (max - min + 1)) + min;

  handleCompasChange(newCompas);
}

// ============================================
// BPM HANDLING (via shared bpm-controller)
// ============================================

/**
 * Sync local bpm variable from controller
 */
function syncBpmFromController() {
  if (bpmController) {
    bpm = bpmController.getValue();
  }
}

/**
 * Toggle BPM visibility - shows/hides BPM input and tap tempo button
 */
function toggleBpmVisibility(enabled) {
  showBpmEnabled = enabled;

  // Show/hide BPM param via controller or direct class toggle
  if (bpmController) {
    bpmController.setVisible(enabled);
  } else if (bpmParam) {
    bpmParam.classList.toggle('visible', enabled);
  }

  // Show/hide tap tempo button
  if (tapTempoBtn) {
    tapTempoBtn.style.display = enabled ? '' : 'none';
  }

  // Show/hide tap help text
  if (tapHelp) {
    tapHelp.style.display = enabled ? '' : 'none';
  }

  // Reset BPM to default when hidden
  if (!enabled) {
    if (bpmController) {
      bpmController.setValue(DEFAULT_BPM);
      bpm = DEFAULT_BPM;
    } else {
      bpm = DEFAULT_BPM;
      if (inputBpm) inputBpm.value = bpm;
    }
  }
}

// ============================================
// RESET
// ============================================

function handleReset() {
  stopPlayback();

  // Reset to empty state (like initialization)
  compas = null;
  if (inputCompas) {
    inputCompas.value = '';
    inputCompas.focus();
  }

  // Clear pulse numbers from timeline
  timeline?.querySelectorAll('.pulse-number').forEach(n => n.remove());

  // Clear cycle display
  showTotalCycles();

  // Note: P0 toggle state is NOT reset - it persists through Reset
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
  // Only load randCompasMax - compás always starts empty
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
  inputBpm = document.getElementById('inputBpm');
  bpmUpBtn = document.getElementById('bpmUp');
  bpmDownBtn = document.getElementById('bpmDown');
  bpmParam = document.getElementById('bpmParam');
  tapTempoBtn = document.getElementById('tapTempoBtn');
  tapHelp = document.getElementById('tapHelp');
  showBpmToggle = document.getElementById('showBpmToggle');

  // Create timeline controller
  timelineController = createCircularTimeline({
    timeline,
    timelineWrapper,
    getPulses: () => pulses,
    getNumberFontSize: () => 2.0
  });

  // Create superscript controller (linear mode - position-based superscripts)
  superscriptController = createCycleSuperscript({
    timeline,
    getPulsosPerCycle: () => compas || 1,
    mode: 'linear'
  });

  // Load only randCompasMax (compás always starts empty)
  loadState();

  // Ensure input is empty on start
  if (inputCompas) {
    inputCompas.value = '';
  }
  compas = null;

  // Render timeline WITHOUT numbers (user will see them appear when entering compás)
  if (timelineController) {
    pulses = timelineController.render(TOTAL_PULSES - 1, {
      isCircular: false,
      silent: true
    });
  }
  // Don't call renderPulseNumbers() - wait for user input

  // Always show the "12" end label
  renderEndLabel();

  // Give focus to input so user can start typing
  inputCompas?.focus();

  // Compás input events
  inputCompas?.addEventListener('input', (e) => {
    handleCompasChange(e.target.value);
  });

  inputCompas?.addEventListener('blur', () => {
    handleCompasChange(inputCompas.value);
  });

  // Spinner buttons with auto-repeat
  attachSpinnerRepeat(compasUpBtn, incrementCompas);
  attachSpinnerRepeat(compasDownBtn, decrementCompas);

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
        { id: 'start', label: 'P0', allowSolo: true },
        { id: 'pulse', label: 'Pulso', allowSolo: true },
        { id: 'master', label: 'Master', allowSolo: false, isMaster: true }
      ]
    });
  }

  // Load mixer state after a short delay
  setTimeout(loadMixerState, 50);

  // Initialize P0 toggle from menu checkbox (NOT persisted between sessions - always starts active)
  // The template generates 'startIntervalToggle' checkbox when showP1Toggle: true
  const p0Checkbox = document.getElementById('startIntervalToggle');
  if (p0Checkbox) {
    p0Enabled = true;
    p0Checkbox.checked = true;
    p0Checkbox.addEventListener('change', () => {
      p0Enabled = p0Checkbox.checked;
      if (audio?.setMeasureEnabled) {
        audio.setMeasureEnabled(p0Enabled);
      }
    });
  }

  // Initialize audio toggles for Pulse only (P0 handled separately above)
  const pulseToggle = document.getElementById('pulseToggleBtn');
  if (pulseToggle) {
    const savedPulseEnabled = localStorage.getItem('app16:pulseAudio');
    const pulseEnabled = savedPulseEnabled !== null ? savedPulseEnabled === 'true' : true;

    pulseToggle.classList.toggle('active', pulseEnabled);
    if (audio?.setPulseEnabled) {
      audio.setPulseEnabled(pulseEnabled);
    }

    pulseToggle.addEventListener('click', () => {
      const isActive = pulseToggle.classList.toggle('active');
      localStorage.setItem('app16:pulseAudio', String(isActive));
      if (audio?.setPulseEnabled) {
        audio.setPulseEnabled(isActive);
      }
    });
  }

  // Initialize cycle highlight toggle
  const cycleHighlightToggle = document.getElementById('cycleHighlightToggle');
  if (cycleHighlightToggle) {
    const savedHighlight = localStorage.getItem('app16:cycleHighlight');
    cycleHighlightEnabled = savedHighlight !== null ? savedHighlight === 'true' : true;
    cycleHighlightToggle.checked = cycleHighlightEnabled;
    cycleHighlightToggle.addEventListener('change', () => {
      cycleHighlightEnabled = cycleHighlightToggle.checked;
      localStorage.setItem('app16:cycleHighlight', String(cycleHighlightEnabled));
    });
  }

  // Initialize BPM controller (shared module handles input/blur/spinners)
  if (inputBpm) {
    bpmController = createBpmController({
      inputEl: inputBpm,
      upBtn: bpmUpBtn,
      downBtn: bpmDownBtn,
      container: bpmParam,
      min: MIN_BPM,
      max: MAX_BPM,
      defaultValue: bpm,
      onChange: (newBpm) => {
        bpm = newBpm;
      }
    });
    bpmController.attach();
  }

  // Load showBpm preference (defaults to true)
  const savedShowBpm = localStorage.getItem('app16:showBpm');
  showBpmEnabled = savedShowBpm !== null ? savedShowBpm === 'true' : true;

  // Initialize BPM visibility toggle
  if (showBpmToggle) {
    showBpmToggle.checked = showBpmEnabled;
    showBpmToggle.addEventListener('change', () => {
      toggleBpmVisibility(showBpmToggle.checked);
      localStorage.setItem('app16:showBpm', String(showBpmToggle.checked));
    });
  }

  // Initialize BPM visibility from state
  toggleBpmVisibility(showBpmEnabled);

  // Initialize tap tempo handler
  if (tapTempoBtn) {
    tapTempoHandler = createTapTempoHandler({
      getAudioInstance: initAudio,
      tapBtn: tapTempoBtn,
      tapHelp: tapHelp,
      onBpmDetected: (newBpm) => {
        // Use controller to set BPM (handles clamping)
        const clampedBpm = Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(newBpm)));
        if (bpmController) {
          bpmController.setValue(clampedBpm);
        }
        bpm = clampedBpm;
      }
    });
    tapTempoHandler.attach();
  }

  // Register factory reset
  registerFactoryReset({
    storage: preferenceStorage,
    onBeforeReload: () => {
      stopPlayback();
      localStorage.removeItem('app16:p1Toggle');
      localStorage.removeItem('app16:pulseAudio');
      localStorage.removeItem('app16:cycleHighlight');
      localStorage.removeItem('app16:showBpm');
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
