// App9: Línea Temporal - Metrónomo visual con pulso de ruido aleatorio
import { createSimpleVisualSync } from '../../libs/app-common/visual-sync.js';
import { createSimpleHighlightController } from '../../libs/app-common/simple-highlight-controller.js';
import { createMelodicAudioInitializer } from '../../libs/app-common/audio-init.js';
import { bindSharedSoundEvents } from '../../libs/app-common/audio.js';
import { registerFactoryReset, createPreferenceStorage } from '../../libs/app-common/preferences.js';
import { createBpmController } from '../../libs/app-common/bpm-controller.js';
import { initIdleCaretFlash } from '../../libs/app-common/idle-caret-flash.js';


// ========== ESTADO ==========
let pulses = [];
let isPlaying = false;
let audio = null;
let notes = [];  // Array de {startPulse, duration, midi, barElement} para 2 notas
let currentBPM = 90;
let currentInstrument = 'piano';  // Default: piano

// Referencias a elementos del DOM
let timeline = null;
let timelineWrapper = null;
let playBtn = null;
let bpmController = null;

// ========== CONFIGURACIÓN ==========
const TOTAL_PULSES = 9;  // Dibuja 9 pulsos (0-8)
const DEFAULT_BPM = 90;
const MIN_BPM = 50;
const MAX_BPM = 150;

// Storage de preferencias
const preferenceStorage = createPreferenceStorage('app9');

// ========== CONTROLADORES DE VISUALIZACIÓN ==========
const highlightController = createSimpleHighlightController({
  getPulses: () => pulses,
  getLoopEnabled: () => false  // Sin loop
});

const visualSync = createSimpleVisualSync({
  getAudio: () => audio,
  getIsPlaying: () => isPlaying,
  onStep: (step) => {
    highlightController.highlightPulse(step);
  }
});

// ========== BINDING DE DROPDOWNS DE SONIDO ==========
bindSharedSoundEvents({
  getAudio: () => audio,
  mapping: {
    baseSound: 'setBase',      // Dropdown "Pulso" → audio.setBase()
    accentSound: 'setAccent'   // Dropdown "Seleccionado" → audio.setAccent()
  }
});

// ========== LISTENER DE INSTRUMENTO ==========
window.addEventListener('sharedui:instrument', async (e) => {
  currentInstrument = e.detail.instrument;
  console.log(`Instrumento seleccionado: ${currentInstrument}`);
  // Update audio engine instrument for immediate playback
  if (audio) {
    await audio.setInstrument(currentInstrument);
  }
  // Nota: El header ja guarda l'instrument a localStorage amb clau per-app
});

// ========== FUNCIONES DE DIBUJO DEL TIMELINE ==========
function drawTimeline() {
  if (!timeline) return;

  timeline.innerHTML = '';

  // Crear 9 pulsos (0-8) — dots amagats pel tema nuzic
  for (let i = 0; i <= 8; i++) {
    const pulse = document.createElement('div');
    pulse.className = 'pulse';
    pulse.dataset.index = i;
    timeline.appendChild(pulse);
  }

  // Crear números de pulsos (0-8) — element principal amb tema nuzic
  for (let i = 0; i <= 8; i++) {
    const num = document.createElement('div');
    num.className = 'pulse-number';
    num.dataset.index = i;
    num.textContent = i;
    timeline.appendChild(num);
  }

  // Crear fila d'intervals nuzic (sota la timeline, alineada amb polsos)
  let intervalRow = timelineWrapper?.querySelector('.interval-row');
  if (!intervalRow) {
    intervalRow = document.createElement('div');
    intervalRow.className = 'interval-row';
    timeline.insertAdjacentElement('afterend', intervalRow);
  }
  intervalRow.innerHTML = '';

  // 8 cells, each centered between two pulse positions
  for (let i = 1; i <= 8; i++) {
    const cell = document.createElement('div');
    cell.className = 'interval-cell';
    cell.dataset.index = i;
    cell.textContent = i;
    intervalRow.appendChild(cell);
  }

  // Layout lineal (posicionar elementos)
  layoutLinear();

  // Actualizar array de pulsos
  pulses = Array.from(timeline.querySelectorAll('.pulse-number'));
}

function layoutLinear() {
  const numbers = timeline.querySelectorAll('.pulse-number');

  // Posicionar números de pulsos (element principal)
  numbers.forEach(n => {
    const idx = parseInt(n.dataset.index);
    const pct = (idx / (TOTAL_PULSES - 1)) * 100;
    n.style.left = pct + '%';
  });

  // Interval row is a separate DOM element below timeline (not positioned here)
}

