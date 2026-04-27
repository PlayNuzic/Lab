/**
 * App17 - Módulo Temporal - Circular
 *
 * Timeline circular dinámica donde:
 * - Pulsos Compás define la longitud de la timeline (y el módulo aritmético)
 * - Cycle define cuántas veces se repite el módulo antes de parar
 */

import { createRhythmAudioInitializer } from '../../libs/app-common/audio-init.js';
import { createSchedulingBridge, bindSharedSoundEvents } from '../../libs/app-common/audio.js';
import { initMixerMenu } from '../../libs/app-common/mixer-menu.js';
import { initRandomMenu } from '../../libs/random/index.js';
import { createPreferenceStorage, registerFactoryReset } from '../../libs/app-common/preferences.js';
import { showValidationWarning } from '../../libs/app-common/info-tooltip.js';
import { subscribeMixer, setChannelVolume, setChannelMute, setVolume, setMute } from '../../libs/sound/index.js';
import { attachSpinnerRepeat } from '../../libs/app-common/spinner-repeat.js';
import { createCycleSuperscript } from '../../libs/app-common/cycle-superscript.js';
import { createTotalLengthDisplay } from '../../libs/app-common/total-length-display.js';
import { createBpmController } from '../../libs/app-common/bpm-controller.js';
import { initIdleCaretFlash } from '../../libs/app-common/idle-caret-flash.js';

// ============================================
// CONSTANTS
// ============================================

const MIN_PULSOS = 1;
const MAX_PULSOS = 12;
const MIN_CYCLES = 1;
const MAX_CYCLES = 12;
const DEFAULT_CYCLES = 4;
const DEFAULT_BPM = 90;
const MIN_BPM = 50;
const MAX_BPM = 150;

// ============================================
// STATE
// ============================================

let audio = null;
let bpmController = null;
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
const AUTO_JUMP_DELAY = 500;  // Delay in ms before auto-jumping

// ============================================
// DOM ELEMENTS
// ============================================

let inputCompas;
let compasUpBtn;
let compasDownBtn;
let inputCycle;
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


/**
 * Render the circular timeline — fully self-contained, no controller.
 * Sets the `.circular` class on timeline + wrapper, wipes any prior content,
 * and paints the pulse-numbers on the cream ring.
 */
function renderTimeline() {
  if (!timeline) return;

  // Ensure circular classes (so CSS geometry applies).
  timeline.classList.add('circular');
  timelineWrapper?.classList.add('circular');

  // Wipe prior pulse dots / numbers / bars.
  timeline.innerHTML = '';
  pulses = [];

  if (pulsosCompas === null) return;

  renderPulseNumbers();
}

/**
 * No-op empty state: renderTimeline above already clears everything when
 * pulsosCompas is null. Kept for API parity with other apps.
 */
function renderEmptyTimeline() {
  renderTimeline();
}

/**
 * Render pulse numbers on the circular timeline — positioned on the cream
 * ring (midway between the outer yellow edge and the inner white disc).
 * We place them via trigonometry on the .timeline's own bounding box after
 * layout (rAF) so the positions track the actual rendered size.
 */
