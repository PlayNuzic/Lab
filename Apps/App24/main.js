// App24: Selector de Escalas - Selector d'escales amb soundlines i pentagrama
import { motherScalesData } from '../../libs/scales/index.js';
import { registerFactoryReset, createPreferenceStorage } from '../../libs/app-common/preferences.js';
import { createSoundline } from '../../libs/app-common/soundline.js';
import { createMelodicAudioInitializer } from '../../libs/app-common/audio-init.js';
import { drawPentagram, fontsReady } from '../../libs/notation/index.js';
import { setupPianoPreload } from '../../libs/sound/piano.js';
import { createScaleSelector, getRotatedScaleNotes } from '../../libs/scale-selector/index.js';

import { initIdleCaretFlash } from '../../libs/app-common/idle-caret-flash.js';

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

// Escala actual i transposició
let currentScaleId = 'DIAT';
let currentRotation = 0;
let outputNote = 0; // Transposició (0-11)
let currentScaleNotes = [0, 2, 4, 5, 7, 9, 11]; // Semitons de l'escala actual
let currentEE = [2, 2, 1, 2, 2, 2, 1]; // Estructura escalar actual
let useKeySig = true; // Armadura activada per defecte

// Escales disponibles per App24
// rootOffset: compensació per obtenir l'armadura correcta en rotacions
// Per rotacions, l'armadura de rot 0 a root X és la mateixa que rot N a root X+offset
const APP24_SCALES = [
  { id: 'DIAT', rotation: 0, value: 'DIAT-0', name: 'Major', rootOffset: 0 },
  { id: 'DIAT', rotation: 5, value: 'DIAT-5', name: 'Menor Natural', rootOffset: 3 },  // Eolia: +3 semitons
  { id: 'ARMme', rotation: 0, value: 'ARMme-0', name: 'Menor Harmónica', rootOffset: 0 },
  { id: 'ARMma', rotation: 0, value: 'ARMma-0', name: 'Mayor Harmónica', rootOffset: 0 },
  { id: 'ACUS', rotation: 0, value: 'ACUS-0', name: 'Acústica', rootOffset: 0 },
  { id: 'PENT', rotation: 0, value: 'PENT-0', name: 'Pentatónica', rootOffset: 0 },
  { id: 'TON', rotation: 0, value: 'TON-0', name: 'Tonos', rootOffset: 0 },
  { id: 'CROM', rotation: 0, value: 'CROM-0', name: 'Cromática', rootOffset: 0 },
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
let outputNoteInput = null;
let outputNoteUp = null;
let outputNoteDown = null;
let intervalBarsContainer = null;
const intervalBars = [];

// Soundline APIs
let chromaticSoundline = null;
let scaleSoundline = null;

// Scale selector
let scaleSelector = null;
let scaleTitleElement = null;
let scaleAbbrElement = null;

// Highlight manager
let highlightManager = null;

// Preference storage
const preferenceStorage = createPreferenceStorage('app24');

// ============================================================================
// CONFIGURACIÓ
// ============================================================================

const TOTAL_CHROMATIC = 13; // 0-12 (incluye octava)
const BPM = 75;
const BASE_MIDI = 60; // C4

// ============================================================================
// UTILITATS
// ============================================================================

/**
 * Calcula les notes MIDI de l'escala transposada (amb octava)
 */
function getScaleMidis() {
  const baseMidi = BASE_MIDI + outputNote;
  // Afegir nota 12 (octava = grau 0 superior)
  return [...currentScaleNotes, 12].map(interval => baseMidi + interval);
}

/**
 * Calcula les notes de l'escala transposada (semitons 0-11)
 */
function getTransposedScaleNotes() {
  return currentScaleNotes.map(interval => (outputNote + interval) % 12);
}

/**
 * Retorna les notes de l'escala actual amb l'octava (grau 0 superior)
 */
function getScaleNotesWithOctave() {
  return [...currentScaleNotes, 12];
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
// PASTILLA TRANSPOSICIÓN (clon del patró d'App23)
// ============================================================================

function createOutputNotePill() {
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

function setOutputNote(value) {
  // Cíclic 0-11 (mod 12) — la pastilla és visualment un comptador rotatori.
  const next = ((value % 12) + 12) % 12;
  if (next === outputNote) return;
  outputNote = next;
  if (outputNoteInput) outputNoteInput.value = outputNote;
  updateForTransposeChange();
}

function setupOutputNoteListeners() {
  outputNoteInput = document.getElementById('inputOutputNote');
  outputNoteUp = document.getElementById('outputNoteUp');
  outputNoteDown = document.getElementById('outputNoteDown');

  if (outputNoteInput) {
    outputNoteInput.addEventListener('input', () => {
      const value = outputNoteInput.value.trim();
      if (value === '') return;
      const num = parseInt(value, 10);
      if (!Number.isNaN(num)) setOutputNote(num);
    });
    outputNoteInput.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setOutputNote(outputNote + 1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setOutputNote(outputNote - 1);
      }
    });
  }
  if (outputNoteUp) outputNoteUp.addEventListener('click', () => setOutputNote(outputNote + 1));
  if (outputNoteDown) outputNoteDown.addEventListener('click', () => setOutputNote(outputNote - 1));
}

// ============================================================================
// INTERVAL BARS HORITZONTALS (estil App23) — Estructura Escalar (eE)
// ============================================================================

function createIntervalBarsHTML() {
  // Es renderitza inicialment buit i es repinta a `renderIntervalBars()`
  // un cop tenim `currentEE` (depèn de l'escala seleccionada).
  return `
    <div class="interval-bars-step">
      <h3 class="interval-bars-label">Estructura Escalar (eE):</h3>
      <div class="interval-bars-row" id="intervalBarsRow"></div>
    </div>
  `;
}

function renderIntervalBars() {
  if (!intervalBarsContainer) return;
  intervalBarsContainer.innerHTML = currentEE.map((step, i) =>
    `<div class="interval-bar interval-bar--step-${step}" data-bar-index="${i}">
       <span class="interval-number">${step}</span>
     </div>`
  ).join('');
  intervalBars.length = 0;
  intervalBarsContainer.querySelectorAll('.interval-bar').forEach(el => intervalBars.push(el));
}

function highlightIntervalBar(index, durationMs) {
  const bar = intervalBars[index];
  if (!bar) return;
  bar.classList.add('active');
  setTimeout(() => bar.classList.remove('active'), durationMs);
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
    enableTranspose: false,
    title: 'Escalas',
    selectSize: APP24_SCALES.length,
    onScaleChange: ({ scaleNotes, scaleId, rotation }) => {
      currentScaleId = scaleId;
      currentRotation = rotation;
      currentScaleNotes = scaleNotes;
      currentEE = getRotatedEE(scaleId, rotation);
      updateForScaleChange();
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
  scaleTitleElement.textContent = `Escala ${scaleName}`;

  // Pastilla abbr: només la cromàtica usa `N`; qualsevol altra escala usa `Nº`.
  if (scaleAbbrElement) {
    scaleAbbrElement.textContent = currentScaleConfig?.id === 'CROM' ? 'N' : 'Nº';
  }
}

function updateForScaleChange() {
  // Actualitzar títol de la soundline d'escala
  updateScaleTitle();

  // Re-crear soundline d'escala amb les noves notes visibles
  initScaleSoundline();

  // Actualitzar highlights a cromàtica
  updateChromaticHighlights();

  // Re-dibuixar línies de connexió
  redrawConnectionLines();

  // Re-pintar les barres d'interval (eE) per la nova escala
  renderIntervalBars();

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
  highlightManager.updateChromaticHighlights(chromaticSoundline, transposedNotes, outputNote);
}

// ============================================================================
// SOUNDLINE D'ESCALA
// ============================================================================

/**
 * Formateador d'etiquetes per escala: mostra el grau (0 a N-1, i 0 per l'octava)
 */
function createScaleLabelFormatter() {
  return (noteIndex) => {
    // Nota 12 és el grau 0 de l'octava superior
    if (noteIndex === 12) return 0;
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
    visibleNotes: getScaleNotesWithOctave(),
    labelFormatter: createScaleLabelFormatter()
  });

  // Tots els números de l'escala en selectcolor
  highlightManager.applyHighlightColorsAll(scaleSoundline.element);
}

// ============================================================================
// LÍNIES DE CONNEXIÓ
// ============================================================================

function redrawConnectionLines() {
  drawConnectionLines({
    svg: connectionSvg,
    chromaticContainer,
    chromaticSoundline,
    scaleNotes: getScaleNotesWithOctave()
  });
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
    useKeySig: useKeySig,
    singleClef: 'treble',
    chord: false,
    width: pentagramWidth,
    height: pentagramHeight
  });
}

