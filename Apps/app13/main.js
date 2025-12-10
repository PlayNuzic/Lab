// App13: Intervalos Temporales - Editor de secuencias de iT con reproducción
import { createRhythmAudioInitializer } from '../../libs/app-common/audio-init.js';
import { bindSharedSoundEvents } from '../../libs/app-common/audio.js';
import { registerFactoryReset, createPreferenceStorage } from '../../libs/app-common/preferences.js';
import { ensureToneLoaded } from '../../libs/sound/tone-loader.js';

// ========== CONFIGURACIÓN ==========
const TOTAL_PULSES = 9;  // Pulsos 0-8 (8 es endpoint visual)
const MAX_LENGTH = 8;    // Suma total de iTs
const MAX_ITS = 4;       // Máximo 4 inputs de iT
const MIN_BPM = 75;
const MAX_BPM = 200;
const FADEOUT_TIME = 0.05; // 50ms fadeout para evitar cracks

// Sons per reproduir segons duració de l'iT
// Sons CURTS (per iT = 1): Click13, Click15, Click17
const SHORT_SOUNDS = ['click13', 'click15', 'click17'];
// Sons LLARGS (per iT > 1): Click12, Click14, Click16 (es tallen amb fadeout)
const LONG_SOUNDS = ['click12', 'click14', 'click16'];

// Colors ben diferenciats per les barres (màxim 4 iTs)
const VIBRANT_COLORS = [
  '#E74C3C', // vermell
  '#F1C40F', // groc
  '#2ECC71', // verd
  '#3498DB'  // blau
];

// ========== ESTADO ==========
let isPlaying = false;
let audio = null;
let currentIntervals = []; // Array de valores iT entrats
let playbackTimeouts = []; // Per cancel·lar reproducció

// Persistència de sons i colors (es manté fins canvi d'editor o random)
let currentSoundAssignments = null;
let currentColorAssignments = null;

// So actual del metrònom (seleccionable via header dropdown)
// Llegir de localStorage per respectar selecció prèvia de l'usuari
let currentMetronomeSound = (() => {
  try {
    const stored = localStorage.getItem('baseSound');
    return stored || 'click9';
  } catch {
    return 'click9';
  }
})();

// Referències DOM
let timeline = null;
let itEditor = null;
let itInputs = [];
let playBtn = null;
let randomBtn = null;
let resetBtn = null;
let tooltip = null;
let tooltipTimeout = null;

// Storage de preferencias
const preferenceStorage = createPreferenceStorage('app13');

// ========== UTILITATS ==========
function getRandomBPM() {
  return Math.floor(Math.random() * (MAX_BPM - MIN_BPM + 1)) + MIN_BPM;
}

/**
 * Assigna sons únics a cada interval segons la seva duració
 * - iT = 1: Sons curts (Click13, Click15, Click17)
 * - iT > 1: Sons llargs (Click12, Click14, Click16)
 * @param {number[]} intervals - Array de duracions dels intervals
 * @returns {string[]} - Array de sons assignats (un per cada interval)
 */
function assignSoundsToIntervals(intervals) {
  // Separar intervals curts i llargs
  const shortIndices = [];
  const longIndices = [];

  intervals.forEach((iT, idx) => {
    if (iT === 1) {
      shortIndices.push(idx);
    } else {
      longIndices.push(idx);
    }
  });

  // Barrejar cada pool de sons
  const shuffledShort = [...SHORT_SOUNDS].sort(() => Math.random() - 0.5);
  const shuffledLong = [...LONG_SOUNDS].sort(() => Math.random() - 0.5);

  // Assignar sons
  const result = new Array(intervals.length);

  shortIndices.forEach((idx, i) => {
    result[idx] = shuffledShort[i % shuffledShort.length];
  });

  longIndices.forEach((idx, i) => {
    result[idx] = shuffledLong[i % shuffledLong.length];
  });

  return result;
}

/**
 * Selecciona N colors únics aleatoris (sense repetició)
 */
