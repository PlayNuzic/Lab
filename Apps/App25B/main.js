// App25B: Melodías con iSº - Interval-based melodic sequencer
// Uses degree intervals (iSº): +2, -1, 0, +3, etc.
// Base degree is always 0 (implicit starting point)
// One interval per pulse, 12 pulses total
// KEY FEATURES:
// - 2 registries with vertical scroll (like App19)
// - Autoscroll during playback when registry changes
// - Interval lines with arrows (like App15)

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
import { createInfoTooltip } from '../../libs/app-common/info-tooltip.js';

// ========== CONFIGURATION ==========
const TOTAL_PULSES = 13;   // Horizontal: 0-12 (creates 12 spaces)
const NOTES_PER_REGISTRY = 13;  // Vertical: 0-12 per registry (one octave + degree 0)
const NUM_REGISTRIES = 2;  // 2 registries for vertical scroll
const TOTAL_NOTES = NOTES_PER_REGISTRY * NUM_REGISTRIES - 1;  // 25 notes total (shared note 0/12)
const VISIBLE_NOTES = 13;  // Only show 13 notes at a time (1 registry)
const TOTAL_SPACES = 12;   // Spaces between pulses
const DEFAULT_BPM = 120;
const BASE_DEGREE = 0;     // Implicit starting degree

