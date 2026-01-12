# Comandos de Consola - Guía de Testing (Modo Offline)

Guía organizada para probar todas las funcionalidades del sistema de gamificación antes de crear la UI.

> 💡 **Tip:** Haz clic en las secciones (▶) para expandir/colapsar
> 📋 Todos los comandos son **copy-paste ready**
> ⚠️ **IMPORTANTE:** Ejecuta estos comandos desde la consola del navegador, NO desde el terminal
> 🔧 **MODO OFFLINE:** Todo se guarda en localStorage del navegador, sin servidor

---

## 🚀 Inicio Rápido - Quick Tests

<details open>
<summary>⚡ Tests Básicos (< 1 minuto)</summary>

### 1. Verificar Sistema de Gamificación

```javascript
// La gamificación se inicializa automáticamente al cargar cualquier App (2-5)
// Verificar que esté activa:
window.__GAMIFICATION.getStats()
// Retorna: { session: {...}, scoring: {...}, achievements: {...}, storage: {...} }

// Ver tu nivel actual
window.__GAMIFICATION.getUserLevel()
// Retorna: { level: 1, currentXP: 0, nextLevelXP: 100, title: "Principiante" }

// Ver nombre de usuario
window.__USER_MANAGER.getUserDisplayName()
// Retorna: "Usuario"
```

**✅ Todo funciona si:** Obtienes objetos con datos, no errores

</details>

<details>
<summary>🎯 Test de Tracking de Eventos</summary>

### 2. Trackear Acción de la App Actual

```javascript
// La app ya está inicializada automáticamente al cargar la página
// Puedes trackear acciones directamente:

// Para App2 - Sucesión de Pulsos
window.__GAMIFICATION.trackAppAction('play_clicked', { duration: 30 });

// Para App3 - Fracciones Temporales
window.__GAMIFICATION.trackAppAction('fraction_created', { numerator: 1, denominator: 4 });

// Para App4 - Pulsos Fraccionados
window.__GAMIFICATION.trackAppAction('pulse_pattern_created', { pattern: [1,0,1,0] });

// Para App5 - Pulsaciones
window.__GAMIFICATION.trackAppAction('play_started', { duration: 30 });

// Ver resultado
console.log('✅ Evento trackeado correctamente');
```

**Acciones disponibles por app:**
- **App2 (Sucesión de Pulsos):** `play_clicked`, `tap_tempo_used`, `loop_enabled`, `parameter_changed`, `randomize_used`, `pulse_selected`
- **App3 (Fracciones Temporales):** `fraction_created`, `parameter_changed`, `complexity_changed`
- **App4 (Pulsos Fraccionados):** `fraction_created`, `pulse_pattern_created`, `parameter_changed`, `cycle_activated`
- **App5 (Pulsaciones):** `play_started`, `interval_created`, `pattern_modified`, `parameter_changed`

</details>

---

## 🎤 Tests de Audio Capture

<details>
<summary>⌨️ Test 1: Keyboard Capture (5 segundos)</summary>

### Captura de Taps con Teclado

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
console.log('✅ Capturados', taps.length, 'taps');
console.log('📊 Timestamps (ms):', taps.map(t => Math.round(t)));

// Calcular intervalos entre taps
if (taps.length > 1) {
  const intervals = [];
  for (let i = 1; i < taps.length; i++) {
    intervals.push(Math.round(taps[i] - taps[i-1]));
  }
  console.log('⏱️  Intervalos (ms):', intervals);
}
```

**✅ Resultado esperado:**
- 5 timestamps en milisegundos
- Intervalos razonables entre taps (ej: 200-1000ms)

**⚠️ Troubleshooting:**
- Si no detecta las teclas, haz clic en la página principal (fuera de DevTools)
- El foco debe estar en la página, no en la consola

</details>

<details>
<summary>🎤 Test 2: Microphone Capture (7 segundos)</summary>

### Captura de Beats con Micrófono + Calibración Automática

**Descripción:** Calibra el ruido de fondo y detecta beats del micrófono
**Duración:** ~7 segundos (2s calibración + 5s captura)
**Requisito:** Permiso de micrófono

```javascript
const { createMicrophoneCapture } = await import('../../libs/gamification/index.js');

