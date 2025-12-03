// App18: Modulo Sonoro - Registro
// Visual melodic line with registry-based piano playback

import { createSoundline } from '../../libs/app-common/soundline.js';
import { loadPiano } from '../../libs/sound/piano.js';
import { registerFactoryReset, createPreferenceStorage } from '../../libs/app-common/preferences.js';
import { ensureToneLoaded } from '../../libs/sound/tone-loader.js';

// ========== STATE ==========
let isPlaying = false;
let piano = null;
let soundline = null;
let randomNotes = [];
let currentBPM = 0;
let registro = null; // 0-7, null when empty

// DOM element references
let soundlineWrapper = null;
let playBtn = null;
let randomBtn = null;
let resetBtn = null;
let inputRegistro = null;
let registroUp = null;
let registroDown = null;

// Highlight tracking
const activeHighlights = new Map();

// ========== CONFIGURATION ==========
const SEQUENCE_LENGTH = 6;        // Random notes per playback
const MIN_REGISTRO = 0;
const MAX_REGISTRO = 7;
const MIN_BPM = 75;
const MAX_BPM = 200;
const CHROMATIC_BPM = 160;

/**
 * Calculate total notes to display based on registry
 * - Registro 0: 14 notes (no prev: 12 current + 2 next)
 * - Registro 1-6: 15 notes (1 prev + 12 current + 2 next)
 * - Registro 7: 13 notes (no next: 1 prev + 12 current)
 */
function getTotalDisplayedNotes() {
  if (registro === null) return 15;
  if (registro === 0) return 14;  // No previous registry
  if (registro === MAX_REGISTRO) return 13;  // No next registry
  return 15;  // Full range
}

// Preference storage
const preferenceStorage = createPreferenceStorage('app18');

// ========== RANDOM FUNCTIONS ==========
function getRandomBPM() {
  return Math.floor(Math.random() * (MAX_BPM - MIN_BPM + 1)) + MIN_BPM;
}

function getRandomNoteIndex() {
  // Random note within current registry (0-11)
  return Math.floor(Math.random() * 12);
}

function generateRandomNotes() {
  const notes = [];
  for (let i = 0; i < SEQUENCE_LENGTH; i++) {
    notes.push(getRandomNoteIndex());
  }
  return notes;
}

// ========== REGISTRY LABEL FORMATTER ==========
/**
 * Formats a note index as registry label: "Nr" format
 * Layout varies by registry:
 * - Registro 0: No prev (index 0-11 = current, 12-13 = next)
 * - Registro 1-6: Full (index 0 = prev, 1-12 = current, 13-14 = next)
 * - Registro 7: No next (index 0 = prev, 1-12 = current)
 */
function formatRegistryLabel(noteIndex) {
  if (registro === null) return '';

  // Registro 0: No previous registry
  if (registro === 0) {
    if (noteIndex < 12) {
      // Current registry: notes 0-11
      return `${noteIndex}r${registro}`;
    } else {
      // Next registry: notes 0-1 (index 12-13 maps to note 0-1)
      const note = noteIndex - 12;
      return `${note}r${registro + 1}`;
    }
  }

  // Registro 7: No next registry
  if (registro === MAX_REGISTRO) {
    if (noteIndex === 0) {
      // Previous registry: note 11
      return `11r${registro - 1}`;
    } else {
      // Current registry: notes 0-11 (index 1-12 maps to note 0-11)
      const note = noteIndex - 1;
      return `${note}r${registro}`;
    }
  }

  // Registro 1-6: Full range
  if (noteIndex === 0) {
    // Previous registry: note 11
    return `11r${registro - 1}`;
  } else if (noteIndex >= 13) {
    // Next registry: notes 0-1 (index 13-14 maps to note 0-1)
    const note = noteIndex - 13;
    return `${note}r${registro + 1}`;
  } else {
    // Current registry: notes 0-11 (index 1-12 maps to note 0-11)
    const note = noteIndex - 1;
    return `${note}r${registro}`;
  }
}

// ========== MIDI CALCULATION ==========
/**
 * Calculate starting MIDI for the 14-note display
 * The display shows: prev registry note 11, current registry 0-11, next registry note 0
 */
function calculateStartMidi() {
  if (registro === null) return 60;

  // For display starting at previous registry's note 11:
  // MIDI = (registro - 1) * 12 + 11 = registro * 12 - 1
  // Exception: registry 0 has no previous, start at MIDI 0
  if (registro === 0) {
    return 0; // Will show 11r0 at position 0 (conceptual, no actual prev)
  }
  return (registro * 12) - 1;
}

/**
 * Get MIDI for a playable note (0-11) within current registry
 */
function getMidiForPlayableNote(noteInRegistry) {
  if (registro === null) return 60;
  return noteInRegistry + (registro * 12);
}

