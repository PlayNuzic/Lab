import { createRhythmAudioInitializer } from '../../libs/app-common/audio-init.js';
import { attachHover } from '../../libs/shared-ui/hover.js';
import { computeHitSizePx, solidMenuBackground, computeNumberFontRem } from './utils.js';
import { initRandomMenu, mergeRandomConfig } from '../../libs/app-common/random-menu.js';
import { createSchedulingBridge, bindSharedSoundEvents } from '../../libs/app-common/audio.js';
import { toRange } from '../../libs/app-common/range.js';
import { fromLgAndTempo, toPlaybackPulseCount } from '../../libs/app-common/subdivision.js';
import { initMixerMenu } from '../../libs/app-common/mixer-menu.js';
import createPulseSeqController from '../../libs/app-common/pulse-seq.js';
import { bindAppRhythmElements } from '../../libs/app-common/dom.js';
import { createRhythmLEDManagers, syncLEDsWithInputs } from '../../libs/app-common/led-manager.js';
import { createPulseMemoryLoopController } from '../../libs/app-common/loop-control.js';
// Using local header controls for App2 (no shared init)

let audio;
let pendingMute = null;
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
// Bind all DOM elements using app-specific utilities (no warnings for missing elements)
const { elements, leds, ledHelpers } = bindAppRhythmElements('app2');

// Create LED managers for Lg, V, T parameters
const ledManagers = createRhythmLEDManagers(leds);

// State object for shared loop controller
const appState = {
  get loopEnabled() { return loopEnabled; },
  set loopEnabled(v) { loopEnabled = v; }
};

