// App32: Plano con Fracción Simple
// Basat en App30, substitueix iT-seq per grid 2D amb notes
// Lg=12 fix, BPM=70 fix, numerador=1 fix, denominador editable (1-8)
// Grid 2D amb 12 notes (0-11) + soundline
// Àudio melòdic amb selector d'instrument + so de cicle

import { getMixer, setChannelMute } from '../../libs/sound/index.js';
import { createMelodicAudioInitializer, setupAudioDefaults, CHANNEL_TIERS } from '../../libs/app-common/audio-init.js';
import { bindSharedSoundEvents } from '../../libs/app-common/audio.js';
import { initMixerMenu } from '../../libs/app-common/mixer-menu.js';
import { createPreferenceStorage, registerFactoryReset, setupThemeSync, setupMutePersistence } from '../../libs/app-common/preferences.js';
import createFractionEditor from '../../libs/app-common/fraction-editor.js';
import { attachHover } from '../../libs/shared-ui/hover.js';
import { showValidationWarning } from '../../libs/app-common/info-tooltip.js';
import {
  buildGridDOM,
  updateSoundline,
  updateMatrix
} from '../../libs/plano-modular/plano-grid.js';
import { createPlanoGridEditor } from '../../libs/plano-modular/plano-grid-editor.js';
import { createPlayheadController } from '../../libs/plano-modular/plano-playhead.js';
import { createBpmController } from '../../libs/app-common/bpm-controller.js';
import { addRepeatPress } from '../../libs/app-common/spinner-repeat.js';
import { buildSimple12Rows } from '../../libs/app-common/plano-grid-rows.js';
import { getTotalSubdivisions as _getTotalSubdivs, filterInvalidNotes as _filterInvalid } from '../../libs/plano-fraccion/fraction-math.js';
import { renderNoteBars, renderSilenceLines, removeOverlappingNotes as _removeOverlapping } from '../../libs/app-common/plano-note-renderer.js';
import { initIdleCaretFlash } from '../../libs/app-common/idle-caret-flash.js';
import { createIntervalLabelBar } from '../../libs/shared-ui/interval-label-bar.js';
import { setupRandomMenu } from '../../libs/random/menu.js';
import { reorderControls } from '../../libs/app-common/template.js';

// ========== CONSTANTS ==========
const FIXED_LG = 12;             // 12 pulsos (0-11)
const DEFAULT_BPM = 60;
const MIN_BPM = 50;
const MAX_BPM = 150;
const FIXED_NUMERATOR = 1;       // Numerador sempre 1 (App30)
const DEFAULT_DENOMINATOR = 2;   // Per defecte 1/2
const MIN_DENOMINATOR = 1;
const MAX_DENOMINATOR = 8;

// Color únic per als note-bars: blau clar (`--nuzic-blue-light`) com a
// apps de plànol anteriors (App19/App20). El highlight durant playback
// usa el blau intens (`--nuzic-blue`) via CSS box-shadow.
const VIBRANT_COLORS = ['#bdd9e6'];

// Notes per àudio
const NOTE_COUNT = 12;       // 12 notes (0-11)
const BASE_MIDI = 48;        // C3 = 48

// ========== STATE ==========
let audio = null;
let isPlaying = false;
let bpmController = null;
let currentDenominator = DEFAULT_DENOMINATOR;

// Notes array: { note: 0-11, startSubdiv: number, duration: number }
let notes = [];

// Grid elements
let gridElements = null;
let playheadController = null;

// DOM elements
let noteBars = [];     // Rectangles notes al grid

// Controllers
let fractionEditorController = null;
let randomMenu = null;  // Long-press random menu controller (read())

// Playback state
let playbackAbort = null;

// Endpoint-mute state: we mute the `pulse` channel for a single engine
// step at the end (pulse Lg) so the `·` cycle-end marker stays silent.
// Both stopPlayback (user) and onFinish (auto) must restore it.
let endpointPulseMuted = false;
let endpointPulseMuteWasMuted = false;
function restoreEndpointPulseMute() {
  if (endpointPulseMuted) {
    setChannelMute('pulse', endpointPulseMuteWasMuted);
    endpointPulseMuted = false;
  }
}
let currentMetronomeSound = (() => {
  try {
    const stored = localStorage.getItem('baseSound');
    return stored || 'click9';
  } catch {
    return 'click9';
  }
})();

// ========== PREFERENCE STORAGE ==========
const preferenceStorage = createPreferenceStorage({ prefix: 'app32', separator: '::' });
const { load: loadOpt, save: saveOpt, clear: clearOpt } = preferenceStorage;

