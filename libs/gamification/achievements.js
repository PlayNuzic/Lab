/**
 * Sistema de Logros de Gamificación
 * Gestiona y verifica el progreso de logros sin UI
 */

import { EVENT_TYPES } from './event-system.js';

/**
 * Definición de todos los logros disponibles
 */
const ACHIEVEMENTS = {
  // Logros de iniciación
  FIRST_STEPS: {
    id: 'first_steps',
    name: 'Primeros Pasos',
    description: 'Completa tu primera práctica',
    category: 'initiation',
    points: 10,
    icon: '👶',
    condition: (stats) => stats.total_practices >= 1
  },

  EXPLORER: {
    id: 'explorer',
    name: 'Explorador',
    description: 'Cambia al menos 10 parámetros diferentes',
    category: 'exploration',
    points: 20,
    icon: '🔍',
    condition: (stats) => stats.parameters_changed >= 10
  },

  // Logros de práctica rítmica
  RHYTHM_NOVICE: {
    id: 'rhythm_novice',
    name: 'Novato Rítmico',
    description: 'Reproduce 10 patrones correctamente',
    category: 'rhythm',
    points: 15,
    icon: '🥁',
    condition: (stats) => stats.patterns_played >= 10
  },

  RHYTHM_APPRENTICE: {
    id: 'rhythm_apprentice',
    name: 'Aprendiz Rítmico',
    description: 'Reproduce 50 patrones correctamente',
    category: 'rhythm',
    points: 30,
    icon: '🎵',
    condition: (stats) => stats.patterns_played >= 50
  },

  RHYTHM_MASTER: {
    id: 'rhythm_master',
    name: 'Maestro del Ritmo',
    description: 'Reproduce 200 patrones correctamente',
    category: 'rhythm',
    points: 100,
    icon: '🎼',
    condition: (stats) => stats.patterns_played >= 200
  },

  // Logros de precisión
  PERFECT_TIMING: {
    id: 'perfect_timing',
    name: 'Timing Perfecto',
    description: 'Alcanza 100% de precisión en 5 patrones seguidos',
    category: 'precision',
    points: 50,
    icon: '⏱️',
    condition: (stats) => stats.perfect_streak >= 5
  },

  TAP_MASTER: {
    id: 'tap_master',
    name: 'Maestro del Tap',
    description: 'Usa tap tempo con 95% de precisión 10 veces',
    category: 'precision',
    points: 40,
    icon: '👆',
    condition: (stats) => stats.accurate_taps >= 10
  },

  // Logros de tiempo
  DEDICATED_5: {
    id: 'dedicated_5',
    name: 'Dedicado',
    description: 'Practica durante 5 minutos continuos',
    category: 'time',
    points: 10,
    icon: '⏰',
    condition: (stats) => stats.longest_session >= 300
  },

  DEDICATED_15: {
    id: 'dedicated_15',
    name: 'Perseverante',
    description: 'Practica durante 15 minutos continuos',
    category: 'time',
    points: 25,
    icon: '⏳',
    condition: (stats) => stats.longest_session >= 900
  },

  MARATHON: {
    id: 'marathon',
    name: 'Maratonista',
    description: 'Practica durante 30 minutos continuos',
    category: 'time',
    points: 50,
    icon: '🏃',
    condition: (stats) => stats.longest_session >= 1800
  },

  // Logros de creatividad
  PATTERN_CREATOR: {
    id: 'pattern_creator',
    name: 'Creador de Patrones',
    description: 'Crea 20 patrones de pulsos diferentes',
    category: 'creativity',
    points: 30,
    icon: '🎨',
    condition: (stats) => stats.patterns_created >= 20
  },

  FRACTION_EXPLORER: {
    id: 'fraction_explorer',
    name: 'Explorador de Fracciones',
    description: 'Crea 30 fracciones rítmicas diferentes',
    category: 'creativity',
    points: 35,
    icon: '➗',
    condition: (stats) => stats.fractions_created >= 30
  },

  RANDOMIZER: {
    id: 'randomizer',
    name: 'Aleatorizador',
    description: 'Usa la función de aleatorización 50 veces',
    category: 'creativity',
    points: 20,
    icon: '🎲',
    condition: (stats) => stats.randomizations >= 50
  },

  // Logros de complejidad
  COMPLEXITY_LOW: {
    id: 'complexity_low',
    name: 'Iniciando',
    description: 'Domina patrones con Lg menor a 10',
    category: 'complexity',
    points: 10,
    icon: '1️⃣',
    condition: (stats) => stats.patterns_low_complexity >= 20
  },

  COMPLEXITY_MEDIUM: {
    id: 'complexity_medium',
    name: 'Progresando',
    description: 'Domina patrones con Lg entre 10 y 30',
    category: 'complexity',
    points: 25,
    icon: '2️⃣',
    condition: (stats) => stats.patterns_medium_complexity >= 20
  },

  COMPLEXITY_HIGH: {
    id: 'complexity_high',
    name: 'Avanzado',
    description: 'Domina patrones con Lg entre 30 y 50',
    category: 'complexity',
    points: 40,
    icon: '3️⃣',
    condition: (stats) => stats.patterns_high_complexity >= 20
  },

  COMPLEXITY_EXPERT: {
    id: 'complexity_expert',
    name: 'Experto',
    description: 'Domina patrones con Lg mayor a 50',
    category: 'complexity',
    points: 75,
    icon: '🏆',
    condition: (stats) => stats.patterns_expert_complexity >= 10
  },

  // Logros de constancia
  DAILY_PRACTICE: {
    id: 'daily_practice',
    name: 'Práctica Diaria',
    description: 'Practica 7 días consecutivos',
    category: 'consistency',
    points: 100,
    icon: '📅',
    condition: (stats) => stats.consecutive_days >= 7
  },

  WEEKLY_WARRIOR: {
    id: 'weekly_warrior',
    name: 'Guerrero Semanal',
    description: 'Practica todos los días durante 2 semanas',
    category: 'consistency',
    points: 200,
    icon: '🗓️',
    condition: (stats) => stats.consecutive_days >= 14
  },

  MONTHLY_MASTER: {
    id: 'monthly_master',
    name: 'Maestro Mensual',
    description: 'Practica todos los días durante un mes',
    category: 'consistency',
    points: 500,
    icon: '📆',
    condition: (stats) => stats.consecutive_days >= 30
  }
};

