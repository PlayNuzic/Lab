// Slides renderer + navigation
//
// Reads the named layout (A-intro / B-app-left / C-text-top) from slide-data,
// applies its grid-template-areas/rows inline, and renders only the slots the
// slide declares (image, title, text, app, tips).

import { sections, slideMatrix, slideContent, fillerContent, layouts } from './slide-data.js';

const STAGE = document.getElementById('slide-stage');
const PROG  = document.getElementById('progress-track');
const NAV_SECTION = document.getElementById('nav-section');
const NAV_STEP    = document.getElementById('nav-step');
const BTN_PREV = document.getElementById('btn-prev');
const BTN_NEXT = document.getElementById('btn-next');

const STORAGE_KEY = 'sistema.paso';
const OVERRIDES_KEY = 'sistema.overrides';
const OVERRIDES_VERSION_KEY = 'sistema.overrides.version';
const OVERRIDES_VERSION = 2;  // bumped when paso 21 was merged into 20

// Easter egg: el capítol "Fracciones Complejas" està amagat per defecte.
// 5 clicks consecutius al `.paso-badge` de qualsevol pas del capítol
// Fraccionando l'activen; 5 clicks més, el botó "Cerrar capítulo" o
// tancar la pestanya el tornen a amagar. Persisteix només a sessionStorage
// perquè cada sessió comenci en estat "públic".
const COMPLEX_UNLOCK_KEY = 'sistema.complexUnlocked';
const COMPLEX_CLICK_THRESHOLD = 5;
const COMPLEX_CLICK_WINDOW_MS = 1500;

// One-time migration of saved overrides after the renumbering that
// merged the old paso 21 (Fracciones Complejas) into paso 20.
// Mapping: old → new
//   20 → discarded (App32 left the system)
//   21 → 20  (Fracciones Complejas, App34/App35)
//   22 → 21  (Escalas Escogiendo Notas, App21)
//   23 → 22  (Estructura Escalar, App22)
//   24 → 23  (Transposición, App23)
//   25 → 24  (Probando diferentes Escalas, App24)
//   26 → 25  (Melodías con Escalas, App25)
//   27 → 26  (Intervalos con Escalas, App25B)
function migrateOverridesV2(stored) {
  const remap = { 21: 20, 22: 21, 23: 22, 24: 23, 25: 24, 26: 25, 27: 26 };
  const out = {};
  for (const [k, v] of Object.entries(stored)) {
    const n = Number(k);
    if (n === 20) continue;  // App32 disappeared; nothing to map to.
    const target = remap[n] ?? n;
    out[target] = v;
  }
  return out;
}

// Text overrides (edit-mode persistence). Structure:
//   { [paso]: { title?: string, text?: string, tipsTitle?: string, tips?: string } }
// Each field stores the edited HTML (innerHTML for rich text, textContent for
// plain fields like titles). Loaded once and kept in sync via `saveOverrides`.
//
// On load AND on every save, HTML fields (text, tips) pass through
// `sanitizeHtml()` so pasted content from Google Docs / Word / etc. is
// stripped of inline styles, foreign fonts and class attributes — leaving
// only semantic tags (p, strong, em, h2/h3/h4, code, br, ul/ol/li). The
// sistema's own typography (Ubuntu via --font-body) then applies uniformly.
function loadOverrides(){
  try {
    let stored = JSON.parse(localStorage.getItem(OVERRIDES_KEY)) || {};
    let dirty = false;

    // One-time renumbering migration (see migrateOverridesV2 above).
    const ver = Number(localStorage.getItem(OVERRIDES_VERSION_KEY)) || 1;
    if (ver < OVERRIDES_VERSION) {
      stored = migrateOverridesV2(stored);
      localStorage.setItem(OVERRIDES_VERSION_KEY, String(OVERRIDES_VERSION));
      dirty = true;
    }

    Object.values(stored).forEach(slide => {
      if (typeof slide?.text === 'string') {
        const clean = sanitizeHtml(slide.text);
        if (clean !== slide.text) { slide.text = clean; dirty = true; }
      }
      if (typeof slide?.tips === 'string') {
        const clean = sanitizeHtml(slide.tips);
        if (clean !== slide.tips) { slide.tips = clean; dirty = true; }
      }
    });
    if (dirty) localStorage.setItem(OVERRIDES_KEY, JSON.stringify(stored));
    return stored;
  } catch { return {}; }
}
function saveOverrides(o){
  localStorage.setItem(OVERRIDES_KEY, JSON.stringify(o));
}

