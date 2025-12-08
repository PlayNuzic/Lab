// App19: Plano Musical
// Combines temporal module (App17) with sound module (App18) in a 2D interactive grid

import { loadPiano } from '../../libs/sound/piano.js';
import { registerFactoryReset, createPreferenceStorage } from '../../libs/app-common/preferences.js';
import { ensureToneLoaded } from '../../libs/sound/tone-loader.js';
import { attachHover } from '../../libs/shared-ui/hover.js';
import { createRegistryController } from '../../libs/sound/registry-controller.js';
import { createBpmController } from '../../libs/app-common/bpm-controller.js';
import { createCycleCounter } from '../../libs/app-common/cycle-counter.js';
import { attachSpinnerRepeat } from '../../libs/app-common/spinner-repeat.js';

// ========== CONFIGURATION ==========
const CONFIG = {
  // Registry limits (only 3 registries: 3, 4, 5)
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

// ========== STATE ==========
let isPlaying = false;
let piano = null;

// Input values
let compas = null;      // null = empty, 1-7 = value
let cycles = null;      // null = empty, 1-4 = value

// Selected cells in grid: Map<`${noteIndex}-${pulseIndex}`, true>
const selectedCells = new Map();

// ========== DOM ELEMENT REFERENCES ==========
let elements = {};

// ========== PREFERENCE STORAGE ==========
const preferenceStorage = createPreferenceStorage('app19');

// ========== CONTROLLERS ==========

// Registry controller (adapted for range 3-5)
const registryController = createRegistryController({
  min: CONFIG.MIN_REGISTRO,
  max: CONFIG.MAX_REGISTRO,
  midiOffset: CONFIG.MIDI_OFFSET,
  notesPerRegistry: CONFIG.NOTES_PER_REGISTRY,
  onRegistryChange: (newRegistry) => {
    console.log('Registry changed to:', newRegistry);
    updateSoundline();
    updateGrid();
    savePreferences();
  }
});

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
 * Check if scroll is needed (total pulses > visible)
 */
function needsScroll() {
  return getTotalPulses() > CONFIG.VISIBLE_PULSES;
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

// ========== SOUNDLINE FUNCTIONS ==========

/**
 * Update soundline (Y-axis: notes)
 */
function updateSoundline() {
  if (!elements.soundlineContainer) return;

  const registry = registryController.getRegistry();
  const totalNotes = registryController.getTotalNotes();

  // Clear and rebuild
  elements.soundlineContainer.innerHTML = '';

  const soundlineRow = document.createElement('div');
  soundlineRow.className = 'soundline-row';

  // Create note labels from top to bottom (highest note first)
  for (let i = totalNotes - 1; i >= 0; i--) {
    const noteEl = document.createElement('div');
    noteEl.className = 'soundline-note';
    noteEl.dataset.noteIndex = i;

    // Format label using registry controller
    const label = registryController.formatLabel(i);
    noteEl.textContent = label;

    // Extract noteNum from label (e.g., "0r4" → 0, "11r3" → 11)
    const noteNum = label.split('r')[0];
    noteEl.dataset.noteNum = noteNum;

    // Mark boundary notes
    if (registryController.isBoundaryNote(i)) {
      noteEl.classList.add('registry-boundary');
    }

    soundlineRow.appendChild(noteEl);
  }

  elements.soundlineContainer.appendChild(soundlineRow);
}

// ========== GRID FUNCTIONS ==========

/**
 * Calculate cell width based on container width / 12 visible pulses
 */
function getCellWidth() {
  if (!elements.matrixContainer) return 50; // fallback
  const containerWidth = elements.matrixContainer.clientWidth;
  return Math.floor(containerWidth / CONFIG.VISIBLE_PULSES);
}

/**
 * Update grid matrix and timeline
 */
function updateGrid() {
  const cellWidth = getCellWidth();
  updateMatrix(cellWidth);
  updateTimeline(cellWidth);
}

/**
 * Update matrix (cells)
 * @param {number} cellWidth - Width of each cell in pixels
 */
function updateMatrix(cellWidth) {
  if (!elements.matrixContainer) return;

  const totalPulses = getTotalPulses();
  const totalNotes = registryController.getTotalNotes();

  if (totalPulses === 0 || totalNotes === 0) {
    elements.matrixContainer.innerHTML = '';
    return;
  }

  // Create grid with fixed cell widths (no stretching)
  const grid = document.createElement('div');
  grid.className = 'grid-matrix';
  grid.style.gridTemplateColumns = `repeat(${totalPulses}, ${cellWidth}px)`;
  grid.style.gridTemplateRows = `repeat(${totalNotes}, var(--grid-cell-height))`;

  // Create cells (top to bottom = highest to lowest note, left to right = pulse 0 to n)
  for (let noteIdx = totalNotes - 1; noteIdx >= 0; noteIdx--) {
    for (let pulseIdx = 0; pulseIdx < totalPulses; pulseIdx++) {
      const cell = document.createElement('div');
      cell.className = 'grid-cell';
      cell.dataset.note = noteIdx;
      cell.dataset.pulse = pulseIdx;

      // Check if selected
      const key = `${noteIdx}-${pulseIdx}`;
      if (selectedCells.has(key)) {
        cell.classList.add('selected');
      }

      // Click handler
      cell.addEventListener('click', () => handleCellClick(noteIdx, pulseIdx));

      grid.appendChild(cell);
    }
  }

  elements.matrixContainer.innerHTML = '';
  elements.matrixContainer.appendChild(grid);
}

/**
 * Update timeline (X-axis: pulse numbers with cycle superscript)
 * @param {number} cellWidth - Width of each cell in pixels
 */
function updateTimeline(cellWidth) {
  if (!elements.timelineContainer) return;

  const totalPulses = getTotalPulses();

  if (totalPulses === 0 || compas === null) {
    elements.timelineContainer.innerHTML = '';
    return;
  }

  const row = document.createElement('div');
  row.className = 'timeline-row';
  row.style.gridTemplateColumns = `repeat(${totalPulses}, ${cellWidth}px)`;

  for (let pulseIdx = 0; pulseIdx < totalPulses; pulseIdx++) {
    const pulseInCycle = pulseIdx % compas;
    const cycleNum = Math.floor(pulseIdx / compas) + 1;

    const numEl = document.createElement('div');
    numEl.className = 'timeline-number';
    numEl.dataset.pulse = pulseIdx;

    // Pulse 0 of each cycle gets special styling
    if (pulseInCycle === 0) {
      numEl.classList.add('cycle-start');
    }

    numEl.innerHTML = `
      <span class="pulse-num">${pulseInCycle}</span><sup class="cycle-sup">${cycleNum}</sup>
    `;

    row.appendChild(numEl);
  }

  elements.timelineContainer.innerHTML = '';
  elements.timelineContainer.appendChild(row);
}

// ========== CELL INTERACTION ==========

/**
 * Handle cell click - select/deselect and play note
 */
async function handleCellClick(noteIndex, pulseIndex) {
  const key = `${noteIndex}-${pulseIndex}`;

  // Toggle selection
  if (selectedCells.has(key)) {
    selectedCells.delete(key);
  } else {
    selectedCells.set(key, true);
  }

  // Update cell visual
  const cell = elements.matrixContainer?.querySelector(
    `.grid-cell[data-note="${noteIndex}"][data-pulse="${pulseIndex}"]`
  );
  if (cell) {
    cell.classList.toggle('selected', selectedCells.has(key));
  }

  // Play the note
  await playNote(noteIndex);

  console.log(`Cell clicked: note=${noteIndex}, pulse=${pulseIndex}, selected=${selectedCells.has(key)}`);
}

/**
 * Play a note at given index
 */
async function playNote(noteIndex) {
  // Initialize piano if needed
  if (!piano) {
    await initPiano();
  }

  const registry = registryController.getRegistry();
  if (registry === null) return;

  // Convert visual index to note-in-registry
  const noteInRegistry = registryController.getNoteInRegistry(noteIndex);
  const { midi } = registryController.getMidiForNote(noteInRegistry);

  const Tone = window.Tone;
  const note = Tone.Frequency(midi, 'midi').toNote();
  piano.triggerAttackRelease(note, 0.5);
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
      // Auto-focus to inputCycle after valid compas entry
      elements.inputCycle?.focus();
      elements.inputCycle?.select();
    }
  }

  updateLongitud();
  updateGridVisibility();
  updateGrid();
  savePreferences();
  console.log('Compás changed to:', compas);
}

