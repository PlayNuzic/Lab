// App35: Plano con Fracción Compleja y sucesión N-iT
// Basat en App34 (N-iT editor inline d'App20) + adaptacions d'App33 (complex).
// Lg = floor(BASE_LG/n) * n variable; numerador n=2-6, denominador d=2-8.
// Grid 2D amb 12 notes (0-11) + soundline + editor N-iT sota el grid.
// Àudio melòdic amb selector d'instrument + so de cicle.

import { getMixer } from '../../libs/sound/index.js';
import { createMelodicAudioInitializer, setupAudioDefaults, CHANNEL_TIERS } from '../../libs/app-common/audio-init.js';
import { bindSharedSoundEvents } from '../../libs/app-common/audio.js';
import { initMixerMenu } from '../../libs/app-common/mixer-menu.js';
import { createPreferenceStorage, registerFactoryReset, setupThemeSync, setupMutePersistence } from '../../libs/app-common/preferences.js';
import createFractionEditor from '../../libs/app-common/fraction-editor.js';
import { attachHover } from '../../libs/shared-ui/hover.js';
import { showValidationWarning } from '../../libs/app-common/info-tooltip.js';
import {
  buildGridDOM,
  updateSoundline,
  updateMatrix
} from '../../libs/plano-modular/plano-grid.js';
import { createPlayheadController } from '../../libs/plano-modular/plano-playhead.js';
import { createBpmController } from '../../libs/app-common/bpm-controller.js';
import { addRepeatPress } from '../../libs/app-common/spinner-repeat.js';
import { setupScrollSync } from '../../libs/plano-modular/plano-scroll.js';
import { buildSimple12Rows } from '../../libs/app-common/plano-grid-rows.js';
import {
  calculateVariableLg as _calcLg,
  getTotalSubdivisions as _getTotalSubdivs,
  filterInvalidNotes as _filterInvalid
} from '../../libs/plano-fraccion/fraction-math.js';
import { renderNoteBars, removeOverlappingNotes as _removeOverlapping } from '../../libs/app-common/plano-note-renderer.js';
import { renderGhostPulseLines } from '../../libs/plano-fraccion/ghost-pulse.js';
import { gcd } from '../../libs/app-common/number-utils.js';
import { initIdleCaretFlash } from '../../libs/app-common/idle-caret-flash.js';
import { createIntervalLabelBar } from '../../libs/shared-ui/interval-label-bar.js';
import { setupRandomMenu } from '../../libs/random/menu.js';
import { reorderControls } from '../../libs/app-common/template.js';

// ========== CONSTANTS ==========
const BASE_LG = 12;              // Reference length (max pulses)
const DEFAULT_BPM = 60;
const MIN_BPM = 50;
const MAX_BPM = 150;
const DEFAULT_NUMERATOR = 2;     // 2/3 by default
const DEFAULT_DENOMINATOR = 3;
const MIN_NUMERATOR = 2;
const MAX_NUMERATOR = 6;
const MIN_DENOMINATOR = 2;       // min 2 for complex fractions
const MAX_DENOMINATOR = 8;

// Colors per rectangles iT
// Color únic per als note-bars: blau clar (`--nuzic-blue-light`) com a
// apps de plànol anteriors (App19/App20/App32/App33/App34). El highlight
// durant playback usa el blau intens via CSS box-shadow.
const VIBRANT_COLORS = ['#bdd9e6'];

// Notes per àudio
const NOTE_COUNT = 12;       // 12 notes (0-11)
const BASE_MIDI = 48;        // C3 = 48

// ========== STATE ==========
let audio = null;
let isPlaying = false;
let bpmController = null;
let currentNumerator = DEFAULT_NUMERATOR;
let currentDenominator = DEFAULT_DENOMINATOR;
let currentLg = BASE_LG;  // Recomputed via _calcLg whenever the numerator changes

// Notes array: { note: 0-11, startSubdiv: number, duration: number }
let notes = [];

// Grid elements
let gridElements = null;
let cellWidth = 40;
let playheadController = null;

// DOM elements
// Timeline-integer and fraction labels inside the plano grid (used for highlight during playback).
let gridIntegerLabels = [];
let gridFractionLabels = [];
let noteBars = [];     // Rectangles notes al grid

// Controllers
let fractionEditorController = null;
let randomMenu = null;  // Long-press random menu controller (read())

// Drag state
let dragState = {
  active: false,
  startSubdiv: null,
  currentSubdiv: null,
  maxSubdiv: null,
  previewBar: null
};

// Playback state
let playbackAbort = null;
let currentMetronomeSound = (() => {
  try {
    const stored = localStorage.getItem('baseSound');
    return stored || 'click9';
  } catch {
    return 'click9';
  }
})();

// ========== PREFERENCE STORAGE ==========
const preferenceStorage = createPreferenceStorage({ prefix: 'app35', separator: '::' });
const { load: loadOpt, save: saveOpt, clear: clearOpt } = preferenceStorage;

registerFactoryReset({
  storage: preferenceStorage,
  onBeforeReload: () => {}
});

// ========== SOUND EVENTS ==========
bindSharedSoundEvents({
  getAudio: () => audio,
  mapping: {
    baseSound: 'setBase',
    cycleSound: 'setCycle'
  }
});

// Listen for metronome sound changes
window.addEventListener('sharedui:baseSound', (e) => {
  if (e.detail?.sound) {
    currentMetronomeSound = e.detail.sound;
  }
});

// Listen for instrument changes - sync with audio engine
window.addEventListener('sharedui:instrument', async (e) => {
  if (e.detail?.instrument && audio && audio.setInstrument) {
    await audio.setInstrument(e.detail.instrument);
  }
});

// ========== DOM ELEMENTS ==========
const timelineWrapper = document.getElementById('timelineWrapper');
const playBtn = document.getElementById('playBtn');
const randomBtn = document.getElementById('randomBtn');
const resetBtn = document.getElementById('resetBtn');
const themeSelect = document.getElementById('themeSelect');
const baseSoundSelect = document.getElementById('baseSoundSelect');
const cycleSoundSelect = document.getElementById('cycleSoundSelect');
const mixerMenu = document.getElementById('mixerMenu');

// .middle layout elements (fraction slot + info pastilles in .middle).
let fractionSlot = null;
let sumDisplay = null;
let availableDisplay = null;
let zigzagEditor = null;

// ========== HOVER TOOLTIPS ==========
if (playBtn) attachHover(playBtn, { text: 'Play / Stop' });
if (randomBtn) attachHover(randomBtn, { text: 'Aleatorizar fracción y notas' });
if (resetBtn) attachHover(resetBtn, { text: 'Reset App' });

// ========== MIXER SETUP ==========
// Canals registrats al motor; setupAudioDefaults dins initAudio() els
// personalitza via CHANNEL_TIERS.MELODIC_FULL.
const globalMixer = getMixer();

// ========== THEME & MUTE PERSISTENCE ==========
const muteButton = document.getElementById('muteBtn');
setupThemeSync({ storage: preferenceStorage, selectEl: themeSelect });
setupMutePersistence({
  storage: preferenceStorage,
  getAudioInstance: () => audio,
  muteButton
});

// ========== MIXER MENU ==========
const mixerTriggers = [playBtn].filter(Boolean);

initMixerMenu({
  menu: mixerMenu,
  triggers: mixerTriggers,
  channels: [
    { id: 'start', label: 'P0', allowSolo: true },
    { id: 'pulse', label: 'Pulso', allowSolo: true },
    { id: 'subdivision', label: 'Subdivisión', allowSolo: true },
    { id: 'instrument', label: 'Instrumento', allowSolo: true },
    { id: 'master', label: 'Master', allowSolo: false, isMaster: true }
  ]
});

// ========== AUDIO INITIALIZATION ==========
const _baseInitAudio = createMelodicAudioInitializer({
  defaultInstrument: 'piano'
});

async function initAudio() {
  if (!audio) {
    audio = await _baseInitAudio();
    if (audio) {
      setupAudioDefaults(audio, { channels: CHANNEL_TIERS.MELODIC_FULL });
    }

    // Apply saved mute state
    const savedMute = loadOpt('mute');
    if (audio && savedMute === '1' && typeof audio.setMute === 'function') {
      audio.setMute(true);
    }

    // Configure sounds from dropdowns (like createRhythmAudioInitializer does)
    // This ensures the metronome and cycle sounds are properly initialized
    if (audio && baseSoundSelect?.dataset?.value && typeof audio.setBase === 'function') {
      await audio.setBase(baseSoundSelect.dataset.value);
    }
    if (audio && cycleSoundSelect?.dataset?.value && typeof audio.setCycle === 'function') {
      await audio.setCycle(cycleSoundSelect.dataset.value);
    }

    if (typeof window !== 'undefined') {
      window.__labAudio = audio;
      window.NuzicAudioEngine = audio;
    }
  }
  return audio;
}

