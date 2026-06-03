// App12: Plano-Sucesión - 2D Step Sequencer with dual N+P sequences
// Uses matrix-seq module for coordinated note/pulse selection
// Uses musical-grid module for 2D grid visualization

import { createMusicalGrid } from '../../libs/musical-grid/index.js';
import { createGridEditor } from '../../libs/matrix-seq/index.js';
import { initMixerMenu } from '../../libs/app-common/mixer-menu.js';
import { initRandomMenu } from '../../libs/random/menu.js';
import { initP1ToggleUI } from '../../libs/shared-ui/sound-dropdown.js';
import { initAudioToggles } from '../../libs/app-common/audio-toggles.js';
import { getMixer, subscribeMixer } from '../../libs/sound/index.js';
import { registerFactoryReset, createPreferenceStorage } from '../../libs/app-common/preferences.js';
import { createMatrixHighlightController } from '../../libs/app-common/matrix-highlight-controller.js';
import { clearElement } from '../../libs/app-common/dom-utils.js';
import { createMelodicAudioInitializer, setupAudioDefaults, CHANNEL_TIERS, createMixerPersistence } from '../../libs/app-common/audio-init.js';
import { setupPianoPreload, isPianoLoaded } from '../../libs/sound/piano.js';
import { createBpmController } from '../../libs/app-common/bpm-controller.js';
import { initIdleCaretFlash } from '../../libs/app-common/idle-caret-flash.js';

// ========== CONFIGURATION ==========
const TOTAL_PULSES = 9;   // Horizontal: 0-8
const TOTAL_NOTES = 12;   // Vertical: 0-11 (MIDI 60-71)
const TOTAL_SPACES = 8;   // Spaces between pulses: 0-7
const DEFAULT_BPM = 90;
const MIN_BPM = 50;
const MAX_BPM = 150;

// ========== STATE ==========
let audio = null;
let musicalGrid = null;
let gridEditor = null; // Nuzic N-P editor (replaces matrix-seq grid-editor)
let bpmController = null;
let currentBPM = DEFAULT_BPM;
let isPlaying = false;
let polyphonyEnabled = false; // Default: polyphony DISABLED (monophonic mode)

// Elements
let playBtn = null;
let resetBtn = null;
let randomBtn = null;
// ========== STORAGE HELPERS ==========
// Use shared preference storage module
const preferenceStorage = createPreferenceStorage('app12');

// ========== AUDIO INITIALIZATION ==========
// Use standardized melodic audio initializer (ensures Tone.js loads before AudioContext)
const _initAudio = createMelodicAudioInitializer({
  defaultInstrument: 'piano',
  getPreferences: () => preferenceStorage.load() || {}
});

async function initAudio() {
  if (!audio) {
    audio = await _initAudio();

    // Configuració canònica d'àudio (FX, canals); valors a CANONICAL_FX
    if (audio) {
      setupAudioDefaults(audio, { channels: CHANNEL_TIERS.MELODIC_FULL });
    }

    // Sync P1 toggle state with audio engine (P1 defaults to enabled in audio,
    // but user may have saved it as disabled - sync from localStorage)
    const p1Stored = localStorage.getItem('app12:p1Toggle');
    if (audio && p1Stored === 'false' && typeof audio.setStartEnabled === 'function') {
      audio.setStartEnabled(false);
    }
  }
  return audio;
}

// ========== VISUAL FEEDBACK ==========
// Using shared matrix highlight controller module

let highlightController = null;

// ========== PLAYBACK ==========

