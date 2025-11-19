// App14: Intervalo Sonoro
// Muestra intervalos sonoros entre dos notas aleatorias con visualización de línea vertical

import { createSoundline } from '../../libs/app-common/soundline.js';
import { createNoteHighlightController } from '../../libs/app-common/note-highlight.js';
import { loadPiano } from '../../libs/sound/piano.js';
import { ensureToneLoaded } from '../../libs/sound/tone-loader.js';

// Constants
const MIN_NOTE = 0;
const MAX_NOTE = 11;
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const OCTAVE = 4;
const START_MIDI = 60; // C4
const FIXED_BPM = 65; // BPM fijo para intervalos

// State
let isPlaying = false;
let piano = null;
let currentHighlights = [];
let currentIntervalElements = [];

// DOM elements
const playBtn = document.getElementById('playBtn');

// Get timeline element from template
const timeline = document.getElementById('timeline');
if (!timeline) throw new Error('Cannot find #timeline element');

// Extract .controls before removing .middle
const middle = document.querySelector('.middle');
const controlsSection = middle?.querySelector('.controls');
if (controlsSection && timeline.parentElement) {
  timeline.parentElement.parentElement.insertBefore(controlsSection, timeline.parentElement);
}
middle?.remove();

// Create soundline container inside timeline
const soundlineContainer = document.createElement('div');
soundlineContainer.className = 'soundline-container';
soundlineContainer.style.position = 'relative';
soundlineContainer.style.width = '100%';
soundlineContainer.style.height = '100%';

timeline.appendChild(soundlineContainer);

// Create soundline
const soundline = createSoundline({
  container: soundlineContainer,
  notes: 12,
  startMidi: START_MIDI
});

// Create highlight controller
const highlightController = createNoteHighlightController({
  container: soundlineContainer,
  soundline,
  notes: 12
});

/**
 * Generate two random note indices
 */
function generateRandomNotes() {
  const note1 = Math.floor(Math.random() * (MAX_NOTE - MIN_NOTE + 1)) + MIN_NOTE;
  const note2 = Math.floor(Math.random() * (MAX_NOTE - MIN_NOTE + 1)) + MIN_NOTE;
  return [note1, note2];
}

/**
 * Get MIDI note value from index
 */
function getMidiNote(noteIndex) {
  return START_MIDI + noteIndex;
}

/**
 * Get note name from index
 */
function getNoteName(noteIndex) {
  return `${NOTE_NAMES[noteIndex]}${OCTAVE}`;
}

/**
 * Clear all interval elements (line and number)
 */
function clearIntervalElements() {
  currentIntervalElements.forEach(el => {
    if (el && el.parentNode) {
      el.remove();
    }
  });
  currentIntervalElements = [];
}

/**
 * Clear all current highlights
 */
function clearHighlights() {
  currentHighlights.forEach(index => {
    const rect = soundline.element.querySelector(`.note-highlight[data-note="${index}"]`);
    if (rect) rect.classList.remove('highlight');
  });
  currentHighlights = [];
}

/**
 * Create vertical interval line between two notes
 */
function createIntervalLine(note1Index, note2Index) {
  const minNote = Math.min(note1Index, note2Index);
  const maxNote = Math.max(note1Index, note2Index);

  // Use the soundline API to get positions
  const minPos = soundline.getNotePosition(minNote);
  const maxPos = soundline.getNotePosition(maxNote);

  // Create line element
  const intervalBar = document.createElement('div');
  intervalBar.className = 'interval-bar-vertical';
  intervalBar.style.position = 'absolute';

  // Position vertically with padding to avoid covering numbers
  // Add 15% padding on each side to keep line away from numbers
  const padding = 1.5; // 15% of each cell height (1.5% of total)
  intervalBar.style.top = `${maxPos + padding}%`;
  intervalBar.style.height = `${(minPos - maxPos) - (padding * 2)}%`;

  // Position horizontally - align with center of highlights
  intervalBar.style.left = '160px'; // Center of highlights (120px + 40px)
  intervalBar.style.width = '4px';
  // NO translateY - the line should span from note to note without offset

  soundline.element.appendChild(intervalBar);
  currentIntervalElements.push(intervalBar);
}

