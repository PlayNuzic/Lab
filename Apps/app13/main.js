// App13: Intervalos Temporales - Metrónomo visual con intervalo único y suma de silencios
import { createSimpleVisualSync } from '../../libs/app-common/visual-sync.js';
import { createSimpleHighlightController } from '../../libs/app-common/simple-highlight-controller.js';
import { createRhythmAudioInitializer } from '../../libs/app-common/audio-init.js';
import { bindSharedSoundEvents } from '../../libs/app-common/audio.js';
import { registerFactoryReset, createPreferenceStorage } from '../../libs/app-common/preferences.js';
import {
  createIntervalBars,
  highlightIntervalBar,
  clearIntervalHighlights,
  layoutHorizontalIntervalBars,
  applyTimelineStyles
} from '../../libs/app-common/timeline-intervals.js';

// ========== ESTADO ==========
let pulses = [];
let isPlaying = false;
let audio = null;
let noise = null;  // Objeto {startPulse, duration, barElement, numberElement} para 1 ruido
let silenceNumbers = [];  // Array de elementos DOM para números de suma de silencios
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
const preferenceStorage = createPreferenceStorage('app13');

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

  // NO crear números de intervalos en App13 - los ocultaremos en CSS de todas formas

  // Crear barras de intervalos (1-8) usando módulo compartido
  createIntervalBars({
    container: timeline,
    count: 8,
    orientation: 'horizontal',
    cssClass: 'interval-bar'
  });

  // Aplicar configuración de estilos (posiciones de números específicas de App9)
  applyTimelineStyles(timeline, {
    pulseNumberPosition: 'below',     // Números de pulso abajo
    intervalNumberPosition: 'above'   // Números de intervalo arriba
  });

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

  // No posicionar números de intervalos en App13 (no existen)

  // Posicionar barras de intervalos
  layoutHorizontalIntervalBars(timeline, TOTAL_PULSES, 'interval-bar');
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
    const prefs = JSON.parse(localStorage.getItem('app13-preferences') || '{}');
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
 * Genera 1 ruido con duración variable (2-6 pulsos) en posición aleatoria
 * @returns {Object} {startPulse: number, duration: number}
 */
function generateSingleNoise() {
  // Duración aleatoria entre 2 y 6 pulsos
  const duration = Math.floor(Math.random() * 5) + 2; // 2, 3, 4, 5, o 6

  // Posición inicial aleatoria (debe caber el intervalo)
  // El intervalo debe terminar máximo en el pulso 7 (penúltimo pulso visible)
  // Si el intervalo dura D pulsos y empieza en P, ocupa pulsos [P, P+D-1]
  // El máximo inicio es tal que P+D-1 <= 7, es decir P <= 7-D+1 = 8-D
  const maxStart = 8 - duration;  // No usar TOTAL_PULSES aquí, límite fijo en pulso 7
  const startPulse = Math.floor(Math.random() * (maxStart + 1));

  return { startPulse, duration };
}

