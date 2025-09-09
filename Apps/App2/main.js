import { TimelineAudio, soundNames } from '../../libs/sound/index.js';
import { ensureAudio } from '../../libs/sound/index.js';
import { attachHover } from '../../libs/shared-ui/hover.js';
import { computeHitSizePx, solidMenuBackground, computeNumberFontRem } from './utils.js';
import { initRandomMenu } from '../../libs/app-common/random-menu.js';
// Using local header controls for App2 (no shared init)

let audio;
let pendingScheduling = null;
const defaultProfile = (() => {
  const ua = navigator.userAgent || '';
  const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobi/i.test(ua)
    || Math.min(window.innerWidth, window.innerHeight) <= 600;
  return mobile ? 'mobile' : 'desktop';
})();

// Rep canvis del header compartit (futures apps també)
window.addEventListener('sharedui:scheduling', (e) => {
  const { lookAhead, updateInterval, profile } = e.detail || {};
  if (audio && typeof audio.setScheduling === 'function'
      && (typeof lookAhead === 'number' || typeof updateInterval === 'number')) {
    audio.setScheduling({ lookAhead, updateInterval });
  } else if (audio && typeof audio.setSchedulingProfile === 'function' && profile) {
    audio.setSchedulingProfile(profile);
  } else {
    pendingScheduling = { lookAhead, updateInterval, profile };
  }
});
const inputLg = document.getElementById('inputLg');
const inputV = document.getElementById('inputV');
const inputT = document.getElementById('inputT');
const inputTUp = document.getElementById('inputTUp');
const inputTDown = document.getElementById('inputTDown');
const inputVUp = document.getElementById('inputVUp');
const inputVDown = document.getElementById('inputVDown');
const inputLgUp = document.getElementById('inputLgUp');
const inputLgDown = document.getElementById('inputLgDown');
const ledLg = document.getElementById('ledLg');
const ledV = document.getElementById('ledV');
const ledT = document.getElementById('ledT');
const unitLg = document.getElementById('unitLg');
const unitV = document.getElementById('unitV');
const unitT = document.getElementById('unitT');
const formula = document.getElementById('formula');
const timelineWrapper = document.getElementById('timelineWrapper');
const timeline = document.getElementById('timeline');
const playBtn = document.getElementById('playBtn');
const loopBtn = document.getElementById('loopBtn');
const resetBtn = document.getElementById('resetBtn');
const tapBtn = document.getElementById('tapTempoBtn');
const tapHelp = document.getElementById('tapHelp');
const circularTimelineToggle = document.getElementById('circularTimelineToggle');
const randomBtn = document.getElementById('randomBtn');
const randomMenu = document.getElementById('randomMenu');
const randLgToggle = document.getElementById('randLgToggle');
const randLgMin = document.getElementById('randLgMin');
const randLgMax = document.getElementById('randLgMax');
const randVToggle = document.getElementById('randVToggle');
const randVMin = document.getElementById('randVMin');
const randVMax = document.getElementById('randVMax');
const randTToggle = document.getElementById('randTToggle');
const randTMin = document.getElementById('randTMin');
const randTMax = document.getElementById('randTMax');
const randPulsesToggle = document.getElementById('randPulsesToggle');
const randomCount = document.getElementById('randomCount');
const randomDensity = document.getElementById('randomDensity');
// Mute is managed by the shared header (#muteBtn)
const themeSelect = document.getElementById('themeSelect');
const selectColor = document.getElementById('selectColor');
const baseSoundSelect = document.getElementById('baseSoundSelect');
const accentSoundSelect = document.getElementById('accentSoundSelect');
const previewBaseBtn = document.getElementById('previewBaseBtn');
const previewAccentBtn = document.getElementById('previewAccentBtn');

let pulses = [];
// Hit targets (separate from the visual dots) and drag mode
let pulseHits = [];
let dragMode = 'select'; // 'select' | 'deselect'
// --- Selection memory across Lg changes ---
let pulseMemory = []; // index -> selected

