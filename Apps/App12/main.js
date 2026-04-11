// App12: Plano-Sucesión - 2D Step Sequencer with dual N+P sequences
// Uses matrix-seq module for coordinated note/pulse selection
// Uses musical-grid module for 2D grid visualization

import { createMusicalGrid } from '../../libs/musical-grid/index.js';
import { createGridEditor } from '../../libs/matrix-seq/index.js';
import { initMixerMenu } from '../../libs/app-common/mixer-menu.js';
import { initRandomMenu } from '../../libs/random/menu.js';
import { initP1ToggleUI } from '../../libs/shared-ui/sound-dropdown.js';
import { initAudioToggles } from '../../libs/app-common/audio-toggles.js';
import { getMixer, subscribeMixer, setChannelVolume, setChannelMute, setVolume, setMute } from '../../libs/sound/index.js';
import { registerFactoryReset, createPreferenceStorage } from '../../libs/app-common/preferences.js';
import { createMatrixHighlightController } from '../../libs/app-common/matrix-highlight-controller.js';
import { clearElement } from '../../libs/app-common/dom-utils.js';
import { createMelodicAudioInitializer } from '../../libs/app-common/audio-init.js';
import { setupPianoPreload, isPianoLoaded } from '../../libs/sound/piano.js';
import { createBpmController } from '../../libs/app-common/bpm-controller.js';
import { initIdleCaretFlash } from '../../libs/app-common/idle-caret-flash.js';

// ========== CONFIGURATION ==========
const TOTAL_PULSES = 9;   // Horizontal: 0-8
const TOTAL_NOTES = 12;   // Vertical: 0-11 (MIDI 60-71)
const TOTAL_SPACES = 8;   // Spaces between pulses: 0-7
const DEFAULT_BPM = 90;
const MIN_BPM = 50;
const MAX_BPM = 150;

// ========== STATE ==========
let audio = null;
let musicalGrid = null;
let gridEditor = null; // Nuzic N-P editor (replaces matrix-seq grid-editor)
let bpmController = null;
let currentBPM = DEFAULT_BPM;
let isPlaying = false;
let polyphonyEnabled = false; // Default: polyphony DISABLED (monophonic mode)

// Elements
let playBtn = null;
let resetBtn = null;
let randomBtn = null;
let gridEditorContainer = null;

// ========== STORAGE HELPERS ==========
// Use shared preference storage module
const preferenceStorage = createPreferenceStorage('app12');

// ========== AUDIO INITIALIZATION ==========
// Use standardized melodic audio initializer (ensures Tone.js loads before AudioContext)
const _initAudio = createMelodicAudioInitializer({
  defaultInstrument: 'piano',
  getPreferences: () => preferenceStorage.load() || {}
});

