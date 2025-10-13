/**
 * Keyboard Capture Module
 *
 * Captura entrada de teclado (tecla espacio) para registrar ritmos.
 * Funciona en paralelo con MicrophoneCapture para ejercicios de Rhythm Sync.
 *
 * IMPORTANTE: Usa event listeners en fase CAPTURE (useCapture: true) por defecto
 * para garantizar que capture eventos incluso cuando otros listeners (como
 * reproductores de audio) también escuchan la misma tecla.
 *
 * @module libs/audio-capture/keyboard
 */

/**
 * Clase para capturar pulsos de teclado (espaciador)
 */
export class KeyboardCapture {
  constructor(options = {}) {
    this.isRecording = false;

    // Timestamps de teclas presionadas
    this.detectedTaps = [];

    // Configuración
    this.config = {
      key: options.key || ' ', // Tecla a capturar (por defecto: espacio)
      keyCode: options.keyCode || 'Space', // Código de tecla alternativo
      preventRepeat: options.preventRepeat !== false, // Prevenir repeat automático
      minInterval: options.minInterval || 50, // ms mínimos entre taps (anti-rebote)
      visualFeedback: options.visualFeedback !== false, // Mostrar feedback visual
      useCapture: options.useCapture !== false, // Usar fase capture para prioridad
      ...options
    };

    // Estado
    this.lastTapTime = 0;
    this.keyIsDown = false;

    // Callbacks
    this.onTapDetected = options.onTapDetected || null;

    // Bind de métodos para event listeners
    this._handleKeyDown = this._handleKeyDown.bind(this);
    this._handleKeyUp = this._handleKeyUp.bind(this);

    // Elemento visual de feedback (opcional)
    this.feedbackElement = null;
  }

  /**
   * Inicia la captura de teclas
   * @returns {boolean} true si se inició correctamente
   */
  startRecording() {
    if (this.isRecording) {
      console.warn('⚠️ Ya se está capturando teclado');
      return false;
    }

    // Resetear timestamps
    this.detectedTaps = [];
    this.lastTapTime = 0;
    this.keyIsDown = false;

    // Agregar event listeners en fase CAPTURE para prioridad sobre otros listeners
    const listenerOptions = { capture: this.config.useCapture !== false };
    window.addEventListener('keydown', this._handleKeyDown, listenerOptions);
    window.addEventListener('keyup', this._handleKeyUp, listenerOptions);

    // Crear feedback visual si está habilitado
    if (this.config.visualFeedback) {
      this._createFeedbackElement();
    }

    this.isRecording = true;
    const keyName = this.config.key === ' ' ? 'ESPACIO' : this.config.key.toUpperCase();
    console.log(`⌨️ Iniciada captura de teclado (tecla: ${keyName})`);
    return true;
  }

  /**
   * Detiene la captura de teclas
   * @returns {Array<number>} Array de timestamps de taps detectados (en ms)
   */
  stopRecording() {
    if (!this.isRecording) {
      console.warn('⚠️ No se está capturando teclado');
      return [];
    }

    // Remover event listeners con las mismas opciones que se usaron al agregar
    const listenerOptions = { capture: this.config.useCapture !== false };
    window.removeEventListener('keydown', this._handleKeyDown, listenerOptions);
    window.removeEventListener('keyup', this._handleKeyUp, listenerOptions);

    // Remover feedback visual
    if (this.feedbackElement) {
      this._removeFeedbackElement();
    }

    this.isRecording = false;
    console.log(`⌨️ Captura detenida. ${this.detectedTaps.length} taps detectados`);
    return this.detectedTaps;
  }

