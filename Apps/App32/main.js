// App32: Plano con Fracción Simple
// Grid 2D amb 12 notes (0-11), timeline fraccionada, drag horitzontal per notes
// Basat en App30 (fraccions) + plano-modular (grid 2D)

import { getMixer } from '../../libs/sound/index.js';
import { createMelodicAudioInitializer } from '../../libs/app-common/audio-init.js';
import { bindSharedSoundEvents } from '../../libs/app-common/audio.js';
import { initMixerMenu } from '../../libs/app-common/mixer-menu.js';
import { createPreferenceStorage, registerFactoryReset, setupThemeSync, setupMutePersistence } from '../../libs/app-common/preferences.js';
import createFractionEditor from '../../libs/app-common/fraction-editor.js';
import { gridFromOrigin } from '../../libs/app-common/subdivision.js';
import { attachHover } from '../../libs/shared-ui/hover.js';
import {
  buildGridDOM,
  updateSoundline,
  updateMatrix,
  updateTimeline
} from '../../libs/plano-modular/plano-grid.js';

// ========== CONSTANTS ==========
const FIXED_LG = 12;             // 12 pulsos (0-11) + endpoint
const FIXED_BPM = 70;            // BPM fix
const FIXED_NUMERATOR = 1;       // Numerador sempre 1
const DEFAULT_DENOMINATOR = 2;   // Per defecte 1/2
const MIN_DENOMINATOR = 1;
const MAX_DENOMINATOR = 8;
const NOTE_COUNT = 12;           // 12 notes (0-11)
const BASE_MIDI = 48;            // C3 = 48

// Colors per notes
const VIBRANT_COLORS = [
  '#E76F68', // vermell
  '#FFBB33', // groc
  '#7CD6B3', // verd
  '#7BB4CD'  // blau
];

// ========== STATE ==========
let audio = null;
let isPlaying = false;
let currentDenominator = DEFAULT_DENOMINATOR;

// Notes array: { note: 0-11, startSubdiv: number, duration: number }
let notes = [];

// Grid DOM elements
let gridElements = null;
let cellWidth = 40;

// Fraction editor controller
let fractionEditorController = null;

// Drag state
let dragState = {
  active: false,
  note: null,           // Fixed note (row)
  startSubdiv: null,    // Start column
  currentSubdiv: null,  // Current column
  maxSubdiv: null,
  previewElement: null
};

// Playback state
let currentMetronomeSound = (() => {
  try {
    const stored = localStorage.getItem('baseSound');
    return stored || 'click9';
  } catch {
    return 'click9';
  }
})();

// ========== PREFERENCE STORAGE ==========
const preferenceStorage = createPreferenceStorage({ prefix: 'app32', separator: '::' });
const { load: loadOpt, save: saveOpt, clear: clearOpt } = preferenceStorage;

registerFactoryReset({
  storage: preferenceStorage,
  onBeforeReload: () => {}
});

// ========== SOUND EVENTS ==========
bindSharedSoundEvents({
  getAudio: () => audio,
  mapping: {
    baseSound: 'setBase'
  }
});

window.addEventListener('sharedui:baseSound', (e) => {
  if (e.detail?.sound) {
    currentMetronomeSound = e.detail.sound;
  }
});

// ========== AUDIO INITIALIZATION ==========
const _initAudio = createMelodicAudioInitializer({
  defaultInstrument: 'piano',
  getPreferences: () => loadOpt() || {}
});

async function initAudio() {
  if (!audio) {
    audio = await _initAudio();
  }
  return audio;
}

// ========== UTILITY FUNCTIONS ==========
function getTotalSubdivisions() {
  return FIXED_LG * currentDenominator;
}

function subdivToPosition(subdiv) {
  return subdiv * FIXED_NUMERATOR / currentDenominator;
}

function positionToSubdiv(position) {
  return Math.round(position * currentDenominator / FIXED_NUMERATOR);
}

function buildSimple12Rows() {
  const rows = [];
  for (let note = NOTE_COUNT - 1; note >= 0; note--) {
    rows.push({
      id: `note-${note}`,
      label: String(note),
      data: { note }
    });
  }
  return rows;
}

