// App11: El Plano - Interactive 2D musical grid
// Simple random note generator with clickable cells

import { createMusicalGrid } from '../../libs/musical-grid/index.js';
import { registerFactoryReset, createPreferenceStorage } from '../../libs/app-common/preferences.js';
import { getMixer, subscribeMixer } from '../../libs/sound/index.js';
import { MelodicTimelineAudio } from '../../libs/sound/melodic-audio.js';
import { initMixerMenu } from '../../libs/app-common/mixer-menu.js';
import { initAudioToggles } from '../../libs/app-common/audio-toggles.js';
import { initP1ToggleUI } from '../../libs/shared-ui/sound-dropdown.js';

// ========== CONFIGURATION ==========
const TOTAL_PULSES = 9;   // Horizontal: 0-8 (9 markers)
const TOTAL_NOTES = 12;   // Vertical: 0-11 (MIDI 60-71)
const SEQUENCE_PULSES = 8; // Total pulses in playback sequence (0-7)
const MIN_NOTES = 4;      // Minimum notes in sequence
const MAX_NOTES = 8;      // Maximum notes in sequence
const FIXED_BPM = 120;    // Fixed BPM (not randomized)
const MIN_BPM = 75;       // Minimum random BPM
const MAX_BPM = 200;      // Maximum random BPM
const BASE_MIDI = 60;     // C4

// ========== STATE ==========
let audio = null;
let musicalGrid = null;
let currentBPM = FIXED_BPM;
let intervalSec = 60 / FIXED_BPM; // 0.5 seconds per pulse
let isPlaying = false;
let playBtn = null;

// Storage de preferencias
const preferenceStorage = createPreferenceStorage('app11');

// ========== AUDIO INITIALIZATION ==========

async function initAudio() {
  if (!audio) {
    console.log('Initializing MelodicTimelineAudio...');
    audio = new MelodicTimelineAudio();
    await audio.ready();

    // Load default instrument (piano)
    const prefs = preferenceStorage.load() || {};
    const instrument = prefs.selectedInstrument || 'piano';
    await audio.setInstrument(instrument);

    // Expose globally for debugging
    window.NuzicAudioEngine = audio;
    window.__labAudio = audio;

    console.log('MelodicTimelineAudio initialized with instrument:', instrument);
  }
  return audio;
}

// ========== RANDOM GENERATORS ==========

function getRandomBPM() {
  return Math.floor(Math.random() * (MAX_BPM - MIN_BPM + 1)) + MIN_BPM;
}

function getRandomNoteIndex() {
  return Math.floor(Math.random() * TOTAL_NOTES);
}

function generateRandomSequence() {
  const noteCount = Math.floor(Math.random() * (MAX_NOTES - MIN_NOTES + 1)) + MIN_NOTES;
  const allPulses = Array.from({length: SEQUENCE_PULSES}, (_, i) => i);
  const shuffled = allPulses.sort(() => Math.random() - 0.5);
  const notePulses = shuffled.slice(0, noteCount).sort((a, b) => a - b);
  const silencePulses = shuffled.slice(noteCount);

  const notes = notePulses.map(pulse => ({
    note: getRandomNoteIndex(),
    pulse: pulse
  }));

  return { notes, silencePulses };
}

// ========== PLAY SEQUENCE ==========

