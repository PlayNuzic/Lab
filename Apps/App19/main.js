// App19: Plano Musical (Migrated to plano-modular)
// Uses libs/plano-modular for grid rendering

import { registerFactoryReset, createPreferenceStorage } from '../../libs/app-common/preferences.js';
import { attachHover } from '../../libs/shared-ui/hover.js';
import { createBpmController } from '../../libs/app-common/bpm-controller.js';
import { createCycleCounter } from '../../libs/app-common/cycle-counter.js';
import { attachSpinnerRepeat } from '../../libs/app-common/spinner-repeat.js';
import { createTapTempoHandler } from '../../libs/app-common/tap-tempo-handler.js';
import { createMelodicAudioInitializer } from '../../libs/app-common/audio-init.js';
import { setupPianoPreload, isPianoLoaded } from '../../libs/sound/piano.js';
import { isFluteLoaded } from '../../libs/sound/flute.js';
import { initMixerMenu } from '../../libs/app-common/mixer-menu.js';
import { subscribeMixer } from '../../libs/sound/index.js';
import { initRandomMenu } from '../../libs/random/menu.js';
import { initP1ToggleUI } from '../../libs/shared-ui/sound-dropdown.js';

// Import plano-modular (out of the box)
import { createApp19Grid } from '../../libs/plano-modular/index.js';
import { smoothScrollTo } from '../../libs/plano-modular/plano-scroll.js';
import { initIdleCaretFlash } from '../../libs/app-common/idle-caret-flash.js';

// ========== CONFIGURATION ==========
const CONFIG = {
  // Registry limits (4 registries: 3, 4, 5, 6)
  MIN_REGISTRO: 3,
  MAX_REGISTRO: 6,
  DEFAULT_REGISTRO: 4,

  // Compás limits
  MIN_COMPAS: 1,
  MAX_COMPAS: 7,
  DEFAULT_COMPAS: 4,

  // Nº Compases (cycles) limits
  MIN_CYCLES: 1,
  MAX_CYCLES: 4,
  DEFAULT_CYCLES: 3,

  // BPM limits
  MIN_BPM: 30,
  MAX_BPM: 300,
  DEFAULT_BPM: 100,

  // Grid display
  VISIBLE_PULSES: 12,
  NOTES_PER_REGISTRY: 12,
  MIDI_OFFSET: 12
};

// Screen definitions: 3 snap positions (bottom registry of each pair)
// Screen 0: "3 y 4" (bottom), Screen 1: "4 y 5", Screen 2: "5 y 6" (top)
// lastRow = last row index that must be visible at the bottom of the screen
const CELL_H = 26;  // Must match --plano-cell-height in styles.css
const HALF_CELL = CELL_H / 2;
const SCREENS = [
  { label: '3 y 4', firstRow: 27, lastRow: 47 },  // 0r3 (row 47) to 8r4 (row 27)
  { label: '4 y 5', firstRow: 12, lastRow: 35 },  // 0r4 (row 35) to 0r5 (row 23)
  { label: '5 y 6', firstRow: 0,  lastRow: 23 }   // 0r5 (row 23) to 11r6 (row 0)
];

// ========== STATE ==========
let isPlaying = false;
let audio = null;
let tapTempoHandler = null;
let mixerSaveTimeout = null;
let currentScreen = 0;  // Index into SCREENS array (starts at "3 y 4")

// Input values
let compas = null;      // null = empty, 1-7 = value
let cycles = null;      // null = empty, 1-4 = value

// Grid instance (plano-modular)
let grid = null;

// Mixer storage key
const MIXER_STORAGE_KEY = 'app19-mixer';

// ========== DOM ELEMENT REFERENCES ==========
let elements = {};

// ========== PREFERENCE STORAGE ==========
const preferenceStorage = createPreferenceStorage('app19');

// ========== AUDIO INITIALIZATION ==========
const _initAudio = createMelodicAudioInitializer({
  defaultInstrument: 'piano',
  getPreferences: () => preferenceStorage.load() || {}
});

async function initAudio() {
  if (!audio) {
    audio = await _initAudio();
  }
  return audio;
}

// ========== CONTROLLERS ==========

// BPM controller
let bpmController = null;

// Cycle counter (for playback display)
let cycleCounter = null;

// ========== HELPER FUNCTIONS ==========

/**
 * Calculate total pulses (Compás × Nº Compases)
 */
function getTotalPulses() {
  if (compas === null || cycles === null) return 0;
  return compas * cycles;
}

/**
 * Update the Longitud display
 */