registerFactoryReset({
  storage: preferenceStorage,
  onBeforeReload: () => {}
});

// ========== SOUND EVENTS ==========
bindSharedSoundEvents({
  getAudio: () => audio,
  mapping: {
    baseSound: 'setBase',
    cycleSound: 'setCycle'
  }
});

// Listen for metronome sound changes
window.addEventListener('sharedui:baseSound', (e) => {
  if (e.detail?.sound) {
    currentMetronomeSound = e.detail.sound;
  }
});

// Listen for instrument changes - sync with audio engine
window.addEventListener('sharedui:instrument', async (e) => {
  if (e.detail?.instrument && audio && audio.setInstrument) {
    await audio.setInstrument(e.detail.instrument);
  }
});

// ========== DOM ELEMENTS ==========
const timelineWrapper = document.getElementById('timelineWrapper');
const playBtn = document.getElementById('playBtn');
const randomBtn = document.getElementById('randomBtn');
const resetBtn = document.getElementById('resetBtn');
const themeSelect = document.getElementById('themeSelect');
const baseSoundSelect = document.getElementById('baseSoundSelect');
const cycleSoundSelect = document.getElementById('cycleSoundSelect');
const mixerMenu = document.getElementById('mixerMenu');

// .middle layout elements (fraction slot + info pastilles in .middle).
let fractionSlot = null;
let sumDisplay = null;
let availableDisplay = null;

// ========== HOVER TOOLTIPS ==========
if (playBtn) attachHover(playBtn, { text: 'Play / Stop' });
if (randomBtn) attachHover(randomBtn, { text: 'Aleatorizar fracción y notas' });
if (resetBtn) attachHover(resetBtn, { text: 'Reset App' });

// ========== MIXER SETUP ==========
// Canals registrats al motor; setupAudioDefaults dins initAudio() els
// personalitza via CHANNEL_TIERS.MELODIC_FULL.
const globalMixer = getMixer();

// ========== THEME & MUTE PERSISTENCE ==========
const muteButton = document.getElementById('muteBtn');
setupThemeSync({ storage: preferenceStorage, selectEl: themeSelect });
setupMutePersistence({
  storage: preferenceStorage,
  getAudioInstance: () => audio,
  muteButton
});

// ========== MIXER MENU ==========
const mixerTriggers = [playBtn].filter(Boolean);

initMixerMenu({
  menu: mixerMenu,
  triggers: mixerTriggers,
  channels: [
    { id: 'start', label: 'P0', allowSolo: true },
    { id: 'pulse', label: 'Pulso', allowSolo: true },
    { id: 'subdivision', label: 'Subdivisión', allowSolo: true },
    { id: 'instrument', label: 'Instrumento', allowSolo: true },
    { id: 'master', label: 'Master', allowSolo: false, isMaster: true }
  ]
});

// ========== AUDIO INITIALIZATION ==========
const _baseInitAudio = createMelodicAudioInitializer({
  defaultInstrument: 'piano'
});

async function initAudio() {
  if (!audio) {
    audio = await _baseInitAudio();
    if (audio) {
      setupAudioDefaults(audio, { channels: CHANNEL_TIERS.MELODIC_FULL });
    }

    // Apply saved mute state
    const savedMute = loadOpt('mute');
    if (audio && savedMute === '1' && typeof audio.setMute === 'function') {
      audio.setMute(true);
    }

    // Configure sounds from dropdowns (like createRhythmAudioInitializer does)
    // This ensures the metronome and cycle sounds are properly initialized
    if (audio && baseSoundSelect?.dataset?.value && typeof audio.setBase === 'function') {
      await audio.setBase(baseSoundSelect.dataset.value);
    }
    if (audio && cycleSoundSelect?.dataset?.value && typeof audio.setCycle === 'function') {
      await audio.setCycle(cycleSoundSelect.dataset.value);
    }

    if (typeof window !== 'undefined') {
      window.__labAudio = audio;
      window.NuzicAudioEngine = audio;
    }
  }
  return audio;
}

if (typeof window !== 'undefined') {
  window.__labInitAudio = initAudio;
  // Initialize audio on first interaction to ensure NuzicAudioEngine is ready
  // before instrument-dropdown tries to preload instruments
  document.addEventListener('click', () => initAudio(), { once: true });
  document.addEventListener('touchstart', () => initAudio(), { once: true });
}

