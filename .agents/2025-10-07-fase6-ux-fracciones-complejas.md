# FASE 6: UX Mejora - "Activar fracciones complejas" como opción global

**Fecha**: 2025-10-07
**Contexto**: Refactorización App4 - Mejora de experiencia de usuario

## Objetivo

Migrar el checkbox "Permitir fracciones complejas" desde el menú random local de App4 hacia el menú de opciones compartidas en `header.js`, convirtiéndolo en una preferencia global persistente que controla la editabilidad del numerador en el editor de fracciones.

## Motivación

- **UX mejorada**: Control centralizado de una funcionalidad clave
- **Persistencia**: Configuración guardada entre sesiones
- **Claridad**: Separar configuración global de parámetros de randomización
- **Consistencia**: Preparar la opción para uso en otras apps del Lab

## Implementación

### 1. Checkbox en UI compartida

**Archivos modificados**:
- `libs/shared-ui/header.js:456` - Añadido checkbox al template HTML
- `libs/shared-ui/header.js:212-225` - Lógica de persistencia y eventos
- `libs/shared-ui/header.js:239-246` - Factory reset restaura a `false`
- `libs/app-common/template.js:151` - Añadido checkbox al template de `renderApp()`

**Comportamiento**:
```javascript
// Estado persistente
localStorage.getItem('enableComplexFractions') // 'true' | 'false' | null
// Default: false (modo simple)

// Evento custom
window.dispatchEvent(new CustomEvent('sharedui:complexfractions', {
  detail: { value: boolean, source: 'shared-header' | 'factory-reset' }
}));
```

### 2. Control de modo en fraction-editor.js

**Métodos añadidos**:

```javascript
setSimpleMode() {
  // Placeholder: "n" → "1"
  // Input: disabled, readOnly, value = "1"
  // Spinners: disabled
  // Si numerador ≠ 1, emite setFraction({ numerator: 1 }, { cause: 'simple-mode' })
}

setComplexMode() {
  // Placeholder: "1" → "n"
  // Input: enabled, editable
  // Spinners: enabled
}
```

**Modificaciones estructurales**:
- `elements.fields.numerator`: Añadidas propiedades `up` y `down` para referencias a botones
- `attachField()`: Guarda referencias a spinners para acceso posterior

### 3. Módulo random-fractional.js

**Archivo creado**: `libs/app-common/random-fractional.js` (234 líneas)

**Función principal**:
```javascript
export function randomizeFractional({
  randomConfig,
  randomDefaults,
  inputs: { inputLg, inputV, inputT },
  fractionEditor,
  pulseMemoryApi,
  fractionStore,
  randomCount,
  isIntegerPulseSelectable,
  nearestPulseIndex,
  applyRandomFractionSelection,
  getAllowComplexFractions, // () => localStorage.getItem('enableComplexFractions') === 'true'
  callbacks: {
    onLgChange,
    onVChange,
    onFractionChange,
    onPulsesChange,
    renderNotation
  }
})
```

**Funciones auxiliares extraídas**:
- `prepareRandomRanges()` - Respeta `allowComplex` para rango de numerador
- `buildFractionUpdates()` - Construye actualizaciones n/d
- `randomizePulses()` - Randomiza selección de pulsos
- `selectRandomPulses()` - Selección por densidad o conteo
- `clampToRange()` - Clamp de valores
- `setValue()` - Helper para setear inputs

### 4. Integración en main.js

**Listener de eventos** (líneas 1033-1095):
```javascript
function initComplexFractionsState() {
  const stored = localStorage.getItem('enableComplexFractions');
  const enabled = stored === 'true'; // Default: false

  if (fractionEditorController) {
    if (enabled) {
      fractionEditorController.setComplexMode();
    } else {
      fractionEditorController.setSimpleMode();
    }
  }
  updateRandomMenuComplexState(enabled);
}

window.addEventListener('sharedui:complexfractions', (e) => {
  const enabled = e.detail.value;
  // Aplicar a fraction editor
  // Actualizar estado de random menu
  // Re-renderizar timeline
});

initComplexFractionsState();
```

