# 🚀 Guía Práctica: Usar Agentes con Claude Code en VSCode

## 📋 Concepto Clave

Los "agentes" en el archivo que subiste **NO son programas que ejecutas**, sino **instrucciones y contexto** que le das a Claude Code para que trabaje de cierta manera.

Claude Code actuará como esos agentes cuando le des el contexto adecuado.

---

## 🎯 Método 1: Uso Directo (Más Simple)

### Paso 1: Preparar el Archivo de Agentes

```bash
# En tu repositorio Lab
cd Lab
mkdir -p .claude-code

# Copia el archivo de agentes
cp agentes-claude-code-integracion-lab.md .claude-code/agents-context.md
```

### Paso 2: Abrir VSCode e Iniciar Claude Code

```bash
# Abrir VSCode
code .

# En el terminal integrado de VSCode (Ctrl+` o Cmd+`)
claude
```

### Paso 3: Cargar el Contexto de Agentes

En la conversación con Claude Code:

```
Hola! Voy a trabajar en el repositorio PlayNuzic Lab con un sistema de agentes.

Por favor, lee completamente este archivo:
@.claude-code/agents-context.md

Este archivo define 6 agentes especializados:
- UI Agent: Diseño de interfaces
- Audio Agent: Optimización de audio
- Responsive Agent: Adaptación móvil
- Modules Agent: Gestión de módulos
- Creator Agent: Creación de apps
- Gamification Agent: Sistema de logros

IMPORTANTE: Estos archivos son sagrados y NO deben modificarse:
- libs/sound/clock.js
- libs/app-common/pulse-interval-calc.js
- libs/app-common/voice-sync.js

Tu rol es actuar como estos agentes según lo que te pida.
¿Entendido?
```

**Claude Code responderá confirmando que ha leído y entendido los agentes.**

---

## 💬 Método 2: Usar Agentes en Conversaciones

### Ejemplo 1: Actuar como UI Agent

```
🎨 Actúa como el UI Agent definido en agents-context.md

TAREA: Analiza la app1-ritmos-numericos y:
1. Identifica los componentes UI que usa
2. Encuentra patrones de diseño reutilizables
3. Sugiere un nuevo componente "TempoSlider" siguiendo el estilo existente

Recuerda: NO modifiques código existente, solo analiza y sugiere.
```

### Ejemplo 2: Actuar como Audio Agent

```
🔊 Actúa como el Audio Agent definido en agents-context.md

TAREA: Analiza el sistema de audio y sugiere optimizaciones:
1. Lee libs/sound/clock.js (NO lo modifiques)
2. Identifica posibles cuellos de botella
3. Propón un módulo de optimización opcional (overlay)

Crea el código del módulo siguiendo los principios no invasivos.
```

### Ejemplo 3: Actuar como Creator Agent

```
🏗️ Actúa como el Creator Agent definido en agents-context.md

TAREA: Diseña una nueva app7-ritmos-geometricos:

CONCEPTO:
- Explorar patrones fractales → ritmos
- Usar números de Fibonacci
- Visualización de formas geométricas

PASOS:
1. Analiza la estructura de app1-app6
2. Identifica componentes reutilizables
3. Crea un plan detallado (NO implementes todavía)
4. Lista los archivos que necesitarás crear

Recuerda: Reutilizar máximo código de libs/app-common/
```

---

## 🎭 Método 3: Cambiar de Agente en la Conversación

Puedes cambiar de agente en cualquier momento:

```
Conversación:

Usuario: 🎨 UI Agent: Analiza app1 y sugiere mejoras de accesibilidad

Claude: [analiza como UI Agent...]

Usuario: Perfecto. Ahora 🔊 Audio Agent: Basándote en el análisis anterior, 
¿hay implicaciones de performance en el audio?

Claude: [analiza como Audio Agent...]

Usuario: Excelente. Ahora 🏗️ Creator Agent: Crea un plan para implementar 
estas mejoras sin romper nada

Claude: [crea plan como Creator Agent...]
```

---

## 📝 Método 4: Usar Agentes con Archivos de Prompt

### Crear Archivo de Prompts Predefinidos

