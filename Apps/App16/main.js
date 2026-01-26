/**
 * App16 - Módulo Temporal - Compás
 *
 * Enseña el concepto de aritmética modular en música.
 * Timeline dinámica que muestra 2 compases completos con fade-out al repetir.
 */

import { createRhythmAudioInitializer } from '../../libs/app-common/audio-init.js';
import { createSchedulingBridge, bindSharedSoundEvents } from '../../libs/app-common/audio.js';
import { createCircularTimeline } from '../../libs/app-common/circular-timeline.js';
import { initMixerMenu } from '../../libs/app-common/mixer-menu.js';
import { initRandomMenu } from '../../libs/random/index.js';
import { createPreferenceStorage, registerFactoryReset } from '../../libs/app-common/preferences.js';
import { showValidationWarning } from '../../libs/app-common/info-tooltip.js';
import { subscribeMixer, setChannelVolume, setChannelMute, setVolume, setMute, getVolume } from '../../libs/sound/index.js';
import { createTapTempoHandler } from '../../libs/app-common/tap-tempo-handler.js';
import { attachSpinnerRepeat } from '../../libs/app-common/spinner-repeat.js';
import { createCycleSuperscript } from '../../libs/app-common/cycle-superscript.js';
import { createBpmController } from '../../libs/app-common/bpm-controller.js';

// ============================================
// CONSTANTS
// ============================================

const MAX_COMPAS = 7;         // Maximum compás value
const DEFAULT_BPM = 100;
const MIN_BPM = 30;
const MAX_BPM = 240;

// ============================================
// STATE
// ============================================

let audio = null;
let isPlaying = false;
let compas = null;            // Starts as null (empty input)
let pulses = [];              // DOM pulse elements
let currentStep = -1;
let p0Enabled = true;         // P0 toggle state (not persisted between sessions)
let bpm = DEFAULT_BPM;        // Current BPM value
let showBpmEnabled = false;   // BPM visibility toggle state (not persisted)

// Fade-out state
const FADE_OUT_PULSES = 3;    // Pulses 0, 1, 2 after the jump

// ============================================
// DOM ELEMENTS
// ============================================

let inputCompas;
let compasUpBtn;
let compasDownBtn;
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
 * Get the total number of pulses based on compás (2 compases)
 */
function getTotalPulses() {
  if (compas === null || compas < 1) return 0;
  return compas * 2;
}

/**
 * Render pulse numbers using shared superscript module (linear mode)
 */
function renderPulseNumbers() {
  if (!timeline || !superscriptController) return;

  // Remove existing numbers
  timeline.querySelectorAll('.pulse-number').forEach(n => n.remove());

  const totalPulses = getTotalPulses();
  if (totalPulses === 0) return;

  // Create numbers for all visible pulses
  for (let i = 0; i < totalPulses; i++) {
    const label = superscriptController.createNumberElement(i);
    // Position linearly
    const percent = (i / totalPulses) * 100;
    label.style.left = percent + '%';
    timeline.appendChild(label);
  }

  // Add 0³ at the end (shows continuation, will be hidden during fade-out)
  const endLabel = document.createElement('div');
  endLabel.className = 'pulse-number';
  endLabel.innerHTML = '0<sup>3</sup>';
  endLabel.style.left = '100%';
  endLabel.dataset.index = String(totalPulses); // Index after all pulses
  timeline.appendChild(endLabel);
}

/**
 * Remove end bar from timeline (we don't want visual end point)
 */
function removeEndBar() {
  if (!timeline) return;
  // Remove any end label
  timeline.querySelector('.timeline-end-label')?.remove();
  // Remove the right bar (endpoint)
  const bars = timeline.querySelectorAll('.bar');
  if (bars.length > 1) {
    bars[bars.length - 1].remove();
  }
}

/**
 * Render the complete timeline (pulses + numbers + end label)
 */
