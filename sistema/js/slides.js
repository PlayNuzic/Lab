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
    const stored = JSON.parse(localStorage.getItem(OVERRIDES_KEY)) || {};
    let dirty = false;
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
  'p','h2','h3','h4','strong','b','em','i','code','br','ul','ol','li','blockquote'
]);

function sanitizeHtml(html){
  if (!html || typeof html !== 'string') return html;
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

const state = {
  paso: Math.min(Number(localStorage.getItem(STORAGE_KEY)) || 1, 26),  // clamp to valid range; default to Paso 1
  variant: 'a',
  density: 'compact',
  showIframe: true,
  editable: false,
  overrides: loadOverrides(),
};

// Expose for tweaks.js
window.__sistemaState = state;
window.__sistemaRender = render;
window.__sistemaSaveOverrides = () => saveOverrides(state.overrides);

function getSlide(paso){ return slideMatrix.find(s=>s.paso===paso); }
function getSection(id){ return sections.find(s=>s.id===id); }

function escapeAttr(s){
  return String(s).replace(/"/g, '&quot;');
}

function getOverride(paso, field){
  return state.overrides[paso]?.[field];
}

function renderTitle(slide, section){
  const title = getOverride(slide.paso, 'title') ?? slide.title;
  return `
    <div class="slot-title">
      <div class="paso-badge">Paso ${slide.paso} · ${section.title}</div>
      <h1 class="slide__title" data-field="title">${title}</h1>
    </div>`;
}

function renderText(content, paso){
  const text = getOverride(paso, 'text') ?? (content.text || fillerContent.text);
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
  const body = tipsOverride ?? content.tips;
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
  const body = state.showIframe
    ? renderIframe(appName, slide.aspect)
    : renderPlaceholder(slide.apps, slide.aspect, state.variant);
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
  NAV_STEP.textContent = `Paso ${slide.paso} — ${slide.title}`;
  BTN_PREV.disabled = state.paso <= 1;
  BTN_NEXT.disabled = state.paso >= 26;

  // Progress bar (current section only). Segments are <button>s so they're
  // keyboard-focusable and announce the target paso to assistive tech;
  // navigation is wired via delegation on PROG (see end of file).
  PROG.innerHTML = '';
  section.slides.forEach(p => {
    const seg = document.createElement('button');
    seg.type = 'button';
    seg.className = 'progress-seg';
    seg.dataset.paso = p;
    seg.setAttribute('aria-label', `Anar al Paso ${p}`);
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
  if (paso < 1 || paso > 26 || paso === state.paso) return;
  state.paso = paso;
  state.variant = 'a';
  render();
}
function go(delta){ goTo(state.paso + delta); }

BTN_PREV.addEventListener('click', () => go(-1));
BTN_NEXT.addEventListener('click', () => go(+1));
PROG.addEventListener('click', e => {
  const seg = e.target.closest('.progress-seg');
  if (!seg) return;
  const paso = Number(seg.dataset.paso);
  if (Number.isFinite(paso)) goTo(paso);
});
document.addEventListener('keydown', e => {
  if (e.target.closest('input,select,textarea')) return;
  if (e.key === 'ArrowLeft')  go(-1);
  if (e.key === 'ArrowRight') go(+1);
});

// Populate tweaks "Go to paso" select
const sel = document.getElementById('tw-paso');
slideMatrix.forEach(s => {
  const o = document.createElement('option');
  o.value = s.paso;
  o.textContent = `${s.paso}. ${s.title}`;
  sel.appendChild(o);
});
sel.value = state.paso;

render();
