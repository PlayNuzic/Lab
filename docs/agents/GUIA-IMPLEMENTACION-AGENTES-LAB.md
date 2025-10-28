# 🎯 Guía de Implementación de Agentes en PlayNuzic Lab

## 📌 Resumen Ejecutivo

Esta guía explica cómo integrar el sistema de agentes diseñado con el repositorio Lab de PlayNuzic, y cómo usar Claude Code en VSCode para trabajar con ellos.

---

## 🏗️ PASO 1: Preparar el Repositorio Lab

### 1.1 Clonar y configurar el repositorio

```bash
# Clonar el repositorio
git clone https://github.com/PlayNuzic/Lab.git
cd Lab

# Ejecutar setup
./setup.sh

# Verificar que todo funciona
npm test
```

### 1.2 Crear la estructura de agentes

Añade estos directorios SIN modificar código existente:

```bash
# Crear estructura de agentes
mkdir -p agents
mkdir -p .claude-code
mkdir -p enhancements/{responsive-styles,gamification-overlays,performance-suggestions,new-apps}
```

---

## 🤖 PASO 2: Implementar los Agentes

### 2.1 Copiar archivos de agentes

Coloca los siguientes archivos en el directorio `agents/`:

```
agents/
├── ui-agent-integrated.js
├── audio-agent-integrated.js
├── responsive-agent-integrated.js
├── modules-agent-integrated.js
├── creator-agent-integrated.js
├── gamification-agent-integrated.js
└── orchestrator.js
```

### 2.2 Crear el archivo de configuración principal

**`.claude-code/integration-config.yaml`**

```yaml
# Configuración de integración con PlayNuzic Lab existente
name: PlayNuzic-Lab-Agent-Integration
version: 1.0.0
mode: non-invasive

# Principios fundamentales a preservar
preserve:
  - browser_clock_system: true
  - pulse_interval_calculations: true
  - voice_sync_cycles: true
  - minimalist_aesthetic: true
  - existing_module_structure: true

# Directorios existentes (no modificar)
existing:
  apps:
    - app1-ritmos-numericos
    - app2-melodias-matematicas
    - app3-armonias-algoritmicas
    - app4-composicion-combinatoria
    - app5-sintesis-numerica
    - app6-patrones-polirritmicos
  
  libs:
    - app-common/
    - sound/
    - notation/
    - cards/
    - ear-training/

# Nuevos archivos (se añaden, no reemplazan)
additions:
  agents:
    - ui-agent-integrated.js
    - audio-agent-integrated.js
    - responsive-agent-integrated.js
    - modules-agent-integrated.js
    - creator-agent-integrated.js
    - gamification-agent-integrated.js
  
  enhancements:
    - responsive-styles/
    - gamification-overlays/
    - performance-suggestions/
    - new-apps/

# Reglas de operación
rules:
  - never_modify_existing_files: true
  - always_preserve_clock_system: true
  - maintain_calculation_compatibility: true
  - respect_minimalist_design: true
  - overlay_not_replace: true
  - suggest_not_impose: true
  - learn_from_existing: true
  - test_before_suggest: true
```

### 2.3 Crear archivo package.json para agentes

**`agents/package.json`**

```json
{
  "name": "playnuzic-lab-agents",
  "version": "1.0.0",
  "description": "Sistema de agentes para PlayNuzic Lab",
  "type": "module",
  "main": "orchestrator.js",
  "scripts": {
    "init": "node orchestrator.js init",
    "enhance": "node orchestrator.js enhance",
    "create": "node orchestrator.js create",
    "analyze": "node orchestrator.js analyze",
    "verify": "node orchestrator.js verify"
  },
  "keywords": ["playnuzic", "agents", "ai", "music"],
  "author": "PlayNuzic",
  "license": "MIT",
  "dependencies": {
    "js-yaml": "^4.1.0"
  }
}
```

---

## 💻 PASO 3: Configurar Claude Code en VSCode

### 3.1 Instalar Claude Code CLI

