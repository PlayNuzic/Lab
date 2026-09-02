// Instrumentació d'ús via Microsoft Clarity. Escolta 'sistema:render'
// (slides.js) — MAI toca render() ni la lògica de navegació. No genera cap
// ID de visitant propi (Clarity ja en posa un d'anònim). No envia res si
// Clarity no s'ha carregat (consentiment no concedit): vegeu consent.js.
//
// Què s'emet (tot són esdeveniments o etiquetes de Clarity):
//   · paso_N (esdeveniment) + etiquetes «paso» i «section» a cada canvi de pas.
//   · capitulo_completado_<section> en avançar a un capítol posterior;
//     coda_alcanzada en entrar a la coda.
//   · paso_N_largo si el pas segueix obert passats LONG_DWELL_MS
//     (substitueix un dwell per etiqueta: Clarity limita a 128 etiquetes/pàgina).
//   · primer_scroll + etiqueta «t_primer_scroll» (tram de temps des de la
//     càrrega) el primer cop que l'usuari mou el driver d'un pas de lectura.
//   · guia_abierta / indice_abierto en obrir «Cómo navegar» o l'índex de
//     capítols (es llegeix l'aria-expanded que nav-guide.js/slides.js ja posen).
//   · aviso_girar quan un pas mostra «Gira el dispositivo»; giro_hecho si
//     després el viewport passa a apaïsat.
//   · app_play_AppNN / app_random_AppNN / app_reset_AppNN / app_edit_AppNN
//     a partir dels postMessage que embed-mode.js envia des de les apps.
//   · Etiqueta «entrada» (directa | enlace_paso | referrer:<host>) i «modo»
//     (test | real). Amb ?tester=ID a l'URL (test d'usuari) s'identifica la
//     sessió a Clarity (identify + upgrade) i l'ID es recorda al navegador
//     perquè les sessions «en fred» posteriors quedin lligades al mateix ID.

import { slideMatrix } from './slide-data.js';

const PASO_STORAGE_KEY = 'sistema.paso';
const TESTER_STORAGE_KEY = 'sistema.tester';
export const LONG_DWELL_MS = 90_000;

const APP_EVENTS = {
  'app:play': 'app_play',
  'app:random': 'app_random',
  'app:reset': 'app_reset',
  'app:edit': 'app_edit',
};
// Ordre dels capítols = ordre d'aparició a la matriu de slides.
const SECTION_ORDER = [...new Set(slideMatrix.map(s => s.section))];

// Crida defensiva: si Clarity no hi és (consentiment no concedit) no fa res.
function clarity(...args) {
  try {
    if (typeof window === 'undefined' || typeof window.clarity !== 'function') return false;
    window.clarity(...args);
    return true;
  } catch {
    return false;
  }
}

export function getSlideInfo(paso) {
  const slide = slideMatrix.find(s => s.paso === paso);
  return {
    section: slide?.section ?? null,
    title: slide?.title ?? null,
  };
}

export function readCurrentPaso() {
  const paso = parseFloat(localStorage.getItem(PASO_STORAGE_KEY));
  return Number.isNaN(paso) ? null : paso;
}

// Nom d'esdeveniment vàlid per a Clarity: el punt dels pasos *.5/*.7 es
// substitueix per "_" (p.ex. 18.5 → "paso_18_5").
function eventNameForPaso(paso) {
  return `paso_${String(paso).replace('.', '_')}`;
}

// ── Test d'usuari: ?tester=ID ────────────────────────────────────────────
// L'ID només admet [A-Za-z0-9_-] (p.ex. P1-03). Es desa a localStorage per
// tal que les visites següents del mateix navegador (sessions «en fred»)
// segueixin identificades encara que l'URL ja no porti el paràmetre.
const TESTER_RE = /^[A-Za-z0-9_-]{1,32}$/;

export function readTester(search = (typeof location !== 'undefined' ? location.search : '')) {
  let fromUrl = null;
  try { fromUrl = new URLSearchParams(search).get('tester'); } catch {}
  if (fromUrl && TESTER_RE.test(fromUrl)) {
    try { localStorage.setItem(TESTER_STORAGE_KEY, fromUrl); } catch {}
    return fromUrl;
  }
  try {
    const stored = localStorage.getItem(TESTER_STORAGE_KEY);
    return stored && TESTER_RE.test(stored) ? stored : null;
  } catch {
    return null;
  }
}

// ── Entrada ──────────────────────────────────────────────────────────────
// L'URL inicial es llegeix de l'entrada de navegació (slides.js ja ha
// reescrit location.search amb ?paso=N quan aquest mòdul s'executa).
function initialUrl() {
  try {
    const nav = performance.getEntriesByType?.('navigation')?.[0];
    if (nav?.name) return nav.name;
  } catch {}
  return typeof document !== 'undefined' ? document.URL : '';
}

export function classifyEntrada({ url = initialUrl(), referrer = (typeof document !== 'undefined' ? document.referrer : ''), host = (typeof location !== 'undefined' ? location.host : '') } = {}) {
  try {
    if (new URL(url, 'https://x').searchParams.has('paso')) return 'enlace_paso';
  } catch {}
  if (referrer) {
    try {
      const refHost = new URL(referrer).host;
      if (refHost && refHost !== host) return `referrer:${refHost}`;
    } catch {}
  }
  return 'directa';
}