function renderTimeline() {
  if (!timeline || !timelineController) return;

  const totalPulses = getTotalPulses();

  if (totalPulses === 0) {
    // Clear timeline when no compás
    timeline.querySelectorAll('.pulse').forEach(p => p.remove());
    timeline.querySelectorAll('.pulse-number').forEach(n => n.remove());
    timeline.querySelectorAll('.bar').forEach(b => b.remove());
    pulses = [];
    return;
  }

  // Render timeline with new pulse count
  pulses = timelineController.render(totalPulses, {
    isCircular: false,
    silent: true
  });

  // Remove end bar (no visual endpoint - timeline continues)
  removeEndBar();

  // Render numbers
  renderPulseNumbers();
}


// ============================================
// HIGHLIGHTING
// ============================================

/**
 * Highlight a pulse dot and optionally the endpoint bars
 */
function highlightPulse(step, isFadeOut = false) {
  // Clear previous highlights from pulses
  pulses.forEach(p => p.classList.remove('active', 'active-zero', 'fade-out'));

  // Handle bars visibility and highlighting
  const bars = timeline?.querySelectorAll('.bar');
  const leftBar = bars?.[0];

  if (leftBar) {
    if (isFadeOut) {
      leftBar.classList.add('hidden');
    } else {
      leftBar.classList.remove('hidden');
      // Highlight left bar when step 0 is active
      if (step === 0) {
        leftBar.classList.add('active-zero');
      } else {
        leftBar.classList.remove('active-zero');
      }
    }
  }

  // Add highlight to current pulse
  if (pulses[step]) {
    if (isFadeOut) {
      pulses[step].classList.add('fade-out');
    } else {
      const modValue = step % compas;
      pulses[step].classList.add(modValue === 0 ? 'active-zero' : 'active');
    }
  }
}

/**
 * Highlight a number using data-index selector (more reliable than array index)
 * During fade-out: ALL visible numbers change to cycle 3 at once when step 0 activates
 */
function highlightNumber(step, isFadeOut = false) {
  if (!timeline) return;

  // Clear previous highlights (but NOT fade-out state during fade-out phase)
  timeline.querySelectorAll('.pulse-number').forEach(n => {
    n.classList.remove('active', 'active-zero');
    if (!isFadeOut) {
      n.classList.remove('fade-out', 'hidden');
    }
  });

  // Use data-index selector for reliable element selection
  const numberEl = timeline.querySelector(`.pulse-number[data-index="${step}"]`);

  // DEBUG
  console.log('[highlightNumber] step:', step, 'isFadeOut:', isFadeOut, 'numberEl:', numberEl, 'compas:', compas);

  if (numberEl) {
    if (isFadeOut) {
      // On FIRST fade-out pulse (step 0): update ALL visible numbers at once
      if (step === 0) {
        timeline.querySelectorAll('.pulse-number').forEach(n => {
          const idx = parseInt(n.dataset.index, 10);
          if (idx < FADE_OUT_PULSES) {
            // Update superscript to cycle 3 for all fade-out numbers
            const posInCycle = idx % compas;
            const fadeOutCycle = Math.floor(idx / compas) + 3;
            n.innerHTML = `${posInCycle}<sup>${fadeOutCycle}</sup>`;
          } else {
            // Hide numbers outside fade-out range
            n.classList.add('hidden');
          }
        });
      }

      // Highlight current number with fade-out effect
      numberEl.classList.add('fade-out');
    } else {
      const modValue = step % compas;
      const className = modValue === 0 ? 'active-zero' : 'active';
      console.log('[highlightNumber] Adding class:', className, 'to element:', numberEl);
      numberEl.classList.add(className);
      console.log('[highlightNumber] Element classes after:', numberEl.className);
    }
  }
}

