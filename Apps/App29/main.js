// App29: Sucesion de Pulsos Fraccionados Complejos
// Basat en App27 + pulseSeq editor per seleccionar pulsos
// Lg = numerador (dinàmic, 2-6), dibuixa 1 cicle de la fracció
// BPM=70 fix, denominador editable (2-8)
// Bi-direccionalitat: timeline <-> pulseSeq
// Playback en loop

import { getMixer, subscribeMixer } from '../../libs/sound/index.js';
import { createRhythmAudioInitializer } from '../../libs/app-common/audio-init.js';
import { createSchedulingBridge, bindSharedSoundEvents } from '../../libs/app-common/audio.js';
import { initAudioToggles } from '../../libs/app-common/audio-toggles.js';
import { initMixerMenu } from '../../libs/app-common/mixer-menu.js';
import { createPreferenceStorage, registerFactoryReset, setupThemeSync, setupMutePersistence } from '../../libs/app-common/preferences.js';
import createFractionEditor from '../../libs/app-common/fraction-editor.js';
import { gridFromOrigin } from '../../libs/app-common/subdivision.js';
import { randomInt, gcd } from '../../libs/app-common/number-utils.js';
import { attachHover } from '../../libs/shared-ui/hover.js';
import { isIntegerPulseSelectable, isPulseRemainder } from '../../libs/app-common/pulse-selectability.js';
import { showValidationWarning } from '../../libs/app-common/info-tooltip.js';
import { createBpmController } from '../../libs/app-common/bpm-controller.js';
import { initIdleCaretFlash } from '../../libs/app-common/idle-caret-flash.js';

// ========== CONSTANTS ==========
// Lg = currentNumerator (dinàmic) - es calcula en cada renderització
const DEFAULT_BPM = 60;
const MIN_BPM = 50;
const MAX_BPM = 150;
const DEFAULT_NUMERATOR = 2;     // Per defecte 2/3
const DEFAULT_DENOMINATOR = 3;   // Per defecte 2/3
const MIN_NUMERATOR = 1;         // Mínim 1 (permet 1/1)
const MAX_NUMERATOR = 6;
const MIN_DENOMINATOR = 1;       // Mínim 1 (permet 1/1)
const MAX_DENOMINATOR = 8;

// ========== STATE ==========
let audio = null;
let bpmController = null;
let isPlaying = false;
let currentNumerator = DEFAULT_NUMERATOR;
let currentDenominator = DEFAULT_DENOMINATOR;

// Selection state
const selectedPulses = new Set(); // Set of pulse keys like "2.1", "4", "6.2"

// DOM elements
let pulses = [];         // .pulse-number elements (clickable for selection)
let cycleMarkers = [];
let cycleLabels = [];

// Controllers
let fractionEditorController = null;
let pulseToggleController = null;
let selectedToggleController = null;
let cycleToggleController = null;

// Storage keys
const PULSE_AUDIO_KEY = 'pulseAudio';
const SELECTED_AUDIO_KEY = 'selectedAudio';
const CYCLE_AUDIO_KEY = 'cycleAudio';

// ========== PREFERENCE STORAGE ==========
const preferenceStorage = createPreferenceStorage({ prefix: 'app29', separator: '::' });
const { load: loadOpt, save: saveOpt, clear: clearOpt } = preferenceStorage;

registerFactoryReset({
  storage: preferenceStorage,
  onBeforeReload: () => {
    setPulseAudio(true, { persist: false });
    setSelectedAudio(true, { persist: false });
    setCycleAudio(true, { persist: false });
  }
});

// ========== SCHEDULING BRIDGE ==========
const schedulingBridge = createSchedulingBridge({ getAudio: () => audio });
window.addEventListener('sharedui:scheduling', schedulingBridge.handleSchedulingEvent);

// ========== SOUND EVENTS ==========
bindSharedSoundEvents({
  getAudio: () => audio,
  mapping: {
    baseSound: 'setBase',
    accentSound: 'setAccent',
    startSound: 'setStart',
    cycleSound: 'setCycle'
  }
});

// ========== DOM ELEMENTS ==========
const timeline = document.getElementById('timeline');
const timelineWrapper = document.getElementById('timelineWrapper');
const playBtn = document.getElementById('playBtn');
const randomBtn = document.getElementById('randomBtn');
const resetBtn = document.getElementById('resetBtn');
const themeSelect = document.getElementById('themeSelect');
const pulseToggleBtn = document.getElementById('pulseToggleBtn');
const selectedToggleBtn = document.getElementById('selectedToggleBtn');
const cycleToggleBtn = document.getElementById('cycleToggleBtn');
const mixerMenu = document.getElementById('mixerMenu');
const baseSoundSelect = document.getElementById('baseSoundSelect');
const accentSoundSelect = document.getElementById('accentSoundSelect');
const startSoundSelect = document.getElementById('startSoundSelect');
const cycleSoundSelect = document.getElementById('cycleSoundSelect');

// Pfr editor state (cell-based, App12 P-row pattern)
let pfrRow = null;
let pfrEditorEl = null;
let pfrCellsEl = null;
let pfrEndMarkerEl = null;
let pfrActiveInputEl = null;
let pfrCommitTimer = null;

/**
 * Build the Pfr editor scaffold and insert it AFTER the timeline-wrapper.
 * Also move .controls to sit BELOW the editor (timeline → editor → controls).
 * Detach the template's #pulseSeq from .middle so .middle can host the
 * block-mode fraction editor (App26/27 pattern).
 */
