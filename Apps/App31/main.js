// App31: Sucesión de iTs Fraccionados Complejos
// Basat en App30, amb numerador editable (2-6) — Lg = numerador (dinàmic)
// BPM=60 default, playback en loop
// Bi-direccionalitat: timeline ↔ editor iT cel·lular
// Àudio melòdic amb selector d'instrument

import { getMixer } from '../../libs/sound/index.js';
import { createMelodicAudioInitializer, setupAudioDefaults, CHANNEL_TIERS } from '../../libs/app-common/audio-init.js';
import { bindSharedSoundEvents } from '../../libs/app-common/audio.js';
import { initMixerMenu } from '../../libs/app-common/mixer-menu.js';
import { createPreferenceStorage, registerFactoryReset, setupThemeSync, setupMutePersistence } from '../../libs/app-common/preferences.js';
import createFractionEditor from '../../libs/app-common/fraction-editor.js';
import { gridFromOrigin } from '../../libs/app-common/subdivision.js';
import { attachHover } from '../../libs/shared-ui/hover.js';
import { showValidationWarning } from '../../libs/app-common/info-tooltip.js';
import { createCellSequenceEditor } from '../../libs/pulse-seq/index.js';
import { isIntegerPulseSelectable } from '../../libs/app-common/pulse-selectability.js';
import { gcd } from '../../libs/app-common/number-utils.js';
import { createBpmController } from '../../libs/app-common/bpm-controller.js';
import { initIdleCaretFlash } from '../../libs/app-common/idle-caret-flash.js';
import { createItfrEngine } from '../../libs/interval-sequencer/index.js';
import { setupRandomMenu } from '../../libs/random/menu.js';
import { addRepeatPress } from '../../libs/app-common/spinner-repeat.js';

// ========== CONSTANTS ==========
// Lg = currentNumerator (dynamic) — recomputed every render.
const DEFAULT_BPM = 60;
const MIN_BPM = 50;
const MAX_BPM = 150;
const DEFAULT_NUMERATOR = 2;     // Per defecte 2/3
const DEFAULT_DENOMINATOR = 3;
const MIN_NUMERATOR = 2;         // Mínim 2 (fraccions complexes)
const MAX_NUMERATOR = 6;
const MIN_DENOMINATOR = 2;       // Mínim 2 subdivisions
const MAX_DENOMINATOR = 8;

// Colors per rectangles iT
const VIBRANT_COLORS = [
  '#7CD6B3', // verd
  '#F5C6C2', // rosa clar
  '#7CD6B3', // verd
  '#F5C6C2'  // rosa clar
];

// Notes per àudio
const NOTE_CYCLE_START = 60; // C4 - primer iT de cicle fraccionat
const NOTE_CYCLE_REST = 67;  // G4 - resta d'iTs

// ========== STATE ==========
let audio = null;
let bpmController = null;
let isPlaying = false;
let currentNumerator = DEFAULT_NUMERATOR;
let currentDenominator = DEFAULT_DENOMINATOR;

// iT sequence state: array of { start: number, it: number }
// start = subdivisió d'inici (global), it = durada en unitats de subdivisió
let itSequence = [];

// DOM elements
let pulses = [];
let cycleMarkers = [];
let cycleLabels = [];
// Les barres d'interval, el drag i els highlights són del motor compartit
// (libs/interval-sequencer/itfr-engine.js, H-21) — vegeu `engine` més avall.

// Controllers
let fractionEditorController = null;
let randomMenu = null;  // Long-press random menu controller (read())

// ========== PREFERENCE STORAGE ==========
const preferenceStorage = createPreferenceStorage({ prefix: 'app31', separator: '::' });
const { load: loadOpt } = preferenceStorage;

registerFactoryReset({
  storage: preferenceStorage,
  onBeforeReload: () => {}
});

// ========== SOUND EVENTS ==========
// The shared audio engine routes baseSound/cycleSound → audio.setBase/setCycle.
// No manual metronome playback needed — playOptions.cycle handles it.
bindSharedSoundEvents({
  getAudio: () => audio,
  mapping: {
    baseSound: 'setBase',
    cycleSound: 'setCycle'
  }
});