function updateLongitud() {
  const total = getTotalPulses();
  if (elements.totalLengthDigit) {
    elements.totalLengthDigit.textContent = total > 0 ? total : '--';
  }
}

/**
 * Update cycle digit color based on current step
 * Blue on beat 0 of each cycle, orange otherwise
 */
function updateCycleDigitColor(step) {
  const digit = elements.cycleDigit;
  if (!digit || compas === null) return;

  digit.classList.remove('playing-zero', 'playing-active');
  digit.classList.add(step % compas === 0 ? 'playing-zero' : 'playing-active');
}

/**
 * Update total length display with flip animation
 * Shows current step (1-indexed) with color coding
 */
function updateTotalLengthDisplay(step) {
  const digit = elements.totalLengthDigit;
  if (!digit) return;

  // Flip animation
  digit.classList.add('flip-out');

  setTimeout(() => {
    digit.textContent = String(step + 1);  // 1-indexed display
    digit.classList.remove('flip-out');
    digit.classList.add('flip-in');

    // Color: blue if step 0, orange otherwise
    digit.classList.remove('playing-zero', 'playing-active');
    digit.classList.add(step === 0 ? 'playing-zero' : 'playing-active');

    setTimeout(() => {
      digit.classList.remove('flip-in');
    }, 150);
  }, 150);
}

/**
 * Update grid visibility based on whether we have data
 */
function updateGridVisibility() {
  const rightColumn = document.querySelector('.timeline-wrapper');
  if (rightColumn) {
    const visible = getTotalPulses() > 0;
    rightColumn.style.display = visible ? '' : 'none';
  }
}

// ========== GRID FUNCTIONS (using plano-modular) ==========

/**
 * Initialize the grid using plano-modular
 */
function initGrid() {
  const gridContainer = document.querySelector('.timeline-wrapper');
  if (!gridContainer) {
    console.error('Grid container not found');
    return;
  }

  // Clear the grid container
  gridContainer.innerHTML = '';

  grid = createApp19Grid({
    parent: gridContainer,
    columns: getTotalPulses() || 1,
    columnSizing: 'fr',
    cycleConfig: {
      compas: compas || 1,
      showCycle: true
    },
    bpm: bpmController?.getValue() || CONFIG.DEFAULT_BPM,
    defaultRegistry: CONFIG.DEFAULT_REGISTRO,
    registryConfig: {
      visibleRows: 24
    },
    onCellClick: handleCellClick,
    onSelectionChange: null  // Selections not persisted
  });

  // Free vertical scroll — native scroll with sync handled by setupScrollSync
  // (no quantization, no cooldown, no blocked wheel events)

  console.log('Grid initialized with plano-modular');
}

/**
 * Handle cell click from grid
 */
async function handleCellClick(rowData, _colIndex, isSelected) {
  if (isSelected) {
    // Play the note
    const audioInstance = await initAudio();
    if (audioInstance && rowData.midi) {
      const Tone = window.Tone;
      if (Tone) {
        const noteDuration = 0.3;
        audioInstance.playNote(rowData.midi, noteDuration, Tone.now());
      }
    }
  }
}

/**
 * Update grid when parameters change
 */
function updateGrid() {
  if (!grid) return;

  const totalPulses = getTotalPulses();
  if (totalPulses > 0) {
    grid.updateColumns(totalPulses);
    grid.setCompas(compas || 1);

    // Re-add dots after grid refresh (updateColumns rebuilds cells)
    addDotsToAllCells();

    // Apply initial scroll once the grid has real content
  }
}


/**
 * Scroll to a specific screen (quantized snap position).
 * @param {number} screenIndex - 0="3 y 4", 1="4 y 5", 2="5 y 6"
 * @param {boolean} animated - Use smooth scroll
 */
/**
 * Calculate scrollTop for a screen so that ALL its notes are visible:
 * - First note (top) fully visible at the top edge
 * - Last note (bottom) fully visible at the bottom edge
 * Notes use translateY(50%) so labels straddle the cell bottom border.
 */
function getScreenScrollTop(screen) {
  // Position so lastRow (0rN) is fully visible at the BOTTOM of the window
  const gridContainer = document.querySelector('.timeline-wrapper');
  const container = gridContainer?.querySelector('.plano-soundline-container');
  const visibleHeight = container?.clientHeight || (24 * CELL_H);
  const bottomEdge = (screen.lastRow + 1) * CELL_H + HALF_CELL;
  return Math.max(0, bottomEdge - visibleHeight);
}

const SCROLL_DURATION = 650;  // ms for screen transitions

