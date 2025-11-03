// App11: El Plano - Interactive 2D musical grid
import { createSoundline } from '../../libs/app-common/soundline.js';
import { loadPiano, playNote } from '../../libs/sound/piano.js';
import { registerFactoryReset, createPreferenceStorage } from '../../libs/app-common/preferences.js';
import { ensureToneLoaded } from '../../libs/sound/tone-loader.js';

// ========== CONFIGURATION ==========
const TOTAL_PULSES = 9;   // Horizontal: 0-8
const TOTAL_NOTES = 12;   // Vertical: 0-11 (MIDI 60-71)
const FIXED_BPM = 120;    // Fixed BPM (not randomized)

// ========== STATE ==========
let piano = null;
let soundline = null;
let matrixContainer = null;
let timelineContainer = null;
let currentBPM = FIXED_BPM;
let intervalSec = 60 / FIXED_BPM; // 0.5 seconds per pulse

// Storage de preferencias
const preferenceStorage = createPreferenceStorage('app11');

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
  timelineContainer = document.getElementById('timelineContainer');
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
 * Creates the interactive 9×12 matrix of cells
 */
function createInteractiveMatrix() {
  matrixContainer = document.getElementById('matrixContainer');
  if (!matrixContainer) {
    console.error('Matrix container not found');
    return;
  }

  // Create 96 cells (8 spaces × 12 notes)
  // Cells are positioned BETWEEN the 9 pulse markers (8 spaces)
  const TOTAL_SPACES = TOTAL_PULSES - 1; // 8 spaces between 9 pulses

  for (let noteIndex = TOTAL_NOTES - 1; noteIndex >= 0; noteIndex--) {
    for (let spaceIndex = 0; spaceIndex < TOTAL_SPACES; spaceIndex++) {
      const cell = createMatrixCell(noteIndex, spaceIndex);
      matrixContainer.appendChild(cell);
    }
  }

  console.log(`Interactive matrix created (${TOTAL_SPACES * TOTAL_NOTES} cells)`);
}

/**
 * Creates a single matrix cell at the intersection of a note and a space between pulses
 */
function createMatrixCell(noteIndex, spaceIndex) {
  const cell = document.createElement('div');
  cell.className = 'matrix-cell';
  cell.dataset.note = noteIndex;
  cell.dataset.space = spaceIndex;

  // Position cell BETWEEN pulse markers
  // Space 0 is between pulse 0 and pulse 1, etc.
  // Formula: position at midpoint between two consecutive pulses
  const pulseSpacing = 100 / (TOTAL_PULSES - 1); // 12.5%
  const leftPulsePos = spaceIndex * pulseSpacing;
  const rightPulsePos = (spaceIndex + 1) * pulseSpacing;
  const xPct = (leftPulsePos + rightPulsePos) / 2; // Midpoint

  const yPct = ((noteIndex + 0.5) / TOTAL_NOTES) * 100;

  cell.style.left = `${xPct}%`;
  cell.style.bottom = `${yPct}%`; // Inverted: note 0 at bottom

  // Click handler
  cell.addEventListener('click', () => handleCellClick(noteIndex, spaceIndex, cell));

  return cell;
}

// ========== INTERACTION HANDLERS ==========

/**
 * Handles click on a matrix cell
 */
async function handleCellClick(noteIndex, spaceIndex, cellElement) {
  // Ensure piano is loaded
  if (!piano) {
    await initPiano();
  }

  // Get MIDI note
  const midi = soundline.getMidiForNote(noteIndex);

  // Play note with 1 pulse duration
  const duration = intervalSec * 0.9; // 90% of interval for clean separation
  playNote(midi, duration);

  // Visual feedback: highlight cell
  highlightCell(cellElement, duration * 1000);

  // Visual feedback: highlight note on soundline
  highlightNoteOnSoundline(noteIndex, duration * 1000);

  console.log(`Cell clicked: Space ${spaceIndex} (between pulse ${spaceIndex} and ${spaceIndex + 1}), Note ${noteIndex} (MIDI ${midi})`);
}

/**
 * Highlights a cell temporarily
 */
function highlightCell(cellElement, durationMs) {
  cellElement.classList.add('highlight');

  setTimeout(() => {
    cellElement.classList.remove('highlight');
  }, durationMs);
}

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

// ========== BPM MANAGEMENT ==========

/**
 * Updates BPM from tap tempo
 */
function handleBPMChange(newBPM) {
  currentBPM = newBPM;
  intervalSec = 60 / currentBPM;
  console.log(`BPM updated to ${currentBPM} (interval: ${intervalSec.toFixed(3)}s)`);
}

// Listen for tap tempo events
document.addEventListener('sharedui:tempo', (e) => {
  handleBPMChange(e.detail.bpm);
});

// ========== FACTORY RESET ==========
registerFactoryReset({ storage: preferenceStorage });

// ========== INITIALIZATION ==========

function initApp() {
  console.log('Initializing App11: El Plano');

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

  // Inject grid structure
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

  // Create interactive matrix
  createInteractiveMatrix();

  // Pre-load piano to avoid delay on first click
  initPiano();

  console.log('App11 initialized successfully');
  console.log(`Fixed BPM: ${FIXED_BPM}, Interval: ${intervalSec}s per pulse`);
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
