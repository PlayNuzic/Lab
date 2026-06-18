// libs/app-common/circular-rings.js
//
// Anells concèntrics SVG per a apps de fraccions múltiples (App4 F5):
// l'anell base (pols, referència fixa R0) + un anell per fracció activa.
// La geometria és l'aprovada a docs/app4-rings-sketch.html:
//   - radi ideal ∝ velocitat: r = R0 · s^k amb s = d/n (k = 0.35)
//   - regla de separació: ràpids enfora, lents endins, GAP mínim
//   - densitat adaptativa: mida de punt, etiquetes "mode rellotge",
//     línies radials de cicle espaiades si n'hi ha massa
//
// Disseny state-in / events-out: render() rep l'estat complet (lg,
// bigCycle, punts seleccionats...) i només emet onDotClick. El highlight
// de reproducció és barat (toggle de classes sobre una cache d'elements,
// mai re-render).
//
// L'estil viu a libs/app-common/circular-rings.css (classes crings-*);
// els atributs de presentació SVG es posen també com a fallback, però el
// tema (colors per anell via --crings-color/--crings-light, estats
// selected/active) és cosa del CSS.
//
// Ús:
//   import { createCircularRings } from '../../libs/app-common/circular-rings.js';
//   const rings = createCircularRings({ container, onDotClick: (info) => {...} });
//   rings.render({ lg, bigCycle, base: {...}, fractions: [...] });
//   rings.highlightPosition(posEnPulsos);
//   rings.clearHighlights();

const NS = 'http://www.w3.org/2000/svg';

/**
 * Constants de geometria de l'esbós aprovat (px del viewBox 580×580).
 * @type {Readonly<Object>}
 */
export const RING_GEOMETRY = Object.freeze({
  VIEWBOX: 580,            // costat del viewBox
  C: 290,                  // centre (x = y)
  R0: 155,                 // radi de l'anell base (referència fixa)
  RMIN: 42,                // clamp inferior del radi ideal
  RMAX: 270,               // clamp superior absolut (pujat perquè 4 bandes de
                           //   32px càpiguen sense solapar quan totes les
                           //   fraccions són ràpides → totes cap enfora)
  GAP: 40,                 // separació mínima entre anells (≥ RING_STROKE perquè
                           //   les bandes gruixudes no se solapin)
  RING_STROKE: 32,         // gruix de la banda de fracció (unitats de viewBox →
                           //   escala amb la mida renderitzada; coincideix amb el CSS)
  BASE_STROKE: 64,         // l'anell base (pulsos) és el doble d'ample: hi caben
                           //   els punts (part exterior) i els números (interior).
                           //   Creix cap ENDINS (vora exterior fixa) → no mou les
                           //   fraccions. Coincideix amb el CSS .crings-ring--base.
  INNER_CLAMP_MARGIN: 14,  // el clamp final permet RMIN - 14 cap endins
  MIN_LABEL_SPACING: 18,   // px d'arc mínims perquè càpiguen tots els números
  CYCLE_LINE_OVERHANG: 8,  // les línies de cicle sobresurten 8px de l'anell base
  MAX_CYCLE_LINES: 24,     // més línies que això → s'espaien
  NEEDLE_OVERHANG: 5,      // l'agulla sobresurt 5px de RMAX
  DEFAULT_K: 0.35          // exponent per defecte de radi ∝ velocitat
});

const {
  C, R0, RMIN, RMAX, GAP, RING_STROKE, BASE_STROKE, INNER_CLAMP_MARGIN,
  MIN_LABEL_SPACING, CYCLE_LINE_OVERHANG, MAX_CYCLE_LINES,
  NEEDLE_OVERHANG, DEFAULT_K
} = RING_GEOMETRY;

// L'anell base ample creix cap endins: la vora exterior es manté a R0+RING_STROKE/2
// (les fraccions, col·locades respecte de R0, no es mouen). Centerline de la banda:
const baseBandCenter = (baseRadius) => baseRadius - (BASE_STROKE - RING_STROKE) / 2;
// Radi dels números: terç INTERIOR de la banda base ampla (clars, sobre el fosc;
// per sota dels punts, que viuen a la part exterior a baseRadius).
const baseNumberRadius = (baseRadius) => baseBandCenter(baseRadius) - BASE_STROKE / 3;

