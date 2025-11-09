# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🚨 PROCEDIMIENTOS CRÍTICOS - LEER SIEMPRE PRIMERO

### 1. Ubicación del Repositorio
**SIEMPRE trabajamos en el repositorio Lab**: `/Users/workingburcet/Lab/`
- Verifica que estás en el directorio correcto antes de cualquier operación
- Todas las rutas son relativas a `/Users/workingburcet/Lab/`

### 2. Sistema de Agentes
**Claude Code tiene agentes especializados nativos disponibles:**
- Usa `@.claude-code/agents-context.md` para ver los 6 agentes disponibles
- Los agentes son: UI, Audio, Responsive, Modules, Creator, Gamification
- Invoca agentes según la tarea específica para mejor rendimiento

### 3. Gestión de Seguimiento entre Sesiones
**OBLIGATORIO para tareas que no se completen en un prompt:**

#### Al NO completar una tarea:
1. **CREAR/ACTUALIZAR** archivo de seguimiento: `SESSION_STATE.md` en la raíz del proyecto
2. **Contenido mínimo**:
   ```markdown
   # Estado de Sesión - [Fecha]

   ## Tarea Actual
   [Descripción breve de qué se está haciendo]

   ## Estado
   - [x] Completado
   - [ ] Pendiente

   ## Próximos Pasos
   1. [Paso siguiente específico]
   2. [Paso siguiente específico]

   ## Notas Importantes
   - [Decisiones técnicas tomadas]
   - [Problemas encontrados]
   - [Archivos modificados]
   ```

#### Al COMPLETAR una tarea:
1. **ELIMINAR** el archivo `SESSION_STATE.md` (si existe)
2. **LIMPIAR** cualquier archivo temporal de seguimiento

### 4. Orden de Actualización al Finalizar
**SIEMPRE en este orden:**

1. **PRIMERO**: Actualizar documento de seguimiento (`SESSION_STATE.md`)
2. **SEGUNDO**: Resumir la conversación al usuario

**NUNCA al revés** - el seguimiento debe estar actualizado ANTES del resumen.

## Development Commands

### Setup and Environment
- **Initial setup**: `./setup.sh` - Run once per session to install dependencies and configure Git
- **Run tests**: `npm test` - Execute Jest test suite (33 test suites, 406 tests)
- **Run specific test**: `npm test -- --testNamePattern="test name"`
- **Run module tests**: `npm test -- --testPathPattern="(grid-editor|musical-grid)"`

## Project Architecture

This is a **monorepo** with **workspaces** for rhythm-based musical applications. The project focuses on temporal formulas, rhythmic fractions, and audio timing patterns.

