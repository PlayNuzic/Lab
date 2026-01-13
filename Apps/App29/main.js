// App29: Sucesion de Pulsos Fraccionados Complejos
// Basat en App27 + pulseSeq editor per seleccionar pulsos
// Lg=6 fix, BPM=85 fix, numerador editable (1-6), denominador editable (1-8)
// Validacio com App4: nomes multiples del numerador + remainder
// Bi-direccionalitat: timeline <-> pulseSeq
// Playback one-shot (sense loop)

import { getMixer, subscribeMixer } from '../../libs/sound/index.js';
import { createRhythmAudioInitializer } from '../../libs/app-common/audio-init.js';
import { createSchedulingBridge, bindSharedSoundEvents } from '../../libs/app-common/audio.js';
import { initAudioToggles } from '../../libs/app-common/audio-toggles.js';
import { initMixerMenu } from '../../libs/app-common/mixer-menu.js';
import { createPreferenceStorage, registerFactoryReset, setupThemeSync, setupMutePersistence } from '../../libs/app-common/preferences.js';
import createFractionEditor from '../../libs/app-common/fraction-editor.js';
import { gridFromOrigin, computeSubdivisionFontRem } from '../../libs/app-common/subdivision.js';
import { randomInt } from '../../libs/app-common/number-utils.js';
import { attachHover } from '../../libs/shared-ui/hover.js';
import createPulseSeqController from '../../libs/pulse-seq/pulse-seq.js';
import { isIntegerPulseSelectable, isPulseRemainder } from '../../libs/app-common/pulse-selectability.js';

// ========== CONSTANTS ==========
const FIXED_LG = 6;              // 6 pulsos (0-5) + endpoint (6)
const FIXED_BPM = 85;            // BPM fix
const DEFAULT_NUMERATOR = 2;     // Per defecte 2/3
const DEFAULT_DENOMINATOR = 3;   // Per defecte 2/3
const MIN_NUMERATOR = 1;
const MAX_NUMERATOR = 6;
const MIN_DENOMINATOR = 1;
const MAX_DENOMINATOR = 8;

// ========== STATE ==========
let audio = null;
let isPlaying = false;
let currentNumerator = DEFAULT_NUMERATOR;
let currentDenominator = DEFAULT_DENOMINATOR;

// Selection state
const selectedPulses = new Set(); // Set of pulse keys like "2.1", "4", "6.2"

// DOM elements
let pulses = [];
let bars = [];
let cycleMarkers = [];
let cycleLabels = [];
let pulseNumberLabels = [];

// Controllers
let fractionEditorController = null;
let pulseToggleController = null;
let selectedToggleController = null;
let cycleToggleController = null;
let pulseSeqEditorController = null;

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
const formula = document.querySelector('.middle');

// PulseSeq elements
let pulseSeqWrapper = null;
let pulseSeqEl = null;
let pulseSeqEditEl = null;
let pulseSeqController = null;

/**
 * Custom markup builder for App29: Pfr: [edit]
 * El camp editable permet entrar 0 i Lg (6) com a pulsos vàlids
 */
function app29MarkupBuilder({ root, initialText }) {
  if (!root) return { editEl: null };
  const mk = (cls, txt) => {
    const span = document.createElement('span');
    span.className = `pz ${cls}`;
    if (txt != null) span.textContent = txt;
    return span;
  };
  root.textContent = '';

  const labelSpan = mk('label', 'Pfr:');
  const edit = mk('edit', initialText || '  ');
  edit.contentEditable = 'true';
  edit.spellcheck = false;

  root.append(labelSpan, edit);

  // Store references
  pulseSeqEditEl = edit;

  return { editEl: edit };
}

