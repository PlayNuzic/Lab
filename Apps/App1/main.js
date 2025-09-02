import { TimelineAudio, soundNames } from '../../packages/audio/index.js';
// Using local header controls for App1 (no shared init)

const audio = new TimelineAudio();
// Perfil de scheduling per defecte segons dispositiu (funciona encara que no es carregui header.js)
(() => {
  const ua = navigator.userAgent || '';
  const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobi/i.test(ua)
    || Math.min(window.innerWidth, window.innerHeight) <= 600;
  if (typeof audio.setSchedulingProfile === 'function') {
    audio.setSchedulingProfile(mobile ? 'mobile' : 'desktop');
  }
})();

// Rep canvis del header compartit (futures apps també)
window.addEventListener('sharedui:scheduling', (e) => {
  const { lookAhead, updateInterval, profile } = e.detail || {};
  if (typeof audio.setScheduling === 'function'
      && (typeof lookAhead === 'number' || typeof updateInterval === 'number')) {
    audio.setScheduling({ lookAhead, updateInterval });
  } else if (typeof audio.setSchedulingProfile === 'function' && profile) {
    audio.setSchedulingProfile(profile);
  }
});
const inputLg = document.getElementById('inputLg');
const inputV = document.getElementById('inputV');
const inputT = document.getElementById('inputT');
const ledLg = document.getElementById('ledLg');
const ledV = document.getElementById('ledV');
const ledT = document.getElementById('ledT');
const formula = document.getElementById('formula');
const timeline = document.getElementById('timeline');
const playBtn = document.getElementById('playBtn');
const loopBtn = document.getElementById('loopBtn');
const resetBtn = document.getElementById('resetBtn');
const showNumbers = document.getElementById('showNumbers');
const muteToggle = document.getElementById('muteToggle');
const themeSelect = document.getElementById('themeSelect');
const selectColor = document.getElementById('selectColor');
const baseSoundSelect = document.getElementById('baseSoundSelect');
const accentSoundSelect = document.getElementById('accentSoundSelect');
const previewBaseBtn = document.getElementById('previewBaseBtn');
const previewAccentBtn = document.getElementById('previewAccentBtn');

let pulses = [];
const selectedPulses = new Set();
let isPlaying = false;
let loopEnabled = false;
let isUpdating = false;     // evita bucles de 'input' reentrants

// Local header behavior (as before)
function applyTheme(val){
  if(val === 'system'){
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.body.dataset.theme = dark ? 'dark' : 'light';
  } else {
    document.body.dataset.theme = val;
  }
}

applyTheme(themeSelect.value);
themeSelect.addEventListener('change', e => applyTheme(e.target.value));
muteToggle.addEventListener('change', e => audio.setMute(e.target.checked));
selectColor.addEventListener('input', e => document.documentElement.style.setProperty('--selection-color', e.target.value));
showNumbers.addEventListener('change', updateNumbers);

loopBtn.addEventListener('click', () => {
  loopEnabled = !loopEnabled;
  loopBtn.classList.toggle('active', loopEnabled);
});

resetBtn.addEventListener('click', () => {
  window.location.reload();
});

function populateSoundSelect(selectElem, setter, defaultName){
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
  setter(defaultName);
  selectElem.addEventListener('change', () => setter(selectElem.value));
}

populateSoundSelect(baseSoundSelect, name => audio.setBase(name), 'click2');
populateSoundSelect(accentSoundSelect, name => audio.setAccent(name), 'click3');
audio.setBase(baseSoundSelect.value);
audio.setAccent(accentSoundSelect.value);

// Preview buttons
if (previewBaseBtn) previewBaseBtn.addEventListener('click', () => audio.preview(baseSoundSelect.value));
if (previewAccentBtn) previewAccentBtn.addEventListener('click', () => audio.preview(accentSoundSelect.value));

[inputLg, inputV, inputT].forEach(el => el.addEventListener('input', handleInput));
updateFormula();
updateAutoIndicator();

