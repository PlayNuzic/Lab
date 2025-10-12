/**
 * Sistema de Puntuación de Gamificación
 * Calcula puntuaciones y aplica multiplicadores según el contexto
 */

import { EVENT_TYPES } from './event-system.js';

/**
 * Configuración de multiplicadores de puntuación
 */
const MULTIPLIERS = {
  // Multiplicadores por racha
  STREAK: {
    5: 1.2,   // 5 aciertos seguidos
    10: 1.5,  // 10 aciertos seguidos
    20: 2.0,  // 20 aciertos seguidos
    50: 3.0   // 50 aciertos seguidos
  },

  // Multiplicadores por tiempo de práctica continua (minutos)
  PRACTICE_TIME: {
    5: 1.1,   // 5 minutos
    10: 1.3,  // 10 minutos
    20: 1.5,  // 20 minutos
    30: 2.0   // 30 minutos
  },

  // Multiplicadores por complejidad
  COMPLEXITY: {
    LOW: 1.0,     // Lg < 10, fracciones simples
    MEDIUM: 1.2,  // Lg 10-30, fracciones moderadas
    HIGH: 1.5,    // Lg 30-50, fracciones complejas
    EXPERT: 2.0   // Lg > 50, patrones muy complejos
  },

  // Multiplicadores por precisión
  ACCURACY: {
    PERFECT: 2.0,    // 100% precisión
    EXCELLENT: 1.5,  // 90-99% precisión
    GOOD: 1.2,       // 75-89% precisión
    NORMAL: 1.0      // < 75% precisión
  }
};

/**
 * Bonificaciones especiales
 */
const BONUSES = {
  FIRST_TIME: 50,        // Primera vez usando una función
  DAILY_BONUS: 100,      // Bonus diario por práctica
  PERFECT_SESSION: 200,  // Sesión sin errores
  EXPLORATION: 25,       // Explorar nuevas configuraciones
  CREATIVE: 30           // Crear patrones únicos
};

/**
 * Clase principal del sistema de puntuación
 */
class ScoringSystem {
  constructor() {
    this.sessionScore = 0;
    this.totalScore = this.loadTotalScore();
    this.currentStreak = 0;
    this.sessionStartTime = null;
    this.lastScoreTime = null;
    this.accuracyHistory = [];
    this.complexityLevel = 'LOW';
  }

