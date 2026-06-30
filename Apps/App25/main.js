// App25: Melodias con Escalas - Scale-based melodic sequencer
// Uses scale degrees (0-6) with optional chromatic modifiers (+/-)
// One note per pulse, 12 pulses total
// KEY FEATURE: Melody adapts when scale changes (degrees stay, MIDI changes)

import { createMusicalGrid } from '../../libs/musical-grid/index.js';
import { initMixerMenu, updateMixerChannelLabel } from '../../libs/app-common/mixer-menu.js';
import { withPlayButtonLoading } from '../../libs/app-common/play-loading.js';
import { initRandomMenu } from '../../libs/random/menu.js';
import { initP1ToggleUI } from '../../libs/shared-ui/sound-dropdown.js';
import { initAudioToggles } from '../../libs/app-common/audio-toggles.js';
import { getMixer, subscribeMixer } from '../../libs/sound/index.js';
import { registerFactoryReset, createPreferenceStorage } from '../../libs/app-common/preferences.js';
import { createMatrixHighlightController } from '../../libs/app-common/matrix-highlight-controller.js';
import { createMelodicAudioInitializer, setupAudioDefaults, CHANNEL_TIERS, createMixerPersistence } from '../../libs/app-common/audio-init.js';
import { isPianoLoaded, setupPianoPreload } from '../../libs/sound/piano.js';
import { isFluteLoaded } from '../../libs/sound/flute.js';
import { degToSemi, scaleSemis, motherScalesData } from '../../libs/scales/index.js';
import { createInfoTooltip } from '../../libs/app-common/info-tooltip.js';
import { createBpmController } from '../../libs/app-common/bpm-controller.js';
import { initIdleCaretFlash } from '../../libs/app-common/idle-caret-flash.js';
import { createOutputNotePill } from '../../libs/app-common/output-note-pill.js';
import { createScalePill } from '../../libs/app-common/scale-pill.js';

// ========== CONFIGURATION ==========
const TOTAL_PULSES = 13;   // Horizontal: 0-12 (creates 12 spaces)
const TOTAL_NOTES = 13;    // Vertical: 0-12 (one octave + degree 0 of upper octave)
const TOTAL_SPACES = 12;   // Spaces between pulses
const DEFAULT_BPM = 90;
const MIN_BPM = 50;
const MAX_BPM = 150;

// Scale configuration (from App24)
const APP25_SCALES = [
  { id: 'DIAT', rotation: 0, value: 'DIAT-0', name: 'Mayor', rootOffset: 0 },
  { id: 'DIAT', rotation: 5, value: 'DIAT-5', name: 'Menor Natural', rootOffset: 3 },
  { id: 'ARMme', rotation: 0, value: 'ARMme-0', name: 'Menor Armónica', rootOffset: 0 },
  { id: 'ARMma', rotation: 0, value: 'ARMma-0', name: 'Mayor Armónica', rootOffset: 0 },
  { id: 'ACUS', rotation: 0, value: 'ACUS-0', name: 'Acústica', rootOffset: 0 },
  { id: 'PENT', rotation: 0, value: 'PENT-0', name: 'Pentatónica', rootOffset: 0 },
  { id: 'TON', rotation: 0, value: 'TON-0', name: 'Tonos', rootOffset: 0 },
  { id: 'CROM', rotation: 0, value: 'CROM-0', name: 'Cromática', rootOffset: 0 },
  { id: 'OCT', rotation: 0, value: 'OCT-0', name: 'Octatónica', rootOffset: 0 },
  { id: 'HEX', rotation: 0, value: 'HEX-0', name: 'Hexatónica', rootOffset: 0 }
];

// ========== STATE ==========
let audio = null;
let musicalGrid = null;
let gridEditor = null;
let bpmController = null;
let currentBPM = DEFAULT_BPM;
let isPlaying = false;

// Scale state (format compatible with libs/scales)
let scaleState = {
  id: 'DIAT',
  rot: 0,
  root: 0
};

// Root offset for rotated modes (to keep degree 0 at the selected output note)
// For example: Menor Natural (rot=5) needs rootOffset=3 to compensate
let currentRootOffset = 0;

// Current scale length (for degree validation)
let currentScaleLength = 7;

// Memory for degrees that exceed current scale length
// Key: pulse index, Value: { degree, modifier } - the original pair before being hidden
const lostDegreesMemory = new Map();

// Elements
let playBtn = null;
let resetBtn = null;
let randomBtn = null;
let gridEditorContainer = null;


// ========== STORAGE HELPERS ==========
const preferenceStorage = createPreferenceStorage('app25');

// Info tooltip for warnings
const infoTooltip = createInfoTooltip({
  className: 'fraction-info-bubble auto-tip-below',
  autoRemoveDelay: 2000
});

// ========== AUDIO INITIALIZATION ==========
const _initAudio = createMelodicAudioInitializer({
  defaultInstrument: 'piano',
  getPreferences: () => preferenceStorage.load() || {}
});

async function initAudio() {
  if (!audio) {
    audio = await _initAudio();

    if (audio) {
      setupAudioDefaults(audio, { channels: CHANNEL_TIERS.MELODIC_PULSE });
    }

    const p1Stored = localStorage.getItem('app25:p1Toggle');
    if (audio && p1Stored === 'false' && typeof audio.setStartEnabled === 'function') {
      audio.setStartEnabled(false);
    }
  }
  return audio;
}

// ========== SCALE CONVERSIONS (using libs/scales) ==========

/**
 * Get VISUAL scale semitones (for soundline and grid display)
 *
 * FIXED VISUAL: Degree 0 is ALWAYS at soundline position 0 (bottom).
 * Only rootOffset is applied to compensate for rotated modes.
 * Example: Major scale always shows degrees at semitones [0,2,4,5,7,9,11,12].
 * Note 12 is degree 0 of the upper octave (for scale changes 7→5 notes).
 */
function getVisualScaleSemitones() {
  // Only apply rootOffset to compensate for rotated modes (NOT user's root)
  const visualState = { id: scaleState.id, rot: scaleState.rot, root: currentRootOffset };

  const sems = scaleSemis(scaleState.id);
  const result = [];
  for (let d = 0; d < sems.length; d++) {
    result.push(degToSemi(visualState, d));
  }

  // Always include note 12 (degree 0 of upper octave)
  // This is needed when switching from 7-note to 5-note scales
  result.push(12);

  return result;
}

