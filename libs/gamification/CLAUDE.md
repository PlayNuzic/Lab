# Gamification — Context for Claude

## Purpose
Modular achievement system with event tracking, scoring, and persistent storage.

## Main Exports
- `GamificationManager` — Main class: `init(appId)`, `trackEvent()`, `trackAppAction()`, `getStats()`, `getAchievements()`
- `initGamification(appId)` — Initialize for specific app
- `trackEvent(eventType, metadata)` — Custom event tracking
- `recordAttempt(data)` — Record exercise attempt to localStorage
- Subsystem singletons: `getEventSystem`, `getScoringSystem`, `getAchievementSystem`, `getGameDataStore`

## Key Rules
- Singleton pattern: MUST call `init(appId)` before any other method
- Events mapped per app in `APP_EVENT_MAPPINGS`
- Achievement checks are throttled (5s delay)
- localStorage keeps last 100 attempts
- Dev tools are OPT-IN: `?dev` a la URL activa enableDevTools/logEvents (window.__GAMIFICATION, __EAR_TRAINING; H-05) — per defecte res no s'exposa en producció

## App5 Integration
App5 has a complete game system with 4 progressive levels, keyboard/microphone capture modes, and rhythm analysis. See `Apps/App5/AGENTS.md` for full game documentation.
