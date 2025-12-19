// App10: Línea Sonora - Visual melodic line with piano playback
import { createSoundline } from '../../libs/app-common/soundline.js';
import { createMelodicAudioInitializer } from '../../libs/app-common/audio-init.js';
import { createNoteHighlightController } from '../../libs/app-common/note-highlight.js';
import { registerFactoryReset, createPreferenceStorage } from '../../libs/app-common/preferences.js';
import { ensureToneLoaded } from '../../libs/sound/tone-loader.js';

// ========== ESTADO ==========
let isPlaying = false;
let audio = null;
let soundline = null;
let noteHighlightController = null;
let randomNotes = [];
let currentBPM = 0;

// Referencias a elementos del DOM
let soundlineWrapper = null;
let playBtn = null;
let startOverlay = null;

// ========== CONFIGURACIÓN ==========
const TOTAL_NOTES = 6;  // 6 notas aleatorias (changed from 4)
const MIN_NOTE = 0;      // Nota 0 (MIDI 60 = C4)
const MAX_NOTE = 11;     // Nota 11 (MIDI 71 = B4)
const MIN_BPM = 75;
const MAX_BPM = 120;
const CHROMATIC_BPM = 160; // BPM fijo para escala cromática inicial

// Storage de preferencias
const preferenceStorage = createPreferenceStorage('app10');

// ========== FUNCIONES DE RANDOM ==========
function getRandomBPM() {
  return Math.floor(Math.random() * (MAX_BPM - MIN_BPM + 1)) + MIN_BPM;
}

function getRandomNoteIndex() {
  return Math.floor(Math.random() * (MAX_NOTE - MIN_NOTE + 1)) + MIN_NOTE;
}

function generateRandomNotes() {
  const notes = [];
  for (let i = 0; i < TOTAL_NOTES; i++) {
    notes.push(getRandomNoteIndex());
  }
  return notes;
}

// ========== FUNCIONES DE DIBUJO ==========
function drawSoundline() {
  if (!soundlineWrapper) return;

  // Limpiar contenido previo
  soundlineWrapper.innerHTML = '';

  // Crear soundline usando módulo compartido
  soundline = createSoundline(soundlineWrapper);

  console.log('Soundline creada correctamente');
}

// ========== AUDIO ==========
// Usar MelodicTimelineAudio para soporte de piano
const _baseInitAudio = createMelodicAudioInitializer({
  defaultInstrument: 'piano'
});

async function initAudio() {
  if (!audio) {
    audio = await _baseInitAudio();
    if (typeof window !== 'undefined') {
      window.__labAudio = audio;
      window.NuzicAudioEngine = audio;
    }
    console.log('Audio engine inicializado');
  }
  return audio;
}

if (typeof window !== 'undefined') {
  window.__labInitAudio = initAudio;
}

/**
 * Reproduce una nota melódica con piano (patrón App13)
 * @param {number} midiNumber - Número MIDI (60-71 para registro 4)
 * @param {number} durationSec - Duración en segundos
 */
async function playMelodicNote(midiNumber, durationSec) {
  const { playNote } = await import('../../libs/sound/piano.js');
  await playNote(midiNumber, durationSec);
}

async function handlePlay() {
  if (isPlaying) return; // Bloquear si ya está reproduciendo

  // Show loading indicator
  const playIcon = playBtn?.querySelector('.icon-play');
  if (playIcon) {
    playIcon.style.opacity = '0.5';
  }

  // Ensure Tone.js is loaded
  await ensureToneLoaded();

  // Initialize audio engine if needed
  await initAudio();

  // Restore button opacity after loading
  if (playIcon) {
    playIcon.style.opacity = '1';
  }

  // Generar BPM
  currentBPM = getRandomBPM();

  // Generar SOLO 6 notas aleatorias (sin escala cromática)
  randomNotes = generateRandomNotes();

  // Log de información
  console.log(`BPM: ${currentBPM}`);
  console.log(`Total notas: ${randomNotes.length} (random)`);
  console.log(`Notas: ${randomNotes.join(', ')}`);

  // Calcular intervalo entre notas (en segundos)
  const intervalSec = 60 / currentBPM;

  // Marcar como reproduciendo
  isPlaying = true;
  if (playBtn) {
    playBtn.disabled = true;
    playBtn.classList.add('playing');
  }

  // Limpiar highlights previos
  noteHighlightController.clearHighlights();

  // Reproducir secuencia de 6 notas aleatorias
  let currentTime = 0; // Tiempo acumulado en segundos

  for (let idx = 0; idx < randomNotes.length; idx++) {
    const noteIndex = randomNotes[idx];
    const midi = soundline.getMidiForNote(noteIndex);

    // Todas las notas tienen la misma duración (1 pulso)
    const noteDurationSec = intervalSec;

    // Programar reproducción y highlight
    const delayMs = currentTime * 1000;
    setTimeout(async () => {
      console.log(`[RANDOM] Nota ${idx + 1}/6: ${noteIndex} (MIDI ${midi})`);
      await playMelodicNote(midi, noteDurationSec * 0.9);
      noteHighlightController.highlightNote(noteIndex, noteDurationSec * 1000 * 0.9);
    }, delayMs);

    // Avanzar tiempo para la próxima nota
    currentTime += noteDurationSec;
  }

  // Callback al completar toda la secuencia
  setTimeout(() => {
    isPlaying = false;
    if (playBtn) {
      playBtn.disabled = false;
      playBtn.classList.remove('playing');
    }
    noteHighlightController.clearHighlights();
    console.log('Secuencia finalizada');
  }, currentTime * 1000);
}