/**
 * Handle Nº Compases input change
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

  updateLongitud();
  updateGridVisibility();
  updateGrid();
  savePreferences();
  console.log('Nº Compases changed to:', cycles);
}

/**
 * Increment/decrement helpers
 */
function incrementCompas() {
  if (compas === null) {
    compas = CONFIG.MIN_COMPAS;
  } else if (compas < CONFIG.MAX_COMPAS) {
    compas++;
  }
  elements.inputCompas.value = compas;
  handleCompasChange();
}

function decrementCompas() {
  if (compas === null) {
    compas = CONFIG.MAX_COMPAS;
  } else if (compas > CONFIG.MIN_COMPAS) {
    compas--;
  }
  elements.inputCompas.value = compas;
  handleCompasChange();
}

function incrementCycles() {
  if (cycles === null) {
    cycles = CONFIG.MIN_CYCLES;
  } else if (cycles < CONFIG.MAX_CYCLES) {
    cycles++;
  }
  elements.inputCycle.value = cycles;
  handleCyclesChange();
}

function decrementCycles() {
  if (cycles === null) {
    cycles = CONFIG.MAX_CYCLES;
  } else if (cycles > CONFIG.MIN_CYCLES) {
    cycles--;
  }
  elements.inputCycle.value = cycles;
  handleCyclesChange();
}

