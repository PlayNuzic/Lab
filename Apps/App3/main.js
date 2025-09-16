import { TimelineAudio, ensureAudio } from '../../libs/sound/index.js';
import { attachHover } from '../../libs/shared-ui/hover.js';
import { initSoundDropdown } from '../../libs/shared-ui/sound-dropdown.js';
import { computeNumberFontRem } from './utils.js';
import { initRandomMenu } from '../../libs/app-common/random-menu.js';

let audio;
let pendingScheduling = null;
let isPlaying = false;
let loopEnabled = false;
let circularTimeline = false;
let isUpdating = false;
let tapTimes = [];
let tapTimeout = null;

const NUMBER_HIDE_THRESHOLD = 100;
const NUMBER_CIRCLE_OFFSET = 28;

const defaults = {
  Lg: 8,
  V: 120,
  numerator: 2,
  denominator: 3
};

const randomDefaults = {
  Lg: { enabled: true, range: [3, 16] },
  V: { enabled: true, range: [60, 180] },
  n: { enabled: true, range: [1, 4] },
  d: { enabled: true, range: [2, 8] },
  allowComplex: false
};

const storePrefix = 'app3';
const storeKey = (key) => `${storePrefix}::${key}`;
const loadOpt = (key) => {
  try { return localStorage.getItem(storeKey(key)); } catch { return null; }
};
const saveOpt = (key, value) => {
  try { localStorage.setItem(storeKey(key), value); } catch {}
};
const clearOpt = (key) => {
  try { localStorage.removeItem(storeKey(key)); } catch {}
};

const inputLg = document.getElementById('inputLg');
const inputV = document.getElementById('inputV');
const inputLgUp = document.getElementById('inputLgUp');
const inputLgDown = document.getElementById('inputLgDown');
const inputVUp = document.getElementById('inputVUp');
const inputVDown = document.getElementById('inputVDown');
const unitLg = document.getElementById('unitLg');
const unitV = document.getElementById('unitV');
const formula = document.getElementById('formula');
const timelineWrapper = document.getElementById('timelineWrapper');
const timeline = document.getElementById('timeline');
const playBtn = document.getElementById('playBtn');
const loopBtn = document.getElementById('loopBtn');
const randomBtn = document.getElementById('randomBtn');
const randomMenu = document.getElementById('randomMenu');
const tapBtn = document.getElementById('tapTempoBtn');
const tapHelp = document.getElementById('tapHelp');
const resetBtn = document.getElementById('resetBtn');
const circularTimelineToggle = document.getElementById('circularTimelineToggle');

const randLgToggle = document.getElementById('randLgToggle');
const randLgMin = document.getElementById('randLgMin');
const randLgMax = document.getElementById('randLgMax');
const randVToggle = document.getElementById('randVToggle');
const randVMin = document.getElementById('randVMin');
const randVMax = document.getElementById('randVMax');
const randNToggle = document.getElementById('randNToggle');
const randNMin = document.getElementById('randNMin');
const randNMax = document.getElementById('randNMax');
const randDToggle = document.getElementById('randDToggle');
const randDMin = document.getElementById('randDMin');
const randDMax = document.getElementById('randDMax');
const randComplexToggle = document.getElementById('randComplexToggle');

const baseSoundSelect = document.getElementById('baseSoundSelect');
const startSoundSelect = document.getElementById('startSoundSelect');
const cycleStartSoundSelect = document.getElementById('cycleStartSoundSelect');
const cycleSoundSelect = document.getElementById('cycleSoundSelect');
const themeSelect = document.getElementById('themeSelect');

let numeratorInput;
let denominatorInput;

let pulses = [];
let bars = [];
let cycleMarkers = [];
let cycleLabels = [];

const tIndicator = document.createElement('div');
tIndicator.id = 'tIndicator';
tIndicator.style.visibility = 'hidden';
timeline.appendChild(tIndicator);

