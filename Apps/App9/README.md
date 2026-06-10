# App9: Línea Temporal

## Descripción

App9 es un metrónomo visual educativo que reproduce una secuencia de **9 pulsos (0-8)** con **2 ruidos** de duraciones variables (1 y 2 pulsos) que aparecen en posiciones aleatorias. El tempo (BPM) se genera aleatoriamente en cada reproducción. La aplicación incluye **barras de duración** sincronizadas que muestran visualmente cuándo y por cuánto tiempo suena cada ruido.

## Características

- **Metrónomo visual-audio**: Sincronización perfecta entre sonido y highlighting visual
- **BPM aleatorio**: Cada reproducción genera un tempo aleatorio entre 75-200 BPM
- **2 ruidos con duraciones fijas**:
  - Un ruido de **1 pulso** de duración
  - Un ruido de **2 pulsos** de duración
  - Orden aleatorio (50% corto→largo, 50% largo→corto)
  - Posiciones aleatorias sin solapamiento
- **Barras de duración sincronizadas**: Visualización en tiempo real de la duración de cada ruido
- **Highlight sincronizado**: Los pulsos se iluminan al ritmo del metrónomo
- **Sin loop**: Un solo ciclo por reproducción

## Interfaz

### Línea Temporal
- **9 números** (0-8) distribuidos uniformemente en una línea horizontal
- Cada número tiene un **punto (dot)** arriba en la línea
- Los puntos se **iluminan** (highlight) cuando suena su pulso
- **Barras de duración** aparecen encima de la línea cuando un ruido está sonando
  - La barra crece progresivamente durante la duración del ruido
  - Desaparece al finalizar el ruido
  - Estilo consistente con App6 y App8

### Controles
- **Botón Play**: Inicia el metrónomo
  - Se deshabilita durante la reproducción
  - Animación pulsante mientras reproduce
  - Al finalizar, se reactiva para permitir nueva reproducción

## Comportamiento de Audio

### Sonidos Utilizados
- **Click Base (click1)**: Todos los pulsos reproducen este sonido
- **Ruido Rosa (click11)**: Los 2 ruidos seleccionados aleatoriamente reproducen ADEMÁS este sonido

### Lógica de Reproducción
1. Al pulsar Play:
   - Se genera un BPM aleatorio entre 75-200
   - Se generan 2 ruidos:
     - Uno con duración de 1 pulso
     - Otro con duración de 2 pulsos
     - Orden aleatorio (50% chance cada combinación)
     - Posiciones aleatorias garantizando que ambos quepan en pulsos 0-8
     - Sin solapamiento entre ruidos
   - Se calcula el intervalo entre pulsos: `intervalSec = 60 / BPM`
2. Durante la reproducción:
   - Todos los pulsos suenan con "Click Base"
   - Los pulsos que coinciden con los ruidos suenan con "Click Base" + "Ruido Rosa" simultáneamente
   - Las barras de duración aparecen y crecen sincronizadas con el sonido
3. Al finalizar:
   - El botón Play se reactiva
   - Las barras desaparecen
   - Una nueva pulsación genera nuevos valores aleatorios

## Arquitectura Técnica

### Algoritmo de Generación de Ruidos

**Garantías matemáticas:**
```javascript
// Pulsos disponibles: 0-8 (TOTAL_PULSES = 9)
// Un ruido en posición X con duración D ocupa pulsos [X, X+D-1]

// Restricción 1: Espacio para ambos ruidos
// start1 + duration1 + duration2 <= 9
const maxStart1 = TOTAL_PULSES - firstDuration - secondDuration;

// Restricción 2: Segundo ruido debe caber
// start2 + duration2 - 1 <= 8
const maxStart2 = TOTAL_PULSES - secondDuration;

// Sin solapamiento
const minStart2 = start1 + firstDuration;
```

**Casos de ejemplo:**
- Corto→Largo: Ruido 1 en pulso 6 (1 pulso) → Ruido 2 en pulsos 7-8 (2 pulsos)
- Largo→Corto: Ruido 1 en pulsos 6-7 (2 pulsos) → Ruido 2 en pulso 8 (1 pulso)
- Con gaps: Ruido 1 en pulso 2 (1 pulso) → Ruido 2 en pulsos 5-6 (2 pulsos)

### Gestión de Barras de Duración

**Bug resuelto:** Cada ruido mantiene su propia referencia a su barra (`noise.barElement`) para evitar conflictos cuando los ruidos son consecutivos.

```javascript
// Creación
noise.barElement = createDurationBar(noise, intervalSec);

// Eliminación específica
if (noise.barElement) {
  noise.barElement.remove();
  noise.barElement = null;
}
```

### Módulos Compartidos Utilizados
- **`visual-sync.js`**: Sincronización visual-audio a 60fps
- **`simple-highlight-controller.js`**: Gestión de highlighting de pulsos
- **`TimelineAudio`**: Motor de audio con scheduling preciso
- **`audio-init.js`**: Inicialización estándar de audio

### Recursos de Audio
- Registrado en `libs/sound/index.js`: `click11: 'Ruido Rosa'`
- Añadido al manifest: `ruidoRosa: 'click11'`

### Patrón de Implementación
```javascript
// Generación de ruidos
noises = generate2Noises(); // Retorna [{startPulse, duration}, {startPulse, duration}]

// Crear Set de pulsos seleccionados
const selectedPulses = new Set();
noises.forEach(noise => {
  for (let i = 0; i < noise.duration; i++) {
    selectedPulses.add(noise.startPulse + i);
  }
});

// Reproducción con callbacks
audio.play(
  TOTAL_PULSES,      // 9 pulsos
  intervalSec,
  selectedPulses,
  false,
  (step) => {
    // Crear barra cuando ruido empieza
    noises.forEach((noise) => {
      if (step === noise.startPulse) {
        noise.barElement = createDurationBar(noise, intervalSec);
      }
    });

    // Eliminar barra cuando ruido termina
    noises.forEach((noise) => {
      if (step === noise.startPulse + noise.duration - 1) {
        setTimeout(() => {
          if (noise.barElement) {
            noise.barElement.remove();
            noise.barElement = null;
          }
        }, intervalSec * 1000);
      }
    });
  },
  onComplete
);
```

