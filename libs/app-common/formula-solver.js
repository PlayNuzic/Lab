/**
 * @module formula-solver
 * @rol Resol la 3a incògnita de la fórmula temporal Lg/V = T/60 amb el model
 *      "els dos últims editats manen": el camp que fa més temps que no toques
 *      és el derivat i es recalcula sol. Sense modes ni bloquejos.
 * @dep cap (aritmètica pura)
 */

export const FORMULA_KEYS = ['Lg', 'V', 'T'];

const isFilled = (x) => Number.isFinite(x) && x > 0;
const round2 = (x) => Math.round(x * 100) / 100;

/**
 * Calcula un dels tres camps de la fórmula temporal a partir dels altres dos.
 * Totes les branques deriven de Lg/V = T/60.
 * @param {'Lg'|'V'|'T'} key - camp a calcular
 * @param {{Lg: number, V: number, T: number}} values - valors actuals dels tres camps
 * @returns {{key: string, value: number}|null} el camp calculat, o `null` si falten dades
 */
export function computeField(key, { Lg, V, T }) {
  if (key === 'T')  return isFilled(Lg) && isFilled(V) ? { key, value: round2(Lg * 60 / V) } : null;
  if (key === 'V')  return isFilled(Lg) && isFilled(T) ? { key, value: round2(Lg * 60 / T) } : null;
  if (key === 'Lg') return isFilled(V)  && isFilled(T) ? { key, value: Math.round(V * T / 60) } : null;
  return null;
}

/**
 * Crea un solver amb estat propi (recència d'edició) per a la fórmula Lg/V = T/60,
 * amb el model "els dos últims editats manen".
 * @returns {{touch: (key: string) => void, resolve: (values: {Lg: number, V: number, T: number}) => ({key: string, value: number}|null), derivedByRecency: () => (string|null), recency: string[]}}
 */
export function createFormulaSolver() {
  let recency = []; // keys editats, més recent al final, ≤ 2

  function touch(key) {
    if (!FORMULA_KEYS.includes(key)) return;
    recency = recency.filter(k => k !== key);
    recency.push(key);
    if (recency.length > 2) recency = recency.slice(-2);
  }

  // El derivat per recència = el camp que NO és cap dels dos últims editats.
  function derivedByRecency() {
    if (recency.length < 2) return null;
    return FORMULA_KEYS.find(k => !recency.includes(k)) ?? null;
  }

  // Quin camp tocar, donats els valors actuals:
  //  · exactament 1 buit  → omple'l (regla "dos plens → el tercer")
  //  · cap buit (3 plens) → el menys recent (derivat per recència)
  //  · altrament          → res
  function pickTarget(values) {
    const empties = FORMULA_KEYS.filter(k => !isFilled(values[k]));
    if (empties.length === 1) return empties[0];
    if (empties.length === 0) return derivedByRecency();
    return null;
  }

  // Retorna {key, value} a escriure, o null.
  function resolve(values) {
    const target = pickTarget(values);
    return target ? computeField(target, values) : null;
  }

  return {
    touch,
    resolve,
    derivedByRecency,
    get recency() { return [...recency]; }
  };
}
