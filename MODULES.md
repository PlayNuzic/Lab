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

El proyecto Lab está organizado como un **monorepo con workspaces** para aplicaciones de ritmo musical. La estructura modular facilita la reutilización de código entre las diferentes Apps (App1-App8).

```
/Users/workingburcet/Lab/
├── Apps/           # Aplicaciones individuales
├── libs/           # Módulos compartidos principales
│   ├── app-common/ # 49 módulos compartidos entre apps (consolidado)
│   ├── notation/   # Renderizado musical (4 módulos)
│   ├── sound/      # Motor de audio (9 módulos)
│   ├── cards/      # Sistema de tarjetas interactivas (1 módulo)
│   ├── ear-training/ # Entrenamiento auditivo (6 módulos)
│   ├── guide/      # Tours guiados (1 módulo)
│   ├── utils/      # Utilidades matemáticas (2 módulos)
│   ├── random/     # Randomización (2 módulos)
│   ├── shared-ui/  # Componentes UI compartidos (4 módulos)
│   ├── gamification/ # Sistema de gamificación (7 core + 10 game-components)
│   ├── audio-capture/ # Captura de audio/ritmo (4 módulos)
│   └── vendor/     # Dependencias externas
└── packages/       # Paquetes adicionales
```

---

## Módulos Core (libs/)

### `libs/notation/`
**Ubicación:** `/Users/workingburcet/Lab/libs/notation/`

**Propósito:** Sistema de renderizado de notación musical basado en VexFlow 5.0.0

**Archivos principales (4 módulos):**
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

**Archivos principales (9 módulos):**
- `index.js` - TimelineAudio class y API principal
- `mixer.js` - AudioMixer para control de canales
- `sample-map.js` - Gestión de samples de audio
- `user-interaction.js` - Detección de interacción del usuario
- `tone-loader.js` - Carga lazy de Tone.js
- `timeline-processor.js` - AudioWorklet para timing preciso
- `index.test.js` - Tests del módulo principal
- `mixer.test.js` - Tests del mixer
- `tone-loader.test.js` - Tests del tone loader

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

**Archivos (1 módulo):**
- `index.js` - Sistema completo de tarjetas

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

**Archivos principales (6 módulos):**
- `index.js` - Export principal
- `count-in-controller.js` - Control de cuenta regresiva
- `exercise-definitions.js` - Definiciones de ejercicios
- `exercise-runner.js` - Ejecución de ejercicios
- `fraction-recognition.js` - Reconocimiento de fracciones
- `linked-exercise-manager.js` - Gestión de ejercicios enlazados

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

**Archivos principales del core (7 módulos):**
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

**Archivos principales (4 módulos):**
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

**Archivos (10 módulos):**

**Componentes Base Compartidos (5 módulos):**
- `shared/BaseGameManager.js` - Clase base para todos los juegos
- `shared/LevelSystem.js` - Sistema de niveles genérico
- `shared/PhaseManager.js` - Gestión de fases de juego
- `shared/ValidationSystem.js` - Validación de respuestas
- `shared/GameStateManager.js` - Estado y persistencia

**Componentes UI (2 módulos):**
- `shared/ui/GamePopup.js` - Popups de juego
- `shared/ui/ResultsScreen.js` - Pantalla de resultados

**Componentes Específicos por Juego (3 módulos):**
- `rhythm-game/RhythmGameManager.js` - Para App2 y App5
- `fraction-game/FractionGameBase.js` - Para App3
- `pattern-game/PatternGameBase.js` - Para App4

#### **BaseGameManager.js**
**Propósito:** Clase abstracta que proporciona toda la funcionalidad común para juegos

