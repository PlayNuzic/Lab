// App25B: Melodías con iSº - Interval-based melodic sequencer
// Uses degree intervals (iSº): +2, -1, 0, +3, etc.
// Base degree is always 0 (implicit starting point)
// One interval per pulse, 12 pulses total
// KEY FEATURES:
// - 20 notes using musical-grid, full vertical fit (or scroll if needed)
// - Interval lines with arrows
// - Bidirectional: grid clicks update iSº editor

import { createMusicalGrid } from '../../libs/musical-grid/index.js';
import { initMixerMenu, updateMixerChannelLabel } from '../../libs/app-common/mixer-menu.js';
import { initRandomMenu } from '../../libs/random/menu.js';
import { initP1ToggleUI } from '../../libs/shared-ui/sound-dropdown.js';
import { initAudioToggles } from '../../libs/app-common/audio-toggles.js';
import { getMixer, subscribeMixer, setChannelVolume, setChannelMute, setVolume, setMute } from '../../libs/sound/index.js';
import { registerFactoryReset, createPreferenceStorage } from '../../libs/app-common/preferences.js';
import { createMatrixHighlightController } from '../../libs/app-common/matrix-highlight-controller.js';
import { createMelodicAudioInitializer } from '../../libs/app-common/audio-init.js';
import { isPianoLoaded, setupPianoPreload } from '../../libs/sound/piano.js';
import { isFluteLoaded } from '../../libs/sound/flute.js';
import { degToSemi, scaleSemis, motherScalesData } from '../../libs/scales/index.js';
import { createBpmController } from '../../libs/app-common/bpm-controller.js';
import { initIdleCaretFlash } from '../../libs/app-common/idle-caret-flash.js';
import { createInfoTooltip } from '../../libs/app-common/info-tooltip.js';
import { createOutputNotePill } from '../../libs/app-common/output-note-pill.js';
import { createScalePill } from '../../libs/app-common/scale-pill.js';

// ========== CONFIGURATION ==========
const TOTAL_PULSES = 13;   // Horizontal: 0-12 (creates 12 spaces)
const TOTAL_NOTES = 20;    // Vertical: 0-19 (semitones across ~2 octaves)
const TOTAL_SPACES = 12;   // Spaces between pulses
const DEFAULT_BPM = 90;
const MIN_BPM = 50;
const MAX_BPM = 150;
const BASE_DEGREE = 0;

// Scale configuration (same as App25)
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

let scaleState = { id: 'DIAT', rot: 0, root: 0 };
let currentRootOffset = 0;
let currentScaleLength = 7;

// Current degree intervals (iSº)
let currentDegreeIntervals = [];

// Memory for absolute degrees that exceed current scale length
const lostDegreesMemory = new Map();

// Interval line elements for cleanup
let currentIntervalElements = [];

// Elements
let playBtn = null;
let resetBtn = null;
let randomBtn = null;
let gridEditorContainer = null;
let highlightController = null;

// ========== STORAGE HELPERS ==========
const preferenceStorage = createPreferenceStorage('app25b');

// Shared info tooltip for validation warnings (matches legacy + App25 style)
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

// ========== SCALE CONVERSIONS ==========

function getVisualScaleSemitones() {
  const visualState = { id: scaleState.id, rot: scaleState.rot, root: currentRootOffset };
  const sems = scaleSemis(scaleState.id);
  const result = [];
  const maxSemi = TOTAL_NOTES - 1;
  for (let octave = 0; octave * 12 <= maxSemi; octave++) {
    for (let d = 0; d < sems.length; d++) {
      const semi = degToSemi(visualState, d) + octave * 12;
      if (semi <= maxSemi) result.push(semi);
    }
  }
  return result;
}

function getMaxAbsoluteDegree() {
  const visualState = { id: scaleState.id, rot: scaleState.rot, root: currentRootOffset };
  const maxSemi = TOTAL_NOTES - 1;
  let degree = 0;
  while (true) {
    const octave = Math.floor(degree / currentScaleLength);
    const degInOctave = degree % currentScaleLength;
    const semi = degToSemi(visualState, degInOctave) + octave * 12;
    if (semi > maxSemi) return degree - 1;
    degree++;
    if (degree > 100) return degree - 1;
  }
}