// Listen for instrument changes - sync with audio engine
window.addEventListener('sharedui:instrument', async (e) => {
  if (e.detail?.instrument && audio && audio.setInstrument) {
    await audio.setInstrument(e.detail.instrument);
  }
});

// ========== DOM ELEMENTS ==========
const timeline = document.getElementById('timeline');
const timelineWrapper = document.getElementById('timelineWrapper');
const playBtn = document.getElementById('playBtn');
const randomBtn = document.getElementById('randomBtn');
const resetBtn = document.getElementById('resetBtn');
const themeSelect = document.getElementById('themeSelect');
const baseSoundSelect = document.getElementById('baseSoundSelect');
const cycleSoundSelect = document.getElementById('cycleSoundSelect');
const mixerMenu = document.getElementById('mixerMenu');

// iTfr elements
let itfrRow = null;
let itfrEditorEl = null;     // .itfr-editor root (label + cells)
let itfrCellsEl = null;      // .itfr-cells container
let itfrActiveInputEl = null; // current editable cell
// Info displays (live in .inputs as pastilles, created via index.html)
let sumDisplay = null;
let lengthDisplay = null;

// ========== MOTOR iTfr COMPARTIT ==========
// Barres d'interval + drag (Pointer Events) + highlights de playback viuen
// a libs/interval-sequencer/itfr-engine.js. Diferències App31 respecte
// App30: lg = numerador dinàmic, total = d (1 cicle) i els elements
// `non-selectable` (selectabilitat de fraccions complexes) no s'arrosseguen.
const engine = createItfrEngine({
  timeline,
  colors: VIBRANT_COLORS,
  getLg: () => currentNumerator,
  getNumerator: () => currentNumerator,
  getDenominator: () => currentDenominator,
  getTotalSubdivisions: () => getTotalSubdivisions(),
  getSequence: () => itSequence,
  setSequence: (next) => { itSequence = next; },
  isSelectable: (el) => !el.classList.contains('non-selectable'),
  onSequenceChange: () => {
    recalculateCyclePositions();
    updateInfoDisplays();
    renderItfrEditor();
    engine.updateIntervalBars();
  },
  getEditorCellsHost: () => itfrCellsEl
});