// Allowed HTML tags inside rich-text fields. Anything else is unwrapped
// (children kept, wrapper removed) or, in the case of <span> with bold/italic
// inline styles, converted to <strong>/<em>.
const ALLOWED_RICH_TAGS = new Set([
  'p','h2','h3','h4','strong','b','em','i','code','br','ul','ol','li','blockquote','sup','sub'
]);

// Convert plain ASCII superscript notation `N^M` (e.g. `P(3^1)`) into
// real <sup> markup. Only digits on either side, so `2^16` → `2<sup>16</sup>`
// without disturbing other `^` uses (regex, math expressions in code blocks
// are already escaped or wrapped in <code>).
function expandSuperscriptNotation(html){
  if (!html || typeof html !== 'string') return html;
  return html.replace(/(\d)\^(\d+)/g, '$1<sup>$2</sup>');
}

function sanitizeHtml(html){
  if (!html || typeof html !== 'string') return html;
  // Pre-process plain `N^M` notation into real <sup> tags before tokenizing.
  html = expandSuperscriptNotation(html);
  const tmp = document.createElement('div');
  tmp.innerHTML = html;

  function processNode(node){
    if (node.nodeType === Node.COMMENT_NODE) { node.remove(); return; }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    // Process children first (depth-first) so unwrapping doesn't lose them.
    [...node.childNodes].forEach(processNode);

    const tag = node.tagName.toLowerCase();
    const style = node.getAttribute('style') || '';
    const isBold   = /font-weight:\s*(bold|[6-9]\d{2})/i.test(style);
    const isItalic = /font-style:\s*italic/i.test(style);

    if (!ALLOWED_RICH_TAGS.has(tag)) {
      // <span> (or other) carrying bold/italic styles → convert to semantic.
      let replacement = null;
      if (isBold) {
        replacement = document.createElement('strong');
        if (isItalic) {
          const em = document.createElement('em');
          while (node.firstChild) em.appendChild(node.firstChild);
          replacement.appendChild(em);
        } else {
          while (node.firstChild) replacement.appendChild(node.firstChild);
        }
      } else if (isItalic) {
        replacement = document.createElement('em');
        while (node.firstChild) replacement.appendChild(node.firstChild);
      }
      if (replacement) {
        node.parentNode.replaceChild(replacement, node);
      } else {
        // Unwrap: move children into parent, remove the wrapper.
        while (node.firstChild) node.parentNode.insertBefore(node.firstChild, node);
        node.remove();
      }
      return;
    }

    // Allowed tag: strip every attribute (including class, style, dir, id, ...).
    [...node.attributes].forEach(a => node.removeAttribute(a.name));
  }

  [...tmp.childNodes].forEach(processNode);

  let result = tmp.innerHTML
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/<p>\s*(?:<br\s*\/?>)?\s*<\/p>/gi, '')
    .replace(/\n{3,}/g, '\n\n');
  return result.trim();
}

// Apps que demanen landscape (paso 15 i 16, plano-modular d'App19/App20)
// són impossibles d'usar en pantalles ≤599px d'amplada perquè el plànol
// 2D necessita una amplada mínima per editar patrons rítmics. En aquests
// casos, en lloc de carregar l'iframe, mostrem un prompt amb un ícon
// SVG de gir i un missatge "Gira el dispositivo …". Així estalviem
// recursos (no carreguem l'app + samples + fonts) i comuniquem clarament
// què cal fer per veure-la. El listener avall re-renderitza quan canvia
// el viewport.
const NARROW_VIEWPORT_QUERY = '(max-width: 599px)';

