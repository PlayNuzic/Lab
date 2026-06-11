import { solidMenuBackground } from '../app-common/utils.js';

/**
 * Build a long-press random menu from a declarative spec.
 *
 * Replaces the per-app pattern of (1) hand-writing the menu's
 * `<label><input id="...">` HTML inside `randomMenuContent` and
 * (2) re-reading every `document.getElementById(...)` inside
 * `handleRandom`. With this helper each app declares its parameters
 * once and gets back both the HTML to plug into `renderApp` and a
 * `read()` function that returns the current values, with defaults
 * applied for blank/invalid inputs.
 *
 * @param {Object<string, RandomMenuParam>} spec
 *   Map of `paramName → { label, min, max, default, type? }`.
 *   `type` defaults to `'number'`. Use `'checkbox'` for booleans
 *   (the `default` is the initial checked state).
 * @returns {{ html: string, read: () => Object<string, number|boolean> }}
 *
 * @example
 *   const random = createRandomMenu({
 *     denomMax:  { label: 'Denominador máximo', min: 2, max: 8, default: 8 },
 *     allowSils: { label: 'Permitir silencios', type: 'checkbox', default: true },
 *   });
 *   // index.html: renderApp({ ..., randomMenuContent: random.html });
 *   // main.js handleRandom: const { denomMax, allowSils } = random.read();
 */
export function createRandomMenu(spec) {
  if (!isPlainObject(spec)) {
    return { html: '', read: () => ({}) };
  }

  const entries = Object.entries(spec);
  const ids = {};
  const html = entries.map(([key, opts]) => {
    const id = opts.id || `rand_${key}`;
    ids[key] = id;
    const type = opts.type || 'number';
    if (type === 'checkbox') {
      const checked = opts.default ? ' checked' : '';
      return `
        <label class="checkbox-label">
          <input type="checkbox" id="${id}"${checked}>
          <span>${opts.label}</span>
        </label>`;
    }
    const min = opts.min != null ? ` min="${opts.min}"` : '';
    const max = opts.max != null ? ` max="${opts.max}"` : '';
    const step = opts.step != null ? ` step="${opts.step}"` : '';
    const value = opts.default != null ? ` value="${opts.default}"` : '';
    return `
        <label>
          <span>${opts.label}</span>
          <input type="number" id="${id}"${min}${max}${step}${value}>
        </label>`;
  }).join('');

  function read() {
    const out = {};
    for (const [key, opts] of entries) {
      const el = document.getElementById(ids[key]);
      if (!el) {
        out[key] = opts.default;
        continue;
      }
      if ((opts.type || 'number') === 'checkbox') {
        out[key] = !!el.checked;
        continue;
      }
      const raw = el.value;
      const parsed = parseInt(raw, 10);
      out[key] = Number.isFinite(parsed) ? parsed : opts.default;
    }
    return out;
  }

  return { html, read, ids };
}

/**
 * One-shot setup for the long-press random menu of an app:
 * generates the inputs HTML from `spec`, injects it into `#randomMenu`
 * (after its `.random-menu-title` heading so the existing header is
 * preserved), wires the long-press handler with `initRandomMenu`, and
 * returns a `read()` function the app can call inside its random
 * handler to pick up the current control values.
 *
 * Call it once after `renderApp(...)` from each app's main.js. The
 * `randomMenuContent` field of `renderApp` should stay empty — this
 * helper owns the contents of `#randomMenu` (apart from the heading).
 *
 * @param {Object} options
 * @param {Object<string, RandomMenuParam>} options.spec  parameter declarations
 * @param {Function} options.onRandomize  shortpress handler (your random fn)
 * @param {string} [options.buttonId='randomBtn']
 * @param {string} [options.menuId='randomMenu']
 * @param {number} [options.longPress=500]  ms before longpress fires
 * @returns {{ read: () => Object<string, number|boolean> } | null}
 *   Returns `null` if the button or menu can't be found in the DOM.
 *
 * @example
 *   const random = setupRandomMenu({
 *     spec: {
 *       denomMax: { label: 'Denominador máximo', min: 2, max: 8, default: 8 },
 *     },
 *     onRandomize: handleRandom,
 *   });
 *   // handleRandom():
 *   const { denomMax } = random.read();
 */
export function setupRandomMenu({ spec, onRandomize, storage = null, buttonId = 'randomBtn', menuId = 'randomMenu', longPress = 500 }) {
  const button = document.getElementById(buttonId);
  const menu   = document.getElementById(menuId);
  if (!button || !menu) return null;

  const { html, read, ids } = createRandomMenu(spec);

  // Inject after the existing heading (if any) so the gear/title stays.
  const heading = menu.querySelector('.random-menu-title');
  if (heading) {
    heading.insertAdjacentHTML('afterend', html);
  } else {
    menu.insertAdjacentHTML('beforeend', html);
  }

  // LU-03: persistència opcional — App2 recordava la config del menú
  // random entre recàrregues i les apps declaratives (26-35) no. Si
  // l'app passa el seu preferenceStorage ({load, save}), cada input
  // s'inicialitza del valor desat i es persisteix al 'change'.
  if (storage && isPlainObject(spec)) {
    for (const [key, opts] of Object.entries(spec)) {
      const el = document.getElementById(ids[key]);
      if (!el) continue;
      const storageKey = `rand_${key}`;
      const saved = storage.load?.(storageKey);
      if (saved != null && saved !== '') {
        if ((opts.type || 'number') === 'checkbox') {
          el.checked = saved === '1' || saved === 'true';
        } else {
          el.value = saved;
        }
      }
      el.addEventListener('change', () => {
        const value = (opts.type || 'number') === 'checkbox'
          ? (el.checked ? '1' : '0')
          : el.value;
        storage.save?.(storageKey, value);
      });
    }
  }

  initRandomMenu(button, menu, onRandomize, longPress);
  return { read };
}

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
  let longPressFired = false;
  let pressStartTime = 0;

  function toggleMenu(force) {
    const shouldOpen = typeof force === 'boolean' ? force : !menu.classList.contains('open');
    menu.classList.toggle('open', shouldOpen);
    if (shouldOpen) {
      solidMenuBackground(menu);
    }
  }

  button.addEventListener('pointerdown', () => {
    if (button.disabled) return;
    longPressFired = false;
    pressStartTime = Date.now();
    pressTimer = setTimeout(() => {
      longPressFired = true;
      toggleMenu();
      pressTimer = null;
    }, longPress);
  });

  button.addEventListener('pointerup', () => {
    if (button.disabled) return;
    const pressDuration = Date.now() - pressStartTime;

    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }

    // Only randomize if:
    // 1. Longpress did NOT fire yet, AND
    // 2. Press duration was clearly a shortpress (< 90% of longPress threshold)
    if (!longPressFired && pressDuration < longPress * 0.9) {
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