async function handlePlay() {
  if (isPlaying) {
    // Immediate stop via audio engine
    stopPlayback();
    return;
  }

  // Show loading indicator if piano not yet loaded
  const playIcon = playBtn?.querySelector('.icon-play');
  const stopIcon = playBtn?.querySelector('.icon-stop');
  let wasLoading = false;

  if (!isPianoLoaded() && playBtn) {
    wasLoading = true;
    playBtn.disabled = true;
    if (playIcon) playIcon.style.opacity = '0.5';
  }

  // Ensure audio is initialized
  await initAudio();

  // Restore button state after loading
  if (wasLoading && playBtn) {
    playBtn.disabled = false;
    if (playIcon) playIcon.style.opacity = '1';
  }

  if (!window.Tone) {
    console.error('Tone.js not available');
    return;
  }

  const allPairs = gridEditor.getPairs();

  // Group pairs by pulse for polyphonic playback (skip rests)
  const pulseGroups = {};
  allPairs.forEach(pair => {
    if (pair.isRest || pair.note === null) return;
    if (!pulseGroups[pair.pulse]) {
      pulseGroups[pair.pulse] = [];
    }
    pulseGroups[pair.pulse].push(60 + pair.note);
  });

  isPlaying = true;

  // Disable random button during playback
  if (randomBtn) randomBtn.disabled = true;

  // Switch to stop icon (playIcon and stopIcon already declared above)
  if (playIcon && stopIcon) {
    playIcon.style.display = 'none';
    stopIcon.style.display = 'block';
  }

  const intervalSec = (60 / currentBPM);
  const totalPulseSounds = TOTAL_SPACES; // 8 pulse sounds (spaces 0-7)

  // Register note provider before play (declarative scheduling)
  audio.registerNoteProvider('melody', (step) => {
    const notes = pulseGroups[step];
    if (!notes || notes.length === 0) return null;
    const duration = intervalSec * 0.9;
    return notes.map(midi => ({ midi, duration, velocity: 0.8 }));
  });

  // Start TimelineAudio transport-based playback
  audio.play(
    totalPulseSounds,
    intervalSec,
    new Set(), // No accent sounds (pulse plays automatically on all beats)
    false, // No loop initially
    (step) => {
      // onPulse callback: visual feedback only

      // Playhead vertical line sobre la cel·la actual.
      musicalGrid?.updatePlayhead?.(step);

      // 1) Visual feedback for pulse column
      highlightController?.highlightPulse(step);

      // 2) Visual feedback for playing cells
      const notes = pulseGroups[step];
      if (notes && notes.length > 0) {
        const duration = intervalSec * 0.9;

        notes.forEach(midi => {
          const noteIndex = midi - 60;
          const cell = musicalGrid.getCellElement(noteIndex, step);
          if (cell) {
            cell.classList.add('playing');
            setTimeout(() => cell.classList.remove('playing'), duration * 1000);
          }
        });
      }

      // 2b) Il·luminem les cel·les de l'EDITOR (valor N i P) del pols actual.
      document.querySelectorAll('.editor-cell.playing').forEach(c => c.classList.remove('playing'));
      document.querySelectorAll(`.editor-cell[data-pulse="${step}"]`).forEach(c => {
        c.classList.add('playing');
        setTimeout(() => c.classList.remove('playing'), intervalSec * 0.9 * 1000);
      });

      // 3) Pulse sound plays AUTOMATICALLY via TimelineAudio
      //    (controlled by pulseToggleBtn + mixer 'pulse' channel)
    },
    () => {
      // onComplete: delay stop to show last pulse highlight
      const lastNoteDelay = intervalSec * 0.9 * 1000;
      setTimeout(() => stopPlayback(), lastNoteDelay);
    }
  );
}

function stopPlayback() {
  isPlaying = false;

  // Re-enable random button after playback
  if (randomBtn) randomBtn.disabled = false;

  // Stop audio
  audio?.stop();

  // Clear highlights
  highlightController?.clearHighlights();

  // Amaga el playhead vertical.
  musicalGrid?.hidePlayhead?.();

  // Clear any active playing animations
  document.querySelectorAll('.musical-cell.playing').forEach(cell => {
    cell.classList.remove('playing');
  });

  // Clear highlights de les cel·les de l'editor.
  document.querySelectorAll('.editor-cell.playing').forEach(cell => {
    cell.classList.remove('playing');
  });

  // Switch back to play icon
  const playIcon = playBtn?.querySelector('.icon-play');
  const stopIcon = playBtn?.querySelector('.icon-stop');
  if (playIcon && stopIcon) {
    playIcon.style.display = 'block';
    stopIcon.style.display = 'none';
  }
}

// ========== RESET ==========

function handleReset() {
  // Clear selections
  gridEditor?.clear();
  musicalGrid?.clear();

  // Clear interval paths
  if (musicalGrid?.clearIntervalPaths) {
    musicalGrid.clearIntervalPaths();
  }

  // Stop playback if playing
  if (isPlaying) {
    stopPlayback();
  }

  console.log('Reset to default state');
}

// ========== RANDOM GENERATION ==========

function handleRandom() {
  // Prevent random during playback
  if (isPlaying) return;

  // Get parameters from random menu
  const randPMax = parseInt(document.getElementById('randPMax')?.value || 7, 10);
  const randNMax = parseInt(document.getElementById('randNMax')?.value || 11, 10);

  // Calculate min/max pairs (similar to App11's MIN_NOTES/MAX_NOTES)
  const MIN_PAIRS = Math.max(1, Math.floor(randPMax * 0.5)); // At least 50% of max
  const MAX_PAIRS = randPMax;

  // Generate random number of pairs (MIN_PAIRS to MAX_PAIRS)
  const numPairs = Math.floor(Math.random() * (MAX_PAIRS - MIN_PAIRS + 1)) + MIN_PAIRS;

  // Create array of all available pulses (0 to TOTAL_SPACES-1 = 0 to 7)
  const allPulses = Array.from({length: TOTAL_SPACES}, (_, i) => i);

  // Shuffle pulses using Fisher-Yates algorithm (more reliable than sort)
  for (let i = allPulses.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allPulses[i], allPulses[j]] = [allPulses[j], allPulses[i]];
  }

  // Select first numPairs pulses from shuffled array
  const selectedPulses = allPulses.slice(0, numPairs).sort((a, b) => a - b);

  // Generate pairs with random notes (no silences in nuzic editor)
  const pairs = selectedPulses.map(pulse => {
    return { note: Math.floor(Math.random() * (randNMax + 1)), pulse };
  });

  // Set pairs
  gridEditor?.setPairs(pairs);

  // Update visual grid
  syncGridFromPairs(pairs);

  console.log('Random generation:', { bpm: currentBPM, pairs, numPairs, selectedPulses });

  // Auto-play after randomizing (consistent across apps 9+).
  if (!isPlaying) handlePlay();
}

// ========== SYNCHRONIZATION ==========

