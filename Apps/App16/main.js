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
import { attachSpinnerRepeat } from '../../libs/app-common/spinner-repeat.js';
import { createCycleSuperscript } from '../../libs/app-common/cycle-superscript.js';
import { createBpmController } from '../../libs/app-common/bpm-controller.js';
import { initIdleCaretFlash } from '../../libs/app-common/idle-caret-flash.js';
import { createMeasureHeader } from '../../libs/shared-ui/measure-header.js';

// ============================================
// CONSTANTS
// ============================================

const MAX_COMPAS = 7;         // Maximum compás value (manual input)
const MAX_COMPAS_RANDOM = 12; // Maximum compás value en mode random
const MIN_COMPAS_RANDOM = 2;  // Random no genera mai Compás=1
const DEFAULT_BPM = 90;
const MIN_BPM = 50;
const MAX_BPM = 150;

// Regla de cicles per random: a NºCompás més alt, menys cicles.
// Compás 9-12 → 1 cicle · Compás 4-8 → 2 cicles · Compás 2-3 → 3 cicles.
function cyclesForCompas(c) {
  if (c >= 9) return 1;
  if (c >= 4) return 2;
  return 3;
}

// ============================================
// STATE
// ============================================

let audio = null;
let bpmController = null;
let isPlaying = false;
let compas = null;            // Starts as null (empty input)
let cycles = 2;               // Nombre de cicles (compases) a reproduir; manual=2, random aplica `cyclesForCompas`
let pulses = [];              // DOM pulse elements
let currentStep = -1;
let p0Enabled = true;         // P0 toggle state (not persisted between sessions)

// Fade-out state
// Set FADE_OUT_PULSES to 0 to fully disable the post-cycle fade-out
// (audio tail + visual cycle-shift). All downstream logic (highlighting,
// measure-header applyFadeOut, volume ramp, totalSteps) collapses to a
// no-op when the value is 0 and can be re-enabled by restoring 3.
const FADE_OUT_PULSES = 0;

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
let superscriptController;
let measureHeader;

/**
 * Total de polsos = compás × cycles. `cycles` és 2 per defecte (manual);
 * el random l'ajusta via `cyclesForCompas`.
 */
function getTotalPulses() {
  if (compas === null || compas < 1) return 0;
  return compas * cycles;
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
    const label = superscriptController.createNumberElement(i);
    const percent = (i / totalPulses) * 100;
    // Scale the pulse space to the visible track (100% - band width).
    label.style.setProperty('--pulse-left', `calc((100% - var(--com-band-w)) * ${percent / 100})`);
    if (i % compas === 0) label.classList.add('cycle-start');
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

  // Render the "Com." measure header amb el mateix nombre de cicles que el timeline
  measureHeader?.render(compas, cycles);
}


// ============================================
// HIGHLIGHTING
// ============================================

/**
 * Highlight a pulse dot and optionally the endpoint bars
 */
function highlightPulse(step, isFadeOut = false) {
  // Highlight on .pulse-number elements (dots hidden by nuzic-theme)
  timeline?.querySelectorAll('.pulse-number').forEach(n => n.classList.remove('active'));

  const numberEl = timeline?.querySelector(`.pulse-number[data-index="${step}"]`);
  if (numberEl) {
    numberEl.classList.add('active');
  }
}

/**
 * Highlight a number using data-index selector (more reliable than array index)
 * During fade-out: ALL visible numbers change to cycle 3 at once when step 0 activates
 */
