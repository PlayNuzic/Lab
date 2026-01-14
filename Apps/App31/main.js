// App31: Sucesión de iTs Fraccionados Compuestos
// Basat en App30, amb numerador editable (2-6) i denominador editable (1-8)
// Lg=6 fix, BPM=70 fix
// Bi-direccionalitat: timeline <-> iT-seq
// Àudio melòdic amb selector d'instrument

import { getMixer } from '../../libs/sound/index.js';
import { createMelodicAudioInitializer } from '../../libs/app-common/audio-init.js';
import { bindSharedSoundEvents } from '../../libs/app-common/audio.js';
import { initMixerMenu } from '../../libs/app-common/mixer-menu.js';
import { createPreferenceStorage, registerFactoryReset, setupThemeSync, setupMutePersistence } from '../../libs/app-common/preferences.js';
import createFractionEditor from '../../libs/app-common/fraction-editor.js';
import { gridFromOrigin } from '../../libs/app-common/subdivision.js';
import { attachHover } from '../../libs/shared-ui/hover.js';
import { showValidationWarning } from '../../libs/app-common/info-tooltip.js';

// ========== CONSTANTS ==========
const FIXED_LG = 6;              // 6 pulsos (0-5) + endpoint (6)
const FIXED_BPM = 70;            // BPM fix
const DEFAULT_NUMERATOR = 2;     // Per defecte 2/3
const DEFAULT_DENOMINATOR = 3;
const MIN_NUMERATOR = 2;
const MAX_NUMERATOR = 6;
const MIN_DENOMINATOR = 1;
const MAX_DENOMINATOR = 8;

// Colors per rectangles iT
const VIBRANT_COLORS = [
  '#E76F68', // vermell
  '#FFBB33', // groc
  '#7CD6B3', // verd
  '#7BB4CD'  // blau
];

// Notes per àudio
const NOTE_CYCLE_START = 60; // C4 - primer iT de cicle fraccionat
const NOTE_CYCLE_REST = 67;  // G4 - resta d'iTs

// ========== STATE ==========
let audio = null;
let isPlaying = false;
let currentNumerator = DEFAULT_NUMERATOR;
let currentDenominator = DEFAULT_DENOMINATOR;

// iT sequence state: array of { start: number, it: number }
// start = subdivisió d'inici (global), it = durada en unitats de subdivisió
let itSequence = [];

// DOM elements
let pulses = [];
let bars = [];
let cycleMarkers = [];
let cycleLabels = [];
let pulseNumberLabels = [];
let intervalBars = []; // Rectangles iT

// Controllers
let fractionEditorController = null;

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
let currentInstrument = 'violin';
let currentMetronomeSound = (() => {
  try {
    const stored = localStorage.getItem('baseSound');
    return stored || 'click9';
  } catch {
    return 'click9';
  }
})();

// ========== PREFERENCE STORAGE ==========
const preferenceStorage = createPreferenceStorage({ prefix: 'app31', separator: '::' });
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

// Listen for instrument changes
window.addEventListener('sharedui:instrument', (e) => {
  if (e.detail?.instrument) {
    currentInstrument = e.detail.instrument;
  }
});

// ========== DOM ELEMENTS ==========
const timeline = document.getElementById('timeline');
const timelineWrapper = document.getElementById('timelineWrapper');
const playBtn = document.getElementById('playBtn');
const randomBtn = document.getElementById('randomBtn');
const resetBtn = document.getElementById('resetBtn');
const themeSelect = document.getElementById('themeSelect');
const formula = document.querySelector('.middle');
const baseSoundSelect = document.getElementById('baseSoundSelect');
const cycleSoundSelect = document.getElementById('cycleSoundSelect');
const mixerMenu = document.getElementById('mixerMenu');
const mixerTriggers = [playBtn].filter(Boolean);

// iTfr elements (created dynamically)
let itfrRow = null;
let itfrInfoColumn = null;
let itfrSeq = null;
let itfrSeqEditEl = null;
let sumDisplay = null;
let lengthDisplay = null;
let fractionSlot = null;

