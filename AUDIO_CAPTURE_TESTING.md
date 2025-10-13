# Guía de Testing: Sistema de Captura de Audio (Fase 2b)

## Testing Rápido desde la Consola del Navegador

### Preparación

1. Abre cualquiera de las Apps 2-5 con Live Server (puerto 8080)
2. Abre la consola del navegador (F12)
3. Asegúrate de que el servidor API está corriendo en puerto 3000

### ⚠️ IMPORTANTE: Sintaxis de Imports en Consola

La consola del navegador NO soporta `import` estático. Usa **import dinámico** con `await`:

```javascript
// ❌ NO FUNCIONA en consola:
import { checkSupport } from '../../libs/audio-capture/index.js';

// ✅ SÍ FUNCIONA en consola:
const { checkSupport } = await import('../../libs/audio-capture/index.js');
```

Todos los ejemplos a continuación usan la sintaxis correcta con `await import()`.

---

### Test 1: Verificar Soporte del Sistema ✅

```javascript
const { checkSupport } = await import('../../libs/audio-capture/index.js');

const support = checkSupport();
console.log('Soporte:', support);
// Debe mostrar: { microphone: true, keyboard: true, overall: true }
```

---

### Test 2: Captura de Teclado (Sin Micrófono) ⌨️

**Test simple de 5 segundos:**

```javascript
const { createKeyboardCapture } = await import('../../libs/audio-capture/index.js');

const kbd = createKeyboardCapture({ visualFeedback: true });
kbd.startRecording();
console.log('🎹 Presiona ESPACIO al ritmo durante 5 segundos...');

setTimeout(() => {
  const taps = kbd.stopRecording();
  console.log(`✅ Capturados ${taps.length} taps:`, taps);
  kbd.dispose();
}, 5000);
```

**Deberías ver:**
- Un círculo azul flotante en la esquina inferior derecha con emoji ⌨️
- El círculo se ilumina y crece al presionar ESPACIO
- Después de 5 segundos, una lista de timestamps en ms

---

### Test 3: Análisis de Ritmo 🎵

**Generar patrón y comparar tu ritmo:**

```javascript
const {
  createKeyboardCapture,
  createRhythmAnalyzer,
  generateExpectedPattern
} = await import('../../libs/audio-capture/index.js');

// Configurar
const kbd = createKeyboardCapture({ visualFeedback: true });
const analyzer = createRhythmAnalyzer();

// Generar patrón de 120 BPM, 8 beats
const expected = generateExpectedPattern(120, 8);
console.log('🎯 Patrón esperado (120 BPM, 8 beats):', expected);
console.log('📍 Debes presionar ESPACIO cada 500ms aproximadamente');

// Capturar
kbd.startRecording();
console.log('🎹 ¡Empieza a tocar!');

setTimeout(() => {
  const recorded = kbd.stopRecording();
  console.log('🎤 Tu ritmo:', recorded);

  // Analizar
  const result = analyzer.compareRhythm(recorded, expected);
  console.log('📊 RESULTADOS:');
  console.log(`   Accuracy Total: ${result.accuracy}%`);
  console.log(`   Timing: ${result.timingAccuracy}%`);
  console.log(`   Consistency: ${result.consistencyScore}%`);
  console.log(`   Tempo: ${result.tempoAccuracy}%`);
  console.log(`   Missed: ${result.missedTaps} / Extra: ${result.extraTaps}`);
  console.log(`   💬 ${result.message}`);

  kbd.dispose();
}, 5000);
```

**Interpretación de resultados:**
- **90-100%**: ¡Excelente! Ritmo casi perfecto
- **75-89%**: Muy bien, pequeñas desviaciones
- **60-74%**: Bien, practica el tempo
- **40-59%**: Regular, mejora la precisión
- **0-39%**: Sigue practicando

---

### Test 4: Detección de Tempo 🎵

**Detectar tu tempo libre:**

```javascript
const { createKeyboardCapture, createRhythmAnalyzer } = await import('../../libs/audio-capture/index.js');

const kbd = createKeyboardCapture({ visualFeedback: true });
const analyzer = createRhythmAnalyzer();

kbd.startRecording();
console.log('🎹 Presiona ESPACIO 8 veces a tu ritmo natural...');

setTimeout(() => {
  const taps = kbd.stopRecording();

  // Detectar tempo
  const tempo = analyzer.detectTempo(taps);
  console.log('🎵 TEMPO DETECTADO:');
  console.log(`   BPM: ${tempo.bpm}`);
  console.log(`   Confianza: ${Math.round(tempo.confidence * 100)}%`);
  console.log(`   Intervalo promedio: ${Math.round(tempo.avgInterval)}ms`);
  console.log(`   💬 ${tempo.message}`);

  kbd.dispose();
}, 10000);
```

