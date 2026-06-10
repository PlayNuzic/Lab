// App20: Plano y sucesión N-iT
// Grid 2D (plano-modular) + nuzic N-iT zigzag editor

import { registerFactoryReset, createPreferenceStorage } from '../../libs/app-common/preferences.js';
import { attachHover } from '../../libs/shared-ui/hover.js';
import { createBpmController } from '../../libs/app-common/bpm-controller.js';
import { createCycleCounter } from '../../libs/app-common/cycle-counter.js';
import { attachSpinnerRepeat } from '../../libs/app-common/spinner-repeat.js';
import { createTapTempoHandler } from '../../libs/app-common/tap-tempo-handler.js';
import { createMelodicAudioInitializer, setupAudioDefaults, CHANNEL_TIERS, createMixerPersistence } from '../../libs/app-common/audio-init.js';
import { setupPianoPreload, isPianoLoaded } from '../../libs/sound/piano.js';
import { isFluteLoaded } from '../../libs/sound/flute.js';
import { initMixerMenu } from '../../libs/app-common/mixer-menu.js';
import { subscribeMixer, getMixer } from '../../libs/sound/index.js';
import { initAudioToggles } from '../../libs/app-common/audio-toggles.js';
import { initRandomMenu } from '../../libs/random/menu.js';
import { initP1ToggleUI } from '../../libs/shared-ui/sound-dropdown.js';

// Import plano-modular (out of the box)
import { createApp19Grid } from '../../libs/plano-modular/index.js';
import { smoothScrollTo } from '../../libs/plano-modular/plano-scroll.js';

// Import interval-sequencer module for gap filling
import { fillGapsWithSilences } from '../../libs/interval-sequencer/index.js';

// Import modular controllers
import { createGrid2DSyncController } from '../../libs/app-common/grid-2d-sync-controller.js';
import { createIntervalNoteDragHandler } from '../../libs/app-common/interval-note-drag.js';
import { initIdleCaretFlash } from '../../libs/app-common/idle-caret-flash.js';
import { createIntervalLabelBar } from '../../libs/shared-ui/interval-label-bar.js';
import { createMeasureHeader } from '../../libs/shared-ui/measure-header.js';

// ========== CONFIGURATION ==========
const CONFIG = {
  // Registry limits (4 registries: 3, 4, 5, 6)
  MIN_REGISTRO: 3,
  MAX_REGISTRO: 6,
  DEFAULT_REGISTRO: 4,

  // Notes per registry
  NOTES_PER_REGISTRY: 12,

  // Visual grid range: 0r3 to 11r6 (4 full registries)
  RANGE_MIN_NOTE: 0,
  RANGE_MIN_REGISTRY: 3,
  RANGE_MAX_NOTE: 11,
  RANGE_MAX_REGISTRY: 6,

  // Compás limits
  MIN_COMPAS: 1,
  MAX_COMPAS: 7,
  DEFAULT_COMPAS: 4,

  // Nº Compases (cycles) limits
  MIN_CYCLES: 1,
  MAX_CYCLES: 4,
  DEFAULT_CYCLES: 3,

  // BPM limits
  MIN_BPM: 30,
  MAX_BPM: 300,
  DEFAULT_BPM: 100,

  // Grid display
  VISIBLE_PULSES: 12,
  MIDI_OFFSET: 12
};

/**
 * Validates if a note+registry combination is within the visual grid range (7r2 to 7r5)
 * @param {number} note - Note value (0-11)
 * @param {number} registry - Registry value (2-5)
 * @returns {{ valid: boolean, message?: string }}
 */
function validateNoteRegistry(note, registry) {
  // All registries (3-6) support full range 0-11
  if (registry < CONFIG.MIN_REGISTRO || registry > CONFIG.MAX_REGISTRO) {
    return { valid: false, message: `Registro ${registry} fuera de rango (${CONFIG.MIN_REGISTRO}-${CONFIG.MAX_REGISTRO})` };
  }
  if (note < 0 || note > 11) {
    return { valid: false, message: `Nota ${note} fuera de rango (0-11)` };
  }
  return { valid: true };
}

// Screen definitions: 4 snap positions, una per registre (3, 4, 5, 6).
// Cada pantalla mostra les 12 notes (0-11) d'un sol registre amb el `0rN`
// (la base) ancorat a la part inferior de la finestra.
// Grid rows: 11r6=0, 10r6=1, ... 0r6=11, 11r5=12, ... 0r3=47
const CELL_H = 26;  // Must match --plano-cell-height in styles.css
const HALF_CELL = CELL_H / 2;
const SCREENS = [
  { label: '3', registro: 3, firstRow: 36, lastRow: 47 },  // 0r3 a baix
  { label: '4', registro: 4, firstRow: 24, lastRow: 35 },  // 0r4 a baix
  { label: '5', registro: 5, firstRow: 12, lastRow: 23 },  // 0r5 a baix
  { label: '6', registro: 6, firstRow: 0,  lastRow: 11 }   // 0r6 a baix
];

/** Index dins SCREENS del registre per defecte (CONFIG.DEFAULT_REGISTRO). */
function getDefaultScreenIndex() {
  const idx = SCREENS.findIndex(s => s.registro === CONFIG.DEFAULT_REGISTRO);
  return idx >= 0 ? idx : 0;
}

// ========== STATE ==========
let isPlaying = false;
let audio = null;
let tapTempoHandler = null;
let mixerSaveTimeout = null;
let currentScreen = 0;  // Index into SCREENS array (starts at registre 3)

// Input values
let compas = null;      // null = empty, 1-7 = value
let cycles = null;      // null = empty, 1-4 = value

// Grid instance (plano-modular)
let grid = null;
let measureHeader = null;

// Grid editor instance (NrX-iT zigzag)
let gridEditor = null;

// Store current pairs
let currentPairs = [];

let syncController = null;
let dragHandler = null;

// Mixer storage key
const MIXER_STORAGE_KEY = 'app20-mixer';

// ========== DOM ELEMENT REFERENCES ==========
let elements = {};

// ========== PREFERENCE STORAGE ==========
const preferenceStorage = createPreferenceStorage('app20');

// ========== AUDIO INITIALIZATION ==========
const _initAudio = createMelodicAudioInitializer({
  defaultInstrument: 'piano',
  getPreferences: () => preferenceStorage.load() || {}
});

const mixerPersist = createMixerPersistence({ storageKey: 'app20-mixer' });

async function initAudio() {
  if (!audio) {
    audio = await _initAudio();
    if (audio) {
      setupAudioDefaults(audio, { channels: CHANNEL_TIERS.MELODIC_PULSE });
      mixerPersist.hydrate(audio);
      mixerPersist.subscribe(audio);
    }
  }
  return audio;
}

// ========== CONTROLLERS ==========

// BPM controller
let bpmController = null;

// Cycle counter (for playback display)
let cycleCounter = null;

// ========== HELPER FUNCTIONS ==========

/**
 * Calculate total pulses (Compás × Nº Compases)
 */
function getTotalPulses() {
  if (compas === null || cycles === null) return 0;
  return compas * cycles;
}

/**
 * Update the Longitud display
 */
function updateLongitud() {
  const total = getTotalPulses();
  if (elements.totalLengthDigit) {
    elements.totalLengthDigit.textContent = total > 0 ? total : '--';
  }
}

/**
 * Fill gaps in pairs with silences for grid-editor display
 * Uses fillGapsWithSilences but preserves registry from previous note
 */
function pairsWithSilencesForEditor(pairs) {
  const basePair = { note: 0, pulse: 0, registry: CONFIG.DEFAULT_REGISTRO };
  const filled = fillGapsWithSilences(pairs, basePair);

  // Ensure silences have registry from previous note
  let lastRegistry = CONFIG.DEFAULT_REGISTRO;
  return filled.map(pair => {
    if (!pair.isRest) {
      lastRegistry = pair.registry ?? CONFIG.DEFAULT_REGISTRO;
    }
    return {
      ...pair,
      registry: pair.registry ?? lastRegistry
    };
  });
}

/**
 * Color per pols del dígit cycle: deshabilitat per evitar parpalleig
 * blau/taronja durant play (era confús). Mantenim la funció buida per
 * no haver de tocar tots els call-sites.
 */
function updateCycleDigitColor(_step) {
  // No-op intencionat.
}

/**
 * Update total length display with flip animation
 * Shows current step (1-indexed) with color coding
 */
function updateTotalLengthDisplay(step) {
  const digit = elements.totalLengthDigit;
  if (!digit) return;

  // Flip animation
  digit.classList.add('flip-out');

  setTimeout(() => {
    digit.textContent = String(step + 1);  // 1-indexed display
    digit.classList.remove('flip-out');
    digit.classList.add('flip-in');

    // Color: blue if step 0, orange otherwise
    digit.classList.remove('playing-zero', 'playing-active');
    digit.classList.add(step === 0 ? 'playing-zero' : 'playing-active');

    setTimeout(() => {
      digit.classList.remove('flip-in');
    }, 150);
  }, 150);
}

/**
 * Update grid visibility based on whether we have data
 */
function updateGridVisibility() {
  const wrapper = document.querySelector('.timeline-wrapper');
  if (wrapper) {
    const visible = getTotalPulses() > 0;
    wrapper.style.display = visible ? '' : 'none';
  }
}

// ========== GRID FUNCTIONS (using plano-modular + modular controllers) ==========

/**
 * Play a preview sound for a note with given duration
 * @param {number} note - Note index (0-11)
 * @param {number} registry - Registry (2-5)
 * @param {number} iT - Temporal interval (duration in pulses)
 */
