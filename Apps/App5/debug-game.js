/**
 * Debug helper script for Game System
 * Load this in console to test game functionality
 */

// Test if GameManager is loaded
export function testGameManagerLoaded() {
  console.log('🔍 Checking GameManager...');
  console.log('window.gameManager:', window.gameManager);
  console.log('Is initialized:', !!window.gameManager);
  return !!window.gameManager;
}

// Test gamification button
export function testButton() {
  console.log('🔍 Testing gamification button...');
  const btn = document.getElementById('gamificationToggleBtn');
  console.log('Button found:', !!btn);
  if (btn) {
    console.log('Button aria-pressed:', btn.getAttribute('aria-pressed'));
    console.log('Button classes:', btn.className);
  }
  return btn;
}

// Manually trigger gamification event
export function triggerGamificationEvent(enabled = true) {
  console.log('🎮 Manually dispatching gamification_toggled event...');
  const event = new CustomEvent('gamification_toggled', {
    detail: {
      enabled,
      timestamp: Date.now()
    }
  });
  document.dispatchEvent(event);
  console.log('✅ Event dispatched');
}

// Test complete flow
export function testCompleteFlow() {
  console.log('🧪 Testing complete flow...');

  console.log('\n1️⃣ Check GameManager');
  const hasGameManager = testGameManagerLoaded();

  console.log('\n2️⃣ Check Button');
  const btn = testButton();

  console.log('\n3️⃣ Check pulseSeqController');
  console.log('window.pulseSeqController:', window.pulseSeqController);

  console.log('\n4️⃣ Trigger event manually');
  triggerGamificationEvent(true);

  console.log('\n✅ Test complete - check above output');
}

// Click button programmatically
export function clickGameButton() {
  console.log('🖱️ Clicking game button programmatically...');
  const btn = document.getElementById('gamificationToggleBtn');
  if (btn) {
    btn.click();
    console.log('✅ Button clicked');
  } else {
    console.error('❌ Button not found');
  }
}

// Check event listeners
export function checkEventListeners() {
  console.log('🔍 Checking event listeners on document...');

  // This is a hack to check if listeners exist
  // Modern browsers don't expose listeners directly
  console.log('Note: Cannot directly check event listeners in browser');
  console.log('Try calling triggerGamificationEvent(true) to test if listener works');
}

// Quick start game
export function quickStartGame() {
  console.log('🚀 Quick starting game...');
  if (window.gameManager) {
    window.gameManager.startGame();
  } else {
    console.error('❌ GameManager not found');
  }
}

// Get current microphone threshold
export function getThreshold() {
  console.log('🎤 Getting current threshold...');
  const manager = window.gameManager;
  if (!manager || !manager.audioCapture) {
    console.warn('⚠️ Game manager o audioCapture no disponible');
    console.log('Asegúrate de estar en Fase 2 de un nivel');
    return null;
  }
  const threshold = manager.audioCapture.config?.threshold;
  console.log(`📊 Threshold actual: ${threshold} dB`);
  return threshold;
}

// Set new microphone threshold
export function setThreshold(newThreshold) {
  console.log(`🎤 Setting threshold to ${newThreshold} dB...`);
  const manager = window.gameManager;
  if (!manager || !manager.audioCapture) {
    console.warn('⚠️ Game manager o audioCapture no disponible');
    console.log('Asegúrate de estar en Fase 2 de un nivel');
    return;
  }
  const oldThreshold = manager.audioCapture.config.threshold;
  manager.audioCapture.config.threshold = newThreshold;
  console.log(`✅ Threshold cambiado: ${oldThreshold} dB → ${newThreshold} dB`);
  console.log('⚠️ Este cambio solo afecta a la captura actual');
}

// Get last analysis from localStorage
export function getLastAnalysis() {
  console.log('📊 Getting last rhythm analysis...');
  const manager = window.gameManager;
  if (!manager || !manager.gameState) {
    console.warn('⚠️ Game manager no disponible');
    return null;
  }

  const attempts = manager.gameState.attempts;
  if (attempts.length === 0) {
    console.log('No hay intentos registrados todavía');
    return null;
  }

  const lastAttempt = attempts[attempts.length - 1];
  console.log('\n📈 Último intento:');
  console.log(`   Ejercicio: ${lastAttempt.exerciseId}`);
  console.log(`   Timestamp: ${new Date(lastAttempt.timestamp).toLocaleString()}`);
  console.log(`   Patrón esperado: ${lastAttempt.pattern}`);
  console.log(`   Beats esperados: ${lastAttempt.expectedBeats.length}`);
  console.log(`   Beats capturados: ${lastAttempt.userBeats.length}`);
  console.log('\n📊 Análisis:');
  console.log(`   Precisión: ${(lastAttempt.analysis.accuracy * 100).toFixed(1)}%`);
  console.log(`   Timing: ${(lastAttempt.analysis.scores.timing * 100).toFixed(1)}%`);
  console.log(`   Consistencia: ${(lastAttempt.analysis.scores.consistency * 100).toFixed(1)}%`);
  console.log(`   Tempo: ${(lastAttempt.analysis.scores.tempo * 100).toFixed(1)}%`);

  return lastAttempt;
}

