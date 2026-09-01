// Parallax Lab — motor del layout 'P-parallax-lab' (els 5 intros de
// producció 1/7/11/17/22 + els 2 labs ocults 28.5/28.7).
//
// Reprodueix el mode seqüencial de frases del parallax real però delega TOT
// el moviment de fons a les tècniques del registre (parallax-techniques.js),
// que escriuen variables CSS composades per parallax-lab.css. El motor:
//   1. Cableja frases + gestos (roda/swipe/clic) — CÒPIA DELIBERADA de la
//      lògica de wireParallax (slides.js). Aquesta duplicació venia de quan
//      el Lab encara es construïa (juliol 2026) i no es volia arriscar el
//      comportament dels passos reals; ara el Lab és estable i en producció
//      (1/7/11/17/22 ja l'usen) i wireParallax fa doble papel: fallback
//      real si window.__parallaxLab no existeix (vegeu slides.js render()).
//      Els dos poden evolucionar; si es toca la lògica de gestos, revisar-la
//      als dos llocs (no simplificar sense verificar-los junts).
//   2. Publica el progrés: --px-progress a l'arrel del slide + CustomEvent
//      'sistema:parallax-progress' — les tècniques s'hi subscriuen via ctx.
//   3. Gestiona el cicle de vida de les tècniques (apply/cleanup) segons la
//      config persistida a localStorage 'sistema.parallaxFx' (patró
//      densityByPaso). P-26: els canvis muten el DOM viu, mai re-render.
//
// S'exposa a window.__parallaxLab perquè slides.js (branca del layout) i
// tweaks.js (export) no hagin d'importar aquest mòdul.

import { TECNIQUES, paramsPerDefecte } from './parallax-techniques.js';

const FX_KEY = 'sistema.parallaxFx';

// prefers-reduced-motion es llegeix un cop per càrrega (mateixa convenció
// que wireParallax). Les tècniques moviment:true no s'apliquen mai amb
// reduced actiu; les estàtiques (blur, color...) sí.
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── Config persistida ────────────────────────────────────────────────────
function loadFx() {
  try { return JSON.parse(localStorage.getItem(FX_KEY)) || {}; } catch { return {}; }
}
const fx = loadFx();
function saveFx() {
  try { localStorage.setItem(FX_KEY, JSON.stringify(fx)); } catch {}
}

// Per defecte una slide lab arrenca amb el moviment base actiu (paritat
// visual amb les slides parallax reals).
function configPerDefecte() {
  return { 'scroll-depth': { on: true, params: {} } };
}

