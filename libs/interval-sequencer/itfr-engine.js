/**
 * Motor iTfr compartit per a les apps de fraccions amb drag d'intervals
 * sobre la línia de temps (H-21: App30 i App31 eren ~83% idèntiques).
 *
 * El factory posseeix el DOM derivat (barres d'interval + halters, barra de
 * preview del drag, highlights de playback) i tota la interacció de drag;
 * el model (seqüència d'iTs `{start, it, isSilence}` en subdivisions) viu a
 * l'app i s'hi accedeix via getSequence/setSequence + onSequenceChange.
 *
 * Les diferències genuïnes entre apps entren per configuració:
 * - getters de lg/n/d/total (App30: Lg fixa i n=1; App31: lg = n dinàmic
 *   i total = d perquè només hi ha 1 cicle)
 * - isSelectable: App31 exclou els marcadors/polsos `non-selectable`
 *   (selectabilitat de fraccions complexes)
 *
 * Drag amb Pointer Events (ratolí + tàctil + llapis): els listeners de
 * document només viuen mentre dura el drag — abans cada renderTimeline
 * n'apilava un joc permanent — i pointercancel neteja sense fer commit.
 * No cal elementFromPoint: el moviment es calcula amb clientX contra el
 * rect de la línia de temps, no amb e.target.
 */

import { createIntervalLabelBar } from '../shared-ui/interval-label-bar.js';

