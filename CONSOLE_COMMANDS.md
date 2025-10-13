# Comandos de Consola - Referencia Rápida

Guía rápida con **desplegables** para no ocupar espacio en consola.

> 💡 **Tip:** Haz clic en las secciones (▶) para expandir/colapsar
> 📋 Todos los comandos son **copy-paste ready**

---

## 📦 Categorías

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
// Retorna: { level: 3, title: 'Estudiante', current_score: 1250, ... }

// Ver todos los logros
window.__GAMIFICATION.getAchievements()
// Retorna: [{ id, name, description, unlocked, progress, ... }, ...]

// Ver solo logros desbloqueados
window.__GAMIFICATION.getAchievements().filter(a => a.unlocked)

// Ver progreso de un logro específico
window.__GAMIFICATION.getAchievementProgress('rhythm_novice')
```

### Tracking de Eventos

```javascript
// Trackear un evento manualmente
window.__GAMIFICATION.trackEvent('PATTERN_PLAYED', { lg_value: 16 })

// Ver historial de eventos
window.__GAMIFICATION.getEventHistory()

// Ver configuración
window.__GAMIFICATION.getConfig()
```

</details>

<details>
<summary>🎵 Audio Capture Testing (12 tests - Fase 2b)</summary>

> **Nota:** Todos los tests usan `await import()` porque la consola no soporta `import` estático.

### Tests Básicos (4)

<details>
<summary>Test 1: Verificar Soporte ✅</summary>

**Descripción:** Verifica que el navegador soporte micrófono y teclado
**Duración:** Instantáneo

```javascript
const { checkSupport } = await import('../../libs/audio-capture/index.js');

const support = checkSupport();
console.log('Soporte:', support);
// Debe mostrar: { microphone: true, keyboard: true, overall: true }
```

**Resultado esperado:**
- `microphone: true` - Navegador soporta getUserMedia
- `keyboard: true` - Navegador soporta eventos de teclado
- `overall: true` - Sistema completo disponible

</details>

<details>
<summary>Test 2: Captura de Teclado ⌨️</summary>

**Descripción:** Captura simple de tecla ESPACIO con feedback visual
**Duración:** 5 segundos

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

**Resultado esperado:**
- Círculo azul flotante en esquina inferior derecha
- Círculo se ilumina al presionar ESPACIO
- Lista de timestamps en ms después de 5 segundos

</details>

<details>
<summary>Test 7: Helper de Fracciones 🎼</summary>

**Descripción:** Convierte notación musical a timestamps
**Duración:** Instantáneo

```javascript
const { fractionsToTimestamps } = await import('../../libs/audio-capture/index.js');

// Patrón: redonda, blanca, negra, corchea
const pattern = [1, 0.5, 0.25, 0.125];
const timestamps = fractionsToTimestamps(pattern, 120, 0);

console.log('🎼 Patrón de fracciones (120 BPM):');
console.log('   Redonda (1)    @ 0ms');
console.log('   Blanca (1/2)   @', Math.round(timestamps[1]), 'ms');
console.log('   Negra (1/4)    @', Math.round(timestamps[2]), 'ms');
console.log('   Corchea (1/8)  @', Math.round(timestamps[3]), 'ms');
```

**Valores de fracción:**
- `1` = Redonda, `0.5` = Blanca, `0.25` = Negra, `0.125` = Corchea

</details>

<details>
<summary>Test 9: Ajustar Configuración ⚙️</summary>

**Descripción:** Crear analizadores con diferentes configuraciones
**Duración:** Instantáneo

```javascript
const { createRhythmAnalyzer } = await import('../../libs/audio-capture/index.js');

// Configuración estricta
const strictAnalyzer = createRhythmAnalyzer({
  timingTolerance: 50,   // ±50ms
  tempoTolerance: 5,     // ±5 BPM
  weights: { timing: 0.7, consistency: 0.2, tempo: 0.1 }
});

