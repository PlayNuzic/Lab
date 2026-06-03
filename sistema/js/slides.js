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
const NAV_TITLE_BTN     = document.getElementById('nav-title');
const NAV_SECTIONS_MENU = document.getElementById('nav-sections-menu');
const BTN_PREV = document.getElementById('btn-prev');
const BTN_NEXT = document.getElementById('btn-next');

const STORAGE_KEY = 'sistema.paso';
const DENSITY_KEY = 'sistema.densityByPaso';  // { [paso]: 'compact'|'cozy'|'loose' }
const DEFAULT_DENSITY = 'cozy';  // 'Normal' — cas base sense regla CSS especial
const OVERRIDES_KEY = 'sistema.overrides';
const OVERRIDES_VERSION_KEY = 'sistema.overrides.version';
const OVERRIDES_VERSION = 3;  // v3: paso 7 deleted, 8..26 shifted to 7..25 (also 17.5..20.5 → 16.5..19.5)

// Easter egg: capítol amagat "complex" → pasos 17.5/18.5/19.5/20.5
// (Fraccions Complexes). Es desbloqueja amb 5 clicks al badge d'un pas
// del capítol "Fraccionando". Pas amagat marcat amb `complex: true`.
// Flag de sessionStorage: tancar pestanya = es torna a amagar.
const COMPLEX_UNLOCK_KEY = 'sistema.complexUnlocked';
const HIDDEN_CLICK_THRESHOLD = 5;
const HIDDEN_CLICK_WINDOW_MS = 1500;

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