// Get microphone stats
export function getMicStats() {
  console.log('🎤 Getting microphone stats...');
  const manager = window.gameManager;
  if (!manager || !manager.audioCapture) {
    console.warn('⚠️ Game manager o audioCapture no disponible');
    console.log('Asegúrate de estar en Fase 2 de un nivel');
    return null;
  }

  const mic = manager.audioCapture;
  console.log('\n📊 Configuración del micrófono:');
  console.log(`   Threshold: ${mic.config.threshold} dB`);
  console.log(`   Debounce: ${mic.config.debounceMs} ms`);
  console.log(`   FFT Size: ${mic.config.fftSize}`);
  console.log(`   Smooth Factor: ${mic.config.smoothingTimeConstant}`);

  if (mic.isInitialized) {
    console.log('\n✅ Estado: Inicializado y activo');
  } else {
    console.log('\n⚠️ Estado: No inicializado');
  }

  return mic.config;
}

// Test microphone detection for 5 seconds
export async function testMicDetection() {
  console.log('🎤 Testing microphone beat detection for 5 seconds...');
  console.log('Haz algunos sonidos (palmadas, taps, etc.)');

  const manager = window.gameManager;
  if (!manager || !manager.audioCapture) {
    console.warn('⚠️ Game manager o audioCapture no disponible');
    console.log('Asegúrate de estar en Fase 2 de un nivel');
    return;
  }

  const mic = manager.audioCapture;
  const detectedBeats = [];

  // Set up temporary beat listener
  const originalCallback = mic.onBeatCallback;
  mic.onBeatCallback = (timestamp) => {
    detectedBeats.push(timestamp);
    console.log(`🎵 Beat detectado! Total: ${detectedBeats.length}`);
  };

  console.log('⏱️ Iniciando test de 5 segundos...');

  // Wait 5 seconds
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Restore original callback
  mic.onBeatCallback = originalCallback;

  console.log('\n✅ Test completado!');
  console.log(`📊 Beats detectados: ${detectedBeats.length}`);
  if (detectedBeats.length > 1) {
    const intervals = [];
    for (let i = 1; i < detectedBeats.length; i++) {
      intervals.push(detectedBeats[i] - detectedBeats[i-1]);
    }
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const estimatedBPM = Math.round(60000 / avgInterval);
    console.log(`📈 Intervalo promedio: ${avgInterval.toFixed(0)} ms`);
    console.log(`🎵 BPM estimado: ${estimatedBPM}`);
  }

  return detectedBeats;
}

// Export all functions to window for easy console access
if (typeof window !== 'undefined') {
  window.debugGame = {
    testGameManagerLoaded,
    testButton,
    triggerGamificationEvent,
    testCompleteFlow,
    clickGameButton,
    checkEventListeners,
    quickStartGame,
    getThreshold,
    setThreshold,
    getLastAnalysis,
    getMicStats,
    testMicDetection
  };

  console.log('🎮 Debug functions loaded! Available in window.debugGame:');
  console.log('\n📋 Game Controls:');
  console.log('  - testGameManagerLoaded()');
  console.log('  - testButton()');
  console.log('  - triggerGamificationEvent(enabled)');
  console.log('  - testCompleteFlow()');
  console.log('  - clickGameButton()');
  console.log('  - quickStartGame()');
  console.log('\n🎤 Microphone Debug (use during Phase 2):');
  console.log('  - getThreshold() - Ver threshold actual');
  console.log('  - setThreshold(dB) - Cambiar threshold (ej: -20)');
  console.log('  - getMicStats() - Ver configuración del micrófono');
  console.log('  - testMicDetection() - Test de 5 segundos');
  console.log('  - getLastAnalysis() - Ver último análisis de ritmo');
  console.log('\n🚀 Quick test: window.debugGame.testCompleteFlow()');
}
