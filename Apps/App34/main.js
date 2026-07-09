// App34: Plano con Fracción Simple
// Basat en App30, substitueix iT-seq per grid 2D amb notes
// Lg=12 fix, BPM=70 fix, numerador=1 fix, denominador editable (1-8)
// Grid 2D amb 12 notes (0-11) + soundline
// Àudio melòdic amb selector d'instrument + so de cicle

import { getMixer, setChannelMute } from '../../libs/sound/index.js';
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
import { createPlanoGridEditor } from '../../libs/plano-modular/plano-grid-editor.js';
import { createPlayheadController } from '../../libs/plano-modular/plano-playhead.js';
import { createBpmController } from '../../libs/app-common/bpm-controller.js';
import { addRepeatPress } from '../../libs/app-common/spinner-repeat.js';
import { buildSimple12Rows } from '../../libs/app-common/plano-grid-rows.js';
import { getTotalSubdivisions as _getTotalSubdivs, filterInvalidNotes as _filterInvalid } from '../../libs/plano-fraccion/fraction-math.js';
import { renderNoteBars, renderSilenceLines, removeOverlappingNotes as _removeOverlapping } from '../../libs/app-common/plano-note-renderer.js';
import { initIdleCaretFlash } from '../../libs/app-common/idle-caret-flash.js';
import { createIntervalLabelBar } from '../../libs/shared-ui/interval-label-bar.js';
import { setupRandomMenu } from '../../libs/random/menu.js';
import { reorderControls } from '../../libs/app-common/template.js';

// ========== CONSTANTS ==========
const FIXED_LG = 12;             // 12 pulsos (0-11)
const DEFAULT_BPM = 60;
const MIN_BPM = 50;
const MAX_BPM = 150;
const FIXED_NUMERATOR = 1;       // Numerador sempre 1 (App30)
const DEFAULT_DENOMINATOR = 2;   // Per defecte 1/2
const MIN_DENOMINATOR = 1;
const MAX_DENOMINATOR = 8;

// Color únic per als note-bars: blau clar (`--nuzic-blue-light`) com
// a apps de plànol anteriors (App19/App20/App32/App33). El highlight
// durant playback usa el blau intens via CSS box-shadow.
const VIBRANT_COLORS = ['#bdd9e6'];

// Notes per àudio
const NOTE_COUNT = 12;       // 12 notes (0-11)
const BASE_MIDI = 48;        // C3 = 48

// ========== STATE ==========
let audio = null;
let isPlaying = false;
let bpmController = null;
let currentDenominator = DEFAULT_DENOMINATOR;

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
let gridEditor = null;  // Factory compartida (libs/plano-modular/plano-grid-editor.js)

// Playback state
let playbackAbort = null;

// Endpoint-mute state: we mute the `pulse` channel for a single engine
// step at the end (pulse Lg) so the cycle-end pulse stays silent.
// Both stopPlayback (user) and onFinish (auto) must restore it.
let endpointPulseMuted = false;
let endpointPulseMuteWasMuted = false;
function restoreEndpointPulseMute() {
  if (endpointPulseMuted) {
    setChannelMute('pulse', endpointPulseMuteWasMuted);
    endpointPulseMuted = false;
  }
}

let currentMetronomeSound = (() => {
  try {
    const stored = localStorage.getItem('baseSound');
    return stored || 'click9';
  } catch {
    return 'click9';
  }
})();

// ========== PREFERENCE STORAGE ==========
const preferenceStorage = createPreferenceStorage({ prefix: 'app34', separator: '::' });
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
  return _getTotalSubdivs(FIXED_LG, FIXED_NUMERATOR, currentDenominator);
}

// ========== GRID EDITOR (factory compartida) ==========
// Instància de libs/plano-modular/plano-grid-editor.js amb el context
// d'aquesta app (variant SIMPLE: FIXED_NUMERATOR/FIXED_LG, com App32).
// Tot l'estat de drag/np-dots/labels/scroll-sync viu dins la closure de
// la factory; aquí només hi ha els getters que li donen accés a l'estat
// viu de l'app (fracció, notes, bpm, elements DOM).
gridEditor = createPlanoGridEditor({
  getGridElements: () => gridElements,
  getFraction: () => ({ lg: FIXED_LG, numerator: FIXED_NUMERATOR, denominator: currentDenominator }),
  initAudio,
  getBpm: () => bpmController?.getValue() || DEFAULT_BPM,
  getNotes: () => notes,
  onNoteCreated: addNote,
  getInfoDisplays: () => ({ sum: sumDisplay, available: availableDisplay }),
  noteCount: NOTE_COUNT,
  baseMidi: BASE_MIDI
});