async function initAudio() {
  if (!audio) {
    audio = await _initAudio();

    // Configure FX defaults: FX On, Comp -3, Lim -1
    if (audio) {
      audio.setEffectsEnabled(true);
      audio.setCompressorThreshold(-3);
      audio.setLimiterThreshold(-1);
    }

    // Sync P1 toggle state with audio engine (P1 defaults to enabled in audio,
    // but user may have saved it as disabled - sync from localStorage)
    const p1Stored = localStorage.getItem('app12:p1Toggle');
    if (audio && p1Stored === 'false' && typeof audio.setStartEnabled === 'function') {
      audio.setStartEnabled(false);
    }
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

  // Show loading indicator if piano not yet loaded
  const playIcon = playBtn?.querySelector('.icon-play');
  const stopIcon = playBtn?.querySelector('.icon-stop');
  let wasLoading = false;

  if (!isPianoLoaded() && playBtn) {
    wasLoading = true;
    playBtn.disabled = true;
    if (playIcon) playIcon.style.opacity = '0.5';
  }

  // Ensure audio is initialized
  await initAudio();

  // Restore button state after loading
  if (wasLoading && playBtn) {
    playBtn.disabled = false;
    if (playIcon) playIcon.style.opacity = '1';
  }

  if (!window.Tone) {
    console.error('Tone.js not available');
    return;
  }

  const allPairs = gridEditor.getPairs();

  // Group pairs by pulse for polyphonic playback (skip rests)
  const pulseGroups = {};
  allPairs.forEach(pair => {
    if (pair.isRest || pair.note === null) return;
    if (!pulseGroups[pair.pulse]) {
      pulseGroups[pair.pulse] = [];
    }
    pulseGroups[pair.pulse].push(60 + pair.note);
  });

  isPlaying = true;

  // Disable random button during playback
  if (randomBtn) randomBtn.disabled = true;

  // Switch to stop icon (playIcon and stopIcon already declared above)
  if (playIcon && stopIcon) {
    playIcon.style.display = 'none';
    stopIcon.style.display = 'block';
  }

  const intervalSec = (60 / currentBPM);
  const totalPulseSounds = TOTAL_SPACES; // 8 pulse sounds (spaces 0-7)

  // Register note provider before play (declarative scheduling)
  audio.registerNoteProvider('melody', (step) => {
    const notes = pulseGroups[step];
    if (!notes || notes.length === 0) return null;
    const duration = intervalSec * 0.9;
    return notes.map(midi => ({ midi, duration, velocity: 0.8 }));
  });

  // Start TimelineAudio transport-based playback
  audio.play(
    totalPulseSounds,
    intervalSec,
    new Set(), // No accent sounds (pulse plays automatically on all beats)
    false, // No loop initially
    (step) => {
      // onPulse callback: visual feedback only

      // 1) Visual feedback for pulse column
      highlightController?.highlightPulse(step);

      // 2) Visual feedback for playing cells
      const notes = pulseGroups[step];
      if (notes && notes.length > 0) {
        const duration = intervalSec * 0.9;

        notes.forEach(midi => {
          const noteIndex = midi - 60;
          const cell = musicalGrid.getCellElement(noteIndex, step);
          if (cell) {
            cell.classList.add('playing');
            setTimeout(() => cell.classList.remove('playing'), duration * 1000);
          }
        });
      }

      // 3) Pulse sound plays AUTOMATICALLY via TimelineAudio
      //    (controlled by pulseToggleBtn + mixer 'pulse' channel)
    },
    () => {
      // onComplete callback: Playback finished
      // Delay audio.stop() to let the last note ring out (90% of interval)
      const lastNoteDelay = intervalSec * 0.9 * 1000;
      stopPlayback(lastNoteDelay);
    }
  );
}

function stopPlayback(delayMs = 0) {
  isPlaying = false;

  // Re-enable random button after playback
  if (randomBtn) randomBtn.disabled = false;

  // Stop audio engine (stops transport + releases all instrument notes)
  // delayMs > 0 allows last note to ring out before disconnecting sampler
  if (delayMs > 0) {
    setTimeout(() => {
      audio?.stop();
    }, delayMs);
  } else {
    audio?.stop();
  }

  // Save last highlighted pulse-marker before clearing
  const lastHighlighted = document.querySelector('.pulse-marker.highlighted');

  // Clear pulse highlights (this also clears .pulse-marker.highlighted)
  highlightController?.clearHighlights();

  // Re-apply highlight to last pulse, then clear after delay
  if (lastHighlighted) {
    lastHighlighted.classList.add('highlighted');
    setTimeout(() => lastHighlighted.classList.remove('highlighted'), 500);
  }

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
  // Prevent random during playback
  if (isPlaying) return;

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

  // Generate pairs with random notes (20% chance of silence)
  const pairs = selectedPulses.map(pulse => {
    if (Math.random() < 0.2) {
      return { note: null, pulse, isRest: true };
    }
    return { note: Math.floor(Math.random() * (randNMax + 1)), pulse };
  });

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
  // Track which cells should be active (skip rests)
  const activeCells = new Set(pairs.filter(p => !p.isRest && p.note !== null).map(p => `${p.note}-${p.pulse}`));

  // Track which cells should show rest (silence dotted line)
  // Resolve note for silences with note:null by using the previous playable note
  const restCells = new Set();
  const sortedForRest = [...pairs].sort((a, b) => a.pulse - b.pulse);
  let lastRestNote = 0;
  sortedForRest.forEach(p => {
    if (!p.isRest && p.note !== null) {
      lastRestNote = p.note;
    } else if (p.isRest) {
      const noteForRest = p.note !== null && p.note !== undefined ? p.note : lastRestNote;
      restCells.add(`${noteForRest}-${p.pulse}`);
    }
  });

  // Clear only cells that are no longer active or rest
  document.querySelectorAll('.musical-cell.active, .musical-cell.rest').forEach(cell => {
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
    if (!restCells.has(key)) {
      cell.classList.remove('rest');
    }
  });

  // Clear interval paths before updating
  if (musicalGrid.clearIntervalPaths) {
    musicalGrid.clearIntervalPaths();
  }

  // Filter out null notes and rests for active cell rendering
  const validPairs = pairs.filter(p => !p.isRest && p.note !== null);

  // Calculate labels - always in N-P coordinate mode
  const labelsMap = new Map(); // Map: "note-pulse" -> label text
  validPairs.forEach(({ note, pulse }) => {
    labelsMap.set(`${note}-${pulse}`, `( ${note} , ${pulse} )`);
  });

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

  // Render silence cells (dotted line on the note row)
  restCells.forEach(key => {
    const [note, pulse] = key.split('-').map(Number);
    const cell = musicalGrid.getCellElement(note, pulse);
    if (cell) {
      cell.classList.add('rest');
    }
  });

  // Highlight interval paths (if enabled)
  if (musicalGrid.highlightIntervalPath) {
    // Pass polyphonic flag to enable voice separation
    musicalGrid.highlightIntervalPath(validPairs, polyphonyEnabled);
  }
}

// ========== NUZIC N-P EDITOR ==========

let currentPairs = []; // Array of { note: 0-11, pulse: 0-7 }

function createNuzicEditor(timelineWrapper) {
  const BLOCK = 35;
  const editorEl = document.createElement('div');
  editorEl.className = 'np-editor';

  // N row (notes - pink)
  const nBar = document.createElement('div');
  nBar.className = 'editor-bar editor-bar--n';
  const nLabel = document.createElement('div');
  nLabel.className = 'editor-label editor-label--n';
  nLabel.textContent = 'N';
  nBar.appendChild(nLabel);
  const nCells = document.createElement('div');
  nCells.className = 'editor-cells';
  const nEndMarker = document.createElement('div');
  nEndMarker.className = 'editor-end-marker';
  nCells.appendChild(nEndMarker);
  nBar.appendChild(nCells);

  // P row (pulses - cream)
  const pBar = document.createElement('div');
  pBar.className = 'editor-bar editor-bar--p';
  const pLabel = document.createElement('div');
  pLabel.className = 'editor-label editor-label--p';
  pLabel.textContent = 'P';
  pBar.appendChild(pLabel);
  const pCells = document.createElement('div');
  pCells.className = 'editor-cells';
  const pEndMarker = document.createElement('div');
  pEndMarker.className = 'editor-end-marker';
  pCells.appendChild(pEndMarker);
  pBar.appendChild(pCells);

  editorEl.appendChild(nBar);
  editorEl.appendChild(pBar);

  // Insert into .grid-container (grid-row: 3, aligned with matrix)
  const gridContainer = timelineWrapper.closest('.grid-container');
  if (gridContainer) {
    gridContainer.appendChild(editorEl);
  } else {
    timelineWrapper.insertAdjacentElement('afterend', editorEl);
  }

  function renderEditor() {
    // Clear existing cells
    nCells.querySelectorAll('.editor-cell').forEach(c => c.remove());
    pCells.querySelectorAll('.editor-cell').forEach(c => c.remove());

    // Build cells for each entered pair: [white:value][color] per row
    for (const pair of currentPairs) {
      // N: white value + pink separator
      const nVal = createCell('n', false);
      nVal.value = String(pair.note);
      nVal.readOnly = true;
      nCells.insertBefore(nVal, nEndMarker);
      const nSep = createCell('n', true);
      nCells.insertBefore(nSep, nEndMarker);

      // P: white value + cream separator
      const pVal = createCell('p', false);
      pVal.value = String(pair.pulse);
      pVal.readOnly = true;
      pCells.insertBefore(pVal, pEndMarker);
      const pSep = createCell('p', true);
      pCells.insertBefore(pSep, pEndMarker);
    }

    // If not full: white input + color separator
    if (currentPairs.length < TOTAL_SPACES) {
      // N: white input + pink
      const nInput = createInputCell('n');
      nCells.insertBefore(nInput, nEndMarker);
      const nSep = createCell('n', true);
      nCells.insertBefore(nSep, nEndMarker);

      // P: white input + cream (both N and P editable from start)
      const pInput = createInputCell('p');
      pCells.insertBefore(pInput, pEndMarker);
      const pSep = createCell('p', true);
      pCells.insertBefore(pSep, pEndMarker);

      // Auto-focus N input
      setTimeout(() => nInput.focus(), 30);
    }

    // End markers
    nEndMarker.style.display = currentPairs.length >= TOTAL_SPACES ? 'flex' : 'none';
    pEndMarker.style.display = currentPairs.length >= TOTAL_SPACES ? 'flex' : 'none';
  }

  function createCell(type, isCream) {
    const cell = document.createElement('input');
    cell.type = 'text';
    cell.className = `editor-cell editor-cell--${type}`;
    cell.placeholder = ' ';
    cell.readOnly = true;
    return cell;
  }

  let pendingNote = null;
  let pendingPulse = null;
  let autoJumpTimer = null;

  // Simple tooltip
  let tooltipEl = null;
  function showEditorTooltip(anchor, message) {
    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.className = 'editor-tooltip';
      document.body.appendChild(tooltipEl);
    }
    tooltipEl.textContent = message;
    const rect = anchor.getBoundingClientRect();
    tooltipEl.style.left = `${rect.left}px`;
    tooltipEl.style.top = `${rect.bottom + 4}px`;
    tooltipEl.classList.add('visible');
    clearTimeout(tooltipEl._timer);
    tooltipEl._timer = setTimeout(() => tooltipEl.classList.remove('visible'), 2000);
  }

  function addPair(note, pulse) {
    // Rule 3: no duplicate pulses
    if (currentPairs.some(p => p.pulse === pulse)) {
      const pInput = pCells.querySelector('.editor-input:not([readonly])');
      if (pInput) showEditorTooltip(pInput, 'Pulso ya usado');
      return false;
    }
    currentPairs.push({ note, pulse });
    // Rule 4: auto-sort by pulse ascending
    currentPairs.sort((a, b) => a.pulse - b.pulse);
    return true;
  }

  function commitPair() {
    const note = pendingNote;
    const pulse = pendingPulse;
    if (note === null || pulse === null) return;

    if (addPair(note, pulse)) {
      pendingNote = null;
      pendingPulse = null;
      renderEditor();
      syncGridFromPairs(currentPairs);
    }
  }

  function createInputCell(type) {
    const cell = document.createElement('input');
    cell.type = 'text';
    cell.inputMode = 'numeric';
    cell.maxLength = 2;
    cell.className = `editor-cell editor-cell--${type} editor-input`;
    cell.readOnly = false;

    cell.addEventListener('input', (e) => {
      const val = e.target.value;
      // Allow empty (user is deleting)
      if (val === '') return;
      // Strip non-numeric
      if (!/^-?\d+$/.test(val)) { e.target.value = ''; return; }

      const num = parseInt(val);

      if (type === 'n') {
        // Rule 1: Note 0-11
        if (num < 0 || num > 11) {
          showEditorTooltip(cell, 'Nota: 0-11');
          e.target.value = '';
          return;
        }
        pendingNote = num;

        // Rule 6: delay 300ms for 2-digit input (e.g. "11")
        clearTimeout(autoJumpTimer);
        autoJumpTimer = setTimeout(() => {
          // If P already entered, commit pair
          if (pendingPulse !== null) {
            commitPair();
          } else {
            // Jump to P input
            const pInput = pCells.querySelector('.editor-input');
            if (pInput) pInput.focus();
          }
        }, 300);

      } else {
        // Rule 2: Pulse 0-7
        if (num < 0 || num > 7) {
          showEditorTooltip(cell, 'Pulso: 0-7');
          e.target.value = '';
          return;
        }
        pendingPulse = num;

        // If N already entered, commit pair
        if (pendingNote !== null) {
          clearTimeout(autoJumpTimer);
          commitPair();
          // Rule 5: P=7 auto-blur (last pulse)
          if (num === 7) return;
        } else {
          // Jump to N input
          const nInput = nCells.querySelector('.editor-input');
          if (nInput) nInput.focus();
        }
      }
    });

    cell.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value) {
        e.preventDefault();
        clearTimeout(autoJumpTimer);

        if (type === 'p') {
          if (pendingPulse !== null) {
            pendingPulse = null;
          } else if (pendingNote !== null) {
            // Go back to N input
            pendingNote = null;
            const nInput = nCells.querySelector('.editor-input');
            if (nInput) { nInput.value = ''; nInput.focus(); }
          } else if (currentPairs.length > 0) {
            currentPairs.pop();
            renderEditor();
            syncGridFromPairs(currentPairs);
          }
        } else if (type === 'n') {
          if (pendingNote !== null) {
            pendingNote = null;
          } else if (currentPairs.length > 0) {
            currentPairs.pop();
            renderEditor();
            syncGridFromPairs(currentPairs);
          }
        }
      }
    });

    return cell;
  }

  // Public API (compatible with old gridEditor interface)
  gridEditor = {
    getPairs: () => currentPairs.map(p => ({ ...p })),
    setPairs: (pairs) => {
      currentPairs = pairs.filter(p => p.note !== null && !p.isRest);
      renderEditor();
    },
    clear: () => {
      currentPairs = [];
      pendingNote = null;
      renderEditor();
    },
    destroy: () => {
      editorEl.remove();
    }
  };

  renderEditor();
  return editorEl;
}

