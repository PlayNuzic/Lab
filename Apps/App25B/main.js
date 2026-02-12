// App25B: Melodías con iSº - Interval-based melodic sequencer
// Uses degree intervals (iSº): +2, -1, 0, +3, etc.
// Base degree is always 0 (implicit starting point)
// One interval per pulse, 12 pulses total
// KEY FEATURES:
// - 2 octaves (25 notes: 0-24) with vertical scroll using musical-grid
// - Autoscroll during playback when octave changes
// - Interval lines with arrows (like App15)
// - Bidirectional: grid clicks update iSº editor

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
import { isPianoLoaded, setupPianoPreload } from '../../libs/sound/piano.js';
import { isViolinLoaded } from '../../libs/sound/violin.js';
import { createScaleSelector } from '../../libs/scale-selector/index.js';
import { degToSemi, scaleSemis, motherScalesData } from '../../libs/scales/index.js';

// ========== CONFIGURATION ==========
const TOTAL_PULSES = 13;   // Horizontal: 0-12 (creates 12 spaces)
const TOTAL_NOTES = 25;    // Vertical: 0-24 (2 octaves real grid)
const VISIBLE_NOTES = 13;  // Visible window: 13 notes, scroll reveals the rest
const TOTAL_SPACES = 12;   // Spaces between pulses
const DEFAULT_BPM = 120;
const BASE_DEGREE = 0;     // Implicit starting degree

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
let scaleSelector = null;
const currentBPM = DEFAULT_BPM;
let isPlaying = false;

// Scale state (format compatible with libs/scales)
let scaleState = {
  id: 'DIAT',
  rot: 0,
  root: 0  // This is the "Nota de Salida" - user-selected transpose
};

// Root offset for rotated modes
let currentRootOffset = 0;

// Current scale length (for degree validation)
let currentScaleLength = 7;

// Current degree intervals (iSº)
let currentDegreeIntervals = [];

// Interval line elements for cleanup
let currentIntervalElements = [];

// Elements
let playBtn = null;
let resetBtn = null;
let randomBtn = null;
let gridEditorContainer = null;
let scaleSelectorContainer = null;
let gridAreaContainer = null;
let nmVisualizerElement = null;

// Highlight controller
let highlightController = null;

// ========== STORAGE HELPERS ==========
const preferenceStorage = createPreferenceStorage('app25b');

function saveCurrentState() {
  // NOTE: App always starts fresh - we don't save intervals or scale state
  // Only instrument preference is saved (handled by audio-init)
}

function loadSavedState() {
  // NOTE: App always starts fresh - we don't load intervals or scale state
  // Only instrument preference is loaded (handled by audio-init)
  return preferenceStorage.load() || {};
}

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

    const p1Stored = localStorage.getItem('app25b:p1Toggle');
    if (audio && p1Stored === 'false' && typeof audio.setStartEnabled === 'function') {
      audio.setStartEnabled(false);
    }
  }
  return audio;
}

// ========== SCALE CONVERSIONS ==========

/**
 * Get VISUAL scale semitones for one octave (0-11) + note 12
 * Returns array of semitone positions that belong to the scale
 */
function getVisualScaleSemitones() {
  const visualState = { id: scaleState.id, rot: scaleState.rot, root: currentRootOffset };
  const sems = scaleSemis(scaleState.id);
  const result = [];

  // First octave (0-11)
  for (let d = 0; d < sems.length; d++) {
    result.push(degToSemi(visualState, d));
  }

  // Second octave (12-23)
  for (let d = 0; d < sems.length; d++) {
    result.push(degToSemi(visualState, d) + 12);
  }

  // Add note 24 (upper registry boundary)
  result.push(24);

  return result;
}

/**
 * Convert absolute degree to visual note index (0-24)
 * Maps degree to semitone position across 2 octaves
 * Note 24 = upper registry boundary
 */
function absoluteDegreeToVisualNoteIndex(absoluteDegree) {
  if (absoluteDegree === null || absoluteDegree === undefined) return null;

  const visualState = { id: scaleState.id, rot: scaleState.rot, root: currentRootOffset };
  const scaleLen = currentScaleLength;

  // Calculate octave and degree within octave
  const octave = Math.floor(absoluteDegree / scaleLen);
  const degreeInOctave = absoluteDegree % scaleLen;

  // Get semitone for this degree within the octave
  const semitone = degToSemi(visualState, degreeInOctave);

  // Map to visual position (0-24 range)
  if (octave === 0) {
    return semitone;
  } else if (octave === 1) {
    return semitone + 12;
  } else {
    // Clamp to note 24 for higher octaves
    return 24;
  }
}