// ========== FUNCIONES DE AUDIO ==========
// Usar MelodicTimelineAudio para soporte de piano/flauta
const _baseInitAudio = createMelodicAudioInitializer({
  defaultInstrument: 'piano'
});

async function initAudio() {
  if (!audio) {
    audio = await _baseInitAudio();

    // Los valores por defecto ya están en localStorage (establecidos en index.html)
    // y serán aplicados por header.js al inicializar los dropdowns.
    // Solo establecemos fallbacks si no hay valores guardados.
    const prefs = JSON.parse(localStorage.getItem('app9-preferences') || '{}');
    if (prefs.baseSound) audio.setBase(prefs.baseSound);
    if (prefs.accentSound) audio.setAccent(prefs.accentSound);

    // Exponer audio globalmente para que header.js pueda acceder
    if (typeof window !== 'undefined') {
      window.__labAudio = audio;
    }
  }
  return audio;
}

// Función helper para apps sin inicialización compleja
if (typeof window !== 'undefined') {
  window.__labInitAudio = initAudio;
}

/**
 * Genera una nota MIDI aleatoria del registro 4 (C4-B4)
 * @param {number} [exclude] - Nota MIDI a excluir (para evitar repeticiones)
 * @returns {number} MIDI 60-71
 */
function getRandomMidiNote(exclude) {
  let note;
  do {
    note = 60 + Math.floor(Math.random() * 12);
  } while (note === exclude);
  return note;
}

/**
 * Genera 2 notas de 1 pulso cada una con altura MIDI del registro 4
 * Primera nota: aleatoria entre pulsos 0-3
 * Segunda nota: aleatoria entre pulsos 4-7 (diferente a la primera)
 * @returns {Array} [{startPulse: number, duration: 1, midi: number}, ...]
 */
function generate2Notes() {
  // Primera nota: aleatoria entre 0-3
  const start1 = Math.floor(Math.random() * 4);

  // Segunda nota: aleatoria entre 4-7
  const start2 = 4 + Math.floor(Math.random() * 4);

  const midi1 = getRandomMidiNote();
  const midi2 = getRandomMidiNote(midi1); // Evitar nota idéntica consecutiva

  return [
    { startPulse: start1, duration: 1, midi: midi1 },
    { startPulse: start2, duration: 1, midi: midi2 }
  ];
}

/**
 * Reproduce una nota melódica usando el audio engine (sin latencia)
 * @param {number} midiNumber - Número MIDI (60-71 para registro 4)
 * @param {number} durationSec - Duración en segundos
 */
function playMelodicNote(midiNumber, durationSec, when) {
  if (!audio) return;
  audio.playNote(midiNumber, durationSec, when);
}

async function handlePlay() {
  if (isPlaying) return; // Bloquear si ya está reproduciendo

  // Inicializar audio si es necesario
  if (!audio) {
    await initAudio();
  }

  // Usar BPM del controlador y generar 2 notas aleatorias con MIDI del registro 4
  currentBPM = bpmController?.getValue() || DEFAULT_BPM;
  notes = generate2Notes();

  console.log(`BPM: ${currentBPM}, Instrumento: ${currentInstrument}`);
  console.log(`Nota 1: pulso ${notes[0].startPulse}, MIDI ${notes[0].midi}`);
  console.log(`Nota 2: pulso ${notes[1].startPulse}, MIDI ${notes[1].midi}`);

  // Calcular intervalo entre pulsos (en segundos)
  const intervalSec = 60 / currentBPM;

  // Set vacío - las notas melódicas se reproducen en el callback, no por audio.play()
  const selectedPulses = new Set();

  // Marcar como reproduciendo
  isPlaying = true;
  if (playBtn) {
    playBtn.disabled = true;
    playBtn.classList.add('playing');
  }

  // Limpiar highlights previos y barras de duración previas
  highlightController.clearHighlights();
  timelineWrapper?.querySelectorAll('.interval-cell.active').forEach(n => n.classList.remove('active'));
  // Limpiar cualquier barra anterior de notes previos
  notes.forEach(note => {
    if (note.barElement) {
      note.barElement.remove();
      note.barElement = null;
    }
  });

  // Iniciar reproducción con 9 pulsos (0-8)
  audio.play(
    TOTAL_PULSES,      // 9 pasos para reproducir índices 0-8
    intervalSec,       // Intervalo entre pulsos
    selectedPulses,    // Set con índices de pulsos que tienen nota
    false,             // Sin loop
    (step) => {
      // onPulse: SOLO feedback visual (nunca programar audio aquí)
      console.log(`Paso ${step}`);

      // Highlight interval number in the row below
      timelineWrapper?.querySelectorAll('.interval-cell.active').forEach(n => n.classList.remove('active'));
      if (step < TOTAL_PULSES - 1) {
        const intervalIndex = step + 1;
        const numEl = timelineWrapper?.querySelector(`.interval-cell[data-index="${intervalIndex}"]`);
        if (numEl) numEl.classList.add('active');
      }

      // Crear barras de duración visuales
      notes.forEach((note) => {
        if (step === note.startPulse) {
          note.barElement = createDurationBar(note, intervalSec);
        }
      });

      // Eliminar barras cuando termina la nota
      notes.forEach((note) => {
        if (step === note.startPulse + note.duration - 1) {
          setTimeout(() => {
            if (note.barElement) {
              note.barElement.remove();
              note.barElement = null;
            }
          }, intervalSec * 1000);
        }
      });
    },
    () => {
      // Callback al completar - IMPORTANTE: llamar a audio.stop() para detener el scheduler
      audio.stop();
      isPlaying = false;
      if (playBtn) {
        playBtn.disabled = false;
        playBtn.classList.remove('playing');
      }
      visualSync.stop();
      highlightController.clearHighlights();
      timelineWrapper?.querySelectorAll('.interval-cell.active').forEach(n => n.classList.remove('active'));
      // Limpiar todas las barras de duración
      notes.forEach(note => {
        if (note.barElement) {
          note.barElement.remove();
          note.barElement = null;
        }
      });
      console.log('Metrónomo finalizado');
    },
    {
      onSchedule: (step, when) => {
        // Proactivo: misma precisión temporal que el metrónomo
        notes.forEach(note => {
          if (step === note.startPulse) {
            playMelodicNote(note.midi, intervalSec * note.duration, when);
          }
        });
      }
    }
  );

  // Iniciar sincronización visual
  visualSync.start();
}

