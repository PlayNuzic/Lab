// App22: Estructura Escalar - Visualització de l'estructura d'intervals de l'escala Major
import { registerFactoryReset, createPreferenceStorage } from '../../libs/app-common/preferences.js';
import { createSoundline } from '../../libs/app-common/soundline.js';
import { createMelodicAudioInitializer } from '../../libs/app-common/audio-init.js';

// ============================================================================
// ESTAT
// ============================================================================

let isPlaying = false;
let stopRequested = false;
let audio = null; // MelodicTimelineAudio instance

// Escala Major - semitons des de la tònica (inclou octava)
const MAJOR_SCALE_SEMITONES = [0, 2, 4, 5, 7, 9, 11, 12];

// Estructura escalar - intervals entre notes consecutives
const SCALE_STRUCTURE = [2, 2, 1, 2, 2, 2, 1];

// Referències DOM
let soundlineContainer = null;
let intervalContainer = null;
let playBtn = null;

// Soundline API
let scaleSoundline = null;

// Interval bars
const intervalBars = [];

// Highlights actius
const activeHighlights = new Map();

// Preference storage
const preferenceStorage = createPreferenceStorage('app22');

// ============================================================================
// CONFIGURACIÓ
// ============================================================================

const TOTAL_DEGREES = 8; // 8 graus (0-7, on 7 és l'octava)
const BPM = 120;
const BASE_MIDI = 60; // C4

// ============================================================================
// UTILITATS
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
 * Reprodueix una nota usant MelodicTimelineAudio
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
// SOUNDLINE
// ============================================================================

/**
 * Formateador d'etiquetes: mostra el grau (0-7)
 */
function createLabelFormatter() {
  return (noteIndex) => noteIndex;
}

function initSoundline() {
  soundlineContainer.innerHTML = '';

  scaleSoundline = createSoundline({
    container: soundlineContainer,
    totalNotes: TOTAL_DEGREES,
    startMidi: BASE_MIDI,
    labelFormatter: createLabelFormatter()
  });
}

// ============================================================================
// INTERVAL BARS
// ============================================================================

/**
 * Crea les barres d'interval entre notes consecutives
 */
function createIntervalBars() {
  intervalContainer.innerHTML = '';
  intervalBars.length = 0;

  SCALE_STRUCTURE.forEach((interval, index) => {
    const topY = scaleSoundline.getNotePosition(index);
    const bottomY = scaleSoundline.getNotePosition(index + 1);
    const centerY = (topY + bottomY) / 2;
    const height = Math.abs(bottomY - topY);

    const bar = document.createElement('div');
    bar.className = 'interval-bar';
    bar.dataset.intervalIndex = index;
    bar.style.top = `${centerY}%`;
    bar.style.height = `${height}%`;

    const numberSpan = document.createElement('span');
    numberSpan.className = 'interval-number';
    numberSpan.textContent = interval;
    bar.appendChild(numberSpan);

    intervalContainer.appendChild(bar);
    intervalBars.push(bar);
  });
}

/**
 * Il·lumina una barra d'interval
 */
function highlightIntervalBar(index, durationMs) {
  const bar = intervalBars[index];
  if (!bar) return;

  bar.classList.add('active');
  setTimeout(() => bar.classList.remove('active'), durationMs);
}

// ============================================================================
// HIGHLIGHTING
// ============================================================================

/**
 * Crea un highlight a la soundline usant l'API del mòdul
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
 * Destaca una nota a la soundline
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

function clearAllHighlights() {
  activeHighlights.forEach(({ element, timeout }) => {
    clearTimeout(timeout);
    element.remove();
  });
  activeHighlights.clear();

  intervalBars.forEach(bar => bar.classList.remove('active'));
}

// ============================================================================
// REPRODUCCIÓ
// ============================================================================

function setPlayIcon(btn, playing) {
  const iconPlay = btn.querySelector('.icon-play');
  const iconStop = btn.querySelector('.icon-stop');
  if (iconPlay) iconPlay.style.display = playing ? 'none' : 'block';
  if (iconStop) iconStop.style.display = playing ? 'block' : 'none';
}

/**
 * Reprodueix l'escala Major amb animació d'intervals
 */
async function playScale() {
  if (isPlaying) {
    stopRequested = true;
    return;
  }

  isPlaying = true;
  stopRequested = false;
  playBtn.classList.add('playing');
  setPlayIcon(playBtn, true);

  if (!audio) {
    audio = await initAudio();
  }

  const intervalMs = (60 / BPM) * 1000;
  const noteDuration = intervalMs * 0.9 / 1000;

  for (let degree = 0; degree < MAJOR_SCALE_SEMITONES.length; degree++) {
    if (stopRequested) break;

    const semitone = MAJOR_SCALE_SEMITONES[degree];
    const midi = BASE_MIDI + semitone;
    playNote(midi, noteDuration);

    // Highlight nota (grau)
    highlightNote(scaleSoundline, degree, intervalMs * 0.9, 'scale');

    // Highlight interval bar (si no és l'última nota)
    if (degree < SCALE_STRUCTURE.length) {
      highlightIntervalBar(degree, intervalMs * 0.9);
    }

    await sleep(intervalMs);
  }

  isPlaying = false;
  stopRequested = false;
  playBtn.classList.remove('playing');
  setPlayIcon(playBtn, false);
}

// ============================================================================
// CREACIÓ DEL LAYOUT
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
  const timelineWrapper = document.querySelector('.timeline-wrapper');
  if (!timelineWrapper) {
    console.error('No es va trobar .timeline-wrapper');
    return false;
  }

  timelineWrapper.innerHTML = '';

  timelineWrapper.innerHTML = `
    <!-- Area de soundlines -->
    <div class="soundlines-area">
      <div class="soundline-column">
        <div class="soundline-header">
          <h3 class="soundline-title">Escala Mayor</h3>
          <span class="soundline-subtitle">Nº</span>
        </div>
        <div class="soundline-with-intervals">
          <div id="scaleSoundline" class="soundline-container"></div>
          <div id="intervalContainer" class="interval-container"></div>
        </div>
        ${createPlayButton('playBtn', 'Reproducir escala')}
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
// INICIALITZACIÓ
// ============================================================================

function initApp() {
  console.log('Inicialitzant App22: Estructura Escalar');

  if (!createAppLayout()) {
    console.error('Error creant layout');
    return;
  }

  // Referències DOM
  soundlineContainer = document.getElementById('scaleSoundline');
  intervalContainer = document.getElementById('intervalContainer');
  playBtn = document.getElementById('playBtn');

  // Crear soundline
  initSoundline();

  // Crear barres d'interval
  createIntervalBars();

  // Event listeners
  playBtn.addEventListener('click', playScale);

  // Escolta canvis d'instrument des del dropdown del header
  setupInstrumentListener();

  console.log('App22 inicialitzada correctament');
}

// Executar quan el DOM estigui llest
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