```bash
# Crear archivo de prompts
nano .claude-code/agent-prompts.md
```

**Contenido del archivo:**

```markdown
# 🎯 Prompts de Agentes para Claude Code

## 🎨 UI Agent - Análisis de Componente

```
Actúa como el UI Agent.
Analiza @[ARCHIVO] y:
1. Identifica patrones de diseño
2. Encuentra componentes reutilizables
3. Sugiere mejoras de accesibilidad
4. Lista oportunidades de refactoring
NO modifiques código existente.
```

## 🔊 Audio Agent - Optimización

```
Actúa como el Audio Agent.
Analiza el sistema de audio en @[DIRECTORIO]
Recuerda que estos archivos son CRÍTICOS (no tocar):
- libs/sound/clock.js
- pulse-interval-calc.js
- voice-sync.js
Sugiere optimizaciones como overlays opcionales.
```

## 📱 Responsive Agent - Mobile Enhancement

```
Actúa como el Responsive Agent.
Mejora la responsividad de @[APP] para móviles:
1. Analiza layout actual
2. Identifica problemas en pantallas <768px
3. Crea archivos CSS en enhancements/responsive-styles/
4. NO modifiques archivos existentes de la app
```

## 🏗️ Creator Agent - Nueva App

```
Actúa como el Creator Agent.
Crea plan para nueva app: [NOMBRE]
Concepto: [DESCRIPCIÓN]

PASOS:
1. Analiza estructura de apps existentes
2. Identifica componentes de libs/app-common/ a reutilizar
3. Lista componentes nuevos necesarios
4. Crea estructura de archivos
5. Implementa paso a paso

Siguiendo el estilo minimalista de PlayNuzic Lab.
```

## 🎮 Gamification Agent - Sistema de Logros

```
Actúa como el Gamification Agent.
Añade gamificación a @[APP]:
1. Define achievements relevantes
2. Crea sistema de tracking no invasivo
3. Diseña UI overlay (no modifica app existente)
4. Implementa en enhancements/gamification-overlays/
```

## 📦 Modules Agent - Detección de Duplicados

```
Actúa como el Modules Agent.
Analiza código duplicado entre:
- @[ARCHIVO1]
- @[ARCHIVO2]

Identifica:
1. Código exactamente duplicado
2. Patrones similares
3. Oportunidades de extracción a libs/
4. Plan de refactoring seguro
```
```

### Usar los Prompts

En Claude Code:

```
Lee @.claude-code/agent-prompts.md

Ahora ejecuta el prompt "UI Agent - Análisis de Componente" 
reemplazando [ARCHIVO] con Apps/app1/main.js
```

---

## 🔄 Workflow Completo Paso a Paso

### Flujo de Trabajo Real

