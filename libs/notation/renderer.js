import { createRhythmStaff } from './rhythm-staff.js';
import { createNotationSystem } from './notation-system.js';
import { durationValueFromDenominator, buildPulseEvents } from './utils.js';
import { resolveFractionNotation } from './fraction-notation.js';

/**
 * Factory function to create a notation renderer controller for App4.
 * Encapsulates all logic for building, rendering, and interacting with VexFlow notation.
 *
 * F6.scroll: la notació MULTI-FRACCIÓ d'App4 passa a un SISTEMA de pentagrames
 * apilats dins d'UN SOL SVG amb UN SOL Formatter (libs/notation/notation-system.js).
 * El Formatter compartit alinea els cops simultanis per TEMPS (els TickContext
 * indexats per tick són compartits entre pentagrames) → scroll horitzontal únic
 * i un sol playhead vertical que travessa tot el sistema. Substitueix
 * l'orquestració F6 de N renders independents de createRhythmStaff (un SVG i un
 * formatter per pentagrama → cops NO alineats i N scrolls).
 *
 * El pentagrama base "Pulso" (enters, en fosc) és l'ÀNCORA; un pentagrama per
 * fracció ACTIVA amb el color del seu slot (F1 groc, F2 rosa, F3 blau) i la SEVA
 * (n,d). Model net d'App4 (Lg múltiple del cicle de cada fracció) → tuplets
 * uniformes per cicle, mai remainder.
 *
 * Si `getActiveFractions` NO es passa, es manté el comportament d'una sola
 * fracció via `getFraction()` amb createRhythmStaff (back-compat App2/App5 i
 * qualsevol consumidor antic — rhythm-staff queda INTACTE).
 *
 * @param {Object} config - Configuration object
 * @param {HTMLElement} config.notationContentEl - Container element for notation rendering
 * @param {Object} config.notationPanelController - Panel controller with `isOpen` property
 * @param {Function} config.getFraction - Function returning { numerator, denominator }
 * @param {Function} [config.getActiveFractions] - Returns [{ id, numerator, denominator, color, lightColor }, ...]
 * @param {Function} config.getLg - Function returning current Lg value
 * @param {Object} config.fractionStore - Store with `pulseSelections` and `selectionState`
 * @param {Object} config.pulseMemoryApi - Pulse memory API with `data` array and `ensure` method
 * @param {Function} config.createFractionSelectionFromValue - Factory for creating fraction selections
 * @param {Function} config.onPulseSelected - Callback (pulseValue, shouldSelect) => void
 * @param {Function} config.onFractionSelected - Callback (info, shouldSelect) => void
 * @returns {Object} Controller with render(), getRenderer(), updateCursor(), resetCursor(), destroy() methods
 */
