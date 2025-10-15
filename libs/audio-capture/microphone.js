/**
 * Microphone Capture Module
 *
 * Captura entrada de audio del micrófono y detecta pulsos/beats.
 * Utiliza Tone.js para acceso al micrófono y análisis de audio.
 *
 * @module libs/audio-capture/microphone
 */

import { ensureToneLoaded } from '../sound/tone-loader.js';
/* global Tone */

/**
 * Clase para capturar y analizar audio del micrófono
 */
export class MicrophoneCapture {
  constructor(options = {}) {
    this.mic = null;
    this.meter = null;
    this.isRecording = false;
    this.isInitialized = false;

    // Timestamps de beats detectados
    this.detectedBeats = [];

    // Configuración de detección de beats
    this.config = {
      threshold: options.threshold || -30, // dB threshold para detectar un beat
      minInterval: options.minInterval || 100, // ms mínimos entre beats (evitar doble detección)
      smoothing: options.smoothing || 0.8, // Factor de suavizado (0-1)
      ...options
    };

    // Estado de detección
    this.lastBeatTime = 0;
    this.detectionInterval = null;
    this.detectionIntervalMs = 50; // Chequear cada 50ms

    // Callbacks
    this.onBeatDetected = options.onBeatDetected || null;
  }

  /**
   * Verifica los permisos del micrófono
   * @returns {Promise<string>} Estado: 'granted', 'denied', 'prompt', o 'unknown'
   */
  async checkPermissions() {
    try {
      const result = await navigator.permissions.query({ name: 'microphone' });
      if (result.state === 'denied') {
        console.warn('⚠️ Permisos de micrófono denegados');
      } else if (result.state === 'granted') {
        console.log('✅ Permisos de micrófono concedidos');
      } else if (result.state === 'prompt') {
        console.log('ℹ️  Permisos de micrófono pendientes (se solicitarán al inicializar)');
      }
      return result.state;
    } catch (e) {
      console.warn('⚠️ No se pudo verificar permisos de micrófono:', e.message);
      return 'unknown';
    }
  }

  /**
   * Inicializa el micrófono y el medidor de volumen
   * @returns {Promise<boolean>} true si se inicializó correctamente
   */
  async initialize() {
    if (this.isInitialized) {
      console.warn('⚠️ MicrophoneCapture ya está inicializado');
      return true;
    }

    try {
      // Verificar permisos primero
      await this.checkPermissions();

      // Asegurar que Tone.js está cargado
      await ensureToneLoaded();

      // Asegurar que Tone.js está inicializado
      if (Tone.context.state !== 'running') {
        await Tone.start();
      }

      // Crear input de micrófono
      this.mic = new Tone.UserMedia();

      // Crear medidor de volumen con suavizado
      this.meter = new Tone.Meter({
        smoothing: this.config.smoothing
      });

      // Conectar micrófono al medidor
      this.mic.connect(this.meter);

      // Abrir el micrófono (solicita permisos)
      await this.mic.open();

      this.isInitialized = true;
      console.log('✅ Micrófono inicializado correctamente');
      console.log(`ℹ️  Threshold actual: ${this.config.threshold} (usa valores menores como -20 o -30 si no detecta audio)`);
      return true;

    } catch (error) {
      console.error('❌ Error al inicializar el micrófono:', error);

      if (error.name === 'NotAllowedError') {
        console.error('   El usuario denegó el acceso al micrófono');
        console.error('   Solución: Permitir micrófono en configuración del navegador y recargar');
      } else if (error.name === 'NotFoundError') {
        console.error('   No se encontró ningún dispositivo de micrófono');
      } else if (error.name === 'NotReadableError') {
        console.error('   El micrófono está siendo usado por otra aplicación');
      }

      return false;
    }
  }