export function createItfrEngine(config) {
  const {
    timeline,
    colors,
    getLg,
    getNumerator,
    getDenominator,
    getTotalSubdivisions,
    getSequence,
    setSequence,
    isSelectable = () => true,
    onSequenceChange = () => {},
    getEditorCellsHost = () => null
  } = config;

  if (!timeline) throw new Error('createItfrEngine requires a timeline element');

  // Elements de l'última renderTimeline de l'app (es re-vinculen a cada render).
  let pulses = [];
  let cycleMarkers = [];
  let cycleLabels = [];
  let intervalBars = [];
  // P-29: estat del highlight de barres (índex actiu + cel·la encesa)
  let hlLastIdx = -1;
  let hlLastCell = null;

  const dragState = {
    active: false,
    pointerId: null,
    startSubdiv: null,
    currentSubdiv: null,
    maxSubdiv: null,
    previewBar: null
  };

  /** Converteix un índex de subdivisió a posició de timeline (en polsos). */
  function subdivToPosition(subdiv) {
    return subdiv * getNumerator() / getDenominator();
  }

  // ========== BARRES D'INTERVAL ==========

  function updateIntervalBars(previewSequence = null) {
    intervalBars.forEach(bar => bar.remove());
    intervalBars = [];
    hlLastIdx = -1;
    hlLastCell = null;
    timeline.querySelectorAll('.interval-label-bar').forEach(el => el.remove());

    const sequence = previewSequence || getSequence();
    if (sequence.length === 0) return;

    const lg = getLg();
    let colorIndex = 0;

    sequence.forEach((item, idx) => {
      if (item.isSilence) return; // Els silencis deixen l'espai buit

      const startPos = subdivToPosition(item.start);
      const endPos = subdivToPosition(item.start + item.it);
      const startPercent = (startPos / lg) * 100;
      const widthPercent = ((endPos - startPos) / lg) * 100;

      // Barra colorada amunt (sense label dins — el halter porta el número).
      const bar = document.createElement('div');
      bar.className = 'interval-bar-visual';
      bar.dataset.index = idx;
      bar.style.left = `${startPercent}%`;
      bar.style.width = `${widthPercent}%`;
      bar.style.background = colors[colorIndex % colors.length];
      colorIndex++;

      timeline.appendChild(bar);
      intervalBars.push(bar);

      // Halter groc amb el número d'iT, just sota la barra (patró App13).
      const labelBar = createIntervalLabelBar({
        startPercent,
        widthPercent,
        label: item.it
      });
      timeline.appendChild(labelBar);
    });
  }

  // ========== MODEL ==========

  function insertItAtPosition(startSubdiv, newIt) {
    const newEndSubdiv = startSubdiv + newIt;

    // Elimina els iTs que solapen amb el nou
    const sequence = getSequence().filter(item => {
      const itemEnd = item.start + item.it;
      return itemEnd <= startSubdiv || item.start >= newEndSubdiv;
    });

    sequence.push({ start: startSubdiv, it: newIt, isSilence: false });
    sequence.sort((a, b) => a.start - b.start);

    setSequence(sequence);
    onSequenceChange();
  }

  /**
   * Índex de l'iT que comença exactament a un scaledIndex del transport
   * escalat (els starts del model són subdivisions; scaledIndex va en
   * passos d'1/d de pols, així que start × n = scaledIndex). -1 si cap.
   */
  function getItIndexAtScaledStart(scaledIndex) {
    const n = getNumerator();
    const sequence = getSequence();
    for (let i = 0; i < sequence.length; i++) {
      if (sequence[i].start * n === scaledIndex) return i;
    }
    return -1;
  }

  // ========== DRAG ==========

  function bindTimeline(elements = {}) {
    pulses = elements.pulses || [];
    cycleMarkers = elements.cycleMarkers || [];
    cycleLabels = elements.cycleLabels || [];

    cycleMarkers.forEach(marker => {
      if (!isSelectable(marker)) return;
      marker.addEventListener('pointerdown', handleDragStartFromMarker);
      marker.style.touchAction = 'none';
    });

    // Les etiquetes fraccionàries (".1", ".2") comparteixen el drag amb
    // els marcadors verticals — els dos objectius de selecció són coherents.
    cycleLabels.forEach(label => {
      if (!isSelectable(label)) return;
      label.addEventListener('pointerdown', handleDragStartFromMarker);
      label.style.cursor = 'grab';
      label.style.touchAction = 'none';
    });

    // Polsos enters (0..lg-1, mai l'endpoint).
    pulses.forEach(pulse => {
      if (!isSelectable(pulse)) return;
      const idx = parseInt(pulse.dataset.index, 10);
      if (idx >= 0 && idx < getLg()) {
        pulse.addEventListener('pointerdown', handleDragStartFromPulse);
        pulse.style.cursor = 'grab';
        pulse.style.touchAction = 'none';
      }
    });
  }

  function handleDragStartFromPulse(e) {
    const idx = parseInt(e.currentTarget.dataset.index, 10);
    // Pols → subdivisió: cada cicle té d subdivisions i abasta n polsos.
    const globalSubdiv = Math.round(idx * getDenominator() / getNumerator());
    startDrag(globalSubdiv, e);
  }

  function handleDragStartFromMarker(e) {
    startDrag(parseInt(e.currentTarget.dataset.globalSubdiv, 10), e);
  }

  function startDrag(startSubdiv, e) {
    if (dragState.active) return;
    e.preventDefault();

    const maxTotal = getTotalSubdivisions();
    if (startSubdiv >= maxTotal) return;

    dragState.active = true;
    dragState.pointerId = e.pointerId ?? null;
    dragState.startSubdiv = startSubdiv;
    dragState.currentSubdiv = startSubdiv;
    dragState.maxSubdiv = maxTotal - 1;

    document.body.classList.add('dragging-it');

    // Ressalta l'origen del drag (marcador fraccionari o pols enter).
    const d = getDenominator();
    const n = getNumerator();
    const startMarker = cycleMarkers.find(m =>
      parseInt(m.dataset.globalSubdiv, 10) === startSubdiv
    ) || pulses.find(p => {
      const idx = parseInt(p.dataset.index, 10);
      return Math.round(idx * d / n) === startSubdiv;
    });
    if (startMarker) startMarker.classList.add('drag-start');

    attachDocumentListeners();
    createPreviewBar();
    updatePreviewBar();
  }

  function handleDragMove(e) {
    if (!dragState.active) return;
    if (dragState.pointerId != null && e.pointerId !== dragState.pointerId) return;

    const rect = timeline.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const posInPulses = pct * getLg();
    const subdiv = Math.round(posInPulses * getDenominator() / getNumerator());

    // L'extrem mai recula per sota de l'inici ni surt de la línia.
    const newSubdiv = Math.max(dragState.startSubdiv, Math.min(dragState.maxSubdiv, subdiv));

    if (newSubdiv !== dragState.currentSubdiv) {
      dragState.currentSubdiv = newSubdiv;
      updatePreviewBar();
      updateDragHighlight();
    }
  }

  function handleDragEnd(e) {
    if (dragState.pointerId != null && e.pointerId !== dragState.pointerId) return;
    finishDrag(true);
  }

  function handleDragCancel(e) {
    if (dragState.pointerId != null && e.pointerId !== dragState.pointerId) return;
    finishDrag(false);
  }

  function finishDrag(commit) {
    if (!dragState.active) return;

    const { startSubdiv, currentSubdiv } = dragState;

    document.body.classList.remove('dragging-it');
    cycleMarkers.forEach(m => m.classList.remove('drag-start', 'drag-range'));
    pulses.forEach(p => p.classList.remove('drag-start', 'drag-range'));

    if (dragState.previewBar) {
      dragState.previewBar.remove();
      dragState.previewBar = null;
    }

    dragState.active = false;
    dragState.pointerId = null;
    detachDocumentListeners();

    if (!commit) return;

    const newIt = currentSubdiv - startSubdiv + 1;
    if (newIt >= 1) insertItAtPosition(startSubdiv, newIt);
  }

  function attachDocumentListeners() {
    document.addEventListener('pointermove', handleDragMove);
    document.addEventListener('pointerup', handleDragEnd);
    document.addEventListener('pointercancel', handleDragCancel);
  }

  function detachDocumentListeners() {
    document.removeEventListener('pointermove', handleDragMove);
    document.removeEventListener('pointerup', handleDragEnd);
    document.removeEventListener('pointercancel', handleDragCancel);
  }

  function createPreviewBar() {
    if (dragState.previewBar) return;
    const bar = document.createElement('div');
    bar.className = 'interval-bar-preview';
    timeline.appendChild(bar);
    dragState.previewBar = bar;
  }

  function updatePreviewBar() {
    if (!dragState.previewBar || !dragState.active) return;

    const startPos = subdivToPosition(dragState.startSubdiv);
    const endPos = subdivToPosition(dragState.currentSubdiv + 1);
    const lg = getLg();

    dragState.previewBar.style.left = `${(startPos / lg) * 100}%`;
    dragState.previewBar.style.width = `${((endPos - startPos) / lg) * 100}%`;
  }

  function updateDragHighlight() {
    cycleMarkers.forEach(m => m.classList.remove('drag-range'));
    if (!dragState.active) return;

    for (let s = dragState.startSubdiv; s <= dragState.currentSubdiv; s++) {
      const marker = cycleMarkers.find(m => parseInt(m.dataset.globalSubdiv, 10) === s);
      if (marker) marker.classList.add('drag-range');
    }
  }

  // ========== HIGHLIGHTS DE PLAYBACK ==========

  function clearHighlights() {
    pulses.forEach(p => p.classList.remove('active'));
    cycleMarkers.forEach(m => m.classList.remove('active'));
    cycleLabels.forEach(l => l.classList.remove('active'));
    intervalBars.forEach(b => b.classList.remove('highlight'));
    const cellsHost = getEditorCellsHost();
    cellsHost?.querySelectorAll('.itfr-value.active').forEach(c => c.classList.remove('active'));
    hlLastIdx = -1;
    hlLastCell = null;
  }

  /**
   * Highlight d'un pols enter — rep el scaledIndex del transport escalat
   * (scaledIndex = polsIndex × d). Les subdivisions les porta highlightCycle.
   * Només visual: l'àudio va pel note provider de l'app.
   */
  function highlightPulse(scaledIndex) {
    const d = getDenominator();
    if (scaledIndex % d !== 0) return;

    const pulseIndex = scaledIndex / d;

    pulses.forEach(p => p.classList.remove('active'));
    const total = pulses.length > 1 ? pulses.length - 1 : 0;
    if (total <= 0) return;

    const normalized = Math.max(0, Math.min(pulseIndex, total));
    const pulse = pulses[normalized];
    if (pulse) {
      void pulse.offsetWidth;
      pulse.classList.add('active');
    }

    highlightBarAtPosition(pulseIndex);
  }

  /** Highlight d'una subdivisió — rep el payload del callback de cicle. */
  function highlightCycle(payload = {}) {
    const cycleIndex = Number(payload.cycleIndex);
    const subdivisionIndex = Number(payload.subdivisionIndex);
    if (!Number.isFinite(cycleIndex) || !Number.isFinite(subdivisionIndex)) return;

    cycleMarkers.forEach(m => m.classList.remove('active'));
    cycleLabels.forEach(l => l.classList.remove('active'));

    const matches = (el) =>
      Number(el.dataset.cycleIndex) === cycleIndex &&
      Number(el.dataset.subdivision) === subdivisionIndex;

    const marker = cycleMarkers.find(matches);
    const label = cycleLabels.find(matches);

    if (marker) {
      void marker.offsetWidth;
      marker.classList.add('active');
    }
    if (label) label.classList.add('active');

    const n = getNumerator();
    const position = cycleIndex * n + subdivisionIndex * n / getDenominator();
    highlightBarAtPosition(position);
  }

  /** Il·lumina la barra d'iT (i la cel·la de l'editor) que conté `position` (en polsos).
   *  P-29: early-return quan l'índex actiu no canvia — el tick de subdivisió
   *  passa a ser matemàtica pura; quan canvia es toquen ≤1 barra i ≤1 cel·la
   *  per referència en lloc d'escombrar barres i editor sencers. */
  function highlightBarAtPosition(position) {
    const sequence = getSequence();

    let activeIdx = -1;
    for (let i = 0; i < sequence.length; i++) {
      const item = sequence[i];
      const startPos = subdivToPosition(item.start);
      const endPos = subdivToPosition(item.start + item.it);
      if (position >= startPos && position < endPos) {
        activeIdx = i;
        break;
      }
    }

    if (activeIdx === hlLastIdx) return;

    if (hlLastIdx >= 0) intervalBars[hlLastIdx]?.classList.remove('highlight');
    hlLastCell?.classList.remove('active');
    hlLastCell = null;

    if (activeIdx >= 0) {
      const bar = intervalBars[activeIdx];
      if (bar) {
        void bar.offsetWidth;
        bar.classList.add('highlight');
      }
      // Durant play, la cel·la activa de l'editor iTfr s'omple (patró App28).
      const cellsHost = getEditorCellsHost();
      const cell = cellsHost?.querySelector(`.itfr-value[data-entry-index="${activeIdx}"]`);
      if (cell) {
        cell.classList.add('active');
        hlLastCell = cell;
      }
    }
    hlLastIdx = activeIdx;
  }

  return {
    bindTimeline,
    updateIntervalBars,
    insertItAtPosition,
    getItIndexAtScaledStart,
    clearHighlights,
    highlightPulse,
    highlightCycle,
    isDragging: () => dragState.active
  };
}
