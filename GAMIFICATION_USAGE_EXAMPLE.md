# Guía de Uso del Sistema de Gamificación

## Cómo Empezar

El sistema de gamificación ya está integrado y funcionando en las Apps 2-5. No requiere configuración adicional por parte del usuario.

## Verificar que está Funcionando

### 1. Abrir la Consola del Navegador
- Chrome/Edge: `F12` o `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
- Firefox: `F12` o `Ctrl+Shift+K` (Windows) / `Cmd+Option+K` (Mac)

### 2. Activar Modo Debug
En la consola, ejecuta:
```javascript
// Activar modo debug
window.GAMIFICATION_DEBUG = true;
```

O añade a la URL: `?gamification_debug=true`

### 3. Ver Mensajes de Inicialización
Al cargar cualquier App (2-5), deberías ver:
```
Inicializando gamificación para App2...
Gamificación de App2 inicializada correctamente
```

## Comandos Útiles en la Consola

### Ver Estadísticas Actuales
```javascript
// Ver todas las estadísticas
window.__GAMIFICATION.getStats();

// Resultado ejemplo:
{
  session: {
    total_events: 45,
    total_points: 320,
    duration_seconds: 180
  },
  scoring: {
    session_score: 320,
    total_score: 1250,
    current_streak: 5,
    complexity_level: "MEDIUM"
  },
  achievements: {
    total_achievements: 20,
    unlocked_achievements: 3,
    completion_percentage: 15
  }
}
```

### Ver Nivel del Usuario
```javascript
window.__GAMIFICATION.getUserLevel();

// Resultado:
{
  level: 3,
  title: "Estudiante",
  current_score: 1250,
  next_level_score: 1500,
  progress_percentage: 50
}
```

### Ver Logros
```javascript
// Ver todos los logros
window.__GAMIFICATION.getAchievements();

// Ver solo logros desbloqueados
window.__GAMIFICATION.getAchievements()
  .filter(a => a.unlocked);

// Ver progreso de un logro específico
window.__GAMIFICATION.getAchievementProgress('rhythm_novice');
```

### Ver Datos Específicos por App

#### App2 - Sucesión de Pulsos
```javascript
// Estadísticas específicas
window.__APP2_GAMIFICATION.getStats();

// Ver parámetros actuales
window.__APP2_GAMIFICATION.lastLgValue;  // Último valor de Lg
window.__APP2_GAMIFICATION.lastVValue;   // Último valor de V
```

#### App3 - Fracciones Temporales
```javascript
// Ver fracciones creadas
window.__APP3_GAMIFICATION.fractionsCreated;

// Última fracción usada
window.__APP3_GAMIFICATION.lastFraction;
```

#### App4 - Pulsos Fraccionados
```javascript
// Ver patrones creados
window.__APP4_GAMIFICATION.patternsCreated;

// Estado de características avanzadas
window.__APP4_GAMIFICATION.cycleActivated;
window.__APP4_GAMIFICATION.subdivisionActivated;
```

#### App5 - Pulsaciones
```javascript
// Ver intervalos creados
window.__APP5_GAMIFICATION.intervalsCreated;