**Referencias de BPM:**
- 60-80 BPM: Muy lento (balada)
- 90-110 BPM: Moderado (pop, rock)
- 120-140 BPM: Rápido (dance, electrónica)
- 150+ BPM: Muy rápido (techno, hardcore)

---

### Test 5: Sistema Completo (Teclado + Micrófono) 🎤⌨️

**IMPORTANTE:** Este test requiere permisos de micrófono. El navegador te pedirá autorización.

```javascript
const { createCaptureSystem } = await import('../../libs/audio-capture/index.js');

// Crear sistema completo
const system = await createCaptureSystem({
  microphone: {
    threshold: -30,  // Ajustar según tu micrófono (-50 = muy sensible, -20 = poco sensible)
    minInterval: 100,
    onBeatDetected: (event) => {
      console.log(`🎤 Beat #${event.beatNumber} @ ${Math.round(event.timestamp)}ms (${event.level.toFixed(1)} dB)`);
    }
  },
  keyboard: {
    visualFeedback: true,
    onTapDetected: (event) => {
      console.log(`⌨️ Tap #${event.tapNumber} @ ${Math.round(event.timestamp)}ms`);
    }
  }
});

if (!system.micInitialized) {
  console.warn('⚠️ Micrófono no disponible - solo teclado');
} else {
  console.log('✅ Sistema completo inicializado (mic + keyboard)');
}

// Captura combinada
console.log('🎙️ Iniciando captura combinada (10 segundos)...');
console.log('💡 Prueba: palmadas + ESPACIO mezclados');

await system.combined.startRecording();

setTimeout(() => {
  const results = system.combined.stopRecording();

  console.log('📊 RESULTADOS COMBINADOS:');
  console.log(`   🎤 Eventos de micrófono: ${results.microphone.length}`);
  console.log(`   ⌨️ Eventos de teclado: ${results.keyboard.length}`);
  console.log(`   📦 Total eventos: ${results.totalEvents}`);
  console.log('   📋 Timeline unificado:', results.combined);

  system.dispose();
}, 10000);
```

**Consejos para este test:**
- Da palmadas cerca del micrófono
- Presiona ESPACIO con ritmo
- Mira la consola en tiempo real para ver la detección
- Si no detecta palmadas, baja el threshold a -35 o -40

---

### Test 6: Análisis de Ritmo Libre 🎨

**Improvisar y detectar patrones:**

```javascript
const { createKeyboardCapture, createRhythmAnalyzer } = await import('../../libs/audio-capture/index.js');

const kbd = createKeyboardCapture({ visualFeedback: true });
const analyzer = createRhythmAnalyzer();

kbd.startRecording();
console.log('🎹 Improvisa un ritmo libre durante 10 segundos...');
console.log('💡 Intenta crear un patrón repetitivo');

setTimeout(() => {
  const taps = kbd.stopRecording();

  // Analizar ritmo libre
  const analysis = analyzer.analyzeFreeRhythm(taps);

  console.log('🎨 ANÁLISIS DE RITMO LIBRE:');
  console.log(`   🎵 BPM: ${Math.round(analysis.tempo.bpm)}`);
  console.log(`   📊 Consistencia: ${Math.round(analysis.consistency * 100)}%`);
  console.log(`   🔢 Total taps: ${analysis.totalTaps}`);
  console.log(`   ⏱️ Duración: ${Math.round(analysis.duration / 1000)}s`);
  console.log('   🔍 Patrones detectados:');
  analysis.patterns.forEach((pattern, i) => {
    console.log(`      ${i + 1}. Intervalo ${pattern.interval}ms (${pattern.bpm} BPM) × ${pattern.occurrences} veces`);
  });
  console.log(`   💬 ${analysis.message}`);

  kbd.dispose();
}, 10000);
```

**Qué busca este análisis:**
- Intervalos repetidos (patrones rítmicos)
- Consistencia del tempo
- Agrupaciones de beats similares

---

### Test 7: Helper - Generar Patrón de Fracciones 🎼

**Convertir notación musical a timestamps:**

```javascript
const { fractionsToTimestamps } = await import('../../libs/audio-capture/index.js');

// Patrón: redonda, blanca, negra, corchea (en un compás de 4/4)
const pattern = [1, 0.5, 0.25, 0.125];
const timestamps = fractionsToTimestamps(pattern, 120, 0);

