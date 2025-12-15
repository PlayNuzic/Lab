# App11: El Plano

## Descripción

App11 combina la **línea temporal horizontal** de App9 con la **línea sonora vertical** de App10 para crear un **plano interactivo musical**. El usuario puede hacer clic en las intersecciones de la matriz 9×12 para escuchar notas individuales del piano con feedback visual sincronizado.

## Características

- **Línea sonora vertical** (izquierda): 12 notas (0-11, MIDI 60-71 = C4-B4)
  - Números posicionados a la izquierda de la línea vertical
  - Reutiliza módulo `soundline.js` de App10
- **Línea temporal horizontal** (abajo): 9 pulsos (0-8)
  - Números posicionados debajo de la línea horizontal
  - Usa fórmula de layout lineal de App9: `(i / (TOTAL_PULSES - 1)) * 100`
- **Matriz interactiva**: 9×12 = 108 celdas en las intersecciones
  - Click en celda → reproduce nota correspondiente
  - Feedback visual doble: highlight de celda + highlight en soundline
- **BPM fijo**: 120 BPM (no aleatorizado)
  - Duración de 1 pulso = 0.5 segundos
  - Modificable mediante tap tempo
- **Piano**: Instrumento Salamander vía Tone.js

## Interfaz

### Estructura Visual

```
┌─────────────────────────────────────────┐
│ Header (theme, sound menu, instrument) │
├─────────┬───────────────────────────────┤
│         │                               │
│ Línea   │      Matriz 9×12              │
│ Sonora  │      (108 celdas)             │
│ (12     │                               │
│ notas)  │                               │
│         │                               │
├─────────┼───────────────────────────────┤
│         │   Línea Temporal (9 pulsos)  │
└─────────┴───────────────────────────────┘
│         Tap Tempo Button                │
└─────────────────────────────────────────┘
```

### Controles

- **Tap Tempo**: Único control visible, permite ajustar BPM
  - Resto de controles ocultos (play, loop, random, reset)
  - CSS similar a App9 y App10

## Comportamiento

### Interacción con Celdas

1. Usuario hace **click en una celda**
2. Se obtiene:
   - Índice de nota (0-11) desde posición vertical
   - Índice de pulso (0-8) desde posición horizontal
   - Nota MIDI: 60 + noteIndex
3. Se reproduce la **nota con piano**:
   - Duración: 1 pulso = 0.5s (90% del intervalo para separación clara)
   - Usa `playNote(midi, duration)` de `piano.js`
4. **Feedback visual doble**:
   - Celda clickeada: highlight naranja con animación `cellPulse`
   - Soundline: rectángulo highlight al lado de la línea vertical

### BPM y Tempo

- **Inicial**: 120 BPM fijo
- **Intervalo por pulso**: `60 / BPM` segundos
- **Tap tempo**: Escucha evento `sharedui:tempo` para actualizar BPM
- **No aleatorización**: A diferencia de App9 y App10, el BPM no cambia automáticamente

## Arquitectura Técnica

### Estructura del DOM

La app inyecta una estructura de grid CSS en el `#timelineWrapper` del template:

```html
<div class="grid-container">
  <div id="soundlineWrapper"></div>     <!-- Grid: col 1, row 1 -->
  <div id="matrixContainer"></div>      <!-- Grid: col 2, row 1 -->
  <div></div>                            <!-- Grid: col 1, row 2 (vacío) -->
  <div id="timelineContainer"></div>    <!-- Grid: col 2, row 2 -->
</div>
```

**Grid CSS**:
- 2 columnas: `150px 1fr` (soundline + resto)
- 2 filas: `1fr 80px` (matriz + timeline)
- Gap: `20px`

### Posicionamiento de Celdas

Cada celda usa **posicionamiento absoluto** dentro del `#matrixContainer`:

```javascript
// Horizontal (pulso): 0-8
const xPct = (pulseIndex / (TOTAL_PULSES - 1)) * 100;

// Vertical (nota): 0-11, invertido (0 abajo, 11 arriba)
const yPct = ((noteIndex + 0.5) / TOTAL_NOTES) * 100;

cell.style.left = `${xPct}%`;
cell.style.bottom = `${yPct}%`; // Usa 'bottom' para invertir
```

**Transform**: `translate(-50%, 50%)` para centrar celda en la intersección

### Módulos Compartidos Utilizados

#### **`libs/app-common/soundline.js`** (App10)
- `createSoundline(container)`: Crea línea vertical con 12 notas
- `getNotePosition(noteIndex)`: Retorna posición vertical en % (invertida)
- `getMidiForNote(noteIndex)`: Convierte índice 0-11 a MIDI 60-71

#### **`libs/sound/piano.js`** (App10)
- `loadPiano()`: Carga sampler de piano Salamander
- `playNote(midi, duration, when)`: Reproduce nota individual
- Integración con Tone.js vía `window.Tone`

