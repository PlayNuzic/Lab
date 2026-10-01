// Botó «Diario» del test d'usuari. Només apareix amb un codi de tester
// (?tester=ID, que analytics.js recorda al navegador) i a partir del paso 11,
// on comença la continuació en fred. Amb el codi DEV apareix a tots els pasos,
// per provar-lo; ?tester=off fa oblidar el codi (vegeu analytics.js). Obre el
// formulari «Diario» de Google en una pestanya nova, amb el codi i el paso
// actual ja escrits. No toca render() ni Clarity: només escolta
// 'sistema:render' (slides.js) per mostrar o amagar l'enllaç #btn-diario.

import { readTester, readCurrentPaso } from './analytics.js';

const FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSeFAotrWRYZR4WbwY-zyLyXoYreRtSphhtJf3pbdgbkXc8-VQ/viewform';
const ENTRY_CODI = 'entry.1986705158';   // «Código de participante»
const ENTRY_PASO = 'entry.1193824495';   // «¿Hasta qué paso has llegado hoy?»
export const PRIMER_PASO_FRED = 11;
export const CODI_DEV = 'DEV';

export function diarioVisible(tester, paso) {
  if (!tester) return false;
  if (tester === CODI_DEV) return true;
  return Number(paso) >= PRIMER_PASO_FRED;
}

export function diarioUrl(tester, paso) {
  const q = new URLSearchParams({ usp: 'pp_url', [ENTRY_CODI]: tester });
  if (paso != null) q.set(ENTRY_PASO, String(paso));
  return `${FORM_URL}?${q}`;
}

export function initDiario(doc = document) {
  const link = doc.getElementById('btn-diario');
  if (!link) return null;
  function update() {
    const tester = readTester();
    const paso = readCurrentPaso();
    const visible = diarioVisible(tester, paso);
    link.hidden = !visible;
    if (visible) link.href = diarioUrl(tester, paso);
  }
  update();
  doc.addEventListener('sistema:render', update);
  return { update };
}

// Auto-init només on hi ha l'enllaç (index.html).
if (typeof document !== 'undefined' && document.getElementById('btn-diario')) {
  initDiario();
}