async function handlePlay() {
  if (isPlaying) {
    console.log('Already playing, ignoring click');
    return;
  }

  // Set flag immediately to prevent double-click race condition
  isPlaying = true;
  playBtn.disabled = true;
  playBtn.classList.add('playing');

  // Ensure audio is loaded
  if (!audio) {
    await initAudio();
  }

  // Check Tone.js is available
  if (!window.Tone) {
    console.warn('Tone.js not available yet');
    // Reset state if we can't play
    isPlaying = false;
    playBtn.disabled = false;
    playBtn.classList.remove('playing');
    return;
  }

  // Generate random content
  currentBPM = getRandomBPM();
  const { notes, silencePulses } = generateRandomSequence();

  console.log('=== Play Sequence ===');
  console.log(`BPM: ${currentBPM}`);
  console.log(`Notes (${notes.length}):`, notes.map(({note, pulse}) => `P${pulse}:N${note}`).join(', '));

  // Calculate interval
  intervalSec = 60 / currentBPM;

  // Clear all previous labels and active states
  document.querySelectorAll('.musical-cell.active').forEach(cell => {
    cell.classList.remove('active');
    const label = cell.querySelector('.cell-label');
    if (label) label.remove();
  });

  // Create map of notes by pulse
  const notesByPulse = {};
  notes.forEach(({note, pulse}) => {
    notesByPulse[pulse] = note;
  });

  const Tone = window.Tone;

  // Pre-schedule all notes BEFORE starting playback
  // This ensures notes sound DURING pulses, not after
  const now = Tone.now();
  notes.forEach(({note, pulse}) => {
    const midi = BASE_MIDI + note;
    const duration = intervalSec * 0.9;
    const when = now + (pulse * intervalSec); // Calculate exact timing

    audio.playNote(midi, duration, when);
  });

  // Start playback (for visual feedback and pulse sounds only)
  audio.play(
    SEQUENCE_PULSES,
    intervalSec,
    new Set(),
    false,
    (step) => {
      console.log(`Pulse ${step}`);

      // Use native interval highlighting from musical-grid
      musicalGrid.onPulseStep(step, intervalSec * 1000);

      const note = notesByPulse[step];
      if (note !== undefined) {
        // Note: Audio already scheduled above - this is only visual feedback
        // Visual feedback: highlight cell and show label
        const cell = musicalGrid.getCellElement(note, step);
        if (cell) {
          cell.classList.add('active');

          // Add label
          if (!cell.querySelector('.cell-label')) {
            const label = document.createElement('span');
            label.className = 'cell-label';
            label.textContent = `( ${note} , ${step} )`;
            cell.appendChild(label);
          }
        }
      }
    },
    () => {
      // onComplete - elegant fade-out animation with delay
      console.log('Sequence completed - waiting 1000ms before fade-out...');

      // Collect all active cells
      const activeCells = document.querySelectorAll('.musical-cell.active');

      // Wait 1000ms to show last pulse, then start fade-out
      setTimeout(() => {
        console.log('Starting fade-out animation...');
        activeCells.forEach(cell => {
          cell.classList.add('fading-out');
        });

        // After 1 second fade-out, clean up
        setTimeout(() => {
          activeCells.forEach(cell => {
            cell.classList.remove('active', 'fading-out');
            const label = cell.querySelector('.cell-label');
            if (label) label.remove();
          });
          console.log('Fade-out complete - cells cleared');
        }, 1000);
      }, 1000);

      // Reset state immediately (don't wait for animation)
      isPlaying = false;
      playBtn.disabled = false;
      playBtn.classList.remove('playing');
    }
  );
}

// ========== INITIALIZATION ==========