// Receptes "de fàbrica" fixades per paso (fetes al constructor i cuinades
// aquí perquè viatgin al repositori, no només al localStorage d'un
// navegador). Prioritat: localStorage de l'usuari > preset > defecte
// genèric. "Restaurar" esborra el localStorage del paso i, per tant, hi
// torna. Les entrades on:false amb params conserven els valors afinats
// perquè, en activar-les al panell, ja surtin a punt.
const PRESETS = {
  // Paso 1 — intro global. Recepta afinada al constructor: focus-mode
  // tanca la corba d'opacitat de les frases i bg-dim + depth-blur allunyen
  // el fons, els dos problemes de legibilitat d'aquest slide; mouse-tilt,
  // text-reveal i marquee hi posen el moviment. Les entrades on:false
  // conserven els params afinats per poder-les encendre al panell.
  1: {
    'scroll-depth':    { on: true,  params: {} },
    'multi-speed':     { on: false, params: { factor: 3, dispersio: 0.6 } },
    'mouse-tilt':      { on: true,  params: { intensitat: 30, suavitat: 0.3 } },
    'float-drift':     { on: false, params: { amplitud: 16 } },
    'depth-blur':      { on: true,  params: { maxBlur: 3.5, corba: 1.6 } },
    'color-shift':     { on: false, params: {} },
    'zoom-drift':      { on: false, params: { intensitat: 1.5 } },
    'inertia':         { on: false, params: {} },
    'text-reveal':     { on: true,  params: { durada: 2, esglaonat: 60 } },
    'marquee':         { on: true,  params: { velocitat: 120, mida: 70, opacitat: 0.03 } },
    'focus-mode':      { on: true,  params: { duresa: 2, rastre: 0.05 } },
    'bg-dim':          { on: true,  params: {} },
    'app-reveal':      { on: false, params: { fraseAparicio: 8, escalaInicial: 1, durada: 0.5 } },
  },
  // Paso 2 — intro de Posiciones (cuinat des de l'export del panell): amb
  // 7 frases, el motor acota fraseAparicio 8 a l'última, de manera que el
  // plano entra just amb la crida a l'acció.
  2: {
    'scroll-depth':    { on: true,  params: {} },
    'app-reveal':      { on: true,  params: { fraseAparicio: 8, escalaInicial: 1, durada: 0.5 } },
  },
  // Paso 11 — Módulos (cuinat des de l'export del panell).
  11: {
    'scroll-depth':    { on: true,  params: {} },
    'mask-zoom':       { on: true,  params: {} },
    'app-reveal':      { on: false, params: { fraseAparicio: 2 } },
  },
  22: {
    'scroll-depth':    { on: true,  params: {} },
    'multi-speed':     { on: true,  params: { factor: 2, dispersio: 0.5 } },
    'mouse-tilt':      { on: false, params: {} },
    'float-drift':     { on: true,  params: { amplitud: 4, durada: 15 } },
    'depth-blur':      { on: false, params: { maxBlur: 5, corba: 1 } },
    'color-shift':     { on: true,  params: {} },
    'rotate-progress': { on: true,  params: {} },
    'zoom-drift':      { on: false, params: { intensitat: 0 } },
    'inertia':         { on: true,  params: { durada: 0.5, rebot: 0.6, esglaonat: 0.2 } },
    'mask-zoom':       { on: false, params: { escalaInicial: 10, escalaFinal: 575, fons: 1 } },
    'text-reveal':     { on: true,  params: {} },
    'marquee':         { on: true,  params: { velocitat: 120, mida: 110 } },
    'spotlight':       { on: true,  params: { radi: 50, forca: 0.05 } },
    'app-reveal':      { on: false, params: { fraseAparicio: 5, escalaInicial: 0.6 } },
  },
  // Pasos 28.5/28.7 — Parallax Lab (cuinat des de l'export del panell).
  // Les entrades on:false conserven els params afinats.
  28.5: {
    'scroll-depth':    { on: true,  params: { amplX: 95, amplY: 90, rotacio: 30, zoom: 0.8 } },
    'multi-speed':     { on: false, params: { factor: 1, dispersio: 0 } },
    'mouse-tilt':      { on: false, params: { intensitat: 19 } },
    'zoom-drift':      { on: false, params: {} },
    'inertia':         { on: false, params: {} },
    'gradient-drift':  { on: false, params: {} },
    'mask-zoom':       { on: false, params: { escalaInicial: 20, escalaFinal: 675 } },
    'spotlight':       { on: false, params: {} },
    'float-drift':     { on: false, params: {} },
  },
  28.7: {
    'scroll-depth':    { on: true,  params: {} },
    'zoom-drift':      { on: true,  params: { intensitat: 1.5 } },
    'mask-zoom':       { on: true,  params: { fons: 1, escalaFinal: 150 } },
    'app-reveal':      { on: false, params: { fraseAparicio: 5 } },
  },
  // Paso 29 — coda: mateixa recepta que la intro (paso 1), que té el
  // mateix problema de frases llargues. L'entrada app-reveal hi és per
  // paritat amb el paso 1, però a la coda és inert: el slide no declara
  // cap app, així que no hi ha ranura on revelar-la.
  29: {
    'scroll-depth':    { on: true,  params: {} },
    'focus-mode':      { on: true,  params: { duresa: 2, rastre: 0.05 } },
    'bg-dim':          { on: true,  params: {} },
    'app-reveal':      { on: false, params: { fraseAparicio: 8, escalaInicial: 1, durada: 0.5 } },
  },
};
// Clon profund: mai retornem la referència viva del preset (evitem que una
// mutació del paso contamini la recepta compartida).
function preset(paso) {
  const p = PRESETS[paso];
  return p ? JSON.parse(JSON.stringify(p)) : null;
}

