/**
 * Sistema de Gamificación - Módulo Principal
 * Exporta todas las funciones y clases del sistema de gamificación
 */

// Sistema de eventos
export {
  EVENT_TYPES,
  GameEventSystem,
  getEventSystem
} from './event-system.js';

// Sistema de puntuación
export {
  ScoringSystem,
  getScoringSystem,
  MULTIPLIERS,
  BONUSES
} from './scoring-system.js';

// Sistema de logros
export {
  AchievementSystem,
  getAchievementSystem,
  ACHIEVEMENTS
} from './achievements.js';

// Sistema de almacenamiento
export {
  GameDataStore,
  getGameDataStore,
  STORAGE_CONFIG,
  STORAGE_KEYS
} from './storage.js';

// Configuración
export {
  GAMIFICATION_CONFIG,
  APP_EVENT_MAPPINGS,
  THRESHOLDS,
  DEV_CONFIG,
  getConfigManager,
  isGamificationEnabled,
  getAppGamificationConfig
} from './config.js';

// User Manager (Simplified - Single User)
export {
  UserManager,
  getUserManager
} from './user-manager.js';

// Audio Capture (Phase 2b)
export {
  MicrophoneCapture,
  createMicrophoneCapture,
  KeyboardCapture,
  CombinedCapture,
  createKeyboardCapture,
  createCombinedCapture,
  RhythmAnalyzer,
  createRhythmAnalyzer,
  generateExpectedPattern,
  fractionsToTimestamps,
  createCaptureSystem,
  checkSupport
} from '../audio-capture/index.js';

// Importar funciones necesarias para uso interno en este módulo
import {
  DEV_CONFIG as DEV_CONFIG_INTERNAL,
  APP_EVENT_MAPPINGS,
  getConfigManager,
  isGamificationEnabled,
  getAppGamificationConfig
} from './config.js';

import { getEventSystem } from './event-system.js';
import { getScoringSystem } from './scoring-system.js';
import { getAchievementSystem } from './achievements.js';
import { getGameDataStore } from './storage.js';

/**
 * Clase principal que unifica todos los sistemas
 */
class GamificationManager {
  constructor() {
    this.config = getConfigManager();
    this.events = null;
    this.scoring = null;
    this.achievements = null;
    this.storage = null;
    this.initialized = false;
  }

  /**
   * Inicializa el sistema de gamificación
   */
  init(appId = 'unknown') {
    if (this.initialized) {
      return true;
    }

    // Verificar si está habilitado
    if (!isGamificationEnabled()) {
      console.info('Sistema de gamificación deshabilitado');
      return false;
    }

    // Verificar configuración de la app
    const appConfig = getAppGamificationConfig(appId);
    if (!appConfig.enabled) {
      console.info(`Gamificación deshabilitada para ${appId}`);
      return false;
    }

    // Inicializar subsistemas
    this.events = getEventSystem();
    this.scoring = getScoringSystem();
    this.achievements = getAchievementSystem();
    this.storage = getGameDataStore();

    // Configurar listeners
    this.setupEventListeners();

    // Marcar como inicializado
    this.initialized = true;
    this.appId = appId;

    // Log de debug
    if (this.config.getConfig().debugMode) {
      console.log(`Sistema de gamificación inicializado para ${appId}`);
    }

    return true;
  }

  /**
   * Configura los listeners de eventos
   */
  setupEventListeners() {
    // Listener para procesar eventos automáticamente
    this.events.addEventListener((event) => {
      // Guardar evento
      this.storage.saveEvent(event);

      // Calcular puntuación
      if (this.config.isFeatureEnabled('scoring')) {
        const score = this.scoring.calculateScore(event.evento_tipo, event.metadata);
        event.puntuacion_obtenida = score;
      }

      // Verificar logros periódicamente
      if (this.config.isFeatureEnabled('achievements')) {
        this.checkAchievementsThrottled();
      }
    });
  }