async function handlePlay() {
  if (isPlaying) return; // Bloquear si ya está reproduciendo

  // Inicializar audio si es necesario
  if (!audio) {
    await initAudio();
  }

  // Generar BPM y 1 ruido aleatorio
  currentBPM = getRandomBPM();
  noise = generateSingleNoise();

  console.log(`BPM: ${currentBPM}`);
  console.log(`Ruido: pulso ${noise.startPulse}, duración ${noise.duration}`);

  // Calcular intervalo entre pulsos (en segundos)
  const intervalSec = 60 / currentBPM;

  // Crear Set con todos los pulsos que deben reproducir ruido
  const selectedPulses = new Set();
  for (let i = 0; i < noise.duration; i++) {
    selectedPulses.add(noise.startPulse + i);
  }

  // Marcar como reproduciendo
  isPlaying = true;
  if (playBtn) {
    playBtn.disabled = true;
    playBtn.classList.add('playing');
  }

  // Limpiar highlights previos y barras de duración previas
  highlightController.clearHighlights();
  clearIntervalHighlights(timeline, 'interval-bar');

  // Limpiar TODAS las barras y números de intervalos anteriores del DOM
  const existingBars = timeline.querySelectorAll('.interval-block');
  existingBars.forEach(bar => bar.remove());

  const existingNumbers = timeline.querySelectorAll('.interval-duration');
  existingNumbers.forEach(num => num.remove());

  // Limpiar números de silencio anteriores
  silenceNumbers.forEach(elem => elem.remove());
  silenceNumbers = [];

  // Variables para tracking de silencios
  let silenceStart = null;
  let silenceCount = 0;

  // Iniciar reproducción con 8 pulsos (0-7), el pulso 8 es solo visual
  audio.play(
    TOTAL_PULSES - 1,  // 8 pasos para reproducir índices 0-7
    intervalSec,       // Intervalo entre pulsos
    selectedPulses,    // Set con índices de pulsos que tienen ruido
    false,             // Sin loop
    (step) => {
      // Callback por cada pulso
      console.log(`Paso ${step}`);

      // Iluminar barra de intervalo correspondiente
      // Pulso N ilumina Intervalo N+1 (pulso 0 → intervalo 1, pulso 1 → intervalo 2, etc.)
      if (step < TOTAL_PULSES - 2) {  // Solo hasta el pulso 6, ya que el 7 iluminaría intervalo 8
        const intervalIndex = step + 1;
        clearIntervalHighlights(timeline, 'interval-bar');
        highlightIntervalBar(timeline, intervalIndex, intervalSec * 1000, 'interval-bar');
      }

      // Verificar si es un pulso con ruido o silencio
      const isNoise = selectedPulses.has(step);

      if (isNoise) {
        // Si había silencios acumulados, crear número de suma centrado
        if (silenceCount > 0) {
          // Calcular posición central del rango de silencios
          const centerPulse = silenceStart + (silenceCount - 1) / 2;
          createSilenceNumber(centerPulse, silenceCount);
          silenceStart = null;
          silenceCount = 0;
        }

        // Si es el inicio del ruido, crear barra persistente
        if (step === noise.startPulse) {
          noise.barElement = createDurationBar(noise, intervalSec);
        }

        // Si es el final del ruido, crear el número de duración
        if (step === noise.startPulse + noise.duration - 1) {
          noise.numberElement = createIntervalNumber(noise);
        }
      } else {
        // Es un silencio
        if (silenceStart === null) {
          silenceStart = step;
        }
        silenceCount++;

        // Si es el último pulso reproducible (7), mostrar suma de silencios centrada
        // El pulso 8 es solo visual/endpoint y no se reproduce
        if (step === TOTAL_PULSES - 2 && silenceCount > 0) {
          const centerPulse = silenceStart + (silenceCount - 1) / 2;
          createSilenceNumber(centerPulse, silenceCount);
        }
      }
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
      clearIntervalHighlights(timeline, 'interval-bar');
      // NO limpiar las barras de duración en App13 (son persistentes)
      console.log('Metrónomo finalizado');
    }
  );

  // Iniciar sincronización visual
  visualSync.start();
}

/**
 * Crea un número de suma de silencios en la posición especificada
 * @param {number} pulsePosition - Posición del pulso (puede ser decimal para centrado)
 * @param {number} count - Cantidad de pulsos silenciosos
 */
function createSilenceNumber(pulsePosition, count) {
  if (!timeline) return;

  // Calcular posición en porcentaje (acepta decimales para posición central)
  const pulseSpacing = 100 / (TOTAL_PULSES - 1);
  const leftPercent = pulsePosition * pulseSpacing;

  // Crear elemento de número
  const num = document.createElement('div');
  num.className = 'silence-sum';
  num.textContent = count;
  num.style.left = `${leftPercent}%`;

  timeline.appendChild(num);

  // Guardar referencia para limpieza
  silenceNumbers.push(num);
}

/**
 * Crea un número de duración del intervalo encima de la barra
 * @param {Object} noise - {startPulse, duration}
 * @returns {HTMLElement} Referencia al elemento de número creado
 */
function createIntervalNumber(noise) {
  if (!timeline) return null;

  // Calcular posición central del intervalo
  const pulseSpacing = 100 / (TOTAL_PULSES - 1);
  const centerPosition = noise.startPulse + (noise.duration - 1) / 2;
  const leftPercent = centerPosition * pulseSpacing;

  // Crear elemento de número
  const num = document.createElement('div');
  num.className = 'interval-duration';
  num.textContent = noise.duration;
  num.style.left = `${leftPercent}%`;

  timeline.appendChild(num);

  return num;
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
  console.log('Inicializando App13: Intervalos Temporales');

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

  console.log('App13 inicializada correctamente');
}

// Ejecutar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
