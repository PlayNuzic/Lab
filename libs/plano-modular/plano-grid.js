/**
 * plano-grid.js - Grid DOM construction for plano-modular
 * Builds soundline, matrix, and timeline components
 */

/**
 * Build the main grid DOM structure
 * @param {HTMLElement} parent - Parent element to append grid to
 * @returns {Object} References to created DOM elements
 */
export function buildGridDOM(parent) {
  if (!parent) return null;

  // Create main container
  const container = document.createElement('div');
  container.className = 'plano-container';

  // Soundline (Y-axis: notes/rows)
  const soundlineContainer = document.createElement('div');
  soundlineContainer.className = 'plano-soundline-container';

  // Grid area (matrix + timeline)
  const gridArea = document.createElement('div');
  gridArea.className = 'plano-grid-area';

  // Matrix container (cells)
  const matrixContainer = document.createElement('div');
  matrixContainer.className = 'plano-matrix-container';

  // Timeline container (X-axis: columns/pulses)
  const timelineContainer = document.createElement('div');
  timelineContainer.className = 'plano-timeline-container';

  // Assemble structure
  gridArea.appendChild(matrixContainer);
  gridArea.appendChild(timelineContainer);
  container.appendChild(soundlineContainer);
  container.appendChild(gridArea);
  parent.appendChild(container);

  return {
    container,
    soundlineContainer,
    matrixContainer,
    timelineContainer,
    gridArea
  };
}

/**
 * Update the soundline (Y-axis labels)
 * @param {HTMLElement} container - Soundline container
 * @param {Array<{id, label, data}>} rows - Row definitions
 * @param {Object} options - Rendering options
 * @param {Function} options.labelFormatter - Custom label formatter (rowData) => string
 * @param {Function} options.onBoundary - Called for boundary rows (rowData) => boolean
 */
export function updateSoundline(container, rows, options = {}) {
  if (!container) return;

  const { labelFormatter, onBoundary } = options;

  // Preserve scroll position
  const savedScrollTop = container.scrollTop;

  // Clear and rebuild
  container.innerHTML = '';

  const soundlineRow = document.createElement('div');
  soundlineRow.className = 'plano-soundline-row';

  rows.forEach((row, rowIdx) => {
    const noteEl = document.createElement('div');
    noteEl.className = 'plano-soundline-note';
    noteEl.dataset.rowIndex = rowIdx;
    noteEl.dataset.rowId = row.id;

    // Copy row data to dataset
    if (row.data) {
      Object.entries(row.data).forEach(([key, value]) => {
        noteEl.dataset[key] = value;
      });
    }

    // Set label
    noteEl.textContent = labelFormatter ? labelFormatter(row) : row.label;

    // Mark boundary rows
    if (onBoundary && onBoundary(row)) {
      noteEl.classList.add('plano-boundary');
    }

    soundlineRow.appendChild(noteEl);
  });

  container.appendChild(soundlineRow);

  // Restore scroll position
  container.scrollTop = savedScrollTop;
}

/**
 * Update the matrix (cells grid)
 * @param {HTMLElement} container - Matrix container
 * @param {Array<{id, label, data}>} rows - Row definitions
 * @param {number} columns - Number of columns
 * @param {Object} options - Rendering options
 * @param {number} options.cellWidth - Width of each cell in pixels
 * @param {Function} options.isSelected - Check if cell is selected (rowId, colIndex) => boolean
 * @param {Function} options.cellFormatter - Custom cell content formatter (rowData, colIndex) => string|null
 * @param {Function} options.onCellClick - Cell click handler (rowData, colIndex, cellEl) => void
 */
export function updateMatrix(container, rows, columns, options = {}) {
  if (!container) return;

  const { cellWidth = 50, isSelected, cellFormatter, onCellClick } = options;

  // Preserve scroll position
  const savedScrollTop = container.scrollTop;
  const savedScrollLeft = container.scrollLeft;

  // Preserve playhead if it exists (will be restored after grid creation)
  const existingPlayhead = container.querySelector('.plano-playhead');

  // Clear container
  container.innerHTML = '';

  if (columns === 0 || rows.length === 0) return;

  // Create grid
  const grid = document.createElement('div');
  grid.className = 'plano-matrix';
  grid.style.gridTemplateColumns = `repeat(${columns}, ${cellWidth}px)`;
  grid.style.gridTemplateRows = `repeat(${rows.length}, var(--plano-cell-height, 32px))`;

  // Create cells
  rows.forEach((row, rowIdx) => {
    for (let colIdx = 0; colIdx < columns; colIdx++) {
      const cell = document.createElement('div');
      cell.className = 'plano-cell';
      cell.dataset.rowIndex = rowIdx;
      cell.dataset.rowId = row.id;
      cell.dataset.colIndex = colIdx;

      // Copy row data to cell dataset
      if (row.data) {
        Object.entries(row.data).forEach(([key, value]) => {
          cell.dataset[key] = value;
        });
      }

      // Check selection state
      if (isSelected && isSelected(row.id, colIdx)) {
        cell.classList.add('plano-selected');

        // Add label for selected cell
        const labelContent = cellFormatter ? cellFormatter(row, colIdx) : row.label;
        if (labelContent) {
          const label = document.createElement('span');
          label.className = 'plano-cell-label';
          label.textContent = labelContent;
          cell.appendChild(label);
        }
      }

      // Attach click handler
      if (onCellClick) {
        cell.addEventListener('click', () => onCellClick(row, colIdx, cell));
      }

      grid.appendChild(cell);
    }
  });

  container.appendChild(grid);

  // Restore playhead inside the new .plano-matrix
  if (existingPlayhead) {
    grid.appendChild(existingPlayhead);
  }

  // Restore scroll position
  container.scrollTop = savedScrollTop;
  container.scrollLeft = savedScrollLeft;
}

