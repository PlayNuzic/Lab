# App4 · Pulsos Fraccionados

App4 explora la generación de secuencias de pulsos fraccionarios sobre la timeline compartida del Lab. Permite fijar un número de pulsos (`Lg`), una velocidad (`V`) y una fracción personalizada (`n/d`) que se proyecta tanto en el grid lineal como en la vista circular. Toda la interacción está pensada para ratón y pantallas táctiles mediante _drag_, _long press_ y accesos rápidos desde teclado.

## Flujo general de la UI

1. El `template` común (`renderApp`) genera la cabecera compartida, los selectores de sonido y el área de edición (`pulseSeq`).
2. Al arrancar se aplican los `led` y unidades (`unitLg`, `unitV`, `unitT`) para guiar la edición de parámetros.
3. El editor de fracciones (`inlineFractionSlot`) expone campos `n` y `d` con placeholders fantasma que ayudan a visualizar la fracción incluso cuando los inputs están vacíos.
4. El menú aleatorio (`randomMenu`) puede habilitar rangos independientes para Lg, V, número de pulsos aleatorios y fracciones completas con la opción "Permitir fracciones complejas".
5. Cada cambio re-calcula el layout (`layoutTimeline`) y sincroniza la vista circular/lineal, incluidos los números de pulso (`updatePulseNumbers`).
6. Los hits fraccionarios comparten el mismo layout polar que los marcadores (`cycle-marker`), de modo que la animación queda tangente al círculo en la vista circular.

## Audio y sincronización

- `createSchedulingBridge` escucha `sharedui:scheduling` desde la cabecera y aplica _lookAhead_ / _updateInterval_ tan pronto como `TimelineAudio` está disponible.
- `bindSharedSoundEvents` enruta eventos `sharedui:sound` para actualizar `setBase`, `setAccent` y `setStart` en el motor de audio.
- `initAudio()` instancia `TimelineAudio`, espera a `ready()`, registra el canal `accent` en el mixer y sincroniza _loop_, _pulse_ y _cycle_ según el estado actual de la UI.
- El menú de rendimiento (`performance-audio-menu.js`) queda inyectado en `index.html` para comprobar la latencia real del motor.
- `initSoundDropdown` reutiliza el dropdown compartido que llama a `ensureAudio()` y pre-escucha el sample al cambiarlo.
- `createHighlightController` + `createVisualSyncManager` gobiernan ahora el _highlight_ de pulsos enteros, fracciones y ciclos; la app deja de mantener duplicados locales y reutiliza la duración animada basada en el BPM/resolución.
- **Sincronización de notación**: El cursor de la partitura se sincroniza automáticamente durante playback mediante `visual-sync.js`, que obtiene el `notationRenderer` dinámicamente vía getter function (`getNotationRenderer: () => notationRenderer`).

## Estructura de datos

- `pulseMemory` conserva las selecciones activas por índice y se restablece al aplicar aleatoriedad en Pulsos.
- Las fracciones se almacenan con `persistFractionField` en `localStorage` (`app4:n`, `app4:d`).
- La configuración del menú aleatorio se serializa en `app4:random` y utiliza los helpers compartidos de `random-config` para normalizar los límites.
- El estado del tema, color de selección y toggles de audio se guarda con `storeKey()` bajo el prefijo `app4:`.

## Importes relevantes