const state = {
  paso: Number(localStorage.getItem(STORAGE_KEY)) || 1,
  variant: 'a',
  density: 'compact',
  showIframe: true,
  editable: false,
  overrides: loadOverrides(),
  narrowViewport: window.matchMedia(NARROW_VIEWPORT_QUERY).matches,
  complexUnlocked: sessionStorage.getItem(COMPLEX_UNLOCK_KEY) === '1',
};

// Llista dinàmica de pasos visibles segons l'estat del easter egg.
// Quan el capítol amagat no està actiu, els pasos *.5 marcats amb
// `hidden:true` queden fora de la navegació, de la barra de progrés
// i del clamping de "següent/anterior".
function getVisibleSlides(){
  return slideMatrix.filter(s => !s.hidden || (s.complex && state.complexUnlocked));
}
function getVisiblePasos(){
  return getVisibleSlides().map(s => s.paso);
}
function pasoExists(paso){ return getVisiblePasos().includes(paso); }
function firstPaso(){ return getVisiblePasos()[0]; }
function lastPaso(){
  const list = getVisiblePasos();
  return list[list.length - 1];
}

// Si el paso desat a localStorage ja no és vàlid (p.ex. un *.5 desat amb
// el flag actiu, ara reobrim la pestanya i el flag s'ha perdut), tornem
// al pas enter més proper o al primer disponible.
if (!pasoExists(state.paso)) {
  const fallback = Math.max(1, Math.min(26, Math.floor(state.paso) || 1));
  state.paso = pasoExists(fallback) ? fallback : firstPaso();
}

// Expose for tweaks.js
window.__sistemaState = state;
window.__sistemaRender = render;
window.__sistemaSaveOverrides = () => saveOverrides(state.overrides);

function getSlide(paso){ return slideMatrix.find(s=>s.paso===paso); }
function getSection(id){ return sections.find(s=>s.id===id); }

// Format del número de pas per mostrar a l'usuari: els pasos enters
// queden com "17"; els *.5 del capítol amagat es mostren com "17·B"
// (B = la segona variant del mateix concepte).
function formatPaso(paso){
  if (Number.isInteger(paso)) return String(paso);
  return `${Math.floor(paso)}·B`;
}

