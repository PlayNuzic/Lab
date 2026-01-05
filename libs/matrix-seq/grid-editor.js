/**
 * grid-editor.js - Grid-based editor for N-P pairs (dynamic columns by pulse)
 *
 * A fully encapsulated, reusable component for editing Note-Pulse pairs in a dynamic grid layout.
 * Ready for use "out of the box" with minimal configuration.
 *
 * Features:
 * - Dynamic columns (one per pulse, created on demand)
 * - Multi-voice support (multiple notes per pulse → polyphony/monophony modes)
 * - Auto-jump navigation with 300ms delay (allows two-digit input)
 * - Auto-blur on P=7 (last pulse) without blocking note entry
 * - Auto-merge of duplicate pulse columns
 * - Auto-sort columns when pulse order changes
 * - Arrow key navigation (Up/Down/Left/Right)
 * - Keyboard shortcuts (Enter, Tab, Backspace)
 * - Range validation with contextual tooltips
 * - Highlight support for playback synchronization
 * - Responsive design (4 breakpoints: desktop, tablet, mobile, small mobile)
 *
 * CSS Required:
 * - Import '../../libs/matrix-seq/grid-editor.css' in your app
 *
 * Dependencies:
 * - libs/app-common/info-tooltip.js (for validation warnings)
 *
 * @example
 * import { createGridEditor } from '../../libs/matrix-seq/index.js';
 * import '../../libs/matrix-seq/grid-editor.css';
 *
 * const editor = createGridEditor({
 *   container: document.getElementById('editorContainer'),
 *   noteRange: [0, 11],
 *   pulseRange: [0, 7],
 *   maxPairs: 8,
 *   getPolyphonyEnabled: () => myPolyphonyState,
 *   onPairsChange: (pairs) => console.log('Pairs updated:', pairs)
 * });
 *
 * // API
 * editor.setPairs([{ note: 5, pulse: 2 }, { note: 7, pulse: 4 }]);
 * editor.highlightCell(5, 2); // Highlight during playback
 * editor.clear();
 */

import { createInfoTooltip } from '../app-common/info-tooltip.js';

/**
 * Creates grid-based pair editor with dynamic columns
 *
 * @param {Object} config - Configuration
 * @param {HTMLElement} config.container - Container element for the editor
 * @param {Array<number>} [config.noteRange=[0, 11]] - Valid note range [min, max]
 * @param {Array<number>} [config.pulseRange=[0, 7]] - Valid pulse range [min, max]
 * @param {number} [config.maxPairs=8] - Maximum number of N-P pairs allowed
 * @param {Function} [config.getPolyphonyEnabled=() => true] - Function returning polyphony state
 * @param {Function} [config.onPairsChange=(pairs) => {}] - Callback when pairs change
 * @param {boolean} [config.scrollEnabled=false] - Enable horizontal/vertical scroll for large grids
 * @param {Object} [config.containerSize=null] - Fixed container size {width, height, maxWidth, maxHeight}
 * @param {Object} [config.columnSize=null] - Fixed column size in scroll mode {width, minHeight}
 * @returns {Object} - Editor API with methods: render, getPairs, setPairs, clear, highlightCell, clearHighlights
 */
