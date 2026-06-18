import { createRhythmAudioInitializer, setupAudioDefaults, CHANNEL_TIERS } from '../../libs/app-common/audio-init.js';
import { attachHover } from '../../libs/shared-ui/hover.js';
import { solidMenuBackground, computeNumberFontRem } from './utils.js';
import { initRandomMenu, mergeRandomConfig } from '../../libs/random/index.js';
import { toRange, parseNum, formatSec, randomInt } from '../../libs/app-common/number-utils.js';
import { createSchedulingBridge, bindSharedSoundEvents } from '../../libs/app-common/audio.js';
import { fromLgAndTempo, toPlaybackPulseCount } from '../../libs/app-common/subdivision.js';
import { createLiveTransportPush } from '../../libs/app-common/transport-live-update.js';
import { computeResyncDelay } from '../../libs/app-common/audio-schedule.js';
import { bindAppRhythmElements } from '../../libs/app-common/dom.js';
import { createFormulaSolver } from '../../libs/app-common/formula-solver.js';
import { renderCircularRingNumbers } from '../../libs/app-common/circular-timeline-ring.js';
import { createSimpleVisualSync } from '../../libs/app-common/visual-sync.js';
import { createSimpleHighlightController } from '../../libs/app-common/simple-highlight-controller.js';
import { createCircularTimeline } from '../../libs/app-common/circular-timeline.js';
import { initMixerMenu } from '../../libs/app-common/mixer-menu.js';
import { createPreferenceStorage, registerFactoryReset, setupThemeSync, setupMutePersistence } from '../../libs/app-common/preferences.js';
import { createRhythmLoopController } from '../../libs/app-common/loop-control.js';
import { createTapTempoHandler } from '../../libs/app-common/tap-tempo-handler.js';
import { initCircularTimelineToggle, initColorSelector, bindUnitsVisibility } from '../../libs/app-common/ui-helpers.js';
import { addRepeatPress } from '../../libs/app-common/spinner-repeat.js';
// Using local header controls for App1 (no shared init)

let audio;
const schedulingBridge = createSchedulingBridge({ getAudio: () => audio });
window.addEventListener('sharedui:scheduling', schedulingBridge.handleSchedulingEvent);
bindSharedSoundEvents({
  getAudio: () => audio,
  mapping: {
    baseSound: 'setBase',
    accentSound: 'setAccent',
    startSound: 'setStart'
  }
});
// Bind all DOM elements using new utilities
// Bind all DOM elements using app-specific utilities (App1 has all elements)
const { elements } = bindAppRhythmElements('app1');

// Resol la 3a incògnita de Lg/V = T/60 (model "els dos últims editats manen").
const solver = createFormulaSolver();

// Extract commonly used elements for backward compatibility
const { inputLg, inputV, inputT, inputTUp, inputTDown, inputVUp, inputVDown,
        inputLgUp, inputLgDown, unitLg, unitV, unitT,
        formula, timelineWrapper, timeline, playBtn, loopBtn, resetBtn,
        tapBtn, tapHelp, circularTimelineToggle, themeSelect, selectColor, baseSoundSelect,
        startSoundSelect, randomBtn, randomMenu, randLgToggle, randLgMin, randLgMax,
        randVToggle, randVMin, randVMax, randTToggle, randTMin, randTMax } = elements;

// Mute is handled by shared header (#muteBtn). Listen for events instead.

let pulses = [];

let isPlaying = false;
let loopEnabled = false;
let isUpdating = false;     // evita bucles de 'input' reentrants
let circularTimeline = false;
let tapResyncTimeout = null;

// Highlight controller for pulse visualization
const highlightController = createSimpleHighlightController({
  getPulses: () => pulses,
  getLoopEnabled: () => loopEnabled
});

// Visual sync manager (replaces visualSyncHandle and lastVisualStep)
const visualSync = createSimpleVisualSync({
  getAudio: () => audio,
  getIsPlaying: () => isPlaying,
  onStep: (step) => highlightController.highlightPulse(step)
});

// Timeline controller for circular/linear rendering
const timelineController = createCircularTimeline({
  timeline,
  timelineWrapper,
  getPulses: () => pulses,
  getNumberFontSize: (lg) => computeNumberFontRem(lg)
});

function cancelTapResync() {
  if (tapResyncTimeout != null) {
    clearTimeout(tapResyncTimeout);
    tapResyncTimeout = null;
  }
}

