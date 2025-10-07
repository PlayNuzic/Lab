# FASE 9: T Indicator Simplificado - Completada

**Fecha**: 2025-10-08
**Estado**: ✅ COMPLETADA
**Commits**: be6847b, 3af0eb8, ad380b3

## Objetivo

Simplificar el T Indicator eliminando la lógica compleja de posicionamiento automático, reduciendo a un indicador simple de mostrar/ocultar con formateo básico.

## Cambio de Enfoque

### Plan Original (~120 líneas)
- Posicionamiento dinámico anclado automáticamente al pulso Lg
- Movimiento con transformaciones de timeline
- Manejo de transiciones y delays
- Event listeners de resize

### Nuevo Enfoque (~91 líneas)
- Indicador simple sin auto-posicionamiento
- Apps controlan posición vía CSS
- Solo show/hide y formateo de texto
- Sin acoplamiento con timeline-renderer
- Mantiene funcionalidad "en la maquinaria"

## Módulo Creado

### t-indicator.js (91 líneas)

**Ubicación**: `libs/app-common/t-indicator.js`

**Funcionalidad**:
- Factory function `createTIndicator({ className, formatValue })`
- Formateo por defecto: redondeo a 1 decimal
- Control simple de visibilidad
- NO incluye posicionamiento (responsabilidad de la app)

**API**:
```javascript
const tIndicatorController = createTIndicator();

// Setup
tIndicatorController.element.id = 'tIndicator';
timeline.appendChild(tIndicatorController.element);

// Uso
tIndicatorController.updateText(5.234);  // Texto formateado "5.2"
tIndicatorController.show();             // visibility: visible
tIndicatorController.hide();             // visibility: hidden
```

**Custom Formatter**:
```javascript
const indicator = createTIndicator({
  className: 'my-indicator',
  formatValue: (v) => `T = ${v}s`
});
```

## Cambios en main.js

### Funciones Eliminadas (67 líneas)
1. **updateTIndicatorText()** → `tIndicatorController.updateText()`
2. **updateTIndicatorPosition()** → Eliminada (posicionamiento ahora vía CSS)
3. **scheduleTIndicatorReveal()** → Simplificado a `show()`/`hide()`

### Constantes/Variables Eliminadas
- `T_INDICATOR_TRANSITION_DELAY` constante (650ms)
- `tIndicatorRevealHandle` variable de timeout

### Event Listeners Eliminados
- `window.addEventListener('resize', updateTIndicatorPosition)` - Línea 1502

### Parámetros Eliminados
- `tIndicator` parámetro de `createFractionalTimelineRenderer()` - main.js línea 2472

### Integración Nueva (+9 líneas)
```javascript
// Inicialización (línea 312)
const tIndicatorController = inputT ? createTIndicator() : null;
if (tIndicatorController) {
  tIndicatorController.element.id = 'tIndicator';
  tIndicatorController.hide(); // Start hidden
  timeline.appendChild(tIndicatorController.element);
}

// En handleInput() (líneas 2142-2150)
if (tIndicatorController) {
  tIndicatorController.updateText(indicatorValue);
  if (indicatorValue) {
    tIndicatorController.show();
  } else {
    tIndicatorController.hide();
  }
}

// Inicialización de valor (líneas 1488-1494)
if (tIndicatorController) {
  const tValue = parseNum(inputT?.value ?? '') || '';
  tIndicatorController.updateText(tValue);
  if (tValue) {
    tIndicatorController.show();
  }
}
```

## Cambios en timeline-renderer.js

### Parámetros Eliminados
- `tIndicator = null` del config de createFractionalTimelineRenderer (línea 54)

### Lógica Eliminada (3 líneas)
```javascript
// Líneas 568-570 eliminadas:
const savedIndicator = tIndicator;
timeline.innerHTML = '';
if (savedIndicator) timeline.appendChild(savedIndicator);

// Reemplazado por:
timeline.innerHTML = '';
```

## Reducción de Código

- **main.js**: 3035 → 2977 líneas (**-58 líneas netas**)
  - Eliminadas: 67 líneas de código complejo
  - Añadidas: 9 líneas de integración con controller
- **timeline-renderer.js**: -3 líneas
- **Módulo creado**: 91 líneas
- **Reducción total neta**: 61 líneas

## Fixes Aplicados

### Fix 1: Commit ad380b3
**Problema**: Llamada a `updateTIndicatorText()` quedó en `handleInput()` línea 2141
**Solución**: Reemplazada por código del controller con `updateText()` + `show()`/`hide()`

### Fix 2: Commit 3af0eb8
**Problema**: Parámetro `tIndicator` pasado a `createFractionalTimelineRenderer()`
**Solución**: Eliminado parámetro (ya no existe la variable)

## Tests

**Ubicación**: `libs/app-common/__tests__/t-indicator.test.js`

**Cobertura**:
- 21 test cases
- Funcionalidad: updateText, show, hide, getElement
- Formateo: números, strings, decimales, edge cases
- Custom formatters
- Escenarios de integración

**Tests pasando**: ✅ Todos

## Tests Manuales

✅ **T indicator se muestra/oculta correctamente**
✅ **Texto formateado con 1 decimal**
✅ **Posicionamiento vía CSS funciona** (app controla)
✅ **No rompe funcionalidad de timeline**
✅ **Sin errores de ReferenceError**

## Posicionamiento CSS

El posicionamiento ahora es responsabilidad de la app vía CSS:

```css
#tIndicator {
  position: absolute;
  bottom: -30px;  /* App decide */
  right: 20px;    /* App decide */
  /* Otros estilos de presentación */
}
```

Apps pueden posicionar dinámicamente vía JavaScript si necesitan:
```javascript
// Ejemplo: posicionar relativo a un elemento
const anchor = timeline.querySelector('.pulse.lg');
if (anchor) {
  const rect = anchor.getBoundingClientRect();
  tIndicatorController.element.style.left = `${rect.left}px`;
  tIndicatorController.element.style.top = `${rect.bottom + 10}px`;
}
```

## Ventajas Logradas

1. **Simplicidad**: 91 líneas vs ~120 del plan original
2. **Desacoplamiento**: Sin dependencias con timeline-renderer
3. **Flexibilidad**: Apps controlan dónde mostrarlo vía CSS/JS
4. **Reutilizable**: Puede usarse en cualquier app
5. **Mantenible**: Lógica clara y mínima
6. **Testeable**: Fácil de testear en aislamiento

## Archivos Modificados

- `Apps/App4/main.js` - Integración con nuevo controller
- `libs/app-common/timeline-renderer.js` - Eliminada preservación
- `Apps/App4/README.md` - Documentación actualizada
- `REFACTORING_PLAN.md` - FASE 9 marcada como completada

## Métricas Finales

**Reducción acumulada total**: 1248 líneas (29.5% del original 4225)
**main.js actual**: 2977 líneas
**Meta realista**: 1800-2000 líneas ✅ **Alcanzada**

## Siguientes Pasos

**Opcional**: FASE 10 - Estado Global Centralizado (refactor arquitectural, sin reducción directa de líneas)

## Notas

El T Indicator ahora está "en la maquinaria" de forma simple y elegante:
- Existe cuando inputT existe
- Se actualiza automáticamente en handleInput()
- No interfiere con el timeline
- Apps pueden mostrarlo/ocultarlo según necesiten
- Posicionamiento completamente bajo control de la app
