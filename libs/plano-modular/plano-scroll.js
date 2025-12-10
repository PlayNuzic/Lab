/**
 * plano-scroll.js - Scroll synchronization and navigation for plano-modular
 * Handles horizontal/vertical sync, wheel blocking, and smooth scrolling
 */

/**
 * Setup scroll synchronization between grid components
 * @param {HTMLElement} matrix - Matrix container element
 * @param {HTMLElement} soundline - Soundline container element
 * @param {HTMLElement} timeline - Timeline container element
 * @returns {Function} Cleanup function to remove listeners
 */
export function setupScrollSync(matrix, soundline, timeline) {
  let isScrollSyncing = false;

  // Horizontal sync: Matrix → Timeline
  const handleMatrixHorizontalScroll = () => {
    if (timeline) {
      timeline.scrollLeft = matrix.scrollLeft;
    }
  };

  // Vertical sync: Matrix → Soundline
  const handleMatrixVerticalScroll = () => {
    if (isScrollSyncing || !soundline) return;
    isScrollSyncing = true;
    soundline.scrollTop = matrix.scrollTop;
    requestAnimationFrame(() => { isScrollSyncing = false; });
  };

  // Vertical sync: Soundline → Matrix
  const handleSoundlineScroll = () => {
    if (isScrollSyncing || !matrix) return;
    isScrollSyncing = true;
    matrix.scrollTop = soundline.scrollTop;
    requestAnimationFrame(() => { isScrollSyncing = false; });
  };

  // Combined matrix scroll handler
  const handleMatrixScroll = () => {
    handleMatrixHorizontalScroll();
    handleMatrixVerticalScroll();
  };

  // Attach listeners
  if (matrix) {
    matrix.addEventListener('scroll', handleMatrixScroll);
  }
  if (soundline) {
    soundline.addEventListener('scroll', handleSoundlineScroll);
  }

  // Return cleanup function
  return () => {
    if (matrix) {
      matrix.removeEventListener('scroll', handleMatrixScroll);
    }
    if (soundline) {
      soundline.removeEventListener('scroll', handleSoundlineScroll);
    }
  };
}

/**
 * Block vertical wheel scroll on elements (only programmatic scroll allowed)
 * @param {...HTMLElement} elements - Elements to block wheel scroll on
 * @returns {Function} Cleanup function to remove listeners
 */
export function blockVerticalWheel(...elements) {
  const handler = (e) => {
    if (e.deltaY !== 0) {
      e.preventDefault();
    }
  };

  const options = { passive: false };

  for (const el of elements) {
    if (el) {
      el.addEventListener('wheel', handler, options);
    }
  }

  // Return cleanup function
  return () => {
    for (const el of elements) {
      if (el) {
        el.removeEventListener('wheel', handler, options);
      }
    }
  };
}

/**
 * Smooth scroll animation using requestAnimationFrame
 * @param {HTMLElement} element - Element to scroll
 * @param {number} target - Target scroll position
 * @param {'top' | 'left'} direction - Scroll direction
 * @param {number} duration - Animation duration in ms (default 200)
 * @returns {Promise<void>} Resolves when animation completes
 */
export function smoothScrollTo(element, target, direction = 'top', duration = 200) {
  return new Promise((resolve) => {
    if (!element) {
      resolve();
      return;
    }

    const prop = direction === 'top' ? 'scrollTop' : 'scrollLeft';
    const start = element[prop];
    const distance = target - start;

    if (distance === 0) {
      resolve();
      return;
    }

    const startTime = performance.now();

    function animate(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic for smooth deceleration
      const easeOut = 1 - Math.pow(1 - progress, 3);

      element[prop] = start + (distance * easeOut);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        resolve();
      }
    }

    requestAnimationFrame(animate);
  });
}

/**
 * Scroll to a specific row (vertical scroll)
 * @param {HTMLElement} container - Scrollable container
 * @param {number} rowIndex - Target row index
 * @param {number} cellHeight - Height of each cell
 * @param {number} visibleRows - Number of visible rows
 * @param {boolean} animated - Whether to animate scroll
 * @returns {Promise<void>}
 */
export function scrollToRow(container, rowIndex, cellHeight, visibleRows, animated = false) {
  if (!container) return Promise.resolve();

  // Center the row in visible area
  const centerOffset = Math.floor(visibleRows / 2);
  const targetScrollTop = Math.max(0, (rowIndex - centerOffset) * cellHeight);

  if (animated) {
    return smoothScrollTo(container, targetScrollTop, 'top');
  } else {
    container.scrollTop = targetScrollTop;
    return Promise.resolve();
  }
}

/**
 * Scroll to a specific column (horizontal scroll)
 * @param {HTMLElement} container - Scrollable container
 * @param {number} colIndex - Target column index
 * @param {number} cellWidth - Width of each cell
 * @param {boolean} animated - Whether to animate scroll
 * @param {boolean} center - Whether to center the column
 * @returns {Promise<void>}
 */
export function scrollToColumn(container, colIndex, cellWidth, animated = false, center = true) {
  if (!container) return Promise.resolve();

  let targetScrollLeft;

  if (center) {
    const containerWidth = container.clientWidth;
    targetScrollLeft = Math.max(0, (colIndex * cellWidth) - (containerWidth / 2) + (cellWidth / 2));
  } else {
    targetScrollLeft = colIndex * cellWidth;
  }

  // Clamp to valid range
  const maxScroll = container.scrollWidth - container.clientWidth;
  targetScrollLeft = Math.max(0, Math.min(targetScrollLeft, maxScroll));

  if (animated) {
    return smoothScrollTo(container, targetScrollLeft, 'left');
  } else {
    container.scrollLeft = targetScrollLeft;
    return Promise.resolve();
  }
}

/**
 * Scroll to a registry using note0RowMap
 * @param {HTMLElement} container - Scrollable container
 * @param {number|string} registryId - Registry identifier
 * @param {Object} note0RowMap - Map of registry to row index where note 0 is
 * @param {number} cellHeight - Height of each cell
 * @param {number} visibleRows - Number of visible rows
 * @param {boolean} animated - Whether to animate scroll
 * @returns {Promise<void>}
 */
export function scrollToRegistry(container, registryId, note0RowMap, cellHeight, visibleRows, animated = false) {
  const rowIndex = note0RowMap[registryId];
  if (rowIndex === undefined) return Promise.resolve();

  return scrollToRow(container, rowIndex, cellHeight, visibleRows, animated);
}

/**
 * Sync scroll position between multiple containers
 * @param {Array<HTMLElement>} containers - Containers to sync
 * @param {number} scrollTop - Target scrollTop value
 */
export function syncVerticalScroll(containers, scrollTop) {
  for (const container of containers) {
    if (container) {
      container.scrollTop = scrollTop;
    }
  }
}

/**
 * Sync horizontal scroll between containers
 * @param {Array<HTMLElement>} containers - Containers to sync
 * @param {number} scrollLeft - Target scrollLeft value
 */
export function syncHorizontalScroll(containers, scrollLeft) {
  for (const container of containers) {
    if (container) {
      container.scrollLeft = scrollLeft;
    }
  }
}
