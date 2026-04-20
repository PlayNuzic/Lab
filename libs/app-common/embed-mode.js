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
}