// Crear instancia
const mic = await createMicrophoneCapture({ threshold: -30, cooldown: 200 });

// PASO 1: Calibrar automáticamente el ruido de fondo
console.log('🎤 CALIBRACIÓN AUTOMÁTICA');
console.log('   Mantén silencio durante 2 segundos...');
await mic.calibrateNoiseFloor(2000);

// PASO 2: Capturar beats con el threshold calibrado
console.log('\n🎤 CAPTURA DE BEATS');
console.log('   Ahora golpea cerca del micrófono o aplaude durante 5 segundos...');

mic.startRecording();
await new Promise(resolve => setTimeout(resolve, 5000));
const beats = mic.stopRecording();

console.log('\n📊 RESULTADOS:');
console.log(`✅ Detectados ${beats.length} beats`);
if (beats.length > 0) {
  console.log('📍 Timestamps (ms):', beats.map(b => Math.round(b)));

  // Calcular intervalos entre beats
  if (beats.length > 1) {
    const intervals = [];
    for (let i = 1; i < beats.length; i++) {
      intervals.push(Math.round(beats[i] - beats[i-1]));
    }
    console.log('⏱️  Intervalos (ms):', intervals);

    // Estimar BPM
    if (intervals.length >= 2) {
      const avgInterval = intervals.reduce((a,b) => a+b) / intervals.length;
      const bpm = Math.round(60000 / avgInterval);
      console.log(`🎵 BPM estimado: ${bpm}`);
    }
  }
}

mic.dispose();
```

**✅ Resultado esperado:**
- Calibración detecta el ruido ambiente y ajusta el threshold (margen de 3-4.5 dB sobre el máximo ruido)
- Beats detectados cuando golpeas/aplaudes
- El threshold calibrado se adapta a tu entorno

**⚠️ Troubleshooting:**
- Si no detecta beats: El ambiente es muy ruidoso, prueba con threshold manual más bajo (-20 dB)
- Si detecta demasiados beats falsos: El ambiente es muy silencioso, prueba con threshold manual más alto (-35 dB)

**Variante con threshold manual (sin calibración):**
```javascript
const mic = await createMicrophoneCapture({ threshold: -25, cooldown: 200 });
console.log('🎤 Threshold manual: -25 dB');
mic.startRecording();
await new Promise(resolve => setTimeout(resolve, 5000));
const beats = mic.stopRecording();
console.log('✅ Beats:', beats.length);
mic.dispose();
```

</details>

<details>
<summary>🔍 Test 3: Rhythm Analyzer (instantáneo)</summary>

### Análisis de Precisión de Timing

**Descripción:** Analiza precisión de taps contra patrón esperado
**Duración:** Instantáneo

```javascript
const { createRhythmAnalyzer, fractionsToTimestamps } = await import('../../libs/gamification/index.js');

// Patrón esperado: 4 pulsos a 120 BPM (fracciones: 0, 0.25, 0.5, 0.75)
const expected = fractionsToTimestamps([0, 0.25, 0.5, 0.75], 120);
console.log('⏱️  Patrón esperado (120 BPM):', expected.map(t => Math.round(t)));

// Simular taps del usuario (con pequeños errores de ±25ms)
const userTaps = expected.map(t => t + Math.random() * 50 - 25);
console.log('👤 Taps del usuario:', userTaps.map(t => Math.round(t)));

// Analizar
const analyzer = createRhythmAnalyzer();
const result = analyzer.compareRhythm(userTaps, expected);

