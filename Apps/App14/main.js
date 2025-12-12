// App14: Intervalo Sonoro - Editor de seqüències d'iS amb visualització
import { createSoundline } from '../../libs/app-common/soundline.js';
import { createNoteHighlightController } from '../../libs/app-common/note-highlight.js';
import { loadPiano, setupPianoPreload, isPianoLoaded } from '../../libs/sound/piano.js';
import { ensureToneLoaded } from '../../libs/sound/tone-loader.js';

// ========== CONSTANTS ==========
const MIN_NOTE = 0;
const MAX_NOTE = 11;
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const OCTAVE = 4;
const START_MIDI = 60; // C4
const FIXED_BPM = 65;
const MAX_IS = 4; // Màxim 4 intervals

// ========== ESTAT ==========
let isPlaying = false;
let userStopped = false; // Flag per indicar que l'usuari ha parat manualment
let piano = null;
let currentIntervals = []; // Array de valors iS entrats
let currentHighlights = [];
let currentIntervalElements = [];
let activeAnimationTimeouts = []; // Track active animation timeouts

// Referències DOM
let isEditor = null;
let isInputs = [];
let playBtn = null;
let randomBtn = null;
let resetBtn = null;
let tooltip = null;
let tooltipTimeout = null;

// Get timeline element from template
const timeline = document.getElementById('timeline');
if (!timeline) throw new Error('Cannot find #timeline element');

// Extract .controls before removing .middle
const middle = document.querySelector('.middle');
const controlsSection = middle?.querySelector('.controls');
if (controlsSection && timeline.parentElement) {
  timeline.parentElement.parentElement.insertBefore(controlsSection, timeline.parentElement);
}
middle?.remove();

// Create soundline container inside timeline
const soundlineContainer = document.createElement('div');
soundlineContainer.className = 'soundline-container';
soundlineContainer.style.position = 'relative';
soundlineContainer.style.width = '100%';
soundlineContainer.style.height = '100%';

timeline.appendChild(soundlineContainer);

// Create soundline
const soundline = createSoundline({
  container: soundlineContainer,
  notes: 12,
  startMidi: START_MIDI
});

// Create highlight controller
const highlightController = createNoteHighlightController({
  container: soundlineContainer,
  soundline,
  notes: 12
});

// ========== UTILITATS ==========
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get note name from index
 */
function getNoteName(noteIndex) {
  return `${NOTE_NAMES[noteIndex]}${OCTAVE}`;
}

/**
 * Calculate valid iS range for next interval
 * @param {number} currentNote - Current note (0-11)
 * @param {boolean} isFirst - Whether this is the first interval
 * @returns {Object} - { min, max } valid iS values
 */
function getValidIsRange(currentNote, isFirst = false) {
  // El primer iS sempre comença des de nota 0, per tant només pot ser positiu (0-11)
  if (isFirst) {
    return { min: 0, max: MAX_NOTE };
  }
  // iS posteriors poden ser negatius o positius
  // La nota resultant ha d'estar dins [0, 11]
  const minIs = MIN_NOTE - currentNote;
  const maxIs = MAX_NOTE - currentNote;
  return { min: minIs, max: maxIs };
}

/**
 * Get starting note (always 0)
 */
function getStartingNote() {
  return 0;
}

// ========== INTERVAL ELEMENTS ==========
/**
 * Clear all interval elements (line and number)
 */
function clearIntervalElements() {
  currentIntervalElements.forEach(el => {
    if (el && el.parentNode) {
      el.remove();
    }
  });
  currentIntervalElements = [];
}

/**
 * Clear all current highlights
 */
function clearHighlights() {
  currentHighlights.forEach(index => {
    const rect = soundline.element.querySelector(`.note-highlight[data-note="${index}"]`);
    if (rect) rect.classList.remove('highlight');
  });
  currentHighlights = [];
}

/**
 * Create vertical interval line between two notes with directional animation
 * La barra creix des de la nota origen cap a la nota destí
 * @param {number} note1Index - Nota origen (primer del parell)
 * @param {number} note2Index - Nota destí (segon del parell)
 */
