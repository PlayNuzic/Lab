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

  // ── Scroll lliure ────────────────────────────────────────────────────
  // El gest ja no dispara passos discrets: acumula sobre `target` (0..1)
  // i un bucle rAF hi fa perseguir `cur` amb lerp — l'usuari condueix, el
  // motor només suavitza. Tot el que penja del progrés es pinta CONTINU
  // des de `cur`: les frases amb les mateixes postures que wireParallax
  // (les corbes empalmen amb els valors discrets originals a |d|=1) i les
  // tècniques via --px-progress + esdeveniment. La frase activa es deriva
  // amb histèresi; en parar el gest, snap suau a la frase més propera
  // (àncora de lectura). A les fronteres cal una sobre-empenta acumulada
  // per saltar de paso (adéu al canvi de pas accidental). Les fletxes
  // (step) mantenen el pas discret; amb reduced-motion el lerp és sec.
  const total = frases.length;
  const denom = Math.max(1, total - 1);
  const PX_PER_FRASE = 300;      // px de gest per recórrer una frase
  const SUAVITAT = 0.16;         // factor de lerp per frame
  const SNAP_MS = 450;           // repòs abans del snap a la frase propera
  const EDGE_ESCAPE_PX = 340;    // sobre-empenta per canviar de paso
  const EDGE_RESET_MS = 600;     // pausa que buida la sobre-empenta
  const HYST = 0.1;              // histèresi del canvi de frase (en frases)
  const GEST_RESET_MS = 250;     // pausa (o canvi de sentit) que obre un gest nou
  const FRE_PER_FRASE = 0.55;    // fracció d'empenta que sobreviu cada frase recorreguda

  let target = 0;
  let cur = 0;
  let rafId = null;
  let snapTimer = null;
  let edgePx = 0;
  let lastEdgeTime = 0;
  let lastWheelTime = 0;
  let gestOrigen = 0;        // ancoratge del pressupost (en frases)
  let gestSign = 0;
  let gestAlLimit = false;   // el gest va COMENÇAR a l'última frase?

  // Postures contínues de les frases (mateixa coreografia que wireParallax,
  // intocable per a les tècniques). Durant el gest NOMÉS s'escriuen
  // transform i opacity (compositables): les corbes empalmen amb els
  // valors discrets originals a |d|=1.
  function pintaFrases(pos) {
    frases.forEach((p, j) => {
      const d = j - pos;
      const abs = Math.abs(d);
      const op = abs <= 1 ? 1 - abs * 0.81 : Math.max(0.07, 0.26 - abs * 0.07);
      const esc = abs <= 1 ? 1 - abs * 0.32 : 0.68;
      p.style.opacity = op.toFixed(3);
      p.style.transform = `translateY(calc(-50% + ${(d * 19).toFixed(2)}vh)) scale(${esc.toFixed(3)})`;
    });
  }

  // Blur, z-index i is-active NOMÉS quan canvia la frase assentada (LP-07:
  // escriure filter a cada frame re-rasteritza el text amb will-change
  // actiu i a Chrome pot fer desaparèixer la frase mentre es mou — l'
  // artefacte exacte que va motivar la regla). Un sol cop per canvi de
  // frase = comportament idèntic al parallax discret original.
  function pintaEstatics() {
    frases.forEach((p, j) => {
      const abs = Math.abs(j - active);
      p.classList.toggle('is-active', abs === 0);
      p.style.filter = abs === 0 ? 'none' : `blur(${Math.min(abs * 1.6, 4)}px)`;
      p.style.zIndex = String(10 - abs);
    });
  }

  function publica() {
    const t = Math.max(0, Math.min(1, cur));
    slideEl.style.setProperty('--px-progress', String(t));
    slideEl.dispatchEvent(new CustomEvent('sistema:parallax-progress', {
      detail: { t, active, total },
    }));
  }

  function frame() {
    rafId = null;
    if (actiu?.slideEl !== slideEl) return;  // el render ens ha substituït
    cur += (target - cur) * (reduced ? 1 : SUAVITAT);
    if (Math.abs(target - cur) < 0.0006) cur = target;
    const pos = cur * denom;
    const cand = Math.max(0, Math.min(total - 1, Math.round(pos)));
    if (cand !== active && Math.abs(pos - active) > 0.5 + HYST) {
      active = cand;
      pintaEstatics();
    }
    pintaFrases(pos);
    publica();
    if (cur !== target) rafId = requestAnimationFrame(frame);
  }
  function arrenca() {
    if (rafId == null) rafId = requestAnimationFrame(frame);
  }

  function programaSnap() {
    clearTimeout(snapTimer);
    snapTimer = setTimeout(() => {
      target = Math.max(0, Math.min(total - 1, Math.round(target * denom))) / denom;
      arrenca();
    }, SNAP_MS);
  }

  // Pas discret (fletxes de teclat i API): glissa fins a la frase veïna;
  // a la frontera escapem al paso adjacent, com el parallax real. go()
  // és privat de slides.js: usem els botons públics de la nav (un botó
  // disabled ignora .click(), que replica el no-op als extrems).
  function step(delta) {
    if (estat()?.editable) return false;
    const next = Math.round(target * denom) + delta;
    if (next >= total) { document.getElementById('btn-next')?.click(); return true; }
    if (next < 0) { document.getElementById('btn-prev')?.click(); return true; }
    hideHint();
    clearTimeout(snapTimer);
    target = next / denom;
    arrenca();
    return true;
  }

  // ── Roda: acumulació contínua (scroll lliure) ──
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
    // Un "gest" = una empenta: una pausa o un canvi de sentit n'obren un
    // de nou i re-ancoren el pressupost i el permís d'escapada. La cua
    // d'inèrcia del trackpad pertany al MATEIX gest que la va llençar.
    if (now - lastWheelTime > GEST_RESET_MS || sign !== gestSign) {
      gestOrigen = target * denom;
      gestSign = sign;
      gestAlLimit = sign > 0 && (total === 1 || target >= 1);
    }
    lastWheelTime = now;

    // Frontera ENDAVANT (última frase): només escapa un gest COMENÇAT al
    // límit — la cua d'una llençada que hi acaba d'arribar no compta.
    // Frontera ENRERE (primera frase): el gest NO escapa mai de paso
    // (només fletxa ↑ o botó de nav).
    if (sign > 0 && (total === 1 || target >= 1)) {
      if (!gestAlLimit) return;
      if (now - lastEdgeTime > EDGE_RESET_MS) edgePx = 0;
      lastEdgeTime = now;
      edgePx += dy;
      if (edgePx >= EDGE_ESCAPE_PX) {
        edgePx = 0;
        document.getElementById('btn-next')?.click();
      }
      return;
    }
    if (sign < 0 && target <= 0) { edgePx = 0; return; }
    edgePx = 0;
    // Inèrcia que es perd frase a frase (GTA): l'empenta mai es bloqueja,
    // però cada frase recorreguda dins del MATEIX gest frena la resta
    // (0.55^frases). Una llençada forta avança 2-3 frases perdent força a
    // cada pas; un gest nou (pausa o canvi de sentit) recupera tota
    // l'empenta.
    const avanc = Math.abs(target * denom - gestOrigen);
    const fre = Math.pow(FRE_PER_FRASE, avanc);
    target = Math.max(0, Math.min(1, target + (dy * fre) / (PX_PER_FRASE * denom)));
    arrenca();
    programaSnap();
  }, { passive: false });

  // Clic sobre una frase atenuada: hi glissa directament.
  frases.forEach((p, i) => {
    p.addEventListener('click', () => {
      if (estat()?.editable || i === active) return;
      hideHint();
      clearTimeout(snapTimer);
      target = i / denom;
      arrenca();
    });
  });

  // Tàctil: arrossegament directe (el dit mana, mateixa escala que la
  // roda), snap en deixar anar; l'excés d'arrossegament més enllà de
  // l'última frase escapa al paso següent (enrere mai per gest — mateix
  // criteri que la roda).
  let touchY = null;
  let touchTarget = 0;
  let touchExces = 0;        // en unitats de t, amb signe
  let touchAlLimit = false;  // el toc va començar a l'última frase?
  slideEl.addEventListener('touchstart', (e) => {
    if (estat()?.editable) return;
    touchY = e.touches[0].clientY;
    touchTarget = target;
    touchExces = 0;
    touchAlLimit = total === 1 || target >= 1;
    clearTimeout(snapTimer);
  }, { passive: true });
  slideEl.addEventListener('touchmove', (e) => {
    if (touchY == null || estat()?.editable) return;
    hideHint();
    const dy = touchY - e.touches[0].clientY;           // dit amunt = avançar
    // El dit és manipulació directa (sense inèrcia): mapeig 1:1, sense
    // fre. El cru es conserva per mesurar l'excés a la frontera.
    const cru = touchTarget + dy / (PX_PER_FRASE * denom);
    target = total === 1 ? 0 : Math.max(0, Math.min(1, cru));
    touchExces = cru - target;
    arrenca();
  }, { passive: true });
  slideEl.addEventListener('touchend', () => {
    if (touchY == null) return;
    touchY = null;
    const excesPx = touchExces * PX_PER_FRASE * denom;  // amb signe: només endavant
    if (touchAlLimit && excesPx > 90) {
      document.getElementById('btn-next')?.click();
    } else {
      programaSnap();
    }
    touchExces = 0;
  }, { passive: true });

  // Ranura per a app-reveal (Lab B): contenidor buit i amagat; la tècnica
  // hi injecta l'iframe (lazy, un sol cop) i el mostra segons el progrés.
  if (slide.apps?.length && !slideEl.querySelector('.parallax-app-slot')) {
    const slot = document.createElement('div');
    slot.className = 'parallax-app-slot';
    slot.dataset.app = slide.apps[0];
    slot.hidden = true;
    if (slide.aspect) slot.style.setProperty('--px-ar-aspect', slide.aspect.replace('/', ' / '));
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
