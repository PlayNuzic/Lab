// App9: Línea Temporal - Metrónomo visual con pulso de ruido aleatorio
import { createSimpleVisualSync } from '../../libs/app-common/visual-sync.js';
import { createSimpleHighlightController } from '../../libs/app-common/simple-highlight-controller.js';
import { createRhythmAudioInitializer } from '../../libs/app-common/audio-init.js';
import { bindSharedSoundEvents } from '../../libs/app-common/audio.js';
import { registerFactoryReset, createPreferenceStorage } from '../../libs/app-common/preferences.js';

// ========== ESTADO ==========
let pulses = [];
let isPlaying = false;
let audio = null;
let noises = [];  // Array de {startPulse, duration, barElement} para 2 ruidos
let currentBPM = 0;

// Referencias a elementos del DOM
let timeline = null;
let timelineWrapper = null;
let playBtn = null;

// ========== CONFIGURACIÓN ==========
const TOTAL_PULSES = 9;  // Dibuja 9 pulsos (0-8)
const MIN_BPM = 75;
const MAX_BPM = 200;

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

// ========== FUNCIONES DE DIBUJO DEL TIMELINE ==========
function drawTimeline() {
  if (!timeline) return;

  timeline.innerHTML = '';

  // Crear 9 pulsos (0-8)
  for (let i = 0; i <= 8; i++) {
    // Crear pulse (punto)
    const pulse = document.createElement('div');
    pulse.className = 'pulse';
    if (i === 0 || i === 8) pulse.classList.add('endpoint');
    pulse.dataset.index = i;
    timeline.appendChild(pulse);

    // Crear barras en endpoints
    if (i === 0 || i === 8) {
      const bar = document.createElement('div');
      bar.className = 'bar endpoint';
      timeline.appendChild(bar);
    }
  }

  // Crear números de pulsos (0-8)
  for (let i = 0; i <= 8; i++) {
    const num = document.createElement('div');
    num.className = 'pulse-number';
    if (i === 0 || i === 8) num.classList.add('endpoint');
    num.dataset.index = i;
    num.textContent = i;
    timeline.appendChild(num);
  }

  // Crear números de intervalos (1-8) - posicionados entre pulsos
  for (let i = 1; i <= 8; i++) {
    const intervalNum = document.createElement('div');
    intervalNum.className = 'interval-number';
    intervalNum.dataset.index = i;
    intervalNum.textContent = i;
    timeline.appendChild(intervalNum);
  }

  // Layout lineal (posicionar elementos)
  layoutLinear();

  // Actualizar array de pulsos
  pulses = Array.from(timeline.querySelectorAll('.pulse'));
}

function layoutLinear() {
  const pulsesElems = timeline.querySelectorAll('.pulse');
  const bars = timeline.querySelectorAll('.bar');
  const numbers = timeline.querySelectorAll('.pulse-number');

  // Posicionar pulsos en línea horizontal
  pulsesElems.forEach((p, i) => {
    const pct = (i / (TOTAL_PULSES - 1)) * 100;  // Distribuir de 0% a 100%
    p.style.left = pct + '%';
    p.style.top = '50%';
    p.style.transform = 'translate(-50%, -50%)';
  });

  // Posicionar barras en endpoints
  bars.forEach((bar, idx) => {
    const i = idx === 0 ? 0 : (TOTAL_PULSES - 1);
    const pct = (i / (TOTAL_PULSES - 1)) * 100;
    bar.style.left = pct + '%';
    bar.style.top = '30%';
    bar.style.height = '40%';
    bar.style.transform = '';
  });

  // Posicionar números de pulsos
  numbers.forEach(n => {
    const idx = parseInt(n.dataset.index);
    const pct = (idx / (TOTAL_PULSES - 1)) * 100;
    n.style.left = pct + '%';
    n.style.top = '-28px';
    n.style.transform = 'translate(-50%, 0)';
  });

  // Posicionar números de intervalos (centrados entre pulsos)
  const intervalNumbers = timeline.querySelectorAll('.interval-number');
  intervalNumbers.forEach(n => {
    const idx = parseInt(n.dataset.index);
    // Posición en punto medio entre pulso (idx-1) y pulso (idx)
    const pct = ((idx - 0.5) / (TOTAL_PULSES - 1)) * 100;
    n.style.left = pct + '%';
    n.style.top = '70%';
    n.style.transform = 'translate(-50%, -50%)';
  });
}

