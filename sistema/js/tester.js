// Codi de tester del test d'usuari (?tester=ID) i progrés per codi. Sense
// efectes en carregar-se: el fan servir slides.js (on es desa el pas) i
// analytics.js (identificació a Clarity).

export const PASO_STORAGE_KEY = 'sistema.paso';
export const TESTER_STORAGE_KEY = 'sistema.tester';
// ?tester=off fa oblidar el codi desat: sortida del mode test per a qui l'ha
// provat (p.ex. amb el codi DEV del botó «Diario», diario.js).
export const TESTER_OFF = 'off';
// L'ID només admet [A-Za-z0-9_-] (p.ex. P1-03). Es desa a localStorage per
// tal que les visites següents del mateix navegador (sessions «en fred»)
// segueixin identificades encara que l'URL ja no porti el paràmetre.
const TESTER_RE = /^[A-Za-z0-9_-]{1,32}$/;

export function readTester(search = (typeof location !== 'undefined' ? location.search : '')) {
  let fromUrl = null;
  try { fromUrl = new URLSearchParams(search).get('tester'); } catch {}
  if (fromUrl && fromUrl.toLowerCase() === TESTER_OFF) {
    try { localStorage.removeItem(TESTER_STORAGE_KEY); } catch {}
    return null;
  }
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

// Clau de represa: una per codi, perquè dues persones del test que comparteixen
// navegador no es trepitgin el progrés i un codi nou comenci pel paso 1. Sense
// codi, la general.
export function resumeKey(tester) {
  return tester ? `${PASO_STORAGE_KEY}.${tester}` : PASO_STORAGE_KEY;
}

// Resol el codi actiu i en retorna la clau de represa. El progrés d'abans de les
// claus per codi (només a 'sistema.paso') és del codi que hi havia desat: només
// aquest l'hereta.
export function initResume(search) {
  let prev = null;
  try { prev = localStorage.getItem(TESTER_STORAGE_KEY); } catch {}
  const tester = readTester(search);
  const key = resumeKey(tester);
  if (tester && tester === prev) {
    try {
      const legacy = localStorage.getItem(PASO_STORAGE_KEY);
      if (localStorage.getItem(key) === null && legacy !== null) localStorage.setItem(key, legacy);
    } catch {}
  }
  return key;
}