function scrollToScreen(screenIndex, animated = false) {
  if (!grid) return;
  screenIndex = Math.max(0, Math.min(SCREENS.length - 1, screenIndex));
  currentScreen = screenIndex;

  const screen = SCREENS[screenIndex];
  const scrollTop = getScreenScrollTop(screen);
  const gridContainer = document.querySelector('.timeline-wrapper');
  const soundline = gridContainer?.querySelector('.plano-soundline-container');
  const matrix = gridContainer?.querySelector('.plano-matrix-container');

  if (animated) {
    // Custom easeInOut for gentle page-turn feel
    [soundline, matrix].forEach(el => {
      if (el) smoothScrollTo(el, scrollTop, 'top', SCROLL_DURATION, 'easeInOut');
    });
  } else {
    [soundline, matrix].forEach(el => {
      if (el) el.scrollTop = scrollTop;
    });
  }

  if (elements.registroText) {
    elements.registroText.value = screen.label;
  }
}

/**
 * Pre-compute a scroll plan for playback.
 * For each pulse, determines the minimum scrollTop needed to keep the note visible.
 * Returns an array of { step, scrollTop } only for steps that require scrolling.
 *
 * The algorithm:
 * 1. For each pulse with a note, get its rowIndex
 * 2. Check if the row is within the current visible window
 * 3. If not, scroll the minimum amount (row at top or bottom of window)
 * 4. Look ahead: if a scroll is needed, schedule it 1 pulse early
 */
function buildScrollPlan(selectedArray, rows) {
  const gridContainer = document.querySelector('.timeline-wrapper');
  const container = gridContainer?.querySelector('.plano-soundline-container');
  const visibleHeight = container?.clientHeight || (24 * CELL_H);

  // Number of full rows visible (accounting for translateY(50%) overhang)
  const margin = 2;  // keep 2 rows of margin so notes aren't right at the edge

  // Track the "virtual" scroll position through the sequence
  let currentTop = container?.scrollTop || 0;

  const plan = [];  // { step, scrollTop, duration }

  for (let step = 0; step < 1000; step++) {
    const sel = selectedArray.find(s => s.colIndex === step);
    if (!sel) continue;

    const rowIdx = rows.findIndex(r => r.id === sel.rowId);
    if (rowIdx === -1) continue;

    // The note's visual position (center of the label, accounting for translateY(50%))
    const noteTop = rowIdx * CELL_H;
    const noteBottom = noteTop + CELL_H + HALF_CELL;

    // Current visible window
    const windowTop = currentTop;
    const windowBottom = currentTop + visibleHeight;

    let newTop = currentTop;

    if (noteTop - margin * CELL_H < windowTop) {
      // Note is above visible window — scroll up
      newTop = Math.max(0, noteTop - margin * CELL_H);
    } else if (noteBottom + margin * CELL_H > windowBottom) {
      // Note is below visible window — scroll down
      newTop = noteBottom + margin * CELL_H - visibleHeight;
    }

    if (Math.abs(newTop - currentTop) > CELL_H / 2) {
      const distance = Math.abs(newTop - currentTop);
      // Duration proportional to distance: 300ms minimum, 800ms for full screen jumps
      const duration = Math.min(800, Math.max(300, distance * 1.2));

      plan.push({ step, scrollTop: newTop, duration });
      currentTop = newTop;
    }
  }

  // Apply look-ahead: shift each scroll 1 step earlier (if possible)
  return plan.map(entry => ({
    ...entry,
    step: Math.max(0, entry.step - 1)
  }));
}

// ========== INPUT HANDLERS ==========

/**
 * Handle Compás input change
 */
function handleCompasChange() {
  const value = elements.inputCompas?.value?.trim();

  if (value === '') {
    compas = null;
  } else {
    const num = parseInt(value, 10);
    if (!isNaN(num)) {
      compas = Math.max(CONFIG.MIN_COMPAS, Math.min(CONFIG.MAX_COMPAS, num));
      elements.inputCompas.value = compas;
      elements.inputCycle?.focus();
      elements.inputCycle?.select();
    }
  }

  updateLongitud();
  updateGridVisibility();
  updateGrid();
}

/**
 * Handle Nº Compases (cycles) input change
 */
function handleCyclesChange() {
  const value = elements.inputCycle?.value?.trim();

  if (value === '') {
    cycles = null;
  } else {
    const num = parseInt(value, 10);
    if (!isNaN(num)) {
      cycles = Math.max(CONFIG.MIN_CYCLES, Math.min(CONFIG.MAX_CYCLES, num));
      elements.inputCycle.value = cycles;
    }
  }

  if (elements.cycleDigit) {
    elements.cycleDigit.textContent = cycles !== null ? String(cycles) : '';
  }

  updateLongitud();
  updateGridVisibility();
  updateGrid();
}