// ========== HOVER TOOLTIPS ==========
if (playBtn) attachHover(playBtn, { text: 'Play / Stop' });
if (randomBtn) attachHover(randomBtn, { text: 'Aleatorizar fracción y iTs' });
if (resetBtn) attachHover(resetBtn, { text: 'Reset App' });

// ========== THEME & MUTE PERSISTENCE ==========
const muteButton = document.getElementById('muteBtn');
setupThemeSync({ storage: preferenceStorage, selectEl: themeSelect });
setupMutePersistence({
  storage: preferenceStorage,
  getAudioInstance: () => audio,
  muteButton
});

// ========== MIXER SETUP ==========
const globalMixer = getMixer();
if (globalMixer) {
  globalMixer.registerChannel('pulse', { allowSolo: true, label: 'Metrónomo' });
  globalMixer.registerChannel('subdivision', { allowSolo: true, label: 'Subdivisión' });
  globalMixer.registerChannel('instrument', { allowSolo: true, label: 'Instrumento' });
}

initMixerMenu({
  menu: mixerMenu,
  triggers: mixerTriggers,
  channels: [
    { id: 'pulse', label: 'Metrónomo', allowSolo: true },
    { id: 'subdivision', label: 'Subdivisión', allowSolo: true },
    { id: 'instrument', label: 'Instrumento', allowSolo: true },
    { id: 'master', label: 'Master', allowSolo: false, isMaster: true }
  ]
});

