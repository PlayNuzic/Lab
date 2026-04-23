// App14: Intervalo Sonoro - Editor de seqüències d'iS amb visualització
import { createSoundline } from '../../libs/app-common/soundline.js';
import { createNoteHighlightController } from '../../libs/app-common/note-highlight.js';
import { createMelodicAudioInitializer } from '../../libs/app-common/audio-init.js';
import { setupPianoPreload, isPianoLoaded } from '../../libs/sound/piano.js';
import { ensureToneLoaded } from '../../libs/sound/tone-loader.js';
import { initIdleCaretFlash } from '../../libs/app-common/idle-caret-flash.js';

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
let audio = null;
let currentIntervals = []; // Array de valors iS entrats
let currentHighlights = [];
let currentIntervalElements = [];
let activeAnimationTimeouts = []; // Track active animation timeouts

// Referències DOM
let isEditor = null;
let isInputsContainer = null;
let isInputs = [];
let playBtn = null;
let randomBtn = null;
let resetBtn = null;
let tooltip = null;
let tooltipTimeout = null;

// Get timeline element from template
const timeline = document.getElementById('timeline');
if (!timeline) throw new Error('Cannot find #timeline element');

// Remove .middle (controls are already inside .timeline-wrapper via template)
document.querySelector('.middle')?.remove();

// Create soundline container
const soundlineContainer = document.createElement('div');
soundlineContainer.className = 'soundline-container';
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
  // getNotePosition retorna la línia de divisió (en %), on ara es centra la nota visual
  const cellHeight = 100 / 12; // ≈ 8.33%

  const pos1 = soundline.getNotePosition(note1Index); // Línia de divisió origen
  const pos2 = soundline.getNotePosition(note2Index); // Línia de divisió destí

  // Determinar direcció: positiu (puja, note2 > note1) o negatiu (baixa)
  // En la soundline, nota 0 està a BAIX (% alt), nota 11 a DALT (% baix)
  const isAscending = note2Index > note1Index;

  // Línia de divisió a divisió (les notes es centren a les línies de divisió)
  let start1, end2;
  if (isAscending) {
    start1 = pos1; // Línia de divisió origen
    end2 = pos2;   // Línia de divisió destí
  } else {
    start1 = pos1; // Línia de divisió origen
    end2 = pos2;   // Línia de divisió destí
  }

  const intervalBar = document.createElement('div');
  intervalBar.className = 'interval-bar-vertical';
  intervalBar.style.position = 'absolute';
  intervalBar.style.left = 'calc(100% + 5.5rem)';
  intervalBar.style.width = '4px';

  // Padding per escurçar la barra i no tapar els números
  // Per intervals ±1: padding negatiu perquè la línia sobresurti i la fletxa quedi separada
  // Per altres intervals: 25% de cel·la a cada extrem
  const intervalSize = Math.abs(note2Index - note1Index);
  const padding = intervalSize === 1 ? cellHeight * -0.3 : cellHeight * 0.25;

  // Alçada final: distància entre els punts menys el padding als dos extrems
  // (si padding és negatiu, la línia serà més llarga)
  const fullHeight = Math.abs(start1 - end2);
  const finalHeight = fullHeight - (padding * 2);

  // Durada de l'animació en segons (per defecte 2 beats)
  const animationDuration = (60 / FIXED_BPM) * durationBeats;

  // Delay abans de començar l'animació (1 beat per defecte)
  const delayMs = (60 / FIXED_BPM) * delayBeats * 1000;

  // Afegir classe per direcció (per CSS arrow)
  intervalBar.classList.add(isAscending ? 'ascending' : 'descending');

  if (isAscending) {
    // Interval positiu: nota puja (de baix a dalt en pantalla)
    // Posicionem el BOTTOM de la barra al punt d'inici - padding (més avall)
    const bottomPos = 100 - start1 + padding;
    intervalBar.style.bottom = `${bottomPos}%`;
    intervalBar.style.setProperty('top', 'auto', 'important');
    intervalBar.style.height = '0%';
  } else {
    // Interval negatiu: nota baixa (de dalt a baix en pantalla)
    // Posicionem el TOP de la barra al punt d'inici + padding (més avall)
    intervalBar.style.setProperty('top', `${start1 + padding}%`, 'important');
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

  const isAscending = interval > 0;
  const cellHeight = 100 / 12;

  // Calculate positions directly (same formula as getNotePosition/layoutSoundline)
  const calcPos = (idx) => 100 - ((idx + 0.5) / 12) * 100;
  const pos1 = calcPos(note1Index);
  const pos2 = calcPos(note2Index);

  // Vertical position depends on interval size and direction
  let numberY;
  if (absInterval === 0) {
    numberY = pos1;
  } else if (absInterval === 1) {
    // ±1: shift towards destination to avoid overlap with short bar
    numberY = isAscending
      ? Math.min(pos1, pos2) + cellHeight * 0.3
      : Math.max(pos1, pos2) - cellHeight * 0.3;
  } else {
    // Center between the two notes
    numberY = (pos1 + pos2) / 2;
  }

  const delayMs = (60 / FIXED_BPM) * delayBeats * 1000;

  const intervalNum = document.createElement('div');
  intervalNum.className = 'interval-number';
  intervalNum.textContent = `${direction}${absInterval}`;
  intervalNum.style.position = 'absolute';
  intervalNum.style.setProperty('top', `${numberY}%`, 'important');
  intervalNum.style.transform = 'translateY(-50%)';
  intervalNum.style.opacity = '0';

  // Horizontal: bar is at calc(100% + 5.5rem), number to its right
  if (absInterval <= 1) {
    intervalNum.style.left = 'calc(100% + 7rem)';
  } else if (isAscending) {
    // Ascending: number LEFT of bar
    intervalNum.style.left = 'calc(100% + 3.5rem)';
  } else {
    // Descending: number RIGHT of bar
    intervalNum.style.left = 'calc(100% + 7rem)';
  }

  soundline.element.appendChild(intervalNum);
  currentIntervalElements.push(intervalNum);

  // Mostrar després del delay
  const timeoutId = setTimeout(() => {
    intervalNum.style.transition = 'opacity 0.2s ease';
    intervalNum.style.opacity = '1';
  }, delayMs);
  activeAnimationTimeouts.push(timeoutId);
}

