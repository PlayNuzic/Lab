// App30: Sucesión de iTs Fraccionados Simples
// Basat en App28/App13, utilitza iT-seq en lloc de pulse-seq
// Lg=6 fix, BPM=70 fix, numerador=1 fix, denominador editable (1-8)
// Bi-direccionalitat: timeline <-> iT-seq
// Àudio melòdic amb selector d'instrument + so de cicle

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
import { createBpmController } from '../../libs/app-common/bpm-controller.js';
import { initIdleCaretFlash } from '../../libs/app-common/idle-caret-flash.js';
import { createIntervalLabelBar } from '../../libs/shared-ui/interval-label-bar.js';
import { setupRandomMenu } from '../../libs/random/menu.js';

// ========== CONSTANTS ==========
const FIXED_LG = 6;              // 6 pulsos (0-5) + endpoint (6)
const DEFAULT_BPM = 60;
const MIN_BPM = 50;
const MAX_BPM = 150;
const FIXED_NUMERATOR = 1;       // Numerador sempre 1 (App30)
const DEFAULT_DENOMINATOR = 2;   // Per defecte 1/2
const MIN_DENOMINATOR = 1;
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
let currentDenominator = DEFAULT_DENOMINATOR;

// iT sequence state: array of { start: number, it: number }
// start = subdivisió d'inici (global), it = durada en unitats de subdivisió
let itSequence = [];

// DOM elements
let pulses = [];      // (Inclou tots els .pulse-number; el layoutTimeline els
                       // reposiciona per `data-index` — mateix array que
                       // s'usava abans com `pulseNumberLabels`.)
let cycleMarkers = [];
let cycleLabels = [];
let intervalBars = []; // Rectangles iT

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
const preferenceStorage = createPreferenceStorage({ prefix: 'app30', separator: '::' });
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

// ========== HOVER TOOLTIPS ==========
if (playBtn) attachHover(playBtn, { text: 'Play / Stop' });
if (randomBtn) attachHover(randomBtn, { text: 'Aleatorizar fracción y iTs' });
if (resetBtn) attachHover(resetBtn, { text: 'Reset App' });

// ========== MIXER SETUP ==========
// Canals registrats al motor (MelodicTimelineAudio); setupAudioDefaults
// dins initAudio() personalitza els labels via CHANNEL_TIERS.MELODIC_FULL.
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
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get total subdivisions available (Lg * d)
 * Lg Fr = longitud en polsos × denominador
 */
function getTotalSubdivisions() {
  return FIXED_LG * currentDenominator;
}

/**
 * Convert subdivision index to timeline position (pulses)
 */
function subdivToPosition(subdiv) {
  return subdiv * FIXED_NUMERATOR / currentDenominator;
}

/**
 * Get current sum of iTs
 */
function getItSum() {
  // Count all items (iTs and silences) in the sum
  return itSequence.reduce((sum, item) => sum + item.it, 0);
}

/**
 * Get total length in pulses
 */
function getTotalLengthPulses() {
  const sum = getItSum();
  return sum * FIXED_NUMERATOR / currentDenominator;
}

/**
 * Get maximum iT value for a given start position
 * iTs can now cross pulse boundaries, only limited by L Pfr
 */
