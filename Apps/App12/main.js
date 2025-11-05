// App12: Plano-Sucesión - 2D Step Sequencer with dual N+P sequences
// Uses matrix-seq module for coordinated note/pulse selection

import { createSoundline } from '../../libs/app-common/soundline.js';
import { createMusicalPlane } from '../../libs/app-common/musical-plane.js';
import { createTimelineHorizontalAxis } from '../../libs/app-common/plane-adapters.js';
import { loadPiano } from '../../libs/sound/piano.js';
import { registerFactoryReset, createPreferenceStorage } from '../../libs/app-common/preferences.js';
import { ensureToneLoaded } from '../../libs/sound/tone-loader.js';
import { createMatrixSeqController } from '../../libs/matrix-seq/index.js';
import { createTapTempoHandler } from '../../libs/app-common/tap-tempo-handler.js';
import { initMixerMenu } from '../../libs/app-common/mixer-menu.js';

// ========== CONFIGURATION ==========
const TOTAL_PULSES = 9;   // Horizontal: 0-8
const TOTAL_NOTES = 12;   // Vertical: 0-11 (MIDI 60-71)
const TOTAL_SPACES = 8;   // Spaces between pulses: 0-7
const DEFAULT_BPM = 120;

// ========== STATE ==========
let piano = null;
let soundline = null;
let timeline = null;
let musicalPlane = null;
let matrixSeq = null;
let currentBPM = DEFAULT_BPM;
let isPlaying = false;

// Elements
let playBtn = null;
let resetBtn = null;
let tapBtn = null;
let randomBtn = null;
let bpmDisplay = null;
let noteSeqWrapper = null;
let pulseSeqWrapper = null;
let planeWrapper = null;

// Storage de preferencias
const preferenceStorage = createPreferenceStorage('app12');

// ========== AUDIO INITIALIZATION ==========

async function initPiano() {
  if (!piano) {
    console.log('Ensuring Tone.js is loaded...');
    await ensureToneLoaded();
    console.log('Loading piano...');
    piano = await loadPiano();
    console.log('Piano loaded successfully');
  }
  return piano;
}

// ========== VISUAL FEEDBACK ==========

function highlightNoteOnSoundline(noteIndex, durationMs) {
  const rect = document.createElement('div');
  rect.className = 'soundline-highlight';

  const noteElement = document.querySelector(`[data-note-index="${noteIndex}"]`);
  if (!noteElement) return;

  const bounds = noteElement.getBoundingClientRect();
  const soundlineEl = document.querySelector('.soundline-wrapper');
  const soundlineBounds = soundlineEl.getBoundingClientRect();

  rect.style.position = 'absolute';
  rect.style.top = `${bounds.top - soundlineBounds.top}px`;
  rect.style.left = '0';
  rect.style.width = '100%';
  rect.style.height = `${bounds.height}px`;
  rect.style.backgroundColor = 'rgba(255, 255, 0, 0.3)';
  rect.style.pointerEvents = 'none';
  rect.style.zIndex = '10';

  soundlineEl.appendChild(rect);

  setTimeout(() => {
    rect.remove();
  }, durationMs);
}

// ========== CELL FACTORY ==========