function syncGridFromPairs(pairs) {
  if (!musicalGrid) return;

  // PERFORMANCE: Incremental update instead of full redraw
  // Track which cells should be active (skip rests)
  const activeCells = new Set(pairs.filter(p => !p.isRest && p.note !== null).map(p => `${p.note}-${p.pulse}`));

  // Clear only cells that are no longer active
  document.querySelectorAll('.musical-cell.active, .musical-cell.rest').forEach(cell => {
    const note = parseInt(cell.dataset.note);
    const pulse = parseInt(cell.dataset.pulse);
    const key = `${note}-${pulse}`;

    if (!activeCells.has(key)) {
      cell.classList.remove('active');
      const label = cell.querySelector('.cell-label');
      if (label) {
        label.remove();
      }
    }
    cell.classList.remove('rest');
  });

  // Clear interval paths before updating
  if (musicalGrid.clearIntervalPaths) {
    musicalGrid.clearIntervalPaths();
  }

  // Filter out null notes and rests for active cell rendering
  const validPairs = pairs.filter(p => !p.isRest && p.note !== null);

  // Calculate labels - always in N-P coordinate mode
  const labelsMap = new Map(); // Map: "note-pulse" -> label text
  validPairs.forEach(({ note, pulse }) => {
    labelsMap.set(`${note}-${pulse}`, `( ${note} , ${pulse} )`);
  });

  // Activate cells and apply labels (only update if changed)
  validPairs.forEach(({ note, pulse }) => {
    const cell = musicalGrid.getCellElement(note, pulse);
    if (cell) {
      cell.classList.add('active');

      // PERFORMANCE: Only update label if text changed
      const expectedText = labelsMap.get(`${note}-${pulse}`) || `( ${note} , ${pulse} )`;
      let label = cell.querySelector('.cell-label');

      if (!label) {
        label = document.createElement('span');
        label.className = 'cell-label';
        label.textContent = expectedText;
        cell.appendChild(label);
      } else if (label.textContent !== expectedText) {
        label.textContent = expectedText;
      }
    }
  });

  // Highlight interval paths (if enabled)
  if (musicalGrid.highlightIntervalPath) {
    // Pass polyphonic flag to enable voice separation
    musicalGrid.highlightIntervalPath(validPairs, polyphonyEnabled);
  }
}

// ========== NUZIC N-P EDITOR ==========

let currentPairs = []; // Array of { note: 0-11, pulse: 0-7 }

