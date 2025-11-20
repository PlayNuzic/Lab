// App15: Plano y Sucesión de Intervalos
// Extended version of App12 that works with intervals (iS-iT) instead of absolute positions

import { createMusicalGrid } from '../../libs/musical-grid/index.js';
import { createGridEditor } from '../../libs/matrix-seq/index.js';
import { MelodicTimelineAudio } from '../../libs/sound/melodic-audio.js';
import { initMixerMenu } from '../../libs/app-common/mixer-menu.js';
import { initRandomMenu } from '../../libs/random/menu.js';
import { initP1ToggleUI } from '../../libs/shared-ui/sound-dropdown.js';
import { initAudioToggles } from '../../libs/app-common/audio-toggles.js';
import { getMixer, subscribeMixer } from '../../libs/sound/index.js';
import { registerFactoryReset, createPreferenceStorage } from '../../libs/app-common/preferences.js';
import { createMatrixHighlightController, highlightNoteOnSoundline } from '../../libs/app-common/matrix-highlight-controller.js';
import { clearElement } from '../../libs/app-common/dom-utils.js';
import { intervalsToPairs } from '../../libs/matrix-seq/index.js';

// ========== CONFIGURATION ==========
const TOTAL_PULSES = 9;   // Horizontal: 0-8
const TOTAL_NOTES = 12;   // Vertical: 0-11 (MIDI 60-71)
const TOTAL_SPACES = 8;   // Spaces between pulses: 0-7
const DEFAULT_BPM = 120;

// ========== STATE ==========
let audio = null;
let musicalGrid = null;
let gridEditor = null;
const currentBPM = DEFAULT_BPM; // Locked to 120 BPM
let isPlaying = false;
let polyphonyEnabled = false; // Default: polyphony DISABLED (monophonic mode)
const intervalLinesEnabledState = true; // Always enabled in App15

// Store current intervals and pairs
let currentIntervals = [];
let currentPairs = [];

// Elements
let playBtn = null;
let resetBtn = null;
let randomBtn = null;
let gridEditorContainer = null;

// ========== STORAGE HELPERS ==========
// Use shared preference storage module - renamed to app15
const preferenceStorage = createPreferenceStorage('app15');

// ========== AUDIO INITIALIZATION ==========

