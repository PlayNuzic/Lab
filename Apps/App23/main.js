// App23: Transposición - Escala Mayor con selector de nota de salida y pentagrama
import { scaleSemis } from '../../libs/scales/index.js';
import { registerFactoryReset, createPreferenceStorage } from '../../libs/app-common/preferences.js';
import { createSoundline } from '../../libs/app-common/soundline.js';
import { createMelodicAudioInitializer } from '../../libs/app-common/audio-init.js';
import { drawPentagram } from '../../libs/notation/index.js';
import { setupPianoPreload } from '../../libs/sound/piano.js';

// Imports del mòdul soundlines compartit
import {
  createHighlightManager,
  drawConnectionLines,
  sleep,
  setPlayIcon,
  createPlayButtonHTML,
  createEEDisplayHTML
} from '../../libs/soundlines/index.js';

// ============================================================================
// ESTADO
// ============================================================================

let isPlayingChromatic = false;
let isPlayingScale = false;
let stopChromaticRequested = false;
let stopScaleRequested = false;
let audio = null; // MelodicTimelineAudio instance

// Nota de salida (0-11, default 0 = C)
let outputNote = 0;

// Escala Mayor fija (DIAT modo 0)
const MAJOR_SCALE_INTERVALS = scaleSemis('DIAT'); // [0, 2, 4, 5, 7, 9, 11]
const MAJOR_EE = [2, 2, 1, 2, 2, 2, 1]; // Estructura escalar

// Referencias DOM
let timelineWrapper = null;
let chromaticContainer = null;
let scaleContainer = null;
let connectionSvg = null;
let playChromaticBtn = null;
let playScaleBtn = null;
let pentagramContainer = null;
let outputNoteButtons = [];

// Soundline APIs
let chromaticSoundline = null;
let scaleSoundline = null;

// Highlight manager
let highlightManager = null;

// Preference storage
const preferenceStorage = createPreferenceStorage('app23');

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const TOTAL_CHROMATIC = 12;
const BPM = 75;
const BASE_MIDI = 60; // C4

// ============================================================================
// UTILIDADES
// ============================================================================

/**
 * Calcula les notes MIDI de l'escala Major transposada
 * Escala ascendent real (pot superar una octava)
 */
function getScaleMidis(root) {
  const baseMidi = BASE_MIDI + root;
  return MAJOR_SCALE_INTERVALS.map(interval => baseMidi + interval);
}

/**
 * Calcula les notes de l'escala Major transposada (semitons 0-11)
 */
function getTransposedScaleNotes(root) {
  return MAJOR_SCALE_INTERVALS.map(interval => (root + interval) % 12);
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
// SELECTOR DE NOTA DE SALIDA
// ============================================================================

function createOutputNoteSelector() {
  return `
    <div class="output-note-selector">
      <h3 class="selector-title">Nota de Salida</h3>
      <div class="note-buttons-grid">
        ${[0,1,2,3,4,5,6,7,8,9,10,11].map(n => `
          <button class="note-btn${n === outputNote ? ' active' : ''}" data-note="${n}">${n}</button>
        `).join('')}
      </div>
    </div>
  `;
}

function setupOutputNoteListeners() {
  outputNoteButtons = document.querySelectorAll('.note-btn');
  outputNoteButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const newNote = parseInt(btn.dataset.note, 10);
      if (newNote !== outputNote) {
        outputNote = newNote;
        updateOutputNoteUI();
        updateForOutputNote();
      }
    });
  });
}

function updateOutputNoteUI() {
  outputNoteButtons.forEach(btn => {
    const note = parseInt(btn.dataset.note, 10);
    btn.classList.toggle('active', note === outputNote);
  });
}

function updateForOutputNote() {
  // Actualitzar soundline cromàtica (rotar números)
  updateChromaticSoundlineLabels();

  // Actualitzar highlighted numbers en la cromàtica
  updateChromaticHighlights();

  // Re-renderitzar pentagrama
  renderPentagram();
}

// ============================================================================
// SOUNDLINE CROMÁTICA
// ============================================================================

/**
 * Formateador de etiquetas para cromática (rotado según outputNote)
 * La soundline mostra notes de dalt (11) a baix (0)
 * El número de baix (noteIndex 0) ha de mostrar outputNote
 */
