/**
 * plano-grid-editor.js — Editor de graella per drag (np-dots), timeline
 * fraccionària i preview d'àudio, compartit per les 4 apps de plano-fraccion
 * (App32-35).
 *
 * Extret de la troballa H-01 (auditoria 2026-07-06): les 4 apps tenien
 * còpies MD5-idèntiques d'aquestes funcions (handleGridDragMove/End,
 * createGridPreviewBar, injectNpDots, attachGridDragHandlers,
 * updateInfoDisplays, calculateCellWidth, syncGridScrolls, playNotePreview)
 * i dues variants de renderGridTimeline (simple n=1 a App32/34, complexa
 * n variable a App33/35) que es reconcilien amb una única fórmula general.
 *
 * DISSENY: factory amb context (Invariant "libs FIRST" + Trap 1 de la
 * troballa). Cap variable a nivell de mòdul — tot l'estat (dragState,
 * delegationAttached, integerLabels/fractionLabels, cachedCellWidth,
 * scrollSyncCleanup) viu dins la closure d'una instància per app. L'estat
 * de l'app (fracció, notes, bpm, elements DOM) mai es copia: entra per
 * getters que es criden en el moment d'ús, de manera que els canvis de
 * currentNumerator/currentLg (App33/35) es reflecteixen sense cap sync
 * addicional.
 *
 * @module plano-modular/plano-grid-editor
 */

import { getTotalSubdivisions } from '../plano-fraccion/fraction-math.js';
import { setupScrollSync } from './plano-scroll.js';

/**
 * Crea una instància de l'editor de graella per a una app concreta.
 *
 * @param {Object} context
 * @param {() => ({container, matrixContainer, timelineContainer, soundlineContainer}|null)} context.getGridElements
 * @param {() => ({lg:number, numerator:number, denominator:number})} context.getFraction — VIU, es llegeix a cada crida
 * @param {() => Promise<Object|null>} context.initAudio — INICIALITZADOR async, mai una instància (Invariant 3)
 * @param {() => number} context.getBpm
 * @param {() => Array<{note:number, startSubdiv:number, duration:number, isRest?:boolean}>} context.getNotes
 * @param {(noteData: Object) => void} context.onNoteCreated
 * @param {() => ({sum: HTMLInputElement|null, available: HTMLInputElement|null})} context.getInfoDisplays
 * @param {number} [context.noteCount=12]
 * @param {number} [context.baseMidi=48]
 * @param {number} [context.previewMaxSeconds=2]
 * @returns {Object} API de l'editor de graella
 */
