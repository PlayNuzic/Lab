// App29: Sucesion de Pulsos Fraccionados Complejos
// Basat en App27 + pulseSeq editor per seleccionar pulsos
// Lg = numerador (dinàmic, 2-6), dibuixa 1 cicle de la fracció
// BPM=70 fix, denominador editable (2-8)
// Bi-direccionalitat: timeline <-> pulseSeq
// Playback en loop

import { CHANNEL_TIERS } from '../../libs/app-common/audio-init.js';
import { withPlayButtonLoading } from '../../libs/app-common/play-loading.js';
import { createFractionAppShell } from '../../libs/app-common/fraction-app-shell.js';
import createFractionEditor from '../../libs/app-common/fraction-editor.js';
import { createFractionTimeline } from '../../libs/app-common/fraction-timeline.js';
import { createFractionHighlighter } from '../../libs/app-common/fraction-highlight.js';
import { randomInt, gcd } from '../../libs/app-common/number-utils.js';
import { setupRandomMenu } from '../../libs/random/menu.js';
import { attachHover } from '../../libs/shared-ui/hover.js';
import { isIntegerPulseSelectable, isPulseRemainder } from '../../libs/app-common/pulse-selectability.js';
import { showValidationWarning } from '../../libs/app-common/info-tooltip.js';
import { createCellSequenceEditor, fractionTokenValue, normalizeFractionToken } from '../../libs/pulse-seq/index.js';
import { createBpmController } from '../../libs/app-common/bpm-controller.js';
import { initIdleCaretFlash } from '../../libs/app-common/idle-caret-flash.js';
import { addRepeatPress } from '../../libs/app-common/spinner-repeat.js';
import { reorderControls } from '../../libs/app-common/template.js';

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
// Els toggles d'àudio viuen al shell (shell.getToggle/setToggle).
let randomMenu = null;  // Long-press random menu controller (read())

// Storage keys
const PULSE_AUDIO_KEY = 'pulseAudio';
const SELECTED_AUDIO_KEY = 'selectedAudio';
const CYCLE_AUDIO_KEY = 'cycleAudio';

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

/**
 * Build the Pfr editor scaffold and insert it AFTER the timeline-wrapper.
 * Also move .controls to sit BELOW the editor (timeline → editor → controls).
 * `.middle` ja arriba buit gràcies a `noMiddleSlot: true` al template, així
 * que podem muntar-hi el fraction editor en mode block directament
 * (patró App26/27).
 */