function createIntervalLine(note1Index, note2Index, delayBeats = 1, durationBeats = 2) {
  // getNotePosition retorna el BOTTOM de la cel·la
  // Per centrar, restem la meitat de l'alçada d'una cel·la (pujar mig cel·la)
  const cellHeight = 100 / 12; // ≈ 8.33%
  const halfCell = cellHeight / 2; // ≈ 4.17%

  const pos1 = soundline.getNotePosition(note1Index);
  const pos2 = soundline.getNotePosition(note2Index);

  // Centre de cada cel·la = bottom - halfCell
  const center1 = pos1 - halfCell;
  const center2 = pos2 - halfCell;

  const intervalBar = document.createElement('div');
  intervalBar.className = 'interval-bar-vertical';
  intervalBar.style.position = 'absolute';
  intervalBar.style.left = '160px';
  intervalBar.style.width = '4px';

  // Alçada final: distància entre els dos centres
  const finalHeight = Math.abs(center1 - center2);

  // Durada de l'animació en segons (per defecte 2 beats)
  const animationDuration = (60 / FIXED_BPM) * durationBeats;

  // Delay abans de començar l'animació (1 beat per defecte)
  const delayMs = (60 / FIXED_BPM) * delayBeats * 1000;

  // Determinar direcció: positiu (puja, note2 > note1) o negatiu (baixa)
  // En la soundline, nota 0 està a BAIX (% alt), nota 11 a DALT (% baix)
  const isAscending = note2Index > note1Index;

  if (isAscending) {
    // Interval positiu: nota puja (de baix a dalt en pantalla)
    // center1 > center2 (origen té % més alt = més avall)
    // Posicionem el BOTTOM de la barra al centre de l'origen
    const bottomPos = 100 - center1;
    intervalBar.style.bottom = `${bottomPos}%`;
    intervalBar.style.top = 'auto';
    intervalBar.style.height = '0%';
  } else {
    // Interval negatiu: nota baixa (de dalt a baix en pantalla)
    // center1 < center2 (origen té % més baix = més amunt)
    // Posicionem el TOP de la barra al centre de l'origen
    intervalBar.style.top = `${center1}%`;
    intervalBar.style.height = '0%';
  }

  soundline.element.appendChild(intervalBar);
  currentIntervalElements.push(intervalBar);

  // Animar l'alçada després del delay
  const timeoutId = setTimeout(() => {
    requestAnimationFrame(() => {
      intervalBar.style.transition = `height ${animationDuration}s ease-out`;
      intervalBar.style.height = `${finalHeight}%`;
    });
  }, delayMs);
  activeAnimationTimeouts.push(timeoutId);
}

/**
 * Show interval number with direction (with delay)
 */
function showIntervalNumber(note1Index, note2Index, delayBeats = 1) {
  const interval = note2Index - note1Index;
  const absInterval = Math.abs(interval);
  const direction = interval > 0 ? '+' : interval < 0 ? '-' : '';

  // Calcular centre de cada cel·la (igual que createIntervalLine)
  const cellHeight = 100 / 12;
  const halfCell = cellHeight / 2;

  const pos1 = soundline.getNotePosition(note1Index);
  const pos2 = soundline.getNotePosition(note2Index);

  // Centre de cada cel·la
  const center1 = pos1 - halfCell;
  const center2 = pos2 - halfCell;

  // Punt mig entre els dos centres
  const centerY = (center1 + center2) / 2;

  const delayMs = (60 / FIXED_BPM) * delayBeats * 1000;

  // Crear element però no mostrar-lo encara
  const intervalNum = document.createElement('div');
  intervalNum.className = 'interval-number';
  intervalNum.textContent = `${direction}${absInterval}`;
  intervalNum.style.position = 'absolute';
  intervalNum.style.top = `${centerY}%`;
  intervalNum.style.left = (absInterval === 0 || absInterval === 1) ? '220px' : '180px';
  intervalNum.style.transform = 'translateY(-50%)';
  intervalNum.style.opacity = '0';

  soundline.element.appendChild(intervalNum);
  currentIntervalElements.push(intervalNum);

  // Mostrar després del delay
  const timeoutId = setTimeout(() => {
    intervalNum.style.transition = 'opacity 0.2s ease';
    intervalNum.style.opacity = '1';
  }, delayMs);
  activeAnimationTimeouts.push(timeoutId);
}

