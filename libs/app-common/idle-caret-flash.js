// libs/app-common/idle-caret-flash.js
// One-shot triple-flash on the main interactive element after 5s of inactivity.
// Fires once at startup as a UX hint, then auto-cleans up.
// Designed to work inside iframes (WordPress embeds).

const IDLE_TIMEOUT = 5000;
const FLASH_CLASS = 'idle-caret-flash';
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'wheel'];

/**
 * Watches for user inactivity and triggers a triple flash on the
 * primary interactive target (BPM circle, pulse-seq, etc.).
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
  let fired = false;

  function triggerFlash() {
    timer = null;
    fired = true;
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
      // One-shot: auto-cleanup after flash completes
      if (fired) handle.destroy();
    }
  }

  function resetTimer() {
    if (fired) return;
    if (timer) { clearTimeout(timer); timer = null; }
    for (const t of targets) {
      t.classList.remove(FLASH_CLASS);
    }
    if (hidden) return;
    timer = setTimeout(triggerFlash, IDLE_TIMEOUT);
  }

  function onVisibility() {
    hidden = document.visibilityState === 'hidden';
    if (hidden) {
      if (timer) { clearTimeout(timer); timer = null; }
    } else {
      resetTimer();
    }
  }

  for (const t of targets) {
    t.addEventListener('animationend', onFlashEnd);
  }

  for (const evt of ACTIVITY_EVENTS) {
    document.addEventListener(evt, resetTimer, { passive: true, capture: true });
  }

  document.addEventListener('visibilitychange', onVisibility);

  window.addEventListener('focus', resetTimer);
  blurHandler = () => { if (timer) { clearTimeout(timer); timer = null; } };
  window.addEventListener('blur', blurHandler);

  // Start first cycle
  resetTimer();

  const handle = {
    destroy() {
      if (timer) clearTimeout(timer);
      for (const evt of ACTIVITY_EVENTS) {
        document.removeEventListener(evt, resetTimer, { capture: true });
      }
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', resetTimer);
      window.removeEventListener('blur', blurHandler);
      for (const t of targets) {
        t.removeEventListener('animationend', onFlashEnd);
        t.classList.remove(FLASH_CLASS);
      }
    }
  };

  return handle;
}