**API Principal:**
```javascript
class BaseGameManager {
  constructor(config)

  // Inicialización y ciclo de vida
  async init()
  startGame()
  startLevel(levelNumber)
  startPhase(phaseNumber)
  pauseGame() / resumeGame()
  endGame(completed)

  // Validación y puntuación
  validateAttempt(userInput, expected)
  calculateScore(accuracy, timeSpent)
  calculateAccuracy(input, expected)

  // Progreso y niveles
  completeLevel()
  nextLevel()
  restartLevel()

  // Persistencia
  saveProgress()
  loadProgress()
  resetProgress()

  // Eventos (para override)
  onLevelStart(level)
  onLevelComplete(level, score)
  onGameComplete(stats)
  onPhaseTransition(from, to)
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

**Archivos (1 módulo):**
- `index.js` - Wrapper de Driver.js

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

**Archivos (2 módulos):**
- `index.js` - Utilidades principales
- `index.test.js` - Tests

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

**Archivos (2 módulos):**
- `index.js` - Sistema de randomización
- `index.test.js` - Tests

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

**Archivos (4 módulos):**
- `header.js` - Header común con controles de audio y click-outside
- `sound-dropdown.js` - Selectores de sonido + Sistema P1 Toggle
- `hover.js` - Efectos hover
- `performance-audio-menu.js` - Menú de rendimiento de audio

**Características:**
- Estilos CSS consistentes entre Apps
- Componentes reutilizables
- Temas y variables CSS
- **Sistema P1 Toggle**: Control del sonido adicional en primer pulso
- **Click-outside integrado**: Cierre automático de menús al hacer click fuera

#### **Click-outside en header.js**
**Propósito:** Sistema integrado para cerrar menús al hacer click fuera de ellos

**Funcionalidad:**
- Tracking de eventos `pointerdown` para detectar clicks dentro/fuera
- Listeners de `focusout` para cerrar menús cuando pierden el foco
- Manejo inteligente de elementos no-focusables (li, etc.)
- Auto-limpieza de listeners al cerrar menú

**Implementación:**
```javascript
// En wireMenu():
let lastPointerDownInside = false;
const trackPointerDown = (event) => {
  lastPointerDownInside = detailsEl.contains(event.target);
};

const handleFocusOut = (e) => {
  const next = e.relatedTarget;
  if (!next && lastPointerDownInside) return; // click interno
  detailsEl.removeAttribute('open'); // cierra menú
};
```

**Casos de uso:**
- Headers con controles de audio/volumen
- Dropdowns de selección de sonidos
- Estilos base de todas las Apps
- Menús de opciones (click-outside)

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

Conjunto de **49 módulos** compartidos entre Apps, organizados en categorías funcionales.

**Última consolidación:** 2025-10-30 - pulse-seq-intervals.js consolidado en pulse-seq.js (-1 módulo, -502 líneas)

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

#### `tap-tempo-handler.js` ⭐ **NUEVO**
**Propósito:** Handler compartido de tap tempo con feedback visual

**Exports:**
```javascript
createTapTempoHandler({
  getAudioInstance,
  tapBtn,
  tapHelp,
  onBpmDetected,
  messages
})
```

**Características:**
- Manejo consistente de tap tempo entre apps
- Feedback visual de clicks restantes
- Mensajes personalizables
- Callbacks de BPM detectado
- Integración con TimelineAudio

**Ejemplo de uso:**
```javascript
const tapHandler = createTapTempoHandler({
  getAudioInstance: async () => audio,
  tapBtn: elements.tapBtn,
  tapHelp: elements.tapHelp,
  onBpmDetected: (bpm) => {
    inputV.value = Math.round(bpm);
    updateNumbers();
  }
});
tapHandler.attach();
```

**Apps migradas:** App1, App2, App3, App5

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

#### `pulse-seq.js` ⭐ **CONSOLIDADO**
**Propósito:** Controlador unificado de secuencia de pulsos con soporte para modos estándar e intervalos

**Exports:**
```javascript
// Default export: Standard mode
createPulseSeqController(options)