```bash
# Instalar Claude Code globalmente
npm install -g @anthropic-ai/claude-code

# O usando curl (macOS/Linux)
curl -fsSL https://get.anthropic.com/code | sh
```

### 3.2 Instalar la extensión de VSCode

**Método 1: Desde el Marketplace**

1. Abre VSCode
2. Ve a Extensions (Ctrl+Shift+X)
3. Busca "Claude Code"
4. Instala la extensión oficial de Anthropic

**Método 2: Instalación automática**

La extensión se instala automáticamente la primera vez que ejecutas `claude` en el terminal integrado de VSCode.

### 3.3 Configurar Claude Code

```bash
# Abrir VSCode en el directorio del proyecto
cd Lab
code .

# En el terminal integrado de VSCode (Ctrl+`)
claude

# Seguir las instrucciones para autenticarse
# Configurar el diff tool para VSCode
/config
# Seleccionar "auto" para diff tool
```

---

## 🎨 PASO 4: Usar los Agentes con Claude Code

### 4.1 Inicializar el sistema de agentes

En el terminal integrado de VSCode:

```bash
# Inicializar agentes (aprenden del código existente)
cd agents
npm install
npm run init
```

### 4.2 Comandos disponibles

**Analizar el repositorio:**
```bash
npm run analyze
```

**Crear una nueva app:**
```bash
npm run create "app7-ritmos-fractales" "fractal-rhythms" "fibonacci" "arpeggios"
```

**Mejorar una app existente:**
```bash
npm run enhance app1-ritmos-numericos ui
npm run enhance app2-melodias-matematicas mobile
npm run enhance app3-armonias-algoritmicas gamification
```

**Verificar integridad:**
```bash
npm run verify
```

### 4.3 Usar Claude Code directamente

En el terminal integrado de VSCode:

```bash
claude
```

Ejemplos de prompts para Claude Code:

```
"Analiza la estructura de apps/ y sugiere mejoras sin modificar código existente"

"Crea un nuevo componente UI siguiendo el estilo de app1-ritmos-numericos"

"Revisa audio-init.js y sugiere optimizaciones manteniendo compatibilidad"

"Analiza notation-utils.js y explica su funcionamiento"

"Crea tests para el nuevo componente siguiendo los patrones en libs/app-common/__tests__/"
```

---

## 🔧 PASO 5: Flujo de Trabajo con Agentes y Claude Code

### 5.1 Flujo típico de desarrollo

```bash
# 1. Abrir proyecto en VSCode
cd Lab
code .

# 2. Iniciar Claude Code en el terminal integrado
claude

# 3. Dar contexto a Claude sobre los agentes
"Lee el archivo .claude-code/integration-config.yaml para entender 
las reglas de integración con este repositorio"

# 4. Trabajar con los agentes
"Usa el agente UI para analizar app1 y sugerir mejoras accesibles"

# 5. Verificar que no se rompa nada
cd agents
npm run verify

# 6. Ejecutar tests
cd ..
npm test
```

### 5.2 Características de la extensión VSCode

**Contexto automático:**
- Claude ve automáticamente el archivo/selección actual
- Usa `Alt+Cmd+K` (Mac) o `Alt+Ctrl+K` (Windows/Linux) para añadir referencias a archivos

**Visualización de cambios:**
- Los diffs se muestran directamente en VSCode
- Puedes aceptar/rechazar cambios visualmente

**Compartir diagnósticos:**
- Claude ve errores de linting y sintaxis automáticamente
- Puede sugerir fixes basados en los errores

**Plan Mode:**
- Claude crea un plan antes de hacer cambios
- Puedes revisar y aprobar el plan

---

## 📝 PASO 6: Crear Prompts Personalizados para Claude Code

### 6.1 Crear archivo de contexto para Claude

**`.claude-code/context.md`**

```markdown
# PlayNuzic Lab - Contexto para Claude Code

## Filosofía del Proyecto

- **Minimalismo**: UI limpia, código simple
- **Reutilización**: ~70% código compartido en libs/
- **No invasivo**: Los agentes NUNCA modifican código existente
- **Aprendizaje**: Los agentes aprenden de apps existentes