// Complejidad actual
window.__APP5_GAMIFICATION.patternComplexity;
```

## Flujo de Uso Típico

### 1. Práctica Básica (App2)
1. Abre App2
2. Configura Lg=8, V=120
3. Selecciona algunos pulsos
4. Haz clic en Play
5. Deja que complete el patrón
6. Para la reproducción

**Eventos generados:**
- `PRACTICE_STARTED` - 5 puntos
- `PULSE_PATTERN_CREATED` - 8 puntos
- `PRACTICE_COMPLETED` - 20 puntos
- **Total:** 33 puntos

### 2. Crear Fracciones (App3)
1. Abre App3
2. Configura una fracción (ej: 3/4)
3. Reproduce el patrón
4. Experimenta con diferentes fracciones

**Eventos generados:**
- `FRACTION_CREATED` - 5 puntos por fracción única
- `PATTERN_PLAYED` - 3 puntos
- Bonus por complejidad si la fracción es compleja

### 3. Usar Tap Tempo con Precisión
1. En cualquier app, haz clic en Tap Tempo
2. Toca un ritmo constante (mínimo 3 clicks)
3. Si tu precisión es > 85%, obtienes bonus

**Eventos:**
- `TAP_TEMPO_USED` - 2 puntos
- `TAP_TEMPO_ACCURATE` - 10 puntos (si precisión > 85%)

## Logros para Desbloquear

### Fáciles (Primeros pasos)
- **Primeros Pasos**: Completa tu primera práctica
- **Explorador**: Cambia 10 parámetros diferentes
- **Dedicado**: Practica 5 minutos continuos

### Intermedios
- **Novato Rítmico**: Reproduce 10 patrones
- **Creador de Patrones**: Crea 20 patrones diferentes
- **Maestro del Tap**: 10 tap tempos precisos

### Avanzados
- **Maestro del Ritmo**: 200 patrones reproducidos
- **Timing Perfecto**: 100% precisión en 5 patrones seguidos
- **Maratonista**: 30 minutos de práctica continua

### Expertos
- **Práctica Diaria**: 7 días consecutivos
- **Gran Maestro**: Alcanza 10,000 puntos totales

## Troubleshooting

### El sistema no está registrando eventos
1. Verifica que el sistema esté habilitado:
```javascript
window.__GAMIFICATION.getConfig().enabled; // Debe ser true
```

2. Verifica la configuración de la app:
```javascript
window.__GAMIFICATION.getConfig().apps.app2.enabled; // Debe ser true
```

### Resetear el Sistema (Testing)
```javascript
// Resetear todo (¡CUIDADO! Borra todos los datos)
window.__GAMIFICATION.resetAll();

// Resetear solo la sesión actual
window.__GAMIFICATION.resetSession();
```

### Exportar/Importar Datos
```javascript
// Exportar todos tus datos
const backup = window.__GAMIFICATION.exportUserData();
console.log(JSON.stringify(backup));

// Importar datos
window.__GAMIFICATION.importUserData(backup);
```

## Configuración Avanzada

### Cambiar Multiplicador de Puntos
```javascript
// Duplicar todos los puntos (para testing)
window.__GAMIFICATION_CONFIG.updateConfig({
  scoring: { pointsMultiplier: 2.0 }
});
```

### Desactivar Temporalmente
```javascript
// Desactivar gamificación
window.__GAMIFICATION_CONFIG.updateConfig({
  enabled: false
});

// Reactivar
window.__GAMIFICATION_CONFIG.updateConfig({
  enabled: true
});
```

## Métricas de Rendimiento

El sistema está diseñado para ser ligero:
- **Overhead por evento:** < 5ms
- **Memoria utilizada:** < 1MB
- **Almacenamiento local:** < 5MB máximo

## Uso de Ejercicios (Fase 2 - Próximamente)

En la Fase 2 se añadirá un sistema de ejercicios con captura de audio. A continuación se muestran ejemplos de uso:

### Cambiar de Usuario (Consola)

```javascript
// Sistema simple de 2 usuarios (sin autenticación)

// Cambiar a usuario 'tester' (user_id: 1)
window.__USER_MANAGER.switchUser(1);

// Cambiar a usuario 'user' (user_id: 2)
window.__USER_MANAGER.switchUser(2);

// Ver usuario actual
const currentUserId = window.__USER_MANAGER.getCurrentUserId();
console.log(`Usuario actual: ${currentUserId}`);
```

### Lanzar Ejercicios

```javascript
// Cargar ejercicios disponibles
const exercises = await window.__EXERCISE_LAUNCHER.loadExercises();
console.log(`${exercises.length} ejercicios disponibles`);

// Filtrar por tipo
const sequenceExercises = exercises.filter(e => e.exercise_type === 'sequence_entry');
const rhythmExercises = exercises.filter(e => e.exercise_type === 'rhythm_sync');

// Lanzar un ejercicio específico
await window.__EXERCISE_LAUNCHER.startExercise(
  exerciseId: 1,
  exerciseType: 'sequence_entry',
  config: {
    pattern: [0, 1, 0, 1, 0, 1, 0, 1], // par-impar
    length: 8,
    difficulty: 2
  }
);
```

### Ejemplo 1: Ejercicio de Entrada de Secuencia

```javascript
// El usuario ve una UI para ingresar un patrón par-impar
// Puede hacer clic en botones para alternar entre Par (0) e Impar (1)

// Cuando el usuario envía su respuesta:
// - Se calcula la precisión comparando con el patrón objetivo
// - Se guarda el resultado en la base de datos
// - Se muestra feedback inmediato

