// App26: Fracciones Simples
// Timeline horitzontal d'App9 + lògica de fraccions d'App3 simplificada
// Lg=6 fix, BPM=85 fix, numerador=1 fix, denominador editable (1-8)
// Playback one-shot (sense loop)

import { getMixer, setChannelMute } from '../../libs/sound/index.js';
import { CHANNEL_TIERS } from '../../libs/app-common/audio-init.js';
import { withPlayButtonLoading } from '../../libs/app-common/play-loading.js';
import { createFractionAppShell } from '../../libs/app-common/fraction-app-shell.js';
import createFractionEditor from '../../libs/app-common/fraction-editor.js';
import { createFractionTimeline } from '../../libs/app-common/fraction-timeline.js';
import { createFractionHighlighter } from '../../libs/app-common/fraction-highlight.js';
import { randomInt } from '../../libs/app-common/number-utils.js';
import { setupRandomMenu } from '../../libs/random/menu.js';
import { attachHover } from '../../libs/shared-ui/hover.js';
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
if (randomBtn) attachHover(randomBtn, { text: 'Aleatorizar denominador' });
if (resetBtn) attachHover(resetBtn, { text: 'Reset App' });
if (pulseToggleBtn) attachHover(pulseToggleBtn, { text: 'Activar o silenciar el pulso' });
if (cycleToggleBtn) attachHover(cycleToggleBtn, { text: 'Activar o silenciar el ciclo' });