function createPfrLayout() {
  const templatePulseSeq = document.getElementById('pulseSeq');
  if (templatePulseSeq?.parentNode) {
    templatePulseSeq.parentNode.removeChild(templatePulseSeq);
  }

  pfrRow = document.createElement('div');
  pfrRow.className = 'pfr-row';

  pfrEditorEl = document.createElement('div');
  pfrEditorEl.className = 'pfr-editor';
  pfrEditorEl.id = 'pfrEditor';

  const label = document.createElement('div');
  label.className = 'editor-label editor-label--p';
  label.textContent = 'Pfr';

  pfrCellsEl = document.createElement('div');
  pfrCellsEl.className = 'editor-cells';

  pfrEndMarkerEl = document.createElement('div');
  pfrEndMarkerEl.className = 'editor-end-marker';
  pfrEndMarkerEl.style.display = 'none';
  pfrCellsEl.appendChild(pfrEndMarkerEl);

  pfrEditorEl.appendChild(label);
  pfrEditorEl.appendChild(pfrCellsEl);
  pfrRow.appendChild(pfrEditorEl);

  if (timelineWrapper && timelineWrapper.parentNode) {
    const parent = timelineWrapper.parentNode;
    parent.insertBefore(pfrRow, timelineWrapper.nextSibling);

    const controls = timelineWrapper.querySelector('.controls');
    if (controls) {
      parent.insertBefore(controls, pfrRow.nextSibling);
    }
  }
}

// ========== MIXER SETUP ==========
const globalMixer = getMixer();
if (globalMixer) {
  globalMixer.registerChannel('pulse', { allowSolo: true, label: 'Pulso' });
  globalMixer.registerChannel('accent', { allowSolo: true, label: 'Seleccion' });
  globalMixer.registerChannel('subdivision', { allowSolo: true, label: 'Subdivision' });
}

// ========== HOVER TOOLTIPS ==========
if (playBtn) attachHover(playBtn, { text: 'Play / Stop' });
if (randomBtn) attachHover(randomBtn, { text: 'Aleatorizar fraccion y pulsos' });
if (resetBtn) attachHover(resetBtn, { text: 'Reset App' });
if (pulseToggleBtn) attachHover(pulseToggleBtn, { text: 'Activar o silenciar el pulso' });
if (selectedToggleBtn) attachHover(selectedToggleBtn, { text: 'Activar o silenciar la seleccion' });
if (cycleToggleBtn) attachHover(cycleToggleBtn, { text: 'Activar o silenciar el ciclo' });

// ========== AUDIO TOGGLES ==========
const audioToggleManager = initAudioToggles({
  toggles: [
    {
      id: 'pulse',
      button: pulseToggleBtn,
      storageKey: PULSE_AUDIO_KEY,
      mixerChannel: 'pulse',
      defaultEnabled: true,
      onChange: (enabled) => {
        if (audio && typeof audio.setPulseEnabled === 'function') {
          audio.setPulseEnabled(enabled);
        }
      }
    },
    {
      id: 'accent',
      button: selectedToggleBtn,
      storageKey: SELECTED_AUDIO_KEY,
      mixerChannel: 'accent',
      defaultEnabled: true
    },
    {
      id: 'cycle',
      button: cycleToggleBtn,
      storageKey: CYCLE_AUDIO_KEY,
      mixerChannel: 'subdivision',
      defaultEnabled: true,
      onChange: (enabled) => {
        if (audio && typeof audio.setCycleEnabled === 'function') {
          audio.setCycleEnabled(enabled);
        }
      }
    }
  ],
  storage: {
    load: loadOpt,
    save: saveOpt
  },
  mixer: globalMixer,
  subscribeMixer,
  onMixerSnapshot: ({ channels, setFromMixer, getState }) => {
    if (!channels) return;
    const channelPairs = [
      ['pulse', 'pulse'],
      ['accent', 'accent'],
      ['cycle', 'subdivision']
    ];
    channelPairs.forEach(([toggleId, channelId]) => {
      const channelState = channels.get(channelId);
      if (!channelState) return;
      const shouldEnable = !channelState.muted;
      if (getState(toggleId) === shouldEnable) return;
      setFromMixer(toggleId, shouldEnable);
    });
  }
});

pulseToggleController = audioToggleManager.get('pulse') ?? null;
selectedToggleController = audioToggleManager.get('accent') ?? null;
cycleToggleController = audioToggleManager.get('cycle') ?? null;

function setPulseAudio(value, options) {
  pulseToggleController?.set(value, options);
}

function setSelectedAudio(value, options) {
  selectedToggleController?.set(value, options);
}

function setCycleAudio(value, options) {
  cycleToggleController?.set(value, options);
}

// ========== MIXER MENU ==========
const mixerTriggers = [playBtn].filter(Boolean);

initMixerMenu({
  menu: mixerMenu,
  triggers: mixerTriggers,
  channels: [
    { id: 'pulse', label: 'Pulso', allowSolo: true },
    { id: 'accent', label: 'Seleccion', allowSolo: true },
    { id: 'subdivision', label: 'Subdivision', allowSolo: true },
    { id: 'master', label: 'Master', allowSolo: false, isMaster: true }
  ]
});

// ========== THEME & MUTE PERSISTENCE ==========
const muteButton = document.getElementById('muteBtn');
setupThemeSync({ storage: preferenceStorage, selectEl: themeSelect });
setupMutePersistence({
  storage: preferenceStorage,
  getAudioInstance: () => audio,
  muteButton
});

// ========== AUDIO INITIALIZATION ==========
const _baseInitAudio = createRhythmAudioInitializer({
  getSoundSelects: () => ({
    baseSoundSelect,
    accentSoundSelect,
    startSoundSelect,
    cycleSoundSelect
  }),
  schedulingBridge,
  channels: [],
  defaultInstrument: 'piano'
});

async function initAudio() {
  if (!audio) {
    audio = await _baseInitAudio();

    // Apply audio toggles
    if (typeof audio.setPulseEnabled === 'function') {
      const pulseEnabled = pulseToggleController?.isEnabled() ?? true;
      audio.setPulseEnabled(pulseEnabled);
    }
    if (typeof audio.setCycleEnabled === 'function') {
      const cycleEnabled = cycleToggleController?.isEnabled() ?? true;
      audio.setCycleEnabled(cycleEnabled);
    }

    // Apply saved mute state
    const savedMute = loadOpt('mute');
    if (savedMute === '1' && typeof audio.setMute === 'function') {
      audio.setMute(true);
    }

    // Expose audio instance for sound dropdown preview
    if (typeof window !== 'undefined') window.__labAudio = audio;
  }
  return audio;
}