function ensurePulseMemory(size) {
  if (size >= pulseMemory.length) {
    for (let i = pulseMemory.length; i <= size; i++) pulseMemory[i] = false;
  }
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
let tapTimes = [];
let circularTimeline = false;
let suppressClickIndex = null;       // per evitar doble-toggle en drag start
let autoTarget = null;               // 'Lg' | 'V' | 'T' | null
// Track manual selection recency (oldest -> newest among the two manual LEDs)
let manualHistory = [];
// --- Drag selection state ---
let isDragging = false;
let lastDragIndex = null;

// Start drag on the timeline area and decide drag mode based on first pulse under pointer
timeline.addEventListener('pointerdown', (e) => {
  isDragging = true;
  lastDragIndex = null;
  dragMode = 'select';
  const target = e.target.closest('.pulse-hit, .pulse');
  if (target && typeof target.dataset.index !== 'undefined') {
    const idx = parseInt(target.dataset.index, 10);
    if (!Number.isNaN(idx)) {
      ensurePulseMemory(idx);
      dragMode = pulseMemory[idx] ? 'deselect' : 'select';
      // APLICAR acció immediata sobre el primer pols sota el cursor
      setPulseSelected(idx, dragMode === 'select');
      // Evitar que el clic de mouseup inverteixi el que acabem de fer
      suppressClickIndex = idx;
    }
  }
});
// End/Cancel drag globally
document.addEventListener('pointerup', () => {
  isDragging = false;
  lastDragIndex = null;
  // Do not clear suppressClickIndex here; allow click handler to consume it
});
document.addEventListener('pointercancel', () => {
  isDragging = false;
  lastDragIndex = null;
  suppressClickIndex = null; 
});
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
  updateAutoIndicator();
  if (recalc) handleInput();
}

ledLg?.addEventListener('click', () => setAuto('Lg'));
ledV?.addEventListener('click', () => setAuto('V'));
ledT?.addEventListener('click', () => setAuto('T'));

const storeKey = (k) => `app1:${k}`;
const saveOpt = (k, v) => { try { localStorage.setItem(storeKey(k), v); } catch {} };
const loadOpt = (k) => { try { return localStorage.getItem(storeKey(k)); } catch { return null; } };

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
if (storedTheme) themeSelect.value = storedTheme;
applyTheme(themeSelect.value);
themeSelect.addEventListener('change', e => applyTheme(e.target.value));

