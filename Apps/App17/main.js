/**
 * App17 - Módulo Temporal - Circular
 *
 * Timeline circular dinámica donde:
 * - Pulsos Compás define la longitud de la timeline (y el módulo aritmético)
 * - Cycle define cuántas veces se repite el módulo antes de parar
 */

import { createRhythmAudioInitializer, setupAudioDefaults, CHANNEL_TIERS, createMixerPersistence } from '../../libs/app-common/audio-init.js';
import { createSchedulingBridge, bindSharedSoundEvents } from '../../libs/app-common/audio.js';
import { initMixerMenu } from '../../libs/app-common/mixer-menu.js';
import { initRandomMenu } from '../../libs/random/index.js';
import { createPreferenceStorage, registerFactoryReset } from '../../libs/app-common/preferences.js';
import { showValidationWarning } from '../../libs/app-common/info-tooltip.js';
import { attachSpinnerRepeat } from '../../libs/app-common/spinner-repeat.js';
import { createCycleSuperscript } from '../../libs/app-common/cycle-superscript.js';
import { createTotalLengthDisplay } from '../../libs/app-common/total-length-display.js';
import { createBpmController } from '../../libs/app-common/bpm-controller.js';
import { initIdleCaretFlash } from '../../libs/app-common/idle-caret-flash.js';
import { renderCircularRingNumbers } from '../../libs/app-common/circular-timeline-ring.js';

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
// LH-01: `numberEls` és l'estat viu (els números del cercle); l'antic
// array `pulses` no es repoblava MAI (sempre []) i highlightPulse era un
// no-op permanent al callback de cada pols.
let numberEls = [];           // DOM .pulse-number elements (per índex)
let currentStep = -1;
let p0Enabled = true;         // P0 toggle state (not persisted between sessions)
let cycleHighlightTimeout = null;  // For auto-dimming cycle circle
let cycleHighlightEnabled = true;  // Cycle highlight toggle state
let autoJumpTimer = null;     // Timer for auto-jump from Compás to Cycle
const AUTO_JUMP_DELAY = 2000;  // Delay in ms before auto-jumping (ENTER salta a l'instant)

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
let totalLengthDigit;        // Pastilla "Longitud" (total) — fora del cercle
let centerCountDigit;        // Dígit del centre del donut — només conteig
let superscriptController;   // Shared module for cycle superscripts
let totalLengthController;   // Total (pastilla Longitud)
let centerCountController;   // Conteig de playback (centre del donut)

// ============================================
// STORAGE
// ============================================

const preferenceStorage = createPreferenceStorage({ prefix: 'app17', separator: '-' });
const MIXER_STORAGE_KEY = 'app17-mixer';

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

const mixerPersist = createMixerPersistence({ storageKey: MIXER_STORAGE_KEY });

async function initAudio() {
  if (!audio) {
    audio = await _baseInitAudio();
    if (audio) {
      setupAudioDefaults(audio, { channels: CHANNEL_TIERS.RHYTHM_ACCENT });
      mixerPersist.hydrate(audio);
      mixerPersist.subscribe(audio);
    }
    if (typeof window !== 'undefined') window.__labAudio = audio;
  }
  return audio;
}

if (typeof window !== 'undefined') {
  window.__labInitAudio = initAudio;
}

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
  numberEls = [];

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
 * Render pulse numbers on the circular timeline — el donut i la geometria viuen
 * al mòdul compartit `circular-timeline-ring.js` (reutilitzat per App1 en mode
 * loop). App17 hi posa el seu detall propi: el superíndex de mòdul `i¹`.
 * `numberEls` es manté com a estat viu per al highlight de playback.
 */