console.log('\n📊 ANÁLISIS:');
console.log('  ✅ Accuracy:', Math.round(result.accuracy * 100), '%');
console.log('  ⏱️  Timing Accuracy:', Math.round(result.timingAccuracy * 100), '%');
console.log('  🎯 Consistency Score:', Math.round(result.consistencyScore * 100), '%');
console.log('  🎵 Tempo Accuracy:', Math.round(result.tempoAccuracy * 100), '%');
console.log('  📉 Deviations (ms):', result.deviations.map(d => Math.round(d)));
console.log('  ❌ Missed taps:', result.missedTaps);
console.log('  ➕ Extra taps:', result.extraTaps);
```

**✅ Resultado esperado:**
- Accuracy ~90-95% (con errores pequeños de ±25ms)
- Timing Accuracy alta si los taps están cerca de los esperados
- Consistency Score alta si el ritmo es regular
- Tempo Accuracy alta si mantiene el BPM

</details>

---

## 🎼 Tests de Ejercicios de Entrenamiento

<details>
<summary>🧪 Test 4: Guardar Intento Manualmente (instantáneo)</summary>

### Guardar Resultado de Ejercicio en localStorage

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
    taps_count: 5
  }
});

console.log('📝 Resultado:', result);
// Retorna: { success: true, attempt_id: "...", message: "..." }

// Ver intentos guardados
const attempts = JSON.parse(localStorage.getItem('gamification_exercise_attempts') || '[]');
console.log(`📊 Total intentos guardados: ${attempts.length}`);
console.log('🎯 Últimos 3 intentos:');
console.table(attempts.slice(-3));
```

**✅ Resultado esperado:**
- `success: true`
- Intento guardado en localStorage con ID único
- Se puede consultar después con `localStorage.getItem('gamification_exercise_attempts')`

</details>

<details>
<summary>⏱️ Test 5: Count-In Visual + Audio (2-4 segundos)</summary>

### Count-In con Feedback Visual y Audio

**Descripción:** Prueba el count-in con feedback visual y audio
**Duración:** ~2-4 segundos (depende del BPM)
**Requisito:** Módulo ear-training cargado

```javascript
// CountInController está disponible globalmente en window.__EAR_TRAINING
if (!window.__EAR_TRAINING) {
  console.log('❌ Módulo ear-training no disponible');
  console.log('ℹ️  Este test requiere el módulo ear-training (disponible en App4)');
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

**✅ Resultado esperado:**
- Overlay aparece con números animados
- 4 clicks de audio (uno por beat)
- Intervalo de 500ms entre beats (60000/120)
- Overlay desaparece al terminar

**Variantes para probar:**
```javascript
if (window.__EAR_TRAINING) {
  const { CountInController } = window.__EAR_TRAINING;

  // Count-in rápido (240 BPM = 250ms/beat)
  const fast = new CountInController({ beats: 4, bpm: 240 });
  await fast.play();

  // Count-in lento (60 BPM = 1000ms/beat)
  const slow = new CountInController({ beats: 4, bpm: 60 });
  await slow.play();

  // Solo visual (sin audio)
  const silent = new CountInController({ beats: 4, bpm: 120, audioFeedback: false });
  await silent.play();

  // Solo audio (sin visual)
  const noVisual = new CountInController({ beats: 4, bpm: 120, visualFeedback: false });
  await noVisual.play();
}
```

</details>

<details>
<summary>🎼 Test 6: Fraction Recognition (2-3 minutos)</summary>

### Ejercicio Completo de Reconocimiento de Fracciones

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
  console.log('ℹ️  Este test requiere el módulo ear-training (disponible en App4)');
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
4. **Guarda el resultado automáticamente** en localStorage

**✅ Resultado esperado:**
- 10 preguntas completadas
- ~7 correctas (simulación 70%)
- Audio se reproduce (escucharás clicks de accent + base)
- El resultado se guarda en localStorage

**Nota:** En una UI real, el usuario ingresaría n y d manualmente.

</details>

---

## 🎮 Tests de Gamificación Completos

<details>
<summary>📊 Ver Estadísticas y Progreso</summary>

### Consultar Estado del Sistema de Gamificación

```javascript
// Ver estadísticas generales
const stats = window.__GAMIFICATION.getStats();
console.log('📊 Estadísticas Generales:');
console.table(stats.session);
console.table(stats.scoring);
console.table(stats.achievements);

// Ver nivel del usuario
const level = window.__GAMIFICATION.getUserLevel();
console.log(`\n🎖️  NIVEL: ${level.level} - ${level.title}`);
console.log(`   XP actual: ${level.currentXP}`);
console.log(`   XP para siguiente nivel: ${level.nextLevelXP}`);
console.log(`   Progreso: ${Math.round(level.progress * 100)}%`);

