// App10: Línea Sonora - Visual melodic line with piano playback
import { createSoundline } from '../../libs/app-common/soundline.js';
import { loadPiano, setupPianoPreload, isPianoLoaded } from '../../libs/sound/piano.js';
import { createNoteHighlightController } from '../../libs/app-common/note-highlight.js';
import { registerFactoryReset, createPreferenceStorage } from '../../libs/app-common/preferences.js';
import { ensureToneLoaded } from '../../libs/sound/tone-loader.js';

// ========== ESTADO ==========
let isPlaying = false;
let piano = null;
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
const MAX_BPM = 200;
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

// ========== FUNCIONES DE AUDIO ==========
async function initPiano() {
  if (!piano) {
    console.log('Asegurando que Tone.js esté cargado...');
    await ensureToneLoaded();
    console.log('Cargando piano...');
    piano = await loadPiano();
    console.log('Piano cargado correctamente');
  }
  return piano;
}

async function handlePlay() {
  if (isPlaying) return; // Bloquear si ya está reproduciendo

  // Show loading indicator if piano not yet loaded
  const playIcon = playBtn?.querySelector('.icon-play');
  if (!isPianoLoaded() && playIcon) {
    playIcon.style.opacity = '0.5';
  }

  // Inicializar piano si es necesario
  if (!piano) {
    await initPiano();
  }

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
  const Tone = window.Tone;
  const startTime = Tone.now();
  let currentTime = 0; // Tiempo acumulado en segundos

  randomNotes.forEach((noteIndex, idx) => {
    const midi = soundline.getMidiForNote(noteIndex);
    const note = Tone.Frequency(midi, 'midi').toNote();

    // Todas las notas tienen la misma duración (1 pulso)
    const noteDurationSec = intervalSec;

    // Programar reproducción de la nota
    const when = startTime + currentTime;
    piano.triggerAttackRelease(note, noteDurationSec * 0.9, when);

    // Programar highlight
    const delayMs = currentTime * 1000;
    setTimeout(() => {
      console.log(`[RANDOM] Nota ${idx + 1}/6: ${noteIndex} (MIDI ${midi})`);
      noteHighlightController.highlightNote(noteIndex, noteDurationSec * 1000 * 0.9);
    }, delayMs);

    // Avanzar tiempo para la próxima nota
    currentTime += noteDurationSec;
  });

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
function playChromaticScale(notes, intervalMs) {
  let currentIndex = 0;

  const playNextNote = () => {
    if (currentIndex >= notes.length) {
      console.log('Chromatic scale completed');
      return;
    }

    const noteIndex = notes[currentIndex];
    const midi = soundline.getMidiForNote(noteIndex);
    const note = window.Tone.Frequency(midi, 'midi').toNote();

    // Play note
    piano.triggerAttackRelease(note, (intervalMs / 1000) * 0.9);

    // Highlight note visually
    noteHighlightController.highlightNote(noteIndex, intervalMs * 0.9);

    console.log(`[INTRO] Nota ${currentIndex}: ${noteIndex} (MIDI ${midi})`);

    currentIndex++;

    // Schedule next note
    if (currentIndex < notes.length) {
      setTimeout(playNextNote, intervalMs);
    }
  };

  // Start sequence
  playNextNote();
}

/**
 * Handles the start overlay click
 * Plays chromatic scale (0-11) at BPM 160, then hides overlay
 */
async function handleStartOverlay() {
  console.log('Start overlay clicked - playing chromatic scale');

  // Hide overlay
  startOverlay.classList.add('hidden');

  // Initialize piano (deferred from initApp)
  await initPiano();

  // Play chromatic scale: notes 0-11 ascending at BPM 160
  const chromaticNotes = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const intervalMs = (60 / CHROMATIC_BPM) * 1000;

  console.log(`Playing chromatic scale at ${CHROMATIC_BPM} BPM (interval: ${intervalMs.toFixed(0)}ms)`);

  // Play scale with visual feedback
  playChromaticScale(chromaticNotes, intervalMs);
}

// ========== EVENT HANDLERS ==========
function setupEventHandlers() {
  // Obtener botón Play del template
  playBtn = document.getElementById('playBtn');

  if (playBtn) {
    playBtn.addEventListener('click', handlePlay);
  }

  // Manejo de cambios de tema (manejado por header compartido)
  document.addEventListener('sharedui:theme', (e) => {
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

  // Setup piano preload in background (reduces latency on first play)
  setupPianoPreload({ delay: 300 });

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
