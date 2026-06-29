// App15: Plano y Sucesión de Intervalos
// Extended version of App12 that works with intervals (iS-iT) instead of absolute positions

import { createMusicalGrid } from '../../libs/musical-grid/index.js';
import { initMixerMenu } from '../../libs/app-common/mixer-menu.js';
import { initRandomMenu } from '../../libs/random/menu.js';
import { initP1ToggleUI } from '../../libs/shared-ui/sound-dropdown.js';
import { initAudioToggles } from '../../libs/app-common/audio-toggles.js';
import { getMixer, subscribeMixer } from '../../libs/sound/index.js';
import { registerFactoryReset, createPreferenceStorage } from '../../libs/app-common/preferences.js';
import { createMatrixHighlightController } from '../../libs/app-common/matrix-highlight-controller.js';
import { withPlayButtonLoading } from '../../libs/app-common/play-loading.js';
import { clearElement } from '../../libs/app-common/dom-utils.js';
import { intervalsToPairs } from '../../libs/matrix-seq/index.js';
import { createMelodicAudioInitializer, setupAudioDefaults, CHANNEL_TIERS, createMixerPersistence } from '../../libs/app-common/audio-init.js';
import { setupPianoPreload, isPianoLoaded } from '../../libs/sound/piano.js';
import { createBpmController } from '../../libs/app-common/bpm-controller.js';
import { initIdleCaretFlash } from '../../libs/app-common/idle-caret-flash.js';

// Import interval-sequencer module utilities
import {
  fillGapsWithSilences,
  pairsToIntervals,
  createIntervalRenderer
} from '../../libs/interval-sequencer/index.js';
import { createIntervalLabelBar } from '../../libs/shared-ui/interval-label-bar.js';
import { reorderControls } from '../../libs/app-common/template.js';

// ========== CONFIGURATION ==========
const TOTAL_PULSES = 9;   // Horizontal: 0-8
const TOTAL_NOTES = 12;   // Vertical: 0-11 (MIDI 60-71)
const TOTAL_SPACES = 8;   // Spaces between pulses: 0-7 (total pulses = 9)
const DEFAULT_BPM = 90;
const MIN_BPM = 50;
const MAX_BPM = 150;

// ========== STATE ==========
let audio = null;
let musicalGrid = null;
let gridEditor = null;
let bpmController = null;
let currentBPM = DEFAULT_BPM;
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
let playHighlightTimeouts = [];

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

    // Configuració canònica d'àudio (FX, canals); valors a CANONICAL_FX
    if (audio) {
      setupAudioDefaults(audio, { channels: CHANNEL_TIERS.MELODIC_FULL });
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

  const playIcon = playBtn?.querySelector('.icon-play');
  const stopIcon = playBtn?.querySelector('.icon-stop');

  // U-27: estat de càrrega compartit — apareix només si l'init triga
  // (>120ms) i es restaura sempre, també en error.
  await withPlayButtonLoading(playBtn, () => initAudio());

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

  // Register declarative note provider: engine schedules notes automatically in tick()
  audio.registerNoteProvider('melody', (step) => {
    const notes = pulseGroups[step];
    if (!notes || !notes.length) return null;
    return notes.map(noteData => ({
      midi: noteData.midi,
      duration: (noteData.temporalInterval * intervalSec) * 0.9,
      velocity: 0.8
    }));
  });

  // Start TimelineAudio transport-based playback
  audio.play(
    totalPulseSounds,
    intervalSec,
    new Set(), // No accent sounds (pulse plays automatically on all beats)
    false, // No loop initially
    (step) => {
      // onPulse callback: timeline/editor cursor only. Note-duration
      // highlights are scheduled through `onSchedule` below, next to the
      // engine's own note scheduling, so they line up with the sounding note.
      musicalGrid?.updatePlayhead?.(step);
      highlightController?.highlightPulse(step);

      // Highlight de l'EDITOR (iS + iT). Va al callback (que corre a CADA
      // pols) i no a `schedulePlayNoteHighlights` (que només s'executa quan
      // hi ha nota), perquè els SILENCIS també s'il·luminin. Toggle per rang
      // re-avaluat a cada pols: la cel·la queda encesa mentre dura l'iT de la
      // nota (`start <= step < start + iT`), com App34/35.
      document.querySelectorAll('.editor-cell[data-pulse]').forEach(c => {
        const start = parseInt(c.dataset.pulse, 10);
        const it = parseInt(c.dataset.it, 10) || 1;
        c.classList.toggle('playing', step >= start && step < start + it);
      });
    },
    () => {
      // onComplete: delay stop so last pulse highlight is visible
      const lastNoteDelay = intervalSec * 0.9 * 1000;
      setTimeout(() => stopPlayback(), lastNoteDelay);
    },
    {
      onSchedule: (step, when) => {
        schedulePlayNoteHighlights(step, when, pulseGroups, intervalSec);
      }
    }
  );
}

