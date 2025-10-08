# Lab
Investigación y desarrollo del método Nuzic

**Monorepo modular** para aplicaciones rítmicas y temporales con ~70% de código compartido.

## 🚀 Quick Start

```bash
./setup.sh  # Configurar Git, instalar dependencias (Jest incluido)
npm test    # Ejecutar 24 test suites, 109 tests
npx http-server  # Servir apps localmente
```

## 📁 Estructura del Proyecto

- **Apps/** - 4 aplicaciones rítmicas independientes (App1-App4)
- **libs/** - 32+ módulos compartidos organizados por funcionalidad
- **tests/** - Test suites con Jest (109 tests passing)
- **setup.sh** - Script de inicialización del entorno

## 🎵 Aplicaciones

### App1: Temporal Formula
Timeline básico con cálculo automático de parámetros rítmicos (Lg, V, T). Sistema de tres parámetros donde uno se calcula automáticamente a partir de los otros dos.

**Features**: Loop, tap tempo con resync, visualización circular/lineal, randomización de parámetros.

### App2: Pulse Sequence Editor
Editor interactivo de patrones de pulsos con campo de secuencia editable y memoria persistente.

**Features**: Drag selection, sincronización timeline/texto, mixer con canales pulse/accent, memoria de pulsos.

### App3: Fraction Editor
Editor de fracciones rítmicas (n/d) con marcadores visuales de ciclos y subdivisiones.

**Features**: Validación de fracciones, audio de ciclos, componente reutilizable de edición, visualización de subdivisiones.

### App4: Multi-Fraction Selection
Gestión avanzada de múltiples fracciones con generación de patrones complejos.

**Documentación**: Ver `Apps/App4/README.md`

## 🧩 Arquitectura Modular

### libs/app-common/ (32+ módulos)

**Componentes de producción** ✅:
- **Audio**: `audio-init.js`, `audio.js`, `audio-schedule.js`, `audio-toggles.js`
- **UI**: `fraction-editor.js`, `pulse-seq.js`, `mixer-menu.js`, `timeline-layout.js`
- **Notación**: `notation-utils.js` - Construcción de eventos para partituras rítmicas con VexFlow
- **Gestión**: `dom.js`, `led-manager.js`, `preferences.js`, `loop-control.js`
- **Utilidades**: `subdivision.js`, `number.js`, `range.js`, `utils.js`

**Beneficios**:
- ~70% reducción de código duplicado
- Inicialización de audio sin warnings
- Componentes UI reutilizables con tests
- Gestión consistente de estado y preferencias
- Renderizado preciso de fracciones rítmicas con tuplets y pulsos remainder

### libs/sound/
Motor de audio basado en Tone.js con clase `TimelineAudio`, mixer global y gestión de samples.

### libs/shared-ui/
Componentes UI compartidos: header, dropdowns de sonido, efectos hover, estilos base.

### Otras bibliotecas
- **notation/** - Integración VexFlow
- **cards/** - Tarjetas interactivas nota-componente
- **ear-training/** - Utilidades de entrenamiento auditivo
- **vendor/** - Tone.js, VexFlow, chromatone-theory

## 🧪 Testing

**Cobertura actual**: 24 test suites, 280 tests pasados

**Suites principales**:
```
libs/app-common/__tests__/    # Componentes compartidos
├── subdivision.test.js        # Cálculos temporales
├── audio.test.js              # Bridges de scheduling
├── fraction-editor.test.js    # Editor de fracciones
├── audio-toggles.test.js      # Gestión de toggles
├── loop-resize.test.js        # Comportamiento de loop
├── tap-resync.test.js         # Resync de tap tempo
└── notation-utils.test.js     # Construcción de eventos de notación

libs/app-common/*.test.js      # Tests unitarios
libs/sound/*.test.js           # Motor de audio
tests/                         # Tests legacy e integración
```

**Ejecutar tests**:
```bash
npm test                    # Todos los tests
npm test -- subdivision     # Tests específicos
```

## 🛠️ Componentes Destacados

### Utilidades de Notación Rítmica
**Ubicación**: `libs/app-common/notation-utils.js`

Construcción inteligente de eventos para partituras con VexFlow, optimizado para fracciones rítmicas y tuplets.

**Características principales**:
- **Pulso 0**: Siempre renderizado como nota (nunca silencio), marca el inicio del patrón
- **Múltiplos del numerador**: Todos incluidos en la partitura para crear estructura de tuplets
  - Seleccionados → aparecen como notas
  - NO seleccionados → aparecen como silencios clickeables
- **Pulsos remainder**: Sobrantes del último ciclo incompleto
  - Siempre renderizados como negras (quarter notes)
  - Sin puntillos, independientemente de la duración base del compás
  - Protegidos contra sobrescritura por `fractionalSelections`
- **Pulso Lg**: Excluido de la partitura (es marca final, no seleccionable)

**Últimas mejoras** (Oct 2025):
- Fix: Protección de duración de pulsos remainder contra sobrescritura
- Fix: Pulsos remainder siempre como negras
- Fix: Inclusión de TODOS los múltiplos en partitura (silencios si no están seleccionados)
- Fix: Exclusión del pulso Lg de la partitura
- Fix: Pulso 0 forzado como nota

### Controladores de Loop
**Ubicación**: `libs/app-common/loop-control.js`

Tres variantes para diferentes necesidades:
- `createLoopController()` - Loop básico
- `createRhythmLoopController()` - Con sincronización de audio
- `createPulseMemoryLoopController()` - Con memoria de pulsos

**Uso**: App2 (pulse-memory), App3 (rhythm)

### Editor de Fracciones
**Ubicación**: `libs/app-common/fraction-editor.js` (25K líneas)

Component CRUD completo con validación, persistencia y modos inline/block.

**API**: `createFractionEditor(config)`
**Uso**: App3

### Controlador de Secuencia de Pulsos
**Ubicación**: `libs/app-common/pulse-seq.js` (13K líneas)

Editor interactivo con drag selection y memoria persistente.

**API**: `createPulseSeqController()`
**Uso**: App2

### Inicialización de Audio
**Ubicación**: `libs/app-common/audio-init.js`

Suprime warnings de AudioContext y gestiona selección de sonidos.

**API**: `createRhythmAudioInitializer(config)`
**Beneficio**: Zero warnings en consola

## 📚 Desarrollo

### Principios de Código Compartido

🚨 **SIEMPRE priorizar componentes compartidos**:

1. **🔍 PRIMERO**: Verificar si existe un componente compartido en `libs/app-common/`
2. **🛠️ SEGUNDO**: Si no existe, crear uno reutilizable
3. **❌ ÚLTIMO RECURSO**: Código específico de app solo cuando sea necesario

### Patrones Recomendados

**Inicialización moderna** (recomendado):
```javascript
import { bindAppRhythmElements } from '../../libs/app-common/dom.js';
import { createRhythmAudioInitializer } from '../../libs/app-common/audio-init.js';
import { createPulseMemoryLoopController } from '../../libs/app-common/loop-control.js';

// Bind DOM elements
const { elements, leds, ledHelpers } = bindAppRhythmElements('app1');

// Initialize audio
const _baseInitAudio = createRhythmAudioInitializer({ /* config */ });
const audio = await _baseInitAudio();