// Resultado esperado:
{
  score: 80, // (100% precisión × dificultad 2) × 0.4
  accuracy: 87.5, // 7 de 8 correctos
  attempt_data: {
    target_pattern: [0, 1, 0, 1, 0, 1, 0, 1],
    user_pattern: [0, 1, 0, 0, 0, 1, 0, 1],
    correct_count: 7
  }
}
```

### Ejemplo 2: Ejercicio de Sincronización Rítmica

```javascript
// Este ejercicio usa TANTO micrófono COMO teclado (Space)

// Configuración del ejercicio
const rhythmConfig = {
  rhythm: [0, 0.5, 1.0, 1.5], // Timestamps en segundos
  input_mode: 'both', // 'mic', 'keyboard', o 'both'
  difficulty: 3
};

// El usuario:
// 1. Escucha el patrón objetivo
// 2. Graba su intento usando micrófono O tecla Espacio
// 3. El sistema detecta beats/taps automáticamente
// 4. Se compara con el patrón objetivo

// Resultado esperado:
{
  matched: true,
  accuracy: 92,
  deviations: [0.02, 0.01, 0.03, 0.015], // En segundos
  avgDeviation: 0.019 // 19ms promedio
}
```

### Ejemplo 3: Ejercicio de Tap Matching

```javascript
// Ejercicio independiente de precisión de tempo

const tapConfig = {
  bpm: 120,
  tap_count: 8,
  difficulty: 2
};

// El usuario toca un botón TAP repetidamente
// El sistema calcula el BPM en tiempo real
// Al completar los 8 taps, evalúa la precisión

// Resultado esperado:
{
  target_bpm: 120,
  achieved_bpm: 118,
  consistency: 95, // Qué tan constantes fueron los intervalos
  accuracy: 98.3 // Cercanía al objetivo
}
```

### Ejemplo 4: Ejercicio de Reconocimiento de Fracciones

```javascript
// Ejercicio independiente de oído

const fractionConfig = {
  fraction: { n: 3, d: 4 },
  options: [
    { n: 3, d: 4 }, // Correcta
    { n: 2, d: 4 },
    { n: 4, d: 4 },
    { n: 3, d: 8 }
  ],
  difficulty: 3
};

// El usuario:
// 1. Escucha una fracción temporal
// 2. Selecciona entre 4 opciones
// 3. Recibe feedback inmediato

// Resultado esperado (correcto):
{
  score: 30, // 10 × dificultad 3
  accuracy: 100,
  correct: true
}

// Resultado esperado (incorrecto):
{
  score: 0,
  accuracy: 0,
  correct: false
}
```

### Ver Resultados de Ejercicios

```javascript
// Obtener historial de intentos del usuario actual
const userId = window.__USER_MANAGER.getCurrentUserId();

const response = await fetch(`/api/users/${userId}/attempts?limit=10`);
const attempts = await response.json();

attempts.forEach(attempt => {
  console.log(`${attempt.exercise_title}:`);
  console.log(`  Precisión: ${attempt.accuracy_percentage}%`);
  console.log(`  Puntuación: ${attempt.score}`);
  console.log(`  Fecha: ${new Date(attempt.completed_at).toLocaleDateString()}`);
});
```

### Migración Automática de Datos

```javascript
// Al detectar que el servidor está disponible,
// los datos de localStorage se migran automáticamente

// Para forzar la migración manualmente:
import { migrateLocalDataToDatabase } from '/libs/gamification/migration.js';

const result = await migrateLocalDataToDatabase();
console.log(`✅ ${result.synced_count} eventos migrados`);
console.log(`❌ ${result.failed_count} eventos fallidos`);
```

### API Endpoints Disponibles

```javascript
// === USUARIOS ===
// Listar usuarios
GET /api/users
// Respuesta: [{ user_id: 1, username: "tester", total_score: 1250 }]

// Usuario específico
GET /api/users/1
// Respuesta: { user_id: 1, username: "tester", stats: {...} }

// === EJERCICIOS ===
// Listar ejercicios
GET /api/exercises?type=rhythm_sync&difficulty=2
// Respuesta: [{ exercise_id, type, title, parameters }]

// Iniciar ejercicio
POST /api/exercises/1/start
// Body: { user_id: 1 }
// Respuesta: { attempt_id: 42, exercise_data: {...} }