// Create shared loop controller with pulse memory integration
const loopController = createPulseMemoryLoopController({
  audio: { setLoop: (enabled) => audio?.setLoop?.(enabled) },
  loopBtn: elements.loopBtn,
  state: appState,
  ensurePulseMemory,
  getLg: () => parseInt(inputLg.value),
  isPlaying: () => isPlaying,
  onToggle: (enabled) => {
    // Rebuild visible selection from memory and refresh labels
    syncSelectedFromMemory();
    updateNumbers();
    if (isPlaying && typeof audio?.setSelected === 'function') {
      audio.setSelected(selectedForAudioFromState());
    }
    animateTimelineCircle(enabled && circularTimeline);
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
        circularTimelineToggle, randomBtn, randomMenu, randLgToggle, randLgMin,
        randLgMax, randVToggle, randVMin, randVMax, randPulsesToggle, randomCount,
        randTToggle, randTMin, randTMax, themeSelect, selectColor, baseSoundSelect,
        accentSoundSelect, startSoundSelect } = elements;

// Pulse sequence UI element (contenteditable div in template)
const pulseSeqEl = elements.pulseSeq;
const pulseSeqController = createPulseSeqController();
const pulseMemoryApi = pulseSeqController.memory;
let pulseMemory = pulseMemoryApi.data;
const { editEl: pulseSeqEditEl } = pulseSeqController.mount({ root: pulseSeqEl });
function getEditEl() {
  return pulseSeqController.getEditElement();
}
function getPulseSeqText() {
  return pulseSeqController.getText();
}
function setPulseSeqText(str) {
  pulseSeqController.setText(str);
}
function setPulseSeqSelection(start, end) {
  pulseSeqController.setSelectionRange(start, end);
}
function moveCaretToNearestMidpoint() {
  pulseSeqController.moveCaretToNearestMidpoint();
}
function moveCaretStep(dir) {
  pulseSeqController.moveCaretStep(dir);
}
// T indicator setup (App2-specific functionality)
const shouldRenderTIndicator = Boolean(inputT);
const tIndicator = shouldRenderTIndicator ? (() => {
  const indicator = document.createElement('div');
  indicator.id = 'tIndicator';
  // Start hidden to avoid flicker during first layout
  indicator.style.visibility = 'hidden';
  timeline.appendChild(indicator);
  return indicator;
})() : null;
const titleHeading = document.querySelector('header.top-bar h1');
let titleButton = null;
if (titleHeading) {
  titleButton = document.createElement('button');
  titleButton.type = 'button';
  titleButton.id = 'appTitleBtn';
  titleButton.className = 'top-bar-title-button';
  titleButton.textContent = titleHeading.textContent || '';
  titleHeading.textContent = '';
  titleHeading.appendChild(titleButton);
}

const randomDefaults = {
  Lg: { enabled: true, range: [2, 30] },
  V: { enabled: true, range: [40, 320] },
  T: { enabled: true, range: [0.1, 20] },
  Pulses: { enabled: true, count: '' }
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

/**
 * Apply stored random configuration values to the associated DOM controls.
 * @param {Record<string, any>} cfg
 */
function applyRandomConfig(cfg) {
  randLgToggle.checked = cfg.Lg.enabled;
  randLgMin.value = cfg.Lg.range[0];
  randLgMax.value = cfg.Lg.range[1];
  randVToggle.checked = cfg.V.enabled;
  randVMin.value = cfg.V.range[0];
  randVMax.value = cfg.V.range[1];
  if (cfg.T) {
    if (randTToggle) randTToggle.checked = cfg.T.enabled;
    if (randTMin) randTMin.value = cfg.T.range[0];
    if (randTMax) randTMax.value = cfg.T.range[1];
  }
  if (randPulsesToggle && randomCount) {
    randPulsesToggle.checked = cfg.Pulses.enabled;
    randomCount.value = cfg.Pulses.count ?? '';
  }
}

/**
 * Persist the current random menu configuration back to storage.
 */
function updateRandomConfig() {
  randomConfig.Lg = {
    enabled: randLgToggle.checked,
    range: toRange(randLgMin?.value, randLgMax?.value, randomDefaults.Lg.range)
  };
  randomConfig.V = {
    enabled: randVToggle.checked,
    range: toRange(randVMin?.value, randVMax?.value, randomDefaults.V.range)
  };
  const previousTRange = randomConfig.T?.range ?? randomDefaults.T.range;
  const previousTEnabled = randomConfig.T?.enabled ?? randomDefaults.T.enabled;
  randomConfig.T = {
    enabled: randTToggle ? randTToggle.checked : previousTEnabled,
    range: (randTMin && randTMax)
      ? toRange(randTMin?.value, randTMax?.value, previousTRange)
      : previousTRange
  };
  if (randPulsesToggle && randomCount) {
    randomConfig.Pulses = {
      enabled: randPulsesToggle.checked,
      count: randomCount.value
    };
  }
  saveRandomConfig(randomConfig);
}

applyRandomConfig(randomConfig);

[
  randLgToggle, randLgMin, randLgMax,
  randVToggle, randVMin, randVMax,
  randTToggle, randTMin, randTMax,
  randPulsesToggle, randomCount
].forEach(el => el?.addEventListener('change', updateRandomConfig));

// No actualitza la memòria a cada tecleig: es confirma amb Enter o blur
// pulseSeqEl?.addEventListener('input', handlePulseSeqInput);

let pulses = [];
// Hit targets (separate from the visual dots) and drag mode
let pulseHits = [];
// --- Selection memory across Lg changes ---
let pulseSeqRanges = {};

function ensurePulseMemory(size) {
  pulseMemoryApi.ensure(size);
}

// Clear all persistent pulse selection (memory beyond current Lg too)
function clearPersistentPulses(){
  pulseMemoryApi.clear();
  try { selectedPulses.clear(); } catch {}
  /* Keep UI consistent; will be rebuilt by subsequent calls */
  updatePulseSeqField();
}
// UI thresholds for number rendering
const NUMBER_HIDE_THRESHOLD = 100;   // from this Lg and above, hide numbers
const NUMBER_CIRCLE_OFFSET  = 34;    // px distance from circle to number label

// --- Selecció viva per a l'àudio (filtrada: sense 0 ni lg) ---
function selectedForAudioFromState() {
  const lg = parseInt(inputLg.value);
  const set = new Set();
  if (!isNaN(lg) && lg > 0) {
    for (let i = 1; i < lg && i < pulseMemory.length; i++) {
      if (pulseMemory[i]) set.add(i);
    }
  }
  return set;
}
const selectedPulses = new Set();
let isPlaying = false;
let loopEnabled = false;
let isUpdating = false;     // evita bucles de 'input' reentrants
let circularTimeline = false;
const T_INDICATOR_TRANSITION_DELAY = 650;
let tIndicatorRevealHandle = null;
let visualSyncHandle = null;
let lastVisualStep = null;
// Progress is now driven directly from audio callbacks
// Progress is now driven directly from audio callbacks

function updateTIndicatorText(value) {
  if (!tIndicator) return;
  // Only the number, no prefix
  if (value === '' || value == null) { tIndicator.textContent = ''; return; }
  const n = Number(value);
  if (!Number.isFinite(n)) { tIndicator.textContent = String(value); return; }
  // keep same rounding used for input T
  const rounded = Math.round(n * 10) / 10;
  tIndicator.textContent = String(rounded);
}

function updateTIndicatorPosition() {
  if (!timeline || !tIndicator) return false;
  const lg = parseInt(inputLg.value);
  if (isNaN(lg) || lg <= 0) { return false; }

  // Find the Lg label element and anchor 15px below it
  let anchor = timeline.querySelector(`.pulse-number[data-index="${lg}"]`);
  if (!anchor) anchor = timeline.querySelector('.pulse.lg');
  const tlRect = timeline.getBoundingClientRect();
  const circular = timeline.classList.contains('circular');

  if (!anchor) { return false; }

  const aRect = anchor.getBoundingClientRect();
  const isLabel = anchor.classList.contains('pulse-number');
  const offsetX = circular && isLabel ? -16 : 0; // compensate label shift in circle
  const centerX = aRect.left + aRect.width / 2 - tlRect.left + offsetX;
  const topY = aRect.bottom - tlRect.top + 15; // 15px separation below

  tIndicator.style.left = `${centerX}px`;
  tIndicator.style.top = `${topY}px`;
  tIndicator.style.transform = 'translate(-50%, 0)';

  if (tIndicator.parentNode !== timeline) timeline.appendChild(tIndicator);
  return true;
}
function scheduleTIndicatorReveal(delay = 0) {
  if (!tIndicator) return;
  if (tIndicatorRevealHandle) {
    clearTimeout(tIndicatorRevealHandle);
    tIndicatorRevealHandle = null;
  }

  const ms = Math.max(0, Number(delay) || 0);
  if (ms === 0) {
    requestAnimationFrame(() => {
      const anchored = updateTIndicatorPosition();
      tIndicator.style.visibility = anchored && tIndicator.textContent ? 'visible' : 'hidden';
    });
    return;
  }

  tIndicator.style.visibility = 'hidden';
  tIndicatorRevealHandle = setTimeout(() => {
    tIndicatorRevealHandle = null;
    requestAnimationFrame(() => {
      const anchored = updateTIndicatorPosition();
      tIndicator.style.visibility = anchored && tIndicator.textContent ? 'visible' : 'hidden';
    });
  }, ms);
}
const dragController = pulseSeqController.drag;
dragController.attach({
  timeline,
  resolveTarget: ({ target }) => {
    if (!target) return null;
    const hit = target.closest('.pulse-hit, .pulse');
    if (!hit) return null;
    const idx = Number.parseInt(hit.dataset?.index, 10);
    if (!Number.isFinite(idx)) return null;
    return { key: String(idx), index: idx };
  },
  applySelection: (info, shouldSelect) => {
    if (!info || !Number.isFinite(info.index)) return;
    setPulseSelected(info.index, shouldSelect);
  },
  isSelectionActive: (info) => {
    if (!info || !Number.isFinite(info.index)) return false;
    ensurePulseMemory(info.index);
    return !!pulseMemory[info.index];
  }
});
// Hovers for LEDs and controls
// LEDs ahora indican los campos editables; el apagado se recalcula
attachHover(ledLg, { text: 'Entrada manual de "Lg"' });
attachHover(ledV, { text: 'Entrada manual de "V"' });
attachHover(ledT, { text: 'Valor calculado de "T"' });
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
attachHover(randPulsesToggle, { text: 'Aleatorizar pulsos' });
attachHover(randomCount, { text: 'Cantidad de pulsos a seleccionar (vacío = aleatorio, 0 = ninguno)' });


const storeKey = (k) => `app2:${k}`;
const saveOpt = (k, v) => { try { localStorage.setItem(storeKey(k), v); } catch {} };
const loadOpt = (k) => { try { return localStorage.getItem(storeKey(k)); } catch { return null; } };

function clearStoredPreferences() {
  try {
    const prefix = 'app2:';
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) keysToRemove.push(key);
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));

    // Also clear shared sound preferences (no app prefix)
    ['baseSound', 'accentSound', 'startSound', 'cycleSound'].forEach(key => {
      try { localStorage.removeItem(key); } catch {}
    });
  } catch {}
}

let factoryResetPending = false;
window.addEventListener('sharedui:factoryreset', () => {
  if (factoryResetPending) return;
  factoryResetPending = true;
  clearStoredPreferences();
  window.location.reload();
});

// Local header behavior (as before)
function applyTheme(val){
  if(val === 'system'){
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.body.dataset.theme = dark ? 'dark' : 'light';
  } else {
    document.body.dataset.theme = val;
  }
  saveOpt('theme', val);
  // Notify shared listeners so dependent UI can refresh colors on the fly
  try { window.dispatchEvent(new CustomEvent('sharedui:theme', { detail: { value: document.body.dataset.theme, raw: val } })); } catch {}
}

const storedTheme = loadOpt('theme');
if (themeSelect) {
  if (storedTheme) themeSelect.value = storedTheme;
  applyTheme(themeSelect.value || 'system');
  themeSelect.addEventListener('change', e => applyTheme(e.target.value));
} else {
  applyTheme(storedTheme || 'system');
}