// Configuración relajada
const relaxedAnalyzer = createRhythmAnalyzer({
  timingTolerance: 200,  // ±200ms
  tempoTolerance: 20,    // ±20 BPM
  weights: { timing: 0.3, consistency: 0.5, tempo: 0.2 }
});

console.log('✅ Analizadores creados con diferentes tolerancias');
```

</details>

### Tests de Análisis (3)

<details>
<summary>Test 3: Análisis vs Patrón 🎯</summary>

**Descripción:** Compara tu ritmo contra un patrón esperado
**Duración:** 5 segundos de captura + análisis

```javascript
const {
  createKeyboardCapture,
  createRhythmAnalyzer,
  generateExpectedPattern
} = await import('../../libs/audio-capture/index.js');

// Generar patrón de 120 BPM, 8 beats
const expected = generateExpectedPattern(120, 8);
const kbd = createKeyboardCapture({ visualFeedback: true });
const analyzer = createRhythmAnalyzer();

console.log('🎯 Patrón esperado (120 BPM, 8 beats)');
console.log('📍 Presiona ESPACIO cada 500ms aprox');

kbd.startRecording();

setTimeout(() => {
  const recorded = kbd.stopRecording();
  const result = analyzer.compareRhythm(recorded, expected);

  console.log('📊 RESULTADOS:');
  console.log(`   Accuracy: ${result.accuracy}%`);
  console.log(`   Timing: ${result.timingAccuracy}%`);
  console.log(`   Consistency: ${result.consistencyScore}%`);
  console.log(`   Tempo: ${result.tempoAccuracy}%`);
  console.log(`   💬 ${result.message}`);

  kbd.dispose();
}, 5000);
```

**Interpretación:**
- 90-100%: Excelente
- 75-89%: Muy bien
- 60-74%: Bien
- <60%: Sigue practicando

</details>

<details>
<summary>Test 4: Detección de Tempo 🎵</summary>

**Descripción:** Detecta BPM de tus taps libres
**Duración:** 10 segundos

```javascript
const { createKeyboardCapture, createRhythmAnalyzer } = await import('../../libs/audio-capture/index.js');

const kbd = createKeyboardCapture({ visualFeedback: true });
const analyzer = createRhythmAnalyzer();

kbd.startRecording();
console.log('🎹 Presiona ESPACIO 8 veces a tu ritmo natural...');

setTimeout(() => {
  const taps = kbd.stopRecording();
  const tempo = analyzer.detectTempo(taps);

  console.log('🎵 TEMPO DETECTADO:');
  console.log(`   BPM: ${tempo.bpm}`);
  console.log(`   Confianza: ${Math.round(tempo.confidence * 100)}%`);
  console.log(`   Intervalo: ${Math.round(tempo.avgInterval)}ms`);

  kbd.dispose();
}, 10000);
```

**Referencias de BPM:**
- 60-80: Lento (balada)
- 90-110: Moderado (pop)
- 120-140: Rápido (dance)
- 150+: Muy rápido (techno)

</details>

<details>
<summary>Test 6: Análisis Libre 🎨</summary>

**Descripción:** Analiza ritmo libre y detecta patrones
**Duración:** 10 segundos

```javascript
const { createKeyboardCapture, createRhythmAnalyzer } = await import('../../libs/audio-capture/index.js');

const kbd = createKeyboardCapture({ visualFeedback: true });
const analyzer = createRhythmAnalyzer();

kbd.startRecording();
console.log('🎹 Improvisa un ritmo durante 10 segundos...');

