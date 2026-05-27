// Tweaks panel wiring

const PANEL = document.getElementById('tweaks');
const HEAD  = document.getElementById('tweaks-head');
const COLLAPSE_BTN = document.getElementById('tweaks-collapse');
const selPaso = document.getElementById('tw-paso');

// --- Persistent position + collapse state -------------------------------
const POS_KEY = 'sistema.tweaks.pos';
const COLLAPSED_KEY = 'sistema.tweaks.collapsed';

// Restore saved position (x = left px, y = top px). If none, the CSS default
// (right: 20px; bottom: nav+16px) kicks in. Stored values override via left/top.
const savedPos = (() => {
  try { return JSON.parse(localStorage.getItem(POS_KEY)) || null; } catch { return null; }
})();
if (savedPos && Number.isFinite(savedPos.x) && Number.isFinite(savedPos.y)) {
  // Clamp la posició desada al viewport actual. Sense això, una posició
  // guardada en una finestra més gran (o un altre monitor) deixa el panell
  // fora de la vista — el panell existeix i és "visible" però renderitzat
  // fora de pantalla, donant la impressió que ha desaparegut (cas típic:
  // surt en un navegador "net" però no en un que té la posició desada).
  // Reservem un marge perquè sempre en quedi una franja agafable.
  const MARGIN = 60;
  const maxX = Math.max(0, window.innerWidth - MARGIN);
  const maxY = Math.max(0, window.innerHeight - MARGIN);
  const x = Math.min(Math.max(0, savedPos.x), maxX);
  const y = Math.min(Math.max(0, savedPos.y), maxY);
  PANEL.style.left = `${x}px`;
  PANEL.style.top  = `${y}px`;
  PANEL.style.right = 'auto';
  PANEL.style.bottom = 'auto';
}

// Restore collapsed state
if (localStorage.getItem(COLLAPSED_KEY) === '1') {
  PANEL.classList.add('is-collapsed');
}

// Collapse toggle
COLLAPSE_BTN.addEventListener('click', (e) => {
  e.stopPropagation();
  PANEL.classList.toggle('is-collapsed');
  localStorage.setItem(COLLAPSED_KEY, PANEL.classList.contains('is-collapsed') ? '1' : '0');
});

// Drag the panel by its header. Pointer-events API keeps it touch-friendly.
(function wireDrag(){
  let dragging = false;
  let startX = 0, startY = 0;
  let originX = 0, originY = 0;

  HEAD.addEventListener('pointerdown', (e) => {
    // Ignore drags that start on the collapse button.
    if (e.target.closest('.tweaks__collapse')) return;
    dragging = true;
    HEAD.setPointerCapture(e.pointerId);
    const rect = PANEL.getBoundingClientRect();
    originX = rect.left;
    originY = rect.top;
    startX = e.clientX;
    startY = e.clientY;
    PANEL.style.left = `${originX}px`;
    PANEL.style.top  = `${originY}px`;
    PANEL.style.right = 'auto';
    PANEL.style.bottom = 'auto';
  });

  HEAD.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const nx = originX + (e.clientX - startX);
    const ny = originY + (e.clientY - startY);
    // Clamp to viewport
    const pr = PANEL.getBoundingClientRect();
    const maxX = window.innerWidth - pr.width;
    const maxY = window.innerHeight - pr.height;
    const cx = Math.max(0, Math.min(maxX, nx));
    const cy = Math.max(0, Math.min(maxY, ny));
    PANEL.style.left = `${cx}px`;
    PANEL.style.top  = `${cy}px`;
  });

  function endDrag(e){
    if (!dragging) return;
    dragging = false;
    try { HEAD.releasePointerCapture(e.pointerId); } catch {}
    const rect = PANEL.getBoundingClientRect();
    localStorage.setItem(POS_KEY, JSON.stringify({ x: rect.left, y: rect.top }));
  }
  HEAD.addEventListener('pointerup', endDrag);
  HEAD.addEventListener('pointercancel', endDrag);
})();


const selTheme = document.getElementById('tw-theme');
const selDensity = document.getElementById('tw-density');
const selVariant = document.getElementById('tw-variant');
const cbIframe = document.getElementById('tw-iframe');
const cbEdit = document.getElementById('tw-edit');
const editActions = document.getElementById('tw-edit-actions');
const btnExport = document.getElementById('tw-export');
const btnResetPaso = document.getElementById('tw-reset-paso');

// Visibilitat del panell tweaks. Tres vies:
//   1. `?tweaks=1` a la URL (qualsevol entorn).
//   2. Entorn local de desenvolupament (localhost / 127.0.0.1 / file://):
//      es mostra automàticament perquè no calgui recordar el query param.
//   3. postMessage `__activate_edit_mode` del parent (Claude Design).
// En producció (p.ex. nuzic.org) cap d'aquestes via aplica → queda amagat.
const HAS_TWEAKS_PARAM = new URLSearchParams(location.search).has('tweaks');
const IS_LOCAL_DEV = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/.test(location.hostname)
  || location.protocol === 'file:';
if (HAS_TWEAKS_PARAM || IS_LOCAL_DEV) {
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
cbEdit.addEventListener('change', ()=>{
  S.editable = cbEdit.checked;
  document.body.dataset.editable = cbEdit.checked ? 'true' : 'false';
  editActions.hidden = !cbEdit.checked;
  window.__sistemaRender();
});
btnExport.addEventListener('click', async ()=>{
  const json = JSON.stringify(S.overrides, null, 2);
  try {
    await navigator.clipboard.writeText(json);
    btnExport.textContent = '¡Copiado!';
    setTimeout(()=>{ btnExport.textContent = 'Exportar'; }, 1500);
  } catch {
    // Fallback: open a window with the JSON.
    const w = window.open('', '_blank');
    if (w) { w.document.body.innerText = json; }
  }
  console.log('[sistema] overrides JSON:\n', json);
});
btnResetPaso.addEventListener('click', ()=>{
  const p = S.paso;
  if (!S.overrides[p]) return;
  if (!confirm(`¿Descartar todos los cambios del paso ${p}?`)) return;
  delete S.overrides[p];
  window.__sistemaSaveOverrides();
  window.__sistemaRender();
});

// Keep select synced when nav changes paso
const origRender = window.__sistemaRender;
window.__sistemaRender = function(){
  origRender();
  selPaso.value = S.paso;
  selVariant.value = S.variant;
};
