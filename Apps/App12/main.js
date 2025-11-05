// App12: Plano-Sucesión - 2D Step Sequencer with dual N+P sequences
// Uses matrix-seq module for coordinated note/pulse selection
// Uses grid-layout.js for simplified 2D grid creation

import { createMusicalGrid } from '../../libs/app-common/grid-layout.js';
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
let musicalGrid = null;
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
  const noteElement = musicalGrid?.getNoteElement(noteIndex);
  if (!noteElement) return;

  const soundlineEl = musicalGrid.containers.soundline;
  if (!soundlineEl) return;

  const rect = document.createElement('div');
  rect.className = 'soundline-highlight';

  const bounds = noteElement.getBoundingClientRect();
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
      const cell = musicalGrid.getCellElement(note, pulse);
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
  musicalGrid?.clear();

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
  if (!musicalGrid) return;

  // Clear all active visuals
  document.querySelectorAll('.musical-cell.active').forEach(cell => {
    cell.classList.remove('active');
    const label = cell.querySelector('.cell-label');
    if (label) {
      label.remove();
    }
  });

  // Activate cells for each pair
  pairs.forEach(({ note, pulse }) => {
    const cell = musicalGrid.getCellElement(note, pulse);
    if (cell) {
      cell.classList.add('active');

      // Add label if not exists
      if (!cell.querySelector('.cell-label')) {
        const label = document.createElement('span');
        label.className = 'cell-label';
        label.textContent = `N${note} P${pulse}`;
        cell.appendChild(label);
      }
    }
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

// createPlaneWrapper removed - now handled by createMusicalGrid()

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

// Cell factory no longer needed - handled by createMusicalGrid()

// ========== INITIALIZATION ==========

async function init() {
  console.log('Initializing App12: Plano-Sucesión...');

  // Inject DOM elements
  injectSequenceInputs();
  injectControlButtons();

  // Create musical grid using new simplified module
  musicalGrid = createMusicalGrid({
    parent: document.getElementById('app-root'),
    notes: TOTAL_NOTES,
    pulses: TOTAL_PULSES,
    startMidi: 60, // C4
    fillSpaces: true, // Cells between pulses (spaces 0-7)
    cellClassName: 'musical-cell',
    activeClassName: 'active',
    highlightClassName: 'highlight',
    cellRenderer: (noteIndex, pulseIndex, cellElement) => {
      // Custom rendering: add label structure for N/P pairs
      cellElement.innerHTML = ''; // Clear any default content
    },
    onCellClick: async (noteIndex, pulseIndex, cellElement) => {
      // Play MIDI note on click
      await initPiano();
      const Tone = window.Tone;
      const midi = 60 + noteIndex; // C4 = MIDI 60
      const toneNote = Tone.Frequency(midi, 'midi').toNote();
      const duration = (60 / currentBPM) * 0.9; // 1 pulse duration (90% for clean separation)
      piano.triggerAttackRelease(toneNote, duration);

      // Visual feedback on soundline
      highlightNoteOnSoundline(noteIndex, duration * 1000);

      // Toggle cell in matrix-seq
      const isActive = cellElement.classList.contains('active');

      if (isActive) {
        // Remove pair
        matrixSeq.removePair(noteIndex, pulseIndex);
      } else {
        // Add pair
        matrixSeq.addPair(noteIndex, pulseIndex);
      }
      // Note: syncGridFromPairs() will handle visual updates (active class + labels)
    },
    onNoteClick: async (noteIndex, midi) => {
      // Play note when soundline clicked
      await initPiano();
      const Tone = window.Tone;
      const toneNote = Tone.Frequency(midi, 'midi').toNote();
      piano.triggerAttackRelease(toneNote, 0.3);
    }
  });

  // Reposition controls below grid
  const timelineWrapper = document.getElementById('timelineWrapper');
  const controls = timelineWrapper?.querySelector('.controls');
  const appRoot = document.getElementById('app-root');

  if (controls && appRoot) {
    // Extract controls from timeline wrapper
    controls.remove();

    // Create container for controls
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'app12-controls-container';
    controlsContainer.appendChild(controls);

    // Insert after grid-container
    const gridContainer = appRoot.querySelector('.grid-container');
    if (gridContainer) {
      gridContainer.after(controlsContainer);
    } else {
      appRoot.appendChild(controlsContainer);
    }
  }

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
    noteAxis: null, // Not needed with new grid
    pulseAxis: null, // Not needed with new grid
    noteElement: musicalGrid.containers.soundline,
    pulseElement: musicalGrid.containers.timeline
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

  // Color picker change listener (initial value set in index.html)
  const selectColor = document.getElementById('selectColor');
  if (selectColor) {
    selectColor.addEventListener('input', (e) => {
      const color = e.target.value;
      document.documentElement.style.setProperty('--select-color', color);
      const currentPrefs = preferenceStorage.load() || {};
      currentPrefs.selectColor = color;
      preferenceStorage.save(currentPrefs);
    });
  }

  // Factory reset
  registerFactoryReset(() => {
    handleReset();
    preferenceStorage.clear();
    window.location.reload();
  });

  console.log('App12 initialized successfully');
}

// createSoundlineWrapper and createTimelineWrapper removed - now handled by createMusicalGrid()

// Start initialization
init().catch(err => {
  console.error('Failed to initialize App12:', err);
});
