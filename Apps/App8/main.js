/**
 * App8 - Magnitudes Numéricas
 * Educational app for understanding numeric magnitudes (European scale)
 * Supports up to 19 digits (up to Trillions)
 * Special mode: Concept of zero with interactive number line
 */

// Magnitude labels (European scale) - from highest to lowest
const MAGNITUDES = [
  'Trillones',                    // 10^18
  'Centenas de mil billones',     // 10^17
  'Decenas de mil billones',      // 10^16
  'Mil billones',                 // 10^15
  'Centenas de billones',         // 10^14
  'Decenas de billones',          // 10^13
  'Billones',                     // 10^12
  'Centenas de miles de millones', // 10^11
  'Decenas de miles de millones',  // 10^10
  'Miles de millones',            // 10^9
  'Centenas de millones',         // 10^8
  'Decenas de millones',          // 10^7
  'Millones',                     // 10^6
  'Centenas de millares',         // 10^5
  'Decenas de millares',          // 10^4
  'Millares',                     // 10^3
  'Centenas',                     // 10^2
  'Decenas',                      // 10^1
  'Unidades'                      // 10^0
];

const MAX_DIGITS = 19;

// State management
const state = {
  currentNumber: '',
  animating: false,
  hasZero: false,              // Tracks if current number contains zeros
  waitingForZero: false,       // Waiting for user to enter "0"
  zeroPhase: 0,                // Zero concept phase (0-6)
  selectedNumber: null,        // Selected number from timeline
  canSelectNumber: false       // Can select numbers from timeline
};

// DOM elements
let instructionText = null;
let numberInput = null;
let magnitudesContainer = null;
let actionButton = null;
let errorPopup = null;
let popupBackdrop = null;
let instructionPopup = null;  // App6-style popup
let timeline = null;           // Timeline container
let intervalBlock = null;      // Filling bar

/**
 * Initialize the app
 */
function initApp() {
  const main = document.querySelector('main');

  // Create instruction text
  instructionText = document.createElement('div');
  instructionText.className = 'instruction';
  instructionText.textContent = 'Introduce el número que quieras y pulsa Enter';
  main.appendChild(instructionText);

  // Create input container
  const inputContainer = document.createElement('div');
  inputContainer.className = 'input-container';

  // Create number input
  numberInput = document.createElement('input');
  numberInput.type = 'text';
  numberInput.className = 'number-input';
  numberInput.placeholder = 'Ejemplo: 3210';
  numberInput.addEventListener('keydown', handleInputKeydown);
  numberInput.addEventListener('input', handleInput);
  inputContainer.appendChild(numberInput);

  main.appendChild(inputContainer);

  // Create magnitudes container
  magnitudesContainer = document.createElement('div');
  magnitudesContainer.className = 'magnitudes-container';
  main.appendChild(magnitudesContainer);

  // Create action button
  actionButton = document.createElement('button');
  actionButton.className = 'action-button';
  actionButton.textContent = 'Otro número';
  actionButton.style.display = 'none';
  actionButton.addEventListener('click', resetApp);
  main.appendChild(actionButton);

  // Create popups
  createErrorPopup();
  createInstructionPopup();

  // Focus input
  numberInput.focus();
}

/**
 * Create error popup elements
 */
function createErrorPopup() {
  // Backdrop
  popupBackdrop = document.createElement('div');
  popupBackdrop.className = 'popup-backdrop';
  document.body.appendChild(popupBackdrop);

  // Popup
  errorPopup = document.createElement('div');
  errorPopup.className = 'error-popup';
  document.body.appendChild(errorPopup);
}

/**
 * Create instruction popup (App6 style)
 */
function createInstructionPopup() {
  instructionPopup = document.createElement('div');
  instructionPopup.className = 'instruction-popup';
  document.body.appendChild(instructionPopup);
}

/**
 * Handle input changes (filter non-numeric characters)
 * If waiting for zero, validate directly without Enter
 */
function handleInput(event) {
  // Remove any non-numeric characters
  event.target.value = event.target.value.replace(/\D/g, '');

  // If waiting for zero input, validate immediately
  if (state.waitingForZero && event.target.value !== '') {
    validateAndShowMagnitudes();
  }
}

/**
 * Handle keydown on input (Enter to validate)
 */
function handleInputKeydown(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    validateAndShowMagnitudes();
  }
}

/**
 * Validate input and show magnitudes
 */
