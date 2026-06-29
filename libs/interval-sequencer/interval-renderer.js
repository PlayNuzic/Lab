/**
 * Interval Renderer Module
 *
 * Renders temporal interval (iT) bars on timeline.
 * Shows duration of each note as horizontal bars.
 *
 * @module libs/interval-sequencer/interval-renderer
 */

/**
 * @typedef {Object} IntervalRendererConfig
 * @property {Function} getTimelineContainer - Returns timeline container element
 * @property {Function} getMatrixContainer - Returns matrix container element
 * @property {number} totalSpaces - Total spaces/cells (e.g., 8)
 * @property {string} [layerId='it-bars-layer'] - ID for the bars layer
 * @property {string} [layerClass='it-bars-layer'] - CSS class for layer
 * @property {string} [barClass='it-bar'] - CSS class for bars
 * @property {string} [barRestClass='it-bar--rest'] - CSS class for rest bars
 * @property {string} [labelClass='it-bar__label'] - CSS class for labels
 * @property {Function} [formatLabel] - Custom label formatter (duration) => string
 */

/**
 * Create an interval renderer for iT visualization
 *
 * @param {IntervalRendererConfig} config - Configuration options
 * @returns {Object} Renderer API
 *
 * @example
 * const renderer = createIntervalRenderer({
 *   getTimelineContainer: () => musicalGrid.getTimelineContainer(),
 *   getMatrixContainer: () => musicalGrid.getMatrixContainer(),
 *   totalSpaces: 8
 * });
 *
 * // Render intervals
 * renderer.render(intervals);
 *
 * // Clear all bars
 * renderer.clear();
 *
 * // Cleanup
 * renderer.destroy();
 */
export function createIntervalRenderer(config) {
  const {
    getTimelineContainer,
    getMatrixContainer,
    totalSpaces,
    layerId = 'it-bars-layer',
    layerClass = 'it-bars-layer',
    barClass = 'it-bar',
    barRestClass = 'it-bar--rest',
    labelClass = 'it-bar__label',
    formatLabel = (duration) => String(duration)
  } = config;

  let layer = null;

  /**
   * Get or create the bars layer
   */
  function getOrCreateLayer() {
    const timeline = getTimelineContainer?.();
    if (!timeline) return null;

    layer = timeline.querySelector(`#${layerId}`);
    if (!layer) {
      layer = document.createElement('div');
      layer.id = layerId;
      layer.className = layerClass;
      timeline.appendChild(layer);
    }

    return layer;
  }

  /**
   * Calculate cell width from matrix container
   */
  function calculateCellWidth() {
    const matrix = getMatrixContainer?.();
    if (!matrix) return 0;

    const matrixWidth = matrix.getBoundingClientRect().width;
    return matrixWidth / totalSpaces;
  }

  /**
   * Render temporal bars for intervals
   *
   * @param {Array<{temporalInterval?: number, temporal?: number, isRest?: boolean}>} intervals - Intervals to render
   */
  function render(intervals = []) {
    const timeline = getTimelineContainer?.();
    const matrix = getMatrixContainer?.();
    if (!timeline || !matrix) return;

    const currentLayer = getOrCreateLayer();
    if (!currentLayer) return;

    // Clear existing bars
    currentLayer.innerHTML = '';

    const cellWidth = calculateCellWidth();

    // Layer uses full timeline width
    currentLayer.style.width = '100%';
    currentLayer.style.left = '0';

    let offset = 0;

    intervals.forEach((interval, index) => {
      const duration = interval?.temporalInterval ?? interval?.temporal ?? 0;
      if (!duration) return;

      // Calculate position
      const leftPx = offset * cellWidth;
      const widthPx = duration * cellWidth;

      // Create bar element
      const bar = document.createElement('div');
      bar.className = barClass;
      if (interval.isRest) {
        bar.classList.add(barRestClass);
      }
      bar.style.left = `${leftPx}px`;
      bar.style.width = `${widthPx}px`;
      bar.dataset.index = index + 1;

      // Create label
      const label = document.createElement('div');
      label.className = labelClass;
      label.textContent = formatLabel(duration);
      bar.appendChild(label);

      currentLayer.appendChild(bar);
      offset += duration;
    });
  }

  /**
   * Clear all bars
   */
  function clear() {
    if (layer) {
      layer.innerHTML = '';
    }
  }

  /**
   * Highlight a specific bar temporarily
   *
   * @param {number} index - Bar index (1-based)
   * @param {number} [duration=300] - Highlight duration in ms
   */
  function highlightBar(index, duration = 300) {
    if (!layer) return;

    const bar = layer.querySelector(`[data-index="${index}"]`);
    if (!bar) return;

    bar.classList.add('it-bar--highlight');
    setTimeout(() => {
      bar.classList.remove('it-bar--highlight');
    }, duration);
  }

  /**
   * Get bar element by index
   *
   * @param {number} index - Bar index (1-based)
   * @returns {HTMLElement|null} Bar element
   */
  function getBar(index) {
    if (!layer) return null;
    return layer.querySelector(`[data-index="${index}"]`);
  }

  /**
   * Get all bar elements
   *
   * @returns {NodeList} Bar elements
   */
  function getAllBars() {
    if (!layer) return [];
    return layer.querySelectorAll(`.${barClass}`);
  }

  /**
   * Update a single bar's width (for live preview during drag)
   *
   * @param {number} index - Bar index (1-based)
   * @param {number} newDuration - New duration value
   */
  function updateBarWidth(index, newDuration) {
    const bar = getBar(index);
    if (!bar) return;

    const cellWidth = calculateCellWidth();
    const widthPx = newDuration * cellWidth;

    bar.style.width = `${widthPx}px`;

    const label = bar.querySelector(`.${labelClass}`);
    if (label) {
      label.textContent = formatLabel(newDuration);
    }
  }

  /**
   * Destroy the renderer and remove layer
   */
  function destroy() {
    if (layer && layer.parentNode) {
      layer.parentNode.removeChild(layer);
    }
    layer = null;
  }

  // Public API
  return {
    render,
    clear,
    highlightBar,
    getBar,
    getAllBars,
    updateBarWidth,
    destroy,

    /**
     * Get the layer element
     */
    getLayer: () => layer,

    /**
     * Recalculate positions (call after resize)
     */
    recalculate: (intervals) => render(intervals)
  };
}

/**
 * Default CSS styles for interval bars
 * Can be injected or used as reference for custom styling
 */
export const DEFAULT_INTERVAL_BAR_STYLES = `
.it-bars-layer {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  pointer-events: none;
  z-index: 1;
}

.it-bar {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  height: 24px;
  background: var(--it-bar-bg, rgba(100, 149, 237, 0.3));
  border: 1px solid var(--it-bar-border, rgba(100, 149, 237, 0.6));
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease;
}

.it-bar--rest {
  background: var(--it-bar-rest-bg, rgba(128, 128, 128, 0.2));
  border-color: var(--it-bar-rest-border, rgba(128, 128, 128, 0.4));
}

.it-bar--highlight {
  background: var(--it-bar-highlight-bg, rgba(100, 149, 237, 0.6));
}

.it-bar__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--it-bar-label-color, #333);
  pointer-events: none;
}
`;

/**
 * Inject default styles into document head
 * Call once during app initialization if using default styles
 */
export function injectIntervalBarStyles() {
  const styleId = 'interval-bar-styles';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = DEFAULT_INTERVAL_BAR_STYLES;
  document.head.appendChild(style);
}