// ========== EDITOR iS ==========
function createIsEditor() {
  isEditor = document.createElement('div');
  isEditor.className = 'is-editor';

  // Etiqueta "iS:"
  const label = document.createElement('span');
  label.className = 'is-editor__label';
  label.textContent = 'iS:';
  isEditor.appendChild(label);

  // Contenidor d'inputs
  const inputsContainer = document.createElement('div');
  inputsContainer.className = 'is-editor__inputs';
  inputsContainer.style.display = 'flex';
  inputsContainer.style.gap = '8px';

  // Crear 4 inputs
  for (let i = 0; i < MAX_IS; i++) {
    const input = document.createElement('input');
    input.type = 'text';
    input.inputMode = 'numeric';
    input.pattern = '-?[0-9]*';
    input.maxLength = 3; // -11 to 11
    input.className = 'is-input';
    input.dataset.index = i;
    input.placeholder = '';

    // Event handlers
    input.addEventListener('input', (e) => handleIsInput(e, i));
    input.addEventListener('keydown', (e) => handleIsKeydown(e, i));
    input.addEventListener('focus', () => hideTooltip());

    inputsContainer.appendChild(input);
    isInputs.push(input);
  }

  isEditor.appendChild(inputsContainer);

  // Tooltip (posició fixa al body)
  tooltip = document.createElement('div');
  tooltip.className = 'is-tooltip';
  document.body.appendChild(tooltip);

  return isEditor;
}

function handleIsInput(e, index) {
  const input = e.target;
  let value = input.value.trim();

  // El primer iS (index 0) NO pot ser negatiu
  const isFirst = index === 0;

  // Permetre '-' sol mentre s'escriu (però no al primer input)
  if (value === '-') {
    if (isFirst) {
      input.value = '';
      showTooltip(input, 'El primer iS debe ser entre 0 y 11', false);
    }
    return;
  }

  // Només acceptar números i signe negatiu (negatiu només si no és el primer)
  if (value && !/^-?\d+$/.test(value)) {
    input.value = '';
    return;
  }

  const numValue = parseInt(value);
  if (isNaN(numValue)) {
    currentIntervals[index] = undefined;
    updateInputStates();
    return;
  }

  // El primer iS sempre comença des de nota 0
  // Calcular la nota acumulada fins aquest punt
  let currentNote = 0; // Nota inicial sempre 0
  for (let i = 0; i < index; i++) {
    if (currentIntervals[i] !== undefined) {
      currentNote += currentIntervals[i];
    }
  }

  // Obtenir rang vàlid
  const range = getValidIsRange(currentNote, isFirst);

  // Validar que el valor està dins del rang
  if (numValue < range.min || numValue > range.max) {
    let message;
    if (isFirst) {
      message = `iS debe ser entre 0 y ${range.max}`;
    } else {
      const minStr = range.min >= 0 ? `${range.min}` : `${range.min}`;
      const maxStr = range.max >= 0 ? `+${range.max}` : `${range.max}`;
      message = `iS debe estar entre ${minStr} y ${maxStr}`;
    }
    showTooltip(input, message, false);
    input.value = '';
    currentIntervals[index] = undefined;
    updateInputStates();
    return;
  }

  // Actualitzar estat
  currentIntervals[index] = numValue;
  updateInputStates();

  // Auto-avançar al següent input amb delay de 1000ms
  // Això permet temps per escriure números de dos dígits (10, 11)
  if (index < MAX_IS - 1) {
    const nextInput = isInputs[index + 1];
    if (nextInput && nextInput.value === '') {
      setTimeout(() => {
        // Només avançar si l'input actual segueix amb valor i el següent segueix buit
        if (input.value !== '' && nextInput.value === '') {
          nextInput.focus();
        }
      }, 1000);
    }
  }
}

function handleIsKeydown(e, index) {
  // Backspace en input buit → tornar enrere
  if (e.key === 'Backspace' && !isInputs[index].value && index > 0) {
    e.preventDefault();
    isInputs[index - 1].focus();
    return;
  }

  // Arrow keys per navegació
  if (e.key === 'ArrowLeft' && index > 0) {
    e.preventDefault();
    isInputs[index - 1].focus();
  } else if (e.key === 'ArrowRight' && index < MAX_IS - 1) {
    e.preventDefault();
    isInputs[index + 1].focus();
  }
}

function updateInputStates() {
  isInputs.forEach((input, idx) => {
    const hasValue = currentIntervals[idx] !== undefined;
    input.classList.toggle('has-value', hasValue);
  });
}

function showTooltip(input, message, isSuccess = false) {
  if (!tooltip) return;

  tooltip.textContent = message;
  tooltip.className = `is-tooltip ${isSuccess ? 'success' : 'error'} visible`;

  const rect = input.getBoundingClientRect();
  tooltip.style.left = `${rect.left + rect.width / 2}px`;
  tooltip.style.top = `${rect.bottom + 8}px`;
  tooltip.style.transform = 'translateX(-50%)';

  clearTimeout(tooltipTimeout);
  tooltipTimeout = setTimeout(hideTooltip, 2000);
}

