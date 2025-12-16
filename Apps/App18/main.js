// App18: Modulo Sonoro - Registro
// Visual melodic line with registry-based piano playback

import { createSoundline } from '../../libs/app-common/soundline.js';
import { loadPiano, setupPianoPreload, isPianoLoaded } from '../../libs/sound/piano.js';
import { registerFactoryReset, createPreferenceStorage } from '../../libs/app-common/preferences.js';
import { ensureToneLoaded } from '../../libs/sound/tone-loader.js';
import { attachHover } from '../../libs/shared-ui/hover.js';
import { createRegistryController } from '../../libs/sound/registry-controller.js';
import { generateMelodicSequence, getRandomBPM, getRandomRegistry } from '../../libs/sound/melodic-sequence.js';

// ========== STATE ==========
let isPlaying = false;
let piano = null;
let soundline = null;
let randomNotes = [];
let currentBPM = 0;

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
const MAX_BPM = 150;

// Preference storage
const preferenceStorage = createPreferenceStorage('app18');

// Registry controller (shared module)
const registryController = createRegistryController({
  min: MIN_REGISTRO,
  max: MAX_REGISTRO,
  midiOffset: 12,
  onRegistryChange: () => {
    drawSoundline();
  }
});

// ========== NOTE CLICK HANDLER ==========
/**
 * Handle click on soundline note (number or division line)
 */
async function handleNoteClick(noteIndex) {
  const registry = registryController.getRegistry();
  if (registry === null) return;

  // Initialize piano if needed
  if (!piano) {
    await initPiano();
  }

  // Convert visual index to note-in-registry using controller
  const noteInRegistry = registryController.getNoteInRegistry(noteIndex);

  // Get MIDI using controller (includes MIDI_OFFSET)
  const { midi } = registryController.getMidiForNote(noteInRegistry);

  // Play the note
  const Tone = window.Tone;
  const note = Tone.Frequency(midi, 'midi').toNote();
  piano.triggerAttackRelease(note, 0.5);

  // Show highlight
  highlightNote(noteIndex, 300);

  console.log(`Click: index=${noteIndex}, noteInRegistry=${noteInRegistry}, MIDI=${midi}`);
}

// ========== SOUNDLINE DRAWING ==========
function drawSoundline() {
  if (!soundlineWrapper) return;

  // Clear previous highlights (they reference old DOM elements)
  clearHighlights();

  // Clear previous content
  soundlineWrapper.innerHTML = '';

  const registry = registryController.getRegistry();

  // Create soundline with controller's label formatter and click handler
  soundline = createSoundline({
    container: soundlineWrapper,
    totalNotes: registryController.getTotalNotes(),
    startMidi: registryController.getStartMidi(),
    labelFormatter: (noteIndex) => registryController.formatLabel(noteIndex),
    onNoteClick: handleNoteClick
  });

  // Add CSS classes for styling registry boundaries
  if (registry !== null) {
    const numbers = soundlineWrapper.querySelectorAll('.soundline-number');

    numbers.forEach((num) => {
      const idx = parseInt(num.dataset.noteIndex, 10);

      // Mark boundary notes using controller
      if (registryController.isBoundaryNote(idx)) {
        num.classList.add('registry-boundary');
      }
    });
  }

  console.log('Soundline created for registry:', registry);
}

// ========== LOCAL HIGHLIGHT CONTROLLER (for 14 notes) ==========
// Track pending timeouts to cancel them when same note repeats
const highlightTimeouts = new Map();

/**
 * Highlight a note on the soundline (adapted for 14 notes)
 * @param {number} noteIndex - Note index (0-13)
 * @param {number} duration - Duration in ms
 */
function highlightNote(noteIndex, duration = 300) {
  const totalNotes = registryController.getTotalNotes();
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

  // Cancel any pending timeout for this note (prevents premature removal)
  const existingTimeout = highlightTimeouts.get(noteIndex);
  if (existingTimeout) {
    clearTimeout(existingTimeout);
    highlightTimeouts.delete(noteIndex);
  }

  // Force animation restart: remove class, trigger reflow, add class
  rect.classList.remove('highlight');
  // Force reflow to restart CSS animation
  void rect.offsetWidth;
  rect.classList.add('highlight');

  // Auto-remove highlight after duration
  const timeoutId = setTimeout(() => {
    rect.classList.remove('highlight');
    highlightTimeouts.delete(noteIndex);
  }, duration);

  highlightTimeouts.set(noteIndex, timeoutId);
}

/**
 * Clear all highlights and remove elements
 */
function clearHighlights() {
  // Cancel all pending timeouts
  highlightTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
  highlightTimeouts.clear();

  // Remove all highlight elements
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

    // Setup volume control after Tone.js is available
    setupVolumeControl();
  }
  return piano;
}

/**
 * Connect header volume/mute controls to Tone.js Master
 */
function setupVolumeControl() {
  const Tone = window.Tone;
  if (!Tone) return;

  // Listen to volume changes from header slider
  window.addEventListener('sharedui:volume', (e) => {
    const volume = e.detail?.value ?? 1;
    // Convert linear 0-1 to dB (-Infinity to 0)
    const dB = volume > 0 ? 20 * Math.log10(volume) : -Infinity;
    Tone.getDestination().volume.value = dB;
  });

  // Listen to mute toggle from header speaker icon
  window.addEventListener('sharedui:mute', (e) => {
    const muted = e.detail?.value ?? false;
    Tone.getDestination().mute = muted;
  });
}