/**
 * Convert degree + modifier to VISUAL note index (0-12)
 * Used for positioning cells on the grid.
 *
 * @param {number} degree - Scale degree (0 to N-1)
 * @param {string|null} modifier - '+' (sharp), '-' (flat), 'r+' (upper octave), or null
 * @returns {number|null} Note index 0-12 (12 = degree 0 upper octave)
 */
function degreeToVisualNoteIndex(degree, modifier = null) {
  if (degree === null || degree === undefined) return null;

  // Special case: degree 0 with 'r+' modifier = upper octave (note index 12)
  if (degree === 0 && modifier === 'r+') {
    return 12;
  }

  // Only apply rootOffset (NOT user's root) for visual positioning
  const visualState = { id: scaleState.id, rot: scaleState.rot, root: currentRootOffset };

  // Get semitone for this degree
  const semitone = degToSemi(visualState, degree);

  // Apply chromatic modifier
  let alteredSemitone = semitone;
  if (modifier === '+') alteredSemitone = (semitone + 1) % 12;
  if (modifier === '-') alteredSemitone = (semitone + 11) % 12;

  return alteredSemitone;
}

/**
 * Convert degree + modifier to MIDI note (for playback)
 * degree: 0 to N-1 (scale degree)
 * modifier: '+' (sharp), '-' (flat), 'r+' (upper octave), or null
 *
 * OCTAVE LOGIC: Notes ascend continuously from degree 0.
 * For rotated modes, we detect where semitones "wrap" (decrease) to handle octave.
 *
 * Examples:
 * - Major (rot=0): semitones [0,2,4,5,7,9,11] → all ascending, octave at wrap
 * - Menor Natural (rot=5): semitones [9,11,0,2,4,5,7] → wraps at degree 2
 *   - Degrees 0,1 in upper octave; degrees 2+ in lower octave
 * - Acústica (rot=0): semitones [0,2,4,6,7,9,10] → all ascending, no wrap
 * - 0r+ → Degree 0 of upper octave (MIDI +12)
 */
function degreeToMidi(degree, modifier = null) {
  if (degree === null || degree === undefined) return null;

  // The effective root determines the starting pitch
  const effectiveRoot = (scaleState.root + currentRootOffset) % 12;
  const effectiveState = { ...scaleState, root: effectiveRoot };

  // Special case: degree 0 with 'r+' modifier = upper octave
  if (degree === 0 && modifier === 'r+') {
    // Degree 0 semitone + 12 for upper octave
    const semitone = degToSemi(effectiveState, 0);
    return 60 + semitone + 12;
  }

  // Get all semitones of the scale to detect octave wrap point
  const sems = scaleSemis(scaleState.id);
  const scaleLength = sems.length;

  // Build array of semitones for each degree (with effective root)
  const degreeSemitones = [];
  for (let d = 0; d < scaleLength; d++) {
    degreeSemitones.push(degToSemi(effectiveState, d));
  }

  // Find where the octave wraps (where semitone decreases)
  // For Major: no wrap within octave (all ascending)
  // For Menor Natural rot=5: [9,11,0,...] → wraps at index 2 (0 < 11)
  let wrapIndex = scaleLength; // Default: wrap happens at the end (next octave)
  for (let i = 1; i < scaleLength; i++) {
    if (degreeSemitones[i] < degreeSemitones[i - 1]) {
      wrapIndex = i;
      break;
    }
  }

  // Get semitone for this degree
  const semitone = degToSemi(effectiveState, degree);

  // Apply chromatic modifier
  let alteredSemitone = semitone;
  if (modifier === '+') alteredSemitone = (semitone + 1) % 12;
  if (modifier === '-') alteredSemitone = (semitone + 11) % 12;

  // Calculate octave: degrees before wrap are in "upper" position,
  // degrees at/after wrap are in "lower" position (add 12 to make them higher)
  const octaveOffset = degree >= wrapIndex ? 12 : 0;

  return 60 + alteredSemitone + octaveOffset;
}

// ========== VISUAL FEEDBACK ==========
let highlightController = null;

// ========== PLAYBACK ==========