// Scale configuration (from App24)
const APP25_SCALES = [
  { id: 'DIAT', rotation: 0, value: 'DIAT-0', name: 'Mayor', rootOffset: 0 },
  { id: 'DIAT', rotation: 5, value: 'DIAT-5', name: 'Menor Natural', rootOffset: 3 },
  { id: 'ACUS', rotation: 4, value: 'ACUS-4', name: 'Menor Melódica', rootOffset: 5 },
  { id: 'ARMme', rotation: 0, value: 'ARMme-0', name: 'Menor Armónica', rootOffset: 0 },
  { id: 'ARMma', rotation: 0, value: 'ARMma-0', name: 'Mayor Armónica', rootOffset: 0 },
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

// Root offset for rotated modes (to keep degree 0 at the selected output note)
// For example: Menor Natural (rot=5) needs rootOffset=3 to compensate
let currentRootOffset = 0;

// Current scale length (for degree validation)
let currentScaleLength = 7;

// Current degree intervals (iSº)
let currentDegreeIntervals = [];

// Current registry for scroll
let currentRegistry = 1;

// Pulse to registry map for autoscroll
let pulseRegistryMap = {};

// Elements
let playBtn = null;
let resetBtn = null;
let randomBtn = null;
let gridEditorContainer = null;
let scaleSelectorContainer = null;
let gridAreaContainer = null;
let nmVisualizerElement = null;

// ========== STORAGE HELPERS ==========
const preferenceStorage = createPreferenceStorage('app25b');

/**
 * Save current state (intervals) to localStorage
 */
function saveCurrentState() {
  const prefs = preferenceStorage.load() || {};
  prefs.intervals = currentDegreeIntervals;
  prefs.scaleState = scaleState;
  preferenceStorage.save(prefs);
}

/**
 * Load saved state from localStorage
 */
function loadSavedState() {
  const prefs = preferenceStorage.load() || {};
  if (prefs.intervals && Array.isArray(prefs.intervals)) {
    currentDegreeIntervals = prefs.intervals;
    return prefs.intervals;
  }
  return [];
}

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

    const p1Stored = localStorage.getItem('app25b:p1Toggle');
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

// ========== INTERVAL CONVERSIONS (iSº) ==========

/**
 * Convert degree intervals to absolute degrees
 * Starting from BASE_DEGREE (0), accumulates intervals
 *
 * @param {Array} intervals - Array of {degreeInterval, isRest}
 * @param {number} baseDegree - Starting degree (default 0)
 * @returns {Array} Array of {degree, pulse, isRest}
 */
function degreeIntervalsToAbsoluteDegrees(intervals, baseDegree = BASE_DEGREE) {
  const degrees = [];
  let currentDegree = baseDegree;

  intervals.forEach((interval, pulse) => {
    if (interval.isRest) {
      degrees.push({ degree: null, pulse, isRest: true });
    } else {
      currentDegree += interval.degreeInterval;
      degrees.push({ degree: currentDegree, pulse, isRest: false });
    }
  });

  return degrees;
}

/**
 * Convert absolute degree to registry and degree within registry
 * Degrees >= scaleLength go to registry 2
 *
 * @param {number} absoluteDegree - The absolute degree (can exceed scaleLength)
 * @param {number} scaleLength - Current scale length
 * @returns {{registry: number, degreeInRegistry: number}|null}
 */
function degreeToRegistryAndNote(absoluteDegree, scaleLength) {
  if (absoluteDegree === null || absoluteDegree === undefined) return null;

  if (absoluteDegree < 0) {
    // Negative degrees not supported
    return null;
  }

  const registry = Math.floor(absoluteDegree / scaleLength) + 1;
  const degreeInRegistry = absoluteDegree % scaleLength;

  return { registry, degreeInRegistry };
}

/**
 * Convert absolute degree to VISUAL note index considering registry
 * Uses degToSemi() to get semitone position
 *
 * @param {number} absoluteDegree - The absolute degree
 * @param {number} scaleLength - Current scale length
 * @returns {{noteIndex: number, registry: number}|null}
 */
function absoluteDegreeToVisual(absoluteDegree, scaleLength) {
  if (absoluteDegree === null || absoluteDegree === undefined) return null;

  const regInfo = degreeToRegistryAndNote(absoluteDegree, scaleLength);
  if (!regInfo) return null;

  const { registry, degreeInRegistry } = regInfo;

  // Get visual position using degToSemi (this applies scale structure)
  const visualState = { id: scaleState.id, rot: scaleState.rot, root: currentRootOffset };
  const semitone = degToSemi(visualState, degreeInRegistry);

  return { noteIndex: semitone, registry };
}

/**
 * Convert absolute degree to MIDI note for playback
 * Includes registry offset (12 semitones per octave)
 *
 * @param {number} absoluteDegree - The absolute degree
 * @returns {number|null} MIDI note number
 */
function absoluteDegreeToMidi(absoluteDegree) {
  if (absoluteDegree === null || absoluteDegree === undefined) return null;

  const regInfo = degreeToRegistryAndNote(absoluteDegree, currentScaleLength);
  if (!regInfo) return null;

  const { registry, degreeInRegistry } = regInfo;

  // Get MIDI for the degree within registry
  const baseMidi = degreeToMidi(degreeInRegistry, null);
  if (baseMidi === null) return null;

  // Add octave offset for higher registries
  const registryOffset = (registry - 1) * 12;

  return baseMidi + registryOffset;
}

/**
 * Build pulse to registry map for autoscroll
 * Maps each pulse to the registry needed to display its note
 *
 * @param {Array} absoluteDegrees - Array of {degree, pulse, isRest}
 * @param {number} scaleLength - Current scale length
 * @returns {Object} Map of pulse index to registry number
 */
function buildPulseRegistryMap(absoluteDegrees, scaleLength) {
  const map = {};

  absoluteDegrees.forEach(({ degree, pulse, isRest }) => {
    if (isRest || degree === null) return;

    const regInfo = degreeToRegistryAndNote(degree, scaleLength);
    if (regInfo) {
      map[pulse] = regInfo.registry;
    }
  });

  return map;
}

// ========== SCROLL FUNCTIONS ==========

/**
 * Smooth scroll animation using requestAnimationFrame
 * @param {HTMLElement} element - Element to scroll
 * @param {number} target - Target scroll position
 * @param {number} duration - Animation duration in ms
 * @returns {Promise<void>}
 */
function smoothScrollTo(element, target, duration = 200) {
  return new Promise((resolve) => {
    if (!element) {
      resolve();
      return;
    }

    const start = element.scrollTop;
    const distance = target - start;

    if (Math.abs(distance) < 1) {
      resolve();
      return;
    }

    const startTime = performance.now();

    function animate(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic for smooth deceleration
      const easeOut = 1 - Math.pow(1 - progress, 3);

      element.scrollTop = start + (distance * easeOut);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        resolve();
      }
    }

    requestAnimationFrame(animate);
  });
}