document.addEventListener('sharedui:mute', (e) => {
  const val = !!(e && e.detail && e.detail.value);
  saveOpt('mute', val ? '1' : '0');
  pendingMute = val;
  if (audio && typeof audio.setMute === 'function') {
    audio.setMute(val);
  }
});

// Restore previous mute preference on load
(() => {
  try{
    const saved = loadOpt('mute');
    if (saved === '1') document.getElementById('muteBtn')?.click();
  }catch{}
})();

const storedColor = loadOpt('color');
if (storedColor) {
  selectColor.value = storedColor;
  document.documentElement.style.setProperty('--selection-color', storedColor);
}
selectColor.addEventListener('input', e => {
  document.documentElement.style.setProperty('--selection-color', e.target.value);
  saveOpt('color', e.target.value);
});

updateNumbers();

circularTimelineToggle.checked = (() => {
  const stored = loadOpt('circular');
  return stored == null ? true : stored === '1';
})();
circularTimeline = circularTimelineToggle.checked;
updateTIndicatorPosition();
updateTIndicatorText(parseNum(inputT?.value ?? '') || '');
scheduleTIndicatorReveal(350);

circularTimelineToggle?.addEventListener('change', e => {
  circularTimeline = e.target.checked;
  saveOpt('circular', e.target.checked ? '1' : '0');
  animateTimelineCircle(loopEnabled && circularTimeline);
});
// Keep T indicator anchored on window resizes
window.addEventListener('resize', updateTIndicatorPosition);
animateTimelineCircle(loopEnabled && circularTimeline);

// Initialize loop controller with shared component
loopController.attach();

resetBtn.addEventListener('click', () => {
  pulseMemory = [];
  sessionStorage.setItem('volumeResetFlag', 'true');
  window.location.reload();
});

