// App19: Plano Musical
// Combines temporal module (App17) with sound module (App18) in a 2D interactive grid

import { registerFactoryReset, createPreferenceStorage } from '../../libs/app-common/preferences.js';
import { attachHover } from '../../libs/shared-ui/hover.js';
import { createRegistryController } from '../../libs/sound/registry-controller.js';
import { createBpmController } from '../../libs/app-common/bpm-controller.js';
import { createCycleCounter } from '../../libs/app-common/cycle-counter.js';
import { attachSpinnerRepeat } from '../../libs/app-common/spinner-repeat.js';
import { createTapTempoHandler } from '../../libs/app-common/tap-tempo-handler.js';
import { createMelodicAudioInitializer } from '../../libs/app-common/audio-init.js';
import { initMixerMenu } from '../../libs/app-common/mixer-menu.js';
import { subscribeMixer } from '../../libs/sound/index.js';
import { initRandomMenu } from '../../libs/random/menu.js';
import { initP1ToggleUI } from '../../libs/shared-ui/sound-dropdown.js';

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
let audio = null;
let tapTempoHandler = null;
let mixerSaveTimeout = null;

// Input values
let compas = null;      // null = empty, 1-7 = value
let cycles = null;      // null = empty, 1-4 = value

// Selected cells in grid: Map<`${registry}-${noteIndex}-${pulseIndex}`, true>
// Each key includes the registry so notes persist when changing registry view
const selectedCells = new Map();

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

      // Check if selected (key includes registry)
      const currentRegistry = registryController.getRegistry();
      const currentKey = `${currentRegistry}-${noteIdx}-${pulseIdx}`;

      if (selectedCells.has(currentKey)) {
        // Selected in current registry - show as selected with label
        cell.classList.add('selected');
        // Add label showing note and registry (e.g., "2r3")
        const label = document.createElement('span');
        label.className = 'cell-label';
        label.textContent = `${noteIdx}r${currentRegistry}`;
        cell.appendChild(label);
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
 * Handle cell click - select/deselect with GLOBAL MONOPHONIC logic (1 note per pulse across ALL registries)
 * Key format: `${registry}-${noteIndex}-${pulseIndex}`
 */
async function handleCellClick(noteIndex, pulseIndex) {
  const registry = registryController.getRegistry();
  const key = `${registry}-${noteIndex}-${pulseIndex}`;

  // If clicking the same cell, deselect it
  if (selectedCells.has(key)) {
    selectedCells.delete(key);
    const cell = elements.matrixContainer?.querySelector(
      `.grid-cell[data-note="${noteIndex}"][data-pulse="${pulseIndex}"]`
    );
    if (cell) {
      cell.classList.remove('selected');
      // Remove label
      const label = cell.querySelector('.cell-label');
      if (label) label.remove();
    }
  } else {
    // GLOBAL MONOPHONIC: Remove ANY existing note in this pulse (from ANY registry)
    for (const existingKey of [...selectedCells.keys()]) {
      const [existingReg, existingNote, existingPulse] = existingKey.split('-').map(Number);
      if (existingPulse === pulseIndex) {
        selectedCells.delete(existingKey);
        // Only update visual if the note is in the current registry view
        if (existingReg === registry) {
          const oldCell = elements.matrixContainer?.querySelector(
            `.grid-cell[data-note="${existingNote}"][data-pulse="${existingPulse}"]`
          );
          if (oldCell) {
            oldCell.classList.remove('selected');
            // Remove label from old cell
            const oldLabel = oldCell.querySelector('.cell-label');
            if (oldLabel) oldLabel.remove();
          }
        }
      }
    }

    // Select the new cell
    selectedCells.set(key, true);
    const cell = elements.matrixContainer?.querySelector(
      `.grid-cell[data-note="${noteIndex}"][data-pulse="${pulseIndex}"]`
    );
    if (cell) {
      cell.classList.add('selected');
      // Add label immediately
      if (!cell.querySelector('.cell-label')) {
        const label = document.createElement('span');
        label.className = 'cell-label';
        label.textContent = `${noteIndex}r${registry}`;
        cell.appendChild(label);
      }
    }
  }

  // Play the note
  await playNote(noteIndex);
  savePreferences();
}

/**
 * Play a note at given index using MelodicTimelineAudio
 */
async function playNote(noteIndex) {
  const audioInstance = await initAudio();
  if (!audioInstance) return;

  const registry = registryController.getRegistry();
  if (registry === null) return;

  const noteInRegistry = registryController.getNoteInRegistry(noteIndex);
  const { midi } = registryController.getMidiForNote(noteInRegistry);

  const Tone = window.Tone;
  if (!Tone) return;

  audioInstance.playNote(midi, 0.5, Tone.now());
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
  updateGrid();
}

function handleRegistryDown() {
  registryController.decrement();
  elements.inputRegistro.value = registryController.getRegistry();
  updateGrid();
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

  startPlayback();
}

// ========== ANIMATION FUNCTIONS (Pattern from Apps 16/17) ==========

/**
 * Highlight the selected cell that plays at this step
 * Only highlights cells from the CURRENT registry
 */
function highlightSelectedCell(step) {
  // Clear previous highlights
  elements.matrixContainer?.querySelectorAll('.grid-cell.playing').forEach(cell => {
    cell.classList.remove('playing');
  });

  // Find and highlight the cell selected in this pulse (current registry only)
  const currentRegistry = registryController.getRegistry();
  for (const key of selectedCells.keys()) {
    const [reg, noteIndex, pulseIndex] = key.split('-').map(Number);
    // Only highlight if same registry and same pulse
    if (reg === currentRegistry && pulseIndex === step) {
      const cell = elements.matrixContainer?.querySelector(
        `.grid-cell[data-note="${noteIndex}"][data-pulse="${pulseIndex}"]`
      );
      cell?.classList.add('playing');
    }
  }
}

/**
 * Highlight timeline number at current step
 */
function highlightTimelineNumber(step) {
  elements.timelineContainer?.querySelectorAll('.timeline-number').forEach(el => {
    el.classList.remove('active', 'active-zero');
  });

  const numberEl = elements.timelineContainer?.querySelector(`.timeline-number[data-pulse="${step}"]`);
  if (numberEl && compas) {
    const modValue = step % compas;
    numberEl.classList.add(modValue === 0 ? 'active-zero' : 'active');
  }
}

/**
 * Update cycle counter with flip animation
 */
function updateCycleCounter(newCycle) {
  const digit = elements.cycleDigit;
  if (!digit) return;

  // Flip animation
  digit.classList.add('flip-out');

  setTimeout(() => {
    digit.textContent = String(newCycle);
    digit.classList.remove('flip-out');
    digit.classList.add('flip-in');

    setTimeout(() => {
      digit.classList.remove('flip-in');
    }, 150);
  }, 150);
}

/**
 * Update cycle digit color based on step
 */
function updateCycleDigitColor(step) {
  const digit = elements.cycleDigit;
  if (!digit || compas === null) return;

  digit.classList.remove('playing-zero', 'playing-active');
  digit.classList.add(step % compas === 0 ? 'playing-zero' : 'playing-active');
}

/**
 * Update total length display with flip animation
 */
function updateTotalLengthDisplay(step) {
  const digit = elements.totalLengthDigit;
  if (!digit) return;

  // Flip animation
  digit.classList.add('flip-out');

  setTimeout(() => {
    digit.textContent = String(step + 1);  // 1-indexed
    digit.classList.remove('flip-out');
    digit.classList.add('flip-in');

    // Color: blue if step+1 === 1, orange otherwise
    digit.classList.remove('playing-zero', 'playing-active');
    digit.classList.add(step === 0 ? 'playing-zero' : 'playing-active');

    setTimeout(() => {
      digit.classList.remove('flip-in');
    }, 150);
  }, 150);
}

/**
 * Clear all playback highlights
 */
function clearPlaybackHighlights() {
  // Cells
  elements.matrixContainer?.querySelectorAll('.grid-cell.playing').forEach(cell => {
    cell.classList.remove('playing');
  });

  // Timeline numbers
  elements.timelineContainer?.querySelectorAll('.timeline-number').forEach(el => {
    el.classList.remove('active', 'active-zero');
  });

  // Cycle digit
  elements.cycleDigit?.classList.remove('playing-zero', 'playing-active', 'flip-out', 'flip-in');

  // Total length digit
  elements.totalLengthDigit?.classList.remove('playing-zero', 'playing-active', 'flip-out', 'flip-in');
}

// ========== PLAYBACK FUNCTIONS ==========

/**
 * Start playback with metronome + notes
 */
async function startPlayback() {
  await initAudio();

  const totalPulses = getTotalPulses();
  const bpm = bpmController?.getValue() || CONFIG.DEFAULT_BPM;
  const intervalSec = 60 / bpm;
  const Tone = window.Tone;

  if (!Tone) {
    console.error('Tone.js not available');
    return;
  }

  // Build map of MIDI note by pulse AND registry by pulse (MONOPHONIC: only 1 note per pulse)
  // Key format: `${registry}-${noteIndex}-${pulseIndex}`
  const pulseNotes = {};
  const pulseRegistry = {};  // Maps pulse -> registry of the note
  const midiOffset = CONFIG.MIDI_OFFSET;
  const notesPerRegistry = CONFIG.NOTES_PER_REGISTRY;

  for (const key of selectedCells.keys()) {
    const [reg, noteIndex, pulseIndex] = key.split('-').map(Number);
    // Calculate MIDI directly: registry * 12 + noteIndex + midiOffset
    const midi = reg * notesPerRegistry + noteIndex + midiOffset;
    // Monophonic: one note per pulse (last one wins if duplicates exist)
    pulseNotes[pulseIndex] = midi;
    pulseRegistry[pulseIndex] = reg;
  }

  isPlaying = true;
  elements.playBtn?.classList.add('playing');

  // Hide input, show cycle digit
  const cycleParam = elements.inputCycle?.closest('.param.cycle-display');
  cycleParam?.classList.add('playing');

  // Configure measure for P0 sound
  audio.configureMeasure(compas, totalPulses);

  // Apply P0 toggle state
  const p0Enabled = window.__p1Controller?.getState() ?? true;
  audio.setMeasureEnabled(p0Enabled);

  // Scroll to first pulse at start
  scrollToPulse(0);

  audio.play(
    totalPulses,
    intervalSec,
    new Set(),
    false,  // No loop
    (step) => {
      // 1. Auto-switch registry if current/next pulse has note in different registry
      // Check next pulse first (to anticipate), then current
      const nextPulse = step + 1;
      if (pulseRegistry[nextPulse] !== undefined) {
        spinToRegistry(pulseRegistry[nextPulse]);
      } else if (pulseRegistry[step] !== undefined) {
        spinToRegistry(pulseRegistry[step]);
      }

      // 2. Highlight selected cell that plays
      highlightSelectedCell(step);

      // 3. Highlight timeline number
      highlightTimelineNumber(step);

      // 4. Auto-scroll to keep current pulse visible
      scrollToPulse(step);

      // 5. Color of cycle digit
      updateCycleDigitColor(step);

      // 6. Flip animation for cycle counter (when cycle changes)
      const cycleNum = Math.floor(step / compas) + 1;
      if (step > 0 && step % compas === 0) {
        updateCycleCounter(cycleNum);
      } else if (step === 0 && elements.cycleDigit) {
        elements.cycleDigit.textContent = '1';
      }

      // 7. Animation for totalLengthDigit
      updateTotalLengthDisplay(step);

      // 8. Play note if exists at this pulse (MONOPHONIC: 1 note max)
      // Duration = 1 pulse (based on BPM), with small margin to avoid overlap
      const midi = pulseNotes[step];
      if (midi !== undefined) {
        const noteDuration = intervalSec * 0.95;  // 95% of pulse duration
        audio.playNote(midi, noteDuration, Tone.now());
      }
    },
    () => {
      // onComplete - delay for last pulse to sound
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

  audio?.stop();

  // Show input, hide cycle digit
  const cycleParam = elements.inputCycle?.closest('.param.cycle-display');
  cycleParam?.classList.remove('playing');

  // Clear all animations
  clearPlaybackHighlights();

  // Restore Longitud display
  updateLongitud();

  // Restore cycleDigit to cycles value
  if (elements.cycleDigit && cycles !== null) {
    elements.cycleDigit.textContent = String(cycles);
  }

  console.log('Playback stopped');
}

/**
 * Shuffle array in place (Fisher-Yates)
 */
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Handle Random button - generate random Compás, Nº Compases, BPM with MONOPHONIC sequence
 */
function handleRandom() {
  // FIX: Ensure bpmController is initialized
  if (!bpmController) {
    console.warn('BPM controller not initialized, skipping random');
    return;
  }

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
  bpmController.setValue(randomBpm);

  // Clear current selections
  selectedCells.clear();

  // Generate MONOPHONIC random sequence (max 1 note per pulse)
  const totalPulses = getTotalPulses();
  const totalNotes = registryController.getTotalNotes();

  // Decide how many pulses will have notes (1 to min(totalPulses, 8))
  const numSelections = Math.floor(Math.random() * Math.min(totalPulses, 8)) + 1;

  // Create array of available pulses and shuffle
  const availablePulses = Array.from({ length: totalPulses }, (_, i) => i);
  shuffleArray(availablePulses);

  // Select the first N pulses with random notes (using CURRENT registry)
  const registry = registryController.getRegistry();
  for (let i = 0; i < numSelections && i < availablePulses.length; i++) {
    const pulseIdx = availablePulses[i];
    const noteIdx = Math.floor(Math.random() * totalNotes);
    selectedCells.set(`${registry}-${noteIdx}-${pulseIdx}`, true);
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
  if (bpmController) {
    bpmController.setValue(CONFIG.DEFAULT_BPM);
  }

  // Clear selections
  selectedCells.clear();

  // Reset tap tempo
  if (tapTempoHandler) {
    tapTempoHandler.reset();
  }

  // Clear any visual highlights
  clearPlaybackHighlights();

  // Update displays
  updateLongitud();
  updateGridVisibility();
  updateGrid();
  savePreferences();

  // Focus on Compás input
  elements.inputCompas?.focus();

  console.log('Reset complete');
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

/**
 * Auto-scroll to center the current pulse during playback
 * @param {number} pulseIndex - Current pulse being played
 */
function scrollToPulse(pulseIndex) {
  const matrix = elements.matrixContainer;
  const timeline = elements.timelineContainer;
  if (!matrix) return;

  // Find the cell at this pulse to get its position
  const cell = matrix.querySelector(`.grid-cell[data-pulse="${pulseIndex}"]`);
  if (!cell) return;

  const containerRect = matrix.getBoundingClientRect();

  // Calculate the absolute left position of the cell within the scrollable area
  const cellLeft = cell.offsetLeft;
  const cellWidth = cell.offsetWidth;

  // Target: center the cell in the visible area
  const targetScrollLeft = cellLeft - (containerRect.width / 2) + (cellWidth / 2);

  // Clamp to valid scroll range
  const maxScroll = matrix.scrollWidth - matrix.clientWidth;
  const newScrollLeft = Math.max(0, Math.min(targetScrollLeft, maxScroll));

  // Apply smooth scroll
  matrix.scrollLeft = newScrollLeft;

  // Sync timeline
  if (timeline) {
    timeline.scrollLeft = newScrollLeft;
  }
}

/**
 * Spin to a specific registry using Up/Down buttons
 * @param {number} targetRegistry - The registry to switch to
 */
function spinToRegistry(targetRegistry) {
  const currentRegistry = registryController.getRegistry();
  if (targetRegistry === currentRegistry) return;

  const steps = targetRegistry - currentRegistry;

  if (steps > 0) {
    // Need to go UP
    for (let i = 0; i < steps; i++) {
      elements.registroUp?.click();
    }
  } else {
    // Need to go DOWN
    for (let i = 0; i < Math.abs(steps); i++) {
      elements.registroDown?.click();
    }
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
  // NOTE: randomBtn is handled by initRandomMenu (with longpress support)
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

  // Initialize P1 Toggle (Pulse 0 special sound) - MUST be before mixer init
  const startIntervalToggle = document.getElementById('startIntervalToggle');
  const startSoundRow = document.querySelector('.interval-select-row');
  if (startIntervalToggle && startSoundRow) {
    window.__p1Controller = initP1ToggleUI({
      checkbox: startIntervalToggle,
      startSoundRow,
      storageKey: 'app19:p1Toggle',
      onChange: async (enabled) => {
        const audioInstance = await initAudio();
        if (audioInstance && typeof audioInstance.setMeasureEnabled === 'function') {
          audioInstance.setMeasureEnabled(enabled);
        }
      }
    });
  }

  // Initialize tap tempo handler
  if (elements.tapTempoBtn) {
    tapTempoHandler = createTapTempoHandler({
      getAudioInstance: initAudio,
      tapBtn: elements.tapTempoBtn,
      tapHelp: document.getElementById('tapHelp'),
      onBpmDetected: (newBpm) => {
        const clampedBpm = Math.min(CONFIG.MAX_BPM, Math.max(CONFIG.MIN_BPM, Math.round(newBpm)));
        bpmController?.setValue(clampedBpm);
        savePreferences();
      }
    });
    tapTempoHandler.attach();
    elements.tapTempoBtn.style.display = '';  // Show button
  }

  // Mixer integration (longpress on play button)
  const mixerMenu = document.getElementById('mixerMenu');
  if (mixerMenu && elements.playBtn) {
    initMixerMenu({
      menu: mixerMenu,
      triggers: [elements.playBtn],
      channels: [
        { id: 'pulse', label: 'Pulso', allowSolo: true },
        { id: 'instrument', label: 'Piano', allowSolo: true },
        { id: 'master', label: 'Master', allowSolo: false, isMaster: true }
      ]
    });

    // Subscribe to mixer changes for persistence
    subscribeMixer((snapshot) => {
      clearTimeout(mixerSaveTimeout);
      mixerSaveTimeout = setTimeout(() => {
        localStorage.setItem(MIXER_STORAGE_KEY, JSON.stringify(snapshot));
      }, 100);
    });

    // Load mixer state
    loadMixerState();
  }

  // Random menu (longpress to open configuration)
  const randomMenu = document.getElementById('randomMenu');
  if (elements.randomBtn && randomMenu) {
    initRandomMenu(elements.randomBtn, randomMenu, handleRandom);
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

/**
 * Load mixer state from localStorage
 */
function loadMixerState() {
  try {
    const saved = localStorage.getItem(MIXER_STORAGE_KEY);
    if (!saved) return;
    const state = JSON.parse(saved);

    if (window.NuzicMixer) {
      if (state.master !== undefined) {
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