// ========== GRID FUNCTIONS ==========
function calculateCellWidth() {
  const container = gridElements?.matrixContainer;
  if (!container) return 40;
  const totalColumns = getTotalSubdivisions();
  const containerWidth = container.clientWidth || 600;
  const calculatedWidth = Math.floor(containerWidth / Math.min(totalColumns, 24));
  return Math.max(30, Math.min(60, calculatedWidth));
}

function renderGrid() {
  if (!gridElements) return;

  const rows = buildSimple12Rows();
  const columns = getTotalSubdivisions();
  cellWidth = calculateCellWidth();

  // Update soundline (Y-axis: notes 11 to 0)
  updateSoundline(gridElements.soundlineContainer, rows);

  // Update matrix (cells)
  updateMatrix(gridElements.matrixContainer, rows, columns, {
    cellWidth,
    onCellClick: null  // We'll use mousedown instead
  });

  // Mark pulse boundaries
  const d = currentDenominator;
  const cells = gridElements.matrixContainer.querySelectorAll('.plano-cell');
  cells.forEach(cell => {
    const colIndex = parseInt(cell.dataset.colIndex, 10);
    if ((colIndex + 1) % d === 0) {
      cell.classList.add('pulse-boundary');
    }
  });

  // Render timeline with subdivisions
  renderFractionalTimeline();

  // Attach drag handlers
  attachDragHandlers();

  // Sync scroll between matrix and timeline
  syncScrolls();

  // Render existing notes
  renderNotes();
}

function renderFractionalTimeline() {
  const container = gridElements?.timelineContainer;
  if (!container) return;

  const columns = getTotalSubdivisions();
  const d = currentDenominator;

  container.innerHTML = '';

  const timelineRow = document.createElement('div');
  timelineRow.className = 'plano-timeline-row';
  timelineRow.style.gridTemplateColumns = `repeat(${columns}, ${cellWidth}px)`;

  for (let colIdx = 0; colIdx < columns; colIdx++) {
    const numEl = document.createElement('div');
    numEl.className = 'plano-timeline-number';
    numEl.dataset.colIndex = colIdx;

    const pulseIndex = Math.floor(colIdx / d);
    const subdivIndex = colIdx % d;

    if (subdivIndex === 0) {
      numEl.classList.add('pulse-start');
      numEl.textContent = String(pulseIndex);
    } else {
      numEl.textContent = `.${subdivIndex}`;
    }

    timelineRow.appendChild(numEl);
  }

  container.appendChild(timelineRow);
}

function syncScrolls() {
  const matrix = gridElements?.matrixContainer;
  const timeline = gridElements?.timelineContainer;

  if (matrix && timeline) {
    matrix.addEventListener('scroll', () => {
      timeline.scrollLeft = matrix.scrollLeft;
    });
  }
}

// ========== NOTE RENDERING ==========
function renderNotes() {
  // Remove existing note bars
  const existingBars = gridElements?.matrixContainer?.querySelectorAll('.note-bar');
  existingBars?.forEach(bar => bar.remove());

  if (notes.length === 0) return;

  const matrix = gridElements?.matrixContainer?.querySelector('.plano-matrix');
  if (!matrix) return;

  const cellHeight = 32; // Match CSS --plano-cell-height

  notes.forEach((noteData, idx) => {
    const bar = document.createElement('div');
    bar.className = 'note-bar';
    bar.dataset.noteIndex = idx;

    // Calculate position
    const left = noteData.startSubdiv * cellWidth;
    const width = noteData.duration * cellWidth;
    const rowIndex = (NOTE_COUNT - 1) - noteData.note; // Invert for visual
    const top = rowIndex * cellHeight;

    bar.style.left = `${left}px`;
    bar.style.width = `${width}px`;
    bar.style.top = `${top}px`;
    bar.style.height = `${cellHeight - 2}px`;
    bar.style.background = VIBRANT_COLORS[idx % VIBRANT_COLORS.length];

    // Label
    const label = document.createElement('span');
    label.className = 'note-bar__label';
    label.textContent = noteData.note;
    bar.appendChild(label);

    // Click to delete
    bar.addEventListener('click', (e) => {
      e.stopPropagation();
      removeNote(idx);
    });

    matrix.appendChild(bar);
  });
}

