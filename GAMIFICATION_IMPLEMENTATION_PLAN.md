# Plan de Implementación de Gamificación para Apps 2, 3 y 4

## 📅 Fecha: 2025-10-19
## 🎯 Objetivo: Implementar gamificación completa en Apps 2, 3 y 4 usando el sistema modular creado

---

## 🎮 App2 - Sucesión de Pulsos (Rhythm Game)

### Descripción General
App2 reutilizará el sistema completo de App5 adaptado para trabajar con los parámetros Lg y V específicos de sucesión de pulsos.

### Mecánica del Juego
1. **Fase 1 - Configuración**: El usuario configura Lg y V
2. **Fase 2 - Escuchar**: Se reproduce el patrón de pulsos
3. **Fase 3 - Captura**: El usuario reproduce el patrón con teclado (ESPACIO)
4. **Fase 4 - Validación**: Se compara el patrón capturado con el esperado

### Niveles (4 niveles progresivos)

#### Nivel 1: Introducción
- **Lg**: 3
- **V**: 2
- **Requisito**: "Identifica 2 posiciones"
- **BPM**: 90
- **Tolerancia**: 100ms
- **Patrón ejemplo**: [1, 3]

#### Nivel 2: Intermedio
- **Lg**: 4
- **V**: 3
- **Requisito**: "Identifica 3 posiciones"
- **BPM**: 100
- **Tolerancia**: 80ms
- **Patrón ejemplo**: [1, 2, 4]

#### Nivel 3: Avanzado
- **Lg**: 5
- **V**: Variable (3-4)
- **Requisito**: "Patrones mixtos"
- **BPM**: 110
- **Tolerancia**: 60ms
- **Generación**: Aleatoria con reglas

#### Nivel 4: Experto
- **Lg**: 6-8
- **V**: Variable
- **Requisito**: "Patrones complejos"
- **BPM**: 120
- **Tolerancia**: 50ms
- **Generación**: Patrones sincopados

### Implementación Técnica

#### 1. Estructura de archivos
```
Apps/App2/game/
├── game-manager.js    # Copia adaptada de App5
├── game-ui.js         # Copia de App5
├── game-state.js      # Copia de App5
└── levels-config.js   # Nueva configuración específica
```

#### 2. Integración con main.js
```javascript
// En Apps/App2/main.js
import { GameManager } from './game/game-manager.js';

// Después de inicializar audio
const gameManager = new GameManager();
gameManager.pulseSeqController = pulseSeqController;
gameManager.synth = window.synth;
await gameManager.init();
```

#### 3. Adaptación de levels-config.js
```javascript
export const LEVELS = {
  1: {
    lg: 3,
    v: 2,
    requirement: "Identifica las 2 posiciones",
    solution: calculatePositions(3, 2),
    phase2Repeats: 2
  },
  // ... más niveles
};

function calculatePositions(lg, v) {
  // Lógica para calcular posiciones basada en Lg/V
  const positions = [];
  const interval = lg / v;
  for (let i = 0; i < v; i++) {
    positions.push(Math.floor(i * interval) + 1);
  }
  return positions;
}
```

### UI/UX
- Reutilizar popups y estilos de App5
- Adaptar textos para hablar de "sucesión" en lugar de "pulsaciones"
- Mantener sistema de overlay selectivo

### Integración con Sistema Base
- Importar desde `/libs/gamification/game-components/rhythm-game/`
- Usar `RhythmGameManager` como base
- Conectar con sistema de eventos existente

---

## 🎲 App3 - Adivinar Fracciones (Fraction Recognition)

### Descripción General
Juego de reconocimiento auditivo donde el usuario escucha una fracción rítmica y debe identificar n/d.

### Mecánica del Juego
1. **Fase 1 - Escuchar**: Se reproduce una fracción (n/d) como patrón rítmico
2. **Fase 2 - Responder**: El usuario introduce numerador y denominador
3. **Fase 3 - Validación**: Se verifica la respuesta y da feedback
4. **Repetir**: 5-10 preguntas por nivel

### Niveles (4 niveles de complejidad)

#### Nivel 1: Fracciones Simples
- **Numerador**: 1
- **Denominador**: 2, 3, 4
- **Ejemplos**: 1/2, 1/3, 1/4
- **Preguntas**: 5
- **BPM**: 120

#### Nivel 2: Fracciones Medias
- **Numerador**: 1, 2
- **Denominador**: 2, 3, 4, 5, 6
- **Ejemplos**: 1/5, 2/3, 2/5
- **Preguntas**: 8
- **BPM**: 100

