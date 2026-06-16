import { createRhythmStaff } from './rhythm-staff.js';
import { durationValueFromDenominator, buildPulseEvents } from './utils.js';
import { resolveFractionNotation } from './fraction-notation.js';

/**
 * Factory function to create a notation renderer controller for App4.
 * Encapsulates all logic for building, rendering, and interacting with VexFlow notation.
 *
 * F6: la notació d'App4 passa a ser MULTI-FRACCIÓ. En comptes d'una sola veu
 * sobre un pentagrama, s'orquestren N renders independents de createRhythmStaff
 * apilats verticalment: un pentagrama base "Pols" (enters, en fosc) + un
 * pentagrama per fracció ACTIVA, cadascun amb el color d'identitat de la seva
 * fracció (F1 groc, F2 rosa, F3 blau) i la SEVA (n,d). Així cada fracció es
 * llegeix neta encara amb tuplets incommensurables (3 vs 5 vs 7) i la lògica
 * fràgil de remainder/tuplet d'una sola fracció de rhythm-staff queda
 * INTACTA — només s'invoca N vegades.
 *
 * Si `getActiveFractions` NO es passa, es manté el comportament d'una sola
 * fracció via `getFraction()` (back-compat per a qualsevol consumidor antic).
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
  // F6: una llista de pentagrames (un controller de createRhythmStaff per
  // entrada) en lloc d'un sol renderer. Clau = id estable del pentagrama
  // ('base' o l'id del slot de la fracció). Cada entrada té el seu sub-div
  // dins notationContentEl (amb etiqueta HTML acolorida) i el seu controller.
  const staves = new Map(); // staffId -> { wrapper, host, labelEl, controller, fraction }
  const hasMultiFraction = typeof getActiveFractions === 'function';

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
   * Renders notation if the panel is open (or force=true).
   * Diffeja la llista de pentagrames vius vs la desitjada: crea els nous,
   * destrueix els que ja no hi són i reordena el DOM a l'ordre desitjat.
   */
  function renderIfVisible({ force = false, isPlaying = false } = {}) {
    if (!notationContentEl) return;
    if (!notationPanelController) return;
    if (!force && !notationPanelController.isOpen) return;

    const states = buildNotationRenderStates();

    if (!states || !states.length) {
      // Lg invàlid: buida tots els pentagrames existents (en deixa l'esquelet
      // perquè el proper render vàlid els reompli sense recrear el DOM).
      staves.forEach((entry) => {
        try { entry.controller.render({ lg: 0, rhythm: [], isPlaying }); } catch {}
      });
      return;
    }

    const desiredIds = states.map((state) => state.staffId);
    const desiredSet = new Set(desiredIds);

    // Amplada compartida per a TOTS els pentagrames: la del que té més
    // events (≈ 56px per event, com el càlcul intern de rhythm-staff). Així
    // la primera i l'última nota queden alineades verticalment entre files.
    const maxEvents = states.reduce(
      (m, s) => Math.max(m, Array.isArray(s.events) ? s.events.length : 0),
      0
    );
    const sharedStaveWidth = Math.max(320, maxEvents * 56);

    // 1. Destruir els pentagrames que ja no es volen.
    Array.from(staves.keys()).forEach((staffId) => {
      if (!desiredSet.has(staffId)) removeStaff(staffId);
    });

    // 2. Crear/actualitzar i renderitzar cada pentagrama desitjat.
    states.forEach((state) => {
      const entry = ensureStaff(state.staffId);
      // Etiqueta HTML acolorida (la (n,d) o "Pulso"). Color d'identitat al
      // text + a una pastilla; sense color = fosc per defecte.
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

    // 3. Reordenar el DOM perquè coincideixi amb desiredIds (ordre F1>F2>F3).
    desiredIds.forEach((staffId) => {
      const entry = staves.get(staffId);
      if (entry && entry.wrapper) {
        notationContentEl.appendChild(entry.wrapper); // re-append = mou al final
      }
    });
  }

  /**
   * Propaga el cursor de playback a TOTS els pentagrames (cada controller
   * converteix la posició en el seu propi índex de pols).
   */
  function updateCursor(currentPulse = 0, isPlaying = false) {
    staves.forEach((entry) => {
      try { entry.controller.updateCursor(currentPulse, isPlaying); } catch {}
    });
  }

  function resetCursor() {
    staves.forEach((entry) => {
      try { entry.controller.resetCursor(); } catch {}
    });
  }

  /**
   * Handles click events on the notation panel (delegat). Determina a quin
   * pentagrama (i quina fracció) pertany el clic via el sub-div pare, i
   * enruta la selecció a la (n,d) correcta.
   */
  function handleClick(event) {
    if (!notationPanelController || !notationPanelController.isOpen) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const noteEl = target.closest('[data-pulse-index]');
    if (!noteEl) return;
    if (noteEl.dataset.nonSelectable === 'true') return;
    const pulseValue = Number.parseFloat(noteEl.dataset.pulseIndex);
    if (!Number.isFinite(pulseValue)) return;
    const lgValue = getLg();
    if (!Number.isFinite(lgValue) || lgValue <= 0) return;
    if (pulseValue <= 0 || pulseValue >= lgValue) return;

    // Quin pentagrama? El sub-div .notation-staff que conté el node.
    const staffEl = target.closest('.notation-staff');
    const staffId = staffEl?.dataset.staffId || null;
    const staffEntry = staffId ? staves.get(staffId) : null;

    // Selecció fraccionada ja existent (té selectionKey): toggle directe.
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

    // Pols enter: sempre va al canal base (memòria de pulsos), independentment
    // del pentagrama on s'ha clicat (els enters pertanyen al pols base).
    if (Number.isInteger(pulseValue)) {
      pulseMemoryApi.ensure(lgValue);
      const pulseMemory = pulseMemoryApi.data;
      const shouldSelect = !pulseMemory[pulseValue];
      onPulseSelected(pulseValue, shouldSelect);
      return;
    }

    // Tick fraccionat nou: la (n,d) ve del pentagrama clicat (multi-fracció)
    // o de getFraction() (back-compat / pentagrama base sense fracció pròpia).
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

  // Setup event listener (delegació única a tot el contenidor de notació).
  if (notationContentEl) {
    notationContentEl.addEventListener('click', handleClick);
  }

  return {
    render: renderIfVisible,
    // getRenderer() retorna el primer controller (compat amb crides que
    // n'esperen un de sol); per al cursor multi-pentagrama, visual-sync ha
    // d'usar updateCursor/resetCursor d'aquest mateix objecte.
    getRenderer: () => {
      const first = staves.values().next();
      return first.done ? null : first.value.controller;
    },
    updateCursor,
    resetCursor,
    // Exposat per a tests i diagnòstic.
    buildNotationRenderStates,
    destroy: () => {
      if (notationContentEl) {
        notationContentEl.removeEventListener('click', handleClick);
      }
      Array.from(staves.keys()).forEach((staffId) => removeStaff(staffId));
    }
  };
}
