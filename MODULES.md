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
- `rhythm-staff.js` - Notación rítmica con cursor de reproducción

**Exports principales:**
- `drawInterval(container, note1, note2, mode, keySig, options)` - Renderiza intervalos en pentagrama simple o doble
- `drawKeySignature(container, scaleId, root)` - Dibuja armaduras de clave
- `drawPentagram()` - Pentagramas personalizados
- `createRhythmStaff()` - Sistema de notación rítmica interactivo
- `needsDoubleStaff(n1, n2)` - Determina si se necesita pentagrama doble
- `midiToParts()`, `midiSequenceToChromaticParts()` - Conversión MIDI a notación

**Casos de uso:**
- Renderizado de intervalos musicales en Apps de teoría
- Notación rítmica en App2 (`pulseFilter: 'whole'`)
- Armaduras de clave dinámicas

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
- `sound-dropdown.js` - Selectores de sonido
- `hover.js` - Efectos hover
- `index.css` - Estilos base (incluye fix de slider-vertical)

**Características:**
- Estilos CSS consistentes entre Apps
- Componentes reutilizables
- Temas y variables CSS

**Casos de uso:**
- Headers con controles de audio/volumen
- Dropdowns de selección de sonidos
- Estilos base de todas las Apps

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
