import { Renderer, Stave, StaveNote, Voice, Formatter, Tuplet, BarlineType, Beam, GhostNote, Stem } from '../vendor/vexflow/entry/vexflow.js';
import { gridFromOrigin } from '../app-common/subdivision.js';

const DEFAULT_HEIGHT = 200;
const HORIZONTAL_MARGIN = 18;

const NAMED_DURATIONS = {
  w: 'w',
  whole: 'w',
  redonda: 'w',
  h: 'h',
  half: 'h',
  blanca: 'h',
  q: 'q',
  quarter: 'q',
  negra: 'q',
  eighth: '8',
  quaver: '8',
  corchea: '8',
  '8': '8',
  sixteenth: '16',
  semiquaver: '16',
  semicorchea: '16',
  '16': '16',
  thirtysecond: '32',
  demisemiquaver: '32',
  fusa: '32',
  '32': '32',
  sixtyfourth: '64',
  hemidemisemiquaver: '64',
  semifusa: '64',
  '64': '64',
};

const REST_KEY = 'b/4';
const DEFAULT_NOTE_KEY = 'b/4';
const DOWNBEAT_KEY = 'd/4';
const SELECTED_KEY = 'c/5';

const BEAMABLE_DURATIONS = new Set(['8', '16', '32', '64']);
const POSITION_SCALE = 1e6;
const WHOLE_PULSE_EPSILON = 1e-6;

function sanitizeDurationForBeam(duration) {
  if (!duration) return '';
  return String(duration)
    .replace(/r/gi, '')
    .replace(/\./g, '')
    .trim();
}

function shouldBeamNote(note) {
  if (!note || typeof note.isRest !== 'function') {
    return false;
  }
  if (note.isRest()) {
    return false;
  }
  const rawDuration = typeof note.getDuration === 'function' ? note.getDuration() : '';
  const baseDuration = sanitizeDurationForBeam(rawDuration);
  return BEAMABLE_DURATIONS.has(baseDuration);
}

function makePositionKey(value) {
  if (!Number.isFinite(value)) {
    return null;
  }
  return Math.round(value * POSITION_SCALE);
}

function isWholePulse(value) {
  if (!Number.isFinite(value)) {
    return false;
  }
  const nearestInteger = Math.round(value);
  return Math.abs(value - nearestInteger) <= WHOLE_PULSE_EPSILON;
}

const PULSE_FILTERS = {
  fractional: (value) => !isWholePulse(value),
  whole: (value) => isWholePulse(value),
  all: () => true,
  // Este filtro necesita contexto adicional, se maneja especialmente en render()
  'fractional-with-matching-whole': null
};

function normalizePulseFilter(filter) {
  if (typeof filter === 'function') {
    return (value) => Boolean(filter(value));
  }
  if (typeof filter === 'string' && PULSE_FILTERS[filter]) {
    return PULSE_FILTERS[filter];
  }
  return PULSE_FILTERS.fractional;
}

function createPulseInclusionChecker(filter) {
  const predicate = normalizePulseFilter(filter);
  return (value) => {
    if (!Number.isFinite(value)) return false;
    if (value === 0) return true;
    return Boolean(predicate(value));
  };
}

function denominatorToDuration(denominator) {
  const clean = Math.round(Number(denominator));
  switch (clean) {
    case 1: return 'w';
    case 2: return 'h';
    case 4: return 'q';
    case 8: return '8';
    case 16: return '16';
    case 32: return '32';
    case 64: return '64';
    default: return null;
  }
}

function resolveDuration(rawDuration, isRest = false) {
  if (rawDuration == null) {
    return isRest ? 'qr' : 'q';
  }

  if (typeof rawDuration === 'string') {
    const trimmed = rawDuration.trim();
    if (trimmed.includes('/')) {
      const [num, den] = trimmed.split('/').map((part) => Number(part));
      const duration = denominatorToDuration(den);
      if (duration) {
        return isRest ? `${duration}r` : duration;
      }
    }
    const key = trimmed.toLowerCase();
    if (NAMED_DURATIONS[key]) {
      const duration = NAMED_DURATIONS[key];
      return isRest ? `${duration}r` : duration;
    }
    if (/^\d+$/.test(trimmed)) {
      const duration = NAMED_DURATIONS[trimmed];
      if (duration) {
        return isRest ? `${duration}r` : duration;
      }
    }
  } else if (typeof rawDuration === 'number' && Number.isFinite(rawDuration) && rawDuration > 0) {
    const direct = denominatorToDuration(rawDuration);
    if (direct) {
      return isRest ? `${direct}r` : direct;
    }
    const reciprocal = 1 / rawDuration;
    const duration = denominatorToDuration(reciprocal);
    if (duration) {
      return isRest ? `${duration}r` : duration;
    }
  } else if (typeof rawDuration === 'object') {
    if (rawDuration.duration) {
      return resolveDuration(rawDuration.duration, isRest);
    }
    if (rawDuration.value) {
      return resolveDuration(rawDuration.value, isRest);
    }
    if (rawDuration.denominator) {
      const duration = denominatorToDuration(rawDuration.denominator);
      if (duration) {
        return isRest ? `${duration}r` : duration;
      }
    }
  }

  return isRest ? 'qr' : 'q';
}

