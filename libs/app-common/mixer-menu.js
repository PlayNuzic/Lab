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
    slider.value = '1';
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
    initialMenuTop: 0
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
    // Reset position to center when opening
    resetMenuPosition();
    try { menu.focus({ preventScroll: true }); } catch { menu.focus(); }
  }

  function closeMenu() {
    if (!menuOpen) return;
    menu.classList.remove('open');
    menuOpen = false;
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

    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;

    const newX = dragState.initialMenuLeft + deltaX;
    const newY = dragState.initialMenuTop + deltaY;

    dragState.menuX = newX;
    dragState.menuY = newY;

    menu.style.top = `${newY}px`;
    menu.style.left = `${newX}px`;
    menu.style.transform = 'none';
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

    dragState.isDragging = true;
    dragState.pointerId = event.pointerId;
    dragState.startX = event.clientX;
    dragState.startY = event.clientY;

    const rect = menu.getBoundingClientRect();
    dragState.initialMenuLeft = rect.left;
    dragState.initialMenuTop = rect.top;

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

    btn.addEventListener('click', (event) => {
      if (longPressFired) {
        event.preventDefault();
        event.stopImmediatePropagation();
        longPressFired = false;
      }
    }, true);
  });

  document.addEventListener('pointerdown', (event) => {
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
    if (!next || menu.contains(next)) return;
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

