/**
 * Sistema de Eventos de Gamificación
 * Registra y gestiona todos los eventos gamificables de las aplicaciones
 */

// Tipos de eventos disponibles
export const EVENT_TYPES = {
  // Eventos de práctica
  PRACTICE_STARTED: 'practice_started',
  PRACTICE_COMPLETED: 'practice_completed',
  PRACTICE_PAUSED: 'practice_paused',
  PATTERN_PLAYED: 'pattern_played',

  // Eventos de precisión rítmica
  TAP_TEMPO_USED: 'tap_tempo_used',
  TAP_TEMPO_ACCURATE: 'tap_tempo_accurate',
  RHYTHM_MATCHED: 'rhythm_matched',
  PERFECT_TIMING: 'perfect_timing',

  // Eventos de exploración y creatividad
  PARAMETER_CHANGED: 'parameter_changed',
  RANDOMIZATION_USED: 'randomization_used',
  FRACTION_CREATED: 'fraction_created',
  PULSE_PATTERN_CREATED: 'pulse_pattern_created',
  LOOP_ACTIVATED: 'loop_activated',

  // Eventos de tiempo y sesión
  PRACTICE_TIME_MILESTONE: 'practice_time_milestone',
  SESSION_STREAK: 'session_streak',
  DAILY_PRACTICE: 'daily_practice',

  // Eventos de maestría
  COMPLEXITY_INCREASED: 'complexity_increased',
  ADVANCED_FEATURE_USED: 'advanced_feature_used',
  PATTERN_MASTERED: 'pattern_mastered'
};

/**
 * Clase principal del sistema de eventos
 */
class GameEventSystem {
  constructor() {
    this.events = [];
    this.listeners = new Map();
    this.sessionStartTime = null;
    this.lastEventTime = null;
    this.eventCount = 0;
  }