if (typeof window !== 'undefined') {
  window.__labInitAudio = initAudio;
}

// ========== FRACTION EDITOR ==========
function initFractionEditorController() {
  // Host is .middle (block mode above timeline, App26/27 pattern).
  const host = document.querySelector('.middle');
  if (!host) return;

  // Always start with default fraction (no persistence)
  currentNumerator = DEFAULT_NUMERATOR;
  currentDenominator = DEFAULT_DENOMINATOR;

  const controller = createFractionEditor({
    mode: 'block',
    host,
    defaults: { numerator: DEFAULT_NUMERATOR, denominator: DEFAULT_DENOMINATOR },
    startEmpty: false,
    autoReduce: true,
    minNumerator: 2,
    minDenominator: 2,
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

  // Complex mode (both numerator and denominator editable).
  if (fractionEditorController && typeof fractionEditorController.setComplexMode === 'function') {
    fractionEditorController.setComplexMode();
  }
}

function handleFractionChange() {
  if (!fractionEditorController) return;

  const fraction = fractionEditorController.getFraction();
  let newN = fraction?.numerator;
  let newD = fraction?.denominator;

  // Validate numerator range
  if (!Number.isFinite(newN) || newN < MIN_NUMERATOR) {
    newN = MIN_NUMERATOR;
  } else if (newN > MAX_NUMERATOR) {
    newN = MAX_NUMERATOR;
  }

  // Validate denominator range
  if (!Number.isFinite(newD) || newD < MIN_DENOMINATOR) {
    newD = MIN_DENOMINATOR;
  } else if (newD > MAX_DENOMINATOR) {
    newD = MAX_DENOMINATOR;
  }

  // If clamped, update the input
  if (newN !== fraction?.numerator || newD !== fraction?.denominator) {
    fractionEditorController.setFraction(
      { numerator: newN, denominator: newD },
      { cause: 'clamp', persist: true, silent: true }
    );
  }

  currentNumerator = newN;
  currentDenominator = newD;

  // Filter out invalid pulses from selection
  filterInvalidPulses();

  // Redraw timeline with new subdivisions
  renderTimeline();

  // Update pulseSeq from selection
  syncPulseSeqFromSelection();

  // Update audio transport config if playing (hot reload)
  if (audio && isPlaying) {
    applyTransportConfig();
  }
}


// ========== PULSE VALIDATION (App4-style: multiples of numerator + remainder) ==========
/**
 * Check if an integer pulse index is selectable (multiple of numerator or remainder)
 */
function isIntegerSelectable(idx) {
  return isIntegerPulseSelectable(idx, currentNumerator, currentDenominator, currentNumerator);
}

/**
 * Validates if a pulse token is valid for App29 (Complex fractions)
 * Multiples of numerator + remainder pulses + endpoints (0 and lg) are valid
 */
function isValidPulseToken(token) {
  if (typeof token !== 'string') return false;

  const lg = currentNumerator;
  const n = currentNumerator;
  const d = currentDenominator;

  // Parse token
  const trimmed = token.trim();
  if (!trimmed) return false;

  // Reject values beyond lg. App29 renders one cycle (lg = numerator), so
  // the numeric value of any valid token must be ≤ lg. `isIntegerPulseSelectable`
  // below would otherwise treat values > lg as "remainder" (they pass its
  // `index > lastCycleStart` branch) and wrongly accept them. lg itself
  // wraps to 0 via `parseAndValidateToken` before reaching this function,
  // so strict `>` is enough.
  if (pulseTokenValue(trimmed) > lg) return false;

  // Check if it's a subdivision (contains dot)
  if (trimmed.includes('.')) {
    const parts = trimmed.split('.');
    if (parts.length !== 2) return false;

    const base = parseInt(parts[0], 10);
    const subdiv = parseInt(parts[1], 10);

    if (!Number.isFinite(base) || !Number.isFinite(subdiv)) return false;

    // Base must be selectable (multiple of numerator or remainder)
    // Note: isIntegerPulseSelectable already handles 0 check
    if (!isIntegerPulseSelectable(base, n, d, lg) && base !== 0) return false;

    // Subdivision must be 1 to d-1 (0 would be the integer itself)
    if (subdiv < 1 || subdiv >= d) return false;

    return true;
  }

  // Integer pulse - 0 always valid, lg NOT selectable (only illuminates with 0), others must be selectable
  const num = parseInt(trimmed, 10);
  if (!Number.isFinite(num)) return false;

  // Pulse 0 always valid, lg is NOT selectable
  if (num === 0) return true;
  if (num === lg) return false;

  return isIntegerPulseSelectable(num, n, d, lg);
}

/**
 * Parse pulse token to get its numeric value for sorting
 */
function pulseTokenValue(token) {
  if (typeof token !== 'string') return -1;
  const trimmed = token.trim();

  if (trimmed.includes('.')) {
    const parts = trimmed.split('.');
    const base = parseInt(parts[0], 10) || 0;
    const subdiv = parseInt(parts[1], 10) || 0;
    const d = currentDenominator || 1;
    return base + subdiv / d;
  }

  return parseInt(trimmed, 10) || 0;
}

/**
 * Normalise a raw token: strip leading zeros, ensure "N.M" form.
 * "01" → "1"; "1.03" → "1.3"; "3" → "3".
 */
function normalizeToken(token) {
  if (typeof token !== 'string') return '';
  const trimmed = token.trim();
  if (!trimmed) return '';
  if (trimmed.includes('.')) {
    const [base, subdiv] = trimmed.split('.');
    return `${parseInt(base, 10) || 0}.${parseInt(subdiv, 10) || 0}`;
  }
  const n = parseInt(trimmed, 10);
  return Number.isFinite(n) ? String(n) : '';
}

/**
 * Filter out invalid pulses from selection when fraction changes
 */
function filterInvalidPulses() {
  const toRemove = [];
  for (const token of selectedPulses) {
    if (!isValidPulseToken(token)) {
      toRemove.push(token);
    }
  }
  for (const token of toRemove) {
    selectedPulses.delete(token);
  }
}

// ========== PFR EDITOR (cell-based, App12 P-row pattern) ==========
function initPulseSeqEditor() {
  createPfrLayout();
  renderPfrEditor();

  // Anchor idle-flash on the persistent editor container.
  if (pfrEditorEl) {
    initIdleCaretFlash({ targets: [pfrEditorEl] });
  }
}

function renderPfrEditor() {
  if (!pfrCellsEl) return;

  pfrCellsEl.querySelectorAll('.editor-cell').forEach(c => c.remove());
  pfrActiveInputEl = null;

  const tokens = Array.from(selectedPulses).sort((a, b) => pulseTokenValue(a) - pulseTokenValue(b));

  tokens.forEach((token, idx) => {
    pfrCellsEl.insertBefore(createPfrValueCell(token, idx), pfrEndMarkerEl);
    pfrCellsEl.insertBefore(createPfrSeparatorCell(), pfrEndMarkerEl);
  });

  const input = createPfrInputCell();
  pfrCellsEl.insertBefore(input, pfrEndMarkerEl);
  pfrCellsEl.insertBefore(createPfrSeparatorCell(), pfrEndMarkerEl);
  pfrActiveInputEl = input;
}

function createPfrSeparatorCell() {
  const cell = document.createElement('input');
  cell.type = 'text';
  cell.className = 'editor-cell editor-cell--p';
  cell.placeholder = ' ';
  cell.readOnly = true;
  cell.tabIndex = -1;
  return cell;
}

function createPfrValueCell(token, entryIndex) {
  const cell = document.createElement('input');
  cell.type = 'text';
  cell.className = 'editor-cell editor-cell--p';
  cell.value = token;
  cell.dataset.token = token;
  cell.dataset.entryIndex = String(entryIndex);
  cell.readOnly = false;
  cell.style.cursor = 'text';

  let originalValue = cell.value;

  cell.addEventListener('focus', () => {
    originalValue = cell.value;
    cell.select();
  });

  cell.addEventListener('blur', () => {
    const raw = cell.value.trim();
    if (raw === originalValue) { cell.value = originalValue; return; }

    if (raw === '') {
      selectedPulses.delete(originalValue);
      syncTimelineFromSelection();
      syncAudioAndRender();
      renderPfrEditor();
      return;
    }

    const parsed = parseAndValidateToken(raw);
    if (!parsed) {
      showValidationWarning(pfrEditorEl, `"${raw}" no es válido`);
      cell.value = originalValue;
      return;
    }
    if (parsed.warning) showValidationWarning(pfrEditorEl, parsed.warning);

    if (parsed.token === originalValue) { cell.value = originalValue; return; }

    if (selectedPulses.has(parsed.token)) {
      showValidationWarning(pfrEditorEl, `"${parsed.token}" duplicado`);
      cell.value = originalValue;
      return;
    }

    if (wouldReorderInsert(parsed.token, originalValue)) {
      showValidationWarning(pfrEditorEl, 'Reposicionando pulsos');
    }

    selectedPulses.delete(originalValue);
    selectedPulses.add(parsed.token);
    syncTimelineFromSelection();
    syncAudioAndRender();
    renderPfrEditor();
  });

  cell.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); cell.blur(); return; }
    if (e.key === 'Tab') {
      e.preventDefault();
      cell.blur();
      const next = e.shiftKey ? prevEditableCell(cell) : nextEditableCell(cell);
      if (next) next.focus();
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const atStart = cell.selectionStart === 0 && cell.selectionEnd === 0;
      const atEnd = cell.selectionStart === cell.value.length && cell.selectionEnd === cell.value.length;
      if (e.key === 'ArrowLeft' && !atStart) return;
      if (e.key === 'ArrowRight' && !atEnd) return;
      const target = e.key === 'ArrowRight' ? nextEditableCell(cell) : prevEditableCell(cell);
      if (target) { e.preventDefault(); target.focus(); }
    }
  });

  return cell;
}

