# ❓ FAQ y Troubleshooting: Agentes + Claude Code

## Tabla de Contenidos

1. [Preguntas Frecuentes (FAQ)](#faq)
2. [Problemas Comunes](#problemas-comunes)
3. [Optimización de Performance](#optimizacion)
4. [Tips Avanzados](#tips-avanzados)
5. [Solución de Problemas Específicos](#problemas-especificos)

---

## <a name="faq"></a>❓ Preguntas Frecuentes (FAQ)

### General

**Q: ¿Puedo usar los agentes sin Claude Code?**
A: Sí, los agentes son scripts Node.js independientes. Puedes usarlos con:
```bash
cd agents
npm run analyze
npm run verify
```
Claude Code solo hace el proceso más interactivo y ayuda con el desarrollo.

**Q: ¿Los agentes modifican mi código?**
A: **NO**. Los agentes están diseñados específicamente para ser no invasivos. Solo analizan, sugieren y crean nuevos archivos. Nunca modifican archivos existentes.

**Q: ¿Puedo desactivar los agentes?**
A: Sí, simplemente no los uses. No se ejecutan automáticamente y no afectan el funcionamiento del repositorio Lab.

**Q: ¿Funciona en Windows?**
A: Sí, pero Claude Code requiere WSL (Windows Subsystem for Linux). Los agentes funcionan en PowerShell/CMD también, pero se recomienda WSL para mejor compatibilidad.

**Q: ¿Necesito una cuenta de Anthropic?**
A: Sí, para usar Claude Code necesitas una cuenta. Puedes usar:
- Claude Pro (suscripción)
- API de Anthropic (pay-as-you-go)
- Proveedores compatibles (Amazon Bedrock, Google Vertex AI)

---

### Instalación

**Q: El script install-agents.sh no se ejecuta**
A: Asegúrate de darle permisos de ejecución:
```bash
chmod +x install-agents.sh
./install-agents.sh
```

**Q: npm install falla en agents/**
A: Verifica que tienes Node.js >= 16:
```bash
node --version  # Debe ser >= 16.x
npm --version   # Debe ser >= 8.x
```

Si necesitas actualizar:
```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# macOS
brew install node@18
```

**Q: La extensión de VSCode no se instala automáticamente**
A: 
1. Verifica que el comando `code` esté en tu PATH:
   ```bash
   code --version
   ```
2. Si no está, instálalo desde VSCode:
   - Cmd+Shift+P (Mac) o Ctrl+Shift+P (Windows/Linux)
   - "Shell Command: Install 'code' command in PATH"
3. Reinicia VSCode y el terminal

**Q: Claude Code no encuentra el proyecto**
A: Claude Code debe ejecutarse desde la raíz del repositorio:
```bash
cd Lab
claude
```

---

### Uso de Claude Code

**Q: ¿Cómo le doy contexto a Claude Code?**
A: Al inicio de cada sesión:
```
Lee estos archivos para entender el proyecto:
1. .claude-code/context.md
2. .claude-code/integration-config.yaml
3. README.md
```

**Q: Claude Code quiere modificar archivos críticos**
A: Recuérdale las reglas:
```
IMPORTANTE: Lee .claude-code/integration-config.yaml
NUNCA modifiques:
- libs/sound/clock.js
- libs/app-common/pulse-interval-calc.js
- libs/app-common/voice-sync.js

Solo crea nuevos archivos o sugiere cambios, no los apliques.
```

**Q: ¿Cómo revierto cambios de Claude Code?**
A: Claude Code tiene checkpoints automáticos:
- Presiona `Esc Esc` para revertir
- O usa el comando `/rewind`
- También puedes usar Git: `git reset --hard`

**Q: ¿Claude Code puede ejecutar los agentes?**
A: Sí, pídele que ejecute comandos:
```
Ejecuta: cd agents && npm run analyze
```

**Q: ¿Puedo usar Claude Code sin internet?**
A: No, Claude Code requiere conexión a internet para comunicarse con la API de Anthropic.

---

### Agentes

**Q: ¿Qué hace cada agente?**
A:
- **ui-agent**: Analiza y sugiere componentes UI
- **audio-agent**: Optimiza sistema de audio
- **responsive-agent**: Mejora responsividad móvil
- **modules-agent**: Gestiona módulos compartidos
- **creator-agent**: Crea nuevas apps
- **gamification-agent**: Añade sistema de logros

**Q: ¿Los agentes se ejecutan automáticamente?**
A: No, debes ejecutarlos manualmente o pedirle a Claude Code que los ejecute.

**Q: ¿Cómo actualizo los agentes?**
A: Los agentes aprenden del código existente en cada ejecución de `npm run init`. Si añades nuevas apps o componentes, vuelve a ejecutar init.

**Q: ¿Puedo crear mi propio agente?**
A: Sí, sigue el patrón de los agentes existentes. Crea un archivo en `agents/` y añádelo al orchestrator.

**Q: ¿Los agentes guardan estado?**
A: No, los agentes analizan el código en cada ejecución. No mantienen estado persistente entre ejecuciones.

---

### Integración

**Q: ¿Cómo integro los agentes en mi workflow?**
A: Ejemplo de workflow:
```bash
1. git pull                    # Actualizar repo
2. cd agents && npm run init   # Inicializar agentes
3. npm run verify              # Verificar integridad
4. code .                      # Abrir VSCode
5. claude                      # Iniciar Claude Code
6. # Trabajar con Claude
7. npm test                    # Verificar tests
8. git add .                   # Commit cambios
9. git commit -m "..."
```

**Q: ¿Puedo usar los agentes en CI/CD?**
A: Sí, puedes integrar `npm run verify` en tu pipeline:
```yaml
# .github/workflows/verify.yml
name: Verify Agents
on: [push, pull_request]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: cd agents && npm install
      - run: cd agents && npm run verify
      - run: npm test
```

**Q: ¿Los agentes funcionan con otros IDEs?**
A: Los agentes son independientes del IDE. Claude Code también funciona con Cursor y Windsurf.

---

## <a name="problemas-comunes"></a>🔧 Problemas Comunes

### Problema: "Module not found" en agentes

**Síntomas:**
```
Error: Cannot find module 'js-yaml'
```

**Solución:**
```bash
cd agents
rm -rf node_modules package-lock.json
npm install
```

---

### Problema: Claude Code no ve los archivos del proyecto

**Síntomas:**
Claude Code dice "no puedo encontrar ese archivo" cuando debería existir.

**Soluciones:**

1. Verifica que estás en el directorio correcto:
```bash
pwd  # Debe mostrar .../Lab
```

2. Reinicia Claude Code:
```bash
# Salir de Claude Code (Ctrl+D)
claude
```

3. Usa referencias absolutas:
```
@Apps/app1/main.js
```

4. Verifica permisos de archivos:
```bash
ls -la Apps/
```

---

### Problema: Tests fallan después de usar agentes

**Síntomas:**
```
npm test
# Algunos tests fallan que antes pasaban
```

**Diagnóstico:**
```bash
# Verificar integridad
cd agents
npm run verify

# Ver qué cambió
git status
git diff
```

**Solución:**
```bash
# Si los agentes crearon algo problemático
git checkout -- .

# O revertir a commit anterior
git reset --hard HEAD~1

# Reportar el problema para mejorar los agentes
```

---

### Problema: Claude Code modifica archivos que no debería

**Síntomas:**
Claude Code quiere modificar `clock.js` o `pulse-interval-calc.js`

**Prevención:**
```
STOP! Lee .claude-code/integration-config.yaml

Estos archivos están en la lista 'preserve' y NO deben modificarse:
- libs/sound/clock.js
- libs/app-common/pulse-interval-calc.js
- libs/app-common/voice-sync.js

En lugar de modificarlos, crea wrappers o componentes nuevos.
```

**Si ya modificó:**
```bash
# Revertir cambios
git checkout -- libs/sound/clock.js

# O usar checkpoint de Claude Code
# Presionar: Esc Esc
```

---

### Problema: Performance lenta con Claude Code

**Síntomas:**
Claude Code tarda mucho en responder o analizar archivos.

**Soluciones:**

1. **Reducir contexto:**
```
En lugar de: "Analiza todo el repositorio"
Usar: "Analiza solo Apps/app1/"
```

2. **Usar referencias específicas:**
```
En lugar de: "Lee todos los archivos en libs/"
Usar: "@libs/app-common/audio.js"
```

3. **Cambiar modelo:**
```
/model
# Seleccionar modelo más rápido si disponible
```

4. **Limpiar historial:**
```
/clear
# Empieza conversación nueva
```

---

### Problema: Extensión VSCode no activa características

**Síntomas:**
La extensión está instalada pero no se ven diffs en el IDE o no funciona el atajo de teclado.

**Soluciones:**

1. **Verificar instalación:**
```bash
# En VSCode
Cmd+Shift+X (Mac) / Ctrl+Shift+X (Win/Linux)
# Buscar "Claude Code"
# Debe aparecer como instalada
```

2. **Verificar configuración:**
```bash
claude
/config
# Asegurar que diff tool = "auto"
```

3. **Reiniciar VSCode completamente:**
```bash
# Cerrar todas las ventanas
# Reabrir
code .
```

4. **Verificar que estás en terminal integrado:**
```bash
# Claude Code debe ejecutarse en terminal integrado de VSCode
# NO en terminal externo
```

---

### Problema: Conflictos de Git

**Síntomas:**
Git muestra conflictos en archivos que Claude Code tocó.

**Prevención:**
```bash
# Antes de trabajar con Claude Code
git pull
git status  # Debe estar limpio
```

**Solución:**
```bash
# Ver qué archivos tienen conflicto
git status

# Para cada archivo en conflicto
git checkout --theirs <archivo>  # Usar versión remota
# O
git checkout --ours <archivo>    # Usar versión local

# Después de resolver
git add .
git commit -m "Resolve conflicts"
```

---

## <a name="optimizacion"></a>⚡ Optimización de Performance

### Optimizar Claude Code

**1. Usar contexto eficientemente:**
```
❌ Mal: "Analiza todo y dame información sobre todo"
✅ Bien: "Analiza Apps/app1/main.js y dime qué componentes de 
         libs/app-common/ usa"
```

**2. Aprovechar caché:**
```
# Claude Code cachea análisis de archivos
# Reusar referencias en la misma sesión:
"Basándote en el análisis anterior de app1/main.js..."
```

**3. Usar plan mode:**
```
# Antes de cambios grandes
"Crea un plan para [tarea] pero NO lo ejecutes todavía"
# Revisar plan
"Procede con el paso 1 del plan"
```

**4. Checkpoints estratégicos:**
```
# Después de cada hito
"Crea un checkpoint aquí"
# Continuar con confianza
```

---

### Optimizar Agentes

**1. Ejecutar init solo cuando sea necesario:**
```bash
# Solo después de:
# - Añadir nuevas apps
# - Modificar componentes compartidos
# - Actualizar dependencias

cd agents && npm run init
```

**2. Usar analyze selectivamente:**
```bash
# En lugar de analizar todo
npm run analyze

# Analizar aspectos específicos (cuando implementes)
npm run analyze -- --scope=ui
npm run analyze -- --scope=audio
```

**3. Verificar solo cuando sea crítico:**
```bash
# Después de cambios importantes
npm run verify

# No necesitas verificar después de cada cambio pequeño
```

---

## <a name="tips-avanzados"></a>💡 Tips Avanzados

### Usar MCP Servers con Agentes

**Configurar servidor MCP personalizado para agentes:**

```json
// .claude-code/mcp-config.json
{
  "mcpServers": {
    "agents": {
      "command": "node",
      "args": ["agents/mcp-server.js"],
      "env": {
        "PROJECT_ROOT": "${workspaceFolder}"
      }
    }
  }
}
```

**Crear servidor MCP para agentes:**

```javascript
// agents/mcp-server.js
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

const server = new Server({
  name: 'playnuzic-agents',
  version: '1.0.0'
});

// Herramienta: Ejecutar agente
server.setRequestHandler('tools/call', async (request) => {
  if (request.params.name === 'run_agent') {
    const { agent, args } = request.params.arguments;
    // Ejecutar agente
    const result = await runAgent(agent, args);
    return { result };
  }
});

server.listen();
```

---

### Crear Subagentes Personalizados

**Definir subagente en Claude Code:**

```bash
# En Claude Code
/subagent accessibility-agent "Analiza accesibilidad de componentes UI"
```

**Implementar subagente:**

```javascript
// agents/accessibility-agent.js
export const analyzeAccessibility = (componentPath) => {
  // Análisis de:
  // - ARIA labels
  // - Contraste de colores
  // - Navegación por teclado
  // - Screen reader compatibility
  
  return {
    score: 85,
    issues: [...],
    suggestions: [...]
  };
};
```

---

### Integración con Herramientas Externas

**Conectar con herramientas de análisis:**

```javascript
// agents/external-integrations.js
import lighthouse from 'lighthouse';
import chrome from 'chrome-launcher';

export const runLighthouse = async (url) => {
  const chrome = await chrome.launch({chromeFlags: ['--headless']});
  const options = {
    logLevel: 'info',
    output: 'json',
    port: chrome.port
  };
  
  const runnerResult = await lighthouse(url, options);
  await chrome.kill();
  
  return runnerResult.lhr;
};
```

**Usar desde Claude Code:**
```
Ejecuta Lighthouse en app1 y analiza los resultados de performance
```

---

### Automatizar Workflow Completo

**Script de workflow completo:**

```bash
#!/bin/bash
# workflow.sh - Workflow automatizado con agentes

echo "🚀 Iniciando workflow automatizado"

# 1. Actualizar repo
git pull

# 2. Instalar/actualizar dependencias
npm install
cd agents && npm install && cd ..

# 3. Inicializar agentes
cd agents && npm run init

# 4. Análisis del repositorio
echo "📊 Análisis en progreso..."
cd agents && npm run analyze > ../analysis-report.json

# 5. Verificar integridad
echo "🔍 Verificando integridad..."
cd agents && npm run verify

# 6. Ejecutar tests
echo "🧪 Ejecutando tests..."
cd .. && npm test

# 7. Generar reporte
echo "📝 Generando reporte..."
node agents/generate-report.js

echo "✅ Workflow completado"
```

---

## <a name="problemas-especificos"></a>🎯 Solución de Problemas Específicos

### Problema: Audio desincronizado después de cambios

**Diagnóstico:**
```bash
# Verificar sistema de clock
grep -r "clock.js" Apps/

# Verificar cálculos de intervalo
npm test -- pulse-interval
```

**Solución:**
```javascript
// Asegurar que todos los componentes usan el clock compartido
import { getClockInstance } from '../../libs/sound/clock.js';

const clock = getClockInstance();
// NO crear instancias nuevas de clock
```

---

### Problema: Componente nuevo no funciona en producción

**Checklist:**

1. **¿Está importado correctamente?**
```javascript
// ✅ Correcto
import { myComponent } from '../../libs/app-common/my-component.js';

// ❌ Incorrecto (sin .js)
import { myComponent } from '../../libs/app-common/my-component';
```

2. **¿Tiene tests?**
```bash
npm test -- my-component
```

3. **¿Está en el build?**
```bash
ls -la libs/app-common/
```

4. **¿Funciona en local?**
```bash
npx http-server
# Probar en http://localhost:8080
```

---

### Problema: VSCode lento después de instalar extensión

**Solución:**

1. **Excluir node_modules del search:**
```json
// .vscode/settings.json
{
  "search.exclude": {
    "**/node_modules": true,
    "**/agents/node_modules": true
  }
}
```

2. **Desactivar features no usadas:**
```json
{
  "claude-code.autoAnalyze": false,
  "claude-code.autoContext": false
}
```

3. **Aumentar memoria de VSCode:**
```bash
code --max-memory=4096
```

---

### Problema: Agentes no encuentran las apps

**Diagnóstico:**
```bash
cd agents
node -e "
  const fs = require('fs');
  const apps = fs.readdirSync('../Apps');
  console.log('Apps encontradas:', apps);
"
```

**Solución:**
```bash
# Verificar estructura de directorios
ls -la Apps/

# Si los nombres no coinciden con lo esperado
# Actualizar agents/orchestrator.js
```

---

### Problema: Claude Code consume muchos tokens

**Soluciones:**

1. **Limpiar historial frecuentemente:**
```
/clear
```

2. **Ser específico con contexto:**
```
❌ "Lee todo el proyecto"
✅ "Lee solo @Apps/app1/main.js líneas 1-50"
```

3. **Usar resúmenes:**
```
Primero dame un resumen de alto nivel de 3-5 bullets.
Si necesito más detalles, te lo pediré.
```

4. **Aprovechar caché:**
```
Basándote en lo que ya analizaste de app1...
```

---

## 📞 Obtener Ayuda

### Recursos

1. **Documentación:**
   - `.claude-code/context.md` - Contexto del proyecto
   - `agents/README.md` - Documentación de agentes
   - `CLAUDE.md` - Guía de Claude Code

2. **Logs:**
   ```bash
   # Ver logs de agentes
   cat agents/logs/*.log
   
   # Ver output de verify
   cd agents && npm run verify > verify-log.txt
   ```

3. **Community:**
   - GitHub Issues del repo Lab
   - Documentación de Anthropic
   - Discord/Slack del proyecto (si existe)

---

### Reportar Bugs

Cuando reportes un bug, incluye:

```markdown
## Descripción del Problema
[Descripción clara del problema]

## Pasos para Reproducir
1. ...
2. ...
3. ...

## Comportamiento Esperado
[Qué debería pasar]

## Comportamiento Actual
[Qué está pasando]

## Entorno
- OS: [macOS / Windows / Linux]
- Node.js: [versión]
- NPM: [versión]
- Claude Code: [versión]
- VSCode: [versión]

## Logs
```bash
[pegar logs relevantes]
```

## Intentos de Solución
[Qué has intentado]
```

---

## ✅ Checklist de Troubleshooting

Antes de reportar un problema, verifica:

- [ ] Node.js >= 16.x instalado
- [ ] NPM packages actualizados (`npm install`)
- [ ] Agentes inicializados (`npm run init`)
- [ ] Tests pasando (`npm test`)
- [ ] Verificación exitosa (`npm run verify`)
- [ ] VSCode reiniciado
- [ ] Claude Code ejecutado desde terminal integrado
- [ ] Contexto dado a Claude Code
- [ ] Git repo limpio (`git status`)
- [ ] Permisos de archivos correctos
- [ ] Path correctos (desde raíz del repo)

---

## 🎓 Mejores Prácticas

1. **Siempre da contexto a Claude Code al inicio**
2. **Usa `npm run verify` frecuentemente**
3. **Haz commits pequeños y frecuentes**
4. **Lee los mensajes de error completos**
5. **Prueba en local antes de hacer commit**
6. **Mantén los agentes actualizados**
7. **Documenta cambios importantes**
8. **No bypasses las reglas de seguridad**
9. **Usa checkpoints en cambios grandes**
10. **Aprende de los errores - mejora los agentes**

---

**¿Tienes una pregunta que no está aquí? ¡Añádela! Este documento es vivo y mejora con el uso.** 🌱