// ========== AUDIO INITIALIZATION ==========
const _baseInitAudio = createMelodicAudioInitializer({
  defaultInstrument: 'violin'
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
 * Get total subdivisions available (Lg * d / n)
 */
function getTotalSubdivisions() {
  return (FIXED_LG * currentDenominator) / currentNumerator;
}

/**
 * Convert subdivision index to timeline position (pulses)
 */
function subdivToPosition(subdiv) {
  return subdiv * currentNumerator / currentDenominator;
}

/**
 * Get current sum of iTs (excluding silences)
 */
function getItSum() {
  return itSequence
    .filter(item => !item.isSilence)
    .reduce((sum, item) => sum + item.it, 0);
}

/**
 * Get total length in pulses
 */
function getTotalLengthPulses() {
  const sum = getItSum();
  return sum * currentNumerator / currentDenominator;
}

/**
 * Get maximum iT value for a given start position
 */
function getMaxItForStart(startSubdiv) {
  const d = currentDenominator;
  const cycleStart = Math.floor(startSubdiv / d) * d;
  const cycleEnd = cycleStart + d;
  return cycleEnd - startSubdiv;
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
function createItfrLayout() {
  // Create iTfr row
  itfrRow = document.createElement('div');
  itfrRow.className = 'itfr-row';

  // Create info column
  itfrInfoColumn = document.createElement('div');
  itfrInfoColumn.className = 'itfr-info-column';

  // Sum display
  const sumBox = document.createElement('div');
  sumBox.className = 'it-info-box';
  const sumLabel = document.createElement('span');
  sumLabel.className = 'it-info-label';
  sumLabel.textContent = 'Σ iT';
  sumDisplay = document.createElement('input');
  sumDisplay.type = 'text';
  sumDisplay.className = 'it-input';
  sumDisplay.readOnly = true;
  sumDisplay.value = '0';
  sumBox.appendChild(sumLabel);
  sumBox.appendChild(sumDisplay);

  // Length display
  const lengthBox = document.createElement('div');
  lengthBox.className = 'it-info-box';
  const lengthLabel = document.createElement('span');
  lengthLabel.className = 'it-info-label';
  lengthLabel.textContent = 'L Pfr';
  lengthDisplay = document.createElement('input');
  lengthDisplay.type = 'text';
  lengthDisplay.className = 'it-input';
  lengthDisplay.readOnly = true;
  lengthDisplay.value = '0';
  lengthBox.appendChild(lengthLabel);
  lengthBox.appendChild(lengthDisplay);

  itfrInfoColumn.appendChild(sumBox);
  itfrInfoColumn.appendChild(lengthBox);

  // Create iT-seq editor
  itfrSeq = document.createElement('div');
  itfrSeq.id = 'itfrSeq';

  const labelSpan = document.createElement('span');
  labelSpan.className = 'pz label';
  labelSpan.textContent = 'iTfr';

  fractionSlot = document.createElement('span');
  fractionSlot.id = 'fractionInlineSlot';
  fractionSlot.className = 'pz fraction-inline-container';

  const openParen = document.createElement('span');
  openParen.className = 'pz open';
  openParen.textContent = '(';

  itfrSeqEditEl = document.createElement('span');
  itfrSeqEditEl.className = 'pz edit';
  itfrSeqEditEl.contentEditable = 'true';
  itfrSeqEditEl.spellcheck = false;
  itfrSeqEditEl.textContent = '  ';

  const closeParen = document.createElement('span');
  closeParen.className = 'pz close';
  closeParen.textContent = ')';

  itfrSeq.appendChild(labelSpan);
  itfrSeq.appendChild(fractionSlot);
  itfrSeq.appendChild(openParen);
  itfrSeq.appendChild(itfrSeqEditEl);
  itfrSeq.appendChild(closeParen);

  itfrRow.appendChild(itfrInfoColumn);
  itfrRow.appendChild(itfrSeq);

  // Insert before timeline
  if (timelineWrapper && timelineWrapper.parentNode) {
    timelineWrapper.parentNode.insertBefore(itfrRow, timelineWrapper);
  }

  // Attach event listeners to edit element
  itfrSeqEditEl.addEventListener('blur', sanitizeItSeq);
  itfrSeqEditEl.addEventListener('keydown', handleItSeqKeydown);
}

// ========== FRACTION EDITOR ==========
function initFractionEditorController() {
  if (!fractionSlot) return;

  currentNumerator = DEFAULT_NUMERATOR;
  currentDenominator = DEFAULT_DENOMINATOR;

  const controller = createFractionEditor({
    mode: 'inline',
    host: fractionSlot,
    defaults: { numerator: DEFAULT_NUMERATOR, denominator: DEFAULT_DENOMINATOR },
    startEmpty: false,
    storage: {},
    addRepeatPress,
    labels: {
      numerator: { placeholder: 'n' },
      denominator: { placeholder: 'd' }
    },
    onChange: ({ cause }) => {
      if (cause !== 'init') {
        handleFractionChange();
      }
    }
  });

  fractionEditorController = controller || null;

  // App31: Complex mode - both numerator and denominator editable
  if (fractionEditorController && typeof fractionEditorController.setComplexMode === 'function') {
    fractionEditorController.setComplexMode();
  }
}

function handleFractionChange() {
  if (!fractionEditorController) return;

  const fraction = fractionEditorController.getFraction();
  let newN = fraction?.numerator;
  let newD = fraction?.denominator;

  // Clamp numerator (2-6 for App31)
  if (!Number.isFinite(newN) || newN < MIN_NUMERATOR) {
    newN = MIN_NUMERATOR;
  } else if (newN > MAX_NUMERATOR) {
    newN = MAX_NUMERATOR;
  }

  // Clamp denominator
  if (!Number.isFinite(newD) || newD < MIN_DENOMINATOR) {
    newD = MIN_DENOMINATOR;
  } else if (newD > MAX_DENOMINATOR) {
    newD = MAX_DENOMINATOR;
  }

  // Ensure denominator > numerator for proper fractions
  if (newD <= newN) {
    newD = newN + 1;
    if (newD > MAX_DENOMINATOR) {
      newD = MAX_DENOMINATOR;
      newN = newD - 1;
      if (newN < MIN_NUMERATOR) newN = MIN_NUMERATOR;
    }
  }

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
  syncItSeqFromSequence();
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

// ========== iT-SEQ EDITOR ==========
function handleItSeqKeydown(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    sanitizeItSeq();
    itfrSeqEditEl.blur();
    return;
  }

  // Allow digits, 's' for silence, space, navigation
  if (/^[0-9sS]$/.test(e.key) || e.key === ' ' ||
      e.key === 'ArrowLeft' || e.key === 'ArrowRight' ||
      e.key === 'Backspace' || e.key === 'Delete' ||
      e.key === 'Tab') {
    return;
  }

  e.preventDefault();
}

function sanitizeItSeq() {
  if (!itfrSeqEditEl) return;

  const text = itfrSeqEditEl.textContent || '';
  const tokens = text.trim().split(/\s+/).filter(Boolean);

  const validIts = [];
  const invalidTokens = [];
  const warnings = [];
  let currentPos = 0;
  const d = currentDenominator;
  const maxTotal = getTotalSubdivisions();

  for (const token of tokens) {
    // Check for silence token
    if (token.toLowerCase() === 's') {
      if (currentPos + 1 > maxTotal) {
        warnings.push('Silenci excedeix timeline');
        continue;
      }
      validIts.push({ start: currentPos, it: 1, isSilence: true });
      currentPos += 1;
      continue;
    }

    const value = parseInt(token, 10);

    if (!Number.isFinite(value) || value < 1) {
      invalidTokens.push(token);
      continue;
    }

    // Check if it fits in current cycle
    const cycleStart = Math.floor(currentPos / d) * d;
    const cycleEnd = cycleStart + d;
    const maxInCycle = cycleEnd - currentPos;

    if (value > maxInCycle) {
      warnings.push(`iT ${value} > max ${maxInCycle} en cicle`);
      continue;
    }

    // Check total doesn't exceed timeline
    if (currentPos + value > maxTotal) {
      warnings.push(`iT ${value} excedeix timeline`);
      continue;
    }

    validIts.push({ start: currentPos, it: value });
    currentPos += value;
  }

  if (invalidTokens.length > 0) {
    warnings.push(`Invàlids: ${invalidTokens.join(', ')}`);
  }

  if (warnings.length > 0 && itfrSeq) {
    showValidationWarning(itfrSeq, warnings.join(' | '));
  }

  // Update sequence
  itSequence = validIts;

  // Update displays and timeline
  updateInfoDisplays();
  syncItSeqFromSequence();
  updateIntervalBars();
}

function syncItSeqFromSequence() {
  if (!itfrSeqEditEl) return;

  if (itSequence.length === 0) {
    itfrSeqEditEl.textContent = '  ';
    return;
  }

  const tokens = itSequence.map(item => item.isSilence ? 's' : item.it);
  itfrSeqEditEl.textContent = `  ${tokens.join('  ')}  `;
}

function updateInfoDisplays() {
  const sum = getItSum();
  const totalPfr = getTotalSubdivisions();  // Lg * d / n = total pulsos fraccionats

  if (sumDisplay) {
    sumDisplay.value = sum;
    sumDisplay.classList.toggle('complete', sum >= totalPfr);
  }

  if (lengthDisplay) {
    lengthDisplay.value = totalPfr;
  }
}

// ========== TIMELINE RENDERING ==========
function renderTimeline() {
  if (!timeline) return;

  timeline.classList.add('no-anim');

  // Clear previous
  pulses = [];
  bars = [];
  cycleMarkers = [];
  cycleLabels = [];
  pulseNumberLabels = [];
  intervalBars = [];
  timeline.innerHTML = '';

  const lg = FIXED_LG;
  const n = currentNumerator;
  const d = currentDenominator;

  // Add timeline line
  const line = document.createElement('div');
  line.className = 'timeline-line';
  timeline.appendChild(line);

  // Create pulses (0 to lg inclusive)
  for (let i = 0; i <= lg; i++) {
    const pulse = document.createElement('div');
    pulse.className = 'pulse';
    pulse.dataset.index = i;
    if (i === 0 || i === lg) pulse.classList.add('endpoint');
    timeline.appendChild(pulse);
    pulses.push(pulse);

    if (i === 0 || i === lg) {
      const bar = document.createElement('div');
      bar.className = 'bar';
      timeline.appendChild(bar);
      bars.push(bar);
    }
  }

  // Create pulse numbers
  for (let i = 0; i <= lg; i++) {
    const num = document.createElement('div');
    num.className = 'pulse-number';
    if (i === 0 || i === lg) num.classList.add('endpoint');
    num.dataset.index = i;
    num.textContent = i;
    timeline.appendChild(num);
    pulseNumberLabels.push(num);
  }

  // Create cycle markers
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

  pulses.forEach((p, i) => {
    const pct = (i / lg) * 100;
    p.style.left = pct + '%';
    p.style.top = '50%';
    p.style.transform = 'translate(-50%, -50%)';
  });

  bars.forEach((bar, idx) => {
    const i = idx === 0 ? 0 : lg;
    const pct = (i / lg) * 100;
    bar.style.left = pct + '%';
    bar.style.top = '30%';
    bar.style.height = '40%';
    bar.style.transform = 'translateX(-50%)';
  });

  pulseNumberLabels.forEach((num) => {
    const idx = parseInt(num.dataset.index, 10);
    const pct = (idx / lg) * 100;
    num.style.left = pct + '%';
    num.style.top = '0';
    num.style.transform = 'translate(-50%, 0%)';
  });

  cycleMarkers.forEach((marker) => {
    const pos = parseFloat(marker.dataset.position);
    const pct = (pos / lg) * 100;
    marker.style.left = pct + '%';
    marker.style.top = '50%';
  });

  cycleLabels.forEach((label) => {
    const pos = parseFloat(label.dataset.position);
    const pct = (pos / lg) * 100;
    label.style.left = pct + '%';
    label.style.top = '75%';
  });
}

// ========== INTERVAL BARS ==========
function updateIntervalBars() {
  // Remove existing bars
  intervalBars.forEach(bar => bar.remove());
  intervalBars = [];

  if (itSequence.length === 0) return;

  const lg = FIXED_LG;

  itSequence.forEach((item, idx) => {
    const startPos = subdivToPosition(item.start);
    const endPos = subdivToPosition(item.start + item.it);
    const width = endPos - startPos;

    const bar = document.createElement('div');
    bar.className = 'interval-bar-visual';
    bar.dataset.index = idx;
    bar.style.left = `${(startPos / lg) * 100}%`;
    bar.style.width = `${(width / lg) * 100}%`;

    if (item.isSilence) {
      // Silence: transparent with dashed border
      bar.classList.add('silence');
      bar.style.background = 'transparent';
      bar.style.border = '2px dashed var(--text-secondary, #999)';
    } else {
      // Regular iT: colored
      const color = VIBRANT_COLORS[idx % VIBRANT_COLORS.length];
      bar.style.background = color;
    }

    const label = document.createElement('span');
    label.className = 'interval-bar-visual__label';
    label.textContent = item.isSilence ? 's' : item.it;
    bar.appendChild(label);

    timeline.appendChild(bar);
    intervalBars.push(bar);
  });
}

// ========== DRAG INTERACTION ==========
function attachDragHandlers() {
  // Make cycle markers draggable
  cycleMarkers.forEach(marker => {
    marker.addEventListener('mousedown', handleDragStart);
    marker.addEventListener('touchstart', handleDragStart, { passive: false });
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
  const d = currentDenominator;
  const globalSubdiv = idx * d;

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
  const cycleStart = Math.floor(startSubdiv / d) * d;
  const cycleEnd = cycleStart + d;
  const maxTotal = getTotalSubdivisions();

  // Can't start beyond timeline
  if (startSubdiv >= maxTotal) return;

  // Check if position is already occupied
  const isOccupied = itSequence.some(item => {
    const end = item.start + item.it;
    return startSubdiv >= item.start && startSubdiv < end;
  });

  // If occupied, we'll replace on drag end

  dragState = {
    active: true,
    startSubdiv: startSubdiv,
    currentSubdiv: startSubdiv,
    maxSubdiv: Math.min(cycleEnd - 1, maxTotal - 1),
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
  const n = currentNumerator;
  const subdiv = Math.round(posInPulses * d / n);

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
  itSequence.push({ start: startSubdiv, it: newIt });

  // Sort by start position
  itSequence.sort((a, b) => a.start - b.start);

  // Fill gaps with silences
  fillGapsWithSilences();

  // Update everything
  updateInfoDisplays();
  syncItSeqFromSequence();
  updateIntervalBars();
}

/**
 * Fill gaps in the sequence with silences
 */
function fillGapsWithSilences() {
  if (itSequence.length === 0) return;

  const filledSequence = [];
  let expectedStart = 0;

  for (const item of itSequence) {
    // Fill gap before this item with silences
    while (expectedStart < item.start) {
      filledSequence.push({ start: expectedStart, it: 1, isSilence: true });
      expectedStart += 1;
    }
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
async function startPlayback() {
  if (itSequence.length === 0) {
    showValidationWarning(itfrSeq, 'Afegeix iTs per reproduir');
    return;
  }

  await initAudio();
  const bpm = FIXED_BPM;
  const beatDuration = 60 / bpm;
  const d = currentDenominator;
  const n = currentNumerator;

  isPlaying = true;
  updateControlsState();

  // Create abort controller
  const abortController = { aborted: false };
  playbackAbort = abortController;

  let cyclePosition = 0; // Track position within fractional cycle (0 to d-1)

  for (let i = 0; i < itSequence.length; i++) {
    if (abortController.aborted) break;

    const item = itSequence[i];
    const durationPulses = item.it * n / d;
    const durationSeconds = durationPulses * beatDuration;

    // Highlight bar
    highlightBar(i);

    // Play melodic note (skip for silences)
    if (!item.isSilence) {
      const isFirstInCycle = cyclePosition === 0;
      const note = isFirstInCycle ? NOTE_CYCLE_START : NOTE_CYCLE_REST;
      await playMelodicNote(note, durationSeconds);
    }

    // Duration per subdivision unit
    const subdivDuration = (n / d) * beatDuration;

    // Play subdivision sounds for each subdivision unit in this iT
    for (let s = 0; s < item.it; s++) {
      if (abortController.aborted) break;

      const globalSubdiv = item.start + s;
      const subdivPos = subdivToPosition(globalSubdiv);
      const isOnPulse = Number.isInteger(subdivPos);

      if (isOnPulse) {
        highlightPulse(Math.floor(subdivPos));
        await playMetronomeClick();
      } else {
        highlightCycleMarker(globalSubdiv);
        await playCycleSound();
      }

      await sleep(subdivDuration * 1000);
    }

    // Update cycle position
    cyclePosition = (cyclePosition + item.it) % d;
  }

  // Continue playing until end of timeline (6 pulses) if sequence doesn't fill it
  const lastEndSubdiv = itSequence.length > 0
    ? itSequence[itSequence.length - 1].start + itSequence[itSequence.length - 1].it
    : 0;
  const totalSubdivs = getTotalSubdivisions();
  const remainingSubdivDuration = (n / d) * beatDuration;

  for (let s = lastEndSubdiv; s < totalSubdivs && !abortController.aborted; s++) {
    const subdivPos = subdivToPosition(s);
    const isOnPulse = Number.isInteger(subdivPos);

    if (isOnPulse) {
      highlightPulse(Math.floor(subdivPos));
      await playMetronomeClick();
    } else {
      highlightCycleMarker(s);
      await playCycleSound();
    }

    await sleep(remainingSubdivDuration * 1000);
  }

  // Clean up
  clearHighlights();
  isPlaying = false;
  playbackAbort = null;
  updateControlsState();
}

function stopPlayback() {
  if (playbackAbort) {
    playbackAbort.aborted = true;
  }
  isPlaying = false;
  clearHighlights();
  updateControlsState();
}

async function playMelodicNote(midiNumber, durationSec) {
  try {
    // Ensure Tone.js context is running
    if (window.Tone?.context?.state === 'suspended') {
      await window.Tone.context.resume();
    }

    if (currentInstrument === 'piano') {
      const { playNote } = await import('../../libs/sound/piano.js');
      await playNote(midiNumber, durationSec);
    } else if (currentInstrument === 'flute') {
      const { playNote } = await import('../../libs/sound/flute.js');
      await playNote(midiNumber, durationSec);
    } else {
      const { playNote } = await import('../../libs/sound/violin.js');
      await playNote(midiNumber, durationSec);
    }
  } catch (err) {
    console.warn('Error playing melodic note:', err);
  }
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
}

function highlightPulse(pulseIndex) {
  if (!isPlaying) return;

  pulses.forEach(p => p.classList.remove('active'));

  const pulse = pulses.find(p => parseInt(p.dataset.index, 10) === pulseIndex);
  if (pulse) {
    void pulse.offsetWidth;
    pulse.classList.add('active');
  }
}

function highlightCycleMarker(globalSubdiv) {
  if (!isPlaying) return;

  pulses.forEach(p => p.classList.remove('active'));
  cycleMarkers.forEach(m => m.classList.remove('active'));
  cycleLabels.forEach(l => l.classList.remove('active'));

  const marker = cycleMarkers.find(m =>
    parseInt(m.dataset.globalSubdiv, 10) === globalSubdiv
  );
  if (marker) {
    void marker.offsetWidth;
    marker.classList.add('active');
  }

  const label = cycleLabels.find(l =>
    parseInt(l.dataset.globalSubdiv, 10) === globalSubdiv
  );
  if (label) {
    void label.offsetWidth;
    label.classList.add('active');
  }
}

function highlightBar(barIndex) {
  if (!isPlaying) return;

  intervalBars.forEach(b => b.classList.remove('highlight'));

  const bar = intervalBars[barIndex];
  if (bar) {
    void bar.offsetWidth;
    bar.classList.add('highlight');
  }
}

// ========== CONTROLS ==========
function updateControlsState() {
  if (playBtn) {
    playBtn.classList.toggle('playing', isPlaying);
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

  // Random numerator (2-6) and denominator (must be > numerator)
  const newN = Math.floor(Math.random() * (MAX_NUMERATOR - MIN_NUMERATOR + 1)) + MIN_NUMERATOR;
  const minD = newN + 1;
  const newD = Math.floor(Math.random() * (MAX_DENOMINATOR - minD + 1)) + minD;

  if (fractionEditorController) {
    fractionEditorController.setFraction(
      { numerator: newN, denominator: newD },
      { cause: 'random', persist: true }
    );
  }
  currentNumerator = newN;
  currentDenominator = newD;

  // Generate random iTs
  const maxSubdivs = getTotalSubdivisions();
  let remaining = maxSubdivs;
  const newSequence = [];
  let pos = 0;

  while (remaining > 0 && newSequence.length < 4) {
    // Max for current cycle
    const cycleStart = Math.floor(pos / newD) * newD;
    const cycleEnd = cycleStart + newD;
    const maxInCycle = Math.min(cycleEnd - pos, remaining);

    if (maxInCycle <= 0) break;

    const it = Math.floor(Math.random() * maxInCycle) + 1;
    newSequence.push({ start: pos, it });
    pos += it;
    remaining -= it;

    // 40% chance to stop early
    if (Math.random() < 0.4 && newSequence.length >= 2) break;
  }

  itSequence = newSequence;

  renderTimeline();
  updateInfoDisplays();
  syncItSeqFromSequence();
}

function handleReset() {
  if (isPlaying) {
    stopPlayback();
  }

  // Reset to defaults (2/3 for App31)
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
  syncItSeqFromSequence();
}

// ========== EVENT LISTENERS ==========
if (playBtn) {
  playBtn.addEventListener('click', handlePlay);
}

if (randomBtn) {
  randomBtn.addEventListener('click', handleRandom);
}

if (resetBtn) {
  resetBtn.addEventListener('click', handleReset);
}

// ========== INITIALIZATION ==========
function init() {
  // Create iTfr layout
  createItfrLayout();

  // Initialize fraction editor
  initFractionEditorController();

  // Render timeline
  renderTimeline();

  // Update displays
  updateInfoDisplays();
}

// Run initialization
init();