async function playNotePreview(note, registry, iT) {
  const audioInstance = await initAudio();
  if (!window.Tone || !audioInstance) return;

  // Calculate MIDI: registry * 12 + note + 12 (midiOffset)
  const midi = registry * CONFIG.NOTES_PER_REGISTRY + note + CONFIG.MIDI_OFFSET;
  const bpm = bpmController?.getValue() || CONFIG.DEFAULT_BPM;
  const duration = (iT * (60 / bpm)) * 0.9;
  audioInstance.playNote(midi, duration, window.Tone.now());
}

/**
 * Handle cell click from grid (Grid 2D → Editor sync)
 * Custom handler that integrates with grid-editor and plays preview
 */
let _lastDragEndTime = 0;

async function handleCellClick(rowData, colIndex, isSelected) {
  // Skip if this click was triggered after a drag operation
  // Check both the drag flag and a 200ms debounce window
  if (dragHandler?.isFromDrag() || (Date.now() - _lastDragEndTime) < 200) return;

  if (isSelected) {
    // Play the note
    const audioInstance = await initAudio();
    if (audioInstance && rowData.midi) {
      const Tone = window.Tone;
      if (Tone) {
        const noteDuration = 0.3;
        audioInstance.playNote(rowData.midi, noteDuration, Tone.now());
      }
    }

    // Sync to grid-editor: parse rowId to get note and registry
    const match = rowData.id.match(/^(\d+)r(\d+)$/);
    if (match && gridEditor) {
      const note = parseInt(match[1]);
      const registry = parseInt(match[2]);

      // Get current pairs from editor
      const editorPairs = gridEditor.getPairs();

      // Check if this pulse already has a note
      const existingIndex = editorPairs.findIndex(p => p.pulse === colIndex);

      if (existingIndex >= 0) {
        // Update existing pair
        editorPairs[existingIndex] = {
          ...editorPairs[existingIndex],
          note,
          registry
        };
      } else {
        // Add new pair - calculate temporalInterval from previous note
        let temporalInterval = 1;
        if (editorPairs.length > 0) {
          const lastPair = editorPairs[editorPairs.length - 1];
          const lastPulse = lastPair.pulse + (lastPair.temporalInterval || 1);
          temporalInterval = colIndex - lastPulse + 1;
          if (temporalInterval < 1) temporalInterval = 1;
        }

        editorPairs.push({
          note,
          registry,
          pulse: colIndex,
          temporalInterval
        });
      }

      // Sort by pulse
      editorPairs.sort((a, b) => a.pulse - b.pulse);

      // Update editor (with silences filled in gaps)
      gridEditor.setPairs(pairsWithSilencesForEditor(editorPairs));
    }
  } else {
    // Cell was deselected - remove from grid-editor
    if (gridEditor) {
      const editorPairs = gridEditor.getPairs().filter(p => !p.isRest); // Remove silences first
      const updatedPairs = editorPairs.filter(p => p.pulse !== colIndex);
      gridEditor.setPairs(pairsWithSilencesForEditor(updatedPairs));
    }
  }
}

/**
 * Initialize the grid using plano-modular and modular controllers
 */
function initGrid() {
  const gridContainer = document.querySelector('.timeline-wrapper');
  if (!gridContainer) {
    console.error('Grid container not found');
    return;
  }

  // Clear the grid container
  gridContainer.innerHTML = '';

  grid = createApp19Grid({
    parent: gridContainer,
    columns: getTotalPulses() || 1,
    // 'px' = cel·les amb amplada fixa basada en `visibleColumns` (12).
    // Quan totalPulses excedeix les visibles, la matriu activa scroll
    // horitzontal en lloc de comprimir les cel·les. Vegeu
    // `getCellWidthDynamic` a libs/plano-modular/index.js.
    columnSizing: 'px',
    // Compensa el `marginLeft: -4px` que el component aplica al playhead
    // (libs/plano-modular/plano-playhead.js, createPlayhead) més 3px de
    // fine-tune visual perquè caigui exactament sobre el centre del
    // np-dot. Verificat visualment.
    playheadOffset: 7,
    cycleConfig: {
      compas: compas || 1,
      showCycle: true
    },
    bpm: bpmController?.getValue() || CONFIG.DEFAULT_BPM,
    defaultRegistry: CONFIG.DEFAULT_REGISTRO,
    registryConfig: {
      visibleRows: 24,
      selectableRegistries: [3, 4, 5, 6]
    },
    onCellClick: handleCellClick,
    onSelectionChange: null,  // Selections not persisted
    showScrollbars: true  // Barres de scroll visibles al matrix (dreta) i
                          // sota la timeline (fila proxy sincronitzada).
  });

  // Free vertical scroll — native scroll with sync handled by setupScrollSync
  // (no quantization, no cooldown, no blocked wheel events)

  // Initialize sync controller (handles Editor ↔ Grid 2D sync)
  syncController = createGrid2DSyncController({
    grid,
    gridEditor,
    getPairs: () => currentPairs,
    setPairs: (pairs) => { currentPairs = pairs; },
    config: {
      defaultRegistry: CONFIG.DEFAULT_REGISTRO,
      validateNoteRegistry,
      fillGapsWithSilences: pairsWithSilencesForEditor
    },
    onSyncComplete: () => {
      syncController?.refreshDots();
      markBarEdges();
    }
  });

  // Enable drag mode (adds dots to all cells)
  syncController.enableDragMode(true);

  // Initialize drag handler (handles drag-to-create/edit)
  // Use getter function because gridEditor may be null at this point
  dragHandler = createIntervalNoteDragHandler({
    grid,
    gridEditor: () => gridEditor,
    getPairs: () => currentPairs,
    setPairs: (pairs) => { currentPairs = pairs; },
    getTotalPulses,
    syncController,
    config: {
      defaultRegistry: CONFIG.DEFAULT_REGISTRO,
      monophonic: true
    },
    playNotePreview,
    fillGapsWithSilences: pairsWithSilencesForEditor,
    onDragComplete: (pairs) => {
      _lastDragEndTime = Date.now();
      // El drag handler crida `syncController.syncGridFromPairs(pairs)`
      // directament i salta la nostra `syncGridFromPairs` (que afegeix
      // els halters). Repintem la capa d'iT aquí perquè reflecteixi el
      // nou iT després del drag.
      renderItHalterCellLayer(pairs);
    }
  });

  // Attach drag listeners
  dragHandler.attach();

  // Mantenim la pastilla `Registro` en sync amb la posició visible de la
  // soundline: el listener salta a cada scroll (manual, programàtic,
  // smooth durant play) i actualitza el label al registre més proper.
  // Funciona durant play perquè el `smoothScrollTo` també genera scroll
  // events natius mentre interpola.
  const soundlineContainer = gridContainer.querySelector('.plano-soundline-container');
  if (soundlineContainer && elements.registroText) {
    soundlineContainer.addEventListener('scroll', () => {
      const screen = getScreenForScrollTop(soundlineContainer.scrollTop);
      if (elements.registroText.value !== screen.label) {
        elements.registroText.value = screen.label;
      }
    }, { passive: true });
  }

  // Insertem el "Compás" header just abans del .plano-container, dins del
  // mateix .timeline-wrapper. Mateix patró que App19 (vegeu SESSION_STATE
  // entrada 23). L'amplada del label esquerre i del track es sincronitzen
  // dinàmicament amb la geometria real del .plano-matrix via
  // syncMeasureHeaderBandWidth().
  if (gridContainer && !document.getElementById('measureHeader')) {
    const planoContainer = gridContainer.querySelector('.plano-container');
    if (planoContainer) {
      const headerEl = document.createElement('section');
      headerEl.id = 'measureHeader';
      headerEl.className = 'measure-header is-empty';
      gridContainer.insertBefore(headerEl, planoContainer);
      measureHeader = createMeasureHeader({ container: headerEl });
      if (compas != null && cycles != null) {
        measureHeader.render(compas, cycles);
        requestAnimationFrame(() => requestAnimationFrame(() => syncMeasureHeaderBandWidth()));
      }
      // Quan l'usuari fa scroll horitzontal a la matriu (compassos > 12),
      // les cel·les es desplacen però el header és fora del scroll: cal
      // recalcular les posicions dels marcadors a cada scroll.
      const matrixContainer = gridContainer.querySelector('.plano-matrix-container');
      if (matrixContainer) {
        matrixContainer.addEventListener('scroll', () => {
          syncMeasureHeaderBandWidth();
        }, { passive: true });
      }
    }
  }

  console.log('Grid initialized with plano-modular + modular controllers');
}

/**
 * Sincronitza el track del measure-header amb la zona real de cel·les
 * de la matriu (mateix patró que App19). El `--com-band-track-right`
 * conserva el signe perquè a App20 la matriu té width:100% + un petit
 * margin-left, i el seu costat dret pot sobresortir uns píxels del
 * header. Sense això, el clamp a 0 produiria desplaçament progressiu
 * dels marcadors.
 */
