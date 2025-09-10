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
// Pulse sequence UI element (contenteditable div in template)
const pulseSeqEl = document.getElementById('pulseSeq');
const formula = document.getElementById('formula');
const timelineWrapper = document.getElementById('timelineWrapper');
const timeline = document.getElementById('timeline');
const tIndicator = document.createElement('div');
tIndicator.id = 'tIndicator';
timeline.appendChild(tIndicator);
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

const randomDefaults = {
  Lg: { enabled: true, range: [1, 100] },
  V: { enabled: true, range: [1, 1000] },
  Pulses: { enabled: true, count: '', density: 0.5 }
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
  randPulsesToggle.checked = cfg.Pulses.enabled;
  randomCount.value = cfg.Pulses.count;
  randomDensity.value = cfg.Pulses.density;
}

function updateRandomConfig() {
  randomConfig.Lg = {
    enabled: randLgToggle.checked,
    range: [Number(randLgMin.value) || 1, Number(randLgMax.value) || 1]
  };
  randomConfig.V = {
    enabled: randVToggle.checked,
    range: [Number(randVMin.value) || 1, Number(randVMax.value) || 1]
  };
  randomConfig.Pulses = {
    enabled: randPulsesToggle.checked,
    count: randomCount.value,
    density: Number(randomDensity.value) || 0
  };
  saveRandomConfig(randomConfig);
}

applyRandomConfig(randomConfig);

[
  randLgToggle, randLgMin, randLgMax,
  randVToggle, randVMin, randVMax,
  randPulsesToggle, randomCount, randomDensity
].forEach(el => el?.addEventListener('change', updateRandomConfig));

// No actualitza la memòria a cada tecleig: es confirma amb Enter o blur
// pulseSeqEl?.addEventListener('input', handlePulseSeqInput);

let pulses = [];
// Hit targets (separate from the visual dots) and drag mode
let pulseHits = [];
let dragMode = 'select'; // 'select' | 'deselect'
// --- Selection memory across Lg changes ---
let pulseMemory = []; // index -> selected
let pulseSeqRanges = {};

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

// Build structured markup for the pulse sequence so only inner numbers are editable
function setupPulseSeqMarkup(){
  if (!pulseSeqEl) return;
  if (pulseSeqEl.querySelector('.pz.edit')) return; // already prepared
  const initial = (pulseSeqEl.textContent || '').trim();
  pulseSeqEl.textContent = '';
  const mk = (cls, txt) => { const s = document.createElement('span'); s.className = 'pz ' + cls; if (txt!=null) s.textContent = txt; return s; };
  pulseSeqEl.append(
    mk('prefix','P('),
    mk('zero','0'),
    (()=>{ const e = mk('edit', initial); e.contentEditable = 'true'; return e; })(),
    mk('lg',''),
    mk('suffix',')')
  );
}
setupPulseSeqMarkup();

// Helpers for #pulseSeq (use inner span .pz.edit)
function getEditEl(){
  if(!pulseSeqEl) return null;
  return pulseSeqEl.querySelector('.pz.edit') || pulseSeqEl;
}
function getPulseSeqText(){
  const el = getEditEl();
  return el ? (el.textContent || '') : '';
}
function setPulseSeqText(str){
  const el = getEditEl();
  if(!el) return;
  el.textContent = String(str);
}
function setPulseSeqSelection(start, end){
  const el = getEditEl();
  if(!el) return;
  try{
    const sel = window.getSelection();
    const range = document.createRange();
    let node = el.firstChild;
    if(!node){ node = document.createTextNode(''); el.appendChild(node); }
    const len = node.textContent.length;
    const s = Math.max(0, Math.min(start, len));
    const e = Math.max(0, Math.min(end, len));
    range.setStart(node, s);
    range.setEnd(node, e);
    sel.removeAllRanges();
    sel.addRange(range);
  }catch{}
}

// Move caret to nearest token boundary and ensure there is a gap there.
function adjustCaretToBoundaryAndEnsureGap(){
  const el = getEditEl(); if(!el) return;
  const sel = window.getSelection && window.getSelection();
  if(!sel || sel.rangeCount===0) return;
  const rng = sel.getRangeAt(0);
  if(!el.contains(rng.startContainer)) return;
  const node = el.firstChild || el;
  let text = node.textContent || '';
  let pos = rng.startOffset;

  // Tokenize numbers
  const tokens=[]; const re=/\d+/g; let m;
  while((m=re.exec(text))){ tokens.push({s:m.index,e:m.index+m[0].length}); }
  // If inside a token, snap to nearest boundary
  for(const t of tokens){ if(pos>t.s && pos<t.e){ const dl=pos-t.s, dr=t.e-pos; pos = (dr<=dl)?t.e:t.s; break; } }

  // Ensure single gap at boundary (don't split inside numbers)
  const left  = pos>0 ? text[pos-1] : null;
  const right = pos<text.length ? text[pos] : null;
  const isDigit=(c)=> c>='0' && c<='9';
  const needGap = (left!==' ' && right!==' ' && (isDigit(left||'') || isDigit(right||'')));
  if(needGap){ text = text.slice(0,pos)+' '+text.slice(pos); node.textContent=text; pos+=1; }

  setPulseSeqSelection(pos,pos);

  // Visual hint of the gap position
  try{ let hint = el.querySelector('#gapHint'); if(!hint){ hint=document.createElement('span'); hint.id='gapHint'; hint.className='gap-hint'; el.appendChild(hint);} const r=document.createRange(); const n=el.firstChild||el; const p=Math.max(0,Math.min(pos,(n.textContent||'').length)); r.setStart(n,p); r.setEnd(n,p); const rect=r.getBoundingClientRect(); const base=el.getBoundingClientRect(); hint.style.left=(rect.left-base.left)+'px'; hint.style.bottom='-4px'; hint.style.opacity='0.35'; clearTimeout(hint._t); hint._t=setTimeout(()=>{hint.style.opacity='0.15';},800); }catch{}
}
function updateTIndicatorText(value) {
  tIndicator.textContent = `T: ${value}`;
}