function createPfrInputCell() {
  const cell = document.createElement('input');
  cell.type = 'text';
  cell.maxLength = 4;
  cell.className = 'editor-cell editor-cell--p editor-input';
  cell.readOnly = false;

  cell.addEventListener('input', () => {
    const raw = cell.value.trim();
    if (!raw) { clearTimeout(pfrCommitTimer); return; }

    // Bare digit waiting for possible ".X" subdivision — wait.
    if (/^\d+$/.test(raw)) {
      clearTimeout(pfrCommitTimer);
      pfrCommitTimer = setTimeout(() => tryCommitFromInput(cell), 500);
      return;
    }
    // Partial "N." or lone "." — wait for subdivision digit. `.X` is the
    // shorthand for "0.X" (base pulse zero is implicit) — normalizeToken
    // expands it during commit.
    if (/^\d+\.$/.test(raw) || /^\.$/.test(raw)) {
      clearTimeout(pfrCommitTimer);
      return;
    }
    // Complete "N.M" or ".M" — commit immediately.
    if (/^\d+\.\d+$/.test(raw) || /^\.\d+$/.test(raw)) {
      clearTimeout(pfrCommitTimer);
      tryCommitFromInput(cell);
      return;
    }
    cell.value = '';
    clearTimeout(pfrCommitTimer);
  });

  cell.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      clearTimeout(pfrCommitTimer);
      if (cell.value.trim()) tryCommitFromInput(cell);
      return;
    }
    if (e.key === 'Backspace' && !cell.value) {
      e.preventDefault();
      clearTimeout(pfrCommitTimer);
      const tokens = Array.from(selectedPulses).sort((a, b) => pulseTokenValue(a) - pulseTokenValue(b));
      if (tokens.length) {
        selectedPulses.delete(tokens[tokens.length - 1]);
        syncTimelineFromSelection();
        syncAudioAndRender();
        renderPfrEditor();
      }
    }
  });

  setTimeout(() => cell.focus(), 30);
  return cell;
}

