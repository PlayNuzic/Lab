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

// Export all functions to window for easy console access
if (typeof window !== 'undefined') {
  window.debugGame = {
    testGameManagerLoaded,
    testButton,
    triggerGamificationEvent,
    testCompleteFlow,
    clickGameButton,
    checkEventListeners,
    quickStartGame
  };

  console.log('🎮 Debug functions loaded! Available in window.debugGame:');
  console.log('  - testGameManagerLoaded()');
  console.log('  - testButton()');
  console.log('  - triggerGamificationEvent(enabled)');
  console.log('  - testCompleteFlow()');
  console.log('  - clickGameButton()');
  console.log('  - quickStartGame()');
  console.log('\nQuick test: window.debugGame.testCompleteFlow()');
}
