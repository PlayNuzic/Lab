// libs/app-common/plane-adapters.js
// Adapters to make existing components compatible with musical-plane

/**
 * Creates a vertical axis adapter for soundline component
 * Maps soundline's 12 notes to vertical positions
 *
 * @param {Object} soundline - Soundline instance from createSoundline()
 * @returns {Object} Vertical axis adapter compatible with musical-plane
 */
export function createSoundlineVerticalAxis(soundline) {
  if (!soundline || !soundline.element) {
    throw new Error('Valid soundline instance required');
  }

  return {
    /**
     * Get vertical position bounds for a note index
     * @param {number} noteIndex - Note index (0-11)
     * @returns {Object} {top: px, height: px} in pixels relative to container
     */
    getPosition(noteIndex) {
      if (noteIndex < 0 || noteIndex >= 12) {
        console.warn(`Note index ${noteIndex} out of range (0-11)`);
        return { top: 0, height: 0 };
      }

      const containerRect = soundline.element.getBoundingClientRect();
      const containerHeight = containerRect.height;

      // Each note occupies 1/12 of the container height
      const noteHeight = containerHeight / 12;

      // Note 0 at bottom, note 11 at top (inverted for musical convention)
      // We need the TOP edge of the note space, not the center
      const top = containerHeight - ((noteIndex + 1) * noteHeight);

      return {
        top: Math.max(0, top),
        height: noteHeight
      };
    },

    /**
     * Get number of notes
     */
    getCount() {
      return 12; // Soundline always has 12 notes (0-11)
    },

    /**
     * Get the underlying element for measurements
     */
    get element() {
      return soundline.element;
    }
  };
}

/**
 * Creates a horizontal axis adapter for timeline
 * Maps timeline pulses to horizontal positions
 *
 * @param {number} totalPulses - Total number of pulses (e.g., 9 for App11)
 * @param {HTMLElement} timelineContainer - Timeline container element
 * @param {boolean} [fillSpaces] - If true, positions are between pulses
 * @returns {Object} Horizontal axis adapter compatible with musical-plane
 */
export function createTimelineHorizontalAxis(totalPulses, timelineContainer, fillSpaces = true) {
  if (!timelineContainer) {
    throw new Error('Timeline container element required');
  }

  if (totalPulses < 2) {
    throw new Error('At least 2 pulses required');
  }

  return {
    /**
     * Get horizontal position bounds for a pulse index
     * @param {number} pulseIndex - Pulse index
     * @returns {Object} {left: px, width: px} in pixels relative to container
     */
    getPosition(pulseIndex) {
      const containerRect = timelineContainer.getBoundingClientRect();
      const containerWidth = containerRect.width;

      if (fillSpaces) {
        // Position BETWEEN pulse markers (App11 pattern)
        // Space 0 is between pulse 0 and 1, space 1 between pulse 1 and 2, etc.
        if (pulseIndex >= totalPulses - 1) {
          console.warn(`Pulse index ${pulseIndex} out of range for fillSpaces mode`);
          return { left: 0, width: 0 };
        }

        const pulseSpacing = containerWidth / (totalPulses - 1);
        const left = pulseIndex * pulseSpacing;
        const width = pulseSpacing;

        return {
          left: Math.max(0, left),
          width: width
        };
      } else {
        // Position ON pulse markers
        if (pulseIndex >= totalPulses) {
          console.warn(`Pulse index ${pulseIndex} out of range`);
          return { left: 0, width: 0 };
        }

        const pulseSpacing = containerWidth / totalPulses;
        const left = pulseIndex * pulseSpacing;
        const width = pulseSpacing;

        return {
          left: Math.max(0, left),
          width: width
        };
      }
    },

    /**
     * Get number of positions
     */
    getCount() {
      // In fillSpaces mode, we have (n-1) spaces between n pulses
      // Otherwise we have n positions for n pulses
      return fillSpaces ? totalPulses : totalPulses;
    },

    /**
     * Get the underlying element
     */
    get element() {
      return timelineContainer;
    }
  };
}

/**
 * Creates a custom scale vertical axis
 * For apps that need scales other than chromatic
 *
 * @param {Array} scale - Array of note indices or MIDI numbers
 * @param {HTMLElement} container - Container element
 * @returns {Object} Vertical axis adapter
 */
export function createScaleVerticalAxis(scale, container) {
  if (!Array.isArray(scale) || scale.length === 0) {
    throw new Error('Scale must be a non-empty array');
  }

  if (!container) {
    throw new Error('Container element required');
  }

  return {
    /**
     * Get vertical position for scale degree
     */
    getPosition(scaleIndex) {
      if (scaleIndex < 0 || scaleIndex >= scale.length) {
        console.warn(`Scale index ${scaleIndex} out of range (0-${scale.length - 1})`);
        return { top: 0, height: 0 };
      }

      const containerRect = container.getBoundingClientRect();
      const containerHeight = containerRect.height;
      const noteHeight = containerHeight / scale.length;

      // Bottom to top layout (musical convention)
      const top = containerHeight - ((scaleIndex + 1) * noteHeight);

      return {
        top: Math.max(0, top),
        height: noteHeight
      };
    },

    /**
     * Get number of notes in scale
     */
    getCount() {
      return scale.length;
    },

    /**
     * Get note/MIDI value at index
     */
    getNoteAt(index) {
      return scale[index];
    },

    /**
     * Get the underlying element
     */
    get element() {
      return container;
    }
  };
}

