import { solidMenuBackground } from './utils.js';

export function initRandomMenu(button, menu, onRandomize, longPress = 500) {
  if (!button || !menu || typeof onRandomize !== 'function') return;
  let pressTimer = null;

  function toggleMenu(force) {
    const shouldOpen = typeof force === 'boolean' ? force : !menu.classList.contains('open');
    menu.classList.toggle('open', shouldOpen);
    if (shouldOpen) {
      solidMenuBackground(menu);
    }
  }

  button.addEventListener('pointerdown', () => {
    pressTimer = setTimeout(() => {
      toggleMenu();
      pressTimer = null;
    }, longPress);
  });

  button.addEventListener('pointerup', () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
      onRandomize();
    }
  });

  button.addEventListener('pointerleave', () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
  });

  document.addEventListener('pointerdown', (e) => {
    if (!menu.classList.contains('open')) return;
    if (e.target === menu || menu.contains(e.target) || e.target === button) return;
    toggleMenu(false);
  });

  window.addEventListener('sharedui:theme', () => {
    if (menu.classList.contains('open')) solidMenuBackground(menu);
  });
}