**Función randomize() reemplazada** (líneas 1750-1794):
```javascript
function randomize() {
  randomizeFractional({
    // ... configuración
    getAllowComplexFractions: () => {
      const stored = localStorage.getItem('enableComplexFractions');
      return stored === 'true';
    },
    callbacks: {
      onLgChange: ({ value, input }) => handleInput({ target: input }),
      onVChange: ({ value, input }) => handleInput({ target: input }),
      onFractionChange: (updates) => { /* fallback */ },
      onPulsesChange: ({ selected, fractionsApplied }) => {
        syncSelectedFromMemory();
        updatePulseNumbers();
        layoutTimeline({ silent: true });
        rebuildFractionSelections();
        if (fractionsApplied && isPlaying) {
          applySelectionToAudio();
        }
      },
      renderNotation: () => renderNotationIfVisible()
    }
  });
}
```

### 5. Limpieza de código legacy

**Archivo**: `Apps/App4/index.html`
- **Eliminadas líneas 58-61**: Checkbox duplicado del random menu

**Archivo**: `Apps/App4/fraction-selection.js`
- **Línea 21**: Eliminado `allowComplex: true` de `randomDefaults`
- **Línea 414**: Eliminado de `applyRandomConfig()`
- **Línea 430**: Eliminado de `updateRandomConfig()`

## Métricas

### Líneas de código
- **main.js**: 3308 → 3296 líneas (-12 líneas, aunque se añadió lógica)
- **random-fractional.js**: +234 líneas (nuevo módulo)
- **fraction-editor.js**: +72 líneas netas (métodos nuevos)
- **Reducción total acumulada**: 929 líneas desde inicio (22% del original 4225)

### Archivos modificados
- `libs/shared-ui/header.js`
- `libs/app-common/template.js`
- `libs/app-common/fraction-editor.js`
- `libs/app-common/random-fractional.js` (creado)
- `Apps/App4/main.js`
- `Apps/App4/index.html`
- `Apps/App4/fraction-selection.js`

## Comportamiento esperado

### Modo Simple (default: `enableComplexFractions = false`)
- Placeholder numerador: "1"
- Input numerador: `disabled`, `readOnly`, `value="1"`
- Spinners numerador: `disabled`, opacidad 0.5
- Tooltip: "Activar fracciones complejas en Opciones para editar"
- Random: Solo randomiza denominador, numerador fijo en 1

### Modo Complejo (`enableComplexFractions = true`)
- Placeholder numerador: "n"
- Input numerador: `enabled`, editable
- Spinners numerador: `enabled`, interactivos
- Random: Randomiza tanto numerador como denominador según rangos configurados

### Persistencia
- `localStorage.enableComplexFractions`: `'true'` | `'false'` | `null` (default: false)
- Factory reset: Restaura a `false`
- Cambio emite evento `sharedui:complexfractions` con `detail.value`

## Tests manuales realizados

✅ Checkbox visible en menú Opciones
✅ Estado default: desmarcado (modo simple)
✅ Placeholder dinámico: "1/d" → "n/d"
✅ Numerador bloqueado en modo simple
✅ Spinners deshabilitados en modo simple
✅ Activación/desactivación dinámica funcional

**Pendiente**: Tests completos de integración con randomización

## Problemas encontrados y soluciones

### Error 1: `numeratorInput is not defined`
**Causa**: Variables locales fuera del scope del closure
**Solución**: Acceso a `elements.numerator` y `elements.fields.numerator.up/down` dentro de métodos

### Error 2: Checkbox no aparece en menú
**Causa**: `template.js` genera su propio HTML sin el checkbox
**Solución**: Añadir checkbox tanto en `header.js` como en `template.js`

### Error 3: Placeholder se solapa con valor "1"
**Causa**: Placeholder estático "n" visible con input=1
**Solución**: Placeholder dinámico actualizado en `setSimpleMode()`/`setComplexMode()`

## Próximos pasos (FASE 7)

Candidatos para modularización:
1. **Notación renderer** (~200-300 líneas)
2. **Pulse sequence handlers** (~150-200 líneas)
3. **Input handlers** (Lg/V/T) (~100-150 líneas)
4. **Audio initialization** (~100 líneas)

Meta: Reducir main.js a <3000 líneas (~30% reducción total)
