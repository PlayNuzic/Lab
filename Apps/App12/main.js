// App12: Plano-Sucesión - 2D Step Sequencer with dual N+P sequences
// Uses matrix-seq module for coordinated note/pulse selection
// Uses grid-layout.js for simplified 2D grid creation

import { createMusicalGrid } from '../../libs/app-common/grid-layout.js';
import { MelodicTimelineAudio } from '../../libs/sound/melodic-audio.js';
import { registerFactoryReset, createPreferenceStorage } from '../../libs/app-common/preferences.js';
import { createMatrixSeqController } from '../../libs/matrix-seq/index.js';
import { createTapTempoHandler } from '../../libs/app-common/tap-tempo-handler.js';
import { initMixerMenu } from '../../libs/app-common/mixer-menu.js';
import { initRandomMenu } from '../../libs/random/menu.js';

// ========== CONFIGURATION ==========
const TOTAL_PULSES = 9;   // Horizontal: 0-8
const TOTAL_NOTES = 12;   // Vertical: 0-11 (MIDI 60-71)
const TOTAL_SPACES = 8;   // Spaces between pulses: 0-7
const DEFAULT_BPM = 120;

// ========== STATE ==========
let audio = null;
let musicalGrid = null;
let matrixSeq = null;
let currentBPM = DEFAULT_BPM;
let isPlaying = false;
let playbackTimeout = null; // Store timeout reference for immediate stop

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

async function initAudio() {
  if (!audio) {
    console.log('Initializing MelodicTimelineAudio...');
    audio = new MelodicTimelineAudio();
    await audio.ready();

    // Load default instrument from preferences
    const prefs = JSON.parse(localStorage.getItem('app12-preferences') || '{}');
    const instrument = prefs.selectedInstrument || 'piano';
    await audio.setInstrument(instrument);

    // CRITICAL: Expose globally for Performance submenu and header
    window.NuzicAudioEngine = audio;
    window.__labAudio = audio;

    console.log('Audio initialized and exposed globally');
  }
  return audio;
}

// ========== VISUAL FEEDBACK ==========

function createMatrixHighlightController() {
  let currentPulse = -1;

  function highlightPulse(pulse) {
    // Clear previous highlights
    document.querySelectorAll('.pulse-marker.highlighted').forEach(el => {
      el.classList.remove('highlighted');
    });
    document.querySelectorAll('.musical-cell.pulse-highlight').forEach(el => {
      el.classList.remove('pulse-highlight');
    });

    currentPulse = pulse;

    // Highlight pulse marker on timeline
    const pulseMarker = musicalGrid?.containers?.timeline
      ?.querySelector(`[data-pulse="${pulse}"]`);
    if (pulseMarker) {
      pulseMarker.classList.add('highlighted');
    }

    // Highlight all active cells in this pulse column
    if (musicalGrid) {
      for (let noteIndex = 0; noteIndex < TOTAL_NOTES; noteIndex++) {
        const cell = musicalGrid.getCellElement(noteIndex, pulse);
        if (cell && cell.classList.contains('active')) {
          cell.classList.add('pulse-highlight');
        }
      }
    }
  }

  function clearHighlights() {
    document.querySelectorAll('.pulse-marker.highlighted').forEach(el => {
      el.classList.remove('highlighted');
    });
    document.querySelectorAll('.musical-cell.pulse-highlight').forEach(el => {
      el.classList.remove('pulse-highlight');
    });
    currentPulse = -1;
  }

  return { highlightPulse, clearHighlights };
}

let highlightController = null;

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
  if (isPlaying) {
    // Immediate stop via audio engine
    stopPlayback();
    return;
  }

  // Ensure audio is initialized
  await initAudio();

  const allPairs = matrixSeq.getPairs();

  // Filter only pairs with active cells (silent pulses = empty columns)
  const activePairs = allPairs.filter(pair => {
    const cell = musicalGrid.getCellElement(pair.note, pair.pulse);
    return cell?.classList.contains('active');
  });

  if (activePairs.length === 0) {
    console.warn('No active notes to play');
    return;
  }

  isPlaying = true;

  // Switch to stop icon
  const playIcon = playBtn.querySelector('.icon-play');
  const stopIcon = playBtn.querySelector('.icon-stop');
  if (playIcon && stopIcon) {
    playIcon.style.display = 'none';
    stopIcon.style.display = 'block';
  }

  if (!window.Tone) {
    console.error('Tone.js not available');
    stopPlayback();
    return;
  }

  const Tone = window.Tone;
  const intervalMs = (60 / currentBPM) * 1000;
  const intervalSec = intervalMs / 1000;
  const startTime = Tone.now();

  // Store all timeouts for cleanup
  const visualTimeouts = [];

  // Group pairs by pulse for simultaneous playback
  const pulseGroups = {};
  activePairs.forEach(pair => {
    if (!pulseGroups[pair.pulse]) {
      pulseGroups[pair.pulse] = [];
    }
    pulseGroups[pair.pulse].push(pair.note);
  });

  // Get unique pulses in order
  const uniquePulses = Object.keys(pulseGroups).map(p => parseInt(p)).sort((a, b) => a - b);

  // Schedule playback for each pulse group via audio engine
  uniquePulses.forEach((pulse, idx) => {
    const notes = pulseGroups[pulse];
    const when = startTime + (idx * intervalSec);
    const duration = intervalSec * 0.9;

    // Play all notes at this pulse simultaneously via audio engine
    notes.forEach(note => {
      const midi = 60 + note; // C4 = MIDI 60
      audio.playNote(midi, duration, when);
    });

    // Schedule visual feedback for all notes at this pulse
    const visualTimeout = setTimeout(() => {
      // Highlight the entire pulse column
      highlightController?.highlightPulse(pulse);

      notes.forEach(note => {
        const cell = musicalGrid.getCellElement(note, pulse);
        if (cell) {
          cell.classList.add('playing');
          const clearTimeout = setTimeout(() => cell.classList.remove('playing'), duration * 1000);
          visualTimeouts.push(clearTimeout);
        }
        highlightNoteOnSoundline(note, duration * 1000);
      });
    }, idx * intervalMs);
    visualTimeouts.push(visualTimeout);
  });

  // Reset after completion
  playbackTimeout = setTimeout(() => {
    stopPlayback();
  }, uniquePulses.length * intervalMs + 500);

  // Store cleanup function for immediate stop
  window.cleanupPlayback = () => {
    visualTimeouts.forEach(timeout => clearTimeout(timeout));
  };
}