function normalizeEvents(state) {
  if (!state) return [];
  if (Array.isArray(state)) return state;
  if (Array.isArray(state.events)) return state.events;
  if (Array.isArray(state.notes)) return state.notes;
  if (Array.isArray(state.figures)) return state.figures;
  return [];
}

function normalizeTuplets(state) {
  if (!state) return [];
  if (Array.isArray(state.tuplets)) return state.tuplets;
  return [];
}

function isComplexFraction(fraction) {
  if (!fraction) return false;
  const numerator = Number(fraction.numerator);
  const denominator = Number(fraction.denominator);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return false;
  }
  return numerator !== denominator;
}

function pickKeyForPulse(pulseIndex, selectedSet) {
  if (pulseIndex === 0) {
    return DOWNBEAT_KEY;
  }
  if (selectedSet.has(pulseIndex)) {
    return SELECTED_KEY;
  }
  return DEFAULT_NOTE_KEY;
}

export function createRhythmStaff({ container, pulseFilter = 'fractional' } = {}) {
  if (!container) {
    throw new Error('createRhythmStaff requires a container element');
  }

  container.classList.add('rhythm-staff-container');
  if (typeof window !== 'undefined' && window.getComputedStyle) {
    const computedPosition = window.getComputedStyle(container).position;
    if (!computedPosition || computedPosition === 'static') {
      container.style.position = 'relative';
    }
  } else if (!container.style.position) {
    container.style.position = 'relative';
  }

  let renderer = null;
  let context = null;
  let cursorElement = null;
  let staveInfo = null;
  let lastRenderMeta = { positionLookup: new Map() };
  let includePulse = createPulseInclusionChecker(pulseFilter);

  const clear = () => {
    if (!container) return;
    if (context && typeof context.clear === 'function') {
      context.clear();
      return;
    }
    const svg = container.querySelector('svg');
    if (svg) {
      while (svg.lastChild) {
        svg.removeChild(svg.lastChild);
      }
    }
  };

  const destroy = () => {
    if (container) {
      container.classList.remove('rhythm-staff-container');
      const existingCursor = container.querySelector('.notation-playback-cursor');
      if (existingCursor) {
        existingCursor.remove();
      }
    }
    clear();
    renderer = null;
    context = null;
    cursorElement = null;
    staveInfo = null;
  };

  const ensureCursor = () => {
    if (!cursorElement || !cursorElement.parentElement) {
      cursorElement = document.createElement('div');
      cursorElement.className = 'notation-playback-cursor';
      cursorElement.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 2px;
        height: 0;
        background: var(--selection-color, #F97C39);
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s ease;
        z-index: 10;
        transform-origin: left center;
      `;
      container.appendChild(cursorElement);
    }
    return cursorElement;
  };

  let lastCursorX = null; // Track last valid cursor position
  let lastCursorPulse = -1; // Track last pulse to detect resets
  let cachedSvgOffsetX = 0; // Cache SVG offset for performance
  let scrollPending = false; // Throttle auto-scroll with requestAnimationFrame

  const updateSvgOffset = () => {
    const svgElement = container.querySelector('svg');
    if (svgElement && container) {
      const svgRect = svgElement.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      cachedSvgOffsetX = svgRect.left - containerRect.left;
    } else {
      cachedSvgOffsetX = 0;
    }
  };

  const updateCursor = (currentPulse = 0, isPlaying = false) => {
    const cursor = ensureCursor();
    if (!staveInfo) {
      cursor.classList.remove('notation-playback-cursor--active');
      cursor.style.opacity = '0';
      lastCursorX = null;
      lastCursorPulse = -1;
      return;
    }

    // Remover opacity inline para que la clase CSS --active controle la opacidad
    cursor.style.opacity = '';

    // Detectar reset de ciclo (pulso vuelve a 0 o disminuye)
    if (currentPulse < lastCursorPulse) {
      lastCursorX = null;
    }
    lastCursorPulse = currentPulse;

    // Buscar la nota correspondiente al pulso actual
    let targetX = null;

    const pulseKey = String(makePositionKey(currentPulse));
    const entryMeta = lastRenderMeta.positionLookup.get(pulseKey);

    if (entryMeta && entryMeta.noteElement) {
      // Usar la posición real de la nota
      try {
        const bbox = entryMeta.noteElement.getBBox();
        if (bbox && Number.isFinite(bbox.x)) {
          targetX = bbox.x;
        }
      } catch (e) {
        // getBBox puede fallar en algunos casos
      }
    }

    // Si no encontramos posición exacta, usar última posición válida (NO interpolar)
    // Esto evita saltos cuando el cursor pasa por pulsos sin entry
    if (!Number.isFinite(targetX)) {
      if (Number.isFinite(lastCursorX)) {
        targetX = lastCursorX;
      } else {
        // Primera vez o después de reset
        if (currentPulse === 0) {
          // Para pulso 0, buscar la primera nota renderizada
          const firstEntry = Array.from(lastRenderMeta.positionLookup.values())
            .sort((a, b) => (a.pulseIndex ?? 0) - (b.pulseIndex ?? 0))[0];

          if (firstEntry?.noteElement) {
            try {
              const bbox = firstEntry.noteElement.getBBox();
              if (bbox && Number.isFinite(bbox.x)) {
                targetX = bbox.x;
              }
            } catch (e) {
              // Fallback a inicio del stave
              targetX = staveInfo.x;
            }
          } else {
            // No hay notas - inicio del stave
            targetX = staveInfo.x;
          }
        } else {
          // Para otros pulsos sin entry, usar contentStartX o inicio del stave
          targetX = Number.isFinite(staveInfo.contentStartX) ? staveInfo.contentStartX : staveInfo.x;
        }
      }
    }

    // Actualizar última posición válida solo si avanzamos
    if (Number.isFinite(targetX) && (!Number.isFinite(lastCursorX) || targetX >= lastCursorX)) {
      lastCursorX = targetX;
    }

    cursor.style.top = `${staveInfo.y}px`;
    cursor.style.height = `${staveInfo.height}px`;
    cursor.style.transform = `translateX(${targetX + cachedSvgOffsetX}px)`;
    cursor.classList.toggle('notation-playback-cursor--active', isPlaying);

    // Auto-scroll throttled con requestAnimationFrame para mejor performance
    if (isPlaying && Number.isFinite(targetX) && !scrollPending) {
      scrollPending = true;
      requestAnimationFrame(() => {
        scrollNotationToPosition(targetX);
        scrollPending = false;
      });
    }
  };

  const scrollNotationToPosition = (cursorX) => {
    // Buscar el contenedor con scroll (.notation-panel__canvas)
    const canvas = container.closest('.notation-panel__canvas');
    if (!canvas) return;

    const cursor = ensureCursor();
    if (!cursor) return;

    // Usar posiciones reales del DOM para calcular scroll correcto
    const cursorRect = cursor.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();

    // Posición del cursor relativa al viewport del canvas
    const cursorViewportX = cursorRect.left - canvasRect.left;
    const clientWidth = canvas.clientWidth;

    // Margen de seguridad para mantener el cursor visible
    const margin = 50;

    if (cursorViewportX < margin) {
      // Cursor fuera a la izquierda - scroll hacia la izquierda
      canvas.scrollLeft = Math.max(0, canvas.scrollLeft - (margin - cursorViewportX));
    } else if (cursorViewportX > clientWidth - margin) {
      // Cursor fuera a la derecha - scroll hacia la derecha
      canvas.scrollLeft = canvas.scrollLeft + (cursorViewportX - clientWidth + margin);
    }
  };

  const resetCursor = () => {
    updateCursor(0, false);
  };

  const render = (state = {}) => {
    const {
      lg = 0,
      selectedIndices = [],
      fraction = null,
      positions = [],
      rhythm,
      pulseFilter: overridePulseFilter,
    } = state;

    const events = normalizeEvents(rhythm || state);
    const tuplets = normalizeTuplets(rhythm || state);
    const pulses = Array.isArray(positions) ? positions : [];

    // Detectar si necesitamos el filtro híbrido
    const needsHybridFilter = overridePulseFilter === 'fractional-with-matching-whole'
      || (overridePulseFilter == null && pulseFilter === 'fractional-with-matching-whole');

    let shouldInclude;
    if (needsHybridFilter) {
      // Construir Set de posiciones fraccionadas existentes
      const fractionalPositions = new Set();

      // Agregar posiciones de eventos fraccionados
      events.forEach((event, index) => {
        const pulseIndex = Number.isFinite(event?.pulseIndex)
          ? Number(event.pulseIndex)
          : (Number.isFinite(pulses[index]) ? Number(pulses[index]) : index);
        if (Number.isFinite(pulseIndex) && !isWholePulse(pulseIndex)) {
          fractionalPositions.add(Math.floor(pulseIndex));
        }
      });

      // Agregar posiciones de la fracción grid
      const fractionNumerator = Number.isFinite(Number(fraction?.numerator)) && Number(fraction?.numerator) > 0
        ? Number(fraction.numerator)
        : null;
      const fractionDenominator = Number.isFinite(Number(fraction?.denominator)) && Number(fraction?.denominator) > 0
        ? Number(fraction.denominator)
        : null;
      if (fractionNumerator && fractionDenominator) {
        const fractionGrid = gridFromOrigin({ lg: Number(lg) || 0, numerator: fractionNumerator, denominator: fractionDenominator });
        if (fractionGrid?.subdivisions?.length) {
          fractionGrid.subdivisions.forEach(({ position }) => {
            if (Number.isFinite(position) && !isWholePulse(position)) {
              fractionalPositions.add(Math.floor(position));
            }
          });
        }
      }

      // Crear filtro que permite fraccionados + enteros que coincidan
      shouldInclude = (value) => {
        if (!Number.isFinite(value)) return false;
        if (value === 0) return true;
        if (!isWholePulse(value)) return true; // Todos los fraccionados
        // Pulsos enteros solo si hay fraccionados en esa posición
        return fractionalPositions.has(value);
      };
    } else {
      shouldInclude = overridePulseFilter != null
        ? createPulseInclusionChecker(overridePulseFilter)
        : includePulse;
    }

    clear();
    const selectedSet = new Set();
    const rawSelected = Array.isArray(selectedIndices) ? selectedIndices : [];
    rawSelected.forEach((value) => {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return;
      if (shouldInclude(numeric)) {
        selectedSet.add(numeric);
      }
    });
    selectedSet.add(0);

    const entryBuckets = new Map();
    const entryList = [];
    const positionLookup = new Map();

    const registerEntry = (entry) => {
      const key = makePositionKey(entry.pulseIndex);
      if (key != null) {
        entry.positionKey = key;
        if (!entryBuckets.has(key)) {
          entryBuckets.set(key, []);
        }
        entryBuckets.get(key).push(entry);
        const lookupKey = String(key);
        if (!positionLookup.has(lookupKey)) {
          positionLookup.set(lookupKey, {
            pulseIndex: entry.pulseIndex,
            event: entry.event || null,
            generated: !!entry.generated,
            selectionKey: entry.event?.selectionKey ?? null
          });
        } else {
          const meta = positionLookup.get(lookupKey);
          if (meta) {
            meta.event = entry.event || meta.event || null;
            if (meta.selectionKey == null && entry.event?.selectionKey != null) {
              meta.selectionKey = entry.event.selectionKey;
            }
            if (entry.generated) {
              meta.generated = true;
            }
          }
        }
      } else {
        entry.positionKey = null;
      }
      entryList.push(entry);
      return entry;
    };

    events.forEach((event, index) => {
      const pulseIndex = Number.isFinite(event?.pulseIndex)
        ? Number(event.pulseIndex)
        : (Number.isFinite(pulses[index]) ? Number(pulses[index]) : index);

      if (!shouldInclude(pulseIndex)) {
        return;
      }

      const isRest = !!event?.rest || event?.type === 'rest';
      const duration = resolveDuration(event?.duration, isRest);

      const config = {
        clef: 'treble',
        duration,
        keys: isRest ? [REST_KEY] : [pickKeyForPulse(pulseIndex, selectedSet)],
      };

      const note = new StaveNote(config);
      if (isRest) {
        note.setStyle({ fillStyle: '#000', strokeStyle: '#000' });
      }

      registerEntry({
        event,
        pulseIndex,
        note,
        originalIndex: index,
      });
    });

    let fractionGrid = null;
    const fractionNumerator = Number.isFinite(Number(fraction?.numerator)) && Number(fraction?.numerator) > 0
      ? Number(fraction.numerator)
      : null;
    const fractionDenominator = Number.isFinite(Number(fraction?.denominator)) && Number(fraction?.denominator) > 0
      ? Number(fraction.denominator)
      : null;
    if (fractionNumerator && fractionDenominator) {
      fractionGrid = gridFromOrigin({ lg: Number(lg) || 0, numerator: fractionNumerator, denominator: fractionDenominator });
      const baseDuration = denominatorToDuration(fractionDenominator) || '16';
      const resolvedRestDuration = resolveDuration(baseDuration, true);

      if (fractionGrid?.subdivisions?.length) {
        fractionGrid.subdivisions.forEach(({ position, cycleIndex, subdivisionIndex }) => {
          const key = makePositionKey(position);
          if (key == null) return;
          const existing = entryBuckets.get(key);
          if (existing && existing.length) {
            // Buscar si hay un evento real (no generado) para esta posición
            const realEvent = events.find(e => {
              const eIndex = Number(e.pulseIndex);
              return Number.isFinite(eIndex) && makePositionKey(eIndex) === key && !e.rest;
            });

            if (realEvent) {
              // Hay un evento real seleccionado - eliminar entry generada y recrearla como nota
              // 1. Remover de entryBuckets
              entryBuckets.delete(key);

              // 2. Marcar entry en entryList para NO renderizar
              existing.forEach(entry => {
                entry._shouldRemove = true;
              });

              // 3. Crear nueva entry con nota (no silencio)
              const noteKey = pickKeyForPulse(position, selectedSet);
              const noteDuration = resolveDuration(realEvent.duration, false);
              const note = new StaveNote({
                clef: 'treble',
                duration: noteDuration,
                keys: [noteKey],
              });

              registerEntry({
                event: realEvent,
                pulseIndex: position,
                note,
                generated: false,
                tupletCycle: cycleIndex,
                subdivisionIndex,
                originalIndex: events.length + entryList.length,
              });
              return;
            }

            // Si no hay evento real, solo actualizar metadata del silencio existente
            existing.forEach((entry) => {
              if (entry.tupletCycle == null) entry.tupletCycle = cycleIndex;
              if (entry.subdivisionIndex == null) entry.subdivisionIndex = subdivisionIndex;
            });
            return;
          }

          // Los inicios de ciclo siempre se renderizan como silencios visibles
          // para completar los tuplets, independientemente del filtro
          const isCycleStart = subdivisionIndex === 0;

          if (isCycleStart || shouldInclude(position)) {
            // Crear silencio visible para inicios de ciclo o posiciones incluidas
            const restNote = new StaveNote({
              clef: 'treble',
              duration: resolvedRestDuration,
              keys: [REST_KEY],
            });
            restNote.setStyle({ fillStyle: '#000', strokeStyle: '#000' });

            registerEntry({
              event: {
                pulseIndex: position,
                duration: resolvedRestDuration,
                rest: true,
                generated: true,
              },
              pulseIndex: position,
              note: restNote,
              generated: true,
              tupletCycle: cycleIndex,
              subdivisionIndex,
              originalIndex: events.length + entryList.length,
            });
            return;
          }

          // Para posiciones excluidas que NO son inicio de ciclo, crear GhostNote
          const ghostDuration = typeof resolvedRestDuration === 'string'
            ? resolvedRestDuration.replace(/r$/i, '')
            : null;
          const fallbackDuration = typeof baseDuration === 'string' && baseDuration.trim()
            ? baseDuration.trim()
            : '16';
          const ghostNote = new GhostNote({ duration: ghostDuration || fallbackDuration });
          ghostNote.setStemDirection(Stem.UP);

          registerEntry({
            event: {
              pulseIndex: position,
              duration: resolvedRestDuration,
              rest: true,
              generated: true,
            },
            pulseIndex: position,
            note: ghostNote,
            generated: true,
            tupletCycle: cycleIndex,
            subdivisionIndex,
            originalIndex: events.length + entryList.length,
          });
        });
      }
    }

    // Post-procesamiento: agregar pulsos enteros seleccionados que no están en fractionGrid
    events.forEach((event, index) => {
      const pulseIndex = Number.isFinite(event?.pulseIndex)
        ? Number(event.pulseIndex)
        : (Number.isFinite(pulses[index]) ? Number(pulses[index]) : index);

      // Solo procesar pulsos enteros seleccionados (no-rest, no-zero)
      if (!isWholePulse(pulseIndex) || event.rest || pulseIndex === 0) {
        return;
      }

      const key = makePositionKey(pulseIndex);
      if (key == null) return;

      // Verificar si ya existe una entry para este pulso
      const existing = entryBuckets.get(key);
      if (existing && existing.length) {
        // Ya procesado - verificar si es silencio generado y debe actualizarse a nota
        const isGeneratedRest = existing.some(e => e.generated && e.event?.rest);
        if (isGeneratedRest) {
          // Eliminar y recrear como nota
          entryBuckets.delete(key);
          existing.forEach(entry => {
            entry._shouldRemove = true;
          });

          const noteKey = pickKeyForPulse(pulseIndex, selectedSet);
          const noteDuration = resolveDuration(event.duration, false);
          const note = new StaveNote({
            clef: 'treble',
            duration: noteDuration,
            keys: [noteKey],
          });

          // Calcular el ciclo del tuplet para que este pulso entero se incluya en el tuplet correcto
          // El numerator define el tamaño del ciclo (cada ciclo empieza cada N pulsos)
          const tupletCycle = fractionGrid ? Math.floor(pulseIndex / fractionGrid.numerator) : undefined;

          registerEntry({
            event,
            pulseIndex,
            note,
            generated: false,
            tupletCycle,
            originalIndex: events.length + entryList.length,
          });
        }
        return;
      }

      // No existe - crear nueva entry para pulso entero seleccionado
      const noteKey = pickKeyForPulse(pulseIndex, selectedSet);
      const noteDuration = resolveDuration(event.duration, false);
      const note = new StaveNote({
        clef: 'treble',
        duration: noteDuration,
        keys: [noteKey],
      });

      // Calcular el ciclo del tuplet para que este pulso entero se incluya en el tuplet correcto
      // El numerator define el tamaño del ciclo (cada ciclo empieza cada N pulsos)
      const tupletCycle = fractionGrid ? Math.floor(pulseIndex / fractionGrid.numerator) : undefined;

      registerEntry({
        event,
        pulseIndex,
        note,
        generated: false,
        tupletCycle,
        originalIndex: events.length + entryList.length,
      });
    });

    const lgCount = Number.isFinite(Number(lg)) ? Number(lg) : 0;
    const subdivisionCount = Number(fractionGrid?.subdivisions?.length) || 0;
    const entryCount = entryList.length;
    const widthBase = Math.max(0, lgCount, subdivisionCount, entryCount);
    const innerStaveWidth = Math.max(220, widthBase * 36);
    const totalWidth = innerStaveWidth + HORIZONTAL_MARGIN * 2;

    if (!renderer) {
      renderer = new Renderer(container, Renderer.Backends.SVG);
    }
    renderer.resize(totalWidth, DEFAULT_HEIGHT);
    context = renderer.getContext();

    const stave = new Stave(HORIZONTAL_MARGIN, 48, innerStaveWidth);
    stave.addClef('treble');
    stave.setBegBarType(BarlineType.SINGLE);
    stave.setEndBarType(BarlineType.SINGLE);
    stave.setContext(context).draw();

    // Guardar información del stave para el cursor
    staveInfo = {
      x: stave.getX(),
      y: stave.getY(),
      width: stave.getWidth(),
      height: stave.getHeight()
    };

    if (!events.length && !entryList.length) {
      resetCursor();
      return;
    }

    // Filtrar entries marcadas para remover y luego ordenar
    const entries = entryList
      .filter(entry => !entry._shouldRemove)
      .slice()
      .sort((a, b) => {
        if (Number.isFinite(a.pulseIndex) && Number.isFinite(b.pulseIndex) && a.pulseIndex !== b.pulseIndex) {
          return a.pulseIndex - b.pulseIndex;
        }
        return (a.originalIndex ?? 0) - (b.originalIndex ?? 0);
      });

    entries.forEach((entry, index) => {
      entry.renderIndex = index;
    });

    // Crear tuplets y beams ANTES de crear el voice
    // para que VexFlow sepa que las notas tienen beam y no dibuje flags
    const renderedTuplets = [];
    const tupletBeams = [];
    const noteLookup = entries.map((entry) => entry.note);

    const createTuplet = (noteIndices, ratio) => {
      const normalizedIndices = Array.from(new Set(noteIndices)).sort((a, b) => a - b);
      if (normalizedIndices.length < 2) return null;

      const tupletNotes = normalizedIndices
        .map((idx) => noteLookup[idx])
        .filter((note) => note);
      if (tupletNotes.length < 2) return null;

      const explicitNumNotes = Number.isFinite(Number(ratio?.numNotes)) && Number(ratio?.numNotes) > 0
        ? Number(ratio.numNotes)
        : null;
      const explicitNotesOccupied = Number.isFinite(Number(ratio?.notesOccupied)) && Number(ratio?.notesOccupied) > 0
        ? Number(ratio.notesOccupied)
        : null;

      const resolvedNumerator = explicitNumNotes
        ?? (Number.isFinite(Number(ratio?.numerator)) && Number(ratio?.numerator) > 0 ? Number(ratio.numerator) : tupletNotes.length);
      const resolvedDenominator = explicitNotesOccupied
        ?? (Number.isFinite(Number(ratio?.denominator)) && Number(ratio?.denominator) > 0 ? Number(ratio.denominator) : resolvedNumerator);

      const ratioed = typeof ratio?.ratioed === 'boolean'
        ? ratio.ratioed
        : resolvedNumerator !== resolvedDenominator;

      const location = Number.isFinite(Number(ratio?.location)) ? Number(ratio.location) : Tuplet.LOCATION_TOP;

      const tuplet = new Tuplet(tupletNotes, {
        numNotes: resolvedNumerator,
        notesOccupied: resolvedDenominator,
        ratioed,
        location,
      });
      tuplet.setTupletLocation(Tuplet.LOCATION_TOP);
      if (ratio?.bracketed === false && typeof tuplet.setBracketed === 'function') {
        tuplet.setBracketed(false);
      }
      renderedTuplets.push(tuplet);

      // Solo crear beams si hay al menos una nota fraccionaria
      // Los pulsos enteros solos NO deben tener beams entre ellos
      const beamableNotes = tupletNotes.filter(shouldBeamNote);

      // Verificar si hay al menos una nota fraccionaria en este tuplet
      const hasFractionalPulses = normalizedIndices.some(idx => {
        const entry = entries[idx];
        return entry && Number.isFinite(entry.pulseIndex) && !isWholePulse(entry.pulseIndex);
      });

      if (beamableNotes.length > 1 && hasFractionalPulses) {
        // El constructor de Beam automáticamente asigna el beam a las notas (llama setBeam)
        const beam = new Beam(beamableNotes);
        tupletBeams.push(beam);
      }

      return tuplet;
    };

    if (tuplets.length) {
      tuplets.forEach((group) => {
        const indices = Array.isArray(group?.noteIndices) ? group.noteIndices : [];
        createTuplet(indices, group);
      });
    } else if (fractionGrid?.subdivisions?.length && fractionGrid.denominator > 1 && fractionGrid.numerator > 0) {
      // Agrupar entries directamente por su tupletCycle metadata
      const groupedByCycle = new Map();
      entries.forEach((entry) => {
        const cycleIdx = entry.tupletCycle;
        if (!Number.isFinite(cycleIdx)) return;
        // Excluir GhostNotes generadas de los tuplets visibles
        // Las GhostNotes son instancias de GhostNote, podemos usar instanceof
        if (entry.note instanceof GhostNote) return;
        if (!groupedByCycle.has(cycleIdx)) {
          groupedByCycle.set(cycleIdx, []);
        }
        groupedByCycle.get(cycleIdx).push(entry.renderIndex);
      });

      // Crear tuplets validando longitud por ciclo
      groupedByCycle.forEach((indices) => {
        if (!Array.isArray(indices) || indices.length < 2) return;
        const sorted = Array.from(new Set(indices)).sort((a, b) => a - b);
        if (sorted.length < 2) return;

        // Validar longitud esperada del ciclo
        const expectedLength = fractionGrid.denominator;
        const isCompleteCycle = sorted.length === expectedLength;

        createTuplet(sorted, {
          numNotes: isCompleteCycle ? fractionGrid.denominator : sorted.length,
          notesOccupied: fractionGrid.numerator,
          ratioed: !isCompleteCycle || fractionGrid.denominator !== fractionGrid.numerator,
        });
      });
    }

    // Ahora crear y formatear el voice (las notas ya tienen beams asignados)
    const voice = new Voice({ numBeats: 4, beatValue: 4 });
    voice.setStrict(false);
    voice.addTickables(entries.map((entry) => entry.note));

    const formatter = new Formatter();
    formatter.joinVoices([voice]).format([voice], innerStaveWidth - 40);

    // Dibujar el voice (NO dibujará flags porque las notas ya tienen beam)
    voice.draw(context, stave);

    // Calcular bounding boxes después de dibujar
    const defaultX = stave.getX();
    const defaultY = stave.getY();
    const defaultWidth = stave.getWidth();
    const defaultHeight = stave.getHeight();
    const boundingBox = typeof stave.getBoundingBox === 'function' ? stave.getBoundingBox() : null;
    const baseX = Number.isFinite(boundingBox?.x) ? boundingBox.x : defaultX;
    const baseY = Number.isFinite(boundingBox?.y) ? boundingBox.y : defaultY;
    const baseWidth = Number.isFinite(boundingBox?.w) ? boundingBox.w : defaultWidth;
    const baseHeight = Number.isFinite(boundingBox?.h) ? boundingBox.h : defaultHeight;

    const noteBoxes = entries
      .map((entry) => (typeof entry.note?.getBoundingBox === 'function' ? entry.note.getBoundingBox() : null))
      .filter((box) => box && Number.isFinite(box.x) && Number.isFinite(box.w) && Number.isFinite(box.y) && Number.isFinite(box.h));

    const contentStartX = noteBoxes.length ? Math.min(...noteBoxes.map((box) => box.x)) : baseX;
    const contentEndX = noteBoxes.length ? Math.max(...noteBoxes.map((box) => box.x + box.w)) : baseX + baseWidth;
    const contentTop = noteBoxes.length ? Math.min(...noteBoxes.map((box) => box.y)) : baseY;
    const contentBottom = noteBoxes.length ? Math.max(...noteBoxes.map((box) => box.y + box.h)) : baseY + baseHeight;

    staveInfo = {
      x: baseX,
      y: contentTop,
      width: baseWidth,
      height: Math.max(baseHeight, contentBottom - contentTop),
      contentStartX,
      contentEndX,
    };

    // Ahora dibujar tuplets y beams
    renderedTuplets.forEach((tuplet) => {
      tuplet.setContext(context).draw();
    });

    tupletBeams.forEach((beam) => {
      beam.setContext(context);
      beam.draw();
    });

    entries.forEach((entry, index) => {
      const { note, pulseIndex, event } = entry;
      let element = note?.attrs?.el;
      if (!element && typeof note?.getSVGElement === 'function') {
        element = note.getSVGElement();
      }
      if (element) {
        element.dataset.noteIndex = String(index);
        element.dataset.pulseIndex = String(pulseIndex);
        if (entry.positionKey != null) {
          element.dataset.pulseIndexKey = String(entry.positionKey);
        } else {
          delete element.dataset.pulseIndexKey;
        }
        if (entry.generated) {
          element.dataset.generated = 'true';
        } else {
          delete element.dataset.generated;
        }
        if (Number.isFinite(entry.tupletCycle)) {
          element.dataset.tupletCycle = String(entry.tupletCycle);
        } else {
          delete element.dataset.tupletCycle;
        }
        if (Number.isFinite(entry.subdivisionIndex)) {
          element.dataset.subdivisionIndex = String(entry.subdivisionIndex);
        } else {
          delete element.dataset.subdivisionIndex;
        }
        if (event && event.duration != null) {
          element.dataset.duration = String(event.duration);
        } else {
          delete element.dataset.duration;
        }
        if (selectedSet.has(pulseIndex)) {
          element.dataset.selected = 'true';
        } else {
          delete element.dataset.selected;
        }
        if (event && event.selectionKey != null) {
          element.dataset.selectionKey = String(event.selectionKey);
        } else {
          delete element.dataset.selectionKey;
        }
        if (event && event.source) {
          element.dataset.source = String(event.source);
        } else {
          delete element.dataset.source;
        }

        // Guardar referencia al elemento en positionLookup para el cursor
        if (entry.positionKey != null) {
          const lookupKey = String(entry.positionKey);
          const meta = positionLookup.get(lookupKey);
          if (meta) {
            meta.noteElement = element;
          }
        }
      }
    });

    lastRenderMeta = { positionLookup, lgCount: lg };

    // Actualizar cache del SVG offset después de renderizar
    updateSvgOffset();

    resetCursor();
  };

  return {
    render,
    destroy,
    updateCursor,
    resetCursor,
    setPulseFilter: (nextFilter) => {
      includePulse = createPulseInclusionChecker(nextFilter);
    },
    resolvePulseIndexKey: (key) => {
      if (key == null) return null;
      const lookupKey = String(key);
      const entry = lastRenderMeta.positionLookup.get(lookupKey);
      return entry ? entry.pulseIndex : null;
    },
    getEntryMetadata: (key) => {
      if (key == null) return null;
      const lookupKey = String(key);
      const entry = lastRenderMeta.positionLookup.get(lookupKey);
      if (!entry) return null;
      return {
        positionKey: key,
        pulseIndex: entry.pulseIndex,
        event: entry.event || null,
        generated: !!entry.generated,
        selectionKey: entry.selectionKey || (entry.event?.selectionKey ?? null)
      };
    },
  };
}

export default createRhythmStaff;
