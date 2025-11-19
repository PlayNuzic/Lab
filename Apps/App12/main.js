// App12: Plano-Sucesión - 2D Step Sequencer with dual N+P sequences
// Uses matrix-seq module for coordinated note/pulse selection
// Uses musical-grid module for 2D grid visualization

import { createMusicalGrid } from '../../libs/musical-grid/index.js';
import { MelodicTimelineAudio } from '../../libs/sound/melodic-audio.js';
import { createGridEditor } from '../../libs/matrix-seq/index.js';
import { initMixerMenu } from '../../libs/app-common/mixer-menu.js';
import { initRandomMenu } from '../../libs/random/menu.js';
import { initP1ToggleUI } from '../../libs/shared-ui/sound-dropdown.js';
import { initAudioToggles } from '../../libs/app-common/audio-toggles.js';
import { getMixer, subscribeMixer } from '../../libs/sound/index.js';
import { registerFactoryReset, createPreferenceStorage } from '../../libs/app-common/preferences.js';
import { createMatrixHighlightController, highlightNoteOnSoundline } from '../../libs/app-common/matrix-highlight-controller.js';

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
let intervalLinesEnabledState = false; // State in memory for performance

// Elements
let playBtn = null;
let resetBtn = null;
let randomBtn = null;
let gridEditorContainer = null;

// ========== STORAGE HELPERS ==========
// Use shared preference storage module
const preferenceStorage = createPreferenceStorage('app12');

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

  // Clear interval paths
  if (musicalGrid?.clearIntervalPaths) {
    musicalGrid.clearIntervalPaths();
  }

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

  // Calculate min/max pairs (similar to App11's MIN_NOTES/MAX_NOTES)
  const MIN_PAIRS = Math.max(1, Math.floor(randPMax * 0.5)); // At least 50% of max
  const MAX_PAIRS = randPMax;

  // Generate random number of pairs (MIN_PAIRS to MAX_PAIRS)
  const numPairs = Math.floor(Math.random() * (MAX_PAIRS - MIN_PAIRS + 1)) + MIN_PAIRS;

  // Create array of all available pulses (0 to TOTAL_SPACES-1 = 0 to 7)
  const allPulses = Array.from({length: TOTAL_SPACES}, (_, i) => i);

  // Shuffle pulses using Fisher-Yates algorithm (more reliable than sort)
  for (let i = allPulses.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allPulses[i], allPulses[j]] = [allPulses[j], allPulses[i]];
  }

  // Select first numPairs pulses from shuffled array
  const selectedPulses = allPulses.slice(0, numPairs).sort((a, b) => a - b);

  // Generate pairs with random notes
  const pairs = selectedPulses.map(pulse => ({
    note: Math.floor(Math.random() * (randNMax + 1)),
    pulse: pulse
  }));

  // Set pairs
  gridEditor?.setPairs(pairs);

  // Update visual grid
  syncGridFromPairs(pairs);

  console.log('Random generation:', { bpm: currentBPM, pairs, numPairs, selectedPulses });
}

// ========== SYNCHRONIZATION ==========

function syncGridFromPairs(pairs) {
  if (!musicalGrid) return;

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

  // Load preferences to check if interval lines are enabled
  const prefs = preferenceStorage.load() || {};
  const intervalLinesEnabled = prefs.intervalLinesEnabled !== undefined ? prefs.intervalLinesEnabled : false;

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
}

// Helper: Separate pairs into independent voices (copy from musical-grid logic)
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

// createPlaneWrapper removed - now handled by createMusicalGrid()
// injectControlButtons removed - buttons now queried after DOM is ready

// ========== INITIALIZATION ==========

