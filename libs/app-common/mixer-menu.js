import {
  subscribeMixer,
  setVolume,
  setMute,
  isMuted,
  setChannelVolume,
  setChannelMute,
  toggleChannelSolo,
  getChannelState,
  getMixer
} from '../sound/index.js';
import { initSoundDropdown } from '../shared-ui/sound-dropdown.js';
import { initInstrumentDropdown } from '../shared-ui/instrument-dropdown.js';
import { CANONICAL_FX } from './audio-init.js';

const DEFAULT_LONG_PRESS = 500;

// ── Per-channel sound selectors ──────────────────────────────────────────────
// Each mixer channel can host its own sound/instrument selector right below the
// M/S buttons. The selectors reuse the SAME storage keys + events as the header's
// hidden sound menu, so both views stay in sync with zero per-app wiring.
const CHANNEL_SOUND = {
  pulse:       { kind: 'rhythm', storageKey: 'baseSound',   eventType: 'baseSound',   apply: (a, v) => a?.setBase?.(v),   defaultValue: 'click9' },
  start:       { kind: 'rhythm', storageKey: 'startSound',  eventType: 'startSound',  apply: (a, v) => a?.setStart?.(v),  defaultValue: 'click7' },
  accent:      { kind: 'rhythm', storageKey: 'accentSound', eventType: 'accentSound', apply: (a, v) => a?.setAccent?.(v), defaultValue: 'click8' },
  subdivision: { kind: 'rhythm', storageKey: 'cycleSound',  eventType: 'cycleSound',  apply: (a, v) => a?.setCycle?.(v),  defaultValue: 'click10' },
  instrument:  { kind: 'instrument' }
};

// Canonical channel labels (requested renames). Applied by channel id so every
// app stays consistent without editing each app's config. Any other id keeps the
// label the app passes (e.g. App5's "Intervalos").
const CANONICAL_LABEL_BY_ID = {
  subdivision: 'Fracción',
  instrument: 'Instrumento'
};

function resolveChannelLabel(id, label) {
  if (CANONICAL_LABEL_BY_ID[id]) return CANONICAL_LABEL_BY_ID[id];
  if (id === 'accent') {
    const t = (label || '').trim();
    if (/^(seleccion|acento)$/i.test(t)) return 'Seleccionado';
  }
  return label || id;
}

// Same audio resolution order as the header (libs/shared-ui/header.js)
function getMixerAudio() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.__labAudio) return Promise.resolve(window.__labAudio);
  if (typeof window.__labInitAudio === 'function') {
    return Promise.resolve(window.__labInitAudio())
      .then(a => a || window.__labAudio || window.NuzicAudioEngine || null)
      .catch(() => window.__labAudio || window.NuzicAudioEngine || null);
  }
  return Promise.resolve(window.NuzicAudioEngine || null);
}

function mixerAppId() {
  try {
    const m = (window.location?.pathname || '').match(/App(\d+[A-Za-z]*)/i);
    return m ? m[1].toLowerCase() : null;
  } catch { return null; }
}

// Build the dropdown that lives under a channel's M/S buttons (null if the
// channel controls no selectable sound, e.g. master).
function buildChannelSound(channelId) {
  const desc = CHANNEL_SOUND[channelId];
  if (!desc) return null;
  const container = document.createElement('div');
  container.className = 'mixer-channel__sound';
  if (desc.kind === 'instrument') {
    const appId = mixerAppId();
    initInstrumentDropdown(container, {
      storageKey: appId ? `app${appId}:selectedInstrument` : 'selectedInstrument',
      eventType: 'instrument',
      onSelect: (instrument) => {
        window.dispatchEvent(new CustomEvent('sharedui:instrument', { detail: { instrument } }));
      },
      defaultValue: 'piano'
    });
  } else {
    initSoundDropdown(container, {
      storageKey: desc.storageKey,
      eventType: desc.eventType,
      getAudio: getMixerAudio,
      apply: desc.apply,
      defaultValue: desc.defaultValue
    });
  }
  return container;
}