function schedulePlayNoteHighlights(step, when, pulseGroups, intervalSec) {
  const notes = pulseGroups[step];
  if (!notes || notes.length === 0) return;

  const toneNow = window.Tone?.now?.() ?? 0;
  const delayMs = Math.max(0, (when - toneNow) * 1000);
  const timeoutId = setTimeout(() => {
    playHighlightTimeouts = playHighlightTimeouts.filter(id => id !== timeoutId);
    notes.forEach(noteData => {
      const noteIndex = noteData.midi - 60;
      const iT = Math.max(1, noteData.temporalInterval || 1);
      showPlayNoteHighlight(noteIndex, step, iT, intervalSec);
    });
  }, delayMs);
  playHighlightTimeouts.push(timeoutId);
}

/**
 * Pinta un rectangle de "highlight de play" sobre el rang d'una nota
 * (mateixa amplada que el halter d'iT, alçada d'una fila de cel·les).
 * El rectangle viu a la capa `#play-highlight-layer` ancorada al matrix
 * container, es manté visible `iT × intervalSec` segons i s'esborra
 * d'un cop quan la nota acaba. Si el usuari atura el playback, els
 * rectangles pendents es netegen via `clearPlayNoteHighlights()`.
 */
function showPlayNoteHighlight(noteIndex, startSpace, iT, intervalSec) {
  if (!musicalGrid) return;
  const matrix = musicalGrid.getMatrixContainer?.();
  if (!matrix) return;

  const widthSpaces = Math.min(iT, TOTAL_SPACES - startSpace);
  const cells = getNoteSpanCells(noteIndex, startSpace, widthSpaces);
  if (cells.length > 0) {
    cells.forEach((cell, index) => {
      cell.classList.add('play-duration-highlight');
      if (index === 0) cell.classList.add('play-duration-highlight-start');
      if (index === cells.length - 1) cell.classList.add('play-duration-highlight-end');
    });
  }

  let layer = matrix.querySelector('#play-highlight-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'play-highlight-layer';
    layer.className = 'play-highlight-layer';
    matrix.appendChild(layer);
  }

  const matrixRect = matrix.getBoundingClientRect();
  if (!matrixRect.width || !matrixRect.height) {
    schedulePlayHighlightCleanup(cells, null, iT, intervalSec);
    return;
  }

  const startCell = musicalGrid.getCellElement(noteIndex, startSpace);
  const endCell = musicalGrid.getCellElement(noteIndex, startSpace + widthSpaces - 1);
  if (!startCell || !endCell) {
    schedulePlayHighlightCleanup(cells, null, iT, intervalSec);
    return;
  }

  const startRect = startCell.getBoundingClientRect();
  const endRect = endCell.getBoundingClientRect();

  const leftPct = ((startRect.left - matrixRect.left) / matrixRect.width) * 100;
  const rightPct = ((endRect.right - matrixRect.left) / matrixRect.width) * 100;
  const topPct = ((startRect.top - matrixRect.top) / matrixRect.height) * 100;
  const heightPct = (startRect.height / matrixRect.height) * 100;

  const rect = document.createElement('div');
  rect.className = 'play-note-highlight';
  rect.style.left = `${leftPct}%`;
  rect.style.width = `${Math.max(0, rightPct - leftPct)}%`;
  rect.style.top = `${topPct}%`;
  rect.style.height = `${heightPct}%`;
  layer.appendChild(rect);

  schedulePlayHighlightCleanup(cells, rect, iT, intervalSec);
}

function getNoteSpanCells(noteIndex, startSpace, widthSpaces) {
  const cells = [];
  for (let p = startSpace; p < startSpace + widthSpaces; p++) {
    const cell = musicalGrid?.getCellElement?.(noteIndex, p);
    if (cell) cells.push(cell);
  }
  return cells;
}

function schedulePlayHighlightCleanup(cells, rect, iT, intervalSec) {
  const durationMs = iT * intervalSec * 1000;
  setTimeout(() => {
    rect?.remove();
    cells.forEach(cell => {
      cell.classList.remove(
        'play-duration-highlight',
        'play-duration-highlight-start',
        'play-duration-highlight-end'
      );
    });
  }, durationMs);
}

function clearPlayNoteHighlights() {
  playHighlightTimeouts.forEach(id => clearTimeout(id));
  playHighlightTimeouts = [];

  if (!musicalGrid) return;
  const matrix = musicalGrid.getMatrixContainer?.();
  const layer = matrix?.querySelector('#play-highlight-layer');
  if (layer) layer.innerHTML = '';
}

function stopPlayback() {
  isPlaying = false;

  // Re-enable random button after playback
  if (randomBtn) randomBtn.disabled = false;

  // Stop audio
  audio?.stop();

  // Clear highlights
  highlightController?.clearHighlights();

  // Amaga el playhead vertical.
  musicalGrid?.hidePlayhead?.();

  // Reset button icon
  const playIcon = playBtn?.querySelector('.icon-play');
  const stopIcon = playBtn?.querySelector('.icon-stop');
  if (playIcon && stopIcon) {
    playIcon.style.display = 'block';
    stopIcon.style.display = 'none';
  }

  // Clear play-note rectangles still pending (and the legacy `.playing`
  // class, in case any older code path adds it).
  clearPlayNoteHighlights();
  document.querySelectorAll('.musical-cell.play-duration-highlight').forEach(cell => {
    cell.classList.remove(
      'play-duration-highlight',
      'play-duration-highlight-start',
      'play-duration-highlight-end'
    );
  });
  document.querySelectorAll('.musical-cell.playing').forEach(cell => {
    cell.classList.remove('playing');
  });

  // Clear highlights de les cel·les de l'editor.
  document.querySelectorAll('.editor-cell.playing').forEach(cell => {
    cell.classList.remove('playing');
  });
}

