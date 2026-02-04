// App34: Sucesión en plano de fracciones simples
// Basat en App32, afegeix zigzag editor N-iT (notes + intervals temporals)
// Lg=12 fix, BPM=70 fix, numerador=1 fix, denominador editable (1-8)
// Grid 2D amb 12 notes (0-11) + soundline + zigzag editor N-iT
// Àudio melòdic amb selector d'instrument + so de cicle

import { getMixer } from '../../libs/sound/index.js';
import { createMelodicAudioInitializer } from '../../libs/app-common/audio-init.js';
import { bindSharedSoundEvents } from '../../libs/app-common/audio.js';
import { initMixerMenu } from '../../libs/app-common/mixer-menu.js';
import { createPreferenceStorage, registerFactoryReset, setupThemeSync, setupMutePersistence } from '../../libs/app-common/preferences.js';
import createFractionEditor from '../../libs/app-common/fraction-editor.js';
import { gridFromOrigin } from '../../libs/app-common/subdivision.js';
import { attachHover } from '../../libs/shared-ui/hover.js';
import { showValidationWarning } from '../../libs/app-common/info-tooltip.js';
import {
  buildGridDOM,
  updateSoundline,
  updateMatrix
} from '../../libs/plano-modular/plano-grid.js';
import { createPlayheadController } from '../../libs/plano-modular/plano-playhead.js';
import { createGridEditor } from '../../libs/matrix-seq/index.js';

// ========== CONSTANTS ==========
const FIXED_LG = 12;             // 12 pulsos (0-11)
const FIXED_BPM = 70;            // BPM fix
const FIXED_NUMERATOR = 1;       // Numerador sempre 1 (App30)
const DEFAULT_DENOMINATOR = 2;   // Per defecte 1/2
const MIN_DENOMINATOR = 1;
const MAX_DENOMINATOR = 8;

// Colors per rectangles iT
const VIBRANT_COLORS = [
  '#E76F68', // vermell
  '#FFBB33', // groc
  '#7CD6B3', // verd
  '#7BB4CD'  // blau
];

// Notes per àudio
const NOTE_COUNT = 12;       // 12 notes (0-11)
const BASE_MIDI = 48;        // C3 = 48

// ========== STATE ==========
let audio = null;
let isPlaying = false;
let currentDenominator = DEFAULT_DENOMINATOR;

// Notes array: { note: 0-11, startSubdiv: number, duration: number }
let notes = [];

// Grid elements
let gridElements = null;
let cellWidth = 40;
let playheadController = null;

// DOM elements
let pulses = [];
let bars = [];
let cycleMarkers = [];
let cycleLabels = [];
let pulseNumberLabels = [];
let intervalBars = []; // Rectangles iT (mantinguts per timeline)
let noteBars = [];     // Rectangles notes al grid
let gridIntegerLabels = [];
let gridFractionLabels = [];

// Controllers
let fractionEditorController = null;
let zigzagEditor = null;

// Drag state
let dragState = {
  active: false,
  startSubdiv: null,
  currentSubdiv: null,
  maxSubdiv: null,
  previewBar: null
};

// Playback state
let playbackAbort = null;
let currentMetronomeSound = (() => {
  try {
    const stored = localStorage.getItem('baseSound');
    return stored || 'click9';
  } catch {
    return 'click9';
  }
})();

// ========== PREFERENCE STORAGE ==========
const preferenceStorage = createPreferenceStorage({ prefix: 'app34', separator: '::' });
const { load: loadOpt, save: saveOpt, clear: clearOpt } = preferenceStorage;

registerFactoryReset({
  storage: preferenceStorage,
  onBeforeReload: () => {}
});

// ========== SOUND EVENTS ==========
bindSharedSoundEvents({
  getAudio: () => audio,
  mapping: {
    baseSound: 'setBase',
    cycleSound: 'setCycle'
  }
});

// Listen for metronome sound changes
window.addEventListener('sharedui:baseSound', (e) => {
  if (e.detail?.sound) {
    currentMetronomeSound = e.detail.sound;
  }
});

// Listen for instrument changes - sync with audio engine
window.addEventListener('sharedui:instrument', async (e) => {
  if (e.detail?.instrument && audio && audio.setInstrument) {
    await audio.setInstrument(e.detail.instrument);
  }
});

// ========== DOM ELEMENTS ==========
const timeline = document.getElementById('timeline');
const timelineWrapper = document.getElementById('timelineWrapper');
const playBtn = document.getElementById('playBtn');
const randomBtn = document.getElementById('randomBtn');
const resetBtn = document.getElementById('resetBtn');
const themeSelect = document.getElementById('themeSelect');
const baseSoundSelect = document.getElementById('baseSoundSelect');
const cycleSoundSelect = document.getElementById('cycleSoundSelect');
const mixerMenu = document.getElementById('mixerMenu');

// P row elements (created dynamically)
let pzRow = null;
let fractionSlot = null;
let infoColumn = null;
let sumDisplay = null;
let availableDisplay = null;

// ========== HOVER TOOLTIPS ==========
if (playBtn) attachHover(playBtn, { text: 'Play / Stop' });
if (randomBtn) attachHover(randomBtn, { text: 'Aleatorizar fracción y notas' });
if (resetBtn) attachHover(resetBtn, { text: 'Reset App' });

// ========== MIXER SETUP ==========
const globalMixer = getMixer();
if (globalMixer) {
  globalMixer.registerChannel('pulse', { allowSolo: true, label: 'Metrónomo' });
  globalMixer.registerChannel('subdivision', { allowSolo: true, label: 'Subdivisión' });
  globalMixer.registerChannel('instrument', { allowSolo: true, label: 'Instrumento' });
}

