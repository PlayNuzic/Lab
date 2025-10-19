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

---

## Sistema de Gamificación

App5 incluye un **sistema de entrenamiento rítmico** con 4 niveles progresivos. El juego tiene dos fases principales:

### Activación
- **Botón "Game"** en la barra superior
- Activa/desactiva el modo de juego
- Durante el juego, la timeline y notación están bloqueadas

### Fase 1: Selección de Patrón
**Objetivo**: Escribir las posiciones correctas según el requisito del nivel

1. Usuario ve popup con requisito (ej: "Escribe 2 P impares")
2. Escribe posiciones en campo editable (ej: "1 3")
3. Presiona Enter para validar
4. **Si correcto**: Pattern se reproduce 1 vez en modo LINEAR → Pasa a Fase 2
5. **Si incorrecto**: Popup de reintentar con hint
6. **Sistema de ayuda**: Después de 5 segundos muestra hint con posiciones correctas

**Características**:
- Auto-validación al presionar Enter
- Sanitización automática (elimina duplicados, ordena, valida rango)
- Timeline bloqueada (no se puede hacer clic)
- Notación bloqueada (no se puede editar)

### Fase 2: Sincronización Rítmica
**Objetivo**: Sincronizar con el ritmo del patrón usando teclado o micrófono

**Secuencia completa**:
1. Popup muestra modo de captura actual (⌨️ Teclado o 🎤 Micrófono)
2. Usuario hace clic en "Comenzar"
3. **Count-in** visual y auditivo (Lg beats @ BPM configurado)
   - Cuenta regresiva: 8, 7, 6, 5, 4, 3, 2, 1
   - Clicks de audio sincronizados
   - Si modo micrófono: calibración paralela durante count-in
4. Timeline cambia a modo **CIRCULAR**
5. Loop se activa automáticamente
6. **Patrón se reproduce 2 veces** completas
7. Usuario sincroniza con el ritmo:
   - **Teclado (DEFAULT)**: Presiona tecla **ESPACIO**
   - **Micrófono (EXPERIMENTAL)**: Hace sonidos (palmadas, taps)
8. Sistema captura beats y compara con timestamps esperados
9. **Análisis de ritmo**:
   - Timing: ¿Qué tan cerca están los beats del tiempo correcto?
   - Consistencia: ¿Qué tan regular es el tempo?
   - Tempo: ¿El tempo general es correcto?
   - **Accuracy total**: Combinación de las 3 métricas
10. **Resultados**:
    - Muestra precisión (0-100%)
    - ≥40%: Botón "Siguiente Nivel" habilitado
    - <40%: Botón "Siguiente Nivel" deshabilitado
    - "Reintentar": Vuelve a cargar el mismo nivel
    - "Menú": Regresa a selección de niveles

**Modos de Captura**:

#### Teclado (Recomendado) - DEFAULT
- **Tecla**: ESPACIO
- **Ventajas**:
  - Preciso y confiable
  - Funciona en cualquier entorno
  - No requiere permisos de micrófono
  - Feedback visual inmediato (círculo azul)
- **Activación**: Por defecto, o `debugGame.useKeyboard()`

#### Micrófono (Experimental)
- **Detección**: Web Audio API con análisis FFT
- **Calibración automática**: Durante count-in
- **Threshold**: -22 dB mínimo (evita sobre-sensibilidad)
- **Ventajas**:
  - Permite práctica con instrumentos reales
  - Más natural para palmadas/percusión
- **Desventajas**:
  - Puede ser impreciso según entorno auditivo
  - Ruido ambiental afecta detección
  - Auriculares pueden causar sobre-sensibilidad
- **Activación**: `debugGame.useMicrophone()`
- **Debug**:
  - `debugGame.getThreshold()` - Ver sensibilidad
  - `debugGame.setThreshold(-20)` - Ajustar
  - `debugGame.testMicDetection()` - Probar 5 segundos

**Configuración Permisiva**:
- Tolerancia temporal: **300ms** (beats pueden estar ±300ms del tiempo esperado)
- Threshold para pasar nivel: **40%** (solo necesitas 40% precisión para avanzar)
- Threshold para "éxito": **60%** (mensaje "¡Excelente!" a partir de 60%)

### Niveles

#### Nivel 1: Posiciones Impares
- **Requisito**: "Escribe 2 P impares"
- **Solución**: 1, 3
- **Lg**: 4
- **BPM**: 90
- **Dificultad**: Fácil

#### Nivel 2: Posiciones Pares
- **Requisito**: "Escribe 2 P pares (2 y 4)"
- **Solución**: 2, 4
- **Lg**: 4
- **BPM**: 90
- **Dificultad**: Fácil

#### Nivel 3: Dinámico (Aleatorio)
- **Requisito**: Variable (impares, pares, consecutivos, o extremos)
- **Lg**: Aleatorio 5-8
- **BPM**: Aleatorio 80-120
- **Dificultad**: Media
- **Tipos de requisitos**:
  - Impares: "Escribe N P impares"
  - Pares: "Escribe N P pares"
  - Consecutivos: "Escribe 3 P consecutivos"
  - Extremos: "Escribe primera y última P (1 y Lg)"

#### Nivel 4: Modo Libre
- **Requisito**: "Modo libre - Crea tu propio patrón"
- **Lg**: 8 (configurable)
- **BPM**: 100 (configurable)
- **Dificultad**: Variable
- **Validación**: Cualquier patrón con 2-8 posiciones es válido

### Persistencia
- **localStorage**: Niveles completados y estadísticas
- **Progreso guardado**: Se mantiene entre sesiones
- **Intentos registrados**: Todos los intentos con análisis detallado
- **Acceso a datos**: `debugGame.getLastAnalysis()` en consola

### Comandos de Consola

Todos disponibles vía `window.debugGame`:

#### Control del Juego
```javascript
debugGame.quickStartGame()        // Iniciar juego directamente
debugGame.testCompleteFlow()      // Test completo del sistema
```

#### Modo de Captura
```javascript
debugGame.getCaptureMode()        // Ver modo actual
debugGame.useKeyboard()           // Cambiar a teclado [RECOMENDADO]
debugGame.useMicrophone()         // Cambiar a micrófono [EXPERIMENTAL]
```

#### Debug de Micrófono (solo si modo micrófono activo)
```javascript
debugGame.getThreshold()          // Ver threshold actual (dB)
debugGame.setThreshold(-20)       // Cambiar threshold
debugGame.getMicStats()           // Ver configuración completa
debugGame.testMicDetection()      // Test de 5 segundos
debugGame.getLastAnalysis()       // Ver análisis del último intento
```

**Ver documentación completa**: `Apps/App5/GAME_DEBUG.md`

---

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
