// ─────────────────────────────────────────────────────────────────────────────
// notation-system.js — Sistema de pentagrames APILATS amb UN SOL formatter.
//
// F6.scroll (App4): substitueix els N renders independents de rhythm-staff (un
// SVG i un Formatter per pentagrama → cops simultanis NO alineats) per UN SOL
// SVG amb N pentagrames (Y creixent) formatats per UN SOL Formatter de VexFlow.
//
// Per què això alinea els cops per temps: el Formatter construeix els
// TickContext indexats pel tick ACUMULAT (createTickContexts → integerTicks de
// Voice.ticksUsed); dues notes de pentagrames diferents que cauen al mateix
// tick (= mateix instant temporal) comparteixen TickContext i, per tant, la
// mateixa x. Com que el pentagrama base "Pulso" té una nota a CADA pols enter,
// i cada fracció cau sobre un pols enter cada n polsos, aquestes marques
// queden bloquejades a la mateixa columna. (Verificat: docs/ probe — 107/107
// marques fracció-sobre-enter comparteixen la x del base, fins i tot al pitjor
// cas 5/2+6/5+7/3 amb Lg=210.)
//
// Model NET d'App4: Lg = cicle gran × m és SEMPRE múltiple del cicle de cada
// fracció → cap pols remainder ni tuplet incomplet. Cada fracció enrajola la
// línia amb cicles uniformes de `d` subdivisions sobre `n` polsos base, i totes
// les veus arriben EXACTAMENT al mateix total de ticks (la capacitat 4/4 de la
// signatura) → el Formatter compartit NO llança TickMismatch.
//
// NO toca rhythm-staff.js (App2/App5 hi depenen directament). Reutilitza els
// helpers compartits buildPulseEvents (via renderer) i resolveFractionNotation,
// i gridFromOrigin (libs/app-common/subdivision.js, només lectura) per a la
// graella de subdivisions.
// ─────────────────────────────────────────────────────────────────────────────
import { Renderer, Stave, StaveNote, Voice, Formatter, Tuplet, Beam, Dot, BarlineType } from '../vendor/vexflow/entry/vexflow-nuzic.js';
import { gridFromOrigin } from '../app-common/subdivision.js';
import { resolveFractionNotation } from './fraction-notation.js';

// Constants geomètriques (rem→px via càlcul a fora; aquí píxels SVG interns).
const HORIZONTAL_MARGIN = 18;     // marge esquerre/dret de cada pentagrama
const TOP_MARGIN = 28;            // marge superior del primer pentagrama
const STAVE_SPACING = 96;         // separació vertical entre pentagrames apilats
const PX_PER_EVENT = 56;          // amplada per event (mateix criteri que rhythm-staff)
const MIN_INNER_WIDTH = 320;      // amplada interior mínima
const FORMAT_PADDING = 40;        // marge que es resta a format() (com rhythm-staff)
const RESOLUTION = 16384;         // VexFlow Tables.RESOLUTION (negra = /4)
const QUARTER_TICKS = RESOLUTION / 4;

// duration string (sense 'r') → ticks intrínsecs (sense puntets).
const DURATION_TICKS = {
  w: RESOLUTION, h: RESOLUTION / 2, q: RESOLUTION / 4,
  '8': RESOLUTION / 8, '16': RESOLUTION / 16, '32': RESOLUTION / 32, '64': RESOLUTION / 64
};

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const POSITION_SCALE = 1e6;
const POSITION_EPSILON = 1e-6;

function makePositionKey(value) {
  if (!Number.isFinite(value)) return null;
  return Math.round(value * POSITION_SCALE);
}

function isWholePulse(value) {
  if (!Number.isFinite(value)) return false;
  return Math.abs(value - Math.round(value)) <= POSITION_EPSILON;
}

// Ticks d'una figura amb puntets (cada puntet afegeix meitat de l'anterior).
function figureTicks(duration, dots = 0) {
  const base = DURATION_TICKS[duration];
  if (!Number.isFinite(base)) return null;
  let current = base;
  let total = base;
  for (let i = 0; i < dots; i += 1) { current /= 2; total += current; }
  return total;
}