function getConfig(paso) {
  return fx[paso] ?? preset(paso) ?? configPerDefecte();
}
// Materialitza la config del paso abans de mutar-la (si encara era la
// virtual —preset o defecte— primer es fa real perquè no es perdi res).
function configMutable(paso) {
  if (!fx[paso]) fx[paso] = preset(paso) ?? configPerDefecte();
  return fx[paso];
}

// ── Slide lab actiu ──────────────────────────────────────────────────────
// Un únic slide lab pot estar viu alhora (el render substitueix el stage).
let actiu = null; // { slideEl, paso, wired: Map<techId, tech> }

function creaCtx(slideEl) {
  return {
    reduced,
    progress() {
      const v = parseFloat(slideEl.style.getPropertyValue('--px-progress'));
      return Number.isFinite(v) ? v : 0;
    },
    onProgress(cb) {
      const h = (e) => cb(e.detail.t, e.detail);
      slideEl.addEventListener('sistema:parallax-progress', h);
      return () => slideEl.removeEventListener('sistema:parallax-progress', h);
    },
  };
}

function tecnicaPerId(id) {
  return TECNIQUES.find(t => t.id === id);
}

function aplica(techId) {
  if (!actiu) return;
  const tech = tecnicaPerId(techId);
  if (!tech) return;
  if (tech.moviment && reduced) return;  // gate reduced-motion
  const entrada = getConfig(actiu.paso)[techId];
  const cfg = { ...paramsPerDefecte(tech), ...(entrada?.params || {}) };
  try {
    tech.apply(actiu.slideEl, cfg, creaCtx(actiu.slideEl));
    actiu.wired.set(techId, tech);
  } catch (e) {
    console.warn('[parallax-lab] apply ha fallat:', techId, e);
  }
}

function desactiva(techId) {
  if (!actiu) return;
  const tech = actiu.wired.get(techId);
  if (!tech) return;
  try { tech.cleanup(actiu.slideEl); } catch (e) {
    console.warn('[parallax-lab] cleanup ha fallat:', techId, e);
  }
  actiu.wired.delete(techId);
}

// Neteja TOTES les tècniques del slide actiu (rAF, listeners globals...).
// Defensiu: el slideEl pot estar ja fora del DOM (render l'ha substituït).
function netejaTot() {
  if (!actiu) return;
  [...actiu.wired.keys()].forEach(desactiva);
  actiu = null;
}

// Re-sincronitza el slide viu amb la config (després d'Aleatori/Restaurar).
function syncActiu() {
  if (!actiu) return;
  [...actiu.wired.keys()].forEach(desactiva);
  const cfg = getConfig(actiu.paso);
  TECNIQUES.forEach(t => { if (cfg[t.id]?.on) aplica(t.id); });
}

// Canvi de config des del panell. Aplica EN VIU només la tècnica tocada
// (P-26: mai re-render; l'apply de cada tècnica és idempotent).
// P-04: `persist` (default true) desa a localStorage; l'arrossegament del
// slider el passa a false (aplica en viu sense escriure desenes de cops/s) i
// desa un sol cop al 'change' final. El toggle on/off sí que desa (default).
function setConfig(paso, techId, patch = {}, persist = true) {
  const perPaso = configMutable(paso);
  const entrada = perPaso[techId] ?? (perPaso[techId] = { on: false, params: {} });
  if (typeof patch.on === 'boolean') entrada.on = patch.on;
  if (patch.params) entrada.params = { ...entrada.params, ...patch.params };
  if (persist) saveFx();
  if (actiu && actiu.paso === paso) {
    if (entrada.on) aplica(techId);
    else desactiva(techId);
  }
  return entrada;
}

function resetConfig(paso) {
  delete fx[paso];
  saveFx();
  syncActiu();
}