document.addEventListener('sharedui:mute', async (e) => {
  const val = !!(e && e.detail && e.detail.value);
  saveOpt('mute', val ? '1' : '0');
  const a = await initAudio();
  if (a && typeof a.setMute === 'function') a.setMute(val);
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

circularTimelineToggle.checked = loadOpt('circular') === '1';
circularTimeline = circularTimelineToggle.checked;
circularTimelineToggle?.addEventListener('change', e => {
  circularTimeline = e.target.checked;
  saveOpt('circular', e.target.checked ? '1' : '0');
  animateTimelineCircle(loopEnabled && circularTimeline);
});
animateTimelineCircle(loopEnabled && circularTimeline);

loopBtn.addEventListener('click', () => {
  loopEnabled = !loopEnabled;
  loopBtn.classList.toggle('active', loopEnabled);
  const lg = parseInt(inputLg.value);
  if (!isNaN(lg)) {
    ensurePulseMemory(lg);
    // Rebuild visible selection from memory and refresh labels
    syncSelectedFromMemory();
    updateNumbers();
    if (isPlaying && typeof audio.setSelected === 'function') {
      audio.setSelected(selectedForAudioFromState());
    }
  }
  // Sincronitza amb el motor en temps real si està sonant
  if (isPlaying && audio && typeof audio.setLoop === 'function') {
    audio.setLoop(loopEnabled);
  }
  animateTimelineCircle(loopEnabled && circularTimeline);
});

resetBtn.addEventListener('click', () => {
  pulseMemory = [];
  window.location.reload();
});

tapBtn.addEventListener('click', () => {
  const now = performance.now();
  if (tapTimes.length && now - tapTimes[tapTimes.length - 1] > 2000) {
    tapTimes = [];
  }
  tapTimes.push(now);
  const remaining = 3 - tapTimes.length;
  if (remaining > 0) {
    tapHelp.textContent = remaining === 2 ? '2 clicks más' : '1 click más solamente';
    tapHelp.style.display = 'block';
    return;
  }

  tapHelp.style.display = 'none';
  const intervals = [];
  for (let i = 1; i < tapTimes.length; i++) {
    intervals.push(tapTimes[i] - tapTimes[i - 1]);
  }
  const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const bpm = Math.round((60000 / avg) * 100) / 100;
  setValue(inputV, bpm);
  handleInput({ target: inputV });

  if (isPlaying && audio && typeof audio.setTempo === 'function') {
    audio.setTempo(bpm);
  }
  if (tapTimes.length > 8) tapTimes.shift();
});

// --- Aleatorización de parámetros y pulsos ---
function randomInt(min, max) {
  const lo = Number(min);
  const hi = Number(max);
  if (isNaN(lo) || isNaN(hi) || hi < lo) return lo;
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

function randomize() {
  if (randLgToggle?.checked) {
    const v = randomInt(randLgMin.value, randLgMax.value);
    setValue(inputLg, v);
    handleInput({ target: inputLg });
  }
  if (randVToggle?.checked) {
    const v = randomInt(randVMin.value, randVMax.value);
    setValue(inputV, v);
    handleInput({ target: inputV });
  }
  if (randTToggle?.checked) {
    const min = Number(randTMin.value);
    const max = Number(randTMax.value);
    const lo = isNaN(min) ? 0 : min;
    const hi = isNaN(max) ? lo : max;
    const val = lo + Math.random() * Math.max(0, hi - lo);
    setValue(inputT, val.toFixed(2));
    handleInput({ target: inputT });
  }
  if (randPulsesToggle?.checked) {
    const lg = parseInt(inputLg.value);
    if (!isNaN(lg) && lg > 0) {
      ensurePulseMemory(lg);
      const count = parseInt(randomCount.value);
      const density = parseFloat(randomDensity.value);
      const selected = new Set();
      const available = [];
      for (let i = 1; i < lg; i++) available.push(i);
      if (!isNaN(count) && count > 0) {
        while (selected.size < Math.min(count, available.length)) {
          const idx = available[Math.floor(Math.random() * available.length)];
          selected.add(idx);
        }
      } else {
        const d = isNaN(density) ? 0.5 : Math.max(0, Math.min(1, density));
        available.forEach(i => { if (Math.random() < d) selected.add(i); });
      }
      for (let i = 1; i < pulseMemory.length; i++) pulseMemory[i] = false;
      selected.forEach(i => { pulseMemory[i] = true; });
      syncSelectedFromMemory();
      updateNumbers();
      if (isPlaying && audio && typeof audio.setSelected === 'function') {
        audio.setSelected(selectedForAudioFromState());
      }
    }
  }
}

initRandomMenu(randomBtn, randomMenu, randomize);

function populateSoundSelect(selectElem, defaultName, storeName){
  if(!selectElem) return;
  // Clear existing options
  selectElem.innerHTML = '';
  soundNames.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    selectElem.appendChild(opt);
  });
  selectElem.value = defaultName;
  selectElem.addEventListener('change', async () => {
    const a = await initAudio();
    if (selectElem === baseSoundSelect) await a.setBase(selectElem.value);
    else if (selectElem === accentSoundSelect) await a.setAccent(selectElem.value);
    if(storeName) saveOpt(storeName, selectElem.value);
  });
}

const storedBase = loadOpt('baseSound') || 'click2';
const storedAccent = loadOpt('accentSound') || 'click3';
populateSoundSelect(baseSoundSelect, storedBase, 'baseSound');
populateSoundSelect(accentSoundSelect, storedAccent, 'accentSound');

// Preview buttons
if (previewBaseBtn) previewBaseBtn.addEventListener('click', async () => {
  const a = await initAudio();
  a.preview(baseSoundSelect.value);
});
if (previewAccentBtn) previewAccentBtn.addEventListener('click', async () => {
  const a = await initAudio();
  a.preview(accentSoundSelect.value);
});

async function initAudio(){
  if(audio) return audio;
  await ensureAudio();
  audio = new TimelineAudio();
  await audio.ready();
  audio.setBase(baseSoundSelect.value);
  audio.setAccent(accentSoundSelect.value);
  if(pendingScheduling){
    const { lookAhead, updateInterval, profile } = pendingScheduling;
    if (typeof audio.setScheduling === 'function'
        && (typeof lookAhead === 'number' || typeof updateInterval === 'number')) {
      audio.setScheduling({ lookAhead, updateInterval });
    } else if (typeof audio.setSchedulingProfile === 'function' && profile) {
      audio.setSchedulingProfile(profile);
    }
    pendingScheduling = null;
  } else {
    if(typeof audio.setSchedulingProfile === 'function'){
      audio.setSchedulingProfile(defaultProfile);
    }
  }
  return audio;
}

// Mostrar unitats quan s'edita cada paràmetre
function bindUnit(input, unit){
  if(!input || !unit) return;
  input.addEventListener('focus', () => { unit.style.display = 'block'; });
  input.addEventListener('blur', () => { unit.style.display = 'none'; });
}

bindUnit(inputLg, unitLg);
bindUnit(inputV, unitV);
bindUnit(inputT, unitT);

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
function formatSec(n){
  // arrodonim a 2 decimals però sense forçar-los si són .00
  const rounded = Math.round(Number(n) * 100) / 100;
  return rounded.toLocaleString('ca-ES', {
     minimumFractionDigits: 0,
     maximumFractionDigits: 2
   });
}

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
    const tSeconds = (lg / v) * 60;
    const rounded  = Math.round(tSeconds * 100) / 100; // 2 decimals màxim
    setValue(inputT, rounded);                          // punt a l'input; la fórmula ja mostra coma
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

  // Manté el cercle del timeline si el loop està actiu (sense tocar memòria)
  if (loopEnabled && hasLg) {
    ensurePulseMemory(lg);
  }

  updateFormula();
  renderTimeline();
  updateAutoIndicator();
  // Si canvia Lg mentre està sonant, refresquem la selecció viva filtrant 0 i lg
  if (isPlaying && audio) {
    const lgNow = parseInt(inputLg.value);
    const vNow  = parseFloat(inputV.value);
    if (typeof audio.setSelected === 'function') {
      audio.setSelected(selectedForAudioFromState());
    }
    if (typeof audio.setTotal === 'function' && !isNaN(lgNow) && lgNow > 0) {
      audio.setTotal(lgNow);
    }
    if (typeof audio.setTempo === 'function' && !isNaN(vNow) && vNow > 0) {
      audio.setTempo(vNow);
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
    hit.style.pointerEvents = 'auto';
    hit.style.borderRadius = '50%';
    hit.style.background = 'transparent';
    hit.style.zIndex = '6'; // above pulses and bars
    hit.style.cursor = 'pointer';

    const hitSize = computeHitSizePx(lg);
    hit.style.width = hitSize + 'px';
    hit.style.height = hitSize + 'px';

    // listeners on the hit target
    hit.addEventListener('click', (ev) => {
      if (suppressClickIndex === i) {
        suppressClickIndex = null;
        ev.preventDefault();
        ev.stopPropagation();
        return; // already applied on pointerdown
      }
      togglePulse(i);
    });
    hit.addEventListener('pointerenter', () => {
      if (isDragging && lastDragIndex !== i) {
        lastDragIndex = i;
        setPulseSelected(i, dragMode === 'select');
      }
    });

    timeline.appendChild(hit);
    pulseHits.push(hit);
  }
  syncSelectedFromMemory();
  animateTimelineCircle(loopEnabled && circularTimeline, { silent: true });
}

function togglePulse(i){
  const lg = parseInt(inputLg.value);
  if (isNaN(lg)) return;

  if (i === 0 || i === lg) {
    // Click a l’extrem → commuta el loop
    setPulseSelected(i, !loopEnabled);
  } else {
    setPulseSelected(i, !pulseMemory[i]);
  }
}

function animateTimelineCircle(isCircular, opts = {}){
  const silent = !!opts.silent;
  const lg = pulses.length - 1;
  const bars = timeline.querySelectorAll('.bar');
  if (lg <= 0) return;
  if (isCircular) {
    timelineWrapper.classList.add('circular');
    timeline.classList.add('circular');
    if (silent) timeline.classList.add('no-anim');
    // Guia circular: ANCORADA al centre del WRAPPER per evitar desplaçaments
    const wrapper = timeline.closest('.timeline-wrapper') || timeline.parentElement || timeline;
    let guide = wrapper.querySelector('.circle-guide');
    if (!guide) {
      guide = document.createElement('div');
      guide.className = 'circle-guide';
      // estils mínims inline (per si el CSS no ha carregat)
      guide.style.position = 'absolute';
      guide.style.border = '2px solid var(--timeline-line, #EDE6D3)';
      guide.style.borderRadius = '50%';
      guide.style.pointerEvents = 'none';
      guide.style.transition = 'opacity 300ms ease';
      guide.style.opacity = '0';
      wrapper.appendChild(guide);
    }

    // Recol·loca un cop aplicades les classes circulars
    requestAnimationFrame(() => {
      const wRect = wrapper.getBoundingClientRect();
      const gcx = wRect.width / 2;
      const gcy = wRect.height / 2;
      const gRadius = Math.min(wRect.width, wRect.height) / 2 - 10;
      guide.style.left = gcx + 'px';
      guide.style.top = gcy + 'px';
      guide.style.width = (gRadius * 2) + 'px';
      guide.style.height = (gRadius * 2) + 'px';
      guide.style.transform = 'translate(-50%, -50%)';
      guide.style.opacity = '1';

      // Geometria basada en el TIMELINE (anella real) perquè els polsos intersequin la línia
      const tRect = timeline.getBoundingClientRect();
      const cx = tRect.width / 2;
      const cy = tRect.height / 2;
      const radius = Math.min(tRect.width, tRect.height) / 2 - 1; // centre del pols gairebé sobre la línia (border=2)

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
        const barLen = Math.min(tRect.width, tRect.height) * 0.25;
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
    const guide = wrapper.querySelector('.circle-guide');
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

function showNumber(i){
  const n = document.createElement('div');
  n.className = 'pulse-number';
  n.dataset.index = i;
  n.textContent = i;
  const _lgForFont = pulses.length - 1;
  const fontRem = computeNumberFontRem(_lgForFont);
  n.style.fontSize = fontRem + 'rem';

   if (timeline.classList.contains('circular')) {
     const lg = pulses.length - 1;
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

  // sempre 0 i últim (inclús quan és massa dens)
  showNumber(0);
  showNumber(lgForNumbers);

  // la resta només si no és massa dens i està activat
  if (!tooDense) {
    pulses.forEach((p, i) => {
      if (i !== 0 && i !== lgForNumbers && selectedPulses.has(i)) {
        showNumber(i);
      }
    });
  }
}

function updateAutoIndicator(){
  // Los LEDs encendidos son los campos editables; el apagado se recalcula
  ledLg?.classList.toggle('on', inputLg.dataset.auto !== '1');
  ledV?.classList.toggle('on', inputV.dataset.auto !== '1');
  ledT?.classList.toggle('on', inputT.dataset.auto !== '1');
}

playBtn.addEventListener('click', async () => {
  const audio = await initAudio();

  const iconPlay = playBtn.querySelector('.icon-play');
  const iconStop = playBtn.querySelector('.icon-stop');

  if (isPlaying) {
    audio.stop();
    isPlaying = false;
    playBtn.classList.remove('active');
    iconPlay.style.display = 'block';
    iconStop.style.display = 'none';
    pulses.forEach(p => p.classList.remove('active'));
    return;
  }

  // Estat net abans d’arrencar
  audio.stop();
  pulses.forEach(p => p.classList.remove('active'));

  const lg = parseInt(inputLg.value);
  const v  = parseFloat(inputV.value);
  if (isNaN(lg) || isNaN(v) || lg <= 0 || v <= 0) return;

  // Sons segons el menú
  await audio.setBase(baseSoundSelect.value);
  await audio.setAccent(accentSoundSelect.value);

  const interval = 60 / v;

  // Filtra la selecció per a l'àudio: 0 és sempre accent i 'lg' coincideix amb 0 temporalment.
  const selectedForAudio = new Set([...selectedPulses].filter(i => i > 0 && i < lg));

  const onFinish = () => {
    // Mode no loop: final net i una sola ruta de parada
    isPlaying = false;
    playBtn.classList.remove('active');
    iconPlay.style.display = 'block';
    iconStop.style.display = 'none';
    pulses.forEach(p => p.classList.remove('active'));
    audio.stop();
  };

  audio.play(lg, interval, selectedForAudio, loopEnabled, highlightPulse, onFinish);

  isPlaying = true;
  playBtn.classList.add('active');
  iconPlay.style.display = 'none';
  iconStop.style.display = 'block';
});

function highlightPulse(i){
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