function syncMeasureHeaderBandWidth() {
  const headerEl = document.getElementById('measureHeader');
  if (!headerEl) return;

  const matrix = document.querySelector('.plano-matrix');
  if (!matrix) return;

  const headerRect = headerEl.getBoundingClientRect();
  const matrixRect = matrix.getBoundingClientRect();
  if (!headerRect.width) return;

  const left = matrixRect.left - headerRect.left;
  const rightOffset = headerRect.right - matrixRect.right;
  headerEl.style.setProperty('--com-band-w', `${Math.max(0, left)}px`);
  headerEl.style.setProperty('--com-band-track-right', `${rightOffset}px`);

  // Reposiciona cada marcador del header sobre el P(0) real del seu
  // compàs. El render base del component usa percentatges sobre el track,
  // que NO coincideixen amb les columnes en píxels quan `columnSizing:
  // 'px'` (amb 4 polsos i visibleColumns 12, el track ocupa el 33%
  // mentre que 25/50/75% no apunten als compassos). Mesurem la
  // cel·la `colIndex = i * compas` de qualsevol fila i traduïm la
  // seva x al track-space per assignar `--marker-left` en píxels. */
  const trackEl = headerEl.querySelector('.measure-header__track');
  if (!trackEl || compas == null || cycles == null) return;
  const trackRect = trackEl.getBoundingClientRect();
  if (!trackRect.width) return;
  const markers = headerEl.querySelectorAll('.measure-marker');
  markers.forEach((marker, i) => {
    const colIndex = i * compas;
    const cell = matrix.querySelector(`.plano-cell[data-col-index="${colIndex}"]`);
    if (!cell) return;
    const cellRect = cell.getBoundingClientRect();
    const px = cellRect.left - trackRect.left;
    marker.style.setProperty('--marker-left', `${px}px`);
  });
}

window.addEventListener('resize', () => {
  if (measureHeader) syncMeasureHeaderBandWidth();
  // El playhead usa `cellWidth = matrixContainer.clientWidth / 12`, així
  // que canvia amb el resize. Si està visible, repintem-lo a la columna
  // actual perquè se reposicioni amb la nova mida de cel·la.
  if (grid && grid.isPlayheadVisible && grid.isPlayheadVisible()) {
    const col = grid.getPlayheadColumn?.();
    if (typeof col === 'number' && col >= 0) {
      grid.updatePlayhead(col);
    }
  }
});

/**
 * Update grid when parameters change
 */
function updateGrid() {
  if (!grid) return;

  const totalPulses = getTotalPulses();
  if (totalPulses > 0) {
    grid.updateColumns(totalPulses);
    grid.setCompas(compas || 1);

    // Re-add dots to all cells (they get removed when grid refreshes)
    if (syncController) {
      syncController.refreshDots();
    }
  }

  // Mantenim el measure-header sincronitzat amb compas + cycles.
  // Amb `columnSizing: 'px'`, l'amplada de la matriu canvia amb cada
  // canvi de compas/cycles. El doble rAF dona temps al grid a aplicar
  // la nova `grid-template-columns: repeat(N, Wpx)` abans de mesurar.
  if (measureHeader) {
    measureHeader.render(compas, cycles);
    requestAnimationFrame(() => requestAnimationFrame(() => syncMeasureHeaderBandWidth()));
  }
}

/**
 * Sync Grid 2D from pairs - wrapper for sync controller
 */
function syncGridFromPairs(pairs) {
  if (syncController) {
    syncController.syncGridFromPairs(pairs);
  }
  // Després de la sincronització de cel·les, repintem els halters d'iT
  // sota cada nota (estil App15).
  renderItHalterCellLayer(pairs);
}

/**
 * Render iT halters DINS la grid, sota cada cel·la activa (estil App15/App13).
 * Cada parell { note, registry, pulse, temporalInterval, isRest } produeix un
 * halter ancorat a la vora inferior de la cel·la inicial, ocupant les iT
 * cel·les contigües. Variant 'dashed' per silencis.
 *
 * Aquesta capa es crea dins el `.plano-matrix-container` perquè el seu
 * inset:0 cobreixi exactament la matriu (sense desbordar al timeline).
 */
function renderItHalterCellLayer(pairs) {
  const gridContainer = document.querySelector('.timeline-wrapper');
  if (!gridContainer) return;
  const matrixContainer = gridContainer.querySelector('.plano-matrix-container');
  if (!matrixContainer) return;
  // L'ancoratge va a `.plano-matrix` (NO al `.plano-matrix-container`):
  // - `.plano-matrix` ja té `position: relative` (és el grid de cel·les).
  // - La seva amplada (`min-width: max-content`) inclou tots els compassos
  //   amb el `margin-left: var(--plano-margin-left)` aplicat. Ancorar el
  //   layer aquí garanteix que els % coincideixen amb les cel·les.
  // - El container és el que fa scroll horitzontal; com el layer viu dins
  //   la matrix, scrolleja amb les cel·les automàticament.
  const matrix = matrixContainer.querySelector('.plano-matrix');
  if (!matrix) return;

  let layer = matrix.querySelector('#it-bar-cell-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'it-bar-cell-layer';
    layer.className = 'it-bar-cell-layer';
    matrix.appendChild(layer);
  }
  layer.innerHTML = '';

  const visible = (pairs || []).filter(p =>
    p && p.note != null && p.pulse != null && p.registry != null
  );
  if (visible.length === 0) return;

  const matrixRect = matrix.getBoundingClientRect();
  if (!matrixRect.width || !matrixRect.height) return;

  visible.forEach(p => {
    const iT = Math.max(1, p.temporalInterval || 1);
    const startCol = p.pulse;
    const endCol = startCol + iT - 1;
    const rowId = `${p.note}r${p.registry}`;

    const startCell = matrix.querySelector(
      `.plano-cell[data-row-id="${rowId}"][data-col-index="${startCol}"]`
    );
    const endCell = matrix.querySelector(
      `.plano-cell[data-row-id="${rowId}"][data-col-index="${endCol}"]`
    );
    if (!startCell || !endCell) return;

    const startRect = startCell.getBoundingClientRect();
    const endRect = endCell.getBoundingClientRect();
    const nextCell = matrix.querySelector(
      `.plano-cell[data-row-id="${rowId}"][data-col-index="${endCol + 1}"]`
    );

    const halter = createIntervalLabelBar({
      startPercent: 0,
      widthPercent: 100,
      label: iT,
      variant: p.isRest ? 'dashed' : 'solid'
    });

    const dotOffset = getCellDotCenterOffset(startCell, startRect);
    const startX = getCellDotCenterX(startCell, startRect, matrixRect, dotOffset);
    const endX = nextCell
      ? getCellDotCenterX(nextCell, nextCell.getBoundingClientRect(), matrixRect, dotOffset)
      : endRect.right + dotOffset - matrixRect.left;
    // A plano-modular les cel·les actives renderitzen la barra blava amb
    // `::before { bottom: -50%; height: 100% }`, així que la vora inferior
    // VISUAL de la barra cau a `cell.bottom + cell.height/2`, no a
    // `cell.bottom`. Sumem mig cell-height perquè el halter s'enganxi
    // a la vora real de la barra (com a App15 amb la fletxa rosa).
    const cellH = startRect.height;
    const visualBottom = startRect.bottom + cellH / 2;
    const bottomPct = ((visualBottom - matrixRect.top) / matrixRect.height) * 100;

    halter.style.left = `${startX}px`;
    halter.style.width = `${Math.max(0, endX - startX)}px`;
    halter.style.top = `${bottomPct}%`;

    layer.appendChild(halter);
  });
}

function getCellDotCenterOffset(cell, cellRect) {
  const dot = cell.querySelector('.np-dot');
  if (dot) {
    const dotRect = dot.getBoundingClientRect();
    return dotRect.left + dotRect.width / 2 - cellRect.left;
  }

  const raw = getComputedStyle(cell).getPropertyValue('--plano-dot-center-x').trim();
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 4;
}

function getCellDotCenterX(cell, cellRect, matrixRect, fallbackOffset) {
  const dot = cell.querySelector('.np-dot');
  if (dot) {
    const dotRect = dot.getBoundingClientRect();
    return dotRect.left + dotRect.width / 2 - matrixRect.left;
  }
  return cellRect.left + fallbackOffset - matrixRect.left;
}

/**
 * Mark bar edges for continuous bar CSS rendering.
 * Adds 'has-duration' to selected cells that have duration extensions,
 * and 'duration-last' to the last cell in each duration run.
 */
function markBarEdges() {
  const mc = syncController?.getMatrixContainer();
  if (!mc) return;

  // Clear old marks
  mc.querySelectorAll('.has-duration').forEach(c => c.classList.remove('has-duration'));
  mc.querySelectorAll('.duration-last').forEach(c => c.classList.remove('duration-last'));
  mc.querySelectorAll('.drag-last').forEach(c => c.classList.remove('drag-last'));

  // For each selected cell, check if the next cell on the same row is duration-highlight
  mc.querySelectorAll('.plano-cell.plano-selected').forEach(cell => {
    const rowId = cell.dataset.rowId;
    const col = parseInt(cell.dataset.colIndex);
    const next = mc.querySelector(`.plano-cell[data-row-id="${rowId}"][data-col-index="${col + 1}"].duration-highlight`);
    if (next) cell.classList.add('has-duration');
  });

  // Find last duration-highlight in each run
  mc.querySelectorAll('.plano-cell.duration-highlight').forEach(cell => {
    const rowId = cell.dataset.rowId;
    const col = parseInt(cell.dataset.colIndex);
    const next = mc.querySelector(`.plano-cell[data-row-id="${rowId}"][data-col-index="${col + 1}"].duration-highlight`);
    if (!next) cell.classList.add('duration-last');
  });
}

/**
 * Initialize the nuzic N-iT zigzag editor
 * Pattern: N row (pink) + iT row (yellow) with zigzag offset
 * N: [value][pink sep] | iT: [yellow sep][value]
 */
