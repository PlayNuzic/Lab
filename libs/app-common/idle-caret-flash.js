// libs/app-common/idle-caret-flash.js
// Repeating flash on the main interactive element after inactivity.
// Keeps flashing every cycle until user interacts, then stops permanently.
// Designed to work inside iframes (WordPress embeds).

const IDLE_TIMEOUT = 5000;
const FLASH_CLASS = 'idle-caret-flash';
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'wheel'];

/**
 * Watches for user inactivity and triggers a repeating flash on the
 * primary interactive target (BPM circle, pulse-seq, etc.).
 * Stops permanently on first user interaction.
 *
 * @param {Object} config
 * @param {HTMLElement[]} config.targets - Elements to flash (e.g. .circle, #pulseSeq)
 * @returns {{ destroy: Function }} cleanup handle
 */
export function initIdleCaretFlash({ targets = [] } = {}) {
  if (!targets.length) return { destroy() {} };

  let timer = null;
  let hidden = false;
  let blurHandler = null;
  let destroyed = false;

  function triggerFlash() {
    timer = null;
    if (destroyed) return;
    for (const t of targets) {
      if (!t.isConnected) continue;
      t.classList.remove(FLASH_CLASS);
      void t.offsetWidth;
      t.classList.add(FLASH_CLASS);
    }
  }

  function onFlashEnd(e) {
    if (e.animationName === 'idleCaretFlash') {
      e.currentTarget.classList.remove(FLASH_CLASS);
      // Schedule next flash cycle (unless destroyed by interaction)
      if (!destroyed) {
        timer = setTimeout(triggerFlash, IDLE_TIMEOUT);
      }
    }
  }

  function cancelOnInteraction() {
    // First interaction: destroy permanently
    handle.destroy();
  }

  function onVisibility() {
    hidden = document.visibilityState === 'hidden';
    if (hidden) {
      if (timer) { clearTimeout(timer); timer = null; }
    } else if (!destroyed) {
      if (timer) { clearTimeout(timer); timer = null; }
      timer = setTimeout(triggerFlash, IDLE_TIMEOUT);
    }
  }

  for (const t of targets) {
    t.addEventListener('animationend', onFlashEnd);
  }

  for (const evt of ACTIVITY_EVENTS) {
    document.addEventListener(evt, cancelOnInteraction, { passive: true, capture: true });
  }

  document.addEventListener('visibilitychange', onVisibility);

  window.addEventListener('focus', () => {
    if (!destroyed && !timer) {
      timer = setTimeout(triggerFlash, IDLE_TIMEOUT);
    }
  });
  blurHandler = () => { if (timer) { clearTimeout(timer); timer = null; } };
  window.addEventListener('blur', blurHandler);

  // Start first cycle
  timer = setTimeout(triggerFlash, IDLE_TIMEOUT);

  const handle = {
    destroy() {
      destroyed = true;
      if (timer) { clearTimeout(timer); timer = null; }
      for (const evt of ACTIVITY_EVENTS) {
        document.removeEventListener(evt, cancelOnInteraction, { capture: true });
      }
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', blurHandler);
      for (const t of targets) {
        t.removeEventListener('animationend', onFlashEnd);
        t.classList.remove(FLASH_CLASS);
      }
    }
  };

  return handle;
}
