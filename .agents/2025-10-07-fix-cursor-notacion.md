# Fix: Cursor de Notación Sincronizado

**Fecha**: 2025-10-07
**Agente**: Claude Sonnet 4.5
**Tipo**: Bug Fix
**Impacto**: Alto (funcionalidad crítica de sincronización visual)

---

## Problema Reportado

El cursor de sincronización en la partitura musical (notación VexFlow) no era visible ni se movía durante el playback en App4.

**Síntomas**:
- Cursor siempre al inicio de la partitura
- No se sincroniza con el audio durante reproducción
- Había funcionado anteriormente pero se perdió en alguna refactorización

**Contexto del usuario**:
> "Vamos ahora a recuperar el último issue que veo antes de pasar a fase 5. El cursor sincronizado de la partitura. Lo hemos vuelto a perder. Ya ha pasado antes. Ahora se ve siempre al inicio y no se mueve."

---

## Análisis

### Archivos Investigados

1. **`/Users/workingburcet/Lab/libs/notation/rhythm-staff.js`**
   - Implementación del cursor (líneas 236-436)
   - `ensureCursor()` - Crea elemento DOM del cursor
   - `updateCursor(currentPulse, isPlaying)` - Sincroniza posición
   - `resetCursor()` - Resetea al pulso 0
   - El código del cursor estaba correcto

2. **`/Users/workingburcet/Lab/libs/app-common/visual-sync.js`**
   - Gestión de sincronización visual con RAF
   - Líneas 82-91: Actualización del cursor de notación
   - **CLAVE**: Espera `getNotationRenderer` como **función** (línea 82-83)

3. **`/Users/workingburcet/Lab/Apps/App4/main.js`**
   - Inicialización del `visualSyncManager` (línea 2783-2793)
   - **ERROR ENCONTRADO**: Línea 2788 pasaba `notationRenderer` como objeto directo en lugar de función getter

4. **`/Users/workingburcet/Lab/Apps/App2/main.js`** (referencia funcionando)
   - Implementa sincronización manualmente (línea 1834-1836)
   - Llama directamente a `notationRenderer.updateCursor()`
   - Por eso funcionaba en App2

### Causa Raíz

**Incompatibilidad de tipo de parámetro:**

`visual-sync.js` (líneas 82-85):
```javascript
const notationRenderer = typeof getNotationRenderer === 'function'
  ? getNotationRenderer()
  : null;
```

Espera que `getNotationRenderer` sea una **función** que devuelva el renderer.

**App4 main.js** (línea 2788 - INCORRECTO):
```javascript
visualSyncManager = createVisualSyncManager({
  getAudio: () => audio,
  getIsPlaying: () => isPlaying,
  getLoopEnabled: () => loopEnabled,
  highlightController,
  notationRenderer,  // ❌ Objeto directo
  // ...
});
```

Pasaba `notationRenderer` directamente, causando que:
1. `typeof getNotationRenderer === 'function'` → `false`
2. `notationRenderer` se evaluara como `null`
3. `updateCursor()` nunca se ejecutara

---

## Solución Implementada

### Cambio Aplicado

**Archivo**: `/Users/workingburcet/Lab/Apps/App4/main.js`
**Línea**: 2788

```diff
  visualSyncManager = createVisualSyncManager({
    getAudio: () => audio,
    getIsPlaying: () => isPlaying,
    getLoopEnabled: () => loopEnabled,
    highlightController,
-   notationRenderer,
+   getNotationRenderer: () => notationRenderer,
    getPulses: () => pulses,
    onResolutionChange: (newResolution) => {
      currentAudioResolution = newResolution;
    }
  });
```

### Por Qué Funciona

1. `visual-sync.js` ahora recibe `getNotationRenderer` como función
2. `typeof getNotationRenderer === 'function'` → `true`
3. `getNotationRenderer()` devuelve el renderer actual dinámicamente
4. `updateCursor(currentPulse, isPlaying)` se ejecuta correctamente en cada frame

### Ventajas de Esta Solución

- **Consistencia**: Sigue el patrón de otros getters (`getAudio`, `getIsPlaying`, etc.)
- **Dinamicidad**: Permite que el renderer cambie en runtime
- **Compatibilidad**: Mantiene el contrato de `visual-sync.js`

---

## Validación

### Tests Realizados

✅ **Cursor visible al cargar**: Aparece en pulso 0
✅ **Sincronización durante playback**: Se mueve con el audio
✅ **Reseteo al detener**: Vuelve al pulso 0
✅ **Auto-scroll**: Canvas de notación hace scroll automático para seguir cursor
✅ **Compatibilidad**: No afecta highlighting de pulsos ni fracciones

### Comportamiento Esperado

- Cursor visible al abrir panel de notación
- Durante playback:
  - Cursor se mueve sincronizado con audio
  - Sigue pulsos enteros y fracciones
  - Auto-scroll mantiene cursor visible
- Al detener:
  - Cursor vuelve a pulso 0
  - Se mantiene visible

---

## Documentación Actualizada

### Archivos Modificados

1. **`REFACTORING_PLAN.md`** (líneas 1966-2110)
   - Sección "Bug Crítico Resuelto" agregada
   - Propuesta de FASE 5 documentada

2. **`Apps/App4/README.md`** (líneas 22, 41-45, 64-70)
   - Sincronización de notación explicada
   - Nuevos módulos listados en imports
   - Historial de cambios agregado

3. **`.agents/2025-10-07-fix-cursor-notacion.md`** (este documento)
   - Análisis completo del bug
   - Solución documentada
   - Validación registrada

---

## Lecciones Aprendidas

1. **Contratos de API**: Revisar siempre la firma esperada de callbacks/getters
2. **Type Checking**: TypeScript habría detectado este error en compilación
3. **Consistencia de Patterns**: Todos los parámetros dinámicos deberían ser getters
4. **Testing de Integración**: Test específico para `visualSyncManager` habría detectado el bug
5. **Documentación**: Explicitar tipo esperado en JSDoc de `visual-sync.js`

---

## Mejoras Recomendadas

### Corto Plazo
- [ ] Añadir JSDoc explícito en `visual-sync.js`:
  ```javascript
  /**
   * @param {object} config
   * @param {() => Function} config.getNotationRenderer - Función que devuelve renderer
   */
  ```

### Mediano Plazo
- [ ] Crear test de integración para `visualSyncManager + rhythm-staff`
- [ ] Validar que App2 también use el patrón de getter (actualmente sincroniza manualmente)

### Largo Plazo
- [ ] Considerar migrar a TypeScript para apps críticas
- [ ] Refactorizar App2 para usar `visualSyncManager` consistentemente

---

## Referencias

- **Issue Original**: Mencionado en conversación del usuario, había ocurrido antes
- **Solución Previa**: Problema 1 resuelto anteriormente en `rhythm-staff.js:389-390`
- **Módulos Relacionados**:
  - `libs/notation/rhythm-staff.js` - Implementación del cursor
  - `libs/app-common/visual-sync.js` - Loop de sincronización
  - `libs/app-common/highlight-controller.js` - Highlighting de pulsos

---

**Estado Final**: ✅ RESUELTO Y VALIDADO
**Próximos Pasos**: Continuar con FASE 5 del plan de refactorización (renderTimeline modular)
