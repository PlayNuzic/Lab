# Comandos de Consola - Referencia Rápida (Modo Offline)

Guía rápida con **desplegables** para no ocupar espacio en consola.

> 💡 **Tip:** Haz clic en las secciones (▶) para expandir/colapsar
> 📋 Todos los comandos son **copy-paste ready**
> ⚠️ **IMPORTANTE:** Ejecuta estos comandos desde la consola del navegador, NO desde el terminal
> 🔧 **MODO OFFLINE:** Todo se guarda en localStorage del navegador, sin servidor

---

## 📦 Sistema de Gamificación (Offline)

<details open>
<summary>👤 User Manager (Usuario Único)</summary>

### Comandos Básicos

```javascript
// Ver nombre del usuario actual
window.__USER_MANAGER.getUserDisplayName()
// Retorna: "Usuario"

// Cambiar nombre de usuario
window.__USER_MANAGER.setUserDisplayName("Mi Nombre")
// Consola: "✅ Nombre cambiado a: Mi Nombre"

// Ver información completa del usuario
window.__USER_MANAGER.getUserInfo()
// Retorna: { displayName: "Mi Nombre", createdAt: 1697234567890 }

// Resetear usuario (para testing)
window.__USER_MANAGER.resetUser()
// Consola: "🔄 Datos de usuario reseteados"
```

**Nota:** Ya no hay sistema de múltiples usuarios ni conexión a servidor.

</details>

<details>
<summary>🎮 Gamification Manager</summary>

### Estadísticas y Progreso

```javascript
// Ver estadísticas generales
window.__GAMIFICATION.getStats()
// Retorna: { session: {...}, scoring: {...}, achievements: {...}, storage: {...} }

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
// IMPORTANTE: Primero inicializar para la app específica
window.__GAMIFICATION.init('app5');  // o app2, app3, app4

// Trackear evento válido (usar tipos de EVENT_TYPES)
window.__GAMIFICATION.trackEvent('practice_completed', {
  ejercicio_id: 'interval_training',
  puntuacion: 85,
  tiempo: 120
})

// Trackear acción de app (requiere init previo)
// Acciones válidas para app5: play_started, pattern_created, interval_changed
window.__GAMIFICATION.trackAppAction('play_started', {
  duration: 30,
  selection_count: 5
})

// Ver tipos de eventos disponibles:
// practice_started, practice_completed, practice_paused, pattern_played,
// tap_tempo_used, rhythm_matched, perfect_timing, parameter_changed,
// randomization_used, fraction_created, pulse_pattern_created, loop_activated
```

### Gestión de Datos

```javascript
// Exportar todos los datos del usuario (para backup)
const backup = window.__GAMIFICATION.exportUserData()
console.log('Datos exportados:', backup)

// Guardar backup en archivo (copiar JSON y pegarlo en un archivo)
copy(JSON.stringify(backup, null, 2))

// Importar datos desde backup
window.__GAMIFICATION.importUserData(backup)

// Resetear sesión actual (mantiene logros y puntos totales)
window.__GAMIFICATION.resetSession()

// Resetear TODO (¡cuidado!)
window.__GAMIFICATION.resetAll()
```

</details>

<details>
<summary>💾 Ver Intentos de Ejercicios</summary>

### Consultar Intentos Guardados en localStorage

```javascript
// Ver todos los intentos guardados
const attempts = JSON.parse(localStorage.getItem('gamification_exercise_attempts') || '[]')
console.log(`📊 Total intentos: ${attempts.length}`)
console.table(attempts)

// Ver últimos 5 intentos
const last5 = attempts.slice(-5)
console.log('🎯 Últimos 5 intentos:')
console.table(last5)

// Filtrar por tipo de ejercicio
const sequenceAttempts = attempts.filter(a => a.exercise_type.includes('sequence'))
console.log(`🔢 Intentos de secuencia: ${sequenceAttempts.length}`)
console.table(sequenceAttempts)

// Ver mejores scores
const sortedByScore = [...attempts].sort((a, b) => b.score - a.score)
console.log('🏆 Top 5 scores:')
console.table(sortedByScore.slice(0, 5))

// Calcular accuracy promedio
const avgAccuracy = attempts.reduce((sum, a) => sum + a.accuracy, 0) / attempts.length
console.log(`📈 Accuracy promedio: ${avgAccuracy.toFixed(1)}%`)
```