function absoluteDegreeToVisualNoteIndex(absoluteDegree) {
  if (absoluteDegree === null || absoluteDegree === undefined) return null;
  const visualState = { id: scaleState.id, rot: scaleState.rot, root: currentRootOffset };
  const scaleLen = currentScaleLength;
  const octave = Math.floor(absoluteDegree / scaleLen);
  const degreeInOctave = absoluteDegree % scaleLen;
  const semitone = degToSemi(visualState, degreeInOctave);
  const noteIndex = semitone + octave * 12;
  return Math.min(noteIndex, TOTAL_NOTES - 1);
}

function visualNoteIndexToAbsoluteDegree(noteIndex) {
  if (noteIndex === null || noteIndex === undefined) return null;
  const visualState = { id: scaleState.id, rot: scaleState.rot, root: currentRootOffset };
  const scaleLen = currentScaleLength;
  const octave = Math.floor(noteIndex / 12);
  const semitoneInOctave = noteIndex % 12;
  for (let d = 0; d < scaleLen; d++) {
    if (degToSemi(visualState, d) === semitoneInOctave) {
      return d + (octave * scaleLen);
    }
  }
  return null;
}

function absoluteDegreeToMidi(absoluteDegree) {
  if (absoluteDegree === null || absoluteDegree === undefined) return null;

  const effectiveRoot = (scaleState.root + currentRootOffset) % 12;
  const effectiveState = { id: scaleState.id, rot: scaleState.rot, root: effectiveRoot };
  const scaleLen = currentScaleLength;
  const ee = motherScalesData[scaleState.id].ee;

  const rot = ((scaleState.rot % scaleLen) + scaleLen) % scaleLen;
  const rotatedEE = [...ee.slice(rot), ...ee.slice(0, rot)];

  const degree0Semi = degToSemi(effectiveState, 0);

  const octave = Math.floor(absoluteDegree / scaleLen);
  const degreeInOctave = absoluteDegree % scaleLen;

  let semitonesFromDegree0 = 0;
  for (let i = 0; i < degreeInOctave; i++) {
    semitonesFromDegree0 += rotatedEE[i];
  }

  semitonesFromDegree0 += octave * 12;
  return 60 + degree0Semi + semitonesFromDegree0;
}

// ========== DEGREE INTERVAL CONVERSION ==========

function degreeIntervalsToAbsoluteDegrees(intervals) {
  const degrees = [];
  let currentDegree = BASE_DEGREE;
  const sortedIntervals = [...intervals].sort((a, b) => a.pulse - b.pulse);

  sortedIntervals.forEach((interval) => {
    if (interval.isRest) {
      degrees.push({ degree: null, pulse: interval.pulse, isRest: true });
    } else {
      currentDegree += interval.degreeInterval;
      degrees.push({ degree: currentDegree, pulse: interval.pulse, isRest: false });
    }
  });

  return degrees;
}

