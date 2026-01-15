// App30: Sucesión de iTs Fraccionados Simples
// Basat en App28/App13, utilitza iT-seq en lloc de pulse-seq
// Lg=6 fix, BPM=70 fix, numerador=1 fix, denominador editable (1-8)
// Bi-direccionalitat: timeline <-> iT-seq
// Àudio melòdic amb selector d'instrument + so de cicle

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
const FIXED_NUMERATOR = 1;       // Numerador sempre 1 (App30)
const DEFAULT_DENOMINATOR = 2;   // Per defecte 1/2
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

// ========== MIXER SETUP ==========
const globalMixer = getMixer();
if (globalMixer) {
  globalMixer.registerChannel('pulse', { allowSolo: true, label: 'Metrónomo' });
  globalMixer.registerChannel('subdivision', { allowSolo: true, label: 'Subdivisión' });
  globalMixer.registerChannel('instrument', { allowSolo: true, label: 'Instrumento' });
}

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
 * Get total subdivisions available (Lg * d / n)
 */
function getTotalSubdivisions() {
  return (FIXED_LG * currentDenominator) / FIXED_NUMERATOR;
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
  // Only count non-silence iTs in the sum
  return itSequence
    .filter(item => !item.isSilence)
    .reduce((sum, item) => sum + item.it, 0);
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
  lengthLabel.textContent = 'Lg Fr';
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

  currentDenominator = DEFAULT_DENOMINATOR;

  const controller = createFractionEditor({
    mode: 'inline',
    host: fractionSlot,
    defaults: { numerator: FIXED_NUMERATOR, denominator: DEFAULT_DENOMINATOR },
    startEmpty: false,
    storage: {},
    addRepeatPress,
    labels: {
      numerator: { placeholder: '1' },
      denominator: { placeholder: 'd' }
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
  const maxTotal = getTotalSubdivisions();

  for (const token of tokens) {
    // Check for silence token
    if (token.toLowerCase() === 's') {
      // Silence has duration 1
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

    // Check total doesn't exceed timeline (iTs can now cross pulse boundaries)
    if (currentPos + value > maxTotal) {
      warnings.push(`iT ${value} excedeix L Pfr`);
      continue;
    }

    validIts.push({ start: currentPos, it: value, isSilence: false });
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
  const n = FIXED_NUMERATOR;
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
  let colorIndex = 0;

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
      // Render silence as transparent with dashed border
      bar.classList.add('silence');
      bar.style.background = 'transparent';
      bar.style.border = '2px dashed var(--line-color)';
      bar.style.opacity = '0.5';

      const label = document.createElement('span');
      label.className = 'interval-bar-visual__label';
      label.textContent = 's';
      label.style.color = 'var(--line-color)';
      bar.appendChild(label);
    } else {
      const color = VIBRANT_COLORS[colorIndex % VIBRANT_COLORS.length];
      bar.style.background = color;
      colorIndex++;

      const label = document.createElement('span');
      label.className = 'interval-bar-visual__label';
      label.textContent = item.it;
      bar.appendChild(label);
    }

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

  // Fill gaps with silences
  fillGapsWithSilences();

  // Update everything
  updateInfoDisplays();
  syncItSeqFromSequence();
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
    showValidationWarning(itfrSeq, 'Afegeix iTs per reproduir');
    return;
  }

  const lg = FIXED_LG;
  const bpm = FIXED_BPM;
  const n = FIXED_NUMERATOR;
  const d = currentDenominator;

  // Scale by denominator to include subdivisions (like App29)
  const baseResolution = d;
  const scaledTotal = lg * d; // Total steps
  const scaledInterval = (60 / bpm) / d; // Each step = 1/d of a beat

  const audioInstance = await initAudio();

  const hasCycle = n > 0 && d > 0 && Math.floor(lg / n) > 0;

  // No accent selection for App30 - we use melodic notes instead
  const audioSelection = { values: new Set(), resolution: 1 };

  // Pre-calculate cyclePosition for each iT (for melodic note selection)
  // cyclePosition determines if note is C4 (start of cycle) or G4 (rest)
  let cyclePos = 0;
  for (const item of itSequence) {
    item.cyclePosition = cyclePos;
    cyclePos = (cyclePos + item.it) % d;
  }

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

  // Start playback with audio.play() - this handles metronome and subdivision sounds
  // highlightPulse receives (scaledIndex, scheduledTime) for sample-accurate melodic notes
  audioInstance.play(
    scaledTotal,
    scaledInterval,
    audioSelection,
    false,  // No loop - one-shot playback
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
}

/**
 * Highlight pulse - receives scaledIndex and scheduledTime from audio.play()
 * Like App29: scaledIndex = pulseIndex * d for integer pulses
 * scheduledTime is the precise AudioContext time for sample-accurate playback
 */
function highlightPulse(scaledIndex, scheduledTime) {
  if (!isPlaying) return;
  const d = currentDenominator;
  const n = FIXED_NUMERATOR;

  // Play melodic note if an iT starts at this scaled index
  const itIndex = getItIndexAtScaledStart(scaledIndex);
  if (itIndex >= 0 && audio) {
    const item = itSequence[itIndex];
    if (!item.isSilence) {
      // Calculate note duration
      const bpm = FIXED_BPM;
      const beatDuration = 60 / bpm;
      const durationPulses = item.it * n / d;
      const durationSeconds = durationPulses * beatDuration * 0.95; // Slight gap

      // Determine note based on cycle position (tracked in item)
      const note = item.cyclePosition === 0 ? NOTE_CYCLE_START : NOTE_CYCLE_REST;

      // Use scheduledTime for sample-accurate sync with metronome
      const when = scheduledTime ?? (window.Tone?.now() || 0);
      audio.playNote(note, durationSeconds, when);
    }
  }

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
      return;
    }
  }

  // No iT at this position - clear bar highlights
  intervalBars.forEach(b => b.classList.remove('highlight'));
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

  // Random denominator (2-8)
  const newD = Math.floor(Math.random() * (MAX_DENOMINATOR - 1)) + 2;

  if (fractionEditorController) {
    fractionEditorController.setFraction(
      { numerator: FIXED_NUMERATOR, denominator: newD },
      { cause: 'random', persist: true }
    );
  }
  currentDenominator = newD;

  // Generate random iTs filling full length, with silences
  // iTs can now cross pulse boundaries, only limited by L Pfr
  const maxSubdivs = getTotalSubdivisions();
  let remaining = maxSubdivs;
  const newSequence = [];
  let pos = 0;

  while (remaining > 0) {
    // Random iT size from 1 to remaining (no cycle limit)
    const maxIt = remaining;
    const it = Math.floor(Math.random() * maxIt) + 1;
    // 30% chance of silence
    const isSilence = Math.random() < 0.3;
    newSequence.push({ start: pos, it, isSilence });
    pos += it;
    remaining -= it;
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
