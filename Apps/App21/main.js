// App21: Escalas - Dos soundlines paralelas con líneas de conexión
import { motherScalesData, scaleSemis } from '../../libs/scales/index.js';
import { registerFactoryReset, createPreferenceStorage } from '../../libs/app-common/preferences.js';
import { createSoundline } from '../../libs/app-common/soundline.js';
import { createMelodicAudioInitializer } from '../../libs/app-common/audio-init.js';

// ============================================================================
// ESTADO
// ============================================================================

let isPlaying = false;
let stopRequested = false;
let audio = null; // MelodicTimelineAudio instance
let currentScaleNotes = []; // Semitonos de la escala actual
let transposeValue = 0; // Transposición (0-11)
let transposeEnabled = false; // Opció per mostrar/ocultar selector de nota de sortida

// Referencias DOM
let timelineWrapper = null;
let scaleSel = null;
let chromaticContainer = null;
let scaleContainer = null;
let connectionSvg = null;
let playScaleBtn = null;
let scaleSoundlineTitle = null;
let transposeButtons = null;

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

/**
 * Rota los semitonos de una escala según el modo
 */
function getRotatedScaleNotes(scaleId, rotation) {
  const baseSemis = scaleSemis(scaleId);
  if (rotation === 0) return baseSemis;

  // Para rotaciones, calculamos los semitonos relativos al nuevo modo
  const ee = motherScalesData[scaleId].ee;
  const rotatedEE = [...ee.slice(rotation), ...ee.slice(0, rotation)];

  let acc = 0;
  const result = [0];
  for (let i = 0; i < rotatedEE.length - 1; i++) {
    acc += rotatedEE[i];
    result.push(acc);
  }
  return result;
}

// ============================================================================
// AUDIO (usa MelodicTimelineAudio amb sample pool per baixa latència)
// ============================================================================

const initAudio = createMelodicAudioInitializer({
  defaultInstrument: 'piano'
});

/**
 * Reproduce una nota usando MelodicTimelineAudio (sample pool de baixa latència)
 * Aplica la transposición actual
 */