function clearHighlights(keepFadeOut = false) {
  pulses.forEach(p => p.classList.remove('active', 'active-zero', 'fade-out'));

  // Handle left bar
  const leftBar = timeline?.querySelector('.bar');
  if (leftBar) {
    leftBar.classList.remove('active-zero');
    if (!keepFadeOut) {
      leftBar.classList.remove('hidden');
    }
  }

  if (keepFadeOut) {
    // Only remove active states, keep fade-out visible
    timeline?.querySelectorAll('.pulse-number').forEach(n => {
      n.classList.remove('active', 'active-zero');
    });
  } else {
    // Full clear including fade-out
    timeline?.querySelectorAll('.pulse-number').forEach(n => {
      n.classList.remove('active', 'active-zero', 'fade-out', 'hidden');
    });
  }
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
  currentStep = -1;

  // Reset timeline to original state (clear any fade-out numbers from previous play)
  renderPulseNumbers();

  // Update play button state
  playBtn?.classList.add('active');
  const iconPlay = playBtn?.querySelector('.icon-play');
  const iconStop = playBtn?.querySelector('.icon-stop');
  if (iconPlay) iconPlay.style.display = 'none';
  if (iconStop) iconStop.style.display = 'block';

  // Disable random button during playback
  if (randomBtn) randomBtn.disabled = true;

  const intervalSec = 60 / bpm;
  const totalPulses = getTotalPulses();  // compás × 2

  // Configure Measure system: P0 sounds at 0, compás
  audioInstance.configureMeasure(compas, totalPulses);
  audioInstance.setMeasureEnabled(p0Enabled);

  // Total steps = main pulses + fade-out pulses
  const totalSteps = totalPulses + FADE_OUT_PULSES;

  // Calculate fade-out volumes (descending: 0.5, 0.25, 0.1)
  const fadeVolumes = [0.5, 0.25, 0.1];

  // Store original volume to restore later
  const originalVolume = getVolume();

  audioInstance.play(
    totalSteps,
    intervalSec,
    new Set(),    // No selected pulses
    false,        // NO loop (single-shot)
    (step) => {
      currentStep = step;

      // Determine if we're in fade-out phase
      const isFadeOut = step >= totalPulses;
      const displayStep = isFadeOut ? step - totalPulses : step;

      // Set volume for fade-out pulses
      if (isFadeOut) {
        const fadeIndex = step - totalPulses;
        const volume = fadeVolumes[fadeIndex] ?? 0.1;
        setVolume(volume);
      } else if (step === 0) {
        // Ensure full volume at start
        setVolume(originalVolume);
      }

      highlightPulse(displayStep, isFadeOut);
      highlightNumber(displayStep, isFadeOut);
    },
    () => {
      // onComplete callback
      setTimeout(() => {
        setVolume(originalVolume);  // Restore original volume
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

  // Restore volume to 1.0 (in case stopped during fade-out)
  if (forceStop) {
    setVolume(1.0);
  }

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

  // Clear highlights - keep fade-out numbers visible on natural completion
  clearHighlights(!forceStop);
}

// ============================================
// COMPÁS INPUT HANDLING
// ============================================

function handleCompasChange(newValue) {
  // Handle empty input - clear timeline
  if (newValue === '' || newValue === null || newValue === undefined) {
    compas = null;
    renderTimeline();  // Clears timeline when no compás
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
    showValidationWarning(inputCompas, 'El mínimo es <strong>1</strong>', 2000);
    if (inputCompas) {
      inputCompas.value = '';
      inputCompas.focus();
    }
    return;
  } else if (parsed > MAX_COMPAS) {
    showValidationWarning(inputCompas, `El máximo es <strong>${MAX_COMPAS}</strong>`, 2000);
    if (inputCompas) {
      inputCompas.value = '';
      inputCompas.focus();
    }
    return;
  } else {
    compas = parsed;
    if (inputCompas) inputCompas.value = compas;
  }

  // Re-render timeline with new compás
  renderTimeline();

  // Save state
  saveState();
}

function incrementCompas() {
  const current = compas ?? 0;
  if (current < MAX_COMPAS) {
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
  const maxCompas = parseInt(document.getElementById('randCompasMax')?.value || String(MAX_COMPAS), 10);
  const min = 1;
  const max = Math.min(Math.max(maxCompas, 1), MAX_COMPAS);
  const newCompas = Math.floor(Math.random() * (max - min + 1)) + min;

  handleCompasChange(newCompas);
}

// ============================================
// BPM HANDLING (via shared bpm-controller)
// ============================================

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

  // Clear timeline
  renderTimeline();

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

  // Don't render timeline yet - wait for user to enter compás
  // Timeline will be rendered when user enters a value

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