console.log('🎼 Patrón de fracciones (120 BPM):');
console.log('   Redonda (1)    @ 0ms');
console.log('   Blanca (1/2)   @', Math.round(timestamps[1]), 'ms');
console.log('   Negra (1/4)    @', Math.round(timestamps[2]), 'ms');
console.log('   Corchea (1/8)  @', Math.round(timestamps[3]), 'ms');
console.log('\nTimestamps completos:', timestamps);
```

**Valores de fracción comunes:**
- `1` = Redonda (whole note)
- `0.5` = Blanca (half note)
- `0.25` = Negra (quarter note)
- `0.125` = Corchea (eighth note)
- `0.0625` = Semicorchea (sixteenth note)

---

### Test 8: Monitorear Nivel de Micrófono en Tiempo Real 📊

**Ver el nivel del micrófono continuamente:**

```javascript
const { createMicrophoneCapture } = await import('../../libs/audio-capture/index.js');

const mic = createMicrophoneCapture();
const initialized = await mic.initialize();

if (!initialized) {
  console.error('❌ No se pudo inicializar el micrófono');
} else {
  console.log('📊 Monitoreando nivel de micrófono (10 segundos)...');
  console.log('💡 Habla, aplaude o haz ruido cerca del micrófono');

  const interval = setInterval(() => {
    const level = mic.getCurrentLevel();
    const bars = '█'.repeat(Math.max(0, Math.floor((level + 60) / 2)));
    console.log(`${level.toFixed(1)} dB ${bars}`);
  }, 200);

  setTimeout(() => {
    clearInterval(interval);
    mic.dispose();
    console.log('✅ Monitoreo finalizado');
  }, 10000);
}
```

**Interpretación de niveles:**
- `-60 dB` = Silencio
- `-40 dB` = Ruido ambiental
- `-30 dB` = Voz normal
- `-20 dB` = Voz alta
- `-10 dB` = Palmada/grito
- `0 dB` = Máximo (clipping)

---

### Test 9: Ajustar Configuración en Tiempo Real ⚙️

**Experimentar con diferentes configuraciones:**

```javascript
const { createRhythmAnalyzer } = await import('../../libs/audio-capture/index.js');

// Crear con configuración estricta
const strictAnalyzer = createRhythmAnalyzer({
  timingTolerance: 50,   // Solo ±50ms de tolerancia
  tempoTolerance: 5,     // Solo ±5 BPM
  weights: {
    timing: 0.7,         // 70% peso en timing
    consistency: 0.2,
    tempo: 0.1
  }
});

// Crear con configuración relajada
const relaxedAnalyzer = createRhythmAnalyzer({
  timingTolerance: 200,  // ±200ms de tolerancia
  tempoTolerance: 20,    // ±20 BPM
  weights: {
    timing: 0.3,
    consistency: 0.5,    // 50% peso en consistencia
    tempo: 0.2
  }
});

console.log('✅ Analizadores creados:');
console.log('   - strictAnalyzer: muy exigente');
console.log('   - relaxedAnalyzer: más permisivo');
console.log('\nÚsalos en compareRhythm() para ver diferentes resultados');
```

---

### Test 10: Flujo Completo - Ejercicio de Práctica 🎯

**Ejercicio guiado paso a paso:**

```javascript
const {
  createKeyboardCapture,
  createRhythmAnalyzer,
  generateExpectedPattern
} = await import('../../libs/audio-capture/index.js');

console.log('🎯 EJERCICIO DE RITMO - NIVEL 1');
console.log('================================\n');

// Paso 1: Mostrar objetivo
const bpm = 100;
const beats = 4;
const expected = generateExpectedPattern(bpm, beats);

console.log(`📋 Objetivo: ${beats} beats a ${bpm} BPM`);
console.log(`⏱️ Intervalo: ${Math.round(60000 / bpm)}ms entre beats`);
console.log(`\n💡 TIP: Cuenta "1, 2, 3, 4" a ritmo constante\n`);

// Paso 2: Preparar captura
const kbd = createKeyboardCapture({ visualFeedback: true });
const analyzer = createRhythmAnalyzer();

// Paso 3: Dar cuenta regresiva
console.log('⏳ Preparándote...');
await new Promise(resolve => setTimeout(resolve, 2000));

console.log('3...');
await new Promise(resolve => setTimeout(resolve, 1000));
console.log('2...');
await new Promise(resolve => setTimeout(resolve, 1000));
console.log('1...');
await new Promise(resolve => setTimeout(resolve, 1000));
console.log('🎹 ¡AHORA! Presiona ESPACIO 4 veces\n');

// Paso 4: Capturar
kbd.startRecording();

await new Promise(resolve => setTimeout(resolve, 5000));

const recorded = kbd.stopRecording();
kbd.dispose();

// Paso 5: Analizar y mostrar resultados
const result = analyzer.compareRhythm(recorded, expected);

