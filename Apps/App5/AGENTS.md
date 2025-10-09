# App5: Pulsaciones - Intervalos Temporales

## Descripción

**App5 "Pulsaciones"** es una aplicación de entrenamiento rítmico que se enfoca en **intervalos temporales** (espacios entre posiciones) en lugar de posiciones exactas en el tiempo.

A diferencia de App2 que trabaja con pulsos numerados de 0 a Lg, App5 trabaja con **pulsaciones numeradas de 1 a Lg**, donde cada pulsación representa un intervalo temporal.

## Cambios Conceptuales vs App2

### Timeline
- **Sin pulso 0**: La timeline empieza desde el pulso 1
- **Pulsos**: De 1 a Lg (ambos inclusive)
- **Todos son seleccionables**: No hay extremos especiales

### Visualización
- **Bloques iT (intervalos Temporales)**: Elementos visuales que muestran los espacios entre pulsos consecutivos seleccionados
- **Timeline lineal**: Bloques rectangulares sobre la línea
- **Timeline circular**: Bloques en forma de arco siguiendo el círculo

### Formato de Secuencia
```
P ( 1 2 6 8 9 11 ) 12
```
- Formato: `P ( pulsos... ) Lg`
- Sin pulso 0
- Lg aparece fuera del paréntesis y es editable

### Audio
- **Canal "Pulsaciones"**: Todos los intervalos
- **Canal "Seleccionados"**: Intervalos explícitamente seleccionados
- **Intervalo 1** (opcional): Primer intervalo con sonido específico (activable con checkbox)

### Random Menu
- Opción "Pulsaciones" en lugar de "Pulsos"

## Módulos Nuevos Creados

### 1. temporal-intervals
Ubicación: `/libs/temporal-intervals/`

Módulo para renderizar y calcular intervalos temporales visuales:

- **it-calculator.js**: Calcula distancias entre pulsos consecutivos
  - `calculateIntervals(selectedPulses, lg)`: Calcula array de intervalos
  - `getTotalDuration(intervals)`: Duración total
  - `findIntervalAtPosition(intervals, position)`: Busca intervalo en posición
  - `areConsecutiveSelected(pulse1, pulse2, selectedPulses)`: Verifica consecutividad

- **it-renderer.js**: Renderiza bloques iT sobre la timeline
  - `createIntervalRenderer(config)`: Crea renderer con API
  - `.render()`: Renderiza todos los intervalos
  - `.updatePositions()`: Actualiza posiciones sin recrear DOM
  - `.clearIntervals()`: Limpia bloques

- **it-styles.css**: Estilos para los bloques iT
  - Opacidad ajustable
  - Adaptación circular/linear
  - Animaciones de entrada/salida

### 2. pulse-seq-intervals.js
Ubicación: `/libs/app-common/pulse-seq-intervals.js`

Controlador de secuencia de pulsos adaptado para el formato de intervalos:

- Formato: `P ( 1 2 6 ... ) Lg`
- Lg editable y removible
- Validación: números entre 1 y Lg (inclusive)
- Misma API que `pulse-seq.js` pero con markup y lógica adaptados

## Modificaciones en Módulos Compartidos

### template.js
- Nuevo parámetro: `useIntervalMode` (default: `false`)
- Cuando `useIntervalMode === true`:
  - "Pulso 0" → "Intervalo 1" con checkbox
  - "Pulso" → "Pulsaciones"
  - "Seleccionado" → "Seleccionados"

## Estructura de Archivos

```
Apps/App5/
├── index.html          # HTML principal con imports
├── styles.css          # Estilos específicos + imports de iT
├── main.js             # Lógica adaptada de App2
└── utils.js            # Utilidades compartidas

libs/temporal-intervals/
├── it-calculator.js    # Cálculos de intervalos
├── it-renderer.js      # Renderizado de bloques iT
├── it-styles.css       # Estilos de intervalos
└── index.js            # Barrel export

libs/app-common/
└── pulse-seq-intervals.js  # Controlador de secuencia adaptado
```

## Diferencias Clave en main.js

### Funciones Modificadas

1. **selectedForAudioFromState()**
   - Rango: `1 <= i <= Lg` (incluye Lg)
   - Sin filtro de extremos

2. **renderTimeline()**
   - Loop: `for (let i = 1; i <= lg; i++)`
   - Todos los pulsos son interactivos
   - Barras en pulsos 1 y Lg

3. **syncSelectedFromMemory()**
   - Sin lógica de extremos efímeros
   - Llama a `intervalRenderer.render()` al final

4. **setPulseSelected(i, shouldSelect)**
   - Sin lógica especial para extremos
   - Validación: `i >= 1 && i <= lg`

5. **updateNumbers()**
   - Loop: `for (let i = 1; i <= lg; i++)`

6. **showNumber(i, options)**
   - Cálculos de posición ajustados para índices 1..Lg
   - Circular: `normalizedIndex = (i - 1) / (lg - 1)`
   - Linear: `normalizedIndex = (i - 1) / (lg - 1)`

7. **sanitizePulseSeq()**
   - Validación: `n >= 1 && n <= lg`

8. **handlePulseSeqInput()**
   - Clear: `for(let i = 1; i <= lg; i++)`

### Nuevo Controller

```javascript
const intervalRenderer = createIntervalRenderer({
  timeline,
  getSelectedPulses: () => selectedPulses,
  getLg: () => parseInt(inputLg.value),
  isCircular: () => loopEnabled && circularTimeline
});
```

## Uso

1. Abrir `/Apps/App5/index.html` en el navegador
2. La timeline mostrará pulsos numerados de 1 a Lg
3. Seleccionar pulsos clickeando sobre ellos
4. Los bloques iT aparecerán automáticamente entre pulsos consecutivos seleccionados
5. Activar "Intervalo 1" en el menú de sonidos para darle un sonido específico al primer intervalo

## Notas Técnicas

- **Compatibilidad**: Los cambios en módulos compartidos son opt-in, App2 mantiene su comportamiento
- **Intervalos visuales**: Se actualizan automáticamente al cambiar selección
- **Adaptación circular/linear**: Los bloques iT siguen el modo de la timeline
- **Memory indexing**: `pulseMemory` se indexa de 1 a Lg (índice 0 no se usa)

## Testing

Para probar la app:
```bash
cd /Users/workingburcet/Lab
npx http-server
# Abrir http://localhost:8080/Apps/App5/index.html
```

Verificar:
- ✓ Timeline muestra pulsos 1 a Lg
- ✓ Todos los pulsos son clickeables
- ✓ Bloques iT aparecen entre pulsos consecutivos
- ✓ Modo circular funciona correctamente
- ✓ Audio reproduce intervalos correctamente
- ✓ Random menu usa "Pulsaciones"
- ✓ Mixer muestra "Pulsaciones" y "Seleccionados"