// Referències vives als arrays de labels de la factory: el highlight de
// playback (clearHighlights/highlightPulse/highlightCycle) els llegeix
// directament. La factory mai reassigna l'array (fa `.length = 0` i
// reomple), així que una única assignació aquí ja basta.
gridIntegerLabels = gridEditor.getIntegerLabels();
gridFractionLabels = gridEditor.getFractionLabels();

// ========== MIDDLE LAYOUT (info pastilles + fraction) ==========
// LU-04: la fracció va ANCORADA A L'ESQUERRA de `.middle` i el grup de
// pastilles d'info a la dreta en absolut (Patró App30 — vegeu styles.css
// `.middle`). Els comentaris antics deien "fraction centered": era l'estat
// previ a la migració, el CSS actual no centra res.
function buildMiddleLayout() {
  const middle = document.querySelector('.middle');
  if (!middle) return null;

  middle.innerHTML = '';
  middle.classList.add('app34-middle');

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
        cellWidth = gridEditor.refreshCellWidth();
        renderNotes();
      });
    });
    ro.observe(gridElements.matrixContainer);
  }

  // Create playhead controller. With columnSizing='fr' we pass 0 so the
  // controller uses DOM-based positioning (cell.offsetLeft) — see
  // plano-playhead.js line 42-51.
  // `domOffset: -1` perquè el playhead caigui exactament a
  // `cell.offsetLeft` (alineat amb el pulse-number, same as App32/33).
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

  const d = currentDenominator;

  // Mark pulse-start cells (colIndex % d === 0). Their left edge coincides
  // with the pulse boundary line.
  const cells = gridElements.matrixContainer.querySelectorAll('.plano-cell');
  cells.forEach(cell => {
    const colIndex = parseInt(cell.dataset.colIndex, 10);
    if (colIndex % d === 0) {
      cell.classList.add('pulse-boundary');
    }
  });

  // Render fractional timeline in grid
  gridEditor.renderGridTimeline();

  // Read actual cell width from DOM now that grid is rendered.
  cellWidth = gridEditor.refreshCellWidth();

  // Attach drag handlers to cells
  gridEditor.attachGridDragHandlers();

  // Sync scroll
  gridEditor.syncGridScrolls();

  // Render existing notes (uses cellWidth for positioning bars).
  renderNotes();

  // Update info displays
  gridEditor.updateInfoDisplays();
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
  itLabel.textContent = 'iTfr';
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
          const itInput = itCells.querySelector('.active-input');
          if (itInput) itInput.focus();
          return;
        }

        // Un sol dígit: només "1" és ambigu (pot ser 10/11) → espera 2000ms per
        // si arriba un 2n dígit; la resta salta directe a la casella següent.
        if (/^\d$/.test(val)) {
          const parsed = parseN(val);
          if (parsed === null) { cell.value = ''; clearTimeout(autoJumpTimer); return; }
          const jumpN = () => {
            pendingN = parsed;
            lastEnteredType = 'n';
            if (pendingIT !== null) commitEntry();
            else {
              const itInput = itCells.querySelector('.active-input');
              if (itInput) itInput.focus();
            }
          };
          clearTimeout(autoJumpTimer);
          if (val === '1') {
            autoJumpTimer = setTimeout(() => {
              if (/^\d{2}$/.test(cell.value)) return; // 2n dígit arribat
              jumpN();
            }, 2000);
          } else {
            jumpN();
          }
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

        // Un sol dígit ambigu (num*10 ≤ remaining, encara pot ser 2-dígit) →
        // espera 2000ms per si arriba un 2n dígit; la resta salta directe.
        if (/^\d$/.test(val) && num * 10 <= remaining) {
          clearTimeout(autoJumpTimer);
          autoJumpTimer = setTimeout(() => {
            if (/^\d{2}$/.test(cell.value)) return; // 2-dígit re-dispararà el handler
            pendingIT = num;
            lastEnteredType = 'it';
            if (pendingN !== null) commitEntry();
            else {
              const nInput = nCells.querySelector('.active-input');
              if (nInput) nInput.focus();
            }
          }, 2000);
          return;
        }

        pendingIT = num;
        lastEnteredType = 'it';
        clearTimeout(autoJumpTimer);
        if (pendingN !== null) { commitEntry(); return; }
        const nInput = nCells.querySelector('.active-input');
        if (nInput) nInput.focus();
      }
    });

    cell.addEventListener('keydown', (e) => {
      // Enter / Tab → force-evaluate current value and jump to partner row.
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        clearTimeout(autoJumpTimer);
        // ENTER/Tab = "ja he acabat": confirma el valor actual de seguida (sense
        // esperar el timer d'auto-salt de 2000ms, que per a dígits únics ajorna
        // el commit) i salta a la fila parella; commit si el parell N+iT és ple.
        const val = cell.value.trim();
        if (val) {
          if (type === 'n') {
            const parsed = parseN(val);
            if (parsed !== null) { pendingN = parsed; lastEnteredType = 'n'; }
          } else {
            const num = parseInt(val, 10);
            const remaining = maxTotalPulse - currentSum();
            if (Number.isFinite(num) && num >= 1 && num <= remaining) { pendingIT = num; lastEnteredType = 'it'; }
          }
        }
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
  gridEditor.updateInfoDisplays();
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
  const totalColumns = getTotalSubdivisions();
  renderNoteBars({
    matrixContainer: gridElements?.matrixContainer,
    notes,
    totalColumns,            // % EXACTE (encaixa amb les columnes 1fr)
    noteCount: NOTE_COUNT,
    colors: VIBRANT_COLORS,
    onClickNote: removeNote,
    formatBarLabel: (n) => n.note   // número de nota dins el rectangle (no l'iT)
  });
  // `leadingGap: true` → també es pinta el silenci abans de la primera nota.
  // Els segments retornats reben halter discontinu (com els silencis explícits).
  const gaps = renderSilenceLines({ matrixContainer: gridElements?.matrixContainer, notes, totalColumns, noteCount: NOTE_COUNT, leadingGap: true });
  renderNoteHalters(gaps);
}

// Halter d'iT sota cada note-bar (patró App13/App20/App30/App32). Notes: sòlid.
// Silencis (isRest explícits + forats calculats `gaps`): DISCONTINU, alineat amb
// la fila on viu la seva línia de silenci.
function renderNoteHalters(gaps = []) {
  const matrix = gridElements?.matrixContainer?.querySelector('.plano-matrix');
  if (!matrix) return;

  matrix.querySelectorAll('.note-halter').forEach(el => el.remove());

  const firstCell = matrix.querySelector('.plano-cell');
  const cellH = firstCell?.offsetHeight || 32;
  const totalColumns = getTotalSubdivisions();
  if (!totalColumns) return;

  const drawHalter = (startSubdiv, duration, row, dashed) => {
    const rowIndex = (NOTE_COUNT - 1) - row;
    const barHeight = cellH - 2;
    const barTop = (rowIndex + 1) * cellH - barHeight / 2;
    const halter = createIntervalLabelBar({
      startPercent: (startSubdiv / totalColumns) * 100,
      widthPercent: (duration / totalColumns) * 100,
      label: duration,
      variant: dashed ? 'dashed' : 'solid'
    });
    halter.classList.add('note-halter');
    if (currentDenominator >= 5 && duration <= 2) {
      halter.classList.add('note-halter--no-label');
    }
    halter.style.top = `${barTop + barHeight}px`;
    matrix.appendChild(halter);
  };

  let lastNoteRow = Math.floor(NOTE_COUNT / 2);
  notes.forEach((noteData) => {
    const isRest = !!noteData.isRest;
    const noteRow = isRest ? lastNoteRow : noteData.note;
    if (!isRest) lastNoteRow = noteData.note;
    drawHalter(noteData.startSubdiv, noteData.duration, noteRow, isRest);
  });

  // Forats calculats (silenci inicial + forats no coberts entre notes).
  gaps.forEach((gap) => drawHalter(gap.startSubdiv, gap.duration, gap.row, true));
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
  gridEditor.updateInfoDisplays();
  syncGridToZigzag();
}

function removeNote(idx) {
  notes.splice(idx, 1);
  renderNotes();
  gridEditor.updateInfoDisplays();
  syncGridToZigzag();
}

function clearNotes() {
  notes = [];
  renderNotes();
  gridEditor.updateInfoDisplays();
  syncGridToZigzag();
}

// ========== GRID DRAG HANDLERS (factory) ==========
// Np-dots, delegació de drag (mousedown/move/end) i preview d'àudio ara
// viuen a libs/plano-modular/plano-grid-editor.js (gridEditor), enganxats
// des de renderGrid() via gridEditor.attachGridDragHandlers().

// ========== FRACTION EDITOR ==========
function initFractionEditorController() {
  if (!fractionSlot) return;

  currentDenominator = DEFAULT_DENOMINATOR;

  const controller = createFractionEditor({
    mode: 'block',
    host: fractionSlot,
    defaults: { numerator: FIXED_NUMERATOR, denominator: DEFAULT_DENOMINATOR },
    startEmpty: false,
    maxDenominator: MAX_DENOMINATOR,
    enableGhost: false,  // numerador fix a 1 → autoReduce mai s'activa, ghost mort
    storage: {},
    addRepeatPress,
    labels: {
      numerator: {
        placeholder: '1',
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

  // Set simple mode (numerator fixed at 1)
  if (fractionEditorController && typeof fractionEditorController.setSimpleMode === 'function') {
    fractionEditorController.setSimpleMode();
  }
}

function handleFractionChange() {
  if (!fractionEditorController) return;

  const fraction = fractionEditorController.getFraction();
  let newD = fraction?.denominator;

  // Skip if value is not yet valid (user is typing)
  if (!Number.isFinite(newD)) {
    return;
  }

  // Clamp denominator (2-8)
  if (newD < MIN_DENOMINATOR) {
    newD = MIN_DENOMINATOR;
  } else if (newD > MAX_DENOMINATOR) {
    newD = MAX_DENOMINATOR;
  }

  if (newD !== fraction?.denominator) {
    fractionEditorController.setFraction(
      { numerator: FIXED_NUMERATOR, denominator: newD },
      { cause: 'clamp', persist: true, silent: true }
    );
  }

  currentDenominator = newD;

  // Filter invalid notes
  filterInvalidNotes();

  // Keep the zigzag editor's max bound in sync with the new subdivisions.
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

  const lg = FIXED_LG;
  const bpm = (bpmController?.getValue() || DEFAULT_BPM);
  const n = FIXED_NUMERATOR;
  const d = currentDenominator;

  // See startPlayback: scaledTotal = endpointStep + 1, patternBeats keeps
  // cycle events within [0, endpointStep). Endpoint mute is managed by
  // the onSchedule hook in startPlayback; not altered here.
  const endpointStep = lg * d;
  const scaledTotal = endpointStep + 1;
  const scaledBpm = bpm * d;

  audio.updateTransport({
    totalPulses: scaledTotal,
    bpm: scaledBpm,
    baseResolution: d,
    patternBeats: endpointStep,
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
// La previsualització d'àudio en crear una nota per drag viu a
// gridEditor.playNotePreview() (libs/plano-modular/plano-grid-editor.js),
// cridada internament per la factory dins el mateix gest de drag-end
// (Invariant 3 — vegeu comentari al mòdul).

// ========== PLAYBACK ==========
/**
 * Get note that starts at a given scaled index
 * Returns the note object or null if no note starts there
 */
function getNoteAtScaledStart(scaledIndex) {
  const n = FIXED_NUMERATOR;

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

  const lg = FIXED_LG;
  const bpm = (bpmController?.getValue() || DEFAULT_BPM);
  const n = FIXED_NUMERATOR;
  const d = currentDenominator;

  // Scale by denominator to include subdivisions.
  //   scaledTotal = lg*d + 1  → engine reaches the pulse-Lg step so the
  //     subdivisions just before it emit cycle events.
  //   patternBeats = lg*d     → cycle events only within [0, lg*d).
  //   We mute the `pulse` channel in onSchedule for stepIndex === lg*d
  //     so pulse Lg stays silent.
  const baseResolution = d;
  const scaledInterval = (60 / bpm) / d;
  const endpointStep = lg * d;
  const scaledTotal = endpointStep + 1;

  const audioInstance = await initAudio();

  const hasCycle = n > 0 && d > 0 && Math.floor(lg / n) > 0;

  // No accent selection - we use melodic notes from grid
  const audioSelection = { values: new Set(), resolution: 1 };

  // Record pulse-channel mute so restoreEndpointPulseMute can put it
  // back when playback ends (onFinish or stopPlayback).
  endpointPulseMuteWasMuted = !!getMixer()?.getChannelState?.('pulse')?.muted;
  endpointPulseMuted = false;

  const onFinish = () => {
    isPlaying = false;
    updateControlsState();
    clearHighlights();
    restoreEndpointPulseMute();
    // Delay stop() so the pre-scheduled sample for the last pulse (endpoint)
    // has time to play instead of being cancelled by source.stop(0).
    setTimeout(() => audioInstance.stop(), Math.max(200, scaledInterval * 1000 * 0.6));
  };

  // Build play options
  const playOptions = {
    baseResolution,
    patternBeats: endpointStep,  // cycle events only within [0, lg*d)
    onSchedule: (stepIndex, _when) => {
      // Mute the pulse channel just before the endpoint beat (pulse Lg)
      // so its base sample doesn't fire. Subdivisions already fired;
      // onFinish / stopPlayback restores the channel.
      if (stepIndex === endpointStep && !endpointPulseMuted) {
        setChannelMute('pulse', true);
        endpointPulseMuted = true;
      }
    }
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
    const n = FIXED_NUMERATOR;

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
    false,  // Loop DISABLED (one-shot)
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
  restoreEndpointPulseMute();
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
  const d = currentDenominator;

  // Update playhead position (scaledIndex is the column index)
  if (playheadController) {
    playheadController.update(scaledIndex);

    // Autoscroll to keep playhead visible
    const matrix = gridElements?.matrixContainer;
    if (matrix) {
      const playheadLeft = scaledIndex * cellWidth;
      const viewportWidth = matrix.clientWidth;
      const scrollLeft = matrix.scrollLeft;
      const margin = viewportWidth * 0.2; // 20% margin before edge

      // Scroll right if playhead approaches right edge
      if (playheadLeft > scrollLeft + viewportWidth - margin) {
        matrix.scrollLeft = playheadLeft - margin;
      }
      // Scroll left if playhead approaches left edge (for looping)
      if (playheadLeft < scrollLeft + margin) {
        matrix.scrollLeft = Math.max(0, playheadLeft - margin);
      }
    }
  }

  // Convert scaled index to pulse index (only highlight integer pulses)
  // scaledIndex = pulseIndex * d for integer pulses
  if (scaledIndex % d !== 0) return; // Skip subdivisions (handled by highlightCycle)

  const pulseIndex = scaledIndex / d;

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
  const n = FIXED_NUMERATOR;
  const position = cycleIndex * n + subdivisionIndex * n / currentDenominator;
  highlightBarAtPosition(position);
}

/**
 * Highlight the note bar (inside the grid matrix) that contains a given position.
 */
// P-01: refs cachejades + últim índex actiu — abans cada tick de subdivisió
// (~20/s a 150 BPM amb d=8) re-consultava totes les barres (querySelectorAll)
// i l'editor sencer (document-wide ×2). Ara el tick és matemàtica pura +
// early-return si l'índex no canvia; quan canvia només es toquen ≤2 barres
// i ≤4 cel·les per referència. Les refs es revaliden per length/isConnected
// (re-render ⇒ refs noves). Patró portat d'App35 (P-29); es manté la
// fórmula pròpia d'App34 (startSubdiv/d, FIXED_NUMERATOR=1).
let hlBars = null;       // Array de .note-bar alineat amb `notes`
let hlCellsByIdx = null; // Map entryIndex -> [cel·les N + iT]
let hlLastIdx = -1;

function highlightBarAtPosition(position) {
  const d = currentDenominator;

  let activeIdx = -1;
  for (let i = 0; i < notes.length; i++) {
    const noteData = notes[i];
    const startPos = noteData.startSubdiv / d;
    const endPos = (noteData.startSubdiv + noteData.duration) / d;
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
  // Editor zigzag (N + iT): il·luminem ambdues cel·les amb el mateix
  // `data-entry-index` que la nota activa. Cada entry produeix una nota
  // (filter no en treu cap perquè les entries són sempre completes),
  // així que `notes[activeIdx]` correspon a entries[activeIdx]. El
  // color per fila ve del CSS (rosa intens per N, groc per iT).
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

  // Random denominator from 2 to the longpress-menu cap (default = MAX_DENOMINATOR).
  const { denomMax } = randomMenu?.read() ?? { denomMax: MAX_DENOMINATOR };
  const dMax = Math.min(denomMax, MAX_DENOMINATOR);
  const newD = Math.floor(Math.random() * (dMax - 1)) + 2;

  if (fractionEditorController) {
    fractionEditorController.setFraction(
      { numerator: FIXED_NUMERATOR, denominator: newD },
      { cause: 'random', persist: true }
    );
  }
  currentDenominator = newD;

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
}

function handleReset() {
  if (isPlaying) {
    stopPlayback();
  }

  // Reset to defaults
  currentDenominator = DEFAULT_DENOMINATOR;

  if (fractionEditorController) {
    fractionEditorController.setFraction(
      { numerator: FIXED_NUMERATOR, denominator: DEFAULT_DENOMINATOR },
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
      denomMax: { label: 'Denominador máximo', min: 2, max: MAX_DENOMINATOR, default: MAX_DENOMINATOR },
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
