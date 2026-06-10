// libs/sound/audio-context-helper.js
// Helper functions for AudioContext management
// Extracted to avoid circular dependencies with piano.js/flute.js

import { waitForUserInteraction } from './user-interaction.js';
import { ensureToneLoaded } from './tone-loader.js';
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
    log(`[audio] AudioContext sampleRate = ${next.sampleRate} Hz (requested ${PREFERRED_SAMPLE_RATE})`);
  } catch (err) {
    // Si el navegador rebutja sampleRate (poc comú) seguim amb el default
    console.warn('Could not pin AudioContext sampleRate to 44100:', err?.message || err);
  }
}

/**
 * Ensure Tone.js AudioContext is started and running
 * This function handles all the complexity of starting the audio context:
 * - Waits for user interaction
 * - Calls Tone.start()
 * - Falls back to context.resume()
 * - Handles errors gracefully
 *
 * @returns {Promise<boolean>} True if context is running
 */
export async function ensureToneContextRunning() {
  // Load Tone.js if not already loaded
  await ensureToneLoaded();

  if (typeof Tone === 'undefined') {
    console.warn('Tone.js not available');
    return false;
  }

  // Check if already running
  const contextBefore = getToneContext();
  if (isRunning(contextBefore)) {
    return true;
  }

  // Wait for user interaction before attempting to start audio
  await waitForUserInteraction();

  // Forcem el sampleRate ABANS de Tone.start() perquè el context que
  // crea Tone.js per defecte usa la rate del dispositiu (48kHz a
  // Firefox/Linux), provocant resampling silenciós a cada buffer.
  ensurePreferredSampleRateContext();

  // Try Tone.start()
  if (typeof Tone.start === 'function') {
    try {
      await Tone.start();
    } catch (error) {
      // Ignore autoplay policy errors - will try resume below
      if (error?.name !== 'InvalidAccessError' &&
          error?.name !== 'NotAllowedError' &&
          error?.name !== 'DOMException') {
        throw error;
      }
    }
  }

  // Check if now running
  let context = getToneContext();
  if (isRunning(context)) {
    return true;
  }

  // Try context.resume() as fallback
  if (context && typeof context.resume === 'function') {
    try {
      await context.resume();
    } catch (error) {
      // Ignore autoplay policy errors
      if (error?.name !== 'InvalidAccessError' &&
          error?.name !== 'NotAllowedError' &&
          error?.name !== 'DOMException') {
        throw error;
      }
    }
  }

  // Final check
  context = getToneContext();
  return isRunning(context);
}

/**
 * Check if Tone.js AudioContext is currently running
 * @returns {boolean}
 */
export function isToneContextRunning() {
  const context = getToneContext();
  return isRunning(context);
}
