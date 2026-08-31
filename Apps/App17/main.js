/**
 * App17 - Módulo Temporal - Compases
 *
 * Redisseny des del donut circular: timeline lineal estil App16 que pot
 * albergar fins a 6 compases (2-12 pulsos cadascun) amb scroll horitzontal.
 * Durant el playback, l'scroll segueix la reproducció amb un lliscament
 * suau a cada canvi de compás.
 */

import { createRhythmAudioInitializer, setupAudioDefaults, CHANNEL_TIERS, createMixerPersistence } from '../../libs/app-common/audio-init.js';
import { createSchedulingBridge, bindSharedSoundEvents } from '../../libs/app-common/audio.js';
import { initMixerMenu } from '../../libs/app-common/mixer-menu.js';
import { initRandomMenu } from '../../libs/random/index.js';
import { createPreferenceStorage, registerFactoryReset } from '../../libs/app-common/preferences.js';
import { showValidationWarning } from '../../libs/app-common/info-tooltip.js';
import { attachSpinnerRepeat } from '../../libs/app-common/spinner-repeat.js';
import { createCycleSuperscript } from '../../libs/app-common/cycle-superscript.js';
import { createTotalLengthDisplay } from '../../libs/app-common/total-length-display.js';
import { createBpmController } from '../../libs/app-common/bpm-controller.js';
import { initIdleCaretFlash } from '../../libs/app-common/idle-caret-flash.js';
import { createMeasureHeader } from '../../libs/shared-ui/measure-header.js';
import { smoothScrollTo } from '../../libs/plano-modular/plano-scroll.js';

// ============================================
// CONSTANTS
// ============================================

const MIN_COMPAS = 2;         // Mínim de pulsos per compás (manual i random)
const MAX_COMPAS = 12;        // Màxim de pulsos per compás (manual i random)
const MIN_CYCLES = 1;         // Mínim de compases
const MAX_CYCLES = 6;         // Màxim de compases
const DEFAULT_BPM = 90;
const MIN_BPM = 50;
const MAX_BPM = 150;
const AUTO_JUMP_DELAY = 2000; // ms abans de l'auto-salt Compás→Cycle (ENTER salta a l'instant)
const SCROLL_GLIDE_MS = 940;  // Durada del lliscament d'scroll al canvi de compás.
                              // Ajustada a l'alça dues vegades (600 → 750 → 940,
                              // +25% cada cop): dins l'iframe del sistema el
                              // moviment ha de ser ben visible per a tothom.

// ============================================
// STATE
// ============================================

let audio = null;
let bpmController = null;
let isPlaying = false;
let pulsosCompas = null;      // Starts as null (empty input)
let cycles = null;            // Nº de compases; també comença buit
let numberEls = [];           // DOM .pulse-number elements (per índex absolut)
let lastNumberEl = null;
let p0Enabled = true;         // P0 toggle state (not persisted between sessions)
let autoJumpTimer = null;     // Timer d'auto-salt Compás→Cycle (i validació diferida del "1")

// ============================================
// DOM ELEMENTS
// ============================================

let inputCompas;
let compasUpBtn;
let compasDownBtn;
let inputCycle;
let timeline;
let timelineWrapper;
let scrollEl;                 // #timelineScroll — contenidor amb overflow-x
let playBtn;
let resetBtn;
let randomBtn;
let randomMenu;
let superscriptController;    // Superíndexs de cicle (mode linear, com App16)
let totalLengthController;    // Pastilla "Longitud": total en repòs, conteig durant play
let measureHeader;            // Capçalera "Compás" compartida (marcadors 1..cycles)

// ============================================
// STORAGE
// ============================================

const preferenceStorage = createPreferenceStorage({ prefix: 'app17', separator: '-' });
const MIXER_STORAGE_KEY = 'app17-mixer';

// ============================================
// AUDIO SETUP
// ============================================

const schedulingBridge = createSchedulingBridge({ getAudio: () => audio });
window.addEventListener('sharedui:scheduling', schedulingBridge.handleSchedulingEvent);