function getUniqueRandomColors(count) {
  const shuffled = [...VIBRANT_COLORS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Invalida les assignacions de sons i colors (forçar regeneració al pròxim Play)
 */
function invalidateSoundAssignments() {
  currentSoundAssignments = null;
  currentColorAssignments = null;
}

function getCurrentSum() {
  return currentIntervals.reduce((sum, val) => sum + (val || 0), 0);
}

// ========== AUDIO ==========
const _baseInitAudio = createRhythmAudioInitializer({
  getSoundSelects: () => ({
    baseSoundSelect: document.querySelector('#baseSoundSelect'),
    accentSoundSelect: document.querySelector('#accentSoundSelect')
  })
});

async function initAudio() {
  if (!audio) {
    audio = await _baseInitAudio();
    if (typeof window !== 'undefined') {
      window.__labAudio = audio;
    }
  }
  return audio;
}

if (typeof window !== 'undefined') {
  window.__labInitAudio = initAudio;
}

/**
 * Reprodueix un so amb durada exacta i fadeout
 * @param {string} soundKey - Clau del so (click12-click17)
 * @param {number} duration - Durada en segons
 */
async function playSoundWithDuration(soundKey, duration) {
  await ensureToneLoaded();

  // Obtenir URL del so
  const soundUrl = new URL(`../../libs/sound/samples/${soundKey.replace('click', 'Click')}.wav`, import.meta.url).href;

  // Crear context d'audio si no existeix
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();

  try {
    // Carregar el buffer
    const response = await fetch(soundUrl);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Crear source i gain per fadeout
    const source = audioContext.createBufferSource();
    const gainNode = audioContext.createGain();

    source.buffer = audioBuffer;
    source.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Calcular temps
    const playDuration = Math.max(0.01, duration - FADEOUT_TIME);

    // Programar fadeout
    gainNode.gain.setValueAtTime(1, audioContext.currentTime);
    gainNode.gain.setValueAtTime(1, audioContext.currentTime + playDuration);
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + playDuration + FADEOUT_TIME);

    // Reproduir i aturar
    source.start(0);
    source.stop(audioContext.currentTime + duration);

  } catch (err) {
    console.warn(`Error reproduint ${soundKey}:`, err);
  }
}

/**
 * Reprodueix un click curt de metrònom usant l'AudioContext compartit
 * Usa el so seleccionat al dropdown "Pulso" del header
 */
async function playMetronomeClick() {
  if (!audio) return;
  try {
    await audio.preview(currentMetronomeSound);
  } catch (err) {
    console.warn('Error reproduint metrònom:', err);
  }
}

// ========== EDITOR iT ==========
function createItEditor() {
  itEditor = document.createElement('div');
  itEditor.className = 'it-editor';

  // Etiqueta "iT:"
  const label = document.createElement('span');
  label.className = 'it-editor__label';
  label.textContent = 'iT:';
  itEditor.appendChild(label);

  // Contenidor d'inputs
  const inputsContainer = document.createElement('div');
  inputsContainer.className = 'it-editor__inputs';

  // Crear 4 inputs
  for (let i = 0; i < MAX_ITS; i++) {
    const input = document.createElement('input');
    input.type = 'text';
    input.inputMode = 'numeric';
    input.pattern = '[1-8]';
    input.maxLength = 1;
    input.className = 'it-input';
    input.dataset.index = i;
    input.placeholder = '';

    // Event handlers
    input.addEventListener('input', (e) => handleItInput(e, i));
    input.addEventListener('keydown', (e) => handleItKeydown(e, i));
    input.addEventListener('focus', () => hideTooltip());

    inputsContainer.appendChild(input);
    itInputs.push(input);
  }

  itEditor.appendChild(inputsContainer);

  // Tooltip (posició fixa al body per evitar problemes de posicionament)
  tooltip = document.createElement('div');
  tooltip.className = 'it-tooltip';
  document.body.appendChild(tooltip);

  return itEditor;
}

function handleItInput(e, index) {
  const input = e.target;
  const value = input.value;

  // Validar valor 0 - no existeix moviment
  if (value === '0') {
    showTooltip(input, 'iT debe ser ≥ 1', false);
    input.value = '';
    return;
  }

  // Validar valor 9 o més gran - fora de rang
  if (value === '9' || (value && parseInt(value) > 8)) {
    showTooltip(input, 'iT máximo: 8', false);
    input.value = '';
    return;
  }

  // Només acceptar dígits 1-8
  if (value && !/^[1-8]$/.test(value)) {
    input.value = '';
    return;
  }

  const numValue = parseInt(value) || 0;

  // Calcular suma actual (sense aquest input)
  const otherSum = currentIntervals.reduce((sum, val, i) => {
    return i === index ? sum : sum + (val || 0);
  }, 0);

  const maxAllowed = MAX_LENGTH - otherSum;

  // Validar que no excedeixi el màxim
  if (numValue > maxAllowed) {
    input.value = '';
    showTooltip(input, `iT máximo: ${maxAllowed}`);
    return;
  }

  // Actualitzar estat
  currentIntervals[index] = numValue;

  // Invalidar sons al canviar l'editor
  invalidateSoundAssignments();

  // Comprovar si hem arribat a longitud completa
  const newSum = getCurrentSum();
  if (newSum === MAX_LENGTH) {
    input.blur();
    showTooltip(input, 'Longitud completa', true);
    updateTimeline();
    return;
  }

  // Auto-avançar al següent input
  if (numValue > 0 && index < MAX_ITS - 1) {
    const nextInput = itInputs[index + 1];
    if (nextInput && !nextInput.value) {
      setTimeout(() => nextInput.focus(), 50);
    }
  }

  updateTimeline();
}

function handleItKeydown(e, index) {
  // Backspace en input buit → tornar enrere
  if (e.key === 'Backspace' && !itInputs[index].value && index > 0) {
    e.preventDefault();
    itInputs[index - 1].focus();
    return;
  }

  // Arrow keys per navegació
  if (e.key === 'ArrowLeft' && index > 0) {
    e.preventDefault();
    itInputs[index - 1].focus();
  } else if (e.key === 'ArrowRight' && index < MAX_ITS - 1) {
    e.preventDefault();
    itInputs[index + 1].focus();
  }
}

function showTooltip(input, message, isSuccess = false) {
  if (!tooltip) return;

  tooltip.textContent = message;
  tooltip.className = `it-tooltip ${isSuccess ? 'success' : 'error'} visible`;

  // Posicionar sota l'input
  const rect = input.getBoundingClientRect();
  tooltip.style.left = `${rect.left + rect.width / 2}px`;
  tooltip.style.top = `${rect.bottom + 8}px`;
  tooltip.style.transform = 'translateX(-50%)';

  // Auto-ocultar després de 2s
  clearTimeout(tooltipTimeout);
  tooltipTimeout = setTimeout(hideTooltip, 2000);
}

function hideTooltip() {
  if (tooltip) {
    tooltip.classList.remove('visible');
  }
}

function getIntervalsFromEditor() {
  return currentIntervals.filter(v => v > 0);
}

function setIntervalsToEditor(intervals) {
  // Netejar
  currentIntervals = [];
  itInputs.forEach((input, i) => {
    input.value = intervals[i] || '';
    currentIntervals[i] = intervals[i] || 0;
  });

  updateTimeline();
}

function clearEditor() {
  currentIntervals = [];
  itInputs.forEach(input => {
    input.value = '';
  });
  updateTimeline();
}

function focusFirstInput() {
  if (itInputs[0]) {
    itInputs[0].focus();
  }
}

// ========== TIMELINE ==========
function drawTimeline() {
  if (!timeline) return;

  timeline.innerHTML = '';

  // Crear 9 pulsos (0-8)
  for (let i = 0; i <= 8; i++) {
    const pulse = document.createElement('div');
    pulse.className = 'pulse';
    if (i === 0 || i === 8) pulse.classList.add('endpoint');
    pulse.dataset.index = i;
    timeline.appendChild(pulse);

    // Barres en endpoints
    if (i === 0 || i === 8) {
      const bar = document.createElement('div');
      bar.className = 'bar endpoint';
      timeline.appendChild(bar);
    }
  }

  // Números de pulsos (0-8)
  for (let i = 0; i <= 8; i++) {
    const num = document.createElement('div');
    num.className = 'pulse-number';
    if (i === 0 || i === 8) num.classList.add('endpoint');
    num.dataset.index = i;
    num.textContent = i;
    timeline.appendChild(num);
  }

  // Layout lineal
  layoutTimeline();
}

function layoutTimeline() {
  const pulsesElems = timeline.querySelectorAll('.pulse');
  const bars = timeline.querySelectorAll('.bar');
  const numbers = timeline.querySelectorAll('.pulse-number');

  pulsesElems.forEach((p, i) => {
    const pct = (i / (TOTAL_PULSES - 1)) * 100;
    p.style.left = pct + '%';
    p.style.top = '50%';
    p.style.transform = 'translate(-50%, -50%)';
  });

  bars.forEach((bar, idx) => {
    const i = idx === 0 ? 0 : (TOTAL_PULSES - 1);
    const pct = (i / (TOTAL_PULSES - 1)) * 100;
    bar.style.left = pct + '%';
    bar.style.top = '30%';
    bar.style.height = '40%';
  });

  numbers.forEach(n => {
    const idx = parseInt(n.dataset.index);
    const pct = (idx / (TOTAL_PULSES - 1)) * 100;
    n.style.left = pct + '%';
    n.style.top = 'calc(50% + 30px)';
    n.style.transform = 'translate(-50%, 0)';
  });
}

function updateTimeline() {
  // Netejar barres anteriors
  const existingBars = timeline.querySelectorAll('.interval-bar-visual');
  existingBars.forEach(bar => bar.remove());

  // Dibuixar barres pels iT entrats
  const intervals = getIntervalsFromEditor();
  let currentPulse = 0;

  // Regenerar colors només si cal (editor canviat o primera vegada)
  if (!currentColorAssignments || currentColorAssignments.length !== intervals.length) {
    currentColorAssignments = intervals.map((_, idx) => VIBRANT_COLORS[idx % VIBRANT_COLORS.length]);
  }

  // Aplicar colors als inputs i dibuixar barres
  itInputs.forEach((input, idx) => {
    const hasValue = currentIntervals[idx] > 0;
    if (hasValue && idx < currentColorAssignments.length) {
      const color = currentColorAssignments[idx];
      input.style.color = color;
      input.style.borderColor = color;
    } else {
      // Reset estils si no té valor
      input.style.color = '';
      input.style.borderColor = '';
    }
  });

  intervals.forEach((iT, idx) => {
    if (iT > 0) {
      const color = currentColorAssignments[idx];
      createIntervalBar(currentPulse, iT, color, false);
      currentPulse += iT;
    }
  });
}

function createIntervalBar(startPulse, duration, color, animated = true) {
  const pulseSpacing = 100 / (TOTAL_PULSES - 1);
  const startPercent = startPulse * pulseSpacing;
  const widthPercent = duration * pulseSpacing;

  const bar = document.createElement('div');
  bar.className = 'interval-bar-visual';
  bar.style.left = `${startPercent}%`;
  bar.style.width = animated ? '0%' : `${widthPercent}%`;
  bar.style.background = color;

  // Número de duració
  const label = document.createElement('span');
  label.className = 'interval-bar-visual__label';
  label.textContent = duration;
  label.style.color = color;
  bar.appendChild(label);

  timeline.appendChild(bar);

  if (animated) {
    bar.offsetHeight; // Force reflow
    requestAnimationFrame(() => {
      bar.style.width = `${widthPercent}%`;
    });
  }

  return bar;
}

function clearTimelineBars() {
  const bars = timeline.querySelectorAll('.interval-bar-visual');
  bars.forEach(bar => bar.remove());
}

function highlightPulse(index, active = true) {
  const pulse = timeline.querySelector(`.pulse[data-index="${index}"]`);
  if (pulse) {
    pulse.classList.toggle('active', active);
  }
}

function clearPulseHighlights() {
  timeline.querySelectorAll('.pulse.active').forEach(p => p.classList.remove('active'));
}

// ========== REPRODUCCIÓ ==========
async function handlePlay() {
  // Si ja estem reproduint, STOP
  if (isPlaying) {
    isPlaying = false;
    updateControlsState();
    clearPulseHighlights();
    return;
  }

  const intervals = getIntervalsFromEditor();

  // Inicialitzar audio
  await initAudio();

  isPlaying = true;
  updateControlsState();

  // Generar BPM aleatori
  const bpm = getRandomBPM();
  const beatDuration = 60 / bpm; // segons per puls

  // Netejar barres
  clearTimelineBars();
  clearPulseHighlights();

  // MODE METRÒNOM: si editor buit, reproduir 8 pulsos sense barres
  if (intervals.length === 0) {
    console.log(`Mode metrònom: BPM ${bpm}`);

    for (let p = 0; p < MAX_LENGTH; p++) {
      if (!isPlaying) break;

      highlightPulse(p, true);
      playMetronomeClick();
      await sleep(beatDuration * 1000);
      highlightPulse(p, false);
    }

    isPlaying = false;
    updateControlsState();
    return;
  }

  // MODE INTERVALS
  console.log(`BPM: ${bpm}, intervals: ${intervals.join(', ')}`);

  // Usar sons persistents (només regenerar si no existeixen o han canviat els intervals)
  // NOTA: Els colors es gestionen a updateTimeline() per persistència visual
  if (!currentSoundAssignments || currentSoundAssignments.length !== intervals.length) {
    currentSoundAssignments = assignSoundsToIntervals(intervals);
  }
  const soundsForThisPlay = currentSoundAssignments;
  // Usar colors ja assignats per updateTimeline()
  const colorsForThisPlay = currentColorAssignments || intervals.map((_, idx) => VIBRANT_COLORS[idx % VIBRANT_COLORS.length]);

  let currentPulse = 0;

  for (let i = 0; i < intervals.length; i++) {
    if (!isPlaying) break; // Per si s'ha aturat

    const iT = intervals[i];
    const duration = iT * beatDuration;
    const color = colorsForThisPlay[i];
    const sound = soundsForThisPlay[i];

    // Crear barra animada
    createIntervalBar(currentPulse, iT, color, true);

    // Reproduir so de l'interval amb durada exacta
    playSoundWithDuration(sound, duration);

    // Loop per cada puls dins l'interval (metrònom + flash)
    for (let p = 0; p < iT; p++) {
      if (!isPlaying) break;

      const pulseIndex = currentPulse + p;

      // Flash del puls
      highlightPulse(pulseIndex, true);

      // Metrònom (so curt) a cada puls
      playMetronomeClick();

      // Esperar 1 beat
      await sleep(beatDuration * 1000);

      // Netejar flash
      highlightPulse(pulseIndex, false);
    }

    currentPulse += iT;
  }

  // Si la seqüència no arriba a 8 pulsos, completar amb metrònom
  if (currentPulse < MAX_LENGTH) {
    console.log(`Completant amb metrònom: pulsos ${currentPulse} a ${MAX_LENGTH - 1}`);

    for (let p = currentPulse; p < MAX_LENGTH; p++) {
      if (!isPlaying) break;

      highlightPulse(p, true);
      playMetronomeClick();
      await sleep(beatDuration * 1000);
      highlightPulse(p, false);
    }
  }

  // Final
  isPlaying = false;
  updateControlsState();
  console.log('Reproducció finalitzada');
}

function handleRandom() {
  if (isPlaying) return;

  // Invalidar sons al prémer random
  invalidateSoundAssignments();

  // Generar entre 1 i 4 iTs aleatoris
  const numIntervals = Math.floor(Math.random() * MAX_ITS) + 1;
  const intervals = [];
  let remaining = MAX_LENGTH;

  for (let i = 0; i < numIntervals && remaining > 0; i++) {
    // Últim interval: ocupar el que queda (o un valor aleatori)
    const isLast = i === numIntervals - 1;
    let value;

    if (isLast) {
      // 50% de probabilitat d'ocupar tot o un valor aleatori
      if (Math.random() > 0.5) {
        value = remaining;
      } else {
        value = Math.floor(Math.random() * remaining) + 1;
      }
    } else {
      // Deixar espai pels següents
      const maxForThis = remaining - (numIntervals - i - 1);
      value = Math.floor(Math.random() * Math.min(maxForThis, 8)) + 1;
    }

    intervals.push(value);
    remaining -= value;
  }

  setIntervalsToEditor(intervals);
}

function handleReset() {
  if (isPlaying) {
    // Aturar reproducció
    isPlaying = false;
    playbackTimeouts.forEach(t => clearTimeout(t));
    playbackTimeouts = [];
    clearPulseHighlights();
  }

  clearEditor();
  clearTimelineBars();
  focusFirstInput();
  updateControlsState();
}

function updateControlsState() {
  if (playBtn) {
    // NO bloquejar el botó - ha d'estar sempre actiu per poder aturar
    playBtn.classList.toggle('playing', isPlaying);

    // Toggle icones del template (play ↔ stop)
    const iconPlay = playBtn.querySelector('.icon-play');
    const iconStop = playBtn.querySelector('.icon-stop');
    if (iconPlay) iconPlay.style.display = isPlaying ? 'none' : 'block';
    if (iconStop) iconStop.style.display = isPlaying ? 'block' : 'none';
  }
  if (randomBtn) {
    randomBtn.disabled = isPlaying;
  }
}

// ========== SETUP ==========
function setupControls() {
  const controls = document.querySelector('.controls');
  if (!controls) return;

  playBtn = document.getElementById('playBtn');
  randomBtn = document.getElementById('randomBtn');
  resetBtn = document.getElementById('resetBtn');

  // Event listeners
  if (playBtn) {
    playBtn.addEventListener('click', handlePlay);
  }
  if (randomBtn) {
    randomBtn.addEventListener('click', handleRandom);
  }
  if (resetBtn) {
    resetBtn.addEventListener('click', handleReset);
  }
}

// ========== FACTORY RESET ==========
registerFactoryReset({ storage: preferenceStorage });

// ========== CLEANUP ==========
window.addEventListener('beforeunload', () => {
  if (audio) {
    audio.stop?.();
  }
  playbackTimeouts.forEach(t => clearTimeout(t));
});

// ========== INICIALITZACIÓ ==========
function initApp() {
  console.log('Inicialitzant App13: Intervalos Temporales');

  // Obtenir timeline
  timeline = document.getElementById('timeline');
  const timelineWrapper = document.getElementById('timelineWrapper');

  if (!timeline || !timelineWrapper) {
    console.error('Timeline no trobat');
    return;
  }

  // Crear editor iT i inserir-lo abans del timeline
  const editor = createItEditor();
  timelineWrapper.insertBefore(editor, timeline);

  // Dibuixar timeline
  drawTimeline();

  // Setup controls
  setupControls();

  // Cablear events de so compartits (selector Pulso → metrònom)
  bindSharedSoundEvents({
    getAudio: () => audio,
    mapping: {
      baseSound: 'setBase',
      accentSound: 'setAccent'
    }
  });

  // Escoltar canvis de so base per actualitzar el metrònom
  window.addEventListener('sharedui:sound', (event) => {
    const { type, value } = event.detail || {};
    if (type === 'baseSound' && value) {
      currentMetronomeSound = value;
    }
  });

  // Focus inicial
  setTimeout(focusFirstInput, 100);

  console.log('App13 inicialitzada');
}

// Executar quan el DOM estigui llest
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