  /**
   * Inicia la grabación y detección de beats
   * @returns {boolean} true si se inició correctamente
   */
  startRecording() {
    if (!this.isInitialized) {
      console.error('❌ Debes llamar a initialize() primero');
      return false;
    }

    if (this.isRecording) {
      console.warn('⚠️ Ya se está grabando');
      return false;
    }

    // Resetear timestamps
    this.detectedBeats = [];
    this.lastBeatTime = 0;

    // Iniciar detección de beats
    this.isRecording = true;
    this._startBeatDetection();

    console.log('🎤 Iniciada grabación de audio');
    return true;
  }

  /**
   * Detiene la grabación y detección de beats
   * @returns {Array<number>} Array de timestamps de beats detectados (en ms)
   */
  stopRecording() {
    if (!this.isRecording) {
      console.warn('⚠️ No se está grabando');
      return [];
    }

    this.isRecording = false;
    this._stopBeatDetection();

    console.log(`🎤 Grabación detenida. ${this.detectedBeats.length} beats detectados`);
    return this.detectedBeats;
  }

  /**
   * Inicia el loop de detección de beats
   * @private
   */
  _startBeatDetection() {
    let sampleCount = 0;
    this.detectionInterval = setInterval(() => {
      if (!this.isRecording) return;

      // Obtener nivel de volumen actual (en dB)
      const level = this.meter.getValue();

      // DEBUG: Log de amplitudes cada ~100 muestras (~1 segundo con detectionIntervalMs=10)
      sampleCount++;
      if (sampleCount % 100 === 0) {
        console.log(`🎤 Nivel actual: ${level.toFixed(2)} dB | Threshold: ${this.config.threshold} dB`);
      }

      // Detectar si supera el umbral
      if (level > this.config.threshold) {
        const now = performance.now();

        // Evitar detección múltiple del mismo beat
        if (now - this.lastBeatTime > this.config.minInterval) {
          this.detectedBeats.push(now);
          this.lastBeatTime = now;

          console.log(`🔊 Beat detectado! Nivel: ${level.toFixed(2)} dB`);

          // Callback si existe
          if (this.onBeatDetected) {
            this.onBeatDetected({
              timestamp: now,
              level: level,
              beatNumber: this.detectedBeats.length
            });
          }
        }
      }
    }, this.detectionIntervalMs);
  }

