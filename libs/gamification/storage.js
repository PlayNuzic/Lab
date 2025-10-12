/**
 * Sistema de Almacenamiento de Datos de Gamificación
 * Gestiona el almacenamiento local y prepara la sincronización futura con base de datos
 */

/**
 * Configuración de almacenamiento
 */
const STORAGE_CONFIG = {
  PREFIX: 'gamification_',
  VERSION: '1.0.0',
  MAX_EVENTS: 1000,  // Máximo de eventos a almacenar localmente
  SYNC_BATCH_SIZE: 100, // Tamaño de lote para sincronización futura
  RETENTION_DAYS: 30  // Días de retención de eventos
};

/**
 * Claves de almacenamiento
 */
const STORAGE_KEYS = {
  EVENTS: 'events',
  USER_PROFILE: 'user_profile',
  PREFERENCES: 'preferences',
  SYNC_QUEUE: 'sync_queue',
  LAST_SYNC: 'last_sync',
  SESSION_DATA: 'session_data'
};

/**
 * Clase principal del sistema de almacenamiento
 */
class GameDataStore {
  constructor() {
    this.storage = this.detectStorageType();
    this.syncQueue = [];
    this.initializeStorage();
  }

  /**
   * Detecta el tipo de almacenamiento disponible
   */
  detectStorageType() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage !== null) {
        // Test write/read
        const testKey = '_test_storage';
        localStorage.setItem(testKey, '1');
        localStorage.removeItem(testKey);
        return localStorage;
      }
    } catch {
      console.warn('localStorage no disponible, usando memoria');
    }

    // Fallback a memoria si localStorage no está disponible
    return this.createMemoryStorage();
  }

  /**
   * Crea un almacenamiento en memoria como fallback
   */
  createMemoryStorage() {
    const memoryStorage = {};
    return {
      getItem: (key) => memoryStorage[key] || null,
      setItem: (key, value) => { memoryStorage[key] = value; },
      removeItem: (key) => { delete memoryStorage[key]; },
      clear: () => { Object.keys(memoryStorage).forEach(key => delete memoryStorage[key]); }
    };
  }

  /**
   * Inicializa el almacenamiento
   */
  initializeStorage() {
    // Verificar y migrar datos si es necesario
    this.migrateDataIfNeeded();

    // Limpiar eventos antiguos
    this.cleanOldEvents();

    // Cargar cola de sincronización pendiente
    this.loadSyncQueue();
  }

  /**
   * Genera una clave de almacenamiento con prefijo
   */
  getStorageKey(key) {
    return `${STORAGE_CONFIG.PREFIX}${key}`;
  }

  /**
   * Guarda un evento en el almacenamiento
   */
  saveEvent(event) {
    if (!event || !event.evento_id) {
      console.error('Evento inválido');
      return false;
    }

    try {
      // Obtener eventos existentes
      const events = this.getEvents();

      // Añadir el nuevo evento
      events.push(event);

      // Limitar el número de eventos
      if (events.length > STORAGE_CONFIG.MAX_EVENTS) {
        events.splice(0, events.length - STORAGE_CONFIG.MAX_EVENTS);
      }

      // Guardar eventos actualizados
      this.storage.setItem(
        this.getStorageKey(STORAGE_KEYS.EVENTS),
        JSON.stringify(events)
      );

      // Añadir a la cola de sincronización
      this.addToSyncQueue(event);

      return true;
    } catch (error) {
      console.error('Error guardando evento:', error);

      // Si el almacenamiento está lleno, intentar limpiar
      if (error.name === 'QuotaExceededError') {
        this.handleStorageQuotaExceeded();
        // Reintentar una vez
        try {
          const events = this.getEvents().slice(-100); // Mantener solo los últimos 100
          events.push(event);
          this.storage.setItem(
            this.getStorageKey(STORAGE_KEYS.EVENTS),
            JSON.stringify(events)
          );
          return true;
        } catch {
          return false;
        }
      }

      return false;
    }
  }

  /**
   * Obtiene eventos del almacenamiento con filtros opcionales
   */
  getEvents(filters = {}) {
    try {
      const stored = this.storage.getItem(this.getStorageKey(STORAGE_KEYS.EVENTS));
      let events = stored ? JSON.parse(stored) : [];

      // Aplicar filtros
      if (filters.app_id) {
        events = events.filter(e => e.app_id === filters.app_id);
      }

      if (filters.evento_tipo) {
        events = events.filter(e => e.evento_tipo === filters.evento_tipo);
      }

      if (filters.desde) {
        const desde = new Date(filters.desde).getTime();
        events = events.filter(e => e.timestamp >= desde);
      }

      if (filters.hasta) {
        const hasta = new Date(filters.hasta).getTime();
        events = events.filter(e => e.timestamp <= hasta);
      }

      if (filters.limit) {
        events = events.slice(-filters.limit);
      }

      return events;
    } catch (error) {
      console.error('Error obteniendo eventos:', error);
      return [];
    }
  }

  /**
   * Limpia eventos antiguos según la política de retención
   */
  cleanOldEvents() {
    try {
      const events = this.getEvents();
      const cutoffTime = Date.now() - (STORAGE_CONFIG.RETENTION_DAYS * 24 * 60 * 60 * 1000);

      const filteredEvents = events.filter(e => e.timestamp > cutoffTime);

      if (filteredEvents.length < events.length) {
        this.storage.setItem(
          this.getStorageKey(STORAGE_KEYS.EVENTS),
          JSON.stringify(filteredEvents)
        );

        if (window.GAMIFICATION_DEBUG) {
          console.log(`Limpiados ${events.length - filteredEvents.length} eventos antiguos`);
        }
      }
    } catch (error) {
      console.error('Error limpiando eventos antiguos:', error);
    }
  }

  /**
   * Guarda el perfil del usuario
   */
  saveUserProfile(profile) {
    try {
      this.storage.setItem(
        this.getStorageKey(STORAGE_KEYS.USER_PROFILE),
        JSON.stringify({
          ...profile,
          updated_at: Date.now()
        })
      );
      return true;
    } catch (error) {
      console.error('Error guardando perfil:', error);
      return false;
    }
  }

  /**
   * Obtiene el perfil del usuario
   */
  getUserProfile() {
    try {
      const stored = this.storage.getItem(this.getStorageKey(STORAGE_KEYS.USER_PROFILE));
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  /**
   * Guarda preferencias del usuario
   */
  savePreferences(preferences) {
    try {
      this.storage.setItem(
        this.getStorageKey(STORAGE_KEYS.PREFERENCES),
        JSON.stringify(preferences)
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Obtiene las preferencias del usuario
   */
  getPreferences() {
    try {
      const stored = this.storage.getItem(this.getStorageKey(STORAGE_KEYS.PREFERENCES));
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  /**
   * Guarda datos de sesión
   */
  saveSessionData(data) {
    try {
      this.storage.setItem(
        this.getStorageKey(STORAGE_KEYS.SESSION_DATA),
        JSON.stringify({
          ...data,
          timestamp: Date.now()
        })
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Obtiene datos de sesión
   */
  getSessionData() {
    try {
      const stored = this.storage.getItem(this.getStorageKey(STORAGE_KEYS.SESSION_DATA));
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  /**
   * Añade un evento a la cola de sincronización
   */
  addToSyncQueue(event) {
    this.syncQueue.push(event);

    // Si la cola es muy grande, intentar guardarla
    if (this.syncQueue.length >= STORAGE_CONFIG.SYNC_BATCH_SIZE) {
      this.saveSyncQueue();
    }
  }

  /**
   * Guarda la cola de sincronización
   */
  saveSyncQueue() {
    try {
      this.storage.setItem(
        this.getStorageKey(STORAGE_KEYS.SYNC_QUEUE),
        JSON.stringify(this.syncQueue)
      );
    } catch {
      console.error('Error guardando cola de sincronización');
    }
  }

  /**
   * Carga la cola de sincronización
   */
  loadSyncQueue() {
    try {
      const stored = this.storage.getItem(this.getStorageKey(STORAGE_KEYS.SYNC_QUEUE));
      this.syncQueue = stored ? JSON.parse(stored) : [];
    } catch {
      this.syncQueue = [];
    }
  }

  /**
   * Prepara datos para sincronización con el servidor
   */
  exportForSync() {
    const events = this.syncQueue.length > 0 ? this.syncQueue : this.getEvents({ limit: STORAGE_CONFIG.SYNC_BATCH_SIZE });

    return {
      version: STORAGE_CONFIG.VERSION,
      batch_id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      events: events,
      user_profile: this.getUserProfile(),
      metadata: {
        client_timestamp: Date.now(),
        events_count: events.length,
        storage_usage: this.getStorageUsage()
      }
    };
  }

  /**
   * Marca eventos como sincronizados
   */
  markAsSynced(eventIds) {
    try {
      // Eliminar de la cola de sincronización
      this.syncQueue = this.syncQueue.filter(e => !eventIds.includes(e.evento_id));
      this.saveSyncQueue();

      // Actualizar timestamp de última sincronización
      this.storage.setItem(
        this.getStorageKey(STORAGE_KEYS.LAST_SYNC),
        JSON.stringify({
          timestamp: Date.now(),
          events_synced: eventIds.length
        })
      );

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Obtiene información sobre el uso del almacenamiento
   */
  getStorageUsage() {
    try {
      let totalSize = 0;

      // Calcular tamaño aproximado de todos los datos
      Object.values(STORAGE_KEYS).forEach(key => {
        const data = this.storage.getItem(this.getStorageKey(key));
        if (data) {
          totalSize += new Blob([data]).size;
        }
      });

      return {
        bytes_used: totalSize,
        kb_used: Math.round(totalSize / 1024),
        events_count: this.getEvents().length,
        sync_queue_size: this.syncQueue.length
      };
    } catch {
      return {
        bytes_used: 0,
        kb_used: 0,
        events_count: 0,
        sync_queue_size: 0
      };
    }
  }

  /**
   * Maneja cuando se excede la cuota de almacenamiento
   */
  handleStorageQuotaExceeded() {
    console.warn('Cuota de almacenamiento excedida, limpiando datos antiguos...');

    // Limpiar eventos antiguos agresivamente
    const events = this.getEvents();
    const recentEvents = events.slice(-50); // Mantener solo los últimos 50

    try {
      this.storage.setItem(
        this.getStorageKey(STORAGE_KEYS.EVENTS),
        JSON.stringify(recentEvents)
      );
    } catch {
      // Si aún falla, limpiar todo excepto lo esencial
      this.clearNonEssentialData();
    }
  }

  /**
   * Limpia datos no esenciales
   */
  clearNonEssentialData() {
    try {
      // Mantener solo perfil y preferencias
      const profile = this.getUserProfile();
      const preferences = this.getPreferences();

      // Limpiar eventos y cola
      this.storage.removeItem(this.getStorageKey(STORAGE_KEYS.EVENTS));
      this.storage.removeItem(this.getStorageKey(STORAGE_KEYS.SYNC_QUEUE));
      this.storage.removeItem(this.getStorageKey(STORAGE_KEYS.SESSION_DATA));

      // Reinicializar con arrays vacíos
      this.storage.setItem(this.getStorageKey(STORAGE_KEYS.EVENTS), '[]');
      this.syncQueue = [];

      console.info('Datos no esenciales limpiados');
    } catch (error) {
      console.error('Error limpiando datos:', error);
    }
  }

  /**
   * Migra datos si es necesario (para futuras actualizaciones)
   */
  migrateDataIfNeeded() {
    // Verificar versión almacenada
    const storedVersion = this.storage.getItem(this.getStorageKey('version'));

    if (!storedVersion) {
      // Primera vez, establecer versión
      this.storage.setItem(this.getStorageKey('version'), STORAGE_CONFIG.VERSION);
      return;
    }

    // Si la versión es diferente, aplicar migraciones
    if (storedVersion !== STORAGE_CONFIG.VERSION) {
      console.log(`Migrando datos de versión ${storedVersion} a ${STORAGE_CONFIG.VERSION}`);
      // Aquí irían las migraciones específicas según la versión
      this.storage.setItem(this.getStorageKey('version'), STORAGE_CONFIG.VERSION);
    }
  }

  /**
   * Exporta todos los datos (para backup del usuario)
   */
  exportAllData() {
    return {
      version: STORAGE_CONFIG.VERSION,
      export_date: new Date().toISOString(),
      events: this.getEvents(),
      user_profile: this.getUserProfile(),
      preferences: this.getPreferences(),
      session_data: this.getSessionData(),
      storage_usage: this.getStorageUsage()
    };
  }

  /**
   * Importa datos desde un backup
   */
  importData(data) {
    if (!data || data.version !== STORAGE_CONFIG.VERSION) {
      console.error('Datos incompatibles o versión incorrecta');
      return false;
    }

    try {
      if (data.events) {
        this.storage.setItem(
          this.getStorageKey(STORAGE_KEYS.EVENTS),
          JSON.stringify(data.events)
        );
      }

      if (data.user_profile) {
        this.saveUserProfile(data.user_profile);
      }

      if (data.preferences) {
        this.savePreferences(data.preferences);
      }

      if (data.session_data) {
        this.saveSessionData(data.session_data);
      }

      return true;
    } catch (error) {
      console.error('Error importando datos:', error);
      return false;
    }
  }

  /**
   * Limpia todos los datos de gamificación
   */
  clearAll() {
    Object.values(STORAGE_KEYS).forEach(key => {
      this.storage.removeItem(this.getStorageKey(key));
    });
    this.storage.removeItem(this.getStorageKey('version'));
    this.syncQueue = [];
    console.info('Todos los datos de gamificación han sido limpiados');
  }
}

// Crear instancia singleton
let instance = null;

export function getGameDataStore() {
  if (!instance) {
    instance = new GameDataStore();
  }
  return instance;
}

// Exportar la clase para testing
export { GameDataStore, STORAGE_CONFIG, STORAGE_KEYS };