/**
 * Scroll to a specific registry
 * Registry 1: note 0 at bottom (scrollTop = max)
 * Registry 2: note 12 at bottom (scrollTop = 0 or middle)
 *
 * @param {number} registryId - 1 or 2
 * @param {boolean} animated - Whether to animate the scroll
 */
function scrollToRegistry(registryId, animated = true) {
  const matrixContainer = musicalGrid?.getMatrixContainer?.();
  const soundlineWrapper = document.querySelector('.soundline-wrapper');

  if (!matrixContainer) return;

  // Calculate cell height (total height / number of notes)
  const matrixInner = matrixContainer.querySelector('.matrix-inner') || matrixContainer;
  const totalHeight = matrixInner.scrollHeight;
  const cellHeight = totalHeight / TOTAL_NOTES;

  // Calculate target scroll position
  // Registry 1: show notes 0-12 (scroll to bottom)
  // Registry 2: show notes 12-24 (scroll to top/middle)
  let targetScrollTop;

  if (registryId === 1) {
    // Scroll to bottom to show registry 1 (notes 0-12)
    targetScrollTop = totalHeight - matrixContainer.clientHeight;
  } else {
    // Scroll to top to show registry 2 (notes 12-24)
    targetScrollTop = 0;
  }

  // Clamp to valid range
  const maxScroll = totalHeight - matrixContainer.clientHeight;
  targetScrollTop = Math.max(0, Math.min(targetScrollTop, maxScroll));

  if (animated) {
    smoothScrollTo(matrixContainer, targetScrollTop);
    if (soundlineWrapper) {
      smoothScrollTo(soundlineWrapper, targetScrollTop);
    }
  } else {
    matrixContainer.scrollTop = targetScrollTop;
    if (soundlineWrapper) {
      soundlineWrapper.scrollTop = targetScrollTop;
    }
  }

  currentRegistry = registryId;
}

/**
 * Get the note index for an absolute degree considering registry
 * This maps degree to visual note position in the 25-note grid
 *
 * @param {number} absoluteDegree - Absolute degree (can exceed scaleLength)
 * @returns {number|null} Note index in the grid (0-24)
 */
function absoluteDegreeToNoteIndex(absoluteDegree) {
  if (absoluteDegree === null || absoluteDegree === undefined) return null;

  const regInfo = degreeToRegistryAndNote(absoluteDegree, currentScaleLength);
  if (!regInfo) return null;

  const { registry, degreeInRegistry } = regInfo;

  // Get semitone for the degree within registry
  const visualState = { id: scaleState.id, rot: scaleState.rot, root: currentRootOffset };
  const semitone = degToSemi(visualState, degreeInRegistry);

  // Calculate note index based on registry
  if (registry === 1) {
    return semitone;
  } else {
    // Registry 2: offset by 12 semitones
    return semitone + 12;
  }
}

// ========== VISUAL FEEDBACK ==========
let highlightController = null;

// ========== Nm VISUALIZER ==========

/**
 * Create Nm(X) visualizer element inside the grid spacer (grid-area: 2/1)
 * @param {HTMLElement} gridContainer - The .grid-container element
 */
function createNmVisualizer(gridContainer) {
  // Find the spacer element (grid-area: 2/1)
  // Structure: soundline-wrapper, matrix-container, spacer (3rd child), timeline-wrapper
  const children = gridContainer.children;
  let spacer = null;

  // Find spacer by checking grid position (it's the only one with gridRow: 2 and gridColumn: 1)
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

  // Create visualizer element
  const visualizer = document.createElement('div');
  visualizer.className = 'nm-visualizer';
  visualizer.innerHTML = `<span class="nm-label">Nm(</span><span class="nm-value">${scaleState.root}</span><span class="nm-label">)</span>`;

  spacer.appendChild(visualizer);
  nmVisualizerElement = visualizer;

  return visualizer;
}

