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
function setConfig(paso, techId, patch = {}) {
  const perPaso = configMutable(paso);
  const entrada = perPaso[techId] ?? (perPaso[techId] = { on: false, params: {} });
  if (typeof patch.on === 'boolean') entrada.on = patch.on;
  if (patch.params) entrada.params = { ...entrada.params, ...patch.params };
  saveFx();
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

  let active = 0;

  function hideHint() {
    if (hint) hint.classList.add('is-hidden');
  }

  // Frases: mateixos estils inline que setActive() de wireParallax (la
  // coreografia de frases és idèntica al parallax real i és intocable per
  // a les tècniques). El bloc de capes de l'original se substitueix per
  // la publicació de progrés: les tècniques fan la resta.
  function setActive(i) {
    active = Math.max(0, Math.min(frases.length - 1, i));
    frases.forEach((p, j) => {
      const d = j - active;
      const abs = Math.abs(d);
      p.classList.toggle('is-active', d === 0);
      p.style.opacity = d === 0 ? '1' : String(Math.max(0.07, 0.26 - abs * 0.07));
      p.style.transform = `translateY(calc(-50% + ${d * 19}vh)) scale(${d === 0 ? 1 : 0.68})`;
      p.style.filter = d === 0 ? 'none' : `blur(${Math.min(abs * 1.6, 4)}px)`;
      p.style.zIndex = String(10 - abs);
    });
    const t = frases.length > 1 ? active / (frases.length - 1) : 0;
    slideEl.style.setProperty('--px-progress', String(t));
    slideEl.dispatchEvent(new CustomEvent('sistema:parallax-progress', {
      detail: { t, active, total: frases.length },
    }));
  }

  function step(delta) {
    if (estat()?.editable) return false;
    const next = active + delta;
    // A la frontera escapem al paso adjacent, com el parallax real. go()
    // és privat de slides.js: usem els botons públics de la nav (un botó
    // disabled ignora .click(), que replica el no-op als extrems).
    if (next >= frases.length) { document.getElementById('btn-next')?.click(); return true; }
    if (next < 0) { document.getElementById('btn-prev')?.click(); return true; }
    hideHint();
    setActive(next);
    return true;
  }

  // ── Roda: còpia exacta del gest per-empenta de wireParallax ──
  // (desarma/rearma per gest; vegeu els comentaris de l'original a
  // slides.js — no modificar aquí sense portar-ho també allà.)
  const WHEEL_REARM_GAP_MS = 100;
  const WHEEL_STEP_THRESHOLD = 50;
  const WHEEL_STEP_COOLDOWN_MS = 450;
  let wheelArmed = true;
  let wheelAcc = 0;
  let lastWheelTime = 0;
  let lastWheelSign = 0;
  let lastWheelAbs = 0;
  let lastStepTime = 0;
  slideEl.addEventListener('wheel', (e) => {
    if (estat()?.editable) return;
    e.preventDefault();
    const abs = Math.abs(e.deltaY);
    if (abs < 1) return;
    const now = performance.now();
    const gap = now - lastWheelTime;
    lastWheelTime = now;
    const sign = Math.sign(e.deltaY);

    if (!wheelArmed) {
      const cooled = now - lastStepTime > WHEEL_STEP_COOLDOWN_MS;
      const fresh = (sign !== 0 && sign !== lastWheelSign)
        || (cooled && (
          gap > WHEEL_REARM_GAP_MS
          || (abs > 20 && abs > lastWheelAbs * 1.5 + 8)
        ));
      if (!fresh) { lastWheelAbs = abs; return; }
      wheelArmed = true;
      wheelAcc = 0;
    } else if (gap > 300) {
      wheelAcc = 0;
    }
    lastWheelAbs = abs;
    if (sign !== 0) lastWheelSign = sign;

    wheelAcc += e.deltaY;
    if (Math.abs(wheelAcc) < WHEEL_STEP_THRESHOLD) return;
    const delta = wheelAcc > 0 ? 1 : -1;
    wheelAcc = 0;
    if (step(delta)) { wheelArmed = false; lastStepTime = now; }
  }, { passive: false });

  // Clic sobre una frase atenuada: l'activa directament.
  frases.forEach((p, i) => {
    p.addEventListener('click', () => {
      if (estat()?.editable || i === active) return;
      hideHint();
      setActive(i);
    });
  });

  // Swipe vertical en tàctil.
  let touchY = null;
  slideEl.addEventListener('touchstart', (e) => { touchY = e.touches[0].clientY; }, { passive: true });
  slideEl.addEventListener('touchend', (e) => {
    if (touchY == null) return;
    const dy = touchY - e.changedTouches[0].clientY;
    if (Math.abs(dy) > 40) step(dy > 0 ? 1 : -1);
    touchY = null;
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
  setActive(0);
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