async function handleTapTempo() {
  try {
    const audioInstance = await initAudio();
    const result = audioInstance.tapTempo(performance.now());
    if (!result) return;

    if (result.remaining > 0) {
      tapHelp.textContent = result.remaining === 2 ? '2 clicks más' : '1 click más solamente';
      tapHelp.style.display = 'block';
      return;
    }

    tapHelp.style.display = 'none';
    if (Number.isFinite(result.bpm) && result.bpm > 0) {
      const bpm = Math.round(result.bpm * 100) / 100;
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
function randomInt(min, max) {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi < lo) return lo;
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

/**
 * Apply random values within the configured ranges and update inputs accordingly.
 */
function randomize() {
  if (randLgToggle?.checked) {
    const [lo, hi] = toRange(randLgMin?.value, randLgMax?.value, randomDefaults.Lg.range);
    const v = randomInt(lo, hi);
    setValue(inputLg, v);
    handleInput({ target: inputLg });
  }
  if (randVToggle?.checked) {
    const [lo, hi] = toRange(randVMin?.value, randVMax?.value, randomDefaults.V.range);
    const v = randomInt(lo, hi);
    setValue(inputV, v);
    handleInput({ target: inputV });
  }
  if (randPulsesToggle?.checked) {
    // Reset persistent selection memory so old pulses don't reappear when Lg grows
    clearPersistentPulses();
    const lg = parseInt(inputLg.value);
    if (!isNaN(lg) && lg > 0) {
      ensurePulseMemory(lg);
      const rawCount = typeof randomCount.value === 'string' ? randomCount.value.trim() : '';
      const available = [];
      for (let i = 1; i < lg; i++) available.push(i);
      const selected = new Set();
      if (rawCount === '') {
        const density = 0.5;
        available.forEach(i => { if (Math.random() < density) selected.add(i); });
      } else {
        const parsed = Number.parseInt(rawCount, 10);
        if (Number.isNaN(parsed)) {
          const density = 0.5;
          available.forEach(i => { if (Math.random() < density) selected.add(i); });
        } else if (parsed > 0) {
          const target = Math.min(parsed, available.length);
          while (selected.size < target) {
            const idx = available[Math.floor(Math.random() * available.length)];
            selected.add(idx);
          }
        }
        // For parsed <= 0, keep selection empty (0 pulses)
      }
      const seq = Array.from(selected).sort((a, b) => a - b);
      for (let i = 1; i < lg; i++) pulseMemory[i] = false;
      seq.forEach(i => { pulseMemory[i] = true; });
      syncSelectedFromMemory();
      updateNumbers();
      if (isPlaying && audio && typeof audio.setSelected === 'function') {
        audio.setSelected(selectedForAudioFromState());
      }
    }
  }
}

initRandomMenu(randomBtn, randomMenu, randomize);

// Sound dropdowns initialized by header.js via initHeader()
// No need to initialize here - header.js handles baseSoundSelect, accentSoundSelect, and startSoundSelect

// Preview on sound change handled by shared header

// Create standardized audio initializer that avoids AudioContext warnings
const _baseInitAudio = createRhythmAudioInitializer({
  getSoundSelects: () => ({
    baseSoundSelect: elements.baseSoundSelect,
    accentSoundSelect: elements.accentSoundSelect,
    startSoundSelect: elements.startSoundSelect
  }),
  schedulingBridge
});

async function initAudio() {
  if (!audio) {
    audio = await _baseInitAudio();
    if (pendingMute != null && typeof audio.setMute === 'function') {
      audio.setMute(pendingMute);
    }
    // Expose audio instance for sound dropdown preview
    if (typeof window !== 'undefined') window.__labAudio = audio;
  }
  return audio;
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

getEditEl()?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const res = sanitizePulseSeq({ causedBy: 'enter' });
    // Oculta el caret al confirmar excepto si hubo números > Lg
    if (!res || !res.hadTooBig) {
      try { getEditEl()?.blur(); } catch {}
    }
    return;
  }
  if (e.key === 'ArrowLeft' || e.key === 'Home') { e.preventDefault(); moveCaretStep(-1); return; }
  if (e.key === 'ArrowRight' || e.key === 'End') { e.preventDefault(); moveCaretStep(1); return; }
  // Allow only digits, navegación y espacio (para introducir varios pulsos)
  const allowed = new Set(['Backspace','Delete','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','Tab',' ']);
  if (!/^[0-9]$/.test(e.key) && !allowed.has(e.key)) {
    e.preventDefault();
    return;
  }
  if (e.key === 'Backspace') {
    // Borrar con una pulsación el número a la izquierda + un espacio
    e.preventDefault();
    const el = getEditEl(); if(!el) return; const node = el.firstChild || el; let text = node.textContent || '';
    const sel = window.getSelection && window.getSelection(); if(!sel||sel.rangeCount===0) return; const rng = sel.getRangeAt(0); if(!el.contains(rng.startContainer)) return;
    let pos = rng.startOffset; if(pos<=0 || text.length===0) return;
    // Si no estamos en midpoint, ajusta al más cercano (sin modificar texto)
    const mids = getMidpoints(text); if(mids.length){ let best=mids[0],d=Math.abs(pos-best); for(const m of mids){const dd=Math.abs(pos-m); if(dd<d){best=m; d=dd;}} pos=best; }
    // Buscamos el token a la izquierda del midpoint
    let i = pos-1; while(i>=0 && text[i]===' ') i--; if(i<0) return; // no hay número a la izquierda
    if(!(text[i]>='0' && text[i]<='9')) return;
    const endNum = i+1; let j=i; while(j>=0 && text[j]>='0' && text[j]<='9') j--; const startNum = j+1;
    // Construimos: izquierda hasta startNum + '  ' + derecha saltando el espacio derecho del midpoint
    const left = text.slice(0,startNum);
    const right = text.slice(pos+1); // saltar un espacio (el derecho del midpoint)
    const out = (left + '  ' + right);
    node.textContent = out;
    // Colocamos caret en el nuevo midpoint
    const caret = left.length + 1; // centro de '  '
    setPulseSeqSelection(caret, caret);
    return;
  }
  if (e.key === 'Delete') {
    // Borrar con una pulsación el número a la derecha + un espacio
    e.preventDefault();
    const el = getEditEl(); if(!el) return; const node = el.firstChild || el; let text = node.textContent || '';
    const sel = window.getSelection && window.getSelection(); if(!sel||sel.rangeCount===0) return; const rng = sel.getRangeAt(0); if(!el.contains(rng.startContainer)) return;
    let pos = rng.startOffset; if(pos>=text.length) return;
    // Ajusta al midpoint más cercano (sin cambiar texto)
    const mids = getMidpoints(text); if(mids.length){ let best=mids[0],d=Math.abs(pos-best); for(const m of mids){const dd=Math.abs(pos-m); if(dd<d){best=m; d=dd;}} pos=best; }
    // Buscar número a la derecha del midpoint
    let k = pos; while(k<text.length && text[k]===' ') k++;
    const isD=(c)=> c>='0'&&c<='9';
    if(k>=text.length || !isD(text[k])) return;
    let end=k; while(end<text.length && isD(text[end])) end++;
    // Espacios tras el número: saltar hasta 2 para no duplicar separadores
    let s=0; while(end+s<text.length && text[end+s]===' ') s++;
    const left = text.slice(0, pos-1); // elimina el espacio izquierdo del midpoint
    const right = text.slice(end + Math.min(s,2));
    node.textContent = left + '  ' + right;
    const caret = left.length + 1; setPulseSeqSelection(caret, caret);
    return;
  }
});
getEditEl()?.addEventListener('blur', () => sanitizePulseSeq({ causedBy: 'blur' }));
// Visual gap hint under caret (does not modify text)
getEditEl()?.addEventListener('mouseup', ()=> setTimeout(moveCaretToNearestMidpoint,0));
// (Sin manejador en keyup para evitar doble salto)
getEditEl()?.addEventListener('focus', ()=> setTimeout(()=>{
  const el = getEditEl(); if(!el) return;
  const node = el.firstChild || el; let text = node.textContent || '';
  if(text.length === 0){ text = '  '; node.textContent = text; }
  moveCaretToNearestMidpoint();
},0));

const inputToLed = new Map([
  [inputLg, ledLg],
  [inputV, ledV],
  [inputT, ledT],
]);

const autoTip = document.createElement('div');
autoTip.className = 'hover-tip auto-tip-below';
autoTip.textContent = 'Introduce valores en los otros dos círculos';
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

[inputLg, inputV, inputT].filter(Boolean).forEach(input => {
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

function formatInteger(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '';
  return Math.round(numeric).toLocaleString('ca-ES');
}

function formatNumberValue(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '';
  const rounded = Math.round(numeric * 100) / 100;
  return rounded.toLocaleString('ca-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

function formatBpmValue(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '';
  const rounded = Math.round(numeric * 10) / 10;
  return rounded.toLocaleString('ca-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1
  });
}

let titleInfoTipEl = null;

function ensureTitleInfoTip() {
  if (titleInfoTipEl) return titleInfoTipEl;
  const tip = document.createElement('div');
  tip.className = 'hover-tip auto-tip-below top-bar-info-tip';
  document.body.appendChild(tip);
  titleInfoTipEl = tip;
  return tip;
}

function hideTitleInfoTip() {
  if (titleInfoTipEl) {
    titleInfoTipEl.classList.remove('show');
  }
}

function showTitleInfoTip(contentFragment, anchor) {
  if (!anchor) return;
  const tip = ensureTitleInfoTip();
  if (contentFragment) {
    tip.replaceChildren(contentFragment);
  }
  const rect = anchor.getBoundingClientRect();
  tip.style.left = rect.left + rect.width / 2 + 'px';
  tip.style.top = rect.bottom + window.scrollY + 'px';
  tip.classList.add('show');
}

function buildTitleInfoContent() {
  const fragment = document.createDocumentFragment();

  const lgValue = parseNum(inputLg?.value ?? '');
  const hasLg = Number.isFinite(lgValue) && lgValue > 0;

  if (hasLg) {
    const lgLine = document.createElement('p');
    lgLine.className = 'top-bar-info-tip__line';
    const lgLabel = document.createElement('strong');
    lgLabel.textContent = 'Lg:';
    lgLine.append(lgLabel, ' ', formatInteger(lgValue));
    fragment.append(lgLine);
  } else {
    const hint = document.createElement('p');
    hint.className = 'top-bar-info-tip__hint';
    hint.textContent = 'Introduce una Lg mayor que 0 para activar los cálculos.';
    fragment.append(hint);
  }

  const tempoValue = parseNum(inputV?.value ?? '');
  const hasTempo = Number.isFinite(tempoValue) && tempoValue > 0;
  const tValue = parseNum(inputT?.value ?? '');
  const hasT = Number.isFinite(tValue) && tValue > 0;
  const derivedTFromTempo = hasLg && hasTempo ? (lgValue * 60) / tempoValue : null;
  const tempoFromT = hasLg && hasT ? (lgValue / tValue) * 60 : null;
  const effectiveTempo = hasTempo ? tempoValue : tempoFromT;
  const tForFormula = hasT ? tValue : derivedTFromTempo;

  if (effectiveTempo != null && hasLg && tForFormula != null) {
    const baseFormulaLine = document.createElement('p');
    baseFormulaLine.className = 'top-bar-info-tip__line';
    const baseLabel = document.createElement('strong');
    baseLabel.textContent = 'V base';
    baseFormulaLine.append(
      baseLabel,
      ` = (${formatInteger(lgValue)} / ${formatNumberValue(tForFormula)})·60 = ${formatBpmValue(effectiveTempo)} BPM`
    );
    fragment.append(baseFormulaLine);
  } else if (effectiveTempo != null) {
    const baseLine = document.createElement('p');
    baseLine.className = 'top-bar-info-tip__line';
    const baseLabel = document.createElement('strong');
    baseLabel.textContent = 'V base:';
    baseLine.append(baseLabel, ' ', `${formatBpmValue(effectiveTempo)} BPM`);
    fragment.append(baseLine);
  } else {
    const hint = document.createElement('p');
    hint.className = 'top-bar-info-tip__hint';
    hint.textContent = 'Completa V y Lg para calcular la velocidad base.';
    fragment.append(hint);
  }

  if (hasLg && hasTempo && derivedTFromTempo != null) {
    const tFormulaLine = document.createElement('p');
    tFormulaLine.className = 'top-bar-info-tip__line';
    const tFormulaLabel = document.createElement('strong');
    tFormulaLabel.textContent = 'T';
    tFormulaLine.append(
      tFormulaLabel,
      ` = (${formatInteger(lgValue)} / ${formatBpmValue(tempoValue)})·60 = ${formatNumberValue(derivedTFromTempo)} s`
    );
    fragment.append(tFormulaLine);
  } else if (hasT) {
    const tLine = document.createElement('p');
    tLine.className = 'top-bar-info-tip__line';
    const tLabel = document.createElement('strong');
    tLabel.textContent = 'T:';
    tLine.append(tLabel, ' ', `${formatNumberValue(tValue)} s`);
    fragment.append(tLine);
  }

  const selectedForAudio = selectedForAudioFromState();
  const selectedCount = selectedForAudio ? selectedForAudio.size : 0;
  const selectedLine = document.createElement('p');
  selectedLine.className = 'top-bar-info-tip__line';
  const selectedLabel = document.createElement('strong');
  selectedLabel.textContent = 'Pulsos seleccionados:';
  selectedLine.append(selectedLabel, ' ', formatInteger(selectedCount));
  fragment.append(selectedLine);

  if (selectedCount > 0) {
    const reminder = document.createElement('p');
    reminder.className = 'top-bar-info-tip__hint';
    reminder.textContent = 'Los pulsos seleccionados no incluyen los extremos 0 y Lg.';
    fragment.append(reminder);
  }

  return fragment;
}

if (titleButton) {
  titleButton.addEventListener('click', () => {
    const content = buildTitleInfoContent();
    if (!content) return;
    showTitleInfoTip(content, titleButton);
  });
  titleButton.addEventListener('blur', hideTitleInfoTip);
  titleButton.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' || event.key === 'Esc') {
      hideTitleInfoTip();
    }
  });
  window.addEventListener('scroll', hideTitleInfoTip, { passive: true });
  window.addEventListener('resize', hideTitleInfoTip);
}
function formatSec(n){
  // arrodonim a 2 decimals però sense forçar-los si són .00
  const rounded = Math.round(Number(n) * 100) / 100;
  return rounded.toLocaleString('ca-ES', {
     minimumFractionDigits: 0,
     maximumFractionDigits: 2
   });
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

function sanitizePulseSeq(opts = {}){
  if (!pulseSeqEl) return;
  const lg = parseInt(inputLg.value);
  // Guarda posición del caret antes de normalizar
  const caretBefore = (()=>{ const el=getEditEl(); if(!el) return 0; const s=window.getSelection&&window.getSelection(); if(!s||s.rangeCount===0) return 0; const r=s.getRangeAt(0); if(!el.contains(r.startContainer)) return 0; return r.startOffset; })();
  const text = getPulseSeqText();
  const matches = text.match(/\d+/g) || [];
  const seen = new Set();
  const nums = [];
  let hadTooBig = false;
  let firstTooBig = null;
  for (const m of matches) {
    const n = parseInt(m, 10);
    if (n > 0 && !seen.has(n)) {
      if (!isNaN(lg) && n >= lg) { hadTooBig = true; if(firstTooBig===null) firstTooBig=n; continue; }
      seen.add(n);
      nums.push(n);
    }
  }
  if (!isNaN(lg)) ensurePulseMemory(lg);
  nums.sort((a,b) => a - b);
  const joined = (isNaN(lg) ? nums : nums.filter(n => n < lg)).join('  ');
  const out = '  ' + joined + '  ';
  setPulseSeqText(out);
  if (!isNaN(lg)) {
    for (let i = 1; i < lg; i++) pulseMemory[i] = false;
    nums.forEach(n => { if (n < lg) pulseMemory[n] = true; });
    syncSelectedFromMemory();
    updateNumbers();
  }
  // Restaurar caret en una posición segura (entre espacios dobles)
  // - Si hubo números > Lg o es tecleo normal, recolocamos el caret
  // - Además, lo ajustamos explícitamente al midpoint más cercano para que no quede pegado a un número
  const pos = Math.min(out.length, caretBefore);
  if (hadTooBig || !(opts.causedBy === 'enter' || opts.causedBy === 'blur')) {
    setPulseSeqSelection(pos, pos);
    // Asegura separación: salta al midpoint más cercano tras normalizar
    try { moveCaretToNearestMidpoint(); } catch {}
  }
  // Mensaje temporal si hubo números mayores que Lg
  if (hadTooBig && !isNaN(lg)) {
    try{
      const el = getEditEl();
      const tip = document.createElement('div');
      tip.className = 'hover-tip auto-tip-below';
      const bad = firstTooBig != null ? firstTooBig : '';
      tip.innerHTML = `El número <strong>${bad}</strong> introducido es mayor que la <span style=\"color: var(--color-lg); font-weight: 700;\">Lg</span>. Elige un número menor que <strong>${lg}</strong>`;
      document.body.appendChild(tip);
      let rect = null;
      const sel = window.getSelection && window.getSelection();
      if(sel && sel.rangeCount){
        const r = sel.getRangeAt(0).cloneRange();
        if(el && el.contains(r.startContainer)){
          r.collapse(false);
          rect = r.getBoundingClientRect();
        }
      }
      if(!rect) rect = el.getBoundingClientRect();
      tip.style.left = rect.left + 'px';
      tip.style.top = (rect.bottom + window.scrollY) + 'px';
      tip.style.fontSize = '0.95rem';
      tip.style.fontSize = '0.95rem';
      tip.classList.add('show');
      setTimeout(()=>{ tip.classList.remove('show'); try{ document.body.removeChild(tip);}catch{} }, 3000);
    }catch{}
  }
  return { hadTooBig };
}

function handleInput(){
  const lg = parseNum(inputLg.value);
  const v  = parseNum(inputV.value);
  const hasLg = !isNaN(lg) && lg > 0;
  const hasV  = !isNaN(v)  && v  > 0;

  if (isUpdating) return;

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
  updateTIndicatorText(indicatorValue);

  // Ensure memory capacity always (preserve selections when Lg crece manualmente)
  if (hasLg) {
    ensurePulseMemory(lg);
  }

  updateFormula();
  renderTimeline();
  updatePulseSeqField();
  updateAutoIndicator();

  if (isPlaying && audio) {
    const lgNow = parseInt(inputLg.value);
    const vNow  = parseFloat(inputV.value);
    if (typeof audio.setSelected === 'function') {
      audio.setSelected(selectedForAudioFromState());
    }
    const validLg = Number.isFinite(lgNow) && lgNow > 0;
    const validV = Number.isFinite(vNow) && vNow > 0;
    if (typeof audio.updateTransport === 'function' && (validLg || validV)) {
      const playbackTotal = validLg ? toPlaybackPulseCount(lgNow, loopEnabled) : null;
      audio.updateTransport({
        align: 'nextPulse',
        totalPulses: playbackTotal != null ? playbackTotal : undefined,
        bpm: validV ? vNow : undefined
      });
    }
  }
}

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

  attachHover(formula.querySelector('.top.lg'), { text: 'Pulsos' });
  attachHover(formula.querySelector('.bottom.v'), { text: 'PulsosPorMinuto' });
  attachHover(formula.querySelector('.top.t'), { text: 'segundos' });
  attachHover(formula.querySelector('.bottom:not(.v)'), { text: 'segundos' });
}

function updatePulseSeqField(){
  if(!pulseSeqEl) return;
  const lg = parseInt(inputLg.value);
  if(isNaN(lg) || lg <= 0){
    setPulseSeqText('');
    try{ const s = pulseSeqEl.querySelector('.pz.lg'); if (s) s.textContent=''; }catch{}
    pulseSeqRanges = {};
    return;
  }
  try{ const s = pulseSeqEl.querySelector('.pz.lg'); if (s) s.textContent=String(lg); }catch{}
  const arr = [];
  const limit = Math.min(pulseMemory.length, lg);
  for(let i = 1; i < limit; i++){
    if(pulseMemory[i]) arr.push(i);
  }
  arr.sort((a,b) => a - b);
  pulseSeqRanges = {};
  let pos = 0;
  const parts = arr.map(num => {
    const str = String(num);
    pulseSeqRanges[num] = [pos + 2, pos + 2 + str.length];
    pos += str.length + 2; // acumulado interno; offset global de 2 al inicio
    return str;
  });
  // añade dos espacios al inicio y al final para tener midpoints en extremos
  setPulseSeqText((parts.length? '  ' : '  ') + parts.join('  ') + (parts.length? '  ' : '  '));
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
  pulses.forEach((p, idx) => {
    if (!p) return;
    p.classList.toggle('selected', selectedPulses.has(idx));
  });
  updatePulseSeqField();
}

function handlePulseSeqInput(){
  const lg = parseInt(inputLg.value);
  if (isNaN(lg) || lg <= 0) {
    pulseMemory = [];
    renderTimeline();
    updateNumbers();
    return;
  }
  ensurePulseMemory(lg);
  for(let i = 1; i < lg; i++) pulseMemory[i] = false;
  const nums = getPulseSeqText().trim().split(/\s+/)
    .map(n => parseInt(n,10))
    .filter(n => !isNaN(n) && n > 0 && n < lg);
  nums.sort((a,b) => a - b);
  nums.forEach(n => { pulseMemory[n] = true; });
  setPulseSeqText(nums.join(' '));
  renderTimeline();
  updateNumbers();
  if (isPlaying && audio && typeof audio.setSelected === 'function') {
    audio.setSelected(selectedForAudioFromState());
  }
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

  syncSelectedFromMemory();
  updateNumbers();

  if (isPlaying && audio) {
    if (typeof audio.setSelected === 'function') {
      // Àudio sempre sense 0/Lg
      audio.setSelected(selectedForAudioFromState());
    }
    if (typeof audio.setLoop === 'function') {
      audio.setLoop(loopEnabled);
    }
  }

  animateTimelineCircle(loopEnabled && circularTimeline);
}

function renderTimeline(){
  timeline.innerHTML = '';
  pulses = [];
  pulseHits = [];
  const lg = parseInt(inputLg.value);
  if(isNaN(lg) || lg <= 0) return;
  ensurePulseMemory(lg);

  for (let i = 0; i <= lg; i++) {
    const p = document.createElement('div');
    p.className = 'pulse';
    if (i === 0) p.classList.add('zero');
    else if (i === lg) p.classList.add('lg');
    p.dataset.index = i;
    // No listeners here: handled by hit targets
    timeline.appendChild(p);
    pulses.push(p);

    // barres verticals extrems (0 i Lg)
    if (i === 0 || i === lg) {
      const bar = document.createElement('div');
      bar.className = 'bar';
      timeline.appendChild(bar);
    }

    // Click/drag hit target (bigger than the visual dot)
    const hit = document.createElement('div');
    hit.className = 'pulse-hit';
    hit.dataset.index = i;
    hit.style.position = 'absolute';
    hit.style.borderRadius = '50%';
    hit.style.background = 'transparent';
    hit.style.zIndex = '6'; // above pulses and bars

    const hitSize = computeHitSizePx(lg);
    hit.style.width = hitSize + 'px';
    hit.style.height = hitSize + 'px';

    if (i === 0 || i === lg) {
      // Extrems no interactius
      hit.style.pointerEvents = 'none';
      hit.style.cursor = 'default';
    } else {
      hit.style.pointerEvents = 'auto';
      hit.style.cursor = 'pointer';
      // listeners on the hit target
      hit.addEventListener('click', (ev) => {
        if (dragController.consumeSuppressClick(String(i))) {
          ev.preventDefault();
          ev.stopPropagation();
          return; // already applied on pointerdown
        }
        togglePulse(i);
      });
      hit.addEventListener('pointerenter', () => {
        dragController.handleEnter({ key: String(i), index: i });
      });
    }

    timeline.appendChild(hit);
    pulseHits.push(hit);
  }
  syncSelectedFromMemory();
  animateTimelineCircle(loopEnabled && circularTimeline, { silent: true });
  updateTIndicatorPosition();
}

function togglePulse(i){
  const lg = parseInt(inputLg.value);
  if (isNaN(lg)) return;

  if (i === 0 || i === lg) {
    // Extrems no interactius
    return;
  }
  setPulseSelected(i, !pulseMemory[i]);
}

function animateTimelineCircle(isCircular, opts = {}){
  const silent = !!opts.silent;
  const desiredCircular = !!isCircular;
  const wasCircular = timeline.classList.contains('circular');
  const delay = (!silent && wasCircular !== desiredCircular) ? T_INDICATOR_TRANSITION_DELAY : 0;
  scheduleTIndicatorReveal(delay);

  const lg = pulses.length - 1;
  const bars = timeline.querySelectorAll('.bar');
  if (lg <= 0) return;
  if (desiredCircular) {
    timelineWrapper.classList.add('circular');
    timeline.classList.add('circular');
    if (silent) timeline.classList.add('no-anim');
    // Guia circular: ANCORADA al centre del WRAPPER per evitar desplaçaments
    const wrapper = timeline.closest('.timeline-wrapper') || timeline.parentElement || timeline;
    let guide = document.querySelector('.circle-guide');
    if (!guide) {
      guide = document.createElement('div');
      guide.className = 'circle-guide';
      // estils mínims inline (per si el CSS no ha carregat)
      guide.style.position = 'fixed';
      guide.style.border = '2px solid var(--timeline-line, #EDE6D3)';
      guide.style.borderRadius = '50%';
      guide.style.pointerEvents = 'none';
      guide.style.transition = 'opacity 300ms ease';
      guide.style.opacity = '0';
      guide.style.zIndex = '0';
      document.body.appendChild(guide);
    }

    // Recol·loca un cop aplicades les classes circulars
    requestAnimationFrame(() => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const gcx = vw / 2;
      const gcy = vh / 2;
      // Size similar to timeline circle but safe even before layout settles
      const tRect = timeline.getBoundingClientRect();
      const baseSize = Math.min(
        Math.min(vw, vh) * 0.6,
        Math.max(tRect.width, 320),
        Math.max(tRect.height, 320)
      );
      const gRadius = baseSize / 2 - 10;
      guide.style.left = gcx + 'px';
      guide.style.top = gcy + 'px';
      guide.style.width = (gRadius * 2) + 'px';
      guide.style.height = (gRadius * 2) + 'px';
      guide.style.transform = 'translate(-50%, -50%)';
      guide.style.opacity = '0'; // keep invisible; used only as a positioning helper

      // Geometria basada en el TIMELINE (anella real) perquè els polsos intersequin la línia
      const tRect2 = timeline.getBoundingClientRect();
      const cx = tRect2.width / 2;
      const cy = tRect2.height / 2;
      const radius = Math.min(tRect2.width, tRect2.height) / 2 - 1; // centre del pols gairebé sobre la línia (border=2)

      // Polsos sobre la línia del cercle
      pulses.forEach((p, i) => {
        const angle = (i / lg) * 2 * Math.PI + Math.PI / 2;
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);
        p.style.left = x + 'px';
        p.style.top = y + 'px';
        p.style.transform = 'translate(-50%, -50%)';
      });

      // Position hit targets over the pulse centers
      pulseHits.forEach((h, i) => {
        const angle = (i / lg) * 2 * Math.PI + Math.PI / 2;
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);
        h.style.left = x + 'px';
        h.style.top = y + 'px';
        h.style.transform = 'translate(-50%, -50%)';
      });

      // Barres 0/Lg: llargada més curta i centrada en la circumferència
      bars.forEach((bar, idx) => {
        const step = (idx === 0) ? 0 : lg;
        const angle = (step / lg) * 2 * Math.PI + Math.PI / 2;
        const bx = cx + radius * Math.cos(angle);
        const by = cy + radius * Math.sin(angle);

        // CORREGIDO: Barra más corta (25% en lugar de 50%) y centrada
        const barLen = Math.min(tRect2.width, tRect2.height) * 0.25;
        const intersectPx = barLen / 2; // La mitad intersecta hacia dentro

        // Centra la barra: mitad hacia fuera, mitad hacia dentro
        const topPx = by - intersectPx;

        bar.style.display = 'block';
        // ample de .bar = 2px -> resta 1px per centrar sense translate
        bar.style.left = (bx - 1) + 'px';
        bar.style.top = topPx + 'px';
        bar.style.height = barLen + 'px';
        bar.style.transformOrigin = '50% 50%'; // CORREGIDO: centrada
        // Només rotate; res de translate/scale per no desancorar la base
        bar.style.transform = 'rotate(' + (angle + Math.PI/2) + 'rad)';
      });

      syncSelectedFromMemory();
      updateNumbers();
      // Apaga la guia circular un cop dibuixada l'anella real (evita doble cercle en mode fosc)
      if (!silent) {
        setTimeout(() => {
          if (guide && wrapper.contains(guide)) {
            guide.style.opacity = '0';
          }
        }, 400);
      }
      if (silent) {
        // força reflow per aplicar els estils sense transicions i neteja la flag
        void timeline.offsetHeight;
        timeline.classList.remove('no-anim');
      }
    });
  } else {
    timelineWrapper.classList.remove('circular');
    timeline.classList.remove('circular');
    // Oculta la guia circular (fade-out)
    const wrapper = timeline.closest('.timeline-wrapper') || timeline.parentElement || timeline;
    const guide = document.querySelector('.circle-guide');
    if (guide) guide.style.opacity = '0';
    pulses.forEach((p, i) => {
      const percent = (i / lg) * 100;
      p.style.left = percent + '%';
      p.style.top = '50%';
      p.style.transform = 'translate(-50%, -50%)';
    });
    pulseHits.forEach((h, i) => {
      const percent = (i / lg) * 100;
      h.style.left = percent + '%';
      h.style.top = '50%';
      h.style.transform = 'translate(-50%, -50%)';
    });
    bars.forEach((bar, idx) => {
      bar.style.display = 'block';
      const i = idx === 0 ? 0 : lg;
      const percent = (i / lg) * 100;
      bar.style.left = percent + '%';
      bar.style.top = '10%';
      bar.style.height = '80%';
      bar.style.transform = '';
      bar.style.transformOrigin = '';
    });
    syncSelectedFromMemory();
    updateNumbers();
  }
}

