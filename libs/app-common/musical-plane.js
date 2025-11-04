// libs/app-common/musical-plane.js
// Modular 2D grid system for musical applications

/**
 * Creates a 2D musical plane with interactive cells at axis intersections
 *
 * @param {Object} config - Configuration object
 * @param {HTMLElement} config.container - Container for the grid
 * @param {Object} config.verticalAxis - Vertical axis controller
 * @param {Function} config.verticalAxis.getPosition - (index) => {top: px, height: px}
 * @param {Function} config.verticalAxis.getCount - () => number of divisions
 * @param {Object} config.horizontalAxis - Horizontal axis controller
 * @param {Function} config.horizontalAxis.getPosition - (index) => {left: px, width: px}
 * @param {Function} config.horizontalAxis.getCount - () => number of divisions
 * @param {Object} config.cellFactory - Cell creation logic
 * @param {Function} config.cellFactory.create - (vIndex, hIndex, bounds) => HTMLElement
 * @param {Function} [config.cellFactory.onClick] - (vIndex, hIndex, cellElement) => void
 * @param {boolean} [config.fillSpaces] - If true, cells fill spaces between markers (default: true)
 * @param {string} [config.cellClassName] - CSS class for cells (default: 'plane-cell')
 * @returns {Object} Plane controller API
 */
