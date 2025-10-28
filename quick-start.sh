#!/bin/bash

# 🚀 Quick Start: Agentes con Claude Code
# Este script configura todo lo necesario en 60 segundos

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Función para imprimir con estilo
print_header() {
    echo -e "\n${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${PURPLE}  $1${NC}"
    echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

print_step() {
    echo -e "${BLUE}▶${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# Banner
clear
echo -e "${PURPLE}"
cat << "EOF"
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🎭  Quick Start: Agentes con Claude Code               ║
║                                                           ║
║   Configuración automática en 60 segundos                ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}\n"

# Verificar que estamos en Lab
if [ ! -f "setup.sh" ] || [ ! -d "Apps" ]; then
    print_error "Este script debe ejecutarse desde la raíz del repositorio Lab"
    exit 1
fi

print_success "Repositorio Lab detectado"

# PASO 1: Crear estructura
print_header "PASO 1: Creando estructura de directorios"

print_step "Creando directorios..."
mkdir -p .claude-code
mkdir -p agents
mkdir -p enhancements/{responsive-styles,gamification-overlays,performance-suggestions}

print_success "Estructura creada"

# PASO 2: Crear archivo de contexto principal
print_header "PASO 2: Configurando contexto de agentes"

print_step "Creando archivo de contexto principal..."

cat > .claude-code/agents-context.md << 'CONTEXT_EOF'
# 🎭 Sistema de Agentes - PlayNuzic Lab

## Los 6 Agentes Disponibles

### 🎨 UI Agent
**Especialidad:** Diseño de interfaces, componentes UI, accesibilidad
**Usa para:** Crear componentes visuales, análisis de diseño, mejoras de UX

### 🔊 Audio Agent  
**Especialidad:** Sistema de audio, timing, sincronización
**Usa para:** Optimización de audio, debugging de timing, performance
**⚠️ CRÍTICO:** NO puede modificar clock.js, pulse-interval-calc.js, voice-sync.js

### 📱 Responsive Agent
**Especialidad:** Adaptación móvil, responsive design
**Usa para:** Media queries, touch interactions, mobile layouts

### 📦 Modules Agent
**Especialidad:** Arquitectura, código duplicado, refactoring
**Usa para:** Detectar duplicados, mejorar estructura, extracción de componentes

### 🏗️ Creator Agent
**Especialidad:** Crear nuevas apps y componentes
**Usa para:** Generar apps completas, componentes complejos, features nuevas

### 🎮 Gamification Agent
**Especialidad:** Sistema de logros, engagement
**Usa para:** Achievements, tracking de progreso, badges

---

## ⚠️ Reglas Críticas (TODAS LAS SESIONES)

### 🚫 NUNCA MODIFICAR:
- `libs/sound/clock.js` - Sistema de timing crítico
- `libs/app-common/pulse-interval-calc.js` - Cálculos de intervalos
- `libs/app-common/voice-sync.js` - Sincronización de voces

### ✅ SIEMPRE:
1. **Mostrar código ANTES de crear archivos**
2. **Esperar aprobación explícita (✅) del usuario**
3. **Crear nuevos archivos en vez de modificar existentes**
4. **Escribir tests para nuevos componentes**
5. **Ejecutar `npm test` después de cambios**
6. **Usar overlays/wrappers en vez de modificaciones directas**

### 📁 Estructura del Proyecto:

```
Lab/
├── Apps/                    # 6 apps existentes (app1-app6)
├── libs/
│   ├── app-common/         # 32+ módulos compartidos ✅
│   ├── sound/              # Audio engine
│   └── notation/           # VexFlow integration
├── agents/                 # Sistema de agentes (nuevo)
├── enhancements/           # Mejoras opcionales (nuevo)
└── tests/                  # Tests con Jest
```

---

## 🎯 Flujo de Trabajo Estándar

1. **Usuario especifica agente y tarea:**
   ```
   🎨 UI Agent: Crea componente "scale-selector"
   ```

2. **Agente analiza contexto:**
   - Lee archivos relevantes
   - Identifica patrones existentes
   - Planifica solución

3. **Agente muestra propuesta:**
   - Código completo
   - Explicación de decisiones
   - Impacto en sistema existente

4. **Usuario revisa y aprueba:**
   ```
   ✅ Aprobado, créalo
   ```
   O:
   ```
   ❌ Cambia [aspecto específico]
   ```

5. **Agente implementa:**
   - Crea archivos
   - Ejecuta tests
   - Reporta resultados

6. **Verificación:**
   ```bash
   npm test
   cd agents && npm run verify
   ```

---

## 🔄 Ejemplo de Conversación

**Usuario:**
```
Hola! Lee este contexto: @.claude-code/agents-context.md
Confirma que entiendes los 6 agentes y las reglas.
```

**Claude Code:**
```
¡Entendido! He leído el contexto. Confirmo que comprendo:
- Los 6 agentes: UI, Audio, Responsive, Modules, Creator, Gamification
- Archivos críticos que NO deben modificarse
- Proceso: mostrar → esperar ✅ → crear
¿Con qué agente empezamos?
```

**Usuario:**
```
🎨 UI Agent: Analiza @Apps/app1/ y dame resumen de componentes UI
```

---

## 💡 Templates Rápidos

### Crear Componente
```
🎨 UI Agent: Crea componente "[nombre]"

1. Analiza componentes similares en @libs/app-common/
2. Muéstrame el código completo
3. Espera mi ✅
4. Crea archivo + tests
```

### Debugging
```
🔊 Audio Agent: Debug problema en @[archivo]

Síntomas: [descripción]
NO tocar: clock.js, pulse-interval-calc.js
Propón fix sin modificar archivos críticos
```

### Nueva App
```
🏗️ Creator Agent: Plan para app[N]-[nombre]

Concepto: [descripción]
Proceso:
1. Analiza estructura existente
2. Lista componentes a reutilizar
3. Crea plan detallado
4. Espera mi ✅
5. Implementa paso a paso
```

---

## 🎨 Filosofía de PlayNuzic Lab

- **Minimalismo**: UI limpia, código simple
- **Reutilización**: ~70% código compartido
- **No invasión**: Nunca romper lo existente
- **Testing**: 280+ tests deben pasar siempre

---

**Este archivo define cómo Claude Code debe trabajar con el proyecto PlayNuzic Lab usando el sistema de agentes.**
CONTEXT_EOF

print_success "Contexto de agentes creado"

# PASO 3: Crear archivo de configuración YAML
print_step "Creando configuración de integración..."

cat > .claude-code/integration-config.yaml << 'YAML_EOF'
name: PlayNuzic-Lab-Agent-Integration
version: 1.0.0
mode: non-invasive

preserve:
  - browser_clock_system: true
  - pulse_interval_calculations: true
  - voice_sync_cycles: true
  - minimalist_aesthetic: true
  - existing_module_structure: true

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

rules:
  - never_modify_existing_files: true
  - always_preserve_clock_system: true
  - maintain_calculation_compatibility: true
  - respect_minimalist_design: true
  - overlay_not_replace: true
  - suggest_not_impose: true
  - learn_from_existing: true
  - test_before_suggest: true
YAML_EOF

print_success "Configuración creada"

# PASO 4: Crear orchestrator básico
print_header "PASO 3: Creando orchestrator de agentes"

print_step "Generando orchestrator.js..."

cat > agents/orchestrator.js << 'ORCHESTRATOR_EOF'
#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PlayNuzicLabOrchestrator {
  constructor() {
    console.log('🎭 PlayNuzic Lab Agent Orchestrator v1.0.0\n');
  }

  async analyze() {
    console.log('📊 Analizando repositorio...\n');
    
    const appsDir = path.join(__dirname, '..', 'Apps');
    const apps = fs.readdirSync(appsDir)
      .filter(name => name.startsWith('app') || name.startsWith('App'));
    
    console.log(`✅ ${apps.length} apps encontradas:`);
    apps.forEach(app => console.log(`   - ${app}`));
    
    const libsDir = path.join(__dirname, '..', 'libs', 'app-common');
    if (fs.existsSync(libsDir)) {
      const modules = fs.readdirSync(libsDir)
        .filter(name => name.endsWith('.js') && !name.includes('.test.'));
      console.log(`\n✅ ${modules.length} módulos compartidos en libs/app-common/`);
    }
    
    return { apps, status: 'ok' };
  }

  async verify() {
    console.log('🔍 Verificando integridad del sistema...\n');
    
    const checks = {
      structure: this.checkStructure(),
      apps: this.checkApps(),
      config: this.checkConfig()
    };
    
    const allPassed = Object.values(checks).every(c => c.passed);
    
    console.log('\n📋 Resultados:');
    Object.entries(checks).forEach(([name, result]) => {
      const icon = result.passed ? '✅' : '❌';
      console.log(`${icon} ${name}: ${result.message}`);
    });
    
    if (allPassed) {
      console.log('\n✅ Sistema verificado correctamente\n');
    } else {
      console.log('\n⚠️  Hay problemas que revisar\n');
    }
    
    return checks;
  }

  checkStructure() {
    const required = ['Apps', 'libs', 'agents', '.claude-code'];
    const missing = required.filter(dir => 
      !fs.existsSync(path.join(__dirname, '..', dir))
    );
    
    return {
      passed: missing.length === 0,
      message: missing.length === 0 
        ? 'Estructura correcta' 
        : `Faltan: ${missing.join(', ')}`
    };
  }

  checkApps() {
    const appsDir = path.join(__dirname, '..', 'Apps');
    if (!fs.existsSync(appsDir)) {
      return { passed: false, message: 'Directorio Apps no encontrado' };
    }
    
    const apps = fs.readdirSync(appsDir)
      .filter(name => name.startsWith('app') || name.startsWith('App'));
    
    return {
      passed: apps.length >= 4,
      message: `${apps.length} apps encontradas`
    };
  }

  checkConfig() {
    const configPath = path.join(__dirname, '..', '.claude-code', 'agents-context.md');
    return {
      passed: fs.existsSync(configPath),
      message: fs.existsSync(configPath) 
        ? 'Configuración presente' 
        : 'Configuración no encontrada'
    };
  }

  showHelp() {
    console.log(`
Uso: node orchestrator.js [comando]

Comandos:
  analyze   - Analizar el repositorio
  verify    - Verificar integridad del sistema
  help      - Mostrar esta ayuda

Ejemplos:
  node orchestrator.js analyze
  node orchestrator.js verify
    `);
  }
}