// 🎲 Aleatori: combina 2-4 tècniques a l'atzar amb valors a l'atzar dins
// dels rangs (arrodonits al step). Amb reduced-motion només entren les
// tècniques estàtiques. Retorna la config resultant.
function aleatori(paso) {
  const elegibles = TECNIQUES.filter(t => !(t.moviment && reduced));
  const nova = {};
  if (elegibles.length) {
    const quantes = Math.min(elegibles.length, 2 + Math.floor(Math.random() * 3));
    // Fisher-Yates (no sort(() => Math.random() - 0.5), que és esbiaixat):
    // només cal barrejar els primers `quantes` elements, la resta no
    // s'arriba a triar mai.
    const barreja = [...elegibles];
    for (let i = 0; i < quantes; i += 1) {
      const j = i + Math.floor(Math.random() * (barreja.length - i));
      [barreja[i], barreja[j]] = [barreja[j], barreja[i]];
    }
    barreja.slice(0, quantes).forEach(t => {
      const params = {};
      (t.params || []).forEach(p => {
        const passos = Math.round((p.max - p.min) / p.step);
        const cru = p.min + p.step * Math.round(Math.random() * passos);
        // Neteja el soroll de coma flotant (0.30000000000000004 → 0.3).
        params[p.key] = Number(cru.toFixed(4));
      });
      nova[t.id] = { on: true, params };
    });
  }
  fx[paso] = nova;
  saveFx();
  syncActiu();
  return nova;
}