/**
 * Clase principal del sistema de logros
 */
class AchievementSystem {
  constructor() {
    this.unlockedAchievements = this.loadUnlockedAchievements();
    this.stats = this.loadStats();
    this.lastCheckTime = Date.now();
  }

  /**
   * Carga los logros desbloqueados del almacenamiento local
   */
  loadUnlockedAchievements() {
    try {
      const stored = localStorage.getItem('gamification_achievements');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  /**
   * Guarda los logros desbloqueados
   */
  saveUnlockedAchievements() {
    try {
      localStorage.setItem('gamification_achievements', JSON.stringify(this.unlockedAchievements));
    } catch {}
  }

  /**
   * Carga las estadísticas del usuario
   */
  loadStats() {
    try {
      const stored = localStorage.getItem('gamification_stats');
      return stored ? JSON.parse(stored) : this.getDefaultStats();
    } catch {
      return this.getDefaultStats();
    }
  }

  /**
   * Obtiene las estadísticas por defecto
   */
  getDefaultStats() {
    return {
      total_practices: 0,
      patterns_played: 0,
      parameters_changed: 0,
      perfect_streak: 0,
      current_streak: 0,
      accurate_taps: 0,
      longest_session: 0,
      current_session_time: 0,
      patterns_created: 0,
      fractions_created: 0,
      randomizations: 0,
      patterns_low_complexity: 0,
      patterns_medium_complexity: 0,
      patterns_high_complexity: 0,
      patterns_expert_complexity: 0,
      consecutive_days: 0,
      last_practice_date: null
    };
  }

  /**
   * Guarda las estadísticas
   */
  saveStats() {
    try {
      localStorage.setItem('gamification_stats', JSON.stringify(this.stats));
    } catch {}
  }

  /**
   * Actualiza las estadísticas basándose en el historial de eventos
   */
  updateStats(eventHistory) {
    eventHistory.forEach(event => {
      switch (event.evento_tipo) {
        case EVENT_TYPES.PRACTICE_STARTED:
          this.stats.total_practices++;
          this.updateDailyStreak();
          break;

        case EVENT_TYPES.PATTERN_PLAYED:
          this.stats.patterns_played++;
          this.updateComplexityStats(event.metadata);
          break;

        case EVENT_TYPES.PARAMETER_CHANGED:
          this.stats.parameters_changed++;
          break;

        case EVENT_TYPES.TAP_TEMPO_ACCURATE:
          this.stats.accurate_taps++;
          break;

        case EVENT_TYPES.PERFECT_TIMING:
          this.stats.current_streak++;
          if (this.stats.current_streak > this.stats.perfect_streak) {
            this.stats.perfect_streak = this.stats.current_streak;
          }
          break;

        case EVENT_TYPES.PULSE_PATTERN_CREATED:
          this.stats.patterns_created++;
          break;

        case EVENT_TYPES.FRACTION_CREATED:
          this.stats.fractions_created++;
          break;

        case EVENT_TYPES.RANDOMIZATION_USED:
          this.stats.randomizations++;
          break;

        case EVENT_TYPES.PRACTICE_TIME_MILESTONE:
          const sessionTime = event.metadata?.session_duration || 0;
          if (sessionTime > this.stats.longest_session) {
            this.stats.longest_session = sessionTime;
          }
          break;
      }
    });

    this.saveStats();
  }

  /**
   * Actualiza las estadísticas de complejidad
   */
  updateComplexityStats(metadata) {
    const lg = metadata?.lg_value || 0;

    if (lg < 10) {
      this.stats.patterns_low_complexity++;
    } else if (lg < 30) {
      this.stats.patterns_medium_complexity++;
    } else if (lg < 50) {
      this.stats.patterns_high_complexity++;
    } else {
      this.stats.patterns_expert_complexity++;
    }
  }

  /**
   * Actualiza la racha diaria
   */
  updateDailyStreak() {
    const today = new Date().toDateString();
    const lastPractice = this.stats.last_practice_date;

    if (!lastPractice) {
      this.stats.consecutive_days = 1;
      this.stats.last_practice_date = today;
      return;
    }

    const lastDate = new Date(lastPractice);
    const todayDate = new Date(today);
    const daysDiff = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));

    if (daysDiff === 0) {
      // Ya practicó hoy
      return;
    } else if (daysDiff === 1) {
      // Día consecutivo
      this.stats.consecutive_days++;
      this.stats.last_practice_date = today;
    } else {
      // Racha rota
      this.stats.consecutive_days = 1;
      this.stats.last_practice_date = today;
    }
  }