function updateTIndicatorPosition() {
  if (!timeline) return;
  tIndicator.style.position = 'absolute';
  if (circularTimeline) {
    tIndicator.style.left = '50%';
    tIndicator.style.top = 'calc(100% + 10px)';
    tIndicator.style.transform = 'translateX(-50%)';
  } else {
    const rect = timeline.getBoundingClientRect();
    tIndicator.style.left = (rect.width - 8) + 'px';
    tIndicator.style.top = '50%';
    tIndicator.style.transform = 'translate(-100%, -50%)';
  }
  if (tIndicator.parentNode !== timeline) timeline.appendChild(tIndicator);
}
let suppressClickIndex = null;       // per evitar doble-toggle en drag start
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
attachHover(ledT, { text: 'Valor calculado de "T"' });
attachHover(playBtn, { text: 'Play / Stop' });
attachHover(loopBtn, { text: 'Loop' });
attachHover(tapBtn, { text: 'Tap Tempo' });
attachHover(resetBtn, { text: 'Reset App' });
attachHover(randomBtn, { text: 'Aleatorizar parámetros' });


const storeKey = (k) => `app2:${k}`;
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
updateTIndicatorPosition();
updateTIndicatorText(parseNum(inputT?.value ?? '') || '');
circularTimelineToggle?.addEventListener('change', e => {
  circularTimeline = e.target.checked;
  saveOpt('circular', e.target.checked ? '1' : '0');
  animateTimelineCircle(loopEnabled && circularTimeline);
  updateTIndicatorPosition();
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
  let lo = Number(min);
  let hi = Number(max);
  if (isNaN(lo)) lo = 1;
  if (isNaN(hi)) hi = lo;
  if (hi < lo) [lo, hi] = [hi, lo];
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
    sanitizePulseSeq();
    return;
  }
  // Allow only digits and navigation keys (no spaces typed)
  const allowed = new Set(['Backspace','Delete','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','Tab']);
  if (!/^[0-9]$/.test(e.key) && !allowed.has(e.key)) {
    e.preventDefault();
    return;
  }
  if (e.key === 'Backspace' || e.key === 'Delete') {
    const el = getEditEl();
    const node = el && el.firstChild;
    const len = node ? (node.textContent || '').length : 0;
    const sel = window.getSelection && window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const rng = sel.getRangeAt(0);
    if (!el.contains(rng.startContainer)) return;
    const start = rng.startOffset;
    const end = rng.endOffset;
    if ((e.key === 'Backspace' && start === 0 && end === 0) ||
        (e.key === 'Delete' && start === len && end === len)) {
      e.preventDefault();
    }
  }
});
getEditEl()?.addEventListener('blur', sanitizePulseSeq);
// Ensure a gap exists at caret when clicking or navigating
getEditEl()?.addEventListener('mouseup', ()=> setTimeout(adjustCaretToBoundaryAndEnsureGap));
getEditEl()?.addEventListener('keyup', (e)=>{
  if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) adjustCaretToBoundaryAndEnsureGap();
});
getEditEl()?.addEventListener('focus', ()=>{
  // Create a gap at caret if needed on focus
  setTimeout(adjustCaretToBoundaryAndEnsureGap);
});
// Snap caret to nearest gap on click and arrow navigation
getEditEl()?.addEventListener('mouseup', () => setTimeout(()=>{
  const el=getEditEl(); if(!el) return; const node=el.firstChild||el; const text=node.textContent||'';
  const desired = (function(){ const s=window.getSelection&&window.getSelection(); if(!s||s.rangeCount===0) return 0; return s.getRangeAt(0).startOffset; })();
  const allowed=[0,...[...text].map((ch,i)=>ch===' '?i+1:null).filter(x=>x!=null),text.length];
  let best=allowed[0],bestD=Math.abs(desired-best); allowed.forEach(p=>{const d=Math.abs(desired-p); if(d<bestD){best=p; bestD=d;}});
  setPulseSeqSelection(best,best);
}));
getEditEl()?.addEventListener('keyup', (e)=>{
  if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){
    const el=getEditEl(); if(!el) return; const node=el.firstChild||el; const text=node.textContent||'';
    const desired = (function(){ const s=window.getSelection&&window.getSelection(); if(!s||s.rangeCount===0) return 0; return s.getRangeAt(0).startOffset; })();
    const allowed=[0,...[...text].map((ch,i)=>ch===' '?i+1:null).filter(x=>x!=null),text.length];
    let best=allowed[0],bestD=Math.abs(desired-best); allowed.forEach(p=>{const d=Math.abs(desired-p); if(d<bestD){best=p; bestD=d;}});
    setPulseSeqSelection(best,best);
  }
});
getEditEl()?.addEventListener('focus', ()=>{
  const el=getEditEl(); if(!el) return; const node=el.firstChild||el; const text=node.textContent||'';
  const allowed=[0,...[...text].map((ch,i)=>ch===' '?i+1:null).filter(x=>x!=null),text.length];
  const target = allowed.includes(text.length)?text.length:allowed[allowed.length-1];
  setPulseSeqSelection(target,target);
});

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