// ========== GRID EDITOR (factory compartida, H-01) ==========
// Variant SIMPLE (n=1 fix). El context aporta getters vius: la factory llegeix
// currentDenominator/notes/etc. en el moment d'ús, mai una còpia.
const gridEditor = createPlanoGridEditor({
  getGridElements: () => gridElements,
  getFraction: () => ({ lg: FIXED_LG, numerator: FIXED_NUMERATOR, denominator: currentDenominator }),
  initAudio,
  getBpm: () => bpmController?.getValue() || DEFAULT_BPM,
  getNotes: () => notes,
  onNoteCreated: addNote,
  getInfoDisplays: () => ({ sum: sumDisplay, available: availableDisplay }),
  noteCount: NOTE_COUNT,
  baseMidi: BASE_MIDI
});

// Identitat estable: la factory fa `.length = 0` i reomple, mai reassigna,
// perquè el highlight de playback d'aquesta app en guarda referències.
const gridIntegerLabels = gridEditor.getIntegerLabels();
const gridFractionLabels = gridEditor.getFractionLabels();

// ========== UTILITY FUNCTIONS ==========

function getTotalSubdivisions() {
  return _getTotalSubdivs(FIXED_LG, FIXED_NUMERATOR, currentDenominator);
}

// ========== MIDDLE LAYOUT (info pastilles + fraction) ==========
// LU-04: la fracció va ANCORADA A L'ESQUERRA de `.middle` i el grup de
// pastilles d'info a la dreta en absolut (Patró App30 — vegeu styles.css
// `.middle`). Els comentaris antics deien "fraction centered": era l'estat
// previ a la migració, el CSS actual no centra res.
function buildMiddleLayout() {
  const middle = document.querySelector('.middle');
  if (!middle) return null;

  middle.innerHTML = '';
  middle.classList.add('app32-middle');

  // Info pastilles group
  const infoGroup = document.createElement('div');
  infoGroup.className = 'itfr-info-group';

  const sumBox = document.createElement('div');
  sumBox.className = 'bpm-inline visible param sum-it';
  sumBox.innerHTML = `
    <span class="abbr">Suma iT</span>
    <div class="circle">
      <input id="sumItDisplay" type="text" value="0" readonly />
    </div>
  `;

  const dispBox = document.createElement('div');
  dispBox.className = 'bpm-inline visible param it-disponibles';
  dispBox.innerHTML = `
    <span class="abbr">iT Disponibles</span>
    <div class="circle">
      <input id="itDisponiblesDisplay" type="text" value="0" readonly />
    </div>
  `;

  infoGroup.appendChild(sumBox);
  infoGroup.appendChild(dispBox);
  middle.appendChild(infoGroup);

  // Fraction slot (center column)
  fractionSlot = document.createElement('div');
  fractionSlot.className = 'itfr-fraction-slot';
  middle.appendChild(fractionSlot);

  // Resolve info displays
  sumDisplay = document.getElementById('sumItDisplay');
  availableDisplay = document.getElementById('itDisponiblesDisplay');

  return middle;
}

function createGrid() {
  // Create grid container AFTER timeline-wrapper (nuzic order: timeline →
  // grid → editor → controls; here there's no editor so grid becomes the
  // dominant visual element, replacing the timeline).
  let gridContainer = document.getElementById('gridContainer');
  if (!gridContainer) {
    gridContainer = document.createElement('div');
    gridContainer.id = 'gridContainer';
    gridContainer.className = 'grid-container';
    if (timelineWrapper && timelineWrapper.parentNode) {
      timelineWrapper.parentNode.insertBefore(gridContainer, timelineWrapper.nextSibling);
    }
  }

  // Build grid DOM
  gridElements = buildGridDOM(gridContainer);

  // ResizeObserver: refresh cellWidth on viewport changes so note bars
  // stay aligned with the dynamic 1fr columns. Debounced via rAF.
  if (gridElements?.matrixContainer && typeof ResizeObserver !== 'undefined') {
    let rafId = 0;
    const ro = new ResizeObserver(() => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        gridEditor.refreshCellWidth();
        renderNotes();
      });
    });
    ro.observe(gridElements.matrixContainer);
  }

  // Create playhead controller. With columnSizing='fr' we pass 0 so the
  // controller uses DOM-based positioning (cell.offsetLeft) — see
  // plano-playhead.js line 42-51.
  // `domOffset: 0` perquè el playhead caigui exactament a
  // `cell.offsetLeft` (alineat amb el pulse-number). El default (7)
  // és per retro-compat amb App19/App20.
  playheadController = createPlayheadController(
    gridElements.matrixContainer,
    () => 0,
    0,
    0  // domOffset
  );

  // Cancel·lar el `marginLeft: -4px` heretat de createPlayhead (legacy
  // d'App19/App20). A App32 el playhead ha de quedar exactament a
  // `cell.offsetLeft`.
  const playheadEl = gridElements.matrixContainer.querySelector('.plano-playhead');
  if (playheadEl) playheadEl.style.marginLeft = '0';

  renderGrid();
}

