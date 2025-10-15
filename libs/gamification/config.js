/**
 * Configuración del Sistema de Gamificación
 * Centraliza todas las configuraciones del sistema
 */

/**
 * Configuración global del sistema
 */
export const GAMIFICATION_CONFIG = {
  // Control principal del sistema
  enabled: true,

  // Modo debug (muestra logs adicionales)
  debugMode: false,

  // Control por módulos
  modules: {
    events: true,
    scoring: true,
    achievements: true,
    storage: true
  },

  // Configuración de puntuación
  scoring: {
    enabled: true,
    pointsMultiplier: 1.0,
    bonusesEnabled: true,
    streakMultipliersEnabled: true,
    complexityMultipliersEnabled: true
  },

  // Configuración de logros
  achievements: {
    enabled: true,
    autoCheck: true,
    checkInterval: 30000, // Verificar cada 30 segundos
    notificationsEnabled: false // Para fase 2
  },

  // Configuración de eventos
  events: {
    enabled: true,
    trackingLevel: 'all', // 'all', 'important', 'minimal'
    maxEventsPerSession: 1000,
    eventDebounce: 100 // ms entre eventos del mismo tipo
  },

  // Configuración de almacenamiento
  storage: {
    enabled: true,
    autoSave: true,
    saveInterval: 10000, // Guardar cada 10 segundos
    maxStorageSize: 5 * 1024 * 1024, // 5MB máximo
    compressionEnabled: false
  },

  // Configuración por aplicación
  apps: {
    app2: {
      enabled: true,
      customEvents: true,
      features: {
        pulseTracking: true,
        tapTempoTracking: true,
        parameterTracking: true
      }
    },
    app3: {
      enabled: true,
      customEvents: true,
      features: {
        fractionTracking: true,
        complexityTracking: true
      }
    },
    app4: {
      enabled: true,
      customEvents: true,
      features: {
        fractionTracking: true,
        pulsePatternTracking: true
      }
    },
    app5: {
      enabled: true,
      customEvents: true,
      features: {
        intervalTracking: true,
        patternTracking: true
      }
    }
  }
};

/**
 * Configuración de eventos personalizados por app
 */
export const APP_EVENT_MAPPINGS = {
  app2: {
    // Mapeo de acciones a eventos (minúsculas para coincidir con EVENT_TYPES)
    play_clicked: 'pattern_played',
    tap_tempo_used: 'tap_tempo_used',
    loop_enabled: 'loop_activated',
    parameter_changed: 'parameter_changed',
    randomize_used: 'randomization_used',
    pulse_selected: 'pulse_pattern_created'
  },
  app3: {
    fraction_created: 'fraction_created',
    parameter_changed: 'parameter_changed',
    complexity_changed: 'complexity_increased'
  },
  app4: {
    fraction_created: 'fraction_created',
    pulse_pattern_created: 'pulse_pattern_created',
    parameter_changed: 'parameter_changed',
    cycle_activated: 'advanced_feature_used'
  },
  app5: {
    play_started: 'pattern_played',
    interval_created: 'pattern_played',
    pattern_modified: 'pulse_pattern_created',
    parameter_changed: 'parameter_changed'
  }
};

/**
 * Umbrales y límites del sistema
 */
export const THRESHOLDS = {
  // Umbrales de tiempo (segundos)
  sessionTimeout: 300, // 5 minutos de inactividad = nueva sesión
  practiceMinDuration: 10, // Mínimo 10 segundos para contar como práctica

  // Umbrales de precisión (porcentaje)
  accuracyExcellent: 90,
  accuracyGood: 75,
  accuracyAcceptable: 60,

  // Umbrales de complejidad (valores de Lg)
  complexityLow: 10,
  complexityMedium: 30,
  complexityHigh: 50,

  // Umbrales de racha
  streakSmall: 5,
  streakMedium: 10,
  streakLarge: 20,
  streakEpic: 50
};

/**
 * Configuración de desarrollo
 */
export const DEV_CONFIG = {
  // Herramientas de desarrollo
  enableDevTools: true,
  logEvents: true,
  showDebugPanel: false,

  // Simulación y testing
  simulateEvents: false,
  acceleratedTime: false,
  testMode: false
};

/**
 * Clase para gestionar la configuración
 */
class ConfigurationManager {
  constructor() {
    this.config = { ...GAMIFICATION_CONFIG };
    this.loadStoredConfig();
    this.applyUrlParams();
  }