// ========== PLAYBACK ==========

/**
 * Toggle playback
 */
async function togglePlayback() {
  if (isPlaying) {
    stopPlayback();
  } else {
    await startPlayback();
  }
}

/**
 * Start playback
 */
async function startPlayback() {
  // Check if current instrument is loaded (per-app key to match header writes)
  const currentInstrument = localStorage.getItem('app19:selectedInstrument') || 'piano';
  const isInstrumentLoaded = currentInstrument === 'flute' ? isFluteLoaded() : isPianoLoaded();

  // Show loading indicator if instrument not yet loaded
  const iconPlay = elements.playBtn?.querySelector('.icon-play');
  const iconStop = elements.playBtn?.querySelector('.icon-stop');
  let wasLoading = false;

  if (!isInstrumentLoaded && elements.playBtn) {
    wasLoading = true;
    elements.playBtn.disabled = true;
    if (iconPlay) iconPlay.style.opacity = '0.5';
  }

  const audioInstance = await initAudio();

  // Restore button state after loading
  if (wasLoading && elements.playBtn) {
    elements.playBtn.disabled = false;
    if (iconPlay) iconPlay.style.opacity = '1';
  }

  if (!audioInstance) return;

  const Tone = window.Tone;
  if (!Tone) return;

  const totalPulses = getTotalPulses();
  if (totalPulses === 0) return;

  const bpm = bpmController?.getValue() || CONFIG.DEFAULT_BPM;
  const intervalSec = 60 / bpm;

  // Get MIDI notes from grid selection
  const midiMap = grid.getSelectedMidiNotes();

  // Pre-compute scroll plan before playback starts
  const selectedArray = grid.getSelectedArray();
  const scrollPlan = buildScrollPlan(selectedArray, grid.getRowDefinitions());
  let scrollPlanIndex = 0;  // pointer into the plan

  isPlaying = true;
  elements.playBtn?.classList.add('playing');

  // Swap the cycle mini-pill to "digit mode" (hides input, shows cycleDigit).
  document.querySelector('.pl-secondary.cycle-circle')?.classList.add('playing');
  if (elements.cycleDigit) elements.cycleDigit.textContent = '1';

  // Switch to stop icon (iconPlay and iconStop already declared above)
  if (iconPlay) iconPlay.style.display = 'none';
  if (iconStop) iconStop.style.display = 'block';

  // Configure measure for P0 sound
  audioInstance.configureMeasure(compas, totalPulses);

  // Apply P0 toggle state
  const p0Enabled = window.__p1Controller?.getState() ?? true;
  audioInstance.setMeasureEnabled(p0Enabled);

  // Scroll to first pulse before starting playback
  grid.scrollToColumn(0, false);

  // Register note provider BEFORE play (declarative scheduling)
  audioInstance.registerNoteProvider('melody', (step) => {
    const midi = midiMap.get(step);
    if (midi !== undefined) {
      const noteDuration = intervalSec * 0.95;
      return [{ midi, duration: noteDuration, velocity: 0.8 }];
    }
    return null;
  });

  audioInstance.play(
    totalPulses,
    intervalSec,
    new Set(),
    false,  // No loop
    (step) => {
      // onPulse callback: visual feedback only

      // 1. Update playhead position
      grid.updatePlayhead(step);

      // 2. Autoscroll VERTICAL: execute pre-computed scroll plan
      while (scrollPlanIndex < scrollPlan.length && scrollPlan[scrollPlanIndex].step <= step) {
        const entry = scrollPlan[scrollPlanIndex];
        const gridContainer = document.querySelector('.timeline-wrapper');
        const soundline = gridContainer?.querySelector('.plano-soundline-container');
        const matrix = gridContainer?.querySelector('.plano-matrix-container');
        [soundline, matrix].forEach(el => {
          if (el) smoothScrollTo(el, entry.scrollTop, 'top', entry.duration, 'easeInOut');
        });
        scrollPlanIndex++;
      }

      // 3. Highlight timeline number
      grid.highlightTimelineNumber(step, intervalSec * 1000 * 0.9);

      // 4. Update cycle counter
      const cycleNum = Math.floor(step / compas) + 1;
      if (step === 0 && elements.cycleDigit) {
        elements.cycleDigit.textContent = '1';
      } else if (step > 0 && step % compas === 0) {
        if (cycleCounter) {
          cycleCounter.update(cycleNum);
        } else if (elements.cycleDigit) {
          elements.cycleDigit.textContent = String(cycleNum);
        }
      }

      // 6. Auto-scroll HORIZONTAL to keep pulse visible
      grid.scrollToColumn(step, false);

      // 7. Update cycle digit color
      updateCycleDigitColor(step);

      // 8. Update total length display with flip animation
      updateTotalLengthDisplay(step);
    },
    () => {
      // onComplete - delay stop to let the last note ring out
      // Wait 90% of the beat interval before stopping audio
      const bpm = bpmController?.getValue() || CONFIG.DEFAULT_BPM;
      const intervalSec = 60 / bpm;
      const lastNoteDelay = intervalSec * 0.9 * 1000;
      setTimeout(() => {
        stopPlayback();
      }, lastNoteDelay);
    }
  );
}

