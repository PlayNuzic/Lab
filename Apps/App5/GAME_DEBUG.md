# Debugging del Sistema de Juego - App5

## 🐛 Problema: El botón Game no hace nada

### Pasos de debugging:

1. **Abre la consola del navegador** en App5 (F12 o Cmd+Option+I)

2. **Verifica que el sistema esté cargado:**
   ```javascript
   window.debugGame.testCompleteFlow()
   ```

   Esto mostrará:
   - ✅ Si GameManager está cargado
   - ✅ Si el botón existe
   - ✅ Si pulseSeqController está disponible
   - ✅ Intentará activar el juego

3. **Si el botón no responde, prueba manualmente:**
   ```javascript
   // Opción 1: Click programático
   window.debugGame.clickGameButton()

   // Opción 2: Disparar evento directamente
   window.debugGame.triggerGamificationEvent(true)

   // Opción 3: Iniciar juego directamente
   window.debugGame.quickStartGame()
   ```

4. **Verifica la consola para ver los logs:**
   - 🎮 `GameManager.init() starting...` - Sistema iniciándose
   - ✅ `Event listener registered` - Listener registrado
   - 🎮 `gamification_toggled event received` - Evento recibido
   - 🎮 `startGame() called` - Juego iniciándose
   - ✅ `UI shown` - Interfaz mostrada

### Diagnósticos comunes:

#### ❌ Error: "GameManager not found"
**Causa:** El GameManager no se inicializó correctamente.

**Solución:**
```javascript
// Recarga la página y verifica en consola:
// Debe aparecer: "🎮 Game system initialized"
```

#### ❌ Error: "Button not found"
**Causa:** El botón gamificationToggleBtn no existe en el DOM.

**Solución:**
```javascript
// Verifica el HTML:
document.getElementById('gamificationToggleBtn')

// Si es null, el botón no está en el template
// Verifica que showGamificationToggle: true en index.html
```

#### ❌ Error: "pulseSeqController not found"
**Causa:** La referencia al controlador no está disponible.

**Solución:**
```javascript
// Verifica que el controlador exista:
window.pulseSeqController

// Si es undefined, espera a que main.js termine de cargar
```

#### ❌ El evento no se dispara
**Causa:** El listener se registró después del click del botón.

**Solución:**
```javascript
// Usa el trigger manual:
window.debugGame.triggerGamificationEvent(true)

// O espera 200ms y vuelve a hacer click en el botón
```

### Tests Rápidos:

#### Test 1: Ver estado del botón
```javascript
const btn = document.getElementById('gamificationToggleBtn');
console.log('Pressed:', btn.getAttribute('aria-pressed'));
console.log('Classes:', btn.className);
```

#### Test 2: Toggle manual del botón
```javascript
const btn = document.getElementById('gamificationToggleBtn');
const isActive = btn.getAttribute('aria-pressed') === 'true';
btn.setAttribute('aria-pressed', (!isActive).toString());
btn.classList.toggle('active', !isActive);

// Luego dispara el evento:
window.debugGame.triggerGamificationEvent(!isActive);
```

#### Test 3: Ver estadísticas del juego
```javascript
if (window.gameManager) {
  const stats = window.gameManager.gameState.getStatsSummary();
  console.table(stats);
}
```

#### Test 4: Probar un nivel específico
```javascript
// Nivel 1
window.gameManager.loadLevel(1);
window.pulseSeqController.setText('P ( 1 3 ) Lg = 4');
await window.gameManager.validatePhase1();
```

### Comandos Útiles:

```javascript
// Ver todo el estado del juego
window.gameManager.gameState.getStatsSummary()

// Cambiar mood del personaje
window.gameManager.ui.character.setMood('happy')
window.gameManager.ui.character.animate('bounce')

// Ver niveles completados
window.gameManager.gameState.completedLevels

// Reset completo
window.gameManager.gameState.reset(false)
```

## 🎮 Comandos de Consola Completos

Todos estos comandos están disponibles a través de `window.debugGame`:

### 📋 Control del Juego

```javascript
// Verificar que GameManager está cargado
debugGame.testGameManagerLoaded()

// Verificar botón de gamificación
debugGame.testButton()

// Test completo del sistema
debugGame.testCompleteFlow()

// Click programático en botón Game
debugGame.clickGameButton()

// Trigger manual del evento de gamificación
debugGame.triggerGamificationEvent(true)  // Activar
debugGame.triggerGamificationEvent(false) // Desactivar

// Iniciar juego directamente
debugGame.quickStartGame()
```

### ⌨️ Modo de Captura (Teclado vs Micrófono)

**IMPORTANTE:** El modo por defecto es **TECLADO** (tecla ESPACIO). Es más confiable y preciso.

```javascript
// Ver modo de captura actual
debugGame.getCaptureMode()
// → Muestra: "TECLADO (⌨️)" o "MICRÓFONO (🎤)"

// Cambiar a modo TECLADO (RECOMENDADO)
debugGame.useKeyboard()
// ✅ Usa tecla ESPACIO para capturar ritmo
// 💡 Cambio se aplica en el próximo nivel

// Cambiar a modo MICRÓFONO (EXPERIMENTAL)
debugGame.useMicrophone()
// ⚠️ Puede ser impreciso según el entorno auditivo
// 💡 Cambio se aplica en el próximo nivel
```