/**
 * Show interval number with direction
 */
function showIntervalNumber(note1Index, note2Index) {
  const interval = note2Index - note1Index;
  const absInterval = Math.abs(interval);
  const direction = interval > 0 ? '+' : interval < 0 ? '-' : '';

  // Use the soundline API to get positions
  const pos1 = soundline.getNotePosition(note1Index);
  const pos2 = soundline.getNotePosition(note2Index);

  // Calculate vertical center position between the two notes
  const centerY = (pos1 + pos2) / 2;

  // Create number element
  const intervalNum = document.createElement('div');
  intervalNum.className = 'interval-number';
  intervalNum.textContent = `${direction}${absInterval}`;
  intervalNum.style.position = 'absolute';
  intervalNum.style.top = `${centerY}%`;
  intervalNum.style.left = '180px'; // Position to the right of the line (160px + 20px)
  intervalNum.style.transform = 'translateY(-50%)';

  soundline.element.appendChild(intervalNum);
  currentIntervalElements.push(intervalNum);
}

/**
 * Play the two-note sequence
 */
async function playSequence() {
  if (isPlaying) return;

  // Clear previous highlights and interval elements
  clearHighlights();
  clearIntervalElements();

  isPlaying = true;
  playBtn.disabled = true;

  try {
    // Ensure audio is ready
    await ensureToneLoaded();

    // Load piano if not already loaded
    if (!piano) {
      piano = await loadPiano();
    }

    // Generate two random notes
    const [note1Index, note2Index] = generateRandomNotes();

    // Calculate timing
    const intervalSec = 60 / FIXED_BPM;
    const noteDuration = intervalSec * 0.9;

    // Get Tone instance
    const Tone = window.Tone;

    // Schedule and play notes
    const now = Tone.now();

    // Play first note
    const note1 = getNoteName(note1Index);
    piano.triggerAttackRelease(note1, noteDuration, now);

    // Use the controller to create the highlight, then prevent auto-removal
    highlightController.highlightNote(note1Index, 999999); // Large duration
    currentHighlights.push(note1Index);

    // Play second note
    const note2 = getNoteName(note2Index);
    piano.triggerAttackRelease(note2, noteDuration, now + intervalSec);

    // Highlight second note after delay
    setTimeout(() => {
      // Use the controller to create the highlight, then prevent auto-removal
      highlightController.highlightNote(note2Index, 999999); // Large duration
      currentHighlights.push(note2Index);

      // Create interval visualization after both notes are highlighted
      if (note1Index !== note2Index) {
        createIntervalLine(note1Index, note2Index);
        showIntervalNumber(note1Index, note2Index);
      }
    }, intervalSec * 1000);

    // Re-enable play button after sequence completes
    setTimeout(() => {
      isPlaying = false;
      playBtn.disabled = false;
    }, intervalSec * 2 * 1000);

  } catch (error) {
    console.error('Error playing sequence:', error);
    isPlaying = false;
    playBtn.disabled = false;
  }
}

// Initialize piano on first user interaction
let pianoInitialized = false;
async function initializePiano() {
  if (pianoInitialized) return;
  pianoInitialized = true;

  try {
    await ensureToneLoaded();
    piano = await loadPiano();
  } catch (error) {
    console.error('Error initializing piano:', error);
  }
}

// Event listeners
playBtn?.addEventListener('click', async () => {
  await initializePiano();
  playSequence();
});

// Initialize piano on first user interaction (for faster response)
document.addEventListener('click', initializePiano, { once: true });
document.addEventListener('touchstart', initializePiano, { once: true });

// ========== CLEANUP ==========

window.addEventListener('beforeunload', () => {
  // Dispose piano sampler to free AudioBuffers
  if (piano && typeof piano.dispose === 'function') {
    piano.dispose();
    piano = null;
  }
});