async function init() {
  console.log('Initializing App11...');

  // Find the main element and controls
  const appRoot = document.getElementById('app-root');
  const mainElement = appRoot?.querySelector('main');
  if (!mainElement) {
    console.error('Main element not found');
    return;
  }

  const controls = mainElement.querySelector('.controls');
  if (!controls) {
    console.error('Controls element not found');
    return;
  }

  // Create main grid wrapper for 2-column layout
  const mainGridWrapper = document.createElement('div');
  mainGridWrapper.className = 'two-column-layout app11-main-grid';

  // Create controls container (left column)
  const controlsContainer = document.createElement('div');
  controlsContainer.className = 'two-column-layout__controls app11-controls-container';
  controlsContainer.appendChild(controls);

  // Create grid container (center-right column, expanded)
  const gridContainer = document.createElement('div');
  gridContainer.id = 'grid-container';
  gridContainer.className = 'two-column-layout__main';

  // Append containers to main grid wrapper
  mainGridWrapper.appendChild(controlsContainer);
  mainGridWrapper.appendChild(gridContainer);

  // Append wrapper to main element
  mainElement.appendChild(mainGridWrapper);

  // Load preferences
  const prefs = preferenceStorage.load() || {};
  const intervalLinesEnabled = prefs.intervalLinesEnabled !== undefined ? prefs.intervalLinesEnabled : false;

  // Create musical grid with intervals enabled (horizontal only)
  musicalGrid = createMusicalGrid({
    parent: gridContainer,
    notes: TOTAL_NOTES,
    pulses: TOTAL_PULSES,
    noteFormatter: (index) => index.toString(),
    pulseFormatter: (index) => index.toString(),
    scrollEnabled: false,
    showIntervals: {
      horizontal: true,
      vertical: false,
      cellLines: intervalLinesEnabled
    },
    intervalColor: '#4A9EFF',
    onCellClick: async (noteIndex, pulseIndex, cell) => {
      // Check CURRENT state, not creation-time state
      const prefs = preferenceStorage.load() || {};
      const currentIntervalLines = prefs.intervalLinesEnabled !== undefined ? prefs.intervalLinesEnabled : false;

      if (currentIntervalLines) {
        return; // Cell clicks DISABLED when interval lines are enabled
      }

      await initAudio();

      if (!window.Tone) {
        console.warn('Tone.js not available yet');
        return;
      }

      const midi = BASE_MIDI + noteIndex;
      const duration = intervalSec * 0.9;

      audio.playNote(midi, duration, window.Tone.now());

      // Show label on click
      cell.classList.add('active');
      if (!cell.querySelector('.cell-label')) {
        const label = document.createElement('span');
        label.className = 'cell-label';
        label.textContent = `( ${noteIndex} , ${pulseIndex} )`;
        cell.appendChild(label);
      }

      // Wait 1000ms, then start fade-out animation
      setTimeout(() => {
        cell.classList.add('fading-out');

        // After fade-out completes (1000ms), clean up
        setTimeout(() => {
          cell.classList.remove('active', 'fading-out');
          const label = cell.querySelector('.cell-label');
          if (label) label.remove();
        }, 1000);
      }, 1000);
    },
    onPulseClick: async (pulseIndex) => {
      // Check CURRENT state, not creation-time state
      const prefs = preferenceStorage.load() || {};
      const currentIntervalLines = prefs.intervalLinesEnabled !== undefined ? prefs.intervalLinesEnabled : false;

      if (!currentIntervalLines) {
        return; // Pulse clicks ENABLED only when interval lines are enabled
      }

      await initAudio();

      if (!window.Tone) {
        console.warn('Tone.js not available yet');
        return;
      }

      // Play ALL active notes at this pulse
      const activeCells = [];
      for (let noteIndex = 0; noteIndex < TOTAL_NOTES; noteIndex++) {
        const cell = musicalGrid.getCellElement(noteIndex, pulseIndex);
        if (cell && cell.classList.contains('active')) {
          activeCells.push({ noteIndex, cell });
        }
      }

      if (activeCells.length > 0) {
        const duration = intervalSec * 0.9;
        const when = window.Tone.now();

        // Play all notes simultaneously
        activeCells.forEach(({ noteIndex, cell }) => {
          const midi = BASE_MIDI + noteIndex;
          audio.playNote(midi, duration, when);

          // Visual feedback
          cell.classList.add('playing');
          setTimeout(() => cell.classList.remove('playing'), duration * 1000);
        });
      }
    }
  });

  console.log('Musical grid created with intervals');

  // Setup Play button
  playBtn = document.getElementById('playBtn');
  if (playBtn) {
    eventHandlers.playClick = handlePlay;
    playBtn.addEventListener('click', eventHandlers.playClick);
  }

  // Listen for sound changes
  eventHandlers.sharedSound = async (e) => {
    const { type, value } = e.detail;
    const audioInstance = await initAudio();

    if (type === 'base' && audioInstance && typeof audioInstance.setBase === 'function') {
      await audioInstance.setBase(value);
    }

    if (type === 'start' && audioInstance && typeof audioInstance.setStart === 'function') {
      await audioInstance.setStart(value);
    }
  };
  document.addEventListener('sharedui:sound', eventHandlers.sharedSound);

  // Listen for instrument changes
  eventHandlers.sharedInstrument = async (e) => {
    const instrument = e.detail.instrument;
    await initAudio();
    await audio.setInstrument(instrument);

    const currentPrefs = preferenceStorage.load() || {};
    currentPrefs.selectedInstrument = instrument;
    preferenceStorage.save(currentPrefs);
  };
  document.addEventListener('sharedui:instrument', eventHandlers.sharedInstrument);

  // Initialize P1 toggle
  const startIntervalToggle = document.getElementById('startIntervalToggle');
  const startSoundRow = document.querySelector('.interval-select-row');
  if (startIntervalToggle && startSoundRow) {
    initP1ToggleUI({
      checkbox: startIntervalToggle,
      startSoundRow: startSoundRow,
      storageKey: 'app11:p1Toggle',
      onChange: async (enabled) => {
        const audioInstance = await initAudio();
        if (audioInstance && typeof audioInstance.setStartEnabled === 'function') {
          audioInstance.setStartEnabled(enabled);
        }
      }
    });
  }

  // Initialize interval lines toggle
  const intervalLinesToggle = document.getElementById('intervalLinesToggle');
  if (intervalLinesToggle) {
    // Set initial state from preferences
    intervalLinesToggle.checked = intervalLinesEnabled;

    // Listen for changes
    eventHandlers.intervalLinesChange = () => {
      const enabled = intervalLinesToggle.checked;

      // Save to preferences
      const currentPrefs = preferenceStorage.load() || {};
      currentPrefs.intervalLinesEnabled = enabled;
      preferenceStorage.save(currentPrefs);

      // Update grid configuration in real-time (no reload)
      if (musicalGrid && musicalGrid.intervalsConfig) {
        musicalGrid.intervalsConfig.cellLines = enabled;

        // Always clear first
        musicalGrid.clearIntervalPaths();

        // Get currently active cells and extract N-P pairs
        const activeCells = document.querySelectorAll('.musical-cell.active');
        const pairs = [];
        activeCells.forEach(cell => {
          const note = parseInt(cell.dataset.note);
          const pulse = parseInt(cell.dataset.pulse);
          if (!isNaN(note) && !isNaN(pulse)) {
            pairs.push({ note, pulse });
          }
        });

        // Sort pairs by pulse (required for highlightIntervalPath)
        pairs.sort((a, b) => a.pulse - b.pulse);

        // Apply interval paths if enabled and have pairs
        if (enabled && pairs.length > 0) {
          musicalGrid.highlightIntervalPath(pairs);
        }
      }
    };
    intervalLinesToggle.addEventListener('change', eventHandlers.intervalLinesChange);
  }

  // Initialize color picker
  const selectColorInput = document.getElementById('selectColor');
  if (selectColorInput) {
    // Set initial color from preferences
    const savedColor = prefs.selectColor || '#E4570C';
    selectColorInput.value = savedColor;
    document.documentElement.style.setProperty('--select-color', savedColor);

    // Listen for changes
    selectColorInput.addEventListener('input', (e) => {
      const newColor = e.target.value;
      document.documentElement.style.setProperty('--select-color', newColor);

      // Save to preferences
      const currentPrefs = preferenceStorage.load() || {};
      currentPrefs.selectColor = newColor;
      preferenceStorage.save(currentPrefs);
    });
  }

  // Register factory reset
  registerFactoryReset(() => {
    // 1. Update localStorage with factory defaults
    localStorage.setItem('app11-preferences', JSON.stringify({
      selectedInstrument: 'piano',
      intervalLinesEnabled: false,
      selectColor: '#E4570C'
    }));

    // 2. Sync UI without reload
    // Interval lines toggle
    const intervalLinesToggle = document.getElementById('intervalLinesToggle');
    if (intervalLinesToggle) {
      intervalLinesToggle.checked = false;
      if (musicalGrid?.clearIntervalPaths) {
        musicalGrid.clearIntervalPaths();
      }
    }

    // Color picker
    const selectColorInput = document.getElementById('selectColor');
    if (selectColorInput) {
      selectColorInput.value = '#E4570C';
      document.documentElement.style.setProperty('--select-color', '#E4570C');
    }

    // 3. Reload to ensure clean state
    window.location.reload();
  });

  // Initialize mixer menu
  const mixerMenu = document.getElementById('mixerMenu');
  if (mixerMenu && playBtn) {
    initMixerMenu({
      menu: mixerMenu,
      triggers: [playBtn],
      channels: [
        { id: 'start', label: 'Pulso1', allowSolo: false, hasSlider: false },
        { id: 'pulse', label: 'Pulso', allowSolo: true },
        { id: 'instrument', label: 'Piano', allowSolo: true },
        { id: 'master', label: 'Master', allowSolo: false, isMaster: true }
      ]
    });
  }

  // Initialize audio toggles
  const pulseToggleBtn = document.getElementById('pulseToggleBtn');
  if (pulseToggleBtn) {
    const globalMixer = getMixer();
    initAudioToggles({
      toggles: [{
        id: 'pulse',
        button: pulseToggleBtn,
        storageKey: 'app11:pulseAudio',
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
        save: (data) => preferenceStorage.save(data)
      },
      mixer: globalMixer,
      subscribeMixer
    });
  }

  console.log('App11 initialized successfully');
}

// ========== CLEANUP ==========

// Store handler references for cleanup
const eventHandlers = {
  playClick: null,
  sharedSound: null,
  sharedInstrument: null,
  intervalLinesChange: null
};

window.addEventListener('beforeunload', () => {
  // Cleanup audio and grid
  if (audio) {
    audio.stop?.();
  }

  if (musicalGrid) {
    musicalGrid.destroy?.();
  }

  // Remove event listeners
  if (playBtn && eventHandlers.playClick) {
    playBtn.removeEventListener('click', eventHandlers.playClick);
  }

  if (eventHandlers.sharedSound) {
    document.removeEventListener('sharedui:sound', eventHandlers.sharedSound);
  }

  if (eventHandlers.sharedInstrument) {
    document.removeEventListener('sharedui:instrument', eventHandlers.sharedInstrument);
  }

  const intervalLinesToggle = document.getElementById('intervalLinesToggle');
  if (intervalLinesToggle && eventHandlers.intervalLinesChange) {
    intervalLinesToggle.removeEventListener('change', eventHandlers.intervalLinesChange);
  }
});

// ========== START ==========

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
