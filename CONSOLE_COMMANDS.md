# Comandos de Consola - Referencia Rápida

Guía rápida con **desplegables** para no ocupar espacio en consola.

> 💡 **Tip:** Haz clic en las secciones (▶) para expandir/colapsar
> 📋 Todos los comandos son **copy-paste ready**
> ⚠️ **IMPORTANTE:** Ejecuta estos comandos desde la consola del navegador, NO desde el terminal

---

## 📦 Fase 1 - Sistema de Gamificación

<details open>
<summary>👤 User Manager</summary>

### Comandos Síncronos (sin await)

```javascript
// Cambiar a usuario "tester" (user_id: 1)
window.__USER_MANAGER.switchUser(1)

// Cambiar a usuario "user" (user_id: 2)
window.__USER_MANAGER.switchUser(2)

// Ver usuario actual
window.__USER_MANAGER.getCurrentUserId()
// Retorna: 1 o 2

// Ver info del usuario actual
window.__USER_MANAGER.getCurrentUserInfo()
// Retorna: { id: 1, username: 'tester', displayName: 'Usuario de Prueba' }

// Ver nombre del usuario
window.__USER_MANAGER.getUserDisplayName()
// Retorna: "Usuario de Prueba"

// Ver lista de usuarios disponibles
window.__USER_MANAGER.getAvailableUsers()
// Retorna: [{ id: 1, username: 'tester', ... }, { id: 2, ... }]
```

### Comandos Asíncronos (requieren await)

```javascript
// Ver estadísticas del usuario actual desde API
await window.__USER_MANAGER.fetchUserStats()
// Retorna: { user_id: 1, username: 'tester', total_score: 0, ... }

// Ver intentos recientes desde API
await window.__USER_MANAGER.fetchUserAttempts(10)
// Retorna: [{ attempt_id, exercise_title, score, accuracy, ... }]

// Verificar si servidor está disponible
await window.__USER_MANAGER.isServerAvailable()
// Retorna: true o false
```

</details>

<details>
<summary>🔄 Migration</summary>

### Comandos Síncronos

```javascript
// Ver información de migración
window.__MIGRATION.info()
// Retorna: { completed: true, timestamp: ..., date: '...' } o null

// Resetear estado de migración (para testing)
window.__MIGRATION.reset()
// Consola: "🔄 Estado de migración reseteado"
```

### Comandos Asíncronos (requieren await)

```javascript
// Migrar datos de localStorage a base de datos
await window.__MIGRATION.migrate()
// Retorna: { success: true, synced_count: 10, failed_count: 0, ... }

// Forzar migración aunque ya se haya hecho
await window.__MIGRATION.migrate(true)

// Verificar si servidor está disponible
await window.__MIGRATION.isServerAvailable()
// Retorna: true o false
```

</details>

<details>
<summary>🎮 Gamification Manager (Fase 1)</summary>

### Estadísticas y Progreso

```javascript
// Ver estadísticas generales
window.__GAMIFICATION.getStats()
// Retorna: { session: {...}, scoring: {...}, achievements: {...} }

// Ver nivel del usuario
window.__GAMIFICATION.getUserLevel()
// Retorna: { level: 3, currentXP: 850, nextLevelXP: 1000, ... }

// Ver todos los logros
window.__GAMIFICATION.getAchievements()
// Retorna: [{ id: 'first_session', unlocked: true, ... }, ...]

// Ver progreso de un logro específico
window.__GAMIFICATION.getAchievementProgress('combo_master')
// Retorna: { current: 3, target: 5, percentage: 60, ... }
```

### Tracking de Eventos

```javascript
// Trackear evento válido (usar tipos de EVENT_TYPES)
window.__GAMIFICATION.trackEvent('practice_completed', {
  ejercicio_id: 'interval_training',
  puntuacion: 85,
  tiempo: 120
})

// Trackear acción de app
window.__GAMIFICATION.trackAppAction('play_started', {
  duration: 30,
  selection_count: 5
})

// Ver tipos de eventos disponibles:
// practice_started, practice_completed, practice_paused, pattern_played,
// tap_tempo_used, rhythm_matched, perfect_timing, parameter_changed,
// randomization_used, fraction_created, pulse_pattern_created, loop_activated
```

