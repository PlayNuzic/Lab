# Phase 2a - Quick Start Guide

## ✅ Fase 2a Completada

Backend con SQLite y API REST implementado completamente.

## 🚀 Iniciar el Servidor

### 1. Instalar dependencias (primera vez)

```bash
cd /Users/workingburcet/Lab/server
npm install
```

### 2. Iniciar servidor

```bash
npm start
```

O en modo desarrollo (con auto-reload):

```bash
npm run dev
```

El servidor se iniciará en **http://localhost:3000**

## ✅ Verificar Funcionamiento

### Desde el navegador

Abre: http://localhost:3000

Deberías ver:
```json
{
  "message": "Gamification API Server",
  "version": "2.0.0",
  "endpoints": { ... }
}
```

### Desde la terminal

```bash
# Health check
curl http://localhost:3000/api/health

# Listar usuarios
curl http://localhost:3000/api/users

# Ver stats del usuario 1
curl http://localhost:3000/api/users/1

# Listar ejercicios
curl http://localhost:3000/api/exercises
```

## 🎮 Usar desde las Apps

### 1. Inicia el servidor (ver arriba)

### 2. Abre cualquier App (2, 3, 4, o 5)

Por ejemplo: `http://localhost:8080/apps/app2/`

### 3. Abre la consola del navegador (F12)

Deberías ver mensajes como:
```
👤 User Manager inicializado
🔄 Migration Module cargado
```

### 4. Cambiar de usuario (desde consola)

```javascript
// Cambiar a "tester" (user_id: 1)
window.__USER_MANAGER.switchUser(1)

// Cambiar a "user" (user_id: 2)
window.__USER_MANAGER.switchUser(2)

// Ver usuario actual
window.__USER_MANAGER.getCurrentUserId()
```

### 5. Ver estadísticas

```javascript
// Stats del usuario actual
const stats = await window.__USER_MANAGER.fetchUserStats()
console.log(stats)

// Intentos recientes
const attempts = await window.__USER_MANAGER.fetchUserAttempts(10)
console.log(attempts)
```

### 6. Migración de datos

Si tienes datos en localStorage (de la Fase 1), se migrarán automáticamente al servidor 2 segundos después de cargar la página.

Para forzar migración manual:

```javascript
// Migrar manualmente
const result = await window.__MIGRATION.migrate()
console.log(result)

// Ver información de migración
window.__MIGRATION.info()

// Verificar servidor
const available = await window.__MIGRATION.isServerAvailable()
console.log('Servidor disponible:', available)
```

## 📊 Base de Datos

La base de datos SQLite se crea automáticamente en:
```
/Users/workingburcet/Lab/server/db/gamification.db
```

### Usuarios pre-cargados

| user_id | username | display_name |
|---------|----------|--------------|
| 1 | tester | Usuario de Prueba |
| 2 | user | Usuario Normal |

### Ejercicios de ejemplo

5 ejercicios pre-cargados para testing:
1. Patrón Par-Impar Básico (difficulty: 1)
2. Patrón Par-Impar Intermedio (difficulty: 2)
3. Sincronización Rítmica Básica (difficulty: 1)
4. Tap Tempo 120 BPM (difficulty: 2)
5. Reconoce 3/4 (difficulty: 2)

## 🔧 Troubleshooting

### Puerto 3000 ya en uso

```bash
# Encontrar proceso
lsof -i :3000

# Matar proceso
kill -9 <PID>
```

### Error de CORS

Verifica que el servidor esté corriendo y que estés accediendo a las apps vía HTTP server (no `file://`).

```bash
# Iniciar http-server (desde el directorio Lab)
npx http-server -p 8080
```

Luego abre: http://localhost:8080/apps/app2/

### Base de datos bloqueada

Reinicia el servidor. SQLite solo permite un escritor a la vez.

### Migración no funciona

1. Verifica que el servidor esté corriendo
2. Abre la consola y ejecuta:
   ```javascript
   await window.__MIGRATION.isServerAvailable()
   ```
3. Si devuelve `false`, verifica la URL del servidor en `migration.js` (debe ser `http://localhost:3000`)

## 📝 Endpoints Disponibles

### Users
- `GET /api/users` - Lista de usuarios
- `GET /api/users/:id` - Usuario con stats
- `GET /api/users/:id/attempts` - Intentos del usuario

### Exercises
- `GET /api/exercises` - Lista de ejercicios
- `GET /api/exercises/:id` - Ejercicio específico
- `POST /api/exercises/:id/start` - Iniciar intento
- `POST /api/exercises/:id/complete` - Completar intento

### Sessions
- `POST /api/sessions/start` - Iniciar sesión
- `POST /api/sessions/:id/end` - Finalizar sesión
- `GET /api/sessions?user_id=1` - Sesiones del usuario

### Events
- `POST /api/events/sync` - Sincronizar desde localStorage
- `GET /api/events/history?user_id=1` - Historial de eventos

Ver ejemplos detallados en `/server/README.md`

## 📚 Documentación Completa

- **GAMIFICATION_PLAN.md** - Plan completo de las 4 fases
- **GAMIFICATION_PROGRESS.md** - Estado actual del desarrollo
- **GAMIFICATION_USAGE_EXAMPLE.md** - Ejemplos de uso
- **server/README.md** - Documentación del servidor API

## ✅ Próximos Pasos

**Fase 2a:** ✅ COMPLETADA
**Fase 2b:** Sistema de captura de audio (mic + teclado)
**Fase 2c:** Implementación de ejercicios
**Fase 2d:** UI de ejercicios

---

**Fecha:** 2025-10-13
**Versión:** 2.0.0