const BASE_COLOR = '#43433B';
const BASE_LIGHT = '#eee8d8';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

/**
 * Versió SATURADA del color d'un anell, per als punts plens (selected/active) i
 * l'origen. Augmenta el croma; els colors FOSCOS s'aclareixen perquè es vegin
 * sobre la seva pròpia banda (un fosc saturat seguiria sent fosc → invisible),
 * i els clars/vius s'aprofundeixen. Manté el to → harmònic amb l'anell.
 * Retorna el color tal qual si no és un hex pla.
 * @param {string} color - Color de l'anell (#rgb o #rrggbb)
 * @returns {string} Hex saturat
 */
export function saturatedAccent(color) {
  if (typeof color !== 'string') return color;
  let hex = color.trim().replace('#', '');
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return color;
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  const s2 = Math.min(1, s * 1.4 + 0.2);
  const l2 = l < 0.4 ? 0.46 : Math.max(0.3, l * 0.8);
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let R = l2, G = l2, B = l2;
  if (s2 !== 0) {
    const q = l2 < 0.5 ? l2 * (1 + s2) : l2 + s2 - l2 * s2;
    const p = 2 * l2 - q;
    R = hue2rgb(p, q, h + 1 / 3); G = hue2rgb(p, q, h); B = hue2rgb(p, q, h - 1 / 3);
  }
  const to = (x) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${to(R)}${to(G)}${to(B)}`;
}

/**
 * Angle (radians) d'una posició en pulsos sobre el cercle.
 * El pols 0 queda a dalt (−π/2) i el temps avança en sentit horari.
 * @param {number} position - Posició en pulsos base
 * @param {number} lg - Longitud total en pulsos
 * @returns {number}
 */
function angleFor(position, lg) {
  return (position / lg) * 2 * Math.PI - Math.PI / 2;
}

/**
 * Radi ideal d'un anell segons la seva velocitat relativa.
 * r = R0 · s^k, retallat a [RMIN, RMAX].
 * @param {number} s - Raó de velocitat (d/n): >1 més ràpid que el pols
 * @param {number} [k=0.35] - Exponent de compressió
 * @returns {number}
 */
export function idealRadius(s, k = DEFAULT_K) {
  return clamp(R0 * Math.pow(s, k), RMIN, RMAX);
}

/**
 * Resol els radis finals de tots els anells: la base queda fixa a R0 com
 * a referència i la resta s'aparta enfora (ràpids) o endins (lents) fins
 * a respectar el GAP mínim. Algorisme exacte de l'esbós, generalitzat a
 * N anells.
 *
 * @param {Array<{id: string, numerator: number, denominator: number}>} actives
 *   Fraccions actives (s = denominator / numerator)
 * @param {number} [k=0.35] - Exponent del radi ideal
 * @returns {Object<string, number>} Mapa id → radi (inclou 'base')
 */
export function resolveRadii(actives = [], k = DEFAULT_K) {
  const list = [
    { id: 'base', r: R0, fixed: true },
    ...actives.map((f) => ({
      id: f.id,
      r: idealRadius(f.denominator / f.numerator, k)
    }))
  ];
  // Empat de radi → el fix (base) primer.
  list.sort((a, b) => (a.r - b.r) || (a.fixed ? -1 : 1));
  const bi = list.findIndex((x) => x.fixed);
  // Enfora des de la base: cadascun com a mínim GAP per sobre de l'anterior.
  for (let i = bi + 1; i < list.length; i++) {
    list[i].r = Math.max(list[i].r, list[i - 1].r + GAP);
  }
  // Endins per sota de la base: cadascun com a màxim GAP per sota del següent.
  // La fracció ADJACENT a la base necessita clearança EXTRA perquè la banda base
  // és ampla i s'estén (BASE_STROKE − RING_STROKE) més endins que una de normal.
  const baseExtraInward = BASE_STROKE - RING_STROKE;
  for (let i = bi - 1; i >= 0; i--) {
    const gapHere = GAP + (list[i + 1].fixed ? baseExtraInward : 0);
    list[i].r = Math.min(list[i].r, list[i + 1].r - gapHere);
  }
  const out = {};
  list.forEach((x) => { out[x.id] = clamp(x.r, RMIN - INNER_CLAMP_MARGIN, RMAX); });
  return out;
}

/**
 * Pas d'etiquetatge dels números de pols ("mode rellotge"): 1 si tots
 * caben amb MIN_LABEL_SPACING px d'arc; si no, un de cada `step`.
 * @param {number} lg - Pulsos totals
 * @param {number} [baseRadius=R0] - Radi de l'anell base
 * @returns {number}
 */
export function computeLabelStep(lg, baseRadius = R0) {
  // Números al terç interior de la banda base ampla: circumferència menor que a
  // fora → el "mode rellotge" entra una mica abans (correcte).
  const labelSpacing = (2 * Math.PI * baseNumberRadius(baseRadius)) / lg;
  return labelSpacing >= MIN_LABEL_SPACING
    ? 1
    : Math.ceil(MIN_LABEL_SPACING / labelSpacing);
}

/**
 * Llista d'etiquetes de pols que es dibuixen: múltiples del pas
 * d'etiquetatge + SEMPRE els inicis de cicle gran (en negreta).
 * @param {number} lg - Pulsos totals
 * @param {number} bigCycle - Cicle gran en pulsos
 * @param {number} [baseRadius=R0] - Radi de l'anell base
 * @returns {Array<{index: number, isCycleStart: boolean}>}
 */
export function computeLabelList(lg, bigCycle, baseRadius = R0) {
  const step = computeLabelStep(lg, baseRadius);
  const labels = [];
  for (let i = 0; i < lg; i++) {
    const isCycleStart = bigCycle > 0 && i % bigCycle === 0;
    if (i % step !== 0 && !isCycleStart) continue;
    labels.push({ index: i, isCycleStart });
  }
  return labels;
}

/**
 * Pas de les línies radials de cicle: múltiples de bigCycle, espaiats si
 * n'hi hauria més de MAX_CYCLE_LINES (ex. cicle = 1 amb Lg gran).
 * @param {number} lg - Pulsos totals
 * @param {number} bigCycle - Cicle gran en pulsos
 * @returns {number}
 */
export function computeCycleLineStep(lg, bigCycle) {
  return bigCycle * Math.ceil((lg / bigCycle) / MAX_CYCLE_LINES);
}

/**
 * Mètriques adaptatives dels punts d'un anell perquè no se solapin en
 * anells densos (ex. 1/12 amb Lg = 24 → 288 punts).
 * @param {number} count - Nombre de punts de l'anell
 * @param {number} radius - Radi de l'anell
 * @param {boolean} [isBase=false] - L'anell base admet punts una mica més grans
 * @returns {{spacing: number, dotR: number, strokeWidth: number}}
 */
export function dotMetrics(count, radius, isBase = false) {
  const spacing = (2 * Math.PI * radius) / count;
  // Cap del radi: 10 a tots els anells (base i fracció; unitats de viewBox →
  // escalen amb la mida renderitzada). Densos: segueixen reduint-se per spacing.
  const dotR = clamp(spacing * 0.3, 1.2, 10);
  const strokeWidth = clamp(dotR * 0.4, 1, 2.5);
  return { spacing, dotR, strokeWidth };
}

/**
 * Crea un element SVG amb atributs.
 * @param {string} name - Nom de l'element (circle, line, text, g...)
 * @param {Object} [attrs] - Atributs a posar
 * @returns {SVGElement}
 */
function svgEl(name, attrs = {}) {
  const e = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attrs)) {
    e.setAttribute(key, value);
  }
  return e;
}

/**
 * @typedef {Object} CircularRingsBaseDot
 * @property {number} index - Índex del pols (0..lg-1)
 * @property {boolean} [selected] - Pols seleccionat
 * @property {boolean} [selectable=true] - false → sense clic i estil apagat
 * @property {boolean} [isEndpoint] - Hook d'estil per al pols 0/Lg
 */

/**
 * @typedef {Object} CircularRingsFractionDot
 * @property {number} tickIndex - Índex del tick dins l'anell (0..count-1)
 * @property {number} [position] - Posició musical en pulsos (per al payload)
 * @property {boolean} [selected] - Tick seleccionat
 * @property {boolean} [selectable=true] - false → sense clic i estil apagat
 */

/**
 * @typedef {Object} CircularRingsFraction
 * @property {string} id - Identificador estable de l'anell (ex. 'f1')
 * @property {number} numerator - n de la fracció
 * @property {number} denominator - d de la fracció
 * @property {string} color - Color d'identitat (traç, seleccionats)
 * @property {string} lightColor - Tint clar (farciment dels punts)
 * @property {CircularRingsFractionDot[]} [dots] - Estat dels ticks (pot ser dispers)
 */

/**
 * @typedef {Object} CircularRingsRenderState
 * @property {number} lg - Pulsos totals (sempre múltiple del cicle de cada fracció)
 * @property {number} [bigCycle=1] - Cicle gran en pulsos
 * @property {{label?: string, color?: string, lightColor?: string,
 *            dots?: CircularRingsBaseDot[]}} [base] - Anell base
 * @property {CircularRingsFraction[]} [fractions] - NOMÉS les fraccions actives
 */

/**
 * Crea el component d'anells concèntrics dins d'un contenidor.
 *
 * @param {Object} options
 * @param {HTMLElement} options.container - Element amfitrió (el mòdul hi crea l'<svg>)
 * @param {number} [options.k=0.35] - Exponent del radi ∝ velocitat
 * @param {(info: {type: 'int', index: number} |
 *          {type: 'fraction', ringId: string, tickIndex: number,
 *           position: number, numerator: number, denominator: number}) => void}
 *   [options.onDotClick] - Clic sobre un punt seleccionable
 * @returns {{render: Function, highlightPosition: Function,
 *            clearHighlights: Function, getElement: Function, destroy: Function}}
 */
export function createCircularRings({ container, k = DEFAULT_K, onDotClick = null } = {}) {
  if (!container) {
    throw new Error('createCircularRings: cal un container');
  }

  const svg = svgEl('svg', {
    viewBox: `0 0 ${RING_GEOMETRY.VIEWBOX} ${RING_GEOMETRY.VIEWBOX}`,
    width: '100%'
  });
  svg.classList.add('crings-svg');
  container.appendChild(svg);

  // Payload de clic per element punt (WeakMap: cap fuita en re-render).
  const dotPayloads = new WeakMap();
  // Cache per anell per a highlightPosition barat (cap re-render).
  let ringCaches = [];
  let needle = null;
  let currentLg = 0;

  /** Delegació única de clics: un sol listener per a tots els punts. */
  function handleClick(event) {
    const payload = dotPayloads.get(event.target);
    if (!payload || !payload.selectable) return;
    if (typeof onDotClick === 'function') onDotClick(payload.info);
  }
  svg.addEventListener('click', handleClick);

  /** Buida l'SVG (sense innerHTML). */
  function clearSvg() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    ringCaches = [];
    needle = null;
  }

  /**
   * Renderitza tots els anells a partir de l'estat. Re-render complet:
   * la cache de highlight es reconstrueix.
   * @param {CircularRingsRenderState} state
   */
  function render(state = {}) {
    const { lg, bigCycle = 1, base = {}, fractions = [] } = state;
    clearSvg();
    currentLg = Number.isFinite(lg) && lg > 0 ? lg : 0;
    if (!currentLg) return;

    const radii = resolveRadii(fractions, k);

    // ── línies radials als inicis de cicle gran ──
    const lineStep = computeCycleLineStep(currentLg, bigCycle);
    for (let p = 0; p < currentLg; p += lineStep) {
      const a = angleFor(p, currentLg);
      const reach = radii.base + CYCLE_LINE_OVERHANG;
      const line = svgEl('line', {
        x1: C, y1: C,
        x2: C + reach * Math.cos(a), y2: C + reach * Math.sin(a),
        stroke: BASE_COLOR, 'stroke-width': p === 0 ? 2 : 1, opacity: 0.25
      });
      line.classList.add('crings-cycle-line');
      svg.appendChild(line);
    }

    // ── definicions d'anell (base + fraccions actives) ──
    const ringDefs = [
      {
        id: 'base', isBase: true, r: radii.base,
        color: base.color || BASE_COLOR, lightColor: base.lightColor || BASE_LIGHT,
        accentColor: base.accentColor,
        step: 1, count: currentLg, label: base.label ?? 'Pols',
        dotsInfo: base.dots || []
      },
      ...fractions.map((f) => {
        const step = f.numerator / f.denominator;
        return {
          id: f.id, isBase: false, r: radii[f.id],
          color: f.color, lightColor: f.lightColor,
          accentColor: f.accentColor,
          step,
          // Sempre exacte per disseny: Lg és múltiple del cicle de cada fracció.
          count: Math.round(currentLg / step),
          // Etiqueta opcional: si el consumidor en passa una (fins i tot ''),
          // es respecta; si no, per defecte n/d. App4 passa '' (sense etiqueta).
          label: f.label != null ? f.label : `${f.numerator}/${f.denominator}`,
          dotsInfo: f.dots || [],
          numerator: f.numerator, denominator: f.denominator
        };
      })
    ];
    // Dibuixem de fora cap endins perquè els punts interiors quedin a sobre.
    ringDefs.sort((a, b) => b.r - a.r);

    for (const ring of ringDefs) {
      const group = svgEl('g', { 'data-ring-id': ring.id });
      group.classList.add('crings-ring-group');
      // Colors d'identitat com a variables CSS: el full d'estil els fa
      // servir per als estats selected/active sense conèixer cada anell.
      group.style.setProperty('--crings-color', ring.color);
      group.style.setProperty('--crings-light', ring.lightColor);
      // Accent dels estats plens (selected/active/pols 0): per defecte, una
      // VERSIÓ SATURADA del color de l'anell (harmònic i visible sobre la banda
      // gruixuda); el consumidor el pot sobreescriure per anell (ring.accentColor)
      // — p. ex. App4 usa el verd nuzic per a l'anell base fosc.
      group.style.setProperty('--crings-accent', ring.accentColor || saturatedAccent(ring.color));

      // L'anell base es dibuixa ample i cap ENDINS (centerline desplaçada) perquè
      // hi càpiguen punts (exterior, a ring.r) + números (interior); la vora
      // exterior es manté a ring.r+RING_STROKE/2 → les fraccions no es mouen.
      const circleR = ring.isBase ? baseBandCenter(ring.r) : ring.r;
      const circle = svgEl('circle', {
        cx: C, cy: C, r: circleR,
        fill: 'none', stroke: ring.color, opacity: 0.85
      });
      circle.classList.add('crings-ring');
      if (ring.isBase) circle.classList.add('crings-ring--base');
      group.appendChild(circle);

      // Lookup d'estat per índex (admet llistes disperses).
      const infoByIndex = new Map();
      for (const info of ring.dotsInfo) {
        const key = ring.isBase ? info.index : info.tickIndex;
        if (Number.isFinite(key)) infoByIndex.set(key, info);
      }

      const { dotR, strokeWidth } = dotMetrics(ring.count, ring.r, ring.isBase);
      const dots = [];
      for (let i = 0; i < ring.count; i++) {
        const p = i * ring.step; // posició en pulsos base
        const a = angleFor(p, currentLg);
        const info = infoByIndex.get(i) || {};
        const dot = svgEl('circle', {
          cx: C + ring.r * Math.cos(a), cy: C + ring.r * Math.sin(a),
          r: dotR,
          fill: ring.lightColor, stroke: ring.color, 'stroke-width': strokeWidth
        });
        dot.classList.add('crings-dot');
        const selectable = info.selectable !== false;
        if (info.selected) dot.classList.add('crings-dot--selected');
        if (!selectable) dot.classList.add('crings-dot--nonselectable');
        if (info.isEndpoint) dot.classList.add('crings-dot--endpoint');
        if (ring.isBase) {
          dot.dataset.index = String(i);
          dotPayloads.set(dot, { selectable, info: { type: 'int', index: i } });
        } else {
          dot.dataset.tickIndex = String(i);
          dotPayloads.set(dot, {
            selectable,
            info: {
              type: 'fraction', ringId: ring.id, tickIndex: i,
              position: Number.isFinite(info.position) ? info.position : p,
              numerator: ring.numerator, denominator: ring.denominator
            }
          });
        }
        group.appendChild(dot);
        dots.push(dot);
      }

      // L'etiqueta de l'anell és opcional: amb label buit/null no es crea el
      // text (p. ex. App4 amaga la del cercle base — els números ja l'aclareixen).
      if (ring.label) {
        const label = svgEl('text', {
          x: C + 12, y: C - ring.r + 4,
          'font-size': 12, 'font-weight': 700, fill: ring.color
        });
        label.classList.add('crings-label');
        label.textContent = ring.label;
        group.appendChild(label);
      }

      svg.appendChild(group);
      ringCaches.push({ id: ring.id, step: ring.step, count: ring.count, dots, lastActive: null });
    }

    // ── números dels pulsos base, al terç INTERIOR de la banda ampla ──
    // (clars, sobre el fosc de la banda; per sota dels punts, a la part exterior).
    const numberR = baseNumberRadius(radii.base);
    const labelList = computeLabelList(currentLg, bigCycle, radii.base);
    // Font dels números en unitats del viewBox (l'SVG escala amb el contenidor
    // → mida relativa). Acotada (clamp) i MÉS GRAN amb pocs números, més petita
    // amb molts: de ~22 (4 etiquetes) baixa fins a 11 (≥~13 etiquetes).
    const fontSize = clamp(22 - (labelList.length - 4) * 1.2, 11, 22);
    for (const { index, isCycleStart } of labelList) {
      const a = angleFor(index, currentLg);
      const t = svgEl('text', {
        x: C + numberR * Math.cos(a), y: C + numberR * Math.sin(a) + 4,
        'font-size': fontSize, 'font-weight': isCycleStart ? 900 : 400,
        fill: BASE_LIGHT, 'text-anchor': 'middle'
      });
      t.classList.add('crings-number');
      if (isCycleStart) t.classList.add('crings-number--cycle');
      t.textContent = String(index);
      svg.appendChild(t);
    }

    // ── agulla de reproducció (oculta fins a highlightPosition) ──
    needle = svgEl('line', {
      x1: C, y1: C, x2: C, y2: C - RMAX - NEEDLE_OVERHANG,
      stroke: BASE_COLOR, 'stroke-width': 2, opacity: 0
    });
    needle.classList.add('crings-needle');
    svg.appendChild(needle);
  }

  /**
   * Il·lumina el punt actual de CADA anell (floor(position/step) per
   * anell) i orienta l'agulla. Barat: només toggle de classes sobre la
   * cache, mai re-render.
   * @param {number} position - Posició actual en pulsos base
   */
  function highlightPosition(position) {
    if (!currentLg || !Number.isFinite(position)) return;
    for (const cache of ringCaches) {
      if (!cache.count) continue;
      const idx = ((Math.floor(position / cache.step) % cache.count) + cache.count) % cache.count;
      if (cache.lastActive === idx) continue;
      if (cache.lastActive != null) {
        cache.dots[cache.lastActive]?.classList.remove('crings-dot--active');
      }
      cache.dots[idx]?.classList.add('crings-dot--active');
      cache.lastActive = idx;
    }
    if (needle) {
      const a = angleFor(position, currentLg);
      const reach = RMAX + NEEDLE_OVERHANG;
      needle.setAttribute('x2', C + reach * Math.cos(a));
      needle.setAttribute('y2', C + reach * Math.sin(a));
      needle.setAttribute('opacity', 0.5);
      needle.classList.add('crings-needle--visible');
    }
  }

  /** Apaga tots els highlights de reproducció i amaga l'agulla. */
  function clearHighlights() {
    for (const cache of ringCaches) {
      if (cache.lastActive != null) {
        cache.dots[cache.lastActive]?.classList.remove('crings-dot--active');
        cache.lastActive = null;
      }
    }
    if (needle) {
      needle.setAttribute('opacity', 0);
      needle.classList.remove('crings-needle--visible');
    }
  }

  /**
   * Retorna l'element <svg>.
   * @returns {SVGSVGElement}
   */
  function getElement() {
    return svg;
  }

  /** Desmunta el component: listener fora i SVG fora del DOM. */
  function destroy() {
    svg.removeEventListener('click', handleClick);
    clearSvg();
    svg.remove();
    currentLg = 0;
  }

  return { render, highlightPosition, clearHighlights, getElement, destroy };
}

export default createCircularRings;