</details>

---

## 📦 Fase 2b - Audio Capture

<details>
<summary>⌨️ Keyboard Capture</summary>

### Test 1: Captura Básica de Keyboard

**Descripción:** Captura 5 taps con ESPACIO
**Duración:** ~5 segundos

```javascript
const { createKeyboardCapture } = await import('../../libs/gamification/index.js');

const keyboard = createKeyboardCapture();
console.log('⌨️  Presiona ESPACIO 5 veces...');
keyboard.startRecording();

// Esperar a que termines
await new Promise(resolve => setTimeout(resolve, 10000));

const taps = keyboard.stopRecording();
console.log('✅ Capturados', taps.length, 'taps:', taps);
```

**Resultado esperado:**
- 5 timestamps en milisegundos (números directos, no objetos)
- Diferencias razonables entre taps (ej: 200-1000ms)

</details>

<details>
<summary>🎤 Microphone Capture</summary>

### Test 2: Captura de Micrófono

**Descripción:** Detecta beats del micrófono durante 5 segundos
**Duración:** ~5 segundos
**Requisito:** Permiso de micrófono

```javascript
const { createMicrophoneCapture } = await import('../../libs/gamification/index.js');

const mic = await createMicrophoneCapture({ threshold: 0.3, cooldown: 200 });
console.log('🎤 Golpea cerca del micrófono durante 5 segundos...');

mic.startRecording();
await new Promise(resolve => setTimeout(resolve, 5000));
const beats = mic.stopRecording();

console.log('✅ Detectados', beats.length, 'beats');
console.log('Timestamps:', beats.map(b => Math.round(b.timestamp)));
console.log('Amplitudes:', beats.map(b => b.amplitude.toFixed(2)));

mic.dispose();
```

**Resultado esperado:**
- Beats detectados cuando golpeas fuerte
- Amplitudes > threshold (0.3)
- Cooldown previene detecciones duplicadas

</details>

<details>
<summary>🔍 Rhythm Analyzer</summary>

### Test 3: Análisis de Timing

**Descripción:** Analiza precisión de taps contra patrón esperado
**Duración:** Instantáneo

```javascript
const { createRhythmAnalyzer, fractionsToTimestamps } = await import('../../libs/gamification/index.js');

// Patrón esperado: 4 pulsos a 120 BPM (fracciones: 0, 0.25, 0.5, 0.75)
const expected = fractionsToTimestamps([0, 0.25, 0.5, 0.75], 120);
console.log('⏱️  Patrón esperado (120 BPM):', expected);

// Simular taps del usuario (con pequeños errores)
const userTaps = expected.map(t => t + Math.random() * 50 - 25);
console.log('👤 Taps del usuario:', userTaps.map(Math.round));

// Analizar
const analyzer = createRhythmAnalyzer();
const result = analyzer.compareRhythm(userTaps, expected);

console.log('\n📊 Análisis:');
console.log('  Accuracy:', Math.round(result.accuracy), '%');
console.log('  Avg Error:', Math.round(result.averageError), 'ms');
console.log('  Consistency:', Math.round(result.consistency), '%');
console.log('  Details:', result.details);
```

**Resultado esperado:**
- Accuracy ~95% (errores pequeños)
- Average Error ~10-20ms
- Consistency alta si ritmo regular

</details>

---

## 📦 Fase 2c - Ejercicios de Entrenamiento

<details>
<summary>🧪 Tests de Sistema de Ejercicios</summary>

### Test 1: Cálculo de Timestamps

**Descripción:** Verifica que los timestamps se calculan correctamente
**Duración:** Instantáneo

```javascript
const { ExerciseRunner } = await import('../../libs/ear-training/index.js');

const runner = new ExerciseRunner('sequence-entry');

// Test 1: Lg 4, BPM 120 = 500ms/pulso
const timestamps = runner.calculateTimestamps(4, 120);
console.log('🎵 Lg 4, BPM 120:', timestamps, 'ms');
// Esperado: [0, 500, 1000, 1500]

// Test 2: Lg 4, BPM 240 = 250ms/pulso
const timestamps2 = runner.calculateTimestamps(4, 240);
console.log('🎵 Lg 4, BPM 240:', timestamps2, 'ms');
// Esperado: [0, 250, 500, 750]

// Test 3: Seleccionar posiciones impares (1, 3)
const selected = runner.selectPositions(timestamps, [1, 3]);
console.log('✅ Posiciones impares [1,3]:', selected, 'ms');
// Esperado: [500, 1500]
```

