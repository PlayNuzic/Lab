import { getMixer, subscribeMixer } from '../../libs/sound/index.js';
import { attachHover } from '../../libs/shared-ui/hover.js';
import { computeHitSizePx, solidMenuBackground, computeNumberFontRem } from './utils.js';
import { initRandomMenu, randomizeFractional } from '../../libs/random/index.js';
import { createSchedulingBridge, bindSharedSoundEvents } from '../../libs/app-common/audio.js';
import { createRhythmAudioInitializer, setupAudioDefaults, CHANNEL_TIERS } from '../../libs/app-common/audio-init.js';
import { fromLgAndTempo, toPlaybackPulseCount, gridFromOrigin, computeSubdivisionFontRem } from '../../libs/app-common/subdivision.js';
import { createLiveTransportPush } from '../../libs/app-common/transport-live-update.js';
import { initMixerMenu } from '../../libs/app-common/mixer-menu.js';
import { initAudioToggles } from '../../libs/app-common/audio-toggles.js';
import { createPreferenceStorage, registerFactoryReset, setupThemeSync, setupMutePersistence } from '../../libs/app-common/preferences.js';
import createFractionEditor, { createEmptyFractionInfo } from '../../libs/app-common/fraction-editor.js';
import { reorderControls } from '../../libs/app-common/template.js';
import { randomize as randomizeValues } from '../../libs/random/index.js';
import createPulseSeqController from '../../libs/pulse-seq/index.js';
import { createTimelineRenderer } from '../../libs/app-common/timeline-layout.js';
import { parseIntSafe, gcd, lcm } from '../../libs/app-common/number-utils.js';
import { bindAppRhythmElements } from '../../libs/app-common/dom.js';
import { createRhythmLEDManagers, syncLEDsWithInputs } from '../../libs/app-common/led-manager.js';
import { createPulseMemoryLoopController } from '../../libs/app-common/loop-control.js';
import { NOTATION_TOGGLE_BTN_ID } from '../../libs/app-common/template.js';
// P-02: imports síncrons només dels mòduls de notació lliures de VexFlow;
// el renderer (i VexFlow ~1,6MB) es carrega lazy al primer toggle del panell.
import { createNotationPanelController } from '../../libs/notation/panel.js';
import { durationValueFromDenominator, buildPulseEvents } from '../../libs/notation/utils.js';
import { resolveFractionNotation } from '../../libs/notation/fraction-notation.js';
import { nearestPulseIndex } from '../../libs/pulse-seq/index.js';
import { createHighlightController } from '../../libs/app-common/highlight-controller.js';
import { createVisualSyncManager } from '../../libs/app-common/visual-sync.js';
import { createFractionalTimelineRenderer } from '../../libs/app-common/timeline-renderer.js';
import { isIntegerPulseSelectable } from '../../libs/app-common/pulse-selectability.js';
import { loadNotation } from '../../libs/notation/lazy.js';
import { createFormulaRenderer } from '../../libs/app-common/formula-renderer.js';
import { createInfoTooltip } from '../../libs/app-common/info-tooltip.js';
import { createTIndicator } from '../../libs/app-common/t-indicator.js';
import { FRACTION_POSITION_EPSILON } from '../../libs/app-common/pulse-selectability.js';
import { addRepeatPress } from '../../libs/app-common/spinner-repeat.js';
import {
  fractionDefaults,
  randomDefaults,
  createFractionSelectionStore,
  createFractionSelectionFromValue,
  registerFractionLabel as registerFractionLabelInStore,
  fractionValue as computeFractionValue,
  fractionDisplay as formatFractionDisplay,
  extractFractionInfoFromElement,
  applyFractionSelectionClasses as applyFractionSelectionClassesModule,
  rebuildFractionSelections as rebuildFractionSelectionsModule,
  setFractionSelected as setFractionSelectedModule,
  loadRandomConfig,
  saveRandomConfig,
  applyRandomConfig as applyRandomConfigModule,
  updateRandomConfig as updateRandomConfigModule,
  applyRandomFractionSelection
} from './fraction-selection.js';
// Using local header controls for App2 (no shared init)

let audio;



const schedulingBridge = createSchedulingBridge({ getAudio: () => audio });
window.addEventListener('sharedui:scheduling', schedulingBridge.handleSchedulingEvent);
bindSharedSoundEvents({
  getAudio: () => audio,
  mapping: {
    baseSound: 'setBase',
    accentSound: 'setAccent',
    startSound: 'setStart',
    cycleSound: 'setCycle'
  }
});
// Bind all DOM elements using new utilities
// Bind all DOM elements using app-specific utilities (no warnings for missing elements)
const { elements, leds, ledHelpers } = bindAppRhythmElements('app4');

// Create LED managers for Lg, V, T parameters
const ledManagers = createRhythmLEDManagers(leds);

// State object for shared loop controller
const appState = {
  get loopEnabled() { return loopEnabled; },
  set loopEnabled(v) { loopEnabled = v; }
};

// Create shared loop controller with pulse memory integration
const loopController = createPulseMemoryLoopController({
  audio: () => audio, // H-03: getter lazy — l'engine neix al primer gest,
  loopBtn: elements.loopBtn,
  state: appState,
  ensurePulseMemory,
  getLg: () => parseInt(inputLg.value),
  isPlaying: () => isPlaying,
  onToggle: (enabled) => {
    // Rebuild visible selection from memory and refresh labels
    updatePulseNumbers();
    syncSelectedFromMemory();
    if (isPlaying) {
      applySelectionToAudio();
    }
    layoutTimeline();
    // Update totalPulses when loop changes during playback
    if (isPlaying) {
      handleInput();
    }
  }
});

// Extract commonly used elements for backward compatibility
const { inputLg, inputV, inputT, inputVUp, inputVDown, inputLgUp, inputLgDown,
        ledLg, ledV, ledT, unitLg, unitV, unitT, formula, timelineWrapper,
        timeline, playBtn, loopBtn, resetBtn, tapBtn, tapHelp,
        circularTimelineToggle, selectColor, randomBtn, randomMenu, randLgToggle, randLgMin,
        randLgMax, randVToggle, randVMin, randVMax, randPulsesToggle, randomCount,
        baseSoundSelect, accentSoundSelect,
        startSoundSelect, cycleSoundSelect, themeSelect, pulseToggleBtn,
        selectedToggleBtn, cycleToggleBtn, notationPanel, notationCloseBtn,
        notationContent } = elements;

// Ordre nuzic de la fila de controls (Play · Random · Reset; App4 no té
// bpmParam — V viu com a pill a .inputs). El helper només re-afegeix
// play/random/reset: el loop i el tap cal re-afegir-los a mà — el loop
// perquè el mode circular encara en depèn (fins F5), i el tap amb el
// tap-help perquè App4 conserva el tap tempo. Els overrides de
// visibilitat/estètica són a styles.css.
{
  const nuzicControls = reorderControls();
  if (nuzicControls && elements.loopBtn) nuzicControls.appendChild(elements.loopBtn);
  if (nuzicControls && elements.tapBtn) {
    nuzicControls.appendChild(elements.tapBtn);
    if (elements.tapHelp) nuzicControls.appendChild(elements.tapHelp);
  }
}

function applyFractionInfoBackground(panel) {
  if (!panel) return;
  const theme = document.body?.dataset?.theme === 'dark' ? 'dark' : 'light';
  const rootStyles = getComputedStyle(document.documentElement);
  const textVar = theme === 'dark' ? '--text-dark' : '--text-light';
  const fallbackText = rootStyles.getPropertyValue(textVar)?.trim() || (theme === 'dark' ? '#EEE8D8' : '#43433B');
  panel.style.backgroundColor = theme === 'dark' ? 'rgba(40, 40, 40, 0.92)' : 'rgba(255, 255, 255, 0.9)';
  panel.style.color = fallbackText;
  panel.style.borderColor = theme === 'dark' ? 'rgba(238, 232, 216, 0.2)' : 'rgba(0, 0, 0, 0.08)';
  panel.style.boxShadow = theme === 'dark'
    ? '0 18px 36px rgba(0, 0, 0, 0.6)'
    : '0 12px 28px rgba(0, 0, 0, 0.25)';
  panel.style.backdropFilter = 'blur(8px)';
}

let numeratorInput;
let denominatorInput;
let fractionEditorController = null;
let currentFractionInfo = createEmptyFractionInfo();
let pulses = [];
let pulseNumberLabels = [];
let cycleMarkers = [];
let cycleLabels = [];
let lastStructureSignature = {
  lg: null,
  numerator: null,
  denominator: null
};
// bars[] eliminado - ya no se usan barras legacy
let pulseHits = [];
let cycleMarkerHits = [];
const fractionStore = createFractionSelectionStore();
const fractionMemory = new Map();
let timelineRenderer = null; // Inicializado después de tener timeline DOM

const FRACTION_MARKER_LINEAR_TILT_RAD = Math.PI / 3;

const notationContentEl = notationContent || null;
let notationPanelController = null;
let notationRendererController = null;

function renderNotationIfVisible(opts) {
  const playing = typeof isPlaying === 'boolean' ? isPlaying : false;
  notationRendererController?.render({
    ...opts,
    isPlaying: playing
  });
}