function initFractionEditor() {
  if (!formula) return;
  formula.innerHTML = '';
  const container = document.createElement('div');
  container.className = 'fraction-editor';

  const top = document.createElement('div');
  top.className = 'top';
  numeratorInput = document.createElement('input');
  numeratorInput.type = 'number';
  numeratorInput.min = '1';
  numeratorInput.step = '1';
  numeratorInput.className = 'numerator';
  numeratorInput.placeholder = 'n';
  numeratorInput.value = '';
  top.appendChild(numeratorInput);

  const bottom = document.createElement('div');
  bottom.className = 'bottom';
  denominatorInput = document.createElement('input');
  denominatorInput.type = 'number';
  denominatorInput.min = '1';
  denominatorInput.step = '1';
  denominatorInput.className = 'denominator';
  denominatorInput.placeholder = 'd';
  denominatorInput.value = '';
  bottom.appendChild(denominatorInput);

  container.appendChild(top);
  container.appendChild(bottom);
  formula.appendChild(container);

  attachHover(numeratorInput, { text: 'Numerador (pulsos por ciclo)' });
  attachHover(denominatorInput, { text: 'Denominador (subdivisiones)' });

  const enforceInt = (input) => {
    input.addEventListener('input', () => {
      let val = parseInt(input.value, 10);
      if (!Number.isFinite(val) || val <= 0) {
        input.value = '';
      } else {
        input.value = String(val);
      }
      handleInput();
    });
    input.addEventListener('blur', () => {
      let val = parseInt(input.value, 10);
      if (!Number.isFinite(val) || val <= 0) {
        input.value = '';
      } else {
        input.value = String(val);
      }
      handleInput();
    });
  };

  enforceInt(numeratorInput);
  enforceInt(denominatorInput);
}

initFractionEditor();

function parseIntSafe(val) {
  const n = Number.parseInt(val, 10);
  return Number.isFinite(n) ? n : NaN;
}

function parseFloatSafe(val) {
  const n = Number.parseFloat(val);
  return Number.isFinite(n) ? n : NaN;
}

function setValue(input, value) {
  if (!input) return;
  isUpdating = true;
  const normalized = value == null || Number.isNaN(value) ? '' : String(value);
  input.value = normalized;
  isUpdating = false;
}

function clampRange(min, max, fallbackMin, fallbackMax) {
  let lo = Number(min);
  let hi = Number(max);
  if (!Number.isFinite(lo)) lo = fallbackMin;
  if (!Number.isFinite(hi)) hi = fallbackMax;
  if (hi < lo) [lo, hi] = [hi, lo];
  return [lo, hi];
}

async function initAudio() {
  if (audio) return audio;
  await ensureAudio();
  audio = new TimelineAudio();
  await audio.ready();
  if (pendingScheduling) {
    if (typeof pendingScheduling.lookAhead === 'number' || typeof pendingScheduling.updateInterval === 'number') {
      audio.setScheduling(pendingScheduling);
    }
    if (pendingScheduling.profile) {
      audio.setSchedulingProfile(pendingScheduling.profile);
    }
    pendingScheduling = null;
  }
  return audio;
}

window.addEventListener('sharedui:scheduling', (e) => {
  const { lookAhead, updateInterval, profile } = e.detail || {};
  if (audio && typeof audio.setScheduling === 'function' && (typeof lookAhead === 'number' || typeof updateInterval === 'number')) {
    audio.setScheduling({ lookAhead, updateInterval });
  } else if (audio && typeof audio.setSchedulingProfile === 'function' && profile) {
    audio.setSchedulingProfile(profile);
  } else {
    pendingScheduling = { lookAhead, updateInterval, profile };
  }
});

window.addEventListener('sharedui:sound', async (e) => {
  if (!audio) return;
  const { type, value } = e.detail || {};
  if (!value) return;
  if (type === 'baseSound') await audio.setBase(value);
  else if (type === 'startSound') await audio.setStart(value);
  else if (type === 'cycleStartSound') await audio.setCycleStart(value);
  else if (type === 'cycleSound') await audio.setCycle(value);
});

function bindUnit(input, unit) {
  if (!input || !unit) return;
  input.addEventListener('focus', () => { unit.style.display = 'block'; });
  input.addEventListener('blur', () => { unit.style.display = 'none'; });
}

bindUnit(inputLg, unitLg);
bindUnit(inputV, unitV);

attachHover(playBtn, { text: 'Play / Stop' });
attachHover(loopBtn, { text: 'Loop' });
attachHover(randomBtn, { text: 'Aleatorizar parámetros' });
attachHover(tapBtn, { text: 'Tap Tempo' });
attachHover(resetBtn, { text: 'Reset App' });
attachHover(circularTimelineToggle, { text: 'Línea temporal circular' });
attachHover(themeSelect, { text: 'Tema' });