if (typeof window !== 'undefined') {
  window.__labInitAudio = initAudio;
  // Initialize audio on first interaction to ensure NuzicAudioEngine is ready
  // before instrument-dropdown tries to preload instruments
  document.addEventListener('click', () => initAudio(), { once: true });
  document.addEventListener('touchstart', () => initAudio(), { once: true });
}

// ========== UTILITY FUNCTIONS ==========

function getTotalSubdivisions() {
  return _getTotalSubdivs(currentLg, currentNumerator, currentDenominator);
}

// ========== GRID HELPERS ==========

/**
 * Compute current cell width by reading the actual rendered cell's offsetWidth.
 * With columnSizing='fr' the grid fills all horizontal space, so cell width is
 * dynamic and must be read from the DOM after render (not computed ahead).
 * Returns 40 as fallback before first render.
 */
function calculateCellWidth() {
  const matrix = gridElements?.matrixContainer?.querySelector('.plano-matrix');
  const firstCell = matrix?.querySelector('.plano-cell');
  return firstCell?.offsetWidth || 40;
}

// ========== MIDDLE LAYOUT (info pastilles + fraction) ==========
// LU-04: la fracció va ANCORADA A L'ESQUERRA de `.middle` i el grup de
// pastilles d'info a la dreta en absolut (Patró App30 — vegeu styles.css
// `.middle`). Els comentaris antics deien "fraction centered": era l'estat
// previ a la migració, el CSS actual no centra res.
function buildMiddleLayout() {
  const middle = document.querySelector('.middle');
  if (!middle) return null;

  middle.innerHTML = '';
  middle.classList.add('app35-middle');

  // Info pastilles group
  const infoGroup = document.createElement('div');
  infoGroup.className = 'itfr-info-group';

  const sumBox = document.createElement('div');
  sumBox.className = 'bpm-inline visible param sum-it';
  sumBox.innerHTML = `
    <span class="abbr">Suma iT</span>
    <div class="circle">
      <input id="sumItDisplay" type="text" value="0" readonly />
    </div>
  `;

  const dispBox = document.createElement('div');
  dispBox.className = 'bpm-inline visible param it-disponibles';
  dispBox.innerHTML = `
    <span class="abbr">iT Disponibles</span>
    <div class="circle">
      <input id="itDisponiblesDisplay" type="text" value="0" readonly />
    </div>
  `;

  infoGroup.appendChild(sumBox);
  infoGroup.appendChild(dispBox);
  middle.appendChild(infoGroup);

  // Fraction slot (center column)
  fractionSlot = document.createElement('div');
  fractionSlot.className = 'itfr-fraction-slot';
  middle.appendChild(fractionSlot);

  // Resolve info displays
  sumDisplay = document.getElementById('sumItDisplay');
  availableDisplay = document.getElementById('itDisponiblesDisplay');

  return middle;
}

/**
 * Update info displays (iT disponibles i suma iT)
 * - Suma iT: total de columnes ocupades (suma de durades de totes les notes)
 * - iT Disponibles: columnes lliures (total - ocupades)
 */
function updateInfoDisplays() {
  const totalColumns = getTotalSubdivisions();

  // Suma iT: sum of all note durations (each column = 1 iT)
  const usedColumns = notes.reduce((sum, n) => sum + n.duration, 0);

  // iT Disponibles: total - used
  const available = totalColumns - usedColumns;

  if (availableDisplay) {
    availableDisplay.value = String(available);
  }
  if (sumDisplay) {
    sumDisplay.value = String(usedColumns);
  }
}

function createGrid() {
  // Create grid container AFTER timeline-wrapper (nuzic order: timeline →
  // grid → editor → controls; here there's no editor so grid becomes the
  // dominant visual element, replacing the timeline).
  let gridContainer = document.getElementById('gridContainer');
  if (!gridContainer) {
    gridContainer = document.createElement('div');
    gridContainer.id = 'gridContainer';
    gridContainer.className = 'grid-container';
    if (timelineWrapper && timelineWrapper.parentNode) {
      timelineWrapper.parentNode.insertBefore(gridContainer, timelineWrapper.nextSibling);
    }
  }

  // Build grid DOM
  gridElements = buildGridDOM(gridContainer);

  // ResizeObserver: refresh cellWidth on viewport changes so note bars
  // stay aligned with the dynamic 1fr columns. Debounced via rAF.
  if (gridElements?.matrixContainer && typeof ResizeObserver !== 'undefined') {
    let rafId = 0;
    const ro = new ResizeObserver(() => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        cellWidth = calculateCellWidth();
        renderNotes();
        renderGhostLines();
      });
    });
    ro.observe(gridElements.matrixContainer);
  }

  // Create playhead controller. With columnSizing='fr' we pass 0 so the
  // controller uses DOM-based positioning (cell.offsetLeft) — see
  // plano-playhead.js line 42-51.
  // `domOffset: -1` perquè el playhead caigui exactament a
  // `cell.offsetLeft` (alineat amb el pulse-number, igual que App33/App34).
  playheadController = createPlayheadController(
    gridElements.matrixContainer,
    () => 0,
    0,
    -1  // domOffset
  );

  // Cancel·lar `marginLeft: -4px` heretat de createPlayhead.
  const playheadEl = gridElements.matrixContainer.querySelector('.plano-playhead');
  if (playheadEl) playheadEl.style.marginLeft = '0';

  renderGrid();
}

function renderGrid() {
  if (!gridElements) return;

  const rows = buildSimple12Rows();
  const columns = getTotalSubdivisions();

  // Update soundline (Y-axis: notes 11 to 0)
  updateSoundline(gridElements.soundlineContainer, rows);

  // Update matrix with columnSizing='fr' — cells fill all horizontal space.
  updateMatrix(gridElements.matrixContainer, rows, columns, {
    columnSizing: 'fr',
    onCellClick: null
  });

  const n = currentNumerator;
  const d = currentDenominator;

  // Mark integer-pulse cells. In complex fractions each cell is n/d pulses,
  // so integer pulses occur where `(colIndex * n) % d === 0`. For n=1 this
  // reduces to `colIndex % d === 0` (simple-fraction case).
  const cells = gridElements.matrixContainer.querySelectorAll('.plano-cell');
  cells.forEach(cell => {
    const colIndex = parseInt(cell.dataset.colIndex, 10);
    if ((colIndex * n) % d === 0) {
      cell.classList.add('pulse-boundary');
    }
  });

  // Render fractional timeline in grid
  renderGridTimeline();

  // Read actual cell width from DOM now that grid is rendered.
  cellWidth = calculateCellWidth();

  // Ghost pulse lines: vertical markers for integer pulses that don't land
  // on a grid cell boundary (they fall between cells because each cell is
  // n/d pulses wide). E.g. with 2/3, pulses 1, 3, 5, ... are ghost.
  renderGhostLines();

  // Attach drag handlers to cells
  attachGridDragHandlers();

  // Sync scroll
  syncGridScrolls();

  // Render existing notes (uses cellWidth for positioning bars).
  renderNotes();

  // Update info displays
  updateInfoDisplays();
}

function renderGhostLines() {
  const matrix = gridElements?.matrixContainer?.querySelector('.plano-matrix');
  if (!matrix || !cellWidth) return;
  renderGhostPulseLines(matrix, {
    lg: currentLg,
    numerator: currentNumerator,
    denominator: currentDenominator,
    cellWidth
  });
}

