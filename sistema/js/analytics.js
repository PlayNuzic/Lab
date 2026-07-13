// Instrumentació de navegació per pas via Microsoft Clarity. Escolta
// 'sistema:render' (slides.js) — MAI toca render() ni la lògica de
// navegació. No genera cap ID de visitant propi (Clarity ja en posa un
// d'anònim). No envia res si Clarity no s'ha carregat (consentiment no
// concedit): vegeu consent.js.

import { slideMatrix } from './slide-data.js';

const PASO_STORAGE_KEY = 'sistema.paso';

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

function track(paso) {
  try {
    if (typeof window === 'undefined' || typeof window.clarity !== 'function') return;
    const { section } = getSlideInfo(paso);
    window.clarity('set', 'paso', String(paso));
    if (section) window.clarity('set', 'section', section);
    window.clarity('event', eventNameForPaso(paso));
  } catch {}
}

export function createTracker() {
  let lastPaso = null;

  function onRender() {
    const paso = readCurrentPaso();
    if (paso === null || paso === lastPaso) return;
    lastPaso = paso;
    track(paso);
  }

  function start() {
    onRender(); // marca el pas ja renderitzat abans que aquest mòdul carregués
    document.addEventListener('sistema:render', onRender);
  }

  return { start, onRender };
}

if (typeof document !== 'undefined') {
  createTracker().start();
}
