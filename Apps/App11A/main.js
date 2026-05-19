// App11A: Plano Visual - Visual-only 2D musical grid (no cell interaction)
// Simple random note generator with visual playback only

import { createMusicalGrid } from '../../libs/musical-grid/index.js';
import { registerFactoryReset, createPreferenceStorage } from '../../libs/app-common/preferences.js';
import { getMixer, subscribeMixer } from '../../libs/sound/index.js';
import { createMelodicAudioInitializer } from '../../libs/app-common/audio-init.js';
import { setupPianoPreload, isPianoLoaded } from '../../libs/sound/piano.js';
import { initMixerMenu } from '../../libs/app-common/mixer-menu.js';
import { initAudioToggles } from '../../libs/app-common/audio-toggles.js';
import { initP1ToggleUI } from '../../libs/shared-ui/sound-dropdown.js';
import { initIdleCaretFlash } from '../../libs/app-common/idle-caret-flash.js';

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
const preferenceStorage = createPreferenceStorage('app11a');

// ========== AUDIO INITIALIZATION ==========
// Use standardized melodic audio initializer (ensures Tone.js loads before AudioContext)
const _initAudio = createMelodicAudioInitializer({
  defaultInstrument: 'piano',
  getPreferences: () => preferenceStorage.load() || {}
});