// ========== REGISTRY HANDLERS ==========

function handleRegistryUp() {
  registryController.increment();
  elements.inputRegistro.value = registryController.getRegistry();
}

function handleRegistryDown() {
  registryController.decrement();
  elements.inputRegistro.value = registryController.getRegistry();
}

// ========== CONTROL HANDLERS ==========

/**
 * Handle Play button
 */
async function handlePlay() {
  if (isPlaying) {
    stopPlayback();
    return;
  }

  const totalPulses = getTotalPulses();
  if (totalPulses === 0) {
    console.log('Cannot play: no pulses defined');
    return;
  }

  // Initialize piano if needed
  if (!piano) {
    await initPiano();
  }

  startPlayback();
}

/**
 * Start playback
 */
function startPlayback() {
  isPlaying = true;
  elements.playBtn?.classList.add('playing');
  console.log('Playback started');

  // TODO: Implement full playback with metrónomo + notas
}

/**
 * Stop playback
 */
function stopPlayback() {
  isPlaying = false;
  elements.playBtn?.classList.remove('playing');
  console.log('Playback stopped');
}

/**
 * Handle Random button - generate random Compás, Nº Compases, BPM
 */
function handleRandom() {
  // Get random menu values
  const randCompasMax = parseInt(document.getElementById('randCompasMax')?.value || CONFIG.MAX_COMPAS);
  const randCyclesMax = parseInt(document.getElementById('randCyclesMax')?.value || CONFIG.MAX_CYCLES);
  const randBpmMin = parseInt(document.getElementById('randBpmMin')?.value || 60);
  const randBpmMax = parseInt(document.getElementById('randBpmMax')?.value || 180);

  // Generate random values
  compas = Math.floor(Math.random() * randCompasMax) + 1;
  cycles = Math.floor(Math.random() * randCyclesMax) + 1;
  const randomBpm = Math.floor(Math.random() * (randBpmMax - randBpmMin + 1)) + randBpmMin;

  // Update inputs
  elements.inputCompas.value = compas;
  elements.inputCycle.value = cycles;
  if (bpmController && bpmController.setValue) {
    bpmController.setValue(randomBpm);
  }

  // Clear current selections and generate random sequence
  selectedCells.clear();

  // Generate some random note selections
  const totalPulses = getTotalPulses();
  const totalNotes = registryController.getTotalNotes();
  const numSelections = Math.floor(Math.random() * Math.min(totalPulses, 8)) + 1;

  for (let i = 0; i < numSelections; i++) {
    const noteIdx = Math.floor(Math.random() * totalNotes);
    const pulseIdx = Math.floor(Math.random() * totalPulses);
    selectedCells.set(`${noteIdx}-${pulseIdx}`, true);
  }

  updateLongitud();
  updateGridVisibility();
  updateGrid();
  savePreferences();

  console.log(`Random: Compás=${compas}, Cycles=${cycles}, BPM=${randomBpm}, Selections=${numSelections}`);
}

/**
 * Handle Reset button - clear grid and inputs (BPM stays at 100)
 */
function handleReset() {
  if (isPlaying) {
    stopPlayback();
  }

  // Clear inputs
  compas = null;
  cycles = null;
  elements.inputCompas.value = '';
  elements.inputCycle.value = '';

  // Reset BPM to 100
  if (bpmController && bpmController.setValue) {
    bpmController.setValue(CONFIG.DEFAULT_BPM);
  }

  // Clear selections
  selectedCells.clear();

  // Update displays
  updateLongitud();
  updateGridVisibility();
  updateGrid();
  savePreferences();

  // Focus on Compás input
  elements.inputCompas?.focus();

  console.log('Reset complete');
}

