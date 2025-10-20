# Documentación de Módulos Compartidos

Este documento describe la arquitectura de módulos compartidos del proyecto Lab, un monorepo enfocado en aplicaciones musicales basadas en ritmo y temporalidad.

## Tabla de Contenidos

- [Arquitectura General](#arquitectura-general)
- [Módulos Core (libs/)](#módulos-core-libs)
  - [notation](#libsnotation)
  - [sound](#libssound)
  - [cards](#libscards)
  - [ear-training](#libsear-training)
  - [guide](#libsguide)
  - [utils](#libsutils)
  - [random](#libsrandom)
  - [shared-ui](#libsshared-ui)
- [App-Common (libs/app-common/)](#app-common-libsapp-common)
  - [Audio & Timing](#audio--timing)
  - [UI Components](#ui-components)
  - [Notation & Rendering](#notation--rendering)
  - [Utils & Management](#utils--management)
  - [Controllers](#controllers)
- [Vendor (libs/vendor/)](#vendor-libsvendor)

---

## Arquitectura General

El proyecto Lab está organizado como un **monorepo con workspaces** para aplicaciones de ritmo musical. La estructura modular facilita la reutilización de código entre las diferentes Apps (App1-App4, SoundGrid).

```
/Users/workingburcet/Lab/
├── Apps/           # Aplicaciones individuales
├── libs/           # Módulos compartidos principales
│   ├── app-common/ # 43+ módulos compartidos entre apps
│   ├── notation/   # Renderizado musical
│   ├── sound/      # Motor de audio
│   ├── cards/      # Sistema de tarjetas interactivas
│   ├── ear-training/
│   ├── guide/
│   ├── utils/
│   ├── random/
│   ├── shared-ui/
│   └── vendor/     # Dependencias externas
└── packages/       # Paquetes adicionales
```

---

## Módulos Core (libs/)

### `libs/notation/`
**Ubicación:** `/Users/workingburcet/Lab/libs/notation/`

**Propósito:** Sistema de renderizado de notación musical basado en VexFlow 5.0.0

**Archivos principales:**
- `index.js` - Funciones principales de dibujo
- `helpers.js` - Utilidades de conversión MIDI y armaduras
- `pentagram.js` - Pentagramas SVG
- `rhythm-staff.js` - Notación rítmica con cursor de reproducción y soporte multi-voz

**Exports principales:**
- `drawInterval(container, note1, note2, mode, keySig, options)` - Renderiza intervalos en pentagrama simple o doble
- `drawKeySignature(container, scaleId, root)` - Dibuja armaduras de clave
- `drawPentagram()` - Pentagramas personalizados
- `createRhythmStaff()` - Sistema de notación rítmica interactivo con soporte para múltiples voces
- `needsDoubleStaff(n1, n2)` - Determina si se necesita pentagrama doble
- `midiToParts()`, `midiSequenceToChromaticParts()` - Conversión MIDI a notación

**Funcionalidades avanzadas de `rhythm-staff.js`:**
- **Sistema de múltiples voces**: Renderiza hasta 2 voces simultáneas usando VexFlow Voice API
- **Notas base layer (`showBaseLayer`)**: Permite notas persistentes que siempre son visibles (ej: downbeat en App5)
- **Ghost rests transparentes**: Mantiene timing correcto en voces secundarias sin afectar visualización
- **Notas invisibles**: Crea notas transparentes para evitar que rests oculten otras voces
- **Control de dirección de plica**: `setStemDirection()` para separación visual de voces
- **Casos de uso**:
  - App2: Notación rítmica básica (`pulseFilter: 'whole'`)
  - App5: Doble voz con downbeat D4 siempre visible + intervalos seleccionables en C5

**Dependencias:**
- VexFlow (libs/vendor/vexflow/)
- shared/scales.js (armaduras de clave)

---

### `libs/sound/`
**Ubicación:** `/Users/workingburcet/Lab/libs/sound/`

**Propósito:** Motor de audio completo con Tone.js, AudioWorklet y sistema de mixer

**Archivos principales:**
- `index.js` - TimelineAudio class y API principal
- `mixer.js` - AudioMixer para control de canales
- `sample-map.js` - Gestión de samples de audio
- `user-interaction.js` - Detección de interacción del usuario
- `tone-loader.js` - Carga lazy de Tone.js
- `timeline-processor.js` - AudioWorklet para timing preciso

**Exports principales:**
```javascript
// Clase principal
class TimelineAudio {
  async ready()
  async play(totalPulses, intervalSec, selectedPulses, loop, onPulse, onComplete, options)
  stop()
  setTempo(bpm, opts)
  setSelected(indices)
  tapTempo(nowMs, options)
  // ... más métodos
}

// Funciones globales
ensureAudio(), ensureAudioSilent()
setVolume(value), getVolume()
setMute(value), toggleMute(), isMuted()
getMixer(), subscribeMixer(listener)
setChannelVolume/Mute/Solo(channelId, value)
```

**Características:**
- **TimelineAudio:** Motor de reproducción con AudioWorklet
- **Mixer:** 3 canales (pulse, accent, subdivision) + master
- **Tap tempo:** Detección de BPM por tapping
- **Sample management:** Carga y caché de samples
- **User interaction:** Espera interacción antes de iniciar audio (evita warnings)
- **Scheduling:** LookAhead configurable (desktop/mobile presets)
- **Cycle support:** Subdivisiones y ciclos configurables

**Casos de uso:**
- Reproducción de pulsos rítmicos en todas las Apps
- Control de volumen por canal
- Tap tempo en tiempo real
- Sincronización visual-audio

**Dependencias:**
- Tone.js (libs/vendor/Tone.js)
- sample-map.js para configuración de sonidos

---

### `libs/cards/`
**Ubicación:** `/Users/workingburcet/Lab/libs/cards/`

**Propósito:** Sistema de tarjetas interactivas para manipulación de notas musicales

**Exports principales:**
```javascript
init(container, {
  notes, scaleLen, orientation,
  help, showIntervals, onChange,
  draggable, showShift, components
})
```

**Características:**
- Tarjetas drag-and-drop para reordenar notas
- Edición de intervalos en tiempo real
- Shift de octavas (▲/▼)
- Undo/Redo (5 niveles)
- Colores basados en pitch (chromatone-theory)
- Selección múltiple (Shift+click, long press)

**API retornada:**
```javascript
{
  getState(),
  rotateLeft(), rotateRight(),
  transpose(delta),
  undo(), redo()
}
```

**Casos de uso:**
- Editores de acordes y voicings
- Generadores de melodías
- Interfaces de transformación musical

**Dependencias:**
- shared/cards.js (lógica de transformaciones)
- chromatone-theory (colores de pitch)

---

### `libs/ear-training/`
**Ubicación:** `/Users/workingburcet/Lab/libs/ear-training/`

**Propósito:** Sistema de entrenamiento auditivo con niveles progresivos

**Export principal:**
```javascript
class EarTrainingGame {
  constructor(options)
  start(mode, level)
  generateQuestion()
  next()
  answer(value)
}
```

**Características:**
- 10 niveles de dificultad progresiva
- Modos: iS (sucesivo), iA (armónico)
- Sistema de repetición (retry on error)
- Intervalos ponderados (unísono/octava menos frecuentes)
- Historial de respuestas

**Niveles:**
1. Segundas disonantes
2. Terceras consonantes
3. Cuartas/quintas resonantes
4. Con tritono
5. Sextas consonantes
6. Séptimas disonantes
7. Extremos disonantes
8. Terceras y sextas
9. Mix disonante/consonante
10. Todos los intervalos

**Casos de uso:**
- Apps de entrenamiento auditivo
- Juegos de reconocimiento de intervalos

---

### `libs/gamification/`
**Ubicación:** `/Users/workingburcet/Lab/libs/gamification/`

**Propósito:** Sistema modular de gamificación para todas las Apps

**Archivos principales del core:**
- `event-system.js` - Sistema de eventos y tracking
- `scoring-system.js` - Cálculo de puntuaciones con multiplicadores
- `achievements.js` - Sistema de logros desbloqueables
- `storage.js` - Persistencia en localStorage con cola de sincronización
- `config.js` - Configuración centralizada por app
- `user-manager.js` - Gestión de usuario único
- `index.js` - GamificationManager y API principal

**Export principal:**
```javascript
class GamificationManager {
  init(appId)
  // Subsistemas accesibles:
  events, scoring, achievements, storage
}

// Funciones helper
initGamification(appId)
trackEvent(type, metadata)
trackAppAction(action, data)
recordAttempt(appId, level, accuracy, metadata)
```

**Características:**
- 18 tipos de eventos predefinidos
- 20 logros en 7 categorías
- 10 niveles de usuario con XP
- Multiplicadores por racha, tiempo, complejidad
- Sistema de puntos base configurables
- Persistencia local con fallback a memoria
- Preparado para sincronización futura con BD

**Casos de uso:**
- Tracking de práctica en todas las Apps
- Sistema de niveles y logros
- Análisis de progreso del usuario
- Motivación mediante rewards

**Integración en Apps:**
```javascript
// En gamification-adapter.js de cada app
import { initGamification, trackEvent } from '../../libs/gamification/index.js';

export function initApp5Gamification() {
  initGamification('app5');
  // Conectar eventos específicos...
}
```

---

### `libs/audio-capture/`
**Ubicación:** `/Users/workingburcet/Lab/libs/audio-capture/`

**Propósito:** Sistema de captura de ritmo por micrófono y teclado

**Archivos principales:**
- `microphone.js` - Captura con Tone.UserMedia y beat detection
- `keyboard.js` - Captura con tecla Space (con anti-rebote)
- `rhythm-analysis.js` - Análisis de precisión rítmica
- `index.js` - Exports unificados

**Exports principales:**
```javascript
// Captura de micrófono
class MicrophoneCapture {
  async initialize()
  startRecording(onBeatDetected)
  stopRecording() // Returns timestamps[]
  dispose()
}

// Captura de teclado
class KeyboardCapture {
  startRecording(onTapDetected)
  stopRecording() // Returns timestamps[]
}

// Análisis de ritmo
class RhythmAnalyzer {
  compareRhythm(recorded, expected) // Returns accuracy
  detectTempo(taps) // Returns BPM
  calculateConsistency(intervals)
  analyzeFreeRhythm(timestamps)
}

// Helpers
fractionsToTimestamps(fractions, bpm, lgMs)
generateExpectedPattern(lg, positions, bpm)
```

**Características:**
- Detección de beats en tiempo real
- Umbral de detección ajustable
- Anti-rebote configurable
- Captura combinada (mic + keyboard)
- Análisis de precisión con múltiples métricas
- Detección de BPM con nivel de confianza
- Emparejamiento inteligente de taps

**Casos de uso:**
- Ejercicios de ritmo en App5
- Tap tempo mejorado
- Validación de patrones rítmicos
- Análisis de improvisación

**Dependencias:**
- Tone.js (UserMedia, Meter)

---

### `libs/gamification/game-components/`
**Ubicación:** `/Users/workingburcet/Lab/libs/gamification/game-components/`

**Propósito:** Sistema modular de componentes reutilizables para crear juegos educativos de música. Arquitectura extensible que separa la lógica base de las mecánicas específicas de cada juego.

**Estructura:**
```
game-components/
├── shared/                     # Componentes base compartidos
│   ├── BaseGameManager.js     # Clase base para todos los juegos
│   ├── LevelSystem.js         # Sistema de niveles genérico
│   ├── PhaseManager.js        # Gestión de fases de juego
│   ├── ValidationSystem.js    # Validación de respuestas
│   ├── GameStateManager.js    # Estado y persistencia
│   ├── ui/                    # Componentes UI reutilizables
│   │   ├── GamePopup.js      # Popups de juego
│   │   └── ResultsScreen.js  # Pantalla de resultados
│   └── styles/
│       └── game-ui.css        # Estilos unificados
│
├── rhythm-game/               # Para App2 y App5
│   └── RhythmGameManager.js  # Gestión de juegos rítmicos
│
├── fraction-game/             # Para App3
│   └── FractionGameBase.js   # Base para reconocimiento de fracciones
│
└── pattern-game/              # Para App4
    └── PatternGameBase.js    # Base para creación de patrones
```

#### **Componentes Base Compartidos**

##### `BaseGameManager.js`
**Propósito:** Clase abstracta que proporciona toda la funcionalidad común para juegos

**API Principal:**
```javascript
class BaseGameManager {
  constructor(config) {
    // config: {
    //   appId: string,
    //   gameName: string,
    //   maxLevels: number,
    //   ui: Object,         // Opcional: UI handlers
    //   audioCapture: Object // Opcional: captura de audio
    // }
  }

  // Inicialización y ciclo de vida
  async init()                    // Inicializa el juego y carga progreso
  startGame()                      // Inicia nueva sesión de juego
  startLevel(levelNumber)          // Inicia un nivel específico
  startPhase(phaseNumber)          // Inicia una fase del nivel
  pauseGame() / resumeGame()      // Control de pausa
  endGame(completed)               // Finaliza el juego

  // Validación y puntuación
  validateAttempt(userInput, expected)  // Valida respuesta del usuario
  calculateScore(accuracy, timeSpent)   // Calcula puntuación
  calculateAccuracy(input, expected)    // Calcula precisión (0-100)

  // Progreso y niveles
  completeLevel()                  // Marca nivel como completado
  nextLevel()                      // Avanza al siguiente nivel
  restartLevel()                   // Reinicia nivel actual

  // Persistencia
  saveProgress()                   // Guarda progreso en localStorage
  loadProgress()                   // Carga progreso guardado
  resetProgress()                  // Borra todo el progreso

  // Eventos (para override)
  onLevelStart(level)             // Hook al iniciar nivel
  onLevelComplete(level, score)   // Hook al completar nivel
  onGameComplete(stats)           // Hook al completar juego
  onPhaseTransition(from, to)     // Hook al cambiar fase
}
```

**Ejemplo de uso (extendiendo la clase):**
```javascript
import { BaseGameManager } from './shared/BaseGameManager.js';

class MyCustomGame extends BaseGameManager {
  constructor() {
    super({
      appId: 'myGame',
      gameName: 'Mi Juego Musical',
      maxLevels: 4
    });
  }

  // Override métodos específicos
  getLevelConfig(levelNumber) {
    // Retorna configuración del nivel
  }

  executePhase(phaseNumber) {
    // Implementa lógica de cada fase
  }
}
```

##### `LevelSystem.js`
**Propósito:** Sistema genérico de gestión de niveles con unlocking progresivo

**API Principal:**
```javascript
class LevelSystem {
  constructor(maxLevels = 4, storageKey = 'gameLevels')

  // Consultas de estado
  getCurrentLevel()                // Nivel actual (1-maxLevels)
  isUnlocked(levelNumber)          // Si el nivel está desbloqueado
  isCompleted(levelNumber)         // Si el nivel fue completado
  getAllLevelsCompleted()          // Si todos están completados

  // Modificación de estado
  unlockLevel(levelNumber)         // Desbloquea un nivel
  completeLevel(levelNumber, score, stars) // Marca como completado
  resetLevel(levelNumber)          // Resetea un nivel específico
  resetAll()                       // Resetea todo el progreso

  // Navegación
  nextLevel()                      // Avanza al siguiente disponible
  previousLevel()                  // Retrocede al anterior

  // Estadísticas
  getProgress()                    // {completed, total, percentage, stars}
  getLevelStats(levelNumber)      // {completed, score, stars, attempts}
  getTotalStars()                  // Total de estrellas ganadas

  // Persistencia
  saveProgress()                   // Guarda en localStorage
  loadProgress()                   // Carga desde localStorage
}

// Helper para crear sistema estándar
export function createStandardLevelSystem(config = {}) {
  const system = new LevelSystem(4, config.storageKey);
  if (config.unlockAll) {
    for (let i = 1; i <= 4; i++) {
      system.unlockLevel(i);
    }
  }
  return system;
}
```

##### `PhaseManager.js`
**Propósito:** Gestiona las fases dentro de cada nivel (instrucción → ejecución → validación)

**API Principal:**
```javascript
class PhaseManager {
  constructor(config) {
    // config: {
    //   phases: Array<{name, duration?, canSkip?}>,
    //   onPhaseStart: Function,
    //   onPhaseEnd: Function,
    //   onAllPhasesComplete: Function
    // }
  }

  // Control de fases
  start()                          // Inicia desde la primera fase
  startPhase(phase)                // Inicia una fase específica
  nextPhase()                      // Avanza a la siguiente
  previousPhase()                  // Retrocede a la anterior
  skipToPhase(phaseIndex)          // Salta a una fase
  restartCurrentPhase()            // Reinicia fase actual

  // Estado
  getCurrentPhase()                // {index, name, startTime}
  getPhaseCount()                  // Total de fases
  isLastPhase()                    // Si es la última fase

  // Progreso
  getProgress()                    // {current, total, percentage}
  getPhaseStatistics()             // Estadísticas de cada fase

  // Control
  pause() / resume()               // Pausa/reanuda la fase actual
  reset()                          // Resetea todo el manager
}
```

**Ejemplo de configuración:**
```javascript
const phaseManager = new PhaseManager({
  phases: [
    { name: 'instruction', duration: 3000 },
    { name: 'listen', duration: 5000 },
    { name: 'capture', canSkip: false },
    { name: 'validation', duration: 2000 }
  ],
  onPhaseStart: (phase) => console.log(`Starting ${phase.name}`),
  onPhaseEnd: (phase, stats) => console.log(`Completed ${phase.name}`),
  onAllPhasesComplete: () => console.log('Level complete!')
});
```

##### `ValidationSystem.js`
**Propósito:** Sistema genérico de validación que soporta múltiples tipos de datos

**API Principal:**
```javascript
class ValidationSystem {
  constructor(config) {
    // config: {
    //   tolerance: number (0-1),     // Tolerancia para números
    //   strictMode: boolean,          // Validación estricta
    //   validators: Object            // Validadores custom
    // }
  }

  // Validación por tipo
  validateWithType(type, input, expected)  // Usa validador específico
  validateGeneric(input, expected)         // Auto-detecta tipo

  // Validadores específicos
  validateNumber(input, expected)          // Con tolerancia
  validateString(input, expected)          // Con similarity
  validateArray(input, expected)           // Elemento por elemento
  validateObject(input, expected)          // Campo por campo
  validateRhythm(inputTimestamps,         // Validación rítmica
                 expectedTimestamps,
                 toleranceMs)

  // Registro de validadores custom
  registerValidator(type, validator)       // validator: (input, expected) => result

  // Estadísticas
  getStatistics()                         // {total, correct, incorrect, avg}
  reset()                                  // Limpia historial
}

// Resultado de validación
{
  correct: boolean,      // Si es correcto
  accuracy: number,      // Precisión 0-100
  type: string,         // Tipo de validación
  details: Object       // Detalles específicos
}
```

**Ejemplo de validador custom:**
```javascript
validation.registerValidator('fraction', (input, expected) => {
  const inputFrac = parseFraction(input);
  const expectedFrac = parseFraction(expected);

  const correct = inputFrac.n === expectedFrac.n &&
                  inputFrac.d === expectedFrac.d;

  let accuracy = 0;
  if (inputFrac.n === expectedFrac.n) accuracy += 50;
  if (inputFrac.d === expectedFrac.d) accuracy += 50;

  return { correct, accuracy, type: 'fraction' };
});
```

##### `GameStateManager.js`
**Propósito:** Gestión completa del estado del juego con persistencia y undo/redo

**API Principal:**
```javascript
class GameStateManager {
  constructor(config) {
    // config: {
    //   storageKey: string,
    //   autoSave: boolean,
    //   autoSaveInterval: number,
    //   maxSnapshots: number
    // }
  }

  // Acceso al estado
  get(path)                        // Obtiene valor por path (dot notation)
  set(path, value)                 // Establece valor por path
  update(updates)                  // Actualización parcial (merge)
  getState()                       // Estado completo

  // Snapshots y undo/redo
  createSnapshot()                 // Crea snapshot del estado actual
  undo()                          // Deshace último cambio
  redo()                          // Rehace cambio deshecho
  canUndo() / canRedo()           // Si hay cambios para deshacer/rehacer

  // Persistencia
  saveState()                     // Guarda en localStorage
  loadState()                     // Carga desde localStorage
  clearState()                    // Limpia estado y storage

  // Observadores
  subscribe(listener)             // Escucha cambios de estado
  unsubscribe(listener)          // Deja de escuchar

  // Control
  startAutoSave()                // Inicia guardado automático
  stopAutoSave()                 // Detiene guardado automático
  dispose()                      // Limpia recursos
}
```

**Ejemplo de uso:**
```javascript
const gameState = new GameStateManager({
  storageKey: 'myGame_state',
  autoSave: true,
  autoSaveInterval: 5000
});

// Establecer valores
gameState.set('player.score', 100);
gameState.set('level.current', 2);

// Obtener valores
const score = gameState.get('player.score'); // 100

// Escuchar cambios
gameState.subscribe((newState, oldState) => {
  console.log('State changed:', newState);
});

// Undo/Redo
gameState.createSnapshot(); // Punto de restauración
gameState.set('player.lives', 3);
gameState.undo(); // Restaura snapshot
```

#### **Componentes UI**

##### `GamePopup.js`
**Propósito:** Sistema de popups reutilizable para mensajes, confirmaciones y requisitos

**API Principal:**
```javascript
class GamePopup {
  constructor(config) {
    // config: {
    //   containerId: string,
    //   className: string,
    //   animationDuration: number,
    //   backdropClose: boolean,
    //   autoClose: number
    // }
  }

  // Mostrar popups
  show(options)                    // Muestra popup genérico
  showMessage(message, title)     // Mensaje simple
  showConfirm(options)            // Returns Promise<boolean>
  showLevelRequirements(config)  // Requisitos del nivel
  showRetry(message, onRetry)    // Popup de reintentar

  // Control
  hide()                          // Oculta popup actual
  dispose()                       // Limpia recursos
}

// Opciones para show()
{
  title: string,
  content: string | HTMLElement,
  requirements: Array<string>,
  buttons: Array<{
    text: string,
    icon?: string,
    primary?: boolean,
    onClick: Function
  }>,
  autoClose?: number
}
```

**Ejemplo de uso:**
```javascript
const popup = new GamePopup();

// Mensaje simple
popup.showMessage('¡Nivel completado!', 'Excelente');

// Confirmación
const confirmed = await popup.showConfirm({
  title: '¿Salir del juego?',
  message: 'Tu progreso se guardará',
  confirmText: 'Salir',
  cancelText: 'Continuar'
});

// Requisitos de nivel
popup.showLevelRequirements({
  level: 2,
  title: 'Nivel 2: Patrones Medios',
  requirements: [
    'Crea 5 patrones diferentes',
    'Precisión mínima: 80%',
    'Tiempo límite: 2 minutos'
  ]
});
```

##### `ResultsScreen.js`
**Propósito:** Pantalla de resultados animada con estadísticas y acciones

**API Principal:**
```javascript
class ResultsScreen {
  constructor(config) {
    // config: {
    //   containerId: string,
    //   showConfetti: boolean,
    //   animationDuration: number,
    //   onContinue: Function,
    //   onRetry: Function,
    //   onExit: Function
    // }
  }

  // Mostrar resultados
  show(results)                    // Muestra pantalla de resultados
  hide()                          // Oculta pantalla
  dispose()                       // Limpia recursos
}

// Estructura de results
{
  level: number,
  score: number,
  accuracy: number,        // 0-100
  duration: number,        // en ms
  attempts: number,
  nextLevel: boolean,      // Si hay siguiente nivel
  customMessage?: string   // Mensaje personalizado
}
```

**Características visuales:**
- **Título dinámico:** Basado en rendimiento (Excelente/Muy bien/Bien hecho/Sigue practicando)
- **Estrellas:** 1-3 estrellas animadas según accuracy
- **Puntuación animada:** Contador incremental con easing
- **Estadísticas:** Grid con nivel, precisión, tiempo, intentos
- **Confetti:** Efecto para scores ≥80%
- **Botones contextuales:** Siguiente nivel (si accuracy ≥60%), Reintentar, Salir

#### **Componentes Específicos por Juego**

##### `rhythm-game/RhythmGameManager.js`
**Propósito:** Manager especializado para juegos de ritmo (Apps 2 y 5)

**API Principal:**
```javascript
class RhythmGameManager extends BaseGameManager {
  constructor(config)

  // Audio capture
  async initializeAudioCapture()  // Inicializa micrófono/teclado
  switchCaptureMode(mode)         // 'microphone' | 'keyboard'
  startCapture()                  // Inicia captura
  stopCapture()                   // Detiene y retorna timestamps

  // Configuración de niveles
  getLevelConfig(levelNumber)     // Config específica de ritmo
  setBPM(bpm)                    // Establece tempo
  setTolerance(ms)               // Tolerancia de timing

  // Generación de patrones
  generatePositions(config)       // Genera posiciones aleatorias

  // Validación
  validateRhythm(captured, expected, tolerance)
}

// Configuración de nivel típica
{
  name: 'Nivel 1',
  lg: 8,
  v: 60,
  bpm: 60,
  tolerance: 100,
  minPulses: 3,
  maxPulses: 5,
  phases: ['instruction', 'listen', 'capture', 'validation']
}
```

##### `fraction-game/FractionGameBase.js`
**Propósito:** Base para juegos de reconocimiento de fracciones (App3)

**API Principal:**
```javascript
class FractionGameBase extends BaseGameManager {
  constructor(config)

  // Generación
  generateRandomFraction()         // Genera fracción aleatoria según nivel
  simplifyFraction(n, d)          // Simplifica fracción

  // Audio
  async playFractionAudio(fraction) // Reproduce audio de fracción

  // Validación
  validateFractionAnswer(userAnswer, correctAnswer)
  calculateAccuracy(userAnswer, correctAnswer) // Parcial credit

  // UI
  getUserInput()                  // Obtiene n/d del usuario
  showFractionNotation(fraction)  // Muestra notación
}

// Niveles de dificultad
Level 1: n=1, d=2-4 (simples)
Level 2: n=1-2, d=2-6 (medias)
Level 3: n=1-3, d=2-8 (complejas)
Level 4: n=1-5, d=2-12 (avanzadas)
```

##### `pattern-game/PatternGameBase.js`
**Propósito:** Base para juegos de creación de patrones (App4)

**API Principal:**
```javascript
class PatternGameBase extends BaseGameManager {
  constructor(config)

  // Configuración
  getLevelConfig(levelNumber)     // Config con requisitos

  // Generación
  generateTargetPattern(requirement) // Genera patrón objetivo
  detectFraction(pattern)          // Detecta fracción en patrón

  // Requisitos
  getRequirementDescription(req)   // Descripción legible
  showHint()                      // Muestra pista

  // Validación
  validatePattern(userPattern, requirement)
  calculatePatternAccuracy(user, requirement, target)
}

// Tipos de requisitos
- fixed_n: Numerador fijo
- fixed_d: Denominador fijo
- specific_fraction: Fracción exacta
- total_pulses: Número de pulsos
- proportion: Proporción específica
- pattern_type: Tipo de patrón
```

#### **Estilos y Temas**

##### `shared/styles/game-ui.css`
**Propósito:** Sistema de estilos unificado para todos los componentes de juego

**Características:**
```css
/* Variables CSS personalizables */
:root {
  --game-primary: #667eea;
  --game-primary-dark: #764ba2;
  --game-success: #4CAF50;
  --game-error: #f44336;
  --game-backdrop: rgba(0, 0, 0, 0.6);
  /* ... más variables */
}

/* Clases principales */
.game-container        /* Contenedor principal */
.game-backdrop        /* Overlay de fondo */
.game-popup          /* Popups de juego */
.game-button         /* Botones con variantes */
.results-screen      /* Pantalla de resultados */
.level-badge        /* Badges de nivel */
.game-progress      /* Barras de progreso */
.count-in-overlay   /* Cuenta regresiva */

/* Animaciones predefinidas */
@keyframes fadeIn, fadeOut, slideIn, bounceIn,
           pulse, countPulse, star-appear, shake
```

**Responsive Design:**
- Breakpoint principal: 480px
- Ajuste automático de tamaños de fuente
- Grid adaptativo para estadísticas
- Botones y popups responsive

#### **Integración con Apps**

**Patrón de implementación:**
```javascript
// 1. Importar componentes necesarios
import { RhythmGameManager } from '../../libs/gamification/game-components/rhythm-game/RhythmGameManager.js';
import { GamePopup } from '../../libs/gamification/game-components/shared/ui/GamePopup.js';
import { ResultsScreen } from '../../libs/gamification/game-components/shared/ui/ResultsScreen.js';

// 2. Crear instancia del manager
const gameManager = new RhythmGameManager({
  appId: 'app5',
  gameName: 'Ritmo y Pulso',
  maxLevels: 4
});

// 3. Configurar UI
const popup = new GamePopup();
const results = new ResultsScreen({
  onContinue: () => gameManager.nextLevel(),
  onRetry: () => gameManager.restartLevel(),
  onExit: () => gameManager.endGame()
});

// 4. Inicializar
await gameManager.init();

// 5. Conectar eventos
gameManager.onLevelComplete = (level, score) => {
  results.show({
    level,
    score,
    accuracy: gameManager.getCurrentAccuracy(),
    duration: gameManager.getLevelDuration()
  });
};

// 6. Iniciar juego
gameManager.startGame();
```

**Estado actual:**
- ✅ **App5**: Implementación completa funcionando con 4 niveles
- 🚧 **App2**: Preparado para implementación (ver plan)
- 🚧 **App3**: Preparado para implementación (ver plan)
- 🚧 **App4**: Preparado para implementación (ver plan)

**Documentación adicional:**
- Ver `GAMIFICATION_IMPLEMENTATION_PLAN.md` para detalles de implementación
- Ver `GAMIFICATION_PROGRESS.md` para estado actual del proyecto

---

### `libs/guide/`
**Ubicación:** `/Users/workingburcet/Lab/libs/guide/`

**Propósito:** Tours guiados interactivos con Driver.js

**Exports principales:**
```javascript
createTour(steps, options) // Retorna función start()
startTour(steps, onEnd)     // Legacy wrapper
```

**Características:**
- Wrapper sobre Driver.js global
- Validación de elementos existentes
- Callbacks onEnd
- Progreso visible

**Casos de uso:**
- Onboarding de usuarios en Apps
- Tutoriales interactivos

**Dependencias:**
- Driver.js (cargado vía script tag global)

---

### `libs/utils/`
**Ubicación:** `/Users/workingburcet/Lab/libs/utils/`

**Propósito:** Utilidades matemáticas básicas

**Exports:**
```javascript
randInt(a, b)      // Entero aleatorio [a,b]
clamp(x, min, max) // Limitar a rango
wrapSym(n, m)      // Wrap simétrico alrededor de 0
```

**Casos de uso:**
- Generación aleatoria en todas las Apps
- Validación de rangos
- Cálculos modulares

---

### `libs/random/`
**Ubicación:** `/Users/workingburcet/Lab/libs/random/`

**Propósito:** Sistema de randomización con rangos configurables

**Exports:**
```javascript
DEFAULT_RANGES = {
  Lg: { min: 2, max: 30 },
  V: { min: 40, max: 320 },
  T: { min: 0.1, max: 10 }
}

randomize(ranges)
```

**Características:**
- Rangos por defecto para parámetros comunes (Lg, V, T)
- Soporte para enteros (Lg, V) y flotantes (T)
- Configuración flexible de rangos

**Casos de uso:**
- Botones de randomización en Apps
- Generación aleatoria de parámetros rítmicos

**Dependencias:**
- libs/utils (randInt)

---

### `libs/shared-ui/`
**Ubicación:** `/Users/workingburcet/Lab/libs/shared-ui/`

**Propósito:** Componentes UI compartidos y estilos

**Archivos:**
- `header.js` - Header común con controles de audio
- `sound-dropdown.js` - Selectores de sonido + Sistema P1 Toggle
- `hover.js` - Efectos hover
- `index.css` - Estilos base (incluye fix de slider-vertical)

**Características:**
- Estilos CSS consistentes entre Apps
- Componentes reutilizables
- Temas y variables CSS
- **Sistema P1 Toggle**: Control del sonido adicional en primer pulso

**Casos de uso:**
- Headers con controles de audio/volumen
- Dropdowns de selección de sonidos
- Estilos base de todas las Apps

#### Sistema P1 Toggle
**Ubicación:** `libs/shared-ui/sound-dropdown.js` (UI) + `libs/shared-ui/header.js` (coordinación) + `libs/app-common/mixer-menu.js` (control mixer)

**Propósito:** Sistema compartido para controlar el sonido adicional del primer pulso/intervalo (P1)

**Funcionalidad:**
- Checkbox en menú de opciones de header
- Control visual en mixer (botón ON/OFF sin slider)
- Persistencia automática en localStorage
- Sincronización bidireccional: checkbox ↔ mixer ↔ audio

**Comportamiento de audio:**
- **Activo** (checkbox marcado): P1 reproduce `pulso` (base) + `pulso0` (adicional) simultáneamente
- **Inactivo** (checkbox desmarcado): P1 reproduce solo `pulso` (como todos los demás)

**API en `sound-dropdown.js`:**
```javascript
initP1ToggleUI({
  checkbox: HTMLInputElement,      // El checkbox de P1
  startSoundRow: HTMLElement,      // Row del dropdown (opcional, se oculta/muestra)
  storageKey: 'p1Toggle',          // Key de localStorage
  onChange: (enabled) => void      // Callback cuando cambia
})
// Retorna: { getState: () => boolean, setState: (enabled: boolean) => void }
```

**API en `TimelineAudio` (libs/sound/index.js):**
```javascript
audio.setStartEnabled(boolean)  // Activa/desactiva sonido adicional en P1
audio.getStartEnabled()          // Retorna el estado actual
```

**Integración automática:**
- Apps con `useIntervalMode: true` en `template.js` obtienen el sistema automáticamente
- `header.js` detecta el checkbox `#startIntervalToggle` y lo conecta
- `mixer-menu.js` crea el control P1 si `window.__p1Controller` existe
- Nomenclatura: Apps 1-4 ("Pulso 1"), App5 ("Pulsación 1")

**Arquitectura de audio:**
- NO crea canal adicional en mixer (simplicidad)
- `pulso0` comparte canal `'pulse'` con resto de pulsos
- Flag interno `_startEnabled` en `TimelineAudio` controla reproducción
- Lógica en `libs/sound/index.js` líneas 1341-1356

**Casos de uso:**
- **App5**: Distinguir intervalos musicales (Pulsación 1 con sonido diferente)
- **Apps 1-4**: Enfatizar el downbeat (Pulso 1 con capa adicional)
- **Futuras apps**: Sistema listo para uso inmediato

---

## App-Common (libs/app-common/)

Conjunto de **43+ módulos** compartidos entre Apps, organizados en categorías funcionales.

### Audio & Timing

#### `audio-init.js`
**Propósito:** Inicialización estándar de audio con supresión de warnings

**Exports:**
```javascript
initAudio(options)
setupAudioWarningSuppress()
```

**Características:**
- Espera interacción del usuario
- Suprime warnings de AudioContext
- Configuración consistente entre Apps

---

#### `audio.js`
**Propósito:** Puentes de scheduling y eventos de audio compartidos

**Exports:**
```javascript
createSchedulingBridge(audioEngine, callbacks)
bindSharedSoundEvents(audioEngine, eventBus)
```

**Características:**
- Bridge entre TimelineAudio y UI
- Eventos compartidos de sonido
- Callbacks de pulso/ciclo

---

#### `audio-schedule.js`
**Propósito:** Cálculos de delay para resync con tap tempo

**Exports:**
```javascript
calculateResyncDelay(tapTimes, options)
```

---

#### `audio-toggles.js`
**Propósito:** Gestión de toggles de canales de audio

**Exports:**
```javascript
createAudioToggles(mixer, channels)
bindToggleUI(toggles, elements)
```

**Características:**
- Integración con mixer
- Estados de mute/solo por canal
- Sincronización UI-mixer

---

#### `loop-control.js`
**Propósito:** Controladores de loop compartidos

**Exports:**
```javascript
createLoopController(audioEngine, options)
createPulseMemoryLoopController(audioEngine, pulseSeq)
```

**Características:**
- Control de loop/one-shot
- Memoria de pulsos seleccionados
- Sincronización con TimelineAudio

---

#### `subdivision.js`
**Propósito:** Cálculos de subdivisión temporal

**Exports:**
```javascript
fromLgAndTempo(Lg, tempo)
gridFromOrigin(origin, Lg, V)
toPlaybackPulseCount(Lg, V, T)
```

**Características:**
- Conversión Lg/V/T a parámetros de reproducción
- Grid temporal desde origen
- Cálculo de pulsos de playback

---

#### `visual-sync.js`
**Propósito:** Sincronización visual-audio

**Exports:**
```javascript
createVisualSync(audioEngine, highlightController)
```

---

#### `simple-visual-sync.js`
**Propósito:** Versión simplificada de visual-sync

---

#### `timeline-layout.js`
**Propósito:** Renderizado de timeline circular/lineal (usado en App2)

**Exports:**
```javascript
createTimelineRenderer(options)
```

**Características:**
- Posicionamiento de pulsos
- Renderizado de números y barras
- Marcadores de ciclo
- T-indicator reveal scheduling
- Callbacks para layouts personalizados (targets en App2)

---

### UI Components

#### `fraction-editor.js`
**Propósito:** Editor de fracciones reutilizable con operaciones CRUD

**Exports:**
```javascript
createFractionEditor(container, options)
```

**Características:**
- CRUD completo de fracciones
- Validación de entrada
- Eventos onChange
- UI consistente

---

#### `pulse-seq.js`
**Propósito:** Controlador de secuencia de pulsos con selección drag

**Exports:**
```javascript
createPulseSeqController(container, options)
```

**Características:**
- Drag selection
- Memoria de selección
- Integración con audio
- Visual feedback

---

#### `pulse-seq-editor.js`
**Propósito:** Editor completo de pulse sequences

---

#### `pulse-seq-state.js`
**Propósito:** Estado de pulse sequences

---

#### `pulse-seq-parser.js`
**Propósito:** Parser de pulse sequences

---

#### `mixer-menu.js`
**Propósito:** Menú del mixer de audio

**Exports:**
```javascript
createMixerMenu(mixer, container)
```

---

#### `mixer-longpress.js`
**Propósito:** Interacción longpress para controles del mixer

---

#### `random-menu.js`
**Propósito:** Controles de randomización

---

#### `random-config.js`
**Propósito:** Configuración de randomización

---

#### `info-tooltip.js`
**Propósito:** Tooltips informativos

---

### Notation & Rendering

#### `rhythm.js`
**Propósito:** Funciones de ritmo musical

---

#### `fraction-notation.js`
**Propósito:** Notación de fracciones musicales

---

#### `notation-panel.js`
**Propósito:** Panel de notación

---

#### `notation-renderer.js`
**Propósito:** Renderizador de notación

---

#### `notation-utils.js`
**Propósito:** Utilidades de notación

---

#### `formula-renderer.js`
**Propósito:** Renderizado de fórmulas matemáticas/musicales

---

#### `circular-timeline.js`
**Propósito:** Timeline circular para visualización

---

#### `timeline-renderer.js`
**Propósito:** Renderizador de timeline

---

### Utils & Management

#### `dom.js`
**Propósito:** Utilidades DOM y binding de elementos

**Exports:**
```javascript
bindRhythmElements(elementIds)
// Retorna: { elements, leds, ledHelpers }
```

**Características:**
- Binding de elementos por ID
- Gestión de LEDs
- Helpers para setLedAuto/Active

---

#### `led-manager.js`
**Propósito:** Gestión de estado de LEDs

**Exports:**
```javascript
createLedManager()
setLedState(led, state)
getLedState(led)
```

---

#### `events.js`
**Propósito:** Utilidades de eventos estándar

**Exports:**
```javascript
bindEvent(element, event, handler)
createEventBus()
```

---

#### `preferences.js`
**Propósito:** Almacenamiento centralizado de preferencias

**Exports:**
```javascript
savePreference(key, value)
loadPreference(key, defaultValue)
factoryReset()
```

**Características:**
- localStorage wrapper
- Factory reset
- Valores por defecto

---

#### `template.js`
**Propósito:** Sistema de renderizado de templates de App

---

#### `app-init.js`
**Propósito:** Helper de inicialización unificada (deprecated, usar enfoque modular)

---

#### `number.js`
**Propósito:** Parsing seguro de números

**Exports:**
```javascript
safeParseInt(value, defaultValue)
safeParseFloat(value, defaultValue)
```

---

#### `number-utils.js`
**Propósito:** Utilidades numéricas adicionales

---

#### `range.js`
**Propósito:** Validación y clamping de rangos

**Exports:**
```javascript
validateRange(value, min, max)
clampToRange(value, min, max)
```

---

#### `utils.js`
**Propósito:** Utilidades matemáticas para UI

**Exports:**
```javascript
calculateFontSize(...)
calculateHitSize(...)
```

---

### Controllers

#### `highlight-controller.js`
**Propósito:** Control de highlighting de elementos

---

#### `simple-highlight-controller.js`
**Propósito:** Versión simplificada de highlight-controller

---

#### `t-indicator.js`
**Propósito:** Indicador de T (tiempo/tempo)

---

---

## Vendor (libs/vendor/)

### VexFlow 5.0.0
**Ubicación:** `libs/vendor/vexflow/`

Motor de renderizado de notación musical SVG

### Tone.js 15.x
**Ubicación:** `libs/vendor/Tone.js`

Síntesis Web Audio y timing

### chromatone-theory
**Ubicación:** `libs/vendor/chromatone-theory/`

Teoría musical y colores de pitch

**Exports principales:**
- `pitchColor(pitch)` - Color HSL para pitch class
- Escalas, acordes, cálculos

---

## Guía de Uso

### Importar módulos core:
```javascript
import { drawInterval } from '../../libs/notation/index.js';
import TimelineAudio from '../../libs/sound/index.js';
import { init as initCards } from '../../libs/cards/index.js';
```

### Importar desde app-common:
```javascript
import { bindRhythmElements } from '../../libs/app-common/dom.js';
import { initAudio } from '../../libs/app-common/audio-init.js';
import { createFractionEditor } from '../../libs/app-common/fraction-editor.js';
```

### Pattern típico de inicialización:
```javascript
import { initAudio } from '../../libs/app-common/audio-init.js';
import { bindRhythmElements } from '../../libs/app-common/dom.js';
import TimelineAudio from '../../libs/sound/index.js';

// Setup
await initAudio();
const { elements, leds, ledHelpers } = bindRhythmElements({
  inputLg: 'inputLg',
  inputV: 'inputV'
});

const audio = new TimelineAudio();
await audio.ready();

// Uso
audio.play(totalPulses, interval, selectedPulses, loop, onPulse);
```

---

## Referencias Cruzadas

### Audio Pipeline:
1. `audio-init.js` → Inicializa contexto
2. `sound/index.js` (TimelineAudio) → Motor principal
3. `audio.js` → Bridge a UI
4. `audio-toggles.js` → Controles de canal
5. `visual-sync.js` → Sincronización visual

### UI Flow:
1. `dom.js` → Bind elementos
2. `led-manager.js` → Estado de LEDs
3. `events.js` → Event handling
4. `fraction-editor.js` / `pulse-seq.js` → Editores específicos

### Notation Chain:
1. `notation/index.js` → Renderizado base
2. `notation/rhythm-staff.js` → Ritmos
3. `app-common/notation-renderer.js` → Integración con Apps
4. `app-common/formula-renderer.js` → Fórmulas

---

## Cobertura de Tests

El proyecto cuenta con **21 archivos de tests** que cubren los módulos más críticos de `libs/app-common/`.

### Tests Implementados

**Directorio `__tests__/`:**
1. ✅ `audio-schedule.test.js` - Cálculos de resync con tap tempo
2. ✅ `audio-toggles.test.js` - Toggles de canales de audio
3. ✅ `audio.test.js` - Bridges de scheduling
4. ✅ `circular-timeline.test.js` - Renderizado circular/lineal
5. ✅ `formula-renderer.test.js` - Renderizado de fórmulas
6. ✅ `fraction-editor.test.js` - Editor de fracciones
7. ✅ `fraction-notation.test.js` - Notación de fracciones
8. ✅ `info-tooltip.test.js` - Tooltips informativos
9. ✅ `loop-resize.test.js` - Resize de loops
10. ✅ `number-utils.test.js` - Utilidades numéricas
11. ✅ `pulse-seq-parser.test.js` - Parser de pulse sequences
12. ✅ `rhythm.test.js` - Funciones de ritmo
13. ✅ `simple-highlight-controller.test.js` - Highlighting
14. ✅ `simple-visual-sync.test.js` - Sincronización visual
15. ✅ `subdivision.test.js` - Cálculos de subdivisión
16. ✅ `t-indicator.test.js` - Indicador T
17. ✅ `tap-resync.test.js` - Tap tempo resync

**Root de `app-common/`:**
18. ✅ `audio-init.test.js` - Inicialización de audio
19. ✅ `loop-control.test.js` - Controladores de loop
20. ✅ `range.test.js` - Validación de rangos
21. ✅ `utils.test.js` - Utilidades matemáticas

### Ejecutar Tests

```bash
npm test
```

### Cobertura Actual
- **~50%** de módulos de `app-common` tienen tests
- Enfoque en módulos core y de lógica compleja
- Tests de UI pendientes (componentes interactivos)

---

## Estado del Refactoring (2025-10-08)

### Apps Refactorizadas

| App | Estado | Reducción | Módulos Integrados | Commits |
|-----|--------|-----------|-------------------|---------|
| **App1** | ✅ Completo | -93 líneas (-10.6%) | 3 módulos | 3 |
| **App2** | ✅ Completo | -281 líneas (-14.7%) | 10 módulos | 7 |
| **App4** | ✅ Completo | -250 líneas (-13.9%) | 4 módulos | 6 |
| **App3** | ✅ Completo | -118 líneas (-8.3%) | 4 módulos | 6 |

**Total reducción**: **-742 líneas** (-12.3% del código original)

### Módulos Creados Durante el Refactoring

#### Nuevos Módulos (2025-10-08)
1. `pulse-seq.js` - Controller de secuencias de pulsos
2. `pulse-seq-state.js` - Estado de sequences
3. `pulse-seq-parser.js` - Parser de sequences
4. `pulse-seq-editor.js` - Editor completo
5. `simple-highlight-controller.js` - Highlighting simplificado
6. `simple-visual-sync.js` - Visual sync simplificado
7. `info-tooltip.js` - Tooltips reutilizables
8. `t-indicator.js` - Indicador T

#### Módulos Mejorados
1. `timeline-layout.js` - Callbacks para layouts personalizados
2. `preferences.js` - Helpers `setupThemeSync()` y `setupMutePersistence()`
3. `fraction-editor.js` - Modos complex/simple con placeholders

### Patrones Establecidos

**Inicialización de Audio:**
```javascript
const initAudio = createRhythmAudioInitializer({
  getParams: () => ({ lg, v, t }),
  getAudio: () => audio
});
```

**Theme/Mute Persistence:**
```javascript
setupThemeSync({ select: themeSelect, storage: { load, save } });
setupMutePersistence({ getAudio: () => audio, storage: { load, save } });
```

**Info Tooltips:**
```javascript
const tooltip = createInfoTooltip({ className: 'hover-tip auto-tip-below' });
tooltip.show(content, anchor);
```

**T Indicator (CSS Positioning):**
```javascript
const tIndicatorController = createTIndicator();
tIndicatorController.updateText(`T: ${value}`);
// CSS controla posicionamiento, NO JavaScript
```

Ver [REFACTORING_SUMMARY.md](./REFACTORING_SUMMARY.md) para detalles completos del refactoring.

---

**Última actualización:** 2025-10-08
**Versión del documento:** 2.0
**Estado del repositorio:** ✅ Refactoring completo