function highlightNumber(step, isFadeOut = false) {
  if (!timeline) return;

  // Clear previous fade-out state (not during fade-out phase)
  if (!isFadeOut) {
    timeline.querySelectorAll('.pulse-number').forEach(n => {
      n.classList.remove('fade-out', 'hidden');
    });
  }

  if (isFadeOut) {
    const numberEl = timeline.querySelector(`.pulse-number[data-index="${step}"]`);

    // On FIRST fade-out pulse (step 0): update ALL visible numbers at once
    if (step === 0) {
      // Measure header: shift cycle labels 1,2 → 3,4 to match the timeline
      measureHeader?.applyFadeOut(3);
      timeline.querySelectorAll('.pulse-number').forEach(n => {
        const idx = parseInt(n.dataset.index, 10);
        if (idx < FADE_OUT_PULSES) {
          const posInCycle = idx % compas;
          const fadeOutCycle = Math.floor(idx / compas) + 3;
          n.innerHTML = `${posInCycle}<sup>${fadeOutCycle}</sup>`;
        } else {
          n.classList.add('hidden');
        }
      });
    }

    if (numberEl) numberEl.classList.add('fade-out');
  }
}

function clearHighlights(keepFadeOut = false) {
  timeline?.querySelectorAll('.pulse-number').forEach(n => {
    n.classList.remove('active');
    if (!keepFadeOut) {
      n.classList.remove('fade-out', 'hidden');
    }
  });
  if (!keepFadeOut) measureHeader?.clearFadeOut();
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

  // Reset timeline to original state (clear any fade-out classes from previous play)
  renderPulseNumbers();
  measureHeader?.clearFadeOut();
  pulses.forEach(p => p.classList.remove('fade-out'));

  // Update play button state
  playBtn?.classList.add('active');
  const iconPlay = playBtn?.querySelector('.icon-play');
  const iconStop = playBtn?.querySelector('.icon-stop');
  if (iconPlay) iconPlay.style.display = 'none';
  if (iconStop) iconStop.style.display = 'block';

  // Disable random button during playback
  if (randomBtn) randomBtn.disabled = true;

  const intervalSec = 60 / (bpmController?.getValue() || DEFAULT_BPM);
  const totalPulses = getTotalPulses();  // compás × 2

  // Total steps = main pulses + fade-out pulses
  const totalSteps = totalPulses + FADE_OUT_PULSES;

  // Configure Measure system: P0 sounds at positions 0, compás, compás*2, etc.
  // Use totalSteps so fade-out pulses also get the P0 sound when appropriate
  audioInstance.configureMeasure(compas, totalSteps);
  audioInstance.setMeasureEnabled(p0Enabled);

  // Store original volume (captured once, used as fade reference)
  const originalVolume = getVolume();

  // Fade-out volumes as fractions of originalVolume so the cadence always
  // fades DOWN from the main-sequence level regardless of the user's master
  // volume setting. Fractions: 40%, 15%, 5%.
  const fadeVolumes = [originalVolume * 0.4, originalVolume * 0.15, originalVolume * 0.05];

  audioInstance.play(
    totalSteps,
    intervalSec,
    new Set(),    // No selected pulses
    false,        // NO loop (single-shot)
    (step) => {
      currentStep = step;

      // Visual feedback only (volume handled in onSchedule)
      const isFadeOut = step >= totalPulses;
      const displayStep = isFadeOut ? step - totalPulses : step;

      highlightPulse(displayStep, isFadeOut);
      highlightNumber(displayStep, isFadeOut);
    },
    () => {
      // onComplete fires right after the worklet emits the final pulse, but
      // the scheduled click sample is still ringing out at its fade volume.
      // Restoring master volume immediately would swap the tail of the last
      // click to full volume, making P2 sound LOUDER than P1.
      // Defer just long enough for the click to finish (~150ms), then
      // restore master so a quick replay captures the correct originalVolume.
      setTimeout(() => setVolume(originalVolume), 150);
      setTimeout(() => {
        audio?.stop();
        stopPlayback(false);
      }, 590);
    },
    {
      onSchedule: (step) => {
        // Fade starts AFTER the 3rd compás P0 (not on it)
        // P0 at totalPulses plays at full volume, matching compás 1 and 2
        if (step > totalPulses) {
          const fadeIndex = step - totalPulses - 1;
          setVolume(fadeVolumes[fadeIndex] ?? 0.1);
        } else if (step === 0 || step === totalPulses) {
          setVolume(originalVolume);
        }
      }
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

function handleCompasChange(newValue, opts = {}) {
  // `opts.cycles` permet al random fixar el nombre de cicles segons la
  // regla (`cyclesForCompas`). Si no es passa, els canvis manuals
  // (input/spinner/reset) tornen a 2 cicles, que és el comportament base.
  const nextCycles = opts.cycles ?? 2;
  // `opts.maxOverride` permet superar el límit manual (MAX_COMPAS=7) quan
  // el random escull valors fins a MAX_COMPAS_RANDOM=12.
  const effectiveMax = opts.maxOverride ?? MAX_COMPAS;

  // Handle empty input - clear timeline
  if (newValue === '' || newValue === null || newValue === undefined) {
    compas = null;
    cycles = 2;
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
  } else if (parsed > effectiveMax) {
    showValidationWarning(inputCompas, `El máximo es <strong>${effectiveMax}</strong>`, 2000);
    if (inputCompas) {
      inputCompas.value = '';
      inputCompas.focus();
    }
    return;
  } else {
    compas = parsed;
    cycles = nextCycles;
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

// Debounced auto-play comú per als canvis de `compas` (input, spinners,
// random). Si ja estem reproduint, atura i recomença amb el nou valor;
// si no, simplement inicia. El debounce evita stop+play en cascada
// quan l'usuari clica spinners ràpid o escriu múltiples dígits.
const AUTO_PLAY_DELAY = 250;
let autoPlayTimer = null;
function scheduleAutoPlay() {
  clearTimeout(autoPlayTimer);
  autoPlayTimer = setTimeout(() => {
    if (compas == null) return;
    if (isPlaying) {
      stopPlayback();
      requestAnimationFrame(() => handlePlay());
    } else {
      handlePlay();
    }
  }, AUTO_PLAY_DELAY);
}

function handleRandom() {
  // Regla interna del random:
  //   - Mai genera Compás=1 (mínim és 2).
  //   - Compás 9-12: 1 cicle · 4-8: 2 cicles · 2-3: 3 cicles
  //   (com més alt el compás, menys cicles per no allargar massa la seqüència).
  const maxCompasInput = parseInt(
    document.getElementById('randCompasMax')?.value || String(MAX_COMPAS_RANDOM),
    10
  );
  const min = MIN_COMPAS_RANDOM;
  const max = Math.min(Math.max(maxCompasInput, min), MAX_COMPAS_RANDOM);
  const newCompas = Math.floor(Math.random() * (max - min + 1)) + min;

  handleCompasChange(newCompas, {
    cycles: cyclesForCompas(newCompas),
    maxOverride: MAX_COMPAS_RANDOM
  });
  scheduleAutoPlay();
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

  // Compás input events. Després d'un canvi vàlid, `scheduleAutoPlay`
  // (a l'scope de mòdul, més amunt) dispara play amb un petit debounce.
  inputCompas?.addEventListener('input', (e) => {
    handleCompasChange(e.target.value);
    if (e.inputType === 'insertText' && /^[0-9]$/.test(e.data)) {
      scheduleAutoPlay();
    }
  });

  inputCompas?.addEventListener('blur', () => {
    handleCompasChange(inputCompas.value);
  });

  // Spinner buttons with auto-repeat. També disparen auto-play quan
  // l'usuari canvia el valor amb +/− (després d'un debounce perquè els
  // clicks consecutius no facin spam de stop+play).
  const compasUpWithAutoPlay = () => { incrementCompas(); scheduleAutoPlay(); };
  const compasDownWithAutoPlay = () => { decrementCompas(); scheduleAutoPlay(); };
  attachSpinnerRepeat(compasUpBtn, compasUpWithAutoPlay);
  attachSpinnerRepeat(compasDownBtn, compasDownWithAutoPlay);

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