// ========== THEME & MUTE PERSISTENCE ==========
const muteButton = document.getElementById('muteBtn');
setupThemeSync({ storage: preferenceStorage, selectEl: themeSelect });
setupMutePersistence({
  storage: preferenceStorage,
  getAudioInstance: () => audio,
  muteButton
});

// ========== MIXER MENU ==========
const mixerTriggers = [playBtn].filter(Boolean);

initMixerMenu({
  menu: mixerMenu,
  triggers: mixerTriggers,
  channels: [
    { id: 'pulse', label: 'Metrónomo', allowSolo: true },
    { id: 'subdivision', label: 'Subdivisión', allowSolo: true },
    { id: 'instrument', label: 'Instrumento', allowSolo: true },
    { id: 'master', label: 'Master', allowSolo: false, isMaster: true }
  ]
});

// ========== AUDIO INITIALIZATION ==========
const _baseInitAudio = createMelodicAudioInitializer({
  defaultInstrument: 'piano'
});

async function initAudio() {
  if (!audio) {
    audio = await _baseInitAudio();

    // Apply saved mute state
    const savedMute = loadOpt('mute');
    if (savedMute === '1' && typeof audio.setMute === 'function') {
      audio.setMute(true);
    }

    // Configure sounds from dropdowns (like createRhythmAudioInitializer does)
    // This ensures the metronome and cycle sounds are properly initialized
    if (baseSoundSelect?.dataset?.value && typeof audio.setBase === 'function') {
      await audio.setBase(baseSoundSelect.dataset.value);
    }
    if (cycleSoundSelect?.dataset?.value && typeof audio.setCycle === 'function') {
      await audio.setCycle(cycleSoundSelect.dataset.value);
    }

    if (typeof window !== 'undefined') {
      window.__labAudio = audio;
      window.NuzicAudioEngine = audio;
    }
  }
  return audio;
}

if (typeof window !== 'undefined') {
  window.__labInitAudio = initAudio;
  // Initialize audio on first interaction to ensure NuzicAudioEngine is ready
  // before instrument-dropdown tries to preload instruments
  document.addEventListener('click', () => initAudio(), { once: true });
  document.addEventListener('touchstart', () => initAudio(), { once: true });
}

// ========== UTILITY FUNCTIONS ==========
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get total subdivisions available (Lg * d)
 * Lg Fr = longitud en polsos × denominador
 */
function getTotalSubdivisions() {
  return FIXED_LG * currentDenominator;
}

/**
 * Convert subdivision index to timeline position (pulses)
 */
function subdivToPosition(subdiv) {
  return subdiv * FIXED_NUMERATOR / currentDenominator;
}

// ========== GRID HELPERS ==========
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

function calculateCellWidth() {
  const container = gridElements?.matrixContainer;
  if (!container) return 40;
  const totalColumns = getTotalSubdivisions();
  const containerWidth = container.clientWidth || 600;
  const calculatedWidth = Math.floor(containerWidth / Math.min(totalColumns, 24));
  return Math.max(30, Math.min(60, calculatedWidth));
}

// ========== PZ ROW + GRID CREATION ==========
function createPzRow() {
  pzRow = document.createElement('div');
  pzRow.className = 'pz-row';

  // Info column (left side)
  infoColumn = document.createElement('div');
  infoColumn.className = 'info-column';

  // Available iT display (iT no col·locats)
  const availableBox = document.createElement('div');
  availableBox.className = 'it-info-box';
  const availableLabel = document.createElement('span');
  availableLabel.className = 'it-info-label';
  availableLabel.innerHTML = 'iT<br>Disponibles';
  availableDisplay = document.createElement('input');
  availableDisplay.type = 'text';
  availableDisplay.className = 'it-input';
  availableDisplay.readOnly = true;
  availableDisplay.value = '0';
  availableBox.appendChild(availableLabel);
  availableBox.appendChild(availableDisplay);

  // Sum of iT display (iT col·locats = suma de durades)
  const sumBox = document.createElement('div');
  sumBox.className = 'it-info-box';
  const sumLabel = document.createElement('span');
  sumLabel.className = 'it-info-label';
  sumLabel.textContent = 'Suma iT';
  sumDisplay = document.createElement('input');
  sumDisplay.type = 'text';
  sumDisplay.className = 'it-input';
  sumDisplay.readOnly = true;
  sumDisplay.value = '0';
  sumBox.appendChild(sumLabel);
  sumBox.appendChild(sumDisplay);

  // Hide info boxes (keep for potential future use)
  availableBox.style.display = 'none';
  sumBox.style.display = 'none';

  infoColumn.appendChild(availableBox);
  infoColumn.appendChild(sumBox);

  // Fraction section (center)
  const fractionSection = document.createElement('div');
  fractionSection.className = 'fraction-section';

  const labelSpan = document.createElement('span');
  labelSpan.className = 'pz label';
  labelSpan.textContent = 'P';

  fractionSlot = document.createElement('span');
  fractionSlot.id = 'fractionInlineSlot';
  fractionSlot.className = 'pz fraction-inline-container';

  fractionSection.appendChild(labelSpan);
  fractionSection.appendChild(fractionSlot);

  // Zigzag editor container (App4 pattern: no wrapper, direct overflow)
  const zigzagContainer = document.createElement('div');
  zigzagContainer.id = 'zigzagEditorContainer';
  zigzagContainer.className = 'zigzag-editor-container';

  pzRow.appendChild(infoColumn);
  pzRow.appendChild(fractionSection);
  pzRow.appendChild(zigzagContainer);

  // Insert before timeline
  if (timelineWrapper && timelineWrapper.parentNode) {
    timelineWrapper.parentNode.insertBefore(pzRow, timelineWrapper);
  }
}