function initGridEditor() {
  const container = elements.gridEditorContainer;
  if (!container) {
    console.warn('Grid editor container not found');
    return;
  }
  container.innerHTML = '';

  // ---- DOM structure ----
  // N row (pink)
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

  // iT row (yellow)
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
  let entries = []; // [{note, registry, temporalInterval, isRest}]
  let pendingN = null; // {note, registry} or 'S' or null
  let pendingIT = null; // number or null
  let lastEnteredType = 'it'; // start focus on N (zigzag: opposite of last)
  let autoJumpTimer = null;

  function getMaxPulses() { return getTotalPulses(); }
  function getCurrentSum() { return entries.reduce((s, e) => s + (e.temporalInterval || 0), 0); }

  // ---- Tooltip ----
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

  // ---- Parse N input ----
  function parseNoteInput(val) {
    // NrR format (e.g., "5r4")
    const match = val.match(/^(\d+)r(\d+)$/);
    if (match) return { note: parseInt(match[1]), registry: parseInt(match[2]) };
    // Just a number → use last entry's registry, or DEFAULT_REGISTRO (4) if first
    const num = parseInt(val);
    if (!isNaN(num) && num >= 0 && num <= 11) {
      const lastEntry = [...entries].reverse().find(e => !e.isRest);
      const reg = lastEntry ? lastEntry.registry : CONFIG.DEFAULT_REGISTRO;
      return { note: num, registry: reg };
    }
    return null;
  }

  function formatN(entry) {
    if (entry.isRest) return 'S';
    return `${entry.note}r${entry.registry}`;
  }

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
    cell.maxLength = type === 'n' ? 5 : 2;
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

      const idx = parseInt(cell.dataset.entryIndex);
      const entry = entries[idx];
      if (!entry) { cell.value = originalValue; return; }

      if (type === 'n') {
        if (/^[sS]$/.test(val)) {
          entry.isRest = true;
          entry.note = 0;
          entry.registry = CONFIG.DEFAULT_REGISTRO;
        } else {
          const parsed = parseNoteInput(val);
          if (!parsed) {
            showTooltip(cell, 'Format: NrR (ex: 5r4) o S');
            cell.value = originalValue;
            return;
          }
          const v = validateNoteRegistry(parsed.note, parsed.registry);
          if (!v.valid) { showTooltip(cell, v.message); cell.value = originalValue; return; }
          entry.note = parsed.note;
          entry.registry = parsed.registry;
          entry.isRest = false;
        }
      } else {
        const num = parseInt(val);
        if (isNaN(num) || num < 1) {
          showTooltip(cell, 'iT debe ser ≥ 1');
          cell.value = originalValue;
          return;
        }
        const oldIT = entry.temporalInterval;
        const newSum = getCurrentSum() - oldIT + num;
        if (newSum > getMaxPulses()) {
          showTooltip(cell, `iT máximo: ${getMaxPulses() - getCurrentSum() + oldIT}`);
          cell.value = originalValue;
          return;
        }
        entry.temporalInterval = num;
      }

      notifyChange();
      renderCells();
    });

    cell.addEventListener('keydown', (e) => {
      // Enter: confirm edit (trigger blur)
      if (e.key === 'Enter') { e.preventDefault(); cell.blur(); return; }

      // Tab: confirm and move to next editable cell
      if (e.key === 'Tab') {
        e.preventDefault();
        cell.blur();
        const parent = type === 'n' ? nCells : itCells;
        const allCells = Array.from(parent.querySelectorAll('.nit-editor-cell:not([readonly])'));
        const idx = allCells.indexOf(cell);
        const next = e.shiftKey ? allCells[idx - 1] : allCells[idx + 1];
        if (next) next.focus();
        return;
      }

      // Arrow left/right: navigate between value cells
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const parent = type === 'n' ? nCells : itCells;
        const allCells = Array.from(parent.querySelectorAll('.nit-editor-cell:not([readonly])'));
        const idx = allCells.indexOf(cell);
        const next = e.key === 'ArrowRight' ? allCells[idx + 1] : allCells[idx - 1];
        if (next) { e.preventDefault(); next.focus(); }
      }

      // Arrow up/down: jump between N and iT rows
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const otherRow = type === 'n' ? itCells : nCells;
        const entryIdx = parseInt(cell.dataset.entryIndex);
        // Find the matching value cell in the other row
        const match = otherRow.querySelector(`.nit-editor-cell[data-entry-index="${entryIdx}"]:not([readonly])`);
        if (match) match.focus();
      }
    });

    return cell;
  }

  function createInputCell(type) {
    const cell = document.createElement('input');
    cell.type = 'text';
    cell.inputMode = type === 'it' ? 'numeric' : 'text';
    cell.maxLength = type === 'n' ? 5 : 2;
    cell.className = `nit-editor-cell ${type}-cell active-input`;
    cell.readOnly = false;

    cell.addEventListener('input', (e) => {
      const val = e.target.value;
      if (val === '' || val === '-' || val === '+') return;

      if (type === 'n') {
        // Accept S for silence
        if (/^[sS]$/.test(val)) {
          pendingN = 'S';
          lastEnteredType = 'n';
          clearTimeout(autoJumpTimer);
          autoJumpTimer = setTimeout(() => {
            const itInput = itCells.querySelector('.active-input');
            if (itInput) itInput.focus();
          }, 300);
          return;
        }

        // Partial NrR: "5r" — waiting for registry digit
        if (/^\d+r$/.test(val)) return;

        // Bare number (e.g., "5" or "11"): could become "5r4" — wait before parsing
        if (/^\d+$/.test(val)) {
          clearTimeout(autoJumpTimer);
          autoJumpTimer = setTimeout(() => {
            // Re-read cell value in case user kept typing
            const current = cell.value;
            if (/^\d+r/.test(current)) return; // user started typing NrR
            const parsed = parseNoteInput(current);
            if (!parsed) return;
            const v = validateNoteRegistry(parsed.note, parsed.registry);
            if (!v.valid) { showTooltip(cell, v.message); cell.value = ''; return; }
            pendingN = parsed;
            lastEnteredType = 'n';
            if (pendingIT !== null) commitEntry();
            else {
              const itInput = itCells.querySelector('.active-input');
              if (itInput) itInput.focus();
            }
          }, 800);
          return;
        }

        // Full NrR (e.g., "5r4"): parse immediately
        const parsed = parseNoteInput(val);
        if (!parsed) { e.target.value = ''; return; }

        const v = validateNoteRegistry(parsed.note, parsed.registry);
        if (!v.valid) {
          showTooltip(cell, v.message);
          e.target.value = '';
          clearTimeout(autoJumpTimer);
          return;
        }

        pendingN = parsed;
        lastEnteredType = 'n';

        clearTimeout(autoJumpTimer);
        autoJumpTimer = setTimeout(() => {
          if (pendingIT !== null) commitEntry();
          else {
            const itInput = itCells.querySelector('.active-input');
            if (itInput) itInput.focus();
          }
        }, 300);

      } else {
        // iT input: positive integer bounded by remaining pulses
        // (getMaxPulses() - getCurrentSum()). App20 has variable
        // `getTotalPulses() = compas * cycles` (up to 28), so no hardcoded
        // upper bound — only the `remaining` check caps iT.
        if (!/^\d+$/.test(val)) { e.target.value = ''; return; }
        const num = parseInt(val);

        if (num < 1) {
          showTooltip(cell, 'iT debe ser ≥ 1');
          e.target.value = '';
          clearTimeout(autoJumpTimer);
          return;
        }

        const remaining = getMaxPulses() - getCurrentSum();
        if (num > remaining) {
          showTooltip(cell, `iT máximo: ${remaining}`);
          e.target.value = '';
          clearTimeout(autoJumpTimer);
          return;
        }

        // Single digit that could still extend to a valid 2-digit value:
        // wait ~500ms before committing. If a second digit arrives, the
        // input handler re-fires with the 2-digit string.
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

        if (pendingN !== null) {
          clearTimeout(autoJumpTimer);
          commitEntry();
        } else {
          clearTimeout(autoJumpTimer);
          autoJumpTimer = setTimeout(() => {
            const nInput = nCells.querySelector('.active-input');
            if (nInput) nInput.focus();
          }, 300);
        }
      }
    });

    cell.addEventListener('keydown', (e) => {
      // Enter / Tab → confirm current value and jump to zigzag partner
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        clearTimeout(autoJumpTimer);

        // If cell has a value, process it first (trigger input handler)
        if (cell.value) {
          cell.dispatchEvent(new Event('input'));
        }

        // Jump to the other row's input
        if (type === 'n') {
          // If both pending, commit immediately
          if (pendingN !== null && pendingIT !== null) { commitEntry(); return; }
          const itInput = itCells.querySelector('.active-input');
          if (itInput) itInput.focus();
        } else {
          if (pendingN !== null && pendingIT !== null) { commitEntry(); return; }
          const nInput = nCells.querySelector('.active-input');
          if (nInput) nInput.focus();
        }
        return;
      }

      // Backspace on empty: delete last entry or pending value
      if (e.key === 'Backspace' && !e.target.value) {
        e.preventDefault();
        clearTimeout(autoJumpTimer);

        if (type === 'it') {
          if (pendingIT !== null) {
            pendingIT = null;
          } else if (pendingN !== null) {
            pendingN = null;
            const nInput = nCells.querySelector('.active-input');
            if (nInput) { nInput.value = ''; nInput.focus(); }
          } else if (entries.length > 0) {
            entries.pop();
            notifyChange();
            renderCells();
          }
        } else {
          if (pendingN !== null) {
            pendingN = null;
          } else if (entries.length > 0) {
            entries.pop();
            notifyChange();
            renderCells();
          }
        }
        return;
      }

      // Arrow keys: navigate between value cells on this row
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const parent = type === 'n' ? nCells : itCells;
        const allCells = Array.from(parent.querySelectorAll('.nit-editor-cell:not([readonly])'));
        const idx = allCells.indexOf(cell);
        const next = e.key === 'ArrowRight' ? allCells[idx + 1] : allCells[idx - 1];
        if (next) { e.preventDefault(); next.focus(); }
      }

      // Arrow up/down: jump between N and iT rows
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const otherRow = type === 'n' ? itCells : nCells;
        const target = otherRow.querySelector('.active-input') || otherRow.querySelector('.nit-editor-cell:not([readonly])');
        if (target) target.focus();
      }
    });

    return cell;
  }

  // ---- Commit ----
  function commitEntry() {
    if (pendingN === null || pendingIT === null) return;

    if (pendingN === 'S') {
      entries.push({ note: 0, registry: CONFIG.DEFAULT_REGISTRO, temporalInterval: pendingIT, isRest: true });
    } else {
      entries.push({ note: pendingN.note, registry: pendingN.registry, temporalInterval: pendingIT, isRest: false });
    }

    pendingN = null;
    pendingIT = null;

    notifyChange();
    renderCells();

    if (getCurrentSum() >= getMaxPulses()) {
      showTooltip(itEnd, 'Longitud completa');
    }
  }

  // ---- Sync ----
  function entriesToPairs() {
    let pulse = 0;
    return entries.map(e => {
      const pair = { note: e.note, registry: e.registry, pulse, temporalInterval: e.temporalInterval, isRest: e.isRest || false };
      pulse += e.temporalInterval;
      return pair;
    });
  }

  function notifyChange() {
    const pairs = entriesToPairs();
    currentPairs = pairs;

    // Skip sync if update came from drag
    if (dragHandler?.isFromDrag()) return;

    syncGridFromPairs(pairsWithSilencesForEditor(pairs));

    // Auto-scroll to last note
    if (!isPlaying && entries.length > 0) {
      const last = [...entries].reverse().find(e => !e.isRest);
      if (last) scrollToNote(last.note, last.registry, true);
    }
  }

  // ---- Render ----
  function renderCells() {
    nCells.querySelectorAll('.nit-editor-cell').forEach(c => c.remove());
    itCells.querySelectorAll('.nit-editor-cell').forEach(c => c.remove());

    const sum = getCurrentSum();
    const maxPulses = getMaxPulses();

    // Committed entries (zigzag)
    // Pols acumulat: l'entry i sona al pols = suma de temporalInterval[0..i-1]
    // (mateix càlcul que `entriesToPairs`, que alimenta el midiMap del play).
    let cumulativePulse = 0;
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];

      // N row: [value][pink sep]
      const nValueCell = createValueCell('n', formatN(entry), i);
      nValueCell.dataset.pulse = String(cumulativePulse);
      nValueCell.dataset.it = String(entry.temporalInterval);
      nCells.insertBefore(nValueCell, nEnd);
      nCells.insertBefore(createReadonlyCell('n'), nEnd);

      // iT row: [yellow sep][value]  (zigzag offset)
      itCells.insertBefore(createReadonlyCell('it'), itEnd);
      const itValueCell = createValueCell('it', String(entry.temporalInterval), i);
      itValueCell.dataset.pulse = String(cumulativePulse);
      itValueCell.dataset.it = String(entry.temporalInterval);
      itCells.insertBefore(itValueCell, itEnd);

      cumulativePulse += entry.temporalInterval;
    }

    // Input cells (if not full)
    if (sum < maxPulses && maxPulses > 0) {
      // N: [input][pink readonly]
      const nInput = createInputCell('n');
      nCells.insertBefore(nInput, nEnd);
      nCells.insertBefore(createReadonlyCell('n'), nEnd);

      // iT: [yellow readonly][input]  (zigzag)
      itCells.insertBefore(createReadonlyCell('it'), itEnd);
      const itInput = createInputCell('it');
      itCells.insertBefore(itInput, itEnd);

      // Focus based on zigzag: opposite of last entered
      const focusTarget = lastEnteredType === 'n' ? itInput : nInput;
      setTimeout(() => focusTarget?.focus(), 30);
    }

    // End markers
    nEnd.style.display = sum >= maxPulses && maxPulses > 0 ? 'flex' : 'none';
    itEnd.style.display = sum >= maxPulses && maxPulses > 0 ? 'flex' : 'none';
  }

  // Initial render
  renderCells();

  // ---- Public API ----
  gridEditor = {
    getPairs: () => entriesToPairs().map(p => ({ ...p })),

    setPairs: (pairs) => {
      // Accept both notes and silences
      entries = pairs
        .filter(p => (p.note != null && p.note !== undefined) || p.isRest)
        .map(p => ({
          note: p.isRest ? 0 : p.note,
          registry: p.isRest ? CONFIG.DEFAULT_REGISTRO : (p.registry ?? CONFIG.DEFAULT_REGISTRO),
          temporalInterval: p.temporalInterval || 1,
          isRest: p.isRest || false
        }));
      pendingN = null;
      pendingIT = null;
      clearTimeout(autoJumpTimer);
      renderCells();
    },

    clear: () => {
      entries = [];
      pendingN = null;
      pendingIT = null;
      clearTimeout(autoJumpTimer);
      renderCells();
    },

    clearHighlights: () => {}, // Required no-op

    destroy: () => {
      clearTimeout(autoJumpTimer);
      container.innerHTML = '';
    },

    focusFirstNCell: () => {
      const input = nCells.querySelector('.active-input');
      if (input) setTimeout(() => input.focus(), 30);
    }
  };
}