// Cream (nuzic) background for the mixer specifically. Mirrors solidMenuBackground
// but uses the nuzic palette so the panel is the requested crema, not --bg-light.
function applyMixerBackground(panel) {
  if (!panel) return;
  const dark = document.body?.dataset?.theme === 'dark';
  const body = getComputedStyle(document.body);
  const lightBg = (body.getPropertyValue('--nuzic-light') || '').trim() || '#eee8d8';
  const darkBg = (body.getPropertyValue('--nuzic-dark') || '').trim() || '#43433b';
  panel.style.backgroundColor = dark ? darkBg : lightBg;
  panel.style.color = dark ? lightBg : darkBg;
  panel.style.backgroundImage = 'none';
}

function createLetterIcon(letter) {
  return `\n    <svg aria-hidden="true" viewBox="0 0 40 40" focusable="false">\n      <text x="50%" y="55%" text-anchor="middle" dominant-baseline="middle"\n            font-family="inherit" font-size="48" fill="currentColor">${letter}</text>\n    </svg>\n  `;
}

function clamp01(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(1, num));
}

function createKnob({ label, min, max, value, onChange, inverted = false }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'mixer-knob';

  const labelEl = document.createElement('span');
  labelEl.className = 'mixer-knob__label';
  labelEl.textContent = label;

  const knobContainer = document.createElement('div');
  knobContainer.className = 'mixer-knob__dial';

  // SVG circular knob (compact size for horizontal layout)
  const size = 36;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);

  // Background track
  const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  bgCircle.setAttribute('cx', size / 2);
  bgCircle.setAttribute('cy', size / 2);
  bgCircle.setAttribute('r', radius);
  bgCircle.setAttribute('fill', 'none');
  bgCircle.setAttribute('stroke', 'var(--nuzic-grey, #AAA699)');
  bgCircle.setAttribute('stroke-width', strokeWidth);
  svg.appendChild(bgCircle);

  // Value arc
  const valueArc = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  valueArc.setAttribute('cx', size / 2);
  valueArc.setAttribute('cy', size / 2);
  valueArc.setAttribute('r', radius);
  valueArc.setAttribute('fill', 'none');
  valueArc.setAttribute('stroke', 'var(--nuzic-green, #7cd6b3)');
  valueArc.setAttribute('stroke-width', strokeWidth);
  valueArc.setAttribute('stroke-linecap', 'round');
  valueArc.setAttribute('stroke-dasharray', circumference);
  valueArc.setAttribute('transform', `rotate(-90 ${size / 2} ${size / 2})`);
  svg.appendChild(valueArc);

  knobContainer.appendChild(svg);

  // Hidden input for interaction
  const input = document.createElement('input');
  input.type = 'range';
  // U-04: l'input és un overlay invisible — sense aria-label el lector
  // de pantalla anuncia "slider" anònim per a cada knob d'FX.
  input.setAttribute('aria-label', label);
  input.min = min;
  input.max = max;
  input.step = '1';
  input.value = value;
  input.className = 'mixer-knob__input';
  knobContainer.appendChild(input);

  // Knob readout: integers stay clean, fractional thresholds like -0.5 keep one
  // decimal (Math.round(-0.5) === 0 would otherwise hide the real limiter value).
  const formatKnobValue = (v) => `${Math.round(v * 10) / 10}`;

  // Value display
  const valueDisplay = document.createElement('span');
  valueDisplay.className = 'mixer-knob__value';
  valueDisplay.textContent = formatKnobValue(value);

  // Layout: label (left) | dial (center) | value (right)
  wrapper.appendChild(labelEl);
  wrapper.appendChild(knobContainer);
  wrapper.appendChild(valueDisplay);

  // Update function
  // inverted: for negative-value knobs (Comp, Limit), arc fills from min→max visually inverted
  const updateKnob = (val) => {
    let normalized = (val - min) / (max - min);
    if (inverted) normalized = 1 - normalized; // Invert: full arc at min, empty at max
    const offset = circumference * (1 - normalized * 0.75); // 270° arc
    valueArc.setAttribute('stroke-dashoffset', offset);
    valueDisplay.textContent = formatKnobValue(val);
  };

  updateKnob(value);

  input.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    updateKnob(val);
    onChange(val);
  });

  return { element: wrapper, input, update: updateKnob };
}