function scheduleTapResync(bpm) {
  cancelTapResync();
  if (!isPlaying || !audio || typeof audio.getVisualState !== 'function') return;

  const state = audio.getVisualState();
  const stepIndex = state && Number.isFinite(state.step) ? state.step : null;
  if (stepIndex == null) return;

  const lg = parseInt(inputLg.value, 10);
  const totalPulses = Number.isFinite(lg) && lg > 0
    ? toPlaybackPulseCount(lg, loopEnabled)
    : null;
  if (!Number.isFinite(totalPulses) || totalPulses <= 0) return;
  if (!Number.isFinite(bpm) || bpm <= 0) return;

  const resyncInfo = computeResyncDelay({ stepIndex, totalPulses, bpm });
  if (!resyncInfo || !Number.isFinite(resyncInfo.delaySeconds)) return;

  const delayMs = Math.max(0, resyncInfo.delaySeconds * 1000);
  tapResyncTimeout = setTimeout(() => {
    tapResyncTimeout = null;
    if (!isPlaying) return;
    Promise.resolve(startPlayback(audio)).catch(err => {
      console.warn('Tap resync failed', err);
    });
  }, delayMs);
}

const randomDefaults = {
  Lg: { enabled: true, range: [2, 30] },
  V: { enabled: true, range: [40, 320] },
  T: { enabled: true, range: [0.1, 20] }
};

const RANDOM_STORE_KEY = 'random';

