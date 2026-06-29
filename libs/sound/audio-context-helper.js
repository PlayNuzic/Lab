// libs/sound/audio-context-helper.js
// Helper functions for AudioContext management
// Extracted to avoid circular dependencies with piano.js/flute.js

import { log } from '../app-common/logger.js';

// Tots els samples del motor (Salamander piano, click samples, etc.) són
// 44.1 kHz. Si l'AudioContext corre a una altra rate (Firefox/Linux usa
// 48 kHz per defecte), el navegador fa resampling per cada buffer amb un
// filtre que afegeix ripple d'amplitud — causa principal del "volum
// inestable" cross-browser. Forcem 44100 per eliminar aquesta capa.
const PREFERRED_SAMPLE_RATE = 44100;

/**
 * Get the Tone.js AudioContext
 * @returns {AudioContext|null}
 */
function getToneContext() {
  if (typeof Tone === 'undefined') return null;

  // Try different ways to access the context
  if (Tone.context && Tone.context.rawContext) {
    return Tone.context.rawContext;
  }
  if (Tone.context && typeof Tone.context.state === 'string') {
    return Tone.context;
  }
  if (Tone.getContext) {
    const ctx = Tone.getContext();
    return ctx?.rawContext || ctx;
  }
  return null;
}

/**
 * Check if context is running
 * @param {AudioContext} ctx
 * @returns {boolean}
 */
function isRunning(ctx) {
  return !!ctx && typeof ctx.state === 'string' && ctx.state === 'running';
}

/**
 * Si Tone.js encara no ha creat el seu AudioContext, n'instanciem un amb
 * sampleRate=44100 i li'l donem via Tone.setContext(). Si ja n'hi ha un
 * però corre a una rate diferent, també el substituïm. Cal cridar-ho
 * després del gest d'usuari i abans de Tone.start().
 */
export function ensurePreferredSampleRateContext() {
  if (typeof Tone === 'undefined') return;
  if (typeof window === 'undefined') return;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return;

  const current = getToneContext();
  if (current && current.sampleRate === PREFERRED_SAMPLE_RATE) return;

  try {
    const next = new Ctor({ latencyHint: 'interactive', sampleRate: PREFERRED_SAMPLE_RATE });
    if (typeof Tone.setContext === 'function') {
      Tone.setContext(next);
    }
    // LA-02: el context desplaçat era l'auto-creat de Tone, sense nodes del
    // motor encara (som pre-Tone.start). Si no es tanca, el seu thread
    // d'àudio viu tota la pàgina (iOS en limita ~4 de concurrents).
    // close() retorna una PROMESA: el rebuig (Tone v15 ja el tanca tot sol
    // dins de setContext → "Cannot close a closed AudioContext") s'ha
    // d'absorbir aquí — un try/catch síncron no atrapa rebuigs async i
    // sortia com a excepció no capturada a la consola.
    if (current && current !== next) {
      const raw = current.rawContext || current;
      try { Promise.resolve(raw.close?.()).catch(() => {}); } catch {}
    }
    log(`[audio] AudioContext sampleRate = ${next.sampleRate} Hz (requested ${PREFERRED_SAMPLE_RATE})`);
  } catch (err) {
    // Si el navegador rebutja sampleRate (poc comú) seguim amb el default
    console.warn('Could not pin AudioContext sampleRate to 44100:', err?.message || err);
  }
}

