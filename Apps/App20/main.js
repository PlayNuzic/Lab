// App20: Plano y sucesión N-iT
// Grid 2D (plano-modular) + zigzag grid-editor for NrX-iT sequences

import { registerFactoryReset, createPreferenceStorage } from '../../libs/app-common/preferences.js';
import { attachHover } from '../../libs/shared-ui/hover.js';
import { createBpmController } from '../../libs/app-common/bpm-controller.js';
import { createCycleCounter } from '../../libs/app-common/cycle-counter.js';
import { attachSpinnerRepeat } from '../../libs/app-common/spinner-repeat.js';
import { createTapTempoHandler } from '../../libs/app-common/tap-tempo-handler.js';
import { createMelodicAudioInitializer } from '../../libs/app-common/audio-init.js';
import { setupPianoPreload, isPianoLoaded } from '../../libs/sound/piano.js';
import { isViolinLoaded } from '../../libs/sound/violin.js';
import { initMixerMenu } from '../../libs/app-common/mixer-menu.js';
import { subscribeMixer } from '../../libs/sound/index.js';
import { initRandomMenu } from '../../libs/random/menu.js';
import { initP1ToggleUI } from '../../libs/shared-ui/sound-dropdown.js';

// Import plano-modular (out of the box)
import { createApp19Grid } from '../../libs/plano-modular/index.js';

// Import grid-editor for NrX-iT input
import { createGridEditor } from '../../libs/matrix-seq/index.js';

// ========== CONFIGURATION ==========
const CONFIG = {
  // Registry limits (3 registries: 3, 4, 5)
  MIN_REGISTRO: 3,
  MAX_REGISTRO: 5,
  DEFAULT_REGISTRO: 4,

  // Compás limits
  MIN_COMPAS: 1,
  MAX_COMPAS: 7,

  // Nº Compases (cycles) limits
  MIN_CYCLES: 1,
  MAX_CYCLES: 4,

  // BPM limits
  MIN_BPM: 30,
  MAX_BPM: 300,
  DEFAULT_BPM: 100,

  // Grid display
  VISIBLE_PULSES: 12,
  NOTES_PER_REGISTRY: 12,
  MIDI_OFFSET: 12
};

// ========== AUTOSCROLL VERTICAL HELPERS ==========

/**
 * Build a map of pulse → optimal registry for vertical autoscroll
 * During playback, this determines which registry to show for each note
 * @param {Array} selectedArray - From grid.getSelectedArray()
 * @returns {Object} Map of pulseIndex → registryId
 */
function buildPulseRegistryMap(selectedArray) {
  const TOTAL_VISIBLE = 15;
  const ZERO_POS = 7;
  const pulseRegistry = {};

  // Helper: Get all registries where a note would be visible
  function getVisibleRegistries(noteNum, noteReg) {
    const visibleIn = [];
    for (let testReg = CONFIG.MIN_REGISTRO; testReg <= CONFIG.MAX_REGISTRO; testReg++) {
      for (let visualIdx = 0; visualIdx < TOTAL_VISIBLE; visualIdx++) {
        const offset = visualIdx - ZERO_POS;
        let checkNote, checkReg;
        if (offset < 0) {
          const absOffset = Math.abs(offset);
          checkNote = (CONFIG.NOTES_PER_REGISTRY - absOffset % CONFIG.NOTES_PER_REGISTRY) % CONFIG.NOTES_PER_REGISTRY;
          checkReg = testReg - Math.ceil(absOffset / CONFIG.NOTES_PER_REGISTRY);
          if (absOffset % CONFIG.NOTES_PER_REGISTRY === 0) {
            checkNote = 0;
            checkReg = testReg - (absOffset / CONFIG.NOTES_PER_REGISTRY) + 1;
          }
        } else {
          checkNote = offset % CONFIG.NOTES_PER_REGISTRY;
          checkReg = testReg + Math.floor(offset / CONFIG.NOTES_PER_REGISTRY);
        }
        if (checkNote === noteNum && checkReg === noteReg) {
          visibleIn.push(testReg);
          break;
        }
      }
    }
    return visibleIn;
  }

  // Count notes visible per registry
  const registryCounts = { 3: 0, 4: 0, 5: 0 };
  const notesInfo = selectedArray.map(item => {
    // Parse rowId: "5r4" → note=5, reg=4
    const match = item.rowId.match(/^(\d+)r(\d+)$/);
    if (!match) return null;
    const noteNum = parseInt(match[1]);
    const noteReg = parseInt(match[2]);
    const visibleIn = getVisibleRegistries(noteNum, noteReg);
    for (const r of visibleIn) registryCounts[r]++;
    return { noteNum, noteReg, pulseIndex: item.colIndex, visibleIn };
  }).filter(Boolean);

  // For each note, pick the registry with most visible notes
  for (const info of notesInfo) {
    if (info.visibleIn.length === 0) {
      pulseRegistry[info.pulseIndex] = info.noteReg;
    } else if (info.visibleIn.length === 1) {
      pulseRegistry[info.pulseIndex] = info.visibleIn[0];
    } else {
      let bestReg = info.visibleIn[0];
      let bestCount = registryCounts[bestReg];
      for (const r of info.visibleIn) {
        if (registryCounts[r] > bestCount) {
          bestCount = registryCounts[r];
          bestReg = r;
        }
      }
      pulseRegistry[info.pulseIndex] = bestReg;
    }
  }
  return pulseRegistry;
}