function playNote(midiNumber, durationSec) {
  if (!audio) return;
  const Tone = window.Tone;
  if (Tone) {
    const transposedMidi = midiNumber + transposeValue;
    audio.playNote(transposedMidi, durationSec, Tone.now());
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
 * Formateador de etiquetas para cromática: rota según transposición
 * La nota en posición visual 0 muestra transposeValue, posición 1 muestra (transposeValue+1)%12, etc.
 */
function createChromaticLabelFormatter() {
  return (noteIndex) => {
    return (noteIndex + transposeValue) % TOTAL_CHROMATIC;
  };
}

function initChromaticSoundline() {
  chromaticContainer.innerHTML = '';

  // Usar módulo compartido para soundline cromática (todas las notas visibles)
  chromaticSoundline = createSoundline({
    container: chromaticContainer,
    totalNotes: TOTAL_CHROMATIC,
    startMidi: BASE_MIDI,
    labelFormatter: createChromaticLabelFormatter()
  });
}

function updateChromaticSoundline() {
  // Redibujar con nuevo labelFormatter cuando cambia transposición
  chromaticSoundline.setVisibleNotes(null, createChromaticLabelFormatter());
}

// ============================================================================
// SOUNDLINE DE ESCALA (con dots para notas fuera de escala)
// ============================================================================

/**
 * Formateador de etiquetas para escala: muestra el grado (0-N) en cada posición visible
 * Los semitonos de la escala se mapean a grados (0, 1, 2...)
 */
function createScaleLabelFormatter(scaleNotes) {
  return (noteIndex) => {
    const degreeIndex = scaleNotes.indexOf(noteIndex);
    return degreeIndex !== -1 ? degreeIndex : '';
  };
}

function initScaleSoundline(scaleNotes) {
  scaleContainer.innerHTML = '';

  // Soundline de 12 notas, con visibleNotes = los semitonos de la escala
  // Las notas fuera de la escala se muestran como puntos
  scaleSoundline = createSoundline({
    container: scaleContainer,
    totalNotes: TOTAL_CHROMATIC,
    startMidi: BASE_MIDI,
    visibleNotes: scaleNotes,
    labelFormatter: createScaleLabelFormatter(scaleNotes)
  });
}

function updateScaleSoundline(scaleNotes) {
  // Actualizar visibleNotes y etiquetas cuando cambia la escala
  scaleSoundline.setVisibleNotes(scaleNotes, createScaleLabelFormatter(scaleNotes));
}

// ============================================================================
// LÍNEAS DE CONEXIÓN
// ============================================================================

function drawConnectionLines(scaleNotes) {
  connectionSvg.innerHTML = '';

  const svgNS = 'http://www.w3.org/2000/svg';

  // Llegir llargada des de la variable CSS --connection-length
  const styles = getComputedStyle(document.documentElement);
  const lengthRaw = styles.getPropertyValue('--connection-length').trim() || '80%';

  // Parsejar el valor (percentatge): línia comença a 0% i s'estén fins a lengthPct%
  const lengthPct = parseFloat(lengthRaw) || 80;

  // Línies horitzontals per cada semitono de l'escala
  scaleNotes.forEach((semitone, degree) => {
    // Posició vertical basada en el semitono (igual a ambdues soundlines)
    const yPct = chromaticSoundline.getNotePosition(semitone);

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
 * @param {Object} soundlineApi - API del módulo soundline (chromaticSoundline o scaleSoundline)
 * @param {number} noteIndex - Índice de la nota (0-11)
 */
function createHighlight(soundlineApi, noteIndex) {
  const yPct = soundlineApi.getNotePosition(noteIndex);

  const highlight = document.createElement('div');
  highlight.className = 'note-highlight';
  highlight.style.top = `${yPct}%`;
  highlight.dataset.note = noteIndex;

  // Añadir al elemento soundline interno
  soundlineApi.element.appendChild(highlight);
  return highlight;
}

/**
 * Destaca una nota en una soundline
 * @param {Object} soundlineApi - API del módulo soundline
 * @param {number} noteIndex - Índice de la nota
 * @param {number} durationMs - Duración del highlight en ms
 * @param {string} key - Clave única para este tipo de highlight
 */
function highlightNote(soundlineApi, noteIndex, durationMs, key) {
  // Remover highlight previo si existe
  const existingKey = `${key}-${noteIndex}`;
  if (activeHighlights.has(existingKey)) {
    const prev = activeHighlights.get(existingKey);
    prev.element.remove();
    clearTimeout(prev.timeout);
    activeHighlights.delete(existingKey);
  }

  // Crear nuevo highlight usando la API del soundline
  const highlight = createHighlight(soundlineApi, noteIndex);
  highlight.classList.add('active');

  // Programar eliminación
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

  // Limpiar líneas activas
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

function stopPlayback() {
  stopRequested = true;
}

function resetPlaybackState() {
  isPlaying = false;
  stopRequested = false;
  playScaleBtn.classList.remove('playing');
  setPlayIcon(playScaleBtn, false);
  clearAllHighlights();
}

async function playSelectedScale() {
  // Si ya está sonando, detener
  if (isPlaying) {
    stopPlayback();
    return;
  }

  isPlaying = true;
  stopRequested = false;
  playScaleBtn.classList.add('playing');
  setPlayIcon(playScaleBtn, true);

  // Initialize audio if needed
  if (!audio) {
    audio = await initAudio();
  }

  const intervalMs = (60 / BPM) * 1000;
  const noteDuration = intervalMs * 0.9 / 1000;

  // Reproducir notas de la escala seleccionada
  for (let degree = 0; degree < currentScaleNotes.length; degree++) {
    if (stopRequested) break;

    const semitone = currentScaleNotes[degree];
    const midi = BASE_MIDI + semitone;

    // Reproducir nota
    playNote(midi, noteDuration);

    // Highlight sincronizado en AMBAS soundlines (usando semitono)
    highlightNote(chromaticSoundline, semitone, intervalMs * 0.9, 'chromatic');
    highlightNote(scaleSoundline, semitone, intervalMs * 0.9, 'scale');

    // Highlight en línea de conexión
    highlightConnectionLine(semitone, intervalMs * 0.9);

    // Esperar antes de la siguiente nota
    await sleep(intervalMs);
  }

  resetPlaybackState();
}

// ============================================================================
// SELECTOR DE ESCALAS
// ============================================================================

function populateScaleSelector() {
  scaleSel.innerHTML = '';

  // Modes de la diatònica (sense optgroup, directament com opcions)
  motherScalesData.DIAT.rotNames.forEach((name, i) => {
    const opt = document.createElement('option');
    opt.value = `DIAT-${i}`;
    opt.textContent = name;
    scaleSel.appendChild(opt);
  });

  // Resto de escalas madre (solo modo 0, sin sus rotaciones)
  const otherScales = ['ACUS', 'ARMme', 'ARMma', 'OCT', 'HEX', 'TON', 'CROM'];
  otherScales.forEach(id => {
    const opt = document.createElement('option');
    opt.value = `${id}-0`;
    opt.textContent = motherScalesData[id].name;
    scaleSel.appendChild(opt);
  });
}

/**
 * Obtiene el nombre de visualización de la escala actual.
 * Per la diatònica usa els noms dels modes (Mayor, Dórica, etc.)
 * Per la resta d'escales usa el nom de l'escala mare (Cromática, Tonos, etc.)
 */
function getScaleDisplayName(scaleId, rotation) {
  const scaleData = motherScalesData[scaleId];
  if (!scaleData) return 'Escala';

  // Només per la diatònica usem els noms dels modes
  if (scaleId === 'DIAT' && scaleData.rotNames && scaleData.rotNames[rotation]) {
    return scaleData.rotNames[rotation];
  }

  // Per la resta d'escales, usar el nom de l'escala mare
  return scaleData.name;
}

function onScaleChange(value) {
  const [scaleId, rot] = value.split('-');
  const rotation = parseInt(rot, 10);

  currentScaleNotes = getRotatedScaleNotes(scaleId, rotation);

  // Actualizar título de la soundline de escala
  if (scaleSoundlineTitle) {
    scaleSoundlineTitle.textContent = getScaleDisplayName(scaleId, rotation);
  }

  // Redibujar soundline de escala
  updateScaleSoundline(currentScaleNotes);

  // Redibujar líneas de conexión
  drawConnectionLines(currentScaleNotes);
}

// ============================================================================
// CREACIÓN DEL LAYOUT
// ============================================================================

function createAppLayout() {
  // Obtener el timeline-wrapper del template
  timelineWrapper = document.querySelector('.timeline-wrapper');
  if (!timelineWrapper) {
    console.error('No se encontró .timeline-wrapper');
    return false;
  }

  // Limpiar contenido del template
  timelineWrapper.innerHTML = '';

  // Crear estructura del layout
  timelineWrapper.innerHTML = `
    <!-- Selector de escalas -->
    <aside class="scale-selector">
      <h2 class="scale-selector-title">Escoge una escala y verás su numeración de grado en la segunda línea sonora</h2>
      <select id="scaleSel" class="scale-select" size="14"></select>

      <!-- Selector de transposición -->
      <div class="transpose-selector">
        <span class="transpose-label">Nota de Salida</span>
        <div class="transpose-buttons">
          <button class="transpose-btn active" data-transpose="0">0</button>
          <button class="transpose-btn" data-transpose="1">1</button>
          <button class="transpose-btn" data-transpose="2">2</button>
          <button class="transpose-btn" data-transpose="3">3</button>
          <button class="transpose-btn" data-transpose="4">4</button>
          <button class="transpose-btn" data-transpose="5">5</button>
          <button class="transpose-btn" data-transpose="6">6</button>
          <button class="transpose-btn" data-transpose="7">7</button>
          <button class="transpose-btn" data-transpose="8">8</button>
          <button class="transpose-btn" data-transpose="9">9</button>
          <button class="transpose-btn" data-transpose="10">10</button>
          <button class="transpose-btn" data-transpose="11">11</button>
        </div>
      </div>
    </aside>

    <!-- Area de soundlines -->
    <div class="soundlines-area">
      <div class="soundlines-wrapper">
        <!-- Soundline cromática -->
        <div class="soundline-column">
          <div class="soundline-header">
            <h3 class="soundline-title">Escala Cromática</h3>
            <span class="soundline-subtitle">N Modulares</span>
          </div>
          <div id="chromaticSoundline" class="soundline-container"></div>
        </div>

        <!-- Líneas de conexión + botón Play centrado -->
        <div class="connection-area">
          <svg id="connectionLines" class="connection-lines"></svg>
          <button id="playScaleBtn" class="play connection-play" aria-label="Reproducir escala seleccionada">
            <svg class="icon-play" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" fill="currentColor">
              <path d="M73 39c-14.8-9-33 2.5-33 19v396c0 16.5 18.2 28 33 19l305-198c13.3-8.6 13.3-29.4 0-38L73 39z"/>
            </svg>
            <svg class="icon-stop" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor" style="display:none">
              <path d="M400 32H48C21.5 32 0 53.5 0 80v352c0 26.5 21.5 48 48 48h352c26.5 0 48-21.5 48-48V80c0-26.5-21.5-48-48-48z"/>
            </svg>
          </button>
        </div>

        <!-- Soundline de escala -->
        <div class="soundline-column">
          <div class="soundline-header">
            <h3 id="scaleSoundlineTitle" class="soundline-title">Cromática</h3>
            <span class="soundline-subtitle">N de grado</span>
          </div>
          <div id="scaleSoundline" class="soundline-container"></div>
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
// OPCIÓ TRANSPOSE AL MENÚ
// ============================================================================

function addTransposeOptionToMenu() {
  const factoryResetBtn = document.getElementById('factoryResetBtn');
  if (!factoryResetBtn) {
    // El header encara no s'ha creat, reintentar després
    setTimeout(addTransposeOptionToMenu, 100);
    return;
  }

  // Crear el label amb checkbox
  const label = document.createElement('label');
  label.htmlFor = 'enableTranspose';
  label.innerHTML = 'Activar N de Salida <input type="checkbox" id="enableTranspose">';
  label.style.cssText = 'display: flex; align-items: center; gap: 0.5rem; cursor: pointer;';

  // Inserir just abans del botó factory reset
  factoryResetBtn.parentNode.insertBefore(label, factoryResetBtn);

  const checkbox = document.getElementById('enableTranspose');

  // Carregar preferència guardada
  const stored = preferenceStorage.load('transposeEnabled');
  transposeEnabled = stored === 'true';
  checkbox.checked = transposeEnabled;

  // Aplicar visibilitat inicial
  updateTransposeSelectorVisibility();

  // Event listener per canvis
  checkbox.addEventListener('change', () => {
    transposeEnabled = checkbox.checked;
    preferenceStorage.save('transposeEnabled', String(transposeEnabled));
    updateTransposeSelectorVisibility();
  });

  // Escoltar factory reset per resetejar el checkbox
  window.addEventListener('sharedui:factoryreset', () => {
    transposeEnabled = false;
    checkbox.checked = false;
    updateTransposeSelectorVisibility();
  });
}

function updateTransposeSelectorVisibility() {
  const transposeSelector = document.querySelector('.transpose-selector');
  if (!transposeSelector) {
    console.warn('[App21] .transpose-selector no trobat');
    return;
  }

  if (transposeEnabled) {
    transposeSelector.style.display = 'flex';
  } else {
    transposeSelector.style.display = 'none';
    // Reset a 0 quan es desactiva
    if (transposeValue !== 0) {
      transposeValue = 0;
      transposeButtons.forEach(b => b.classList.remove('active'));
      const zeroBtn = document.querySelector('.transpose-btn[data-transpose="0"]');
      if (zeroBtn) zeroBtn.classList.add('active');
      updateChromaticSoundline();
      updateScaleSoundline(currentScaleNotes);
      drawConnectionLines(currentScaleNotes);
    }
  }
}

// ============================================================================
// INICIALIZACIÓN
// ============================================================================

function initApp() {
  console.log('Inicializando App21: Escalas');

  // Crear layout dentro del template
  if (!createAppLayout()) {
    console.error('Error creando layout');
    return;
  }

  // Referencias DOM
  scaleSel = document.getElementById('scaleSel');
  chromaticContainer = document.getElementById('chromaticSoundline');
  scaleContainer = document.getElementById('scaleSoundline');
  connectionSvg = document.getElementById('connectionLines');
  playScaleBtn = document.getElementById('playScaleBtn');
  scaleSoundlineTitle = document.getElementById('scaleSoundlineTitle');
  transposeButtons = document.querySelectorAll('.transpose-btn');

  // Poblar selector
  populateScaleSelector();

  // Crear soundline cromática (usa módulo compartido)
  initChromaticSoundline();

  // Inicializar con escala Cromática (CROM-0)
  currentScaleNotes = getRotatedScaleNotes('CROM', 0);
  initScaleSoundline(currentScaleNotes);
  scaleSel.value = 'CROM-0';
  drawConnectionLines(currentScaleNotes);

  // Event listeners
  scaleSel.addEventListener('change', (e) => {
    onScaleChange(e.target.value);
  });

  playScaleBtn.addEventListener('click', playSelectedScale);

  // Event listeners para transposición
  transposeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const value = parseInt(btn.dataset.transpose, 10);
      transposeValue = value;

      // Actualizar estado visual
      transposeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Refrescar visualizaciones con nueva transposición
      updateChromaticSoundline();
      updateScaleSoundline(currentScaleNotes);
      drawConnectionLines(currentScaleNotes);
    });
  });

  // Escolta canvis d'instrument des del dropdown del header
  setupInstrumentListener();

  // Afegir opció de transpose al menú d'opcions
  addTransposeOptionToMenu();

  console.log('App21 inicializada correctamente');
}

// Ejecutar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