function showNumber(i, options = {}){
  const { selected = false } = options;
  const n = document.createElement('div');
  n.className = 'pulse-number';
  if (i === 0) n.classList.add('zero');
  const lg = pulses.length - 1;
  if (i === lg) n.classList.add('lg');
  if (selected && i !== 0 && i !== lg) {
    n.classList.add('selected');
  }
  n.dataset.index = i;
  n.textContent = i;
  const _lgForFont = pulses.length - 1;
  const fontRem = computeNumberFontRem(_lgForFont);
  n.style.fontSize = fontRem + 'rem';

   if (timeline.classList.contains('circular')) {
     const rect = timeline.getBoundingClientRect();
     const radius = Math.min(rect.width, rect.height) / 2 - 10;
     const offset = NUMBER_CIRCLE_OFFSET;
     const cx = rect.width / 2;
     const cy = rect.height / 2;
     const angle = (i / lg) * 2 * Math.PI + Math.PI / 2;
     const x = cx + (radius + offset) * Math.cos(angle);
     let y = cy + (radius + offset) * Math.sin(angle);

     const xShift = (i === 0) ? -16 : (i === lg ? 16 : 0); // 0 a l'esquerra, Lg a la dreta
     n.style.left = (x + xShift) + 'px';
     n.style.transform = 'translate(-50%, -50%)';

     if (i === 0 || i === lg) {
       // No fem cap forçat de verticalitat; deixem que el CSS determini l'estil
       n.style.top = (y + 8) + 'px';
       n.style.zIndex = (i === 0) ? '3' : '2';
     } else {
       n.style.top = y + 'px';
     }

  } else {
    const percent = (i / (pulses.length - 1)) * 100;
    n.style.left = percent + '%';
  }

  timeline.appendChild(n);
}