export function createGridEditor(config = {}) {
  const {
    container,
    noteRange = [0, 11],
    pulseRange = [0, 7],
    maxPairs = 8,
    onPairsChange = () => {},
    getPolyphonyEnabled = () => true,  // Default: allow polyphony
    scrollEnabled = false,
    containerSize = null,
    columnSize = null,
    mode = 'standard',  // 'standard' | 'interval' | 'nrx-it' | 'degree'
    showZigzag = false,
    showIntervalLabels = true,
    leftZigzagLabels = null,
    autoJumpDelayMs = 300,  // Custom auto-jump delay (ms)
    intervalModeOptions = null,  // Options for interval mode (basePair, maxTotalPulse, etc.)
    nrxModeOptions = null,  // Options for nrx-it mode (registryRange, validateNoteRegistry, etc.)
    degreeModeOptions = null  // Options for degree mode (totalPulses, getScaleLength, validateDegree)
  } = config;

  let currentPairs = [];
  let autoJumpTimer = null;
  const AUTO_JUMP_DELAY = autoJumpDelayMs; // Use provided delay or default

  // Info tooltip for warnings
  const infoTooltip = createInfoTooltip({
    className: 'fraction-info-bubble auto-tip-below',
    autoRemoveDelay: 2000
  });

  /**
   * Groups pairs by pulse
   * @param {Array} pairs - Array of {note, pulse} objects (note can be null for empty columns)
   * @returns {Object} - { pulse: [note1, note2, ...] }
   */
  function groupPairsByPulse(pairs) {
    const grouped = {};
    pairs.forEach(({ note, pulse }) => {
      if (!grouped[pulse]) {
        grouped[pulse] = [];
      }
      // Only add note if it's not null (preserve empty pulses with empty array)
      if (note !== null) {
        grouped[pulse].push(note);
      }
    });
    return grouped;
  }

  /**
   * Calculates maximum voices needed across all pulses
   * @param {Object} grouped - Grouped pairs by pulse
   * @returns {number} - Max voice count (minimum 2 for empty state)
   */
  function calculateMaxVoices(grouped) {
    let max = 1;
    for (const pulse in grouped) {
      const voiceCount = grouped[pulse].length;
      if (voiceCount > max) {
        max = voiceCount;
      }
    }
    // Minimum 2 rows for empty state, max 12 voices
    return Math.max(2, Math.min(max + 1, 12)); // +1 for empty input row
  }

  /**
   * Renders the grid
   */
  function render(pairs = []) {
    currentPairs = [...pairs];

    if (!container) {
      console.warn('No container provided for grid editor');
      return;
    }

    // Clear existing content
    container.innerHTML = '';
    container.className = 'matrix-grid-editor';

    // Use different render modes
    if (mode === 'interval' && showZigzag) {
      renderIntervalMode(pairs);
      return;
    }

    if (mode === 'n-it' && showZigzag) {
      renderNItMode(pairs);
      return;
    }

    if (mode === 'nrx-it') {
      renderNrxItMode(pairs);
      return;
    }

    if (mode === 'degree') {
      renderDegreeMode(pairs);
      return;
    }

    // Apply scroll mode class if enabled
    if (scrollEnabled) {
      container.classList.add('matrix-grid-editor--scrollable');
    }

    // Apply container size if provided
    if (containerSize) {
      if (containerSize.width) container.style.width = containerSize.width;
      if (containerSize.height) container.style.height = containerSize.height;
      if (containerSize.maxWidth) container.style.maxWidth = containerSize.maxWidth;
      if (containerSize.maxHeight) container.style.maxHeight = containerSize.maxHeight;
    }

    // Group pairs by pulse
    const grouped = groupPairsByPulse(pairs);
    const pulses = Object.keys(grouped).map(Number).sort((a, b) => a - b);

    // Calculate dynamic height based on actual max voices
    const maxVoices = calculateMaxVoices(grouped);
    const dynamicHeight = maxVoices * 60; // 60px per voice row

    // Set CSS custom property for dynamic height
    container.style.setProperty('--notes-height', `${dynamicHeight}px`);

    // Set CSS custom property for fixed column size in scroll mode
    if (scrollEnabled && columnSize) {
      if (columnSize.width) {
        container.style.setProperty('--column-width', columnSize.width);
      }
      if (columnSize.minHeight) {
        container.style.setProperty('--column-min-height', columnSize.minHeight);
      }
    }

    // Create label column (N and P labels on the left)
    const labelColumn = document.createElement('div');
    labelColumn.className = 'grid-label-column';

    const nLabel = document.createElement('div');
    nLabel.className = 'grid-row-label grid-row-label--n';
    nLabel.textContent = 'N';
    labelColumn.appendChild(nLabel);

    const pLabel = document.createElement('div');
    pLabel.className = 'grid-row-label grid-row-label--p';
    pLabel.textContent = 'P';
    labelColumn.appendChild(pLabel);

    container.appendChild(labelColumn);

    // Create columns container (with optional scroll wrapper)
    const columnsContainer = document.createElement('div');
    columnsContainer.className = 'grid-columns-container';

    // If scroll enabled, wrap columns in scrollable container
    if (scrollEnabled) {
      columnsContainer.classList.add('grid-columns-container--scrollable');
    }

    // If no pairs, render single empty column
    if (pulses.length === 0) {
      const emptyColumn = createPulseColumn(null, []);
      columnsContainer.appendChild(emptyColumn);
      container.appendChild(columnsContainer);
      // Focus first input
      requestAnimationFrame(() => {
        const firstInput = emptyColumn.querySelector('.note-input');
        if (firstInput) {
          firstInput.focus();
        }
      });
      return;
    }

    // Render columns for each pulse
    pulses.forEach(pulse => {
      const notes = grouped[pulse];
      const column = createPulseColumn(pulse, notes);
      columnsContainer.appendChild(column);
    });

    container.appendChild(columnsContainer);
  }

  /**
   * Renders the grid in interval mode with zigzag layout
   */
  function renderIntervalMode(pairs = []) {
    currentPairs = [...pairs];

    // Clear container
    container.innerHTML = '';
    container.className = 'matrix-grid-editor matrix-grid-editor--interval';
    if (!showIntervalLabels) {
      container.classList.add('zigzag--no-headers');
    }

    // Create zigzag container (2 rows)
    const zigzagContainer = document.createElement('div');
    zigzagContainer.className = 'grid-zigzag-container';

    // Row 1: N, iS₁, iS₂, iS₃...
    const row1 = document.createElement('div');
    row1.className = 'zigzag-row zigzag-row--top';

    // Row 2: P, iT₁, iT₂, iT₃...
    const row2 = document.createElement('div');
    row2.className = 'zigzag-row zigzag-row--bottom';

    // Optional left labels (iS / iT to mimic App12 style)
    if (leftZigzagLabels) {
      const topLabel = document.createElement('div');
      topLabel.className = 'zigzag-left-label zigzag-left-label--top';
      topLabel.textContent = leftZigzagLabels.topText || '';
      row1.appendChild(topLabel);

      const bottomLabel = document.createElement('div');
      bottomLabel.className = 'zigzag-left-label zigzag-left-label--bottom';
      bottomLabel.textContent = leftZigzagLabels.bottomText || '';
      row2.appendChild(bottomLabel);
    }

    // First pair is always N-P
    // In interval mode with hideInitialPair, use basePair from options
    const defaultPair = { note: null, pulse: null };
    const basePair = intervalModeOptions?.basePair || defaultPair;

    // When hideInitialPair is enabled, pairs doesn't include the base
    // We need to prepend basePair for correct interval calculation
    let displayPairs;
    if (intervalModeOptions?.hideInitialPair && pairs.length > 0) {
      // Prepend basePair for interval calculation
      displayPairs = [basePair, ...pairs];
    } else {
      displayPairs = pairs.length > 0 ? pairs : [basePair];
    }

    const firstPair = displayPairs[0];

    // Create N cell (first pair)
    const nCell = document.createElement('div');
    nCell.className = 'zigzag-cell zigzag-cell--n';

    if (showIntervalLabels) {
      const nLabel = document.createElement('div');
      nLabel.className = 'zigzag-label';
      nLabel.textContent = 'N';
      nCell.appendChild(nLabel);
    }

    const nInput = document.createElement('input');
    nInput.className = 'zigzag-input note-input zigzag-input--n';
    nInput.type = 'text';
    nInput.value = firstPair.note !== null ? String(firstPair.note) : '';
    nInput.maxLength = 2;
    nInput.dataset.index = '0';
    nInput.dataset.type = 'note';
    nInput.addEventListener('input', (e) => handleIntervalInputChange(e, 0, 'note'));
    nInput.addEventListener('keydown', (e) => handleIntervalKeyDown(e, 0, 'note'));
    nCell.appendChild(nInput);
    row1.appendChild(nCell);

    // Create P cell (first pair)
    const pCell = document.createElement('div');
    pCell.className = 'zigzag-cell zigzag-cell--p';

    if (showIntervalLabels) {
      const pLabel = document.createElement('div');
      pLabel.className = 'zigzag-label';
      pLabel.textContent = 'P';
      pCell.appendChild(pLabel);
    }

    const pInput = document.createElement('input');
    pInput.className = 'zigzag-input pulse-input zigzag-input--p';
    pInput.type = 'text';
    pInput.value = firstPair.pulse !== null ? String(firstPair.pulse) : '';
    pInput.maxLength = 1;
    pInput.dataset.index = '0';
    pInput.dataset.type = 'pulse';
    pInput.addEventListener('input', (e) => handleIntervalInputChange(e, 0, 'pulse'));
    pInput.addEventListener('keydown', (e) => handleIntervalKeyDown(e, 0, 'pulse'));
    pCell.appendChild(pInput);
    row2.appendChild(pCell);

    // Convert pairs to intervals for display (using displayPairs which includes basePair)
    const intervals = [];
    for (let i = 1; i < displayPairs.length; i++) {
      const currentPair = displayPairs[i];
      const prevPair = displayPairs[i-1];
      const soundInterval = currentPair.note - prevPair.note;
      // Use temporalInterval from pair if available (pulse=START semantics),
      // fallback to pulse difference for backwards compatibility
      const temporalInterval = currentPair.temporalInterval || (currentPair.pulse - prevPair.pulse) || 1;
      // Preserve isRest flag for silences
      intervals.push({
        soundInterval,
        temporalInterval,
        isRest: currentPair.isRest || false
      });
    }

    // Create interval cells
    intervals.forEach((interval, index) => {
      // iS cell in row 1
      const isCell = document.createElement('div');
      isCell.className = 'zigzag-cell zigzag-cell--is';

      if (showIntervalLabels) {
        const isLabel = document.createElement('div');
        isLabel.className = 'zigzag-label';
        isLabel.textContent = `iS${index + 1}`;
        isCell.appendChild(isLabel);
      }

      const isInput = document.createElement('input');
      isInput.className = 'zigzag-input interval-input zigzag-input--is';
      isInput.type = 'text';
      // Show 's' for silences, formatted interval for normal notes
      if (interval.isRest) {
        isInput.value = 's';
        isInput.dataset.isSilence = 'true';
      } else {
        isInput.value = interval.soundInterval !== null ? formatIntervalValue(interval.soundInterval) : '';
      }
      isInput.maxLength = 3; // Allow negative sign
      isInput.dataset.index = String(index + 1);
      isInput.dataset.type = 'is';
      isInput.addEventListener('input', (e) => handleIntervalInputChange(e, index + 1, 'is'));
      isInput.addEventListener('keydown', (e) => handleIntervalKeyDown(e, index + 1, 'is'));
      isCell.appendChild(isInput);
      row1.appendChild(isCell);

      // iT cell in row 2
      const itCell = document.createElement('div');
      itCell.className = 'zigzag-cell zigzag-cell--it';

      if (showIntervalLabels) {
        const itLabel = document.createElement('div');
        itLabel.className = 'zigzag-label';
        itLabel.textContent = `iT${index + 1}`;
        itCell.appendChild(itLabel);
      }

      const itInput = document.createElement('input');
      itInput.className = 'zigzag-input interval-input zigzag-input--it';
      itInput.type = 'text';
      itInput.value = interval.temporalInterval !== null ? String(interval.temporalInterval) : '';
      itInput.maxLength = 1;
      itInput.dataset.index = String(index + 1);
      itInput.dataset.type = 'it';
      itInput.addEventListener('input', (e) => handleIntervalInputChange(e, index + 1, 'it'));
      itInput.addEventListener('keydown', (e) => handleIntervalKeyDown(e, index + 1, 'it'));
      itCell.appendChild(itInput);
      row2.appendChild(itCell);
    });

    zigzagContainer.appendChild(row1);
    zigzagContainer.appendChild(row2);
    container.appendChild(zigzagContainer);

    // Apply ghost patterns to existing cells
    applyISPattern(row1);
    applyITPattern(row2);

    // Ensure at least one empty slot for adding new pairs
    ensureEmptyIntervalSlot();

    // Focus first visible interval input (iS₁)
    requestAnimationFrame(() => {
      const firstVisibleInput = container.querySelector('.interval-input');
      if (firstVisibleInput) firstVisibleInput.focus();
    });
  }

  /**
   * Renders the grid in N-iT mode (Note + Temporal Intervals with zigzag layout)
   * Similar to interval mode but with absolute note values instead of intervals
   *
   * Layout (zigzag pattern):
   * Row 1 (N): Label "N" | N₁ | (ghost) | N₂ | (ghost) | N₃ ...
   * Row 2 (iT): Label "iT" | (ghost) | iT₁ | (ghost) | iT₂ ...
   *
   * Navigation: N₁ → iT₁ → N₂ → iT₂ → N₃ → ...
   * (First note has no iT before it)
   */
  function renderNItMode(pairs = []) {
    currentPairs = [...pairs];

    // Clear container
    container.innerHTML = '';
    container.className = 'matrix-grid-editor matrix-grid-editor--interval matrix-grid-editor--n-it';
    if (!showIntervalLabels) {
      container.classList.add('zigzag--no-headers');
    }

    // Create zigzag container (2 rows)
    const zigzagContainer = document.createElement('div');
    zigzagContainer.className = 'grid-zigzag-container';

    // Row 1: N₁, N₂, N₃...
    const row1 = document.createElement('div');
    row1.className = 'zigzag-row zigzag-row--top';

    // Row 2: iT₁, iT₂, iT₃...
    const row2 = document.createElement('div');
    row2.className = 'zigzag-row zigzag-row--bottom';

    // Optional left labels (N / iT)
    if (leftZigzagLabels) {
      const topLabel = document.createElement('div');
      topLabel.className = 'zigzag-left-label zigzag-left-label--top';
      topLabel.textContent = leftZigzagLabels.topText || 'N';
      row1.appendChild(topLabel);

      const bottomLabel = document.createElement('div');
      bottomLabel.className = 'zigzag-left-label zigzag-left-label--bottom';
      bottomLabel.textContent = leftZigzagLabels.bottomText || 'iT';
      row2.appendChild(bottomLabel);
    }

    // Get configuration
    const maxTotalPulse = intervalModeOptions?.maxTotalPulse || pulseRange[1];
    const hideInitialPair = intervalModeOptions?.hideInitialPair || false;
    const basePair = intervalModeOptions?.basePair || { note: 0, pulse: 0 };

    // When hideInitialPair is enabled, prepend basePair for interval calculation
    // This allows the first visible note to have an iT showing distance from pulse 0
    let displayPairs;
    if (hideInitialPair && pairs.length > 0) {
      displayPairs = [basePair, ...pairs];
    } else {
      displayPairs = pairs;
    }

    // Calculate intervals from displayPairs (include registry)
    const intervals = [];
    for (let i = 1; i < displayPairs.length; i++) {
      const currentPair = displayPairs[i];
      const prevPair = displayPairs[i - 1];
      // Use temporalInterval from pair if available, else calculate from pulse difference
      const temporalInterval = currentPair.temporalInterval || (currentPair.pulse - prevPair.pulse) || 1;
      intervals.push({
        note: currentPair.note,
        registry: currentPair.registry,
        temporalInterval,
        isRest: currentPair.isRest || false
      });
    }

    // Create cells for each pair
    if (pairs.length === 0) {
      // First empty N cell (with null registry)
      const nCell = createNItNoteCell(0, null, null);
      row1.appendChild(nCell);

      // When hideInitialPair, show iT input even for first note
      if (hideInitialPair) {
        const itCell = createNItTemporalCell(0, null);
        row2.appendChild(itCell);
      } else {
        // Ghost cell for alignment in iT row
        const ghost = createGhostCell();
        row2.appendChild(ghost);
      }
    } else if (hideInitialPair) {
      // With hideInitialPair: each note N[i] has its corresponding iT[i]
      // N[0] shows pairs[0], iT[0] shows distance from basePair to pairs[0]
      pairs.forEach((pair, index) => {
        // N cell in row 1 (pass isRest for silence support)
        const nCell = createNItNoteCell(index, pair.note, pair.registry, pair.isRest);
        row1.appendChild(nCell);

        // iT cell in row 2 - use temporalInterval from intervals array (calculated from basePair)
        const intervalData = intervals[index];
        const itCell = createNItTemporalCell(index, intervalData?.temporalInterval ?? pair.temporalInterval);
        row2.appendChild(itCell);
      });
    } else {
      // Original behavior: first note has ghost, subsequent have iT
      // First note cell (with registry) - pass isRest for silence support
      const firstNCell = createNItNoteCell(0, pairs[0].note, pairs[0].registry, pairs[0].isRest);
      row1.appendChild(firstNCell);

      // Ghost in iT row for first note
      const firstGhost = createGhostCell();
      row2.appendChild(firstGhost);

      // Create cells for remaining pairs (with iT before each)
      intervals.forEach((interval, index) => {
        // N cell in row 1 (index+1 because first note is at index 0) - include registry and isRest
        const nCell = createNItNoteCell(index + 1, interval.note, interval.registry, interval.isRest);
        row1.appendChild(nCell);

        // iT cell in row 2
        const itCell = createNItTemporalCell(index + 1, interval.temporalInterval);
        row2.appendChild(itCell);
      });
    }

    zigzagContainer.appendChild(row1);
    zigzagContainer.appendChild(row2);
    container.appendChild(zigzagContainer);

    // Apply ghost patterns (zigzag visual)
    applyNItPattern(row1, row2);

    // Ensure at least one empty slot for adding new notes
    ensureEmptyNItSlot();

    // Notify pairs change (like interval mode does)
    // This ensures syncGridFromPairs is called after setPairs
    if (pairs.length > 0) {
      onPairsChange(pairs);
    }

    // Focus first N input
    requestAnimationFrame(() => {
      const firstInput = container.querySelector('.n-it-note-input');
      if (firstInput) firstInput.focus();
    });
  }

  /**
   * Creates an N cell for N-iT mode (NrX format: Note + 'r' + Registry)
   * @param {number} index - Cell index
   * @param {number|null} note - Note value (0-11) or null
   * @param {number|null} registry - Registry value (3-5) or null
   */
  function createNItNoteCell(index, note, registry = null, isRest = false) {
    const cell = document.createElement('div');
    cell.className = 'zigzag-cell zigzag-cell--n-it-note';

    // Handle silence (isRest)
    if (isRest) {
      cell.classList.add('zigzag-cell--silence');
    } else if (note === null) {
      cell.classList.add('zigzag-cell--empty');
    }

    // Note input
    const noteInput = document.createElement('input');
    noteInput.className = 'zigzag-input n-it-note-input zigzag-input--n';
    noteInput.type = 'text';
    // Show 's' for silences, note value for notes, empty for empty
    noteInput.value = isRest ? 's' : (note !== null ? String(note) : '');
    noteInput.maxLength = 2;
    noteInput.dataset.index = String(index);
    noteInput.dataset.type = 'n-it-note';
    noteInput.placeholder = 'N';
    noteInput.autocomplete = 'off';
    noteInput.spellcheck = false;
    if (isRest) {
      noteInput.dataset.isSilence = 'true';
    }
    noteInput.addEventListener('input', (e) => handleNItInputChange(e, index, 'note'));
    noteInput.addEventListener('keydown', (e) => handleNItKeyDown(e, index, 'note'));
    cell.appendChild(noteInput);

    // 'r' separator (always visible for unified cell appearance)
    const rSeparator = document.createElement('span');
    rSeparator.className = 'nrx-separator';
    rSeparator.textContent = 'r';
    // Hidden for silences, visible but dimmed when note is empty
    rSeparator.style.opacity = isRest ? '0' : (note !== null ? '0.6' : '0.3');
    cell.appendChild(rSeparator);

    // Registry input (always visible for unified cell appearance)
    const regInput = document.createElement('input');
    regInput.className = 'zigzag-input n-it-registry-input zigzag-input--n';
    regInput.type = 'text';
    regInput.value = isRest ? '' : (registry !== null ? String(registry) : '');
    regInput.maxLength = 1;
    regInput.dataset.index = String(index);
    regInput.dataset.type = 'n-it-registry';
    regInput.placeholder = 'R';
    // Hidden for silences, visible but dimmed when note is empty
    regInput.style.opacity = isRest ? '0' : (note !== null ? '1' : '0.4');
    if (isRest) {
      regInput.disabled = true;
    }
    regInput.addEventListener('input', (e) => handleNItInputChange(e, index, 'registry'));
    regInput.addEventListener('keydown', (e) => handleNItKeyDown(e, index, 'registry'));
    cell.appendChild(regInput);

    return cell;
  }

  /**
   * Creates an iT cell for N-iT mode
   */
  function createNItTemporalCell(index, temporalInterval) {
    const cell = document.createElement('div');
    cell.className = 'zigzag-cell zigzag-cell--n-it-temporal zigzag-cell--it';
    if (temporalInterval === null) {
      cell.classList.add('zigzag-cell--empty');
    }

    const input = document.createElement('input');
    input.className = 'zigzag-input n-it-temporal-input zigzag-input--it';
    input.type = 'text';
    input.value = temporalInterval !== null ? String(temporalInterval) : '';
    input.maxLength = 2;
    input.dataset.index = String(index);
    input.dataset.type = 'n-it-temporal';
    input.addEventListener('input', (e) => handleNItInputChange(e, index, 'it'));
    input.addEventListener('keydown', (e) => handleNItKeyDown(e, index, 'it'));
    cell.appendChild(input);

    return cell;
  }

  /**
   * Applies zigzag pattern to N-iT mode rows
   * Row 1 (N): N₁ | (ghost) | N₂ | (ghost) | N₃ ...
   * Row 2 (iT): (ghost) | iT₁ | (ghost) | iT₂ ...
   */
  function applyNItPattern(row1, row2) {
    // Remove existing ghosts
    Array.from(row1.querySelectorAll('.zigzag-cell--ghost')).forEach(el => el.remove());
    Array.from(row2.querySelectorAll('.zigzag-cell--ghost')).forEach(el => el.remove());

    // Row 1: Add ghost AFTER each N cell (except last)
    const nCells = Array.from(row1.querySelectorAll('.zigzag-cell--n-it-note'));
    nCells.forEach((cell, idx) => {
      if (idx < nCells.length - 1) {
        const ghost = createGhostCell();
        cell.after(ghost);
      }
    });

    // Row 2: Add ghost BEFORE each iT cell
    const itCells = Array.from(row2.querySelectorAll('.zigzag-cell--n-it-temporal'));
    itCells.forEach(cell => {
      const ghost = createGhostCell();
      cell.before(ghost);
    });

    // Add trailing ghost to row 2 for alignment
    const lastItCell = row2.querySelector('.zigzag-cell--n-it-temporal:last-of-type');
    if (lastItCell) {
      const trailingGhost = createGhostCell();
      lastItCell.after(trailingGhost);
    }
  }

  /**
   * Ensures there's an empty slot for adding new N-iT pairs
   */
  function ensureEmptyNItSlot() {
    const row1 = container.querySelector('.zigzag-row--top');
    const row2 = container.querySelector('.zigzag-row--bottom');
    if (!row1 || !row2) return;

    // Check if we can add more
    const maxTotalPulse = intervalModeOptions?.maxTotalPulse || pulseRange[1];
    const currentTotal = calculateNItTotalPulse();
    if (currentTotal >= maxTotalPulse) return;

    // Check if last N cell is empty
    const nCells = row1.querySelectorAll('.zigzag-cell--n-it-note');
    const lastNCell = nCells[nCells.length - 1];
    const lastNInput = lastNCell?.querySelector('.n-it-note-input');

    if (lastNInput && lastNInput.value !== '') {
      // Add empty N cell
      const newIndex = nCells.length;
      const emptyNCell = createNItNoteCell(newIndex, null);
      row1.appendChild(emptyNCell);

      // Add corresponding iT cell
      const emptyItCell = createNItTemporalCell(newIndex, null);
      row2.appendChild(emptyItCell);

      // Reapply pattern
      applyNItPattern(row1, row2);
    }
  }

  /**
   * Calculates total pulse from N-iT pairs
   */
  function calculateNItTotalPulse() {
    let total = 0;
    const itInputs = container.querySelectorAll('.n-it-temporal-input');
    itInputs.forEach(input => {
      const val = parseInt(input.value);
      if (!isNaN(val)) total += val;
    });
    return total;
  }

  /**
   * Gets the last used registry value from previous N cells
   * @param {number} currentIndex - Current cell index to search backwards from
   * @returns {number|null} Last registry value or null if none found
   */
  function getLastUsedRegistry(currentIndex) {
    for (let i = currentIndex - 1; i >= 0; i--) {
      const regInput = container.querySelector(`.n-it-registry-input[data-index="${i}"]`);
      if (regInput && regInput.value) {
        const regVal = parseInt(regInput.value);
        if (!isNaN(regVal)) return regVal;
      }
    }
    return null;
  }

  /**
   * Validates and auto-fills registry when navigating away from registry input
   * @param {HTMLElement} regInput - Registry input element
   * @param {number} index - Cell index
   * @returns {boolean} True if navigation should proceed, false if blocked
   */
  function validateOrAutoFillRegistry(regInput, index) {
    const regValue = regInput?.value?.trim();

    // If registry has value, allow navigation
    if (regValue) return true;

    // Registry is empty - check if this is the first note
    if (index === 0) {
      // First note: require registry, show tooltip
      showInputTooltip(regInput, 'Define el registro');
      regInput.classList.add('invalid');
      regInput.focus();
      return false;
    }

    // Not first note: try to auto-fill from last used registry
    const lastRegistry = getLastUsedRegistry(index);
    if (lastRegistry !== null) {
      regInput.value = lastRegistry;
      regInput.classList.remove('invalid');

      // Validate the auto-filled registry with current note
      if (nrxModeOptions?.validateNoteRegistry) {
        const cell = regInput.closest('.zigzag-cell--n-it-note');
        const noteInput = cell?.querySelector('.n-it-note-input');
        const noteVal = noteInput ? parseInt(noteInput.value) : NaN;
        if (!isNaN(noteVal)) {
          const validation = nrxModeOptions.validateNoteRegistry(noteVal, lastRegistry);
          if (!validation.valid) {
            // Auto-filled registry is invalid for this note
            regInput.value = '';
            showInputTooltip(regInput, validation.message || 'Define el registro');
            regInput.classList.add('invalid');
            regInput.focus();
            return false;
          }
        }
      }

      // Update pairs with auto-filled registry
      updateNItPairsFromDOM();
      return true;
    }

    // No previous registry found - require input
    showInputTooltip(regInput, 'Define el registro');
    regInput.classList.add('invalid');
    regInput.focus();
    return false;
  }

  /**
   * Handles input changes in N-iT mode (note, registry, it)
   */
  function handleNItInputChange(event, index, type) {
    const input = event.target;
    const text = input.value.trim();
    const cell = input.closest('.zigzag-cell--n-it-note');

    // Clear invalid state
    input.classList.remove('invalid');

    if (type === 'note') {
      // Check for silence ('s' or 'S')
      const allowSilence = intervalModeOptions?.allowSilence;
      const isSilence = allowSilence && text.toLowerCase() === 's';

      if (isSilence) {
        // Mark as silence
        input.dataset.isSilence = 'true';
        if (cell) {
          cell.classList.add('zigzag-cell--silence');
          cell.classList.remove('zigzag-cell--empty');
          const rSeparator = cell.querySelector('.nrx-separator');
          const regInput = cell.querySelector('.n-it-registry-input');
          // Hide registry for silences
          if (rSeparator) rSeparator.style.opacity = '0';
          if (regInput) {
            regInput.style.opacity = '0';
            regInput.value = '';
            regInput.disabled = true;
          }
        }
        updateNItPairsFromDOM();
        return;
      }

      // Clear silence state if not 's'
      delete input.dataset.isSilence;
      if (cell) {
        cell.classList.remove('zigzag-cell--silence');
        const regInput = cell.querySelector('.n-it-registry-input');
        if (regInput) regInput.disabled = false;
      }

      // Note must be 0-11
      if (text && !/^-?\d*$/.test(text)) {
        input.value = text.replace(/[^\d-]/g, '');
        return;
      }
      const noteVal = parseInt(text);
      if (text && !isNaN(noteVal) && (noteVal < noteRange[0] || noteVal > noteRange[1])) {
        showInputTooltip(input, `Nota: ${noteRange[0]}-${noteRange[1]}`);
        input.classList.add('invalid');
        input.value = ''; // Clear invalid value
        input.focus();    // Keep caret in same cell
        return;
      }

      // Validate note+registry combination if custom validator provided and registry is set
      if (text && !isNaN(noteVal) && nrxModeOptions?.validateNoteRegistry) {
        const regInput = cell?.querySelector('.n-it-registry-input');
        const regVal = regInput ? parseInt(regInput.value) : NaN;
        if (!isNaN(regVal)) {
          const validation = nrxModeOptions.validateNoteRegistry(noteVal, regVal);
          if (!validation.valid) {
            showInputTooltip(input, validation.message || 'Combinación inválida');
            input.classList.add('invalid');
            input.value = ''; // Clear invalid note
            input.focus();
            return;
          }
        }
      }

      // Update opacity of 'r' separator and registry input based on note value
      if (cell) {
        const rSeparator = cell.querySelector('.nrx-separator');
        const regInput = cell.querySelector('.n-it-registry-input');
        if (text && !isNaN(noteVal)) {
          // Valid note entered - full opacity for separator and registry
          if (rSeparator) rSeparator.style.opacity = '0.6';
          if (regInput) regInput.style.opacity = '1';
          cell.classList.remove('zigzag-cell--empty');
        } else {
          // Note cleared - dim separator and registry, clear registry value
          if (rSeparator) rSeparator.style.opacity = '0.3';
          if (regInput) {
            regInput.style.opacity = '0.4';
            regInput.value = '';
          }
          cell.classList.add('zigzag-cell--empty');
        }
      }

      // Update pairs when note changes (triggers grid sync and auto-scroll)
      updateNItPairsFromDOM();

      // Auto-jump to registry input after valid note (300ms fixed delay)
      if (text && !isNaN(noteVal)) {
        clearTimeout(autoJumpTimer);
        autoJumpTimer = setTimeout(() => {
          const regInput = cell?.querySelector('.n-it-registry-input');
          if (regInput) {
            regInput.focus();
            regInput.select();
          }
        }, 300); // Fixed 300ms for N → r transition
      }
    } else if (type === 'registry') {
      // Registry must be 3-5 (configurable via nrxModeOptions)
      const regRange = nrxModeOptions?.registryRange || [3, 5];
      if (text && !/^\d$/.test(text)) {
        input.value = text.replace(/\D/g, '');
        return;
      }
      const regVal = parseInt(text);
      if (text && !isNaN(regVal) && (regVal < regRange[0] || regVal > regRange[1])) {
        showInputTooltip(input, `Registro: ${regRange[0]}-${regRange[1]}`);
        input.classList.add('invalid');
        input.value = ''; // Clear invalid value
        input.focus();    // Keep caret in same cell
        return;
      }

      // Validate note+registry combination if custom validator provided
      if (text && !isNaN(regVal) && nrxModeOptions?.validateNoteRegistry) {
        const noteInput = cell?.querySelector('.n-it-note-input');
        const noteVal = noteInput ? parseInt(noteInput.value) : NaN;
        if (!isNaN(noteVal)) {
          const validation = nrxModeOptions.validateNoteRegistry(noteVal, regVal);
          if (!validation.valid) {
            showInputTooltip(input, validation.message || 'Combinación inválida');
            input.classList.add('invalid');
            input.value = ''; // Clear invalid registry
            input.focus();
            return;
          }
        }
      }

      // Update pairs when registry changes
      updateNItPairsFromDOM();

      // Auto-jump after valid registry - ZIGZAG navigation
      // With hideInitialPair: N[n](registry) → iT[n] (same index)
      // Without hideInitialPair: N[n](registry) → iT[n+1]
      if (text) {
        clearTimeout(autoJumpTimer);
        autoJumpTimer = setTimeout(() => {
          const hideInitialPair = intervalModeOptions?.hideInitialPair || false;
          // With hideInitialPair, iT[n] corresponds to N[n]
          // Without it, iT[n+1] corresponds to N[n] (first N has ghost)
          const targetItIndex = hideInitialPair ? index : index + 1;

          // First check if target iT exists
          let itInput = container.querySelector(`.n-it-temporal-input[data-index="${targetItIndex}"]`);

          if (!itInput) {
            // Create next N cell (which also creates corresponding iT)
            jumpToNextNItCell(index);
          }

          // Wait for DOM to update, then focus on target iT
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              itInput = container.querySelector(`.n-it-temporal-input[data-index="${targetItIndex}"]`);
              if (itInput) {
                itInput.focus();
                itInput.select();
              }
            });
          });
        }, AUTO_JUMP_DELAY);
      }
    } else if (type === 'it') {
      // iT must be positive integer
      if (text && !/^\d*$/.test(text)) {
        input.value = text.replace(/\D/g, '');
        return;
      }
      const itVal = parseInt(text);
      const maxTotalPulse = intervalModeOptions?.maxTotalPulse || pulseRange[1];
      const currentTotal = calculateNItTotalPulse();

      if (text && !isNaN(itVal) && itVal < 1) {
        showInputTooltip(input, 'iT debe ser ≥ 1');
        input.classList.add('invalid');
        input.value = ''; // Clear invalid value
        input.focus();    // Keep caret in same cell
        return;
      }
      if (text && !isNaN(itVal) && currentTotal > maxTotalPulse) {
        showInputTooltip(input, `iT máximo: ${maxTotalPulse - currentTotal + itVal}`);
        input.classList.add('invalid');
        input.value = ''; // Clear invalid value
        input.focus();    // Keep caret in same cell
        return;
      }

      // Check if sequence is complete (total pulses reached max)
      if (text && !isNaN(itVal) && currentTotal === maxTotalPulse) {
        // Update pairs first
        updateNItPairsFromDOM();
        // Remove any empty slots
        removeEmptyNItSlots();
        // Blur to end editing
        input.blur();
        showInputTooltip(input, 'Sucesión completa');
        return;
      }

      // Auto-jump to next N after valid iT (only if not complete)
      // With hideInitialPair: iT[n] corresponds to N[n], so after iT[n] go to N[n+1]
      // Without hideInitialPair: iT[n] corresponds to N[n-1], so after iT[n] go to N[n]
      if (text) {
        clearTimeout(autoJumpTimer);
        autoJumpTimer = setTimeout(() => {
          // Check if we're at max - don't auto-jump if sequence is full
          const maxTotalPulse = intervalModeOptions?.maxTotalPulse || pulseRange[1];
          const currentTotal = calculateNItTotalPulse();
          if (currentTotal >= maxTotalPulse) {
            // Stay in current cell, don't jump
            return;
          }

          const hideInitialPair = intervalModeOptions?.hideInitialPair || false;
          // With hideInitialPair: iT[n] → N[n+1]
          // Without: iT[n] → N[n]
          const targetNIndex = hideInitialPair ? index + 1 : index;

          // Check if target N exists
          let noteInput = container.querySelector(`.n-it-note-input[data-index="${targetNIndex}"]`);

          if (!noteInput) {
            // Create next N cell (jumpToNextNItCell will check max again internally)
            jumpToNextNItCell(hideInitialPair ? index : index - 1);
          }

          // Wait for DOM update then focus
          requestAnimationFrame(() => {
            noteInput = container.querySelector(`.n-it-note-input[data-index="${targetNIndex}"]`);
            if (noteInput) {
              noteInput.focus();
              noteInput.select();
            }
            // If noteInput still doesn't exist, stay in current cell (don't jump anywhere)
          });
        }, AUTO_JUMP_DELAY);
      }
    }

    // Update pairs
    updateNItPairsFromDOM();
  }

  /**
   * Handles keydown in N-iT mode (note, registry, it)
   * Navigation: note → registry → iT → note → registry → iT → ...
   */
  function handleNItKeyDown(event, index, type) {
    const input = event.target;
    const cell = input.closest('.zigzag-cell--n-it-note');

    // Handle 's' or 'S' for silence in note field (if allowSilence is enabled)
    const allowSilence = intervalModeOptions?.allowSilence;
    if ((event.key === 's' || event.key === 'S') && type === 'note' && allowSilence) {
      event.preventDefault();
      input.value = 's';
      input.dataset.isSilence = 'true';

      // Update cell appearance for silence
      if (cell) {
        cell.classList.add('zigzag-cell--silence');
        cell.classList.remove('zigzag-cell--empty');
        const rSeparator = cell.querySelector('.nrx-separator');
        const regInput = cell.querySelector('.n-it-registry-input');
        // Hide registry for silences
        if (rSeparator) rSeparator.style.opacity = '0';
        if (regInput) {
          regInput.style.opacity = '0';
          regInput.value = '';
          regInput.disabled = true;
        }
      }

      // Update pairs
      updateNItPairsFromDOM();

      // Auto-jump to iT field after silence
      clearTimeout(autoJumpTimer);
      autoJumpTimer = setTimeout(() => {
        const hideInitialPair = intervalModeOptions?.hideInitialPair || false;
        const targetItIndex = hideInitialPair ? index : index + 1;
        let itInput = container.querySelector(`.n-it-temporal-input[data-index="${targetItIndex}"]`);
        if (!itInput) {
          jumpToNextNItCell(index);
          requestAnimationFrame(() => {
            itInput = container.querySelector(`.n-it-temporal-input[data-index="${targetItIndex}"]`);
            if (itInput) {
              itInput.focus();
              itInput.select();
            }
          });
        } else {
          itInput.focus();
          itInput.select();
        }
      }, 100);
      return;
    }

    switch (event.key) {
      case 'Enter':
      case 'Tab':
        event.preventDefault();
        clearTimeout(autoJumpTimer);
        if (type === 'note') {
          // Note → Registry (same cell)
          const regInput = cell?.querySelector('.n-it-registry-input');
          if (regInput && regInput.style.display !== 'none' && !regInput.disabled) {
            regInput.focus();
            regInput.select();
          } else {
            // Silence or no registry - go to iT (respecting hideInitialPair)
            const hideInitialPair = intervalModeOptions?.hideInitialPair || false;
            const targetItIndex = hideInitialPair ? index : index + 1;
            let itInput = container.querySelector(`.n-it-temporal-input[data-index="${targetItIndex}"]`);
            if (itInput) {
              itInput.focus();
              itInput.select();
            } else {
              jumpToNextNItCell(index);
              requestAnimationFrame(() => {
                itInput = container.querySelector(`.n-it-temporal-input[data-index="${targetItIndex}"]`);
                if (itInput) {
                  itInput.focus();
                  itInput.select();
                }
              });
            }
          }
        } else if (type === 'registry') {
          // Validate or auto-fill registry before navigating
          const regInput = cell?.querySelector('.n-it-registry-input');
          if (!validateOrAutoFillRegistry(regInput, index)) {
            return; // Blocked - stay in registry input
          }
          // Registry[n] → iT (respecting hideInitialPair)
          const hideInitialPair = intervalModeOptions?.hideInitialPair || false;
          const targetItIndex = hideInitialPair ? index : index + 1;
          let itInput = container.querySelector(`.n-it-temporal-input[data-index="${targetItIndex}"]`);
          if (itInput) {
            itInput.focus();
            itInput.select();
          } else {
            // iT doesn't exist, create next cell pair and focus the iT
            jumpToNextNItCell(index);
            requestAnimationFrame(() => {
              itInput = container.querySelector(`.n-it-temporal-input[data-index="${targetItIndex}"]`);
              if (itInput) {
                itInput.focus();
                itInput.select();
              }
            });
          }
        } else if (type === 'it') {
          // iT[n] → N[next] (respecting hideInitialPair)
          const hideInitialPair = intervalModeOptions?.hideInitialPair || false;
          // With hideInitialPair: iT[n] → N[n+1]
          // Without hideInitialPair: iT[n] → N[n] (because iT[n] follows R[n-1])
          const targetNIndex = hideInitialPair ? index + 1 : index;
          let noteInput = container.querySelector(`.n-it-note-input[data-index="${targetNIndex}"]`);
          if (!noteInput) {
            jumpToNextNItCell(index);
            requestAnimationFrame(() => {
              noteInput = container.querySelector(`.n-it-note-input[data-index="${targetNIndex}"]`);
              if (noteInput) {
                noteInput.focus();
                noteInput.select();
              }
            });
          } else {
            noteInput.focus();
            noteInput.select();
          }
        }
        break;

      case 'ArrowRight':
        if (isAtEnd(input)) {
          event.preventDefault();
          const hideInitialPair = intervalModeOptions?.hideInitialPair || false;
          // hideInitialPair=true:  N[n] → R[n] → iT[n] → N[n+1] ...
          // hideInitialPair=false: N[n] → R[n] → iT[n+1] → N[n+1] ...

          if (type === 'note') {
            // Note → Registry (same cell)
            const regInput = cell?.querySelector('.n-it-registry-input');
            if (regInput && !regInput.disabled) {
              regInput.focus();
            } else {
              // Silence or no registry - go to iT
              const targetItIndex = hideInitialPair ? index : index + 1;
              const itInput = container.querySelector(`.n-it-temporal-input[data-index="${targetItIndex}"]`);
              if (itInput) {
                itInput.focus();
              } else {
                jumpToNextNItCell(index);
              }
            }
          } else if (type === 'registry') {
            // Validate or auto-fill registry before navigating
            const regInput = cell?.querySelector('.n-it-registry-input');
            if (!validateOrAutoFillRegistry(regInput, index)) {
              return; // Blocked - stay in registry input
            }
            // Registry[n] → iT
            const targetItIndex = hideInitialPair ? index : index + 1;
            const itInput = container.querySelector(`.n-it-temporal-input[data-index="${targetItIndex}"]`);
            if (itInput) {
              itInput.focus();
            } else {
              // iT doesn't exist, create next cell pair and focus the iT
              jumpToNextNItCell(index);
              requestAnimationFrame(() => {
                const newItInput = container.querySelector(`.n-it-temporal-input[data-index="${targetItIndex}"]`);
                if (newItInput) newItInput.focus();
              });
            }
          } else if (type === 'it') {
            // iT[n] → N[next]
            // With hideInitialPair: iT[n] → N[n+1]
            // Without hideInitialPair: iT[n] → N[n] (because iT[n] follows R[n-1])
            const targetNIndex = hideInitialPair ? index + 1 : index;
            let noteInput = container.querySelector(`.n-it-note-input[data-index="${targetNIndex}"]`);
            if (!noteInput) {
              jumpToNextNItCell(index);
              requestAnimationFrame(() => {
                noteInput = container.querySelector(`.n-it-note-input[data-index="${targetNIndex}"]`);
                if (noteInput) noteInput.focus();
              });
            } else {
              noteInput.focus();
            }
          }
        }
        break;

      case 'ArrowLeft':
        if (isAtStart(input)) {
          event.preventDefault();
          const hideInitialPair = intervalModeOptions?.hideInitialPair || false;
          // hideInitialPair=true:  ... ← iT[n] ← R[n] ← N[n] ← iT[n-1] ...
          // hideInitialPair=false: ... ← iT[n] ← R[n-1] ← N[n-1] ← iT[n-1] ...

          if (type === 'registry') {
            // Registry → Note (same cell)
            const noteInput = cell?.querySelector('.n-it-note-input');
            if (noteInput) noteInput.focus();
          } else if (type === 'it') {
            // iT[n] → R[?]
            // hideInitialPair=true: iT[n] → R[n] (same index)
            // hideInitialPair=false: iT[n] → R[n-1]
            const targetRegIndex = hideInitialPair ? index : index - 1;
            const regInput = container.querySelector(`.n-it-registry-input[data-index="${targetRegIndex}"]`);
            if (regInput && !regInput.disabled) {
              regInput.focus();
            } else {
              // Registry disabled (silence) - go directly to N
              const noteInput = container.querySelector(`.n-it-note-input[data-index="${targetRegIndex}"]`);
              if (noteInput) noteInput.focus();
            }
          } else if (type === 'note' && index > 0) {
            // N[n] → iT[?]
            // hideInitialPair=true: N[n] → iT[n-1]
            // hideInitialPair=false: N[n] → iT[n]
            const targetItIndex = hideInitialPair ? index - 1 : index;
            const itInput = container.querySelector(`.n-it-temporal-input[data-index="${targetItIndex}"]`);
            if (itInput) {
              itInput.focus();
            } else {
              // Fallback to previous registry if no iT exists
              const prevRegInput = container.querySelector(`.n-it-registry-input[data-index="${index - 1}"]`);
              if (prevRegInput) prevRegInput.focus();
            }
          }
        }
        break;

      case 'Backspace':
        if (input.value === '') {
          event.preventDefault();
          if (type === 'note' && index > 0) {
            removeNItCellAt(index);
          } else if (type === 'registry') {
            // Registry empty → focus note
            const noteInput = cell?.querySelector('.n-it-note-input');
            if (noteInput) {
              noteInput.focus();
              noteInput.select();
            }
          } else if (type === 'it') {
            // iT empty → focus registry
            const regInput = container.querySelector(`.n-it-registry-input[data-index="${index}"]`);
            if (regInput) {
              regInput.focus();
              regInput.select();
            }
          }
        }
        break;
    }
  }

  /**
   * Jumps to next N cell in N-iT mode, creating if needed
   */
  function jumpToNextNItCell(currentIndex) {
    const nextIndex = currentIndex + 1;
    let nextNCell = container.querySelector(`.zigzag-cell--n-it-note input[data-index="${nextIndex}"]`);

    if (!nextNCell) {
      // Check if we can add more
      const maxTotalPulse = intervalModeOptions?.maxTotalPulse || pulseRange[1];
      const currentTotal = calculateNItTotalPulse();
      if (currentTotal >= maxTotalPulse) return;

      // Create new cells
      const row1 = container.querySelector('.zigzag-row--top');
      const row2 = container.querySelector('.zigzag-row--bottom');
      if (!row1 || !row2) return;

      const newNCell = createNItNoteCell(nextIndex, null);
      row1.appendChild(newNCell);

      const newItCell = createNItTemporalCell(nextIndex, null);
      row2.appendChild(newItCell);

      // Reapply pattern
      applyNItPattern(row1, row2);

      nextNCell = newNCell.querySelector('.n-it-note-input');
    }

    if (nextNCell) {
      requestAnimationFrame(() => {
        nextNCell.focus();
        nextNCell.select();
      });
    }
  }

  /**
   * Removes N-iT cell at index
   */
  function removeNItCellAt(index) {
    const nCell = container.querySelector(`.zigzag-cell--n-it-note input[data-index="${index}"]`)?.parentElement;
    const itCell = container.querySelector(`.zigzag-cell--n-it-temporal input[data-index="${index}"]`)?.parentElement;

    if (nCell) nCell.remove();
    if (itCell) itCell.remove();

    // Re-index remaining cells
    reindexNItCells();

    // Update pairs
    updateNItPairsFromDOM();

    // Focus previous cell
    if (index > 0) {
      const prevNInput = container.querySelector(`.n-it-note-input[data-index="${index - 1}"]`);
      if (prevNInput) {
        prevNInput.focus();
        prevNInput.select();
      }
    }

    // Reapply pattern
    const row1 = container.querySelector('.zigzag-row--top');
    const row2 = container.querySelector('.zigzag-row--bottom');
    if (row1 && row2) {
      applyNItPattern(row1, row2);
    }
  }

  /**
   * Removes empty N-iT slots (cells with no note value)
   * Called when sequence is complete to clean up trailing empty cells
   */
  function removeEmptyNItSlots() {
    const row1 = container.querySelector('.zigzag-row--top');
    const row2 = container.querySelector('.zigzag-row--bottom');
    if (!row1 || !row2) return;

    const hideInitialPair = intervalModeOptions?.hideInitialPair || false;

    // Find empty N cells (no note value) and remove them with their iT
    // BUT: always keep at least one empty slot at the end for new input
    // AND: with hideInitialPair, never remove N[0]/iT[0] pair
    const nInputs = Array.from(container.querySelectorAll('.n-it-note-input'));
    const totalCells = nInputs.length;

    nInputs.forEach((nInput, arrayIndex) => {
      const idx = parseInt(nInput.dataset.index);
      const itInput = container.querySelector(`.n-it-temporal-input[data-index="${idx}"]`);

      // With hideInitialPair, NEVER remove the first pair (index 0)
      if (hideInitialPair && idx === 0) {
        return; // Skip, don't remove
      }

      // Always keep the last empty cell for new input
      if (arrayIndex === totalCells - 1 && !nInput.value.trim()) {
        return; // Skip, keep last empty for input
      }

      // Only remove if N is empty (no note entered)
      if (!nInput.value.trim()) {
        const nCell = nInput.closest('.zigzag-cell--n-it-note');
        const itCell = itInput?.closest('.zigzag-cell--n-it-temporal');

        if (nCell) nCell.remove();
        if (itCell) itCell.remove();
      }
    });

    // Re-index remaining cells
    reindexNItCells();

    // Reapply pattern
    applyNItPattern(row1, row2);
  }

  /**
   * Re-indexes all N-iT cells after deletion
   */
  function reindexNItCells() {
    const hideInitialPair = intervalModeOptions?.hideInitialPair || false;
    const nInputs = container.querySelectorAll('.n-it-note-input');
    const regInputs = container.querySelectorAll('.n-it-registry-input');
    const itInputs = container.querySelectorAll('.n-it-temporal-input');

    nInputs.forEach((input, idx) => {
      input.dataset.index = String(idx);
    });

    regInputs.forEach((input, idx) => {
      input.dataset.index = String(idx);
    });

    itInputs.forEach((input, idx) => {
      // With hideInitialPair: iT[0] corresponds to N[0], so indices match
      // Without hideInitialPair: iT starts at index 1 (N[0] has ghost, not iT)
      const itIndex = hideInitialPair ? idx : idx + 1;
      input.dataset.index = String(itIndex);
    });
  }

  /**
   * Updates pairs from DOM in N-iT mode (including registry)
   *
   * In N-iT zigzag layout:
   * - N[0] is the first note (starts at pulse 0)
   * - iT[1] is the duration of N[0] (how long N[0] plays)
   * - N[1] is the second note (starts at pulse = iT[1])
   * - iT[2] is the duration of N[1]
   * - etc.
   *
   * So for pair[i], temporalInterval comes from iT[i+1]
   */
  function updateNItPairsFromDOM() {
    const pairs = [];
    const nCells = container.querySelectorAll('.zigzag-cell--n-it-note');
    const hideInitialPair = intervalModeOptions?.hideInitialPair || false;
    let accumulatedPulse = 0;

    nCells.forEach((cell, index) => {
      const noteInput = cell.querySelector('.n-it-note-input');
      const regInput = cell.querySelector('.n-it-registry-input');

      // Check if this is a silence
      const isSilence = noteInput?.dataset.isSilence === 'true' ||
                        noteInput?.value.toLowerCase() === 's';

      const note = noteInput ? parseInt(noteInput.value) : NaN;
      const registry = regInput ? parseInt(regInput.value) : NaN;

      // Only add pair if note is valid OR it's a silence
      if (isNaN(note) && !isSilence) return;

      // Get temporalInterval from corresponding iT input
      // With hideInitialPair: iT[index] corresponds to N[index] (same index)
      // Without hideInitialPair: iT[index+1] corresponds to N[index] (first N has no iT)
      let temporalInterval = 1;
      const itIndex = hideInitialPair ? index : index + 1;
      const itInput = container.querySelector(`.n-it-temporal-input[data-index="${itIndex}"]`);
      const itVal = itInput ? parseInt(itInput.value) : NaN;
      if (!isNaN(itVal) && itVal > 0) {
        temporalInterval = itVal;
      }

      const pair = {
        note: isSilence ? null : note,
        registry: isNaN(registry) ? null : registry,
        pulse: accumulatedPulse,
        temporalInterval
      };

      // Mark silences with isRest flag
      if (isSilence) {
        pair.isRest = true;
      }

      pairs.push(pair);

      // Accumulate pulse for next note
      accumulatedPulse += temporalInterval;
    });

    currentPairs = pairs;
    onPairsChange(pairs);

    // Ensure empty slot exists
    ensureEmptyNItSlot();
  }

  /**
   * Renders the grid in NrX-iT mode (Note+Registry with Temporal Intervals)
   * Layout:
   * Row 1 (N): Label "N" | NrX₁ | NrX₂ | NrX₃ ...
   * Row 2 (iT): Label "iT" | (ghost) | iT₁ | (ghost) | iT₂ ...
   *
   * Each NrX cell contains two inputs: note (0-11) + 'r' + registry (3-5)
   * Navigation: note → registry → iT → note → registry → iT → ...
   */
  function renderNrxItMode(pairs = []) {
    currentPairs = [...pairs];

    // Clear container
    container.innerHTML = '';
    container.className = 'matrix-grid-editor matrix-grid-editor--nrx-it';

    // Default options
    const registryRange = nrxModeOptions?.registryRange || [3, 5];
    const maxTotalPulse = nrxModeOptions?.maxTotalPulse || pulseRange[1];

    // Create zigzag container (2 rows)
    const zigzagContainer = document.createElement('div');
    zigzagContainer.className = 'grid-zigzag-container grid-zigzag-container--nrx';

    // Row 1: N (with NrX cells)
    const row1 = document.createElement('div');
    row1.className = 'zigzag-row zigzag-row--top zigzag-row--nrx';

    // Row 2: iT (temporal intervals)
    const row2 = document.createElement('div');
    row2.className = 'zigzag-row zigzag-row--bottom zigzag-row--it';

    // Left labels
    const topLabel = document.createElement('div');
    topLabel.className = 'zigzag-left-label zigzag-left-label--top';
    topLabel.textContent = 'N';
    row1.appendChild(topLabel);

    const bottomLabel = document.createElement('div');
    bottomLabel.className = 'zigzag-left-label zigzag-left-label--bottom';
    bottomLabel.textContent = 'iT';
    row2.appendChild(bottomLabel);

    // Render existing pairs
    if (pairs.length === 0) {
      // Create first empty NrX cell
      const emptyNrxCell = createNrxCell(0, null, null);
      row1.appendChild(emptyNrxCell);

      // Ghost cell in iT row for zigzag alignment
      const ghost = createGhostCell();
      row2.appendChild(ghost);
    } else {
      // Render each pair as NrX cell + iT cell (except first pair has no iT)
      pairs.forEach((pair, index) => {
        const nrxCell = createNrxCell(index, pair.note, pair.registry);
        row1.appendChild(nrxCell);

        if (index === 0) {
          // First pair: ghost in iT row
          const ghost = createGhostCell();
          row2.appendChild(ghost);
        } else {
          // Subsequent pairs: iT cell
          const itCell = createNrxItCell(index, pair.temporalInterval || 1);
          row2.appendChild(itCell);
        }
      });

      // Add empty NrX cell for next entry if not at max
      const currentTotalPulse = calculateNrxTotalPulse();
      if (currentTotalPulse < maxTotalPulse) {
        const emptyNrxCell = createNrxCell(pairs.length, null, null);
        row1.appendChild(emptyNrxCell);

        const emptyItCell = createNrxItCell(pairs.length, null);
        row2.appendChild(emptyItCell);
      }
    }

    zigzagContainer.appendChild(row1);
    zigzagContainer.appendChild(row2);
    container.appendChild(zigzagContainer);

    // Focus first note input
    requestAnimationFrame(() => {
      const firstNoteInput = container.querySelector('.nrx-note-input');
      if (firstNoteInput) firstNoteInput.focus();
    });
  }

  /**
   * Creates an NrX cell (note + 'r' + registry)
   */
  function createNrxCell(index, note, registry) {
    const cell = document.createElement('div');
    cell.className = 'zigzag-cell zigzag-cell--nrx';
    cell.dataset.index = String(index);

    // Note input
    const noteInput = document.createElement('input');
    noteInput.className = 'zigzag-input nrx-note-input';
    noteInput.type = 'text';
    noteInput.value = note !== null ? String(note) : '';
    noteInput.maxLength = 2;
    noteInput.dataset.index = String(index);
    noteInput.dataset.type = 'nrx-note';
    noteInput.placeholder = 'N';
    noteInput.addEventListener('input', (e) => handleNrxInput(e, index, 'note'));
    noteInput.addEventListener('keydown', (e) => handleNrxKeyDown(e, index, 'note'));
    cell.appendChild(noteInput);

    // 'r' separator
    const separator = document.createElement('span');
    separator.className = 'nrx-separator';
    separator.textContent = 'r';
    cell.appendChild(separator);

    // Registry input
    const regInput = document.createElement('input');
    regInput.className = 'zigzag-input nrx-registry-input';
    regInput.type = 'text';
    regInput.value = registry !== null ? String(registry) : '';
    regInput.maxLength = 1;
    regInput.dataset.index = String(index);
    regInput.dataset.type = 'nrx-registry';
    regInput.placeholder = 'X';
    regInput.addEventListener('input', (e) => handleNrxInput(e, index, 'registry'));
    regInput.addEventListener('keydown', (e) => handleNrxKeyDown(e, index, 'registry'));
    cell.appendChild(regInput);

    return cell;
  }

  /**
   * Creates an iT cell for NrX-iT mode
   */
  function createNrxItCell(index, temporalInterval) {
    const cell = document.createElement('div');
    cell.className = 'zigzag-cell zigzag-cell--nrx-it';
    cell.dataset.index = String(index);

    const itInput = document.createElement('input');
    itInput.className = 'zigzag-input nrx-it-input';
    itInput.type = 'text';
    itInput.value = temporalInterval !== null ? String(temporalInterval) : '';
    itInput.maxLength = 2;
    itInput.dataset.index = String(index);
    itInput.dataset.type = 'nrx-it';
    itInput.placeholder = 'iT';
    itInput.addEventListener('input', (e) => handleNrxInput(e, index, 'it'));
    itInput.addEventListener('keydown', (e) => handleNrxKeyDown(e, index, 'it'));
    cell.appendChild(itInput);

    return cell;
  }

  /**
   * Handles input changes in NrX-iT mode
   */
  function handleNrxInput(event, index, type) {
    const input = event.target;
    const text = input.value.trim();

    // Clear invalid state
    input.classList.remove('invalid');

    // Validate based on type
    const registryRange = nrxModeOptions?.registryRange || [3, 5];

    if (type === 'note') {
      // Note must be 0-11
      if (text && !/^\d*$/.test(text)) {
        input.value = text.replace(/\D/g, '');
        return;
      }
      const noteVal = parseInt(text);
      if (text && !isNaN(noteVal) && (noteVal < 0 || noteVal > 11)) {
        showInputTooltip(input, 'Nota: 0-11');
        input.classList.add('invalid');
        input.value = ''; // Clear invalid value
        input.focus();    // Keep caret in same cell
        return;
      }

      // Validate note+registry combination if custom validator provided and registry is set
      if (text && !isNaN(noteVal) && nrxModeOptions?.validateNoteRegistry) {
        const regInput = input.parentElement.querySelector('.nrx-registry-input');
        const regVal = regInput ? parseInt(regInput.value) : NaN;
        if (!isNaN(regVal)) {
          const validation = nrxModeOptions.validateNoteRegistry(noteVal, regVal);
          if (!validation.valid) {
            showInputTooltip(input, validation.message || 'Combinación inválida');
            input.classList.add('invalid');
            input.value = ''; // Clear invalid note
            input.focus();
            return;
          }
        }
      }

      // Auto-jump to registry after valid note
      if (text.length >= 2 || (text.length === 1 && noteVal >= 2)) {
        clearTimeout(autoJumpTimer);
        autoJumpTimer = setTimeout(() => {
          const regInput = input.parentElement.querySelector('.nrx-registry-input');
          if (regInput) {
            regInput.focus();
            regInput.select();
          }
        }, AUTO_JUMP_DELAY);
      }
    } else if (type === 'registry') {
      // Registry must be within range
      if (text && !/^\d*$/.test(text)) {
        input.value = text.replace(/\D/g, '');
        return;
      }
      const regVal = parseInt(text);
      if (text && !isNaN(regVal) && (regVal < registryRange[0] || regVal > registryRange[1])) {
        showInputTooltip(input, `Registro: ${registryRange[0]}-${registryRange[1]}`);
        input.classList.add('invalid');
        input.value = ''; // Clear invalid value
        input.focus();    // Keep caret in same cell
        return;
      }

      // Validate note+registry combination if custom validator provided
      if (text && !isNaN(regVal) && nrxModeOptions?.validateNoteRegistry) {
        const noteInput = input.parentElement.querySelector('.nrx-note-input');
        const noteVal = noteInput ? parseInt(noteInput.value) : NaN;
        if (!isNaN(noteVal)) {
          const validation = nrxModeOptions.validateNoteRegistry(noteVal, regVal);
          if (!validation.valid) {
            showInputTooltip(input, validation.message || 'Combinación inválida');
            input.classList.add('invalid');
            input.value = ''; // Clear invalid registry
            input.focus();
            return;
          }
        }
      }

      // Auto-jump to iT after valid registry (if not first cell)
      if (text && index > 0) {
        clearTimeout(autoJumpTimer);
        autoJumpTimer = setTimeout(() => {
          const itInput = container.querySelector(`.nrx-it-input[data-index="${index}"]`);
          if (itInput) {
            itInput.focus();
            itInput.select();
          }
        }, AUTO_JUMP_DELAY);
      } else if (text && index === 0) {
        // First cell: jump to next NrX cell
        clearTimeout(autoJumpTimer);
        autoJumpTimer = setTimeout(() => {
          jumpToNextNrxCell(index);
        }, AUTO_JUMP_DELAY);
      }
    } else if (type === 'it') {
      // iT must be positive integer
      if (text && !/^\d*$/.test(text)) {
        input.value = text.replace(/\D/g, '');
        return;
      }
      const itVal = parseInt(text);
      const maxTotalPulse = nrxModeOptions?.maxTotalPulse || pulseRange[1];
      const currentTotal = calculateNrxTotalPulse();

      if (text && !isNaN(itVal) && itVal < 1) {
        showInputTooltip(input, 'iT debe ser ≥ 1');
        input.classList.add('invalid');
        input.value = ''; // Clear invalid value
        input.focus();    // Keep caret in same cell
        return;
      }
      if (text && !isNaN(itVal) && currentTotal > maxTotalPulse) {
        showInputTooltip(input, `iT máximo: ${maxTotalPulse - currentTotal + itVal}`);
        input.classList.add('invalid');
        input.value = ''; // Clear invalid value
        input.focus();    // Keep caret in same cell
        return;
      }
      // Auto-jump to next NrX after valid iT
      if (text) {
        clearTimeout(autoJumpTimer);
        autoJumpTimer = setTimeout(() => {
          jumpToNextNrxCell(index);
        }, AUTO_JUMP_DELAY);
      }
    }

    // Update pairs
    updateNrxPairsFromDOM();
  }

  /**
   * Handles keydown in NrX-iT mode
   */
  function handleNrxKeyDown(event, index, type) {
    const input = event.target;

    switch (event.key) {
      case 'Enter':
      case 'Tab':
        event.preventDefault();
        clearTimeout(autoJumpTimer);
        if (type === 'note') {
          // Jump to registry
          const regInput = input.parentElement.querySelector('.nrx-registry-input');
          if (regInput) {
            regInput.focus();
            regInput.select();
          }
        } else if (type === 'registry') {
          if (index === 0) {
            // First cell: jump to next NrX
            jumpToNextNrxCell(index);
          } else {
            // Jump to iT
            const itInput = container.querySelector(`.nrx-it-input[data-index="${index}"]`);
            if (itInput) {
              itInput.focus();
              itInput.select();
            }
          }
        } else if (type === 'it') {
          // Jump to next NrX
          jumpToNextNrxCell(index);
        }
        break;

      case 'ArrowRight':
        if (isAtEnd(input)) {
          event.preventDefault();
          if (type === 'note') {
            const regInput = input.parentElement.querySelector('.nrx-registry-input');
            if (regInput) regInput.focus();
          } else if (type === 'registry' && index > 0) {
            const itInput = container.querySelector(`.nrx-it-input[data-index="${index}"]`);
            if (itInput) itInput.focus();
          } else {
            jumpToNextNrxCell(index);
          }
        }
        break;

      case 'ArrowLeft':
        if (isAtStart(input)) {
          event.preventDefault();
          if (type === 'registry') {
            const noteInput = input.parentElement.querySelector('.nrx-note-input');
            if (noteInput) noteInput.focus();
          } else if (type === 'it') {
            const nrxCell = container.querySelector(`.zigzag-cell--nrx[data-index="${index}"]`);
            const regInput = nrxCell?.querySelector('.nrx-registry-input');
            if (regInput) regInput.focus();
          } else if (type === 'note' && index > 0) {
            // Jump to previous iT or previous registry
            const prevItInput = container.querySelector(`.nrx-it-input[data-index="${index - 1}"]`);
            if (prevItInput) {
              prevItInput.focus();
            } else {
              jumpToPrevNrxCell(index);
            }
          }
        }
        break;

      case 'Backspace':
        if (input.value === '' && index > 0) {
          event.preventDefault();
          // Delete current cell and jump back
          if (type === 'note') {
            removeNrxCellAt(index);
          } else if (type === 'registry') {
            const noteInput = input.parentElement.querySelector('.nrx-note-input');
            if (noteInput) {
              noteInput.focus();
              noteInput.select();
            }
          } else if (type === 'it') {
            const nrxCell = container.querySelector(`.zigzag-cell--nrx[data-index="${index}"]`);
            const regInput = nrxCell?.querySelector('.nrx-registry-input');
            if (regInput) {
              regInput.focus();
              regInput.select();
            }
          }
        }
        break;
    }
  }

  /**
   * Jumps to next NrX cell, creating if needed
   */
  function jumpToNextNrxCell(currentIndex) {
    const nextIndex = currentIndex + 1;
    let nextNrxCell = container.querySelector(`.zigzag-cell--nrx[data-index="${nextIndex}"]`);

    if (!nextNrxCell) {
      // Check if we can add more
      const maxTotalPulse = nrxModeOptions?.maxTotalPulse || pulseRange[1];
      const currentTotal = calculateNrxTotalPulse();
      if (currentTotal >= maxTotalPulse) return;

      // Create new NrX cell
      const row1 = container.querySelector('.zigzag-row--nrx');
      const row2 = container.querySelector('.zigzag-row--it');
      if (!row1 || !row2) return;

      nextNrxCell = createNrxCell(nextIndex, null, null);
      row1.appendChild(nextNrxCell);

      // Create corresponding iT cell
      const itCell = createNrxItCell(nextIndex, null);
      row2.appendChild(itCell);
    }

    const noteInput = nextNrxCell.querySelector('.nrx-note-input');
    if (noteInput) {
      requestAnimationFrame(() => {
        noteInput.focus();
        noteInput.select();
      });
    }
  }

  /**
   * Jumps to previous NrX cell
   */
  function jumpToPrevNrxCell(currentIndex) {
    if (currentIndex <= 0) return;

    const prevIndex = currentIndex - 1;
    const prevNrxCell = container.querySelector(`.zigzag-cell--nrx[data-index="${prevIndex}"]`);
    if (!prevNrxCell) return;

    const regInput = prevNrxCell.querySelector('.nrx-registry-input');
    if (regInput) {
      requestAnimationFrame(() => {
        regInput.focus();
        regInput.select();
      });
    }
  }

  /**
   * Removes NrX cell at index
   */
  function removeNrxCellAt(index) {
    const nrxCell = container.querySelector(`.zigzag-cell--nrx[data-index="${index}"]`);
    const itCell = container.querySelector(`.zigzag-cell--nrx-it[data-index="${index}"]`);

    if (nrxCell) nrxCell.remove();
    if (itCell) itCell.remove();

    // Re-index remaining cells
    reindexNrxCells();

    // Update pairs
    updateNrxPairsFromDOM();

    // Focus previous cell
    if (index > 0) {
      jumpToPrevNrxCell(index);
    }
  }

  /**
   * Re-indexes all NrX cells after deletion
   */
  function reindexNrxCells() {
    const nrxCells = container.querySelectorAll('.zigzag-cell--nrx');
    const itCells = container.querySelectorAll('.zigzag-cell--nrx-it');

    nrxCells.forEach((cell, index) => {
      cell.dataset.index = String(index);
      const noteInput = cell.querySelector('.nrx-note-input');
      const regInput = cell.querySelector('.nrx-registry-input');
      if (noteInput) noteInput.dataset.index = String(index);
      if (regInput) regInput.dataset.index = String(index);
    });

    itCells.forEach((cell, index) => {
      cell.dataset.index = String(index + 1); // iT starts at index 1
      const itInput = cell.querySelector('.nrx-it-input');
      if (itInput) itInput.dataset.index = String(index + 1);
    });
  }

  /**
   * Calculates total pulse from NrX-iT pairs
   */
  function calculateNrxTotalPulse() {
    let total = 0;
    const itInputs = container.querySelectorAll('.nrx-it-input');
    itInputs.forEach(input => {
      const val = parseInt(input.value);
      if (!isNaN(val)) total += val;
    });
    return total;
  }

  /**
   * Updates pairs from DOM in NrX-iT mode
   */
  function updateNrxPairsFromDOM() {
    const pairs = [];
    const nrxCells = container.querySelectorAll('.zigzag-cell--nrx');
    let accumulatedPulse = 0;

    nrxCells.forEach((cell, index) => {
      const noteInput = cell.querySelector('.nrx-note-input');
      const regInput = cell.querySelector('.nrx-registry-input');

      const note = noteInput ? parseInt(noteInput.value) : NaN;
      const registry = regInput ? parseInt(regInput.value) : NaN;

      if (isNaN(note) || isNaN(registry)) return;

      // Get temporalInterval from corresponding iT cell (index > 0)
      let temporalInterval = 1;
      if (index > 0) {
        const itInput = container.querySelector(`.nrx-it-input[data-index="${index}"]`);
        const itVal = itInput ? parseInt(itInput.value) : NaN;
        if (!isNaN(itVal)) {
          temporalInterval = itVal;
        }
      }

      pairs.push({
        note,
        registry,
        pulse: accumulatedPulse,
        temporalInterval
      });

      accumulatedPulse += temporalInterval;
    });

    currentPairs = pairs;
    onPairsChange(pairs);
  }

  // ========== DEGREE MODE ==========
  // Simple single-row editor for scale degrees (0-N) with optional +/- modifiers

  /**
   * Renders the grid in degree mode - single row of degree inputs
   * Format: 0, 1, 2+, 3-, s (silence)
   */
  function renderDegreeMode(pairs = []) {
    currentPairs = [...pairs];

    container.innerHTML = '';
    container.className = 'matrix-grid-editor matrix-grid-editor--degree';

    // Get options
    const totalPulses = degreeModeOptions?.totalPulses || 12;
    const getScaleLength = degreeModeOptions?.getScaleLength || (() => 7);

    // Apply scroll mode if enabled
    if (scrollEnabled) {
      container.classList.add('matrix-grid-editor--scrollable');
    }

    // Apply container size if provided
    if (containerSize) {
      if (containerSize.width) container.style.width = containerSize.width;
      if (containerSize.height) container.style.height = containerSize.height;
      if (containerSize.maxWidth) container.style.maxWidth = containerSize.maxWidth;
      if (containerSize.maxHeight) container.style.maxHeight = containerSize.maxHeight;
    }

    // Create main container with label and inputs
    const mainRow = document.createElement('div');
    mainRow.className = 'degree-main-row';

    // Label column
    const labelColumn = document.createElement('div');
    labelColumn.className = 'grid-label-column grid-label-column--degree';

    const degreeLabel = document.createElement('div');
    degreeLabel.className = 'grid-row-label grid-row-label--degree';
    degreeLabel.textContent = 'Nº';
    labelColumn.appendChild(degreeLabel);

    mainRow.appendChild(labelColumn);

    // Columns container
    const columnsContainer = document.createElement('div');
    columnsContainer.className = 'grid-columns-container degree-columns-container';

    if (scrollEnabled) {
      columnsContainer.classList.add('grid-columns-container--scrollable');
    }

    // Create a column for each pulse
    for (let pulse = 0; pulse < totalPulses; pulse++) {
      const column = createDegreeColumn(pulse, pairs, getScaleLength);
      columnsContainer.appendChild(column);
    }

    mainRow.appendChild(columnsContainer);
    container.appendChild(mainRow);

    // Focus first empty input
    requestAnimationFrame(() => {
      const firstEmptyInput = container.querySelector('.degree-input:not([data-filled="true"])');
      if (firstEmptyInput) {
        firstEmptyInput.focus();
      }
    });
  }

  /**
   * Creates a degree column for a single pulse
   */
  function createDegreeColumn(pulse, pairs, getScaleLength) {
    const column = document.createElement('div');
    column.className = 'degree-column';
    column.dataset.pulse = pulse;

    // Header with pulse number
    const header = document.createElement('div');
    header.className = 'degree-column-header';
    header.textContent = String(pulse);
    column.appendChild(header);

    // Find pair for this pulse
    const pair = pairs.find(p => p.pulse === pulse);

    // Degree input
    const input = document.createElement('input');
    input.className = 'degree-input';
    input.type = 'text';
    input.maxLength = 3;  // Allow "0r+" format
    input.dataset.pulse = pulse;

    if (pair) {
      if (pair.isRest) {
        input.value = 's';
        input.dataset.filled = 'true';
      } else if (pair.degree !== null && pair.degree !== undefined) {
        input.value = formatDegreeValue(pair.degree, pair.modifier);
        input.dataset.filled = 'true';
      }
    }

    input.addEventListener('input', (e) => handleDegreeInput(e, pulse, getScaleLength));
    input.addEventListener('keydown', (e) => handleDegreeKeyDown(e, pulse));
    input.addEventListener('focus', () => input.select());

    column.appendChild(input);

    return column;
  }

  /**
   * Formats degree value with optional modifier
   */
  function formatDegreeValue(degree, modifier) {
    if (degree === null || degree === undefined) return '';
    if (modifier === 'r+') return `${degree}r+`;
    if (modifier === '+') return `${degree}+`;
    if (modifier === '-') return `${degree}-`;
    return String(degree);
  }

  /**
   * Parses degree input value
   * Valid formats: 0-9, 0+, 0-, 0r+ (upper octave), s (silence)
   */
  function parseDegreeInput(value) {
    if (!value || value.trim() === '') return null;

    const trimmed = value.trim().toLowerCase();

    // Check for silence
    if (trimmed === 's') {
      return { isRest: true, degree: null, modifier: null };
    }

    // Check for upper octave format (e.g., "0r+")
    const matchUpperOctave = trimmed.match(/^(\d+)r\+$/);
    if (matchUpperOctave) {
      return {
        isRest: false,
        degree: parseInt(matchUpperOctave[1], 10),
        modifier: 'r+'
      };
    }

    // Check for degree with modifier (e.g., "2+", "3-")
    const matchWithMod = trimmed.match(/^(\d+)([+-])$/);
    if (matchWithMod) {
      return {
        isRest: false,
        degree: parseInt(matchWithMod[1], 10),
        modifier: matchWithMod[2]
      };
    }

    // Check for plain degree
    const matchPlain = trimmed.match(/^(\d+)$/);
    if (matchPlain) {
      return {
        isRest: false,
        degree: parseInt(matchPlain[1], 10),
        modifier: null
      };
    }

    return null;
  }

  /**
   * Handles input change for degree mode
   */
  function handleDegreeInput(event, pulse, getScaleLength) {
    const input = event.target;
    const value = input.value;

    // Clear auto-jump timer
    if (autoJumpTimer) {
      clearTimeout(autoJumpTimer);
      autoJumpTimer = null;
    }

    // Allow empty input
    if (!value || value.trim() === '') {
      // Remove pair for this pulse
      const newPairs = currentPairs.filter(p => p.pulse !== pulse);
      currentPairs = newPairs;
      input.dataset.filled = '';
      onPairsChange(newPairs);
      return;
    }

    const parsed = parseDegreeInput(value);

    if (parsed) {
      // Validate degree if not a rest
      const scaleLength = getScaleLength();
      if (!parsed.isRest && parsed.degree >= scaleLength) {
        // Invalid degree - reset input and show warning
        // Find previous value for this pulse
        const existingPair = currentPairs.find(p => p.pulse === pulse);
        if (existingPair && !existingPair.isRest) {
          // Restore previous valid value
          input.value = formatDegreeValue(existingPair.degree, existingPair.modifier);
        } else if (existingPair?.isRest) {
          input.value = 's';
        } else {
          // No previous value, clear it
          input.value = '';
          input.dataset.filled = '';
        }
        // Show tooltip with the invalid degree
        infoTooltip.show(input, `${parsed.degree} no es un grado de la escala (max: ${scaleLength - 1})`, 'warning');
        // Keep focus on this input
        input.focus();
        return;
      }

      // Update pairs
      const newPairs = currentPairs.filter(p => p.pulse !== pulse);
      newPairs.push({
        pulse,
        degree: parsed.degree,
        modifier: parsed.modifier,
        isRest: parsed.isRest
      });

      // Sort by pulse
      newPairs.sort((a, b) => a.pulse - b.pulse);

      currentPairs = newPairs;
      input.dataset.filled = 'true';
      onPairsChange(newPairs);

      // Auto-advance to next column after delay
      autoJumpTimer = setTimeout(() => {
        const nextInput = container.querySelector(`.degree-input[data-pulse="${pulse + 1}"]`);
        if (nextInput) {
          nextInput.focus();
          nextInput.select();
        }
      }, AUTO_JUMP_DELAY);
    }
  }

  /**
   * Handles keydown for degree mode navigation
   */
  function handleDegreeKeyDown(event, pulse) {
    const { key } = event;

    // Clear auto-jump timer on any key
    if (autoJumpTimer) {
      clearTimeout(autoJumpTimer);
      autoJumpTimer = null;
    }

    // Arrow navigation
    if (key === 'ArrowRight' || key === 'Tab') {
      event.preventDefault();
      const nextInput = container.querySelector(`.degree-input[data-pulse="${pulse + 1}"]`);
      if (nextInput) {
        nextInput.focus();
        nextInput.select();
      }
    } else if (key === 'ArrowLeft') {
      event.preventDefault();
      const prevInput = container.querySelector(`.degree-input[data-pulse="${pulse - 1}"]`);
      if (prevInput) {
        prevInput.focus();
        prevInput.select();
      }
    } else if (key === 'Enter') {
      event.preventDefault();
      const nextInput = container.querySelector(`.degree-input[data-pulse="${pulse + 1}"]`);
      if (nextInput) {
        nextInput.focus();
        nextInput.select();
      }
    } else if (key === 'Backspace' && event.target.value === '') {
      // Navigate to previous on empty backspace
      event.preventDefault();
      const prevInput = container.querySelector(`.degree-input[data-pulse="${pulse - 1}"]`);
      if (prevInput) {
        prevInput.focus();
        prevInput.select();
      }
    }
  }

  /**
   * Formats interval value (no + sign for positive, just number)
   */
  function formatIntervalValue(value) {
    return String(value);
  }

  /**
   * Creates a ghost cell for zigzag pattern
   */
  function createGhostCell() {
    const ghost = document.createElement('div');
    ghost.className = 'zigzag-cell zigzag-cell--ghost';
    return ghost;
  }

  /**
   * Creates an empty iS input cell
   */
  function createEmptyISCell(index) {
    const isCell = document.createElement('div');
    isCell.className = 'zigzag-cell zigzag-cell--is zigzag-cell--empty';

    if (showIntervalLabels) {
      const isLabel = document.createElement('div');
      isLabel.className = 'zigzag-label';
      isLabel.textContent = `iS${index}`;
      isCell.appendChild(isLabel);
    }

    const isInput = document.createElement('input');
    isInput.className = 'zigzag-input interval-input zigzag-input--is';
    isInput.type = 'text';
    isInput.value = '';
    isInput.maxLength = 3;
    isInput.dataset.index = String(index);
    isInput.dataset.type = 'is';
    isInput.addEventListener('input', (e) => handleIntervalInputChange(e, index, 'is'));
    isInput.addEventListener('keydown', (e) => handleIntervalKeyDown(e, index, 'is'));
    isCell.appendChild(isInput);

    return isCell;
  }

  /**
   * Creates an empty iT input cell
   */
  function createEmptyITCell(index) {
    const itCell = document.createElement('div');
    itCell.className = 'zigzag-cell zigzag-cell--it zigzag-cell--empty';

    if (showIntervalLabels) {
      const itLabel = document.createElement('div');
      itLabel.className = 'zigzag-label';
      itLabel.textContent = `iT${index}`;
      itCell.appendChild(itLabel);
    }

    const itInput = document.createElement('input');
    itInput.className = 'zigzag-input interval-input zigzag-input--it';
    itInput.type = 'text';
    itInput.value = '';
    itInput.maxLength = 1;
    itInput.dataset.index = String(index);
    itInput.dataset.type = 'it';
    itInput.addEventListener('input', (e) => handleIntervalInputChange(e, index, 'it'));
    itInput.addEventListener('keydown', (e) => handleIntervalKeyDown(e, index, 'it'));
    itCell.appendChild(itInput);

    return itCell;
  }

  /**
   * Applies zigzag pattern to iS row (row 1)
   * Pattern: [cabezal] [N oculto] [iS₁ editable] [ghost] [iS₂ editable] [ghost] ...
   * - N cell (index 0) is hidden
   * - Pattern: editable → ghost → editable → ghost ...
   * NOTE: Only applies ghosts to existing cells, does NOT create new cells
   */
  function applyISPattern(row) {
    // Remove existing ghosts
    Array.from(row.querySelectorAll('.zigzag-cell--ghost')).forEach(el => el.remove());

    // Hide N cell (first note cell, not the left label)
    const nCell = row.querySelector('.zigzag-cell--n');
    if (nCell) {
      nCell.classList.add('zigzag-cell--hidden');
    }

    // Add ghost after each existing iS cell
    const existingISCells = Array.from(row.querySelectorAll('.zigzag-cell--is'));
    existingISCells.forEach(cell => {
      const ghost = createGhostCell();
      cell.after(ghost);
    });
  }

  /**
   * Applies zigzag pattern to iT row (row 2)
   * Pattern: [cabezal] [P oculto] [ghost] [iT₁ editable] [ghost] [iT₂ editable] ...
   * - P cell (index 0) is hidden
   * - Pattern: ghost → editable → ghost → editable ...
   * NOTE: Only applies ghosts to existing cells, does NOT create new cells
   */
  function applyITPattern(row) {
    // Remove existing ghosts
    Array.from(row.querySelectorAll('.zigzag-cell--ghost')).forEach(el => el.remove());

    // Hide P cell (first pulse cell, not the left label)
    const pCell = row.querySelector('.zigzag-cell--p');
    if (pCell) {
      pCell.classList.add('zigzag-cell--hidden');
    }

    // Add ghost before each existing iT cell
    const existingITCells = Array.from(row.querySelectorAll('.zigzag-cell--it'));
    existingITCells.forEach(cell => {
      const ghost = createGhostCell();
      cell.before(ghost);
    });
  }

  /**
   * Shows a temporary tooltip on an input element
   * Uses the shared infoTooltip for consistent styling with N/P validation
   */
  function showInputTooltip(input, message) {
    infoTooltip.show(message, input);
  }

  /**
   * Calculates the current note/pulse at a given interval index
   */
  function getCurrentPositionAtIndex(targetIndex) {
    const nInput = container.querySelector('.zigzag-input[data-index="0"][data-type="note"]');
    const pInput = container.querySelector('.zigzag-input[data-index="0"][data-type="pulse"]');

    let currentNote = nInput ? parseInt(nInput.value) : 0;
    let currentPulse = pInput ? parseInt(pInput.value) : 0;

    if (isNaN(currentNote)) currentNote = 0;
    if (isNaN(currentPulse)) currentPulse = 0;

    for (let i = 1; i < targetIndex; i++) {
      const isInput = container.querySelector(`.zigzag-input[data-index="${i}"][data-type="is"]`);
      const itInput = container.querySelector(`.zigzag-input[data-index="${i}"][data-type="it"]`);

      const isVal = isInput ? parseInt(isInput.value) : 0;
      const itVal = itInput ? parseInt(itInput.value) : 0;

      if (!isNaN(isVal)) currentNote += isVal;
      if (!isNaN(itVal)) currentPulse += itVal;
    }

    return { currentNote, currentPulse };
  }

  /**
   * Handles interval mode input changes
   */
  function handleIntervalInputChange(event, index, type) {
    const input = event.target;
    const text = input.value.trim();

    // Clear invalid state when user starts typing
    if (input.classList.contains('invalid')) {
      input.classList.remove('invalid');
    }

    // For intervals, allow + or - sign
    if (type === 'is' && text) {
      // Allow +/- followed by digits
      if (!/^[+-]?\d*$/.test(text)) {
        input.value = text.replace(/[^+-\d]/g, '');
        return;
      }
    } else if (text) {
      // For note, pulse, and temporal intervals: only digits
      if (!/^\d*$/.test(text)) {
        input.value = text.replace(/\D/g, '');
        return;
      }
    }

    // Validate ranges based on type
    if (text && index > 0) {
      const value = parseInt(text);
      if (!isNaN(value)) {
        const { currentNote, currentPulse } = getCurrentPositionAtIndex(index);

        if (type === 'is') {
          // iS: Check resulting note is within noteRange
          const resultNote = currentNote + value;
          const minIS = noteRange[0] - currentNote;
          const maxIS = noteRange[1] - currentNote;

          if (resultNote < noteRange[0] || resultNote > noteRange[1]) {
            showInputTooltip(input, `iS debe estar entre ${minIS >= 0 ? '+' : ''}${minIS} y +${maxIS}`);
            // Clear invalid value and cancel any pending auto-jump
            input.value = '';
            if (autoJumpTimer) {
              clearTimeout(autoJumpTimer);
              autoJumpTimer = null;
            }
            return;
          }
        } else if (type === 'it') {
          // iT: Must be positive, check resulting pulse is within pulseRange
          if (value <= 0) {
            showInputTooltip(input, 'iT debe ser positivo (≥1)');
            input.value = '';
            if (autoJumpTimer) {
              clearTimeout(autoJumpTimer);
              autoJumpTimer = null;
            }
            return;
          }

          const resultPulse = currentPulse + value;
          // In interval mode, use maxTotalPulse if provided, otherwise use pulseRange[1]
          const maxPulse = (mode === 'interval' && intervalModeOptions?.maxTotalPulse !== undefined)
            ? intervalModeOptions.maxTotalPulse
            : pulseRange[1];
          const maxIT = maxPulse - currentPulse;

          if (resultPulse > maxPulse) {
            showInputTooltip(input, `iT máximo: ${maxIT}`);
            input.value = '';
            if (autoJumpTimer) {
              clearTimeout(autoJumpTimer);
              autoJumpTimer = null;
            }
            return;
          }

          // Check if we've reached the maximum pulse - end editing mode
          if (resultPulse === maxPulse) {
            // Update pairs first
            updatePairsFromIntervals();
            // Remove any empty slots that were created
            removeEmptyIntervalSlots();
            // Blur to end editing
            input.blur();
            showInputTooltip(input, 'Sucesión completa');
            return;
          }
        }
      }
    }

    // Auto-jump timer for zigzag navigation
    if (autoJumpTimer) {
      clearTimeout(autoJumpTimer);
    }

    // Skip auto-jump if user just typed +/- in iS field (waiting for number)
    const isSignOnly = type === 'is' && /^[+-]$/.test(text);

    if (event.inputType === 'insertText' && !isSignOnly) {
      autoJumpTimer = setTimeout(() => {
        jumpToNextInZigzag(input);
        autoJumpTimer = null;
      }, AUTO_JUMP_DELAY);
    }

    // Update pairs from intervals
    updatePairsFromIntervals();
  }

  /**
   * Handles interval mode keyboard navigation
   */
  function handleIntervalKeyDown(event, index, type) {
    // Allow 's' or 'S' for silence in iS field (if allowSilence is enabled)
    const allowSilence = intervalModeOptions?.allowSilence && type === 'is';
    const allowed = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab', 'Enter', '+', '-'];
    if (allowSilence) {
      allowed.push('s', 'S');
    }

    if (!/^[0-9]$/.test(event.key) && !allowed.includes(event.key)) {
      event.preventDefault();
      return;
    }

    // Handle 's' for silence
    if ((event.key === 's' || event.key === 'S') && type === 'is' && allowSilence) {
      event.preventDefault();
      event.target.value = 's';
      event.target.dataset.isSilence = 'true';
      // Trigger input change to update pairs
      updatePairsFromIntervals();
      // Jump to next field
      setTimeout(() => jumpToNextInZigzag(event.target), 50);
      return;
    }

    switch (event.key) {
      case 'Enter':
        event.preventDefault();
        jumpToNextInZigzag(event.target);
        break;

      case 'ArrowDown':
        event.preventDefault();
        // From row 1 to row 2
        if (type === 'note' || type === 'is') {
          const currentIndex = parseInt(event.target.dataset.index);
          const targetType = type === 'note' ? 'pulse' : 'it';
          const targetInput = container.querySelector(
            `.zigzag-input[data-index="${currentIndex}"][data-type="${targetType}"]`
          );
          if (targetInput) {
            targetInput.focus();
            targetInput.select();
          }
        }
        break;

      case 'ArrowUp':
        event.preventDefault();
        // From row 2 to row 1
        if (type === 'pulse' || type === 'it') {
          const currentIndex = parseInt(event.target.dataset.index);
          const targetType = type === 'pulse' ? 'note' : 'is';
          const targetInput = container.querySelector(
            `.zigzag-input[data-index="${currentIndex}"][data-type="${targetType}"]`
          );
          if (targetInput) {
            targetInput.focus();
            targetInput.select();
          }
        }
        break;

      case 'ArrowLeft':
        event.preventDefault();
        navigateZigzagBackward(event.target);
        break;

      case 'ArrowRight':
        event.preventDefault();
        navigateZigzagForward(event.target);
        break;
    }
  }

  /**
   * Jump to next cell in zigzag pattern
   */
  function jumpToNextInZigzag(currentInput) {
    const type = currentInput.dataset.type;
    const index = parseInt(currentInput.dataset.index);

    // Zigzag pattern: N → P ↓ → iS₁ ↗ → iT₁ ↘ → iS₂ ↗ → iT₂ ...
    let nextInput = null;

    if (type === 'note') {
      // N → P (down)
      nextInput = container.querySelector('.zigzag-input[data-index="0"][data-type="pulse"]');
    } else if (type === 'pulse') {
      // P → iS₁ (diagonal up-right)
      nextInput = container.querySelector('.zigzag-input[data-index="1"][data-type="is"]');
    } else if (type === 'is') {
      // iS → iT (down)
      nextInput = container.querySelector(`.zigzag-input[data-index="${index}"][data-type="it"]`);
    } else if (type === 'it') {
      // iT → iS_next (diagonal up-right)
      const nextIndex = index + 1;
      nextInput = container.querySelector(`.zigzag-input[data-index="${nextIndex}"][data-type="is"]`);
    }

    if (nextInput) {
      nextInput.focus();
      nextInput.select();
    }
  }

  /**
   * Navigate backward in zigzag pattern
   */
  function navigateZigzagBackward(currentInput) {
    const type = currentInput.dataset.type;
    const index = parseInt(currentInput.dataset.index);

    let prevInput = null;

    if (type === 'pulse' && index === 0) {
      // P → N
      prevInput = container.querySelector('.zigzag-input[data-index="0"][data-type="note"]');
    } else if (type === 'is' && index === 1) {
      // iS₁ → P
      prevInput = container.querySelector('.zigzag-input[data-index="0"][data-type="pulse"]');
    } else if (type === 'it') {
      // iT → iS (same index)
      prevInput = container.querySelector(`.zigzag-input[data-index="${index}"][data-type="is"]`);
    } else if (type === 'is' && index > 1) {
      // iS → iT_prev
      const prevIndex = index - 1;
      prevInput = container.querySelector(`.zigzag-input[data-index="${prevIndex}"][data-type="it"]`);
    }

    if (prevInput) {
      prevInput.focus();
      prevInput.select();
    }
  }

  /**
   * Navigate forward in zigzag pattern
   */
  function navigateZigzagForward(currentInput) {
    jumpToNextInZigzag(currentInput);
  }

  /**
   * Update pairs from interval inputs
   */
  function updatePairsFromIntervals() {
    let firstNote, firstPulse;

    // When hideInitialPair is enabled, use basePair from options instead of reading inputs
    if (intervalModeOptions?.hideInitialPair) {
      const basePair = intervalModeOptions.basePair || { note: 0, pulse: 0 };
      firstNote = basePair.note ?? 0;
      firstPulse = basePair.pulse ?? 0;
    } else {
      // Read from inputs
      const nInput = container.querySelector('.zigzag-input[data-index="0"][data-type="note"]');
      const pInput = container.querySelector('.zigzag-input[data-index="0"][data-type="pulse"]');
      firstNote = nInput ? parseInt(nInput.value) : null;
      firstPulse = pInput ? parseInt(pInput.value) : null;

      if (firstNote === null || firstPulse === null || isNaN(firstNote) || isNaN(firstPulse)) {
        currentPairs = [];
        onPairsChange(currentPairs);
        return;
      }
    }

    // Start with first pair (base pair)
    const pairs = [{ note: firstNote, pulse: firstPulse }];
    let currentNote = firstNote;
    let currentPulse = firstPulse;

    // Collect all interval inputs
    let index = 1;
    while (true) {
      const isInput = container.querySelector(`.zigzag-input[data-index="${index}"][data-type="is"]`);
      const itInput = container.querySelector(`.zigzag-input[data-index="${index}"][data-type="it"]`);

      if (!isInput || !itInput) break;

      const isValue = isInput.value.trim();
      const itValue = itInput.value.trim();

      // Skip if iS is empty
      if (!isValue) {
        index++;
        continue;
      }

      // Check if this is a silence (iS = 's')
      const isSilence = isValue.toLowerCase() === 's';

      // If iT is empty but iS is valid, use iT=1 as preview
      const isPreview = !itValue;
      const temporalInterval = isPreview ? 1 : parseInt(itValue);
      // iT must be positive (≥1) - negative or zero would cause invalid pairs
      if (isNaN(temporalInterval) || temporalInterval <= 0) break;

      // NEW SEMANTIC: pulse = START position (not END)
      // Capture the START pulse BEFORE advancing for the NEXT note
      const notePulse = currentPulse;
      currentPulse += temporalInterval;

      // In interval mode, use maxTotalPulse if provided
      // Validate against the END position (currentPulse after advancing)
      const maxPulse = (mode === 'interval' && intervalModeOptions?.maxTotalPulse !== undefined)
        ? intervalModeOptions.maxTotalPulse
        : pulseRange[1];
      if (currentPulse < pulseRange[0] || currentPulse > maxPulse) {
        // Calculate maximum valid iT from current position
        const maxIT = maxPulse - notePulse;
        showInputTooltip(itInput, `iT máximo: ${maxIT}`);
        itInput.classList.add('invalid');
        itInput.value = ''; // Clear invalid value
        itInput.focus();    // Keep caret in same cell
        break;
      }

      if (isSilence) {
        // Silence: keep the same note but mark as rest
        // Use notePulse (START position) for the pair
        pairs.push({ note: currentNote, pulse: notePulse, isRest: true, temporalInterval });
      } else {
        const soundInterval = parseInt(isValue);
        if (isNaN(soundInterval)) break;

        const newNote = currentNote + soundInterval;

        // Validate note range - if invalid, show warning and break
        if (newNote < noteRange[0] || newNote > noteRange[1]) {
          // Calculate valid range for this iS
          const minIS = noteRange[0] - currentNote;
          const maxIS = noteRange[1] - currentNote;
          const message = `El nuevo iS debe estar entre ${minIS >= 0 ? '+' : ''}${minIS} y +${maxIS}`;

          // Show tooltip on the invalid input
          showInputTooltip(isInput, message);

          // Mark input as invalid (add CSS class for visual feedback)
          isInput.classList.add('invalid');
          isInput.value = ''; // Clear invalid value
          isInput.focus();    // Keep caret in same cell

          // Break parsing (preserve subsequent data per previous fix)
          break;
        }

        currentNote = newNote;

        // Use notePulse (START position) for the pair
        pairs.push({ note: currentNote, pulse: notePulse, temporalInterval });
      }
      index++;
    }

    // If hideInitialPair is enabled, exclude the base pair from output
    // The base pair (N₀, P₀) is only used as reference for interval calculations
    if (intervalModeOptions?.hideInitialPair && pairs.length > 1) {
      currentPairs = pairs.slice(1);
    } else {
      currentPairs = pairs;
    }

    onPairsChange(currentPairs);

    // Always keep one empty interval slot available (up to maxPairs)
    ensureEmptyIntervalSlot();
  }

  /**
   * Calculates the total accumulated pulse from all filled intervals
   */
  function getTotalAccumulatedPulse() {
    const pInput = container.querySelector('.zigzag-input[data-index="0"][data-type="pulse"]');
    let totalPulse = pInput ? parseInt(pInput.value) || 0 : 0;

    let index = 1;
    while (true) {
      const itInput = container.querySelector(`.zigzag-input[data-index="${index}"][data-type="it"]`);
      if (!itInput) break;
      const itValue = parseInt(itInput.value);
      if (isNaN(itValue)) break;
      totalPulse += itValue;
      index++;
    }
    return totalPulse;
  }

  /**
   * Ensures there's always one empty interval slot available for adding new pairs.
   * Creates the slot with proper zigzag pattern (iS + ghost in row1, ghost + iT in row2).
   * Does NOT create new slots if maxTotalPulse has been reached.
   */
  function ensureEmptyIntervalSlot() {
    if (mode !== 'interval' || !showZigzag) return;

    // Check if we've reached max pulse - no more slots needed
    const maxPulse = intervalModeOptions?.maxTotalPulse ?? pulseRange[1];
    const currentTotalPulse = getTotalAccumulatedPulse();
    if (currentTotalPulse >= maxPulse) return;

    // Check if there's an empty iS-iT pair (both must be empty for the same index)
    const isInputs = Array.from(container.querySelectorAll('.zigzag-input[data-type="is"]'));

    // Find if any pair has BOTH iS and iT empty
    const hasEmptyPair = isInputs.some(isInput => {
      const idx = isInput.dataset.index;
      const itInput = container.querySelector(`.zigzag-input[data-type="it"][data-index="${idx}"]`);
      return !isInput.value.trim() && itInput && !itInput.value.trim();
    });

    if (hasEmptyPair) return;

    // When hideInitialPair is enabled, intervals ARE the pairs (base is implicit)
    // So maxIntervalSlots = maxPairs (not maxPairs - 1)
    const maxIntervalSlots = intervalModeOptions?.hideInitialPair ? maxPairs : maxPairs - 1;
    const currentMaxIndex = isInputs.reduce((max, input) => {
      const idx = parseInt(input.dataset.index || '0', 10);
      return isNaN(idx) ? max : Math.max(max, idx);
    }, 0);

    if (currentMaxIndex >= maxIntervalSlots) return;

    const newIndex = currentMaxIndex + 1;
    const row1 = container.querySelector('.zigzag-row--top');
    const row2 = container.querySelector('.zigzag-row--bottom');
    if (!row1 || !row2) return;

    // Row 1: iS cell + ghost (pattern: editable → ghost)
    const isCell = createEmptyISCell(newIndex);
    row1.appendChild(isCell);
    row1.appendChild(createGhostCell());

    // Row 2: ghost + iT cell (pattern: ghost → editable)
    row2.appendChild(createGhostCell());
    const itCell = createEmptyITCell(newIndex);
    row2.appendChild(itCell);
  }

  /**
   * Removes empty interval slots (iS-iT pairs where both are empty).
   * Also removes their associated ghost cells to maintain zigzag pattern.
   */
  function removeEmptyIntervalSlots() {
    if (mode !== 'interval' || !showZigzag) return;

    const row1 = container.querySelector('.zigzag-row--top');
    const row2 = container.querySelector('.zigzag-row--bottom');
    if (!row1 || !row2) return;

    // Find empty iS cells and remove them along with their ghost
    const isInputs = Array.from(container.querySelectorAll('.zigzag-input[data-type="is"]'));
    isInputs.forEach(isInput => {
      const idx = isInput.dataset.index;
      const itInput = container.querySelector(`.zigzag-input[data-type="it"][data-index="${idx}"]`);

      // Only remove if BOTH iS and iT are empty
      if (!isInput.value.trim() && itInput && !itInput.value.trim()) {
        const isCell = isInput.closest('.zigzag-cell');
        const itCell = itInput.closest('.zigzag-cell');

        if (isCell) {
          // Remove ghost after iS cell
          const nextSibling = isCell.nextElementSibling;
          if (nextSibling?.classList.contains('zigzag-cell--ghost')) {
            nextSibling.remove();
          }
          isCell.remove();
        }

        if (itCell) {
          // Remove ghost before iT cell
          const prevSibling = itCell.previousElementSibling;
          if (prevSibling?.classList.contains('zigzag-cell--ghost')) {
            prevSibling.remove();
          }
          itCell.remove();
        }
      }
    });
  }

  /**
   * Creates a pulse column with dynamic note rows
   * @param {number|null} pulse - Pulse value (null for empty initial column)
   * @param {Array} notes - Array of note values at this pulse
   * @returns {HTMLElement} - Column element
   */
  function createPulseColumn(pulse, notes) {
    const column = document.createElement('div');
    column.className = 'pulse-column';
    column.dataset.pulse = pulse !== null ? pulse : '';

    // Notes area (container for all note inputs)
    const notesArea = document.createElement('div');
    notesArea.className = 'column-notes-area';

    // Note rows
    if (notes.length > 0) {
      notes.forEach((note, index) => {
        const row = createNoteRow(pulse, note, index);
        notesArea.appendChild(row);
      });
      // Empty row (for adding more notes to this pulse)
      // Only create if polyphony is enabled
      if (getPolyphonyEnabled()) {
        const emptyRow = createNoteRow(pulse, null, notes.length);
        notesArea.appendChild(emptyRow);
      }
    } else {
      // First empty row (always needed for initial input)
      const emptyRow = createNoteRow(pulse, null, 0);
      notesArea.appendChild(emptyRow);
    }

    column.appendChild(notesArea);

    // Pulse area (container for pulse input)
    const pulseArea = document.createElement('div');
    pulseArea.className = 'column-pulse-area';

    // Pulse input (editable, empty by default)
    const pulseInput = document.createElement('input');
    pulseInput.className = 'pulse-input';
    pulseInput.type = 'text';
    pulseInput.value = pulse !== null ? String(pulse) : '';
    pulseInput.dataset.pulse = pulse !== null ? pulse : '';
    pulseInput.maxLength = 1;
    pulseInput.placeholder = '';
    pulseInput.addEventListener('input', (e) => handlePulseInputChange(e, pulse));
    pulseInput.addEventListener('keydown', (e) => handleKeyDown(e, pulseInput, 'P', pulse));

    pulseArea.appendChild(pulseInput);
    column.appendChild(pulseArea);

    return column;
  }

  /**
   * Creates a note row
   * @param {number|null} pulse - Pulse value (null for empty column)
   * @param {number|null} note - Note value (null for empty)
   * @param {number} voiceIndex - Voice index (0 = first note, 1 = second, etc.)
   * @returns {HTMLElement} - Input element (no wrapper row)
   */
  function createNoteRow(pulse, note, voiceIndex) {
    const input = document.createElement('input');
    input.className = 'note-input';
    input.type = 'text';
    input.value = note !== null ? String(note) : '';
    input.dataset.pulse = pulse !== null ? pulse : '';
    input.dataset.voice = voiceIndex;
    input.maxLength = 2; // Allow two digits
    input.placeholder = '';

    input.addEventListener('input', (e) => handleNoteInputChange(e, pulse, voiceIndex));
    input.addEventListener('keydown', (e) => handleKeyDown(e, input, 'N', pulse, voiceIndex));
    input.addEventListener('blur', () => updatePairsFromDOM());

    return input;
  }


  /**
   * Handles note input change
   */
  function handleNoteInputChange(event, pulse, voiceIndex) {
    const input = event.target;
    const text = input.value.trim();

    // Validate: only digits
    if (text && !/^\d+$/.test(text)) {
      input.value = text.replace(/\D/g, '');
      return;
    }

    // Validate range and show tooltip for out-of-range values
    if (text) {
      const value = parseInt(text, 10);
      if (!isNaN(value) && (value < noteRange[0] || value > noteRange[1])) {
        infoTooltip.show(`El Número ${value} es demasiado grande. Escoge 0-${noteRange[1]}`, input);
        input.value = ''; // Clear invalid input
        input.focus();    // Keep focus
        return;
      }
    }

    // Auto-jump with delay (allows typing two digits)
    if (autoJumpTimer) {
      clearTimeout(autoJumpTimer);
    }

    if (event.inputType === 'insertText' && /^[0-9]$/.test(event.data)) {
      autoJumpTimer = setTimeout(() => {
        const value = parseInt(input.value, 10);
        if (!isNaN(value) && value >= noteRange[0] && value <= noteRange[1]) {
          // Valid note: jump to next empty cell in column
          // Only jump to next note if polyphony enabled
          if (getPolyphonyEnabled()) {
            jumpToNextEmptyCellInColumn(input);
          } else {
            // Monophonic: jump to pulse input directly
            const column = input.closest('.pulse-column');
            const pulseInput = column?.querySelector('.pulse-input');
            if (pulseInput) {
              pulseInput.focus();
              pulseInput.select();
            }
          }
        }
        autoJumpTimer = null;
      }, AUTO_JUMP_DELAY);
    }

    // Trigger update
    updatePairsFromDOM();
  }

  /**
   * Handles pulse input change
   */
  function handlePulseInputChange(event, oldPulse) {
    const input = event.target;
    const text = input.value.trim();

    // Validate: only digits
    if (text && !/^\d+$/.test(text)) {
      input.value = text.replace(/\D/g, '');
      return;
    }

    const newPulse = text ? parseInt(text, 10) : null;

    // Validate range FIRST (before duplicate check)
    if (newPulse !== null && !isNaN(newPulse)) {
      if (newPulse < pulseRange[0] || newPulse > pulseRange[1]) {
        infoTooltip.show(`El Pulso ${newPulse} es mayor que la Longitud. Escoge otro Pulso`, input);
        input.value = ''; // Clear invalid input
        input.focus();    // Keep focus
        return;
      }
    }

    // Check for duplicate pulse (merge into existing column)
    if (newPulse !== null && !isNaN(newPulse) && newPulse >= pulseRange[0] && newPulse <= pulseRange[1]) {
      const currentColumn = input.closest('.pulse-column');
      const existingColumn = findColumnByPulse(newPulse, currentColumn);

      if (existingColumn && existingColumn !== currentColumn) {
        // Duplicate pulse found! Show warning and prevent creation
        infoTooltip.show(`El Pulso ${newPulse} ya existe`, input);
        // Merge notes into existing column
        mergeColumnsAndJumpToNext(currentColumn, existingColumn);
        return; // Skip normal update and auto-jump
      }

      // Auto-close if P=7 (last pulse)
      if (newPulse === 7) {
        input.blur(); // Finalize pulse input
        updatePairsFromDOM(); // Trigger immediate update
        return; // Skip auto-jump for P=7
      }
    }

    // Auto-jump with delay (only if no duplicate)
    if (autoJumpTimer) {
      clearTimeout(autoJumpTimer);
    }

    if (event.inputType === 'insertText' && /^[0-9]$/.test(event.data)) {
      autoJumpTimer = setTimeout(() => {
        const value = parseInt(input.value, 10);
        if (!isNaN(value) && value >= pulseRange[0] && value <= pulseRange[1]) {
          // Valid pulse: jump to next column's first empty note
          jumpToNextColumnFirstEmpty(input);
        }
        autoJumpTimer = null;
      }, AUTO_JUMP_DELAY);
    }

    // Trigger update
    updatePairsFromDOM();
  }

  /**
   * Handles keydown events
   */
  function handleKeyDown(event, input, type, pulse, voiceIndex = 0) {
    const allowed = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Tab', 'Enter'];
    if (!/^[0-9]$/.test(event.key) && !allowed.includes(event.key)) {
      event.preventDefault();
      return;
    }

    switch (event.key) {
      case 'Enter':
        event.preventDefault();
        // Finalize input: blur to remove caret and trigger sanitization
        input.blur();
        // Sanitization happens automatically via blur → updatePairsFromDOM()
        break;

      case 'ArrowUp':
        event.preventDefault();
        if (type === 'N') {
          // Move to previous note input in same column
          const prevInput = input.previousElementSibling;
          if (prevInput && prevInput.classList.contains('note-input')) {
            prevInput.focus();
            prevInput.select();
          }
        } else if (type === 'P') {
          // Move to last note in same column
          const column = input.closest('.pulse-column');
          const noteInputs = column?.querySelectorAll('.note-input');
          if (noteInputs && noteInputs.length > 0) {
            const lastInput = noteInputs[noteInputs.length - 1];
            lastInput.focus();
            lastInput.select();
          }
        }
        break;

      case 'ArrowDown':
        event.preventDefault();
        if (type === 'N') {
          // Move to next note input in same column OR pulse if last
          const nextInput = input.nextElementSibling;
          if (nextInput && nextInput.classList.contains('note-input')) {
            // If polyphony disabled and next input is empty, skip to pulse
            if (!getPolyphonyEnabled() && !nextInput.value.trim()) {
              const column = input.closest('.pulse-column');
              const pulseInput = column?.querySelector('.pulse-input');
              if (pulseInput) {
                pulseInput.focus();
                pulseInput.select();
              }
            } else {
              nextInput.focus();
              nextInput.select();
            }
          } else {
            // No next note input: jump to pulse (skip labels)
            const column = input.closest('.pulse-column');
            const pulseInput = column?.querySelector('.pulse-input');
            if (pulseInput) {
              pulseInput.focus();
              pulseInput.select();
            }
          }
        } else if (type === 'P') {
          // Move to first note in same column
          const column = input.closest('.pulse-column');
          const firstInput = column?.querySelector('.note-input');
          if (firstInput) {
            firstInput.focus();
            firstInput.select();
          }
        }
        break;

      case 'ArrowRight':
        event.preventDefault();
        if (isAtEnd(input)) {
          jumpToNextColumn(input);
        }
        break;

      case 'ArrowLeft':
        event.preventDefault();
        if (isAtStart(input)) {
          jumpToPrevColumn(input);
        }
        break;

      case 'Tab':
        event.preventDefault();
        if (event.shiftKey) {
          jumpToPrevColumn(input);
        } else {
          jumpToNextColumn(input);
        }
        break;
    }
  }

  /**
   * Finds a column by pulse value (excluding the current column)
   * @param {number} pulse - Pulse value to search for
   * @param {HTMLElement} currentColumn - Column to exclude from search
   * @returns {HTMLElement|null} - Found column or null
   */
  function findColumnByPulse(pulse, currentColumn) {
    const columnsContainer = container.querySelector('.grid-columns-container');
    if (!columnsContainer) return null;

    const columns = columnsContainer.querySelectorAll('.pulse-column');
    for (const column of columns) {
      if (column === currentColumn) continue;

      const pulseInput = column.querySelector('.pulse-input');
      if (pulseInput && parseInt(pulseInput.value, 10) === pulse) {
        return column;
      }
    }
    return null;
  }

  /**
   * Merges notes from current column into existing column, then jumps to next
   * @param {HTMLElement} currentColumn - Column with duplicate pulse
   * @param {HTMLElement} existingColumn - Target column with same pulse
   */
  function mergeColumnsAndJumpToNext(currentColumn, existingColumn) {
    // Extract all note values from current column (excluding empty ones)
    const currentNoteInputs = currentColumn.querySelectorAll('.note-input');
    const notesToMove = [];
    currentNoteInputs.forEach(input => {
      const value = input.value.trim();
      if (value && !isNaN(parseInt(value, 10))) {
        notesToMove.push(parseInt(value, 10));
      }
    });

    // Filter to only first note if polyphony is disabled
    if (!getPolyphonyEnabled() && notesToMove.length > 1) {
      notesToMove.length = 1; // Keep only N1
    }

    // If polyphony is disabled, don't merge anything - just clear P and keep focus
    if (!getPolyphonyEnabled()) {
      const currentPulseInput = currentColumn.querySelector('.pulse-input');
      if (currentPulseInput) {
        requestAnimationFrame(() => {
          currentPulseInput.value = ''; // Clear the duplicate pulse value
          currentPulseInput.focus();
          currentPulseInput.select();
        });
      }
      return;
    }

    // POLYPHONY MODE: Proceed with merge

    // If no valid notes to move, just jump to existing column (don't create new)
    if (notesToMove.length === 0) {
      // Jump to first note input in existing column
      const firstInput = existingColumn.querySelector('.note-input');
      if (firstInput) {
        requestAnimationFrame(() => {
          firstInput.focus();
          firstInput.select();
        });
      }
      return;
    }

    // Get existing pulse value from target column
    const existingPulseInput = existingColumn.querySelector('.pulse-input');
    const existingPulse = existingPulseInput ? parseInt(existingPulseInput.value, 10) : null;

    // Update pairs by merging notes
    const updatedPairs = [];

    // First, collect all pairs from DOM EXCEPT from current column
    const allColumns = container.querySelectorAll('.pulse-column');
    allColumns.forEach(column => {
      if (column === currentColumn) return; // Skip current column

      const pulseInput = column.querySelector('.pulse-input');
      const pulse = pulseInput ? parseInt(pulseInput.value, 10) : null;

      if (pulse === null || isNaN(pulse)) return;

      const noteInputs = column.querySelectorAll('.note-input');
      noteInputs.forEach(input => {
        const note = parseInt(input.value, 10);
        if (!isNaN(note)) {
          updatedPairs.push({ note, pulse });
        }
      });
    });

    // Add the moved notes to the existing pulse
    if (existingPulse !== null) {
      notesToMove.forEach(note => {
        updatedPairs.push({ note, pulse: existingPulse });
      });
    }

    // Re-render with updated pairs
    render(updatedPairs);

    // Notify change
    if (onPairsChange) {
      onPairsChange(updatedPairs);
    }

    // Jump to next column after the merged one
    requestAnimationFrame(() => {
      const columnsContainer = container.querySelector('.grid-columns-container');
      const columns = columnsContainer.querySelectorAll('.pulse-column');

      // Find the column that now has the merged pulse
      let mergedColumn = null;
      for (const column of columns) {
        const pulseInput = column.querySelector('.pulse-input');
        if (pulseInput && parseInt(pulseInput.value, 10) === existingPulse) {
          mergedColumn = column;
          break;
        }
      }

      // Jump to next column after the merged one
      if (mergedColumn) {
        const nextColumn = mergedColumn.nextElementSibling;
        if (nextColumn && nextColumn.classList.contains('pulse-column')) {
          const firstInput = nextColumn.querySelector('.note-input');
          if (firstInput) {
            firstInput.focus();
            firstInput.select();
          }
        } else {
          // Create new empty column
          if (columns.length < maxPairs) {
            const newColumn = createPulseColumn(null, []);
            columnsContainer.appendChild(newColumn);

            const firstInput = newColumn.querySelector('.note-input');
            if (firstInput) {
              firstInput.focus();
            }
          }
        }
      }
    });
  }

  /**
   * Jumps to next empty cell in same column (N1 → N2 → ... → P)
   */
  function jumpToNextEmptyCellInColumn(input) {
    const column = input.closest('.pulse-column');
    if (!column) return;

    // Find next empty note input in same column
    let nextSibling = input.nextElementSibling;
    while (nextSibling) {
      if (nextSibling.classList && nextSibling.classList.contains('note-input')) {
        if (!nextSibling.value.trim()) {
          // Found empty note input
          requestAnimationFrame(() => {
            nextSibling.focus();
            nextSibling.select();
          });
          return;
        }
      }
      nextSibling = nextSibling.nextElementSibling;
    }

    // No empty note inputs: jump to pulse input
    const pulseInput = column.querySelector('.pulse-input');
    if (pulseInput) {
      requestAnimationFrame(() => {
        pulseInput.focus();
        pulseInput.select();
      });
    }
  }

  /**
   * Jumps to first empty cell in next column (creates if doesn't exist)
   */
  function jumpToNextColumnFirstEmpty(input) {
    const currentColumn = input.closest('.pulse-column');
    const columnsContainer = container.querySelector('.grid-columns-container');
    if (!columnsContainer) return;

    const nextColumn = currentColumn?.nextElementSibling;

    if (nextColumn && nextColumn.classList.contains('pulse-column')) {
      // Next column exists: find first empty note input
      const noteInputs = nextColumn.querySelectorAll('.note-input');
      for (const noteInput of noteInputs) {
        if (!noteInput.value.trim()) {
          requestAnimationFrame(() => {
            noteInput.focus();
            noteInput.select();
          });
          return;
        }
      }
      // All filled: focus first anyway
      if (noteInputs.length > 0) {
        requestAnimationFrame(() => {
          noteInputs[0].focus();
          noteInputs[0].select();
        });
      }
    } else {
      // No next column: create new empty column
      const columns = columnsContainer.querySelectorAll('.pulse-column');
      if (columns.length < maxPairs) {
        const newColumn = createPulseColumn(null, []); // pulse = null (empty)
        columnsContainer.appendChild(newColumn);

        // Focus first input in new column
        const firstInput = newColumn.querySelector('.note-input');
        if (firstInput) {
          requestAnimationFrame(() => {
            firstInput.focus();
          });
        }
      }
    }
  }

  /**
   * Jumps to next column
   */
  function jumpToNextColumn(input) {
    const currentColumn = input.closest('.pulse-column');
    const columnsContainer = container.querySelector('.grid-columns-container');
    if (!columnsContainer) return;

    const nextColumn = currentColumn?.nextElementSibling;

    if (nextColumn && nextColumn.classList.contains('pulse-column')) {
      const firstInput = nextColumn.querySelector('.note-input');
      if (firstInput) {
        requestAnimationFrame(() => {
          firstInput.focus();
          firstInput.select();
        });
      }
    } else {
      // No next column: create if possible
      const columns = columnsContainer.querySelectorAll('.pulse-column');
      if (columns.length < maxPairs) {
        const newColumn = createPulseColumn(null, []);
        columnsContainer.appendChild(newColumn);

        const firstInput = newColumn.querySelector('.note-input');
        if (firstInput) {
          requestAnimationFrame(() => {
            firstInput.focus();
          });
        }
      }
    }
  }

  /**
   * Jumps to previous column
   */
  function jumpToPrevColumn(input) {
    const currentColumn = input.closest('.pulse-column');
    const prevColumn = currentColumn?.previousElementSibling;

    if (prevColumn && prevColumn.classList.contains('pulse-column')) {
      const firstInput = prevColumn.querySelector('.note-input');
      if (firstInput) {
        requestAnimationFrame(() => {
          firstInput.focus();
          firstInput.select();
        });
      }
    }
  }

  /**
   * Adds a new empty column
   */
  function addNewColumn() {
    const columns = container.querySelectorAll('.pulse-column');
    const nextPulse = columns.length; // Use column count as next pulse

    if (nextPulse >= maxPairs) {
      console.warn('Max pairs reached');
      return;
    }

    // Create new column
    const column = createPulseColumn(nextPulse, []);

    // Insert before "add" button
    const addBtn = container.querySelector('.add-column-btn');
    if (addBtn) {
      container.insertBefore(column, addBtn);
    } else {
      container.appendChild(column);
    }

    // Focus first input
    const firstInput = column.querySelector('.note-input');
    if (firstInput) {
      requestAnimationFrame(() => {
        firstInput.focus();
      });
    }
  }

  /**
   * Checks if visual reorganization is needed (column order changed)
   */
  function checkIfReorganizationNeeded(newPairs) {
    // Get current visual pulse order from DOM
    const columns = container.querySelectorAll('.pulse-column');
    const visualPulses = [];
    columns.forEach(column => {
      const pulseInput = column.querySelector('.pulse-input');
      const pulse = pulseInput ? parseInt(pulseInput.value, 10) : parseInt(column.dataset.pulse, 10);
      if (!isNaN(pulse)) {
        visualPulses.push(pulse);
      }
    });

    // Get sorted pulse order from newPairs
    const sortedPulses = [...new Set(newPairs.map(p => p.pulse))].sort((a, b) => a - b);

    // Compare arrays
    if (visualPulses.length !== sortedPulses.length) return true;
    for (let i = 0; i < visualPulses.length; i++) {
      if (visualPulses[i] !== sortedPulses[i]) return true;
    }
    return false;
  }

  /**
   * Updates pairs from DOM state
   */
  function updatePairsFromDOM() {
    const newPairs = [];

    const columns = container.querySelectorAll('.pulse-column');
    let hasEmptyNote = false;

    columns.forEach(column => {
      const pulseInput = column.querySelector('.pulse-input');
      const pulseText = pulseInput?.value.trim();
      const pulse = pulseText ? parseInt(pulseText, 10) : parseInt(column.dataset.pulse, 10);

      if (isNaN(pulse) || pulse < pulseRange[0] || pulse > pulseRange[1]) {
        return; // Invalid pulse, skip
      }

      const noteInputs = column.querySelectorAll('.note-input');
      let hasAtLeastOneNote = false;

      noteInputs.forEach(input => {
        const noteText = input.value.trim();
        if (noteText) {
          const note = parseInt(noteText, 10);
          if (!isNaN(note) && note >= noteRange[0] && note <= noteRange[1]) {
            newPairs.push({ note, pulse });
            hasAtLeastOneNote = true;
          }
        }
      });

      // If no notes but valid pulse exists, add dummy pair to preserve column
      if (!hasAtLeastOneNote && !isNaN(pulse)) {
        hasEmptyNote = true;
        // Add pair with note: null to preserve the pulse column
        newPairs.push({ note: null, pulse });
      }
    });

    // Detect if sorting is needed (new pulse < last pulse)
    const visualPulses = Array.from(columns).map(col => {
      const input = col.querySelector('.pulse-input');
      return input ? parseInt(input.value, 10) : NaN;
    }).filter(p => !isNaN(p));

    let needsSortWarning = false;
    if (visualPulses.length > 1) {
      for (let i = 1; i < visualPulses.length; i++) {
        if (visualPulses[i] < visualPulses[i - 1]) {
          needsSortWarning = true;
          break;
        }
      }
    }

    // Sort by pulse, then by note
    newPairs.sort((a, b) => {
      if (a.pulse !== b.pulse) return a.pulse - b.pulse;
      return a.note - b.note;
    });

    currentPairs = newPairs;

    // Check if pairs need visual reorganization (pulse order changed)
    const needsReorganization = checkIfReorganizationNeeded(newPairs);
    if (needsReorganization) {
      // Show "Ordenando Pulsos" warning if auto-sorting is triggered
      if (needsSortWarning) {
        const sortTooltip = createInfoTooltip({
          className: 'fraction-info-bubble auto-tip-below',
          autoRemoveDelay: 1500
        });
        sortTooltip.show('Ordenando Pulsos', container);
      }
      // Re-render grid with sorted pairs to reorganize columns visually
      render(newPairs);
    }

    onPairsChange(newPairs);
  }

  /**
   * Checks if caret is at end of input
   */
  function isAtEnd(input) {
    return input.selectionStart >= input.value.length;
  }

  /**
   * Checks if caret is at start of input
   */
  function isAtStart(input) {
    return input.selectionStart === 0;
  }

  /**
   * Gets current pairs
   */
  function getPairs() {
    return [...currentPairs];
  }

  /**
   * Sets pairs programmatically
   */
  function setPairs(pairs) {
    render(pairs);
  }

  /**
   * Clears all cells
   */
  function clear() {
    currentPairs = [];
    render([]);
  }

  /**
   * Highlights cells (for playback)
   */
  function highlightCell(row, col) {
    // Find column with matching pulse
    const column = container.querySelector(`.pulse-column[data-pulse="${col}"]`);
    if (column) {
      column.classList.add('highlighted');
    }
  }

  /**
   * Clears all highlights
   */
  function clearHighlights() {
    container.querySelectorAll('.pulse-column.highlighted').forEach(col => {
      col.classList.remove('highlighted');
    });
  }

  /**
   * Focus the first N cell (note input) in the grid editor
   * Works for n-it, nrx-it, and interval modes
   */
  function focusFirstNCell() {
    // Try n-it mode first (n-it-note-input class)
    let firstNInput = container.querySelector('.n-it-note-input');

    // Try nrx-it mode (note input in NrX cell)
    if (!firstNInput) {
      firstNInput = container.querySelector('.nrx-note-input');
    }

    // Try interval mode (note input at index 0)
    if (!firstNInput) {
      firstNInput = container.querySelector('.zigzag-input[data-index="0"][data-type="note"]');
    }

    // Try generic zigzag N input
    if (!firstNInput) {
      firstNInput = container.querySelector('.zigzag-input[data-type="n"]');
    }

    if (firstNInput) {
      firstNInput.focus();
      firstNInput.select();
    }
  }

  // Initial render
  if (container) {
    render();
  }

  return {
    render,
    getPairs,
    setPairs,
    clear,
    highlightCell,
    clearHighlights,
    removeEmptyIntervalSlots,
    focusFirstNCell
  };
}
