# Documentación de Módulos Compartidos

Este documento describe la arquitectura de módulos compartidos del proyecto Lab, un monorepo enfocado en aplicaciones musicales basadas en ritmo y temporalidad.

## Tabla de Contenidos

- [Arquitectura General](#arquitectura-general)
- [Módulos Core (libs/)](#módulos-core-libs)
  - [pulse-seq](#libspulse-seq)
  - [matrix-seq](#libsmatrix-seq)
  - [musical-grid](#libsmusical-grid)
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
│   ├── app-common/ # 40 módulos compartidos entre apps (consolidado Fase 2)
│   ├── pulse-seq/  # Secuencias de pulsos (5 módulos: parser, state, editor, pulse-seq, index)
│   ├── matrix-seq/ # Editor N-P pairs (4 módulos: grid-editor, parser, index + tests)
│   ├── musical-grid/ # Visualización 2D grid (3 módulos: musical-grid, index, CSS + tests)
│   ├── interval-sequencer/ # Secuenciador de intervalos (6 módulos + tests) ⭐ NUEVO
│   ├── notation/   # Renderizado musical (9 módulos + rhythm-staff)
│   ├── random/     # Randomización (5 módulos: core, config, menu, fractional, index)
│   ├── sound/      # Motor de audio (9 módulos)
│   ├── cards/      # Sistema de tarjetas interactivas (1 módulo)
│   ├── ear-training/ # Entrenamiento auditivo (6 módulos)
│   ├── guide/      # Tours guiados (1 módulo)
│   ├── utils/      # Utilidades matemáticas (2 módulos)
│   ├── shared-ui/  # Componentes UI compartidos (4 módulos)
│   ├── gamification/ # Sistema de gamificación (7 core + 10 game-components)
│   ├── audio-capture/ # Captura de audio/ritmo (4 módulos)
│   └── vendor/     # Dependencias externas
└── packages/       # Paquetes adicionales
```

---

## Módulos Core (libs/)

### `libs/pulse-seq/` ⭐ **NUEVO SUB-PACKAGE (Fase 2)**
**Ubicación:** `/Users/workingburcet/Lab/libs/pulse-seq/`

**Propósito:** Sub-package consolidado para gestión de secuencias de pulsos

**Archivos principales (5 módulos):**
- `index.js` - Exports unificados del sub-package
- `pulse-seq.js` - Controladores principales (estándar e intervalos)
- `parser.js` - Parser y validación de secuencias (antes pulse-seq-parser.js)
- `state.js` - Gestión de estado (antes pulse-seq-state.js)
- `editor.js` - Editor de secuencias (antes pulse-seq-editor.js)

**Exports principales:**
```javascript
// Default export
export { default } from './pulse-seq.js';

// Named exports
export {
  createPulseSeqController,
  createPulseSeqIntervalsController,
  sanitizePulseSequence
} from './pulse-seq.js';

export {
  parseTokens,
  validateInteger,
  validateFraction,
  nearestPulseIndex,
  resolvePulseSeqGap,
  FRACTION_POSITION_EPSILON
} from './parser.js';

export { createPulseSeqStateManager } from './state.js';
export { createPulseSeqEditor, getMidpoints, normalizeGaps } from './editor.js';
```

**Características:**
- Imports consolidados: Un solo import desde `libs/pulse-seq/index.js`
- Soporte dual: Modo estándar (App2) y modo intervalos (App5)
- Parser robusto con validación de fracciones
- Estado persistente con memoria de selección

**Apps que lo usan:** App2, App4, App5

---

### `libs/matrix-seq/` ⭐ **NUEVO SUB-PACKAGE (Fase 2, 2025-01)**
**Ubicación:** `/Users/workingburcet/Lab/libs/matrix-seq/`

**Propósito:** Sistema completo para edición de pares Note-Pulse (N-P) con grid dinámico

**Archivos principales (4 módulos):**
- `index.js` - Exports unificados del sub-package
- `grid-editor.js` - Editor grid dinámico con columnas por pulso (945 líneas)
- `grid-editor.css` - Estilos compartidos (275 líneas)
- `parser.js` - Parser y validación de N-P pairs
- `README.md` - Documentación completa con ejemplos
- `__tests__/` - Tests completos (18 tests, todos pasando)

**Exports principales:**
```javascript
export { createGridEditor } from './grid-editor.js';
export {
  validateNote,
  validatePulse,
  parseNotes,
  parsePulses,
  autoCompletePulses,
  createPairs,
  decomposePairs
} from './parser.js';
```

**Características:**
- **Columnas dinámicas:** Una columna por pulso, creadas on-demand
- **Multi-voice:** Soporte polyphony/monophony
- **Auto-jump navigation:** 300ms delay permite entrada de dos dígitos
- **Auto-blur en P=7:** Cierra último pulso sin bloquear entrada de notas
- **Auto-merge duplicados:** Fusiona notas cuando se detectan pulsos duplicados
- **Auto-sort columns:** Reorganiza visualmente cuando cambia orden de pulsos
- **Keyboard navigation:** Flechas, Tab, Enter, Backspace
- **Range validation:** Tooltips contextuales para valores fuera de rango
- **Highlight support:** Sincronización visual durante playback
- **Responsive:** 4 breakpoints (desktop → mobile)

**Apps que lo usan:** App12

**Nivel de madurez:** 10/10 - Production-ready con CSS extraído y tests completos

---

### `libs/musical-grid/` ⭐ **NUEVO MODULE (Fase 2, 2025-01)**
**Ubicación:** `/Users/workingburcet/Lab/libs/musical-grid/`

**Propósito:** Visualización 2D de grids musicales con soundline, timeline y matriz interactiva

**Archivos principales (3 módulos):**
- `musical-grid.js` - Sistema grid completo (565 líneas)
- `musical-grid.css` - Estilos compartidos (357 líneas)
- `index.js` - Exports unificados
- `README.md` - Documentación completa con ejemplos de scroll
- `__tests__/` - Tests completos (26 tests, todos pasando)

**Exports principales:**
```javascript
export { createMusicalGrid } from './musical-grid.js';
```

**Características principales:**
- **Sistema grid completo:** Soundline (notas verticales), Timeline (pulsos horizontales), Matrix (celdas)
- **Soporte scroll:** Scroll horizontal/vertical opcional para grids grandes con ejes sincronizados
- **Celdas interactivas:** Click handlers, hover states, highlight para playback
- **Flexible layout:** Modo fillSpaces (celdas entre pulsos) o alineación directa
- **Custom formatters:** Etiquetas personalizadas de notas/pulsos
- **Responsive:** 4 breakpoints con resize automático
- **Theme support:** Compatible con light/dark theme
- **Auto-render:** Renderiza inmediatamente al crear

**Scroll mode features:**
- Sincronización automática entre matriz y ejes (vertical + horizontal)
- Scrollbars ocultos en ejes (solo visible en matriz)
- Contenedores interiores expandibles
- Tamaño de celda fijo en modo scroll
- Prevención de bucles infinitos con debouncing

**Configuration scroll:**
```javascript
const grid = createMusicalGrid({
  parent: container,
  notes: 24,
  pulses: 16,
  scrollEnabled: true,
  containerSize: { width: '100%', maxHeight: '70vh' },
  cellSize: { minWidth: 60, minHeight: 40 }
});
```

**Apps que lo usan:** App12

**Nivel de madurez:** 10/10 - Production-ready con scroll completo y tests

---

### `libs/interval-sequencer/` ⭐ **NUEVO MODULE (2025-11)**
**Ubicación:** `/Users/workingburcet/Lab/libs/interval-sequencer/`

**Propósito:** Sistema completo para secuenciación basada en intervalos musicales (iS-iT) con drag editing, visualización de barras temporales, y conversión pairs ↔ intervals.

**Archivos principales (6 módulos):**
- `index.js` - Exports unificados (52 líneas)
- `interval-controller.js` - Controlador principal orquestador (297 líneas)
- `interval-converter.js` - Conversión pairs ↔ intervals (264 líneas)
- `interval-drag-handler.js` - Sistema de drag para modificar iT (416 líneas)
- `interval-renderer.js` - Renderizado de iT-bars (239 líneas)
- `gap-filler.js` - Auto-inserción de silencios (130 líneas)
- `README.md` - Documentación completa
- `__tests__/` - Tests completos (113 tests, 5 suites)

**Exports principales:**
```javascript
// Controlador all-in-one
export { createIntervalSequencer } from './interval-controller.js';

// Componentes individuales
export { createIntervalDragHandler } from './interval-drag-handler.js';
export { createIntervalRenderer } from './interval-renderer.js';

// Utilidades de conversión
export { pairsToIntervals, buildPairsFromIntervals } from './interval-converter.js';

// Gap filler
export { fillGapsWithSilences, detectGaps, hasGaps } from './gap-filler.js';
```

**Características principales:**
- **Controlador unificado:** `createIntervalSequencer()` orquesta todos los componentes
- **Drag editing:** Modificación horizontal de iT mediante drag en grid
- **Renderer de barras:** Visualización de duraciones como barras horizontales
- **Gap filler:** Auto-inserción de silencios cuando hay huecos
- **Conversión bidireccional:** pairs ↔ intervals con validación
- **Semántica pulse=START:** La nota comienza en `pulse` y dura `temporalInterval` pulsos

**Ejemplo de uso:**
```javascript
import { createIntervalSequencer } from '../../libs/interval-sequencer/index.js';

const sequencer = createIntervalSequencer({
  musicalGrid,
  totalSpaces: 8,
  basePair: { note: 0, pulse: 0 },
  autoFillGaps: true,
  onIntervalsChange: (intervals, pairs) => { ... }
});

sequencer.setPairs(initialPairs);
const intervals = sequencer.getIntervals();
```

**Apps que lo usan:** App15

**Nivel de madurez:** 10/10 - Production-ready con 113 tests

---

### `libs/app-common/musical-plane.js` ⭐ **NUEVO (2024-11)**
**Ubicación:** `/Users/workingburcet/Lab/libs/app-common/musical-plane.js`

**Propósito:** Sistema modular para crear grids musicales 2D con alineación robusta basada en mediciones DOM

**API principal:**
```javascript
import { createMusicalPlane } from '../../libs/app-common/musical-plane.js';

const musicalPlane = createMusicalPlane({
  container: matrixContainer,
  verticalAxis: soundline,        // Cualquier eje vertical
  horizontalAxis: timelineAxis,   // Cualquier eje horizontal
  cellFactory: clickableCells,    // Factory para crear celdas
  fillSpaces: true,               // Celdas llenan espacios entre marcadores
  cellClassName: 'plane-cell'
});

musicalPlane.render();           // Renderiza el grid
musicalPlane.update();           // Actualiza posiciones (ej. resize)
musicalPlane.destroy();          // Limpia recursos
```

**Características clave:**
- **Posicionamiento matemático**: Calcula posiciones desde mediciones DOM reales, no porcentajes CSS
- **Composable**: Funciona con cualquier combinación de ejes vertical/horizontal
- **Responsive**: Auto-actualización con ResizeObserver
- **Sin hacks CSS**: No requiere height: 125% u otros trucos de alineación
- **Robusto**: Funciona perfectamente a 100%, 125%, 150%, 200% zoom

**Métodos:**
- `render()` - Crea y posiciona todas las celdas
- `update()` - Recalcula posiciones (después de resize)
- `clear()` - Elimina todas las celdas
- `destroy()` - Limpieza completa
- `getCellAt(vIndex, hIndex)` - Obtiene celda en posición específica
- `getRow(vIndex)` - Obtiene todas las celdas en una fila
- `getColumn(hIndex)` - Obtiene todas las celdas en una columna
- `highlightCell(vIndex, hIndex, className, duration)` - Highlight temporal

**Apps que lo usan:** App11 (El Plano)

---

### `libs/app-common/plane-cells.js` ⭐ **NUEVO (2024-11)**
**Ubicación:** `/Users/workingburcet/Lab/libs/app-common/plane-cells.js`

**Propósito:** Patrones factory para crear diferentes tipos de celdas interactivas

**Factories disponibles:**

#### `createClickableCellFactory(config)`
Celdas con feedback visual al hacer click
```javascript
const cellFactory = createClickableCellFactory({
  className: 'matrix-cell',
  highlightClass: 'highlight',
  highlightDuration: 500,
  createContent: (vIndex, hIndex) => document.createTextNode(`${vIndex},${hIndex}`),
  styles: { backgroundColor: 'rgba(255,255,255,0.1)' }
});
```

#### `createToggleCellFactory(config)`
Celdas con estado on/off (útil para secuenciadores)
```javascript
const toggleCells = createToggleCellFactory({
  className: 'toggle-cell',
  activeClass: 'active',
  defaultState: false,
  onToggle: (vIndex, hIndex, isActive) => console.log(`Cell ${vIndex},${hIndex}: ${isActive}`)
});
```

#### `createVelocityCellFactory(config)`
Celdas sensibles a la velocidad del click
```javascript
const velocityCells = createVelocityCellFactory({
  minVelocity: 0.1,
  maxVelocity: 1.0,
  onVelocityClick: (vIndex, hIndex, velocity) => playNote(midi, velocity)
});
```

#### `createDraggableCellFactory(config)`
Celdas con selección por arrastre
```javascript
const draggableCells = createDraggableCellFactory({
  selectedClass: 'selected',
  onSelectionChange: (selectedCells) => updatePattern(selectedCells)
});
```

**Apps que lo usan:** App11

---

### `libs/app-common/plane-adapters.js` ⭐ **NUEVO (2024-11)**
**Ubicación:** `/Users/workingburcet/Lab/libs/app-common/plane-adapters.js`

**Propósito:** Adaptadores para hacer componentes existentes compatibles con musical-plane

**Adaptadores disponibles:**

#### `createSoundlineVerticalAxis(soundline)`
Adapta soundline para usar como eje vertical (12 notas)

#### `createTimelineHorizontalAxis(pulses, container, fillSpaces)`
Adapta timeline para usar como eje horizontal

#### `createScaleVerticalAxis(scale, container)`
Crea eje vertical para escalas personalizadas

#### `createMeasureHorizontalAxis(measures, beatsPerMeasure, container)`
Crea eje horizontal basado en compases

#### `createCircularAxis(divisions, container)`
Crea eje circular/radial para layouts circulares

#### `createGridAxis(rows, cols, container)`
Crea grid combinado para layouts tipo drum pad

**Ejemplo de uso:**
```javascript
import { createSoundlineVerticalAxis, createTimelineHorizontalAxis } from './plane-adapters.js';

// Adaptar soundline existente
const verticalAxis = createSoundlineVerticalAxis(soundline);

// Crear eje horizontal para 9 pulsos
const horizontalAxis = createTimelineHorizontalAxis(9, timelineContainer, true);

// Usar con musical-plane
const plane = createMusicalPlane({
  container,
  verticalAxis,
  horizontalAxis,
  cellFactory
});
```

**Apps que lo usan:** App11

---

### `libs/notation/` ⭐ **CONSOLIDADO (Fase 2)**
**Ubicación:** `/Users/workingburcet/Lab/libs/notation/`

**Propósito:** Sistema completo de notación musical (renderizado + utilidades rítmicas)

**Archivos principales (9 módulos + rhythm-staff):**

**Renderizado VexFlow:**
- `index.js` - Funciones principales de dibujo (drawInterval, drawPentagram)
- `helpers.js` - Utilidades de conversión MIDI y armaduras
- `pentagram.js` - Pentagramas SVG personalizados
- `rhythm-staff.js` - Notación rítmica con cursor de reproducción y soporte multi-voz

**Utilidades Rítmicas (consolidadas desde app-common):**
- `fraction-notation.js` - Mapeo de fracciones a notación VexFlow (antes en app-common)
- `panel.js` - Controlador del panel de notación (antes notation-panel.js)
- `utils.js` - Utilidades de construcción de eventos (antes notation-utils.js)
- `renderer.js` - Renderer de notación para App4 (antes notation-renderer.js)
- `fraction-notation.test.js` - Tests del módulo de fracciones

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

### `libs/random/` ⭐ **CONSOLIDADO (Fase 2)**
**Ubicación:** `/Users/workingburcet/Lab/libs/random/`

**Propósito:** Sub-package completo de randomización (básica + configuración + UI + fracciones)

**Archivos (5 módulos):**
- `index.js` - Exports unificados del sub-package
- `core.js` - Función randomize() base (evita dependencias circulares)
- `config.js` - Gestión de configuración random (antes random-config.js en app-common)
- `menu.js` - UI de menús random (antes random-menu.js en app-common)
- `fractional.js` - Randomización de fracciones (antes random-fractional.js en app-common)
- `index.test.js` - Tests

**Exports principales:**
```javascript
// Core randomization
export { randomize, DEFAULT_RANGES } from './core.js';

DEFAULT_RANGES = {
  Lg: { min: 2, max: 30 },
  V: { min: 40, max: 320 },
  T: { min: 0.1, max: 10 }
}

// Configuration management
export { applyBaseRandomConfig, updateBaseRandomConfig } from './config.js';

// UI
export { mergeRandomConfig, initRandomMenu } from './menu.js';

// Fractional randomization
export { randomizeFractional } from './fractional.js';
```

**Características:**
- Imports consolidados: Un solo import desde `libs/random/index.js`
- Sin dependencias circulares (core.js aislado)
- Soporte completo para Apps con fracciones (App4)
- Persistencia de configuración
- Validación de rangos

**Casos de uso:**
- Botones de randomización en todas las Apps
- Configuración avanzada de rangos (App2, App3, App5)
- Randomización de patrones fraccionarios (App4)

**Apps que lo usan:** App1, App2, App3, App4, App5 (todas)

**Dependencias:**
- libs/utils (randInt)
- libs/app-common (number-utils, resolveRange)

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

Conjunto de **43 módulos** compartidos entre Apps, organizados en categorías funcionales.

**Última consolidación:** 2025-12-30 Fase 5
- **+3 nuevos módulos para N-iT:**
  - `grid-2d-sync-controller.js` - Sync bidireccional Grid 2D ↔ Editor
  - `interval-note-drag.js` - Drag handler para iT en grids 2D
  - `registry-playback-autoscroll.js` - Autoscroll vertical durante playback
- **App20 modularizada:** Reducción de 1823 → 1383 LOC (24%)

**Consolidación anterior:** 2025-10-30 Fase 2
- **Eliminados 9 módulos** movidos a sub-packages:
  - pulse-seq-parser.js, pulse-seq-state.js, pulse-seq-editor.js → `libs/pulse-seq/`
  - notation-panel.js, notation-utils.js, notation-renderer.js, fraction-notation.js → `libs/notation/`
  - random-config.js, random-menu.js, random-fractional.js → `libs/random/`
- **Consolidados 3 módulos**:
  - number.js + range.js → number-utils.js
  - simple-visual-sync.js → visual-sync.js
- **Total reducido:** -196 líneas, -12 archivos

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

#### `visual-sync.js` ⭐ **CONSOLIDADO (Fase 2)**
**Propósito:** Sincronización visual-audio unificada (simple + completa)

**Exports:**
```javascript
createVisualSyncManager(options)  // Modo completo con highlighting + notation
createSimpleVisualSync(options)   // Convenience factory para modo simple
```

**Características:**
- Detección automática de modo según config
- Modo simple: Solo callback onStepChange
- Modo completo: Highlighting + notation + resolution tracking
- Consolidado de simple-visual-sync.js (eliminado en Fase 2)

**Apps:** App1 (simple), App2 (simple), App3, App4 (completo), App5 (simple)

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

#### `pulse-seq.js` ⭐ **MOVIDO A SUB-PACKAGE**
**Ver:** [`libs/pulse-seq/`](#libspulse-seq--nuevo-sub-package-fase-2)

Todos los módulos de pulse-seq se movieron al sub-package `libs/pulse-seq/`:
- pulse-seq.js, pulse-seq-parser.js, pulse-seq-state.js, pulse-seq-editor.js
- Imports consolidados desde `libs/pulse-seq/index.js`

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

#### `random-*.js` ⭐ **MOVIDO A SUB-PACKAGE**
**Ver:** [`libs/random/`](#libsrandom--consolidado-fase-2)

Todos los módulos random se movieron al sub-package `libs/random/`:
- random-config.js, random-menu.js, random-fractional.js
- Imports consolidados desde `libs/random/index.js`

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

#### Módulos de notación ⭐ **MOVIDOS A SUB-PACKAGE**
**Ver:** [`libs/notation/`](#libsnotation--consolidado-fase-2)

Los siguientes módulos se movieron al sub-package `libs/notation/`:
- fraction-notation.js → `libs/notation/fraction-notation.js`
- notation-panel.js → `libs/notation/panel.js`
- notation-utils.js → `libs/notation/utils.js`
- notation-renderer.js → `libs/notation/renderer.js`

Imports consolidados desde `libs/notation/index.js`

---

#### `rhythm.js`
**Propósito:** Funciones de ritmo musical (permanece en app-common)

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

#### `number-utils.js` ⭐ **CONSOLIDADO (Fase 2)**
**Propósito:** Utilidades numéricas unificadas (parsing + formatting + math + range)

**Consolidado de:**
- `number.js` (parsing seguro, gcd, lcm, resolveRange)
- `range.js` (toNumber, toRange)
- `number-utils.js` original (parseNum, formatNumber, randomInt)

**Exports consolidados:**
```javascript
// PARSING - Safe number parsing
parsePositiveInt(value)
parseIntSafe(value)
parseFloatSafe(value)
toNumber(value, fallback)

// FORMATTING - Locale-aware (ca-ES)
createNumberFormatter(options)
parseNum(val)           // Soporta "1.234,56" (CA), "1234.56", "1,234.56" (US)
formatNumber(n, decimals)
formatSec(n)

// MATH UTILITIES
gcd(a, b)
lcm(a, b)
randomInt(min, max)

// RANGE UTILITIES
toRange(minValue, maxValue, defaults)
resolveRange(minInput, maxInput, fallbackRange, options)
resolveIntRange(minInput, maxInput, fallbackRange, options)
```

**Características:**
- **Un solo archivo** con todas las utilidades numéricas
- Parser multi-formato: "1.234,56" (CA), "1234.56" (estándar), "1,234.56" (US)
- Formatter con locale configurable (ca-ES)
- Math utilities: GCD/LCM para fracciones
- Range utilities: Validación, normalización, clamping
- Organizado por categorías (Parsing, Formatting, Math, Range)

**Ejemplo de uso:**
```javascript
// Parsing seguro
parseIntSafe('123')     // => 123
parsePositiveInt('-5')  // => null
toNumber('abc', 10)     // => 10 (fallback)

// Formatting locale-aware
parseNum('1.234,56')    // => 1234.56 (CA)
formatNumber(1234.56)   // => '1.234,56' (ca-ES)

// Math
gcd(12, 18)             // => 6
lcm(4, 6)               // => 12
randomInt(1, 10)        // => 7

// Range
toRange(5, 10)          // => {min: 5, max: 10}
resolveIntRange('5', '10', {min: 0, max: 100}) // => {min: 5, max: 10}
```

**Apps:** Todas (App1-5)

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

#### `grid-2d-sync-controller.js` ⭐ **NUEVO (2025-12)**
**Propósito:** Sincronización bidireccional entre Grid 2D (plano-modular) y Grid Editor

**Exports:**
```javascript
createGrid2DSyncController({
  grid,           // plano-modular instance
  gridEditor,     // createGridEditor instance
  getPairs,       // () => currentPairs
  setPairs,       // (pairs) => void
  config: {
    defaultRegistry,
    validateNoteRegistry,
    fillGapsWithSilences
  },
  onSyncComplete  // callback
})
```

**Métodos:**
- `syncGridFromPairs(pairs)` - Editor → Grid 2D sync
- `handleCellClick(rowData, colIndex, isSelected)` - Grid 2D → Editor sync
- `enableDragMode(enabled)` - Enable/disable drag dots
- `addDotsToAllCells()` - Add np-dots to cells
- `highlightDragRange(rowId, startPulse, endPulse)` - Highlight during drag
- `clearDragHighlight()` - Clear drag highlights
- `refreshDots()` - Restore dots after grid refresh
- `destroy()` - Cleanup

**Características:**
- Sincronización Editor → Grid 2D (loadSelection + duration highlights)
- Sincronización Grid 2D → Editor (click handlers)
- Gestión de dots para drag-to-create
- Duration highlighting para notas multi-pulse
- **Tests:** 30 tests en `__tests__/grid-2d-sync-controller.test.js`

**Apps:** App20

---

#### `interval-note-drag.js` ⭐ **NUEVO (2025-12)**
**Propósito:** Drag handler para modificar intervalos temporales (iT) en grids 2D

**Exports:**
```javascript
createIntervalNoteDragHandler({
  grid,           // plano-modular instance
  gridEditor,     // createGridEditor instance
  getPairs,
  setPairs,
  getTotalPulses, // () => number
  syncController, // Optional: grid-2d-sync-controller
  config: {
    defaultRegistry,
    monophonic: true
  },
  playNotePreview,  // (note, registry, iT) => void
  fillGapsWithSilences
})
```

**Métodos:**
- `attach()` - Start listening for drag events
- `detach()` - Stop listening
- `isDragging()` - Check if drag active
- `isFromDrag()` - Check if update came from drag (prevent loops)
- `cancelDrag()` - Cancel active drag
- `destroy()` - Cleanup

**Características:**
- Modo CREATE: Drag on empty cell → create new note
- Modo EDIT: Drag on existing note → modify iT
- Monophonic: Cuts overlapping notes
- Visual feedback during drag
- Audio preview on drag end
- **Tests:** 25 tests en `__tests__/interval-note-drag.test.js`

**Apps:** App20

---

#### `registry-playback-autoscroll.js` ⭐ **NUEVO (2025-12)**
**Propósito:** Autoscroll vertical durante playback basado en registros de notas

**Exports:**
```javascript
createRegistryAutoscrollController({
  grid,           // plano-modular instance with setRegistry
  getSelectedArray, // () => selected items
  config: {
    minRegistry,
    maxRegistry,
    notesPerRegistry,
    visibleRows,
    zeroPosition,
    smoothScroll
  }
})
```

**Métodos:**
- `buildPulseRegistryMap()` - Pre-calculate pulse → registry map
- `scrollToRegistryForPulse(pulse, map)` - Scroll during playback
- `getRegistryForPulse(pulse, map)` - Get registry without scrolling
- `scheduleAnticipatedScroll(nextPulse, map, delayMs, isPlayingCheck)` - Anticipatory scroll
- `scrollToRegistry(registry, animated)` - Manual scroll
- `getVisibleRegistriesForNote(note, registry)` - Get visible registries

**Características:**
- Calcula registros óptimos para cada pulse durante playback
- Scroll anticipado (75% del beat anterior)
- Smooth scrolling configurable
- **Tests:** 26 tests en `__tests__/registry-playback-autoscroll.test.js`

**Apps:** App20

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

El proyecto cuenta con **60 test suites** y **1168 tests** que cubren los módulos más críticos.

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

**Reducción total de código:** **~1,018 líneas eliminadas** (~22% del código original)

| Métrica | Antes (Oct 08) | Después Fase 1 (Oct 30) | Después Fase 2 (Oct 30) | Cambio Total |
|---------|----------------|-------------------------|-------------------------|--------------|
| **Líneas de código** | ~4,000 | ~3,178 | ~2,982 | -1,018 (-22%) |
| **Módulos en app-common** | 43 | 49 | 40 | -3 |
| **Sub-packages** | 5 | 5 | 8 | +3 nuevos |
| **Apps migradas** | 0 | 4 (App1, 2, 3, 5) | 5 (todas) | +5 |
| **Cobertura de tests** | 24 suites | 27 suites | 27 suites | +3 |
| **Tests totales** | 265 | 280 | 280 | +15 |

**Fase 1 Consolidación (2025-10-30 AM):**
- **pulse-seq-intervals.js → pulse-seq.js**: -502 líneas (85% duplicación eliminada)
- **Total eliminado**: -502 líneas adicionales a los -320 de refactoring previo

**Fase 2 Consolidación (2025-10-30 PM):**
- **Session 1.1**: Visual-sync consolidation (-80 líneas)
  - simple-visual-sync.js → visual-sync.js
- **Session 2**: Number modules consolidation (-116 líneas, CRITICAL)
  - number.js + range.js → number-utils.js
- **Session 3.1**: pulse-seq sub-package (4 archivos reorganizados)
  - pulse-seq-parser.js, pulse-seq-state.js, pulse-seq-editor.js → libs/pulse-seq/
- **Session 3.2**: notation sub-package (4 archivos reorganizados)
  - fraction-notation.js, notation-panel.js, notation-utils.js, notation-renderer.js → libs/notation/
- **Session 3.3**: random sub-package (3 archivos reorganizados)
  - random-config.js, random-menu.js, random-fractional.js → libs/random/
- **Bug fixes**: Circular dependency fix + fraction-selection.js update
- **Total Fase 2**: -196 líneas, -12 archivos en app-common, +3 sub-packages consolidados

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

**Última actualización:** 2025-11-25
**Versión del documento:** 5.0 (interval-sequencer module)
**Estado del repositorio:** ✅ Consolidación Fase 1, 2 y módulo interval-sequencer completos
**Módulos en app-common:** 40 (era 49, reducido en -9)
**Sub-packages:** 9 (pulse-seq, matrix-seq, musical-grid, interval-sequencer, notation, random, sound, shared-ui, gamification)
**Módulos totales:** 40 en app-common + 65 en sub-packages = **105 módulos** (+6 desde v4.0)
**Cobertura de tests:** 41 suites, 584 tests pasando ✅ (+113 tests de interval-sequencer)
**Nuevo módulo:** `libs/interval-sequencer/` - Sistema de secuenciación de intervalos (6 módulos, 113 tests)
