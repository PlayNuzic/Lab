// App27: Fracciones Complejas
// Igual que App26, però amb fraccions complexes (numerador editable)
// Lg = numerador (dinàmic, 2-6), dibuixa 1 cicle de la fracció
// BPM=85 fix, denominador editable (2-8), playback en loop

import { CHANNEL_TIERS } from '../../libs/app-common/audio-init.js';
import { createFractionAppShell } from '../../libs/app-common/fraction-app-shell.js';
import createFractionEditor from '../../libs/app-common/fraction-editor.js';
import { createFractionTimeline } from '../../libs/app-common/fraction-timeline.js';
import { createFractionHighlighter } from '../../libs/app-common/fraction-highlight.js';
import { randomInt, gcd } from '../../libs/app-common/number-utils.js';
import { setupRandomMenu } from '../../libs/random/menu.js';
import { attachHover } from '../../libs/shared-ui/hover.js';
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

// DOM elements
// Els elements de la línia de temps viuen a la factoria `tl` (H-15).

// Controllers
let fractionEditorController = null;
// Els toggles d'àudio viuen al shell (shell.getToggle/setToggle).
let randomMenu = null;  // Long-press random menu controller (read())

// Storage keys
const PULSE_AUDIO_KEY = 'pulseAudio';
const CYCLE_AUDIO_KEY = 'cycleAudio';

// ========== DOM ELEMENTS ==========
const timeline = document.getElementById('timeline');
const playBtn = document.getElementById('playBtn');
const randomBtn = document.getElementById('randomBtn');
const resetBtn = document.getElementById('resetBtn');
const themeSelect = document.getElementById('themeSelect');
const pulseToggleBtn = document.getElementById('pulseToggleBtn');
const cycleToggleBtn = document.getElementById('cycleToggleBtn');
const mixerMenu = document.getElementById('mixerMenu');
const baseSoundSelect = document.getElementById('baseSoundSelect');
const startSoundSelect = document.getElementById('startSoundSelect');
const cycleSoundSelect = document.getElementById('cycleSoundSelect');
const formula = document.querySelector('.middle');

// ========== HOVER TOOLTIPS ==========
if (playBtn) attachHover(playBtn, { text: 'Play / Stop' });
if (randomBtn) attachHover(randomBtn, { text: 'Aleatorizar fracción' });
if (resetBtn) attachHover(resetBtn, { text: 'Reset App' });
if (pulseToggleBtn) attachHover(pulseToggleBtn, { text: 'Activar o silenciar el pulso' });
if (cycleToggleBtn) attachHover(cycleToggleBtn, { text: 'Activar o silenciar el ciclo' });

