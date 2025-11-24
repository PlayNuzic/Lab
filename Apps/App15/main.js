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
const TOTAL_SPACES = 8;   // Spaces between pulses: 0-7 (total pulses = 9)
const DEFAULT_BPM = 120;
const IT_BAR_LAYER_ID = 'it-bars-layer';

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

function buildPairsFromIntervals(basePair, intervals = []) {
  if (!basePair) return [];

  let currentNote = basePair.note ?? 0;
  let currentPulse = basePair.pulse ?? 0;
  let lastPlayableNote = currentNote;
  const pairs = [{
    note: currentNote,
    pulse: currentPulse,
    isRest: false
  }];

  intervals.forEach((interval) => {
    const temporal = interval?.temporalInterval ?? interval?.temporal ?? 0;
    // iT must be positive (≥1) - skip invalid intervals
    if (!temporal || temporal <= 0) return;

    const isRest = !!interval.isRest;
    currentPulse += temporal;

    if (isRest) {
      pairs.push({ note: lastPlayableNote, pulse: currentPulse, isRest: true });
      return;
    }

    const soundInterval = interval.soundInterval ?? 0;
    currentNote += soundInterval;
    lastPlayableNote = currentNote;

    pairs.push({ note: currentNote, pulse: currentPulse, isRest: false });
  });

  return pairs;
}

// Elements
let playBtn = null;
let resetBtn = null;
let randomBtn = null;
let gridEditorContainer = null;

// ========== DRAG STATE FOR HORIZONTAL iT MODIFICATION ==========
let dragState = {
  active: false,
  startSpaceIndex: null,
  currentSpaceIndex: null,
  originalPair: null,
  previewElement: null
};

