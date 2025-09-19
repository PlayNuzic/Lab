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
    pulso: 'libs/sound/samples/pulso.wav',
    pulso0: 'libs/sound/samples/pulso0.wav',

    // Pulsos seleccionados (acentos individuales de usuario)
    seleccionados: 'libs/sound/samples/seleccionados.wav',

    // Sonidos adicionales opcionales (inicio de vuelta / subdivisión de ciclo)
    start: 'libs/sound/samples/start.wav',
    cycle: 'libs/sound/samples/cycle.wav'
  };
  return normalizeMap(DEFAULT_SAMPLE_MAP);
}

function normalizeMap(map) {
  // estandarizamos claves
  return {
    pulso: map.pulso || map.base || map.click || null,
    pulso0: map.pulso0 || map.baseAlt || null,
    seleccionados: map.seleccionados || map.selected || map.accent || null,
    start: map.start || null,
    cycle: map.cycle || null
  };
}