function renderPulseNumbers() {
  if (!timeline || pulsosCompas === null) return;

  // Remove existing numbers
  timeline.querySelectorAll('.pulse-number').forEach(n => n.remove());

  const n = pulsosCompas;
  // Create elements first so they are in DOM before measuring.
  const numberEls = [];
  for (let i = 0; i < n; i++) {
    const el = document.createElement('div');
    el.className = 'pulse-number';
    el.dataset.index = String(i);
    // Superscript is always visible — cycle 1 at rest, updated during play.
    el.innerHTML = `${i}<sup>1</sup>`;
    if (i === 0) el.classList.add('cycle-start');
    timeline.appendChild(el);
    numberEls.push(el);
  }

  // Position after layout.
  requestAnimationFrame(() => {
    const rect = timeline.getBoundingClientRect();
    if (rect.width === 0) return;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const fullRadius = Math.min(rect.width, rect.height) / 2;

    // Ring geometry — all values are relative to fullRadius.
    //
    // INNER/OUTER_R_RATIO: the painted cream donut edges (kept in sync
    //   with the radial-gradient in styles.css: 40% → 100%).
    //   EDGE_INSET shaves a couple of pixels off each edge so the tick's
    //   rounded line cap does not cross the boundary.
    // CENTER_R_RATIO: midpoint between the two edges — geometric center
    //   of the ring, where the numbers sit visually centered.
    const INNER_R_RATIO = 0.40;
    const OUTER_R_RATIO = 1.00;
    const EDGE_INSET_PX = 3;
    const CENTER_R_RATIO = (INNER_R_RATIO + OUTER_R_RATIO) / 2;  // 0.70
    const ringRadius = fullRadius * CENTER_R_RATIO;
    // Dynamic font-size: scales with circle radius and pulse density.
    // Floor 9 (enlloc de 11) deixa que els nombres es comprimeixin més en
    // cercles petits — necessari quan el wrapper.circular cau al floor del
    // seu propi clamp (16rem = 256px → fullRadius ~115px).
    const fontPx = Math.max(
      9,
      Math.min(24, (fullRadius * 0.20) / Math.sqrt(n / 4))
    );
    // Radial distances from the number's center to each donut edge,
    // shaved by EDGE_INSET_PX so the tick's tip sits just inside the edge
    // and doesn't paint over the donut boundary.
    const outerSpan = (OUTER_R_RATIO * fullRadius - ringRadius) - EDGE_INSET_PX;
    const innerSpan = (ringRadius - INNER_R_RATIO * fullRadius) - EDGE_INSET_PX;
    const halfFont = fontPx / 2;
    // "Usable" slots: from the text edge to the donut edge on each side.
    //   slotOuter = outerSpan − halfFont   (room past the top of the text)
    //   slotInner = innerSpan − halfFont   (room past the bottom of the text)
    // Each tick occupies: gap + tickLength, together filling its slot.
    //   gap_before + tickLength = slotOuter   → gap_before = slotOuter − L
    //   gap_after  + tickLength = slotInner   → gap_after  = slotInner  − L
    // Ticks are the same length on both sides (user requested symmetric
    // ticks), so L is driven by the *smaller* slot. Outer is typically
    // smaller because CENTER_R_RATIO=0.79 puts the number closer to the
    // outer edge than the inner one.
    // Minimum breathing space between the text and the tick.
    const MIN_TEXT_GAP = 3;
    const slotOuter = Math.max(0, outerSpan - halfFont - MIN_TEXT_GAP);
    const slotInner = Math.max(0, innerSpan - halfFont - MIN_TEXT_GAP);
    // Symmetric tick length, sized to the smaller slot so it fits both
    // sides, then scaled down so ticks don't feel too long. Each tick's
    // inner end sits near the text; the extra room on either side goes
    // into `gap_*` below, which offsets the tick away from the number.
    const TICK_SCALE = 0.5;
    const tickLength = Math.max(3, Math.min(slotOuter, slotInner) * TICK_SCALE);
    // Gap from the text edge to the tick's near end.
    // The tick's far end sits on the donut edge by construction.
    const gapBefore = MIN_TEXT_GAP + Math.max(0, slotOuter - tickLength);
    const gapAfter = MIN_TEXT_GAP + Math.max(0, slotInner - tickLength);

    numberEls.forEach((el, i) => {
      const angle = (i / n) * 2 * Math.PI - Math.PI / 2;  // pulse 0 at top
      const x = cx + ringRadius * Math.cos(angle);
      const y = cy + ringRadius * Math.sin(angle);
      // Rotate each pulse-number so it follows the ring tangent (perpendicular
      // to the radius pointing outward). Also translate(-50%,-50%) to center
      // the element over its (x,y) point. setProperty+important defeats the
      // base nuzic-theme rule `.timeline .pulse-number { top:50% !important;
      // transform: translate(-50%,-50%) !important }`.
      const rotDeg = ((angle + Math.PI / 2) * 180) / Math.PI;
      el.style.setProperty('left', `${x}px`, 'important');
      el.style.setProperty('top', `${y}px`, 'important');
      el.style.setProperty(
        'transform',
        `translate(-50%, -50%) rotate(${rotDeg}deg)`,
        'important'
      );
      el.style.setProperty('font-size', `${fontPx}px`, 'important');
      // Feed CSS custom props used by the ::before/::after tick pseudo-elements.
      // Same length on both ticks, asymmetric gaps so each tip lands on
      // its respective donut edge.
      el.style.setProperty('--pulse-tick-length', `${tickLength}px`);
      el.style.setProperty('--pulse-tick-gap-before', `${gapBefore}px`);
      el.style.setProperty('--pulse-tick-gap-after', `${gapAfter}px`);
    });
  });
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
  const cycleCircle = document.querySelector('.pl-secondary.cycle-circle');
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
  const cycleCircle = document.querySelector('.pl-secondary.cycle-circle');
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
      flashMissingInput(inputCompas?.closest('.pl-primary'));
    }
    if (cycles === null) {
      flashMissingInput(document.querySelector('.pl-secondary.cycle-circle'));
    }
    return;
  }

  const audioInstance = await initAudio();
  if (!audioInstance) return;

  isPlaying = true;
  currentCycle = 1;
  currentStep = -1;
  updateCycleCounter(1);

  // Show cycle-1 superscripts on every pulse number from the first beat.
  if (superscriptController) superscriptController.updateAll(1);

  // Update play button state
  playBtn?.classList.add('active');

  // Show cycle digit instead of input during playback
  const cycleCircle = document.querySelector('.pl-secondary.cycle-circle');
  cycleCircle?.classList.add('playing');
  // Prime the digit with the starting cycle
  if (cycleDigit) cycleDigit.textContent = '1';
  const iconPlay = playBtn?.querySelector('.icon-play');
  const iconStop = playBtn?.querySelector('.icon-stop');
  if (iconPlay) iconPlay.style.display = 'none';
  if (iconStop) iconStop.style.display = 'block';

  // Disable random button during playback
  if (randomBtn) randomBtn.disabled = true;

  const intervalSec = 60 / (bpmController?.getValue() || DEFAULT_BPM);

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
  const cycleCircle = document.querySelector('.pl-secondary.cycle-circle');
  cycleCircle?.classList.remove('playing');

  // Re-enable random button after playback
  if (randomBtn) randomBtn.disabled = false;

  clearHighlights();

  // Reset superscripts back to cycle 1 (always visible).
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
  cycleDigit = document.getElementById('cycleDigit');
  timeline = document.getElementById('timeline');
  timelineWrapper = document.getElementById('timelineWrapper');
  playBtn = document.getElementById('playBtn');
  resetBtn = document.getElementById('resetBtn');
  randomBtn = document.getElementById('randomBtn');
  randomMenu = document.getElementById('randomMenu');

  // Build the total-length center display inside the timeline wrapper
  let totalLengthBlock = document.getElementById('totalLengthCenter');
  if (timelineWrapper && !totalLengthBlock) {
    totalLengthBlock = document.createElement('div');
    totalLengthBlock.id = 'totalLengthCenter';
    totalLengthBlock.className = 'total-length-center';
    totalLengthBlock.innerHTML = `
      <div class="circle">
        <span class="total-length__digit" id="totalLengthDigit">--</span>
      </div>
    `;
    timelineWrapper.appendChild(totalLengthBlock);
  }
  totalLengthDigit = document.getElementById('totalLengthDigit');

  // Re-render pulse numbers (positions + font-size) whenever the circular
  // timeline canvia de mida — el wrapper té width/height: clamp(16rem, 34vw,
  // 22rem), per tant es comprimeix amb la finestra. Sense aquest observer,
  // els pulse-numbers queden posicionats i amb font-size del primer render.
  if (timeline && typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => {
      // renderPulseNumbers usa rAF internament i NO crea elements de flow
      // (els .pulse-number són position: absolute), així que no dispara
      // un loop d'observació.
      if (pulsosCompas !== null) renderPulseNumbers();
    });
    ro.observe(timeline);
  }

  // Move BPM to controls row (Play | BPM | Random | Reset) and move the
  // .controls element OUT of .timeline-wrapper so it doesn't inherit the
  // circular wrapper's absolute positioning (which would stack the buttons
  // at the center of the ring).
  const bpmParam = document.getElementById('bpmParam');
  const controls = document.querySelector('.controls');
  if (controls && bpmParam) {
    const playBtnEl = controls.querySelector('.play') || playBtn;
    const randomBtnEl = controls.querySelector('.random');
    const resetBtnEl = controls.querySelector('.reset');
    const randomMenuEl = controls.querySelector('.random-menu');

    while (controls.firstChild) controls.removeChild(controls.firstChild);

    if (playBtnEl) controls.appendChild(playBtnEl);
    controls.appendChild(bpmParam);
    if (randomBtnEl) controls.appendChild(randomBtnEl);
    if (randomMenuEl) controls.appendChild(randomMenuEl);
    if (resetBtnEl) controls.appendChild(resetBtnEl);

    // Move controls to be a sibling of timelineWrapper (below the ring).
    if (timelineWrapper?.parentNode && controls.parentNode === timelineWrapper) {
      timelineWrapper.parentNode.insertBefore(controls, timelineWrapper.nextSibling);
    }
  }

  // Create BPM controller
  bpmController = createBpmController({
    inputEl: document.getElementById('inputBpm'),
    upBtn: document.getElementById('bpmUp'),
    downBtn: document.getElementById('bpmDown'),
    container: document.getElementById('bpmParam'),
    min: MIN_BPM,
    max: MAX_BPM,
    defaultValue: DEFAULT_BPM
  });
  bpmController.attach();

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

  // Spinner buttons with auto-repeat (Compás only — Cycle has no spinners)
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

  // Idle caret flash on compás primary pill
  initIdleCaretFlash({ targets: [document.getElementById('inputCompas')?.closest('.pl-primary')] });
}

// Start initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