setTimeout(() => {
  const taps = kbd.stopRecording();
  const analysis = analyzer.analyzeFreeRhythm(taps);

  console.log('🎨 ANÁLISIS:');
  console.log(`   BPM: ${Math.round(analysis.tempo.bpm)}`);
  console.log(`   Consistencia: ${Math.round(analysis.consistency * 100)}%`);
  console.log(`   Total taps: ${analysis.totalTaps}`);
  console.log('   Patrones:', analysis.patterns);

  kbd.dispose();
}, 10000);
```

</details>

### Tests de Micrófono (2)

<details>
<summary>Test 5: Sistema Completo 🎤⌨️</summary>

**Descripción:** Captura simultánea de micrófono + teclado
**Duración:** 10 segundos
**Requisitos:** Permisos de micrófono

```javascript
const { createCaptureSystem } = await import('../../libs/audio-capture/index.js');

// Crear sistema completo
const system = await createCaptureSystem({
  microphone: {
    threshold: -30,
    minInterval: 100,
    onBeatDetected: (e) => console.log(`🎤 Beat #${e.beatNumber}`)
  },
  keyboard: {
    visualFeedback: true,
    onTapDetected: (e) => console.log(`⌨️ Tap #${e.tapNumber}`)
  }
});

if (!system.micInitialized) {
  console.warn('⚠️ Micrófono no disponible - solo teclado');
}

console.log('🎙️ Captura combinada (10 segundos)...');
console.log('💡 Prueba: palmadas + ESPACIO mezclados');

await system.combined.startRecording();

setTimeout(() => {
  const results = system.combined.stopRecording();
  console.log('📊 RESULTADOS:');
  console.log(`   🎤 Micrófono: ${results.microphone.length}`);
  console.log(`   ⌨️ Teclado: ${results.keyboard.length}`);
  console.log(`   📦 Total: ${results.totalEvents}`);
  system.dispose();
}, 10000);
```

**Consejos:**
- Da palmadas cerca del micrófono
- Si no detecta, baja threshold a -35 o -40

</details>

<details>
<summary>Test 8: Monitor de Nivel 📊</summary>

**Descripción:** Ver nivel de micrófono en tiempo real
**Duración:** 10 segundos
**Requisitos:** Permisos de micrófono

```javascript
const { createMicrophoneCapture } = await import('../../libs/audio-capture/index.js');

const mic = createMicrophoneCapture();
const initialized = await mic.initialize();