function renderGridTimeline() {
  const container = gridElements?.timelineContainer;
  if (!container) return;

  const columns = getTotalSubdivisions();
  const n = currentNumerator;
  const d = currentDenominator;

  container.innerHTML = '';
  gridIntegerLabels = [];
  gridFractionLabels = [];

  const timelineRow = document.createElement('div');
  timelineRow.className = 'plano-timeline-row';

  // Each number is positioned by absolute percentage (NOT by grid).
  //
  // COMPLEX FRACTION LOGIC (App33-style): each cell represents n/d pulses.
  // So the position in pulse-space of cell colIdx is `colIdx * n / d`.
  // An integer pulse occurs where `(colIdx * n) % d === 0`, and the pulse
  // number at that cell is `(colIdx * n) / d`. For n=1 this reduces to
  // `pulseIndex = colIdx / d` — the App32/App34 simple-fraction formula.
  for (let colIdx = 0; colIdx < columns; colIdx++) {
    const numEl = document.createElement('div');
    numEl.className = 'plano-timeline-number';
    numEl.dataset.colIndex = colIdx;

    const positionNumerator = colIdx * n;
    const isIntegerPulse = positionNumerator % d === 0;
    const pulseIndex = positionNumerator / d;  // only meaningful when integer
    const subdivIndex = colIdx % d;

    const leftPercent = (colIdx / columns) * 100;
    numEl.style.left = `${leftPercent}%`;

    if (isIntegerPulse) {
      numEl.classList.add('plano-cycle-start');
      // Single-digit pulses get a narrower tick offset (4px vs 7px) so the
      // vertical mark sits under the center of the text. Two-digit pulses
      // (10, 11, ...) keep the nuzic-theme default of 7px.
      if (pulseIndex < 10) numEl.classList.add('plano-single-digit');
      numEl.textContent = String(pulseIndex);
      gridIntegerLabels[pulseIndex] = numEl;
    } else {
      numEl.classList.add('plano-subdivision');
      numEl.textContent = `.${subdivIndex}`;
      gridFractionLabels.push(numEl);
    }

    timelineRow.appendChild(numEl);
  }

  // Endpoint marker `·` al final de la timeline (col `columns`, pulse
  // `currentLg`). Mateix patró que App33 (Lg dinàmic en complex).
  const endpointEl = document.createElement('div');
  endpointEl.className = 'plano-timeline-number plano-cycle-end';
  endpointEl.dataset.colIndex = columns;
  endpointEl.style.left = '100%';
  endpointEl.textContent = '·';
  timelineRow.appendChild(endpointEl);
  gridIntegerLabels[currentLg] = endpointEl;

  container.appendChild(timelineRow);

  // Subdivision label "n/d" a la cantonada inferior-esquerra del
  // `.plano-container` (zona del triangle groc). A App35 és "n/d"
  // dinàmic (no "1/d" com App32/App34) perquè el numerador és editable.
  const planoContainer = gridElements?.container;
  if (planoContainer) {
    let subdivisionLabel = planoContainer.querySelector('.plano-subdivision-label');
    if (!subdivisionLabel) {
      subdivisionLabel = document.createElement('div');
      subdivisionLabel.className = 'plano-subdivision-label';
      planoContainer.appendChild(subdivisionLabel);
    }
    subdivisionLabel.textContent = `${n}/${d}`;
  }
}

function syncGridScrolls() {
  const matrix = gridElements?.matrixContainer;
  const timeline = gridElements?.timelineContainer;
  const soundline = gridElements?.soundlineContainer;
  if (matrix) setupScrollSync(matrix, soundline, timeline);
}