#### **`libs/sound/tone-loader.js`**
- `ensureToneLoaded()`: Asegura Tone.js cargado antes de usar piano
- Lazy loading para evitar warnings de AudioContext

#### **`libs/app-common/preferences.js`**
- `createPreferenceStorage('app11')`: Storage local para configuración
- `registerFactoryReset()`: Integración con factory reset del header

### Gestión de Audio

```javascript
// Estado inicial
const FIXED_BPM = 120;
let currentBPM = FIXED_BPM;
let intervalSec = 60 / FIXED_BPM; // 0.5s

// Click en celda
const midi = soundline.getMidiForNote(noteIndex);
const duration = intervalSec * 0.9; // 90% para separación
playNote(midi, duration);

// Actualización por tap tempo
document.addEventListener('sharedui:tempo', (e) => {
  currentBPM = e.detail.bpm;
  intervalSec = 60 / currentBPM;
});
```

### Highlights Visuales

#### **Highlight de Celda** (`.matrix-cell.highlight`)

```css
.matrix-cell.highlight {
  background: var(--cell-highlight-color);
  opacity: 0.8;
  transform: translate(-50%, 50%) scale(1.15);
  box-shadow: 0 0 20px var(--cell-highlight-color);
  animation: cellPulse 0.35s ease-out;
}
```

**Animación `cellPulse`**: Escala de 0.9 → 1.2 → 1.15

#### **Highlight de Soundline** (`.soundline-highlight.active`)

```css
.soundline-highlight.active {
  opacity: 0.8;
  animation: noteFlash 0.35s ease-out;
}
```

- Rectángulo de 80px × 8.33% (1/12 de altura)
- Posicionado a la derecha de la línea vertical (`left: 120px`)
- Animación `noteFlash`: fade in + scale

### Patrón de Implementación

```javascript
// Creación de celda
function createMatrixCell(noteIndex, pulseIndex) {
  const cell = document.createElement('div');
  cell.className = 'matrix-cell';
  cell.dataset.note = noteIndex;
  cell.dataset.pulse = pulseIndex;

  // Posicionamiento
  const xPct = (pulseIndex / (TOTAL_PULSES - 1)) * 100;
  const yPct = ((noteIndex + 0.5) / TOTAL_NOTES) * 100;
  cell.style.left = `${xPct}%`;
  cell.style.bottom = `${yPct}%`;

  // Click handler
  cell.addEventListener('click', () => handleCellClick(noteIndex, pulseIndex, cell));

  return cell;
}

// Click handler
async function handleCellClick(noteIndex, pulseIndex, cellElement) {
  if (!piano) await initPiano();

  const midi = soundline.getMidiForNote(noteIndex);
  const duration = intervalSec * 0.9;

  // Reproducir nota
  playNote(midi, duration);

  // Feedback visual
  highlightCell(cellElement, duration * 1000);
  highlightNoteOnSoundline(noteIndex, duration * 1000);
}
```

## Estilos

### Variables CSS

```css
:root {
  --line-color: #666;
  --soundline-width: 3px;
  --timeline-height: 2px;
  --cell-size: 40px;
  --cell-highlight-color: var(--selection-color, #FFBB33);
  --pulse-marker-height: 15px;
  --note-highlight-color: var(--selection-color, #FFBB33);
}
```

### Grid Container

```css
.grid-container {
  display: grid;
  grid-template-columns: 150px 1fr;
  grid-template-rows: 1fr 80px;
  gap: 20px;
  width: 90%;
  max-width: 1200px;
  height: 70vh;
  max-height: 700px;
}
```

### Matrix Cells

```css
.matrix-cell {
  position: absolute;
  width: var(--cell-size);
  height: var(--cell-size);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 4px;
  cursor: pointer;
  transform: translate(-50%, 50%);
  transition: all 0.15s ease;
  background: rgba(255, 255, 255, 0.3);
  z-index: 5;
}
```

**Hover**: Escala 1.1 + opacity 0.3 + box-shadow

**Highlight**: Escala 1.15 + opacity 0.8 + animación `cellPulse`

### Controles Ocultos

```css
.controls #playBtn,
.controls #loopBtn,
.controls #randomBtn,
.controls #resetBtn,
.controls #randomMenu,
.controls #mixerMenu {
  display: none !important;
}

.controls #tapTempoBtn {
  display: flex !important;
}
```

## Testing

### Verificación Manual

1. Abrir `http://localhost:8080/Apps/app11/`
2. Verificar que:
   - Soundline vertical visible a la izquierda (números 0-11)
   - Timeline horizontal visible abajo (números 0-8)
   - Matriz de 108 celdas en intersecciones
   - Click en celda → reproduce nota + highlight
   - Highlight doble: celda + soundline
   - Solo tap tempo visible en controles
   - Piano se carga sin errores
   - BPM inicial 120, modificable con tap tempo

