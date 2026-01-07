// App25: Melodias con Escalas - Scale-based melodic sequencer
// Uses scale degrees (0-6) with optional chromatic modifiers (+/-)
// One note per pulse, 12 pulses total
// KEY FEATURE: Melody adapts when scale changes (degrees stay, MIDI changes)

import { createMusicalGrid } from '../../libs/musical-grid/index.js';
import { createGridEditor } from '../../libs/matrix-seq/index.js';
import { initMixerMenu, updateMixerChannelLabel } from '../../libs/app-common/mixer-menu.js';
import { initRandomMenu } from '../../libs/random/menu.js';
import { initP1ToggleUI } from '../../libs/shared-ui/sound-dropdown.js';
import { initAudioToggles } from '../../libs/app-common/audio-toggles.js';
import { getMixer, subscribeMixer, setChannelVolume, setChannelMute, setVolume, setMute } from '../../libs/sound/index.js';
import { registerFactoryReset, createPreferenceStorage } from '../../libs/app-common/preferences.js';
import { createMatrixHighlightController } from '../../libs/app-common/matrix-highlight-controller.js';
import { createMelodicAudioInitializer } from '../../libs/app-common/audio-init.js';
import { isPianoLoaded } from '../../libs/sound/piano.js';
import { isViolinLoaded } from '../../libs/sound/violin.js';
import { createScaleSelector } from '../../libs/scale-selector/index.js';
import { degToSemi, scaleSemis, motherScalesData } from '../../libs/scales/index.js';
import { createInfoTooltip } from '../../libs/app-common/info-tooltip.js';

// ========== CONFIGURATION ==========
const TOTAL_PULSES = 13;   // Horizontal: 0-12 (creates 12 spaces)
const TOTAL_NOTES = 13;    // Vertical: 0-12 (one octave + degree 0 of upper octave)
const TOTAL_SPACES = 12;   // Spaces between pulses
const DEFAULT_BPM = 120;

// Scale configuration (from App24)
const APP25_SCALES = [
  { id: 'DIAT', rotation: 0, value: 'DIAT-0', name: 'Major', rootOffset: 0 },
  { id: 'DIAT', rotation: 5, value: 'DIAT-5', name: 'Menor Natural', rootOffset: 3 },
  { id: 'ACUS', rotation: 4, value: 'ACUS-4', name: 'Menor Melodica', rootOffset: 5 },
  { id: 'ARMme', rotation: 0, value: 'ARMme-0', name: 'Menor Harmonica', rootOffset: 0 },
  { id: 'ARMma', rotation: 0, value: 'ARMma-0', name: 'Mayor Harmonica', rootOffset: 0 },
  { id: 'PENT', rotation: 0, value: 'PENT-0', name: 'Pentatonica', rootOffset: 0 },
  { id: 'TON', rotation: 0, value: 'TON-0', name: 'Tonos', rootOffset: 0 },
  { id: 'CROM', rotation: 0, value: 'CROM-0', name: 'Cromatica', rootOffset: 0 },
  { id: 'OCT', rotation: 0, value: 'OCT-0', name: 'Octatonica', rootOffset: 0 },
  { id: 'HEX', rotation: 0, value: 'HEX-0', name: 'Hexatonica', rootOffset: 0 }
];

// ========== STATE ==========
let audio = null;
let musicalGrid = null;
let gridEditor = null;
let scaleSelector = null;
const currentBPM = DEFAULT_BPM;
let isPlaying = false;

// Scale state (format compatible with libs/scales)
let scaleState = {
  id: 'DIAT',
  rot: 0,
  root: 0  // This is the "Nota de Salida" - user-selected transpose
};

// Root offset for rotated modes (to keep degree 0 at the selected output note)
// For example: Menor Natural (rot=5) needs rootOffset=3 to compensate
let currentRootOffset = 0;

// Current scale length (for degree validation)
let currentScaleLength = 7;

// Elements
let playBtn = null;
let resetBtn = null;
let randomBtn = null;
let gridEditorContainer = null;
let scaleSelectorContainer = null;
let gridAreaContainer = null;

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
      audio.setEffectsEnabled(true);
      audio.setCompressorThreshold(-3);
      audio.setLimiterThreshold(-1);
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
 * The user's "Nota de Sortida" (root) does NOT affect visual positions.
 *
 * Example: Major scale always shows degrees at semitones [0,2,4,5,7,9,11,12]
 * regardless of what "Nota de Sortida" is selected.
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
 * Get PLAYBACK scale semitones (for MIDI output)
 *
 * Includes both rootOffset (mode compensation) AND user's root (Nota de Sortida).
 * This determines what actual notes are played.
 */