/**
 * Update grid-editor when Compás/Cycles change
 */
function updateGridEditorMaxPulse() {
  if (!gridEditor) return;
  const totalPulses = getTotalPulses();
  if (totalPulses <= 0) return;

  // Trim entries that exceed new max
  const pairs = gridEditor.getPairs().filter(p => !p.isRest);
  let sum = 0;
  const valid = [];
  for (const p of pairs) {
    if (sum + (p.temporalInterval || 1) > totalPulses) break;
    valid.push(p);
    sum += p.temporalInterval || 1;
  }
  gridEditor.setPairs(valid);
}

/**
 * Calculate scrollTop for a screen so that ALL its notes are visible.
 * Notes use translateY(50%) so labels straddle the cell bottom border.
 */
function getScreenScrollTop(screen) {
  const gridContainer = document.querySelector('.timeline-wrapper');
  const container = gridContainer?.querySelector('.plano-soundline-container');
  const visibleHeight = container?.clientHeight || (21 * CELL_H);
  const bottomEdge = (screen.lastRow + 1) * CELL_H + HALF_CELL;
  return Math.max(0, bottomEdge - visibleHeight);
}

/**
 * Donat un scrollTop arbitrari, retorna la `SCREEN` que millor coincideix
 * (la més propera al snap). S'utilitza per actualitzar la pastilla
 * `Registro` mentre la soundline es desplaça — incloent durant play, on
 * el scroll passa per posicions arbitràries entre registres.
 */
function getScreenForScrollTop(scrollTop) {
  let bestScreen = SCREENS[0];
  let bestDistance = Infinity;
  for (const screen of SCREENS) {
    const screenTop = getScreenScrollTop(screen);
    const distance = Math.abs(screenTop - scrollTop);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestScreen = screen;
    }
  }
  return bestScreen;
}

const SCROLL_DURATION = 650;  // ms for screen transitions

function scrollToScreen(screenIndex, animated = false) {
  if (!grid) return;
  screenIndex = Math.max(0, Math.min(SCREENS.length - 1, screenIndex));
  currentScreen = screenIndex;

  const screen = SCREENS[screenIndex];
  const scrollTop = getScreenScrollTop(screen);
  const gridContainer = document.querySelector('.timeline-wrapper');
  const soundline = gridContainer?.querySelector('.plano-soundline-container');
  const matrix = gridContainer?.querySelector('.plano-matrix-container');

  if (animated) {
    [soundline, matrix].forEach(el => {
      if (el) smoothScrollTo(el, scrollTop, 'top', SCROLL_DURATION, 'easeInOut');
    });
  } else {
    [soundline, matrix].forEach(el => {
      if (el) el.scrollTop = scrollTop;
    });
  }

  if (elements.registroText) {
    elements.registroText.value = screen.label;
  }
}

/**
 * Pre-compute a scroll plan for playback.
 * For each pulse with a note, check if it's visible and schedule minimum scroll.
 */
function buildScrollPlan(selectedArray, rows) {
  const gridContainer = document.querySelector('.timeline-wrapper');
  const container = gridContainer?.querySelector('.plano-soundline-container');
  const visibleHeight = container?.clientHeight || (21 * CELL_H);
  const margin = 2;

  let currentTop = container?.scrollTop || 0;
  const plan = [];

  for (let step = 0; step < 1000; step++) {
    const sel = selectedArray.find(s => s.colIndex === step);
    if (!sel) continue;

    const rowIdx = rows.findIndex(r => r.id === sel.rowId);
    if (rowIdx === -1) continue;

    const noteTop = rowIdx * CELL_H;
    const noteBottom = noteTop + CELL_H + HALF_CELL;

    const windowTop = currentTop;
    const windowBottom = currentTop + visibleHeight;

    let newTop = currentTop;

    if (noteTop - margin * CELL_H < windowTop) {
      newTop = Math.max(0, noteTop - margin * CELL_H);
    } else if (noteBottom + margin * CELL_H > windowBottom) {
      newTop = noteBottom + margin * CELL_H - visibleHeight;
    }

    if (Math.abs(newTop - currentTop) > CELL_H / 2) {
      const distance = Math.abs(newTop - currentTop);
      const duration = Math.min(800, Math.max(300, distance * 1.2));
      plan.push({ step, scrollTop: newTop, duration });
      currentTop = newTop;
    }
  }

  // Look-ahead: shift each scroll 1 step earlier
  return plan.map(entry => ({
    ...entry,
    step: Math.max(0, entry.step - 1)
  }));
}

/**
 * Detect current screen from scrollTop (free-scroll aware).
 */