// ========== STATE ==========
let isPlaying = false;
let audio = null;
let tapTempoHandler = null;
let mixerSaveTimeout = null;
let isInitialized = false;  // Flag to track if initial scroll to default registry has been applied

// Input values
let compas = null;      // null = empty, 1-7 = value
let cycles = null;      // null = empty, 1-4 = value

// Grid instance (plano-modular)
let grid = null;

// Grid editor instance (NrX-iT zigzag)
let gridEditor = null;

// Mixer storage key
const MIXER_STORAGE_KEY = 'app20-mixer';

// ========== DOM ELEMENT REFERENCES ==========
let elements = {};

// ========== PREFERENCE STORAGE ==========
const preferenceStorage = createPreferenceStorage('app20');

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
  const rightColumn = document.getElementById('rightColumn');
  if (rightColumn) {
    const visible = getTotalPulses() > 0;
    rightColumn.style.display = visible ? '' : 'none';
  }
}

// ========== GRID FUNCTIONS (using plano-modular) ==========

/**
 * Sync Grid 2D from grid-editor pairs (Editor → Grid 2D)
 * Called when user edits the NrX-iT zigzag editor
 * @param {Array} pairs - Array of { note, registry, pulse, temporalInterval }
 */
function syncGridFromPairs(pairs) {
  if (!grid) return;

  // Clear existing selection
  grid.clearSelection();

  // Select cells based on pairs
  pairs.forEach(pair => {
    if (pair.note === null || pair.note === undefined) return;
    if (pair.registry === null || pair.registry === undefined) return;

    // Build rowId: "NrR" format (e.g., "5r4")
    const rowId = `${pair.note}r${pair.registry}`;
    grid.selectCell(rowId, pair.pulse);
  });

  console.log('Grid synced from pairs:', pairs.length, 'notes');
}

/**
 * Initialize the grid using plano-modular
 */
function initGrid() {
  const gridContainer = document.getElementById('rightColumn');
  if (!gridContainer) {
    console.error('Grid container not found');
    return;
  }

  // Clear existing content (if any legacy elements exist)
  const soundlineContainer = document.getElementById('soundlineContainer');
  const gridArea = document.getElementById('gridArea');
  soundlineContainer?.remove();
  gridArea?.remove();

  // Clear the grid container
  gridContainer.innerHTML = '';

  grid = createApp19Grid({
    parent: gridContainer,
    columns: getTotalPulses() || 1,
    cycleConfig: {
      compas: compas || 1,
      showCycle: true
    },
    bpm: bpmController?.getValue() || CONFIG.DEFAULT_BPM,
    defaultRegistry: CONFIG.DEFAULT_REGISTRO,
    onCellClick: handleCellClick,
    onSelectionChange: null  // Selections not persisted
  });

  console.log('Grid initialized with plano-modular');
}

/**
 * Handle cell click from grid (Grid 2D → Editor sync)
 * When user clicks on Grid 2D, we need to update the grid-editor
 */
