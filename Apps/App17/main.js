/**
 * App17 - Módulo Temporal - Circular
 *
 * Timeline circular dinámica donde:
 * - Pulsos Compás define la longitud de la timeline (y el módulo aritmético)
 * - Cycle define cuántas veces se repite el módulo antes de parar
 */

import { createRhythmAudioInitializer } from '../../libs/app-common/audio-init.js';
import { createSchedulingBridge, bindSharedSoundEvents } from '../../libs/app-common/audio.js';
import { createCircularTimeline } from '../../libs/app-common/circular-timeline.js';
import { initMixerMenu } from '../../libs/app-common/mixer-menu.js';
import { initRandomMenu } from '../../libs/random/index.js';
import { createPreferenceStorage, registerFactoryReset } from '../../libs/app-common/preferences.js';
import { showValidationWarning } from '../../libs/app-common/info-tooltip.js';
import { subscribeMixer, setChannelVolume, setChannelMute, setVolume, setMute } from '../../libs/sound/index.js';
import { attachSpinnerRepeat } from '../../libs/app-common/spinner-repeat.js';
import { createCycleSuperscript } from '../../libs/app-common/cycle-superscript.js';
import { createTotalLengthDisplay } from '../../libs/app-common/total-length-display.js';

// ============================================
// CONSTANTS
// ============================================

const MIN_PULSOS = 1;
const MAX_PULSOS = 12;
const MIN_CYCLES = 1;
const MAX_CYCLES = 12;
const DEFAULT_CYCLES = 4;
const BPM = 100;              // Fixed BPM for this app

// ============================================
// STATE
// ============================================

let audio = null;
let isPlaying = false;
let pulsosCompas = null;      // Starts as null (empty input)
let cycles = DEFAULT_CYCLES;  // Número de repeticiones del módulo
let currentCycle = 1;
let pulses = [];              // DOM pulse elements
let currentStep = -1;
let p0Enabled = true;         // P0 toggle state (not persisted between sessions)
let cycleHighlightTimeout = null;  // For auto-dimming cycle circle
let cycleHighlightEnabled = true;  // Cycle highlight toggle state
let autoJumpTimer = null;     // Timer for auto-jump from Compás to Cycle
const AUTO_JUMP_DELAY = 300;  // Delay in ms before auto-jumping

// ============================================
// DOM ELEMENTS
// ============================================

let inputCompas;
let compasUpBtn;
let compasDownBtn;
let inputCycle;
let cycleUpBtn;
let cycleDownBtn;
let cycleDigit;
let timeline;
let timelineWrapper;
let playBtn;
let resetBtn;
let randomBtn;
let randomMenu;
let totalLengthDigit;
let superscriptController;   // Shared module for cycle superscripts
let totalLengthController;   // Shared module for total length display

// ============================================
// STORAGE
// ============================================

const preferenceStorage = createPreferenceStorage({ prefix: 'app17', separator: '-' });
const MIXER_STORAGE_KEY = 'app17-mixer';
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
  ],
  defaultInstrument: 'piano'
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
 * Render timeline with current pulsosCompas
 */
function renderTimeline() {
  if (!timelineController) return;

  if (pulsosCompas === null) {
    // Show empty circular timeline (just the circle, no pulses)
    renderEmptyTimeline();
    return;
  }

  // Render circular timeline with pulsosCompas pulses
  // render(lg) creates lg+1 points (0 to lg inclusive)
  // For a module of N pulses, pass N to create N+1 points where the last overlaps with 0
  // The overlapping endpoint number is hidden via CSS
  pulses = timelineController.render(pulsosCompas, {
    isCircular: true,
    silent: true
  });

  // Render numbers
  renderPulseNumbers();
}

/**
 * Render empty circular timeline (just the circle, no pulses or numbers)
 * Used on app initialization before user enters any values
 */
function renderEmptyTimeline() {
  if (!timelineController) return;

  // Render with lg=1 to create the circular layout (render(0) is skipped due to lg <= 0 check)
  // This creates 2 points (0 and 1) and applies circular geometry
  timelineController.render(1, {
    isCircular: true,
    silent: true
  });

  // Clear any numbers
  if (timeline) {
    timeline.querySelectorAll('.pulse-number').forEach(n => n.remove());
  }

  // Hide all pulse dots and bars to show only the empty circle
  if (timeline) {
    timeline.querySelectorAll('.pulse').forEach(p => p.style.display = 'none');
    timeline.querySelectorAll('.bar').forEach(b => b.style.display = 'none');
  }

  pulses = [];
}

