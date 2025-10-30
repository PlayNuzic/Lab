import { createRhythmAudioInitializer } from '../../libs/app-common/audio-init.js';
import { attachHover } from '../../libs/shared-ui/hover.js';
import { solidMenuBackground, computeNumberFontRem } from './utils.js';
import { initRandomMenu, mergeRandomConfig } from '../../libs/app-common/random-menu.js';
import { toRange, parseNum, formatSec, randomInt } from '../../libs/app-common/number-utils.js';
import { createSchedulingBridge, bindSharedSoundEvents } from '../../libs/app-common/audio.js';
import { fromLgAndTempo, toPlaybackPulseCount } from '../../libs/app-common/subdivision.js';
import { computeResyncDelay } from '../../libs/app-common/audio-schedule.js';
import { bindAppRhythmElements } from '../../libs/app-common/dom.js';
import { createRhythmLEDManagers, syncLEDsWithInputs } from '../../libs/app-common/led-manager.js';
import { createSimpleVisualSync } from '../../libs/app-common/visual-sync.js';
import { createSimpleHighlightController } from '../../libs/app-common/simple-highlight-controller.js';
import { createCircularTimeline } from '../../libs/app-common/circular-timeline.js';
import { initMixerMenu } from '../../libs/app-common/mixer-menu.js';
import { createPreferenceStorage, registerFactoryReset, setupThemeSync, setupMutePersistence } from '../../libs/app-common/preferences.js';
import { createRhythmLoopController } from '../../libs/app-common/loop-control.js';
import { createTapTempoHandler } from '../../libs/app-common/tap-tempo-handler.js';
import { initCircularTimelineToggle, initColorSelector, bindUnitsVisibility } from '../../libs/app-common/ui-helpers.js';
// Using local header controls for App1 (no shared init)
// TODO[audit]: incorporar helpers de subdivision comuns quan hi hagi cobertura de tests

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
const { elements, leds, ledHelpers } = bindAppRhythmElements('app1');

// Create LED managers for Lg, V, T parameters
const ledManagers = createRhythmLEDManagers(leds);