// Ver todos los logros
const achievements = window.__GAMIFICATION.getAchievements();
const unlocked = achievements.filter(a => a.unlocked);
console.log(`\n🏆 LOGROS: ${unlocked.length}/${achievements.length} desbloqueados`);
console.table(unlocked);

// Ver progreso de un logro específico
const comboProgress = window.__GAMIFICATION.getAchievementProgress('combo_master');
console.log('\n🎯 Progreso de "Combo Master":');
console.log(`   ${comboProgress.current}/${comboProgress.target} (${comboProgress.percentage}%)`);
```

</details>

<details>
<summary>💾 Ver Intentos de Ejercicios</summary>

### Consultar Intentos Guardados en localStorage

```javascript
// Ver todos los intentos guardados
const attempts = JSON.parse(localStorage.getItem('gamification_exercise_attempts') || '[]');
console.log(`📊 Total intentos: ${attempts.length}`);
console.table(attempts);

// Ver últimos 5 intentos
const last5 = attempts.slice(-5);
console.log('\n🎯 Últimos 5 intentos:');
console.table(last5);

// Filtrar por tipo de ejercicio
const sequenceAttempts = attempts.filter(a => a.exercise_type.includes('sequence'));
console.log(`\n🔢 Intentos de secuencia: ${sequenceAttempts.length}`);
console.table(sequenceAttempts);

// Ver mejores scores
const sortedByScore = [...attempts].sort((a, b) => b.score - a.score);
console.log('\n🏆 Top 5 scores:');
console.table(sortedByScore.slice(0, 5));

// Calcular accuracy promedio
if (attempts.length > 0) {
  const avgAccuracy = attempts.reduce((sum, a) => sum + a.accuracy, 0) / attempts.length;
  console.log(`\n📈 Accuracy promedio: ${avgAccuracy.toFixed(1)}%`);
}
```

</details>

<details>
<summary>👤 Gestión de Usuario</summary>

### Comandos de Usuario

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
<summary>💾 Backup y Restore</summary>

### Exportar/Importar Datos

```javascript
// Exportar todos los datos del usuario (para backup)
const backup = window.__GAMIFICATION.exportUserData();
console.log('📦 Datos exportados:', backup);

// Guardar backup en archivo (copiar JSON y pegarlo en un archivo)
copy(JSON.stringify(backup, null, 2));
console.log('✅ Backup copiado al portapapeles - pégalo en un archivo .json');

// Importar datos desde backup
// Pega aquí tu backup JSON
const myBackup = {
  "version": "1.0.0",
  "export_date": "2025-10-15T...",
  // ... resto del backup
};

window.__GAMIFICATION.importUserData(myBackup);
console.log('✅ Datos restaurados desde backup');

// Resetear sesión actual (mantiene logros y puntos totales)
window.__GAMIFICATION.resetSession();

// Resetear TODO (¡cuidado!)
window.__GAMIFICATION.resetAll();
```

</details>

---

## 🔄 Workflow de Testing Completo

<details open>
<summary>🎯 Flujo Completo: Testing de Todas las Funcionalidades</summary>

### Workflow Recomendado (Ejecutar en Orden)

Este flujo prueba todas las funcionalidades en ~10 minutos:

```javascript
// ═══════════════════════════════════════════════════════════
// PASO 1: Configuración Inicial (10 segundos)
// ═══════════════════════════════════════════════════════════
console.log('🚀 PASO 1: Configuración Inicial');
window.__USER_MANAGER.setUserDisplayName("Tester");
const initialStats = window.__GAMIFICATION.getStats();
console.log('✅ Sistema inicializado');
console.table(initialStats.session);

// ═══════════════════════════════════════════════════════════
// PASO 2: Test de Keyboard Capture (10 segundos)
// ═══════════════════════════════════════════════════════════
console.log('\n⌨️  PASO 2: Keyboard Capture');
const { createKeyboardCapture } = await import('../../libs/gamification/index.js');
const keyboard = createKeyboardCapture();
console.log('   Presiona ESPACIO 5 veces...');
keyboard.startRecording();
await new Promise(resolve => setTimeout(resolve, 10000));
const keyboardTaps = keyboard.stopRecording();
console.log(`✅ ${keyboardTaps.length} taps capturados`);

