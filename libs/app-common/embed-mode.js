// Embed mode detector for the Sistema Interactivo iframes.
//
// Classic (non-module) script on purpose: it runs synchronously during
// <head> parsing so `data-embed="true"` lands on <html> before the first
// paint. No flash of non-embed layout.
//
// Usage (in each app's <head>):
//   <script src="../../libs/app-common/embed-mode.js"></script>
//   <link rel="stylesheet" href="../../libs/app-common/embed.css" />
//
// Activate from the Sistema:
//   <iframe src="Apps/App9/index.html?embed=true"></iframe>
if (new URLSearchParams(location.search).has('embed')) {
  document.documentElement.setAttribute('data-embed', 'true');

  // Evita scroll-jump al parent (Sistema) quan una app fa `.focus()` sobre
  // un input/botó durant la init (típic d'editors amb auto-focus a la
  // primera cel·la). Sense `preventScroll`, el browser porta l'iframe a la
  // vista del parent → la pàgina del Sistema baixa fins a l'app i interromp
  // la lectura del text del pas. En mode embed apliquem `preventScroll:true`
  // per defecte; les apps poden continuar passant options explícites
  // (es respecten si tenen `preventScroll` definit).
  const _focus = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function(options) {
    if (options == null) {
      return _focus.call(this, { preventScroll: true });
    }
    if (typeof options === 'object' && !('preventScroll' in options)) {
      return _focus.call(this, { ...options, preventScroll: true });
    }
    return _focus.call(this, options);
  };

  // El Sistema (parent) ens envia el seu propi mode (horitzontal/vertical)
  // via postMessage cada cop que el viewport del browser creua el
  // breakpoint de 900px. Algunes apps (App23, App24) volen apilar les
  // seves columnes exactament al mateix moment que el Sistema, no segons
  // l'amplada de l'iframe (que se solapa entre els dos modes del Sistema).
  // Reflectim l'estat a l'atribut `data-system-vertical` del <html>.
  window.addEventListener('message', (e) => {
    if (e?.data?.type === 'sistema:system-mode') {
      if (e.data.vertical) {
        document.documentElement.setAttribute('data-system-vertical', 'true');
        notifyParentResize();   // immediat: el sistema espera l'alçada
        // Re-mesures d'assentament: el missatge del Sistema arriba al `load`
        // de l'iframe, sovint abans que main.js hagi acabat de muntar la
        // línia i els controls (init asíncron, fonts). Sense això, l'única
        // alçada informada podia ser la del DOM a mig fer (App26: 170 en
        // lloc de 265) i l'iframe tallava els controls.
        [120, 400, 1000, 2500].forEach((ms) => setTimeout(notifyParentResize, ms));
      } else {
        document.documentElement.removeAttribute('data-system-vertical');
      }
    }
  });

  // En mode sistema-vertical, embed.css allibera els overflow:hidden i
  // height:100vh imposats al body i main, així el body creix a l'alçada
  // natural del contingut. Però els iframes no s'expandeixen sols a
  // l'alçada del seu document — cal mesurar-la i informar el parent.
  // Mateix patró que els iframe-resize libraries clàssics.
  function notifyParentResize() {
    if (document.documentElement.getAttribute('data-system-vertical') !== 'true') return;
    // No fem servir documentElement.scrollHeight: mai és inferior a
    // l'alçada del viewport de l'iframe, així que amb el mínim de 320px
    // del Sistema l'app "informava" 320 encara que el contingut fes 200 i
    // quedava una franja buida sota l'app (paso 3). En mode vertical el
    // body té height:auto (embed.css): body.scrollHeight és el contingut
    // real, incloent-hi el que desborda la caixa (controls posicionats o
    // que salten de línia en pantalles estretes) — la caixa del body sola
    // els deixaria fora i l'iframe els tallaria.
    const body = document.body;
    const cs = body ? getComputedStyle(body) : null;
    const h = body
      ? Math.ceil(body.scrollHeight + parseFloat(cs.marginTop || 0) + parseFloat(cs.marginBottom || 0))
      : document.documentElement.scrollHeight;
    try {
      window.parent.postMessage({ type: 'app:resize', height: h }, '*');
    } catch {
      // cross-origin o parent buit — silenciós
    }
  }

  // ResizeObserver detecta canvis al body (canvis de layout, càrrega
  // d'imatges, contingut dinàmic afegit per main.js). Throttle via
  // requestAnimationFrame perquè múltiples mutacions en un sol tick es
  // converteixin en un sol missatge.
  // Coalescència amb setTimeout (no rAF): rAF no corre en pestanyes en
  // segon pla ni en alguns entorns sense frames, i una notificació perduda
  // deixa l'iframe amb una alçada antiga.
  let notifyTimer = null;
  function scheduleNotify() {
    if (notifyTimer) return;
    notifyTimer = setTimeout(() => {
      notifyTimer = null;
      notifyParentResize();
    }, 16);
  }
  // L'alçada de l'iframe la posa el parent a partir del nostre missatge:
  // si el layout depèn del viewport (vh, media queries), re-mesurem quan
  // canvia i convergim. També en acabar de carregar fonts i recursos.
  window.addEventListener('resize', scheduleNotify);
  window.addEventListener('load', scheduleNotify);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleNotify);

  // Interacció bàsica cap al Sistema (analítica, sistema/js/analytics.js):
  // play / random / reset del template compartit (libs/app-common/template.js)
  // i la primera edició (qualsevol `input`, editors contenteditable inclosos,
  // tret del BPM). Mateix canal que app:resize; l'app no sap res de Clarity.
  // Fase de captura: un stopPropagation de l'app no ho ha de tapar.
  const APP_NAME = (location.pathname.match(/\/(App\d{1,2}[A-Z]?)\//i) || [])[1] || 'App';
  function tellParent(type) {
    try { window.parent.postMessage({ type, app: APP_NAME }, '*'); } catch {}
  }
  const BUTTON_EVENTS = { playBtn: 'app:play', randomBtn: 'app:random', resetBtn: 'app:reset' };
  document.addEventListener('click', (e) => {
    const btn = e.target && e.target.closest && e.target.closest('#playBtn, #randomBtn, #resetBtn');
    if (btn && BUTTON_EVENTS[btn.id]) tellParent(BUTTON_EVENTS[btn.id]);
  }, true);
  let editSent = false;
  document.addEventListener('input', (e) => {
    if (editSent) return;
    const t = e.target;
    if (!t || /bpm/i.test(t.id || '')) return;
    editSent = true;
    tellParent('app:edit');
  }, true);

  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(scheduleNotify);
    // Observem el body un cop existeixi (script al <head>, body encara
    // no parsejat).
    if (document.body) {
      ro.observe(document.body);
    } else {
      document.addEventListener('DOMContentLoaded', () => ro.observe(document.body), { once: true });
    }
  }
}