// Named exports:
createPulseSeqIntervalsController(options) // Convenience factory for App5
sanitizePulseSequence(text, lg)            // Interval validation
```

**Modos:**
- **Standard** (`markupVariant: 'default'`): "Pulsos ( 0 ... ) Lg" con pulse 0 (App2)
- **Intervals** (`markupVariant: 'intervals'`): "P ( ... ) Lg" sin pulse 0 (App5)

**Características:**
- Drag selection con pointer tracking
- Memoria de selección persistente
- Integración con audio y timeline
- Visual feedback con overlays animados
- Soporte para ambos formatos (pulsos e intervalos) en un solo módulo

**Cambio (2025-10-30):** Consolidado de pulse-seq.js + pulse-seq-intervals.js
- Eliminadas ~502 líneas de código duplicado (85% de duplicación)
- API compatible con ambas apps mediante markup variant
- Apps migradas: App5 ahora usa named exports del módulo unificado

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

#### `random-fractional.js`
**Propósito:** Randomización de fracciones

---

#### `info-tooltip.js`
**Propósito:** Tooltips informativos

---

#### `ui-helpers.js` ⭐ **NUEVO**
**Propósito:** Utilidades compartidas de inicialización de UI

**Exports:**
```javascript
initCircularTimelineToggle({ toggle, storage, onToggle, defaultValue })
initColorSelector({ selector, storage, cssVariable, onColorChange })
bindUnitVisibility({ input, unit })
bindUnitsVisibility(pairs)
```

**Características:**
- Inicialización de circular timeline toggle con persistencia
- Selector de color con sincronización CSS
- Binding de visibilidad de unidades (ms, s, Hz, etc.)
- Batch binding para múltiples pares input/unit

**Ejemplo de uso:**
```javascript
// Circular timeline toggle
const circularHelper = initCircularTimelineToggle({
  toggle: circularToggle,
  storage: { load, save },
  onToggle: (checked) => {
    circular = checked;
    renderTimeline();
  }
});

// Color selector
const colorHelper = initColorSelector({
  selector: colorInput,
  storage: { load, save },
  cssVariable: '--selection-color',
  onColorChange: (color) => console.log('Color:', color)
});

// Unit visibility
const unitHelper = bindUnitsVisibility([
  { input: inputLg, unit: unitLg },
  { input: inputV, unit: unitV },
  { input: inputT, unit: unitT }
]);
unitHelper.attachAll();
```

**Apps migradas:** App1, App2, App3, App5

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

#### `number-utils.js` ⭐ **MEJORADO**
**Propósito:** Utilidades numéricas con soporte de locale Catalán

**Exports:**
```javascript
createNumberFormatter(options)
parseNum(val)
formatNumber(n, decimals)
formatSec(n)
randomInt(min, max) // ⭐ NUEVO
```

**Características:**
- Parser de números con soporte Catalán (comma como decimal)
- Formatter con locale configurable
- **randomInt añadido**: Generación de enteros aleatorios en rango
- Manejo de múltiples formatos: "1.234,56" (CA), "1234.56" (estándar), "1,234.56" (US)

**Ejemplo de uso:**
```javascript
// Parsing con soporte multi-formato
parseNum('1.234,56')  // => 1234.56 (Catalán)
parseNum('1234.56')   // => 1234.56 (estándar)
parseNum('1,234.56')  // => 1234.56 (US)

// Formatting con locale
formatNumber(1234.56)     // => '1.234,56' (ca-ES)
formatSec(1234.56)        // => '1.234,56'

// Random int (nueva funcionalidad)
randomInt(1, 10)   // => 7
randomInt(40, 320) // => 156
```

**Apps migradas:** App1, App2, App3, App5

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

#### `pulse-selectability.js`
**Propósito:** Gestión de selectabilidad de pulsos

---

### Controllers

#### `highlight-controller.js`
**Propósito:** Control de highlighting de elementos

---

#### `highlight-interval.js`
**Propósito:** Highlighting de intervalos

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
import { createTapTempoHandler } from '../../libs/app-common/tap-tempo-handler.js';
import { randomInt } from '../../libs/app-common/number-utils.js';
```