  /**
   * Carga configuración almacenada localmente
   */
  loadStoredConfig() {
    try {
      const stored = localStorage.getItem('gamification_config');
      if (stored) {
        const userConfig = JSON.parse(stored);
        this.mergeConfig(userConfig);
      }
    } catch (error) {
      console.warn('Error cargando configuración almacenada:', error);
    }
  }

  /**
   * Aplica parámetros de URL (útil para debugging)
   */
  applyUrlParams() {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);

    // Debug mode
    if (params.get('gamification_debug') === 'true') {
      this.config.debugMode = true;
      window.GAMIFICATION_DEBUG = true;
    }

    // Disable gamification
    if (params.get('gamification') === 'false') {
      this.config.enabled = false;
    }

    // Test mode
    if (params.get('gamification_test') === 'true') {
      DEV_CONFIG.testMode = true;
    }
  }

  /**
   * Combina configuración del usuario con la configuración base
   */
  mergeConfig(userConfig) {
    // Fusión profunda de objetos
    const merge = (target, source) => {
      Object.keys(source).forEach(key => {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          target[key] = target[key] || {};
          merge(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      });
    };

    merge(this.config, userConfig);
  }

  /**
   * Obtiene la configuración actual
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Obtiene configuración específica de una app
   */
  getAppConfig(appId) {
    return this.config.apps[appId] || {};
  }

  /**
   * Actualiza la configuración
   */
  updateConfig(updates) {
    this.mergeConfig(updates);
    this.saveConfig();
  }

  /**
   * Guarda la configuración actual
   */
  saveConfig() {
    try {
      localStorage.setItem('gamification_config', JSON.stringify(this.config));
    } catch (error) {
      console.warn('Error guardando configuración:', error);
    }
  }

  /**
   * Verifica si una característica está habilitada
   */
  isFeatureEnabled(feature, appId = null) {
    // Verificar si el sistema está habilitado
    if (!this.config.enabled) return false;

    // Verificar característica específica de app
    if (appId && this.config.apps[appId]) {
      const appConfig = this.config.apps[appId];
      if (!appConfig.enabled) return false;
      if (appConfig.features && appConfig.features[feature] !== undefined) {
        return appConfig.features[feature];
      }
    }

    // Verificar módulos generales
    if (this.config.modules[feature] !== undefined) {
      return this.config.modules[feature];
    }

    // Por defecto, asumir habilitado si el sistema está activo
    return true;
  }

  /**
   * Obtiene el nivel de tracking de eventos
   */
  getTrackingLevel() {
    return this.config.events.trackingLevel;
  }

  /**
   * Verifica si se debe trackear un tipo de evento
   */
  shouldTrackEvent(eventType) {
    if (!this.config.enabled || !this.config.events.enabled) {
      return false;
    }

    const level = this.getTrackingLevel();

    switch (level) {
      case 'all':
        return true;
      case 'important':
        // Solo eventos importantes
        return ['PRACTICE_COMPLETED', 'PATTERN_MASTERED', 'ACHIEVEMENT_UNLOCKED'].includes(eventType);
      case 'minimal':
        // Solo eventos esenciales
        return ['PRACTICE_COMPLETED'].includes(eventType);
      default:
        return false;
    }
  }

  /**
   * Reinicia la configuración a valores por defecto
   */
  resetToDefaults() {
    this.config = { ...GAMIFICATION_CONFIG };
    localStorage.removeItem('gamification_config');
  }

  /**
   * Exporta la configuración actual
   */
  exportConfig() {
    return {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      config: this.config,
      dev: DEV_CONFIG
    };
  }

  /**
   * Importa configuración
   */
  importConfig(data) {
    if (data.version !== '1.0.0') {
      console.error('Versión de configuración incompatible');
      return false;
    }

    if (data.config) {
      this.config = data.config;
      this.saveConfig();
      return true;
    }

    return false;
  }
}

// Crear instancia singleton
let configInstance = null;

export function getConfigManager() {
  if (!configInstance) {
    configInstance = new ConfigurationManager();
  }
  return configInstance;
}

// Función helper para verificar si el sistema está habilitado
export function isGamificationEnabled() {
  const manager = getConfigManager();
  return manager.getConfig().enabled;
}

// Función helper para obtener configuración de app
export function getAppGamificationConfig(appId) {
  const manager = getConfigManager();
  return manager.getAppConfig(appId);
}

// Exportar instancia de configuración si es necesario para debugging
if (typeof window !== 'undefined' && DEV_CONFIG.enableDevTools) {
  window.__GAMIFICATION_CONFIG = getConfigManager();
}