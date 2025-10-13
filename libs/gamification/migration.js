/**
 * Data Migration Module
 * Migrates data from localStorage to database when server is available
 */

import { getUserManager } from './user-manager.js';

const API_BASE_URL = 'http://localhost:3000/api';

/**
 * Check if server is available
 * @returns {Promise<boolean>} Server availability
 */
export async function isServerAvailable() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(3000) // 3 second timeout
    });

    return response.ok;
  } catch (err) {
    return false;
  }
}

/**
 * Get local data from localStorage
 * @returns {object} Local events and sessions
 */
function getLocalData() {
  const eventsKey = 'gamification_events';
  const sessionsKey = 'gamification_sessions';

  const eventsStr = localStorage.getItem(eventsKey);
  const sessionsStr = localStorage.getItem(sessionsKey);

  const events = eventsStr ? JSON.parse(eventsStr) : [];
  const sessions = sessionsStr ? JSON.parse(sessionsStr) : [];

  return { events, sessions };
}

/**
 * Clear local data from localStorage
 */
function clearLocalData() {
  localStorage.removeItem('gamification_events');
  localStorage.removeItem('gamification_sessions');
}

/**
 * Mark migration as completed
 */
function markMigrationComplete() {
  const timestamp = Date.now();
  localStorage.setItem('gamification_migration_completed', timestamp.toString());
  localStorage.setItem('gamification_migration_date', new Date(timestamp).toISOString());
}

/**
 * Check if migration was already completed
 * @returns {boolean} Migration status
 */
function isMigrationCompleted() {
  return localStorage.getItem('gamification_migration_completed') !== null;
}

/**
 * Get migration info
 * @returns {object|null} Migration info
 */
export function getMigrationInfo() {
  const completed = localStorage.getItem('gamification_migration_completed');
  const date = localStorage.getItem('gamification_migration_date');

  if (!completed) {
    return null;
  }

  return {
    completed: true,
    timestamp: parseInt(completed),
    date: date
  };
}

/**
 * Migrate local data to database
 * @param {boolean} force - Force migration even if already completed
 * @returns {Promise<object>} Migration result
 */
export async function migrateLocalDataToDatabase(force = false) {
  console.log('🔄 Iniciando migración de datos...');

  // Check if already migrated
  if (!force && isMigrationCompleted()) {
    const info = getMigrationInfo();
    console.log(`✅ Migración ya completada el ${info.date}`);
    return {
      already_migrated: true,
      migration_date: info.date,
      synced_count: 0,
      failed_count: 0
    };
  }

  // Check server availability
  const serverAvailable = await isServerAvailable();

  if (!serverAvailable) {
    console.log('❌ Servidor no disponible, continuando en modo offline');
    return {
      server_unavailable: true,
      synced_count: 0,
      failed_count: 0
    };
  }

  console.log('✅ Servidor disponible, procediendo con migración');

  // Get local data
  const { events, sessions } = getLocalData();

  if (events.length === 0 && sessions.length === 0) {
    console.log('ℹ️  No hay datos locales para migrar');
    markMigrationComplete();
    return {
      no_data: true,
      synced_count: 0,
      failed_count: 0
    };
  }

  console.log(`📊 Datos locales encontrados: ${events.length} eventos, ${sessions.length} sesiones`);

  // Get current user
  const userManager = getUserManager();
  const userId = userManager.getCurrentUserId();

  try {
    // Sync events and sessions
    const response = await fetch(`${API_BASE_URL}/events/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: userId,
        events: events,
        sessions: sessions
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    console.log(`✅ Migración completada: ${result.synced_count} eventos sincronizados, ${result.failed_count} fallidos`);

    // Clear local data on successful migration
    if (result.synced_count > 0) {
      clearLocalData();
      markMigrationComplete();
      console.log('🗑️  Datos locales eliminados tras migración exitosa');
    }

    return {
      success: true,
      synced_count: result.synced_count,
      failed_count: result.failed_count,
      migration_date: new Date().toISOString()
    };
  } catch (err) {
    console.error('❌ Error durante la migración:', err);
    return {
      error: true,
      message: err.message,
      synced_count: 0,
      failed_count: events.length
    };
  }
}

/**
 * Reset migration status (for testing)
 */
export function resetMigrationStatus() {
  localStorage.removeItem('gamification_migration_completed');
  localStorage.removeItem('gamification_migration_date');
  console.log('🔄 Estado de migración reseteado');
}

/**
 * Auto-migrate on load if server is available
 */
if (typeof window !== 'undefined') {
  // Wait for window load to ensure all localStorage data is available
  window.addEventListener('load', async () => {
    // Wait a bit to let the app initialize
    setTimeout(async () => {
      const result = await migrateLocalDataToDatabase();

      if (result.success) {
        console.log('🎉 Migración automática completada exitosamente');

        // Dispatch event for UI to update
        window.dispatchEvent(new CustomEvent('dataMigrated', {
          detail: result
        }));
      }
    }, 2000); // Wait 2 seconds after load
  });

  // Expose for console access
  window.__MIGRATION = {
    migrate: migrateLocalDataToDatabase,
    reset: resetMigrationStatus,
    info: getMigrationInfo,
    isServerAvailable
  };

  console.log('🔄 Migration Module cargado');
  console.log('   Comandos disponibles en consola:');
  console.log('   - await window.__MIGRATION.migrate()  // Migrar datos manualmente (async)');
  console.log('   - window.__MIGRATION.info()  // Ver info de migración');
  console.log('   - window.__MIGRATION.reset()  // Resetear estado de migración');
  console.log('   - await window.__MIGRATION.isServerAvailable()  // Verificar servidor (async)');
}