// ========== NUZIC N-iT EDITOR ==========
// Zigzag two-row editor (N pink / iT yellow) adapted from App20. Pairs are
// committed as the user types alternately into N and iT inputs. The editor
// is the authoritative source: every commit calls `handleZigzagChange` which
// rebuilds `notes[]` and re-renders the 2D grid. Direct grid edits sync back
// via `syncGridToZigzag()` → `zigzagEditor.setPairs()`.
//
// Differences vs App20 (which uses NrR note+registry):
//   - N value is a bare note 0-11 (no registry) or 'S' for silence.
//   - No `validateNoteRegistry` — the range check is inline.
//   - Auto-jump delay is 500 ms (covers "11" two-digit case without NrR).
//
// Validation rules (aligned with legacy createGridEditor behaviour):
//   N      → 0..11 or 'S'            error "N: 0-11 o S"
//   iT     → ≥ 1                      error "iT debe ser ≥ 1"
//   iT     → ≤ remaining (maxTotalPulse − currentSum) error "iT máximo: N"
//   Full   → tooltip "Longitud completa" on the end marker
//   Edit of a committed cell that breaks a rule → revert to original value.
//
// Note: App20 ships a hardcoded `iT: 1-8` upper bound because its pulse
// range is fixed at 0-7. App34/App35 have variable `maxTotalPulse` (up to
// 96 for Lg=12, d=8, n=1), so no hardcoded ceiling — the `remaining`
// check is the only upper bound.
function initZigzagEditor() {
  const container = document.getElementById('zigzagEditorContainer');
  if (!container) return;

  container.innerHTML = '';
  container.classList.add('nit-editor');

  // ---- DOM structure ----
  const nBar = document.createElement('div');
  nBar.className = 'nit-editor-bar';
  const nLabel = document.createElement('div');
  nLabel.className = 'nit-editor-label n-label';
  nLabel.textContent = 'N';
  const nCells = document.createElement('div');
  nCells.className = 'nit-editor-cells';
  const nEnd = document.createElement('div');
  nEnd.className = 'nit-editor-end';
  nEnd.style.display = 'none';
  nCells.appendChild(nEnd);
  nBar.appendChild(nLabel);
  nBar.appendChild(nCells);

  const itBar = document.createElement('div');
  itBar.className = 'nit-editor-bar';
  const itLabel = document.createElement('div');
  itLabel.className = 'nit-editor-label it-label';
  itLabel.textContent = 'iT';
  const itCells = document.createElement('div');
  itCells.className = 'nit-editor-cells';
  const itEnd = document.createElement('div');
  itEnd.className = 'nit-editor-end';
  itEnd.style.display = 'none';
  itCells.appendChild(itEnd);
  itBar.appendChild(itLabel);
  itBar.appendChild(itCells);

  container.appendChild(nBar);
  container.appendChild(itBar);

  // ---- State ----
  let entries = [];            // [{ note, temporalInterval, isRest }]
  let pendingN = null;         // number | 'S' | null
  let pendingIT = null;        // number | null
  let lastEnteredType = 'it';  // starts so first focus is on N
  let autoJumpTimer = null;
  let maxTotalPulse = getTotalSubdivisions();
  let suppressNotify = false;  // set when setPairs() drives the change

  const currentSum = () => entries.reduce((s, e) => s + (e.temporalInterval || 0), 0);

  // ---- Tooltip (single DOM node shared across cells) ----
  function showTooltip(cell, message) {
    let tooltip = document.querySelector('.nit-editor-tooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.className = 'nit-editor-tooltip';
      document.body.appendChild(tooltip);
    }
    tooltip.textContent = message;
    const rect = cell.getBoundingClientRect();
    tooltip.style.left = `${rect.left + rect.width / 2}px`;
    tooltip.style.top = `${rect.top - 8}px`;
    tooltip.style.transform = 'translate(-50%, -100%)';
    tooltip.classList.add('visible');
    setTimeout(() => tooltip.classList.remove('visible'), 1500);
  }

  // ---- Parsing ----
  // Accepts: 'S'/'s' → silence, '0'..'11' → note. Returns 'S' | number | null.
  function parseN(raw) {
    const val = raw.trim();
    if (/^[sS]$/.test(val)) return 'S';
    if (/^\d+$/.test(val)) {
      const n = parseInt(val, 10);
      if (n >= 0 && n <= 11) return n;
    }
    return null;
  }
  const formatN = entry => (entry.isRest ? 'S' : String(entry.note));

  // ---- Cell factories ----
  function createReadonlyCell(type) {
    const cell = document.createElement('input');
    cell.type = 'text';
    cell.className = `nit-editor-cell ${type}-cell`;
    cell.placeholder = ' ';
    cell.readOnly = true;
    cell.tabIndex = -1;
    return cell;
  }

  function createValueCell(type, displayValue, entryIndex) {
    const cell = document.createElement('input');
    cell.type = 'text';
    cell.inputMode = type === 'it' ? 'numeric' : 'text';
    cell.maxLength = 2;
    cell.className = `nit-editor-cell ${type}-cell`;
    cell.value = displayValue;
    cell.dataset.entryIndex = entryIndex;
    cell.readOnly = false;
    cell.style.cursor = 'text';

    let originalValue = cell.value;

    cell.addEventListener('focus', () => {
      originalValue = cell.value;
      cell.select();
    });

    cell.addEventListener('blur', () => {
      const val = cell.value.trim();
      if (!val || val === originalValue) { cell.value = originalValue; return; }
      const idx = parseInt(cell.dataset.entryIndex, 10);
      const entry = entries[idx];
      if (!entry) { cell.value = originalValue; return; }

      if (type === 'n') {
        const parsed = parseN(val);
        if (parsed === null) {
          showTooltip(cell, 'N: 0-11 o S');
          cell.value = originalValue;
          return;
        }
        if (parsed === 'S') { entry.isRest = true; entry.note = 0; }
        else { entry.isRest = false; entry.note = parsed; }
      } else {
        const num = parseInt(val, 10);
        if (isNaN(num) || num < 1) {
          showTooltip(cell, 'iT debe ser ≥ 1');
          cell.value = originalValue;
          return;
        }
        const oldIT = entry.temporalInterval;
        const newSum = currentSum() - oldIT + num;
        if (newSum > maxTotalPulse) {
          showTooltip(cell, `iT máximo: ${maxTotalPulse - currentSum() + oldIT}`);
          cell.value = originalValue;
          return;
        }
        entry.temporalInterval = num;
      }

      notifyChange();
      renderCells();
    });

    cell.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); cell.blur(); return; }
      if (e.key === 'Tab') {
        e.preventDefault();
        cell.blur();
        const parent = type === 'n' ? nCells : itCells;
        const all = Array.from(parent.querySelectorAll('.nit-editor-cell:not([readonly])'));
        const i = all.indexOf(cell);
        const next = e.shiftKey ? all[i - 1] : all[i + 1];
        if (next) next.focus();
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const parent = type === 'n' ? nCells : itCells;
        const all = Array.from(parent.querySelectorAll('.nit-editor-cell:not([readonly])'));
        const i = all.indexOf(cell);
        const next = e.key === 'ArrowRight' ? all[i + 1] : all[i - 1];
        if (next) { e.preventDefault(); next.focus(); }
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const other = type === 'n' ? itCells : nCells;
        const entryIdx = parseInt(cell.dataset.entryIndex, 10);
        const match = other.querySelector(`.nit-editor-cell[data-entry-index="${entryIdx}"]:not([readonly])`);
        if (match) match.focus();
      }
    });

    return cell;
  }

  function createInputCell(type) {
    const cell = document.createElement('input');
    cell.type = 'text';
    cell.inputMode = type === 'it' ? 'numeric' : 'text';
    cell.maxLength = 2;
    cell.className = `nit-editor-cell ${type}-cell active-input`;
    cell.readOnly = false;

    cell.addEventListener('input', () => {
      const val = cell.value;
      if (val === '') return;

      if (type === 'n') {
        // 'S' for silence — commit partner immediately if iT ready.
        if (/^[sS]$/.test(val)) {
          pendingN = 'S';
          lastEnteredType = 'n';
          clearTimeout(autoJumpTimer);
          if (pendingIT !== null) { commitEntry(); return; }
          autoJumpTimer = setTimeout(() => {
            const itInput = itCells.querySelector('.active-input');
            if (itInput) itInput.focus();
          }, 300);
          return;
        }

        // Single digit "1".."9" could still become "10"/"11" — wait briefly.
        if (/^\d$/.test(val)) {
          clearTimeout(autoJumpTimer);
          autoJumpTimer = setTimeout(() => {
            const current = cell.value;
            if (/^\d{2}$/.test(current)) return; // second digit arrived — wait for the 2-digit branch
            const parsed = parseN(current);
            if (parsed === null || parsed === 'S') { cell.value = ''; return; }
            pendingN = parsed;
            lastEnteredType = 'n';
            if (pendingIT !== null) commitEntry();
            else {
              const itInput = itCells.querySelector('.active-input');
              if (itInput) itInput.focus();
            }
          }, 500);
          return;
        }

        // Two-digit "10"/"11" — parse now.
        if (/^\d{2}$/.test(val)) {
          const parsed = parseN(val);
          if (parsed === null) {
            showTooltip(cell, 'N: 0-11 o S');
            cell.value = '';
            clearTimeout(autoJumpTimer);
            return;
          }
          pendingN = parsed;
          lastEnteredType = 'n';
          clearTimeout(autoJumpTimer);
          if (pendingIT !== null) commitEntry();
          else {
            autoJumpTimer = setTimeout(() => {
              const itInput = itCells.querySelector('.active-input');
              if (itInput) itInput.focus();
            }, 200);
          }
          return;
        }

        // Anything else → invalid char.
        cell.value = '';
      } else {
        // iT: positive integer bounded by remaining subdivisions. No
        // hardcoded upper limit — `remaining` (maxTotalPulse - currentSum)
        // is the only ceiling, matching the legacy createGridEditor.
        if (!/^\d+$/.test(val)) { cell.value = ''; return; }
        const num = parseInt(val, 10);
        if (num < 1) {
          showTooltip(cell, 'iT debe ser ≥ 1');
          cell.value = '';
          clearTimeout(autoJumpTimer);
          return;
        }
        const remaining = maxTotalPulse - currentSum();
        if (num > remaining) {
          showTooltip(cell, `iT máximo: ${remaining}`);
          cell.value = '';
          clearTimeout(autoJumpTimer);
          return;
        }

        // Single digit that could still extend to a valid 2-digit value:
        // wait ~500ms before committing (same pattern as the N input).
        // If a second digit arrives, the input handler re-fires with the
        // 2-digit string and this branch is skipped.
        if (/^\d$/.test(val) && remaining >= 10) {
          clearTimeout(autoJumpTimer);
          autoJumpTimer = setTimeout(() => {
            const current = cell.value;
            if (/^\d{2}$/.test(current)) return; // 2-digit will re-fire handler
            const commitNum = parseInt(current, 10);
            if (!Number.isFinite(commitNum) || commitNum < 1) return;
            pendingIT = commitNum;
            lastEnteredType = 'it';
            if (pendingN !== null) commitEntry();
            else {
              const nInput = nCells.querySelector('.active-input');
              if (nInput) nInput.focus();
            }
          }, 500);
          return;
        }

        pendingIT = num;
        lastEnteredType = 'it';
        clearTimeout(autoJumpTimer);
        if (pendingN !== null) { commitEntry(); return; }
        autoJumpTimer = setTimeout(() => {
          const nInput = nCells.querySelector('.active-input');
          if (nInput) nInput.focus();
        }, 300);
      }
    });

    cell.addEventListener('keydown', (e) => {
      // Enter / Tab → force-evaluate current value and jump to partner row.
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        clearTimeout(autoJumpTimer);
        if (cell.value) cell.dispatchEvent(new Event('input'));
        if (pendingN !== null && pendingIT !== null) { commitEntry(); return; }
        const other = type === 'n' ? itCells : nCells;
        const target = other.querySelector('.active-input');
        if (target) target.focus();
        return;
      }

      // Backspace on empty: unwind pending state, then pop last entry.
      if (e.key === 'Backspace' && !cell.value) {
        e.preventDefault();
        clearTimeout(autoJumpTimer);
        if (type === 'it') {
          if (pendingIT !== null) pendingIT = null;
          else if (pendingN !== null) {
            pendingN = null;
            const nInput = nCells.querySelector('.active-input');
            if (nInput) { nInput.value = ''; nInput.focus(); }
          } else if (entries.length > 0) {
            entries.pop();
            notifyChange();
            renderCells();
          }
        } else {
          if (pendingN !== null) pendingN = null;
          else if (entries.length > 0) {
            entries.pop();
            notifyChange();
            renderCells();
          }
        }
        return;
      }

      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const parent = type === 'n' ? nCells : itCells;
        const all = Array.from(parent.querySelectorAll('.nit-editor-cell:not([readonly])'));
        const i = all.indexOf(cell);
        const next = e.key === 'ArrowRight' ? all[i + 1] : all[i - 1];
        if (next) { e.preventDefault(); next.focus(); }
      }

      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const other = type === 'n' ? itCells : nCells;
        const target = other.querySelector('.active-input') || other.querySelector('.nit-editor-cell:not([readonly])');
        if (target) target.focus();
      }
    });

    return cell;
  }

  // ---- Commit ----
  function commitEntry() {
    if (pendingN === null || pendingIT === null) return;
    if (pendingN === 'S') {
      entries.push({ note: 0, temporalInterval: pendingIT, isRest: true });
    } else {
      entries.push({ note: pendingN, temporalInterval: pendingIT, isRest: false });
    }
    pendingN = null;
    pendingIT = null;
    notifyChange();
    renderCells();
    if (currentSum() >= maxTotalPulse) showTooltip(itEnd, 'Longitud completa');
  }

  // ---- Sync ----
  function entriesToPairs() {
    let pulse = 0;
    return entries.map(e => {
      const pair = {
        note: e.isRest ? null : e.note,
        pulse,
        temporalInterval: e.temporalInterval,
        isRest: e.isRest || false
      };
      pulse += e.temporalInterval;
      return pair;
    });
  }

  function notifyChange() {
    if (suppressNotify) return;
    handleZigzagChange(entriesToPairs());
  }

  // ---- Render ----
  function renderCells() {
    nCells.querySelectorAll('.nit-editor-cell').forEach(c => c.remove());
    itCells.querySelectorAll('.nit-editor-cell').forEach(c => c.remove());

    // Committed entries — zigzag pattern: N [value][sep]  iT [sep][value]
    for (let i = 0; i < entries.length; i++) {
      nCells.insertBefore(createValueCell('n', formatN(entries[i]), i), nEnd);
      nCells.insertBefore(createReadonlyCell('n'), nEnd);
      itCells.insertBefore(createReadonlyCell('it'), itEnd);
      itCells.insertBefore(createValueCell('it', String(entries[i].temporalInterval), i), itEnd);
    }

    // Input pair when there's still pulse budget.
    const full = currentSum() >= maxTotalPulse || maxTotalPulse <= 0;
    if (!full) {
      const nInput = createInputCell('n');
      nCells.insertBefore(nInput, nEnd);
      nCells.insertBefore(createReadonlyCell('n'), nEnd);

      itCells.insertBefore(createReadonlyCell('it'), itEnd);
      const itInput = createInputCell('it');
      itCells.insertBefore(itInput, itEnd);

      const focusTarget = lastEnteredType === 'n' ? itInput : nInput;
      setTimeout(() => focusTarget?.focus(), 30);
    }

    nEnd.style.display = full ? 'flex' : 'none';
    itEnd.style.display = full ? 'flex' : 'none';
  }

  renderCells();

  // ---- Public API (matches the old createGridEditor surface) ----
  zigzagEditor = {
    getPairs: () => entriesToPairs().map(p => ({ ...p })),

    setPairs: (pairs) => {
      suppressNotify = true;
      entries = pairs
        .filter(p => p.isRest || (p.note !== null && p.note !== undefined))
        .map(p => ({
          note: p.isRest ? 0 : p.note,
          temporalInterval: p.temporalInterval || 1,
          isRest: p.isRest || false
        }));
      pendingN = null;
      pendingIT = null;
      clearTimeout(autoJumpTimer);
      renderCells();
      suppressNotify = false;
    },

    clear: () => {
      suppressNotify = true;
      entries = [];
      pendingN = null;
      pendingIT = null;
      clearTimeout(autoJumpTimer);
      renderCells();
      suppressNotify = false;
    },

    clearHighlights: () => {},

    setMaxTotalPulse: (n) => {
      maxTotalPulse = Math.max(0, n || 0);
      // Trim entries that no longer fit.
      let running = 0;
      const kept = [];
      for (const e of entries) {
        if (running + e.temporalInterval > maxTotalPulse) break;
        kept.push(e);
        running += e.temporalInterval;
      }
      if (kept.length !== entries.length) {
        entries = kept;
        notifyChange();
      }
      renderCells();
    },

    destroy: () => {
      clearTimeout(autoJumpTimer);
      container.innerHTML = '';
    }
  };
}

