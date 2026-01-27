// App25B: Melodías con iSº - Interval-based melodic sequencer
// Uses degree intervals (iSº): +2, -1, 0, +3, etc.
// Base degree is always 0 (implicit starting point)
// One interval per pulse, 12 pulses total
// KEY FEATURES:
// - 2 registries (3 and 4) with vertical scroll using plano-modular
// - Autoscroll during playback when registry changes
// - Interval lines with arrows (like App15)
// - Soundline shows Nº^r format (degree + registry superscript)

import { createPlanoModular } from '../../libs/plano-modular/index.js';
import { smoothScrollTo } from '../../libs/plano-modular/plano-scroll.js';
import { createGridEditor } from '../../libs/matrix-seq/index.js';
import { initMixerMenu, updateMixerChannelLabel } from '../../libs/app-common/mixer-menu.js';
import { initRandomMenu } from '../../libs/random/menu.js';
import { initP1ToggleUI } from '../../libs/shared-ui/sound-dropdown.js';
import { initAudioToggles } from '../../libs/app-common/audio-toggles.js';
import { getMixer, subscribeMixer, setChannelVolume, setChannelMute, setVolume, setMute } from '../../libs/sound/index.js';
import { registerFactoryReset, createPreferenceStorage } from '../../libs/app-common/preferences.js';
import { createMelodicAudioInitializer } from '../../libs/app-common/audio-init.js';
import { isPianoLoaded, setupPianoPreload } from '../../libs/sound/piano.js';
import { isViolinLoaded } from '../../libs/sound/violin.js';
import { createScaleSelector } from '../../libs/scale-selector/index.js';
import { degToSemi, scaleSemis, motherScalesData } from '../../libs/scales/index.js';

// ========== CONFIGURATION ==========
const TOTAL_SPACES = 12;   // Spaces between pulses
const DEFAULT_BPM = 120;
const BASE_DEGREE = 0;     // Implicit starting degree

// Registry configuration for App25B
const VISIBLE_ROWS = 13;   // Show 13 rows at a time (one octave + 1)
const DEFAULT_REGISTRY = 3;

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
let planoGrid = null;
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

// Current registry for scroll
let currentRegistry = DEFAULT_REGISTRY;

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

function saveCurrentState() {
  const prefs = preferenceStorage.load() || {};
  prefs.intervals = currentDegreeIntervals;
  prefs.scaleState = scaleState;
  preferenceStorage.save(prefs);
}

