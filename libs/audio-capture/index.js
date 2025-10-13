/**
 * Audio Capture Library
 *
 * Sistema de captura y análisis de audio para ejercicios rítmicos.
 * Incluye captura de micrófono, teclado y análisis de ritmo.
 *
 * @module libs/audio-capture
 */

// Microphone capture
export {
  MicrophoneCapture,
  createMicrophoneCapture
} from './microphone.js';

// Keyboard capture
export {
  KeyboardCapture,
  CombinedCapture,
  createKeyboardCapture,
  createCombinedCapture
} from './keyboard.js';

// Rhythm analysis
export {
  RhythmAnalyzer,
  createRhythmAnalyzer,
  generateExpectedPattern,
  fractionsToTimestamps
} from './rhythm-analysis.js';

/**
 * Factory function para crear un sistema completo de captura
 * @param {Object} options - Opciones de configuración
 * @returns {Object} Sistema completo con mic, kbd, analyzer y combined
 */
export async function createCaptureSystem(options = {}) {
  // Asegurar que Tone.js está cargado antes de crear MicrophoneCapture
  const { ensureToneLoaded } = await import('../sound/tone-loader.js');
  await ensureToneLoaded();

  const {
    MicrophoneCapture,
    KeyboardCapture,
    CombinedCapture,
    RhythmAnalyzer
  } = await import('./index.js');

  const mic = new MicrophoneCapture(options.microphone || {});
  const kbd = new KeyboardCapture(options.keyboard || {});
  const analyzer = new RhythmAnalyzer(options.analyzer || {});
  const combined = new CombinedCapture(mic, kbd);

  // Intentar inicializar el micrófono
  const micInitialized = await mic.initialize();

  return {
    mic,
    kbd,
    analyzer,
    combined,
    micInitialized,
    dispose: () => {
      mic.dispose();
      kbd.dispose();
      console.log('🗑️ Sistema de captura completo limpiado');
    }
  };
}

/**
 * Verifica si el sistema de captura es soportado por el navegador
 * @returns {Object} Estado de soporte para cada componente
 */
export function checkSupport() {
  const support = {
    microphone: MicrophoneCapture.isSupported(),
    keyboard: KeyboardCapture.isSupported(),
    overall: false
  };

  support.overall = support.microphone && support.keyboard;

  if (!support.microphone) {
    console.warn('⚠️ Micrófono no soportado en este navegador');
  }
  if (!support.keyboard) {
    console.warn('⚠️ Captura de teclado no soportada en este navegador');
  }

  return support;
}

// Re-exportar clases para imports directos
import { MicrophoneCapture } from './microphone.js';
import { KeyboardCapture } from './keyboard.js';