#### Nivel 3: Fracciones Complejas
- **Numerador**: 1, 2, 3
- **Denominador**: 2-8
- **Ejemplos**: 3/4, 2/7, 3/8
- **Preguntas**: 10
- **BPM**: 90

#### Nivel 4: Fracciones Avanzadas
- **Numerador**: 1-5
- **Denominador**: 2-12
- **Ejemplos**: 4/9, 5/12, 3/11
- **Preguntas**: 12
- **BPM**: 80

### Algoritmos

#### Generación de Fracciones
```javascript
function generateFraction(level) {
  const config = LEVEL_CONFIGS[level];
  const n = config.numerators[Math.floor(Math.random() * config.numerators.length)];
  const d = config.denominators[Math.floor(Math.random() * config.denominators.length)];

  // Asegurar fracción propia
  if (n >= d) return generateFraction(level);

  return { n, d };
}
```

#### Reproducción de Audio
```javascript
function playFraction(n, d, bpm) {
  const cycleDuration = (60000 / bpm) * 4; // 4 beats cycle
  const pulseInterval = cycleDuration / d;

  for (let i = 0; i < n; i++) {
    const time = i * pulseInterval;
    synth.playNote('C5', time, pulseInterval * 0.8);
  }

  // Play base rhythm
  for (let i = 0; i < d; i++) {
    const time = i * pulseInterval;
    synth.playNote('C4', time, pulseInterval * 0.2);
  }
}
```

### UI/UX

#### Pantalla de Juego
```html
<div class="fraction-game">
  <div class="question-number">Pregunta 3/10</div>

  <div class="listen-section">
    <button class="play-fraction">🔊 Escuchar</button>
    <div class="visual-feedback">
      <!-- Animación visual del ritmo -->
    </div>
  </div>

  <div class="input-section">
    <div class="fraction-input">
      <input type="number" id="numerator" min="1" max="12" />
      <div class="fraction-bar">―</div>
      <input type="number" id="denominator" min="2" max="12" />
    </div>
    <button class="submit-answer">Verificar</button>
  </div>

  <div class="feedback-section hidden">
    <!-- Muestra resultado -->
  </div>
</div>
```

#### Feedback Visual
- ✅ Correcto: Fondo verde, sonido de éxito
- ❌ Incorrecto: Muestra respuesta correcta, permite escuchar de nuevo
- 📊 Progreso: Barra superior mostrando preguntas completadas

### Validación
```javascript
function validateAnswer(userN, userD, correctN, correctD) {
  const correct = userN === correctN && userD === correctD;
  const accuracy = correct ? 100 : 0;

  return {
    correct,
    accuracy,
    feedback: correct ?
      '¡Correcto!' :
      `La respuesta era ${correctN}/${correctD}`,
    partialCredit: userN === correctN ? 50 : 0
  };
}
```

### Integración con Audio System
```javascript
// Usar el sistema de audio existente de App3
import { TimelineAudio } from '../../libs/sound/index.js';

class FractionPlayer {
  constructor(audio) {
    this.audio = audio;
  }

  async playFraction(n, d, bpm = 120) {
    const pattern = this.generatePattern(n, d);
    await this.audio.playPattern(pattern, bpm);
  }

  generatePattern(n, d) {
    // Crear patrón de pulsos para la fracción
    const pattern = new Array(d).fill(0);
    const interval = d / n;

    for (let i = 0; i < n; i++) {
      pattern[Math.floor(i * interval)] = 1;
    }

    return pattern;
  }
}
```

---

## 🔧 App4 - Crear Patrones Fraccionados

### Descripción General
El usuario debe crear patrones rítmicos que cumplan requisitos específicos.

### Mecánica del Juego
1. **Fase 1 - Requisito**: Se muestra el requisito (ej: "Crea un patrón con n=3, d=7")
2. **Fase 2 - Creación**: El usuario crea/modifica el patrón en una grilla
3. **Fase 3 - Validación**: Se verifica que el patrón cumple el requisito
4. **Feedback**: Se muestra si cumple o no, con sugerencias

### Niveles (4 niveles progresivos)

#### Nivel 1: Requisitos Simples
- **Tipo**: Numerador o denominador fijo
- **Ejemplos**:
  - "Crea un patrón con n=2"
  - "Crea un patrón con d=4"
- **Grilla**: 8 posiciones
- **Intentos**: Ilimitados