function loadRandomConfig() {
  try {
    const raw = loadOpt(RANDOM_STORE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveRandomConfig(cfg) {
  try { saveOpt(RANDOM_STORE_KEY, JSON.stringify(cfg)); } catch {}
}

const randomConfig = mergeRandomConfig(randomDefaults, loadRandomConfig());

function applyRandomConfig(cfg) {
  randLgToggle.checked = cfg.Lg.enabled;
  randLgMin.value = cfg.Lg.range[0];
  randLgMax.value = cfg.Lg.range[1];
  randVToggle.checked = cfg.V.enabled;
  randVMin.value = cfg.V.range[0];
  randVMax.value = cfg.V.range[1];
  randTToggle.checked = cfg.T.enabled;
  randTMin.value = cfg.T.range[0];
  randTMax.value = cfg.T.range[1];
}

function updateRandomConfig() {
  randomConfig.Lg = {
    enabled: randLgToggle.checked,
    range: toRange(randLgMin.value, randLgMax.value, randomDefaults.Lg.range)
  };
  randomConfig.V = {
    enabled: randVToggle.checked,
    range: toRange(randVMin.value, randVMax.value, randomDefaults.V.range)
  };
  randomConfig.T = {
    enabled: randTToggle.checked,
    range: toRange(randTMin.value, randTMax.value, randomDefaults.T.range)
  };
  saveRandomConfig(randomConfig);
}

applyRandomConfig(randomConfig);

[
  randLgToggle, randLgMin, randLgMax,
  randVToggle, randVMin, randVMax,
  randTToggle, randTMin, randTMax
].forEach(el => el?.addEventListener('change', updateRandomConfig));

// Hovers for controls (els LEDs s'han eliminat: els tres camps són sempre
// editables i el tercer es deriva sol).
attachHover(playBtn, { text: 'Play / Stop' });
attachHover(loopBtn, { text: 'Loop' });
attachHover(tapBtn, { text: 'Tap Tempo' });
attachHover(resetBtn, { text: 'Reset App' });
attachHover(randomBtn, { text: 'Aleatorizar parámetros' });
attachHover(randLgToggle, { text: 'Aleatorizar Lg' });
attachHover(randLgMin, { text: 'Mínimo Lg' });
attachHover(randLgMax, { text: 'Máximo Lg' });
attachHover(randVToggle, { text: 'Aleatorizar V' });
attachHover(randVMin, { text: 'Mínimo V' });
attachHover(randVMax, { text: 'Máximo V' });
attachHover(randTToggle, { text: 'Aleatorizar T' });
attachHover(randTMin, { text: 'Mínimo T' });
attachHover(randTMax, { text: 'Máximo T' });

initRandomMenu(randomBtn, randomMenu, randomize);

// Create preference storage for App1
const preferenceStorage = createPreferenceStorage({ prefix: 'app1', separator: ':' });
const { load: loadOpt, save: saveOpt } = preferenceStorage;

// Register factory reset handler
registerFactoryReset({ storage: preferenceStorage });

// Setup theme synchronization
setupThemeSync({
  storage: preferenceStorage,
  selectEl: themeSelect,
  defaultValue: 'system'
});

// Setup mute persistence
setupMutePersistence({
  storage: preferenceStorage,
  getAudioInstance: async () => {
    if (!audio) await initAudio();
    return audio;
  }
});

// updateNumbers() removed - now handled by timelineController

// Initialize circular timeline toggle with shared helper
const circularTimelineHelper = initCircularTimelineToggle({
  toggle: circularTimelineToggle,
  storage: preferenceStorage,
  onToggle: (checked) => {
    circularTimeline = checked;
    animateTimelineCircle(loopEnabled && circularTimeline);
  }
});
circularTimeline = circularTimelineHelper.getState();

// Initialize color selector with shared helper
initColorSelector({
  selector: selectColor,
  storage: preferenceStorage
});

animateTimelineCircle(loopEnabled && circularTimeline);

// Create loop controller with shared component
const loopController = createRhythmLoopController({
  audio: () => audio, // H-03: getter lazy — l'engine neix al primer gest,
  loopBtn,
  state: {
    get loopEnabled() { return loopEnabled; },
    set loopEnabled(v) { loopEnabled = v; }
  },
  isPlaying: () => isPlaying,
  onToggle: (enabled) => {
    animateTimelineCircle(enabled && circularTimeline);
    // Update totalPulses when loop changes during playback
    if (isPlaying) {
      handleInput();
    }
  }
});
loopController.attach();

resetBtn.addEventListener('click', () => {
  cancelTapResync();
  sessionStorage.setItem('volumeResetFlag', 'true');
  window.location.reload();
});

// Create tap tempo handler with shared component
const tapTempoHandler = createTapTempoHandler({
  getAudioInstance: initAudio,
  tapBtn,
  tapHelp,
  onBpmDetected: (bpm) => {
    setValue(inputV, bpm);
    handleInput({ target: inputV });
    if (isPlaying) {
      scheduleTapResync(bpm);
    }
  }
});
tapTempoHandler.attach();

// Sound dropdowns initialized by header.js via initHeader()
// No need to initialize here - header.js handles baseSoundSelect and startSoundSelect

// Preview on sound change handled by shared header

// Create standardized audio initializer that avoids AudioContext warnings
const _baseInitAudio = createRhythmAudioInitializer({
  getSoundSelects: () => ({
    baseSoundSelect: elements.baseSoundSelect,
    startSoundSelect: elements.startSoundSelect
  }),
  schedulingBridge,
  channels: [] // App1 doesn't use accent channel
});

async function initAudio() {
  if (!audio) {
    audio = await _baseInitAudio();
    // Configuració canònica d'àudio (FX, canals); valors a CANONICAL_FX
    if (audio) {
      setupAudioDefaults(audio, { channels: CHANNEL_TIERS.RHYTHM_BASIC });
    }
    // Expose audio instance for sound dropdown preview
    if (typeof window !== 'undefined') window.__labAudio = audio;
  }
  return audio;
}

if (typeof window !== 'undefined') {
  window.__labInitAudio = initAudio;
}

// Mostrar unitats quan s'edita cada paràmetre (using shared helper)
const unitBindings = bindUnitsVisibility([
  { input: inputLg, unit: unitLg },
  { input: inputV, unit: unitV },
  { input: inputT, unit: unitT }
]);
unitBindings.attachAll();

[inputLg, inputV, inputT].forEach(el => el.addEventListener('input', handleInput));
updateFormula();

function setValue(input, value){
  isUpdating = true;
  input.value = String(value);
  isUpdating = false;
}

// parseNum and formatSec now imported from number-utils.js

function adjustT(delta){
  const current = parseNum(inputT.value);
  const base = isNaN(current) ? 0 : current;
  // Step scaling: <10 => 0.1, >=10 => 1
  const step = base < 10 ? 0.1 : 1;
  let next = base + delta * step;
  // Avoid FP errors: round to 1 decimal when using 0.1 steps
  if (step === 0.1) next = Math.round(next * 10) / 10;
  next = Math.max(0, next);
  setValue(inputT, next);
  inputT.dispatchEvent(new Event('input', { bubbles: true }));
}

addRepeatPress(inputTUp,   () => adjustT(1));
addRepeatPress(inputTDown, () => adjustT(-1));

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

// Inputs corresponents a cada clau de la fórmula.
const formulaInputs = { Lg: inputLg, V: inputV, T: inputT };

function handleInput(e){
  // tallafocs reentrància (evita re-entrar quan el solver escriu el valor derivat)
  if (isUpdating) return;

  // Registra quin camp s'acaba d'editar perquè el solver derivi el tercer
  // (model "els dos últims editats manen"). Els spinners disparen 'input'
  // amb e.target a l'input corresponent, igual que escriure.
  const id = e?.target?.id;
  if (id === 'inputLg') solver.touch('Lg');
  else if (id === 'inputV') solver.touch('V');
  else if (id === 'inputT') solver.touch('T');

  const result = solver.resolve({
    Lg: parseNum(inputLg.value),
    V:  parseNum(inputV.value),
    T:  parseNum(inputT.value)
  });
  if (result) setValue(formulaInputs[result.key], result.value);

  updateFormula();
  renderTimeline();
  // Si canvia Lg mentre està sonant, refresquem la selecció viva filtrant 0 i lg.
  // A-13: el push va col·lapsat (liveTransportPush) — abans cada tecla
  // empenyia transitòries al worklet (escrivint '240': bpm=2 → interval de
  // 30s; escrivint '16': totalPulses=1 → salt de posició). La V només
  // s'aplica dins de rang, com U-11 a App2.
  if (isPlaying && audio && typeof audio.updateTransport === 'function') {
    cancelTapResync();
    liveTransportPush.schedule();
  }
}

// A-13: cos del push en viu — llegeix l'estat FRESC en disparar-se
// (després de la finestra de 250ms, l'última tecla guanya).
const liveTransportPush = createLiveTransportPush({
  isLive: () => isPlaying && !!audio,
  apply: () => {
    if (typeof audio.updateTransport !== 'function') return;
    const lgNow = parseInt(inputLg.value);
    const vNow  = parseFloat(inputV.value);
    const validLg = Number.isFinite(lgNow) && lgNow > 0;
    const validV = Number.isFinite(vNow) && vNow >= 30 && vNow <= 240;
    if (!validLg && !validV) return;
    const playbackTotal = validLg ? toPlaybackPulseCount(lgNow, loopEnabled) : null;
    audio.updateTransport({
      align: 'nextPulse',
      totalPulses: playbackTotal != null ? playbackTotal : undefined,
      bpm: validV ? vNow : undefined
    });
  }
});

function updateFormula(){
  const tNum = parseNum(inputT.value);
  const tStr = isNaN(tNum)
    ? (inputT.value || 'T')
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

  attachHover(formula.querySelector('.top.lg'), { text: 'Pulsos' });
  attachHover(formula.querySelector('.bottom.v'), { text: 'PulsosPorMinuto' });
  attachHover(formula.querySelector('.top.t'), { text: 'segundos' });
  attachHover(formula.querySelector('.bottom:not(.v)'), { text: 'segundos' });
}


function renderTimeline(){
  // Disable transitions during render to prevent animation when changing inputs
  timeline.classList.add('no-anim');

  const lg = parseInt(inputLg.value);
  if(isNaN(lg) || lg <= 0) {
    timeline.innerHTML = '';
    pulses = [];
    timeline.classList.remove('no-anim');
    return;
  }

  const isCircular = loopEnabled && circularTimeline;
  pulses = timelineController.render(lg, { isCircular, silent: true });
  refreshTimelineNumbers(isCircular);

  // Re-enable transitions after render completes
  requestAnimationFrame(() => {
    timeline.classList.remove('no-anim');
  });
}

function animateTimelineCircle(isCircular, opts = {}){
  const silent = !!opts.silent;
  timelineController.setCircular(isCircular, { silent });
  // El canvi de mode (loop / circular) no passa per renderTimeline → refresquem
  // els números aquí també perquè el donut (circular) o la barra (lineal)
  // quedin ben etiquetats.
  refreshTimelineNumbers(isCircular);
}

// Números de la timeline segons el mode. Lineal: els genera circular-timeline.js
// (cal cridar updateNumbers amb `pulses` ja fresc, vegeu renderTimeline).
// Circular (loop): donut nuzic estil App17 via mòdul compartit — Lg punts
// (0..Lg-1; el Lg coincideix amb el 0 al cim). El rAF assegura que els nostres
// números s'escriuen DESPRÉS del rAF intern d'applyCircularLayout (que pintaria
// els seus propis números solapats) i així guanyen.
function refreshTimelineNumbers(isCircular){
  const lg = parseInt(inputLg.value);
  if (!Number.isFinite(lg) || lg <= 0) return;
  if (isCircular) {
    requestAnimationFrame(() => renderCircularRingNumbers(timeline, { count: lg }));
  } else {
    timelineController.updateNumbers();
    // L'últim pols (Lg) es mostra com un `·` (cycle-end), com la resta d'apps
    // nuzic: "tancament" de la seqüència; aquest pols ja no sona. El pols 0
    // manté el seu número.
    const last = timeline.querySelector(`.pulse-number[data-index="${lg}"]`);
    if (last) {
      last.textContent = '·';
      last.classList.add('cycle-end');
    }
  }
}

async function startPlayback(providedAudio) {
  const lg = parseInt(inputLg.value);
  const v = parseFloat(inputV.value);
  if (!Number.isFinite(lg) || !Number.isFinite(v) || lg <= 0 || v <= 0) {
    return false;
  }

  cancelTapResync();

  const audioInstance = providedAudio || await initAudio();
  if (!audioInstance) return false;

  const iconPlay = playBtn?.querySelector('.icon-play');
  const iconStop = playBtn?.querySelector('.icon-stop');

  visualSync.stop();
  audioInstance.stop();
  highlightController.clearHighlights();

  // Sound selection is already applied by initAudio() from dataset.value
  // and by bindSharedSoundEvents from sharedui:sound events
  // No need to override here

  const timing = fromLgAndTempo(lg, v);
  if (!timing || timing.interval == null) {
    return false;
  }
  const interval = timing.interval;
  const playbackTotal = toPlaybackPulseCount(lg, loopEnabled);
  if (playbackTotal == null) {
    return false;
  }
  const selectedForAudio = new Set();

  const onFinish = () => {
    isPlaying = false;
    playBtn.classList.remove('active');
    if (iconPlay) iconPlay.style.display = 'block';
    if (iconStop) iconStop.style.display = 'none';
    highlightController.clearHighlights();
    visualSync.stop();
    cancelTapResync();
    audioInstance.stop();
  };

  // onPulse: null — el highlight el porta només visualSync (RAF); amb callback
  // aquí el pols es pintava DUES vegades per step (doble esborrat + reflow)
  audioInstance.play(playbackTotal, interval, selectedForAudio, loopEnabled, null, onFinish);

  visualSync.syncVisualState();
  visualSync.start();

  isPlaying = true;
  playBtn.classList.add('active');
  if (iconPlay) iconPlay.style.display = 'none';
  if (iconStop) iconStop.style.display = 'block';

  return true;
}

playBtn.addEventListener('click', async () => {
  const audioInstance = await initAudio();
  const iconPlay = playBtn?.querySelector('.icon-play');
  const iconStop = playBtn?.querySelector('.icon-stop');

  if (isPlaying) {
    visualSync.stop();
    audioInstance.stop();
    isPlaying = false;
    cancelTapResync();
    playBtn.classList.remove('active');
    if (iconPlay) iconPlay.style.display = 'block';
    if (iconStop) iconStop.style.display = 'none';
    highlightController.clearHighlights();
    return;
  }

  await startPlayback(audioInstance);
});

// highlightPulse now handled by highlightController.highlightPulse()
// randomInt now imported from number-utils.js

function randomize() {
  if (randLgToggle?.checked) {
    const [lo, hi] = toRange(randLgMin.value, randLgMax.value, randomDefaults.Lg.range);
    const v = randomInt(lo, hi);
    setValue(inputLg, v);
    handleInput({ target: inputLg });
  }
  if (randVToggle?.checked) {
    const [lo, hi] = toRange(randVMin.value, randVMax.value, randomDefaults.V.range);
    const v = randomInt(lo, hi);
    setValue(inputV, v);
    handleInput({ target: inputV });
  }
  if (randTToggle?.checked) {
    const [lo, hi] = toRange(randTMin.value, randTMax.value, randomDefaults.T.range);
    const val = lo + Math.random() * Math.max(0, hi - lo);
    setValue(inputT, val.toFixed(2));
    handleInput({ target: inputT });
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

// Initialize mixer menu with long-press triggers
const mixerMenu = document.getElementById('mixerMenu');
if (mixerMenu && playBtn) {
  initMixerMenu({
    menu: mixerMenu,
    triggers: [playBtn, tapBtn].filter(Boolean),
    channels: [
      { id: 'pulse', label: 'Pulso', allowSolo: true },
      { id: 'master', label: 'Master', allowSolo: false, isMaster: true }
    ]
  });
}