async function handlePlay() {
  if (isPlaying) {
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

  const allPairs = gridEditor.getPairs();

  isPlaying = true;

  if (randomBtn) randomBtn.disabled = true;

  if (playIcon && stopIcon) {
    playIcon.style.display = 'none';
    stopIcon.style.display = 'block';
  }

  const intervalSec = (60 / currentBPM);

  // Register note provider BEFORE play (declarative scheduling)
  audio.registerNoteProvider('melody', (step) => {
    const pair = allPairs.find(p => p.pulse === step);
    if (pair && !pair.isRest) {
      const midi = degreeToMidi(pair.degree, pair.modifier);
      const duration = intervalSec * 0.9;
      return [{ midi, duration, velocity: 0.8 }];
    }
    return null;
  });

  audio.play(
    TOTAL_SPACES,
    intervalSec,
    new Set(),
    false,
    (step) => {
      // Playhead vertical line sobre la cel·la actual.
      musicalGrid?.updatePlayhead?.(step);
      highlightController?.highlightPulse(step);

      const pair = allPairs.find(p => p.pulse === step);
      if (pair && !pair.isRest) {
        const duration = intervalSec * 0.9;

        // Visual feedback on grid - use VISUAL positioning (not MIDI)
        const noteIndex = degreeToVisualNoteIndex(pair.degree, pair.modifier);
        const cell = musicalGrid.getCellElement(noteIndex, step);
        if (cell) {
          cell.classList.add('playing');
          setTimeout(() => cell.classList.remove('playing'), duration * 1000);
        }
      }

      // Il·luminem la cel·la de l'EDITOR del pols actual.
      document.querySelectorAll('.degree-editor-cell.playing').forEach(c => c.classList.remove('playing'));
      document.querySelectorAll(`.degree-editor-cell[data-pulse="${step}"]`).forEach(c => {
        c.classList.add('playing');
        setTimeout(() => c.classList.remove('playing'), intervalSec * 0.9 * 1000);
      });
    },
    () => {
      const lastNoteDelay = intervalSec * 0.9 * 1000;
      stopPlayback(lastNoteDelay);
    }
  );
}

function stopPlayback(delayMs = 0) {
  isPlaying = false;

  if (randomBtn) randomBtn.disabled = false;

  if (delayMs > 0) {
    setTimeout(() => {
      audio?.stop();
    }, delayMs);
  } else {
    audio?.stop();
  }

  highlightController?.clearHighlights();

  // Amaga el playhead vertical.
  musicalGrid?.hidePlayhead?.();

  document.querySelectorAll('.musical-cell.playing').forEach(cell => {
    cell.classList.remove('playing');
  });

  // Clear highlights de les cel·les de l'editor.
  document.querySelectorAll('.degree-editor-cell.playing').forEach(cell => {
    cell.classList.remove('playing');
  });

  const playIcon = playBtn?.querySelector('.icon-play');
  const stopIcon = playBtn?.querySelector('.icon-stop');
  if (playIcon && stopIcon) {
    playIcon.style.display = 'block';
    stopIcon.style.display = 'none';
  }
}

// ========== RESET ==========

function handleReset() {
  gridEditor?.clear();
  musicalGrid?.clear();

  // musicalGrid.clear() only removes .active/.highlight classes. Strip the
  // App25-specific .rest markers (silence dotted lines) and any cell labels
  // the silence sync added.
  document.querySelectorAll('.musical-cell.rest').forEach(cell => {
    cell.classList.remove('rest');
  });
  document.querySelectorAll('.musical-cell .cell-label').forEach(el => el.remove());

  lostDegreesMemory.clear();

  if (musicalGrid?.clearIntervalPaths) {
    musicalGrid.clearIntervalPaths();
  }

  if (isPlaying) {
    stopPlayback();
  }
}

// ========== RANDOM GENERATION ==========

function handleRandom() {
  if (isPlaying) return;

  // 1. Randomize scale
  const randomScaleIndex = Math.floor(Math.random() * APP25_SCALES.length);
  const randomScale = APP25_SCALES[randomScaleIndex];
  const escalaSelect = document.getElementById('escalaSelect');
  if (escalaSelect) escalaSelect.value = randomScale.value;
  handleScaleChange({ scaleId: randomScale.id, rotation: randomScale.rotation, value: randomScale.value });

  // 2. Randomize sequence
  const randDensity = parseInt(document.getElementById('randDensity')?.value || 8, 10);

  // Generate random pairs based on density
  // Use the NEW scale length after scale change
  const newScaleLength = motherScalesData[randomScale.id]?.ee?.length || 7;
  const numPairs = Math.max(1, Math.min(randDensity, TOTAL_SPACES));
  const allPulses = Array.from({ length: TOTAL_SPACES }, (_, i) => i);

  // Shuffle pulses
  for (let i = allPulses.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allPulses[i], allPulses[j]] = [allPulses[j], allPulses[i]];
  }

  const selectedPulses = new Set(allPulses.slice(0, numPairs));

  // Generate pairs for ALL pulses: notes for selected, rests for others
  const pairs = allPulses.map(pulse => {
    if (selectedPulses.has(pulse)) {
      return {
        degree: Math.floor(Math.random() * newScaleLength),
        modifier: null,
        pulse: pulse,
        isRest: false
      };
    } else {
      return {
        degree: null,
        modifier: null,
        pulse: pulse,
        isRest: true
      };
    }
  });

  gridEditor?.setPairs(pairs);
  syncGridFromDegrees(pairs);

  // Auto-play after randomizing (consistent across apps 9+).
  if (!isPlaying) handlePlay();
}

// ========== SYNCHRONIZATION ==========

function syncGridFromDegrees(pairs) {
  if (!musicalGrid) return;

  // Clear all active cells, rest cells, and labels
  document.querySelectorAll('.musical-cell.active, .musical-cell.rest').forEach(cell => {
    cell.classList.remove('active', 'rest');
    const label = cell.querySelector('.cell-label');
    if (label) label.remove();
  });

  // Sort by pulse and track last playable noteIndex for silence placement
  const sorted = [...pairs].sort((a, b) => a.pulse - b.pulse);
  let lastNoteIndex = 0; // Base note row for silences

  sorted.forEach(({ degree, modifier, pulse, isRest }) => {
    if (isRest) {
      // Silence: dotted line on the last playable note row
      const cell = musicalGrid.getCellElement(lastNoteIndex, pulse);
      if (cell) cell.classList.add('rest');
      return;
    }
    if (degree === null || degree === undefined) return;

    // Use VISUAL positioning (independent of user's transpose)
    const noteIndex = degreeToVisualNoteIndex(degree, modifier);
    if (noteIndex === null) return;

    lastNoteIndex = noteIndex;

    const cell = musicalGrid.getCellElement(noteIndex, pulse);
    if (cell) {
      cell.classList.add('active');

      // Add degree label
      const label = document.createElement('span');
      label.className = modifier ? 'cell-label cell-label--modified' : 'cell-label';
      label.textContent = formatDegreeLabel(degree, modifier);
      cell.appendChild(label);
    }
  });
}

function formatDegreeLabel(degree, modifier) {
  if (modifier === 'r+') return `${degree}r5`;
  if (modifier === '+') return `+${degree}`;
  if (modifier === '-') return `-${degree}`;
  return `${degree}`;
}

// ========== SCALE CHANGE HANDLERS ==========

function updateGridCellStates() {
  if (!musicalGrid) return;

  // Use base scale for visual display
  const scaleSemitones = getVisualScaleSemitones();

  // Update cell enabled states
  if (musicalGrid.setEnabledNotes) {
    musicalGrid.setEnabledNotes(scaleSemitones);
  }

  // Update degree labels on soundline
  updateSoundlineLabels();
}

function updateSoundlineLabels() {
  if (!musicalGrid) return;

  // Use base scale for visual display
  const scaleSemitones = getVisualScaleSemitones();

  // Use the API if available
  if (musicalGrid.updateSoundlineLabels) {
    musicalGrid.updateSoundlineLabels(scaleSemitones, (noteIndex) => {
      // Note 12 is degree 0 of upper octave (register 5)
      if (noteIndex === 12) {
        return '0r5';
      }
      const degreeIndex = scaleSemitones.indexOf(noteIndex);
      if (degreeIndex === -1) return '·';
      // Degree 0 at bottom shows register 4
      if (degreeIndex === 0) return '0r4';
      return String(degreeIndex);
    });
  }
}

