// App23: Transposición - Escala Mayor con selector de nota de salida y pentagrama
import { scaleSemis } from '../../libs/scales/index.js';
import { registerFactoryReset, createPreferenceStorage } from '../../libs/app-common/preferences.js';
import { createSoundline } from '../../libs/app-common/soundline.js';
import { createMelodicAudioInitializer } from '../../libs/app-common/audio-init.js';
import { drawPentagram, fontsReady } from '../../libs/notation/index.js';
import { setupPianoPreload } from '../../libs/sound/piano.js';

import { initIdleCaretFlash } from '../../libs/app-common/idle-caret-flash.js';
import { createOutputNotePill } from '../../libs/app-common/output-note-pill.js';

// Imports del mòdul soundlines compartit
import {
  createHighlightManager,
  drawConnectionLines,
  sleep,
  setPlayIcon,
  createPlayButtonHTML
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
// Incluir nota 12 (octava = grado 0 superior) para visualización completa
const MAJOR_SCALE_INTERVALS_WITH_OCTAVE = [...MAJOR_SCALE_INTERVALS, 12];
const MAJOR_EE = [2, 2, 1, 2, 2, 2, 1]; // Estructura escalar

// Referencias DOM
let timelineWrapper = null;
let chromaticContainer = null;
let scaleContainer = null;
let connectionSvg = null;
let playChromaticBtn = null;
let playScaleBtn = null;
let pentagramContainer = null;
let intervalBarsContainer = null;
const intervalBars = [];

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

const TOTAL_CHROMATIC = 13; // 0-12 (incluye octava)
const BPM = 75;
const BASE_MIDI = 60; // C4

// ============================================================================
// UTILIDADES
// ============================================================================

/**
 * Calcula les notes MIDI de l'escala Major transposada (amb octava)
 * Escala ascendent real (inclou grau 0 de l'octava superior)
 */
function getScaleMidis(root) {
  const baseMidi = BASE_MIDI + root;
  return MAJOR_SCALE_INTERVALS_WITH_OCTAVE.map(interval => baseMidi + interval);
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
// PASTILLA NOTA DE SALIDA — MARKUP
// El cableig (input/spinners/ArrowUp/Down) viu al mòdul `createOutputNotePill`
// importat a dalt. Aquí només generem el HTML perquè el wrapper `.timeline-wrapper`
// l'incrusti al lloc correcte.
// ============================================================================

function createOutputNoteMarkup() {
  return `
    <div class="bpm-inline visible param outputnote" id="outputNoteParam">
      <span class="abbr">Transposición</span>
      <div class="circle">
        <input id="inputOutputNote" type="number" min="0" max="11" value="${outputNote}" />
        <div class="spinner">
          <button id="outputNoteUp" class="spin up" type="button" aria-label="Incrementar transposición"></button>
          <button id="outputNoteDown" class="spin down" type="button" aria-label="Decrementar transposición"></button>
        </div>
      </div>
    </div>
  `;
}

// `outputNotePill` (assignat a `setupOutputNoteListeners()`) gestiona l'input
// + spinners + ArrowUp/Down via `createOutputNotePill` del mòdul comú.
let outputNotePill = null;

function setOutputNote(value) {
  // Programàticament canvia el valor a la pastilla; la pastilla mateixa
  // crida `onChange` (= `updateForOutputNote`) si el valor canvia.
  outputNotePill?.set(value);
}

function setupOutputNoteListeners() {
  outputNotePill = createOutputNotePill({
    initial: outputNote,
    range: { min: 0, max: 11, cyclic: true },
    onChange: (value) => {
      outputNote = value;
      updateForOutputNote();
    },
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
// INTERVAL BARS HORIZONTALS (estil App22 però en flex-row)
// ============================================================================

function createIntervalBarsHTML() {
  // Cada barra mostra el valor de l'interval (1 o 2). Els d'1 (semitons)
  // reben la classe step-1 que els pinta en taronja com a l'adjunt.
  const bars = MAJOR_EE.map((step, i) =>
    `<div class="interval-bar interval-bar--step-${step}" data-bar-index="${i}">
       <span class="interval-number">${step}</span>
     </div>`
  ).join('');
  return `
    <div class="interval-bars-step">
      <h3 class="interval-bars-label">Estructura Escalar (eE):</h3>
      <div class="interval-bars-row" id="intervalBarsRow">${bars}</div>
    </div>
  `;
}

function highlightIntervalBar(index, durationMs) {
  const bar = intervalBars[index];
  if (!bar) return;
  bar.classList.add('active');
  setTimeout(() => bar.classList.remove('active'), durationMs);
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
 * Formateador de etiquetas para escala: muestra el grado (0-6, y 0 para la octava)
 */
function createScaleLabelFormatter() {
  return (noteIndex) => {
    // Nota 12 es el grado 0 de la octava superior
    if (noteIndex === 12) return 0;
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
    visibleNotes: MAJOR_SCALE_INTERVALS_WITH_OCTAVE,
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
    scaleNotes: MAJOR_SCALE_INTERVALS_WITH_OCTAVE
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

  // Mida responsive: el pentagrama es dibuixa exactament a la mateixa
  // amplada que la fila d'`interval-bars` (eE) que té just a sobre, així
  // tots dos blocs s'alineen visualment i s'encongeixen junts en
  // pantalles petites. El `.pentagram-container` és `display: block`
  // sense width fixat → fallar a mesurar-lo donaria 0 al primer render
  // (el SVG encara no hi és); per això mesurem el `intervalBarsContainer`,
  // que sí té amplada estable definida pel seu propi contingut clamp().
  // L'amplada efectiva inclou els cercles/càpsules + 1px gaps, així que
  // cobreix el rang típic ~225-285px en escriptori i ~190-220px en
  // viewports estrets.
  const referenceWidth = intervalBarsContainer
    ? intervalBarsContainer.getBoundingClientRect().width
    : 0;
  const fallback = pentagramContainer.getBoundingClientRect().width
    || document.documentElement.clientWidth
    || window.innerWidth;
  // Reservem ~16px de padding intern (border-radius/padding del container).
  const available = Math.max(180, Math.floor((referenceWidth || fallback) - 0));
  let pentagramWidth = Math.min(400, available);
  let pentagramHeight = 180;
  if (pentagramWidth <= 220) pentagramHeight = 140;
  else if (pentagramWidth <= 280) pentagramHeight = 150;
  else if (pentagramWidth <= 340) pentagramHeight = 160;

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
 * Reproduce la escala Mayor (8 notas, incluyendo octava) desde la nota de salida
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

  // Notes MIDI de l'escala transposada (amb octava)
  const scaleMidis = getScaleMidis(outputNote);

  for (let i = 0; i < MAJOR_SCALE_INTERVALS_WITH_OCTAVE.length; i++) {
    if (stopScaleRequested) break;

    const midi = scaleMidis[i];
    const originalSemitone = MAJOR_SCALE_INTERVALS_WITH_OCTAVE[i]; // Posició a la soundline escala

    playNote(midi, noteDuration);

    // Highlight en ambdues soundlines, línia de connexió i pentagrama
    highlightManager.highlightNote(chromaticSoundline, originalSemitone, intervalMs * 0.9, 'chromatic');
    highlightManager.highlightNote(scaleSoundline, originalSemitone, intervalMs * 0.9, 'scale');
    highlightManager.highlightConnectionLine(originalSemitone, intervalMs * 0.9);
    highlightManager.highlightPentagramNote(pentagramContainer, i, intervalMs * 0.9);

    // Interval bar entre nota i-1 i nota i (mateix patró que App22):
    // grau 0 sense barra; grau N>0 il·lumina la barra N-1.
    if (i > 0 && i - 1 < MAJOR_EE.length) {
      const barIndex = i - 1;
      const isLastBar = barIndex === MAJOR_EE.length - 1;
      const duration = isLastBar ? intervalMs * 1.9 : intervalMs * 0.9;
      highlightIntervalBar(barIndex, duration);
    }

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

  // Layout de dues columnes (val per iframe i standalone):
  //   • Esquerra: àrea de soundlines (cromàtica + Mayor amb les línies de
  //     connexió i els play btns sota cada soundline).
  //   • Dreta: pastilla `Nota de salida`, label + interval-bars-step
  //     horitzontals, i el pentagrama — apilats verticalment.
  timelineWrapper.innerHTML = `
    <div class="app23-left">
      <div class="soundlines-area">
        <div class="soundlines-wrapper">
          <div class="soundline-column">
            <div class="soundline-header">
              <h3 class="soundline-title">Escala<br>Mayor</h3>
            </div>
            <div class="soundline-block">
              <div class="soundline-abbr-pill">Nº</div>
              <div id="scaleSoundline" class="soundline-container"></div>
            </div>
            ${createPlayButtonHTML('playScaleBtn', 'Reproducir escala Mayor')}
          </div>

          <div class="connection-area">
            <svg id="connectionLines" class="connection-lines"></svg>
          </div>

          <div class="soundline-column">
            <div class="soundline-header">
              <h3 class="soundline-title">Escala<br>Cromática</h3>
            </div>
            <div class="soundline-block">
              <div class="soundline-abbr-pill">N</div>
              <div id="chromaticSoundline" class="soundline-container"></div>
            </div>
            ${createPlayButtonHTML('playChromaticBtn', 'Reproducir escala cromática')}
          </div>
        </div>
      </div>
    </div>

    <div class="app23-right">
      ${createOutputNoteMarkup()}
      ${createIntervalBarsHTML()}
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
  intervalBarsContainer = document.getElementById('intervalBarsRow');

  // Cache de les barres d'interval per als highlights de playback
  intervalBars.length = 0;
  if (intervalBarsContainer) {
    intervalBarsContainer.querySelectorAll('.interval-bar').forEach(el => intervalBars.push(el));
  }

  // Crear highlight manager (ara que tenim connectionSvg)
  highlightManager = createHighlightManager({
    connectionSvg
  });

  // Crear soundlines
  initChromaticSoundline();
  initScaleSoundline();

  // Dibujar líneas de conexión
  redrawConnectionLines();

  // Renderitzar pentagrama inicial: esperem fontsReady (mètriques de
  // VexFlow correctes per a la clau de sol/plicas) + un rAF (flex layout
  // estabilitzat per a `pentagramContainer.getBoundingClientRect()`).
  // Sense `fontsReady`, VexFlow usa mètriques fallback i el SVG es
  // genera amb plicas que surten fora del viewBox, donant l'efecte
  // "pentagrama tallat" — bug que App24 ja resolia així.
  fontsReady.then(() => {
    requestAnimationFrame(() => {
      renderPentagram();
    });
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
  initIdleCaretFlash({ targets: [document.getElementById('outputNoteParam')] });
}

// Ejecutar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