const orchestrator = new PlayNuzicLabOrchestrator();
const command = process.argv[2] || 'help';

switch (command) {
  case 'analyze':
    await orchestrator.analyze();
    break;
  case 'verify':
    await orchestrator.verify();
    break;
  default:
    orchestrator.showHelp();
}
ORCHESTRATOR_EOF

chmod +x agents/orchestrator.js
print_success "Orchestrator creado"

# PASO 5: Crear package.json
print_step "Creando package.json..."

cat > agents/package.json << 'PKG_EOF'
{
  "name": "playnuzic-lab-agents",
  "version": "1.0.0",
  "description": "Sistema de agentes para PlayNuzic Lab",
  "type": "module",
  "main": "orchestrator.js",
  "scripts": {
    "analyze": "node orchestrator.js analyze",
    "verify": "node orchestrator.js verify"
  },
  "keywords": ["playnuzic", "agents", "ai"],
  "author": "PlayNuzic",
  "license": "MIT"
}
PKG_EOF

print_success "package.json creado"

# PASO 6: Crear README para agentes
print_step "Creando README..."

cat > agents/README.md << 'README_EOF'
# 🎭 Agentes PlayNuzic Lab

Sistema de agentes para trabajar con Claude Code de manera no invasiva.

## Uso

```bash
# Analizar repositorio
npm run analyze

# Verificar integridad
npm run verify
```

