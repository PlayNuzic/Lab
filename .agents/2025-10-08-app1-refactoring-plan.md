# Plan de Refactoring - App1

**Fecha**: 2025-10-08
**App**: App1 (Línea Temporal)
**Métrica inicial**: 1097 líneas en main.js
**Reducción objetivo**: ~220 líneas (20%)
**Tiempo estimado**: 2-3 días

---

## Análisis Inicial

### Código Actual de App1

**Módulos ya utilizados** de `libs/app-common`:
- ✅ `audio-init.js` - Inicialización de audio
- ✅ `random-menu.js` - Menú de randomización
- ✅ `range.js` - Utilidades de rangos
- ✅ `audio.js` - Scheduling bridge
- ✅ `subdivision.js` - Cálculos de Lg/V/T
- ✅ `audio-schedule.js` - Resync delay
- ✅ `dom.js` - Binding de elementos DOM
- ✅ `led-manager.js` - Gestión de LEDs

**Código específico a refactorizar**:
1. Number utilities (parseNum, formatSec) - ~20 líneas
2. Visual sync (startVisualSync, stopVisualSync, syncVisualState) - ~50 líneas
3. Highlight logic (highlightPulse) - ~25 líneas
4. Timeline circular rendering (animateTimelineCircle + geometría) - ~150 líneas

---

## Fases de Refactoring

### FASE 1: Number Utilities ⭐⭐⭐
**Prioridad**: ALTA - Trivial, sin riesgo, reutilizable en todas las apps

**Objetivo**: Extraer parseNum() y formatSec() a módulo compartido

**Código a extraer** (líneas 500-520):
```javascript
function parseNum(val) {
  if (typeof val !== 'string') return Number(val);
  let s = val.trim();
  // Si hi ha coma i no hi ha punt: format català "1.234,56"
  if (s.includes(',') && !s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    s = s.replace(/,/g, '.');
  }
  const n = parseFloat(s);
  return isNaN(n) ? NaN : n;
}

function formatSec(n) {
  const rounded = Math.round(Number(n) * 100) / 100;
  return rounded.toLocaleString('ca-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}
```

**Módulo a crear**: `libs/app-common/number-utils.js`

**API propuesta**:
```javascript
export function createNumberFormatter(options = {}) {
  const { locale = 'ca-ES', maxDecimals = 2 } = options;

  function parseNum(val) { ... }
  function formatNumber(n, decimals = maxDecimals) { ... }

  return { parseNum, formatNumber };
}
```

**Integración en App1**:
```javascript
import { createNumberFormatter } from '../../libs/app-common/number-utils.js';

const { parseNum, formatNumber: formatSec } = createNumberFormatter();
```

**Reducción estimada**: ~15 líneas
**Tiempo estimado**: 30 minutos
**Riesgo**: Muy bajo
**Apps aplicables**: App1, App2, App3, App4 (todas usan parseNum similar)

---

### FASE 2: Visual Sync ⭐⭐⭐
**Prioridad**: ALTA - Reutilizar módulo existente de App4

**Objetivo**: Adaptar `visual-sync.js` de App4 para App1

**Código a reemplazar** (líneas 1008-1033):
```javascript
function stopVisualSync() {
  if (visualSyncHandle != null) {
    cancelAnimationFrame(visualSyncHandle);
    visualSyncHandle = null;
  }
  lastVisualStep = null;
}

function syncVisualState() {
  if (!isPlaying || !audio || typeof audio.getVisualState !== 'function') return;
  const state = audio.getVisualState();
  if (!state || !Number.isFinite(state.step)) return;
  if (lastVisualStep === state.step) return;
  highlightPulse(state.step);
}

function startVisualSync() {
  stopVisualSync();
  const step = () => {
    visualSyncHandle = null;
    if (!isPlaying || !audio) return;
    syncVisualState();
    visualSyncHandle = requestAnimationFrame(step);
  };
  visualSyncHandle = requestAnimationFrame(step);
}
```

