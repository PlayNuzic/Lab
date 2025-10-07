/**
 * @fileoverview Formula Display Renderer
 *
 * Generates HTML fragments with formatted musical formulas:
 * - Pulsos enteros (Lg)
 * - Pulsos fraccionados (Lg·d/n)
 * - V base = (Lg / T)·60
 * - V fracción = (V·d)/n
 * - T = (Lg / V)·60
 *
 * Supports customizable formatters for numbers, BPM, and integers.
 */

/**
 * Default number formatter (2 decimal places, Catalan locale)
 * @param {number} value
 * @returns {string}
 */
function defaultFormatNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '';
  const rounded = Math.round(numeric * 100) / 100;
  return rounded.toLocaleString('ca-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

/**
 * Default integer formatter (no decimals, Catalan locale)
 * @param {number} value
 * @returns {string}
 */
function defaultFormatInteger(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '';
  return Math.round(numeric).toLocaleString('ca-ES');
}

/**
 * Creates a formula renderer with customizable formatters
 *
 * @param {Object} options
 * @param {Function} [options.formatNumber] - Formatter for decimal numbers
 * @param {Function} [options.formatInteger] - Formatter for integers
 * @param {Function} [options.formatBpm] - Formatter for BPM values (defaults to formatNumber)
 * @returns {Object} Formula renderer API
 */
export function createFormulaRenderer(options = {}) {
  const formatNumber = options.formatNumber || defaultFormatNumber;
  const formatInteger = options.formatInteger || defaultFormatInteger;
  const formatBpm = options.formatBpm || formatNumber;

  /**
   * Builds a complete formula info fragment
   *
   * @param {Object} params - Input parameters
   * @param {number} [params.lg] - Length (pulsos enteros)
   * @param {number} [params.numerator] - Fraction numerator
   * @param {number} [params.denominator] - Fraction denominator
   * @param {number} [params.tempo] - Tempo V (BPM)
   * @param {number} [params.t] - Period T (seconds)
   * @returns {DocumentFragment}
   */
  function buildFormulaFragment(params = {}) {
    const { lg, numerator, denominator, tempo, t } = params;

    const fragment = document.createDocumentFragment();

    const hasLg = Number.isFinite(lg) && lg > 0;
    const hasNumerator = Number.isFinite(numerator) && numerator > 0;
    const hasDenominator = Number.isFinite(denominator) && denominator > 0;
    const hasTempo = Number.isFinite(tempo) && tempo > 0;
    const hasT = Number.isFinite(t) && t > 0;

    // === PULSOS ENTEROS (Lg) ===
    if (hasLg) {
      const pulsesLine = document.createElement('p');
      pulsesLine.className = 'top-bar-info-tip__line';
      const pulsesLabel = document.createElement('strong');
      pulsesLabel.textContent = 'Pulsos enteros (Lg):';
      pulsesLine.append(pulsesLabel, ' ', formatInteger(lg));
      fragment.append(pulsesLine);

      // === PULSOS FRACCIONADOS (Lg·d/n) ===
      if (hasNumerator && hasDenominator) {
        const fractionalLg = (lg * denominator) / numerator;
        const lgLine = document.createElement('p');
        lgLine.className = 'top-bar-info-tip__line';
        const lgLabel = document.createElement('strong');
        lgLabel.textContent = 'Pulsos fraccionados (Lg·d/n):';
        lgLine.append(lgLabel, ' ', formatNumber(fractionalLg));
        fragment.append(lgLine);
      }
    } else {
      const hint = document.createElement('p');
      hint.className = 'top-bar-info-tip__line';
      hint.textContent = 'Define una Lg válida para contar los Pfr.';
      fragment.append(hint);
    }

    // === CALCULATE DERIVED VALUES ===
    const derivedTFromTempo = hasLg && hasTempo ? (lg * 60) / tempo : null;
    const tempoFromT = hasLg && hasT ? (lg / t) * 60 : null;
    const effectiveTempo = hasTempo ? tempo : tempoFromT;
    const tForBaseFormula = hasT ? t : derivedTFromTempo;

    // === V BASE FORMULA ===
    if (hasLg && tForBaseFormula != null && effectiveTempo != null) {
      const baseFormulaLine = document.createElement('p');
      baseFormulaLine.className = 'top-bar-info-tip__line';
      const baseFormulaLabel = document.createElement('strong');
      baseFormulaLabel.textContent = 'V base';
      baseFormulaLine.append(
        baseFormulaLabel,
        ` = (${formatInteger(lg)} / ${formatNumber(tForBaseFormula)})·60 = ${formatBpm(effectiveTempo)} BPM`
      );
      fragment.append(baseFormulaLine);
    } else if (effectiveTempo != null) {
      const baseLine = document.createElement('p');
      baseLine.className = 'top-bar-info-tip__line';
      const baseLabel = document.createElement('strong');
      baseLabel.textContent = 'V base:';
      baseLine.append(baseLabel, ' ', `${formatBpm(effectiveTempo)} BPM`);
      fragment.append(baseLine);
    } else if (hasLg && !hasTempo) {
      const hint = document.createElement('p');
      hint.className = 'top-bar-info-tip__hint';
      hint.textContent = 'Completa V para calcular la fórmula de V base.';
      fragment.append(hint);
    }

    // === V FRACTION FORMULA ===
    if (effectiveTempo != null && hasNumerator && hasDenominator) {
      const fractionTempo = effectiveTempo * (denominator / numerator);
      const fractionFormulaLine = document.createElement('p');
      fractionFormulaLine.className = 'top-bar-info-tip__line';
      const fractionFormulaLabel = document.createElement('strong');
      fractionFormulaLabel.textContent = `V ${numerator}/${denominator}`;
      fractionFormulaLine.append(
        fractionFormulaLabel,
        ` = (${formatBpm(effectiveTempo)}·${denominator})/${numerator} = ${formatBpm(fractionTempo)} BPM`
      );
      fragment.append(fractionFormulaLine);
    } else {
      const hint = document.createElement('p');
      hint.className = 'top-bar-info-tip__hint';
      hint.textContent = 'Completa V, n y d para obtener la velocidad de la fracción.';
      fragment.append(hint);
    }

    // === T FORMULA ===
    if (hasLg && hasTempo && derivedTFromTempo != null) {
      const tFormulaLine = document.createElement('p');
      tFormulaLine.className = 'top-bar-info-tip__line';
      const tFormulaLabel = document.createElement('strong');
      tFormulaLabel.textContent = 'T';
      tFormulaLine.append(
        tFormulaLabel,
        ` = (${formatInteger(lg)} / ${formatBpm(tempo)})·60 = ${formatNumber(derivedTFromTempo)} s`
      );
      fragment.append(tFormulaLine);
    } else if (hasT) {
      const tLine = document.createElement('p');
      tLine.className = 'top-bar-info-tip__line';
      const tLabel = document.createElement('strong');
      tLabel.textContent = 'T:';
      tLine.append(tLabel, ' ', `${formatNumber(t)} s`);
      fragment.append(tLine);
    }

    return fragment;
  }

  return {
    buildFormulaFragment,
    formatNumber,
    formatInteger,
    formatBpm
  };
}
