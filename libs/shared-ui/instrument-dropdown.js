// libs/shared-ui/instrument-dropdown.js
// Dropdown for selecting melodic instruments

// Available instruments
export const instrumentNames = ['piano', 'flute'];

export const instrumentLabels = {
  piano: 'Piano',
  flute: 'Flauta'
};

/**
 * Preload instrument samples in background to reduce latency
 * Called automatically when user selects an instrument from dropdown
 * @param {string} instrument - Instrument key to preload
 */
async function preloadInstrument(instrument) {
  try {
    // Ensure Tone.js is loaded first
    const { ensureToneLoaded } = await import('../sound/tone-loader.js');
    await ensureToneLoaded();

    // Dynamically import and preload the selected instrument
    switch (instrument) {
      case 'piano': {
        const { preloadPiano } = await import('../sound/piano.js');
        preloadPiano({ delay: 0 });
        console.log('Piano preload initiated');
        break;
      }
      case 'flute': {
        const { preloadFlute } = await import('../sound/flute.js');
        preloadFlute({ delay: 0 });
        console.log('Flute preload initiated');
        break;
      }
    }
  } catch (err) {
    console.warn(`Failed to preload ${instrument}:`, err);
  }
}

/**
 * Initialize instrument dropdown
 * @param {HTMLElement} container - Container for dropdown
 * @param {Object} options - Configuration
 * @param {string} options.storageKey - LocalStorage key
 * @param {string} options.eventType - Event type to dispatch on change
 * @param {Function} options.onSelect - Callback when instrument is selected
 * @param {string} options.defaultValue - Default instrument
 */
export function initInstrumentDropdown(container, { storageKey, eventType, onSelect, defaultValue }) {
  if (!container) return;

  // Prevent double enhancement
  if (container.dataset.enhanced === '1') return;
  container.dataset.enhanced = '1';

  // Clear any existing content
  container.innerHTML = '';
  container.classList.add('custom-dropdown');

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'dropdown-toggle';

  // Transfer ID for accessibility
  if (container.id) {
    toggle.id = container.id;
    container.removeAttribute('id');
  }

  container.appendChild(toggle);

  const panel = document.createElement('div');
  panel.className = 'dropdown-panel';
  panel.style.display = 'none';

  const list = document.createElement('ul');
  instrumentNames.forEach(name => {
    const li = document.createElement('li');
    li.dataset.value = name;
    li.textContent = instrumentLabels[name] || name;
    li.tabIndex = -1;
    list.appendChild(li);
  });
  panel.appendChild(list);

  const exitBtn = document.createElement('button');
  exitBtn.type = 'button';
  exitBtn.className = 'dropdown-exit';
  exitBtn.textContent = 'Salir';
  panel.appendChild(exitBtn);

  container.appendChild(panel);

  // Load from localStorage or use default
  const stored = (() => {
    try {
      return localStorage.getItem(storageKey);
    } catch {
      return null;
    }
  })();

  const fallbackDefault = defaultValue && instrumentNames.includes(defaultValue) ? defaultValue : instrumentNames[0];
  let selected = (stored && instrumentNames.includes(stored)) ? stored : fallbackDefault;
  let pending = selected;

  function updateDataset(value) {
    if (!value) {
      delete container.dataset.value;
      delete toggle.dataset.value;
      return;
    }
    container.dataset.value = value;
    toggle.dataset.value = value;
  }

  function updateLabel() {
    toggle.textContent = instrumentLabels[selected] || selected;
    updateDataset(selected);
  }

  // Initialize label
  updateLabel();

  // Nota: L'instrument guardat es carrega directament per audio-init.js
  // des de localStorage quan s'inicialitza l'audio engine

  // Preload the initially selected instrument after audio engine is ready
  // This ensures samples are connected to the correct audio routing
  const preloadOnFirstInteraction = async () => {
    document.removeEventListener('click', preloadOnFirstInteraction, { capture: true });
    document.removeEventListener('touchstart', preloadOnFirstInteraction, { capture: true });

    // Wait for audio engine to be initialized (up to 2 seconds)
    let attempts = 0;
    while (!window.NuzicAudioEngine && attempts < 20) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    // Only preload if audio engine is ready
    if (window.NuzicAudioEngine) {
      preloadInstrument(selected);
    }
  };
  document.addEventListener('click', preloadOnFirstInteraction, { capture: true, once: true });
  document.addEventListener('touchstart', preloadOnFirstInteraction, { capture: true, once: true });

  function updateListHighlight() {
    const children = [...list.children];
    children.forEach(li => li.classList.remove('selected', 'pending'));
    children.forEach(li => {
      if (li.dataset.value === pending) li.classList.add('selected');
    });
  }

  function openPanel() {
    pending = selected;
    updateListHighlight();
    panel.style.display = 'block';
    toggle.setAttribute('aria-expanded', 'true');

    // Focus first item
    const firstItem = list.querySelector('li');
    if (firstItem) firstItem.focus();
  }

  function closePanel() {
    panel.style.display = 'none';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.focus();
  }

  function confirmSelection() {
    selected = pending;

    // Save to localStorage
    try {
      localStorage.setItem(storageKey, selected);
    } catch (e) {
      console.warn('Failed to save instrument to localStorage:', e);
    }

    updateLabel();

    // Preload instrument samples in background to reduce latency
    preloadInstrument(selected);

    // Dispatch event
    if (eventType) {
      window.dispatchEvent(new CustomEvent(eventType, {
        detail: { instrument: selected }
      }));
    }

    // Call callback
    if (onSelect) {
      onSelect(selected);
    }

    closePanel();
  }

  // Toggle button handler
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    if (panel.style.display === 'none') {
      openPanel();
    } else {
      closePanel();
    }
  });

  // List item selection
  list.addEventListener('click', (e) => {
    const li = e.target.closest('li');
    if (!li) return;
    pending = li.dataset.value;
    confirmSelection();
  });

  // Exit button
  exitBtn.addEventListener('click', () => {
    pending = selected; // Reset pending
    closePanel();
  });

  // Keyboard navigation
  list.addEventListener('keydown', (e) => {
    const items = [...list.querySelectorAll('li')];
    const current = e.target.closest('li');
    const idx = items.indexOf(current);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = items[idx + 1] || items[0];
      next.focus();
      pending = next.dataset.value;
      updateListHighlight();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = items[idx - 1] || items[items.length - 1];
      prev.focus();
      pending = prev.dataset.value;
      updateListHighlight();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      confirmSelection();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closePanel();
    }
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!container.contains(e.target) && panel.style.display !== 'none') {
      closePanel();
    }
  });

  return {
    getSelected: () => selected,
    setSelected: (value) => {
      if (instrumentNames.includes(value)) {
        selected = value;
        pending = value;
        updateLabel();
      }
    }
  };
}