// ========== NUZIC iS EDITOR ==========
let cellsContainer = null;
let endMarker = null;
let autoJumpTimer = null;

function createNuzicIsEditor() {
  isEditor = document.createElement('div');
  isEditor.className = 'is-editor-bar';

  const label = document.createElement('div');
  label.className = 'editor-label editor-label--is';
  label.textContent = 'iS';
  isEditor.appendChild(label);

  cellsContainer = document.createElement('div');
  cellsContainer.className = 'editor-cells';
  endMarker = document.createElement('div');
  endMarker.className = 'editor-end-marker';
  cellsContainer.appendChild(endMarker);
  isEditor.appendChild(cellsContainer);

  tooltip = document.createElement('div');
  tooltip.className = 'editor-tooltip';
  document.body.appendChild(tooltip);

  renderEditorCells();
  return isEditor;
}

function createReadonlyCell() {
  const cell = document.createElement('input');
  cell.type = 'text';
  cell.className = 'editor-cell editor-cell--is';
  cell.placeholder = ' ';
  cell.readOnly = true;
  return cell;
}

function createValueCell(displayValue, intervalIndex) {
  const cell = document.createElement('input');
  cell.type = 'text';
  cell.inputMode = 'numeric';
  cell.maxLength = 3;
  cell.className = 'editor-cell editor-cell--is it-end';
  cell.value = String(displayValue);
  cell.placeholder = ' ';
  cell.readOnly = false;
  cell.dataset.intervalIndex = intervalIndex;

  let originalValue = cell.value;

  cell.addEventListener('focus', () => {
    originalValue = cell.value;
    cell.select();
  });

  cell.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { cell.blur(); return; }
    // Arrow key navigation between value cells (legacy feature)
    const valueCells = Array.from(cellsContainer.querySelectorAll('.it-end'));
    const myIdx = valueCells.indexOf(cell);
    if (e.key === 'ArrowLeft' && myIdx > 0) {
      e.preventDefault();
      valueCells[myIdx - 1].focus();
    } else if (e.key === 'ArrowRight' && myIdx < valueCells.length - 1) {
      e.preventDefault();
      valueCells[myIdx + 1].focus();
    }
  });

  cell.addEventListener('blur', () => {
    const val = cell.value.trim();
    if (!val || val === originalValue) { cell.value = originalValue; return; }
    if (!/^[+-]?\d+$/.test(val)) { cell.value = originalValue; return; }

    const num = parseInt(val);
    const idx = parseInt(cell.dataset.intervalIndex);
    const isFirst = idx === 0;

    if (isFirst && num < 0) {
      showTooltip(cell, 'Primer iS ≥ 0');
      cell.value = originalValue;
      return;
    }

    // Cascade validation: check all notes stay in [0,11]
    const oldVal = currentIntervals[idx];
    currentIntervals[idx] = num;
    let note = 0;
    let valid = true;
    for (const iv of currentIntervals) {
      if (iv === undefined) break;
      note += iv;
      if (note < MIN_NOTE || note > MAX_NOTE) { valid = false; break; }
    }
    if (!valid) {
      currentIntervals[idx] = oldVal;
      showTooltip(cell, 'Valor invalida seqüència');
      cell.value = originalValue;
      return;
    }

    renderEditorCells();
  });

  return cell;
}