// ========== GRID SYNCHRONIZATION ==========

// Note: interval-span tubes removed - iT bars in timeline are sufficient for showing duration

/**
 * Render temporal bars using interval-sequencer module
 * Wrapper function that delegates to the module's renderer
 */
function renderTemporalBars(intervals = []) {
  if (!intervalRenderer) return;
  intervalRenderer.render(intervals);
}

/**
 * Render iT halters DINS la grid, sota cada cel·la activa (estil App13).
 * Substitueix visualment el `it-bars-layer` antic (que queda ocultat per CSS).
 *
 * Cada parell { note, pulse, iT, isRest } produeix un halter amb:
 *  - left/width en % del matrix container (basat en TOTAL_SPACES)
 *  - top: just sota la fila de la nota corresponent
 *  - variant 'dashed' per silencis
 */
function renderItHalterCellLayer(pairs) {
  if (!musicalGrid) return;
  const matrix = musicalGrid.getMatrixContainer?.();
  if (!matrix) return;

  // Capa pròpia ancorada al matrix container
  let layer = matrix.querySelector('#it-bar-cell-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'it-bar-cell-layer';
    layer.className = 'it-bar-cell-layer';
    matrix.appendChild(layer);
  }
  layer.innerHTML = '';

  const visible = (pairs || []).filter(p =>
    p && p.note != null && p.pulse != null &&
    p.pulse >= 0 && p.pulse <= TOTAL_SPACES - 1 &&
    p.note >= 0 && p.note <= TOTAL_NOTES - 1
  );

  // Mesurem cada cel·la individualment per ancorar el halter exactament
  // sota la seva vora inferior (= on acaba la fletxa rosa de la línia iS).
  // Això evita errors d'arrodoniment quan les files no són uniformes.
  const matrixRect = matrix.getBoundingClientRect();
  if (!matrixRect.width || !matrixRect.height) return;

  visible.forEach(p => {
    const iT = Math.max(1, p.temporalInterval || 1);
    const startSpace = p.pulse;
    const widthSpaces = Math.min(iT, TOTAL_SPACES - startSpace);

    const startCell = musicalGrid.getCellElement(p.note, startSpace);
    const endCell = musicalGrid.getCellElement(p.note, startSpace + widthSpaces - 1);
    if (!startCell || !endCell) return;

    const startRect = startCell.getBoundingClientRect();
    const endRect = endCell.getBoundingClientRect();

    const halter = createIntervalLabelBar({
      startPercent: 0,
      widthPercent: 100,
      label: iT,
      variant: p.isRest ? 'dashed' : 'solid'
    });

    // Coordenades en % del matrix container
    const leftPct = ((startRect.left - matrixRect.left) / matrixRect.width) * 100;
    const rightPct = ((endRect.right - matrixRect.left) / matrixRect.width) * 100;
    const bottomPct = ((startRect.bottom - matrixRect.top) / matrixRect.height) * 100;

    halter.style.left = `${leftPct}%`;
    halter.style.width = `${Math.max(0, rightPct - leftPct)}%`;
    halter.style.top = `${bottomPct}%`;

    layer.appendChild(halter);
  });
}