/**
 * Handle scale change - PARALLEL MODE
 *
 * VISUAL IS FIXED: Soundline positions 0-11 are fixed semitones (C=0, C#=1, etc.)
 * Scale degrees are assigned to their corresponding semitone positions.
 *
 * When scale changes:
 * - The ROOT stays the same (parallel mode - Do Major → Do minor)
 * - Visual positions change based on which semitones belong to the new scale
 * - Degrees are re-mapped to the new scale structure
 */
function handleScaleChange({ scaleId, rotation, value }) {
  const oldScaleLength = currentScaleLength;

  // Update scale state - ROOT STAYS THE SAME (parallel mode)
  // This is the key: changing scale doesn't change root, so degree 0 stays at same note
  scaleState.id = scaleId;
  scaleState.rot = rotation;

  // Find rootOffset from our scale configuration
  // This compensates for rotated modes to keep degree 0 at the user's selected note
  const scaleConfig = APP25_SCALES.find(s => s.value === value);
  currentRootOffset = scaleConfig?.rootOffset || 0;

  currentScaleLength = motherScalesData[scaleId]?.ee?.length || 7;

  // Update grid cell states (which notes are enabled based on new scale)
  updateGridCellStates();

  // Adapt pairs to new scale: hide degrees that exceed scale length, restore from memory
  if (gridEditor) {
    const currentPairs = gridEditor.getPairs();
    const adaptedPairs = [];

    for (const pair of currentPairs) {
      const pulse = pair.pulse;

      // Case 1: Current pair is a rest - check memory for recoverable degree
      if (pair.isRest) {
        const memorized = lostDegreesMemory.get(pulse);
        if (memorized && memorized.degree < currentScaleLength) {
          // Restore from memory - degree is now valid
          adaptedPairs.push({
            degree: memorized.degree,
            modifier: memorized.modifier,
            pulse,
            isRest: false
          });
          lostDegreesMemory.delete(pulse);
        } else {
          // Keep as rest
          adaptedPairs.push(pair);
        }
        continue;
      }

      // Case 2: Handle 0r+ (upper octave) - always valid
      if (pair.degree === 0 && pair.modifier === 'r+') {
        adaptedPairs.push(pair);
        continue;
      }

      // Case 3: Degree is valid for new scale - keep it
      if (pair.degree < currentScaleLength) {
        adaptedPairs.push(pair);
        // Also check if there's a memorized degree at this pulse that can be cleared
        // (because user manually placed a new note here)
        continue;
      }

      // Case 4: Degree exceeds new scale - hide it (convert to rest) and save to memory
      lostDegreesMemory.set(pulse, {
        degree: pair.degree,
        modifier: pair.modifier
      });
      adaptedPairs.push({
        degree: null,
        modifier: null,
        pulse,
        isRest: true
      });
    }

    // Update grid editor with adapted pairs
    gridEditor.setPairs(adaptedPairs);

    // Re-sync visual grid with new positions
    syncGridFromDegrees(adaptedPairs);
  }
}

// ========== TRANSPOSITION (output note) ==========

/** Clampa un valor entrant a 0..11 cíclic. */
function clampOutputNote(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return ((Math.round(num) % 12) + 12) % 12;
}

/**
 * Handle transposition change — la pastilla "Transposición" mou la nota
 * real que sona al grau 0 sense canviar la disposició visual (el grau 0
 * queda sempre a la posició inferior de la soundline). Només canvien els
 * MIDI disparats per `degreeToMidi()` via `scaleState.root`. No cal
 * re-renderitzar el grid: les cel·les estan vinculades a graus, no a
 * notes absolutes.
 */
function handleTransposeChange(value) {
  scaleState.root = clampOutputNote(value);
  // Persistim per a sessions futures (patró JSON: load → spread → save).
  const currentPrefs = preferenceStorage.load() || {};
  currentPrefs.outputNote = scaleState.root;
  preferenceStorage.save(currentPrefs);
}

// ========== NUZIC DEGREE EDITOR (single row) ==========