bindSharedSoundEvents({
  getAudio: () => audio,
  mapping: {
    baseSound: 'setBase',
    startSound: 'setStart'
  }
});

const _baseInitAudio = createRhythmAudioInitializer({
  getSoundSelects: () => ({
    baseSoundSelect: document.querySelector('[data-sound-type="base"]'),
    startSoundSelect: document.querySelector('[data-sound-type="start"]')
  }),
  schedulingBridge,
  channels: [
    { id: 'start', options: { allowSolo: true, label: 'P0' }, assignment: 'start' }
  ],
  defaultInstrument: 'piano'
});

const mixerPersist = createMixerPersistence({ storageKey: MIXER_STORAGE_KEY });

async function initAudio() {
  if (!audio) {
    audio = await _baseInitAudio();
    if (audio) {
      setupAudioDefaults(audio, { channels: CHANNEL_TIERS.RHYTHM_ACCENT });
      mixerPersist.hydrate(audio);
      mixerPersist.subscribe(audio);
    }
    if (typeof window !== 'undefined') window.__labAudio = audio;
  }
  return audio;
}

if (typeof window !== 'undefined') {
  window.__labInitAudio = initAudio;
}

// ============================================
// TIMELINE RENDER
// ============================================

/**
 * Cycles efectius per al render: mentre l'usuari encara no ha posat el
 * Nº de compases, es mostra un sol compás (la pastilla Longitud, en canvi,
 * només mostra el total quan hi ha tots dos valors).
 */
function getEffectiveCycles() {
  return cycles ?? 1;
}

function getTotalPulses() {
  if (pulsosCompas === null) return 0;
  return pulsosCompas * getEffectiveCycles();
}

/**
 * Render de la línia sencera: números amb superíndex per compás (mode
 * linear del cycle-superscript), marcador final `·` i capçalera "Compás"
 * amb un marcador numerat per compás. L'amplada del contingut d'scroll
 * es governa amb --total-pulses (vegeu styles.css).
 */
function renderTimeline() {
  if (!timeline) return;

  // Fora les classes del donut circular (redisseny lineal).
  timeline.classList.remove('circular');
  timelineWrapper?.classList.remove('circular');

  timeline.innerHTML = '';
  numberEls = [];
  lastNumberEl = null;

  const totalPulses = getTotalPulses();
  timelineWrapper?.style.setProperty('--total-pulses', String(totalPulses));

  if (totalPulses === 0) {
    measureHeader?.render(null, 0);
    return;
  }

  for (let i = 0; i < totalPulses; i++) {
    // createNumberElement posa el superíndex del compás i marca cycle-start.
    const label = superscriptController.createNumberElement(i);
    label.style.setProperty('--pulse-left', `calc((100% - 2 * var(--tl-inset)) * ${i / totalPulses})`);
    timeline.appendChild(label);
    numberEls.push(label);
  }

  // Marcador final: `·` amb doble barra al límit dret de la zona útil.
  const endLabel = document.createElement('div');
  endLabel.className = 'pulse-number cycle-start cycle-end';
  endLabel.textContent = '·';
  endLabel.style.setProperty('--pulse-left', 'calc(100% - 2 * var(--tl-inset))');
  endLabel.dataset.index = String(totalPulses);
  timeline.appendChild(endLabel);

  measureHeader?.render(pulsosCompas, getEffectiveCycles());
}

// ============================================
// TOTAL LENGTH (pastilla "Longitud")
// ============================================

function updateTotalLength() {
  totalLengthController?.showTotal();
}

// ============================================
// SCROLL
// ============================================

/**
 * Porta un compás a la vista amb un lliscament suau (mai un salt sec):
 * el downbeat queda a tocar de la vora esquerra amb 3/4 de pols de
 * context del compás anterior. No fa res si tot cap sense scroll.
 */