function createInputCell() {
  const cell = document.createElement('input');
  cell.type = 'text';
  cell.inputMode = 'numeric';
  cell.maxLength = 3;
  cell.className = 'editor-cell editor-cell--is editor-input';
  cell.readOnly = false;

  cell.addEventListener('input', (e) => {
    const val = e.target.value;
    if (val === '' || val === '-' || val === '+') return;
    if (!/^-?\d+$/.test(val)) { e.target.value = ''; return; }

    const num = parseInt(val);
    const isFirst = getValidIntervals().length === 0;

    if (isFirst && num < 0) {
      showTooltip(cell, 'Primer iS ≥ 0');
      e.target.value = '';
      clearTimeout(autoJumpTimer);
      return;
    }

    // Check note range
    let curNote = 0;
    for (const iv of currentIntervals) {
      if (iv === undefined) break;
      curNote += iv;
    }
    const newNote = curNote + num;
    if (newNote < MIN_NOTE || newNote > MAX_NOTE) {
      const maxUp = MAX_NOTE - curNote;
      const maxDown = MIN_NOTE - curNote;
      showTooltip(cell, `iS: ${maxDown} a +${maxUp}`);
      e.target.value = '';
      clearTimeout(autoJumpTimer);
      return;
    }

    // Commit after delay (allows 2-digit input like "11", "-5")
    clearTimeout(autoJumpTimer);
    autoJumpTimer = setTimeout(() => {
      currentIntervals.push(num);
      renderEditorCells();
      // Auto-focus next input
      const nextInput = cellsContainer.querySelector('.editor-input');
      if (nextInput) setTimeout(() => nextInput.focus(), 30);
      else if (getValidIntervals().length >= MAX_IS) {
        showTooltip(endMarker, 'Seqüència completa');
      }
    }, 500);
  });

  cell.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && !e.target.value) {
      e.preventDefault();
      clearTimeout(autoJumpTimer);
      if (currentIntervals.length > 0) {
        currentIntervals.pop();
        renderEditorCells();
        const input = cellsContainer.querySelector('.editor-input');
        if (input) setTimeout(() => input.focus(), 30);
      }
    }
  });

  return cell;
}

function renderEditorCells() {
  cellsContainer.querySelectorAll('.editor-cell').forEach(c => c.remove());

  const intervals = getValidIntervals();

  // Committed values: [pink][value][pink] per group
  for (let i = 0; i < intervals.length; i++) {
    const display = intervals[i] > 0 ? `+${intervals[i]}` : String(intervals[i]);
    cellsContainer.insertBefore(createReadonlyCell(), endMarker); // pink before
    cellsContainer.insertBefore(createValueCell(display, i), endMarker); // value
    if (i < intervals.length - 1 || intervals.length < MAX_IS) {
      cellsContainer.insertBefore(createReadonlyCell(), endMarker); // pink after
    }
  }

  // Input for next value
  if (intervals.length < MAX_IS) {
    cellsContainer.insertBefore(createReadonlyCell(), endMarker); // pink before
    cellsContainer.insertBefore(createInputCell(), endMarker); // input
    cellsContainer.insertBefore(createReadonlyCell(), endMarker); // pink after
  }

  endMarker.style.display = intervals.length >= MAX_IS ? 'flex' : 'none';
}