function createNuzicEditor(timelineWrapper) {
  const BLOCK = 35;
  const editorEl = document.createElement('div');
  editorEl.className = 'np-editor';

  // N row (notes - pink)
  const nBar = document.createElement('div');
  nBar.className = 'editor-bar editor-bar--n';
  const nLabel = document.createElement('div');
  nLabel.className = 'editor-label editor-label--n';
  nLabel.textContent = 'N';
  nBar.appendChild(nLabel);
  const nCells = document.createElement('div');
  nCells.className = 'editor-cells';
  const nEndMarker = document.createElement('div');
  nEndMarker.className = 'editor-end-marker';
  nCells.appendChild(nEndMarker);
  nBar.appendChild(nCells);

  // P row (pulses - cream)
  const pBar = document.createElement('div');
  pBar.className = 'editor-bar editor-bar--p';
  const pLabel = document.createElement('div');
  pLabel.className = 'editor-label editor-label--p';
  pLabel.textContent = 'P';
  pBar.appendChild(pLabel);
  const pCells = document.createElement('div');
  pCells.className = 'editor-cells';
  const pEndMarker = document.createElement('div');
  pEndMarker.className = 'editor-end-marker';
  pCells.appendChild(pEndMarker);
  pBar.appendChild(pCells);

  editorEl.appendChild(nBar);
  editorEl.appendChild(pBar);

  // Insert into .grid-container (grid-row: 3, aligned with matrix)
  const gridContainer = timelineWrapper.closest('.grid-container');
  if (gridContainer) {
    gridContainer.appendChild(editorEl);
  } else {
    timelineWrapper.insertAdjacentElement('afterend', editorEl);
  }

  function renderEditor() {
    // Clear existing cells
    nCells.querySelectorAll('.editor-cell').forEach(c => c.remove());
    pCells.querySelectorAll('.editor-cell').forEach(c => c.remove());

    // Build cells for each entered pair: [editable value][color separator]
    // Les cel·les de valor són EDITABLES amb validació + navegació de tecles
    // (arrows / Tab / Enter), reordenament per puls en editar P, etc.
    for (let i = 0; i < currentPairs.length; i++) {
      const pair = currentPairs[i];

      // N: editable value + pink separator
      const nVal = createValueCell('n', pair, i);
      nCells.insertBefore(nVal, nEndMarker);
      const nSep = createCell('n', true);
      nCells.insertBefore(nSep, nEndMarker);

      // P: editable value + cream separator
      const pVal = createValueCell('p', pair, i);
      pCells.insertBefore(pVal, pEndMarker);
      const pSep = createCell('p', true);
      pCells.insertBefore(pSep, pEndMarker);
    }

    // If not full: white input + color separator
    if (currentPairs.length < TOTAL_SPACES) {
      // N: white input + pink
      const nInput = createInputCell('n');
      nCells.insertBefore(nInput, nEndMarker);
      const nSep = createCell('n', true);
      nCells.insertBefore(nSep, nEndMarker);

      // P: white input + cream (both N and P editable from start)
      const pInput = createInputCell('p');
      pCells.insertBefore(pInput, pEndMarker);
      const pSep = createCell('p', true);
      pCells.insertBefore(pSep, pEndMarker);

      // Auto-focus: alternate between N and P based on last entered.
      // Default lastEnteredType='n' fa que el caret comenci a P (P→N flow).
      const focusTarget = lastEnteredType === 'n' ? pInput : nInput;
      setTimeout(() => {
        // No robem focus si l'usuari ja està editant una altra cel·la
        // (p.ex. ha navegat amb Tab des d'una cel·la de valor).
        const active = document.activeElement;
        if (active && active.classList.contains('editor-cell') && active !== focusTarget) {
          return;
        }
        focusTarget.focus();
      }, 30);
    }

    // End markers
    nEndMarker.style.display = currentPairs.length >= TOTAL_SPACES ? 'flex' : 'none';
    pEndMarker.style.display = currentPairs.length >= TOTAL_SPACES ? 'flex' : 'none';
  }

  function createCell(type, isCream) {
    const cell = document.createElement('input');
    cell.type = 'text';
    cell.className = `editor-cell editor-cell--${type}`;
    cell.placeholder = ' ';
    cell.readOnly = true;
    return cell;
  }

  // Helper: cel·les editables (value + input) en ordre de columna
  // (N0, P0, N1, P1, …, Ninput, Pinput). Per a Tab/Shift+Tab.
  function getEditableCellsColumnOrder() {
    const ns = Array.from(nCells.querySelectorAll('.editor-cell:not([readonly])'));
    const ps = Array.from(pCells.querySelectorAll('.editor-cell:not([readonly])'));
    const max = Math.max(ns.length, ps.length);
    const result = [];
    for (let i = 0; i < max; i++) {
      if (ns[i]) result.push(ns[i]);
      if (ps[i]) result.push(ps[i]);
    }
    return result;
  }

  // Navegació de tecles compartida entre cel·les de valor i d'input:
  // Enter (commit/blur), Tab (columna), Arrows horitzontals (mateixa fila),
  // Arrows verticals (salta entre N i P). preventDefault perquè no quedi
  // capturat pel caret de l'input.
  function addCellNavigation(cell, type) {
    cell.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        cell.blur();
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const pIdx = cell.dataset.pairIndex;
        const row = cell.dataset.row || type;
        cell.blur(); // el blur pot re-renderitzar — re-pesquem
        const cells = getEditableCellsColumnOrder();
        let i = cells.indexOf(cell);
        if (i === -1 && pIdx !== undefined) {
          i = cells.findIndex(c =>
            c.dataset.pairIndex === pIdx
            && (c.dataset.row || (c.classList.contains('editor-cell--n') ? 'n' : 'p')) === row
          );
        }
        const dst = e.shiftKey ? cells[i - 1] : cells[i + 1];
        if (dst) dst.focus();
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const rowCells = type === 'n'
          ? Array.from(nCells.querySelectorAll('.editor-cell:not([readonly])'))
          : Array.from(pCells.querySelectorAll('.editor-cell:not([readonly])'));
        const i = rowCells.indexOf(cell);
        const dst = e.key === 'ArrowRight' ? rowCells[i + 1] : rowCells[i - 1];
        if (dst) dst.focus();
        return;
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const otherRow = type === 'n' ? 'p' : 'n';
        let dst = null;
        if (cell.dataset.pairIndex !== undefined) {
          dst = document.querySelector(
            `.editor-cell--${otherRow}[data-pair-index="${cell.dataset.pairIndex}"]:not([readonly])`
          );
        }
        if (!dst) {
          // Cel·la d'input: salta a l'input de l'altra fila.
          const otherContainer = otherRow === 'n' ? nCells : pCells;
          dst = otherContainer.querySelector('.editor-input');
        }
        if (dst) dst.focus();
      }
    });
  }

  // Cel·la de valor EDITABLE per a un parell ja commitejat (substitueix
  // el patró antic de cel·la readonly: ara es pot editar in-place amb
  // validació, tooltip i, en P, re-ordenament per puls).
  function createValueCell(type, pair, pairIndex) {
    const cell = document.createElement('input');
    cell.type = 'text';
    cell.inputMode = 'numeric';
    cell.maxLength = 2;
    cell.className = `editor-cell editor-cell--${type}`;
    cell.value = type === 'n' ? String(pair.note) : String(pair.pulse);
    cell.dataset.pairIndex = String(pairIndex);
    cell.dataset.pulse = String(pair.pulse);
    cell.dataset.row = type;
    cell.readOnly = false;

    let originalValue = cell.value;

    cell.addEventListener('focus', () => {
      originalValue = cell.value;
      cell.select();
    });

    cell.addEventListener('blur', () => {
      const val = cell.value.trim();
      if (!val || val === originalValue) { cell.value = originalValue; return; }

      if (!/^\d+$/.test(val)) {
        showEditorTooltip(cell, type === 'n' ? 'Nota: 0-11' : 'Pulso: 0-7');
        cell.value = originalValue;
        return;
      }

      const num = parseInt(val, 10);
      const idx = parseInt(cell.dataset.pairIndex, 10);
      const target = currentPairs[idx];
      if (!target) { cell.value = originalValue; return; }

      if (type === 'n') {
        if (num < 0 || num > 11) {
          showEditorTooltip(cell, 'Nota: 0-11');
          cell.value = originalValue;
          return;
        }
        target.note = num;
        renderEditor();
        syncGridFromPairs(currentPairs);
      } else {
        if (num < 0 || num > 7) {
          showEditorTooltip(cell, 'Pulso: 0-7');
          cell.value = originalValue;
          return;
        }
        if (currentPairs.some((p, i) => i !== idx && p.pulse === num)) {
          showEditorTooltip(cell, 'Pulso ya usado');
          cell.value = originalValue;
          return;
        }
        const beforeOrder = currentPairs.map(p => p.pulse).join(',');
        target.pulse = num;
        currentPairs.sort((a, b) => a.pulse - b.pulse);
        const afterOrder = currentPairs.map(p => p.pulse).join(',');
        if (beforeOrder !== afterOrder) {
          showEditorTooltip(cell, 'Reordenado por pulso');
        }
        renderEditor();
        syncGridFromPairs(currentPairs);
      }
    });

    addCellNavigation(cell, type);

    return cell;
  }

  let pendingNote = null;
  let pendingPulse = null;
  let autoJumpTimer = null;
  // Tracks which field was entered last → next focus goes to the OTHER.
  // Default 'n' fa que el caret comenci a P (ordre P→N en l'entrada).
  let lastEnteredType = 'n';

  // Simple tooltip
  let tooltipEl = null;
  function showEditorTooltip(anchor, message) {
    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.className = 'editor-tooltip';
      document.body.appendChild(tooltipEl);
    }
    tooltipEl.textContent = message;
    const rect = anchor.getBoundingClientRect();
    tooltipEl.style.left = `${rect.left}px`;
    tooltipEl.style.top = `${rect.bottom + 4}px`;
    tooltipEl.classList.add('visible');
    clearTimeout(tooltipEl._timer);
    tooltipEl._timer = setTimeout(() => tooltipEl.classList.remove('visible'), 2000);
  }

  function addPair(note, pulse) {
    // Rule 3: no duplicate pulses
    if (currentPairs.some(p => p.pulse === pulse)) {
      const pInput = pCells.querySelector('.editor-input:not([readonly])');
      if (pInput) showEditorTooltip(pInput, 'Pulso ya usado');
      return false;
    }
    const wasLength = currentPairs.length;
    currentPairs.push({ note, pulse });
    // Rule 4: auto-sort by pulse ascending
    currentPairs.sort((a, b) => a.pulse - b.pulse);
    // Tooltip when reordering happened
    const newIndex = currentPairs.findIndex(p => p.note === note && p.pulse === pulse);
    if (newIndex !== wasLength) {
      const anchor = lastEnteredType === 'p'
        ? pCells.querySelector('.editor-input')
        : nCells.querySelector('.editor-input');
      if (anchor) showEditorTooltip(anchor, 'Reordenado por pulso');
    }
    return true;
  }

  function commitPair() {
    const note = pendingNote;
    const pulse = pendingPulse;
    if (note === null || pulse === null) return;

    if (addPair(note, pulse)) {
      pendingNote = null;
      pendingPulse = null;
      renderEditor();
      syncGridFromPairs(currentPairs);
    } else {
      // Duplicate pulse — clear P input, keep caret
      pendingPulse = null;
      const pInput = pCells.querySelector('.editor-input');
      if (pInput) { pInput.value = ''; pInput.focus(); }
    }
  }

  function createInputCell(type) {
    const cell = document.createElement('input');
    cell.type = 'text';
    cell.inputMode = 'numeric';
    cell.maxLength = 2;
    cell.className = `editor-cell editor-cell--${type} editor-input`;
    cell.readOnly = false;

    cell.addEventListener('input', (e) => {
      const val = e.target.value;
      // Allow empty (user is deleting)
      if (val === '') return;
      // Strip non-numeric
      if (!/^-?\d+$/.test(val)) { e.target.value = ''; return; }

      const num = parseInt(val);

      if (type === 'n') {
        // Rule 1: Note 0-11
        if (num < 0 || num > 11) {
          showEditorTooltip(cell, 'Nota: 0-11');
          e.target.value = '';
          clearTimeout(autoJumpTimer);
          pendingNote = null;
          return;
        }
        pendingNote = num;
        lastEnteredType = 'n';

        // Rule 6: delay 500ms for 2-digit input (e.g. "11")
        clearTimeout(autoJumpTimer);
        autoJumpTimer = setTimeout(() => {
          // If P already entered, commit pair
          if (pendingPulse !== null) {
            commitPair();
          } else {
            // Jump to P input (same column)
            const pInput = pCells.querySelector('.editor-input');
            if (pInput) pInput.focus();
          }
        }, 500);

      } else {
        // Rule 2: Pulse 0-7
        if (num < 0 || num > 7) {
          showEditorTooltip(cell, 'Pulso: 0-7');
          e.target.value = '';
          return;
        }
        pendingPulse = num;
        lastEnteredType = 'p';

        // If N already entered, commit pair
        if (pendingNote !== null) {
          clearTimeout(autoJumpTimer);
          if (!addPair(pendingNote, num)) {
            // Duplicate pulse — clear input, keep caret
            e.target.value = '';
            pendingPulse = null;
            return;
          }
          pendingNote = null;
          pendingPulse = null;
          renderEditor();
          syncGridFromPairs(currentPairs);
          // Rule 5: P=7 auto-blur (last pulse)
          if (num === 7) return;
        } else {
          // Jump to N input (same column)
          const nInput = nCells.querySelector('.editor-input');
          if (nInput) nInput.focus();
        }
      }
    });

    cell.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value) {
        e.preventDefault();
        clearTimeout(autoJumpTimer);

        // Flux P→N: Backspace en N retrocedeix a P; Backspace en P (sense
        // pending) elimina l'últim parell committed.
        if (type === 'n') {
          if (pendingNote !== null) {
            pendingNote = null;
          } else if (pendingPulse !== null) {
            // Go back to P input
            pendingPulse = null;
            const pInput = pCells.querySelector('.editor-input');
            if (pInput) { pInput.value = ''; pInput.focus(); }
          } else if (currentPairs.length > 0) {
            currentPairs.pop();
            renderEditor();
            syncGridFromPairs(currentPairs);
          }
        } else if (type === 'p') {
          if (pendingPulse !== null) {
            pendingPulse = null;
          } else if (currentPairs.length > 0) {
            currentPairs.pop();
            renderEditor();
            syncGridFromPairs(currentPairs);
          }
        }
      }
    });

    // Navegació: fletxes, Tab, Enter (compartit amb les cel·les de valor).
    addCellNavigation(cell, type);

    return cell;
  }

  // Public API (compatible with old gridEditor interface)
  gridEditor = {
    getPairs: () => currentPairs.map(p => ({ ...p })),
    setPairs: (pairs) => {
      currentPairs = pairs.filter(p => p.note !== null && !p.isRest);
      renderEditor();
    },
    clear: () => {
      currentPairs = [];
      pendingNote = null;
      pendingPulse = null;
      renderEditor();
    },
    clearHighlights: () => {
      // No-op: nuzic editor doesn't have per-cell highlights
    },
    destroy: () => {
      editorEl.remove();
    }
  };

  renderEditor();
  return editorEl;
}

