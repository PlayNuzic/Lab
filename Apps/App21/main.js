// App21: Escalas - Dos soundlines paralelas con líneas de conexión
import { scaleSemis } from '../../libs/scales/index.js';
import { registerFactoryReset, createPreferenceStorage } from '../../libs/app-common/preferences.js';
import { createSoundline } from '../../libs/app-common/soundline.js';
import { createMelodicAudioInitializer } from '../../libs/app-common/audio-init.js';

// ============================================================================
// ESTADO
// ============================================================================

let isPlayingChromatic = false;
let isPlayingScale = false;
let stopChromaticRequested = false;
let stopScaleRequested = false;
let audio = null; // MelodicTimelineAudio instance

// Escala Mayor fija (DIAT modo 0)
const MAJOR_SCALE_NOTES = scaleSemis('DIAT'); // [0, 2, 4, 5, 7, 9, 11]

// Referencias DOM
let timelineWrapper = null;
let chromaticContainer = null;
let scaleContainer = null;
let connectionSvg = null;
let playChromaticBtn = null;
let playScaleBtn = null;

// Soundline APIs
let chromaticSoundline = null;
let scaleSoundline = null;

// Highlights activos
const activeHighlights = new Map();

// Preference storage
const preferenceStorage = createPreferenceStorage('app21');

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const TOTAL_CHROMATIC = 12;
const BPM = 120;
const BASE_MIDI = 60; // C4

// ============================================================================
// UTILIDADES
// ============================================================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// AUDIO (usa MelodicTimelineAudio amb sample pool per baixa latència)
// ============================================================================

const initAudio = createMelodicAudioInitializer({
  defaultInstrument: 'piano'
});

/**
 * Reproduce una nota usando MelodicTimelineAudio
 */
function playNote(midiNumber, durationSec) {
  if (!audio) return;
  const Tone = window.Tone;
  if (Tone) {
    audio.playNote(midiNumber, durationSec, Tone.now());
  }
}

/**
 * Escolta canvis d'instrument des del dropdown del header
 */
function setupInstrumentListener() {
  window.addEventListener('sharedui:instrument', async (e) => {
    const { instrument } = e.detail;
    console.log('Instrument changed to:', instrument);

    if (audio && audio.setInstrument) {
      await audio.setInstrument(instrument);
    }
  });
}

// ============================================================================
// SOUNDLINE CROMÁTICA
// ============================================================================

/**
 * Formateador de etiquetas para cromática
 */
function createChromaticLabelFormatter() {
  return (noteIndex) => noteIndex;
}

function initChromaticSoundline() {
  chromaticContainer.innerHTML = '';

  chromaticSoundline = createSoundline({
    container: chromaticContainer,
    totalNotes: TOTAL_CHROMATIC,
    startMidi: BASE_MIDI,
    labelFormatter: createChromaticLabelFormatter()
  });

  // Colorar en selectcolor els números que coincideixen amb la Mayor
  applyHighlightColors(chromaticSoundline.element, MAJOR_SCALE_NOTES);
}

// ============================================================================
// SOUNDLINE DE ESCALA MAYOR
// ============================================================================

/**
 * Formateador de etiquetas para escala: muestra el grado (0-6)
 */
function createScaleLabelFormatter() {
  return (noteIndex) => {
    const degreeIndex = MAJOR_SCALE_NOTES.indexOf(noteIndex);
    return degreeIndex !== -1 ? degreeIndex : '';
  };
}

function initScaleSoundline() {
  scaleContainer.innerHTML = '';

  scaleSoundline = createSoundline({
    container: scaleContainer,
    totalNotes: TOTAL_CHROMATIC,
    startMidi: BASE_MIDI,
    visibleNotes: MAJOR_SCALE_NOTES,
    labelFormatter: createScaleLabelFormatter()
  });

  // Tots els números de l'escala en selectcolor
  applyHighlightColorsAll(scaleSoundline.element);
}

// ============================================================================
// COLORACIÓN DE NÚMEROS
// ============================================================================

/**
 * Aplica color destacat als números que coincideixen amb les notes donades
 */
function applyHighlightColors(soundlineElement, highlightedNotes) {
  const numbers = soundlineElement.querySelectorAll('.soundline-number');
  numbers.forEach(num => {
    const noteIndex = parseInt(num.dataset.note, 10);
    if (highlightedNotes.includes(noteIndex)) {
      num.classList.add('highlighted');
    }
  });
}

/**
 * Aplica color destacat a tots els números
 */
function applyHighlightColorsAll(soundlineElement) {
  const numbers = soundlineElement.querySelectorAll('.soundline-number');
  numbers.forEach(num => {
    num.classList.add('highlighted');
  });
}

// ============================================================================
// LÍNEAS DE CONEXIÓN
// ============================================================================

