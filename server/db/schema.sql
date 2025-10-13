-- Gamification Database Schema
-- SQLite database for Phase 2a: Backend and Database

-- Tabla de usuarios (simple, sin autenticación)
CREATE TABLE IF NOT EXISTS users (
  user_id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  created_at INTEGER NOT NULL,
  total_score INTEGER DEFAULT 0,
  current_level INTEGER DEFAULT 1
);

-- Tabla de ejercicios
CREATE TABLE IF NOT EXISTS exercises (
  exercise_id INTEGER PRIMARY KEY AUTOINCREMENT,
  exercise_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  difficulty_level INTEGER NOT NULL DEFAULT 1,
  parameters TEXT,
  created_at INTEGER NOT NULL
);

-- Tabla de intentos de ejercicio
CREATE TABLE IF NOT EXISTS user_exercises (
  attempt_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  exercise_id INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  score INTEGER,
  accuracy_percentage REAL,
  attempt_data TEXT,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (exercise_id) REFERENCES exercises(exercise_id) ON DELETE CASCADE
);

-- Tabla de sesiones (migrada de localStorage)
CREATE TABLE IF NOT EXISTS sessions (
  session_id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  app_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  total_events INTEGER DEFAULT 0,
  total_score INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Tabla de eventos (migrada de localStorage)
CREATE TABLE IF NOT EXISTS events (
  event_id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  session_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  app_id TEXT NOT NULL,
  base_score INTEGER,
  final_score INTEGER,
  metadata TEXT,
  synced INTEGER DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_user_exercises_user ON user_exercises(user_id);
CREATE INDEX IF NOT EXISTS idx_user_exercises_exercise ON user_exercises(exercise_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);

-- Insertar 2 usuarios de prueba
INSERT OR IGNORE INTO users (user_id, username, display_name, created_at, total_score, current_level)
VALUES
  (1, 'tester', 'Usuario de Prueba', strftime('%s', 'now') * 1000, 0, 1),
  (2, 'user', 'Usuario Normal', strftime('%s', 'now') * 1000, 0, 1);

-- Insertar ejercicios de ejemplo (Phase 2c los completará)
INSERT OR IGNORE INTO exercises (exercise_id, exercise_type, title, description, difficulty_level, parameters, created_at)
VALUES
  (1, 'sequence_entry', 'Patrón Par-Impar Básico', 'Identifica el patrón par-impar de 8 pulsos', 1, '{"pattern": [0,1,0,1,0,1,0,1], "length": 8}', strftime('%s', 'now') * 1000),
  (2, 'sequence_entry', 'Patrón Par-Impar Intermedio', 'Identifica el patrón par-impar de 16 pulsos', 2, '{"pattern": [0,1,1,0,1,0,0,1,0,1,0,1,1,0,1,0], "length": 16}', strftime('%s', 'now') * 1000),
  (3, 'rhythm_sync', 'Sincronización Rítmica Básica', 'Reproduce un ritmo simple de 4 beats', 1, '{"rhythm": [0, 0.5, 1.0, 1.5], "input_mode": "both"}', strftime('%s', 'now') * 1000),
  (4, 'tap_matching', 'Tap Tempo 120 BPM', 'Mantén un tempo constante de 120 BPM', 2, '{"bpm": 120, "tap_count": 8}', strftime('%s', 'now') * 1000),
  (5, 'fraction_recognition', 'Reconoce 3/4', 'Identifica la fracción temporal 3/4', 2, '{"fraction": {"n": 3, "d": 4}}', strftime('%s', 'now') * 1000);