function stopPlayback() {
  isPlaying = false;

  // Stop audio engine (releases all instrument notes)
  audio?.stop();

  // Clear main playback timeout
  if (playbackTimeout) {
    clearTimeout(playbackTimeout);
    playbackTimeout = null;
  }

  // Clear all visual timeouts
  if (window.cleanupPlayback) {
    window.cleanupPlayback();
    delete window.cleanupPlayback;
  }

  // Clear pulse highlights
  highlightController?.clearHighlights();

  // Clear any active playing animations
  document.querySelectorAll('.musical-cell.playing').forEach(cell => {
    cell.classList.remove('playing');
  });

  // Switch back to play icon
  const playIcon = playBtn?.querySelector('.icon-play');
  const stopIcon = playBtn?.querySelector('.icon-stop');
  if (playIcon && stopIcon) {
    playIcon.style.display = 'block';
    stopIcon.style.display = 'none';
  }
}

// ========== RESET ==========

function handleReset() {
  // Clear selections
  matrixSeq.clear();
  musicalGrid?.clear();

  // Reset BPM
  currentBPM = DEFAULT_BPM;
  updateBPMDisplay();

  // Stop playback if playing
  if (isPlaying) {
    stopPlayback();
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
        label.textContent = `N(${note}) P(${pulse})`;
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
// injectControlButtons removed - buttons now queried after DOM is ready

// ========== INITIALIZATION ==========

async function init() {
  console.log('Initializing App12: Plano-Sucesión...');

  // Inject DOM elements
  injectSequenceInputs();

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
      // Play MIDI note on click via audio engine
      await initAudio();

      if (!window.Tone) {
        console.warn('Tone.js not available');
        return;
      }

      const midi = 60 + noteIndex; // C4 = MIDI 60
      const duration = (60 / currentBPM) * 0.9; // 1 pulse duration (90% for clean separation)
      const Tone = window.Tone;
      audio.playNote(midi, duration, Tone.now());

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
      // Play note when soundline clicked via audio engine
      await initAudio();

      if (!window.Tone) {
        console.warn('Tone.js not available');
        return;
      }

      const Tone = window.Tone;
      audio.playNote(midi, 0.3, Tone.now());
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

  // Initialize highlight controller
  highlightController = createMatrixHighlightController();

  // Wait for DOM to be fully populated by template system
  await new Promise(resolve => setTimeout(resolve, 50));

  // Query control buttons AFTER template has rendered
  playBtn = document.getElementById('playBtn');
  randomBtn = document.getElementById('randomBtn');
  resetBtn = document.getElementById('resetBtn');
  tapBtn = document.getElementById('tapTempoBtn');
  bpmDisplay = document.querySelector('.bpm-display');

  // Initialize BPM display
  updateBPMDisplay();

  // Event listeners (now buttons exist)
  playBtn?.addEventListener('click', handlePlay);
  resetBtn?.addEventListener('click', handleReset);
  randomBtn?.addEventListener('click', handleRandom);

  // Tap tempo
  const tapTempoHandler = createTapTempoHandler({
    getAudioInstance: initAudio,  // Fixed: use initAudio instead of initPiano
    tapBtn,
    tapHelp: null,
    onBpmDetected: (bpm) => {
      currentBPM = Math.round(bpm);
      updateBPMDisplay();
      console.log('Tap tempo detected BPM:', currentBPM);
    }
  });
  tapTempoHandler.attach();

  // Mixer integration (longpress on play button)
  const mixerMenu = document.getElementById('mixerMenu');
  if (mixerMenu) {
    initMixerMenu({
      menu: mixerMenu,
      triggers: [playBtn, tapBtn].filter(Boolean),
      channels: [
        { id: 'piano', label: 'Piano', allowSolo: true },
        { id: 'master', label: 'Master', allowSolo: false, isMaster: true }
      ]
    });
  }

  // Random menu (longpress to open configuration)
  const randomMenu = document.getElementById('randomMenu');
  if (randomBtn && randomMenu) {
    initRandomMenu(randomBtn, randomMenu, handleRandom);
  }

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

  // Wire instrument dropdown to audio engine
  window.addEventListener('sharedui:instrument', async (e) => {
    const instrument = e.detail.instrument;
    console.log('Instrument changed to:', instrument);

    await initAudio();
    await audio.setInstrument(instrument);

    // Save to preferences
    const currentPrefs = preferenceStorage.load() || {};
    currentPrefs.selectedInstrument = instrument;
    preferenceStorage.save(currentPrefs);
  });

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
