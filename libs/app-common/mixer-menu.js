import { solidMenuBackground } from './utils.js';
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

const DEFAULT_LONG_PRESS = 500;

function createLetterIcon(letter) {
  return `\n    <svg aria-hidden="true" viewBox="0 0 40 40" focusable="false">\n      <text x="50%" y="55%" text-anchor="middle" dominant-baseline="middle"\n            font-family="inherit" font-size="48" fill="currentColor">${letter}</text>\n    </svg>\n  `;
}

function clamp01(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(1, num));
}

function createKnob({ label, min, max, value, onChange }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'mixer-knob';

  const labelEl = document.createElement('span');
  labelEl.className = 'mixer-knob__label';
  labelEl.textContent = label;

  const knobContainer = document.createElement('div');
  knobContainer.className = 'mixer-knob__dial';

  // SVG circular knob
  const size = 44;
  const strokeWidth = 4;
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
  bgCircle.setAttribute('stroke', 'var(--line-color, #444)');
  bgCircle.setAttribute('stroke-width', strokeWidth);
  svg.appendChild(bgCircle);

  // Value arc
  const valueArc = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  valueArc.setAttribute('cx', size / 2);
  valueArc.setAttribute('cy', size / 2);
  valueArc.setAttribute('r', radius);
  valueArc.setAttribute('fill', 'none');
  valueArc.setAttribute('stroke', 'var(--selection-color, #4a9eff)');
  valueArc.setAttribute('stroke-width', strokeWidth);
  valueArc.setAttribute('stroke-linecap', 'round');
  valueArc.setAttribute('stroke-dasharray', circumference);
  valueArc.setAttribute('transform', `rotate(-90 ${size / 2} ${size / 2})`);
  svg.appendChild(valueArc);

  knobContainer.appendChild(svg);

  // Hidden input for interaction
  const input = document.createElement('input');
  input.type = 'range';
  input.min = min;
  input.max = max;
  input.step = '1';
  input.value = value;
  input.className = 'mixer-knob__input';
  knobContainer.appendChild(input);

  // Value display
  const valueDisplay = document.createElement('span');
  valueDisplay.className = 'mixer-knob__value';
  valueDisplay.textContent = `${value}`;

  wrapper.appendChild(labelEl);
  wrapper.appendChild(knobContainer);
  wrapper.appendChild(valueDisplay);

  // Update function
  const updateKnob = (val) => {
    const normalized = (val - min) / (max - min);
    const offset = circumference * (1 - normalized * 0.75); // 270° arc
    valueArc.setAttribute('stroke-dashoffset', offset);
    valueDisplay.textContent = `${Math.round(val)}`;
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

  const controlMap = new Map();
  const mixer = getMixer();
  const knownChannels = Array.isArray(channels) && channels.length ? channels : [
    { id: 'pulse', label: 'Pulso', allowSolo: true },
    { id: 'subdivision', label: 'Subdivisión', allowSolo: true },
    { id: 'master', label: 'Master', allowSolo: false, isMaster: true }
  ];

  // P1 toggle control (special channel without slider)
  const p1Controller = (typeof window !== 'undefined') ? window.__p1Controller : null;
  if (p1Controller) {
    const p1Wrapper = document.createElement('div');
    p1Wrapper.className = 'mixer-channel mixer-channel--p1-toggle';
    p1Wrapper.dataset.channel = 'p1-toggle';

    const p1Label = document.createElement('span');
    p1Label.className = 'mixer-channel__label';
    p1Label.textContent = 'P1';
    p1Wrapper.appendChild(p1Label);

    const p1SliderPlaceholder = document.createElement('div');
    p1SliderPlaceholder.className = 'mixer-channel__slider-wrapper mixer-channel__slider-wrapper--hidden';
    p1Wrapper.appendChild(p1SliderPlaceholder);

    const p1Actions = document.createElement('div');
    p1Actions.className = 'mixer-channel__actions mixer-channel__actions--single';

    const p1ToggleBtn = document.createElement('button');
    p1ToggleBtn.type = 'button';
    p1ToggleBtn.className = 'mixer-action mixer-action--p1-toggle';
    p1ToggleBtn.setAttribute('aria-label', 'Alternar sonido adicional P1');
    p1ToggleBtn.innerHTML = `
      <svg aria-hidden="true" viewBox="0 0 40 40" focusable="false" class="icon-on">
        <text x="50%" y="55%" text-anchor="middle" dominant-baseline="middle"
              font-family="inherit" font-size="20" font-weight="bold" fill="currentColor">ON</text>
      </svg>
      <svg aria-hidden="true" viewBox="0 0 40 40" focusable="false" class="icon-off" style="display:none;">
        <text x="50%" y="55%" text-anchor="middle" dominant-baseline="middle"
              font-family="inherit" font-size="20" font-weight="bold" fill="currentColor">OFF</text>
      </svg>
    `;
    p1Actions.appendChild(p1ToggleBtn);
    p1Wrapper.appendChild(p1Actions);

    content.appendChild(p1Wrapper);

    // Synchronize initial state
    const initialState = p1Controller.getState();
    p1ToggleBtn.classList.toggle('active', initialState);
    p1ToggleBtn.setAttribute('aria-pressed', initialState ? 'true' : 'false');
    const iconOn = p1ToggleBtn.querySelector('.icon-on');
    const iconOff = p1ToggleBtn.querySelector('.icon-off');
    if (iconOn) iconOn.style.display = initialState ? 'block' : 'none';
    if (iconOff) iconOff.style.display = initialState ? 'none' : 'block';

    // Event listener
    p1ToggleBtn.addEventListener('click', () => {
      const currentState = p1Controller.getState();
      const newState = !currentState;
      p1Controller.setState(newState);

      // Update button UI
      p1ToggleBtn.classList.toggle('active', newState);
      p1ToggleBtn.setAttribute('aria-pressed', newState ? 'true' : 'false');
      const iconOn = p1ToggleBtn.querySelector('.icon-on');
      const iconOff = p1ToggleBtn.querySelector('.icon-off');
      if (iconOn) iconOn.style.display = newState ? 'block' : 'none';
      if (iconOff) iconOff.style.display = newState ? 'none' : 'block';
    });
  }

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

    const labelEl = document.createElement('span');
    labelEl.className = 'mixer-channel__label';
    labelEl.textContent = config.label || channelId;
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
    content.appendChild(wrapper);

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

  // Label row: [FX] toggle button
  const fxLabel = document.createElement('span');
  fxLabel.className = 'mixer-channel__label';

  const fxToggle = document.createElement('button');
  fxToggle.type = 'button';
  fxToggle.className = 'mixer-action mixer-action--fx';
  fxToggle.setAttribute('aria-label', 'Toggle master effects');
  fxToggle.innerHTML = createLetterIcon('FX');
  fxLabel.appendChild(fxToggle);
  fxWrapper.appendChild(fxLabel);

  // Knobs container (replaces slider wrapper for FX column)
  const knobsWrapper = document.createElement('div');
  knobsWrapper.className = 'mixer-channel__knobs';

  // Compressor knob
  const compKnob = createKnob({
    label: 'Comp',
    min: -24,
    max: 0,
    value: -6,
    onChange: (val) => window.NuzicAudioEngine?.setCompressorThreshold(val)
  });
  knobsWrapper.appendChild(compKnob.element);

  // Limiter knob
  const limKnob = createKnob({
    label: 'Limit',
    min: -6,
    max: 0,
    value: -0.5,
    onChange: (val) => window.NuzicAudioEngine?.setLimiterThreshold(val)
  });
  knobsWrapper.appendChild(limKnob.element);

  fxWrapper.appendChild(knobsWrapper);

  // Empty actions row to maintain vertical alignment
  const fxActions = document.createElement('div');
  fxActions.className = 'mixer-channel__actions mixer-channel__actions--empty';
  fxWrapper.appendChild(fxActions);

  content.appendChild(fxWrapper);

  // Store knob references for state sync
  const fxControls = { fxToggle, fxWrapper, compKnob, limKnob };

  // FX Toggle event listener
  fxToggle.addEventListener('click', () => {
    const audio = window.NuzicAudioEngine;
    if (!audio) return;
    const enabled = !audio.getEffectsEnabled();
    audio.setEffectsEnabled(enabled);
    fxToggle.classList.toggle('active', enabled);
    fxWrapper.classList.toggle('suppressed', !enabled);
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
    solidMenuBackground(menu);

    // Synchronize P1 toggle state when opening
    const p1Controller = (typeof window !== 'undefined') ? window.__p1Controller : null;
    if (p1Controller) {
      const p1ToggleBtn = menu.querySelector('.mixer-action--p1-toggle');
      if (p1ToggleBtn) {
        const currentState = p1Controller.getState();
        p1ToggleBtn.classList.toggle('active', currentState);
        p1ToggleBtn.setAttribute('aria-pressed', currentState ? 'true' : 'false');
        const iconOn = p1ToggleBtn.querySelector('.icon-on');
        const iconOff = p1ToggleBtn.querySelector('.icon-off');
        if (iconOn) iconOn.style.display = currentState ? 'block' : 'none';
        if (iconOff) iconOff.style.display = currentState ? 'none' : 'block';
      }
    }

    // Synchronize FX effects state when opening
    const audio = window.NuzicAudioEngine;
    if (audio?.getEffectsConfig) {
      const config = audio.getEffectsConfig();
      if (config && fxControls) {
        // Update FX toggle state
        fxControls.fxToggle.classList.toggle('active', config.enabled);
        fxControls.fxWrapper.classList.toggle('suppressed', !config.enabled);

        // Update knob values
        fxControls.compKnob.update(config.compressorThreshold);
        fxControls.compKnob.input.value = config.compressorThreshold;
        fxControls.limKnob.update(config.limiterThreshold);
        fxControls.limKnob.input.value = config.limiterThreshold;
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

    // Capture event coordinates immediately
    const clickX = event.clientX;
    const clickY = event.clientY;
    const pointerId = event.pointerId;

    // DOBLE RAF: Garantiza estabilidad completa en modo circular
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {

        // PASO 1: Limpiar transform para leer dimensiones reales
        menu.style.transform = 'none';

        // PASO 2: Forzar reflow
        void menu.offsetHeight;

        // PASO 3: Leer dimensiones limpias
        const rect = menu.getBoundingClientRect();
        const menuWidth = rect.width;
        const menuHeight = rect.height;

        // PASO 4: Calcular posición centrada MANUALMENTE
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const centeredLeft = (viewportWidth - menuWidth) / 2;
        const centeredTop = (viewportHeight - menuHeight) / 2;

        // PASO 5: Aplicar posición centrada como inline styles
        menu.style.left = centeredLeft + 'px';
        menu.style.top = centeredTop + 'px';
        // transform ya está en 'none' del paso 1

        // PASO 6: Calcular grab offset relativo a la posición centrada
        const grabOffsetX = clickX - centeredLeft;
        const grabOffsetY = clickY - centeredTop;

        // PASO 7: Setup drag state
        dragState.isDragging = true;
        dragState.pointerId = pointerId;
        dragState.startX = clickX;
        dragState.startY = clickY;
        dragState.initialMenuLeft = centeredLeft;
        dragState.initialMenuTop = centeredTop;
        dragState.cachedWidth = menuWidth;
        dragState.cachedHeight = menuHeight;
        dragState.grabOffsetX = grabOffsetX;
        dragState.grabOffsetY = grabOffsetY;

        if (dragState.menuX === null) {
          dragState.menuX = centeredLeft;
          dragState.menuY = centeredTop;
        }

        menu.classList.add('dragging');
        title.style.cursor = 'grabbing';

        // Set pointer capture for better drag handling
        try {
          title.setPointerCapture(pointerId);
        } catch (e) {
          // Fallback to document events if pointer capture fails
        }

        // Add move and up listeners
        title.addEventListener('pointermove', handlePointerMove);
        title.addEventListener('pointerup', handlePointerUp);
        title.addEventListener('pointercancel', handlePointerUp);
      });
    });
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
    if (menuOpen) solidMenuBackground(menu);
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
    isOpen: () => menuOpen
  };

  if (typeof window !== 'undefined') {
    try { window.NuzicMixer = api; } catch {}
  }

  return api;
}