function getLg() {
  return parseIntSafe(inputLg.value);
}

function getV() {
  return parseFloatSafe(inputV.value);
}

function getFraction() {
  const n = parseIntSafe(numeratorInput.value);
  const d = parseIntSafe(denominatorInput.value);
  return {
    numerator: Number.isFinite(n) && n > 0 ? n : null,
    denominator: Number.isFinite(d) && d > 0 ? d : null
  };
}

function updateTIndicatorText(value) {
  if (value === '' || value == null) {
    tIndicator.textContent = '';
    return;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) {
    tIndicator.textContent = `T: ${String(value)}`;
    return;
  }
  const rounded = Math.round(n * 10) / 10;
  tIndicator.textContent = `T: ${rounded}`;
}

function updateTIndicatorPosition() {
  const lg = getLg();
  if (!Number.isFinite(lg) || lg <= 0) return;
  let anchor = timeline.querySelector(`.pulse-number[data-index="${lg}"]`);
  if (!anchor) anchor = timeline.querySelector('.pulse.endpoint');
  if (!anchor) return;
  const tlRect = timeline.getBoundingClientRect();
  const aRect = anchor.getBoundingClientRect();
  const circular = timeline.classList.contains('circular');
  let offsetX = 0;
  if (circular && anchor.classList.contains('pulse-number')) {
    const anchorIndex = parseIntSafe(anchor.dataset.index);
    if (anchorIndex === 0) offsetX = -16;
    else if (anchorIndex === lg) offsetX = 16;
  }
  const centerX = aRect.left + aRect.width / 2 - tlRect.left + offsetX;
  const topY = aRect.bottom - tlRect.top + 15;
  tIndicator.style.left = `${centerX}px`;
  tIndicator.style.top = `${topY}px`;
  tIndicator.style.transform = 'translate(-50%, 0)';
  if (tIndicator.parentNode !== timeline) timeline.appendChild(tIndicator);
  if (tIndicator.textContent) tIndicator.style.visibility = 'visible';
}

function revealTAfter(ms = 900) {
  tIndicator.style.visibility = 'hidden';
  const start = performance.now();
  const check = () => {
    updateTIndicatorPosition();
    if (performance.now() - start >= ms) {
      tIndicator.style.visibility = 'visible';
    } else {
      requestAnimationFrame(check);
    }
  };
  requestAnimationFrame(check);
}

function clearHighlights() {
  pulses.forEach(p => p.classList.remove('active'));
  cycleMarkers.forEach(m => m.classList.remove('active'));
  cycleLabels.forEach(l => l.classList.remove('active'));
}

function renderTimeline() {
  pulses = [];
  cycleMarkers = [];
  cycleLabels = [];
  bars = [];
  const savedIndicator = tIndicator;
  timeline.innerHTML = '';
  timeline.appendChild(savedIndicator);

  const lg = getLg();
  if (!Number.isFinite(lg) || lg <= 0) return;

  for (let i = 0; i <= lg; i++) {
    const pulse = document.createElement('div');
    pulse.className = 'pulse';
    pulse.dataset.index = i;
    if (i === 0 || i === lg) pulse.classList.add('endpoint');
    timeline.appendChild(pulse);
    pulses.push(pulse);
    if (i === 0 || i === lg) {
      const bar = document.createElement('div');
      bar.className = 'bar';
      timeline.appendChild(bar);
      bars.push(bar);
    }
  }

  const { numerator, denominator } = getFraction();
  if (Number.isFinite(numerator) && Number.isFinite(denominator) && numerator > 0 && denominator > 0) {
    const cycles = Math.floor(lg / numerator);
    const labelFormatter = (cycleIndex, subdivision) => {
      const base = cycleIndex * numerator;
      return subdivision === 0 ? String(base) : `${base}.${subdivision}`;
    };
    for (let c = 0; c < cycles; c++) {
      for (let s = 0; s < denominator; s++) {
        const marker = document.createElement('div');
        marker.className = 'cycle-marker';
        if (s === 0) marker.classList.add('start');
        const position = c * numerator + (s * numerator) / denominator;
        marker.dataset.cycleIndex = String(c);
        marker.dataset.subdivision = String(s);
        marker.dataset.position = String(position);
        timeline.appendChild(marker);
        cycleMarkers.push(marker);

        const label = document.createElement('div');
        label.className = 'cycle-label';
        label.dataset.cycleIndex = String(c);
        label.dataset.subdivision = String(s);
        label.dataset.position = String(position);
        label.textContent = labelFormatter(c, s);
        timeline.appendChild(label);
        cycleLabels.push(label);
      }
    }
  }

  updatePulseNumbers();
  layoutTimeline({ silent: true });
  clearHighlights();
  updateTIndicatorPosition();
}