function createChromaticLabelFormatter() {
  return (noteIndex) => {
    // noteIndex 0 (baix) → outputNote, noteIndex 1 → outputNote+1, etc.
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

  // Colorar en selectcolor els números que coincideixen amb la Mayor transposada
  updateChromaticHighlights();
}

function updateChromaticSoundlineLabels() {
  const numbers = chromaticSoundline.element.querySelectorAll('.soundline-number');
  numbers.forEach(num => {
    const noteIndex = parseInt(num.dataset.note, 10);
    // Mateixa fórmula que createChromaticLabelFormatter
    const rotatedLabel = (noteIndex + outputNote) % 12;
    num.textContent = rotatedLabel;
  });
}

function updateChromaticHighlights() {
  const transposedNotes = getTransposedScaleNotes(outputNote);
  highlightManager.updateChromaticHighlights(chromaticSoundline, transposedNotes, outputNote);
}

// ============================================================================
// SOUNDLINE DE ESCALA MAYOR
// ============================================================================

/**
 * Formateador de etiquetas para escala: muestra el grado (0-6)
 */
function createScaleLabelFormatter() {
  return (noteIndex) => {
    const degreeIndex = MAJOR_SCALE_INTERVALS.indexOf(noteIndex);
    return degreeIndex !== -1 ? degreeIndex : '';
  };
}

function initScaleSoundline() {
  scaleContainer.innerHTML = '';

  scaleSoundline = createSoundline({
    container: scaleContainer,
    totalNotes: TOTAL_CHROMATIC,
    startMidi: BASE_MIDI,
    visibleNotes: MAJOR_SCALE_INTERVALS,
    labelFormatter: createScaleLabelFormatter()
  });

  // Tots els números de l'escala en selectcolor
  highlightManager.applyHighlightColorsAll(scaleSoundline.element);
}

// ============================================================================
// LÍNEAS DE CONEXIÓN
// ============================================================================

function redrawConnectionLines() {
  drawConnectionLines({
    svg: connectionSvg,
    chromaticContainer,
    chromaticSoundline,
    scaleNotes: MAJOR_SCALE_INTERVALS
  });
}

// ============================================================================
// PENTAGRAMA
// ============================================================================

function renderPentagram() {
  if (!pentagramContainer) return;

  pentagramContainer.innerHTML = '';

  // Calcular notes MIDI de l'escala transposada
  const scaleMidis = getScaleMidis(outputNote);

  // Width responsive segons tamany de pantalla
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

  // Renderitzar pentagrama amb armadura
  drawPentagram(pentagramContainer, scaleMidis, {
    scaleId: 'DIAT',
    root: outputNote,
    useKeySig: true,
    singleClef: 'treble',
    chord: false,
    width: pentagramWidth,
    height: pentagramHeight
  });
}

// ============================================================================
// REPRODUCCIÓN
// ============================================================================

/**
 * Reproduce la escala cromática (12 notas) desde la nota de salida
 */
async function playChromatic() {
  if (isPlayingChromatic) {
    stopChromaticRequested = true;
    return;
  }

  // No permetre si l'altre play està actiu
  if (isPlayingScale) return;

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

  // Notes transposades per saber quines il·luminar
  const transposedNotes = getTransposedScaleNotes(outputNote);

  for (let i = 0; i < TOTAL_CHROMATIC; i++) {
    if (stopChromaticRequested) break;

    // Nota MIDI que sona (escala cromàtica ascendent des de outputNote)
    const midi = BASE_MIDI + outputNote + i;
    playNote(midi, noteDuration);

    // Nota cromàtica per comprovar si està a la Major transposada
    const midiNote = (outputNote + i) % 12;

    // Highlight en cromática: posició física = i (0 és baix, 11 és dalt)
    highlightManager.highlightNote(chromaticSoundline, i, intervalMs * 0.9, 'chromatic');

    // També highlight en escala i línia de connexió si la nota està a la Mayor transposada
    if (transposedNotes.includes(midiNote)) {
      // Trobar el semitone original (posició a la soundline escala)
      const originalSemitone = MAJOR_SCALE_INTERVALS[transposedNotes.indexOf(midiNote)];
      highlightManager.highlightNote(scaleSoundline, originalSemitone, intervalMs * 0.9, 'scale');
      highlightManager.highlightConnectionLine(originalSemitone, intervalMs * 0.9);
    }

    await sleep(intervalMs);
  }

  isPlayingChromatic = false;
  stopChromaticRequested = false;
  playChromaticBtn.classList.remove('playing');
  setPlayIcon(playChromaticBtn, false);
}

/**
 * Reproduce la escala Mayor (7 notas) desde la nota de salida
 */
async function playMajorScale() {
  if (isPlayingScale) {
    stopScaleRequested = true;
    return;
  }

  // No permetre si l'altre play està actiu
  if (isPlayingChromatic) return;

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

  // Notes MIDI de l'escala transposada
  const scaleMidis = getScaleMidis(outputNote);

  for (let i = 0; i < MAJOR_SCALE_INTERVALS.length; i++) {
    if (stopScaleRequested) break;

    const midi = scaleMidis[i];
    const originalSemitone = MAJOR_SCALE_INTERVALS[i]; // Posició a la soundline escala

    playNote(midi, noteDuration);

    // Highlight en ambdues soundlines, línia de connexió i pentagrama
    highlightManager.highlightNote(chromaticSoundline, originalSemitone, intervalMs * 0.9, 'chromatic');
    highlightManager.highlightNote(scaleSoundline, originalSemitone, intervalMs * 0.9, 'scale');
    highlightManager.highlightConnectionLine(originalSemitone, intervalMs * 0.9);
    highlightManager.highlightPentagramNote(pentagramContainer, i, intervalMs * 0.9);

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

function createAppLayout() {
  timelineWrapper = document.querySelector('.timeline-wrapper');
  if (!timelineWrapper) {
    console.error('No se encontró .timeline-wrapper');
    return false;
  }

  timelineWrapper.innerHTML = '';

  timelineWrapper.innerHTML = `
    <!-- Selector de nota de salida (izquierda) -->
    ${createOutputNoteSelector()}

    <!-- Area de soundlines (centro) -->
    <div class="soundlines-area">
      <div class="soundlines-wrapper">
        <!-- Soundline cromática -->
        <div class="soundline-column">
          <div class="soundline-header">
            <h3 class="soundline-title">Escala Cromática</h3>
            <span class="soundline-subtitle">Nm</span>
          </div>
          <div id="chromaticSoundline" class="soundline-container"></div>
          ${createPlayButtonHTML('playChromaticBtn', 'Reproducir escala cromática')}
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
          ${createPlayButtonHTML('playScaleBtn', 'Reproducir escala Mayor')}
        </div>
      </div>
    </div>

    <!-- Pentagrama (derecha) -->
    <div class="pentagram-area">
      ${createEEDisplayHTML(MAJOR_EE)}
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
// INICIALIZACIÓN
// ============================================================================

function initApp() {
  console.log('Inicializando App23: Transposición');

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
  pentagramContainer = document.getElementById('pentagramContainer');

  // Crear highlight manager (ara que tenim connectionSvg)
  highlightManager = createHighlightManager({
    connectionSvg
  });

  // Crear soundlines
  initChromaticSoundline();
  initScaleSoundline();

  // Dibujar líneas de conexión
  redrawConnectionLines();

  // Renderitzar pentagrama inicial (amb delay per assegurar DOM llest)
  requestAnimationFrame(() => {
    renderPentagram();
  });

  // Setup selector de nota de salida
  setupOutputNoteListeners();

  // Redibujar línies quan canvia la mida de la finestra
  window.addEventListener('resize', () => {
    redrawConnectionLines();
    renderPentagram();
  });

  // Event listeners
  playChromaticBtn.addEventListener('click', playChromatic);
  playScaleBtn.addEventListener('click', playMajorScale);

  // Escolta canvis d'instrument des del dropdown del header
  setupInstrumentListener();

  // Precargar samples de piano en background (redueix latència en el primer play)
  setupPianoPreload({ delay: 300 });

  console.log('App23 inicializada correctamente');
}

// Ejecutar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
