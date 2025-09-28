import { solidMenuBackground as deprecatedSolidMenuBackground } from './utils.js';

const FRACTION_HOVER_NUMERATOR_TYPE = 'numerator';
const FRACTION_HOVER_DENOMINATOR_TYPE = 'denominator';
const DEFAULT_NUMERATOR_HOVER_TEXT = 'Numerador (pulsos por ciclo)';
const DEFAULT_DENOMINATOR_HOVER_TEXT = 'Denominador (subdivisiones)';

function parsePositiveInt(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

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

function gcd(a, b) {
  let x = Math.abs(Number(a));
  let y = Math.abs(Number(b));
  if (!Number.isFinite(x) || !Number.isFinite(y) || x === 0 || y === 0) {
    return Number.isFinite(x) && x > 0 ? x : Number.isFinite(y) && y > 0 ? y : 1;
  }
  while (y !== 0) {
    const temp = x % y;
    x = y;
    y = temp;
  }
  return x || 1;
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
  return `Esta fracción es múltiple de ${info.reducedNumerator}/${info.reducedDenominator}.\nSe repite ${accentEvery} veces la misma ${noun} en cada fracción ${info.numerator}/${info.denominator}.`;
}

function noop() {}

function ensureBackground(fn) {
  if (typeof fn === 'function') return fn;
  return (el) => { if (el) deprecatedSolidMenuBackground(el); };
}

export function createFractionEditor({
  host,
  defaults = {},
  storage = {},
  addRepeatPress,
  applyMenuBackground,
  onChange = noop,
  hoverTexts = {},
  autoHideMs = 3000
} = {}) {
  const safeHost = host ?? null;
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
    ghost: {
      container: null,
      numerator: null,
      denominator: null
    }
  };

  let currentInfo = createEmptyFractionInfo();
  let currentMessage = '';
  let hideTimer = null;
  let isApplying = false;
  const currentValues = { numerator: null, denominator: null };

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
    target.addEventListener('mouseenter', (event) => {
      const type = event?.currentTarget?.dataset?.fractionHoverType;
      const defaultText = type === FRACTION_HOVER_DENOMINATOR_TYPE
        ? (hoverTexts.denominator ?? DEFAULT_DENOMINATOR_HOVER_TEXT)
        : (hoverTexts.numerator ?? DEFAULT_NUMERATOR_HOVER_TEXT);
      showInfo({ message: currentMessage || defaultText });
    });
    target.addEventListener('mouseleave', () => {
      hideInfo();
    });
    if (useFocus) {
      target.addEventListener('focus', (event) => {
        const type = event?.currentTarget?.dataset?.fractionHoverType;
        const defaultText = type === FRACTION_HOVER_DENOMINATOR_TYPE
          ? (hoverTexts.denominator ?? DEFAULT_DENOMINATOR_HOVER_TEXT)
          : (hoverTexts.numerator ?? DEFAULT_NUMERATOR_HOVER_TEXT);
        showInfo({ message: currentMessage || defaultText });
      });
      target.addEventListener('blur', () => {
        hideInfo();
      });
    }
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

  function updateFieldState(wrapper, placeholder, isEmpty) {
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
    updateFieldState(
      elements.wrapper?.querySelector('.fraction-field.numerator'),
      elements.wrapper?.querySelector('.fraction-field.numerator .fraction-field-placeholder'),
      !Number.isFinite(currentValues.numerator) || currentValues.numerator <= 0
    );
    updateFieldState(
      elements.wrapper?.querySelector('.fraction-field.denominator'),
      elements.wrapper?.querySelector('.fraction-field.denominator .fraction-field-placeholder'),
      !Number.isFinite(currentValues.denominator) || currentValues.denominator <= 0
    );

    currentInfo = computeFractionInfo(currentValues.numerator, currentValues.denominator);
    updateGhost(currentInfo);
    updateInfoBubble(currentInfo, { reveal });

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

  function createField({ wrapperClass, placeholder }) {
    const fieldWrapper = document.createElement('div');
    fieldWrapper.className = `fraction-field ${wrapperClass}`;
    fieldWrapper.classList.add('fraction-field--empty');
    fieldWrapper.dataset.fractionHoverType = wrapperClass;

    const input = document.createElement('input');
    input.type = 'number';
    input.min = '1';
    input.step = '1';
    input.value = '';
    input.className = wrapperClass;
    input.dataset.fractionHoverType = wrapperClass;
    fieldWrapper.appendChild(input);

    const placeholderEl = document.createElement('div');
    placeholderEl.className = 'fraction-field-placeholder fraction-field-placeholder--visible';
    placeholderEl.textContent = placeholder;
    placeholderEl.setAttribute('aria-hidden', 'true');
    fieldWrapper.appendChild(placeholderEl);

    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    const up = document.createElement('button');
    up.type = 'button';
    up.className = 'spin up';
    const down = document.createElement('button');
    down.type = 'button';
    down.className = 'spin down';
    spinner.appendChild(up);
    spinner.appendChild(down);
    fieldWrapper.appendChild(spinner);

    return { wrapper: fieldWrapper, input, placeholder: placeholderEl, up, down };
  }

  function refresh(options = {}) {
    return applyState({ ...options, silent: true, persist: false });
  }

  if (safeHost) {
    safeHost.textContent = '';
    safeHost.classList.add('fraction-inline-container');
    safeHost.dataset.fractionHoverType = FRACTION_HOVER_NUMERATOR_TYPE;

    const wrapper = document.createElement('span');
    wrapper.className = 'fraction-editor-wrapper fraction-editor-wrapper--inline';
    wrapper.dataset.fractionHoverType = FRACTION_HOVER_NUMERATOR_TYPE;
    elements.wrapper = wrapper;
    safeHost.appendChild(wrapper);
    registerHoverTarget(wrapper);

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
    wrapper.appendChild(ghostContainer);
    wrapper.appendChild(container);
    elements.container = container;
    registerHoverTarget(container);

    const infoBubble = document.createElement('div');
    infoBubble.className = 'fraction-info-bubble fraction-info-bubble--hidden';
    infoBubble.setAttribute('role', 'status');
    infoBubble.setAttribute('aria-live', 'polite');
    applyBackground(infoBubble);
    wrapper.appendChild(infoBubble);
    elements.infoBubble = infoBubble;

    const top = document.createElement('div');
    top.className = 'top';
    const numeratorField = createField({ wrapperClass: 'numerator', placeholder: 'n' });
    top.appendChild(numeratorField.wrapper);
    container.appendChild(top);

    const bar = document.createElement('div');
    bar.className = 'fraction-bar';
    bar.dataset.fractionHoverType = FRACTION_HOVER_NUMERATOR_TYPE;
    bar.setAttribute('aria-hidden', 'true');
    container.appendChild(bar);

    const bottom = document.createElement('div');
    bottom.className = 'bottom';
    const denominatorField = createField({ wrapperClass: 'denominator', placeholder: 'd' });
    bottom.appendChild(denominatorField.wrapper);
    container.appendChild(bottom);

    elements.numerator = numeratorField.input;
    elements.denominator = denominatorField.input;

    registerHoverTarget(safeHost);
    registerHoverTarget(numeratorField.wrapper);
    registerHoverTarget(denominatorField.wrapper);
    registerHoverTarget(numeratorField.input, { useFocus: true });
    registerHoverTarget(denominatorField.input, { useFocus: true });
    registerHoverTarget(bar);

    numeratorField.input.addEventListener('input', () => handleInputChange('numerator', 'input'));
    numeratorField.input.addEventListener('blur', () => handleInputChange('numerator', 'blur'));
    denominatorField.input.addEventListener('input', () => handleInputChange('denominator', 'input'));
    denominatorField.input.addEventListener('blur', () => handleInputChange('denominator', 'blur'));

    attachRepeat(numeratorField.up, () => adjustInput('numerator', +1));
    attachRepeat(numeratorField.down, () => adjustInput('numerator', -1));
    attachRepeat(denominatorField.up, () => adjustInput('denominator', +1));
    attachRepeat(denominatorField.down, () => adjustInput('denominator', -1));

    const storedNumerator = parsePositiveInt(load(numeratorKey));
    const storedDenominator = parsePositiveInt(load(denominatorKey));
    const initialNumerator = storedNumerator ?? parsePositiveInt(defaults.numerator);
    const initialDenominator = storedDenominator ?? parsePositiveInt(defaults.denominator);

    setFraction({ numerator: initialNumerator, denominator: initialDenominator }, {
      reveal: false,
      persist: false,
      silent: true,
      cause: 'init'
    });

    if (storedNumerator == null) clear(numeratorKey);
    if (storedDenominator == null) clear(denominatorKey);

    applyState({ reveal: false, persist: false, cause: 'init', silent: true });
    onChange({
      numerator: currentValues.numerator,
      denominator: currentValues.denominator,
      info: currentInfo,
      cause: 'init'
    });
  }

  return {
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
      clearHideTimer();
      currentMessage = '';
    }
  };
}

export default createFractionEditor;