/**
 * Update info displays (iT disponibles i suma iT)
 * - Suma iT: total de columnes ocupades (suma de durades de totes les notes)
 * - iT Disponibles: columnes lliures (total - ocupades)
 */
function updateInfoDisplays() {
  const totalColumns = getTotalSubdivisions();

  // Suma iT: sum of all note durations (each column = 1 iT)
  const usedColumns = notes.reduce((sum, n) => sum + n.duration, 0);

  // iT Disponibles: total - used
  const available = totalColumns - usedColumns;

  if (availableDisplay) {
    availableDisplay.value = String(available);
  }
  if (sumDisplay) {
    sumDisplay.value = String(usedColumns);
  }
}

// ========== ZIGZAG EDITOR (N-iT) ==========
/**
 * Initialize zigzag matrix editor with N (notes 0-11) and iT (temporal intervals)
 */
function initZigzagEditor() {
  const container = document.getElementById('zigzagEditorContainer');
  if (!container) return;

  zigzagEditor = createGridEditor({
    container,
    mode: 'n-it',
    showZigzag: true,
    noteRange: [0, 11],
    showIntervalLabels: false,  // Compact mode
    leftZigzagLabels: {
      topText: 'N',
      bottomText: 'iT'
    },
    intervalModeOptions: {
      hideInitialPair: true,
      hideRegistry: true,  // Hide registry for simple N → iT navigation
      basePair: { note: 0, pulse: 0 },
      maxTotalPulse: getTotalSubdivisions()
    },
    onPairsChange: handleZigzagChange
  });
}

/**
 * Handle zigzag editor changes: convert N-iT pairs to notes array
 */
function handleZigzagChange(pairs) {
  const newNotes = [];
  let currentStart = 0;

  pairs.forEach(pair => {
    if (pair.note !== null && pair.temporalInterval) {
      newNotes.push({
        note: pair.note,
        startSubdiv: currentStart,
        duration: pair.temporalInterval
      });
      currentStart += pair.temporalInterval;
    }
  });

  // Update internal notes array
  notes = newNotes;

  // Re-render the 2D grid
  renderNotes();
  updateIntervalBars();
  updateInfoDisplays();
}

/**
 * Sync 2D grid notes to zigzag editor
 */
function syncGridToZigzag() {
  if (!zigzagEditor) return;

  // Convert notes array to N-iT pairs
  const pairs = notes.map(noteData => ({
    note: noteData.note,
    pulse: noteData.startSubdiv,
    temporalInterval: noteData.duration
  }));

  // Update zigzag editor without triggering onChange
  zigzagEditor.setPairs(pairs);
}

function createGrid() {
  // Create grid container before timeline
  let gridContainer = document.getElementById('gridContainer');
  if (!gridContainer) {
    gridContainer = document.createElement('div');
    gridContainer.id = 'gridContainer';
    gridContainer.className = 'grid-container';
    if (timelineWrapper && timelineWrapper.parentNode) {
      timelineWrapper.parentNode.insertBefore(gridContainer, timelineWrapper);
    }
  }

  // Build grid DOM
  gridElements = buildGridDOM(gridContainer);

  // Create playhead controller
  playheadController = createPlayheadController(
    gridElements.matrixContainer,
    () => cellWidth,
    0
  );

  renderGrid();
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
    onCellClick: null
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

  // Render fractional timeline in grid
  renderGridTimeline();

  // Attach drag handlers to cells
  attachGridDragHandlers();

  // Sync scroll
  syncGridScrolls();

  // Render existing notes
  renderNotes();

  // Update info displays
  updateInfoDisplays();
}

function renderGridTimeline() {
  const container = gridElements?.timelineContainer;
  if (!container) return;

  const columns = getTotalSubdivisions();
  const d = currentDenominator;

  container.innerHTML = '';
  gridIntegerLabels = [];
  gridFractionLabels = [];

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
      gridIntegerLabels[pulseIndex] = numEl;
    } else {
      numEl.textContent = `.${subdivIndex}`;
      gridFractionLabels.push(numEl);
    }

    timelineRow.appendChild(numEl);
  }

  container.appendChild(timelineRow);
}

function syncGridScrolls() {
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
  const existingBars = gridElements?.matrixContainer?.querySelectorAll('.note-bar');
  existingBars?.forEach(bar => bar.remove());

  if (notes.length === 0) return;

  const matrix = gridElements?.matrixContainer?.querySelector('.plano-matrix');
  if (!matrix) return;

  const cellHeight = 32;

  notes.forEach((noteData, idx) => {
    const bar = document.createElement('div');
    bar.className = 'note-bar';
    bar.dataset.noteIndex = idx;

    const left = noteData.startSubdiv * cellWidth;
    const width = noteData.duration * cellWidth;
    const rowIndex = (NOTE_COUNT - 1) - noteData.note;
    const top = rowIndex * cellHeight;

    bar.style.left = `${left}px`;
    bar.style.width = `${width}px`;
    bar.style.top = `${top}px`;
    bar.style.height = `${cellHeight - 2}px`;
    bar.style.background = VIBRANT_COLORS[idx % VIBRANT_COLORS.length];

    const label = document.createElement('span');
    label.className = 'note-bar__label';
    label.textContent = noteData.duration;
    bar.appendChild(label);

    bar.addEventListener('click', (e) => {
      e.stopPropagation();
      removeNote(idx);
    });

    matrix.appendChild(bar);
  });
}