/**
 * Stop playback
 */
function stopPlayback() {
  isPlaying = false;
  elements.playBtn?.classList.remove('playing');

  // Switch back to play icon
  const iconPlay = elements.playBtn?.querySelector('.icon-play');
  const iconStop = elements.playBtn?.querySelector('.icon-stop');
  if (iconPlay) iconPlay.style.display = 'block';
  if (iconStop) iconStop.style.display = 'none';

  // audio.stop() internally calls samplerPool.stopAll() with fade-out
  audio?.stop();

  // Show input, hide cycle digit
  // Clear highlights
  grid?.clearHighlights();
  grid?.hidePlayhead();

  // Restore the cycle mini-pill to "input mode" (shows input, hides digit).
  document.querySelector('.pl-secondary.cycle-circle')?.classList.remove('playing');

  // Clear playback animation classes
  elements.cycleDigit?.classList.remove('playing-zero', 'playing-active', 'flip-out', 'flip-in');
  elements.totalLengthDigit?.classList.remove('playing-zero', 'playing-active', 'flip-out', 'flip-in');

  // Restore displays
  updateLongitud();
  if (elements.cycleDigit && cycles !== null) {
    elements.cycleDigit.textContent = String(cycles);
  }

  console.log('Playback stopped');
}

// ========== RANDOM ==========

function handleRandom() {
  const randCompasMax = parseInt(document.getElementById('randCompasMax')?.value) || CONFIG.MAX_COMPAS;
  const randCyclesMax = parseInt(document.getElementById('randCyclesMax')?.value) || CONFIG.MAX_CYCLES;
  const randBpmMin = parseInt(document.getElementById('randBpmMin')?.value) || CONFIG.MIN_BPM;
  const randBpmMax = parseInt(document.getElementById('randBpmMax')?.value) || CONFIG.MAX_BPM;

  // Random compás (1 to max)
  compas = Math.floor(Math.random() * randCompasMax) + 1;
  elements.inputCompas.value = compas;

  // Random cycles (1 to max)
  cycles = Math.floor(Math.random() * randCyclesMax) + 1;
  elements.inputCycle.value = cycles;
  if (elements.cycleDigit) {
    elements.cycleDigit.textContent = String(cycles);
  }

  // Random BPM
  const newBpm = Math.floor(Math.random() * (randBpmMax - randBpmMin + 1)) + randBpmMin;
  bpmController?.setValue(newBpm);

  // Clear selection and update grid
  grid?.clearSelection();
  updateLongitud();
  updateGridVisibility();
  updateGrid();

  // Generate random notes (one per pulse)
  // Rule: stay in the same registry for at least 3 notes before changing
  const totalPulses = compas * cycles;
  const selectableRegs = [3, 4, 5, 6];
  const MIN_NOTES_PER_REGISTRY = 3;

  let currentReg = selectableRegs[Math.floor(Math.random() * selectableRegs.length)];
  let notesInCurrentReg = 0;

  for (let pulse = 0; pulse < totalPulses; pulse++) {
    // After MIN_NOTES_PER_REGISTRY, allow registry change (50% chance)
    if (notesInCurrentReg >= MIN_NOTES_PER_REGISTRY && Math.random() < 0.5) {
      const otherRegs = selectableRegs.filter(r => r !== currentReg);
      currentReg = otherRegs[Math.floor(Math.random() * otherRegs.length)];
      notesInCurrentReg = 0;
    }

    const note = Math.floor(Math.random() * CONFIG.NOTES_PER_REGISTRY);
    const rowId = `${note}r${currentReg}`;
    grid?.selectCell(rowId, pulse);
    notesInCurrentReg++;
  }
}

// ========== RESET ==========