### Pattern típico de inicialización:
```javascript
import { initAudio } from '../../libs/app-common/audio-init.js';
import { bindRhythmElements } from '../../libs/app-common/dom.js';
import TimelineAudio from '../../libs/sound/index.js';
import { createTapTempoHandler } from '../../libs/app-common/tap-tempo-handler.js';
import { initCircularTimelineToggle } from '../../libs/app-common/ui-helpers.js';

// Setup
await initAudio();
const { elements, leds, ledHelpers } = bindRhythmElements({
  inputLg: 'inputLg',
  inputV: 'inputV'
});

const audio = new TimelineAudio();
await audio.ready();

// Tap tempo
const tapHandler = createTapTempoHandler({
  getAudioInstance: async () => audio,
  tapBtn: elements.tapBtn,
  tapHelp: elements.tapHelp,
  onBpmDetected: (bpm) => {
    elements.inputV.value = Math.round(bpm);
    updateNumbers();
  }
});
tapHandler.attach();

// Circular timeline
const circularHelper = initCircularTimelineToggle({
  toggle: elements.circularToggle,
  storage: { load, save },
  onToggle: (checked) => {
    circular = checked;
    renderTimeline();
  }
});

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
5. `ui-helpers.js` → Inicialización de controles UI
6. `tap-tempo-handler.js` → Manejo de tap tempo

### Notation Chain:
1. `notation/index.js` → Renderizado base
2. `notation/rhythm-staff.js` → Ritmos
3. `app-common/notation-renderer.js` → Integración con Apps
4. `app-common/formula-renderer.js` → Fórmulas

---

## Cobertura de Tests

El proyecto cuenta con **27 test suites** y **280 tests** que cubren los módulos más críticos.

### Tests Implementados

**Directorio `libs/app-common/__tests__/` (18 archivos):**
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
12. ✅ `pulse-selectability.test.js` - Selectabilidad de pulsos
13. ✅ `rhythm.test.js` - Funciones de ritmo
14. ✅ `simple-highlight-controller.test.js` - Highlighting
15. ✅ `simple-visual-sync.test.js` - Sincronización visual
16. ✅ `subdivision.test.js` - Cálculos de subdivisión
17. ✅ `t-indicator.test.js` - Indicador T
18. ✅ `tap-resync.test.js` - Tap tempo resync

**Root de `libs/app-common/` (3 archivos):**
19. ✅ `audio-init.test.js` - Inicialización de audio
20. ✅ `loop-control.test.js` - Controladores de loop
21. ✅ `range.test.js` - Validación de rangos
22. ✅ `utils.test.js` - Utilidades matemáticas

**Otros módulos (6 archivos):**
23. ✅ `libs/sound/index.test.js` - TimelineAudio
24. ✅ `libs/sound/mixer.test.js` - AudioMixer
25. ✅ `libs/sound/tone-loader.test.js` - Tone loader
26. ✅ `libs/utils/index.test.js` - Utilidades matemáticas
27. ✅ `libs/random/index.test.js` - Sistema de randomización

### Ejecutar Tests

```bash
npm test
```

**Salida típica:**
```
Test Suites: 27 passed, 27 total
Tests:       280 passed, 280 total
```

### Cobertura Actual
- **54%** de módulos de `app-common` tienen tests (27 de 50)
- **100%** de módulos críticos de audio tienen tests
- Enfoque en módulos core y de lógica compleja
- Tests de UI pendientes (componentes interactivos avanzados)

---

## Estado del Refactoring (2025-10-30)

### Logros de Modularización

**Reducción total de código:** **~822 líneas eliminadas** (~18% del código original)

| Métrica | Antes (Oct 08) | Después (Oct 30) | Cambio |
|---------|----------------|------------------|--------|
| **Líneas de código** | ~4,000 | ~3,178 | -822 (-18%) |
| **Módulos compartidos** | 43 | 49 | +6 nuevos, -1 consolidado |
| **Apps migradas** | 0 | 4 (App1, 2, 3, 5) | +4 |
| **Cobertura de tests** | 24 suites | 27 suites | +3 |
| **Tests totales** | 265 | 280 | +15 |

**Fase 1 Consolidación (2025-10-30):**
- **pulse-seq-intervals.js → pulse-seq.js**: -502 líneas (85% duplicación eliminada)
- **Total eliminado en consolidación**: -502 líneas adicionales a los -320 de refactoring previo

### Apps Refactorizadas

| App | Estado | Reducción | Módulos Integrados | Fecha |
|-----|--------|-----------|-------------------|-------|
| **App1** | ✅ Completo | -93 líneas (-10.6%) | 3 nuevos | 2025-10-30 |
| **App2** | ✅ Completo | -85 líneas (-4.5%) | 3 nuevos | 2025-10-30 |
| **App3** | ✅ Completo | -72 líneas (-5.1%) | 3 nuevos | 2025-10-30 |
| **App5** | ✅ Completo | -70 líneas (-4.8%) | 3 nuevos | 2025-10-30 |
| **App4** | 🚧 Pendiente | - | - | - |

### Módulos Creados en el Refactoring

#### Nuevos Módulos (2025-10-30)
1. **`tap-tempo-handler.js`** - Handler compartido de tap tempo con feedback visual
   - Manejo consistente entre apps
   - Mensajes personalizables
   - Integración con TimelineAudio
   - Apps: App1, App2, App3, App5

2. **`ui-helpers.js`** - Utilidades de inicialización de UI
   - Circular timeline toggle con persistencia
   - Color selector con CSS sync
   - Unit visibility binding
   - Apps: App1, App2, App3, App5

3. **`number-utils.js`** (mejorado) - Añadido `randomInt()`
   - Parser multi-formato (CA, US, estándar)
   - Formatter con locale
   - Generación de enteros aleatorios
   - Apps: App1, App2, App3, App5

#### Módulos Consolidados (2025-10-30)
1. **`pulse-seq.js`** - Consolidación de pulse-seq.js + pulse-seq-intervals.js
   - Soporte unificado para modos estándar e intervalos
   - API mediante `markupVariant: 'default' | 'intervals'`
   - Named exports: `createPulseSeqIntervalsController`, `sanitizePulseSequence`
   - **Eliminadas 502 líneas** de código duplicado (85% duplicación)
   - Apps migradas: App5 (App2 ya usaba pulse-seq.js estándar)

#### Módulos Mejorados
1. **`header.js`** - Integración de click-outside
   - Cierre automático de menús al click fuera
   - Tracking inteligente de pointerdown
   - Auto-limpieza de listeners
   - Apps: Todas

### Módulos Anteriores (2025-10-08)
1. `pulse-seq.js` - Controller de secuencias de pulsos
2. `pulse-seq-state.js` - Estado de sequences
3. `pulse-seq-parser.js` - Parser de sequences
4. `pulse-seq-editor.js` - Editor completo
5. `simple-highlight-controller.js` - Highlighting simplificado
6. `simple-visual-sync.js` - Visual sync simplificado
7. `info-tooltip.js` - Tooltips reutilizables
8. `t-indicator.js` - Indicador T

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

**Tap Tempo Handler:**
```javascript
const tapHandler = createTapTempoHandler({
  getAudioInstance: async () => audio,
  tapBtn: elements.tapBtn,
  tapHelp: elements.tapHelp,
  onBpmDetected: (bpm) => {
    inputV.value = Math.round(bpm);
    updateNumbers();
  }
});
tapHandler.attach();
```

**UI Helpers:**
```javascript
// Circular timeline
const circularHelper = initCircularTimelineToggle({
  toggle: circularToggle,
  storage: { load, save },
  onToggle: (checked) => {
    circular = checked;
    renderTimeline();
  }
});

