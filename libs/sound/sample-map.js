// libs/sound/sample-map.js
// Mapa explícito de samples. Intenta cargar un "manifest" si existe; si no, usa defaults.

export async function loadSampleMap() {
  // 1) Intento: manifest propio del repo (si existe). Debe exportar DEFAULT_SAMPLE_MAP.
  try {
    const mod = await import('./samples/manifest.js');
    if (mod && mod.DEFAULT_SAMPLE_MAP) return normalizeMap(mod.DEFAULT_SAMPLE_MAP);
  } catch { /* no manifest, seguimos */ }

  // 2) Defaults (ajusta nombres si difieren en tu árbol de /samples)
  const DEFAULT_SAMPLE_MAP = {
    // Grupo Pulso = Pulso + Pulso 0 (ambas rutas se mezclan en el mismo bus)
    pulso: 'click1',
    pulso0: 'click1',

    // Pulsos seleccionados (acentos individuales de usuario)
    seleccionados: 'click2',

    // Sonidos adicionales opcionales (inicio de vuelta / subdivisión de ciclo)
    start: 'click3',
    cycle: 'click4'
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
  // estandarizamos claves
  const base = normalizeValue(map.pulso || map.base || map.click);
  return {
    pulso: base,
    pulso0: normalizeValue(map.pulso0 || map.baseAlt) || base,
    seleccionados: normalizeValue(map.seleccionados || map.selected || map.accent),
    start: normalizeValue(map.start),
    cycle: normalizeValue(map.cycle)
  };
}