async function handlePlay() {
  if (isPlaying) return;

  const registry = registryController.getRegistry();
  if (registry === null) {
    console.log('No registry selected');
    return;
  }

  // Show loading indicator if piano not yet loaded
  const playIcon = playBtn?.querySelector('.icon-play');
  if (!isPianoLoaded() && playIcon) {
    playIcon.style.opacity = '0.5';
  }

  // Initialize piano if needed
  if (!piano) {
    await initPiano();
  }

  // Restore button opacity after loading
  if (playIcon) {
    playIcon.style.opacity = '1';
  }

  // Generate random sequence only if we don't have one yet
  if (randomNotes.length === 0) {
    currentBPM = getRandomBPM(MIN_BPM, MAX_BPM);
    randomNotes = generateMelodicSequence({
      registry,
      length: SEQUENCE_LENGTH,
      minRegistry: MIN_REGISTRO,
      maxRegistry: MAX_REGISTRO
    });
  }

  console.log(`BPM: ${currentBPM}`);
  console.log(`Registry: ${registry}`);
  console.log(`Notes: ${randomNotes.join(', ')}`);

  // Calculate interval between notes
  const intervalSec = 60 / currentBPM;

  // Mark as playing
  isPlaying = true;
  if (playBtn) {
    playBtn.disabled = true;
    playBtn.classList.add('playing');
    // Switch to stop icon
    const iconPlay = playBtn.querySelector('.icon-play');
    const iconStop = playBtn.querySelector('.icon-stop');
    if (iconPlay) iconPlay.style.display = 'none';
    if (iconStop) iconStop.style.display = 'block';
  }
  // Note: randomBtn stays enabled so user can prepare next sequence

  // Clear previous highlights
  clearHighlights();

  // Play sequence
  const Tone = window.Tone;
  const startTime = Tone.now();
  let currentTime = 0;

  randomNotes.forEach((noteInRegistry, idx) => {
    // Calculate MIDI from note in registry using controller
    const { midi, clampedNote } = registryController.getMidiForNote(noteInRegistry);
    const note = Tone.Frequency(midi, 'midi').toNote();
    const noteDurationSec = intervalSec * 0.9;

    // Schedule audio
    const when = startTime + currentTime;
    piano.triggerAttackRelease(note, noteDurationSec, when);

    // Calculate highlight index using controller
    const highlightIndex = registryController.getHighlightIndex(clampedNote);

    const delayMs = currentTime * 1000;

    setTimeout(() => {
      // Format label for logging using controller
      const label = registryController.formatLabel(highlightIndex);
      console.log(`Note ${idx + 1}/${SEQUENCE_LENGTH}: ${label} (MIDI ${midi})`);
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
      // Switch back to play icon
      const iconPlay = playBtn.querySelector('.icon-play');
      const iconStop = playBtn.querySelector('.icon-stop');
      if (iconPlay) iconPlay.style.display = 'block';
      if (iconStop) iconStop.style.display = 'none';
    }
    clearHighlights();
    console.log('Sequence finished');
  }, currentTime * 1000);
}

function handleRandom() {
  // Can be called during playback to prepare next sequence
  const registry = registryController.getRegistry();

  // If no registry, randomize both registry and sequence
  if (registry === null) {
    const newRegistry = getRandomRegistry(MIN_REGISTRO, MAX_REGISTRO);
    registryController.setRegistry(newRegistry);
    if (inputRegistro) {
      inputRegistro.value = newRegistry;
    }
    console.log(`Random registry: ${newRegistry}`);
  }

  // Generate 6 random notes within range -7 to +7 (15 notes centered at 0)
  randomNotes = [];
  for (let i = 0; i < SEQUENCE_LENGTH; i++) {
    const note = Math.floor(Math.random() * 15) - 7; // -7 to +7
    randomNotes.push(note);
  }
  currentBPM = getRandomBPM(MIN_BPM, MAX_BPM);

  console.log(`New random: BPM=${currentBPM}, Notes=${randomNotes.join(',')}`);
}

function handleReset() {
  if (isPlaying) return;

  // Clear registry using controller
  registryController.setRegistry(null);
  if (inputRegistro) {
    inputRegistro.value = '';
    inputRegistro.focus();
  }

  // Clear sequence
  randomNotes = [];
  currentBPM = 0;

  console.log('Reset complete');
}

// ========== REGISTRY INPUT HANDLERS ==========
function handleRegistroChange() {
  const value = inputRegistro.value.trim();
  registryController.setRegistry(value === '' ? null : value);
  console.log('Registry changed to:', registryController.getRegistry());
}

function handleRegistroUp() {
  registryController.increment();
  inputRegistro.value = registryController.getRegistry() ?? '';
  console.log('Registry changed to:', registryController.getRegistry());
}

function handleRegistroDown() {
  registryController.decrement();
  inputRegistro.value = registryController.getRegistry() ?? '';
  console.log('Registry changed to:', registryController.getRegistry());
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

// ========== HOVER LABELS ==========
function setupHovers() {
  if (playBtn) attachHover(playBtn, { text: 'Reproducir secuencia' });
  if (randomBtn) attachHover(randomBtn, { text: 'Nueva secuencia aleatoria. Incluye nuevo registro si no hay uno establecido' });
  if (resetBtn) attachHover(resetBtn, { text: 'Reiniciar' });
  if (registroUp) attachHover(registroUp, { text: 'Registro +1' });
  if (registroDown) attachHover(registroDown, { text: 'Registro -1' });
}

// ========== FACTORY RESET ==========
registerFactoryReset({ storage: preferenceStorage });

// ========== INITIALIZATION ==========
function initApp() {
  console.log('Initializing App18: Modulo Sonoro - Registro');

  // Setup piano preload in background (reduces latency on first play)
  setupPianoPreload({ delay: 300 });

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

  // Setup hover labels
  setupHovers();

  // Focus on input registro at startup
  if (inputRegistro) {
    inputRegistro.focus();
  }

  console.log('App18 initialized - waiting for registry input');
}

// Execute when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
