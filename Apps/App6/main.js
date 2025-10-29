/**
 * App6 - Los Números
 * Educational gamified app introducing numbers on a timeline
 * No audio, guided experience only
 */

// State management
const state = {
  step: 0, // 0: inicio, 1: números dibujados, 2: primer número seleccionado, etc.
  selectedNumbers: new Set(),
  numbersDrawn: false,
  canSelect: false,
  singleSelectDone: false,
  multiSelectMode: false,
  firstSelectedNumber: null,
  // Drag selection state
  drag: {
    isDragging: false,
    dragMode: 'select', // 'select' or 'deselect'
    lastNum: null
  }
};

// DOM elements
let timeline = null;
let popup = null;
let numberVisualContainer = null;
let startOverlay = null;

/**
 * Initialize the app
 */
function initApp() {
  // Create timeline container
  const timelineWrapper = document.querySelector('.timeline-wrapper');
  if (!timelineWrapper) {
    const main = document.querySelector('main');
    const wrapper = document.createElement('section');
    wrapper.className = 'timeline-wrapper';
    wrapper.id = 'timelineWrapper';
    main.appendChild(wrapper);

    timeline = document.createElement('section');
    timeline.className = 'timeline';
    timeline.id = 'timeline';
    wrapper.appendChild(timeline);
  } else {
    timeline = document.querySelector('.timeline');
  }

  // Create instruction popup
  popup = document.createElement('div');
  popup.className = 'instruction-popup';
  document.body.appendChild(popup);

  // Create number visual container
  numberVisualContainer = document.createElement('div');
  numberVisualContainer.className = 'number-visual-container';
  const main = document.querySelector('main');
  main.appendChild(numberVisualContainer);

  // Create number visual SVG
  const visual = document.createElement('div');
  visual.className = 'number-visual';
  visual.innerHTML = '<svg viewBox="0 0 240 240" id="numberSvg"></svg>';
  numberVisualContainer.appendChild(visual);

  // Initially hide visual (will show when reaching deselection step)
  hideVisualNumber();

  // Create start overlay
  startOverlay = document.createElement('div');
  startOverlay.className = 'start-overlay';
  startOverlay.textContent = 'Toca para empezar';
  document.body.appendChild(startOverlay);

  // Start overlay click handler
  startOverlay.addEventListener('click', handleStart);

  // Setup drag selection for numbers
  setupDragSelection();
}

/**
 * Reset state for new cycle
 */
function resetState() {
  state.step = 0;
  state.selectedNumbers.clear();
  state.numbersDrawn = false;
  state.canSelect = false;
  state.singleSelectDone = false;
  state.multiSelectMode = false;
  state.firstSelectedNumber = null;
}

/**
 * Handle start click
 */
function handleStart() {
  resetState(); // Reset state for each new cycle
  startOverlay.classList.add('hidden');
  hideVisualNumber(); // Ensure visual is hidden
  showPopup('Los números');

  // Add scale intro animation to initial popup
  popup.classList.add('scale-intro');

  // Wait a moment, then start drawing numbers
  setTimeout(() => {
    drawNumbersSequentially();
  }, 1500);
}

/**
 * Hide visual number container
 */
function hideVisualNumber() {
  const svg = document.getElementById('numberSvg');
  if (svg) svg.innerHTML = '';
  if (numberVisualContainer) {
    numberVisualContainer.classList.add('hidden');
  }
}

/**
 * Show popup with text and optional button
 */
function showPopup(text, buttonText = null, onButtonClick = null) {
  popup.innerHTML = `<p>${text}</p>`;

  if (buttonText) {
    const button = document.createElement('button');
    button.textContent = buttonText;
    button.addEventListener('click', onButtonClick || hidePopup);
    popup.appendChild(button);
  }

  // Force reflow
  popup.offsetHeight;
  popup.classList.add('show');
}

/**
 * Hide popup
 */
function hidePopup() {
  popup.classList.remove('show', 'scale-intro', 'scale-pulse');
}

/**
 * Add button to existing popup (for delayed button appearance)
 */