function handleZigzagChange(pairs) {
  const newNotes = [];
  let currentStart = 0;
  pairs.forEach(pair => {
    if (!pair.temporalInterval) return;
    if (pair.isRest) {
      newNotes.push({ note: null, startSubdiv: currentStart, duration: pair.temporalInterval, isRest: true });
    } else if (pair.note !== null) {
      newNotes.push({ note: pair.note, startSubdiv: currentStart, duration: pair.temporalInterval });
    }
    currentStart += pair.temporalInterval;
  });
  notes = newNotes;
  renderNotes();
  updateInfoDisplays();
}

function syncGridToZigzag() {
  if (!zigzagEditor) return;
  const sorted = [...notes].filter(n => !n.isRest).sort((a, b) => a.startSubdiv - b.startSubdiv);
  const pairs = [];
  let cursor = 0;
  for (const noteData of sorted) {
    if (noteData.startSubdiv > cursor) {
      pairs.push({ note: null, pulse: cursor, temporalInterval: noteData.startSubdiv - cursor, isRest: true });
    }
    pairs.push({ note: noteData.note, pulse: noteData.startSubdiv, temporalInterval: noteData.duration });
    cursor = noteData.startSubdiv + noteData.duration;
  }
  zigzagEditor.setPairs(pairs);
}

// (pulse-start alignment handled via CSS `transform: translateX(-50%)`.)

// ========== NOTE RENDERING ==========
function renderNotes() {
  renderNoteBars({
    matrixContainer: gridElements?.matrixContainer,
    notes,
    cellWidth,
    noteCount: NOTE_COUNT,
    colors: VIBRANT_COLORS,
    onClickNote: removeNote
  });
  renderNoteHalters();
}

// Halter groc d'iT sota cada note-bar (patró App13/App20/App30/App32/App33/App34).
function renderNoteHalters() {
  const matrix = gridElements?.matrixContainer?.querySelector('.plano-matrix');
  if (!matrix) return;

  matrix.querySelectorAll('.note-halter').forEach(el => el.remove());

  if (!notes || notes.length === 0 || !cellWidth) return;

  const firstCell = matrix.querySelector('.plano-cell');
  const cellH = firstCell?.offsetHeight || 32;
  const matrixWidth = matrix.offsetWidth;
  if (!matrixWidth) return;

  notes.forEach((noteData) => {
    if (noteData.isRest) return;

    const startPx = noteData.startSubdiv * cellWidth;
    const widthPx = noteData.duration * cellWidth;
    const startPercent = (startPx / matrixWidth) * 100;
    const widthPercent = (widthPx / matrixWidth) * 100;

    const rowIndex = (NOTE_COUNT - 1) - noteData.note;
    const barHeight = cellH - 2;
    const barTop = (rowIndex + 1) * cellH - barHeight / 2;
    const halterTop = barTop + barHeight;

    const halter = createIntervalLabelBar({
      startPercent,
      widthPercent,
      label: noteData.duration,
      variant: 'solid'
    });
    halter.classList.add('note-halter');
    halter.style.top = `${halterTop}px`;
    matrix.appendChild(halter);
  });
}

// ========== NOTE MANAGEMENT ==========
function removeOverlappingNotes(startSubdiv, duration) {
  notes = _removeOverlapping(notes, startSubdiv, duration);
}

function addNote(noteData) {
  // Monophonic mode: remove ALL notes that overlap in columns (any row)
  removeOverlappingNotes(noteData.startSubdiv, noteData.duration);

  notes.push(noteData);
  notes.sort((a, b) => a.startSubdiv - b.startSubdiv || a.note - b.note);
  renderNotes();
  updateInfoDisplays();
  syncGridToZigzag();
}

function removeNote(idx) {
  notes.splice(idx, 1);
  renderNotes();
  updateInfoDisplays();
  syncGridToZigzag();
}

function clearNotes() {
  notes = [];
  renderNotes();
  updateInfoDisplays();
  syncGridToZigzag();
}

// ========== GRID DRAG HANDLERS ==========
function attachGridDragHandlers() {
  const matrix = gridElements?.matrixContainer;
  if (!matrix) return;

  const cells = matrix.querySelectorAll('.plano-cell');
  cells.forEach(cell => {
    cell.addEventListener('mousedown', handleGridDragStart);
    cell.addEventListener('touchstart', handleGridDragStart, { passive: false });
  });

  document.addEventListener('mousemove', handleGridDragMove);
  document.addEventListener('mouseup', handleGridDragEnd);
  document.addEventListener('touchmove', handleGridDragMove, { passive: false });
  document.addEventListener('touchend', handleGridDragEnd);
}

