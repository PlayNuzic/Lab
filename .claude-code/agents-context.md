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