function tryCommitFromInput(cell) {
  const raw = cell.value.trim();
  if (!raw) return;

  const parsed = parseAndValidateToken(raw);
  if (!parsed) {
    showValidationWarning(pfrEditorEl, `"${raw}" no es válido`);
    cell.value = '';
    return;
  }
  if (parsed.warning) showValidationWarning(pfrEditorEl, parsed.warning);

  if (selectedPulses.has(parsed.token)) {
    showValidationWarning(pfrEditorEl, `"${parsed.token}" duplicado`);
    cell.value = '';
    return;
  }

  if (wouldReorderInsert(parsed.token)) {
    showValidationWarning(pfrEditorEl, 'Reposicionando pulsos');
  }

  selectedPulses.add(parsed.token);
  syncTimelineFromSelection();
  syncAudioAndRender();
  renderPfrEditor();
}

/**
 * Parse and validate a user-entered token. Returns:
 *   { token: normalizedString, warning?: string }  on success
 *   null  if the token can never be valid (format error)
 *
 * App29-specific: Lg equals the numerator (1 cycle rendered). When the
 * user types the Lg endpoint value, it normalises to "0" (cycle wrap).
 */
function parseAndValidateToken(raw) {
  let token = normalizeToken(raw);
  let warning = null;

  const lg = currentNumerator;
  if (token === String(lg)) {
    token = '0';
    warning = `${lg} es el mismo pulso que 0`;
  }

  if (!isValidPulseToken(token)) return null;

  if (token !== raw && !warning) {
    warning = `Corregido: ${raw}→${token}`;
  }
  return { token, warning };
}

function wouldReorderInsert(token, excludeOriginal = null) {
  const newVal = pulseTokenValue(token);
  for (const existing of selectedPulses) {
    if (excludeOriginal && existing === excludeOriginal) continue;
    if (pulseTokenValue(existing) > newVal) return true;
  }
  return false;
}

function nextEditableCell(cell) {
  const all = Array.from(pfrCellsEl.querySelectorAll('.editor-cell:not([readonly])'));
  return all[all.indexOf(cell) + 1] || null;
}

function prevEditableCell(cell) {
  const all = Array.from(pfrCellsEl.querySelectorAll('.editor-cell:not([readonly])'));
  return all[all.indexOf(cell) - 1] || null;
}

function syncAudioAndRender() {
  if (isPlaying && audio) applySelectionToAudio();
}

/**
 * Public sync entry point — rebuilds the Pfr editor cells from the
 * selectedPulses set. Called from timeline click handlers and on
 * fraction change. Legacy signature accepted a scroll token; not
 * needed with the cell-based editor.
 */
function syncPulseSeqFromSelection(/* scrollToToken */) {
  renderPfrEditor();
}

/**
 * Sync timeline visual selection from selectedPulses
 */
function syncTimelineFromSelection() {
  // Clear all selections
  pulses.forEach(p => p.classList.remove('selected'));
  cycleMarkers.forEach(m => m.classList.remove('selected'));
  cycleLabels.forEach(l => l.classList.remove('selected'));

  // Apply selections
  for (const token of selectedPulses) {
    if (token.includes('.')) {
      // Subdivision - find matching cycle marker/label
      const [base, subdiv] = token.split('.').map(Number);

      const marker = cycleMarkers.find(m =>
        Number(m.dataset.base) === base &&
        Number(m.dataset.subdivision) === subdiv
      );
      const label = cycleLabels.find(l =>
        Number(l.dataset.base) === base &&
        Number(l.dataset.subdivision) === subdiv &&
        l.dataset.integerPulse === undefined  // Exclude integer labels
      );

      if (marker) marker.classList.add('selected');
      if (label) label.classList.add('selected');
    } else {
      // Integer pulse (0 to lg-1, lg is not selectable)
      const idx = parseInt(token, 10);
      const pulse = pulses.find(p => parseInt(p.dataset.index, 10) === idx);
      if (pulse) {
        pulse.classList.add('selected');
      }
      // Also mark the integer label
      const integerLabel = cycleLabels.find(l => l.dataset.integerPulse === token);
      if (integerLabel) {
        integerLabel.classList.add('selected');
      }
      // When pulse 0 is selected, also illuminate endpoint (lg)
      if (idx === 0) {
        const endpoint = pulses.find(p => parseInt(p.dataset.index, 10) === currentNumerator);
        if (endpoint) endpoint.classList.add('selected');
      }
    }
  }

  // Hot reload: update audio selection if playing
  if (isPlaying && audio) {
    applySelectionToAudio();
  }
}

/**
 * Apply current selection to audio engine (hot reload during playback)
 */
function applySelectionToAudio() {
  if (!audio || typeof audio.setSelected !== 'function') return;

  const audioSelection = getAudioSelection();
  // Pass object with values and resolution (like App4)
  audio.setSelected({ values: audioSelection.values, resolution: 1 });
}

// ========== REPEAT PRESS HELPER ==========
function addRepeatPress(el, fn) {
  if (!el) return;
  let timeoutId = null;
  let intervalId = null;

  const clearTimers = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
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

  const stop = () => {
    clearTimers();
  };

  el.addEventListener('mousedown', start);
  el.addEventListener('touchstart', start, { passive: false });
  ['mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach((name) => {
    el.addEventListener(name, stop);
  });
  document.addEventListener('mouseup', stop);
  document.addEventListener('touchend', stop);

  el.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      fn();
    }
  });
}

