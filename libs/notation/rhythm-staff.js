import { Renderer, Stave, StaveNote, Voice, Formatter, Tuplet, BarlineType, Beam } from '../vendor/vexflow/entry/vexflow.js';
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

  const updateCursor = (progress = 0, isPlaying = false) => {
    const cursor = ensureCursor();
    if (!staveInfo) {
      cursor.classList.remove('notation-playback-cursor--active');
      cursor.style.opacity = '0';
      return;
    }

    const normalized = Number.isFinite(progress) ? Math.min(Math.max(progress, 0), 1) : 0;
    const startX = Number.isFinite(staveInfo.contentStartX) ? staveInfo.contentStartX : staveInfo.x;
    const endXBase = Number.isFinite(staveInfo.contentEndX)
      ? staveInfo.contentEndX
      : staveInfo.x + staveInfo.width;
    const usableWidth = Math.max(0, endXBase - startX);
    const cursorX = startX + usableWidth * normalized;

    cursor.style.top = `${staveInfo.y}px`;
    cursor.style.height = `${staveInfo.height}px`;
    cursor.style.transform = `translateX(${cursorX}px)`;
    cursor.classList.toggle('notation-playback-cursor--active', isPlaying);
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
    const selectedSet = new Set(
      (Array.isArray(selectedIndices) ? selectedIndices : [])
        .map((value) => {
          const numeric = Number(value);
          return Number.isFinite(numeric) ? numeric : null;
        })
        .filter((value) => value != null)
    );

    const entryBuckets = new Map();
    const entryList = [];

    const registerEntry = (entry) => {
      const key = makePositionKey(entry.pulseIndex);
      if (key != null) {
        if (!entryBuckets.has(key)) {
          entryBuckets.set(key, []);
        }
        entryBuckets.get(key).push(entry);
      }
      entryList.push(entry);
      return entry;
    };

    events.forEach((event, index) => {
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
            existing.forEach((entry) => {
              if (entry.tupletCycle == null) entry.tupletCycle = cycleIndex;
              if (entry.subdivisionIndex == null) entry.subdivisionIndex = subdivisionIndex;
            });
            return;
          }

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
        });
      }
    }

    const widthBase = Math.max(0, Number(lg) || fractionGrid?.subdivisions?.length || events.length);
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

    if (!events.length && !entryList.length) {
      resetCursor();
      return;
    }

    const entries = entryList
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

    const voice = new Voice({ numBeats: 4, beatValue: 4 });
    voice.setStrict(false);
    voice.addTickables(entries.map((entry) => entry.note));

    const formatter = new Formatter();
    formatter.joinVoices([voice]).format([voice], staveWidth - 40);
    voice.draw(context, stave);

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

      const beamableNotes = tupletNotes.filter(shouldBeamNote);
      if (beamableNotes.length > 1) {
        tupletBeams.push(new Beam(beamableNotes));
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

    resetCursor();
  };

  return {
    render,
    destroy,
    updateCursor,
    resetCursor,
  };
}

export default createRhythmStaff;