function renderGrid() {
  if (!gridElements) return;

  const rows = buildSimple12Rows();
  const columns = getTotalSubdivisions();

  // Update soundline (Y-axis: notes 11 to 0)
  updateSoundline(gridElements.soundlineContainer, rows);

  // Update matrix with columnSizing='fr' — cells fill all horizontal space.
  updateMatrix(gridElements.matrixContainer, rows, columns, {
    columnSizing: 'fr',
    onCellClick: null
  });

  const d = currentDenominator;

  // Mark pulse-start cells (colIndex % d === 0). Their left edge coincides
  // with the pulse boundary line.
  const cells = gridElements.matrixContainer.querySelectorAll('.plano-cell');
  cells.forEach(cell => {
    const colIndex = parseInt(cell.dataset.colIndex, 10);
    if (colIndex % d === 0) {
      cell.classList.add('pulse-boundary');
    }
  });

  // Render fractional timeline in grid
  gridEditor.renderGridTimeline();

  // Read actual cell width from DOM now that grid is rendered.
  gridEditor.refreshCellWidth();

  // Attach drag handlers to cells
  gridEditor.attachGridDragHandlers();

  // Sync scroll
  gridEditor.syncGridScrolls();

  // Render existing notes (uses cellWidth for positioning bars).
  renderNotes();

  // Update info displays
  gridEditor.updateInfoDisplays();
}

// (pulse-start alignment handled via CSS `transform: translateX(-50%)`.)

// ========== NOTE RENDERING ==========
function renderNotes() {
  const totalColumns = getTotalSubdivisions();
  renderNoteBars({
    matrixContainer: gridElements?.matrixContainer,
    notes,
    totalColumns,            // % EXACTE: les barres encaixen amb les columnes 1fr
    noteCount: NOTE_COUNT,
    colors: VIBRANT_COLORS,
    onClickNote: removeNote,
    formatBarLabel: (n) => n.note   // número de nota dins el rectangle (no l'iT)
  });
  renderSilenceLines({ matrixContainer: gridElements?.matrixContainer, notes, totalColumns, noteCount: NOTE_COUNT });
  renderNoteHalters();
}

// Halter groc d'iT sota cada note-bar (patró App13/App20/App30).
// El halter es posiciona horitzontalment EXACTAMENT com el note-bar i
// verticalment JUST SOTA d'aquest (pegat a la seva vora inferior).
function renderNoteHalters() {
  const matrix = gridElements?.matrixContainer?.querySelector('.plano-matrix');
  if (!matrix) return;

  // Netejar halters anteriors.
  matrix.querySelectorAll('.note-halter').forEach(el => el.remove());

  if (!notes || notes.length === 0) return;

  // Mesurar cell height per calcular la posició vertical del halter
  // (mateixa fórmula que renderNoteBars). Horitzontal en % EXACTE.
  const firstCell = matrix.querySelector('.plano-cell');
  const cellH = firstCell?.offsetHeight || 32;
  const totalColumns = getTotalSubdivisions();
  if (!totalColumns) return;

  notes.forEach((noteData) => {
    if (noteData.isRest) return;

    const startPercent = (noteData.startSubdiv / totalColumns) * 100;
    const widthPercent = (noteData.duration / totalColumns) * 100;

    // Posició vertical del bar (= renderNoteBars):
    //   rowIndex = NOTE_COUNT-1 - noteData.note  (notes 0..11 mapped 11..0 from top)
    //   barTop = (rowIndex + 1) * cellH - barHeight/2
    //   barHeight = cellH - 2 → bottom = barTop + barHeight = (rowIndex+1)*cellH + cellH/2 - 1
    // El halter va just sota: top_halter = bottom_bar.
    const rowIndex = (NOTE_COUNT - 1) - noteData.note;
    const barHeight = cellH - 2;
    const barTop = (rowIndex + 1) * cellH - barHeight / 2;
    const halterTop = barTop + barHeight;

    const halter = createIntervalLabelBar({
      startPercent,
      widthPercent,
      label: noteData.duration,
      variant: 'solid'
    });
    halter.classList.add('note-halter');
    // A partir de denominador 5, amaga el número d'iT només per a durades
    // curtes (1-2) on no hi cap; iT≥3 manté el número (el halter és prou ample).
    if (currentDenominator >= 5 && noteData.duration <= 2) {
      halter.classList.add('note-halter--no-label');
    }
    halter.style.top = `${halterTop}px`;
    matrix.appendChild(halter);
  });
}