function drawConnectionLines() {
  connectionSvg.innerHTML = '';

  const svgNS = 'http://www.w3.org/2000/svg';

  // Llegir llargada des de la variable CSS --connection-length
  const styles = getComputedStyle(document.documentElement);
  const lengthRaw = styles.getPropertyValue('--connection-length').trim() || '80%';
  const lengthPct = parseFloat(lengthRaw) || 80;

  // Obtenir dimensions reals per alinear SVG amb soundline-container
  const containerRect = chromaticContainer.getBoundingClientRect();
  const svgRect = connectionSvg.getBoundingClientRect();

  // Offset vertical entre l'SVG i el soundline-container
  const offsetY = containerRect.top - svgRect.top;
  const containerHeight = containerRect.height;
  const svgHeight = svgRect.height;

  // Línies horitzontals per cada semitono de l'escala Mayor
  MAJOR_SCALE_NOTES.forEach((semitone, degree) => {
    // Posició relativa dins del soundline-container (0-100%)
    const notePct = chromaticSoundline.getNotePosition(semitone);
    // Convertir a posició absoluta dins del soundline-container
    const noteY = (notePct / 100) * containerHeight;
    // Afegir offset per convertir a coordenades de l'SVG
    const svgY = offsetY + noteY;
    // Convertir a percentatge de l'SVG
    const yPct = (svgY / svgHeight) * 100;

    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x1', '0%');
    line.setAttribute('y1', `${yPct}%`);
    line.setAttribute('x2', `${lengthPct}%`);
    line.setAttribute('y2', `${yPct}%`);
    line.setAttribute('class', 'connection-line');
    line.setAttribute('data-semitone', semitone);
    line.setAttribute('data-degree', degree);

    connectionSvg.appendChild(line);
  });
}

// ============================================================================
// HIGHLIGHTING
// ============================================================================

/**
 * Crea un highlight en la soundline usando la API del módulo
 */
function createHighlight(soundlineApi, noteIndex) {
  const yPct = soundlineApi.getNotePosition(noteIndex);

  const highlight = document.createElement('div');
  highlight.className = 'note-highlight';
  highlight.style.top = `${yPct}%`;
  highlight.dataset.note = noteIndex;

  soundlineApi.element.appendChild(highlight);
  return highlight;
}

/**
 * Destaca una nota en una soundline
 */
function highlightNote(soundlineApi, noteIndex, durationMs, key) {
  const existingKey = `${key}-${noteIndex}`;
  if (activeHighlights.has(existingKey)) {
    const prev = activeHighlights.get(existingKey);
    prev.element.remove();
    clearTimeout(prev.timeout);
    activeHighlights.delete(existingKey);
  }

  const highlight = createHighlight(soundlineApi, noteIndex);
  highlight.classList.add('active');

  const timeout = setTimeout(() => {
    highlight.classList.remove('active');
    setTimeout(() => highlight.remove(), 150);
    activeHighlights.delete(existingKey);
  }, durationMs);

  activeHighlights.set(existingKey, { element: highlight, timeout });
}

function highlightConnectionLine(semitone, durationMs) {
  const line = connectionSvg.querySelector(`[data-semitone="${semitone}"]`);
  if (!line) return;

  line.classList.add('active');

  setTimeout(() => {
    line.classList.remove('active');
  }, durationMs);
}

function clearAllHighlights() {
  activeHighlights.forEach(({ element, timeout }) => {
    clearTimeout(timeout);
    element.remove();
  });
  activeHighlights.clear();

  connectionSvg.querySelectorAll('.connection-line.active').forEach(line => {
    line.classList.remove('active');
  });
}

// ============================================================================
// REPRODUCCIÓN
// ============================================================================

function setPlayIcon(btn, playing) {
  const iconPlay = btn.querySelector('.icon-play');
  const iconStop = btn.querySelector('.icon-stop');
  if (iconPlay) iconPlay.style.display = playing ? 'none' : 'block';
  if (iconStop) iconStop.style.display = playing ? 'block' : 'none';
}

/**
 * Reproduce la escala cromática (12 notas)
 */
async function playChromatic() {
  if (isPlayingChromatic) {
    stopChromaticRequested = true;
    return;
  }

  isPlayingChromatic = true;
  stopChromaticRequested = false;
  playChromaticBtn.classList.add('playing');
  setPlayIcon(playChromaticBtn, true);

  if (!audio) {
    audio = await initAudio();
  }

  const intervalMs = (60 / BPM) * 1000;
  const noteDuration = intervalMs * 0.9 / 1000;

  for (let i = 0; i < TOTAL_CHROMATIC; i++) {
    if (stopChromaticRequested) break;

    const midi = BASE_MIDI + i;
    playNote(midi, noteDuration);

    // Highlight en cromática
    highlightNote(chromaticSoundline, i, intervalMs * 0.9, 'chromatic');

    // També highlight en escala i línia de connexió si la nota està a la Mayor
    if (MAJOR_SCALE_NOTES.includes(i)) {
      highlightNote(scaleSoundline, i, intervalMs * 0.9, 'scale');
      highlightConnectionLine(i, intervalMs * 0.9);
    }

    await sleep(intervalMs);
  }

  isPlayingChromatic = false;
  stopChromaticRequested = false;
  playChromaticBtn.classList.remove('playing');
  setPlayIcon(playChromaticBtn, false);
}

