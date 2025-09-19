import { TimelineAudio } from '../../libs/sound/index.js';
import { ensureAudio } from '../../libs/sound/index.js';
import { initSoundDropdown } from '../../libs/shared-ui/sound-dropdown.js';
import { attachHover } from '../../libs/shared-ui/hover.js';
import { solidMenuBackground, computeNumberFontRem } from './utils.js';
import { initRandomMenu } from '../../libs/app-common/random-menu.js';
import { toRange } from '../../libs/app-common/range.js';
import { createSchedulingBridge, bindSharedSoundEvents } from '../../libs/app-common/audio.js';
import { computeResyncDelay } from '../../libs/app-common/audio-schedule.js';
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
// Mute is handled by shared header (#muteBtn). Listen for events instead.
const themeSelect = document.getElementById('themeSelect');
const baseSoundSelect = document.getElementById('baseSoundSelect');
const startSoundSelect = document.getElementById('startSoundSelect');
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

let pulses = [];

// UI thresholds for number rendering
const NUMBER_HIDE_THRESHOLD = 100;   // from this Lg and above, hide numbers
const NUMBER_CIRCLE_OFFSET  = 34;    // px distance from circle to number label

let isPlaying = false;
let loopEnabled = false;
let isUpdating = false;     // evita bucles de 'input' reentrants
let tapTimes = [];
let circularTimeline = false;
let autoTarget = null;               // 'Lg' | 'V' | 'T' | null
// Track manual selection recency (oldest -> newest among the two manual LEDs)
let manualHistory = [];
let tapResyncTimer = null;

const randomDefaults = {
  Lg: { enabled: true, range: [2, 30] },
  V: { enabled: true, range: [40, 320] },
  T: { enabled: true, range: [0.1, 10] }
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

const randomConfig = { ...randomDefaults, ...loadRandomConfig() };

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

// Persist and apply mute from shared header
document.addEventListener('sharedui:mute', async (e) => {
  const val = !!(e && e.detail && e.detail.value);
  saveOpt('mute', val ? '1' : '0');
  const a = await initAudio();
  if (a && typeof a.setMute === 'function') a.setMute(val);
});

// Restore previous mute preference on load by toggling the shared button
(() => {
  try{
    const saved = loadOpt('mute');
    if (saved === '1') document.getElementById('muteBtn')?.click();
  }catch{}
})();

updateNumbers();

circularTimelineToggle.checked = (() => {
  const stored = loadOpt('circular');
  return stored == null ? true : stored === '1';
})();
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
  if (isPlaying && audio && typeof audio.setLoop === 'function') {
    audio.setLoop(loopEnabled);
  }
  animateTimelineCircle(loopEnabled && circularTimeline);
});

resetBtn.addEventListener('click', () => {
  cancelTapResync();
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
    if (tapHelp) {
      tapHelp.textContent = remaining === 2 ? '2 clicks más' : '1 click más solamente';
      tapHelp.style.display = 'block';
    }
    return;
  }

  if (tapHelp) {
    tapHelp.style.display = 'none';
  }
  const intervals = [];
  for (let i = 1; i < tapTimes.length; i++) {
    intervals.push(tapTimes[i] - tapTimes[i - 1]);
  }
  const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  if (avg > 0) {
    const bpm = Math.round((60000 / avg) * 100) / 100;
    setValue(inputV, bpm);
    handleInput({ target: inputV });

    if (isPlaying && audio && typeof audio.setTempo === 'function') {
      audio.setTempo(bpm);
      scheduleTapResync(bpm);
    }
  }
  if (tapTimes.length > 8) tapTimes.shift();
});

initSoundDropdown(baseSoundSelect, {
  storageKey: storeKey('baseSound'),
  eventType: 'baseSound',
  getAudio: initAudio,
  apply: (a, val) => a.setBase(val)
});
initSoundDropdown(startSoundSelect, {
  storageKey: storeKey('startSound'),
  eventType: 'startSound',
  getAudio: initAudio,
  apply: (a, val) => a.setStart(val)
});

// Preview on sound change handled by shared header

