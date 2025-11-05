// libs/app-common/grid-layout.js
// Self-contained 2D musical grid system
// Simple, robust architecture for future apps (App12+)

/**
 * Creates a complete 2D musical grid with soundline, timeline, and interactive cells
 * Everything is handled internally - no need to manage soundline/timeline/plane separately
 *
 * @param {Object} config - Grid configuration
 * @param {HTMLElement} config.parent - Parent container to append grid
 * @param {number} [config.notes=12] - Number of vertical note divisions (0 to notes-1)
 * @param {number} [config.pulses=9] - Number of horizontal pulse markers (0 to pulses-1)
 * @param {number} [config.startMidi=60] - Starting MIDI note (C4 by default)
 * @param {boolean} [config.fillSpaces=true] - If true, cells fill spaces BETWEEN pulses (n-1 cells horizontally)
 * @param {Function} [config.onCellClick] - (noteIndex, pulseIndex, cellElement) => void
 * @param {Function} [config.onNoteClick] - (noteIndex, midi, noteElement) => void
 * @param {Function} [config.cellRenderer] - (noteIndex, pulseIndex, cellElement) => void - Custom cell rendering
 * @param {Function} [config.noteFormatter] - (noteIndex, midi) => string - Custom note label
 * @param {Function} [config.pulseFormatter] - (pulseIndex) => string - Custom pulse label
 * @param {string} [config.cellClassName='musical-cell'] - CSS class for cells
 * @param {string} [config.activeClassName='active'] - CSS class for active cells
 * @param {string} [config.highlightClassName='highlight'] - CSS class for highlighted cells
 * @param {HTMLElement} [config.insertBefore] - Insert grid before this element
 * @returns {Object} Grid controller API
 */
