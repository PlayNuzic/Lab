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

  // LP-06: mides capturades al pointerdown — no canvien a mig drag, i
  // llegir el rect a cada pointermove just després d'escriure left/top
  // forçava un reflow síncron per moviment.
  let panelW = 0, panelH = 0;

  HEAD.addEventListener('pointerdown', (e) => {
    // Ignore drags that start on the collapse button.
    if (e.target.closest('.tweaks__collapse')) return;
    dragging = true;
    HEAD.setPointerCapture(e.pointerId);
    const rect = PANEL.getBoundingClientRect();
    originX = rect.left;
    originY = rect.top;
    panelW = rect.width;
    panelH = rect.height;
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
    const maxX = window.innerWidth - panelW;
    const maxY = window.innerHeight - panelH;
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
const btnClearFormat = document.getElementById('tw-clear-format');
const btnExport = document.getElementById('tw-export');
const btnResetPaso = document.getElementById('tw-reset-paso');
const imgActions = document.getElementById('tw-img-actions');
const inpImgSrc = document.getElementById('tw-img-src');
const inpImgAlt = document.getElementById('tw-img-alt');
const selImgPos = document.getElementById('tw-img-pos');
const llistaImg = document.getElementById('tw-img-list');
const btnImgAdd = document.getElementById('tw-img-add');

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
selDensity.value = window.__sistemaGetDensity?.() ?? 'cozy';
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
  syncImgPos();   // el bloc d'imatge no depèn del mode edició, però el DOM sí
  // P-26: contenteditable s'aplica al DOM viu — render() complet recreava
  // l'iframe de l'app embedada només per canviar un atribut.
  if (window.__sistemaApplyEdit) window.__sistemaApplyEdit();
  else window.__sistemaRender();
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
// Botó "Sin formato": desempaqueta tags de format (b/strong/em/i/h2-4/
// code/sup/sub/span/font) i strippeja inline styles. Preserva marks.
if (btnClearFormat) {
  btnClearFormat.addEventListener('mousedown', (e) => { e.preventDefault(); });
  btnClearFormat.addEventListener('click', () => {
    window.__sistemaClearFormatting?.();
  });
}
btnExport.addEventListener('click', async ()=>{
  // Exportem textos (overrides → slideContent) i densitats per pas
  // (densityByPaso → camp `density` del slideMatrix). Dues seccions
  // separades perquè cadascuna va a un lloc diferent del codi.
  const payload = {
    overrides: S.overrides || {},
    densityByPaso: S.densityByPaso || {},
    // Config del Parallax Lab (qualsevol paso amb layout 'P-parallax-lab':
    // els 5 intros de producció 1/7/11/17/22 + els 2 labs ocults 28.5/28.7)
    // — per endurir combinacions guanyadores com a defaults al codi (vegeu
    // parallax-lab.js).
    parallaxFx: window.__parallaxLab?.getConfigAll?.() || {},
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
// ── Imágenes del parallax ────────────────────────────────────────────────
// Dins del text d'un paso de parallax, una imatge pot anar de dues maneres:
//   · LLIGADA a una frase: <p>text<br><img …></p> — frase i imatge apareixen
//     i se'n van juntes (és el que fa servir la intro, paso 1).
//   · SOLA, com una frase més: <p><img …></p>, amb la seva cel·la de scroll.
// El motor no se n'assabenta: aquí només es reescriu el text del paso, i la
// resta del camí (override → export → slide-data) és el de sempre. No
// confondre amb la imatge de FONS del paso (slide-data → content.image).
const IMG_G = /<img\b[^>]*>/gi;
const BR_G = /<br\s*\/?>/gi;
// Els logos enllaçats (<a href><img>Nom</a>, l'última frase de la coda) són
// part de l'enllaç, no imatges de frase: no surten a la llista ni es mouen.
const ENLLAC_G = /<a\b[^>]*>[\s\S]*?<\/a>/gi;

function campFrases() {
  return document.querySelector('.parallax-frases[data-field="text"]');
}

/** HTML interior de cada frase del paso actual, o null si no és parallax. */
function frasesHtml() {
  const camp = campFrases();
  return camp ? [...camp.querySelectorAll(':scope > p')].map(p => p.innerHTML) : null;
}

/** Text visible d'una frase, sense imatges ni salts. */
function textDe(html) {
  return html.replace(IMG_G, '').replace(BR_G, ' ').replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ').trim();
}

/** Totes les imatges del paso, amb la frase on són i si hi van soles. */
function imatgesDe(frases) {
  const out = [];
  frases.forEach((html, frase) => {
    const sola = !textDe(html);
    (html.replace(ENLLAC_G, '').match(IMG_G) || []).forEach((tag) => {
      out.push({ frase, sola, tag, src: (tag.match(/\ssrc="([^"]*)"/i) || [])[1] || '' });
    });
  });
  return out;
}

/** Treu una imatge de la seva frase (amb el <br> que la separava del text);
 *  si la frase es queda sense res, desapareix. */
function treuImatge(frases, frase, tag) {
  const html = frases[frase];
  const i = html.indexOf(tag);
  if (i < 0) return;
  const resta = html.slice(0, i).replace(/<br\s*\/?>\s*$/i, '') + html.slice(i + tag.length);
  if (!textDe(resta) && !/<img\b/i.test(resta)) frases.splice(frase, 1);
  else frases[frase] = resta;
}

/** Posa una imatge al destí: 'con:K' (lligada a la frase K) o 'sola:K'
 *  (frase pròpia a la posició K, 0 = al principi). */
function posaImatge(frases, desti, tag) {
  const [mode, n] = String(desti).split(':');
  const k = Number(n) || 0;
  if (mode === 'con' && frases[k] !== undefined) frases[k] = `${frases[k]}<br>${tag}`;
  else frases.splice(Math.max(0, Math.min(frases.length, k)), 0, tag);
}

/** Desa les frases com a text del paso i re-renderitza. */
function desaFrases(frases) {
  S.overrides[S.paso] = {
    ...(S.overrides[S.paso] || {}),
    text: frases.map(html => `<p>${html}</p>`).join('\n'),
  };
  window.__sistemaSaveOverrides();
  window.__sistemaRender();
}

const escAttr = (v) => String(v)
  .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
  .replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Etiqueta curta d'una frase: número i inici del text (o el fitxer, si és
 *  una imatge sola), perquè al selector es vegi de quina frase es parla. */
function etiquetaFrase(html, k) {
  const t = textDe(html);
  if (t) return `${k + 1} · «${t.length > 28 ? `${t.slice(0, 28)}…` : t}»`;
  const src = (html.match(/\ssrc="([^"]*)"/i) || [])[1] || '';
  return `${k + 1} · [${src.split('/').pop() || 'imagen'}]`;
}

/** Destins possibles: lligada a qualsevol frase amb text, o sola en
 *  qualsevol posició. Si el valor demanat ja no existeix, "al final". */
function omplePosicions(sel, frases, valor) {
  sel.innerHTML = '';
  const grup = (label) => {
    const g = document.createElement('optgroup');
    g.label = label; sel.appendChild(g);
    return g;
  };
  const opcio = (g, v, text) => {
    const o = document.createElement('option');
    o.value = v; o.textContent = text; g.appendChild(o);
  };
  const junt = grup('Junto a la frase');
  frases.forEach((html, k) => { if (textDe(html)) opcio(junt, `con:${k}`, etiquetaFrase(html, k)); });
  if (!junt.children.length) junt.remove();
  const sola = grup('Como paso propio');
  opcio(sola, 'sola:0', 'Al principio');
  frases.forEach((html, k) => opcio(sola, `sola:${k + 1}`, `Después de ${etiquetaFrase(html, k)}`));
  const valors = [...sel.options].map(o => o.value);
  sel.value = valors.includes(valor) ? valor : `sola:${frases.length}`;
}

/** Refresca el bloc: una fila per imatge del paso (on apareix, canviable, i
 *  ×) i el selector per a la següent. Si el paso no és de parallax, inert. */
function syncImgPos() {
  if (!imgActions || !selImgPos) return;
  const frases = frasesHtml();
  if (llistaImg) llistaImg.innerHTML = '';

  (frases ? imatgesDe(frases) : []).forEach((img) => {
    if (!llistaImg) return;
    // Els destins es calculen sobre les frases SENSE aquesta imatge: és com
    // quedaran just abans de tornar-la a posar on es triï.
    const resta = [...frases];
    treuImatge(resta, img.frase, img.tag);

    const item = document.createElement('div');
    item.className = 'tweaks__img-item';
    const nom = document.createElement('span');
    nom.className = 'tweaks__img-name';
    nom.textContent = (img.src.split('/').pop() || img.src).replace(/\.(webp|png|jpe?g|gif|svg)$/i, '');
    nom.title = img.src;

    const sel = document.createElement('select');
    sel.title = 'Dónde aparece la imagen';
    omplePosicions(sel, resta, img.sola ? `sola:${img.frase}` : `con:${img.frase}`);
    sel.addEventListener('change', () => {
      const fr = frasesHtml();
      if (!fr) return;
      treuImatge(fr, img.frase, img.tag);
      posaImatge(fr, sel.value, img.tag);
      desaFrases(fr);
    });

    const treu = document.createElement('button');
    treu.type = 'button';
    treu.className = 'tweaks__btn';
    treu.textContent = '×';
    treu.title = 'Quitar la imagen de este paso';
    treu.addEventListener('click', () => {
      const fr = frasesHtml();
      if (!fr) return;
      treuImatge(fr, img.frase, img.tag);
      desaFrases(fr);
    });

    item.append(nom, sel, treu);
    llistaImg.appendChild(item);
  });

  omplePosicions(selImgPos, frases || [], selImgPos.value);
  [inpImgSrc, inpImgAlt, selImgPos, btnImgAdd].forEach(el => { if (el) el.disabled = !frases; });
}

btnImgAdd?.addEventListener('click', () => {
  const src = inpImgSrc.value.trim();
  const frases = frasesHtml();
  if (!frases) return;
  if (!src) { inpImgSrc.focus(); return; }
  posaImatge(frases, selImgPos.value, `<img src="${escAttr(src)}" alt="${escAttr(inpImgAlt.value.trim())}">`);
  desaFrases(frases);
});

// El render inicial de slides.js ja ha passat quan aquest mòdul s'executa
// (l'ordre dels <script> és slides.js → tweaks.js), així que la primera
// sincronització es fa aquí a mà; les següents venen per 'sistema:render'.
syncImgPos();

btnResetPaso.addEventListener('click', ()=>{
  const p = S.paso;
  if (!S.overrides[p]) return;
  if (!confirm(`¿Descartar todos los cambios del paso ${p}?`)) return;
  delete S.overrides[p];
  window.__sistemaSaveOverrides();
  window.__sistemaRender();
});

// LU-09: sync dels selects amb CADA render — l'antic wrapper de
// window.__sistemaRender només es disparava per a canvis fets des del
// propi panell; la navegació interna (fletxes/botons) crida el render()
// local de slides.js, que ara emet 'sistema:render'. El fallback de
// densitat és 'cozy' (DEFAULT_DENSITY real), no 'compact'.
document.addEventListener('sistema:render', () => {
  selPaso.value = S.paso;
  selDensity.value = window.__sistemaGetDensity?.() ?? 'cozy';
  syncImgPos();
});