// ========== AUDIO FUNCTIONS ==========

async function initPiano() {
  if (!piano) {
    console.log('Ensuring Tone.js is loaded...');
    await ensureToneLoaded();
    console.log('Loading piano...');
    piano = await loadPiano();
    console.log('Piano loaded');

    setupVolumeControl();
  }
  return piano;
}

function setupVolumeControl() {
  const Tone = window.Tone;
  if (!Tone) return;

  window.addEventListener('sharedui:volume', (e) => {
    const volume = e.detail?.value ?? 1;
    const dB = volume > 0 ? 20 * Math.log10(volume) : -Infinity;
    Tone.getDestination().volume.value = dB;
  });

  window.addEventListener('sharedui:mute', (e) => {
    const muted = e.detail?.value ?? false;
    Tone.getDestination().mute = muted;
  });
}

// ========== SCROLL SYNCHRONIZATION ==========

function setupScrollSync() {
  const matrix = elements.matrixContainer;
  const timeline = elements.timelineContainer;

  if (matrix && timeline) {
    matrix.addEventListener('scroll', () => {
      timeline.scrollLeft = matrix.scrollLeft;
    });
  }
}

// ========== PREFERENCES ==========

function savePreferences() {
  preferenceStorage.save({
    compas,
    cycles,
    registry: registryController.getRegistry(),
    bpm: bpmController?.getValue() || CONFIG.DEFAULT_BPM,
    selectedCells: Array.from(selectedCells.keys())
  });
}

function loadPreferences() {
  const prefs = preferenceStorage.load();
  if (!prefs) return;

  // Restore registry
  if (prefs.registry !== undefined) {
    registryController.setRegistry(prefs.registry);
    if (elements.inputRegistro) {
      elements.inputRegistro.value = registryController.getRegistry();
    }
  }

  // Restore compás
  if (prefs.compas !== undefined && prefs.compas !== null) {
    compas = prefs.compas;
    if (elements.inputCompas) {
      elements.inputCompas.value = compas;
    }
  }

  // Restore cycles
  if (prefs.cycles !== undefined && prefs.cycles !== null) {
    cycles = prefs.cycles;
    if (elements.inputCycle) {
      elements.inputCycle.value = cycles;
    }
  }

  // Restore BPM
  if (prefs.bpm !== undefined && bpmController && bpmController.setValue) {
    bpmController.setValue(prefs.bpm);
  }

  // Restore selections
  if (prefs.selectedCells && Array.isArray(prefs.selectedCells)) {
    selectedCells.clear();
    prefs.selectedCells.forEach(key => selectedCells.set(key, true));
  }
}

// ========== EVENT HANDLERS SETUP ==========

function setupEventHandlers() {
  // Compás input
  elements.inputCompas?.addEventListener('input', handleCompasChange);
  elements.inputCompas?.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); incrementCompas(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); decrementCompas(); }
  });

  // Compás spinners with repeat
  if (elements.compasUp) {
    attachSpinnerRepeat(elements.compasUp, incrementCompas);
  }
  if (elements.compasDown) {
    attachSpinnerRepeat(elements.compasDown, decrementCompas);
  }

  // Cycles input
  elements.inputCycle?.addEventListener('input', handleCyclesChange);
  elements.inputCycle?.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); incrementCycles(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); decrementCycles(); }
  });

  // Cycles spinners with repeat
  if (elements.cycleUp) {
    attachSpinnerRepeat(elements.cycleUp, incrementCycles);
  }
  if (elements.cycleDown) {
    attachSpinnerRepeat(elements.cycleDown, decrementCycles);
  }

  // Registry buttons
  elements.registroUp?.addEventListener('click', handleRegistryUp);
  elements.registroDown?.addEventListener('click', handleRegistryDown);

  // Control buttons
  elements.playBtn?.addEventListener('click', handlePlay);
  elements.randomBtn?.addEventListener('click', handleRandom);
  elements.resetBtn?.addEventListener('click', handleReset);

  // Theme changes
  document.addEventListener('sharedui:theme', () => {
    // Theme handled automatically
  });

  // Instrument changes
  document.addEventListener('sharedui:instrument', (e) => {
    console.log('Instrument changed:', e.detail.instrument);
  });
}

// ========== HOVER LABELS ==========