function createToggleCellFactory() {
  const cellStates = new Map();

  return {
    createCell: (noteIndex, pulseIndex) => {
      const cell = document.createElement('div');
      cell.className = 'matrix-cell';
      cell.dataset.note = noteIndex;
      cell.dataset.pulse = pulseIndex;

      // Texto overlay
      const label = document.createElement('span');
      label.className = 'cell-label';
      label.textContent = `N${noteIndex} P${pulseIndex}`;
      cell.appendChild(label);

      // State key
      const key = `${noteIndex}-${pulseIndex}`;
      cellStates.set(key, false);

      // Click handler
      cell.addEventListener('click', () => {
        const isActive = cellStates.get(key);

        if (isActive) {
          matrixSeq.removePair(noteIndex, pulseIndex);
          cell.classList.remove('active');
          cellStates.set(key, false);
        } else {
          matrixSeq.addPair(noteIndex, pulseIndex);
          cell.classList.add('active');
          cellStates.set(key, true);
        }
      });

      return cell;
    },

    getCellState: (noteIndex, pulseIndex) => {
      const key = `${noteIndex}-${pulseIndex}`;
      return cellStates.get(key) || false;
    },

    setCellState: (noteIndex, pulseIndex, isActive) => {
      const key = `${noteIndex}-${pulseIndex}`;
      cellStates.set(key, isActive);

      const cell = document.querySelector(`[data-note="${noteIndex}"][data-pulse="${pulseIndex}"]`);
      if (cell) {
        if (isActive) {
          cell.classList.add('active');
        } else {
          cell.classList.remove('active');
        }
      }
    },

    clearAll: () => {
      cellStates.clear();
      document.querySelectorAll('.matrix-cell.active').forEach(cell => {
        cell.classList.remove('active');
      });
    }
  };
}

// ========== PLAYBACK ==========

async function handlePlay() {
  if (isPlaying) return;

  // Ensure piano is loaded
  await initPiano();

  const pairs = matrixSeq.getPairs();
  if (pairs.length === 0) {
    console.warn('No pairs selected');
    return;
  }

  isPlaying = true;
  playBtn.disabled = true;
  playBtn.textContent = 'Playing...';

  const Tone = window.Tone;
  const intervalMs = (60 / currentBPM) * 1000;
  const startTime = Tone.now();

  pairs.forEach((pair, idx) => {
    const { note, pulse } = pair;
    const midi = 60 + note; // C4 = MIDI 60
    const toneNote = Tone.Frequency(midi, 'midi').toNote();
    const when = startTime + (idx * intervalMs / 1000);
    const duration = intervalMs * 0.9 / 1000;

    // Schedule audio
    piano.triggerAttackRelease(toneNote, duration, when);

    // Schedule visual feedback
    setTimeout(() => {
      const cell = document.querySelector(`[data-note="${note}"][data-pulse="${pulse}"]`);
      if (cell) {
        cell.classList.add('playing');
        setTimeout(() => cell.classList.remove('playing'), duration * 1000);
      }

      highlightNoteOnSoundline(note, duration * 1000);
    }, idx * intervalMs);
  });

  // Reset after completion
  setTimeout(() => {
    isPlaying = false;
    playBtn.disabled = false;
    playBtn.textContent = 'Play';
  }, pairs.length * intervalMs + 500);
}

// ========== RESET ==========

function handleReset() {
  // Clear selections
  matrixSeq.clear();
  cellFactory.clearAll();

  // Reset BPM
  currentBPM = DEFAULT_BPM;
  updateBPMDisplay();

  // Reset audio if playing
  if (isPlaying) {
    window.Tone?.Transport?.stop();
    isPlaying = false;
    playBtn.disabled = false;
    playBtn.textContent = 'Play';
  }

  console.log('Reset to default state');
}

// ========== RANDOM GENERATION ==========

function handleRandom() {
  // Get parameters from random menu
  const randVMin = parseInt(document.getElementById('randVMin')?.value || 60, 10);
  const randVMax = parseInt(document.getElementById('randVMax')?.value || 240, 10);
  const randPMax = parseInt(document.getElementById('randPMax')?.value || 7, 10);
  const randNMax = parseInt(document.getElementById('randNMax')?.value || 11, 10);

  // Generate random BPM
  currentBPM = Math.floor(Math.random() * (randVMax - randVMin + 1)) + randVMin;
  updateBPMDisplay();

  // Generate random number of pairs (1 to randPMax)
  const numPairs = Math.floor(Math.random() * randPMax) + 1;
  const pairs = [];

  for (let i = 0; i < numPairs; i++) {
    const note = Math.floor(Math.random() * (randNMax + 1));
    const pulse = i; // Sequential pulses
    pairs.push({ note, pulse });
  }

  // Set pairs
  matrixSeq.setPairs(pairs);

  // Update visual grid
  syncGridFromPairs(pairs);

  console.log('Random generation:', { bpm: currentBPM, pairs });
}