// ========== NOTE MANAGEMENT ==========
function removeOverlappingNotes(startSubdiv, duration) {
  notes = _removeOverlapping(notes, startSubdiv, duration);
}

function addNote(noteData) {
  // Monophonic mode: remove ALL notes that overlap in columns (any row)
  removeOverlappingNotes(noteData.startSubdiv, noteData.duration);

  notes.push(noteData);
  notes.sort((a, b) => a.startSubdiv - b.startSubdiv || a.note - b.note);
  renderNotes();
  gridEditor.updateInfoDisplays();
}

function removeNote(idx) {
  notes.splice(idx, 1);
  renderNotes();
  gridEditor.updateInfoDisplays();
}

function clearNotes() {
  notes = [];
  renderNotes();
  gridEditor.updateInfoDisplays();
}

// ========== FRACTION EDITOR ==========
function initFractionEditorController() {
  if (!fractionSlot) return;

  currentDenominator = DEFAULT_DENOMINATOR;

  const controller = createFractionEditor({
    mode: 'block',
    host: fractionSlot,
    defaults: { numerator: FIXED_NUMERATOR, denominator: DEFAULT_DENOMINATOR },
    startEmpty: false,
    maxDenominator: MAX_DENOMINATOR,
    enableGhost: false,  // numerador fix a 1 → autoReduce mai s'activa, ghost mort
    storage: {},
    addRepeatPress,
    labels: {
      numerator: {
        placeholder: '1',
        ariaUp: 'Incrementar numerador',
        ariaDown: 'Decrementar numerador'
      },
      denominator: {
        placeholder: 'd',
        ariaUp: 'Incrementar denominador',
        ariaDown: 'Decrementar denominador'
      }
    },
    onChange: ({ cause }) => {
      if (cause !== 'init') {
        handleFractionChange();
      }
    }
  });

  fractionEditorController = controller || null;

  // Set simple mode (numerator fixed at 1)
  if (fractionEditorController && typeof fractionEditorController.setSimpleMode === 'function') {
    fractionEditorController.setSimpleMode();
  }
}

function handleFractionChange() {
  if (!fractionEditorController) return;

  const fraction = fractionEditorController.getFraction();
  let newD = fraction?.denominator;

  // Skip if value is not yet valid (user is typing)
  if (!Number.isFinite(newD)) {
    return;
  }

  // Clamp denominator (2-8)
  if (newD < MIN_DENOMINATOR) {
    newD = MIN_DENOMINATOR;
  } else if (newD > MAX_DENOMINATOR) {
    newD = MAX_DENOMINATOR;
  }

  if (newD !== fraction?.denominator) {
    fractionEditorController.setFraction(
      { numerator: FIXED_NUMERATOR, denominator: newD },
      { cause: 'clamp', persist: true, silent: true }
    );
  }

  currentDenominator = newD;

  // Filter invalid notes
  filterInvalidNotes();

  // Redraw grid (contains both the grid and the timeline row).
  renderGrid();

  // Hot-reload audio if playing
  if (audio && isPlaying) {
    applyTransportConfig();
  }
}

function filterInvalidNotes() {
  notes = _filterInvalid(notes, getTotalSubdivisions());
}

/**
 * Apply current fraction config to running audio transport
 * Enables hot-reload when fraction changes during playback
 */
function applyTransportConfig() {
  if (!audio || typeof audio.updateTransport !== 'function') return;

  const lg = FIXED_LG;
  const bpm = (bpmController?.getValue() || DEFAULT_BPM);
  const n = FIXED_NUMERATOR;
  const d = currentDenominator;

  // See startPlayback: scaledTotal = endpointStep + 1, patternBeats keeps
  // cycle events within [0, endpointStep). Endpoint mute is managed by
  // the onSchedule hook in startPlayback; not altered here.
  const endpointStep = lg * d;
  const scaledTotal = endpointStep + 1;
  const scaledBpm = bpm * d;

  audio.updateTransport({
    totalPulses: scaledTotal,
    bpm: scaledBpm,
    baseResolution: d,
    patternBeats: endpointStep,
    cycle: {
      numerator: n * d,
      denominator: d,
      onTick: highlightCycle
    }
  });
}

