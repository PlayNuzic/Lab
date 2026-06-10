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
    const h = Math.max(
      document.documentElement.scrollHeight,
      document.body?.scrollHeight || 0
    );
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
  let rafPending = false;
  function scheduleNotify() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      notifyParentResize();
    });
  }

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