// ========== TIMELINE RENDERING ==========
function renderTimeline() {
  if (!timeline) return;

  timeline.classList.add('no-anim');

  pulses = [];
  cycleMarkers = [];
  cycleLabels = [];
  timeline.innerHTML = '';

  // Lg = numerator → draws exactly one cycle of the fraction
  const lg = currentNumerator;
  const numerator = currentNumerator;
  const denominator = currentDenominator;

  // Pulse numbers — nuzic-theme renders ticks via ::before/::after and hides
  // legacy .pulse dots. App29 marks non-selectable integers (those that
  // don't align with the numerator cycle) with .non-selectable.
  for (let i = 0; i <= lg; i++) {
    const num = document.createElement('div');
    num.className = 'pulse-number';
    const isEndpoint = i === 0 || i === lg;
    if (isEndpoint) num.classList.add('endpoint');
    if (!isEndpoint && !isIntegerSelectable(i)) num.classList.add('non-selectable');
    num.dataset.index = i;
    num.textContent = i;
    timeline.appendChild(num);
    pulses.push(num);
  }

  // "N/D" subdivision label anchored to the left of the subdivision row.
  const subdivisionLabel = document.createElement('div');
  subdivisionLabel.className = 'subdivision-label';
  subdivisionLabel.textContent = `${numerator}/${denominator}`;
  timeline.appendChild(subdivisionLabel);

  // Subdivision ticks + ".N" labels for fractional positions. Integers are
  // already covered by pulse-number::before ticks (nuzic-theme).
  const grid = gridFromOrigin({ lg, numerator, denominator });
  if (grid.cycles > 0 && grid.subdivisions.length) {
    grid.subdivisions.forEach(({ cycleIndex, subdivisionIndex, position }) => {
      if (subdivisionIndex === 0) return;

      const base = cycleIndex * numerator;
      const isSelectable = base === 0 || isIntegerSelectable(base);

      const marker = document.createElement('div');
      marker.className = 'cycle-marker';
      if (!isSelectable) marker.classList.add('non-selectable');
      marker.dataset.cycleIndex = String(cycleIndex);
      marker.dataset.subdivision = String(subdivisionIndex);
      marker.dataset.position = String(position);
      marker.dataset.base = String(base);
      timeline.appendChild(marker);
      cycleMarkers.push(marker);

      const label = document.createElement('div');
      label.className = 'cycle-label';
      if (!isSelectable) label.classList.add('non-selectable');
      label.dataset.cycleIndex = String(cycleIndex);
      label.dataset.subdivision = String(subdivisionIndex);
      label.dataset.position = String(position);
      label.dataset.base = String(base);
      label.textContent = `.${subdivisionIndex}`;
      timeline.appendChild(label);
      cycleLabels.push(label);
    });
  }

  // Attach click handlers for selection
  attachSelectionHandlers();

  // Layout elements
  layoutTimeline();

  // Apply current selection
  syncTimelineFromSelection();

  // Re-enable transitions
  requestAnimationFrame(() => {
    timeline.classList.remove('no-anim');
  });
}

/**
 * Attach click handlers to pulses and cycle markers for selection
 */
function attachSelectionHandlers() {
  const lg = currentNumerator;
  // All integer pulses (0 to lg-1, skip non-selectable and endpoint lg which only illuminates with 0)
  pulses.forEach((pulse) => {
    const idx = parseInt(pulse.dataset.index, 10);
    // Skip endpoint (lg) - it's not selectable, only illuminates with pulse 0
    if (idx === lg) return;
    if (pulse.classList.contains('non-selectable')) return; // Skip non-selectable

    pulse.addEventListener('click', () => {
      const token = String(idx);

      const wasSelected = selectedPulses.has(token);
      if (wasSelected) {
        selectedPulses.delete(token);
        // If deselecting pulse 0, also remove visual from endpoint
        if (idx === 0) {
          const endpoint = pulses.find(p => parseInt(p.dataset.index, 10) === currentNumerator);
          if (endpoint) endpoint.classList.remove('selected');
        }
      } else {
        selectedPulses.add(token);
        // If selecting pulse 0, also show visual on endpoint
        if (idx === 0) {
          const endpoint = pulses.find(p => parseInt(p.dataset.index, 10) === currentNumerator);
          if (endpoint) endpoint.classList.add('selected');
        }
      }

      // Update both pulseSeq text AND timeline visual (including integer labels)
      // Scroll to token if it was just added
      syncPulseSeqFromSelection(wasSelected ? null : token);
      syncTimelineFromSelection();
      // Hot reload: apply selection to audio during playback
      if (isPlaying && audio) {
        applySelectionToAudio();
      }
    });
  });

  // Subdivision markers (only selectable ones)
  cycleMarkers.forEach((marker) => {
    if (marker.classList.contains('non-selectable')) return; // Skip non-selectable

    marker.addEventListener('click', () => {
      const base = marker.dataset.base;
      const subdivision = marker.dataset.subdivision;
      const token = `${base}.${subdivision}`;

      toggleSubdivisionSelection(token, base, subdivision);
    });
  });

  // Cycle labels (clickable) - both integer and subdivision labels
  cycleLabels.forEach((label) => {
    if (label.classList.contains('non-selectable')) return; // Skip non-selectable

    label.addEventListener('click', () => {
      const integerPulse = label.dataset.integerPulse;

      // Integer pulse label
      if (integerPulse !== undefined) {
        const idx = parseInt(integerPulse, 10);
        // Skip endpoint (lg) - it's not selectable, only illuminates with pulse 0
        if (idx === currentNumerator) return;

        const token = integerPulse;
        const pulse = pulses.find(p => p.dataset.index === integerPulse);

        const wasSelected = selectedPulses.has(token);
        if (wasSelected) {
          selectedPulses.delete(token);
          if (pulse) pulse.classList.remove('selected');
          label.classList.remove('selected');
          // If deselecting pulse 0, also remove visual from endpoint
          if (idx === 0) {
            const endpoint = pulses.find(p => parseInt(p.dataset.index, 10) === currentNumerator);
            if (endpoint) endpoint.classList.remove('selected');
          }
        } else {
          selectedPulses.add(token);
          if (pulse) pulse.classList.add('selected');
          label.classList.add('selected');
          // If selecting pulse 0, also show visual on endpoint
          if (idx === 0) {
            const endpoint = pulses.find(p => parseInt(p.dataset.index, 10) === currentNumerator);
            if (endpoint) endpoint.classList.add('selected');
          }
        }
        // Scroll to token if it was just added
        syncPulseSeqFromSelection(wasSelected ? null : token);
        // Hot reload: apply selection to audio during playback
        if (isPlaying && audio) {
          applySelectionToAudio();
        }
        return;
      }

      // Subdivision label
      const base = label.dataset.base;
      const subdivision = label.dataset.subdivision;
      const token = `${base}.${subdivision}`;

      toggleSubdivisionSelection(token, base, subdivision);
    });
  });
}