function escapeAttr(s){
  return String(s).replace(/"/g, '&quot;');
}

function getOverride(paso, field){
  return state.overrides[paso]?.[field];
}

function renderTitle(slide, section){
  const title = getOverride(slide.paso, 'title') ?? slide.title;
  // Pill "Cerrar fracciones complejas" només a les 4 slides amagades
  // del capítol Fraccions Complexes quan el flag està actiu. Així
  // l'usuari ha d'estar veient una slide complexa per tancar-les
  // (no apareix als pasos enters ni a la resta del Sistema).
  const closeBtn = (state.complexUnlocked && slide.complex)
    ? '<button class="paso-badge__close" type="button" aria-label="Cerrar fracciones complejas" title="Cerrar fracciones complejas">Cerrar fracciones complejas</button>'
    : '';
  return `
    <div class="slot-title">
      <div class="paso-badge-row">
        <button class="paso-badge" type="button" aria-label="Paso ${formatPaso(slide.paso)} · ${section.title}">Paso ${formatPaso(slide.paso)} · ${section.title}</button>
        ${closeBtn}
      </div>
      <h1 class="slide__title" data-field="title">${title}</h1>
    </div>`;
}

function renderText(content, paso){
  const raw = getOverride(paso, 'text') ?? (content.text || fillerContent.text);
  const text = expandSuperscriptNotation(raw);
  return `
    <div class="slot-text">
      <div class="prose" data-field="text">${text}</div>
    </div>`;
}

function renderTips(content, paso){
  const tipsOverride = getOverride(paso, 'tips');
  const hasTips = tipsOverride != null || (content && content.tips);
  if (!hasTips) return '';
  const label = getOverride(paso, 'tipsTitle') ?? (content.tipsTitle || 'Tips');
  const body = expandSuperscriptNotation(tipsOverride ?? content.tips);
  return `
    <aside class="slot-tips tips" role="note">
      <div class="tips__label" data-field="tipsTitle">${label}</div>
      <div class="tips__body" data-field="tips">${body}</div>
    </aside>`;
}

function renderImage(content){
  const alt = content.image?.alt || 'Imagen ilustrativa';
  const src = content.image?.src;
  if (src) {
    return `<div class="slot-image"><img src="${src}" alt="${escapeAttr(alt)}"></div>`;
  }
  return `<div class="slot-image" aria-label="${escapeAttr(alt)}">Imagen ilustrativa</div>`;
}

function renderPlaceholder(appNames, aspect, variant){
  const label = appNames.length > 1 ? `[${appNames[variant === 'b' ? 1 : 0]}]` : `[${appNames[0]}]`;
  return `
    <div class="iframe-frame" style="--iframe-aspect:${aspect||'4/3'}">
      <div class="iframe-placeholder">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="13" rx="1.5"/><path d="M8 21h8M12 17v4"/></svg>
        <span>App interactiva</span>
        <small>${label}</small>
      </div>
    </div>`;
}

function renderIframe(appName, aspect){
  // sistema/ lives next to Apps/, so one level up from this module.
  const src = `../Apps/${appName}/index.html?embed=true`;
  return `
    <div class="iframe-frame" style="--iframe-aspect:${aspect||'4/3'}">
      <iframe src="${src}" title="${appName}" loading="lazy"></iframe>
    </div>`;
}

/**
 * Prompt mostrat en lloc de l'iframe quan el viewport és estret i el paso
 * està marcat amb `requiresLandscape: true` a slide-data. SVG inline d'un
 * mòbil amb fletxes circulars (pictograma estàndard de "gira el dispositiu").
 * No carreguem l'iframe en aquest mode — així estalviem la càrrega de
 * l'app sencera (samples d'àudio, fonts, JS) en pantalles on no és usable.
 */
function renderRotatePrompt(aspect){
  return `
    <div class="iframe-frame iframe-frame--rotate" style="--iframe-aspect:${aspect||'4/3'}">
      <div class="rotate-prompt" role="status" aria-live="polite">
        <svg class="rotate-prompt__icon" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="22" y="10" width="20" height="34" rx="3"/>
          <line x1="32" y1="40" x2="32" y2="40.01"/>
          <path d="M14 50 Q14 56 20 56 L44 56 Q50 56 50 50"/>
          <polyline points="10,46 14,50 18,46"/>
          <polyline points="46,54 50,50 54,54"/>
        </svg>
        <p class="rotate-prompt__text">Gira el dispositivo<br>para ver esta app</p>
      </div>
    </div>`;
}

function renderVariantToggle(slide){
  if (!slide.apps || slide.apps.length < 2) return '';
  const [la, lb] = slide.variantLabels || slide.apps;
  return `
    <div class="variant-toggle" role="tablist" aria-label="Variante de app">
      <button role="tab" aria-pressed="${state.variant==='a'}" data-variant="a">${la}</button>
      <button role="tab" aria-pressed="${state.variant==='b'}" data-variant="b">${lb}</button>
    </div>`;
}

function renderApp(slide){
  if (!slide.apps || !slide.apps.length) return '';
  const appName = slide.apps[state.variant === 'b' ? 1 : 0];
  // Pasos com el 15/16 (plànol modular) demanen un mínim d'amplada per
  // ser usables. A viewports ≤599px substituïm l'iframe pel prompt de
  // rotació en lloc de carregar l'app inutilitzablement.
  const needsRotate = slide.requiresLandscape && state.narrowViewport;
  let body;
  if (needsRotate) {
    body = renderRotatePrompt(slide.aspect);
  } else if (state.showIframe) {
    body = renderIframe(appName, slide.aspect);
  } else {
    body = renderPlaceholder(slide.apps, slide.aspect, state.variant);
  }
  return `
    <div class="slot-app">
      ${renderVariantToggle(slide)}
      ${body}
    </div>`;
}

function render(){
  const slide = getSlide(state.paso);
  if (!slide) return;
  const section = getSection(slide.section);
  const content = slideContent[slide.paso] || fillerContent;
  const layout = layouts[slide.layout] || layouts['B-app-left'];

  // Nav
  NAV_SECTION.textContent = section.title;
  NAV_STEP.textContent = `Paso ${formatPaso(slide.paso)} — ${slide.title}`;
  BTN_PREV.disabled = state.paso <= firstPaso();
  BTN_NEXT.disabled = state.paso >= lastPaso();

  // Progress bar (current section only). Segments are <button>s so they're
  // keyboard-focusable and announce the target paso to assistive tech;
  // navigation is wired via delegation on PROG (see end of file).
  PROG.innerHTML = '';
  // Els pasos *.5 (capítol amagat) només apareixen a la barra de
  // progrés quan el flag està actiu — fora d'aquest mode, la secció
  // Fraccionando mostra només els 4 pasos enters.
  const visibleInSection = section.slides.filter(p => {
    const s = slideMatrix.find(x => x.paso === p);
    return s && (!s.hidden || (s.complex && state.complexUnlocked));
  });
  visibleInSection.forEach(p => {
    const s = slideMatrix.find(x => x.paso === p);
    const seg = document.createElement('button');
    seg.type = 'button';
    seg.className = 'progress-seg';
    if (s?.complex) seg.classList.add('progress-seg--complex');
    seg.dataset.paso = p;
    seg.setAttribute('aria-label', `Anar al Paso ${formatPaso(p)}`);
    if (p < state.paso) seg.classList.add('is-done');
    if (p === state.paso) {
      seg.classList.add('is-current');
      seg.setAttribute('aria-current', 'step');
    }
    PROG.appendChild(seg);
  });

  // Variant row visibility in tweaks
  const variantRow = document.getElementById('tw-variant-row');
  const hasVariant = slide.apps && slide.apps.length > 1;
  variantRow.hidden = !hasVariant;
  if (!hasVariant) state.variant = 'a';

  // Build slide
  const slideEl = document.createElement('article');
  slideEl.className = 'slide';
  slideEl.dataset.layout = slide.layout;
  slideEl.dataset.density = state.density;
  slideEl.dataset.paso = slide.paso;
  slideEl.style.gridTemplateAreas = layout.areas;
  slideEl.style.gridTemplateRows  = layout.rows;
  if (layout.cols) slideEl.style.gridTemplateColumns = layout.cols;

  // Render only the slots that the layout references. Unused slots are
  // skipped automatically by checking which area names appear in `areas`.
  const areasStr = layout.areas;
  const parts = [];
  if (areasStr.includes('title')) parts.push(renderTitle(slide, section));
  if (areasStr.includes('text'))  parts.push(renderText(content, slide.paso));
  if (areasStr.includes('image')) parts.push(renderImage(content));
  if (areasStr.includes('app'))   parts.push(renderApp(slide));
  if (areasStr.includes('tips'))  parts.push(renderTips(content, slide.paso));

  slideEl.innerHTML = parts.join('\n');
  STAGE.innerHTML = '';
  STAGE.appendChild(slideEl);

  // Variant toggle wiring
  slideEl.querySelectorAll('.variant-toggle button').forEach(btn => {
    btn.addEventListener('click', () => {
      state.variant = btn.dataset.variant;
      render();
    });
  });

  // Edit-mode wiring: toggle contenteditable on fields and persist on blur.
  applyEditableState(slideEl, slide.paso);

  localStorage.setItem(STORAGE_KEY, state.paso);
}

// Apply/clear contenteditable on the editable fields of the current slide and
// hook blur handlers that persist edits into state.overrides + localStorage.
function applyEditableState(slideEl, paso){
  const fields = slideEl.querySelectorAll('[data-field]');
  fields.forEach(el => {
    if (state.editable) {
      el.setAttribute('contenteditable', 'true');
      el.setAttribute('spellcheck', 'true');
      if (!el.__editWired) {
        el.addEventListener('blur', () => persistField(paso, el));
        el.addEventListener('paste', handlePaste);
        el.__editWired = true;
      }
    } else {
      el.removeAttribute('contenteditable');
    }
  });
}

// Paste handler — intercepts the browser's "paste with formatting" behavior
// and inserts a sanitized version instead. For plain-text fields (title,
// tipsTitle) we strip all HTML; for rich fields (text, tips) we keep
// semantic tags only and force the sistema's typography (Ubuntu, sized
// via `.slot-text .prose` rules in slides.css). Without this, pasting from
// Google Docs / Word brought along Arial fonts, point sizes, line-heights,
// etc. that fought the sistema's design.
function handlePaste(e){
  const el = e.currentTarget;
  const field = el.dataset.field;
  const isPlain = field === 'title' || field === 'tipsTitle';
  const clip = e.clipboardData;
  if (!clip) return;
  e.preventDefault();

  if (isPlain) {
    const text = clip.getData('text/plain') || '';
    document.execCommand('insertText', false, text);
    return;
  }

  let html = clip.getData('text/html');
  if (html) {
    html = sanitizeHtml(html);
  } else {
    const text = clip.getData('text/plain') || '';
    html = text.split(/\n{2,}/)
      .map(p => `<p>${escapeHtml(p.trim())}</p>`)
      .filter(p => p !== '<p></p>')
      .join('');
  }
  document.execCommand('insertHTML', false, html);
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, m => (
    { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]
  ));
}