/**
 * Reproduce la escala Mayor (7 notas)
 */
async function playMajorScale() {
  if (isPlayingScale) {
    stopScaleRequested = true;
    return;
  }

  isPlayingScale = true;
  stopScaleRequested = false;
  playScaleBtn.classList.add('playing');
  setPlayIcon(playScaleBtn, true);

  if (!audio) {
    audio = await initAudio();
  }

  const intervalMs = (60 / BPM) * 1000;
  const noteDuration = intervalMs * 0.9 / 1000;

  for (let i = 0; i < MAJOR_SCALE_NOTES.length; i++) {
    if (stopScaleRequested) break;

    const semitone = MAJOR_SCALE_NOTES[i];
    const midi = BASE_MIDI + semitone;
    playNote(midi, noteDuration);

    // Highlight en ambdues soundlines i línia de connexió
    highlightNote(chromaticSoundline, semitone, intervalMs * 0.9, 'chromatic');
    highlightNote(scaleSoundline, semitone, intervalMs * 0.9, 'scale');
    highlightConnectionLine(semitone, intervalMs * 0.9);

    await sleep(intervalMs);
  }

  isPlayingScale = false;
  stopScaleRequested = false;
  playScaleBtn.classList.remove('playing');
  setPlayIcon(playScaleBtn, false);
}

// ============================================================================
// CREACIÓN DEL LAYOUT
// ============================================================================

function createPlayButton(id, ariaLabel) {
  return `
    <button id="${id}" class="play soundline-play" aria-label="${ariaLabel}">
      <svg class="icon-play" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" fill="currentColor">
        <path d="M73 39c-14.8-9-33 2.5-33 19v396c0 16.5 18.2 28 33 19l305-198c13.3-8.6 13.3-29.4 0-38L73 39z"/>
      </svg>
      <svg class="icon-stop" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor" style="display:none">
        <path d="M400 32H48C21.5 32 0 53.5 0 80v352c0 26.5 21.5 48 48 48h352c26.5 0 48-21.5 48-48V80c0-26.5-21.5-48-48-48z"/>
      </svg>
    </button>
  `;
}

function createAppLayout() {
  timelineWrapper = document.querySelector('.timeline-wrapper');
  if (!timelineWrapper) {
    console.error('No se encontró .timeline-wrapper');
    return false;
  }

  timelineWrapper.innerHTML = '';

  timelineWrapper.innerHTML = `
    <!-- Area de soundlines -->
    <div class="soundlines-area">
      <div class="soundlines-wrapper">
        <!-- Soundline cromática -->
        <div class="soundline-column">
          <div class="soundline-header">
            <h3 class="soundline-title">Escala Cromática</h3>
            <span class="soundline-subtitle">Nm</span>
          </div>
          <div id="chromaticSoundline" class="soundline-container"></div>
          ${createPlayButton('playChromaticBtn', 'Reproducir escala cromática')}
        </div>

        <!-- Líneas de conexión -->
        <div class="connection-area">
          <svg id="connectionLines" class="connection-lines"></svg>
        </div>

        <!-- Soundline de escala Mayor -->
        <div class="soundline-column">
          <div class="soundline-header">
            <h3 class="soundline-title">Escala Mayor</h3>
            <span class="soundline-subtitle">Nº</span>
          </div>
          <div id="scaleSoundline" class="soundline-container"></div>
          ${createPlayButton('playScaleBtn', 'Reproducir escala Mayor')}
        </div>
      </div>
    </div>
  `;

  return true;
}

// ============================================================================
// FACTORY RESET
// ============================================================================

registerFactoryReset({ storage: preferenceStorage });

// ============================================================================
// INICIALIZACIÓN
// ============================================================================

function initApp() {
  console.log('Inicializando App21: Escalas (simplificada)');

  if (!createAppLayout()) {
    console.error('Error creando layout');
    return;
  }

  // Referencias DOM
  chromaticContainer = document.getElementById('chromaticSoundline');
  scaleContainer = document.getElementById('scaleSoundline');
  connectionSvg = document.getElementById('connectionLines');
  playChromaticBtn = document.getElementById('playChromaticBtn');
  playScaleBtn = document.getElementById('playScaleBtn');

  // Crear soundlines
  initChromaticSoundline();
  initScaleSoundline();

  // Dibujar líneas de conexión
  drawConnectionLines();

  // Redibujar línies quan canvia la mida de la finestra
  window.addEventListener('resize', drawConnectionLines);

  // Event listeners
  playChromaticBtn.addEventListener('click', playChromatic);
  playScaleBtn.addEventListener('click', playMajorScale);

  // Escolta canvis d'instrument des del dropdown del header
  setupInstrumentListener();

  console.log('App21 inicializada correctamente');
}

// Ejecutar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