function renderPulseNumbers() {
  if (!timeline || pulsosCompas === null) return;
  numberEls = renderCircularRingNumbers(timeline, {
    count: pulsosCompas,
    label: (i) => `${i}<sup>1</sup>`
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
 * Cycle counter durant play: deshabilitat. Volem que la pastilla `cycle`
 * sigui un input pla — només mostra el valor que l'usuari ha entrat.
 * No swap d'input→dígit, no actualització del número durant la
 * reproducció. La funció es manté buida per no haver de tocar tots els
 * call-sites.
 */
function updateCycleCounter(_newCycle) {
  // No-op intencionat.
}

/**
 * Color del dígit per cicle: deshabilitat per evitar parpalleig
 * blau/taronja a cada pols (era confús). La pastilla manté el color
 * neutre durant play.
 */
function updateCycleDigitColor(_step) {
  // No-op intencionat — vegeu nota de `updateCycleCounter`.
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
  // El conteig de playback va al centre del donut (no a la pastilla Longitud).
  if (centerCountController) {
    centerCountController.updateGlobalStep(localStep, cycleNumber);
  }
}

/**
 * Reset total length display after playback stops
 * Delegates to shared totalLengthController module
 */
function resetTotalLengthDisplay() {
  // En aturar (fi de seqüència o stop de l'usuari) NO esborrem el conteig del
  // centre: deixem l'últim número visible. Només treiem el color de playback.
  // El botó Reset sí que el buida (vegeu handleReset).
  if (centerCountController) {
    centerCountController.clearPlayingColors();
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

let lastNumberEl = null;

function highlightNumber(pulseIndex) {
  // LH-01: referència directa per índex — abans dos querySelector(All) de
  // document per pols sobre uns elements que renderPulseNumbers ja tenia.
  if (lastNumberEl) lastNumberEl.classList.remove('active', 'active-zero');
  const numberEl = numberEls[pulseIndex] || null;
  if (numberEl) {
    numberEl.classList.add(pulseIndex === 0 ? 'active-zero' : 'active');
  }
  lastNumberEl = numberEl;
}

function highlightCycleCircle(_step) {
  // Halo per pols deshabilitat a propòsit — vegeu nota de
  // `updateCycleCounter`. Mantenim la funció (i el timeout cleanup) per
  // no haver de tocar tots els call-sites; netegem qualsevol classe
  // residual per si algun camí l'havia deixat aplicada.
  const cycleCircle = document.querySelector('.pl-secondary.cycle-circle');
  if (!cycleCircle) return;

  if (cycleHighlightTimeout) {
    clearTimeout(cycleHighlightTimeout);
    cycleHighlightTimeout = null;
  }
  cycleCircle.classList.remove('active', 'active-zero');
}

function clearHighlights() {
  numberEls.forEach(n => n.classList.remove('active', 'active-zero'));
  lastNumberEl = null;
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

  // Show cycle-1 superscripts on every pulse number from the first beat.
  if (superscriptController) superscriptController.updateAll(1);

  // Update play button state
  playBtn?.classList.add('active');

  // La pastilla `cycle` es manté com a input pla durant tota la
  // reproducció — no canviem a "digit mode" (vegeu nota a
  // `updateCycleCounter`).
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

  // El botó Reset SÍ que buida el conteig del centre a "--" (a diferència de
  // l'stop/fi de seqüència, que el manté).
  centerCountController?.reset();

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
        <span class="total-length__digit" id="centerCountDigit">--</span>
      </div>
    `;
    timelineWrapper.appendChild(totalLengthBlock);
  }
  // Pastilla "Longitud" (total) — viu a `.inputs` (index.html); el centre del
  // donut només fa el conteig de playback.
  totalLengthDigit = document.getElementById('totalLengthDigit');
  centerCountDigit = document.getElementById('centerCountDigit');

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

  // Pastilla "Longitud": mostra NOMÉS el total (pulsosCompas × cycles).
  totalLengthController = createTotalLengthDisplay({
    digitElement: totalLengthDigit,
    getTotal: () => (pulsosCompas && cycles) ? pulsosCompas * cycles : null,
    getPulsosPerCycle: () => pulsosCompas || 1
  });

  // Centre del donut: NOMÉS conteig de playback. `getTotal: () => null` fa que
  // showTotal()/reset() mostrin sempre "--" quan no es reprodueix.
  centerCountController = createTotalLengthDisplay({
    digitElement: centerCountDigit,
    getTotal: () => null,
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

  inputCompas?.addEventListener('keydown', (e) => {
    // ENTER confirma el compás i salta al cycle (com l'auto-salt, però immediat).
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (autoJumpTimer) { clearTimeout(autoJumpTimer); autoJumpTimer = null; }
    handleCompasChange(inputCompas.value);
    inputCycle?.focus();
    inputCycle?.select();
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
  });

  inputCycle?.addEventListener('keydown', (e) => {
    // ENTER confirma el cycle i treu el focus (sense autoplay).
    if (e.key !== 'Enter') return;
    e.preventDefault();
    handleCycleChange(inputCycle.value);
    inputCycle.blur();
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

  // Persistència del mixer: gestionada via createMixerPersistence dins initAudio

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