// ========== SOUNDLINE DRAWING ==========
function drawSoundline() {
  if (!soundlineWrapper) return;

  // Clear previous content
  soundlineWrapper.innerHTML = '';

  // Create soundline with custom label formatter
  soundline = createSoundline({
    container: soundlineWrapper,
    totalNotes: getTotalDisplayedNotes(),
    startMidi: calculateStartMidi(),
    labelFormatter: formatRegistryLabel
  });

  // Add CSS classes for styling registry boundaries
  if (registro !== null) {
    const numbers = soundlineWrapper.querySelectorAll('.soundline-number');

    numbers.forEach((num) => {
      const idx = parseInt(num.dataset.noteIndex, 10);

      // Mark boundary notes based on registry
      let isBoundary = false;
      if (registro === 0) {
        // No prev, boundaries are next registry (index 12-13)
        isBoundary = idx >= 12;
      } else if (registro === MAX_REGISTRO) {
        // No next, boundary is prev registry (index 0)
        isBoundary = idx === 0;
      } else {
        // Full range: prev (0) and next (13-14)
        isBoundary = idx === 0 || idx >= 13;
      }

      if (isBoundary) {
        num.classList.add('registry-boundary');
      }
    });
  }

  console.log('Soundline created for registry:', registro);
}

// ========== LOCAL HIGHLIGHT CONTROLLER (for 14 notes) ==========
/**
 * Highlight a note on the soundline (adapted for 14 notes)
 * @param {number} noteIndex - Note index (0-13)
 * @param {number} duration - Duration in ms
 */
function highlightNote(noteIndex, duration = 300) {
  const totalNotes = getTotalDisplayedNotes();
  if (noteIndex < 0 || noteIndex >= totalNotes) {
    console.warn(`Note index ${noteIndex} out of range (0-${totalNotes - 1})`);
    return;
  }

  if (!soundline || !soundline.element) return;

  // Get or create highlight element
  let rect = activeHighlights.get(noteIndex);

  if (!rect) {
    rect = document.createElement('div');
    rect.className = 'note-highlight';
    rect.dataset.note = noteIndex;

    // Position rectangle
    const yPos = soundline.getNotePosition(noteIndex);
    rect.style.top = `${yPos}%`;
    rect.style.transform = 'translateY(-100%)';

    soundline.element.appendChild(rect);
    activeHighlights.set(noteIndex, rect);
  }

  // Add highlight class
  rect.classList.add('highlight');

  // Auto-remove highlight after duration
  setTimeout(() => {
    rect.classList.remove('highlight');
  }, duration);
}

/**
 * Clear all highlights and remove elements
 */
function clearHighlights() {
  activeHighlights.forEach(rect => {
    rect.classList.remove('highlight');
    rect.remove();
  });
  activeHighlights.clear();
}

// ========== AUDIO FUNCTIONS ==========
async function initPiano() {
  if (!piano) {
    console.log('Ensuring Tone.js is loaded...');
    await ensureToneLoaded();
    console.log('Loading piano...');
    piano = await loadPiano();
    console.log('Piano loaded');
  }
  return piano;
}

async function handlePlay() {
  if (isPlaying) return;
  if (registro === null) {
    console.log('No registry selected');
    return;
  }

  // Initialize piano if needed
  if (!piano) {
    await initPiano();
  }

  // Generate random sequence only if we don't have one yet
  if (randomNotes.length === 0) {
    currentBPM = getRandomBPM();
    randomNotes = generateRandomNotes();
  }

  console.log(`BPM: ${currentBPM}`);
  console.log(`Registry: ${registro}`);
  console.log(`Notes: ${randomNotes.join(', ')}`);

  // Calculate interval between notes
  const intervalSec = 60 / currentBPM;

  // Mark as playing
  isPlaying = true;
  if (playBtn) {
    playBtn.disabled = true;
    playBtn.classList.add('playing');
  }
  if (randomBtn) randomBtn.disabled = true;

  // Clear previous highlights
  clearHighlights();

  // Play sequence
  const Tone = window.Tone;
  const startTime = Tone.now();
  let currentTime = 0;

  randomNotes.forEach((noteInRegistry, idx) => {
    // Calculate MIDI from note in registry
    const midi = getMidiForPlayableNote(noteInRegistry);
    const note = Tone.Frequency(midi, 'midi').toNote();
    const noteDurationSec = intervalSec * 0.9;

    // Schedule audio
    const when = startTime + currentTime;
    piano.triggerAttackRelease(note, noteDurationSec, when);

    // Highlight index depends on registry layout
    // Registro 0: no prev, so noteInRegistry maps directly to index
    // Registro 1-7: has prev at index 0, so noteInRegistry + 1
    const highlightIndex = registro === 0 ? noteInRegistry : noteInRegistry + 1;
    const delayMs = currentTime * 1000;

    setTimeout(() => {
      console.log(`Note ${idx + 1}/${SEQUENCE_LENGTH}: ${noteInRegistry}r${registro} (MIDI ${midi})`);
      highlightNote(highlightIndex, noteDurationSec * 1000);
    }, delayMs);

    currentTime += noteDurationSec;
  });

  // Completion callback
  setTimeout(() => {
    isPlaying = false;
    if (playBtn) {
      playBtn.disabled = false;
      playBtn.classList.remove('playing');
    }
    if (randomBtn) randomBtn.disabled = false;
    clearHighlights();
    console.log('Sequence finished');
  }, currentTime * 1000);
}