function sanitizePulseSeq(){
  if (!pulseSeqEl) return;
  const lg = parseInt(inputLg.value);
  const text = getPulseSeqText();
  const matches = text.match(/\d+/g) || [];
  const seen = new Set();
  const nums = [];
  for (const m of matches) {
    const n = parseInt(m, 10);
    if (n > 0 && (!isNaN(lg) ? n < lg : true) && !seen.has(n)) {
      seen.add(n);
      nums.push(n);
    }
  }
  // Expand Lg if any number is >= current Lg
  let increased = false;
  if (nums.length) {
    const maxN = Math.max(...nums);
    if (!isNaN(lg) && maxN >= lg) {
      setValue(inputLg, maxN + 1);
      increased = true;
    }
  }
  const newLg = parseInt(inputLg.value);
  if (!isNaN(newLg)) ensurePulseMemory(newLg);
  nums.sort((a,b) => a - b);
  const out = (isNaN(newLg) ? nums : nums.filter(n => n < newLg)).join(' ');
  setPulseSeqText(out);
  if (!isNaN(newLg)) {
    for (let i = 1; i < newLg; i++) pulseMemory[i] = false;
    nums.forEach(n => { if (n < newLg) pulseMemory[n] = true; });
    syncSelectedFromMemory();
    updateNumbers();
  }
  if (increased) {
    // Recalcular dependencias (timeline, T, etc.)
    handleInput();
  }
}

function handleInput(){
  const lg = parseNum(inputLg.value);
  const v  = parseNum(inputV.value);
  const hasLg = !isNaN(lg) && lg > 0;
  const hasV  = !isNaN(v)  && v  > 0;

  if (isUpdating) return;

  // Always recalc T from Lg and V
  if (hasLg && hasV) {
    const tSeconds = (lg / v) * 60;
    const rounded  = Math.round(tSeconds * 100) / 100;
    if (inputT) setValue(inputT, rounded);
    updateTIndicatorText(rounded);
  }

  // Keep loop memory size stable
  if (loopEnabled && hasLg) {
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
    if (typeof audio.setTotal === 'function' && !isNaN(lgNow) && lgNow > 0) {
      audio.setTotal(lgNow);
    }
    if (typeof audio.setTempo === 'function' && !isNaN(vNow) && vNow > 0) {
      audio.setTempo(vNow);
    }
  }
  if (inputT) {
    updateTIndicatorText(parseNum(inputT.value));
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
    pulseSeqRanges[num] = [pos, pos + str.length];
    pos += str.length + 1;
    return str;
  });
  setPulseSeqText(parts.join(' '));
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
  updateTIndicatorPosition();
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

  // En App2: només els seleccionats (sense 0 ni Lg)
  pulses.forEach((p, i) => {
    if (i !== 0 && i !== lgForNumbers && selectedPulses.has(i)) {
      showNumber(i);
    }
  });
}

function updateAutoIndicator(){
  // Los LEDs encendidos son los campos editables; el apagado se recalcula
  ledLg?.classList.toggle('on', inputLg.dataset.auto !== '1');
  ledV?.classList.toggle('on', inputV.dataset.auto !== '1');
  ledT?.classList.toggle('on', (inputT?.dataset?.auto) !== '1');
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
    const edStop = getEditEl();
    if (edStop) edStop.classList.remove('playing');
    return;
  }

  // Estat net abans d’arrencar
  audio.stop();
  pulses.forEach(p => p.classList.remove('active'));
  // no selection to avoid caret

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
    const ed = getEditEl();
    if (ed) ed.classList.remove('playing');
  };

  audio.play(lg, interval, selectedForAudio, loopEnabled, highlightPulse, onFinish);

  isPlaying = true;
  playBtn.classList.add('active');
  iconPlay.style.display = 'none';
  iconStop.style.display = 'block';
  const ed = getEditEl();
  if (ed) { ed.classList.add('playing'); ed.blur(); }
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

  if (pulseSeqEl) {
    const range = pulseSeqRanges[idx];
    if (range) {
      setPulseSeqSelection(range[0], range[1]);
    } else {
      setPulseSeqSelection(getPulseSeqText().length, getPulseSeqText().length);
    }
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