  /**
   * Carga la puntuación total almacenada
   */
  loadTotalScore() {
    try {
      const stored = localStorage.getItem('gamification_total_score');
      return stored ? parseInt(stored, 10) || 0 : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Guarda la puntuación total
   */
  saveTotalScore() {
    try {
      localStorage.setItem('gamification_total_score', String(this.totalScore));
    } catch {}
  }

  /**
   * Calcula la puntuación para un evento
   * @param {string} eventType - Tipo de evento
   * @param {object} metadata - Metadatos del evento
   * @returns {number} Puntuación calculada
   */
  calculateScore(eventType, metadata = {}) {
    // Obtener puntuación base del evento
    let baseScore = this.getBaseScore(eventType);

    // Aplicar multiplicadores según contexto
    const multipliers = this.getMultipliers(metadata);
    let finalScore = baseScore;

    Object.values(multipliers).forEach(mult => {
      finalScore *= mult;
    });

    // Aplicar bonificaciones especiales
    const bonuses = this.getBonuses(eventType, metadata);
    finalScore += bonuses;

    // Redondear resultado
    finalScore = Math.round(finalScore);

    // Actualizar puntuaciones
    this.sessionScore += finalScore;
    this.totalScore += finalScore;
    this.saveTotalScore();

    // Actualizar metadatos internos
    this.updateInternalState(eventType, metadata);

    return finalScore;
  }

  /**
   * Obtiene la puntuación base según el tipo de evento
   */
  getBaseScore(eventType) {
    const scores = {
      [EVENT_TYPES.PRACTICE_STARTED]: 10,
      [EVENT_TYPES.PRACTICE_COMPLETED]: 30,
      [EVENT_TYPES.PATTERN_PLAYED]: 5,
      [EVENT_TYPES.TAP_TEMPO_USED]: 3,
      [EVENT_TYPES.TAP_TEMPO_ACCURATE]: 15,
      [EVENT_TYPES.RHYTHM_MATCHED]: 20,
      [EVENT_TYPES.PERFECT_TIMING]: 30,
      [EVENT_TYPES.PARAMETER_CHANGED]: 2,
      [EVENT_TYPES.RANDOMIZATION_USED]: 5,
      [EVENT_TYPES.FRACTION_CREATED]: 8,
      [EVENT_TYPES.PULSE_PATTERN_CREATED]: 10,
      [EVENT_TYPES.LOOP_ACTIVATED]: 5,
      [EVENT_TYPES.PRACTICE_TIME_MILESTONE]: 50,
      [EVENT_TYPES.SESSION_STREAK]: 25,
      [EVENT_TYPES.DAILY_PRACTICE]: 100,
      [EVENT_TYPES.COMPLEXITY_INCREASED]: 15,
      [EVENT_TYPES.ADVANCED_FEATURE_USED]: 20,
      [EVENT_TYPES.PATTERN_MASTERED]: 50
    };

    return scores[eventType] || 1;
  }

  /**
   * Calcula los multiplicadores aplicables
   */
  getMultipliers(metadata = {}) {
    const multipliers = {};

    // Multiplicador por racha
    if (this.currentStreak > 0) {
      const streakLevels = Object.keys(MULTIPLIERS.STREAK)
        .map(Number)
        .sort((a, b) => b - a);

      for (const level of streakLevels) {
        if (this.currentStreak >= level) {
          multipliers.streak = MULTIPLIERS.STREAK[level];
          break;
        }
      }
    }

    // Multiplicador por tiempo de práctica
    if (this.sessionStartTime) {
      const sessionMinutes = (Date.now() - this.sessionStartTime) / 60000;
      const timeLevels = Object.keys(MULTIPLIERS.PRACTICE_TIME)
        .map(Number)
        .sort((a, b) => b - a);

      for (const level of timeLevels) {
        if (sessionMinutes >= level) {
          multipliers.practiceTime = MULTIPLIERS.PRACTICE_TIME[level];
          break;
        }
      }
    }

    // Multiplicador por complejidad
    if (metadata.lg_value) {
      const lg = metadata.lg_value;
      if (lg > 50) {
        multipliers.complexity = MULTIPLIERS.COMPLEXITY.EXPERT;
        this.complexityLevel = 'EXPERT';
      } else if (lg > 30) {
        multipliers.complexity = MULTIPLIERS.COMPLEXITY.HIGH;
        this.complexityLevel = 'HIGH';
      } else if (lg > 10) {
        multipliers.complexity = MULTIPLIERS.COMPLEXITY.MEDIUM;
        this.complexityLevel = 'MEDIUM';
      } else {
        multipliers.complexity = MULTIPLIERS.COMPLEXITY.LOW;
        this.complexityLevel = 'LOW';
      }
    }

    // Multiplicador por precisión (si aplica)
    if (metadata.accuracy_percentage !== undefined) {
      const accuracy = metadata.accuracy_percentage;
      if (accuracy === 100) {
        multipliers.accuracy = MULTIPLIERS.ACCURACY.PERFECT;
      } else if (accuracy >= 90) {
        multipliers.accuracy = MULTIPLIERS.ACCURACY.EXCELLENT;
      } else if (accuracy >= 75) {
        multipliers.accuracy = MULTIPLIERS.ACCURACY.GOOD;
      } else {
        multipliers.accuracy = MULTIPLIERS.ACCURACY.NORMAL;
      }
    }

    return multipliers;
  }

  /**
   * Calcula bonificaciones especiales
   */
  getBonuses(eventType, metadata = {}) {
    let bonus = 0;

    // Bonus por primera vez
    if (metadata.first_time) {
      bonus += BONUSES.FIRST_TIME;
    }

    // Bonus diario
    if (eventType === EVENT_TYPES.DAILY_PRACTICE) {
      bonus += BONUSES.DAILY_BONUS;
    }

    // Bonus por sesión perfecta
    if (metadata.perfect_session) {
      bonus += BONUSES.PERFECT_SESSION;
    }

    // Bonus por exploración
    if (eventType === EVENT_TYPES.PARAMETER_CHANGED && metadata.unique_parameter) {
      bonus += BONUSES.EXPLORATION;
    }

    // Bonus por creatividad
    if (eventType === EVENT_TYPES.PULSE_PATTERN_CREATED && metadata.pattern_uniqueness > 0.8) {
      bonus += BONUSES.CREATIVE;
    }

    return bonus;
  }

  /**
   * Actualiza el estado interno según los eventos
   */
  updateInternalState(eventType, metadata) {
    const now = Date.now();

    // Iniciar sesión si es necesario
    if (!this.sessionStartTime) {
      this.sessionStartTime = now;
    }

    // Actualizar racha
    if (eventType === EVENT_TYPES.RHYTHM_MATCHED ||
        eventType === EVENT_TYPES.TAP_TEMPO_ACCURATE ||
        eventType === EVENT_TYPES.PERFECT_TIMING) {
      this.currentStreak++;
    } else if (metadata.error || metadata.failed) {
      this.currentStreak = 0;
    }

    // Actualizar historial de precisión
    if (metadata.accuracy_percentage !== undefined) {
      this.accuracyHistory.push(metadata.accuracy_percentage);
      if (this.accuracyHistory.length > 20) {
        this.accuracyHistory.shift();
      }
    }

    this.lastScoreTime = now;
  }

  /**
   * Obtiene estadísticas de la sesión
   */
  getSessionStats() {
    const sessionDuration = this.sessionStartTime ?
      Math.floor((Date.now() - this.sessionStartTime) / 1000) : 0;

    const averageAccuracy = this.accuracyHistory.length > 0 ?
      this.accuracyHistory.reduce((a, b) => a + b, 0) / this.accuracyHistory.length : 0;

    return {
      session_score: this.sessionScore,
      total_score: this.totalScore,
      current_streak: this.currentStreak,
      session_duration_seconds: sessionDuration,
      average_accuracy: Math.round(averageAccuracy),
      complexity_level: this.complexityLevel,
      points_per_minute: sessionDuration > 0 ?
        Math.round(this.sessionScore / (sessionDuration / 60)) : 0
    };
  }

  /**
   * Reinicia la sesión pero mantiene la puntuación total
   */
  resetSession() {
    this.sessionScore = 0;
    this.currentStreak = 0;
    this.sessionStartTime = null;
    this.lastScoreTime = null;
    this.accuracyHistory = [];
    this.complexityLevel = 'LOW';
  }

  /**
   * Calcula el nivel del usuario basado en la puntuación total
   */
  getUserLevel() {
    const score = this.totalScore;
    const levels = [
      { level: 1, minScore: 0, title: 'Principiante' },
      { level: 2, minScore: 100, title: 'Aprendiz' },
      { level: 3, minScore: 300, title: 'Estudiante' },
      { level: 4, minScore: 600, title: 'Practicante' },
      { level: 5, minScore: 1000, title: 'Competente' },
      { level: 6, minScore: 1500, title: 'Avanzado' },
      { level: 7, minScore: 2500, title: 'Experto' },
      { level: 8, minScore: 4000, title: 'Maestro' },
      { level: 9, minScore: 6000, title: 'Virtuoso' },
      { level: 10, minScore: 10000, title: 'Gran Maestro' }
    ];

    let userLevel = levels[0];
    for (const lvl of levels) {
      if (score >= lvl.minScore) {
        userLevel = lvl;
      } else {
        break;
      }
    }

    // Calcular progreso hacia el siguiente nivel
    const nextLevel = levels[userLevel.level] || null;
    const progress = nextLevel ?
      ((score - userLevel.minScore) / (nextLevel.minScore - userLevel.minScore)) * 100 : 100;

    return {
      ...userLevel,
      current_score: score,
      next_level_score: nextLevel?.minScore || score,
      progress_percentage: Math.min(100, Math.round(progress))
    };
  }

  /**
   * Exporta los datos de puntuación
   */
  exportData() {
    return {
      version: '1.0.0',
      export_date: new Date().toISOString(),
      total_score: this.totalScore,
      session_score: this.sessionScore,
      current_streak: this.currentStreak,
      user_level: this.getUserLevel(),
      session_stats: this.getSessionStats()
    };
  }

  /**
   * Importa datos de puntuación
   */
  importData(data) {
    if (data.version !== '1.0.0') {
      console.error('Versión de datos incompatible');
      return false;
    }

    if (data.total_score !== undefined) {
      this.totalScore = data.total_score;
      this.saveTotalScore();
    }

    if (data.session_score !== undefined) {
      this.sessionScore = data.session_score;
    }

    if (data.current_streak !== undefined) {
      this.currentStreak = data.current_streak;
    }

    return true;
  }
}

// Crear instancia singleton
let instance = null;

export function getScoringSystem() {
  if (!instance) {
    instance = new ScoringSystem();
  }
  return instance;
}

// Exportar la clase para testing
export { ScoringSystem, MULTIPLIERS, BONUSES };