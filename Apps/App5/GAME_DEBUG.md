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

#### Test 4: Probar niveles específicos

**IMPORTANTE**: El juego siempre empieza en Nivel 1. Estos tests son para debugging.

##### Nivel 1: Posiciones Impares
```javascript
// Cargar nivel
window.gameManager.loadLevel(1);

// Solución correcta: 1, 3
window.pulseSeqController.setText('P ( 1 3 ) Lg = 4');
await window.gameManager.validatePhase1();
// ✅ Debería pasar a Fase 2

// Solución incorrecta (para probar)
window.pulseSeqController.setText('P ( 2 4 ) Lg = 4');
await window.gameManager.validatePhase1();
// ❌ Debería mostrar popup de reintentar
```

##### Nivel 2: Posiciones Pares
```javascript
// Cargar nivel
window.gameManager.loadLevel(2);

// Solución correcta: 2, 4
window.pulseSeqController.setText('P ( 2 4 ) Lg = 4');
await window.gameManager.validatePhase1();
// ✅ Debería pasar a Fase 2

// Solución incorrecta (para probar)
window.pulseSeqController.setText('P ( 1 3 ) Lg = 4');
await window.gameManager.validatePhase1();
// ❌ Debería mostrar popup de reintentar
```

##### Nivel 3: Dinámico (Aleatorio)
```javascript
// Cargar nivel (se genera aleatoriamente cada vez)
window.gameManager.loadLevel(3);

// Ver el requisito actual
console.log('Requisito:', window.gameManager.currentLevel.requirement);
console.log('Lg:', window.gameManager.currentLevel.lg);
console.log('BPM:', window.gameManager.currentLevel.bpm);

// Ejemplo: Si el requisito es "Escribe 2 P impares" y Lg=6
// Solución correcta: 1, 3 (o 1, 5 o 3, 5)
window.pulseSeqController.setText('P ( 1 3 ) Lg = 6');
await window.gameManager.validatePhase1();

// NOTA: La solución depende del requisito aleatorio generado
// Tipos posibles: impares, pares, consecutivos, extremos
```

##### Nivel 4: Modo Libre
```javascript
// Cargar nivel
window.gameManager.loadLevel(4);

// Cualquier patrón con 2-8 posiciones es válido
window.pulseSeqController.setText('P ( 1 2 5 7 ) Lg = 8');
await window.gameManager.validatePhase1();
// ✅ Siempre pasa (modo libre)

// Probar con diferentes patrones
window.pulseSeqController.setText('P ( 1 4 6 8 ) Lg = 8');
await window.gameManager.validatePhase1();
// ✅ También válido

// Mínimo 2 posiciones
window.pulseSeqController.setText('P ( 3 7 ) Lg = 8');
await window.gameManager.validatePhase1();
// ✅ Válido
```

##### Test Completo de Todos los Niveles
```javascript
// Test secuencial de todos los niveles
async function testAllLevels() {
  console.log('🧪 Testing all levels...\n');

  // Nivel 1
  console.log('📝 Level 1: Odd positions');
  window.gameManager.loadLevel(1);
  window.pulseSeqController.setText('P ( 1 3 ) Lg = 4');
  await window.gameManager.validatePhase1();
  console.log('✅ Level 1 validated\n');

  // Esperar un poco entre niveles
  await new Promise(r => setTimeout(r, 1000));

  // Nivel 2
  console.log('📝 Level 2: Even positions');
  window.gameManager.loadLevel(2);
  window.pulseSeqController.setText('P ( 2 4 ) Lg = 4');
  await window.gameManager.validatePhase1();
  console.log('✅ Level 2 validated\n');

  await new Promise(r => setTimeout(r, 1000));

  // Nivel 3 (dinámico - usar primera solución posible)
  console.log('📝 Level 3: Dynamic');
  window.gameManager.loadLevel(3);
  const level3 = window.gameManager.currentLevel;
  console.log('  Requirement:', level3.requirement);
  console.log('  Lg:', level3.lg, 'BPM:', level3.bpm);
  // Para test automático, usar hint positions si existen
  const hintPositions = window.gameManager.currentLevel.solution || [1, 2];
  window.pulseSeqController.setText(`P ( ${hintPositions.join(' ')} ) Lg = ${level3.lg}`);
  await window.gameManager.validatePhase1();
  console.log('✅ Level 3 validated\n');

  await new Promise(r => setTimeout(r, 1000));

  // Nivel 4 (libre)
  console.log('📝 Level 4: Free mode');
  window.gameManager.loadLevel(4);
  window.pulseSeqController.setText('P ( 1 3 5 7 ) Lg = 8');
  await window.gameManager.validatePhase1();
  console.log('✅ Level 4 validated\n');

  console.log('🎉 All levels tested successfully!');
}

// Ejecutar test
testAllLevels();
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
