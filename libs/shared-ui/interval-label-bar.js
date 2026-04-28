// interval-label-bar.js
// Indicador d'interval temporal (iT) tipus "halter" per col·locar sota una
// barra colorada sobre una timeline. Estructura: punt-línia-caixa amb número-línia-punt.
// Color: var(--nuzic-yellow). Reusable en qualsevol app que treballi iT.

/**
 * Crea l'element indicador d'iT amb dos punts als extrems, una línia prima
 * que els uneix i una caixa central amb el número.
 *
 * @param {Object} opts
 * @param {number} opts.startPercent - Posició esquerra (0-100)
 * @param {number} opts.widthPercent - Amplada (0-100)
 * @param {string|number} opts.label - Número d'iT (duració)
 * @returns {HTMLElement}
 */
export function createIntervalLabelBar({ startPercent, widthPercent, label }) {
  const bar = document.createElement('div');
  bar.className = 'interval-label-bar';
  bar.style.left = `${startPercent}%`;
  bar.style.width = `${widthPercent}%`;

  const dotStart = document.createElement('span');
  dotStart.className = 'interval-label-bar__dot interval-label-bar__dot--start';

  const box = document.createElement('span');
  box.className = 'interval-label-bar__box';
  box.textContent = label;

  const dotEnd = document.createElement('span');
  dotEnd.className = 'interval-label-bar__dot interval-label-bar__dot--end';

  bar.appendChild(dotStart);
  bar.appendChild(box);
  bar.appendChild(dotEnd);

  return bar;
}

/**
 * Elimina tots els indicadors d'iT d'un contenidor.
 */
export function clearIntervalLabelBars(container) {
  container.querySelectorAll('.interval-label-bar').forEach(el => el.remove());
}