  /**
   * Genera un ID único para cada evento
   */
  generateEventId() {
    // Simple UUID v4 generator
    return 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Registra un nuevo evento en el sistema
   * @param {string} eventType - Tipo de evento (de EVENT_TYPES)
   * @param {object} eventData - Datos específicos del evento
   * @returns {object} El evento registrado
   */
  trackEvent(eventType, eventData = {}) {
    if (!Object.values(EVENT_TYPES).includes(eventType)) {
      console.warn(`Tipo de evento no reconocido: ${eventType}`);
      return null;
    }

    const now = Date.now();

    // Iniciar sesión si es el primer evento
    if (!this.sessionStartTime) {
      this.sessionStartTime = now;
    }

    // Crear estructura del evento
    const event = {
      evento_id: this.generateEventId(),
      evento_tipo: eventType,
      timestamp: now,
      session_id: this.sessionStartTime,
      app_id: eventData.app_id || 'unknown',
      puntuacion_base: this.calculateBasePoints(eventType),
      metadata: {
        ...eventData,
        session_duration: Math.floor((now - this.sessionStartTime) / 1000),
        time_since_last_event: this.lastEventTime ? Math.floor((now - this.lastEventTime) / 1000) : 0
      }
    };

    // Añadir evento al historial
    this.events.push(event);
    this.eventCount++;
    this.lastEventTime = now;

    // Notificar a los listeners
    this.notifyListeners(event);

    // Log en modo debug
    if (window.GAMIFICATION_DEBUG) {
      console.log('Evento registrado:', event);
    }

    return event;
  }

  /**
   * Calcula los puntos base según el tipo de evento
   */
  calculateBasePoints(eventType) {
    const pointsMap = {
      [EVENT_TYPES.PRACTICE_STARTED]: 5,
      [EVENT_TYPES.PRACTICE_COMPLETED]: 20,
      [EVENT_TYPES.PATTERN_PLAYED]: 3,
      [EVENT_TYPES.TAP_TEMPO_USED]: 2,
      [EVENT_TYPES.TAP_TEMPO_ACCURATE]: 10,
      [EVENT_TYPES.RHYTHM_MATCHED]: 15,
      [EVENT_TYPES.PERFECT_TIMING]: 25,
      [EVENT_TYPES.PARAMETER_CHANGED]: 1,
      [EVENT_TYPES.RANDOMIZATION_USED]: 3,
      [EVENT_TYPES.FRACTION_CREATED]: 5,
      [EVENT_TYPES.PULSE_PATTERN_CREATED]: 8,
      [EVENT_TYPES.LOOP_ACTIVATED]: 3,
      [EVENT_TYPES.PRACTICE_TIME_MILESTONE]: 30,
      [EVENT_TYPES.SESSION_STREAK]: 15,
      [EVENT_TYPES.DAILY_PRACTICE]: 50,
      [EVENT_TYPES.COMPLEXITY_INCREASED]: 10,
      [EVENT_TYPES.ADVANCED_FEATURE_USED]: 12,
      [EVENT_TYPES.PATTERN_MASTERED]: 40
    };

    return pointsMap[eventType] || 1;
  }

  /**
   * Obtiene el historial de eventos con filtros opcionales
   * @param {object} filters - Filtros para aplicar
   * @returns {array} Lista de eventos filtrados
   */
  getEventHistory(filters = {}) {
    let filteredEvents = [...this.events];

    // Filtrar por tipo de evento
    if (filters.eventType) {
      filteredEvents = filteredEvents.filter(e => e.evento_tipo === filters.eventType);
    }

    // Filtrar por app
    if (filters.appId) {
      filteredEvents = filteredEvents.filter(e => e.app_id === filters.appId);
    }

    // Filtrar por rango de tiempo
    if (filters.startTime) {
      filteredEvents = filteredEvents.filter(e => e.timestamp >= filters.startTime);
    }
    if (filters.endTime) {
      filteredEvents = filteredEvents.filter(e => e.timestamp <= filters.endTime);
    }

    // Filtrar por sesión
    if (filters.sessionId) {
      filteredEvents = filteredEvents.filter(e => e.session_id === filters.sessionId);
    }

    return filteredEvents;
  }

  /**
   * Obtiene estadísticas de la sesión actual
   */
  getSessionStats() {
    if (!this.sessionStartTime) {
      return null;
    }

    const now = Date.now();
    const sessionDuration = Math.floor((now - this.sessionStartTime) / 1000);
    const totalPoints = this.events.reduce((sum, e) => sum + e.puntuacion_base, 0);

    // Contar eventos por tipo
    const eventCounts = {};
    this.events.forEach(e => {
      eventCounts[e.evento_tipo] = (eventCounts[e.evento_tipo] || 0) + 1;
    });

    return {
      session_id: this.sessionStartTime,
      duration_seconds: sessionDuration,
      total_events: this.eventCount,
      total_points: totalPoints,
      average_points_per_minute: sessionDuration > 0 ? Math.round(totalPoints / (sessionDuration / 60)) : 0,
      events_by_type: eventCounts,
      most_frequent_event: Object.entries(eventCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null
    };
  }

  /**
   * Limpia el historial de eventos
   */
  clearEvents() {
    this.events = [];
    this.sessionStartTime = null;
    this.lastEventTime = null;
    this.eventCount = 0;
  }

  /**
   * Exporta los eventos para sincronización o backup
   */
  exportEvents() {
    return {
      version: '1.0.0',
      export_date: new Date().toISOString(),
      session_id: this.sessionStartTime,
      event_count: this.eventCount,
      events: this.events
    };
  }

  /**
   * Importa eventos desde un backup
   */
  importEvents(data) {
    if (data.version !== '1.0.0') {
      console.error('Versión de datos incompatible');
      return false;
    }

    this.events = data.events || [];
    this.eventCount = data.event_count || this.events.length;
    this.sessionStartTime = data.session_id || null;

    // Encontrar el último evento
    if (this.events.length > 0) {
      const lastEvent = this.events.reduce((latest, event) =>
        event.timestamp > latest.timestamp ? event : latest
      );
      this.lastEventTime = lastEvent.timestamp;
    }

    return true;
  }

  /**
   * Registra un listener para eventos
   */
  addEventListener(callback) {
    const id = Date.now() + '_' + Math.random();
    this.listeners.set(id, callback);
    return id;
  }

  /**
   * Elimina un listener
   */
  removeEventListener(id) {
    return this.listeners.delete(id);
  }

  /**
   * Notifica a todos los listeners sobre un nuevo evento
   */
  notifyListeners(event) {
    this.listeners.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error en listener de eventos:', error);
      }
    });
  }

  /**
   * Método auxiliar para detectar patrones de práctica
   */
  detectPracticePatterns() {
    const recentEvents = this.getEventHistory({
      startTime: Date.now() - (5 * 60 * 1000) // Últimos 5 minutos
    });

    const patterns = {
      is_practicing_actively: recentEvents.length > 10,
      is_exploring: recentEvents.filter(e => e.evento_tipo === EVENT_TYPES.PARAMETER_CHANGED).length > 5,
      is_focused: recentEvents.filter(e => e.evento_tipo === EVENT_TYPES.PATTERN_PLAYED).length > 8,
      accuracy_trend: this.calculateAccuracyTrend(recentEvents)
    };

    return patterns;
  }

  /**
   * Calcula la tendencia de precisión
   */
  calculateAccuracyTrend(events) {
    const accuracyEvents = events.filter(e =>
      [EVENT_TYPES.TAP_TEMPO_ACCURATE, EVENT_TYPES.RHYTHM_MATCHED, EVENT_TYPES.PERFECT_TIMING].includes(e.evento_tipo)
    );

    if (accuracyEvents.length === 0) return 'neutral';

    const recentAccuracy = accuracyEvents.slice(-5);
    const accuracyScore = recentAccuracy.reduce((sum, e) => sum + e.puntuacion_base, 0) / recentAccuracy.length;

    if (accuracyScore > 15) return 'improving';
    if (accuracyScore > 8) return 'stable';
    return 'needs_practice';
  }
}

// Crear instancia singleton
let instance = null;

export function getEventSystem() {
  if (!instance) {
    instance = new GameEventSystem();
  }
  return instance;
}

// Exportar la clase para testing
export { GameEventSystem };