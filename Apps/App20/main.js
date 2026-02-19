// App20: Plano y sucesión N-iT
// Grid 2D (plano-modular) + zigzag grid-editor for NrX-iT sequences
// REFACTORED: Using modular controllers from libs/app-common/

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
import { subscribeMixer, getMixer } from '../../libs/sound/index.js';
import { initAudioToggles } from '../../libs/app-common/audio-toggles.js';
import { initRandomMenu } from '../../libs/random/menu.js';
import { initP1ToggleUI } from '../../libs/shared-ui/sound-dropdown.js';

// Import plano-modular (out of the box)
import { createApp19Grid } from '../../libs/plano-modular/index.js';

// Import grid-editor for NrX-iT input
import { createGridEditor } from '../../libs/matrix-seq/index.js';

// Import interval-sequencer module for gap filling
import { fillGapsWithSilences } from '../../libs/interval-sequencer/index.js';

// Import modular controllers (NEW)
import { createGrid2DSyncController } from '../../libs/app-common/grid-2d-sync-controller.js';
import { createIntervalNoteDragHandler } from '../../libs/app-common/interval-note-drag.js';
import { createRegistryAutoscrollController } from '../../libs/app-common/registry-playback-autoscroll.js';

// ========== CONFIGURATION ==========
const CONFIG = {
  // Registry limits (4 registries: 2, 3, 4, 5)
  MIN_REGISTRO: 2,
  MAX_REGISTRO: 5,
  DEFAULT_REGISTRO: 4,

  // Notes per registry
  NOTES_PER_REGISTRY: 12,

  // Visual grid range: 7r2 to 7r5
  // This means:
  // - Registry 2: notes 7-11 valid
  // - Registry 3: notes 0-11 valid (full)
  // - Registry 4: notes 0-11 valid (full)
  // - Registry 5: notes 0-7 valid
  RANGE_MIN_NOTE: 7,
  RANGE_MIN_REGISTRY: 2,
  RANGE_MAX_NOTE: 7,
  RANGE_MAX_REGISTRY: 5,

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
  MIDI_OFFSET: 12
};

/**
 * Validates if a note+registry combination is within the visual grid range (7r2 to 7r5)
 * @param {number} note - Note value (0-11)
 * @param {number} registry - Registry value (2-5)
 * @returns {{ valid: boolean, message?: string }}
 */
