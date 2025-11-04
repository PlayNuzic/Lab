// App11: El Plano - Interactive 2D musical grid
// REFACTORED to use modular musical-plane system

import { createSoundline } from '../../libs/app-common/soundline.js';
import { createMusicalPlane } from '../../libs/app-common/musical-plane.js';
import { createTimelineHorizontalAxis } from '../../libs/app-common/plane-adapters.js';
import { createClickableCellFactory } from '../../libs/app-common/plane-cells.js';
import { loadPiano, playNote } from '../../libs/sound/piano.js';
import { registerFactoryReset, createPreferenceStorage } from '../../libs/app-common/preferences.js';
import { ensureToneLoaded } from '../../libs/sound/tone-loader.js';

// ========== CONFIGURATION ==========
const TOTAL_PULSES = 9;   // Horizontal: 0-8
const TOTAL_NOTES = 12;   // Vertical: 0-11 (MIDI 60-71)
const TOTAL_SPACES = 8;   // Spaces between pulses: 0-7
const FIXED_BPM = 120;    // Fixed BPM (not randomized)
const PLAY_NOTES = 4;     // Number of notes in Play sequence
const MIN_BPM = 75;       // Minimum random BPM
const MAX_BPM = 200;      // Maximum random BPM

// ========== STATE ==========
let piano = null;
let soundline = null;
let musicalPlane = null;
let currentBPM = FIXED_BPM;
let intervalSec = 60 / FIXED_BPM; // 0.5 seconds per pulse
let isPlaying = false;
let playBtn = null;

// Storage de preferencias
const preferenceStorage = createPreferenceStorage('app11');

// ========== AUDIO INITIALIZATION ==========

async function initPiano() {
  if (!piano) {
    console.log('Ensuring Tone.js is loaded...');
    await ensureToneLoaded();
    console.log('Loading piano...');
    piano = await loadPiano();
    console.log('Piano loaded successfully');
  }
  return piano;
}

// ========== RANDOM GENERATORS ==========

/**
 * Generate random BPM between MIN_BPM and MAX_BPM
 */
function getRandomBPM() {
  return Math.floor(Math.random() * (MAX_BPM - MIN_BPM + 1)) + MIN_BPM;
}

/**
 * Generate random note index (0-11)
 */
function getRandomNoteIndex() {
  return Math.floor(Math.random() * TOTAL_NOTES);
}

/**
 * Generate array of random note indices
 */
function generateRandomNotes() {
  const notes = [];
  for (let i = 0; i < PLAY_NOTES; i++) {
    notes.push(getRandomNoteIndex());
  }
  return notes;
}

/**
 * Generate array of random space indices in ascending order
 * Ensures: space[i] < space[i+1] (left-to-right constraint)
 */
function generateRandomSpaces() {
  const spaces = [];
  let minSpace = 0;

  for (let i = 0; i < PLAY_NOTES; i++) {
    // Leave room for remaining notes
    const maxSpace = TOTAL_SPACES - 1 - (PLAY_NOTES - 1 - i);
    const space = Math.floor(Math.random() * (maxSpace - minSpace + 1)) + minSpace;
    spaces.push(space);
    minSpace = space + 1;  // Next must be greater
  }

  return spaces;
}

// ========== VISUAL FEEDBACK ==========

/**
 * Highlights a note on the vertical soundline
 */
function highlightNoteOnSoundline(noteIndex, durationMs) {
  // Create highlight rectangle on soundline
  const rect = document.createElement('div');
  rect.className = 'soundline-highlight';

  const yPct = soundline.getNotePosition(noteIndex);
  rect.style.top = `${yPct}%`;

  soundline.element.appendChild(rect);

  // Add active class for animation
  requestAnimationFrame(() => {
    rect.classList.add('active');
  });

  // Remove after duration
  setTimeout(() => {
    rect.classList.remove('active');
    setTimeout(() => rect.remove(), 200); // Allow fade out
  }, durationMs);
}

// ========== PLAY SEQUENCE ==========

/**
 * Handles Play button click: plays 4 random notes in sequence
 */