// ========== NOTE MANAGEMENT ==========
function addNote(noteData) {
  // Check collision (monophonic - no overlap on same note row)
  const hasCollision = notes.some(n =>
    n.note === noteData.note &&
    !(noteData.startSubdiv + noteData.duration <= n.startSubdiv ||
      noteData.startSubdiv >= n.startSubdiv + n.duration)
  );

  if (hasCollision) {
    // Remove overlapping notes
    notes = notes.filter(n =>
      n.note !== noteData.note ||
      (noteData.startSubdiv + noteData.duration <= n.startSubdiv ||
       noteData.startSubdiv >= n.startSubdiv + n.duration)
    );
  }

  notes.push(noteData);
  notes.sort((a, b) => a.startSubdiv - b.startSubdiv || a.note - b.note);
  renderNotes();
}

function removeNote(idx) {
  notes.splice(idx, 1);
  renderNotes();
}

function clearNotes() {
  notes = [];
  renderNotes();
}

// ========== DRAG HANDLERS ==========
function attachDragHandlers() {
  const matrix = gridElements?.matrixContainer;
  if (!matrix) return;

  // Remove old handlers by cloning (simple approach)
  const cells = matrix.querySelectorAll('.plano-cell');
  cells.forEach(cell => {
    cell.addEventListener('mousedown', handleDragStart);
    cell.addEventListener('touchstart', handleDragStart, { passive: false });
  });

  document.addEventListener('mousemove', handleDragMove);
  document.addEventListener('mouseup', handleDragEnd);
  document.addEventListener('touchmove', handleDragMove, { passive: false });
  document.addEventListener('touchend', handleDragEnd);
}

function handleDragStart(e) {
  e.preventDefault();

  const cell = e.currentTarget;
  const note = parseInt(cell.dataset.note, 10);
  const colIndex = parseInt(cell.dataset.colIndex, 10);

  // Check if clicking on existing note
  const clickedOnNote = notes.findIndex(n =>
    n.note === note &&
    colIndex >= n.startSubdiv &&
    colIndex < n.startSubdiv + n.duration
  );

  if (clickedOnNote >= 0) {
    // Delete note
    removeNote(clickedOnNote);
    return;
  }

  const maxTotal = getTotalSubdivisions();
  if (colIndex >= maxTotal) return;

  dragState = {
    active: true,
    note: note,
    startSubdiv: colIndex,
    currentSubdiv: colIndex,
    maxSubdiv: maxTotal - 1,
    previewElement: null
  };

  document.body.classList.add('dragging-note');
  createPreviewBar();
  updatePreviewBar();
}

function handleDragMove(e) {
  if (!dragState.active) return;

  const clientX = e.touches ? e.touches[0].clientX : e.clientX;

  // Calculate column from mouse position
  const matrix = gridElements?.matrixContainer;
  if (!matrix) return;

  const rect = matrix.getBoundingClientRect();
  const scrollLeft = matrix.scrollLeft;
  const relX = clientX - rect.left + scrollLeft;
  const colIndex = Math.floor(relX / cellWidth);

  // Clamp to valid range (only forward from start)
  const newSubdiv = Math.max(dragState.startSubdiv, Math.min(dragState.maxSubdiv, colIndex));

  if (newSubdiv !== dragState.currentSubdiv) {
    dragState.currentSubdiv = newSubdiv;
    updatePreviewBar();
  }
}

function handleDragEnd() {
  if (!dragState.active) return;

  const duration = dragState.currentSubdiv - dragState.startSubdiv + 1;

  // Clean up
  document.body.classList.remove('dragging-note');
  if (dragState.previewElement) {
    dragState.previewElement.remove();
    dragState.previewElement = null;
  }

  // Add note if valid
  if (duration >= 1) {
    addNote({
      note: dragState.note,
      startSubdiv: dragState.startSubdiv,
      duration
    });
  }

  dragState.active = false;
}

function createPreviewBar() {
  if (dragState.previewElement) return;

  const matrix = gridElements?.matrixContainer?.querySelector('.plano-matrix');
  if (!matrix) return;

  const bar = document.createElement('div');
  bar.className = 'note-bar-preview';
  matrix.appendChild(bar);
  dragState.previewElement = bar;
}

function updatePreviewBar() {
  if (!dragState.previewElement) return;

  const cellHeight = 32;
  const rowIndex = (NOTE_COUNT - 1) - dragState.note;
  const left = dragState.startSubdiv * cellWidth;
  const width = (dragState.currentSubdiv - dragState.startSubdiv + 1) * cellWidth;
  const top = rowIndex * cellHeight;

  dragState.previewElement.style.left = `${left}px`;
  dragState.previewElement.style.width = `${width}px`;
  dragState.previewElement.style.top = `${top}px`;
  dragState.previewElement.style.height = `${cellHeight - 2}px`;
}