function handleRandom() {
  if (isPlaying) return;
  if (registro === null) return;

  // Re-generate random sequence (same registry)
  randomNotes = generateRandomNotes();
  currentBPM = getRandomBPM();

  console.log(`New random: BPM=${currentBPM}, Notes=${randomNotes.join(',')}`);
}

function handleReset() {
  if (isPlaying) return;

  // Clear registry
  registro = null;
  if (inputRegistro) {
    inputRegistro.value = '';
    inputRegistro.focus();
  }

  // Re-draw soundline (empty labels)
  drawSoundline();

  // Clear sequence
  randomNotes = [];
  currentBPM = 0;

  console.log('Reset complete');
}

// ========== REGISTRY INPUT HANDLERS ==========
function handleRegistroChange() {
  const value = inputRegistro.value.trim();

  if (value === '') {
    registro = null;
  } else {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= MIN_REGISTRO && num <= MAX_REGISTRO) {
      registro = num;
    } else if (!isNaN(num)) {
      // Clamp value
      registro = Math.max(MIN_REGISTRO, Math.min(MAX_REGISTRO, num));
      inputRegistro.value = registro;
    }
  }

  // Update soundline
  drawSoundline();

  console.log('Registry changed to:', registro);
}

function handleRegistroUp() {
  if (registro === null) {
    registro = MIN_REGISTRO;
  } else if (registro < MAX_REGISTRO) {
    registro++;
  }
  inputRegistro.value = registro;
  handleRegistroChange();
}

function handleRegistroDown() {
  if (registro === null) {
    registro = MAX_REGISTRO;
  } else if (registro > MIN_REGISTRO) {
    registro--;
  }
  inputRegistro.value = registro;
  handleRegistroChange();
}

// ========== EVENT HANDLERS ==========
function setupEventHandlers() {
  // Play button
  playBtn = document.getElementById('playBtn');
  if (playBtn) {
    playBtn.addEventListener('click', handlePlay);
  }

  // Random button
  randomBtn = document.getElementById('randomBtn');
  if (randomBtn) {
    randomBtn.addEventListener('click', handleRandom);
  }

  // Reset button
  resetBtn = document.getElementById('resetBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', handleReset);
  }

  // Registry input
  inputRegistro = document.getElementById('inputRegistro');
  registroUp = document.getElementById('registroUp');
  registroDown = document.getElementById('registroDown');

  if (inputRegistro) {
    inputRegistro.addEventListener('input', handleRegistroChange);
    inputRegistro.addEventListener('change', handleRegistroChange);

    // Keyboard navigation
    inputRegistro.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        handleRegistroUp();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleRegistroDown();
      }
    });
  }

  if (registroUp) {
    registroUp.addEventListener('click', handleRegistroUp);
  }

  if (registroDown) {
    registroDown.addEventListener('click', handleRegistroDown);
  }

  // Theme changes
  document.addEventListener('sharedui:theme', () => {
    // Theme is handled automatically
  });

  // Instrument changes
  document.addEventListener('sharedui:instrument', (e) => {
    console.log('Instrument changed:', e.detail.instrument);
  });
}

// ========== FACTORY RESET ==========
registerFactoryReset({ storage: preferenceStorage });

// ========== INITIALIZATION ==========
function initApp() {
  console.log('Initializing App18: Modulo Sonoro - Registro');

  // Get template elements
  soundlineWrapper = document.getElementById('timeline');
  const timelineWrapper = document.querySelector('.timeline-wrapper');
  const controls = document.querySelector('.controls');

  if (!soundlineWrapper || !timelineWrapper || !controls) {
    console.error('Template elements not found');
    return;
  }

  console.log('Elements found');

  // Remove .middle section (formula)
  document.querySelector('.middle')?.remove();

  // Move controls inside timeline-wrapper (before timeline)
  timelineWrapper.insertBefore(controls, soundlineWrapper);

  // Draw initial soundline (empty)
  drawSoundline();

  // Setup event listeners
  setupEventHandlers();

  console.log('App18 initialized - waiting for registry input');
}

// Execute when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