// v3: paso 7 (A-intro "Midiendo el movimiento") va ser eliminat. Pasos
// 8-26 baixen una posició → 7-25. Pasos ocults 17.5/18.5/19.5/20.5 →
// 16.5/17.5/18.5/19.5. Mateixa transformació també aplicada a
// `densityByPaso` (sessionStorage-independent: viu a localStorage propi).
function migrateOverridesV3(stored) {
  const out = {};
  for (const [k, v] of Object.entries(stored)) {
    const n = Number(k);
    if (n === 7) continue;  // El pas 7 va desaparèixer; res a mapejar.
    let target = n;
    if (Number.isInteger(n) && n >= 8) target = n - 1;
    else if (n === 17.5) target = 16.5;
    else if (n === 18.5) target = 17.5;
    else if (n === 19.5) target = 18.5;
    else if (n === 20.5) target = 19.5;
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
// Aplica les migracions de renumeració acumulades a un store paso-keyed
// (overrides o densityByPaso, indistintament — totes dues són
// { [paso]: ... }).
function applyPasoMigrations(stored, ver) {
  let out = stored;
  if (ver < 2) out = migrateOverridesV2(out);
  if (ver < 3) out = migrateOverridesV3(out);
  return out;
}

function loadOverrides(){
  try {
    let stored = JSON.parse(localStorage.getItem(OVERRIDES_KEY)) || {};
    let dirty = false;

    // One-time renumbering migrations (vegeu migrateOverridesVN amunt).
    const ver = Number(localStorage.getItem(OVERRIDES_VERSION_KEY)) || 1;
    if (ver < OVERRIDES_VERSION) {
      stored = applyPasoMigrations(stored, ver);
      // El bump de la versió el fa loadOverrides per últim (després de
      // loadDensityByPaso, que també llegeix el ver per saber si migrar).
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
  'p','h2','h3','h4','strong','b','em','i','code','br','ul','ol','li','blockquote','sup','sub','mark'
]);

// Classes de ressaltat permeses sobre `<mark>` (marca de fons rosa/groc
// afegida des del mode edició del panell tweaks). La resta d'atributs/
// classes s'eliminen com sempre.
const ALLOWED_MARK_CLASSES = new Set(['hl-pink', 'hl-yellow', 'hl-box']);

// Marcadors de text que l'editor de tweaks no pot generar fàcilment des
// del contenteditable (no hi ha botó dedicat). Es processen tant en
// guardar (via sanitizeHtml) com en mostrar (via expandSlideMarkers
// abans d'innerHTML), perquè els autors poden escriure'ls a la mà.
//
//   N^M           → N<sup>M</sup>   (superíndex per a P(3^1), 2^16, etc.)
//   /h3/X/h3/     → <h3>X</h3>      (heading que el contenteditable
//                                    converteix en text gros en bold)
//   /textnormal/X/textnormal/ → X    (escape per a text enganxat amb
//                                    estils inline que es transformen en
//                                    bold/gros — strippejant els marcadors
//                                    s'aprofita la sanitització que elimina
//                                    els <span style="...">)
function expandSlideMarkers(html){
  if (!html || typeof html !== 'string') return html;
  // Superíndex: dígit ^ dígits → <sup>
  html = html.replace(/(\d)\^(\d+)/g, '$1<sup>$2</sup>');
  // /h3/.../h3/ → <h3>...</h3> (DOTALL — pot incloure salts de línia
  // si el contingut és multi-paràgraf, però normalment una sola línia).
  html = html.replace(/\/h3\/([\s\S]*?)\/h3\//g, '<h3>$1</h3>');
  // /textnormal/ marcador: només se strippeja (deixa el contingut a la
  // mercè dels tags pare/CSS, que s'esperen normals després de
  // sanititzar inline styles).
  html = html.replace(/\/textnormal\//g, '');
  return html;
}

function sanitizeHtml(html){
  if (!html || typeof html !== 'string') return html;
  // Pre-process slide markers (superscript, /h3/, /textnormal/) before tokenizing.
  html = expandSlideMarkers(html);
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
    // Excepció: un `<mark>` pot conservar una classe de ressaltat permesa
    // (hl-pink / hl-yellow). Si el `<mark>` no en té cap de vàlida,
    // el desempaquetem (no té sentit un mark sense color).
    if (tag === 'mark') {
      const cls = (node.getAttribute('class') || '').trim();
      const keep = cls.split(/\s+/).find(c => ALLOWED_MARK_CLASSES.has(c));
      [...node.attributes].forEach(a => node.removeAttribute(a.name));
      if (keep) {
        node.setAttribute('class', keep);
      } else {
        while (node.firstChild) node.parentNode.insertBefore(node.firstChild, node);
        node.remove();
      }
      return;
    }
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

function loadDensityByPaso(){
  try {
    let stored = JSON.parse(localStorage.getItem(DENSITY_KEY)) || {};
    const ver = Number(localStorage.getItem(OVERRIDES_VERSION_KEY)) || 1;
    if (ver < OVERRIDES_VERSION) {
      stored = applyPasoMigrations(stored, ver);
      // El bump del version key el fa loadOverrides, que s'executa
      // després; aquí només persistim el nou objecte migrat.
      try { localStorage.setItem(DENSITY_KEY, JSON.stringify(stored)); } catch {}
    }
    return stored;
  } catch { return {}; }
}

const state = {
  paso: Number(localStorage.getItem(STORAGE_KEY)) || 1,
  variant: 'a',
  // Densitat per pas: cada slide recorda la seva. Persistit a localStorage.
  densityByPaso: loadDensityByPaso(),
  showIframe: true,
  editable: false,
  overrides: loadOverrides(),
  narrowViewport: window.matchMedia(NARROW_VIEWPORT_QUERY).matches,
  complexUnlocked: sessionStorage.getItem(COMPLEX_UNLOCK_KEY) === '1',
};

// Densitat del pas actual (o un de concret). Prioritat:
//   1. Override local del tweaks (localStorage `densityByPaso`) — només
//      per previsualitzar mentre s'edita; no es desplega.
//   2. Densitat editorial declarada al `slideMatrix` (camp `density`),
//      que és la font de veritat de producció.
//   3. DEFAULT_DENSITY ('compact').
// Helpers exposats a tweaks.js.
function getPasoDensity(paso = state.paso){
  if (state.densityByPaso[paso]) return state.densityByPaso[paso];
  const slide = slideMatrix.find(s => s.paso === paso);
  return slide?.density || DEFAULT_DENSITY;
}
function setPasoDensity(value){
  state.densityByPaso[state.paso] = value;
  try { localStorage.setItem(DENSITY_KEY, JSON.stringify(state.densityByPaso)); } catch {}
  render();
}
window.__sistemaGetDensity = () => getPasoDensity();
window.__sistemaSetDensity = setPasoDensity;

// Llista dinàmica de pasos visibles segons l'estat del easter egg.
// Quan el capítol amagat no està actiu, els pasos *.5 marcats amb
// `hidden:true` queden fora de la navegació, de la barra de progrés
// i del clamping de "següent/anterior".
function getVisibleSlides(){
  return slideMatrix.filter(s =>
    !s.hidden
    || (s.complex && state.complexUnlocked)
  );
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
  // Pill "Cerrar X" només a les slides amagades quan el seu flag està
  // actiu. Així l'usuari ha d'estar veient la slide amagada per tancar
  // el seu capítol (no apareix als pasos enters ni a la resta del
  // Sistema).
  let closeBtn = '';
  if (state.complexUnlocked && slide.complex) {
    closeBtn = '<button class="paso-badge__close" type="button" data-close-chapter="complex" aria-label="Cerrar fracciones complejas" title="Cerrar fracciones complejas">Cerrar fracciones complejas</button>';
  }
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
  const text = expandSlideMarkers(raw);
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
  const body = expandSlideMarkers(tipsOverride ?? content.tips);
  return `
    <aside class="slot-tips tips" role="note">
      <div class="tips__label" data-field="tipsTitle">${label}</div>
      <div class="tips__body" data-field="tips">${body}</div>
    </aside>`;
}

function renderImage(content){
  // Si la slide té un `video` declarat (p.ex. pas 1·B amagat), el
  // renderitzem amb autoplay+muted (els navegadors només permeten
  // autoplay quan està en silenci) + `controls` perquè l'usuari pugui
  // activar el so amb un clic. `playsinline` evita full-screen forçat
  // a iOS.
  if (content.video?.src) {
    const vSrc = content.video.src;
    const vAlt = content.video.alt || 'Vídeo ilustrativo';
    return `<div class="slot-image"><video src="${vSrc}" autoplay muted loop playsinline controls preload="metadata" aria-label="${escapeAttr(vAlt)}"></video></div>`;
  }
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
  // Els pasos *.5 (capítols amagats) només apareixen a la barra de
  // progrés quan el seu flag està actiu — fora d'aquest mode, la
  // secció no mostra els pasos amagats.
  const visibleInSection = section.slides.filter(p => {
    const s = slideMatrix.find(x => x.paso === p);
    return s && (
      !s.hidden
      || (s.complex && state.complexUnlocked)
    );
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

  // Cap slide actual té dues apps; mantenim `variant` a 'a' per
  // compatibilitat amb la lògica de `renderApp`/`renderVariantToggle`.
  if (!(slide.apps && slide.apps.length > 1)) state.variant = 'a';

  // Build slide
  const slideEl = document.createElement('article');
  slideEl.className = 'slide';
  slideEl.dataset.layout = slide.layout;
  slideEl.dataset.density = getPasoDensity(state.paso);
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

// Aplica (o treu) un ressaltat de fons a la selecció de text actual dins
// d'un camp editable. `colorClass` és 'hl-pink' o 'hl-yellow'. Si la
// selecció ja està íntegrament dins d'un `<mark>` del mateix color,
// fa toggle off (treu el mark). Cridat des del panell tweaks via
// `window.__sistemaApplyHighlight`.
function applyHighlight(colorClass) {
  if (!ALLOWED_MARK_CLASSES.has(colorClass)) return;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;

  const range = sel.getRangeAt(0);
  // La selecció ha d'estar dins d'un camp de text editable rich (text/tips).
  const startEl = range.startContainer.nodeType === Node.ELEMENT_NODE
    ? range.startContainer
    : range.startContainer.parentElement;
  const field = startEl?.closest('[data-field]');
  if (!field || field.getAttribute('contenteditable') !== 'true') return;
  const fieldName = field.dataset.field;
  if (fieldName !== 'text' && fieldName !== 'tips') return;  // només rich fields

  // Toggle off: si la selecció està continguda dins d'un mark del mateix
  // color, el desempaquetem.
  const existingMark = startEl.closest(`mark.${colorClass}`);
  if (existingMark && existingMark.contains(range.endContainer)) {
    const parent = existingMark.parentNode;
    while (existingMark.firstChild) parent.insertBefore(existingMark.firstChild, existingMark);
    existingMark.remove();
    parent.normalize();
  } else {
    const mark = document.createElement('mark');
    mark.className = colorClass;
    try {
      range.surroundContents(mark);
    } catch {
      // La selecció creua límits d'elements: extreure i reinserir.
      const contents = range.extractContents();
      mark.appendChild(contents);
      range.insertNode(mark);
    }
  }

  sel.removeAllRanges();
  persistField(state.paso, field);
}
window.__sistemaApplyHighlight = applyHighlight;

// Treu qualsevol ressaltat (rosa o groc) que intersequi amb la selecció
// actual. Cridat des del botó "Sin marca" del panell tweaks.
function clearHighlight() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  const startEl = range.startContainer.nodeType === Node.ELEMENT_NODE
    ? range.startContainer
    : range.startContainer.parentElement;
  const field = startEl?.closest('[data-field]');
  if (!field || field.getAttribute('contenteditable') !== 'true') return;
  const fieldName = field.dataset.field;
  if (fieldName !== 'text' && fieldName !== 'tips') return;

  // Desempaqueta tots els marks del camp que toquen la selecció. (Treu la
  // marca sencera encara que la selecció en cobreixi només una part —
  // comportament simple i previsible per a l'editor.)
  const marks = [...field.querySelectorAll('mark.hl-pink, mark.hl-yellow, mark.hl-box')];
  let changed = false;
  marks.forEach(m => {
    if (!range.intersectsNode(m)) return;
    const parent = m.parentNode;
    while (m.firstChild) parent.insertBefore(m.firstChild, m);
    m.remove();
    parent.normalize();
    changed = true;
  });

  sel.removeAllRanges();
  if (changed) persistField(state.paso, field);
}
window.__sistemaClearHighlight = clearHighlight;

// Tags que considerem "format" i que el botó "Sin formato" desempaqueta
// (deixa el contingut, treu el wrapper). La estructura (`p`, `br`, llistes,
// `blockquote`) i els ressaltats (`mark`) es conserven.
const FORMATTING_TAGS = new Set(['strong','b','em','i','u','s','sup','sub','code','h2','h3','h4','span','font']);

// Treu format de la selecció: desempaqueta `<strong>/<b>/<em>/<i>/<h2-4>/
// <code>/<sup>/<sub>/<span>/<font>` i strippeja estils inline. Preserva
// `<mark hl-*>` i l'estructura (`<p>`, `<br>`, llistes, `<blockquote>`).
// Cridat des del botó "Sin formato" del panell tweaks.
function clearFormatting() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  const startEl = range.startContainer.nodeType === Node.ELEMENT_NODE
    ? range.startContainer
    : range.startContainer.parentElement;
  const field = startEl?.closest('[data-field]');
  if (!field || field.getAttribute('contenteditable') !== 'true') return;
  const fieldName = field.dataset.field;
  if (fieldName !== 'text' && fieldName !== 'tips') return;

  const tmp = document.createElement('div');
  tmp.appendChild(range.extractContents());

  // Walk depth-first: unwrap formatting tags, strip inline attrs de la resta
  // (excepte `<mark>` que conserva la classe hl-*).
  function process(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    [...node.childNodes].forEach(process);
    const tag = node.tagName.toLowerCase();
    if (FORMATTING_TAGS.has(tag)) {
      const parent = node.parentNode;
      while (node.firstChild) parent.insertBefore(node.firstChild, node);
      node.remove();
      return;
    }
    if (tag === 'mark') {
      const cls = (node.getAttribute('class') || '').split(/\s+/)
        .find(c => ALLOWED_MARK_CLASSES.has(c));
      [...node.attributes].forEach(a => node.removeAttribute(a.name));
      if (cls) node.setAttribute('class', cls);
      return;
    }
    [...node.attributes].forEach(a => node.removeAttribute(a.name));
  }
  [...tmp.childNodes].forEach(process);

  const frag = document.createDocumentFragment();
  while (tmp.firstChild) frag.appendChild(tmp.firstChild);
  range.insertNode(frag);

  sel.removeAllRanges();
  persistField(state.paso, field);
}
window.__sistemaClearFormatting = clearFormatting;

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

// Easter egg: 5 clicks consecutius sobre el `.paso-badge` d'un pas de la
// secció "fraccionando" desbloquegen el capítol amagat "complex" (pasos
// 17.5/18.5/19.5/20.5). El comptador es reseteja si passa més de
// HIDDEN_CLICK_WINDOW_MS entre clicks.
let hiddenClickCount = 0;
let hiddenClickTimer = null;
function resetHiddenClicks() {
  hiddenClickCount = 0;
}
function handleBadgeClick(){
  const slide = getSlide(state.paso);
  if (slide && slide.section === 'fraccionando') {
    hiddenClickCount += 1;
    if (hiddenClickTimer) clearTimeout(hiddenClickTimer);
    hiddenClickTimer = setTimeout(resetHiddenClicks, HIDDEN_CLICK_WINDOW_MS);
    if (hiddenClickCount >= HIDDEN_CLICK_THRESHOLD) {
      // 5è click dins finestra: dispara el toggle del capítol amagat
      // i tanca el menú (no el deixem obert després del salt).
      resetHiddenClicks();
      closeSectionsMenu();
      toggleHiddenChapter();
      return;
    }
  } else {
    resetHiddenClicks();
  }
  // En qualsevol secció, el click al badge serveix també com a drecera
  // per obrir/tancar el desplegable de capítols de la nav inferior.
  toggleSectionsMenu();
}

function toggleHiddenChapter(){
  state.complexUnlocked = !state.complexUnlocked;
  if (state.complexUnlocked) {
    sessionStorage.setItem(COMPLEX_UNLOCK_KEY, '1');
    // En activar, saltem automàticament a la slide *.5 corresponent a
    // la slide entera on l'usuari era (p.ex. clicar 5 cops al pas 18
    // obre el pas 18.5).
    if (Number.isInteger(state.paso)) {
      const variantB = state.paso + 0.5;
      const variantSlide = slideMatrix.find(s => s.paso === variantB);
      if (variantSlide && variantSlide.complex) {
        state.paso = variantB;
        state.variant = 'a';
      }
    }
  } else {
    sessionStorage.removeItem(COMPLEX_UNLOCK_KEY);
    // Si l'usuari era en una slide *.5 que acabem d'amagar, retrocedeix
    // a la versió entera corresponent (Math.floor).
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
  const closeBtn = e.target.closest('.paso-badge__close');
  if (closeBtn) {
    if (closeBtn.dataset.closeChapter === 'complex' && state.complexUnlocked) toggleHiddenChapter();
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

// El Sistema (parent) comunica el seu mode (horitzontal/vertical) als
// iframes que té carregats. Els apps embedats que necessitin saber-ho
// (App23, App24) escolten via `embed-mode.js` i posen
// `data-system-vertical` al <html>. Així poden apilar les columnes
// exactament al mateix moment que el Sistema, sense dependre de
// l'amplada de l'iframe (que se solapa entre els dos modes).
const SYSTEM_VERTICAL_MQ = '(max-width: 900px)';
const systemVerticalMQ = window.matchMedia(SYSTEM_VERTICAL_MQ);

// Pasos exclosos del comportament "iframe creix a l'alçada del contingut"
// en mode vertical. Inclou:
//  - Apps de plànol/grid extens (App11A=2, App11=5, App12=6, App15=10,
//    App19=15, App20=16, App34=20, App35=20.5, App25=25, App25B=26)
//    que tenen scroll intern propi i ocuparien tot el viewport del
//    browser si es deixessin créixer.
//  - Apps amb soundline vertical o estructura vertical compacta on
//    el contingut usa `clamp(..., 80vh, ...)`: quan alliberem el body
//    a `height: auto`, els `vh` col·lapsen i el contingut queda xafat.
//    (App10=4, App14=9, App18=14, App21=21, App22=22.)
// Per a TOTS aquests pasos no enviem `vertical: true` als iframes, així
// `embed.css` no allibera html/body/main i tot manté la seva geometria
// fixa amb scroll intern propi.
const NO_EXPAND_PASOS = new Set([2, 4, 5, 6, 9, 10, 14, 15, 16, 20, 20.5, 21, 22, 25, 26]);
function pasoExpandsOnVertical(paso) {
  return !NO_EXPAND_PASOS.has(paso);
}

function broadcastSystemMode() {
  const sysVertical = systemVerticalMQ.matches;
  STAGE.querySelectorAll('iframe').forEach((f) => {
    const slide = f.closest('.slide');
    const paso = slide ? Number(slide.dataset.paso) : NaN;
    // Per a apps que no s'expandeixen, **mai** anunciem mode vertical
    // — així el seu body no s'allibera i mantenen la geometria fixa
    // que ja tenen dissenyada. Encara reben `vertical: false` per si
    // ja l'estaven a `true` (canvi de paso amb mateix viewport).
    const effectiveVertical = sysVertical && pasoExpandsOnVertical(paso);
    try {
      f.contentWindow?.postMessage({ type: 'sistema:system-mode', vertical: effectiveVertical }, '*');
    } catch {
      // Cross-origin or not loaded yet — l'iframe demanarà l'estat
      // un cop carregat via l'event 'load' (vegeu sota).
    }
  });
  // En tornar a horitzontal, treiem les `style.height` inline que vam
  // posar quan estàvem vertical, perquè el CSS amb aspect-ratio +
  // max-height torni a manar.
  if (!sysVertical) {
    STAGE.querySelectorAll('.iframe-frame').forEach((frame) => {
      frame.style.removeProperty('height');
    });
  }
}
if (systemVerticalMQ.addEventListener) systemVerticalMQ.addEventListener('change', broadcastSystemMode);
else systemVerticalMQ.addListener(broadcastSystemMode);

// També envia l'estat inicial cada cop que un iframe es carrega
// (delegat al stage perquè els iframes es recreen amb cada render()).
STAGE.addEventListener('load', (e) => {
  if (e.target.tagName === 'IFRAME') {
    const slide = e.target.closest('.slide');
    const paso = slide ? Number(slide.dataset.paso) : NaN;
    const effectiveVertical = systemVerticalMQ.matches && pasoExpandsOnVertical(paso);
    try {
      e.target.contentWindow?.postMessage(
        { type: 'sistema:system-mode', vertical: effectiveVertical },
        '*'
      );
    } catch {}
  }
}, true);

// Resposta de `embed-mode.js`: l'app ens envia la seva alçada natural
// quan està en mode sistema-vertical. Ajustem el `.iframe-frame` perquè
// abraci tot el contingut sense scroll intern, deixant que el scroll
// del Sistema sigui l'únic.
window.addEventListener('message', (e) => {
  if (e?.data?.type !== 'app:resize') return;
  if (!systemVerticalMQ.matches) return;
  // Trobar quin iframe va enviar el missatge i si està en un paso que
  // permet l'expansió vertical.
  const iframes = STAGE.querySelectorAll('iframe');
  for (const f of iframes) {
    if (f.contentWindow !== e.source) continue;
    const slide = f.closest('.slide');
    const paso = slide ? Number(slide.dataset.paso) : NaN;
    if (!pasoExpandsOnVertical(paso)) return;
    const frame = f.closest('.iframe-frame');
    if (frame && Number.isFinite(e.data.height)) {
      frame.style.height = `${e.data.height}px`;
    }
    return;
  }
});

// Menú desplegable al títol de la nav: en clicar, mostra la llista de
// capítols (sections). Cada item porta al primer pas visible del seu
// capítol. El menú es genera dinàmicament a cada obertura perquè es
// reflecteixi sempre l'estat actual (capítols amagats desbloquejats,
// pas actiu, etc.).
function populateSectionsMenu() {
  NAV_SECTIONS_MENU.innerHTML = '';
  const currentSectionId = getSlide(state.paso)?.section;
  sections.forEach(sec => {
    // Header del capítol (clicable: porta al primer pas visible).
    const header = document.createElement('li');
    header.className = 'sistema-nav__sections-menu__chapter';
    header.dataset.section = sec.id;
    header.textContent = sec.title;
    if (sec.id === currentSectionId) header.classList.add('is-current-chapter');
    NAV_SECTIONS_MENU.appendChild(header);

    // Pasos del capítol (només els visibles segons l'estat).
    sec.slides.forEach(p => {
      const slide = slideMatrix.find(s => s.paso === p);
      if (!slide) return;
      // Saltem els amagats que el seu flag no està actiu.
      if (slide.hidden) {
        if (slide.complex && !state.complexUnlocked) return;
      }
      const item = document.createElement('li');
      item.className = 'sistema-nav__sections-menu__step';
      if (slide.complex) item.classList.add('is-hidden-chapter');
      item.setAttribute('role', 'option');
      item.dataset.paso = String(p);
      item.textContent = `${formatPaso(p)} · ${slide.title}`;
      if (p === state.paso) {
        item.classList.add('is-current');
        item.setAttribute('aria-selected', 'true');
      }
      NAV_SECTIONS_MENU.appendChild(item);
    });
  });
}

function openSectionsMenu() {
  populateSectionsMenu();
  NAV_SECTIONS_MENU.hidden = false;
  NAV_TITLE_BTN.setAttribute('aria-expanded', 'true');
}
function closeSectionsMenu() {
  NAV_SECTIONS_MENU.hidden = true;
  NAV_TITLE_BTN.setAttribute('aria-expanded', 'false');
}
function toggleSectionsMenu() {
  if (NAV_SECTIONS_MENU.hidden) openSectionsMenu();
  else closeSectionsMenu();
}

NAV_TITLE_BTN.addEventListener('click', toggleSectionsMenu);

NAV_SECTIONS_MENU.addEventListener('click', (e) => {
  // Click a un pas concret: hi anem.
  const step = e.target.closest('.sistema-nav__sections-menu__step');
  if (step) {
    const paso = Number(step.dataset.paso);
    if (Number.isFinite(paso)) goTo(paso);
    closeSectionsMenu();
    return;
  }
  // Click al header d'un capítol: anem al primer pas visible del
  // capítol.
  const chapter = e.target.closest('.sistema-nav__sections-menu__chapter');
  if (chapter) {
    const sec = sections.find(s => s.id === chapter.dataset.section);
    if (sec) {
      const firstVisible = sec.slides.find(p => pasoExists(p));
      if (firstVisible != null) goTo(firstVisible);
    }
    closeSectionsMenu();
  }
});

// Tancar amb clic fora. Usem `pointerdown` (no `click`) perquè un
// `click` només dispara si pointerdown i pointerup són al mateix
// element; un moviment mínim del cursor entre els dos n'esborra
// l'event i el menú no es tancaria. Mateix patró que `initRandomMenu`
// a `libs/random/menu.js`.
document.addEventListener('pointerdown', (e) => {
  if (NAV_SECTIONS_MENU.hidden) return;
  if (
    e.target.closest('#nav-title')
    || e.target.closest('#nav-sections-menu')
    // `.paso-badge` també obre el menú (drecera des del títol del slide):
    // sense aquesta exclusió, el pointerdown tancaria el menu just abans
    // que el click el torni a obrir, donant impressió de no resposta.
    || e.target.closest('.paso-badge')
  ) return;
  closeSectionsMenu();
});

// Tancar amb ESC. (No interfereix amb el contenteditable perquè el
// listener de fletxes ja filtra inputs; ESC no està capturat allà.)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !NAV_SECTIONS_MENU.hidden) {
    closeSectionsMenu();
    NAV_TITLE_BTN.focus();
  }
});

render();
