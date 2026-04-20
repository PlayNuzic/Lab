// Slides renderer + navigation

import { sections, slideMatrix, slideContent, fillerContent } from './slide-data.js';

const STAGE = document.getElementById('slide-stage');
const PROG  = document.getElementById('progress-track');
const NAV_SECTION = document.getElementById('nav-section');
const NAV_STEP    = document.getElementById('nav-step');
const BTN_PREV = document.getElementById('btn-prev');
const BTN_NEXT = document.getElementById('btn-next');

const STORAGE_KEY = 'sistema.paso';
const TWEAKS_KEY  = 'sistema.tweaks';

const state = {
  paso: Number(localStorage.getItem(STORAGE_KEY)) || 4,  // default to Paso 4 (priority)
  variant: 'a',
  density: 'cozy',
  showIframe: false,
};

// Expose for tweaks.js
window.__sistemaState = state;
window.__sistemaRender = render;

function getSlide(paso){ return slideMatrix.find(s=>s.paso===paso); }
function getSection(id){ return sections.find(s=>s.id===id); }

function renderTips(c){
  if (!c || !c.tips) return '';
  return `
    <aside class="tips" role="note">
      ${c.tipsTitle ? `<div class="tips__label">${c.tipsTitle}</div>` : '<div class="tips__label">Tips</div>'}
      ${c.tips}
    </aside>`;
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

function render(){
  const slide = getSlide(state.paso);
  if (!slide) return;
  const section = getSection(slide.section);
  const content = slideContent[slide.paso] || fillerContent;

  // Headers
  NAV_SECTION.textContent = section.title;
  NAV_STEP.textContent = `Paso ${slide.paso} — ${slide.title}`;
  BTN_PREV.disabled = state.paso <= 1;
  BTN_NEXT.disabled = state.paso >= 27;

  // Progress bar — segments for the current section only
  PROG.innerHTML = '';
  const slidesInSection = section.slides;
  slidesInSection.forEach(p=>{
    const seg = document.createElement('div');
    seg.className = 'progress-seg';
    if (p < state.paso) seg.classList.add('is-done');
    if (p === state.paso) seg.classList.add('is-current');
    PROG.appendChild(seg);
  });

  // Show/hide variant row in tweaks
  const variantRow = document.getElementById('tw-variant-row');
  const hasVariant = slide.apps && slide.apps.length > 1;
  variantRow.hidden = !hasVariant;
  if (!hasVariant) state.variant = 'a';

  // Build slide DOM
  const slideEl = document.createElement('article');
  slideEl.className = 'slide';
  slideEl.dataset.template = slide.template;
  if (slide.layout) slideEl.dataset.layout = slide.layout;
  slideEl.dataset.density = state.density;
  slideEl.dataset.paso = slide.paso;
  slideEl.setAttribute('data-screen-label', `${String(slide.paso).padStart(2,'0')} ${slide.title}`);

  if (slide.template === '2-col'){
    // intro slides (1, 2, 11): image left, text right
    slideEl.innerHTML = `
      <div class="slot-image" aria-label="Imagen ilustrativa — placeholder">
        Imagen ilustrativa
      </div>
      <div class="slot-text">
        <div class="paso-badge">Paso ${slide.paso} · ${section.title}</div>
        <h1 class="slide__title">${slide.title}</h1>
        <div class="prose">${content.text || fillerContent.text}</div>
        ${renderTips(content)}
      </div>
    `;
  } else {
    // 3-col
    const appName = slide.apps[state.variant === 'b' ? 1 : 0];
    const appHtml = state.showIframe
      ? renderIframe(appName, slide.aspect)
      : renderPlaceholder(slide.apps, slide.aspect, state.variant);

    const header = `
      <header class="slide__header">
        <div class="paso-badge">Paso ${slide.paso} · ${section.title}</div>
        <h1 class="slide__title">${slide.title}</h1>
      </header>`;
    const appBlock = `
      <div class="slot-app">
        ${renderVariantToggle(slide)}
        ${appHtml}
      </div>`;
    const textBlock = `
      <div class="slot-text">
        <div class="prose">${content.text || fillerContent.text}</div>
        ${renderTips(content)}
      </div>`;
    // For col-right layout, emit text BEFORE app so grid auto-flow places
    // text in col 1 and iframe in col 2 on the same row.
    if (slide.layout === 'col-right') {
      slideEl.innerHTML = header + textBlock + appBlock + '<div class="slot-empty" aria-hidden="true"></div>';
    } else {
      slideEl.innerHTML = header + appBlock + textBlock;
    }
  }

  STAGE.innerHTML = '';
  STAGE.appendChild(slideEl);

  // Wire variant toggle
  slideEl.querySelectorAll('.variant-toggle button').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      state.variant = btn.dataset.variant;
      render();
    });
  });

  localStorage.setItem(STORAGE_KEY, state.paso);
}

function go(delta){
  const next = state.paso + delta;
  if (next < 1 || next > 27) return;
  state.paso = next;
  state.variant = 'a';
  render();
}

BTN_PREV.addEventListener('click', ()=>go(-1));
BTN_NEXT.addEventListener('click', ()=>go(+1));
document.addEventListener('keydown', e=>{
  if (e.target.closest('input,select,textarea')) return;
  if (e.key === 'ArrowLeft') go(-1);
  if (e.key === 'ArrowRight') go(+1);
});

// Populate "Go to paso" select
const sel = document.getElementById('tw-paso');
slideMatrix.forEach(s=>{
  const o = document.createElement('option');
  o.value = s.paso; o.textContent = `${s.paso}. ${s.title}`;
  sel.appendChild(o);
});
sel.value = state.paso;

render();