/**
 * Creates a measure-based horizontal axis
 * For apps that need measure/beat divisions
 *
 * @param {number} measures - Number of measures
 * @param {number} beatsPerMeasure - Beats per measure (e.g., 4 for 4/4 time)
 * @param {HTMLElement} container - Container element
 * @param {boolean} [showMeasureLines] - Whether to show measure divisions
 * @returns {Object} Horizontal axis adapter
 */
export function createMeasureHorizontalAxis(measures, beatsPerMeasure, container, showMeasureLines = true) {
  if (!container) {
    throw new Error('Container element required');
  }

  const totalBeats = measures * beatsPerMeasure;

  return {
    /**
     * Get horizontal position for beat index
     */
    getPosition(beatIndex) {
      if (beatIndex < 0 || beatIndex >= totalBeats) {
        console.warn(`Beat index ${beatIndex} out of range (0-${totalBeats - 1})`);
        return { left: 0, width: 0 };
      }

      const containerRect = container.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const beatWidth = containerWidth / totalBeats;
      const left = beatIndex * beatWidth;

      return {
        left: Math.max(0, left),
        width: beatWidth
      };
    },

    /**
     * Get total number of beats
     */
    getCount() {
      return totalBeats;
    },

    /**
     * Get measure and beat for a beat index
     */
    getBeatInfo(beatIndex) {
      const measure = Math.floor(beatIndex / beatsPerMeasure);
      const beat = beatIndex % beatsPerMeasure;
      return { measure, beat };
    },

    /**
     * Check if beat is a downbeat (first beat of measure)
     */
    isDownbeat(beatIndex) {
      return beatIndex % beatsPerMeasure === 0;
    },

    /**
     * Get the underlying element
     */
    get element() {
      return container;
    }
  };
}

/**
 * Creates a circular/radial axis adapter
 * For apps with circular layouts
 *
 * @param {number} divisions - Number of divisions around the circle
 * @param {HTMLElement} container - Container element
 * @param {number} [radius] - Radius in pixels (default: auto from container)
 * @returns {Object} Axis adapter for circular positioning
 */
export function createCircularAxis(divisions, container, radius = null) {
  if (!container) {
    throw new Error('Container element required');
  }

  if (divisions < 2) {
    throw new Error('At least 2 divisions required for circular axis');
  }

  return {
    /**
     * Get position on circle for division index
     * Returns polar coordinates converted to rectangular
     */
    getPosition(index) {
      if (index < 0 || index >= divisions) {
        console.warn(`Division index ${index} out of range (0-${divisions - 1})`);
        return { left: 0, top: 0, width: 0, height: 0 };
      }

      const containerRect = container.getBoundingClientRect();
      const centerX = containerRect.width / 2;
      const centerY = containerRect.height / 2;

      // Use provided radius or calculate from container
      const r = radius || Math.min(centerX, centerY) * 0.8;

      // Calculate angle (starting from top, going clockwise)
      const angle = (index / divisions) * 2 * Math.PI - Math.PI / 2;

      // Convert polar to rectangular
      const x = centerX + r * Math.cos(angle);
      const y = centerY + r * Math.sin(angle);

      // Size of each cell (approximate)
      const cellSize = (2 * Math.PI * r) / divisions;

      return {
        left: x - cellSize / 2,
        top: y - cellSize / 2,
        width: cellSize,
        height: cellSize,
        // Additional info for circular positioning
        angle: angle,
        radius: r,
        centerX: centerX,
        centerY: centerY
      };
    },

    /**
     * Get number of divisions
     */
    getCount() {
      return divisions;
    },

    /**
     * Get angle for division index
     */
    getAngle(index) {
      return (index / divisions) * 2 * Math.PI - Math.PI / 2;
    },

    /**
     * Get the underlying element
     */
    get element() {
      return container;
    }
  };
}

/**
 * Creates a grid axis that combines row and column positioning
 * Useful for drum pad layouts or grid-based sequencers
 *
 * @param {number} rows - Number of rows
 * @param {number} cols - Number of columns
 * @param {HTMLElement} container - Container element
 * @returns {Object} Combined axis adapter
 */
export function createGridAxis(rows, cols, container) {
  if (!container) {
    throw new Error('Container element required');
  }

  return {
    /**
     * Get position for grid cell
     * Index is calculated as: row * cols + col
     */
    getPosition(index) {
      const row = Math.floor(index / cols);
      const col = index % cols;

      if (row >= rows || col >= cols) {
        console.warn(`Grid index ${index} out of range`);
        return { left: 0, top: 0, width: 0, height: 0 };
      }

      const containerRect = container.getBoundingClientRect();
      const cellWidth = containerRect.width / cols;
      const cellHeight = containerRect.height / rows;

      return {
        left: col * cellWidth,
        top: row * cellHeight,
        width: cellWidth,
        height: cellHeight,
        row: row,
        col: col
      };
    },

    /**
     * Get total number of cells
     */
    getCount() {
      return rows * cols;
    },

    /**
     * Convert row/col to index
     */
    getIndex(row, col) {
      return row * cols + col;
    },

    /**
     * Get row and column from index
     */
    getRowCol(index) {
      return {
        row: Math.floor(index / cols),
        col: index % cols
      };
    },

    /**
     * Get the underlying element
     */
    get element() {
      return container;
    }
  };
}