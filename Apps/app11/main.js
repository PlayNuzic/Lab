// App11: El Plano - Interactive 2D musical grid
// Simple random note generator with clickable cells

import { createMusicalGrid } from '../../libs/musical-grid/index.js';
import { registerFactoryReset, createPreferenceStorage } from '../../libs/app-common/preferences.js';
import { getMixer, subscribeMixer } from '../../libs/sound/index.js';
import { createMelodicAudioInitializer, setupAudioDefaults, CHANNEL_TIERS, createMixerPersistence } from '../../libs/app-common/audio-init.js';
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
const preferenceStorage = createPreferenceStorage('app11');

// ========== AUDIO INITIALIZATION ==========
// Use standardized melodic audio initializer (ensures Tone.js loads before AudioContext)
const _initAudio = createMelodicAudioInitializer({
  defaultInstrument: 'piano',
  getPreferences: () => preferenceStorage.load() || {}
});

const mixerPersist = createMixerPersistence({ storageKey: 'app11-mixer' });

async function initAudio() {
  if (!audio) {
    audio = await _initAudio();
    if (audio) {
      setupAudioDefaults(audio, { channels: CHANNEL_TIERS.MELODIC_PULSE });
      mixerPersist.hydrate(audio);
      mixerPersist.subscribe(audio);
    }
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

/**
 * Llegeix les cel·les que l'usuari ha sel·leccionat amb el mouse i les
 * retorna com a seqüència `[{note, pulse}]` ordenada per pols.
 * Filtra els pulsos >= SEQUENCE_PULSES (pols 8 és l'endpoint, no es
 * reprodueix). Retorna [] si no hi ha cap selecció vàlida.
 */
function getUserSelectedNotes() {
  const result = [];
  document.querySelectorAll('.musical-cell.active').forEach(cell => {
    const note = parseInt(cell.dataset.note, 10);
    const pulse = parseInt(cell.dataset.pulse, 10);
    if (!Number.isFinite(note) || !Number.isFinite(pulse)) return;
    if (pulse < 0 || pulse >= SEQUENCE_PULSES) return;
    result.push({ note, pulse });
  });
  result.sort((a, b) => a.pulse - b.pulse);
  return result;
}

async function handlePlay() {
  if (isPlaying) {
    stopPlayback();
    return;
  }

  isPlaying = true;

  // Switch icon to stop
  const playIcon = playBtn?.querySelector('.icon-play');
  const stopIcon = playBtn?.querySelector('.icon-stop');
  if (playIcon) playIcon.style.display = 'none';
  if (stopIcon) stopIcon.style.display = 'block';

  // Show loading indicator if piano not yet loaded
  if (!isPianoLoaded() && stopIcon) {
    stopIcon.style.opacity = '0.5';
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

  // Si l'usuari ha sel·leccionat cel·les a mà, reproduïm aquesta
  // seqüència tal com es veu en pantalla (mantenim BPM actual, no
  // netegem els highlights). Si no hi ha res sel·leccionat, generem
  // un nou random (BPM + notes) com sempre.
  const userNotes = getUserSelectedNotes();
  let notes;
  if (userNotes.length > 0) {
    notes = userNotes;
  } else {
    currentBPM = getRandomBPM();
    notes = generateRandomSequence().notes;
    // Clear only en mode random — el random vol partir d'una pissarra neta.
    document.querySelectorAll('.musical-cell.active').forEach(cell => {
      cell.classList.remove('active');
      const label = cell.querySelector('.cell-label');
      if (label) label.remove();
    });
  }

  console.log('=== Play Sequence ===');
  console.log(`BPM: ${currentBPM}`);
  console.log(`Mode: ${userNotes.length > 0 ? 'user-selected' : 'random'}`);
  console.log(`Notes (${notes.length}):`, notes.map(({note, pulse}) => `P${pulse}:N${note}`).join(', '));

  // Calculate interval
  intervalSec = 60 / currentBPM;

  // Create map of notes by pulse
  const notesByPulse = {};
  notes.forEach(({note, pulse}) => {
    notesByPulse[pulse] = note;
  });

  // Register note provider before play (declarative scheduling)
  audio.registerNoteProvider('melody', (step) => {
    const note = notesByPulse[step];
    if (note === undefined) return null;
    return [{ midi: BASE_MIDI + note, duration: intervalSec * 0.9, velocity: 0.8 }];
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

      // Playhead vertical line sobre la cel·la actual.
      musicalGrid.updatePlayhead(step);

      // Use native interval highlighting from musical-grid
      musicalGrid.onPulseStep(step, intervalSec * 1000);

      const note = notesByPulse[step];
      if (note !== undefined) {
        // Visual feedback: highlight cell and show label
        const cell = musicalGrid.getCellElement(note, step);
        if (cell) {
          cell.classList.add('active');
          // Marca de "sonant ara" — `.playing` aplica el blau intens +
          // glow (lib musical-grid). Es treu un pols després perquè
          // només es vegi durant el temps que dura la nota.
          cell.classList.add('playing');
          setTimeout(() => cell.classList.remove('playing'), intervalSec * 1000);

          // Add label
          if (!cell.querySelector('.cell-label')) {
            const label = document.createElement('span');
            label.className = 'cell-label';
            label.textContent = `( ${step} , ${note} )`;
            cell.appendChild(label);
          }
        }
      }
    },
    () => {
      // onComplete - delay stop to let the last note ring out.
      // Quan acaba naturalment, deixem les cel·les il·luminades fins
      // al pròxim play (preserveHighlights: true). El cleanup viu al
      // començament de `handlePlay` (línia "Clear all previous labels
      // and active states") i a `stopPlayback({})` si l'usuari atura.
      const lastNoteDelay = intervalSec * 0.9 * 1000;
      setTimeout(() => stopPlayback({ preserveHighlights: true }), lastNoteDelay);
    }
  );
}

/**
 * @param {Object} [opts]
 * @param {boolean} [opts.preserveHighlights=false]
 *   Quan la seqüència acaba naturalment volem deixar les cel·les
 *   (i les seves etiquetes) il·luminades fins al pròxim play. Quan
 *   l'usuari prem stop a mig play o reinicia, netegem-ho tot.
 */
function stopPlayback({ preserveHighlights = false } = {}) {
  if (!isPlaying) return;
  isPlaying = false;

  audio?.stop();

  const playIcon = playBtn?.querySelector('.icon-play');
  const stopIcon = playBtn?.querySelector('.icon-stop');
  if (playIcon) playIcon.style.display = 'block';
  if (stopIcon) stopIcon.style.display = 'none';
  playBtn?.classList.remove('playing');

  if (!preserveHighlights) {
    document.querySelectorAll('.musical-cell.active, .musical-cell.fading-out').forEach(cell => {
      cell.classList.remove('active', 'fading-out');
      const label = cell.querySelector('.cell-label');
      if (label) label.remove();
    });
  }

  // `.playing` (blau intens + glow) sempre es neteja — és la marca de
  // "sonant ara", no l'estat de la nota.
  document.querySelectorAll('.musical-cell.playing').forEach(cell => cell.classList.remove('playing'));

  // El cursor del playback (pulse-marker.highlighted) sempre es neteja
  // — és l'indicador "estem reproduint", no l'estat de la nota.
  document.querySelectorAll('.pulse-marker.highlighted').forEach(el => el.classList.remove('highlighted'));

  // Amaga el playhead vertical.
  musicalGrid?.hidePlayhead?.();
}

// ========== INITIALIZATION ==========

async function init() {
  console.log('Initializing App11...');

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

  const gridContainer = document.createElement('div');
  gridContainer.id = 'grid-container';

  mainGridWrapper.appendChild(gridContainer);

  // Append wrapper to main, controls at bottom
  mainElement.appendChild(mainGridWrapper);
  mainGridWrapper.appendChild(controls);

  // Load preferences
  const prefs = preferenceStorage.load() || {};

  // Create musical grid (no intervals in App11). The last pulse (index
  // TOTAL_PULSES-1) renders as a `·` cycle-end marker — visual only,
  // not selectable. Playback already caps at SEQUENCE_PULSES (0..7).
  musicalGrid = createMusicalGrid({
    parent: gridContainer,
    notes: TOTAL_NOTES,
    pulses: TOTAL_PULSES,
    showCycleEnd: true,
    noteFormatter: (index) => index.toString(),
    pulseFormatter: (index) => index.toString(),
    scrollEnabled: false,
    onCellClick: async (noteIndex, pulseIndex, cell) => {
      // Toggle: clicar una cel·la ja seleccionada la deselecciona (i no
      // sona). Clicar una buida la selecciona, sona la nota i el
      // highlight es queda fins al pròxim click o pròxim play. Mateix
      // model de persistència que el play (vegeu `stopPlayback` amb
      // `preserveHighlights: true`).
      if (cell.classList.contains('active')) {
        cell.classList.remove('active', 'fading-out');
        const label = cell.querySelector('.cell-label');
        if (label) label.remove();
        return;
      }

      // Monofònic per columna: si ja hi ha una nota activa en aquest
      // pols, la substituïm desactivant-la abans d'activar la nova.
      // (Els selectors filtren per `[data-pulse="${pulseIndex}"]` que
      // és el `data-pulse` que musical-grid posa a cada cel·la.)
      const cssSafePulse = window.CSS && window.CSS.escape ? CSS.escape(String(pulseIndex)) : String(pulseIndex);
      document.querySelectorAll(`.musical-cell.active[data-pulse="${cssSafePulse}"]`).forEach(prev => {
        if (prev === cell) return;
        prev.classList.remove('active', 'fading-out');
        const prevLabel = prev.querySelector('.cell-label');
        if (prevLabel) prevLabel.remove();
      });

      await initAudio();

      if (!window.Tone) {
        console.warn('Tone.js not available yet');
        return;
      }

      const midi = BASE_MIDI + noteIndex;
      const duration = intervalSec * 0.9;

      audio.playNote(midi, duration, window.Tone.now());

      cell.classList.add('active');
      if (!cell.querySelector('.cell-label')) {
        const label = document.createElement('span');
        label.className = 'cell-label';
        label.textContent = `( ${pulseIndex} , ${noteIndex} )`;
        cell.appendChild(label);
      }
    },
    onPulseClick: null  // Pulse clicks disabled - only cell clicks work in App11
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
      storageKey: 'app11:p1Toggle',
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
    localStorage.setItem('app11-preferences', JSON.stringify({
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
        { id: 'start', label: 'P0', allowSolo: true },
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

  initIdleCaretFlash({ targets: [document.querySelector('#grid-container')] });
  console.log('App11 initialized successfully');
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
