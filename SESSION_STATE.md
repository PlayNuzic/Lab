# Estado de Sesión - 2025-12-23

## Tarea Actual
Implementar Opción C: Pool de BufferSources para reducir latencia de instrumentos (~20-50ms → ~1-3ms)

## Contexto
Los instrumentos (piano/violin) usando Tone.js tienen ~20-50ms de latencia adicional comparado con samples del metrónomo (~1-3ms). Esto es debido a:
- Tone.Sampler tiene múltiples capas de abstracción
- `triggerAttackRelease()` no es sample-accurate
- Interpolación de muestras añade latencia
- Envelope ADSR interno de Tone.js

## Estado
- [x] Análisis de latencia completado (Agente Audio)
- [x] Decisión: Implementar Opción C (Pool de BufferSources)
- [x] Análisis de Tone.Sampler buffer extraction
- [x] Crear `libs/sound/sampler-pool.js` (~280 líneas)
- [x] Implementar BufferSource pool con recycling
- [x] Añadir envelope ADSR manual con GainNodes
- [x] Integrar con `melodic-audio.js`
- [x] Escribir tests (14 tests, todos pasando)
- [ ] Probar mejora de latencia en App12/App19

## Archivos Creados/Modificados

### Nuevos
- `libs/sound/sampler-pool.js` - Pool de BufferSources con ADSR manual
- `libs/sound/__tests__/sampler-pool.test.js` - 14 tests

### Modificados
- `libs/sound/melodic-audio.js` - Integración con SamplerPool
  - Nuevo: `_samplerPool`, `_useLowLatencyMode`
  - Nuevo: `setLowLatencyMode()`, `isLowLatencyMode()`
  - Modificado: `playNote()`, `playChord()`, `stop()`

## Características Implementadas
1. **Extracción de buffers**: Lee buffers de Tone.Sampler después de Tone.loaded()
2. **Pool de voices**: Múltiples notas simultáneas con recycling automático
3. **ADSR manual**: Envelope con GainNodes (attack, decay, sustain, release)
4. **Detuning**: Interpolación para notas entre samples disponibles
5. **Presets ADSR**: piano, violin, pluck, pad
6. **Fallback**: Si el pool falla, usa Tone.js directamente

## Notas Importantes
- NO modificar: clock.js, pulse-interval-calc.js, voice-sync.js
- Low-latency mode habilitado por defecto
- Duck-typing para AudioBuffer (compatibilidad con tests)

## Commits realizados esta sesión
1. `eb9139d` - Feat: Add inverted arc display for negative-value FX knobs

## Próximos Pasos
1. Probar en App12/App19 para verificar mejora de latencia
2. Commit de sampler-pool
3. (Opcional) Añadir control en UI para toggle low-latency mode