// ========== SHELL DE L'APP (H-14) ==========
// Preferències + factory reset, events de so compartits, toggles d'àudio,
// menú del mixer, tema/mute i initAudio — tot a libs/app-common/fraction-app-shell.js.
const shell = createFractionAppShell({
  prefix: 'app27',
  getAudio: () => audio,
  setAudio: (instance) => { audio = instance; },
  audio: {
    type: 'rhythm',
    channelTier: CHANNEL_TIERS.RHYTHM_SUB,
    getSoundSelects: () => ({
      baseSoundSelect,
      startSoundSelect,
      cycleSoundSelect
    }),
    soundEventMapping: {
      baseSound: 'setBase',
      startSound: 'setStart',
      cycleSound: 'setCycle'
    }
  },
  toggles: [
    { id: 'pulse', button: pulseToggleBtn, storageKey: PULSE_AUDIO_KEY, mixerChannel: 'pulse', engineSetter: 'setPulseEnabled' },
    { id: 'cycle', button: cycleToggleBtn, storageKey: CYCLE_AUDIO_KEY, mixerChannel: 'subdivision', engineSetter: 'setCycleEnabled' }
  ],
  mixer: {
    menu: mixerMenu,
    triggers: [playBtn],
    channels: [
      { id: 'pulse', label: 'Pulso', allowSolo: true },
      { id: 'subdivision', label: 'Subdivisión', allowSolo: true },
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
  if (!formula) return;

  // Always start with default fraction (no persistence)
  currentNumerator = DEFAULT_NUMERATOR;
  currentDenominator = DEFAULT_DENOMINATOR;

  const controller = createFractionEditor({
    mode: 'block',
    host: formula,
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

  // If clamped, update the input visually
  if (newN !== fraction?.numerator || newD !== fraction?.denominator) {
    fractionEditorController.setFraction(
      { numerator: newN, denominator: newD },
      { cause: 'clamp', persist: true, silent: true }
    );
  }

  currentNumerator = newN;
  currentDenominator = newD;

  // Redraw timeline with new subdivisions
  renderTimeline();

  // Update audio cycle config if playing
  if (audio && isPlaying) {
    applyCycleConfig();
  }
}

function setFraction(n, d) {
  const clampedN = Math.max(MIN_NUMERATOR, Math.min(MAX_NUMERATOR, n));
  const clampedD = Math.max(MIN_DENOMINATOR, Math.min(MAX_DENOMINATOR, d));
  currentNumerator = clampedN;
  currentDenominator = clampedD;

  if (fractionEditorController && typeof fractionEditorController.setFraction === 'function') {
    fractionEditorController.setFraction(
      { numerator: clampedN, denominator: clampedD },
      { cause: 'external', persist: true, silent: false, reveal: true }
    );
  }

  renderTimeline();
}


// ========== TIMELINE I HIGHLIGHTS (factories compartides, H-15/H-16) ==========
// App27 dibuixa 1 cicle (lg = numerador): extrems amb número (endpoint) i
// enters intermedis "fantasma" — en una fracció reduïda mai cauen sobre
// una subdivisió (glossari Nuzic).
const tl = createFractionTimeline({
  timeline,
  getLg: () => currentNumerator,
  getNumerator: () => currentNumerator,
  getDenominator: () => currentDenominator,
  decoratePulse: (el, { index, lg }) => {
    if (index === 0 || index === lg) el.classList.add('endpoint');
    else el.classList.add('ghost');
  }
});

function renderTimeline() {
  tl.render();
}

const highlighter = createFractionHighlighter({
  getPulses: tl.getPulses,
  getCycleMarkers: tl.getCycleMarkers,
  getCycleLabels: tl.getCycleLabels
});

function clearHighlights() {
  highlighter.clear();
}

function highlightPulse(scaledIndex) {
  if (!isPlaying) return;

  const lg = currentNumerator;
  const d = currentDenominator;
  const scaledTotal = lg * d;
  const raw = Number.isFinite(scaledIndex) ? scaledIndex : 0;

  // Només límits de pols enter (múltiples de d); les subdivisions van a
  // highlightCycle.
  if (raw % d !== 0 && raw !== scaledTotal) return;

  // En mode loop, el tancament de cicle (scaledTotal) il·lumina alhora el
  // pols 0 i l'endpoint (lg).
  if (raw === 0 || raw === scaledTotal) {
    highlighter.highlightPulseIndex(0);
    const endpoint = tl.getPulses()[lg];
    if (endpoint) {
      void endpoint.offsetWidth;
      endpoint.classList.add('active');
    }
    return;
  }

  highlighter.highlightPulseIndex(Math.floor(raw / d));
}

function highlightCycle(payload = {}) {
  if (!isPlaying) return;
  highlighter.highlightCycle(payload);
}



// ========== HIGHLIGHTING ==========



// ========== AUDIO CYCLE CONFIG ==========
function applyCycleConfig() {
  if (!audio) return;

  // Amb lg = numerador, sempre hi ha exactament 1 cicle
  const hasCycle = currentNumerator > 0 && currentDenominator > 0;

  if (typeof audio.updateCycleConfig === 'function') {
    audio.updateCycleConfig({
      numerator: hasCycle ? currentNumerator : 0,
      denominator: hasCycle ? currentDenominator : 0,
      onTick: hasCycle ? highlightCycle : null
    });
  }
}

// ========== PLAYBACK ==========
async function startPlayback() {
  // lg = numerador → 1 cicle de la fracció
  const lg = currentNumerator;
  const bpm = bpmController?.getValue() || DEFAULT_BPM;
  const d = currentDenominator;

  // Escalar per denominador per incloure subdivisions
  const baseResolution = d;
  const scaledTotal = lg * d; // Total steps (loop mode, sense endpoint extra)
  const scaledInterval = (60 / bpm) / d; // Cada step = 1/d d'un beat

  const audioInstance = await initAudio();

  // Amb lg = numerador, sempre hi ha exactament 1 cicle
  const hasCycle = currentNumerator > 0 && currentDenominator > 0;

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
    playOptions.cycle = {
      numerator: lg * d, // 1 cicle = lg * d steps
      denominator: d,
      onTick: highlightCycle
    };
  }

  audioInstance.play(
    scaledTotal,
    scaledInterval,
    new Set(),       // No selection
    true,            // Loop ENABLED (1 cicle en bucle)
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
function randomize() {
  // Random numerador (1..numMax) i denominador (2..denomMax), only reduced fractions (gcd = 1).
  // The longpress menu lets the user cap each independently (defaults = MAX_*).
  const { numMax, denomMax } = randomMenu?.read() ?? { numMax: MAX_NUMERATOR, denomMax: MAX_DENOMINATOR };
  const nMax = Math.min(numMax, MAX_NUMERATOR);
  const dMax = Math.min(denomMax, MAX_DENOMINATOR);
  let newN, newD;
  do {
    newN = randomInt(MIN_NUMERATOR, nMax);
    newD = randomInt(2, dMax);
  } while (gcd(newN, newD) !== 1);
  setFraction(newN, newD);

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
    numMax:   { label: 'Numerador máximo',   min: MIN_NUMERATOR, max: MAX_NUMERATOR,   default: MAX_NUMERATOR },
    denomMax: { label: 'Denominador máximo', min: 2,             max: MAX_DENOMINATOR, default: MAX_DENOMINATOR },
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
      onChange: (bpm) => {
        // Transport escalat: play() usa interval (60/bpm)/d, així que el
        // tempo efectiu és bpm × d — setTempo(bpm) sense escalar el feia
        // d vegades més lent en calent.
        if (isPlaying && audio) audio.setTempo(bpm * currentDenominator);
      }
    });
    bpmController.attach();
  }

  // Ordre nuzic de la fila de controls (helper compartit, H-08)
  reorderControls();

  // Initialize fraction editor
  initFractionEditorController();

  // Render timeline
  renderTimeline();

  // Idle caret flash on play button
  initIdleCaretFlash({ targets: [document.getElementById('playBtn')] });
}

// Run init when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