function addButtonToPopup(buttonText, onButtonClick) {
  // Check if popup already has a button, if so remove it
  const existingButton = popup.querySelector('button');
  if (existingButton) {
    existingButton.remove();
  }

  // Add new button
  const button = document.createElement('button');
  button.textContent = buttonText;
  button.addEventListener('click', onButtonClick || hidePopup);
  popup.appendChild(button);

  // Add fade-in animation to button
  button.style.opacity = '0';
  button.style.transition = 'opacity 0.3s ease';
  setTimeout(() => {
    button.style.opacity = '1';
  }, 50);
}

/**
 * Draw numbers 1-9 sequentially with animation
 */
async function drawNumbersSequentially() {
  // Clear timeline
  timeline.innerHTML = '';

  // Draw numbers 1-9 with 300ms delay between each
  for (let i = 1; i <= 9; i++) {
    await new Promise(resolve => setTimeout(resolve, 300));
    drawNumber(i);
  }

  state.numbersDrawn = true;
  state.step = 1;

  // After all numbers are drawn, update popup with scale animation
  setTimeout(() => {
    showPopup('Escoge un número');
    popup.classList.add('scale-pulse');
    state.canSelect = true;
  }, 500);
}

/**
 * Draw a single number on the timeline
 */
function drawNumber(num) {
  // Calculate position (extremes exact: 1 at 0%, 9 at 100%)
  const totalNumbers = 9;
  const position = ((num - 1) / (totalNumbers - 1)) * 100; // percentage

  // Create pulse (visual dot)
  const pulse = document.createElement('div');
  pulse.className = 'pulse';
  pulse.style.left = `${position}%`;
  pulse.dataset.num = num;

  // Add click handler to pulse
  pulse.addEventListener('click', () => handleNumberClick(num));

  // Add pointer enter handler for drag selection to pulse
  pulse.addEventListener('pointerenter', () => handleNumberDragEnter(num));

  timeline.appendChild(pulse);

  // Create pulse number (the actual number text)
  const pulseNumber = document.createElement('div');
  pulseNumber.className = 'pulse-number fade-in';
  pulseNumber.textContent = num;
  pulseNumber.style.left = `${position}%`;
  pulseNumber.dataset.num = num;

  // Add click handler
  pulseNumber.addEventListener('click', () => handleNumberClick(num));

  // Add pointer enter handler for drag selection
  pulseNumber.addEventListener('pointerenter', () => handleNumberDragEnter(num));

  timeline.appendChild(pulseNumber);
}

/**
 * Handle number click
 */
function handleNumberClick(num) {
  if (!state.canSelect) return;

  const pulseNumber = timeline.querySelector(`.pulse-number[data-num="${num}"]`);
  const pulse = timeline.querySelector(`.pulse[data-num="${num}"]`);

  // Step 1: First selection (single number)
  if (state.step === 1 && !state.singleSelectDone) {
    // Select the number and pulse (KEEP selected, don't deselect later)
    pulseNumber.classList.add('selected');
    if (pulse) pulse.classList.add('selected');
    state.firstSelectedNumber = num;
    state.singleSelectDone = true;
    state.canSelect = false;

    // Lock all numbers and pulses temporarily
    timeline.querySelectorAll('.pulse-number').forEach(pn => {
      pn.classList.add('locked');
    });
    timeline.querySelectorAll('.pulse').forEach(p => {
      p.classList.add('locked');
    });

    // Start flash animation immediately
    pulseNumber.classList.add('flash');

    // After flash animation (3 cycles of 0.8s = 2.4s), show popup with "Continuar" button
    setTimeout(() => {
      pulseNumber.classList.remove('flash');
      showPopup('Muy bien! Has escogido una posición en la línea numérica.', 'Continuar', () => {
        hidePopup();
        showQuantityConcept(num);
      });
    }, 2400);

    return;
  }

  // Step 2: Multiple selection
  if (state.step === 2 && state.multiSelectMode) {
    if (state.selectedNumbers.has(num)) {
      // Deselect
      state.selectedNumbers.delete(num);
      pulseNumber.classList.remove('selected');
      if (pulse) pulse.classList.remove('selected');
    } else {
      // Select
      state.selectedNumbers.add(num);
      pulseNumber.classList.add('selected');
      if (pulse) pulse.classList.add('selected');
    }

    // Update visual
    updateVisualNumber(state.selectedNumbers.size);
    return;
  }

  // Step 3: Deselection mode
  if (state.step === 3) {
    if (state.selectedNumbers.has(num)) {
      // Deselect
      state.selectedNumbers.delete(num);
      pulseNumber.classList.remove('selected');
      if (pulse) pulse.classList.remove('selected');

      // Update visual
      updateVisualNumber(state.selectedNumbers.size);

      // Check if all deselected (reached 0)
      if (state.selectedNumbers.size === 0) {
        state.canSelect = false;

        // Flash the zero in visual
        const zeroText = document.querySelector('#numberSvg .number-zero');
        if (zeroText) {
          zeroText.classList.add('flash');
          setTimeout(() => zeroText.classList.remove('flash'), 600);
        }

        // After flash, compress timeline and add zero
        setTimeout(() => {
          compressTimelineAndAddZero();
        }, 800);
      }
    }
  }
}

