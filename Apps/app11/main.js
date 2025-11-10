// App11: El Plano - Interactive 2D musical grid
// REFACTORED to use modular musical-plane system

import { createSoundline } from '../../libs/app-common/soundline.js';
import { createMusicalPlane } from '../../libs/app-common/musical-plane.js';
import { createTimelineHorizontalAxis } from '../../libs/app-common/plane-adapters.js';
import { createClickableCellFactory } from '../../libs/app-common/plane-cells.js';
import { loadPiano, playNote } from '../../libs/sound/piano.js';
import { registerFactoryReset, createPreferenceStorage } from '../../libs/app-common/preferences.js';
import { ensureToneLoaded } from '../../libs/sound/tone-loader.js';
import { TimelineAudio } from '../../libs/sound/index.js';

// ========== CONFIGURATION ==========
const TOTAL_PULSES = 9;   // Horizontal: 0-8 (9 markers)
const TOTAL_NOTES = 12;   // Vertical: 0-11 (MIDI 60-71)
const SEQUENCE_PULSES = 8; // Total pulses in playback sequence (0-7)
const MIN_NOTES = 4;      // Minimum notes in sequence
const MAX_NOTES = 8;      // Maximum notes in sequence
const FIXED_BPM = 120;    // Fixed BPM (not randomized)
const MIN_BPM = 75;       // Minimum random BPM
const MAX_BPM = 200;      // Maximum random BPM

// ========== STATE ==========
let audio = null;
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

async function initAudio() {
  if (!audio) {
    console.log('Ensuring Tone.js is loaded...');
    await ensureToneLoaded();
    console.log('Initializing TimelineAudio...');
    audio = new TimelineAudio({
      Lg: SEQUENCE_PULSES,
      V: 1,
      T: currentBPM,
      selected: [] // No selected pulses initially
    });
    await audio.ready();

    // Enable pulse sound (metronome) by default
    audio.setPulseEnabled(true);

    console.log('TimelineAudio initialized');
  }
  return audio;
}