function removeNumber(i){
  const el = timeline.querySelector(`.pulse-number[data-index="${i}"]`);
  if(el) el.remove();
}

function updateNumbers(){
  document.querySelectorAll('.pulse-number').forEach(n => n.remove());
  if (pulses.length === 0) return;

  const lgForNumbers = pulses.length - 1;
  const tooDense = lgForNumbers >= NUMBER_HIDE_THRESHOLD;
  if (tooDense) {
    try { updateTIndicatorPosition(); } catch {}
    return;
  }

  for (let i = 0; i <= lgForNumbers; i++) {
    const isEndpoint = i === 0 || i === lgForNumbers;
    const isSelected = !isEndpoint && selectedPulses.has(i);
    showNumber(i, { selected: isSelected });
  }
  // Re-anchor T to the (possibly) re-generated Lg label
  try { updateTIndicatorPosition(); } catch {}
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
  pulses.forEach(p => p.classList.remove('active'));
  stopVisualSync();
  if (audioInstance && typeof audioInstance.stop === 'function') {
    try { audioInstance.stop(); } catch {}
  }
  const ed = getEditEl();
  if (ed) {
    ed.classList.remove('playing');
    try { ed.blur(); } catch {}
    try {
      const sel = window.getSelection && window.getSelection();
      sel && sel.removeAllRanges && sel.removeAllRanges();
    } catch {}
  }
  pulseSeqController.clearActive();
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
  pulses.forEach(p => p.classList.remove('active'));

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
  const selectedForAudio = selectedForAudioFromState();
  const iconPlay = playBtn?.querySelector('.icon-play');
  const iconStop = playBtn?.querySelector('.icon-stop');

  const onFinish = () => {
    handlePlaybackStop(audioInstance);
  };

  audioInstance.play(playbackTotal, interval, selectedForAudio, loopEnabled, highlightPulse, onFinish);

  syncVisualState();
  startVisualSync();

  isPlaying = true;
  playBtn?.classList.add('active');
  if (iconPlay) iconPlay.style.display = 'none';
  if (iconStop) iconStop.style.display = 'block';
  const ed = getEditEl();
  if (ed) {
    ed.classList.add('playing');
    try { ed.blur(); } catch {}
  }

  return true;
}

