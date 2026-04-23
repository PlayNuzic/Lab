// App13: Intervalos Temporales - Editor de secuencias de iT con reproducción
import { createMelodicAudioInitializer } from '../../libs/app-common/audio-init.js';
import { bindSharedSoundEvents } from '../../libs/app-common/audio.js';
import { registerFactoryReset, createPreferenceStorage } from '../../libs/app-common/preferences.js';
import { createBpmController } from '../../libs/app-common/bpm-controller.js';
import { initIdleCaretFlash } from '../../libs/app-common/idle-caret-flash.js';

// ========== CONFIGURACIÓN ==========
const TOTAL_PULSES = 9;  // Pulsos 0-8 (8 es endpoint visual)
const MAX_LENGTH = 8;    // Suma total de iTs
const MAX_ITS = 4;       // Máximo 4 inputs de iT
const MIN_BPM = 75;
const MAX_BPM = 150;
const DEFAULT_BPM = 90;

// Colors ben diferenciats per les barres (màxim 4 iTs)
const VIBRANT_COLORS = [
  '#7CD6B3', // verd
  '#F5C6C2', // rosa clar
  '#7CD6B3', // verd
  '#F5C6C2'  // rosa clar
];

// ========== ESTADO ==========
let isPlaying = false;
let audio = null;
let bpmController = null;
let currentIntervals = []; // Array de valores iT entrats
let playbackTimeouts = []; // Per cancel·lar reproducció

// Persistència de sons i colors (es manté fins canvi d'editor o random)
let currentSoundAssignments = null;  // MIDI notes per interval
let currentColorAssignments = null;

// Instrument actual (piano o violí)
let currentInstrument = 'piano';  // Default: piano

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
let cellsContainer = null;
let endMarker = null;
let autoJumpTimer = null;
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
 * Genera una nota MIDI aleatoria del registro 4 (C4-B4)
 * @param {Set<number>} [excludeSet] - Set de notas MIDI a excluir
 * @returns {number} MIDI 60-71
 */
function getRandomMidiNote(excludeSet) {
  const allNotes = [];
  for (let i = 60; i <= 71; i++) {
    if (!excludeSet || !excludeSet.has(i)) {
      allNotes.push(i);
    }
  }
  // Si no quedan notas disponibles, usar cualquiera
  if (allNotes.length === 0) {
    return 60 + Math.floor(Math.random() * 12);
  }
  return allNotes[Math.floor(Math.random() * allNotes.length)];
}

/**
 * Assigna notes MIDI als intervals (totes les notes diferents)
 * Cap nota es repeteix dins de la mateixa seqüència
 * @param {number[]} intervals - Array de duracions dels intervals
 * @returns {number[]} - Array de notes MIDI (una per cada interval, totes úniques)
 */
function assignNotesToIntervals(intervals) {
  if (intervals.length === 0) return [];
  const notes = [];
  const usedNotes = new Set();
  for (let i = 0; i < intervals.length; i++) {
    const note = getRandomMidiNote(usedNotes);
    notes.push(note);
    usedNotes.add(note);
  }
  return notes;
}

/**
 * Reproduce una nota melódica con el instrumento seleccionado
 * @param {number} midiNumber - Número MIDI (60-71 para registro 4)
 * @param {number} durationSec - Duración en segundos
 */