function persistField(paso, el){
  const field = el.dataset.field;
  // Titles are plain text; text/tips preserve HTML so bold/italic survive.
  // Rich fields pass through sanitizeHtml on save (defense in depth, in
  // case content arrived via a non-paste path).
  const isPlain = field === 'title' || field === 'tipsTitle';
  let value = isPlain ? el.textContent.trim() : el.innerHTML.trim();
  if (!isPlain) value = sanitizeHtml(value);
  state.overrides[paso] ??= {};
  state.overrides[paso][field] = value;
  saveOverrides(state.overrides);
}

function goTo(paso){
  if (paso === state.paso) return;
  if (!pasoExists(paso)) return;
  state.paso = paso;
  state.variant = 'a';
  render();
}
function go(delta){
  // Avancem per la llista de pasos visibles, ignorant els amagats si
  // el flag no està actiu. Així els pasos *.5 apareixen a la
  // seqüència de fletxes automàticament en activar el capítol.
  const list = getVisiblePasos();
  const idx = list.indexOf(state.paso);
  if (idx === -1) return;
  const next = list[idx + delta];
  if (next != null) goTo(next);
}

// Easter egg: 5 clicks consecutius sobre el `.paso-badge` d'un pas
// del capítol Fraccionando alterna l'estat del capítol amagat. El
// comptador es reseteja si passa més de COMPLEX_CLICK_WINDOW_MS entre
// clicks, així no es dispara per accident en sessions normals. Cal
// estar dins de la secció 'fraccionando' perquè el toggle aplica
// específicament a aquest capítol.
let complexClickCount = 0;
let complexClickTimer = null;
function handleBadgeClick(){
  const slide = getSlide(state.paso);
  if (!slide || slide.section !== 'fraccionando') {
    complexClickCount = 0;
    return;
  }
  complexClickCount += 1;
  if (complexClickTimer) clearTimeout(complexClickTimer);
  complexClickTimer = setTimeout(() => { complexClickCount = 0; }, COMPLEX_CLICK_WINDOW_MS);
  if (complexClickCount >= COMPLEX_CLICK_THRESHOLD) {
    complexClickCount = 0;
    toggleComplexChapter();
  }
}