**Resultado esperado:**
- BPM 120: intervalo de 500ms entre pulsos
- BPM 240: intervalo de 250ms entre pulsos
- Posiciones [1, 3] correctamente filtradas

</details>

<details>
<summary>⏱️ Test 2: Count-In (Visual + Audio)</summary>

**Descripción:** Prueba el count-in con feedback visual y audio
**Duración:** ~2-4 segundos (depende del BPM)

```javascript
// CountInController está disponible globalmente en window.__EAR_TRAINING
const { CountInController } = window.__EAR_TRAINING;

// Crear count-in de 4 beats a 120 BPM
const countIn = new CountInController({
  beats: 4,
  bpm: 120,
  visualFeedback: true,
  audioFeedback: true
});

console.log('⏱️  Iniciando count-in...');
console.log('📺 Deberías ver números grandes: 4, 3, 2, 1');
console.log('🔊 Y escuchar un click en cada beat');

await countIn.play();

console.log('✅ Count-in completado!');
```

**Qué hace:**
1. Crea overlay fullscreen con fondo oscuro
2. Muestra números grandes (4 → 3 → 2 → 1) con animación pulse
3. Muestra barra de progreso con círculos
4. Reproduce click (MIDI 76) en cada beat
5. Sincroniza visual + audio con setTimeout
6. Limpia elementos al terminar

**Resultado esperado:**
- Overlay aparece con números animados
- 4 clicks de audio (uno por beat)
- Intervalo de 500ms entre beats (60000/120)
- Overlay desaparece al terminar

**Variantes para probar:**

```javascript
// Nota: CountInController ya está disponible globalmente, no necesitas import

// Count-in rápido (240 BPM = 250ms/beat)
const { CountInController } = window.__EAR_TRAINING;
const fast = new CountInController({ beats: 4, bpm: 240 });
await fast.play();

// Count-in lento (60 BPM = 1000ms/beat)
const slow = new CountInController({ beats: 4, bpm: 60 });
await slow.play();

// Solo visual (sin audio)
const silent = new CountInController({
  beats: 4,
  bpm: 120,
  audioFeedback: false
});
await silent.play();

// Solo audio (sin visual)
const noVisual = new CountInController({
  beats: 4,
  bpm: 120,
  visualFeedback: false
});
await noVisual.play();
```

</details>

<details>
<summary>🎯 Test 3: Ejercicio 1 - Entrada de Secuencia (Nivel 1)</summary>

**Descripción:** Ejecuta Ejercicio 1 Nivel 1 (2 golpes impares)
**Duración:** ~5-10 segundos (depende de tu velocidad de taps)

```javascript
const { ExerciseRunner } = await import('../../libs/ear-training/index.js');

// Crear y inicializar ejercicio
const ex1 = new ExerciseRunner('sequence-entry');
await ex1.initialize();

console.log('🎯 Ejercicio 1 - Nivel 1: 2 golpes impares (posiciones 1, 3)');
console.log('⌨️  Presiona ESPACIO 2 veces cuando quieras (timing libre)');
console.log('');

// Ejecutar nivel 1
const result = await ex1.runLevel(1);

// Mostrar resultado detallado
console.log('\n📊 RESULTADO:');
console.log('  Score:', result.score.total, '/ 100');
console.log('  Passed:', result.score.passed ? '✅ SÍ' : '❌ NO');
console.log('  Taps capturados:', result.capture.taps);
console.log('  Breakdown:');
console.log('    - Timing:', result.score.breakdown.timing + '%');
console.log('    - Consistency:', result.score.breakdown.consistency + '%');

// Limpiar recursos
ex1.dispose();
```

**Qué hace:**
1. Muestra instrucciones del nivel
2. Espera que presiones ESPACIO 2 veces
3. Analiza las proporciones temporales entre taps
4. Calcula score basado en timing y consistency
5. Guarda resultado en base de datos

**Resultado esperado:**
- Captura 2 timestamps
- Calcula score entre 0-100
- Muestra si pasaste (≥70%)