/**
 * Update Nm(X) visualizer value and trigger flash animation
 * @param {number} newValue - New transpose value (0-11)
 */
function updateNmVisualizer(newValue) {
  if (!nmVisualizerElement) return;

  const valueSpan = nmVisualizerElement.querySelector('.nm-value');
  if (valueSpan) {
    valueSpan.textContent = newValue;
  }

  // Trigger flash animation
  nmVisualizerElement.classList.remove('flash');
  // Force reflow to restart animation
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

  // Check if current instrument is loaded
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

  // Get intervals and convert to absolute degrees
  const allIntervals = gridEditor.getPairs();
  const absoluteDegrees = degreeIntervalsToAbsoluteDegrees(allIntervals, BASE_DEGREE);

  // Build registry map for autoscroll
  const playbackRegistryMap = buildPulseRegistryMap(absoluteDegrees, currentScaleLength);

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

      // Find the absolute degree for this step
      const degreeData = absoluteDegrees.find(d => d.pulse === step);
      if (degreeData && !degreeData.isRest && degreeData.degree !== null) {
        // Get MIDI note using the new function
        const midi = absoluteDegreeToMidi(degreeData.degree);
        const duration = intervalSec * 0.9;
        const when = scheduledTime ?? Tone.now();

        if (midi !== null) {
          audio.playNote(midi, duration, when);
        }

        // Visual feedback on grid
        const noteIndex = absoluteDegreeToNoteIndex(degreeData.degree);
        if (noteIndex !== null) {
          const cell = musicalGrid.getCellElement(noteIndex, step);
          if (cell) {
            cell.classList.add('playing');
            setTimeout(() => cell.classList.remove('playing'), duration * 1000);
          }
        }
      }

      // Autoscroll to registry if changed
      if (playbackRegistryMap[step] !== undefined && playbackRegistryMap[step] !== currentRegistry) {
        scrollToRegistry(playbackRegistryMap[step], true);
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

  // Clear interval lines
  clearIntervalLines();

  // Clear degree intervals state
  currentDegreeIntervals = [];
  pulseRegistryMap = {};

  if (isPlaying) {
    stopPlayback();
  }

  // Save empty state
  saveCurrentState();

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

  // Use the NEW scale length after scale change
  const newScaleLength = motherScalesData[randomScale.id]?.ee?.length || 7;
  const numIntervals = Math.max(1, Math.min(randDensity, TOTAL_SPACES));

  // Generate random degree intervals
  // Max interval range: ±(scaleLength - 1) to stay within reasonable bounds
  const maxInterval = newScaleLength - 1;

  // Track accumulated degree to ensure we stay within valid range (0 to 2*scaleLength-1)
  let accumulatedDegree = BASE_DEGREE;
  const intervals = [];

  for (let pulse = 0; pulse < TOTAL_SPACES; pulse++) {
    if (pulse < numIntervals) {
      // Generate a random interval that keeps us in valid range
      // Min degree: 0, Max degree: 2*scaleLength - 1 (2 registries)
      const minAllowed = -accumulatedDegree; // Can't go below 0
      const maxAllowed = (2 * newScaleLength - 1) - accumulatedDegree; // Can't exceed 2 registries

      // Clamp to reasonable interval range
      const minInterval = Math.max(-maxInterval, minAllowed);
      const maxIntervalClamped = Math.min(maxInterval, maxAllowed);

      // Random interval within range
      let randomInterval;
      if (minInterval <= maxIntervalClamped) {
        randomInterval = Math.floor(Math.random() * (maxIntervalClamped - minInterval + 1)) + minInterval;
      } else {
        randomInterval = 0; // Fallback if range is invalid
      }

      accumulatedDegree += randomInterval;

      intervals.push({
        degreeInterval: randomInterval,
        isRest: false
      });
    } else {
      // Rest for remaining pulses
      intervals.push({
        degreeInterval: 0,
        isRest: true
      });
    }
  }

  // Update state and UI
  currentDegreeIntervals = intervals;
  gridEditor?.setPairs(intervals);

  // Sync grid visualization
  const absoluteDegrees = degreeIntervalsToAbsoluteDegrees(intervals, BASE_DEGREE);
  syncGridFromDegreeIntervals(absoluteDegrees);

  // Save state
  saveCurrentState();

  console.log('Random generation:', {
    scale: randomScale.name,
    transpose: randomTranspose,
    intervals,
    numIntervals,
    scaleLength: newScaleLength
  });
}

// ========== SYNCHRONIZATION ==========

// Store interval line elements for cleanup
let currentIntervalElements = [];

/**
 * Sync grid from degree intervals (iSº)
 * - Converts intervals to absolute degrees
 * - Activates cells with degree labels
 * - Draws interval lines with arrows
 *
 * @param {Array} absoluteDegrees - Array of {degree, pulse, isRest}
 */
function syncGridFromDegreeIntervals(absoluteDegrees) {
  if (!musicalGrid) return;

  // Clear all active cells, labels, and interval lines
  document.querySelectorAll('.musical-cell.active').forEach(cell => {
    cell.classList.remove('active');
    const label = cell.querySelector('.cell-label');
    if (label) label.remove();
  });
  clearIntervalLines();

  // Filter valid degrees
  const validDegrees = absoluteDegrees.filter(d => !d.isRest && d.degree !== null);

  // Activate cells for each degree
  validDegrees.forEach(({ degree, pulse }) => {
    // Get note index in the 25-note grid
    const noteIndex = absoluteDegreeToNoteIndex(degree);
    if (noteIndex === null) return;

    const cell = musicalGrid.getCellElement(noteIndex, pulse);

    if (cell) {
      cell.classList.add('active');

      // Add degree label (show absolute degree)
      const label = document.createElement('span');
      label.className = 'cell-label';
      label.textContent = String(degree);
      cell.appendChild(label);
    }
  });

  // Draw interval lines
  let prevDegree = BASE_DEGREE;

  validDegrees.forEach(({ degree, pulse }, idx) => {
    createDegreeIntervalLine(prevDegree, degree, pulse, idx);
    prevDegree = degree;
  });

  // Build registry map for autoscroll
  pulseRegistryMap = buildPulseRegistryMap(absoluteDegrees, currentScaleLength);
}

/**
 * Clear all interval line elements
 */
function clearIntervalLines() {
  currentIntervalElements.forEach(el => el.remove());
  currentIntervalElements = [];
}

/**
 * Create interval line between two degrees
 * Adapted from App15 createIntervalLine
 *
 * @param {number} degree1 - Source degree
 * @param {number} degree2 - Target degree
 * @param {number} pulseIndex - Pulse position
 * @param {number} intervalIndex - Index in sequence (0 = first)
 */
function createDegreeIntervalLine(degree1, degree2, pulseIndex, intervalIndex = 0) {
  const matrixContainer = musicalGrid?.getMatrixContainer?.();
  if (!matrixContainer) return;

  // Calculate interval in DEGREES (for display)
  const degreeInterval = degree2 - degree1;
  const absInterval = Math.abs(degreeInterval);
  const isAscending = degreeInterval > 0;

  // Get note indices in the 25-note grid
  const note1Index = absoluteDegreeToNoteIndex(degree1);
  const note2Index = absoluteDegreeToNoteIndex(degree2);

  if (note1Index === null || note2Index === null) return;

  // Calculate horizontal position (left edge of pulse column)
  const leftPos = pulseIndex / TOTAL_SPACES * 100;

  // Special case: interval 0 - vertical line spanning full cell
  if (absInterval === 0) {
    const cellHeight = 100 / TOTAL_NOTES;
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

    // Number "0" above the bar
    const intervalNum = document.createElement('div');
    intervalNum.className = 'interval-number';
    intervalNum.textContent = '0';
    intervalNum.style.position = 'absolute';
    intervalNum.style.zIndex = '16';
    intervalNum.style.top = `${topEdge}%`;
    intervalNum.style.left = `${leftPos}%`;
    intervalNum.style.transform = 'translate(-50%, -100%)';

    matrixContainer.appendChild(intervalNum);
    currentIntervalElements.push(intervalNum);
    return;
  }

  // Calculate vertical positions
  let topEdge, bottomEdge;
  const cellHeight = 100 / TOTAL_NOTES;

  if (Math.abs(note2Index - note1Index) <= 1) {
    // ±1 semitone: line spans edge-to-edge
    const topNote = Math.max(note1Index, note2Index);
    topEdge = (TOTAL_NOTES - 1 - topNote) / TOTAL_NOTES * 100;

    if (intervalIndex === 0 && note1Index === 0) {
      bottomEdge = 100;
    } else {
      const bottomNote = Math.min(note1Index, note2Index);
      bottomEdge = (TOTAL_NOTES - bottomNote) / TOTAL_NOTES * 100;
    }
  } else if (isAscending) {
    // Ascending: TOP of origin → BOTTOM of destination
    const originCellTop = (TOTAL_NOTES - 1 - note1Index) / TOTAL_NOTES * 100;
    const destCellBottom = (TOTAL_NOTES - note2Index) / TOTAL_NOTES * 100;
    topEdge = destCellBottom;

    if (intervalIndex === 0 && note1Index === 0) {
      bottomEdge = 100;
    } else {
      bottomEdge = originCellTop;
    }
  } else {
    // Descending: BOTTOM of origin → TOP of destination
    const originCellBottom = (TOTAL_NOTES - note1Index) / TOTAL_NOTES * 100;
    const destCellTop = (TOTAL_NOTES - 1 - note2Index) / TOTAL_NOTES * 100;
    topEdge = originCellBottom;
    bottomEdge = destCellTop;
  }

  const finalHeight = Math.abs(bottomEdge - topEdge);

  const intervalBar = document.createElement('div');
  intervalBar.className = 'interval-bar-vertical';
  intervalBar.classList.add(isAscending ? 'ascending' : 'descending');

  intervalBar.style.position = 'absolute';
  intervalBar.style.left = `${leftPos}%`;
  intervalBar.style.transform = 'translateX(-50%)';
  intervalBar.style.width = '4px';
  intervalBar.style.top = `${Math.min(topEdge, bottomEdge)}%`;
  intervalBar.style.height = `${finalHeight}%`;
  intervalBar.style.zIndex = '15';

  matrixContainer.appendChild(intervalBar);
  currentIntervalElements.push(intervalBar);

  // Create interval number label (shows DEGREE interval, not semitones)
  const displayValue = degreeInterval > 0 ? `+${absInterval}` : `-${absInterval}`;

  const centerY = (topEdge + bottomEdge) / 2;

  const intervalNum = document.createElement('div');
  intervalNum.className = 'interval-number';
  intervalNum.textContent = displayValue;
  intervalNum.style.position = 'absolute';
  intervalNum.style.zIndex = '16';

  // Position: first interval always right, ascending left, descending right
  const isFirstInterval = intervalIndex === 0;

  if (isFirstInterval || !isAscending) {
    intervalNum.style.top = `${centerY}%`;
    intervalNum.style.left = `calc(${leftPos}% + 12px)`;
    intervalNum.style.transform = 'translateY(-50%)';
  } else {
    intervalNum.style.top = `${centerY}%`;
    intervalNum.style.left = `calc(${leftPos}% - 12px)`;
    intervalNum.style.transform = 'translate(-100%, -50%)';
  }

  matrixContainer.appendChild(intervalNum);
  currentIntervalElements.push(intervalNum);
}

// Legacy function for compatibility
function syncGridFromDegrees(pairs) {
  const absoluteDegrees = pairs.map(p => ({
    degree: p.degree,
    pulse: p.pulse,
    isRest: p.isRest
  }));
  syncGridFromDegreeIntervals(absoluteDegrees);
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

  // Build extended scale semitones for 2 registries
  // Registry 1: notes 0-12 (semitones 0-12)
  // Registry 2: notes 13-24 (semitones 0-11 + 12 offset)
  const extendedScaleSemitones = [...scaleSemitones];
  scaleSemitones.forEach(s => {
    if (s < 12) {
      extendedScaleSemitones.push(s + 12);
    }
  });

  // Update cell enabled states for both registries
  if (musicalGrid.setEnabledNotes) {
    musicalGrid.setEnabledNotes(extendedScaleSemitones);
  }

  // Update degree labels on soundline
  updateSoundlineLabels();
}

function updateSoundlineLabels() {
  if (!musicalGrid) return;

  // Use BASE scale (no transpose) for VISUAL display
  const scaleSemitones = getVisualScaleSemitones();

  // Build extended scale semitones for 2 registries
  // Registry 1: notes 0-12 (semitones 0-12)
  // Registry 2: notes 13-24 (semitones 0-11 + 12 offset)
  const extendedScaleSemitones = [...scaleSemitones];
  // Add registry 2 semitones (offset by 12)
  scaleSemitones.forEach(s => {
    if (s < 12) {
      extendedScaleSemitones.push(s + 12);
    }
  });

  // Use the API if available
  if (musicalGrid.updateSoundlineLabels) {
    musicalGrid.updateSoundlineLabels(extendedScaleSemitones, (noteIndex) => {
      // Determine registry
      if (noteIndex < NOTES_PER_REGISTRY) {
        // Registry 1: notes 0-12
        if (noteIndex === 12) {
          // Note 12 = shared boundary (degree 0 of r2 or scaleLength of r1)
          return `${currentScaleLength}`;
        }
        const degreeIndex = scaleSemitones.indexOf(noteIndex);
        return degreeIndex !== -1 ? String(degreeIndex) : '·';
      } else {
        // Registry 2: notes 13-24
        const adjustedNote = noteIndex - 12;
        const degreeIndex = scaleSemitones.indexOf(adjustedNote);
        if (degreeIndex !== -1) {
          // Show absolute degree (degree + scaleLength)
          return String(degreeIndex + currentScaleLength);
        }
        return '·';
      }
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
  scaleState.id = scaleId;
  scaleState.rot = rotation;

  // Find rootOffset from our scale configuration
  const scaleConfig = APP25_SCALES.find(s => s.value === value);
  currentRootOffset = scaleConfig?.rootOffset || 0;

  currentScaleLength = motherScalesData[scaleId]?.ee?.length || 7;

  // Update grid cell states (which notes are enabled based on new scale)
  updateGridCellStates();

  // With intervals, the same intervals produce different absolute degrees
  // depending on the scale. We keep the intervals unchanged.
  // The visual representation will update automatically.
  if (gridEditor && currentDegreeIntervals.length > 0) {
    // Recalculate absolute degrees with new scale
    const absoluteDegrees = degreeIntervalsToAbsoluteDegrees(currentDegreeIntervals, BASE_DEGREE);

    // Sync grid with new positions
    syncGridFromDegreeIntervals(absoluteDegrees);
  }

  console.log('Scale changed:', {
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

  // Update Nm(X) visualizer with flash animation
  updateNmVisualizer(transpose);

  // NO visual grid updates needed - visual display is FIXED
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

  // Create musical grid - WITH SCROLL for 2 registries (25 notes, show 13 at a time)
  musicalGrid = createMusicalGrid({
    parent: gridAreaContainer,
    notes: TOTAL_NOTES,
    pulses: TOTAL_PULSES,
    startMidi: 60,
    fillSpaces: true,
    cellClassName: 'musical-cell',
    activeClassName: 'active',
    highlightClassName: 'highlight',
    scrollEnabled: true,  // Enable scroll for 2 registries
    visibleCells: { notes: VISIBLE_NOTES, pulses: TOTAL_PULSES },
    cellSize: { minHeight: 28, minWidth: 40 },  // Fixed cell size for scroll
    showIntervals: {
      horizontal: true,
      vertical: false
    },
    intervalColor: '#4A9EFF',
    noteFormatter: (noteIndex) => {
      // Show degree number based on registry
      // Registry 1: notes 0-12 (degrees 0-12, where 12 = degree 0 of r2)
      // Registry 2: notes 13-24 (degrees 0-11 of r2)
      const registry = noteIndex < NOTES_PER_REGISTRY ? 1 : 2;
      const degreeInRegistry = noteIndex < NOTES_PER_REGISTRY
        ? noteIndex
        : noteIndex - NOTES_PER_REGISTRY + 1;  // +1 because note 12 = note 13 (shared)

      // Get scale semitones for this registry
      const scaleSems = getVisualScaleSemitones();

      // For registry 1, check if note is in scale
      if (registry === 1) {
        const degreeIndex = scaleSems.indexOf(noteIndex);
        return degreeIndex !== -1 ? String(degreeIndex) : '·';
      } else {
        // For registry 2, offset by 12 semitones and check
        const adjustedNote = noteIndex - 12;
        const degreeIndex = scaleSems.indexOf(adjustedNote);
        if (degreeIndex !== -1) {
          // Show degree + scaleLength to indicate it's in registry 2
          return String(degreeIndex + currentScaleLength);
        }
        return '·';
      }
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

  // Initial scroll to registry 1 (bottom, showing notes 0-12)
  // Use setTimeout to ensure grid is fully rendered
  setTimeout(() => {
    scrollToRegistry(1, false);

    // Setup scroll sync between matrix and soundline
    const matrixContainer = musicalGrid?.getMatrixContainer?.();
    const soundlineWrapper = document.querySelector('.soundline-wrapper');

    if (matrixContainer && soundlineWrapper) {
      let isScrollSyncing = false;

      matrixContainer.addEventListener('scroll', () => {
        if (isScrollSyncing) return;
        isScrollSyncing = true;
        soundlineWrapper.scrollTop = matrixContainer.scrollTop;
        requestAnimationFrame(() => { isScrollSyncing = false; });
      });

      soundlineWrapper.addEventListener('scroll', () => {
        if (isScrollSyncing) return;
        isScrollSyncing = true;
        matrixContainer.scrollTop = soundlineWrapper.scrollTop;
        requestAnimationFrame(() => { isScrollSyncing = false; });
      });
    }
  }, 100);

  // Create Nm(X) visualizer in grid spacer (grid-area: 2/1)
  const gridContainer = gridAreaContainer.querySelector('.grid-container');
  if (gridContainer) {
    createNmVisualizer(gridContainer);
  }

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
    mode: 'degree-interval',
    degreeModeOptions: {
      totalPulses: TOTAL_SPACES,
      getScaleLength: () => currentScaleLength,
      // For degree-interval mode, validation is done internally
      // based on accumulated degrees and scale length * 2 (2 registries)
    },
    noteRange: [0, 11],
    pulseRange: [0, TOTAL_SPACES - 1],
    maxPairs: TOTAL_SPACES,
    autoJumpDelayMs: 500,
    scrollEnabled: isMobile,
    containerSize: isMobile ? { maxHeight: '100px', width: '100%' } : null,
    columnSize: isMobile ? { width: '50px', minHeight: '80px' } : null,
    onPairsChange: (intervals) => {
      // Store current intervals
      currentDegreeIntervals = intervals;

      // Convert intervals to absolute degrees
      const absoluteDegrees = degreeIntervalsToAbsoluteDegrees(intervals, BASE_DEGREE);

      // Sync grid visualization
      syncGridFromDegreeIntervals(absoluteDegrees);

      // Save state
      saveCurrentState();
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
    // Get initial instrument label from stored preference
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

      localStorage.removeItem('app25b:p1Toggle');
      localStorage.removeItem('app25b:pulseAudio');
      localStorage.removeItem('app25-mixer');

      const randDensity = document.getElementById('randDensity');
      if (randDensity) randDensity.value = '8';
    }
  });

  // Preload piano samples in background (reduces latency on first play)
  setupPianoPreload({ delay: 300 });

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