function hideTooltip() {
  if (tooltip) {
    tooltip.classList.remove('visible');
  }
}

function getIntervalsFromEditor() {
  return currentIntervals.filter(v => v !== undefined);
}

function setIntervalsToEditor(intervals) {
  currentIntervals = [];
  isInputs.forEach((input, i) => {
    if (intervals[i] !== undefined) {
      input.value = intervals[i];
      currentIntervals[i] = intervals[i];
    } else {
      input.value = '';
    }
  });
  updateInputStates();
}

function clearEditor() {
  currentIntervals = [];
  isInputs.forEach(input => {
    input.value = '';
    input.classList.remove('has-value');
  });
}

function focusFirstInput() {
  if (isInputs[0]) {
    isInputs[0].focus();
  }
}

// ========== FLASH ANIMATION ==========
async function flashEmptyInputs() {
  // 3 flashes
  for (let i = 0; i < 3; i++) {
    isInputs.forEach(input => input.classList.add('flash'));
    await sleep(300);
    isInputs.forEach(input => input.classList.remove('flash'));
    if (i < 2) await sleep(100); // Pausa entre flashes
  }
}

// ========== AUDIO ==========
let pianoInitialized = false;

async function initializePiano() {
  if (pianoInitialized) return;
  pianoInitialized = true;

  try {
    await ensureToneLoaded();
    piano = await loadPiano();
    setupVolumeControl();
  } catch (error) {
    console.error('Error initializing piano:', error);
  }
}

function setupVolumeControl() {
  const Tone = window.Tone;
  if (!Tone) return;

  window.addEventListener('sharedui:volume', (e) => {
    const volume = e.detail?.value ?? 1;
    const dB = volume > 0 ? 20 * Math.log10(volume) : -Infinity;
    Tone.getDestination().volume.value = dB;
  });

  window.addEventListener('sharedui:mute', (e) => {
    const muted = e.detail?.value ?? false;
    Tone.getDestination().mute = muted;
  });
}

// ========== REPRODUCCIÓ ==========
async function handlePlay() {
  // Si ja estem reproduint, STOP
  if (isPlaying) {
    isPlaying = false;
    userStopped = true; // Marcar que l'usuari ha parat manualment
    updateControlsState();
    // NO esborrem els elements - deixem que l'animació acabi i es mantingui
    // clearHighlights();
    // clearIntervalElements();
    return;
  }

  const intervals = getIntervalsFromEditor();

  // Si editor buit, flash i sortir
  if (intervals.length === 0) {
    await flashEmptyInputs();
    return;
  }

  // Show loading indicator if piano not yet loaded
  const playIcon = playBtn?.querySelector('.icon-play');
  if (!isPianoLoaded() && playIcon) {
    playIcon.style.opacity = '0.5';
  }

  await initializePiano();

  // Restore button opacity after loading
  if (playIcon) {
    playIcon.style.opacity = '1';
  }

  if (!piano) return;

  isPlaying = true;
  userStopped = false; // Reset flag per nova reproducció
  updateControlsState();

  // Netejar visualització anterior i timeouts pendents
  activeAnimationTimeouts.forEach(id => clearTimeout(id));
  activeAnimationTimeouts = [];
  clearHighlights();
  clearIntervalElements();

  try {
    const Tone = window.Tone;
    const beatSec = 60 / FIXED_BPM;

    // Nota inicial sempre 0
    let currentNote = getStartingNote();

    // Tocar primera nota (nota 0) - dura 1 beat
    const note1 = getNoteName(currentNote);
    piano.triggerAttackRelease(note1, beatSec * 0.9, Tone.now());
    highlightController.highlightNote(currentNote, 999999);
    currentHighlights.push(currentNote);

    await sleep(beatSec * 1000);

    // Tocar cada interval
    // Visualització per parells: sempre mostrem origen → destí
    // El destí d'un parell es converteix en l'origen del següent
    // Al final, l'últim parell es queda il·luminat
    // Timings: 1a nota 1 beat, 2a-4a nota 3 beats, 5a nota 1 beat
    for (let i = 0; i < intervals.length; i++) {
      if (!isPlaying) break;

      const iS = intervals[i];
      const previousNote = currentNote;
      currentNote = currentNote + iS;

      // Validar que la nota resultant està dins del rang
      if (currentNote < MIN_NOTE || currentNote > MAX_NOTE) {
        console.warn(`Nota ${currentNote} fora de rang, aturant`);
        break;
      }

      // Netejar elements d'interval anteriors
      clearIntervalElements();

      // Per a parells: esborrem la nota ANTERIOR a l'origen actual
      // i === 0: mostrem nota0 → nota1 (no esborrem res, nota0 ja hi és)
      // i === 1: mostrem nota1 → nota2 (esborrem nota0, mantenim nota1)
      // i === 2: mostrem nota2 → nota3 (esborrem nota1, mantenim nota2)
      // i === 3: mostrem nota3 → nota4 (esborrem nota2, mantenim nota3)
      // Sempre mantenim l'última nota del parell anterior (que és l'origen del parell actual)
      // IMPORTANT: Si iS = 0, la nota origen i destí són la mateixa - no esborrar-la!
      if (i >= 1 && currentHighlights.length >= 2) {
        const noteToRemove = currentHighlights[0];
        // Només esborrar si la nota a esborrar NO és l'origen del parell actual
        if (noteToRemove !== previousNote) {
          currentHighlights.shift();
          const rect = soundline.element.querySelector(`.note-highlight[data-note="${noteToRemove}"]`);
          if (rect) rect.classList.remove('highlight');
        }
      }

      // Determinar si és l'última nota (5a nota = index 3, ja que index comença a 0)
      const isLastNote = i === intervals.length - 1;

      // Mostrar interval (línia i número)
      // L'animació comença 1 beat després i dura 2 beats
      if (previousNote !== currentNote) {
        createIntervalLine(previousNote, currentNote, 1, 2);
      }
      showIntervalNumber(previousNote, currentNote);

      // Tocar nova nota i mostrar highlight
      const note2 = getNoteName(currentNote);
      // Durada de la nota: última nota 2 beats, resta 3 beats
      const noteDurationBeats = isLastNote ? 2 : 3;
      piano.triggerAttackRelease(note2, beatSec * noteDurationBeats * 0.9, Tone.now());
      highlightController.highlightNote(currentNote, 999999);
      // Només afegir als highlights si és una nota diferent (evitar duplicats quan iS = 0)
      if (currentNote !== previousNote) {
        currentHighlights.push(currentNote);
      }

      // Esperar segons la nota: última nota 2 beats, resta 3 beats
      await sleep(beatSec * noteDurationBeats * 1000);
    }

    // L'últim parell es queda il·luminat (no es neteja)

  } catch (error) {
    console.error('Error playing sequence:', error);
  }

  isPlaying = false;
  updateControlsState();
}