export function initMixerMenu({ menu, triggers = [], channels = [], longPress = DEFAULT_LONG_PRESS } = {}) {
  if (!menu || menu.dataset.enhanced === '1') return;
  const triggerButtons = Array.isArray(triggers) ? triggers.filter(Boolean) : [];
  if (!triggerButtons.length) return;

  menu.dataset.enhanced = '1';
  menu.tabIndex = -1;
  if (!menu.getAttribute('role')) {
    menu.setAttribute('role', 'dialog');
  }
  if (!menu.getAttribute('aria-modal')) {
    menu.setAttribute('aria-modal', 'true');
  }
  menu.classList.add('mixer-menu');
  menu.classList.remove('open');

  const titleId = menu.id ? `${menu.id}Title` : 'mixerMenuTitle';
  const title = document.createElement('h2');
  title.className = 'mixer-menu-title mixer-menu-draggable';
  title.id = titleId;
  title.innerHTML = `Mezclador <svg aria-hidden="true" viewBox="0 0 64 40" focusable="false"><g fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"><line x1="12" y1="4" x2="12" y2="36"></line><line x1="32" y1="4" x2="32" y2="36"></line><line x1="52" y1="4" x2="52" y2="36"></line><line x1="8" y1="20" x2="20" y2="20"></line><line x1="28" y1="28" x2="40" y2="28"></line><line x1="48" y1="12" x2="60" y2="12"></line></g></svg>`;
  menu.setAttribute('aria-labelledby', titleId);

  const content = document.createElement('div');
  content.className = 'mixer-menu-content';

  // Per-channel strips on the left; Master + FX share a bordered rack on the right.
  const strips = document.createElement('div');
  strips.className = 'mixer-strips';
  const rack = document.createElement('div');
  rack.className = 'mixer-rack';

  const controlMap = new Map();
  const mixer = getMixer();
  const knownChannels = Array.isArray(channels) && channels.length ? channels : [
    { id: 'pulse', label: 'Pulso', allowSolo: true },
    { id: 'subdivision', label: 'Fracción', allowSolo: true },
    { id: 'master', label: 'Master', allowSolo: false, isMaster: true }
  ];

  // (El toggle ON/OFF "P0" s'ha eliminat del mixer: ara totes les apps
  // exposen P0 com a canal amb slider propi —volum + mute—, així que el
  // toggle era un segon control redundant del mateix so. L'on/off del so
  // d'inici segueix disponible al checkbox del header.)

  knownChannels.forEach((config) => {
    const channelId = config.id;
    if (!channelId) return;
    if (channelId === 'master') {
      if (config.label && typeof mixer?.setMasterLabel === 'function') {
        mixer.setMasterLabel(config.label);
      }
    } else {
      mixer?.registerChannel(channelId, {
        allowSolo: config.allowSolo !== false,
        label: config.label || channelId,
        muted: typeof config.muted === 'boolean' ? config.muted : undefined,
        volume: typeof config.volume === 'number' ? config.volume : undefined
      });
    }
    const wrapper = document.createElement('div');
    wrapper.className = 'mixer-channel';
    wrapper.dataset.channel = channelId;

    const resolvedLabel = resolveChannelLabel(channelId, config.label);
    config.label = resolvedLabel;

    const labelEl = document.createElement('span');
    labelEl.className = 'mixer-channel__label';
    labelEl.textContent = resolvedLabel;
    wrapper.appendChild(labelEl);

    const sliderWrapper = document.createElement('div');
    sliderWrapper.className = 'mixer-channel__slider-wrapper';
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '1';
    slider.step = '0.01';
    slider.value = '0.75';
    slider.className = 'mixer-channel__slider';
    slider.setAttribute('aria-label', `Volumen ${resolvedLabel}`);
    slider.dataset.channel = channelId;
    sliderWrapper.appendChild(slider);
    wrapper.appendChild(sliderWrapper);

    const actions = document.createElement('div');
    actions.className = 'mixer-channel__actions';

    const muteBtn = document.createElement('button');
    muteBtn.type = 'button';
    muteBtn.className = 'mixer-action mixer-action--mute';
    muteBtn.innerHTML = createLetterIcon('M');
    actions.appendChild(muteBtn);

    let soloBtn = null;
    if (!config.isMaster && config.allowSolo !== false) {
      soloBtn = document.createElement('button');
      soloBtn.type = 'button';
      soloBtn.className = 'mixer-action mixer-action--solo';
      soloBtn.innerHTML = createLetterIcon('S');
      actions.appendChild(soloBtn);
    }

    wrapper.appendChild(actions);

    // Per-channel sound/instrument selector below the M/S buttons (synced with header).
    const soundSelector = buildChannelSound(channelId);
    if (soundSelector) wrapper.appendChild(soundSelector);

    if (config.isMaster) {
      wrapper.classList.add('mixer-channel--master');
      rack.appendChild(wrapper);
    } else {
      strips.appendChild(wrapper);
    }

    controlMap.set(channelId, {
      config,
      wrapper,
      slider,
      muteBtn,
      soloBtn,
      labelEl
    });
  });

  // ========== EFFECTS COLUMN ==========
  const fxWrapper = document.createElement('div');
  fxWrapper.className = 'mixer-channel mixer-channel--fx suppressed';
  fxWrapper.dataset.channel = 'fx';

  // Knobs row (Comp · Reverb · Limit) — sits directly under the Master Mute button
  const knobsWrapper = document.createElement('div');
  knobsWrapper.className = 'mixer-channel__knobs';

  // Initial knob values come from CANONICAL_FX (the same defaults setupAudioDefaults
  // applies to every app), so the knobs read correctly even before the audio context
  // exists. Once audio is initialised, openMenu() re-syncs them to the live values.
  const fxDefaults = {
    comp: CANONICAL_FX?.compressor?.threshold ?? -6,
    limit: CANONICAL_FX?.limiter?.threshold ?? -0.5,
    reverb: Math.round((CANONICAL_FX?.reverb?.wet ?? 0) * 100)
  };

  // Compressor knob (threshold range: -18dB to 0dB)
  // inverted: arc fills at -18dB (max compression), empties at 0dB (no compression)
  const compKnob = createKnob({
    label: 'Comp',
    min: -18,
    max: 0,
    value: fxDefaults.comp,
    inverted: true,
    onChange: (val) => window.NuzicAudioEngine?.setCompressorThreshold(val)
  });
  knobsWrapper.appendChild(compKnob.element);

  // Reverb knob (wet amount: 0-75%)
  const reverbKnob = createKnob({
    label: 'Revb',
    min: 0,
    max: 75,
    value: fxDefaults.reverb,
    onChange: (val) => window.NuzicAudioEngine?.setReverbWet(val / 100)
  });
  knobsWrapper.appendChild(reverbKnob.element);

  // Limiter knob (threshold range: -3dB to -0.5dB)
  // inverted: arc fills at -3dB (max limiting), empties at -0.5dB (minimal limiting)
  const limKnob = createKnob({
    label: 'Limit',
    min: -3,
    max: -0.5,
    value: fxDefaults.limit,
    inverted: true,
    onChange: (val) => window.NuzicAudioEngine?.setLimiterThreshold(val)
  });
  knobsWrapper.appendChild(limKnob.element);

  fxWrapper.appendChild(knobsWrapper);

  // Actions row with FX toggle button (P1 style: ON/OFF)
  const fxActions = document.createElement('div');
  fxActions.className = 'mixer-channel__actions mixer-channel__actions--single';

  const fxToggle = document.createElement('button');
  fxToggle.type = 'button';
  fxToggle.className = 'mixer-action mixer-action--fx-toggle';
  fxToggle.setAttribute('aria-label', 'Alternar efectos master');
  fxToggle.innerHTML = `
    <svg aria-hidden="true" viewBox="0 0 40 40" focusable="false" class="icon-on">
      <text x="50%" y="55%" text-anchor="middle" dominant-baseline="middle"
            font-family="inherit" font-size="20" font-weight="bold" fill="currentColor">ON</text>
    </svg>
    <svg aria-hidden="true" viewBox="0 0 40 40" focusable="false" class="icon-off" style="display:none;">
      <text x="50%" y="55%" text-anchor="middle" dominant-baseline="middle"
            font-family="inherit" font-size="20" font-weight="bold" fill="currentColor">OFF</text>
    </svg>
  `;
  fxActions.appendChild(fxToggle);
  fxWrapper.appendChild(fxActions);

  // Master (top, vertical fader) + FX (below) live together in the right rack.
  rack.appendChild(fxWrapper);
  content.appendChild(strips);
  content.appendChild(rack);

  // Store knob references for state sync
  const fxControls = { fxToggle, fxWrapper, compKnob, limKnob, reverbKnob };

  // FX Toggle event listener
  fxToggle.addEventListener('click', () => {
    const audio = window.NuzicAudioEngine;
    if (!audio) return;
    const enabled = !audio.getEffectsEnabled();
    audio.setEffectsEnabled(enabled);

    // Update button UI (P1 style)
    fxToggle.classList.toggle('active', enabled);
    fxWrapper.classList.toggle('suppressed', !enabled);
    const iconOn = fxToggle.querySelector('.icon-on');
    const iconOff = fxToggle.querySelector('.icon-off');
    if (iconOn) iconOn.style.display = enabled ? 'block' : 'none';
    if (iconOff) iconOff.style.display = enabled ? 'none' : 'block';
  });

  menu.innerHTML = '';
  menu.appendChild(title);
  menu.appendChild(content);

  let menuOpen = false;
  let longPressTimer = null;
  let longPressFired = false;

  // Drag state
  let dragState = {
    isDragging: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    menuX: null,
    menuY: null,
    initialMenuLeft: 0,
    initialMenuTop: 0,
    cachedWidth: 0,
    cachedHeight: 0,
    grabOffsetX: 0,
    grabOffsetY: 0
  };

  function resetMenuPosition() {
    menu.style.top = '';
    menu.style.left = '';
    menu.style.transform = '';
    dragState.menuX = null;
    dragState.menuY = null;
  }

  function openMenu() {
    if (menuOpen) return;
    menu.classList.add('open');
    menuOpen = true;
    applyMixerBackground(menu);

    // Synchronize FX effects state when opening
    const audio = window.NuzicAudioEngine;
    if (audio?.getEffectsConfig) {
      const config = audio.getEffectsConfig();
      if (config && fxControls) {
        // Update FX toggle state (P1 style: ON/OFF icons)
        const fxEnabled = config.enabled;
        fxControls.fxToggle.classList.toggle('active', fxEnabled);
        fxControls.fxWrapper.classList.toggle('suppressed', !fxEnabled);
        const iconOn = fxControls.fxToggle.querySelector('.icon-on');
        const iconOff = fxControls.fxToggle.querySelector('.icon-off');
        if (iconOn) iconOn.style.display = fxEnabled ? 'block' : 'none';
        if (iconOff) iconOff.style.display = fxEnabled ? 'none' : 'block';

        // Update knob values
        fxControls.compKnob.update(config.compressorThreshold);
        fxControls.compKnob.input.value = config.compressorThreshold;
        fxControls.limKnob.update(config.limiterThreshold);
        fxControls.limKnob.input.value = config.limiterThreshold;

        // Update reverb knob (wet value 0-1 → 0-100 display)
        const reverbPercent = Math.round((config.reverbWet || 0) * 100);
        fxControls.reverbKnob.update(reverbPercent);
        fxControls.reverbKnob.input.value = reverbPercent;
      }
    }

    // Reset position to center when opening
    resetMenuPosition();
    try { menu.focus({ preventScroll: true }); } catch { menu.focus(); }
  }

  function closeMenu() {
    if (!menuOpen) return;
    menu.classList.remove('open');
    menuOpen = false;

    // Reset mixer position to CSS defaults (ensures clean state for next open)
    menu.style.left = '';
    menu.style.top = '';
    menu.style.transform = '';
  }

  const toggleMenu = () => {
    if (menuOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  };

  function clearTimer() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  // Drag functionality
  const handlePointerMove = (event) => {
    if (!dragState.isDragging) return;

    event.preventDefault();

    // Calculate new position using grab offset (keeps click point under cursor)
    const newX = event.clientX - dragState.grabOffsetX;
    const newY = event.clientY - dragState.grabOffsetY;

    // Use cached dimensions (avoid getBoundingClientRect during drag)
    const menuWidth = dragState.cachedWidth;
    const menuHeight = dragState.cachedHeight;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Clamp position to keep menu within viewport
    const minX = 0;
    const maxX = viewportWidth - menuWidth;
    const minY = 0;
    const maxY = viewportHeight - menuHeight;

    const clampedX = Math.max(minX, Math.min(maxX, newX));
    const clampedY = Math.max(minY, Math.min(maxY, newY));

    dragState.menuX = clampedX;
    dragState.menuY = clampedY;

    menu.style.top = `${clampedY}px`;
    menu.style.left = `${clampedX}px`;
  };

  const handlePointerUp = () => {
    if (dragState.isDragging) {
      dragState.isDragging = false;
      menu.classList.remove('dragging');
      title.style.cursor = '';

      // Release pointer capture
      try {
        title.releasePointerCapture(dragState.pointerId);
      } catch (e) {
        // Ignore errors if pointer capture wasn't set
      }

      // Remove event listeners
      title.removeEventListener('pointermove', handlePointerMove);
      title.removeEventListener('pointerup', handlePointerUp);
      title.removeEventListener('pointercancel', handlePointerUp);
    }
  };

  title.addEventListener('pointerdown', (event) => {
    if (!menuOpen) return;
    if (event.button && event.button !== 0) return; // Only left click

    event.preventDefault();
    event.stopPropagation(); // Prevent closing the menu

    // U-03: congelar la posició VISUAL actual — el rect ja inclou el
    // translate(-50%,-50%) del centrat inicial, i en re-agafar després
    // d'un drag left/top inline ja són la posició arrossegada. Abans es
    // recalculava el centre del viewport a cada grab i el panell hi
    // saltava. Sense matemàtica depenent de reflow, el doble RAF sobra
    // (els listeners s'enganxen al mateix gest, no 2 frames tard).
    const rect = menu.getBoundingClientRect();
    menu.style.left = rect.left + 'px';
    menu.style.top = rect.top + 'px';
    menu.style.transform = 'none';

    dragState.isDragging = true;
    dragState.pointerId = event.pointerId;
    dragState.startX = event.clientX;
    dragState.startY = event.clientY;
    dragState.initialMenuLeft = rect.left;
    dragState.initialMenuTop = rect.top;
    dragState.cachedWidth = rect.width;
    dragState.cachedHeight = rect.height;
    dragState.grabOffsetX = event.clientX - rect.left;
    dragState.grabOffsetY = event.clientY - rect.top;

    if (dragState.menuX === null) {
      dragState.menuX = rect.left;
      dragState.menuY = rect.top;
    }

    menu.classList.add('dragging');
    title.style.cursor = 'grabbing';

    // Set pointer capture for better drag handling
    try {
      title.setPointerCapture(event.pointerId);
    } catch (e) {
      // Fallback to document events if pointer capture fails
    }

    // Add move and up listeners
    title.addEventListener('pointermove', handlePointerMove);
    title.addEventListener('pointerup', handlePointerUp);
    title.addEventListener('pointercancel', handlePointerUp);
  });

  triggerButtons.forEach((btn) => {
    btn.addEventListener('pointerdown', (event) => {
      if (event.button && event.button !== 0) return;
      clearTimer();
      longPressFired = false;
      longPressTimer = setTimeout(() => {
        longPressTimer = null;
        longPressFired = true;
        openMenu();
      }, longPress);
    });

    const cancel = () => {
      clearTimer();
    };
    btn.addEventListener('pointerleave', cancel);
    btn.addEventListener('pointercancel', cancel);

    btn.addEventListener('pointerup', (event) => {
      if (longPressTimer) {
        clearTimer();
      }
      if (longPressFired) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    });

    // U-04: el long-press només existeix via pointerdown; l'activació de
    // teclat (Enter/Espai) dispara click i mai pointerdown, així que no
    // hi havia CAP camí de teclat per obrir el mixer. contextmenu es
    // dispara amb la tecla Menú/Shift+F10 (i amb clic dret). NOMÉS obre:
    // tancar ja ho fan Escape i el clic fora, i obrir-només és idempotent
    // amb qualsevol altre handler de contextmenu (U-26: el llegat
    // mixer-longpress.js, que doblava aquest gest amb un altre timing,
    // es va retirar el 2026-06-11).
    btn.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      if (!menuOpen) openMenu();
    });

    btn.addEventListener('click', (event) => {
      if (longPressFired) {
        event.preventDefault();
        event.stopImmediatePropagation();
        longPressFired = false;
      }
    }, true);
  });

  // Track if pointer down happened inside menu (for focusout handling)
  let lastPointerDownInside = false;

  document.addEventListener('pointerdown', (event) => {
    // Track pointer down location for focusout handling
    lastPointerDownInside = menu.contains(event.target);

    if (!menuOpen) return;
    if (menu.contains(event.target)) return;
    if (triggerButtons.some(btn => btn.contains(event.target))) return;
    closeMenu();
  });

  const handleExternalToggle = () => toggleMenu();
  const handleExternalOpen = () => openMenu();
  document.addEventListener('nuzic:mixer:toggle', handleExternalToggle);
  document.addEventListener('nuzic:mixer:open', handleExternalOpen);

  menu.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
    }
  });

  menu.addEventListener('focusout', (event) => {
    if (!menuOpen) return;
    const next = event.relatedTarget;
    // If focus stays inside the menu, don't close
    if (next && menu.contains(next)) return;
    // Don't close if focus moved to a trigger button (Play/Tap)
    if (triggerButtons.includes(next)) return;
    // If relatedTarget is null but pointer down was inside menu, don't close
    // (happens when clicking on non-focusable elements like <li> in dropdowns)
    if (!next && lastPointerDownInside) return;
    closeMenu();
  });

  window.addEventListener('sharedui:theme', () => {
    if (menuOpen) applyMixerBackground(menu);
  });

  // Sync mixer mute button when header mute button changes
  // This ensures visual sync even if subscribeMixer update hasn't fired yet
  window.addEventListener('sharedui:mute', (event) => {
    const masterControl = controlMap.get('master');
    if (!masterControl?.muteBtn) return;
    const isMutedNow = !!event.detail?.value;
    masterControl.muteBtn.classList.toggle('active', isMutedNow);
    masterControl.muteBtn.setAttribute('aria-pressed', isMutedNow ? 'true' : 'false');
    if (masterControl.wrapper) {
      masterControl.wrapper.classList.toggle('suppressed', isMutedNow);
    }
  });

  const latestState = {
    master: null,
    channels: new Map()
  };

  function updateControls(snapshot) {
    latestState.master = snapshot.master;
    latestState.channels = new Map(snapshot.channels.map(ch => [ch.id, ch]));

    controlMap.forEach(({ config, wrapper, slider, muteBtn, soloBtn, labelEl }, id) => {
      const state = id === 'master' ? snapshot.master : latestState.channels.get(id) || null;
      const displayName = config.label || state?.label || id;
      if (labelEl) labelEl.textContent = displayName;

      if (slider) {
        const value = state ? clamp01(state.volume) : 0;
        slider.value = value;
        slider.disabled = !state;
      }

      wrapper.classList.toggle('suppressed', !!state?.effectiveMuted);

      if (muteBtn) {
        const isActive = state ? !!state.muted : false;
        muteBtn.classList.toggle('active', isActive);
        muteBtn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        muteBtn.setAttribute('aria-label', `Mutear ${displayName}`);
      }

      if (soloBtn) {
        const isActive = state ? !!state.solo : false;
        soloBtn.classList.toggle('active', isActive);
        soloBtn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        soloBtn.setAttribute('aria-label', `Solear ${displayName}`);
        soloBtn.disabled = state ? state.allowSolo === false : false;
      }
    });
  }

  subscribeMixer(updateControls);

  controlMap.forEach(({ config, slider, muteBtn, soloBtn }) => {
    const channelId = config.id;
    if (slider) {
      slider.addEventListener('input', (event) => {
        const value = clamp01(event.target.value);
        if (channelId === 'master') {
          setVolume(value);
          if (value > 0 && isMuted()) {
            setMute(false);
            window.dispatchEvent(new CustomEvent('sharedui:mute', { detail: { value: false } }));
          }
          window.dispatchEvent(new CustomEvent('sharedui:volume', { detail: { value } }));
        } else {
          setChannelVolume(channelId, value);
        }
      });
    }

    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        if (channelId === 'master') {
          const next = !(latestState.master?.muted);
          setMute(next);
          window.dispatchEvent(new CustomEvent('sharedui:mute', { detail: { value: next } }));
        } else {
          const state = latestState.channels.get(channelId) || getChannelState(channelId);
          const next = !(state?.muted);
          setChannelMute(channelId, next);
        }
      });
    }

    if (soloBtn) {
      soloBtn.addEventListener('click', () => {
        const state = latestState.channels.get(channelId) || getChannelState(channelId);
        const allowSolo = state ? state.allowSolo !== false : true;
        if (!allowSolo) return;
        const next = !(state?.solo);
        toggleChannelSolo(channelId);
        if (next) {
          // ensure channel audible if soloing
          setChannelMute(channelId, false);
        }
      });
    }
  });

  const api = {
    open: openMenu,
    close: closeMenu,
    toggle: toggleMenu,
    isOpen: () => menuOpen,
    updateChannelLabel: (channelId, newLabel) => {
      const control = controlMap.get(channelId);
      if (control?.labelEl) {
        const resolved = resolveChannelLabel(channelId, newLabel);
        control.labelEl.textContent = resolved;
        control.config.label = resolved;
      }
    }
  };

  if (typeof window !== 'undefined') {
    try { window.NuzicMixer = api; } catch {}
  }

  return api;
}

/**
 * Update the label of a mixer channel (for dynamic instrument changes)
 * @param {string} channelId - Channel ID (e.g., 'instrument')
 * @param {string} newLabel - New label to display (e.g., 'Piano', 'Violín')
 */
export function updateMixerChannelLabel(channelId, newLabel) {
  if (typeof window !== 'undefined' && window.NuzicMixer?.updateChannelLabel) {
    window.NuzicMixer.updateChannelLabel(channelId, newLabel);
  }
}

