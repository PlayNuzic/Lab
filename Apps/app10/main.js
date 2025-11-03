// App10: Línea Sonora - Visual melodic line with piano playback
import { createSoundline } from '../../libs/app-common/soundline.js';
import { loadPiano } from '../../libs/sound/piano.js';
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

// ========== CONFIGURACIÓN ==========
const TOTAL_NOTES = 4;  // 4 notas aleatorias
const MIN_NOTE = 0;      // Nota 0 (MIDI 60 = C4)
const MAX_NOTE = 11;     // Nota 11 (MIDI 71 = B4)
const MIN_BPM = 75;
const MAX_BPM = 200;

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

  // Inicializar piano si es necesario
  if (!piano) {
    await initPiano();
  }

  // Generar BPM y notas aleatorias
  currentBPM = getRandomBPM();
  randomNotes = generateRandomNotes();

  // Elegir una nota aleatoria para que tenga duración 2 pulsos
  const longNoteIndex = Math.floor(Math.random() * TOTAL_NOTES);

  console.log(`BPM: ${currentBPM}`);
  console.log(`Notas: ${randomNotes.map((n, i) => `${n} (MIDI ${soundline.getMidiForNote(n)})${i === longNoteIndex ? ' [LARGA]' : ''}`).join(', ')}`);

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

  // Reproducir secuencia manual con duración variable
  const Tone = window.Tone;
  const startTime = Tone.now();
  let currentTime = 0; // Tiempo acumulado en pulsos

  randomNotes.forEach((noteIndex, idx) => {
    const midi = soundline.getMidiForNote(noteIndex);
    const note = Tone.Frequency(midi, 'midi').toNote();

    // Determinar duración de esta nota
    const isLongNote = idx === longNoteIndex;
    const noteDurationPulses = isLongNote ? 2 : 1;
    const noteDurationSec = intervalSec * noteDurationPulses;

    // Programar reproducción de la nota
    const when = startTime + currentTime;
    piano.triggerAttackRelease(note, noteDurationSec * 0.9, when);

    // Programar highlight
    const delayMs = currentTime * 1000;
    setTimeout(() => {
      console.log(`Nota ${idx}: ${noteIndex} (MIDI ${midi})${isLongNote ? ' [LARGA x2]' : ''}`);
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

  // Obtener referencias del template
  // Usamos timeline (elemento hijo) para no borrar los controles
  soundlineWrapper = document.getElementById('timeline');

  if (!soundlineWrapper) {
    console.error('Soundline wrapper no encontrado en el template');
    return;
  }

  // Dibujar soundline vertical
  drawSoundline();

  // Crear controlador de highlights
  noteHighlightController = createNoteHighlightController({
    soundline,
    highlightDuration: 300
  });

  // Configurar event listeners
  setupEventHandlers();

  // Pre-cargar piano para evitar delay en primer Play
  initPiano();

  console.log('App10 inicializada correctamente');
}

// Ejecutar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
