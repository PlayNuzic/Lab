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
    mode = 'standard',  // 'standard' | 'interval' | 'nrx-it'
    showZigzag = false,
    showIntervalLabels = true,
    leftZigzagLabels = null,
    autoJumpDelayMs = 300,  // Custom auto-jump delay (ms)
    intervalModeOptions = null,  // Options for interval mode (basePair, maxTotalPulse, etc.)
    nrxModeOptions = null  // Options for nrx-it mode (registryRange, etc.)
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

    if (mode === 'nrx-it') {
      renderNrxItMode(pairs);
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
        return;
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
        return;
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
        return;
      }
      if (text && !isNaN(itVal) && currentTotal > maxTotalPulse) {
        showInputTooltip(input, `iT máximo: ${maxTotalPulse - currentTotal + itVal}`);
        input.classList.add('invalid');
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

  /**
   * Formats interval value with sign
   */
  function formatIntervalValue(value) {
    if (value > 0) return `+${value}`;
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
    removeEmptyIntervalSlots
  };
}
