import { solidMenuBackground as deprecatedSolidMenuBackground } from './utils.js';
import { parsePositiveInt, gcd } from './number.js';

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
  startEmpty = false
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
      numerator: { wrapper: null, placeholder: null },
      denominator: { wrapper: null, placeholder: null }
    }
  };

  let currentInfo = createEmptyFractionInfo();
  let currentMessage = '';
  let hideTimer = null;
  let isApplying = false;
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

  function hideInfo({ clearMessage = false } = {}) {
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

  function registerHoverTarget(target, { useFocus = false } = {}) {
    if (!target) return;

    function computeHoverMessage(el) {
      const type = el?.dataset?.fractionHoverType;
      return currentMessage || getDefaultHoverText(type);
    }

    function updateBubblePosition(evt) {
      const bubble = elements.infoBubble;
      if (!bubble || !evt) return;
      // desfasament de 20 px cap amunt i 10 px cap a la dreta
      bubble.style.left = (evt.clientX + 20) + 'px';
      bubble.style.top  = (evt.clientY - 40) + 'px';
    }

    target.addEventListener('mouseenter', (event) => {
      updateBubblePosition(event);
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
    if (!info || !info.isMultiple) {
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
    clearHideTimer();
    if (!info || !info.isMultiple) {
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

  function handleInputChange(field, cause) {
    if (isApplying) return;
    const input = field === 'numerator' ? elements.numerator : elements.denominator;
    const value = parsePositiveInt(input?.value);
    setFraction({ [field]: value }, { reveal: true, cause });
  }

  function adjustInput(field, delta) {
    const current = field === 'numerator' ? currentValues.numerator : currentValues.denominator;
    const nextBase = Number.isFinite(current) && current > 0 ? current : 1;
    const next = Math.max(1, nextBase + delta);
    setFraction({ [field]: next }, { cause: 'spinner' });
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
      placeholder: fieldElements.placeholder
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
      currentMessage = '';
      delete safeHost[CONTROLLER_SYMBOL];
    }
  };

  safeHost[CONTROLLER_SYMBOL] = controller;
  return controller;
}

export default createFractionEditor;
