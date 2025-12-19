// libs/sound/audio-context-helper.js
// Helper functions for AudioContext management
// Extracted to avoid circular dependencies with piano.js/violin.js

import { waitForUserInteraction } from './user-interaction.js';
import { ensureToneLoaded } from './tone-loader.js';

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
