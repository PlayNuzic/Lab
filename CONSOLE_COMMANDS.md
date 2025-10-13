# Comandos de Consola - Referencia Rápida

Guía rápida de comandos disponibles en la consola del navegador (F12).

## 👤 User Manager

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

## 🔄 Migration

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

## 🎮 Gamification Manager (Fase 1)

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

## 🧪 Testing de API (desde consola)

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

## 📊 Ejemplos de Flujos Completos

### Flujo 1: Cambiar Usuario y Ver Stats

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

### Flujo 2: Migrar Datos a BD

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

### Flujo 3: Ver Progreso de Gamificación

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

## 🚨 Troubleshooting

### Comando retorna NaN o Promise

**Problema:** Olvidaste usar `await` en una función async.

```javascript
// ❌ Incorrecto
window.__USER_MANAGER.fetchUserStats()  // Retorna: Promise o NaN

// ✅ Correcto
await window.__USER_MANAGER.fetchUserStats()  // Retorna: {user_id: 1, ...}
```

### Error: "Failed to fetch"

**Problema:** El servidor API no está corriendo.

**Solución:**
```bash
# Verificar
await window.__MIGRATION.isServerAvailable()  // false

# Iniciar servidor
# En VSCode: F1 → Tasks: Run Task → Start API Server
# O en terminal: npm run server
```

### Error: "User not found"

**Problema:** El usuario no existe en la base de datos.

**Solución:**
```javascript
// Solo existen user_id 1 y 2
window.__USER_MANAGER.switchUser(1)  // ✅
window.__USER_MANAGER.switchUser(2)  // ✅
window.__USER_MANAGER.switchUser(3)  // ❌ Error
```

## 📝 Notas

- **Comandos síncronos:** Ejecutar directamente (no necesitan `await`)
- **Comandos asíncronos:** SIEMPRE usar `await` antes del comando
- **API Server:** Debe estar corriendo en `http://localhost:3000`
- **Apps:** Deben servirse vía Live Server en `http://localhost:8080`

---

**Tip:** Puedes copiar y pegar directamente estos comandos en la consola del navegador.

**Documentación completa:**
- [DEVELOPMENT.md](DEVELOPMENT.md) - Guía de desarrollo
- [PHASE_2A_QUICKSTART.md](PHASE_2A_QUICKSTART.md) - Quick start
- [GAMIFICATION_USAGE_EXAMPLE.md](GAMIFICATION_USAGE_EXAMPLE.md) - Ejemplos detallados