// ========== TIMELINE RENDERING ==========
// Legacy timeline rendering removed — the plano-modular grid handles its own
// timeline row, and notes are drawn as `.note-bar` elements inside the matrix
// via renderNoteBars(). No external #timeline is needed.

// ========== PLAYBACK ==========
/**
 * Get note that starts at a given scaled index
 * Returns the note object or null if no note starts there
 */
function getNoteAtScaledStart(scaledIndex) {
  const n = FIXED_NUMERATOR;

  for (const noteData of notes) {
    // Convert note start (in subdivisions) to scaled index
    const noteScaledStart = noteData.startSubdiv * n;
    if (noteScaledStart === scaledIndex) {
      return noteData;
    }
  }
  return null;
}

async function startPlayback() {
  // Allow playback even with no notes (just metronome)

  const lg = FIXED_LG;
  const bpm = (bpmController?.getValue() || DEFAULT_BPM);
  const n = FIXED_NUMERATOR;
  const d = currentDenominator;

  // Scale by denominator to include subdivisions.
  //   scaledTotal = lg*d + 1  → engine reaches the pulse-Lg step so the
  //     subdivisions just before it emit cycle events.
  //   patternBeats = lg*d     → cycle events only within [0, lg*d), so
  //     no subdivisions INSIDE pulse Lg are scheduled.
  //   We mute the `pulse` channel in onSchedule for stepIndex === lg*d
  //     so pulse Lg stays silent while still letting the engine advance.
  const baseResolution = d;
  const scaledInterval = (60 / bpm) / d;
  const endpointStep = lg * d;
  const scaledTotal = endpointStep + 1;

  const audioInstance = await initAudio();

  const hasCycle = n > 0 && d > 0 && Math.floor(lg / n) > 0;

  // No accent selection - we use melodic notes from grid
  const audioSelection = { values: new Set(), resolution: 1 };

  // Record current pulse-channel mute so restoreEndpointPulseMute can
  // put it back. If the user toggles mute during playback the change
  // will be overwritten at restore — acceptable trade-off for this app.
  endpointPulseMuteWasMuted = !!getMixer()?.getChannelState?.('pulse')?.muted;
  endpointPulseMuted = false;

  const onFinish = () => {
    isPlaying = false;
    updateControlsState();
    clearHighlights();
    restoreEndpointPulseMute();
    // Delay stop() so the pre-scheduled sample for the last pulse (endpoint)
    // has time to play instead of being cancelled by source.stop(0).
    setTimeout(() => audioInstance.stop(), Math.max(200, scaledInterval * 1000 * 0.6));
  };

  // Build play options
  const playOptions = {
    baseResolution,
    patternBeats: endpointStep,  // cycle events only within [0, lg*d)
    onSchedule: (stepIndex, _when) => {
      // Mute the pulse channel just before the endpoint beat (pulse Lg)
      // so its base sample doesn't fire. Subdivisions already fired;
      // onFinish / stopPlayback restores the channel.
      if (stepIndex === endpointStep && !endpointPulseMuted) {
        setChannelMute('pulse', true);
        endpointPulseMuted = true;
      }
    }
  };

  if (hasCycle) {
    // Scale numerator by d to match scaled timeline
    playOptions.cycle = {
      numerator: n * d,
      denominator: d,
      onTick: highlightCycle
    };
  }

  // Declarative note provider: engine schedules notes automatically in tick()
  audioInstance.registerNoteProvider('melody', (scaledIndex) => {
    const d = currentDenominator;
    const n = FIXED_NUMERATOR;

    const noteData = getNoteAtScaledStart(scaledIndex);
    if (noteData) {
      const bpm = bpmController?.getValue() || DEFAULT_BPM;
      const beatDuration = 60 / bpm;
      const durationPulses = noteData.duration * n / d;
      const durationSeconds = durationPulses * beatDuration;
      const midiNote = BASE_MIDI + noteData.note;
      return [{ midi: midiNote, duration: durationSeconds, velocity: 0.8 }];
    }
    return null;
  });

  // Start playback with audio.play() - this handles metronome and subdivision sounds
  // highlightPulse handles ONLY visual updates; note provider handles audio
  audioInstance.play(
    scaledTotal,
    scaledInterval,
    audioSelection,
    false,  // Loop DISABLED (one-shot)
    highlightPulse,
    onFinish,
    playOptions
  );

  isPlaying = true;
  updateControlsState();
}

async function stopPlayback() {
  if (!audio) return;

  audio.stop();
  isPlaying = false;
  clearHighlights();
  restoreEndpointPulseMute();
  updateControlsState();
}

