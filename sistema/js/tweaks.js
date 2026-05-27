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
const cbIframe = document.getElementById('tw-iframe');
const cbEdit = document.getElementById('tw-edit');
const editActions = document.getElementById('tw-edit-actions');
const editActions2 = document.getElementById('tw-edit-actions-2');
const btnHlPink = document.getElementById('tw-hl-pink');
const btnHlYellow = document.getElementById('tw-hl-yellow');
const btnHlBox = document.getElementById('tw-hl-box');
const btnHlClear = document.getElementById('tw-hl-clear');
const btnExport = document.getElementById('tw-export');
const btnResetPaso = document.getElementById('tw-reset-paso');

// Visibilitat del panell tweaks. Dues vies:
//   1. `?tweaks=1` a la URL.
//   2. postMessage `__activate_edit_mode` del parent (Claude Design).
// En entorn local sense `?tweaks=1` (ni a producció) queda amagat — així
// el Sistema es veu com el visitant final fins i tot en desenvolupament.
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
selDensity.value = window.__sistemaGetDensity?.() ?? 'compact';
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
  // La densitat es grava per slide (vegeu __sistemaSetDensity a slides.js).
  window.__sistemaSetDensity?.(selDensity.value);
});
cbIframe.addEventListener('change', ()=>{
  S.showIframe = cbIframe.checked;
  window.__sistemaRender();
});
cbEdit.addEventListener('change', ()=>{
  S.editable = cbEdit.checked;
  document.body.dataset.editable = cbEdit.checked ? 'true' : 'false';
  editActions.hidden = !cbEdit.checked;
  if (editActions2) editActions2.hidden = !cbEdit.checked;
  window.__sistemaRender();
});

// Marques de ressaltat: apliquen un fons rosa/groc a la selecció de
// text dins d'un camp editable (text/tips). `mousedown` amb preventDefault
// perquè el clic al botó no esborri la selecció del camp contenteditable.
function wireHighlightButton(btn, colorClass){
  if (!btn) return;
  btn.addEventListener('mousedown', (e) => { e.preventDefault(); });
  btn.addEventListener('click', () => {
    window.__sistemaApplyHighlight?.(colorClass);
  });
}
wireHighlightButton(btnHlPink, 'hl-pink');
wireHighlightButton(btnHlYellow, 'hl-yellow');
wireHighlightButton(btnHlBox, 'hl-box');

// Botó "Sin marca": treu qualsevol ressaltat de la selecció.
if (btnHlClear) {
  btnHlClear.addEventListener('mousedown', (e) => { e.preventDefault(); });
  btnHlClear.addEventListener('click', () => {
    window.__sistemaClearHighlight?.();
  });
}
btnExport.addEventListener('click', async ()=>{
  // Exportem textos (overrides → slideContent) i densitats per pas
  // (densityByPaso → camp `density` del slideMatrix). Dues seccions
  // separades perquè cadascuna va a un lloc diferent del codi.
  const payload = {
    overrides: S.overrides || {},
    densityByPaso: S.densityByPaso || {},
  };
  const json = JSON.stringify(payload, null, 2);
  try {
    await navigator.clipboard.writeText(json);
    btnExport.textContent = '¡Copiado!';
    setTimeout(()=>{ btnExport.textContent = 'Exportar'; }, 1500);
  } catch {
    // Fallback: open a window with the JSON.
    const w = window.open('', '_blank');
    if (w) { w.document.body.innerText = json; }
  }
  console.log('[sistema] export JSON:\n', json);
});
btnResetPaso.addEventListener('click', ()=>{
  const p = S.paso;
  if (!S.overrides[p]) return;
  if (!confirm(`¿Descartar todos los cambios del paso ${p}?`)) return;
  delete S.overrides[p];
  window.__sistemaSaveOverrides();
  window.__sistemaRender();
});

// Keep selects synced when nav changes paso (paso + density per slide)
const origRender = window.__sistemaRender;
window.__sistemaRender = function(){
  origRender();
  selPaso.value = S.paso;
  selDensity.value = window.__sistemaGetDensity?.() ?? 'compact';
};