/**
 * Convert visual note index to absolute degree (if on scale)
 */
function visualNoteIndexToAbsoluteDegree(noteIndex) {
  if (noteIndex === null || noteIndex === undefined) return null;

  const visualState = { id: scaleState.id, rot: scaleState.rot, root: currentRootOffset };
  const scaleLen = currentScaleLength;

  // Calculate octave
  const octave = Math.floor(noteIndex / 12);
  const semitoneInOctave = noteIndex % 12;

  // Find degree for this semitone
  for (let d = 0; d < scaleLen; d++) {
    if (degToSemi(visualState, d) === semitoneInOctave) {
      return d + (octave * scaleLen);
    }
  }

  return null; // Not on scale
}

/**
 * Convert absolute degree to MIDI note
 * Handles octave wrapping when root + scale semitone exceeds 11
 */
function absoluteDegreeToMidi(absoluteDegree) {
  if (absoluteDegree === null || absoluteDegree === undefined) return null;

  const effectiveRoot = (scaleState.root + currentRootOffset) % 12;
  const scaleLen = currentScaleLength;

  const octave = Math.floor(absoluteDegree / scaleLen);
  const degreeInOctave = absoluteDegree % scaleLen;

  // Get raw semitone for this degree (without root)
  const rawState = { id: scaleState.id, rot: scaleState.rot, root: 0 };
  const rawSemitone = degToSemi(rawState, degreeInOctave);

  // Calculate actual semitone with root, detecting octave wrap
  const semitoneWithRoot = rawSemitone + effectiveRoot;
  const extraOctave = Math.floor(semitoneWithRoot / 12);
  const finalSemitone = semitoneWithRoot % 12;

  return 60 + finalSemitone + ((octave + extraOctave) * 12);
}

// ========== DEGREE INTERVAL CONVERSION ==========

/**
 * Convert degree intervals to absolute degrees
 * IMPORTANT: intervals array has objects with { pulse, degreeInterval, isRest }
 * The pulse property is the actual pulse index, not the array index!
 */
function degreeIntervalsToAbsoluteDegrees(intervals) {
  const degrees = [];
  let currentDegree = BASE_DEGREE;

  // Sort by pulse to ensure correct order
  const sortedIntervals = [...intervals].sort((a, b) => a.pulse - b.pulse);

  sortedIntervals.forEach((interval) => {
    if (interval.isRest) {
      // Silence: record the pulse but don't change currentDegree
      degrees.push({ degree: null, pulse: interval.pulse, isRest: true });
    } else {
      // Sound: accumulate the interval
      currentDegree += interval.degreeInterval;
      degrees.push({ degree: currentDegree, pulse: interval.pulse, isRest: false });
    }
  });

  return degrees;
}

/**
 * Convert absolute degrees back to intervals
 * IMPORTANT: Silences don't change prevDegree - next note is relative to last sounding note
 * Also fills gaps between notes with explicit silences
 */
function absoluteDegreesToIntervals(absoluteDegrees) {
  const intervals = [];
  let prevDegree = BASE_DEGREE;

  // Sort by pulse to ensure correct order
  const sorted = [...absoluteDegrees].sort((a, b) => a.pulse - b.pulse);

  if (sorted.length === 0) return intervals;

  // Find the range of pulses (from first entry to last entry)
  const firstPulse = sorted[0].pulse;
  const lastPulse = sorted[sorted.length - 1].pulse;

  // Create a map of existing entries by pulse
  const pulseMap = new Map();
  sorted.forEach(entry => pulseMap.set(entry.pulse, entry));

  // Fill all pulses from first to last, creating silences for gaps
  for (let pulse = firstPulse; pulse <= lastPulse; pulse++) {
    const entry = pulseMap.get(pulse);

    if (entry) {
      if (entry.isRest || entry.degree === null) {
        // Explicit silence
        intervals.push({ degreeInterval: null, pulse, isRest: true });
      } else {
        // Sound: calculate interval from previous sounding note
        intervals.push({ degreeInterval: entry.degree - prevDegree, pulse, isRest: false });
        prevDegree = entry.degree;
      }
    } else {
      // Gap - create implicit silence
      intervals.push({ degreeInterval: null, pulse, isRest: true });
    }
  }

  return intervals;
}

// ========== INTERVAL LINE DRAWING ==========

