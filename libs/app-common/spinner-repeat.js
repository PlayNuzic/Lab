// libs/app-common/spinner-repeat.js
// Shared spinner repeat press functionality for App16, App17, and future apps

/**
 * Attaches repeat press functionality to a spinner button.
 * Triggers callback immediately on press, then repeats after initial delay.
 *
 * @param {HTMLElement} element - The button element to attach to
 * @param {Function} callback - Function to call on each press/repeat
 * @param {Object} [options] - Configuration options
 * @param {number} [options.initialDelay=320] - Delay (ms) before repeating starts
 * @param {number} [options.repeatInterval=80] - Interval (ms) between repeats
 * @returns {Function} Cleanup function to remove event listeners
 */
export function attachSpinnerRepeat(element, callback, options = {}) {
  if (!element) return () => {};

  const { initialDelay = 320, repeatInterval = 80 } = options;

  let timeout = null;
  let interval = null;

  const start = (event) => {
    callback();
    timeout = setTimeout(() => {
      interval = setInterval(callback, repeatInterval);
    }, initialDelay);
    event.preventDefault();
  };

  const stop = () => {
    clearTimeout(timeout);
    clearInterval(interval);
    timeout = null;
    interval = null;
  };

  // Mouse events
  element.addEventListener('mousedown', start);
  element.addEventListener('mouseup', stop);
  element.addEventListener('mouseleave', stop);

  // Touch events
  element.addEventListener('touchstart', start, { passive: false });
  element.addEventListener('touchend', stop);
  element.addEventListener('touchcancel', stop);

  // Document-level stop events for edge cases
  document.addEventListener('mouseup', stop);
  document.addEventListener('touchend', stop);

  // Return cleanup function
  return () => {
    element.removeEventListener('mousedown', start);
    element.removeEventListener('mouseup', stop);
    element.removeEventListener('mouseleave', stop);
    element.removeEventListener('touchstart', start);
    element.removeEventListener('touchend', stop);
    element.removeEventListener('touchcancel', stop);
    document.removeEventListener('mouseup', stop);
    document.removeEventListener('touchend', stop);
    stop();
  };
}

/**
 * Legacy alias for addRepeatPress compatibility
 * @deprecated Use attachSpinnerRepeat instead
 */
export const addRepeatPress = attachSpinnerRepeat;