// ═══════════════════════════════════════════════════════════
// PASO 3: Test de Microphone Capture (7 segundos)
// ═══════════════════════════════════════════════════════════
console.log('\n🎤 PASO 3: Microphone Capture + Calibración');
const { createMicrophoneCapture } = await import('../../libs/gamification/index.js');
const mic = await createMicrophoneCapture({ threshold: -30, cooldown: 200 });
console.log('   Mantén silencio 2s...');
await mic.calibrateNoiseFloor(2000);
console.log('   Ahora golpea/aplaude 5s...');
mic.startRecording();
await new Promise(resolve => setTimeout(resolve, 5000));
const micBeats = mic.stopRecording();
console.log(`✅ ${micBeats.length} beats detectados`);
mic.dispose();

// ═══════════════════════════════════════════════════════════
// PASO 4: Test de Rhythm Analyzer (instantáneo)
// ═══════════════════════════════════════════════════════════
console.log('\n🔍 PASO 4: Rhythm Analyzer');
const { createRhythmAnalyzer, fractionsToTimestamps } = await import('../../libs/gamification/index.js');
const expected = fractionsToTimestamps([0, 0.25, 0.5, 0.75], 120);
const userTaps = expected.map(t => t + Math.random() * 50 - 25);
const analyzer = createRhythmAnalyzer();
const rhythmResult = analyzer.compareRhythm(userTaps, expected);
console.log(`✅ Accuracy: ${Math.round(rhythmResult.accuracy * 100)}%`);

// ═══════════════════════════════════════════════════════════
// PASO 5: Guardar Intento de Ejercicio (instantáneo)
// ═══════════════════════════════════════════════════════════
console.log('\n🧪 PASO 5: Guardar Intento de Ejercicio');
const { recordAttempt } = await import('../../libs/gamification/index.js');
recordAttempt({
  exercise_type: 'test_workflow',
  exercise_title: 'Workflow Test',
  score: 95,
  accuracy: 98,
  metadata: { test: true }
});
console.log('✅ Intento guardado');

// ═══════════════════════════════════════════════════════════
// PASO 6: Trackear Eventos de App (instantáneo)
// ═══════════════════════════════════════════════════════════
console.log('\n🎮 PASO 6: Trackear Eventos');
window.__GAMIFICATION.trackEvent('practice_completed', { score: 95 });
console.log('✅ Evento trackeado');

// ═══════════════════════════════════════════════════════════
// PASO 7: Verificar Estadísticas Finales
// ═══════════════════════════════════════════════════════════
console.log('\n📊 PASO 7: Estadísticas Finales');
const finalStats = window.__GAMIFICATION.getStats();
const level = window.__GAMIFICATION.getUserLevel();
const attempts = JSON.parse(localStorage.getItem('gamification_exercise_attempts') || '[]');