**⚠️ IMPORTANTE - Si el test se queda esperando:**

Si no detecta tus taps después de 5 segundos:
1. Haz clic en la página principal (fuera de la consola DevTools)
2. Vuelve a presionar ESPACIO 2 veces
3. El ejercicio debería continuar

**Causa:** El foco del teclado debe estar en la página, no en DevTools.

</details>

<details>
<summary>💾 Test 4: Ver Resultados Guardados en BD</summary>

**Descripción:** Verifica que el resultado se guardó en la base de datos
**Duración:** Instantáneo

```javascript
// Ver últimos intentos del usuario actual
await window.__USER_MANAGER.fetchUserAttempts(5);

// O consultar directamente la API
const userId = window.__USER_MANAGER.getCurrentUserId();
const response = await fetch(`http://localhost:3000/api/users/${userId}/attempts?limit=5`);
const data = await response.json();
console.log('📊 Últimos 5 intentos:', data);

// DEBUG: Ver formato real de exercise_type
if (data.length > 0) {
  console.log('🔍 Formato de exercise_type:', data.map(a => a.exercise_type));
}

// Filtrar solo ejercicios de Fase 2c (usar underscore, no guión)
const ejercicios2c = data.filter(a => {
  const type = a.exercise_type || '';
  return type.includes('sequence_entry') ||
    type.includes('rhythm_sync') ||
    type.includes('tap_tempo') ||
    type.includes('fraction_recognition');
});
console.log('🎯 Ejercicios Fase 2c:', ejercicios2c);
```

**Resultado esperado:**
- Debe aparecer el intento que acabas de hacer en Test 3
- exercise_type: `sequence-entry_level_1`
- Metadata con timing_accuracy, consistency, etc.

</details>

<details>
<summary>🔗 Test 5: Ejercicios Linked (1 + 2)</summary>

**Descripción:** Ejecuta Ejercicio 1 y luego Ejercicio 2 (si pasas el 1)
**Duración:** ~30-45 segundos (incluye count-in y 3 repeticiones)

```javascript
const { LinkedExerciseManager } = await import('../../libs/ear-training/index.js');

// Crear manager de ejercicios linked
const manager = new LinkedExerciseManager('sequence-entry', 'rhythm-sync');
await manager.initialize();

console.log('🎯 EJERCICIOS LINKED: 1 + 2');
console.log('═══════════════════════════════');
console.log('Parte 1: Entrada de Secuencia (captura libre)');
console.log('Parte 2: Sincronización Rítmica (con audio + count-in)');
console.log('');

// Ejecutar nivel 1 completo (ambas partes)
const result = await manager.runLinkedLevel(1);

// Mostrar resultado combinado
console.log('\n🏆 RESULTADO FINAL:');
console.log('  Completed:', result.completed ? '✅ SÍ' : '❌ NO');
console.log('  Passed:', result.passed ? '✅ SÍ' : '❌ NO');
console.log('  Combined Score:', result.combinedScore, '/ 100');
console.log('  Parte 1 Score:', result.part1.score.total);
if (result.part2) {
  console.log('  Parte 2 Score:', result.part2.averageScore);
  console.log('  BPMs usados:', result.part2.bpms);
}

// Limpiar recursos
manager.dispose();
```

**Qué hace:**
1. **Parte 1:** Ejecuta Ejercicio 1 (captura libre)
2. **Si pasas:** Ejecuta Ejercicio 2 con 3 BPMs crecientes
   - Count-in de 4 beats antes de cada repetición
   - Audio de referencia con clicks
   - Captura sincronizada con el audio
3. Calcula score combinado (promedio de ambas partes)

**Resultado esperado:**
- Si pasas Parte 1: ejecuta Parte 2 con 3 repeticiones
- Si fallas Parte 1: se detiene ahí
- Score final es el promedio de ambas partes

</details>

<details>
<summary>🎼 Test 6: Fraction Recognition (Simulado)</summary>

**Descripción:** Ejecuta Ejercicio 4 Nivel 1 (10 preguntas, fracciones simples)
**Duración:** ~2-3 minutos (automático con respuestas simuladas)

**⚠️ REQUISITOS PREVIOS:**
- Tone.js debe estar inicializado (contexto de audio activo)
- Si estás en la pantalla inicial de App4, primero haz clic en "Inicio" o ejecuta: `await Tone.start()`

```javascript
// Opción 1: Usar módulo global (si está disponible)
const { FractionRecognitionExercise } = window.__EAR_TRAINING || await import('../../libs/ear-training/index.js');

