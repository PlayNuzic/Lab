import { Renderer, Stave, StaveNote, Voice, Formatter, Tuplet, BarlineType } from '../vendor/vexflow/entry/vexflow.js';

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

export function createRhythmStaff({ container } = {}) {
  if (!container) {
    throw new Error('createRhythmStaff requires a container element');
  }

  let renderer = null;
  let context = null;
  let cursorElement = null;
  let staveInfo = null;

  const clear = () => {
    if (container) {
      // Guardar cursor si existe antes de limpiar
      const savedCursor = cursorElement;
      container.innerHTML = '';
      // Restaurar cursor después de limpiar
      if (savedCursor && savedCursor.parentElement !== container) {
        container.appendChild(savedCursor);
      }
    }
  };

  const destroy = () => {
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
        height: 100%;
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

  const updateCursor = (progress = 0, isPlaying = false) => {
    const cursor = ensureCursor();
    if (!staveInfo || !isPlaying) {
      cursor.classList.remove('notation-playback-cursor--active');
      cursor.style.opacity = '0';
      return;
    }

    cursor.classList.toggle('notation-playback-cursor--active', isPlaying);
    cursor.style.opacity = '1';

    // Calcular posición X del cursor basado en el progreso (0 a 1)
    const startX = staveInfo.x;
    const endX = staveInfo.x + staveInfo.width;
    const cursorX = startX + (endX - startX) * progress;

    cursor.style.transform = `translateX(${cursorX}px)`;
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
    } = state;

    const events = normalizeEvents(rhythm || state);
    const tuplets = normalizeTuplets(rhythm || state);

    clear();

    const pulses = Array.isArray(positions) ? positions : [];
    const selectedSet = new Set(Array.isArray(selectedIndices) ? selectedIndices : []);

    const widthBase = Math.max(0, Number(lg) || events.length);
    const staveWidth = Math.max(220, HORIZONTAL_MARGIN * 2 + widthBase * 36);

    if (!renderer) {
      renderer = new Renderer(container, Renderer.Backends.SVG);
    }
    renderer.resize(staveWidth + HORIZONTAL_MARGIN * 2, DEFAULT_HEIGHT);
    context = renderer.getContext();

    const stave = new Stave(HORIZONTAL_MARGIN, 48, staveWidth);
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

    if (!events.length) {
      return;
    }

    const entries = events.map((event, index) => {
      const pulseIndex = Number.isFinite(event?.pulseIndex)
        ? Number(event.pulseIndex)
        : (Number.isFinite(pulses[index]) ? Number(pulses[index]) : index);

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

      return {
        event,
        pulseIndex,
        note,
      };
    });

    const voice = new Voice({ numBeats: 4, beatValue: 4 });
    voice.setStrict(false);
    voice.addTickables(entries.map((entry) => entry.note));

    const formatter = new Formatter();
    formatter.joinVoices([voice]).format([voice], staveWidth - 40);
    voice.draw(context, stave);

    const renderedTuplets = [];
    const noteLookup = entries.map((entry) => entry.note);

    const createTuplet = (noteIndices, ratio) => {
      const tupletNotes = noteIndices
        .map((idx) => noteLookup[idx])
        .filter((note) => note);
      if (tupletNotes.length < 2) return null;

      const numerator = Number(ratio?.numerator) || tupletNotes.length;
      const denominator = Number(ratio?.denominator) || numerator;
      const tuplet = new Tuplet(tupletNotes, {
        numNotes: numerator,
        notesOccupied: denominator,
        ratioed: true,
        location: Tuplet.LOCATION_TOP,
      });
      tuplet.setTupletLocation(Tuplet.LOCATION_TOP);
      renderedTuplets.push(tuplet);
      return tuplet;
    };

    if (tuplets.length) {
      tuplets.forEach((group) => {
        const indices = Array.isArray(group?.noteIndices) ? group.noteIndices : [];
        createTuplet(indices, group);
      });
    } else if (fraction && Number.isFinite(fraction.numerator) && fraction.numerator > 0) {
      // Crear tuplets por ciclo en vez de todo el Lg
      const cycleLength = Math.round(fraction.numerator);
      const totalNotes = entries.length;

      // Iterar por ciclos completos
      for (let start = 0; start < totalNotes; start += cycleLength) {
        const end = Math.min(start + cycleLength, totalNotes);
        const cycleIndices = [];

        // Recopilar TODOS los índices del ciclo (notas Y silencios)
        // Los silencios cuentan para el tiempo del ciclo
        for (let i = start; i < end; i++) {
          cycleIndices.push(i);
        }

        // Crear tuplet solo si tenemos al menos 2 elementos Y es un ciclo completo
        if (cycleIndices.length >= 2 && (end - start) === cycleLength) {
          createTuplet(cycleIndices, fraction);
        }
      }
    }

    renderedTuplets.forEach((tuplet) => {
      tuplet.setContext(context).draw();
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
      }
    });
  };

  return {
    render,
    destroy,
    updateCursor,
    resetCursor,
  };
}

export default createRhythmStaff;