function getPlaybackScaleSemitones() {
  const effectiveRoot = (scaleState.root + currentRootOffset) % 12;
  const playbackState = { ...scaleState, root: effectiveRoot };

  const sems = scaleSemis(scaleState.id);
  const result = [];
  for (let d = 0; d < sems.length; d++) {
    result.push(degToSemi(playbackState, d));
  }
  return result;
}

/**
 * Convert degree + modifier to VISUAL note index (0-12)
 * Used for positioning cells on the grid - INDEPENDENT of user's transpose.
 * Only applies rootOffset for mode compensation.
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
 * Includes both rootOffset AND user's transpose (Nota de Sortida).
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
 * - Menor Melòdica (rot=4): semitones [9,11,1,2,4,6,7] → wraps at degree 2
 *   - Degrees 0,1,2 in upper octave; degrees 3+ in lower octave
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
  let wasLoading = false;

  // Check if current instrument is loaded
  const currentInstrument = localStorage.getItem('app25:selectedInstrument') || 'piano';
  const isInstrumentLoaded = currentInstrument === 'violin' ? isViolinLoaded() : isPianoLoaded();

  if (!isInstrumentLoaded && playBtn) {
    wasLoading = true;
    playBtn.disabled = true;
    if (playIcon) playIcon.style.opacity = '0.5';
  }

  await initAudio();

  if (wasLoading && playBtn) {
    playBtn.disabled = false;
    if (playIcon) playIcon.style.opacity = '1';
  }

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
  const Tone = window.Tone;

  audio.play(
    TOTAL_SPACES,
    intervalSec,
    new Set(),
    false,
    (step, scheduledTime) => {
      highlightController?.highlightPulse(step);

      const pair = allPairs.find(p => p.pulse === step);
      if (pair && !pair.isRest) {
        const midi = degreeToMidi(pair.degree, pair.modifier);
        const duration = intervalSec * 0.9;
        const when = scheduledTime ?? Tone.now();

        audio.playNote(midi, duration, when);

        // Visual feedback on grid - use VISUAL positioning (not MIDI)
        const noteIndex = degreeToVisualNoteIndex(pair.degree, pair.modifier);
        const cell = musicalGrid.getCellElement(noteIndex, step);
        if (cell) {
          cell.classList.add('playing');
          setTimeout(() => cell.classList.remove('playing'), duration * 1000);
        }
      }
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

  document.querySelectorAll('.musical-cell.playing').forEach(cell => {
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

  if (musicalGrid?.clearIntervalPaths) {
    musicalGrid.clearIntervalPaths();
  }

  if (isPlaying) {
    stopPlayback();
  }

  console.log('Reset to default state');
}

// ========== RANDOM GENERATION ==========

function handleRandom() {
  if (isPlaying) return;

  const randDensity = parseInt(document.getElementById('randDensity')?.value || 8, 10);

  // Generate random pairs based on density
  const numPairs = Math.max(1, Math.min(randDensity, TOTAL_SPACES));
  const allPulses = Array.from({ length: TOTAL_SPACES }, (_, i) => i);

  // Shuffle pulses
  for (let i = allPulses.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allPulses[i], allPulses[j]] = [allPulses[j], allPulses[i]];
  }

  const selectedPulses = allPulses.slice(0, numPairs).sort((a, b) => a - b);

  const pairs = selectedPulses.map(pulse => ({
    degree: Math.floor(Math.random() * currentScaleLength),
    modifier: null,
    pulse: pulse,
    isRest: false
  }));

  gridEditor?.setPairs(pairs);
  syncGridFromDegrees(pairs);

  console.log('Random generation:', { pairs, numPairs, scaleLength: currentScaleLength });
}

// ========== SYNCHRONIZATION ==========

function syncGridFromDegrees(pairs) {
  if (!musicalGrid) return;

  // Clear all active cells and labels
  document.querySelectorAll('.musical-cell.active').forEach(cell => {
    cell.classList.remove('active');
    const label = cell.querySelector('.cell-label');
    if (label) label.remove();
  });

  // Activate cells for each pair
  const validPairs = pairs.filter(p => !p.isRest && p.degree !== null && p.degree !== undefined);

  validPairs.forEach(({ degree, modifier, pulse }) => {
    // Use VISUAL positioning (independent of user's transpose)
    const noteIndex = degreeToVisualNoteIndex(degree, modifier);
    if (noteIndex === null) return;

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
  if (modifier === 'r+') return `${degree}r+`;
  if (modifier === '+') return `${degree}+`;
  if (modifier === '-') return `${degree}-`;
  return `${degree}`;
}

// ========== SCALE CHANGE HANDLERS ==========

function updateGridCellStates() {
  if (!musicalGrid) return;

  // Use BASE scale (no transpose) for VISUAL display
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

  // Use BASE scale (no transpose) for VISUAL display
  const scaleSemitones = getVisualScaleSemitones();

  // Use the API if available
  if (musicalGrid.updateSoundlineLabels) {
    musicalGrid.updateSoundlineLabels(scaleSemitones, (noteIndex) => {
      // Note 12 is degree 0 of upper octave
      if (noteIndex === 12) {
        return '0';
      }
      const degreeIndex = scaleSemitones.indexOf(noteIndex);
      return degreeIndex !== -1 ? String(degreeIndex) : '·';
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

  // Get current pairs and adapt them to new scale
  if (gridEditor) {
    const currentPairs = gridEditor.getPairs();

    // Adapt pairs to new scale length
    const adaptedPairs = currentPairs.map(pair => {
      if (pair.isRest) return pair;

      // Handle 0r+ (upper octave) - stays as 0r+
      if (pair.degree === 0 && pair.modifier === 'r+') {
        return pair;
      }

      // If degree is valid for new scale, keep it
      if (pair.degree < currentScaleLength) {
        return pair;
      }

      // If degree equals new scale length, it becomes 0r+ (upper octave)
      // Example: degree 5 in 6-note scale → 0r+ in 5-note scale
      if (pair.degree === currentScaleLength) {
        return {
          ...pair,
          degree: 0,
          modifier: 'r+'
        };
      }

      // If degree exceeds new scale, wrap it around
      return {
        ...pair,
        degree: pair.degree % currentScaleLength
      };
    });

    // Update grid editor with adapted pairs
    gridEditor.setPairs(adaptedPairs);

    // Re-sync visual grid with new MIDI positions
    syncGridFromDegrees(adaptedPairs);
  }

  console.log('Scale changed (parallel):', {
    scaleId, rotation,
    root: scaleState.root,
    oldScaleLength,
    newScaleLength: currentScaleLength
  });
}

/**
 * Handle transpose change - updates root/output note
 *
 * FIXED VISUAL MODE: Visual positions do NOT change when transpose changes.
 * - Degree 0 is ALWAYS at soundline position 0 (bottom)
 * - Only the MIDI notes played change based on root
 */