// Color selector
const colorHelper = initColorSelector({
  selector: colorInput,
  storage: { load, save },
  onColorChange: (color) => updateTheme(color)
});

// Unit visibility
const unitHelper = bindUnitsVisibility([
  { input: inputLg, unit: unitLg },
  { input: inputV, unit: unitV }
]);
unitHelper.attachAll();
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

### Beneficios Conseguidos

1. **Eliminación de duplicación:** ~320 líneas de código duplicado eliminadas
2. **Consistencia:** Comportamiento uniforme de tap tempo, UI helpers entre apps
3. **Mantenibilidad:** Cambios en un solo lugar se propagan a todas las apps
4. **Testabilidad:** Nuevos módulos facilitan testing aislado
5. **Reutilización:** Funcionalidad lista para futuras apps (App4, App6+)
6. **Click-outside integrado:** Menús más usables sin código adicional

Ver [REFACTORING_SUMMARY.md](./REFACTORING_SUMMARY.md) para detalles completos del refactoring.

---

**Última actualización:** 2025-10-30
**Versión del documento:** 3.1
**Estado del repositorio:** ✅ Consolidación Fase 1 completa
**Módulos totales:** 49 en app-common + 46 en otros libs = **95 módulos** (-1 desde v3.0)
**Cobertura de tests:** 27 suites, 280 tests pasando
**Próxima fase:** Ver CONSOLIDATION_PHASE2.md para plan de consolidaciones futuras
