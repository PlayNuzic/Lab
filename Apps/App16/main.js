/**
 * App16 - Módulo Temporal - Compás
 *
 * Enseña el concepto de aritmética modular en música.
 * Timeline d'un sol compás (2-12 pulsos) amb superíndex de cicle (notació Nuzic).
 */

import { createRhythmAudioInitializer, setupAudioDefaults, CHANNEL_TIERS, createMixerPersistence } from '../../libs/app-common/audio-init.js';
import { createSchedulingBridge, bindSharedSoundEvents } from '../../libs/app-common/audio.js';
import { createCircularTimeline } from '../../libs/app-common/circular-timeline.js';
import { initMixerMenu } from '../../libs/app-common/mixer-menu.js';
import { initRandomMenu } from '../../libs/random/index.js';
import { createPreferenceStorage, registerFactoryReset } from '../../libs/app-common/preferences.js';
import { showValidationWarning } from '../../libs/app-common/info-tooltip.js';
import { attachSpinnerRepeat } from '../../libs/app-common/spinner-repeat.js';
import { createCycleSuperscript } from '../../libs/app-common/cycle-superscript.js';
import { createBpmController } from '../../libs/app-common/bpm-controller.js';
import { initIdleCaretFlash } from '../../libs/app-common/idle-caret-flash.js';
import { createMeasureHeader } from '../../libs/shared-ui/measure-header.js';

// ============================================
// CONSTANTS
// ============================================

const MIN_COMPAS = 2;         // Mínim de pulsos per compás (manual i random)
const MAX_COMPAS = 12;        // Màxim de pulsos per compás (manual i random)
const DEFAULT_BPM = 90;
const MIN_BPM = 50;
const MAX_BPM = 150;

// ============================================
// STATE
// ============================================

let audio = null;
let bpmController = null;
let isPlaying = false;
let compas = null;            // Starts as null (empty input)
let pulses = [];              // DOM pulse elements
let p0Enabled = true;         // P0 toggle state (not persisted between sessions)

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

// ============================================
// STORAGE
// ============================================

const preferenceStorage = createPreferenceStorage({ prefix: 'app16', separator: '-' });

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

// Clau compartida entre la persistència del mixer i el factory reset
// (abans el reset referenciava una MIXER_STORAGE_KEY inexistent — ReferenceError).
const MIXER_STORAGE_KEY = 'app16-mixer';
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

let timelineController;
let superscriptController;
let measureHeader;

/**
 * Total de polsos visibles = el compás (un sol cicle).
 */
function getTotalPulses() {
  return compas ?? 0;
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

  // Create numbers for all visible pulses. The CSS shifts positions right
  // by the yellow "Com." rectangle width, so we feed the pulse percentage
  // into the `--pulse-left` custom property and let the stylesheet
  // combine it with the band offset.
  for (let i = 0; i < totalPulses; i++) {
    // createNumberElement ja marca `cycle-start` al pols 0 del cicle.
    const label = superscriptController.createNumberElement(i);
    const percent = (i / totalPulses) * 100;
    // Scale the pulse space to the visible track (100% - band width).
    label.style.setProperty('--pulse-left', `calc((100% - var(--com-band-w)) * ${percent / 100})`);
    timeline.appendChild(label);
  }

  // End marker: a centered dot at the far right of the visible track.
  const endLabel = document.createElement('div');
  endLabel.className = 'pulse-number cycle-start cycle-end';
  endLabel.textContent = '·';
  endLabel.style.setProperty('--pulse-left', 'calc(100% - var(--com-band-w))');
  endLabel.dataset.index = String(totalPulses);
  timeline.appendChild(endLabel);
}

/**
 * Remove all bars from timeline (obsolete visual endpoints)
 */
function removeBars() {
  if (!timeline) return;
  timeline.querySelector('.timeline-end-label')?.remove();
  timeline.querySelectorAll('.bar').forEach(b => b.remove());
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
    measureHeader?.render(null, 0);
    return;
  }

  // Render timeline with new pulse count
  pulses = timelineController.render(totalPulses, {
    isCircular: false,
    silent: true
  });

  // Remove all bars (obsolete visual endpoints)
  removeBars();

  // Render numbers
  renderPulseNumbers();

  // Render the "Com." measure header (un sol cicle)
  measureHeader?.render(compas, 1);
}


// ============================================
// HIGHLIGHTING
// ============================================

/**
 * Highlight del pols actiu — sobre els `.pulse-number` (els dots els amaga nuzic-theme)
 */
function highlightPulse(step) {
  timeline?.querySelectorAll('.pulse-number').forEach(n => n.classList.remove('active'));

  const numberEl = timeline?.querySelector(`.pulse-number[data-index="${step}"]`);
  if (numberEl) {
    numberEl.classList.add('active');
  }
}

