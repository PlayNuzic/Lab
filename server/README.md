# Gamification API Server

Backend API for the gamification system - Phase 2a implementation.

## Features

- ✅ SQLite database with 5 tables (users, exercises, user_exercises, sessions, events)
- ✅ Express.js REST API with 10+ endpoints
- ✅ Simple 2-user system (no authentication)
- ✅ CORS enabled for local development
- ✅ Automatic data migration from localStorage
- ✅ User statistics and progress tracking

## Installation

```bash
cd server
npm install
```

## Running the Server

### Development mode (with auto-reload)
```bash
npm run dev
```

### Production mode
```bash
npm start
```

The server will start on `http://localhost:3000` by default.

## Environment Variables

- `PORT` - Server port (default: 3000)

## Database

The SQLite database is automatically created at:
```
/server/db/gamification.db
```

Schema is initialized from `/server/db/schema.sql` on first run.

### Default Users

Two test users are created automatically:

| user_id | username | display_name |
|---------|----------|--------------|
| 1 | tester | Usuario de Prueba |
| 2 | user | Usuario Normal |

## API Endpoints

### Health Check
- `GET /api/health` - Check server status

### Users
- `GET /api/users` - List all users
- `GET /api/users/:id` - Get user with stats
- `GET /api/users/:id/attempts` - Get user's exercise attempts

### Exercises
- `GET /api/exercises` - List exercises (filter by type and difficulty)
- `GET /api/exercises/:id` - Get specific exercise
- `POST /api/exercises/:id/start` - Start exercise attempt
- `POST /api/exercises/:id/complete` - Complete exercise attempt

### Sessions
- `POST /api/sessions/start` - Start practice session
- `POST /api/sessions/:id/end` - End practice session
- `GET /api/sessions?user_id=1` - Get user sessions

### Events
- `POST /api/events/sync` - Sync events from localStorage
- `GET /api/events/history?user_id=1` - Get event history

## Example Usage

### Check server health
```bash
curl http://localhost:3000/api/health
```

### Get all users
```bash
curl http://localhost:3000/api/users
```

### Get user with stats
```bash
curl http://localhost:3000/api/users/1
```

### List exercises
```bash
curl http://localhost:3000/api/exercises
```

### Start an exercise
```bash
curl -X POST http://localhost:3000/api/exercises/1/start \
  -H "Content-Type: application/json" \
  -d '{"user_id": 1}'
```

### Complete an exercise
```bash
curl -X POST http://localhost:3000/api/exercises/1/complete \
  -H "Content-Type: application/json" \
  -d '{
    "attempt_id": 1,
    "score": 85,
    "accuracy": 92.5,
    "attempt_data": {
      "target_pattern": [0,1,0,1,0,1,0,1],
      "user_pattern": [0,1,0,1,0,1,0,1],
      "correct_count": 8
    }
  }'
```

### Sync events from localStorage
```bash
curl -X POST http://localhost:3000/api/events/sync \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "events": [
      {
        "event_id": "evt_123456_abc",
        "event_type": "PRACTICE_COMPLETED",
        "timestamp": 1699999999999,
        "session_id": 1699999990000,
        "app_id": "app2",
        "base_score": 20,
        "final_score": 25,
        "metadata": {"lg_value": 16}
      }
    ],
    "sessions": [
      {
        "session_id": 1699999990000,
        "app_id": "app2",
        "total_events": 5,
        "total_score": 100
      }
    ]
  }'
```

## Client-Side Integration

The client-side libraries automatically detect when the server is available:

```javascript
// Check server availability
const available = await window.__MIGRATION.isServerAvailable();

// Manually trigger migration
const result = await window.__MIGRATION.migrate();

// Switch users (console-based)
window.__USER_MANAGER.switchUser(1); // tester
window.__USER_MANAGER.switchUser(2); // user

// Get user stats
const stats = await window.__USER_MANAGER.fetchUserStats();
```

## Database Schema

```sql
-- Users
users (user_id, username, display_name, created_at, total_score, current_level)

-- Exercises
exercises (exercise_id, exercise_type, title, description, difficulty_level, parameters, created_at)

-- User Exercises (attempts)
user_exercises (attempt_id, user_id, exercise_id, started_at, completed_at, score, accuracy_percentage, attempt_data)

-- Sessions
sessions (session_id, user_id, app_id, started_at, ended_at, total_events, total_score)

-- Events
events (event_id, user_id, session_id, event_type, timestamp, app_id, base_score, final_score, metadata, synced)
```

## Development Notes

- No authentication system (reserved for Phase 4)
- User switching is done via console commands
- Data persists in SQLite database
- CORS enabled for local development (ports 3000, 5500, 8080)
- Auto-migration runs 2 seconds after page load if server is available

## Troubleshooting

### Port already in use
```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>
```

### Database locked
Stop the server and restart it. SQLite only allows one writer at a time.

### CORS errors
Make sure CORS is enabled in `server/index.js` and the client is making requests to the correct URL.

## Phase 2a Status

✅ **COMPLETED**
- SQLite database schema
- Database connection module
- Express.js API server
- All API endpoints
- User manager (client-side)
- Migration system (client-side)

## Next Steps (Phase 2b-2d)

- Phase 2b: Audio capture system (microphone + keyboard)
- Phase 2c: Exercise implementations
- Phase 2d: Exercise UI and launcher

## Support

For issues or questions, check the documentation:
- `GAMIFICATION_PLAN.md` - Complete architecture
- `GAMIFICATION_PROGRESS.md` - Development status
- `GAMIFICATION_USAGE_EXAMPLE.md` - Usage examples