// ============================================================================
// REPRODUCCIÓ
// ============================================================================

/**
 * Reprodueix l'escala cromàtica (12 notes) des de la nota de sortida
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

  const transposedNotes = getTransposedScaleNotes();

  for (let i = 0; i < TOTAL_CHROMATIC; i++) {
    if (stopChromaticRequested) break;

    const midi = BASE_MIDI + outputNote + i;
    playNote(midi, noteDuration);

    const midiNote = (outputNote + i) % 12;

    highlightManager.highlightNote(chromaticSoundline, i, intervalMs * 0.9, 'chromatic');

    if (transposedNotes.includes(midiNote)) {
      const scaleIndex = transposedNotes.indexOf(midiNote);
      const originalSemitone = currentScaleNotes[scaleIndex];
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
 * Reprodueix l'escala seleccionada (amb octava)
 */
async function playScale() {
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

  const scaleMidis = getScaleMidis();
  const scaleNotesWithOctave = getScaleNotesWithOctave();

  for (let i = 0; i < scaleNotesWithOctave.length; i++) {
    if (stopScaleRequested) break;

    const midi = scaleMidis[i];
    const originalSemitone = scaleNotesWithOctave[i];

    playNote(midi, noteDuration);

    highlightManager.highlightNote(chromaticSoundline, originalSemitone, intervalMs * 0.9, 'chromatic');
    highlightManager.highlightNote(scaleSoundline, originalSemitone, intervalMs * 0.9, 'scale');
    highlightManager.highlightConnectionLine(originalSemitone, intervalMs * 0.9);
    highlightManager.highlightPentagramNote(pentagramContainer, i, intervalMs * 0.9);

    // Interval bar entre nota i-1 i nota i (mateix patró que App23):
    // grau 0 sense barra; grau N>0 il·lumina la barra N-1.
    if (i > 0 && i - 1 < currentEE.length) {
      const barIndex = i - 1;
      const isLastBar = barIndex === currentEE.length - 1;
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
// CREACIÓ DEL LAYOUT
// ============================================================================

function createAppLayout() {
  timelineWrapper = document.querySelector('.timeline-wrapper');
  if (!timelineWrapper) {
    console.error('No se encontró .timeline-wrapper');
    return false;
  }

  timelineWrapper.innerHTML = '';

  // Layout de dues columnes (val per iframe i standalone):
  //   • Esquerra: àrea de soundlines (cromàtica + escala amb línies de
  //     connexió i els play btns sota cada soundline).
  //   • Dreta (apilat de dalt a baix): pastilla "Transposición" +
  //     selector d'escales + interval-bars-step (eE) + pentagrama.
  timelineWrapper.innerHTML = `
    <!-- Columna esquerra: àrea de soundlines -->
    <div class="soundlines-area">
      <div class="soundlines-wrapper">
        <!-- Soundline cromàtica -->
        <div class="soundline-column">
          <div class="soundline-header">
            <h3 class="soundline-title">Escala Cromática</h3>
          </div>
          <div class="soundline-block">
            <div class="soundline-abbr-pill">N</div>
            <div id="chromaticSoundline" class="soundline-container"></div>
          </div>
          ${createPlayButtonHTML('playChromaticBtn', 'Reproducir escala cromática')}
        </div>

        <!-- Línies de connexió -->
        <div class="connection-area">
          <svg id="connectionLines" class="connection-lines"></svg>
        </div>

        <!-- Soundline d'escala -->
        <div class="soundline-column">
          <div class="soundline-header">
            <h3 id="scaleSoundlineTitle" class="soundline-title">Escala Major</h3>
          </div>
          <div class="soundline-block">
            <div id="scaleSoundlineAbbr" class="soundline-abbr-pill">Nº</div>
            <div id="scaleSoundline" class="soundline-container"></div>
          </div>
          ${createPlayButtonHTML('playScaleBtn', 'Reproducir escala')}
        </div>
      </div>
    </div>

    <!-- Columna dreta: Transposición + selector + eE + pentagrama -->
    <div class="app24-right">
      ${createOutputNotePill()}
      <div id="scaleSelectorContainer" class="scale-selector-area"></div>
      ${createIntervalBarsHTML()}
      <div id="pentagramContainer" class="pentagram-container"></div>
    </div>
  `;

  return true;
}

// ============================================================================
// ARMADURA (KEY SIGNATURE TOGGLE)
// ============================================================================

/**
 * Afegeix l'opció d'Armadura al menú d'opcions
 * Similar a la implementació d'Indexlab/App7
 */
function addKeySigOptionToMenu() {
  const factoryResetBtn = document.getElementById('factoryResetBtn');
  if (!factoryResetBtn) {
    // El header encara no s'ha creat, reintentar després
    setTimeout(addKeySigOptionToMenu, 100);
    return;
  }

  const parentNode = factoryResetBtn.parentNode;

  // Crear el label amb checkbox
  const label = document.createElement('label');
  label.htmlFor = 'app24-enableKeySig';
  label.innerHTML = `Armadura <input type="checkbox" id="app24-enableKeySig">`;
  label.style.cssText = 'display: flex; align-items: center; gap: 0.5rem; cursor: pointer;';

  // Inserir just abans del botó factory reset
  parentNode.insertBefore(label, factoryResetBtn);

  const checkbox = document.getElementById('app24-enableKeySig');

  // Carregar preferència guardada
  const stored = preferenceStorage.load('useKeySig');
  if (stored !== null) {
    useKeySig = stored === 'true';
  }
  checkbox.checked = useKeySig;

  // Event listener per canvis
  checkbox.addEventListener('change', () => {
    useKeySig = checkbox.checked;
    preferenceStorage.save('useKeySig', String(useKeySig));
    renderPentagram();
  });

  // Escoltar factory reset per resetejar el checkbox
  window.addEventListener('sharedui:factoryreset', () => {
    useKeySig = true; // Valor per defecte
    checkbox.checked = true;
    renderPentagram();
  });
}

// ============================================================================
// FACTORY RESET
// ============================================================================

registerFactoryReset({ storage: preferenceStorage });

// ============================================================================
// INICIALITZACIÓ
// ============================================================================

function initApp() {
  console.log('Inicializando App24: Selector de Escalas');

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
  intervalBarsContainer = document.getElementById('intervalBarsRow');
  scaleTitleElement = document.getElementById('scaleSoundlineTitle');
  scaleAbbrElement = document.getElementById('scaleSoundlineAbbr');

  // Crear highlight manager (ara que tenim connectionSvg)
  highlightManager = createHighlightManager({
    connectionSvg
  });

  // Inicialitzar scale selector
  initScaleSelector();

  // Listeners pastilla Transposición
  setupOutputNoteListeners();

  // Crear soundlines
  initChromaticSoundline();
  initScaleSoundline();

  // Dibuixar línies de connexió
  redrawConnectionLines();

  // Pintar barres d'interval (eE) inicials
  renderIntervalBars();

  // Renderitzar pentagrama inicial (esperar fonts VexFlow + DOM llest)
  fontsReady.then(() => {
    requestAnimationFrame(() => {
      renderPentagram();
    });
  });

  // Redibuixar línies quan canvia la mida de la finestra
  window.addEventListener('resize', () => {
    redrawConnectionLines();
    renderPentagram();
  });

  // Event listeners
  playChromaticBtn.addEventListener('click', playChromatic);
  playScaleBtn.addEventListener('click', playScale);

  // Escolta canvis d'instrument des del dropdown del header
  setupInstrumentListener();

  // Precargar samples de piano en background
  setupPianoPreload({ delay: 300 });

  // Afegir opció d'Armadura al menú
  addKeySigOptionToMenu();

  console.log('App24 inicializada correctamente');
  initIdleCaretFlash({ targets: [document.getElementById('scaleSelectorContainer')] });
}

// Executar quan el DOM estigui llest
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
