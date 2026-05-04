// App18: Modulo Sonoro - Registro
// Visual melodic line with registry-based piano playback

import { createSoundline } from '../../libs/app-common/soundline.js';
import { createMelodicAudioInitializer } from '../../libs/app-common/audio-init.js';
import { setupPianoPreload, isPianoLoaded } from '../../libs/sound/piano.js';
import { registerFactoryReset, createPreferenceStorage } from '../../libs/app-common/preferences.js';
import { ensureToneLoaded } from '../../libs/sound/tone-loader.js';
import { attachHover } from '../../libs/shared-ui/hover.js';
import { createRegistryController } from '../../libs/sound/registry-controller.js';
import { getRandomBPM, getRandomRegistry } from '../../libs/sound/melodic-sequence.js';
import { initIdleCaretFlash } from '../../libs/app-common/idle-caret-flash.js';

// ========== STATE ==========
let isPlaying = false;
let audio = null;
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
let playbackTimeouts = [];

// ========== CONFIGURATION ==========
const SEQUENCE_LENGTH = 6;        // Random notes per playback
const MIN_REGISTRO = 0;
const MAX_REGISTRO = 7;
const MIN_BPM = 75;
const MAX_BPM = 150;

// Preference storage
const preferenceStorage = createPreferenceStorage('app18');

// Registry controller (shared module)
let lastRegistry = null;
const registryController = createRegistryController({
  min: MIN_REGISTRO,
  max: MAX_REGISTRO,
  midiOffset: 12,
  onRegistryChange: () => {
    const next = registryController.getRegistry();
    // Direction: registry up → notes appear from below (slide up).
    // First render or null → no animation.
    const direction = (lastRegistry == null || next == null)
      ? null
      : (next > lastRegistry ? 'up' : 'down');
    lastRegistry = next;
    if (direction) {
      animateRegistrySlide(direction);
    } else {
      drawSoundline();
    }
  }
});

// Slide duration must match the CSS transition; kept in JS so we can
// schedule cleanup of the outgoing numbers track. `AUTO_PLAY_DELAY` is
// slightly longer so playback starts after the registry-scroll settles.
const REGISTRY_SLIDE_MS = 620;

/**
 * Move the number labels into their own clipped layer. The soundline
 * remains untransformed and overflow-visible, so note highlights can
 * extend to the right without being clipped by the registry-scroll effect.
 */
function createNumbersTrack(soundlineEl) {
  const labels = Array.from(soundlineEl.querySelectorAll(':scope > .soundline-number'));
  if (labels.length === 0) return null;

  const windowEl = document.createElement('div');
  windowEl.className = 'soundline-number-window';

  const track = document.createElement('div');
  track.className = 'soundline-numbers-track';

  labels.forEach(label => track.appendChild(label));
  windowEl.appendChild(track);
  soundlineEl.appendChild(windowEl);

  return { windowEl, track };
}

/**
 * Octave-scroll animation. Only the label track rides one full registry
 * up or down over the fixed pink background. We clone the current numbers
 * track as an outgoing overlay, redraw the soundline with the new labels,
 * then slide both tracks in sync.
 *
 * @param {'up'|'down'} direction - 'up' if the registry increased.
 */