function showNumber(i) {
  const label = document.createElement('div');
  label.className = 'pulse-number';
  label.dataset.index = i;
  label.textContent = i;
  const lg = pulses.length - 1;
  const fontRem = computeNumberFontRem(lg);
  label.style.fontSize = `${fontRem}rem`;
  if (i === 0 || i === lg) label.classList.add('endpoint');
  timeline.appendChild(label);
}

function updatePulseNumbers() {
  timeline.querySelectorAll('.pulse-number').forEach(n => n.remove());
  if (!pulses.length) return;
  const lg = pulses.length - 1;
  const tooDense = lg >= NUMBER_HIDE_THRESHOLD;
  showNumber(0);
  showNumber(lg);
  if (!tooDense) {
    for (let i = 1; i < lg; i++) {
      showNumber(i);
    }
  }
}

function layoutTimeline(opts = {}) {
  const silent = !!opts.silent;
  const lg = pulses.length - 1;
  const useCircular = circularTimeline && loopEnabled;

  if (lg <= 0) {
    timelineWrapper.classList.remove('circular');
    timeline.classList.remove('circular');
    const wrapper = timeline.closest('.timeline-wrapper') || timeline.parentElement || timeline;
    const guide = wrapper.querySelector('.circle-guide');
    if (guide) guide.style.opacity = '0';
    updateTIndicatorPosition();
    return;
  }

  if (useCircular) {
    timelineWrapper.classList.add('circular');
    timeline.classList.add('circular');
    if (silent) timeline.classList.add('no-anim');
    const wrapper = timeline.closest('.timeline-wrapper') || timeline.parentElement || timeline;
    let guide = wrapper.querySelector('.circle-guide');
    if (!guide) {
      guide = document.createElement('div');
      guide.className = 'circle-guide';
      guide.style.position = 'absolute';
      guide.style.border = '2px solid var(--line-color)';
      guide.style.borderRadius = '50%';
      guide.style.pointerEvents = 'none';
      guide.style.opacity = '0';
      wrapper.appendChild(guide);
    }

    requestAnimationFrame(() => {
      const tRect = timeline.getBoundingClientRect();
      const cx = tRect.width / 2;
      const cy = tRect.height / 2;
      const radius = Math.min(tRect.width, tRect.height) / 2 - 6;

      pulses.forEach((pulse, idx) => {
        const angle = (idx / lg) * 2 * Math.PI + Math.PI / 2;
        pulse.style.left = `${cx + radius * Math.cos(angle)}px`;
        pulse.style.top = `${cy + radius * Math.sin(angle)}px`;
        pulse.style.transform = 'translate(-50%, -50%)';
      });

      bars.forEach((bar, idx) => {
        const step = idx === 0 ? 0 : lg;
        const angle = (step / lg) * 2 * Math.PI + Math.PI / 2;
        const bx = cx + radius * Math.cos(angle);
        const by = cy + radius * Math.sin(angle);
        const length = Math.min(tRect.width, tRect.height) * 0.22;
        bar.style.display = 'block';
        bar.style.left = `${bx - 1}px`;
        bar.style.top = `${by - length / 2}px`;
        bar.style.height = `${length}px`;
        bar.style.transformOrigin = '50% 50%';
        bar.style.transform = `rotate(${angle + Math.PI / 2}rad)`;
      });

      const numbers = timeline.querySelectorAll('.pulse-number');
      numbers.forEach(label => {
        const idx = parseIntSafe(label.dataset.index);
        const angle = (idx / lg) * 2 * Math.PI + Math.PI / 2;
        const innerRadius = radius - NUMBER_CIRCLE_OFFSET;
        let x = cx + innerRadius * Math.cos(angle);
        let y = cy + innerRadius * Math.sin(angle);
        if (idx === 0) x -= 16;
        else if (idx === lg) x += 16;
        if (idx === 0 || idx === lg) y += 8;
        label.style.left = `${x}px`;
        label.style.top = `${y}px`;
        label.style.transform = 'translate(-50%, -50%)';
      });

      cycleMarkers.forEach(marker => {
        const pos = Number(marker.dataset.position);
        const angle = (pos / lg) * 2 * Math.PI + Math.PI / 2;
        const mx = cx + radius * Math.cos(angle);
        const my = cy + radius * Math.sin(angle);
        marker.style.left = `${mx}px`;
        marker.style.top = `${my}px`;
        marker.style.transformOrigin = '50% 50%';
        marker.style.transform = `translate(-50%, -50%) rotate(${angle + Math.PI / 2}rad)`;
      });

      const labelOffset = 36;
      cycleLabels.forEach(label => {
        const pos = Number(label.dataset.position);
        const angle = (pos / lg) * 2 * Math.PI + Math.PI / 2;
        const lx = cx + (radius + labelOffset) * Math.cos(angle);
        const ly = cy + (radius + labelOffset) * Math.sin(angle);
        label.style.left = `${lx}px`;
        label.style.top = `${ly}px`;
        label.style.transform = 'translate(-50%, -50%)';
      });

      guide.style.left = `${cx}px`;
      guide.style.top = `${cy}px`;
      guide.style.width = `${radius * 2}px`;
      guide.style.height = `${radius * 2}px`;
      guide.style.transform = 'translate(-50%, -50%)';
      guide.style.opacity = '0';

      if (silent) {
        void timeline.offsetHeight;
        timeline.classList.remove('no-anim');
      }
    });
  } else {
    timelineWrapper.classList.remove('circular');
    timeline.classList.remove('circular');
    const wrapper = timeline.closest('.timeline-wrapper') || timeline.parentElement || timeline;
    const guide = wrapper.querySelector('.circle-guide');
    if (guide) guide.style.opacity = '0';

    pulses.forEach((pulse, idx) => {
      const percent = (idx / lg) * 100;
      pulse.style.left = `${percent}%`;
      pulse.style.top = '50%';
      pulse.style.transform = 'translate(-50%, -50%)';
    });

    bars.forEach((bar, idx) => {
      const step = idx === 0 ? 0 : lg;
      const percent = (step / lg) * 100;
      bar.style.display = 'block';
      bar.style.left = `${percent}%`;
      bar.style.top = '15%';
      bar.style.height = '70%';
      bar.style.transform = '';
    });

    const numbers = timeline.querySelectorAll('.pulse-number');
    numbers.forEach(label => {
      const idx = parseIntSafe(label.dataset.index);
      const percent = (idx / lg) * 100;
      label.style.left = `${percent}%`;
      label.style.top = '-28px';
      label.style.transform = 'translate(-50%, 0)';
    });

    cycleMarkers.forEach(marker => {
      const pos = Number(marker.dataset.position);
      const percent = (pos / lg) * 100;
      marker.style.left = `${percent}%`;
      marker.style.top = '50%';
      marker.style.transformOrigin = '50% 50%';
      marker.style.transform = 'translate(-50%, -50%)';
    });

    cycleLabels.forEach(label => {
      const pos = Number(label.dataset.position);
      const percent = (pos / lg) * 100;
      label.style.left = `${percent}%`;
      label.style.top = 'calc(100% + 12px)';
      label.style.transform = 'translate(-50%, 0)';
    });
  }

  updateTIndicatorPosition();
}