```bash
# PASO 1: Preparar entorno
cd Lab
code .

# PASO 2: Terminal integrado
# Presionar: Ctrl+` (Cmd+` en Mac)
claude

# PASO 3: En Claude Code, cargar contexto
```

```
Hola! Carga el contexto de agentes:
@.claude-code/agents-context.md

Confirma que entiendes los 6 agentes y las reglas.
```

```
# PASO 4: Análisis inicial
```

```
🎨 UI Agent: Analiza todas las apps en Apps/ y dame:
1. Resumen de componentes UI únicos vs compartidos
2. Patrones de diseño comunes
3. Oportunidades de reutilización

Usa: @Apps/app1/ @Apps/app2/ @Apps/app3/
```

```
# PASO 5: Trabajo específico
```

```
Basándote en el análisis anterior, 🏗️ Creator Agent:
Crea una nueva app7-ritmos-fibonacci con:
- Generador de secuencias Fibonacci
- Visualización geométrica
- Mapeo a patrones rítmicos

Crea PRIMERO el plan detallado, luego implementamos paso a paso.
```

```
# PASO 6: Verificación
```

```
Ejecuta estos comandos y muéstrame los resultados:
npm test
```

---

## 🎯 Ejemplos Prácticos Reales

### Ejemplo Real 1: Debugging

**Situación:** Desincronización de audio a 200 BPM

```
🔊 Audio Agent: Tengo un problema de desincronización.

CONTEXTO:
- Apps: app4-composicion-combinatoria
- Síntoma: A 200+ BPM, el visualizador se atrasa del audio
- NO cambió nada en clock.js recientemente

TAREA:
1. Analiza @Apps/app4/visualizer.js
2. Revisa timing en @libs/sound/clock.js (NO tocar)
3. Identifica dónde está el problema
4. Propón fix sin modificar archivos críticos

Debugging sistemático por favor.
```

**Claude Code investigará y responderá con análisis detallado.**

---

### Ejemplo Real 2: Nueva Funcionalidad

**Situación:** Añadir selector de escalas musicales

```
🎨 UI Agent: Necesito un componente de selector de escalas musicales.

REQUISITOS:
1. Analiza componentes similares en @libs/app-common/
2. Identifica el patrón de diseño (probablemente dropdown o grid)
3. Crea "scale-selector.js" siguiendo ese patrón

ESCALAS:
- Mayor, Menor, Pentatónica, Blues, Dorian, Frigio, Lidio

API deseada:
```javascript
const selector = createScaleSelector({
  container: element,
  defaultScale: 'Major',
  onChange: (scale) => {...}
});
```

Incluye tests en __tests__/scale-selector.test.js
```

---

### Ejemplo Real 3: Mejora de Accesibilidad

```
🎨 UI Agent + 📱 Responsive Agent: Mejora de accesibilidad y mobile

OBJETIVO: App2 debe ser accesible en móvil

TAREAS:
1. 🎨 UI Agent: Analiza @Apps/app2/ y lista problemas de accesibilidad
   - Contraste de colores
   - ARIA labels
   - Navegación por teclado
   - Tamaños touch-friendly

2. 📱 Responsive Agent: Crea mejoras mobile en:
   enhancements/responsive-styles/app2-mobile.css
   enhancements/responsive-styles/app2-mobile.js

NO modifiques archivos existentes de app2, solo crea overlays.
```

---

### Ejemplo Real 4: Refactoring Seguro

```
📦 Modules Agent: Detecta y refactoriza código duplicado

ÁMBITO:
- @Apps/app2/main.js (líneas 50-120)
- @Apps/app3/main.js (líneas 80-150)

Sospecho que hay código duplicado de manejo de fracciones.

PROCESO:
1. Compara ambos fragmentos
2. Identifica código exactamente igual vs similar
3. Verifica si @libs/app-common/fraction-editor.js ya hace esto
4. Si no, propón cómo extraer a libs/
5. Muestra el antes/después
6. Lista tests que necesitamos para validar

NO hagas cambios todavía, solo el análisis y plan.
```

---

## 🎪 Técnicas Avanzadas

### Técnica 1: Encadenamiento de Agentes

```
Vamos a trabajar en equipo con múltiples agentes:

FASE 1: 🎨 UI Agent
Analiza @Apps/app1/ y documenta todos los componentes UI

FASE 2: 📦 Modules Agent  
Basándote en el análisis del UI Agent, identifica qué está
duplicado vs qué está en libs/app-common/

FASE 3: 🏗️ Creator Agent
Con la info de ambos agentes, crea plan para nueva app8
que reutilice máximo los componentes identificados

Ejecuta las 3 fases en secuencia, esperando mi aprobación 
entre cada una.
```

### Técnica 2: Modo "Pair Programming"

```
Vamos a hacer pair programming con el 🏗️ Creator Agent:

OBJETIVO: Crear app7-ritmos-geometricos

MODO:
1. Por cada componente, me muestras el código ANTES de crearlo
2. Yo te doy feedback
3. Ajustas según feedback
4. Solo después de mi ✅ lo creas

Empecemos con el plan general. Muéstrame el árbol de archivos
que planeas crear.
```

### Técnica 3: Verificación Continua

```
🔍 Modo de verificación estricta activado

Después de cada cambio que hagamos, ejecuta automáticamente:
1. npm test
2. Análisis de impacto en archivos críticos
3. Reporte de qué cambió exactamente

Si algo falla, revierte automáticamente usando /rewind

¿Entendido? Ahora hagamos [tarea]...
```

---

## 🛡️ Reglas de Seguridad para Todos los Agentes

Incluye esto al principio de cada sesión:

```
REGLAS DE SEGURIDAD PARA TODOS LOS AGENTES:

🚫 NUNCA MODIFICAR:
- libs/sound/clock.js
- libs/app-common/pulse-interval-calc.js  
- libs/app-common/voice-sync.js
- Ningún archivo en Apps/app[1-6]/ sin mi permiso explícito

✅ SIEMPRE:
- Crear nuevos archivos en vez de modificar existentes
- Usar overlays y wrappers cuando sea posible
- Escribir tests para nuevos componentes
- Respetar el estilo minimalista
- Mantener APIs consistentes

⚠️ ANTES DE CADA CAMBIO:
- Mostrarme el código
- Esperar mi aprobación
- Explicar el impacto

Si rompo estas reglas, detente y avísame.
```

---

## 📊 Monitoreo y Métricas

### Crear Sistema de Tracking

```
Crea un archivo de métricas para tracking del proyecto:

@.claude-code/metrics.md

Contenido:
- Componentes creados por agentes
- Líneas de código añadidas vs modificadas
- Tests pasando/fallando
- Refactorings completados
- Bugs encontrados y resueltos

Actualízalo después de cada sesión significativa.
```

---

## 🎓 Tips de Uso

### ✅ Buenas Prácticas

1. **Carga el contexto al inicio de cada sesión:**
```
@.claude-code/agents-context.md
```

2. **Sé específico con los roles:**
```
🎨 UI Agent: [tarea específica]
```

3. **Usa referencias a archivos:**
```
Analiza @Apps/app1/main.js líneas 50-100
```

4. **Pide planes antes de implementar:**
```
Crea el plan COMPLETO antes de escribir código
```

5. **Verifica frecuentemente:**
```
Ejecuta: npm test
```

### ❌ Evita

1. ❌ "Haz todo automáticamente"
2. ❌ No dar contexto de agentes
3. ❌ Permitir modificación de archivos críticos
4. ❌ No revisar código antes de crear archivos
5. ❌ Olvidar ejecutar tests

---

## 🚀 Quick Start: Tu Primera Tarea

### En 5 Minutos

```bash
# 1. Terminal
cd Lab
code .

# 2. Terminal integrado de VSCode
claude

# 3. Copiar y pegar esto en Claude Code:
```

```
Hola! Voy a trabajar con el sistema de agentes de PlayNuzic Lab.

Lee este contexto: @.claude-code/agents-context.md

Ahora actúa como 🎨 UI Agent y analiza @Apps/app1/index.html

Dame:
1. Lista de componentes UI que usa
2. Estilo de diseño (colores, tipografía, espaciado)
3. Patrones que se repiten
4. Una sugerencia de mejora menor (ejemplo: añadir ARIA label)

Formato de respuesta: bullets concisos, sin código todavía.
```

**¡Listo! Ya estás usando los agentes con Claude Code.**

---

## 📱 Atajos de Teclado Útiles

En VSCode con Claude Code:

- `Ctrl+`` (Cmd+` Mac): Abrir/cerrar terminal
- `Alt+Ctrl+K` (Alt+Cmd+K Mac): Insertar referencia de archivo
- `Esc Esc`: Revertir último cambio
- `Ctrl+R` (Cmd+R): Buscar en historial de prompts

---

## 🎯 Resumen

Los agentes **NO son programas separados**, sino **contexto que le das a Claude Code** para que actúe de cierta manera.

**Flujo básico:**
1. Cargas el contexto de agentes: `@.claude-code/agents-context.md`
2. Especificas qué agente actúa: `🎨 UI Agent: [tarea]`
3. Claude Code trabaja según las reglas de ese agente
4. Verificas y apruebas: `npm test`

**Clave del éxito:**
- ✅ Cargar contexto al inicio
- ✅ Ser específico con roles
- ✅ Verificar constantemente
- ✅ Nunca modificar archivos críticos

---

¿Tienes alguna pregunta específica sobre cómo usar algún agente en particular?