function handleReset() {
  // Stop playback if running
  if (isPlaying) {
    stopPlayback();
  }

  // Restore default values (not null — that would erase the grid)
  compas = CONFIG.DEFAULT_COMPAS;
  cycles = CONFIG.DEFAULT_CYCLES;

  elements.inputCompas.value = compas;
  elements.inputCycle.value = cycles;

  if (elements.cycleDigit) {
    elements.cycleDigit.textContent = String(cycles);
  }

  // Reset BPM to default
  bpmController?.setValue(CONFIG.DEFAULT_BPM);

  // Clear selection
  grid?.clearSelection();

  // Reset tap tempo if exists
  tapTempoHandler?.reset();

  updateLongitud();
  updateGridVisibility();
  updateGrid();

  // Reset registry (show registries 3 and 4) after grid is rebuilt
  scrollToScreen(0, false);

  console.log('Reset complete');
}

// ========== PREFERENCES ==========
// NOTE: App19 does NOT persist compas, cycles, or selections between sessions
// Only BPM is saved (via shared-ui header preferences)

function savePreferences() {
  // Only save BPM - compas, cycles and selections are NOT persisted
  preferenceStorage.save({
    bpm: bpmController?.getValue() || CONFIG.DEFAULT_BPM
  });
}

function loadPreferences() {
  const prefs = preferenceStorage.load();
  if (!prefs) return;

  // Only restore BPM - compas, cycles and selections start fresh
  if (prefs.bpm !== undefined && bpmController) {
    bpmController.setValue(prefs.bpm);
  }
}

// ========== EVENT HANDLERS SETUP ==========

// Helper functions for spinners
function incrementCompas() {
  if (compas === null) compas = 0;
  compas = Math.min(CONFIG.MAX_COMPAS, compas + 1);
  elements.inputCompas.value = compas;
  handleCompasChange();
}

function decrementCompas() {
  if (compas === null) return;
  compas = Math.max(CONFIG.MIN_COMPAS, compas - 1);
  elements.inputCompas.value = compas;
  handleCompasChange();
}

function incrementCycles() {
  if (cycles === null) cycles = 0;
  cycles = Math.min(CONFIG.MAX_CYCLES, cycles + 1);
  elements.inputCycle.value = cycles;
  handleCyclesChange();
}

function decrementCycles() {
  if (cycles === null) return;
  cycles = Math.max(CONFIG.MIN_CYCLES, cycles - 1);
  elements.inputCycle.value = cycles;
  handleCyclesChange();
}

/**
 * Detect current screen from actual scrollTop position
 * (needed because free scroll can move between screens without updating currentScreen)
 */
function detectCurrentScreen() {
  const gridContainer = document.querySelector('.timeline-wrapper');
  const container = gridContainer?.querySelector('.plano-soundline-container');
  if (!container) return currentScreen;

  const scrollTop = container.scrollTop;
  // Find the screen whose scrollTop is closest to current position
  let closest = 0;
  let minDist = Infinity;
  for (let i = 0; i < SCREENS.length; i++) {
    const target = getScreenScrollTop(SCREENS[i]);
    const dist = Math.abs(scrollTop - target);
    if (dist < minDist) {
      minDist = dist;
      closest = i;
    }
  }
  return closest;
}

function incrementRegistro() {
  currentScreen = detectCurrentScreen();
  if (currentScreen < SCREENS.length - 1) {
    scrollToScreen(currentScreen + 1, true);
  }
}

function decrementRegistro() {
  currentScreen = detectCurrentScreen();
  if (currentScreen > 0) {
    scrollToScreen(currentScreen - 1, true);
  }
}

function setupEventHandlers() {
  // Listen for instrument changes from dropdown (sharedui header)
  window.addEventListener('sharedui:instrument', async (e) => {
    const { instrument } = e.detail;
    console.log('Instrument changed to:', instrument);

    // Update audio instance if already initialized
    if (audio && audio.setInstrument) {
      await audio.setInstrument(instrument);
    }
    // Nota: El header ja guarda l'instrument a localStorage amb clau per-app
  });

  // Compás input with arrow keys
  elements.inputCompas?.addEventListener('input', handleCompasChange);
  elements.inputCompas?.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      incrementCompas();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      decrementCompas();
    } else if (e.key === 'Enter') {
      elements.inputCycle?.focus();
      elements.inputCycle?.select();
    }
  });

  // Compás spinners - correct API: attachSpinnerRepeat(element, callback)
  attachSpinnerRepeat(elements.compasUp, incrementCompas);
  attachSpinnerRepeat(elements.compasDown, decrementCompas);

  // Cycles input with arrow keys
  elements.inputCycle?.addEventListener('input', handleCyclesChange);
  elements.inputCycle?.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      incrementCycles();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      decrementCycles();
    }
  });

  // Cycles: no spinners — inputCycle is typed directly (App17 pattern:
  // the mini-pill sits inside the `.param--large--dual` yellow disc).

  // Registro spinners (no input — display only with up/down navigation)
  attachSpinnerRepeat(elements.registroUp, incrementRegistro);
  attachSpinnerRepeat(elements.registroDown, decrementRegistro);

  // Play button
  elements.playBtn?.addEventListener('click', togglePlayback);

  // Reset button
  elements.resetBtn?.addEventListener('click', handleReset);
}