// Completar ejercicio
POST /api/exercises/1/complete
// Body: { attempt_id: 42, score: 85, accuracy: 92.5, attempt_data: {...} }
// Respuesta: { saved: true, new_score: 1335, achievements_unlocked: [] }

// === EVENTOS ===
// Sincronizar eventos desde localStorage
POST /api/events/sync
// Body: { user_id: 1, events: [...] }
// Respuesta: { synced_count: 47, failed_count: 0 }

// Historial de eventos
GET /api/events/history?user_id=1&app_id=app2&limit=50
// Respuesta: [{ event_id, event_type, timestamp, metadata }]
```

### Workflow Completo de Sesión con Ejercicios

```javascript
// 1. Iniciar como usuario de prueba
window.__USER_MANAGER.switchUser(1); // tester

// 2. Ver ejercicios disponibles
const exercises = await window.__EXERCISE_LAUNCHER.loadExercises();
console.log(`Ejercicios disponibles: ${exercises.length}`);

// 3. Hacer un ejercicio de entrada de secuencia
await window.__EXERCISE_LAUNCHER.startExercise(1, 'sequence_entry', {
  pattern: [0,1,0,1,0,1,0,1],
  length: 8,
  difficulty: 1
});
// El usuario completa el ejercicio en la UI...
// Resultado guardado automáticamente en BD

// 4. Hacer un ejercicio de sincronización rítmica
await window.__EXERCISE_LAUNCHER.startExercise(2, 'rhythm_sync', {
  rhythm: [0, 0.5, 1.0, 1.5, 2.0],
  input_mode: 'both', // mic + keyboard
  difficulty: 2
});
// El usuario graba su ritmo con micrófono o Space...
// Análisis y guardado automático

// 5. Ver progreso
const userId = window.__USER_MANAGER.getCurrentUserId();
const userStats = await fetch(`/api/users/${userId}`).then(r => r.json());
console.log(`Puntuación total: ${userStats.total_score}`);
console.log(`Nivel actual: ${userStats.current_level}`);
console.log(`Ejercicios completados: ${userStats.exercises_completed}`);

// 6. Cambiar a otro usuario y comparar
window.__USER_MANAGER.switchUser(2); // user
const user2Stats = await fetch(`/api/users/2`).then(r => r.json());
console.log(`Usuario 2 puntuación: ${user2Stats.total_score}`);
```

---

## Próximas Características

### Fase 2 (En desarrollo)
- ✅ Sistema de ejercicios con captura de audio
- ✅ Base de datos SQLite y API REST
- ✅ Usuario simple de 2 personas (sin autenticación)
- ✅ Migración automática de localStorage

### Fase 3 (Futuro)
- Dashboard visual con gráficas de progreso
- Notificaciones visuales de logros
- Visualización de estadísticas detalladas

### Fase 4 (Futuro lejano)
- Sistema de autenticación completo
- Tabla de clasificación global
- Compartir logros en redes sociales
- Desafíos diarios y semanales
- Modo competitivo
- Recompensas y contenido desbloqueable

---

## Ejemplo Completo de Sesión (Fase 1)

```javascript
// 1. Iniciar con debug
window.GAMIFICATION_DEBUG = true;

// 2. Practicar en App2
// - Configurar Lg=16, V=120
// - Seleccionar pulsos alternos
// - Reproducir durante 1 minuto

// 3. Ver estadísticas
const stats = window.__GAMIFICATION.getStats();
console.log(`Puntos ganados: ${stats.scoring.session_score}`);
console.log(`Racha actual: ${stats.scoring.current_streak}`);

// 4. Verificar logros desbloqueados
const newAchievements = window.__GAMIFICATION.getAchievements()
  .filter(a => a.unlocked && !a.notified);

newAchievements.forEach(achievement => {
  console.log(`🏆 ¡Logro desbloqueado! ${achievement.name}`);
  console.log(`   ${achievement.description}`);
});

// 5. Ver nivel actual
const level = window.__GAMIFICATION.getUserLevel();
console.log(`Nivel ${level.level}: ${level.title}`);
console.log(`Progreso al siguiente nivel: ${level.progress_percentage}%`);
```

## Contacto y Soporte

Si encuentras algún problema o tienes sugerencias:
1. Abre la consola del navegador
2. Ejecuta el comando problemático
3. Copia cualquier error que aparezca
4. Reporta el issue con los detalles

¡Disfruta del sistema de gamificación y mejora tus habilidades rítmicas! 🎵🏆