  /**
   * Detiene el loop de detección de beats
   * @private
   */
  _stopBeatDetection() {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }
  }

  /**
   * Obtiene los timestamps de beats detectados
   * @returns {Array<number>} Array de timestamps (en ms)
   */
  getDetectedBeats() {
    return [...this.detectedBeats];
  }

  /**
   * Obtiene el nivel actual del micrófono
   * @returns {number} Nivel en dB (negativo = más silencioso)
   */
  getCurrentLevel() {
    if (!this.isInitialized || !this.meter) {
      return -Infinity;
    }
    return this.meter.getValue();
  }

  /**
   * Calibra automáticamente el threshold basado en el ruido de fondo
   * @param {number} duration - Duración de la calibración en ms (default: 2000)
   * @returns {Promise<number>} Threshold calibrado en dB
   */
  async calibrateNoiseFloor(duration = 2000) {
    if (!this.isInitialized) {
      console.error('❌ Debes llamar a initialize() primero');
      return this.config.threshold;
    }

    console.log('🎤 Calibrando ruido de fondo...');
    console.log('   Mantén silencio durante los próximos segundos...');

    const samples = [];
    const sampleInterval = 50; // Muestra cada 50ms
    const startTime = performance.now();

    // Recoger muestras durante 'duration' ms
    const interval = setInterval(() => {
      const level = this.meter.getValue();

      // Solo añadir muestras válidas (ignorar -Infinity o NaN)
      if (isFinite(level)) {
        samples.push(level);
      }

      // Mostrar progreso
      const elapsed = performance.now() - startTime;
      if (samples.length % 10 === 0 && samples.length > 0) { // Cada 500ms
        const progress = Math.round((elapsed / duration) * 100);
        console.log(`   Calibrando... ${progress}%`);
      }
    }, sampleInterval);

    // Esperar la duración especificada
    await new Promise(resolve => setTimeout(resolve, duration));
    clearInterval(interval);

    if (samples.length === 0) {
      console.error('❌ No se pudieron recoger muestras válidas');
      console.error('   El micrófono puede estar silenciado o no está funcionando');
      console.error('   Usando threshold por defecto');
      return this.config.threshold;
    }

    // Calcular estadísticas del ruido
    const avgNoise = samples.reduce((a, b) => a + b, 0) / samples.length;
    const maxNoise = Math.max(...samples);
    const minNoise = Math.min(...samples);

    // Calcular desviación estándar
    const variance = samples.reduce((acc, val) => acc + Math.pow(val - avgNoise, 2), 0) / samples.length;
    const stdDev = Math.sqrt(variance);

    // Verificar que los valores calculados son válidos
    if (!isFinite(avgNoise) || !isFinite(maxNoise) || !isFinite(stdDev)) {
      console.error('❌ Valores de calibración inválidos');
      console.error('   Usando threshold por defecto');
      return this.config.threshold;
    }

    // Establecer threshold = máximo ruido + margen dinámico
    // El margen depende de la variabilidad del ruido
    const margin = Math.max(6, stdDev * 2); // Mínimo 6 dB, o 2 veces la desviación estándar
    const suggestedThreshold = maxNoise + margin;

    console.log('📊 Análisis del ruido de fondo:');
    console.log(`   Promedio: ${avgNoise.toFixed(1)} dB`);
    console.log(`   Mínimo: ${minNoise.toFixed(1)} dB`);
    console.log(`   Máximo: ${maxNoise.toFixed(1)} dB`);
    console.log(`   Desv. estándar: ${stdDev.toFixed(1)} dB`);
    console.log(`   Margen aplicado: ${margin.toFixed(1)} dB`);
    console.log(`✅ Threshold calibrado: ${suggestedThreshold.toFixed(1)} dB`);

    // Actualizar el threshold automáticamente
    this.config.threshold = suggestedThreshold;

    return suggestedThreshold;
  }

  /**
   * Configura el callback para cuando se detecta un beat
   * @param {Function} callback - Función a llamar cuando se detecta un beat
   */
  setOnBeatDetected(callback) {
    this.onBeatDetected = callback;
  }

  /**
   * Actualiza la configuración de detección
   * @param {Object} newConfig - Nuevos valores de configuración
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };

    // Actualizar meter si existe
    if (this.meter && newConfig.smoothing !== undefined) {
      // Nota: Tone.Meter no permite cambiar smoothing después de crear
      console.warn('⚠️ Para cambiar smoothing, debes re-inicializar el micrófono');
    }
  }

  /**
   * Limpia recursos y cierra el micrófono
   */
  dispose() {
    this._stopBeatDetection();

    if (this.mic) {
      this.mic.close();
      this.mic.dispose();
      this.mic = null;
    }

    if (this.meter) {
      this.meter.dispose();
      this.meter = null;
    }

    this.isInitialized = false;
    this.isRecording = false;
    this.detectedBeats = [];

    console.log('🗑️ MicrophoneCapture limpiado');
  }

  /**
   * Verifica si el navegador soporta getUserMedia
   * @static
   * @returns {boolean}
   */
  static isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  /**
   * Solicita permisos de micrófono sin inicializar
   * @static
   * @returns {Promise<boolean>}
   */
  static async requestPermissions() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Cerrar el stream inmediatamente
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.error('❌ Error al solicitar permisos de micrófono:', error);
      return false;
    }
  }
}

/**
 * Crea una instancia de MicrophoneCapture con configuración predeterminada
 * @param {Object} options - Opciones de configuración
 * @returns {Promise<MicrophoneCapture>}
 */
export async function createMicrophoneCapture(options = {}) {
  const mic = new MicrophoneCapture(options);
  await mic.initialize();
  return mic;
}
