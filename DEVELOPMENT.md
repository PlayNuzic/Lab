# Development Guide

Guía para desarrolladores que trabajan en el proyecto Lab.

## 🚀 Quick Start

### Primera Vez (Setup Inicial)

```bash
# 1. Instalar dependencias del proyecto principal
npm install

# 2. Instalar dependencias del servidor API
npm run server:install
# o manualmente:
cd server && npm install
```

### Iniciar Desarrollo

Tienes varias opciones:

#### Opción A: Auto-inicio con VSCode (RECOMENDADO)

1. **Abre el proyecto en VSCode**
2. VSCode te preguntará si quieres ejecutar la tarea "Start API Server"
3. **Acepta** → El servidor API se iniciará automáticamente
4. **Usa Live Server** para las apps (botón "Go Live" o `Cmd+L Cmd+O`)

#### Opción B: Inicio Manual

```bash
# Terminal 1 - Iniciar servidor API
npm run server

# Terminal 2 - Usar Live Server desde VSCode
# o usar http-server:
npx http-server -p 8080
```

#### Opción C: Tareas de VSCode

1. Presiona `F1` o `Cmd+Shift+P`
2. Escribe `Tasks: Run Task`
3. Selecciona `Start API Server`

## 📊 URLs de Desarrollo

| Servicio | URL | Puerto |
|----------|-----|--------|
| **Apps (Live Server)** | http://localhost:8080 | 8080 |
| **API Server** | http://localhost:3000 | 3000 |
| **API Health Check** | http://localhost:3000/api/health | 3000 |

## 🎮 Verificar que Todo Funciona

### 1. Verificar API Server

**Desde el navegador:**
- Abre: http://localhost:3000
- Deberías ver JSON con info del servidor

**Desde la terminal:**
```bash
curl http://localhost:3000/api/health
```

**Desde VSCode:**
- Presiona `F1` → `Tasks: Run Task` → `Check Server Status`

### 2. Verificar Apps

**Abre cualquier app:**
- http://localhost:8080/apps/app2/
- http://localhost:8080/apps/app3/
- http://localhost:8080/apps/app4/
- http://localhost:8080/apps/app5/

**Abre la consola (F12):**
```javascript
// Verificar usuario actual
window.__USER_MANAGER.getCurrentUserId()

// Cambiar usuario
window.__USER_MANAGER.switchUser(2)

// Ver stats (requiere servidor API)
await window.__USER_MANAGER.fetchUserStats()

// Verificar servidor disponible
await window.__MIGRATION.isServerAvailable()
```

## 🛠️ Tareas de VSCode Disponibles

Presiona `F1` → `Tasks: Run Task` y selecciona:

| Tarea | Descripción |
|-------|-------------|
| **Start API Server** | Inicia servidor en modo producción (auto-run al abrir) |
| **Start API Server (Dev)** | Inicia con nodemon (auto-reload) |
| **Stop API Server** | Detiene el servidor |
| **Install Server Dependencies** | Instala deps del servidor |
| **Check Server Status** | Verifica si el servidor está corriendo |

## 📦 Scripts NPM Disponibles

```bash
# Tests
npm test

# Servidor API
npm run server              # Iniciar servidor (producción)
npm run server:dev          # Iniciar con auto-reload (desarrollo)
npm run server:install      # Instalar dependencias del servidor
```

## 🔧 Configuración

### Live Server

**Puerto:** 8080 (configurado en `.vscode/settings.json`)

**Ignorar archivos:**
- `server/**` (para no servir archivos del backend)
- `node_modules/**`

### API Server

**Puerto:** 3000 (configurado en `server/index.js`)

**Base de datos:** `server/db/gamification.db` (SQLite, creada automáticamente)

## 🎯 Workflow Típico

1. **Abrir VSCode** → Servidor API se inicia automáticamente
2. **Hacer cambios en código** de las apps
3. **Live Server recarga** automáticamente el navegador
4. **Si cambias backend:**
   - Usa `Start API Server (Dev)` para auto-reload
   - O reinicia manualmente el servidor

