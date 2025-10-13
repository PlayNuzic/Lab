/**
 * API Routes for Gamification System
 * Provides REST endpoints for users, exercises, sessions, and events
 */

const express = require('express');
const router = express.Router();
const { getDatabase } = require('../db/database');

// ===== HEALTH CHECK =====
router.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Gamification API is running' });
});

// ===== USER ROUTES =====

/**
 * GET /api/users - List all users
 */
router.get('/users', async (req, res) => {
  try {
    const db = getDatabase();
    const users = await db.getUsers();

    res.json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * GET /api/users/:id - Get specific user with stats
 */
router.get('/users/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const db = getDatabase();

    const userStats = await db.getUserStats(userId);

    if (!userStats) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(userStats);
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

/**
 * GET /api/users/:id/attempts - Get user's exercise attempts
 */
router.get('/users/:id/attempts', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const limit = parseInt(req.query.limit) || 10;
    const db = getDatabase();

    const attempts = await db.getUserAttempts(userId, limit);

    res.json(attempts);
  } catch (err) {
    console.error('Error fetching attempts:', err);
    res.status(500).json({ error: 'Failed to fetch attempts' });
  }
});

// ===== EXERCISE ROUTES =====

/**
 * GET /api/exercises - List available exercises
 * Query params: ?type=sequence_entry&difficulty=1
 */
router.get('/exercises', async (req, res) => {
  try {
    const filters = {
      type: req.query.type,
      difficulty: req.query.difficulty ? parseInt(req.query.difficulty) : null
    };

    const db = getDatabase();
    const exercises = await db.getExercises(filters);

    // Parse JSON parameters
    const exercisesWithParams = exercises.map(ex => ({
      ...ex,
      parameters: ex.parameters ? JSON.parse(ex.parameters) : null
    }));

    res.json(exercisesWithParams);
  } catch (err) {
    console.error('Error fetching exercises:', err);
    res.status(500).json({ error: 'Failed to fetch exercises' });
  }
});

/**
 * GET /api/exercises/:id - Get specific exercise
 */
router.get('/exercises/:id', async (req, res) => {
  try {
    const exerciseId = parseInt(req.params.id);
    const db = getDatabase();

    const exercise = await db.getExerciseById(exerciseId);

    if (!exercise) {
      return res.status(404).json({ error: 'Exercise not found' });
    }

    // Parse JSON parameters
    exercise.parameters = exercise.parameters ? JSON.parse(exercise.parameters) : null;

    res.json(exercise);
  } catch (err) {
    console.error('Error fetching exercise:', err);
    res.status(500).json({ error: 'Failed to fetch exercise' });
  }
});

/**
 * POST /api/exercises/:id/start - Start an exercise attempt
 * Body: { user_id: number }
 */
router.post('/exercises/:id/start', async (req, res) => {
  try {
    const exerciseId = parseInt(req.params.id);
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const db = getDatabase();

    // Verify exercise exists
    const exercise = await db.getExerciseById(exerciseId);
    if (!exercise) {
      return res.status(404).json({ error: 'Exercise not found' });
    }

    // Verify user exists
    const user = await db.getUserById(user_id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create attempt
    const attempt = await db.createAttempt(user_id, exerciseId);

    // Parse exercise parameters
    exercise.parameters = exercise.parameters ? JSON.parse(exercise.parameters) : null;

    res.json({
      attempt_id: attempt.attempt_id,
      exercise_data: exercise
    });
  } catch (err) {
    console.error('Error starting exercise:', err);
    res.status(500).json({ error: 'Failed to start exercise' });
  }
});

/**
 * POST /api/exercises/:id/complete - Complete an exercise attempt
 * Body: { attempt_id: number, score: number, accuracy: number, attempt_data: object }
 */
router.post('/exercises/:id/complete', async (req, res) => {
  try {
    const { attempt_id, score, accuracy, attempt_data } = req.body;

    if (!attempt_id || score === undefined || accuracy === undefined) {
      return res.status(400).json({ error: 'attempt_id, score, and accuracy are required' });
    }

    const db = getDatabase();

    // Complete the attempt
    await db.completeAttempt(attempt_id, score, accuracy, attempt_data || {});

    // Get the attempt to find user_id
    const attempt = await db.get(
      'SELECT user_id FROM user_exercises WHERE attempt_id = ?',
      [attempt_id]
    );

    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    // Update user's total score
    const user = await db.getUserById(attempt.user_id);
    const newScore = user.total_score + score;

    // Calculate new level (simple formula: level = floor(score / 100) + 1, max 10)
    const newLevel = Math.min(Math.floor(newScore / 100) + 1, 10);

    await db.updateUserScore(attempt.user_id, newScore, newLevel);

    // Check for achievements unlocked (Phase 1 system handles this)
    const achievements_unlocked = [];

    res.json({
      saved: true,
      new_score: newScore,
      new_level: newLevel,
      achievements_unlocked
    });
  } catch (err) {
    console.error('Error completing exercise:', err);
    res.status(500).json({ error: 'Failed to complete exercise' });
  }
});

// ===== SESSION ROUTES =====

/**
 * POST /api/sessions/start - Start a practice session
 * Body: { user_id: number, app_id: string }
 */
router.post('/sessions/start', async (req, res) => {
  try {
    const { user_id, app_id } = req.body;

    if (!user_id || !app_id) {
      return res.status(400).json({ error: 'user_id and app_id are required' });
    }

    const db = getDatabase();

    // Generate session_id (timestamp)
    const session_id = Date.now();

    await db.createSession(session_id, user_id, app_id);

    res.json({ session_id });
  } catch (err) {
    console.error('Error starting session:', err);
    res.status(500).json({ error: 'Failed to start session' });
  }
});

/**
 * POST /api/sessions/:id/end - End a practice session
 * Body: { total_events: number, total_score: number }
 */
router.post('/sessions/:id/end', async (req, res) => {
  try {
    const session_id = parseInt(req.params.id);
    const { total_events, total_score } = req.body;

    const db = getDatabase();

    await db.endSession(session_id, total_events || 0, total_score || 0);

    res.json({ ended: true });
  } catch (err) {
    console.error('Error ending session:', err);
    res.status(500).json({ error: 'Failed to end session' });
  }
});

/**
 * GET /api/sessions - Get user sessions
 * Query params: ?user_id=1&limit=10
 */
router.get('/sessions', async (req, res) => {
  try {
    const userId = parseInt(req.query.user_id);
    const limit = parseInt(req.query.limit) || 10;

    if (!userId) {
      return res.status(400).json({ error: 'user_id query parameter is required' });
    }

    const db = getDatabase();
    const sessions = await db.getUserSessions(userId, limit);

    res.json(sessions);
  } catch (err) {
    console.error('Error fetching sessions:', err);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// ===== EVENT ROUTES =====

/**
 * POST /api/events/sync - Sync events from localStorage
 * Body: { user_id: number, events: array, sessions: array }
 */
router.post('/events/sync', async (req, res) => {
  try {
    const { user_id, events, sessions } = req.body;

    if (!user_id || !events) {
      return res.status(400).json({ error: 'user_id and events are required' });
    }

    const db = getDatabase();

    // Sync sessions first (if provided)
    if (sessions && Array.isArray(sessions)) {
      for (const session of sessions) {
        try {
          await db.createSession(session.session_id, user_id, session.app_id);
          if (session.ended_at) {
            await db.endSession(session.session_id, session.total_events, session.total_score);
          }
        } catch (err) {
          // Session might already exist, continue
        }
      }
    }

    // Sync events
    const eventsWithUserId = events.map(event => ({
      ...event,
      user_id
    }));

    const result = await db.syncEvents(eventsWithUserId);

    res.json({
      synced_count: result.syncedCount,
      failed_count: result.failedCount
    });
  } catch (err) {
    console.error('Error syncing events:', err);
    res.status(500).json({ error: 'Failed to sync events' });
  }
});

/**
 * GET /api/events/history - Get event history
 * Query params: ?user_id=1&app_id=app2&limit=100
 */
router.get('/events/history', async (req, res) => {
  try {
    const userId = parseInt(req.query.user_id);
    const appId = req.query.app_id || null;
    const limit = parseInt(req.query.limit) || 100;

    if (!userId) {
      return res.status(400).json({ error: 'user_id query parameter is required' });
    }

    const db = getDatabase();
    const events = await db.getEventHistory(userId, appId, limit);

    // Parse metadata JSON
    const eventsWithMetadata = events.map(event => ({
      ...event,
      metadata: event.metadata ? JSON.parse(event.metadata) : null
    }));

    res.json(eventsWithMetadata);
  } catch (err) {
    console.error('Error fetching event history:', err);
    res.status(500).json({ error: 'Failed to fetch event history' });
  }
});

module.exports = router;