/**
 * Handle "Hecho" button click
 */
function handleDoneSelecting() {
  // Validation: Check if at least one number is selected
  if (state.selectedNumbers.size === 0) {
    hidePopup();
    setTimeout(() => {
      showPopup('Por favor, escoge al menos un número.', 'Hecho', handleDoneSelecting);
    }, 300);
    return; // Stay in step 2 selection mode
  }

  // Valid selection - proceed to deselection step
  hidePopup();
  state.step = 3;
  state.multiSelectMode = false;

  // Show visual with current selection count
  updateVisualNumber(state.selectedNumbers.size);

  // Show deselection instruction
  setTimeout(() => {
    showPopup('Bien! Tienes varios números escogidos, que además son una cantidad. Ahora prueba a deseleccionar los números escogidos. ¿Qué te queda?');
  }, 300);
}

/**
 * Show quantity concept - illuminate numbers 1 to selectedNum
 */
function showQuantityConcept(selectedNum) {
  // Show popup WITHOUT button first
  showPopup('también puede ser una cantidad');

  // Ensure visual container is visible
  numberVisualContainer.classList.remove('hidden');

  // Show visual dots for the quantity immediately
  updateVisualNumber(selectedNum);

  // Start animation immediately while popup is visible
  setTimeout(() => {
    // Illuminate all numbers from 1 to selectedNum (without flash)
    for (let i = 1; i <= selectedNum; i++) {
      const pn = timeline.querySelector(`.pulse-number[data-num="${i}"]`);
      const p = timeline.querySelector(`.pulse[data-num="${i}"]`);
      if (pn) pn.classList.add('selected');
      if (p) p.classList.add('selected');
    }

    // Apply scale x2 to the originally selected number after a brief delay
    setTimeout(() => {
      const selectedPn = timeline.querySelector(`.pulse-number[data-num="${selectedNum}"]`);
      if (selectedPn) {
        selectedPn.style.transform = 'translateX(-50%) scale(2)';
        selectedPn.style.transition = 'transform 0.3s ease';

        // Wait a moment with scale x2, then return to normal but keep selected
        setTimeout(() => {
          selectedPn.style.transform = 'translateX(-50%) scale(1.15)'; // Selected state

          // After animation completes, add "Continuar" button to popup
          setTimeout(() => {
            addButtonToPopup('Continuar', () => {
              // Hide visual dots when continuing
              hideVisualNumber();
              hidePopup();
              setTimeout(() => {
                showDistanceConcept(selectedNum);
              }, 300);
            });
          }, 300);
        }, 800);
      } else {
        // Fallback if element not found
        setTimeout(() => {
          addButtonToPopup('Continuar', () => {
            hideVisualNumber();
            hidePopup();
            setTimeout(() => {
              showDistanceConcept(selectedNum);
            }, 300);
          });
        }, 300);
      }
    }, 300);
  }, 300);
}

/**
 * Show distance concept - bar filling from 1 to selectedNum (App5 style)
 */