// ========== NOTE MANAGEMENT ==========
/**
 * Check if a note would overlap with existing notes (monophonic mode)
 * In monophonic mode, no two notes can occupy the same column
 */
function wouldOverlap(noteData) {
  const newStart = noteData.startSubdiv;
  const newEnd = noteData.startSubdiv + noteData.duration;

  for (const n of notes) {
    const existingStart = n.startSubdiv;
    const existingEnd = n.startSubdiv + n.duration;

    // Check if columns overlap (regardless of note row)
    const columnsOverlap = !(newEnd <= existingStart || newStart >= existingEnd);
    if (columnsOverlap) {
      return true;
    }
  }
  return false;
}

/**
 * Remove any notes that overlap with the given range (monophonic mode)
 */
function removeOverlappingNotes(startSubdiv, duration) {
  const newEnd = startSubdiv + duration;

  notes = notes.filter(n => {
    const existingStart = n.startSubdiv;
    const existingEnd = n.startSubdiv + n.duration;
    // Keep notes that don't overlap
    return newEnd <= existingStart || startSubdiv >= existingEnd;
  });
}

function addNote(noteData) {
  // Monophonic mode: remove ALL notes that overlap in columns (any row)
  removeOverlappingNotes(noteData.startSubdiv, noteData.duration);

  notes.push(noteData);
  notes.sort((a, b) => a.startSubdiv - b.startSubdiv || a.note - b.note);
  renderNotes();
  updateIntervalBars();
  updateInfoDisplays();
  syncGridToZigzag();
}

function removeNote(idx) {
  notes.splice(idx, 1);
  renderNotes();
  updateIntervalBars();
  updateInfoDisplays();
  syncGridToZigzag();
}

function clearNotes() {
  notes = [];
  renderNotes();
  updateInfoDisplays();
  syncGridToZigzag();
}

// ========== GRID DRAG HANDLERS ==========
function attachGridDragHandlers() {
  const matrix = gridElements?.matrixContainer;
  if (!matrix) return;

  const cells = matrix.querySelectorAll('.plano-cell');
  cells.forEach(cell => {
    cell.addEventListener('mousedown', handleGridDragStart);
    cell.addEventListener('touchstart', handleGridDragStart, { passive: false });
  });

  document.addEventListener('mousemove', handleGridDragMove);
  document.addEventListener('mouseup', handleGridDragEnd);
  document.addEventListener('touchmove', handleGridDragMove, { passive: false });
  document.addEventListener('touchend', handleGridDragEnd);
}

function handleGridDragStart(e) {
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
    previewBar: null
  };

  document.body.classList.add('dragging-note');
  createGridPreviewBar();
  updateGridPreviewBar();
}

function handleGridDragMove(e) {
  if (!dragState.active || dragState.note === undefined) return;

  const clientX = e.touches ? e.touches[0].clientX : e.clientX;

  const matrix = gridElements?.matrixContainer;
  if (!matrix) return;

  const rect = matrix.getBoundingClientRect();
  const scrollLeft = matrix.scrollLeft;
  const relX = clientX - rect.left + scrollLeft;
  const colIndex = Math.floor(relX / cellWidth);

  const newSubdiv = Math.max(dragState.startSubdiv, Math.min(dragState.maxSubdiv, colIndex));

  if (newSubdiv !== dragState.currentSubdiv) {
    dragState.currentSubdiv = newSubdiv;
    updateGridPreviewBar();
  }
}

function handleGridDragEnd() {
  if (!dragState.active || dragState.note === undefined) return;

  const duration = dragState.currentSubdiv - dragState.startSubdiv + 1;

  document.body.classList.remove('dragging-note');
  if (dragState.previewBar) {
    dragState.previewBar.remove();
    dragState.previewBar = null;
  }

  if (duration >= 1) {
    const noteData = {
      note: dragState.note,
      startSubdiv: dragState.startSubdiv,
      duration
    };
    addNote(noteData);

    // Play preview sound when note is created
    playNotePreview(noteData);
  }

  dragState.active = false;
  dragState.note = undefined;
}

function createGridPreviewBar() {
  if (dragState.previewBar) return;

  const matrix = gridElements?.matrixContainer?.querySelector('.plano-matrix');
  if (!matrix) return;

  const bar = document.createElement('div');
  bar.className = 'note-bar-preview';
  matrix.appendChild(bar);
  dragState.previewBar = bar;
}

function updateGridPreviewBar() {
  if (!dragState.previewBar) return;

  const cellHeight = 32;
  const rowIndex = (NOTE_COUNT - 1) - dragState.note;
  const left = dragState.startSubdiv * cellWidth;
  const width = (dragState.currentSubdiv - dragState.startSubdiv + 1) * cellWidth;
  const top = rowIndex * cellHeight;

  dragState.previewBar.style.left = `${left}px`;
  dragState.previewBar.style.width = `${width}px`;
  dragState.previewBar.style.top = `${top}px`;
  dragState.previewBar.style.height = `${cellHeight - 2}px`;
}