function initDegreeEditor() {
  const container = gridEditorContainer;
  if (!container) return;
  container.innerHTML = '';

  // Label
  const label = document.createElement('div');
  label.className = 'degree-editor-label';
  label.textContent = 'Nº';

  // Cells container
  const cellsContainer = document.createElement('div');
  cellsContainer.className = 'degree-editor-cells';

  // End marker
  const endMarker = document.createElement('div');
  endMarker.className = 'degree-editor-end';
  endMarker.style.display = 'none';
  cellsContainer.appendChild(endMarker);

  container.appendChild(label);
  container.appendChild(cellsContainer);

  // State
  let entries = []; // [{degree, modifier, pulse}]
  let autoJumpTimer = null;

  function showTooltip(cell, message) {
    // Delega al `infoTooltip` compartit (mateix patró que App25B). El
    // tooltip antic vivia en `.degree-editor-tooltip` amb estils locals;
    // ara reutilitza el wrapper genèric `createInfoTooltip`.
    infoTooltip.show(message, cell);
  }

  function formatDegree(entry) {
    // Silenci: mostra 's' (igual que App25B) dins una cel·la de valor blanca
    // editable, no una cel·la rosa readonly.
    if (entry.isRest || entry.degree === null) return 's';
    if (entry.modifier === 'r+') return `${entry.degree}r5`;
    if (entry.modifier === '+') return `+${entry.degree}`;
    if (entry.modifier === '-') return `-${entry.degree}`;
    return String(entry.degree);
  }

  function createReadonlyCell() {
    const cell = document.createElement('input');
    cell.type = 'text';
    cell.className = 'degree-editor-cell';
    cell.placeholder = ' ';
    cell.readOnly = true;
    cell.tabIndex = -1;
    return cell;
  }

  function createValueCell(displayValue, entryIndex) {
    const cell = document.createElement('input');
    cell.type = 'text';
    cell.maxLength = 4;
    cell.className = 'degree-editor-cell';
    cell.value = displayValue;
    cell.dataset.entryIndex = entryIndex;
    cell.readOnly = false;
    cell.style.cursor = 'text';

    let originalValue = cell.value;

    cell.addEventListener('focus', () => { originalValue = cell.value; cell.select(); });

    cell.addEventListener('blur', () => {
      const val = cell.value.trim();
      if (!val || val === originalValue) { cell.value = originalValue; return; }

      const idx = parseInt(cell.dataset.entryIndex);
      const entry = entries[idx];
      if (!entry) { cell.value = originalValue; return; }

      const parsed = parseDegreeInput(val);
      if (!parsed) {
        showTooltip(cell, `Grado: 0-${currentScaleLength - 1}`);
        cell.value = originalValue;
        return;
      }

      // Conversió a silenci ("s", ".", "·"): netegem grau/modificador.
      if (parsed.isRest) {
        entry.degree = null;
        entry.modifier = null;
        entry.isRest = true;
        notifyChange();
        renderCells();
        return;
      }

      if (!validateDegree(parsed.degree)) {
        showTooltip(cell, `Grado: 0-${currentScaleLength - 1}`);
        cell.value = originalValue;
        return;
      }

      if (parsed.modifier && alterationLandsOnScaleDegree(parsed.degree, parsed.modifier)) {
        showTooltip(cell, 'Esa alteración cae en otro grado de la escala');
        cell.value = originalValue;
        return;
      }

      const registerMsg = detectRegisterCorrection(val);
      if (registerMsg) showTooltip(cell, registerMsg);

      entry.degree = parsed.degree;
      entry.modifier = parsed.modifier;
      entry.isRest = false;
      notifyChange();
      renderCells();
    });

    cell.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); cell.blur(); return; }
      if (e.key === 'Tab') {
        e.preventDefault();
        cell.blur();
        const allCells = Array.from(cellsContainer.querySelectorAll('.degree-editor-cell:not([readonly])'));
        const idx = allCells.indexOf(cell);
        const next = e.shiftKey ? allCells[idx - 1] : allCells[idx + 1];
        if (next) next.focus();
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const allCells = Array.from(cellsContainer.querySelectorAll('.degree-editor-cell:not([readonly])'));
        const idx = allCells.indexOf(cell);
        const next = e.key === 'ArrowRight' ? allCells[idx + 1] : allCells[idx - 1];
        if (next) { e.preventDefault(); next.focus(); }
      }
    });

    return cell;
  }

  function createInputCell() {
    const cell = document.createElement('input');
    cell.type = 'text';
    cell.maxLength = 4;  // allow "0r+" (3 chars) + safety
    cell.className = 'degree-editor-cell active-input';
    cell.readOnly = false;

    cell.addEventListener('input', (e) => {
      const val = e.target.value;
      if (val === '') { clearTimeout(autoJumpTimer); return; }
      const lower = val.trim().toLowerCase();

      // Silenci ("s", "·" o "." sol).
      if (/^[s·.]$/.test(lower)) {
        clearTimeout(autoJumpTimer);
        commitDegree({ isRest: true });
        return;
      }

      // Alteració sola (+/-): el caret espera INDEFINIDAMENT el grau (sense timer).
      if (/^[+-]$/.test(val)) { clearTimeout(autoJumpTimer); return; }

      // Octava (NOMÉS grau 0): "0r"/"0." parcials → espera; complets → commit.
      if (/^0(r|\.)$/.test(lower)) { clearTimeout(autoJumpTimer); return; }
      if (/^0(r|\.)[45]$/.test(lower) || /^0r\+$/.test(lower)) {
        clearTimeout(autoJumpTimer);
        commitDegree({ degree: 0, modifier: /5$|r\+$/.test(lower) ? 'r+' : null });
        return;
      }
      // Octava invàlida: "0r"/"0." amb un dígit que no és 4 ni 5 → explica per què.
      if (/^0(r|\.)\d$/.test(lower)) {
        clearTimeout(autoJumpTimer);
        showTooltip(cell, 'Solo 0r4 y 0r5 son registros válidos');
        cell.value = '';
        return;
      }

      // Grau amb alteració opcional ABANS: [+-]?\d+
      const m = val.match(/^([+-]?)(\d+)$/);
      if (!m) { e.target.value = ''; clearTimeout(autoJumpTimer); return; }
      const sign = m[1];
      const degStr = m[2];
      const degree = parseInt(degStr, 10);
      const modifier = sign === '+' ? '+' : sign === '-' ? '-' : null;
      clearTimeout(autoJumpTimer);

      // Confirma el grau (validacions) i salta; o mostra tooltip i sanititza.
      const tryCommit = () => {
        if (!validateDegree(degree)) {
          showTooltip(cell, `Grado: 0-${currentScaleLength - 1}`);
          cell.value = '';
          return;
        }
        if (modifier && alterationLandsOnScaleDegree(degree, modifier)) {
          showTooltip(cell, 'Esa alteración cae en otro grado de la escala');
          cell.value = '';
          return;
        }
        commitDegree({ degree, modifier });
      };

      // "0" net → espera 2000ms per si ve el registre d'octava (r/.).
      if (degStr === '0' && !modifier) {
        autoJumpTimer = setTimeout(() => {
          if (/^0(r|\.)/.test(cell.value)) return; // ha començat el registre
          tryCommit();
        }, 2000);
        return;
      }
      // Grau d'un sol dígit que encara pot estendre's a 2-dígit vàlid → espera 2000ms.
      if (degStr.length === 1 && degree >= 1 && degree * 10 < currentScaleLength) {
        autoJumpTimer = setTimeout(() => {
          if (/^[+-]?\d{2}$/.test(cell.value)) return; // 2n dígit arribat
          tryCommit();
        }, 2000);
        return;
      }
      // No ambigu → salt directe a la casella següent.
      tryCommit();
    });

    cell.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        clearTimeout(autoJumpTimer);
        const val = cell.value.trim();
        if (val) {
          const parsed = parseDegreeInput(val);
          if (parsed?.isRest) {
            commitDegree({ isRest: true });
          } else if (parsed && validateDegree(parsed.degree)) {
            const registerMsg = detectRegisterCorrection(val);
            if (registerMsg) showTooltip(cell, registerMsg);
            commitDegree(parsed);
          }
        }
        return;
      }

      if (e.key === 'Backspace' && !e.target.value) {
        e.preventDefault();
        clearTimeout(autoJumpTimer);
        if (entries.length > 0) {
          entries.pop();
          notifyChange();
          renderCells();
        }
      }
    });

    return cell;
  }

  function parseDegreeInput(val) {
    // Silenci: "s" o àlies "·". (El "." sol també és silenci; després d'un "0"
    // és el separador de registre — ho gestiona l'input handler.)
    const lower = val.trim().toLowerCase();
    if (lower === 's' || lower === '·' || lower === '.') return { isRest: true };
    // Octava (NOMÉS grau 0): "0r4"/"0.4" base; "0r5"/"0.5"/"0r+" octava superior.
    if (/^0(r|\.)4$/.test(lower)) return { degree: 0, modifier: null };
    if (/^0(r|\.)5$/.test(lower) || /^0r\+$/.test(lower)) return { degree: 0, modifier: 'r+' };
    // Alteració ABANS del grau: "+3" sostingut, "-3" bemoll, "3" net.
    const m = val.match(/^([+-]?)(\d+)$/);
    if (m) {
      const degree = parseInt(m[2], 10);
      const modifier = m[1] === '+' ? '+' : m[1] === '-' ? '-' : null;
      return { degree, modifier };
    }
    return null;
  }

  // Una alteració (♯/♭) NOMÉS és vàlida si la nota alterada NO coincideix amb cap
  // grau de l'escala: no es pot "arribar" a un altre grau a través d'alteracions.
  function alterationLandsOnScaleDegree(degree, modifier) {
    if (modifier !== '+' && modifier !== '-') return false;
    const visualState = { id: scaleState.id, rot: scaleState.rot, root: currentRootOffset };
    const norm = (s) => ((s % 12) + 12) % 12;
    const altered = norm(degToSemi(visualState, degree) + (modifier === '+' ? 1 : -1));
    for (let d = 0; d < currentScaleLength; d++) {
      if (norm(degToSemi(visualState, d)) === altered) return true;
    }
    return false;
  }

  // Detects when the user typed a register spec (e.g. "0r3", "5r4", "0r")
  // that doesn't match a valid form (0r4, 0r5, Xr+). Valid forms mean no
  // silent correction. Anything else gets normalised to register 4.
  function detectRegisterCorrection(val) {
    if (!/r/.test(val)) return null;
    if (/^0r4$/.test(val) || /^0r5$/.test(val) || /^\d+r\+$/.test(val)) return null;
    return 'Solo 0r4 y 0r5 son registros válidos';
  }

  function validateDegree(degree) {
    return degree >= 0 && degree < currentScaleLength;
  }

  function commitDegree(parsed) {
    const pulse = entries.length;
    if (pulse >= TOTAL_SPACES) return;

    if (parsed.isRest) {
      entries.push({ degree: null, modifier: null, pulse, isRest: true });
    } else {
      entries.push({ degree: parsed.degree, modifier: parsed.modifier, pulse, isRest: false });
    }
    lostDegreesMemory.delete(pulse);
    notifyChange();
    renderCells();
  }

  function notifyChange() {
    const pairs = entries.map((e, i) => ({ ...e, pulse: i }));
    syncGridFromDegrees(pairs);
  }

  function renderCells() {
    cellsContainer.querySelectorAll('.degree-editor-cell').forEach(c => c.remove());

    const nonRestCount = entries.filter(e => !e.isRest).length;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      // Notes I silencis es renderitzen igual: cel·la de valor BLANCA i
      // EDITABLE (el silenci mostra 's' i es pot tornar a editar a un grau)
      // + separador. `data-pulse` perquè la reproducció il·lumini la cel·la
      // (notes i silencis).
      const valueCell = createValueCell(formatDegree(entry), i);
      valueCell.dataset.pulse = String(entry.pulse);
      cellsContainer.insertBefore(valueCell, endMarker);
      cellsContainer.insertBefore(createReadonlyCell(), endMarker);
    }

    if (entries.length < TOTAL_SPACES) {
      const input = createInputCell();
      cellsContainer.insertBefore(input, endMarker);
      cellsContainer.insertBefore(createReadonlyCell(), endMarker);
      setTimeout(() => input.focus(), 30);
    }

    endMarker.style.display = entries.length >= TOTAL_SPACES ? 'flex' : 'none';
  }

  renderCells();

  // Public API (compatible with legacy gridEditor)
  gridEditor = {
    getPairs: () => entries.map(e => ({ ...e })),

    setPairs: (pairs) => {
      // Keep ALL pairs (including rests — needed for lostDegreesMemory).
      // Ordenem per puls: el generador aleatori barreja l'ordre de les pairs
      // (mantenint cada `.pulse`); sense reordenar, les cel·les de l'editor
      // (i el seu highlight de reproducció) surten desordenades respecte als
      // pulsos. Després d'ordenar, l'ordre visual coincideix amb el puls.
      entries = (pairs || [])
        .slice()
        .sort((a, b) => (a.pulse ?? 0) - (b.pulse ?? 0))
        .map(p => ({
          degree: p.degree ?? null,
          modifier: p.modifier || null,
          pulse: p.pulse,
          isRest: p.isRest || false
        }));
      clearTimeout(autoJumpTimer);
      renderCells();
    },

    clear: () => {
      entries = [];
      clearTimeout(autoJumpTimer);
      renderCells();
    },

    clearHighlights: () => {},

    destroy: () => {
      clearTimeout(autoJumpTimer);
      container.innerHTML = '';
    }
  };
}