function scrollToMeasure(measureIndex, { animated = true } = {}) {
  if (!scrollEl || !timeline || !pulsosCompas) return;
  const maxScroll = scrollEl.scrollWidth - scrollEl.clientWidth;
  if (maxScroll <= 0) return;

  let target = 0;
  if (measureIndex > 0) {
    const el = numberEls[measureIndex * pulsosCompas];
    if (!el) return;
    const pulseSpacing = timeline.clientWidth / Math.max(getTotalPulses(), 1);
    // offsetLeft del número = centre del pols dins .timeline; el marge del
    // timeline (banda groga) s'afegeix via timeline.offsetLeft.
    target = timeline.offsetLeft + el.offsetLeft - pulseSpacing * 0.75;
    target = Math.max(0, Math.min(maxScroll, target));
  }

  if (Math.abs(scrollEl.scrollLeft - target) < 2) return;
  if (animated) {
    smoothScrollTo(scrollEl, target, 'left', SCROLL_GLIDE_MS, 'easeInOut');
  } else {
    scrollEl.scrollLeft = target;
  }
}

// ============================================
// VISUAL FEEDBACK
// ============================================

/**
 * Flash a circle element to indicate missing input
 */
function flashMissingInput(element) {
  if (!element) return;
  element.classList.add('flash-warning');
  setTimeout(() => {
    element.classList.remove('flash-warning');
  }, 1000);
}

// ============================================
// HIGHLIGHTING
// ============================================

/**
 * Highlight del pols actiu per índex ABSOLUT (mode linear: cada pols té el
 * seu número únic, sense mòdul visual).
 */
function highlightPulse(step) {
  if (lastNumberEl) lastNumberEl.classList.remove('active');
  const numberEl = numberEls[step] || null;
  if (numberEl) numberEl.classList.add('active');
  lastNumberEl = numberEl;
}

/**
 * Marca el compás en curs a la capçalera (cercle groc al marcador actiu).
 * `measureIndex` és 0-based; null neteja.
 */
function highlightMeasureMarker(measureIndex) {
  const track = document.querySelector('#measureHeader .measure-header__track');
  if (!track) return;
  track.querySelectorAll('.measure-marker.is-current').forEach(m => m.classList.remove('is-current'));
  if (measureIndex === null) return;
  track.querySelector(`.measure-marker[data-cycle="${measureIndex}"]`)?.classList.add('is-current');
}

function clearHighlights() {
  numberEls.forEach(n => n.classList.remove('active'));
  lastNumberEl = null;
  highlightMeasureMarker(null);
}

// ============================================
// PLAYBACK
// ============================================

async function handlePlay() {
  if (isPlaying) {
    stopPlayback();
    return;
  }

  // Flash missing inputs if trying to play without values
  if (pulsosCompas === null || cycles === null) {
    if (pulsosCompas === null) {
      flashMissingInput(inputCompas?.closest('.pl-primary'));
    }
    if (cycles === null) {
      flashMissingInput(document.querySelector('.pl-secondary.cycle-circle'));
    }
    return;
  }

  const audioInstance = await initAudio();
  if (!audioInstance) return;

  isPlaying = true;

  // Comencem sempre des de l'inici de la línia.
  if (scrollEl) scrollEl.scrollLeft = 0;
  clearHighlights();

  // Update play button state
  playBtn?.classList.add('active');
  const iconPlay = playBtn?.querySelector('.icon-play');
  const iconStop = playBtn?.querySelector('.icon-stop');
  if (iconPlay) iconPlay.style.display = 'none';
  if (iconStop) iconStop.style.display = 'block';

  // Disable random button during playback
  if (randomBtn) randomBtn.disabled = true;

  const intervalSec = 60 / (bpmController?.getValue() || DEFAULT_BPM);
  const totalPulses = pulsosCompas * cycles;

  // Sistema Measure: P0 sona a 0, pulsosCompas, pulsosCompas*2, ...
  audioInstance.configureMeasure(pulsosCompas, totalPulses);
  audioInstance.setMeasureEnabled(p0Enabled);

  audioInstance.play(
    totalPulses,
    intervalSec,
    new Set(),    // No selected pulses
    false,        // NO loop (finite cycles)
    (step) => {
      highlightPulse(step);

      const pulseInCycle = step % pulsosCompas;
      const cycleNumber = Math.floor(step / pulsosCompas) + 1;

      // Conteig global (1..total) a la pastilla Longitud.
      totalLengthController?.updateGlobalStep(pulseInCycle, cycleNumber);

      // Downbeat: marca el compás a la capçalera i llisca-hi l'scroll.
      if (pulseInCycle === 0) {
        highlightMeasureMarker(cycleNumber - 1);
        scrollToMeasure(cycleNumber - 1);
      }
    },
    () => {
      // onComplete fires right after the worklet emits the final pulse, but
      // the scheduled click sample is still ringing out. Defer the stop just
      // long enough for the last click to finish.
      setTimeout(() => {
        audio?.stop();
        stopPlayback(false);
      }, 590);
    }
  );
}