function detectCurrentScreen() {
  const gridContainer = document.querySelector('.timeline-wrapper');
  const container = gridContainer?.querySelector('.plano-soundline-container');
  if (!container) return currentScreen;

  const scrollTop = container.scrollTop;
  let closest = 0;
  let minDist = Infinity;
  for (let i = 0; i < SCREENS.length; i++) {
    const target = getScreenScrollTop(SCREENS[i]);
    const dist = Math.abs(scrollTop - target);
    if (dist < minDist) { minDist = dist; closest = i; }
  }
  return closest;
}

/**
 * Scroll to a specific note within a registry
 */
function scrollToNote(note, registry, animated = false) {
  if (!grid) return;
  const targetRowId = `${note}r${registry}`;
  const rows = grid.getRowDefinitions();
  const rowIdx = rows.findIndex(r => r.id === targetRowId);
  if (rowIdx === -1) return;

  const gridContainer = document.querySelector('.timeline-wrapper');
  const container = gridContainer?.querySelector('.plano-soundline-container');
  if (!container) return;

  const noteTop = rowIdx * CELL_H;
  const noteBottom = noteTop + CELL_H + HALF_CELL;
  const visibleHeight = container.clientHeight;
  const scrollTop = container.scrollTop;

  // Only scroll if note is outside visible window
  if (noteTop < scrollTop || noteBottom > scrollTop + visibleHeight) {
    const target = Math.max(0, noteTop - 2 * CELL_H);
    const soundline = gridContainer?.querySelector('.plano-soundline-container');
    const matrix = gridContainer?.querySelector('.plano-matrix-container');
    [soundline, matrix].forEach(el => {
      if (el) smoothScrollTo(el, target, 'top', 400, 'easeInOut');
    });
  }
}

function incrementRegistro() {
  currentScreen = detectCurrentScreen();
  if (currentScreen < SCREENS.length - 1) {
    scrollToScreen(currentScreen + 1, true);
  }
}

function decrementRegistro() {
  currentScreen = detectCurrentScreen();
  if (currentScreen > 0) {
    scrollToScreen(currentScreen - 1, true);
  }
}

// ========== INPUT HANDLERS ==========

/**
 * Handle Compás input change
 */
function handleCompasChange({ updateEditor = false, autoFocus = false } = {}) {
  const value = elements.inputCompas?.value?.trim();

  if (value === '') {
    compas = null;
  } else {
    const num = parseInt(value, 10);
    if (!isNaN(num)) {
      compas = Math.max(CONFIG.MIN_COMPAS, Math.min(CONFIG.MAX_COMPAS, num));
      elements.inputCompas.value = compas;
      if (autoFocus) {
        elements.inputCycle?.focus();
        elements.inputCycle?.select();
      }
    }
  }

  updateLongitud();
  updateGridVisibility();
  updateGrid();

  if (updateEditor) {
    updateGridEditorMaxPulse();
  }
}

/**
 * Handle Nº Compases (cycles) input change
 */
function handleCyclesChange({ updateEditor = false } = {}) {
  const value = elements.inputCycle?.value?.trim();

  if (value === '') {
    cycles = null;
  } else {
    const num = parseInt(value, 10);
    if (!isNaN(num)) {
      cycles = Math.max(CONFIG.MIN_CYCLES, Math.min(CONFIG.MAX_CYCLES, num));
      elements.inputCycle.value = cycles;
    }
  }

  if (elements.cycleDigit) {
    elements.cycleDigit.textContent = cycles !== null ? String(cycles) : '';
  }

  updateLongitud();
  updateGridVisibility();
  updateGrid();

  // Only recreate grid editor on confirmed changes (spinners, Enter),
  // NOT on every keystroke — recreating the editor steals focus from the input
  if (updateEditor) {
    updateGridEditorMaxPulse();
  }
}

// ========== PLAYBACK ==========

/**
 * Toggle playback
 */
async function togglePlayback() {
  if (isPlaying) {
    stopPlayback();
  } else {
    await startPlayback();
  }
}

/**
 * Start playback
 */
async function startPlayback() {
  // Check if current instrument is loaded (per-app key to match header writes)
  const currentInstrument = localStorage.getItem('app20:selectedInstrument') || 'piano';
  const isInstrumentLoaded = currentInstrument === 'flute' ? isFluteLoaded() : isPianoLoaded();

  // Show loading indicator if instrument not yet loaded
  const iconPlay = elements.playBtn?.querySelector('.icon-play');
  const iconStop = elements.playBtn?.querySelector('.icon-stop');
  let wasLoading = false;

  if (!isInstrumentLoaded && elements.playBtn) {
    wasLoading = true;
    elements.playBtn.disabled = true;
    if (iconPlay) iconPlay.style.opacity = '0.5';
  }

  const audioInstance = await initAudio();

  // Restore button state after loading
  if (wasLoading && elements.playBtn) {
    elements.playBtn.disabled = false;
    if (iconPlay) iconPlay.style.opacity = '1';
  }

  if (!audioInstance) return;

  const Tone = window.Tone;
  if (!Tone) return;

  const totalPulses = getTotalPulses();
  if (totalPulses === 0) return;

  const bpm = bpmController?.getValue() || CONFIG.DEFAULT_BPM;
  const intervalSec = 60 / bpm;

  // Get MIDI notes from grid selection
  const midiMap = grid.getSelectedMidiNotes();

  // Pre-compute scroll plan before playback starts
  const selectedArray = grid.getSelectedArray();
  const scrollPlan = buildScrollPlan(selectedArray, grid.getRowDefinitions());
  let scrollPlanIndex = 0;

  // Build pulse → pair map for accessing temporalInterval during playback
  const pulsePairMap = new Map();
  currentPairs.forEach(pair => {
    if (pair.note !== null && pair.note !== undefined) {
      pulsePairMap.set(pair.pulse, pair);
    }
  });

  isPlaying = true;
  elements.playBtn?.classList.add('playing');
  if (elements.randomBtn) elements.randomBtn.disabled = true;

  // La pastilla `cycle` es manté com a input pla durant tota la
  // reproducció (no swap input→dígit). El número que entra l'usuari és
  // l'únic valor visible.

  // Switch to stop icon (iconPlay and iconStop already declared above)
  if (iconPlay) iconPlay.style.display = 'none';
  if (iconStop) iconStop.style.display = 'block';

  // Configure measure for P0 sound
  audioInstance.configureMeasure(compas, totalPulses);

  // Apply P0 toggle state
  const p0Enabled = window.__p1Controller?.getState() ?? true;
  audioInstance.setMeasureEnabled(p0Enabled);

  // Scroll to first pulse before starting playback
  grid.scrollToColumn(0, false);

  // Register note provider BEFORE play (declarative scheduling)
  audioInstance.registerNoteProvider('melody', (step) => {
    const midi = midiMap.get(step);
    if (midi !== undefined) {
      const pair = pulsePairMap.get(step);
      const iT = pair?.temporalInterval || 1;
      const noteDuration = intervalSec * iT * 0.95;
      return [{ midi, duration: noteDuration, velocity: 0.8 }];
    }
    return null;
  });

  audioInstance.play(
    totalPulses,
    intervalSec,
    new Set(),
    false,  // No loop
    (step) => {
      // onPulse callback: visual feedback only

      // 1. Update playhead position
      grid.updatePlayhead(step);

      // 2. Autoscroll VERTICAL: execute pre-computed scroll plan
      while (scrollPlanIndex < scrollPlan.length && scrollPlan[scrollPlanIndex].step <= step) {
        const entry = scrollPlan[scrollPlanIndex];
        const gridContainer = document.querySelector('.timeline-wrapper');
        const soundline = gridContainer?.querySelector('.plano-soundline-container');
        const matrix = gridContainer?.querySelector('.plano-matrix-container');
        [soundline, matrix].forEach(el => {
          if (el) smoothScrollTo(el, entry.scrollTop, 'top', entry.duration, 'easeInOut');
        });
        scrollPlanIndex++;
      }

      // 3. Highlight timeline number
      grid.highlightTimelineNumber(step, intervalSec * 1000 * 0.9);

      // 4. Highlight the selected cell (visual only)
      const midi = midiMap.get(step);
      if (midi !== undefined) {
        const selected = grid.getSelectedArray().find(s => s.colIndex === step);
        if (selected) {
          grid.highlightCell(selected.rowId, step, intervalSec * 1000 * 0.9);
        }
      }

      // 4b. Highlight de l'EDITOR (N + iT): dura tant com l'iT de la nota
      // (com App34/35). Toggle per rang re-avaluat a cada pols: la cel·la
      // queda encesa mentre `start <= step < start + iT`.
      document.querySelectorAll('.nit-editor-cell[data-pulse]').forEach(c => {
        const start = parseInt(c.dataset.pulse, 10);
        const it = parseInt(c.dataset.it, 10) || 1;
        c.classList.toggle('active', step >= start && step < start + it);
      });

      // 5. Cycle counter durant play: deshabilitat (input pla, no swap).

      // 6. Auto-scroll HORIZONTAL to keep pulse visible
      grid.scrollToColumn(step, false);

      // 7. Update cycle digit color
      updateCycleDigitColor(step);

      // 8. Update total length display with flip animation
      updateTotalLengthDisplay(step);
    },
    () => {
      // onComplete
      setTimeout(() => {
        stopPlayback();
      }, 590);
    }
  );
}

/**
 * Stop playback
 */
