// App15: Plano y Sucesión de Intervalos
// Extended version of App12 that works with intervals (iS-iT) instead of absolute positions

import { createMusicalGrid } from '../../libs/musical-grid/index.js';
import { createGridEditor } from '../../libs/matrix-seq/index.js';
import { initMixerMenu } from '../../libs/app-common/mixer-menu.js';
import { initRandomMenu } from '../../libs/random/menu.js';
import { initP1ToggleUI } from '../../libs/shared-ui/sound-dropdown.js';
import { initAudioToggles } from '../../libs/app-common/audio-toggles.js';
import { getMixer, subscribeMixer, setChannelVolume, setChannelMute, setVolume, setMute } from '../../libs/sound/index.js';
import { registerFactoryReset, createPreferenceStorage } from '../../libs/app-common/preferences.js';
import { createMatrixHighlightController } from '../../libs/app-common/matrix-highlight-controller.js';
import { clearElement } from '../../libs/app-common/dom-utils.js';
import { intervalsToPairs } from '../../libs/matrix-seq/index.js';
import { createMelodicAudioInitializer } from '../../libs/app-common/audio-init.js';
import { setupPianoPreload, isPianoLoaded } from '../../libs/sound/piano.js';

// Import interval-sequencer module utilities
import {
  fillGapsWithSilences,
  pairsToIntervals,
  buildPairsFromIntervals,
  createIntervalRenderer
} from '../../libs/interval-sequencer/index.js';

// ========== CONFIGURATION ==========
const TOTAL_PULSES = 9;   // Horizontal: 0-8
const TOTAL_NOTES = 12;   // Vertical: 0-11 (MIDI 60-71)
const TOTAL_SPACES = 8;   // Spaces between pulses: 0-7 (total pulses = 9)
const DEFAULT_BPM = 120;

// ========== STATE ==========
let audio = null;
let musicalGrid = null;
let gridEditor = null;
const currentBPM = DEFAULT_BPM; // Locked to 120 BPM
let isPlaying = false;
let polyphonyEnabled = false; // Default: polyphony DISABLED (monophonic mode)
const intervalLinesEnabledState = true; // Always enabled in App15

// Store current intervals and pairs
let currentIntervals = [];
let currentPairs = [];

// Interval renderer instance (from interval-sequencer module)
let intervalRenderer = null;

// Tracking d'elements d'interval iS (línies verticals estil App14)
let currentIntervalElements = [];
let activeAnimationTimeouts = [];

// Elements
let playBtn = null;
let resetBtn = null;
let randomBtn = null;
let gridEditorContainer = null;

// ========== DRAG STATE FOR HORIZONTAL iT MODIFICATION ==========
let dragState = {
  active: false,
  startSpaceIndex: null,
  currentSpaceIndex: null,
  noteIndex: null,        // Track the note being created/edited
  originalPair: null,
  mode: null,             // 'create' | 'edit'
  previewElement: null
};

// ========== STORAGE HELPERS ==========
// Use shared preference storage module - renamed to app15
const preferenceStorage = createPreferenceStorage({ prefix: 'app15', separator: '-' });

// ========== AUDIO INITIALIZATION ==========
// Use standardized melodic audio initializer (ensures Tone.js loads before AudioContext)
const _initAudio = createMelodicAudioInitializer({
  defaultInstrument: 'piano',
  getPreferences: () => preferenceStorage.load() || {}
});

async function initAudio() {
  if (!audio) {
    audio = await _initAudio();

    // Configure FX defaults: FX On, Comp -3, Lim -1
    if (audio) {
      audio.setEffectsEnabled(true);
      audio.setCompressorThreshold(-3);
      audio.setLimiterThreshold(-1);

      // Set all mixer faders to 0.75 (75%)
      setVolume(0.75); // Master
      setChannelVolume('pulse', 0.75);
      setChannelVolume('instrument', 0.75);
    }

    // Sync P1 toggle state with audio engine (P1 defaults to enabled in audio,
    // but user may have saved it as disabled - sync from localStorage)
    const p1Stored = localStorage.getItem('app15:p1Toggle');
    if (audio && p1Stored === 'false' && typeof audio.setStartEnabled === 'function') {
      audio.setStartEnabled(false);
    }
  }
  return audio;
}

// ========== VISUAL FEEDBACK ==========
// Using shared matrix highlight controller module

let highlightController = null;

// ========== PLAYBACK ==========