// Crear ejercicio
const ex4 = new FractionRecognitionExercise();
await ex4.initialize();

console.log('🎼 Ejercicio 4: Reconocimiento de Fracciones');
console.log('📝 Nivel 1: Fracciones simples (n=1, d=1-12)');
console.log('🔊 10 preguntas con audio de subdivisiones');
console.log('');
console.log('⚠️  En modo consola, las respuestas se simulan automáticamente (70% correctas)');
console.log('');

// Ejecutar nivel 1 (10 preguntas)
const result = await ex4.runLevel(1);

// Mostrar resultado
console.log('\n🏆 RESULTADO FINAL:');
console.log('  Correctas:', result.correctCount, '/', result.totalQuestions);
console.log('  Accuracy:', Math.round(result.accuracy), '%');
console.log('  Passed:', result.passed ? '✅ SÍ' : '❌ NO');
console.log('  Total listens:', result.totalListenCount);

// Limpiar recursos
ex4.dispose();
```

**Qué hace:**
1. Genera 10 preguntas random con fracciones 1/d (d entre 1 y 12)
2. Para cada pregunta:
   - Reproduce audio con la subdivisión usando gridFromOrigin
   - Simula respuesta del usuario (70% correctas en modo consola)
   - Valida la respuesta
3. Calcula accuracy final y determina si pasó (≥80%)

**Resultado esperado:**
- 10 preguntas completadas
- ~7 correctas (simulación 70%)
- Audio se reproduce (escucharás clicks de accent + base)

**Nota:** En una UI real, el usuario ingresaría n y d manualmente.

</details>

---

## 📊 Ejemplos de Flujos Completos

<details>
<summary>🔄 Flujo Completo: Usuario Nuevo → Migración → Ejercicio</summary>

```javascript
// 1. Cambiar a usuario "tester"
window.__USER_MANAGER.switchUser(1);

// 2. Verificar servidor disponible
const serverOk = await window.__MIGRATION.isServerAvailable();
console.log('Servidor:', serverOk ? '✅' : '❌');

// 3. Ver intentos previos
const attempts = await window.__USER_MANAGER.fetchUserAttempts(5);
console.log('Intentos previos:', attempts.length);

// 4. Ejecutar Ejercicio 1 - Nivel 1
const { ExerciseRunner } = await import('../../libs/ear-training/index.js');
const ex1 = new ExerciseRunner('sequence-entry');
await ex1.initialize();

console.log('⌨️  Presiona ESPACIO 2 veces...');
const result = await ex1.runLevel(1);

console.log('Score:', result.score.total, '/ 100');
ex1.dispose();

// 5. Ver intentos actualizados
const newAttempts = await window.__USER_MANAGER.fetchUserAttempts(5);
console.log('Nuevos intentos:', newAttempts.length);
```

</details>

---

## 🚨 Troubleshooting

<details>
<summary>⚠️ Problemas Comunes</summary>

### Comando retorna NaN o Promise

**Problema:**
```javascript
window.__USER_MANAGER.fetchUserStats()
// Retorna: Promise { <pending> }
```

**Solución:** Falta `await`
```javascript
await window.__USER_MANAGER.fetchUserStats()
```

---

### Error: "User not found"

**Problema:** El usuario no existe en la base de datos

**Solución:**
```javascript
// Ver usuarios disponibles
window.__USER_MANAGER.getAvailableUsers()

// Cambiar a usuario válido
window.__USER_MANAGER.switchUser(1)
```

---

### Error: "Failed to fetch"

**Problema:** El servidor no está corriendo

**Solución:**
```bash
# En terminal, iniciar servidor
cd /Users/workingburcet/Lab/server
node index.js
```

**Verificar:**
```javascript
await window.__MIGRATION.isServerAvailable()
// Debe retornar: true
```

---

### Error: "Cannot use import statement outside a module"

**Problema:** Intentando usar `import` en vez de `await import()`

**Solución:**
```javascript
// ❌ MAL
import { ExerciseRunner } from '../../libs/ear-training/index.js';