async function playMelodicNote(midiNumber, durationSec) {
  if (currentInstrument === 'flute') {
    const { playNote } = await import('../../libs/sound/flute.js');
    await playNote(midiNumber, durationSec);
  } else {
    const { playNote } = await import('../../libs/sound/piano.js');
    await playNote(midiNumber, durationSec);
  }
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
const _baseInitAudio = createMelodicAudioInitializer({
  defaultInstrument: 'piano'
});

async function initAudio() {
  if (!audio) {
    audio = await _baseInitAudio();
    if (typeof window !== 'undefined') {
      window.__labAudio = audio;
      window.NuzicAudioEngine = audio;
    }
  }
  return audio;
}

if (typeof window !== 'undefined') {
  window.__labInitAudio = initAudio;
}

/**
 * Reprodueix un click curt de metrònom usant l'AudioContext compartit
 * Usa el so seleccionat al dropdown "Pulso" del header
 * Passa pel bus master per respectar mute/fader del mixer
 */
async function playMetronomeClick() {
  if (!audio) return;
  try {
    await audio.playSound(currentMetronomeSound, 'pulse');
  } catch (err) {
    console.warn('Error reproduint metrònom:', err);
  }
}

// ========== EDITOR iT ==========
function createItEditor() {
  itEditor = document.createElement('div');
  itEditor.className = 'it-editor-bar';

  // Label "iT"
  const label = document.createElement('div');
  label.className = 'it-label';
  label.textContent = 'iT';
  itEditor.appendChild(label);

  // Cells container (1 cell per pulse)
  cellsContainer = document.createElement('div');
  cellsContainer.className = 'it-cells';

  // End marker (always last child, cells inserted before it)
  endMarker = document.createElement('div');
  endMarker.className = 'it-end-marker';
  cellsContainer.appendChild(endMarker);

  itEditor.appendChild(cellsContainer);

  // Tooltip (shared nuzic editor-tooltip style)
  tooltip = document.createElement('div');
  tooltip.className = 'editor-tooltip';
  document.body.appendChild(tooltip);

  // Initialize: first cell is the active input
  renderEditorCells();

  return itEditor;
}

function createReadonlyCell() {
  const cell = document.createElement('input');
  cell.type = 'text';
  cell.className = 'it-cell';
  cell.placeholder = ' ';
  cell.readOnly = true;
  return cell;
}

function focusValueCellAt(index) {
  const valueCells = cellsContainer.querySelectorAll('.it-end');
  if (valueCells[index]) {
    setTimeout(() => valueCells[index].focus(), 30);
    return true;
  }
  return false;
}

function focusInputCell() {
  const input = cellsContainer.querySelector('.it-input');
  if (input) setTimeout(() => input.focus(), 30);
}

function createValueCell(value, intervalIndex) {
  const cell = document.createElement('input');
  cell.type = 'text';
  cell.inputMode = 'numeric';
  cell.maxLength = 1;
  cell.className = 'it-cell it-end';
  cell.value = String(value);
  cell.placeholder = ' ';
  cell.readOnly = false;
  cell.dataset.intervalIndex = intervalIndex;

  let originalValue = cell.value;

  cell.addEventListener('focus', () => {
    originalValue = cell.value;
    hideTooltip();
    cell.select();
  });

  cell.addEventListener('keydown', (e) => {
    const valueCells = Array.from(cellsContainer.querySelectorAll('.it-end'));
    const myIdx = valueCells.indexOf(cell);

    if (e.key === 'Enter') { cell.blur(); return; }

    if (e.key === 'ArrowLeft' && myIdx > 0) {
      e.preventDefault();
      valueCells[myIdx - 1].focus();
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (myIdx < valueCells.length - 1) {
        valueCells[myIdx + 1].focus();
      } else {
        focusInputCell();
      }
      return;
    }

    // Delete interval: Backspace/Delete when cell empty OR text fully selected
    const allSelected = cell.value && cell.selectionStart === 0 && cell.selectionEnd === cell.value.length;
    if ((e.key === 'Backspace' || e.key === 'Delete') && (!cell.value || allSelected)) {
      e.preventDefault();
      const idx = parseInt(cell.dataset.intervalIndex);
      currentIntervals.splice(idx, 1);
      invalidateSoundAssignments();
      renderEditorCells();
      updateTimeline();
      // Focus previous value cell, or the input if it was the first
      if (idx > 0) {
        focusValueCellAt(idx - 1);
      } else {
        focusInputCell();
      }
    }
  });

  cell.addEventListener('blur', () => {
    const val = cell.value.trim();
    const idx = parseInt(cell.dataset.intervalIndex);

    // Empty or unchanged: restore
    if (!val || val === originalValue) {
      cell.value = originalValue;
      return;
    }

    if (!/^[1-8]$/.test(val)) {
      showTooltip(cell, 'iT: 1-8');
      cell.value = originalValue;
      return;
    }

    const num = parseInt(val);

    // Cascade validation: sum must stay ≤ MAX_LENGTH
    const oldVal = currentIntervals[idx];
    const newSum = getCurrentSum() - oldVal + num;
    if (newSum > MAX_LENGTH) {
      const maxAllowed = MAX_LENGTH - (getCurrentSum() - oldVal);
      showTooltip(cell, `iT máximo: ${maxAllowed}`);
      cell.value = originalValue;
      return;
    }

    currentIntervals[idx] = num;
    invalidateSoundAssignments();
    renderEditorCells();
    updateTimeline();
  });

  return cell;
}

function createInputCell() {
  const cell = document.createElement('input');
  cell.type = 'text';
  cell.inputMode = 'numeric';
  cell.pattern = '[1-8]';
  cell.maxLength = 1;
  cell.className = 'it-cell it-input';
  cell.readOnly = false;

  cell.addEventListener('focus', () => hideTooltip());
  cell.addEventListener('input', handleInputCellType);
  cell.addEventListener('keydown', handleInputCellKeydown);

  return cell;
}

function handleInputCellType(e) {
  const input = e.target;
  const value = input.value;

  if (value === '') return;

  if (value === '0') {
    showTooltip(input, 'iT: 1-8');
    input.value = '';
    return;
  }
  if (!/^[1-8]$/.test(value)) {
    showTooltip(input, 'iT: 1-8');
    input.value = '';
    return;
  }

  if (currentIntervals.length >= MAX_ITS) {
    showTooltip(input, `Máximo ${MAX_ITS} intervalos`);
    input.value = '';
    return;
  }

  const numValue = parseInt(value);
  const sum = getCurrentSum();
  const maxAllowed = MAX_LENGTH - sum;

  if (numValue > maxAllowed) {
    showTooltip(input, `iT máximo: ${maxAllowed}`);
    input.value = '';
    return;
  }

  // Add interval
  currentIntervals.push(numValue);
  invalidateSoundAssignments();
  renderEditorCells();
  updateTimeline();

  // Focus next active input (if any)
  const nextInput = cellsContainer.querySelector('.it-input');
  if (nextInput) {
    setTimeout(() => nextInput.focus(), 30);
  } else if (getCurrentSum() === MAX_LENGTH) {
    showTooltip(input, 'Longitud completa');
  } else if (currentIntervals.length >= MAX_ITS) {
    showTooltip(input, `Máximo ${MAX_ITS} intervalos`);
  }
}

function handleInputCellKeydown(e) {
  if (e.key === 'Backspace' && !e.target.value) {
    e.preventDefault();
    if (currentIntervals.length > 0) {
      currentIntervals.pop();
      invalidateSoundAssignments();
      renderEditorCells();
      updateTimeline();
      focusInputCell();
    }
    return;
  }
  if (e.key === 'ArrowLeft') {
    const valueCells = cellsContainer.querySelectorAll('.it-end');
    if (valueCells.length > 0) {
      e.preventDefault();
      valueCells[valueCells.length - 1].focus();
    }
  }
}

/**
 * Re-render editor cells based on currentIntervals state.
 * Cells with values show white bg, extension cells show cream,
 * the next empty cell is the active input.
 */
function renderEditorCells() {
  itInputs = [];

  // Remove all existing cells (rebuild from scratch)
  cellsContainer.querySelectorAll('.it-cell').forEach(c => c.remove());

  const sum = getCurrentSum();

  // First cell: cream P0 (always present, aligned with pulse 0)
  cellsContainer.insertBefore(createReadonlyCell(), endMarker);

  // Build cells for each entered interval
  // Always 2 cells per interval: [value WHITE editable] + [1 cream separator]
  currentIntervals.forEach((iT, idx) => {
    if (iT <= 0) return;
    const valCell = createValueCell(iT, idx);
    cellsContainer.insertBefore(valCell, endMarker);
    itInputs.push(valCell);
    cellsContainer.insertBefore(createReadonlyCell(), endMarker);
  });

  // If sequence not full AND not at MAX_ITS: add active input + cream after
  const canAddMore = sum < MAX_LENGTH && currentIntervals.length < MAX_ITS;
  if (canAddMore) {
    const input = createInputCell();
    cellsContainer.insertBefore(input, endMarker);
    itInputs.push(input);
    cellsContainer.insertBefore(createReadonlyCell(), endMarker);

    // Auto-focus the input
    setTimeout(() => input.focus(), 30);
  }

  // End marker: visible when sequence is full (by sum or by count)
  endMarker.style.display = !canAddMore ? 'flex' : 'none';
}

function showTooltip(input, message) {
  if (!tooltip || !itEditor) return;

  tooltip.textContent = message;
  tooltip.className = 'editor-tooltip visible';

  // Posicionar sota l'editor sencer, aliniat amb la cel·la que l'ha disparat
  const editorRect = itEditor.getBoundingClientRect();
  const cellRect = input.getBoundingClientRect();
  tooltip.style.top = `${editorRect.bottom + 6}px`;
  tooltip.style.left = '0px';

  const tooltipWidth = tooltip.getBoundingClientRect().width;
  const margin = 8;
  const ideal = cellRect.left + cellRect.width / 2 - tooltipWidth / 2;
  const minLeft = Math.max(margin, editorRect.left);
  const maxLeft = Math.min(window.innerWidth - tooltipWidth - margin, editorRect.right - tooltipWidth);
  const clamped = Math.max(minLeft, Math.min(ideal, Math.max(minLeft, maxLeft)));
  tooltip.style.left = `${clamped}px`;

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
  currentIntervals = intervals.filter(v => v > 0);
  renderEditorCells();
  updateTimeline();
}

function clearEditor() {
  currentIntervals = [];
  renderEditorCells();
  updateTimeline();
}

function focusFirstInput() {
  const activeInput = itEditor?.querySelector('.it-input');
  if (activeInput) activeInput.focus();
}

// ========== TIMELINE ==========
function drawTimeline() {
  if (!timeline) return;

  timeline.innerHTML = '';

  // Crear 9 pulsos (0-8) — dots amagats pel tema nuzic
  for (let i = 0; i <= 8; i++) {
    const pulse = document.createElement('div');
    pulse.className = 'pulse';
    pulse.dataset.index = i;
    timeline.appendChild(pulse);
  }

  // Números de pulsos (0-8) — element principal amb tema nuzic.
  // L'últim pols es dibuixa com a `·` amb dobles guions (classe cycle-end)
  // i no sona a la seqüència (el bucle del metrònom ja acaba a p=7).
  for (let i = 0; i <= 8; i++) {
    const num = document.createElement('div');
    num.className = 'pulse-number';
    num.dataset.index = i;
    if (i === 8) {
      num.classList.add('cycle-end');
      num.textContent = '·';
    } else {
      num.textContent = i;
    }
    timeline.appendChild(num);
  }

  // Layout lineal
  layoutTimeline();
}

function layoutTimeline() {
  const numbers = timeline.querySelectorAll('.pulse-number');

  // Posicionar números de pulsos (element principal)
  numbers.forEach(n => {
    const idx = parseInt(n.dataset.index);
    const pct = (idx / (TOTAL_PULSES - 1)) * 100;
    n.style.left = pct + '%';
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

  // Número de duració (centrat dins la barra, color nuzic-dark per contrast)
  const label = document.createElement('span');
  label.className = 'interval-bar-visual__label';
  label.textContent = duration;
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
  const num = timeline.querySelector(`.pulse-number[data-index="${index}"]`);
  if (num) {
    num.classList.toggle('active', active);
  }
}

function clearPulseHighlights() {
  timeline.querySelectorAll('.pulse-number.active').forEach(p => p.classList.remove('active'));
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

  // Obtenir BPM del controlador (o default)
  const bpm = bpmController?.getValue() || DEFAULT_BPM;
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
  console.log(`BPM: ${bpm}, intervals: ${intervals.join(', ')}, instrument: ${currentInstrument}`);

  // Usar notes MIDI persistents (només regenerar si no existeixen o han canviat els intervals)
  // NOTA: Els colors es gestionen a updateTimeline() per persistència visual
  if (!currentSoundAssignments || currentSoundAssignments.length !== intervals.length) {
    currentSoundAssignments = assignNotesToIntervals(intervals);
  }
  const notesForThisPlay = currentSoundAssignments;
  // Usar colors ja assignats per updateTimeline()
  const colorsForThisPlay = currentColorAssignments || intervals.map((_, idx) => VIBRANT_COLORS[idx % VIBRANT_COLORS.length]);

  let currentPulse = 0;

  for (let i = 0; i < intervals.length; i++) {
    if (!isPlaying) break; // Per si s'ha aturat

    const iT = intervals[i];
    const duration = iT * beatDuration;
    const color = colorsForThisPlay[i];
    const midiNote = notesForThisPlay[i];

    // Crear barra animada
    createIntervalBar(currentPulse, iT, color, true);

    // Reproduir nota melòdica amb durada exacta
    playMelodicNote(midiNote, duration);

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

  // Crear editor iT DESPRÉS del timeline (no DINS perquè drawTimeline fa innerHTML='')
  const editor = createItEditor();
  timeline.insertAdjacentElement('afterend', editor);

  // Sync editor width with timeline (guaranteed alignment)
  const syncEditorWidth = () => {
    editor.style.width = `${timeline.offsetWidth}px`;
  };
  syncEditorWidth();
  new ResizeObserver(syncEditorWidth).observe(timeline);

  // Idle caret flash on iT editor
  initIdleCaretFlash({ targets: [editor] });

  // Carregar instrument guardat (el header usa localStorage amb clau per-app)
  const savedInstrument = localStorage.getItem('app13:selectedInstrument');
  if (savedInstrument) {
    currentInstrument = savedInstrument;
  }

  // Dibuixar timeline
  drawTimeline();

  // Setup controls
  setupControls();

  // BPM controller
  const inputBpm = document.getElementById('inputBpm');
  const bpmUp = document.getElementById('bpmUp');
  const bpmDown = document.getElementById('bpmDown');
  if (inputBpm && bpmUp && bpmDown) {
    bpmController = createBpmController({
      inputEl: inputBpm,
      upBtn: bpmUp,
      downBtn: bpmDown,
      min: MIN_BPM,
      max: MAX_BPM,
      defaultValue: DEFAULT_BPM,
      onChange: (bpm) => { if (isPlaying && audio) audio.setTempo(bpm); }
    });
    bpmController.attach();
  }

  // Reorder controls: Play, BPM, Random, Reset
  const bpmParam = document.getElementById('bpmParam');
  const controls = document.querySelector('.controls');
  if (controls) {
    // Remove all children, re-append in desired order
    const playBtn = controls.querySelector('.play') || document.getElementById('playBtn');
    const randomBtnEl = controls.querySelector('.random') || document.getElementById('randomBtn');
    const resetBtnEl = controls.querySelector('.reset') || document.getElementById('resetBtn');
    const randomMenu = controls.querySelector('.random-menu');

    // Clear controls
    while (controls.firstChild) controls.removeChild(controls.firstChild);

    // Re-append in order: Play, BPM, Random (+ menu), Reset
    if (playBtn) controls.appendChild(playBtn);
    if (bpmParam) controls.appendChild(bpmParam);
    if (randomBtnEl) controls.appendChild(randomBtnEl);
    if (randomMenu) controls.appendChild(randomMenu);
    if (resetBtnEl) controls.appendChild(resetBtnEl);
  }

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

  // Escoltar canvis d'instrument
  window.addEventListener('sharedui:instrument', (e) => {
    currentInstrument = e.detail.instrument;
    console.log(`Instrument seleccionat: ${currentInstrument}`);
    // Nota: El header ja guarda l'instrument a localStorage amb clau per-app
  });

  // Precargar audio engine tras primera interacción (reduce latencia en Play)
  const preloadOnFirstInteraction = async () => {
    document.removeEventListener('click', preloadOnFirstInteraction);
    document.removeEventListener('touchstart', preloadOnFirstInteraction);

    // Inicializar audio en background (carga Tone.js + instrumento)
    try {
      await initAudio();
      console.log('Audio preloaded on first interaction');
    } catch (err) {
      console.warn('Audio preload failed:', err);
    }
  };
  document.addEventListener('click', preloadOnFirstInteraction, { once: true });
  document.addEventListener('touchstart', preloadOnFirstInteraction, { once: true });

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