// Extract commonly used elements for backward compatibility
const { inputLg, inputV, inputT, inputTUp, inputTDown, inputVUp, inputVDown,
        inputLgUp, inputLgDown, ledLg, ledV, ledT, unitLg, unitV, unitT,
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
let autoTarget = null;               // 'Lg' | 'V' | 'T' | null
// Track manual selection recency (oldest -> newest among the two manual LEDs)
let manualHistory = [];
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

// Hovers for LEDs and controls
// LEDs ahora indican los campos editables; el apagado se recalcula
attachHover(ledLg, { text: 'Entrada manual de "Lg"' });
attachHover(ledV, { text: 'Entrada manual de "V"' });
attachHover(ledT, { text: 'Entrada manual de "T"' });
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

// Helper: current manual keys from DOM (those whose LED should be ON)
function getManualKeys(){
  const keys = [];
  if (inputLg.dataset.auto !== '1') keys.push('Lg');
  if (inputV.dataset.auto !== '1') keys.push('V');
  if (inputT.dataset.auto !== '1') keys.push('T');
  return keys;
}

// Keep manualHistory consistent with current DOM state while preserving existing order when possible
function syncManualHistory(){
  const manual = new Set(getManualKeys());
  // Keep only still-manual keys, preserving order
  manualHistory = manualHistory.filter(k => manual.has(k));
  // Add any missing manual keys at the end (treated as most-recent without better info)
  ['Lg','V','T'].forEach(k => { if (manual.has(k) && !manualHistory.includes(k)) manualHistory.push(k); });
  // Clamp to at most 2
  if (manualHistory.length > 2) manualHistory = manualHistory.slice(-2);
}

// New behavior: clicking a LED selects it as MANUAL. We always keep exactly 2 manuals; the other goes AUTO.
function setAuto(target) {
  // Ensure history reflects DOM before changing
  syncManualHistory();

  const inputs = { Lg: inputLg, V: inputV, T: inputT };
  const isManual = inputs[target].dataset.auto !== '1';

  // If target is already manual, just mark it as the latest selected (affects which one turns off next time)
  if (isManual) {
    manualHistory = manualHistory.filter(k => k !== target);
    manualHistory.push(target);
    updateAutoIndicator();
    return;
  }

  // Target is currently AUTO -> make it MANUAL, turning OFF the last turned-on manual to keep 2
  const currentManual = getManualKeys();
  if (currentManual.length === 0) {
    // Fallback: if something odd happened, choose an arbitrary other manual so we end with 2
    const other = ['Lg','V','T'].find(k => k !== target) || 'Lg';
    const autoKey = ['Lg','V','T'].find(k => k !== target && k !== other) || 'T';
    setAutoExact(autoKey, { recalc: true });
    manualHistory = [other, target];
    return;
  }
  if (currentManual.length === 1) {
    const otherManual = currentManual[0];
    const autoKey = ['Lg','V','T'].find(k => k !== otherManual && k !== target);
    setAutoExact(autoKey, { recalc: true });
    manualHistory = [otherManual, target];
    return;
  }
  // Normal case: 2 manuals present
  syncManualHistory();
  const toTurnOff = manualHistory.length ? manualHistory[manualHistory.length - 1] : currentManual[currentManual.length - 1];
  const otherManual = currentManual.find(k => k !== toTurnOff);
  // Set the one to turn off as AUTO; recalc so its value is derived
  setAutoExact(toTurnOff, { recalc: true });
  // Update manual recency: older stays, target becomes newest
  manualHistory = [otherManual, target];
}

// Set autoTarget explicitly (no toggle). Used when computing the 3rd value from 2 known.
function setAutoExact(target, opts = {}){
  const { recalc = false } = opts;
  autoTarget = target;
  delete inputLg.dataset.auto;
  delete inputV.dataset.auto;
  delete inputT.dataset.auto;
  if (autoTarget === 'Lg') inputLg.dataset.auto = '1';
  else if (autoTarget === 'V') inputV.dataset.auto = '1';
  else if (autoTarget === 'T') inputT.dataset.auto = '1';

  // Update LED managers to reflect auto state
  ledHelpers.setLedAuto('Lg', autoTarget === 'Lg');
  ledHelpers.setLedAuto('V', autoTarget === 'V');
  ledHelpers.setLedAuto('T', autoTarget === 'T');

  updateAutoIndicator();
  if (recalc) handleInput();
}

ledLg?.addEventListener('click', () => setAuto('Lg'));
ledV?.addEventListener('click', () => setAuto('V'));
ledT?.addEventListener('click', () => setAuto('T'));

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
  audio: { setLoop: (enabled) => audio?.setLoop?.(enabled) },
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
updateAutoIndicator();

const inputToLed = new Map([
  [inputLg, ledLg],
  [inputV, ledV],
  [inputT, ledT],
]);

const autoTip = document.createElement('div');
autoTip.className = 'hover-tip auto-tip-below';
autoTip.textContent = 'Introduce valores en los otros dos círculos, o selecciona este LED para editar el valor';
document.body.appendChild(autoTip);
let autoTipTimeout = null;

function showAutoTip(input){
  const rect = input.getBoundingClientRect();
  autoTip.style.left = rect.left + rect.width / 2 + 'px';
  // Show below the input (use bottom instead of top)
  autoTip.style.top = rect.bottom + window.scrollY + 'px';
  autoTip.classList.add('show');
  clearTimeout(autoTipTimeout);
  // Display twice as long as before
  autoTipTimeout = setTimeout(() => autoTip.classList.remove('show'), 4000);
}

function flashOtherLeds(excludeInput){
  const excludeLed = inputToLed.get(excludeInput);
  [ledLg, ledV, ledT].forEach(led => {
    if (led && led !== excludeLed) {
      led.classList.add('flash');
      setTimeout(() => led.classList.remove('flash'), 800);
    }
  });
}

[inputLg, inputV, inputT].forEach(input => {
  input.addEventListener('beforeinput', (e) => {
    if (input.dataset.auto === '1') {
      showAutoTip(input);
      flashOtherLeds(input);
      e.preventDefault();
    }
  });
});

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

// Guard: if LED is off (auto), show tip and do nothing
function guardManual(input){
  if (input?.dataset?.auto === '1'){
    showAutoTip(input);
    flashOtherLeds(input);
    return false;
  }
  return true;
}

// Long‑press auto‑repeat for spinner buttons
function addRepeatPress(el, fn, guardInput){
  if (!el) return;
  let t=null, r=null;
  const start = (ev) => {
    // When LED is off (auto), show help and do nothing
    if (guardInput && !guardManual(guardInput)) { ev.preventDefault(); return; }
    fn();
    t = setTimeout(() => { r = setInterval(fn, 80); }, 320);
    ev.preventDefault();
  };
  const stop = () => { clearTimeout(t); clearInterval(r); t=r=null; };
  el.addEventListener('mousedown', start);
  el.addEventListener('touchstart', start, { passive:false });
  ['mouseup','mouseleave','touchend','touchcancel'].forEach(ev=>el.addEventListener(ev, stop));
  // Also stop if released outside the button
  document.addEventListener('mouseup', stop);
  document.addEventListener('touchend', stop);
}

addRepeatPress(inputTUp,   () => adjustT(1),  inputT);
addRepeatPress(inputTDown, () => adjustT(-1), inputT);

// Unified spinner behavior for number inputs (V, Lg)
function stepAndDispatch(input, dir){
  if (!input) return;
  if (dir > 0) input.stepUp(); else input.stepDown();
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
addRepeatPress(inputVUp,   () => stepAndDispatch(inputV, +1),  inputV);
addRepeatPress(inputVDown, () => stepAndDispatch(inputV, -1),  inputV);
addRepeatPress(inputLgUp,  () => stepAndDispatch(inputLg, +1), inputLg);
addRepeatPress(inputLgDown,() => stepAndDispatch(inputLg, -1), inputLg);

function handleInput(e){
  const lg = parseNum(inputLg.value);
  const v  = parseNum(inputV.value);
  const t  = parseNum(inputT.value);
  const src = e && e.target ? e.target.id : '';

  // criteri de “valor informat” (mateix que tens ara)
  const hasLg = !isNaN(lg) && lg > 0;
  const hasV  = !isNaN(v)  && v  > 0;
  const hasT  = !isNaN(t)  && t  > 0;

  // tallafocs reentrància i marcatges auto/manual
  if (isUpdating) return;

  // comptem quants camps estan informats
  const knownCount = (hasLg ? 1 : 0) + (hasV ? 1 : 0) + (hasT ? 1 : 0);
  const twoKnown   = knownCount === 2;
  const threeKnown = knownCount === 3;

  // helpers (escriuen valor)
  const calcT = () => {
    if (!(hasLg && hasV)) return;
    const info = fromLgAndTempo(lg, v);
    if (!info || info.duration == null) return;
    const rounded = Math.round(info.duration * 100) / 100; // 2 decimals màxim
    setValue(inputT, rounded);                              // punt a l'input; la fórmula ja mostra coma
  };
  const calcV = () => {
    if (!(hasLg && hasT) || t === 0) return;
    const vBpm     = (lg * 60) / t;
    const vRounded = Math.round(vBpm * 100) / 100;
    setValue(inputV, vRounded);
  };
  const calcLg = () => {
    if (!(hasV && hasT)) return;
    const lgCount = (v * t) / 60;
    setValue(inputLg, Math.round(lgCount)); // Lg enter
  };

  // decisió
  if (twoKnown) {
    // sempre calcula la tercera que falta i fixa l'autoTarget a aquest camp
    if (!hasT) {
      calcT();
      if (autoTarget !== 'T') setAutoExact('T');
    }
    else if (!hasV) {
      calcV();
      if (autoTarget !== 'V') setAutoExact('V');
    }
    else if (!hasLg) {
      calcLg();
      if (autoTarget !== 'Lg') setAutoExact('Lg');
    }
  } else if (threeKnown && autoTarget) {
    if (autoTarget === 'T')      calcT();
    else if (autoTarget === 'V') calcV();
    else if (autoTarget === 'Lg')calcLg();
  }

  updateFormula();
  renderTimeline();
  updateAutoIndicator();
  // Si canvia Lg mentre està sonant, refresquem la selecció viva filtrant 0 i lg
  if (isPlaying && audio && typeof audio.updateTransport === 'function') {
    const lgNow = parseInt(inputLg.value);
    const vNow  = parseFloat(inputV.value);
    const validLg = Number.isFinite(lgNow) && lgNow > 0;
    const validV = Number.isFinite(vNow) && vNow > 0;
    if (validLg || validV) {
      const playbackTotal = validLg ? toPlaybackPulseCount(lgNow, loopEnabled) : null;
      audio.updateTransport({
        align: 'nextPulse',
        totalPulses: playbackTotal != null ? playbackTotal : undefined,
        bpm: validV ? vNow : undefined
      });
      cancelTapResync();
    }
  }
}

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

  pulses = timelineController.render(lg, {
    isCircular: loopEnabled && circularTimeline,
    silent: true
  });

  // Re-enable transitions after render completes
  requestAnimationFrame(() => {
    timeline.classList.remove('no-anim');
  });
}

function animateTimelineCircle(isCircular, opts = {}){
  const silent = !!opts.silent;
  timelineController.setCircular(isCircular, { silent });
}

// showNumber, removeNumber, updateNumbers now handled by timelineController

function updateAutoIndicator(){
  // Los LEDs encendidos son los campos editables; el apagado se recalcula
  // Using LED helpers for consistent state management
  ledHelpers.setLedActive('Lg', inputLg.dataset.auto !== '1');
  ledHelpers.setLedActive('V', inputV.dataset.auto !== '1');
  ledHelpers.setLedActive('T', inputT.dataset.auto !== '1');

  // Sync LED managers with input states
  syncLEDsWithInputs(ledManagers, elements);
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

  audioInstance.play(playbackTotal, interval, selectedForAudio, loopEnabled, (step) => highlightController.highlightPulse(step), onFinish);

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