function handleInput() {
  if (isUpdating) return;
  const lg = getLg();
  const v = getV();
  if (Number.isFinite(lg) && Number.isFinite(v) && lg > 0 && v > 0) {
    const tSeconds = (lg / v) * 60;
    updateTIndicatorText(tSeconds);
  } else {
    updateTIndicatorText('');
  }
  renderTimeline();
  if (isPlaying && audio) {
    if (Number.isFinite(v) && v > 0 && typeof audio.setTempo === 'function') {
      audio.setTempo(v);
    }
  }
}

function adjustInput(input, delta) {
  if (!input) return;
  const current = parseIntSafe(input.value);
  const next = Number.isFinite(current) ? Math.max(1, current + delta) : delta > 0 ? 1 : 1;
  setValue(input, next);
  handleInput();
}

[inputLg, inputV].forEach(el => {
  el.addEventListener('input', () => {
    const val = el === inputV ? parseFloatSafe(el.value) : parseIntSafe(el.value);
    if (!Number.isFinite(val) || val <= 0) return handleInput();
    if (el === inputLg) setValue(el, Math.max(1, Math.round(val)));
    else setValue(el, Math.max(1, Math.round(val)));
    handleInput();
  });
  el.addEventListener('blur', () => {
    const val = el === inputV ? parseFloatSafe(el.value) : parseIntSafe(el.value);
    if (!Number.isFinite(val) || val <= 0) {
      setValue(el, '');
    } else {
      const normalized = Math.max(1, Math.round(val));
      setValue(el, normalized);
    }
    handleInput();
  });
});