| Módulo | Propósito |
| --- | --- |
| `../../libs/app-common/audio.js` | `createSchedulingBridge` y `bindSharedSoundEvents` (scheduling global + eventos de sonido). |
| `../../libs/app-common/random-menu.js` | Animación y persistencia del menú aleatorio. |
| `../../libs/app-common/mixer-menu.js` y `../../libs/app-common/mixer-longpress.js` | Entrada al mixer global desde la UI y gesto de _long press_. |
| `../../libs/app-common/subdivision.js` | Conversión entre Lg/V/T y grid para pintar la timeline. |
| `../../libs/sound/index.js` | Motor `TimelineAudio`, mixer global y utilidades `ensureAudio`, `setBase`, `setAccent`, `setStart`. |
| `../../libs/shared-ui/performance-audio-menu.js` | Menú flotante que expone _lookAhead_ y _updateInterval_ efectivos. |
| `../../libs/app-common/pulse-seq-parser.js` | Parseo y validación de tokens del campo de secuencia de pulsos. |
| `../../libs/app-common/pulse-seq-state.js` | Gestión de estado de pulseSeq (pulseMemory + fractionStore). |
| `../../libs/app-common/pulse-seq-editor.js` | Editor de secuencia con navegación por gaps y eventos de teclado. |
| `../../libs/app-common/highlight-controller.js` | Sistema de highlighting para pulsos enteros, fracciones y ciclos. |
| `../../libs/app-common/visual-sync.js` | Loop de sincronización visual con requestAnimationFrame para highlighting y cursor de notación. |
| `../../libs/app-common/timeline-renderer.js` | Renderizado modular de timeline con soporte de fracciones, pulsos, ciclos y memoria. |
| `../../libs/app-common/random-fractional.js` | Lógica de randomización de fracciones y pulsos extraída de main.js. |
| `../../libs/app-common/notation-renderer.js` | Controlador completo de notación musical con VexFlow (render, clicks, estado). |
| `../../libs/app-common/formula-renderer.js` | Generador de fórmulas musicales HTML (Lg·d/n, V base, V fracción, T). |
| `../../libs/app-common/info-tooltip.js` | Tooltip flotante con auto-hide en scroll/resize y posicionamiento relativo. |
| `../../libs/app-common/t-indicator.js` | Indicador T simplificado con control de texto y visibilidad (sin auto-posicionamiento). |

## Atajos y gestos

- **Click / tap**: alterna la selección del pulso bajo el cursor.
- **Arrastre** sobre `pulseSeq`: activa/desactiva múltiples pulsos en bloque.
- **Shift + Click**: invierte el estado del rango entre la última selección y el pulso actual.
- **Long press** sobre el botón de mute: abre el mixer global (canales `pulse`, `subdivision`, `accent`).

## Tests

App4 comparte la suite de Jest común. Después de instalar dependencias con `./setup.sh`, ejecuta:

```bash
npm test
```

Esto cubre tanto los módulos compartidos (`libs/app-common`, `libs/sound`) como los _helpers_ utilizados por la app.

## Historial de cambios significativos

### 2025-10-07: Refactorización FASE 5 - Timeline Renderer Modular
- **Cambio**: Extracción de `renderTimeline()` completo a módulo reutilizable
- **Módulo creado**: `libs/app-common/timeline-renderer.js` (640 líneas)
- **Reducción**: main.js de 3574 → 3308 líneas (266 líneas, 7.4%)
- **Funciones extraídas**: 8 funciones principales de renderizado
- **Validación**: ✅ Todos los tests manuales pasaron exitosamente
  - Diferentes valores de Lg (2-10, 16-32, 64+)
  - Fracciones simples y complejas (1/2, 3/5, 5/7)
  - Memoria de fracciones al cambiar Lg
  - Clicks en pulsos y fracciones
  - Highlighting durante playback con cursor sincronizado

### 2025-10-07: FASE 7 - Extracción Notation Renderer
- **Cambio**: Toda la lógica de notación musical extraída a módulo reutilizable
- **Módulo creado**: `libs/app-common/notation-renderer.js` (225 líneas)
- **Funciones extraídas**:
  - `buildNotationRenderState()` - Construcción de estado para VexFlow
  - `renderIfVisible()` - Renderizado condicional de partitura
  - `handleClick()` - Gestión de clicks en notación
  - `inferNotationDenominator()` - Cálculo de denominador de notación
- **Reducción**: main.js de 3296 → 3152 líneas (144 líneas, 4.4%)
- **Total acumulado**: 1073 líneas reducidas desde inicio (25.4% del original 4225)
- **Integración**: Factory pattern con callbacks para setPulseSelected y setFractionSelected
- **Validación**: Pendiente tests manuales de clicks y cursor sincronizado