async function handlePlay() {
  if (isPlaying) {
    console.log('Already playing, ignoring click');
    return;
  }

  // Ensure piano is loaded
  if (!piano) {
    await initPiano();
  }

  // Generate random content
  currentBPM = getRandomBPM();
  const randomNotes = generateRandomNotes();
  const randomSpaces = generateRandomSpaces();

  console.log('=== Play Sequence ===');
  console.log(`BPM: ${currentBPM}`);
  console.log(`Notes: ${randomNotes.join(', ')} (MIDI: ${randomNotes.map(n => soundline.getMidiForNote(n)).join(', ')})`);
  console.log(`Spaces: ${randomSpaces.join(', ')}`);

  // Calculate interval
  intervalSec = 60 / currentBPM;

  // Update state
  isPlaying = true;
  playBtn.disabled = true;
  playBtn.classList.add('playing');

  // Manual scheduling with Tone.js (pattern from App10)
  const Tone = window.Tone;
  const startTime = Tone.now();
  let currentTime = 0;  // Accumulated time in seconds

  randomNotes.forEach((noteIndex, i) => {
    const midi = soundline.getMidiForNote(noteIndex);
    const note = Tone.Frequency(midi, 'midi').toNote();
    const spaceIndex = randomSpaces[i];
    const noteDurationSec = intervalSec * 0.9;  // 90% of interval for clean separation

    // Schedule note playback
    const when = startTime + currentTime;
    piano.triggerAttackRelease(note, noteDurationSec, when);

    // Schedule visual feedback
    const delayMs = currentTime * 1000;
    setTimeout(() => {
      console.log(`Note ${i}: ${noteIndex} (MIDI ${midi}) at space ${spaceIndex}`);

      // Highlight cell in matrix
      musicalPlane.highlightCell(noteIndex, spaceIndex, 'highlight', noteDurationSec * 1000);

      // Highlight note on soundline
      highlightNoteOnSoundline(noteIndex, noteDurationSec * 1000);
    }, delayMs);

    currentTime += intervalSec;  // Accumulate time (1 pulse per note)
  });

  // Callback when complete
  setTimeout(() => {
    isPlaying = false;
    playBtn.disabled = false;
    playBtn.classList.remove('playing');
    console.log('Sequence completed');
  }, currentTime * 1000);
}

// ========== GRID CREATION ==========

/**
 * Creates the vertical soundline on the left side
 */
function createVerticalSoundline() {
  const soundlineWrapper = document.getElementById('soundlineWrapper');
  if (!soundlineWrapper) {
    console.error('Soundline wrapper not found');
    return;
  }

  soundline = createSoundline(soundlineWrapper);
  console.log('Vertical soundline created');
}

/**
 * Creates the horizontal timeline at the bottom
 */
function createHorizontalTimeline() {
  const timelineContainer = document.getElementById('timelineContainer');
  if (!timelineContainer) {
    console.error('Timeline container not found');
    return;
  }

  // Create horizontal line
  const line = document.createElement('div');
  line.className = 'timeline-line';
  timelineContainer.appendChild(line);

  // Create pulse markers (short vertical lines)
  for (let i = 0; i < TOTAL_PULSES; i++) {
    const pct = (i / (TOTAL_PULSES - 1)) * 100;

    // Pulse marker (short vertical line)
    const marker = document.createElement('div');
    marker.className = 'pulse-marker';
    marker.style.left = `${pct}%`;
    timelineContainer.appendChild(marker);

    // Pulse number (below line)
    const number = document.createElement('div');
    number.className = 'pulse-number';
    number.textContent = i;
    number.style.left = `${pct}%`;
    timelineContainer.appendChild(number);
  }

  console.log('Horizontal timeline created');
}

/**
 * Creates the interactive matrix using musical-plane module
 */