export function createNotationRenderer({
  notationContentEl,
  notationPanelController,
  getFraction,
  getActiveFractions,
  getLg,
  fractionStore,
  pulseMemoryApi,
  createFractionSelectionFromValue,
  onPulseSelected,
  onFractionSelected
}) {
  const hasMultiFraction = typeof getActiveFractions === 'function';

  // Back-compat (single, sense getActiveFractions): una llista de pentagrames
  // (un controller de createRhythmStaff per entrada). Clau = id estable. Cada
  // entrada té el seu sub-div dins notationContentEl + el seu controller.
  // NOMÉS s'usa al camí single; el camí multi-fracció usa el sistema (un SVG).
  const staves = new Map(); // staffId -> { wrapper, host, labelEl, controller, fraction }

  // F6.scroll: en multi-fracció, UN sol sistema de pentagrames (un SVG, un
  // Formatter). Es crea lazy al primer render i s'allotja directament a
  // notationContentEl (sense sub-divs per pentagrama).
  let notationSystem = null;

  /**
   * Infers the notation denominator from Lg and current fraction.
   * Used as fallback for duration calculation when fraction doesn't specify denominator.
   */
  function inferNotationDenominator(lgValue, fraction) {
    if (fraction && Number.isFinite(fraction.denominator) && fraction.denominator > 0) {
      return Math.max(1, Math.round(fraction.denominator));
    }
    if (!Number.isFinite(lgValue) || lgValue <= 0) return 4;
    return Math.max(2, Math.round(lgValue));
  }

  /**
   * Conjunt de pulsos enters seleccionats (1..lg-1) segons la memòria.
   */
  function collectBaseSelected(lgValue) {
    pulseMemoryApi.ensure(lgValue);
    const pulseMemory = pulseMemoryApi.data;
    const baseSelected = new Set();
    const maxIdx = Math.min(pulseMemory.length - 1, lgValue - 1);
    for (let i = 1; i <= maxIdx; i++) {
      if (pulseMemory[i]) baseSelected.add(i);
    }
    return baseSelected;
  }

  /**
   * Filtra les seleccions fraccionades del store que pertanyen a la graella
   * LITERAL d'una fracció (mateixa regla que selectionChannelForFraction
   * d'App4: pulsesPerCycle = n del slot, denominator = d del slot; 2/4 NO
   * casa amb 1/2). Quan no es passa fracció (back-compat single), retorna
   * TOTES les seleccions.
   */
  function fractionSelectionsFor(fraction) {
    const all = Array.isArray(fractionStore.pulseSelections) ? fractionStore.pulseSelections : [];
    if (!fraction) return all;
    const den = Number(fraction.denominator);
    const num = Number(fraction.numerator);
    return all.filter((item) => {
      if (!item || !item.key) return false;
      const itemDen = Number(item.denominator);
      if (!(Number.isFinite(itemDen) && itemDen === den)) return false;
      const itemNum = Number.isFinite(item.pulsesPerCycle) && item.pulsesPerCycle > 0
        ? Number(item.pulsesPerCycle)
        : null;
      return itemNum == null || itemNum === num;
    });
  }

  /**
   * Construeix l'estat d'un pentagrama de fracció (o de la fracció única en
   * back-compat). És EXACTAMENT el camí d'una sola fracció d'abans: events de
   * buildPulseEvents amb la (n,d) d'aquesta fracció i les seves seleccions.
   *
   * @param {number} lgValue
   * @param {Object|null} fraction - { numerator, denominator } o null
   * @param {Set<number>} baseSelected - enters seleccionats (capa d'enters)
   * @param {string|null} color - color d'identitat (null = negre)
   */
  function buildFractionStaffState(lgValue, fraction, baseSelected, color = null) {
    const validFraction = (fraction
      && Number.isFinite(fraction.numerator) && fraction.numerator > 0
      && Number.isFinite(fraction.denominator) && fraction.denominator > 0)
      ? { numerator: Math.floor(fraction.numerator), denominator: Math.floor(fraction.denominator) }
      : null;
    const fractionNotation = validFraction
      ? resolveFractionNotation(validFraction.numerator, validFraction.denominator)
      : null;
    const normalizedFraction = validFraction ? { ...validFraction, notation: fractionNotation } : null;

    const denominatorValue = inferNotationDenominator(lgValue, validFraction);
    let baseDuration = fractionNotation?.duration
      ?? durationValueFromDenominator(denominatorValue);
    let baseDots = Number.isFinite(fractionNotation?.dots) ? Math.max(0, Math.floor(fractionNotation.dots)) : 0;
    const fractionNumeratorValue = validFraction ? validFraction.numerator : null;
    const fractionDenominatorValue = validFraction ? validFraction.denominator : null;
    if (fractionNumeratorValue && fractionDenominatorValue && fractionNumeratorValue === fractionDenominatorValue) {
      baseDuration = 'q';
      baseDots = 0;
    }

    const selectedValues = new Set([0]);
    baseSelected.forEach((value) => selectedValues.add(value));

    const fractionSelections = fractionSelectionsFor(validFraction);
    const fractionalEvents = [];
    fractionSelections.forEach((item) => {
      if (!item || !item.key) return;
      const value = Number(item.value);
      if (!Number.isFinite(value) || value <= 0 || value >= lgValue) return;
      const itemDenominator = Number.isFinite(item.denominator) && item.denominator > 0
        ? Math.round(item.denominator)
        : denominatorValue;
      const notationInfo = resolveFractionNotation(item.numerator, itemDenominator);
      fractionalEvents.push({
        pulseIndex: value,
        duration: notationInfo.duration,
        rest: false,
        selectionKey: item.key,
        source: 'fraction',
        dots: notationInfo.dots || 0
      });
      selectedValues.add(value);
    });

    const events = buildPulseEvents({
      lg: lgValue,
      selectedSet: baseSelected,
      duration: baseDuration,
      dots: baseDots,
      fractionalSelections: fractionalEvents,
      numerator: fractionNumeratorValue,
      denominator: fractionDenominatorValue
    });

    events.sort((a, b) => a.pulseIndex - b.pulseIndex);
    const positions = events.map((event) => event.pulseIndex);
    const selectedIndices = Array.from(selectedValues).sort((a, b) => a - b);

    return {
      lg: lgValue,
      fraction: normalizedFraction,
      // numerator/denominator plans per al sistema de pentagrames (F6.scroll):
      // la graella de subdivisions i el tuplet per cicle es deriven d'aquí.
      numerator: fractionNumeratorValue,
      denominator: fractionDenominatorValue,
      isBase: false,
      events,
      positions,
      selectedIndices,
      color: color || null,
      pulseFilter: 'all'
    };
  }

  /**
   * Construeix l'estat del pentagrama base "Pols" (només enters; en fosc).
   * Els enters seleccionats són notes, la resta silencis. Sense fracció ni
   * tuplets: és la referència neta de la graella d'enters.
   */
  function buildBaseStaffState(lgValue, baseSelected) {
    const events = buildPulseEvents({
      lg: lgValue,
      selectedSet: baseSelected,
      duration: 'q',
      dots: 0,
      // numerator: 1 → CADA enter és posició de graella (nota si seleccionat,
      // SILENCI si no). Sense numerador, buildPulseEvents només emetria els
      // enters seleccionats i el pentagrama base es quedava sense silencis.
      numerator: 1,
      denominator: 1
    });
    events.sort((a, b) => a.pulseIndex - b.pulseIndex);
    const positions = events.map((event) => event.pulseIndex);
    const selectedIndices = [0, ...Array.from(baseSelected)].sort((a, b) => a - b);
    return {
      lg: lgValue,
      fraction: null,
      numerator: 1,
      denominator: 1,
      isBase: true,
      events,
      positions,
      selectedIndices,
      color: null,
      pulseFilter: 'whole'
    };
  }

  /**
   * Llista d'estats a renderitzar, un per pentagrama:
   *   - amb getActiveFractions: [base, ...una per fracció activa]
   *   - sense (back-compat): [una sola fracció via getFraction()]
   * Cada estat duu un `staffId` estable i (per a fraccions) `label`/`color`.
   *
   * @returns {Array<Object>|null} llista d'estats o null si Lg invàlid
   */
  function buildNotationRenderStates() {
    const lgValue = getLg();
    if (!Number.isFinite(lgValue) || lgValue <= 0) {
      return null;
    }
    const baseSelected = collectBaseSelected(lgValue);

    if (!hasMultiFraction) {
      // Back-compat: una sola fracció (comportament històric d'aquest factory).
      const fractionInfo = typeof getFraction === 'function' ? getFraction() : null;
      const state = buildFractionStaffState(lgValue, fractionInfo, baseSelected, null);
      state.staffId = 'single';
      state.label = null;
      return [state];
    }

    const active = getActiveFractions() || [];
    const states = [];

    // Pentagrama base "Pols" (sempre present mentre Lg sigui vàlid).
    const baseState = buildBaseStaffState(lgValue, baseSelected);
    baseState.staffId = 'base';
    baseState.label = 'Pulso';
    baseState.labelColor = null;
    states.push(baseState);

    // Un pentagrama per fracció activa, en l'ordre F1>F2>F3.
    active.forEach((fraction) => {
      if (!fraction
        || !Number.isFinite(fraction.numerator) || fraction.numerator <= 0
        || !Number.isFinite(fraction.denominator) || fraction.denominator <= 0) {
        return;
      }
      const state = buildFractionStaffState(
        lgValue,
        { numerator: fraction.numerator, denominator: fraction.denominator },
        baseSelected,
        fraction.color || null
      );
      state.staffId = String(fraction.id);
      state.label = `${Math.floor(fraction.numerator)}/${Math.floor(fraction.denominator)}`;
      state.labelColor = fraction.color || null;
      states.push(state);
    });

    return states;
  }

  /**
   * Crea (lazy) el sub-div + controller d'un pentagrama i el registra.
   */
  function ensureStaff(staffId) {
    let entry = staves.get(staffId);
    if (entry) return entry;

    const wrapper = document.createElement('div');
    wrapper.className = 'notation-staff';
    wrapper.dataset.staffId = staffId;

    const labelEl = document.createElement('span');
    labelEl.className = 'notation-staff__label';
    wrapper.appendChild(labelEl);

    const host = document.createElement('div');
    host.className = 'notation-staff__host';
    wrapper.appendChild(host);

    notationContentEl.appendChild(wrapper);

    const controller = createRhythmStaff({
      container: host,
      pulseFilter: 'all'
    });

    entry = { wrapper, host, labelEl, controller, fraction: null };
    staves.set(staffId, entry);
    return entry;
  }

  /**
   * Destrueix i treu del DOM un pentagrama.
   */
  function removeStaff(staffId) {
    const entry = staves.get(staffId);
    if (!entry) return;
    try { entry.controller.destroy(); } catch {}
    if (entry.wrapper && entry.wrapper.parentElement) {
      entry.wrapper.parentElement.removeChild(entry.wrapper);
    }
    staves.delete(staffId);
  }

  /**
   * F6.scroll: crea (lazy) el sistema de pentagrames (un SVG, un Formatter).
   * El sistema posseeix la seva pròpia delegació de clic i el seu cursor; les
   * seleccions disparen un re-render de la notació via els callbacks embolcallats.
   */
  function ensureNotationSystem() {
    if (notationSystem) return notationSystem;
    notationSystem = createNotationSystem({
      container: notationContentEl,
      // Embolcalls: criden el callback d'App4 i després re-renderitzen la
      // notació (com feia l'antic handleClick amb renderIfVisible({force:true})).
      onPulseSelected: (pulseValue) => {
        const lgValue = getLg();
        if (!Number.isFinite(lgValue) || lgValue <= 0) return;
        if (pulseValue <= 0 || pulseValue >= lgValue) return;
        pulseMemoryApi.ensure(lgValue);
        const pulseMemory = pulseMemoryApi.data;
        const shouldSelect = !pulseMemory[pulseValue];
        onPulseSelected(pulseValue, shouldSelect);
        renderIfVisible({ force: true });
      },
      onFractionSelected: (info, shouldSelect) => {
        onFractionSelected(info, shouldSelect);
        renderIfVisible({ force: true });
      },
      createFractionSelectionFromValue,
      fractionStore
    });
    return notationSystem;
  }

  /**
   * Renders notation if the panel is open (or force=true).
   *
   * Multi-fracció (F6.scroll): UN sistema de pentagrames (un SVG, un Formatter
   * compartit → cops simultanis alineats per temps, scroll/playhead únics).
   * Single (back-compat): orquestració de createRhythmStaff (rhythm-staff INTACTE).
   */
  function renderIfVisible({ force = false, isPlaying = false } = {}) {
    if (!notationContentEl) return;
    if (!notationPanelController) return;
    if (!force && !notationPanelController.isOpen) return;

    const states = buildNotationRenderStates();

    // ── Camí MULTI-FRACCIÓ: sistema de pentagrames (un SVG) ──
    if (hasMultiFraction) {
      const system = ensureNotationSystem();
      if (!states || !states.length) {
        system.render({ lg: 0, staves: [] }); // Lg invàlid → SVG buit + cursor amagat
        return;
      }
      const systemStaves = states.map((state) => ({
        id: state.staffId,
        label: state.label || '',
        color: state.color || null,
        numerator: state.numerator,
        denominator: state.denominator,
        events: state.events,
        selectedIndices: state.selectedIndices,
        isBase: !!state.isBase
      }));
      system.render({ lg: states[0].lg, staves: systemStaves });
      // El cursor es reposiciona dins de system.render (resetCursor); si estem
      // reproduint, visual-sync el continuarà movent per temps.
      return;
    }

    // ── Camí SINGLE (back-compat): createRhythmStaff per pentagrama ──
    if (!states || !states.length) {
      staves.forEach((entry) => {
        try { entry.controller.render({ lg: 0, rhythm: [], isPlaying }); } catch {}
      });
      return;
    }

    const desiredIds = states.map((state) => state.staffId);
    const desiredSet = new Set(desiredIds);
    const maxEvents = states.reduce(
      (m, s) => Math.max(m, Array.isArray(s.events) ? s.events.length : 0),
      0
    );
    const sharedStaveWidth = Math.max(320, maxEvents * 56);

    Array.from(staves.keys()).forEach((staffId) => {
      if (!desiredSet.has(staffId)) removeStaff(staffId);
    });

    states.forEach((state) => {
      const entry = ensureStaff(state.staffId);
      if (entry.labelEl) {
        entry.labelEl.textContent = state.label || '';
        entry.labelEl.style.display = state.label ? '' : 'none';
        if (state.labelColor) {
          entry.labelEl.style.color = state.labelColor;
          entry.labelEl.style.borderColor = state.labelColor;
          entry.wrapper.style.setProperty('--notation-staff-color', state.labelColor);
        } else {
          entry.labelEl.style.removeProperty('color');
          entry.labelEl.style.removeProperty('border-color');
          entry.wrapper.style.removeProperty('--notation-staff-color');
        }
      }
      entry.fraction = state.fraction;
      entry.controller.render({
        lg: state.lg,
        selectedIndices: state.selectedIndices,
        fraction: state.fraction,
        positions: state.positions,
        rhythm: state.events,
        color: state.color,
        pulseFilter: state.pulseFilter,
        staveWidth: sharedStaveWidth,
        isPlaying
      });
    });

    desiredIds.forEach((staffId) => {
      const entry = staves.get(staffId);
      if (entry && entry.wrapper) {
        notationContentEl.appendChild(entry.wrapper);
      }
    });
  }

  /**
   * Cursor de playback. Multi-fracció: UN cursor que travessa el sistema, mogut
   * per TEMPS. Single: fan-out a cada controller de rhythm-staff.
   */
  function updateCursor(currentPulse = 0, isPlaying = false) {
    if (hasMultiFraction) {
      if (notationSystem) {
        try { notationSystem.updateCursor(currentPulse, isPlaying); } catch {}
      }
      return;
    }
    staves.forEach((entry) => {
      try { entry.controller.updateCursor(currentPulse, isPlaying); } catch {}
    });
  }

  function resetCursor() {
    if (hasMultiFraction) {
      if (notationSystem) {
        try { notationSystem.resetCursor(); } catch {}
      }
      return;
    }
    staves.forEach((entry) => {
      try { entry.controller.resetCursor(); } catch {}
    });
  }

  /**
   * Clic per al camí SINGLE (back-compat). En multi-fracció, el sistema gestiona
   * la seva pròpia delegació de clic; aquest listener NO s'hi afegeix.
   * Determina a quin pentagrama (i quina fracció) pertany el clic via el sub-div
   * pare i enruta la selecció a la (n,d) correcta.
   */
  function handleClick(event) {
    if (!notationPanelController || !notationPanelController.isOpen) return;
    const target = event && event.target;
    if (!target || typeof target.closest !== 'function') return;
    const noteEl = target.closest('[data-pulse-index]');
    if (!noteEl) return;
    if (noteEl.dataset.nonSelectable === 'true') return;
    const pulseValue = Number.parseFloat(noteEl.dataset.pulseIndex);
    if (!Number.isFinite(pulseValue)) return;
    const lgValue = getLg();
    if (!Number.isFinite(lgValue) || lgValue <= 0) return;
    if (pulseValue <= 0 || pulseValue >= lgValue) return;

    const staffEl = target.closest('.notation-staff');
    const staffId = staffEl?.dataset.staffId || null;
    const staffEntry = staffId ? staves.get(staffId) : null;

    const selectionKey = noteEl.dataset.selectionKey;
    if (selectionKey) {
      const info = fractionStore.selectionState.get(selectionKey);
      if (info) {
        const currentlySelected = fractionStore.selectionState.has(selectionKey);
        onFractionSelected(info, !currentlySelected);
        renderIfVisible({ force: true });
      }
      return;
    }

    if (Number.isInteger(pulseValue)) {
      pulseMemoryApi.ensure(lgValue);
      const pulseMemory = pulseMemoryApi.data;
      const shouldSelect = !pulseMemory[pulseValue];
      onPulseSelected(pulseValue, shouldSelect);
      return;
    }

    const fraction = staffEntry?.fraction
      || (typeof getFraction === 'function' ? getFraction() : null);
    const denominator = Number(fraction?.denominator);
    const denominatorValue = Number.isFinite(denominator) && denominator > 0 ? Math.round(denominator) : null;
    if (!denominatorValue) return;
    const numerator = Number(fraction?.numerator);
    const pulsesPerCycle = Number.isFinite(numerator) && numerator > 0 ? numerator : null;
    const nextSelection = createFractionSelectionFromValue(pulseValue, {
      denominator: denominatorValue,
      pulsesPerCycle
    });
    if (!nextSelection) return;
    if (nextSelection.value <= 0 || nextSelection.value >= lgValue) return;
    const currentlySelected = fractionStore.selectionState.has(nextSelection.key);
    onFractionSelected(nextSelection, !currentlySelected);
  }

  // El listener de clic per delegació NOMÉS s'afegeix al camí single; en
  // multi-fracció el sistema té el seu propi listener sobre el mateix SVG.
  if (notationContentEl && !hasMultiFraction) {
    notationContentEl.addEventListener('click', handleClick);
  }

  return {
    render: renderIfVisible,
    // getRenderer(): en single retorna el primer controller (compat); en
    // multi-fracció retorna el sistema (té updateCursor/resetCursor).
    getRenderer: () => {
      if (hasMultiFraction) return notationSystem;
      const first = staves.values().next();
      return first.done ? null : first.value.controller;
    },
    updateCursor,
    resetCursor,
    // Exposat per a tests i diagnòstic.
    buildNotationRenderStates,
    destroy: () => {
      if (notationContentEl && !hasMultiFraction) {
        notationContentEl.removeEventListener('click', handleClick);
      }
      if (notationSystem) {
        try { notationSystem.destroy(); } catch {}
        notationSystem = null;
      }
      Array.from(staves.keys()).forEach((staffId) => removeStaff(staffId));
    }
  };
}