function showDistanceConcept(selectedNum) {
  // Show popup WITHOUT button first (lowercase 'o')
  showPopup('o una distancia');

  // Start bar animation immediately while popup is visible
  setTimeout(() => {
    // Calculate positions of pulse 1 and selected pulse
    const pulse1 = timeline.querySelector(`.pulse[data-num="1"]`);
    const pulseSelected = timeline.querySelector(`.pulse[data-num="${selectedNum}"]`);

    if (!pulse1 || !pulseSelected) {
      // Fallback if elements not found - add button and continue
      setTimeout(() => {
        addButtonToPopup('Continuar', () => {
          hidePopup();
          setTimeout(() => {
            continueToMultipleSelection();
          }, 300);
        });
      }, 300);
      return;
    }

    const pos1 = parseFloat(pulse1.style.left);
    const posSelected = parseFloat(pulseSelected.style.left);

    // Create interval block (App5 style)
    const intervalBlock = document.createElement('div');
    intervalBlock.className = 'interval-block';
    intervalBlock.style.left = `${pos1}%`;
    intervalBlock.style.width = '0%'; // Start from 0
    intervalBlock.style.transition = 'width 1.5s ease, opacity 1.5s ease';

    timeline.appendChild(intervalBlock);

    // Force reflow to trigger animation
    intervalBlock.offsetHeight;

    // Animate to target width
    requestAnimationFrame(() => {
      intervalBlock.style.width = `${posSelected - pos1}%`;
      intervalBlock.style.opacity = '0.8';
    });

    // After animation completes, add button to popup
    setTimeout(() => {
      addButtonToPopup('Continuar', () => {
        hidePopup();

        // Remove bar and clean up
        setTimeout(() => {
          intervalBlock.remove();

          // Clear illuminated numbers and reset transforms
          timeline.querySelectorAll('.pulse-number').forEach(pn => {
            pn.classList.remove('selected', 'locked');
            pn.style.transform = '';
            pn.style.transition = '';
          });

          // Continue with multiple selection
          setTimeout(() => {
            continueToMultipleSelection();
          }, 300);
        }, 300);
      });
    }, 1700); // 1.5s animation + 200ms margin
  }, 300);
}

/**
 * Continue to multiple selection step
 */
function continueToMultipleSelection() {
  state.step = 2;
  state.multiSelectMode = true;
  state.selectedNumbers.clear();

  // Clear all selections and locks from previous step
  timeline.querySelectorAll('.pulse-number').forEach(pn => {
    pn.classList.remove('selected', 'locked');
    pn.style.transform = '';
    pn.style.transition = '';
  });
  timeline.querySelectorAll('.pulse').forEach(p => {
    p.classList.remove('selected', 'locked');
  });

  showPopup(
    'Ahora, escoge varios números.',
    'Hecho',
    handleDoneSelecting
  );

  state.canSelect = true;
}

/**
 * Update visual number (dots formation or zero)
 */
function updateVisualNumber(count) {
  const svg = document.getElementById('numberSvg');
  if (!svg) return;

  svg.innerHTML = '';

  // Ensure container is visible
  if (numberVisualContainer) {
    numberVisualContainer.classList.remove('hidden');
  }

  const centerX = 120;
  const centerY = 120;
  const dotRadius = 36; // 6x the timeline pulse size (12px -> 72px diameter)
  const spacing = 80; // Increased spacing for larger dots

  if (count === 0) {
    // Show large "0" text
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', centerX);
    text.setAttribute('y', centerY);
    text.setAttribute('class', 'number-zero');
    text.textContent = '0';
    svg.appendChild(text);
    return;
  }

  // Generate dot positions based on count
  const positions = getDotPositions(count, centerX, centerY, spacing, dotRadius);

  // Create circles for each position
  positions.forEach(pos => {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', pos.x);
    circle.setAttribute('cy', pos.y);
    circle.setAttribute('r', dotRadius);
    circle.setAttribute('class', 'number-dot');
    svg.appendChild(circle);
  });
}

/**
 * Get dot positions for a given count
 */