async function initAudio() {
  if (!audio) {
    console.log('Initializing MelodicTimelineAudio...');
    audio = new MelodicTimelineAudio();
    await audio.ready();

    // Load default instrument from preferences
    const prefs = preferenceStorage.load() || {};
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
// Using shared matrix highlight controller module

let highlightController = null;

// ========== PLAYBACK ==========

async function handlePlay() {
  if (isPlaying) {
    // Immediate stop via audio engine
    stopPlayback();
    return;
  }

  // Ensure audio is initialized
  await initAudio();

  if (!window.Tone) {
    console.error('Tone.js not available');
    return;
  }

  // Get pairs from grid editor
  const allPairs = gridEditor.getPairs();

  // Group pairs by pulse for polyphonic playback
  const pulseGroups = {};
  allPairs.forEach(pair => {
    if (!pulseGroups[pair.pulse]) {
      pulseGroups[pair.pulse] = [];
    }
    pulseGroups[pair.pulse].push(60 + pair.note); // Store as MIDI notes
  });

  isPlaying = true;

  // Switch to stop icon
  const playIcon = playBtn.querySelector('.icon-play');
  const stopIcon = playBtn.querySelector('.icon-stop');
  if (playIcon && stopIcon) {
    playIcon.style.display = 'none';
    stopIcon.style.display = 'block';
  }

  const intervalSec = (60 / currentBPM);
  const totalPulses = TOTAL_PULSES; // 9 pulses (0-8)
  const Tone = window.Tone;

  // Start TimelineAudio transport-based playback
  audio.play(
    totalPulses,
    intervalSec,
    new Set(), // No accent sounds (pulse plays automatically on all beats)
    false, // No loop initially
    (step) => {
      // onPulse callback: Called on EVERY pulse (0-8), even if empty

      // 1) Visual feedback for pulse column
      highlightController?.highlightPulse(step);

      // 2) Play piano notes if any exist at this pulse
      const notes = pulseGroups[step];
      if (notes && notes.length > 0) {
        const duration = intervalSec * 0.9;
        const when = Tone.now(); // Immediate (already scheduled by transport)

        // Polyphonic: trigger all notes simultaneously
        notes.forEach(midi => {
          audio.playNote(midi, duration, when);

          // Visual feedback per cell
          const noteIndex = midi - 60;
          const cell = musicalGrid.getCellElement(noteIndex, step);
          if (cell) {
            cell.classList.add('playing');
            setTimeout(() => cell.classList.remove('playing'), duration * 1000);
          }
          highlightNoteOnSoundline(musicalGrid, noteIndex, duration * 1000);
        });
      }

      // 3) Pulse sound plays AUTOMATICALLY via TimelineAudio
      //    (controlled by pulseToggleBtn + mixer 'pulse' channel)
    },
    () => {
      // onComplete callback: Playback finished
      stopPlayback();
    }
  );
}

function stopPlayback() {
  isPlaying = false;
  audio?.stop();

  // Clear all highlights
  musicalGrid?.clearIntervalHighlights();
  highlightController?.clearHighlights();

  // Reset button icon
  const playIcon = playBtn.querySelector('.icon-play');
  const stopIcon = playBtn.querySelector('.icon-stop');
  if (playIcon && stopIcon) {
    playIcon.style.display = 'block';
    stopIcon.style.display = 'none';
  }

  // Clear any active playing animations
  document.querySelectorAll('.musical-cell.playing').forEach(cell => {
    cell.classList.remove('playing');
  });
}

// ========== GRID SYNCHRONIZATION ==========

// Helper: Separate pairs into independent voices (copy from App12)
function separateIntoVoices(pairs) {
  const voices = [];
  const sortedPairs = [...pairs].sort((a, b) => a.pulse - b.pulse);

  for (const pair of sortedPairs) {
    // Find a voice that doesn't have a note at this pulse
    let assignedVoice = voices.find(voice =>
      !voice.some(p => p.pulse === pair.pulse)
    );

    if (!assignedVoice) {
      // Create new voice
      assignedVoice = [];
      voices.push(assignedVoice);
    }

    assignedVoice.push(pair);
  }

  return voices;
}

function clearIntervalTubes() {
  document.querySelectorAll('.musical-cell.interval-span').forEach(cell => {
    cell.classList.remove('interval-span', 'interval-span-start', 'interval-span-end');
  });
}

function applyIntervalTubes(pairs) {
  clearIntervalTubes();
  if (!musicalGrid || !pairs || pairs.length === 0) return;

  const maxPulseIndex = TOTAL_SPACES - 1;
  const voices = polyphonyEnabled
    ? separateIntoVoices(pairs)
    : [pairs.slice().sort((a, b) => a.pulse - b.pulse)];

  voices.forEach(voice => {
    if (!voice || voice.length === 0) return;

    const sorted = [...voice].sort((a, b) => a.pulse - b.pulse);

    sorted.forEach((current, idx) => {
      const next = sorted[idx + 1];
      const endPulseExclusive = next ? Math.min(next.pulse, TOTAL_SPACES) : Math.min(current.pulse + 1, TOTAL_SPACES);

      for (let p = current.pulse; p < endPulseExclusive; p++) {
        if (p < 0 || p > maxPulseIndex) continue;
        const cell = musicalGrid.getCellElement(current.note, p);
        if (!cell) continue;
        cell.classList.add('interval-span');
        if (p === current.pulse) {
          cell.classList.add('interval-span-start');
        }
        if (p === endPulseExclusive - 1) {
          cell.classList.add('interval-span-end');
        }
      }
    });
  });
}

function syncGridFromPairs(pairs) {
  if (!musicalGrid) return;
  currentPairs = pairs;

  // PERFORMANCE: Incremental update instead of full redraw
  // Track which cells should be active
  const activeCells = new Set(pairs.map(p => `${p.note}-${p.pulse}`));

  // Clear only cells that are no longer active
  document.querySelectorAll('.musical-cell.active').forEach(cell => {
    const note = parseInt(cell.dataset.note);
    const pulse = parseInt(cell.dataset.pulse);
    const key = `${note}-${pulse}`;

    if (!activeCells.has(key)) {
      cell.classList.remove('active');
      const label = cell.querySelector('.cell-label');
      if (label) {
        label.remove();
      }
    }
  });

  // Clear interval paths before updating
  if (musicalGrid.clearIntervalPaths) {
    musicalGrid.clearIntervalPaths();
  }
  clearIntervalTubes();

  // Interval lines always enabled in App15
  const intervalLinesEnabled = intervalLinesEnabledState;

  // Filter out null notes
  const validPairs = pairs.filter(p => p.note !== null);

  // Calculate labels based on interval lines mode
  let labelsMap = new Map(); // Map: "note-pulse" -> label text

  if (intervalLinesEnabled && validPairs.length > 0) {
    // ========== INTERVAL MODE: Musical intervals ==========
    // Separate into voices (same logic as highlightIntervalPath)
    const voices = polyphonyEnabled ? separateIntoVoices(validPairs) : [validPairs.slice().sort((a, b) => a.pulse - b.pulse)];

    voices.forEach(voice => {
      if (voice.length === 0) return;

      // Sort by pulse
      const sorted = [...voice].sort((a, b) => a.pulse - b.pulse);

      // First note in voice: (N{note}, {duration}p)
      const first = sorted[0];
      const firstDuration = sorted.length > 1 ? sorted[1].pulse - first.pulse : 1;
      labelsMap.set(`${first.note}-${first.pulse}`, `(N${first.note}, ${firstDuration}p)`);

      // Subsequent notes: (+{interval}, {duration}p)
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];
        const soundInterval = curr.note - prev.note; // Semitones (can be negative)
        const temporalInterval = curr.pulse - prev.pulse; // Pulses
        const sign = soundInterval >= 0 ? '+' : '';
        labelsMap.set(`${curr.note}-${curr.pulse}`, `(${sign}${soundInterval}, ${temporalInterval}p)`);
      }
    });
  } else {
    // ========== NORMAL MODE: Coordinates (N, P) ==========
    validPairs.forEach(({ note, pulse }) => {
      labelsMap.set(`${note}-${pulse}`, `( ${note} , ${pulse} )`);
    });
  }

  // Activate cells and apply labels (only update if changed)
  validPairs.forEach(({ note, pulse }) => {
    const cell = musicalGrid.getCellElement(note, pulse);
    if (cell) {
      cell.classList.add('active');

      // PERFORMANCE: Only update label if text changed
      const expectedText = labelsMap.get(`${note}-${pulse}`) || `( ${note} , ${pulse} )`;
      let label = cell.querySelector('.cell-label');

      if (!label) {
        label = document.createElement('span');
        label.className = 'cell-label';
        label.textContent = expectedText;
        cell.appendChild(label);
      } else if (label.textContent !== expectedText) {
        label.textContent = expectedText;
      }
    }
  });

  // Highlight interval paths (if enabled)
  if (musicalGrid.highlightIntervalPath) {
    // Pass polyphonic flag to enable voice separation
    musicalGrid.highlightIntervalPath(validPairs, polyphonyEnabled);
  }

  // Apply tube-style spans for temporal intervals
  applyIntervalTubes(validPairs);

  // Save to storage
  saveCurrentState();
}