#### Nivel 2: Requisitos Específicos
- **Tipo**: Fracción exacta
- **Ejemplos**:
  - "Crea la fracción 3/4"
  - "Crea exactamente 5 pulsos"
- **Grilla**: 12 posiciones
- **Intentos**: 3 con hints

#### Nivel 3: Requisitos de Proporción
- **Tipo**: Proporciones y relaciones
- **Ejemplos**:
  - "Crea 3/4 del compás"
  - "Usa exactamente 75% del espacio"
- **Grilla**: 16 posiciones
- **Intentos**: 2 con hints

#### Nivel 4: Requisitos Complejos
- **Tipo**: Múltiples condiciones
- **Ejemplos**:
  - "Entre 5-8 pulsos, incluye posiciones 1,4,7"
  - "Patrón simétrico con n=4"
- **Grilla**: 16 posiciones
- **Intentos**: 1 con hint opcional

### Sistema de Requisitos

#### Tipos de Requisitos
```javascript
const REQUIREMENT_TYPES = {
  FIXED_N: 'fixed_numerator',
  FIXED_D: 'fixed_denominator',
  EXACT_FRACTION: 'exact_fraction',
  PULSE_COUNT: 'pulse_count',
  PROPORTION: 'proportion',
  POSITIONS: 'specific_positions',
  PATTERN_TYPE: 'pattern_type',
  MULTIPLE: 'multiple_conditions'
};
```

#### Generador de Requisitos
```javascript
function generateRequirement(level) {
  const templates = LEVEL_REQUIREMENTS[level];
  const template = templates[Math.floor(Math.random() * templates.length)];

  return {
    type: template.type,
    params: generateParams(template),
    description: formatDescription(template),
    validator: createValidator(template)
  };
}
```

### UI de Creación de Patrones

#### Grid Interactivo
```html
<div class="pattern-creator">
  <div class="requirement-display">
    <h3>Requisito:</h3>
    <p>Crea un patrón con 3/4 del compás ocupado</p>
  </div>

  <div class="pattern-grid">
    <!-- 16 celdas clickeables -->
    <div class="grid-cell" data-index="0"></div>
    <div class="grid-cell" data-index="1"></div>
    <!-- ... -->
  </div>

  <div class="pattern-info">
    <span>Pulsos activos: 5/16</span>
    <span>Proporción: 31.25%</span>
  </div>

  <div class="actions">
    <button class="clear-pattern">Limpiar</button>
    <button class="play-pattern">▶ Escuchar</button>
    <button class="get-hint">💡 Pista</button>
    <button class="submit-pattern">Verificar</button>
  </div>
</div>
```

#### Feedback Visual en Tiempo Real
```javascript
class PatternEditor {
  updateFeedback() {
    const activeCount = this.pattern.filter(p => p).length;
    const proportion = activeCount / this.pattern.length;

    // Actualizar indicadores
    this.updatePulseCount(activeCount);
    this.updateProportion(proportion);

    // Validación en tiempo real
    const meetsRequirement = this.validatePartial();
    this.highlightRequirement(meetsRequirement);
  }

  highlightRequirement(meets) {
    const element = document.querySelector('.requirement-display');
    element.classList.toggle('meets-requirement', meets);
    element.classList.toggle('missing-requirement', !meets);
  }
}
```

### Validación de Patrones

#### Sistema de Validación
```javascript
class PatternValidator {
  validate(pattern, requirement) {
    switch (requirement.type) {
      case 'EXACT_FRACTION':
        return this.validateFraction(pattern, requirement);
      case 'PROPORTION':
        return this.validateProportion(pattern, requirement);
      case 'POSITIONS':
        return this.validatePositions(pattern, requirement);
      default:
        return { valid: false, feedback: 'Requisito desconocido' };
    }
  }

  validateFraction(pattern, req) {
    const detected = this.detectFraction(pattern);
    const valid = detected.n === req.n && detected.d === req.d;

    return {
      valid,
      feedback: valid ?
        '¡Correcto!' :
        `Detectado: ${detected.n}/${detected.d}`,
      accuracy: this.calculateAccuracy(detected, req)
    };
  }

  detectFraction(pattern) {
    // Algoritmo para detectar la fracción del patrón
    const pulses = pattern.reduce((acc, val, i) => {
      if (val) acc.push(i);
      return acc;
    }, []);

    if (pulses.length === 0) return { n: 0, d: 1 };

    // Calcular intervalos y encontrar patrón
    // ... lógica de detección
  }
}
```

### Sistema de Hints