async function initAudio() {
  if (!audio) {
    audio = await _initAudio();
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
  // Generem una sucessió de notes amb iT variable (1, 2 o 3 pulsos) que
  // omple SEQUENCE_PULSES sencer. Anem afegint notes (o silencis curts)
  // mentre quedi espai, escollint la duració amb un pes biaixat cap a 1
  // perquè iT=2 i iT=3 apareguin com a excepcions visibles, no com a
  // norma. El primer pols és sempre una nota (no comencem amb silenci).
  const notes = [];
  const silencePulses = [];
  // Distribució de duracions per a una nota: 60% iT=1, 30% iT=2, 10% iT=3.
  const durationDeck = [1, 1, 1, 1, 1, 1, 2, 2, 2, 3];
  let cursor = 0;
  let firstNote = true;

  while (cursor < SEQUENCE_PULSES) {
    const remaining = SEQUENCE_PULSES - cursor;
    // 25% de probabilitat d'inserir un silenci (mai al primer pols).
    if (!firstNote && Math.random() < 0.25) {
      silencePulses.push(cursor);
      cursor += 1;
      continue;
    }
    // Tria una duració del deck que càpiga en l'espai que queda.
    const candidates = durationDeck.filter(d => d <= remaining);
    const duration = candidates[Math.floor(Math.random() * candidates.length)];
    notes.push({
      note: getRandomNoteIndex(),
      pulse: cursor,
      duration,
    });
    cursor += duration;
    firstNote = false;
  }

  return { notes, silencePulses };
}

// ========== PLAY SEQUENCE ==========

async function handlePlay() {
  if (isPlaying) {
    // Stop playback
    stopPlayback();
    return;
  }

  // Set flag immediately to prevent double-click race condition
  isPlaying = true;

  // Switch icon to stop
  const playIcon = playBtn?.querySelector('.icon-play');
  const stopIcon = playBtn?.querySelector('.icon-stop');
  if (playIcon) playIcon.style.display = 'none';
  if (stopIcon) stopIcon.style.display = 'block';

  // Show loading indicator if piano not yet loaded
  if (!isPianoLoaded() && playIcon) {
    if (stopIcon) stopIcon.style.opacity = '0.5';
  }

  playBtn.classList.add('playing');

  // Ensure audio is loaded
  if (!audio) {
    await initAudio();
  }

  // Restore button opacity after loading
  const stopIconRestore = playBtn?.querySelector('.icon-stop');
  if (stopIconRestore) stopIconRestore.style.opacity = '1';

  // Check Tone.js is available
  if (!window.Tone) {
    console.warn('Tone.js not available yet');
    stopPlayback();
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

  // Clear all previous active states (no labels in App11A)
  document.querySelectorAll('.musical-cell.active').forEach(cell => {
    cell.classList.remove('active');
  });

  // Map de notes per pols d'inici (cada entrada porta note + duration).
  const notesByPulse = {};
  notes.forEach(({note, pulse, duration}) => {
    notesByPulse[pulse] = { note, duration };
  });

  // Register note provider before play (declarative scheduling).
  // Cada nota sona durant `duration` pulsos (× 0.9 per deixar un petit
  // gap audible entre notes consecutives).
  audio.registerNoteProvider('melody', (step) => {
    const entry = notesByPulse[step];
    if (entry === undefined) return null;
    return [{
      midi: BASE_MIDI + entry.note,
      duration: intervalSec * entry.duration * 0.9,
      velocity: 0.8,
    }];
  });

  // Start playback
  audio.play(
    SEQUENCE_PULSES,
    intervalSec,
    new Set(),
    false,
    (step) => {
      // onPulse callback: visual feedback only
      console.log(`Pulse ${step}`);

      // Use native interval highlighting from musical-grid
      musicalGrid.onPulseStep(step, intervalSec * 1000);

      const entry = notesByPulse[step];
      if (entry !== undefined) {
        // Visual feedback: highlight cell (no label in App11A).
        // Per a notes amb iT > 1, marquem `active` totes les cel·les
        // del rang [startPulse .. startPulse+duration-1] de la mateixa
        // nota, perquè la barra horitzontal de cel·les enceses
        // representi visualment la durada de la nota.
        // Les cel·les es queden actives fins al pròxim play (vegeu el
        // cleanup al començament de handlePlay i a stopPlayback en
        // mode "no preservar").
        const end = Math.min(step + entry.duration, SEQUENCE_PULSES);
        for (let p = step; p < end; p++) {
          const cell = musicalGrid.getCellElement(entry.note, p);
          if (cell) cell.classList.add('active');
        }
      }
    },
    () => {
      // onComplete - delay stop to let the last note ring out.
      // La última nota pot tenir iT=2/3, així que esperem la seva
      // duration sencera abans d'aturar el scheduler.
      const lastNote = notes[notes.length - 1];
      const tailPulses = lastNote ? lastNote.duration : 1;
      const lastNoteDelay = intervalSec * tailPulses * 0.9 * 1000;
      setTimeout(() => stopPlayback({ preserveHighlights: true }), lastNoteDelay);
    }
  );
}

/**
 * @param {Object} [opts]
 * @param {boolean} [opts.preserveHighlights=false]
 *   Quan la seqüència acaba naturalment volem deixar les cel·les
 *   il·luminades fins al pròxim play (passem `true`). Quan l'usuari
 *   prem stop a mig play o reinicia, netegem-ho tot (`false`).
 */
function stopPlayback({ preserveHighlights = false } = {}) {
  if (!isPlaying) return;
  isPlaying = false;

  // Stop audio
  audio?.stop();

  // Reset button icon
  const playIcon = playBtn?.querySelector('.icon-play');
  const stopIcon = playBtn?.querySelector('.icon-stop');
  if (playIcon) playIcon.style.display = 'block';
  if (stopIcon) stopIcon.style.display = 'none';
  playBtn?.classList.remove('playing');

  if (!preserveHighlights) {
    // Clear visual highlights
    document.querySelectorAll('.musical-cell.active, .musical-cell.fading-out').forEach(cell => {
      cell.classList.remove('active', 'fading-out');
    });
  }

  // Clear timeline pulse highlight (sempre — això és el cursor del
  // playback, no l'estat "nota tocada").
  document.querySelectorAll('.pulse-marker.highlighted').forEach(el => el.classList.remove('highlighted'));
}

// ========== INITIALIZATION ==========

async function init() {
  console.log('Initializing App11A...');

  // Setup piano preload in background (reduces latency on first play)
  setupPianoPreload({ delay: 300 });

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

  // Single-column layout: grid fills space, controls at bottom
  const mainGridWrapper = document.createElement('div');
  mainGridWrapper.className = 'app11-main-grid';

  // Grid container fills available space
  const gridContainer = document.createElement('div');
  gridContainer.id = 'grid-container';

  mainGridWrapper.appendChild(gridContainer);
  mainElement.appendChild(mainGridWrapper);

  // Move controls to end of wrapper (below grid)
  mainGridWrapper.appendChild(controls);

  // Load preferences
  const prefs = preferenceStorage.load() || {};

  // Create musical grid (no cell interaction in App11A). The last pulse
  // (index TOTAL_PULSES-1) renders as a `·` cycle-end marker — visual
  // only, not playable. Playback already caps at SEQUENCE_PULSES (0..7).
  musicalGrid = createMusicalGrid({
    parent: gridContainer,
    notes: TOTAL_NOTES,
    pulses: TOTAL_PULSES,
    showCycleEnd: true,
    noteFormatter: (index) => index.toString(),
    pulseFormatter: (index) => index.toString(),
    scrollEnabled: false,
    onCellClick: null,  // No cell interaction in App11A
    onPulseClick: null  // No pulse clicks either
  });

  console.log('Musical grid created (visual only)');

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

  // Listen for instrument changes (header dispatches on window)
  eventHandlers.sharedInstrument = async (e) => {
    const instrument = e.detail.instrument;
    console.log('Instrument changed to:', instrument);

    await initAudio();
    await audio.setInstrument(instrument);

    const currentPrefs = preferenceStorage.load() || {};
    currentPrefs.selectedInstrument = instrument;
    preferenceStorage.save(currentPrefs);
  };
  window.addEventListener('sharedui:instrument', eventHandlers.sharedInstrument);

  // Initialize P1 toggle
  const startIntervalToggle = document.getElementById('startIntervalToggle');
  const startSoundRow = document.querySelector('.interval-select-row');
  if (startIntervalToggle && startSoundRow) {
    initP1ToggleUI({
      checkbox: startIntervalToggle,
      startSoundRow: startSoundRow,
      storageKey: 'app11a:p1Toggle',
      onChange: async (enabled) => {
        const audioInstance = await initAudio();
        if (audioInstance && typeof audioInstance.setStartEnabled === 'function') {
          audioInstance.setStartEnabled(enabled);
        }
      }
    });
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
    localStorage.setItem('app11a-preferences', JSON.stringify({
      selectedInstrument: 'piano',
      selectColor: '#FFBB33'
    }));

    // 2. Sync UI without reload
    // Color picker
    const selectColorInput = document.getElementById('selectColor');
    if (selectColorInput) {
      selectColorInput.value = '#FFBB33';
      document.documentElement.style.setProperty('--select-color', '#FFBB33');
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
        storageKey: 'app11a:pulseAudio',
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

  initIdleCaretFlash({ targets: [document.getElementById('playBtn')] });
  console.log('App11A initialized successfully');
}

// ========== CLEANUP ==========

// Store handler references for cleanup
const eventHandlers = {
  playClick: null,
  sharedSound: null,
  sharedInstrument: null
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
    window.removeEventListener('sharedui:instrument', eventHandlers.sharedInstrument);
  }
});

// ========== START ==========

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
