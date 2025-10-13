# Configuración del Servidor Local

## ⚠️ IMPORTANTE: Servir desde Lab (no desde Indexlab)

Todo el desarrollo de Phase 2b está en **Lab**, por lo tanto el servidor HTTP debe servir desde `/Users/workingburcet/Lab`.

## Opción 1: VSCode Live Server (Recomendado)

Si usas la extensión **Live Server** de VSCode:

1. **Cierra** cualquier servidor activo desde Indexlab
2. En VSCode, abre la carpeta `/Users/workingburcet/Lab`
3. Click derecho en cualquier `index.html` de `apps/app2/` o similar
4. Selecciona **"Open with Live Server"**
5. Se abrirá en `http://127.0.0.1:5500/apps/appX/index.html`

### Verificar que estás en Lab:

Abre la consola del navegador y ejecuta:
```javascript
// Debe mostrar la ruta de Lab
console.log(window.location.href);
// Ejemplo: http://127.0.0.1:5500/apps/app2/index.html

// Verifica que audio-capture está disponible
const { checkSupport } = await import('../../libs/audio-capture/index.js');
console.log('✅ Audio Capture disponible:', checkSupport());
```

## Opción 2: npx http-server (Manual)

Desde la terminal en Lab:

```bash
cd /Users/workingburcet/Lab
npx http-server -p 8080 -c-1
```

Luego abre: `http://localhost:8080/apps/app2/index.html`

### Parámetros:
- `-p 8080`: Puerto 8080
- `-c-1`: Desactiva caché (importante para ver cambios inmediatos)

## Verificación Rápida

Después de iniciar el servidor desde Lab, verifica en consola:

```javascript
// Test 1: Verificar módulo disponible
const { checkSupport } = await import('../../libs/audio-capture/index.js');
const support = checkSupport();
console.log('Soporte:', support);
// ✅ Debe mostrar: { microphone: true, keyboard: true, overall: true }

// Test 2: Test rápido de teclado
const { createKeyboardCapture } = await import('../../libs/audio-capture/index.js');
const kbd = createKeyboardCapture();
kbd.startRecording();
console.log('⌨️ Presiona ESPACIO 5 veces en 5 segundos...');
setTimeout(() => {
  const taps = kbd.stopRecording();
  console.log(`✅ Detectados ${taps.length} taps:`, taps);
}, 5000);
```

## Errores Comunes

### Error: "Failed to resolve module specifier"

**Causa:** Estás sirviendo desde Indexlab (no tiene Phase 2b)

**Solución:**
1. Detén el servidor actual
2. Inicia servidor desde `/Users/workingburcet/Lab`
3. Recarga la página

### Error: "Cannot use import statement outside a module"

**Causa:** Estás usando `import` estático en consola

**Solución:** Usa dynamic import con `await`:
```javascript
// ❌ NO funciona en consola
import { checkSupport } from '../../libs/audio-capture/index.js';

// ✅ SÍ funciona en consola
const { checkSupport } = await import('../../libs/audio-capture/index.js');
```

## Estructura de URLs

Cuando sirves desde Lab correctamente:

```
http://127.0.0.1:5500/
├── apps/
│   ├── app2/index.html  → http://127.0.0.1:5500/apps/app2/index.html
│   ├── app3/index.html  → http://127.0.0.1:5500/apps/app3/index.html
│   ├── app4/index.html  → http://127.0.0.1:5500/apps/app4/index.html
│   └── app5/index.html  → http://127.0.0.1:5500/apps/app5/index.html
├── libs/
│   ├── audio-capture/   → ✅ Disponible
│   ├── gamification/    → ✅ Disponible
│   └── sound/
│       └── tone-loader.js → ✅ Disponible
└── shared/
```

## Documentación Disponible (en Lab)

Una vez sirviendo desde Lab, tienes acceso a:

1. **[CONSOLE_COMMANDS.md](CONSOLE_COMMANDS.md)** - Referencia completa con desplegables
2. **[AUDIO_CAPTURE_TESTING.md](AUDIO_CAPTURE_TESTING.md)** - 12 tests detallados
3. **[GAMIFICATION_PLAN.md](GAMIFICATION_PLAN.md)** - Plan completo de gamificación
4. **[GAMIFICATION_PROGRESS.md](GAMIFICATION_PROGRESS.md)** - Estado de implementación

---

## TL;DR

```bash
# 1. Ir a Lab
cd /Users/workingburcet/Lab

# 2. Iniciar servidor
npx http-server -p 8080 -c-1

# 3. Abrir en navegador
# http://localhost:8080/apps/app2/index.html

# 4. Verificar en consola
# const { checkSupport } = await import('../../libs/audio-capture/index.js');
# console.log(checkSupport());
```

✅ **Ahora las apps servirán el código de Phase 2b correctamente**