/**
 * Plays chromatic scale with visual highlights
 * @param {number[]} notes - Array of note indices (0-11)
 * @param {number} intervalMs - Time between notes in milliseconds
 */
async function playChromaticScale(notes, intervalMs) {
  for (let i = 0; i < notes.length; i++) {
    const noteIndex = notes[i];
    const midi = soundline.getMidiForNote(noteIndex);

    console.log(`[INTRO] Nota ${i}: ${noteIndex} (MIDI ${midi})`);

    // Play note and highlight
    await playMelodicNote(midi, (intervalMs / 1000) * 0.9);
    noteHighlightController.highlightNote(noteIndex, intervalMs * 0.9);

    // Wait for next note
    if (i < notes.length - 1) {
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }

  console.log('Chromatic scale completed');
}

/**
 * Handles the start overlay click
 * Plays chromatic scale (0-11) at BPM 160, then hides overlay
 */
async function handleStartOverlay() {
  console.log('Start overlay clicked - playing chromatic scale');

  // Hide overlay
  startOverlay.classList.add('hidden');

  // Ensure Tone.js is loaded first
  await ensureToneLoaded();

  // Initialize audio engine
  await initAudio();

  // Play chromatic scale: notes 0-11 ascending at BPM 160
  const chromaticNotes = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const intervalMs = (60 / CHROMATIC_BPM) * 1000;

  console.log(`Playing chromatic scale at ${CHROMATIC_BPM} BPM (interval: ${intervalMs.toFixed(0)}ms)`);

  // Play scale with visual feedback
  await playChromaticScale(chromaticNotes, intervalMs);
}

// ========== EVENT HANDLERS ==========
function setupEventHandlers() {
  // Obtener botón Play del template
  playBtn = document.getElementById('playBtn');

  if (playBtn) {
    playBtn.addEventListener('click', handlePlay);
  }

  // Manejo de cambios de tema (manejado por header compartido)
  document.addEventListener('sharedui:theme', () => {
    // El tema ya es manejado automáticamente
  });

  // Manejo de cambios de instrumento
  document.addEventListener('sharedui:instrument', (e) => {
    console.log('Instrumento cambiado:', e.detail.instrument);
    // Por ahora solo tenemos piano, en el futuro podríamos cargar otros instrumentos
  });
}

// ========== FACTORY RESET ==========
registerFactoryReset({ storage: preferenceStorage });

// ========== INICIALIZACIÓN ==========
function initApp() {
  console.log('Inicializando App10: Línea Sonora');

  // Get timeline element from template
  const timeline = document.getElementById('timeline');
  if (!timeline) {
    console.error('Cannot find #timeline element');
    return;
  }

  // Extract .controls before removing .middle (patrón exacto App14)
  const middle = document.querySelector('.middle');
  const controlsSection = middle?.querySelector('.controls');
  if (controlsSection && timeline.parentElement) {
    // Insert controls as sibling BEFORE timeline-wrapper (no wrapper needed)
    timeline.parentElement.parentElement.insertBefore(controlsSection, timeline.parentElement);
  }
  middle?.remove();

  // Create soundline container inside timeline (como App14)
  const soundlineContainer = document.createElement('div');
  soundlineContainer.className = 'soundline-container';
  soundlineContainer.style.position = 'relative';
  soundlineContainer.style.width = '100%';
  soundlineContainer.style.height = '100%';
  timeline.appendChild(soundlineContainer);

  // Set soundlineWrapper reference for drawSoundline
  soundlineWrapper = soundlineContainer;

  console.log('Layout creado correctamente (patrón App14)');

  // Dibujar soundline vertical
  drawSoundline();

  // Crear controlador de highlights
  noteHighlightController = createNoteHighlightController({
    container: soundlineContainer,
    soundline,
    notes: 12
  });

  // Configurar event listeners
  setupEventHandlers();

  // Create start overlay (deferred piano initialization) - específico App10
  startOverlay = document.createElement('div');
  startOverlay.className = 'start-overlay';
  startOverlay.textContent = 'Toca para escuchar los números';
  document.body.appendChild(startOverlay);

  // Start overlay click handler
  startOverlay.addEventListener('click', handleStartOverlay);

  console.log('App10 inicializada correctamente - esperando interacción del usuario');
}

// Ejecutar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