export function createMusicalGrid(config) {
  // Validate required config
  if (!config || !config.parent) {
    throw new Error('createMusicalGrid requires config.parent');
  }

  // Extract config with defaults
  const {
    parent,
    notes = 12,
    pulses = 9,
    startMidi = 60,
    fillSpaces = true,
    onCellClick = null,
    onNoteClick = null,
    cellRenderer = null,
    noteFormatter = null,
    pulseFormatter = null,
    cellClassName = 'musical-cell',
    activeClassName = 'active',
    highlightClassName = 'highlight',
    insertBefore = null
  } = config;

  // Validate dimensions
  if (notes <= 0 || pulses <= 0) {
    throw new Error('createMusicalGrid requires notes > 0 and pulses > 0');
  }

  // Internal state
  const containers = {};
  const cells = [];
  const noteElements = [];
  const pulseElements = [];
  let isRendered = false;
  let resizeObserver = null;
  let resizeTimeout = null;

  // Calculate horizontal cell count based on fillSpaces
  const hCellCount = fillSpaces ? pulses - 1 : pulses;

  /**
   * Create the complete grid structure
   */
  function createGridStructure() {
    // Main grid container (CSS Grid 2x2)
    const gridContainer = document.createElement('div');
    gridContainer.className = 'grid-container';

    // Soundline wrapper (top-left)
    const soundlineWrapper = document.createElement('div');
    soundlineWrapper.className = 'soundline-wrapper';

    // Matrix container (top-right) - where cells are rendered
    const matrixContainer = document.createElement('div');
    matrixContainer.className = 'matrix-container';

    // Spacer (bottom-left) - empty cell in grid
    const spacer = document.createElement('div');
    spacer.style.gridColumn = '1';
    spacer.style.gridRow = '2';

    // Timeline wrapper (bottom-right)
    const timelineWrapper = document.createElement('div');
    timelineWrapper.className = 'timeline-wrapper';

    // Assemble structure
    gridContainer.appendChild(soundlineWrapper);
    gridContainer.appendChild(matrixContainer);
    gridContainer.appendChild(spacer);
    gridContainer.appendChild(timelineWrapper);

    // Insert into parent
    if (insertBefore && insertBefore.parentNode === parent) {
      parent.insertBefore(gridContainer, insertBefore);
    } else {
      parent.appendChild(gridContainer);
    }

    // Store references
    containers.grid = gridContainer;
    containers.soundline = soundlineWrapper;
    containers.matrix = matrixContainer;
    containers.timeline = timelineWrapper;

    return containers;
  }

  /**
   * Render vertical soundline with note labels
   */
  function renderSoundline() {
    const container = containers.soundline;

    // Create vertical line
    const line = document.createElement('div');
    line.className = 'soundline';
    container.appendChild(line);

    // Create note elements (0 to notes-1, from bottom to top visually)
    for (let i = 0; i < notes; i++) {
      const noteIndex = notes - 1 - i; // Reverse for visual top-to-bottom = high-to-low
      const midi = startMidi + noteIndex;

      // Division marker (horizontal line)
      const division = document.createElement('div');
      division.className = 'soundline-division';
      const yPct = (i / (notes - 1)) * 100;
      division.style.top = `${yPct}%`;
      container.appendChild(division);

      // Note label (clickable number) - CENTERED between divisions
      const noteLabel = document.createElement('div');
      noteLabel.className = 'soundline-number';
      noteLabel.dataset.noteIndex = noteIndex;
      noteLabel.dataset.midi = midi;
      noteLabel.textContent = noteFormatter ? noteFormatter(noteIndex, midi) : noteIndex;

      // Center label between division lines (not ON the line)
      const yCenter = (i + 0.5) * (100 / notes);
      noteLabel.style.top = `${yCenter}%`;
      noteLabel.style.transform = 'translateY(-50%)';

      // Click handler
      if (onNoteClick) {
        noteLabel.style.cursor = 'pointer';
        noteLabel.addEventListener('click', () => {
          onNoteClick(noteIndex, midi, noteLabel);
        });
      }

      container.appendChild(noteLabel);
      noteElements.push({ index: noteIndex, element: noteLabel, midi });
    }
  }

  /**
   * Render horizontal timeline with pulse markers
   */
  function renderTimeline() {
    const container = containers.timeline;

    // Create horizontal line
    const line = document.createElement('div');
    line.className = 'timeline-line';
    container.appendChild(line);

    // Create pulse markers (0 to pulses-1)
    for (let i = 0; i < pulses; i++) {
      const xPct = (i / (pulses - 1)) * 100;

      // Pulse marker (short vertical line)
      const marker = document.createElement('div');
      marker.className = 'pulse-marker';
      marker.dataset.pulseIndex = i;
      marker.style.left = `${xPct}%`;
      marker.textContent = pulseFormatter ? pulseFormatter(i) : i;
      container.appendChild(marker);

      pulseElements.push({ index: i, element: marker });
    }
  }

  /**
   * Calculate cell bounds based on note and pulse indices
   */
  function computeCellBounds(noteIndex, hIndex) {
    // Note: noteIndex is the actual note (0-11)
    // hIndex is the horizontal cell index (0 to hCellCount-1)

    const matrixRect = containers.matrix.getBoundingClientRect();
    if (matrixRect.width === 0 || matrixRect.height === 0) {
      return { left: 0, top: 0, width: 0, height: 0 };
    }

    // Vertical: note position (top-to-bottom = high-to-low note)
    const visualNoteIndex = notes - 1 - noteIndex; // Convert to visual index
    const noteHeight = matrixRect.height / notes;
    const top = visualNoteIndex * noteHeight;

    // Horizontal: pulse space position
    let left, width;

    if (fillSpaces) {
      // Cells fill spaces BETWEEN pulse markers
      // Space 0 is between pulse 0 and pulse 1
      const spaceWidth = matrixRect.width / hCellCount;
      left = hIndex * spaceWidth;
      width = spaceWidth;
    } else {
      // Cells align WITH pulse markers
      const cellWidth = matrixRect.width / hCellCount;
      left = hIndex * cellWidth;
      width = cellWidth;
    }

    return { left, top, width, height: noteHeight };
  }

  /**
   * Create and position all cells in the matrix
   */
  function createCells() {
    const container = containers.matrix;

    // Create cells for all note x pulse combinations
    for (let noteIndex = 0; noteIndex < notes; noteIndex++) {
      for (let hIndex = 0; hIndex < hCellCount; hIndex++) {
        // Compute bounds
        const bounds = computeCellBounds(noteIndex, hIndex);

        // Create cell element
        const cell = document.createElement('div');
        cell.className = cellClassName;
        cell.dataset.note = noteIndex;
        cell.dataset.pulse = hIndex;
        cell.dataset.vIndex = noteIndex;
        cell.dataset.hIndex = hIndex;

        // Position cell using absolute positioning
        cell.style.position = 'absolute';
        cell.style.left = `${bounds.left}px`;
        cell.style.top = `${bounds.top}px`;
        cell.style.width = `${bounds.width}px`;
        cell.style.height = `${bounds.height}px`;

        // Custom rendering
        if (cellRenderer) {
          cellRenderer(noteIndex, hIndex, cell);
        }

        // Click handler
        if (onCellClick) {
          cell.style.cursor = 'pointer';
          cell.addEventListener('click', () => {
            onCellClick(noteIndex, hIndex, cell);
          });
        }

        // Append and track
        container.appendChild(cell);
        cells.push({
          element: cell,
          noteIndex,
          pulseIndex: hIndex,
          bounds
        });
      }
    }
  }

  /**
   * Update cell positions after resize
   */
  function updateCellPositions() {
    cells.forEach(({ element, noteIndex, pulseIndex }) => {
      const bounds = computeCellBounds(noteIndex, pulseIndex);
      element.style.left = `${bounds.left}px`;
      element.style.top = `${bounds.top}px`;
      element.style.width = `${bounds.width}px`;
      element.style.height = `${bounds.height}px`;
    });
  }

  /**
   * Setup automatic resize handling
   */
  function setupResizeHandling() {
    if (!window.ResizeObserver) {
      // Fallback for browsers without ResizeObserver
      window.addEventListener('resize', updateCellPositions);
      return;
    }

    resizeObserver = new ResizeObserver(() => {
      // Debounce updates
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }

      resizeTimeout = setTimeout(() => {
        updateCellPositions();
      }, 100);
    });

    resizeObserver.observe(containers.matrix);
  }

  /**
   * Render the complete grid
   */
  function render() {
    if (isRendered) {
      console.warn('Grid already rendered');
      return;
    }

    // Create DOM structure
    createGridStructure();

    // Render components
    renderSoundline();
    renderTimeline();
    createCells();

    // Setup resize handling
    setupResizeHandling();

    isRendered = true;

    console.log(`Musical grid rendered: ${notes} notes × ${hCellCount} cells = ${cells.length} cells`);
  }

  /**
   * Clear all active/highlight states
   */
  function clear() {
    cells.forEach(({ element }) => {
      element.classList.remove(activeClassName, highlightClassName);
    });
  }

  /**
   * Update grid (reposition cells)
   */
  function update() {
    if (!isRendered) return;
    updateCellPositions();
  }

  /**
   * Destroy grid and clean up
   */
  function destroy() {
    // Clean up resize observer
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }

    // Remove window resize listener if used as fallback
    window.removeEventListener('resize', updateCellPositions);

    // Remove grid container
    if (containers.grid && containers.grid.parentNode) {
      containers.grid.remove();
    }

    // Clear arrays
    cells.length = 0;
    noteElements.length = 0;
    pulseElements.length = 0;

    isRendered = false;
  }

  /**
   * Get cell element at grid position
   */
  function getCellElement(noteIndex, pulseIndex) {
    const cell = cells.find(c => c.noteIndex === noteIndex && c.pulseIndex === pulseIndex);
    return cell ? cell.element : null;
  }

  /**
   * Highlight a cell temporarily
   */
  function highlight(noteIndex, pulseIndex, duration = 500) {
    const cell = getCellElement(noteIndex, pulseIndex);
    if (!cell) return;

    cell.classList.add(highlightClassName);

    if (duration > 0) {
      setTimeout(() => {
        cell.classList.remove(highlightClassName);
      }, duration);
    }
  }

  /**
   * Get MIDI note for a note index
   */
  function getMidiForNote(noteIndex) {
    return startMidi + noteIndex;
  }

  /**
   * Get note element (soundline label)
   */
  function getNoteElement(noteIndex) {
    const note = noteElements.find(n => n.index === noteIndex);
    return note ? note.element : null;
  }

  /**
   * Get pulse element (timeline marker)
   */
  function getPulseElement(pulseIndex) {
    const pulse = pulseElements.find(p => p.index === pulseIndex);
    return pulse ? pulse.element : null;
  }

  // Auto-render on creation
  render();

  // Public API
  return {
    // Core methods
    render,
    clear,
    update,
    destroy,

    // Cell access
    getCellElement,
    highlight,

    // Axis access
    getNoteElement,
    getPulseElement,
    getMidiForNote,

    // Container access (if needed for advanced use)
    containers,

    // Getters
    get isRendered() { return isRendered; },
    get cellCount() { return cells.length; },
    get noteCount() { return notes; },
    get pulseCount() { return pulses; },
    get cells() { return [...cells]; } // Return copy
  };
}