// Tram de temps (ms des de la càrrega) → etiqueta curta. Trams i no valors
// per no cremar el límit d'etiquetes de Clarity.
export function tramoTemps(ms) {
  if (ms < 10_000) return '0_10s';
  if (ms < 30_000) return '10_30s';
  if (ms < 60_000) return '30_60s';
  return 'mas_60s';
}

function appNameFromMessage(data) {
  const app = typeof data?.app === 'string' ? data.app : '';
  return /^App\d{1,2}[A-Z]?$/i.test(app) ? app : null;
}

export function createTracker({ now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) } = {}) {
  let lastPaso = null;
  let dwellTimer = null;
  let firstScrollSent = false;
  let rotateShownAt = null;      // paso on s'ha mostrat l'avís de girar
  const editedApps = new Set();
  const t0 = now();

  function trackPaso(paso, prevPaso) {
    const { section } = getSlideInfo(paso);
    clarity('set', 'paso', String(paso));
    if (section) clarity('set', 'section', section);
    clarity('event', eventNameForPaso(paso));

    // Capítol completat: només en avançar cap a un capítol posterior.
    const prevSection = prevPaso === null ? null : getSlideInfo(prevPaso).section;
    if (prevSection && section && prevSection !== section
        && SECTION_ORDER.indexOf(section) > SECTION_ORDER.indexOf(prevSection)) {
      clarity('event', `capitulo_completado_${prevSection}`);
    }
    if (section === 'coda') clarity('event', 'coda_alcanzada');

    // Estada llarga al pas.
    if (dwellTimer) clearTimeout(dwellTimer);
    dwellTimer = setTimeout(() => clarity('event', `${eventNameForPaso(paso)}_largo`), LONG_DWELL_MS);

    // Avís «Gira el dispositivo» (slides.js el pinta en lloc de l'app).
    if (typeof document !== 'undefined' && document.querySelector('.rotate-prompt')) {
      rotateShownAt = paso;
      clarity('event', 'aviso_girar');
    }
  }

  function onRender() {
    const paso = readCurrentPaso();
    if (paso === null || paso === lastPaso) return;
    const prev = lastPaso;
    lastPaso = paso;
    trackPaso(paso, prev);
  }

  function onScroll(e) {
    if (firstScrollSent) return;
    const el = e.target;
    if (!el || typeof el.classList?.contains !== 'function' || !el.classList.contains('parallax-driver')) return;
    firstScrollSent = true;
    clarity('set', 't_primer_scroll', tramoTemps(now() - t0));
    clarity('event', 'primer_scroll');
  }

  function onClick(e) {
    const target = e.target;
    if (!target || typeof target.closest !== 'function') return;
    const guia = target.closest('#btn-guia');
    if (guia && guia.getAttribute('aria-expanded') === 'true') clarity('event', 'guia_abierta');
    const indice = target.closest('#nav-title');
    if (indice && indice.getAttribute('aria-expanded') === 'true') clarity('event', 'indice_abierto');
  }

  function onMessage(e) {
    const data = e?.data;
    const name = data && typeof data.type === 'string' ? APP_EVENTS[data.type] : null;
    if (!name) return;
    if (e.origin && typeof location !== 'undefined' && e.origin !== location.origin) return;
    const app = appNameFromMessage(data);
    if (!app) return;
    if (name === 'app_edit') {
      if (editedApps.has(app)) return;
      editedApps.add(app);
    }
    clarity('event', `${name}_${app}`);
  }

  function onViewportChange(mq) {
    if (rotateShownAt === null || mq.matches) return;   // encara estret
    rotateShownAt = null;
    clarity('event', 'giro_hecho');
  }

  // Amb l'ID recordat, l'URL torna a portar ?tester=ID (replaceState, sense
  // embrutar l'historial; slides.js ja conserva els altres paràmetres). Així
  // el segment «Test de usuario» de Clarity (URL conté «tester=») també
  // captura les sessions en fred i l'ID es veu a la barra d'adreces.
  function mirrorTesterInUrl(tester) {
    try {
      const q = new URLSearchParams(location.search);
      if (q.get('tester') === tester) return;
      q.set('tester', tester);
      history.replaceState(null, '', `${location.pathname}?${q}`);
    } catch {}
  }

  function identify() {
    const tester = readTester();
    if (tester) {
      mirrorTesterInUrl(tester);
      clarity('identify', tester);
      clarity('set', 'modo', 'test');
      clarity('set', 'tester', tester);
      clarity('upgrade', 'test-usuario');
    } else {
      clarity('set', 'modo', 'real');
    }
    clarity('set', 'entrada', classifyEntrada());
  }

  function start() {
    identify();
    onRender(); // marca el pas ja renderitzat abans que aquest mòdul carregués
    document.addEventListener('sistema:render', onRender);
    document.addEventListener('scroll', onScroll, true);
    document.addEventListener('click', onClick);
    window.addEventListener('message', onMessage);
    try {
      const mq = window.matchMedia?.('(max-width: 900px)');
      mq?.addEventListener?.('change', onViewportChange);
    } catch {}
  }

  return { start, onRender, onScroll, onClick, onMessage, onViewportChange, identify };
}

if (typeof document !== 'undefined' && document.getElementById('slide-stage')) {
  createTracker().start();
}
