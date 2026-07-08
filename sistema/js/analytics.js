// Instrumentació de navegació anònima (Umami Cloud). Escolta l'esdeveniment
// 'sistema:render' (slides.js:884) — MAI toca render() ni la lògica de
// navegació. Tot l'acoblament amb el servei viu a send(): migrar de backend
// és reescriure només aquesta funció.

import { slideMatrix } from './slide-data.js';

const VISITOR_COOKIE_KEY = 'sistema.visitorId';
const VISITOR_STORAGE_KEY = 'sistema.visitorId';
const PASO_STORAGE_KEY = 'sistema.paso';
const COOKIE_MAX_AGE_S = 400 * 24 * 60 * 60; // 400 dies: límit pràctic de Chrome

function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback: navegadors molt antics sense crypto.randomUUID i entorn jsdom
  // de test (verificat: aquest repo l'expressa com a undefined).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function readCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name, value) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${COOKIE_MAX_AGE_S}; Path=/; SameSite=Lax`;
}

// ID anònim de visitant: cookie de primera part, amb fallback a localStorage
// (Safari ITP i similars poden podar cookies abans que localStorage).
export function getOrCreateVisitorId() {
  let id = readCookie(VISITOR_COOKIE_KEY) || localStorage.getItem(VISITOR_STORAGE_KEY);
  if (!id) id = generateUUID();
  try { writeCookie(VISITOR_COOKIE_KEY, id); } catch {}
  try { localStorage.setItem(VISITOR_STORAGE_KEY, id); } catch {}
  return id;
}

export function getSlideInfo(paso) {
  const slide = slideMatrix.find(s => s.paso === paso);
  return {
    section: slide?.section ?? null,
    title: slide?.title ?? null,
    is_lab: slide?.layout === 'P-parallax-lab',
  };
}

export function readCurrentPaso() {
  const paso = parseFloat(localStorage.getItem(PASO_STORAGE_KEY));
  return Number.isNaN(paso) ? null : paso;
}

function send(eventName, props) {
  try {
    if (typeof window !== 'undefined' && window.umami && typeof window.umami.track === 'function') {
      window.umami.track(eventName, props);
    }
  } catch {}
}

export function createTracker({ now = () => Date.now() } = {}) {
  let visitorId = null;
  let currentPaso = null;
  let enteredAt = null;
  let pending = false;

  function flush() {
    if (!pending || currentPaso === null) return;
    const { section, title, is_lab } = getSlideInfo(currentPaso);
    send('paso_visto', {
      paso: currentPaso,
      section,
      title,
      dwell_ms: Math.max(0, Math.round(now() - enteredAt)),
      visitorId,
      is_lab,
    });
    pending = false;
  }

  function onRender() {
    const paso = readCurrentPaso();
    if (paso === null || paso === currentPaso) return;
    flush();
    currentPaso = paso;
    enteredAt = now();
    pending = true;
  }

  function start() {
    visitorId = getOrCreateVisitorId();
    onRender(); // captura el pas ja renderitzat abans que aquest mòdul carregués
    document.addEventListener('sistema:render', onRender);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
    window.addEventListener('pagehide', flush);
  }

  return { start, onRender, flush };
}

if (typeof document !== 'undefined') {
  createTracker().start();
}