/**
 * Render pulse numbers on the timeline
 * Uses the timeline controller's built-in numbering with showNumber
 *
 * Shows numbers 0 to pulsosCompas-1. The endpoint number (pulsosCompas)
 * is hidden via CSS since it visually overlaps with position 0.
 */
function renderPulseNumbers() {
  if (!timeline || pulsosCompas === null) return;

  // Remove existing numbers
  timeline.querySelectorAll('.pulse-number').forEach(n => n.remove());

  // Show numbers 0 to pulsosCompas-1
  // The endpoint (pulsosCompas) is hidden via CSS
  for (let i = 0; i < pulsosCompas; i++) {
    timelineController.showNumber(i);
  }

  // Add superscripts to all numbers (cycle 1 when stopped)
  // Use requestAnimationFrame to ensure DOM is updated after showNumber
  if (superscriptController) {
    superscriptController.updateAfterRender(1, () => {
      // Apply cycle-start class to pulse 0
      const zeroNumber = timeline.querySelector('.pulse-number[data-index="0"]');
      if (zeroNumber) {
        zeroNumber.classList.add('cycle-start');
      }
    });
  }
}

// ============================================
// CYCLE COUNTER
// ============================================

/**
 * Show total cycles (when stopped) - just shows the cycles value
 */
function showTotalCycles() {
  if (!cycleDigit) return;

  if (cycles === null || pulsosCompas === null) {
    cycleDigit.innerHTML = '';
  } else {
    cycleDigit.innerHTML = String(cycles);
  }

  cycleDigit.classList.remove('playing-zero', 'playing-active');

  // Update total length display
  updateTotalLength();
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
  if (!cycleDigit || pulsosCompas === null) return;

  cycleDigit.classList.remove('playing-zero', 'playing-active');

  const modValue = step % pulsosCompas;
  if (modValue === 0) {
    cycleDigit.classList.add('playing-zero');
  } else {
    cycleDigit.classList.add('playing-active');
  }
}

// ============================================
// TOTAL LENGTH DISPLAY (using shared module)
// ============================================

/**
 * Update total length display when NOT playing
 * Delegates to shared totalLengthController module
 */
function updateTotalLength() {
  if (totalLengthController) {
    totalLengthController.showTotal();
  }
}

/**
 * Update global step display during playback (1-indexed)
 * Delegates to shared totalLengthController module
 */
function updateGlobalStep(localStep, cycleNumber) {
  if (totalLengthController) {
    totalLengthController.updateGlobalStep(localStep, cycleNumber);
  }
}

/**
 * Reset total length display after playback stops
 * Delegates to shared totalLengthController module
 */
function resetTotalLengthDisplay() {
  if (totalLengthController) {
    totalLengthController.reset();
  }
}

// ============================================
// VISUAL FEEDBACK
// ============================================

/**
 * Flash a circle element to indicate missing input
 */
function flashMissingInput(element) {
  if (!element) return;
  element.classList.add('flash-warning');
  setTimeout(() => {
    element.classList.remove('flash-warning');
  }, 1000);
}

// ============================================
// HIGHLIGHTING
// ============================================

function highlightPulse(pulseIndex) {
  // Clear previous highlights
  pulses.forEach(p => p.classList.remove('active', 'active-zero'));

  // Add highlight to current pulse (using modular index for circular timeline)
  if (pulses[pulseIndex]) {
    if (pulseIndex === 0) {
      pulses[pulseIndex].classList.add('active-zero');
    } else {
      pulses[pulseIndex].classList.add('active');
    }
  }
}

