// libs/sound/sample-map.js
// Mapa explícito de samples. Intenta cargar un "manifest" si existe; si no, usa defaults.

export async function loadSampleMap() {
  // 1) Intento: manifest propio del repo (si existe). Debe exportar DEFAULT_SAMPLE_MAP.
  try {
    const manifestUrl = new URL('./samples/manifest.js', import.meta.url);
    const mod = await import(manifestUrl.href);
    const map = mod?.DEFAULT_SAMPLE_MAP || mod?.default;
    if (map) return normalizeMap(map);
  } catch { /* no manifest, seguimos */ }

  // 2) Defaults (ajusta nombres si difieren en tu árbol de /samples)
  const DEFAULT_SAMPLE_MAP = {
    // Pulso principal (base) y Pulso 0 usan sonidos diferenciados por defecto
    pulso: 'click9',
    pulso0: 'click7',

    // Pulsos seleccionados (acentos individuales del usuario)
    seleccionados: 'click8',

    // Sonidos adicionales opcionales (inicio de vuelta / subdivisión de ciclo)
    start: 'click7',
    cycle: 'click10'
  };
  return normalizeMap(DEFAULT_SAMPLE_MAP);
}

function normalizeValue(value) {
  if (!value) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const looksLikePath = /[\/]/.test(trimmed) || /\.[a-z0-9]+$/i.test(trimmed);
  if (!looksLikePath) return trimmed;
  try {
    return new URL(trimmed, import.meta.url).href;
  } catch {
    return trimmed;
  }
}

function normalizeMap(map) {
  const source = (map && typeof map === 'object') ? map : {};
  // estandarizamos claves
  const base = normalizeValue(source.pulso || source.base || source.click);
  return {
    pulso: base,
    pulso0: normalizeValue(source.pulso0 || source.baseAlt) || base,
    seleccionados: normalizeValue(source.seleccionados || source.selected || source.accent),
    start: normalizeValue(source.start),
    cycle: normalizeValue(source.cycle)
  };
}
