// App24: Escalas y Transposición - Selector d'escales amb soundlines i pentagrama
import { scaleSemis, motherScalesData } from '../../libs/scales/index.js';
import { registerFactoryReset, createPreferenceStorage } from '../../libs/app-common/preferences.js';
import { createSoundline } from '../../libs/app-common/soundline.js';
import { createMelodicAudioInitializer } from '../../libs/app-common/audio-init.js';
import { drawPentagram } from '../../libs/notation/index.js';
import { setupPianoPreload } from '../../libs/sound/piano.js';
import { createScaleSelector, getRotatedScaleNotes } from '../../libs/scale-selector/index.js';

// ============================================================================
// ESTADO
// ============================================================================

let isPlayingChromatic = false;
let isPlayingScale = false;
let stopChromaticRequested = false;
let stopScaleRequested = false;
let audio = null; // MelodicTimelineAudio instance

// Escala actual i transposició
let currentScaleId = 'DIAT';
let currentRotation = 0;
let outputNote = 0; // Transposició (0-11)
let currentScaleNotes = [0, 2, 4, 5, 7, 9, 11]; // Semitons de l'escala actual
let currentEE = [2, 2, 1, 2, 2, 2, 1]; // Estructura escalar actual

// Escales disponibles per App24
// rootOffset: compensació per obtenir l'armadura correcta en rotacions
// Per rotacions, l'armadura de rot 0 a root X és la mateixa que rot N a root X+offset
const APP24_SCALES = [
  { id: 'DIAT', rotation: 0, value: 'DIAT-0', name: 'Major', rootOffset: 0 },
  { id: 'DIAT', rotation: 5, value: 'DIAT-5', name: 'Menor Natural', rootOffset: 3 },  // Eolia: +3 semitons
  { id: 'ACUS', rotation: 4, value: 'ACUS-4', name: 'Menor Melódica', rootOffset: 5 }, // Menor Mel: +5 semitons
  { id: 'ARMme', rotation: 0, value: 'ARMme-0', name: 'Menor Harmónica', rootOffset: 0 },
  { id: 'ARMma', rotation: 0, value: 'ARMma-0', name: 'Mayor Harmónica', rootOffset: 0 },
  { id: 'PENT', rotation: 0, value: 'PENT-0', name: 'Pentatónica', rootOffset: 0 },
  { id: 'TON', rotation: 0, value: 'TON-0', name: 'Tonos', rootOffset: 0 },
  { id: 'OCT', rotation: 0, value: 'OCT-0', name: 'Octatónica', rootOffset: 0 },
  { id: 'HEX', rotation: 0, value: 'HEX-0', name: 'Hexatónica', rootOffset: 0 }
];

/**
 * Calcula el root compensat per a l'armadura
 * Les rotacions requereixen ajustar el root per obtenir l'armadura correcta
 */
function getKeySignatureRoot() {
  const scaleConfig = APP24_SCALES.find(
    s => s.id === currentScaleId && s.rotation === currentRotation
  );
  const offset = scaleConfig?.rootOffset || 0;
  return (outputNote + offset) % 12;
}

// Referències DOM
let timelineWrapper = null;
let chromaticContainer = null;
let scaleContainer = null;
let connectionSvg = null;
let playChromaticBtn = null;
let playScaleBtn = null;
let pentagramContainer = null;
let selectorContainer = null;
let eeDisplayContainer = null;

// Soundline APIs
let chromaticSoundline = null;
let scaleSoundline = null;

// Scale selector
let scaleSelector = null;
let scaleTitleElement = null;

// Highlights actius
const activeHighlights = new Map();

// Preference storage
const preferenceStorage = createPreferenceStorage('app24');

// ============================================================================
// CONFIGURACIÓ
// ============================================================================

const TOTAL_CHROMATIC = 12;
const BPM = 75;
const BASE_MIDI = 60; // C4

// ============================================================================
// UTILITATS
// ============================================================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calcula les notes MIDI de l'escala transposada
 */
function getScaleMidis() {
  const baseMidi = BASE_MIDI + outputNote;
  return currentScaleNotes.map(interval => baseMidi + interval);
}

/**
 * Calcula les notes de l'escala transposada (semitons 0-11)
 */
function getTransposedScaleNotes() {
  return currentScaleNotes.map(interval => (outputNote + interval) % 12);
}

/**
 * Obté l'estructura escalar (eE) de l'escala actual rotada
 */