/**
 * Toggle selection of a subdivision
 */
function toggleSubdivisionSelection(token, base, subdivision) {
  const wasSelected = selectedPulses.has(token);
  if (wasSelected) {
    selectedPulses.delete(token);
  } else {
    selectedPulses.add(token);
  }

  // Update marker and label
  const marker = cycleMarkers.find(m =>
    m.dataset.base === base && m.dataset.subdivision === subdivision
  );
  const label = cycleLabels.find(l =>
    l.dataset.base === base && l.dataset.subdivision === subdivision
  );

  const isSelected = selectedPulses.has(token);
  if (marker) marker.classList.toggle('selected', isSelected);
  if (label) label.classList.toggle('selected', isSelected);

  // Scroll to token if it was just added
  syncPulseSeqFromSelection(wasSelected ? null : token);
  // Hot reload: apply selection to audio during playback
  if (isPlaying && audio) {
    applySelectionToAudio();
  }
}

function layoutTimeline() {
  const lg = currentNumerator;

  // nuzic-theme positions pulse-numbers vertically; only horizontal % dynamic.
  pulses.forEach((num) => {
    const idx = parseInt(num.dataset.index, 10);
    num.style.left = (idx / lg) * 100 + '%';
  });

  // Subdivision ticks/labels: vertical positioning static in CSS.
  cycleMarkers.forEach((marker) => {
    const pos = parseFloat(marker.dataset.position);
    marker.style.left = (pos / lg) * 100 + '%';
  });

  cycleLabels.forEach((label) => {
    const pos = parseFloat(label.dataset.position);
    label.style.left = (pos / lg) * 100 + '%';
  });
}

// ========== HIGHLIGHTING ==========
function clearHighlights() {
  pulses.forEach(p => p.classList.remove('active'));
  cycleMarkers.forEach(m => m.classList.remove('active'));
  cycleLabels.forEach(l => l.classList.remove('active'));
  pfrCellsEl?.querySelectorAll('.editor-cell.active').forEach(c => c.classList.remove('active'));
}

/**
 * Highlight the Pfr cell matching `token` during playback.
 */
function highlightPulseSeqToken(token) {
  if (!pfrCellsEl || !selectedPulses.has(token)) return;

  pfrCellsEl.querySelectorAll('.editor-cell.active').forEach(c => c.classList.remove('active'));
  const cell = pfrCellsEl.querySelector(`.editor-cell[data-token="${CSS.escape(token)}"]`);
  if (cell) {
    cell.classList.add('active');
    cell.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }
}

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

  // In loop mode, pulse 0 and endpoint (lg) illuminate together
  if (pulseIndex === 0) {
    const endpoint = pulses[currentNumerator];
    if (endpoint) {
      void endpoint.offsetWidth;
      endpoint.classList.add('active');
    }
  }

  // Highlight and scroll pulseSeq token
  highlightPulseSeqToken(String(pulseIndex));
}

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

  // Highlight and scroll pulseSeq subdivision token
  const base = cycleIndex * currentNumerator;
  const token = `${base}.${subdivisionIndex}`;
  highlightPulseSeqToken(token);
}

// ========== AUDIO TRANSPORT CONFIG ==========
/**
 * Apply full transport config during hot reload (fraction change while playing)
 * Updates totalPulses, bpm (scaled), baseResolution, patternBeats, and cycle config
 *
 * Key insight: interval = (60/bpm)/d, so scaledBpm = bpm * d
 * This ensures integer pulses maintain correct tempo while subdivisions fit between them
 */
function applyTransportConfig() {
  if (!audio || typeof audio.updateTransport !== 'function') return;

  const lg = currentNumerator;
  const bpm = bpmController?.getValue() || DEFAULT_BPM;
  const n = currentNumerator;
  const d = currentDenominator;
  // Amb lg = numerador, sempre hi ha exactament 1 cicle
  const hasCycle = n > 0 && d > 0;

  // Scale values by denominator (same as startPlayback)
  const scaledTotal = lg * d;
  // scaledBpm ensures interval = (60/bpm)/d
  const scaledBpm = bpm * d;

  audio.updateTransport({
    totalPulses: scaledTotal,
    bpm: scaledBpm,
    baseResolution: d,
    patternBeats: scaledTotal,
    cycle: hasCycle ? {
      numerator: n * d,
      denominator: d,
      onTick: highlightCycle
    } : null
  });

  // Also update selection for new scale
  applySelectionToAudio();
}

// ========== CONVERT SELECTION TO AUDIO FORMAT ==========
/**
 * Convert selectedPulses Set to audio selection object with scaled indices
 * Scale factor = denominator, so subdivisions become integers
 *
 * For subdivision tokens like "0.4" with n=3, d=5:
 * - The token represents subdivisionIndex 4 of the cycle starting at base 0
 * - Position = base + subdivisionIndex * (n/d) = 0 + 4 * 0.6 = 2.4
 * - ScaledIndex = position * d = 2.4 * 5 = 12
 * - Or equivalently: base * d + subdivisionIndex * n = 0 * 5 + 4 * 3 = 12
 *
 * @returns {{ values: Set<number>, resolution: number }}
 */
function getAudioSelection() {
  const n = currentNumerator;
  const d = currentDenominator;
  const audioSet = new Set();

  for (const token of selectedPulses) {
    if (token.includes('.')) {
      // Subdivision: base.subdiv
      // ScaledIndex = base * d + subdivisionIndex * numerator
      const [baseStr, subdivStr] = token.split('.');
      const base = parseInt(baseStr, 10);
      const subdiv = parseInt(subdivStr, 10);
      if (Number.isFinite(base) && Number.isFinite(subdiv)) {
        const scaledIndex = base * d + subdiv * n;
        audioSet.add(scaledIndex);
      }
    } else {
      // Integer pulse: idx → idx * d (only 0 to lg-1, lg is not selectable)
      const idx = parseInt(token, 10);
      if (Number.isFinite(idx) && idx >= 0 && idx < currentNumerator) {
        const scaledIndex = idx * d;
        audioSet.add(scaledIndex);
      }
    }
  }

  return { values: audioSet, resolution: 1 };
}