async function handlePlay() {
  if (isPlaying) {
    // Immediate stop via audio engine
    stopPlayback();
    return;
  }

  // Show loading indicator if piano not yet loaded
  const playIcon = playBtn?.querySelector('.icon-play');
  const stopIcon = playBtn?.querySelector('.icon-stop');
  let wasLoading = false;

  if (!isPianoLoaded() && playBtn) {
    wasLoading = true;
    playBtn.disabled = true;
    if (playIcon) playIcon.style.opacity = '0.5';
  }

  // Ensure audio is initialized
  await initAudio();

  // Restore button state after loading
  if (wasLoading && playBtn) {
    playBtn.disabled = false;
    if (playIcon) playIcon.style.opacity = '1';
  }

  if (!window.Tone) {
    console.error('Tone.js not available');
    return;
  }

  // Get pairs from grid editor
  const allPairs = gridEditor.getPairs();
  const playablePairs = allPairs.filter(p => !p.isRest && p.note !== null && p.note !== undefined);

  // Group pairs by pulse for polyphonic playback
  // Store both MIDI note and temporalInterval for variable duration
  const pulseGroups = {};
  playablePairs.forEach(pair => {
    if (!pulseGroups[pair.pulse]) {
      pulseGroups[pair.pulse] = [];
    }
    pulseGroups[pair.pulse].push({
      midi: 60 + pair.note,
      temporalInterval: pair.temporalInterval || 1
    });
  });

  isPlaying = true;

  // Disable random button during playback
  if (randomBtn) randomBtn.disabled = true;

  // Switch to stop icon (playIcon and stopIcon already declared above)
  if (playIcon && stopIcon) {
    playIcon.style.display = 'none';
    stopIcon.style.display = 'block';
  }

  const intervalSec = (60 / currentBPM);
  const totalPulseSounds = TOTAL_SPACES; // 8 pulse sounds (spaces 0-7)
  const Tone = window.Tone;

  // Start TimelineAudio transport-based playback
  audio.play(
    totalPulseSounds,
    intervalSec,
    new Set(), // No accent sounds (pulse plays automatically on all beats)
    false, // No loop initially
    (step, scheduledTime) => {
      // onPulse callback: Called on EVERY space (0-7), even if empty
      // scheduledTime is the precise AudioContext time for sample-accurate playback

      // 1) Visual feedback for pulse column
      highlightController?.highlightPulse(step);

      // 2) Play piano notes if any exist at this pulse
      const notes = pulseGroups[step];
      if (notes && notes.length > 0) {
        // Use scheduledTime for sample-accurate sync with metronome
        const when = scheduledTime ?? Tone.now();

        // Polyphonic: trigger all notes simultaneously
        notes.forEach(noteData => {
          // Duration based on temporalInterval (iT)
          const duration = (noteData.temporalInterval * intervalSec) * 0.9;
          audio.playNote(noteData.midi, duration, when);

          // Visual feedback per cell
          const noteIndex = noteData.midi - 60;
          const cell = musicalGrid.getCellElement(noteIndex, step);
          if (cell) {
            cell.classList.add('playing');
            setTimeout(() => cell.classList.remove('playing'), duration * 1000);
          }
        });
      }

      // 3) Pulse sound plays AUTOMATICALLY via TimelineAudio
      //    (controlled by pulseToggleBtn + mixer 'pulse' channel)
    },
    () => {
      // onComplete callback: Delay stop to let last note ring out (90% of interval)
      const lastNoteDelay = intervalSec * 0.9 * 1000;
      stopPlayback(lastNoteDelay);
    }
  );
}

function stopPlayback(delayMs = 0) {
  isPlaying = false;

  // Re-enable random button after playback
  if (randomBtn) randomBtn.disabled = false;

  // Stop audio with delay to let last note ring out
  if (delayMs > 0) {
    setTimeout(() => {
      audio?.stop();
    }, delayMs);
  } else {
    audio?.stop();
  }

  // Clear all highlights
  musicalGrid?.clearIntervalHighlights();
  highlightController?.clearHighlights();

  // Reset button icon
  const playIcon = playBtn?.querySelector('.icon-play');
  const stopIcon = playBtn?.querySelector('.icon-stop');
  if (playIcon && stopIcon) {
    playIcon.style.display = 'block';
    stopIcon.style.display = 'none';
  }

  // Clear any active playing animations
  document.querySelectorAll('.musical-cell.playing').forEach(cell => {
    cell.classList.remove('playing');
  });
}

// ========== GRID SYNCHRONIZATION ==========

// Helper: Separate pairs into independent voices (copy from App12)
function separateIntoVoices(pairs) {
  const voices = [];
  const sortedPairs = [...pairs].sort((a, b) => a.pulse - b.pulse);

  for (const pair of sortedPairs) {
    // Find a voice that doesn't have a note at this pulse
    let assignedVoice = voices.find(voice =>
      !voice.some(p => p.pulse === pair.pulse)
    );

    if (!assignedVoice) {
      // Create new voice
      assignedVoice = [];
      voices.push(assignedVoice);
    }

    assignedVoice.push(pair);
  }

  return voices;
}

// Note: interval-span tubes removed - iT bars in timeline are sufficient for showing duration

/**
 * Render temporal bars using interval-sequencer module
 * Wrapper function that delegates to the module's renderer
 */
function renderTemporalBars(intervals = []) {
  if (!intervalRenderer) return;
  intervalRenderer.render(intervals);
}

function syncGridFromPairs(pairs) {
  if (!musicalGrid) return;
  currentPairs = pairs;

  // PERFORMANCE: Incremental update instead of full redraw
  // Track which cells should be active
  const visiblePairs = pairs.filter(p => p.note !== null && p.note !== undefined);
  // Convert pulse to space indices for cell tracking (fillSpaces mode)
  // Each note occupies spaces from pulse (START) to (pulse + iT - 1) (END)
  // The note STARTS at pulse, and ENDS at (pulse + iT - 1)
  const activeCells = new Set();
  visiblePairs.forEach(p => {
    if (p.isRest) return; // Silences don't illuminate cells
    const iT = p.temporalInterval || 1;
    const startSpace = p.pulse;
    const endSpace = p.pulse + iT - 1;
    for (let space = startSpace; space <= endSpace; space++) {
      if (space >= 0) {
        activeCells.add(`${p.note}-${space}`);
      }
    }
  });

  // Clear only cells that are no longer active
  document.querySelectorAll('.musical-cell.active').forEach(cell => {
    const note = parseInt(cell.dataset.note);
    const pulse = parseInt(cell.dataset.pulse);
    const key = `${note}-${pulse}`;

    if (!activeCells.has(key)) {
      cell.classList.remove('active');
    }
  });

  // Clear interval lines (App14 style vertical bars)
  clearIntervalLines();

  // Filter out invalid pairs (null notes or pulses out of range)
  const validPairs = visiblePairs.filter(p =>
    p.pulse >= 0 && p.pulse <= TOTAL_PULSES - 1 &&
    p.note >= 0 && p.note <= TOTAL_NOTES - 1
  );

  // Activate cells (no labels in grid-2D)
  // With fillSpaces=true, cells represent SPACES between pulses
  // Each note occupies spaces from pulse (START) to (pulse + iT - 1) (END)
  // The note STARTS at pulse, showing its full duration
  validPairs.forEach(({ note, pulse, isRest, temporalInterval }) => {
    // Silences (isRest) don't illuminate cells - they represent absence of sound
    if (isRest) return;

    // Calculate start and end spaces based on temporalInterval
    const iT = temporalInterval || 1;
    const startSpace = pulse;
    const endSpace = pulse + iT - 1;

    for (let space = startSpace; space <= endSpace; space++) {
      if (space < 0) continue;
      const cell = musicalGrid.getCellElement(note, space);
      if (cell) {
        cell.classList.add('active');
      }
    }
  });

  // Draw interval lines for iS visualization (App14 style positioned in matrix)
  if (intervalLinesEnabledState && validPairs.length > 0) {
    // Start from base pair (0,0)
    let prevNote = 0;

    // Sort by pulse to ensure correct order
    const sortedPairs = [...validPairs].sort((a, b) => a.pulse - b.pulse);

    sortedPairs.forEach((pair, intervalIndex) => {
      if (!pair.isRest) {
        // Always draw interval line (including case 0 when note stays the same)
        createIntervalLine(prevNote, pair.note, pair.pulse, intervalIndex);
        prevNote = pair.note;
      }
    });
  }

  // Render temporal overlay based on iT
  renderTemporalBars(currentIntervals);

  // Save to storage
  saveCurrentState();
}