// Attach loop controller
const loopController = createPulseMemoryLoopController({ /* config */ });
loopController.attach();
```

**Patrón legacy** (en desuso):
```javascript
// initRhythmApp() - deprecated
// createStandardElementMap() - deprecated
// bindRhythmAppEvents() - deprecated
```

### Crear Nueva App

1. Usar `bindAppRhythmElements('appN')` para DOM
2. Usar `createRhythmAudioInitializer()` para audio
3. Importar controladores especializados según necesidad
4. Escribir tests en `libs/app-common/__tests__/` para componentes compartidos

### Velocidad de Desarrollo

- **App nueva**: 4-6 horas (con patrones maduros)
- **Feature nueva**: 1-2 horas
- **Refactor legacy**: 2-3 horas por app

## 🔧 Dependencias

- **Tone.js 15.x** - Síntesis y timing de audio
- **VexFlow 5.0.0** - Renderizado de notación musical
- **Jest 29.x** - Framework de testing
- **ES2022** - Características modernas de JavaScript

## 📖 Documentación

- **CLAUDE.md** - Guía completa para Claude Code con arquitectura y patrones
- **AGENTS.md** - Documentación en catalán con detalles de implementación
- **Apps/App4/README.md** - Documentación específica de App4
- **libs/app-common/AGENTS.md** - Estado de componentes compartidos (si existe)

## 🤝 Contribuir

1. Ejecutar `./setup.sh` para configurar el entorno
2. Ejecutar `npm test` antes de hacer commits
3. Priorizar componentes compartidos sobre código duplicado
4. Documentar nuevos patrones en AGENTS.md
5. Escribir tests para nuevos componentes compartidos

## 📝 Licencia

Ver archivo LICENSE para detalles.