function handleGridDragStart(e) {
  e.preventDefault();

  const cell = e.currentTarget;
  const note = parseInt(cell.dataset.note, 10);
  const colIndex = parseInt(cell.dataset.colIndex, 10);

  // Check if clicking on existing note
  const clickedOnNote = notes.findIndex(n =>
    n.note === note &&
    colIndex >= n.startSubdiv &&
    colIndex < n.startSubdiv + n.duration
  );

  if (clickedOnNote >= 0) {
    removeNote(clickedOnNote);
    return;
  }

  const maxTotal = getTotalSubdivisions();
  if (colIndex >= maxTotal) return;

  dragState = {
    active: true,
    note: note,
    startSubdiv: colIndex,
    currentSubdiv: colIndex,
    maxSubdiv: maxTotal - 1,
    previewBar: null
  };

  document.body.classList.add('dragging-note');
  createGridPreviewBar();
  updateGridPreviewBar();
}

function handleGridDragMove(e) {
  if (!dragState.active || dragState.note === undefined) return;

  const clientX = e.touches ? e.touches[0].clientX : e.clientX;

  // Use .plano-matrix (not matrixContainer) so margin-left and scroll are
  // already baked into the bounding rect. Using the outer container caused
  // a fractional-column offset that became ~a whole column on small viewports.
  const matrix = gridElements?.matrixContainer?.querySelector('.plano-matrix');
  if (!matrix) return;

  const rect = matrix.getBoundingClientRect();
  const relX = clientX - rect.left;
  const colIndex = Math.floor(relX / cellWidth);

  const newSubdiv = Math.max(dragState.startSubdiv, Math.min(dragState.maxSubdiv, colIndex));

  if (newSubdiv !== dragState.currentSubdiv) {
    dragState.currentSubdiv = newSubdiv;
    updateGridPreviewBar();
  }
}

function handleGridDragEnd() {
  if (!dragState.active || dragState.note === undefined) return;

  const duration = dragState.currentSubdiv - dragState.startSubdiv + 1;

  document.body.classList.remove('dragging-note');
  if (dragState.previewBar) {
    dragState.previewBar.remove();
    dragState.previewBar = null;
  }

  if (duration >= 1) {
    const noteData = {
      note: dragState.note,
      startSubdiv: dragState.startSubdiv,
      duration
    };
    addNote(noteData);

    // Play preview sound when note is created
    playNotePreview(noteData);
  }

  dragState.active = false;
  dragState.note = undefined;
}

function createGridPreviewBar() {
  if (dragState.previewBar) return;

  const matrix = gridElements?.matrixContainer?.querySelector('.plano-matrix');
  if (!matrix) return;

  const bar = document.createElement('div');
  bar.className = 'note-bar-preview';
  matrix.appendChild(bar);
  dragState.previewBar = bar;
}

function updateGridPreviewBar() {
  if (!dragState.previewBar) return;

  // Read actual cell height from DOM (var(--plano-cell-height) shrinks on small viewports)
  const firstCell = gridElements?.matrixContainer?.querySelector('.plano-cell');
  const cellHeight = firstCell?.offsetHeight || 32;
  const rowIndex = (NOTE_COUNT - 1) - dragState.note;
  const left = dragState.startSubdiv * cellWidth;
  const width = (dragState.currentSubdiv - dragState.startSubdiv + 1) * cellWidth;
  const barHeight = cellHeight - 2;
  const top = (rowIndex + 1) * cellHeight - barHeight / 2;  // Center on division line

  dragState.previewBar.style.left = `${left}px`;
  dragState.previewBar.style.width = `${width}px`;
  dragState.previewBar.style.top = `${top}px`;
  dragState.previewBar.style.height = `${barHeight}px`;
}

// ========== FRACTION EDITOR ==========
function initFractionEditorController() {
  if (!fractionSlot) return;

  currentNumerator = DEFAULT_NUMERATOR;
  currentDenominator = DEFAULT_DENOMINATOR;
  currentLg = _calcLg(currentNumerator, BASE_LG);

  const controller = createFractionEditor({
    mode: 'block',
    host: fractionSlot,
    defaults: { numerator: DEFAULT_NUMERATOR, denominator: DEFAULT_DENOMINATOR },
    autoReduce: true,
    startEmpty: false,
    minNumerator: MIN_NUMERATOR,
    maxNumerator: MAX_NUMERATOR,
    minDenominator: MIN_DENOMINATOR,
    maxDenominator: MAX_DENOMINATOR,
    storage: {},
    addRepeatPress,
    labels: {
      numerator: {
        placeholder: 'n',
        ariaUp: 'Incrementar numerador',
        ariaDown: 'Decrementar numerador'
      },
      denominator: {
        placeholder: 'd',
        ariaUp: 'Incrementar denominador',
        ariaDown: 'Decrementar denominador'
      }
    },
    onChange: ({ cause }) => {
      if (cause !== 'init') {
        handleFractionChange();
      }
    }
  });

  fractionEditorController = controller || null;

  // Complex mode: both numerator and denominator editable.
  if (fractionEditorController && typeof fractionEditorController.setComplexMode === 'function') {
    fractionEditorController.setComplexMode();
  }
}

function handleFractionChange() {
  if (!fractionEditorController) return;

  const fraction = fractionEditorController.getFraction();
  let newN = fraction?.numerator;
  let newD = fraction?.denominator;

  // Skip if value is not yet valid (user is typing)
  if (!Number.isFinite(newN) || !Number.isFinite(newD)) {
    return;
  }

  // Clamp numerator and denominator to valid ranges.
  if (newN < MIN_NUMERATOR) newN = MIN_NUMERATOR;
  else if (newN > MAX_NUMERATOR) newN = MAX_NUMERATOR;
  if (newD < MIN_DENOMINATOR) newD = MIN_DENOMINATOR;
  else if (newD > MAX_DENOMINATOR) newD = MAX_DENOMINATOR;

  if (newN !== fraction?.numerator || newD !== fraction?.denominator) {
    fractionEditorController.setFraction(
      { numerator: newN, denominator: newD },
      { cause: 'clamp', persist: true, silent: true }
    );
  }

  currentNumerator = newN;
  currentDenominator = newD;
  currentLg = _calcLg(currentNumerator, BASE_LG);

  // Filter invalid notes
  filterInvalidNotes();

  // Keep the zigzag editor's max bound in sync with the new subdivisions.
  // Fires on BOTH numerator and denominator changes (getTotalSubdivisions
  // depends on both).
  if (zigzagEditor?.setMaxTotalPulse) {
    zigzagEditor.setMaxTotalPulse(getTotalSubdivisions());
  }

  // Redraw grid (contains both the grid and the timeline row).
  renderGrid();

  // Hot-reload audio if playing
  if (audio && isPlaying) {
    applyTransportConfig();
  }
}

function filterInvalidNotes() {
  notes = _filterInvalid(notes, getTotalSubdivisions());
}

/**
 * Apply current fraction config to running audio transport
 * Enables hot-reload when fraction changes during playback
 */
function applyTransportConfig() {
  if (!audio || typeof audio.updateTransport !== 'function') return;

  const lg = currentLg;
  const bpm = (bpmController?.getValue() || DEFAULT_BPM);
  const n = currentNumerator;
  const d = currentDenominator;

  const scaledTotal = lg * d;
  const scaledBpm = bpm * d;

  audio.updateTransport({
    totalPulses: scaledTotal,
    bpm: scaledBpm,
    baseResolution: d,
    patternBeats: lg * d,
    cycle: {
      numerator: n * d,
      denominator: d,
      onTick: highlightCycle
    }
  });
}

// ========== TIMELINE RENDERING ==========
// Legacy timeline rendering removed — the plano-modular grid handles its own
// timeline row, and notes are drawn as `.note-bar` elements inside the matrix
// via renderNoteBars(). No external #timeline is needed.

// ========== NOTE PREVIEW ==========
/**
 * Play a preview sound when a note is created
 */
async function playNotePreview(noteData) {
  const audioInstance = await initAudio();
  if (!audioInstance) return;

  // Calculate note duration based on current BPM and denominator
  const d = currentDenominator;
  const n = currentNumerator;
  const bpm = (bpmController?.getValue() || DEFAULT_BPM);
  const beatDuration = 60 / bpm;
  const durationPulses = noteData.duration * n / d;
  const durationSeconds = Math.min(durationPulses * beatDuration, 2); // Cap at 2 seconds for preview

  // MIDI note = BASE_MIDI + note (0-11)
  const midiNote = BASE_MIDI + noteData.note;

  // Play the note immediately (time=0 means "now")
  audioInstance.playNote(midiNote, durationSeconds, 0);
}

// ========== PLAYBACK ==========
/**
 * Get note that starts at a given scaled index
 * Returns the note object or null if no note starts there
 */