// ========== PLAYBACK ==========
async function startPlayback() {
  const lg = currentNumerator;
  const bpm = bpmController?.getValue() || DEFAULT_BPM;
  const n = currentNumerator;
  const d = currentDenominator;

  // Scale by denominator to include subdivisions
  // Interval must be divided by d so that integer pulses maintain correct tempo
  const baseResolution = d;
  const scaledTotal = lg * d; // Total steps (without endpoint, loop mode)
  const scaledInterval = (60 / bpm) / d; // Each step = 1/d of a beat

  const audioInstance = await initAudio();

  // Amb lg = numerador, sempre hi ha exactament 1 cicle
  const hasCycle = n > 0 && d > 0;

  // Get audio selection with scaled indices
  const audioSelection = getAudioSelection();

  const onFinish = () => {
    isPlaying = false;
    playBtn.classList.remove('active');

    const iconPlay = playBtn.querySelector('.icon-play');
    const iconStop = playBtn.querySelector('.icon-stop');
    if (iconPlay && iconStop) {
      iconPlay.style.display = 'block';
      iconStop.style.display = 'none';
    }

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
    // With n=2, d=3: cycle every 6 steps (not every 2 steps)
    playOptions.cycle = {
      numerator: n * d,
      denominator: d,
      onTick: highlightCycle
    };
  }

  audioInstance.play(
    scaledTotal,
    scaledInterval,  // Interval divided by d so integer pulses maintain tempo
    audioSelection,  // Pass selection with scaled indices
    true,            // Loop ENABLED (horizontal loop always)
    highlightPulse,
    onFinish,
    playOptions
  );

  isPlaying = true;
  playBtn.classList.add('active');

  const iconPlay = playBtn.querySelector('.icon-play');
  const iconStop = playBtn.querySelector('.icon-stop');
  if (iconPlay && iconStop) {
    iconPlay.style.display = 'none';
    iconStop.style.display = 'block';
  }
}

async function stopPlayback() {
  if (!audio) return;

  audio.stop();
  isPlaying = false;
  playBtn.classList.remove('active');

  const iconPlay = playBtn.querySelector('.icon-play');
  const iconStop = playBtn.querySelector('.icon-stop');
  if (iconPlay && iconStop) {
    iconPlay.style.display = 'block';
    iconStop.style.display = 'none';
  }

  clearHighlights();
}

// ========== RANDOM & RESET ==========
/**
 * Randomize fraction and fractional pulse selection
 * Selects random valid pulses (selectable integers + their subdivisions)
 */
function randomize() {
  // 1. Random numerator (2-6) and denominator (2-8), only reduced fractions (gcd = 1)
  let newN, newD;
  do {
    newN = randomInt(MIN_NUMERATOR, MAX_NUMERATOR);
    newD = randomInt(2, MAX_DENOMINATOR);
  } while (gcd(newN, newD) !== 1); // Only reduced fractions
  currentNumerator = newN;
  currentDenominator = newD;

  if (fractionEditorController && typeof fractionEditorController.setFraction === 'function') {
    fractionEditorController.setFraction(
      { numerator: newN, denominator: newD },
      { cause: 'random', persist: true, silent: true, reveal: true }
    );
  }

  // 2. Clear current selection
  selectedPulses.clear();

  // 3. Build list of all valid pulse tokens (App29: only selectable pulses)
  // Amb lg = numerador, lg és dinàmic
  const lg = newN;
  const n = newN;
  const d = newD;
  const validTokens = [];

  // Add selectable integers (multiples of numerator + remainder, skip endpoints)
  for (let i = 1; i < lg; i++) {
    if (isIntegerPulseSelectable(i, n, d, lg)) {
      validTokens.push(String(i));
    }
  }

  // Add subdivisions for selectable bases (including 0)
  // Base 0 is always valid for subdivisions
  for (let subdiv = 1; subdiv < d; subdiv++) {
    validTokens.push(`0.${subdiv}`);
  }

  // For other selectable bases (multiples of numerator)
  for (let base = n; base < lg; base += n) {
    if (isIntegerPulseSelectable(base, n, d, lg)) {
      for (let subdiv = 1; subdiv < d; subdiv++) {
        validTokens.push(`${base}.${subdiv}`);
      }
    }
  }

  // 4. Random selection (50% density or min 1, max lg)
  const density = 0.5;
  const targetCount = Math.max(1, Math.min(lg, Math.round(validTokens.length * density * Math.random())));

  // Shuffle and pick
  const shuffled = [...validTokens].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, targetCount);

  // Add to selection
  selected.forEach(token => selectedPulses.add(token));

  // 5. Render and sync
  renderTimeline();
  syncPulseSeqFromSelection();

  // Auto-play after randomizing (consistent across apps 9+).
  if (!isPlaying) {
    clearHighlights();
    startPlayback();
  }
}

function handleReset() {
  // Clear storage
  clearOpt('d');
  clearOpt('n');
  sessionStorage.setItem('volumeResetFlag', 'true');
  window.location.reload();
}

// ========== EVENT LISTENERS ==========
playBtn?.addEventListener('click', async () => {
  if (isPlaying) {
    await stopPlayback();
  } else {
    clearHighlights();
    await startPlayback();
  }
});

randomBtn?.addEventListener('click', randomize);
resetBtn?.addEventListener('click', handleReset);

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

  // PulseSeq editor FIRST — moves the template's #pulseSeq out of .middle
  // into the pfrRow below the timeline, freeing .middle for the fraction editor.
  initPulseSeqEditor();

  // Fraction editor AFTER — hosted in the now-empty .middle above the timeline.
  initFractionEditorController();

  // Render timeline
  renderTimeline();
}

// Run init when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