#### Generador de Pistas
```javascript
class HintSystem {
  generateHint(pattern, requirement) {
    const analysis = this.analyzePattern(pattern);
    const missing = this.findMissing(analysis, requirement);

    if (missing.pulseCount) {
      return `Necesitas ${missing.pulseCount} pulsos más`;
    }

    if (missing.positions) {
      return `Falta activar la posición ${missing.positions[0]}`;
    }

    if (missing.proportion) {
      return `Ajusta la proporción: ${missing.direction}`;
    }

    return 'Intenta con un patrón diferente';
  }

  showVisualHint(pattern, requirement) {
    // Resaltar posiciones sugeridas
    const suggested = this.suggestPositions(pattern, requirement);
    suggested.forEach(pos => {
      const cell = document.querySelector(`[data-index="${pos}"]`);
      cell.classList.add('hint-position');
    });
  }
}
```

### Integración con Sistema de Fracciones de App4

```javascript
// Reutilizar el editor de fracciones existente
import { createFractionEditor } from '../../libs/app-common/fraction-editor.js';

class PatternGameIntegration {
  constructor() {
    this.fractionEditor = createFractionEditor(container, {
      onChange: (fractions) => this.onFractionsChange(fractions)
    });
  }

  convertFractionToPattern(fraction) {
    // Convertir fracción n/d a patrón de pulsos
    const pattern = new Array(fraction.d).fill(0);
    const interval = fraction.d / fraction.n;

    for (let i = 0; i < fraction.n; i++) {
      pattern[Math.floor(i * interval)] = 1;
    }

    return pattern;
  }

  onFractionsChange(fractions) {
    // Actualizar patrón basado en fracciones
    const patterns = fractions.map(f => this.convertFractionToPattern(f));
    this.updateGamePattern(patterns);
  }
}
```

---

## 📊 Componentes Compartidos

### UI Components Reutilizables
- `GamePopup` - Popups de requisitos e instrucciones
- `ResultsScreen` - Pantalla de resultados con estrellas
- `RetryPopup` - Popup de reintentar con iconos
- `GameOverlay` - Sistema de overlay selectivo
- `CountInDisplay` - Cuenta regresiva 4-3-2-1

### Sistemas Base
- `BaseGameManager` - Lógica común de juegos
- `LevelSystem` - Sistema de niveles y progreso
- `PhaseManager` - Gestión de fases de juego
- `ValidationSystem` - Validación genérica
- `GameStateManager` - Persistencia de estado

### Estilos CSS
- `/libs/gamification/game-components/shared/styles/game-ui.css`
- Variables CSS para temas
- Animaciones (bounce, fade, pulse)
- Responsive design

---

## 🚀 Orden de Implementación

### Fase 1: App2 (3 horas)
1. [ ] Copiar estructura de App5/game/ a App2/game/
2. [ ] Adaptar levels-config.js para Lg/V
3. [ ] Modificar game-manager.js para usar parámetros de App2
4. [ ] Integrar con main.js existente
5. [ ] Testing de niveles 1-4

### Fase 2: App3 (4 horas)
1. [ ] Crear Apps/App3/game/ directory
2. [ ] Implementar FractionGame extendiendo FractionGameBase
3. [ ] Crear UI de input de fracciones
4. [ ] Implementar FractionPlayer para audio
5. [ ] Crear 4 niveles con configuraciones
6. [ ] Testing completo del flujo

### Fase 3: App4 (4 horas)
1. [ ] Crear Apps/App4/game/ directory
2. [ ] Implementar PatternGame extendiendo PatternGameBase
3. [ ] Crear grid interactivo de patrones
4. [ ] Implementar sistema de requisitos
5. [ ] Crear validadores específicos
6. [ ] Sistema de hints visuales
7. [ ] Testing de todos los tipos de requisitos

### Fase 4: Integración y Polish (2 horas)
1. [ ] Verificar consistencia de UI entre apps
2. [ ] Ajustar dificultad de niveles
3. [ ] Añadir transiciones y animaciones
4. [ ] Testing cross-browser
5. [ ] Documentación de usuario

---

## ⏱️ Estimación de Tiempo

| Tarea | Tiempo Estimado |
|-------|-----------------|
| App2 - Setup inicial | 1h |
| App2 - Adaptación de niveles | 1h |
| App2 - Testing | 1h |
| App3 - Estructura base | 1.5h |
| App3 - Sistema de fracciones | 1.5h |
| App3 - UI y audio | 1h |
| App4 - Estructura base | 1.5h |
| App4 - Grid de patrones | 1.5h |
| App4 - Validación y hints | 1h |
| Integración final | 2h |
| **TOTAL** | **13 horas** |