function getNoteAtScaledStart(scaledIndex) {
  const n = currentNumerator;

  for (const noteData of notes) {
    // Convert note start (in subdivisions) to scaled index
    const noteScaledStart = noteData.startSubdiv * n;
    if (noteScaledStart === scaledIndex) {
      return noteData;
    }
  }
  return null;
}

async function startPlayback() {
  // Allow playback even with no notes (just metronome)

  const lg = currentLg;
  const bpm = (bpmController?.getValue() || DEFAULT_BPM);
  const n = currentNumerator;
  const d = currentDenominator;

  // Scale by denominator to include subdivisions (like App29)
  const baseResolution = d;
  const scaledInterval = (60 / bpm) / d; // Each step = 1/d of a beat
  const scaledTotal = lg * d;

  const audioInstance = await initAudio();

  const hasCycle = n > 0 && d > 0 && Math.floor(lg / n) > 0;

  // No accent selection - we use melodic notes from grid
  const audioSelection = { values: new Set(), resolution: 1 };

  const onFinish = () => {
    isPlaying = false;
    updateControlsState();
    clearHighlights();
    audioInstance.stop();
  };

  // Build play options
  const playOptions = {
    baseResolution,
    patternBeats: lg * d // Scaled pattern length
  };

  if (hasCycle) {
    // Scale numerator by d to match scaled timeline
    playOptions.cycle = {
      numerator: n * d,
      denominator: d,
      onTick: highlightCycle
    };
  }

  // Declarative note provider: engine schedules notes automatically in tick()
  audioInstance.registerNoteProvider('melody', (scaledIndex) => {
    const d = currentDenominator;
    const n = currentNumerator;

    const noteData = getNoteAtScaledStart(scaledIndex);
    // Skip rests — they have note:null, which would otherwise play as BASE_MIDI+null = N(0)
    if (noteData && !noteData.isRest && noteData.note !== null) {
      const bpm = bpmController?.getValue() || DEFAULT_BPM;
      const beatDuration = 60 / bpm;
      const durationPulses = noteData.duration * n / d;
      const durationSeconds = durationPulses * beatDuration;
      const midiNote = BASE_MIDI + noteData.note;
      return [{ midi: midiNote, duration: durationSeconds, velocity: 0.8 }];
    }
    return null;
  });

  // Start playback with audio.play() - this handles metronome and subdivision sounds
  // highlightPulse handles ONLY visual updates; note provider handles audio
  audioInstance.play(
    scaledTotal,
    scaledInterval,
    audioSelection,
    true,   // Loop ENABLED (1 cicle en bucle)
    highlightPulse,
    onFinish,
    playOptions
  );

  isPlaying = true;
  updateControlsState();
}

async function stopPlayback() {
  if (!audio) return;

  audio.stop();
  isPlaying = false;
  clearHighlights();
  updateControlsState();
}

async function playMetronomeClick() {
  if (!audio) return;
  try {
    await audio.playSound(currentMetronomeSound, 'pulse');
  } catch (err) {
    console.warn('Error playing metronome:', err);
  }
}

async function playCycleSound() {
  if (!audio) return;
  try {
    await audio.playSound(audio._soundAssignments?.cycle || 'click2', 'subdivision');
  } catch (err) {
    console.warn('Error playing cycle sound:', err);
  }
}

// ========== HIGHLIGHTING ==========
function clearHighlights() {
  gridIntegerLabels.forEach(label => label?.classList.remove('active'));
  gridFractionLabels.forEach(label => label?.classList.remove('active'));
  // Cel·les actives de l'editor zigzag (N + iT) sota el plànol.
  document.querySelectorAll('.nit-editor-cell.active').forEach(c => c.classList.remove('active'));
  // Hide playhead
  if (playheadController) {
    playheadController.hide();
  }
  // Reset scroll to start
  const matrix = gridElements?.matrixContainer;
  if (matrix) {
    matrix.scrollLeft = 0;
  }
}

/**
 * Highlight pulse - receives scaledIndex from audio.play()
 * Like App29: scaledIndex = pulseIndex * d for integer pulses
 * Audio scheduling moved to note provider; this handles ONLY visuals.
 */
function highlightPulse(scaledIndex) {
  if (!isPlaying) return;
  const n = currentNumerator;
  const d = currentDenominator;

  // Transport runs at `lg*d` ticks (so `noteData.startSubdiv * n === scaledIndex`
  // works for note scheduling). The GRID has `lg*d/n` cells. Convert the
  // scaled index to the actual cell index by dividing by n, otherwise the
  // playhead visual advances n-times faster than the audio.
  const cellIndex = Math.floor(scaledIndex / n);

  // Update playhead position at the correct cell
  if (playheadController) {
    playheadController.update(cellIndex);

    // Autoscroll to keep playhead visible
    const matrix = gridElements?.matrixContainer;
    if (matrix) {
      const playheadLeft = cellIndex * cellWidth;
      const viewportWidth = matrix.clientWidth;
      const scrollLeft = matrix.scrollLeft;
      const margin = viewportWidth * 0.2;

      if (playheadLeft > scrollLeft + viewportWidth - margin) {
        matrix.scrollLeft = playheadLeft - margin;
      }
      if (playheadLeft < scrollLeft + margin) {
        matrix.scrollLeft = Math.max(0, playheadLeft - margin);
      }
    }
  }

  // Integer pulse highlight: in complex fractions, integer pulses occur at
  // cells where `(cellIndex * n) % d === 0`. Pulse number at that cell is
  // `(cellIndex * n) / d`.
  if ((cellIndex * n) % d !== 0) return;

  const pulseIndex = (cellIndex * n) / d;

  gridIntegerLabels.forEach(label => label?.classList.remove('active'));
  const integerLabel = gridIntegerLabels[pulseIndex];
  if (integerLabel) {
    void integerLabel.offsetWidth;
    integerLabel.classList.add('active');
  }

  // Also highlight the note bar that contains this pulse
  highlightBarAtPosition(pulseIndex);
}

/**
 * Highlight cycle subdivision - receives payload from audio.play() cycle callback
 * Like App29: { cycleIndex, subdivisionIndex }
 */
function highlightCycle(payload = {}) {
  if (!isPlaying) return;

  const { cycleIndex: rawCycleIndex, subdivisionIndex: rawSubdivisionIndex } = payload;
  const cycleIndex = Number(rawCycleIndex);
  const subdivisionIndex = Number(rawSubdivisionIndex);

  if (!Number.isFinite(cycleIndex) || !Number.isFinite(subdivisionIndex)) return;

  // Highlight fractional timeline numbers in the grid's timeline row.
  gridFractionLabels.forEach(label => label?.classList.remove('active'));
  if (subdivisionIndex > 0) {
    const fractionalIndex = cycleIndex * currentDenominator + subdivisionIndex - 1;
    const fractionalLabel = gridFractionLabels[fractionalIndex];
    if (fractionalLabel) {
      fractionalLabel.classList.add('active');
    }
  }

  // Calculate position and highlight note bar in grid.
  const n = currentNumerator;
  const position = cycleIndex * n + subdivisionIndex * n / currentDenominator;
  highlightBarAtPosition(position);
}

/**
 * Highlight the note bar (inside the grid matrix) that contains a given
 * position (in user-pulses).
 *
 * `noteData.startSubdiv` and `.duration` are in GRID CELLS (not pulses).
 * Each grid cell is `n/d` pulses wide. So to compare with `position` we
 * convert cells → pulses by multiplying by `n/d`. For n=1 this reduces
 * to `/d` (App34 formula); for n>1 the `n` factor is essential — otherwise
 * the note-bar highlight appears to advance n-times faster than audio.
 */
// P-29: refs cachejades + últim índex actiu — abans cada tick de
// subdivisió (lg·d ticks; ~20/s amb d=8 a 150 BPM) re-consultava totes
// les barres (querySelectorAll) i l'editor sencer (document-wide ×2).
// Ara el tick és matemàtica pura + early-return si l'índex no canvia, i
// quan canvia es toquen ≤2 barres i ≤4 cel·les per referència. Les refs
// es revaliden per length/isConnected (re-render ⇒ refs noves).
let hlBars = null;       // Array de .note-bar alineat amb `notes`
let hlCellsByIdx = null; // Map entryIndex -> [cel·les N + iT]
let hlLastIdx = -1;