function syncIntervalsFromGrid(noteIndex, pulseIndex, duration) {
  // When a cell is dragged in the grid, update the corresponding interval
  // This is complex and might need more context about which interval to update

  // Find which interval this corresponds to
  let pulseCount = 0;
  for (let i = 0; i < currentIntervals.length; i++) {
    if (pulseCount === pulseIndex) {
      // Update this interval's temporal value
      currentIntervals[i].temporalInterval = duration;

      // Update the grid editor
      gridEditor.setPairs(currentPairs);

      // Save state
      saveCurrentState();
      break;
    }
    pulseCount += currentIntervals[i].temporalInterval;
  }
}

// ========== RESET ==========

function handleReset() {
  stopPlayback();

  // Clear editors
  gridEditor?.clear();
  musicalGrid?.clear();
  clearIntervalTubes();

  // Reset state
  currentIntervals = [];
  currentPairs = [];

  // Save cleared state
  saveCurrentState();
}

// ========== RANDOM ==========

function handleRandom() {
  // Get random settings
  const randPMax = parseInt(document.getElementById('randPMax')?.value || '7');
  const randNMax = parseInt(document.getElementById('randNMax')?.value || '11');

  // Generate random initial position
  const initialNote = Math.floor(Math.random() * (randNMax + 1));
  const initialPulse = Math.floor(Math.random() * Math.min(3, randPMax)); // Start early

  // Generate random intervals
  const numIntervals = Math.floor(Math.random() * 5) + 1; // 1-5 intervals
  const intervals = [];
  let currentNote = initialNote;
  let currentPulse = initialPulse;

  for (let i = 0; i < numIntervals && currentPulse < randPMax; i++) {
    // Random sound interval (limited by current note)
    const maxUp = 11 - currentNote;
    const maxDown = -currentNote;
    const soundInterval = Math.floor(Math.random() * (maxUp - maxDown + 1)) + maxDown;

    // Random temporal interval (limited by remaining pulses)
    const remainingPulses = randPMax - currentPulse;
    const temporalInterval = Math.min(
      Math.floor(Math.random() * 3) + 1, // 1-3 pulses
      remainingPulses
    );

    intervals.push({ soundInterval, temporalInterval });

    currentNote = (currentNote + soundInterval + 12) % 12;
    currentPulse += temporalInterval;

    if (currentPulse >= randPMax) break;
  }

  // Convert to pairs
  const pairs = intervalsToPairs(
    { note: initialNote, pulse: initialPulse },
    intervals
  );

  currentIntervals = intervals;
  currentPairs = pairs;

  // Update editor
  gridEditor.setPairs(pairs);

  // Sync to grid
  syncGridFromPairs(pairs);

  // Persist
  saveCurrentState();
}