// ========== DRAG HANDLERS FOR HORIZONTAL iT MODIFICATION ==========

/**
 * Calculate space index from a pair based on its temporalInterval
 * Space index = pulse - 1 (the cell where the note ends)
 */
function getSpaceIndexFromPair(pair) {
  return pair.pulse - 1;
}

/**
 * Calculate space index from mouse X coordinate
 */
function calculateSpaceFromMouseX(mouseX, musicalGrid) {
  const matrixContainer = musicalGrid.getMatrixContainer?.();
  if (!matrixContainer) return null;

  const rect = matrixContainer.getBoundingClientRect();
  const relativeX = mouseX - rect.left;

  // Calculate which space (cell) the mouse is over
  // With fillSpaces=true, there are 8 cells (spaces) between 9 pulses
  const cellWidth = rect.width / TOTAL_SPACES;
  const spaceIndex = Math.floor(relativeX / cellWidth);

  // Clamp to valid range [0, TOTAL_SPACES - 1] (0-7)
  return Math.max(0, Math.min(TOTAL_SPACES - 1, spaceIndex));
}

/**
 * Handle mousedown on a dot to start drag (create or edit mode)
 * - If no pair exists at position → mode 'create'
 * - If pair exists → mode 'edit'
 */
function handleDotMouseDown(noteIndex, spaceIndex, event, musicalGrid) {
  if (!gridEditor) return;

  // Initialize audio on first interaction (ensures sound is ready for mouseup)
  initAudio();

  const pairsAtMoment = gridEditor.getPairs();

  // Check if there's an existing pair at this position
  // spaceIndex in grid-2D = pulse in pair semantics (START position)
  const existingPair = pairsAtMoment.find(p => p.note === noteIndex && p.pulse === spaceIndex);

  dragState.active = true;
  dragState.startSpaceIndex = spaceIndex;
  dragState.currentSpaceIndex = spaceIndex;
  dragState.noteIndex = noteIndex;
  dragState.originalPair = existingPair || null;
  dragState.mode = existingPair ? 'edit' : 'create';

  // Immediate visual feedback on mousedown
  document.body.classList.add('dragging-note');
  // Change cursor to grabbing via :root variable (CSS variable inheritance fix)
  document.documentElement.style.setProperty('--np-dot-cursor', 'grabbing');

  // Show preview on initial cell immediately
  const cell = musicalGrid.getCellElement(noteIndex, spaceIndex);
  if (cell) {
    cell.classList.add('drag-preview');
  }

  // Prevent default to avoid text selection
  event.preventDefault();
  event.stopPropagation();
}

/**
 * Handle mousemove during drag to preview new iT
 */
function handleMouseMove(event, musicalGrid) {
  if (!dragState.active) return;

  const newSpaceIndex = calculateSpaceFromMouseX(event.clientX, musicalGrid);
  if (newSpaceIndex === null || newSpaceIndex === dragState.currentSpaceIndex) return;

  // Clear previous preview
  clearDragPreview();

  dragState.currentSpaceIndex = newSpaceIndex;

  // Show preview of cells that will be occupied
  const startSpace = Math.min(dragState.startSpaceIndex, newSpaceIndex);
  const endSpace = Math.max(dragState.startSpaceIndex, newSpaceIndex);

  for (let space = startSpace; space <= endSpace; space++) {
    const cell = musicalGrid.getCellElement(dragState.noteIndex, space);
    if (cell) {
      cell.classList.add('drag-preview');
    }
  }

  // Add grabbing cursor class to body
  document.body.classList.add('dragging-note');
}

/**
 * Handle mouseup to finalize drag and update/create pair
 */