</details>

---

## 📦 Audio Capture

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

// IMPORTANTE: Usar threshold en dB negativos (el mic reporta típicamente -30 a -50 dB)
const mic = await createMicrophoneCapture({ threshold: -30, cooldown: 200 });
console.log('🎤 Golpea cerca del micrófono durante 5 segundos...');
console.log('   (Threshold: -30 dB - ajustar si no detecta: -20 más sensible, -40 menos sensible)');

mic.startRecording();
await new Promise(resolve => setTimeout(resolve, 5000));
const beats = mic.stopRecording();

console.log('✅ Detectados', beats.length, 'beats');
console.log('Timestamps:', beats.map(b => Math.round(b.timestamp)));
console.log('Amplitudes (dB):', beats.map(b => b.amplitude.toFixed(2)));

mic.dispose();
```

**Resultado esperado:**
- Beats detectados cuando golpeas fuerte (o aplaudes)
- Amplitudes > threshold (-30 dB)
- Cooldown de 200ms previene detecciones duplicadas

**Si no detecta beats:**
```javascript
// Probar con threshold más sensible
const mic = await createMicrophoneCapture({ threshold: -20, cooldown: 250 });
```

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
console.log('  Accuracy:', Math.round(result.accuracy * 100), '%');
console.log('  Timing Accuracy:', Math.round(result.timingAccuracy * 100), '%');
console.log('  Consistency Score:', Math.round(result.consistencyScore * 100), '%');
console.log('  Tempo Accuracy:', Math.round(result.tempoAccuracy * 100), '%');
console.log('  Deviations (ms):', result.deviations.map(d => Math.round(d)));
console.log('  Missed taps:', result.missedTaps);
console.log('  Extra taps:', result.extraTaps);
```

**Resultado esperado:**
- Accuracy ~90-95% (con errores pequeños de ±25ms)
- Timing Accuracy alta si los taps están cerca de los esperados
- Consistency Score alta si el ritmo es regular
- Tempo Accuracy alta si mantiene el BPM

</details>

---

## 📦 Ejercicios de Entrenamiento (Offline)

<details>
<summary>🧪 Test: Guardar Intento Manualmente</summary>

**Descripción:** Guardar un intento de ejercicio en localStorage
**Duración:** Instantáneo

```javascript
const { recordAttempt } = await import('../../libs/gamification/index.js');

// Crear un intento de ejemplo
const result = recordAttempt({
  exercise_type: 'sequence-entry_level_1',
  exercise_title: 'Entrada de Secuencia - Nivel 1',
  score: 85,
  accuracy: 92,
  metadata: {
    timing_accuracy: 88,
    consistency: 95,
    taps_count: 2
  }
});

console.log('Resultado:', result);
// Retorna: { success: true, attempt_id: "...", message: "..." }

// Ver intentos guardados
const attempts = JSON.parse(localStorage.getItem('gamification_exercise_attempts') || '[]');
console.log(`Total intentos guardados: ${attempts.length}`);
console.table(attempts.slice(-3)); // Mostrar últimos 3
```

</details>

<details>
<summary>⏱️ Test: Count-In (Visual + Audio)</summary>

**Descripción:** Prueba el count-in con feedback visual y audio
**Duración:** ~2-4 segundos (depende del BPM)
**Requisito:** Módulo ear-training cargado

```javascript
// CountInController está disponible globalmente en window.__EAR_TRAINING
if (!window.__EAR_TRAINING) {
  console.log('❌ Módulo ear-training no disponible');
  console.log('ℹ️  Este test requiere el módulo ear-training');
} else {
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
}
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

if (window.__EAR_TRAINING) {
  const { CountInController } = window.__EAR_TRAINING;

  // Count-in rápido (240 BPM = 250ms/beat)
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
}
```

