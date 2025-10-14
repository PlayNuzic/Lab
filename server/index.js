/**
 * Gamification API Server
 * Express.js server for Phase 2a backend
 */

const express = require('express');
const cors = require('cors');
const { getDatabase } = require('./db/database');
const apiRoutes = require('./api/routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Enable CORS for all origins
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// API routes
app.use('/api', apiRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Gamification API Server',
    version: '2.0.0',
    endpoints: {
      health: '/api/health',
      users: '/api/users',
      exercises: '/api/exercises',
      sessions: '/api/sessions',
      events: '/api/events'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Initialize database and start server
async function startServer() {
  try {
    console.log('Initializing database...');
    const db = getDatabase();
    await db.initialize();

    app.listen(PORT, () => {
      console.log(`\n✅ Gamification API Server running on http://localhost:${PORT}`);
      console.log(`📊 Database: ${require('path').join(__dirname, 'db', 'gamification.db')}`);
      console.log(`\nAvailable endpoints:`);
      console.log(`  GET  /api/health`);
      console.log(`  GET  /api/users`);
      console.log(`  GET  /api/users/:id`);
      console.log(`  GET  /api/users/:id/attempts`);
      console.log(`  GET  /api/exercises`);
      console.log(`  POST /api/exercises/:id/start`);
      console.log(`  POST /api/exercises/:id/complete`);
      console.log(`  POST /api/sessions/start`);
      console.log(`  POST /api/sessions/:id/end`);
      console.log(`  POST /api/events/sync`);
      console.log(`  GET  /api/events/history`);
      console.log(`\nPress Ctrl+C to stop the server\n`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down server...');
  const db = getDatabase();
  await db.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down server...');
  const db = getDatabase();
  await db.close();
  process.exit(0);
});

// Start the server
startServer();