## Con Claude Code

```bash
# En VSCode
claude

# En la conversación
Lee el contexto: @.claude-code/agents-context.md
```

## Agentes Disponibles

- 🎨 UI Agent - Diseño e interfaces
- 🔊 Audio Agent - Sistema de audio
- 📱 Responsive Agent - Adaptación móvil
- 📦 Modules Agent - Arquitectura
- 🏗️ Creator Agent - Nuevas apps
- 🎮 Gamification Agent - Logros

Ver documentación completa en `.claude-code/agents-context.md`
README_EOF

print_success "README creado"

# PASO 7: Instalar dependencias
print_header "PASO 4: Instalando dependencias"

print_step "Instalando packages..."
cd agents
npm install --silent > /dev/null 2>&1
cd ..
print_success "Dependencias instaladas"

# PASO 8: Crear script de inicio rápido
print_header "PASO 5: Creando script de inicio rápido"

print_step "Creando start-claude-code.sh..."

cat > start-claude-code.sh << 'START_EOF'
#!/bin/bash

# Script de inicio rápido para Claude Code

echo "🚀 Iniciando Claude Code con contexto de agentes..."
echo ""

# Verificar que estamos en Lab
if [ ! -d ".claude-code" ]; then
    echo "❌ Error: Ejecuta este script desde la raíz de Lab"
    exit 1
