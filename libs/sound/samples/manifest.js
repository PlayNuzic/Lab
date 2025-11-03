// libs/sound/samples/manifest.js
// Mantén un único punto de verdad sobre qué samples usar en las apps del Lab.
// Exporta `DEFAULT_SAMPLE_MAP` con los IDs que `TimelineAudio` conoce.
// Puedes apuntar a otro sample registrado en SOUND_URLS (por id) o a rutas
// relativas dentro de este directorio (se resolverán como URLs absolutas).

export const DEFAULT_SAMPLE_MAP = {
  // Pulso principal y Pulso 0 usan sonidos distintos por defecto.
  pulso: 'click9',
  pulso0: 'click7',

  // Acentos individuales marcados por el usuario.
  seleccionados: 'click8',

  // Inicio de compás y subdivisiones del ciclo.
  start: 'click7',
  cycle: 'click10',

  // Ruido rosa para efectos especiales.
  ruidoRosa: 'click11'
};

// Permite sobrescribir dinámicamente desde fuera si fuese necesario.
export default DEFAULT_SAMPLE_MAP;