/**
 * Pla de tuplet per a UNA fracció n/d (cicle de `d` subdivisions sobre `n`
 * polsos base). Figura = resolveFractionNotation(n,d) (les MATEIXES regles i
 * glyphs que rhythm-staff/App2/App5). El tuplet ha de fer que el cicle ompli
 * EXACTAMENT `n` negres de ticks perquè totes les veus comparteixin total:
 *   notesOccupied = (n · negraTicks) / figuraTicks   (racional exacte; VexFlow
 *   guarda Fraction → ticks exactes encara que notesOccupied no sigui enter).
 *
 * - figura potència de 2 i n·negra/figura == d  →  cap tuplet (notes planes).
 * - notesOccupied enter  →  ràtio neta d:notesOccupied (ratioed visible).
 * - notesOccupied no enter (només n=5/7 amb figura amb puntet/rodona)  →
 *   s'amaga la ràtio (ratioed:false): es mostra només el compte `d`.
 *
 * @param {number} n numerador (polsos base per cicle)
 * @param {number} d denominador (subdivisions per cicle)
 * @returns {{ duration, dots, numNotes, notesOccupied, ratioed, needsTuplet, beamable }}
 */
export function fractionTupletPlan(n, d) {
  const notation = resolveFractionNotation(n, d);
  const duration = notation?.duration || '16';
  const dots = Number.isFinite(notation?.dots) ? Math.max(0, Math.floor(notation.dots)) : 0;
  const figTicks = figureTicks(duration, dots) || (RESOLUTION / 16);
  const notesOccupied = (n * QUARTER_TICKS) / figTicks;
  const notesOccupiedIsInt = Number.isInteger(notesOccupied);
  // Cap tuplet quan d notes de la figura ja omplen el cicle (potència de 2 neta).
  const needsTuplet = !(notesOccupiedIsInt && notesOccupied === d);
  // Figures amb plica i bandera (corxera i més curtes) → es poden lligar (beam).
  const beamable = duration === '8' || duration === '16' || duration === '32' || duration === '64';
  return {
    duration,
    dots,
    numNotes: d,
    notesOccupied,
    // Ràtio visible només si és un enter "net"; si no, compte sol.
    ratioed: needsTuplet && notesOccupiedIsInt,
    needsTuplet,
    beamable
  };
}

/**
 * Crea el controlador del sistema de pentagrames.
 *
 * @param {Object} cfg
 * @param {HTMLElement} cfg.container - amfitrió de l'SVG (té el scroll-x a fora)
 * @param {Function} [cfg.onPulseSelected] - (pulseValue:number, shouldSelect:boolean)
 * @param {Function} [cfg.onFractionSelected] - (info, shouldSelect:boolean)
 * @param {Function} [cfg.createFractionSelectionFromValue] - (value, {denominator, pulsesPerCycle}) → info
 * @param {Object} [cfg.fractionStore] - { selectionState: Map<key,info> } per al toggle directe
 * @returns {{ render, updateCursor, clearCursor, resetCursor, destroy, getElement, getSVGElement }}
 */
