// App28: Sucesion de Pulsos Fraccionados Simples
// Basat en App26 + pulseSeq editor per seleccionar pulsos
// Lg=6 fix, BPM=85 fix, numerador=1 fix, denominador editable (1-8)
// Bi-direccionalitat: timeline <-> pulseSeq
// Playback one-shot (sense loop)

import { getMixer, subscribeMixer, setChannelMute } from '../../libs/sound/index.js';
import { createRhythmAudioInitializer, setupAudioDefaults, CHANNEL_TIERS } from '../../libs/app-common/audio-init.js';
import { createSchedulingBridge, bindSharedSoundEvents } from '../../libs/app-common/audio.js';
import { initAudioToggles } from '../../libs/app-common/audio-toggles.js';
import { initMixerMenu } from '../../libs/app-common/mixer-menu.js';
import { createPreferenceStorage, registerFactoryReset, setupThemeSync, setupMutePersistence } from '../../libs/app-common/preferences.js';
import createFractionEditor from '../../libs/app-common/fraction-editor.js';
import { gridFromOrigin } from '../../libs/app-common/subdivision.js';
import { randomInt } from '../../libs/app-common/number-utils.js';
import { setupRandomMenu } from '../../libs/random/menu.js';
import { attachHover } from '../../libs/shared-ui/hover.js';
import { showValidationWarning } from '../../libs/app-common/info-tooltip.js';
import { createCellSequenceEditor, fractionTokenValue, normalizeFractionToken } from '../../libs/pulse-seq/index.js';
import { createBpmController } from '../../libs/app-common/bpm-controller.js';
import { initIdleCaretFlash } from '../../libs/app-common/idle-caret-flash.js';
import { addRepeatPress } from '../../libs/app-common/spinner-repeat.js';

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
let pulseToggleController = null;
let selectedToggleController = null;
let cycleToggleController = null;
let randomMenu = null;  // Long-press random menu controller (read())

// Storage keys
const PULSE_AUDIO_KEY = 'pulseAudio';
const SELECTED_AUDIO_KEY = 'selectedAudio';
const CYCLE_AUDIO_KEY = 'cycleAudio';

// ========== PREFERENCE STORAGE ==========
const preferenceStorage = createPreferenceStorage({ prefix: 'app28', separator: '::' });
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

// ========== MIXER SETUP ==========
const globalMixer = getMixer();
if (globalMixer) {
  // Canals registrats al motor (TimelineAudio constructor);
  // setupAudioDefaults dins initAudio() els personalitza via RHYTHM_FULL.
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
    if (audio) {
      setupAudioDefaults(audio, { channels: CHANNEL_TIERS.RHYTHM_FULL });
    }

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


// ========== TIMELINE RENDERING ==========
function renderTimeline() {
  if (!timeline) return;

  timeline.classList.add('no-anim');

  pulses = [];
  cycleMarkers = [];
  cycleLabels = [];
  timeline.innerHTML = '';

  const lg = FIXED_LG;
  const numerator = FIXED_NUMERATOR;
  const denominator = currentDenominator;

  // Pulse numbers — nuzic-theme renders ticks via ::before/::after and hides
  // legacy .pulse dots. The numbers themselves are the clickable targets.
  // L'últim pols es dibuixa com a `·` amb dobles guions (classe cycle-end)
  // i no sona ni és seleccionable.
  for (let i = 0; i <= lg; i++) {
    const num = document.createElement('div');
    num.className = 'pulse-number';
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
  subdivisionLabel.textContent = `${numerator}/${denominator}`;
  timeline.appendChild(subdivisionLabel);

  // Subdivision ticks + ".N" labels for fractional positions. Integers are
  // skipped — already marked by pulse-number::before (nuzic-theme).
  const grid = gridFromOrigin({ lg, numerator, denominator });
  if (grid.cycles > 0 && grid.subdivisions.length) {
    grid.subdivisions.forEach(({ cycleIndex, subdivisionIndex, position }) => {
      if (subdivisionIndex === 0) return;

      const base = cycleIndex * numerator;

      const marker = document.createElement('div');
      marker.className = 'cycle-marker';
      marker.dataset.cycleIndex = String(cycleIndex);
      marker.dataset.subdivision = String(subdivisionIndex);
      marker.dataset.position = String(position);
      marker.dataset.base = String(base);
      timeline.appendChild(marker);
      cycleMarkers.push(marker);

      const label = document.createElement('div');
      label.className = 'cycle-label';
      label.dataset.cycleIndex = String(cycleIndex);
      label.dataset.subdivision = String(subdivisionIndex);
      label.dataset.position = String(position);
      label.dataset.base = String(base);
      label.textContent = `.${subdivisionIndex}`;
      timeline.appendChild(label);
      cycleLabels.push(label);
    });
  }

  attachSelectionHandlers();
  layoutTimeline();
  syncTimelineFromSelection();

  requestAnimationFrame(() => {
    timeline.classList.remove('no-anim');
  });
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

function layoutTimeline() {
  const lg = FIXED_LG;

  // Vertical positioning is handled by nuzic-theme (.pulse-number) and
  // App28 styles.css (.cycle-marker, .cycle-label). Only horizontal
  // percentage is dynamic per render.
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

// ========== HIGHLIGHTING ==========
function clearHighlights() {
  pulses.forEach(p => p.classList.remove('active'));
  cycleMarkers.forEach(m => m.classList.remove('active'));
  cycleLabels.forEach(l => l.classList.remove('active'));
  pfrCellsEl?.querySelectorAll('.editor-cell.active').forEach(c => c.classList.remove('active'));
}

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

function highlightPulse(scaledIndex) {
  if (!isPlaying) return;
  const d = currentDenominator;

  // Convert scaled index to pulse index (only highlight integer pulses)
  // scaledIndex = pulseIndex * d for integer pulses
  if (scaledIndex % d !== 0) return; // Skip subdivisions (handled by highlightCycle)

  const pulseIndex = scaledIndex / d;

  // Clear previous active states
  pulses.forEach(p => p.classList.remove('active'));

  const pulse = pulses.find(p => parseInt(p.dataset.index, 10) === pulseIndex);
  if (pulse) {
    void pulse.offsetWidth;
    pulse.classList.add('active');
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

  // Highlight and scroll pulseSeq subdivision token.
  // subdivisionIndex=0 coincideix amb un pols sencer, ja gestionat per
  // `highlightPulse` (token enter "X"). Si entréssim aquí amb token
  // "X.0", el `highlightPulseSeqToken` post-fix netejaria la cel·la
  // entera que `highlightPulse` acaba d'encendre — saltem-ho.
  if (subdivisionIndex === 0) return;
  const base = cycleIndex * FIXED_NUMERATOR;
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

// Long-press random menu (shortpress = randomize, longpress = open settings).
randomMenu = setupRandomMenu({
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