if (!initialized) {
  console.error('❌ No se pudo inicializar el micrófono');
} else {
  console.log('📊 Monitoreando nivel (10 segundos)...');
  console.log('💡 Habla o aplaude cerca del micrófono');

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
- -60 dB: Silencio
- -40 dB: Ruido ambiental
- -30 dB: Voz normal
- -20 dB: Voz alta
- -10 dB: Palmada
- 0 dB: Máximo (clipping)

</details>

### Tests Avanzados (3)

<details>
<summary>Test 10: Ejercicio Guiado 🎯</summary>

**Descripción:** Ejercicio completo con cuenta regresiva
**Duración:** ~15 segundos total

```javascript
const {
  createKeyboardCapture,
  createRhythmAnalyzer,
  generateExpectedPattern
} = await import('../../libs/audio-capture/index.js');

console.log('🎯 EJERCICIO DE RITMO - NIVEL 1');
console.log('================================\n');

// Paso 1: Objetivo
const bpm = 100;
const beats = 4;
const expected = generateExpectedPattern(bpm, beats);

console.log(`📋 Objetivo: ${beats} beats a ${bpm} BPM`);
console.log(`⏱️ Intervalo: ${Math.round(60000 / bpm)}ms entre beats`);
console.log(`\n💡 TIP: Cuenta "1, 2, 3, 4" a ritmo constante\n`);

// Paso 2: Preparar
const kbd = createKeyboardCapture({ visualFeedback: true });
const analyzer = createRhythmAnalyzer();

// Paso 3: Cuenta regresiva
console.log('⏳ Preparándote...');
await new Promise(r => setTimeout(r, 2000));
console.log('3...');
await new Promise(r => setTimeout(r, 1000));
console.log('2...');
await new Promise(r => setTimeout(r, 1000));
console.log('1...');
await new Promise(r => setTimeout(r, 1000));
console.log('🎹 ¡AHORA! Presiona ESPACIO 4 veces\n');

// Paso 4: Capturar
kbd.startRecording();
await new Promise(r => setTimeout(r, 5000));

// Paso 5: Analizar
const recorded = kbd.stopRecording();
const result = analyzer.compareRhythm(recorded, expected);

console.log('\n📊 RESULTADOS:');
console.log(`🎯 Accuracy: ${result.accuracy}%`);
console.log(`⏱️ Timing: ${result.timingAccuracy}%`);
console.log(`📊 Consistencia: ${result.consistencyScore}%`);
console.log(`\n💬 ${result.message}`);

if (result.accuracy >= 90) {
  console.log('\n🏆 ¡EXCELENTE! Nivel completado');
} else if (result.accuracy >= 75) {
  console.log('\n⭐ ¡Muy bien! Prueba el siguiente nivel');
} else {
  console.log('\n💪 Sigue practicando');
}

kbd.dispose();
```

</details>

<details>
<summary>Test 11: Captura con Audio 🎵⌨️</summary>

**Descripción:** Verifica que funciona con audio reproduciéndose
**Duración:** 11 segundos (3s espera + 8s captura)

```javascript
const { createKeyboardCapture } = await import('../../libs/audio-capture/index.js');

const kbd = createKeyboardCapture({
  visualFeedback: true,
  useCapture: true  // Garantiza prioridad (default: true)
});

console.log('🎵 INSTRUCCIONES:');
console.log('1. Reproduce audio en la app (presiona play)');
console.log('2. Espera 3 segundos');
console.log('3. Presiona ESPACIO al ritmo del audio');
console.log('');
console.log('⏳ Esperando 3 segundos...');

await new Promise(r => setTimeout(r, 3000));

kbd.startRecording();
console.log('⌨️ ¡Captura iniciada! Presiona ESPACIO al ritmo');

setTimeout(() => {
  const taps = kbd.stopRecording();
  console.log(`\n✅ Capturados ${taps.length} taps con audio`);
  console.log('🎉 ¡Funciona correctamente!');
  kbd.dispose();
}, 8000);
```

**Por qué funciona:**
- Usa `{ capture: true }` por defecto
- Captura eventos antes que otros listeners
- Funciona incluso si el reproductor también escucha ESPACIO

</details>

<details>
<summary>Test 12: Tecla Alternativa 🔀</summary>

**Descripción:** Usar tecla diferente a ESPACIO
**Duración:** 10 segundos (5s por cada tecla)

```javascript
const { createKeyboardCapture } = await import('../../libs/audio-capture/index.js');

// Opción 1: Configurar en constructor
const kbd1 = createKeyboardCapture({
  key: 'Enter',
  visualFeedback: true
});

console.log('⌨️ Test 1: Captura con ENTER (5 segundos)...');
kbd1.startRecording();

setTimeout(() => {
  const taps1 = kbd1.stopRecording();
  console.log(`✅ Capturados ${taps1.length} taps con ENTER`);
  kbd1.dispose();

  // Opción 2: Cambiar dinámicamente
  const kbd2 = createKeyboardCapture({ visualFeedback: true });
  kbd2.setKey('t');

  console.log('\n⌨️ Test 2: Captura con tecla T (5 segundos)...');
  kbd2.startRecording();

  setTimeout(() => {
    const taps2 = kbd2.stopRecording();
    console.log(`✅ Capturados ${taps2.length} taps con T`);
    kbd2.dispose();
  }, 5000);
}, 5000);
```

**Teclas recomendadas:**
- `'Enter'` - Enter/Return
- `'t'` - Tecla T (fácil de presionar)
- `'x'` - Tecla X
- `'c'` - Tecla C

</details>

</details>

<details>
<summary>🧪 API Testing</summary>

```javascript
// Health check
await fetch('http://localhost:3000/api/health').then(r => r.json())

// Listar usuarios
await fetch('http://localhost:3000/api/users').then(r => r.json())

// Ver usuario específico con stats
await fetch('http://localhost:3000/api/users/1').then(r => r.json())

// Listar ejercicios
await fetch('http://localhost:3000/api/exercises').then(r => r.json())

// Ejercicios por tipo
await fetch('http://localhost:3000/api/exercises?type=sequence_entry').then(r => r.json())
```

</details>

---

## 📊 Ejemplos de Flujos Completos

<details>
<summary>Flujo 1: Cambiar Usuario y Ver Stats</summary>

```javascript
// 1. Cambiar a usuario tester
window.__USER_MANAGER.switchUser(1)

// 2. Ver stats desde API
const stats = await window.__USER_MANAGER.fetchUserStats()
console.log(`Score: ${stats.total_score}, Level: ${stats.current_level}`)

// 3. Ver intentos recientes
const attempts = await window.__USER_MANAGER.fetchUserAttempts(5)
console.log(`Últimos ${attempts.length} intentos:`, attempts)
```

</details>

<details>
<summary>Flujo 2: Migrar Datos a BD</summary>

```javascript
// 1. Verificar que servidor está disponible
const available = await window.__MIGRATION.isServerAvailable()
console.log('Servidor disponible:', available)

// 2. Ver si ya se migró
const info = window.__MIGRATION.info()
console.log('Info migración:', info)

// 3. Migrar (si es necesario)
if (!info) {
  const result = await window.__MIGRATION.migrate()
  console.log('Migración:', result)
}
```

</details>

<details>
<summary>Flujo 3: Ver Progreso de Gamificación</summary>

```javascript
// 1. Stats generales
const stats = window.__GAMIFICATION.getStats()
console.log('Puntos sesión:', stats.scoring.session_score)
console.log('Racha actual:', stats.scoring.current_streak)

// 2. Nivel actual
const level = window.__GAMIFICATION.getUserLevel()
console.log(`Nivel ${level.level}: ${level.title}`)
console.log(`Progreso: ${level.progress_percentage}%`)

// 3. Logros
const achievements = window.__GAMIFICATION.getAchievements()
const unlocked = achievements.filter(a => a.unlocked)
console.log(`Logros: ${unlocked.length}/${achievements.length}`)

// 4. Logros recientes
const recent = unlocked.filter(a => !a.notified)
recent.forEach(a => console.log(`🏆 ${a.name}: ${a.description}`))
```

</details>

<details>
<summary>Flujo 4: Test de Ritmo Completo 🎵 (NUEVO)</summary>

```javascript
// 1. Verificar soporte
const {
  checkSupport,
  createKeyboardCapture,
  createRhythmAnalyzer,
  generateExpectedPattern
} = await import('../../libs/audio-capture/index.js');

console.log('Soporte:', checkSupport());

// 2. Generar patrón (120 BPM, 8 beats)
const expected = generateExpectedPattern(120, 8);

// 3. Capturar ritmo
const kbd = createKeyboardCapture({ visualFeedback: true });
kbd.startRecording();
console.log('🎹 Presiona ESPACIO 8 veces al ritmo (500ms cada uno)...');

await new Promise(r => setTimeout(r, 5000));

// 4. Analizar
const recorded = kbd.stopRecording();
const analyzer = createRhythmAnalyzer();
const result = analyzer.compareRhythm(recorded, expected);

console.log(`\n📊 Accuracy: ${result.accuracy}%`);
console.log(`💬 ${result.message}`);
console.log(`   Timing: ${result.timingAccuracy}%`);
console.log(`   Consistency: ${result.consistencyScore}%`);
console.log(`   Tempo: ${result.tempoAccuracy}%`);

kbd.dispose();
```

</details>

---

## 🚨 Troubleshooting

<details>
<summary>Errores de User Manager</summary>

### Comando retorna NaN o Promise

**Problema:** Olvidaste usar `await` en una función async.

```javascript
// ❌ Incorrecto
window.__USER_MANAGER.fetchUserStats()  // Retorna: Promise o NaN

// ✅ Correcto
await window.__USER_MANAGER.fetchUserStats()  // Retorna: {user_id: 1, ...}
```

### Error: "User not found"

**Problema:** El usuario no existe en la base de datos.

```javascript
// Solo existen user_id 1 y 2
window.__USER_MANAGER.switchUser(1)  // ✅
window.__USER_MANAGER.switchUser(2)  // ✅
window.__USER_MANAGER.switchUser(3)  // ❌ Error
```

</details>

<details>
<summary>Errores de Migration</summary>

### Error: "Failed to fetch"

**Problema:** El servidor API no está corriendo.

```bash
# Verificar
await window.__MIGRATION.isServerAvailable()  // false

# Iniciar servidor
# En VSCode: F1 → Tasks: Run Task → Start API Server
# O en terminal: npm run server
```

</details>

<details>
<summary>Errores de Audio Capture</summary>

### Error: "Cannot use import statement outside a module"

**Problema:** Usaste `import` estático en consola.

```javascript
// ❌ NO funciona en consola
import { checkSupport } from '../../libs/audio-capture/index.js';

// ✅ Usa import dinámico
const { checkSupport } = await import('../../libs/audio-capture/index.js');
```

### Error: "Micrófono no disponible"

**Problema:** Permisos de micrófono no otorgados.

```javascript
// 1. Verificar soporte
const { MicrophoneCapture } = await import('../../libs/audio-capture/index.js');
console.log('Soportado:', MicrophoneCapture.isSupported());

// 2. Solicitar permisos
await MicrophoneCapture.requestPermissions();

// 3. Intentar de nuevo
const mic = createMicrophoneCapture();
await mic.initialize();
```

### KeyboardCapture no funciona con audio

**Problema:** El reproductor de audio captura el evento primero.

**Solución:** Ya está resuelto con `useCapture: true` (default), o usa tecla alternativa:

```javascript
// Opción 1: Verificar useCapture está activo
const kbd = createKeyboardCapture({ useCapture: true });  // Ya es default

// Opción 2: Usar tecla alternativa
const kbd = createKeyboardCapture({ key: 'Enter' });
```

### Feedback visual no aparece

**Soluciones:**
1. Verifica que pasaste `{ visualFeedback: true }`
2. Revisa si hay elementos con `z-index` muy alto que lo tapen
3. Verifica que el DOM esté cargado

### No detecta beats del micrófono

**Soluciones:**
1. Baja el threshold: `{ threshold: -35 }` o `-40`
2. Haz ruidos más fuertes (palmadas, golpes)
3. Verifica el nivel con Test 8 para calibrar

</details>

---

## 📝 Notas

- **Comandos síncronos:** Ejecutar directamente (no necesitan `await`)
- **Comandos asíncronos:** SIEMPRE usar `await` antes del comando
- **API Server:** Debe estar corriendo en `http://localhost:3000`
- **Apps:** Deben servirse vía Live Server en `http://localhost:8080`
- **Audio Capture:** Usa `await import()` en consola (no `import` estático)
- **Permisos:** Tests de micrófono requieren permisos del navegador

---

**💡 Tip:** Puedes copiar y pegar directamente estos comandos en la consola del navegador.

**📚 Documentación completa:**
- [DEVELOPMENT.md](DEVELOPMENT.md) - Guía de desarrollo
- [GAMIFICATION_PLAN.md](GAMIFICATION_PLAN.md) - Plan completo de gamificación
- [GAMIFICATION_USAGE_EXAMPLE.md](GAMIFICATION_USAGE_EXAMPLE.md) - Ejemplos detallados de gamificación