/**
 * Stop playback and reset UI.
 * @param {boolean} forceStop - If true, calls audio.stop(). If false (onComplete), audio engine handles timing.
 */
function stopPlayback(forceStop = true) {
  isPlaying = false;

  // Only force stop if user clicked stop (not on natural completion)
  // The audio engine already handles the delay to let the last pulse finish
  if (forceStop) {
    audio?.stop();
  }

  // Update play button state
  playBtn?.classList.remove('active');
  const iconPlay = playBtn?.querySelector('.icon-play');
  const iconStop = playBtn?.querySelector('.icon-stop');
  if (iconPlay) iconPlay.style.display = 'block';
  if (iconStop) iconStop.style.display = 'none';

  // Re-enable random button after playback
  if (randomBtn) randomBtn.disabled = false;

  clearHighlights();

  // La pastilla Longitud torna a mostrar el total.
  totalLengthController?.reset();
}

// ============================================
// COMPÁS INPUT HANDLING
// ============================================

function handleCompasChange(newValue, opts = {}) {
  // `opts.lenient` marca una edició en curs (event 'input'): un "1" pot ser
  // el prefix de 10-12, així que no avisem ni esborrem res — la validació
  // estricta arriba al blur, a l'ENTER o quan venç el timer d'auto-salt.
  // `opts.autoJump` salta el focus a l'input Cycle en confirmar un valor
  // vàlid (el flux de tecleig Compás→Cycle de sempre).
  if (autoJumpTimer) {
    clearTimeout(autoJumpTimer);
    autoJumpTimer = null;
  }

  // Handle empty input
  if (newValue === '' || newValue === null || newValue === undefined) {
    pulsosCompas = null;
    renderTimeline();
    updateTotalLength();
    return;
  }

  const parsed = parseInt(newValue, 10);

  // Invalid number
  if (isNaN(parsed)) {
    showValidationWarning(inputCompas, 'Introduce un número válido', 2000);
    if (inputCompas) {
      inputCompas.value = '';
      inputCompas.focus();
    }
    return;
  }

  // Prefix possible de 10-12 mentre s'escriu: estat pendent (línia buida).
  // Si el segon dígit no arriba, el timer aplica la validació estricta.
  if (opts.lenient && parsed === 1) {
    pulsosCompas = null;
    renderTimeline();
    updateTotalLength();
    autoJumpTimer = setTimeout(() => {
      autoJumpTimer = null;
      handleCompasChange(inputCompas?.value ?? '');
    }, AUTO_JUMP_DELAY);
    return;
  }

  // Validate range
  if (parsed < MIN_COMPAS) {
    showValidationWarning(inputCompas, `El mínimo es <strong>${MIN_COMPAS}</strong>`, 2000);
    if (inputCompas) {
      inputCompas.value = '';
      inputCompas.focus();
    }
    return;
  } else if (parsed > MAX_COMPAS) {
    showValidationWarning(inputCompas, `El máximo es <strong>${MAX_COMPAS}</strong>`, 2000);
    if (inputCompas) {
      inputCompas.value = '';
      inputCompas.focus();
    }
    return;
  } else {
    pulsosCompas = parsed;
    if (inputCompas) inputCompas.value = pulsosCompas;
  }

  renderTimeline();
  updateTotalLength();
  saveState();

  if (opts.autoJump && inputCycle) {
    inputCycle.focus();
    inputCycle.select();
  }
}