// ========== FRACTION EDITOR ==========
function initFractionEditor() {
  const fractionSlot = document.getElementById('fractionInlineSlot');
  if (!fractionSlot) return;

  fractionEditorController = createFractionEditor({
    mode: 'inline',
    host: fractionSlot,
    defaults: { numerator: FIXED_NUMERATOR, denominator: DEFAULT_DENOMINATOR },
    startEmpty: false,
    maxDenominator: MAX_DENOMINATOR,
    onChange: handleFractionChange
  });

  // Set simple mode (numerator fixed at 1)
  fractionEditorController.setSimpleMode();
}

function handleFractionChange({ cause }) {
  const fraction = fractionEditorController.getFraction();
  if (!fraction) return;

  const newDenom = fraction.denominator;
  if (newDenom === currentDenominator) return;

  // Filter out notes that exceed new grid bounds
  const newMaxSubdiv = FIXED_LG * newDenom;
  notes = notes.filter(n => n.startSubdiv < newMaxSubdiv);
  notes.forEach(n => {
    if (n.startSubdiv + n.duration > newMaxSubdiv) {
      n.duration = newMaxSubdiv - n.startSubdiv;
    }
  });

  currentDenominator = newDenom;
  renderGrid();
}

// ========== PLAYBACK ==========
async function startPlayback() {
  if (notes.length === 0) return;

  const lg = FIXED_LG;
  const d = currentDenominator;
  const scaledTotal = lg * d + 1; // +1 for last note release
  const scaledInterval = (60 / FIXED_BPM) / d;

  const audioInstance = await initAudio();
  if (!audioInstance) return;

  // Build note map: subdiv -> note data
  const noteMap = new Map();
  notes.forEach(n => {
    // Only trigger at start of note
    if (!noteMap.has(n.startSubdiv)) {
      noteMap.set(n.startSubdiv, n);
    }
  });

  isPlaying = true;
  updateControlsState();

  const onFinish = () => {
    isPlaying = false;
    updateControlsState();
    clearPlaybackHighlights();
    audioInstance.stop();
  };

  audioInstance.play(
    scaledTotal,
    scaledInterval,
    { values: new Set(), resolution: 1 },
    false,  // No loop
    (scaledIndex, scheduledTime) => highlightAndPlay(scaledIndex, scheduledTime, noteMap),
    onFinish
  );
}

function highlightAndPlay(scaledIndex, scheduledTime, noteMap) {
  if (!isPlaying) return;

  const d = currentDenominator;

  // Highlight column
  highlightColumn(scaledIndex);

  // Play note if one starts here
  const noteData = noteMap.get(scaledIndex);
  if (noteData && audio) {
    const midiNote = BASE_MIDI + noteData.note;
    const durationPulses = noteData.duration / d;
    const durationSeconds = durationPulses * (60 / FIXED_BPM) * 0.9; // 90% to avoid overlap

    const when = scheduledTime ?? (window.Tone?.now() || 0);
    audio.playNote(midiNote, durationSeconds, when);

    // Highlight note bar
    highlightNoteBar(noteData);
  }
}

function highlightColumn(colIndex) {
  // Remove previous highlights
  const cells = gridElements?.matrixContainer?.querySelectorAll('.plano-cell');
  cells?.forEach(c => c.classList.remove('playing'));

  // Highlight current column
  cells?.forEach(c => {
    if (parseInt(c.dataset.colIndex, 10) === colIndex) {
      c.classList.add('playing');
    }
  });

  // Highlight timeline number
  const timelineNums = gridElements?.timelineContainer?.querySelectorAll('.plano-timeline-number');
  timelineNums?.forEach(n => n.classList.remove('playing'));
  timelineNums?.forEach(n => {
    if (parseInt(n.dataset.colIndex, 10) === colIndex) {
      n.classList.add('playing');
    }
  });
}

function highlightNoteBar(noteData) {
  const bars = gridElements?.matrixContainer?.querySelectorAll('.note-bar');
  bars?.forEach(b => b.classList.remove('highlight'));

  const idx = notes.findIndex(n =>
    n.note === noteData.note && n.startSubdiv === noteData.startSubdiv
  );
  if (idx >= 0 && bars) {
    bars[idx]?.classList.add('highlight');
  }
}