// ========== FRACTION EDITOR ==========
function initFractionEditorController() {
  if (!fractionSlot) return;

  currentDenominator = DEFAULT_DENOMINATOR;

  const controller = createFractionEditor({
    mode: 'inline',
    host: fractionSlot,
    defaults: { numerator: FIXED_NUMERATOR, denominator: DEFAULT_DENOMINATOR },
    startEmpty: false,
    maxDenominator: MAX_DENOMINATOR,
    storage: {},
    addRepeatPress,
    labels: {
      numerator: { placeholder: '1' },
      denominator: { placeholder: 'd' }
    },
    onChange: ({ cause }) => {
      if (cause !== 'init') {
        handleFractionChange();
      }
    }
  });

  fractionEditorController = controller || null;

  // Set simple mode (numerator fixed at 1)
  if (fractionEditorController && typeof fractionEditorController.setSimpleMode === 'function') {
    fractionEditorController.setSimpleMode();
  }
}

function handleFractionChange() {
  if (!fractionEditorController) return;

  const fraction = fractionEditorController.getFraction();
  let newD = fraction?.denominator;

  // Skip if value is not yet valid (user is typing)
  if (!Number.isFinite(newD)) {
    return;
  }

  // Clamp denominator (2-8)
  if (newD < MIN_DENOMINATOR) {
    newD = MIN_DENOMINATOR;
  } else if (newD > MAX_DENOMINATOR) {
    newD = MAX_DENOMINATOR;
  }

  if (newD !== fraction?.denominator) {
    fractionEditorController.setFraction(
      { numerator: FIXED_NUMERATOR, denominator: newD },
      { cause: 'clamp', persist: true, silent: true }
    );
  }

  currentDenominator = newD;

  // Filter invalid notes
  filterInvalidNotes();

  // Redraw timeline and grid
  renderTimeline();
  renderGrid();

  // Hot-reload audio if playing
  if (audio && isPlaying) {
    applyTransportConfig();
  }
}

function filterInvalidNotes() {
  const maxSubdiv = getTotalSubdivisions();
  notes = notes.filter(n => n.startSubdiv < maxSubdiv);
  notes.forEach(n => {
    if (n.startSubdiv + n.duration > maxSubdiv) {
      n.duration = maxSubdiv - n.startSubdiv;
    }
  });
}

/**
 * Apply current fraction config to running audio transport
 * Enables hot-reload when fraction changes during playback
 */
function applyTransportConfig() {
  if (!audio || typeof audio.updateTransport !== 'function') return;

  const lg = FIXED_LG;
  const bpm = FIXED_BPM;
  const n = FIXED_NUMERATOR;
  const d = currentDenominator;

  const scaledTotal = lg * d + 1; // +1 padding for last note release
  const scaledBpm = bpm * d;

  audio.updateTransport({
    totalPulses: scaledTotal,
    bpm: scaledBpm,
    baseResolution: d,
    patternBeats: lg * d,
    cycle: {
      numerator: n * d,
      denominator: d,
      onTick: highlightCycle
    }
  });
}

// ========== REPEAT PRESS HELPER ==========
function addRepeatPress(el, fn) {
  if (!el) return;
  let timeoutId = null;
  let intervalId = null;

  const clearTimers = () => {
    if (timeoutId) clearTimeout(timeoutId);
    if (intervalId) clearInterval(intervalId);
    timeoutId = null;
    intervalId = null;
  };

  const start = (event) => {
    if (event.type === 'mousedown' && event.button !== 0) return;
    clearTimers();
    fn();
    timeoutId = setTimeout(() => {
      intervalId = setInterval(fn, 80);
    }, 320);
    event.preventDefault();
  };

  const stop = () => clearTimers();

  el.addEventListener('mousedown', start);
  el.addEventListener('touchstart', start, { passive: false });
  ['mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach(name => {
    el.addEventListener(name, stop);
  });
  document.addEventListener('mouseup', stop);
  document.addEventListener('touchend', stop);
}

// ========== TIMELINE RENDERING ==========
function renderTimeline() {
  if (!timeline) return;

  timeline.classList.add('no-anim');

  // Clear previous
  pulses = [];
  bars = [];
  cycleMarkers = [];
  cycleLabels = [];
  pulseNumberLabels = [];
  intervalBars = [];
  timeline.innerHTML = '';

  const lg = FIXED_LG;
  const n = FIXED_NUMERATOR;
  const d = currentDenominator;

  // Add timeline line
  const line = document.createElement('div');
  line.className = 'timeline-line';
  timeline.appendChild(line);

  // Create pulses (0 to lg inclusive)
  for (let i = 0; i <= lg; i++) {
    const pulse = document.createElement('div');
    pulse.className = 'pulse';
    pulse.dataset.index = i;
    if (i === 0) pulse.classList.add('startpoint');
    if (i === lg) pulse.classList.add('endpoint');
    timeline.appendChild(pulse);
    pulses.push(pulse);

    if (i === 0 || i === lg) {
      const bar = document.createElement('div');
      bar.className = 'bar';
      timeline.appendChild(bar);
      bars.push(bar);
    }
  }

  // Create pulse numbers
  for (let i = 0; i <= lg; i++) {
    const num = document.createElement('div');
    num.className = 'pulse-number';
    if (i === 0) num.classList.add('startpoint');
    if (i === lg) num.classList.add('endpoint');
    num.dataset.index = i;
    num.textContent = i;
    timeline.appendChild(num);
    pulseNumberLabels.push(num);
  }

  // Create cycle markers
  const grid = gridFromOrigin({ lg, numerator: n, denominator: d });

  if (grid.cycles > 0 && grid.subdivisions.length) {
    grid.subdivisions.forEach(({ cycleIndex, subdivisionIndex, position }) => {
      if (subdivisionIndex === 0) return; // Skip integers

      const globalSubdiv = cycleIndex * d + subdivisionIndex;

      const marker = document.createElement('div');
      marker.className = 'cycle-marker';
      marker.dataset.cycleIndex = String(cycleIndex);
      marker.dataset.subdivision = String(subdivisionIndex);
      marker.dataset.globalSubdiv = String(globalSubdiv);
      marker.dataset.position = String(position);
      timeline.appendChild(marker);
      cycleMarkers.push(marker);

      const label = document.createElement('div');
      label.className = 'cycle-label';
      label.dataset.cycleIndex = String(cycleIndex);
      label.dataset.subdivision = String(subdivisionIndex);
      label.dataset.globalSubdiv = String(globalSubdiv);
      label.dataset.position = String(position);
      label.textContent = `.${subdivisionIndex}`;
      timeline.appendChild(label);
      cycleLabels.push(label);
    });
  }

  layoutTimeline();
  attachDragHandlers();
  updateIntervalBars();

  requestAnimationFrame(() => {
    timeline.classList.remove('no-anim');
  });
}

