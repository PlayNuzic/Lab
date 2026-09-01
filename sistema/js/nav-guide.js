// Guia de navegació — nota discreta a baix a l'esquerra («Cómo navegar»)
// que desplega un panell estàtic (index.html) amb les maneres de moure's pel
// Sistema: pasos de lectura (parallax, frase a frase) vs pasos amb app,
// botons/fletxes, índex de capítols, enllaç directe ?paso=N.
//
// Sense estat persistent i sense capturar el teclat: les fletxes de slides.js
// segueixen navegant amb el panell obert. Es tanca amb Esc, clic a fora, el
// botó × o el mateix enllaç. No és un modal (no bloqueja res).

export function initNavGuide() {
  const btn = document.getElementById('btn-guia');
  const panel = document.getElementById('nav-guide');
  if (!btn || !panel) return null;
  const closeBtn = panel.querySelector('.nav-guide__close');

  const isOpen = () => !panel.hidden;

  function open() {
    if (isOpen()) return;
    panel.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    (closeBtn || panel).focus();
  }

  // refocus: en tancar per teclat o amb × el focus torna a l'enllaç; en un
  // clic a fora no, per no robar-lo a l'element que l'usuari acaba de clicar.
  function close({ refocus = true } = {}) {
    if (!isOpen()) return;
    panel.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    if (refocus) btn.focus();
  }

  btn.addEventListener('click', () => (isOpen() ? close() : open()));
  closeBtn?.addEventListener('click', () => close());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  document.addEventListener('pointerdown', (e) => {
    if (isOpen() && !panel.contains(e.target) && !btn.contains(e.target)) close({ refocus: false });
  });
  // Un clic dins d'un iframe (les apps) no arriba al document, però sí que fa
  // perdre el focus a la finestra: ho aprofitem per tancar el panell.
  window.addEventListener('blur', () => close({ refocus: false }));

  return { open, close, isOpen };
}

// Auto-init només on hi ha l'enllaç (index.html); privacidad.html no en té.
if (typeof document !== 'undefined' && document.getElementById('btn-guia')) {
  initNavGuide();
}
