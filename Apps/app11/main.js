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
const FIXED_BPM = 120;    // Fixed BPM (not randomized)

// ========== STATE ==========
let piano = null;
let soundline = null;
let musicalPlane = null;
let currentBPM = FIXED_BPM;
let intervalSec = 60 / FIXED_BPM; // 0.5 seconds per pulse

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