function createPfrLayout() {
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

// ========== HOVER TOOLTIPS ==========
if (playBtn) attachHover(playBtn, { text: 'Play / Stop' });
if (randomBtn) attachHover(randomBtn, { text: 'Aleatorizar fraccion y pulsos' });
if (resetBtn) attachHover(resetBtn, { text: 'Reset App' });
if (pulseToggleBtn) attachHover(pulseToggleBtn, { text: 'Activar o silenciar el pulso' });
if (selectedToggleBtn) attachHover(selectedToggleBtn, { text: 'Activar o silenciar la seleccion' });
if (cycleToggleBtn) attachHover(cycleToggleBtn, { text: 'Activar o silenciar el ciclo' });

// ========== SHELL DE L'APP (H-14) ==========
// Preferències + factory reset, events de so compartits, toggles d'àudio,
// menú del mixer, tema/mute i initAudio — tot a libs/app-common/fraction-app-shell.js.
const shell = createFractionAppShell({
  prefix: 'app29',
  getAudio: () => audio,
  setAudio: (instance) => { audio = instance; },
  audio: {
    type: 'rhythm',
    channelTier: CHANNEL_TIERS.RHYTHM_FULL,
    getSoundSelects: () => ({
      baseSoundSelect,
      accentSoundSelect,
      startSoundSelect,
      cycleSoundSelect
    }),
    soundEventMapping: {
      baseSound: 'setBase',
      accentSound: 'setAccent',
      startSound: 'setStart',
      cycleSound: 'setCycle'
    }
  },
  toggles: [
    { id: 'pulse', button: pulseToggleBtn, storageKey: PULSE_AUDIO_KEY, mixerChannel: 'pulse', engineSetter: 'setPulseEnabled' },
    { id: 'accent', button: selectedToggleBtn, storageKey: SELECTED_AUDIO_KEY, mixerChannel: 'accent' },
    { id: 'cycle', button: cycleToggleBtn, storageKey: CYCLE_AUDIO_KEY, mixerChannel: 'subdivision', engineSetter: 'setCycleEnabled' }
  ],
  mixer: {
    menu: mixerMenu,
    triggers: [playBtn],
    channels: [
      { id: 'pulse', label: 'Pulso', allowSolo: true },
      { id: 'accent', label: 'Seleccion', allowSolo: true },
      { id: 'subdivision', label: 'Subdivision', allowSolo: true },
      { id: 'master', label: 'Master', allowSolo: false, isMaster: true }
    ]
  },
  theme: {
    selectEl: themeSelect,
    muteButton: document.getElementById('muteBtn')
  }
});

const { load: loadOpt, save: saveOpt, clear: clearOpt, initAudio } = shell;

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
 * (delegat a libs/pulse-seq, parametritzat amb el denominador actual)
 */
function pulseTokenValue(token) {
  return fractionTokenValue(token, currentDenominator || 1);
}

/**
 * Normalise a raw token: "01" → "1"; "1.03" → "1.3"; ".2" → "0.2".
 * (delegat a libs/pulse-seq)
 */
const normalizeToken = normalizeFractionToken;

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
// El DOM de l'editor viu a libs/pulse-seq/cell-editor.js (extracció H-02).
// Aquí només hi queda el MODEL: validació de tokens (fraccions complexes),
// Set de seleccions i sincronització.

let pfrEditor = null;

function sortedPfrTokens() {
  return Array.from(selectedPulses).sort((a, b) => pulseTokenValue(a) - pulseTokenValue(b));
}

function initPulseSeqEditor() {
  createPfrLayout();

  pfrEditor = createCellSequenceEditor({
    host: pfrCellsEl,
    endMarker: pfrEndMarkerEl,
    classes: { base: 'editor-cell editor-cell--p', input: 'editor-input' },
    input: {
      maxLength: 4,
      commitDelay: 500,
      // Dígit sol → espera curta per si l'usuari escriu ".X"; "N."/"." → esperar;
      // "N.M"/".M" complets → commit immediat (".X" = "0.X", base 0 implícita).
      classify: (raw) => {
        if (/^\d+$/.test(raw)) return 'defer';
        if (/^\d+\.$/.test(raw) || /^\.$/.test(raw)) return 'wait';
        if (/^\d+\.\d+$/.test(raw) || /^\.\d+$/.test(raw)) return 'commit';
        return 'clear';
      },
      arrowNav: true,
      emptyEnterTab: true
    },
    getEntries: () => sortedPfrTokens().map(t => ({ display: t, token: t })),
    onCommitInput: (raw) => {
      if (!raw) return false;
      const parsed = parseAndValidateToken(raw);
      if (!parsed) {
        showValidationWarning(pfrEditorEl, `"${raw}" no es válido`);
        return false;
      }
      if (parsed.warning) showValidationWarning(pfrEditorEl, parsed.warning);
      if (selectedPulses.has(parsed.token)) {
        showValidationWarning(pfrEditorEl, `"${parsed.token}" duplicado`);
        return false;
      }
      if (wouldReorderInsert(parsed.token)) {
        showValidationWarning(pfrEditorEl, 'Reposicionando pulsos');
      }
      selectedPulses.add(parsed.token);
      syncTimelineFromSelection();
      syncAudioAndRender();
      renderPfrEditor();
      return true;
    },
    onEditEntry: (entryIndex, raw) => {
      const originalToken = sortedPfrTokens()[entryIndex];
      if (originalToken == null) return false;
      if (raw === '') {
        selectedPulses.delete(originalToken);
        syncTimelineFromSelection();
        syncAudioAndRender();
        renderPfrEditor();
        return true;
      }
      const parsed = parseAndValidateToken(raw);
      if (!parsed) {
        showValidationWarning(pfrEditorEl, `"${raw}" no es válido`);
        return false;
      }
      if (parsed.warning) showValidationWarning(pfrEditorEl, parsed.warning);
      if (parsed.token === originalToken) return false;
      if (selectedPulses.has(parsed.token)) {
        showValidationWarning(pfrEditorEl, `"${parsed.token}" duplicado`);
        return false;
      }
      if (wouldReorderInsert(parsed.token, originalToken)) {
        showValidationWarning(pfrEditorEl, 'Reposicionando pulsos');
      }
      selectedPulses.delete(originalToken);
      selectedPulses.add(parsed.token);
      syncTimelineFromSelection();
      syncAudioAndRender();
      renderPfrEditor();
      return true;
    },
    onDeleteLast: () => {
      const tokens = sortedPfrTokens();
      if (!tokens.length) return;
      selectedPulses.delete(tokens[tokens.length - 1]);
      syncTimelineFromSelection();
      syncAudioAndRender();
      renderPfrEditor();
    }
  });

  renderPfrEditor();

  // Anchor idle-flash on the persistent editor container.
  if (pfrEditorEl) {
    initIdleCaretFlash({ targets: [pfrEditorEl] });
  }
}

function renderPfrEditor() {
  if (!pfrEditor) return;
  pfrEditor.render();
  pfrActiveInputEl = pfrEditor.getActiveInput();
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


// ========== TIMELINE I HIGHLIGHTS (factories compartides, H-15/H-16) ==========
// App29 dibuixa 1 cicle (lg = numerador) i marca .non-selectable els enters
// que no s'alineen amb el cicle del numerador (i les seves subdivisions).
const tl = createFractionTimeline({
  timeline,
  getLg: () => currentNumerator,
  getNumerator: () => currentNumerator,
  getDenominator: () => currentDenominator,
  decoratePulse: (el, { index, lg }) => {
    const isEndpoint = index === 0 || index === lg;
    if (isEndpoint) el.classList.add('endpoint');
    if (!isEndpoint && !isIntegerSelectable(index)) el.classList.add('non-selectable');
  },
  decorateSubdivision: (el, { base }) => {
    if (!(base === 0 || isIntegerSelectable(base))) el.classList.add('non-selectable');
  },
  onAfterRender: (els) => {
    pulses = els.pulses;
    cycleMarkers = els.cycleMarkers;
    cycleLabels = els.cycleLabels;
    attachSelectionHandlers();
    syncTimelineFromSelection();
  }
});

function renderTimeline() {
  tl.render();
}

const highlighter = createFractionHighlighter({
  getPulses: () => pulses,
  getCycleMarkers: () => cycleMarkers,
  getCycleLabels: () => cycleLabels,
  onClear: () => {
    pfrCellsEl?.querySelectorAll('.editor-cell.active').forEach(c => c.classList.remove('active'));
  },
  onPulseHighlight: (pulseIndex) => highlightPulseSeqToken(String(pulseIndex)),
  onCycleHighlight: ({ subdivisionIndex, base }) => {
    // subdivisionIndex=0 coincideix amb un pols sencer (token enter), ja
    // gestionat per highlightPulse — un token "X.0" esborraria la cel·la
    // que highlightPulse acaba d'encendre.
    if (subdivisionIndex === 0 || base == null) return;
    highlightPulseSeqToken(`${base}.${subdivisionIndex}`);
  }
});

function clearHighlights() {
  highlighter.clear();
}

function highlightPulse(scaledIndex) {
  if (!isPlaying) return;
  const d = currentDenominator;
  // scaledIndex = polsIndex × d per als enters; subdivisions → highlightCycle
  if (scaledIndex % d !== 0) return;
  highlighter.highlightPulseIndex(scaledIndex / d);
}

function highlightCycle(payload = {}) {
  if (!isPlaying) return;
  highlighter.highlightCycle(payload);
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


// ========== HIGHLIGHTING ==========

/**
 * Highlight the Pfr cell matching `token` during playback.
 *
 * Sempre netejem el highlight previ (encara que el `token` actual no
 * estigui seleccionat). Així la cel·la activa s'apaga al pròxim pols
 * fraccionat de la graella, sigui o no seleccionat, en lloc de
 * quedar-se encesa fins al pròxim Pfr seleccionat.
 */
function highlightPulseSeqToken(token) {
  if (!pfrCellsEl) return;
  pfrCellsEl.querySelectorAll('.editor-cell.active').forEach(c => c.classList.remove('active'));
  if (!selectedPulses.has(token)) return;
  const cell = pfrCellsEl.querySelector(`.editor-cell[data-token="${CSS.escape(token)}"]`);
  if (cell) {
    cell.classList.add('active');
    cell.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }
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

  // U-27: estat de càrrega compartit al primer Play (Tone.js + samples)
  const audioInstance = await withPlayButtonLoading(playBtn, () => initAudio());

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
  // 1. Random numerator (1..numMax) and denominator (2..denomMax), only reduced fractions (gcd = 1).
  const { numMax, denomMax } = randomMenu?.read() ?? { numMax: MAX_NUMERATOR, denomMax: MAX_DENOMINATOR };
  const nMax = Math.min(numMax, MAX_NUMERATOR);
  const dMax = Math.min(denomMax, MAX_DENOMINATOR);
  let newN, newD;
  do {
    newN = randomInt(MIN_NUMERATOR, nMax);
    newD = randomInt(2, dMax);
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

async function handleReset() {
  // LU-02: reset in-place (patró App32/App34) — abans location.reload():
  // flaix en blanc, AudioContext fora i tall sec si estava sonant. El
  // setFraction NO silenciós passa per handleFractionChange, com una
  // edició normal.
  if (isPlaying) await stopPlayback();
  clearOpt('d');
  clearOpt('n');
  fractionEditorController?.setFraction(
    { numerator: DEFAULT_NUMERATOR, denominator: DEFAULT_DENOMINATOR },
    { cause: 'reset', persist: true }
  );
  selectedPulses.clear();
  renderTimeline();
  syncPulseSeqFromSelection();
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

// Long-press random menu (shortpress = randomize, longpress = open settings).
randomMenu = setupRandomMenu({
  storage: { load: loadOpt, save: saveOpt }, // LU-03: la config del menú sobreviu recàrregues
  spec: {
    numMax:   { label: 'Numerador máximo',   min: MIN_NUMERATOR, max: MAX_NUMERATOR,   default: MAX_NUMERATOR },
    denomMax: { label: 'Denominador máximo', min: 2,             max: MAX_DENOMINATOR, default: MAX_DENOMINATOR },
  },
  onRandomize: randomize,
});
resetBtn?.addEventListener('click', handleReset);

// U-27 (patró App32/App34): escalfa l'àudio al primer gest perquè el
// primer Play no pagui Tone.js + samples sencers.
document.addEventListener('click', () => { initAudio(); }, { once: true });
document.addEventListener('touchstart', () => { initAudio(); }, { once: true });

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

  // Ordre nuzic de la fila de controls (helper compartit, H-08)
  reorderControls();

  // Pfr editor (cell-based) sota la timeline. `.middle` ja arriba buit
  // gràcies a `noMiddleSlot: true` al template.
  initPulseSeqEditor();

  // Fraction editor (block mode) muntat sobre `.middle`.
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
