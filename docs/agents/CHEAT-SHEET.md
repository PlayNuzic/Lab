# ⚡ Cheat Sheet: Agentes con Claude Code

> **Guía de referencia rápida para tener abierta mientras trabajas**

---

## 🚀 Inicio de Sesión (Copy-Paste)

```bash
# Terminal
cd Lab
code .

# Terminal integrado VSCode (Ctrl+`)
claude
```

```
# Primera interacción (copy-paste)
Hola! Lee el contexto de agentes: @.claude-code/agents-context.md

Confirma que entiendes los 6 agentes y las reglas de no modificación.
```

---

## 🎭 Los 6 Agentes

| Emoji | Agente | Usa Para |
|-------|--------|----------|
| 🎨 | **UI Agent** | Componentes visuales, diseño, accesibilidad |
| 🔊 | **Audio Agent** | Optimización de audio, sincronización, performance |
| 📱 | **Responsive Agent** | Adaptación móvil, media queries, touch |
| 📦 | **Modules Agent** | Detectar duplicados, refactoring, arquitectura |
| 🏗️ | **Creator Agent** | Crear nuevas apps, nuevos componentes |
| 🎮 | **Gamification Agent** | Sistema de logros, tracking, badges |

---

## 💬 Templates de Prompts

### 📊 Análisis General

```
🎨 UI Agent: Analiza @Apps/app1/ y dame:
1. Componentes UI que usa
2. Patrones de diseño
3. Sistema de colores
4. Oportunidades de mejora

Resumen en bullets, sin código todavía.
```

### 🔧 Crear Componente

```
🎨 UI Agent: Crea componente "NombreComponente" siguiendo estos pasos:

1. PRIMERO: Analiza componentes similares en @libs/app-common/
2. DESPUÉS: Muéstrame el código completo
3. Espera mi aprobación ✅
4. Crea el archivo + tests

Características:
- [descripción]
- [requisitos]
- API: [definir API]
```

### 🐛 Debugging

```
🔊 Audio Agent: Tengo un problema:

SÍNTOMAS:
- [describe el problema]

CONTEXTO:
- Archivos: @[archivo relevante]
- NO tocar: clock.js, pulse-interval-calc.js

TAREA:
1. Analiza la causa
2. Propón fix SIN modificar archivos críticos
3. Muestra código del fix
```

### 🏗️ Nueva App

```
🏗️ Creator Agent: Crea nueva app[N]-nombre

CONCEPTO:
- [descripción del concepto]

PROCESO:
1. Analiza estructura de apps existentes
2. Lista componentes a reutilizar
3. Crea PLAN detallado (no implementes)
4. Espera mi aprobación
5. Implementa paso a paso
```

### 🔄 Refactoring

```
📦 Modules Agent: Detecta código duplicado en:
- @[archivo1]
- @[archivo2]

1. Identifica qué está duplicado
2. Verifica si ya existe en libs/
3. Propón extracción a componente compartido
4. NO implementes todavía, solo análisis
```

---

## 🛡️ Reglas Críticas (Recordatorio)

```
REGLAS PARA CLAUDE CODE:

🚫 NUNCA MODIFICAR:
- libs/sound/clock.js
- libs/app-common/pulse-interval-calc.js
- libs/app-common/voice-sync.js

✅ SIEMPRE:
- Mostrarme código ANTES de crear
- Crear nuevos archivos en vez de modificar
- Escribir tests para componentes nuevos
- Ejecutar npm test después de cambios

Si vas a romper estas reglas, DETENTE y avísame.
```

---

## 🎯 Flujo de Trabajo Típico

```
┌─────────────────────────────────────┐
│ 1. Cargar contexto                  │
│    @.claude-code/agents-context.md  │
└────────────┬────────────────────────┘
             ↓
┌─────────────────────────────────────┐
│ 2. Análisis                         │
│    🎨 UI Agent: Analiza...          │
└────────────┬────────────────────────┘
             ↓
┌─────────────────────────────────────┐
│ 3. Diseño                           │
│    Muéstrame código propuesto       │
└────────────┬────────────────────────┘
             ↓