// ========== STORAGE ==========

function saveCurrentState() {
  const prefs = preferenceStorage.load() || {};

  // Save current intervals and initial position
  prefs.intervals = currentIntervals;
  prefs.initialPair = currentPairs[0] || null;

  preferenceStorage.save(prefs);
}

function loadSavedState() {
  const prefs = preferenceStorage.load() || {};

  if (prefs.intervals && prefs.initialPair) {
    // Restore intervals
    const pairs = intervalsToPairs(prefs.initialPair, prefs.intervals);
    currentIntervals = prefs.intervals;
    currentPairs = pairs;
    gridEditor.setPairs(pairs);
    syncGridFromPairs(pairs);
  }
}

// ========== DOM INJECTION ==========

function injectGridEditor() {
  // Create container for grid editor
  gridEditorContainer = document.createElement('div');
  gridEditorContainer.id = 'gridEditorContainer';

  // Create main grid wrapper for proper CSS grid layout
  const appRoot = document.getElementById('app-root');
  if (appRoot) {
    // Create wrapper inside main element
    const mainElement = appRoot.querySelector('main');
    if (mainElement) {
      const gridWrapper = document.createElement('div');
      gridWrapper.className = 'two-column-layout app12-main-grid';

      // Move existing grid-container into wrapper
      const gridContainer = mainElement.querySelector('.grid-container');
      if (gridContainer) {
        gridContainer.classList.add('two-column-layout__main');
        gridWrapper.appendChild(gridContainer);
      }

      // Add grid-seq to wrapper
      gridWrapper.insertBefore(gridEditorContainer, gridWrapper.firstChild);

      // Append wrapper to main
      mainElement.appendChild(gridWrapper);
    } else {
      // Fallback: append directly to app-root
      appRoot.appendChild(gridEditorContainer);
    }
  }
}

// ========== INITIALIZATION ==========