function syncGridFromPairs(pairs) {
  if (!musicalGrid) return;
  currentPairs = pairs;

  // PERFORMANCE: Incremental update instead of full redraw
  // Track which cells should be active
  const visiblePairs = pairs.filter(p => p.note !== null && p.note !== undefined);
  // Convert pulse to space indices for cell tracking (fillSpaces mode)
  const activeCells = new Set();
  const restCells = new Set();
  visiblePairs.forEach(p => {
    const iT = p.temporalInterval || 1;
    const startSpace = p.pulse;
    const endSpace = p.pulse + iT - 1;
    if (p.isRest) {
      // Track rest cells for dotted line rendering
      for (let space = startSpace; space <= endSpace; space++) {
        if (space >= 0) restCells.add(`${p.note}-${space}`);
      }
    } else {
      for (let space = startSpace; space <= endSpace; space++) {
        if (space >= 0) activeCells.add(`${p.note}-${space}`);
      }
    }
  });

  // Clear only cells that are no longer active or rest
  document.querySelectorAll('.musical-cell.active, .musical-cell.rest').forEach(cell => {
    const note = parseInt(cell.dataset.note);
    const pulse = parseInt(cell.dataset.pulse);
    const key = `${note}-${pulse}`;

    if (!activeCells.has(key)) cell.classList.remove('active');
    if (!restCells.has(key)) cell.classList.remove('rest');
  });

  // Clear interval lines (App14 style vertical bars)
  clearIntervalLines();

  // Filter out invalid pairs (null notes or pulses out of range)
  const validPairs = visiblePairs.filter(p =>
    p.pulse >= 0 && p.pulse <= TOTAL_PULSES - 1 &&
    p.note >= 0 && p.note <= TOTAL_NOTES - 1
  );

  // Activate cells and render silences
  validPairs.forEach(({ note, pulse, isRest, temporalInterval }) => {
    const iT = temporalInterval || 1;
    const startSpace = pulse;
    const endSpace = pulse + iT - 1;

    if (isRest) {
      // Silence: dotted line on the note row
      for (let space = startSpace; space <= endSpace; space++) {
        if (space < 0) continue;
        const cell = musicalGrid.getCellElement(note, space);
        if (cell) cell.classList.add('rest');
      }
    } else {
      for (let space = startSpace; space <= endSpace; space++) {
        if (space < 0) continue;
        const cell = musicalGrid.getCellElement(note, space);
        if (cell) cell.classList.add('active');
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

  // Render halters d'iT sota cada cel·la activa (substitueix visualment la capa antiga)
  renderItHalterCellLayer(validPairs);

  // Save to storage
  saveCurrentState();
}

// ========== DRAG HANDLERS FOR HORIZONTAL iT MODIFICATION ==========

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
  // Pointer Events: id del gest per filtrar multi-touch; la captura
  // implícita del touch sobre el dot manté el stream fora de l'element.
  dragState.pointerId = event.pointerId ?? null;
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
  if (dragState.pointerId != null && event.pointerId !== dragState.pointerId) return;

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
  if (event && dragState.pointerId != null && event.pointerId !== dragState.pointerId) return;

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
  dragState.pointerId = null;
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

  // Division line for a noteIndex (where the visual note is now centered):
  // divisionPct = (TOTAL_NOTES - noteIndex) / TOTAL_NOTES * 100
  const cellHeight = 100 / TOTAL_NOTES; // Height of one cell in %

  // Special case: interval 0 - draw vertical line centered on the division line
  if (absInterval === 0) {
    const divisionPct = (TOTAL_NOTES - note2Index) / TOTAL_NOTES * 100;

    const intervalBar = document.createElement('div');
    intervalBar.className = 'interval-bar-vertical interval-zero';

    intervalBar.style.position = 'absolute';
    intervalBar.style.top = `${divisionPct - cellHeight / 2}%`;
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
    intervalNum.style.top = `${divisionPct - cellHeight / 2}%`;
    intervalNum.style.left = `${leftPos}%`;
    intervalNum.style.transform = 'translate(-50%, -100%)'; // Center horizontally, position above

    matrixContainer.appendChild(intervalNum);
    currentIntervalElements.push(intervalNum);
    return;
  }

  // Calculate vertical positions using division lines (bottom edge of each cell)
  // Division line of noteIndex = (TOTAL_NOTES - noteIndex) / TOTAL_NOTES * 100

  const note1Division = (TOTAL_NOTES - note1Index) / TOTAL_NOTES * 100;
  const note2Division = (TOTAL_NOTES - note2Index) / TOTAL_NOTES * 100;

  let topEdge, bottomEdge;

  if (isAscending) {
    // note2 is higher → its division line is visually higher (lower %)
    topEdge = note2Division;
    if (intervalIndex === 0 && note1Index === 0) {
      bottomEdge = 100; // Extend to very bottom of grid
    } else {
      bottomEdge = note1Division;
    }
  } else {
    // note1 is higher → its division line is visually higher (lower %)
    topEdge = note1Division;
    bottomEdge = note2Division;
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

  // Caixa central amb el número, sempre al mig de la línia (com a App14).
  // Per iS(0) la lògica especial més amunt ja gestiona el cas; aquí mai entrem.
  const displayValue = interval > 0 ? `+${absInterval}` : `-${absInterval}`;
  const centerY = (topEdge + bottomEdge) / 2;

  const intervalNum = document.createElement('div');
  intervalNum.className = 'interval-number';
  intervalNum.textContent = displayValue;
  intervalNum.style.position = 'absolute';
  intervalNum.style.zIndex = '16';
  intervalNum.style.top = `${centerY}%`;
  intervalNum.style.left = `${leftPos}%`;
  intervalNum.style.transform = 'translate(-50%, -50%)';

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

  // Auto-play after randomizing (consistent across apps 9+).
  if (!isPlaying) handlePlay();
}

// ========== STORAGE ==========

function saveCurrentState() {
  const prefs = preferenceStorage.load() || {};

  // Save current intervals and initial position
  prefs.intervals = currentIntervals;
  prefs.initialPair = { note: 0, pulse: 0 };

  preferenceStorage.save(prefs);
}


// ========== NUZIC iS-iT EDITOR ==========

function createNuzicIntervalEditor(gridContainer) {
  const editorEl = document.createElement('div');
  editorEl.className = 'interval-editor';
  gridEditorContainer = editorEl; // For idle-caret-flash target

  // iS row (sound intervals — pink)
  const isBar = document.createElement('div');
  isBar.className = 'editor-bar editor-bar--is';
  const isLabel = document.createElement('div');
  isLabel.className = 'editor-label editor-label--is';
  isLabel.textContent = 'iS';
  isBar.appendChild(isLabel);
  const isCells = document.createElement('div');
  isCells.className = 'editor-cells';
  const isEndMarker = document.createElement('div');
  isEndMarker.className = 'editor-end-marker';
  isCells.appendChild(isEndMarker);
  isBar.appendChild(isCells);

  // iT row (temporal intervals — cream)
  const itBar = document.createElement('div');
  itBar.className = 'editor-bar editor-bar--it';
  const itLabel = document.createElement('div');
  itLabel.className = 'editor-label editor-label--it';
  itLabel.textContent = 'iT';
  itBar.appendChild(itLabel);
  const itCells = document.createElement('div');
  itCells.className = 'editor-cells';
  const itEndMarker = document.createElement('div');
  itEndMarker.className = 'editor-end-marker';
  itCells.appendChild(itEndMarker);
  itBar.appendChild(itCells);

  editorEl.appendChild(isBar);
  editorEl.appendChild(itBar);

  // Insert as grid-row: 3 inside grid-container
  gridContainer.appendChild(editorEl);

  // --- Tooltip ---
  let tooltipEl = null;
  let tooltipTimer = null;
  function showTooltip(anchor, message) {
    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.className = 'editor-tooltip';
      document.body.appendChild(tooltipEl);
    }
    tooltipEl.textContent = message;
    const rect = anchor.getBoundingClientRect();
    tooltipEl.style.left = `${rect.left}px`;
    tooltipEl.style.top = `${rect.bottom + 4}px`;
    tooltipEl.classList.add('visible');
    clearTimeout(tooltipTimer);
    tooltipTimer = setTimeout(() => tooltipEl.classList.remove('visible'), 2000);
  }

  // --- Editor state ---
  let pendingIS = null;
  let pendingIT = null;
  let lastEnteredType = 'it'; // start focused on iS (opposite)
  let autoJumpTimer = null;

  function getCurrentSum() {
    return currentIntervals.reduce((s, iv) => s + (iv.temporalInterval || 0), 0);
  }

  function getCurrentNote() {
    return currentIntervals.reduce((n, iv) => n + (iv.isRest ? 0 : (iv.soundInterval || 0)), 0);
  }

  // --- Cell factories ---
  function createReadonlyCell(type) {
    const cell = document.createElement('input');
    cell.type = 'text';
    cell.className = `editor-cell editor-cell--${type}`;
    cell.placeholder = ' ';
    cell.readOnly = true;
    return cell;
  }

  // Helper: cel·les editables (value + input) en ordre de columna
  // (iS0, iT0, iS1, iT1, …, iSinput, iTinput). Per a Tab/Shift+Tab.
  function getEditableCellsColumnOrder() {
    const iss = Array.from(isCells.querySelectorAll('.editor-cell:not([readonly])'));
    const its = Array.from(itCells.querySelectorAll('.editor-cell:not([readonly])'));
    const max = Math.max(iss.length, its.length);
    const result = [];
    for (let i = 0; i < max; i++) {
      if (iss[i]) result.push(iss[i]);
      if (its[i]) result.push(its[i]);
    }
    return result;
  }

  // Navegació de tecles compartida (mateix patró que App12):
  // Enter (commit/blur), Tab (columna), Arrows horitzontals (mateixa fila),
  // Arrows verticals (salta entre iS i iT). preventDefault perquè no quedi
  // capturat pel caret de l'input.
  function addCellNavigation(cell, type) {
    cell.addEventListener('keydown', (e) => {
      // ENTER salta a la casella següent, igual que Tab (abans feia blur).
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        const idx = cell.dataset.intervalIndex;
        const row = type;
        cell.blur(); // el blur pot re-renderitzar — re-pesquem
        const cells = getEditableCellsColumnOrder();
        let i = cells.indexOf(cell);
        if (i === -1 && idx !== undefined) {
          i = cells.findIndex(c =>
            c.dataset.intervalIndex === idx
            && (c.classList.contains('editor-cell--is') ? 'is' : 'it') === row
          );
        }
        const dst = e.shiftKey ? cells[i - 1] : cells[i + 1];
        if (dst) dst.focus();
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const rowCells = type === 'is'
          ? Array.from(isCells.querySelectorAll('.editor-cell:not([readonly])'))
          : Array.from(itCells.querySelectorAll('.editor-cell:not([readonly])'));
        const i = rowCells.indexOf(cell);
        const dst = e.key === 'ArrowRight' ? rowCells[i + 1] : rowCells[i - 1];
        if (dst) dst.focus();
        return;
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const otherRow = type === 'is' ? 'it' : 'is';
        let dst = null;
        if (cell.dataset.intervalIndex !== undefined) {
          dst = document.querySelector(
            `.editor-cell--${otherRow}[data-interval-index="${cell.dataset.intervalIndex}"]:not([readonly])`
          );
        }
        if (!dst) {
          // Cel·la d'input: salta a l'input de l'altra fila.
          const otherContainer = otherRow === 'is' ? isCells : itCells;
          dst = otherContainer.querySelector('.editor-input');
        }
        if (dst) dst.focus();
      }
    });
  }

  function createValueCell(type, displayValue, intervalIndex) {
    const cell = document.createElement('input');
    cell.type = 'text';
    cell.inputMode = 'numeric';
    cell.maxLength = 3;
    cell.className = `editor-cell editor-cell--${type} it-end`;
    cell.value = String(displayValue);
    cell.placeholder = ' ';
    cell.readOnly = false;
    cell.dataset.intervalIndex = intervalIndex;

    let originalValue = cell.value;

    cell.addEventListener('focus', () => {
      originalValue = cell.value;
      cell.select();
    });

    addCellNavigation(cell, type);

    cell.addEventListener('blur', () => {
      const val = cell.value.trim();
      if (!val || val === originalValue) {
        cell.value = originalValue;
        return;
      }

      const idx = parseInt(cell.dataset.intervalIndex);
      const iv = currentIntervals[idx];
      if (!iv) { cell.value = originalValue; return; }

      // Accept 'S' or 's' to convert note → silence (iS row only)
      if (type === 'is' && /^[sS]$/.test(val)) {
        iv.soundInterval = 0;
        iv.isRest = true;
        updatePairsFromIntervals();
        renderEditorCells();
        syncGridFromPairs(currentPairs);
        return;
      }

      if (!/^[+-]?\d+$/.test(val)) {
        cell.value = originalValue;
        return;
      }

      const num = parseInt(val);

      if (type === 'is') {
        // First iS must be positive
        if (idx === 0 && num <= 0) {
          showTooltip(cell, 'Primer iS > 0');
          cell.value = originalValue;
          return;
        }
        // Validate: all subsequent notes must stay in [0,11]
        const oldIS = iv.soundInterval;
        const wasRest = iv.isRest;
        iv.soundInterval = num;
        delete iv.isRest;  // Converting silence to note
        let note = 0;
        let valid = true;
        for (const interval of currentIntervals) {
          if (!interval.isRest) note += interval.soundInterval || 0;
          if (note < 0 || note > 11) { valid = false; break; }
        }
        if (!valid) {
          iv.soundInterval = oldIS;
          if (wasRest) iv.isRest = true;  // Restore rest flag on revert
          showTooltip(cell, 'Valor invalida seqüència');
          cell.value = originalValue;
          return;
        }
      } else {
        // iT: 1-8, total sum ≤ TOTAL_SPACES
        if (num < 1 || num > 8) {
          showTooltip(cell, 'iT: 1-8');
          cell.value = originalValue;
          return;
        }
        const oldIT = iv.temporalInterval;
        const newSum = getCurrentSum() - oldIT + num;
        if (newSum > TOTAL_SPACES) {
          showTooltip(cell, `iT máximo: ${TOTAL_SPACES - getCurrentSum() + oldIT}`);
          cell.value = originalValue;
          return;
        }
        iv.temporalInterval = num;
      }

      // Update pairs, re-render, sync grid
      updatePairsFromIntervals();
      renderEditorCells();
      syncGridFromPairs(currentPairs);
    });

    return cell;
  }

  // --- Render ---
  // 2 cells per pulse-space (cells are half-space wide, square)
  function renderEditorCells() {
    isCells.querySelectorAll('.editor-cell').forEach(c => c.remove());
    itCells.querySelectorAll('.editor-cell').forEach(c => c.remove());

    const sum = getCurrentSum();

    // Build cells for each entered interval (no P0 — iS0 starts at pulse 0)
    // Always 2 cells per interval (value + 1 separator), regardless of iT
    // ZIGZAG: iS value at position 0, iT value at position 1 (shifted right)
    // Pols acumulat: l'interval i sona al pols = suma de temporalInterval[0..i-1]
    // (mateix càlcul que `intervalsToPairs`, que alimenta `pulseGroups` del play).
    let cumulativePulse = 0;
    for (let i = 0; i < currentIntervals.length; i++) {
      const iv = currentIntervals[i];
      const iT = iv.temporalInterval || 1;
      const iS = iv.soundInterval || 0;
      const isRest = iv.isRest || false;

      // iS row: [value][pink separator]
      const isDisplay = isRest ? 'S' : (iS > 0 ? `+${iS}` : String(iS));
      const isValueCell = createValueCell('is', isDisplay, i);
      isValueCell.dataset.pulse = String(cumulativePulse);
      isValueCell.dataset.it = String(iT);
      isCells.insertBefore(isValueCell, isEndMarker);
      isCells.insertBefore(createReadonlyCell('is'), isEndMarker);

      // iT row: [cream separator][value]  — shifted right (ZIGZAG)
      itCells.insertBefore(createReadonlyCell('it'), itEndMarker);
      const itValueCell = createValueCell('it', String(iT), i);
      itValueCell.dataset.pulse = String(cumulativePulse);
      itValueCell.dataset.it = String(iT);
      itCells.insertBefore(itValueCell, itEndMarker);

      cumulativePulse += iT;
    }

    // If sequence not full: add input cells with ZIGZAG offset
    if (sum < TOTAL_SPACES) {
      // iS: [white input][pink ext]  — input at left
      const isInput = createInputCell('is');
      isCells.insertBefore(isInput, isEndMarker);
      isCells.insertBefore(createReadonlyCell('is'), isEndMarker);

      // iT: [cream ext][white input]  — input shifted right (ZIGZAG)
      itCells.insertBefore(createReadonlyCell('it'), itEndMarker);
      const itInput = createInputCell('it');
      itCells.insertBefore(itInput, itEndMarker);

      // Zigzag focus: iS first, then iT after entering iS
      const focusTarget = lastEnteredType === 'is' ? itInput : isInput;
      setTimeout(() => focusTarget.focus(), 30);
    }

    // End markers
    isEndMarker.style.display = sum >= TOTAL_SPACES ? 'flex' : 'none';
    itEndMarker.style.display = sum >= TOTAL_SPACES ? 'flex' : 'none';
  }

  // --- Input cell ---
  function createInputCell(type) {
    const cell = document.createElement('input');
    cell.type = 'text';
    cell.inputMode = 'numeric';
    cell.maxLength = 3;
    cell.className = `editor-cell editor-cell--${type} editor-input`;
    cell.readOnly = false;

    cell.addEventListener('input', (e) => {
      const val = e.target.value;
      if (val === '' || val === '-' || val === '+') return;

      // Accept 'S'/'s' for silence (iS input only)
      if (type === 'is' && /^[sS]$/.test(val)) {
        // Silence needs an iT value — set pendingIS as silence marker
        pendingIS = 'S';
        lastEnteredType = 'is';
        clearTimeout(autoJumpTimer);
        autoJumpTimer = setTimeout(() => {
          if (pendingIT !== null) {
            commitInterval();
          } else {
            const itInput = itCells.querySelector('.editor-input');
            if (itInput) itInput.focus();
          }
        }, 300);
        return;
      }

      if (!/^[+-]?\d+$/.test(val)) { e.target.value = ''; return; }

      const num = parseInt(val);

      if (type === 'is') {
        const curNote = getCurrentNote();
        const isFirst = currentIntervals.length === 0;

        if (isFirst && num <= 0) {
          showTooltip(cell, 'Primer iS debe ser > 0');
          e.target.value = '';
          clearTimeout(autoJumpTimer);
          pendingIS = null;
          return;
        }

        const newNote = curNote + num;
        if (newNote < 0 || newNote > 11) {
          const maxUp = 11 - curNote;
          const maxDown = -curNote;
          showTooltip(cell, `iS: ${maxDown} a +${maxUp}`);
          e.target.value = '';
          clearTimeout(autoJumpTimer);
          pendingIS = null;
          return;
        }

        pendingIS = num;
        lastEnteredType = 'is';

        // Delay for multi-digit input (e.g. "11", "-5")
        clearTimeout(autoJumpTimer);
        autoJumpTimer = setTimeout(() => {
          if (pendingIT !== null) {
            commitInterval();
          } else {
            const itInput = itCells.querySelector('.editor-input');
            if (itInput) itInput.focus();
          }
        }, 4000);

      } else {
        // iT validation
        if (num < 1 || num > 8) {
          showTooltip(cell, 'iT: 1-8');
          e.target.value = '';
          clearTimeout(autoJumpTimer);
          pendingIT = null;
          return;
        }

        const remaining = TOTAL_SPACES - getCurrentSum();
        if (num > remaining) {
          showTooltip(cell, `iT máximo: ${remaining}`);
          e.target.value = '';
          clearTimeout(autoJumpTimer);
          pendingIT = null;
          return;
        }

        pendingIT = num;
        lastEnteredType = 'it';

        if (pendingIS !== null) {
          clearTimeout(autoJumpTimer);
          commitInterval();
        } else {
          const isInput = isCells.querySelector('.editor-input');
          if (isInput) isInput.focus();
        }
      }
    });

    cell.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value) {
        e.preventDefault();
        clearTimeout(autoJumpTimer);

        if (type === 'it') {
          if (pendingIT !== null) {
            pendingIT = null;
          } else if (pendingIS !== null) {
            pendingIS = null;
            const isInput = isCells.querySelector('.editor-input');
            if (isInput) { isInput.value = ''; isInput.focus(); }
          } else if (currentIntervals.length > 0) {
            currentIntervals.pop();
            updatePairsFromIntervals();
            renderEditorCells();
            syncGridFromPairs(currentPairs);
          }
        } else {
          if (pendingIS !== null) {
            pendingIS = null;
          } else if (currentIntervals.length > 0) {
            currentIntervals.pop();
            updatePairsFromIntervals();
            renderEditorCells();
            syncGridFromPairs(currentPairs);
          }
        }
      }
    });

    // Navegació: fletxes, Tab, Enter (compartit amb les cel·les de valor).
    addCellNavigation(cell, type);

    return cell;
  }

  // --- Commit interval pair ---
  function commitInterval() {
    if (pendingIS === null || pendingIT === null) return;

    if (pendingIS === 'S') {
      // Silence: soundInterval=0, isRest=true
      currentIntervals.push({ soundInterval: 0, temporalInterval: pendingIT, isRest: true });
    } else {
      currentIntervals.push({ soundInterval: pendingIS, temporalInterval: pendingIT });
    }
    pendingIS = null;
    pendingIT = null;

    updatePairsFromIntervals();
    renderEditorCells();
    syncGridFromPairs(currentPairs);

    if (getCurrentSum() >= TOTAL_SPACES) {
      const anchor = itCells.querySelector('.editor-end-marker');
      if (anchor) showTooltip(anchor, 'Longitud completa');
    }
  }

  function updatePairsFromIntervals() {
    const basePair = { note: 0, pulse: 0 };
    const allPairs = intervalsToPairs(basePair, currentIntervals);
    currentPairs = allPairs.slice(1);
  }

  // --- Public API (compatible with old gridEditor) ---
  gridEditor = {
    getPairs: () => {
      const basePair = { note: 0, pulse: 0 };
      const allPairs = intervalsToPairs(basePair, currentIntervals);
      return allPairs.slice(1).map(p => ({ ...p }));
    },
    setPairs: (pairs) => {
      currentPairs = pairs.filter(p => p.note !== null);
      currentIntervals = pairsToIntervals(pairs, { note: 0, pulse: 0 });
      pendingIS = null;
      pendingIT = null;
      renderEditorCells();
    },
    clear: () => {
      currentIntervals = [];
      currentPairs = [];
      pendingIS = null;
      pendingIT = null;
      renderEditorCells();
    },
    clearHighlights: () => {
      // No-op: nuzic editor has no per-cell highlights
    },
    destroy: () => {
      editorEl.remove();
    }
  };

  renderEditorCells();
  return editorEl;
}