async function handleCellClick(rowData, colIndex, isSelected) {
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

    // Sync to grid-editor: parse rowId to get note and registry
    const match = rowData.id.match(/^(\d+)r(\d+)$/);
    if (match && gridEditor) {
      const note = parseInt(match[1]);
      const registry = parseInt(match[2]);

      // Get current pairs from editor
      const currentPairs = gridEditor.getPairs();

      // Check if this pulse already has a note
      const existingIndex = currentPairs.findIndex(p => p.pulse === colIndex);

      if (existingIndex >= 0) {
        // Update existing pair
        currentPairs[existingIndex] = {
          ...currentPairs[existingIndex],
          note,
          registry
        };
      } else {
        // Add new pair - calculate temporalInterval from previous note
        let temporalInterval = 1;
        if (currentPairs.length > 0) {
          const lastPair = currentPairs[currentPairs.length - 1];
          const lastPulse = lastPair.pulse + (lastPair.temporalInterval || 1);
          temporalInterval = colIndex - lastPulse + 1;
          if (temporalInterval < 1) temporalInterval = 1;
        }

        currentPairs.push({
          note,
          registry,
          pulse: colIndex,
          temporalInterval
        });
      }

      // Sort by pulse
      currentPairs.sort((a, b) => a.pulse - b.pulse);

      // Update editor
      gridEditor.setPairs(currentPairs);
    }
  } else {
    // Cell was deselected - remove from grid-editor
    if (gridEditor) {
      const currentPairs = gridEditor.getPairs();
      const updatedPairs = currentPairs.filter(p => p.pulse !== colIndex);
      gridEditor.setPairs(updatedPairs);
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

    // Apply initial scroll once the grid has real content
    maybeApplyInitialScroll();
  }
}

/**
 * Initialize the grid-editor for NrX-iT input
 */
function initGridEditor() {
  if (!elements.gridEditorContainer) {
    console.warn('Grid editor container not found');
    return;
  }

  gridEditor = createGridEditor({
    container: elements.gridEditorContainer,
    mode: 'nrx-it',
    noteRange: [0, 11],
    pulseRange: [0, getTotalPulses() || 28],  // Max 7*4 = 28 pulses
    maxPairs: 28,
    nrxModeOptions: {
      registryRange: [CONFIG.MIN_REGISTRO, CONFIG.MAX_REGISTRO],
      maxTotalPulse: getTotalPulses() || 28
    },
    onPairsChange: (pairs) => {
      // Sync Grid 2D when editor changes
      syncGridFromPairs(pairs);
    }
  });

  console.log('Grid editor initialized in NrX-iT mode');
}

/**
 * Update grid-editor maxTotalPulse when Compás/Cycles change
 */
function updateGridEditorMaxPulse() {
  const totalPulses = getTotalPulses();
  if (totalPulses > 0 && elements.gridEditorContainer) {
    // Save current pairs before re-initializing
    const currentPairs = gridEditor ? gridEditor.getPairs() : [];

    // Re-initialize with updated maxTotalPulse
    gridEditor = createGridEditor({
      container: elements.gridEditorContainer,
      mode: 'nrx-it',
      noteRange: [0, 11],
      pulseRange: [0, totalPulses],
      maxPairs: totalPulses,
      nrxModeOptions: {
        registryRange: [CONFIG.MIN_REGISTRO, CONFIG.MAX_REGISTRO],
        maxTotalPulse: totalPulses
      },
      onPairsChange: (pairs) => {
        syncGridFromPairs(pairs);
      }
    });

    // Restore pairs (if they fit within new max)
    if (currentPairs.length > 0) {
      const validPairs = currentPairs.filter(p => p.pulse < totalPulses);
      if (validPairs.length > 0) {
        gridEditor.setPairs(validPairs);
      }
    }
  }
}

/**
 * Apply the initial scroll to the default registry once the grid exists and has content.
 * This runs only once, after the first meaningful render (when pulses > 0).
 */
function maybeApplyInitialScroll() {
  if (isInitialized) return;

  const totalPulses = getTotalPulses();
  if (!grid || totalPulses === 0) return;

  // Use requestAnimationFrame to ensure DOM is rendered
  requestAnimationFrame(() => {
    grid.setRegistry(CONFIG.DEFAULT_REGISTRO, false);
    isInitialized = true;
  });
}

/**
 * Scroll to a specific registry
 */
function scrollToRegistry(targetRegistry, animated = false) {
  if (grid) {
    grid.setRegistry(targetRegistry, animated);
  }
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
  updateGridEditorMaxPulse();
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
  updateGridEditorMaxPulse();
}