**Módulo existente**: `libs/app-common/visual-sync.js` (de App4)

**Modificación necesaria**: El módulo de App4 ya existe, solo necesita adaptarse ligeramente

**Integración en App1**:
```javascript
import { createVisualSync } from '../../libs/app-common/visual-sync.js';

const visualSync = createVisualSync({
  getAudio: () => audio,
  getIsPlaying: () => isPlaying,
  onStep: (step) => highlightPulse(step)
});

// Usar:
visualSync.start();
visualSync.stop();
```

**Reducción estimada**: ~40 líneas
**Tiempo estimado**: 1 hora
**Riesgo**: Bajo
**Apps aplicables**: App1, App4 (ya lo tiene)

---

### FASE 3: Highlight Controller ⭐⭐
**Prioridad**: MEDIA - Adaptar módulo existente de App4

**Objetivo**: Simplificar `highlight-controller.js` de App4 para uso en App1

**Código a reemplazar** (líneas 982-1006):
```javascript
function highlightPulse(i) {
  pulses.forEach(p => p.classList.remove('active'));

  if (!pulses || pulses.length === 0) return;

  const idx = i % pulses.length;
  const current = pulses[idx];
  if (current) {
    void current.offsetWidth;
    current.classList.add('active');
  }

  if (loopEnabled && idx === 0) {
    const last = pulses[pulses.length - 1];
    if (last) last.classList.add('active');
  }

  if (Number.isFinite(i)) {
    lastVisualStep = Number(i);
  }
}
```

**Módulo a adaptar**: `libs/app-common/highlight-controller.js` (simplificado)

**Problema**: El módulo de App4 es muy complejo (517 líneas, diseñado para pulseSeq)

**Solución**: Crear versión simplificada `simple-highlight-controller.js`

**API propuesta**:
```javascript
export function createSimpleHighlightController(options = {}) {
  const {
    getPulses,
    getLoopEnabled,
    highlightClass = 'active'
  } = options;

  function highlightPulse(index) { ... }
  function clearHighlights() { ... }

  return { highlightPulse, clearHighlights };
}
```

**Integración en App1**:
```javascript
import { createSimpleHighlightController } from '../../libs/app-common/simple-highlight-controller.js';

const highlightController = createSimpleHighlightController({
  getPulses: () => pulses,
  getLoopEnabled: () => loopEnabled
});

// Usar:
highlightController.highlightPulse(i);
```

**Reducción estimada**: ~20 líneas
**Tiempo estimado**: 1 hora
**Riesgo**: Bajo
**Apps aplicables**: App1, App2, App3 (apps sin pulseSeq)

---

### FASE 4: Timeline Circular ⭐⭐⭐
**Prioridad**: ALTA - NUEVO módulo, usado por las 4 apps

**Objetivo**: Extraer geometría de timeline circular a módulo reutilizable

**Código a extraer** (líneas 685-891, principalmente 709-828):
```javascript
function renderTimeline() {
  timeline.innerHTML = '';
  pulses = [];
  const lg = parseInt(inputLg.value);
  if(isNaN(lg) || lg <= 0) return;

  for (let i = 0; i <= lg; i++) {
    const p = document.createElement('div');
    p.className = 'pulse';
    p.dataset.index = i;
    if (i === 0 || i === lg) p.classList.add('endpoint');
    timeline.appendChild(p);
    pulses.push(p);

    if (i === 0 || i === lg) {
      const bar = document.createElement('div');
      bar.className = 'bar endpoint';
      timeline.appendChild(bar);
    }
  }
  animateTimelineCircle(loopEnabled && circularTimeline, { silent: true });
  updateNumbers();
}

function animateTimelineCircle(isCircular, opts = {}) {
  // ~120 líneas de geometría circular compleja
  // - Cálculo de posiciones en círculo
  // - Rotación de barras
  // - Posicionamiento de números
  // - Transiciones CSS
}
```

**Módulo a crear**: `libs/app-common/circular-timeline.js`