function createPulseSeqElement() {
  pulseSeqWrapper = document.createElement('div');
  pulseSeqWrapper.className = 'pulse-seq-wrapper';

  pulseSeqEl = document.createElement('div');
  pulseSeqEl.id = 'pulseSeq';

  pulseSeqWrapper.appendChild(pulseSeqEl);

  // Insert after .middle (formula) and before .timeline-wrapper
  if (timelineWrapper && timelineWrapper.parentNode) {
    timelineWrapper.parentNode.insertBefore(pulseSeqWrapper, timelineWrapper);
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
  channels: []
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
  if (!formula) return;

  // Always start with default fraction (no persistence)
  currentNumerator = DEFAULT_NUMERATOR;
  currentDenominator = DEFAULT_DENOMINATOR;

  const controller = createFractionEditor({
    mode: 'block',
    host: formula,
    defaults: { numerator: DEFAULT_NUMERATOR, denominator: DEFAULT_DENOMINATOR },
    startEmpty: false,
    // No storage - always start fresh with defaults
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

  // NO setSimpleMode() - fraccions complexes actives (numerador editable)
  // Set complex mode explicitly
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

  // Update audio cycle config if playing
  if (audio && isPlaying) {
    applyCycleConfig();
  }
}


// ========== PULSE VALIDATION (App4-style: multiples of numerator + remainder) ==========
/**
 * Check if an integer pulse index is selectable (multiple of numerator or remainder)
 */
function isIntegerSelectable(idx) {
  return isIntegerPulseSelectable(idx, currentNumerator, currentDenominator, FIXED_LG);
}

/**
 * Validates if a pulse token is valid for App29 (Complex fractions)
 * Multiples of numerator + remainder pulses + endpoints (0 and lg) are valid
 */
function isValidPulseToken(token) {
  if (typeof token !== 'string') return false;

  const lg = FIXED_LG;
  const n = currentNumerator;
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

    // Base must be selectable (multiple of numerator or remainder)
    // Note: isIntegerPulseSelectable already handles 0 check
    if (!isIntegerPulseSelectable(base, n, d, lg) && base !== 0) return false;

    // Subdivision must be 1 to d-1 (0 would be the integer itself)
    if (subdiv < 1 || subdiv >= d) return false;

    return true;
  }

  // Integer pulse - 0 and lg always valid, others must be selectable
  const num = parseInt(trimmed, 10);
  if (!Number.isFinite(num)) return false;

  // Endpoints always valid
  if (num === 0 || num === lg) return true;

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

// ========== PULSE SEQUENCE EDITOR ==========
function initPulseSeqEditor() {
  createPulseSeqElement();

  // Initialize pulse-seq controller
  pulseSeqController = createPulseSeqController();
  pulseSeqController.mount({
    root: pulseSeqEl,
    markupBuilder: app29MarkupBuilder
  });

  if (!pulseSeqEditEl) return;

  // Attach event listeners
  pulseSeqEditEl.addEventListener('blur', sanitizePulseSeq);
  pulseSeqEditEl.addEventListener('keydown', handlePulseSeqKeydown);
  pulseSeqEditEl.addEventListener('focus', handlePulseSeqFocus);
  pulseSeqEditEl.addEventListener('input', handlePulseSeqInput);
}

// Track if we're in a backspace/delete operation to avoid caret repositioning
let isDeleting = false;

function handlePulseSeqKeydown(e) {
  // Enter: sanitize and blur
  if (e.key === 'Enter') {
    e.preventDefault();
    sanitizePulseSeq();
    pulseSeqEditEl.blur();
    return;
  }

  // Arrow navigation: move between midpoints (gaps between tokens)
  if (e.key === 'ArrowLeft' || e.key === 'Home') {
    e.preventDefault();
    pulseSeqController.moveCaretStep(-1);
    return;
  }
  if (e.key === 'ArrowRight' || e.key === 'End') {
    e.preventDefault();
    pulseSeqController.moveCaretStep(1);
    return;
  }

  // Track delete operations to prevent caret repositioning
  if (e.key === 'Backspace' || e.key === 'Delete') {
    isDeleting = true;
    return; // Allow default behavior
  }

  // Allow: digits, dot, space, arrows
  const allowed = new Set([
    'ArrowUp', 'ArrowDown', 'Tab'
  ]);

  if (/^[0-9]$/.test(e.key) || e.key === '.' || e.key === ' ' || allowed.has(e.key)) {
    return; // Allow
  }

  e.preventDefault();
}

function handlePulseSeqFocus() {
  // Normalize gaps and move to nearest midpoint
  setTimeout(() => {
    const text = pulseSeqEditEl.textContent || '';
    const normalized = normalizeGaps(text);
    if (normalized !== text) {
      pulseSeqEditEl.textContent = normalized;
    }
    pulseSeqController.moveCaretToNearestMidpoint();
  }, 0);
}

function handlePulseSeqInput() {
  // Skip caret repositioning during delete operations
  if (isDeleting) {
    isDeleting = false;
    return;
  }
  // After input, move caret to nearest midpoint
  setTimeout(() => {
    pulseSeqController.moveCaretToNearestMidpoint();
  }, 0);
}

/**
 * Normalize gaps: ensure double spaces between tokens
 */
function normalizeGaps(text) {
  if (typeof text !== 'string') return '  ';
  const trimmed = text.trim();
  if (!trimmed) return '  ';
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  return tokens.length ? `  ${tokens.join('  ')}  ` : '  ';
}

/**
 * Sanitize and validate pulse sequence input
 */
function sanitizePulseSeq() {
  if (!pulseSeqEditEl) return;

  const text = pulseSeqEditEl.textContent || '';
  const tokens = text.trim().split(/\s+/).filter(Boolean);

  // Validate and collect valid tokens
  const validTokens = [];
  for (const token of tokens) {
    if (isValidPulseToken(token)) {
      // Normalize format (remove leading zeros, etc)
      const normalized = normalizeToken(token);
      if (!validTokens.includes(normalized)) {
        validTokens.push(normalized);
      }
    }
  }

  // Sort by value
  validTokens.sort((a, b) => pulseTokenValue(a) - pulseTokenValue(b));

  // Update selection
  selectedPulses.clear();
  for (const token of validTokens) {
    selectedPulses.add(token);
  }

  // Update pulseSeq display with proper double-space gaps
  const newText = validTokens.length > 0 ? `  ${validTokens.join('  ')}  ` : '  ';
  pulseSeqEditEl.textContent = newText;

  // Sync timeline
  syncTimelineFromSelection();
}

/**
 * Normalize a token (e.g., "01" -> "1", "1.01" -> "1.1")
 */
function normalizeToken(token) {
  if (token.includes('.')) {
    const parts = token.split('.');
    return `${parseInt(parts[0], 10)}.${parseInt(parts[1], 10)}`;
  }
  return String(parseInt(token, 10));
}

/**
 * Sync pulseSeq text from current selection
 */
function syncPulseSeqFromSelection() {
  if (!pulseSeqEditEl) return;

  const tokens = Array.from(selectedPulses).sort((a, b) => pulseTokenValue(a) - pulseTokenValue(b));
  const newText = tokens.length > 0 ? `  ${tokens.join('  ')}  ` : '  ';
  pulseSeqEditEl.textContent = newText;
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
      // Integer pulse (including endpoints 0 and lg)
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
    }
  }
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

  // Disable transitions during render
  timeline.classList.add('no-anim');

  // Clear previous elements
  pulses = [];
  bars = [];
  cycleMarkers = [];
  cycleLabels = [];
  pulseNumberLabels = [];
  timeline.innerHTML = '';

  const lg = FIXED_LG;
  const numerator = currentNumerator;
  const denominator = currentDenominator;

  // Create pulses (0 to lg inclusive for endpoint)
  for (let i = 0; i <= lg; i++) {
    const pulse = document.createElement('div');
    pulse.className = 'pulse';
    pulse.dataset.index = i;
    if (i === 0 || i === lg) {
      pulse.classList.add('endpoint');
    } else if (!isIntegerSelectable(i)) {
      pulse.classList.add('non-selectable');
    }
    timeline.appendChild(pulse);
    pulses.push(pulse);

    // Create bars at endpoints
    if (i === 0 || i === lg) {
      const bar = document.createElement('div');
      bar.className = 'bar';
      timeline.appendChild(bar);
      bars.push(bar);
    }
  }

  // Create pulse numbers (0 to lg)
  for (let i = 0; i <= lg; i++) {
    const num = document.createElement('div');
    num.className = 'pulse-number';
    if (i === 0 || i === lg) num.classList.add('endpoint');
    num.dataset.index = i;
    num.textContent = i;
    timeline.appendChild(num);
    pulseNumberLabels.push(num);
  }

  // Calculate cycle markers using gridFromOrigin
  const grid = gridFromOrigin({ lg, numerator, denominator });
  const subdivisionFontRem = computeSubdivisionFontRem(lg);

  // Create cycle labels for selectable integers only (0, multiples of numerator, remainder, lg)
  // In App29, 0 and lg are always selectable as endpoints
  for (let i = 0; i <= lg; i++) {
    // Endpoints (0 and lg) always shown, others only if selectable
    const isEndpoint = i === 0 || i === lg;
    const isSelectable = isEndpoint || isIntegerSelectable(i);

    if (!isSelectable) continue; // Skip non-selectable integers

    const label = document.createElement('div');
    label.className = 'cycle-label cycle-label--integer';
    if (isEndpoint) label.classList.add('cycle-label--origin');
    label.dataset.cycleIndex = String(Math.floor(i / numerator));
    label.dataset.subdivision = '0';
    label.dataset.position = String(i);
    label.dataset.base = String(i);
    label.dataset.integerPulse = String(i);
    label.textContent = String(i);
    label.style.fontSize = `${subdivisionFontRem}rem`;
    timeline.appendChild(label);
    cycleLabels.push(label);
  }

  if (grid.cycles > 0 && grid.subdivisions.length) {
    grid.subdivisions.forEach(({ cycleIndex, subdivisionIndex, position }) => {
      // Skip integer positions (subdivisionIndex === 0), labels already created above
      if (subdivisionIndex === 0) return;

      const base = cycleIndex * numerator;
      // Subdivisions are selectable if base is 0 OR if base is selectable (multiple of numerator)
      const isSelectable = base === 0 || isIntegerSelectable(base);

      // Create subdivision marker
      const marker = document.createElement('div');
      marker.className = 'cycle-marker';
      if (!isSelectable) marker.classList.add('non-selectable');
      marker.dataset.cycleIndex = String(cycleIndex);
      marker.dataset.subdivision = String(subdivisionIndex);
      marker.dataset.position = String(position);
      marker.dataset.base = String(base);
      timeline.appendChild(marker);
      cycleMarkers.push(marker);

      // Create subdivision label (format: .n not base.n)
      const label = document.createElement('div');
      label.className = 'cycle-label';
      if (!isSelectable) label.classList.add('non-selectable');
      label.dataset.cycleIndex = String(cycleIndex);
      label.dataset.subdivision = String(subdivisionIndex);
      label.dataset.position = String(position);
      label.dataset.base = String(base);
      label.textContent = `.${subdivisionIndex}`;
      label.style.fontSize = `${subdivisionFontRem}rem`;
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
  // All integer pulses (including endpoints 0 and lg, skip non-selectable)
  pulses.forEach((pulse) => {
    if (pulse.classList.contains('non-selectable')) return; // Skip non-selectable

    pulse.addEventListener('click', () => {
      const idx = pulse.dataset.index;
      const token = idx;

      if (selectedPulses.has(token)) {
        selectedPulses.delete(token);
      } else {
        selectedPulses.add(token);
      }

      // Update both pulseSeq text AND timeline visual (including integer labels)
      syncPulseSeqFromSelection();
      syncTimelineFromSelection();
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
        const token = integerPulse;
        const pulse = pulses.find(p => p.dataset.index === integerPulse);

        if (selectedPulses.has(token)) {
          selectedPulses.delete(token);
          if (pulse) pulse.classList.remove('selected');
          label.classList.remove('selected');
        } else {
          selectedPulses.add(token);
          if (pulse) pulse.classList.add('selected');
          label.classList.add('selected');
        }
        syncPulseSeqFromSelection();
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
  if (selectedPulses.has(token)) {
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

  syncPulseSeqFromSelection();
}

function layoutTimeline() {
  const lg = FIXED_LG;

  // Position pulses linearly
  pulses.forEach((p, i) => {
    const pct = (i / lg) * 100;
    p.style.left = pct + '%';
    p.style.top = '50%';
    p.style.transform = 'translate(-50%, -50%)';
  });

  // Position bars at endpoints
  bars.forEach((bar, idx) => {
    const i = idx === 0 ? 0 : lg;
    const pct = (i / lg) * 100;
    bar.style.left = pct + '%';
    bar.style.top = '30%';
    bar.style.height = '40%';
    bar.style.transform = 'translateX(-50%)';
  });

  // Position pulse numbers (top: 0, transform: translate(-50%, 0%))
  pulseNumberLabels.forEach((num) => {
    const idx = parseInt(num.dataset.index, 10);
    const pct = (idx / lg) * 100;
    num.style.left = pct + '%';
    num.style.top = '0';
    num.style.transform = 'translate(-50%, 0%)';
  });

  // Position cycle markers
  cycleMarkers.forEach((marker) => {
    const pos = parseFloat(marker.dataset.position);
    const pct = (pos / lg) * 100;
    marker.style.left = pct + '%';
    marker.style.top = '50%';
  });

  // Position cycle labels (subdivisions)
  cycleLabels.forEach((label) => {
    const pos = parseFloat(label.dataset.position);
    const pct = (pos / lg) * 100;
    label.style.left = pct + '%';
    label.style.top = '75%';
  });
}

// ========== HIGHLIGHTING ==========
function clearHighlights() {
  pulses.forEach(p => p.classList.remove('active'));
  cycleMarkers.forEach(m => m.classList.remove('active'));
  cycleLabels.forEach(l => l.classList.remove('active'));
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

  // In loop mode, pulse 0 and endpoint (FIXED_LG) illuminate together
  if (pulseIndex === 0) {
    const endpoint = pulses[FIXED_LG];
    if (endpoint) {
      void endpoint.offsetWidth;
      endpoint.classList.add('active');
    }
  }
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
}

// ========== AUDIO CYCLE CONFIG ==========
function applyCycleConfig() {
  if (!audio) return;

  const hasCycle = currentNumerator > 0 && currentDenominator > 0 && Math.floor(FIXED_LG / currentNumerator) > 0;

  if (typeof audio.updateCycleConfig === 'function') {
    audio.updateCycleConfig({
      numerator: hasCycle ? currentNumerator : 0,
      denominator: hasCycle ? currentDenominator : 0,
      onTick: hasCycle ? highlightCycle : null
    });
  }
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
      // Integer pulse: idx → idx * d
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
  const bpm = FIXED_BPM;
  const n = currentNumerator;
  const d = currentDenominator;

  // Scale by denominator to include subdivisions
  // Interval must be divided by d so that integer pulses maintain correct tempo
  const baseResolution = d;
  const scaledTotal = lg * d; // Total steps (without endpoint, loop mode)
  const scaledInterval = (60 / bpm) / d; // Each step = 1/d of a beat

  const audioInstance = await initAudio();

  const hasCycle = n > 0 && d > 0 && Math.floor(lg / n) > 0;

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
  // 1. Random numerator (1-6) and denominator (2-8)
  const newN = randomInt(MIN_NUMERATOR, MAX_NUMERATOR);
  const newD = randomInt(2, MAX_DENOMINATOR);
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
  const lg = FIXED_LG;
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
  // Initialize fraction editor
  initFractionEditorController();

  // Initialize pulse sequence editor
  initPulseSeqEditor();

  // Render timeline
  renderTimeline();
}

// Run init when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
