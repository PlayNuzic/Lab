// App12: Plano-Sucesión - 2D Step Sequencer with dual N+P sequences
// Uses matrix-seq module for coordinated note/pulse selection
// Uses musical-grid module for 2D grid visualization

import { createMusicalGrid } from '../../libs/musical-grid/index.js';
import { MelodicTimelineAudio } from '../../libs/sound/melodic-audio.js';
import { registerFactoryReset, createPreferenceStorage } from '../../libs/app-common/preferences.js';
import { createGridEditor } from '../../libs/matrix-seq/index.js';
import { initMixerMenu } from '../../libs/app-common/mixer-menu.js';
import { initRandomMenu } from '../../libs/random/menu.js';
import { initP1ToggleUI } from '../../libs/shared-ui/sound-dropdown.js';
import { initAudioToggles } from '../../libs/app-common/audio-toggles.js';
import { getMixer, subscribeMixer } from '../../libs/sound/index.js';

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

// Elements
let playBtn = null;
let resetBtn = null;
let randomBtn = null;
let gridEditorContainer = null;

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

// ========== HELPER FUNCTIONS ==========

/**
 * Get all cells in a specific pulse column
 * @param {number} pulseIndex - The pulse index (0-7)
 * @returns {Array<HTMLElement>} - Array of cell elements in that pulse
 */
function getCellsInPulse(pulseIndex) {
  const cells = [];
  for (let noteIndex = 0; noteIndex < TOTAL_NOTES; noteIndex++) {
    const cell = musicalGrid.getCellElement(noteIndex, pulseIndex);
    if (cell) cells.push(cell);
  }
  return cells;
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
    document.querySelectorAll('.pz.number.highlighted').forEach(el => {
      el.classList.remove('highlighted');
    });

    // Clear grid editor cell highlights
    if (gridEditor) {
      gridEditor.clearHighlights();
    }

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

    // Highlight grid editor cells for this pulse
    if (gridEditor) {
      // Highlight all cells in this pulse column
      gridEditor.highlightCell('N', pulse);
      gridEditor.highlightCell('P', pulse);
    }
  }

  function clearHighlights() {
    document.querySelectorAll('.pulse-marker.highlighted').forEach(el => {
      el.classList.remove('highlighted');
    });
    document.querySelectorAll('.musical-cell.pulse-highlight').forEach(el => {
      el.classList.remove('pulse-highlight');
    });
    if (gridEditor) {
      gridEditor.clearHighlights();
    }
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

  if (!window.Tone) {
    console.error('Tone.js not available');
    return;
  }

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
          highlightNoteOnSoundline(noteIndex, duration * 1000);
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

  // Stop audio engine (stops transport + releases all instrument notes)
  audio?.stop();

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
  gridEditor?.clear();
  musicalGrid?.clear();

  // Stop playback if playing
  if (isPlaying) {
    stopPlayback();
  }

  console.log('Reset to default state');
}

// ========== RANDOM GENERATION ==========