## Estructura del Repositorio

- `Apps/`: 6 apps rítmicas independientes
- `libs/app-common/`: Componentes compartidos (32+ módulos)
- `agents/`: Sistema de agentes no invasivo
- `tests/`: 280+ tests con Jest

## Reglas Críticas

1. NUNCA modificar el sistema de clock (libs/sound/clock.js)
2. NUNCA romper pulse-interval-calc.js
3. SIEMPRE preservar la estética minimalista
4. SIEMPRE escribir tests para nuevos componentes
5. SIEMPRE usar componentes compartidos antes de crear nuevos

## Comandos Útiles

- `npm test`: Ejecutar todos los tests
- `npm run verify`: Verificar integridad del sistema
- `./setup.sh`: Configurar entorno
```

### 6.2 Prompts recomendados

**Para análisis:**
```
"Analiza la estructura de libs/app-common/ y documenta todos los 
componentes reutilizables disponibles"
```

**Para crear componentes:**
```
"Crea un nuevo componente de control de tempo siguiendo el estilo 
de components existentes en libs/app-common/. NO modifiques código 
existente, crea un nuevo archivo."
```

**Para refactoring:**
```
"Revisa app1/main.js y sugiere cómo podría usar más componentes de 
libs/app-common/ sin romper la funcionalidad existente"
```

**Para documentación:**
```
"Lee todos los archivos en agents/ y crea una documentación completa 
de cómo funciona el sistema de agentes"
```

---

## 🎯 PASO 7: Integración Completa - Ejemplo Práctico

### Escenario: Crear una nueva app usando agentes y Claude Code

**1. Iniciar sesión de Claude Code:**

```bash
cd Lab
code .
# En terminal integrado:
claude
```

**2. Pedir a Claude que lea el contexto:**

```
"Lee .claude-code/context.md y .claude-code/integration-config.yaml 
para entender cómo trabajar con este repositorio"
```

**3. Inicializar el agente creator:**

```
"Ejecuta el comando: cd agents && npm run init"
```

**4. Crear nueva app con el agente:**

```
"Usa el agente creator para diseñar una nueva app llamada 
'app7-ritmos-geometricos' que explore patrones geométricos musicales. 
Asegúrate de seguir el estilo de las apps existentes y usar componentes 
de libs/app-common/"
```

**5. Claude Code generará:**
- Estructura de archivos para la nueva app
- Código siguiendo los patrones existentes
- Tests básicos
- Documentación

**6. Revisar y aprobar cambios:**
- Los diffs se mostrarán en VSCode
- Puedes aceptar/rechazar cada cambio
- Claude respeta las reglas de no modificar código existente

**7. Verificar integridad:**

```bash
cd agents
npm run verify

cd ..
npm test
```

---

## ⚙️ CONFIGURACIÓN AVANZADA

### MCP Servers (Model Context Protocol)

Claude Code puede usar MCP servers para extender funcionalidad. Para configurar:

**1. Crear configuración MCP:**

**`.claude-code/mcp-config.json`**

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "Apps/", "libs/"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "tu-token"
      }
    }
  }
}
```

**2. Activar MCP en Claude Code:**

```bash
claude
/config
# Seleccionar MCP configuration
# Apuntar al archivo mcp-config.json
```

### Subagentes

Los agentes pueden trabajar como subagentes de Claude Code para tareas específicas:

```bash
# En Claude Code
/subagent ui-agent "Analiza app1 y sugiere mejoras de accesibilidad"
/subagent audio-agent "Optimiza el sistema de audio manteniendo compatibilidad"
```

---

## 🐛 TROUBLESHOOTING

### La extensión no se instala automáticamente

```bash
# En VSCode Command Palette (Cmd+Shift+P):
"Shell Command: Install 'code' command in PATH"

# Reiniciar VSCode y ejecutar:
claude
```

### Claude Code no ve los agentes

```bash
# Asegurarse de estar en el directorio correcto:
cd Lab
claude

# Dar contexto explícito:
"Los agentes están en ./agents/. Lee orchestrator.js para entender su estructura"
```