function handleRandom() {
  if (isPlaying) return;

  // Generar sempre 4 iS aleatoris vàlids
  const intervals = [];

  // Nota inicial sempre 0
  let currentNote = 0;

  for (let i = 0; i < MAX_IS; i++) {
    const isFirst = i === 0;
    const range = getValidIsRange(currentNote, isFirst);
    // Generar iS aleatori dins del rang vàlid
    const iS = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
    intervals.push(iS);
    currentNote += iS;
  }

  setIntervalsToEditor(intervals);
}

function handleReset() {
  if (isPlaying) {
    isPlaying = false;
  }
  userStopped = false;

  // Cancel·lar timeouts pendents
  activeAnimationTimeouts.forEach(id => clearTimeout(id));
  activeAnimationTimeouts = [];

  clearEditor();
  clearHighlights();
  clearIntervalElements();
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
  if (resetBtn) {
    resetBtn.disabled = isPlaying;
  }
}

// ========== SETUP ==========
function setupControls() {
  const controls = document.querySelector('.controls');
  if (!controls) return;

  playBtn = document.getElementById('playBtn');
  randomBtn = document.getElementById('randomBtn');
  resetBtn = document.getElementById('resetBtn');

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

// ========== INICIALITZACIÓ ==========
function initApp() {
  console.log('Inicialitzant App14: Intervalo Sonoro');

  // Setup piano preload in background (reduces latency on first play)
  setupPianoPreload({ delay: 300 });

  // Crear editor iS i inserir-lo abans del timeline
  const editor = createIsEditor();
  const timelineWrapper = timeline.parentElement;
  if (timelineWrapper) {
    timelineWrapper.insertBefore(editor, timeline);
  }

  // Setup controls
  setupControls();

  // Focus inicial
  setTimeout(focusFirstInput, 100);

  console.log('App14 inicialitzada');
}

// Cleanup
window.addEventListener('beforeunload', () => {
  if (piano && typeof piano.dispose === 'function') {
    piano.dispose();
    piano = null;
  }
});

// Executar quan el DOM estigui llest
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