async function init() {
  console.log('Initializing App12: Plano-Sucesión...');

  // Inject DOM elements
  injectGridEditor();

  // Load preferences
  const prefs = preferenceStorage.load() || {};
  const intervalLinesEnabled = prefs.intervalLinesEnabled !== undefined ? prefs.intervalLinesEnabled : false;
  intervalLinesEnabledState = intervalLinesEnabled; // Store in memory

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
    showIntervals: {
      horizontal: true,
      vertical: false,
      cellLines: intervalLinesEnabled
    },
    intervalColor: '#4A9EFF',
    cellRenderer: (noteIndex, pulseIndex, cellElement) => {
      // Custom rendering: add label structure for N/P pairs
      cellElement.innerHTML = ''; // Clear any default content
    },
    onCellClick: async (noteIndex, pulseIndex, cellElement) => {
      // Check state from memory for performance
      if (intervalLinesEnabledState) {
        return; // Cell clicks DISABLED when interval lines are enabled
      }

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
      highlightNoteOnSoundline(musicalGrid, noteIndex, duration * 1000);

      // Check polyphony mode
      // Don't manipulate DOM directly - let syncGridFromPairs handle all visual updates
      if (!gridEditor) return;

      const currentPairs = gridEditor.getPairs();
      const isActive = currentPairs.some(p => p.note === noteIndex && p.pulse === pulseIndex);

      let newPairs;
      if (!polyphonyEnabled) {
        // ========== MONOPHONIC MODE ==========
        // Only one note per pulse allowed
        if (isActive) {
          // Remove this pair
          newPairs = currentPairs.filter(p => !(p.note === noteIndex && p.pulse === pulseIndex));
        } else {
          // Remove all pairs for this pulse, add only this one
          newPairs = currentPairs.filter(p => p.pulse !== pulseIndex);
          newPairs.push({ note: noteIndex, pulse: pulseIndex });
        }
      } else {
        // ========== POLYPHONIC MODE ==========
        // Multiple notes per pulse allowed
        if (isActive) {
          // Remove pair
          newPairs = currentPairs.filter(p => !(p.note === noteIndex && p.pulse === pulseIndex));
        } else {
          // Add pair
          newPairs = [...currentPairs, { note: noteIndex, pulse: pulseIndex }];
        }
      }

      // Update grid editor and sync visual state
      gridEditor.setPairs(newPairs);
      syncGridFromPairs(newPairs);
    },
    onDotClick: async (noteIndex, pulseIndex, dotElement) => {
      // N-P dots are clickable only when interval lines are enabled
      if (!intervalLinesEnabledState) {
        return; // Dot clicks DISABLED when interval lines are disabled
      }

      // Use the same logic as cell clicks
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
      highlightNoteOnSoundline(musicalGrid, noteIndex, duration * 1000);

      // Check polyphony mode
      if (!gridEditor) return;

      const currentPairs = gridEditor.getPairs();
      const isActive = currentPairs.some(p => p.note === noteIndex && p.pulse === pulseIndex);

      let newPairs;
      if (!polyphonyEnabled) {
        // MONOPHONIC MODE
        if (isActive) {
          // Remove this pair
          newPairs = currentPairs.filter(p => !(p.note === noteIndex && p.pulse === pulseIndex));
        } else {
          // Remove all pairs for this pulse, add only this one
          newPairs = currentPairs.filter(p => p.pulse !== pulseIndex);
          newPairs.push({ note: noteIndex, pulse: pulseIndex });
        }
      } else {
        // POLYPHONIC MODE
        if (isActive) {
          // Remove pair
          newPairs = currentPairs.filter(p => !(p.note === noteIndex && p.pulse === pulseIndex));
        } else {
          // Add pair
          newPairs = [...currentPairs, { note: noteIndex, pulse: pulseIndex }];
        }
      }

      // Update grid editor and sync visual state
      gridEditor.setPairs(newPairs);
      syncGridFromPairs(newPairs);
    }
  });

  // Reposition controls into grid wrapper
  const controls = document.querySelector('.controls');
  const gridWrapper = document.querySelector('.app12-main-grid');

  if (controls && gridWrapper) {
    // Extract controls from template
    controls.remove();

    // Create container for controls
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'two-column-layout__controls app12-controls-container';
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
  const isMobile = window.innerWidth <= 900;
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

  // Initialize highlight controller using shared module
  highlightController = createMatrixHighlightController({
    musicalGrid,
    gridEditor,
    totalNotes: TOTAL_NOTES,
    currentBPM: currentBPM
  });

  // Apply interval-mode class if enabled
  if (intervalLinesEnabled) {
    const gridContainer = document.querySelector('.grid-container');
    if (gridContainer) {
      gridContainer.classList.add('interval-mode');
    }
  }

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
        save: (data) => {
          // Save all keys from data object
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
      const currentPrefs = preferenceStorage.load() || {};
      currentPrefs.selectColor = color;
      preferenceStorage.save(currentPrefs);
    });
  }

  // Polyphony toggle
  const polyphonyToggle = document.getElementById('polyphonyToggle');
  if (polyphonyToggle) {
    // Load from storage (default: false = monophonic)
    const prefs = preferenceStorage.load() || {};
    polyphonyEnabled = prefs.polyphony === '1'; // Only true if explicitly set to '1'
    polyphonyToggle.checked = polyphonyEnabled;

    // Listen for changes
    polyphonyToggle.addEventListener('change', (e) => {
      polyphonyEnabled = e.target.checked;
      const currentPrefs = preferenceStorage.load() || {};
      currentPrefs.polyphony = polyphonyEnabled ? '1' : '0';
      preferenceStorage.save(currentPrefs);
      console.log('Polyphony mode:', polyphonyEnabled ? 'ENABLED (polyphonic)' : 'DISABLED (monophonic)');

      // When disabling polyphony, filter to keep only first note per pulse
      if (!polyphonyEnabled && gridEditor) {
        const currentPairs = gridEditor.getPairs();
        const pulsesMap = new Map();
        const filteredPairs = [];

        // Keep only N1 per pulse
        currentPairs.forEach(pair => {
          if (!pulsesMap.has(pair.pulse)) {
            pulsesMap.set(pair.pulse, true);
            filteredPairs.push(pair);
          }
        });

        // Update grid-editor and sync visual state (including interval paths)
        gridEditor.setPairs(filteredPairs);
        syncGridFromPairs(filteredPairs);

        console.log(`Polyphony disabled: ${currentPairs.length} → ${filteredPairs.length} notes (monophonic mode applied)`);
      }
    });
  }

  // Interval lines toggle
  const intervalLinesToggle = document.getElementById('intervalLinesToggle');
  if (intervalLinesToggle) {
    // Set initial state from preferences
    intervalLinesToggle.checked = intervalLinesEnabled;

    // Listen for changes
    intervalLinesToggle.addEventListener('change', () => {
      const enabled = intervalLinesToggle.checked;
      intervalLinesEnabledState = enabled; // Update memory state

      // Save to preferences
      const currentPrefs = preferenceStorage.load() || {};
      currentPrefs.intervalLinesEnabled = enabled;
      preferenceStorage.save(currentPrefs);

      // Toggle interval-mode class on grid container
      const gridContainer = document.querySelector('.grid-container');
      if (gridContainer) {
        if (enabled) {
          gridContainer.classList.add('interval-mode');
        } else {
          gridContainer.classList.remove('interval-mode');
        }
      }

      // Update grid configuration in real-time (no reload)
      if (musicalGrid && musicalGrid.intervalsConfig && gridEditor) {
        musicalGrid.intervalsConfig.cellLines = enabled;

        // Update N-P dot clickability
        musicalGrid.updateDotClickability(enabled);

        // Get current pairs from grid editor
        const currentPairs = gridEditor.getPairs();

        // Refresh labels AND interval paths via syncGridFromPairs
        // This ensures labels switch between coordinate mode and interval mode
        syncGridFromPairs(currentPairs);
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

  // Factory reset using shared module
  registerFactoryReset(() => {
    // 1. Clear grid state first
    handleReset();

    // 2. Clear all preferences (will use defaults on reload)
    preferenceStorage.clearAll();

    // 3. Set factory defaults
    preferenceStorage.save({
      selectedInstrument: 'piano',
      selectColor: '#E4570C',
      polyphony: '0',                // Polyphony DISABLED
      intervalLinesEnabled: false    // Interval lines DISABLED
    });

    // 4. Reload to ensure clean state
    window.location.reload();
  });

  console.log('App12 initialized successfully');
}

// createSoundlineWrapper and createTimelineWrapper removed - now handled by createMusicalGrid()

// ========== CLEANUP ==========

window.addEventListener('beforeunload', () => {
  // Stop audio engine and cleanup Tone.Transport
  if (audio) {
    audio.stop();
  }

  // Cleanup grid components
  if (musicalGrid) {
    musicalGrid.destroy?.();
  }

  if (gridEditor) {
    gridEditor.destroy?.();
  }
});

// Start initialization
init().catch(err => {
  console.error('Failed to initialize App12:', err);
});
