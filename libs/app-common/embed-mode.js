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
//   <iframe src="Apps/app9/index.html?embed=true"></iframe>
if (new URLSearchParams(location.search).has('embed')) {
  document.documentElement.setAttribute('data-embed', 'true');

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
      } else {
        document.documentElement.removeAttribute('data-system-vertical');
      }
    }
  });
}