export function createPlanoGridEditor(context) {
  const {
    getGridElements,
    getFraction,
    initAudio,
    getBpm,
    getNotes,
    onNoteCreated,
    getInfoDisplays,
    noteCount = 12,
    baseMidi = 48,
    previewMaxSeconds = 2
  } = context;

  // ---------- Estat intern (una còpia per instància, cap a nivell de mòdul) ----------
  let dragState = {
    active: false,
    note: undefined,
    startSubdiv: null,
    currentSubdiv: null,
    maxSubdiv: null,
    previewBar: null
  };
  let delegationAttached = false;
  // Identitat estable: renderGridTimeline fa `.length = 0` i reomple, mai
  // reassigna, perquè el highlight de playback de l'app en guarda referències.
  let integerLabels = [];
  let fractionLabels = [];
  let cachedCellWidth = 40;
  let scrollSyncCleanup = null;

  /** Total de columnes (subdivisions) per a la fracció actual. */
  function totalColumns() {
    const { lg, numerator, denominator } = getFraction();
    return getTotalSubdivisions(lg, numerator, denominator);
  }

  // ========== TIMELINE FRACCIONÀRIA ==========

  /**
   * Renderitza la fila de numeració fraccionària sobre la graella.
   * Fórmula unificada: posició en polsos = colIdx*n/d; el pols és enter
   * quan (colIdx*n) % d === 0. Per a n=1 això es redueix exactament a
   * `colIdx % d === 0` (la variant simple d'App32/34 n'és el cas
   * particular — mateix comentari que tenia App33).
   */
  function renderGridTimeline() {
    const elements = getGridElements();
    const container = elements?.timelineContainer;
    if (!container) return;

    const { lg, numerator: n, denominator: d } = getFraction();
    const columns = totalColumns();

    container.innerHTML = '';
    integerLabels.length = 0;
    fractionLabels.length = 0;

    const timelineRow = document.createElement('div');
    timelineRow.className = 'plano-timeline-row';

    for (let colIdx = 0; colIdx < columns; colIdx++) {
      const numEl = document.createElement('div');
      numEl.className = 'plano-timeline-number';
      numEl.dataset.colIndex = colIdx;

      const positionNumerator = colIdx * n;
      const isIntegerPulse = positionNumerator % d === 0;
      const pulseIndex = positionNumerator / d;
      const subdivIndex = colIdx % d;

      const leftPercent = (colIdx / columns) * 100;
      numEl.style.left = `${leftPercent}%`;

      if (isIntegerPulse) {
        numEl.classList.add('plano-cycle-start');
        // Els polsos d'un sol dígit tenen un offset de marca més estret
        // (4px vs 7px) perquè la marca vertical quedi sota el centre del
        // text; els de dos dígits mantenen el default del tema nuzic.
        if (pulseIndex < 10) numEl.classList.add('plano-single-digit');
        numEl.textContent = String(pulseIndex);
        integerLabels[pulseIndex] = numEl;
      } else {
        numEl.classList.add('plano-subdivision');
        numEl.textContent = `.${subdivIndex}`;
        fractionLabels.push(numEl);
      }

      timelineRow.appendChild(numEl);
    }

    // Marcador d'endpoint `·` al final de la timeline (columna `columns`,
    // pols `lg`).
    const endpointEl = document.createElement('div');
    endpointEl.className = 'plano-timeline-number plano-cycle-end';
    endpointEl.dataset.colIndex = columns;
    endpointEl.style.left = '100%';
    endpointEl.textContent = '·';
    timelineRow.appendChild(endpointEl);
    integerLabels[lg] = endpointEl;

    container.appendChild(timelineRow);

    // Label "n/d" a la cantonada inferior-esquerra del `.plano-container`
    // (zona del triangle groc). El parent és el `.plano-container`, no el
    // timeline-container.
    const planoContainer = elements?.container;
    if (planoContainer) {
      let subdivisionLabel = planoContainer.querySelector('.plano-subdivision-label');
      if (!subdivisionLabel) {
        subdivisionLabel = document.createElement('div');
        subdivisionLabel.className = 'plano-subdivision-label';
        planoContainer.appendChild(subdivisionLabel);
      }
      subdivisionLabel.textContent = `${n}/${d}`;
    }
  }

  // ========== AMPLADA DE CEL·LA ==========

  /**
   * Amb columnSizing='fr' la graella ocupa tot l'espai horitzontal, així que
   * l'amplada de cel·la és dinàmica i s'ha de llegir del DOM després del
   * render (no es pot calcular per endavant). Retorna 40 com a fallback
   * abans del primer render.
   */
  function refreshCellWidth() {
    const elements = getGridElements();
    const matrix = elements?.matrixContainer?.querySelector('.plano-matrix');
    const firstCell = matrix?.querySelector('.plano-cell');
    cachedCellWidth = firstCell?.offsetWidth || 40;
    return cachedCellWidth;
  }

  function getCellWidth() {
    return cachedCellWidth;
  }

  // ========== SCROLL SYNC ==========

  function syncGridScrolls() {
    const elements = getGridElements();
    const matrix = elements?.matrixContainer;
    const timeline = elements?.timelineContainer;
    const soundline = elements?.soundlineContainer;
    // Netejar el sync anterior abans de re-enganxar: sense això, cada
    // renderGrid acumulava listeners duplicats (innocu perquè els handlers
    // són assignacions idempotents, però creixent).
    if (scrollSyncCleanup) {
      scrollSyncCleanup();
      scrollSyncCleanup = null;
    }
    if (matrix) scrollSyncCleanup = setupScrollSync(matrix, soundline, timeline);
  }

  // ========== INFO DISPLAYS ==========

  /**
   * Actualitza els displays d'informació (iT disponibles i suma iT).
   * - Suma iT: total de columnes ocupades (suma de durades de totes les notes)
   * - iT Disponibles: columnes lliures (total - ocupades)
   */
  function updateInfoDisplays() {
    const columns = totalColumns();
    const notes = getNotes();
    const usedColumns = notes.reduce((sum, n) => sum + n.duration, 0);
    const available = columns - usedColumns;

    const displays = getInfoDisplays();
    if (displays?.available) {
      displays.available.value = String(available);
    }
    if (displays?.sum) {
      displays.sum.value = String(usedColumns);
    }
  }

  // ========== DRAG HANDLERS (np-dots) ==========

  /**
   * np-dots a la línia de divisió de cada cel·la (estil App15): són els
   * HANDLES de grab. updateMatrix recrea les cel·les a cada renderGrid →
   * cal re-injectar-los. Idempotent (guard per cel·la).
   */
  function injectNpDots() {
    const elements = getGridElements();
    const matrix = elements?.matrixContainer?.querySelector('.plano-matrix');
    if (!matrix) return;
    matrix.querySelectorAll('.plano-cell').forEach(cell => {
      if (cell.querySelector('.np-dot')) return;
      const dot = document.createElement('div');
      dot.className = 'np-dot np-dot-clickable';
      cell.appendChild(dot);
    });
  }

  function attachGridDragHandlers() {
    // ORDRE LOAD-BEARING (A-17): injectNpDots() SEMPRE PRIMER — s'executa
    // a CADA crida perquè re-injecta els np-dots que updateMatrix acaba de
    // destruir. El guard de sota només protegeix la delegació d'events al
    // matrixContainer, que persisteix entre renders (no cal re-adjuntar-la).
    injectNpDots();
    if (delegationAttached) return;
    delegationAttached = true;

    const elements = getGridElements();
    const container = elements?.matrixContainer;
    if (!container) return;

    // Delegació al container (persisteix als updateMatrix). El drag NOMÉS
    // s'inicia agafant un np-dot (substitueix el drag des del cos de la
    // cel·la, estil App15).
    container.addEventListener('mousedown', handleGridDragStart);
    container.addEventListener('touchstart', handleGridDragStart, { passive: false });

    document.addEventListener('mousemove', handleGridDragMove);
    document.addEventListener('mouseup', handleGridDragEnd);
    document.addEventListener('touchmove', handleGridDragMove, { passive: false });
    document.addEventListener('touchend', handleGridDragEnd);
  }

  function handleGridDragStart(e) {
    // Grab només des d'un np-dot. (Eliminar una nota: clic al note-bar →
    // removeNote, ja cablejat a renderNoteBars; aquí el grab sempre crea.)
    const dot = e.target.closest?.('.np-dot');
    if (!dot) return;
    const cell = dot.closest('.plano-cell');
    if (!cell) return;

    e.preventDefault();

    const note = parseInt(cell.dataset.note, 10);
    const colIndex = parseInt(cell.dataset.colIndex, 10);

    const maxTotal = totalColumns();
    if (colIndex >= maxTotal) return;

    dragState = {
      active: true,
      note: note,
      startSubdiv: colIndex,
      currentSubdiv: colIndex,
      maxSubdiv: maxTotal - 1,
      previewBar: null
    };

    document.body.classList.add('dragging-note');
    createGridPreviewBar();
    updateGridPreviewBar();
  }

  function handleGridDragMove(e) {
    if (!dragState.active || dragState.note === undefined) return;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;

    // Mesurar sobre .plano-matrix (NO matrixContainer): el marge i el
    // scroll ja hi són incorporats. Mesurar sobre el container extern
    // provocava un offset fraccional de columna que esdevenia una columna
    // sencera en viewports petits.
    const elements = getGridElements();
    const matrix = elements?.matrixContainer?.querySelector('.plano-matrix');
    if (!matrix) return;

    const rect = matrix.getBoundingClientRect();
    const relX = clientX - rect.left;
    // Ample de cel·la EXACTE (no l'offsetWidth arrodonit) per encertar la columna.
    const exactCellWidth = rect.width / totalColumns();
    const colIndex = Math.floor(relX / exactCellWidth);

    const newSubdiv = Math.max(dragState.startSubdiv, Math.min(dragState.maxSubdiv, colIndex));

    if (newSubdiv !== dragState.currentSubdiv) {
      dragState.currentSubdiv = newSubdiv;
      updateGridPreviewBar();
    }
  }

  function handleGridDragEnd() {
    if (!dragState.active || dragState.note === undefined) return;

    const duration = dragState.currentSubdiv - dragState.startSubdiv + 1;

    document.body.classList.remove('dragging-note');
    if (dragState.previewBar) {
      dragState.previewBar.remove();
      dragState.previewBar = null;
    }

    if (duration >= 1) {
      const noteData = {
        note: dragState.note,
        startSubdiv: dragState.startSubdiv,
        duration
      };
      onNoteCreated(noteData);

      // Reproduir el so de previsualització en crear la nota.
      playNotePreview(noteData);
    }

    dragState.active = false;
    dragState.note = undefined;
  }

  function createGridPreviewBar() {
    if (dragState.previewBar) return;

    const elements = getGridElements();
    const matrix = elements?.matrixContainer?.querySelector('.plano-matrix');
    if (!matrix) return;

    const bar = document.createElement('div');
    bar.className = 'note-bar-preview';
    matrix.appendChild(bar);
    dragState.previewBar = bar;
  }

  function updateGridPreviewBar() {
    if (!dragState.previewBar) return;

    const elements = getGridElements();
    // Llegir l'alçada real de cel·la del DOM (var(--plano-cell-height)
    // s'encongeix en viewports petits).
    const firstCell = elements?.matrixContainer?.querySelector('.plano-cell');
    const cellHeight = firstCell?.offsetHeight || 32;
    const rowIndex = (noteCount - 1) - dragState.note;
    const columns = totalColumns();
    const startPct = (dragState.startSubdiv / columns) * 100;
    const widthPct = ((dragState.currentSubdiv - dragState.startSubdiv + 1) / columns) * 100;
    const barHeight = cellHeight - 2;
    const top = (rowIndex + 1) * cellHeight - barHeight / 2; // Centrat sobre la línia de divisió

    dragState.previewBar.style.left = `${startPct}%`;
    dragState.previewBar.style.width = `${widthPct}%`;
    dragState.previewBar.style.top = `${top}px`;
    dragState.previewBar.style.height = `${barHeight}px`;
  }

  // ========== PREVIEW D'ÀUDIO ==========

  /**
   * Reprodueix un so de previsualització en crear una nota.
   *
   * Invariant 3 (Tone→gest→start): `initAudio` és l'INICIALITZADOR, mai una
   * instància — es crida AQUÍ DINS, en el mateix gest d'usuari (drag-end)
   * que ha disparat aquesta funció. Capturar una instància d'àudio a la
   * creació de la factory trencaria el desbloqueig de l'AudioContext.
   */
  async function playNotePreview(noteData) {
    const audioInstance = await initAudio();
    if (!audioInstance) return;

    const { numerator: n, denominator: d } = getFraction();
    const bpm = getBpm();
    const beatDuration = 60 / bpm;
    const durationPulses = noteData.duration * n / d;
    const durationSeconds = Math.min(durationPulses * beatDuration, previewMaxSeconds);

    const midiNote = baseMidi + noteData.note;

    // Reproduir la nota immediatament (time=0 = "ara").
    audioInstance.playNote(midiNote, durationSeconds, 0);
  }

  // ========== ACCÉS ALS LABELS (highlight de playback) ==========

  function getIntegerLabels() {
    return integerLabels;
  }

  function getFractionLabels() {
    return fractionLabels;
  }

  // ========== DESTRUCCIÓ ==========

  function destroy() {
    const elements = getGridElements();
    const container = elements?.matrixContainer;
    if (container) {
      container.removeEventListener('mousedown', handleGridDragStart);
      container.removeEventListener('touchstart', handleGridDragStart);
    }
    document.removeEventListener('mousemove', handleGridDragMove);
    document.removeEventListener('mouseup', handleGridDragEnd);
    document.removeEventListener('touchmove', handleGridDragMove);
    document.removeEventListener('touchend', handleGridDragEnd);

    if (scrollSyncCleanup) {
      scrollSyncCleanup();
      scrollSyncCleanup = null;
    }
    delegationAttached = false;
  }

  return {
    renderGridTimeline,
    attachGridDragHandlers,
    injectNpDots,
    refreshCellWidth,
    getCellWidth,
    syncGridScrolls,
    updateInfoDisplays,
    playNotePreview,
    getIntegerLabels,
    getFractionLabels,
    destroy
  };
}