  /**
   * Maneja el evento keydown
   * @private
   * @param {KeyboardEvent} event
   */
  _handleKeyDown(event) {
    if (!this.isRecording) return;

    // Verificar si es la tecla correcta
    const isTargetKey = event.key === this.config.key || event.code === this.config.keyCode;
    if (!isTargetKey) return;

    // Prevenir repeat automático del navegador
    if (this.config.preventRepeat && this.keyIsDown) {
      event.preventDefault();
      return;
    }

    const now = performance.now();

    // Anti-rebote: evitar múltiples detecciones muy seguidas
    if (now - this.lastTapTime < this.config.minInterval) {
      event.preventDefault();
      return;
    }

    // Registrar tap
    this.keyIsDown = true;
    this.detectedTaps.push(now);
    this.lastTapTime = now;

    // Prevenir comportamiento por defecto (scroll, etc.)
    event.preventDefault();

    // Feedback visual
    if (this.feedbackElement) {
      this._showFeedback();
    }

    // Callback si existe
    if (this.onTapDetected) {
      this.onTapDetected({
        timestamp: now,
        tapNumber: this.detectedTaps.length,
        key: event.key,
        code: event.code
      });
    }
  }

  /**
   * Maneja el evento keyup
   * @private
   * @param {KeyboardEvent} event
   */
  _handleKeyUp(event) {
    if (!this.isRecording) return;

    const isTargetKey = event.key === this.config.key || event.code === this.config.keyCode;
    if (!isTargetKey) return;

    this.keyIsDown = false;
    event.preventDefault();
  }