function getRotatedEE(scaleId, rotation) {
  const baseEE = motherScalesData[scaleId]?.ee || [2, 2, 1, 2, 2, 2, 1];
  if (rotation === 0) return [...baseEE];
  // Rotar l'array
  const rotated = [...baseEE.slice(rotation), ...baseEE.slice(0, rotation)];
  return rotated;
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
// SCALE SELECTOR
// ============================================================================

function initScaleSelector() {
  scaleSelector = createScaleSelector({
    container: selectorContainer,
    appId: 'app24',
    scales: APP24_SCALES,
    initialScale: 'DIAT-0',
    enableTranspose: true,
    transposeHiddenByDefault: false,
    title: 'Escala',
    onScaleChange: ({ scaleNotes, scaleId, rotation }) => {
      currentScaleId = scaleId;
      currentRotation = rotation;
      currentScaleNotes = scaleNotes;
      currentEE = getRotatedEE(scaleId, rotation);
      updateForScaleChange();
    },
    onTransposeChange: (transpose) => {
      outputNote = transpose;
      updateForTransposeChange();
    }
  });

  scaleSelector.render();

  // Inicialitzar estat amb l'escala per defecte
  currentScaleNotes = getRotatedScaleNotes('DIAT', 0);
  currentEE = getRotatedEE('DIAT', 0);
}

function updateScaleTitle() {
  if (!scaleTitleElement) return;

  // Trobar el nom de l'escala actual
  const currentScaleConfig = APP24_SCALES.find(
    s => s.id === currentScaleId && s.rotation === currentRotation
  );
  const scaleName = currentScaleConfig ? currentScaleConfig.name : 'Escala';
  scaleTitleElement.textContent = scaleName;
}

function updateForScaleChange() {
  // Actualitzar títol de la soundline d'escala
  updateScaleTitle();

  // Re-crear soundline d'escala amb les noves notes visibles
  initScaleSoundline();

  // Actualitzar highlights a cromàtica
  updateChromaticHighlights();

  // Re-dibuixar línies de connexió
  drawConnectionLines();

  // Actualitzar ee-display
  updateEEDisplay();

  // Re-renderitzar pentagrama
  renderPentagram();
}

function updateForTransposeChange() {
  // Actualitzar etiquetes de cromàtica (rotades)
  updateChromaticSoundlineLabels();

  // Actualitzar highlights a cromàtica
  updateChromaticHighlights();

  // Re-renderitzar pentagrama
  renderPentagram();
}

// ============================================================================
// SOUNDLINE CROMÀTICA
// ============================================================================

/**
 * Formateador d'etiquetes per cromàtica (rotat segons outputNote)
 */
function createChromaticLabelFormatter() {
  return (noteIndex) => {
    return (noteIndex + outputNote) % 12;
  };
}

function initChromaticSoundline() {
  chromaticContainer.innerHTML = '';

  chromaticSoundline = createSoundline({
    container: chromaticContainer,
    totalNotes: TOTAL_CHROMATIC,
    startMidi: BASE_MIDI,
    labelFormatter: createChromaticLabelFormatter()
  });

  updateChromaticHighlights();
}

function updateChromaticSoundlineLabels() {
  const numbers = chromaticSoundline.element.querySelectorAll('.soundline-number');
  numbers.forEach(num => {
    const noteIndex = parseInt(num.dataset.note, 10);
    const rotatedLabel = (noteIndex + outputNote) % 12;
    num.textContent = rotatedLabel;
  });
}

function updateChromaticHighlights() {
  const transposedNotes = getTransposedScaleNotes();
  const numbers = chromaticSoundline.element.querySelectorAll('.soundline-number');

  numbers.forEach(num => {
    const noteIndex = parseInt(num.dataset.note, 10);
    // La nota mostrada és (noteIndex + outputNote) % 12
    const displayedNote = (noteIndex + outputNote) % 12;
    if (transposedNotes.includes(displayedNote)) {
      num.classList.add('highlighted');
    } else {
      num.classList.remove('highlighted');
    }
  });
}

// ============================================================================
// SOUNDLINE D'ESCALA
// ============================================================================

/**
 * Formateador d'etiquetes per escala: mostra el grau (0 a N-1)
 */
function createScaleLabelFormatter() {
  return (noteIndex) => {
    const degreeIndex = currentScaleNotes.indexOf(noteIndex);
    return degreeIndex !== -1 ? degreeIndex : '';
  };
}

function initScaleSoundline() {
  scaleContainer.innerHTML = '';

  scaleSoundline = createSoundline({
    container: scaleContainer,
    totalNotes: TOTAL_CHROMATIC,
    startMidi: BASE_MIDI,
    visibleNotes: currentScaleNotes,
    labelFormatter: createScaleLabelFormatter()
  });

  // Tots els números de l'escala en selectcolor
  applyHighlightColorsAll(scaleSoundline.element);
}

// ============================================================================
// COLORACIÓ DE NÚMEROS
// ============================================================================

function applyHighlightColorsAll(soundlineElement) {
  const numbers = soundlineElement.querySelectorAll('.soundline-number');
  numbers.forEach(num => {
    num.classList.add('highlighted');
  });
}

// ============================================================================
// LÍNIES DE CONNEXIÓ
// ============================================================================

function drawConnectionLines() {
  connectionSvg.innerHTML = '';

  const svgNS = 'http://www.w3.org/2000/svg';

  const styles = getComputedStyle(document.documentElement);
  const lengthRaw = styles.getPropertyValue('--connection-length').trim() || '80%';
  const lengthPct = parseFloat(lengthRaw) || 80;

  const containerRect = chromaticContainer.getBoundingClientRect();
  const svgRect = connectionSvg.getBoundingClientRect();

  const offsetY = containerRect.top - svgRect.top;
  const containerHeight = containerRect.height;
  const svgHeight = svgRect.height;

  if (svgHeight === 0 || containerHeight === 0) {
    console.warn('Connection SVG or container has zero height, skipping line drawing');
    return;
  }

  // Línies per cada semitono de l'escala actual
  currentScaleNotes.forEach((semitone, degree) => {
    const notePct = chromaticSoundline.getNotePosition(semitone);
    const noteY = (notePct / 100) * containerHeight;
    const svgY = offsetY + noteY;
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
// EE DISPLAY
// ============================================================================

function updateEEDisplay() {
  if (!eeDisplayContainer) return;

  const eeNumbers = currentEE.map(n => `<span class="ee-number">${n}</span>`).join(' ');
  eeDisplayContainer.innerHTML = `
    <span class="ee-label">eE:</span>
    <span class="ee-function">iS(</span>${eeNumbers}<span class="ee-function">)</span>
  `;
}

// ============================================================================
// PENTAGRAMA
// ============================================================================

function renderPentagram() {
  if (!pentagramContainer) return;

  pentagramContainer.innerHTML = '';

  const scaleMidis = getScaleMidis();

  const screenWidth = window.innerWidth;
  let pentagramWidth = 400;
  let pentagramHeight = 140;
  if (screenWidth <= 480) {
    pentagramWidth = 200;
    pentagramHeight = 100;
  } else if (screenWidth <= 600) {
    pentagramWidth = 250;
    pentagramHeight = 110;
  } else if (screenWidth <= 768) {
    pentagramWidth = 300;
    pentagramHeight = 120;
  }

  // Usar root compensat per a l'armadura (rotacions requereixen ajust)
  const keySignatureRoot = getKeySignatureRoot();

  drawPentagram(pentagramContainer, scaleMidis, {
    scaleId: currentScaleId,
    root: keySignatureRoot,
    useKeySig: true,
    singleClef: 'treble',
    chord: false,
    width: pentagramWidth,
    height: pentagramHeight
  });
}

// ============================================================================
// HIGHLIGHTING
// ============================================================================

function createHighlight(soundlineApi, noteIndex) {
  const yPct = soundlineApi.getNotePosition(noteIndex);

  const highlight = document.createElement('div');
  highlight.className = 'note-highlight';
  highlight.style.top = `${yPct}%`;
  highlight.dataset.note = noteIndex;

  soundlineApi.element.appendChild(highlight);
  return highlight;
}

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
// REPRODUCCIÓ
// ============================================================================

function setPlayIcon(btn, playing) {
  const iconPlay = btn.querySelector('.icon-play');
  const iconStop = btn.querySelector('.icon-stop');
  if (iconPlay) iconPlay.style.display = playing ? 'none' : 'block';
  if (iconStop) iconStop.style.display = playing ? 'block' : 'none';
}

/**
 * Reprodueix l'escala cromàtica (12 notes) des de la nota de sortida
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
    await sleep(250);
  }

  const intervalMs = (60 / BPM) * 1000;
  const noteDuration = intervalMs * 0.9 / 1000;

  const transposedNotes = getTransposedScaleNotes();

  for (let i = 0; i < TOTAL_CHROMATIC; i++) {
    if (stopChromaticRequested) break;

    const midi = BASE_MIDI + outputNote + i;
    playNote(midi, noteDuration);

    const midiNote = (outputNote + i) % 12;

    highlightNote(chromaticSoundline, i, intervalMs * 0.9, 'chromatic');

    if (transposedNotes.includes(midiNote)) {
      const scaleIndex = transposedNotes.indexOf(midiNote);
      const originalSemitone = currentScaleNotes[scaleIndex];
      highlightNote(scaleSoundline, originalSemitone, intervalMs * 0.9, 'scale');
      highlightConnectionLine(originalSemitone, intervalMs * 0.9);
    }

    await sleep(intervalMs);
  }

  isPlayingChromatic = false;
  stopChromaticRequested = false;
  playChromaticBtn.classList.remove('playing');
  setPlayIcon(playChromaticBtn, false);
}

/**
 * Reprodueix l'escala seleccionada
 */
async function playScale() {
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
    await sleep(250);
  }

  const intervalMs = (60 / BPM) * 1000;
  const noteDuration = intervalMs * 0.9 / 1000;

  const scaleMidis = getScaleMidis();

  for (let i = 0; i < currentScaleNotes.length; i++) {
    if (stopScaleRequested) break;

    const midi = scaleMidis[i];
    const originalSemitone = currentScaleNotes[i];

    playNote(midi, noteDuration);

    highlightNote(chromaticSoundline, originalSemitone, intervalMs * 0.9, 'chromatic');
    highlightNote(scaleSoundline, originalSemitone, intervalMs * 0.9, 'scale');
    highlightConnectionLine(originalSemitone, intervalMs * 0.9);

    await sleep(intervalMs);
  }

  isPlayingScale = false;
  stopScaleRequested = false;
  playScaleBtn.classList.remove('playing');
  setPlayIcon(playScaleBtn, false);
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
  timelineWrapper = document.querySelector('.timeline-wrapper');
  if (!timelineWrapper) {
    console.error('No se encontró .timeline-wrapper');
    return false;
  }

  timelineWrapper.innerHTML = '';

  timelineWrapper.innerHTML = `
    <!-- Selector d'escala (esquerra) -->
    <div id="scaleSelectorContainer" class="scale-selector-area"></div>

    <!-- Area de soundlines (centre) -->
    <div class="soundlines-area">
      <div class="soundlines-wrapper">
        <!-- Soundline cromàtica -->
        <div class="soundline-column">
          <div class="soundline-header">
            <h3 class="soundline-title">Escala Cromática</h3>
            <span class="soundline-subtitle">Nm</span>
          </div>
          <div id="chromaticSoundline" class="soundline-container"></div>
          ${createPlayButton('playChromaticBtn', 'Reproducir escala cromática')}
        </div>

        <!-- Línies de connexió -->
        <div class="connection-area">
          <svg id="connectionLines" class="connection-lines"></svg>
        </div>

        <!-- Soundline d'escala -->
        <div class="soundline-column">
          <div class="soundline-header">
            <h3 id="scaleSoundlineTitle" class="soundline-title">Major</h3>
            <span class="soundline-subtitle">Nº</span>
          </div>
          <div id="scaleSoundline" class="soundline-container"></div>
          ${createPlayButton('playScaleBtn', 'Reproducir escala')}
        </div>
      </div>
    </div>

    <!-- Pentagrama (dreta) -->
    <div class="pentagram-area">
      <div id="eeDisplay" class="ee-display"></div>
      <div id="pentagramContainer" class="pentagram-container"></div>
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
  console.log('Inicializando App24: Escalas y Transposición');

  if (!createAppLayout()) {
    console.error('Error creando layout');
    return;
  }

  // Referències DOM
  selectorContainer = document.getElementById('scaleSelectorContainer');
  chromaticContainer = document.getElementById('chromaticSoundline');
  scaleContainer = document.getElementById('scaleSoundline');
  connectionSvg = document.getElementById('connectionLines');
  playChromaticBtn = document.getElementById('playChromaticBtn');
  playScaleBtn = document.getElementById('playScaleBtn');
  pentagramContainer = document.getElementById('pentagramContainer');
  eeDisplayContainer = document.getElementById('eeDisplay');
  scaleTitleElement = document.getElementById('scaleSoundlineTitle');

  // Inicialitzar scale selector
  initScaleSelector();

  // Crear soundlines
  initChromaticSoundline();
  initScaleSoundline();

  // Dibuixar línies de connexió
  drawConnectionLines();

  // Actualitzar ee-display
  updateEEDisplay();

  // Renderitzar pentagrama inicial (amb delay per assegurar DOM llest)
  requestAnimationFrame(() => {
    renderPentagram();
  });

  // Redibuixar línies quan canvia la mida de la finestra
  window.addEventListener('resize', () => {
    drawConnectionLines();
    renderPentagram();
  });

  // Event listeners
  playChromaticBtn.addEventListener('click', playChromatic);
  playScaleBtn.addEventListener('click', playScale);

  // Escolta canvis d'instrument des del dropdown del header
  setupInstrumentListener();

  // Precargar samples de piano en background
  setupPianoPreload({ delay: 300 });

  console.log('App24 inicializada correctamente');
}

// Executar quan el DOM estigui llest
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
