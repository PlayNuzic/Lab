/**
 * Initializes UI toggle controls that mirror mixer channels and storage state.
 *
 * @param {Object} options configuration.
 * @param {Array<{
 *   id: string,
 *   button?: HTMLButtonElement | null,
 *   storageKey?: string,
 *   mixerChannel?: string,
 *   defaultEnabled?: boolean,
 *   onChange?: (enabled: boolean, context: { persist: boolean, source: string }) => void,
 *   mixerStateSelector?: (channelState: any, context: { current: boolean }) => boolean | null
 * }>} options.toggles toggle descriptors.
 * @param {{ load?: (key: string) => string | null, save?: (key: string, value: string) => void }} [options.storage]
 *   persistence helpers.
 * @param {{ setChannelMute?: (id: string, muted: boolean) => void } | null} [options.mixer]
 *   global mixer reference.
 * @param {(listener: (snapshot: any) => void) => void} [options.subscribeMixer]
 *   subscribe function returning mixer snapshots.
 * @param {(context: {
 *   snapshot: any,
 *   channels: Map<string, any>,
 *   setFromMixer: (id: string, value: boolean, extra?: { persist?: boolean }) => void,
 *   getState: (id: string) => boolean,
 *   controllers: Map<string, AudioToggleController>
 * }) => void} [options.onMixerSnapshot]
 *   optional hook to customize mixer synchronisation.
 * @returns {{
 *   get: (id: string) => AudioToggleController | undefined,
 *   controllers: Map<string, AudioToggleController>
 * }} toggle controllers access.
 */
export function initAudioToggles({
  toggles = [],
  storage,
  mixer = null,
  subscribeMixer,
  onMixerSnapshot
} = {}) {
  const controllers = new Map();
  const configById = new Map();
  const state = new Map();

  const safeLoad = typeof storage?.load === 'function' ? storage.load.bind(storage) : () => null;
  const safeSave = typeof storage?.save === 'function' ? storage.save.bind(storage) : () => {};

  /**
   * Syncs button visual state with the toggle status.
   *
   * @param {HTMLElement | null | undefined} button
   * @param {boolean} enabled
   */
  function syncButton(button, enabled) {
    if (!button) return;
    button.classList.toggle('active', enabled);
    button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    button.dataset.state = enabled ? 'on' : 'off';
  }

  /**
   * Updates a toggle and propagates side effects.
   *
   * @param {string} id toggle identifier.
   * @param {boolean} value desired state.
   * @param {{ persist?: boolean, source?: string }} [options]
   */
  function setState(id, value, { persist = true, source = 'local' } = {}) {
    const entry = configById.get(id);
    if (!entry) return;
    const enabled = value !== false;
    const current = state.get(id);
    if (current === enabled) return;

    state.set(id, enabled);
    syncButton(entry.button, enabled);

    if (persist && entry.storageKey) {
      try {
        safeSave(entry.storageKey, enabled ? '1' : '0');
        entry.controller.markStored(true);
      } catch {}
    }

    if (
      source !== 'mixer' &&
      entry.mixerChannel &&
      mixer &&
      typeof mixer.setChannelMute === 'function'
    ) {
      try {
        mixer.setChannelMute(entry.mixerChannel, !enabled);
      } catch {}
    }

    if (typeof entry.onChange === 'function') {
      try {
        entry.onChange(enabled, { persist, source });
      } catch {}
    }
  }

  toggles.forEach((toggle) => {
    if (!toggle || typeof toggle.id !== 'string') return;
    const id = toggle.id;
    let hasStored = false;
    const controller = {
      id,
      button: toggle.button ?? null,
      isEnabled: () => state.get(id) ?? false,
      set: (value, options) => setState(id, value, options),
      toggle: (options) => {
        const next = !(state.get(id) ?? false);
        setState(id, next, options);
      },
      hasStored: () => hasStored,
      markStored: (value) => {
        hasStored = Boolean(value);
      },
      storageKey: toggle.storageKey ?? null
    };

    controllers.set(id, controller);
    configById.set(id, { ...toggle, controller });

    const stored = toggle.storageKey ? safeLoad(toggle.storageKey) : null;
    if (stored === '0' || stored === '1') {
      hasStored = true;
      setState(id, stored === '1', { persist: false, source: 'init' });
    } else {
      hasStored = false;
      setState(id, toggle.defaultEnabled !== false, { persist: false, source: 'init' });
    }

    if (toggle.button) {
      toggle.button.addEventListener('click', () => {
        controller.toggle({ source: 'ui' });
      });
    }
  });

  if (subscribeMixer) {
    subscribeMixer((snapshot) => {
      if (!snapshot || !Array.isArray(snapshot.channels)) return;
      const channels = new Map(snapshot.channels.map((channel) => [channel.id, channel]));
      if (typeof onMixerSnapshot === 'function') {
        onMixerSnapshot({
          snapshot,
          channels,
          setFromMixer: (id, value, extra = {}) => setState(id, value, { ...extra, persist: false, source: 'mixer' }),
          getState: (id) => state.get(id) ?? false,
          controllers
        });
        return;
      }

      configById.forEach((entry, id) => {
        if (!entry.mixerChannel) return;
        const channelState = channels.get(entry.mixerChannel);
        if (!channelState) return;
        const shouldEnable = typeof entry.mixerStateSelector === 'function'
          ? entry.mixerStateSelector(channelState, { current: state.get(id) ?? false })
          : !channelState.effectiveMuted;
        if (typeof shouldEnable !== 'boolean') return;
        if ((state.get(id) ?? false) === shouldEnable) return;
        setState(id, shouldEnable, { persist: false, source: 'mixer' });
      });
    });
  }

  return {
    get: (id) => controllers.get(id),
    controllers
  };
}

/**
 * @typedef {Object} AudioToggleController
 * @property {string} id
 * @property {HTMLButtonElement | null} button
 * @property {(value: boolean, options?: { persist?: boolean, source?: string }) => void} set
 * @property {(options?: { persist?: boolean, source?: string }) => void} toggle
 * @property {() => boolean} isEnabled
 * @property {() => boolean} hasStored
 * @property {(value: boolean) => void} markStored
 * @property {string | null} storageKey
 */