function highlightNumber(pulseIndex) {
  // Clear previous highlights
  document.querySelectorAll('.pulse-number').forEach(n => {
    n.classList.remove('active', 'active-zero');
  });

  // Add highlight to current number
  const numberEl = document.querySelector(`.pulse-number[data-index="${pulseIndex}"]`);
  if (numberEl) {
    if (pulseIndex === 0) {
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
  if (pulsosCompas === null) return;

  const modValue = step % pulsosCompas;
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

  // Flash missing inputs if trying to play without values
  if (pulsosCompas === null || cycles === null) {
    if (pulsosCompas === null) {
      flashMissingInput(inputCompas?.closest('.circle'));
    }
    if (cycles === null) {
      flashMissingInput(document.querySelector('.cycle-circle'));
    }
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

  // Show cycle digit instead of input
  const cycleCircle = document.querySelector('.cycle-circle');
  cycleCircle?.classList.add('playing');
  const iconPlay = playBtn?.querySelector('.icon-play');
  const iconStop = playBtn?.querySelector('.icon-stop');
  if (iconPlay) iconPlay.style.display = 'none';
  if (iconStop) iconStop.style.display = 'block';

  // Disable random button during playback
  if (randomBtn) randomBtn.disabled = true;

  const intervalSec = 60 / BPM;

  // Total pulses = pulsosCompas * cycles
  const totalPulses = pulsosCompas * cycles;

  // Configure Measure system: P0 sounds at 0, pulsosCompas, pulsosCompas*2, etc.
  audioInstance.configureMeasure(pulsosCompas, totalPulses);
  audioInstance.setMeasureEnabled(p0Enabled);

  audioInstance.play(
    totalPulses,
    intervalSec,
    new Set(),    // No selected pulses
    false,        // NO loop (finite cycles)
    (step) => {
      currentStep = step;

      // Get pulse position within current cycle (for circular timeline highlight)
      const pulseInCycle = step % pulsosCompas;

      highlightPulse(pulseInCycle);
      highlightNumber(pulseInCycle);
      highlightCycleCircle(step);
      updateCycleDigitColor(step);

      // Calculate current cycle number (1-indexed)
      const cycleNumber = Math.floor(step / pulsosCompas) + 1;

      // Update global step in total length display
      updateGlobalStep(pulseInCycle, cycleNumber);

      // Update cycle counter and superscripts when hitting a new cycle start (except first)
      if (step > 0 && step % pulsosCompas === 0) {
        updateCycleCounter(cycleNumber);
        if (superscriptController) superscriptController.updateAll(cycleNumber);
      }
    },
    () => {
      // onComplete callback - delay 590ms to let last pulse ring out
      setTimeout(() => {
        audio?.stop();
        stopPlayback(false);
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

  if (forceStop) {
    audio?.stop();
  }

  // Update play button state
  playBtn?.classList.remove('active');
  const iconPlay = playBtn?.querySelector('.icon-play');
  const iconStop = playBtn?.querySelector('.icon-stop');
  if (iconPlay) iconPlay.style.display = 'block';
  if (iconStop) iconStop.style.display = 'none';

  // Show input instead of cycle digit
  const cycleCircle = document.querySelector('.cycle-circle');
  cycleCircle?.classList.remove('playing');

  // Re-enable random button after playback
  if (randomBtn) randomBtn.disabled = false;

  clearHighlights();

  // Reset superscripts to cycle 1
  if (superscriptController) superscriptController.reset();

  // Reset total length display (clear playback colors)
  resetTotalLengthDisplay();

  // Show total cycles again (stopped state)
  showTotalCycles();
}

// ============================================
// PULSOS COMPÁS INPUT HANDLING
// ============================================

function handleCompasChange(newValue, triggerAutoJump = false) {
  // Clear any pending auto-jump
  if (autoJumpTimer) {
    clearTimeout(autoJumpTimer);
    autoJumpTimer = null;
  }

  // Handle empty input
  if (newValue === '' || newValue === null || newValue === undefined) {
    pulsosCompas = null;
    renderTimeline();
    showTotalCycles();
    return;
  }

  const parsed = parseInt(newValue, 10);

  // Invalid number
  if (isNaN(parsed)) {
    showValidationWarning(inputCompas, 'Introduce un número válido', 2000);
    if (inputCompas) {
      inputCompas.value = '';
      inputCompas.focus();
    }
    return;
  }

  // Validate range
  if (parsed < MIN_PULSOS) {
    showValidationWarning(inputCompas, `El mínimo es <strong>${MIN_PULSOS}</strong>`, 2000);
    if (inputCompas) {
      inputCompas.value = '';
      inputCompas.focus();
    }
    return;
  } else if (parsed > MAX_PULSOS) {
    showValidationWarning(inputCompas, `El máximo es <strong>${MAX_PULSOS}</strong>`, 2000);
    if (inputCompas) {
      inputCompas.value = '';
      inputCompas.focus();
    }
    return;
  } else {
    pulsosCompas = parsed;
    if (inputCompas) inputCompas.value = pulsosCompas;
  }

  // Re-render timeline
  renderTimeline();

  // Show total cycles
  showTotalCycles();

  // Save state
  saveState();

  // Auto-jump to inputCycle after delay (only when typing digits)
  if (triggerAutoJump && inputCycle) {
    autoJumpTimer = setTimeout(() => {
      inputCycle.focus();
      inputCycle.select();
      autoJumpTimer = null;
    }, AUTO_JUMP_DELAY);
  }
}

function incrementCompas() {
  const current = pulsosCompas ?? (MIN_PULSOS - 1);
  if (current < MAX_PULSOS) {
    handleCompasChange(current + 1);
  }
}

function decrementCompas() {
  const current = pulsosCompas ?? (MIN_PULSOS + 1);
  if (current > MIN_PULSOS) {
    handleCompasChange(current - 1);
  }
}

// ============================================
// CYCLE INPUT HANDLING
// ============================================

function handleCycleChange(newValue) {
  // Handle empty input
  if (newValue === '' || newValue === null || newValue === undefined) {
    cycles = null;
    if (inputCycle) inputCycle.value = '';
    showTotalCycles();
    return;
  }

  const parsed = parseInt(newValue, 10);

  if (isNaN(parsed) || parsed < MIN_CYCLES) {
    cycles = MIN_CYCLES;
  } else if (parsed > MAX_CYCLES) {
    cycles = MAX_CYCLES;
  } else {
    cycles = parsed;
  }

  if (inputCycle) inputCycle.value = cycles;
  showTotalCycles();
  saveState();
}

function incrementCycle() {
  const current = cycles ?? (MIN_CYCLES - 1);
  if (current < MAX_CYCLES) {
    handleCycleChange(current + 1);
  }
}

function decrementCycle() {
  const current = cycles ?? (MIN_CYCLES + 1);
  if (current > MIN_CYCLES) {
    handleCycleChange(current - 1);
  }
}


// ============================================
// RANDOM
// ============================================

function handleRandom() {
  const maxPulsos = parseInt(document.getElementById('randPulsosMax')?.value || '12', 10);
  const maxCycles = parseInt(document.getElementById('randCyclesMax')?.value || '8', 10);

  const newPulsos = Math.floor(Math.random() * (Math.min(maxPulsos, MAX_PULSOS) - MIN_PULSOS + 1)) + MIN_PULSOS;
  const newCycles = Math.floor(Math.random() * (Math.min(maxCycles, MAX_CYCLES) - MIN_CYCLES + 1)) + MIN_CYCLES;

  handleCompasChange(newPulsos);
  handleCycleChange(newCycles);
}

// ============================================
// RESET
// ============================================

function handleReset() {
  stopPlayback();

  // Reset pulsos to empty
  pulsosCompas = null;
  if (inputCompas) {
    inputCompas.value = '';
    inputCompas.focus();
  }

  // Reset cycles to empty (not default)
  cycles = null;
  if (inputCycle) {
    inputCycle.value = '';
  }

  // Show empty circular timeline (just the circle, no pulses)
  renderEmptyTimeline();

  // Clear cycle display
  showTotalCycles();
}

// ============================================
// STATE PERSISTENCE
// ============================================

function saveState() {
  preferenceStorage.save({
    pulsosCompas,
    cycles,
    randPulsosMax: parseInt(document.getElementById('randPulsosMax')?.value || '12', 10),
    randCyclesMax: parseInt(document.getElementById('randCyclesMax')?.value || '8', 10)
  });
}

function loadState() {
  const prefs = preferenceStorage.load();

  // Load random settings
  if (prefs?.randPulsosMax) {
    const randInput = document.getElementById('randPulsosMax');
    if (randInput) randInput.value = prefs.randPulsosMax;
  }
  if (prefs?.randCyclesMax) {
    const randInput = document.getElementById('randCyclesMax');
    if (randInput) randInput.value = prefs.randCyclesMax;
  }

  // Load cycles (pulsos always starts empty)
  if (prefs?.cycles) {
    cycles = prefs.cycles;
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
  inputCycle = document.getElementById('inputCycle');
  cycleUpBtn = document.getElementById('cycleUp');
  cycleDownBtn = document.getElementById('cycleDown');
  cycleDigit = document.getElementById('cycleDigit');
  totalLengthDigit = document.getElementById('totalLengthDigit');
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
    getNumberFontSize: () => 2.0
  });

  // Create superscript controller (circular mode - all numbers share same superscript)
  superscriptController = createCycleSuperscript({
    timeline,
    mode: 'circular'
  });

  // Create total length display controller
  totalLengthController = createTotalLengthDisplay({
    digitElement: totalLengthDigit,
    getTotal: () => (pulsosCompas && cycles) ? pulsosCompas * cycles : null,
    getPulsosPerCycle: () => pulsosCompas || 1
  });

  // Load state
  loadState();

  // Ensure pulsos input is empty on start
  if (inputCompas) {
    inputCompas.value = '';
  }
  pulsosCompas = null;

  // Ensure cycles input is empty on start
  if (inputCycle) {
    inputCycle.value = '';
  }
  cycles = null;

  // Show cycles counter (will be empty)
  showTotalCycles();

  // Render empty circular timeline (just the circle, no numbers/pulses)
  renderEmptyTimeline();

  // Give focus to pulsos input
  inputCompas?.focus();

  // Pulsos Compás input events
  inputCompas?.addEventListener('input', (e) => {
    // Trigger auto-jump when user types a digit
    const isDigitTyped = e.inputType === 'insertText' && /^[0-9]$/.test(e.data);
    handleCompasChange(e.target.value, isDigitTyped);
  });

  inputCompas?.addEventListener('blur', () => {
    // Clear auto-jump timer on blur
    if (autoJumpTimer) {
      clearTimeout(autoJumpTimer);
      autoJumpTimer = null;
    }
    handleCompasChange(inputCompas.value);
  });

  // Cycle input events
  inputCycle?.addEventListener('input', (e) => {
    handleCycleChange(e.target.value);
    // Auto-blur after entering a digit
    if (e.inputType === 'insertText' && /^[0-9]$/.test(e.data)) {
      setTimeout(() => {
        inputCycle.blur();
      }, AUTO_JUMP_DELAY);
    }
  });

  inputCycle?.addEventListener('blur', () => {
    handleCycleChange(inputCycle.value);
  });

  // Spinner buttons with auto-repeat
  attachSpinnerRepeat(compasUpBtn, incrementCompas);
  attachSpinnerRepeat(compasDownBtn, decrementCompas);
  attachSpinnerRepeat(cycleUpBtn, incrementCycle);
  attachSpinnerRepeat(cycleDownBtn, decrementCycle);

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

  // Initialize P0 toggle from menu checkbox
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

  // Initialize cycle highlight toggle
  const cycleHighlightToggle = document.getElementById('cycleHighlightToggle');
  if (cycleHighlightToggle) {
    const savedHighlight = localStorage.getItem('app17:cycleHighlight');
    cycleHighlightEnabled = savedHighlight !== null ? savedHighlight === 'true' : true;
    cycleHighlightToggle.checked = cycleHighlightEnabled;
    cycleHighlightToggle.addEventListener('change', () => {
      cycleHighlightEnabled = cycleHighlightToggle.checked;
      localStorage.setItem('app17:cycleHighlight', String(cycleHighlightEnabled));
    });
  }

  // Register factory reset
  registerFactoryReset({
    storage: preferenceStorage,
    onBeforeReload: () => {
      stopPlayback();
      localStorage.removeItem('app17:p1Toggle');
      localStorage.removeItem('app17:cycleHighlight');
      localStorage.removeItem(MIXER_STORAGE_KEY);
    }
  });

  // Listen for random settings changes
  document.getElementById('randPulsosMax')?.addEventListener('change', saveState);
  document.getElementById('randCyclesMax')?.addEventListener('change', saveState);
}

// Start initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