// ========== HOVER LABELS ==========

function setupHovers() {
  attachHover(elements.inputCompas, 'Compás (pulsos por ciclo)');
  attachHover(elements.inputCycle, 'Nº de compases a tocar');
  attachHover(elements.registroText, 'Registros visibles (octavas)');
  attachHover(elements.inputBpm, 'Tempo en pulsos por minuto');
  attachHover(elements.playBtn, 'Reproducir / Detener');
  attachHover(elements.randomBtn, 'Valores aleatorios');
  attachHover(elements.resetBtn, 'Reiniciar valores');
}

// ========== FACTORY RESET ==========

registerFactoryReset({
  storage: preferenceStorage,
  onReset: () => {
    // Restore defaults (not null)
    compas = CONFIG.DEFAULT_COMPAS;
    cycles = CONFIG.DEFAULT_CYCLES;

    // Reset UI
    if (elements.inputCompas) elements.inputCompas.value = compas;
    if (elements.inputCycle) elements.inputCycle.value = cycles;
    if (elements.registroText) elements.registroText.value = '3 y 4';
    if (elements.cycleDigit) elements.cycleDigit.textContent = String(cycles);

    // Reset BPM
    bpmController?.setValue(CONFIG.DEFAULT_BPM);

    // Clear selections
    grid?.clearSelection();

    // Update displays
    updateLongitud();
    updateGridVisibility();
    updateGrid();

    // Reset registry after grid rebuild
    scrollToScreen(0, false);
  }
});

// ========== DOM BINDING ==========

function bindElements() {
  elements = {
    // Inputs
    inputCompas: document.getElementById('inputCompas'),
    inputCycle: document.getElementById('inputCycle'),
    registroText: document.getElementById('registroText'),
    inputBpm: document.getElementById('inputBpm'),

    // Spinners
    compasUp: document.getElementById('compasUp'),
    compasDown: document.getElementById('compasDown'),
    registroUp: document.getElementById('registroUp'),
    registroDown: document.getElementById('registroDown'),
    bpmUp: document.getElementById('bpmUp'),
    bpmDown: document.getElementById('bpmDown'),

    // Displays
    totalLengthDigit: document.getElementById('totalLengthDigit'),
    cycleDigit: document.getElementById('cycleDigit'),

    // Control buttons
    playBtn: document.getElementById('playBtn'),
    randomBtn: document.getElementById('randomBtn'),
    resetBtn: document.getElementById('resetBtn'),
    tapTempoBtn: document.getElementById('tapTempoBtn')
  };
}