function animateRegistrySlide(direction) {
  const oldSoundline = soundline?.element;
  const oldTrack = oldSoundline?.querySelector('.soundline-numbers-track');
  if (!oldSoundline || !oldTrack) {
    drawSoundline();
    return;
  }

  // 1) Clone the current labels as an absolutely-positioned overlay that
  //    will slide off in the chosen direction.
  const overlay = oldTrack.cloneNode(true);
  overlay.classList.add('soundline-numbers-track--overlay');

  // 2) Redraw the real soundline with the new registry's labels.
  drawSoundline();
  const newSoundline = soundline?.element;
  const newWindow = newSoundline?.querySelector('.soundline-number-window');
  const newTrack = newSoundline?.querySelector('.soundline-numbers-track');
  if (!newSoundline || !newWindow || !newTrack) return;

  // 3) Mount the old labels over the new label track, inside the clipped
  //    numbers window only.
  newWindow.appendChild(overlay);

  // 4) Set initial transforms: overlay at home (0), new labels pre-shifted
  //    offscreen on the opposite side. Direction 'up' (registry increased)
  //    means old labels leave through the top and new labels arrive from
  //    the bottom.
  const overlayEndY = direction === 'up' ? -100 : 100;
  const newStartY = direction === 'up' ? 100 : -100;
  newTrack.style.transition = 'none';
  newTrack.style.transform = `translateY(${newStartY}%)`;
  overlay.style.transform = 'translateY(0)';
  overlay.style.opacity = '1';

  // Force layout so the initial offsets stick before we transition.
  void newTrack.offsetHeight;

  // 5) Kick off the scroll: overlay slides off, new labels ride home.
  requestAnimationFrame(() => {
    newTrack.style.transition = '';
    newTrack.style.transform = 'translateY(0)';
    overlay.style.transform = `translateY(${overlayEndY}%)`;
    overlay.style.opacity = '0';
  });

  // 6) Cleanup once the slide finishes.
  setTimeout(() => {
    overlay.remove();
    newTrack.style.transition = '';
    newTrack.style.transform = '';
  }, REGISTRY_SLIDE_MS + 50);
}

// ========== NOTE CLICK HANDLER ==========
const ZERO_POSITION = 0; // Note 0 of current registry is at index 0 (bottom)
const TOP_ZERO_POSITION = 12; // Note 0 of next registry at index 12 (top)

/**
 * Handle click on soundline note (number or division line)
 */
async function handleNoteClick(noteIndex) {
  const registry = registryController.getRegistry();
  if (registry === null) return;

  // Initialize audio if needed
  if (!audio) {
    await initAudio();
  }

  // Convert visual index to note-in-registry using controller
  const noteInRegistry = registryController.getNoteInRegistry(noteIndex);

  // Get MIDI using controller (includes MIDI_OFFSET)
  const { midi } = registryController.getMidiForNote(noteInRegistry);

  // Play the note through the shared mixer/FX chain.
  const Tone = window.Tone;
  audio.playNote(midi, 0.5, Tone?.now?.() ?? 0);

  // Animate the number element
  animateNumberClick(noteIndex);

  // Show highlight rectangle
  highlightNote(noteIndex, 300);

  console.log(`Click: index=${noteIndex}, noteInRegistry=${noteInRegistry}, MIDI=${midi}`);
}

/**
 * Animate a soundline number when clicked (scale + color change)
 */