function clearIntervalLines() {
  currentIntervalElements.forEach(el => el.remove());
  currentIntervalElements = [];
}

/**
 * Create interval line between two degrees
 * Uses visual note positions (semitones)
 */
function createDegreeIntervalLine(degree1, degree2, pulseIndex, intervalIndex = 0) {
  if (!musicalGrid) return;

  const matrixContainer = musicalGrid.getMatrixContainer?.();
  if (!matrixContainer) return;

  const degreeInterval = degree2 - degree1;
  const absInterval = Math.abs(degreeInterval);
  const isAscending = degreeInterval > 0;

  // Convert degrees to visual note positions
  const note1 = absoluteDegreeToVisualNoteIndex(degree1);
  const note2 = absoluteDegreeToVisualNoteIndex(degree2);

  if (note1 === null || note2 === null) return;

  // Calculate positions as percentages
  const leftPosPercent = (pulseIndex / TOTAL_SPACES) * 100;

  // Vertical positions (note 0 at bottom, note 24 at top)
  // In musical-grid, row 0 is at bottom
  const cellHeightPercent = 100 / TOTAL_NOTES;

  if (absInterval === 0) {
    // Interval zero: vertical line at the note position
    const noteRow = TOTAL_NOTES - 1 - note2;
    const topEdgePercent = (noteRow / TOTAL_NOTES) * 100;

    const intervalBar = document.createElement('div');
    intervalBar.className = 'interval-bar-vertical interval-zero';
    intervalBar.style.position = 'absolute';
    intervalBar.style.top = `${topEdgePercent}%`;
    intervalBar.style.left = `${leftPosPercent}%`;
    intervalBar.style.transform = 'translateX(-50%)';
    intervalBar.style.width = '4px';
    intervalBar.style.height = `${cellHeightPercent}%`;
    intervalBar.style.zIndex = '15';

    matrixContainer.appendChild(intervalBar);
    currentIntervalElements.push(intervalBar);

    // Number "0" above the bar
    const intervalNum = document.createElement('div');
    intervalNum.className = 'interval-number';
    intervalNum.textContent = '0';
    intervalNum.style.position = 'absolute';
    intervalNum.style.zIndex = '16';
    intervalNum.style.top = `${topEdgePercent}%`;
    intervalNum.style.left = `${leftPosPercent}%`;
    intervalNum.style.transform = 'translate(-50%, -100%)';

    matrixContainer.appendChild(intervalNum);
    currentIntervalElements.push(intervalNum);
    return;
  }

  // Calculate row indices (note 0 at bottom = row TOTAL_NOTES-1)
  const rowIndex1 = TOTAL_NOTES - 1 - note1;
  const rowIndex2 = TOTAL_NOTES - 1 - note2;

  // Calculate vertical positions
  let topEdgePercent, bottomEdgePercent;

  if (isAscending) {
    // Ascending: from origin (lower) to destination (higher)
    topEdgePercent = (rowIndex2 / TOTAL_NOTES) * 100;
    bottomEdgePercent = ((rowIndex1 + 1) / TOTAL_NOTES) * 100;
  } else {
    // Descending: from origin (higher) to destination (lower)
    topEdgePercent = (rowIndex1 / TOTAL_NOTES) * 100;
    bottomEdgePercent = ((rowIndex2 + 1) / TOTAL_NOTES) * 100;
  }

  const heightPercent = Math.abs(bottomEdgePercent - topEdgePercent);

  const intervalBar = document.createElement('div');
  intervalBar.className = 'interval-bar-vertical';
  intervalBar.classList.add(isAscending ? 'ascending' : 'descending');
  intervalBar.style.position = 'absolute';
  intervalBar.style.left = `${leftPosPercent}%`;
  intervalBar.style.transform = 'translateX(-50%)';
  intervalBar.style.width = '4px';
  intervalBar.style.top = `${Math.min(topEdgePercent, bottomEdgePercent)}%`;
  intervalBar.style.height = `${heightPercent}%`;
  intervalBar.style.zIndex = '15';

  matrixContainer.appendChild(intervalBar);
  currentIntervalElements.push(intervalBar);

  // Create interval number label
  const displayValue = degreeInterval > 0 ? `+${absInterval}` : `-${absInterval}`;
  const centerYPercent = (topEdgePercent + bottomEdgePercent) / 2;

  const intervalNum = document.createElement('div');
  intervalNum.className = 'interval-number';
  intervalNum.textContent = displayValue;
  intervalNum.style.position = 'absolute';
  intervalNum.style.zIndex = '16';

  // Position: first interval always right, then alternating based on direction
  const isFirstInterval = intervalIndex === 0;

  if (absInterval <= 1 || isFirstInterval) {
    // Small intervals or first interval: number to the right
    intervalNum.style.top = `${centerYPercent}%`;
    intervalNum.style.left = `calc(${leftPosPercent}% + 12px)`;
    intervalNum.style.transform = 'translateY(-50%)';
  } else if (isAscending) {
    // Ascending: number to the left
    intervalNum.style.top = `${centerYPercent}%`;
    intervalNum.style.left = `calc(${leftPosPercent}% - 12px)`;
    intervalNum.style.transform = 'translate(-100%, -50%)';
  } else {
    // Descending: number to the right
    intervalNum.style.top = `${centerYPercent}%`;
    intervalNum.style.left = `calc(${leftPosPercent}% + 12px)`;
    intervalNum.style.transform = 'translateY(-50%)';
  }

  matrixContainer.appendChild(intervalNum);
  currentIntervalElements.push(intervalNum);
}

