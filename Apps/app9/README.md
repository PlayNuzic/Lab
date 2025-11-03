# App9: Línea Temporal

## Descripción

App9 es un metrónomo visual educativo que reproduce una secuencia de 6 pulsos (0-5) con un pulso aleatorio que reproduce un sonido de "ruido rosa" adicional. El tempo (BPM) se genera aleatoriamente en cada reproducción.

## Características

- **Metrónomo visual-audio**: Sincronización perfecta entre sonido y highlighting visual
- **BPM aleatorio**: Cada reproducción genera un tempo aleatorio entre 75-200 BPM
- **Pulso de ruido aleatorio**: Un pulso aleatorio (0-5) reproduce el sonido "Ruido Rosa" (click11) además del click base
- **Highlight sincronizado**: Los pulsos se iluminan al ritmo del metrónomo usando el sistema de visual sync compartido
- **Sin loop**: Un solo ciclo por reproducción

## Interfaz

### Línea Temporal
- **6 números** (0-5) distribuidos uniformemente en una línea horizontal
- Cada número tiene un **punto (dot)** arriba en la línea
- Los puntos se **iluminan** (highlight) cuando suena su pulso

### Controles
- **Botón Play**: Inicia el metrónomo
  - Se deshabilita durante la reproducción
  - Animación pulsante mientras reproduce
  - Al finalizar, se reactiva para permitir nueva reproducción

## Comportamiento de Audio

### Sonidos Utilizados
- **Click Base (click1)**: Todos los pulsos reproducen este sonido
- **Ruido Rosa (click11)**: Un pulso aleatorio reproduce ADEMÁS este sonido

### Lógica de Reproducción
1. Al pulsar Play:
   - Se genera un BPM aleatorio entre 75-200
   - Se escoge un pulso aleatorio (0-5) para el ruido
   - Se calcula el intervalo entre pulsos: `intervalSec = 60 / BPM`
2. Durante la reproducción:
   - Todos los pulsos suenan con "Click Base"
   - El pulso seleccionado aleatoriamente suena con "Click Base" + "Ruido Rosa" simultáneamente
3. Al finalizar:
   - El botón Play se reactiva
   - Una nueva pulsación genera nuevos valores aleatorios

## Arquitectura Técnica

### Módulos Compartidos Utilizados
- **`visual-sync.js`**: Sincronización visual-audio a 60fps
- **`simple-highlight-controller.js`**: Gestión de highlighting de pulsos
- **`TimelineAudio`**: Motor de audio con scheduling preciso

### Recursos de Audio
- Registrado en `libs/sound/index.js`: `click11: 'Ruido Rosa'`
- Añadido al manifest: `ruidoRosa: 'click11'`

### Patrón de Implementación
```javascript
// Setup de controladores
const highlightController = createSimpleHighlightController({
  getPulses: () => pulses,
  getLoopEnabled: () => false
});

const visualSync = createSimpleVisualSync({
  getAudio: () => audio,
  getIsPlaying: () => isPlaying,
  onStep: (step) => highlightController.highlightPulse(step)
});

// Reproducción
audio.play(
  TOTAL_PULSES,      // 6 pulsos
  intervalSec,       // Intervalo calculado desde BPM
  selectedPulses,    // Set con el índice del pulso con ruido
  false,             // Sin loop
  onPulse,           // Callback por pulso
  onComplete         // Callback al finalizar
);
visualSync.start();
```

## Estilos

### Variables CSS
- `--line-color`: Color de la línea horizontal
- `--pulse-color`: Color de los puntos
- `--pulse-anim-duration`: Duración de la animación de highlight (0.35s)
- `--selection-color`: Color del glow al hacer highlight

### Animaciones
- **pulseFlash**: Animación compartida de `app-common/styles.css` para el highlight
- **playingPulse**: Animación del botón Play durante reproducción

## Testing

### Verificación Manual
1. Abrir la app y pulsar Play
2. Verificar que:
   - Los números se iluminan secuencialmente
   - Se escucha el click base en todos los pulsos
   - Un pulso aleatorio tiene ruido rosa adicional
   - El botón se deshabilita durante reproducción
   - Al finalizar, el botón se reactiva
3. Pulsar Play de nuevo:
   - Verificar que BPM y pulso de ruido son diferentes

### Tests Automatizados
```bash
npm test
```

## Estructura de Archivos

```
Apps/app9/
├── index.html      - HTML principal con template
├── main.js         - Lógica del metrónomo
├── styles.css      - Estilos de la línea temporal
└── README.md       - Esta documentación
```

## Integración con el Sistema

- **Header compartido**: Theme selector, color picker, factory reset
- **Performance audio menu**: Control de rendimiento de audio
- **Mixer**: Longpress para abrir mixer (aunque esta app es simple)

## Notas de Diseño

- **Minimalismo**: Interfaz limpia con solo lo necesario (línea + botón)
- **Educacional**: Ayuda a desarrollar el sentido del pulso y reconocimiento de patrones rítmicos
- **Accesibilidad**: Botones con aria-labels, contraste visual adecuado
- **Responsive**: Adaptado a móvil, tablet y desktop

## Futuras Mejoras Potenciales

- Opción para configurar BPM manualmente
- Selector para elegir qué pulso tiene ruido
- Modo de práctica: usuario identifica qué pulso tuvo ruido
- Loop configurable
- Más de 6 pulsos (configurable)
