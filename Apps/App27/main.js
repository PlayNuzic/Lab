// App27: Fracciones Complejas
// Igual que App26, però amb fraccions complexes (numerador editable)
// Lg = numerador (dinàmic, 2-6), dibuixa 1 cicle de la fracció
// BPM=85 fix, denominador editable (2-8), playback en loop

import { getMixer, subscribeMixer } from '../../libs/sound/index.js';
import { createRhythmAudioInitializer, setupAudioDefaults, CHANNEL_TIERS } from '../../libs/app-common/audio-init.js';
import { createSchedulingBridge, bindSharedSoundEvents } from '../../libs/app-common/audio.js';
import { initAudioToggles } from '../../libs/app-common/audio-toggles.js';
import { initMixerMenu } from '../../libs/app-common/mixer-menu.js';
import { createPreferenceStorage, registerFactoryReset, setupThemeSync, setupMutePersistence } from '../../libs/app-common/preferences.js';
import createFractionEditor from '../../libs/app-common/fraction-editor.js';
import { gridFromOrigin } from '../../libs/app-common/subdivision.js';
import { randomInt, gcd } from '../../libs/app-common/number-utils.js';
import { setupRandomMenu } from '../../libs/random/menu.js';
import { attachHover } from '../../libs/shared-ui/hover.js';
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

// DOM elements
let pulses = [];       // .pulse-number elements (nuzic-theme hides legacy .pulse dots)
let cycleMarkers = [];
let cycleLabels = [];

// Controllers
let fractionEditorController = null;
let pulseToggleController = null;
let cycleToggleController = null;
let randomMenu = null;  // Long-press random menu controller (read())

// Storage keys
const PULSE_AUDIO_KEY = 'pulseAudio';
const CYCLE_AUDIO_KEY = 'cycleAudio';

// ========== PREFERENCE STORAGE ==========
const preferenceStorage = createPreferenceStorage({ prefix: 'app27', separator: '::' });
const { load: loadOpt, save: saveOpt, clear: clearOpt } = preferenceStorage;

registerFactoryReset({
  storage: preferenceStorage,
  onBeforeReload: () => {
    setPulseAudio(true, { persist: false });
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
    startSound: 'setStart',
    cycleSound: 'setCycle'
  }
});

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

// ========== MIXER SETUP ==========
// Canals registrats al motor; setupAudioDefaults dins initAudio()
// els personalitza via CHANNEL_TIERS.RHYTHM_SUB.
const globalMixer = getMixer();

// ========== HOVER TOOLTIPS ==========
if (playBtn) attachHover(playBtn, { text: 'Play / Stop' });
if (randomBtn) attachHover(randomBtn, { text: 'Aleatorizar fracción' });
if (resetBtn) attachHover(resetBtn, { text: 'Reset App' });
if (pulseToggleBtn) attachHover(pulseToggleBtn, { text: 'Activar o silenciar el pulso' });
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
cycleToggleController = audioToggleManager.get('cycle') ?? null;

function setPulseAudio(value, options) {
  pulseToggleController?.set(value, options);
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
    { id: 'subdivision', label: 'Subdivisión', allowSolo: true },
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
      setupAudioDefaults(audio, { channels: CHANNEL_TIERS.RHYTHM_SUB });
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

  // lg = numerator → draws exactly one cycle of the fraction
  const lg = currentNumerator;
  const numerator = currentNumerator;
  const denominator = currentDenominator;

  // Pulse numbers (nuzic-theme handles ticks via ::before/::after and hides
  // legacy .pulse dots). Intermediate integers (0<i<lg) are marked as
  // "ghost" pulses — in a reduced fraction n/d they never fall on a
  // subdivision boundary (Nuzic glossary).
  for (let i = 0; i <= lg; i++) {
    const num = document.createElement('div');
    num.className = 'pulse-number';
    if (i === 0 || i === lg) num.classList.add('endpoint');
    else num.classList.add('ghost');
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

  // Subdivision ticks: skip integer positions (they already have a tick from
  // pulse-number::before in nuzic-theme).
  const grid = gridFromOrigin({ lg, numerator, denominator });
  if (grid.cycles > 0 && grid.subdivisions.length) {
    grid.subdivisions.forEach(({ cycleIndex, subdivisionIndex, position }) => {
      if (subdivisionIndex === 0) return;

      const marker = document.createElement('div');
      marker.className = 'cycle-marker';
      marker.dataset.cycleIndex = String(cycleIndex);
      marker.dataset.subdivision = String(subdivisionIndex);
      marker.dataset.position = String(position);
      timeline.appendChild(marker);
      cycleMarkers.push(marker);

      const label = document.createElement('div');
      label.className = 'cycle-label';
      label.dataset.cycleIndex = String(cycleIndex);
      label.dataset.subdivision = String(subdivisionIndex);
      label.dataset.position = String(position);
      label.textContent = `.${subdivisionIndex}`;
      timeline.appendChild(label);
      cycleLabels.push(label);
    });
  }

  layoutTimeline();

  requestAnimationFrame(() => {
    timeline.classList.remove('no-anim');
  });
}

function layoutTimeline() {
  const lg = currentNumerator;

  // nuzic-theme positions pulse-numbers vertically; only horizontal % dynamic.
  pulses.forEach((num) => {
    const idx = parseInt(num.dataset.index, 10);
    num.style.left = (idx / lg) * 100 + '%';
  });

  // Subdivision ticks/labels: vertical positioning is static in CSS.
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
}

function highlightPulse(scaledIndex) {
  if (!isPlaying) return;

  const lg = currentNumerator;
  const d = currentDenominator;
  const scaledTotal = lg * d;

  const raw = Number.isFinite(scaledIndex) ? scaledIndex : 0;

  // Only highlight on integer pulse boundaries (multiples of d)
  // Subdivisions are handled by highlightCycle
  if (raw % d !== 0 && raw !== scaledTotal) return;

  pulses.forEach(p => p.classList.remove('active'));

  // En mode loop, quan scaledIndex = scaledTotal (inici del següent cicle),
  // il·luminem tant pols 0 com endpoint (lg)
  if (raw === 0 || raw === scaledTotal) {
    // Il·luminar pols 0
    const pulse0 = pulses[0];
    if (pulse0) {
      void pulse0.offsetWidth;
      pulse0.classList.add('active');
    }
    // Il·luminar endpoint (lg) també
    const endpoint = pulses[lg];
    if (endpoint) {
      void endpoint.offsetWidth;
      endpoint.classList.add('active');
    }
    return;
  }

  // Convertir índex escalat a índex de pols enter
  // scaledIndex = pulseIndex * d, així que pulseIndex = floor(scaledIndex / d)
  const pulseIndex = Math.floor(raw / d);
  const normalized = Math.max(0, Math.min(pulseIndex, lg));
  const pulse = pulses[normalized];
  if (pulse) {
    void pulse.offsetWidth;
    pulse.classList.add('active');
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
