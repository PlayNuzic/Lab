/**
 * Utilities for persisting application preferences across Lab apps.
 * Provides namespaced storage helpers plus shared wiring for theme, mute and
 * factory-reset behaviours.
 */

/**
 * Creates a wrapper around `localStorage` scoped to a namespace prefix.
 *
 * @param {{ prefix: string, separator?: string }} options configuration.
 * @returns {{
 *   storeKey: (key: string) => string,
 *   save: (key: string, value: string) => void,
 *   load: (key: string) => string | null,
 *   clear: (key: string) => void,
 *   clearAll: () => void
 * }} interface to interact with the storage namespace.
 */
export function createPreferenceStorage({ prefix, separator = '::' }) {
  const sep = separator ?? '';
  const prefixValue = `${prefix}${sep}`;

  const storeKey = (key) => `${prefix}${sep}${key}`;

  const load = (key) => {
    try {
      return localStorage.getItem(storeKey(key));
    } catch {
      return null;
    }
  };

  const save = (key, value) => {
    try {
      localStorage.setItem(storeKey(key), value);
    } catch {}
  };

  const clear = (key) => {
    try {
      localStorage.removeItem(storeKey(key));
    } catch {}
  };

  const clearAll = () => {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefixValue)) keysToRemove.push(key);
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    } catch {}
  };

  return { storeKey, save, load, clear, clearAll };
}

/**
 * Registers a global factory reset handler that clears stored preferences and
 * reloads the page.
 *
 * @param {{
 *   storage: ReturnType<typeof createPreferenceStorage>,
 *   onBeforeReload?: () => void,
 *   reload?: () => void,
 *   target?: Window | Document
 * }} options configuration.
 * @returns {() => void} function to unregister the listener.
 */
export function registerFactoryReset({
  storage,
  onBeforeReload,
  reload = () => window.location.reload(),
  target = window
}) {
  let pending = false;
  const eventTarget = target ?? window;

  const handleReset = () => {
    if (pending) return;
    pending = true;
    storage?.clearAll?.();
    try {
      onBeforeReload?.();
    } catch {}
    reload();
  };

  eventTarget.addEventListener('sharedui:factoryreset', handleReset);
  return () => {
    pending = false;
    eventTarget.removeEventListener('sharedui:factoryreset', handleReset);
  };
}

/**
 * Synchronises the theme dropdown (if present) with stored preferences and the
 * `sharedui:theme` broadcast.
 *
 * @param {{
 *   storage: ReturnType<typeof createPreferenceStorage>,
 *   selectEl?: HTMLSelectElement | null,
 *   defaultValue?: string
 * }} options configuration.
 * @returns {{ applyTheme: (value?: string) => string }} helper to re-apply a theme.
 */
export function setupThemeSync({ storage, selectEl, defaultValue = 'system' }) {
  const applyTheme = (value = defaultValue) => {
    const raw = value || defaultValue;
    const resolvedTheme = raw === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : raw;

    document.body.dataset.theme = resolvedTheme;
    storage?.save?.('theme', raw);
    try {
      window.dispatchEvent(new CustomEvent('sharedui:theme', {
        detail: { value: resolvedTheme, raw }
      }));
    } catch {}
    return resolvedTheme;
  };

  const storedTheme = storage?.load?.('theme');
  if (selectEl) {
    if (storedTheme) selectEl.value = storedTheme;
    applyTheme(selectEl.value || defaultValue);
    selectEl.addEventListener('change', (event) => {
      applyTheme(event.target?.value);
    });
  } else {
    applyTheme(storedTheme || defaultValue);
  }

  return { applyTheme };
}

/**
 * Persists mute state coming from the shared UI and restores it on load.
 *
 * @param {{
 *   storage: ReturnType<typeof createPreferenceStorage>,
 *   getAudioInstance?: () => Promise<unknown> | unknown,
 *   muteKey?: string,
 *   muteButton?: HTMLElement | null,
 *   target?: Document | Window
 * }} options configuration.
 * @returns {{
 *   restore: () => void,
 *   teardown: () => void
 * }} helpers to control the lifecycle.
 */
export function setupMutePersistence({
  storage,
  getAudioInstance,
  muteKey = 'mute',
  muteButton,
  target = document
}) {
  const eventTarget = target ?? document;

  const handleMute = async (event) => {
    const value = !!(event && event.detail && event.detail.value);
    storage?.save?.(muteKey, value ? '1' : '0');
    if (typeof getAudioInstance === 'function') {
      try {
        const instance = await getAudioInstance();
        if (instance && typeof instance.setMute === 'function') {
          instance.setMute(value);
        }
      } catch {}
    }
  };

  eventTarget.addEventListener('sharedui:mute', handleMute);

  const restore = () => {
    try {
      const saved = storage?.load?.(muteKey);
      if (saved === '1') {
        const button = muteButton ?? document.getElementById('muteBtn');
        button?.click();
      }
    } catch {}
  };

  restore();

  return {
    restore,
    teardown: () => {
      eventTarget.removeEventListener('sharedui:mute', handleMute);
    }
  };
}
