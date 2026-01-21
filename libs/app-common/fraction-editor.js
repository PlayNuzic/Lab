import { solidMenuBackground as deprecatedSolidMenuBackground } from './utils.js';
import { parsePositiveInt, gcd } from './number-utils.js';

const FRACTION_HOVER_NUMERATOR_TYPE = 'numerator';
const FRACTION_HOVER_DENOMINATOR_TYPE = 'denominator';
const DEFAULT_NUMERATOR_HOVER_TEXT = 'Numerador (pulsos por ciclo)';
const DEFAULT_DENOMINATOR_HOVER_TEXT = 'Denominador (subdivisiones)';

const DEFAULT_LABELS = {
  numerator: {
    placeholder: 'n',
    ariaUp: 'Incrementar numerador',
    ariaDown: 'Decrementar numerador'
  },
  denominator: {
    placeholder: 'd',
    ariaUp: 'Incrementar denominador',
    ariaDown: 'Decrementar denominador'
  }
};

const CONTROLLER_SYMBOL = Symbol('fractionEditorController');

export function createEmptyFractionInfo() {
  return {
    numerator: null,
    denominator: null,
    reducedNumerator: null,
    reducedDenominator: null,
    isMultiple: false,
    multipleFactor: 1
  };
}

function computeFractionInfo(numerator, denominator) {
  const info = createEmptyFractionInfo();
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || numerator <= 0 || denominator <= 0) {
    return info;
  }
  info.numerator = numerator;
  info.denominator = denominator;
  const divisor = gcd(numerator, denominator);
  if (divisor <= 1) {
    return info;
  }
  info.reducedNumerator = numerator / divisor;
  info.reducedDenominator = denominator / divisor;
  info.isMultiple = true;
  info.multipleFactor = denominator / info.reducedDenominator;
  return info;
}

function buildReductionHoverText(info) {
  if (!info || !info.isMultiple) return '';
  const accentEvery = Math.max(1, Math.round(info.multipleFactor));
  const noun = accentEvery === 1 ? 'subdivisión' : 'subdivisiones';
  return `Esta fracción es múltiple de ${info.reducedNumerator}/${info.reducedDenominator}. Se repite ${accentEvery} veces la misma ${noun} en cada fracción ${info.numerator}/${info.denominator}.`;
}

function buildAutoReduceMessage(originalN, originalD, reducedN, reducedD) {
  return `${originalN}/${originalD} → ${reducedN}/${reducedD} (simplificado)`;
}

// Animation timing constants
const FLASH_DURATION_MS = 600;
const MORPH_DURATION_MS = 800;
const TOOLTIP_EXTRA_DELAY_MS = 1000;

function noop() {}

function ensureBackground(fn) {
  if (typeof fn === 'function') return fn;
  return (el) => { if (el) deprecatedSolidMenuBackground(el); };
}

function mergeLabels(labels = {}) {
  return {
    numerator: { ...DEFAULT_LABELS.numerator, ...(labels.numerator ?? {}) },
    denominator: { ...DEFAULT_LABELS.denominator, ...(labels.denominator ?? {}) }
  };
}

function assignAria(button, label) {
  if (!button) return;
  if (label) {
    button.setAttribute('aria-label', label);
  } else {
    button.removeAttribute('aria-label');
  }
}