</details>

<details>
<summary>🎼 Test: Fraction Recognition (Simulado)</summary>

**Descripción:** Ejecuta Ejercicio 4 Nivel 1 (10 preguntas, fracciones simples)
**Duración:** ~2-3 minutos (automático con respuestas simuladas)
**Requisito:** Módulo ear-training y Tone.js inicializado

**⚠️ REQUISITOS PREVIOS:**
- Tone.js debe estar inicializado (contexto de audio activo)
- Si estás en la pantalla inicial de App4, primero haz clic en "Inicio" o ejecuta: `await Tone.start()`

```javascript
// Verificar disponibilidad del módulo
if (!window.__EAR_TRAINING) {
  console.log('❌ Módulo ear-training no disponible');
  console.log('ℹ️  Este test requiere el módulo ear-training');
} else {
  const { FractionRecognitionExercise } = window.__EAR_TRAINING;

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
}
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

<details>
<summary>🎯 Test: Ejercicio Completo (si está disponible)</summary>

**Nota:** Los tests de ejercicios completos requieren el módulo `ear-training` que puede no estar disponible en modo offline simplificado.

**Si el módulo está disponible:**

```javascript
// Verificar si ear-training está cargado
if (window.__EAR_TRAINING) {
  console.log('✅ Ear-training modules disponibles');
  console.log('Módulos:', Object.keys(window.__EAR_TRAINING));
} else {
  console.log('❌ Ear-training modules no disponibles (modo offline)');
  console.log('ℹ️  Los ejercicios se pueden ejecutar manualmente usando recordAttempt()');
}
```

</details>

---

## 📊 Flujos Completos (Offline)

<details>
<summary>🔄 Flujo: Usuario Nuevo → Ejercicio → Ver Stats</summary>

```javascript
// 1. Configurar nombre de usuario
window.__USER_MANAGER.setUserDisplayName("Practicante");

// 2. Inicializar gamificación
window.__GAMIFICATION.init('app2');

// 3. Trackear un evento de práctica
window.__GAMIFICATION.trackEvent('practice_started', {
  app_id: 'app2',
  lg_value: 16
});

// 4. Simular un ejercicio y guardar resultado
const { recordAttempt } = await import('../../libs/gamification/index.js');
recordAttempt({
  exercise_type: 'sequence-entry_level_1',
  score: 90,
  accuracy: 95,
  metadata: { duration: 30 }
});

// 5. Ver estadísticas actualizadas
const stats = window.__GAMIFICATION.getStats();
console.log('📊 Estadísticas:', stats);

// 6. Ver nivel del usuario
const level = window.__GAMIFICATION.getUserLevel();
console.log(`🎖️  Nivel ${level.level}: ${level.title}`);

// 7. Ver intentos guardados
const attempts = JSON.parse(localStorage.getItem('gamification_exercise_attempts') || '[]');
console.log(`🎯 Total intentos: ${attempts.length}`);
```

</details>

<details>
<summary>💾 Flujo: Backup y Restore de Datos</summary>

```javascript
// 1. Exportar todos los datos
const backup = window.__GAMIFICATION.exportUserData();

// 2. Copiar al portapapeles (para guardar en archivo)
copy(JSON.stringify(backup, null, 2));
console.log('✅ Backup copiado al portapapeles - pégalo en un archivo .json');

// 3. Simular pérdida de datos (¡CUIDADO!)
// window.__GAMIFICATION.resetAll();

// 4. Restaurar desde backup
// Pega aquí tu backup JSON
const myBackup = {
  "version": "1.0.0",
  "export_date": "2025-10-15T...",
  // ... resto del backup
};

