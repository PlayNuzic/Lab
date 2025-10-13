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

// Importar DEV_CONFIG para uso interno en este módulo
import { DEV_CONFIG as DEV_CONFIG_INTERNAL } from './config.js';

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

// Exportar el manager para debugging si está habilitado
if (typeof window !== 'undefined' && DEV_CONFIG_INTERNAL.enableDevTools) {
  window.__GAMIFICATION = getGamificationManager();
}

// Exportar la clase para testing
export { GamificationManager };