// ========== STORAGE HELPERS ==========
// Use shared preference storage module - renamed to app15
const preferenceStorage = createPreferenceStorage({ prefix: 'app15', separator: '-' });

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
  const playablePairs = allPairs.filter(p => !p.isRest && p.note !== null && p.note !== undefined);

  // Group pairs by pulse for polyphonic playback
  const pulseGroups = {};
  playablePairs.forEach(pair => {
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

// Note: interval-span tubes removed - iT bars in timeline are sufficient for showing duration

function renderTemporalBars(intervals = []) {
  if (!musicalGrid || typeof musicalGrid.getTimelineContainer !== 'function') return;
  const timeline = musicalGrid.getTimelineContainer();
  const matrix = musicalGrid.getMatrixContainer?.();
  if (!timeline || !matrix) return;

  let layer = timeline.querySelector(`#${IT_BAR_LAYER_ID}`);
  if (!layer) {
    layer = document.createElement('div');
    layer.id = IT_BAR_LAYER_ID;
    layer.className = 'it-bars-layer';
    timeline.appendChild(layer);
  }

  // Reset content
  layer.innerHTML = '';

  // Get matrix width for position calculations (timeline shares same CSS grid column)
  const matrixWidth = matrix.getBoundingClientRect().width;
  const totalSpaces = TOTAL_PULSES - 1; // 8 spaces between 9 pulses
  const cellWidth = matrixWidth / totalSpaces;

  // Layer inherits timeline width (same as matrix via CSS grid-column: 2)
  layer.style.width = '100%';
  layer.style.left = '0';

  let offset = 0;

  intervals.forEach((interval, index) => {
    const duration = interval?.temporalInterval ?? interval?.temporal ?? 0;
    if (!duration) return;

    // Calculate position using cell width (same formula as musical-grid)
    const leftPx = offset * cellWidth;
    const widthPx = duration * cellWidth;
    const labelValue = duration;

    const bar = document.createElement('div');
    bar.className = 'it-bar';
    if (interval.isRest) {
      bar.classList.add('it-bar--rest');
    }
    bar.style.left = `${leftPx}px`;
    bar.style.width = `${widthPx}px`;
    bar.dataset.index = index + 1;

    const label = document.createElement('div');
    label.className = 'it-bar__label';
    // iT labels always centered in their bar
    label.textContent = labelValue;
    bar.appendChild(label);

    layer.appendChild(bar);
    offset += duration;
  });
}

function syncGridFromPairs(pairs) {
  if (!musicalGrid) return;
  currentPairs = pairs;

  console.log('[App15] syncGridFromPairs received:', JSON.stringify(pairs));

  // PERFORMANCE: Incremental update instead of full redraw
  // Track which cells should be active
  const visiblePairs = pairs.filter(p => p.note !== null && p.note !== undefined);
  console.log('[App15] visiblePairs after filter:', JSON.stringify(visiblePairs));
  // Convert pulse to space indices for cell tracking (fillSpaces mode)
  // Each note occupies spaces from (pulse - temporalInterval) to (pulse - 1)
  // The note STARTS at (pulse - iT), and ENDS at pulse
  const activeCells = new Set();
  visiblePairs.forEach(p => {
    if (p.pulse <= 0 || p.isRest) return; // Base position has no cell, silences don't illuminate
    const iT = p.temporalInterval || 1;
    const startSpace = p.pulse - iT;
    const endSpace = p.pulse - 1;
    for (let space = startSpace; space <= endSpace; space++) {
      if (space >= 0) {
        activeCells.add(`${p.note}-${space}`);
      }
    }
  });
  console.log('[App15] activeCells (space indices):', [...activeCells]);

  // Clear only cells that are no longer active
  document.querySelectorAll('.musical-cell.active').forEach(cell => {
    const note = parseInt(cell.dataset.note);
    const pulse = parseInt(cell.dataset.pulse);
    const key = `${note}-${pulse}`;

    if (!activeCells.has(key)) {
      cell.classList.remove('active');
    }
  });

  // Clear interval paths before updating
  if (musicalGrid.clearIntervalPaths) {
    musicalGrid.clearIntervalPaths();
  }

  // Interval lines always enabled in App15
  const intervalLinesEnabled = intervalLinesEnabledState;

  // Filter out invalid pairs (null notes or pulses out of range)
  const validPairs = visiblePairs.filter(p =>
    p.pulse >= 0 && p.pulse <= TOTAL_PULSES - 1 &&
    p.note >= 0 && p.note <= TOTAL_NOTES - 1
  );

  // Activate cells (no labels in grid-2D)
  // With fillSpaces=true, cells represent SPACES between pulses
  // Each note occupies spaces from (pulse - temporalInterval) to (pulse - 1)
  // The note STARTS at (pulse - iT), showing its full duration
  console.log('[App15] validPairs to activate:', JSON.stringify(validPairs));
  validPairs.forEach(({ note, pulse, isRest, temporalInterval }) => {
    // Pulse 0 is the starting point - no cell to activate
    if (pulse === 0) {
      console.log(`[App15] Skipping pulse=0 (base position, no cell)`);
      return;
    }
    // Silences (isRest) don't illuminate cells - they represent absence of sound
    if (isRest) {
      console.log(`[App15] Skipping silence at pulse=${pulse} (no cell illumination)`);
      return;
    }
    // Calculate start and end spaces based on temporalInterval
    const iT = temporalInterval || 1;
    const startSpace = pulse - iT;
    const endSpace = pulse - 1;
    console.log(`[App15] Activating cells for note=${note}, pulse=${pulse}, iT=${iT} -> spaces ${startSpace} to ${endSpace}`);

    for (let space = startSpace; space <= endSpace; space++) {
      if (space < 0) continue;
      const cell = musicalGrid.getCellElement(note, space);
      if (cell) {
        cell.classList.add('active');
      }
    }
  });

  // Highlight interval paths (if enabled)
  if (musicalGrid.highlightIntervalPath) {
    // Pass polyphonic flag. NO basePair since hideInitialPair=true means the first
    // pair is already relative to (0,0) and shouldn't draw the base line
    musicalGrid.highlightIntervalPath(validPairs, polyphonyEnabled, null);
  }

  // Render temporal overlay based on iT
  renderTemporalBars(currentIntervals);

  // Save to storage
  saveCurrentState();
}

// ========== DRAG HANDLERS FOR HORIZONTAL iT MODIFICATION ==========

/**
 * Calculate space index from a pair based on its temporalInterval
 * Space index = pulse - 1 (the cell where the note ends)
 */
function getSpaceIndexFromPair(pair) {
  return pair.pulse - 1;
}

/**
 * Calculate space index from mouse X coordinate
 */
function calculateSpaceFromMouseX(mouseX, musicalGrid) {
  const matrixContainer = musicalGrid.getMatrixContainer?.();
  if (!matrixContainer) return null;

  const rect = matrixContainer.getBoundingClientRect();
  const relativeX = mouseX - rect.left;

  // Calculate which space (cell) the mouse is over
  const cellWidth = rect.width / TOTAL_PULSES; // 9 pulses = 8 spaces, but width is divided by pulses
  const spaceIndex = Math.floor(relativeX / cellWidth);

  // Clamp to valid range [0, TOTAL_PULSES - 2] (8 spaces for 9 pulses)
  return Math.max(0, Math.min(TOTAL_PULSES - 2, spaceIndex));
}

/**
 * Handle mousedown on an existing dot to start drag
 */
function handleDotMouseDown(noteIndex, spaceIndex, event, musicalGrid) {
  if (!gridEditor) return;

  const targetPulse = spaceIndex + 1;
  const pairsAtMoment = gridEditor.getPairs();

  // Find existing pair at this N-P location
  const existingPair = pairsAtMoment.find(p => p.note === noteIndex && p.pulse === targetPulse);

  if (!existingPair) return; // Only drag existing dots

  dragState.active = true;
  dragState.startSpaceIndex = spaceIndex;
  dragState.currentSpaceIndex = spaceIndex;
  dragState.originalPair = existingPair;

  // Prevent default to avoid text selection
  event.preventDefault();
  event.stopPropagation();
}

/**
 * Handle mousemove during drag to preview new iT
 */
function handleMouseMove(event, musicalGrid) {
  if (!dragState.active || !dragState.originalPair) return;

  const newSpaceIndex = calculateSpaceFromMouseX(event.clientX, musicalGrid);
  if (newSpaceIndex === null || newSpaceIndex === dragState.currentSpaceIndex) return;

  dragState.currentSpaceIndex = newSpaceIndex;

  // Calculate new pulse and iT
  const newPulse = newSpaceIndex + 1;

  // Find previous pair to calculate iT correctly
  const pairsAtMoment = gridEditor.getPairs();
  const previousPairs = pairsAtMoment.filter(p =>
    p !== dragState.originalPair && p.pulse < newPulse
  );
  const lastPair = previousPairs.length > 0
    ? previousPairs[previousPairs.length - 1]
    : { note: 0, pulse: 0 };

  const newIT = newPulse - lastPair.pulse;

  // Validate iT (must be ≥1)
  if (newIT < 1) return;

  // Validate pulse doesn't exceed limits
  if (newPulse > TOTAL_PULSES - 1) return;

  // Update preview visual (TODO: implement visual preview)
  // For now, just update cursor to indicate dragging is active
  document.body.style.cursor = 'ew-resize';
}

/**
 * Handle mouseup to finalize drag and update pair
 */
function handleMouseUp(event, musicalGrid) {
  if (!dragState.active || !dragState.originalPair) return;

  // Reset cursor
  document.body.style.cursor = '';

  // Only update if space changed
  if (dragState.currentSpaceIndex !== null &&
      dragState.currentSpaceIndex !== dragState.startSpaceIndex) {

    const newPulse = dragState.currentSpaceIndex + 1;
    const pairsAtMoment = gridEditor.getPairs();

    // Find previous pair to calculate new iT
    const previousPairs = pairsAtMoment.filter(p =>
      p !== dragState.originalPair && p.pulse < newPulse
    );
    const lastPair = previousPairs.length > 0
      ? previousPairs[previousPairs.length - 1]
      : { note: 0, pulse: 0 };

    const newIT = newPulse - lastPair.pulse;

    // Validate before updating
    if (newIT >= 1 && newPulse <= TOTAL_PULSES - 1) {
      // Create updated pairs array
      const newPairs = pairsAtMoment.map(p => {
        if (p === dragState.originalPair) {
          return {
            ...p,
            pulse: newPulse,
            temporalInterval: newIT
          };
        }
        return p;
      });

      gridEditor.setPairs(newPairs);
      syncGridFromPairs(newPairs);
    }
  }

  // Reset drag state
  dragState.active = false;
  dragState.startSpaceIndex = null;
  dragState.currentSpaceIndex = null;
  dragState.originalPair = null;
}

// ========== END DRAG HANDLERS ==========

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
  renderTemporalBars([]);

  // Clear interval lines (vertical iS lines)
  musicalGrid?.clearIntervalPaths();

  // Reset state
  currentIntervals = [];
  currentPairs = [];

  // Save cleared state
  saveCurrentState();
}

// ========== RANDOM ==========

function handleRandom() {
  // Get random settings from menu
  const randISMax = Math.min(Math.max(parseInt(document.getElementById('randISMax')?.value || '11'), 1), 11);
  const randITMax = Math.min(Math.max(parseInt(document.getElementById('randITMax')?.value || '8'), 1), 8);
  const allowSilences = document.getElementById('randAllowSilences')?.checked || false;

  // Base pair is always (0, 0)
  const basePair = { note: 0, pulse: 0 };
  const maxTotalPulse = TOTAL_PULSES - 1; // 8

  // Generate random intervals until we reach exactly 8 pulses
  const intervals = [];
  let currentNote = basePair.note;
  let currentPulse = basePair.pulse;
  let intervalCount = 0;

  // Continue generating intervals until we fill all 8 pulses
  while (currentPulse < maxTotalPulse) {
    // Calculate valid iT range
    const remainingPulses = maxTotalPulse - currentPulse;

    // iT: Random between 1 and min(randITMax, remainingPulses)
    const maxIT = Math.min(randITMax, remainingPulses);
    const temporalInterval = Math.floor(Math.random() * maxIT) + 1; // 1 to maxIT

    // Decide if this interval is a silence (only if allowSilences and not first interval)
    const isSilence = allowSilences && intervalCount > 0 && Math.random() < 0.2; // 20% chance of silence

    if (isSilence) {
      // Silence: soundInterval is 0, note doesn't change
      intervals.push({ soundInterval: 0, temporalInterval, isRest: true });
    } else {
      // Calculate valid iS range (result must stay in [0, 11])
      const maxUp = Math.min(randISMax, TOTAL_NOTES - 1 - currentNote); // Can't exceed note 11
      const maxDown = Math.min(randISMax, currentNote); // Can't go below note 0

      let soundInterval;
      if (intervalCount === 0) {
        // First iS must be positive (firstIntervalPositiveOnly rule)
        if (maxUp <= 0) break; // Can't generate valid first interval
        soundInterval = Math.floor(Math.random() * maxUp) + 1; // 1 to maxUp
      } else {
        // Subsequent iS can be positive or negative
        // Random between -maxDown and +maxUp
        soundInterval = Math.floor(Math.random() * (maxUp + maxDown + 1)) - maxDown;
      }

      intervals.push({ soundInterval, temporalInterval });

      // Update note position (only for non-silences)
      currentNote += soundInterval;
    }

    // Update pulse position and interval count
    currentPulse += temporalInterval;
    intervalCount++;
  }

  // Convert to pairs using intervalsToPairs (includes base pair)
  const allPairs = intervalsToPairs(basePair, intervals);

  // gridEditor with hideInitialPair expects pairs WITHOUT the base pair
  // So we slice to remove the first element (base pair)
  const pairsForEditor = allPairs.slice(1);

  currentIntervals = intervals;
  currentPairs = pairsForEditor;

  // Update editor (expects pairs without base)
  gridEditor.setPairs(pairsForEditor);

  // Sync to grid (also expects pairs without base, syncGridFromPairs handles basePair internally)
  syncGridFromPairs(pairsForEditor);

  // Persist
  saveCurrentState();
}

// ========== STORAGE ==========

function saveCurrentState() {
  const prefs = preferenceStorage.load() || {};

  // Save current intervals and initial position
  prefs.intervals = currentIntervals;
  prefs.initialPair = { note: 0, pulse: 0 };

  preferenceStorage.save(prefs);
}

function loadSavedState() {
  const prefs = preferenceStorage.load() || {};

  if (prefs.intervals && prefs.initialPair) {
    // Restore intervals (supports rests)
    const basePair = prefs.initialPair || { note: 0, pulse: 0 };
    const intervals = prefs.intervals || [];
    const pairs = buildPairsFromIntervals(basePair, intervals);
    currentIntervals = intervals;
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
      horizontal: false,
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
    onDotClick: async (noteIndex, spaceIndex) => {
      // IMPORTANT: spaceIndex (0-7) represents the SPACE/CELL index, not the pulse marker
      // Space 0 = interval from pulse 0 to pulse 1
      // Space N = interval from pulse N to pulse N+1
      // Therefore: targetPulse = spaceIndex + 1

      await initAudio();

      if (!window.Tone) {
        console.warn('Tone.js not available');
        return;
      }

      // Play note preview
      const midi = 60 + noteIndex;
      const duration = (60 / currentBPM) * 0.9;
      const Tone = window.Tone;
      audio.playNote(midi, duration, Tone.now());
      highlightNoteOnSoundline(musicalGrid, noteIndex, duration * 1000);

      if (!gridEditor) return;

      // Convert spaceIndex to targetPulse
      const targetPulse = spaceIndex + 1;

      // Validate pulse range (0-8 for 9 total pulses)
      if (targetPulse > TOTAL_PULSES - 1) {
        console.warn(`Target pulse ${targetPulse} exceeds max pulse ${TOTAL_PULSES - 1}`);
        return;
      }

      // Validate note range (0-11 for 12 notes)
      if (noteIndex < 0 || noteIndex > TOTAL_NOTES - 1) {
        console.warn(`Note index ${noteIndex} out of range [0, ${TOTAL_NOTES - 1}]`);
        return;
      }

      const pairsAtMoment = gridEditor.getPairs();

      // Check if there's already a pair at this exact N-P location
      const isActive = pairsAtMoment.some(p => p.note === noteIndex && p.pulse === targetPulse);

      let newPairs;
      if (!polyphonyEnabled) {
        // Monophonic mode: only one note per pulse
        if (isActive) {
          // Remove the clicked pair
          newPairs = pairsAtMoment.filter(p => !(p.note === noteIndex && p.pulse === targetPulse));
        } else {
          // Replace any existing note at this pulse with new note
          newPairs = pairsAtMoment.filter(p => p.pulse !== targetPulse);

          // Calculate temporalInterval from last pair before targetPulse
          const previousPairs = pairsAtMoment.filter(p => p.pulse < targetPulse);
          const lastPair = previousPairs.length > 0
            ? previousPairs[previousPairs.length - 1]
            : { note: 0, pulse: 0 }; // Base pair (0,0) if no previous pairs

          const temporalInterval = targetPulse - lastPair.pulse;

          newPairs.push({
            note: noteIndex,
            pulse: targetPulse,
            temporalInterval
          });
        }
      } else {
        // Polyphonic mode: allow multiple notes per pulse
        if (isActive) {
          // Remove the clicked pair
          newPairs = pairsAtMoment.filter(p => !(p.note === noteIndex && p.pulse === targetPulse));
        } else {
          // Add new note without removing others at same pulse
          const previousPairs = pairsAtMoment.filter(p => p.pulse < targetPulse);
          const lastPair = previousPairs.length > 0
            ? previousPairs[previousPairs.length - 1]
            : { note: 0, pulse: 0 };

          const temporalInterval = targetPulse - lastPair.pulse;

          newPairs = [...pairsAtMoment, {
            note: noteIndex,
            pulse: targetPulse,
            temporalInterval
          }];
        }
      }

      gridEditor.setPairs(newPairs);
      syncGridFromPairs(newPairs);
    }
  });

  // ========== SETUP DRAG LISTENERS FOR iT MODIFICATION ==========
  // Attach mousedown listeners to all N-P dots for drag support
  // We need to intercept mousedown BEFORE click fires
  const matrixInner = musicalGrid.getMatrixContainer?.();
  if (matrixInner) {
    // Use event delegation for better performance
    matrixInner.addEventListener('mousedown', (e) => {
      const dot = e.target.closest('.np-dot');
      if (!dot || !dot.classList.contains('np-dot-clickable')) return;

      // Extract noteIndex and spaceIndex from the dot's parent cell
      const cell = dot.closest('.musical-cell');
      if (!cell) return;

      const noteIndex = parseInt(cell.dataset.note, 10);
      const spaceIndex = parseInt(cell.dataset.pulse, 10); // Actually spaceIndex

      if (isNaN(noteIndex) || isNaN(spaceIndex)) return;

      handleDotMouseDown(noteIndex, spaceIndex, e, musicalGrid);
    });

    // Global mousemove handler
    document.addEventListener('mousemove', (e) => {
      handleMouseMove(e, musicalGrid);
    });

    // Global mouseup handler
    document.addEventListener('mouseup', (e) => {
      handleMouseUp(e, musicalGrid);
    });
  }

  // ResizeObserver to keep timeline bars aligned with grid cells on resize
  const matrixContainer = musicalGrid.getMatrixContainer?.();
  if (matrixContainer) {
    const resizeObserver = new ResizeObserver(() => {
      // Recalculate temporal bars positions when matrix size changes
      if (currentIntervals.length > 0) {
        renderTemporalBars(currentIntervals);
      }
    });
    resizeObserver.observe(matrixContainer);
  }

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
    showIntervalLabels: false,
    leftZigzagLabels: { topText: 'iS', bottomText: 'iT' },
    autoJumpDelayMs: 500,
    intervalModeOptions: {
      basePair: { note: 0, pulse: 0 },
      hideInitialPair: true,
      allowSilence: true,
      firstIntervalPositiveOnly: true,
      maxTotalPulse: TOTAL_PULSES - 1
    },
    scrollEnabled: isMobile,
    containerSize: isMobile ? { maxHeight: '180px', width: '100%' } : null,
    columnSize: isMobile ? { width: '80px', minHeight: '150px' } : null,
    getPolyphonyEnabled: () => polyphonyEnabled,
    onPairsChange: (pairs) => {
      currentPairs = pairs;

      const intervals = [];
      // Base pair is always (0,0) when hideInitialPair is enabled
      // Each received pair is the RESULT of an interval, not the base
      let prevNote = 0;   // Base N₀
      let prevPulse = 0;  // Base P₀
      let lastPlayable = 0;

      // Track pulses already processed to skip duplicates (polyphony)
      // In monophonic mode, we only process the first pair at each pulse
      const processedPulses = new Set();

      // Process ALL pairs - each represents an interval endpoint
      pairs.forEach((pair) => {
        // Skip if we already processed this pulse (polyphony case)
        // This prevents temporalInterval=0 for duplicate pulses
        if (processedPulses.has(pair.pulse)) {
          return;  // Skip duplicate pulse
        }
        processedPulses.add(pair.pulse);

        const temporalInterval = pair.pulse - prevPulse;
        const isRest = !!pair.isRest;
        const soundInterval = isRest ? 0 : pair.note - prevNote;

        intervals.push({
          soundInterval,
          temporalInterval,
          isRest
        });

        if (!isRest) {
          prevNote = pair.note;
          lastPlayable = pair.note;
        } else {
          prevNote = lastPlayable;
        }
        prevPulse = pair.pulse;
      });

      currentIntervals = intervals;

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
  // NOTE: randomBtn click is handled by initRandomMenu() below (shortpress → handleRandom, longpress → open menu)

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

  // Color picker - load saved value and setup change listener
  const selectColor = document.getElementById('selectColor');
  if (selectColor) {
    // Load saved color
    const prefs = preferenceStorage.load() || {};
    if (prefs.selectColor) {
      selectColor.value = prefs.selectColor;
      document.documentElement.style.setProperty('--select-color', prefs.selectColor);
    }

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

    // Clear keys with separate namespace (used by shared UI components)
    localStorage.removeItem('app15:p1Toggle');
    localStorage.removeItem('app15:pulseAudio');

    // Set default values
    preferenceStorage.save({
      selectedInstrument: 'piano',
      selectColor: '#F97C39',
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
