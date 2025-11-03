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
let randomNoisePulse = -1;  // Índice del pulso que reproduce ruido rosa
let currentBPM = 0;

// Referencias a elementos del DOM
let timeline = null;
let timelineWrapper = null;
let playBtn = null;

// ========== CONFIGURACIÓN ==========
const TOTAL_PULSES = 6;  // Dibuja 6 pulsos (0-5)
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

  // Crear 6 pulsos (0-5)
  for (let i = 0; i <= 5; i++) {
    // Crear pulse (punto)
    const pulse = document.createElement('div');
    pulse.className = 'pulse';
    if (i === 0 || i === 5) pulse.classList.add('endpoint');
    pulse.dataset.index = i;
    timeline.appendChild(pulse);

    // Crear barras en endpoints
    if (i === 0 || i === 5) {
      const bar = document.createElement('div');
      bar.className = 'bar endpoint';
      timeline.appendChild(bar);
    }
  }

  // Crear números
  for (let i = 0; i <= 5; i++) {
    const num = document.createElement('div');
    num.className = 'pulse-number';
    if (i === 0 || i === 5) num.classList.add('endpoint');
    num.dataset.index = i;
    num.textContent = i;
    timeline.appendChild(num);
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
    const pct = (i / 5) * 100;  // 0%, 20%, 40%, 60%, 80%, 100%
    p.style.left = pct + '%';
    p.style.top = '50%';
    p.style.transform = 'translate(-50%, -50%)';
  });

  // Posicionar barras en endpoints
  bars.forEach((bar, idx) => {
    const i = idx === 0 ? 0 : 5;
    const pct = (i / 5) * 100;
    bar.style.left = pct + '%';
    bar.style.top = '30%';
    bar.style.height = '40%';
    bar.style.transform = '';
  });

  // Posicionar números
  numbers.forEach(n => {
    const idx = parseInt(n.dataset.index);
    const pct = (idx / 5) * 100;
    n.style.left = pct + '%';
    n.style.top = '-28px';
    n.style.transform = 'translate(-50%, 0)';
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

async function handlePlay() {
  if (isPlaying) return; // Bloquear si ya está reproduciendo

  // Inicializar audio si es necesario
  if (!audio) {
    await initAudio();
  }

  // Generar BPM y pulso aleatorios
  currentBPM = getRandomBPM();
  randomNoisePulse = getRandomPulseIndex();

  console.log(`BPM: ${currentBPM}, Pulso con ruido: ${randomNoisePulse}`);

  // Calcular intervalo entre pulsos (en segundos)
  const intervalSec = 60 / currentBPM;

  // Configurar qué pulsos reproducen el sonido adicional (ruido rosa)
  const selectedPulses = new Set([randomNoisePulse]);

  // Marcar como reproduciendo
  isPlaying = true;
  if (playBtn) {
    playBtn.disabled = true;
    playBtn.classList.add('playing');
  }

  // Limpiar highlights previos
  highlightController.clearHighlights();

  // Iniciar reproducción
  // Con 6 pulsos visibles (0-5), cuando loop=false necesitamos lg+1 pasos para reproducir todos
  audio.play(
    TOTAL_PULSES + 1,  // 7 pasos para reproducir índices 0-5 sin loop
    intervalSec,       // Intervalo entre pulsos
    selectedPulses,    // Set con el índice del pulso que tiene ruido
    false,             // Sin loop
    (step) => {
      // Callback por cada pulso (opcional, visualSync maneja el highlight)
      console.log(`Paso ${step}`);
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
      console.log('Metrónomo finalizado');
    }
  );

  // Iniciar sincronización visual
  visualSync.start();
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