async function initAudio(){
  if(audio) return audio;
  await ensureAudio();
  audio = new TimelineAudio();
  await audio.ready();
  audio.setBase(baseSoundSelect.dataset.value);
  audio.setStart(startSoundSelect.dataset.value);
  schedulingBridge.applyTo(audio);
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

  updateFormula();
  renderTimeline();
  updateAutoIndicator();
  // Si canvia Lg mentre està sonant, refresquem la selecció viva filtrant 0 i lg
  if (isPlaying && audio) {
    const lgNow = parseInt(inputLg.value);
    const vNow  = parseFloat(inputV.value);
    if (typeof audio.setTotal === 'function' && !isNaN(lgNow) && lgNow > 0) {
      audio.setTotal(lgNow);
    }
    if (typeof audio.setTempo === 'function' && !isNaN(vNow) && vNow > 0) {
      audio.setTempo(vNow);
      // TODO[audit]: aplicar computeResyncDelay als altres canvis en calent quan hi hagi proves específiques.
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
  timeline.innerHTML = '';
  pulses = [];
  const lg = parseInt(inputLg.value);
  if(isNaN(lg) || lg <= 0) return;

  for (let i = 0; i <= lg; i++) {
    const p = document.createElement('div');
    p.className = 'pulse';
    p.dataset.index = i;
    if (i === 0 || i === lg) p.classList.add('endpoint');
    timeline.appendChild(p);
    pulses.push(p);

    if (i === 0 || i === lg) {
      const bar = document.createElement('div');
      bar.className = 'bar endpoint';
      timeline.appendChild(bar);
    }
  }
  animateTimelineCircle(loopEnabled && circularTimeline, { silent: true });
  updateNumbers();
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
  if (i === 0 || i === _lgForFont) n.classList.add('endpoint');

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

  showNumber(0);
  showNumber(lgForNumbers);

  if (!tooDense) {
    for (let i = 1; i < lgForNumbers; i++) {
      showNumber(i);
    }
  }
}

function updateAutoIndicator(){
  // Los LEDs encendidos son los campos editables; el apagado se recalcula
  ledLg?.classList.toggle('on', inputLg.dataset.auto !== '1');
  ledV?.classList.toggle('on', inputV.dataset.auto !== '1');
  ledT?.classList.toggle('on', inputT.dataset.auto !== '1');
}

function cancelTapResync() {
  if (tapResyncTimer != null) {
    clearTimeout(tapResyncTimer);
    tapResyncTimer = null;
  }
}

function scheduleTapResync(bpm) {
  if (!isPlaying || !audio || typeof audio.getVisualState !== 'function') return;
  const lg = parseInt(inputLg.value);
  if (!Number.isFinite(lg) || lg <= 0) return;
  const state = audio.getVisualState();
  const step = state && Number.isFinite(state.step) ? state.step : null;
  if (!Number.isFinite(step)) return;

  const info = computeResyncDelay({ stepIndex: step, totalPulses: lg, bpm });
  if (!info) return;

  cancelTapResync();

  const run = () => {
    tapResyncTimer = null;
    if (!isPlaying) return;
    startPlayback(audio).catch(() => {});
  };

  if (!Number.isFinite(info.delaySeconds) || info.delaySeconds <= 0) {
    run();
    return;
  }

  tapResyncTimer = setTimeout(run, info.delaySeconds * 1000);
}

async function startPlayback(providedAudio) {
  const lg = parseInt(inputLg.value);
  const v = parseFloat(inputV.value);
  if (!Number.isFinite(lg) || !Number.isFinite(v) || lg <= 0 || v <= 0) {
    return false;
  }

  const audioInstance = providedAudio || await initAudio();
  if (!audioInstance) return false;

  cancelTapResync();

  const iconPlay = playBtn?.querySelector('.icon-play');
  const iconStop = playBtn?.querySelector('.icon-stop');

  audioInstance.stop();
  pulses.forEach(p => p.classList.remove('active'));

  await audioInstance.setBase(baseSoundSelect.dataset.value);
  await audioInstance.setStart(startSoundSelect.dataset.value);

  const interval = 60 / v;
  const selectedForAudio = new Set();

  const onFinish = () => {
    isPlaying = false;
    playBtn.classList.remove('active');
    if (iconPlay) iconPlay.style.display = 'block';
    if (iconStop) iconStop.style.display = 'none';
    pulses.forEach(p => p.classList.remove('active'));
    cancelTapResync();
    audioInstance.stop();
  };

  audioInstance.play(lg, interval, selectedForAudio, loopEnabled, highlightPulse, onFinish);

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
    cancelTapResync();
    audioInstance.stop();
    isPlaying = false;
    playBtn.classList.remove('active');
    if (iconPlay) iconPlay.style.display = 'block';
    if (iconStop) iconStop.style.display = 'none';
    pulses.forEach(p => p.classList.remove('active'));
    return;
  }

  await startPlayback(audioInstance);
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

function randomInt(min, max) {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi < lo) return lo;
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

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