// ========== SYNCHRONIZATION ==========

function syncGridFromDegreeIntervals(absoluteDegrees) {
  if (!musicalGrid) return;

  // Clear previous state
  clearIntervalLines();
  musicalGrid.clear();

  // Clear any existing labels
  document.querySelectorAll('.musical-cell .cell-label').forEach(el => el.remove());

  // Activate cells for each valid degree
  const validDegrees = absoluteDegrees.filter(d => !d.isRest && d.degree !== null);

  validDegrees.forEach(({ degree, pulse }) => {
    const noteIndex = absoluteDegreeToVisualNoteIndex(degree);
    if (noteIndex === null || noteIndex < 0 || noteIndex >= TOTAL_NOTES) return;

    const cell = musicalGrid.getCellElement(noteIndex, pulse);
    if (cell) {
      cell.classList.add('active');

      // Add degree label (show degree within octave, same as soundline)
      const degreeInOctave = degree % currentScaleLength;
      const label = document.createElement('span');
      label.className = 'cell-label';
      label.textContent = String(degreeInOctave);
      cell.appendChild(label);
    }
  });

  // Draw interval lines
  let prevDegree = BASE_DEGREE;
  validDegrees.forEach(({ degree, pulse }, idx) => {
    createDegreeIntervalLine(prevDegree, degree, pulse, idx);
    prevDegree = degree;
  });
}

// ========== BIDIRECTIONAL: Grid2D -> iSº Editor ==========

/**
 * Handle click on grid cell - update the iSº editor row
 */
function handleGridCellClick(noteIndex, pulseIndex) {
  if (!gridEditor) return;

  // Convert click position to absolute degree
  const clickedDegree = visualNoteIndexToAbsoluteDegree(noteIndex);
  if (clickedDegree === null) return; // Not on scale

  // Get current intervals
  const currentIntervals = gridEditor.getPairs ? gridEditor.getPairs() : currentDegreeIntervals;

  // Build new intervals array
  const absoluteDegrees = degreeIntervalsToAbsoluteDegrees(currentIntervals);

  // Check if we're toggling off an existing note
  const existingIdx = absoluteDegrees.findIndex(d => d.pulse === pulseIndex && !d.isRest);

  if (existingIdx !== -1) {
    const existing = absoluteDegrees[existingIdx];
    const existingNoteIndex = absoluteDegreeToVisualNoteIndex(existing.degree);
    if (existingNoteIndex === noteIndex) {
      // Toggle off - remove this note
      absoluteDegrees[existingIdx] = { degree: null, pulse: pulseIndex, isRest: true };
    } else {
      // Replace with new note
      absoluteDegrees[existingIdx] = { degree: clickedDegree, pulse: pulseIndex, isRest: false };
    }
  } else {
    // Find or create entry for this pulse
    const pulseIdx = absoluteDegrees.findIndex(d => d.pulse === pulseIndex);
    if (pulseIdx !== -1) {
      absoluteDegrees[pulseIdx] = { degree: clickedDegree, pulse: pulseIndex, isRest: false };
    } else {
      absoluteDegrees.push({ degree: clickedDegree, pulse: pulseIndex, isRest: false });
      absoluteDegrees.sort((a, b) => a.pulse - b.pulse);
    }
  }

  // Convert back to intervals
  const newIntervals = absoluteDegreesToIntervals(absoluteDegrees);
  currentDegreeIntervals = newIntervals;

  // Update editor
  gridEditor.setPairs(newIntervals);

  // Re-sync grid
  syncGridFromDegreeIntervals(absoluteDegrees);

  saveCurrentState();
}

