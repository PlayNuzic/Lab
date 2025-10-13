# Guía de Testing: Sistema de Captura de Audio (Fase 2b)

## Testing Rápido desde la Consola del Navegador

### Preparación

1. Abre cualquiera de las Apps 2-5 con Live Server (puerto 8080)
2. Abre la consola del navegador (F12)
3. Asegúrate de que el servidor API está corriendo en puerto 3000

### Test 1: Verificar Soporte del Sistema

```javascript
import { checkSupport } from '../../libs/audio-capture/index.js';

const support = checkSupport();
console.log('Soporte:', support);
// Debe mostrar: { microphone: true, keyboard: true, overall: true }
```

### Test 2: Captura de Teclado (Sin Micrófono) ⌨️

**Test simple de 5 segundos:**

```javascript
import { createKeyboardCapture } from '../../libs/audio-capture/index.js';

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
- Un círculo azul flotante en la esquina inferior derecha
- El círculo se ilumina al presionar ESPACIO
- Después de 5 segundos, una lista de timestamps en ms

### Test 3: Análisis de Ritmo 🎵

**Generar patrón y comparar tu ritmo:**

```javascript
import {
  createKeyboardCapture,
  createRhythmAnalyzer,
  generateExpectedPattern
} from '../../libs/audio-capture/index.js';

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
  console.log(`   Mensaje: ${result.message}`);

  kbd.dispose();
}, 5000);
```

### Test 4: Detección de Tempo 🎵

**Detectar tu tempo libre:**

```javascript
import { createKeyboardCapture, createRhythmAnalyzer } from '../../libs/audio-capture/index.js';

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
  console.log(`   Confianza: ${tempo.confidence}%`);
  console.log(`   Consistencia: ${tempo.consistency}%`);
  console.log(`   Mensaje: ${tempo.message}`);

  kbd.dispose();
}, 10000);
```

### Test 5: Sistema Completo (Teclado + Micrófono) 🎤⌨️

**IMPORTANTE:** Este test requiere permisos de micrófono.

```javascript
import { createCaptureSystem } from '../../libs/audio-capture/index.js';

// Crear sistema completo
const system = await createCaptureSystem({
  microphone: {
    threshold: -30,
    minInterval: 100,
    onBeatDetected: (event) => {
      console.log(`🎤 Beat detectado: ${event.beatNumber} @ ${Math.round(event.timestamp)}ms`);
    }
  },
  keyboard: {
    visualFeedback: true,
    onTapDetected: (event) => {
      console.log(`⌨️ Tap detectado: ${event.tapNumber} @ ${Math.round(event.timestamp)}ms`);
    }
  }
});

if (!system.micInitialized) {
  console.warn('⚠️ Micrófono no disponible');
} else {
  console.log('✅ Sistema completo inicializado');
}

// Verificar nivel de micrófono en tiempo real
if (system.micInitialized) {
  const interval = setInterval(() => {
    const level = system.mic.getCurrentLevel();
    console.log(`📊 Nivel: ${level.toFixed(2)} dB`);
  }, 500);

  setTimeout(() => clearInterval(interval), 5000);
}

// Captura combinada
console.log('🎙️ Iniciando captura combinada (5 segundos)...');
await system.combined.startRecording();

setTimeout(async () => {
  const results = system.combined.stopRecording();

  console.log('📊 RESULTADOS COMBINADOS:');
  console.log(`   Eventos de micrófono: ${results.microphone.length}`);
  console.log(`   Eventos de teclado: ${results.keyboard.length}`);
  console.log(`   Total eventos: ${results.totalEvents}`);
  console.log('   Todos los eventos ordenados:', results.combined);

  system.dispose();
}, 5000);
```

### Test 6: Análisis de Ritmo Libre 🎨

```javascript
import { createKeyboardCapture, createRhythmAnalyzer } from '../../libs/audio-capture/index.js';

const kbd = createKeyboardCapture({ visualFeedback: true });
const analyzer = createRhythmAnalyzer();

kbd.startRecording();
console.log('🎹 Improvisa un ritmo libre durante 10 segundos...');

setTimeout(() => {
  const taps = kbd.stopRecording();

  // Analizar ritmo libre
  const analysis = analyzer.analyzeFreeRhythm(taps);

  console.log('🎨 ANÁLISIS DE RITMO LIBRE:');
  console.log(`   BPM: ${Math.round(analysis.tempo.bpm)}`);
  console.log(`   Consistencia: ${Math.round(analysis.consistency * 100)}%`);
  console.log(`   Total taps: ${analysis.totalTaps}`);
  console.log(`   Duración: ${Math.round(analysis.duration)}ms`);
  console.log('   Patrones detectados:', analysis.patterns);
  console.log(`   ${analysis.message}`);

  kbd.dispose();
}, 10000);
```

### Test 7: Helper - Generar Patrón de Fracciones 🎼

```javascript
import { fractionsToTimestamps } from '../../libs/audio-capture/index.js';

// Patrón: redonda, blanca, negra, corchea
const pattern = [1, 0.5, 0.25, 0.125];
const timestamps = fractionsToTimestamps(pattern, 120, 0);

console.log('🎼 Patrón de fracciones (120 BPM):', timestamps);
// Cada valor es el timestamp en ms donde debe sonar la nota
```

---

## Troubleshooting

### Error: "Micrófono no disponible"
**Solución:**
1. Verificar que el navegador tiene permisos de micrófono
2. Ir a configuración del navegador → Privacidad → Micrófono
3. Permitir acceso para localhost:8080

### Error: "Failed to resolve module specifier"
**Solución:**
- Asegúrate de estar importando desde rutas relativas correctas
- Desde Apps 2-5: `../../libs/audio-capture/index.js`
- Desde root: `./libs/audio-capture/index.js`

### Error: "Tone is not defined"
**Solución:**
- El sistema carga Tone.js automáticamente al llamar `createCaptureSystem()`
- Si usas `MicrophoneCapture` directamente, llama a `initialize()` primero

### Feedback visual no aparece
**Solución:**
- Asegúrate de pasar `{ visualFeedback: true }` al crear KeyboardCapture
- Verifica que no haya otros elementos con z-index alto que lo tapen

---

## Comandos Útiles en Consola

### Ver nivel de micrófono en tiempo real
```javascript
import { createMicrophoneCapture } from '../../libs/audio-capture/index.js';
const mic = createMicrophoneCapture();
await mic.initialize();
setInterval(() => console.log('Level:', mic.getCurrentLevel()), 100);
```

### Cambiar threshold de detección de beats
```javascript
mic.updateConfig({ threshold: -25 }); // Más sensible
mic.updateConfig({ threshold: -35 }); // Menos sensible
```

### Cambiar tolerancia del analyzer
```javascript
import { createRhythmAnalyzer } from '../../libs/audio-capture/index.js';
const analyzer = createRhythmAnalyzer({
  timingTolerance: 150,  // ±150ms de tolerancia
  tempoTolerance: 15     // ±15 BPM de tolerancia
});
```

---

## Próximos Pasos

Una vez verificado que todo funciona:

1. ✅ Testing manual completado
2. ⏳ Crear demo app visual (opcional)
3. ⏳ Implementar Fase 2c: Ejercicios
4. ⏳ Integrar con sistema de gamificación

---

## Referencias

- [GAMIFICATION_PLAN.md](GAMIFICATION_PLAN.md) - Plan completo de gamificación
- [GAMIFICATION_PROGRESS.md](GAMIFICATION_PROGRESS.md) - Estado del desarrollo
- [libs/audio-capture/](libs/audio-capture/) - Código fuente
