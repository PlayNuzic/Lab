import { solidMenuBackground } from '../app-common/utils.js';

/**
 * Notation panel controller shared by rhythm apps.
 * Handles toggle button, focus management, accessibility and global events.
 */

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

function isVisible(element) {
  if (!element) return false;
  if (element.hidden) return false;
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  if (element.offsetParent !== null) return true;
  return style.position === 'fixed';
}

function getFocusableElements(container) {
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR))
    .filter(el => isVisible(el) && !el.hasAttribute('aria-hidden'));
}

export function createNotationPanelController({
  toggleButton,
  panel,
  closeButton,
  appId,
  onOpen,
  onClose
} = {}) {
  if (!toggleButton || !panel) return null;

  const dialog = panel.querySelector('.notation-panel__dialog') || panel;
  const closeTriggers = Array.from(panel.querySelectorAll('[data-notation-close]'));
  const isInline = panel.dataset?.notationInline === 'true' || panel.classList.contains('notation-panel--inline');
  let isOpen = false;
  let lastFocusedElement = null;
  const detailBase = { appId };

  const canvasEl = panel.querySelector('.notation-panel__canvas');
  const backgroundTargets = (isInline ? [] : [dialog])
    .filter((el, index, list) => el && list.indexOf(el) === index);

  function applySolidBackground() {
    backgroundTargets.forEach((target) => solidMenuBackground(target));
    if (canvasEl) {
      canvasEl.style.removeProperty('background-image');
      const rootStyles = getComputedStyle(document.documentElement);
      const textColor = rootStyles.getPropertyValue('--text-light').trim() || '#43433B';
      canvasEl.style.backgroundColor = '#ffffff';
      canvasEl.style.color = textColor;
    }
  }

  function dispatch(open, extras = {}) {
    try {
      window.dispatchEvent(new CustomEvent('sharedui:notationtoggle', {
        detail: { ...detailBase, open, source: appId, ...extras }
      }));
    } catch {}
  }

  function setPanelState(open) {
    panel.classList.toggle('notation-panel--open', open);
    panel.hidden = !open;
    panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    toggleButton.classList.toggle('top-bar-notation-button--active', open);
    toggleButton.setAttribute('aria-pressed', open ? 'true' : 'false');
    toggleButton.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (!isInline) {
      document.body.classList.toggle('notation-open', open);
    }
  }

  function focusInitial() {
    const focusTarget = closeButton && isVisible(closeButton) ? closeButton : null;
    if (focusTarget) {
      try { focusTarget.focus({ preventScroll: true }); } catch { focusTarget.focus(); }
      return;
    }
    const focusable = getFocusableElements(dialog);
    const target = focusable[0] || dialog;
    try { target.focus({ preventScroll: true }); } catch { target.focus(); }
  }

  function trapFocus(event) {
    if (event.key !== 'Tab') return;
    const focusable = getFocusableElements(dialog);
    if (focusable.length === 0) {
      event.preventDefault();
      try { dialog.focus({ preventScroll: true }); } catch { dialog.focus(); }
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey) {
      if (active === first || !dialog.contains(active)) {
        event.preventDefault();
        try { last.focus({ preventScroll: true }); } catch { last.focus(); }
      }
    } else if (active === last) {
      event.preventDefault();
      try { first.focus({ preventScroll: true }); } catch { first.focus(); }
    }
  }

  function open({ broadcast = true } = {}) {
    if (isOpen) return;
    isOpen = true;
    lastFocusedElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : toggleButton;
    setPanelState(true);
    applySolidBackground();
    focusInitial();
    if (typeof onOpen === 'function') onOpen();
    if (broadcast) dispatch(true);
  }

  function close({ restoreFocus = true, broadcast = true } = {}) {
    if (!isOpen) return;
    isOpen = false;
    setPanelState(false);
    if (typeof onClose === 'function') onClose();
    if (broadcast) dispatch(false);
    if (restoreFocus) {
      const target = (lastFocusedElement && document.contains(lastFocusedElement))
        ? lastFocusedElement
        : toggleButton;
      if (target) {
        try { target.focus({ preventScroll: true }); } catch { target.focus(); }
      }
    }
  }

  function toggle() {
    if (isOpen) close(); else open();
  }

  toggleButton.addEventListener('click', toggle);
  closeTriggers.forEach(el => el.addEventListener('click', () => close()));

  if (!isInline) {
    panel.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key === 'Tab') {
        trapFocus(event);
      }
    });
  } else {
    panel.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
    });
  }

  window.addEventListener('sharedui:notationtoggle', (event) => {
    const detail = event.detail || {};
    if (detail.source === appId) return;
    if (detail.appId && detail.appId !== appId) return;
    if (typeof detail.open !== 'boolean') return;
    if (detail.open) {
      open({ broadcast: false });
    } else {
      close({ broadcast: false, restoreFocus: detail.restoreFocus !== false });
    }
  });

  window.addEventListener('sharedui:theme', () => {
    if (isOpen) {
      applySolidBackground();
    }
  });

  return {
    open,
    close,
    toggle,
    get isOpen() { return isOpen; }
  };
}