### 🎤 Debug del Micrófono (solo si `useMicrophone()` activo)

```javascript
// Ver threshold actual del micrófono
debugGame.getThreshold()
// → Muestra: "📊 Threshold actual: -22 dB"

// Cambiar threshold manualmente (valores típicos: -15 a -30 dB)
debugGame.setThreshold(-20)
// Más negativo = más sensible (detecta más beats)
// Menos negativo = menos sensible (solo beats fuertes)

// Ver configuración completa del micrófono
debugGame.getMicStats()
// → Muestra: threshold, debounce, FFT size, etc.

// Test de 5 segundos de detección
debugGame.testMicDetection()
// Haz palmadas/taps durante 5 segundos
// Al final muestra: beats detectados, BPM estimado

// Ver análisis detallado del último intento
debugGame.getLastAnalysis()
// → Muestra: precisión, timing, consistencia, tempo
```

### 💡 Ejemplos de Uso

#### Ejemplo 1: Probar el juego con teclado (recomendado)
```javascript
// 1. Verificar modo actual
debugGame.getCaptureMode()
// → "TECLADO (⌨️)" ✅

// 2. Iniciar juego
debugGame.quickStartGame()

// 3. En Fase 2, presionar ESPACIO al ritmo
```

#### Ejemplo 2: Experimentar con micrófono
```javascript
// 1. Cambiar a modo micrófono
debugGame.useMicrophone()

// 2. Iniciar nuevo nivel
debugGame.quickStartGame()

// 3. Durante Fase 2, verificar threshold
debugGame.getThreshold()

// 4. Si detecta demasiados beats, bajar sensibilidad
debugGame.setThreshold(-18)  // Menos sensible

// 5. Si no detecta beats, subir sensibilidad
debugGame.setThreshold(-25)  // Más sensible

// 6. Ver análisis después de completar
debugGame.getLastAnalysis()
```

#### Ejemplo 3: Test de micrófono sin jugar
```javascript
// 1. Asegurarse de estar en modo micrófono
debugGame.useMicrophone()

// 2. Iniciar nivel y llegar a Fase 2
debugGame.quickStartGame()
// ... pasar Fase 1 ...

// 3. Durante Fase 2, hacer test
debugGame.testMicDetection()
// Haz palmadas durante 5 segundos

// 4. Ajustar threshold si es necesario
debugGame.setThreshold(-22)

// 5. Volver a modo teclado cuando quieras
debugGame.useKeyboard()
```

### 🔧 Solución de Problemas Comunes

#### Problema: No detecta mis teclas ESPACIO
```javascript
// Verificar que estás en modo teclado
debugGame.getCaptureMode()

// Si dice "MICRÓFONO", cambiar a teclado
debugGame.useKeyboard()

// Reintentar nivel
```

#### Problema: Micrófono detecta demasiados beats (8-9 en vez de 4)
```javascript
// Threshold muy sensible, hacerlo menos sensible
debugGame.setThreshold(-18)  // O -16, -15

// Ver configuración actual
debugGame.getMicStats()
```

#### Problema: Micrófono no detecta nada
```javascript
// Threshold poco sensible, hacerlo más sensible
debugGame.setThreshold(-28)  // O -30

// Probar con test de 5 segundos
debugGame.testMicDetection()

// Si sigue sin funcionar, mejor usar teclado
debugGame.useKeyboard()
```

#### Problema: Accuracy siempre muy baja (< 40%)
```javascript
// Ver análisis detallado
debugGame.getLastAnalysis()

// Si el problema es timing, practicar más
// Si el problema es detección, ajustar threshold o usar teclado
debugGame.useKeyboard()
```

### Si nada funciona:

1. **Recarga la página** (Cmd+R o Ctrl+R)
2. **Abre la consola ANTES de cargar**
3. **Ejecuta:**
   ```javascript
   window.debugGame.testCompleteFlow()
   ```
4. **Copia todo el output de la consola** y compártelo

### Logs esperados al cargar App5:

```
🎮 GameManager.init() starting...
✅ UI initialized
✅ UI callbacks setup
✅ Event listener registered for gamification_toggled
✅ pulseSeqController reference: found
✅ synth reference: found
✅ GameManager initialized successfully
🎮 Game system initialized
🛠️ Game debug helpers loaded. Use window.debugGame for testing.
```

Si ves estos logs, el sistema está funcionando correctamente.

### Debugging avanzado:

```javascript
// Ver todos los event listeners (Chrome)
getEventListeners(document)

// Verificar que el evento se dispara
document.addEventListener('gamification_toggled', (e) => {
  console.log('🎯 Event captured!', e.detail);
});

// Simular click real en el botón
const btn = document.getElementById('gamificationToggleBtn');
const clickEvent = new MouseEvent('click', {
  bubbles: true,
  cancelable: true,
  view: window
});
btn.dispatchEvent(clickEvent);
```

## 📋 Checklist de Verificación

- [ ] Página cargada en `http://localhost:8080/Apps/App5/`
- [ ] Consola abierta (F12)
- [ ] Log "🎮 Game system initialized" visible
- [ ] `window.gameManager` existe
- [ ] `window.debugGame` existe
- [ ] Botón Game visible en el header
- [ ] Click en botón muestra logs en consola
- [ ] Popup del juego aparece

Si todos están ✅, el sistema funciona.
Si alguno falla ❌, usa los comandos de debug de arriba.
