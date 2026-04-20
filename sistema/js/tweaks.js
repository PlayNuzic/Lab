// Tweaks panel wiring

const PANEL = document.getElementById('tweaks');
const selPaso = document.getElementById('tw-paso');
const selTheme = document.getElementById('tw-theme');
const selDensity = document.getElementById('tw-density');
const selVariant = document.getElementById('tw-variant');
const cbIframe = document.getElementById('tw-iframe');

// Local dev: show the panel with ?tweaks=1 (Claude Design hides it by default
// and reveals it via postMessage from its edit-mode parent).
if (new URLSearchParams(location.search).has('tweaks')) {
  PANEL.hidden = false;
}

// Edit-mode handshake (Claude Design compatibility — no-op when standalone).
function listener(e){
  const d = e.data;
  if (!d || !d.type) return;
  if (d.type === '__activate_edit_mode') PANEL.hidden = false;
  if (d.type === '__deactivate_edit_mode') PANEL.hidden = true;
}
window.addEventListener('message', listener);
window.parent.postMessage({ type: '__edit_mode_available' }, '*');

// Initial sync with state
const S = window.__sistemaState;
selPaso.value = S.paso;
selTheme.value = document.body.dataset.theme || 'light';
selDensity.value = S.density;
selVariant.value = S.variant;
cbIframe.checked = S.showIframe;

selPaso.addEventListener('change', ()=>{
  S.paso = Number(selPaso.value);
  S.variant = 'a';
  window.__sistemaRender();
});
selTheme.addEventListener('change', ()=>{
  document.body.dataset.theme = selTheme.value;
});
selDensity.addEventListener('change', ()=>{
  S.density = selDensity.value;
  window.__sistemaRender();
});
selVariant.addEventListener('change', ()=>{
  S.variant = selVariant.value;
  window.__sistemaRender();
});
cbIframe.addEventListener('change', ()=>{
  S.showIframe = cbIframe.checked;
  window.__sistemaRender();
});

// Keep select synced when nav changes paso
const origRender = window.__sistemaRender;
window.__sistemaRender = function(){
  origRender();
  selPaso.value = S.paso;
  selVariant.value = S.variant;
};
