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

// Forzar modo teclado
window.gameForceKeyboard = true

// Ver niveles completados
window.gameManager.gameState.completedLevels

// Reset completo
window.gameManager.gameState.reset(false)
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