### Tests Automatizados

```bash
npm test  # 280 tests passing
```

**Sin regresiones**: App11 no modifica módulos compartidos, solo los reutiliza.

## Estructura de Archivos

```
Apps/app11/
├── index.html      - HTML principal con renderApp config
├── main.js         - Lógica de grid, celdas, audio (263 líneas)
├── styles.css      - Estilos 2D grid, celdas, highlights (333 líneas)
└── README.md       - Esta documentación
```

## Integración con el Sistema

- **Header compartido**: Theme selector, sound menu, instrument dropdown
- **Performance audio menu**: Control de rendimiento de audio
- **Mixer**: Longpress para abrir mixer (aunque no tiene canales configurados)
- **Template system**: Usa `renderApp()` con estructura similar a App10
- **Factory reset**: Integrado con sistema de preferencias

## Comparación con App9 y App10

| Aspecto | App9 | App10 | App11 |
|---------|------|-------|-------|
| **Layout** | Horizontal (9 pulsos) | Vertical (12 notas) | 2D Grid (9×12) |
| **Audio** | Clicks + ruido rosa | Piano (4 notas aleatorias) | Piano (1 nota por click) |
| **Interacción** | Play button → secuencia | Play button → secuencia | Click celda → nota |
| **BPM** | Aleatorio (75-200) | Aleatorio (75-200) | Fijo 120 (tap tempo) |
| **Controles** | Solo Play | Solo Play | Solo Tap Tempo |
| **Duración** | 1-2 pulsos (ruidos) | 1-2 pulsos (notas) | 1 pulso (celda) |
| **Highlight** | Pulsos + barras | Notas verticales | Celdas + soundline |

## Decisiones Técnicas

### BPM Fijo vs. Aleatorio

**Decisión**: BPM fijo a 120, modificable con tap tempo

**Razón**:
- App9 y App10 generan BPM aleatorio en cada play para variedad rítmica
- App11 es interactiva (click en celda), no secuencial
- BPM fijo proporciona consistencia al explorar notas
- Tap tempo permite ajuste manual si se desea

### Solo Tap Tempo en Controles

**Decisión**: Ocultar play, loop, random, reset

**Razón**:
- No hay secuencia automática (no necesita play)
- No hay loop (cada click es independiente)
- No hay parámetros aleatorizables (no necesita random)
- Reset no aplica (no hay estado a resetear)
- Tap tempo útil para ajustar duración de notas

### Grid CSS vs. Absolute Positioning

**Decisión**: Grid CSS para contenedores, absolute para celdas

**Razón**:
- Grid CSS organiza 4 áreas (soundline, matriz, vacío, timeline)
- Absolute positioning para 108 celdas permite cálculo preciso de intersecciones
- Responsive más controlado con Grid
- Performance: 108 elementos absolute dentro de relative container

### Highlight Doble

**Decisión**: Highlight celda + highlight soundline

**Razón**:
- Celda: Feedback inmediato del click
- Soundline: Refuerzo visual de qué nota suena
- Consistencia con App10 (highlight soundline)
- Ayuda pedagógica: asociar posición horizontal (tiempo) con vertical (nota)

## Notas de Diseño

- **Minimalismo**: Interfaz limpia, solo lo esencial (grid + tap tempo)
- **Educacional**: Ayuda a desarrollar:
  - Reconocimiento de alturas (notas 0-11)
  - Sentido del pulso (posiciones 0-8)
  - Asociación visual-auditiva (click → sonido)
  - Exploración musical libre
- **Accesibilidad**: Celdas con hover visible, contraste adecuado
- **Responsive**: Grid adapta tamaño en tablet/móvil
- **Consistencia visual**: Reutiliza estilos de App9 y App10

## Futuras Mejoras Potenciales

- **Modo secuencia**: Click en celdas para crear patrón, luego play para reproducir
- **Selección de escala**: Filtrar notas disponibles (pentatónica, mayor, menor)
- **Grabación**: Grabar secuencia de clicks y reproducir
- **Multi-selección**: Click + drag para reproducir acordes
- **Visualización de acordes**: Highlight múltiples notas simultáneas
- **Más instrumentos**: Añadir synth, strings, winds
- **Persistencia**: Guardar/cargar patrones creados
- **Gamificación**: Modo de práctica donde usuario repite patrón mostrado

## Referencias

- App9 (Línea Temporal): Timeline horizontal, layout lineal, duration bars
- App10 (Línea Sonora): Soundline vertical, piano, note highlights
- `libs/app-common/soundline.js`: Componente soundline reutilizable
- `libs/sound/piano.js`: Motor de piano con Tone.js Sampler
- Salamander Piano Samples: https://tonejs.github.io/audio/salamander/