function handleMouseUp(event, musicalGrid) {
  if (!dragState.active) return;

  // Remove grabbing cursor class
  document.body.classList.remove('dragging-note');

  const startSpace = dragState.startSpaceIndex;
  const endSpace = dragState.currentSpaceIndex ?? startSpace;

  // Calculate iT as distance from start to end + 1 (inclusive)
  // If no drag (same position), iT = 1
  const iT = Math.abs(endSpace - startSpace) + 1;
  const startPulse = Math.min(startSpace, endSpace);  // Pulse = START position

  if (dragState.mode === 'create') {
    // Creating new pair
    const newPair = {
      note: dragState.noteIndex,
      pulse: startPulse,
      temporalInterval: iT
    };

    // Add to pairs, respecting polyphony mode
    const pairsAtMoment = gridEditor.getPairs();
    let newPairs;

    if (!polyphonyEnabled) {
      // Remove any existing pair at overlapping pulses
      newPairs = pairsAtMoment.filter(p => {
        const pEnd = p.pulse + (p.temporalInterval || 1) - 1;
        const newEnd = startPulse + iT - 1;
        // Check for overlap
        return !(p.pulse <= newEnd && pEnd >= startPulse);
      });
      newPairs.push(newPair);
    } else {
      newPairs = [...pairsAtMoment, newPair];
    }

    // Fill gaps with automatic silences
    newPairs = fillGapsWithSilences(newPairs);

    // Update intervals BEFORE sync (ensures iT-bars render correctly)
    updateIntervalsFromPairs(newPairs);

    // Play preview sound
    playNotePreview(dragState.noteIndex, iT);

    gridEditor.setPairs(newPairs);
    syncGridFromPairs(newPairs);

    // If sequence is full (8 pulses), remove empty columns
    const totalPulses = newPairs.reduce((sum, p) => sum + (p.temporalInterval || 1), 0);
    if (totalPulses >= TOTAL_SPACES && gridEditor.removeEmptyIntervalSlots) {
      gridEditor.removeEmptyIntervalSlots();
    }

  } else if (dragState.mode === 'edit' && dragState.originalPair) {
    // Editing existing pair - update its position and temporalInterval
    const pairsAtMoment = gridEditor.getPairs();
    let newPairs = pairsAtMoment.map(p => {
      if (p === dragState.originalPair) {
        return {
          ...p,
          pulse: startPulse,
          temporalInterval: iT
        };
      }
      return p;
    });

    // Fill gaps with automatic silences
    newPairs = fillGapsWithSilences(newPairs);

    // Update intervals BEFORE sync (ensures iT-bars render correctly)
    updateIntervalsFromPairs(newPairs);

    gridEditor.setPairs(newPairs);
    syncGridFromPairs(newPairs);

    // If sequence is full (8 pulses), remove empty columns
    const totalPulses = newPairs.reduce((sum, p) => sum + (p.temporalInterval || 1), 0);
    if (totalPulses >= TOTAL_SPACES && gridEditor.removeEmptyIntervalSlots) {
      gridEditor.removeEmptyIntervalSlots();
    }
  }

  // Reset drag state
  resetDragState();
}

/**
 * Reset drag state to initial values
 */
function resetDragState() {
  clearDragPreview();
  document.body.classList.remove('dragging-note');
  // Restore cursor to grab via :root variable
  document.documentElement.style.setProperty('--np-dot-cursor', 'grab');
  dragState.active = false;
  dragState.startSpaceIndex = null;
  dragState.currentSpaceIndex = null;
  dragState.noteIndex = null;
  dragState.originalPair = null;
  dragState.mode = null;
}

/**
 * Clear visual preview of drag selection
 */
function clearDragPreview() {
  document.querySelectorAll('.musical-cell.drag-preview').forEach(cell => {
    cell.classList.remove('drag-preview');
  });
}

/**
 * Play a preview sound for a note with given duration
 */
async function playNotePreview(noteIndex, iT) {
  const audioInstance = await initAudio();
  if (!window.Tone || !audioInstance) return;

  const midi = 60 + noteIndex;
  const duration = (iT * (60 / currentBPM)) * 0.9;
  audioInstance.playNote(midi, duration, window.Tone.now());
}

// fillGapsWithSilences is imported from interval-sequencer module
// Uses basePair = { note: 0, pulse: 0 } by default

/**
 * Update currentIntervals from pairs array using module's pairsToIntervals
 * This ensures intervals are fresh before rendering iT-bars
 */
function updateIntervalsFromPairs(pairs) {
  currentIntervals = pairsToIntervals(pairs, { note: 0, pulse: 0 });
}

// ========== END DRAG HANDLERS ==========

// ========== INTERVAL LINES (iS) - App14 style in 2D grid ==========

/**
 * Create a vertical interval line between two notes at a specific pulse position
 * Uses separate DOM elements positioned in the matrix grid (not soundline like App14)
 *
 * @param {number} note1Index - Origin note (0-11)
 * @param {number} note2Index - Destination note (0-11)
 * @param {number} pulseIndex - Pulse position where the transition occurs (0-7)
 * @param {number} intervalIndex - Index of this interval in the sequence (0 = first interval)
 */