fi

# Verificar que Claude Code está instalado
if ! command -v claude &> /dev/null; then
    echo "⚠️  Claude Code no está instalado"
    echo ""
    echo "Instala con:"
    echo "  npm install -g @anthropic-ai/claude-code"
    echo ""
    exit 1
fi

# Mensaje de bienvenida
echo "📝 Prompt sugerido para copiar/pegar:"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Hola! Lee el contexto de agentes:"
echo "@.claude-code/agents-context.md"
echo ""
echo "Confirma que entiendes:"
echo "- Los 6 agentes (🎨🔊📱📦🏗️🎮)"
echo "- Archivos críticos (NO tocar)"
echo "- Proceso: Mostrar código → ✅ → Crear"
echo ""
echo "¿Con qué agente empezamos?"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Presiona ENTER para iniciar Claude Code..."
read

# Iniciar Claude Code
claude
START_EOF

chmod +x start-claude-code.sh
print_success "Script de inicio creado"

# PASO 9: Verificación final
print_header "PASO 6: Verificación final"

print_step "Ejecutando verificación..."
cd agents
npm run verify > /dev/null 2>&1
cd ..
print_success "Verificación completada"

# PASO 10: Resumen
print_header "✅ ¡Instalación Completada!"

echo -e "${GREEN}Todo listo para usar los agentes con Claude Code${NC}\n"

echo -e "${YELLOW}📁 Archivos creados:${NC}"
echo "   .claude-code/agents-context.md"
echo "   .claude-code/integration-config.yaml"
echo "   agents/orchestrator.js"
echo "   agents/package.json"
echo "   agents/README.md"
echo "   start-claude-code.sh"

echo -e "\n${YELLOW}🚀 Próximos pasos:${NC}"
echo ""
echo "   1️⃣  Probar los agentes:"
echo "      ${BLUE}cd agents && npm run analyze${NC}"
echo ""
echo "   2️⃣  Iniciar Claude Code:"
echo "      ${BLUE}./start-claude-code.sh${NC}"
echo ""
echo "   3️⃣  O manualmente en VSCode:"
echo "      ${BLUE}code .${NC}"
echo "      Luego en terminal integrado: ${BLUE}claude${NC}"
echo ""

echo -e "${YELLOW}📚 Documentación:${NC}"
echo "   - Contexto agentes: .claude-code/agents-context.md"
echo "   - README agentes: agents/README.md"
echo ""

echo -e "${YELLOW}💡 Primer prompt sugerido:${NC}"
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "   Hola! Lee el contexto:"
echo "   @.claude-code/agents-context.md"
echo ""
echo "   Confirma que entiendes los 6 agentes y las reglas."
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${GREEN}¡Listo para trabajar con agentes inteligentes! 🎉${NC}\n"