function handleTransposeChange(transpose) {
  scaleState.root = transpose;

  // NO visual updates needed - visual display is FIXED
  // Only MIDI playback is affected via degreeToMidi()

  console.log('Transpose changed:', transpose, '(visual unchanged, only MIDI output affected)');
}

// ========== DOM INJECTION ==========

function injectLayout() {
  const appRoot = document.getElementById('app-root');
  const mainElement = appRoot?.querySelector('main');

  if (!mainElement) return null;

  // Main grid container
  const gridWrapper = document.createElement('div');
  gridWrapper.className = 'app25-main-grid';

  // Left column: Scale selector
  scaleSelectorContainer = document.createElement('div');
  scaleSelectorContainer.className = 'app25-scale-selector';
  gridWrapper.appendChild(scaleSelectorContainer);

  // Right column: Grid area (editor + musical grid)
  gridAreaContainer = document.createElement('div');
  gridAreaContainer.className = 'app25-grid-area';
  gridWrapper.appendChild(gridAreaContainer);

  // Grid editor container (inside grid area)
  gridEditorContainer = document.createElement('div');
  gridEditorContainer.id = 'gridEditorContainer';
  gridAreaContainer.appendChild(gridEditorContainer);

  mainElement.appendChild(gridWrapper);

  return gridWrapper;
}

// ========== INITIALIZATION ==========