async function initPiano() {
  if (!piano) {
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
 * Generate random sequence with 4-8 notes in 8 pulses
 * Silences are randomly distributed among unused pulses
 *
 * @returns {Object} { notes: [{note, pulse}], silencePulses: [pulse] }
 */
function generateRandomSequence() {
  // Random note count: 4-8
  const noteCount = Math.floor(Math.random() * (MAX_NOTES - MIN_NOTES + 1)) + MIN_NOTES;

  // Generate ALL pulse positions (0-7)
  const allPulses = Array.from({length: SEQUENCE_PULSES}, (_, i) => i);

  // Shuffle and split into notes vs silences
  const shuffled = allPulses.sort(() => Math.random() - 0.5);
  const notePulses = shuffled.slice(0, noteCount).sort((a, b) => a - b); // Ascending order for left-to-right
  const silencePulses = shuffled.slice(noteCount);

  // Generate random notes for each pulse
  const notes = notePulses.map(pulse => ({
    note: getRandomNoteIndex(),
    pulse: pulse
  }));

  console.log(`Generated sequence: ${noteCount} notes, ${silencePulses.length} silences`);
  console.log(`Note pulses: ${notePulses.join(', ')}`);
  console.log(`Silence pulses: ${silencePulses.join(', ')}`);

  return { notes, silencePulses };
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
 * Handles Play button click: plays 4-8 random notes in 8-pulse sequence with shared metronome
 */
async function handlePlay() {
  if (isPlaying) {
    console.log('Already playing, ignoring click');
    return;
  }

  // Ensure audio and piano are loaded
  if (!audio) {
    await initAudio();
  }
  if (!piano) {
    await initPiano();
  }

  // Generate random content
  currentBPM = getRandomBPM();
  const { notes, silencePulses } = generateRandomSequence();

  console.log('=== Play Sequence ===');
  console.log(`BPM: ${currentBPM}`);
  console.log(`Notes (${notes.length}):`, notes.map(({note, pulse}) => `P${pulse}:N${note}`).join(', '));
  console.log(`MIDI:`, notes.map(({note}) => soundline.getMidiForNote(note)).join(', '));
  console.log(`Silences (${silencePulses.length}):`, silencePulses.join(', '));

  // Calculate interval
  intervalSec = 60 / currentBPM;

  // Clear all previous active cells and labels
  document.querySelectorAll('.matrix-cell.active').forEach(cell => {
    cell.classList.remove('active');
    const label = cell.querySelector('.cell-label');
    if (label) {
      label.remove();
    }
  });

  // Update state
  isPlaying = true;
  playBtn.disabled = true;
  playBtn.classList.add('playing');

  // Create map of notes by pulse for quick lookup
  const notesByPulse = {};
  notes.forEach(({note, pulse}) => {
    notesByPulse[pulse] = note;
  });

  const Tone = window.Tone;

  // Start TimelineAudio transport-based playback (metronome + piano)
  audio.play(
    SEQUENCE_PULSES,     // Total pulses (0-7)
    intervalSec,         // Interval per pulse
    new Set(),           // No accent sounds (metronome plays on all pulses automatically)
    false,               // No loop
    (step) => {
      // onPulse callback: Called on EVERY pulse (0-7)
      console.log(`Pulse ${step} (metronome)`);

      // Check if there's a note at this pulse
      const note = notesByPulse[step];
      if (note !== undefined) {
        const midi = soundline.getMidiForNote(note);
        const duration = intervalSec * 0.9;
        const when = Tone.now(); // Immediate (already scheduled by transport)

        // Play piano note
        const noteFreq = Tone.Frequency(midi, 'midi').toNote();
        piano.triggerAttackRelease(noteFreq, duration, when);

        console.log(`Pulse ${step}: Note ${note} (MIDI ${midi})`);

        // Visual feedback: activate cell and add label
        const cell = musicalPlane.getCellAt(note, step);
        if (cell) {
          cell.element.classList.add('active');

          // Add label if it doesn't exist
          if (!cell.element.querySelector('.cell-label')) {
            const label = document.createElement('span');
            label.className = 'cell-label';
            label.textContent = `( ${note} , ${step} )`;
            cell.element.appendChild(label);
          }

          // Highlight cell in matrix
          musicalPlane.highlightCell(note, step, 'highlight', duration * 1000);
        }

        // Highlight note on soundline
        highlightNoteOnSoundline(note, duration * 1000);
      }
    },
    () => {
      // onComplete callback
      isPlaying = false;
      playBtn.disabled = false;
      playBtn.classList.remove('playing');
      console.log('Sequence completed');
    }
  );
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

  // Override onClick to play notes and show coordinates inside cell
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

    // Activate cell and add coordinate label (like App12)
    cellElement.classList.add('active');

    // Add label if it doesn't exist
    if (!cellElement.querySelector('.cell-label')) {
      const label = document.createElement('span');
      label.className = 'cell-label';
      label.textContent = `( ${noteIndex} , ${spaceIndex} )`;
      cellElement.appendChild(label);
    }

    // Visual feedback on soundline
    highlightNoteOnSoundline(noteIndex, duration * 1000);

    console.log(`Cell clicked: N=${noteIndex}, P=${spaceIndex} (MIDI ${midi})`);
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

  const timelineWrapper = document.getElementById('timelineWrapper');
  if (!timelineWrapper) {
    console.error('Timeline wrapper not found');
    return;
  }

  const controls = timelineWrapper.querySelector('.controls');

  // Remove default timeline section to avoid nested <section> structure
  const existingTimeline = timelineWrapper.querySelector('#timeline');
  if (existingTimeline) {
    existingTimeline.remove();
  }

  // Remove any previous grid (defensive in case of reinitialization)
  timelineWrapper.querySelector('.grid-container')?.remove();

  // Create grid structure directly inside the wrapper (controls stay after it)
  const gridContainer = document.createElement('div');
  gridContainer.className = 'grid-container';
  gridContainer.innerHTML = `
    <div id="soundlineWrapper"></div>
    <div id="matrixContainer"></div>
    <div style="grid-column: 1; grid-row: 2;"></div>
    <div id="timelineContainer"></div>
  `;

  timelineWrapper.insertBefore(gridContainer, controls ?? null);

  // Create vertical soundline (left)
  createVerticalSoundline();

  // Create horizontal timeline (bottom)
  createHorizontalTimeline();

  // Create interactive matrix using modular system
  createInteractiveMatrix();

  // Pre-load audio and piano to avoid delay on first click
  // Note: initPiano() must wait for Tone.js to load, which happens in initAudio()
  initAudio().then(() => initPiano());

  // Setup Play button event listener
  playBtn = document.getElementById('playBtn');
  if (playBtn) {
    playBtn.addEventListener('click', handlePlay);
    console.log('Play button event listener attached');
  } else {
    console.warn('Play button not found');
  }

  // Listen for sound changes from dropdown (metronome sound)
  document.addEventListener('sharedui:sound', async (e) => {
    console.log('Sound changed:', e.detail.sound);
    const audioInstance = await initAudio();
    if (audioInstance && typeof audioInstance.setBase === 'function') {
      await audioInstance.setBase(e.detail.sound);
      console.log(`Metronome sound updated to: ${e.detail.sound}`);
    }
  });

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