/**
 * Crea y anima una barra de duración para una nota
 * @param {Object} note - {startPulse, duration, midi}
 * @param {number} intervalSec - Intervalo entre pulsos en segundos
 * @returns {HTMLElement} Referencia al elemento de barra creado
 */
function createDurationBar(note, intervalSec) {
  if (!timeline) return null;

  // Calcular posiciones en porcentaje
  const pulseSpacing = 100 / (TOTAL_PULSES - 1); // Espaciado entre pulsos: 100% / 8 = 12.5%
  const startPercent = note.startPulse * pulseSpacing;
  const widthPercent = note.duration * pulseSpacing;

  // Calcular duración de animación
  const animationDuration = intervalSec * note.duration;

  // Crear elemento de barra
  const bar = document.createElement('div');
  bar.className = 'interval-block';
  bar.style.left = `${startPercent}%`;
  bar.style.width = '0%';
  bar.style.transitionDuration = `${animationDuration}s`;

  timeline.appendChild(bar);

  // Forzar reflow y animar
  bar.offsetHeight;

  requestAnimationFrame(() => {
    bar.style.width = `${widthPercent}%`;
    bar.style.opacity = '0.8';
    bar.classList.add('active');
  });

  return bar;
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
}

// ========== FACTORY RESET ==========
registerFactoryReset({ storage: preferenceStorage });

// ========== INICIALIZACIÓN ==========
function initApp() {
  console.log('Inicializando App9: Línea Temporal');

  // Obtener referencias al timeline del template
  timeline = document.getElementById('timeline');
  timelineWrapper = document.getElementById('timelineWrapper');

  if (!timeline || !timelineWrapper) {
    console.error('Timeline no encontrado en el template');
    return;
  }

  // Carregar instrument guardat (el header usa localStorage amb clau per-app)
  const savedInstrument = localStorage.getItem('app9:selectedInstrument');
  if (savedInstrument) {
    currentInstrument = savedInstrument;
  }

  // Inicializar BPM controller
  const inputBpm = document.getElementById('inputBpm');
  const bpmUp = document.getElementById('bpmUp');
  const bpmDown = document.getElementById('bpmDown');

  if (inputBpm && bpmUp && bpmDown) {
    bpmController = createBpmController({
      inputEl: inputBpm,
      upBtn: bpmUp,
      downBtn: bpmDown,
      min: MIN_BPM,
      max: MAX_BPM,
      defaultValue: DEFAULT_BPM,
      onChange: (bpm) => {
        currentBPM = bpm;
        if (isPlaying && audio) audio.setTempo(bpm);
      }
    });
    bpmController.attach();
  }

  // Dibujar timeline
  drawTimeline();

  // Configurar event listeners
  setupEventHandlers();

  initIdleCaretFlash({ targets: [document.getElementById('playBtn')] });

  console.log('App9 inicializada correctamente');
}

// Ejecutar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