function getValidIntervals() {
  return currentIntervals.filter(v => v !== undefined);
}

function showTooltip(anchor, message) {
  if (!tooltip) return;
  tooltip.textContent = message;
  tooltip.className = 'editor-tooltip visible';
  const rect = anchor.getBoundingClientRect();
  tooltip.style.left = `${rect.left}px`;
  tooltip.style.top = `${rect.bottom + 4}px`;
  clearTimeout(tooltipTimeout);
  tooltipTimeout = setTimeout(hideTooltip, 2000);
}

function hideTooltip() {
  if (tooltip) tooltip.classList.remove('visible');
}

function getIntervalsFromEditor() {
  return getValidIntervals();
}

function setIntervalsToEditor(intervals) {
  currentIntervals = [...intervals];
  renderEditorCells();
}

function clearEditor() {
  currentIntervals = [];
  renderEditorCells();
}

function focusFirstInput() {
  const input = cellsContainer?.querySelector('.editor-input');
  if (input) input.focus();
}

// ========== AUDIO ==========
// Route audio through the shared MelodicTimelineAudio engine so the piano
// sampler lands on the mixer's `melodic` channel (which carries the FX
// chain, including reverb). This keeps volume/mute consistent with every
// other Lab app: the header dispatches `sharedui:volume`/`sharedui:mute`
// and the shared mixer handles them globally — no per-app handler needed.
const _initAudio = createMelodicAudioInitializer({
  defaultInstrument: 'piano'
});

let audioInitialized = false;

async function initializeAudio() {
  if (audioInitialized) return;
  audioInitialized = true;

  try {
    await ensureToneLoaded();
    audio = await _initAudio();
    // Expose so the header's volume/mute plumbing can locate this instance.
    if (typeof window !== 'undefined') window.__labAudio = audio;
  } catch (error) {
    console.error('Error initializing audio:', error);
  }
}

// ========== INPUT HIGHLIGHT ==========
function highlightInput(index) {
  const valueCells = cellsContainer?.querySelectorAll('.it-end');
  if (valueCells && valueCells[index]) {
    valueCells[index].classList.add('input-active');
  }
}

function clearInputHighlights() {
  cellsContainer?.querySelectorAll('.input-active').forEach(c => c.classList.remove('input-active'));
}

