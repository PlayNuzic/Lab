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
  // text-reveal i marquee hi posen el moviment. Sense app (el slide no en
  // declara cap). Les entrades on:false conserven els params afinats.
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
  // Paso 2 — intro de Posiciones (cuinat des de l'export del panell): 7
  // frases + la cel·la d'app que el driver afegeix perquè app-reveal és
  // actiu (fraseAparicio 8 = aquesta cel·la): la crida a l'acció es
  // llegeix sencera i al scroll següent entra el plano, a tot l'espai.
  2: {
    'scroll-depth':    { on: true,  params: {} },
    'app-reveal':      { on: true,  params: { fraseAparicio: 8, mida: 1, escalaInicial: 1, durada: 0.5 } },
  },
  // Paso 11 — Módulos (cuinat des de l'export del panell): mask-zoom
  // apagat, la imatge de fons queda com a capa suau sense màscara.
  11: {
    'scroll-depth':    { on: true,  params: {} },
    'mask-zoom':       { on: false, params: {} },
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

// Re-sincronitza el slide viu amb la config (després d'Aleatori/Restaurar):
// re-cablejat sencer, perquè la config pot haver canviat app-reveal i, amb
// ell, les cel·les del driver. Torna a la primera frase.
function syncActiu() {
  if (!actiu) return;
  wire(actiu.slideEl, actiu.slide);
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
    // app-reveal on/off canvia el nombre de cel·les del driver (la cel·la
    // d'app): cal re-cablejar el slide sencer. La resta s'aplica en viu.
    if (techId === 'app-reveal' && typeof patch.on === 'boolean') wire(actiu.slideEl, actiu.slide);
    else if (entrada.on) aplica(techId);
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

  // ── Scroll natiu amb snap (el "driver") ──────────────────────────────
  // Reescriptura 2026-08-31, la tercera i definitiva. Les dues anteriors
  // gestionaven la roda a mà (scroll lliure amb fre; després un stepper
  // amb heurístiques de cua d'inèrcia) i totes van fallar contra el
  // trackpad real: el moment del sistema no és predictible des de JS
  // (salta amunt en passar de la fase de dit a la de moment, dura fins a
  // un segon, i mai hi ha la "pausa" que un stepper necessita). L'estàndard
  // professional per a "una frase per pantalla" és deixar que el navegador
  // sigui l'amo de l'scroll:
  //
  //   · Un contenidor invisible (.parallax-driver) cobreix el slide i és
  //     un scroll container natiu amb `scroll-snap-type: y mandatory` i
  //     cel·les d'alçada 100% amb `scroll-snap-stop: always`: el sistema
  //     gestiona el moment, el snap sempre deixa una cel·la centrada i un
  //     flick avança exactament UNA cel·la. Trackpad, ratolí, tàctil i
  //     accessibilitat, de franc i sense cap heurística.
  //   · Les frases es pinten com sempre (mateixa coreografia, mateixes
  //     tècniques via --px-progress): la posició surt de scrollTop.
  //   · Cel·la d'APP: si el slide té app i app-reveal és actiu, hi ha una
  //     cel·la extra després de l'última frase — l'última frase es llegeix
  //     sencera i al scroll següent entra l'app, sola. Cap text ha de dur
  //     <p> buits.
  //   · Cel·la de SORTIDA: si hi ha paso següent, una cel·la més al final;
  //     entrar-hi (scroll natiu, una cel·la deliberada més) canvia de paso.
  //     Cap heurística d'escapada. Enrere, a la primera, res.
  //   · Bloqueig d'entrada: el driver neix sense pointer-events durant
  //     ENTRY_LOCK_MS, així la cua del flick que ha canviat de paso no el
  //     toca (el navegador la lliga al document, que no fa scroll).
  //   · Roda de ratolí (cremallera): un notch = una cel·la, perquè el snap
  //     natiu tornaria enrere un notch de 100px en una cel·la de 600.
  const nText = frases.length;
  const cfgPaso = getConfig(slide.paso);
  const ambApp = !!(slide.apps?.length && cfgPaso['app-reveal']?.on);
  const btnNext = document.getElementById('btn-next');
  const btnPrev = document.getElementById('btn-prev');
  const ambSortida = !!(btnNext && !btnNext.disabled);
  const total = nText + (ambApp ? 1 : 0);   // cel·les amb contingut (text + app)
  const ultima = total - 1;
  const denom = Math.max(1, ultima);

  const ENTRY_LOCK_MS = 700;     // el driver ignora el punter en néixer (cua del paso anterior)
  const NOTCH_MS = 320;          // ritme màxim de la cremallera del ratolí
  const SORTIDA_LLINDAR = 0.6;   // fracció de la cel·la de sortida que dispara el canvi
  const HYST = 0.1;              // histèresi del canvi de frase activa

  slideEl.querySelector('.parallax-driver')?.remove();
  const driver = document.createElement('div');
  driver.className = 'parallax-driver is-locked';
  driver.setAttribute('aria-hidden', 'true');
  const nCells = total + (ambSortida ? 1 : 0);
  for (let i = 0; i < nCells; i += 1) {
    const c = document.createElement('div');
    c.className = 'parallax-driver__cell'
      + (ambApp && i === ultima ? ' parallax-driver__cell--app' : '')
      + (ambSortida && i === total ? ' parallax-driver__cell--sortida' : '');
    driver.appendChild(c);
  }
  slideEl.appendChild(driver);
  setTimeout(() => driver.classList.remove('is-locked'), ENTRY_LOCK_MS);

  let pos = 0;                   // posició en cel·les (scrollTop / alçada de cel·la)
  let rafPaint = null;
  let escapat = false;

  const cellH = () => driver.clientHeight || 1;
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

  function paint() {
    rafPaint = null;
    if (actiu?.slideEl !== slideEl) return;  // el render ens ha substituït
    pos = driver.scrollTop / cellH();
    const cand = clampPos(Math.round(pos));
    if (cand !== active && Math.abs(pos - active) > 0.5 + HYST) {
      active = cand;
      pintaEstatics();
    }
    pintaFrases(pos);
    publica();
    // Cel·la de sortida: en entrar-hi prou (el snap acabarà de portar-hi),
    // paso següent — un sol cop.
    if (ambSortida && !escapat && pos >= ultima + SORTIDA_LLINDAR) {
      escapat = true;
      btnNext?.click();
    }
  }
  function programaPaint() {
    if (rafPaint == null) rafPaint = requestAnimationFrame(paint);
  }
  driver.addEventListener('scroll', () => { hideHint(); programaPaint(); }, { passive: true });

  // Scroll programàtic a una cel·la (suau, o sec amb reduced-motion).
  function scrollA(index) {
    const top = clampPos(index) * cellH();
    try {
      driver.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' });
    } catch {
      driver.scrollTop = top;
    }
    programaPaint();
  }

  // Pas discret (fletxes de teclat, cremallera del ratolí i API): a la
  // frontera escapem al paso adjacent. go() és privat de slides.js: usem
  // els botons públics de la nav (un botó disabled ignora .click(), que
  // replica el no-op als extrems).
  function step(delta) {
    if (estat()?.editable) return false;
    const next = Math.round(driver.scrollTop / cellH()) + delta;
    if (next > ultima) { btnNext?.click(); return true; }
    if (next < 0) { btnPrev?.click(); return true; }
    hideHint();
    scrollA(next);
    return true;
  }

  // Cremallera del ratolí: un notch = una cel·la, a ritme limitat (una
  // ràfega de notches no pot saltar frases). El trackpad queda natiu.
  // Detecció: deltaMode en línies/pàgines (Firefox), o el wheelDeltaY
  // llegat múltiple de 120 (Chrome/Safari) amb un delta de notch.
  let ultimNotch = 0;
  driver.addEventListener('wheel', (e) => {
    if (estat()?.editable) return;
    const notch = e.deltaMode === 1 || e.deltaMode === 2
      || (e.deltaMode === 0 && e.wheelDeltaY && e.wheelDeltaY % 120 === 0 && Math.abs(e.deltaY) >= 40);
    if (!notch) return;
    e.preventDefault();
    const now = performance.now();
    if (now - ultimNotch < NOTCH_MS) return;
    ultimNotch = now;
    step(e.deltaY > 0 ? 1 : -1);
  }, { passive: false });

  // El driver tapa el slide: els clics es reenvien al que hi ha a sota
  // (una frase atenuada hi glissa; un botó —badge, pill— es prem).
  driver.addEventListener('click', (e) => {
    if (estat()?.editable) return;
    driver.style.pointerEvents = 'none';
    const sota = document.elementFromPoint(e.clientX, e.clientY);
    driver.style.pointerEvents = '';
    if (!sota) return;
    const i = frases.indexOf(sota.closest('.parallax-frases > p'));
    if (i >= 0) { if (i !== active) { hideHint(); scrollA(i); } return; }
    sota.closest('button, a')?.click();
  });

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
  actiu = { slideEl, slide, paso: slide.paso, wired: new Map() };
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