function validateAndShowMagnitudes() {
  if (state.animating) return;

  const value = numberInput.value.trim();

  // Check if waiting for zero input
  if (state.waitingForZero) {
    if (value === '0') {
      startZeroExercise();
    } else {
      // Use instruction popup style for consistency
      showPopup('Por favor, introduce el número 0', 'Entendido', () => {
        hidePopup();
        numberInput.value = '';
        numberInput.focus();
      });
    }
    return;
  }

  // Normal validation
  if (value === '') {
    showError('Introduce un número');
    return;
  }

  if (value.length > MAX_DIGITS) {
    showError('Número demasiado grande (máximo 19 dígitos)');
    return;
  }

  // Detect if number contains zero (but is not "0" itself)
  state.hasZero = value.includes('0');

  // Valid number - show magnitudes
  state.currentNumber = value;
  showMagnitudes(value);
}

/**
 * Decompose number into magnitudes
 * Returns array of {digit, label} from highest non-zero magnitude to units
 */
function decompose(numberStr) {
  // Pad with leading zeros to get full 19 digits
  const padded = numberStr.padStart(MAX_DIGITS, '0');
  const digits = padded.split('').map(d => parseInt(d));

  // Find first non-zero digit
  let startIndex = digits.findIndex(d => d > 0);

  // If all zeros, show only "0 Unidades"
  if (startIndex === -1) {
    return [{ digit: 0, label: MAGNITUDES[MAX_DIGITS - 1] }];
  }

  // Build array from first non-zero to end (units)
  const result = [];
  for (let i = startIndex; i < MAX_DIGITS; i++) {
    result.push({
      digit: digits[i],
      label: MAGNITUDES[i]
    });
  }

  return result;
}

/**
 * Show magnitudes with cascade animation
 */
async function showMagnitudes(numberStr) {
  state.animating = true;
  numberInput.disabled = true;
  magnitudesContainer.innerHTML = '';

  // Decompose number
  const magnitudes = decompose(numberStr);

  // Create all magnitude items (hidden initially)
  const items = magnitudes.map(({ digit, label }) => {
    const item = document.createElement('div');
    item.className = 'magnitude-item';
    item.dataset.digit = digit;

    const numberEl = document.createElement('div');
    numberEl.className = 'magnitude-number';
    numberEl.textContent = digit;

    const labelEl = document.createElement('div');
    labelEl.className = 'magnitude-label';
    labelEl.textContent = label;

    item.appendChild(numberEl);
    item.appendChild(labelEl);

    return item;
  });

  // Add all items to container
  items.forEach(item => magnitudesContainer.appendChild(item));

  // Animate each item with cascade delay
  const ANIMATION_DELAY = 150; // ms between each magnitude

  for (let i = 0; i < items.length; i++) {
    await new Promise(resolve => setTimeout(resolve, ANIMATION_DELAY));
    requestAnimationFrame(() => {
      items[i].classList.add('show');
    });
  }

  // Wait for last animation to finish
  await new Promise(resolve => setTimeout(resolve, 600));

  // Check if number contains zero (and is not "0" itself)
  if (state.hasZero && numberStr !== '0') {
    highlightZeroMagnitudes();
  } else {
    // Normal flow - show "Otro número" button
    actionButton.style.display = 'block';
    state.animating = false;
  }
}

/**
 * Highlight magnitudes that contain zero with flash animation
 * Hide all magnitudes that DON'T contain zero
 */
function highlightZeroMagnitudes() {
  const allItems = magnitudesContainer.querySelectorAll('.magnitude-item');

  let zeroItemsCount = 0;

  // Hide all magnitudes that are NOT zero, keep zero items visible
  allItems.forEach(item => {
    if (item.dataset.digit === '0') {
      zeroItemsCount++;
      // Keep visible and add flash animation
      item.classList.add('highlight-zero');
      // Ensure it stays visible with inline styles (highest specificity)
      item.style.opacity = '1';
      item.style.display = 'flex';
      item.style.transform = 'scale(1)';
    } else {
      // Fade out non-zero items quickly
      item.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      item.style.opacity = '0';
      item.style.transform = 'scale(0)';
      setTimeout(() => {
        item.style.display = 'none';
      }, 300);
    }
  });

  if (zeroItemsCount === 0) return;

  // Wait for flash animation (3 pulses x 0.8s = 2.4s)
  setTimeout(() => {
    showZeroConceptPopup(zeroItemsCount);
  }, 2500);
}

/**
 * Show popup explaining zero concept
 * @param {number} count - Number of magnitudes with zero
 */
