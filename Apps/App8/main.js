/**
 * App8 - Magnitudes Numéricas
 * Educational app for understanding numeric magnitudes (European scale)
 * Supports up to 19 digits (up to Trillions)
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
  animating: false
};

// DOM elements
let numberInput = null;
let magnitudesContainer = null;
let actionButton = null;
let errorPopup = null;
let popupBackdrop = null;

/**
 * Initialize the app
 */
function initApp() {
  const main = document.querySelector('main');

  // Create instruction text
  const instruction = document.createElement('div');
  instruction.className = 'instruction';
  instruction.textContent = 'Introduce el número que quieras';
  main.appendChild(instruction);

  // Create input container
  const inputContainer = document.createElement('div');
  inputContainer.className = 'input-container';

  // Create number input
  numberInput = document.createElement('input');
  numberInput.type = 'text';
  numberInput.className = 'number-input';
  numberInput.placeholder = 'Ejemplo: 4321';
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

  // Create error popup
  createErrorPopup();

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
 * Handle input changes (filter non-numeric characters)
 */
function handleInput(event) {
  // Remove any non-numeric characters
  event.target.value = event.target.value.replace(/\D/g, '');
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

  // Validation: Empty input
  if (value === '') {
    showError('Introduce un número');
    return;
  }

  // Validation: Too large (more than 19 digits)
  if (value.length > MAX_DIGITS) {
    showError('Número demasiado grande (máximo 19 dígitos)');
    return;
  }

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

  // Show "Otro número" button
  actionButton.style.display = 'block';
  state.animating = false;
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
 * Reset app to initial state
 */
function resetApp() {
  if (state.animating) return;

  state.currentNumber = '';
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