// ========== DOM INJECTION ==========

function injectLayout() {
  const timelineWrapper = document.querySelector('.timeline-wrapper');
  if (!timelineWrapper) return null;

  // Save controls BEFORE clearing (detach, don't clone — preserves IDs and future listeners)
  const controls = timelineWrapper.querySelector('.controls');
  if (controls) controls.remove();

  // Clear timeline-wrapper (remove default timeline)
  timelineWrapper.innerHTML = '';

  // Store reference for later re-insertion
  timelineWrapper._savedControls = controls;

  return timelineWrapper;
}

// ========== INITIALIZATION ==========

async function init() {
  // Note: Audio preload is now handled by first-interaction listener (see below)
  // This avoids the delay and ensures immediate response on first cell click

  // Create layout
  const gridWrapper = injectLayout();
  if (!gridWrapper) {
    console.error('Failed to create layout');
    return;
  }

  const prefs = preferenceStorage.load() || {};

  // Initialize scale selector
  // Set initial scale state from preferences or default
  const initialScaleValue = prefs.scaleValue || 'DIAT-0';
  const initialScaleConfig = APP25_SCALES.find(s => s.value === initialScaleValue);
  if (initialScaleConfig) {
    scaleState.id = initialScaleConfig.id;
    scaleState.rot = initialScaleConfig.rotation;
    currentRootOffset = initialScaleConfig.rootOffset || 0;
    currentScaleLength = motherScalesData[initialScaleConfig.id]?.ee?.length || 7;
  } else {
    currentScaleLength = motherScalesData['DIAT']?.ee?.length || 7;
  }

  // Initial transposition (scaleState.root) from preferences. La nota real
  // que sona al grau 0 és `60 (C4) + scaleState.root`; la resta de l'escala
  // s'hi aplica a partir d'aquí seguint l'eE de l'escala escollida. El
  // visual del grid no rota (el grau 0 sempre queda a baix de la
  // soundline) — només canvien els MIDI que es disparen.
  const initialOutputNote = clampOutputNote(prefs.outputNote);
  scaleState.root = initialOutputNote;

  // Pastilla "Escala" — desplegable nadiu poblat amb APP25_SCALES.
  // Vegeu `libs/shared-ui/scale-pill.css` per l'estètica i
  // `libs/app-common/scale-pill.js` per la lògica.
  createScalePill({
    scales: APP25_SCALES,
    initial: initialScaleValue,
    onChange: (sc) => handleScaleChange({
      scaleId: sc.id,
      rotation: sc.rotation,
      value: sc.value,
    }),
  });

  // Pastilla "Transposición" — input cíclic 0-11 a la dreta de Escala.
  // Vegeu `handleTransposeChange()` per la lògica de transposició MIDI.
  createOutputNotePill({
    initial: scaleState.root,
    onChange: (value) => handleTransposeChange(value),
  });

  // Create musical grid inside timeline-wrapper. The last pulse (index
  // TOTAL_PULSES-1 = 12) renders as a `·` cycle-end marker — visual
  // only, not clickable. Playback already caps at pulse 11.
  musicalGrid = createMusicalGrid({
    parent: gridWrapper,
    notes: TOTAL_NOTES,
    pulses: TOTAL_PULSES,
    showCycleEnd: true,
    startMidi: 60,
    fillSpaces: true,
    cellClassName: 'musical-cell',
    activeClassName: 'active',
    highlightClassName: 'highlight',
    scrollEnabled: false,  // NO scroll - grid must fit 12 notes
    showIntervals: {
      horizontal: true,
      vertical: false
    },
    intervalColor: '#4A9EFF',
    noteFormatter: (noteIndex) => {
      const scaleSems = getVisualScaleSemitones();
      if (noteIndex === 12) return '0r5';
      const degreeIndex = scaleSems.indexOf(noteIndex);
      if (degreeIndex === -1) return '·';
      if (degreeIndex === 0) return '0r4';
      return String(degreeIndex);
    },
    onCellClick: async (noteIndex, pulseIndex, cellElement) => {
      const audioInstance = await initAudio();

      if (!window.Tone || !audioInstance) {
        console.warn('Audio not available');
        return;
      }

      // Use base scale for visual click detection
      const scaleSems = getVisualScaleSemitones();

      // Check if note is in scale
      if (!scaleSems.includes(noteIndex)) {
        infoTooltip.show('Solo se permiten notas de la escala', cellElement);
        return;
      }

      const degree = scaleSems.indexOf(noteIndex);
      const midi = 60 + noteIndex;
      const duration = (60 / currentBPM) * 0.9;
      const Tone = window.Tone;
      audioInstance.playNote(midi, duration, Tone.now());

      if (!gridEditor) return;

      const currentPairs = gridEditor.getPairs();
      const existingPair = currentPairs.find(p => p.pulse === pulseIndex && !p.isRest);

      let newPairs;
      // Check if clicking on the SAME note (same degree) - toggle off
      const isSameNote = existingPair && existingPair.degree === degree && !existingPair.modifier;

      if (isSameNote) {
        // Toggle off - remove the note
        newPairs = currentPairs.filter(p => p.pulse !== pulseIndex);
      } else {
        // Replace with new note (removes any existing at this pulse)
        newPairs = currentPairs.filter(p => p.pulse !== pulseIndex);
        // Handle note 12 as 0r+ (upper octave)
        const modifier = noteIndex === 12 ? 'r+' : null;
        const actualDegree = noteIndex === 12 ? 0 : degree;
        newPairs.push({ degree: actualDegree, modifier, pulse: pulseIndex, isRest: false });
      }

      gridEditor.setPairs(newPairs);
      syncGridFromDegrees(newPairs);
    }
  });

  // Initial cell states
  updateGridCellStates();

  // Create nuzic degree editor INSIDE .grid-container (as grid-row 3)
  const gridContainer = gridWrapper.querySelector('.grid-container');
  gridEditorContainer = document.createElement('div');
  gridEditorContainer.className = 'degree-editor';
  gridEditorContainer.id = 'degreeEditor';
  if (gridContainer) {
    gridContainer.appendChild(gridEditorContainer);
  } else {
    gridWrapper.appendChild(gridEditorContainer);
  }

  // Restore saved controls (were saved before innerHTML='' in injectLayout)
  const savedControls = gridWrapper._savedControls;
  if (savedControls) {
    // Reorder: Play, BPM, Random, Reset
    const bpmParam = document.getElementById('bpmParam');
    const playBtnEl = savedControls.querySelector('.play');
    const randomBtnEl = savedControls.querySelector('.random');
    const resetBtnEl = savedControls.querySelector('.reset');
    const randomMenuEl = savedControls.querySelector('.random-menu');

    while (savedControls.firstChild) savedControls.removeChild(savedControls.firstChild);

    if (playBtnEl) savedControls.appendChild(playBtnEl);
    if (bpmParam) savedControls.appendChild(bpmParam);
    if (randomBtnEl) savedControls.appendChild(randomBtnEl);
    if (randomMenuEl) savedControls.appendChild(randomMenuEl);
    if (resetBtnEl) savedControls.appendChild(resetBtnEl);

    gridWrapper.appendChild(savedControls);
  }

  // Initialize the nuzic degree editor
  initDegreeEditor();


  // Initialize highlight controller.
  highlightController = createMatrixHighlightController({
    musicalGrid,
    gridEditor,
    totalNotes: TOTAL_NOTES,
    currentBPM: currentBPM,
    getBPM: () => currentBPM
  });

  // Preload audio on first user interaction anywhere in the app
  // This ensures Tone.js and the instrument are ready before the user clicks a cell
  let audioPreloadStarted = false;
  const preloadAudioOnFirstInteraction = async () => {
    if (audioPreloadStarted) return;
    audioPreloadStarted = true;
    // Remove listeners immediately to avoid duplicate calls
    document.removeEventListener('click', preloadAudioOnFirstInteraction, { capture: true });
    document.removeEventListener('touchstart', preloadAudioOnFirstInteraction, { capture: true });
    document.removeEventListener('keydown', preloadAudioOnFirstInteraction, { capture: true });
    // Start audio initialization (loads Tone.js + instrument)
    await initAudio();
  };
  document.addEventListener('click', preloadAudioOnFirstInteraction, { capture: true, once: true });
  document.addEventListener('touchstart', preloadAudioOnFirstInteraction, { capture: true, once: true });
  document.addEventListener('keydown', preloadAudioOnFirstInteraction, { capture: true, once: true });

  // Wait for DOM
  await new Promise(resolve => setTimeout(resolve, 50));

  // Query control buttons
  playBtn = document.getElementById('playBtn');
  randomBtn = document.getElementById('randomBtn');
  resetBtn = document.getElementById('resetBtn');

  // Event listeners.
  // NOTE: el randomBtn NO té un `click` listener directe — el cableig
  // viu a `initRandomMenu(...)` més avall, que distingeix shortpress
  // (handleRandom) de longpress (obrir el menú de configuració). Un
  // `addEventListener('click', handleRandom)` aquí dispararia també en
  // longpress, anul·lant la protecció anti-longpress del menú.
  playBtn?.addEventListener('click', handlePlay);
  resetBtn?.addEventListener('click', handleReset);

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

  // P1 Toggle
  const startIntervalToggle = document.getElementById('startIntervalToggle');
  const startSoundRow = document.querySelector('.interval-select-row');
  if (startIntervalToggle && startSoundRow) {
    window.__p1Controller = initP1ToggleUI({
      checkbox: startIntervalToggle,
      startSoundRow: startSoundRow,
      storageKey: 'app25:p1Toggle',
      onChange: async (enabled) => {
        const audioInstance = await initAudio();
        if (audioInstance && typeof audioInstance.setStartEnabled === 'function') {
          audioInstance.setStartEnabled(enabled);
        }
      }
    });
  }

  // Mixer integration
  const mixerMenu = document.getElementById('mixerMenu');
  if (mixerMenu) {
    // Get initial instrument label from stored preference
    const initialInstrument = localStorage.getItem('app25:selectedInstrument') || 'piano';
    const instrumentLabel = initialInstrument === 'flute' ? 'Flauta' : 'Piano';

    initMixerMenu({
      menu: mixerMenu,
      triggers: [playBtn].filter(Boolean),
      channels: [
        { id: 'start', label: 'P0', allowSolo: true },
        { id: 'pulse', label: 'Pulso', allowSolo: true },
        { id: 'instrument', label: instrumentLabel, allowSolo: true },
        { id: 'master', label: 'Master', allowSolo: false, isMaster: true }
      ]
    });
  }

  // Mixer state persistence (helper centralitzat)
  const mixerPersist = createMixerPersistence({ storageKey: 'app25-mixer' });
  setTimeout(() => mixerPersist.hydrate(audio), 50);
  mixerPersist.subscribe(audio);

  // Audio toggles
  const pulseToggleBtn = document.getElementById('pulseToggleBtn');
  if (pulseToggleBtn) {
    const globalMixer = getMixer();
    initAudioToggles({
      toggles: [
        {
          id: 'pulse',
          button: pulseToggleBtn,
          storageKey: 'app25:pulseAudio',
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

  // Random menu
  const randomMenu = document.getElementById('randomMenu');
  if (randomBtn && randomMenu) {
    initRandomMenu(randomBtn, randomMenu, handleRandom);
  }

  // Color picker
  const selectColor = document.getElementById('selectColor');
  if (selectColor) {
    selectColor.addEventListener('input', (e) => {
      const color = e.target.value;
      document.documentElement.style.setProperty('--select-color', color);
      document.documentElement.style.setProperty('--selection-color', color);
      const currentPrefs = preferenceStorage.load() || {};
      currentPrefs.selectColor = color;
      preferenceStorage.save(currentPrefs);
    });
  }

  // Wire instrument dropdown
  window.addEventListener('sharedui:instrument', async (e) => {
    const instrument = e.detail.instrument;

    await initAudio();
    await audio.setInstrument(instrument);

    // Update mixer channel label to reflect new instrument
    const instrumentLabel = instrument === 'flute' ? 'Flauta' : 'Piano';
    updateMixerChannelLabel('instrument', instrumentLabel);

    const currentPrefs = preferenceStorage.load() || {};
    currentPrefs.selectedInstrument = instrument;
    preferenceStorage.save(currentPrefs);
  });

  // Factory reset
  registerFactoryReset({
    storage: preferenceStorage,
    onBeforeReload: () => {
      handleReset();

      localStorage.removeItem('app25:p1Toggle');
      localStorage.removeItem('app25:pulseAudio');
      localStorage.removeItem('app25-mixer');

      const randDensity = document.getElementById('randDensity');
      if (randDensity) randDensity.value = '8';
    }
  });

  // Preload piano samples in background (reduces latency on first play)
  setupPianoPreload({ delay: 300 });

  // Idle caret flash on grid editor container
  initIdleCaretFlash({ targets: [gridEditorContainer] });
}

// ========== CLEANUP ==========

window.addEventListener('beforeunload', () => {
  if (audio) {
    audio.stop();
  }

  if (musicalGrid) {
    musicalGrid.destroy?.();
  }

  if (gridEditor) {
    gridEditor.destroy?.();
  }
});

// Start initialization
init().catch(err => {
  console.error('Failed to initialize App25:', err);
});