// ========== FUNCIONES DE AUDIO ==========
// Crear inicializador de audio usando el sistema compartido
const _baseInitAudio = createRhythmAudioInitializer({
  getSoundSelects: () => ({
    baseSoundSelect: document.querySelector('#baseSoundSelect'),
    accentSoundSelect: document.querySelector('#accentSoundSelect')
  })
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

function getRandomBPM() {
  return Math.floor(Math.random() * (MAX_BPM - MIN_BPM + 1)) + MIN_BPM;
}

function getRandomPulseIndex() {
  return Math.floor(Math.random() * TOTAL_PULSES);
}

/**
 * Genera 2 ruidos con duraciones fijas (1 pulso y 2 pulsos) sin solapamiento
 * Las posiciones y el orden son aleatorios, garantizando que ambos quepan en los 9 pulsos (0-8)
 * @returns {Array} [{startPulse: number, duration: 1 o 2}, {startPulse: number, duration: 2 o 1}]
 */
function generate2Noises() {
  const noises = [];

  // Decidir aleatoriamente el orden: 50% chance de cada combinación
  const shortFirst = Math.random() < 0.5;
  const firstDuration = shortFirst ? 1 : 2;
  const secondDuration = shortFirst ? 2 : 1;

  // Pulsos disponibles: 0-8 (9 pulsos totales)
  // Un ruido que empieza en pulso X con duración D ocupa los pulsos [X, X+D-1]

  // Para que ambos quepan secuencialmente sin solaparse:
  // Ruido 1 ocupa: [start1, start1 + duration1 - 1]
  // Ruido 2 ocupa: [start2, start2 + duration2 - 1]
  // Restricción: start2 >= start1 + duration1 (no solapamiento)
  // Restricción: start2 + duration2 - 1 <= 8 (última posición válida)

  // Máximo inicio del ruido 1 para garantizar espacio para ambos:
  // start1 + duration1 + duration2 <= 9
  // start1 <= 9 - duration1 - duration2
  const maxStart1 = TOTAL_PULSES - firstDuration - secondDuration;
  const start1 = Math.floor(Math.random() * (maxStart1 + 1));

  noises.push({ startPulse: start1, duration: firstDuration });

  // Rango válido para el segundo ruido:
  // Mínimo: justo después del primero
  const minStart2 = start1 + firstDuration;
  // Máximo: último pulso donde cabe (inicio + duración - 1 <= 8)
  const maxStart2 = TOTAL_PULSES - secondDuration;

  const start2 = Math.floor(Math.random() * (maxStart2 - minStart2 + 1)) + minStart2;
  noises.push({ startPulse: start2, duration: secondDuration });

  return noises;
}

async function handlePlay() {
  if (isPlaying) return; // Bloquear si ya está reproduciendo

  // Inicializar audio si es necesario
  if (!audio) {
    await initAudio();
  }

  // Generar BPM y 2 ruidos aleatorios sin solapamiento
  currentBPM = getRandomBPM();
  noises = generate2Noises();

  console.log(`BPM: ${currentBPM}`);
  console.log(`Ruido 1: pulso ${noises[0].startPulse}, duración ${noises[0].duration}`);
  console.log(`Ruido 2: pulso ${noises[1].startPulse}, duración ${noises[1].duration}`);

  // Calcular intervalo entre pulsos (en segundos)
  const intervalSec = 60 / currentBPM;

  // Crear Set con todos los pulsos que deben reproducir ruido
  const selectedPulses = new Set();
  noises.forEach(noise => {
    for (let i = 0; i < noise.duration; i++) {
      selectedPulses.add(noise.startPulse + i);
    }
  });

  // Marcar como reproduciendo
  isPlaying = true;
  if (playBtn) {
    playBtn.disabled = true;
    playBtn.classList.add('playing');
  }

  // Limpiar highlights previos y barras de duración previas
  highlightController.clearHighlights();
  // Limpiar cualquier barra anterior de noises previos
  noises.forEach(noise => {
    if (noise.barElement) {
      noise.barElement.remove();
      noise.barElement = null;
    }
  });

  // Iniciar reproducción con 9 pulsos (0-8)
  audio.play(
    TOTAL_PULSES,      // 9 pasos para reproducir índices 0-8
    intervalSec,       // Intervalo entre pulsos
    selectedPulses,    // Set con índices de pulsos que tienen ruido
    false,             // Sin loop
    (step) => {
      // Callback por cada pulso
      console.log(`Paso ${step}`);

      // Verificar si algún ruido empieza en este pulso
      noises.forEach((noise) => {
        if (step === noise.startPulse) {
          // Crear barra de duración y guardar referencia en el objeto noise
          noise.barElement = createDurationBar(noise, intervalSec);
        }
      });

      // Verificar si algún ruido termina en este pulso
      noises.forEach((noise) => {
        if (step === noise.startPulse + noise.duration - 1) {
          // Programar eliminación de barra después del pulso
          setTimeout(() => {
            if (noise.barElement) {
              noise.barElement.remove();
              noise.barElement = null;
            }
          }, intervalSec * 1000);
        }
      });
    },
    () => {
      // Callback al completar
      isPlaying = false;
      if (playBtn) {
        playBtn.disabled = false;
        playBtn.classList.remove('playing');
      }
      visualSync.stop();
      highlightController.clearHighlights();
      // Limpiar todas las barras de duración
      noises.forEach(noise => {
        if (noise.barElement) {
          noise.barElement.remove();
          noise.barElement = null;
        }
      });
      console.log('Metrónomo finalizado');
    }
  );

  // Iniciar sincronización visual
  visualSync.start();
}

/**
 * Crea y anima una barra de duración para un ruido
 * @param {Object} noise - {startPulse, duration}
 * @param {number} intervalSec - Intervalo entre pulsos en segundos
 * @returns {HTMLElement} Referencia al elemento de barra creado
 */
function createDurationBar(noise, intervalSec) {
  if (!timeline) return null;

  // Calcular posiciones en porcentaje
  const pulseSpacing = 100 / (TOTAL_PULSES - 1); // Espaciado entre pulsos: 100% / 8 = 12.5%
  const startPercent = noise.startPulse * pulseSpacing;
  const widthPercent = noise.duration * pulseSpacing;

  // Calcular duración de animación
  const animationDuration = intervalSec * noise.duration;

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

  // Dibujar timeline con 6 pulsos (0-5)
  drawTimeline();

  // Configurar event listeners
  setupEventHandlers();

  console.log('App9 inicializada correctamente');
}

// Ejecutar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