function clearHighlights() {
  timeline?.querySelectorAll('.pulse-number').forEach(n => n.classList.remove('active'));
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

  // Update play button state
  playBtn?.classList.add('active');
  const iconPlay = playBtn?.querySelector('.icon-play');
  const iconStop = playBtn?.querySelector('.icon-stop');
  if (iconPlay) iconPlay.style.display = 'none';
  if (iconStop) iconStop.style.display = 'block';

  // Disable random button during playback
  if (randomBtn) randomBtn.disabled = true;

  const intervalSec = 60 / (bpmController?.getValue() || DEFAULT_BPM);
  const totalPulses = getTotalPulses();

  // Sistema Measure: P0 sona al pols 0 (inici de l'únic compás)
  audioInstance.configureMeasure(compas, totalPulses);
  audioInstance.setMeasureEnabled(p0Enabled);

  audioInstance.play(
    totalPulses,
    intervalSec,
    new Set(),    // No selected pulses
    false,        // NO loop (single-shot)
    (step) => {
      highlightPulse(step);
    },
    () => {
      // onComplete fires right after the worklet emits the final pulse, but
      // the scheduled click sample is still ringing out. Defer the stop just
      // long enough for the last click to finish.
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
}

// ============================================
// COMPÁS INPUT HANDLING
// ============================================

function handleCompasChange(newValue, opts = {}) {
  // `opts.lenient` marca una edició en curs (event 'input'): un "1" pot ser
  // el prefix de 10-12, així que no avisem ni esborrem res — la validació
  // estricta arriba al blur o al següent dígit.

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

  // Prefix possible de 10-12 mentre s'escriu: estat pendent (timeline buida).
  if (opts.lenient && parsed === 1) {
    compas = null;
    renderTimeline();
    return;
  }

  // Validate range with tooltips - clear input and keep focus on error
  if (parsed < MIN_COMPAS) {
    showValidationWarning(inputCompas, `El mínimo es <strong>${MIN_COMPAS}</strong>`, 2000);
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
  const current = compas ?? MIN_COMPAS - 1;   // primer clic des de buit → MIN_COMPAS
  if (current < MAX_COMPAS) {
    handleCompasChange(current + 1);
  }
}

function decrementCompas() {
  const current = compas ?? MIN_COMPAS + 1;   // primer clic des de buit → MIN_COMPAS
  if (current > MIN_COMPAS) {
    handleCompasChange(current - 1);
  }
}

// ============================================
// RANDOM
// ============================================

function handleRandom() {
  // Compás aleatori entre MIN_COMPAS i el "Compás máximo" del menú (mai >12).
  const maxCompasInput = parseInt(
    document.getElementById('randCompasMax')?.value || String(MAX_COMPAS),
    10
  );
  const max = Math.min(Math.max(maxCompasInput, MIN_COMPAS), MAX_COMPAS);
  const newCompas = Math.floor(Math.random() * (max - MIN_COMPAS + 1)) + MIN_COMPAS;

  handleCompasChange(newCompas);
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

  // Move BPM to controls row (Play | BPM | Random | Reset)
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

  // Insert the "Com." measure header above the timeline. Kept inside the
  // timeline-wrapper so the layout flow stays intact.
  if (timelineWrapper && timeline && !document.getElementById('measureHeader')) {
    const headerEl = document.createElement('section');
    headerEl.id = 'measureHeader';
    headerEl.className = 'measure-header is-empty';
    timelineWrapper.insertBefore(headerEl, timeline);
    measureHeader = createMeasureHeader({ container: headerEl, labelText: 'Compás' });
  }

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

  // Compás input events: tolerant mentre s'escriu, estricte al blur.
  inputCompas?.addEventListener('input', (e) => {
    handleCompasChange(e.target.value, { lenient: true });
  });

  inputCompas?.addEventListener('blur', () => {
    handleCompasChange(inputCompas.value);
  });

  // Spinner buttons with auto-repeat.
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

  // (L'estat del mixer es carrega via `mixerPersist.hydrate(audio)` a l'init
  // d'àudio; l'antic `setTimeout(loadMixerState, 50)` cridava una funció
  // inexistent — ReferenceError que avortava la resta de l'init.)

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

  // Register factory reset
  registerFactoryReset({
    storage: preferenceStorage,
    onBeforeReload: () => {
      stopPlayback();
      localStorage.removeItem('app16:p1Toggle');
      localStorage.removeItem(MIXER_STORAGE_KEY);
    }
  });

  // Listen for randCompasMax changes to save
  const randCompasMaxInput = document.getElementById('randCompasMax');
  randCompasMaxInput?.addEventListener('change', saveState);

  // Idle caret flash on compás circle
  initIdleCaretFlash({ targets: [document.getElementById('inputCompas')?.closest('.circle')] });
}

// Start initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