function createIntervalLine(note1Index, note2Index, pulseIndex, intervalIndex = 0) {
  const matrixContainer = musicalGrid?.getMatrixContainer?.();
  if (!matrixContainer) return;

  const isAscending = note2Index > note1Index;
  const interval = note2Index - note1Index;
  const absInterval = Math.abs(interval);

  // Calculate horizontal position (left edge of the pulse column where the new note starts)
  const leftPos = pulseIndex / TOTAL_SPACES * 100;

  // Special case: interval 0 - draw vertical line spanning the full cell height
  if (absInterval === 0) {
    // Vertical line from top to bottom of the cell (full cell height)
    const cellHeight = 100 / TOTAL_NOTES; // Height of one cell in %
    const topEdge = (TOTAL_NOTES - 1 - note2Index) / TOTAL_NOTES * 100;

    const intervalBar = document.createElement('div');
    intervalBar.className = 'interval-bar-vertical interval-zero';

    intervalBar.style.position = 'absolute';
    intervalBar.style.top = `${topEdge}%`;
    intervalBar.style.left = `${leftPos}%`;
    intervalBar.style.transform = 'translateX(-50%)';
    intervalBar.style.width = '4px';
    intervalBar.style.height = `${cellHeight}%`;
    intervalBar.style.zIndex = '15';

    matrixContainer.appendChild(intervalBar);
    currentIntervalElements.push(intervalBar);

    // Number "0" ABOVE the bar (centered horizontally on the bar)
    const intervalNum = document.createElement('div');
    intervalNum.className = 'interval-number';
    intervalNum.textContent = '0';
    intervalNum.style.position = 'absolute';
    intervalNum.style.zIndex = '16';
    intervalNum.style.top = `${topEdge}%`;
    intervalNum.style.left = `${leftPos}%`;
    intervalNum.style.transform = 'translate(-50%, -100%)'; // Center horizontally, position above

    matrixContainer.appendChild(intervalNum);
    currentIntervalElements.push(intervalNum);
    return;
  }

  // Calculate vertical positions (grid is inverted: note 0 at bottom)
  // Cell edges: TOP = (TOTAL_NOTES - 1 - noteIndex) / TOTAL_NOTES * 100
  //             BOTTOM = (TOTAL_NOTES - noteIndex) / TOTAL_NOTES * 100

  let topEdge, bottomEdge;

  if (absInterval <= 1) {
    // ±1: line spans full edge-to-edge (current behavior)
    const topNote = Math.max(note1Index, note2Index);
    topEdge = (TOTAL_NOTES - 1 - topNote) / TOTAL_NOTES * 100;
    // First interval from base (0,0): extend to bottom of grid
    if (intervalIndex === 0 && note1Index === 0) {
      bottomEdge = 100; // Extend to very bottom of grid
    } else {
      const bottomNote = Math.min(note1Index, note2Index);
      bottomEdge = (TOTAL_NOTES - bottomNote) / TOTAL_NOTES * 100;
    }
  } else if (isAscending) {
    // Ascending (+2 or more): TOP of origin → BOTTOM of destination
    // Origin is note1Index (lower), destination is note2Index (higher)
    const originCellTop = (TOTAL_NOTES - 1 - note1Index) / TOTAL_NOTES * 100;
    const destCellBottom = (TOTAL_NOTES - note2Index) / TOTAL_NOTES * 100;
    topEdge = destCellBottom; // Line's top = destination's bottom edge
    // First interval: extend to bottom of grid (base pair 0,0)
    if (intervalIndex === 0 && note1Index === 0) {
      bottomEdge = 100; // Extend to very bottom of grid
    } else {
      bottomEdge = originCellTop; // Line's bottom = origin's top edge
    }
  } else {
    // Descending (-2 or more): BOTTOM of origin → TOP of destination
    // Origin is note1Index (higher), destination is note2Index (lower)
    const originCellBottom = (TOTAL_NOTES - note1Index) / TOTAL_NOTES * 100;
    const destCellTop = (TOTAL_NOTES - 1 - note2Index) / TOTAL_NOTES * 100;
    topEdge = originCellBottom; // Line's top = origin's bottom edge
    bottomEdge = destCellTop; // Line's bottom = destination's top edge
  }

  const finalHeight = bottomEdge - topEdge;

  const intervalBar = document.createElement('div');
  intervalBar.className = 'interval-bar-vertical';
  intervalBar.classList.add(isAscending ? 'ascending' : 'descending');

  // Position in matrix grid
  intervalBar.style.position = 'absolute';
  intervalBar.style.left = `${leftPos}%`;
  intervalBar.style.transform = 'translateX(-50%)';
  intervalBar.style.width = '4px';
  intervalBar.style.top = `${topEdge}%`;
  intervalBar.style.height = `${finalHeight}%`;
  intervalBar.style.zIndex = '15';

  matrixContainer.appendChild(intervalBar);
  currentIntervalElements.push(intervalBar);

  // Create interval number label (like App14)
  // Ascending intervals: show + sign
  // Descending intervals: show - sign
  const displayValue = interval > 0 ? `+${absInterval}` : `-${absInterval}`;

  // Calculate vertical center of the interval bar
  let centerY = (topEdge + bottomEdge) / 2;

  const intervalNum = document.createElement('div');
  intervalNum.className = 'interval-number';
  intervalNum.textContent = displayValue;
  intervalNum.style.position = 'absolute';
  intervalNum.style.zIndex = '16';

  // Positioning rules:
  // - First interval (index 0): number always goes RIGHT
  // - For ±1: number goes RIGHT of the bar (both ascending and descending)
  // - For other ascending (+): number goes LEFT of the bar
  // - For other descending (-): number goes RIGHT of the bar

  // Bar is 4px wide centered at leftPos, so:
  // - Left edge of bar: leftPos - 2px
  // - Right edge of bar: leftPos + 2px
  // 10px margin means:
  // - Left number: leftPos - 12px (then offset for text width)
  // - Right number: leftPos + 12px

  const isFirstInterval = intervalIndex === 0;

  if (absInterval === 1) {
    // ±1: number always goes RIGHT of the bar
    // Shift vertically to avoid overlap: down for ascending, up for descending
    if (isAscending) {
      centerY = bottomEdge - 2; // Move towards bottom
    } else {
      centerY = topEdge + 2; // Move towards top
    }
    intervalNum.style.top = `${centerY}%`;
    intervalNum.style.left = `calc(${leftPos}% + 12px)`;
    intervalNum.style.transform = 'translateY(-50%)';
  } else if (isFirstInterval) {
    // First interval: number always goes RIGHT
    intervalNum.style.top = `${centerY}%`;
    intervalNum.style.left = `calc(${leftPos}% + 12px)`;
    intervalNum.style.transform = 'translateY(-50%)';
  } else if (isAscending) {
    // Ascending (except ±1 and first): number LEFT of the bar
    intervalNum.style.top = `${centerY}%`;
    intervalNum.style.left = `calc(${leftPos}% - 12px)`;
    intervalNum.style.transform = 'translate(-100%, -50%)'; // Align right edge to the position
  } else {
    // Descending (except ±1): number RIGHT of the bar
    intervalNum.style.top = `${centerY}%`;
    intervalNum.style.left = `calc(${leftPos}% + 12px)`;
    intervalNum.style.transform = 'translateY(-50%)';
  }

  matrixContainer.appendChild(intervalNum);
  currentIntervalElements.push(intervalNum);
}

/**
 * Clear all interval line elements
 */
function clearIntervalLines() {
  currentIntervalElements.forEach(el => el.remove());
  currentIntervalElements = [];
  activeAnimationTimeouts.forEach(id => clearTimeout(id));
  activeAnimationTimeouts = [];
}

// ========== END INTERVAL LINES ==========

function syncIntervalsFromGrid(noteIndex, pulseIndex, duration) {
  // When a cell is dragged in the grid, update the corresponding interval
  // This is complex and might need more context about which interval to update

  // Find which interval this corresponds to
  let pulseCount = 0;
  for (let i = 0; i < currentIntervals.length; i++) {
    if (pulseCount === pulseIndex) {
      // Update this interval's temporal value
      currentIntervals[i].temporalInterval = duration;

      // Update the grid editor
      gridEditor.setPairs(currentPairs);

      // Save state
      saveCurrentState();
      break;
    }
    pulseCount += currentIntervals[i].temporalInterval;
  }
}

