# libs/gamification

Sistema de gamificació modular.

## Estructura

```
gamification/
├── index.js           # GamificationManager
├── event-system.js    # Tracking d'events
├── scoring-system.js  # Càlcul de puntuacions
├── achievements.js    # Sistema de logros
├── storage.js         # Persistència localStorage
├── config.js          # Configuració
├── user-manager.js    # Gestió d'usuari
└── game-components/   # Components de joc reutilitzables
    ├── shared/        # Classes base (BaseGameManager, LevelSystem)
    └── rhythm-game/   # Components per jocs de ritme
```

## Ús

```javascript
import { initGamification, trackEvent } from '../../libs/gamification/index.js';

// Inicialitzar
initGamification('app5');

// Tracking
trackEvent('PATTERN_COMPLETED', { accuracy: 0.95 });
trackEvent('LEVEL_UP', { level: 2 });
```

## Game Components

```javascript
import { BaseGameManager } from '../../libs/gamification/game-components/shared/BaseGameManager.js';

class MyGame extends BaseGameManager {
  constructor() {
    super({ appId: 'myGame', maxLevels: 4 });
  }

  getLevelConfig(level) { /* ... */ }
  executePhase(phase) { /* ... */ }
}
```

## Implementat a
- **App5**: Joc de ritme complet amb 4 nivells