function validateNoteRegistry(note, registry) {
  // Registry 2: notes 7-11 only
  if (registry === 2 && note < 7) {
    return { valid: false, message: `r2: notas 7-11` };
  }
  // Registry 5: notes 0-7 only
  if (registry === 5 && note > 7) {
    return { valid: false, message: `r5: notas 0-7` };
  }
  // Registry 3 and 4: all notes 0-11 are valid
  return { valid: true };
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

// Store current pairs
let currentPairs = [];

// Modular controllers (NEW)
let syncController = null;
let dragHandler = null;
let autoscrollController = null;

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
 * Fill gaps in pairs with silences for grid-editor display
 * Uses fillGapsWithSilences but preserves registry from previous note
 */
function pairsWithSilencesForEditor(pairs) {
  const basePair = { note: 0, pulse: 0, registry: CONFIG.DEFAULT_REGISTRO };
  const filled = fillGapsWithSilences(pairs, basePair);

  // Ensure silences have registry from previous note
  let lastRegistry = CONFIG.DEFAULT_REGISTRO;
  return filled.map(pair => {
    if (!pair.isRest) {
      lastRegistry = pair.registry ?? CONFIG.DEFAULT_REGISTRO;
    }
    return {
      ...pair,
      registry: pair.registry ?? lastRegistry
    };
  });
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

// ========== GRID FUNCTIONS (using plano-modular + modular controllers) ==========

/**
 * Play a preview sound for a note with given duration
 * @param {number} note - Note index (0-11)
 * @param {number} registry - Registry (2-5)
 * @param {number} iT - Temporal interval (duration in pulses)
 */
async function playNotePreview(note, registry, iT) {
  const audioInstance = await initAudio();
  if (!window.Tone || !audioInstance) return;

  // Calculate MIDI: registry * 12 + note + 12 (midiOffset)
  const midi = registry * CONFIG.NOTES_PER_REGISTRY + note + CONFIG.MIDI_OFFSET;
  const bpm = bpmController?.getValue() || CONFIG.DEFAULT_BPM;
  const duration = (iT * (60 / bpm)) * 0.9;
  audioInstance.playNote(midi, duration, window.Tone.now());
}

/**
 * Handle cell click from grid (Grid 2D → Editor sync)
 * Custom handler that integrates with grid-editor and plays preview
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
      const editorPairs = gridEditor.getPairs();

      // Check if this pulse already has a note
      const existingIndex = editorPairs.findIndex(p => p.pulse === colIndex);

      if (existingIndex >= 0) {
        // Update existing pair
        editorPairs[existingIndex] = {
          ...editorPairs[existingIndex],
          note,
          registry
        };
      } else {
        // Add new pair - calculate temporalInterval from previous note
        let temporalInterval = 1;
        if (editorPairs.length > 0) {
          const lastPair = editorPairs[editorPairs.length - 1];
          const lastPulse = lastPair.pulse + (lastPair.temporalInterval || 1);
          temporalInterval = colIndex - lastPulse + 1;
          if (temporalInterval < 1) temporalInterval = 1;
        }

        editorPairs.push({
          note,
          registry,
          pulse: colIndex,
          temporalInterval
        });
      }

      // Sort by pulse
      editorPairs.sort((a, b) => a.pulse - b.pulse);

      // Update editor (with silences filled in gaps)
      gridEditor.setPairs(pairsWithSilencesForEditor(editorPairs));
    }
  } else {
    // Cell was deselected - remove from grid-editor
    if (gridEditor) {
      const editorPairs = gridEditor.getPairs().filter(p => !p.isRest); // Remove silences first
      const updatedPairs = editorPairs.filter(p => p.pulse !== colIndex);
      gridEditor.setPairs(pairsWithSilencesForEditor(updatedPairs));
    }
  }
}

/**
 * Initialize the grid using plano-modular and modular controllers
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
    registryConfig: {
      selectableRegistries: [2, 3, 4, 5]  // App20 uses extended range including registry 2
    },
    onCellClick: handleCellClick,
    onSelectionChange: null  // Selections not persisted
  });

  // Add scroll listener to update registry display based on visible position
  const soundline = gridContainer.querySelector('.plano-soundline-container');
  if (soundline) {
    soundline.addEventListener('scroll', () => {
      if (!grid || !elements.inputRegistro) return;

      // Get note0RowMap to find registry boundaries
      const note0RowMap = grid.getNote0RowMap();
      if (!note0RowMap) return;

      // Calculate which registry is most visible based on scroll position
      const scrollTop = soundline.scrollTop;
      const cellHeight = 32; // var(--grid-cell-height)
      const visibleMiddleRow = Math.floor(scrollTop / cellHeight) + 7; // +7 for center of 15 visible rows

      // Find the closest registry based on its note0 row position
      let closestRegistry = CONFIG.DEFAULT_REGISTRO;
      let minDistance = Infinity;

      for (const [regStr, rowIndex] of Object.entries(note0RowMap)) {
        const reg = parseInt(regStr);
        const distance = Math.abs(rowIndex - visibleMiddleRow);
        if (distance < minDistance) {
          minDistance = distance;
          closestRegistry = reg;
        }
      }

      elements.inputRegistro.value = closestRegistry;
    });
  }

  // Initialize sync controller (handles Editor ↔ Grid 2D sync)
  syncController = createGrid2DSyncController({
    grid,
    gridEditor,
    getPairs: () => currentPairs,
    setPairs: (pairs) => { currentPairs = pairs; },
    config: {
      defaultRegistry: CONFIG.DEFAULT_REGISTRO,
      validateNoteRegistry,
      fillGapsWithSilences: pairsWithSilencesForEditor
    },
    onSyncComplete: () => {
      // Refresh dots after sync
      syncController?.refreshDots();
    }
  });

  // Enable drag mode (adds dots to all cells)
  syncController.enableDragMode(true);

  // Initialize drag handler (handles drag-to-create/edit)
  // Use getter function because gridEditor may be null at this point
  dragHandler = createIntervalNoteDragHandler({
    grid,
    gridEditor: () => gridEditor,
    getPairs: () => currentPairs,
    setPairs: (pairs) => { currentPairs = pairs; },
    getTotalPulses,
    syncController,
    config: {
      defaultRegistry: CONFIG.DEFAULT_REGISTRO,
      monophonic: true
    },
    playNotePreview,
    fillGapsWithSilences: pairsWithSilencesForEditor
  });

  // Attach drag listeners
  dragHandler.attach();

  // Initialize autoscroll controller (handles vertical scroll during playback)
  autoscrollController = createRegistryAutoscrollController({
    grid,
    getSelectedArray: () => grid.getSelectedArray(),
    config: {
      minRegistry: CONFIG.MIN_REGISTRO,
      maxRegistry: CONFIG.MAX_REGISTRO,
      notesPerRegistry: CONFIG.NOTES_PER_REGISTRY,
      visibleRows: 15,
      zeroPosition: 7,
      smoothScroll: true
    }
  });

  console.log('Grid initialized with plano-modular + modular controllers');
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

    // Re-add dots to all cells (they get removed when grid refreshes)
    if (syncController) {
      syncController.refreshDots();
    }

    // Apply initial scroll once the grid has real content
    maybeApplyInitialScroll();
  }
}

/**
 * Sync Grid 2D from pairs - wrapper for sync controller
 */
function syncGridFromPairs(pairs) {
  if (syncController) {
    syncController.syncGridFromPairs(pairs);
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

  const isMobile = window.innerWidth <= 900;
  const totalPulses = getTotalPulses() || 28;

  gridEditor = createGridEditor({
    container: elements.gridEditorContainer,
    mode: 'n-it',
    showZigzag: true,
    showIntervalLabels: false,
    leftZigzagLabels: { topText: 'N', bottomText: 'iT' },
    autoJumpDelayMs: 500,
    noteRange: [0, 11],  // Basic range; validateNoteRegistry handles per-registry limits
    pulseRange: [0, totalPulses - 1],
    maxPairs: totalPulses,
    intervalModeOptions: {
      basePair: { note: 0, pulse: 0, registry: CONFIG.DEFAULT_REGISTRO },
      hideInitialPair: true,
      maxTotalPulse: totalPulses,  // Sum of iTs should equal total pulses (not -1)
      allowSilence: true
    },
    nrxModeOptions: {
      registryRange: [CONFIG.MIN_REGISTRO, CONFIG.MAX_REGISTRO],
      validateNoteRegistry
    },
    scrollEnabled: isMobile,
    containerSize: isMobile ? { maxHeight: '180px', width: '100%' } : null,
    columnSize: isMobile ? { width: '80px', minHeight: '150px' } : null,
    onPairsChange: (pairs) => {
      // Skip if update came from drag (to prevent overwriting)
      if (dragHandler?.isFromDrag()) return;
      // Sync Grid 2D when editor changes
      syncGridFromPairs(pairs);

      // Auto-scroll to show the last entered note when not playing
      if (!isPlaying && pairs.length > 0) {
        // Find the last non-silence pair (with note and registry)
        const lastNonSilence = [...pairs].reverse().find(p => !p.isRest && p.note != null);
        if (lastNonSilence) {
          const note = lastNonSilence.note;
          const registry = lastNonSilence.registry ?? CONFIG.DEFAULT_REGISTRO;
          scrollToNote(note, registry, true);
        }
      }
    }
  });
}

/**
 * Update grid-editor maxTotalPulse when Compás/Cycles change
 */
function updateGridEditorMaxPulse() {
  const totalPulses = getTotalPulses();
  if (totalPulses > 0 && elements.gridEditorContainer) {
    // Save current pairs before re-initializing
    const savedPairs = gridEditor ? gridEditor.getPairs() : [];

    const isMobile = window.innerWidth <= 900;

    // Re-initialize with updated maxTotalPulse
    gridEditor = createGridEditor({
      container: elements.gridEditorContainer,
      mode: 'n-it',
      showZigzag: true,
      showIntervalLabels: false,
      leftZigzagLabels: { topText: 'N', bottomText: 'iT' },
      autoJumpDelayMs: 500,
      noteRange: [0, 11],  // Basic range; validateNoteRegistry handles per-registry limits
      pulseRange: [0, totalPulses - 1],
      maxPairs: totalPulses,
      intervalModeOptions: {
        basePair: { note: 0, pulse: 0, registry: CONFIG.DEFAULT_REGISTRO },
        hideInitialPair: true,
        maxTotalPulse: totalPulses,
        allowSilence: true
      },
      nrxModeOptions: {
        registryRange: [CONFIG.MIN_REGISTRO, CONFIG.MAX_REGISTRO],
        validateNoteRegistry
      },
      scrollEnabled: isMobile,
      containerSize: isMobile ? { maxHeight: '180px', width: '100%' } : null,
      columnSize: isMobile ? { width: '80px', minHeight: '150px' } : null,
      onPairsChange: (pairs) => {
        // Skip if update came from drag (to prevent overwriting)
        if (dragHandler?.isFromDrag()) return;
        syncGridFromPairs(pairs);

        // Auto-scroll to show the last entered note when not playing
        if (!isPlaying && pairs.length > 0) {
          // Find the last non-silence pair (with note and registry)
          const lastNonSilence = [...pairs].reverse().find(p => !p.isRest && p.note != null);
          if (lastNonSilence) {
            const note = lastNonSilence.note;
            const registry = lastNonSilence.registry ?? CONFIG.DEFAULT_REGISTRO;
            scrollToNote(note, registry, true);
          }
        }
      }
    });

    // Restore pairs (if they fit within new max)
    if (savedPairs.length > 0) {
      const validPairs = savedPairs.filter(p => !p.isRest && p.pulse < totalPulses);
      if (validPairs.length > 0) {
        gridEditor.setPairs(pairsWithSilencesForEditor(validPairs));
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
  if (autoscrollController) {
    autoscrollController.scrollToRegistry(targetRegistry, animated);
  } else if (grid) {
    grid.setRegistry(targetRegistry, animated);
  }
}

/**
 * Scroll to a specific note within a registry
 * @param {number} note - Note value (0-11)
 * @param {number} registry - Registry value (2-5)
 * @param {boolean} animated - Whether to animate the scroll
 */
function scrollToNote(note, registry, animated = false) {
  if (!grid) return;

  // Get row definitions to find the exact row index
  const rows = grid.getRowDefinitions();
  const targetRowId = `${note}r${registry}`;

  // Find the row index for this note+registry
  const rowIndex = rows.findIndex(row => row.id === targetRowId);

  if (rowIndex !== -1) {
    grid.scrollToRow(rowIndex, animated);
  } else {
    // Fallback to registry scroll if specific note not found
    scrollToRegistry(registry, animated);
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

      // Auto-focus to first N cell in grid-editor after entering cycles
      setTimeout(() => {
        if (gridEditor && gridEditor.focusFirstNCell) {
          gridEditor.focusFirstNCell();
        }
      }, 50);
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

  // Build pulse → registry map for vertical autoscroll (using modular controller)
  const pulseRegistry = autoscrollController
    ? autoscrollController.buildPulseRegistryMap()
    : {};

  // Build pulse → pair map for accessing temporalInterval during playback
  const pulsePairMap = new Map();
  currentPairs.forEach(pair => {
    if (pair.note !== null && pair.note !== undefined) {
      pulsePairMap.set(pair.pulse, pair);
    }
  });

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
    (step, scheduledTime) => {
      // scheduledTime is the precise AudioContext time for sample-accurate playback

      // 1. Update playhead position
      grid.updatePlayhead(step);

      // 2. Autoscroll VERTICAL: switch to registry of current note (using modular controller)
      if (autoscrollController) {
        autoscrollController.scrollToRegistryForPulse(step, pulseRegistry);
      }

      // 3. Highlight timeline number
      grid.highlightTimelineNumber(step, intervalSec * 1000 * 0.9);

      // 4. Find note for this pulse and highlight/play
      const midi = midiMap.get(step);
      if (midi !== undefined) {
        // Get temporalInterval from pair to determine note duration
        const pair = pulsePairMap.get(step);
        const iT = pair?.temporalInterval || 1;
        // Duration = iT pulses (minus small gap for separation)
        const noteDuration = intervalSec * iT * 0.95;
        // Use scheduledTime for sample-accurate sync with metronome
        const when = scheduledTime ?? Tone.now();
        audioInstance.playNote(midi, noteDuration, when);

        // Find and highlight the selected cell
        const selected = grid.getSelectedArray().find(s => s.colIndex === step);
        if (selected) {
          grid.highlightCell(selected.rowId, step, intervalSec * 1000 * 0.9);
        }
      }

      // 5. Anticipate registry change for NEXT pulse (using modular controller)
      const nextPulse = step + 1;
      if (nextPulse < totalPulses && autoscrollController) {
        const registryChangeDelay = intervalSec * 1000 * 0.75;
        autoscrollController.scheduleAnticipatedScroll(
          nextPulse,
          pulseRegistry,
          registryChangeDelay,
          () => isPlaying
        );
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

  // Update grid-editor with generated pairs (with silences filled in gaps)
  if (gridEditor) {
    gridEditor.setPairs(pairsWithSilencesForEditor(pairs));
  }

  // Sync Grid 2D from pairs (without silences - gaps are implicit)
  syncGridFromPairs(pairs.filter(p => !p.isRest));
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

  // Compás spinners
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
    } else if (e.key === 'Enter') {
      // Move focus to first N cell in grid-editor
      if (gridEditor?.focusFirstNCell) {
        gridEditor.focusFirstNCell();
      }
    }
  });

  // Cycles spinners
  attachSpinnerRepeat(elements.cycleUp, incrementCycles);
  attachSpinnerRepeat(elements.cycleDown, decrementCycles);

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
    inputRegistro: document.getElementById('inputRegistro'),
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
    tapTempoBtn: document.getElementById('tapTempoBtn'),
    pulseToggleBtn: document.getElementById('pulseToggleBtn')
  };
}

function initApp() {
  console.log('Initializing App20: Plano y sucesión N-iT (MODULAR)');

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

      // Sync pulseToggleBtn with mixer pulse channel mute state
      if (elements.pulseToggleBtn) {
        const pulseChannel = snapshot.channels?.pulse;
        if (pulseChannel) {
          const isMuted = pulseChannel.muted || pulseChannel.effectiveMuted;
          // Button active = pulse enabled (not muted)
          elements.pulseToggleBtn.classList.toggle('active', !isMuted);
          elements.pulseToggleBtn.setAttribute('aria-pressed', String(!isMuted));
        }
      }
    });

    loadMixerState();
  }

  // Wire pulseToggleBtn using initAudioToggles
  if (elements.pulseToggleBtn) {
    initAudioToggles({
      toggles: [{
        id: 'pulse',
        button: elements.pulseToggleBtn,
        storageKey: 'app20:pulseAudio',
        mixerChannel: 'pulse',
        defaultEnabled: true
      }],
      mixer: getMixer(),
      subscribeMixer
    });
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

  // Initialize the grid (plano-modular + modular controllers)
  initGrid();

  // Initialize the grid-editor (NrX-iT zigzag)
  initGridEditor();

  // Initial renders
  updateLongitud();
  updateGridVisibility();

  // Focus on Compás input (after render completes)
  requestAnimationFrame(() => {
    elements.inputCompas?.focus();
  });

  console.log('App20 initialized (MODULAR)');
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