┌─────────────────────────────────────┐
│ 4. Revisión                         │
│    ✅ Aprobado / ❌ Cambiar [X]     │
└────────────┬────────────────────────┘
             ↓
┌─────────────────────────────────────┐
│ 5. Implementación                   │
│    Claude crea archivos             │
└────────────┬────────────────────────┘
             ↓
┌─────────────────────────────────────┐
│ 6. Verificación                     │
│    npm test                         │
│    cd agents && npm run verify      │
└─────────────────────────────────────┘
```

---

## ⌨️ Atajos de Teclado

### VSCode
- `Ctrl+`` (Cmd+`): Terminal integrado
- `Ctrl+Shift+P`: Command palette
- `Alt+Ctrl+K`: Insertar referencia de archivo

### Claude Code
- `Esc Esc`: Revertir último cambio
- `Ctrl+R`: Buscar en historial
- `/rewind`: Revertir a checkpoint
- `/model`: Cambiar modelo
- `/clear`: Nueva conversación
- `/config`: Ver configuración

---

## 📁 Referencias de Archivos

```
# Archivo específico
@Apps/app1/main.js

# Directorio completo
@Apps/app1/

# Rango de líneas
@Apps/app1/main.js#L50-L100

# Múltiples archivos
@Apps/app1/main.js @Apps/app2/main.js
```

---

## 🔍 Comandos de Verificación

```bash
# Ejecutar todos los tests
npm test

# Test específico
npm test -- [nombre]

# Verificar integridad del sistema
cd agents && npm run verify

# Análisis de agentes
cd agents && npm run analyze

# Ver estado de Git
git status

# Ver cambios
git diff
```

---

## 🎨 Patrones de Uso Comunes

### Crear + Testear Componente

```
🎨 UI Agent: Crea "scale-selector.js" en libs/app-common/

1. Analiza @libs/app-common/mixer-menu.js para el patrón
2. Muestra código completo del componente
3. Espera mi ✅
4. Crea archivo
5. Crea tests en __tests__/scale-selector.test.js
6. Ejecuta: npm test
```

### Debugging Paso a Paso

```
🔊 Audio Agent: Debug problema en @Apps/app4/visualizer.js

Proceso:
1. Lee el archivo y analiza
2. Identifica línea problemática
3. Explica causa raíz
4. Propón 2-3 soluciones posibles
5. Yo elijo una
6. Implementa la solución elegida
```

### Refactoring Colaborativo

```
Trabajo en equipo con múltiples agentes:

1. 📦 Modules Agent: Analiza duplicados en app2 y app3
2. 🎨 UI Agent: Diseña componente compartido
3. 🏗️ Creator Agent: Implementa y actualiza apps

Espero mi ✅ entre cada fase.
```

---

## 📊 Respuestas Rápidas

### "¿Puedo modificar [archivo]?"

```
Dime qué archivo quieres modificar y verificaré si está permitido
según las reglas en .claude-code/integration-config.yaml
```

### "¿Qué componentes tengo disponibles?"

```
🎨 UI Agent: Lista todos los componentes en @libs/app-common/

Para cada uno, dame:
- Nombre
- Propósito en 1 línea
- Usado en qué apps
```

### "¿Este código está duplicado?"

```
📦 Modules Agent: Compara:
- @[archivo1]#L[inicio]-L[fin]
- @[archivo2]#L[inicio]-L[fin]

¿Es código duplicado? ¿Debería extraerse?
```

### "¿Por qué falla este test?"

```
🔍 Analiza la salida de npm test

Identifica:
1. Qué test falla
2. Por qué falla
3. Qué cambio causó el fallo
4. Cómo arreglarlo
```

---

## 🎯 Mejores Prácticas One-Liners

```
✅ "Muéstrame el código ANTES de crear el archivo"
✅ "Ejecuta: npm test y muéstrame el resultado"
✅ "Basándote en el análisis anterior..."
✅ "Espera mi ✅ antes de continuar"
✅ "Crea un plan detallado primero, no implementes todavía"

❌ "Haz todo automáticamente"
❌ "Modifica app1 para que funcione"
❌ "Arregla el código" (ser más específico)
❌ No dar contexto de agentes
```

---

## 🚨 Cuando Algo Sale Mal

### Tests fallan

```bash
# Ver qué falló
npm test

# Revertir cambios
git checkout -- [archivo]

# O usar Claude Code
Esc Esc  # o /rewind
```

### Claude quiere modificar archivos críticos

```
STOP! ⛔

Recuerda las reglas en @.claude-code/integration-config.yaml

NO puedes modificar:
- clock.js
- pulse-interval-calc.js
- voice-sync.js

Propón una solución alternativa usando wrappers u overlays.
```

### No sé qué hacer

```
🎨 UI Agent: Dame 3-5 sugerencias de qué podría hacer ahora 
para mejorar el proyecto PlayNuzic Lab.

Prioriza por:
1. Impacto
2. Facilidad de implementación
3. Valor para usuarios
```

---

## 💾 Guardar Progreso

```bash
# Ver qué cambió
git status
git diff

# Guardar cambios
git add .
git commit -m "descripción clara"

# Subir cambios
git push
```

---

## 📱 Quick Actions

| Quiero... | Prompt |
|-----------|--------|
| Analizar una app | `🎨 UI Agent: Analiza @Apps/app[N]/` |
| Crear componente | `🎨 UI Agent: Crea [nombre] siguiendo patrón de @libs/app-common/[similar]` |
| Fix bug | `🔊 Audio Agent: Debug problema en @[archivo]` |
| Nueva app | `🏗️ Creator Agent: Plan para app[N]-[nombre]` |
| Encontrar duplicados | `📦 Modules Agent: Analiza @Apps/app[N]/ y @Apps/app[M]/` |
| Añadir mobile | `📱 Responsive Agent: Mejora @Apps/app[N]/ para móvil` |
| Tests | `Ejecuta: npm test` |
| Verificar | `Ejecuta: cd agents && npm run verify` |

---

## 🎓 Recordatorios Finales

1. **Siempre cargar contexto:** `@.claude-code/agents-context.md`
2. **Ser específico con roles:** `🎨 UI Agent: [tarea]`
3. **Revisar antes de crear:** `Muéstrame código primero`
4. **Verificar después:** `npm test`
5. **Git para seguridad:** `git status` / `git diff`

---

## 📚 Documentación Completa

- [README.md](./README.md) - Overview general
- [GUIA-IMPLEMENTACION-AGENTES-LAB.md](./GUIA-IMPLEMENTACION-AGENTES-LAB.md) - Instalación completa
- [GUIA-USO-AGENTES-CLAUDE-CODE.md](./GUIA-USO-AGENTES-CLAUDE-CODE.md) - Cómo usar agentes
- [EJEMPLOS-PRACTICOS-AGENTES.md](./EJEMPLOS-PRACTICOS-AGENTES.md) - 8 ejemplos detallados
- [CONVERSACIONES-REALES-COMPLETAS.md](./CONVERSACIONES-REALES-COMPLETAS.md) - Conversaciones completas
- [FAQ-TROUBLESHOOTING.md](./FAQ-TROUBLESHOOTING.md) - Preguntas y soluciones

---

## 🔥 Prompt Starter Ultimate

**Copia y pega esto al inicio de cada sesión:**

```
Hola! Contexto del proyecto:
@.claude-code/agents-context.md

Confirma que entiendes:
- Los 6 agentes (🎨🔊📱📦🏗️🎮)
- Archivos que NO deben tocarse (clock.js, etc)
- Proceso: Mostrar código → Esperar ✅ → Crear

Estoy listo. ¿Con qué agente empezamos?
```

---

**💡 Pro tip:** Guarda esta cheat sheet abierta en otra ventana mientras trabajas con Claude Code.

**🎯 ¿Necesitas ayuda?** `@FAQ-TROUBLESHOOTING.md`
