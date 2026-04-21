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
  PANEL.style.left = `${savedPos.x}px`;
  PANEL.style.top  = `${savedPos.y}px`;
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
