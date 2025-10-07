/**
 * highlight-controller.js
 *
 * Sistema de highlighting para timeline y pulseSeq.
 * Maneja highlighting de pulsos enteros, fracciones y ciclos.
 */

/**
 * Crea controlador de highlighting
 * @param {object} config
 * @param {Function} config.getPulses - Devuelve array de elementos .pulse
 * @param {Function} config.getCycleMarkers - Devuelve array de marcadores de ciclo
 * @param {Function} [config.getPulseNumberLabels] - Devuelve labels de números de pulso
 * @param {Function} [config.getPulseAnimationDuration] - Calcula duración animación (ms)
 * @param {object} config.fractionStore - Store de fracciones con selectionState
 * @param {object} config.pulseSeqController - Controlador de pulseSeq
 * @param {HTMLElement} [config.pulseSeqEl] - Elemento scrollable del pulseSeq
 * @param {Function} [config.getPulseSeqRectForIndex] - Obtiene rect para índice
 * @param {Function} [config.scrollPulseSeqToRect] - Hace scroll a rect
 * @param {number} [config.epsilon=0.001] - Epsilon para comparación de fracciones
 * @returns {object} - API del controlador
 */
export function createHighlightController({
  getPulses,
  getCycleMarkers,
  getPulseNumberLabels = null,
  getPulseAnimationDuration = null,
  fractionStore,
  pulseSeqController,
  pulseSeqEl = null,
  getPulseSeqRectForIndex = null,
  scrollPulseSeqToRect = null,
  epsilon = 0.001
}) {

  // Estado interno
  const state = {
    pulse: {
      lastType: null,
      lastIntIndex: null,
      lastFractionKey: null,
      lastScrollCache: {
        type: null,
        index: null,
        fractionKey: null,
        trailingIndex: null,
        rect: null,
        trailingRect: null,
        scrollLeft: null
      }
    },
    cycle: {
      activeMarkers: []
    },
    lastNormalizedStep: null,
    lastVisualStep: null,
    currentResolution: 1
  };

  function resolvePulseNumberLabels() {
    if (typeof getPulseNumberLabels !== 'function') return [];
    const labels = getPulseNumberLabels();
    if (!labels) return [];
    if (Array.isArray(labels)) return labels;
    if (typeof labels.length === 'number') {
      try {
        return Array.from(labels);
      } catch {
        return [];
      }
    }
    return [];
  }

  function clearPulseNumberFlash() {
    const labels = resolvePulseNumberLabels();
    labels.forEach((label) => {
      if (label && label.classList) {
        label.classList.remove('pulse-number--flash');
      }
    });
  }

  function flashPulseNumber(index) {
    if (!Number.isFinite(index)) return;
    const labels = resolvePulseNumberLabels();
    for (const label of labels) {
      if (!label || !label.dataset) continue;
      const labelIndex = Number.parseInt(label.dataset.index, 10);
      if (Number.isFinite(labelIndex) && labelIndex === index) {
        if (label.classList) {
          // Reinicia animación
          void label.offsetWidth;
          label.classList.add('pulse-number--flash');
        }
        break;
      }
    }
  }

  function applyPulseAnimationDuration(node, durationMs) {
    if (!node || !node.style) return;
    if (!Number.isFinite(durationMs) || durationMs <= 0) return;
    node.style.setProperty('--pulse-anim-duration', `${durationMs}ms`);
  }

  /**
   * Encuentra fracción coincidente con un valor
   */
  function findFractionMatch(value) {
    if (!fractionStore || !fractionStore.selectionState) return null;

    for (const [key, info] of fractionStore.selectionState) {
      if (!Number.isFinite(info.value)) continue;
      if (Math.abs(info.value - value) <= epsilon) {
        return { key, ...info };
      }
    }
    return null;
  }

  /**
   * Establece highlighting de fracción
   */
  function setFractionHighlightKey(key) {
    if (!fractionStore) return;

    // Limpiar highlights previos
    if (fractionStore.lastHighlightFractionNodes) {
      const { marker, hit, token } = fractionStore.lastHighlightFractionNodes;
      marker?.classList.remove('fraction-active');
      if (hit && hit !== marker) hit?.classList.remove('fraction-active');
      token?.classList.remove('pulse-seq-token--active');
    }

    if (!key) {
      fractionStore.lastHighlightFractionNodes = { key: null, marker: null, hit: null, token: null };
      return;
    }

    // Aplicar nuevos highlights
    const marker = fractionStore.markerMap?.get(key);
    const hit = fractionStore.hitMap?.get(key);
    const token = fractionStore.pulseSeqTokenMap?.get(key);

    if (marker) marker.classList.add('fraction-active');
    if (hit && hit !== marker) hit.classList.add('fraction-active');
    if (token) token.classList.add('pulse-seq-token--active');

    fractionStore.lastHighlightFractionNodes = { key, marker, hit, token };
  }

  /**
   * Obtiene el rect de pulseSeq para una clave de fracción
   */
  function getPulseSeqRectForKey(key) {
    if (!fractionStore || !fractionStore.pulseSeqTokenMap) return null;
    const token = fractionStore.pulseSeqTokenMap.get(key);
    return token ? token.getBoundingClientRect() : null;
  }

  /**
   * Hace scroll del pulseSeq a un rect
   */
  function scrollPulseSeqToRect(rect) {
    if (!pulseSeqEl || !rect) return pulseSeqEl?.scrollLeft || 0;

    const container = pulseSeqEl.getBoundingClientRect();
    const tokenLeft = rect.left - container.left + pulseSeqEl.scrollLeft;
    const tokenCenter = tokenLeft + rect.width / 2;
    const containerCenter = container.width / 2;
    const targetScroll = tokenCenter - containerCenter;

    pulseSeqEl.scrollLeft = Math.max(0, targetScroll);
    return pulseSeqEl.scrollLeft;
  }

  /**
   * Resetea cache de scroll de pulso
   */
  function resetPulseScrollCache() {
    state.pulse.lastScrollCache = {
      type: null,
      index: null,
      fractionKey: null,
      trailingIndex: null,
      rect: null,
      trailingRect: null,
      scrollLeft: null
    };
  }

  /**
   * Resetea estado de highlighting de pulso
   */
  function resetPulseHighlightState({ clearFraction = false } = {}) {
    const pulses = getPulses();
    pulses?.forEach(p => p?.classList.remove('active'));

    if (clearFraction) {
      setFractionHighlightKey(null);
    }

    pulseSeqController?.clearActive();
    clearPulseNumberFlash();
    resetPulseScrollCache();
  }

  /**
   * Highlighting de pulso entero (versión simplificada tipo App1)
   */
  function highlightIntegerPulse(index, { loopEnabled = false } = {}) {
    const pulses = getPulses();
    if (!pulses || pulses.length === 0) return;

    const targetIndex = Math.max(0, Math.min(index, pulses.length - 1));

    // Limpiar todos los highlights previos
    pulses.forEach(p => p?.classList.remove('active'));
    setFractionHighlightKey(null);
    clearPulseNumberFlash();

    // Aplicar highlight al pulso actual
    const current = pulses[targetIndex];
    if (current) {
      void current.offsetWidth; // Force reflow
      const duration = typeof getPulseAnimationDuration === 'function'
        ? getPulseAnimationDuration({
          index: targetIndex,
          resolution: state.currentResolution,
          loopEnabled
        })
        : null;
      applyPulseAnimationDuration(current, duration);
      current.classList.add('active');
    }

    // Trailing pulse si volvemos a 0 con loop
    let trailingIndex = null;
    if (loopEnabled && targetIndex === 0 && pulses.length > 0) {
      trailingIndex = pulses.length - 1;
      const last = pulses[trailingIndex];
      if (last) {
        const duration = typeof getPulseAnimationDuration === 'function'
          ? getPulseAnimationDuration({
            index: trailingIndex,
            trailing: true,
            resolution: state.currentResolution,
            loopEnabled
          })
          : null;
        applyPulseAnimationDuration(last, duration);
        last.classList.add('active');
      }
    }

    flashPulseNumber(targetIndex);
    if (trailingIndex != null) {
      flashPulseNumber(trailingIndex);
    }

    // Actualizar pulseSeq highlight con scroll
    if (pulseSeqController && pulseSeqEl) {
      const rect = getPulseSeqRectForIndex ? getPulseSeqRectForIndex(targetIndex) : null;
      let trailingRect = null;
      if (trailingIndex != null && getPulseSeqRectForIndex) {
        trailingRect = getPulseSeqRectForIndex(trailingIndex);
      }

      if (rect) {
        const newScrollLeft = scrollPulseSeqToRect ? scrollPulseSeqToRect(rect) : pulseSeqEl.scrollLeft;
        pulseSeqController.setActiveIndex(targetIndex, {
          rect,
          trailingIndex,
          trailingRect: trailingIndex != null ? trailingRect : null,
          scrollLeft: newScrollLeft
        });
      } else {
        pulseSeqController.clearActive();
      }
    } else if (pulseSeqController) {
      pulseSeqController.setActiveIndex(targetIndex);
    }

    // Actualizar estado
    state.pulse.lastType = 'int';
    state.pulse.lastIntIndex = targetIndex;
    state.pulse.lastFractionKey = null;
  }

  /**
   * Highlighting de fracción
   */
  function highlightFraction(key) {
    if (!fractionStore || !key) return;
    const pulses = getPulses();

    // Limpiar pulsos
    pulses?.forEach(p => p?.classList.remove('active'));
    clearPulseNumberFlash();

    // Aplicar highlight de fracción
    setFractionHighlightKey(key);

    // Scroll en pulseSeq si es necesario
    if (pulseSeqEl) {
      const rect = getPulseSeqRectForKey(key);
      if (rect) {
        const newScrollLeft = scrollPulseSeqToRect(rect);
        pulseSeqController?.setActiveIndex(0, { rect, scrollLeft: newScrollLeft });

        state.pulse.lastScrollCache = {
          type: 'fraction',
          index: null,
          fractionKey: key,
          trailingIndex: null,
          rect,
          trailingRect: null,
          scrollLeft: newScrollLeft
        };
      } else {
        pulseSeqController?.clearActive();
        resetPulseScrollCache();
      }
    } else {
      pulseSeqController?.clearActive();
      resetPulseScrollCache();
    }

    // Actualizar estado
    state.pulse.lastType = 'fraction';
    state.pulse.lastIntIndex = null;
    state.pulse.lastFractionKey = key;
  }

  /**
   * Highlighting automático (detecta si es entero o fracción)
   */
  function highlightPulse(payload, { loopEnabled = false, isPlaying = false } = {}) {
    if (!isPlaying) return;

    const pulses = getPulses();
    if (!pulses || pulses.length === 0) {
      state.lastNormalizedStep = null;
      state.pulse.lastType = null;
      state.pulse.lastIntIndex = null;
      state.pulse.lastFractionKey = null;
      resetPulseHighlightState({ clearFraction: true });
      pulseSeqController?.clearActive();
      return;
    }

    // Extraer step y resolution del payload
    let rawStepValue = null;
    if (payload && typeof payload === 'object') {
      if (Number.isFinite(payload.step)) {
        rawStepValue = Number(payload.step);
      } else if (Number.isFinite(payload.rawStep)) {
        rawStepValue = Number(payload.rawStep);
      }
      if (Number.isFinite(payload.resolution) && payload.resolution > 0) {
        state.currentResolution = Math.max(1, Math.round(payload.resolution));
      }
    } else {
      const candidate = Number(payload);
      rawStepValue = Number.isFinite(candidate) ? candidate : null;
    }

    if (!Number.isFinite(rawStepValue)) {
      state.lastNormalizedStep = null;
      state.pulse.lastType = null;
      state.pulse.lastIntIndex = null;
      state.pulse.lastFractionKey = null;
      resetPulseScrollCache();
      return;
    }

    const baseCount = pulses.length > 1 ? pulses.length - 1 : 0;
    if (baseCount <= 0) {
      state.lastNormalizedStep = null;
      state.pulse.lastType = null;
      state.pulse.lastIntIndex = null;
      state.pulse.lastFractionKey = null;
      resetPulseScrollCache();
      return;
    }

    const resolution = state.currentResolution;
    const scaledSpan = baseCount * resolution;

    // Normalizar step
    let normalizedScaled = rawStepValue;
    if (loopEnabled) {
      if (scaledSpan <= 0) return;
      normalizedScaled = ((rawStepValue % scaledSpan) + scaledSpan) % scaledSpan;
    } else {
      normalizedScaled = Math.max(0, Math.min(rawStepValue, scaledSpan));
    }

    const normalizedValue = resolution > 0 ? normalizedScaled / resolution : normalizedScaled;
    const nearestInt = Math.round(normalizedValue);
    const isIntegerStep = Math.abs(normalizedValue - nearestInt) <= epsilon
      && nearestInt >= 0
      && nearestInt <= baseCount;

    let highlightType = 'int';
    let fractionMatch = null;

    if (!isIntegerStep) {
      fractionMatch = findFractionMatch(normalizedValue);
      if (fractionMatch && fractionMatch.key) {
        highlightType = 'fraction';
      } else {
        // Paso fraccionario sin fracción seleccionada - ignorar
        return;
      }
    }

    const fractionKey = fractionMatch?.key || null;
    const idx = Math.max(0, Math.min(nearestInt, baseCount));

    // Verificar si necesitamos actualizar
    let shouldUpdate = false;
    if (highlightType === 'fraction') {
      shouldUpdate = state.pulse.lastType !== 'fraction'
        || fractionKey !== state.pulse.lastFractionKey;
    } else {
      shouldUpdate = state.pulse.lastType !== 'int'
        || idx !== state.pulse.lastIntIndex;
    }

    if (!shouldUpdate) {
      state.lastNormalizedStep = normalizedScaled;
      state.lastVisualStep = rawStepValue;
      return;
    }

    // Aplicar highlight
    if (highlightType === 'fraction' && fractionKey) {
      highlightFraction(fractionKey);
    } else {
      highlightIntegerPulse(idx, { loopEnabled });
    }

    state.lastNormalizedStep = normalizedScaled;
    state.lastVisualStep = rawStepValue;
  }

  /**
   * Highlighting de ciclo
   */
  function highlightCycle(payload = {}) {
    const markers = getCycleMarkers();
    if (!markers || markers.length === 0) return;

    const { cycleIndex, subdivisionIndex } = payload;
    if (!Number.isFinite(cycleIndex) || !Number.isFinite(subdivisionIndex)) return;

    // Limpiar highlights previos
    state.cycle.activeMarkers.forEach(m => m?.classList.remove('active'));
    state.cycle.activeMarkers = [];

    // Buscar y activar marcador correspondiente
    const target = markers.find(m => {
      const ci = parseInt(m.dataset?.cycleIndex);
      const si = parseInt(m.dataset?.subdivision);
      return ci === cycleIndex && si === subdivisionIndex;
    });

    if (target) {
      target.classList.add('active');
      state.cycle.activeMarkers.push(target);
    }
  }

  /**
   * Limpia todos los highlights
   */
  function clearAll() {
    const pulses = getPulses();
    pulses?.forEach(p => p?.classList.remove('active'));

    setFractionHighlightKey(null);
    pulseSeqController?.clearActive();

    state.cycle.activeMarkers.forEach(m => m?.classList.remove('active'));
    state.cycle.activeMarkers = [];

    clearPulseNumberFlash();

    state.pulse.lastType = null;
    state.pulse.lastIntIndex = null;
    state.pulse.lastFractionKey = null;
    state.lastNormalizedStep = null;
    state.lastVisualStep = null;

    resetPulseScrollCache();
  }

  // API pública
  return {
    highlightIntegerPulse,
    highlightFraction,
    highlightPulse,
    highlightCycle,
    clearAll,
    getState: () => ({ ...state })
  };
}