function stopPlayback() {
  isPlaying = false;
  elements.playBtn?.classList.remove('playing');
  if (elements.randomBtn) elements.randomBtn.disabled = false;

  // Switch back to play icon
  const iconPlay = elements.playBtn?.querySelector('.icon-play');
  const iconStop = elements.playBtn?.querySelector('.icon-stop');
  if (iconPlay) iconPlay.style.display = 'block';
  if (iconStop) iconStop.style.display = 'none';

  audio?.stop();

  // Show input, hide cycle digit
  const cycleCircle = document.querySelector('.cycle-circle');
  cycleCircle?.classList.remove('playing');

  // Clear highlights
  grid?.clearHighlights();
  grid?.hidePlayhead();

  // Clear highlights de les cel·les de l'editor.
  document.querySelectorAll('.nit-editor-cell.active').forEach(c => c.classList.remove('active'));

  // Clear playback animation classes
  elements.cycleDigit?.classList.remove('playing-zero', 'playing-active', 'flip-out', 'flip-in');
  elements.totalLengthDigit?.classList.remove('playing-zero', 'playing-active', 'flip-out', 'flip-in');

  // Restore displays
  updateLongitud();
  if (elements.cycleDigit && cycles !== null) {
    elements.cycleDigit.textContent = String(cycles);
  }

  console.log('Playback stopped');
}

// ========== RANDOM ==========

function handleRandom() {
  if (isPlaying) return;

  const randCompasMax = parseInt(document.getElementById('randCompasMax')?.value) || CONFIG.MAX_COMPAS;
  const randCyclesMax = parseInt(document.getElementById('randCyclesMax')?.value) || CONFIG.MAX_CYCLES;
  const randBpmMin = parseInt(document.getElementById('randBpmMin')?.value) || CONFIG.MIN_BPM;
  const randBpmMax = parseInt(document.getElementById('randBpmMax')?.value) || CONFIG.MAX_BPM;

  // Random compás (1 to max)
  compas = Math.floor(Math.random() * randCompasMax) + 1;
  elements.inputCompas.value = compas;

  // Random cycles (1 to max)
  cycles = Math.floor(Math.random() * randCyclesMax) + 1;
  elements.inputCycle.value = cycles;
  if (elements.cycleDigit) {
    elements.cycleDigit.textContent = String(cycles);
  }

  // Random BPM
  const newBpm = Math.floor(Math.random() * (randBpmMax - randBpmMin + 1)) + randBpmMin;
  bpmController?.setValue(newBpm);

  // Clear selection and update grid
  grid?.clearSelection();
  updateLongitud();
  updateGridVisibility();
  updateGrid();
  updateGridEditorMaxPulse();

  // Generate random NrX-iT sequence
  const totalPulses = compas * cycles;
  const selectableRegs = [3, 4, 5, 6];
  const pairs = [];

  // Generate random number of notes (between 1 and totalPulses)
  const numNotes = Math.floor(Math.random() * Math.min(totalPulses, 8)) + 1;

  let accumulatedPulse = 0;
  for (let i = 0; i < numNotes && accumulatedPulse < totalPulses; i++) {
    // Random note (0-11)
    const note = Math.floor(Math.random() * CONFIG.NOTES_PER_REGISTRY);
    // Random registry from selectable ones
    const registry = selectableRegs[Math.floor(Math.random() * selectableRegs.length)];
    // Random temporal interval (1 to remaining pulses, max 4)
    const remainingPulses = totalPulses - accumulatedPulse;
    const maxIT = Math.min(4, remainingPulses);
    const temporalInterval = Math.floor(Math.random() * maxIT) + 1;

    pairs.push({
      note,
      registry,
      pulse: accumulatedPulse,
      temporalInterval
    });

    accumulatedPulse += temporalInterval;
  }

  // Fill gaps with silences (note + registry preserved)
  const filledPairs = pairsWithSilencesForEditor(pairs);

  // Update grid-editor with generated pairs (with silences filled in gaps)
  if (gridEditor) {
    gridEditor.setPairs(filledPairs);
  }

  // Sync Grid 2D from pairs (including silences for dotted line visualization)
  syncGridFromPairs(filledPairs);

  // Auto-play after randomizing (consistent across apps 9+).
  if (!isPlaying) togglePlayback();
}

// ========== RESET ==========

function handleReset() {
  // Stop playback if running
  if (isPlaying) {
    stopPlayback();
  }

  // Restore defaults (NOT null — null makes getTotalPulses() return 0 and erases the grid)
  compas = CONFIG.DEFAULT_COMPAS;
  cycles = CONFIG.DEFAULT_CYCLES;

  elements.inputCompas.value = compas;
  elements.inputCycle.value = cycles;

  if (elements.cycleDigit) {
    elements.cycleDigit.textContent = String(cycles);
  }

  // Reset BPM to default
  bpmController?.setValue(CONFIG.DEFAULT_BPM);

  // Clear grid-editor
  gridEditor?.clear();

  // Clear selection on Grid 2D
  grid?.clearSelection();

  // Reset tap tempo if exists
  tapTempoHandler?.reset();

  updateLongitud();
  updateGridVisibility();
  updateGrid();
  updateGridEditorMaxPulse();

  // Reset registry AFTER updateGrid so the grid exists.
  scrollToScreen(getDefaultScreenIndex(), false);

  elements.inputCompas?.focus();
  console.log('Reset complete');
}

// ========== PREFERENCES ==========

function savePreferences() {
  // Only save BPM - compas, cycles and selections are NOT persisted
  preferenceStorage.save({
    bpm: bpmController?.getValue() || CONFIG.DEFAULT_BPM
  });
}

function loadPreferences() {
  const prefs = preferenceStorage.load();
  if (!prefs) return;

  // Only restore BPM - compas, cycles and selections start fresh
  if (prefs.bpm !== undefined && bpmController) {
    bpmController.setValue(prefs.bpm);
  }
}

// ========== EVENT HANDLERS SETUP ==========

// Helper functions for spinners
function incrementCompas() {
  if (compas === null) compas = 0;
  compas = Math.min(CONFIG.MAX_COMPAS, compas + 1);
  elements.inputCompas.value = compas;
  handleCompasChange({ updateEditor: true });
}

function decrementCompas() {
  if (compas === null) return;
  compas = Math.max(CONFIG.MIN_COMPAS, compas - 1);
  elements.inputCompas.value = compas;
  handleCompasChange({ updateEditor: true });
}

function incrementCycles() {
  if (cycles === null) cycles = 0;
  cycles = Math.min(CONFIG.MAX_CYCLES, cycles + 1);
  elements.inputCycle.value = cycles;
  handleCyclesChange({ updateEditor: true });
}

function decrementCycles() {
  if (cycles === null) return;
  cycles = Math.max(CONFIG.MIN_CYCLES, cycles - 1);
  elements.inputCycle.value = cycles;
  handleCyclesChange({ updateEditor: true });
}

function setupEventHandlers() {
  // Listen for instrument changes from dropdown (sharedui header)
  window.addEventListener('sharedui:instrument', async (e) => {
    const { instrument } = e.detail;
    console.log('Instrument changed to:', instrument);

    // Update audio instance if already initialized
    if (audio && audio.setInstrument) {
      await audio.setInstrument(instrument);
    }
  });

  // Compás input with arrow keys
  elements.inputCompas?.addEventListener('input', () => handleCompasChange());
  elements.inputCompas?.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      incrementCompas();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      decrementCompas();
    } else if (e.key === 'Enter') {
      handleCompasChange({ updateEditor: true, autoFocus: true });
    }
  });

  // Confirm compás value when leaving the input
  elements.inputCompas?.addEventListener('blur', () => handleCompasChange({ updateEditor: true }));

  // Compás spinners
  attachSpinnerRepeat(elements.compasUp, incrementCompas);
  attachSpinnerRepeat(elements.compasDown, decrementCompas);

  // Cycles input with arrow keys
  elements.inputCycle?.addEventListener('input', () => handleCyclesChange());
  elements.inputCycle?.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      incrementCycles();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      decrementCycles();
    } else if (e.key === 'Enter') {
      // Confirm value: update grid editor and move focus
      handleCyclesChange({ updateEditor: true });
      if (gridEditor?.focusFirstNCell) {
        gridEditor.focusFirstNCell();
      }
    }
  });

  // Confirm cycles value when leaving the input
  elements.inputCycle?.addEventListener('blur', () => handleCyclesChange({ updateEditor: true }));

  // Cycles: no spinners — inputCycle is typed directly (App17 dual-pill pattern).

  // Registro spinners
  attachSpinnerRepeat(elements.registroUp, incrementRegistro);
  attachSpinnerRepeat(elements.registroDown, decrementRegistro);

  // Play button
  elements.playBtn?.addEventListener('click', togglePlayback);

  // Reset button
  elements.resetBtn?.addEventListener('click', handleReset);
}

// ========== HOVER LABELS ==========

function setupHovers() {
  attachHover(elements.inputCompas, 'Compás (pulsos por ciclo)');
  attachHover(elements.inputCycle, 'Nº de compases a tocar');
  attachHover(elements.registroText, 'Registro visible (octava)');
  attachHover(elements.inputBpm, 'Tempo en pulsos por minuto');
  attachHover(elements.playBtn, 'Reproducir / Detener');
  attachHover(elements.randomBtn, 'Valores aleatorios');
  attachHover(elements.resetBtn, 'Reiniciar valores');
}

// ========== FACTORY RESET ==========