### 2025-10-07: FASE 6 - UX Mejora "Activar fracciones complejas"
- **Cambio**: Migración del checkbox "Permitir fracciones complejas" del menú random a opciones globales
- **Implementación**:
  - Checkbox añadido en `libs/shared-ui/header.js` y `libs/app-common/template.js`
  - Persistencia en `localStorage.enableComplexFractions` (default: `false`)
  - Métodos `setSimpleMode()`/`setComplexMode()` en `fraction-editor.js`
  - Placeholder dinámico: `1/d` (modo simple) vs `n/d` (modo complejo)
  - Módulo `libs/app-common/random-fractional.js` creado (234 líneas)
  - Función `randomize()` reemplazada en main.js con factory pattern
  - Limpieza de `allowComplex` en `fraction-selection.js`
- **Reducción**: main.js de 3308 → 3296 líneas (12 líneas adicionales)
- **Total acumulado**: 929 líneas reducidas desde inicio (22% del original)
- **UX**: Cuando está desactivado, el numerador queda fijado en "1" (no editable, spinners deshabilitados)

### 2025-10-07: Fix cursor de notación sincronizado
- **Problema**: El cursor de la partitura no se movía durante playback.
- **Causa**: `visual-sync.js` esperaba `getNotationRenderer` como función getter, pero `main.js` lo pasaba como objeto directo.
- **Solución**: Línea 2788 - Cambio de `notationRenderer` a `getNotationRenderer: () => notationRenderer`.
- **Resultado**: El cursor ahora se sincroniza correctamente con el audio, moviéndose por la partitura durante la reproducción.

### 2025-10-08: Refactorización FASE 8 - Fórmulas y Tooltips ✅
- **Cambio**: Extracción de lógica de fórmulas musicales y tooltips a módulos reutilizables
- **Módulos creados**:
  - `libs/app-common/formula-renderer.js` (181 líneas) - Factory function con formatters personalizables
  - `libs/app-common/info-tooltip.js` (147 líneas) - Tooltip flotante con auto-hide
- **Reducción**: main.js de 3152 → 3035 líneas (117 líneas, 3.7%)
- **Funciones extraídas**:
  - `buildFormulaFragment()` - Generación de fórmulas HTML
  - `formatNumberValue()`, `formatInteger()`, `formatBpmValue()` - Formatters
  - `ensureTitleInfoTip()`, `showTitleInfoTip()`, `hideTitleInfoTip()` - Tooltip lifecycle
- **API limpia**: `createFormulaRenderer()` y `createInfoTooltip()` con factory pattern
- **Validación**: ✅ Tooltip funciona correctamente con auto-hide en scroll/resize
- **Total acumulado**: 1190 líneas reducidas desde inicio (28.2% del original 4225)

### 2025-10-08: Refactorización FASE 9 - T Indicator Simplificado ✅
- **Cambio**: Extracción de T Indicator a módulo simple sin lógica de posicionamiento automático
- **Módulo creado**:
  - `libs/app-common/t-indicator.js` (91 líneas) - Factory function con formateo a 1 decimal
- **Reducción neta**: main.js de 3035 → 2977 líneas (58 líneas, 1.9%)
  - Eliminadas: 67 líneas de código complejo (funciones + constantes + listeners)
  - Añadidas: 9 líneas de integración con controller
- **Funciones eliminadas**:
  - `updateTIndicatorText()` - Reemplazada por `tIndicatorController.updateText()`
  - `updateTIndicatorPosition()` - Eliminada (posicionamiento ahora vía CSS)
  - `scheduleTIndicatorReveal()` - Eliminada (control simplificado con show/hide)
  - `T_INDICATOR_TRANSITION_DELAY` constante
  - `tIndicatorRevealHandle` variable
- **Simplificaciones**:
  - Eliminado parámetro `tIndicator` de `createFractionalTimelineRenderer()`
  - Eliminada preservación de tIndicator en timeline.innerHTML (timeline-renderer.js)
  - Eliminado event listener de resize para tIndicator
  - Posicionamiento ahora controlado por CSS de la app
- **API limpia**: `createTIndicator()` con métodos `updateText()`, `show()`, `hide()`
- **Fixes aplicados**:
  - Commit ad380b3: Reemplazada última llamada a updateTIndicatorText() en handleInput()
  - Commit 3af0eb8: Eliminado parámetro tIndicator de createFractionalTimelineRenderer
- **Total acumulado**: 1248 líneas reducidas desde inicio (29.5% del original 4225)