// ── Cablejat del slide (frases + gestos + progrés) ───────────────────────
function wire(slideEl, slide) {
  netejaTot();
  const frases = [...slideEl.querySelectorAll('.parallax-frases > p')];
  if (!frases.length) return null;
  const hint = slideEl.querySelector('.parallax-scroll-hint');
  const estat = () => window.__sistemaState;  // exposat per slides.js

  let active = 0;  // frase "assentada": classes + detail.active (amb histèresi)

  function hideHint() {
    if (hint) hint.classList.add('is-hidden');
  }

  // ── Model de gest: un gest = una frase ───────────────────────────────
  // Reescriptura 2026-08-31 (la versió anterior —scroll lliure amb fre
  // exponencial per frase, snap diferit i escapada per sobre-empenta—
  // s'havia sobretreballat: quedava a mig camí entre frases, el snap
  // arribava tard i a la frontera tan aviat no deixava saltar com
  // saltava sol). El model d'ara és el d'un stepper amb previsualització:
  //
  //   · Un GEST (empenta de roda o de dit) mou exactament UNA frase. Mentre
  //     dura, la posició segueix el gest fins a +1 (previsualització), de
  //     manera que es veu on va; en acabar, es COMPROMET: si ha passat de
  //     MIN_COMMIT avança, si no torna a l'origen. Mai queda entre frases.
  //   · El gest s'acaba quan el delta ja porta TAIL_EVENTS events baixant
  //     (la cua d'inèrcia del trackpad, que no és cap intenció nova) o
  //     quan hi ha GEST_GAP_MS de silenci. La cua es consumeix sense
  //     efecte; una empenta NOVA enmig de la cua (delta que puja de cop)
  //     compta com a gest nou. Roda de ratolí: una ràfega de cremallera
  //     = un gest.
  //   · Frontera: a l'última frase, un gest endavant fa una goma petita
  //     (pista visual) i, si suma EDGE_ESCAPE_PX, canvia de paso — però
  //     mai durant ARRIVAL_LOCK_MS després d'arribar-hi (el rebot de la
  //     mateixa mà no pot escapar). Enrere, a la primera, res.
  //   · El moviment el fa una molla críticament esmorteïda (posició +
  //     velocitat): arrenca i para suau, sense el cop inicial del lerp.
  //     Amb reduced-motion és sec.
  //
  // Tot es mesura en FRASES (pos 0..total-1); el progrés publicat (t) és
  // pos/denom. Les frases es pinten contínues des de `pos` (mateixes
  // postures que wireParallax) i la frase activa es deriva amb histèresi.
  const total = frases.length;
  const ultima = total - 1;
  const denom = Math.max(1, ultima);

  const PX_PER_FRASE = 260;      // px de gest per recórrer una frase sencera
  const MIN_COMMIT = 0.12;       // fracció de frase que compta com a empenta
  const GEST_GAP_MS = 220;       // silenci que tanca un gest
  const TAIL_EVENTS = 3;         // events baixant seguits = cua d'inèrcia
  const EDGE_ESCAPE_PX = 380;    // empenta, ja al límit, per canviar de paso
  const EDGE_HINT = 0.12;        // goma màxima més enllà de l'última (frases)
  const ARRIVAL_LOCK_MS = 450;   // en arribar a l'última, escapada bloquejada
  const STIFF = 200;             // molla: rigidesa (1/s²)
  const DAMP = 28;               // molla: esmorteïment (≈ crític: 2·√STIFF)
  const HYST = 0.1;              // histèresi del canvi de frase activa

  let pos = 0;                   // posició visual (frases)
  let posT = 0;                  // objectiu de la molla (frases; pot ser fraccionari en previsualització)
  let frase = 0;                 // última frase COMPROMESA (sempre entera)
  let vel = 0;                   // velocitat (frases/s)
  let rafId = null;
  let lastFrame = 0;
  let gest = null;               // gest de roda en curs (vegeu onWheel)
  let gapTimer = null;
  let arribadaLimit = -Infinity; // performance.now() de l'últim aterratge a l'última frase

  const clampPos = (n) => Math.max(0, Math.min(ultima, n));

  // Postures contínues de les frases (mateixa coreografia que wireParallax,
  // intocable per a les tècniques). Durant el moviment NOMÉS s'escriuen
  // transform i opacity (compositables): les corbes empalmen amb els
  // valors discrets originals a |d|=1.
  function pintaFrases(p) {
    frases.forEach((el, j) => {
      const d = j - p;
      const abs = Math.abs(d);
      const op = abs <= 1 ? 1 - abs * 0.81 : Math.max(0.07, 0.26 - abs * 0.07);
      const esc = abs <= 1 ? 1 - abs * 0.32 : 0.68;
      el.style.opacity = op.toFixed(3);
      el.style.transform = `translateY(calc(-50% + ${(d * 19).toFixed(2)}vh)) scale(${esc.toFixed(3)})`;
    });
  }

  // Blur, z-index i is-active NOMÉS quan canvia la frase assentada (LP-07:
  // escriure filter a cada frame re-rasteritza el text amb will-change
  // actiu i a Chrome pot fer desaparèixer la frase mentre es mou). Un sol
  // cop per canvi de frase = comportament idèntic al parallax discret.
  function pintaEstatics() {
    frases.forEach((el, j) => {
      const abs = Math.abs(j - active);
      el.classList.toggle('is-active', abs === 0);
      el.style.filter = abs === 0 ? 'none' : `blur(${Math.min(abs * 1.6, 4)}px)`;
      el.style.zIndex = String(10 - abs);
    });
  }

  function publica() {
    const t = Math.max(0, Math.min(1, pos / denom));
    slideEl.style.setProperty('--px-progress', String(t));
    slideEl.dispatchEvent(new CustomEvent('sistema:parallax-progress', {
      detail: { t, active, total },
    }));
  }

  function frame(now) {
    rafId = null;
    if (actiu?.slideEl !== slideEl) return;  // el render ens ha substituït
    // dt real, acotat: una pestanya en segon pla no pot fer un salt.
    const dt = Math.min(1 / 30, Math.max(1 / 120, ((now - lastFrame) / 1000) || 1 / 60));
    lastFrame = now;
    if (reduced) {
      pos = posT; vel = 0;
    } else {
      const acc = (posT - pos) * STIFF - vel * DAMP;
      vel += acc * dt;
      pos += vel * dt;
      if (Math.abs(posT - pos) < 0.0005 && Math.abs(vel) < 0.003) { pos = posT; vel = 0; }
    }
    const cand = clampPos(Math.round(pos));
    if (cand !== active && Math.abs(pos - active) > 0.5 + HYST) {
      active = cand;
      pintaEstatics();
    }
    pintaFrases(pos);
    publica();
    if (pos !== posT) rafId = requestAnimationFrame(frame);
  }
  function arrenca() {
    if (rafId == null) {
      lastFrame = performance.now();
      rafId = requestAnimationFrame(frame);
    }
  }

  // Compromet una frase sencera. Si hi aterra des d'una altra, arma el
  // bloqueig d'escapada de l'última (quedar-s'hi no el renova). Es
  // compara amb la frase compromesa, no amb posT: la previsualització ja
  // pot haver deixat posT a l'última abans del compromís.
  function vesA(n) {
    const nova = clampPos(n);
    if (nova === ultima && frase !== ultima) arribadaLimit = performance.now();
    frase = nova;
    posT = nova;
    arrenca();
  }

  // Tanca el gest de roda en curs: avança si l'empenta ha estat prou
  // deliberada, si no torna a l'origen. Al límit només recull la goma.
  function commit() {
    clearTimeout(gapTimer);
    if (!gest || gest.committed) return;
    gest.committed = true;
    if (actiu?.slideEl !== slideEl) return;
    if (gest.alLimit) { posT = clampPos(posT); arrenca(); return; }
    const frac = Math.min(1, gest.acc / PX_PER_FRASE);
    vesA(gest.anchor + gest.sign * (frac >= MIN_COMMIT ? 1 : 0));
  }

  // Pas discret (fletxes de teclat i API): a la frontera escapem al paso
  // adjacent, com el parallax real. go() és privat de slides.js: usem els
  // botons públics de la nav (un botó disabled ignora .click(), que
  // replica el no-op als extrems).
  function step(delta) {
    if (estat()?.editable) return false;
    const next = Math.round(posT) + delta;
    if (next > ultima) { document.getElementById('btn-next')?.click(); return true; }
    if (next < 0) { document.getElementById('btn-prev')?.click(); return true; }
    hideHint();
    gest = null;
    clearTimeout(gapTimer);
    vesA(next);
    return true;
  }

  slideEl.addEventListener('wheel', (e) => {
    if (estat()?.editable) return;
    e.preventDefault();
    let dy = e.deltaY;
    if (e.deltaMode === 1) dy *= 16;                    // línies → px
    else if (e.deltaMode === 2) dy *= window.innerHeight;
    if (!dy) return;
    hideHint();
    const now = performance.now();
    const sign = dy > 0 ? 1 : -1;
    const abs = Math.abs(dy);

    // Gest nou: silenci, canvi de sentit, o —dins la cua d'un gest ja
    // compromès— un delta que puja de cop (una empenta nova; la cua
    // d'inèrcia només baixa). L'àncora és la frase on l'objectiu
    // ARRODONEIX: un gest abandonat a mig camí (canvi de sentit) queda
    // resolt cap a la frase més propera, sense rebots.
    const fresh = !gest
      || now - gest.last > GEST_GAP_MS
      || sign !== gest.sign
      || (gest.committed && abs > gest.lastAbs * 1.4 + 4);
    if (fresh) {
      const anchor = clampPos(Math.round(posT));
      gest = {
        sign, anchor, acc: 0, last: now, lastAbs: abs, decay: 0, committed: false,
        alLimit: sign > 0 ? anchor >= ultima : anchor <= 0,
      };
    } else {
      gest.decay = abs < gest.lastAbs ? gest.decay + 1 : 0;
      gest.last = now;
      gest.lastAbs = abs;
    }
    clearTimeout(gapTimer);
    if (gest.committed) return;                         // cua del mateix gest
    gapTimer = setTimeout(commit, GEST_GAP_MS);

    if (gest.alLimit) {
      // Enrere a la primera: res. Endavant a l'última: goma de pista i,
      // amb prou empenta (i fora del bloqueig d'arribada), paso següent.
      if (sign < 0 || now - arribadaLimit < ARRIVAL_LOCK_MS) { gest.committed = true; return; }
      gest.acc += abs;
      posT = ultima + Math.min(EDGE_HINT, (gest.acc / PX_PER_FRASE) * 0.3);
      arrenca();
      if (gest.acc >= EDGE_ESCAPE_PX) {
        gest.committed = true;
        posT = ultima;
        document.getElementById('btn-next')?.click();
      }
      return;
    }

    gest.acc += abs;
    const frac = Math.min(1, gest.acc / PX_PER_FRASE);
    posT = gest.anchor + gest.sign * frac;              // previsualització
    arrenca();
    if (frac >= 1 || gest.decay >= TAIL_EVENTS) commit();
  }, { passive: false });

  // Clic sobre una frase atenuada: hi glissa directament.
  frases.forEach((p, i) => {
    p.addEventListener('click', () => {
      if (estat()?.editable || i === active) return;
      hideHint();
      gest = null;
      clearTimeout(gapTimer);
      vesA(i);
    });
  });

  // Tàctil: el dit arrossega la previsualització (mateixa escala que la
  // roda, acotada a ±1 frase des de l'origen) i en deixar anar es
  // compromet amb el mateix criteri. A l'última frase l'excés fa goma i,
  // si passa del llindar (i del bloqueig d'arribada), escapa; enrere mai.
  const TOUCH_ESCAPE_PX = 90;
  let touch = null;  // { y0, anchor, alLimit, exces }
  slideEl.addEventListener('touchstart', (e) => {
    if (estat()?.editable) return;
    const anchor = clampPos(Math.round(posT));
    touch = { y0: e.touches[0].clientY, anchor, alLimit: anchor >= ultima, exces: 0 };
    gest = null;
    clearTimeout(gapTimer);
  }, { passive: true });
  slideEl.addEventListener('touchmove', (e) => {
    if (!touch || estat()?.editable) return;
    hideHint();
    const dy = touch.y0 - e.touches[0].clientY;         // dit amunt = avançar
    const frac = Math.max(-1, Math.min(1, dy / PX_PER_FRASE));
    if (touch.alLimit && frac > 0) {
      touch.exces = dy;
      posT = ultima + Math.min(EDGE_HINT, frac * 0.3);
    } else {
      touch.exces = 0;
      posT = clampPos(touch.anchor + frac);
    }
    arrenca();
  }, { passive: true });
  slideEl.addEventListener('touchend', () => {
    if (!touch) return;
    const t = touch;
    touch = null;
    if (t.alLimit && t.exces > TOUCH_ESCAPE_PX
        && performance.now() - arribadaLimit >= ARRIVAL_LOCK_MS) {
      posT = ultima;
      document.getElementById('btn-next')?.click();
      return;
    }
    const frac = clampPos(posT) - t.anchor;
    vesA(t.anchor + (Math.abs(frac) >= MIN_COMMIT ? Math.sign(frac) : 0));
  }, { passive: true });

  // Ranura per a app-reveal (Lab B): contenidor buit i amagat; la tècnica
  // hi injecta l'iframe (lazy, un sol cop) i el mostra segons el progrés.
  if (slide.apps?.length && !slideEl.querySelector('.parallax-app-slot')) {
    const slot = document.createElement('div');
    slot.className = 'parallax-app-slot';
    slot.dataset.app = slide.apps[0];
    slot.hidden = true;
    if (slide.aspect) {
      slot.style.setProperty('--px-ar-aspect', slide.aspect.replace('/', ' / '));
      // Ràtio numèrica (w/h) per al càlcul d'amplada des de l'alçada al CSS.
      const [w, h] = slide.aspect.split('/').map(Number);
      if (w > 0 && h > 0) slot.style.setProperty('--px-ar-ratio', (w / h).toFixed(4));
    }
    slideEl.appendChild(slot);
  }

  // Activa les tècniques persistides i publica el progrés inicial.
  actiu = { slideEl, paso: slide.paso, wired: new Map() };
  pintaFrases(0);
  pintaEstatics();
  publica();
  const cfg = getConfig(slide.paso);
  TECNIQUES.forEach(t => { if (cfg[t.id]?.on) aplica(t.id); });

  return { step };
}

// Si un render ha substituït el nostre slide (p.ex. navegació cap a un pas
// no-lab), neteja rAF/listeners globals de les tècniques que quedessin.
document.addEventListener('sistema:render', () => {
  if (actiu && !document.body.contains(actiu.slideEl)) netejaTot();
});

// ── API per a slides.js (branca del layout), tweaks.js (export) i el
//    panell (parallax-builder.js) ─────────────────────────────────────────
window.__parallaxLab = {
  wire,
  registre: TECNIQUES,
  reduced,
  getConfig,
  setConfig,
  resetConfig,
  aleatori,
  getConfigAll: () => fx,
  slideActiu: () => (actiu ? { paso: actiu.paso, slideEl: actiu.slideEl } : null),
};