window.__GAMIFICATION.importUserData(myBackup);
console.log('✅ Datos restaurados desde backup');
```

</details>

---

## 🚨 Troubleshooting

<details>
<summary>⚠️ Problemas Comunes</summary>

### Comando retorna Promise

**Problema:**
```javascript
window.__USER_MANAGER.getUserInfo()
// Retorna: Promise { <pending> }
```

**Solución:** Algunos comandos requieren `await`
```javascript
// Si el comando es async
const info = await window.__USER_MANAGER.getUserInfo()
```

---

### LocalStorage lleno

**Problema:** Error "QuotaExceededError" al guardar datos

**Solución:**
```javascript
// Limpiar eventos antiguos
localStorage.removeItem('gamification_events')

// O resetear todo (¡cuidado!)
window.__GAMIFICATION.resetAll()
```

---

### No detecta teclado en ejercicios

**Problema:** No detecta las teclas presionadas

**Solución:**
1. **Hacer clic en la página principal** (fuera de DevTools)
2. Volver a presionar ESPACIO
3. El foco debe estar en la página, no en la consola

---

### "Cannot use import statement outside a module"

**Problema:** Intentando usar `import` en vez de `await import()`

**Solución:**
```javascript
// ❌ MAL
import { ExerciseRunner } from '../../libs/ear-training/index.js';

// ✅ BIEN
const { ExerciseRunner } = await import('../../libs/ear-training/index.js');
```

---

### Micrófono no disponible

**Problema:** Navegador no tiene acceso al micrófono

**Solución:**
1. Permitir acceso al micrófono en el navegador
2. Verificar que el micrófono esté conectado
3. Probar con `navigator.mediaDevices.getUserMedia({ audio: true })`

---

### Datos no persisten entre sesiones

**Problema:** Los datos desaparecen al cerrar el navegador

**Solución:**
- Verificar que localStorage esté habilitado
- No usar modo incógnito/privado
- Verificar configuración del navegador (no bloquear cookies/storage)

</details>

---

## 📝 Notas Importantes

- **Modo Offline:** Todo se guarda en localStorage del navegador
- **Sin servidor:** No hay API ni base de datos externa
- **Usuario único:** Un solo usuario implícito por navegador
- **Comandos síncronos:** La mayoría no necesitan `await`
- **Comandos asíncronos:** Solo los de audio capture usan `await import()`
- **Permisos:** Tests de micrófono requieren permisos del navegador
- **Foco de teclado:** Para tests con ESPACIO, asegúrate de que el foco esté en la página
- **Backup:** Usa `exportUserData()` para hacer backups periódicos

---

## 🎯 Resumen de Tests Disponibles

### Audio Capture (3 tests)
1. ⌨️ Keyboard Capture - Captura 5 taps con ESPACIO
2. 🎤 Microphone Capture - Detecta beats del micrófono (threshold: -30 dB)
3. 🔍 Rhythm Analyzer - Analiza precisión vs patrón esperado

### Ejercicios de Entrenamiento (5 tests)
1. 🧪 Guardar Intento - `recordAttempt()` manual en localStorage
2. 💾 Ver Intentos - Consultar localStorage
3. ⏱️ Count-In - Visual + Audio feedback (requiere ear-training)
4. 🎼 Fraction Recognition - Reconocimiento de fracciones (requiere ear-training)
5. 🎯 Verificar Módulos - Comprobar disponibilidad de ear-training

### Gamificación (múltiples)
- Ver estadísticas, logros, nivel
- Trackear eventos (requiere init de app)
- Exportar/importar datos
- Gestión de usuario único

---

**💡 Tip:** Puedes copiar y pegar directamente estos comandos en la consola del navegador.

**📚 Documentación completa:**
- [DEVELOPMENT.md](DEVELOPMENT.md) - Guía de desarrollo
- [GAMIFICATION_PLAN.md](GAMIFICATION_PLAN.md) - Plan completo de gamificación (actualizado para modo offline)
- [GAMIFICATION_USAGE_EXAMPLE.md](GAMIFICATION_USAGE_EXAMPLE.md) - Ejemplos detallados de gamificación
- [GAMIFICATION_PROGRESS.md](GAMIFICATION_PROGRESS.md) - Progreso de implementación

---

*Última actualización: 2025-10-15 - Versión Offline Simplificada*