function toggleComplexChapter(){
  state.complexUnlocked = !state.complexUnlocked;
  if (state.complexUnlocked) {
    sessionStorage.setItem(COMPLEX_UNLOCK_KEY, '1');
    // En activar, saltem automàticament a la slide *.5 corresponent
    // a la slide simple on l'usuari era (p.ex. clicar 5 cops al pas
    // 18 obre el pas 18.5). Si l'usuari ja és en un *.5 (re-activant
    // després d'haver tancat), no fem res.
    if (Number.isInteger(state.paso)) {
      const variantB = state.paso + 0.5;
      if (pasoExists(variantB)) {
        state.paso = variantB;
        state.variant = 'a';
      }
    }
  } else {
    sessionStorage.removeItem(COMPLEX_UNLOCK_KEY);
    // Si l'usuari era en un pas *.5 que acabem d'amagar, retrocedeix
    // a la versió simple corresponent (Math.floor) abans de renderitzar.
    if (!pasoExists(state.paso)) {
      const fallback = Math.floor(state.paso);
      state.paso = pasoExists(fallback) ? fallback : firstPaso();
    }
  }
  populatePasoSelect();
  render();
}

// Delegació al stage: el badge i el botó "Cerrar capítulo" es re-creen
// a cada render(), així que escoltem un nivell més amunt en comptes
// d'enganxar listeners cada cop.
STAGE.addEventListener('click', (e) => {
  if (e.target.closest('.paso-badge__close')) {
    if (state.complexUnlocked) toggleComplexChapter();
    return;
  }
  if (e.target.closest('.paso-badge')) {
    handleBadgeClick();
  }
});