// ========== HOVER TOOLTIPS ==========
if (playBtn) attachHover(playBtn, { text: 'Play / Stop' });
if (randomBtn) attachHover(randomBtn, { text: 'Aleatorizar fracción y iTs' });
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
    if (savedMute === '1' && typeof audio.setMute === 'function') {
      audio.setMute(true);
    }

    // Configure sounds from dropdowns (like createRhythmAudioInitializer does)
    // This ensures the metronome and cycle sounds are properly initialized
    if (baseSoundSelect?.dataset?.value) {
      await audio.setBase(baseSoundSelect.dataset.value);
    }
    if (cycleSoundSelect?.dataset?.value) {
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
/**
 * Get total subdivisions available.
 * At App31 Lg = currentNumerator, so total = (n × d) / n = d (1 cicle complet).
 */
function getTotalSubdivisions() {
  return currentDenominator;
}

/**
 * Get current sum of iTs
 */
function getItSum() {
  // Count all items (iTs and silences) in the sum
  return itSequence.reduce((sum, item) => sum + item.it, 0);
}

/**
 * Get next available start position
 */
function getNextAvailableStart() {
  if (itSequence.length === 0) return 0;
  const last = itSequence[itSequence.length - 1];
  return last.start + last.it;
}

// ========== iTfr LAYOUT CREATION ==========
// Builds the cell-based iTfr editor BELOW the timeline (nuzic order:
// timeline → editor → controls). Cells are squares (App13 pattern):
// [value WHITE with number] + [1 cream separator] per iT, plus a running
// white input cell at the end where the user types the next iT.
function createItfrLayout() {
  // Editor row (Suma/Disponibles live next to fraction in .middle)
  itfrRow = document.createElement('div');
  itfrRow.className = 'itfr-row';

  itfrEditorEl = document.createElement('div');
  itfrEditorEl.className = 'itfr-editor';

  const label = document.createElement('div');
  label.className = 'itfr-label';
  label.textContent = 'iT';

  itfrCellsEl = document.createElement('div');
  itfrCellsEl.className = 'itfr-cells';

  itfrEditorEl.appendChild(label);
  itfrEditorEl.appendChild(itfrCellsEl);
  itfrRow.appendChild(itfrEditorEl);

  // Insert AFTER timeline (nuzic order). Controls get moved below in init().
  if (timelineWrapper && timelineWrapper.parentNode) {
    const parent = timelineWrapper.parentNode;
    parent.insertBefore(itfrRow, timelineWrapper.nextSibling);
  }

  // Idle caret flash anchored on editor container
  initIdleCaretFlash({ targets: [itfrEditorEl] });
}

// ========== CELL-BASED EDITOR RENDERING ==========
// One cell per iT (value white, editable) + one yellow-light separator between cells.
// A trailing white input cell accepts the next iT, followed by a final separator.
// El DOM de l'editor viu a libs/pulse-seq/cell-editor.js (extracció H-02);
// aquí només hi queda el MODEL: validació d'iT, itSequence i sincronització.

let itfrEditor = null;

function realItEntries() {
  return itSequence.filter(item => !item.isSilence);
}

function renderItfrEditor() {
  if (!itfrCellsEl) return;

  if (!itfrEditor) {
    itfrEditor = createCellSequenceEditor({
      host: itfrCellsEl,
      classes: { base: 'itfr-cell', value: 'itfr-value', separator: 'itfr-separator', input: 'itfr-input' },
      input: {
        maxLength: 2,
        inputMode: 'numeric',
        commitDelay: 500,
        // Només dígits: la resta es sanititza in situ (sense tocar el timer
        // pendent, paritat amb el comportament original).
        classify: (raw) => /^\d+$/.test(raw) ? 'defer' : { sanitize: raw.replace(/\D/g, '') },
        commitOnBlur: true,
        doubleCommitGuard: true,
        refocusAfterCommit: true,
        refocusOnInvalid: true
      },
      getEntries: () => realItEntries().map(item => ({ display: String(item.it) })),
      // Trailing input only if space remains.
      showTrailingInput: () => realItEntries().reduce((a, b) => a + b.it, 0) < getTotalSubdivisions(),
      onCommitInput: (raw) => {
        if (!raw) return false;
        const parsed = parseAndValidateIt(raw);
        if (!parsed) return false;
        if (parsed.warning) showValidationWarning(itfrEditorEl, parsed.warning);
        const startSubdiv = getNextAvailableStart();
        itSequence.push({ start: startSubdiv, it: parsed.value, isSilence: false });
        recalculateCyclePositions();
        updateInfoDisplays();
        renderItfrEditor();
        engine.updateIntervalBars();
        return true;
      },
      onEditEntry: (entryIndex, raw) => {
        if (raw === '') {
          // Empty → delete this iT entry.
          removeItAtIndex(entryIndex);
          return true;
        }
        const parsed = parseAndValidateIt(raw, entryIndex);
        if (!parsed) return false;
        if (parsed.warning) showValidationWarning(itfrEditorEl, parsed.warning);
        updateItAtIndex(entryIndex, parsed.value);
        return true;
      },
      onDeleteLast: () => {
        const its = realItEntries();
        if (its.length > 0) removeItAtIndex(its.length - 1);
      }
    });
  }

  itfrEditor.render();
  itfrActiveInputEl = itfrEditor.getActiveInput();
}

/**
 * Parse and validate an iT value. Returns { value, warning? } or null on format error.
 * Accounts for any existing iT being replaced at editIndex.
 */
function parseAndValidateIt(raw, editIndex = null) {
  const value = parseInt(raw, 10);
  if (!Number.isFinite(value)) {
    showValidationWarning(itfrEditorEl, `"${raw}" no es válido`);
    return null;
  }
  if (value < 1) {
    showValidationWarning(itfrEditorEl, 'iT debe ser ≥ 1');
    return null;
  }

  const maxTotal = getTotalSubdivisions();
  const realIts = itSequence.filter(it => !it.isSilence);
  const sumExcluding = realIts.reduce((acc, it, i) => {
    return (i === editIndex) ? acc : acc + it.it;
  }, 0);
  const available = maxTotal - sumExcluding;

  if (value > available) {
    showValidationWarning(itfrEditorEl, `iT ${value} excede L iTfr (${available} disponibles)`);
    return null;
  }

  return { value, warning: null };
}

/** Remove the iT at the given real-index (ignoring silences). */
function removeItAtIndex(entryIndex) {
  const realIts = itSequence.filter(it => !it.isSilence);
  if (entryIndex < 0 || entryIndex >= realIts.length) return;

  const target = realIts[entryIndex];
  itSequence = itSequence.filter(it => it !== target);
  reflowItSequenceStarts();
  recalculateCyclePositions();
  updateInfoDisplays();
  renderItfrEditor();
  engine.updateIntervalBars();
}

/** Replace the iT value at the given real-index. */
function updateItAtIndex(entryIndex, newValue) {
  const realIts = itSequence.filter(it => !it.isSilence);
  if (entryIndex < 0 || entryIndex >= realIts.length) return;

  const target = realIts[entryIndex];
  target.it = newValue;
  reflowItSequenceStarts();
  recalculateCyclePositions();
  updateInfoDisplays();
  renderItfrEditor();
  engine.updateIntervalBars();
}

/** Reflow `start` for all iTs so they are contiguous from 0. */
function reflowItSequenceStarts() {
  let pos = 0;
  for (const item of itSequence) {
    if (item.isSilence) continue;
    item.start = pos;
    pos += item.it;
  }
}

// ========== FRACTION EDITOR ==========
// Block mode in `.middle` above the timeline (App26-28 pattern).
// Flanks the fraction with Suma iT and iT Disponibles pastilles on the left.
function initFractionEditorController() {
  const host = document.querySelector('.middle');
  if (!host) return;

  // Clear .middle and build: [info pastilles | fraction slot].
  host.innerHTML = '';
  host.classList.add('app31-middle');

  // Info pastilles (left of fraction)
  const infoGroup = document.createElement('div');
  infoGroup.className = 'itfr-info-group';

  const sumBox = document.createElement('div');
  sumBox.className = 'bpm-inline visible param sum-it';
  sumBox.id = 'sumItParam';
  sumBox.innerHTML = `
    <span class="abbr">Suma iT</span>
    <div class="circle">
      <input id="sumItDisplay" type="text" value="0" readonly />
    </div>
  `;

  const dispBox = document.createElement('div');
  dispBox.className = 'bpm-inline visible param it-disponibles';
  dispBox.id = 'itDisponiblesParam';
  dispBox.innerHTML = `
    <span class="abbr">iT Disponibles</span>
    <div class="circle">
      <input id="itDisponiblesDisplay" type="text" value="0" readonly />
    </div>
  `;

  infoGroup.appendChild(sumBox);
  infoGroup.appendChild(dispBox);
  host.appendChild(infoGroup);

  // Fraction slot (right of pastilles)
  const fractionSlot = document.createElement('div');
  fractionSlot.className = 'itfr-fraction-slot';
  host.appendChild(fractionSlot);

  // Resolve info displays now they exist
  sumDisplay = document.getElementById('sumItDisplay');
  lengthDisplay = document.getElementById('itDisponiblesDisplay');

  currentNumerator = DEFAULT_NUMERATOR;
  currentDenominator = DEFAULT_DENOMINATOR;

  const controller = createFractionEditor({
    mode: 'block',
    host: fractionSlot,
    defaults: { numerator: DEFAULT_NUMERATOR, denominator: DEFAULT_DENOMINATOR },
    startEmpty: false,
    autoReduce: true,
    minNumerator: MIN_NUMERATOR,
    minDenominator: MIN_DENOMINATOR,
    maxNumerator: MAX_NUMERATOR,
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

  // App31: complex mode — both numerator and denominator editable.
  if (fractionEditorController && typeof fractionEditorController.setComplexMode === 'function') {
    fractionEditorController.setComplexMode();
  }
}

function handleFractionChange() {
  if (!fractionEditorController) return;

  const fraction = fractionEditorController.getFraction();
  let newN = fraction?.numerator;
  let newD = fraction?.denominator;

  // Skip if values are not yet valid (user is typing)
  if (!Number.isFinite(newN) || !Number.isFinite(newD)) {
    return;
  }

  // Clamp numerator (MIN..MAX)
  if (newN < MIN_NUMERATOR) newN = MIN_NUMERATOR;
  else if (newN > MAX_NUMERATOR) newN = MAX_NUMERATOR;

  // Clamp denominator (MIN..MAX)
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

  // Filter invalid iTs
  filterInvalidIts();

  // Redraw timeline
  renderTimeline();

  // Update displays
  updateInfoDisplays();
  renderItfrEditor();

  // Hot-reload audio if playing
  if (audio && isPlaying) {
    applyTransportConfig();
  }
}

/**
 * Apply current fraction config to running audio transport
 * Enables hot-reload when fraction changes during playback
 */
function applyTransportConfig() {
  if (!audio || typeof audio.updateTransport !== 'function') return;

  const lg = currentNumerator;
  const bpm = bpmController?.getValue() || DEFAULT_BPM;
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

  recalculateCyclePositions();
}

/**
 * Recalculate cyclePosition for all iTs in the sequence.
 * Called whenever itSequence changes during playback,
 * so that highlightPulse plays the correct melodic note (C4 vs G4).
 */
function recalculateCyclePositions() {
  const d = currentDenominator;
  let cyclePos = 0;
  for (const item of itSequence) {
    item.cyclePosition = cyclePos;
    cyclePos = (cyclePos + item.it) % d;
  }
}

function filterInvalidIts() {
  const maxSubdiv = getTotalSubdivisions();
  itSequence = itSequence.filter(item => {
    const end = item.start + item.it;
    return item.start >= 0 && end <= maxSubdiv;
  });
}


// ========== INFO DISPLAYS ==========
function updateInfoDisplays() {
  const sum = getItSum();
  const totalPfr = getTotalSubdivisions();  // Lg * d / n = total pulsos fraccionats

  if (sumDisplay) {
    sumDisplay.value = sum;
    sumDisplay.classList.toggle('complete', sum >= totalPfr);
  }

  if (lengthDisplay) {
    lengthDisplay.value = totalPfr - sum;
    lengthDisplay.classList.toggle('complete', sum === 0);
  }
}

// ========== TIMELINE RENDERING ==========
function renderTimeline() {
  if (!timeline) return;

  timeline.classList.add('no-anim');

  // Clear previous
  pulses = [];
  cycleMarkers = [];
  cycleLabels = [];
  timeline.innerHTML = '';

  const lg = currentNumerator;
  const n = currentNumerator;
  const d = currentDenominator;

  // Pulse numbers (nuzic-theme renders ticks via ::before/::after).
  // App31-specific: integer pulses that are NOT at a cycle start (not a multiple
  // of numerator, not endpoint) are marked non-selectable — drag and click ignore.
  for (let i = 0; i <= lg; i++) {
    const num = document.createElement('div');
    num.className = 'pulse-number';
    if (i === 0) num.classList.add('startpoint');
    else if (i === lg) num.classList.add('endpoint');
    else if (!isIntegerPulseSelectable(i, n, d, lg)) num.classList.add('non-selectable');
    num.dataset.index = i;
    num.textContent = i;
    timeline.appendChild(num);
    pulses.push(num);
  }

  // Single "N/D" subdivision label anchored to the left of the subdivision row.
  const subdivisionLabel = document.createElement('div');
  subdivisionLabel.className = 'subdivision-label';
  subdivisionLabel.textContent = `${n}/${d}`;
  timeline.appendChild(subdivisionLabel);

  // Create cycle markers + labels below the timeline (subdivision row).
  const grid = gridFromOrigin({ lg, numerator: n, denominator: d });

  if (grid.cycles > 0 && grid.subdivisions.length) {
    grid.subdivisions.forEach(({ cycleIndex, subdivisionIndex, position }) => {
      if (subdivisionIndex === 0) return; // Skip integers

      const globalSubdiv = cycleIndex * d + subdivisionIndex;
      const base = cycleIndex * n;
      const isSelectable = base === 0 || isIntegerPulseSelectable(base, n, d, lg);

      const marker = document.createElement('div');
      marker.className = 'cycle-marker';
      if (!isSelectable) marker.classList.add('non-selectable');
      marker.dataset.cycleIndex = String(cycleIndex);
      marker.dataset.subdivision = String(subdivisionIndex);
      marker.dataset.globalSubdiv = String(globalSubdiv);
      marker.dataset.position = String(position);
      timeline.appendChild(marker);
      cycleMarkers.push(marker);

      const label = document.createElement('div');
      label.className = 'cycle-label';
      if (!isSelectable) label.classList.add('non-selectable');
      label.dataset.cycleIndex = String(cycleIndex);
      label.dataset.subdivision = String(subdivisionIndex);
      label.dataset.globalSubdiv = String(globalSubdiv);
      label.dataset.position = String(position);
      label.textContent = `.${subdivisionIndex}`;
      timeline.appendChild(label);
      cycleLabels.push(label);
    });
  }

  layoutTimeline();
  engine.bindTimeline({ pulses, cycleMarkers, cycleLabels });
  engine.updateIntervalBars();

  requestAnimationFrame(() => {
    timeline.classList.remove('no-anim');
  });
}

function layoutTimeline() {
  const lg = currentNumerator;

  // Vertical positioning handled by nuzic-theme + App30 styles.css.
  // Only horizontal percentage is dynamic per render.
  pulses.forEach((num) => {
    const idx = parseInt(num.dataset.index, 10);
    num.style.left = (idx / lg) * 100 + '%';
  });

  cycleMarkers.forEach((marker) => {
    const pos = parseFloat(marker.dataset.position);
    marker.style.left = (pos / lg) * 100 + '%';
  });

  cycleLabels.forEach((label) => {
    const pos = parseFloat(label.dataset.position);
    label.style.left = (pos / lg) * 100 + '%';
  });
}

// ========== PLAYBACK ==========
async function startPlayback() {
  if (itSequence.length === 0) {
    showValidationWarning(itfrEditorEl, 'Afegeix iTs per reproduir');
    return;
  }

  const lg = currentNumerator;
  const bpm = bpmController?.getValue() || DEFAULT_BPM;
  const n = currentNumerator;
  const d = currentDenominator;

  // Scale by denominator to include subdivisions (like App29)
  const baseResolution = d;
  const scaledInterval = (60 / bpm) / d; // Each step = 1/d of a beat
  const scaledTotal = lg * d;

  const audioInstance = await initAudio();

  const hasCycle = n > 0 && d > 0 && Math.floor(lg / n) > 0;

  // No accent selection for App30 - we use melodic notes instead
  const audioSelection = { values: new Set(), resolution: 1 };

  // Pre-calculate cyclePosition for each iT (for melodic note selection)
  recalculateCyclePositions();

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

    const itIndex = engine.getItIndexAtScaledStart(scaledIndex);
    if (itIndex >= 0) {
      const item = itSequence[itIndex];
      if (!item.isSilence) {
        const bpm = bpmController?.getValue() || DEFAULT_BPM;
        const beatDuration = 60 / bpm;
        const durationPulses = item.it * n / d;
        const durationSeconds = durationPulses * beatDuration;
        const note = item.cyclePosition === 0 ? NOTE_CYCLE_START : NOTE_CYCLE_REST;
        return [{ midi: note, duration: durationSeconds, velocity: 0.8 }];
      }
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

// ========== HIGHLIGHTING ==========
// El pintat viu al motor compartit; aquests wrappers afegeixen el guard
// d'estat de l'app (el transport pot lliurar ticks just després d'aturar).
function clearHighlights() {
  engine.clearHighlights();
}

function highlightPulse(scaledIndex) {
  if (!isPlaying) return;
  engine.highlightPulse(scaledIndex);
}

function highlightCycle(payload = {}) {
  if (!isPlaying) return;
  engine.highlightCycle(payload);
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

  // Random reduced fraction n/d with n ∈ [MIN_N..nMax], d ∈ [MIN_D..dMax]
  // — the longpress menu caps each independently (defaults = MAX_*).
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

  // Generate random iTs filling only complete cycles (not loose pulses).
  const maxSubdivs = getTotalSubdivisions();
  const subsPerCycle = newD;
  const completeCycleSubdivs = Math.floor(maxSubdivs / subsPerCycle) * subsPerCycle;

  let remaining = completeCycleSubdivs;
  const newSequence = [];
  let pos = 0;

  while (remaining >= 1) {
    // Random iT size from 1 to floor(remaining) - ensures we don't exceed complete cycles
    const maxIt = Math.floor(remaining);
    if (maxIt < 1) break;
    const it = Math.floor(Math.random() * maxIt) + 1;
    newSequence.push({ start: pos, it, isSilence: false });
    pos += it;
    remaining -= it;
  }

  itSequence = newSequence;

  renderTimeline();
  updateInfoDisplays();
  renderItfrEditor();

  // Auto-play after randomizing (consistent across apps 9+).
  if (!isPlaying) handlePlay();
}

function handleReset() {
  if (isPlaying) {
    stopPlayback();
  }

  currentNumerator = DEFAULT_NUMERATOR;
  currentDenominator = DEFAULT_DENOMINATOR;

  if (fractionEditorController) {
    fractionEditorController.setFraction(
      { numerator: DEFAULT_NUMERATOR, denominator: DEFAULT_DENOMINATOR },
      { cause: 'reset', persist: true }
    );
  }

  itSequence = [];

  renderTimeline();
  updateInfoDisplays();
  renderItfrEditor();
}

// ========== EVENT LISTENERS ==========
if (playBtn) {
  playBtn.addEventListener('click', handlePlay);
}

if (randomBtn) {
  randomMenu = setupRandomMenu({
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
      onChange: () => {
        // Transport escalat (bpm efectiu = bpm × d): re-aplicar la config
        // escalada com App32-35 — setTempo(bpm) directe el feia d vegades
        // més lent en calent.
        if (isPlaying) applyTransportConfig();
      }
    });
    bpmController.attach();
  }

  // Reorder controls: Play, BPM, Random, Reset (nuzic compact row)
  const bpmParam = document.getElementById('bpmParam');
  const controls = document.querySelector('.controls');
  if (controls) {
    const playEl = controls.querySelector('.play') || document.getElementById('playBtn');
    const randomEl = controls.querySelector('.random');
    const resetEl = controls.querySelector('.reset');
    const randomMenuEl = controls.querySelector('.random-menu');

    while (controls.firstChild) controls.removeChild(controls.firstChild);

    if (playEl) controls.appendChild(playEl);
    if (bpmParam) controls.appendChild(bpmParam);
    if (randomEl) controls.appendChild(randomEl);
    if (randomMenuEl) controls.appendChild(randomMenuEl);
    if (resetEl) controls.appendChild(resetEl);
  }

  // Initialize fraction editor FIRST so info pastilles (Suma/Disponibles) exist
  // before any updateInfoDisplays() call.
  initFractionEditorController();

  // Create iTfr editor row (placed AFTER timeline-wrapper)
  createItfrLayout();

  // Move .controls BELOW the editor (nuzic order: timeline → editor → controls).
  if (controls && itfrRow?.parentNode) {
    itfrRow.parentNode.insertBefore(controls, itfrRow.nextSibling);
  }

  // Render timeline and editor cells
  renderTimeline();
  renderItfrEditor();

  // Update displays
  updateInfoDisplays();
}

// Run initialization
init();