function syncTimelineScroll(){
  if (!pulseSeqEl || !timelineWrapper) return;
  const maxSeq = pulseSeqEl.scrollWidth - pulseSeqEl.clientWidth;
  const maxTl = timelineWrapper.scrollWidth - timelineWrapper.clientWidth;
  if (maxSeq <= 0) return;
  const ratio = pulseSeqEl.scrollLeft / maxSeq;
  timelineWrapper.scrollLeft = maxTl * ratio;
}

playBtn.addEventListener('click', async () => {
  try {
    const audioInstance = await initAudio();
    if (!audioInstance) return;

    if (isPlaying) {
      handlePlaybackStop(audioInstance);
      return;
    }

    await startPlayback(audioInstance);
  } catch {}
});

function getPulseSeqRect(index) {
  if (!pulseSeqEl || !Number.isFinite(index)) return null;
  const idx = Math.round(index);
  if (idx === 0) {
    const zero = pulseSeqEl.querySelector('.pz.zero');
    return zero ? zero.getBoundingClientRect() : null;
  }
  if (pulses && idx === pulses.length - 1) {
    const lgEl = pulseSeqEl.querySelector('.pz.lg');
    return lgEl ? lgEl.getBoundingClientRect() : null;
  }
  const range = pulseSeqRanges[idx];
  if (range && Array.isArray(range)) {
    const edit = getEditEl();
    const node = edit && edit.firstChild;
    if (node) {
      try {
        const r = document.createRange();
        const start = Math.max(0, Number(range[0]) || 0);
        const end = Math.max(start, Number(range[1]) || start);
        r.setStart(node, start);
        r.setEnd(node, end);
        return r.getBoundingClientRect();
      } catch {}
    }
  }
  return null;
}