  /**
   * Crea el elemento de feedback visual
   * @private
   */
  _createFeedbackElement() {
    if (this.feedbackElement) return;

    this.feedbackElement = document.createElement('div');
    this.feedbackElement.id = 'keyboard-capture-feedback';
    this.feedbackElement.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 80px;
      height: 80px;
      background: rgba(74, 144, 226, 0.3);
      border: 3px solid #4a90e2;
      border-radius: 50%;
      pointer-events: none;
      z-index: 9999;
      transition: all 0.1s ease-out;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      color: white;
      font-weight: bold;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    `;
    this.feedbackElement.textContent = '⌨️';
    document.body.appendChild(this.feedbackElement);
  }

  /**
   * Muestra feedback visual cuando se detecta un tap
   * @private
   */
  _showFeedback() {
    if (!this.feedbackElement) return;

    // Animación de pulso
    this.feedbackElement.style.background = 'rgba(74, 144, 226, 0.8)';
    this.feedbackElement.style.transform = 'scale(1.2)';

    setTimeout(() => {
      if (this.feedbackElement) {
        this.feedbackElement.style.background = 'rgba(74, 144, 226, 0.3)';
        this.feedbackElement.style.transform = 'scale(1)';
      }
    }, 100);
  }

  /**
   * Remueve el elemento de feedback visual
   * @private
   */
  _removeFeedbackElement() {
    if (this.feedbackElement) {
      this.feedbackElement.remove();
      this.feedbackElement = null;
    }
  }

  /**
   * Obtiene los timestamps de taps detectados
   * @returns {Array<number>} Array de timestamps (en ms)
   */
  getDetectedTaps() {
    return [...this.detectedTaps];
  }

  /**
   * Configura el callback para cuando se detecta un tap
   * @param {Function} callback - Función a llamar cuando se detecta un tap
   */
  setOnTapDetected(callback) {
    this.onTapDetected = callback;
  }

  /**
   * Actualiza la configuración de captura
   * @param {Object} newConfig - Nuevos valores de configuración
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Cambia la tecla capturada (debe llamarse antes de startRecording)
   * @param {string} newKey - Nueva tecla a capturar (ej: 'Enter', 't', ' ')
   * @returns {boolean} true si se cambió correctamente
   */
  setKey(newKey) {
    if (this.isRecording) {
      console.warn('⚠️ No se puede cambiar la tecla durante la grabación');
      return false;
    }

    this.config.key = newKey;

    // Inferir keyCode desde la tecla
    const keyCodes = {
      ' ': 'Space',
      'Enter': 'Enter',
      't': 'KeyT',
      'T': 'KeyT',
      'x': 'KeyX',
      'X': 'KeyX',
      'c': 'KeyC',
      'C': 'KeyC'
    };

    this.config.keyCode = keyCodes[newKey] || newKey;

    const keyName = newKey === ' ' ? 'ESPACIO' : newKey.toUpperCase();
    console.log(`✅ Tecla cambiada a: ${keyName}`);
    return true;
  }

  /**
   * Limpia recursos
   */
  dispose() {
    if (this.isRecording) {
      this.stopRecording();
    }

    this._removeFeedbackElement();
    this.detectedTaps = [];

    console.log('🗑️ KeyboardCapture limpiado');
  }

  /**
   * Verifica si el teclado está disponible
   * @static
   * @returns {boolean}
   */
  static isSupported() {
    return typeof window !== 'undefined' && typeof window.addEventListener === 'function';
  }
}

/**
 * Clase para captura combinada de micrófono y teclado
 * Útil para ejercicios que requieren ambos inputs simultáneamente
 */
export class CombinedCapture {
  constructor(microphoneCapture, keyboardCapture) {
    this.mic = microphoneCapture;
    this.kbd = keyboardCapture;
    this.isRecording = false;

    // Timestamps combinados
    this.allEvents = [];
  }

  /**
   * Inicia captura de ambos inputs
   * @returns {Promise<boolean>} true si ambos iniciaron correctamente
   */
  async startRecording() {
    if (this.isRecording) {
      console.warn('⚠️ Ya se está grabando');
      return false;
    }

    this.allEvents = [];

    // Configurar callbacks para registrar eventos combinados
    this.mic.setOnBeatDetected((event) => {
      this.allEvents.push({ ...event, source: 'microphone' });
    });

    this.kbd.setOnTapDetected((event) => {
      this.allEvents.push({ ...event, source: 'keyboard' });
    });

    // Iniciar ambos
    const micStarted = this.mic.startRecording();
    const kbdStarted = this.kbd.startRecording();

    if (micStarted && kbdStarted) {
      this.isRecording = true;
      console.log('🎤⌨️ Captura combinada iniciada');
      return true;
    } else {
      console.error('❌ Error al iniciar captura combinada');
      return false;
    }
  }

  /**
   * Detiene captura de ambos inputs
   * @returns {Object} Resultados de ambos inputs
   */
  stopRecording() {
    if (!this.isRecording) {
      console.warn('⚠️ No se está grabando');
      return { microphone: [], keyboard: [], combined: [] };
    }

    const micBeats = this.mic.stopRecording();
    const kbdTaps = this.kbd.stopRecording();

    this.isRecording = false;

    // Ordenar eventos combinados por timestamp
    this.allEvents.sort((a, b) => a.timestamp - b.timestamp);

    const result = {
      microphone: micBeats,
      keyboard: kbdTaps,
      combined: this.allEvents,
      totalEvents: this.allEvents.length
    };

    console.log('🎤⌨️ Captura combinada detenida:', result);
    return result;
  }

  /**
   * Obtiene todos los eventos registrados
   * @returns {Array<Object>} Array de eventos con source, timestamp, etc.
   */
  getAllEvents() {
    return [...this.allEvents];
  }

  /**
   * Filtra eventos por fuente
   * @param {string} source - 'microphone' o 'keyboard'
   * @returns {Array<Object>}
   */
  getEventsBySource(source) {
    return this.allEvents.filter(event => event.source === source);
  }

  /**
   * Limpia ambos inputs
   */
  dispose() {
    this.mic.dispose();
    this.kbd.dispose();
    this.allEvents = [];
    console.log('🗑️ CombinedCapture limpiado');
  }
}

/**
 * Crea una instancia de KeyboardCapture con configuración predeterminada
 * @param {Object} options - Opciones de configuración
 * @returns {KeyboardCapture}
 */
export function createKeyboardCapture(options = {}) {
  return new KeyboardCapture(options);
}

/**
 * Crea una instancia de CombinedCapture
 * @param {MicrophoneCapture} microphoneCapture
 * @param {KeyboardCapture} keyboardCapture
 * @returns {CombinedCapture}
 */
export function createCombinedCapture(microphoneCapture, keyboardCapture) {
  return new CombinedCapture(microphoneCapture, keyboardCapture);
}