function clearPlaybackHighlights() {
  const cells = gridElements?.matrixContainer?.querySelectorAll('.plano-cell');
  cells?.forEach(c => c.classList.remove('playing'));

  const bars = gridElements?.matrixContainer?.querySelectorAll('.note-bar');
  bars?.forEach(b => b.classList.remove('highlight'));

  const timelineNums = gridElements?.timelineContainer?.querySelectorAll('.plano-timeline-number');
  timelineNums?.forEach(n => n.classList.remove('playing'));
}

async function stopPlayback() {
  if (!audio) return;
  audio.stop();
  isPlaying = false;
  clearPlaybackHighlights();
  updateControlsState();
}

// ========== CONTROLS ==========
function updateControlsState() {
  const playBtn = document.getElementById('playBtn');
  const iconPlay = playBtn?.querySelector('.icon-play');
  const iconStop = playBtn?.querySelector('.icon-stop');

  if (isPlaying) {
    playBtn?.classList.add('playing');
    if (iconPlay) iconPlay.style.display = 'none';
    if (iconStop) iconStop.style.display = 'block';
  } else {
    playBtn?.classList.remove('playing');
    if (iconPlay) iconPlay.style.display = 'block';
    if (iconStop) iconStop.style.display = 'none';
  }
}

async function handlePlay() {
  if (isPlaying) {
    await stopPlayback();
  } else {
    await startPlayback();
  }
}

function handleRandom() {
  // Random denominator
  const newDenom = Math.floor(Math.random() * (MAX_DENOMINATOR - 1)) + 2; // 2-8
  currentDenominator = newDenom;
  fractionEditorController?.setFraction(
    { numerator: FIXED_NUMERATOR, denominator: newDenom },
    { persist: true }
  );

  // Clear and generate random notes
  notes = [];
  const totalSubdivs = getTotalSubdivisions();
  const numNotes = Math.floor(Math.random() * 6) + 3; // 3-8 notes

  for (let i = 0; i < numNotes; i++) {
    const note = Math.floor(Math.random() * NOTE_COUNT);
    const maxStart = totalSubdivs - 1;
    const startSubdiv = Math.floor(Math.random() * maxStart);
    const maxDuration = Math.min(totalSubdivs - startSubdiv, currentDenominator * 2);
    const duration = Math.floor(Math.random() * maxDuration) + 1;

    // Check collision
    const hasCollision = notes.some(n =>
      n.note === note &&
      !(startSubdiv + duration <= n.startSubdiv ||
        startSubdiv >= n.startSubdiv + n.duration)
    );

    if (!hasCollision) {
      notes.push({ note, startSubdiv, duration });
    }
  }

  renderGrid();
}

function handleReset() {
  if (isPlaying) {
    stopPlayback();
  }
  currentDenominator = DEFAULT_DENOMINATOR;
  fractionEditorController?.setFraction(
    { numerator: FIXED_NUMERATOR, denominator: DEFAULT_DENOMINATOR },
    { persist: true }
  );
  notes = [];
  renderGrid();
}

// ========== INITIALIZATION ==========
async function init() {
  // Build grid DOM
  const container = document.getElementById('gridContainer');
  if (!container) {
    console.error('Grid container not found');
    return;
  }

  gridElements = buildGridDOM(container);

  // Initialize fraction editor
  initFractionEditor();

  // Initial render
  renderGrid();

  // Attach control handlers
  const playBtn = document.getElementById('playBtn');
  const randomBtn = document.getElementById('randomBtn');
  const resetBtn = document.getElementById('resetBtn');

  playBtn?.addEventListener('click', handlePlay);
  randomBtn?.addEventListener('click', handleRandom);
  resetBtn?.addEventListener('click', handleReset);

  // Initialize audio system
  await initAudio();

  // Initialize mixer
  initMixerMenu({
    getAudio: () => audio,
    storageKey: 'app32-mixer'
  });

  // Setup hover
  attachHover(document.body);

  // Setup theme sync
  setupThemeSync(preferenceStorage);
  setupMutePersistence(preferenceStorage);

  console.log('App32 initialized');
}

// Start
init().catch(console.error);