function layoutTimeline() {
  const lg = FIXED_LG;

  pulses.forEach((p, i) => {
    const pct = (i / lg) * 100;
    p.style.left = pct + '%';
    p.style.top = '50%';
    p.style.transform = 'translate(-50%, -50%)';
  });

  bars.forEach((bar, idx) => {
    const i = idx === 0 ? 0 : lg;
    const pct = (i / lg) * 100;
    bar.style.left = pct + '%';
    bar.style.top = '30%';
    bar.style.height = '40%';
    bar.style.transform = 'translateX(-50%)';
  });

  pulseNumberLabels.forEach((num) => {
    const idx = parseInt(num.dataset.index, 10);
    const pct = (idx / lg) * 100;
    num.style.left = pct + '%';
    num.style.top = '0';
    num.style.transform = 'translate(-50%, 0%)';
  });

  cycleMarkers.forEach((marker) => {
    const pos = parseFloat(marker.dataset.position);
    const pct = (pos / lg) * 100;
    marker.style.left = pct + '%';
    marker.style.top = '50%';
  });

  cycleLabels.forEach((label) => {
    const pos = parseFloat(label.dataset.position);
    const pct = (pos / lg) * 100;
    label.style.left = pct + '%';
    label.style.top = '75%';
  });
}

// ========== INTERVAL BARS (now represents notes on timeline) ==========
function updateIntervalBars() {
  // Remove existing bars
  intervalBars.forEach(bar => bar.remove());
  intervalBars = [];

  if (notes.length === 0) return;

  const lg = FIXED_LG;
  const d = currentDenominator;

  notes.forEach((noteData, idx) => {
    const startPos = noteData.startSubdiv / d;
    const endPos = (noteData.startSubdiv + noteData.duration) / d;
    const width = endPos - startPos;

    const bar = document.createElement('div');
    bar.className = 'interval-bar-visual';
    bar.dataset.index = idx;
    bar.style.left = `${(startPos / lg) * 100}%`;
    bar.style.width = `${(width / lg) * 100}%`;

    const color = VIBRANT_COLORS[idx % VIBRANT_COLORS.length];
    bar.style.background = color;

    const label = document.createElement('span');
    label.className = 'interval-bar-visual__label';
    label.textContent = noteData.note;
    bar.appendChild(label);

    timeline.appendChild(bar);
    intervalBars.push(bar);
  });
}

// ========== TIMELINE DRAG (removed - drag is now on grid) ==========
function attachDragHandlers() {
  // Timeline drag disabled - notes are created via grid drag
  // Keep function for renderTimeline() compatibility
}

// ========== NOTE PREVIEW ==========
/**
 * Play a preview sound when a note is created
 */
async function playNotePreview(noteData) {
  const audioInstance = await initAudio();
  if (!audioInstance) return;

  // Calculate note duration based on current BPM and denominator
  const d = currentDenominator;
  const n = FIXED_NUMERATOR;
  const bpm = FIXED_BPM;
  const beatDuration = 60 / bpm;
  const durationPulses = noteData.duration * n / d;
  const durationSeconds = Math.min(durationPulses * beatDuration, 2); // Cap at 2 seconds for preview

  // MIDI note = BASE_MIDI + note (0-11)
  const midiNote = BASE_MIDI + noteData.note;

  // Play the note immediately (time=0 means "now")
  audioInstance.playNote(midiNote, durationSeconds, 0);
}

// ========== PLAYBACK ==========
/**
 * Get note that starts at a given scaled index
 * Returns the note object or null if no note starts there
 */
function getNoteAtScaledStart(scaledIndex) {
  const n = FIXED_NUMERATOR;

  for (const noteData of notes) {
    // Convert note start (in subdivisions) to scaled index
    const noteScaledStart = noteData.startSubdiv * n;
    if (noteScaledStart === scaledIndex) {
      return noteData;
    }
  }
  return null;
}