function createInteractiveMatrix() {
  const matrixContainer = document.getElementById('matrixContainer');
  if (!matrixContainer) {
    console.error('Matrix container not found');
    return;
  }

  // Create horizontal axis adapter for timeline
  const timelineContainer = document.getElementById('timelineContainer');
  const horizontalAxis = createTimelineHorizontalAxis(
    TOTAL_PULSES,
    timelineContainer,
    true // fillSpaces: cells between pulses
  );

  // Create cell factory with custom click handler
  const cellFactory = createClickableCellFactory({
    className: 'matrix-cell',
    highlightClass: 'highlight',
    highlightDuration: intervalSec * 1000 * 0.9 // 90% of interval for clean separation
  });

  // Override onClick to play notes
  const originalOnClick = cellFactory.onClick;
  cellFactory.onClick = async (noteIndex, spaceIndex, cellElement, event) => {
    // Ensure piano is loaded
    if (!piano) {
      await initPiano();
    }

    // Get MIDI note
    const midi = soundline.getMidiForNote(noteIndex);

    // Play note with 1 pulse duration
    const duration = intervalSec * 0.9; // 90% of interval for clean separation
    playNote(midi, duration);

    // Visual feedback on cell
    originalOnClick(noteIndex, spaceIndex, cellElement, event);

    // Visual feedback on soundline
    highlightNoteOnSoundline(noteIndex, duration * 1000);

    console.log(`Cell clicked: Space ${spaceIndex} (between pulse ${spaceIndex} and ${spaceIndex + 1}), Note ${noteIndex} (MIDI ${midi})`);
  };

  // Create musical plane
  musicalPlane = createMusicalPlane({
    container: matrixContainer,
    verticalAxis: soundline,           // Use soundline as vertical axis
    horizontalAxis: horizontalAxis,     // Use timeline as horizontal axis
    cellFactory: cellFactory,
    fillSpaces: true,                   // Cells fill spaces BETWEEN markers
    cellClassName: 'matrix-cell'
  });

  // Render the grid
  const cells = musicalPlane.render();
  console.log(`Interactive matrix created (${cells.length} cells)`);

  // Handle window resize for responsive layout
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      musicalPlane.update();
      console.log('Matrix updated after resize');
    }, 250);
  });
}

// ========== BPM MANAGEMENT ==========

/**
 * Updates BPM from tap tempo
 */
function handleBPMChange(newBPM) {
  currentBPM = newBPM;
  intervalSec = 60 / currentBPM;
  console.log(`BPM updated to ${currentBPM} (interval: ${intervalSec.toFixed(3)}s)`);

  // Update cell factory highlight duration if plane exists
  if (musicalPlane) {
    // Recreate matrix with new timing
    musicalPlane.clear();
    createInteractiveMatrix();
  }
}

// Listen for tap tempo events
document.addEventListener('sharedui:tempo', (e) => {
  handleBPMChange(e.detail.bpm);
});

// ========== FACTORY RESET ==========
registerFactoryReset({ storage: preferenceStorage });

// ========== INITIALIZATION ==========

function initApp() {
  console.log('Initializing App11: El Plano (Refactored)');

  // Get timeline wrapper from template
  const timelineWrapper = document.getElementById('timelineWrapper');
  if (!timelineWrapper) {
    console.error('Timeline wrapper not found');
    return;
  }

  // Clear default timeline content
  const timeline = document.getElementById('timeline');
  if (timeline) {
    timeline.innerHTML = '';
  }

  // Inject grid structure (simplified - no more hardcoded heights)
  timelineWrapper.innerHTML = `
    <div class="grid-container">
      <div id="soundlineWrapper"></div>
      <div id="matrixContainer"></div>
      <div style="grid-column: 1; grid-row: 2;"></div>
      <div id="timelineContainer"></div>
    </div>
  `;

  // Create vertical soundline (left)
  createVerticalSoundline();

  // Create horizontal timeline (bottom)
  createHorizontalTimeline();

  // Create interactive matrix using modular system
  createInteractiveMatrix();

  // Pre-load piano to avoid delay on first click
  initPiano();

  // Setup Play button event listener
  playBtn = document.getElementById('playBtn');
  if (playBtn) {
    playBtn.addEventListener('click', handlePlay);
    console.log('Play button event listener attached');
  } else {
    console.warn('Play button not found');
  }

  // Listen for instrument changes (placeholder - only piano available for now)
  document.addEventListener('sharedui:instrument', (e) => {
    console.log('Instrument changed:', e.detail.instrument);
    // Future: load different instruments based on selection
  });

  console.log('App11 initialized successfully with modular plane system');
  console.log(`Fixed BPM: ${FIXED_BPM}, Interval: ${intervalSec}s per pulse`);
}

// ========== CLEANUP ==========

window.addEventListener('beforeunload', () => {
  if (musicalPlane) {
    musicalPlane.destroy();
  }
});

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}