function loadSavedState() {
  const prefs = preferenceStorage.load() || {};
  if (prefs.intervals && Array.isArray(prefs.intervals)) {
    currentDegreeIntervals = prefs.intervals;
    return prefs.intervals;
  }
  return [];
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
 * Get VISUAL scale semitones (for soundline and grid display)
 */
function getVisualScaleSemitones() {
  const visualState = { id: scaleState.id, rot: scaleState.rot, root: currentRootOffset };
  const sems = scaleSemis(scaleState.id);
  const result = [];
  for (let d = 0; d < sems.length; d++) {
    result.push(degToSemi(visualState, d));
  }
  result.push(12);  // Always include octave
  return result;
}

/**
 * Convert degree + modifier to MIDI note (for playback)
 */
function degreeToMidi(degree, modifier = null) {
  if (degree === null || degree === undefined) return null;

  const effectiveRoot = (scaleState.root + currentRootOffset) % 12;
  const effectiveState = { ...scaleState, root: effectiveRoot };

  if (degree === 0 && modifier === 'r+') {
    const semitone = degToSemi(effectiveState, 0);
    return 60 + semitone + 12;
  }

  const sems = scaleSemis(scaleState.id);
  const scaleLength = sems.length;
  const degreeSemitones = [];
  for (let d = 0; d < scaleLength; d++) {
    degreeSemitones.push(degToSemi(effectiveState, d));
  }

  let wrapIndex = scaleLength;
  for (let i = 1; i < scaleLength; i++) {
    if (degreeSemitones[i] < degreeSemitones[i - 1]) {
      wrapIndex = i;
      break;
    }
  }

  const semitone = degToSemi(effectiveState, degree);
  let alteredSemitone = semitone;
  if (modifier === '+') alteredSemitone = (semitone + 1) % 12;
  if (modifier === '-') alteredSemitone = (semitone + 11) % 12;

  const octaveOffset = degree >= wrapIndex ? 12 : 0;
  return 60 + alteredSemitone + octaveOffset;
}

// ========== INTERVAL CONVERSIONS (iSº) ==========

/**
 * Convert degree intervals to absolute degrees
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
 * For App25B: registry 3 = degrees 0 to scaleLength-1
 *            registry 4 = degrees scaleLength to 2*scaleLength-1
 */
function degreeToRegistryAndNote(absoluteDegree, scaleLength) {
  if (absoluteDegree === null || absoluteDegree === undefined) return null;
  if (absoluteDegree < 0) return null;

  // Registry 3 = first octave (degrees 0 to scaleLength-1)
  // Registry 4 = second octave (degrees scaleLength to 2*scaleLength-1)
  const registryOffset = Math.floor(absoluteDegree / scaleLength);
  const registry = 3 + registryOffset;  // Start at registry 3
  const degreeInRegistry = absoluteDegree % scaleLength;

  // Only support registries 3 and 4
  if (registry > 4) return null;

  return { registry, degreeInRegistry };
}

/**
 * Convert absolute degree to MIDI note for playback
 */
function absoluteDegreeToMidi(absoluteDegree) {
  if (absoluteDegree === null || absoluteDegree === undefined) return null;

  const regInfo = degreeToRegistryAndNote(absoluteDegree, currentScaleLength);
  if (!regInfo) return null;

  const { registry, degreeInRegistry } = regInfo;
  const baseMidi = degreeToMidi(degreeInRegistry, null);
  if (baseMidi === null) return null;

  // Add octave offset for registry 4
  const registryOffset = (registry - 3) * 12;
  return baseMidi + registryOffset;
}

/**
 * Build pulse to registry map for autoscroll
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

// ========== GRID ROW BUILDING ==========

/**
 * Build rows for the grid based on current scale
 * Each row represents a degree in the scale
 * Rows are labeled as Nº^r (degree with registry superscript)
 */
function buildScaleRows() {
  const rows = [];

  // Registry 4 (upper octave): degrees scaleLength to 2*scaleLength-1
  // Show from highest to lowest
  for (let d = currentScaleLength - 1; d >= 0; d--) {
    const absoluteDegree = d + currentScaleLength;
    rows.push({
      id: `${d}r4`,
      label: `${absoluteDegree}`,  // Show absolute degree
      data: {
        registry: 4,
        note: d,
        absoluteDegree: absoluteDegree
      }
    });
  }

  // Registry 3 (lower octave): degrees 0 to scaleLength-1
  // Show from highest to lowest
  for (let d = currentScaleLength - 1; d >= 0; d--) {
    rows.push({
      id: `${d}r3`,
      label: `${d}`,  // Show degree
      data: {
        registry: 3,
        note: d,
        absoluteDegree: d
      }
    });
  }

  return rows;
}

/**
 * Calculate note0RowMap for scroll positioning
 */
function calculateScaleNote0RowMap(rows) {
  const map = {};

  rows.forEach((row, index) => {
    if (row.data && row.data.note === 0) {
      map[row.data.registry] = index;
    }
  });

  return map;
}

// ========== SCROLL FUNCTIONS ==========

/**
 * Scroll to a specific registry
 */
function scrollToRegistry(registryId, animated = true) {
  if (!planoGrid) return;

  const elements = planoGrid.getElements();
  if (!elements || !elements.matrixContainer) return;

  const rows = planoGrid.getRows();
  const note0RowMap = calculateScaleNote0RowMap(rows);

  const targetRowIndex = note0RowMap[registryId];
  if (targetRowIndex === undefined) return;

  // Calculate cell height
  const matrix = elements.matrixContainer.querySelector('.plano-matrix');
  if (!matrix) return;

  const cellHeight = matrix.scrollHeight / rows.length;
  const visibleHeight = elements.matrixContainer.clientHeight;

  // Center the row
  const centerOffset = Math.floor(VISIBLE_ROWS / 2);
  let targetScrollTop = Math.max(0, (targetRowIndex - centerOffset) * cellHeight);

  // Clamp to valid range
  const maxScroll = matrix.scrollHeight - visibleHeight;
  targetScrollTop = Math.max(0, Math.min(targetScrollTop, maxScroll));

  if (animated) {
    smoothScrollTo(elements.matrixContainer, targetScrollTop, 'top', 200);
    smoothScrollTo(elements.soundlineContainer, targetScrollTop, 'top', 200);
  } else {
    elements.matrixContainer.scrollTop = targetScrollTop;
    elements.soundlineContainer.scrollTop = targetScrollTop;
  }

  currentRegistry = registryId;
}

// ========== Nm VISUALIZER ==========

function createNmVisualizer(container) {
  const visualizer = document.createElement('div');
  visualizer.className = 'nm-visualizer';
  visualizer.innerHTML = `<span class="nm-label">Nm(</span><span class="nm-value">${scaleState.root}</span><span class="nm-label">)</span>`;
  container.appendChild(visualizer);
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

// ========== INTERVAL LINES ==========

let currentIntervalElements = [];

function clearIntervalLines() {
  currentIntervalElements.forEach(el => el.remove());
  currentIntervalElements = [];
}

/**
 * Create interval line between two degrees
 */
function createDegreeIntervalLine(degree1, degree2, pulseIndex, intervalIndex = 0) {
  if (!planoGrid) return;

  const elements = planoGrid.getElements();
  const matrix = elements?.matrixContainer?.querySelector('.plano-matrix');
  if (!matrix) return;

  const degreeInterval = degree2 - degree1;
  const absInterval = Math.abs(degreeInterval);
  const isAscending = degreeInterval > 0;

  // Find the cell positions
  const rows = planoGrid.getRows();
  const reg1 = degreeToRegistryAndNote(degree1, currentScaleLength);
  const reg2 = degreeToRegistryAndNote(degree2, currentScaleLength);

  if (!reg1 || !reg2) return;

  // Find row indices
  const rowIndex1 = rows.findIndex(r => r.data.registry === reg1.registry && r.data.note === reg1.degreeInRegistry);
  const rowIndex2 = rows.findIndex(r => r.data.registry === reg2.registry && r.data.note === reg2.degreeInRegistry);

  if (rowIndex1 === -1 || rowIndex2 === -1) return;

  // Get cell dimensions
  const cellHeight = matrix.scrollHeight / rows.length;
  const cellWidth = matrix.scrollWidth / TOTAL_SPACES;

  // Calculate positions
  const leftPos = pulseIndex * cellWidth;

  // Vertical positions (from top of matrix)
  const y1 = rowIndex1 * cellHeight + cellHeight / 2;
  const y2 = rowIndex2 * cellHeight + cellHeight / 2;

  // Create interval bar
  const intervalBar = document.createElement('div');
  intervalBar.className = 'interval-bar-vertical';
  if (absInterval === 0) {
    intervalBar.classList.add('interval-zero');
  } else {
    intervalBar.classList.add(isAscending ? 'ascending' : 'descending');
  }

  const topY = Math.min(y1, y2);
  const height = Math.abs(y2 - y1);

  intervalBar.style.position = 'absolute';
  intervalBar.style.left = `${leftPos}px`;
  intervalBar.style.top = `${topY}px`;
  intervalBar.style.height = `${height || cellHeight * 0.8}px`;
  intervalBar.style.width = '4px';
  intervalBar.style.transform = 'translateX(-50%)';
  intervalBar.style.zIndex = '15';

  matrix.appendChild(intervalBar);
  currentIntervalElements.push(intervalBar);

  // Create interval number
  const displayValue = degreeInterval > 0 ? `+${absInterval}` :
                       degreeInterval < 0 ? `-${absInterval}` : '0';

  const intervalNum = document.createElement('div');
  intervalNum.className = 'interval-number';
  intervalNum.textContent = displayValue;
  intervalNum.style.position = 'absolute';
  intervalNum.style.zIndex = '16';
  intervalNum.style.top = `${topY + height / 2}px`;
  intervalNum.style.left = `${leftPos + 15}px`;
  intervalNum.style.transform = 'translateY(-50%)';

  matrix.appendChild(intervalNum);
  currentIntervalElements.push(intervalNum);
}

// ========== SYNCHRONIZATION ==========

function syncGridFromDegreeIntervals(absoluteDegrees) {
  if (!planoGrid) return;

  // Clear previous selections and interval lines
  planoGrid.clearSelection();
  clearIntervalLines();

  // Filter valid degrees
  const validDegrees = absoluteDegrees.filter(d => !d.isRest && d.degree !== null);

  // Select cells for each degree
  validDegrees.forEach(({ degree, pulse }) => {
    const regInfo = degreeToRegistryAndNote(degree, currentScaleLength);
    if (!regInfo) return;

    const rowId = `${regInfo.degreeInRegistry}r${regInfo.registry}`;
    planoGrid.selectCell(rowId, pulse);
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

  const allIntervals = gridEditor.getPairs();
  const absoluteDegrees = degreeIntervalsToAbsoluteDegrees(allIntervals, BASE_DEGREE);
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
      // Highlight timeline
      planoGrid.highlightTimelineNumber(step, intervalSec * 1000 * 0.9);

      const degreeData = absoluteDegrees.find(d => d.pulse === step);
      if (degreeData && !degreeData.isRest && degreeData.degree !== null) {
        const midi = absoluteDegreeToMidi(degreeData.degree);
        const duration = intervalSec * 0.9;
        const when = scheduledTime ?? Tone.now();

        if (midi !== null) {
          audio.playNote(midi, duration, when);
        }

        // Visual feedback - highlight the cell
        const regInfo = degreeToRegistryAndNote(degreeData.degree, currentScaleLength);
        if (regInfo) {
          const rowId = `${regInfo.degreeInRegistry}r${regInfo.registry}`;
          planoGrid.highlightCell(rowId, step, duration * 1000);
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

  planoGrid?.clearHighlights();

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
  planoGrid?.clearSelection();
  clearIntervalLines();

  currentDegreeIntervals = [];
  pulseRegistryMap = {};

  if (isPlaying) {
    stopPlayback();
  }

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

  // 2. Randomize transpose
  const randomTranspose = Math.floor(Math.random() * 12);
  scaleSelector?.setTranspose(randomTranspose);

  // 3. Randomize sequence of INTERVALS (iSº)
  const randDensity = parseInt(document.getElementById('randDensity')?.value || 8, 10);
  const newScaleLength = motherScalesData[randomScale.id]?.ee?.length || 7;
  const numIntervals = Math.max(1, Math.min(randDensity, TOTAL_SPACES));
  const maxInterval = newScaleLength - 1;

  let accumulatedDegree = BASE_DEGREE;
  const intervals = [];

  for (let pulse = 0; pulse < TOTAL_SPACES; pulse++) {
    if (pulse < numIntervals) {
      const minAllowed = -accumulatedDegree;
      const maxAllowed = (2 * newScaleLength - 1) - accumulatedDegree;
      const minInterval = Math.max(-maxInterval, minAllowed);
      const maxIntervalClamped = Math.min(maxInterval, maxAllowed);

      let randomInterval;
      if (minInterval <= maxIntervalClamped) {
        randomInterval = Math.floor(Math.random() * (maxIntervalClamped - minInterval + 1)) + minInterval;
      } else {
        randomInterval = 0;
      }

      accumulatedDegree += randomInterval;

      intervals.push({
        degreeInterval: randomInterval,
        isRest: false
      });
    } else {
      intervals.push({
        degreeInterval: 0,
        isRest: true
      });
    }
  }

  currentDegreeIntervals = intervals;
  gridEditor?.setPairs(intervals);

  const absoluteDegrees = degreeIntervalsToAbsoluteDegrees(intervals, BASE_DEGREE);
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

function handleScaleChange({ scaleId, rotation, value }) {
  const oldScaleLength = currentScaleLength;

  scaleState.id = scaleId;
  scaleState.rot = rotation;

  const scaleConfig = APP25_SCALES.find(s => s.value === value);
  currentRootOffset = scaleConfig?.rootOffset || 0;
  currentScaleLength = motherScalesData[scaleId]?.ee?.length || 7;

  // Rebuild grid rows for new scale
  rebuildGrid();

  // Recalculate and sync intervals
  if (currentDegreeIntervals.length > 0) {
    const absoluteDegrees = degreeIntervalsToAbsoluteDegrees(currentDegreeIntervals, BASE_DEGREE);
    syncGridFromDegreeIntervals(absoluteDegrees);
  }

  console.log('Scale changed:', { scaleId, rotation, oldScaleLength, newScaleLength: currentScaleLength });
}

function handleTransposeChange(transpose) {
  scaleState.root = transpose;
  updateNmVisualizer(transpose);
  console.log('Transpose changed:', transpose);
}

// ========== GRID REBUILD ==========

function rebuildGrid() {
  if (!planoGrid) return;

  const rows = buildScaleRows();
  planoGrid.updateRows(rows);

  // Scroll to default registry
  setTimeout(() => {
    scrollToRegistry(DEFAULT_REGISTRY, false);
  }, 50);
}

// ========== DOM INJECTION ==========

function injectLayout() {
  const appRoot = document.getElementById('app-root');
  const mainElement = appRoot?.querySelector('main');
  if (!mainElement) return null;

  const gridWrapper = document.createElement('div');
  gridWrapper.className = 'app25-main-grid';

  scaleSelectorContainer = document.createElement('div');
  scaleSelectorContainer.className = 'app25-scale-selector';
  gridWrapper.appendChild(scaleSelectorContainer);

  gridAreaContainer = document.createElement('div');
  gridAreaContainer.className = 'app25-grid-area';
  gridWrapper.appendChild(gridAreaContainer);

  gridEditorContainer = document.createElement('div');
  gridEditorContainer.id = 'gridEditorContainer';
  gridAreaContainer.appendChild(gridEditorContainer);

  // Container for plano grid
  const planoContainer = document.createElement('div');
  planoContainer.className = 'app25-plano-container';
  gridAreaContainer.appendChild(planoContainer);

  mainElement.appendChild(gridWrapper);

  return { gridWrapper, planoContainer };
}

// ========== INITIALIZATION ==========

async function init() {
  console.log('Initializing App25B: Melodías con iSº...');

  const { gridWrapper, planoContainer } = injectLayout();
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

  // Build initial rows
  const rows = buildScaleRows();
  const note0RowMap = calculateScaleNote0RowMap(rows);

  // Create plano grid
  planoGrid = createPlanoModular({
    parent: planoContainer,
    rows,
    columns: TOTAL_SPACES,
    cycleConfig: {
      compas: TOTAL_SPACES,
      showCycle: false
    },
    bpm: currentBPM,
    scrollConfig: {
      blockVerticalWheel: false,  // Allow smooth scroll
      visibleRows: VISIBLE_ROWS,
      visibleColumns: TOTAL_SPACES,
      note0RowMap
    },
    selectionMode: 'none',  // We handle selection manually
    showPlayhead: true,
    playheadOffset: 0,
    onCellClick: async (rowData, colIndex, isSelected) => {
      const audioInstance = await initAudio();
      if (!window.Tone || !audioInstance) return;

      // Play the note
      const absoluteDegree = rowData.data.absoluteDegree;
      const midi = absoluteDegreeToMidi(absoluteDegree);
      if (midi !== null) {
        const duration = (60 / currentBPM) * 0.9;
        audioInstance.playNote(midi, duration, window.Tone.now());
      }
    }
  });

  // Soundline label formatter
  const elements = planoGrid.getElements();
  if (elements?.soundlineContainer) {
    // Update soundline labels to show Nº^r format
    const soundlineRow = elements.soundlineContainer.querySelector('.plano-soundline-row');
    if (soundlineRow) {
      const noteEls = soundlineRow.querySelectorAll('.plano-soundline-note');
      noteEls.forEach(noteEl => {
        const registry = noteEl.dataset.registry;
        const degree = noteEl.dataset.absoluteDegree;
        if (degree !== undefined && registry !== undefined) {
          noteEl.innerHTML = `${degree}<sup>${registry}</sup>`;
        }
      });
    }
  }

  // Initial scroll to registry 3
  setTimeout(() => {
    scrollToRegistry(DEFAULT_REGISTRY, false);
  }, 100);

  // Create Nm(X) visualizer
  const nmContainer = document.createElement('div');
  nmContainer.className = 'nm-container';
  scaleSelectorContainer.appendChild(nmContainer);
  createNmVisualizer(nmContainer);

  // Move controls into scale selector area
  const controls = document.querySelector('.controls');
  if (controls && scaleSelectorContainer) {
    controls.remove();
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'app25-controls-container';
    controlsContainer.appendChild(controls);
    scaleSelectorContainer.appendChild(controlsContainer);
  }

  // Create grid editor
  const isMobile = window.innerWidth <= 900;
  gridEditor = createGridEditor({
    container: gridEditorContainer,
    mode: 'degree-interval',
    degreeModeOptions: {
      totalPulses: TOTAL_SPACES,
      getScaleLength: () => currentScaleLength
    },
    noteRange: [0, 11],
    pulseRange: [0, TOTAL_SPACES - 1],
    maxPairs: TOTAL_SPACES,
    autoJumpDelayMs: 500,
    scrollEnabled: isMobile,
    containerSize: isMobile ? { maxHeight: '100px', width: '100%' } : null,
    columnSize: isMobile ? { width: '50px', minHeight: '80px' } : null,
    onPairsChange: (intervals) => {
      currentDegreeIntervals = intervals;
      const absoluteDegrees = degreeIntervalsToAbsoluteDegrees(intervals, BASE_DEGREE);
      syncGridFromDegreeIntervals(absoluteDegrees);
      saveCurrentState();
    }
  });

  // Audio preload on first interaction
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
        master: { volume: snapshot.master.volume, muted: snapshot.master.muted },
        channels: {}
      };
      snapshot.channels.forEach(ch => {
        if (MIXER_CHANNELS.includes(ch.id)) {
          state.channels[ch.id] = { volume: ch.volume, muted: ch.muted };
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
      toggles: [{
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
      }],
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

  // Instrument dropdown
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
      localStorage.removeItem('app25-mixer');
      const randDensity = document.getElementById('randDensity');
      if (randDensity) randDensity.value = '8';
    }
  });

  // Preload piano
  setupPianoPreload({ delay: 300 });

  console.log('App25B initialized successfully');
}

// ========== CLEANUP ==========

window.addEventListener('beforeunload', () => {
  if (audio) audio.stop();
  if (planoGrid) planoGrid.destroy?.();
  if (gridEditor) gridEditor.destroy?.();
});

// Start initialization
init().catch(err => {
  console.error('Failed to initialize App25B:', err);
});