  /**
   * Verifica los logros basándose en el historial de eventos
   */
  checkAchievements(eventHistory) {
    // Actualizar estadísticas primero
    this.updateStats(eventHistory);

    const newlyUnlocked = [];

    // Verificar cada logro
    Object.values(ACHIEVEMENTS).forEach(achievement => {
      // Si ya está desbloqueado, saltar
      if (this.unlockedAchievements[achievement.id]) {
        return;
      }

      // Verificar si cumple la condición
      if (achievement.condition(this.stats)) {
        this.unlockAchievement(achievement.id);
        newlyUnlocked.push(achievement);
      }
    });

    return newlyUnlocked;
  }

  /**
   * Desbloquea un logro específico
   */
  unlockAchievement(achievementId) {
    if (this.unlockedAchievements[achievementId]) {
      return false; // Ya desbloqueado
    }

    this.unlockedAchievements[achievementId] = {
      unlocked_at: Date.now(),
      notified: false
    };

    this.saveUnlockedAchievements();

    // Log para debugging
    if (window.GAMIFICATION_DEBUG) {
      console.log(`Logro desbloqueado: ${achievementId}`);
    }

    return true;
  }

  /**
   * Obtiene el progreso hacia un logro específico
   */
  getProgress(achievementId) {
    const achievement = ACHIEVEMENTS[achievementId];
    if (!achievement) return null;

    // Si ya está desbloqueado
    if (this.unlockedAchievements[achievementId]) {
      return {
        achievement_id: achievementId,
        name: achievement.name,
        description: achievement.description,
        unlocked: true,
        progress: 100,
        unlocked_at: this.unlockedAchievements[achievementId].unlocked_at
      };
    }

    // Calcular progreso actual
    let progress = 0;
    let current = 0;
    let target = 0;

    // Calcular progreso según el tipo de logro
    switch (achievementId) {
      case 'rhythm_novice':
        current = this.stats.patterns_played;
        target = 10;
        break;
      case 'rhythm_apprentice':
        current = this.stats.patterns_played;
        target = 50;
        break;
      case 'rhythm_master':
        current = this.stats.patterns_played;
        target = 200;
        break;
      case 'perfect_timing':
        current = this.stats.perfect_streak;
        target = 5;
        break;
      case 'tap_master':
        current = this.stats.accurate_taps;
        target = 10;
        break;
      case 'dedicated_5':
        current = this.stats.longest_session;
        target = 300;
        break;
      case 'dedicated_15':
        current = this.stats.longest_session;
        target = 900;
        break;
      case 'marathon':
        current = this.stats.longest_session;
        target = 1800;
        break;
      case 'pattern_creator':
        current = this.stats.patterns_created;
        target = 20;
        break;
      case 'fraction_explorer':
        current = this.stats.fractions_created;
        target = 30;
        break;
      case 'randomizer':
        current = this.stats.randomizations;
        target = 50;
        break;
      case 'daily_practice':
        current = this.stats.consecutive_days;
        target = 7;
        break;
      case 'weekly_warrior':
        current = this.stats.consecutive_days;
        target = 14;
        break;
      case 'monthly_master':
        current = this.stats.consecutive_days;
        target = 30;
        break;
      default:
        // Para logros más complejos, usar estimación
        progress = achievement.condition(this.stats) ? 100 : 0;
    }

    // Calcular porcentaje si tenemos valores
    if (target > 0) {
      progress = Math.min(100, Math.round((current / target) * 100));
    }

    return {
      achievement_id: achievementId,
      name: achievement.name,
      description: achievement.description,
      category: achievement.category,
      points: achievement.points,
      icon: achievement.icon,
      unlocked: false,
      progress,
      current_value: current,
      target_value: target
    };
  }