function getDotPositions(count, centerX, centerY, spacing, dotRadius) {
  const positions = [];

  switch (count) {
    case 1:
      // Single dot centered
      positions.push({ x: centerX, y: centerY });
      break;

    case 2:
      // Horizontal line
      positions.push(
        { x: centerX - spacing / 2, y: centerY },
        { x: centerX + spacing / 2, y: centerY }
      );
      break;

    case 3:
      // Triangle: 1 top, 2 bottom
      positions.push(
        { x: centerX, y: centerY - spacing / 2 },
        { x: centerX - spacing / 2, y: centerY + spacing / 2 },
        { x: centerX + spacing / 2, y: centerY + spacing / 2 }
      );
      break;

    case 4:
      // Square 2x2
      positions.push(
        { x: centerX - spacing / 2, y: centerY - spacing / 2 },
        { x: centerX + spacing / 2, y: centerY - spacing / 2 },
        { x: centerX - spacing / 2, y: centerY + spacing / 2 },
        { x: centerX + spacing / 2, y: centerY + spacing / 2 }
      );
      break;

    case 5:
      // Pyramid without top: 3 bottom, 2 middle
      positions.push(
        // Bottom row (3)
        { x: centerX - spacing, y: centerY + spacing / 2 },
        { x: centerX, y: centerY + spacing / 2 },
        { x: centerX + spacing, y: centerY + spacing / 2 },
        // Middle row (2)
        { x: centerX - spacing / 2, y: centerY - spacing / 2 },
        { x: centerX + spacing / 2, y: centerY - spacing / 2 }
      );
      break;

    case 6:
      // Complete pyramid: 3-2-1
      positions.push(
        // Bottom row (3)
        { x: centerX - spacing, y: centerY + spacing / 2 },
        { x: centerX, y: centerY + spacing / 2 },
        { x: centerX + spacing, y: centerY + spacing / 2 },
        // Middle row (2)
        { x: centerX - spacing / 2, y: centerY - spacing / 4 },
        { x: centerX + spacing / 2, y: centerY - spacing / 4 },
        // Top row (1)
        { x: centerX, y: centerY - spacing }
      );
      break;

    case 7:
      // Incomplete pyramid: 4 bottom, 3 top
      positions.push(
        // Bottom row (4)
        { x: centerX - spacing * 1.5, y: centerY + spacing / 2 },
        { x: centerX - spacing / 2, y: centerY + spacing / 2 },
        { x: centerX + spacing / 2, y: centerY + spacing / 2 },
        { x: centerX + spacing * 1.5, y: centerY + spacing / 2 },
        // Top row (3)
        { x: centerX - spacing, y: centerY - spacing / 2 },
        { x: centerX, y: centerY - spacing / 2 },
        { x: centerX + spacing, y: centerY - spacing / 2 }
      );
      break;

    case 8:
      // Rectangle 4x2: 4 bottom, 4 top
      positions.push(
        // Bottom row (4)
        { x: centerX - spacing * 1.5, y: centerY + spacing / 2 },
        { x: centerX - spacing / 2, y: centerY + spacing / 2 },
        { x: centerX + spacing / 2, y: centerY + spacing / 2 },
        { x: centerX + spacing * 1.5, y: centerY + spacing / 2 },
        // Top row (4)
        { x: centerX - spacing * 1.5, y: centerY - spacing / 2 },
        { x: centerX - spacing / 2, y: centerY - spacing / 2 },
        { x: centerX + spacing / 2, y: centerY - spacing / 2 },
        { x: centerX + spacing * 1.5, y: centerY - spacing / 2 }
      );
      break;

    case 9:
      // Square 3x3
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          positions.push({
            x: centerX - spacing + col * spacing,
            y: centerY - spacing + row * spacing
          });
        }
      }
      break;
  }

  return positions;
}

/**
 * Compress timeline and add zero (keeps all numbers 0-9)
 * Instead of removing 9, compresses all numbers to make space for 0
 */
function compressTimelineAndAddZero() {
  // Get current numbers (1-9)
  const currentNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  // Recalculate positions for 10 numbers (0-9) distributed from 0% to 100%
  currentNumbers.forEach((num, index) => {
    const newIndex = index + 1; // Number 1 moves to index 1 (second position)
    const newPosition = (newIndex / 9) * 100; // 10 numbers: 0,1,2,3,4,5,6,7,8,9

    const pn = timeline.querySelector(`.pulse-number[data-num="${num}"]`);
    const p = timeline.querySelector(`.pulse[data-num="${num}"]`);

    if (pn) {
      pn.style.transition = 'left 0.8s ease';
      pn.style.left = `${newPosition}%`;
    }
    if (p) {
      p.style.transition = 'left 0.8s ease';
      p.style.left = `${newPosition}%`;
    }
  });

  // After compression completes, create the 0 at position 0%
  setTimeout(() => {
    // Create pulse for 0
    const zeroPulse = document.createElement('div');
    zeroPulse.className = 'pulse';
    zeroPulse.style.left = '0%';
    zeroPulse.dataset.num = 0;
    timeline.insertBefore(zeroPulse, timeline.firstChild);

    // Create pulse number for 0 with initial animation
    const zeroPulseNumber = document.createElement('div');
    zeroPulseNumber.className = 'pulse-number zero-initial disabled';
    zeroPulseNumber.textContent = '0';
    zeroPulseNumber.style.left = '0%';
    zeroPulseNumber.dataset.num = 0;
    timeline.insertBefore(zeroPulseNumber, timeline.firstChild);

    // Clean up transitions
    setTimeout(() => {
      timeline.querySelectorAll('.pulse, .pulse-number').forEach(el => {
        el.style.transition = '';
      });
    }, 100);

    // Show final popup after zero animation completes
    setTimeout(() => {
      hidePopup();
      setTimeout(() => {
        showPopup('El 0 puede ser una cantidad, una posición, o un eje.');
        state.step = 5; // Final state
      }, 500);
    }, 1500);

  }, 800); // Wait for compression animation to complete
}

