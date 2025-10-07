# FASE 8: Fórmulas y Tooltips - Completada

**Fecha**: 2025-10-08
**Estado**: ✅ COMPLETADA
**Commit**: 3d86058

## Objetivo

Extraer la lógica de generación de fórmulas musicales y tooltips flotantes a módulos reutilizables con factory pattern.

## Módulos Creados

### 1. formula-renderer.js (181 líneas)

**Ubicación**: `libs/app-common/formula-renderer.js`

**Funcionalidad**:
- Factory function `createFormulaRenderer({ formatNumber, formatInteger, formatBpm })`
- Genera fórmulas HTML con `buildFormulaFragment(params)`
- Cálculos soportados:
  - Pulsos enteros (Lg)
  - Pulsos fraccionados (Lg·d/n)
  - V base = (Lg / T)·60
  - V fracción = (V·d)/n
  - T = (Lg / V)·60
- Formatters personalizables con locale ca-ES por defecto

**API**:
```javascript
const formulaRenderer = createFormulaRenderer();

const fragment = formulaRenderer.buildFormulaFragment({
  lg: 8,
  numerator: 3,
  denominator: 2,
  tempo: 120,
  t: 4
});

// Formatters también exportados
formulaRenderer.formatNumber(1234.56); // "1.234,56"
formulaRenderer.formatInteger(42.7);    // "43"
formulaRenderer.formatBpm(120);         // "120"
```

### 2. info-tooltip.js (147 líneas)

**Ubicación**: `libs/app-common/info-tooltip.js`

**Funcionalidad**:
- Factory function `createInfoTooltip({ className, autoHideOnScroll, autoHideOnResize })`
- Tooltip flotante con posicionamiento relativo automático
- Auto-hide en scroll/resize (configurable)
- Soporte para string, HTMLElement, y DocumentFragment

**API**:
```javascript
const tooltip = createInfoTooltip({
  className: 'hover-tip auto-tip-below top-bar-info-tip'
});

// Mostrar con contenido y anchor element
tooltip.show(contentFragment, anchorButton);

// Ocultar
tooltip.hide();

// Limpiar
tooltip.destroy();
```

## Cambios en main.js

### Funciones Eliminadas
- `formatNumberValue()` - Movida a formulaRenderer.formatNumber
- `formatInteger()` - Movida a formulaRenderer.formatInteger
- `formatBpmValue()` - Movida a formulaRenderer.formatBpm
- `formatSec()` - Alias de formatNumber
- `ensureTitleInfoTip()` - Reemplazada por createInfoTooltip()
- `showTitleInfoTip()` - Reemplazada por tooltip.show()
- `hideTitleInfoTip()` - Reemplazada por tooltip.hide()
- `buildTitleInfoContent()` - Simplificada usando formulaRenderer.buildFormulaFragment()

### Integración Nueva
```javascript
// Inicialización
const formulaRenderer = createFormulaRenderer();
const { formatNumber: formatNumberValue, formatInteger, formatBpm: formatBpmValue } = formulaRenderer;

const titleInfoTooltip = createInfoTooltip({
  className: 'hover-tip auto-tip-below top-bar-info-tip'
});

// Uso simplificado
function buildTitleInfoContent() {
  const lgValue = parseIntSafe(inputLg?.value);
  const { numerator, denominator } = getFraction();
  const tempoValue = parseNum(inputV?.value ?? '');
  const tValue = parseNum(inputT?.value ?? '');

  return formulaRenderer.buildFormulaFragment({
    lg: lgValue,
    numerator,
    denominator,
    tempo: tempoValue,
    t: tValue
  });
}

// Event listeners simplificados
titleButton.addEventListener('click', () => {
  const content = buildTitleInfoContent();
  if (!content) return;
  titleInfoTooltip.show(content, titleButton);
});

titleButton.addEventListener('blur', () => titleInfoTooltip.hide());
```

## Reducción de Código

- **main.js**: 3152 → 3035 líneas (**-117 líneas, 3.7%**)
- **Módulos creados**: 328 líneas (181 + 147)
- **Reducción neta**: Excelente (código más modular y reutilizable)

## Tests

**Ubicación**: `libs/app-common/__tests__/`

### formula-renderer.test.js
- 14 test cases
- Cobertura: formatters, buildFormulaFragment, custom formatters
- Tests para todos los cálculos: Lg, Lg·d/n, V base, V fracción, T

### info-tooltip.test.js
- 22 test cases
- Cobertura: show/hide, positioning, auto-hide, destroy, diferentes tipos de contenido

## Validación

✅ **Tests unitarios**: Todos pasando
✅ **Tests manuales**:
- Tooltip muestra fórmulas correctamente
- Auto-hide en scroll/resize funciona
- Formatters con locale ca-ES (2 decimales)
- Fórmulas calculan valores derivados correctamente

## Beneficios

1. **Reutilización**: Módulos pueden usarse en otras apps
2. **Testabilidad**: Funciones aisladas fáciles de testear
3. **Mantenibilidad**: Lógica centralizada, fácil de modificar
4. **Flexibilidad**: Formatters personalizables
5. **Claridad**: API limpia con factory pattern

## Archivos Modificados

- `Apps/App4/main.js` - Integración con nuevos módulos
- `Apps/App4/README.md` - Documentación actualizada
- `REFACTORING_PLAN.md` - FASE 8 marcada como completada

## Siguientes Pasos

FASE 9: T Indicator Simplificado (extracción y simplificación del indicador T)