**API propuesta**:
```javascript
export function createCircularTimeline(options = {}) {
  const {
    timeline,           // elemento DOM del timeline
    timelineWrapper,    // contenedor padre
    getPulses,          // getter para array de pulsos
    onRenderComplete    // callback después de renderizar
  } = options;

  function render(lg) {
    // Crea pulsos y barras
  }

  function setCircular(isCircular, opts = {}) {
    // Geometría circular vs lineal
  }

  function updateNumberPositions(hideThreshold = 100) {
    // Actualiza posiciones de números
  }

  return { render, setCircular, updateNumberPositions };
}
```

**Integración en App1**:
```javascript
import { createCircularTimeline } from '../../libs/app-common/circular-timeline.js';

const timelineController = createCircularTimeline({
  timeline,
  timelineWrapper,
  getPulses: () => pulses,
  onRenderComplete: () => updateNumbers()
});

// Usar:
timelineController.render(lg);
timelineController.setCircular(loopEnabled && circularTimeline);
```

**Reducción estimada**: ~150 líneas
**Tiempo estimado**: 4-6 horas
**Riesgo**: Medio-Alto (geometría compleja, CSS crítico)
**Apps aplicables**: **App1, App2, App3, App4** (todas usan timeline circular)

**Consideraciones especiales**:
- Geometría SVG vs DOM positioning
- Transiciones CSS deben preservarse
- Números de pulsos con positioning dinámico
- Modo linear vs circular con animaciones

---

## Orden de Implementación Recomendado

### Día 1: Fases Simples (3.5 horas)
1. ✅ **FASE 1: Number Utilities** (30 min) - Sin riesgo, warm-up
2. ✅ **FASE 2: Visual Sync** (1 hora) - Reutilizar existente
3. ✅ **FASE 3: Highlight Controller** (1 hora) - Simplificación de existente
4. ✅ **Testing manual** (1 hora) - Verificar que todo funciona

### Día 2-3: Fase Compleja (6-8 horas)
5. ⚠️ **FASE 4: Timeline Circular** (4-6 horas) - Nueva abstracción compleja
6. ⚠️ **Testing exhaustivo** (2 horas) - Modo circular, números, animaciones

---

## Métricas Objetivo

### Reducción Total
- **FASE 1**: ~15 líneas
- **FASE 2**: ~40 líneas
- **FASE 3**: ~20 líneas
- **FASE 4**: ~150 líneas
- **Total**: ~225 líneas (20.5% de 1097)

### Estado Final Esperado
- **Inicial**: 1097 líneas
- **Final**: ~872 líneas
- **Reducción**: 225 líneas (20.5%)

### Módulos Creados
1. `libs/app-common/number-utils.js` (~40 líneas) - NUEVO
2. `libs/app-common/simple-highlight-controller.js` (~60 líneas) - NUEVO
3. `libs/app-common/circular-timeline.js` (~200 líneas) - NUEVO ⭐

**Total código extraído**: ~300 líneas en módulos reutilizables

---

## Tests a Crear

### `libs/app-common/__tests__/number-utils.test.js`
```javascript
describe('createNumberFormatter', () => {
  it('should parse Catalan format with comma', () => {
    const { parseNum } = createNumberFormatter();
    expect(parseNum('1.234,56')).toBe(1234.56);
  });

  it('should format with locale', () => {
    const { formatNumber } = createNumberFormatter();
    expect(formatNumber(1234.56)).toBe('1.234,56');
  });
});
```

### `libs/app-common/__tests__/simple-highlight-controller.test.js`
```javascript
describe('createSimpleHighlightController', () => {
  it('should highlight pulse at index', () => { ... });
  it('should highlight last pulse when loop enabled at index 0', () => { ... });
});
```

### `libs/app-common/__tests__/circular-timeline.test.js`
```javascript
describe('createCircularTimeline', () => {
  it('should render pulses linearly', () => { ... });
  it('should transition to circular mode', () => { ... });
  it('should position numbers correctly', () => { ... });
});
```

**Total tests esperados**: ~30-40 tests