function animateNumberClick(noteIndex) {
  const numberEl = soundlineWrapper?.querySelector(`.soundline-number[data-note-index="${noteIndex}"]`);
  if (!numberEl) return;

  // Determine if this is note-zero (pink) or regular (orange)
  const isZero = noteIndex === ZERO_POSITION || noteIndex === TOP_ZERO_POSITION;
  const activeClass = isZero ? 'active-zero' : 'active';

  // Remove any existing active classes
  numberEl.classList.remove('active', 'active-zero');

  // Force reflow to restart animation
  void numberEl.offsetWidth;

  // Add the active class
  numberEl.classList.add(activeClass);

  // Remove after animation duration
  setTimeout(() => {
    numberEl.classList.remove(activeClass);
  }, 300);
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
  createNumbersTrack(soundline.element);

  // Wrap the soundline in a `.soundline-block` and prepend the abbr
  // pill (`N`) — same header pattern als App21-24.
  const block = document.createElement('div');
  block.className = 'soundline-block';
  const pill = document.createElement('div');
  pill.className = 'soundline-abbr-pill';
  pill.textContent = 'N';
  soundlineWrapper.insertBefore(block, soundline.element);
  block.appendChild(pill);
  block.appendChild(soundline.element);

  // Add CSS classes for styling registry boundaries and note-zero
  if (registry !== null) {
    const numbers = soundlineWrapper.querySelectorAll('.soundline-number');

    numbers.forEach((num) => {
      const idx = parseInt(num.dataset.noteIndex, 10);

      // Mark boundary notes using controller (index 12 = next registry)
      if (registryController.isBoundaryNote(idx)) {
        num.classList.add('registry-boundary');
      }

      // Mark both zeros (bottom 0^r and top 0^(r+1)) with pink color
      if (idx === ZERO_POSITION || idx === TOP_ZERO_POSITION) {
        num.classList.add('note-zero');
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
    rect.style.transform = 'translateY(-50%)';

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
// Route audio through the shared MelodicTimelineAudio engine so the piano
// sampler lands on the mixer's `melodic` channel (which carries the FX
// chain, including reverb). Volume/mute come from the header via
// `sharedui:volume`/`sharedui:mute`, handled globally by the shared mixer
// — no per-app listener needed.
const _initAudio = createMelodicAudioInitializer({
  defaultInstrument: 'piano'
});

async function initAudio() {
  if (!audio) {
    await ensureToneLoaded();
    audio = await _initAudio();
    if (typeof window !== 'undefined') window.__labAudio = audio;
  }
  return audio;
}

/**
 * Flash a circle element to indicate missing input
 */
function flashMissingInput(element) {
  if (!element) return;
  element.classList.add('flash-warning');
  setTimeout(() => {
    element.classList.remove('flash-warning');
  }, 1000);
}

async function handlePlay() {
  if (isPlaying) {
    stopPlayback();
    return;
  }

  const registry = registryController.getRegistry();
  if (registry === null) {
    // Flash the registro circle to indicate missing input
    flashMissingInput(inputRegistro?.closest('.circle'));
    console.log('No registry selected');
    return;
  }

  // Show loading indicator if piano not yet loaded
  const playIcon = playBtn?.querySelector('.icon-play');
  if (!isPianoLoaded() && playIcon) {
    playIcon.style.opacity = '0.5';
  }

  // Initialize audio if needed
  if (!audio) {
    await initAudio();
  }

  // Restore button opacity after loading
  if (playIcon) {
    playIcon.style.opacity = '1';
  }

  // Generate random sequence only if we don't have one yet
  if (randomNotes.length === 0) {
    handleRandom();
  }

  console.log(`BPM: ${currentBPM}`);
  console.log(`Registry: ${registry}`);
  console.log(`Notes: ${randomNotes.join(', ')}`);

  // Calculate interval between notes
  const intervalSec = 60 / currentBPM;

  // Mark as playing
  isPlaying = true;
  playbackTimeouts = [];
  if (playBtn) {
    playBtn.classList.add('playing');
    const iconPlay = playBtn.querySelector('.icon-play');
    const iconStop = playBtn.querySelector('.icon-stop');
    if (iconPlay) iconPlay.style.display = 'none';
    if (iconStop) iconStop.style.display = 'block';
  }

  clearHighlights();

  // Play sequence — each note triggered inside setTimeout (cancellable)
  const Tone = window.Tone;
  let currentTime = 0;

  randomNotes.forEach((noteInRegistry) => {
    const { midi, clampedNote } = registryController.getMidiForNote(noteInRegistry);
    const noteDurationSec = intervalSec * 0.9;
    const highlightIndex = registryController.getHighlightIndex(clampedNote);
    const delayMs = currentTime * 1000;

    playbackTimeouts.push(setTimeout(() => {
      if (!isPlaying) return;
      audio?.playNote(midi, noteDurationSec, Tone?.now?.() ?? 0);
      highlightNote(highlightIndex, noteDurationSec * 1000);
    }, delayMs));

    currentTime += noteDurationSec;
  });

  playbackTimeouts.push(setTimeout(() => {
    stopPlayback();
  }, currentTime * 1000));
}

function stopPlayback() {
  isPlaying = false;
  playbackTimeouts.forEach(id => clearTimeout(id));
  playbackTimeouts = [];
  // Stop all scheduled/ringing notes via the shared engine.
  audio?.stop?.();
  clearHighlights();

  if (playBtn) {
    playBtn.classList.remove('playing');
    const iconPlay = playBtn.querySelector('.icon-play');
    const iconStop = playBtn.querySelector('.icon-stop');
    if (iconPlay) iconPlay.style.display = 'block';
    if (iconStop) iconStop.style.display = 'none';
  }
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

  // Generate 6 random notes within registry range (0-12: notes 0-11 + note 0 of next registry)
  const totalNotes = registryController.getTotalNotes(); // 13
  randomNotes = [];
  for (let i = 0; i < SEQUENCE_LENGTH; i++) {
    const note = Math.floor(Math.random() * totalNotes); // 0 to 12
    randomNotes.push(note);
  }
  currentBPM = getRandomBPM(MIN_BPM, MAX_BPM);

  console.log(`New random: BPM=${currentBPM}, Notes=${randomNotes.join(',')}`);

  // Auto-play: si ja estem reproduint, atura i recomença amb la nova
  // seqüència. Si no, dispara play.
  scheduleAutoPlay();
}

function handleReset() {
  if (isPlaying) stopPlayback();

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
const AUTO_PLAY_DELAY = 700; // ms after a registry change before auto-firing play
let autoPlayTimer = null;

/**
 * Programa una represa de play quan canvia el registre. Si ja s'està
 * reproduint, atura primer i recomença amb el nou registre — així cada
 * canvi de registre s'escolta immediatament. Debounced per evitar
 * stop+play en cascada quan l'usuari clica spinners ràpid o escriu
 * múltiples dígits.
 */
function scheduleAutoPlay() {
  clearTimeout(autoPlayTimer);
  autoPlayTimer = setTimeout(() => {
    if (registryController.getRegistry() == null) return;
    if (isPlaying) {
      stopPlayback();
      requestAnimationFrame(() => handlePlay());
    } else {
      handlePlay();
    }
  }, AUTO_PLAY_DELAY);
}

function handleRegistroChange(e) {
  const value = inputRegistro.value.trim();
  registryController.setRegistry(value === '' ? null : value);
  console.log('Registry changed to:', registryController.getRegistry());

  // Auto-play després d'escriure un dígit. Inclou el cas en què ja
  // s'està reproduint (atura i recomença amb el nou registre).
  if (e && e.inputType === 'insertText' && /^[0-9]$/.test(e.data)) {
    if (!isPlaying) inputRegistro.blur();
    scheduleAutoPlay();
  }
}

function handleRegistroUp() {
  registryController.increment();
  inputRegistro.value = registryController.getRegistry() ?? '';
  console.log('Registry changed to:', registryController.getRegistry());
  scheduleAutoPlay();
}

function handleRegistroDown() {
  registryController.decrement();
  inputRegistro.value = registryController.getRegistry() ?? '';
  console.log('Registry changed to:', registryController.getRegistry());
  scheduleAutoPlay();
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

  // Instrument changes (header dispatches on window)
  window.addEventListener('sharedui:instrument', (e) => {
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
  const timeline = document.getElementById('timeline');
  const timelineWrapper = document.querySelector('.timeline-wrapper');
  const controls = document.querySelector('.controls');

  if (!timeline || !timelineWrapper || !controls) {
    console.error('Template elements not found');
    return;
  }

  console.log('Elements found');

  // Remove .middle section (formula)
  document.querySelector('.middle')?.remove();

  // Move controls AFTER timeline (soundline first, controls below)
  timelineWrapper.appendChild(controls);

  // Create soundline-container inside timeline (pattern from App10/14)
  const soundlineContainer = document.createElement('div');
  soundlineContainer.className = 'soundline-container';
  timeline.appendChild(soundlineContainer);

  // Set soundlineWrapper to the container (not timeline directly)
  soundlineWrapper = soundlineContainer;

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

  // Idle caret flash on registro circle
  initIdleCaretFlash({ targets: [document.getElementById('inputRegistro')?.closest('.circle')] });

  console.log('App18 initialized - waiting for registry input');
}

// Execute when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