---

## 📝 Checklist de Tareas

### App2
- [ ] Copiar archivos base de App5
- [ ] Adaptar levels-config.js
- [ ] Modificar textos UI para "sucesión"
- [ ] Integrar con pulseSeqController
- [ ] Conectar con audio existente
- [ ] Test nivel 1
- [ ] Test nivel 2
- [ ] Test nivel 3
- [ ] Test nivel 4

### App3
- [ ] Crear estructura game/
- [ ] Implementar FractionGame.js
- [ ] Crear FractionGameUI.js
- [ ] Implementar FractionPlayer.js
- [ ] Configurar 4 niveles
- [ ] UI de input n/d
- [ ] Sistema de feedback
- [ ] Integración con audio
- [ ] Testing completo

### App4
- [ ] Crear estructura game/
- [ ] Implementar PatternGame.js
- [ ] Crear PatternGameUI.js
- [ ] Implementar PatternValidator.js
- [ ] Grid interactivo
- [ ] Sistema de requisitos
- [ ] Generador de hints
- [ ] Validación en tiempo real
- [ ] Testing de requisitos

### General
- [ ] Verificar imports de módulos
- [ ] Añadir comentarios JSDoc
- [ ] Crear README.md para cada app
- [ ] Actualizar GAMIFICATION_PROGRESS.md
- [ ] Testing final integrado

---

## 🎨 Mockups de UI

### App2 - Sucesión de Pulsos
```
┌─────────────────────────────────┐
│         Nivel 2 - Lg:4 V:3       │
├─────────────────────────────────┤
│                                  │
│     🔊 Escuchando patrón...      │
│                                  │
│     ● ○ ● ○                      │
│     1 2 3 4                      │
│                                  │
├─────────────────────────────────┤
│   Presiona ESPACIO en cada      │
│   pulso que escuches             │
│                                  │
│   [    Empezar Captura    ]      │
└─────────────────────────────────┘
```

### App3 - Adivinar Fracciones
```
┌─────────────────────────────────┐
│      Pregunta 3 de 10            │
├─────────────────────────────────┤
│                                  │
│     [🔊 Escuchar Fracción]       │
│                                  │
│     ┌───┐                        │
│     │ ? │                        │
│     ├───┤                        │
│     │ ? │                        │
│     └───┘                        │
│                                  │
│   [Verificar]  [Escuchar Otra Vez]│
└─────────────────────────────────┘
```

### App4 - Crear Patrones
```
┌─────────────────────────────────┐
│  Crea un patrón con n=3, d=8    │
├─────────────────────────────────┤
│                                  │
│  □ □ □ □ □ □ □ □ □ □ □ □ □ □ □ □ │
│  1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 │
│                                  │
│  Pulsos: 0/16  Proporción: 0%   │
│                                  │
├─────────────────────────────────┤
│ [Limpiar] [▶Play] [💡Pista]      │
│                                  │
│      [  Verificar Patrón  ]      │
└─────────────────────────────────┘
```

---

## 🔗 Referencias

### Archivos del Sistema Modular
- `/libs/gamification/game-components/shared/BaseGameManager.js`
- `/libs/gamification/game-components/rhythm-game/RhythmGameManager.js`
- `/libs/gamification/game-components/fraction-game/FractionGameBase.js`
- `/libs/gamification/game-components/pattern-game/PatternGameBase.js`

### Implementación de Referencia
- `/Apps/App5/game/` - Sistema completo funcionando

### Documentación
- `GAMIFICATION_PROGRESS.md` - Estado actual del desarrollo
- `MODULES.md` - Documentación de módulos

---

## 📚 Recursos Adicionales

### Fórmulas y Algoritmos
- **Cálculo de posiciones**: `position = (index * lg) / v`
- **Detección de fracción**: GCD de intervalos entre pulsos
- **Precisión rítmica**: Diferencia temporal / tolerancia
- **Proporción de patrón**: Pulsos activos / Total de posiciones

### Consideraciones de Performance
- Usar `requestAnimationFrame` para animaciones
- Debounce en validación en tiempo real
- Lazy loading de componentes de juego
- Cache de patrones generados

### Accesibilidad
- Soporte para teclado en todos los controles
- Feedback visual Y auditivo
- Textos descriptivos para screen readers
- Contraste adecuado en UI

---

*Documento creado: 2025-10-19*
*Última actualización: 2025-10-19*
*Estado: Listo para implementación*