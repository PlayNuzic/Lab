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
let isAscending = true; // Toggle para alternar escala ascendente/descendente

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

/**
 * Genera escala cromática C4-B4 (ascendente o descendente)
 * @param {boolean} ascending - true para C4→B4, false para B4→C4
 * @returns {number[]} Array de índices de notas (0-11)
 */
function generateChromaticScale(ascending = true) {
  const scale = [];
  for (let i = 0; i <= 11; i++) {
    scale.push(ascending ? i : 11 - i);
  }
  return scale;
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

  // Generar BPM
  currentBPM = getRandomBPM();

  // Generar escala cromática (ascendente o descendente) + 4 notas random
  const scaleNotes = generateChromaticScale(isAscending);
  const randomSeqNotes = generateRandomNotes();

  // Concatenar: escala primero (12 notas), luego random (4 notas)
  randomNotes = [...scaleNotes, ...randomSeqNotes];

  // Log de información
  console.log(`BPM: ${currentBPM}`);
  console.log(`Escala: ${isAscending ? 'ASCENDENTE (C4→B4)' : 'DESCENDENTE (B4→C4)'}`);
  console.log(`Total notas: ${randomNotes.length} (12 escala + 4 random)`);
  console.log(`Próximo play será: ${isAscending ? 'DESCENDENTE' : 'ASCENDENTE'}`);

  // Toggle para próximo play
  isAscending = !isAscending;

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

  // Reproducir secuencia completa (escala + random) con duración uniforme
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
    const label = idx < 12 ? 'ESCALA' : 'RANDOM';
    setTimeout(() => {
      console.log(`[${label}] Nota ${idx}: ${noteIndex} (MIDI ${midi})`);
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