function showZeroConceptPopup(count = 1) {
  const text = count > 1
    ? 'El 0 indica la ausencia de valor en estas magnitudes'
    : 'El 0 indica la ausencia de valor en esta magnitud';

  showPopup(text, 'Continuar', prepareZeroExercise);
}

/**
 * Type text letter by letter (typing effect)
 * @param {HTMLElement} element - Element to type into
 * @param {string} text - Text to type
 * @param {number} speed - Milliseconds between each letter
 */
function typeText(element, text, speed = 80) {
  element.textContent = '';
  let i = 0;

  return new Promise(resolve => {
    const interval = setInterval(() => {
      if (i < text.length) {
        element.textContent += text[i];
        i++;
      } else {
        clearInterval(interval);
        resolve();
      }
    }, speed);
  });
}

/**
 * Prepare for zero exercise phase
 */
function prepareZeroExercise() {
  hidePopup();

  setTimeout(async () => {
    // Clean magnitudes
    magnitudesContainer.innerHTML = '';

    // Reset input
    numberInput.value = '';
    numberInput.disabled = false;

    // Change instruction text with typing animation
    await typeText(instructionText, 'Introduce ahora el número 0', 80);

    // Update state
    state.waitingForZero = true;
    state.hasZero = false;
    state.animating = false;

    // Focus input
    numberInput.focus();
  }, 300);
}

/**
 * Start zero exercise - show timeline with numbers 0-9
 */
async function startZeroExercise() {
  state.animating = true;
  numberInput.disabled = true;

  // Keep input visible, just disable it
  // instructionText stays visible
  // numberInput.parentElement stays visible

  // Create timeline
  createTimeline();

  // Draw numbers sequentially
  await drawNumbersSequentially();

  state.animating = false;
}

/**
 * Create timeline structure
 */
function createTimeline() {
  const main = document.querySelector('main');

  // Create timeline wrapper
  const timelineWrapper = document.createElement('div');
  timelineWrapper.className = 'timeline-wrapper';
  // Force display to override CSS !important rules
  timelineWrapper.style.display = 'block';

  // Create timeline
  timeline = document.createElement('div');
  timeline.className = 'timeline';

  timelineWrapper.appendChild(timeline);
  main.appendChild(timelineWrapper);
}

/**
 * Draw numbers 0-9 sequentially with animation
 */
async function drawNumbersSequentially() {
  timeline.innerHTML = '';

  // Draw numbers 0-9 with 300ms delay between each
  for (let i = 0; i <= 9; i++) {
    await new Promise(resolve => setTimeout(resolve, 300));
    drawNumber(i);
  }

  // After all numbers are drawn, show popup
  setTimeout(() => {
    showPopup('Escoge un número de la línea');
    instructionPopup.classList.add('scale-pulse');
    state.canSelectNumber = true;
  }, 500);
}

/**
 * Draw a single number on the timeline (adapted from App6)
 */
function drawNumber(num) {
  // Calculate position (0 at 0%, 9 at 100%)
  const totalNumbers = 10;
  const position = (num / (totalNumbers - 1)) * 100; // percentage

  // Create pulse (visual dot)
  const pulse = document.createElement('div');
  pulse.className = 'pulse';
  pulse.style.left = `${position}%`;
  pulse.dataset.num = num;

  // Add click handler to pulse
  pulse.addEventListener('click', () => handleNumberClick(num));

  timeline.appendChild(pulse);

  // Create pulse number (the actual number text)
  const pulseNumber = document.createElement('div');
  pulseNumber.className = 'pulse-number fade-in';
  pulseNumber.textContent = num;
  pulseNumber.style.left = `${position}%`;
  pulseNumber.dataset.num = num;

  // Add click handler
  pulseNumber.addEventListener('click', () => handleNumberClick(num));

  timeline.appendChild(pulseNumber);
}

/**
 * Handle number click on timeline
 */
function handleNumberClick(num) {
  if (!state.canSelectNumber) return;

  // Validation: clicking on zero
  if (num === 0) {
    showPopup('Selecciona otro número', 'Entendido', hidePopup);
    return;
  }

  // Valid selection (1-9)
  state.canSelectNumber = false;
  state.selectedNumber = num;

  // Hide current popup
  hidePopup();

  // Mark as selected
  const pulseNumber = timeline.querySelector(`.pulse-number[data-num="${num}"]`);
  const pulse = timeline.querySelector(`.pulse[data-num="${num}"]`);

  if (pulseNumber) {
    pulseNumber.classList.add('selected');
  }
  if (pulse) {
    pulse.classList.add('selected');
  }

  // Start filling bar animation
  setTimeout(() => {
    animateFillingBar(num);
  }, 300);
}