function setValue(input, value){
  isUpdating = true;
  input.value = String(value);
  input.dataset.auto = '1';    // marquem que aquest valor l'ha posat el codi
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
  if (e && e.target) delete e.target.dataset.auto;

  // comptem quants camps estan informats
  const knownCount = (hasLg ? 1 : 0) + (hasV ? 1 : 0) + (hasT ? 1 : 0);
  const twoKnown   = knownCount === 2;
  const threeKnown = knownCount === 3;

  // helpers (escriuen valor i marquen dataset.auto per no re-entrar)
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
    // sempre calcula la tercera que falta
    if (!hasT)      calcT();
    else if (!hasV) calcV();
    else if (!hasLg)calcLg();
  } else if (threeKnown) {
    // si n'hi ha exactament una d’auto, recalcula només aquella
    const autoT  = inputT.dataset.auto === '1';
    const autoV  = inputV.dataset.auto === '1';
    const autoLg = inputLg.dataset.auto === '1';
    const autoCount = (autoT?1:0) + (autoV?1:0) + (autoLg?1:0);

    if (autoCount === 1) {
      if (autoT)      calcT();
      else if (autoV) calcV();
      else if (autoLg)calcLg();
    } else {
      // sense 'auto' clara: protegeix el camp editat i calcula amb la parella natural
      if (src === 'inputT') {
        if (hasV)      calcLg();
        else if (hasLg)calcV();
      } else if (src === 'inputV') {
        if (hasT)      calcLg();
        else if (hasLg)calcT();
      } else if (src === 'inputLg') {
        if (hasV)      calcT();
        else if (hasT) calcV();
      } else {
        // cas indeterminat: ordre natural Lg+V → T
        calcT();
      }
    }
  }

  updateFormula();
  renderTimeline();
  updateAutoIndicator();
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
}

function renderTimeline(){
  timeline.innerHTML = '';
  pulses = [];
  const lg = parseInt(inputLg.value);
  if(isNaN(lg) || lg <= 0) return;

  for (let i = 0; i <= lg; i++) {
    const p = document.createElement('div');
    p.className = 'pulse';
    const percent = lg > 0 ? (i / lg) * 100 : 0; // distribute 0..Lg evenly across 0%..100%
    p.style.left = percent + '%';
    p.dataset.index = i;
    p.addEventListener('click', () => togglePulse(i));
    if (selectedPulses.has(i)) {
      p.classList.add('selected');
    }
    timeline.appendChild(p);
    pulses.push(p);

    // barres verticals extrems (0 i Lg)
    if (i === 0 || i === lg) {
      const bar = document.createElement('div');
      bar.className = 'bar';
      bar.style.left = percent + '%';
      timeline.appendChild(bar);
    }
  }

  // sempre pintem 0 i últim
  if (pulses.length > 0) {
    showNumber(0, parseFloat(pulses[0].style.left), true);
    showNumber(pulses.length-1, parseFloat(pulses[pulses.length-1].style.left), true);
  }
}

function togglePulse(i){
  if(selectedPulses.has(i)){
    selectedPulses.delete(i);
    pulses[i].classList.remove('selected');
    removeNumber(i);
  } else {
    selectedPulses.add(i);
    pulses[i].classList.add('selected');
    if(showNumbers.checked) showNumber(i, parseFloat(pulses[i].style.left));
  }
}

function showNumber(i, percent, always){
  const n = document.createElement('div');
  n.className = 'pulse-number';
  n.dataset.index = i;
  n.style.left = percent + '%';
  n.textContent = i;

  // Excepcions
  if (i === 0) n.style.transform = 'translateX(40%)';      // separa el 0
  if (i === pulses.length-1) n.style.transform = 'translateX(-140%)'; // separa l’últim

  timeline.appendChild(n);
}

function removeNumber(i){
  const el = timeline.querySelector(`.pulse-number[data-index="${i}"]`);
  if(el) el.remove();
}

function updateNumbers(){
  document.querySelectorAll('.pulse-number').forEach(n => n.remove());
  if(pulses.length === 0) return;

  // sempre 0 i últim
  showNumber(0, parseFloat(pulses[0].style.left), true);
  showNumber(pulses.length-1, parseFloat(pulses[pulses.length-1].style.left), true);

  // la resta només si està activat i seleccionat
  if(showNumbers.checked){
    pulses.forEach((p, i) => {
      if(i !== 0 && i !== pulses.length-1 && selectedPulses.has(i)){
        showNumber(i, parseFloat(p.style.left), false);
      }
    });
  }
}

function updateAutoIndicator(){
  ledLg?.classList.toggle('on', inputLg.dataset.auto === '1');
  ledV?.classList.toggle('on', inputV.dataset.auto === '1');
  ledT?.classList.toggle('on', inputT.dataset.auto === '1');
}

playBtn.addEventListener('click', async () => {
  await Tone.start();
  await audio.ready();

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
  const current = pulses[i];
  if (current) current.classList.add('active');

  // si hi ha loop i som al primer pols, també il·lumina l’últim
  if (loopEnabled && i === 0) {
    const last = pulses[pulses.length - 1];
    if (last) last.classList.add('active');
  }
}

const menu = document.querySelector('.menu');
const optionsContent = document.querySelector('.menu .options-content');

if (menu && optionsContent) {
  menu.addEventListener('toggle', () => {
    if (menu.open) {
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
}