async function init() {
  console.log('Initializing App25: Melodias con Escalas...');

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
  scaleSelector = createScaleSelector({
    container: scaleSelectorContainer,
    appId: 'app25',
    scales: APP25_SCALES,
    initialScale: prefs.scaleValue || 'DIAT-0',
    enableTranspose: true,
    transposeHiddenByDefault: false,
    title: 'Escala',
    transposeTitle: 'Nota de Salida',
    selectSize: 3,  // Show only 3 scales, scroll for rest
    onScaleChange: handleScaleChange,
    onTransposeChange: handleTransposeChange
  });

  scaleSelector.render();

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

  // Create musical grid - NO SCROLL, fits all 12 notes
  musicalGrid = createMusicalGrid({
    parent: gridAreaContainer,
    notes: TOTAL_NOTES,
    pulses: TOTAL_PULSES,
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
      // Show degree number if note is in scale, otherwise dot
      // Use BASE scale (no transpose) for VISUAL display
      const scaleSems = getVisualScaleSemitones();
      const degreeIndex = scaleSems.indexOf(noteIndex);
      return degreeIndex !== -1 ? String(degreeIndex) : '·';
    },
    onCellClick: async (noteIndex, pulseIndex, cellElement) => {
      const audioInstance = await initAudio();

      if (!window.Tone || !audioInstance) {
        console.warn('Audio not available');
        return;
      }

      // Use BASE scale (no transpose) for VISUAL click detection
      const scaleSems = getVisualScaleSemitones();

      // Check if note is in scale
      if (!scaleSems.includes(noteIndex)) {
        infoTooltip.show('Usa +/- en grid-editor para notas cromáticas', cellElement);
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

  // Move controls into scale selector area
  const controls = document.querySelector('.controls');
  if (controls && scaleSelectorContainer) {
    controls.remove();

    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'app25-controls-container';
    controlsContainer.appendChild(controls);

    scaleSelectorContainer.appendChild(controlsContainer);
  }

  // Create grid editor with degree mode
  const isMobile = window.innerWidth <= 900;
  gridEditor = createGridEditor({
    container: gridEditorContainer,
    mode: 'degree',
    degreeModeOptions: {
      totalPulses: TOTAL_SPACES,
      getScaleLength: () => currentScaleLength,
      validateDegree: (degree) => degree >= 0 && degree < currentScaleLength
    },
    noteRange: [0, 11],
    pulseRange: [0, TOTAL_SPACES - 1],
    maxPairs: TOTAL_SPACES,
    autoJumpDelayMs: 500,  // Wait 500ms after digit for modifier input
    scrollEnabled: isMobile,
    containerSize: isMobile ? { maxHeight: '100px', width: '100%' } : null,
    columnSize: isMobile ? { width: '50px', minHeight: '80px' } : null,
    onPairsChange: (pairs) => {
      syncGridFromDegrees(pairs);
    }
  });

  // Initialize highlight controller
  highlightController = createMatrixHighlightController({
    musicalGrid,
    gridEditor,
    totalNotes: TOTAL_NOTES,
    currentBPM: currentBPM
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

  // Event listeners
  playBtn?.addEventListener('click', handlePlay);
  resetBtn?.addEventListener('click', handleReset);
  randomBtn?.addEventListener('click', handleRandom);

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
    const instrumentLabel = initialInstrument === 'violin' ? 'Violín' : 'Piano';

    initMixerMenu({
      menu: mixerMenu,
      triggers: [playBtn].filter(Boolean),
      channels: [
        { id: 'pulse', label: 'Pulso', allowSolo: true },
        { id: 'instrument', label: instrumentLabel, allowSolo: true },
        { id: 'master', label: 'Master', allowSolo: false, isMaster: true }
      ]
    });
  }

  // Mixer state persistence
  const MIXER_STORAGE_KEY = 'app25-mixer';
  const MIXER_CHANNELS = ['pulse', 'instrument'];

  function loadMixerState() {
    try {
      const saved = localStorage.getItem(MIXER_STORAGE_KEY);
      if (!saved) return;
      const state = JSON.parse(saved);

      if (state.master) {
        if (typeof state.master.volume === 'number') setVolume(state.master.volume);
        if (typeof state.master.muted === 'boolean') setMute(state.master.muted);
      }

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

  let mixerSaveTimeout = null;
  subscribeMixer((snapshot) => {
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

  setTimeout(loadMixerState, 50);

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
    console.log('Instrument changed to:', instrument);

    await initAudio();
    await audio.setInstrument(instrument);

    // Update mixer channel label to reflect new instrument
    const instrumentLabel = instrument === 'violin' ? 'Violín' : 'Piano';
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

  console.log('App25 initialized successfully');
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