function initApp() {
  console.log('Initializing App19: Plano Musical (Migrated)');

  // Setup piano preload in background (reduces latency on first play)
  setupPianoPreload({ delay: 300 });

  // Bind DOM elements
  bindElements();

  // Nota: L'instrument es carrega automàticament pel header des de localStorage

  // Initialize BPM controller
  if (elements.inputBpm && elements.bpmUp && elements.bpmDown) {
    bpmController = createBpmController({
      inputEl: elements.inputBpm,
      upBtn: elements.bpmUp,
      downBtn: elements.bpmDown,
      min: CONFIG.MIN_BPM,
      max: CONFIG.MAX_BPM,
      defaultValue: CONFIG.DEFAULT_BPM,
      onChange: (bpm) => {
        console.log('BPM changed to:', bpm);
        if (grid) grid.setBpm(bpm);
        if (isPlaying && audio) audio.setTempo(bpm);
        savePreferences();
      }
    });
    bpmController.attach();
  }

  // Initialize cycle counter
  if (elements.cycleDigit) {
    cycleCounter = createCycleCounter({ element: elements.cycleDigit });
  }

  // Initialize P1 Toggle
  const startIntervalToggle = document.getElementById('startIntervalToggle');
  const startSoundRow = document.querySelector('.interval-select-row');
  if (startIntervalToggle && startSoundRow) {
    window.__p1Controller = initP1ToggleUI({
      checkbox: startIntervalToggle,
      startSoundRow,
      storageKey: 'app19:p1Toggle',
      onChange: async (enabled) => {
        const audioInstance = await initAudio();
        if (audioInstance?.setMeasureEnabled) {
          audioInstance.setMeasureEnabled(enabled);
        }
      }
    });
  }

  // Initialize tap tempo
  if (elements.tapTempoBtn) {
    tapTempoHandler = createTapTempoHandler({
      getAudioInstance: initAudio,
      tapBtn: elements.tapTempoBtn,
      tapHelp: null,
      onBpmDetected: (newBpm) => {
        const clampedBpm = Math.min(CONFIG.MAX_BPM, Math.max(CONFIG.MIN_BPM, Math.round(newBpm)));
        bpmController?.setValue(clampedBpm);
        savePreferences();
      }
    });
    tapTempoHandler.attach();
    elements.tapTempoBtn.style.display = '';
  }

  // Mixer integration
  const mixerMenu = document.getElementById('mixerMenu');
  if (mixerMenu && elements.playBtn) {
    // Get initial instrument label (per-app key to match header writes)
    const initialInstrument = localStorage.getItem('app19:selectedInstrument') || 'piano';
    const instrumentLabel = initialInstrument === 'flute' ? 'Flauta' : 'Piano';

    initMixerMenu({
      menu: mixerMenu,
      triggers: [elements.playBtn],
      channels: [
        { id: 'pulse', label: 'Pulso', allowSolo: true },
        { id: 'instrument', label: instrumentLabel, allowSolo: true },
        { id: 'master', label: 'Master', allowSolo: false, isMaster: true }
      ]
    });

    subscribeMixer((snapshot) => {
      clearTimeout(mixerSaveTimeout);
      mixerSaveTimeout = setTimeout(() => {
        localStorage.setItem(MIXER_STORAGE_KEY, JSON.stringify(snapshot));
      }, 100);
    });

    loadMixerState();
  }

  // Random menu
  const randomMenu = document.getElementById('randomMenu');
  if (elements.randomBtn && randomMenu) {
    initRandomMenu(elements.randomBtn, randomMenu, handleRandom);
  }

  // Setup event handlers
  setupEventHandlers();

  // Setup hover labels
  setupHovers();

  // Load saved preferences FIRST (to get BPM)
  loadPreferences();

  // Set default Compás=4 and Nº Compases=3 so the grid starts pre-created
  compas = 4;
  cycles = 3;
  if (elements.inputCompas) elements.inputCompas.value = compas;
  if (elements.inputCycle) elements.inputCycle.value = cycles;
  if (elements.cycleDigit) elements.cycleDigit.textContent = String(cycles);

  // Move BPM to controls row (Play | BPM | Random | Reset)
  const bpmParam = document.getElementById('bpmParam');
  const controls = document.querySelector('.controls');
  if (controls && bpmParam) {
    const playBtnEl = controls.querySelector('.play') || elements.playBtn;
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

  // Save controls before initGrid clears .timeline-wrapper
  const savedControls = controls?.parentNode === document.querySelector('.timeline-wrapper')
    ? controls : null;
  if (savedControls) savedControls.remove();

  // Initialize the grid (plano-modular)
  initGrid();

  // Re-add controls after plano-container
  if (savedControls) {
    document.querySelector('.timeline-wrapper')?.appendChild(savedControls);
  }

  // Initial renders
  updateLongitud();
  updateGridVisibility();

  // Position to screen "3 y 4" AFTER the preset's setRegistry(4) has completed.
  // The preset uses setTimeout(0)+rAF, so we use a longer delay to run after it.
  setTimeout(() => {
    requestAnimationFrame(() => {
      scrollToScreen(0, false);
    });
  }, 100);

  // No initial focus — user decides where to start
  initIdleCaretFlash({ targets: [document.getElementById('registroParam')?.querySelector('.circle')] });
  console.log('App19 initialized (Migrated to plano-modular)');
}

function loadMixerState() {
  try {
    const saved = localStorage.getItem(MIXER_STORAGE_KEY);
    if (!saved) return;
    const state = JSON.parse(saved);

    if (window.NuzicMixer) {
      if (state.master !== undefined && window.NuzicMixer.setMasterVolume) {
        window.NuzicMixer.setMasterVolume(state.master);
      }
      ['pulse', 'instrument'].forEach(ch => {
        if (state[ch]) {
          window.NuzicMixer.setChannelVolume?.(ch, state[ch].volume ?? 1);
          window.NuzicMixer.setChannelMute?.(ch, state[ch].muted ?? false);
        }
      });
    }
  } catch (e) {
    console.warn('Failed to load mixer state:', e);
  }
}

// Execute when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