function absoluteDegreesToIntervals(absoluteDegrees) {
  const intervals = [];
  let prevDegree = BASE_DEGREE;
  const sorted = [...absoluteDegrees].sort((a, b) => a.pulse - b.pulse);

  if (sorted.length === 0) return intervals;

  const firstPulse = sorted[0].pulse;
  const lastPulse = sorted[sorted.length - 1].pulse;

  const pulseMap = new Map();
  sorted.forEach(entry => pulseMap.set(entry.pulse, entry));

  for (let pulse = firstPulse; pulse <= lastPulse; pulse++) {
    const entry = pulseMap.get(pulse);
    if (entry) {
      if (entry.isRest || entry.degree === null) {
        intervals.push({ degreeInterval: null, pulse, isRest: true });
      } else {
        intervals.push({ degreeInterval: entry.degree - prevDegree, pulse, isRest: false });
        prevDegree = entry.degree;
      }
    } else {
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

function createDegreeIntervalLine(degree1, degree2, pulseIndex, intervalIndex = 0) {
  if (!musicalGrid) return;

  const matrixContainer = musicalGrid.getMatrixContainer?.();
  if (!matrixContainer) return;

  const degreeInterval = degree2 - degree1;
  const absInterval = Math.abs(degreeInterval);
  const isAscending = degreeInterval > 0;

  const note1 = absoluteDegreeToVisualNoteIndex(degree1);
  const note2 = absoluteDegreeToVisualNoteIndex(degree2);

  if (note1 === null || note2 === null) return;

  const leftPosPercent = (pulseIndex / TOTAL_SPACES) * 100;
  const cellHeightPercent = 100 / TOTAL_NOTES;

  if (absInterval === 0) {
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

  const rowIndex1 = TOTAL_NOTES - 1 - note1;
  const rowIndex2 = TOTAL_NOTES - 1 - note2;

  let topEdgePercent, bottomEdgePercent;
  if (isAscending) {
    topEdgePercent = ((rowIndex2 + 1) / TOTAL_NOTES) * 100;
    bottomEdgePercent = ((rowIndex1 + 1) / TOTAL_NOTES) * 100;
  } else {
    topEdgePercent = ((rowIndex1 + 1) / TOTAL_NOTES) * 100;
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
  intervalBar.style.top = `calc(${Math.min(topEdgePercent, bottomEdgePercent)}% + 6px)`;
  intervalBar.style.height = `calc(${heightPercent}% - 12px)`;
  intervalBar.style.zIndex = '15';
  matrixContainer.appendChild(intervalBar);
  currentIntervalElements.push(intervalBar);

  const displayValue = degreeInterval > 0 ? `+${absInterval}` : `-${absInterval}`;
  const centerYPercent = (topEdgePercent + bottomEdgePercent) / 2;

  const intervalNum = document.createElement('div');
  intervalNum.className = 'interval-number';
  intervalNum.textContent = displayValue;
  intervalNum.style.position = 'absolute';
  intervalNum.style.zIndex = '16';

  const isFirstInterval = intervalIndex === 0;
  if (absInterval <= 1 || isFirstInterval) {
    intervalNum.style.top = `${centerYPercent}%`;
    intervalNum.style.left = `calc(${leftPosPercent}% + 12px)`;
    intervalNum.style.transform = 'translateY(-50%)';
  } else if (isAscending) {
    intervalNum.style.top = `${centerYPercent}%`;
    intervalNum.style.left = `calc(${leftPosPercent}% - 12px)`;
    intervalNum.style.transform = 'translate(-100%, -50%)';
  } else {
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

  clearIntervalLines();
  musicalGrid.clear();
  document.querySelectorAll('.musical-cell.rest').forEach(el => el.classList.remove('rest'));
  document.querySelectorAll('.musical-cell .cell-label').forEach(el => el.remove());

  const sorted = [...absoluteDegrees].sort((a, b) => a.pulse - b.pulse);
  const validDegrees = [];
  let lastNoteIndex = 0;

  sorted.forEach(({ degree, pulse, isRest }) => {
    if (isRest) {
      const cell = musicalGrid.getCellElement(lastNoteIndex, pulse);
      if (cell) cell.classList.add('rest');
      return;
    }
    if (degree === null) return;

    const noteIndex = absoluteDegreeToVisualNoteIndex(degree);
    if (noteIndex === null || noteIndex < 0 || noteIndex >= TOTAL_NOTES) return;

    lastNoteIndex = noteIndex;
    validDegrees.push({ degree, pulse });

    const cell = musicalGrid.getCellElement(noteIndex, pulse);
    if (cell) {
      cell.classList.add('active');

      const degreeInOctave = degree % currentScaleLength;
      const label = document.createElement('span');
      label.className = 'cell-label';
      label.textContent = String(degreeInOctave);
      cell.appendChild(label);
    }
  });

  let prevDegree = BASE_DEGREE;
  validDegrees.forEach(({ degree, pulse }, idx) => {
    createDegreeIntervalLine(prevDegree, degree, pulse, idx);
    prevDegree = degree;
  });
}

// ========== BIDIRECTIONAL: Grid2D -> iSº Editor ==========

function handleGridCellClick(noteIndex, pulseIndex) {
  if (!gridEditor) return;

  const clickedDegree = visualNoteIndexToAbsoluteDegree(noteIndex);
  if (clickedDegree === null) return;

  lostDegreesMemory.delete(pulseIndex);

  const currentIntervals = gridEditor.getPairs();
  const absoluteDegrees = degreeIntervalsToAbsoluteDegrees(currentIntervals);

  const existingIdx = absoluteDegrees.findIndex(d => d.pulse === pulseIndex && !d.isRest);

  if (existingIdx !== -1) {
    const existing = absoluteDegrees[existingIdx];
    const existingNoteIndex = absoluteDegreeToVisualNoteIndex(existing.degree);
    if (existingNoteIndex === noteIndex) {
      absoluteDegrees[existingIdx] = { degree: null, pulse: pulseIndex, isRest: true };
    } else {
      absoluteDegrees[existingIdx] = { degree: clickedDegree, pulse: pulseIndex, isRest: false };
    }
  } else {
    const pulseIdx = absoluteDegrees.findIndex(d => d.pulse === pulseIndex);
    if (pulseIdx !== -1) {
      absoluteDegrees[pulseIdx] = { degree: clickedDegree, pulse: pulseIndex, isRest: false };
    } else {
      absoluteDegrees.push({ degree: clickedDegree, pulse: pulseIndex, isRest: false });
      absoluteDegrees.sort((a, b) => a.pulse - b.pulse);
    }
  }

  const newIntervals = absoluteDegreesToIntervals(absoluteDegrees);
  currentDegreeIntervals = newIntervals;
  gridEditor.setPairs(newIntervals);
  syncGridFromDegreeIntervals(absoluteDegrees);
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
  const isInstrumentLoaded = currentInstrument === 'flute' ? isFluteLoaded() : isPianoLoaded();

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

  const absoluteDegrees = degreeIntervalsToAbsoluteDegrees(currentDegreeIntervals);

  isPlaying = true;
  if (randomBtn) randomBtn.disabled = true;

  if (playIcon && stopIcon) {
    playIcon.style.display = 'none';
    stopIcon.style.display = 'block';
  }

  const intervalSec = (60 / currentBPM);

  audio.registerNoteProvider('melody', (step) => {
    const degreeData = absoluteDegrees.find(d => d.pulse === step);
    if (degreeData && !degreeData.isRest && degreeData.degree !== null) {
      const midi = absoluteDegreeToMidi(degreeData.degree);
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
      highlightController?.highlightPulse(step);

      const degreeData = absoluteDegrees.find(d => d.pulse === step);
      if (degreeData && !degreeData.isRest && degreeData.degree !== null) {
        const duration = intervalSec * 0.9;
        const noteIndex = absoluteDegreeToVisualNoteIndex(degreeData.degree);
        const cell = musicalGrid?.getCellElement?.(noteIndex, step);
        if (cell) {
          cell.classList.add('playing');
          setTimeout(() => cell.classList.remove('playing'), duration * 1000);
        }
      }

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
    setTimeout(() => { audio?.stop(); }, delayMs);
  } else {
    audio?.stop();
  }

  highlightController?.clearHighlights();
  document.querySelectorAll('.musical-cell.playing').forEach(cell => cell.classList.remove('playing'));

  const playIcon = playBtn?.querySelector('.icon-play');
  const stopIcon = playBtn?.querySelector('.icon-stop');
  if (playIcon && stopIcon) {
    playIcon.style.display = 'block';
    stopIcon.style.display = 'none';
  }
}

function scrollToNoteIfNeeded(noteIndex) {
  if (noteIndex === null || noteIndex === undefined) return;

  const matrixContainer = musicalGrid?.getMatrixContainer?.();
  if (!matrixContainer) return;
  if (matrixContainer.scrollHeight <= matrixContainer.clientHeight) return;

  const cellHeight = matrixContainer.scrollHeight / TOTAL_NOTES;
  const rowIndex = TOTAL_NOTES - 1 - noteIndex;
  const visibleHeight = matrixContainer.clientHeight;
  const targetScroll = (rowIndex * cellHeight) - (visibleHeight / 2) + (cellHeight / 2);
  const maxScroll = matrixContainer.scrollHeight - visibleHeight;
  const clampedScroll = Math.max(0, Math.min(targetScroll, maxScroll));

  const currentScroll = matrixContainer.scrollTop;
  const scrollDistance = Math.abs(clampedScroll - currentScroll);
  const threshold = visibleHeight * 0.5;
  const behavior = scrollDistance > threshold ? 'auto' : 'smooth';
  matrixContainer.scrollTo({ top: clampedScroll, behavior });
}

// ========== RESET ==========

function handleReset() {
  if (isPlaying) stopPlayback();

  gridEditor?.clear();
  clearIntervalLines();
  musicalGrid?.clear();

  // musicalGrid.clear() only strips .active/.highlight. Remove the App25B-
  // specific .rest silence markers and any .cell-label spans that
  // syncGridFromDegreeIntervals added.
  document.querySelectorAll('.musical-cell.rest').forEach(cell => {
    cell.classList.remove('rest');
  });
  document.querySelectorAll('.musical-cell .cell-label').forEach(el => el.remove());

  currentDegreeIntervals = [];
  lostDegreesMemory.clear();
}

// ========== RANDOM GENERATION ==========

function handleRandom() {
  if (isPlaying) return;

  const randomScaleIndex = Math.floor(Math.random() * APP25_SCALES.length);
  const randomScale = APP25_SCALES[randomScaleIndex];

  const escalaSelect = document.getElementById('escalaSelect');
  if (escalaSelect) escalaSelect.value = randomScale.value;
  handleScaleChange({ scaleId: randomScale.id, rotation: randomScale.rotation, value: randomScale.value });

  const randDensity = parseInt(document.getElementById('randDensity')?.value || 8, 10);
  const newScaleLength = motherScalesData[randomScale.id]?.ee?.length || 7;
  const numIntervals = Math.max(1, Math.min(randDensity, TOTAL_SPACES));

  const maxAbsoluteDegree = getMaxAbsoluteDegree();
  let accumulatedDegree = BASE_DEGREE;
  const intervals = [];

  for (let pulse = 0; pulse < TOTAL_SPACES; pulse++) {
    if (pulse < numIntervals) {
      const minAllowed = -accumulatedDegree;
      const maxAllowed = maxAbsoluteDegree - accumulatedDegree;
      const maxInterval = newScaleLength - 1;
      const minInterval = Math.max(-maxInterval, minAllowed);
      const maxIntervalClamped = Math.min(maxInterval, maxAllowed);

      let randomInterval;
      if (minInterval <= maxIntervalClamped) {
        randomInterval = Math.floor(Math.random() * (maxIntervalClamped - minInterval + 1)) + minInterval;
      } else {
        randomInterval = 0;
      }

      intervals.push({ degreeInterval: randomInterval, pulse, isRest: false });
      accumulatedDegree += randomInterval;
    } else {
      intervals.push({ degreeInterval: null, pulse, isRest: true });
    }
  }

  currentDegreeIntervals = intervals;
  gridEditor?.setPairs(intervals);

  const absoluteDegrees = degreeIntervalsToAbsoluteDegrees(intervals);
  syncGridFromDegreeIntervals(absoluteDegrees);

  // Auto-play after randomizing (consistent across apps 9+).
  if (!isPlaying) handlePlay();
}

// ========== SCALE CHANGE HANDLERS ==========

function updateGridCellStates() {
  if (!musicalGrid) return;
  const scaleSemitones = getVisualScaleSemitones();
  if (musicalGrid.setEnabledNotes) musicalGrid.setEnabledNotes(scaleSemitones);
  updateSoundlineLabels();
}

function updateSoundlineLabels() {
  if (!musicalGrid) return;
  const scaleSemitones = getVisualScaleSemitones();

  if (musicalGrid.updateSoundlineLabels) {
    musicalGrid.updateSoundlineLabels(scaleSemitones, (noteIndex) => {
      const semitoneInOctave = noteIndex % 12;
      const visualState = { id: scaleState.id, rot: scaleState.rot, root: currentRootOffset };
      for (let d = 0; d < currentScaleLength; d++) {
        if (degToSemi(visualState, d) === semitoneInOctave) {
          return String(d);
        }
      }
      return '·';
    });
  }
}

function handleScaleChange({ scaleId, rotation, value }) {
  const oldScaleLength = currentScaleLength;

  scaleState.id = scaleId;
  scaleState.rot = rotation;

  const scaleConfig = APP25_SCALES.find(s => s.value === value);
  currentRootOffset = scaleConfig?.rootOffset || 0;
  currentScaleLength = motherScalesData[scaleId]?.ee?.length || 7;

  updateGridCellStates();

  const absoluteDegrees = degreeIntervalsToAbsoluteDegrees(currentDegreeIntervals);
  const adaptedDegrees = [];

  for (const entry of absoluteDegrees) {
    const pulse = entry.pulse;

    if (entry.isRest) {
      const memorized = lostDegreesMemory.get(pulse);
      if (memorized && memorized.degInOctave < currentScaleLength) {
        adaptedDegrees.push({ degree: memorized.degree, pulse, isRest: false });
        lostDegreesMemory.delete(pulse);
      } else {
        adaptedDegrees.push(entry);
      }
      continue;
    }

    const degInOctave = entry.degree % oldScaleLength;
    if (degInOctave < currentScaleLength) {
      adaptedDegrees.push(entry);
      continue;
    }

    lostDegreesMemory.set(pulse, { degree: entry.degree, degInOctave });
    adaptedDegrees.push({ degree: null, pulse, isRest: true });
  }

  currentDegreeIntervals = absoluteDegreesToIntervals(adaptedDegrees);
  gridEditor?.setPairs(currentDegreeIntervals);
  syncGridFromDegreeIntervals(adaptedDegrees);
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
 * MIDI disparats per `degreeToMidi()` via `scaleState.root`. Igual que a
 * App25.
 */
function handleTransposeChange(value) {
  scaleState.root = clampOutputNote(value);
  // Persistim per a sessions futures (patró JSON: load → spread → save).
  const currentPrefs = preferenceStorage.load() || {};
  currentPrefs.outputNote = scaleState.root;
  preferenceStorage.save(currentPrefs);
}

// ========== NUZIC iSº EDITOR (single row) ==========

function initIntervalEditor() {
  const container = gridEditorContainer;
  if (!container) return;
  container.innerHTML = '';

  // Label
  const label = document.createElement('div');
  label.className = 'interval-editor-label';
  label.textContent = 'iSº';

  // Cells container
  const cellsContainer = document.createElement('div');
  cellsContainer.className = 'interval-editor-cells';

  // End marker
  const endMarker = document.createElement('div');
  endMarker.className = 'interval-editor-end';
  endMarker.style.display = 'none';
  cellsContainer.appendChild(endMarker);

  container.appendChild(label);
  container.appendChild(cellsContainer);

  // State: entries[pulse] = { degreeInterval, pulse, isRest } (ordered by pulse)
  let entries = [];
  let autoJumpTimer = null;

  function showError(cell, message) {
    infoTooltip.show(message, cell);
  }

  function formatInterval(entry) {
    if (entry.isRest) return 's';
    const v = entry.degreeInterval;
    if (v > 0) return `+${v}`;
    if (v < 0) return `${v}`;
    return '0';
  }

  // Parse (matches legacy): "s" → rest, "+N"/"-N"/"N" → signed interval.
  // Aliases for convenience: ".", "r", "·" also mean rest.
  function parseIntervalInput(val) {
    const trimmed = val.trim().toLowerCase();
    if (trimmed === 's' || trimmed === '.' || trimmed === 'r' || trimmed === '·') {
      return { isRest: true };
    }
    const signed = trimmed.match(/^([+-])(\d+)$/);
    if (signed) {
      const sign = signed[1] === '+' ? 1 : -1;
      return { degreeInterval: sign * parseInt(signed[2], 10), isRest: false };
    }
    const unsigned = trimmed.match(/^(\d+)$/);
    if (unsigned) {
      return { degreeInterval: parseInt(unsigned[1], 10), isRest: false };
    }
    return null;
  }

  // Validate change at entryIndex — cascade check across all entries.
  // Returns { valid, message } with legacy error messages.
  // entryIndex === null → appending a new entry at entries.length.
  function validateIntervalChange(parsed, entryIndex) {
    if (parsed.isRest) return { valid: true };

    const maxDeg = getMaxAbsoluteDegree();
    const isNew = entryIndex === null || entryIndex >= entries.length;
    const projected = entries.map((e, i) => (i === entryIndex ? parsed : e));
    if (isNew) projected.push(parsed);

    let acc = BASE_DEGREE;
    for (const e of projected) {
      if (!e.isRest && typeof e.degreeInterval === 'number') {
        acc += e.degreeInterval;
        if (acc < 0) {
          return { valid: false, message: `Grado resultante ${acc} es negativo` };
        }
        if (acc > maxDeg) {
          return { valid: false, message: `Grado ${acc} excede el rango (máx: ${maxDeg})` };
        }
      }
    }
    return { valid: true };
  }

  function createReadonlyCell(isRest = false) {
    const cell = document.createElement('input');
    cell.type = 'text';
    cell.className = 'interval-editor-cell';
    if (isRest) {
      cell.classList.add('is-rest');
    }
    cell.placeholder = ' ';
    cell.readOnly = true;
    cell.tabIndex = -1;
    return cell;
  }

  function createValueCell(entry, entryIndex) {
    const cell = document.createElement('input');
    cell.type = 'text';
    cell.maxLength = 4;
    cell.className = 'interval-editor-cell';
    cell.value = formatInterval(entry);
    cell.dataset.entryIndex = entryIndex;
    cell.readOnly = false;
    cell.style.cursor = 'text';

    let originalValue = cell.value;

    cell.addEventListener('focus', () => { originalValue = cell.value; cell.select(); });

    cell.addEventListener('blur', () => {
      const val = cell.value.trim();
      if (!val || val === originalValue) { cell.value = originalValue; return; }

      const idx = parseInt(cell.dataset.entryIndex);
      const parsed = parseIntervalInput(val);
      if (!parsed) {
        showError(cell, 'iSº: usa ±N (ej: +2, -1, 0) o s para silencio');
        cell.value = originalValue;
        return;
      }

      const validation = validateIntervalChange(parsed, idx);
      if (!validation.valid) {
        showError(cell, validation.message);
        cell.value = originalValue;
        return;
      }

      if (parsed.isRest) {
        entries[idx] = { degreeInterval: null, pulse: idx, isRest: true };
      } else {
        entries[idx] = { degreeInterval: parsed.degreeInterval, pulse: idx, isRest: false };
      }
      notifyChange();
      renderCells();
    });

    cell.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); cell.blur(); return; }
      if (e.key === 'Tab') {
        e.preventDefault();
        cell.blur();
        const allCells = Array.from(cellsContainer.querySelectorAll('.interval-editor-cell:not([readonly])'));
        const idx = allCells.indexOf(cell);
        const next = e.shiftKey ? allCells[idx - 1] : allCells[idx + 1];
        if (next) next.focus();
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        // Only jump between cells when caret is at the edge — otherwise let
        // arrows move the caret within the text (useful for editing "-12" etc.)
        const atStart = cell.selectionStart === 0 && cell.selectionEnd === 0;
        const atEnd = cell.selectionStart === cell.value.length && cell.selectionEnd === cell.value.length;
        if (e.key === 'ArrowLeft' && !atStart) return;
        if (e.key === 'ArrowRight' && !atEnd) return;

        const allCells = Array.from(cellsContainer.querySelectorAll('.interval-editor-cell:not([readonly])'));
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
    cell.maxLength = 4;
    cell.className = 'interval-editor-cell active-input';
    cell.readOnly = false;

    cell.addEventListener('input', (e) => {
      const val = e.target.value;
      if (val === '') { clearTimeout(autoJumpTimer); return; }

      const trimmed = val.trim().toLowerCase();

      // Rest: single character 's' (legacy) or convenience aliases "·", ".", "r"
      if (/^[s.r·]$/.test(trimmed)) {
        clearTimeout(autoJumpTimer);
        commitInterval({ isRest: true });
        return;
      }

      // Partial: only sign, wait for digits
      if (/^[+-]$/.test(trimmed)) {
        clearTimeout(autoJumpTimer);
        return;
      }

      // Complete number (signed or unsigned): schedule validation after AUTO_JUMP delay
      if (/^[+-]?\d+$/.test(trimmed)) {
        clearTimeout(autoJumpTimer);
        autoJumpTimer = setTimeout(() => {
          const current = cell.value.trim();
          const p = parseIntervalInput(current);
          if (!p) { cell.value = ''; return; }
          const validation = validateIntervalChange(p, null);
          if (!validation.valid) {
            showError(cell, validation.message);
            cell.value = '';
            return;
          }
          commitInterval(p);
        }, 500);
        return;
      }

      // Any other input is invalid — clear
      e.target.value = '';
      clearTimeout(autoJumpTimer);
    });

    cell.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        clearTimeout(autoJumpTimer);
        const val = cell.value.trim();
        if (val) {
          const parsed = parseIntervalInput(val);
          if (!parsed) {
            showError(cell, 'iSº: usa ±N (ej: +2, -1, 0) o s para silencio');
            cell.value = '';
            return;
          }
          const validation = validateIntervalChange(parsed, null);
          if (!validation.valid) {
            showError(cell, validation.message);
            cell.value = '';
            return;
          }
          commitInterval(parsed);
        }
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        // Only navigate when caret is at the edge (or input is empty).
        // Otherwise let the arrow move the caret within the text.
        const atStart = cell.selectionStart === 0 && cell.selectionEnd === 0;
        const atEnd = cell.selectionStart === cell.value.length && cell.selectionEnd === cell.value.length;
        if (e.key === 'ArrowLeft' && !atStart) return;
        if (e.key === 'ArrowRight' && !atEnd) return;

        clearTimeout(autoJumpTimer);
        cell.value = '';
        const allCells = Array.from(cellsContainer.querySelectorAll('.interval-editor-cell:not([readonly])'));
        const idx = allCells.indexOf(cell);
        const next = e.key === 'ArrowRight' ? allCells[idx + 1] : allCells[idx - 1];
        if (next) { e.preventDefault(); next.focus(); }
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

  function commitInterval(parsed) {
    const pulse = entries.length;
    if (pulse >= TOTAL_SPACES) return;

    if (parsed.isRest) {
      entries.push({ degreeInterval: null, pulse, isRest: true });
    } else {
      entries.push({ degreeInterval: parsed.degreeInterval, pulse, isRest: false });
    }
    lostDegreesMemory.delete(pulse);
    notifyChange();
    renderCells();
  }

  function notifyChange() {
    // Re-index pulses and sync
    const reindexed = entries.map((e, i) => ({ ...e, pulse: i }));
    currentDegreeIntervals = reindexed;
    const absoluteDegrees = degreeIntervalsToAbsoluteDegrees(reindexed);
    syncGridFromDegreeIntervals(absoluteDegrees);
  }

  function renderCells() {
    cellsContainer.querySelectorAll('.interval-editor-cell').forEach(c => c.remove());

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      cellsContainer.insertBefore(createValueCell(entry, i), endMarker);
      cellsContainer.insertBefore(createReadonlyCell(entry.isRest), endMarker);
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
      entries = (pairs || []).map((p, i) => ({
        degreeInterval: p.degreeInterval ?? null,
        pulse: i,
        isRest: !!p.isRest
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

  // Save controls BEFORE clearing (detach to preserve references)
  const controls = timelineWrapper.querySelector('.controls');
  if (controls) controls.remove();

  timelineWrapper.innerHTML = '';
  timelineWrapper._savedControls = controls;

  return timelineWrapper;
}

// ========== INITIALIZATION ==========

async function init() {
  const gridWrapper = injectLayout();
  if (!gridWrapper) {
    console.error('Failed to create layout');
    return;
  }

  const prefs = preferenceStorage.load() || {};

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

  // Initial transposition (scaleState.root) from preferences. Igual que
  // App25: la pastilla Transposición només mou la nota MIDI que sona al
  // grau 0; el visual no es rota (grau 0 sempre a baix de la soundline).
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
    scrollEnabled: false,
    showIntervals: { horizontal: true, vertical: false },
    intervalColor: '#4A9EFF',
    noteFormatter: (noteIndex) => {
      const semitoneInOctave = noteIndex % 12;
      const visualState = { id: scaleState.id, rot: scaleState.rot, root: currentRootOffset };
      for (let d = 0; d < currentScaleLength; d++) {
        if (degToSemi(visualState, d) === semitoneInOctave) {
          return String(d);
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
      if (!scaleSems.includes(noteIndex)) return;

      const absoluteDegree = visualNoteIndexToAbsoluteDegree(noteIndex);
      const midi = absoluteDegreeToMidi(absoluteDegree);
      if (midi === null) return;

      const duration = (60 / currentBPM) * 0.9;
      const Tone = window.Tone;
      audioInstance.playNote(midi, duration, Tone.now());

      handleGridCellClick(noteIndex, pulseIndex);
    }
  });

  // Initial cell states
  updateGridCellStates();

  // Add missing bottom soundline division below note 0
  const soundlineInner = gridWrapper.querySelector('.soundline-inner') ||
                         gridWrapper.querySelector('.soundline-wrapper');
  if (soundlineInner) {
    const bottomDiv = document.createElement('div');
    bottomDiv.className = 'soundline-division';
    bottomDiv.style.top = `${((TOTAL_NOTES + 0.5) / (TOTAL_NOTES + 1)) * 100}%`;
    soundlineInner.appendChild(bottomDiv);
  }

  // Create iSº editor INSIDE .grid-container (as grid-row 3) — same as App25
  const gridContainer = gridWrapper.querySelector('.grid-container');
  gridEditorContainer = document.createElement('div');
  gridEditorContainer.className = 'interval-editor';
  gridEditorContainer.id = 'intervalEditor';
  if (gridContainer) {
    gridContainer.appendChild(gridEditorContainer);
  } else {
    gridWrapper.appendChild(gridEditorContainer);
  }

  // Restore saved controls (Play, BPM, Random, Reset)
  const savedControls = gridWrapper._savedControls;
  if (savedControls) {
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

  // Initialize the iSº editor
  initIntervalEditor();

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
    const instrumentLabel = initialInstrument === 'flute' ? 'Flauta' : 'Piano';
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

  // Instrument dropdown
  window.addEventListener('sharedui:instrument', async (e) => {
    const instrument = e.detail.instrument;
    await initAudio();
    await audio.setInstrument(instrument);
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
      localStorage.removeItem('app25b:p1Toggle');
      localStorage.removeItem('app25b:pulseAudio');
      localStorage.removeItem('app25b-mixer');
      const randDensity = document.getElementById('randDensity');
      if (randDensity) randDensity.value = '8';
    }
  });

  // Preload piano samples
  setupPianoPreload({ delay: 300 });

  // Idle caret flash on editor container
  initIdleCaretFlash({ targets: [gridEditorContainer] });
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
