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
 * @param {boolean} [config.scrollEnabled=false] - Enable scroll for larger grids
 * @param {Object} [config.containerSize] - Fixed container size when scrollEnabled {width, height}
 * @param {Object} [config.visibleCells] - Visible cell counts when scrollEnabled {notes, pulses}
 * @param {Object} [config.cellSize] - Minimum cell size when scrollEnabled {minWidth, minHeight}
 * @param {Function} [config.onCellClick] - (noteIndex, pulseIndex, cellElement) => void
 * @param {Function} [config.onNoteClick] - (noteIndex, midi, noteElement) => void
 * @param {Function} [config.cellRenderer] - (noteIndex, pulseIndex, cellElement) => void - Custom cell rendering
 * @param {Function} [config.noteFormatter] - (noteIndex, midi) => string - Custom note label
 * @param {Function} [config.pulseFormatter] - (pulseIndex) => string - Custom pulse label
 * @param {string} [config.cellClassName='musical-cell'] - CSS class for cells
 * @param {string} [config.activeClassName='active'] - CSS class for active cells
 * @param {string} [config.highlightClassName='highlight'] - CSS class for highlighted cells
 * @param {HTMLElement} [config.insertBefore] - Insert grid before this element
 * @param {boolean|Object} [config.showIntervals=false] - Show interval bars and numbers (true/false or {horizontal: bool, vertical: bool, cellLines: bool})
 * @param {string} [config.intervalColor='#4A9EFF'] - Color for interval bars and numbers
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
    scrollEnabled = false,
    containerSize = null,
    visibleCells = null,
    cellSize = null,
    onCellClick = null,
    onNoteClick = null,
    cellRenderer = null,
    noteFormatter = null,
    pulseFormatter = null,
    cellClassName = 'musical-cell',
    activeClassName = 'active',
    highlightClassName = 'highlight',
    insertBefore = null,
    showIntervals = false,
    intervalColor = '#4A9EFF'
  } = config;

  // Normalize showIntervals to object {horizontal, vertical, cellLines}
  const intervalsConfig = typeof showIntervals === 'object' && showIntervals !== null
    ? {
        horizontal: showIntervals.horizontal ?? true,
        vertical: showIntervals.vertical ?? true,
        cellLines: showIntervals.cellLines ?? false
      }
    : {
        horizontal: showIntervals,
        vertical: showIntervals,
        cellLines: false
      };

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

    // Apply scroll container size if provided
    if (scrollEnabled && containerSize) {
      if (containerSize.width) gridContainer.style.width = containerSize.width;
      if (containerSize.height) gridContainer.style.height = containerSize.height;
      if (containerSize.maxWidth) gridContainer.style.maxWidth = containerSize.maxWidth;
      if (containerSize.maxHeight) gridContainer.style.maxHeight = containerSize.maxHeight;
    }

    // Soundline wrapper (top-left)
    const soundlineWrapper = document.createElement('div');
    soundlineWrapper.className = 'soundline-wrapper';

    // Enable vertical scroll if needed
    if (scrollEnabled) {
      soundlineWrapper.style.overflowY = 'auto';
      soundlineWrapper.style.overflowX = 'hidden';
      soundlineWrapper.style.scrollbarWidth = 'none'; // Firefox
      soundlineWrapper.style.msOverflowStyle = 'none'; // IE/Edge
    }

    // Matrix container (top-right) - where cells are rendered
    const matrixContainer = document.createElement('div');
    matrixContainer.className = 'matrix-container';

    // Enable scroll if needed
    if (scrollEnabled) {
      matrixContainer.style.overflow = 'auto';
      matrixContainer.style.scrollBehavior = 'smooth';
    }

    // Spacer (bottom-left) - empty cell in grid
    const spacer = document.createElement('div');
    spacer.style.gridColumn = '1';
    spacer.style.gridRow = '2';

    // Timeline wrapper (bottom-right)
    const timelineWrapper = document.createElement('div');
    timelineWrapper.className = 'timeline-wrapper';

    // Enable horizontal scroll if needed
    if (scrollEnabled) {
      timelineWrapper.style.overflowX = 'auto';
      timelineWrapper.style.overflowY = 'hidden';
      timelineWrapper.style.scrollbarWidth = 'none'; // Firefox
      timelineWrapper.style.msOverflowStyle = 'none'; // IE/Edge
    }

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

    // Create inner expandible container for scroll support
    let innerContainer = container;
    if (scrollEnabled) {
      innerContainer = document.createElement('div');
      innerContainer.className = 'soundline-inner';
      innerContainer.style.position = 'relative';

      // Calculate expanded height based on cellSize
      if (cellSize && cellSize.minHeight) {
        const expandedHeight = notes * cellSize.minHeight;
        innerContainer.style.minHeight = `${expandedHeight}px`;
        innerContainer.style.height = `${expandedHeight}px`;
      }

      container.appendChild(innerContainer);
      containers.soundlineInner = innerContainer;
    }

    // Create vertical line
    const line = document.createElement('div');
    line.className = 'soundline';
    innerContainer.appendChild(line);

    // Create top zero label (above first division)
    const topZeroLabel = document.createElement('div');
    topZeroLabel.className = 'soundline-number top-zero';
    topZeroLabel.dataset.noteIndex = '0-top';
    topZeroLabel.textContent = '0';
    topZeroLabel.style.top = '0%';
    topZeroLabel.style.transform = 'translateY(-50%)';  // Align with first division
    innerContainer.appendChild(topZeroLabel);

    // Create note elements (0 to notes-1, from bottom to top visually)
    for (let i = 0; i < notes; i++) {
      const noteIndex = notes - 1 - i; // Reverse for visual top-to-bottom = high-to-low
      const midi = startMidi + noteIndex;

      // Division marker (horizontal line)
      const division = document.createElement('div');
      division.className = 'soundline-division';
      const yPct = (i / notes) * 100;
      division.style.top = `${yPct}%`;
      innerContainer.appendChild(division);

      // Note label (clickable number) - CENTERED between divisions
      const noteLabel = document.createElement('div');
      noteLabel.className = 'soundline-number';
      noteLabel.dataset.noteIndex = noteIndex;
      noteLabel.dataset.midi = midi;
      noteLabel.textContent = noteFormatter ? noteFormatter(noteIndex, midi) : noteIndex;

      // Center label between division lines (not ON the line)
      const yCenter = (i + 0.5) * (100 / notes);
      noteLabel.style.top = `${yCenter}%`;
      noteLabel.style.transform = 'translateY(30%)';

      // Click handler
      if (onNoteClick) {
        noteLabel.style.cursor = 'pointer';
        noteLabel.addEventListener('click', () => {
          onNoteClick(noteIndex, midi, noteLabel);
        });
      }

      innerContainer.appendChild(noteLabel);
      noteElements.push({ index: noteIndex, element: noteLabel, midi });
    }

    // Create final division at bottom edge
    const finalDivision = document.createElement('div');
    finalDivision.className = 'soundline-division';
    finalDivision.style.top = '100%';
    innerContainer.appendChild(finalDivision);

    // Render interval bars and numbers if enabled
    if (intervalsConfig.vertical) {
      renderSoundlineIntervals(innerContainer);
    }
  }

  /**
   * Render interval bars and numbers in soundline (vertical)
   */
  function renderSoundlineIntervals(container) {
    // Total number of intervals (spaces between notes)
    const totalIntervals = notes - 1;

    // Create interval numbers (1 to notes-1) - positioned between notes
    for (let i = 1; i < notes; i++) {
      const intervalNum = document.createElement('div');
      intervalNum.className = 'interval-number vertical';
      intervalNum.dataset.intervalIndex = i;
      intervalNum.textContent = i;

      // Position centered between note (i-1) and note (i)
      // Uses same spacing as note divisions to maintain alignment with cell rows
      const yPct = ((i - 0.5) / totalIntervals) * 100;
      intervalNum.style.top = `${yPct}%`;
      intervalNum.style.transform = 'translateY(-50%)';

      container.appendChild(intervalNum);
    }

    // Create interval bars (1 to notes-1) - vertical bars between notes
    for (let i = 1; i < notes; i++) {
      const bar = document.createElement('div');
      bar.className = 'interval-bar vertical';
      bar.dataset.intervalIndex = i;

      // Calculate position and height to match cell rows exactly
      // Bar starts at note (i-1) and ends at note (i)
      const startPct = ((i - 1) / totalIntervals) * 100;
      const heightPct = 100 / totalIntervals;

      bar.style.top = `${startPct}%`;
      bar.style.height = `${heightPct}%`;

      container.appendChild(bar);
    }

    // Apply interval color CSS variable to container
    container.style.setProperty('--interval-color', intervalColor);
  }

  /**
   * Render horizontal timeline with pulse markers
   */
  function renderTimeline() {
    const container = containers.timeline;

    // Create inner expandible container for scroll support
    let innerContainer = container;
    if (scrollEnabled) {
      innerContainer = document.createElement('div');
      innerContainer.className = 'timeline-inner';
      innerContainer.style.position = 'relative';

      // Calculate expanded width based on cellSize
      if (cellSize && cellSize.minWidth) {
        const expandedWidth = hCellCount * cellSize.minWidth;
        innerContainer.style.minWidth = `${expandedWidth}px`;
        innerContainer.style.width = `${expandedWidth}px`;
      }

      container.appendChild(innerContainer);
      containers.timelineInner = innerContainer;
    }

    // Create horizontal line
    const line = document.createElement('div');
    line.className = 'timeline-line';
    innerContainer.appendChild(line);

    // Make timeline-line dynamic to match interval-bars width
    const totalIntervals = pulses - 1;
    let timelineWidth;

    if (scrollEnabled && cellSize && cellSize.minWidth) {
      // Scroll mode: use fixed cellSize from config
      timelineWidth = totalIntervals * cellSize.minWidth;
    } else {
      // Responsive mode: calculate from matrix container width
      const matrixWidth = containers.matrix?.getBoundingClientRect().width || 0;
      timelineWidth = matrixWidth;
    }

    line.style.width = `${timelineWidth}px`;
    line.style.right = 'auto'; // Cancel the default right: 0

    // Create pulse markers (0 to pulses-1) in PIXELS
    for (let i = 0; i < pulses; i++) {
      // Pulse marker (short vertical line)
      const marker = document.createElement('div');
      marker.className = 'pulse-marker';
      marker.dataset.pulseIndex = i;

      // Calculate position in PIXELS to match cell columns exactly
      let markerLeft;

      if (scrollEnabled && cellSize && cellSize.minWidth) {
        // Scroll mode: use fixed cellSize from config
        markerLeft = i * cellSize.minWidth;
      } else {
        // Responsive mode: calculate from matrix container width
        const matrixWidth = containers.matrix?.getBoundingClientRect().width || 0;
        const cellWidth = matrixWidth / totalIntervals;
        markerLeft = i * cellWidth;
      }

      marker.style.left = `${markerLeft}px`;
      marker.textContent = pulseFormatter ? pulseFormatter(i) : i;
      innerContainer.appendChild(marker);

      pulseElements.push({ index: i, element: marker });
    }

    // Render interval bars and numbers if enabled
    if (intervalsConfig.horizontal) {
      renderTimelineIntervals(innerContainer);
    }
  }

  /**
   * Render interval bars and numbers in timeline (horizontal)
   */
  function renderTimelineIntervals(container) {
    // Total number of intervals (spaces between pulses)
    const totalIntervals = pulses - 1;

    // Create interval numbers (1 to pulses-1)
    for (let i = 1; i < pulses; i++) {
      const intervalNum = document.createElement('div');
      intervalNum.className = 'interval-number';
      intervalNum.dataset.intervalIndex = i;
      intervalNum.textContent = i;

      // Position centered between pulse (i-1) and pulse (i) in PIXELS
      let numLeft;

      if (scrollEnabled && cellSize && cellSize.minWidth) {
        // Scroll mode: use fixed cellSize from config
        numLeft = (i - 0.5) * cellSize.minWidth;
      } else {
        // Responsive mode: calculate from matrix container width
        const matrixWidth = containers.matrix?.getBoundingClientRect().width || 0;
        const cellWidth = matrixWidth / totalIntervals;
        numLeft = (i - 0.5) * cellWidth;
      }

      intervalNum.style.left = `${numLeft}px`;

      container.appendChild(intervalNum);
    }

    // Create interval bars (1 to pulses-1)
    for (let i = 1; i < pulses; i++) {
      const bar = document.createElement('div');
      bar.className = 'interval-bar horizontal';
      bar.dataset.intervalIndex = i;

      // Calculate position and width in PIXELS to match cell columns exactly
      // Bar starts at pulse (i-1) and ends at pulse (i)
      let barLeft, barWidth;

      if (scrollEnabled && cellSize && cellSize.minWidth) {
        // Scroll mode: use fixed cellSize from config
        barWidth = cellSize.minWidth;
        barLeft = (i - 1) * barWidth;
      } else {
        // Responsive mode: calculate from matrix container width
        const matrixWidth = containers.matrix?.getBoundingClientRect().width || 0;
        barWidth = matrixWidth / totalIntervals;
        barLeft = (i - 1) * barWidth;
      }

      bar.style.left = `${barLeft}px`;
      bar.style.width = `${barWidth}px`;

      container.appendChild(bar);
    }

    // Apply interval color CSS variable to container
    container.style.setProperty('--interval-color', intervalColor);
  }

  /**
   * Calculate cell bounds based on note and pulse indices
   */
  function computeCellBounds(noteIndex, hIndex) {
    // Note: noteIndex is the actual note (0-11)
    // hIndex is the horizontal cell index (0 to hCellCount-1)

    // Use inner container for scroll mode, outer container otherwise
    const targetContainer = scrollEnabled && containers.matrixInner
      ? containers.matrixInner
      : containers.matrix;

    const matrixRect = targetContainer.getBoundingClientRect();
    if (matrixRect.width === 0 || matrixRect.height === 0) {
      return { left: 0, top: 0, width: 0, height: 0 };
    }

    // Vertical: note position (top-to-bottom = high-to-low note)
    const visualNoteIndex = notes - 1 - noteIndex; // Convert to visual index

    // Use fixed cell size if scrollEnabled, otherwise responsive
    let noteHeight, top;
    if (scrollEnabled && cellSize && cellSize.minHeight) {
      noteHeight = cellSize.minHeight;
      top = visualNoteIndex * noteHeight;
    } else {
      noteHeight = matrixRect.height / notes;
      top = visualNoteIndex * noteHeight;
    }

    // Horizontal: pulse space position
    let left, width;

    if (scrollEnabled && cellSize && cellSize.minWidth) {
      // Fixed cell size for scroll mode
      if (fillSpaces) {
        width = cellSize.minWidth;
        left = hIndex * width;
      } else {
        width = cellSize.minWidth;
        left = hIndex * width;
      }
    } else {
      // Responsive cell size for non-scroll mode
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
    }

    return { left, top, width, height: noteHeight };
  }

  /**
   * Create and position all cells in the matrix
   */
  function createCells() {
    const container = containers.matrix;

    // Create inner expandible container for scroll support
    let innerContainer = container;
    if (scrollEnabled) {
      innerContainer = document.createElement('div');
      innerContainer.className = 'matrix-inner';
      innerContainer.style.position = 'relative';

      // Calculate expanded size based on cellSize
      if (cellSize) {
        if (cellSize.minWidth) {
          const expandedWidth = hCellCount * cellSize.minWidth;
          innerContainer.style.minWidth = `${expandedWidth}px`;
          innerContainer.style.width = `${expandedWidth}px`;
        }
        if (cellSize.minHeight) {
          const expandedHeight = notes * cellSize.minHeight;
          innerContainer.style.minHeight = `${expandedHeight}px`;
          innerContainer.style.height = `${expandedHeight}px`;
        }
      }

      container.appendChild(innerContainer);
      containers.matrixInner = innerContainer;
    }

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
        innerContainer.appendChild(cell);
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

    // Also update interval bars positions to stay synchronized
    updateIntervalBarsPositions();
  }

  /**
   * Update interval bars positions after resize
   * Keeps bars synchronized with cell columns/rows
   */
  function updateIntervalBarsPositions() {
    if (!intervalsConfig.horizontal && !intervalsConfig.vertical) return;

    const totalIntervals = pulses - 1;

    // Update horizontal bars (timeline)
    if (intervalsConfig.horizontal) {
    const timelineContainer = containers.timelineInner || containers.timeline;
    if (timelineContainer) {
      // Update timeline-line width
      const timelineLine = timelineContainer.querySelector('.timeline-line');
      if (timelineLine) {
        let timelineWidth;

        if (scrollEnabled && cellSize && cellSize.minWidth) {
          timelineWidth = totalIntervals * cellSize.minWidth;
        } else {
          const matrixWidth = containers.matrix?.getBoundingClientRect().width || 0;
          timelineWidth = matrixWidth;
        }

        timelineLine.style.width = `${timelineWidth}px`;
        timelineLine.style.right = 'auto';
      }

      // Update pulse markers
      const pulseMarkers = timelineContainer.querySelectorAll('.pulse-marker');
      pulseMarkers.forEach(marker => {
        const i = parseInt(marker.dataset.pulseIndex);
        let markerLeft;

        if (scrollEnabled && cellSize && cellSize.minWidth) {
          markerLeft = i * cellSize.minWidth;
        } else {
          const matrixWidth = containers.matrix?.getBoundingClientRect().width || 0;
          const cellWidth = matrixWidth / totalIntervals;
          markerLeft = i * cellWidth;
        }

        marker.style.left = `${markerLeft}px`;
      });

      // Update interval numbers
      const intervalNumbers = timelineContainer.querySelectorAll('.interval-number');
      intervalNumbers.forEach(num => {
        const i = parseInt(num.dataset.intervalIndex);
        let numLeft;

        if (scrollEnabled && cellSize && cellSize.minWidth) {
          numLeft = (i - 0.5) * cellSize.minWidth;
        } else {
          const matrixWidth = containers.matrix?.getBoundingClientRect().width || 0;
          const cellWidth = matrixWidth / totalIntervals;
          numLeft = (i - 0.5) * cellWidth;
        }

        num.style.left = `${numLeft}px`;
      });

      // Update interval bars
      const horizontalBars = timelineContainer.querySelectorAll('.interval-bar.horizontal');

      horizontalBars.forEach(bar => {
        const i = parseInt(bar.dataset.intervalIndex);
        let barLeft, barWidth;

        if (scrollEnabled && cellSize && cellSize.minWidth) {
          // Scroll mode: use fixed cellSize from config
          barWidth = cellSize.minWidth;
          barLeft = (i - 1) * barWidth;
        } else {
          // Responsive mode: calculate from matrix container width
          const matrixWidth = containers.matrix?.getBoundingClientRect().width || 0;
          barWidth = matrixWidth / totalIntervals;
          barLeft = (i - 1) * barWidth;
        }

        bar.style.left = `${barLeft}px`;
        bar.style.width = `${barWidth}px`;
      });
    }
    } // End intervalsConfig.horizontal

    // Update vertical bars (soundline) - already use percentages, but update for consistency
    if (intervalsConfig.vertical) {
    const soundlineContainer = containers.soundlineInner || containers.soundline;
    if (soundlineContainer) {
      const verticalBars = soundlineContainer.querySelectorAll('.interval-bar.vertical');
      const totalNoteIntervals = notes - 1;

      verticalBars.forEach(bar => {
        const i = parseInt(bar.dataset.intervalIndex);

        // Vertical bars already use percentage system which works correctly
        // No need to recalculate unless we switch to pixel system
        const startPct = ((i - 1) / totalNoteIntervals) * 100;
        const heightPct = 100 / totalNoteIntervals;

        bar.style.top = `${startPct}%`;
        bar.style.height = `${heightPct}%`;
      });
    }
    } // End intervalsConfig.vertical
  }

  /**
   * Setup scroll synchronization between matrix and axes
   */
  function setupScrollSync() {
    if (!scrollEnabled) return;

    let isScrolling = false;

    // Sync scroll from matrix to axes
    containers.matrix.addEventListener('scroll', () => {
      if (isScrolling) return;
      isScrolling = true;

      // Sync vertical scroll to soundline
      if (containers.soundline) {
        containers.soundline.scrollTop = containers.matrix.scrollTop;
      }

      // Sync horizontal scroll to timeline
      if (containers.timeline) {
        containers.timeline.scrollLeft = containers.matrix.scrollLeft;
      }

      requestAnimationFrame(() => {
        isScrolling = false;
      });
    });

    // Sync scroll from soundline to matrix (vertical only)
    containers.soundline.addEventListener('scroll', () => {
      if (isScrolling) return;
      isScrolling = true;

      containers.matrix.scrollTop = containers.soundline.scrollTop;

      requestAnimationFrame(() => {
        isScrolling = false;
      });
    });

    // Sync scroll from timeline to matrix (horizontal only)
    containers.timeline.addEventListener('scroll', () => {
      if (isScrolling) return;
      isScrolling = true;

      containers.matrix.scrollLeft = containers.timeline.scrollLeft;

      requestAnimationFrame(() => {
        isScrolling = false;
      });
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

    // Observe the correct container based on scroll mode
    const targetContainer = scrollEnabled && containers.matrixInner
      ? containers.matrixInner
      : containers.matrix;

    resizeObserver = new ResizeObserver(() => {
      // Debounce updates
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }

      resizeTimeout = setTimeout(() => {
        updateCellPositions();
      }, 100);
    });

    resizeObserver.observe(targetContainer);
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

    // Setup scroll synchronization
    setupScrollSync();

    // Setup resize handling
    setupResizeHandling();

    isRendered = true;

    const scrollStatus = scrollEnabled ? ' (scroll enabled)' : '';
    console.log(`Musical grid rendered: ${notes} notes × ${hCellCount} cells = ${cells.length} cells${scrollStatus}`);
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

  /**
   * Highlight an interval bar
   * @param {string} axis - 'horizontal' or 'vertical'
   * @param {number} index - Interval index (1-based: pulse 0 -> interval 1)
   * @param {number} durationMs - Duration in milliseconds (0 = permanent)
   */
  function highlightInterval(axis, index, durationMs = 0) {
    if (axis === 'horizontal' && intervalsConfig.horizontal) {
      const container = containers.timelineInner || containers.timeline;
      if (!container) return;

      const bar = container.querySelector(`.interval-bar.horizontal[data-interval-index="${index}"]`);
      if (bar) {
        bar.classList.add('active');
        if (durationMs > 0) {
          setTimeout(() => bar.classList.remove('active'), durationMs);
        }
      }
    } else if (axis === 'vertical' && intervalsConfig.vertical) {
      const container = containers.soundlineInner || containers.soundline;
      if (!container) return;

      const bar = container.querySelector(`.interval-bar.vertical[data-interval-index="${index}"]`);
      if (bar) {
        bar.classList.add('active');
        if (durationMs > 0) {
          setTimeout(() => bar.classList.remove('active'), durationMs);
        }
      }
    }
  }

  /**
   * Clear all interval highlights
   * @param {string} axis - 'horizontal', 'vertical', or 'both' (default: 'horizontal')
   */
  function clearIntervalHighlights(axis = 'horizontal') {
    if (axis === 'horizontal' || axis === 'both') {
      const container = containers.timelineInner || containers.timeline;
      if (container) {
        container.querySelectorAll('.interval-bar.horizontal.active').forEach(bar => {
          bar.classList.remove('active');
        });
      }
    }

    if (axis === 'vertical' || axis === 'both') {
      const container = containers.soundlineInner || containers.soundline;
      if (container) {
        container.querySelectorAll('.interval-bar.vertical.active').forEach(bar => {
          bar.classList.remove('active');
        });
      }
    }
  }

  /**
   * Helper for playback - automatically highlights the correct interval
   * @param {number} pulseIndex - Current pulse being played (0-based)
   * @param {number} durationMs - Duration of the pulse in milliseconds
   */
  function onPulseStep(pulseIndex, durationMs = 0) {
    // Clear previous highlights
    clearIntervalHighlights('horizontal');

    // Highlight the interval after this pulse (pulse 0 -> interval 1)
    if (intervalsConfig.horizontal && pulseIndex < pulses - 1) {
      const intervalIndex = pulseIndex + 1;
      highlightInterval('horizontal', intervalIndex, durationMs);
    }
  }

  /**
   * Separates pairs into independent voices (no two notes in same pulse within a voice)
   * @param {Array} pairs - Array of {note, pulse} pairs
   * @returns {Array<Array>} - Array of voices, each voice is an array of pairs
   */
  function separateIntoVoices(pairs) {
    const voices = [];
    const sortedPairs = [...pairs].sort((a, b) => a.pulse - b.pulse);

    for (const pair of sortedPairs) {
      // Find a voice that doesn't have a note at this pulse
      let assignedVoice = voices.find(voice =>
        !voice.some(p => p.pulse === pair.pulse)
      );

      if (!assignedVoice) {
        // Create new voice
        assignedVoice = [];
        voices.push(assignedVoice);
      }

      assignedVoice.push(pair);
    }

    return voices;
  }

  /**
   * Draws interval path for a single voice (sequence of non-overlapping notes)
   * @param {Array} voicePairs - Array of {note, pulse} pairs in this voice
   */
  function drawVoicePath(voicePairs) {
    if (voicePairs.length < 2) return;

    // Sort by pulse
    const sorted = [...voicePairs].sort((a, b) => a.pulse - b.pulse);

    // Draw paths between consecutive notes in this voice
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];

      // 1. Horizontal path: from current pulse to next pulse (along current note)
      for (let p = current.pulse; p < next.pulse; p++) {
        const cell = getCellElement(current.note, p);
        if (cell) {
          cell.classList.add('interval-path-horizontal');
        }
      }

      // 2. Vertical path: from current note to next note (at next pulse)
      // Draw left borders respecting direction (up or down)
      if (current.note < next.note) {
        // Going down: draw from current to next-1
        for (let n = current.note; n < next.note; n++) {
          const cell = getCellElement(n, next.pulse);
          if (cell) {
            cell.classList.add('interval-path-vertical');
          }
        }
      } else if (current.note > next.note) {
        // Going up: draw from next+1 to current
        for (let n = next.note + 1; n <= current.note; n++) {
          const cell = getCellElement(n, next.pulse);
          if (cell) {
            cell.classList.add('interval-path-vertical');
          }
        }
      }
      // If current.note === next.note: no vertical path needed (same note)
    }
  }

  /**
   * Highlights cell borders to show the path between consecutive N-P pairs
   * Illuminates bottom borders horizontally and left borders vertically
   * @param {Array} pairs - Array of {note, pulse} pairs
   * @param {boolean} polyphonic - If true, separate into independent voices
   */
  function highlightIntervalPath(pairs, polyphonic = false) {
    if (!intervalsConfig.cellLines || !pairs || pairs.length < 2) {
      return;
    }

    // Clear any existing paths
    clearIntervalPaths();

    if (polyphonic) {
      // Separate into independent voices and draw each voice separately
      const voices = separateIntoVoices(pairs);
      voices.forEach(voice => drawVoicePath(voice));
    } else {
      // Monophonic: draw single path through all notes
      const sortedPairs = [...pairs].sort((a, b) => a.pulse - b.pulse);
      drawVoicePath(sortedPairs);
    }
  }

  /**
   * Clears all interval path highlights from cells
   */
  function clearIntervalPaths() {
    cells.forEach(({ element }) => {
      if (element && element.classList) {
        element.classList.remove('interval-path-horizontal', 'interval-path-vertical', 'interval-path-corner');
      }
    });
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

    // Interval highlighting (native support)
    highlightInterval,
    clearIntervalHighlights,
    onPulseStep,

    // Interval path borders (for N-P pairs)
    highlightIntervalPath,
    clearIntervalPaths,

    // Container access (for composing with interval bars)
    getContainer(selector) {
      if (!containers.grid) return null;
      return containers.grid.querySelector(selector);
    },
    getTimelineContainer() {
      return containers.timelineInner || containers.timeline;
    },
    getSoundlineContainer() {
      return containers.soundlineInner || containers.soundline;
    },
    getMatrixContainer() {
      return containers.matrixInner || containers.matrix;
    },

    // Container access (if needed for advanced use)
    containers,

    // Getters
    get isRendered() { return isRendered; },
    get cellCount() { return cells.length; },
    get noteCount() { return notes; },
    get pulseCount() { return pulses; },
    get cells() { return [...cells]; }, // Return copy
    get intervalsConfig() { return intervalsConfig; } // Expose for runtime updates
  };
}