function incrementCompas() {
  const current = pulsosCompas ?? (MIN_COMPAS - 1);   // primer clic des de buit → MIN_COMPAS
  if (current < MAX_COMPAS) {
    handleCompasChange(current + 1);
  }
}

function decrementCompas() {
  const current = pulsosCompas ?? (MIN_COMPAS + 1);   // primer clic des de buit → MIN_COMPAS
  if (current > MIN_COMPAS) {
    handleCompasChange(current - 1);
  }
}

// ============================================
// CYCLE INPUT HANDLING
// ============================================

function handleCycleChange(newValue) {
  // Mateix patró que el compás: fora de rang → avís amb el límit i input
  // buit perquè l'usuari entri un valor acceptat (res de clamp silenciós).
  // Handle empty input
  if (newValue === '' || newValue === null || newValue === undefined) {
    cycles = null;
    if (inputCycle) inputCycle.value = '';
    renderTimeline();
    updateTotalLength();
    return;
  }

  const parsed = parseInt(newValue, 10);

  if (isNaN(parsed)) {
    showValidationWarning(inputCycle, 'Introduce un número válido', 2000);
    if (inputCycle) {
      inputCycle.value = '';
      inputCycle.focus();
    }
    return;
  }

  if (parsed < MIN_CYCLES) {
    showValidationWarning(inputCycle, `El mínimo es <strong>${MIN_CYCLES}</strong>`, 2000);
    if (inputCycle) {
      inputCycle.value = '';
      inputCycle.focus();
    }
    return;
  } else if (parsed > MAX_CYCLES) {
    showValidationWarning(inputCycle, `El máximo es <strong>${MAX_CYCLES}</strong>`, 2000);
    if (inputCycle) {
      inputCycle.value = '';
      inputCycle.focus();
    }
    return;
  }

  cycles = parsed;
  if (inputCycle) inputCycle.value = cycles;
  renderTimeline();
  updateTotalLength();
  saveState();
}

// ============================================
// RANDOM
// ============================================

function handleRandom() {
  const maxPulsosInput = parseInt(document.getElementById('randPulsosMax')?.value || String(MAX_COMPAS), 10);
  const maxCyclesInput = parseInt(document.getElementById('randCyclesMax')?.value || String(MAX_CYCLES), 10);

  const maxPulsos = Math.min(Math.max(maxPulsosInput, MIN_COMPAS), MAX_COMPAS);
  const maxCycles = Math.min(Math.max(maxCyclesInput, MIN_CYCLES), MAX_CYCLES);

  const newPulsos = Math.floor(Math.random() * (maxPulsos - MIN_COMPAS + 1)) + MIN_COMPAS;
  const newCycles = Math.floor(Math.random() * (maxCycles - MIN_CYCLES + 1)) + MIN_CYCLES;

  handleCompasChange(newPulsos);
  handleCycleChange(newCycles);
}

// ============================================
// RESET
// ============================================

function handleReset() {
  stopPlayback();

  pulsosCompas = null;
  if (inputCompas) {
    inputCompas.value = '';
    inputCompas.focus();
  }

  cycles = null;
  if (inputCycle) {
    inputCycle.value = '';
  }

  renderTimeline();
  updateTotalLength();
  if (scrollEl) scrollEl.scrollLeft = 0;
}

// ============================================
// STATE PERSISTENCE
// ============================================

function saveState() {
  // Compás i Cycle comencen sempre buits (flux d'aprenentatge); només
  // persistim la configuració del menú random.
  preferenceStorage.save({
    randPulsosMax: parseInt(document.getElementById('randPulsosMax')?.value || String(MAX_COMPAS), 10),
    randCyclesMax: parseInt(document.getElementById('randCyclesMax')?.value || String(MAX_CYCLES), 10)
  });
}