  /**
   * Verifica logros de forma throttled
   */
  checkAchievementsThrottled = (() => {
    let timeout;
    return () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const eventHistory = this.events.getEventHistory();
        const newAchievements = this.achievements.checkAchievements(eventHistory);

        // En fase 2, aquí se mostrarían notificaciones
        if (newAchievements.length > 0 && this.config.getConfig().debugMode) {
          console.log('Nuevos logros desbloqueados:', newAchievements);
        }
      }, 5000); // Verificar 5 segundos después del último evento
    };
  })();

  /**
   * Registra un evento personalizado
   */
  trackEvent(eventType, metadata = {}) {
    if (!this.initialized) {
      console.warn('Sistema de gamificación no inicializado');
      return null;
    }

    // Añadir app_id a los metadatos
    metadata.app_id = this.appId;

    // Verificar si se debe trackear este evento
    if (!this.config.shouldTrackEvent(eventType)) {
      return null;
    }

    return this.events.trackEvent(eventType, metadata);
  }

  /**
   * Registra una acción específica de la app
   */
  trackAppAction(action, metadata = {}) {
    if (!this.initialized) return null;

    // Obtener el mapeo de eventos para la app
    const mappings = APP_EVENT_MAPPINGS[this.appId];
    if (!mappings || !mappings[action]) {
      console.warn(`Acción no mapeada: ${action} para ${this.appId}`);
      return null;
    }

    const eventType = mappings[action];
    return this.trackEvent(eventType, metadata);
  }

  /**
   * Obtiene las estadísticas actuales
   */
  getStats() {
    if (!this.initialized) return null;

    return {
      session: this.events.getSessionStats(),
      scoring: this.scoring.getSessionStats(),
      achievements: this.achievements.getSummary(),
      storage: this.storage.getStorageUsage()
    };
  }

  /**
   * Obtiene el nivel del usuario
   */
  getUserLevel() {
    if (!this.initialized) return null;
    return this.scoring.getUserLevel();
  }

  /**
   * Obtiene todos los logros
   */
  getAchievements() {
    if (!this.initialized) return [];
    return this.achievements.getAllAchievements();
  }

  /**
   * Obtiene el progreso de un logro específico
   */
  getAchievementProgress(achievementId) {
    if (!this.initialized) return null;
    return this.achievements.getProgress(achievementId);
  }

  /**
   * Exporta todos los datos del usuario
   */
  exportUserData() {
    if (!this.initialized) return null;

    return {
      version: '1.0.0',
      export_date: new Date().toISOString(),
      app_id: this.appId,
      events: this.events.exportEvents(),
      scoring: this.scoring.exportData(),
      achievements: this.achievements.exportData(),
      storage: this.storage.exportAllData(),
      config: this.config.exportConfig()
    };
  }

  /**
   * Importa datos del usuario
   */
  importUserData(data) {
    if (!data || data.version !== '1.0.0') {
      console.error('Datos incompatibles');
      return false;
    }

    try {
      if (data.events) this.events.importEvents(data.events);
      if (data.scoring) this.scoring.importData(data.scoring);
      if (data.achievements) this.achievements.importData(data.achievements);
      if (data.storage) this.storage.importData(data.storage);
      if (data.config) this.config.importConfig(data.config);

      return true;
    } catch (error) {
      console.error('Error importando datos:', error);
      return false;
    }
  }

  /**
   * Reinicia la sesión actual
   */
  resetSession() {
    if (!this.initialized) return;

    this.events.clearEvents();
    this.scoring.resetSession();
  }

  /**
   * Reinicia todo el sistema (para testing)
   */
  resetAll() {
    if (!this.initialized) return;

    this.events.clearEvents();
    this.scoring.resetSession();
    this.achievements.resetAll();
    this.storage.clearAll();
    this.config.resetToDefaults();
  }

  /**
   * Destruye la instancia
   */
  destroy() {
    this.initialized = false;
    this.events = null;
    this.scoring = null;
    this.achievements = null;
    this.storage = null;
  }
}

// Crear instancia singleton del manager principal
let managerInstance = null;

/**
 * Obtiene o crea la instancia del manager de gamificación
 */
export function getGamificationManager() {
  if (!managerInstance) {
    managerInstance = new GamificationManager();
  }
  return managerInstance;
}

/**
 * Inicializa el sistema de gamificación para una app específica
 */
export function initGamification(appId) {
  const manager = getGamificationManager();
  return manager.init(appId);
}

/**
 * Función helper para trackear eventos fácilmente
 */
export function trackEvent(eventType, metadata = {}) {
  const manager = getGamificationManager();
  return manager.trackEvent(eventType, metadata);
}

/**
 * Función helper para trackear acciones de app
 */
export function trackAppAction(action, metadata = {}) {
  const manager = getGamificationManager();
  return manager.trackAppAction(action, metadata);
}

/**
 * Record an exercise attempt to localStorage
 * Helper function for exercise tracking (offline mode)
 * @param {object} data - Exercise attempt data
 * @param {string} data.exercise_type - Type of exercise (e.g., "sequence-entry_level_1")
 * @param {string} data.exercise_title - Human readable title
 * @param {number} data.score - Score achieved (0-100)
 * @param {number} data.accuracy - Accuracy percentage (0-100)
 * @param {object} data.metadata - Additional data about the attempt
 * @returns {object} Attempt record saved to localStorage
 */
export function recordAttempt(data) {
  try {
    const attempt = {
      attempt_id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      exercise_type: data.exercise_type,
      exercise_title: data.exercise_title || data.exercise_type,
      score: data.score || 0,
      accuracy: data.accuracy || 0,
      metadata: data.metadata || {},
      timestamp: Date.now(),
      completed_at: new Date().toISOString()
    };

    // Get existing attempts from localStorage
    const attemptsKey = 'gamification_exercise_attempts';
    const stored = localStorage.getItem(attemptsKey);
    const attempts = stored ? JSON.parse(stored) : [];

    // Add new attempt
    attempts.push(attempt);

    // Keep only last 100 attempts
    if (attempts.length > 100) {
      attempts.splice(0, attempts.length - 100);
    }

    // Save to localStorage
    localStorage.setItem(attemptsKey, JSON.stringify(attempts));

    console.log('✅ Intento guardado:', attempt.attempt_id);

    return {
      success: true,
      attempt_id: attempt.attempt_id,
      message: 'Attempt recorded successfully in localStorage'
    };
  } catch (error) {
    console.error('Error recording attempt:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Exportar el manager para debugging si está habilitado
if (typeof window !== 'undefined' && DEV_CONFIG_INTERNAL.enableDevTools) {
  window.__GAMIFICATION = getGamificationManager();

  // Exponer ear-training modules globalmente para tests de consola (si existen)
  import('../ear-training/index.js').then(earTraining => {
    window.__EAR_TRAINING = {
      CountInController: earTraining.CountInController,
      ExerciseRunner: earTraining.ExerciseRunner,
      LinkedExerciseManager: earTraining.LinkedExerciseManager,
      FractionRecognitionExercise: earTraining.FractionRecognitionExercise
    };
    console.log('🎯 Ear-training modules cargados en window.__EAR_TRAINING');
  }).catch(err => {
    // Módulo ear-training opcional - si no existe, continuar sin él
    console.log('ℹ️  Ear-training modules no disponibles (offline mode)');
  });
}

// Exportar la clase para testing
export { GamificationManager };