/**
 * Update the timeline (X-axis labels)
 * @param {HTMLElement} container - Timeline container
 * @param {number} columns - Number of columns
 * @param {Object} options - Rendering options
 * @param {number} options.cellWidth - Width of each cell in pixels
 * @param {Object} options.cycleConfig - Cycle configuration { compas, showCycle }
 * @param {Function} options.labelFormatter - Custom label formatter (colIndex, cycleConfig) => {label, cycle}
 */
export function updateTimeline(container, columns, options = {}) {
  if (!container) return;

  const {
    cellWidth = 50,
    cycleConfig = {},
    labelFormatter
  } = options;

  const { compas = columns, showCycle = true } = cycleConfig;

  // Preserve scroll position
  const savedScrollLeft = container.scrollLeft;

  // Clear container
  container.innerHTML = '';

  if (columns === 0) return;

  // Create timeline row
  const timelineRow = document.createElement('div');
  timelineRow.className = 'plano-timeline-row';
  timelineRow.style.gridTemplateColumns = `repeat(${columns}, ${cellWidth}px)`;

  for (let colIdx = 0; colIdx < columns; colIdx++) {
    const numEl = document.createElement('div');
    numEl.className = 'plano-timeline-number';
    numEl.dataset.colIndex = colIdx;
    numEl.style.marginLeft = '-4px';  // Align with grid cell borders

    let pulseNum, cycleNum;

    if (labelFormatter) {
      const result = labelFormatter(colIdx, cycleConfig);
      pulseNum = result.label;
      cycleNum = result.cycle;
    } else {
      // Default: pulse within cycle
      pulseNum = colIdx % compas;
      cycleNum = Math.floor(colIdx / compas) + 1;
    }

    // Mark cycle start (pulse 0)
    if (pulseNum === 0) {
      numEl.classList.add('plano-cycle-start');
    }

    // Build content with optional cycle superscript
    const pulseSpan = document.createElement('span');
    pulseSpan.className = 'plano-pulse-num';
    pulseSpan.textContent = pulseNum;
    numEl.appendChild(pulseSpan);

    if (showCycle && cycleNum !== undefined) {
      const cycleSpan = document.createElement('sup');
      cycleSpan.className = 'plano-cycle-num';
      cycleSpan.textContent = cycleNum;
      numEl.appendChild(cycleSpan);
    }

    timelineRow.appendChild(numEl);
  }

  container.appendChild(timelineRow);

  // Restore scroll position
  container.scrollLeft = savedScrollLeft;
}

/**
 * Update a single cell's selection state
 * Shows label with Note^Registry P^m format (registry and m as superscripts)
 * @param {HTMLElement} container - Matrix container
 * @param {string} rowId - Row identifier (e.g., "5r4")
 * @param {number} colIndex - Column index
 * @param {boolean} selected - Whether cell should be selected
 * @param {string} label - Label to show when selected (unused, kept for compatibility)
 * @param {Object} [options] - Additional options
 * @param {number} [options.compas] - Pulses per cycle (for modular pulse calculation)
 */
export function updateCellSelection(container, rowId, colIndex, selected, label = '', options = {}) {
  if (!container) return;

  const cell = container.querySelector(
    `.plano-cell[data-row-id="${rowId}"][data-col-index="${colIndex}"]`
  );

  if (!cell) return;

  if (selected) {
    cell.classList.add('plano-selected');
    // Add label with N^r P^m format
    if (!cell.querySelector('.plano-cell-label')) {
      const labelEl = document.createElement('span');
      labelEl.className = 'plano-cell-label';

      // Parse rowId (e.g., "5r4" → note=5, registry=4)
      const match = rowId.match(/^(\d+)r(\d+)$/);
      if (match) {
        const noteNum = match[1];
        const registry = match[2];

        // Calculate modular pulse (pulse within cycle)
        const compas = options.compas || 1;
        const moduloPulse = colIndex % compas;

        // Build label: N^r P^c (registry and cycle number as superscripts)
        const cycleNum = Math.floor(colIndex / compas) + 1;
        labelEl.innerHTML = `${noteNum}<sup>${registry}</sup> ${moduloPulse}<sup>${cycleNum}</sup>`;
      }

      cell.appendChild(labelEl);
    }
  } else {
    cell.classList.remove('plano-selected');
    // Remove label
    const labelEl = cell.querySelector('.plano-cell-label');
    if (labelEl) {
      labelEl.remove();
    }
  }
}