async function startPlayback() {
  // Allow playback even with no notes (just metronome)

  const lg = FIXED_LG;
  const bpm = FIXED_BPM;
  const n = FIXED_NUMERATOR;
  const d = currentDenominator;

  // Scale by denominator to include subdivisions (like App29)
  const baseResolution = d;
  const scaledInterval = (60 / bpm) / d; // Each step = 1/d of a beat
  // Add padding (1 extra step) to allow last note's release to complete
  const scaledTotal = lg * d + 1;

  const audioInstance = await initAudio();

  const hasCycle = n > 0 && d > 0 && Math.floor(lg / n) > 0;

  // No accent selection - we use melodic notes from grid
  const audioSelection = { values: new Set(), resolution: 1 };

  const onFinish = () => {
    isPlaying = false;
    updateControlsState();
    clearHighlights();
    audioInstance.stop();
  };

  // Build play options
  const playOptions = {
    baseResolution,
    patternBeats: lg * d // Scaled pattern length
  };

  if (hasCycle) {
    // Scale numerator by d to match scaled timeline
    playOptions.cycle = {
      numerator: n * d,
      denominator: d,
      onTick: highlightCycle
    };
  }

  // Start playback with audio.play() - this handles metronome and subdivision sounds
  // highlightPulse receives (scaledIndex, scheduledTime) for sample-accurate melodic notes
  audioInstance.play(
    scaledTotal,
    scaledInterval,
    audioSelection,
    false,  // No loop - one-shot playback
    highlightPulse,
    onFinish,
    playOptions
  );

  isPlaying = true;
  updateControlsState();
}

async function stopPlayback() {
  if (!audio) return;

  audio.stop();
  isPlaying = false;
  clearHighlights();
  updateControlsState();
}

async function playMetronomeClick() {
  if (!audio) return;
  try {
    await audio.playSound(currentMetronomeSound, 'pulse');
  } catch (err) {
    console.warn('Error playing metronome:', err);
  }
}

async function playCycleSound() {
  if (!audio) return;
  try {
    await audio.playSound(audio._soundAssignments?.cycle || 'click2', 'subdivision');
  } catch (err) {
    console.warn('Error playing cycle sound:', err);
  }
}

// ========== HIGHLIGHTING ==========
function clearHighlights() {
  pulses.forEach(p => p.classList.remove('active'));
  cycleMarkers.forEach(m => m.classList.remove('active'));
  cycleLabels.forEach(l => l.classList.remove('active'));
  intervalBars.forEach(b => b.classList.remove('highlight'));
  gridIntegerLabels.forEach(label => label?.classList.remove('active'));
  gridFractionLabels.forEach(label => label?.classList.remove('active'));
  // Hide playhead
  if (playheadController) {
    playheadController.hide();
  }
  // Reset scroll to start
  const matrix = gridElements?.matrixContainer;
  if (matrix) {
    matrix.scrollLeft = 0;
  }
}

/**
 * Highlight pulse - receives scaledIndex and scheduledTime from audio.play()
 * Like App29: scaledIndex = pulseIndex * d for integer pulses
 * scheduledTime is the precise AudioContext time for sample-accurate playback
 */
function highlightPulse(scaledIndex, scheduledTime) {
  if (!isPlaying) return;
  const d = currentDenominator;
  const n = FIXED_NUMERATOR;

  // Update playhead position (scaledIndex is the column index)
  if (playheadController) {
    playheadController.update(scaledIndex);

    // Autoscroll to keep playhead visible
    const matrix = gridElements?.matrixContainer;
    if (matrix) {
      const playheadLeft = scaledIndex * cellWidth;
      const viewportWidth = matrix.clientWidth;
      const scrollLeft = matrix.scrollLeft;
      const margin = viewportWidth * 0.2; // 20% margin before edge

      // Scroll right if playhead approaches right edge
      if (playheadLeft > scrollLeft + viewportWidth - margin) {
        matrix.scrollLeft = playheadLeft - margin;
      }
      // Scroll left if playhead approaches left edge (for looping)
      if (playheadLeft < scrollLeft + margin) {
        matrix.scrollLeft = Math.max(0, playheadLeft - margin);
      }
    }
  }

  // Play melodic note if a note starts at this scaled index
  const noteData = getNoteAtScaledStart(scaledIndex);
  if (noteData && audio) {
    // Calculate note duration
    const bpm = FIXED_BPM;
    const beatDuration = 60 / bpm;
    const durationPulses = noteData.duration * n / d;
    const durationSeconds = durationPulses * beatDuration;

    // MIDI note = BASE_MIDI + note (0-11)
    const midiNote = BASE_MIDI + noteData.note;

    // Use scheduledTime for sample-accurate sync with metronome
    const when = scheduledTime ?? (window.Tone?.now() || 0);
    audio.playNote(midiNote, durationSeconds, when);
  }

  // Convert scaled index to pulse index (only highlight integer pulses)
  // scaledIndex = pulseIndex * d for integer pulses
  if (scaledIndex % d !== 0) return; // Skip subdivisions (handled by highlightCycle)

  const pulseIndex = scaledIndex / d;

  pulses.forEach(p => p.classList.remove('active'));
  gridIntegerLabels.forEach(label => label?.classList.remove('active'));
  const total = pulses.length > 1 ? pulses.length - 1 : 0;
  if (total <= 0) return;

  const normalized = Math.max(0, Math.min(pulseIndex, total));
  const pulse = pulses[normalized];
  if (pulse) {
    void pulse.offsetWidth;
    pulse.classList.add('active');
  }
  const integerLabel = gridIntegerLabels[pulseIndex];
  if (integerLabel) {
    integerLabel.classList.add('active');
  }

  // Also highlight the note bar that contains this pulse
  highlightBarAtPosition(pulseIndex);
}

/**
 * Highlight cycle subdivision - receives payload from audio.play() cycle callback
 * Like App29: { cycleIndex, subdivisionIndex }
 */