## Estilos

### Variables CSS
- `--line-color`: Color de la línea horizontal
- `--pulse-color`: Color de los puntos
- `--pulse-anim-duration`: Duración de la animación de highlight (0.35s)
- `--selection-color`: Color del glow al hacer highlight y de las barras

### Barras de Duración (`.interval-block`)
```css
.interval-block {
  position: absolute;
  top: 50%;
  height: 24px;
  background: var(--selection-color, #F97C39);
  opacity: 0.25;
  transform: translateY(-100%); /* Posicionada encima de la línea */
  transition-property: width, opacity;
  transition-timing-function: linear;
}

.interval-block.active {
  opacity: 0.8;
  box-shadow: 0 0 8px var(--selection-color);
}
```

### Animaciones
- **pulseFlash**: Animación compartida de `app-common/styles.css` para el highlight de pulsos
- **playingPulse**: Animación del botón Play durante reproducción
- **Progressive fill**: Animación de crecimiento de barras usando `requestAnimationFrame` + CSS transitions

## Testing

### Verificación Manual
1. Abrir la app y pulsar Play varias veces
2. Verificar que:
   - Los números 0-8 se iluminan secuencialmente
   - Se escucha el click base en todos los pulsos
   - Siempre aparecen **2 ruidos** (con ruido rosa adicional)
   - Un ruido dura **1 pulso**, el otro dura **2 pulsos**
   - El orden varía (a veces corto primero, a veces largo primero)
   - Las posiciones son aleatorias
   - Los ruidos **nunca se solapan**
   - Las barras de duración:
     - Aparecen cuando empieza cada ruido
     - Crecen durante la duración del ruido
     - Desaparecen al finalizar el ruido
     - Funcionan correctamente incluso cuando los ruidos son consecutivos
   - El botón se deshabilita durante reproducción
   - Al finalizar, el botón se reactiva

### Tests Automatizados
```bash
npm test  # 280 tests passing
```

## Estructura de Archivos

```
Apps/App9/
├── index.html      - HTML principal con template
├── main.js         - Lógica del metrónomo (352 líneas)
├── styles.css      - Estilos de la línea temporal (196 líneas)
└── README.md       - Esta documentación
```

## Integración con el Sistema

- **Header compartido**: Theme selector, color picker, factory reset
- **Performance audio menu**: Control de rendimiento de audio
- **Mixer**: Longpress para abrir mixer
- **Template system**: Usa plantilla compartida de `app-common/template.js`

## Cambios Respecto a Versión Original

### Versión Original (6 pulsos, 1 ruido)
- 6 pulsos (0-5)
- 1 ruido aleatorio de 1 pulso
- Sin visualización de duración

### Versión Actual (9 pulsos, 2 ruidos, barras)
- **9 pulsos (0-8)** - Ampliado desde 6
- **2 ruidos** en vez de 1 - Mayor complejidad rítmica
- **Duraciones fijas** (1 y 2 pulsos) - Contraste claro de duraciones
- **Orden aleatorio** - 50% corto→largo, 50% largo→corto
- **Posiciones aleatorias** - Garantizando que ambos quepan
- **Sin solapamiento** - Segundo ruido siempre después del primero
- **Barras de duración** - Visualización sincronizada estilo App6/App8
- **Fix de layoutLinear()** - Usa fórmula dinámica `(i / (TOTAL_PULSES - 1)) * 100`

## Notas de Diseño

- **Minimalismo**: Interfaz limpia con solo lo necesario (línea + botón)
- **Educacional**: Ayuda a desarrollar:
  - Sentido del pulso
  - Reconocimiento de patrones rítmicos
  - Percepción de duraciones variables
  - Discriminación auditiva de eventos solapados
- **Accesibilidad**: Botones con aria-labels, contraste visual adecuado
- **Responsive**: Adaptado a móvil, tablet y desktop
- **Consistencia visual**: Barras de duración con mismo estilo que App6 y App8

## Decisiones Técnicas

### Timeline Layout
- **Fórmula correcta**: `(index / (TOTAL_PULSES - 1)) * 100` para espaciado uniforme
- **Bug corregido**: Divisor hardcodeado `/5` reemplazado por cálculo dinámico
- **Verificado en**: App1, App2, App5 para confirmar patrón correcto

### Barras de Duración
- **Posicionamiento**: Porcentaje basado en `pulseSpacing = 100 / (TOTAL_PULSES - 1)`
- **Ancho**: `noise.duration * pulseSpacing`
- **Animación**: CSS transition + requestAnimationFrame para smooth progressive fill
- **Z-index**: 5 (debajo de pulsos que son 10)

### Referencias de Barras
- **Problema**: Variable global `currentDurationBar` causaba eliminación incorrecta cuando ruidos eran consecutivos
- **Solución**: Cada objeto `noise` guarda su propia referencia `barElement`
- **Resultado**: Eliminación específica sin conflictos

## Futuras Mejoras Potenciales

- Opción para configurar BPM manualmente
- Selector para número de ruidos (2-4)
- Selector para duraciones (1-3 pulsos)
- Modo de práctica: usuario identifica posiciones y duraciones de los ruidos
- Loop configurable
- Más pulsos configurables (hasta 12-16)
- Estadísticas de patrones reproducidos