async function playMetronomeClick() {
  if (!audio) return;
  try {
    await audio.playSound(currentMetronomeSound, 'pulse');
  } catch (err) {
    console.warn('Error playing metronome:', err);
  }
}

async function playCycleSound() {
  if (!audio) return;
  try {
    await audio.playSound(audio._soundAssignments?.cycle || 'click2', 'subdivision');
  } catch (err) {
    console.warn('Error playing cycle sound:', err);
  }
}

// ========== HIGHLIGHTING ==========
function clearHighlights() {
  gridIntegerLabels.forEach(label => label?.classList.remove('active'));
  gridFractionLabels.forEach(label => label?.classList.remove('active'));
  // Hide playhead
  if (playheadController) {
    playheadController.hide();
  }
  // Reset scroll to start
  const matrix = gridElements?.matrixContainer;
  if (matrix) {
    matrix.scrollLeft = 0;
  }
}

/**
 * Highlight pulse - receives scaledIndex from audio.play()
 * Like App29: scaledIndex = pulseIndex * d for integer pulses
 * Audio scheduling moved to note provider; this handles ONLY visuals.
 */
function highlightPulse(scaledIndex) {
  if (!isPlaying) return;
  const d = currentDenominator;

  // Update playhead position (scaledIndex is the column index)
  if (playheadController) {
    playheadController.update(scaledIndex);

    // Autoscroll to keep playhead visible
    const matrix = gridElements?.matrixContainer;
    if (matrix) {
      const playheadLeft = scaledIndex * gridEditor.getCellWidth();
      const viewportWidth = matrix.clientWidth;
      const scrollLeft = matrix.scrollLeft;
      const margin = viewportWidth * 0.2; // 20% margin before edge

      // Scroll right if playhead approaches right edge
      if (playheadLeft > scrollLeft + viewportWidth - margin) {
        matrix.scrollLeft = playheadLeft - margin;
      }
      // Scroll left if playhead approaches left edge (for looping)
      if (playheadLeft < scrollLeft + margin) {
        matrix.scrollLeft = Math.max(0, playheadLeft - margin);
      }
    }
  }

  // Convert scaled index to pulse index (only highlight integer pulses)
  // scaledIndex = pulseIndex * d for integer pulses
  if (scaledIndex % d !== 0) return; // Skip subdivisions (handled by highlightCycle)

  const pulseIndex = scaledIndex / d;

  gridIntegerLabels.forEach(label => label?.classList.remove('active'));
  const integerLabel = gridIntegerLabels[pulseIndex];
  if (integerLabel) {
    void integerLabel.offsetWidth;
    integerLabel.classList.add('active');
  }

  // Also highlight the note bar that contains this pulse
  highlightBarAtPosition(pulseIndex);
}

/**
 * Highlight cycle subdivision - receives payload from audio.play() cycle callback
 * Like App29: { cycleIndex, subdivisionIndex }
 */
function highlightCycle(payload = {}) {
  if (!isPlaying) return;

  const { cycleIndex: rawCycleIndex, subdivisionIndex: rawSubdivisionIndex } = payload;
  const cycleIndex = Number(rawCycleIndex);
  const subdivisionIndex = Number(rawSubdivisionIndex);

  if (!Number.isFinite(cycleIndex) || !Number.isFinite(subdivisionIndex)) return;

  // Highlight fractional timeline numbers in the grid's timeline row.
  gridFractionLabels.forEach(label => label?.classList.remove('active'));
  if (subdivisionIndex > 0) {
    const fractionalIndex = cycleIndex * currentDenominator + subdivisionIndex - 1;
    const fractionalLabel = gridFractionLabels[fractionalIndex];
    if (fractionalLabel) {
      fractionalLabel.classList.add('active');
    }
  }

  // Calculate position and highlight note bar in grid.
  const n = FIXED_NUMERATOR;
  const position = cycleIndex * n + subdivisionIndex * n / currentDenominator;
  highlightBarAtPosition(position);
}

/**
 * Highlight the note bar (inside the grid matrix) that contains a given position.
 */
function highlightBarAtPosition(position) {
  const d = currentDenominator;
  const matrix = gridElements?.matrixContainer?.querySelector('.plano-matrix');
  const bars = matrix?.querySelectorAll('.note-bar');
  if (!bars) return;

  let activeIdx = -1;
  for (let i = 0; i < notes.length; i++) {
    const noteData = notes[i];
    const startPos = noteData.startSubdiv / d;
    const endPos = (noteData.startSubdiv + noteData.duration) / d;
    if (position >= startPos && position < endPos) {
      activeIdx = i;
      break;
    }
  }

  bars.forEach((b, i) => b.classList.toggle('highlight', i === activeIdx));
}