// ========== SHELL DE L'APP (H-14) ==========
// Preferències + factory reset, events de so compartits, toggles d'àudio,
// menú del mixer, tema/mute i initAudio — tot a libs/app-common/fraction-app-shell.js.
const shell = createFractionAppShell({
  prefix: 'app26',
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

  // Load saved denominator
  const savedD = loadOpt('d');
  const initialD = savedD ? parseInt(savedD, 10) : DEFAULT_DENOMINATOR;
  currentDenominator = Number.isFinite(initialD) && initialD >= MIN_DENOMINATOR && initialD <= MAX_DENOMINATOR
    ? initialD
    : DEFAULT_DENOMINATOR;

  const controller = createFractionEditor({
    mode: 'block',
    host: formula,
    defaults: { numerator: FIXED_NUMERATOR, denominator: currentDenominator },
    startEmpty: false,
    maxDenominator: MAX_DENOMINATOR,
    // App26 té el numerador fixat a 1 (simple mode) — la fracció mai no
    // és reductible (gcd(1, d) = 1), per tant la ghost-fraction i la seva
    // animació no s'utilitzen mai. Skip-em la creació del DOM per estalvi.
    enableGhost: false,
    storage: {
      load: loadOpt,
      save: saveOpt,
      clear: clearOpt,
      numeratorKey: 'n',
      denominatorKey: 'd'
    },
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

  // If clamped, update the input visually
  if (newD !== fraction?.denominator) {
    fractionEditorController.setFraction(
      { numerator: FIXED_NUMERATOR, denominator: newD },
      { cause: 'clamp', persist: true, silent: true }
    );
  }

  currentDenominator = newD;

  // Redraw timeline with new subdivisions
  renderTimeline();

  // Update audio cycle config if playing
  if (audio && isPlaying) {
    applyCycleConfig();
  }
}

function setDenominator(d) {
  const clamped = Math.max(MIN_DENOMINATOR, Math.min(MAX_DENOMINATOR, d));
  currentDenominator = clamped;

  if (fractionEditorController && typeof fractionEditorController.setFraction === 'function') {
    fractionEditorController.setFraction(
      { numerator: FIXED_NUMERATOR, denominator: clamped },
      { cause: 'external', persist: true, silent: false, reveal: true }
    );
  }

  renderTimeline();
}


// ========== TIMELINE I HIGHLIGHTS (factories compartides, H-15/H-16) ==========
const tl = createFractionTimeline({
  timeline,
  getLg: () => FIXED_LG,
  getNumerator: () => FIXED_NUMERATOR,
  getDenominator: () => currentDenominator
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

function highlightPulse(index) {
  if (!isPlaying) return;
  highlighter.highlightPulseIndex(Number.isFinite(index) ? index : 0);
}

function highlightCycle(payload = {}) {
  if (!isPlaying) return;
  highlighter.highlightCycle(payload);
}



// ========== HIGHLIGHTING ==========



// ========== AUDIO CYCLE CONFIG ==========
function applyCycleConfig() {
  if (!audio) return;

  const hasCycle = currentDenominator > 0 && Math.floor(FIXED_LG / FIXED_NUMERATOR) > 0;

  if (typeof audio.updateCycleConfig === 'function') {
    audio.updateCycleConfig({
      numerator: hasCycle ? FIXED_NUMERATOR : 0,
      denominator: hasCycle ? currentDenominator : 0,
      onTick: hasCycle ? highlightCycle : null
    });
  }
}

// ========== PLAYBACK ==========
async function startPlayback() {
  const lg = FIXED_LG;
  const bpm = bpmController?.getValue() || DEFAULT_BPM;
  const interval = 60 / bpm;
  // playbackTotal = lg + 1 so the engine reaches the final beat and emits
  // the cycle-subdivision events just before it (5.1, 5.2, … up to the
  // last subdivision before pulse Lg). patternBeats = lg caps the cycle
  // event generator to beats in [0, lg), so no subdivisions INSIDE the
  // cycle-end pulse (Lg) are scheduled. The engine still fires a base
  // pulse at step lg — we mute the `pulse` channel in onSchedule for
  // that single step so pulse Lg stays silent (it's the `·` endpoint).
  const playbackTotal = lg + 1;

  // U-27: estat de càrrega compartit al primer Play (Tone.js + samples)
  const audioInstance = await withPlayButtonLoading(playBtn, () => initAudio());

  const hasCycle = currentDenominator > 0 && Math.floor(lg / FIXED_NUMERATOR) > 0;

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
    // Delay stop() so the pre-scheduled sample for the last fractional
    // subdivision has time to play instead of being cancelled by source.stop(0).
    setTimeout(() => audioInstance.stop(), Math.max(200, interval * 1000 * 0.6));
  };

  const cycleOptions = hasCycle
    ? { cycle: { numerator: FIXED_NUMERATOR, denominator: currentDenominator, onTick: highlightCycle } }
    : {};

  audioInstance.play(
    playbackTotal,
    interval,
    new Set(),       // No selection
    false,           // Loop DISABLED (one-shot)
    highlightPulse,
    onFinish,
    {
      ...cycleOptions,
      patternBeats: lg,   // cycle events only within [0, lg)
      onSchedule: (stepIndex, _when) => {
        // Mute the pulse channel just before the final beat (pulse Lg =
        // cycle-end `·`) so its base sample doesn't fire. Subdivisions
        // already fired before this step; the engine will emit `done`
        // immediately after the pulse and onFinish restores the channel.
        if (stepIndex === lg && !pulseMutedForEndpoint) {
          setChannelMute('pulse', true);
          pulseMutedForEndpoint = true;
        }
      }
    }
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
  // Random denominator between 2 and the longpress-menu cap (default = MAX_DENOMINATOR).
  const { denomMax } = randomMenu?.read() ?? { denomMax: MAX_DENOMINATOR };
  const newD = randomInt(2, Math.min(denomMax, MAX_DENOMINATOR));
  setDenominator(newD);

  // Auto-play after randomizing (consistent across apps 9+).
  if (!isPlaying) {
    clearHighlights();
    startPlayback();
  }
}

async function handleReset() {
  // LU-02: reset in-place (patró App32/App34) — abans location.reload():
  // flaix en blanc, AudioContext fora (el següent Play tornava a pagar
  // la càrrega de Tone.js i el gest) i tall sec si estava sonant.
  if (isPlaying) await stopPlayback();
  clearOpt('d');
  clearOpt('n');
  setDenominator(DEFAULT_DENOMINATOR);
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
      onChange: (bpm) => { if (isPlaying && audio) audio.setTempo(bpm); }
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