### Los tests fallan después de cambios

```bash
# Verificar integridad:
cd agents
npm run verify

# Si hay problemas, usar checkpoints de Claude Code:
# Presionar Esc Esc para revertir
# O usar: /rewind
```

### Claude Code no respeta las reglas

Recuérdale el contexto:

```
"IMPORTANTE: Este repositorio tiene reglas estrictas en 
.claude-code/integration-config.yaml. Nunca modifiques código existente, 
solo crea nuevos archivos o sugiere mejoras. El sistema de clock y 
pulse-interval-calc son críticos y no deben tocarse."
```

---

## 📚 RECURSOS ADICIONALES

### Documentación relevante

- **Claude Code Docs**: https://docs.claude.com/en/docs/claude-code
- **Repositorio Lab**: https://github.com/PlayNuzic/Lab
- **VSCode Extension**: https://marketplace.visualstudio.com/items?itemName=anthropic.claude-code

### Archivos clave en el repositorio

- `CLAUDE.md`: Guía completa para Claude Code
- `AGENTS.md`: Documentación en catalán
- `Apps/App4/README.md`: Documentación específica de App4
- `libs/app-common/AGENTS.md`: Estado de componentes compartidos

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

- [ ] Repositorio Lab clonado y configurado (`./setup.sh`)
- [ ] Tests pasando (`npm test`)
- [ ] Estructura de agentes creada (`mkdir -p agents .claude-code enhancements/...`)
- [ ] Archivos de agentes copiados a `agents/`
- [ ] Archivo de configuración `.claude-code/integration-config.yaml` creado
- [ ] `agents/package.json` creado e instalado (`npm install`)
- [ ] Claude Code CLI instalado (`npm install -g @anthropic-ai/claude-code`)
- [ ] Extensión VSCode instalada (automática o manual)
- [ ] Claude Code configurado (`claude` → `/config`)
- [ ] Archivo de contexto `.claude-code/context.md` creado
- [ ] Agentes inicializados (`npm run init`)
- [ ] Verificación de integridad pasada (`npm run verify`)
- [ ] Primera interacción con Claude Code exitosa
- [ ] MCP servers configurados (opcional)

---

## 🎉 PRÓXIMOS PASOS

Una vez implementado todo:

1. **Familiarízate con los agentes**: Ejecuta `npm run analyze` para ver qué aprendieron
2. **Prueba crear una app**: Usa `npm run create` con parámetros de prueba
3. **Experimenta con Claude Code**: Pídele que analice diferentes partes del código
4. **Crea tu primer componente**: Usa el agente UI para crear un componente siguiendo el estilo existente
5. **Mejora una app**: Usa `npm run enhance` en una de las apps existentes

---

## 💡 TIPS FINALES

**Para Claude Code:**
- Siempre dale contexto al inicio de la sesión
- Usa `/model` para cambiar entre modelos si es necesario
- Usa checkpoints (Esc Esc) para revertir cambios
- Aprovecha el plan mode para revisar antes de ejecutar

**Para los agentes:**
- Los agentes son tu documentación viva del código
- Úsalos para entender patrones antes de crear nuevo código
- Confía en el sistema de verificación
- Nunca bypasses las reglas de no-invasión

**Para el flujo de trabajo:**
- Siempre ejecuta tests antes y después de cambios
- Usa `npm run verify` frecuentemente
- Mantén los agentes actualizados con nuevos patrones
- Documenta nuevos componentes en AGENTS.md

---

## 📞 SOPORTE

Si tienes problemas:

1. Revisa el archivo `TROUBLESHOOTING` (si existe)
2. Ejecuta `npm run verify` para diagnósticos
3. Consulta los tests fallidos para pistas
4. Revisa las reglas en `.claude-code/integration-config.yaml`
5. Pregunta a Claude Code: "¿Por qué falló X? Lee los logs y sugiere soluciones"

---

**¡Listo! Ahora tienes un sistema completo de agentes integrado con Claude Code en VSCode, trabajando de manera no invasiva con el repositorio Lab de PlayNuzic.** 🎵✨