// ========== INITIALIZATION ==========

async function initializeApp() {
  console.log('Initializing App15: Plano y Sucesión de Intervalos...');

  // Setup piano preload in background (reduces latency on first play)
  setupPianoPreload({ delay: 300 });

  // Create single-column layout wrapper
  const appRoot = document.getElementById('app-root');
  const mainElement = appRoot?.querySelector('main');
  const gridWrapper = document.createElement('div');
  gridWrapper.className = 'app15-main-grid';
  if (mainElement) {
    mainElement.appendChild(gridWrapper);
  } else {
    appRoot.appendChild(gridWrapper);
  }

  // Wait for template DOM to settle
  await new Promise(resolve => setTimeout(resolve, 50));

  // Create musical grid
  musicalGrid = createMusicalGrid({
    parent: gridWrapper,
    notes: TOTAL_NOTES,
    pulses: TOTAL_PULSES,
    // The last pulse (index TOTAL_PULSES-1) renders as a `·` cycle-end
    // marker — visual only, not clickable. Sequence spans 0..7.
    showCycleEnd: true,
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
  document.querySelector('.grid-container')?.classList.add('interval-mode');

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
    // Use event delegation for better performance.
    // Pointer Events: el mateix camí serveix ratolí, tàctil i llapis
    // (amb touch-action:none al .np-dot perquè el navegador no robi el
    // gest per fer scroll — vegeu nuzic-theme.css).
    matrixInner.addEventListener('pointerdown', (e) => {
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

    // Global pointermove handler
    document.addEventListener('pointermove', (e) => {
      handleMouseMove(e, musicalGrid);
    });

    // Global pointerup handler
    document.addEventListener('pointerup', (e) => {
      handleMouseUp(e, musicalGrid);
    });

    // El navegador pot cancel·lar el gest tàctil: netegem sense committejar
    document.addEventListener('pointercancel', (e) => {
      if (!dragState.active) return;
      if (dragState.pointerId != null && e.pointerId !== dragState.pointerId) return;
      resetDragState();
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

  // Ordre nuzic de la fila de controls (helper compartit, H-08) +
  // trasllat dins del gridWrapper (layout propi d'App15).
  const controls = reorderControls();
  if (controls && gridWrapper) {
    gridWrapper.appendChild(controls);
  }

  // Create nuzic iS-iT editor inside grid-container
  const gridContainer = document.querySelector('.grid-container');
  if (gridContainer) {
    createNuzicIntervalEditor(gridContainer);
  }

  // Initialize highlight controller using shared module
  highlightController = createMatrixHighlightController({
    musicalGrid,
    gridEditor,
    totalNotes: TOTAL_NOTES,
    currentBPM: currentBPM,
    getBPM: () => currentBPM
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

  // BPM Controller
  const inputBpm = document.getElementById('inputBpm');
  const bpmUp = document.getElementById('bpmUp');
  const bpmDown = document.getElementById('bpmDown');
  if (inputBpm && bpmUp && bpmDown) {
    bpmController = createBpmController({
      inputEl: inputBpm,
      upBtn: bpmUp,
      downBtn: bpmDown,
      min: MIN_BPM,
      max: MAX_BPM,
      defaultValue: DEFAULT_BPM,
      onChange: (bpm) => { currentBPM = bpm; if (isPlaying && audio) audio.setTempo(bpm); }
    });
    bpmController.attach();
  }

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
        { id: 'start', label: 'P0', allowSolo: true },
        { id: 'pulse', label: 'Pulso', allowSolo: true },
        { id: 'instrument', label: 'Piano', allowSolo: true },
        { id: 'master', label: 'Master', allowSolo: false, isMaster: true }
      ]
    });
  }

  // Mixer state persistence (helper centralitzat)
  const mixerPersist = createMixerPersistence({ storageKey: 'app15-mixer' });
  setTimeout(() => mixerPersist.hydrate(audio), 50);
  mixerPersist.subscribe(audio);

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

  // Auto-focus is handled by editor's renderEditorCells()

  // Idle caret flash on grid editor container
  initIdleCaretFlash({ targets: [gridEditorContainer] });

  console.log('App15 initialized successfully');
}


// Wait for DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