// ========== DOM INJECTION ==========

function injectGridEditor() {
  // Create main grid wrapper for proper CSS grid layout
  const appRoot = document.getElementById('app-root');
  if (appRoot) {
    const mainElement = appRoot.querySelector('main');
    if (mainElement) {
      const gridWrapper = document.createElement('div');
      gridWrapper.className = 'app12-main-grid';
      mainElement.appendChild(gridWrapper);
    }
  }
}

// ========== INITIALIZATION ==========

async function init() {
  console.log('Initializing App12: Plano-Sucesión...');

  // Setup piano preload in background (reduces latency on first play)
  setupPianoPreload({ delay: 300 });

  // Inject DOM elements
  injectGridEditor();

  // Save BPM before removing obsolete sections
  const bpmParam = document.getElementById('bpmParam');

  // Remove obsolete template sections (Lg/V/T inputs, formula, middle)
  document.querySelector('.inputs')?.remove();
  document.querySelector('.middle')?.remove();

  // Load preferences
  const prefs = preferenceStorage.load() || {};

  // Create musical grid inside the main grid wrapper
  const mainGridWrapper = document.querySelector('.app12-main-grid');
  musicalGrid = createMusicalGrid({
    parent: mainGridWrapper || document.getElementById('app-root'), // Use grid wrapper if exists
    notes: TOTAL_NOTES,
    pulses: TOTAL_PULSES,
    // The last pulse (index TOTAL_PULSES-1) renders as a `·` cycle-end
    // marker — visual only, not clickable. Sequence spans 0..7.
    showCycleEnd: true,
    startMidi: 60, // C4
    fillSpaces: true, // Cells between pulses (spaces 0-7)
    cellClassName: 'musical-cell',
    activeClassName: 'active',
    highlightClassName: 'highlight',
    showIntervals: {
      horizontal: true,
      vertical: false
    },
    intervalColor: '#4A9EFF',
    cellRenderer: (noteIndex, pulseIndex, cellElement) => {
      // Custom rendering: add label structure for N/P pairs
      clearElement(cellElement); // Clear any default content (XSS-safe)
    },
    onCellClick: async (noteIndex, pulseIndex, cellElement) => {
      // Play MIDI note on click via audio engine
      const audioInstance = await initAudio();

      if (!window.Tone || !audioInstance) {
        console.warn('Audio not available');
        return;
      }

      const midi = 60 + noteIndex; // C4 = MIDI 60
      const duration = (60 / currentBPM) * 0.9; // 1 pulse duration (90% for clean separation)
      const Tone = window.Tone;
      audioInstance.playNote(midi, duration, Tone.now());

      // Check polyphony mode
      // Don't manipulate DOM directly - let syncGridFromPairs handle all visual updates
      if (!gridEditor) return;

      const currentPairs = gridEditor.getPairs();
      const isActive = currentPairs.some(p => p.note === noteIndex && p.pulse === pulseIndex);

      let newPairs;
      if (!polyphonyEnabled) {
        // ========== MONOPHONIC MODE ==========
        // Only one note per pulse allowed
        if (isActive) {
          // Remove this pair
          newPairs = currentPairs.filter(p => !(p.note === noteIndex && p.pulse === pulseIndex));
        } else {
          // Remove all pairs for this pulse, add only this one
          newPairs = currentPairs.filter(p => p.pulse !== pulseIndex);
          newPairs.push({ note: noteIndex, pulse: pulseIndex });
        }
      } else {
        // ========== POLYPHONIC MODE ==========
        // Multiple notes per pulse allowed
        if (isActive) {
          // Remove pair
          newPairs = currentPairs.filter(p => !(p.note === noteIndex && p.pulse === pulseIndex));
        } else {
          // Add pair
          newPairs = [...currentPairs, { note: noteIndex, pulse: pulseIndex }];
        }
      }

      // Update grid editor and sync visual state
      gridEditor.setPairs(newPairs);
      syncGridFromPairs(newPairs);
    },
    onDotClick: null // N-P dots not clickable in N-P mode
  });

  // Create nuzic N-P editor below timeline
  const timelineWrapper = document.querySelector('.timeline-wrapper');
  if (timelineWrapper) {
    createNuzicEditor(timelineWrapper);
  }

  // Move controls out of timeline-wrapper into main grid, reorder as compact row
  const controls = document.querySelector('.controls');
  const gridWrapper = document.querySelector('.app12-main-grid');
  if (controls && gridWrapper) {
    // bpmParam already saved before .inputs removal
    const playBtnEl = controls.querySelector('.play') || document.getElementById('playBtn');
    const randomBtnEl = controls.querySelector('.random');
    const resetBtnEl = controls.querySelector('.reset');
    const randomMenu = controls.querySelector('.random-menu');

    while (controls.firstChild) controls.removeChild(controls.firstChild);

    if (playBtnEl) controls.appendChild(playBtnEl);
    if (bpmParam) controls.appendChild(bpmParam);
    if (randomBtnEl) controls.appendChild(randomBtnEl);
    if (randomMenu) controls.appendChild(randomMenu);
    if (resetBtnEl) controls.appendChild(resetBtnEl);

    // Move controls to end of main grid (below editor)
    gridWrapper.appendChild(controls);
  }

  // Initialize highlight controller using shared module.
  highlightController = createMatrixHighlightController({
    musicalGrid,
    gridEditor,
    totalNotes: TOTAL_NOTES,
    currentBPM: currentBPM
  });

  // Wait for DOM to be fully populated by template system
  await new Promise(resolve => setTimeout(resolve, 50));

  // Query control buttons AFTER template has rendered
  playBtn = document.getElementById('playBtn');
  randomBtn = document.getElementById('randomBtn');
  resetBtn = document.getElementById('resetBtn');

  // Event listeners (now buttons exist).
  // NOTE: el randomBtn NO té un `click` listener directe — el cableig
  // viu a `initRandomMenu(...)` més avall, que distingeix shortpress
  // (handleRandom) de longpress (obrir el menú de configuració). Un
  // `addEventListener('click', handleRandom)` aquí dispararia també en
  // longpress, anul·lant la protecció anti-longpress del menú.
  playBtn?.addEventListener('click', handlePlay);
  resetBtn?.addEventListener('click', handleReset);

  // BPM Controller
  const inputBpm = document.getElementById('inputBpm');
  const bpmUp = document.getElementById('bpmUp');
  const bpmDown = document.getElementById('bpmDown');
  if (inputBpm && bpmUp && bpmDown) {
    bpmController = createBpmController({
      inputEl: inputBpm,
      upBtn: bpmUp,
      downBtn: bpmDown,
      min: MIN_BPM,
      max: MAX_BPM,
      defaultValue: DEFAULT_BPM,
      onChange: (bpm) => {
        currentBPM = bpm;
        if (isPlaying && audio) audio.setTempo(bpm);
      }
    });
    bpmController.attach();
  }

  // Idle caret flash on grid editor (note inputs)
  initIdleCaretFlash({ targets: [document.querySelector('.np-editor')] });

  // P1 Toggle (Pulse 0 special sound) - MUST be before mixer init
  const startIntervalToggle = document.getElementById('startIntervalToggle');
  const startSoundRow = document.querySelector('.interval-select-row');
  if (startIntervalToggle && startSoundRow) {
    window.__p1Controller = initP1ToggleUI({
      checkbox: startIntervalToggle,
      startSoundRow: startSoundRow,
      storageKey: 'app12:p1Toggle',
      onChange: async (enabled) => {
        const audioInstance = await initAudio();
        if (audioInstance && typeof audioInstance.setStartEnabled === 'function') {
          audioInstance.setStartEnabled(enabled);
        }
      }
    });
  }

  // Mixer integration (longpress on play button)
  const mixerMenu = document.getElementById('mixerMenu');
  if (mixerMenu) {
    initMixerMenu({
      menu: mixerMenu,
      triggers: [playBtn].filter(Boolean),
      channels: [
        { id: 'start', label: 'P0', allowSolo: true },
        { id: 'pulse', label: 'Pulso', allowSolo: true },
        { id: 'instrument', label: 'Piano', allowSolo: true },
        { id: 'master', label: 'Master', allowSolo: false, isMaster: true }
      ]
    });
  }

  // Mixer state persistence (helper centralitzat)
  const mixerPersist = createMixerPersistence({ storageKey: 'app12-mixer' });
  setTimeout(() => mixerPersist.hydrate(audio), 50);
  mixerPersist.subscribe(audio);

  // Audio toggles (sync with mixer)
  const pulseToggleBtn = document.getElementById('pulseToggleBtn');
  if (pulseToggleBtn) {
    const globalMixer = getMixer();
    initAudioToggles({
      toggles: [
        {
          id: 'pulse',
          button: pulseToggleBtn,
          storageKey: 'app12:pulseAudio',
          mixerChannel: 'pulse',
          defaultEnabled: true,
          onChange: (enabled) => {
            if (audio && typeof audio.setPulseEnabled === 'function') {
              audio.setPulseEnabled(enabled);
            }
          }
        }
      ],
      storage: {
        load: () => preferenceStorage.load() || {},
        save: (data) => {
          // Save all keys from data object
          Object.entries(data).forEach(([key, value]) => {
            preferenceStorage.save({ [key]: value });
          });
        }
      },
      mixer: globalMixer,
      subscribeMixer
    });
  }

  // Random menu (longpress to open configuration)
  const randomMenu = document.getElementById('randomMenu');
  if (randomBtn && randomMenu) {
    initRandomMenu(randomBtn, randomMenu, handleRandom);
  }

  // Color picker change listener (initial value set in index.html)
  const selectColor = document.getElementById('selectColor');
  if (selectColor) {
    selectColor.addEventListener('input', (e) => {
      const color = e.target.value;
      document.documentElement.style.setProperty('--select-color', color);
      document.documentElement.style.setProperty('--selection-color', color);
      const currentPrefs = preferenceStorage.load() || {};
      currentPrefs.selectColor = color;
      preferenceStorage.save(currentPrefs);
    });
  }

  // Polyphony toggle (NOT persistent - always starts disabled)
  const polyphonyToggle = document.getElementById('polyphonyToggle');
  if (polyphonyToggle) {
    // Always start disabled (monophonic mode)
    polyphonyEnabled = false;
    polyphonyToggle.checked = false;

    // Listen for changes
    polyphonyToggle.addEventListener('change', (e) => {
      polyphonyEnabled = e.target.checked;
      console.log('Polyphony mode:', polyphonyEnabled ? 'ENABLED (polyphonic)' : 'DISABLED (monophonic)');

      // When disabling polyphony, filter to keep only first note per pulse
      if (!polyphonyEnabled && gridEditor) {
        const currentPairs = gridEditor.getPairs();
        const pulsesMap = new Map();
        const filteredPairs = [];

        // Keep only N1 per pulse
        currentPairs.forEach(pair => {
          if (!pulsesMap.has(pair.pulse)) {
            pulsesMap.set(pair.pulse, true);
            filteredPairs.push(pair);
          }
        });

        // Update grid-editor and sync visual state (including interval paths)
        gridEditor.setPairs(filteredPairs);
        syncGridFromPairs(filteredPairs);

        console.log(`Polyphony disabled: ${currentPairs.length} → ${filteredPairs.length} notes (monophonic mode applied)`);
      }
    });
  }

  // Wire instrument dropdown to audio engine
  window.addEventListener('sharedui:instrument', async (e) => {
    const instrument = e.detail.instrument;
    console.log('Instrument changed to:', instrument);

    await initAudio();
    await audio.setInstrument(instrument);

    // Save to preferences
    const currentPrefs = preferenceStorage.load() || {};
    currentPrefs.selectedInstrument = instrument;
    preferenceStorage.save(currentPrefs);
  });

  // Factory reset using shared module
  registerFactoryReset({
    storage: preferenceStorage,
    onBeforeReload: () => {
      handleReset();

      // Clear keys with separate namespace (used by shared UI components)
      localStorage.removeItem('app12:p1Toggle');
      localStorage.removeItem('app12:pulseAudio');

      // Reset mixer to factory defaults (remove saved state)
      localStorage.removeItem('app12-mixer');

      // Polyphony is NOT persistent - no need to reset (always starts disabled)

      // Reset random menu to factory defaults (if present)
      const randPMax = document.getElementById('randPMax');
      const randNMax = document.getElementById('randNMax');
      if (randPMax) randPMax.value = '7';
      if (randNMax) randNMax.value = '11';
    }
  });

  console.log('App12 initialized successfully');
}

// createSoundlineWrapper and createTimelineWrapper removed - now handled by createMusicalGrid()

// ========== CLEANUP ==========

window.addEventListener('beforeunload', () => {
  // Stop audio engine and cleanup Tone.Transport
  if (audio) {
    audio.stop();
  }

  // Cleanup grid components
  if (musicalGrid) {
    musicalGrid.destroy?.();
  }

  if (gridEditor) {
    gridEditor.destroy?.();
  }
});

// Start initialization
init().catch(err => {
  console.error('Failed to initialize App12:', err);
});