---

## Riesgos y Mitigaciones

### Riesgo 1: Geometría circular compleja
**Probabilidad**: Alta
**Impacto**: Alto (visual crítico)
**Mitigación**:
- Crear branch separado para FASE 4
- Testing visual exhaustivo en las 4 apps
- Preservar CSS original como referencia
- Implementar modo "fallback" linear si falla circular

### Riesgo 2: Compatibilidad entre apps
**Probabilidad**: Media
**Impacto**: Medio
**Mitigación**:
- API flexible con callbacks opcionales
- Opciones configurables para comportamiento específico
- Testing en App1 primero, luego validar en otras apps

### Riesgo 3: Performance de animaciones
**Probabilidad**: Baja
**Impacto**: Medio
**Mitigación**:
- Usar requestAnimationFrame consistentemente
- CSS transitions en lugar de JS cuando sea posible
- Profiling con DevTools antes/después

---

## Beneficios Esperados

### Inmediatos (App1)
1. ✅ Reducción 20% de código
2. ✅ Código más testeable
3. ✅ Mejor mantenibilidad

### A Largo Plazo (4 Apps)
1. ✅ **circular-timeline.js** reutilizable en App2, App3, App4
2. ✅ **number-utils.js** elimina duplicación en 4 apps
3. ✅ Consistencia visual entre apps
4. ✅ Bugs se arreglan una vez, benefician a todas

---

## Checklist de Implementación

### Pre-requisitos
- [ ] Branch: `refactor/app1-phase1-4`
- [ ] Backup de App1/main.js
- [ ] Tests de regresión manual preparados

### FASE 1: Number Utilities
- [ ] Crear `libs/app-common/number-utils.js`
- [ ] Crear tests en `__tests__/number-utils.test.js`
- [ ] Integrar en App1/main.js
- [ ] Verificar que inputs funcionan (parseNum)
- [ ] Verificar que fórmula se muestra bien (formatSec)
- [ ] Commit: `feat(app1): FASE 1 - Extract number utilities`

### FASE 2: Visual Sync
- [ ] Revisar `libs/app-common/visual-sync.js` existente
- [ ] Adaptar si es necesario para App1
- [ ] Integrar en App1/main.js
- [ ] Verificar highlighting durante playback
- [ ] Verificar que se detiene correctamente
- [ ] Commit: `feat(app1): FASE 2 - Integrate visual sync module`

### FASE 3: Highlight Controller
- [ ] Crear `libs/app-common/simple-highlight-controller.js`
- [ ] Crear tests en `__tests__/simple-highlight-controller.test.js`
- [ ] Integrar en App1/main.js
- [ ] Verificar highlighting de pulsos
- [ ] Verificar loop highlighting (pulse 0 + último)
- [ ] Commit: `feat(app1): FASE 3 - Extract simple highlight controller`

### FASE 4: Timeline Circular
- [ ] Crear `libs/app-common/circular-timeline.js`
- [ ] Crear tests en `__tests__/circular-timeline.test.js`
- [ ] Integrar en App1/main.js
- [ ] Verificar modo linear
- [ ] Verificar modo circular
- [ ] Verificar transiciones
- [ ] Verificar números de pulsos
- [ ] Verificar barras en endpoints
- [ ] Testing en App2, App3, App4
- [ ] Commit: `feat(app1): FASE 4 - Extract circular timeline module`

### Final
- [ ] Ejecutar `npm test`
- [ ] Testing manual completo en App1
- [ ] Actualizar README.md de App1
- [ ] Crear `.agents/2025-10-08-app1-refactoring.md`
- [ ] Merge a main

---

## Próximos Pasos Después de App1

1. **Aplicar circular-timeline.js a App2, App3, App4**
2. **Aplicar number-utils.js a todas las apps**
3. **Documentar patrones de uso**
4. **Considerar otras oportunidades de refactoring**

---

*Generado: 2025-10-08*
*Basado en: Análisis de App1 (1097 líneas) y experiencia de App4*