// ========== DOM INJECTION ==========

function injectGridEditor() {
  // Create main grid wrapper for proper CSS grid layout
  const appRoot = document.getElementById('app-root');
  if (appRoot) {
    const mainElement = appRoot.querySelector('main');
    if (mainElement) {
      const gridWrapper = document.createElement('div');
      gridWrapper.className = 'app12-main-grid';
      mainElement.appendChild(gridWrapper);
    }
  }
}

// createPlaneWrapper removed - now handled by createMusicalGrid()
// injectControlButtons removed - buttons now queried after DOM is ready

// ========== INITIALIZATION ==========

async function init() {
  console.log('Initializing App12: Plano-Sucesión...');

  // Setup piano preload in background (reduces latency on first play)
  setupPianoPreload({ delay: 300 });

  // Inject DOM elements
  injectGridEditor();

  // Load preferences
  const prefs = preferenceStorage.load() || {};

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
      vertical: false
    },
    intervalColor: '#4A9EFF',
    cellRenderer: (noteIndex, pulseIndex, cellElement) => {
      // Custom rendering: add label structure for N/P pairs
      clearElement(cellElement); // Clear any default content (XSS-safe)
    },
    onCellClick: async (noteIndex, pulseIndex, cellElement) => {
      // Play MIDI note on click via audio engine
      const audioInstance = await initAudio();

      if (!window.Tone || !audioInstance) {
        console.warn('Audio not available');
        return;
      }

      const midi = 60 + noteIndex; // C4 = MIDI 60
      const duration = (60 / currentBPM) * 0.9; // 1 pulse duration (90% for clean separation)
      const Tone = window.Tone;
      audioInstance.playNote(midi, duration, Tone.now());

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
    onDotClick: null // N-P dots not clickable in N-P mode
  });

  // Reposition controls into grid wrapper (CSS Grid handles placement)
  const controls = document.querySelector('.controls');
  const gridWrapper = document.querySelector('.app12-main-grid');

  if (controls && gridWrapper) {
    // Extract controls from template
    controls.remove();

    // Create container for controls (grid-column: 1, grid-row: 2 via CSS)
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'app12-controls-container';
    const bpmParam = document.getElementById('bpmParam');
    if (bpmParam) {
      controlsContainer.prepend(bpmParam);
    }
    controlsContainer.appendChild(controls);

    // Add to wrapper - CSS Grid will position it in bottom-left
    gridWrapper.appendChild(controlsContainer);
  }

  // Create nuzic N-P editor below timeline
  const timelineWrapper = document.querySelector('.timeline-wrapper');
  if (timelineWrapper) {
    createNuzicEditor(timelineWrapper);
  }

  // Initialize highlight controller using shared module
  highlightController = createMatrixHighlightController({
    musicalGrid,
    gridEditor,
    totalNotes: TOTAL_NOTES,
    currentBPM: currentBPM
  });

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

  // BPM Controller
  const inputBpm = document.getElementById('inputBpm');
  const bpmUp = document.getElementById('bpmUp');
  const bpmDown = document.getElementById('bpmDown');
  if (inputBpm && bpmUp && bpmDown) {
    bpmController = createBpmController({
      inputEl: inputBpm,
      upBtn: bpmUp,
      downBtn: bpmDown,
      min: MIN_BPM,
      max: MAX_BPM,
      defaultValue: DEFAULT_BPM,
      onChange: (bpm) => { currentBPM = bpm; }
    });
    bpmController.attach();
  }

  // Idle caret flash on grid editor (note inputs)
  initIdleCaretFlash({ targets: [gridEditorContainer] });

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

  // Mixer state persistence
  const MIXER_STORAGE_KEY = 'app12-mixer';
  const MIXER_CHANNELS = ['pulse', 'instrument'];

  // Load saved mixer state
  function loadMixerState() {
    try {
      const saved = localStorage.getItem(MIXER_STORAGE_KEY);
      if (!saved) return;
      const state = JSON.parse(saved);

      // Restore master
      if (state.master) {
        if (typeof state.master.volume === 'number') setVolume(state.master.volume);
        if (typeof state.master.muted === 'boolean') setMute(state.master.muted);
      }

      // Restore channels
      if (state.channels) {
        MIXER_CHANNELS.forEach(id => {
          const ch = state.channels[id];
          if (ch) {
            if (typeof ch.volume === 'number') setChannelVolume(id, ch.volume);
            if (typeof ch.muted === 'boolean') setChannelMute(id, ch.muted);
          }
        });
      }
    } catch (e) {
      console.warn('Error loading mixer state:', e);
    }
  }

  // Save mixer state on changes
  let mixerSaveTimeout = null;
  subscribeMixer((snapshot) => {
    // Debounce saves to avoid excessive writes
    if (mixerSaveTimeout) clearTimeout(mixerSaveTimeout);
    mixerSaveTimeout = setTimeout(() => {
      const state = {
        master: {
          volume: snapshot.master.volume,
          muted: snapshot.master.muted
        },
        channels: {}
      };
      snapshot.channels.forEach(ch => {
        if (MIXER_CHANNELS.includes(ch.id)) {
          state.channels[ch.id] = {
            volume: ch.volume,
            muted: ch.muted
          };
        }
      });
      localStorage.setItem(MIXER_STORAGE_KEY, JSON.stringify(state));
    }, 100);
  });

  // Load mixer state after a short delay (after mixer is initialized)
  setTimeout(loadMixerState, 50);

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
      document.documentElement.style.setProperty('--selection-color', color);
      const currentPrefs = preferenceStorage.load() || {};
      currentPrefs.selectColor = color;
      preferenceStorage.save(currentPrefs);
    });
  }

  // Polyphony toggle (NOT persistent - always starts disabled)
  const polyphonyToggle = document.getElementById('polyphonyToggle');
  if (polyphonyToggle) {
    // Always start disabled (monophonic mode)
    polyphonyEnabled = false;
    polyphonyToggle.checked = false;

    // Listen for changes
    polyphonyToggle.addEventListener('change', (e) => {
      polyphonyEnabled = e.target.checked;
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
  registerFactoryReset({
    storage: preferenceStorage,
    onBeforeReload: () => {
      handleReset();

      // Clear keys with separate namespace (used by shared UI components)
      localStorage.removeItem('app12:p1Toggle');
      localStorage.removeItem('app12:pulseAudio');

      // Reset mixer to factory defaults (remove saved state)
      localStorage.removeItem('app12-mixer');

      // Polyphony is NOT persistent - no need to reset (always starts disabled)

      // Reset random menu to factory defaults (if present)
      const randPMax = document.getElementById('randPMax');
      const randNMax = document.getElementById('randNMax');
      if (randPMax) randPMax.value = '7';
      if (randNMax) randNMax.value = '11';
    }
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