function highlightBarAtPosition(position) {
  const n = currentNumerator;
  const d = currentDenominator;

  let activeIdx = -1;
  for (let i = 0; i < notes.length; i++) {
    const noteData = notes[i];
    const startPos = (noteData.startSubdiv * n) / d;
    const endPos = ((noteData.startSubdiv + noteData.duration) * n) / d;
    if (position >= startPos && position < endPos) {
      activeIdx = i;
      break;
    }
  }

  if (!hlBars || hlBars.length !== notes.length || (hlBars[0] && !hlBars[0].isConnected)) {
    const matrix = gridElements?.matrixContainer?.querySelector('.plano-matrix');
    if (!matrix) return;
    hlBars = Array.from(matrix.querySelectorAll('.note-bar'));
    hlCellsByIdx = new Map();
    document.querySelectorAll('.nit-editor-cell[data-entry-index]').forEach(c => {
      const idx = Number(c.dataset.entryIndex);
      if (!hlCellsByIdx.has(idx)) hlCellsByIdx.set(idx, []);
      hlCellsByIdx.get(idx).push(c);
    });
    hlLastIdx = -1;
    // Neteja residus d'un render anterior (classes que hagin sobreviscut)
    hlBars.forEach(b => b.classList.remove('highlight'));
    hlCellsByIdx.forEach(cells => cells.forEach(c => c.classList.remove('active')));
  }

  if (activeIdx === hlLastIdx) return;

  if (hlLastIdx >= 0) {
    hlBars[hlLastIdx]?.classList.remove('highlight');
    hlCellsByIdx?.get(hlLastIdx)?.forEach(c => c.classList.remove('active'));
  }
  // Editor zigzag (N + iT): mateix patró que App34 — il·luminem ambdues
  // cel·les amb el mateix `data-entry-index` que la nota activa. Color
  // per fila ve del CSS (rosa intens per N, groc per iT).
  if (activeIdx >= 0) {
    hlBars[activeIdx]?.classList.add('highlight');
    hlCellsByIdx?.get(activeIdx)?.forEach(c => c.classList.add('active'));
  }
  hlLastIdx = activeIdx;
}

// ========== CONTROLS ==========
function updateControlsState() {
  if (playBtn) {
    playBtn.classList.toggle('playing', isPlaying);

    // Toggle play/stop icons
    const iconPlay = playBtn.querySelector('.icon-play');
    const iconStop = playBtn.querySelector('.icon-stop');
    if (iconPlay && iconStop) {
      iconPlay.style.display = isPlaying ? 'none' : 'block';
      iconStop.style.display = isPlaying ? 'block' : 'none';
    }
  }
}

function handlePlay() {
  if (isPlaying) {
    stopPlayback();
  } else {
    startPlayback();
  }
}

function handleRandom() {
  if (isPlaying) return;

  // Random reduced fraction: loop until gcd(n, d) === 1 so the fraction
  // matches `autoReduce: true` on the editor. The longpress menu caps
  // numerator and denominator independently (defaults = MAX_*).
  const { numMax, denomMax } = randomMenu?.read() ?? { numMax: MAX_NUMERATOR, denomMax: MAX_DENOMINATOR };
  const nMax = Math.min(numMax, MAX_NUMERATOR);
  const dMax = Math.min(denomMax, MAX_DENOMINATOR);
  let newN, newD;
  do {
    newN = Math.floor(Math.random() * (nMax - MIN_NUMERATOR + 1)) + MIN_NUMERATOR;
    newD = Math.floor(Math.random() * (dMax - MIN_DENOMINATOR + 1)) + MIN_DENOMINATOR;
  } while (gcd(newN, newD) !== 1);

  if (fractionEditorController) {
    fractionEditorController.setFraction(
      { numerator: newN, denominator: newD },
      { cause: 'random', persist: true }
    );
  }
  currentNumerator = newN;
  currentDenominator = newD;
  currentLg = _calcLg(currentNumerator, BASE_LG);

  // Generate random monophonic notes (consecutive, no overlap)
  const maxSubdivs = getTotalSubdivisions();
  const newNotes = [];
  let currentPos = 0;

  while (currentPos < maxSubdivs) {
    // Random note (0-11)
    const note = Math.floor(Math.random() * NOTE_COUNT);

    // Random duration (1 to min of remaining space or d*2)
    const remaining = maxSubdivs - currentPos;
    const maxDur = Math.min(remaining, newD * 2);
    const duration = Math.floor(Math.random() * maxDur) + 1;

    newNotes.push({ note, startSubdiv: currentPos, duration });
    currentPos += duration;
  }

  notes = newNotes;

  if (zigzagEditor?.setMaxTotalPulse) {
    zigzagEditor.setMaxTotalPulse(maxSubdivs);
  }
  renderGrid();
  syncGridToZigzag();

  // Auto-play after randomizing (consistent across apps 9+).
  if (!isPlaying) handlePlay();
}

function handleReset() {
  if (isPlaying) {
    stopPlayback();
  }

  // Reset to defaults
  currentNumerator = DEFAULT_NUMERATOR;
  currentDenominator = DEFAULT_DENOMINATOR;
  currentLg = _calcLg(currentNumerator, BASE_LG);

  if (fractionEditorController) {
    fractionEditorController.setFraction(
      { numerator: DEFAULT_NUMERATOR, denominator: DEFAULT_DENOMINATOR },
      { cause: 'reset', persist: true }
    );
  }

  clearNotes();

  renderGrid();
}

// ========== EVENT LISTENERS ==========
if (playBtn) {
  playBtn.addEventListener('click', handlePlay);
}

if (randomBtn) {
  randomMenu = setupRandomMenu({
    storage: { load: loadOpt, save: saveOpt }, // LU-03: la config del menú sobreviu recàrregues
    spec: {
      numMax:   { label: 'Numerador máximo',   min: MIN_NUMERATOR,   max: MAX_NUMERATOR,   default: MAX_NUMERATOR },
      denomMax: { label: 'Denominador máximo', min: MIN_DENOMINATOR, max: MAX_DENOMINATOR, default: MAX_DENOMINATOR },
    },
    onRandomize: handleRandom,
  });
}

if (resetBtn) {
  resetBtn.addEventListener('click', handleReset);
}

// ========== INITIALIZATION ==========
function init() {
  // Initialize BPM controller
  const bpmInput = document.getElementById('inputBpm');
  const bpmDown = document.getElementById('bpmDown');
  const bpmUp = document.getElementById('bpmUp');
  if (bpmInput && bpmDown && bpmUp) {
    bpmController = createBpmController({
      inputEl: bpmInput,
      upBtn: bpmUp,
      downBtn: bpmDown,
      min: MIN_BPM,
      max: MAX_BPM,
      defaultValue: DEFAULT_BPM,
      onChange: () => {
        if (isPlaying) {
          applyTransportConfig();
        }
      }
    });
    bpmController.attach();
  }

  // Build .middle layout: info pastilles + fraction (creates fractionSlot).
  buildMiddleLayout();

  // Initialize fraction editor in block mode into fractionSlot.
  initFractionEditorController();

  // Create grid (inserted AFTER timeline-wrapper).
  createGrid();

  // Create zigzag editor container immediately AFTER #gridContainer so it
  // lives full-width below the grid (App20-style N-iT strip). Built here
  // rather than in buildMiddleLayout so insertion order is grid → editor.
  const gridContainerEl = document.getElementById('gridContainer');
  if (gridContainerEl?.parentNode) {
    const zigzagContainer = document.createElement('div');
    zigzagContainer.id = 'zigzagEditorContainer';
    zigzagContainer.className = 'zigzag-editor-container';
    gridContainerEl.parentNode.insertBefore(zigzagContainer, gridContainerEl.nextSibling);
  }

  // Initialize the N-iT zigzag editor (now that its container exists below
  // the grid). `createGridEditor` ships with built-in range validation and
  // contextual tooltips (`iT máx`, invalid-note messages, etc.) — no custom
  // validation layer is required on the app side.
  initZigzagEditor();

  // Ordre nuzic de la fila de controls (helper compartit, H-08) +
  // trasllat sota el grid (nuzic order: middle → grid → controls).
  const controls = reorderControls();
  const gridContainer = document.getElementById('gridContainer');
  if (controls && gridContainer?.parentNode) {
    gridContainer.parentNode.insertBefore(controls, gridContainer.nextSibling);
  }

  // Idle caret flash on the zigzag editor (the primary input target).
  initIdleCaretFlash({
    targets: [document.getElementById('zigzagEditorContainer')].filter(Boolean)
  });
}

// Run initialization
init();