console.log('\n📊 RESULTADOS DEL EJERCICIO:');
console.log('================================');
console.log(`🎯 Accuracy: ${result.accuracy}%`);
console.log(`⏱️ Timing: ${result.timingAccuracy}%`);
console.log(`📊 Consistencia: ${result.consistencyScore}%`);
console.log(`🎵 Tempo: ${result.tempoAccuracy}%`);
console.log(`\n📈 Estadísticas:`);
console.log(`   - Taps correctos: ${result.totalTaps - result.missedTaps - result.extraTaps}`);
console.log(`   - Taps perdidos: ${result.missedTaps}`);
console.log(`   - Taps extra: ${result.extraTaps}`);
console.log(`\n💬 Feedback: ${result.message}`);

if (result.accuracy >= 90) {
  console.log('\n🏆 ¡EXCELENTE! Nivel completado');
} else if (result.accuracy >= 75) {
  console.log('\n⭐ ¡Muy bien! Prueba el siguiente nivel');
} else {
  console.log('\n💪 Sigue practicando. Intenta de nuevo');
}
```

---

## Troubleshooting

### Error: "Cannot use import statement outside a module"
**Solución:**
```javascript
// ❌ NO hagas esto:
import { ... } from '...';

// ✅ Haz esto en su lugar:
const { ... } = await import('...');
```

### Error: "Micrófono no disponible"
**Soluciones:**
1. Verifica permisos del navegador:
   - Chrome: Configuración → Privacidad → Configuración de sitios → Micrófono
   - Firefox: Preferencias → Privacidad → Permisos → Micrófono
2. Permite acceso a `localhost:8080`
3. Intenta recargar la página y volver a intentar

### Error: "Failed to resolve module specifier"
**Solución:**
- Verifica la ruta correcta desde tu app actual
- Desde Apps 2-5: `../../libs/audio-capture/index.js`
- Si estás en otra ubicación, ajusta las `../../`

### Error: "Tone is not defined"
**Solución:**
- Usa `createCaptureSystem()` que carga Tone.js automáticamente
- O crea `MicrophoneCapture` y llama a `initialize()` antes de usar

### Feedback visual no aparece
**Soluciones:**
1. Verifica que pasaste `{ visualFeedback: true }`
2. Revisa si hay elementos con `z-index` muy alto que lo tapen
3. Verifica que el DOM esté cargado completamente

### No detecta beats del micrófono
**Soluciones:**
1. Baja el threshold: `{ threshold: -35 }` o incluso `-40`
2. Haz ruidos más fuertes (palmadas, golpes)
3. Acércate más al micrófono
4. Verifica el nivel con Test 8 para calibrar

### El análisis dice "No se detectaron taps"
**Soluciones:**
1. Asegúrate de presionar ESPACIO durante la grabación
2. Verifica que el teclado no esté bloqueado
3. No presiones antes de que inicie la grabación
4. Espera a que termine el setTimeout

---

## Comandos Rápidos de Utilidad

### Ver configuración actual del analyzer
```javascript
const { createRhythmAnalyzer } = await import('../../libs/audio-capture/index.js');
const analyzer = createRhythmAnalyzer();
console.log(analyzer.config);
```

### Cambiar threshold del micrófono después de crear
```javascript
// Después de await mic.initialize()
mic.updateConfig({ threshold: -25 });  // Más sensible
mic.updateConfig({ threshold: -35 });  // Menos sensible
```

### Verificar si Tone.js está cargado
```javascript
const { isToneLoaded } = await import('../../libs/sound/tone-loader.js');
console.log('Tone.js cargado:', isToneLoaded());
```

### Limpiar todos los recursos
```javascript
// Si system está en scope:
system.dispose();

// O individualmente:
mic.dispose();
kbd.dispose();
```

---

## Próximos Pasos

Una vez verificado que todo funciona:

1. ✅ Testing manual completado con consola
2. ⏳ Crear demo app visual con UI (opcional)
3. ⏳ Implementar Fase 2c: Ejercicios
4. ⏳ Integrar con sistema de gamificación

---

## Referencias

- [GAMIFICATION_PLAN.md](GAMIFICATION_PLAN.md) - Plan completo de gamificación
- [GAMIFICATION_PROGRESS.md](GAMIFICATION_PROGRESS.md) - Estado del desarrollo
- [libs/audio-capture/](libs/audio-capture/) - Código fuente
- [CONSOLE_COMMANDS.md](CONSOLE_COMMANDS.md) - Comandos de gamificación

---

## Notas Técnicas

### Por qué `await import()` en lugar de `import`

La consola del navegador ejecuta código en un contexto de script (no módulo), por lo que no puede usar sintaxis de módulos ES6 como `import/export`. La función `import()` es una expresión (no una declaración) que devuelve una Promise, por lo que funciona en cualquier contexto JavaScript.

### Ruta relativa correcta

Las rutas son relativas al archivo HTML que abriste:
- Si abres `apps/app2/index.html`, las rutas son `../../libs/...`
- Si abres `index.html` en root, las rutas son `./libs/...`