registerFactoryReset({
  storage: preferenceStorage,
  onReset: () => {
    // Restore defaults (NOT null)
    compas = CONFIG.DEFAULT_COMPAS;
    cycles = CONFIG.DEFAULT_CYCLES;

    // Reset UI
    if (elements.inputCompas) elements.inputCompas.value = compas;
    if (elements.inputCycle) elements.inputCycle.value = cycles;
    if (elements.registroText) elements.registroText.value = String(CONFIG.DEFAULT_REGISTRO);
    if (elements.cycleDigit) elements.cycleDigit.textContent = String(cycles);

    // Reset BPM
    bpmController?.setValue(CONFIG.DEFAULT_BPM);

    // Reset registry (show DEFAULT_REGISTRO)
    scrollToScreen(getDefaultScreenIndex(), false);

    // Clear grid-editor
    gridEditor?.clear();

    // Clear grid 2D selections
    grid?.clearSelection();

    // Update displays
    updateLongitud();
    updateGridVisibility();
    updateGrid();
  }
});

// ========== DOM BINDING ==========

function bindElements() {
  elements = {
    // Inputs
    inputCompas: document.getElementById('inputCompas'),
    inputCycle: document.getElementById('inputCycle'),
    registroText: document.getElementById('registroText'),
    inputBpm: document.getElementById('inputBpm'),

    // Grid-editor container
    gridEditorContainer: document.getElementById('gridEditorContainer'),

    // Spinners (Cycle has no spinners — App17 dual-pill pattern)
    compasUp: document.getElementById('compasUp'),
    compasDown: document.getElementById('compasDown'),
    registroUp: document.getElementById('registroUp'),
    registroDown: document.getElementById('registroDown'),
    bpmUp: document.getElementById('bpmUp'),
    bpmDown: document.getElementById('bpmDown'),

    // Displays
    totalLengthDigit: document.getElementById('totalLengthDigit'),
    cycleDigit: document.getElementById('cycleDigit'),

    // Control buttons
    playBtn: document.getElementById('playBtn'),
    randomBtn: document.getElementById('randomBtn'),
    resetBtn: document.getElementById('resetBtn'),
    tapTempoBtn: document.getElementById('tapTempoBtn'),
    pulseToggleBtn: document.getElementById('pulseToggleBtn')
  };
}

function initApp() {
  console.log('Initializing App20: Plano y sucesión N-iT (MODULAR)');

  // Setup piano preload in background (reduces latency on first play)
  setupPianoPreload({ delay: 300 });

  // Bind DOM elements
  bindElements();

  // Initialize BPM controller
  if (elements.inputBpm && elements.bpmUp && elements.bpmDown) {
    bpmController = createBpmController({
      inputEl: elements.inputBpm,
      upBtn: elements.bpmUp,
      downBtn: elements.bpmDown,
      min: CONFIG.MIN_BPM,
      max: CONFIG.MAX_BPM,
      defaultValue: CONFIG.DEFAULT_BPM,
      onChange: (bpm) => {
        console.log('BPM changed to:', bpm);
        if (grid) grid.setBpm(bpm);
        if (isPlaying && audio) audio.setTempo(bpm);
        savePreferences();
      }
    });
    bpmController.attach();
  }

  // Initialize cycle counter
  if (elements.cycleDigit) {
    cycleCounter = createCycleCounter({ element: elements.cycleDigit });
  }

  // Initialize P1 Toggle
  const startIntervalToggle = document.getElementById('startIntervalToggle');
  const startSoundRow = document.querySelector('.interval-select-row');
  if (startIntervalToggle && startSoundRow) {
    window.__p1Controller = initP1ToggleUI({
      checkbox: startIntervalToggle,
      startSoundRow,
      storageKey: 'app20:p1Toggle',
      onChange: async (enabled) => {
        const audioInstance = await initAudio();
        if (audioInstance?.setMeasureEnabled) {
          audioInstance.setMeasureEnabled(enabled);
        }
      }
    });
  }

  // Initialize tap tempo
  if (elements.tapTempoBtn) {
    tapTempoHandler = createTapTempoHandler({
      getAudioInstance: initAudio,
      tapBtn: elements.tapTempoBtn,
      tapHelp: null,
      onBpmDetected: (newBpm) => {
        const clampedBpm = Math.min(CONFIG.MAX_BPM, Math.max(CONFIG.MIN_BPM, Math.round(newBpm)));
        bpmController?.setValue(clampedBpm);
        savePreferences();
      }
    });
    tapTempoHandler.attach();
    elements.tapTempoBtn.style.display = '';
  }

  // Mixer integration
  const mixerMenu = document.getElementById('mixerMenu');
  if (mixerMenu && elements.playBtn) {
    // Get initial instrument label (per-app key to match header writes)
    const initialInstrument = localStorage.getItem('app20:selectedInstrument') || 'piano';
    const instrumentLabel = initialInstrument === 'flute' ? 'Flauta' : 'Piano';

    initMixerMenu({
      menu: mixerMenu,
      triggers: [elements.playBtn],
      channels: [
        { id: 'start', label: 'P0', allowSolo: true },
        { id: 'pulse', label: 'Pulso', allowSolo: true },
        { id: 'instrument', label: instrumentLabel, allowSolo: true },
        { id: 'master', label: 'Master', allowSolo: false, isMaster: true }
      ]
    });

    subscribeMixer((snapshot) => {
      clearTimeout(mixerSaveTimeout);
      mixerSaveTimeout = setTimeout(() => {
        localStorage.setItem(MIXER_STORAGE_KEY, JSON.stringify(snapshot));
      }, 100);

      // Sync pulseToggleBtn with mixer pulse channel mute state
      if (elements.pulseToggleBtn) {
        const pulseChannel = snapshot.channels?.pulse;
        if (pulseChannel) {
          const isMuted = pulseChannel.muted || pulseChannel.effectiveMuted;
          // Button active = pulse enabled (not muted)
          elements.pulseToggleBtn.classList.toggle('active', !isMuted);
          elements.pulseToggleBtn.setAttribute('aria-pressed', String(!isMuted));
        }
      }
    });

    loadMixerState();
  }

  // Wire pulseToggleBtn using initAudioToggles
  if (elements.pulseToggleBtn) {
    initAudioToggles({
      toggles: [{
        id: 'pulse',
        button: elements.pulseToggleBtn,
        storageKey: 'app20:pulseAudio',
        mixerChannel: 'pulse',
        defaultEnabled: true
      }],
      mixer: getMixer(),
      subscribeMixer
    });
  }

  // Random menu
  const randomMenu = document.getElementById('randomMenu');
  if (elements.randomBtn && randomMenu) {
    initRandomMenu(elements.randomBtn, randomMenu, handleRandom);
  }

  // Setup event handlers
  setupEventHandlers();

  // Setup hover labels
  setupHovers();

  // Load saved preferences FIRST (to get BPM)
  loadPreferences();

  // Set default Compás=4 and Nº Compases=3 so the grid starts pre-created
  compas = 4;
  cycles = 3;
  if (elements.inputCompas) elements.inputCompas.value = compas;
  if (elements.inputCycle) elements.inputCycle.value = cycles;
  if (elements.cycleDigit) elements.cycleDigit.textContent = String(cycles);

  // Reorder controls: Play, BPM, Random, Reset (compact row)
  const bpmParam = document.getElementById('bpmParam');
  const controls = document.querySelector('.controls');
  if (controls && bpmParam) {
    const playBtnEl = controls.querySelector('.play') || elements.playBtn;
    const randomBtnEl = controls.querySelector('.random');
    const resetBtnEl = controls.querySelector('.reset');
    const randomMenuEl = controls.querySelector('.random-menu');

    while (controls.firstChild) controls.removeChild(controls.firstChild);

    if (playBtnEl) controls.appendChild(playBtnEl);
    controls.appendChild(bpmParam);
    if (randomBtnEl) controls.appendChild(randomBtnEl);
    if (randomMenuEl) controls.appendChild(randomMenuEl);
    if (resetBtnEl) controls.appendChild(resetBtnEl);
  }

  // Save controls before initGrid clears .timeline-wrapper
  const timelineWrapper = document.querySelector('.timeline-wrapper');
  const savedControls = controls?.parentNode === timelineWrapper ? controls : null;
  if (savedControls) savedControls.remove();

  // Initialize the grid (plano-modular + modular controllers)
  initGrid();

  // Create N-iT editor container and add it after plano-container
  const nitEditorEl = document.createElement('div');
  nitEditorEl.className = 'nit-editor';
  nitEditorEl.id = 'nitEditor';
  timelineWrapper?.appendChild(nitEditorEl);

  // Re-add controls after editor
  if (savedControls) {
    timelineWrapper?.appendChild(savedControls);
  }

  // Initialize the grid-editor (NrX-iT zigzag)
  elements.gridEditorContainer = nitEditorEl;
  initGridEditor();

  // Initial renders
  updateLongitud();
  updateGridVisibility();

  // Position to default registry's screen AFTER the preset's setRegistry
  // has completed (uses setTimeout(0)+rAF, so we run after).
  setTimeout(() => {
    requestAnimationFrame(() => {
      scrollToScreen(getDefaultScreenIndex(), false);
    });
  }, 100);

  // Idle caret flash on the N-iT editor
  initIdleCaretFlash({ targets: [nitEditorEl] });

  console.log('App20 initialized (MODULAR)');
}

function loadMixerState() {
  try {
    const saved = localStorage.getItem(MIXER_STORAGE_KEY);
    if (!saved) return;
    const state = JSON.parse(saved);

    if (window.NuzicMixer) {
      if (state.master !== undefined && window.NuzicMixer.setMasterVolume) {
        window.NuzicMixer.setMasterVolume(state.master);
      }
      ['pulse', 'instrument'].forEach(ch => {
        if (state[ch]) {
          window.NuzicMixer.setChannelVolume?.(ch, state[ch].volume ?? 1);
          window.NuzicMixer.setChannelMute?.(ch, state[ch].muted ?? false);
        }
      });
    }
  } catch (e) {
    console.warn('Failed to load mixer state:', e);
  }
}

// Execute when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
