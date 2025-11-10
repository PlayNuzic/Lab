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

  // Start playback
  audio.play(
    SEQUENCE_PULSES,
    intervalSec,
    new Set(),
    false,
    (step) => {
      console.log(`Pulse ${step}`);

      const note = notesByPulse[step];
      if (note !== undefined) {
        const midi = BASE_MIDI + note;
        const duration = intervalSec * 0.9;
        const when = Tone.now();

        audio.playNote(midi, duration, when);

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
      console.log('Sequence completed - waiting 500ms before fade-out...');

      // Collect all active cells
      const activeCells = document.querySelectorAll('.musical-cell.active');

      // Wait 500ms to show last pulse, then start fade-out
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
      }, 500);

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

  // Create main grid wrapper for 3-column layout
  const mainGridWrapper = document.createElement('div');
  mainGridWrapper.className = 'three-column-layout app11-main-grid';

  // Create controls container (left column)
  const controlsContainer = document.createElement('div');
  controlsContainer.className = 'three-column-layout__controls app11-controls-container';
  controlsContainer.appendChild(controls);

  // Create grid container (center column)
  const gridContainer = document.createElement('div');
  gridContainer.id = 'grid-container';
  gridContainer.className = 'three-column-layout__main';

  // Append containers to main grid wrapper
  mainGridWrapper.appendChild(controlsContainer);
  mainGridWrapper.appendChild(gridContainer);

  // Append wrapper to main element
  mainElement.appendChild(mainGridWrapper);

  // Create musical grid
  musicalGrid = createMusicalGrid({
    parent: gridContainer,
    notes: TOTAL_NOTES,
    pulses: TOTAL_PULSES,
    noteFormatter: (index) => index.toString(),
    pulseFormatter: (index) => index.toString(),
    scrollEnabled: false
  });

  console.log('Musical grid created');

  // Add click handlers to cells
  for (let noteIndex = 0; noteIndex < TOTAL_NOTES; noteIndex++) {
    for (let pulseIndex = 0; pulseIndex < SEQUENCE_PULSES; pulseIndex++) {
      const cell = musicalGrid.getCellElement(noteIndex, pulseIndex);
      if (cell) {
        cell.addEventListener('click', async () => {
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

          // Remove label after 500ms
          setTimeout(() => {
            cell.classList.remove('active');
            const label = cell.querySelector('.cell-label');
            if (label) label.remove();
          }, 500);
        });
      }
    }
  }

  // Setup Play button
  playBtn = document.getElementById('playBtn');
  if (playBtn) {
    playBtn.addEventListener('click', handlePlay);
  }

  // Listen for sound changes
  document.addEventListener('sharedui:sound', async (e) => {
    const { type, value } = e.detail;
    const audioInstance = await initAudio();

    if (type === 'base' && audioInstance && typeof audioInstance.setBase === 'function') {
      await audioInstance.setBase(value);
    }

    if (type === 'start' && audioInstance && typeof audioInstance.setStart === 'function') {
      await audioInstance.setStart(value);
    }
  });

  // Listen for instrument changes
  document.addEventListener('sharedui:instrument', async (e) => {
    const instrument = e.detail.instrument;
    await initAudio();
    await audio.setInstrument(instrument);

    const currentPrefs = preferenceStorage.load() || {};
    currentPrefs.selectedInstrument = instrument;
    preferenceStorage.save(currentPrefs);
  });

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

window.addEventListener('beforeunload', () => {
  if (musicalGrid) {
    musicalGrid.destroy?.();
  }
});

// ========== START ==========

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