export function createMusicalPlane(config) {
  const {
    container,
    verticalAxis,
    horizontalAxis,
    cellFactory,
    fillSpaces = true,
    cellClassName = 'plane-cell'
  } = config;

  // Validation
  if (!container || !verticalAxis || !horizontalAxis) {
    throw new Error('createMusicalPlane requires container and both axes');
  }

  if (!cellFactory || !cellFactory.create) {
    throw new Error('createMusicalPlane requires cellFactory with create method');
  }

  const cells = [];
  let isRendered = false;
  let resizeObserver = null;
  let resizeTimeout = null;

  /**
   * Compute cell bounds using actual DOM measurements
   * This is the KEY to robust alignment - no hardcoded percentages!
   */
  function computeCellBounds(vIndex, hIndex) {
    // Get vertical position from axis (e.g., soundline)
    const vPos = verticalAxis.getPosition(vIndex);

    // Get horizontal position from axis (e.g., timeline)
    const hPos = horizontalAxis.getPosition(hIndex);

    // Container bounds for percentage conversion
    const containerRect = container.getBoundingClientRect();

    // Handle edge cases
    if (containerRect.width === 0 || containerRect.height === 0) {
      console.warn('Container has zero dimensions');
      return {
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        leftPx: 0,
        topPx: 0,
        widthPx: 0,
        heightPx: 0
      };
    }

    // Compute cell bounds in percentages (for responsive CSS positioning)
    return {
      // Percentage values for CSS
      left: (hPos.left / containerRect.width) * 100,
      top: (vPos.top / containerRect.height) * 100,
      width: (hPos.width / containerRect.width) * 100,
      height: (vPos.height / containerRect.height) * 100,
      // Pixel values for absolute positioning fallback
      leftPx: hPos.left,
      topPx: vPos.top,
      widthPx: hPos.width,
      heightPx: vPos.height,
      // Original indices for reference
      vIndex,
      hIndex
    };
  }

  /**
   * Render all cells in the grid
   */
  function render() {
    // Clear existing cells
    clear();

    const vCount = verticalAxis.getCount();
    const hCount = horizontalAxis.getCount();

    // Determine iteration strategy based on fillSpaces
    // fillSpaces=true: cells fill spaces BETWEEN markers (n-1 cells) for HORIZONTAL
    // fillSpaces=false: cells align WITH markers (n cells)
    // Note: Vertical axis always uses full count (all notes)
    const vIterations = vCount; // Always use full vertical count
    const hIterations = fillSpaces ? hCount - 1 : hCount;

    // Validate iterations
    if (vIterations <= 0 || hIterations <= 0) {
      console.warn('Not enough axis divisions to create cells');
      return cells;
    }

    // Create cells at all intersections
    for (let v = 0; v < vIterations; v++) {
      for (let h = 0; h < hIterations; h++) {
        const bounds = computeCellBounds(v, h);

        // Create cell using factory
        let cell;
        try {
          cell = cellFactory.create(v, h, bounds);
        } catch (error) {
          console.error(`Failed to create cell at [${v}, ${h}]:`, error);
          continue;
        }

        // Skip if factory returns null/undefined
        if (!cell) continue;

        // Apply standard cell setup
        if (!cell.classList.contains(cellClassName)) {
          cell.classList.add(cellClassName);
        }
        cell.dataset.vIndex = v;
        cell.dataset.hIndex = h;

        // Position cell using percentage-based positioning for responsiveness
        cell.style.position = 'absolute';
        cell.style.left = `${bounds.left}%`;
        cell.style.top = `${bounds.top}%`;
        cell.style.width = `${bounds.width}%`;
        cell.style.height = `${bounds.height}%`;

        // Attach click handler if provided
        if (cellFactory.onClick) {
          cell.addEventListener('click', (event) => {
            cellFactory.onClick(v, h, cell, event);
          });
        }

        // Append to container and track
        container.appendChild(cell);
        cells.push({
          element: cell,
          vIndex: v,
          hIndex: h,
          bounds
        });
      }
    }

    isRendered = true;

    // Set up resize observer for automatic updates
    setupResizeObserver();

    return cells;
  }

  /**
   * Update cell positions after resize or axis changes
   */
  function update() {
    if (!isRendered) return;

    cells.forEach(({ element, vIndex, hIndex }) => {
      const bounds = computeCellBounds(vIndex, hIndex);

      // Update position and size
      element.style.left = `${bounds.left}%`;
      element.style.top = `${bounds.top}%`;
      element.style.width = `${bounds.width}%`;
      element.style.height = `${bounds.height}%`;

      // Store updated bounds
      const cellData = cells.find(c => c.element === element);
      if (cellData) {
        cellData.bounds = bounds;
      }
    });
  }

  /**
   * Clear all cells
   */
  function clear() {
    // Remove all cell elements
    cells.forEach(({ element }) => {
      // Remove event listeners to prevent memory leaks
      element.replaceWith(element.cloneNode(true));
      element.remove();
    });

    // Clear array
    cells.length = 0;
    isRendered = false;

    // Clean up resize observer
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
  }

  /**
   * Get cell at grid position
   */
  function getCellAt(vIndex, hIndex) {
    return cells.find(c => c.vIndex === vIndex && c.hIndex === hIndex);
  }

  /**
   * Get all cells in a row (horizontal)
   */
  function getRow(vIndex) {
    return cells.filter(c => c.vIndex === vIndex);
  }

  /**
   * Get all cells in a column (vertical)
   */
  function getColumn(hIndex) {
    return cells.filter(c => c.hIndex === hIndex);
  }

  /**
   * Highlight a cell temporarily
   */
  function highlightCell(vIndex, hIndex, className = 'highlight', duration = 500) {
    const cell = getCellAt(vIndex, hIndex);
    if (!cell) return;

    cell.element.classList.add(className);

    if (duration > 0) {
      setTimeout(() => {
        cell.element.classList.remove(className);
      }, duration);
    }
  }

  /**
   * Set up resize observer for automatic updates
   */
  function setupResizeObserver() {
    if (!window.ResizeObserver) {
      // Fallback for browsers without ResizeObserver
      window.addEventListener('resize', update);
      return;
    }

    resizeObserver = new ResizeObserver(entries => {
      // Debounce updates
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }

      resizeTimeout = setTimeout(() => {
        update();
      }, 100);
    });

    resizeObserver.observe(container);
  }

  /**
   * Destroy the plane and clean up
   */
  function destroy() {
    clear();

    // Remove window resize listener if used as fallback
    window.removeEventListener('resize', update);
  }

  // Public API
  return {
    render,
    update,
    clear,
    destroy,
    getCellAt,
    getRow,
    getColumn,
    highlightCell,

    // Getters
    get cells() { return [...cells]; }, // Return copy to prevent external mutation
    get isRendered() { return isRendered; },
    get cellCount() { return cells.length; },

    // Axis access
    get verticalAxis() { return verticalAxis; },
    get horizontalAxis() { return horizontalAxis; }
  };
}