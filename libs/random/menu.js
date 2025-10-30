import { solidMenuBackground } from '../app-common/utils.js';

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeRange(defaultRange, storedRange) {
  if (!Array.isArray(defaultRange)) return storedRange;
  if (!Array.isArray(storedRange) || storedRange.length !== defaultRange.length) {
    return defaultRange.slice();
  }
  return storedRange.map((value, index) => {
    const fallback = defaultRange[index];
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  });
}

export function mergeRandomConfig(defaults, stored) {
  const safeDefaults = isPlainObject(defaults) ? defaults : {};
  const safeStored = isPlainObject(stored) ? stored : {};
  const result = {};

  for (const key of Object.keys(safeDefaults)) {
    const defaultValue = safeDefaults[key];
    if (isPlainObject(defaultValue)) {
      const storedValue = isPlainObject(safeStored[key]) ? safeStored[key] : {};
      const merged = { ...defaultValue };

      if ('enabled' in defaultValue) {
        merged.enabled = typeof storedValue.enabled === 'boolean'
          ? storedValue.enabled
          : defaultValue.enabled;
      }

      if ('range' in defaultValue) {
        merged.range = normalizeRange(defaultValue.range, storedValue.range);
      }

      if ('count' in defaultValue) {
        merged.count = typeof storedValue.count === 'string'
          ? storedValue.count
          : defaultValue.count;
      }

      for (const prop of Object.keys(storedValue)) {
        if (prop === 'enabled' || prop === 'range' || prop === 'count') continue;
        merged[prop] = storedValue[prop];
      }

      result[key] = merged;
    } else {
      result[key] = key in safeStored ? safeStored[key] : defaultValue;
    }
  }

  for (const key of Object.keys(safeStored)) {
    if (!(key in result)) {
      result[key] = safeStored[key];
    }
  }

  return result;
}

export function initRandomMenu(button, menu, onRandomize, longPress = 500) {
  if (!button || !menu || typeof onRandomize !== 'function') return;
  let pressTimer = null;

  function toggleMenu(force) {
    const shouldOpen = typeof force === 'boolean' ? force : !menu.classList.contains('open');
    menu.classList.toggle('open', shouldOpen);
    if (shouldOpen) {
      solidMenuBackground(menu);
    }
  }

  button.addEventListener('pointerdown', () => {
    pressTimer = setTimeout(() => {
      toggleMenu();
      pressTimer = null;
    }, longPress);
  });

  button.addEventListener('pointerup', () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
      onRandomize();
    }
  });

  button.addEventListener('pointerleave', () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
  });

  document.addEventListener('pointerdown', (e) => {
    if (!menu.classList.contains('open')) return;
    if (e.target === menu || menu.contains(e.target) || e.target === button) return;
    toggleMenu(false);
  });

  window.addEventListener('sharedui:theme', () => {
    if (menu.classList.contains('open')) solidMenuBackground(menu);
  });
}
