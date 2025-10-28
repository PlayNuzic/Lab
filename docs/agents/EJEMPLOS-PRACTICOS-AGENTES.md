# 💡 Ejemplos Prácticos: Agentes + Claude Code en VSCode

## Tabla de Contenidos

1. [Ejemplo 1: Análisis Inicial del Repositorio](#ejemplo-1)
2. [Ejemplo 2: Crear un Nuevo Componente UI](#ejemplo-2)
3. [Ejemplo 3: Mejorar Responsividad de una App](#ejemplo-3)
4. [Ejemplo 4: Crear una Nueva App Completa](#ejemplo-4)
5. [Ejemplo 5: Optimizar Sistema de Audio](#ejemplo-5)
6. [Ejemplo 6: Añadir Gamificación](#ejemplo-6)
7. [Ejemplo 7: Refactoring Seguro](#ejemplo-7)
8. [Ejemplo 8: Debugging con Contexto](#ejemplo-8)

---

## <a name="ejemplo-1"></a>Ejemplo 1: Análisis Inicial del Repositorio

### Objetivo
Entender la estructura del proyecto y qué recursos están disponibles antes de comenzar a trabajar.

### Pasos

**1. Abrir VSCode en el proyecto:**
```bash
cd Lab
code .
```

**2. Iniciar Claude Code:**
```bash
# En el terminal integrado (Ctrl+` o Cmd+`)
claude
```

**3. Contexto inicial:**
```
Hola! Voy a trabajar en el repositorio PlayNuzic Lab. 
Por favor, lee los siguientes archivos para entender el contexto:

1. .claude-code/context.md
2. .claude-code/integration-config.yaml
3. README.md

Después dame un resumen de:
- La filosofía del proyecto
- Las reglas que debes seguir
- Qué puedes y qué NO puedes hacer
```

**4. Análisis de estructura:**
```
Ahora analiza la estructura del repositorio:

1. Lista todas las apps en el directorio Apps/
2. Lista los módulos principales en libs/app-common/
3. Identifica los componentes más reutilizables
4. Muéstrame qué patrones de diseño se usan

Organiza la información en secciones claras.
```

**5. Análisis de agentes:**
```
Ejecuta el siguiente comando y muéstrame los resultados:
cd agents && npm run analyze

Después explica qué información proporcionan los agentes.
```

### Resultado Esperado
Claude te dará un overview completo del proyecto, entenderá las reglas y te mostrará qué recursos tienes disponibles para trabajar.

---

## <a name="ejemplo-2"></a>Ejemplo 2: Crear un Nuevo Componente UI

### Objetivo
Crear un componente de selector de escala musical siguiendo el estilo existente.

### Conversación con Claude Code

```
Quiero crear un nuevo componente UI llamado "ScaleSelector" que 
permita seleccionar escalas musicales (Mayor, Menor, Pentatónica, etc).

REQUISITOS:
1. Debe seguir el estilo minimalista de los componentes existentes
2. Usar el diseño system que ya está en el proyecto
3. NO modificar ningún archivo existente
4. Crear tests para el componente

PASOS:
1. Primero, analiza los componentes UI existentes en libs/app-common/
   para entender el patrón
2. Identifica qué estilos y convenciones se usan
3. Crea el nuevo componente siguiendo esos patrones
4. Crea los tests correspondientes
5. Muéstrame un ejemplo de uso del componente

¿Comenzamos?
```

**Claude responderá con un plan:**
```
📋 Plan de acción:

1. Analizar componentes existentes:
   - libs/app-common/fraction-editor.js
   - libs/app-common/pulse-seq.js
   - libs/app-common/mixer-menu.js

2. Extraer patrones comunes:
   - Estructura de componentes
   - Sistema de estilos
   - API pública (create, update, destroy)
   - Gestión de eventos

3. Crear nuevo componente:
   - libs/app-common/scale-selector.js
   - Siguiendo patrones identificados

4. Crear tests:
   - libs/app-common/__tests__/scale-selector.test.js

5. Documentar uso

¿Procedo con este plan?
```

**Tú apruebas:**
```
Sí, procede con el plan. Muéstrame cada archivo antes de crearlo 
para que pueda revisarlo.
```

**Claude mostrará el código del componente:**
```javascript
// libs/app-common/scale-selector.js
// Componente creado siguiendo el estilo de PlayNuzic Lab
// Basado en: mixer-menu.js y fraction-editor.js

export const createScaleSelector = (config = {}) => {
  const {
    container,
    scales = ['Major', 'Minor', 'Pentatonic', 'Blues', 'Dorian'],
    defaultScale = 'Major',
    onChange = () => {}
  } = config;

  // Estilo minimalista siguiendo patrones existentes
  const style = `
    .scale-selector {
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      background: #ffffff;
      border: 1px solid rgba(0,0,0,0.1);
      padding: 8px;
      border-radius: 4px;
      cursor: pointer;
      transition: all 150ms ease-out;
      user-select: none;
    }
    
    .scale-selector:hover {
      background: rgba(0,0,0,0.05);
    }
    
    .scale-option {
      padding: 6px 12px;
      cursor: pointer;
      transition: background 150ms ease-out;
    }
    
    .scale-option:hover {
      background: rgba(107, 70, 193, 0.1);
    }
    
    .scale-option.selected {
      background: rgba(107, 70, 193, 0.2);
      font-weight: 500;
    }
  `;

  // [... resto del componente ...]
};
```

**Tú revisas y apruebas:**
```
Perfecto! El componente sigue el estilo correctamente. 
Ahora créalo y muéstrame los tests.
```

### Uso del componente nuevo

```javascript
// En tu app
import { createScaleSelector } from '../../libs/app-common/scale-selector.js';

const selector = createScaleSelector({
  container: document.getElementById('scale-container'),
  scales: ['Major', 'Minor', 'Pentatonic'],
  defaultScale: 'Major',
  onChange: (scale) => {
    console.log('Escala seleccionada:', scale);
    // Actualizar audio engine con nueva escala
  }
});
```

---

## <a name="ejemplo-3"></a>Ejemplo 3: Mejorar Responsividad de una App

### Objetivo
Hacer que app1-ritmos-numericos sea más responsive para móviles SIN modificar el código existente.

### Conversación con Claude Code

```
Necesito mejorar la responsividad de app1-ritmos-numericos para móviles.

RESTRICCIONES IMPORTANTES:
- NO puedo modificar ningún archivo existente de app1
- Debo crear archivos nuevos en enhancements/responsive-styles/
- Los estilos deben ser overlays que se apliquen encima

PASOS:
1. Analiza la estructura actual de app1/index.html y app1/styles.css
2. Identifica qué elementos necesitan ajustes para móvil
3. Crea archivos CSS responsive que se puedan importar adicionalmente
4. Crea un script de activación que detecte móvil y aplique estilos
5. Documenta cómo activar la mejora

No modifiques archivos existentes, solo crea nuevos.
```

**Claude responderá:**
```
📋 Plan de mejora responsive:

Análisis de app1:
- Grid de números: Necesita ajuste de tamaño en móvil
- Controles de tempo: Necesitan layout vertical en mobile
- Timeline: Necesita scrolling horizontal en pantallas pequeñas

Archivos a crear:
1. enhancements/responsive-styles/app1-mobile.css
   - Media queries para < 768px
   - Ajustes de layout
   - Touch-friendly sizes (min 44x44px botones)

2. enhancements/responsive-styles/app1-responsive-loader.js
   - Detector de viewport
   - Loader condicional de estilos
   - Ajustes de interacción táctil

3. enhancements/responsive-styles/app1-enhancement.md
   - Documentación de uso
   - Instrucciones de activación

¿Procedo?
```

**Archivos generados:**

**enhancements/responsive-styles/app1-mobile.css:**
```css
/* Mejoras responsive para app1-ritmos-numericos */
/* Se aplican como overlay - NO modifica estilos existentes */

@media (max-width: 768px) {
  /* Grid de números más pequeño */
  .number-grid {
    grid-template-columns: repeat(4, 1fr) !important;
    gap: 8px !important;
  }
  
  .number-cell {
    min-width: 60px !important;
    min-height: 60px !important;
    font-size: 18px !important;
  }
  
  /* Controles en layout vertical */
  .controls-container {
    flex-direction: column !important;
    gap: 12px !important;
  }
  
  /* Timeline con scroll horizontal */
  .timeline {
    overflow-x: auto !important;
    -webkit-overflow-scrolling: touch !important;
  }
  
  /* Botones touch-friendly */
  button, .clickable {
    min-width: 44px !important;
    min-height: 44px !important;
    padding: 12px !important;
  }
}
```

**Activación:**
```html
<!-- En app1/index.html (o crear app1-mobile.html que importe original) -->
<link rel="stylesheet" href="../../enhancements/responsive-styles/app1-mobile.css">
<script type="module" src="../../enhancements/responsive-styles/app1-responsive-loader.js"></script>
```

---

## <a name="ejemplo-4"></a>Ejemplo 4: Crear una Nueva App Completa

### Objetivo
Crear app7-ritmos-geometricos que explora patrones fractales musicales.

### Conversación con Claude Code

```
Quiero crear una nueva app llamada app7-ritmos-geometricos.

CONCEPTO:
- Explorar la relación entre formas geométricas y ritmos
- Usar números de Fibonacci para crear secuencias rítmicas
- Visualización de fractales que generan patrones de pulsos

REQUISITOS:
1. Seguir la estructura exacta de las apps existentes (app1-app6)
2. Reutilizar MÁXIMO código de libs/app-common/
3. Mantener estética minimalista
4. Incluir tests básicos
5. NO modificar ningún código existente

PASOS:
1. Analiza la estructura común de app1-app6
2. Identifica qué componentes de libs/app-common/ podemos reutilizar
3. Crea la nueva app siguiendo el patrón
4. Documenta la app

Primero, analiza las apps existentes y haz un listado de 
componentes reutilizables.
```

**Claude analizará y responderá:**
```
📊 Análisis de apps existentes:

Estructura común:
- index.html (estructura HTML)
- main.js (lógica principal)
- styles.css (estilos específicos)
- README.md (documentación)

Componentes reutilizables de libs/app-common/:
✅ audio-init.js - Inicialización de audio
✅ loop-control.js - Control de loop
✅ dom.js - Helpers de DOM
✅ led-manager.js - Gestión de LEDs
✅ timeline-layout.js - Layout de timeline
✅ subdivision.js - Cálculos temporales
✅ number.js - Utilidades numéricas

Componentes nuevos necesarios:
🆕 fibonacci-generator.js - Generador de secuencias Fibonacci
🆕 fractal-visualizer.js - Visualización de fractales
🆕 geometric-rhythm-mapper.js - Mapeo geometría → ritmo

📋 Plan de creación:

1. Crear estructura base: Apps/app7-ritmos-geometricos/
2. Crear componentes nuevos en libs/app-common/
3. Implementar main.js usando componentes existentes + nuevos
4. Crear visualización de fractales
5. Integrar con audio engine existente
6. Escribir tests
7. Documentar

¿Procedo con la creación?
```

**Tú apruebas y guías:**
```
Sí, procede. Pero crea PRIMERO los componentes nuevos en 
libs/app-common/ y sus tests. Después crea la app.

Empieza con fibonacci-generator.js
```

**Claude creará los componentes paso a paso:**

```javascript
// libs/app-common/fibonacci-generator.js
// Generador de secuencias Fibonacci para ritmos

export const createFibonacciGenerator = () => {
  const generate = (length) => {
    if (length <= 0) return [];
    if (length === 1) return [1];
    if (length === 2) return [1, 1];
    
    const sequence = [1, 1];
    for (let i = 2; i < length; i++) {
      sequence.push(sequence[i-1] + sequence[i-2]);
    }
    return sequence;
  };
  
  const toRhythmicPattern = (fibSequence, maxValue = 16) => {
    // Normalizar valores Fibonacci a rango rítmico
    const max = Math.max(...fibSequence);
    return fibSequence.map(n => 
      Math.round((n / max) * maxValue)
    );
  };
  
  const toGeometricRatio = (fibSequence) => {
    // Calcular ratios entre números consecutivos
    // Converge a phi (1.618...)
    const ratios = [];
    for (let i = 1; i < fibSequence.length; i++) {
      ratios.push(fibSequence[i] / fibSequence[i-1]);
    }
    return ratios;
  };
  
  return {
    generate,
    toRhythmicPattern,
    toGeometricRatio
  };
};
```

**Y su test:**
```javascript
// libs/app-common/__tests__/fibonacci-generator.test.js

import { createFibonacciGenerator } from '../fibonacci-generator.js';

describe('FibonacciGenerator', () => {
  let generator;
  
  beforeEach(() => {
    generator = createFibonacciGenerator();
  });
  
  test('generates correct Fibonacci sequence', () => {
    const sequence = generator.generate(8);
    expect(sequence).toEqual([1, 1, 2, 3, 5, 8, 13, 21]);
  });
  
  test('converts to rhythmic pattern', () => {
    const fib = [1, 1, 2, 3, 5];
    const pattern = generator.toRhythmicPattern(fib, 16);
    expect(pattern[pattern.length - 1]).toBe(16);
    expect(pattern[0]).toBeLessThan(pattern[pattern.length - 1]);
  });
  
  test('calculates geometric ratios', () => {
    const fib = [1, 1, 2, 3, 5, 8, 13];
    const ratios = generator.toGeometricRatio(fib);
    const lastRatio = ratios[ratios.length - 1];
    expect(lastRatio).toBeCloseTo(1.618, 1); // Phi
  });
});
```

**Después de crear todos los componentes, crea la app:**

```javascript
// Apps/app7-ritmos-geometricos/main.js

import { bindAppRhythmElements } from '../../libs/app-common/dom.js';
import { createRhythmAudioInitializer } from '../../libs/app-common/audio-init.js';
import { createRhythmLoopController } from '../../libs/app-common/loop-control.js';
import { createFibonacciGenerator } from '../../libs/app-common/fibonacci-generator.js';
import { createFractalVisualizer } from '../../libs/app-common/fractal-visualizer.js';

// [... implementación de la app ...]
```

### Resultado
Una nueva app completamente funcional que:
- Sigue exactamente el patrón de las apps existentes
- Reutiliza componentes existentes
- Añade funcionalidad nueva sin modificar código existente
- Incluye tests
- Está documentada

---

## <a name="ejemplo-5"></a>Ejemplo 5: Optimizar Sistema de Audio

### Objetivo
Mejorar el performance del sistema de audio sin romper la compatibilidad.

### Conversación con Claude Code

```
Necesito optimizar el sistema de audio del proyecto.

CONTEXTO CRÍTICO:
- El sistema de audio usa browser clock (libs/sound/clock.js)
- Hay cálculos precisos en pulse-interval-calc.js
- Voice sync es crítico para sincronización

RESTRICCIÓN ABSOLUTA:
❌ NO puedo modificar estos archivos críticos
❌ NO puedo romper el timing
❌ NO puedo cambiar las APIs públicas

OBJETIVO:
✅ Reducir latencia de inicio
✅ Mejorar scheduling de eventos
✅ Optimizar gestión de samples
✅ Todo debe ser OPCIONAL y NO INVASIVO

PASOS:
1. Analiza el sistema de audio actual
2. Identifica bottlenecks SIN ejecutar el código
3. Propón optimizaciones como OVERLAYS
4. Crea nuevo módulo de optimización opcional
5. Escribe benchmarks para medir mejoras

Empieza analizando libs/sound/
```

**Claude analizará y propondrá:**
```
📊 Análisis del sistema de audio:

Archivos críticos (NO TOCAR):
- libs/sound/clock.js - Browser clock timing
- libs/app-common/pulse-interval-calc.js - Cálculos precisos
- libs/app-common/voice-sync.js - Sincronización

Oportunidades de optimización:
1. Audio sample preloading
2. Audio context pooling
3. Event scheduling optimization
4. Sample caching

📋 Plan de optimización no invasiva:

Crear nuevo módulo:
libs/app-common/audio-performance-enhancer.js

Este módulo:
- NO modifica archivos existentes
- Se aplica como wrapper opcional
- Mantiene 100% compatibilidad
- Es fácilmente removible

Funcionalidades:
1. Preload inteligente de samples
2. Cache de audio buffers
3. Optimización de scheduling
4. Métricas de performance

¿Procedo con la creación?
```

**Archivo creado:**
```javascript
// libs/app-common/audio-performance-enhancer.js
// Optimizaciones opcionales de performance
// NO modifica el sistema existente - se aplica como wrapper

export const createAudioPerformanceEnhancer = (audioSystem) => {
  const sampleCache = new Map();
  const schedulingQueue = [];
  let metrics = {
    cacheHits: 0,
    cacheMisses: 0,
    avgSchedulingTime: 0
  };
  
  // Wrapper para el método de carga de samples
  const originalLoadSample = audioSystem.loadSample;
  audioSystem.loadSample = async (url) => {
    if (sampleCache.has(url)) {
      metrics.cacheHits++;
      return sampleCache.get(url);
    }
    
    metrics.cacheMisses++;
    const sample = await originalLoadSample.call(audioSystem, url);
    sampleCache.set(url, sample);
    return sample;
  };
  
  // Batch scheduling optimization
  const optimizedSchedule = (events) => {
    const startTime = performance.now();
    
    // Ordenar eventos por tiempo
    const sortedEvents = [...events].sort((a, b) => a.time - b.time);
    
    // Scheduling en batch
    sortedEvents.forEach(event => {
      audioSystem.schedule(event);
    });
    
    const endTime = performance.now();
    metrics.avgSchedulingTime = (metrics.avgSchedulingTime + (endTime - startTime)) / 2;
  };
  
  // Preload de samples comunes
  const preloadCommonSamples = async () => {
    const commonSamples = [
      '/samples/kick.wav',
      '/samples/snare.wav',
      '/samples/hihat.wav'
    ];
    
    await Promise.all(
      commonSamples.map(url => audioSystem.loadSample(url))
    );
  };
  
  // Limpiar cache
  const clearCache = () => {
    sampleCache.clear();
  };
  
  // Obtener métricas
  const getMetrics = () => ({ ...metrics });
  
  // Desactivar optimizaciones
  const disable = () => {
    audioSystem.loadSample = originalLoadSample;
    clearCache();
  };
  
  return {
    optimizedSchedule,
    preloadCommonSamples,
    clearCache,
    getMetrics,
    disable
  };
};
```

**Uso opcional:**
```javascript
// En cualquier app - OPCIONAL
import { createAudioPerformanceEnhancer } from '../../libs/app-common/audio-performance-enhancer.js';

// Después de inicializar audio normal
const audio = await initAudio();

// Aplicar optimizaciones (opcional)
const enhancer = createAudioPerformanceEnhancer(audio);
await enhancer.preloadCommonSamples();

// Ver mejoras
console.log('Performance metrics:', enhancer.getMetrics());

// Si causa problemas, desactivar fácilmente
// enhancer.disable();
```

---

## <a name="ejemplo-6"></a>Ejemplo 6: Añadir Gamificación

### Objetivo
Añadir sistema de logros y progreso sin modificar las apps existentes.

### Conversación con Claude Code

```
Quiero añadir gamificación al proyecto:
- Sistema de logros/achievements
- Tracking de progreso
- Badges visuales

REGLAS:
- NO modificar código de las apps existentes
- Sistema debe ser un overlay completamente opcional
- Se activa/desactiva fácilmente
- No debe afectar performance
- Los datos se guardan en localStorage

Crea un sistema de gamificación modular que se pueda
añadir a cualquier app sin modificarla.
```

**Claude creará:**

```javascript
// enhancements/gamification-overlays/gamification-system.js

export const createGamificationSystem = (appId) => {
  const storageKey = `playnuzic-gamification-${appId}`;
  
  // Definir achievements
  const achievements = {
    firstPattern: {
      id: 'first-pattern',
      title: 'Primer Patrón',
      description: 'Crea tu primer patrón rítmico',
      icon: '🎵',
      unlocked: false
    },
    speedster: {
      id: 'speedster',
      title: 'Velocista',
      description: 'Alcanza 200 BPM',
      icon: '⚡',
      unlocked: false
    },
    explorer: {
      id: 'explorer',
      title: 'Explorador',
      description: 'Prueba todas las apps',
      icon: '🗺️',
      unlocked: false
    }
    // ... más achievements
  };
  
  // Cargar progreso
  const loadProgress = () => {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : { achievements: {}, stats: {} };
  };
  
  // Guardar progreso
  const saveProgress = (progress) => {
    localStorage.setItem(storageKey, JSON.stringify(progress));
  };
  
  // Desbloquear achievement
  const unlock = (achievementId) => {
    const progress = loadProgress();
    if (!progress.achievements[achievementId]) {
      progress.achievements[achievementId] = {
        unlockedAt: Date.now(),
        ...achievements[achievementId]
      };
      saveProgress(progress);
      showUnlockNotification(achievements[achievementId]);
    }
  };
  
  // Mostrar notificación
  const showUnlockNotification = (achievement) => {
    const notification = document.createElement('div');
    notification.className = 'achievement-notification';
    notification.innerHTML = `
      <div class="achievement-content">
        <span class="achievement-icon">${achievement.icon}</span>
        <div>
          <div class="achievement-title">${achievement.title}</div>
          <div class="achievement-desc">${achievement.description}</div>
        </div>
      </div>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 100);
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  };
  
  // UI de gamificación (overlay)
  const createOverlay = () => {
    const overlay = document.createElement('div');
    overlay.className = 'gamification-overlay';
    overlay.innerHTML = `
      <button class="gamification-toggle" aria-label="Ver logros">
        🏆
      </button>
      <div class="gamification-panel" hidden>
        <h3>Logros</h3>
        <div class="achievements-list"></div>
      </div>
    `;
    
    const toggle = overlay.querySelector('.gamification-toggle');
    const panel = overlay.querySelector('.gamification-panel');
    
    toggle.addEventListener('click', () => {
      panel.hidden = !panel.hidden;
      if (!panel.hidden) {
        updateAchievementsList();
      }
    });
    
    document.body.appendChild(overlay);
    return overlay;
  };
  
  // Actualizar lista de achievements
  const updateAchievementsList = () => {
    const progress = loadProgress();
    const list = document.querySelector('.achievements-list');
    
    list.innerHTML = Object.values(achievements)
      .map(ach => {
        const unlocked = progress.achievements[ach.id];
        return `
          <div class="achievement-item ${unlocked ? 'unlocked' : 'locked'}">
            <span class="achievement-icon">${ach.icon}</span>
            <div>
              <div class="achievement-title">${ach.title}</div>
              <div class="achievement-desc">${ach.description}</div>
            </div>
          </div>
        `;
      })
      .join('');
  };
  
  // Tracking automático
  const attachTracking = () => {
    // Observer de eventos sin modificar código existente
    let clickCount = 0;
    let maxTempo = 0;
    
    document.addEventListener('click', () => {
      clickCount++;
      if (clickCount >= 100) {
        unlock('speedster');
      }
    });
    
    // Observer de cambios en inputs de tempo
    const tempoInputs = document.querySelectorAll('input[type="number"]');
    tempoInputs.forEach(input => {
      input.addEventListener('change', (e) => {
        const value = parseInt(e.target.value);
        if (value > maxTempo) {
          maxTempo = value;
          if (maxTempo >= 200) {
            unlock('speedster');
          }
        }
      });
    });
  };
  
  // Inicializar
  const init = () => {
    createOverlay();
    attachTracking();
    injectStyles();
  };
  
  // Inyectar estilos
  const injectStyles = () => {
    const style = document.createElement('style');
    style.textContent = `
      .gamification-overlay {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
      }
      
      .gamification-toggle {
        width: 50px;
        height: 50px;
        border-radius: 50%;
        border: none;
        background: #6B46C1;
        color: white;
        font-size: 24px;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        transition: transform 150ms ease;
      }
      
      .gamification-toggle:hover {
        transform: scale(1.1);
      }
      
      .achievement-notification {
        position: fixed;
        top: 80px;
        right: 20px;
        background: white;
        padding: 16px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        transform: translateX(400px);
        transition: transform 300ms ease-out;
        z-index: 10001;
      }
      
      .achievement-notification.show {
        transform: translateX(0);
      }
      
      /* ... más estilos ... */
    `;
    document.head.appendChild(style);
  };
  
  return {
    init,
    unlock,
    loadProgress
  };
};
```

**Activación (sin modificar apps):**
```html
<!-- Añadir al final del HTML de cualquier app -->
<script type="module">
  import { createGamificationSystem } from '../../enhancements/gamification-overlays/gamification-system.js';
  
  // Inicializar gamificación
  const gamification = createGamificationSystem('app1');
  gamification.init();
  
  // Los achievements se desbloquean automáticamente
  // al detectar acciones del usuario
</script>
```

---

## <a name="ejemplo-7"></a>Ejemplo 7: Refactoring Seguro

### Objetivo
Refactorizar código duplicado sin romper nada.

### Conversación con Claude Code

```
He notado que hay código duplicado entre app2 y app3 relacionado
con el editor de fracciones. Quiero refactorizarlo.

PROCESO SEGURO:
1. Identifica el código duplicado exacto
2. Verifica que fraction-editor.js en libs/ ya existe
3. Propón cómo app2 y app3 deberían usar ese componente
4. Crea una rama de refactoring
5. Muestra los cambios necesarios
6. Crea tests que verifiquen que la funcionalidad no cambia

NO hagas cambios todavía, solo analiza y propón.
```

**Claude analizará:**
```
📊 Análisis de código duplicado:

Código duplicado encontrado:
- app2/main.js líneas 45-120: Editor de fracciones custom
- app3/main.js líneas 67-156: Editor de fracciones similar

Componente compartido existente:
✅ libs/app-common/fraction-editor.js

Diferencias:
- app2: Solo permite fracciones con denominador potencia de 2
- app3: Permite cualquier fracción
- app2: Tiene validación visual inline
- app3: Tiene validación con tooltips

Propuesta de refactoring:

1. Mejorar fraction-editor.js para soportar ambos casos:
   - Añadir opción denominatorConstraint
   - Añadir opción validationStyle

2. Reemplazar código duplicado con:
   ```javascript
   // En app2
   const editor = createFractionEditor({
     container: editorContainer,
     denominatorConstraint: 'powerOfTwo',
     validationStyle: 'inline'
   });
   
   // En app3
   const editor = createFractionEditor({
     container: editorContainer,
     denominatorConstraint: 'any',
     validationStyle: 'tooltip'
   });
   ```

3. Tests de regresión:
   - Test que app2 funciona igual antes/después
   - Test que app3 funciona igual antes/después
   - Test de nuevas opciones en fraction-editor

Beneficios:
- Eliminación de 150+ líneas duplicadas
- Mantenimiento centralizado
- Funcionalidad preservada 100%

¿Procedo con el refactoring?
```

**Proceso seguro:**
```bash
# Claude puede ayudarte a:

# 1. Crear branch
git checkout -b refactor/fraction-editor-unification

# 2. Mejorar componente compartido
# Claude muestra los cambios en fraction-editor.js

# 3. Actualizar apps para usar el componente
# Claude muestra los cambios en app2/main.js y app3/main.js

# 4. Crear tests de regresión
# Claude crea tests que verifican equivalencia funcional

# 5. Verificar que todo funciona
npm test
cd agents && npm run verify

# 6. Si hay problemas, revertir fácilmente
git checkout main
```

---

## <a name="ejemplo-8"></a>Ejemplo 8: Debugging con Contexto

### Objetivo
Debuggear un problema de sincronización usando Claude Code.

### Conversación con Claude Code

```
Tengo un problema: en app4, cuando el tempo supera 180 BPM, 
los pulsos empiezan a desincronizarse del visualizador.

CONTEXTO:
- Esto NO pasaba antes
- Cambié el tempo máximo de 120 a 240 recientemente
- El audio suena bien, pero el visualizador se atrasa

INFORMACIÓN DEL SISTEMA:
- Browser: Chrome 118
- Sistema de clock: libs/sound/clock.js
- Cálculos: libs/app-common/pulse-interval-calc.js
- Visualizador: app4/visualizer.js

NO modifiques archivos críticos (clock, pulse-interval-calc).
Ayúdame a encontrar dónde está el problema.
```

**Claude analizará:**
```
🔍 Proceso de debugging:

1. Revisando sistema de clock...
   - clock.js usa requestAnimationFrame
   - Frecuencia: 60fps
   - ✅ Este sistema es robusto

2. Revisando cálculos de intervalos...
   - pulse-interval-calc.js calcula intervalos correctamente
   - ✅ Cálculos precisos incluso a 240 BPM

3. Revisando visualizer.js...
   - ⚠️ PROBLEMA ENCONTRADO línea 78:
   
   ```javascript
   // Código actual
   const updateInterval = 1000 / tempo; // ms per beat
   
   setInterval(() => {
     updateVisualization();
   }, updateInterval);
   ```
   
   🔴 PROBLEMA: setInterval no es preciso a intervalos cortos
   A 180 BPM: intervalo = 333ms ✅ funciona
   A 200 BPM: intervalo = 300ms ⚠️ empieza a fallar
   A 240 BPM: intervalo = 250ms ❌ drift acumulativo

4. SOLUCIÓN:
   Sincronizar visualizador con el sistema de clock existente
   en lugar de usar setInterval independiente.

Propuesta de fix en app4/visualizer.js:

```javascript
// ANTES (problemático)
const updateInterval = 1000 / tempo;
setInterval(() => {
  updateVisualization();
}, updateInterval);

// DESPUÉS (sincronizado)
import { getClockInstance } from '../../libs/sound/clock.js';

const clock = getClockInstance();
const pulseId = clock.schedulePulse(() => {
  updateVisualization();
}, tempo);
```

Este cambio:
✅ Sincroniza visualización con audio
✅ Usa el sistema de timing preciso existente
✅ Funciona a cualquier tempo
✅ NO modifica archivos críticos

¿Procedo con el fix?
```

**Aplicar fix y verificar:**
```bash
# Claude aplica el cambio
# Ejecutar tests
npm test

# Verificar integridad
cd agents && npm run verify

# Probar en el navegador
# Abrir app4 y probar a 240 BPM
```

---

## 🎯 Resumen de Patrones de Uso

### Patrón 1: Análisis Primero
```
1. Lee contexto (.claude-code/context.md)
2. Analiza estructura existente
3. Identifica componentes reutilizables
4. DESPUÉS propón cambios
```

### Patrón 2: No Invasivo
```
1. Nunca modificar archivos existentes
2. Crear nuevos archivos en directorios apropiados
3. Usar overlays y wrappers
4. Mantener compatibilidad 100%
```

### Patrón 3: Verificación Constante
```
1. Ejecutar tests antes de cambios
2. Ejecutar tests después de cambios
3. Usar npm run verify frecuentemente
4. Usar checkpoints de Claude Code
```

### Patrón 4: Componentes Compartidos
```
1. Siempre buscar en libs/app-common/ primero
2. Si no existe, crear reutilizable
3. Escribir tests para nuevos componentes
4. Documentar en README
```

### Patrón 5: Debugging Sistemático
```
1. Dar contexto completo a Claude
2. Identificar archivos críticos (no tocar)
3. Analizar antes de cambiar
4. Proponer soluciones no invasivas
5. Verificar fix
```

---

## 💡 Tips Finales

1. **Siempre da contexto**: Claude trabaja mejor cuando entiende las reglas
2. **Usa plan mode**: Revisa planes antes de ejecutarlos
3. **Confía en la verificación**: Los agentes y tests son tu red de seguridad
4. **Itera incrementalmente**: Cambios pequeños y verificados
5. **Documenta todo**: Futuros tú te lo agradecerán

---

## 📚 Comandos Útiles de Referencia Rápida

```bash
# Análisis
cd agents && npm run analyze

# Verificación
cd agents && npm run verify

# Tests
npm test

# Claude Code
claude

# Checkpoints (dentro de Claude Code)
# Presionar: Esc Esc
# O comando: /rewind

# Ver historial
# Presionar: Ctrl+r (en Claude Code)

# Cambiar modelo
/model

# Conectar IDE externo
/ide

# Ver configuración
/config
```

---

**¡Estos ejemplos te muestran el poder de combinar agentes inteligentes con Claude Code en VSCode! 🚀**
