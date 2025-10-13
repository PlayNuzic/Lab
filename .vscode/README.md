# VSCode Configuration

Esta carpeta contiene la configuración de VSCode para el proyecto Lab.

## 🚀 Auto-inicio del Servidor API

Cuando abras el proyecto en VSCode, verás una notificación:

```
There is a task 'Start API Server' running in the background.
Would you like to see it?
```

**Opciones:**
- ✅ **Allow** → El servidor se iniciará automáticamente
- ❌ **Dismiss** → Tendrás que iniciarlo manualmente

## 📋 Tareas Disponibles

Presiona `F1` o `Cmd+Shift+P` y escribe `Tasks: Run Task`:

| Tarea | Descripción |
|-------|-------------|
| `Start API Server` | Inicia el servidor API (auto-run) |
| `Start API Server (Dev)` | Inicia con nodemon (auto-reload) |
| `Stop API Server` | Detiene el servidor |
| `Install Server Dependencies` | Instala dependencias |
| `Check Server Status` | Verifica si está corriendo |

## ⚙️ Configuración de Live Server

**Puerto:** 8080 (configurado en `settings.json`)

**Para iniciar Live Server:**
1. Click derecho en cualquier HTML
2. Selecciona "Open with Live Server"
3. O usa el botón "Go Live" en la barra de estado

## 🔌 Extensiones Recomendadas

VSCode te sugerirá instalar estas extensiones automáticamente:

- **Live Server** - Para servir las aplicaciones
- **REST Client** - Para testing de la API
- **ESLint** - Linting de JavaScript
- **Prettier** - Formateo de código

## 🧪 Testing de API

Abre `server/api-tests.http` y usa REST Client:

1. Click en "Send Request" sobre cualquier endpoint
2. La respuesta aparecerá en un panel a la derecha
3. Formato JSON automático

## 🛠️ Personalización

### Deshabilitar auto-inicio del servidor

Edita `.vscode/tasks.json` y elimina esta sección de la tarea "Start API Server":

```json
"runOptions": {
  "runOn": "folderOpen"
}
```

### Cambiar puerto de Live Server

Edita `.vscode/settings.json`:

```json
"liveServer.settings.port": 5500
```

### Añadir más tareas

Edita `.vscode/tasks.json` y añade nuevas tareas siguiendo el formato existente.

## 📚 Más Información

- **[DEVELOPMENT.md](../DEVELOPMENT.md)** - Guía completa de desarrollo
- **[PHASE_2A_QUICKSTART.md](../PHASE_2A_QUICKSTART.md)** - Quick start Fase 2a
- **[server/README.md](../server/README.md)** - Documentación del API

---

**Tip:** Si el servidor no se inicia automáticamente, ejecuta manualmente:
```bash
npm run server
```