// ✅ BIEN
const { ExerciseRunner } = await import('../../libs/ear-training/index.js');
```

---

### Error: "Micrófono no disponible"

**Problema:** Navegador no tiene acceso al micrófono

**Solución:**
1. Permitir acceso al micrófono en el navegador
2. Verificar que el micrófono esté conectado
3. Probar con `navigator.mediaDevices.getUserMedia({ audio: true })`

---

### KeyboardCapture no funciona con audio

**Problema:** La página necesita interacción del usuario antes de tocar audio

**Solución:**
```javascript
// Hacer clic en la página primero, luego ejecutar el test
console.log('⚠️  Haz clic en la página y presiona ESPACIO');
```

---

### Feedback visual no aparece

**Problema:** `visualFeedback: true` pero no se ve nada

**Solución:**
- Verificar que estés en la página de la app (no en una pestaña vacía)
- El overlay debe aparecer en fullscreen
- Revisar consola por errores de CSS

---

### No detecta beats del micrófono

**Problema:** `createMicrophoneCapture()` no detecta golpes

**Solución:**
```javascript
// Reducir threshold
const mic = await createMicrophoneCapture({ threshold: 0.1 });

// Aumentar cooldown para evitar duplicados
const mic = await createMicrophoneCapture({ threshold: 0.2, cooldown: 300 });
```

---

### Test de Ejercicio se queda esperando taps

**Problema:** No detecta las teclas presionadas

**Solución:**
1. **Hacer clic en la página principal** (fuera de DevTools)
2. Volver a presionar ESPACIO
3. El foco debe estar en la página, no en la consola

---

### Score siempre es 0 o muy bajo

**Problema:** Timing muy irregular o tolerancia muy estricta

**Solución:**
- Revisar timestamps capturados: `result.capture.taps`
- Practicar taps más consistentes
- Niveles más altos tienen tolerancias más estrictas

</details>

---

## 📝 Notas Importantes

- **Comandos síncronos:** Ejecutar directamente (no necesitan `await`)
- **Comandos asíncronos:** SIEMPRE usar `await` antes del comando
- **API Server:** Debe estar corriendo en `http://localhost:3000`
- **Apps:** Deben servirse vía Live Server en `http://localhost:8080`
- **Audio Capture:** Usa `await import()` en consola (no `import` estático)
- **Permisos:** Tests de micrófono requieren permisos del navegador
- **Ejercicios de Ritmo:** Los ejercicios son interactivos - presionarás ESPACIO para tocar patrones
- **Foco de teclado:** Para tests con ESPACIO, asegúrate de que el foco esté en la página, no en DevTools

---

## 🎯 Resumen de Tests por Fase

### Fase 2b - Audio Capture (3 tests)
1. ⌨️ Keyboard Capture - Captura 5 taps
2. 🎤 Microphone Capture - Detecta beats del micrófono
3. 🔍 Rhythm Analyzer - Analiza precisión vs patrón esperado

### Fase 2c - Ejercicios (6 tests)
1. 🧪 Cálculo de Timestamps - Verifica fórmulas matemáticas
2. ⏱️ Count-In - Visual + Audio feedback
3. 🎯 Ejercicio 1 - Entrada de Secuencia (Nivel 1)
4. 💾 Ver BD - Resultados guardados
5. 🔗 Ejercicios Linked - Ejercicio 1 + 2
6. 🎼 Fraction Recognition - Ejercicio 4 (Nivel 1)

---

**💡 Tip:** Puedes copiar y pegar directamente estos comandos en la consola del navegador.

**📚 Documentación completa:**
- [DEVELOPMENT.md](DEVELOPMENT.md) - Guía de desarrollo
- [GAMIFICATION_PLAN.md](GAMIFICATION_PLAN.md) - Plan completo de gamificación
- [GAMIFICATION_USAGE_EXAMPLE.md](GAMIFICATION_USAGE_EXAMPLE.md) - Ejemplos detallados de gamificación
- [GAMIFICATION_PROGRESS.md](GAMIFICATION_PROGRESS.md) - Progreso de implementación