/**
 * Handle number drag enter (for drag selection)
 */
function handleNumberDragEnter(num) {
  if (!state.drag.isDragging) return;
  if (!state.canSelect) return;
  if (state.drag.lastNum === num) return;

  state.drag.lastNum = num;

  const pulseNumber = timeline.querySelector(`.pulse-number[data-num="${num}"]`);
  const pulse = timeline.querySelector(`.pulse[data-num="${num}"]`);
  if (!pulseNumber) return;

  // Step 2: Multiple selection with drag
  if (state.step === 2 && state.multiSelectMode) {
    if (state.drag.dragMode === 'select') {
      if (!state.selectedNumbers.has(num)) {
        state.selectedNumbers.add(num);
        pulseNumber.classList.add('selected');
        if (pulse) pulse.classList.add('selected');
        updateVisualNumber(state.selectedNumbers.size);
      }
    } else { // deselect
      if (state.selectedNumbers.has(num)) {
        state.selectedNumbers.delete(num);
        pulseNumber.classList.remove('selected');
        if (pulse) pulse.classList.remove('selected');
        updateVisualNumber(state.selectedNumbers.size);
      }
    }
  }

  // Step 3: Deselection mode with drag
  if (state.step === 3) {
    if (state.drag.dragMode === 'deselect' && state.selectedNumbers.has(num)) {
      state.selectedNumbers.delete(num);
      pulseNumber.classList.remove('selected');
      if (pulse) pulse.classList.remove('selected');
      updateVisualNumber(state.selectedNumbers.size);

      // Check if all deselected (reached 0)
      if (state.selectedNumbers.size === 0) {
        state.canSelect = false;

        // Flash the zero in visual
        const zeroText = document.querySelector('#numberSvg .number-zero');
        if (zeroText) {
          zeroText.classList.add('flash');
          setTimeout(() => zeroText.classList.remove('flash'), 600);
        }

        // After flash, compress timeline and add zero
        setTimeout(() => {
          compressTimelineAndAddZero();
        }, 800);
      }
    }
  }
}

/**
 * Setup drag selection on timeline
 */
function setupDragSelection() {
  if (!timeline) return;

  const handlePointerDown = (event) => {
    if (!state.canSelect) return;

    // Handle clicks on pulse numbers OR pulses
    const target = event.target.closest('.pulse-number') || event.target.closest('.pulse');
    if (!target || !target.dataset.num) return;

    const num = parseInt(target.dataset.num, 10);
    if (isNaN(num)) return;

    // Determine drag mode based on current selection
    if (state.step === 2 && state.multiSelectMode) {
      state.drag.dragMode = state.selectedNumbers.has(num) ? 'deselect' : 'select';
    } else if (state.step === 3) {
      state.drag.dragMode = 'deselect';
    } else {
      state.drag.dragMode = 'select';
    }

    state.drag.isDragging = true;
    state.drag.lastNum = num;
  };

  const handlePointerUp = () => {
    if (state.drag.isDragging) {
      state.drag.isDragging = false;
      state.drag.lastNum = null;
    }
  };

  const handlePointerCancel = () => {
    state.drag.isDragging = false;
    state.drag.lastNum = null;
  };

  timeline.addEventListener('pointerdown', handlePointerDown);
  document.addEventListener('pointerup', handlePointerUp);
  document.addEventListener('pointercancel', handlePointerCancel);
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
