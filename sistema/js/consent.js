// Gate de consentiment RGPD per a Microsoft Clarity (Consent API v2:
// learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-consent-api-v2).
// Clarity NO es carrega (cap petició a clarity.ms) fins que l'usuari accepta
// explícitament — no depenem del "Consent Mode" del dashboard de Clarity,
// que és un toggle manual seu, no una opció de codi.

export const CONSENT_KEY = 'sistema.consent';
const CLARITY_PROJECT_ID = 'xltk7vdfux';

export function getConsent() {
  try { return localStorage.getItem(CONSENT_KEY); } catch { return null; }
}

function setConsent(value) {
  try { localStorage.setItem(CONSENT_KEY, value); } catch {}
}

// Retira el consentiment: esborra la decisió (el banner tornarà a aparèixer),
// diu a Clarity que el revoqui i expira les seves cookies encara que el seu
// script no sigui present en aquesta pàgina (p.ex. privacidad.html).
export function resetConsent() {
  try { localStorage.removeItem(CONSENT_KEY); } catch {}
  try { if (typeof window.clarity === 'function') window.clarity('consent', false); } catch {}
  ['_clck', '_clsk'].forEach(name => { document.cookie = `${name}=; Max-Age=0; Path=/`; });
}

// Port literal del snippet oficial de Clarity, com a funció perquè només
// s'executi en acceptar (o en tornar amb un consentiment ja concedit).
function loadClarityScript(projectId) {
  (function (c, l, a, r, i, t, y) {
    c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
    t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i;
    y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
  })(window, document, 'clarity', 'script', projectId);
}

function grantConsent() {
  loadClarityScript(CLARITY_PROJECT_ID);
  try {
    window.clarity('consentv2', { ad_Storage: 'granted', analytics_Storage: 'granted' });
  } catch {}
}

function buildBanner(onAccept, onReject) {
  const bar = document.createElement('div');
  bar.className = 'consent-banner';
  bar.setAttribute('role', 'dialog');
  bar.setAttribute('aria-label', 'Consentimiento de analítica');
  bar.innerHTML = `
    <p class="consent-banner__text">Usamos Microsoft Clarity para analítica anónima (mapas de calor, navegación y grabaciones de sesión) y así mejorar esta presentación. <a class="consent-banner__link" href="privacidad.html">Más información</a>.</p>
    <div class="consent-banner__actions">
      <button type="button" class="consent-banner__btn consent-banner__btn--accept">Aceptar</button>
      <button type="button" class="consent-banner__btn consent-banner__btn--reject">Rechazar</button>
    </div>`;
  bar.querySelector('.consent-banner__btn--accept').addEventListener('click', () => { onAccept(); bar.remove(); });
  bar.querySelector('.consent-banner__btn--reject').addEventListener('click', () => { onReject(); bar.remove(); });
  return bar;
}

export function initConsent() {
  const decision = getConsent();
  if (decision === 'granted') { grantConsent(); return; }
  if (decision === 'denied') return;

  document.body.appendChild(buildBanner(
    () => { setConsent('granted'); grantConsent(); },
    () => { setConsent('denied'); }
  ));
}

// Auto-init només si hi ha la presentació (l'stage dels slides). La pàgina
// privacidad.html importa aquest mòdul però NO ha de mostrar el banner.
if (typeof document !== 'undefined' && document.getElementById('slide-stage')) {
  initConsent();
}