console.log('\n🏆 RESUMEN FINAL:');
console.log(`   Usuario: ${window.__USER_MANAGER.getUserDisplayName()}`);
console.log(`   Nivel: ${level.level} - ${level.title}`);
console.log(`   XP: ${level.currentXP}`);
console.log(`   Eventos: ${finalStats.session.totalEvents || 0}`);
console.log(`   Intentos guardados: ${attempts.length}`);
console.log('\n✅ WORKFLOW COMPLETO - TODAS LAS FUNCIONALIDADES PROBADAS');
```

**⏱️ Tiempo estimado:** ~10 minutos
**✅ Todo funciona si:** Cada paso se completa sin errores

</details>

<details>
<summary>🎼 Flujo con Fraction Recognition (solo App4)</summary>

### Workflow Completo Incluyendo Ejercicio de Fracciones

**Requisito:** Estar en App4 y tener Tone.js inicializado

```javascript
// Verificar que estamos en App4 y Tone.js está listo
if (!window.__EAR_TRAINING) {
  console.log('❌ Este flujo solo funciona en App4');
} else if (Tone.context.state !== 'running') {
  console.log('⚠️  Primero inicializa Tone.js: await Tone.start()');
} else {
  console.log('🎼 FLUJO COMPLETO CON FRACTION RECOGNITION\n');

  // ... Ejecutar PASOS 1-6 del workflow anterior ...

  // PASO ADICIONAL: Fraction Recognition (2-3 minutos)
  console.log('\n🎼 PASO EXTRA: Fraction Recognition Exercise');
  const { FractionRecognitionExercise } = window.__EAR_TRAINING;
  const ex4 = new FractionRecognitionExercise();
  await ex4.initialize();
  console.log('   Ejecutando 10 preguntas...');
  const result = await ex4.runLevel(1);
  console.log(`✅ Ejercicio completado: ${result.correctCount}/10 correctas (${Math.round(result.accuracy)}%)`);
  ex4.dispose();

  // Ver estadísticas finales
  const finalStats = window.__GAMIFICATION.getStats();
  const level = window.__GAMIFICATION.getUserLevel();
  console.log('\n🏆 RESUMEN FINAL CON EJERCICIO:');
  console.log(`   Nivel: ${level.level} - XP: ${level.currentXP}`);
  console.log(`   Intentos totales: ${JSON.parse(localStorage.getItem('gamification_exercise_attempts') || '[]').length}`);
  console.log('\n✅ WORKFLOW COMPLETO CON EJERCICIO');
}
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

### Micrófono no detecta beats o detecta demasiados

**Problema:** Calibración no funciona bien en tu ambiente

**Solución:**
```javascript
// Usar threshold manual en lugar de calibración
const mic = await createMicrophoneCapture({ threshold: -20, cooldown: 200 });
// Ajusta el threshold según tu ambiente:
// - Ambiente ruidoso: -15 a -20 dB
// - Ambiente normal: -25 a -30 dB
// - Ambiente muy silencioso: -35 a -40 dB
```

---

### Datos no persisten entre sesiones

**Problema:** Los datos desaparecen al cerrar el navegador

**Solución:**
- Verificar que localStorage esté habilitado
- No usar modo incógnito/privado
- Verificar configuración del navegador (no bloquear cookies/storage)

---

### Módulo ear-training no disponible

**Problema:** `window.__EAR_TRAINING` es undefined

**Solución:**
- Los tests de Count-In y Fraction Recognition solo funcionan en App4
- Navega a `/apps/App4/` para acceder a estos tests
- Los demás tests funcionan en cualquier app (App2-App5)

</details>

---

## 📝 Notas Importantes

- **Modo Offline:** Todo se guarda en localStorage del navegador
- **Sin servidor:** No hay API ni base de datos externa
- **Usuario único:** Un solo usuario implícito por navegador
- **Gamificación auto-inicializada:** Al cargar cualquier App (2-5), la gamificación se activa automáticamente
- **Comandos síncronos:** La mayoría no necesitan `await`
- **Comandos asíncronos:** Solo los de audio capture y ejercicios usan `await import()`
- **Permisos:** Tests de micrófono requieren permisos del navegador
- **Foco de teclado:** Para tests con ESPACIO, asegúrate de que el foco esté en la página
- **Backup:** Usa `exportUserData()` para hacer backups periódicos
- **Calibración de micrófono:** Ajustada a margen de 3-4.5 dB (1.5x desviación estándar) para mejor sensibilidad

---

## 🎮 Comandos del Juego de App5

<details>
<summary>🎮 Sistema de Juego UI (App5)</summary>

### 1. Configuración del Modo de Entrada

```javascript
// Forzar modo teclado (útil en ambientes ruidosos)
window.gameForceKeyboard = true;

// Volver al modo micrófono (por defecto)
window.gameForceKeyboard = false;

// Verificar modo actual
console.log('Modo:', window.gameForceKeyboard ? 'Teclado' : 'Micrófono');
```

### 2. Acceso al Game Manager

```javascript
// Acceder al manager del juego
const gm = window.gameManager;

// Ver estado actual del juego
console.log(gm.gameState.getStatsSummary());

// Ver nivel actual
console.log('Nivel actual:', gm.gameState.currentLevel);

// Ver niveles completados
console.log('Completados:', gm.gameState.completedLevels);
```