// ========== REPRODUCCIÓ ==========
async function handlePlay() {
  // Si ja estem reproduint, STOP
  if (isPlaying) {
    isPlaying = false;
    userStopped = true; // Marcar que l'usuari ha parat manualment
    updateControlsState();
    clearInputHighlights();
    return;
  }

  const intervals = getIntervalsFromEditor();

  // Si editor buit, mostrar avís
  if (intervals.length === 0) {
    const input = cellsContainer?.querySelector('.editor-input');
    if (input) showTooltip(input, 'Introduce al menos un intervalo');
    return;
  }

  // Show loading indicator if piano not yet loaded
  const playIcon = playBtn?.querySelector('.icon-play');
  if (!isPianoLoaded() && playIcon) {
    playIcon.style.opacity = '0.5';
  }

  await initializeAudio();

  // Restore button opacity after loading
  if (playIcon) {
    playIcon.style.opacity = '1';
  }

  if (!audio) return;

  isPlaying = true;
  userStopped = false; // Reset flag per nova reproducció
  updateControlsState();

  // Netejar visualització anterior i timeouts pendents
  activeAnimationTimeouts.forEach(id => clearTimeout(id));
  activeAnimationTimeouts = [];
  clearHighlights();
  clearIntervalElements();
  clearInputHighlights();

  try {
    const Tone = window.Tone;
    const beatSec = 60 / FIXED_BPM;

    // Nota inicial sempre 0
    let currentNote = getStartingNote();

    // Reproduir cada parell d'interval
    // Parell i: nota[i] → nota[i+1] amb iS[i]
    // - Primer parell (i=0): nota0 (1 beat) → nota1 (2 beats)
    // - Parells següents (i>0): repetir nota[i] (1 beat) → nota[i+1] (2 beats)
    for (let i = 0; i < intervals.length; i++) {
      if (!isPlaying) break;

      const iS = intervals[i];
      const originNote = currentNote;
      const destNote = currentNote + iS;

      // Validar que la nota resultant està dins del rang
      if (destNote < MIN_NOTE || destNote > MAX_NOTE) {
        console.warn(`Nota ${destNote} fora de rang, aturant`);
        break;
      }

      // Netejar elements anteriors
      clearIntervalElements();
      clearHighlights();
      clearInputHighlights();

      // Il·luminar l'input corresponent a aquest parell
      highlightInput(i);

      // Si NO és el primer parell, repetir la nota origen (1 beat)
      if (i > 0) {
        audio.playNote(START_MIDI + originNote, beatSec * 0.9, Tone.now());
        highlightController.highlightNote(originNote, 999999);
        currentHighlights.push(originNote);
        await sleep(beatSec * 1000);
        if (!isPlaying) break;
      } else {
        // Primer parell: tocar nota origen (1 beat)
        audio.playNote(START_MIDI + originNote, beatSec * 0.9, Tone.now());
        highlightController.highlightNote(originNote, 999999);
        currentHighlights.push(originNote);
        await sleep(beatSec * 1000);
        if (!isPlaying) break;
      }

      // Mostrar interval (línia i número) - animació comença ara
      if (originNote !== destNote) {
        createIntervalLine(originNote, destNote, 0, 2); // delay 0, durada 2 beats
      }
      showIntervalNumber(originNote, destNote, 0); // delay 0

      // Tocar nota destí (2 beats)
      audio.playNote(START_MIDI + destNote, beatSec * 2 * 0.9, Tone.now());
      highlightController.highlightNote(destNote, 999999);
      if (destNote !== originNote) {
        currentHighlights.push(destNote);
      }

      await sleep(beatSec * 2 * 1000);

      // Actualitzar nota actual per al següent parell
      currentNote = destNote;
    }

  } catch (error) {
    console.error('Error playing sequence:', error);
  }

  isPlaying = false;
  clearInputHighlights();
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

  // Setup piano preload
  setupPianoPreload({ delay: 300 });

  // Create single-column layout wrapper
  const appRoot = document.getElementById('app-root');
  const mainElement = appRoot?.querySelector('main');
  const layoutWrapper = document.createElement('div');
  layoutWrapper.className = 'app14-main-layout';

  // Move soundline area (fills vertical space)
  const timelineWrapper = timeline.parentElement;
  if (timelineWrapper) {
    timelineWrapper.className = 'soundline-area';
    timelineWrapper.removeAttribute('style');
    layoutWrapper.appendChild(timelineWrapper);
  }

  // Create nuzic iS editor INSIDE soundline area (just below the soundline)
  const editor = createNuzicIsEditor();
  if (timelineWrapper) {
    timelineWrapper.appendChild(editor);
  } else {
    layoutWrapper.appendChild(editor);
  }

  // Controls are inside timelineWrapper (from template) — reorder children
  // and move controls AFTER editor (appendChild moves existing element)
  const controls = timelineWrapper?.querySelector('.controls');
  if (controls) {
    const playBtnEl = controls.querySelector('.play') || document.getElementById('playBtn');
    const randomBtnEl = controls.querySelector('.random');
    const resetBtnEl = controls.querySelector('.reset');

    while (controls.firstChild) controls.removeChild(controls.firstChild);

    if (playBtnEl) controls.appendChild(playBtnEl);
    if (randomBtnEl) controls.appendChild(randomBtnEl);
    if (resetBtnEl) controls.appendChild(resetBtnEl);

    // appendChild moves it to the end (after editor)
    timelineWrapper.appendChild(controls);
  }

  if (mainElement) {
    mainElement.appendChild(layoutWrapper);
  } else {
    appRoot.appendChild(layoutWrapper);
  }

  // Idle caret flash on iS editor
  initIdleCaretFlash({ targets: [editor] });

  // Setup controls
  setupControls();

  // Focus inicial
  setTimeout(focusFirstInput, 100);

  console.log('App14 inicialitzada');
}

// Cleanup: the shared MelodicTimelineAudio instance manages its own
// Tone.js resources (sampler + effects chain) — no explicit dispose needed.

// Executar quan el DOM estigui llest
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