function getMaxItForStart(startSubdiv) {
  const maxTotal = getTotalSubdivisions();
  return maxTotal - startSubdiv;
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
        updateIntervalBars();
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
  updateIntervalBars();
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
  updateIntervalBars();
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
  host.classList.add('app30-middle');

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

  const lg = FIXED_LG;
  const bpm = bpmController?.getValue() || DEFAULT_BPM;
  const n = FIXED_NUMERATOR;
  const d = currentDenominator;

  const scaledTotal = lg * d + 1;  // +1 extra step for pulse Lg (endpoint) without adding its subdivisions
  const scaledBpm = bpm * d;

  audio.updateTransport({
    totalPulses: scaledTotal,
    bpm: scaledBpm,
    baseResolution: d,
    patternBeats: scaledTotal,
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

// ========== REPEAT PRESS HELPER ==========
function addRepeatPress(el, fn) {
  if (!el) return;
  let timeoutId = null;
  let intervalId = null;

  const clearTimers = () => {
    if (timeoutId) clearTimeout(timeoutId);
    if (intervalId) clearInterval(intervalId);
    timeoutId = null;
    intervalId = null;
  };

  const start = (event) => {
    if (event.type === 'mousedown' && event.button !== 0) return;
    clearTimers();
    fn();
    timeoutId = setTimeout(() => {
      intervalId = setInterval(fn, 80);
    }, 320);
    event.preventDefault();
  };

  const stop = () => clearTimers();

  el.addEventListener('mousedown', start);
  el.addEventListener('touchstart', start, { passive: false });
  ['mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach(name => {
    el.addEventListener(name, stop);
  });
  document.addEventListener('mouseup', stop);
  document.addEventListener('touchend', stop);
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
  intervalBars = [];
  timeline.innerHTML = '';

  const lg = FIXED_LG;
  const n = FIXED_NUMERATOR;
  const d = currentDenominator;

  // Pulse numbers (nuzic-theme renders ticks via ::before/::after).
  // L'últim pols es dibuixa com a `·` amb dobles guions (classe cycle-end).
  // Només canvi visual — l'últim iT segueix sonant normalment.
  for (let i = 0; i <= lg; i++) {
    const num = document.createElement('div');
    num.className = 'pulse-number';
    if (i === 0) num.classList.add('startpoint');
    if (i === lg) num.classList.add('endpoint');
    num.dataset.index = i;
    if (i === lg) {
      num.classList.add('cycle-end');
      num.textContent = '·';
    } else {
      num.textContent = i;
    }
    timeline.appendChild(num);
    pulses.push(num);
  }

  // Single "1/N" subdivision label anchored to the left of the subdivision row.
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

      const marker = document.createElement('div');
      marker.className = 'cycle-marker';
      marker.dataset.cycleIndex = String(cycleIndex);
      marker.dataset.subdivision = String(subdivisionIndex);
      marker.dataset.globalSubdiv = String(globalSubdiv);
      marker.dataset.position = String(position);
      timeline.appendChild(marker);
      cycleMarkers.push(marker);

      const label = document.createElement('div');
      label.className = 'cycle-label';
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
  attachDragHandlers();
  updateIntervalBars();

  requestAnimationFrame(() => {
    timeline.classList.remove('no-anim');
  });
}

function layoutTimeline() {
  const lg = FIXED_LG;

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

// ========== INTERVAL BARS ==========
function updateIntervalBars(previewSequence = null) {
  // Remove existing bars + halter labels (patró App13)
  intervalBars.forEach(bar => bar.remove());
  intervalBars = [];
  timeline.querySelectorAll('.interval-label-bar').forEach(el => el.remove());

  const sequence = previewSequence || itSequence;
  if (sequence.length === 0) return;

  const lg = FIXED_LG;
  let colorIndex = 0;

  sequence.forEach((item, idx) => {
    if (item.isSilence) return; // Skip silences — leave space empty

    const startPos = subdivToPosition(item.start);
    const endPos = subdivToPosition(item.start + item.it);
    const width = endPos - startPos;
    const startPercent = (startPos / lg) * 100;
    const widthPercent = (width / lg) * 100;

    // Barra colorada amunt (sense label dins — el halter porta el número).
    const bar = document.createElement('div');
    bar.className = 'interval-bar-visual';
    bar.dataset.index = idx;
    bar.style.left = `${startPercent}%`;
    bar.style.width = `${widthPercent}%`;

    const color = VIBRANT_COLORS[colorIndex % VIBRANT_COLORS.length];
    bar.style.background = color;
    colorIndex++;

    timeline.appendChild(bar);
    intervalBars.push(bar);

    // Halter groc amb el número d'iT, just sota la barra colorada (patró App13).
    const labelBar = createIntervalLabelBar({
      startPercent,
      widthPercent,
      label: item.it
    });
    timeline.appendChild(labelBar);
  });
}

// ========== DRAG INTERACTION ==========
function attachDragHandlers() {
  // Make cycle markers draggable
  cycleMarkers.forEach(marker => {
    marker.addEventListener('mousedown', handleDragStart);
    marker.addEventListener('touchstart', handleDragStart, { passive: false });
  });

  // Fractional-pulse labels (e.g. ".1", ".2") share the same drag behaviour
  // as the vertical markers — integer pulses were already draggable, so this
  // makes the two selection targets consistent.
  cycleLabels.forEach(label => {
    label.addEventListener('mousedown', handleDragStart);
    label.addEventListener('touchstart', handleDragStart, { passive: false });
    label.style.cursor = 'grab';
  });

  // Also allow starting from integer pulses (0 to LG-1, not the endpoint)
  pulses.forEach(pulse => {
    const idx = parseInt(pulse.dataset.index, 10);
    if (idx >= 0 && idx < FIXED_LG) {
      pulse.addEventListener('mousedown', handleDragStartFromPulse);
      pulse.addEventListener('touchstart', handleDragStartFromPulse, { passive: false });
      pulse.style.cursor = 'grab';
    }
  });

  document.addEventListener('mousemove', handleDragMove);
  document.addEventListener('mouseup', handleDragEnd);
  document.addEventListener('touchmove', handleDragMove, { passive: false });
  document.addEventListener('touchend', handleDragEnd);
}

function handleDragStartFromPulse(e) {
  const pulse = e.currentTarget;
  const idx = parseInt(pulse.dataset.index, 10);
  const n = FIXED_NUMERATOR;
  const d = currentDenominator;
  // Convert pulse index to subdivision: each cycle has d subdivisions and spans n pulses
  const globalSubdiv = Math.round(idx * d / n);

  startDrag(globalSubdiv, e);
}

function handleDragStart(e) {
  const marker = e.currentTarget;
  const globalSubdiv = parseInt(marker.dataset.globalSubdiv, 10);

  startDrag(globalSubdiv, e);
}

function startDrag(startSubdiv, e) {
  e.preventDefault();

  const d = currentDenominator;
  const maxTotal = getTotalSubdivisions();

  // Can't start beyond timeline
  if (startSubdiv >= maxTotal) return;

  // Check if position is already occupied
  const isOccupied = itSequence.some(item => {
    const end = item.start + item.it;
    return startSubdiv >= item.start && startSubdiv < end;
  });

  // If occupied, we'll replace on drag end

  // iTs can now cross pulse boundaries, only limited by L Pfr
  dragState = {
    active: true,
    startSubdiv: startSubdiv,
    currentSubdiv: startSubdiv,
    maxSubdiv: maxTotal - 1,
    previewBar: null
  };

  document.body.classList.add('dragging-it');

  // Highlight start marker
  const startMarker = cycleMarkers.find(m =>
    parseInt(m.dataset.globalSubdiv, 10) === startSubdiv
  ) || pulses.find(p => {
    const idx = parseInt(p.dataset.index, 10);
    return idx * d === startSubdiv;
  });
  if (startMarker) {
    startMarker.classList.add('drag-start');
  }

  // Create preview bar
  createPreviewBar();
  updatePreviewBar();
}

function handleDragMove(e) {
  if (!dragState.active) return;

  const clientX = e.touches ? e.touches[0].clientX : e.clientX;

  // Calculate position from mouse
  const rect = timeline.getBoundingClientRect();
  const relX = clientX - rect.left;
  const pct = Math.max(0, Math.min(1, relX / rect.width));
  const posInPulses = pct * FIXED_LG;

  // Convert to subdivision
  const d = currentDenominator;
  const subdiv = Math.round(posInPulses * d / FIXED_NUMERATOR);

  // Clamp to valid range
  const newSubdiv = Math.max(dragState.startSubdiv, Math.min(dragState.maxSubdiv, subdiv));

  if (newSubdiv !== dragState.currentSubdiv) {
    dragState.currentSubdiv = newSubdiv;
    updatePreviewBar();
    updateDragHighlight();
  }
}

function handleDragEnd() {
  if (!dragState.active) return;

  const startSubdiv = dragState.startSubdiv;
  const endSubdiv = dragState.currentSubdiv;
  const newIt = endSubdiv - startSubdiv + 1;

  // Clean up visual state
  document.body.classList.remove('dragging-it');
  cycleMarkers.forEach(m => m.classList.remove('drag-start', 'drag-range'));
  pulses.forEach(p => p.classList.remove('drag-start', 'drag-range'));

  if (dragState.previewBar) {
    dragState.previewBar.remove();
    dragState.previewBar = null;
  }

  dragState.active = false;

  // Only add if it's at least 1
  if (newIt >= 1) {
    insertItAtPosition(startSubdiv, newIt);
  }
}

function insertItAtPosition(startSubdiv, newIt) {
  const newEndSubdiv = startSubdiv + newIt;

  // Remove overlapping iTs
  itSequence = itSequence.filter(item => {
    const itemEnd = item.start + item.it;
    // Keep if completely before or completely after
    return itemEnd <= startSubdiv || item.start >= newEndSubdiv;
  });

  // Add new iT
  itSequence.push({ start: startSubdiv, it: newIt, isSilence: false });

  // Sort by start position
  itSequence.sort((a, b) => a.start - b.start);

  recalculateCyclePositions();

  // Update everything
  updateInfoDisplays();
  renderItfrEditor();
  updateIntervalBars();
}

/**
 * Fill gaps between iTs with silences
 * Each gap subdivision becomes a silence of duration 1
 */
function fillGapsWithSilences() {
  if (itSequence.length === 0) return;

  const filledSequence = [];
  let expectedStart = 0;

  for (const item of itSequence) {
    // If there's a gap before this item, fill with silences
    while (expectedStart < item.start) {
      filledSequence.push({ start: expectedStart, it: 1, isSilence: true });
      expectedStart += 1;
    }

    // Add the current item
    filledSequence.push(item);
    expectedStart = item.start + item.it;
  }

  itSequence = filledSequence;
}

function createPreviewBar() {
  if (dragState.previewBar) return;

  const bar = document.createElement('div');
  bar.className = 'interval-bar-preview';
  timeline.appendChild(bar);
  dragState.previewBar = bar;
}

function updatePreviewBar() {
  if (!dragState.previewBar || !dragState.active) return;

  const startPos = subdivToPosition(dragState.startSubdiv);
  const endPos = subdivToPosition(dragState.currentSubdiv + 1);
  const width = endPos - startPos;

  const lg = FIXED_LG;
  dragState.previewBar.style.left = `${(startPos / lg) * 100}%`;
  dragState.previewBar.style.width = `${(width / lg) * 100}%`;
}

function updateDragHighlight() {
  // Clear previous highlights
  cycleMarkers.forEach(m => m.classList.remove('drag-range'));

  if (!dragState.active) return;

  const d = currentDenominator;

  // Highlight markers in range
  for (let s = dragState.startSubdiv; s <= dragState.currentSubdiv; s++) {
    const marker = cycleMarkers.find(m =>
      parseInt(m.dataset.globalSubdiv, 10) === s
    );
    if (marker) {
      marker.classList.add('drag-range');
    }
  }
}

// ========== PLAYBACK ==========
/**
 * Get the iT index that starts at a given scaled index
 * Returns -1 if no iT starts at that position
 */
function getItIndexAtScaledStart(scaledIndex) {
  const n = FIXED_NUMERATOR;
  const d = currentDenominator;

  for (let i = 0; i < itSequence.length; i++) {
    const item = itSequence[i];
    // Convert iT start (in subdivisions) to scaled index
    // item.start is in subdivision units, scaledIndex is in d-based units
    const itScaledStart = item.start * n;
    if (itScaledStart === scaledIndex) {
      return i;
    }
  }
  return -1;
}

async function startPlayback() {
  if (itSequence.length === 0) {
    showValidationWarning(itfrEditorEl, 'Afegeix iTs per reproduir');
    return;
  }

  const lg = FIXED_LG;
  const bpm = bpmController?.getValue() || DEFAULT_BPM;
  const n = FIXED_NUMERATOR;
  const d = currentDenominator;

  // Scale by denominator to include subdivisions (like App29)
  const baseResolution = d;
  const scaledInterval = (60 / bpm) / d; // Each step = 1/d of a beat
  const scaledTotal = lg * d + 1;  // +1 extra step for pulse Lg (endpoint) without adding its subdivisions

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
    // Delay stop() so the pre-scheduled sample for the last pulse (endpoint)
    // has time to play instead of being cancelled by source.stop(0).
    setTimeout(() => audioInstance.stop(), Math.max(200, scaledInterval * 1000 * 0.6));
  };

  // Build play options
  const playOptions = {
    baseResolution,
    patternBeats: scaledTotal // Pattern length including endpoint
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

    const itIndex = getItIndexAtScaledStart(scaledIndex);
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
  pulses.forEach(p => p.classList.remove('active'));
  cycleMarkers.forEach(m => m.classList.remove('active'));
  cycleLabels.forEach(l => l.classList.remove('active'));
  intervalBars.forEach(b => b.classList.remove('highlight'));
  itfrCellsEl?.querySelectorAll('.itfr-value.active').forEach(c => c.classList.remove('active'));
}

/**
 * Highlight pulse - receives scaledIndex from audio.play()
 * Like App29: scaledIndex = pulseIndex * d for integer pulses
 * Audio scheduling moved to note provider; this handles ONLY visuals.
 */
function highlightPulse(scaledIndex) {
  if (!isPlaying) return;
  const d = currentDenominator;

  // Convert scaled index to pulse index (only highlight integer pulses)
  // scaledIndex = pulseIndex * d for integer pulses
  if (scaledIndex % d !== 0) return; // Skip subdivisions (handled by highlightCycle)

  const pulseIndex = scaledIndex / d;

  pulses.forEach(p => p.classList.remove('active'));
  const total = pulses.length > 1 ? pulses.length - 1 : 0;
  if (total <= 0) return;

  const normalized = Math.max(0, Math.min(pulseIndex, total));
  const pulse = pulses[normalized];
  if (pulse) {
    void pulse.offsetWidth;
    pulse.classList.add('active');
  }

  // Also highlight the iT bar that contains this pulse
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

  // Clear previous highlights
  cycleMarkers.forEach(m => m.classList.remove('active'));
  cycleLabels.forEach(l => l.classList.remove('active'));

  // Find and highlight matching marker/label
  const marker = cycleMarkers.find(m =>
    Number(m.dataset.cycleIndex) === cycleIndex &&
    Number(m.dataset.subdivision) === subdivisionIndex
  );
  const label = cycleLabels.find(l =>
    Number(l.dataset.cycleIndex) === cycleIndex &&
    Number(l.dataset.subdivision) === subdivisionIndex
  );

  if (marker) {
    void marker.offsetWidth;
    marker.classList.add('active');
  }
  if (label) {
    label.classList.add('active');
  }

  // Calculate position and highlight iT bar
  const n = FIXED_NUMERATOR;
  const position = cycleIndex * n + subdivisionIndex * n / currentDenominator;
  highlightBarAtPosition(position);
}

/**
 * Highlight the iT bar that contains a given position (in pulses)
 */
function highlightBarAtPosition(position) {
  // Find which iT contains this position
  for (let i = 0; i < itSequence.length; i++) {
    const item = itSequence[i];
    const startPos = subdivToPosition(item.start);
    const endPos = subdivToPosition(item.start + item.it);

    if (position >= startPos && position < endPos) {
      // Highlight this bar
      intervalBars.forEach(b => b.classList.remove('highlight'));
      const bar = intervalBars[i];
      if (bar) {
        void bar.offsetWidth;
        bar.classList.add('highlight');
      }
      // També il·luminem la cel·la corresponent de l'editor iTfr
      // (patró App28: durant play la cel·la activa s'omple).
      itfrCellsEl?.querySelectorAll('.itfr-value.active').forEach(c => c.classList.remove('active'));
      const cell = itfrCellsEl?.querySelector(`.itfr-value[data-entry-index="${i}"]`);
      if (cell) cell.classList.add('active');
      return;
    }
  }

  // No iT at this position - clear bar highlights
  intervalBars.forEach(b => b.classList.remove('highlight'));
  itfrCellsEl?.querySelectorAll('.itfr-value.active').forEach(c => c.classList.remove('active'));
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

  // Generate random iTs filling only complete cycles (not loose pulses)
  // With fraction n/d, only fill subdivisions that fit in complete cycles
  const maxSubdivs = getTotalSubdivisions();
  const subsPerCycle = newD;  // Each cycle has d subdivisions
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

  // Reset to defaults
  currentDenominator = DEFAULT_DENOMINATOR;

  if (fractionEditorController) {
    fractionEditorController.setFraction(
      { numerator: FIXED_NUMERATOR, denominator: DEFAULT_DENOMINATOR },
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