// ========== CONTROLS ==========
function updateControlsState() {
  if (playBtn) {
    playBtn.classList.toggle('playing', isPlaying);

    // Toggle play/stop icons
    const iconPlay = playBtn.querySelector('.icon-play');
    const iconStop = playBtn.querySelector('.icon-stop');
    if (iconPlay && iconStop) {
      iconPlay.style.display = isPlaying ? 'none' : 'block';
      iconStop.style.display = isPlaying ? 'block' : 'none';
    }
  }
}

function handlePlay() {
  if (isPlaying) {
    stopPlayback();
  } else {
    startPlayback();
  }
}

function handleRandom() {
  if (isPlaying) return;

  // Random denominator from 2 to the longpress-menu cap (default = MAX_DENOMINATOR).
  const { denomMax } = randomMenu?.read() ?? { denomMax: MAX_DENOMINATOR };
  const dMax = Math.min(denomMax, MAX_DENOMINATOR);
  const newD = Math.floor(Math.random() * (dMax - 1)) + 2;

  if (fractionEditorController) {
    fractionEditorController.setFraction(
      { numerator: FIXED_NUMERATOR, denominator: newD },
      { cause: 'random', persist: true }
    );
  }
  currentDenominator = newD;

  // Generate random monophonic notes (consecutive, no overlap)
  const maxSubdivs = getTotalSubdivisions();
  const newNotes = [];
  let currentPos = 0;

  while (currentPos < maxSubdivs) {
    // Random note (0-11)
    const note = Math.floor(Math.random() * NOTE_COUNT);

    // Random duration (1 to min of remaining space or d*2)
    const remaining = maxSubdivs - currentPos;
    const maxDur = Math.min(remaining, newD * 2);
    const duration = Math.floor(Math.random() * maxDur) + 1;

    newNotes.push({ note, startSubdiv: currentPos, duration });
    currentPos += duration;
  }

  notes = newNotes;

  renderGrid();
}

function handleReset() {
  if (isPlaying) {
    stopPlayback();
  }

  // Reset to defaults
  currentDenominator = DEFAULT_DENOMINATOR;

  if (fractionEditorController) {
    fractionEditorController.setFraction(
      { numerator: FIXED_NUMERATOR, denominator: DEFAULT_DENOMINATOR },
      { cause: 'reset', persist: true }
    );
  }

  clearNotes();

  renderGrid();
}

// ========== EVENT LISTENERS ==========
if (playBtn) {
  playBtn.addEventListener('click', handlePlay);
}

if (randomBtn) {
  randomMenu = setupRandomMenu({
    storage: { load: loadOpt, save: saveOpt }, // LU-03: la config del menú sobreviu recàrregues
    spec: {
      denomMax: { label: 'Denominador máximo', min: 2, max: MAX_DENOMINATOR, default: MAX_DENOMINATOR },
    },
    onRandomize: handleRandom,
  });
}

if (resetBtn) {
  resetBtn.addEventListener('click', handleReset);
}

// ========== INITIALIZATION ==========
function init() {
  // Initialize BPM controller
  const bpmInput = document.getElementById('inputBpm');
  const bpmDown = document.getElementById('bpmDown');
  const bpmUp = document.getElementById('bpmUp');
  if (bpmInput && bpmDown && bpmUp) {
    bpmController = createBpmController({
      inputEl: bpmInput,
      upBtn: bpmUp,
      downBtn: bpmDown,
      min: MIN_BPM,
      max: MAX_BPM,
      defaultValue: DEFAULT_BPM,
      onChange: () => {
        if (isPlaying) {
          applyTransportConfig();
        }
      }
    });
    bpmController.attach();
  }

  // Build .middle layout: info pastilles + fraction (creates fractionSlot).
  buildMiddleLayout();

  // Initialize fraction editor in block mode into fractionSlot.
  initFractionEditorController();

  // Create grid (inserted AFTER timeline-wrapper).
  createGrid();

  // Ordre nuzic de la fila de controls (helper compartit, H-08) +
  // trasllat sota el grid (nuzic order: middle → grid → controls).
  const controls = reorderControls();
  const gridContainer = document.getElementById('gridContainer');
  if (controls && gridContainer?.parentNode) {
    gridContainer.parentNode.insertBefore(controls, gridContainer.nextSibling);
  }

  // Idle caret flash on fraction slot (persistent across renders).
  initIdleCaretFlash({ targets: [fractionSlot].filter(Boolean) });
}

// Run initialization
init();