function normalizeFractionMemoryPayload(info) {
  if (!info || !info.key) return null;
  const base = Number.isFinite(info.base) ? info.base : null;
  const numerator = Number.isFinite(info.numerator) ? info.numerator : null;
  const denominator = Number.isFinite(info.denominator) ? info.denominator : null;
  const cycleIndex = Number.isFinite(info.cycleIndex) ? info.cycleIndex : null;
  const subdivisionIndex = Number.isFinite(info.subdivisionIndex) ? info.subdivisionIndex : null;
  const pulsesPerCycle = Number.isFinite(info.pulsesPerCycle) && info.pulsesPerCycle > 0
    ? info.pulsesPerCycle
    : null;
  let value = Number.isFinite(info.value) ? info.value : null;
  if (!Number.isFinite(value)
    && Number.isFinite(base)
    && Number.isFinite(numerator)
    && Number.isFinite(denominator)
    && denominator > 0) {
    value = fractionValue(base, numerator, denominator);
  }
  const displayInput = typeof info.display === 'string' ? info.display : '';
  const display = displayInput || (Number.isFinite(base)
    && Number.isFinite(numerator)
    && Number.isFinite(denominator)
    && denominator > 0
    ? fractionDisplay(base, numerator, denominator, {
      cycleIndex,
      subdivisionIndex,
      pulsesPerCycle
    })
    : '');
  const rawLabel = typeof info.rawLabel === 'string' ? info.rawLabel : '';
  return {
    key: info.key,
    base,
    numerator,
    denominator,
    value,
    display,
    rawLabel,
    cycleIndex,
    subdivisionIndex,
    pulsesPerCycle
  };
}

function rememberFractionSelectionInMemory(info, { suspended = false } = {}) {
  const payload = normalizeFractionMemoryPayload(info);
  if (!payload) return;
  const existing = fractionMemory.get(payload.key) || {};
  const entry = {
    key: payload.key,
    base: Number.isFinite(payload.base) ? payload.base : existing.base,
    numerator: Number.isFinite(payload.numerator) ? payload.numerator : existing.numerator,
    denominator: Number.isFinite(payload.denominator) ? payload.denominator : existing.denominator,
    value: Number.isFinite(payload.value) ? payload.value : existing.value,
    display: payload.display || existing.display || '',
    rawLabel: payload.rawLabel || existing.rawLabel || '',
    cycleIndex: Number.isFinite(payload.cycleIndex) ? payload.cycleIndex : existing.cycleIndex,
    subdivisionIndex: Number.isFinite(payload.subdivisionIndex) ? payload.subdivisionIndex : existing.subdivisionIndex,
    pulsesPerCycle: Number.isFinite(payload.pulsesPerCycle) ? payload.pulsesPerCycle : existing.pulsesPerCycle,
    suspended: suspended === true
  };
  fractionMemory.set(payload.key, entry);
}

function markFractionSuspended(info) {
  const payload = normalizeFractionMemoryPayload(info);
  if (!payload) return;
  const existing = fractionMemory.get(payload.key) || {};
  const entry = {
    key: payload.key,
    base: Number.isFinite(payload.base) ? payload.base : existing.base,
    numerator: Number.isFinite(payload.numerator) ? payload.numerator : existing.numerator,
    denominator: Number.isFinite(payload.denominator) ? payload.denominator : existing.denominator,
    value: Number.isFinite(payload.value) ? payload.value : existing.value,
    display: payload.display || existing.display || '',
    rawLabel: payload.rawLabel || existing.rawLabel || '',
    cycleIndex: Number.isFinite(payload.cycleIndex) ? payload.cycleIndex : existing.cycleIndex,
    subdivisionIndex: Number.isFinite(payload.subdivisionIndex) ? payload.subdivisionIndex : existing.subdivisionIndex,
    pulsesPerCycle: Number.isFinite(payload.pulsesPerCycle) ? payload.pulsesPerCycle : existing.pulsesPerCycle,
    suspended: true
  };
  fractionMemory.set(payload.key, entry);
}

