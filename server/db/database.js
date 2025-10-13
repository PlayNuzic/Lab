/**
 * Database Module - SQLite Connection and Queries
 * Provides database connection and query methods for the gamification system
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'gamification.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

class Database {
  constructor() {
    this.db = null;
  }

  /**
   * Initialize database connection and create tables
   */
  async initialize() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
          console.error('Error opening database:', err.message);
          reject(err);
          return;
        }

        console.log('Connected to SQLite database');

        // Read and execute schema
        const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');

        this.db.exec(schema, (err) => {
          if (err) {
            console.error('Error executing schema:', err.message);
            reject(err);
            return;
          }

          console.log('Database schema initialized');
          resolve();
        });
      });
    });
  }

  /**
   * Execute a single query
   */
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  /**
   * Get a single row
   */
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(row);
      });
    });
  }

  /**
   * Get all rows
   */
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }

  /**
   * Close database connection
   */
  close() {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve();
        return;
      }

      this.db.close((err) => {
        if (err) {
          reject(err);
          return;
        }
        console.log('Database connection closed');
        resolve();
      });
    });
  }

  // ===== USER QUERIES =====

  async getUsers() {
    return this.all('SELECT * FROM users ORDER BY user_id');
  }

  async getUserById(userId) {
    return this.get('SELECT * FROM users WHERE user_id = ?', [userId]);
  }

  async updateUserScore(userId, newScore, newLevel) {
    return this.run(
      'UPDATE users SET total_score = ?, current_level = ? WHERE user_id = ?',
      [newScore, newLevel, userId]
    );
  }

  // ===== EXERCISE QUERIES =====

  async getExercises(filters = {}) {
    let sql = 'SELECT * FROM exercises WHERE 1=1';
    const params = [];

    if (filters.type) {
      sql += ' AND exercise_type = ?';
      params.push(filters.type);
    }

    if (filters.difficulty) {
      sql += ' AND difficulty_level = ?';
      params.push(filters.difficulty);
    }

    sql += ' ORDER BY exercise_id';

    return this.all(sql, params);
  }

  async getExerciseById(exerciseId) {
    return this.get('SELECT * FROM exercises WHERE exercise_id = ?', [exerciseId]);
  }

  // ===== USER_EXERCISES QUERIES =====

  async createAttempt(userId, exerciseId) {
    const startedAt = Date.now();
    const result = await this.run(
      'INSERT INTO user_exercises (user_id, exercise_id, started_at) VALUES (?, ?, ?)',
      [userId, exerciseId, startedAt]
    );

    return {
      attempt_id: result.lastID,
      user_id: userId,
      exercise_id: exerciseId,
      started_at: startedAt
    };
  }

  async completeAttempt(attemptId, score, accuracy, attemptData) {
    const completedAt = Date.now();

    return this.run(
      `UPDATE user_exercises
       SET completed_at = ?, score = ?, accuracy_percentage = ?, attempt_data = ?
       WHERE attempt_id = ?`,
      [completedAt, score, accuracy, JSON.stringify(attemptData), attemptId]
    );
  }

  async getUserAttempts(userId, limit = 10) {
    return this.all(
      `SELECT ue.*, e.title as exercise_title, e.exercise_type
       FROM user_exercises ue
       JOIN exercises e ON ue.exercise_id = e.exercise_id
       WHERE ue.user_id = ?
       ORDER BY ue.completed_at DESC
       LIMIT ?`,
      [userId, limit]
    );
  }

  // ===== SESSION QUERIES =====

  async createSession(sessionId, userId, appId) {
    const startedAt = Date.now();

    return this.run(
      'INSERT INTO sessions (session_id, user_id, app_id, started_at) VALUES (?, ?, ?, ?)',
      [sessionId, userId, appId, startedAt]
    );
  }

  async endSession(sessionId, totalEvents, totalScore) {
    const endedAt = Date.now();

    return this.run(
      `UPDATE sessions
       SET ended_at = ?, total_events = ?, total_score = ?
       WHERE session_id = ?`,
      [endedAt, totalEvents, totalScore, sessionId]
    );
  }

  async getUserSessions(userId, limit = 10) {
    return this.all(
      `SELECT * FROM sessions
       WHERE user_id = ?
       ORDER BY started_at DESC
       LIMIT ?`,
      [userId, limit]
    );
  }

  // ===== EVENT QUERIES =====

  async createEvent(event) {
    return this.run(
      `INSERT INTO events
       (event_id, user_id, session_id, event_type, timestamp, app_id, base_score, final_score, metadata, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event.event_id || event.evento_id,
        event.user_id,
        event.session_id,
        event.event_type || event.evento_tipo,
        event.timestamp,
        event.app_id,
        event.base_score || event.puntuacion_base,
        event.final_score || event.puntuacion_final,
        JSON.stringify(event.metadata),
        event.synced || 1
      ]
    );
  }

  async syncEvents(events) {
    let syncedCount = 0;
    let failedCount = 0;

    for (const event of events) {
      try {
        await this.createEvent(event);
        syncedCount++;
      } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          // Event already exists, skip
          syncedCount++;
        } else {
          console.error('Error syncing event:', err.message);
          failedCount++;
        }
      }
    }

    return { syncedCount, failedCount };
  }

  async getEventHistory(userId, appId = null, limit = 100) {
    let sql = 'SELECT * FROM events WHERE user_id = ?';
    const params = [userId];

    if (appId) {
      sql += ' AND app_id = ?';
      params.push(appId);
    }

    sql += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);

    return this.all(sql, params);
  }

  // ===== STATS QUERIES =====

  async getUserStats(userId) {
    const user = await this.getUserById(userId);
    if (!user) return null;

    const totalAttempts = await this.get(
      'SELECT COUNT(*) as count FROM user_exercises WHERE user_id = ? AND completed_at IS NOT NULL',
      [userId]
    );

    const avgAccuracy = await this.get(
      'SELECT AVG(accuracy_percentage) as avg FROM user_exercises WHERE user_id = ? AND completed_at IS NOT NULL',
      [userId]
    );

    const totalEvents = await this.get(
      'SELECT COUNT(*) as count FROM events WHERE user_id = ?',
      [userId]
    );

    const recentActivity = await this.getUserAttempts(userId, 5);

    return {
      ...user,
      exercises_completed: totalAttempts.count,
      avg_accuracy: avgAccuracy.avg ? Math.round(avgAccuracy.avg * 10) / 10 : 0,
      total_events: totalEvents.count,
      recent_activity: recentActivity
    };
  }
}

// Singleton instance
let dbInstance = null;

function getDatabase() {
  if (!dbInstance) {
    dbInstance = new Database();
  }
  return dbInstance;
}

module.exports = {
  Database,
  getDatabase
};
