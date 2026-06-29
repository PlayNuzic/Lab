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
└── user-manager.js    # Gestió d'usuari
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

## Implementat a
- **App5**: Joc de ritme complet amb 4 nivells