BTN_PREV.addEventListener('click', () => go(-1));
BTN_NEXT.addEventListener('click', () => go(+1));
PROG.addEventListener('click', e => {
  const seg = e.target.closest('.progress-seg');
  if (!seg) return;
  const paso = Number(seg.dataset.paso);
  if (Number.isFinite(paso)) goTo(paso);
});
document.addEventListener('keydown', e => {
  // No capturar fletxes mentre s'està editant un camp o element contenteditable.
  if (e.target.closest('input,select,textarea,[contenteditable="true"],[contenteditable=""]')) return;
  if (e.key === 'ArrowLeft')  go(-1);
  if (e.key === 'ArrowRight') go(+1);
});

// Populate tweaks "Go to paso" select — només pasos visibles (els
// amagats del capítol Fracciones Complejas no apareixen aquí fins que
// l'usuari els desbloqueja).
const sel = document.getElementById('tw-paso');
function populatePasoSelect(){
  sel.innerHTML = '';
  getVisibleSlides().forEach(s => {
    const o = document.createElement('option');
    o.value = s.paso;
    o.textContent = `${formatPaso(s.paso)}. ${s.title}`;
    sel.appendChild(o);
  });
  sel.value = state.paso;
}
populatePasoSelect();

// Re-render quan el viewport creui el llindar del prompt de rotació, així
// la persona que gira el dispositiu (o redimensiona la finestra) veu
// l'iframe carregar-se sense haver de tornar a entrar al paso. Fem servir
// l'API moderna `addEventListener` (caure a `addListener` només si el
// browser és antic — Safari ≤14).
const narrowMQ = window.matchMedia(NARROW_VIEWPORT_QUERY);
const onNarrowChange = (e) => {
  if (state.narrowViewport === e.matches) return;
  state.narrowViewport = e.matches;
  render();
};
if (narrowMQ.addEventListener) narrowMQ.addEventListener('change', onNarrowChange);
else narrowMQ.addListener(onNarrowChange);

render();
