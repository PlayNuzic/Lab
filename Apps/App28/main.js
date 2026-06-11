// App28: Sucesion de Pulsos Fraccionados Simples
// Basat en App26 + pulseSeq editor per seleccionar pulsos
// Lg=6 fix, BPM=85 fix, numerador=1 fix, denominador editable (1-8)
// Bi-direccionalitat: timeline <-> pulseSeq
// Playback one-shot (sense loop)

import { getMixer, setChannelMute } from '../../libs/sound/index.js';
import { CHANNEL_TIERS } from '../../libs/app-common/audio-init.js';
import { createFractionAppShell } from '../../libs/app-common/fraction-app-shell.js';
import createFractionEditor from '../../libs/app-common/fraction-editor.js';
import { createFractionTimeline } from '../../libs/app-common/fraction-timeline.js';
import { createFractionHighlighter } from '../../libs/app-common/fraction-highlight.js';
import { randomInt } from '../../libs/app-common/number-utils.js';
import { setupRandomMenu } from '../../libs/random/menu.js';
import { attachHover } from '../../libs/shared-ui/hover.js';
import { showValidationWarning } from '../../libs/app-common/info-tooltip.js';
import { createCellSequenceEditor, fractionTokenValue, normalizeFractionToken } from '../../libs/pulse-seq/index.js';
import { createBpmController } from '../../libs/app-common/bpm-controller.js';
import { initIdleCaretFlash } from '../../libs/app-common/idle-caret-flash.js';
import { addRepeatPress } from '../../libs/app-common/spinner-repeat.js';
import { reorderControls } from '../../libs/app-common/template.js';

// ========== CONSTANTS ==========
const FIXED_LG = 6;              // 6 pulsos (0-5) + endpoint (6)
const DEFAULT_BPM = 60;
const MIN_BPM = 50;
const MAX_BPM = 150;
const FIXED_NUMERATOR = 1;       // Numerador sempre 1
const DEFAULT_DENOMINATOR = 2;   // Per defecte 1/2
const MIN_DENOMINATOR = 1;
const MAX_DENOMINATOR = 8;

// ========== STATE ==========
let audio = null;
let bpmController = null;
let isPlaying = false;
let currentDenominator = DEFAULT_DENOMINATOR;

// Selection state
const selectedPulses = new Set(); // Set of pulse keys like "0.1", "3", "5.2"

// DOM elements
let pulses = [];       // .pulse-number elements (clickable for selection)
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
const timelineWrapper = document.getElementById('timelineWrapper');  // used to insert pfrRow after
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
let pfrEditorEl = null;        // .pfr-editor root
let pfrCellsEl = null;          // .pfr-cells container (holds all cells)
let pfrEndMarkerEl = null;      // .pfr-editor-end (final round marker, hidden by default)
let pfrActiveInputEl = null;    // current active input cell (for commit target)

/**
 * Build the Pfr editor scaffold and insert it AFTER the timeline-wrapper.
 * Also move .controls to sit BELOW the editor (timeline → editor → controls).
 * `.middle` ja arriba buit gràcies a `noMiddleSlot: true` al template, així
 * que podem muntar-hi el fraction editor en mode block directament.
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

    // Move .controls BELOW the editor.
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
  prefix: 'app28',
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
  // Host is `.middle` (above timeline, App26 pattern). `.middle` arriba
  // buit gràcies a `noMiddleSlot: true` al template, llest per allotjar
  // el fraction-editor en mode block.
  const host = document.querySelector('.middle');
  if (!host) return;

  // Always start with default denominator (no persistence)
  currentDenominator = DEFAULT_DENOMINATOR;

  const controller = createFractionEditor({
    mode: 'block',
    host,
    defaults: { numerator: FIXED_NUMERATOR, denominator: DEFAULT_DENOMINATOR },
    startEmpty: false,
    maxDenominator: MAX_DENOMINATOR,
    // App28 té numerador fixat a 1 — gcd(1, d) = 1 sempre, mai
    // reductible, `animateReduction` mai es dispara → ghost DOM és
    // codi mort. Saltem la creació.
    enableGhost: false,
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

  // Validate denominator range
  if (!Number.isFinite(newD) || newD < MIN_DENOMINATOR) {
    newD = MIN_DENOMINATOR;
  } else if (newD > MAX_DENOMINATOR) {
    newD = MAX_DENOMINATOR;
  }

  // If clamped, update the input
  if (newD !== fraction?.denominator) {
    fractionEditorController.setFraction(
      { numerator: FIXED_NUMERATOR, denominator: newD },
      { cause: 'clamp', persist: true, silent: true }
    );
  }

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


// ========== PULSE VALIDATION ==========
/**
 * Validates if a pulse token is valid for App28 (Simple fractions)
 * All existing subdivisions are valid (integers 0 to lg, subdivisions 0.1 to (lg-1).(d-1))
 */
