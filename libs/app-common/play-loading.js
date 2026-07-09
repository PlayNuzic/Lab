/**
 * @fileoverview U-27: estat de càrrega del botó Play.
 *
 * Quatre apps melòdiques duplicaven un bloc `wasLoading` (disabled +
 * icona al 50%) mentre carregava l'instrument, i les rítmiques no tenien
 * res: el primer Play (Tone.js + gest + samples) era un botó inert sense
 * cap indicació en connexions lentes.
 *
 * Aquest helper embolcalla la tasca d'init: si triga més de `delayMs`
 * mostra l'estat de càrrega (disabled + aria-busy + icona atenuada) i el
 * restaura SEMPRE, també si la tasca llença — sense llindar, les apps amb
 * àudio ja calent tindrien un parpelleig a cada Play.
 */

/**
 * @param {HTMLElement|null} playBtn - Botó de play (pot ser null: no-op)
 * @param {Function} task - Tasca async (típicament initAudio)
 * @param {Object} [options]
 * @param {number} [options.delayMs=120] - Llindar abans de mostrar l'estat
 * @returns {Promise<*>} El resultat de `task`
 */
export async function withPlayButtonLoading(playBtn, task, { delayMs = 120 } = {}) {
  const icon = playBtn?.querySelector('.icon-play');
  // A-01: bloqueig SÍNCRON del botó per tancar la finestra de doble clic
  // abans que dispari `task()`; els visuals (aria-busy, opacity) segueixen
  // darrere del llindar per preservar l'anti-parpelleig U-27.
  if (playBtn) playBtn.disabled = true;
  let shown = false;
  const timer = playBtn
    ? setTimeout(() => {
        shown = true;
        playBtn.setAttribute('aria-busy', 'true');
        if (icon) icon.style.opacity = '0.5';
      }, delayMs)
    : null;
  try {
    return await task();
  } finally {
    if (timer) clearTimeout(timer);
    if (playBtn) playBtn.disabled = false;
    if (shown && playBtn) {
      playBtn.removeAttribute('aria-busy');
      if (icon) icon.style.opacity = '1';
    }
  }
}