// ========== RESET ==========

function handleReset() {
  stopPlayback();

  // Clear editors
  gridEditor?.clear();
  musicalGrid?.clear();
  renderTemporalBars([]);

  // Clear interval lines (App14 style vertical bars)
  clearIntervalLines();

  // Reset state
  currentIntervals = [];
  currentPairs = [];

  // Save cleared state
  saveCurrentState();
}

// ========== RANDOM ==========

function handleRandom() {
  // Prevent random during playback
  if (isPlaying) return;

  // Get random settings from menu
  const randISMax = Math.min(Math.max(parseInt(document.getElementById('randISMax')?.value || '11'), 1), 11);
  const randITMax = Math.min(Math.max(parseInt(document.getElementById('randITMax')?.value || '8'), 1), 8);
  const allowSilences = document.getElementById('randAllowSilences')?.checked || false;

  // Base pair is always (0, 0)
  const basePair = { note: 0, pulse: 0 };
  const maxTotalPulse = TOTAL_PULSES - 1; // 8

  // Generate random intervals until we reach exactly 8 pulses
  const intervals = [];
  let currentNote = basePair.note;
  let currentPulse = basePair.pulse;
  let intervalCount = 0;

  // Continue generating intervals until we fill all 8 pulses
  while (currentPulse < maxTotalPulse) {
    // Calculate valid iT range
    const remainingPulses = maxTotalPulse - currentPulse;

    // iT: Random between 1 and min(randITMax, remainingPulses)
    const maxIT = Math.min(randITMax, remainingPulses);
    const temporalInterval = Math.floor(Math.random() * maxIT) + 1; // 1 to maxIT

    // Decide if this interval is a silence (only if allowSilences and not first interval)
    const isSilence = allowSilences && intervalCount > 0 && Math.random() < 0.2; // 20% chance of silence

    if (isSilence) {
      // Silence: soundInterval is 0, note doesn't change
      intervals.push({ soundInterval: 0, temporalInterval, isRest: true });
    } else {
      // Calculate valid iS range (result must stay in [0, 11])
      const maxUp = Math.min(randISMax, TOTAL_NOTES - 1 - currentNote); // Can't exceed note 11
      const maxDown = Math.min(randISMax, currentNote); // Can't go below note 0

      let soundInterval;
      if (intervalCount === 0) {
        // First iS must be positive (firstIntervalPositiveOnly rule)
        if (maxUp <= 0) break; // Can't generate valid first interval
        soundInterval = Math.floor(Math.random() * maxUp) + 1; // 1 to maxUp
      } else {
        // Subsequent iS can be positive or negative
        // Random between -maxDown and +maxUp
        soundInterval = Math.floor(Math.random() * (maxUp + maxDown + 1)) - maxDown;
      }

      intervals.push({ soundInterval, temporalInterval });

      // Update note position (only for non-silences)
      currentNote += soundInterval;
    }

    // Update pulse position and interval count
    currentPulse += temporalInterval;
    intervalCount++;
  }

  // Convert to pairs using intervalsToPairs (includes base pair)
  const allPairs = intervalsToPairs(basePair, intervals);

  // gridEditor with hideInitialPair expects pairs WITHOUT the base pair
  // So we slice to remove the first element (base pair)
  const pairsForEditor = allPairs.slice(1);

  currentIntervals = intervals;
  currentPairs = pairsForEditor;

  // Update editor (expects pairs without base)
  gridEditor.setPairs(pairsForEditor);

  // Remove empty interval slots at the end (sanitize like manual input does)
  if (gridEditor.removeEmptyIntervalSlots) {
    gridEditor.removeEmptyIntervalSlots();
  }

  // Sync to grid (also expects pairs without base, syncGridFromPairs handles basePair internally)
  syncGridFromPairs(pairsForEditor);

  // Persist
  saveCurrentState();
}

// ========== STORAGE ==========

function saveCurrentState() {
  const prefs = preferenceStorage.load() || {};

  // Save current intervals and initial position
  prefs.intervals = currentIntervals;
  prefs.initialPair = { note: 0, pulse: 0 };

  preferenceStorage.save(prefs);
}

function loadSavedState() {
  // App15 should always start empty - no persistence of sequences between sessions
  // Only UI preferences (polyphony, selectColor, etc.) are persisted
  // The grid-editor and grid-2D start with no pairs/intervals
}

// ========== DOM INJECTION ==========

function injectGridEditor() {
  // Create container for grid editor
  gridEditorContainer = document.createElement('div');
  gridEditorContainer.id = 'gridEditorContainer';

  // Create main grid wrapper for proper CSS grid layout
  const appRoot = document.getElementById('app-root');
  if (appRoot) {
    // Create wrapper inside main element
    const mainElement = appRoot.querySelector('main');
    if (mainElement) {
      const gridWrapper = document.createElement('div');
      gridWrapper.className = 'app12-main-grid';

      // Add grid-editor container to wrapper (first row)
      gridWrapper.appendChild(gridEditorContainer);

      // Append wrapper to main (musical-grid will be added later)
      mainElement.appendChild(gridWrapper);
    } else {
      // Fallback: append directly to app-root
      appRoot.appendChild(gridEditorContainer);
    }
  }
}

// ========== INITIALIZATION ==========