// ========== SYNCHRONIZATION ==========

function syncGridFromPairs(pairs) {
  // Clear all cells first
  cellFactory.clearAll();

  // Activate cells for each pair
  pairs.forEach(({ note, pulse }) => {
    cellFactory.setCellState(note, pulse, true);
  });
}

// ========== BPM DISPLAY ==========

function updateBPMDisplay() {
  if (bpmDisplay) {
    bpmDisplay.textContent = `${currentBPM} BPM`;
  }
}

// ========== DOM INJECTION ==========

function injectSequenceInputs() {
  // Create wrapper for sequences
  const sequencesContainer = document.createElement('div');
  sequencesContainer.className = 'sequences-container';

  // Note sequence
  noteSeqWrapper = document.createElement('div');
  noteSeqWrapper.className = 'seq-wrapper note-seq-wrapper';
  noteSeqWrapper.id = 'noteSeqWrapper';

  const noteSeqInput = document.createElement('div');
  noteSeqInput.className = 'seq-input';
  noteSeqInput.id = 'noteSeqInput';

  noteSeqWrapper.appendChild(noteSeqInput);

  // Pulse sequence
  pulseSeqWrapper = document.createElement('div');
  pulseSeqWrapper.className = 'seq-wrapper pulse-seq-wrapper';
  pulseSeqWrapper.id = 'pulseSeqWrapper';

  const pulseSeqInput = document.createElement('div');
  pulseSeqInput.className = 'seq-input';
  pulseSeqInput.id = 'pulseSeqInput';

  pulseSeqWrapper.appendChild(pulseSeqInput);

  // Add to container
  sequencesContainer.appendChild(noteSeqWrapper);
  sequencesContainer.appendChild(pulseSeqWrapper);

  // Inject into app-root
  const appRoot = document.getElementById('app-root');
  if (appRoot) {
    appRoot.appendChild(sequencesContainer);
  }
}

function createPlaneWrapper() {
  const wrapper = document.createElement('div');
  wrapper.className = 'plane-wrapper';
  const appRoot = document.getElementById('app-root');
  if (appRoot) {
    appRoot.appendChild(wrapper);
  }
  return wrapper;
}

function injectControlButtons() {
  // Find header controls
  const headerControls = document.querySelector('.header-controls');
  if (!headerControls) return;

  // Play button (should already exist)
  playBtn = document.getElementById('playBtn');
  if (!playBtn) {
    playBtn = document.createElement('button');
    playBtn.id = 'playBtn';
    playBtn.className = 'btn';
    playBtn.textContent = 'Play';
    headerControls.appendChild(playBtn);
  }

  // Reset button
  resetBtn = document.createElement('button');
  resetBtn.id = 'resetBtn';
  resetBtn.className = 'btn';
  resetBtn.textContent = 'Reset';
  headerControls.appendChild(resetBtn);

  // Tap button
  tapBtn = document.createElement('button');
  tapBtn.id = 'tapBtn';
  tapBtn.className = 'btn';
  tapBtn.textContent = 'Tap';
  headerControls.appendChild(tapBtn);

  // BPM display
  bpmDisplay = document.createElement('span');
  bpmDisplay.id = 'bpmDisplay';
  bpmDisplay.className = 'bpm-display';
  bpmDisplay.textContent = `${DEFAULT_BPM} BPM`;
  headerControls.appendChild(bpmDisplay);

  // Random button (should exist from template)
  randomBtn = document.getElementById('randBtn');
}

// ========== CELL FACTORY INSTANCE ==========
let cellFactory = null;

// ========== INITIALIZATION ==========

