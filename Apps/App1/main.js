import { TimelineAudio, soundNames } from '../../packages/audio/index.js';
// Using local header controls for App1 (no shared init)

const audio = new TimelineAudio();
const inputLg = document.getElementById('inputLg');
const inputV = document.getElementById('inputV');
const inputT = document.getElementById('inputT');
const formula = document.getElementById('formula');
const timeline = document.getElementById('timeline');
const playBtn = document.getElementById('playBtn');
const loopBtn = document.getElementById('loopBtn');
const resetBtn = document.getElementById('resetBtn');
const showNumbers = document.getElementById('showNumbers');
const muteToggle = document.getElementById('muteToggle');
const themeSelect = document.getElementById('themeSelect');
const selectColor = document.getElementById('selectColor');
const baseSounds = document.getElementById('baseSounds');
const accentSounds = document.getElementById('accentSounds');

let pulses = [];
const selectedPulses = new Set();
let isPlaying = false;
let loopEnabled = false;

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

function buildSoundList(listElem, groupName, setter, defaultName){
  soundNames.forEach(name => {
    const li = document.createElement('li');
    const checked = name === defaultName ? 'checked' : '';
    li.innerHTML = `<input type="radio" name="${groupName}" value="${name}" ${checked}> <span class="sound-name">${name}</span>`;
    const radio = li.querySelector('input');
    const span = li.querySelector('.sound-name');
    span.addEventListener('click', () => audio.preview(name));
    radio.addEventListener('change', () => setter(name));
    listElem.appendChild(li);
  });
}

buildSoundList(baseSounds, 'baseSound', name => audio.setBase(name), 'click1');
buildSoundList(accentSounds, 'accentSound', name => audio.setAccent(name), 'click2');

[inputLg, inputV, inputT].forEach(el => el.addEventListener('input', handleInput));
updateFormula();

function handleInput(){
  const lg = parseFloat(inputLg.value);
  const v = parseFloat(inputV.value);
  const t = parseFloat(inputT.value);
  if(!isNaN(lg) && !isNaN(v) && isNaN(t)){
  inputT.value = Math.round((lg / v) * 60);
} else if(!isNaN(lg) && isNaN(v) && !isNaN(t)){
  inputV.value = Math.round((lg * 60) / t);
} else if(isNaN(lg) && !isNaN(v) && !isNaN(t)){
  inputLg.value = Math.round((v * t) / 60);
}
  updateFormula();
  renderTimeline();
}

function updateFormula(){
  const lg = inputLg.value || 'Lg';
  const v = inputV.value || 'V';
  const t = inputT.value || 'T';
  formula.innerHTML = `
  <span class="fraction">
    <span class="top lg">${lg}</span>
    <span class="bottom v">${v}</span>
  </span>
  <span class="equal">=</span>
  <span class="fraction">
    <span class="top t">${t}</span>
    <span class="bottom">60</span>
  </span>`;
}

function renderTimeline(){
  timeline.innerHTML = '';
  pulses = [];
  const lg = parseInt(inputLg.value);
  if(isNaN(lg) || lg <= 0) return;

  for(let i=0; i<lg; i++){
    const p = document.createElement('div');
    p.className = 'pulse';
    const percent = lg > 1 ? (i/(lg-1))*100 : 0;
    p.style.left = percent + '%';
    p.dataset.index = i;
    p.addEventListener('click', () => togglePulse(i));
    if(selectedPulses.has(i)){
      p.classList.add('selected');
    }
    timeline.appendChild(p);
    pulses.push(p);

    // barres verticals extrems
    if (i === 0 || i === lg-1) {
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

playBtn.addEventListener('click', () => {
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

  const lg = parseInt(inputLg.value);
  const v = parseFloat(inputV.value);
  if (isNaN(lg) || isNaN(v)) return;

  const interval = 60 / v;
  audio.schedule(lg, interval, selectedPulses, loopEnabled, highlightPulse);
  isPlaying = true;
  playBtn.classList.add('active');
  iconPlay.style.display = 'none';
  iconStop.style.display = 'block';

  if (!loopEnabled) {
    Tone.Transport.scheduleOnce(() => {
      isPlaying = false;
      playBtn.classList.remove('active');
      iconPlay.style.display = 'block';
      iconStop.style.display = 'none';
      pulses.forEach(p => p.classList.remove('active'));
    }, lg * interval);
  }
});

function highlightPulse(i){
  pulses.forEach(p => p.classList.remove('active'));
  const p = pulses[i];
  if(p) p.classList.add('active');
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