### High-Level Structure
- **Apps/**: Individual rhythm applications (App1-App12)
- **libs/**: Modular libraries for shared functionality
  - **app-common/** - 40 core modules (Fase 2 consolidation)
  - **pulse-seq/** - Pulse sequence sub-package (5 modules)
  - **matrix-seq/** - Note-Pulse grid editor (4 modules) ⭐ **NUEVO (2025-01)**
  - **musical-grid/** - 2D musical grid visualization (3 modules) ⭐ **NUEVO (2025-01)**
  - **notation/** - VexFlow rendering (9 modules)
  - **random/** - Randomization sub-package (5 modules)
  - **sound/** - Audio engine (9 modules)
  - **shared-ui/** - UI components (4 modules)
  - **gamification/** - Achievement system (17 modules)
  - **audio-capture/** - Audio/rhythm capture (4 modules)
- **packages/**: Additional workspace packages
- **.claude-code/**: Agent configurations and context

### Core Libraries (`libs/`)

#### **`libs/app-common/`** - Shared App Logic (40 modules after Fase 2)
**Consolidado en Fase 2:** Reducido de 49 a 40 módulos (-9 movidos a sub-packages)

Core initialization and management:
- **`audio-init.js`**: Standardized audio initialization with warning suppression
- **`app-init.js`**: Unified app initialization helper (deprecated in favor of modular approach)
- **`dom.js`**: DOM utilities and element binding with LED support
- **`led-manager.js`**: LED state management for rhythm parameters
- **`preferences.js`**: Centralized preference storage with factory reset support
- **`template.js`**: App template rendering system

Audio and timing:
- **`audio.js`**: Audio scheduling bridges and shared sound events (`createSchedulingBridge`, `bindSharedSoundEvents`)
- **`audio-schedule.js`**: Tap tempo resync delay calculations
- **`audio-toggles.js`**: Audio channel toggle management with mixer integration
- **`loop-control.js`**: Shared loop controllers (`createLoopController`, `createPulseMemoryLoopController`)
- **`subdivision.js`**: Temporal subdivision calculations (`fromLgAndTempo`, `gridFromOrigin`, `toPlaybackPulseCount`)
- **`timeline-layout.js`**: Timeline rendering utilities for circular/linear layouts (used in App2)
  - `createTimelineRenderer()`: Manages pulse positioning, numbers, bars, and cycle markers
  - Callbacks for custom layouts (e.g., pulse hit targets in App2)
  - Handles T-indicator reveal scheduling and number font sizing
- **`visual-sync.js`**: Visual-audio synchronization (consolidado: simple + completo)

UI components and interaction:
- **`fraction-editor.js`**: Reusable fraction editing components with full CRUD operations
- **`mixer-menu.js`**: Audio mixer menu functionality with longpress support
- **`mixer-longpress.js`**: Longpress interaction for mixer controls
- **`tap-tempo-handler.js`**: Tap tempo handler with visual feedback

Utilities:
- **`number-utils.js`**: Número utilities consolidadas (parsing + formatting + math + range)
  - Consolidado en Fase 2: Merged number.js + range.js
- **`events.js`**: Standardized event binding utilities
- **`utils.js`**: Math utilities (font size, hit size calculations)

#### **`libs/pulse-seq/`** - Pulse Sequence Sub-Package ⭐ **NUEVO (Fase 2)**
Creado en consolidación Fase 2 - Sistema completo de secuencias de pulsos
- **`index.js`**: Exports unificados
- **`pulse-seq.js`**: Controladores principales (estándar + intervalos)
- **`parser.js`**: Parser y validación (antes pulse-seq-parser.js en app-common)
- **`state.js`**: Gestión de estado (antes pulse-seq-state.js en app-common)
- **`editor.js`**: Editor completo (antes pulse-seq-editor.js en app-common)

**Import:** `import { createPulseSeqController } from '../../libs/pulse-seq/index.js'`

#### **`libs/notation/`** - Notation Sub-Package ⭐ **CONSOLIDADO (Fase 2)**
Consolidado en Fase 2 - VexFlow rendering + utilidades rítmicas
- **`index.js`**: Exports unificados + drawInterval, drawPentagram
- **`rhythm-staff.js`**: VexFlow-based rhythm notation
- **`fraction-notation.js`**: Fraction mapping (movido desde app-common)
- **`panel.js`**: Panel controller (movido desde app-common)
- **`utils.js`**: Event building (movido desde app-common)
- **`renderer.js`**: Notation renderer (movido desde app-common)

**Import:** `import { createRhythmStaff, resolveFractionNotation } from '../../libs/notation/index.js'`

#### **`libs/random/`** - Random Sub-Package ⭐ **CONSOLIDADO (Fase 2)**
Consolidado en Fase 2 - Sistema completo de randomización
- **`index.js`**: Exports unificados
- **`core.js`**: randomize() base (evita circular dependencies)
- **`config.js`**: Configuration management (movido desde app-common)
- **`menu.js`**: UI controls (movido desde app-common)
- **`fractional.js`**: Fractional randomization (movido desde app-common)

**Import:** `import { randomize, initRandomMenu, applyBaseRandomConfig } from '../../libs/random/index.js'`

#### **`libs/matrix-seq/`** - Note-Pulse Grid Editor ⭐ **NUEVO (2025-01)**
Sistema completo para edición de pares Note-Pulse (N-P) con grid dinámico
- **`index.js`**: Exports unificados
- **`grid-editor.js`**: Editor grid dinámico (945 líneas)
- **`grid-editor.css`**: Estilos compartidos (275 líneas)
- **`parser.js`**: Validación N-P pairs
- **`__tests__/`**: 18 tests (todos pasando)

**Características:**
- Columnas dinámicas (una por pulso)
- Multi-voice (polyphony/monophony)
- Auto-jump navigation (300ms delay)
- Auto-blur en P=7
- Auto-merge duplicados
- Auto-sort columns
- Keyboard navigation completa
- Range validation con tooltips
- Responsive (4 breakpoints)

**Import:** `import { createGridEditor } from '../../libs/matrix-seq/index.js'`

**Apps usando:** App12

#### **`libs/musical-grid/`** - 2D Musical Grid Visualization ⭐ **NUEVO (2025-01)**
Visualización 2D de grids musicales con soundline, timeline y matriz interactiva
- **`musical-grid.js`**: Sistema grid completo (565 líneas)
- **`musical-grid.css`**: Estilos compartidos (357 líneas)
- **`index.js`**: Exports unificados
- **`README.md`**: Documentación completa
- **`__tests__/`**: 26 tests (todos pasando)

**Características:**
- Sistema grid completo (soundline + timeline + matrix)
- **Scroll opcional** con sincronización automática de ejes
- Contenedores interiores expandibles para scroll
- Celdas interactivas con click handlers
- Custom formatters para notas/pulsos
- Responsive con auto-resize
- Theme support (light/dark)

**Scroll configuration:**
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

**Import:** `import { createMusicalGrid } from '../../libs/musical-grid/index.js'`

**Apps usando:** App12

#### **`libs/shared-ui/`** - UI Components
- **`header.js`**: Common header with audio controls
- **`sound-dropdown.js`**: Sound selection dropdowns
- **`hover.js`**: Hover effect utilities
- **`index.css`**: Base styles (includes slider-vertical fix)

#### **`libs/sound/`** - Audio Engine
- **`index.js`**: Tone.js wrapper with TimelineAudio class
- **`mixer.js`**: Audio mixer functionality
- **`sample-map.js`**: Sound sample management

#### **`libs/notation/`** - Music Notation
- **`rhythm-staff.js`**: VexFlow-based rhythm notation with playback cursor and interactive rests
  - Used by App2 with `pulseFilter: 'whole'` for whole-pulse-only notation
  - Features: Cursor synchronization, auto-scroll, clickable notes/rests, beaming
- **VexFlow 5.0.0**: Staff notation rendering engine

#### **`libs/app-common/notation-utils.js`** - Rhythm Notation Utilities
Smart event building for VexFlow scores optimized for rhythmic fractions and tuplets.

**Core functionality**:
- **`buildPulseEvents(config)`**: Constructs events for notation rendering
  - Intelligent pulse filtering based on fraction structure
  - Automatic rest/note assignment based on selection
  - Tuplet-aware duration mapping

**Pulse handling rules**:
- **Pulse 0**: Always rendered as note (never rest), marks pattern start
- **Numerator multiples**: ALL included in score to create tuplet structure
  - Selected → rendered as notes
  - NOT selected → rendered as clickable rests
- **Remainder pulses**: Leftover pulses from incomplete final cycle
  - Always rendered as quarter notes (regardless of base duration)
  - No dots, protected from `fractionalSelections` overwrite
- **Pulse Lg**: Excluded from score (final marker, not selectable)

**Recent fixes** (Oct 2025):
- Protection of remainder pulse duration against overwrite
- Remainder pulses always as quarter notes
- ALL multiples included in score (rests if not selected)
- Pulse Lg exclusion from score
- Pulse 0 forced as note

**Test coverage**: 280 tests in `libs/app-common/__tests__/notation-utils.test.js`

#### **Other Libraries**
- **`libs/cards/`**: Interactive note-component cards
- **`libs/ear-training/`**: Audio training utilities
- **`libs/random/`**: Randomization utilities
- **`libs/utils/`**: General utilities
- **`libs/vendor/`**: Third-party libraries (Tone.js)

### 🎮 Gamification System (`libs/gamification/`)

#### **Core System** - Modular gamification infrastructure
- **`event-system.js`**: Event tracking and management
- **`scoring-system.js`**: Score calculation with multipliers
- **`achievements.js`**: Achievement system with 20+ unlockables
- **`storage.js`**: LocalStorage persistence with sync queue
- **`config.js`**: Centralized configuration
- **`user-manager.js`**: Single-user state management
- **`index.js`**: Main GamificationManager and API

#### **Audio Capture** (`libs/audio-capture/`)
- **`microphone.js`**: Microphone rhythm capture with beat detection
- **`keyboard.js`**: Keyboard (Space) rhythm capture
- **`rhythm-analysis.js`**: Pattern analysis and accuracy calculation

#### **Game Components** (`libs/gamification/game-components/`) - Reusable game modules
- **`shared/`**: Base classes and UI components
  - `BaseGameManager.js`, `LevelSystem.js`, `PhaseManager.js`
  - UI: `GamePopup.js`, `ResultsScreen.js`, `GameOverlay.js`
- **`rhythm-game/`**: Rhythm game components (App2, App5)
- **`fraction-game/`**: Fraction recognition components (App3)
- **`pattern-game/`**: Pattern creation components (App4)

#### **Current Implementation**
- **App5**: Full gamification with 4 levels, pattern recognition, UI popups
  - Location: `Apps/App5/game/` (game-manager.js, game-ui.js, levels-config.js)
  - Mechanics: Listen to pattern → Enter positions → Validate → Score
- **Apps 2,3,4**: Planned implementation (see GAMIFICATION_IMPLEMENTATION_PLAN.md)

### New Modularization Patterns (2024)

#### **DOM Management**
```javascript
// Instead of multiple document.getElementById calls:
import { bindRhythmElements } from '../../libs/app-common/dom.js';

const { elements, leds, ledHelpers } = bindRhythmElements({
  inputLg: 'inputLg',
  inputV: 'inputV',
  ledLg: 'ledLg',
  // ... more elements
});

// LED state management:
ledHelpers.setLedAuto('Lg', true);
ledHelpers.setLedActive('V', false);
```

#### **App Initialization**
```javascript
import { initRhythmApp, createStandardElementMap } from '../../libs/app-common/app-init.js';

const { audio, schedulingBridge, elements, ledManagers } = await initRhythmApp({
  title: 'App Title',
  elementMap: createStandardElementMap({
    // additional elements specific to this app
  }),
  audioMapping: {
    baseSound: 'setBase',
    accentSound: 'setAccent'
  },
  templateConfig: {
    showSelectColor: true,
    randomMenuContent: '...'
  }
});
```

#### **Event Binding**
```javascript
import { bindRhythmAppEvents } from '../../libs/app-common/events.js';

bindRhythmAppEvents(elements, {
  numberInputs: {
    Lg: {
      onChange: () => handleLgChange(),
      onIncrement: () => incrementLg(),
      onDecrement: () => decrementLg()
    }
  },
  buttons: {
    playBtn: () => togglePlayback(),
    resetBtn: () => resetValues()
  },
  toggles: {
    loopBtn: {
      onToggle: () => toggleLoop(),
      getState: () => isLooping
    }
  }
});
```

#### **LED Management**
```javascript
import { createRhythmLEDManagers, syncLEDsWithInputs } from '../../libs/app-common/led-manager.js';

const ledManagers = createRhythmLEDManagers(leds);

// Update LED states
ledManagers.Lg.setAuto(true);
ledManagers.V.setActive(false);

// Sync with input elements
syncLEDsWithInputs(ledManagers, elements);
```

### Application Types

All apps share common architecture with rhythm parameters (Lg, V, T) and audio playback:

1. **App1**: Temporal Formula
   - Basic rhythm timeline with circular/linear visualization
   - Three-parameter system with auto-calculation (one auto, two manual)
   - Tap tempo with resync capability
   - Features: Loop, random parameter generation, theme switching

2. **App2**: Pulse Sequence Editor
   - Editable pulse patterns with contenteditable sequence field
   - Pulse memory persistence across Lg changes
   - Drag selection for rapid pattern creation
   - Synchronized timeline scrolling with visual highlighting
   - Mixer controls for pulse/accent channels
   - Rhythm notation panel with clickable rests and playback cursor
   - Features: Auto-sync between text field and visual timeline
   - **Refactored (2025-01)**: Integrated timeline-layout.js, simplified notation state building
     - Uses `createTimelineRenderer()` for circular/linear layouts (~147 lines reduced)
     - Uses `rhythm-staff.js` with inline event building (notation-utils.js no longer needed)
     - Total reduction: 97 lines (5.3%), from 1839 to 1742 lines

3. **App3**: Fraction Editor
   - Complex rhythm fraction editing (n/d subdivisions)
   - Visual cycle markers on timeline
   - Dedicated fraction editor component with validation
   - Cycle audio with subdivision tracking
   - Features: Integer cycles, fractional pulses, visual subdivision labels

4. **App4**: Multi-Fraction Selection (READ.md available)
   - Advanced fraction management with multiple selections
   - Detailed implementation documented in Apps/App4/README.md
   - Complex pattern generation capabilities

## 🚨 **CRITICAL DEVELOPMENT PRINCIPLES**

### **ALWAYS PRIORITIZE SHARED COMPONENTS**

When implementing new features or fixing bugs, **ALWAYS** follow this hierarchy:

1. **🔍 FIRST**: Check if a shared component already exists in `libs/app-common/`
2. **🛠️ SECOND**: If no shared component exists, create one that can be reused
3. **❌ LAST RESORT**: Only implement app-specific code when truly necessary

### **Modular Component Usage Examples**

#### **Loop Controllers** ⭐ NEW
```javascript
// ✅ CORRECT: Use shared loop controller
import { createPulseMemoryLoopController } from '../../libs/app-common/loop-control.js';

const loopController = createPulseMemoryLoopController({
  audio: { setLoop: (enabled) => audio?.setLoop?.(enabled) },
  loopBtn: elements.loopBtn,
  state: { get loopEnabled() { return loopEnabled; }, set loopEnabled(v) { loopEnabled = v; } },
  ensurePulseMemory,
  getLg: () => parseInt(inputLg.value),
  isPlaying: () => isPlaying,
  onToggle: (enabled) => {
    syncSelectedFromMemory();
    updateNumbers();
    // app-specific callback logic
  }
});
loopController.attach();

// ❌ WRONG: Manual loop button event listeners
loopBtn.addEventListener('click', () => {
  loopEnabled = !loopEnabled;
  // This creates duplicate code and potential audio sync bugs
});
```

#### **Bug Fix Priority**
When fixing bugs that affect multiple apps:

1. **Create shared component** that handles the bug properly
2. **Migrate all affected apps** to use the shared component
3. **Verify consistent behavior** across all apps

### **Testing Shared Components**

All shared components MUST have corresponding tests. Current test coverage:

**Test locations**:
- `libs/app-common/__tests__/` - Core app-common tests (subdivision, audio, fraction-editor, notation-utils, etc.)
- `tests/` - Legacy tests and integration tests
- 24 test suites, 280 passing tests

**Key test files**:
- `libs/app-common/__tests__/subdivision.test.js` - Temporal calculations
- `libs/app-common/__tests__/audio.test.js` - Audio bridges and scheduling
- `libs/app-common/__tests__/fraction-editor.test.js` - Fraction editing logic
- `libs/app-common/__tests__/notation-utils.test.js` - Notation event building (comprehensive coverage)
- `libs/app-common/__tests__/audio-toggles.test.js` - Toggle state management
- `libs/app-common/__tests__/loop-resize.test.js` - Loop resizing behavior
- `libs/app-common/__tests__/tap-resync.test.js` - Tap tempo resync logic
- `libs/app-common/loop-control.test.js` - Loop controller components
- `libs/app-common/range.test.js` - Range validation
- `libs/app-common/utils.test.js` - Math utilities

Before creating new shared components:
1. **Check existing tests**: `npm test`
2. **Create test file**: `libs/app-common/__tests__/[component-name].test.js`
3. **Test critical paths**: Audio sync, DOM management, state persistence, edge cases

### **Technical Architecture**

#### **Module System**
- **ES6 modules** throughout with **type: "module"** in package.json
- **Workspace dependencies** managed by npm
- **Tone.js** loaded globally before module scripts

#### **State Management**
- **Plain JavaScript objects** for app state
- **Preference storage** via `libs/app-common/preferences.js`
- **Local storage** for persistent settings

#### **Audio Architecture**
- **TimelineAudio class** for scheduled playback
- **Scheduling bridges** for mobile/desktop optimization
- **Mixer system** for multi-sound management
- **AudioContext warnings** handled gracefully

#### **LED System**
- **Auto/Manual states** for rhythm parameters (Lg, V, T)
- **Visual feedback** via CSS classes
- **Click handlers** for toggling states
- **Synchronized state** between LEDs and inputs

### Development Patterns

#### **Creating New Apps**

**Modern modular approach** (recommended for all new apps):
1. Use `bindAppRhythmElements('appN')` from `dom.js` to bind DOM elements
2. Use `createRhythmAudioInitializer()` from `audio-init.js` for audio setup
3. Use `createSchedulingBridge()` and `bindSharedSoundEvents()` from `audio.js`
4. Use specialized controllers:
   - `createPulseMemoryLoopController()` for loop management
   - `createFractionEditor()` for fraction inputs
   - `createPulseSeqController()` for pulse sequence editing
5. Import utilities from `libs/app-common/` as needed

**Legacy monolithic approach** (being phased out):
- `initRhythmApp()` from `app-init.js` (deprecated)
- `createStandardElementMap()` (deprecated)
- `bindRhythmAppEvents()` (deprecated)

The modular approach provides better tree-shaking, clearer dependencies, and easier testing.

#### **Common Element IDs**
Standard rhythm apps use these element IDs:
- **Inputs**: `inputLg`, `inputV`, `inputT`
- **Controls**: `inputLgUp`, `inputLgDown`, etc.
- **LEDs**: `ledLg`, `ledV`, `ledT`
- **Buttons**: `playBtn`, `loopBtn`, `resetBtn`
- **Random**: `randLgToggle`, `randLgMin`, `randLgMax`

#### **Audio Initialization**
- Use `createRhythmAudioInitializer()` to handle audio context warnings
- Audio context starts only on user interaction (no warnings on page load)
- Scheduling profiles auto-detected (mobile/desktop)
- Sound selection handled by shared header (`header.js`)
- Mixer integration via `initMixerMenu()` and `initAudioToggles()`
- Tap tempo with resync capability via `computeResyncDelay()`

#### **CSS and Styling**
- **Base styles**: `libs/shared-ui/index.css`
- **App-specific styles**: `Apps/AppX/styles.css`
- **Theme support**: `data-theme` attribute
- **Deprecated warnings fixed**: slider-vertical replaced with writing-mode

### Testing

Test infrastructure:
- **Jest 29.x** with Node.js/jsdom environments
- **ES modules** support via experimental VM modules
- **33 test suites**, 406 passing tests (+44 from matrix-seq + musical-grid)
- **Test locations**:
  - `libs/app-common/__tests__/` - Core shared component tests (20 suites)
  - `libs/matrix-seq/__tests__/` - Grid editor tests (18 tests) ⭐ **NUEVO**
  - `libs/musical-grid/__tests__/` - Musical grid tests (26 tests) ⭐ **NUEVO**
  - `libs/sound/*.test.js` - Audio engine tests
  - `libs/random/*.test.js`, `libs/utils/*.test.js` - Utility tests
  - `tests/` - Legacy integration and domain-specific tests

**Test patterns**:
- Unit tests for pure functions (subdivision, range, number parsing)
- Integration tests for complex components (fraction-editor, pulse-seq, notation-utils, grid-editor, musical-grid)
- Audio behavior tests (audio-toggles, loop-control, tap-resync)
- Edge case validation (loop-resize, audio-schedule, remainder pulses)
- DOM interaction tests with jsdom (grid-editor, musical-grid)
- Scroll synchronization tests (musical-grid)

### Console Warnings Resolution

#### **Fixed Issues**
1. **slider-vertical deprecation**: Replaced with `writing-mode: vertical-lr; direction: rtl`
2. **AudioContext warnings**: Deferred audio start until user interaction
3. **Tone.js startup**: Graceful handling of context state

#### **Best Practices**
- Never call `Tone.start()` automatically on page load
- Use `ensureAudioSilent()` for warning-free audio checks
- Handle audio context state in user interaction handlers

### Scaling and Code Reuse

#### **Current Modularization Achievements**
- **~70% code reduction** vs. monolithic apps
- **40 shared modules** in `libs/app-common/` (consolidado Fase 2)
- **7 sub-packages** especializados (pulse-seq, matrix-seq, musical-grid, notation, random, gamification, audio-capture)
- **DOM queries**: Centralized through `bindAppRhythmElements()`
- **Audio**: Unified initialization via `createRhythmAudioInitializer()`
- **State management**: Shared preference storage and factory reset
- **UI components**: Reusable controllers (fraction-editor, pulse-seq, loop-control, grid-editor, musical-grid)

#### **Shared Components Status**
✅ **Production-ready (10/10 maturity)**:
- Audio initialization and scheduling
- DOM element binding
- LED management
- Loop controllers (basic, rhythm, pulse-memory variants)
- Fraction editor with validation
- Pulse sequence editor with drag selection
- **Grid editor (matrix-seq)** - Dynamic N-P pair editing ⭐ **NUEVO**
- **Musical grid (musical-grid)** - 2D visualization with scroll ⭐ **NUEVO**
- Mixer menu and audio toggles
- Random parameter generation
- Timeline layout (circular/linear)
- Tap tempo with resync
- Preference storage with factory reset

✅ **Modulos con scroll support**:
- **musical-grid**: Scroll horizontal/vertical sincronizado con ejes

#### **Development Speed**
- **New app from scratch**: 4-6 hours (with mature patterns)
- **New feature in existing app**: 1-2 hours
- **Legacy refactor to modular**: 2-3 hours per app
- **New module with tests**: 3-4 hours (includes documentation)

#### **Recommended Patterns**
1. **Start with bindAppRhythmElements()** for DOM access
2. **Use specialized controllers** instead of manual event listeners
3. **Import only what you need** for better tree-shaking
4. **Test shared components** before app-specific logic
5. **Document new patterns** in AGENTS.md for future apps

### File Organization
- **App structure**: HTML + styles.css + main.js + utils.js (re-export)
- **Shared code**: Factored into `libs/app-common/`
- **Utils pattern**: Apps re-export from `libs/app-common/utils.js`
- **Import paths**: Relative imports from app to libs

### Key Dependencies
- **Tone.js 15.x**: Audio synthesis and timing
- **VexFlow 5.0.0**: Music notation rendering
- **Jest 29.x**: Testing framework
- **ES2022**: Modern JavaScript features

---

## 🎭 Sistema de Agentes

Claude Code tiene un sistema de agentes especializados para optimizar el desarrollo. Ver `@.claude-code/agents-context.md` para detalles completos.

### Agentes Disponibles

1. **🎨 UI Agent**
   - Especialidad: Diseño de interfaces, componentes UI, accesibilidad
   - Usa para: Crear componentes visuales, análisis de diseño, mejoras de UX

2. **🔊 Audio Agent**
   - Especialidad: Sistema de audio, timing, sincronización
   - Usa para: Optimización de audio, debugging de timing, performance
   - ⚠️ **CRÍTICO**: NO puede modificar clock.js, pulse-interval-calc.js, voice-sync.js

3. **📱 Responsive Agent**
   - Especialidad: Adaptación móvil, responsive design
   - Usa para: Media queries, touch interactions, mobile layouts

4. **📦 Modules Agent**
   - Especialidad: Arquitectura, código duplicado, refactoring
   - Usa para: Detectar duplicados, mejorar estructura, extracción de componentes
   - Usado para: Creación de matrix-seq y musical-grid modules

5. **🏗️ Creator Agent**
   - Especialidad: Crear nuevas apps y componentes
   - Usa para: Generar apps completas, componentes complejos, features nuevas

6. **🎮 Gamification Agent**
   - Especialidad: Sistema de logros, engagement
   - Usa para: Achievements, tracking de progreso, badges

### Reglas Críticas de Agentes

**🚫 NUNCA MODIFICAR:**
- `libs/sound/clock.js` - Sistema de timing crítico
- `libs/app-common/pulse-interval-calc.js` - Cálculos de intervalos
- `libs/app-common/voice-sync.js` - Sincronización de voces

**✅ SIEMPRE:**
1. Mostrar código ANTES de crear archivos
2. Esperar aprobación explícita (✅) del usuario
3. Crear nuevos archivos en vez de modificar existentes cuando sea posible
4. Escribir tests para nuevos componentes
5. Ejecutar `npm test` después de cambios

### Filosofía PlayNuzic Lab

- **Minimalismo**: UI limpia, código simple
- **Reutilización**: ~70% código compartido
- **No invasión**: Nunca romper lo existente
- **Testing**: 406 tests deben pasar siempre (33 suites)
- **Modularización**: Extraer a libs/ cuando hay duplicación

---

## 📚 Recursos Adicionales

- **MODULES.md**: Documentación completa de todos los módulos compartidos
- **libs/matrix-seq/README.md**: Guía completa del grid editor
- **libs/musical-grid/README.md**: Guía completa de visualización 2D con scroll
- **.claude-code/agents-context.md**: Sistema de agentes especializado