  /**
   * Obtiene todos los logros con su estado actual
   */
  getAllAchievements() {
    return Object.keys(ACHIEVEMENTS).map(id => this.getProgress(id));
  }

  /**
   * Obtiene un resumen del progreso de logros
   */
  getSummary() {
    const allAchievements = this.getAllAchievements();
    const unlocked = allAchievements.filter(a => a.unlocked);
    const totalPoints = unlocked.reduce((sum, a) => sum + (a.points || 0), 0);

    // Agrupar por categoría
    const byCategory = {};
    allAchievements.forEach(a => {
      if (!byCategory[a.category]) {
        byCategory[a.category] = { total: 0, unlocked: 0 };
      }
      byCategory[a.category].total++;
      if (a.unlocked) {
        byCategory[a.category].unlocked++;
      }
    });

    return {
      total_achievements: allAchievements.length,
      unlocked_achievements: unlocked.length,
      locked_achievements: allAchievements.length - unlocked.length,
      total_points: totalPoints,
      completion_percentage: Math.round((unlocked.length / allAchievements.length) * 100),
      categories: byCategory,
      recent_unlocks: unlocked
        .sort((a, b) => (b.unlocked_at || 0) - (a.unlocked_at || 0))
        .slice(0, 5)
    };
  }

  /**
   * Reinicia todos los logros (útil para testing)
   */
  resetAll() {
    this.unlockedAchievements = {};
    this.stats = this.getDefaultStats();
    this.saveUnlockedAchievements();
    this.saveStats();
  }

  /**
   * Exporta los datos de logros
   */
  exportData() {
    return {
      version: '1.0.0',
      export_date: new Date().toISOString(),
      unlocked_achievements: this.unlockedAchievements,
      stats: this.stats,
      summary: this.getSummary()
    };
  }

  /**
   * Importa datos de logros
   */
  importData(data) {
    if (data.version !== '1.0.0') {
      console.error('Versión de datos incompatible');
      return false;
    }

    if (data.unlocked_achievements) {
      this.unlockedAchievements = data.unlocked_achievements;
      this.saveUnlockedAchievements();
    }

    if (data.stats) {
      this.stats = { ...this.getDefaultStats(), ...data.stats };
      this.saveStats();
    }

    return true;
  }
}

// Crear instancia singleton
let instance = null;

export function getAchievementSystem() {
  if (!instance) {
    instance = new AchievementSystem();
  }
  return instance;
}

// Exportar la clase y definiciones para testing
export { AchievementSystem, ACHIEVEMENTS };