async function initializeApp() {
  console.log('Initializing App15: Plano y Sucesión de Intervalos...');

  // Inject DOM elements to mirror App12 layout (controls + grid)
  injectGridEditor();

  // Wait for template DOM to settle
  await new Promise(resolve => setTimeout(resolve, 50));

  // Create musical grid (aligned to timeline like App12)
  const mainGridWrapper = document.querySelector('.app12-main-grid');
  musicalGrid = createMusicalGrid({
    parent: mainGridWrapper || document.getElementById('app-root'),
    notes: TOTAL_NOTES,
    pulses: TOTAL_PULSES,
    startMidi: 60,
    fillSpaces: true, // Align cells to the spaces between pulse markers
    cellClassName: 'musical-cell',
    activeClassName: 'active',
    highlightClassName: 'highlight',
    showIntervals: {
      horizontal: true,
      vertical: false,
      cellLines: intervalLinesEnabledState
    },
    intervalColor: '#4A9EFF',
    cellRenderer: (noteIndex, pulseIndex, cellElement) => {
      clearElement(cellElement);
    },
    onCellClick: async (noteIndex) => {
      // Preview note only (editing happens in zigzag grid)
      await initAudio();

      if (!window.Tone) {
        console.warn('Tone.js not available');
        return;
      }

      const midi = 60 + noteIndex;
      const duration = (60 / currentBPM) * 0.9;
      const Tone = window.Tone;
      audio.playNote(midi, duration, Tone.now());

      // Visual feedback on soundline
      highlightNoteOnSoundline(musicalGrid, noteIndex, duration * 1000);
    },
    onDotClick: async (noteIndex, pulseIndex) => {
      // Dot clicks allow quick toggle (and preview)
      await initAudio();

      if (!window.Tone) {
        console.warn('Tone.js not available');
        return;
      }

      const midi = 60 + noteIndex;
      const duration = (60 / currentBPM) * 0.9;
      const Tone = window.Tone;
      audio.playNote(midi, duration, Tone.now());

      highlightNoteOnSoundline(musicalGrid, noteIndex, duration * 1000);

      if (!gridEditor) return;

      const pairsAtMoment = gridEditor.getPairs();
      const isActive = pairsAtMoment.some(p => p.note === noteIndex && p.pulse === pulseIndex);

      let newPairs;
      if (!polyphonyEnabled) {
        if (isActive) {
          newPairs = pairsAtMoment.filter(p => !(p.note === noteIndex && p.pulse === pulseIndex));
        } else {
          newPairs = pairsAtMoment.filter(p => p.pulse !== pulseIndex);
          newPairs.push({ note: noteIndex, pulse: pulseIndex });
        }
      } else {
        if (isActive) {
          newPairs = pairsAtMoment.filter(p => !(p.note === noteIndex && p.pulse === pulseIndex));
        } else {
          newPairs = [...pairsAtMoment, { note: noteIndex, pulse: pulseIndex }];
        }
      }

      gridEditor.setPairs(newPairs);
      syncGridFromPairs(newPairs);
    }
  });

  // Reposition controls into grid wrapper (match App12)
  const controls = document.querySelector('.controls');
  const gridWrapper = document.querySelector('.app12-main-grid');

  if (controls && gridWrapper) {
    controls.remove();

    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'two-column-layout__controls app12-controls-container';
    controlsContainer.appendChild(controls);

    const gridContainer = gridWrapper.querySelector('.grid-container');
    if (gridContainer) {
      gridContainer.before(controlsContainer);
    } else {
      gridWrapper.appendChild(controlsContainer);
    }
  }

  // Create grid editor with scroll enabled on mobile, using interval zigzag mode
  const isMobile = window.innerWidth <= 900;
  gridEditor = createGridEditor({
    container: gridEditorContainer,
    noteRange: [0, 11],
    pulseRange: [0, TOTAL_SPACES - 1],
    maxPairs: TOTAL_SPACES,
    mode: 'interval',
    showZigzag: true,
    scrollEnabled: isMobile,
    containerSize: isMobile ? { maxHeight: '180px', width: '100%' } : null,
    columnSize: isMobile ? { width: '80px', minHeight: '150px' } : null,
    getPolyphonyEnabled: () => polyphonyEnabled,
    onPairsChange: (pairs) => {
      currentPairs = pairs;

      if (pairs.length > 1) {
        const intervals = [];
        for (let i = 1; i < pairs.length; i++) {
          const soundInterval = pairs[i].note - pairs[i - 1].note;
          const temporalInterval = pairs[i].pulse - pairs[i - 1].pulse;
          intervals.push({ soundInterval, temporalInterval });
        }
        currentIntervals = intervals;
      } else {
        currentIntervals = [];
      }

      syncGridFromPairs(pairs);
    }
  });

  // Initialize highlight controller using shared module
  highlightController = createMatrixHighlightController({
    musicalGrid,
    gridEditor,
    totalNotes: TOTAL_NOTES,
    currentBPM: currentBPM
  });

  // Wait for DOM to be fully rendered
  await new Promise(resolve => setTimeout(resolve, 30));

  // Query control buttons AFTER template has rendered
  playBtn = document.getElementById('playBtn');
  randomBtn = document.getElementById('randomBtn');
  resetBtn = document.getElementById('resetBtn');

  playBtn?.addEventListener('click', handlePlay);
  resetBtn?.addEventListener('click', handleReset);
  randomBtn?.addEventListener('click', handleRandom);

  // P1 Toggle (Pulse 0 special sound) - MUST be before mixer init
  const startIntervalToggle = document.getElementById('startIntervalToggle');
  const startSoundRow = document.querySelector('.interval-select-row');
  if (startIntervalToggle && startSoundRow) {
    window.__p1Controller = initP1ToggleUI({
      checkbox: startIntervalToggle,
      startSoundRow,
      storageKey: 'app15:p1Toggle',
      onChange: async (enabled) => {
        const audioInstance = await initAudio();
        if (audioInstance && typeof audioInstance.setStartEnabled === 'function') {
          audioInstance.setStartEnabled(enabled);
        }
      }
    });
  }

  // Mixer integration (longpress on play button)
  const mixerMenu = document.getElementById('mixerMenu');
  if (mixerMenu) {
    initMixerMenu({
      menu: mixerMenu,
      triggers: [playBtn].filter(Boolean),
      channels: [
        { id: 'pulse', label: 'Pulso', allowSolo: true },
        { id: 'instrument', label: 'Piano', allowSolo: true },
        { id: 'master', label: 'Master', allowSolo: false, isMaster: true }
      ]
    });
  }

  // Audio toggles (sync with mixer)
  const pulseToggleBtn = document.getElementById('pulseToggleBtn');
  if (pulseToggleBtn) {
    const globalMixer = getMixer();
    initAudioToggles({
      toggles: [
        {
          id: 'pulse',
          button: pulseToggleBtn,
          storageKey: 'app15:pulseAudio',
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
      const prefs = preferenceStorage.load() || {};
      prefs.selectColor = color;
      preferenceStorage.save(prefs);
    });
  }

  // Polyphony toggle
  const polyphonyToggle = document.getElementById('polyphonyToggle');
  if (polyphonyToggle) {
    const prefs = preferenceStorage.load() || {};
    polyphonyEnabled = prefs.polyphony === '1'; // Default false
    polyphonyToggle.checked = polyphonyEnabled;

    polyphonyToggle.addEventListener('change', (e) => {
      polyphonyEnabled = e.target.checked;
      const currentPrefs = preferenceStorage.load() || {};
      currentPrefs.polyphony = polyphonyEnabled ? '1' : '0';
      preferenceStorage.save(currentPrefs);

      if (!polyphonyEnabled && gridEditor) {
        const existingPairs = gridEditor.getPairs();
        const pulsesMap = new Map();
        const filteredPairs = [];

        existingPairs.forEach(pair => {
          if (!pulsesMap.has(pair.pulse)) {
            pulsesMap.set(pair.pulse, true);
            filteredPairs.push(pair);
          }
        });

        gridEditor.setPairs(filteredPairs);
        syncGridFromPairs(filteredPairs);
      }
    });
  }

  // Wire instrument dropdown to audio engine
  window.addEventListener('sharedui:instrument', async (e) => {
    const instrument = e.detail.instrument;
    await initAudio();
    await audio.setInstrument(instrument);

    const currentPrefs = preferenceStorage.load() || {};
    currentPrefs.selectedInstrument = instrument;
    preferenceStorage.save(currentPrefs);
  });

  // Factory reset using shared module
  registerFactoryReset(() => {
    handleReset();
    preferenceStorage.clearAll();
    preferenceStorage.save({
      selectedInstrument: 'piano',
      selectColor: '#E4570C',
      polyphony: '0',
      intervalLinesEnabled: true
    });
    window.location.reload();
  });

  // Load saved state after wiring everything
  loadSavedState();

  console.log('App15 initialized successfully');
}


// Wait for DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