function highlightCycle(payload = {}) {
  if (!isPlaying) return;

  const { cycleIndex: rawCycleIndex, subdivisionIndex: rawSubdivisionIndex } = payload;
  const cycleIndex = Number(rawCycleIndex);
  const subdivisionIndex = Number(rawSubdivisionIndex);

  if (!Number.isFinite(cycleIndex) || !Number.isFinite(subdivisionIndex)) return;

  // Highlight fractional timeline numbers
  gridFractionLabels.forEach(label => label?.classList.remove('active'));
  if (subdivisionIndex > 0) {
    const fractionalIndex = cycleIndex * currentDenominator + subdivisionIndex - 1;
    const fractionalLabel = gridFractionLabels[fractionalIndex];
    if (fractionalLabel) {
      fractionalLabel.classList.add('active');
    }
  }

  // Clear previous highlights
  cycleMarkers.forEach(m => m.classList.remove('active'));
  cycleLabels.forEach(l => l.classList.remove('active'));

  // Find and highlight matching marker/label
  const marker = cycleMarkers.find(m =>
    Number(m.dataset.cycleIndex) === cycleIndex &&
    Number(m.dataset.subdivision) === subdivisionIndex
  );
  const label = cycleLabels.find(l =>
    Number(l.dataset.cycleIndex) === cycleIndex &&
    Number(l.dataset.subdivision) === subdivisionIndex
  );

  if (marker) {
    void marker.offsetWidth;
    marker.classList.add('active');
  }
  if (label) {
    label.classList.add('active');
  }

  // Calculate position and highlight iT bar
  const n = FIXED_NUMERATOR;
  const position = cycleIndex * n + subdivisionIndex * n / currentDenominator;
  highlightBarAtPosition(position);
}

/**
 * Highlight the note bar that contains a given position (in pulses)
 */
function highlightBarAtPosition(position) {
  // Find which note contains this position
  const d = currentDenominator;

  for (let i = 0; i < notes.length; i++) {
    const noteData = notes[i];
    const startPos = noteData.startSubdiv / d;
    const endPos = (noteData.startSubdiv + noteData.duration) / d;

    if (position >= startPos && position < endPos) {
      // Highlight this bar
      intervalBars.forEach(b => b.classList.remove('highlight'));
      const bar = intervalBars[i];
      if (bar) {
        void bar.offsetWidth;
        bar.classList.add('highlight');
      }
      return;
    }
  }

  // No note at this position - clear bar highlights
  intervalBars.forEach(b => b.classList.remove('highlight'));
}

// ========== CONTROLS ==========
function updateControlsState() {
  if (playBtn) {
    playBtn.classList.toggle('playing', isPlaying);

    // Toggle play/stop icons
    const iconPlay = playBtn.querySelector('.icon-play');
    const iconStop = playBtn.querySelector('.icon-stop');
    if (iconPlay && iconStop) {
      iconPlay.style.display = isPlaying ? 'none' : 'block';
      iconStop.style.display = isPlaying ? 'block' : 'none';
    }
  }
}

function handlePlay() {
  if (isPlaying) {
    stopPlayback();
  } else {
    startPlayback();
  }
}

function handleRandom() {
  if (isPlaying) return;

  // Random denominator (2-8)
  const newD = Math.floor(Math.random() * (MAX_DENOMINATOR - 1)) + 2;

  if (fractionEditorController) {
    fractionEditorController.setFraction(
      { numerator: FIXED_NUMERATOR, denominator: newD },
      { cause: 'random', persist: true }
    );
  }
  currentDenominator = newD;

  // Generate random monophonic notes (consecutive, no overlap)
  // Fill at least 75% of subdivisions
  const maxSubdivs = getTotalSubdivisions();
  const targetFill = Math.ceil(maxSubdivs * 0.75);
  const newNotes = [];
  let currentPos = 0;

  while (currentPos < maxSubdivs) {
    // Random note (0-11)
    const note = Math.floor(Math.random() * NOTE_COUNT);

    // Random duration (1 to min of remaining space or d*2)
    const remaining = maxSubdivs - currentPos;
    const maxDur = Math.min(remaining, newD * 2);
    const duration = Math.floor(Math.random() * maxDur) + 1;

    newNotes.push({ note, startSubdiv: currentPos, duration });
    currentPos += duration;

    // Stop if we've filled at least 75% (with 30% chance to stop early)
    if (currentPos >= targetFill && Math.random() < 0.3) {
      break;
    }
  }

  notes = newNotes;

  renderTimeline();
  renderGrid();
  updateIntervalBars();
}

function handleReset() {
  if (isPlaying) {
    stopPlayback();
  }

  // Reset to defaults
  currentDenominator = DEFAULT_DENOMINATOR;

  if (fractionEditorController) {
    fractionEditorController.setFraction(
      { numerator: FIXED_NUMERATOR, denominator: DEFAULT_DENOMINATOR },
      { cause: 'reset', persist: true }
    );
  }

  clearNotes();

  renderTimeline();
  renderGrid();
  updateIntervalBars();
}

// ========== EVENT LISTENERS ==========
if (playBtn) {
  playBtn.addEventListener('click', handlePlay);
}

if (randomBtn) {
  randomBtn.addEventListener('click', handleRandom);
}

if (resetBtn) {
  resetBtn.addEventListener('click', handleReset);
}

// ========== INITIALIZATION ==========
function init() {
  // Create P row with fraction
  createPzRow();

  // Initialize fraction editor
  initFractionEditorController();

  // Initialize zigzag editor (N-iT)
  initZigzagEditor();

  // Create grid
  createGrid();

  // Render timeline
  renderTimeline();

  // Update interval bars
  updateIntervalBars();
}

// Run initialization
init();