/**
 * Animate filling bar from 0 to selected number (adapted from App6)
 */
function animateFillingBar(selectedNum) {
  // Calculate positions
  const pulse0 = timeline.querySelector(`.pulse[data-num="0"]`);
  const pulseSelected = timeline.querySelector(`.pulse[data-num="${selectedNum}"]`);

  if (!pulse0 || !pulseSelected) return;

  const pos0 = parseFloat(pulse0.style.left);
  const posSelected = parseFloat(pulseSelected.style.left);

  // Create interval block (filling bar)
  intervalBlock = document.createElement('div');
  intervalBlock.className = 'interval-block';
  intervalBlock.style.left = `${pos0}%`;
  intervalBlock.style.width = '0%'; // Start from 0
  intervalBlock.style.transition = 'width 1.5s ease, opacity 1.5s ease';

  timeline.appendChild(intervalBlock);

  // Force reflow to trigger animation
  intervalBlock.offsetHeight;

  // Animate to target width
  requestAnimationFrame(() => {
    intervalBlock.style.width = `${posSelected - pos0}%`;
    intervalBlock.style.opacity = '0.8';
  });

  // After animation completes, show final popup
  setTimeout(() => {
    showFinalMovementPopup(selectedNum);
  }, 1700); // 1.5s animation + 200ms margin
}

/**
 * Show final popup explaining movement concept
 */
function showFinalMovementPopup(selectedNum) {
  showPopup(
    `Acabamos de crear un movimiento al medir la distancia entre el 0 y ${selectedNum}`,
    'Volver a probar',
    resetToInitial
  );
}

/**
 * Reset to initial state (complete reset)
 */
function resetToInitial() {
  hidePopup();

  setTimeout(() => {
    // Remove timeline if it exists
    if (timeline) {
      const timelineWrapper = timeline.closest('.timeline-wrapper');
      if (timelineWrapper) {
        timelineWrapper.remove();
      }
      timeline = null;
    }

    // Remove interval block if it exists
    if (intervalBlock) {
      intervalBlock.remove();
      intervalBlock = null;
    }

    // Reset state
    state.currentNumber = '';
    state.animating = false;
    state.hasZero = false;
    state.waitingForZero = false;
    state.zeroPhase = 0;
    state.selectedNumber = null;
    state.canSelectNumber = false;

    // Reset DOM
    instructionText.textContent = 'Introduce el número que quieras';
    numberInput.value = '';
    numberInput.disabled = false;
    magnitudesContainer.innerHTML = '';
    actionButton.style.display = 'none';

    // Focus input
    numberInput.focus();
  }, 300);
}

/**
 * Show popup (App6 style)
 */
function showPopup(text, buttonText = null, onButtonClick = null) {
  instructionPopup.innerHTML = `<p>${text}</p>`;

  if (buttonText) {
    const button = document.createElement('button');
    button.textContent = buttonText;
    button.addEventListener('click', onButtonClick || hidePopup);
    instructionPopup.appendChild(button);
  }

  // Force reflow
  instructionPopup.offsetHeight;
  instructionPopup.classList.add('show');
}

/**
 * Hide popup
 */
function hidePopup() {
  instructionPopup.classList.remove('show', 'scale-intro', 'scale-pulse');
}

/**
 * Show error popup
 */
function showError(message) {
  // Set message
  errorPopup.innerHTML = `
    <p>${message}</p>
    <button onclick="hideError()">Entendido</button>
  `;

  // Show backdrop and popup
  requestAnimationFrame(() => {
    popupBackdrop.classList.add('show');
    errorPopup.classList.add('show');
  });
}

/**
 * Hide error popup
 */
function hideError() {
  popupBackdrop.classList.remove('show');
  errorPopup.classList.remove('show');
  numberInput.focus();
}

// Make hideError global so it can be called from inline onclick
window.hideError = hideError;

/**
 * Reset app to initial state (normal flow)
 */
function resetApp() {
  if (state.animating) return;

  state.currentNumber = '';
  state.hasZero = false;
  numberInput.value = '';
  numberInput.disabled = false;
  magnitudesContainer.innerHTML = '';
  actionButton.style.display = 'none';
  numberInput.focus();
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
