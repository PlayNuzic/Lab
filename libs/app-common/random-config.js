import { resolveRange, resolveIntRange } from './number.js';

export function applyBaseRandomConfig(cfg, controls = {}) {
  if (!cfg) return;
  const { allowComplex: allowComplexToggle, ...rangeControls } = controls;
  Object.entries(rangeControls).forEach(([key, control]) => {
    if (!control) return;
    const entry = cfg[key];
    if (!entry) return;
    const { toggle, min, max } = control;
    if (toggle) toggle.checked = !!entry.enabled;
    if (min && entry.range) min.value = entry.range[0];
    if (max && entry.range) max.value = entry.range[1];
  });
  if (allowComplexToggle && typeof cfg.allowComplex === 'boolean') {
    allowComplexToggle.checked = cfg.allowComplex;
  }
}

export function updateBaseRandomConfig(randomConfig, controls = {}, defaults = {}) {
  if (!randomConfig) return randomConfig;
  const { allowComplex: allowComplexToggle, ...rangeControls } = controls;

  Object.entries(rangeControls).forEach(([key, control]) => {
    if (!control) return;
    const fallbackRange = (randomConfig[key]?.range && [...randomConfig[key].range])
      || (defaults[key]?.range && [...defaults[key].range])
      || [0, 0];
    const fallbackEnabled = typeof randomConfig[key]?.enabled === 'boolean'
      ? randomConfig[key].enabled
      : (typeof defaults[key]?.enabled === 'boolean' ? defaults[key].enabled : true);
    const { toggle, min, max, integer = false, minValue } = control;
    const range = integer
      ? resolveIntRange(min?.value, max?.value, fallbackRange, { minValue })
      : resolveRange(min?.value, max?.value, fallbackRange, { minValue });
    randomConfig[key] = {
      enabled: toggle ? !!toggle.checked : fallbackEnabled,
      range
    };
  });

  if (allowComplexToggle) {
    randomConfig.allowComplex = !!allowComplexToggle.checked;
  } else if (typeof randomConfig.allowComplex !== 'boolean' && typeof defaults.allowComplex === 'boolean') {
    randomConfig.allowComplex = defaults.allowComplex;
  }

  return randomConfig;
}