export function createFractionEditor({
  mode = 'inline',
  host,
  defaults = {},
  storage = {},
  addRepeatPress,
  applyMenuBackground,
  onChange = noop,
  hoverTexts = {},
  labels = {},
  autoHideMs = 3000,
  startEmpty = false,
  autoReduce = false,
  minDenominator = 1, // Minimum denominator for user input (auto-reduce can go below this)
  minNumerator = 1 // Minimum numerator for user input (auto-reduce can go below this)
} = {}) {
  const safeHost = host ?? null;
  if (!safeHost) return null;

  if (safeHost[CONTROLLER_SYMBOL]) {
    return safeHost[CONTROLLER_SYMBOL];
  }

  const isInline = mode === 'inline';
  const fieldLabels = mergeLabels(labels);
  const load = typeof storage.load === 'function' ? storage.load : noop;
  const save = typeof storage.save === 'function' ? storage.save : noop;
  const clear = typeof storage.clear === 'function' ? storage.clear : noop;
  const numeratorKey = storage.numeratorKey ?? 'numerator';
  const denominatorKey = storage.denominatorKey ?? 'denominator';
  const applyBackground = ensureBackground(applyMenuBackground);
  const attachRepeat = typeof addRepeatPress === 'function'
    ? addRepeatPress
    : (el, fn) => { if (el) el.addEventListener('click', fn); };

  const elements = {
    host: safeHost,
    wrapper: null,
    container: null,
    numerator: null,
    denominator: null,
    infoBubble: null,
    bar: null,
    ghost: {
      container: null,
      numerator: null,
      denominator: null
    },
    fields: {
      numerator: { wrapper: null, placeholder: null, up: null, down: null },
      denominator: { wrapper: null, placeholder: null, up: null, down: null }
    }
  };

  let currentInfo = createEmptyFractionInfo();
  let currentMessage = '';
  let hideTimer = null;
  let isApplying = false;
  let isReducing = false; // Tracks if auto-reduce animation is in progress
  let reduceTooltipTimer = null;
  let spinnerDebounceTimer = null; // Debounce timer for spinner auto-reduce
  let isShowingSimpleFractionTooltip = false; // Tracks if simple fraction tooltip is active
  const SPINNER_DEBOUNCE_MS = 400;
  const currentValues = { numerator: null, denominator: null };
  const inlineState = {
    resizeObserver: null,
    rafHandle: null,
    rafCancel: null,
    baseBarWidth: null,
    minBarWidth: null,
    hostPadding: null,
    resizeListener: null
  };

  function clearHideTimer() {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  }

  function hideInfo({ clearMessage = false, force = false } = {}) {
    // Don't hide if simple fraction tooltip is active (unless forced)
    if (isShowingSimpleFractionTooltip && !force) return;

    const bubble = elements.infoBubble;
    if (!bubble) return;
    clearHideTimer();
    bubble.classList.add('fraction-info-bubble--hidden');
    bubble.classList.remove('fraction-info-bubble--visible');
    if (clearMessage) bubble.textContent = '';
  }

  function getDefaultHoverText(type) {
    return type === FRACTION_HOVER_DENOMINATOR_TYPE
      ? (hoverTexts.denominator ?? DEFAULT_DENOMINATOR_HOVER_TEXT)
      : (hoverTexts.numerator ?? DEFAULT_NUMERATOR_HOVER_TEXT);
  }

  function showInfo({ message, autoHide = false } = {}) {
    // Don't show hover info if simple fraction tooltip is active
    if (isShowingSimpleFractionTooltip) return;

    const bubble = elements.infoBubble;
    if (!bubble) return;
    const resolved = message || currentMessage;
    if (!resolved) return;
    clearHideTimer();
    applyBackground(bubble);
    bubble.textContent = resolved;
    bubble.classList.remove('fraction-info-bubble--hidden');
    bubble.classList.add('fraction-info-bubble--visible');
    if (autoHide && autoHideMs > 0) {
      hideTimer = setTimeout(() => {
        hideInfo();
      }, autoHideMs);
    }
  }

  /**
   * Positions the tooltip below the fraction editor (fixed position)
   */
  function positionTooltipBelow() {
    const bubble = elements.infoBubble;
    const container = elements.container;
    if (!bubble || !container) return;
    const rect = container.getBoundingClientRect();
    bubble.style.left = (rect.left + rect.width / 2) + 'px';
    bubble.style.top = (rect.bottom + window.scrollY + 8) + 'px';
    bubble.style.transform = 'translateX(-50%)';
  }

  /**
   * Shows a persistent tooltip indicating the fraction is simple (n=1 or d=1)
   * Stays visible until fraction changes to non-simple
   * Shows special message for 1/1 (equivalent to pulse)
   */
  function showSimpleFractionTooltip() {
    const bubble = elements.infoBubble;
    if (!bubble) return;

    // Clear any existing timers
    clearHideTimer();
    if (reduceTooltipTimer) {
      clearTimeout(reduceTooltipTimer);
      reduceTooltipTimer = null;
    }

    isShowingSimpleFractionTooltip = true;
    positionTooltipBelow();
    applyBackground(bubble);

    // Special message for 1/1 (equivalent to one full pulse)
    const n = currentValues.numerator;
    const d = currentValues.denominator;
    if (n === 1 && d === 1) {
      bubble.textContent = 'Fracción equivalente al Pulso';
    } else {
      bubble.textContent = 'Fracción simple';
    }

    bubble.classList.remove('fraction-info-bubble--hidden');
    bubble.classList.add('fraction-info-bubble--visible', 'fraction-info-bubble--reduction');
    // No timer - stays visible until fraction changes
  }

  /**
   * Hides the simple fraction tooltip
   */
  function hideSimpleFractionTooltip() {
    if (!isShowingSimpleFractionTooltip) return;
    isShowingSimpleFractionTooltip = false;
    const bubble = elements.infoBubble;
    if (!bubble) return;
    bubble.classList.remove('fraction-info-bubble--reduction');
    bubble.style.transform = '';
    hideInfo({ clearMessage: true, force: true });
  }

  /**
   * Checks if current fraction is simple (n=1 or d=1) and shows/hides tooltip accordingly
   * Always shows tooltip for 1/1 (pulse equivalent) regardless of autoReduce setting
   */
  function updateSimpleFractionTooltip() {
    const n = currentValues.numerator;
    const d = currentValues.denominator;
    const isPulseEquivalent = n === 1 && d === 1;
    const isSimple = (n === 1 || d === 1) && Number.isFinite(n) && Number.isFinite(d);

    // Always show tooltip for 1/1 (pulse equivalent), or for other simple fractions if autoReduce is enabled
    if (isPulseEquivalent || (isSimple && autoReduce)) {
      showSimpleFractionTooltip();
    } else {
      hideSimpleFractionTooltip();
    }
  }

  /**
   * Shows a prominent tooltip below the fraction editor for auto-reduce feedback
   * Positioned fixed below the editor, not following cursor
   * @param {string} message - The message to display
   * @param {number} totalDurationMs - Duration to show the message before checking for simple fraction
   * @param {Object} reducedValues - Optional reduced values {n, d} to check after timeout (avoids race conditions with app callbacks)
   */
  function showReductionTooltip(message, totalDurationMs, reducedValues = null) {
    const bubble = elements.infoBubble;
    if (!bubble) return;

    // Clear any existing timers
    clearHideTimer();
    if (reduceTooltipTimer) {
      clearTimeout(reduceTooltipTimer);
      reduceTooltipTimer = null;
    }

    positionTooltipBelow();

    applyBackground(bubble);
    bubble.textContent = message;
    bubble.classList.remove('fraction-info-bubble--hidden');
    bubble.classList.add('fraction-info-bubble--visible', 'fraction-info-bubble--reduction');

    // Hide after total duration, then check for simple fraction
    reduceTooltipTimer = setTimeout(() => {
      reduceTooltipTimer = null;

      // Use provided reduced values if available (to avoid race conditions with app callbacks)
      // Otherwise fall back to current values
      const n = reducedValues?.n ?? currentValues.numerator;
      const d = reducedValues?.d ?? currentValues.denominator;
      const isSimple = (n === 1 || d === 1) && Number.isFinite(n) && Number.isFinite(d);

      if (isSimple && autoReduce) {
        // Transition directly to simple fraction tooltip without hiding first
        // Keep --reduction class for prominent style, just change the text
        isShowingSimpleFractionTooltip = true;
        // Special message for 1/1 (equivalent to one full pulse)
        if (n === 1 && d === 1) {
          bubble.textContent = 'Fracción equivalente al Pulso';
        } else {
          bubble.textContent = 'Fracción simple';
        }
        // Ensure position stays correct (re-apply in case of any CSS conflicts)
        positionTooltipBelow();
      } else {
        bubble.classList.remove('fraction-info-bubble--reduction');
        bubble.style.transform = '';
        hideInfo({ clearMessage: true, force: true });
      }
    }, totalDurationMs);
  }

  /**
   * Animates the reduction of a fraction with flash + morphing effect
   * @param {Object} info - Fraction info with original and reduced values
   * @param {Function} onComplete - Callback when animation completes
   */
  function animateReduction(info, onComplete = noop) {
    if (!info || !info.isMultiple) {
      onComplete();
      return;
    }

    isReducing = true;
    const container = elements.container;
    const numeratorInput = elements.numerator;
    const denominatorInput = elements.denominator;

    if (!container || !numeratorInput || !denominatorInput) {
      isReducing = false;
      onComplete();
      return;
    }

    const originalN = info.numerator;
    const originalD = info.denominator;
    const reducedN = info.reducedNumerator;
    const reducedD = info.reducedDenominator;

    // Show tooltip immediately with the reduction message
    // Pass reduced values to avoid race conditions with app callbacks that might clamp values
    const totalTooltipTime = FLASH_DURATION_MS + MORPH_DURATION_MS + TOOLTIP_EXTRA_DELAY_MS;
    const message = buildAutoReduceMessage(originalN, originalD, reducedN, reducedD);
    showReductionTooltip(message, totalTooltipTime, { n: reducedN, d: reducedD });

    // Phase 1: Flash effect
    container.classList.add('fraction-editor--flash');

    setTimeout(() => {
      // End flash, start morph
      container.classList.remove('fraction-editor--flash');
      container.classList.add('fraction-editor--morphing');

      // Apply the reduced values with morphing transition
      isApplying = true;
      numeratorInput.value = String(reducedN);
      denominatorInput.value = String(reducedD);
      isApplying = false;

      // Update internal state
      currentValues.numerator = reducedN;
      currentValues.denominator = reducedD;

      setTimeout(() => {
        // End morph animation
        container.classList.remove('fraction-editor--morphing');
        isReducing = false;

        // Update state and notify
        applyState({ reveal: false, cause: 'auto-reduce', persist: true, silent: false });
        onComplete();
      }, MORPH_DURATION_MS);
    }, FLASH_DURATION_MS);
  }

  function registerHoverTarget(target, { useFocus = false } = {}) {
    if (!target) return;

    function computeHoverMessage(el) {
      const type = el?.dataset?.fractionHoverType;
      return currentMessage || getDefaultHoverText(type);
    }

    function updateBubblePosition(evt) {
      // Don't move tooltip if simple fraction tooltip is active
      if (isShowingSimpleFractionTooltip) return;

      const bubble = elements.infoBubble;
      if (!bubble || !evt) return;
      // desfasament de 20 px cap amunt i 10 px cap a la dreta
      bubble.style.left = (evt.clientX + 20) + 'px';
      bubble.style.top  = (evt.clientY - 40) + 'px';
    }

    target.addEventListener('mouseenter', (event) => {
      // Don't update position if simple fraction tooltip is active
      if (!isShowingSimpleFractionTooltip) {
        updateBubblePosition(event);
      }
      // IMPORTANT: no assignem a currentMessage aquí; així el tipus correcte
      // (numerator/denominator) determina el text per defecte cada vegada
      showInfo({ message: computeHoverMessage(event.currentTarget) });
    });

    target.addEventListener('mousemove', updateBubblePosition);
    target.addEventListener('mouseleave', () => hideInfo());

    if (useFocus) {
      target.addEventListener('focus', (event) => {
        showInfo({ message: computeHoverMessage(event.currentTarget) });
      });
      target.addEventListener('blur', () => hideInfo());
    }
  }

  function scheduleInlineBarUpdate() {
    if (!isInline) return;
    if (inlineState.rafHandle != null) return;
    const hasWindow = typeof window !== 'undefined';
    const request = hasWindow && typeof window.requestAnimationFrame === 'function'
      ? window.requestAnimationFrame.bind(window)
      : (cb) => setTimeout(cb, 16);
    const cancel = hasWindow && typeof window.cancelAnimationFrame === 'function'
      ? window.cancelAnimationFrame.bind(window)
      : (handle) => clearTimeout(handle);
    inlineState.rafCancel = cancel;
    inlineState.rafHandle = request(() => {
      inlineState.rafHandle = null;
      inlineState.rafCancel = null;
      updateInlineBarWidth();
    });
  }

  function updateInlineBarWidth() {
    if (!isInline) return;
    const bar = elements.bar;
    const hostEl = elements.host;
    const containerEl = elements.container;
    if (!bar || !hostEl || !containerEl) return;
    const getRect = (el) => (el && typeof el.getBoundingClientRect === 'function' ? el.getBoundingClientRect() : null);
    const hostRect = getRect(hostEl);
    const containerRect = getRect(containerEl);
    if (!hostRect || hostRect.width <= 0 || !containerRect) return;

    const numeratorWrapper = elements.fields.numerator?.wrapper;
    const denominatorWrapper = elements.fields.denominator?.wrapper;
    const numeratorRect = getRect(numeratorWrapper);
    const denominatorRect = getRect(denominatorWrapper);
    const widestField = Math.max(numeratorRect?.width ?? 0, denominatorRect?.width ?? 0, 0);

    if (inlineState.baseBarWidth == null) {
      let computedWidth = 0;
      if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
        computedWidth = parseFloat(window.getComputedStyle(bar).width) || 0;
      }
      if (!computedWidth && typeof bar.getBoundingClientRect === 'function') {
        computedWidth = bar.getBoundingClientRect().width || 0;
      }
      inlineState.baseBarWidth = computedWidth || containerRect.width || widestField || hostRect.width || 0;
      if (!inlineState.baseBarWidth || inlineState.baseBarWidth <= 0) {
        inlineState.baseBarWidth = 56;
      }
      inlineState.minBarWidth = Math.max(8, inlineState.baseBarWidth * 0.45);
    }

    if (inlineState.hostPadding == null) {
      inlineState.hostPadding = Math.max(0, hostRect.width - containerRect.width);
    }

    const padding = inlineState.hostPadding ?? 0;
    const availableWidth = Math.max(0, hostRect.width - padding);
    if (!availableWidth) return;

    const effectiveDefaultWidth = Math.max(inlineState.baseBarWidth || 0, widestField || 0, containerRect.width || 0);
    const minWidth = Math.max(8, (inlineState.minBarWidth ?? inlineState.baseBarWidth * 0.45));

    let targetWidth = effectiveDefaultWidth;
    if (availableWidth < effectiveDefaultWidth) {
      const lowerBound = Math.min(minWidth, availableWidth);
      targetWidth = Math.max(lowerBound, Math.min(effectiveDefaultWidth, availableWidth));
    }

    if (!Number.isFinite(targetWidth) || targetWidth <= 0) return;

    const shouldRemoveInlineWidth = inlineState.baseBarWidth != null
      && Math.abs(targetWidth - inlineState.baseBarWidth) < 0.5
      && effectiveDefaultWidth <= inlineState.baseBarWidth + 0.5;

    if (shouldRemoveInlineWidth) {
      if (bar.style.width) bar.style.removeProperty('width');
      return;
    }

    bar.style.width = `${targetWidth}px`;
  }

  function setupInlineResizeObserver() {
    if (!isInline) return;
    if (inlineState.resizeObserver || typeof window === 'undefined' || typeof window.ResizeObserver !== 'function') return;
    const observer = new window.ResizeObserver(() => scheduleInlineBarUpdate());
    inlineState.resizeObserver = observer;
    const targets = [
      elements.host,
      elements.wrapper,
      elements.container,
      elements.fields.numerator?.wrapper,
      elements.fields.denominator?.wrapper
    ];
    targets.forEach((target) => {
      if (target instanceof window.Element) {
        observer.observe(target);
      }
    });
  }

  function setInputValue(input, value) {
    if (!input) return;
    isApplying = true;
    if (Number.isFinite(value) && value > 0) {
      input.value = String(value);
    } else {
      input.value = '';
    }
    isApplying = false;
  }

  function persistValue(field, value) {
    const key = field === 'numerator' ? numeratorKey : denominatorKey;
    if (!key) return;
    if (Number.isFinite(value) && value > 0) {
      save(key, String(value));
    } else {
      clear(key);
    }
  }

  function updateFieldState(field, isEmpty) {
    const wrapper = elements.fields[field]?.wrapper;
    const placeholder = elements.fields[field]?.placeholder;
    if (!wrapper) return;
    const empty = !!isEmpty;
    wrapper.classList.toggle('fraction-field--empty', empty);
    if (placeholder) {
      placeholder.classList.toggle('fraction-field-placeholder--visible', empty);
    }
  }

  function updateGhost(info) {
    const ghost = elements.ghost.container;
    const top = elements.ghost.numerator;
    const bottom = elements.ghost.denominator;
    if (!ghost || !top || !bottom) return;
    // Don't show ghost when autoReduce is enabled (fraction will be auto-reduced anyway)
    if (autoReduce || !info || !info.isMultiple) {
      ghost.classList.add('fraction-ghost--hidden');
      ghost.classList.remove('fraction-ghost--visible');
      top.textContent = '';
      bottom.textContent = '';
      return;
    }
    top.textContent = info.reducedNumerator;
    bottom.textContent = info.reducedDenominator;
    ghost.classList.remove('fraction-ghost--hidden');
    ghost.classList.add('fraction-ghost--visible');
  }

  function updateInfoBubble(info, { reveal = false } = {}) {
    if (!elements.infoBubble) return;
    // Don't interfere with reduction tooltip or simple fraction tooltip
    if (reduceTooltipTimer || isShowingSimpleFractionTooltip) return;
    clearHideTimer();
    // With autoReduce, never show the "multiple fraction" hover text
    if (autoReduce || !info || !info.isMultiple) {
      currentMessage = '';
      hideInfo({ clearMessage: true });
      return;
    }
    currentMessage = buildReductionHoverText(info);
    if (reveal) {
      showInfo({ message: currentMessage, autoHide: true });
    } else if (elements.infoBubble.classList.contains('fraction-info-bubble--visible')) {
      showInfo({ message: currentMessage });
    }
  }

  function applyState({ reveal = false, cause = 'set', persist = true, silent = false } = {}) {
    updateFieldState('numerator', !Number.isFinite(currentValues.numerator) || currentValues.numerator <= 0);
    updateFieldState('denominator', !Number.isFinite(currentValues.denominator) || currentValues.denominator <= 0);

    currentInfo = computeFractionInfo(currentValues.numerator, currentValues.denominator);
    updateGhost(currentInfo);
    updateInfoBubble(currentInfo, { reveal });

    if (isInline) scheduleInlineBarUpdate();

    if (persist) {
      persistValue('numerator', currentValues.numerator);
      persistValue('denominator', currentValues.denominator);
    }

    // Update simple fraction tooltip when fraction changes (but not during reduction animation)
    if (!isReducing && cause !== 'auto-reduce') {
      updateSimpleFractionTooltip();
    }

    if (!silent) {
      onChange({
        numerator: currentValues.numerator,
        denominator: currentValues.denominator,
        info: currentInfo,
        cause
      });
    }
    return currentInfo;
  }

  function setFraction(values = {}, options = {}) {
    const updates = { ...options };
    const { reveal = false, cause = 'set', persist = true, silent = false } = updates;
    if (Object.prototype.hasOwnProperty.call(values, 'numerator')) {
      currentValues.numerator = parsePositiveInt(values.numerator);
      setInputValue(elements.numerator, currentValues.numerator);
    }
    if (Object.prototype.hasOwnProperty.call(values, 'denominator')) {
      currentValues.denominator = parsePositiveInt(values.denominator);
      setInputValue(elements.denominator, currentValues.denominator);
    }
    return applyState({ reveal, cause, persist, silent });
  }

  function showMinValueWarning(field, minValue) {
    const fieldName = field === 'numerator' ? 'numerador' : 'denominador';
    const message = `El ${fieldName} mínimo es ${minValue}`;
    showReductionTooltip(message, 2000);
  }

  function handleInputChange(field, cause) {
    if (isApplying || isReducing) return;
    const input = field === 'numerator' ? elements.numerator : elements.denominator;
    let value = parsePositiveInt(input?.value);

    // Apply minNumerator constraint for user input
    if (field === 'numerator' && Number.isFinite(value) && value < minNumerator) {
      showMinValueWarning(field, minNumerator);
      value = minNumerator;
      setInputValue(input, value);
    }

    // Apply minDenominator constraint for user input
    if (field === 'denominator' && Number.isFinite(value) && value < minDenominator) {
      showMinValueWarning(field, minDenominator);
      value = minDenominator;
      setInputValue(input, value);
    }

    setFraction({ [field]: value }, { reveal: !autoReduce, cause });

    // Auto-reduce on blur if enabled and fraction is reducible
    if (autoReduce && cause === 'blur' && currentInfo.isMultiple) {
      animateReduction(currentInfo);
    }
  }

  function adjustInput(field, delta) {
    if (isReducing) return;
    const current = field === 'numerator' ? currentValues.numerator : currentValues.denominator;
    const nextBase = Number.isFinite(current) && current > 0 ? current : 1;
    // Apply min constraints for spinner
    const minValue = field === 'denominator' ? minDenominator : minNumerator;
    const next = Math.max(minValue, nextBase + delta);

    // Show warning if trying to go below minimum
    if (nextBase + delta < minValue && delta < 0) {
      showMinValueWarning(field, minValue);
      return; // Don't update value, just show warning
    }

    setFraction({ [field]: next }, { cause: 'spinner', reveal: !autoReduce });

    // Auto-reduce on spinner with debounce (allows user to keep clicking without interruption)
    if (autoReduce) {
      if (spinnerDebounceTimer) {
        clearTimeout(spinnerDebounceTimer);
      }
      spinnerDebounceTimer = setTimeout(() => {
        spinnerDebounceTimer = null;
        if (currentInfo.isMultiple && !isReducing) {
          animateReduction(currentInfo);
        }
      }, SPINNER_DEBOUNCE_MS);
    }
  }

  function createField(field, labelOptions) {
    const fieldWrapper = document.createElement('div');
    fieldWrapper.className = `fraction-field ${field}`;
    fieldWrapper.classList.add('fraction-field--empty');
    fieldWrapper.dataset.fractionHoverType = field;

    const input = document.createElement('input');
    input.type = 'number';
    input.min = '1';
    input.step = '1';
    input.value = '';
    input.className = field;
    input.dataset.fractionHoverType = field;

    // Add id and name for accessibility
    const uniqueId = `fraction-${field}-${Math.random().toString(36).substr(2, 9)}`;
    input.id = uniqueId;
    input.name = field;
    fieldWrapper.appendChild(input);

    const placeholderEl = document.createElement('div');
    placeholderEl.className = 'fraction-field-placeholder fraction-field-placeholder--visible';
    placeholderEl.textContent = labelOptions.placeholder ?? '';
    placeholderEl.setAttribute('aria-hidden', 'true');
    fieldWrapper.appendChild(placeholderEl);

    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    const up = document.createElement('button');
    up.type = 'button';
    up.className = 'spin up';
    assignAria(up, labelOptions.ariaUp);
    const down = document.createElement('button');
    down.type = 'button';
    down.className = 'spin down';
    assignAria(down, labelOptions.ariaDown);
    spinner.append(up, down);
    fieldWrapper.appendChild(spinner);

    return { wrapper: fieldWrapper, input, placeholder: placeholderEl, up, down };
  }

  function attachField(fieldKey, fieldElements) {
    elements.fields[fieldKey] = {
      wrapper: fieldElements.wrapper,
      placeholder: fieldElements.placeholder,
      up: fieldElements.up,
      down: fieldElements.down
    };

    registerHoverTarget(fieldElements.wrapper);
    registerHoverTarget(fieldElements.input, { useFocus: true });

    fieldElements.input.addEventListener('input', () => handleInputChange(fieldKey, 'input'));
    fieldElements.input.addEventListener('blur', () => handleInputChange(fieldKey, 'blur'));

    attachRepeat(fieldElements.up, () => adjustInput(fieldKey, +1));
    attachRepeat(fieldElements.down, () => adjustInput(fieldKey, -1));
  }

  function refresh(options = {}) {
    return applyState({ ...options, silent: true, persist: false });
  }

  safeHost.replaceChildren();

  if (isInline) {
    safeHost.classList.add('fraction-inline-container');
    safeHost.dataset.fractionHoverType = FRACTION_HOVER_NUMERATOR_TYPE;

    const wrapper = document.createElement('span');
    wrapper.className = 'fraction-editor-wrapper fraction-editor-wrapper--inline';
    wrapper.dataset.fractionHoverType = FRACTION_HOVER_NUMERATOR_TYPE;
    elements.wrapper = wrapper;
    safeHost.appendChild(wrapper);

    const ghostContainer = document.createElement('div');
    ghostContainer.className = 'fraction-ghost fraction-ghost--hidden';
    ghostContainer.setAttribute('aria-hidden', 'true');
    const ghostNumeratorWrapper = document.createElement('div');
    ghostNumeratorWrapper.className = 'fraction-ghost__numerator';
    const ghostNumeratorText = document.createElement('span');
    ghostNumeratorText.className = 'fraction-ghost__number';
    ghostNumeratorWrapper.appendChild(ghostNumeratorText);
    const ghostBar = document.createElement('div');
    ghostBar.className = 'fraction-ghost__bar';
    const ghostDenominatorWrapper = document.createElement('div');
    ghostDenominatorWrapper.className = 'fraction-ghost__denominator';
    const ghostDenominatorText = document.createElement('span');
    ghostDenominatorText.className = 'fraction-ghost__number';
    ghostDenominatorWrapper.appendChild(ghostDenominatorText);
    ghostContainer.append(ghostNumeratorWrapper, ghostBar, ghostDenominatorWrapper);
    elements.ghost.container = ghostContainer;
    elements.ghost.numerator = ghostNumeratorText;
    elements.ghost.denominator = ghostDenominatorText;

    const container = document.createElement('div');
    container.className = 'fraction-editor fraction-editor--inline';
    container.dataset.fractionHoverType = FRACTION_HOVER_NUMERATOR_TYPE;
    wrapper.append(ghostContainer);
    wrapper.append(container);
    elements.container = container;

    const infoBubble = document.createElement('div');
    infoBubble.className = 'fraction-info-bubble fraction-info-bubble--hidden';
    infoBubble.setAttribute('role', 'status');
    infoBubble.setAttribute('aria-live', 'polite');
    applyBackground(infoBubble);
    wrapper.appendChild(infoBubble);
    elements.infoBubble = infoBubble;

    const top = document.createElement('div');
    top.className = 'top';
    const numeratorField = createField('numerator', fieldLabels.numerator);
    top.appendChild(numeratorField.wrapper);
    container.appendChild(top);

    const bar = document.createElement('div');
    bar.className = 'fraction-bar';
    bar.dataset.fractionHoverType = FRACTION_HOVER_NUMERATOR_TYPE;
    bar.setAttribute('aria-hidden', 'true');
    container.appendChild(bar);
    elements.bar = bar;

    const bottom = document.createElement('div');
    bottom.className = 'bottom';
    const denominatorField = createField('denominator', fieldLabels.denominator);
    bottom.appendChild(denominatorField.wrapper);
    container.appendChild(bottom);

    elements.numerator = numeratorField.input;
    elements.denominator = denominatorField.input;

    registerHoverTarget(safeHost);
    registerHoverTarget(wrapper);
    registerHoverTarget(container);
    registerHoverTarget(bar);

    attachField('numerator', numeratorField);
    attachField('denominator', denominatorField);

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      inlineState.resizeListener = () => scheduleInlineBarUpdate();
      window.addEventListener('resize', inlineState.resizeListener);
    }

    setupInlineResizeObserver();
    scheduleInlineBarUpdate();
  } else {
    const wrapper = document.createElement('div');
    wrapper.className = 'fraction-editor-wrapper';
    elements.wrapper = wrapper;
    safeHost.appendChild(wrapper);

    const ghostContainer = document.createElement('div');
    ghostContainer.className = 'fraction-ghost fraction-ghost--hidden';
    ghostContainer.setAttribute('aria-hidden', 'true');
    const ghostNumeratorWrapper = document.createElement('div');
    ghostNumeratorWrapper.className = 'fraction-ghost__numerator';
    const ghostNumeratorText = document.createElement('span');
    ghostNumeratorText.className = 'fraction-ghost__number';
    ghostNumeratorWrapper.appendChild(ghostNumeratorText);
    const ghostBar = document.createElement('div');
    ghostBar.className = 'fraction-ghost__bar';
    const ghostDenominatorWrapper = document.createElement('div');
    ghostDenominatorWrapper.className = 'fraction-ghost__denominator';
    const ghostDenominatorText = document.createElement('span');
    ghostDenominatorText.className = 'fraction-ghost__number';
    ghostDenominatorWrapper.appendChild(ghostDenominatorText);
    ghostContainer.append(ghostNumeratorWrapper, ghostBar, ghostDenominatorWrapper);
    elements.ghost.container = ghostContainer;
    elements.ghost.numerator = ghostNumeratorText;
    elements.ghost.denominator = ghostDenominatorText;

    const container = document.createElement('div');
    container.className = 'fraction-editor';
    container.dataset.fractionHoverType = FRACTION_HOVER_NUMERATOR_TYPE;
    wrapper.append(ghostContainer);
    wrapper.append(container);
    elements.container = container;

    const infoBubble = document.createElement('div');
    infoBubble.className = 'fraction-info-bubble fraction-info-bubble--hidden';
    infoBubble.setAttribute('role', 'status');
    infoBubble.setAttribute('aria-live', 'polite');
    applyBackground(infoBubble);
    wrapper.appendChild(infoBubble);
    elements.infoBubble = infoBubble;

    const top = document.createElement('div');
    top.className = 'top';
    const numeratorField = createField('numerator', fieldLabels.numerator);
    top.appendChild(numeratorField.wrapper);
    container.appendChild(top);

    const bottom = document.createElement('div');
    bottom.className = 'bottom';
    const denominatorField = createField('denominator', fieldLabels.denominator);
    bottom.appendChild(denominatorField.wrapper);
    container.appendChild(bottom);

    elements.numerator = numeratorField.input;
    elements.denominator = denominatorField.input;

    registerHoverTarget(wrapper);
    registerHoverTarget(container);

    attachField('numerator', numeratorField);
    attachField('denominator', denominatorField);
  }

  const storedNumerator = parsePositiveInt(load(numeratorKey));
  const storedDenominator = parsePositiveInt(load(denominatorKey));
  const shouldStartEmpty = Boolean(startEmpty);
  const initialNumerator = shouldStartEmpty
    ? null
    : (storedNumerator ?? parsePositiveInt(defaults.numerator));
  const initialDenominator = shouldStartEmpty
    ? null
    : (storedDenominator ?? parsePositiveInt(defaults.denominator));

  setFraction({ numerator: initialNumerator, denominator: initialDenominator }, {
    reveal: false,
    persist: false,
    silent: true,
    cause: 'init'
  });

  if (shouldStartEmpty || storedNumerator == null) clear(numeratorKey);
  if (shouldStartEmpty || storedDenominator == null) clear(denominatorKey);

  applyState({ reveal: false, persist: false, cause: 'init', silent: true });
  onChange({
    numerator: currentValues.numerator,
    denominator: currentValues.denominator,
    info: currentInfo,
    cause: 'init'
  });

  const controller = {
    elements,
    getFraction() {
      return { ...currentValues };
    },
    getInfo() {
      return { ...currentInfo };
    },
    setFraction,
    refresh,
    hideInfo,
    showInfo,
    destroy() {
      if (inlineState.resizeObserver) {
        inlineState.resizeObserver.disconnect();
        inlineState.resizeObserver = null;
      }
      if (inlineState.rafHandle != null && inlineState.rafCancel) {
        inlineState.rafCancel(inlineState.rafHandle);
        inlineState.rafHandle = null;
        inlineState.rafCancel = null;
      }
      if (inlineState.resizeListener && typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener('resize', inlineState.resizeListener);
        inlineState.resizeListener = null;
      }
      clearHideTimer();
      if (reduceTooltipTimer) {
        clearTimeout(reduceTooltipTimer);
        reduceTooltipTimer = null;
      }
      if (spinnerDebounceTimer) {
        clearTimeout(spinnerDebounceTimer);
        spinnerDebounceTimer = null;
      }
      currentMessage = '';
      isReducing = false;
      delete safeHost[CONTROLLER_SYMBOL];
    },
    setSimpleMode() {
      const numeratorInput = elements.numerator;
      const numeratorPlaceholder = elements.fields.numerator?.placeholder;
      if (!numeratorInput) return;

      // Cambiar placeholder a "1"
      if (numeratorPlaceholder) {
        numeratorPlaceholder.textContent = '1';
      }

      // Fijar numerador en 1
      numeratorInput.value = '1';
      numeratorInput.disabled = true;
      numeratorInput.readOnly = true;
      numeratorInput.style.opacity = '0.5';
      numeratorInput.style.cursor = 'not-allowed';
      numeratorInput.title = 'Activar fracciones complejas en Opciones para editar';

      // Deshabilitar spinners
      const numeratorUpBtn = elements.fields.numerator?.up;
      const numeratorDownBtn = elements.fields.numerator?.down;
      if (numeratorUpBtn) {
        numeratorUpBtn.disabled = true;
        numeratorUpBtn.style.opacity = '0.5';
        numeratorUpBtn.style.cursor = 'not-allowed';
      }
      if (numeratorDownBtn) {
        numeratorDownBtn.disabled = true;
        numeratorDownBtn.style.opacity = '0.5';
        numeratorDownBtn.style.cursor = 'not-allowed';
      }

      // Siempre forzar numerador = 1 para actualizar currentValues
      setFraction({ numerator: 1 }, { cause: 'simple-mode' });
    },
    setComplexMode() {
      const numeratorInput = elements.numerator;
      const numeratorPlaceholder = elements.fields.numerator?.placeholder;
      if (!numeratorInput) return;

      // Restaurar placeholder a "n"
      if (numeratorPlaceholder) {
        numeratorPlaceholder.textContent = fieldLabels.numerator.placeholder ?? 'n';
      }

      // Habilitar numerador
      numeratorInput.disabled = false;
      numeratorInput.readOnly = false;
      numeratorInput.style.opacity = '1';
      numeratorInput.style.cursor = '';
      numeratorInput.title = '';

      // Habilitar spinners
      const numeratorUpBtn = elements.fields.numerator?.up;
      const numeratorDownBtn = elements.fields.numerator?.down;
      if (numeratorUpBtn) {
        numeratorUpBtn.disabled = false;
        numeratorUpBtn.style.opacity = '1';
        numeratorUpBtn.style.cursor = 'pointer';
      }
      if (numeratorDownBtn) {
        numeratorDownBtn.disabled = false;
        numeratorDownBtn.style.opacity = '1';
        numeratorDownBtn.style.cursor = 'pointer';
      }
    }
  };

  safeHost[CONTROLLER_SYMBOL] = controller;
  return controller;
}

export default createFractionEditor;