### 3. Iniciar el Juego Manualmente

```javascript
// Simular click en botón de gamificación
document.getElementById('gamificationToggleBtn')?.click();

// O directamente
window.gameManager.startGame();

// Cargar un nivel específico
window.gameManager.loadLevel(1); // Niveles 1-4
```

### 4. Control del Personaje

```javascript
// Cambiar mood del personaje
window.gameManager.ui.character.setMood('happy');
window.gameManager.ui.character.setMood('sad');
window.gameManager.ui.character.setMood('thinking');
window.gameManager.ui.character.setMood('celebrating');
window.gameManager.ui.character.setMood('confused');
window.gameManager.ui.character.setMood('focused');
window.gameManager.ui.character.setMood('neutral');

// Animar personaje
window.gameManager.ui.character.animate('bounce');
window.gameManager.ui.character.animate('shake');
window.gameManager.ui.character.animate('pulse');
```

### 5. Gestión del Estado del Juego

```javascript
// Ver estadísticas completas
const stats = window.gameManager.gameState.getStatsSummary();
console.table({
  'Progreso': stats.progress + '%',
  'Nivel Actual': stats.currentLevel,
  'Niveles Completados': stats.completedLevels,
  'Intentos Totales': stats.totalAttempts,
  'Tasa de Éxito': stats.successRate.toFixed(1) + '%',
  'Precisión Media': stats.averageAccuracy.toFixed(1) + '%',
  'Racha Actual': stats.currentStreak,
  'Mejor Racha': stats.bestStreak,
  'Logros': stats.achievementsUnlocked + '/' + stats.totalAchievements
});

// Resetear progreso (mantiene estadísticas)
window.gameManager.gameState.reset(true);

// Resetear todo
window.gameManager.gameState.reset(false);

// Exportar datos del juego
const backup = window.gameManager.gameState.export();
console.log('Backup creado:', backup);

// Importar datos del juego
window.gameManager.gameState.import(backup);
```

### 6. Logros y Achievements

```javascript
// Ver todos los logros
const achievements = window.gameManager.gameState.achievements;
console.table(achievements);

// Ver descripción de logros
const achievementInfo = {
  firstStep: 'Completar nivel 1',
  evenOdd: 'Completar niveles 1 y 2',
  adaptive: 'Completar nivel 3 (dinámico)',
  freeSpirit: 'Completar nivel 4 (libre)',
  perfectScore: 'Obtener 100% de precisión',
  streakMaster: 'Conseguir 5 victorias seguidas',
  speedDemon: 'Completar un nivel en menos de 10 segundos',
  persistent: 'Jugar 10 partidas',
  expert: 'Completar todos los niveles'
};
console.table(achievementInfo);
```

### 7. Control de Pulse Sequence

```javascript
// Ver texto actual del pulse sequence
const text = window.pulseSeqController.getText();
console.log('Pulse sequence:', text);

// Establecer un patrón específico
window.pulseSeqController.setText('P ( 1 3 5 ) Lg = 8');

// Obtener selección sanitizada
const lg = 8;
const selection = '1 2 3 4 5';
const sanitized = window.gameManager.sanitizePulseSequence(selection, lg);
console.log('Sanitizado:', sanitized);
```

### 8. Tests de Niveles

```javascript
// Test rápido del nivel 1
async function testLevel1() {
  window.gameManager.loadLevel(1);
  // Establecer solución correcta
  window.pulseSeqController.setText('P ( 1 3 ) Lg = 4');
  // Validar
  await window.gameManager.validatePhase1();
}
testLevel1();

// Test rápido del nivel 2
async function testLevel2() {
  window.gameManager.loadLevel(2);
  window.pulseSeqController.setText('P ( 2 4 ) Lg = 4');
  await window.gameManager.validatePhase1();
}
testLevel2();

// Ver configuración de nivel dinámico
import('./game/levels-config.js').then(module => {
  const level3 = module.getLevel(3);
  console.log('Nivel 3 generado:', level3);
});
```