inputLgUp?.addEventListener('click', () => adjustInput(inputLg, +1));
inputLgDown?.addEventListener('click', () => adjustInput(inputLg, -1));
inputVUp?.addEventListener('click', () => adjustInput(inputV, +1));
inputVDown?.addEventListener('click', () => adjustInput(inputV, -1));

function randomInt(min, max) {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

let randomConfig = (() => {
  try {
    const stored = loadOpt('random');
    return stored ? { ...randomDefaults, ...JSON.parse(stored) } : { ...randomDefaults };
  } catch {
    return { ...randomDefaults };
  }
})();

function applyRandomConfig(cfg) {
  randLgToggle.checked = cfg.Lg.enabled;
  randLgMin.value = cfg.Lg.range[0];
  randLgMax.value = cfg.Lg.range[1];
  randVToggle.checked = cfg.V.enabled;
  randVMin.value = cfg.V.range[0];
  randVMax.value = cfg.V.range[1];
  randNToggle.checked = cfg.n.enabled;
  randNMin.value = cfg.n.range[0];
  randNMax.value = cfg.n.range[1];
  randDToggle.checked = cfg.d.enabled;
  randDMin.value = cfg.d.range[0];
  randDMax.value = cfg.d.range[1];
  randComplexToggle.checked = cfg.allowComplex;
}

function updateRandomConfig() {
  randomConfig = {
    Lg: {
      enabled: randLgToggle.checked,
      range: clampRange(randLgMin.value, randLgMax.value, randomDefaults.Lg.range[0], randomDefaults.Lg.range[1])
    },
    V: {
      enabled: randVToggle.checked,
      range: clampRange(randVMin.value, randVMax.value, randomDefaults.V.range[0], randomDefaults.V.range[1])
    },
    n: {
      enabled: randNToggle.checked,
      range: clampRange(randNMin.value, randNMax.value, randomDefaults.n.range[0], randomDefaults.n.range[1])
    },
    d: {
      enabled: randDToggle.checked,
      range: clampRange(randDMin.value, randDMax.value, randomDefaults.d.range[0], randomDefaults.d.range[1])
    },
    allowComplex: randComplexToggle.checked
  };
  saveOpt('random', JSON.stringify(randomConfig));
}

applyRandomConfig(randomConfig);

[
  randLgToggle, randLgMin, randLgMax,
  randVToggle, randVMin, randVMax,
  randNToggle, randNMin, randNMax,
  randDToggle, randDMin, randDMax,
  randComplexToggle
].forEach(el => el?.addEventListener('change', updateRandomConfig));

function randomize() {
  const cfg = randomConfig;
  if (cfg.Lg.enabled) {
    const [min, max] = cfg.Lg.range;
    setValue(inputLg, randomInt(min, max));
  }
  if (cfg.V.enabled) {
    const [min, max] = cfg.V.range;
    setValue(inputV, randomInt(min, max));
  }
  if (cfg.n.enabled) {
    let [min, max] = cfg.n.range;
    if (!cfg.allowComplex) {
      min = 1;
      max = 1;
    }
    setValue(numeratorInput, Math.max(1, randomInt(min, max)));
  }
  if (cfg.d.enabled) {
    const [min, max] = cfg.d.range;
    setValue(denominatorInput, Math.max(1, randomInt(min, max)));
  }
  handleInput();
}

initRandomMenu(randomBtn, randomMenu, randomize);

function highlightPulse(index) {
  if (!isPlaying) return;
  pulses.forEach(p => p.classList.remove('active'));
  const lg = pulses.length;
  if (!lg) return;
  const idx = index % lg;
  const pulse = pulses[idx];
  if (pulse) {
    void pulse.offsetWidth;
    pulse.classList.add('active');
  }
  if (loopEnabled && idx === 0) {
    const last = pulses[pulses.length - 1];
    if (last) last.classList.add('active');
  }
}

function highlightCycle({ cycleIndex, subdivisionIndex }) {
  if (!isPlaying) return;
  cycleMarkers.forEach(m => m.classList.remove('active'));
  cycleLabels.forEach(l => l.classList.remove('active'));
  const marker = cycleMarkers.find(m => Number(m.dataset.cycleIndex) === cycleIndex && Number(m.dataset.subdivision) === subdivisionIndex);
  const label = cycleLabels.find(l => Number(l.dataset.cycleIndex) === cycleIndex && Number(l.dataset.subdivision) === subdivisionIndex);
  if (marker) {
    void marker.offsetWidth;
    marker.classList.add('active');
  }
  if (label) label.classList.add('active');
}

async function startPlayback() {
  const lg = getLg();
  const v = getV();
  const { numerator, denominator } = getFraction();
  if (!Number.isFinite(lg) || !Number.isFinite(v) || lg <= 0 || v <= 0) return;
  const hasCycle = Number.isFinite(numerator) && Number.isFinite(denominator)
    && numerator > 0 && denominator > 0 && Math.floor(lg / numerator) > 0;

  const audioInstance = await initAudio();
  await audioInstance.setBase(baseSoundSelect?.dataset.value || baseSoundSelect?.value);
  await audioInstance.setStart(startSoundSelect?.dataset.value || startSoundSelect?.value);
  if (audioInstance.setCycleStart) {
    await audioInstance.setCycleStart(cycleStartSoundSelect?.dataset.value || cycleStartSoundSelect?.value);
  }
  await audioInstance.setCycle(cycleSoundSelect?.dataset.value || cycleSoundSelect?.value);

  const interval = 60 / v;
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

  const iconPlay = playBtn.querySelector('.icon-play');
  const iconStop = playBtn.querySelector('.icon-stop');

  audioInstance.play(
    lg,
    interval,
    new Set(),
    loopEnabled,
    highlightPulse,
    onFinish,
    hasCycle ? { cycle: { numerator, denominator, onTick: highlightCycle } } : undefined
  );

  isPlaying = true;
  playBtn.classList.add('active');
  if (iconPlay && iconStop) {
    iconPlay.style.display = 'none';
    iconStop.style.display = 'block';
  }
  revealTAfter();
}

playBtn.addEventListener('click', async () => {
  const audioInstance = await initAudio();
  if (isPlaying) {
    audioInstance.stop();
    isPlaying = false;
    playBtn.classList.remove('active');
    clearHighlights();
    const iconPlay = playBtn.querySelector('.icon-play');
    const iconStop = playBtn.querySelector('.icon-stop');
    if (iconPlay && iconStop) {
      iconPlay.style.display = 'block';
      iconStop.style.display = 'none';
    }
    return;
  }
  clearHighlights();
  startPlayback();
});

loopBtn.addEventListener('click', () => {
  loopEnabled = !loopEnabled;
  loopBtn.classList.toggle('active', loopEnabled);
  if (audio && typeof audio.setLoop === 'function') {
    audio.setLoop(loopEnabled);
  }
  layoutTimeline();
});

resetBtn.addEventListener('click', () => {
  ['Lg', 'V', 'n', 'd'].forEach(clearOpt);
  loopEnabled = false;
  loopBtn.classList.remove('active');
  circularTimeline = false;
  circularTimelineToggle.checked = false;
  saveOpt('circular', '0');
  if (audio) audio.stop();
  isPlaying = false;
  clearHighlights();
  applyInitialState();
  const iconPlay = playBtn.querySelector('.icon-play');
  const iconStop = playBtn.querySelector('.icon-stop');
  if (iconPlay && iconStop) {
    iconPlay.style.display = 'block';
    iconStop.style.display = 'none';
  }
});

function tapTempo() {
  const now = performance.now();
  tapTimes.push(now);
  tapTimes = tapTimes.slice(-6);
  if (tapTimes.length >= 2) {
    const intervals = [];
    for (let i = 1; i < tapTimes.length; i++) {
      intervals.push(tapTimes[i] - tapTimes[i - 1]);
    }
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    if (avg > 0) {
      const bpm = Math.max(20, Math.min(400, Math.round(60000 / avg)));
      setValue(inputV, bpm);
      handleInput();
    }
  }
  if (tapHelp) {
    tapHelp.style.display = tapTimes.length < 3 ? 'inline' : 'none';
  }
  clearTimeout(tapTimeout);
  tapTimeout = setTimeout(() => {
    tapTimes = [];
    if (tapHelp) tapHelp.style.display = 'inline';
  }, 2500);
}

tapBtn.addEventListener('click', tapTempo);

function setCircular(value) {
  circularTimeline = value;
  circularTimelineToggle.checked = value;
  saveOpt('circular', value ? '1' : '0');
  layoutTimeline();
}

const storedCircular = loadOpt('circular') === '1';
setCircular(storedCircular);

circularTimelineToggle.addEventListener('change', () => {
  setCircular(circularTimelineToggle.checked);
});

function setupSoundDropdowns() {
  initSoundDropdown(baseSoundSelect, {
    storageKey: 'baseSound',
    eventType: 'baseSound',
    getAudio: initAudio,
    apply: (a, val) => a.setBase(val)
  });
  initSoundDropdown(startSoundSelect, {
    storageKey: 'startSound',
    eventType: 'startSound',
    getAudio: initAudio,
    apply: (a, val) => a.setStart(val)
  });
  initSoundDropdown(cycleStartSoundSelect, {
    storageKey: 'cycleStartSound',
    eventType: 'cycleStartSound',
    getAudio: initAudio,
    apply: (a, val) => (a && typeof a.setCycleStart === 'function' ? a.setCycleStart(val) : undefined)
  });
  initSoundDropdown(cycleSoundSelect, {
    storageKey: 'cycleSound',
    eventType: 'cycleSound',
    getAudio: initAudio,
    apply: (a, val) => a.setCycle(val)
  });
}

setupSoundDropdowns();

function applyInitialState() {
  setValue(inputLg, '');
  setValue(inputV, '');
  setValue(numeratorInput, '');
  setValue(denominatorInput, '');
  tapTimes = [];
  clearTimeout(tapTimeout);
  tapTimeout = null;
  if (tapHelp) tapHelp.style.display = 'inline';
  handleInput();
}

function initDefaults() {
  const storedLg = parseIntSafe(loadOpt('Lg'));
  const storedV = parseFloatSafe(loadOpt('V'));
  const storedN = parseIntSafe(loadOpt('n'));
  const storedD = parseIntSafe(loadOpt('d'));
  const hasStored = (
    (Number.isFinite(storedLg) && storedLg > 0)
    || (Number.isFinite(storedV) && storedV > 0)
    || (Number.isFinite(storedN) && storedN > 0)
    || (Number.isFinite(storedD) && storedD > 0)
  );

  if (!hasStored) {
    applyInitialState();
    return;
  }

  setValue(inputLg, Number.isFinite(storedLg) && storedLg > 0 ? storedLg : '');
  const validV = Number.isFinite(storedV) && storedV > 0 ? Math.round(storedV) : '';
  setValue(inputV, validV);
  setValue(numeratorInput, Number.isFinite(storedN) && storedN > 0 ? storedN : '');
  setValue(denominatorInput, Number.isFinite(storedD) && storedD > 0 ? storedD : '');
  handleInput();
  tapTimes = [];
  clearTimeout(tapTimeout);
  tapTimeout = null;
  if (tapHelp) tapHelp.style.display = 'inline';
}

initDefaults();

[inputLg, inputV, numeratorInput, denominatorInput].forEach((el, idx) => {
  el.addEventListener('change', () => {
    const keys = ['Lg', 'V', 'n', 'd'];
    const raw = typeof el.value === 'string' ? el.value.trim() : el.value;
    if (raw === '' || raw == null) clearOpt(keys[idx]);
    else saveOpt(keys[idx], raw);
  });
});

window.addEventListener('resize', () => layoutTimeline({ silent: true }));

handleInput();