function setupHovers() {
  if (elements.playBtn) attachHover(elements.playBtn, { text: 'Reproducir secuencia' });
  if (elements.randomBtn) attachHover(elements.randomBtn, { text: 'Generar secuencia aleatoria' });
  if (elements.resetBtn) attachHover(elements.resetBtn, { text: 'Reiniciar (vaciar grid e inputs)' });
  if (elements.registroUp) attachHover(elements.registroUp, { text: 'Registro +1' });
  if (elements.registroDown) attachHover(elements.registroDown, { text: 'Registro -1' });
  if (elements.compasUp) attachHover(elements.compasUp, { text: 'Compás +1' });
  if (elements.compasDown) attachHover(elements.compasDown, { text: 'Compás -1' });
  if (elements.cycleUp) attachHover(elements.cycleUp, { text: 'Nº Compases +1' });
  if (elements.cycleDown) attachHover(elements.cycleDown, { text: 'Nº Compases -1' });
}

// ========== FACTORY RESET ==========

registerFactoryReset({
  storage: preferenceStorage,
  onReset: () => {
    // Reset to defaults
    compas = null;
    cycles = null;
    registryController.setRegistry(CONFIG.DEFAULT_REGISTRO);
    selectedCells.clear();

    // Update UI
    elements.inputCompas.value = '';
    elements.inputCycle.value = '';
    elements.inputRegistro.value = CONFIG.DEFAULT_REGISTRO;

    if (bpmController) {
      bpmController.setBpm(CONFIG.DEFAULT_BPM);
    }

    updateLongitud();
    updateSoundline();
    updateGrid();
  }
});

// ========== INITIALIZATION ==========

function bindElements() {
  elements = {
    // Inputs
    inputCompas: document.getElementById('inputCompas'),
    inputCycle: document.getElementById('inputCycle'),
    inputRegistro: document.getElementById('inputRegistro'),
    inputBpm: document.getElementById('inputBpm'),

    // Spinners
    compasUp: document.getElementById('compasUp'),
    compasDown: document.getElementById('compasDown'),
    cycleUp: document.getElementById('cycleUp'),
    cycleDown: document.getElementById('cycleDown'),
    registroUp: document.getElementById('registroUp'),
    registroDown: document.getElementById('registroDown'),
    bpmUp: document.getElementById('bpmUp'),
    bpmDown: document.getElementById('bpmDown'),

    // Displays
    totalLengthDigit: document.getElementById('totalLengthDigit'),
    cycleDigit: document.getElementById('cycleDigit'),

    // Grid containers
    soundlineContainer: document.getElementById('soundlineContainer'),
    matrixContainer: document.getElementById('matrixContainer'),
    timelineContainer: document.getElementById('timelineContainer'),

    // Control buttons
    playBtn: document.getElementById('playBtn'),
    randomBtn: document.getElementById('randomBtn'),
    resetBtn: document.getElementById('resetBtn'),
    tapTempoBtn: document.getElementById('tapTempoBtn')
  };
}

function initApp() {
  console.log('Initializing App19: Plano Musical');

  // Bind DOM elements
  bindElements();

  // Debug: Check if critical elements exist
  console.log('Elements found:', {
    inputBpm: !!elements.inputBpm,
    bpmUp: !!elements.bpmUp,
    bpmDown: !!elements.bpmDown,
    cycleDigit: !!elements.cycleDigit,
    inputRegistro: !!elements.inputRegistro,
    soundlineContainer: !!elements.soundlineContainer,
    matrixContainer: !!elements.matrixContainer
  });

  // Initialize registry with default
  registryController.setRegistry(CONFIG.DEFAULT_REGISTRO);
  if (elements.inputRegistro) {
    elements.inputRegistro.value = CONFIG.DEFAULT_REGISTRO;
  }

  // Initialize BPM controller (only if elements exist)
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
        savePreferences();
      }
    });
    bpmController.attach();
  } else {
    console.warn('BPM controller not initialized - missing DOM elements');
  }

  // Initialize cycle counter for playback
  if (elements.cycleDigit) {
    cycleCounter = createCycleCounter({ element: elements.cycleDigit });
  }

  // Load saved preferences
  loadPreferences();

  // Setup event handlers
  setupEventHandlers();

  // Setup hover labels
  setupHovers();

  // Setup scroll synchronization
  setupScrollSync();

  // Initial renders
  updateLongitud();
  updateGridVisibility();
  updateSoundline();
  updateGrid();

  // Focus on Compás input
  elements.inputCompas?.focus();

  console.log('App19 initialized');
}

// Execute when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