async function initializeApp() {
  console.log('Initializing App15: Plano y Sucesión de Intervalos...');

  // Setup piano preload in background (reduces latency on first play)
  setupPianoPreload({ delay: 300 });

  // Inject DOM elements to mirror App12 layout (controls + grid)
  injectGridEditor();

  // Wait for template DOM to settle
  await new Promise(resolve => setTimeout(resolve, 50));

  // Create musical grid (aligned to timeline like App12)
  const mainGridWrapper = document.querySelector('.app12-main-grid');
  musicalGrid = createMusicalGrid({
    parent: mainGridWrapper || document.getElementById('app-root'),
    notes: TOTAL_NOTES,
    pulses: TOTAL_PULSES,
    startMidi: 60,
    fillSpaces: true, // Align cells to the spaces between pulse markers
    cellClassName: 'musical-cell',
    activeClassName: 'active',
    highlightClassName: 'highlight',
    showIntervals: {
      horizontal: false,
      vertical: false,
      cellLines: intervalLinesEnabledState
    },
    intervalColor: '#4A9EFF',
    cellRenderer: (noteIndex, pulseIndex, cellElement) => {
      clearElement(cellElement);
    },
    // Dummy onDotClick to enable np-dot-clickable class (hover effects)
    // Actual interaction handled by drag system via mousedown
    onDotClick: () => {}
  });

  // Apply interval-mode class to disable cell hover and pointer cursor
  const gridContainer = document.querySelector('.grid-container');
  if (gridContainer) {
    gridContainer.classList.add('interval-mode');
  }

  // Initialize interval renderer from interval-sequencer module
  intervalRenderer = createIntervalRenderer({
    getTimelineContainer: () => musicalGrid?.getTimelineContainer?.(),
    getMatrixContainer: () => musicalGrid?.getMatrixContainer?.(),
    totalSpaces: TOTAL_SPACES
  });

  // ========== SETUP DRAG LISTENERS FOR iT MODIFICATION ==========
  // Attach mousedown listeners to all N-P dots for drag support
  // We need to intercept mousedown BEFORE click fires
  const matrixInner = musicalGrid.getMatrixContainer?.();
  if (matrixInner) {
    // Use event delegation for better performance
    matrixInner.addEventListener('mousedown', (e) => {
      const dot = e.target.closest('.np-dot');
      if (!dot || !dot.classList.contains('np-dot-clickable')) return;

      // Extract noteIndex and spaceIndex from the dot's parent cell
      const cell = dot.closest('.musical-cell');
      if (!cell) return;

      const noteIndex = parseInt(cell.dataset.note, 10);
      const spaceIndex = parseInt(cell.dataset.pulse, 10); // Actually spaceIndex

      if (isNaN(noteIndex) || isNaN(spaceIndex)) return;

      handleDotMouseDown(noteIndex, spaceIndex, e, musicalGrid);
    });

    // Global mousemove handler
    document.addEventListener('mousemove', (e) => {
      handleMouseMove(e, musicalGrid);
    });

    // Global mouseup handler
    document.addEventListener('mouseup', (e) => {
      handleMouseUp(e, musicalGrid);
    });
  }

  // ResizeObserver to keep timeline bars aligned with grid cells on resize
  const matrixContainer = musicalGrid.getMatrixContainer?.();
  if (matrixContainer) {
    const resizeObserver = new ResizeObserver(() => {
      // Recalculate temporal bars positions when matrix size changes
      if (currentIntervals.length > 0) {
        renderTemporalBars(currentIntervals);
      }
    });
    resizeObserver.observe(matrixContainer);
  }

  // Reposition controls into grid wrapper (CSS Grid handles placement)
  const controls = document.querySelector('.controls');
  const gridWrapper = document.querySelector('.app12-main-grid');

  if (controls && gridWrapper) {
    controls.remove();

    // Create container for controls (grid-column: 1, grid-row: 2 via CSS)
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'app12-controls-container';
    controlsContainer.appendChild(controls);

    // Add to wrapper - CSS Grid will position it in bottom-left
    gridWrapper.appendChild(controlsContainer);
  }

  // Create grid editor with scroll enabled on mobile, using interval zigzag mode
  const isMobile = window.innerWidth <= 900;
  gridEditor = createGridEditor({
    container: gridEditorContainer,
    noteRange: [0, 11],
    pulseRange: [0, TOTAL_SPACES - 1],
    maxPairs: TOTAL_SPACES,
    mode: 'interval',
    showZigzag: true,
    showIntervalLabels: false,
    leftZigzagLabels: { topText: 'iS', bottomText: 'iT' },
    autoJumpDelayMs: 500,
    intervalModeOptions: {
      basePair: { note: 0, pulse: 0 },
      hideInitialPair: true,
      allowSilence: true,
      firstIntervalPositiveOnly: true,
      maxTotalPulse: TOTAL_PULSES - 1
    },
    scrollEnabled: isMobile,
    containerSize: isMobile ? { maxHeight: '180px', width: '100%' } : null,
    columnSize: isMobile ? { width: '80px', minHeight: '150px' } : null,
    getPolyphonyEnabled: () => polyphonyEnabled,
    onPairsChange: (pairs) => {
      currentPairs = pairs;
      updateIntervalsFromPairs(pairs);
      syncGridFromPairs(pairs);
    }
  });

  // Initialize highlight controller using shared module
  highlightController = createMatrixHighlightController({
    musicalGrid,
    gridEditor,
    totalNotes: TOTAL_NOTES,
    currentBPM: currentBPM
  });

  // Initialize audio on first grid-editor interaction (improves responsiveness)
  let audioInitializedFromGrid = false;
  gridEditorContainer?.addEventListener('focusin', async () => {
    if (!audioInitializedFromGrid) {
      audioInitializedFromGrid = true;
      await initAudio();
    }
  }, { once: true });

  // Wait for DOM to be fully rendered
  await new Promise(resolve => setTimeout(resolve, 30));

  // Query control buttons AFTER template has rendered
  playBtn = document.getElementById('playBtn');
  randomBtn = document.getElementById('randomBtn');
  resetBtn = document.getElementById('resetBtn');

  playBtn?.addEventListener('click', handlePlay);
  resetBtn?.addEventListener('click', handleReset);
  // NOTE: randomBtn click is handled by initRandomMenu() below (shortpress → handleRandom, longpress → open menu)

  // P1 Toggle (Pulse 0 special sound) - MUST be before mixer init
  const startIntervalToggle = document.getElementById('startIntervalToggle');
  const startSoundRow = document.querySelector('.interval-select-row');
  if (startIntervalToggle && startSoundRow) {
    window.__p1Controller = initP1ToggleUI({
      checkbox: startIntervalToggle,
      startSoundRow,
      storageKey: 'app15:p1Toggle',
      onChange: async (enabled) => {
        const audioInstance = await initAudio();
        if (audioInstance && typeof audioInstance.setStartEnabled === 'function') {
          audioInstance.setStartEnabled(enabled);
        }
      }
    });
  }

  // Mixer integration (longpress on play button)
  const mixerMenu = document.getElementById('mixerMenu');
  if (mixerMenu) {
    initMixerMenu({
      menu: mixerMenu,
      triggers: [playBtn].filter(Boolean),
      channels: [
        { id: 'pulse', label: 'Pulso', allowSolo: true },
        { id: 'instrument', label: 'Piano', allowSolo: true },
        { id: 'master', label: 'Master', allowSolo: false, isMaster: true }
      ]
    });
  }

  // Mixer state persistence
  const MIXER_STORAGE_KEY = 'app15-mixer';
  const MIXER_CHANNELS = ['pulse', 'instrument'];

  // Load saved mixer state
  function loadMixerState() {
    try {
      const saved = localStorage.getItem(MIXER_STORAGE_KEY);
      if (!saved) return;
      const state = JSON.parse(saved);

      // Restore master
      if (state.master) {
        if (typeof state.master.volume === 'number') setVolume(state.master.volume);
        if (typeof state.master.muted === 'boolean') setMute(state.master.muted);
      }

      // Restore channels
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

  // Save mixer state on changes
  let mixerSaveTimeout = null;
  subscribeMixer((snapshot) => {
    // Debounce saves to avoid excessive writes
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

  // Load mixer state after a short delay (after mixer is initialized)
  setTimeout(loadMixerState, 50);

  // Audio toggles (sync with mixer)
  const pulseToggleBtn = document.getElementById('pulseToggleBtn');
  if (pulseToggleBtn) {
    const globalMixer = getMixer();
    initAudioToggles({
      toggles: [
        {
          id: 'pulse',
          button: pulseToggleBtn,
          storageKey: 'app15:pulseAudio',
          mixerChannel: 'pulse',
          defaultEnabled: true,
          onChange: (enabled) => {
            if (audio && typeof audio.setPulseEnabled === 'function') {
              audio.setPulseEnabled(enabled);
            }
          }
        }
      ],
      storage: {
        load: () => preferenceStorage.load() || {},
        save: (data) => {
          Object.entries(data).forEach(([key, value]) => {
            preferenceStorage.save({ [key]: value });
          });
        }
      },
      mixer: globalMixer,
      subscribeMixer
    });
  }

  // Random menu (longpress to open configuration)
  const randomMenu = document.getElementById('randomMenu');
  if (randomBtn && randomMenu) {
    initRandomMenu(randomBtn, randomMenu, handleRandom);
  }

  // Color picker - load saved value and setup change listener
  const selectColor = document.getElementById('selectColor');
  if (selectColor) {
    // Load saved color
    const prefs = preferenceStorage.load() || {};
    if (prefs.selectColor) {
      selectColor.value = prefs.selectColor;
      document.documentElement.style.setProperty('--select-color', prefs.selectColor);
    }

    selectColor.addEventListener('input', (e) => {
      const color = e.target.value;
      document.documentElement.style.setProperty('--select-color', color);
      const currentPrefs = preferenceStorage.load() || {};
      currentPrefs.selectColor = color;
      preferenceStorage.save(currentPrefs);
    });
  }

  // Polyphony toggle
  const polyphonyToggle = document.getElementById('polyphonyToggle');
  if (polyphonyToggle) {
    const prefs = preferenceStorage.load() || {};
    polyphonyEnabled = prefs.polyphony === '1'; // Default false
    polyphonyToggle.checked = polyphonyEnabled;

    polyphonyToggle.addEventListener('change', (e) => {
      polyphonyEnabled = e.target.checked;
      const currentPrefs = preferenceStorage.load() || {};
      currentPrefs.polyphony = polyphonyEnabled ? '1' : '0';
      preferenceStorage.save(currentPrefs);

      if (!polyphonyEnabled && gridEditor) {
        const existingPairs = gridEditor.getPairs();
        const pulsesMap = new Map();
        const filteredPairs = [];

        existingPairs.forEach(pair => {
          if (!pulsesMap.has(pair.pulse)) {
            pulsesMap.set(pair.pulse, true);
            filteredPairs.push(pair);
          }
        });

        gridEditor.setPairs(filteredPairs);
        syncGridFromPairs(filteredPairs);
      }
    });
  }

  // Wire instrument dropdown to audio engine
  window.addEventListener('sharedui:instrument', async (e) => {
    const instrument = e.detail.instrument;
    await initAudio();
    await audio.setInstrument(instrument);

    const currentPrefs = preferenceStorage.load() || {};
    currentPrefs.selectedInstrument = instrument;
    preferenceStorage.save(currentPrefs);
  });

  // Factory reset using shared module
  registerFactoryReset({
    storage: preferenceStorage,
    onBeforeReload: () => {
      handleReset();

      // Clear keys with separate namespace (used by shared UI components)
      localStorage.removeItem('app15:p1Toggle');
      localStorage.removeItem('app15:pulseAudio');

      // Reset mixer to factory defaults (remove saved state)
      localStorage.removeItem('app15-mixer');

      // Reset random menu to factory defaults (iS=11, iT=4, allow silences)
      const randISMax = document.getElementById('randISMax');
      const randITMax = document.getElementById('randITMax');
      const randAllowSilences = document.getElementById('randAllowSilences');
      if (randISMax) randISMax.value = '11';
      if (randITMax) randITMax.value = '4';
      if (randAllowSilences) randAllowSilences.checked = true;
    }
  });

  // Load saved state after wiring everything
  loadSavedState();

  // Auto-focus is handled by grid-editor's renderIntervalMode()

  console.log('App15 initialized successfully');
}


// Wait for DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