### 9. Depuración de Audio Capture

```javascript
// Test de captura con teclado
async function testKeyboardCapture() {
  window.gameForceKeyboard = true;
  const { createKeyboardCapture } = await import('./../../libs/gamification/index.js');
  const capture = createKeyboardCapture();

  console.log('Presiona ESPACIO 5 veces...');
  const promise = capture.startCapture();

  setTimeout(async () => {
    const beats = await capture.stopCapture();
    console.log('Beats capturados:', beats);
  }, 5000);
}
testKeyboardCapture();

// Test de calibración de micrófono
async function testMicCalibration() {
  window.gameForceKeyboard = false;
  const { createMicrophoneCapture } = await import('./../../libs/gamification/index.js');
  const mic = createMicrophoneCapture();

  console.log('Calibrando micrófono...');
  await mic.calibrateNoiseFloor(2000);
  console.log('Calibración completa');
}
testMicCalibration();
```

### 10. Workflow de Testing Completo del Juego

```javascript
// Test completo del flujo del juego
async function testGameFlow() {
  // 1. Configurar modo teclado
  window.gameForceKeyboard = true;
  console.log('✅ Modo teclado activado');

  // 2. Iniciar juego
  window.gameManager.startGame();
  console.log('✅ Juego iniciado');

  // 3. Cargar nivel 1
  await new Promise(r => setTimeout(r, 1000));
  window.gameManager.loadLevel(1);
  console.log('✅ Nivel 1 cargado');

  // 4. Establecer solución
  await new Promise(r => setTimeout(r, 500));
  window.pulseSeqController.setText('P ( 1 3 ) Lg = 4');
  console.log('✅ Solución establecida');

  // 5. Validar fase 1
  await new Promise(r => setTimeout(r, 500));
  await window.gameManager.validatePhase1();
  console.log('✅ Fase 1 validada');

  // 6. Ver estadísticas
  const stats = window.gameManager.gameState.getStatsSummary();
  console.log('📊 Estadísticas:', stats);

  console.log('✅ Test completo finalizado');
}
testGameFlow();
```

</details>

---

## 🎯 Resumen de Tests Disponibles

### Tests Rápidos (< 1 minuto)
1. ✅ Verificar Sistema de Gamificación - Instantáneo
2. 🎯 Trackear Acción de App - Instantáneo
3. 🔍 Rhythm Analyzer - Instantáneo
4. 🧪 Guardar Intento - Instantáneo

### Tests de Audio Capture (~1 minuto c/u)
1. ⌨️ Keyboard Capture - 10 segundos (5 taps)
2. 🎤 Microphone Capture + Calibración - 7 segundos (2s calibración + 5s captura)

### Tests de Ejercicios (requieren App4)
1. ⏱️ Count-In - 2-4 segundos (visual + audio)
2. 🎼 Fraction Recognition - 2-3 minutos (10 preguntas automáticas)

### Tests de Gamificación (instantáneos)
1. 📊 Ver Estadísticas y Progreso
2. 💾 Ver Intentos de Ejercicios
3. 👤 Gestión de Usuario
4. 💾 Backup y Restore

### Workflows Completos
1. 🎯 Workflow Básico - ~10 minutos (todos los tests menos Fraction Recognition)
2. 🎼 Workflow con Fraction Recognition - ~13 minutos (solo en App4)

---

**💡 Tip Final:** Empieza con el "Workflow de Testing Completo" para probar todas las funcionalidades de forma ordenada.

**📚 Documentación completa:**
- [DEVELOPMENT.md](DEVELOPMENT.md) - Guía de desarrollo
- [GAMIFICATION_PLAN.md](GAMIFICATION_PLAN.md) - Plan completo de gamificación (actualizado para modo offline)
- [GAMIFICATION_USAGE_EXAMPLE.md](GAMIFICATION_USAGE_EXAMPLE.md) - Ejemplos detallados de gamificación
- [GAMIFICATION_PROGRESS.md](GAMIFICATION_PROGRESS.md) - Progreso de implementación

---

*Última actualización: 2025-10-15 - Versión Optimizada para Testing Workflow*