function isValidPulseToken(token) {
  if (typeof token !== 'string') return false;

  const lg = FIXED_LG;
  const d = currentDenominator;

  // Parse token
  const trimmed = token.trim();
  if (!trimmed) return false;

  // Check if it's a subdivision (contains dot)
  if (trimmed.includes('.')) {
    const parts = trimmed.split('.');
    if (parts.length !== 2) return false;

    const base = parseInt(parts[0], 10);
    const subdiv = parseInt(parts[1], 10);

    if (!Number.isFinite(base) || !Number.isFinite(subdiv)) return false;

    // Base must be 0 to lg-1
    if (base < 0 || base >= lg) return false;

    // Subdivision must be 1 to d-1 (0 would be the integer itself)
    if (subdiv < 1 || subdiv >= d) return false;

    return true;
  }

  // Integer pulse — amb loop desactivat, pulse Lg és un beat final propi,
  // independent del pulse 0, així que també es pot seleccionar.
  const num = parseInt(trimmed, 10);
  if (!Number.isFinite(num)) return false;

  return num >= 0 && num <= lg;
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
// El DOM de l'editor (cel·les, timers de commit, navegació, focus) viu a
// libs/pulse-seq/cell-editor.js (extracció H-02). Aquí només hi queda el
// MODEL: validació de tokens, Set de seleccions i sincronització.

let pfrEditor = null;

function sortedPfrTokens() {
  return Array.from(selectedPulses).sort((a, b) => pulseTokenValue(a) - pulseTokenValue(b));
}

/**
 * Initialise the Pfr editor: build the editor scaffold (label + cells area),
 * insert below the timeline, then render the initial empty state.
 */
function initPulseSeqEditor() {
  createPfrLayout();

  pfrEditor = createCellSequenceEditor({
    host: pfrCellsEl,
    endMarker: pfrEndMarkerEl,
    classes: { base: 'editor-cell editor-cell--p', input: 'editor-input' },
    input: {
      maxLength: 4,  // Enough for "5.9" + safety.
      commitDelay: 1000,
      // Dígit sol → 1000ms d'espera per si l'usuari escriu ".X"; "N." o "."
      // parcials → esperar; "N.M" o ".M" complets → commit immediat (".X" és
      // l'abreviatura de "0.X": normalizeToken l'expandeix al commit).
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
        // Empty → delete this token.
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
      // Delete last committed token.
      const tokens = sortedPfrTokens();
      if (!tokens.length) return;
      selectedPulses.delete(tokens[tokens.length - 1]);
      syncTimelineFromSelection();
      syncAudioAndRender();
      renderPfrEditor();
    }
  });

  renderPfrEditor();

  // Idle caret flash on the editor container (active input is recreated on
  // every render, but the container persists — so anchor the flash there).
  if (pfrEditorEl) {
    initIdleCaretFlash({ targets: [pfrEditorEl] });
  }
}

/**
 * Render all cells from the current selectedPulses set (via cell-editor).
 */
function renderPfrEditor() {
  if (!pfrEditor) return;
  pfrEditor.render();
  pfrActiveInputEl = pfrEditor.getActiveInput();
}

/**
 * Parse and validate a user-entered token. Returns:
 *   { token: normalizedString, warning?: string }  on success
 *   null  if the token can never be valid (format error)
 */
function parseAndValidateToken(raw) {
  const token = normalizeToken(raw);

  if (!isValidPulseToken(token)) return null;

  const warning = token !== raw ? `Corregido: ${raw}→${token}` : null;
  return { token, warning };
}

/**
 * True if inserting `token` would cause existing tokens to be pushed after
 * it (i.e. the new token's value is smaller than at least one existing).
 * Used to fire the legacy "Reposicionando pulsos" warning.
 */
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
 * selectedPulses set. Called from timeline click handlers and on fraction
 * change. Legacy signature accepted a scroll token; not needed with the
 * cell-based editor.
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
      // Subdivision - find matching cycle marker/label by base and subdivision
      const [base, subdiv] = token.split('.').map(Number);

      const marker = cycleMarkers.find(m =>
        Number(m.dataset.base) === base &&
        Number(m.dataset.subdivision) === subdiv
      );
      const label = cycleLabels.find(l =>
        Number(l.dataset.base) === base &&
        Number(l.dataset.subdivision) === subdiv
      );

      if (marker) marker.classList.add('selected');
      if (label) label.classList.add('selected');
    } else {
      // Integer pulse (0 to lg, both endpoints selectable independently)
      const idx = parseInt(token, 10);
      const pulse = pulses.find(p => parseInt(p.dataset.index, 10) === idx);
      if (pulse) {
        pulse.classList.add('selected');
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
const tl = createFractionTimeline({
  timeline,
  getLg: () => FIXED_LG,
  getNumerator: () => FIXED_NUMERATOR,
  getDenominator: () => currentDenominator,
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
  // Integer pulses 0..lg-1 are selectable. Pulse `lg` is the cycle-end
  // marker (`·` with double dashes) — purely visual, not selectable and
  // not played.
  pulses.forEach((pulse) => {
    const idx = parseInt(pulse.dataset.index, 10);
    if (idx === FIXED_LG) return;

    pulse.addEventListener('click', () => {
      const token = String(idx);
      const wasSelected = selectedPulses.has(token);
      if (wasSelected) {
        selectedPulses.delete(token);
        pulse.classList.remove('selected');
      } else {
        selectedPulses.add(token);
        pulse.classList.add('selected');
      }
      // Scroll to token if it was just added
      syncPulseSeqFromSelection(wasSelected ? null : token);
      // Hot reload: apply selection to audio during playback
      if (isPlaying && audio) {
        applySelectionToAudio();
      }
    });
  });

  // Subdivision markers
  cycleMarkers.forEach((marker) => {
    marker.addEventListener('click', () => {
      const base = marker.dataset.base;
      const subdivision = marker.dataset.subdivision;
      const token = `${base}.${subdivision}`;

      toggleSubdivisionSelection(token, base, subdivision);
    });
  });

  // Subdivision labels (clickable)
  cycleLabels.forEach((label) => {
    label.addEventListener('click', () => {
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
 * quedar-se encesa fins al pròxim Pfr seleccionat (que podia ser molt
 * més tard).
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

  const lg = FIXED_LG;
  const bpm = bpmController?.getValue() || DEFAULT_BPM;
  const d = currentDenominator;
  const n = FIXED_NUMERATOR;
  const hasCycle = d > 0 && Math.floor(lg / n) > 0;

  // Scale values by denominator (same as startPlayback).
  //   scaledTotal = lg*d + 1: engine reaches the pulse-Lg step so the
  //     subdivisions just before it (5.1, 5.2, …) emit cycle events.
  //   patternBeats = lg*d    : cycle events stay within [0, lg*d) so no
  //     subdivisions INSIDE pulse Lg get scheduled.
  //   The pulse-Lg base sample is muted by the onSchedule hook in
  //     startPlayback; this function only updates transport state and
  //     does not alter that behaviour.
  const endpointStep = lg * d;
  const scaledTotal = endpointStep + 1;
  // scaledBpm ensures interval = (60/bpm)/d
  const scaledBpm = bpm * d;

  audio.updateTransport({
    totalPulses: scaledTotal,
    bpm: scaledBpm,
    baseResolution: d,
    patternBeats: endpointStep,
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
 * Example with d=4: pulse 0 → 0, pulse 0.1 → 1, pulse 1 → 4, pulse 1.2 → 6
 * @returns {{ values: Set<number>, resolution: number }}
 */
function getAudioSelection() {
  const d = currentDenominator;
  const audioSet = new Set();

  for (const token of selectedPulses) {
    if (token.includes('.')) {
      // Subdivision: base.subdiv → base * d + subdiv
      const [baseStr, subdivStr] = token.split('.');
      const base = parseInt(baseStr, 10);
      const subdiv = parseInt(subdivStr, 10);
      if (Number.isFinite(base) && Number.isFinite(subdiv)) {
        const scaledIndex = base * d + subdiv;
        audioSet.add(scaledIndex);
      }
    } else {
      // Integer pulse: idx → idx * d (0 to lg, both endpoints valid)
      const idx = parseInt(token, 10);
      if (Number.isFinite(idx) && idx >= 0 && idx <= FIXED_LG) {
        const scaledIndex = idx * d;
        audioSet.add(scaledIndex);
      }
    }
  }

  return { values: audioSet, resolution: 1 };
}

// ========== PLAYBACK ==========
async function startPlayback() {
  const lg = FIXED_LG;
  const bpm = bpmController?.getValue() || DEFAULT_BPM;
  const d = currentDenominator;
  const n = FIXED_NUMERATOR;

  // Scale by denominator to include subdivisions. Each engine step =
  // 1/d of a pulse. baseResolution=d makes only integer pulses sound as
  // base beats; fractional subdivisions sound via the cycle engine.
  //
  // scaledTotal = lg*d + 1  → engine reaches the step at pulse Lg and
  //   emits the cycle-subdivision events just before it (5.1, 5.2, …).
  // patternBeats = lg*d     → cycle events only within [0, lg*d), so no
  //   subdivisions INSIDE the cycle-end pulse (Lg) are scheduled.
  // We then mute the `pulse` channel in onSchedule for stepIndex === lg*d
  //   so the base pulse sample of pulse Lg (the `·` endpoint) stays silent.
  const baseResolution = d;
  const endpointStep = lg * d;
  const scaledTotal = endpointStep + 1;
  const scaledInterval = (60 / bpm) / d;

  const audioInstance = await initAudio();

  const hasCycle = d > 0 && Math.floor(lg / n) > 0;

  // Get audio selection with scaled indices
  const audioSelection = getAudioSelection();

  // Remember current pulse-channel mute so we can restore it on finish.
  const wasPulseMuted = !!getMixer()?.getChannelState?.('pulse')?.muted;
  let pulseMutedForEndpoint = false;

  const restorePulseChannel = () => {
    if (pulseMutedForEndpoint) {
      setChannelMute('pulse', wasPulseMuted);
      pulseMutedForEndpoint = false;
    }
  };

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
    restorePulseChannel();
    // Delay stop() so the pre-scheduled sample for the last pulse (endpoint)
    // has time to play instead of being cancelled by source.stop(0).
    setTimeout(() => audioInstance.stop(), Math.max(200, scaledInterval * 1000 * 0.6));
  };

  // Build play options
  const playOptions = {
    baseResolution,
    patternBeats: endpointStep,  // cycle events only within [0, lg*d)
    onSchedule: (stepIndex, _when) => {
      // Mute the pulse channel just before the endpoint beat (pulse Lg =
      // cycle-end `·`) so its base sample doesn't fire. Subdivisions
      // already fired before this step; onFinish restores the channel.
      if (stepIndex === endpointStep && !pulseMutedForEndpoint) {
        setChannelMute('pulse', true);
        pulseMutedForEndpoint = true;
      }
    }
  };

  if (hasCycle) {
    // Scale numerator by d to match scaled timeline
    // With n=1, d=2: cycle every 2 steps (not every 1 step)
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
    false,           // Loop DISABLED (one-shot)
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
 * Randomize denominator and fractional pulse selection
 * Selects random valid pulses (integers + subdivisions)
 */
function randomize() {
  // 1. Random denominator between 2 and the longpress-menu cap (default = MAX_DENOMINATOR).
  const { denomMax } = randomMenu?.read() ?? { denomMax: MAX_DENOMINATOR };
  const newD = randomInt(2, Math.min(denomMax, MAX_DENOMINATOR));
  currentDenominator = newD;

  if (fractionEditorController && typeof fractionEditorController.setFraction === 'function') {
    fractionEditorController.setFraction(
      { numerator: FIXED_NUMERATOR, denominator: newD },
      { cause: 'random', persist: true, silent: true, reveal: true }
    );
  }

  // 2. Clear current selection
  selectedPulses.clear();

  // 3. Build list of all valid pulse tokens
  const lg = FIXED_LG;
  const d = newD;
  const validTokens = [];

  // Add integers (1 to lg-1, skip 0 and lg as they're endpoints)
  for (let i = 1; i < lg; i++) {
    validTokens.push(String(i));
  }

  // Add subdivisions (.1 to .d-1 for each base 0 to lg-1)
  for (let base = 0; base < lg; base++) {
    for (let subdiv = 1; subdiv < d; subdiv++) {
      validTokens.push(`${base}.${subdiv}`);
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
  // setFraction NO silenciós passa per handleFractionChange (re-render
  // del pfr editor inclòs), com una edició normal.
  if (isPlaying) await stopPlayback();
  clearOpt('d');
  clearOpt('n');
  fractionEditorController?.setFraction(
    { numerator: FIXED_NUMERATOR, denominator: DEFAULT_DENOMINATOR },
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
    denomMax: { label: 'Denominador máximo', min: 2, max: MAX_DENOMINATOR, default: MAX_DENOMINATOR },
  },
  onRandomize: randomize,
});
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