// Registry handling removed - now entered via grid-editor NrX cells

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
  // Check if current instrument is loaded (read from shared localStorage key)
  const currentInstrument = localStorage.getItem('selectedInstrument') || 'piano';
  const isInstrumentLoaded = currentInstrument === 'violin' ? isViolinLoaded() : isPianoLoaded();

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

  // Build pulse → registry map for vertical autoscroll
  const pulseRegistry = buildPulseRegistryMap(grid.getSelectedArray());

  isPlaying = true;
  elements.playBtn?.classList.add('playing');

  // Switch to stop icon (iconPlay and iconStop already declared above)
  if (iconPlay) iconPlay.style.display = 'none';
  if (iconStop) iconStop.style.display = 'block';

  // Configure measure for P0 sound
  audioInstance.configureMeasure(compas, totalPulses);

  // Apply P0 toggle state
  const p0Enabled = window.__p1Controller?.getState() ?? true;
  audioInstance.setMeasureEnabled(p0Enabled);

  // Hide input, show cycle digit
  const cycleCircle = document.querySelector('.cycle-circle');
  cycleCircle?.classList.add('playing');

  // Scroll to first pulse before starting playback
  grid.scrollToColumn(0, false);

  audioInstance.play(
    totalPulses,
    intervalSec,
    new Set(),
    false,  // No loop
    (step) => {
      // 1. Update playhead position
      grid.updatePlayhead(step);

      // 2. Autoscroll VERTICAL: switch to registry of current note
      if (pulseRegistry[step] !== undefined) {
        grid.setRegistry(pulseRegistry[step], true);  // animated=true
      }

      // 3. Highlight timeline number
      grid.highlightTimelineNumber(step, intervalSec * 1000 * 0.9);

      // 4. Find note for this pulse and highlight/play
      const midi = midiMap.get(step);
      if (midi !== undefined) {
        const noteDuration = intervalSec * 0.95;
        audioInstance.playNote(midi, noteDuration, Tone.now());

        // Find and highlight the selected cell
        const selected = grid.getSelectedArray().find(s => s.colIndex === step);
        if (selected) {
          grid.highlightCell(selected.rowId, step, intervalSec * 1000 * 0.9);
        }
      }

      // 5. Anticipate registry change for NEXT pulse (after 75% of beat)
      const nextPulse = step + 1;
      if (pulseRegistry[nextPulse] !== undefined && nextPulse < totalPulses) {
        const registryChangeDelay = intervalSec * 1000 * 0.75;
        setTimeout(() => {
          if (isPlaying) {
            grid.setRegistry(pulseRegistry[nextPulse], true);
          }
        }, registryChangeDelay);
      }

      // 6. Update cycle counter
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

      // 7. Auto-scroll HORIZONTAL to keep pulse visible
      grid.scrollToColumn(step, false);

      // 8. Update cycle digit color
      updateCycleDigitColor(step);

      // 9. Update total length display with flip animation
      updateTotalLengthDisplay(step);
    },
    () => {
      // onComplete
      setTimeout(() => {
        stopPlayback();
      }, 590);
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

  audio?.stop();

  // Show input, hide cycle digit
  const cycleCircle = document.querySelector('.cycle-circle');
  cycleCircle?.classList.remove('playing');

  // Clear highlights
  grid?.clearHighlights();
  grid?.hidePlayhead();

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

  // Generate random NrX-iT sequence
  const totalPulses = compas * cycles;
  const selectableRegs = [CONFIG.MIN_REGISTRO, CONFIG.DEFAULT_REGISTRO, CONFIG.MAX_REGISTRO];
  const pairs = [];

  // Generate random number of notes (between 1 and totalPulses)
  const numNotes = Math.floor(Math.random() * Math.min(totalPulses, 8)) + 1;

  let accumulatedPulse = 0;
  for (let i = 0; i < numNotes && accumulatedPulse < totalPulses; i++) {
    // Random note (0-11)
    const note = Math.floor(Math.random() * CONFIG.NOTES_PER_REGISTRY);
    // Random registry from selectable ones
    const registry = selectableRegs[Math.floor(Math.random() * selectableRegs.length)];
    // Random temporal interval (1 to remaining pulses, max 4)
    const remainingPulses = totalPulses - accumulatedPulse;
    const maxIT = Math.min(4, remainingPulses);
    const temporalInterval = Math.floor(Math.random() * maxIT) + 1;

    pairs.push({
      note,
      registry,
      pulse: accumulatedPulse,
      temporalInterval
    });

    accumulatedPulse += temporalInterval;
  }

  // Update grid-editor with generated pairs
  if (gridEditor) {
    gridEditor.setPairs(pairs);
  }

  // Sync Grid 2D from pairs
  syncGridFromPairs(pairs);
}

// ========== RESET ==========

function handleReset() {
  // Stop playback if running
  if (isPlaying) {
    stopPlayback();
  }

  // Clear all inputs
  compas = null;
  cycles = null;

  elements.inputCompas.value = '';
  elements.inputCycle.value = '';

  if (elements.cycleDigit) {
    elements.cycleDigit.textContent = '';
  }

  // Reset BPM to default
  bpmController?.setValue(CONFIG.DEFAULT_BPM);

  // Reset registry
  scrollToRegistry(CONFIG.DEFAULT_REGISTRO, false);

  // Clear grid-editor
  gridEditor?.clear();

  // Clear selection on Grid 2D
  grid?.clearSelection();

  // Reset tap tempo if exists
  tapTempoHandler?.reset();

  updateLongitud();
  updateGridVisibility();
  updateGrid();

  elements.inputCompas?.focus();
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

function setupEventHandlers() {
  // Listen for instrument changes from dropdown (sharedui header)
  // Note: The header already saves to localStorage.selectedInstrument
  window.addEventListener('sharedui:instrument', async (e) => {
    const { instrument } = e.detail;
    console.log('Instrument changed to:', instrument);

    // Update audio instance if already initialized
    if (audio && audio.setInstrument) {
      await audio.setInstrument(instrument);
    }
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

  // Cycles spinners - correct API: attachSpinnerRepeat(element, callback)
  attachSpinnerRepeat(elements.cycleUp, incrementCycles);
  attachSpinnerRepeat(elements.cycleDown, decrementCycles);

  // Registry buttons removed - now entered via grid-editor

  // Play button
  elements.playBtn?.addEventListener('click', togglePlayback);

  // Reset button
  elements.resetBtn?.addEventListener('click', handleReset);
}

// ========== HOVER LABELS ==========

function setupHovers() {
  attachHover(elements.inputCompas, 'Compás (pulsos por ciclo)');
  attachHover(elements.inputCycle, 'Nº de compases a tocar');
  attachHover(elements.inputBpm, 'Tempo en pulsos por minuto');
  attachHover(elements.playBtn, 'Reproducir / Detener');
  attachHover(elements.randomBtn, 'Valores aleatorios');
  attachHover(elements.resetBtn, 'Reiniciar valores');
}

// ========== FACTORY RESET ==========

registerFactoryReset({
  storage: preferenceStorage,
  onReset: () => {
    // Reset all state
    compas = null;
    cycles = null;

    // Reset UI
    if (elements.inputCompas) elements.inputCompas.value = '';
    if (elements.inputCycle) elements.inputCycle.value = '';
    if (elements.cycleDigit) elements.cycleDigit.textContent = '';

    // Reset BPM
    bpmController?.setValue(CONFIG.DEFAULT_BPM);

    // Clear grid-editor
    gridEditor?.clear();

    // Clear grid 2D selections
    grid?.clearSelection();

    // Update displays
    updateLongitud();
    updateGridVisibility();
    updateGrid();
  }
});

// ========== DOM BINDING ==========

function bindElements() {
  elements = {
    // Inputs
    inputCompas: document.getElementById('inputCompas'),
    inputCycle: document.getElementById('inputCycle'),
    inputBpm: document.getElementById('inputBpm'),

    // Grid-editor container
    gridEditorContainer: document.getElementById('gridEditorContainer'),

    // Spinners
    compasUp: document.getElementById('compasUp'),
    compasDown: document.getElementById('compasDown'),
    cycleUp: document.getElementById('cycleUp'),
    cycleDown: document.getElementById('cycleDown'),
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
  console.log('Initializing App20: Plano y sucesión N-iT');

  // Setup piano preload in background (reduces latency on first play)
  setupPianoPreload({ delay: 300 });

  // Bind DOM elements
  bindElements();

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
      storageKey: 'app20:p1Toggle',
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
    // Get initial instrument label from shared localStorage
    const initialInstrument = localStorage.getItem('selectedInstrument') || 'piano';
    const instrumentLabel = initialInstrument === 'violin' ? 'Violín' : 'Piano';

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

  // Load saved preferences FIRST (to get compas/cycles)
  loadPreferences();

  // Initialize the grid (plano-modular)
  initGrid();

  // Initialize the grid-editor (NrX-iT zigzag)
  initGridEditor();

  // Initial renders
  updateLongitud();
  updateGridVisibility();

  // Focus on Compás input
  elements.inputCompas?.focus();

  console.log('App20 initialized');
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