function handleRandom() {
  // Get parameters from random menu
  const randPMax = parseInt(document.getElementById('randPMax')?.value || 7, 10);
  const randNMax = parseInt(document.getElementById('randNMax')?.value || 11, 10);

  // Generate random number of pairs (1 to randPMax)
  const numPairs = Math.floor(Math.random() * randPMax) + 1;
  const pairs = [];

  for (let i = 0; i < numPairs; i++) {
    const note = Math.floor(Math.random() * (randNMax + 1));
    const pulse = i; // Sequential pulses
    pairs.push({ note, pulse });
  }

  // Set pairs
  gridEditor?.setPairs(pairs);

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

  // Activate cells for each pair (skip pairs with note=null used for preserving empty columns)
  pairs.forEach(({ note, pulse }) => {
    if (note === null) return; // Skip dummy pairs used to preserve empty pulse columns

    const cell = musicalGrid.getCellElement(note, pulse);
    if (cell) {
      cell.classList.add('active');

      // Add label if not exists
      if (!cell.querySelector('.cell-label')) {
        const label = document.createElement('span');
        label.className = 'cell-label';
        label.textContent = `( ${note} , ${pulse} )`;
        cell.appendChild(label);
      }
    }
  });
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
      gridWrapper.className = 'app12-main-grid';

      // Move existing grid-container into wrapper
      const gridContainer = mainElement.querySelector('.grid-container');
      if (gridContainer) {
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

// createPlaneWrapper removed - now handled by createMusicalGrid()
// injectControlButtons removed - buttons now queried after DOM is ready

// ========== INITIALIZATION ==========

async function init() {
  console.log('Initializing App12: Plano-Sucesión...');

  // Inject DOM elements
  injectGridEditor();

  // Create musical grid inside the main grid wrapper
  const mainGridWrapper = document.querySelector('.app12-main-grid');
  musicalGrid = createMusicalGrid({
    parent: mainGridWrapper || document.getElementById('app-root'), // Use grid wrapper if exists
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

      // Check polyphony mode
      if (!polyphonyEnabled) {
        // ========== MONOPHONIC MODE ==========
        // Only one note per pulse allowed

        const isActive = cellElement.classList.contains('active');

        if (isActive) {
          // Cell is active → toggle OFF (remove)
          cellElement.classList.remove('active');
          const label = cellElement.querySelector('.cell-label');
          if (label) label.remove();

          // Update grid editor: remove this pair
          if (gridEditor) {
            const currentPairs = gridEditor.getPairs();
            const filtered = currentPairs.filter(p => !(p.note === noteIndex && p.pulse === pulseIndex));
            gridEditor.setPairs(filtered);
          }
        } else {
          // Cell is inactive → deactivate all others in this pulse, activate only this one

          // Deactivate all other cells in this pulse column
          const allCellsInPulse = getCellsInPulse(pulseIndex);
          allCellsInPulse.forEach(cell => {
            if (cell !== cellElement && cell.classList.contains('active')) {
              cell.classList.remove('active');
              const label = cell.querySelector('.cell-label');
              if (label) label.remove();
            }
          });

          // Activate only this cell
          cellElement.classList.add('active');
          const label = document.createElement('span');
          label.className = 'cell-label';
          label.textContent = `( ${noteIndex} , ${pulseIndex} )`;
          cellElement.appendChild(label);

          // Update grid editor: remove all pairs for this pulse, add only this one
          if (gridEditor) {
            const currentPairs = gridEditor.getPairs();
            const filtered = currentPairs.filter(p => p.pulse !== pulseIndex);
            filtered.push({ note: noteIndex, pulse: pulseIndex });
            gridEditor.setPairs(filtered);
          }
        }
      } else {
        // ========== POLYPHONIC MODE ==========
        // Multiple notes per pulse allowed (CURRENT BEHAVIOR)

        const isActive = cellElement.classList.contains('active');
        cellElement.classList.toggle('active');

        // Manage label
        if (isActive) {
          // Removing: delete label
          const label = cellElement.querySelector('.cell-label');
          if (label) label.remove();
        } else {
          // Adding: create label if not exists
          if (!cellElement.querySelector('.cell-label')) {
            const label = document.createElement('span');
            label.className = 'cell-label';
            label.textContent = `( ${noteIndex} , ${pulseIndex} )`;
            cellElement.appendChild(label);
          }
        }

        // Update grid editor pairs
        if (gridEditor) {
          const currentPairs = gridEditor.getPairs();
          if (isActive) {
            // Remove pair
            const filtered = currentPairs.filter(p => !(p.note === noteIndex && p.pulse === pulseIndex));
            gridEditor.setPairs(filtered);
          } else {
            // Add pair
            currentPairs.push({ note: noteIndex, pulse: pulseIndex });
            gridEditor.setPairs(currentPairs);
          }
        }
      }
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

  // Reposition controls into grid wrapper
  const timelineWrapper = document.getElementById('timelineWrapper');
  const controls = timelineWrapper?.querySelector('.controls');
  const gridWrapper = document.querySelector('.app12-main-grid');

  if (controls && gridWrapper) {
    // Extract controls from timeline wrapper
    controls.remove();

    // Create container for controls
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'app12-controls-container';
    controlsContainer.appendChild(controls);

    // Insert into grid wrapper (between grid-seq and grid-container)
    const gridContainer = gridWrapper.querySelector('.grid-container');
    if (gridContainer) {
      gridContainer.before(controlsContainer);
    } else {
      gridWrapper.appendChild(controlsContainer);
    }
  }

  // Create grid editor with scroll enabled on mobile
  const isMobile = window.innerWidth <= 768;
  gridEditor = createGridEditor({
    container: gridEditorContainer,
    noteRange: [0, 11],
    pulseRange: [0, 7],
    maxPairs: 8,
    getPolyphonyEnabled: () => polyphonyEnabled,
    scrollEnabled: isMobile,
    containerSize: isMobile ? { maxHeight: '180px', width: '100%' } : null,
    columnSize: isMobile ? { width: '80px', minHeight: '150px' } : null,
    onPairsChange: (pairs) => {
      syncGridFromPairs(pairs);
    }
  });

  // Initialize highlight controller
  highlightController = createMatrixHighlightController();

  // Wait for DOM to be fully populated by template system
  await new Promise(resolve => setTimeout(resolve, 50));

  // Query control buttons AFTER template has rendered
  playBtn = document.getElementById('playBtn');
  randomBtn = document.getElementById('randomBtn');
  resetBtn = document.getElementById('resetBtn');

  // Event listeners (now buttons exist)
  playBtn?.addEventListener('click', handlePlay);
  resetBtn?.addEventListener('click', handleReset);
  randomBtn?.addEventListener('click', handleRandom);

  // P1 Toggle (Pulse 0 special sound) - MUST be before mixer init
  const startIntervalToggle = document.getElementById('startIntervalToggle');
  const startSoundRow = document.querySelector('.interval-select-row');
  if (startIntervalToggle && startSoundRow) {
    window.__p1Controller = initP1ToggleUI({
      checkbox: startIntervalToggle,
      startSoundRow: startSoundRow,
      storageKey: 'app12:p1Toggle',
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
          storageKey: 'app12:pulseAudio',
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
        save: (data) => preferenceStorage.save(data)
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
      const currentPrefs = preferenceStorage.load() || {};
      currentPrefs.selectColor = color;
      preferenceStorage.save(currentPrefs);
    });
  }

  // Polyphony toggle
  const polyphonyToggle = document.getElementById('polyphonyToggle');
  if (polyphonyToggle) {
    // Load from storage (default: false = monophonic)
    const storedPolyphony = preferenceStorage.load('polyphony');
    polyphonyEnabled = storedPolyphony === '1'; // Only true if explicitly set to '1'
    polyphonyToggle.checked = polyphonyEnabled;

    // Listen for changes
    polyphonyToggle.addEventListener('change', (e) => {
      polyphonyEnabled = e.target.checked;
      preferenceStorage.save('polyphony', polyphonyEnabled ? '1' : '0');
      console.log('Polyphony mode:', polyphonyEnabled ? 'ENABLED (polyphonic)' : 'DISABLED (monophonic)');

      // Adaptation: When disabling polyphony, filter to keep only first note per pulse
      if (!polyphonyEnabled && gridPairs.length > 0) {
        const pulsesMap = new Map();
        const filteredPairs = [];

        // Keep only first note (N1) per pulse
        gridPairs.forEach(pair => {
          if (!pulsesMap.has(pair.pulse)) {
            pulsesMap.set(pair.pulse, true);
            filteredPairs.push(pair);
          }
        });

        // Update gridPairs and re-render
        gridPairs = filteredPairs;
        gridLayoutController.render(filteredPairs);

        // Update cellStates to remove N2+ cells
        const newCellStates = new Map();
        filteredPairs.forEach(pair => {
          const key = `${pair.note}-${pair.pulse}`;
          if (cellStates.has(key)) {
            newCellStates.set(key, cellStates.get(key));
          }
        });
        cellStates.clear();
        newCellStates.forEach((value, key) => cellStates.set(key, value));

        console.log('Polyphony disabled: Filtered to N1 only per pulse');
      }
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
