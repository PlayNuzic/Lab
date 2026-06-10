/**
 * Logger de desenvolupament compartit (H-13).
 *
 * console.log és I/O síncron quan DevTools és obert i afegeix jitter
 * justament als camins on el repo és més paranoic amb el timing
 * (per-nota dins del playback, per-clic, càrrega d'instruments).
 *
 * `log` només emet en mode dev: `?dev` a la URL o
 * `localStorage['nuzic-debug'] = '1'` (persistent entre recàrregues).
 * console.warn/console.error NO passen per aquí — els errors reals
 * s'han de veure sempre.
 */
const devLogsEnabled = (() => {
  try {
    if (typeof location !== 'undefined'
      && new URLSearchParams(location.search).has('dev')) return true;
    if (typeof localStorage !== 'undefined'
      && localStorage.getItem('nuzic-debug') === '1') return true;
  } catch {
    // localStorage pot llançar en contexts restringits (iframes sandbox)
  }
  return false;
})();

export const log = devLogsEnabled ? console.log.bind(console) : () => {};
export { devLogsEnabled };