// ========== Nm VISUALIZER ==========

function createNmVisualizer(gridContainer) {
  const children = gridContainer.children;
  let spacer = null;

  for (const child of children) {
    if (child.style.gridRow === '2' && child.style.gridColumn === '1') {
      spacer = child;
      break;
    }
  }

  if (!spacer) {
    console.warn('Nm visualizer: spacer element not found');
    return null;
  }

  const visualizer = document.createElement('div');
  visualizer.className = 'nm-visualizer';
  visualizer.innerHTML = `<span class="nm-label">Nm(</span><span class="nm-value">${scaleState.root}</span><span class="nm-label">)</span>`;

  spacer.appendChild(visualizer);
  nmVisualizerElement = visualizer;

  return visualizer;
}

function updateNmVisualizer(newValue) {
  if (!nmVisualizerElement) return;

  const valueSpan = nmVisualizerElement.querySelector('.nm-value');
  if (valueSpan) {
    valueSpan.textContent = newValue;
  }

  nmVisualizerElement.classList.remove('flash');
  void nmVisualizerElement.offsetWidth;
  nmVisualizerElement.classList.add('flash');
}

// ========== PLAYBACK ==========

async function handlePlay() {
  if (isPlaying) {
    stopPlayback();
    return;
  }

  const playIcon = playBtn?.querySelector('.icon-play');
  const stopIcon = playBtn?.querySelector('.icon-stop');
  let wasLoading = false;

  const currentInstrument = localStorage.getItem('app25b:selectedInstrument') || 'piano';
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

  // Get absolute degrees from intervals
  const absoluteDegrees = degreeIntervalsToAbsoluteDegrees(currentDegreeIntervals);

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

      const degreeData = absoluteDegrees.find(d => d.pulse === step);
      if (degreeData && !degreeData.isRest && degreeData.degree !== null) {
        const midi = absoluteDegreeToMidi(degreeData.degree);
        const duration = intervalSec * 0.9;
        const when = scheduledTime ?? Tone.now();

        audio.playNote(midi, duration, when);

        // Visual feedback
        const noteIndex = absoluteDegreeToVisualNoteIndex(degreeData.degree);
        const cell = musicalGrid?.getCellElement?.(noteIndex, step);
        if (cell) {
          cell.classList.add('playing');
          setTimeout(() => cell.classList.remove('playing'), duration * 1000);
        }
      }

      // Anticipate scroll: look ahead to next note and scroll early
      const nextStep = step + 1;
      const nextDegreeData = absoluteDegrees.find(d => d.pulse === nextStep && !d.isRest && d.degree !== null);
      if (nextDegreeData) {
        const nextNoteIndex = absoluteDegreeToVisualNoteIndex(nextDegreeData.degree);
        scrollToNoteIfNeeded(nextNoteIndex);
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


/**
 * Scroll to keep a note visible (autoscroll during playback)
 * Only scrolls the matrix - soundline sync is handled by musical-grid's setupScrollSync()
 */
function scrollToNoteIfNeeded(noteIndex) {
  if (noteIndex === null || noteIndex === undefined) return;

  const gridContainer = document.querySelector('.app25-grid-area .grid-container');
  if (!gridContainer) return;

  const matrixContainer = gridContainer.querySelector('.matrix-container');

  if (!matrixContainer) return;
  if (matrixContainer.scrollHeight <= matrixContainer.clientHeight) return;

  // Calculate target scroll position to center the note
  const cellHeight = matrixContainer.scrollHeight / TOTAL_NOTES;
  const rowIndex = TOTAL_NOTES - 1 - noteIndex;  // Invert: note 0 is at bottom
  const visibleHeight = matrixContainer.clientHeight;
  const targetScroll = (rowIndex * cellHeight) - (visibleHeight / 2) + (cellHeight / 2);

  const maxScroll = matrixContainer.scrollHeight - visibleHeight;
  const clampedScroll = Math.max(0, Math.min(targetScroll, maxScroll));

  // Scroll matrix only - soundline sync is automatic via setupScrollSync()
  // Use 'smooth' for small jumps, 'auto' for large jumps (faster response)
  const currentScroll = matrixContainer.scrollTop;
  const scrollDistance = Math.abs(clampedScroll - currentScroll);
  const threshold = visibleHeight * 0.5;  // Half visible height
  const behavior = scrollDistance > threshold ? 'auto' : 'smooth';
  matrixContainer.scrollTo({ top: clampedScroll, behavior });
}

// ========== RESET ==========

function handleReset() {
  if (isPlaying) {
    stopPlayback();
  }

  gridEditor?.clear();
  clearIntervalLines();
  musicalGrid?.clear();

  currentDegreeIntervals = [];

  // Clear saved intervals from localStorage (keep other prefs like instrument)
  const prefs = preferenceStorage.load() || {};
  delete prefs.intervals;
  preferenceStorage.save(prefs);

  console.log('Reset to default state');
}

// ========== RANDOM GENERATION ==========

function handleRandom() {
  if (isPlaying) return;

  // 1. Randomize scale
  const randomScaleIndex = Math.floor(Math.random() * APP25_SCALES.length);
  const randomScale = APP25_SCALES[randomScaleIndex];
  scaleSelector?.setScale(randomScale.value);

  // 2. Randomize transpose (nota de salida: 0-11)
  const randomTranspose = Math.floor(Math.random() * 12);
  scaleSelector?.setTranspose(randomTranspose);

  // 3. Randomize sequence of INTERVALS (iSº)
  const randDensity = parseInt(document.getElementById('randDensity')?.value || 8, 10);
  const newScaleLength = motherScalesData[randomScale.id]?.ee?.length || 7;
  const numIntervals = Math.max(1, Math.min(randDensity, TOTAL_SPACES));

  // Max absolute degree: 2 octaves worth of scale degrees
  const maxAbsoluteDegree = newScaleLength * 2 - 1;

  let accumulatedDegree = BASE_DEGREE;
  const intervals = [];

  for (let pulse = 0; pulse < TOTAL_SPACES; pulse++) {
    if (pulse < numIntervals) {
      // Calculate valid range for this interval
      const minAllowed = -accumulatedDegree; // Can't go below 0
      const maxAllowed = maxAbsoluteDegree - accumulatedDegree; // Can't exceed 2 octaves

      // Limit interval size to scale length (reasonable melodic leaps)
      const maxInterval = newScaleLength - 1;
      const minInterval = Math.max(-maxInterval, minAllowed);
      const maxIntervalClamped = Math.min(maxInterval, maxAllowed);

      let randomInterval;
      if (minInterval <= maxIntervalClamped) {
        randomInterval = Math.floor(Math.random() * (maxIntervalClamped - minInterval + 1)) + minInterval;
      } else {
        randomInterval = 0;
      }

      intervals.push({
        degreeInterval: randomInterval,
        pulse,
        isRest: false
      });
      accumulatedDegree += randomInterval;
    } else {
      intervals.push({
        degreeInterval: 0,
        pulse,
        isRest: true
      });
    }
  }

  currentDegreeIntervals = intervals;
  gridEditor?.setPairs(intervals);

  const absoluteDegrees = degreeIntervalsToAbsoluteDegrees(intervals);
  syncGridFromDegreeIntervals(absoluteDegrees);

  saveCurrentState();

  console.log('Random generation:', {
    scale: randomScale.name,
    transpose: randomTranspose,
    intervals,
    numIntervals,
    scaleLength: newScaleLength
  });
}

// ========== SCALE CHANGE HANDLERS ==========

function updateGridCellStates() {
  if (!musicalGrid) return;

  const scaleSemitones = getVisualScaleSemitones();

  if (musicalGrid.setEnabledNotes) {
    musicalGrid.setEnabledNotes(scaleSemitones);
  }

  updateSoundlineLabels();
}

function updateSoundlineLabels() {
  if (!musicalGrid) return;

  const scaleSemitones = getVisualScaleSemitones();

  if (musicalGrid.updateSoundlineLabels) {
    musicalGrid.updateSoundlineLabels(scaleSemitones, (noteIndex) => {
      // Note 24 is upper boundary - no label needed
      if (noteIndex === 24) {
        return '';
      }

      // Get semitone within octave (0-11)
      // Note 12 has semitoneInOctave = 0, which correctly shows "0" for second registry
      const semitoneInOctave = noteIndex % 12;
      const visualState = { id: scaleState.id, rot: scaleState.rot, root: currentRootOffset };

      // Find which degree this semitone corresponds to (0-6 for major)
      for (let d = 0; d < currentScaleLength; d++) {
        if (degToSemi(visualState, d) === semitoneInOctave) {
          return String(d);  // Show degree within octave, not absolute
        }
      }
      return '·';
    });
  }
}

function handleScaleChange({ scaleId, rotation, value }) {
  scaleState.id = scaleId;
  scaleState.rot = rotation;

  const scaleConfig = APP25_SCALES.find(s => s.value === value);
  currentRootOffset = scaleConfig?.rootOffset || 0;
  currentScaleLength = motherScalesData[scaleId]?.ee?.length || 7;

  updateGridCellStates();

  // Re-sync visual grid with current intervals
  const absoluteDegrees = degreeIntervalsToAbsoluteDegrees(currentDegreeIntervals);
  syncGridFromDegreeIntervals(absoluteDegrees);

  console.log('Scale changed:', { scaleId, rotation, scaleLength: currentScaleLength });
}

function handleTransposeChange(transpose) {
  scaleState.root = transpose;
  updateNmVisualizer(transpose);
  console.log('Transpose changed:', transpose);
}

// ========== DOM INJECTION ==========

function injectLayout() {
  const appRoot = document.getElementById('app-root');
  const mainElement = appRoot?.querySelector('main');

  if (!mainElement) return null;

  const gridWrapper = document.createElement('div');
  gridWrapper.className = 'app25-main-grid';

  // Left column: Scale selector
  scaleSelectorContainer = document.createElement('div');
  scaleSelectorContainer.className = 'app25-scale-selector';
  gridWrapper.appendChild(scaleSelectorContainer);

  // Right column: Grid area
  gridAreaContainer = document.createElement('div');
  gridAreaContainer.className = 'app25-grid-area';
  gridWrapper.appendChild(gridAreaContainer);

  // Grid editor container
  gridEditorContainer = document.createElement('div');
  gridEditorContainer.id = 'gridEditorContainer';
  gridAreaContainer.appendChild(gridEditorContainer);

  mainElement.appendChild(gridWrapper);

  return gridWrapper;
}

// ========== INITIALIZATION ==========

async function init() {
  console.log('Initializing App25B: Melodías con iSº...');

  const gridWrapper = injectLayout();
  if (!gridWrapper) {
    console.error('Failed to create layout');
    return;
  }

  const prefs = loadSavedState();

  // Initialize scale selector
  scaleSelector = createScaleSelector({
    container: scaleSelectorContainer,
    appId: 'app25b',
    scales: APP25_SCALES,
    initialScale: prefs.scaleValue || 'DIAT-0',
    enableTranspose: true,
    transposeHiddenByDefault: false,
    title: 'Escala',
    transposeTitle: 'Nota de Salida',
    selectSize: 3,
    onScaleChange: handleScaleChange,
    onTransposeChange: handleTransposeChange
  });

  scaleSelector.render();

  // Set initial scale state
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

  // Create musical grid with scroll enabled for fixed cell heights
  // We'll use CSS to make timeline responsive while keeping vertical scroll
  musicalGrid = createMusicalGrid({
    parent: gridAreaContainer,
    notes: TOTAL_NOTES,
    pulses: TOTAL_PULSES,
    startMidi: 60,
    fillSpaces: true,
    cellClassName: 'musical-cell',
    activeClassName: 'active',
    highlightClassName: 'highlight',
    scrollEnabled: true,
    cellSize: { minHeight: 28 },  // Fixed height for vertical scroll
    showIntervals: {
      horizontal: true,
      vertical: false
    },
    intervalColor: '#4A9EFF',  // Blue for timeline numbers (iSº arrows use separate pink)
    noteFormatter: (noteIndex) => {
      // Note 24 is upper boundary - no label needed
      if (noteIndex === 24) {
        return '';
      }

      // Get semitone within octave (0-11)
      // Note 12 has semitoneInOctave = 0, which correctly shows "0" for second registry
      const semitoneInOctave = noteIndex % 12;
      const visualState = { id: scaleState.id, rot: scaleState.rot, root: currentRootOffset };

      // Find which degree this semitone corresponds to (0-6 for major)
      for (let d = 0; d < currentScaleLength; d++) {
        if (degToSemi(visualState, d) === semitoneInOctave) {
          return String(d);  // Show degree within octave, not absolute
        }
      }
      return '·';
    },
    onCellClick: async (noteIndex, pulseIndex, cellElement) => {
      const audioInstance = await initAudio();

      if (!window.Tone || !audioInstance) {
        console.warn('Audio not available');
        return;
      }

      const scaleSems = getVisualScaleSemitones();

      if (!scaleSems.includes(noteIndex)) {
        return; // Ignore clicks on non-scale notes
      }

      // Play the note (using transpose from Nota de Salida)
      const absoluteDegree = visualNoteIndexToAbsoluteDegree(noteIndex);
      const midi = absoluteDegreeToMidi(absoluteDegree);
      if (midi === null) return;

      const duration = (60 / currentBPM) * 0.9;
      const Tone = window.Tone;
      audioInstance.playNote(midi, duration, Tone.now());

      // Update grid bidirectionally
      handleGridCellClick(noteIndex, pulseIndex);
    }
  });

  // Initial cell states
  updateGridCellStates();

  // Create Nm(X) visualizer
  const gridContainer = gridAreaContainer.querySelector('.grid-container');
  if (gridContainer) {
    createNmVisualizer(gridContainer);
  }

  // Note: Vertical scroll sync is handled by musical-grid's setupScrollSync()

  // Move controls into scale selector area
  const controls = document.querySelector('.controls');
  if (controls && scaleSelectorContainer) {
    controls.remove();

    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'app25-controls-container';
    controlsContainer.appendChild(controls);

    scaleSelectorContainer.appendChild(controlsContainer);
  }

  // Create grid editor with degree-interval mode
  const isMobile = window.innerWidth <= 900;
  gridEditor = createGridEditor({
    container: gridEditorContainer,
    mode: 'degree-interval',
    degreeIntervalModeOptions: {
      baseDegree: BASE_DEGREE,
      getScaleLength: () => currentScaleLength,
      totalPulses: TOTAL_SPACES,
      maxAbsoluteDegree: () => currentScaleLength * 2 - 1
    },
    noteRange: [0, 11],
    pulseRange: [0, TOTAL_SPACES - 1],
    maxPairs: TOTAL_SPACES,
    autoJumpDelayMs: 500,
    scrollEnabled: isMobile,
    containerSize: isMobile ? { maxHeight: '100px', width: '100%' } : null,
    columnSize: isMobile ? { width: '50px', minHeight: '80px' } : null,
    onPairsChange: (pairs) => {
      currentDegreeIntervals = pairs;
      const absoluteDegrees = degreeIntervalsToAbsoluteDegrees(pairs);
      syncGridFromDegreeIntervals(absoluteDegrees);
      saveCurrentState();
    }
  });

  // NOTE: App always starts empty - no saved intervals loaded

  // Initialize highlight controller
  highlightController = createMatrixHighlightController({
    musicalGrid,
    gridEditor,
    totalNotes: TOTAL_NOTES,
    currentBPM: currentBPM
  });

  // Preload audio on first interaction
  let audioPreloadStarted = false;
  const preloadAudioOnFirstInteraction = async () => {
    if (audioPreloadStarted) return;
    audioPreloadStarted = true;
    document.removeEventListener('click', preloadAudioOnFirstInteraction, { capture: true });
    document.removeEventListener('touchstart', preloadAudioOnFirstInteraction, { capture: true });
    document.removeEventListener('keydown', preloadAudioOnFirstInteraction, { capture: true });
    await initAudio();
  };
  document.addEventListener('click', preloadAudioOnFirstInteraction, { capture: true, once: true });
  document.addEventListener('touchstart', preloadAudioOnFirstInteraction, { capture: true, once: true });
  document.addEventListener('keydown', preloadAudioOnFirstInteraction, { capture: true, once: true });

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
      storageKey: 'app25b:p1Toggle',
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
    const initialInstrument = localStorage.getItem('app25b:selectedInstrument') || 'piano';
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
  const MIXER_STORAGE_KEY = 'app25b-mixer';
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
          storageKey: 'app25b:pulseAudio',
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

      localStorage.removeItem('app25b:p1Toggle');
      localStorage.removeItem('app25b:pulseAudio');
      localStorage.removeItem('app25b-mixer');

      const randDensity = document.getElementById('randDensity');
      if (randDensity) randDensity.value = '8';
    }
  });

  // Preload piano samples
  setupPianoPreload({ delay: 300 });

  console.log('App25B initialized successfully');
}

// ========== CLEANUP ==========

window.addEventListener('beforeunload', () => {
  if (audio) audio.stop();
  if (musicalGrid) musicalGrid.destroy?.();
  if (gridEditor) gridEditor.destroy?.();
});

// Start initialization
init().catch(err => {
  console.error('Failed to initialize App25B:', err);
});