pulseSeqController.setRectResolver(getPulseSeqRect);

function highlightPulse(i){
  // Si no està en reproducció, no tornem a canviar seleccions ni highlights
  if (!isPlaying) return;

  // esborra il·luminació anterior
  pulses.forEach(p => p.classList.remove('active'));

  if (!pulses || pulses.length === 0) return;

  // il·lumina el pols actual
  const idx = i % pulses.length;
  const current = pulses[idx];
  if (current) {
    // Força un reflow perquè l'animació es reiniciï encara que es repeteixi el mateix pols
    void current.offsetWidth;
    current.classList.add('active');
  }

  // si hi ha loop i som al primer pols, també il·lumina l’últim
  if (loopEnabled && idx === 0) {
    const last = pulses[pulses.length - 1];
    if (last) last.classList.add('active');
  }
  if (pulseSeqEl) {
    const rect = getPulseSeqRect(idx);
    let newScrollLeft = pulseSeqEl.scrollLeft;
    if (rect) {
      const parentRect = pulseSeqEl.getBoundingClientRect();
      const absLeft = rect.left - parentRect.left + pulseSeqEl.scrollLeft;
      const target = absLeft - (pulseSeqEl.clientWidth - rect.width) / 2;
      const maxScroll = pulseSeqEl.scrollWidth - pulseSeqEl.clientWidth;
      newScrollLeft = Math.max(0, Math.min(target, maxScroll));
      pulseSeqEl.scrollLeft = newScrollLeft;
      if (typeof syncTimelineScroll === 'function') syncTimelineScroll();
    }

    let trailingIndex = null;
    let trailingRect = null;
    if (idx === 0 && loopEnabled) {
      trailingIndex = pulses.length - 1;
      trailingRect = getPulseSeqRect(trailingIndex);
    }

    if (rect) {
      pulseSeqController.setActiveIndex(idx, {
        rect,
        trailingIndex,
        trailingRect,
        scrollLeft: newScrollLeft
      });
    } else {
      pulseSeqController.clearActive();
    }
  }

  if (Number.isFinite(i)) {
    lastVisualStep = Number(i);
  }
}

function stopVisualSync() {
  if (visualSyncHandle != null) {
    cancelAnimationFrame(visualSyncHandle);
    visualSyncHandle = null;
  }
  lastVisualStep = null;
}

function syncVisualState() {
  if (!isPlaying || !audio || typeof audio.getVisualState !== 'function') return;
  const state = audio.getVisualState();
  if (!state || !Number.isFinite(state.step)) return;
  if (lastVisualStep === state.step) return;
  highlightPulse(state.step);
}

function startVisualSync() {
  stopVisualSync();
  const step = () => {
    visualSyncHandle = null;
    if (!isPlaying || !audio) return;
    syncVisualState();
    visualSyncHandle = requestAnimationFrame(step);
  };
  visualSyncHandle = requestAnimationFrame(step);
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
    { id: 'pulse',  label: 'Pulso/Pulso 0', allowSolo: true },
    { id: 'accent', label: 'Seleccionado',  allowSolo: true },
    { id: 'master', label: 'Master',        allowSolo: false, isMaster: true }
  ]
});