function loadState() {
  const prefs = preferenceStorage.load();

  if (prefs?.randPulsosMax) {
    const randInput = document.getElementById('randPulsosMax');
    if (randInput) randInput.value = prefs.randPulsosMax;
  }
  if (prefs?.randCyclesMax) {
    const randInput = document.getElementById('randCyclesMax');
    if (randInput) randInput.value = prefs.randCyclesMax;
  }
}

// ============================================
// INITIALIZATION
// ============================================

async function initializeApp() {
  // Get DOM references
  inputCompas = document.getElementById('inputCompas');
  compasUpBtn = document.getElementById('compasUp');
  compasDownBtn = document.getElementById('compasDown');
  inputCycle = document.getElementById('inputCycle');
  timeline = document.getElementById('timeline');
  timelineWrapper = document.getElementById('timelineWrapper');
  playBtn = document.getElementById('playBtn');
  resetBtn = document.getElementById('resetBtn');
  randomBtn = document.getElementById('randomBtn');
  randomMenu = document.getElementById('randomMenu');

  // Contenidor d'scroll: capçalera "Compás" + timeline scrollen solidàries.
  // #timelineScroll > .tl-scroll-content > (#measureHeader + #timeline)
  if (timelineWrapper && timeline && !document.getElementById('timelineScroll')) {
    scrollEl = document.createElement('div');
    scrollEl.id = 'timelineScroll';
    const content = document.createElement('div');
    content.className = 'tl-scroll-content';
    scrollEl.appendChild(content);
    timelineWrapper.insertBefore(scrollEl, timeline);

    const headerEl = document.createElement('section');
    headerEl.id = 'measureHeader';
    headerEl.className = 'measure-header is-empty';
    content.appendChild(headerEl);
    content.appendChild(timeline);   // mou el #timeline existent dins l'scroll

    measureHeader = createMeasureHeader({ container: headerEl, labelText: 'Compás' });
  }

  // Move BPM to controls row (Play | BPM | Random | Reset)
  const bpmParam = document.getElementById('bpmParam');
  const controls = document.querySelector('.controls');
  if (controls && bpmParam) {
    const playBtnEl = controls.querySelector('.play') || playBtn;
    const randomBtnEl = controls.querySelector('.random');
    const resetBtnEl = controls.querySelector('.reset');
    const randomMenuEl = controls.querySelector('.random-menu');

    while (controls.firstChild) controls.removeChild(controls.firstChild);

    if (playBtnEl) controls.appendChild(playBtnEl);
    controls.appendChild(bpmParam);
    if (randomBtnEl) controls.appendChild(randomBtnEl);
    if (randomMenuEl) controls.appendChild(randomMenuEl);
    if (resetBtnEl) controls.appendChild(resetBtnEl);
  }

  // Create BPM controller
  bpmController = createBpmController({
    inputEl: document.getElementById('inputBpm'),
    upBtn: document.getElementById('bpmUp'),
    downBtn: document.getElementById('bpmDown'),
    container: document.getElementById('bpmParam'),
    min: MIN_BPM,
    max: MAX_BPM,
    defaultValue: DEFAULT_BPM
  });
  bpmController.attach();

  // Superíndexs per posició (mode linear): 0¹..0².. com App16 multi-compás.
  superscriptController = createCycleSuperscript({
    timeline,
    getPulsosPerCycle: () => pulsosCompas || 1,
    mode: 'linear'
  });

  // Pastilla "Longitud": total (pulsosCompas × cycles) en repòs; durant el
  // playback fa de comptador global 1..total (updateGlobalStep).
  totalLengthController = createTotalLengthDisplay({
    digitElement: document.getElementById('totalLengthDigit'),
    getTotal: () => (pulsosCompas && cycles) ? pulsosCompas * cycles : null,
    getPulsosPerCycle: () => pulsosCompas || 1
  });

  // Load state (només configuració del menú random)
  loadState();

  // Compás i Cycle comencen sempre buits
  if (inputCompas) inputCompas.value = '';
  pulsosCompas = null;
  if (inputCycle) inputCycle.value = '';
  cycles = null;

  renderTimeline();
  updateTotalLength();

  // Give focus to pulsos input
  inputCompas?.focus();

  // Compás input events: tolerant mentre s'escriu, estricte al blur/ENTER.
  inputCompas?.addEventListener('input', (e) => {
    const isDigitTyped = e.inputType === 'insertText' && /^[0-9]$/.test(e.data);
    handleCompasChange(e.target.value, { lenient: true, autoJump: isDigitTyped });
  });

  inputCompas?.addEventListener('keydown', (e) => {
    // ENTER confirma el compás i salta al cycle (com l'auto-salt, però immediat).
    if (e.key !== 'Enter') return;
    e.preventDefault();
    handleCompasChange(inputCompas.value, { autoJump: true });
  });

  inputCompas?.addEventListener('blur', () => {
    // El focus ja ha marxat: validació estricta sense salt.
    handleCompasChange(inputCompas.value);
  });

  // Cycle input events
  inputCycle?.addEventListener('input', (e) => {
    handleCycleChange(e.target.value);
  });

  inputCycle?.addEventListener('keydown', (e) => {
    // ENTER confirma el cycle i treu el focus (sense autoplay). Si el valor
    // era invàlid, l'avís l'ha buidat i el focus es queda per reintentar.
    if (e.key !== 'Enter') return;
    e.preventDefault();
    handleCycleChange(inputCycle.value);
    if (inputCycle.value !== '') inputCycle.blur();
  });

  inputCycle?.addEventListener('blur', () => {
    handleCycleChange(inputCycle.value);
  });

  // Spinner buttons with auto-repeat (Compás only — Cycle has no spinners)
  attachSpinnerRepeat(compasUpBtn, incrementCompas);
  attachSpinnerRepeat(compasDownBtn, decrementCompas);

  // Play button
  playBtn?.addEventListener('click', handlePlay);

  // Reset button
  resetBtn?.addEventListener('click', handleReset);

  // Random menu
  if (randomBtn && randomMenu) {
    initRandomMenu(randomBtn, randomMenu, handleRandom);
  }

  // Initialize mixer
  const mixerMenu = document.getElementById('mixerMenu');
  if (mixerMenu && playBtn) {
    initMixerMenu({
      menu: mixerMenu,
      triggers: [playBtn].filter(Boolean),
      channels: [
        { id: 'start', label: 'P0', allowSolo: true },
        { id: 'pulse', label: 'Pulso', allowSolo: true },
        { id: 'master', label: 'Master', allowSolo: false, isMaster: true }
      ]
    });
  }

  // Persistència del mixer: gestionada via createMixerPersistence dins initAudio

  // Initialize P0 toggle from menu checkbox
  const p0Checkbox = document.getElementById('startIntervalToggle');
  if (p0Checkbox) {
    p0Enabled = true;
    p0Checkbox.checked = true;
    p0Checkbox.addEventListener('change', () => {
      p0Enabled = p0Checkbox.checked;
      if (audio?.setMeasureEnabled) {
        audio.setMeasureEnabled(p0Enabled);
      }
    });
  }

  // Register factory reset
  registerFactoryReset({
    storage: preferenceStorage,
    onBeforeReload: () => {
      stopPlayback();
      localStorage.removeItem('app17:p1Toggle');
      // Clau del toggle de cycle highlight del disseny circular retirat.
      localStorage.removeItem('app17:cycleHighlight');
      localStorage.removeItem(MIXER_STORAGE_KEY);
    }
  });

  // Listen for random settings changes
  document.getElementById('randPulsosMax')?.addEventListener('change', saveState);
  document.getElementById('randCyclesMax')?.addEventListener('change', saveState);

  // Idle caret flash on compás primary pill
  initIdleCaretFlash({ targets: [document.getElementById('inputCompas')?.closest('.pl-primary')] });
}

// Start initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