async function init() {
  console.log('Initializing App12: Plano-Sucesión...');

  // Inject DOM elements
  injectSequenceInputs();
  injectControlButtons();

  // Create plane wrapper first
  planeWrapper = createPlaneWrapper();

  // Create soundline wrapper
  const soundlineWrapper = createSoundlineWrapper();

  // Create soundline (vertical axis) using shared API
  soundline = createSoundline(soundlineWrapper);

  // Optional: click on soundline numbers to audition notes
  soundlineWrapper.addEventListener('click', async (e) => {
    const target = e.target;
    if (target && target.classList && target.classList.contains('soundline-number')) {
      const noteIndex = parseInt(target.dataset.note, 10);
      if (!Number.isNaN(noteIndex)) {
        await initPiano();
        const midi = 60 + noteIndex;
        const Tone = window.Tone;
        const toneNote = Tone.Frequency(midi, 'midi').toNote();
        piano.triggerAttackRelease(toneNote, 0.3);
      }
    }
  });

  // Create timeline wrapper
  const timelineWrapper = createTimelineWrapper();

  // Create timeline (horizontal axis)
  const timelineNumbers = Array.from({ length: TOTAL_PULSES }, (_, i) => i);

  // Render timeline markers
  timelineNumbers.forEach(pulseIndex => {
    const marker = document.createElement('div');
    marker.className = 'pulse-marker';
    marker.dataset.pulseIndex = pulseIndex;
    marker.textContent = pulseIndex;
    timelineWrapper.appendChild(marker);
  });

  timeline = createTimelineHorizontalAxis(TOTAL_PULSES, timelineWrapper, true);

  // Create cell factory
  cellFactory = createToggleCellFactory();

  // Create musical plane (2D grid)
  musicalPlane = createMusicalPlane({
    container: planeWrapper,
    verticalAxis: soundline,
    horizontalAxis: timeline,
    cellFactory: cellFactory
  });

  // Render the grid cells
  musicalPlane.render();

  // Create matrix-seq controller
  matrixSeq = createMatrixSeqController({
    noteRange: [0, 11],
    pulseRange: [0, 7],
    onPairsChange: (pairs) => {
      syncGridFromPairs(pairs);
    },
    onEnterFromNote: () => {
      document.getElementById('pulseSeqInput')?.querySelector('.edit')?.focus();
    },
    onEnterFromPulse: () => {
      document.getElementById('noteSeqInput')?.querySelector('.edit')?.focus();
    }
  });

  // Mount matrix-seq
  matrixSeq.mount({
    noteRoot: document.getElementById('noteSeqInput'),
    pulseRoot: document.getElementById('pulseSeqInput'),
    noteAxis: soundline,
    pulseAxis: timeline,
    noteElement: document.querySelector('.soundline-wrapper'),
    pulseElement: timelineWrapper
  });

  // Event listeners
  playBtn?.addEventListener('click', handlePlay);
  resetBtn?.addEventListener('click', handleReset);
  randomBtn?.addEventListener('click', handleRandom);

  // Tap tempo
  createTapTempoHandler({
    button: tapBtn,
    onTempoChange: (bpm) => {
      currentBPM = Math.round(bpm);
      updateBPMDisplay();
    }
  });

  // Mixer integration
  initMixerMenu({
    triggerButton: playBtn,
    channels: {
      piano: { label: 'Piano', defaultVolume: 0 }
    }
  });

  // Factory reset
  registerFactoryReset(() => {
    handleReset();
    preferenceStorage.clear();
    window.location.reload();
  });

  console.log('App12 initialized successfully');
}

function createSoundlineWrapper() {
  const wrapper = document.createElement('div');
  wrapper.className = 'soundline-wrapper';
  if (planeWrapper) {
    planeWrapper.appendChild(wrapper);
  }
  return wrapper;
}

function createTimelineWrapper() {
  const wrapper = document.createElement('div');
  wrapper.className = 'timeline-wrapper';
  if (planeWrapper) {
    planeWrapper.appendChild(wrapper);
  }
  return wrapper;
}

// Start initialization
init().catch(err => {
  console.error('Failed to initialize App12:', err);
});