export function createNotationSystem({
  container,
  onPulseSelected,
  onFractionSelected,
  createFractionSelectionFromValue,
  fractionStore
} = {}) {
  if (!container) {
    throw new Error('createNotationSystem requires a container element');
  }

  container.classList.add('notation-system-container');
  if (typeof window !== 'undefined' && window.getComputedStyle) {
    const pos = window.getComputedStyle(container).position;
    if (!pos || pos === 'static') container.style.position = 'relative';
  } else if (!container.style.position) {
    container.style.position = 'relative';
  }

  let renderer = null;
  let context = null;
  let cursorElement = null;

  // Metadada de l'últim render (per al cursor i diagnòstic).
  // staves: [{ id, isBase, noteStartX, contentWidth, top, height, marks: [{ time, x }] }]
  let lastLayout = { lg: 0, contentWidth: 0, staves: [] };

  // ── Cursor (UNA línia vertical que travessa TOT el sistema) ────────────────
  function ensureCursor() {
    if (!cursorElement || !cursorElement.parentElement) {
      cursorElement = document.createElement('div');
      cursorElement.className = 'notation-playback-cursor notation-system-cursor';
      cursorElement.style.cssText = [
        'position:absolute', 'top:0', 'left:0', 'width:2px', 'height:0',
        'background:var(--selection-color, #F97C39)', 'opacity:0',
        'pointer-events:none', 'transition:opacity 0.2s ease', 'z-index:10',
        'transform-origin:left center'
      ].join(';');
      container.appendChild(cursorElement);
    }
    return cursorElement;
  }

  // ── Construcció d'una veu de pentagrama a partir d'un estat ────────────────
  // Retorna { voice, notes: [{ note, time, pulseValue|null, selectionKey|null,
  //   isBase, nonSelectable }], tuplets: [Tuplet], beams: [Beam] }.
  function buildStaveVoice(state) {
    const lg = Number(state.lg) || 0;
    const isBase = !!state.isBase;
    const numerator = Number(state.numerator);
    const denominator = Number(state.denominator);
    const hasFraction = !isBase
      && Number.isFinite(numerator) && numerator > 0
      && Number.isFinite(denominator) && denominator > 0;

    const voice = new Voice({ numBeats: 4, beatValue: 4 }).setStrict(false);
    const notes = [];
    const tuplets = [];
    const beams = [];

    // Conjunt de seleccions per posició (value → event amb selectionKey).
    const eventByPos = new Map();
    (Array.isArray(state.events) ? state.events : []).forEach((ev) => {
      const key = makePositionKey(ev?.pulseIndex);
      if (key != null) eventByPos.set(key, ev);
    });
    const selectedSet = new Set();
    (Array.isArray(state.selectedIndices) ? state.selectedIndices : []).forEach((v) => {
      const num = Number(v);
      if (Number.isFinite(num)) selectedSet.add(makePositionKey(num));
    });

    const isSelectedAt = (pos) => selectedSet.has(makePositionKey(pos));

    const makeNote = (duration, isRest, dots) => {
      const dur = isRest ? `${duration}r` : duration;
      const note = new StaveNote({ clef: 'treble', duration: dur, keys: [isRest ? 'b/4' : 'c/5'], dots: dots || 0 });
      if (dots) Dot.buildAndAttach([note], { all: true });
      return note;
    };

    if (isBase || !hasFraction) {
      // ── Pentagrama base "Pulso": lg negres (nota si seleccionat, silenci si no).
      // El pols 0 és sempre nota (origen). Cap tuplet.
      for (let i = 0; i < lg; i += 1) {
        const sel = i === 0 || isSelectedAt(i);
        const note = makeNote('q', !sel, 0);
        notes.push({ note, time: i, pulseValue: i, selectionKey: null, isBase: true, nonSelectable: i === 0 });
      }
      voice.addTickables(notes.map((n) => n.note));
      return { voice, notes, tuplets, beams };
    }

    // ── Pentagrama de fracció: graella de `d` subdivisions per cicle de `n`.
    const plan = fractionTupletPlan(numerator, denominator);
    const grid = gridFromOrigin({ lg, numerator, denominator });
    const subdivisions = Array.isArray(grid?.subdivisions) ? grid.subdivisions : [];

    // Agrupar per cicle per crear un tuplet (i un beam) per cicle.
    const byCycle = new Map();
    subdivisions.forEach((sub) => {
      if (!byCycle.has(sub.cycleIndex)) byCycle.set(sub.cycleIndex, []);
      byCycle.get(sub.cycleIndex).push(sub);
    });

    Array.from(byCycle.keys()).sort((a, b) => a - b).forEach((cycleIndex) => {
      const cycleSubs = byCycle.get(cycleIndex).sort((a, b) => a.subdivisionIndex - b.subdivisionIndex);
      const cycleNotes = [];
      cycleSubs.forEach((sub) => {
        const pos = sub.position;
        const whole = isWholePulse(pos);
        const wholeValue = whole ? Math.round(pos) : null;
        const posKey = makePositionKey(pos);
        const ev = eventByPos.get(posKey);
        // Sona si: hi ha un event no-silenci en aquesta posició (selecció
        // fraccionada amb la n/d d'aquesta fracció), o és un enter seleccionat,
        // o és el pols 0 (origen). Si no, silenci.
        const selectedFraction = ev && ev.rest === false;
        const selectedWhole = whole && (wholeValue === 0 || isSelectedAt(wholeValue));
        const sounding = !!(selectedFraction || selectedWhole);
        const note = makeNote(plan.duration, !sounding, plan.dots);
        cycleNotes.push(note);
        notes.push({
          note,
          time: pos,
          // Un enter (inclòs el k·n/d que cau sobre enter) ruta al pols base;
          // una subdivisió fraccionada ruta a la fracció (n/d d'aquest slot).
          pulseValue: whole ? wholeValue : null,
          fractionValue: whole ? null : pos,
          selectionKey: ev?.selectionKey || null,
          isBase: false,
          numerator,
          denominator,
          // El pols 0 i els ticks que coincideixen amb un enter NO són
          // seleccionables com a fracció (ja viuen al pentagrama base / origen).
          nonSelectable: pos === 0
        });
      });
      // CRÍTIC: crear el Tuplet ABANS d'afegir les notes a la veu. El Tuplet
      // aplica el multiplicador de ticks (notesOccupied/numNotes) a cada nota;
      // si s'afegeixen a la veu PRIMER, la veu congela resolutionMultiplier=1
      // (denominador dels ticks intrínsecs) i el Formatter compartit acaba amb
      // resolutionMultiplier=1 → els TickContext de la fracció NO col·lideixen
      // amb els del base (cops desalineats). Amb el Tuplet abans, la veu veu
      // ticks tipus 8192/3 → resolutionMultiplier=d → LCM compartit correcte.
      if (cycleNotes.length >= 2 && plan.needsTuplet) {
        const tuplet = new Tuplet(cycleNotes, {
          numNotes: plan.numNotes,
          notesOccupied: plan.notesOccupied,
          ratioed: plan.ratioed,
          bracketed: true,
          location: Tuplet.LOCATION_TOP
        });
        tuplet.setTupletLocation(Tuplet.LOCATION_TOP);
        tuplets.push(tuplet);
      }
      voice.addTickables(cycleNotes);
      // Beam de les notes sonants beamables del cicle (les pliques juntes).
      if (plan.beamable) {
        const beamable = cycleNotes.filter((nt) => typeof nt.isRest === 'function' && !nt.isRest());
        if (beamable.length >= 2) beams.push(new Beam(beamable));
      }
    });

    return { voice, notes, tuplets, beams };
  }

  // ── Acoloreix una nota/tuplet/beam amb el color d'identitat ────────────────
  function applyColor(element, color) {
    if (!color || !element || typeof element.setStyle !== 'function') return false;
    element.setStyle({ fillStyle: color, strokeStyle: color });
    return true;
  }

  // ── Render principal ───────────────────────────────────────────────────────
  // state = { lg, staves: [{ id, label, color, numerator, denominator, events,
  //   selectedIndices, isBase }, ...] } (base primer, després fraccions).
  function render(state = {}) {
    const lg = Number(state?.lg) || 0;
    const staveStates = Array.isArray(state?.staves) ? state.staves : [];

    if (!renderer) {
      renderer = new Renderer(container, Renderer.Backends.SVG);
    }

    if (lg <= 0 || !staveStates.length) {
      // Res a dibuixar: neteja l'SVG i amaga el cursor.
      renderer.resize(MIN_INNER_WIDTH + HORIZONTAL_MARGIN * 2, TOP_MARGIN + STAVE_SPACING);
      context = renderer.getContext();
      if (typeof context.clear === 'function') context.clear();
      clearCursor();
      lastLayout = { lg: 0, contentWidth: 0, staves: [] };
      return;
    }

    // Construir totes les veus PRIMER (cal saber-ne l'amplada i el nombre).
    const built = staveStates.map((st) => ({ st, ...buildStaveVoice({ ...st, lg }) }));

    // Amplada interior compartida: prou ample per al pentagrama més dens.
    const maxNotes = built.reduce((m, b) => Math.max(m, b.notes.length), 0);
    const innerWidth = Math.max(MIN_INNER_WIDTH, maxNotes * PX_PER_EVENT);
    const totalWidth = innerWidth + HORIZONTAL_MARGIN * 2;
    const totalHeight = TOP_MARGIN + built.length * STAVE_SPACING;

    renderer.resize(totalWidth, totalHeight);
    context = renderer.getContext();
    if (typeof context.clear === 'function') context.clear();

    // Un Stave per veu, a Y creixent; mateixa x i amplada → primeres notes
    // alineades. Clau de sol a tots (mateix note-start-x).
    const staves = built.map((b, i) => {
      const y = TOP_MARGIN + i * STAVE_SPACING;
      const stave = new Stave(HORIZONTAL_MARGIN, y, innerWidth);
      stave.addClef('treble');
      stave.setBegBarType(BarlineType.SINGLE);
      stave.setEndBarType(BarlineType.END);
      stave.setContext(context).draw();
      b.voice.setStave(stave);
      b.stave = stave;
      return stave;
    });

    // Etiqueta de cada pentagrama (Pulso / n/d) com a text SVG, acolorida amb
    // la identitat del slot (base = fosc). Es dibuixa damunt la clau, al marge
    // superior del pentagrama, sense desplaçar les notes (no afecta el tick).
    if (typeof context.save === 'function') {
      built.forEach((b) => {
        const label = (typeof b.st.label === 'string' ? b.st.label : '').trim();
        if (!label) return;
        const color = (typeof b.st.color === 'string' && b.st.color.trim()) ? b.st.color.trim() : '#43433B';
        context.save();
        if (typeof context.setFont === 'function') context.setFont('Ubuntu, system-ui, sans-serif', 13, 'bold');
        if (typeof context.setFillStyle === 'function') context.setFillStyle(color);
        // y = una mica per sobre de la línia superior del pentagrama.
        const labelY = (b.stave.getYForLine ? b.stave.getYForLine(0) : b.stave.getY()) - 6;
        context.fillText(label, HORIZONTAL_MARGIN, labelY);
        context.restore();
      });
    }

    // ── UN SOL Formatter per a TOTES les veus ──
    // joinVoices per veu (cada veu té el seu propi pentagrama → ModifierContext
    // per stave), després format(totes) construeix TickContext compartits
    // indexats per tick → alineació cross-stave per temps.
    const allVoices = built.map((b) => b.voice);
    const formatter = new Formatter();
    built.forEach((b) => formatter.joinVoices([b.voice]));
    formatter.format(allVoices, innerWidth - FORMAT_PADDING);

    // Acolorir notes ABANS de dibuixar la veu (la veu aplica l'estil de cada
    // tickable). Es respecten silencis: també prenen el color (com rhythm-staff).
    built.forEach((b) => {
      const color = (typeof b.st.color === 'string' && b.st.color.trim()) ? b.st.color.trim() : null;
      if (!color) return;
      b.notes.forEach((entry) => applyColor(entry.note, color));
    });

    // Dibuixar cada veu al seu pentagrama (les notes ja tenen la x del seu
    // TickContext compartit → cops simultanis a la mateixa columna).
    built.forEach((b) => b.voice.draw(context, b.stave));

    // Guarda d'ordre: el formatter compartit de VexFlow indexa els TickContext
    // per ticks ENTERS sobre RESOLUTION=2¹⁴ (no divisible per 11/10), de manera
    // que els tuplets densos de ratio no-potència-de-2 (5/11, 7/10, 7/11) poden
    // quedar amb les notes DESORDENADES en x → `Tuplet.draw` calcula width =
    // lastNote.getStemX() − firstNote.getStemX() NEGATIVA i emet un <rect> amb
    // amplada negativa (error de consola + render brut). Detectem la no-
    // monotonia i OMETEM el tuplet/beam d'aquestes fraccions exòtiques: la
    // resta (totes les fraccions comunes) es manté perfecta i alineada, sense
    // contaminar la consola ni petar el render.
    const isMonotonic = (notes) => {
      if (!Array.isArray(notes) || notes.length < 2) return true;
      for (let i = 1; i < notes.length; i += 1) {
        const a = notes[i - 1];
        const c = notes[i];
        if (typeof a?.getStemX !== 'function' || typeof c?.getStemX !== 'function') return true;
        if (c.getStemX() < a.getStemX()) return false;
      }
      return true;
    };

    // Tuplets i beams (acolorits si cal), saltant els no-monotònics (exòtics).
    built.forEach((b) => {
      const color = (typeof b.st.color === 'string' && b.st.color.trim()) ? b.st.color.trim() : null;
      b.tuplets.forEach((tuplet) => {
        if (!isMonotonic(tuplet?.notes)) return;
        tuplet.setContext(context);
        if (color && typeof tuplet.setStyle === 'function' && typeof tuplet.drawWithStyle === 'function') {
          tuplet.setStyle({ fillStyle: color, strokeStyle: color });
          tuplet.drawWithStyle();
        } else {
          tuplet.draw();
        }
      });
      b.beams.forEach((beam) => {
        if (!isMonotonic(beam?.notes)) return;
        beam.setContext(context);
        if (color && typeof beam.setStyle === 'function' && typeof beam.drawWithStyle === 'function') {
          beam.setStyle({ fillStyle: color, strokeStyle: color });
          beam.drawWithStyle();
        } else {
          beam.draw();
        }
      });
    });

    // ── Etiquetar cada grup SVG de nota i recollir la geometria ──
    // (data-staff-id, data-pulse / data-fraction-value + n/d, data-selection-key)
    const layoutStaves = built.map((b) => {
      const stave = b.stave;
      const noteStartX = typeof stave.getNoteStartX === 'function' ? stave.getNoteStartX() : stave.getX();
      const top = stave.getYForLine ? stave.getYForLine(0) : stave.getY();
      const height = typeof stave.getHeight === 'function' ? stave.getHeight() : STAVE_SPACING;
      const marks = [];
      b.notes.forEach((entry) => {
        const note = entry.note;
        let el = note?.attrs?.el;
        if (!el && typeof note.getSVGElement === 'function') {
          try { el = note.getSVGElement(); } catch { el = null; }
        }
        // x real de la nota (per al diagnòstic d'alineació i el cursor).
        let x = null;
        const tc = typeof note.getTickContext === 'function' ? note.getTickContext() : null;
        if (tc && typeof tc.getX === 'function') x = tc.getX();
        marks.push({ time: entry.time, x });
        if (!el) return;
        el.dataset.staffId = String(b.st.id);
        if (entry.nonSelectable) el.dataset.nonSelectable = 'true'; else delete el.dataset.nonSelectable;
        if (entry.selectionKey) el.dataset.selectionKey = String(entry.selectionKey); else delete el.dataset.selectionKey;
        if (entry.pulseValue != null) {
          el.dataset.pulse = String(entry.pulseValue);
          delete el.dataset.fractionValue;
        } else if (entry.fractionValue != null) {
          el.dataset.fractionValue = String(entry.fractionValue);
          el.dataset.num = String(entry.numerator);
          el.dataset.den = String(entry.denominator);
          delete el.dataset.pulse;
        }
      });
      return {
        id: b.st.id,
        isBase: !!b.st.isBase,
        noteStartX,
        top,
        height,
        marks
      };
    });

    // Amplada de contingut per al càlcul del cursor per temps: de la primera
    // nota (pols 0) a l'última columna. Es deriva de les marques del base.
    const baseLayout = layoutStaves.find((s) => s.isBase) || layoutStaves[0];
    let contentStartX = baseLayout ? baseLayout.noteStartX : HORIZONTAL_MARGIN;
    let contentEndX = innerWidth + HORIZONTAL_MARGIN;
    if (baseLayout && baseLayout.marks.length) {
      const xs = baseLayout.marks.map((m) => m.x).filter((x) => Number.isFinite(x));
      if (xs.length) {
        contentStartX = Math.min(...xs);
        contentEndX = Math.max(...xs);
      }
    }

    lastLayout = {
      lg,
      contentStartX,
      contentEndX,
      contentWidth: Math.max(1, contentEndX - contentStartX),
      systemTop: TOP_MARGIN,
      systemHeight: totalHeight - TOP_MARGIN,
      staves: layoutStaves
    };

    // Reposicionar el cursor (visible, a pols 0) després del render.
    resetCursor();
  }

  // ── Cursor per TEMPS (consistent entre pentagrames) ────────────────────────
  // x = contentStartX + (positionInPulses / lg) * contentWidth.
  function updateCursor(positionInPulses = 0, isPlaying = false) {
    const cursor = ensureCursor();
    if (!lastLayout || lastLayout.lg <= 0) {
      cursor.style.opacity = '0';
      cursor.classList.remove('notation-playback-cursor--active');
      return;
    }
    cursor.style.opacity = '';
    cursor.classList.add('notation-playback-cursor--active');

    const lg = lastLayout.lg;
    const pos = Number.isFinite(positionInPulses) ? ((positionInPulses % lg) + lg) % lg : 0;
    const frac = lg > 0 ? pos / lg : 0;
    const x = lastLayout.contentStartX + frac * lastLayout.contentWidth;

    cursor.style.top = `${lastLayout.systemTop}px`;
    cursor.style.height = `${lastLayout.systemHeight}px`;
    cursor.style.transform = `translateX(${x}px)`;

    if (isPlaying) maybeAutoScroll(x);
  }

  function maybeAutoScroll(cursorX) {
    const canvas = container.closest('.notation-panel__canvas') || container.parentElement;
    if (!canvas) return;
    const cursorViewportX = cursorX - canvas.scrollLeft;
    const clientWidth = canvas.clientWidth;
    const margin = 50;
    if (cursorViewportX < margin) {
      canvas.scrollLeft = Math.max(0, cursorX - margin);
    } else if (cursorViewportX > clientWidth - margin) {
      canvas.scrollLeft = cursorX - clientWidth + margin;
    }
  }

  function clearCursor() {
    const cursor = ensureCursor();
    cursor.style.opacity = '0';
    cursor.classList.remove('notation-playback-cursor--active');
  }

  function resetCursor() {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => updateCursor(0, false));
    } else {
      updateCursor(0, false);
    }
  }

  // ── Clic (delegació única a l'SVG) ─────────────────────────────────────────
  function handleClick(event) {
    const target = event && event.target;
    // El grup SVG de la nota porta els data-* (openGroup amb l'id de l'element).
    if (!target || typeof target.closest !== 'function') return;
    const noteEl = target.closest('[data-staff-id]');
    if (!noteEl) return;
    if (noteEl.dataset.nonSelectable === 'true') return;

    // 1. Selecció fraccionada ja existent (té selectionKey): toggle directe.
    const selectionKey = noteEl.dataset.selectionKey;
    if (selectionKey && fractionStore && fractionStore.selectionState) {
      const info = fractionStore.selectionState.get(selectionKey);
      if (info && typeof onFractionSelected === 'function') {
        const currentlySelected = fractionStore.selectionState.has(selectionKey);
        onFractionSelected(info, !currentlySelected);
      }
      return;
    }

    // 2. Pols enter: ruta al canal base (memòria de pulsos).
    if (noteEl.dataset.pulse != null) {
      const pulseValue = Number.parseFloat(noteEl.dataset.pulse);
      if (!Number.isFinite(pulseValue) || pulseValue <= 0) return;
      if (lastLayout.lg > 0 && pulseValue >= lastLayout.lg) return;
      if (typeof onPulseSelected === 'function') {
        // shouldSelect el decideix App4 segons la memòria; aquí proposem toggle
        // a partir de l'estat visual (data-selected no s'usa: App4 ho recalcula).
        onPulseSelected(pulseValue, true);
      }
      return;
    }

    // 3. Tick fraccionat nou: la (n,d) ve del propi grup (data-num/den).
    if (noteEl.dataset.fractionValue != null && typeof createFractionSelectionFromValue === 'function') {
      const value = Number.parseFloat(noteEl.dataset.fractionValue);
      const denominator = Number.parseInt(noteEl.dataset.den, 10);
      const numerator = Number.parseInt(noteEl.dataset.num, 10);
      if (!Number.isFinite(value) || !Number.isFinite(denominator) || denominator <= 0) return;
      const pulsesPerCycle = Number.isFinite(numerator) && numerator > 0 ? numerator : null;
      const nextSelection = createFractionSelectionFromValue(value, { denominator, pulsesPerCycle });
      if (!nextSelection) return;
      if (lastLayout.lg > 0 && (nextSelection.value <= 0 || nextSelection.value >= lastLayout.lg)) return;
      const currentlySelected = !!(fractionStore && fractionStore.selectionState
        && fractionStore.selectionState.has(nextSelection.key));
      if (typeof onFractionSelected === 'function') onFractionSelected(nextSelection, !currentlySelected);
    }
  }

  container.addEventListener('click', handleClick);

  function destroy() {
    container.removeEventListener('click', handleClick);
    if (context && typeof context.clear === 'function') {
      try { context.clear(); } catch {}
    }
    if (cursorElement && cursorElement.parentElement) {
      cursorElement.parentElement.removeChild(cursorElement);
    }
    container.classList.remove('notation-system-container');
    renderer = null;
    context = null;
    cursorElement = null;
    lastLayout = { lg: 0, contentWidth: 0, staves: [] };
  }

  return {
    render,
    updateCursor,
    clearCursor,
    resetCursor,
    destroy,
    getElement: () => container.querySelector('svg'),
    getSVGElement: () => container.querySelector('svg'),
    // Exposat per a tests/diagnòstic: geometria del darrer render.
    getLayout: () => lastLayout
  };
}

export default createNotationSystem;