/**
 * Highlight a cell temporarily (e.g., during playback)
 * Shows a label with Note^Registry - Pulse^m (registry and m as superscripts)
 * @param {HTMLElement} container - Matrix container
 * @param {string} rowId - Row identifier (e.g., "5r4")
 * @param {number} colIndex - Column index (absolute pulse)
 * @param {number} duration - Highlight duration in ms (0 for permanent)
 * @param {Object} [options] - Additional options
 * @param {number} [options.compas] - Pulses per cycle (for modular pulse calculation)
 * @returns {Function} Function to remove highlight
 */
export function highlightCell(container, rowId, colIndex, duration = 0, options = {}) {
  if (!container) return () => {};

  const cell = container.querySelector(
    `.plano-cell[data-row-id="${rowId}"][data-col-index="${colIndex}"]`
  );

  if (!cell) return () => {};

  cell.classList.add('plano-highlight');

  // Add highlight label with Note^Registry - Pulse^m
  let highlightLabel = cell.querySelector('.plano-highlight-label');
  if (!highlightLabel) {
    highlightLabel = document.createElement('span');
    highlightLabel.className = 'plano-highlight-label';

    // Parse rowId (e.g., "5r4" → note=5, registry=4)
    const match = rowId.match(/^(\d+)r(\d+)$/);
    if (match) {
      const noteNum = match[1];
      const registry = match[2];

      // Calculate modular pulse (pulse within cycle)
      const compas = options.compas || 1;
      const moduloPulse = colIndex % compas;

      // Build label: N^r - P^c (registry and cycle number as superscripts)
      const cycleNum = Math.floor(colIndex / compas) + 1;
      highlightLabel.innerHTML = `${noteNum}<sup>${registry}</sup>-${moduloPulse}<sup>${cycleNum}</sup>`;
    }

    cell.appendChild(highlightLabel);
  }

  const removeHighlight = () => {
    cell.classList.remove('plano-highlight');
    // Remove highlight label
    const label = cell.querySelector('.plano-highlight-label');
    if (label) {
      label.remove();
    }
  };

  if (duration > 0) {
    setTimeout(removeHighlight, duration);
  }

  return removeHighlight;
}

/**
 * Highlight a timeline number temporarily
 * @param {HTMLElement} container - Timeline container
 * @param {number} colIndex - Column index
 * @param {number} duration - Highlight duration in ms (0 for permanent)
 * @returns {Function} Function to remove highlight
 */
export function highlightTimelineNumber(container, colIndex, duration = 0) {
  if (!container) return () => {};

  const numEl = container.querySelector(
    `.plano-timeline-number[data-col-index="${colIndex}"]`
  );

  if (!numEl) return () => {};

  numEl.classList.add('plano-highlight');

  const removeHighlight = () => {
    numEl.classList.remove('plano-highlight');
  };

  if (duration > 0) {
    setTimeout(removeHighlight, duration);
  }

  return removeHighlight;
}

/**
 * Clear all cell highlights
 * @param {HTMLElement} container - Matrix container
 */
export function clearCellHighlights(container) {
  if (!container) return;

  const highlighted = container.querySelectorAll('.plano-highlight');
  highlighted.forEach(el => el.classList.remove('plano-highlight'));
}

/**
 * Get cell width from CSS variable or computed style
 * @param {HTMLElement} container - Grid container
 * @returns {number} Cell width in pixels
 */
export function getCellWidth(container) {
  if (!container) return 50;

  const style = getComputedStyle(container);
  const cssValue = style.getPropertyValue('--plano-cell-width');

  if (cssValue) {
    return parseInt(cssValue, 10) || 50;
  }

  // Fallback: measure first cell
  const firstCell = container.querySelector('.plano-cell');
  if (firstCell) {
    return firstCell.offsetWidth;
  }

  return 50;
}

/**
 * Get cell height from CSS variable or computed style
 * @param {HTMLElement} container - Grid container
 * @returns {number} Cell height in pixels
 */
export function getCellHeight(container) {
  if (!container) return 32;

  const style = getComputedStyle(container);
  const cssValue = style.getPropertyValue('--plano-cell-height');

  if (cssValue) {
    return parseInt(cssValue, 10) || 32;
  }

  // Fallback: measure first cell
  const firstCell = container.querySelector('.plano-cell');
  if (firstCell) {
    return firstCell.offsetHeight;
  }

  return 32;
}