## 📝 Estructura del Proyecto

```
Lab/
├── apps/           # Aplicaciones (app2, app3, app4, app5)
├── libs/           # Librerías compartidas
│   ├── gamification/   # Sistema de gamificación
│   ├── sound/          # Audio (Tone.js)
│   └── notation/       # VexFlow
├── server/         # Backend API (Fase 2a)
│   ├── api/           # Rutas REST
│   ├── db/            # Base de datos SQLite
│   └── package.json
├── shared/         # Utilidades compartidas
└── .vscode/        # Configuración de VSCode
```

## 🐛 Troubleshooting

### El servidor no inicia automáticamente

1. Verifica que instalaste las dependencias:
   ```bash
   cd server && npm install
   ```

2. Ejecuta manualmente:
   ```bash
   npm run server
   ```

3. Revisa la configuración en `.vscode/tasks.json`

### Puerto 3000 ya en uso

```bash
# Matar proceso en puerto 3000
lsof -ti :3000 | xargs kill -9

# O usar la tarea de VSCode
F1 → Tasks: Run Task → Stop API Server
```

### Live Server no carga las apps

1. Verifica que Live Server esté en puerto 8080
2. Abre: http://localhost:8080/apps/app2/ (con la ruta completa)
3. No uses `file://` URLs

### Errores de CORS

Asegúrate de:
1. Servidor API está corriendo (puerto 3000)
2. Apps se sirven vía HTTP (puerto 8080), no file://
3. CORS está habilitado en `server/index.js`

### Base de datos bloqueada

```bash
# Reiniciar servidor API
F1 → Tasks: Run Task → Stop API Server
F1 → Tasks: Run Task → Start API Server
```

## 🔒 Sistema de Usuarios (Sin Autenticación)

### Usuarios Disponibles

| user_id | username | display_name |
|---------|----------|--------------|
| 1 | tester | Usuario de Prueba |
| 2 | user | Usuario Normal |

### Cambiar de Usuario (Consola del Navegador)

```javascript
// Cambiar a tester
window.__USER_MANAGER.switchUser(1)

// Cambiar a user
window.__USER_MANAGER.switchUser(2)

// Ver usuario actual
window.__USER_MANAGER.getCurrentUserId()
```

## 📚 Documentación Adicional

- **[GAMIFICATION_PLAN.md](GAMIFICATION_PLAN.md)** - Plan completo del sistema
- **[GAMIFICATION_PROGRESS.md](GAMIFICATION_PROGRESS.md)** - Estado del desarrollo
- **[GAMIFICATION_USAGE_EXAMPLE.md](GAMIFICATION_USAGE_EXAMPLE.md)** - Ejemplos de uso
- **[PHASE_2A_QUICKSTART.md](PHASE_2A_QUICKSTART.md)** - Guía rápida Fase 2a
- **[server/README.md](server/README.md)** - Documentación del API

## ✅ Extensiones de VSCode Recomendadas

El proyecto recomienda estas extensiones (VSCode las sugerirá automáticamente):

- **Live Server** - Servidor local para desarrollo
- **REST Client** - Testing de API
- **ESLint** - Linting de JavaScript
- **Prettier** - Formateo de código

## 🎨 Convenciones de Código

- **Indentación:** 2 espacios
- **ES Modules:** Usar `import/export` (no `require`)
- **Async/Await:** Preferir sobre `.then()`
- **Nombres:** camelCase para variables, PascalCase para clases

## 🚀 Próximas Fases

- ✅ **Fase 1:** Sistema de gamificación base (completada)
- ✅ **Fase 2a:** Backend y base de datos (completada)
- ⏳ **Fase 2b:** Sistema de captura de audio
- ⏳ **Fase 2c:** Implementación de ejercicios
- ⏳ **Fase 2d:** UI de ejercicios

---

**Última actualización:** 2025-10-13
**Versión:** 2.0.0