function syncFractionMemoryWithSelections() {
  const activeKeys = new Set();
  if (Array.isArray(fractionStore.pulseSelections)) {
    fractionStore.pulseSelections.forEach((item) => {
      if (!item || !item.key) return;
      activeKeys.add(item.key);
      rememberFractionSelectionInMemory(item, { suspended: false });
    });
  }
  fractionMemory.forEach((entry, key) => {
    if (!activeKeys.has(key) && !(entry && entry.suspended)) {
      fractionMemory.delete(key);
    }
  });
}
let currentAudioResolution = 1;
const raf = (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function')
  ? (cb) => window.requestAnimationFrame(cb)
  : (cb) => setTimeout(cb, 16);

// F2: l'editor numèric de pulsos s'ha eliminat. El controlador de pulse-seq
// NO es munta: només se n'aprofita la memòria persistent de pulsos, que és
// independent del mount. (Sense drag: en aquesta app els pulsos només es
// seleccionen amb clic, no s'arrosseguen.)
const pulseSeqController = createPulseSeqController();
const pulseMemoryApi = pulseSeqController.memory;
const pulseMemory = pulseMemoryApi.data;

// T indicator setup (App4-specific functionality)
// T Indicator setup
const tIndicatorController = inputT ? createTIndicator() : null;
if (tIndicatorController) {
  tIndicatorController.element.id = 'tIndicator';
  tIndicatorController.hide(); // Start hidden
  timeline.appendChild(tIndicatorController.element);
}
// App4-specific additional elements
const randComplexToggle = document.getElementById('randComplexToggle');
const randNToggle = document.getElementById('randNToggle');
const randNMin = document.getElementById('randNMin');
const randNMax = document.getElementById('randNMax');
const randDToggle = document.getElementById('randDToggle');
const randDMin = document.getElementById('randDMin');
const randDMax = document.getElementById('randDMax');
const titleHeading = document.querySelector('header.top-bar h1');
const titleTextNode = titleHeading?.querySelector('.top-bar-title-text');
let titleButton = null;
if (titleHeading && titleTextNode) {
  titleButton = document.createElement('button');
  titleButton.type = 'button';
  titleButton.id = 'appTitleBtn';
  titleButton.className = 'top-bar-title-button';
  titleButton.textContent = titleTextNode.textContent?.trim() || '';
  titleHeading.replaceChild(titleButton, titleTextNode);
  attachHover(titleButton, { text: 'Click para ver información detallada' });
} else if (titleHeading) {
  titleButton = document.createElement('button');
  titleButton.type = 'button';
  titleButton.id = 'appTitleBtn';
  titleButton.className = 'top-bar-title-button';
  titleButton.textContent = titleHeading.textContent || '';
  titleHeading.textContent = '';
  titleHeading.appendChild(titleButton);
  attachHover(titleButton, { text: 'Click para ver información detallada' });
}
const notationToggleBtn = document.getElementById(NOTATION_TOGGLE_BTN_ID);

// P-02: el renderer — i tot VexFlow (~1,6MB) — es carrega lazy la primera
// vegada que s'obre el panell. Fins llavors renderNotationIfVisible és un
// no-op (optional chaining), igual que abans de crear el controller.
let notationLoadRequested = false;
function ensureNotationRenderer() {
  if (notationLoadRequested || !notationContentEl) return;
  notationLoadRequested = true;
  loadNotation().then((mod) => {
    notationRendererController = mod.createNotationRenderer({
      notationContentEl,
      notationPanelController,
      getFraction,
      getLg: () => parseInt(inputLg.value, 10),
      fractionStore,
      pulseMemoryApi,
      createFractionSelectionFromValue,
      onPulseSelected: setPulseSelected,
      onFractionSelected: setFractionSelected
    });
    renderNotationIfVisible({ force: true });
  }).catch((err) => {
    notationLoadRequested = false; // reintentable al següent toggle
    console.warn('Notación no disponible:', err);
  });
}

notationPanelController = createNotationPanelController({
  toggleButton: notationToggleBtn,
  panel: notationPanel,
  closeButton: notationCloseBtn,
  appId: 'app4',
  onOpen: () => {
    ensureNotationRenderer();
    renderNotationIfVisible({ force: true });
  }
});

// Canals registrats al motor (TimelineAudio constructor);
// setupAudioDefaults dins initAudio() els personalitza via RHYTHM_FULL.
const globalMixer = getMixer();

const FRACTION_NUMERATOR_KEY = 'n';
const FRACTION_DENOMINATOR_KEY = 'd';

const preferenceStorage = createPreferenceStorage({ prefix: 'app4', separator: ':' });
const { storeKey, save: saveOpt, load: loadOpt, clear: clearOpt } = preferenceStorage;
const muteButton = document.getElementById('muteBtn');

registerFactoryReset({ storage: preferenceStorage });
setupThemeSync({ storage: preferenceStorage, selectEl: themeSelect });
setupMutePersistence({
  storage: preferenceStorage,
  getAudioInstance: () => audio,
  muteButton
});

const randomControls = {
  randLgToggle,
  randLgMin,
  randLgMax,
  randVToggle,
  randVMin,
  randVMax,
  randNToggle,
  randNMin,
  randNMax,
  randDToggle,
  randDMin,
  randDMax,
  randComplexToggle,
  randPulsesToggle,
  randomCount
};

const randomConfig = {
  ...randomDefaults,
  ...loadRandomConfig(() => loadOpt(RANDOM_STORE_KEY))
};

function persistRandomConfig() {
  saveRandomConfig((value) => saveOpt(RANDOM_STORE_KEY, value), randomConfig);
}

function applyRandomConfig() {
  applyRandomConfigModule(randomConfig, randomControls);
}

function updateRandomConfig() {
  updateRandomConfigModule(randomConfig, randomControls);
  persistRandomConfig();
}

applyRandomConfig();

[
  randLgToggle, randLgMin, randLgMax,
  randVToggle, randVMin, randVMax,
  randNToggle, randNMin, randNMax,
  randDToggle, randDMin, randDMax,
  randComplexToggle,
  randPulsesToggle, randomCount
].forEach(el => el?.addEventListener('change', updateRandomConfig));

function getFraction() {
  if (!fractionEditorController) {
    return { numerator: null, denominator: null };
  }
  return fractionEditorController.getFraction();
}

function refreshFractionUI(options = {}) {
  if (!fractionEditorController) {
    currentFractionInfo = createEmptyFractionInfo();
    return currentFractionInfo;
  }
  currentFractionInfo = fractionEditorController.refresh(options);
  return currentFractionInfo;
}

function initFractionEditorController() {
  // F2: l'editor de fraccions passa a mode block i s'allotja directament a
  // `.middle` (patró App26/App28), que arriba buit del template gràcies a
  // `noMiddleSlot: true` després de retirar l'editor numèric de pulsos.
  const host = document.querySelector('.middle');
  if (!host) return;

  if (fractionEditorController && typeof fractionEditorController.destroy === 'function') {
    fractionEditorController.destroy();
  }
  fractionEditorController = null;

  const controller = createFractionEditor({
    mode: 'block',
    host,
    defaults: fractionDefaults,
    startEmpty: true,
    storage: {
      load: loadOpt,
      save: saveOpt,
      clear: clearOpt,
      numeratorKey: FRACTION_NUMERATOR_KEY,
      denominatorKey: FRACTION_DENOMINATOR_KEY
    },
    addRepeatPress,
    applyMenuBackground: applyFractionInfoBackground,
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
    onChange: ({ info, cause }) => {
      currentFractionInfo = info || createEmptyFractionInfo();
      if (cause !== 'init') {
        // Abans el canvi de fracció passava per sanitizePulseSeq (que podava
        // els pulsos no seleccionables i re-renderitzava la línia de temps);
        // sense l'editor numèric, la poda i el re-render es fan directament.
        prunePulseMemoryForFraction();
        renderTimeline();
      }
      if (!isUpdating && cause !== 'init') {
        handleInput();
      }
    }
  });

  fractionEditorController = controller;
  if (controller && controller.elements) {
    const { numerator, denominator } = controller.elements;
    numeratorInput = numerator;
    denominatorInput = denominator;
  }
  refreshFractionUI({ reveal: false });
}

// En canviar la fracció, treu de la memòria els pulsos enters que ja no són
// seleccionables (mateixa semàntica que la revalidació de l'antic
// sanitizePulseSeq: només dins de Lg; la memòria més enllà es conserva).
function prunePulseMemoryForFraction() {
  const lg = parseIntSafe(inputLg.value);
  if (!Number.isFinite(lg) || lg <= 0) return;
  const { numerator, denominator } = getFraction();
  const limit = Math.min(pulseMemory.length, lg);
  for (let i = 1; i < limit; i++) {
    if (pulseMemory[i] && !isIntegerPulseSelectable(i, numerator, denominator, lg)) {
      pulseMemory[i] = false;
    }
  }
}

// nearestPulseIndex ahora se importa desde libs/pulse-seq/parser.js

// isIntegerPulseSelectable ahora se importa desde libs/app-common/pulse-selectability.js
// La nueva versión incluye soporte para pulsos sobrantes (remainder) cuando Lg % numerator !== 0

const voiceHighlightHandlers = new Map();

function ensurePulseMemory(size) {
  pulseMemoryApi.ensure(size);
}

// Clear all persistent pulse selection (memory beyond current Lg too)
function clearPersistentPulses(){
  pulseMemoryApi.clear();
  fractionMemory.clear();
  try { selectedPulses.clear(); } catch {}
  /* Keep UI consistent; will be rebuilt by subsequent calls */
  fractionStore.selectionState.clear();
  fractionStore.selectedFractionKeys.clear();
  fractionStore.pulseSelections = [];
  applyFractionSelectionClasses();
  renderNotationIfVisible();
}
// UI thresholds for number rendering
const PULSE_NUMBER_HIDE_THRESHOLD = 71;
const SUBDIVISION_HIDE_THRESHOLD = 41;
const NUMBER_CIRCLE_OFFSET  = 34;    // px distance from circle to number label
const MIN_SUBDIVISION_LABEL_SPACING_PX = 40;

function registerFractionLabel(label, info) {
  registerFractionLabelInStore(fractionStore, label, info);
}

function fractionValue(base, numerator, denominator) {
  return computeFractionValue(base, numerator, denominator);
}

function fractionDisplay(base, numerator, denominator, override = {}) {
  return formatFractionDisplay(base, numerator, denominator, override);
}

function getFractionInfoFromElement(el) {
  return extractFractionInfoFromElement(el, parseIntSafe);
}

function applyFractionSelectionClasses() {
  applyFractionSelectionClassesModule(fractionStore, cycleMarkers, cycleLabels);
}

function rebuildFractionSelections(opts = {}) {
  const selections = rebuildFractionSelectionsModule(fractionStore, {
    cycleMarkers,
    cycleLabels,
    skipUpdateField: opts.skipUpdateField
  });
  fractionStore.pulseSelections = selections;
  syncFractionMemoryWithSelections();
  renderNotationIfVisible();
  return selections;
}

function setFractionSelected(info, shouldSelect) {
  setFractionSelectedModule(fractionStore, info, shouldSelect, {
    cycleMarkers,
    cycleLabels
  });
  if (isPlaying && audio) {
    applySelectionToAudio();
  }
  renderNotationIfVisible();
}

function computeAudioSchedulingState() {
  const lg = parseInt(inputLg.value);
  const v = parseFloat(inputV.value);
  const { numerator, denominator } = getFraction();

  const validLg = Number.isFinite(lg) && lg > 0;
  const validV = Number.isFinite(v) && v > 0;

  const grid = gridFromOrigin({ lg: validLg ? lg : 0, numerator, denominator });
  const denominators = new Set([1]);
  fractionStore.pulseSelections.forEach((item) => {
    if (!item) return;
    const den = Number(item.denominator);
    if (Number.isFinite(den) && den > 0) {
      denominators.add(Math.round(den));
    }
  });

  const hasCycle = Boolean(
    validLg
    && Number.isFinite(numerator)
    && Number.isFinite(denominator)
    && numerator > 0
    && denominator > 0
    && Math.floor(lg / numerator) > 0
  );

  if (hasCycle) {
    denominators.add(Math.round(denominator));
  }

  let resolution = 1;
  denominators.forEach((den) => {
    resolution = Math.max(1, Math.round(lcm(resolution, Math.max(1, den))));
  });

  const playbackTotal = validLg ? toPlaybackPulseCount(lg, loopEnabled) : null;
  const totalPulses = playbackTotal != null ? playbackTotal : null;
  const interval = validV ? (60 / v) : null;
  const patternBeats = validLg ? lg : null;

  const cycleNumerator = hasCycle ? numerator : null;
  const cycleDenominator = hasCycle ? denominator : null;
  const cycleConfig = hasCycle
    ? { numerator: cycleNumerator, denominator: cycleDenominator, onTick: highlightCycle }
    : null;

  const voices = [];

  return {
    resolution,
    totalPulses,
    interval,
    patternBeats,
    cycleConfig,
    voices,
    validLg,
    validV,
    grid,
    lg
  };
}

// --- Selecció viva per a l'àudio (filtrada: sense 0 ni lg) ---
function selectedForAudioFromState({ scheduling } = {}) {
  const state = scheduling || computeAudioSchedulingState();
  const scale = Number.isFinite(state?.resolution) && state.resolution > 0
    ? Math.max(1, Math.round(state.resolution))
    : 1;
  const lg = Number.isFinite(state?.lg) ? state.lg : parseInt(inputLg.value);
  const baseSet = new Set();
  const cycleSet = new Set();
  const fractionSet = new Set();
  const combinedSet = new Set();
  const audioSet = new Set();
  if (!Number.isFinite(lg) || lg <= 0) {
    return {
      base: baseSet,
      cycle: cycleSet,
      fraction: fractionSet,
      combined: combinedSet,
      resolution: scale,
      audio: audioSet
    };
  }
  const maxIdx = Math.min(lg, pulseMemory.length - 1);
  for (let i = 1; i <= maxIdx; i++) {
    if (pulseMemory[i]) {
      baseSet.add(i);
      const scaled = i * scale;
      combinedSet.add(scaled);
      audioSet.add(scaled);
    }
  }
  const epsilon = 1e-6;
  if (state?.grid?.subdivisions?.length) {
    state.grid.subdivisions.forEach((subdivision) => {
      const pos = Number(subdivision?.position);
      if (!Number.isFinite(pos) || pos <= 0 || pos >= lg) return;
      cycleSet.add(pos);
      const scaled = Math.round(pos * scale);
      if (Math.abs(scaled / scale - pos) <= epsilon) {
        combinedSet.add(scaled);
      }
    });
  }
  fractionStore.pulseSelections.forEach((item) => {
    if (!item || !Number.isFinite(item.value)) return;
    if (item.value <= 0 || item.value >= lg) return;
    fractionSet.add(item.value);
    const scaled = Math.round(item.value * scale);
    if (Math.abs(scaled / scale - item.value) <= epsilon) {
      combinedSet.add(scaled);
      audioSet.add(scaled);
    }
  });
  return {
    base: baseSet,
    cycle: cycleSet,
    fraction: fractionSet,
    combined: combinedSet,
    resolution: scale,
    audio: audioSet
  };
}

function applySelectionToAudio({ scheduling, instance } = {}) {
  const target = instance || audio;
  if (!target || typeof target.setSelected !== 'function') return null;
  const selection = selectedForAudioFromState({ scheduling });
  const audioValues = selection.audio ?? selection.combined;
  const resolvedSelectionResolution = Number.isFinite(selection?.resolution)
    ? Math.max(1, Math.round(selection.resolution))
    : 1;
  // Enviamos pasos escalados directamente (resolución 1) para que TimelineAudio
  // compare índices absolutos sin aplicar un segundo factor de escala.
  target.setSelected({ values: audioValues, resolution: 1 });
  const schedulingResolution = Number.isFinite(scheduling?.resolution)
    ? Math.max(1, Math.round(scheduling.resolution))
    : resolvedSelectionResolution;
  currentAudioResolution = Math.max(resolvedSelectionResolution, schedulingResolution);
  return selection;
}

function updateVoiceHandlers({ scheduling } = {}) {
  voiceHighlightHandlers.clear();
  if (!scheduling || !Array.isArray(scheduling.voices)) return;
  const voices = scheduling.voices;
  const grid = scheduling.grid;
  const cycles = Number.isFinite(grid?.cycles) ? grid.cycles : null;
  voices.forEach((voice) => {
    if (!voice || !voice.id) return;
    const numerator = Number(voice.numerator);
    const denominator = Number(voice.denominator);
    if (!(Number.isFinite(numerator) && numerator > 0 && Number.isFinite(denominator) && denominator > 0)) {
      return;
    }
    if (voice.id.startsWith('cycle-') && Number.isFinite(cycles) && cycles > 0) {
      const handler = createCycleVoiceHandler({ numerator, denominator, cycles });
      if (handler) voiceHighlightHandlers.set(voice.id, handler);
    }
  });
}

function createCycleVoiceHandler({ numerator, denominator, cycles }) {
  const totalCycles = Math.max(1, Math.floor(cycles));
  const epsilon = 1e-6;
  return ({ index } = {}) => {
    if (!isPlaying) return;
    const rawIndex = Number(index);
    if (!Number.isFinite(rawIndex) || rawIndex < 0) return;
    const perCycle = Math.max(1, Math.floor(denominator));
    const cycleIndex = totalCycles > 0
      ? Math.floor(Math.floor(rawIndex / perCycle) % totalCycles)
      : Math.floor(rawIndex / perCycle);
    const subdivisionIndex = ((rawIndex % perCycle) + perCycle) % perCycle;
    const fractionalStep = numerator * cycleIndex + (numerator / perCycle) * subdivisionIndex;
    if (Math.abs(fractionalStep - Math.round(fractionalStep)) <= epsilon) {
      return;
    }
    highlightCycle({
      cycleIndex,
      subdivisionIndex,
      numerator,
      denominator: perCycle,
      totalCycles,
      totalSubdivisions: perCycle
    });
  };
}

function handleVoiceEvent(event = {}) {
  if (!event || !event.id) return;
  const handler = voiceHighlightHandlers.get(event.id);
  if (typeof handler === 'function') {
    handler(event);
  }
}
const selectedPulses = new Set();
let isPlaying = false;
// P-03: últim Lg renderitzat des de handleInput
let lastTimelineRenderLg = null;
let loopEnabled = false;
let isUpdating = false;     // evita bucles de 'input' reentrants
let circularTimeline = false;
let visualSyncHandle = null;

// Controladores de highlighting y visual sync (inicializados después de renderTimeline)
let highlightController = null;
let visualSyncManager = null;

// Progress is now driven directly from audio callbacks

initFractionEditorController();

// Initialize complex fractions state from localStorage
function initComplexFractionsState() {
  const stored = localStorage.getItem('enableComplexFractions');
  const enabled = stored === null ? true : stored === 'true'; // Default: true

  if (fractionEditorController) {
    if (enabled) {
      fractionEditorController.setComplexMode();
    } else {
      fractionEditorController.setSimpleMode();
    }
  }

  updateRandomMenuComplexState(enabled);
}

function updateRandomMenuComplexState(enabled) {
  const randNToggle = document.getElementById('randNToggle');
  const randNMin = document.getElementById('randNMin');
  const randNMax = document.getElementById('randNMax');

  if (!randNToggle) return;

  if (enabled) {
    // Habilitar controles de numerador
    randNToggle.disabled = false;
    randNToggle.style.opacity = '1';
    randNToggle.title = '';
    if (randNMin) randNMin.disabled = false;
    if (randNMax) randNMax.disabled = false;
  } else {
    // Deshabilitar controles de numerador
    randNToggle.disabled = true;
    randNToggle.checked = false;
    randNToggle.style.opacity = '0.5';
    randNToggle.title = 'Activar fracciones complejas en Opciones para habilitar';
    if (randNMin) randNMin.disabled = true;
    if (randNMax) randNMax.disabled = true;
  }
}

// Escuchar cambios de "Activar fracciones complejas"
window.addEventListener('sharedui:complexfractions', (e) => {
  const enabled = e.detail.value;

  // Aplicar a fraction editor
  if (fractionEditorController) {
    if (enabled) {
      fractionEditorController.setComplexMode();
    } else {
      fractionEditorController.setSimpleMode();
    }
  }

  // Actualizar estado del toggle de numerador en random menu
  updateRandomMenuComplexState(enabled);

  // Re-renderizar timeline si es necesario
  renderTimeline();
});

const { updatePulseNumbers, layoutTimeline } = createTimelineRenderer({
  timeline,
  timelineWrapper,
  getLg: () => (pulses.length > 0 ? pulses.length - 1 : 0),
  getPulses: () => pulses,
  // getBars eliminado - ya no se usan barras legacy
  getCycleMarkers: () => cycleMarkers,
  getCycleLabels: () => cycleLabels,
  getPulseNumberLabels: () => pulseNumberLabels,
  setPulseNumberLabels: (labels) => { pulseNumberLabels = labels; },
  computeNumberFontRem,
  pulseNumberHideThreshold: PULSE_NUMBER_HIDE_THRESHOLD,
  numberCircleOffset: NUMBER_CIRCLE_OFFSET,
  isCircularEnabled: () => circularTimeline && loopEnabled,
  requestAnimationFrame: raf,
  callbacks: {
    onAfterCircularLayout: (context) => {
      const { centerX, centerY, radius, angleForIndex, angleForPosition, cycleMarkers: markerList } = context;

      pulseHits.forEach((hit, idx) => {
        if (!hit) return;
        const angle = angleForIndex(idx);
        const hx = centerX + radius * Math.cos(angle);
        const hy = centerY + radius * Math.sin(angle);
        hit.style.left = `${hx}px`;
        hit.style.top = `${hy}px`;
        hit.style.transform = 'translate(-50%, -50%)';
      });

      markerList.forEach((marker) => {
        if (!marker) return;
        const key = marker.dataset && marker.dataset.fractionKey;
        if (!key || !fractionStore.hitMap.has(key)) return;
        const pos = Number(marker.dataset.position);
        if (!Number.isFinite(pos)) return;
        const angle = angleForPosition(pos);
        const mx = centerX + radius * Math.cos(angle);
        const my = centerY + radius * Math.sin(angle);
        const hit = fractionStore.hitMap.get(key);
        if (hit) {
          hit.style.left = `${mx}px`;
          hit.style.top = `${my}px`;
          hit.style.transformOrigin = '50% 50%';
          const transform = `translate(-50%, -50%) rotate(${angle + Math.PI / 2}rad)`;
          hit.style.transform = transform;
          hit.style.setProperty('--pulse-flash-base-transform', transform);
        }
      });

      restoreCycleLabelDisplay();
    },
    onAfterLinearLayout: (context) => {
      const { percentForIndex, percentForPosition, cycleMarkers: markerList, lg } = context;

      pulseHits.forEach((hit, idx) => {
        if (!hit) return;
        const percent = percentForIndex(idx);
        hit.style.left = `${percent}%`;
        hit.style.top = '50%';
        hit.style.transform = 'translate(-50%, -50%)';
      });

      markerList.forEach((marker) => {
        if (!marker) return;
        const key = marker.dataset && marker.dataset.fractionKey;
        if (!key || !fractionStore.hitMap.has(key)) return;
        const pos = Number(marker.dataset.position);
        if (!Number.isFinite(pos)) return;
        const percent = percentForPosition(pos);

        marker.style.left = `${percent}%`;
        marker.style.top = '50%';
        marker.style.transformOrigin = '50% 50%';
        // En vista lineal no aplicar rotación - mantener marcadores verticales
        const baseTransform = 'translate(-50%, -50%)';
        marker.style.transform = baseTransform;
        marker.style.setProperty('--pulse-flash-base-transform', baseTransform);

        const hit = fractionStore.hitMap.get(key);
        if (hit) {
          hit.style.left = `${percent}%`;
          hit.style.top = '50%';
          hit.style.transformOrigin = '50% 50%';
          hit.style.transform = baseTransform;
          hit.style.setProperty('--pulse-flash-base-transform', baseTransform);
        }
      });

      applyCycleLabelCompaction({ lg });
    }
  }
});

// Inicializar estado de fracciones complejas después de que todos los componentes estén listos
initComplexFractionsState();

function getSelectionInfo(target) {
  if (!target) return null;
  if (typeof target.dataset.index !== 'undefined') {
    const idx = parseIntSafe(target.dataset.index);
    if (Number.isFinite(idx)) {
      // Validar que el pulso es seleccionable según la fracción activa
      const lg = parseIntSafe(inputLg.value);
      const { numerator, denominator } = getFraction();
      if (!isIntegerPulseSelectable(idx, numerator, denominator, lg)) {
        return null; // Bloquear pulsos no seleccionables
      }
      const key = `pulse:${idx}`;
      return { type: 'int', index: idx, selectionKey: key, key };
    }
  }
  if (target.dataset.fractionKey) {
    const info = getFractionInfoFromElement(target);
    if (info) {
      const selectionKey = `fraction:${info.key}`;
      return { ...info, selectionKey };
    }
  }
  return null;
}

function isSelectionActive(info) {
  if (!info) return false;
  if (info.type === 'fraction') {
    return fractionStore.selectionState.has(info.key);
  }
  if (info.type === 'int') {
    const lg = parseIntSafe(inputLg.value);
    if (!Number.isFinite(lg)) return false;
    if (info.index === 0 || info.index === lg) {
      return loopEnabled;
    }
    ensurePulseMemory(Math.max(info.index, lg));
    return !!pulseMemory[info.index];
  }
  return false;
}

function applySelectionInfo(info, shouldSelect) {
  if (!info) return;
  if (info.type === 'fraction') {
    setFractionSelected(info, shouldSelect);
  } else if (info.type === 'int') {
    setPulseSelected(info.index, shouldSelect);
  }
}

function toggleSelectionInfo(info) {
  if (!info) return;
  const active = isSelectionActive(info);
  applySelectionInfo(info, !active);
}

function attachSelectionListeners(el) {
  if (!el) return;
  el.addEventListener('click', (ev) => {
    const info = getSelectionInfo(ev.currentTarget);
    if (!info) return;
    toggleSelectionInfo(info);
  });
}
// Hovers for LEDs and controls
// LEDs ahora indican los campos editables; el apagado se recalcula
attachHover(playBtn, { text: 'Play / Stop' });
attachHover(loopBtn, { text: 'Loop' });
attachHover(tapBtn, { text: 'Tap Tempo' });
attachHover(resetBtn, { text: 'Reset App' });
attachHover(notationToggleBtn, { text: 'Mostrar/ocultar partitura' });
attachHover(randomBtn, { text: 'Aleatorizar parámetros' });
attachHover(randLgToggle, { text: 'Aleatorizar Lg' });
attachHover(randLgMin, { text: 'Mínimo Lg' });
attachHover(randLgMax, { text: 'Máximo Lg' });
attachHover(randVToggle, { text: 'Aleatorizar V' });
attachHover(randVMin, { text: 'Mínimo V' });
attachHover(randVMax, { text: 'Máximo V' });
attachHover(randPulsesToggle, { text: 'Aleatorizar pulsos' });
attachHover(randomCount, { text: 'Cantidad de pulsos a seleccionar (vacío = aleatorio, 0 = ninguno)' });
attachHover(randNToggle, { text: 'Aleatorizar numerador' });
attachHover(randNMin, { text: 'Mínimo numerador' });
attachHover(randNMax, { text: 'Máximo numerador' });
attachHover(randDToggle, { text: 'Aleatorizar denominador' });
attachHover(randDMin, { text: 'Mínimo denominador' });
attachHover(randDMax, { text: 'Máximo denominador' });
attachHover(randComplexToggle, { text: 'Permitir fracciones complejas' });
if (pulseToggleBtn) attachHover(pulseToggleBtn, { text: 'Activar o silenciar el pulso' });
if (selectedToggleBtn) attachHover(selectedToggleBtn, { text: 'Activar o silenciar la selección' });
if (cycleToggleBtn) attachHover(cycleToggleBtn, { text: 'Activar o silenciar la subdivisión' });


const PULSE_AUDIO_KEY = 'pulseAudio';
const SELECTED_AUDIO_KEY = 'selectedAudio';
const CYCLE_AUDIO_KEY = 'cycleAudio';

let pulseToggleController = null;
let selectedToggleController = null;
let cycleToggleController = null;

const soloMutedChannels = new Set();
let lastSoloActive = false;

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
  onMixerSnapshot: ({ snapshot, channels, setFromMixer, getState }) => {
    if (!snapshot || !Array.isArray(snapshot.channels)) return;
    const soloActive = snapshot.channels.some((channel) => channel.solo);
    const channelPairs = [
      ['pulse', 'pulse'],
      ['accent', 'accent'],
      ['cycle', 'subdivision']
    ];
    const toggleByChannel = new Map(channelPairs.map(([toggleId, channelId]) => [channelId, toggleId]));

    channelPairs.forEach(([toggleId, channelId]) => {
      const channelState = channels.get(channelId);
      if (!channelState) return;
      const forcedBySolo = soloActive && !channelState.solo && channelState.effectiveMuted && !channelState.muted;
      if (forcedBySolo) {
        if (!soloMutedChannels.has(channelId)) {
          soloMutedChannels.add(channelId);
          setFromMixer(toggleId, false);
        }
        return;
      }

      if (!soloActive && soloMutedChannels.has(channelId)) {
        soloMutedChannels.delete(channelId);
        setFromMixer(toggleId, true);
        return;
      }

      if (soloActive && soloMutedChannels.has(channelId)) {
        return;
      }

      const shouldEnable = !channelState.muted;
      if (getState(toggleId) === shouldEnable) return;
      setFromMixer(toggleId, shouldEnable);
    });

    if (!soloActive && lastSoloActive && soloMutedChannels.size) {
      soloMutedChannels.forEach((channelId) => {
        const toggleId = toggleByChannel.get(channelId);
        if (toggleId) setFromMixer(toggleId, true);
      });
      soloMutedChannels.clear();
    }

    lastSoloActive = soloActive;
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

const storedColor = loadOpt('color');
if (storedColor) {
  selectColor.value = storedColor;
  document.documentElement.style.setProperty('--selection-color', storedColor);
}
selectColor.addEventListener('input', e => {
  document.documentElement.style.setProperty('--selection-color', e.target.value);
  saveOpt('color', e.target.value);
});

updatePulseNumbers();

circularTimelineToggle.checked = (() => {
  const stored = loadOpt('circular');
  return stored == null ? true : stored === '1';
})();
circularTimeline = circularTimelineToggle.checked;
// T Indicator initialization
if (tIndicatorController) {
  const tValue = parseNum(inputT?.value ?? '') || '';
  tIndicatorController.updateText(tValue);
  if (tValue) {
    tIndicatorController.show();
  }
}

circularTimelineToggle?.addEventListener('change', e => {
  circularTimeline = e.target.checked;
  saveOpt('circular', e.target.checked ? '1' : '0');
  layoutTimeline();
});
layoutTimeline();

// Initialize loop controller with shared component
loopController.attach();

if (resetBtn) {
  resetBtn.addEventListener('click', () => {
    pulseMemoryApi.clear();
    clearOpt(FRACTION_NUMERATOR_KEY);
    clearOpt(FRACTION_DENOMINATOR_KEY);
    sessionStorage.setItem('volumeResetFlag', 'true');
    window.location.reload();
  });
}

async function handleTapTempo() {
  try {
    const audioInstance = await initAudio();
    const result = audioInstance.tapTempo(performance.now());
    if (!result) return;

    if (result.remaining > 0) {
      tapHelp.textContent = result.remaining === 2 ? '2 clicks más' : '1 click más solamente';
      // Ancorat al centre del botó tap (offsetParent = .controls, que és
      // position: relative pel tema nuzic); el CSS centra amb translateX.
      if (tapBtn) tapHelp.style.left = `${tapBtn.offsetLeft + tapBtn.offsetWidth / 2}px`;
      tapHelp.style.display = 'block';
      return;
    }

    tapHelp.style.display = 'none';
    if (Number.isFinite(result.bpm) && result.bpm > 0) {
      // El camp BPM mostra 1 decimal com a màxim
      const bpm = Math.round(result.bpm * 10) / 10;
      setValue(inputV, bpm);
      handleInput({ target: inputV });
    }
  } catch (error) {
    console.warn('Tap tempo failed', error);
  }
}

if (tapBtn) {
  tapBtn.addEventListener('click', () => { handleTapTempo(); });
}

if (tapHelp) {
  tapHelp.textContent = 'Se necesitan 3 clicks';
  tapHelp.style.display = 'none';
}

// --- Aleatorización de parámetros y pulsos ---
/**
 * Apply random values within the configured ranges and update inputs accordingly.
 */
function randomize() {
  randomizeFractional({
    randomConfig,
    randomDefaults,
    inputs: { inputLg, inputV, inputT },
    fractionEditor: fractionEditorController,
    pulseMemoryApi,
    fractionStore,
    randomCount,
    isIntegerPulseSelectable,
    nearestPulseIndex,
    applyRandomFractionSelection,
    getAllowComplexFractions: () => {
      const stored = localStorage.getItem('enableComplexFractions');
      return stored === null ? true : stored === 'true'; // Default: true
    },
    callbacks: {
      onLgChange: ({ value, input }) => handleInput({ target: input }),
      onVChange: ({ value, input }) => handleInput({ target: input }),
      onFractionChange: (updates) => {
        // Fallback si no hay fractionEditor
        if (!fractionEditorController) {
          if (updates.numerator != null && numeratorInput) {
            setValue(numeratorInput, updates.numerator);
          }
          if (updates.denominator != null && denominatorInput) {
            setValue(denominatorInput, updates.denominator);
          }
          refreshFractionUI({ reveal: true });
          handleInput();
        }
      },
      onPulsesChange: ({ selected, fractionsApplied }) => {
        syncSelectedFromMemory();
        updatePulseNumbers();
        layoutTimeline({ silent: true });
        rebuildFractionSelections();
        if (fractionsApplied && isPlaying) {
          applySelectionToAudio();
        }
      },
      renderNotation: () => renderNotationIfVisible()
    }
  });
}

initRandomMenu(randomBtn, randomMenu, randomize);

// All sound dropdowns (including cycleSoundSelect) are initialized by header.js via initHeader()
// No app-specific initialization needed

// Preview on sound change handled by shared header

// Create standardized audio initializer that avoids AudioContext warnings
const _baseInitAudio = createRhythmAudioInitializer({
  getSoundSelects: () => ({
    baseSoundSelect: elements.baseSoundSelect,
    startSoundSelect: elements.startSoundSelect,
    accentSoundSelect: elements.accentSoundSelect,
    cycleSoundSelect: elements.cycleSoundSelect
  }),
  schedulingBridge,
  channels: [
    {
      id: 'accent',
      options: { allowSolo: true, label: 'Seleccionado' },
      assignment: 'accent'
    }
  ]
});

async function initAudio() {
  if (!audio) {
    audio = await _baseInitAudio();
    if (audio) {
      setupAudioDefaults(audio, { channels: CHANNEL_TIERS.RHYTHM_FULL });
    }

    // Apply App4-specific configurations after initialization
    if (typeof audio.setVoiceHandler === 'function') {
      audio.setVoiceHandler(handleVoiceEvent);
    }
    // Replicar l'estat dels toggles fets abans que el motor existís (H-11):
    // re-dispara els onChange, que ara sí troben `audio`.
    audioToggleManager.applyTo();
    if (typeof audio.setLoop === 'function') {
      audio.setLoop(loopEnabled);
    }
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

// Mostrar unitats quan s'edita cada paràmetre
function bindUnit(input, unit){
  if(!input || !unit) return;
  input.addEventListener('focus', () => { unit.style.display = 'block'; });
  input.addEventListener('blur', () => { unit.style.display = 'none'; });
}

if (inputT) {
  inputT.readOnly = true;
  inputT.dataset.auto = '1';
}

bindUnit(inputLg, unitLg);
bindUnit(inputV, unitV);
bindUnit(inputT, unitT);

[inputLg, inputV].forEach(el => el.addEventListener('input', handleInput));
handleInput();


function setValue(input, value){
  isUpdating = true;
  input.value = String(value);
  isUpdating = false;
}

function parseNum(val){
  if (typeof val !== 'string') return Number(val);
  let s = val.trim();
  // Si hi ha coma i no hi ha punt: format català “1.234,56” → traiem punts (milers) i passem coma a punt
  if (s.includes(',') && !s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    // En la resta de casos, NO esborrem punts (poden ser decimals); només canviem comes per punts
    s = s.replace(/,/g, '.');
  }
  const n = parseFloat(s);
    return isNaN(n) ? NaN : n;
}
// === Formula Renderer and Tooltip Setup ===
const formulaRenderer = createFormulaRenderer();
const { formatNumber: formatNumberValue, formatInteger, formatBpm: formatBpmValue } = formulaRenderer;

function formatSec(n) {
  return formatNumberValue(n);
}

const titleInfoTooltip = createInfoTooltip({
  className: 'fraction-info-bubble auto-tip-below top-bar-info-tip'
});

function buildTitleInfoContent() {
  const lgValue = parseIntSafe(inputLg?.value);
  const { numerator, denominator } = getFraction();
  const tempoValue = parseNum(inputV?.value ?? '');
  const tValue = parseNum(inputT?.value ?? '');

  return formulaRenderer.buildFormulaFragment({
    lg: lgValue,
    numerator,
    denominator,
    tempo: tempoValue,
    t: tValue
  });
}

if (titleButton) {
  titleButton.addEventListener('click', () => {
    const content = buildTitleInfoContent();
    if (!content) return;
    titleInfoTooltip.show(content, titleButton);
  });
  titleButton.addEventListener('blur', () => titleInfoTooltip.hide());
  titleButton.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' || event.key === 'Esc') {
      titleInfoTooltip.hide();
    }
  });
}



// Unified spinner behavior for number inputs (V, Lg)
function stepAndDispatch(input, dir){
  if (!input) return;
  if (dir > 0) input.stepUp(); else input.stepDown();
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
addRepeatPress(inputVUp,   () => stepAndDispatch(inputV, +1));
addRepeatPress(inputVDown, () => stepAndDispatch(inputV, -1));
addRepeatPress(inputLgUp,  () => stepAndDispatch(inputLg, +1));
addRepeatPress(inputLgDown,() => stepAndDispatch(inputLg, -1));

function handleInput(){
  const lg = parseNum(inputLg.value);
  const v  = parseNum(inputV.value);
  const hasLg = !isNaN(lg) && lg > 0;
  const hasV  = !isNaN(v)  && v  > 0;

  if (isUpdating) return;

  refreshFractionUI({ reveal: true });

  let indicatorValue = '';
  if (hasLg && hasV) {
    const timing = fromLgAndTempo(lg, v);
    if (timing && timing.duration != null) {
      const rounded = Math.round(timing.duration * 100) / 100;
      if (inputT) setValue(inputT, rounded);
      indicatorValue = rounded;
    }
  } else if (inputT) {
    indicatorValue = parseNum(inputT.value);
  }

  // Update T indicator
  if (tIndicatorController) {
    tIndicatorController.updateText(indicatorValue);
    if (indicatorValue) {
      tIndicatorController.show();
    } else {
      tIndicatorController.hide();
    }
  }

  // Ensure memory capacity always (preserve selections when Lg crece manualmente)
  if (hasLg) {
    ensurePulseMemory(lg);
  }

  updateFormula();
  // P-03: mateix guard que App2 — handleInput és només Lg/V/T i el
  // timeline només depèn de Lg (els canvis de fracció re-rendericen
  // pels seus propis camins).
  if (lg !== lastTimelineRenderLg || !timeline.childElementCount) {
    lastTimelineRenderLg = Number.isFinite(lg) && lg > 0 ? lg : null;
    renderTimeline();
  }
  updateAutoIndicator();

  // A-13: push en viu col·lapsat (250ms trailing) — el bloc empeny veus,
  // resolució i transport junts; diferir-lo sencer manté la coherència
  // entre setVoices i updateTransport i cap transitòria de tecleig (bpm=2,
  // totalPulses=1) no arriba al worklet.
  if (isPlaying && audio) {
    liveTransportPush.schedule();
  }
}

// A-13: cos del push en viu d'App4 — llegeix l'estat fresc en disparar-se.
const liveTransportPush = createLiveTransportPush({
  isLive: () => isPlaying && !!audio,
  apply: () => {
    const scheduling = computeAudioSchedulingState();
    const selectionForAudio = applySelectionToAudio({ scheduling })
      || selectedForAudioFromState({ scheduling });
    const resolvedSelectionResolution = Number.isFinite(selectionForAudio?.resolution)
      ? Math.max(1, Math.round(selectionForAudio.resolution))
      : 1;
    const schedulingResolution = Number.isFinite(scheduling?.resolution)
      ? Math.max(1, Math.round(scheduling.resolution))
      : 1;
    const effectiveResolution = Math.max(1, resolvedSelectionResolution, schedulingResolution);
    const normalizedLg = Number.isFinite(scheduling?.lg) ? scheduling.lg : parseInt(inputLg.value);

    let effectiveTotal = scheduling.totalPulses != null ? scheduling.totalPulses : null;
    let effectivePatternBeats = scheduling.patternBeats != null ? scheduling.patternBeats : null;
    let effectiveCycleConfig = scheduling.cycleConfig ? { ...scheduling.cycleConfig } : null;
    let effectiveVoices = Array.isArray(scheduling.voices)
      ? scheduling.voices.map((voice) => (voice ? { ...voice } : voice))
      : [];

    if (Number.isFinite(normalizedLg) && normalizedLg > 0 && effectiveResolution > 1) {
      const scaledBase = normalizedLg * effectiveResolution;
      effectiveTotal = loopEnabled
        ? Math.max(1, Math.round(scaledBase))
        : Math.max(1, Math.round(scaledBase + 1));
      if (Number.isFinite(effectivePatternBeats)) {
        effectivePatternBeats = Math.max(1, Math.round(effectivePatternBeats * effectiveResolution));
      }
      if (effectiveCycleConfig && Number.isFinite(effectiveCycleConfig.numerator)) {
        effectiveCycleConfig = {
          ...effectiveCycleConfig,
          numerator: Math.max(1, Math.round(effectiveCycleConfig.numerator * effectiveResolution))
        };
      }
      effectiveVoices = effectiveVoices.map((voice) => {
        if (!voice || !Number.isFinite(voice.numerator)) return voice;
        return {
          ...voice,
          numerator: Math.max(1, Math.round(voice.numerator * effectiveResolution))
        };
      });
    }

    currentAudioResolution = effectiveResolution;
    updateVoiceHandlers({ scheduling: { ...scheduling, voices: effectiveVoices } });
    if (typeof audio.setVoices === 'function') {
      audio.setVoices(effectiveVoices);
    }

    const transportPayload = { align: 'nextPulse' };
    if (effectiveTotal != null) {
      transportPayload.totalPulses = effectiveTotal;
    }
    const vNow = parseFloat(inputV.value);
    // A-13: V només dins de rang (paritat U-11) — cap bpm=2 transitori
    if (scheduling.validV && Number.isFinite(vNow) && vNow >= 30 && vNow <= 240) {
      const scaledBpm = effectiveResolution > 1 ? vNow * effectiveResolution : vNow;
      transportPayload.bpm = scaledBpm;
    }
    if (effectivePatternBeats != null) {
      transportPayload.patternBeats = effectivePatternBeats;
    }
    if (effectiveCycleConfig) {
      transportPayload.cycle = effectiveCycleConfig;
    }
    if (effectiveResolution != null) {
      transportPayload.baseResolution = effectiveResolution;
    }
    if (typeof audio.updateTransport === 'function' && (scheduling.validLg || scheduling.validV)) {
      audio.updateTransport(transportPayload);
    }
  }
});

function updateFormula(){
  if (!formula) return;
  const tNum = parseNum(inputT?.value ?? '');
  const tStr = isNaN(tNum)
    ? ((inputT?.value ?? '') || 'T')
    : formatSec(tNum).replace('.', ',');
  const lg = inputLg.value || 'Lg';
  const v  = inputV.value || 'V';
  formula.innerHTML = `
  <span class="fraction">
    <span class="top lg">${lg}</span>
    <span class="bottom v">${v}</span>
  </span>
  <span class="equal">=</span>
  <span class="fraction">
    <span class="top t">${tStr}</span>
    <span class="bottom">60</span>
  </span>`;

}

// Rebuild selectedPulses (visible set) from pulseMemory and current Lg, then apply DOM classes
function syncSelectedFromMemory() {
  const lg = parseInt(inputLg.value);
  if (isNaN(lg) || lg <= 0) return;

  selectedPulses.clear();

  // 1) Persistència: només índexs interns (1..lg-1)
  const maxIdx = Math.min(lg - 1, pulseMemory.length - 1);
  for (let i = 1; i <= maxIdx; i++) {
    if (pulseMemory[i]) selectedPulses.add(i);
  }

  // 2) Extrems: efímers (derivats del loop)
  if (loopEnabled) {
    selectedPulses.add(0);
    selectedPulses.add(lg);
  }

  // Aplica al DOM
  const lgIndex = pulses.length > 0 ? pulses.length - 1 : null;

  pulses.forEach((p, idx) => {
    if (!p) return;
    p.classList.toggle('selected', selectedPulses.has(idx));
  });
  pulseHits.forEach((hit, idx) => {
    if (!hit) return;
    const isEndpoint = lgIndex != null && (idx === 0 || idx === lgIndex);
    const pulseIsLocked = hit.classList.contains('non-selectable');
    const shouldHighlight = selectedPulses.has(idx) && !isEndpoint && !pulseIsLocked;
    hit.classList.toggle('selected', shouldHighlight);
  });
  pulseNumberLabels.forEach((label) => {
    if (!label) return;
    const idx = parseIntSafe(label.dataset.index);
    if (!Number.isFinite(idx)) return;
    const isEndpoint = lgIndex != null && (idx === 0 || idx === lgIndex);
    const pulseIsLocked = !isEndpoint && Boolean(pulses[idx]?.classList.contains('non-selectable'));
    label.classList.toggle('selected', selectedPulses.has(idx) && !isEndpoint);
    label.classList.toggle('non-selectable', pulseIsLocked);
  });
  applyFractionSelectionClasses();
  renderNotationIfVisible();
}

// Deterministically set selection state for index i, respecting 0/Lg pairing when loopEnabled
function setPulseSelected(i, shouldSelect) {
  const lg = parseInt(inputLg.value);
  if (isNaN(lg) || lg < 0) return;
  ensurePulseMemory(Math.max(i, lg));

  if (i === 0 || i === lg) {
    // Extrems: controlen loopEnabled (estat efímer)
    loopEnabled = !!shouldSelect;
    loopBtn.classList.toggle('active', loopEnabled);
  } else {
    pulseMemory[i] = shouldSelect;
  }

  updatePulseNumbers();
  syncSelectedFromMemory();

  if (isPlaying && audio) {
    applySelectionToAudio();
    if (typeof audio.setLoop === 'function') {
      audio.setLoop(loopEnabled);
    }
  }

  layoutTimeline({ silent: true });
  renderNotationIfVisible();
}


function clearHighlights() {
  highlightController?.clearAll?.();
  if (highlightController) {
    return;
  }

  pulses.forEach(p => p.classList.remove('active'));
  cycleMarkers.forEach(m => m.classList.remove('active'));
  cycleLabels.forEach(l => l.classList.remove('active'));
  pulseNumberLabels.forEach(label => label.classList.remove('pulse-number--flash'));

  if (fractionStore) {
    fractionStore.lastFractionHighlightKey = null;
    fractionStore.lastHighlightType = null;
    fractionStore.lastHighlightIntIndex = null;
    fractionStore.lastHighlightFractionKey = null;
    fractionStore.lastHighlightFractionNodes = { key: null, marker: null, hit: null, token: null };
  }
}

// Inicializar controladores de highlighting y visual sync
function initHighlightingControllers() {
  if (visualSyncManager) {
    visualSyncManager.stop();
    visualSyncManager = null;
  }

  highlightController = createHighlightController({
    getPulses: () => pulses,
    getCycleMarkers: () => cycleMarkers,
    getPulseNumberLabels: () => pulseNumberLabels,
    getPulseAnimationDuration: resolvePulseAnimationDuration,
    fractionStore,
    epsilon: FRACTION_POSITION_EPSILON,
    highlightFractionMarkers: false
  });

  visualSyncManager = createVisualSyncManager({
    getAudio: () => audio,
    getIsPlaying: () => isPlaying,
    getLoopEnabled: () => loopEnabled,
    highlightController,
    getNotationRenderer: () => notationRendererController?.getRenderer(),
    getPulses: () => pulses,
    onResolutionChange: (newResolution) => {
      currentAudioResolution = newResolution;
    }
  });
}

function initTimelineRenderer() {
  if (!timeline) return;

  timelineRenderer = createFractionalTimelineRenderer({
    timeline,
    getLg: () => parseIntSafe(inputLg.value),
    getFraction,
    fractionStore,
    fractionMemory,
    computeHitSizePx,
    computeNumberFontRem,
    computeSubdivisionFontRem,
    attachSelectionListeners,
    isIntegerPulseSelectable,
    fractionValue,
    fractionDisplay,
    registerFractionLabel,
    markFractionSuspended,
    rememberFractionSelectionInMemory,
    constants: {
      SUBDIVISION_HIDE_THRESHOLD,
      PULSE_NUMBER_HIDE_THRESHOLD
    }
  });
}

function renderTimeline() {
  // Disable transitions during render to prevent animation when changing inputs
  timeline.classList.add('no-anim');

  if (highlightController) {
    highlightController.clearAll();
  }

  // Inicializar renderer si no existe
  if (!timelineRenderer) {
    initTimelineRenderer();
  }

  if (!timelineRenderer) {
    // Fallback si no hay renderer disponible
    pulseNumberLabels = [];
    pulses = [];
    pulseHits = [];
    cycleMarkers = [];
    cycleMarkerHits = [];
    cycleLabels = [];
    // Re-enable transitions even in fallback case
    requestAnimationFrame(() => {
      timeline.classList.remove('no-anim');
    });
    return;
  }

  // Renderizar usando el módulo
  const result = timelineRenderer.render();

  // Actualizar referencias globales
  pulses = result.pulses;
  pulseHits = result.pulseHits;
  cycleMarkers = result.cycleMarkers;
  cycleMarkerHits = result.cycleMarkerHits;
  cycleLabels = result.cycleLabels;
  pulseNumberLabels = result.pulseNumberLabels;

  // Actualizar lastStructureSignature
  lastStructureSignature = timelineRenderer.getLastStructureSignature();

  // Gestionar cambios de memoria de fracciones
  if (result.memoryChanges) {
    const { invalidCount, restoredFraction } = result.memoryChanges;
    if (invalidCount > 0 || restoredFraction) {
      rebuildFractionSelections({ skipUpdateField: true });
    }
  }

  updatePulseNumbers();
  layoutTimeline({ silent: true });
  syncSelectedFromMemory();
  applyFractionSelectionClasses();
  clearHighlights();
  renderNotationIfVisible();

  // Reinicializar controladores de highlighting después del render
  initHighlightingControllers();

  if (isPlaying) {
    // Si estamos en reproducción activa, reiniciar el loop de sync visual
    // para que el cursor de notación y los highlights sigan avanzando.
    syncVisualState();
    startVisualSync();
  }

  // Re-enable transitions after render completes
  requestAnimationFrame(() => {
    timeline.classList.remove('no-anim');
  });
}

function restoreCycleLabelDisplay() {
  cycleLabels.forEach(label => {
    if (!label) return;
    const full = label.dataset.fullText;
    if (typeof full === 'string') {
      label.textContent = full;
    }
    label.classList.remove('cycle-label--compact');
  });
}

function applyCycleLabelCompaction({ lg }) {
  if (!timeline || !Array.isArray(cycleLabels)) return;
  if (!Number.isFinite(lg) || lg <= 0) {
    restoreCycleLabelDisplay();
    return;
  }
  const width = timeline.clientWidth || timeline.getBoundingClientRect().width;
  if (!Number.isFinite(width) || width <= 0) {
    restoreCycleLabelDisplay();
    return;
  }

  const sorted = [...cycleLabels].filter(Boolean).sort((a, b) => {
    const aPos = Number(a.dataset.position);
    const bPos = Number(b.dataset.position);
    if (!Number.isFinite(aPos) && !Number.isFinite(bPos)) return 0;
    if (!Number.isFinite(aPos)) return 1;
    if (!Number.isFinite(bPos)) return -1;
    return aPos - bPos;
  });

  sorted.forEach((label, idx) => {
    const full = typeof label.dataset.fullText === 'string' ? label.dataset.fullText : label.textContent;
    const compact = label.dataset.compactText;
    let useCompact = false;

    if (label.dataset.isDecimal === '1' && typeof compact === 'string') {
      const currentPos = Number(label.dataset.position);
      if (Number.isFinite(currentPos)) {
        const currentPx = (currentPos / lg) * width;

        const prevLabel = sorted[idx - 1];
        let prevPx = null;
        if (prevLabel) {
          const prevPos = Number(prevLabel.dataset.position);
          if (Number.isFinite(prevPos)) {
            prevPx = (prevPos / lg) * width;
          }
        }

        const nextLabel = sorted[idx + 1];
        let nextPx = null;
        if (nextLabel) {
          const nextPos = Number(nextLabel.dataset.position);
          if (Number.isFinite(nextPos)) {
            nextPx = (nextPos / lg) * width;
          }
        }

        if ((prevPx != null && currentPx - prevPx < MIN_SUBDIVISION_LABEL_SPACING_PX)
          || (nextPx != null && nextPx - currentPx < MIN_SUBDIVISION_LABEL_SPACING_PX)) {
          useCompact = true;
        }
      }
    }

    if (useCompact) {
      label.textContent = compact;
      label.classList.add('cycle-label--compact');
    } else {
      label.textContent = full || '';
      label.classList.remove('cycle-label--compact');
    }
  });
}

function updateAutoIndicator(){
  // Los LEDs encendidos son los campos editables; el apagado se recalcula
  ledLg?.classList.toggle('on', inputLg.dataset.auto !== '1');
  ledV?.classList.toggle('on', inputV.dataset.auto !== '1');
  ledT?.classList.toggle('on', (inputT?.dataset?.auto) !== '1');
}

function handlePlaybackStop(audioInstance) {
  const iconPlay = playBtn?.querySelector('.icon-play');
  const iconStop = playBtn?.querySelector('.icon-stop');
  isPlaying = false;
  playBtn?.classList.remove('active');
  if (iconPlay) iconPlay.style.display = 'block';
  if (iconStop) iconStop.style.display = 'none';
  clearHighlights();
  stopVisualSync();
  if (audioInstance && typeof audioInstance.stop === 'function') {
    try { audioInstance.stop(); } catch {}
  }

  // Resetear cursor de notación
  const renderer = notationRendererController?.getRenderer();
  if (renderer && typeof renderer.resetCursor === 'function') {
    renderer.resetCursor();
  }
  currentAudioResolution = 1;
}

async function startPlayback(providedAudio) {
  const lg = parseInt(inputLg.value);
  const v  = parseFloat(inputV.value);
  if (!Number.isFinite(lg) || !Number.isFinite(v) || lg <= 0 || v <= 0) {
    return false;
  }

  const audioInstance = providedAudio || await initAudio();
  if (!audioInstance) return false;

  stopVisualSync();
  audioInstance.stop();
  clearHighlights();

  // Sound selection is already applied by initAudio() from dataset.value
  // and by bindSharedSoundEvents from sharedui:sound events
  // No need to override here

  const scheduling = computeAudioSchedulingState();
  if (scheduling.interval == null || scheduling.totalPulses == null) {
    return false;
  }
  const selectionForAudio = applySelectionToAudio({
    scheduling,
    instance: audioInstance
  }) || selectedForAudioFromState({ scheduling });
  const resolvedSelectionResolution = Number.isFinite(selectionForAudio?.resolution)
    ? Math.max(1, Math.round(selectionForAudio.resolution))
    : 1;
  const schedulingResolution = Number.isFinite(scheduling?.resolution)
    ? Math.max(1, Math.round(scheduling.resolution))
    : 1;
  const effectiveResolution = Math.max(1, resolvedSelectionResolution, schedulingResolution);
  const normalizedLg = Number.isFinite(scheduling?.lg) ? scheduling.lg : lg;
  let effectiveInterval = scheduling.interval;
  let effectiveTotal = scheduling.totalPulses;
  let effectivePatternBeats = Number.isFinite(scheduling?.patternBeats)
    ? scheduling.patternBeats
    : null;
  let cycleConfig = scheduling.cycleConfig ? { ...scheduling.cycleConfig } : null;
  let voices = Array.isArray(scheduling.voices)
    ? scheduling.voices.map((voice) => ({ ...voice }))
    : [];

  if (Number.isFinite(normalizedLg) && normalizedLg > 0 && effectiveResolution > 1) {
    const scaledBase = normalizedLg * effectiveResolution;
    if (loopEnabled) {
      effectiveTotal = Math.max(1, Math.round(scaledBase));
    } else {
      effectiveTotal = Math.max(1, Math.round(scaledBase + 1));
    }
    if (Number.isFinite(scheduling.interval)) {
      effectiveInterval = scheduling.interval / effectiveResolution;
    }
    if (Number.isFinite(effectivePatternBeats)) {
      effectivePatternBeats = Math.max(1, Math.round(effectivePatternBeats * effectiveResolution));
    }
    if (cycleConfig && Number.isFinite(cycleConfig.numerator)) {
      cycleConfig = { ...cycleConfig, numerator: Math.max(1, Math.round(cycleConfig.numerator * effectiveResolution)) };
    }
    voices = voices.map((voice) => {
      if (!voice || !Number.isFinite(voice.numerator)) return voice;
      return { ...voice, numerator: Math.max(1, Math.round(voice.numerator * effectiveResolution)) };
    });
  }

  if (!Number.isFinite(effectiveInterval) || effectiveInterval <= 0) {
    return false;
  }
  if (!Number.isFinite(effectiveTotal) || effectiveTotal <= 0) {
    return false;
  }

  currentAudioResolution = effectiveResolution;
  updateVoiceHandlers({ scheduling: { ...scheduling, voices } });
  if (typeof audioInstance.setVoices === 'function') {
    audioInstance.setVoices(voices);
  }
  const iconPlay = playBtn?.querySelector('.icon-play');
  const iconStop = playBtn?.querySelector('.icon-stop');

  const onFinish = () => {
    handlePlaybackStop(audioInstance);
  };

  const playOptions = {};
  if (effectivePatternBeats != null) {
    playOptions.patternBeats = effectivePatternBeats;
  }
  if (cycleConfig) {
    playOptions.cycle = cycleConfig;
  }
  playOptions.baseResolution = effectiveResolution;

  if (typeof audioInstance.setLoop === 'function') {
    audioInstance.setLoop(loopEnabled);
  }

  const selectionValuesForAudio = selectionForAudio.audio ?? selectionForAudio.combined;
  const selectionPayload = {
    values: selectionValuesForAudio,
    // Mantener resolución 1 evita reescalar pulsos seleccionados al iniciar play.
    resolution: 1
  };

  audioInstance.play(
    effectiveTotal,
    effectiveInterval,
    selectionPayload,
    loopEnabled,
    null,
    onFinish,
    playOptions
  );

  syncVisualState();
  startVisualSync();

  isPlaying = true;
  playBtn?.classList.add('active');
  if (iconPlay) iconPlay.style.display = 'none';
  if (iconStop) iconStop.style.display = 'block';

  return true;
}

playBtn.addEventListener('click', async () => {
  try {
    const audioInstance = await initAudio();
    if (!audioInstance) return;

    if (isPlaying) {
      handlePlaybackStop(audioInstance);
      return;
    }

    clearHighlights();
    const started = await startPlayback(audioInstance);
    if (!started) {
      handlePlaybackStop(audioInstance);
    }
  } catch {}
});

function highlightCycle(payload = {}) {
  if (highlightController) {
    highlightController.highlightCycle(payload);
  }
}

function resolvePulseAnimationDuration({ resolution } = {}) {
  const bpm = parseNum(inputV?.value);
  if (!(Number.isFinite(bpm) && bpm > 0)) {
    return null;
  }
  const baseResolution = Number.isFinite(resolution) && resolution > 0
    ? Math.max(1, Math.round(resolution))
    : Math.max(1, Math.round(currentAudioResolution || 1));
  if (!Number.isFinite(baseResolution) || baseResolution <= 0) {
    return null;
  }
  const intervalMs = (60 / (bpm * baseResolution)) * 1000;
  return Math.max(60, Math.min(intervalMs, 420));
}

function stopVisualSync() {
  if (visualSyncManager) {
    visualSyncManager.stop();
  }
  // Mantener compatibilidad con código legacy
  if (visualSyncHandle != null) {
    cancelAnimationFrame(visualSyncHandle);
    visualSyncHandle = null;
  }
  highlightController?.clearAll();
}

function syncVisualState() {
  if (visualSyncManager) {
    visualSyncManager.syncVisualState();
  }
}

function startVisualSync() {
  if (visualSyncManager) {
    visualSyncManager.start();
  } else {
    // Fallback legacy
    stopVisualSync();
    const step = () => {
      visualSyncHandle = null;
      if (!isPlaying || !audio) return;
      syncVisualState();
      visualSyncHandle = requestAnimationFrame(step);
    };
    visualSyncHandle = requestAnimationFrame(step);
  }
}

const menu = document.querySelector('.menu');
const optionsContent = document.querySelector('.menu .options-content');

if (menu && optionsContent) {
  menu.addEventListener('toggle', () => {
    if (menu.open) {
      // enforce solid background on open
      solidMenuBackground(optionsContent);
      optionsContent.classList.add('opening');
      optionsContent.classList.remove('closing');
      optionsContent.style.maxHeight = optionsContent.scrollHeight + "px";

      optionsContent.addEventListener('transitionend', () => {
        optionsContent.classList.remove('opening');
        optionsContent.style.maxHeight = "500px"; // estat estable
      }, { once: true });

    } else {
      optionsContent.classList.add('closing');
      optionsContent.classList.remove('opening');
      optionsContent.style.maxHeight = optionsContent.scrollHeight + "px";
      optionsContent.offsetHeight; // força reflow
      optionsContent.style.maxHeight = "0px";

      optionsContent.addEventListener('transitionend', () => {
        optionsContent.classList.remove('closing');
      }, { once: true });
    }
  });

  // Also re-apply if theme changes while menu is open
  window.addEventListener('sharedui:theme', () => {
    if (menu.open) solidMenuBackground(optionsContent);
  });
}
// Initialize mixer UI and sync accent/master controls
const mixerMenu = document.getElementById('mixerMenu');
const mixerTriggers = [playBtn, tapBtn].filter(Boolean);

initMixerMenu({
  menu: mixerMenu,
  triggers: mixerTriggers,
  channels: [
    { id: 'pulse',  label: 'Pulso', allowSolo: true },
    { id: 'subdivision', label: 'Subdivisión',  allowSolo: true },
    { id: 'accent', label: 'Seleccionado',  allowSolo: true },
    { id: 'master', label: 'Master',        allowSolo: false, isMaster: true }
  ]
});

// Initialize gamification system
import('./gamification-adapter.js').then(module => {
  module.initApp4Gamification();
});
