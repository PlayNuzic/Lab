/**
 * @module polyrhythm-info
 * @rol Calcula la informació matemàtica d'una combinació polirítmica (pols base
 *      + fraccions n/d) per al panell ∑ d'App4. Funció pura i provable; el
 *      consumidor només renderitza el resultat.
 * @dep libs/app-common/number-utils (gcd, lcm)
 *
 * Convencions (coherents amb els anells concèntrics d'App4):
 *  - VELOCITAT d'una fracció n/d = V · d/n (radi de l'anell ∝ d/n).
 *  - CICLE GRAN = mcm dels numeradors REDUÏTS (els denominadors no hi influeixen).
 *  - CICLOS (m) = Lg / cicle gran = quantes vegades coincideixen totes les
 *    fraccions amb el pols.
 *  - PROPORCIÓ reduïda = relació de velocitats 1 : d₁/n₁ : … INCLOENT el pols
 *    (=1), expressada en enters.
 */
import { gcd, lcm } from './number-utils.js';

/**
 * Calcula la informació matemàtica d'una combinació polirítmica (pols base + fraccions n/d).
 * @param {Object} [params]
 * @param {number} [params.lg] - longitud del pols base (Lg)
 * @param {number} [params.v] - velocitat del pols base (V, en BPM)
 * @param {{numerator: number, denominator: number}[]} [params.fractions] - fraccions actives
 * @returns {Object} informació derivada: cicle gran, cicles, durada, `fractionsInfo` per fracció i `ratio` reduïda
 */
export function computePolyrhythmInfo({ lg, v, fractions = [] } = {}) {
  const reduced = (Array.isArray(fractions) ? fractions : [])
    .filter((f) => Number.isFinite(f?.numerator) && Number.isFinite(f?.denominator)
      && f.numerator > 0 && f.denominator > 0)
    .map((f) => {
      const g = gcd(f.numerator, f.denominator);
      return {
        numerator: f.numerator,
        denominator: f.denominator,
        rNum: f.numerator / g,
        rDen: f.denominator / g
      };
    });

  const bigCycle = reduced.length
    ? reduced.reduce((acc, f) => lcm(acc, f.rNum), 1)
    : 1;
  const validLg = Number.isFinite(lg) && lg > 0;
  const validV = Number.isFinite(v) && v > 0;
  const cycles = validLg && bigCycle > 0 ? Math.round(lg / bigCycle) : null;
  const lcmDenominators = reduced.length
    ? reduced.reduce((acc, f) => lcm(acc, f.denominator), 1)
    : 1;
  const durationSec = validLg && validV ? (lg * 60) / v : null;

  const fractionsInfo = reduced.map((f) => ({
    numerator: f.numerator,
    denominator: f.denominator,
    reducedNumerator: f.rNum,
    reducedDenominator: f.rDen,
    reducible: f.rNum !== f.numerator || f.rDen !== f.denominator,
    // Velocitat de la veu de la fracció (BPM): V · d/n.
    velocity: validV ? (v * f.denominator) / f.numerator : null,
    // Pulsos fraccionats dins d'un cicle gran: cicle gran · d/n (sempre enter).
    pulsesPerCycle: (bigCycle / f.rNum) * f.rDen
  }));

  // Proporció de velocitats incloent el pols (=1): 1 : d/n : …
  // ×cicle gran (= mcm dels num. reduïts) dóna enters; després /gcd global.
  const ratioInts = [bigCycle, ...reduced.map((f) => (bigCycle / f.rNum) * f.rDen)];
  const ratioG = ratioInts.reduce((a, b) => gcd(a, b));
  const ratio = ratioG > 0 ? ratioInts.map((x) => x / ratioG) : ratioInts;

  return { lg, cycles, bigCycle, durationSec, lcmDenominators, fractions: fractionsInfo, ratio };
}
