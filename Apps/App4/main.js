import { getMixer, subscribeMixer } from '../../libs/sound/index.js';
import { attachHover } from '../../libs/shared-ui/hover.js';
import { solidMenuBackground } from './utils.js';
import { initRandomMenu, randomizeFractional } from '../../libs/random/index.js';
import { createSchedulingBridge, bindSharedSoundEvents } from '../../libs/app-common/audio.js';
import { createRhythmAudioInitializer, setupAudioDefaults, CHANNEL_TIERS } from '../../libs/app-common/audio-init.js';
import { fromLgAndTempo, toPlaybackPulseCount, gridFromOrigin } from '../../libs/app-common/subdivision.js';
import { createLiveTransportPush } from '../../libs/app-common/transport-live-update.js';
import { initMixerMenu } from '../../libs/app-common/mixer-menu.js';
import { initAudioToggles } from '../../libs/app-common/audio-toggles.js';
import { createPreferenceStorage, registerFactoryReset, setupThemeSync, setupMutePersistence } from '../../libs/app-common/preferences.js';
import createFractionEditor, { createEmptyFractionInfo } from '../../libs/app-common/fraction-editor.js';
import { reorderControls, NOTATION_TOGGLE_BTN_ID } from '../../libs/app-common/template.js';
import createPulseSeqController from '../../libs/pulse-seq/index.js';
import { parseIntSafe, gcd, lcm, randomInt } from '../../libs/app-common/number-utils.js';
import { computePolyrhythmInfo } from '../../libs/app-common/polyrhythm-info.js';
import { bindAppRhythmElements } from '../../libs/app-common/dom.js';
// P-02: imports síncrons només dels mòduls de notació lliures de VexFlow;
// el renderer (i VexFlow ~1,6MB) es carrega lazy al primer toggle del panell.
import { createNotationPanelController } from '../../libs/notation/panel.js';
import { nearestPulseIndex } from '../../libs/pulse-seq/index.js';
import { createVisualSyncManager } from '../../libs/app-common/visual-sync.js';
// F5: anells concèntrics — la representació única de l'app (fora timeline)
import { createCircularRings } from '../../libs/app-common/circular-rings.js';
import { loadNotation } from '../../libs/notation/lazy.js';
import { createFormulaRenderer } from '../../libs/app-common/formula-renderer.js';
import { createInfoTooltip } from '../../libs/app-common/info-tooltip.js';
import { addRepeatPress } from '../../libs/app-common/spinner-repeat.js';
import {
  fractionDefaults,
  randomDefaults,
  createFractionSelectionStore,
  createFractionSelectionFromValue,
  fractionValue as computeFractionValue,
  fractionDisplay as formatFractionDisplay,
  rebuildFractionSelections as rebuildFractionSelectionsModule,
  setFractionSelected as setFractionSelectedModule,
  makeFractionKey,
  loadRandomConfig,
  saveRandomConfig,
  applyRandomConfig as applyRandomConfigModule,
  updateRandomConfig as updateRandomConfigModule
} from './fraction-selection.js';
// Using local header controls for App2 (no shared init)

let audio;



const schedulingBridge = createSchedulingBridge({ getAudio: () => audio });
window.addEventListener('sharedui:scheduling', schedulingBridge.handleSchedulingEvent);
bindSharedSoundEvents({
  getAudio: () => audio,
  mapping: {
    baseSound: 'setBase',
    accentSound: 'setAccent',
    startSound: 'setStart',
    cycleSound: 'setCycle'
  }
});
// Bind all DOM elements using app-specific utilities (no warnings for missing elements)
const { elements } = bindAppRhythmElements('app4');

// Extract commonly used elements for backward compatibility
const { inputLg, inputV, inputT, inputVUp, inputVDown, inputLgUp, inputLgDown,
        unitLg, unitV, unitT, formula, timeline, playBtn, resetBtn, tapBtn, tapHelp,
        selectColor, randomBtn, randomMenu, randLgToggle, randLgMin,
        randLgMax, randVToggle, randVMin, randVMax, randPulsesToggle, randomCount,
        themeSelect, pulseToggleBtn,
        selectedToggleBtn, cycleToggleBtn, notationPanel, notationCloseBtn,
        notationContent } = elements;

// Ordre nuzic de la fila de controls (Play · Random · Reset; App4 no té
// bpmParam — V viu com a pill a .inputs). El helper només re-afegeix
// play/random/reset: el tap (amb el seu tap-help) es re-afegeix a mà.
// F5: el botó loop JA NO es re-afegeix — el bucle és permanent i
// reorderControls el descarta del DOM.
{
  const nuzicControls = reorderControls();
  if (nuzicControls && elements.tapBtn) {
    nuzicControls.appendChild(elements.tapBtn);
    if (elements.tapHelp) nuzicControls.appendChild(elements.tapHelp);
  }
  // El toggle de partitura viu amb la resta de botons (dreta del tap, esquerra
  // del reset) amb l'estètica de control nuzic, no al top-bar. Es desa la classe
  // `notation-ctrl`; l'ordre visual el fixa el CSS (order:4, DOM després del tap
  // → play · random · tap · notació · reset). El controller del panell el
  // segueix referenciant per id.
  const notationCtrlBtn = document.getElementById(NOTATION_TOGGLE_BTN_ID);
  if (nuzicControls && notationCtrlBtn) {
    notationCtrlBtn.classList.remove('top-bar-notation-button');
    notationCtrlBtn.classList.add('notation-ctrl');
    nuzicControls.appendChild(notationCtrlBtn);
  }
  // Botó info (∑): obre el panell amb la matemàtica de la combinació. Va a la
  // dreta de tot menys el reset (esquerra del reset) amb l'estètica del reset
  // (cercle fosc). L'ordre el fixa el CSS (order:5 com el reset; al DOM va
  // abans del reset perquè reorderControls ja l'ha re-afegit).
  if (nuzicControls) {
    const infoBtn = document.createElement('button');
    infoBtn.type = 'button';
    infoBtn.id = 'infoBtn';
    infoBtn.className = 'info-ctrl';
    infoBtn.setAttribute('aria-label', 'Información matemática');
    infoBtn.textContent = '∑';
    const resetEl = nuzicControls.querySelector('.reset') || elements.resetBtn;
    if (resetEl && resetEl.parentNode === nuzicControls) {
      nuzicControls.insertBefore(infoBtn, resetEl);
    } else {
      nuzicControls.appendChild(infoBtn);
    }
    infoBtn.addEventListener('click', toggleInfoPanel);
  }
}

// ── F5: anells concèntrics ──────────────────────────────────────────────────
// L'element #timeline del template es reconverteix en amfitrió pelat dels
// anells: fora la classe .timeline perquè cap estil compartit de línia de
// temps (línia, fons crema del tema nuzic) no s'hi apliqui.
timeline.className = 'rings-host';
// Accent de selecció UNIFICAT per a tots els anells (seleccionat/actiu/origen):
// verd nuzic. Concepte únic "seleccionat = verd", vistós sobre qualsevol banda
// (fosca o de color). Sobreescriu el default del mòdul (versió saturada per anell).
const RING_SELECT_ACCENT = 'var(--nuzic-green)';
const rings = createCircularRings({
  container: timeline,
  onDotClick: handleRingDotClick
});

// ── Panell info (∑): matemàtica de la combinació ──────────────────────────
let infoPanelEl = null;

// Formata un nombre: enters tal qual, decimals a 2 xifres (sense zeros finals).
function fmtNum(x) {
  if (!Number.isFinite(x)) return '–';
  return Number.isInteger(x) ? String(x) : (Math.round(x * 100) / 100).toString();
}

function buildInfoPanelHtml() {
  const info = computePolyrhythmInfo({
    lg: parseIntSafe(inputLg?.value),
    v: parseFloat(inputV?.value),
    fractions: getActiveFractions()
  });

  const general = `
    <dl class="info-panel__dl">
      <div><dt>Pulsos (Lg)</dt><dd>${fmtNum(info.lg)}</dd></div>
      <div><dt>Ciclos</dt><dd>${info.cycles ?? '–'}</dd></div>
      <div><dt>Ciclo grande = mcm(numeradores)</dt><dd>${info.bigCycle} pulsos</dd></div>
      <div><dt>Duración (T)</dt><dd>${info.durationSec != null ? `${fmtNum(info.durationSec)} s` : '–'}</dd></div>
      <div><dt>mcm(denominadores)</dt><dd>${info.lcmDenominators}</dd></div>
    </dl>`;

  const fracTable = info.fractions.length
    ? `<table class="info-panel__table">
         <thead><tr><th>Fracción</th><th>Velocidad</th><th>Pulsos·frac/ciclo</th></tr></thead>
         <tbody>${info.fractions.map((f) => {
           const reduced = f.reducible ? ` <span class="info-panel__reduced">(${f.reducedNumerator}/${f.reducedDenominator})</span>` : '';
           return `<tr>
             <td><strong>${f.numerator}/${f.denominator}</strong>${reduced}</td>
             <td>${f.velocity != null ? `${fmtNum(f.velocity)} BPM` : '–'}</td>
             <td>${fmtNum(f.pulsesPerCycle)}</td>
           </tr>`;
         }).join('')}</tbody>
       </table>`
    : '<p class="info-panel__empty">Ninguna fracción activa</p>';

  const ratio = `<div class="info-panel__ratio">
      <span class="info-panel__ratio-label">Proporción (pulso : fracciones)</span>
      <span class="info-panel__ratio-value">${info.ratio.join(' : ')}</span>
    </div>`;

  return `
    <h3>∑ Matemática</h3>
    ${general}
    <p class="info-panel__sub">Por fracción (velocidad = V·d/n)</p>
    ${fracTable}
    ${ratio}`;
}

// Recalcula el panell si està obert (canvis de fraccions / Pulsos / BPM).
function refreshInfoPanelIfOpen() {
  if (infoPanelEl && !infoPanelEl.hidden) {
    infoPanelEl.innerHTML = buildInfoPanelHtml();
  }
}

function setInfoPanelOpen(open) {
  if (!infoPanelEl) return;
  if (open) infoPanelEl.innerHTML = buildInfoPanelHtml();
  infoPanelEl.hidden = !open;
  document.getElementById('infoBtn')?.classList.toggle('active', open);
}

function toggleInfoPanel() {
  if (!infoPanelEl) {
    infoPanelEl = document.createElement('div');
    infoPanelEl.id = 'infoPanel';
    infoPanelEl.className = 'info-panel';
    infoPanelEl.hidden = true;
    (document.querySelector('main') || document.body).appendChild(infoPanelEl);
    // Tancar en clicar FORA del panell (i no al botó ∑). pointerdown al
    // document; ignora clics dins del panell o sobre el botó.
    document.addEventListener('pointerdown', (e) => {
      if (infoPanelEl.hidden) return;
      const btn = document.getElementById('infoBtn');
      if (infoPanelEl.contains(e.target) || (btn && (e.target === btn || btn.contains(e.target)))) return;
      setInfoPanelOpen(false);
    });
  }
  setInfoPanelOpen(infoPanelEl.hidden);
}

function applyFractionInfoBackground(panel) {
  if (!panel) return;
  const theme = document.body?.dataset?.theme === 'dark' ? 'dark' : 'light';
  const rootStyles = getComputedStyle(document.documentElement);
  const textVar = theme === 'dark' ? '--text-dark' : '--text-light';
  const fallbackText = rootStyles.getPropertyValue(textVar)?.trim() || (theme === 'dark' ? '#EEE8D8' : '#43433B');
  panel.style.backgroundColor = theme === 'dark' ? 'rgba(40, 40, 40, 0.92)' : 'rgba(255, 255, 255, 0.9)';
  panel.style.color = fallbackText;
  panel.style.borderColor = theme === 'dark' ? 'rgba(238, 232, 216, 0.2)' : 'rgba(0, 0, 0, 0.08)';
  panel.style.boxShadow = theme === 'dark'
    ? '0 18px 36px rgba(0, 0, 0, 0.6)'
    : '0 12px 28px rgba(0, 0, 0, 0.25)';
  panel.style.backdropFilter = 'blur(8px)';
}

let currentFractionInfo = createEmptyFractionInfo();
const fractionStore = createFractionSelectionStore();
const fractionMemory = new Map();

const notationContentEl = notationContent || null;
let notationPanelController = null;
let notationRendererController = null;

function renderNotationIfVisible(opts) {
  const playing = typeof isPlaying === 'boolean' ? isPlaying : false;
  notationRendererController?.render({
    ...opts,
    isPlaying: playing
  });
}

function normalizeFractionMemoryPayload(info) {
  if (!info || !info.key) return null;
  const base = Number.isFinite(info.base) ? info.base : null;
  const numerator = Number.isFinite(info.numerator) ? info.numerator : null;
  const denominator = Number.isFinite(info.denominator) ? info.denominator : null;
  const cycleIndex = Number.isFinite(info.cycleIndex) ? info.cycleIndex : null;
  const subdivisionIndex = Number.isFinite(info.subdivisionIndex) ? info.subdivisionIndex : null;
  const pulsesPerCycle = Number.isFinite(info.pulsesPerCycle) && info.pulsesPerCycle > 0
    ? info.pulsesPerCycle
    : null;
  let value = Number.isFinite(info.value) ? info.value : null;
  if (!Number.isFinite(value)
    && Number.isFinite(base)
    && Number.isFinite(numerator)
    && Number.isFinite(denominator)
    && denominator > 0) {
    value = fractionValue(base, numerator, denominator);
  }
  const displayInput = typeof info.display === 'string' ? info.display : '';
  const display = displayInput || (Number.isFinite(base)
    && Number.isFinite(numerator)
    && Number.isFinite(denominator)
    && denominator > 0
    ? fractionDisplay(base, numerator, denominator, {
      cycleIndex,
      subdivisionIndex,
      pulsesPerCycle
    })
    : '');
  const rawLabel = typeof info.rawLabel === 'string' ? info.rawLabel : '';
  return {
    key: info.key,
    base,
    numerator,
    denominator,
    value,
    display,
    rawLabel,
    cycleIndex,
    subdivisionIndex,
    pulsesPerCycle
  };
}

function rememberFractionSelectionInMemory(info, { suspended = false } = {}) {
  const payload = normalizeFractionMemoryPayload(info);
  if (!payload) return;
  const existing = fractionMemory.get(payload.key) || {};
  const entry = {
    key: payload.key,
    base: Number.isFinite(payload.base) ? payload.base : existing.base,
    numerator: Number.isFinite(payload.numerator) ? payload.numerator : existing.numerator,
    denominator: Number.isFinite(payload.denominator) ? payload.denominator : existing.denominator,
    value: Number.isFinite(payload.value) ? payload.value : existing.value,
    display: payload.display || existing.display || '',
    rawLabel: payload.rawLabel || existing.rawLabel || '',
    cycleIndex: Number.isFinite(payload.cycleIndex) ? payload.cycleIndex : existing.cycleIndex,
    subdivisionIndex: Number.isFinite(payload.subdivisionIndex) ? payload.subdivisionIndex : existing.subdivisionIndex,
    pulsesPerCycle: Number.isFinite(payload.pulsesPerCycle) ? payload.pulsesPerCycle : existing.pulsesPerCycle,
    suspended: suspended === true
  };
  fractionMemory.set(payload.key, entry);
}

function markFractionSuspended(info) {
  rememberFractionSelectionInMemory(info, { suspended: true });
}

function syncFractionMemoryWithSelections() {
  const activeKeys = new Set();
  if (Array.isArray(fractionStore.pulseSelections)) {
    fractionStore.pulseSelections.forEach((item) => {
      if (!item || !item.key) return;
      activeKeys.add(item.key);
      rememberFractionSelectionInMemory(item, { suspended: false });
    });
  }
  fractionMemory.forEach((entry, key) => {
    if (!activeKeys.has(key) && !(entry && entry.suspended)) {
      fractionMemory.delete(key);
    }
  });
}
let currentAudioResolution = 1;

// F2: l'editor numèric de pulsos s'ha eliminat. El controlador de pulse-seq
// NO es munta: només se n'aprofita la memòria persistent de pulsos, que és
// independent del mount.
const pulseSeqController = createPulseSeqController();
const pulseMemoryApi = pulseSeqController.memory;
const pulseMemory = pulseMemoryApi.data;

// F5: el tIndicator s'ha retirat amb la timeline — la informació de T
// passarà al panell ⓘ de F7 (mentrestant viu a la fórmula i al tooltip
// del títol, que ja la mostren).

// App4-specific additional elements
const randComplexToggle = document.getElementById('randComplexToggle');
const randNToggle = document.getElementById('randNToggle');
const randNMin = document.getElementById('randNMin');
const randNMax = document.getElementById('randNMax');
const randDToggle = document.getElementById('randDToggle');
const randDMin = document.getElementById('randDMin');
const randDMax = document.getElementById('randDMax');
const titleHeading = document.querySelector('header.top-bar h1');
const titleTextNode = titleHeading?.querySelector('.top-bar-title-text');
let titleButton = null;
if (titleHeading && titleTextNode) {
  titleButton = document.createElement('button');
  titleButton.type = 'button';
  titleButton.id = 'appTitleBtn';
  titleButton.className = 'top-bar-title-button';
  titleButton.textContent = titleTextNode.textContent?.trim() || '';
  titleHeading.replaceChild(titleButton, titleTextNode);
  attachHover(titleButton, { text: 'Click para ver información detallada' });
} else if (titleHeading) {
  titleButton = document.createElement('button');
  titleButton.type = 'button';
  titleButton.id = 'appTitleBtn';
  titleButton.className = 'top-bar-title-button';
  titleButton.textContent = titleHeading.textContent || '';
  titleHeading.textContent = '';
  titleHeading.appendChild(titleButton);
  attachHover(titleButton, { text: 'Click para ver información detallada' });
}
const notationToggleBtn = document.getElementById(NOTATION_TOGGLE_BTN_ID);

// P-02: el renderer — i tot VexFlow (~1,6MB) — es carrega lazy la primera
// vegada que s'obre el panell. Fins llavors renderNotationIfVisible és un
// no-op (optional chaining), igual que abans de crear el controller.
let notationLoadRequested = false;
function ensureNotationRenderer() {
  if (notationLoadRequested || !notationContentEl) return;
  notationLoadRequested = true;
  loadNotation().then(async (mod) => {
    notationRendererController = mod.createNotationRenderer({
      notationContentEl,
      notationPanelController,
      getFraction,
      // F6: notació multi-fracció — un pentagrama base "Pulso" + un per
      // fracció activa, acolorit amb el color d'identitat del seu slot.
      getActiveFractions: getActiveFractionsForNotation,
      getLg: () => parseInt(inputLg.value, 10),
      fractionStore,
      pulseMemoryApi,
      createFractionSelectionFromValue,
      onPulseSelected: setPulseSelected,
      onFractionSelected: setFractionSelected
    });
    // CRÍTIC: esperar que les fonts de música de VexFlow estiguin
    // carregades ABANS del primer render. Sense això, el primer dibuix usa
    // mètriques de font equivocades i les pliques surten separades del cap
    // (es corregia sol al primer re-render per interacció). fontsReady és un
    // Promise.allSettled; si ja està resolt, l'await és instantani.
    if (mod.fontsReady && typeof mod.fontsReady.then === 'function') {
      try { await mod.fontsReady; } catch {}
    }
    renderNotationIfVisible({ force: true });
  }).catch((err) => {
    notationLoadRequested = false; // reintentable al següent toggle
    console.warn('Notación no disponible:', err);
  });
}

notationPanelController = createNotationPanelController({
  toggleButton: notationToggleBtn,
  panel: notationPanel,
  closeButton: notationCloseBtn,
  appId: 'app4',
  onOpen: () => {
    ensureNotationRenderer();
    renderNotationIfVisible({ force: true });
  }
});

// Tancar el "full" en fer clic al BACKDROP (l'àrea de l'overlay fora de la
// pàgina blanca), a més de la clau de sol. Es comprova `event.target ===
// notationPanel` (el backdrop és el propi <section> de l'overlay) en lloc de
// `closest('.notation-panel__dialog')`: en clicar una NOTA, la selecció
// re-renderitza i DESVINCULA del DOM la nota clicada, així que quan el clic
// bombolleja fins aquí `event.target` ja no té avantpassats i `closest()`
// retornaria null → tancava el full per error. Amb `=== notationPanel` només
// tanca el clic directe al backdrop (mai un clic a una nota o a la pàgina).
if (notationPanel) {
  notationPanel.addEventListener('click', (event) => {
    if (event.target === notationPanel) {
      notationPanelController.close();
    }
  });
}

// Exporta la partitura a PNG sense dependències. Clau: VexFlow dibuixa els caps
// de nota com a <text> amb la font Bravura (carregada via FontFace a la pàgina);
// en rasteritzar un SVG com a imatge, el navegador NO veu les fonts de la pàgina
// → glyphs "tofu" (rectangles). Per evitar-ho, INCRUSTEM la font (Bravura ja és
// un data-URI woff2 dins VexFlow) com a @font-face dins l'SVG abans de rasteritzar.
// El cursor de playback és un <div> germà → no s'inclou.
let bravuraDataUri = null;
async function exportScoreToPng() {
  const svg = notationContentEl?.querySelector('svg');
  if (!svg) return;
  if (bravuraDataUri == null) {
    try {
      const mod = await import('../../libs/vendor/vexflow/src/fonts/bravura.js');
      bravuraDataUri = mod.Bravura || '';
    } catch (err) {
      bravuraDataUri = '';
      console.warn('No s\'ha pogut carregar la font Bravura per a l\'exportació', err);
    }
  }
  const w = Number(svg.getAttribute('width')) || svg.getBoundingClientRect().width || 1000;
  const h = Number(svg.getAttribute('height')) || svg.getBoundingClientRect().height || 300;

  const clone = svg.cloneNode(true);
  clone.removeAttribute('style'); // fora l'ombra/filtre de pantalla
  clone.setAttribute('width', String(w));
  clone.setAttribute('height', String(h));
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  const SVGNS = 'http://www.w3.org/2000/svg';
  // @font-face amb la Bravura incrustada (data-URI) → glyphs reals, no rectangles.
  if (bravuraDataUri) {
    const styleEl = document.createElementNS(SVGNS, 'style');
    styleEl.textContent = `@font-face{font-family:'Bravura';src:url(${bravuraDataUri}) format('woff2');font-display:block;}`;
    clone.insertBefore(styleEl, clone.firstChild);
  }
  // Fons blanc (l'SVG de pantalla és transparent).
  const bg = document.createElementNS(SVGNS, 'rect');
  bg.setAttribute('x', '0'); bg.setAttribute('y', '0');
  bg.setAttribute('width', String(w)); bg.setAttribute('height', String(h));
  bg.setAttribute('fill', '#ffffff');
  clone.insertBefore(bg, clone.firstChild);

  const xml = '<?xml version="1.0" encoding="UTF-8"?>' + new XMLSerializer().serializeToString(clone);
  const svgUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);

  const img = new Image();
  img.onload = () => {
    const scale = Math.max(1, Math.min(2, 5000 / w)); // 2x nítid, amb sostre d'amplada
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.download = 'pulsos-fraccionados.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  };
  img.onerror = (err) => console.warn('No s\'ha pogut rasteritzar la partitura', err);
  img.src = svgUrl;
}

// Botó d'exportació a la cantonada dreta superior del full de partitura.
if (notationPanel) {
  const dialog = notationPanel.querySelector('.notation-panel__dialog');
  if (dialog && !dialog.querySelector('.notation-export-btn')) {
    const exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.id = 'notationExportBtn';
    exportBtn.className = 'notation-export-btn';
    exportBtn.setAttribute('aria-label', 'Exportar partitura a PNG');
    exportBtn.innerHTML = `<svg class="notation-export-btn__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <rect x="3.5" y="2.5" width="12" height="15.5" rx="1.6" stroke="currentColor" stroke-width="1.7"/>
      <rect x="8.5" y="6" width="12" height="15.5" rx="1.6" fill="#43433b" stroke="currentColor" stroke-width="1.7"/>
      <text x="14.5" y="15.5" text-anchor="middle" font-size="5.2" font-weight="800" fill="currentColor" font-family="Ubuntu, system-ui, sans-serif">PNG</text>
    </svg>`;
    exportBtn.addEventListener('click', exportScoreToPng);
    attachHover(exportBtn, { text: 'Exportar a PNG' });
    dialog.appendChild(exportBtn);
  }
}

// Canals registrats al motor (TimelineAudio constructor);
// setupAudioDefaults dins initAudio() els personalitza.
const globalMixer = getMixer();

// F4: un canal de mixer per SLOT de fracció (estables per slot, mai per
// ordre d'activació). L'àudio de cada fracció activa hi surt sempre pel seu:
// la primera activa via el bus de cicle re-apuntat (setCycleChannel) i la
// resta via veus polirítmiques amb `channel` propi. El canal 'subdivision'
// del motor queda sense ús a App4 (ni menú ni so).
const FRACTION_MIXER_CHANNELS = [
  { id: 'frac1', label: 'Fracció 1', allowSolo: true },
  { id: 'frac2', label: 'Fracció 2', allowSolo: true },
  { id: 'frac3', label: 'Fracció 3', allowSolo: true }
];
const FRACTION_CHANNEL_IDS = FRACTION_MIXER_CHANNELS.map((channel) => channel.id);
const fractionChannelForSlot = (slotId) => `frac${String(slotId).replace(/^f/, '')}`;

// F4b: cada slot té, a més, un canal per als pulsos fraccionats que l'usuari
// ha SELECCIONAT sobre la graella d'aquella fracció ("Fracció N sel."). Els
// pulsos sencers seleccionats segueixen al canal global 'accent'
// ("Seleccionado"). El so és el mateix sample d'accent per a tots: només
// canvia el fader/mute que els governa.
const FRACTION_SELECTED_MIXER_CHANNELS = [
  { id: 'fracSel1', label: 'Fracció 1 sel.', allowSolo: true },
  { id: 'fracSel2', label: 'Fracció 2 sel.', allowSolo: true },
  { id: 'fracSel3', label: 'Fracció 3 sel.', allowSolo: true }
];
const FRACTION_SELECTED_CHANNEL_IDS = FRACTION_SELECTED_MIXER_CHANNELS.map((channel) => channel.id);
const fractionSelectedChannelForSlot = (slotId) => `fracSel${String(slotId).replace(/^f/, '')}`;
// F4b: grup que governa el toggle "Seleccionado" del header — el canal
// global de sencers + els tres canals de seleccionats fraccionats.
const SELECTED_GROUP_CHANNEL_IDS = ['accent', ...FRACTION_SELECTED_CHANNEL_IDS];

// Registre immediat al singleton: els toggles d'àudio i el menú del mixer
// han de poder silenciar-los abans que el motor existeixi (gest del Play).
[...FRACTION_MIXER_CHANNELS, ...FRACTION_SELECTED_MIXER_CHANNELS]
  .forEach(({ id, ...meta }) => globalMixer.registerChannel(id, meta));

const FRACTION_NUMERATOR_KEY = 'n';
const FRACTION_DENOMINATOR_KEY = 'd';
// F3: abans aquesta clau es referenciava sense definir (el try/catch de
// load/saveRandomConfig s'empassava el ReferenceError i la config random
// no es persistia mai). Definir-la arregla la persistència de passada.
const RANDOM_STORE_KEY = 'random';

const preferenceStorage = createPreferenceStorage({ prefix: 'app4', separator: ':' });
const { storeKey, save: saveOpt, load: loadOpt, clear: clearOpt } = preferenceStorage;
const muteButton = document.getElementById('muteBtn');

registerFactoryReset({ storage: preferenceStorage });
setupThemeSync({ storage: preferenceStorage, selectEl: themeSelect });
setupMutePersistence({
  storage: preferenceStorage,
  getAudioInstance: () => audio,
  muteButton
});

// F4c: cada canal del mixer (tots menys Master) té el seu selector
// d'instrument al propi menú. Persistència per canal a `sound:<canal>`
// (preferenceStorage → 'app4:sound:<canal>'); el motor rep l'override via
// audio.setChannelSound. PRECEDÈNCIA del sample d'un canal: override del
// mixer > sample de ROL que fixen els selects dev del header
// (Base/Pulso/Fracciones, que segueixen sent els fixadors de DEFAULTS).
const MIXER_SOUND_CHANNEL_IDS = [
  'pulse', 'accent',
  ...FRACTION_CHANNEL_IDS.flatMap((id, i) => [id, FRACTION_SELECTED_CHANNEL_IDS[i]])
];

// Default del selector = valor actual del ROL del canal (el que mostren els
// selects dev del header), llegit de les seves claus RAW de localStorage
// (compartides entre apps, sense prefix): Pulso→base, Fracció N→cycle,
// Seleccionado i Fracció N sel.→accent.
function mixerSoundDefault(channelId) {
  const read = (key, fallback) => {
    try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
  };
  if (channelId === 'pulse') return read('baseSound', 'click9');
  if (FRACTION_CHANNEL_IDS.includes(channelId)) return read('cycleSound', 'click10');
  return read('accentSound', 'click8'); // accent + fracSel1/2/3
}

// Afegeix el selector d'instrument al config d'un canal d'initMixerMenu
// (còpia: els arrays FRACTION_* es comparteixen amb setupAudioDefaults i
// registerChannel i han de quedar nets de camps d'UI).
const withMixerSoundSelector = (channel) => ({
  ...channel,
  soundSelector: {
    storageKey: storeKey(`sound:${channel.id}`),
    eventType: `app4Sound:${channel.id}`,
    defaultValue: mixerSoundDefault(channel.id)
  }
});

const randomControls = {
  randLgToggle,
  randLgMin,
  randLgMax,
  randVToggle,
  randVMin,
  randVMax,
  randNToggle,
  randNMin,
  randNMax,
  randDToggle,
  randDMin,
  randDMax,
  randComplexToggle,
  randPulsesToggle,
  randomCount
};

const randomConfig = {
  ...randomDefaults,
  ...loadRandomConfig(() => loadOpt(RANDOM_STORE_KEY))
};

function persistRandomConfig() {
  saveRandomConfig((value) => saveOpt(RANDOM_STORE_KEY, value), randomConfig);
}

function applyRandomConfig() {
  applyRandomConfigModule(randomConfig, randomControls);
}

function updateRandomConfig() {
  updateRandomConfigModule(randomConfig, randomControls);
  persistRandomConfig();
}

applyRandomConfig();

[
  randLgToggle, randLgMin, randLgMax,
  randVToggle, randVMin, randVMax,
  randNToggle, randNMin, randNMax,
  randDToggle, randDMin, randDMax,
  randComplexToggle,
  randPulsesToggle, randomCount
].forEach(el => el?.addEventListener('change', updateRandomConfig));

// ───────────────────────────────────────────────────────────────────────────
// F3: tres fraccions activables (F1 groc, F2 rosa, F3 blau) + model
// Lg = cicle gran × m. El cicle gran és el mcm dels numeradors REDUÏTS de
// les fraccions actives (els denominadors no hi influeixen); m ("Cicles")
// és l'únic control de longitud. MAX_LG = mcm(5,6,7) = 210: el pitjor cas
// matemàtic amb numeradors ≤ 7 — cap combinació vàlida queda mai bloquejada.
// Per provar manualment la xarxa de seguretat, abaixar temporalment MAX_LG.
// ───────────────────────────────────────────────────────────────────────────
const MAX_LG = 210;
const CYCLES_KEY = 'cycles';
const DEFAULT_CYCLES = 3; // estat de fàbrica: cicle gran 1 (F1 buida) → Lg=3
const BPM_KEY = 'bpm';
const DEFAULT_BPM = 90; // sense V el play no arrencava (interval null)

// Colors d'identitat dels anells (F5): hexes literals — els atributs SVG de
// presentació no resolen var(); el CSS del mòdul sí que usa les variables
// --crings-* que reben aquests valors.
const FRACTION_SLOT_DEFS = [
  {
    id: 'f1',
    label: 'F1',
    ringColor: '#FFBB33',      // --nuzic-yellow
    ringLightColor: '#ffeecc',
    numeratorKey: FRACTION_NUMERATOR_KEY,   // claus LEGACY app4:n / app4:d
    denominatorKey: FRACTION_DENOMINATOR_KEY,
    activeKey: 'f1on',
    defaultActive: true
  },
  {
    id: 'f2',
    label: 'F2',
    ringColor: '#F28AAD',      // --nuzic-pink
    ringLightColor: '#ffe5ee',
    numeratorKey: 'n2',
    denominatorKey: 'd2',
    activeKey: 'f2on',
    defaultActive: false
  },
  {
    id: 'f3',
    label: 'F3',
    ringColor: '#7BB4CD',      // --nuzic-blue
    ringLightColor: '#e3f0f7',
    numeratorKey: 'n3',
    denominatorKey: 'd3',
    activeKey: 'f3on',
    defaultActive: false
  }
];

// Estat viu dels tres slots: { id, controller, active, added, ... }
const fractionSlots = [];
let fractionAddButton = null;
let fractionRemoveButton = null;
let isRevertingCombo = false; // evita reentrada del pipeline en revertir
let lastActiveFractionsSignature = null;

// Tooltip d'error de combinació (ancorat al slot culpable, auto-hide)
const comboErrorTooltip = createInfoTooltip({
  className: 'fraction-info-bubble auto-tip-below fraction-combo-tip'
});
let comboErrorTimer = null;

function showComboError(slot, reducedNums, bigCycle) {
  const anchor = slot?.elements?.slotEl || document.querySelector('.fraction-row');
  if (!anchor) return;
  const text = `Cicle gran = mcm(${reducedNums.join(', ')}) = ${bigCycle} pulsos > màxim ${MAX_LG}`;
  comboErrorTooltip.show(text, anchor);
  if (comboErrorTimer) clearTimeout(comboErrorTimer);
  comboErrorTimer = setTimeout(() => comboErrorTooltip.hide(), 4000);
}

function isValidFractionPair(fraction) {
  return !!fraction
    && Number.isFinite(fraction.numerator) && fraction.numerator > 0
    && Number.isFinite(fraction.denominator) && fraction.denominator > 0;
}

// Primer slot actiu AMB valors vàlids (un slot actiu però buit no compta:
// no aporta fracció ni als anells ni al cicle gran).
function getFirstActiveSlot() {
  return fractionSlots.find((slot) => slot.added && slot.active && slot.controller
    && isValidFractionPair(slot.controller.getFraction())) || null;
}

// Fracció "principal" per a l'àudio i la notació: la PRIMERA activa
// (F1>F2>F3). F4: l'àudio ja és multi-fracció — la principal pel camí de
// cicle (canal fracN del seu slot via setCycleChannel) i la resta com a
// veus (setVoices). F5: la visualització ja és multi-fracció (anells);
// la notació segueix sobre aquesta única fracció fins F6.
function getFraction() {
  const slot = getFirstActiveSlot();
  if (!slot) return { numerator: null, denominator: null };
  return slot.controller.getFraction();
}

// Fraccions actives amb valors vàlids + numerador reduït (per al cicle gran)
// + id del slot (per a les veus d'àudio F4 i els anells F5). L'ordre és el
// dels slots: la primera entrada és sempre la fracció "principal".
function getActiveFractions() {
  return fractionSlots
    .filter((slot) => slot.added && slot.active && slot.controller)
    .map((slot) => ({ id: slot.id, ...slot.controller.getFraction() }))
    .filter(isValidFractionPair)
    .map(({ id, numerator, denominator }) => ({
      id,
      numerator,
      denominator,
      reducedNumerator: numerator / gcd(numerator, denominator)
    }));
}

// F6: les fraccions actives amb el color d'identitat del seu slot, per a la
// notació multi-fracció (un pentagrama acolorit per fracció). Els altres
// consumidors de getActiveFractions (àudio, anells) no necessiten el color.
function getActiveFractionsForNotation() {
  return getActiveFractions().map((fraction) => {
    const slot = fractionSlots.find((s) => s.id === fraction.id);
    return {
      id: fraction.id,
      numerator: fraction.numerator,
      denominator: fraction.denominator,
      color: slot?.ringColor || null,
      lightColor: slot?.ringLightColor || null
    };
  });
}

// F4b: regla de mapatge selecció fraccionada → slot. Una selecció guarda el
// n/d LITERAL (sense reduir) de la graella on es va fer: pulsesPerCycle = n
// del slot i denominator = d del slot (F5: els estampen els clics als
// anells via createFractionSelectionFromValue). Es compara LITERALMENT amb
// els slots actius en ordre F1>F2>F3 (una selecció 2/4 NO casa amb un slot
// que mostra 1/2):
//   1. pulsesPerCycle i denominator coincideixen → canal fracSelN del slot.
//   2. pulsesPerCycle desconegut (entrades antigues de memòria) → primer
//      slot actiu amb el mateix denominator.
//   3. cap coincidència → null: la selecció queda sense etiqueta i sona pel
//      canal global 'accent' (comportament legacy).
function selectionChannelForFraction(item, activeFractions) {
  if (!item || !Array.isArray(activeFractions) || !activeFractions.length) return null;
  const den = Number(item.denominator);
  if (!(Number.isFinite(den) && den > 0)) return null;
  const num = Number.isFinite(item.pulsesPerCycle) && item.pulsesPerCycle > 0
    ? Number(item.pulsesPerCycle)
    : null;
  const slot = activeFractions.find((fraction) => fraction.denominator === den
    && (num == null || fraction.numerator === num));
  return slot ? fractionSelectedChannelForSlot(slot.id) : null;
}

// Cicle gran = mcm dels numeradors reduïts de les fraccions actives; 1 si
// no n'hi ha cap (l'app es comporta com a pulsos plans).
function computeBigCycle(actives = getActiveFractions()) {
  return actives.length
    ? actives.reduce((acc, f) => lcm(acc, f.reducedNumerator), 1)
    : 1;
}

// Cicle gran "hipotètic": permet validar una edició (override d'un slot) o
// un toggle-ON (forceActiveId) ABANS d'acceptar-los.
function wouldBeBigCycle({ override = null, forceActiveId = null } = {}) {
  const reducedNums = [];
  fractionSlots.forEach((slot) => {
    const active = slot.id === forceActiveId ? true : (slot.added && slot.active);
    if (!active || !slot.controller) return;
    const fraction = (override && override.id === slot.id)
      ? override.fraction
      : slot.controller.getFraction();
    if (!isValidFractionPair(fraction)) return;
    reducedNums.push(fraction.numerator / gcd(fraction.numerator, fraction.denominator));
  });
  const bigCycle = reducedNums.length
    ? reducedNums.reduce((acc, n) => lcm(acc, n), 1)
    : 1;
  return { bigCycle, reducedNums };
}

// F5: la firma inclou TOTES les fraccions actives — qualsevol canvi
// d'estructura (valors o toggles de qualsevol slot) re-renderitza els
// anells, no només els canvis de la principal.
function activeFractionsSignature() {
  const actives = getActiveFractions();
  return actives.length
    ? actives.map((f) => `${f.id}:${f.numerator}/${f.denominator}`).join('|')
    : 'none';
}

// Pipeline comú després de qualsevol canvi d'estructura de fraccions
// (edició de valors, toggle on/off, afegir slot): recalcula Lg i, si el
// conjunt de fraccions actives ha canviat, re-renderitza els anells.
function handleFractionLayoutChange() {
  recomputeLg({ dispatch: false });
  const signature = activeFractionsSignature();
  if (signature !== lastActiveFractionsSignature) {
    lastActiveFractionsSignature = signature;
    currentFractionInfo = getFirstActiveSlot()?.info || createEmptyFractionInfo();
    renderRings();
  }
  if (!isUpdating) {
    handleInput();
  }
}

function handleSlotFractionChange(slot, { info, cause }) {
  if (cause === 'init') {
    slot.info = info || createEmptyFractionInfo();
    slot.lastValid = slot.controller ? slot.controller.getFraction() : { numerator: null, denominator: null };
    return;
  }
  if (isRevertingCombo) {
    slot.info = info || createEmptyFractionInfo();
    return;
  }
  // validateFractionCombo: amb MAX_LG=210 i n≤7 és inassolible (xarxa de
  // seguretat), però si el cicle gran hipotètic no hi cap, es reverteix
  // l'edició al darrer valor vàlid i s'explica el mcm al slot.
  if (slot.added && slot.active) {
    const { bigCycle, reducedNums } = wouldBeBigCycle();
    if (bigCycle > MAX_LG) {
      isRevertingCombo = true;
      try {
        slot.controller.setFraction({
          numerator: slot.lastValid?.numerator ?? null,
          denominator: slot.lastValid?.denominator ?? null
        }, { cause: 'combo-revert' });
      } finally {
        isRevertingCombo = false;
      }
      showComboError(slot, reducedNums, bigCycle);
      return;
    }
  }
  slot.info = info || createEmptyFractionInfo();
  slot.lastValid = slot.controller ? slot.controller.getFraction() : slot.lastValid;
  handleFractionLayoutChange();
}

// Botó "A" d'un slot. Model "treure/afegir" (sense estat atenuat
// intermedi): una fracció és VISIBLE (added ≡ active) o NO HI ÉS. Clicar
// "A" en una fracció visible la TREU del tot; es torna a afegir amb el "+"
// (que en recupera els valors, conservats al controller). Afegir valida la
// combinació; treure sempre és legal (zero fraccions = cicle gran 1).
/* El mixer només mostra els canals (metrònom + sel.) de les fraccions
   ACTIVES: un data-attribute per slot al body governa la visibilitat
   per CSS — funciona encara que el menú del mixer es creï més tard. */
function syncMixerChannelVisibility() {
  fractionSlots.forEach((slot) => {
    const visible = slot.added && slot.active;
    document.body.dataset[`${slot.id}On`] = visible ? '1' : '0';
  });
}

function setSlotActive(slot, nextActive, { persist = true, refresh = true } = {}) {
  if (!slot) return false;
  if (nextActive && slot.controller) {
    const { bigCycle, reducedNums } = wouldBeBigCycle({ forceActiveId: slot.id });
    if (bigCycle > MAX_LG) {
      showComboError(slot, reducedNums, bigCycle);
      return false;
    }
  }
  slot.active = !!nextActive;
  slot.added = !!nextActive; // visible ⇔ actiu (model treure/afegir)
  if (slot.elements?.toggleBtn) {
    slot.elements.toggleBtn.setAttribute('aria-pressed', slot.active ? 'true' : 'false');
  }
  // Desactivar = desaparèixer del tot (no atenuat); activar = mostrar.
  slot.elements?.slotEl?.classList.toggle('fraction-slot--hidden', !slot.active);
  if (!slot.active) {
    // En treure la fracció es netegen els mute/solo dels seus dos canals:
    // un solo "fantasma" en un canal ja ocult callaria la resta del mixer
    // sense cap pista visible del perquè.
    try {
      const mixer = getMixer();
      [fractionChannelForSlot(slot.id), fractionSelectedChannelForSlot(slot.id)]
        .forEach((channelId) => {
          mixer?.setChannelSolo?.(channelId, false);
          mixer?.setChannelMute?.(channelId, false);
        });
    } catch {}
  }
  syncMixerChannelVisibility();
  updateFractionAddButton(); // "+" reapareix en treure, s'amaga en omplir
  if (persist) {
    saveOpt(slot.activeKey, slot.active ? '1' : '0');
  }
  if (refresh) {
    handleFractionLayoutChange();
  }
  return true;
}

// Estat del control +/−: "+" inactiu si ja hi ha les 3 fraccions; "−"
// inactiu si no en queda cap (zero fraccions = pulsos plans, legal).
function updateFractionAddButton() {
  const canAdd = fractionSlots.some((slot) => !slot.added);
  const canRemove = fractionSlots.some((slot) => slot.added);
  if (fractionAddButton) fractionAddButton.disabled = !canAdd;
  if (fractionRemoveButton) fractionRemoveButton.disabled = !canRemove;
}

// Afegeix el següent slot pendent (clic al "+"): el mostra i l'activa
// (setSlotActive ja gestiona added/--hidden i en recupera els valors,
// que el controller conserva entre amagar i tornar a mostrar).
function addNextFractionSlot() {
  const slot = fractionSlots.find((s) => !s.added);
  if (!slot) return;
  setSlotActive(slot, true, { persist: true, refresh: true });
}

// Treu l'última fracció visible (clic al "−"). El conjunt mostrat és sempre
// un prefix [F1,F2,F3], així que "l'última" és el slot afegit d'índex més alt.
function removeLastFractionSlot() {
  const slot = [...fractionSlots].reverse().find((s) => s.added);
  if (!slot) return;
  setSlotActive(slot, false, { persist: true, refresh: true });
}

function refreshFractionUI(options = {}) {
  let firstActiveInfo = null;
  fractionSlots.forEach((slot) => {
    if (!slot.controller) return;
    const info = slot.controller.refresh(options);
    slot.info = info || createEmptyFractionInfo();
    if (!firstActiveInfo && slot.added && slot.active
      && isValidFractionPair(slot.controller.getFraction())) {
      firstActiveInfo = slot.info;
    }
  });
  currentFractionInfo = firstActiveInfo || createEmptyFractionInfo();
  return currentFractionInfo;
}

function createSlotFractionEditor(slot, host) {
  return createFractionEditor({
    mode: 'block',
    host,
    defaults: fractionDefaults,
    startEmpty: true,
    // Reducció automàtica a la fracció mínima (ex. 6/4 → 3/2), com la resta
    // d'apps de fraccions, però SENSE el DOM fantasma de preview: amb
    // autoReduce el ghost mai es mostra i només seria codi mort.
    autoReduce: true,
    enableGhost: false,
    // App4 té 3 editors alhora i els anells/panell ⓘ ja expliquen la
    // matemàtica: la bombolla persistent "Fracción simple" seria soroll.
    enableSimpleFractionTooltip: false,
    // Rangs del model F3: n ∈ [1,7], d ∈ [1,12]
    maxNumerator: 7,
    maxDenominator: 12,
    storage: {
      load: loadOpt,
      save: saveOpt,
      clear: clearOpt,
      numeratorKey: slot.numeratorKey,
      denominatorKey: slot.denominatorKey
    },
    addRepeatPress,
    applyMenuBackground: applyFractionInfoBackground,
    labels: {
      numerator: {
        placeholder: 'n',
        ariaUp: `Incrementar numerador ${slot.label}`,
        ariaDown: `Decrementar numerador ${slot.label}`
      },
      denominator: {
        placeholder: 'd',
        ariaUp: `Incrementar denominador ${slot.label}`,
        ariaDown: `Decrementar denominador ${slot.label}`
      }
    },
    onChange: (payload) => handleSlotFractionChange(slot, payload)
  });
}

function initFractionSlots() {
  // F2/F3: la fila de fraccions s'allotja a `.middle` (patró App28), que
  // arriba buit del template gràcies a `noMiddleSlot: true`.
  const middle = document.querySelector('.middle');
  if (!middle) return;

  const row = document.createElement('div');
  row.className = 'fraction-row';
  middle.appendChild(row);

  // Viewport amb scroll horitzontal (el +/− queda FORA, fix a la dreta) +
  // grup centrat de fraccions. Quan, en pantalla petita, les fraccions ja
  // no caben amb la seva mida mínima, apareix scroll en lloc d'encongir-les.
  const fractionScroll = document.createElement('div');
  fractionScroll.className = 'fraction-scroll';
  const fractionGroup = document.createElement('div');
  fractionGroup.className = 'fraction-group';
  fractionScroll.appendChild(fractionGroup);
  row.appendChild(fractionScroll);

  FRACTION_SLOT_DEFS.forEach((def) => {
    // L'estat "afegit"/actiu es deriva ABANS de crear l'editor: amb
    // startEmpty l'editor neteja les claus n/d guardades en inicialitzar-se.
    // Model treure/afegir: una fracció és visible (added ≡ active) o no hi és.
    //  - '1' → visible; '0' → treta explícitament (encara que tingui valors);
    //  - null (primera càrrega / legacy) → f1 i les que tinguin valors desats.
    const storedActive = loadOpt(def.activeKey);
    const hasStoredValues = loadOpt(def.numeratorKey) != null || loadOpt(def.denominatorKey) != null;
    let shown;
    if (storedActive === '1') shown = true;
    else if (storedActive === '0') shown = false;
    else shown = def.defaultActive || hasStoredValues;
    const added = shown;
    const active = shown;

    const slotEl = document.createElement('div');
    slotEl.className = `fraction-slot fraction-slot--${def.id}`;
    if (!shown) slotEl.classList.add('fraction-slot--hidden');

    // Sense botó "A" per slot: afegir/treure es fa amb el control +/− global.
    const toggleBtn = null;

    const editorHost = document.createElement('div');
    editorHost.className = 'fraction-slot__editor';
    slotEl.appendChild(editorHost);
    fractionGroup.appendChild(slotEl);

    const slot = {
      id: def.id,
      label: def.label,
      ringColor: def.ringColor,
      ringLightColor: def.ringLightColor,
      numeratorKey: def.numeratorKey,
      denominatorKey: def.denominatorKey,
      activeKey: def.activeKey,
      controller: null,
      active,
      added,
      info: createEmptyFractionInfo(),
      lastValid: { numerator: null, denominator: null },
      elements: { slotEl, toggleBtn, editorHost }
    };
    fractionSlots.push(slot);

    slot.controller = createSlotFractionEditor(slot, editorHost);
  });

  // Control +/− global, fixat a la dreta de la fila: "+" (meitat superior)
  // afegeix la fracció següent; "−" (meitat inferior) treu l'última.
  const addRemove = document.createElement('div');
  addRemove.className = 'fraction-addremove';

  fractionAddButton = document.createElement('button');
  fractionAddButton.type = 'button';
  fractionAddButton.className = 'fraction-add';
  fractionAddButton.setAttribute('aria-label', 'Añadir fracción');
  fractionAddButton.textContent = '+';
  fractionAddButton.addEventListener('click', addNextFractionSlot);
  attachHover(fractionAddButton, { text: 'Añadir otra fracción' });

  fractionRemoveButton = document.createElement('button');
  fractionRemoveButton.type = 'button';
  fractionRemoveButton.className = 'fraction-remove';
  fractionRemoveButton.setAttribute('aria-label', 'Quitar fracción');
  fractionRemoveButton.textContent = '−';
  fractionRemoveButton.addEventListener('click', removeLastFractionSlot);
  attachHover(fractionRemoveButton, { text: 'Quitar la última fracción' });

  addRemove.append(fractionAddButton, fractionRemoveButton);
  row.appendChild(addRemove);
  updateFractionAddButton();
  syncMixerChannelVisibility();

  // La fila de fraccions iguala l'amplada de la franja de pastilles
  // (.inputs: Cicles · Lg · BPM) que té a sobre, mesurant l'abast real dels
  // seus fills (de la pastilla més a l'esquerra a la més a la dreta) i
  // centrant-la igual. Així queden alineades i el +/− cau a la vora dreta.
  setupFractionRowWidthSync(row);

  lastActiveFractionsSignature = activeFractionsSignature();
  refreshFractionUI({ reveal: false });
}

function setupFractionRowWidthSync(row) {
  const inputs = document.querySelector('.inputs');
  if (!inputs || !row) return;

  const sync = () => {
    const children = Array.from(inputs.children)
      .filter((el) => el.offsetParent !== null);
    if (!children.length) return;
    let min = Infinity;
    let max = -Infinity;
    children.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0) return;
      min = Math.min(min, r.left);
      max = Math.max(max, r.right);
    });
    const width = max - min;
    if (Number.isFinite(width) && width > 0) {
      row.style.maxWidth = `${Math.round(width)}px`;
    }
  };

  sync();
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => sync());
    ro.observe(inputs);
  }
  window.addEventListener('resize', sync);
}

// ─── Pill "Cicles" (m) + Lg calculat ───────────────────────────────────────
let inputCycles = null;
let cyclesValue = (() => {
  const stored = parseIntSafe(loadOpt(CYCLES_KEY));
  return Number.isFinite(stored) && stored > 0 ? Math.min(stored, MAX_LG) : DEFAULT_CYCLES;
})();

// Recalcula Lg = cicle gran × m, re-clampa m si el cicle gran ha crescut i
// actualitza el camp Lg (readonly). Tota la resta de l'app segueix llegint
// parseIntSafe(inputLg.value) com sempre.
function recomputeLg({ dispatch = true } = {}) {
  const bigCycle = computeBigCycle();
  const mMax = Math.max(1, Math.floor(MAX_LG / bigCycle));
  if (cyclesValue > mMax) {
    cyclesValue = mMax;
    saveOpt(CYCLES_KEY, String(cyclesValue));
  }
  if (inputCycles) {
    inputCycles.max = String(mMax);
    if (inputCycles.value !== String(cyclesValue)) {
      inputCycles.value = String(cyclesValue);
    }
  }
  const lg = bigCycle * cyclesValue;
  if (inputLg.value !== String(lg)) {
    inputLg.value = String(lg);
  }
  if (dispatch) {
    handleInput();
  }
}

function setCycles(value) {
  const parsed = parseIntSafe(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return;
  const mMax = Math.max(1, Math.floor(MAX_LG / computeBigCycle()));
  cyclesValue = Math.min(Math.max(1, parsed), mMax);
  saveOpt(CYCLES_KEY, String(cyclesValue));
  recomputeLg();
}

// Model Pulsos/Ciclos. El pill editable mostra els PULSOS (Lg) i el visor mostra
// els CICLES complets (m = Lg / cicle gran = quantes vegades coincideixen totes
// les fraccions amb el pols). Per preservar `inputLg.value === Lg` (que tota
// l'app llegeix), NO intercanviem els valors dels elements: l'element Lg passa a
// ser el pill EDITABLE "Pulsos" (manté .value=Lg) i un clon readonly fa de visor
// "Ciclos" (inputCycles, .value=m). recomputeLg ja escriu Lg a inputLg i m a
// inputCycles, així que no cal tocar-lo.
function initCyclesParam() {
  const lgParam = document.querySelector('.inputs .param.lg');
  if (!lgParam || !inputLg) return;

  // ── Visor "Ciclos" (readonly, sense spinner) — clon de l'Lg per heretar pill ──
  const cyclesParam = lgParam.cloneNode(true);
  cyclesParam.classList.remove('lg');
  cyclesParam.classList.add('cycles');
  const abbr = cyclesParam.querySelector('.abbr');
  if (abbr) abbr.textContent = 'Ciclos';
  const unit = cyclesParam.querySelector('.unit');
  if (unit) {
    unit.id = 'unitCycles';
    unit.textContent = 'Ciclos';
  }
  cyclesParam.querySelectorAll('.led').forEach((el) => el.remove());
  const cInput = cyclesParam.querySelector('input');
  cInput.id = 'inputCycles';
  cInput.readOnly = true;
  cInput.dataset.auto = '1';
  cInput.value = String(cyclesValue);
  // Visor sense spinner (el tema el vesteix com a pill buida).
  cyclesParam.querySelector('.spinner')?.remove();
  // Ordre: Pulsos (Lg) · Ciclos · BPM → inserim el visor DESPRÉS de l'Lg.
  lgParam.parentElement.insertBefore(cyclesParam, lgParam.nextSibling);
  inputCycles = cInput;
  attachHover(cInput, { text: 'Ciclos completos: cuántas veces coinciden todas las fracciones con el pulso' });

  // ── Pill editable "Pulsos" (= l'antic camp Lg, .value = Lg = pulsos) ──
  const lgAbbr = lgParam.querySelector('.abbr');
  if (lgAbbr) lgAbbr.textContent = 'Pulsos';
  if (unitLg) unitLg.textContent = 'Pulsos';
  inputLg.readOnly = false;
  delete inputLg.dataset.auto;
  // Escriure pulsos → m = round(pulsos / cicle gran) (els cicles han de ser
  // complets); recomputeLg ajusta Lg al múltiple més proper.
  inputLg.addEventListener('input', () => {
    const parsed = parseIntSafe(inputLg.value);
    if (!Number.isFinite(parsed) || parsed <= 0) return; // espera valor vàlid
    const bc = computeBigCycle();
    setCycles(Math.max(1, Math.round(parsed / Math.max(1, bc))));
  });
  inputLg.addEventListener('blur', () => {
    const lg = computeBigCycle() * cyclesValue;
    if (inputLg.value !== String(lg)) inputLg.value = String(lg);
  });
  // El +/- afegeix/treu un CICLE complet (Lg salta de cicle gran en cicle gran).
  if (inputLgUp) {
    inputLgUp.disabled = false;
    inputLgUp.setAttribute('aria-label', 'Más pulsos (un ciclo)');
    addRepeatPress(inputLgUp, () => setCycles(cyclesValue + 1));
  }
  if (inputLgDown) {
    inputLgDown.disabled = false;
    inputLgDown.setAttribute('aria-label', 'Menos pulsos (un ciclo)');
    addRepeatPress(inputLgDown, () => setCycles(cyclesValue - 1));
  }
  attachHover(inputLg, { text: 'Número de pulsos (Lg). Cada paso añade/quita un ciclo completo.' });
}

function ensurePulseMemory(size) {
  pulseMemoryApi.ensure(size);
}

function fractionValue(base, numerator, denominator) {
  return computeFractionValue(base, numerator, denominator);
}

function fractionDisplay(base, numerator, denominator, override = {}) {
  return formatFractionDisplay(base, numerator, denominator, override);
}

function rebuildFractionSelections(opts = {}) {
  // F5: sense marcadors de timeline — el mòdul només reordena el store;
  // la representació visual la posen els anells al proper renderRings().
  const selections = rebuildFractionSelectionsModule(fractionStore, {
    skipUpdateField: opts.skipUpdateField
  });
  fractionStore.pulseSelections = selections;
  syncFractionMemoryWithSelections();
  renderNotationIfVisible();
  return selections;
}

function setFractionSelected(info, shouldSelect) {
  setFractionSelectedModule(fractionStore, info, shouldSelect, {});
  if (isPlaying && audio) {
    applySelectionToAudio();
  }
  renderRings();
}

function computeAudioSchedulingState() {
  const lg = parseInt(inputLg.value);
  const v = parseFloat(inputV.value);
  // F4: la primera fracció activa sona pel camí de cicle LEGACY (pre-agenda
  // + missatges 'cycle' del worklet alineats a la mesura); la resta
  // d'actives sonen com a VEUS polirítmiques amb canal de mixer propi.
  // Cada slot surt sempre pel seu canal fracN.
  const activeFractions = getActiveFractions();
  const firstActive = activeFractions[0] || null;
  const { numerator, denominator } = getFraction();

  const validLg = Number.isFinite(lg) && lg > 0;
  const validV = Number.isFinite(v) && v > 0;

  const grid = gridFromOrigin({ lg: validLg ? lg : 0, numerator, denominator });
  const denominators = new Set([1]);
  fractionStore.pulseSelections.forEach((item) => {
    if (!item) return;
    const den = Number(item.denominator);
    if (Number.isFinite(den) && den > 0) {
      denominators.add(Math.round(den));
    }
  });

  const hasCycle = Boolean(
    validLg
    && Number.isFinite(numerator)
    && Number.isFinite(denominator)
    && numerator > 0
    && denominator > 0
    && Math.floor(lg / numerator) > 0
  );

  if (hasCycle) {
    denominators.add(Math.round(denominator));
  }

  let resolution = 1;
  denominators.forEach((den) => {
    resolution = Math.max(1, Math.round(lcm(resolution, Math.max(1, den))));
  });

  // F5: bucle permanent — el playback sempre cicla (totalPulses = lg).
  const playbackTotal = validLg ? toPlaybackPulseCount(lg, true) : null;
  const totalPulses = playbackTotal != null ? playbackTotal : null;
  const interval = validV ? (60 / v) : null;
  const patternBeats = validLg ? lg : null;

  const cycleNumerator = hasCycle ? numerator : null;
  const cycleDenominator = hasCycle ? denominator : null;
  // F5: sense onTick — els highlights ja no van pels missatges 'cycle' del
  // worklet sinó per la posició del visual-sync (rings.highlightPosition).
  const cycleConfig = hasCycle
    ? { numerator: cycleNumerator, denominator: cycleDenominator }
    : null;

  // Canal de mixer de la fracció principal (re-apunta el bus de cicle del
  // motor); null = cap fracció activa → el motor manté 'subdivision'.
  const cycleChannel = firstActive ? fractionChannelForSlot(firstActive.id) : null;

  // Veus: una per fracció activa MENYS la primera (que ja és el cicle).
  // n/d en RAW, no reduïts: el període n/d és idèntic, però l'índex de tick
  // del worklet només mapeja 1:1 amb la graella cicle × denominador (la
  // dels anells) si d és el d original.
  const voices = [];
  if (validLg) {
    activeFractions.slice(1).forEach((fraction) => {
      // Mateixa guarda que hasCycle: si el cicle (raw) no cap dins Lg, la
      // fracció no genera so (paritat amb el comportament de la principal).
      if (Math.floor(lg / fraction.numerator) <= 0) return;
      voices.push({
        id: `frac-${fraction.id}`,
        numerator: fraction.numerator,
        denominator: fraction.denominator,
        channel: fractionChannelForSlot(fraction.id)
      });
    });
  }

  return {
    resolution,
    totalPulses,
    interval,
    patternBeats,
    cycleConfig,
    cycleChannel,
    voices,
    // F4b: les fraccions actives (id de slot + n/d raw) també les consumeix
    // selectedForAudioFromState per etiquetar cada selecció fraccionada amb
    // el canal fracSelN del seu slot.
    activeFractions,
    validLg,
    validV,
    grid,
    lg
  };
}

// --- Selecció viva per a l'àudio (filtrada: sense 0 ni lg) ---
function selectedForAudioFromState({ scheduling } = {}) {
  const state = scheduling || computeAudioSchedulingState();
  const scale = Number.isFinite(state?.resolution) && state.resolution > 0
    ? Math.max(1, Math.round(state.resolution))
    : 1;
  const lg = Number.isFinite(state?.lg) ? state.lg : parseInt(inputLg.value);
  const baseSet = new Set();
  const cycleSet = new Set();
  const fractionSet = new Set();
  const combinedSet = new Set();
  const audioSet = new Set();
  if (!Number.isFinite(lg) || lg <= 0) {
    return {
      base: baseSet,
      cycle: cycleSet,
      fraction: fractionSet,
      combined: combinedSet,
      resolution: scale,
      audio: audioSet
    };
  }
  // F4b: valor escalat → canal de mixer (null = canal global 'accent').
  // Es construeix com a Map per deduplicar: si dues seleccions cauen al
  // mateix índex de graella, la primera mana i el valor sona UN sol cop.
  const audioValueChannels = new Map();
  const activeFractions = Array.isArray(state?.activeFractions)
    ? state.activeFractions
    : getActiveFractions();
  const maxIdx = Math.min(lg, pulseMemory.length - 1);
  for (let i = 1; i <= maxIdx; i++) {
    if (pulseMemory[i]) {
      baseSet.add(i);
      const scaled = i * scale;
      combinedSet.add(scaled);
      audioValueChannels.set(scaled, null);
    }
  }
  const epsilon = 1e-6;
  if (state?.grid?.subdivisions?.length) {
    state.grid.subdivisions.forEach((subdivision) => {
      const pos = Number(subdivision?.position);
      if (!Number.isFinite(pos) || pos <= 0 || pos >= lg) return;
      cycleSet.add(pos);
      const scaled = Math.round(pos * scale);
      if (Math.abs(scaled / scale - pos) <= epsilon) {
        combinedSet.add(scaled);
      }
    });
  }
  fractionStore.pulseSelections.forEach((item) => {
    if (!item || !Number.isFinite(item.value)) return;
    if (item.value <= 0 || item.value >= lg) return;
    fractionSet.add(item.value);
    const scaled = Math.round(item.value * scale);
    if (Math.abs(scaled / scale - item.value) <= epsilon) {
      combinedSet.add(scaled);
      // F4b: etiqueta la selecció amb el canal fracSelN del seu slot
      // (selectionChannelForFraction); sense slot actiu → 'accent' legacy.
      if (!audioValueChannels.has(scaled)) {
        audioValueChannels.set(scaled, selectionChannelForFraction(item, activeFractions));
      }
    }
  });
  // Els sencers viatgen com a números legacy ('accent'); els fraccionats
  // amb slot, com a objectes { value, channel } que el motor enruta al bus
  // del canal (vegeu normalizeSelection a libs/sound/index.js).
  audioValueChannels.forEach((channel, value) => {
    audioSet.add(channel ? { value, channel } : value);
  });
  return {
    base: baseSet,
    cycle: cycleSet,
    fraction: fractionSet,
    combined: combinedSet,
    resolution: scale,
    audio: audioSet
  };
}

function applySelectionToAudio({ scheduling, instance } = {}) {
  const target = instance || audio;
  if (!target || typeof target.setSelected !== 'function') return null;
  const selection = selectedForAudioFromState({ scheduling });
  const audioValues = selection.audio ?? selection.combined;
  const resolvedSelectionResolution = Number.isFinite(selection?.resolution)
    ? Math.max(1, Math.round(selection.resolution))
    : 1;
  // Enviamos pasos escalados directamente (resolución 1) para que TimelineAudio
  // compare índices absolutos sin aplicar un segundo factor de escala.
  target.setSelected({ values: audioValues, resolution: 1 });
  const schedulingResolution = Number.isFinite(scheduling?.resolution)
    ? Math.max(1, Math.round(scheduling.resolution))
    : resolvedSelectionResolution;
  currentAudioResolution = Math.max(resolvedSelectionResolution, schedulingResolution);
  return selection;
}

let isPlaying = false;
// P-03 (adaptat): últim Lg dibuixat als anells des de handleInput
let lastRenderedLg = null;
let isUpdating = false;     // evita bucles de 'input' reentrants

// ───────────────────────────────────────────────────────────────────────────
// F5: render dels anells concèntrics
//
// Decisions (F5b):
// - El punt 0 de l'anell base és l'ORIGEN del cicle: amb bucle permanent la
//   posició Lg ÉS la posició 0 — no existeix cap punt Lg separat. Es marca
//   com a endpoint (estil propi) i NO és seleccionable, com l'antic pols 0.
// - TOTS els enters 1..Lg-1 són seleccionables: la regla
//   isIntegerPulseSelectable era un artefacte de la línia de temps (que
//   només mostrava la graella d'UNA fracció); als anells els enters
//   pertanyen a l'anell base, independent de les fraccions. Sonen pel canal
//   global 'accent' com sempre.
// - Als anells de fracció, els ticks que coincideixen amb un pols enter
//   (k·n/d enter, el 0 inclòs) NO són seleccionables: el model de selecció
//   fraccionada (makeFractionKey) exigeix 0 < num < d per construcció, i
//   aquell instant ja és seleccionable a l'anell base. Es mostren atenuats.
// ───────────────────────────────────────────────────────────────────────────

// Tick k d'un anell n/d en aritmètica entera: posició k·n/d = base + num/d
// (num = (k·n) mod d). num === 0 ⇒ el tick coincideix amb un pols enter.
function fractionTickParts(tickIndex, numerator, denominator) {
  const raw = tickIndex * numerator;
  return { base: Math.floor(raw / denominator), num: raw % denominator };
}

// Una selecció fraccionada pertany a la graella d'un slot actiu si el seu
// n/d LITERAL coincideix (mateixa regla que selectionChannelForFraction) i
// la posició cau en un tick k·n/d de l'anell (base·d + num divisible per n).
function selectionOnActiveGrid(item, actives) {
  if (!item) return false;
  const den = Number(item.denominator);
  const num = Number(item.numerator);
  const base = Number(item.base);
  if (!(Number.isFinite(den) && den > 0 && Number.isFinite(num) && Number.isFinite(base))) {
    return false;
  }
  const ppc = Number.isFinite(item.pulsesPerCycle) && item.pulsesPerCycle > 0
    ? Number(item.pulsesPerCycle)
    : null;
  const slot = actives.find((fraction) => fraction.denominator === den
    && (ppc == null || fraction.numerator === ppc));
  if (!slot) return false;
  return ((base * den + num) % slot.numerator) === 0;
}

// F5: substitueix la detecció d'invàlids del timeline-renderer — les
// seleccions que ja no cauen en cap anell actiu (o queden fora de Lg) se
// SUSPENEN a fractionMemory (no es perden); les suspeses que tornen a tenir
// anell es restauren. Mateixa semàntica que la memòria de fraccions antiga.
function reconcileFractionSelections() {
  const lg = parseIntSafe(inputLg.value);
  if (!Number.isFinite(lg) || lg <= 0) return;
  const actives = getActiveFractions();
  let changed = false;
  Array.from(fractionStore.selectionState.entries()).forEach(([key, item]) => {
    const valid = item && Number.isFinite(item.value)
      && item.value > 0 && item.value < lg
      && selectionOnActiveGrid(item, actives);
    if (!valid) {
      if (item) markFractionSuspended(item);
      fractionStore.selectionState.delete(key);
      changed = true;
    }
  });
  fractionMemory.forEach((entry) => {
    if (!entry || entry.suspended !== true) return;
    if (!(Number.isFinite(entry.value) && entry.value > 0 && entry.value < lg)) return;
    if (!selectionOnActiveGrid(entry, actives)) return;
    const { suspended, ...info } = entry;
    fractionStore.selectionState.set(entry.key, info);
    entry.suspended = false;
    changed = true;
  });
  if (changed) {
    rebuildFractionSelections({ skipUpdateField: true });
  }
}

// Re-render complet dels anells a partir de l'estat (Lg, fraccions actives,
// memòria de pulsos i seleccions fraccionades). És barat (un sol SVG) i és
// l'única via de refresc visual: selecció, fraccions i Lg hi conflueixen.
function renderRings() {
  const lg = parseIntSafe(inputLg.value);
  if (!Number.isFinite(lg) || lg <= 0) {
    lastRenderedLg = null;
    rings.render({ lg: 0 });
    return;
  }
  lastRenderedLg = lg;
  ensurePulseMemory(lg);
  reconcileFractionSelections();

  const actives = getActiveFractions();
  const bigCycle = computeBigCycle(actives);

  // Anell base: punt 0 = origen (endpoint, no seleccionable), resta segons
  // memòria persistent.
  const baseDots = [{ index: 0, selectable: false, isEndpoint: true }];
  for (let i = 1; i < lg; i++) {
    baseDots.push({ index: i, selected: i < pulseMemory.length && !!pulseMemory[i] });
  }

  const fractions = actives.map((fraction) => {
    const slot = fractionSlots.find((s) => s.id === fraction.id);
    // Sempre exacte: Lg és múltiple del cicle de cada fracció (model F3).
    const count = Math.round((lg * fraction.denominator) / fraction.numerator);
    const dots = [];
    for (let k = 0; k < count; k++) {
      const { base, num } = fractionTickParts(k, fraction.numerator, fraction.denominator);
      if (num === 0) {
        // Tick coincident amb un pols enter: no seleccionable (decisió F5b).
        dots.push({ tickIndex: k, position: base, selectable: false });
        continue;
      }
      const key = makeFractionKey(base, num, fraction.denominator);
      dots.push({
        tickIndex: k,
        position: base + num / fraction.denominator,
        selected: key != null && fractionStore.selectedFractionKeys.has(key)
      });
    }
    return {
      id: fraction.id,
      numerator: fraction.numerator,
      denominator: fraction.denominator,
      color: slot?.ringColor || '#43433B',
      lightColor: slot?.ringLightColor || '#eee8d8',
      // Accent de selecció UNIFICAT: verd nuzic a tots els anells (concepte
      // únic "seleccionat = verd", visible sobre qualsevol banda).
      accentColor: RING_SELECT_ACCENT,
      label: '', // sense etiqueta de text a l'anell (les caixes ja mostren n/d)
      dots
    };
  });

  // Cercle base sense etiqueta de text: els números al voltant ja indiquen
  // que és la graella de polsos (l'usuari va demanar treure el "Pulso").
  rings.render({
    lg, bigCycle,
    base: { label: '', dots: baseDots, accentColor: RING_SELECT_ACCENT },
    fractions
  });
  renderNotationIfVisible();
}

// Clic en un punt dels anells (payload del mòdul circular-rings).
function handleRingDotClick(info) {
  if (!info) return;
  if (info.type === 'int') {
    const lg = parseIntSafe(inputLg.value);
    if (!Number.isFinite(lg) || lg <= 0) return;
    ensurePulseMemory(lg);
    setPulseSelected(info.index, !pulseMemory[info.index]);
    return;
  }
  if (info.type === 'fraction') {
    const { base, num } = fractionTickParts(info.tickIndex, info.numerator, info.denominator);
    if (num === 0) return; // xarxa de seguretat: ticks enters no seleccionables
    // Constructor canònic del store (key, display, cicle...). pulsesPerCycle
    // = n del slot: el n/d LITERAL de la graella, que és el que
    // selectionChannelForFraction compara per enrutar el canal fracSelN.
    const selection = createFractionSelectionFromValue(base + num / info.denominator, {
      denominator: info.denominator,
      pulsesPerCycle: info.numerator
    });
    if (!selection) return;
    setFractionSelected(selection, !fractionStore.selectionState.has(selection.key));
  }
}

// Selecció determinista d'un pols enter (1..Lg-1). El 0 és l'origen del
// cicle i no hi ha punt Lg (bucle permanent: Lg ≡ 0).
function setPulseSelected(i, shouldSelect) {
  const lg = parseIntSafe(inputLg.value);
  if (!Number.isFinite(lg) || lg <= 0) return;
  if (!Number.isFinite(i) || i <= 0 || i >= lg) return;
  ensurePulseMemory(lg);
  pulseMemory[i] = !!shouldSelect;

  if (isPlaying && audio) {
    applySelectionToAudio();
  }

  renderRings();
}

function clearHighlights() {
  rings.clearHighlights();
}

// F5: adaptador d'highlights per al visual-sync (mode complet) — payload
// {step, resolution} del worklet → posició en pulsos = step/resolution,
// embolcallada amb % Lg (bucle permanent). highlightPosition il·lumina el
// punt vigent de CADA anell (floor(pos / pas d'anell)) i orienta l'agulla.
const ringsHighlightController = {
  highlightPulse(payload = {}) {
    const lg = parseIntSafe(inputLg.value);
    if (!Number.isFinite(lg) || lg <= 0) return;
    const step = Number(payload.step);
    if (!Number.isFinite(step)) return;
    const resolution = Number.isFinite(payload.resolution) && payload.resolution > 0
      ? Math.max(1, Math.round(payload.resolution))
      : Math.max(1, Math.round(currentAudioResolution || 1));
    const position = (((step / resolution) % lg) + lg) % lg;
    rings.highlightPosition(position);
  },
  // El cicle ja queda cobert per highlightPosition (cada anell deriva el seu
  // índex de la mateixa posició); els missatges 'cycle' del worklet no calen.
  highlightCycle() {},
  clearAll() {
    rings.clearHighlights();
  }
};

const visualSyncManager = createVisualSyncManager({
  getAudio: () => audio,
  getIsPlaying: () => isPlaying,
  getLoopEnabled: () => true, // F5: bucle permanent
  highlightController: ringsHighlightController,
  // F6: el controller de notació exposa updateCursor/resetCursor que ARA
  // fan fan-out a TOTS els pentagrames apilats (base + una per fracció).
  // Es retorna el controller sencer (abans el primer sub-renderer): així el
  // cursor avança alhora a tots els pentagrames durant el playback.
  getNotationRenderer: () => notationRendererController,
  onResolutionChange: (newResolution) => {
    currentAudioResolution = newResolution;
  }
});

initFractionSlots();
initCyclesParam();
// Lg passa a ser un valor CALCULAT (cicle gran × m): primer còmput sense
// disparar handleInput — el handleInput() inicial de més avall ja renderitza.
recomputeLg({ dispatch: false });

// El toggle global de "fracciones complejas" s'aplica als TRES editors.
function applyComplexModeToEditors(enabled) {
  fractionSlots.forEach((slot) => {
    if (!slot.controller) return;
    if (enabled) {
      slot.controller.setComplexMode();
    } else {
      slot.controller.setSimpleMode();
    }
  });
}

// App4 és una app de fraccions complexes per naturalesa: el numerador
// sempre és editable. No hi ha toggle d'usuari (showComplexFractions: false
// al template) i s'ignora qualsevol valor antic de localStorage.
function initComplexFractionsState() {
  applyComplexModeToEditors(true);
  updateRandomMenuComplexState(true);
}

function updateRandomMenuComplexState(enabled) {
  const randNToggle = document.getElementById('randNToggle');
  const randNMin = document.getElementById('randNMin');
  const randNMax = document.getElementById('randNMax');

  if (!randNToggle) return;

  if (enabled) {
    // Habilitar controles de numerador
    randNToggle.disabled = false;
    randNToggle.style.opacity = '1';
    randNToggle.title = '';
    if (randNMin) randNMin.disabled = false;
    if (randNMax) randNMax.disabled = false;
  } else {
    // Deshabilitar controles de numerador
    randNToggle.disabled = true;
    randNToggle.checked = false;
    randNToggle.style.opacity = '0.5';
    randNToggle.title = 'Activar fracciones complejas en Opciones para habilitar';
    if (randNMin) randNMin.disabled = true;
    if (randNMax) randNMax.disabled = true;
  }
}

// Escuchar cambios de "Activar fracciones complejas"
window.addEventListener('sharedui:complexfractions', (e) => {
  const enabled = e.detail.value;

  // Aplicar als tres editors de fracció
  applyComplexModeToEditors(enabled);

  // Actualizar estado del toggle de numerador en random menu
  updateRandomMenuComplexState(enabled);

  // Re-renderitzar els anells si cal
  renderRings();
});

// Inicializar estado de fracciones complejas después de que todos los componentes estén listos
initComplexFractionsState();

// Hovers for LEDs and controls
attachHover(playBtn, { text: 'Play / Stop' });
attachHover(tapBtn, { text: 'Tap Tempo' });
attachHover(resetBtn, { text: 'Reset App' });
attachHover(notationToggleBtn, { text: 'Mostrar/ocultar partitura' });
attachHover(randomBtn, { text: 'Aleatorizar parámetros' });
attachHover(randLgToggle, { text: 'Aleatorizar ciclos' });
attachHover(randLgMin, { text: 'Mínimo de ciclos' });
attachHover(randLgMax, { text: 'Máximo de ciclos' });
attachHover(randVToggle, { text: 'Aleatorizar V' });
attachHover(randVMin, { text: 'Mínimo V' });
attachHover(randVMax, { text: 'Máximo V' });
attachHover(randPulsesToggle, { text: 'Aleatorizar pulsos' });
attachHover(randomCount, { text: 'Cantidad de pulsos a seleccionar (vacío = aleatorio, 0 = ninguno)' });
attachHover(randNToggle, { text: 'Aleatorizar numerador' });
attachHover(randNMin, { text: 'Mínimo numerador' });
attachHover(randNMax, { text: 'Máximo numerador' });
attachHover(randDToggle, { text: 'Aleatorizar denominador' });
attachHover(randDMin, { text: 'Mínimo denominador' });
attachHover(randDMax, { text: 'Máximo denominador' });
attachHover(randComplexToggle, { text: 'Permitir fracciones complejas' });
if (pulseToggleBtn) attachHover(pulseToggleBtn, { text: 'Activar o silenciar el pulso' });
if (selectedToggleBtn) attachHover(selectedToggleBtn, { text: 'Activar o silenciar la selección' });
if (cycleToggleBtn) attachHover(cycleToggleBtn, { text: 'Activar o silenciar las fracciones' });


const PULSE_AUDIO_KEY = 'pulseAudio';
const SELECTED_AUDIO_KEY = 'selectedAudio';
const CYCLE_AUDIO_KEY = 'cycleAudio';

let pulseToggleController = null;
let selectedToggleController = null;
let cycleToggleController = null;

const soloMutedChannels = new Set();
let lastSoloActive = false;

const audioToggleManager = initAudioToggles({
  toggles: [
    {
      id: 'pulse',
      button: pulseToggleBtn,
      storageKey: PULSE_AUDIO_KEY,
      mixerChannel: 'pulse',
      defaultEnabled: true,
      onChange: (enabled) => {
        if (audio && typeof audio.setPulseEnabled === 'function') {
          audio.setPulseEnabled(enabled);
        }
      }
    },
    {
      id: 'accent',
      button: selectedToggleBtn,
      storageKey: SELECTED_AUDIO_KEY,
      defaultEnabled: true,
      // F4b: el toggle "Seleccionado" del header governa TOTA la selecció
      // com a GRUP — el canal global 'accent' (pulsos sencers) + els tres
      // fracSelN (pulsos fraccionats per slot) — mirall del que fa el
      // toggle de fraccions amb frac1/2/3. Source 'mixer' s'ignora pel
      // mateix motiu: el menú governa canals individuals i no s'ha de
      // col·lapsar el seu estat fi.
      onChange: (enabled, { source } = {}) => {
        if (source === 'mixer') return;
        SELECTED_GROUP_CHANNEL_IDS.forEach((id) => globalMixer.setChannelMute(id, !enabled));
      }
    },
    {
      id: 'cycle',
      button: cycleToggleBtn,
      storageKey: CYCLE_AUDIO_KEY,
      defaultEnabled: true,
      // F4: el toggle "Subdivisión" del header governa TOTES les fraccions
      // — silencia els tres canals fracN (cicle de la principal + veus).
      // Amb source 'mixer' no es re-empeny res: el menú del mixer governa
      // canals individuals i no s'ha de col·lapsar el seu estat fi.
      onChange: (enabled, { source } = {}) => {
        if (source === 'mixer') return;
        FRACTION_CHANNEL_IDS.forEach((id) => globalMixer.setChannelMute(id, !enabled));
      }
    }
  ],
  storage: {
    load: loadOpt,
    save: saveOpt
  },
  mixer: globalMixer,
  subscribeMixer,
  onMixerSnapshot: ({ snapshot, channels, setFromMixer, getState }) => {
    if (!snapshot || !Array.isArray(snapshot.channels)) return;
    const soloActive = snapshot.channels.some((channel) => channel.solo);
    const channelPairs = [
      ['pulse', 'pulse']
    ];
    const toggleByChannel = new Map(channelPairs.map(([toggleId, channelId]) => [channelId, toggleId]));
    // F4/F4b: els toggles 'cycle' i 'accent' espellegen GRUPS de canals;
    // entrades sintètiques al set de solo-mute perquè la restauració final
    // els trobi.
    const FRACTION_GROUP_KEY = 'fracGroup';
    const SELECTED_GROUP_KEY = 'selGroup';
    toggleByChannel.set(FRACTION_GROUP_KEY, 'cycle');
    toggleByChannel.set(SELECTED_GROUP_KEY, 'accent');

    channelPairs.forEach(([toggleId, channelId]) => {
      const channelState = channels.get(channelId);
      if (!channelState) return;
      const forcedBySolo = soloActive && !channelState.solo && channelState.effectiveMuted && !channelState.muted;
      if (forcedBySolo) {
        if (!soloMutedChannels.has(channelId)) {
          soloMutedChannels.add(channelId);
          setFromMixer(toggleId, false);
        }
        return;
      }

      if (!soloActive && soloMutedChannels.has(channelId)) {
        soloMutedChannels.delete(channelId);
        setFromMixer(toggleId, true);
        return;
      }

      if (soloActive && soloMutedChannels.has(channelId)) {
        return;
      }

      const shouldEnable = !channelState.muted;
      if (getState(toggleId) === shouldEnable) return;
      setFromMixer(toggleId, shouldEnable);
    });

    // F4/F4b: grups de canals → toggle. Encès si ALGUN canal del grup no
    // està mutat manualment; un solo aliè que els força tots el posa OFF
    // transitòriament (sense persistir), com el camí per-canal de dalt.
    const syncGroupToggle = (groupKey, toggleId, channelIds) => {
      const states = channelIds
        .map((channelId) => channels.get(channelId))
        .filter(Boolean);
      if (!states.length) return;
      const forcedBySolo = soloActive
        && states.every((ch) => !ch.solo && ch.effectiveMuted && !ch.muted);
      if (forcedBySolo) {
        if (!soloMutedChannels.has(groupKey)) {
          soloMutedChannels.add(groupKey);
          setFromMixer(toggleId, false);
        }
      } else if (!soloActive && soloMutedChannels.has(groupKey)) {
        soloMutedChannels.delete(groupKey);
        setFromMixer(toggleId, true);
      } else if (!(soloActive && soloMutedChannels.has(groupKey))) {
        const shouldEnable = states.some((ch) => !ch.muted);
        if (getState(toggleId) !== shouldEnable) {
          setFromMixer(toggleId, shouldEnable);
        }
      }
    };
    // 'cycle' = metrònoms de fracció (frac1/2/3); 'accent' = tota la
    // selecció (accent global + fracSel1/2/3).
    syncGroupToggle(FRACTION_GROUP_KEY, 'cycle', FRACTION_CHANNEL_IDS);
    syncGroupToggle(SELECTED_GROUP_KEY, 'accent', SELECTED_GROUP_CHANNEL_IDS);

    if (!soloActive && lastSoloActive && soloMutedChannels.size) {
      soloMutedChannels.forEach((channelId) => {
        const toggleId = toggleByChannel.get(channelId);
        if (toggleId) setFromMixer(toggleId, true);
      });
      soloMutedChannels.clear();
    }

    lastSoloActive = soloActive;
  }
});

pulseToggleController = audioToggleManager.get('pulse') ?? null;
selectedToggleController = audioToggleManager.get('accent') ?? null;
cycleToggleController = audioToggleManager.get('cycle') ?? null;

function setPulseAudio(value, options) {
  pulseToggleController?.set(value, options);
}

function setSelectedAudio(value, options) {
  selectedToggleController?.set(value, options);
}

function setCycleAudio(value, options) {
  cycleToggleController?.set(value, options);
}

const storedColor = loadOpt('color');
if (storedColor) {
  selectColor.value = storedColor;
  document.documentElement.style.setProperty('--selection-color', storedColor);
}
selectColor.addEventListener('input', e => {
  document.documentElement.style.setProperty('--selection-color', e.target.value);
  saveOpt('color', e.target.value);
});

if (resetBtn) {
  resetBtn.addEventListener('click', () => {
    pulseMemoryApi.clear();
    // F3: torna a l'estat F1-only — fora valors i flags d'actiu dels tres
    // slots (F2/F3 desapareixen, F1 queda buida) i m torna al valor de fàbrica.
    fractionSlots.forEach((slot) => {
      clearOpt(slot.numeratorKey);
      clearOpt(slot.denominatorKey);
      clearOpt(slot.activeKey);
    });
    clearOpt(CYCLES_KEY);
    clearOpt(BPM_KEY); // torna a DEFAULT_BPM (90) a la propera càrrega
    sessionStorage.setItem('volumeResetFlag', 'true');
    window.location.reload();
  });
}

async function handleTapTempo() {
  try {
    const audioInstance = await initAudio();
    const result = audioInstance.tapTempo(performance.now());
    if (!result) return;

    if (result.remaining > 0) {
      tapHelp.textContent = result.remaining === 2 ? '2 clicks más' : '1 click más solamente';
      // Ancorat al centre del botó tap (offsetParent = .controls, que és
      // position: relative pel tema nuzic); el CSS centra amb translateX.
      if (tapBtn) tapHelp.style.left = `${tapBtn.offsetLeft + tapBtn.offsetWidth / 2}px`;
      tapHelp.style.display = 'block';
      return;
    }

    tapHelp.style.display = 'none';
    if (Number.isFinite(result.bpm) && result.bpm > 0) {
      // El camp BPM mostra 1 decimal com a màxim
      const bpm = Math.round(result.bpm * 10) / 10;
      setValue(inputV, bpm);
      handleInput({ target: inputV });
    }
  } catch (error) {
    console.warn('Tap tempo failed', error);
  }
}

if (tapBtn) {
  tapBtn.addEventListener('click', () => { handleTapTempo(); });
}

if (tapHelp) {
  tapHelp.textContent = 'Se necesitan 3 clicks';
  tapHelp.style.display = 'none';
}

// --- Aleatorización de parámetros y pulsos ---
/**
 * F3: aleatorització adaptada al model multi-fracció.
 * - n/d: cada fracció ACTIVA rep valors independents (n∈[1,7], d∈[1,12]);
 *   si la combinació hipotètica supera MAX_LG es re-tira (màx. 20 intents,
 *   fallback n=1) — inassolible amb n≤7, però la xarxa de seguretat hi és.
 * - La fila "Cicles" (ids randLg* conservats) aleatoritza m; Lg es deriva.
 * - V i Pulsos segueixen passant per randomizeFractional (Lg/n/d
 *   desactivats: ja s'han gestionat aquí).
 * - Els pulsos aleatoris encenen punts a l'atzar sobre TOTS els anells: enters
 *   1..Lg-1 a pulseMemory (via randomizeFractional) + ticks de subdivisió de
 *   cada fracció activa (via applyRandomRingFractionSelection).
 */
// Tria un subconjunt aleatori d'un pool segons el comptador del menú "Pulsos":
// buit → densitat 0.5; enter N>0 → N ítems sense repetir; altrament → res.
function pickRandomSubset(pool, rawCount) {
  const trimmed = typeof rawCount === 'string' ? rawCount.trim() : '';
  const out = [];
  const n = trimmed === '' ? NaN : Number.parseInt(trimmed, 10);
  if (trimmed === '' || Number.isNaN(n)) {
    pool.forEach((item) => { if (Math.random() < 0.5) out.push(item); });
    return out;
  }
  if (n <= 0) return out;
  const copy = [...pool];
  const target = Math.min(n, copy.length);
  while (out.length < target && copy.length) {
    out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  return out;
}

// Selecció aleatòria de ticks FRACCIONATS sobre la graella dels anells actius
// (substitueix l'antiga applyRandomFractionSelection basada en el hitMap de DOM
// de l'App4 lineal, inexistent als anells). El store ja ve netejat per
// randomizeFractional; aquí l'omplim amb seleccions construïdes EXACTAMENT com
// les d'un clic d'anell (createFractionSelectionFromValue) perquè comparteixin
// clau i sincronitzin amb anells, partitura i àudio. rebuildFractionSelections
// (a onPulsesChange) normalitza després.
function applyRandomRingFractionSelection(store, { lg, randomCountValue } = {}) {
  if (!store || !store.selectionState) return false;
  store.selectionState.clear();
  if (!Number.isFinite(lg) || lg <= 0) return false;
  const actives = getActiveFractions();
  if (!actives.length) return false;
  const candidates = [];
  const seen = new Set();
  actives.forEach((fraction) => {
    const count = Math.round((lg * fraction.denominator) / fraction.numerator);
    for (let k = 0; k < count; k++) {
      const { base, num } = fractionTickParts(k, fraction.numerator, fraction.denominator);
      if (num === 0) continue; // tick coincident amb enter → no és fraccionat
      const selection = createFractionSelectionFromValue(base + num / fraction.denominator, {
        denominator: fraction.denominator,
        pulsesPerCycle: fraction.numerator
      });
      if (!selection || seen.has(selection.key)) continue;
      if (selection.value <= 0 || selection.value >= lg) continue;
      seen.add(selection.key);
      candidates.push(selection);
    }
  });
  if (!candidates.length) return false;
  const chosen = pickRandomSubset(candidates, randomCountValue);
  chosen.forEach((sel) => {
    store.selectionState.set(sel.key, {
      base: sel.base,
      numerator: sel.numerator,
      denominator: sel.denominator,
      value: sel.value,
      display: sel.display,
      key: sel.key,
      cycleIndex: sel.cycleIndex,
      subdivisionIndex: sel.subdivisionIndex,
      pulsesPerCycle: sel.pulsesPerCycle,
      rawLabel: sel.display
    });
  });
  return chosen.length > 0;
}

function randomize() {
  const allowComplex = true; // App4: fraccions complexes sempre actives

  if (randomConfig.n?.enabled || randomConfig.d?.enabled) {
    fractionSlots
      .filter((slot) => slot.added && slot.active && slot.controller)
      .forEach((slot) => {
        const current = slot.controller.getFraction();
        let chosen = null;
        for (let attempt = 0; attempt < 20 && !chosen; attempt++) {
          const candidate = { numerator: current.numerator, denominator: current.denominator };
          if (randomConfig.n?.enabled) {
            const [lo, hi] = randomConfig.n.range ?? randomDefaults.n.range;
            const safeHi = Math.min(7, Math.max(1, hi));
            const safeLo = Math.min(Math.max(1, lo), safeHi);
            candidate.numerator = allowComplex ? randomInt(safeLo, safeHi) : 1;
          }
          if (randomConfig.d?.enabled) {
            const [lo, hi] = randomConfig.d.range ?? randomDefaults.d.range;
            const safeHi = Math.min(12, Math.max(1, hi));
            const safeLo = Math.min(Math.max(1, lo), safeHi);
            candidate.denominator = randomInt(safeLo, safeHi);
          }
          const { bigCycle } = wouldBeBigCycle({ override: { id: slot.id, fraction: candidate } });
          if (bigCycle <= MAX_LG) {
            chosen = candidate;
          } else if (attempt === 19) {
            chosen = { numerator: 1, denominator: candidate.denominator ?? current.denominator ?? 1 };
          }
        }
        if (chosen) {
          slot.controller.setFraction(chosen, { cause: 'randomize' });
        }
      });
  }

  if (randomConfig.Lg?.enabled) {
    const [lo, hi] = randomConfig.Lg.range ?? randomDefaults.Lg.range;
    const safeLo = Math.max(1, Math.round(lo));
    const safeHi = Math.max(safeLo, Math.round(hi));
    setCycles(randomInt(safeLo, safeHi)); // setCycles ja clampa a mMax
  }

  randomizeFractional({
    randomConfig: {
      ...randomConfig,
      Lg: { enabled: false },
      n: { enabled: false },
      d: { enabled: false }
    },
    randomDefaults,
    inputs: { inputLg, inputV, inputT },
    // Shim F3: només cal getFraction; setFraction ja no passa per la lib.
    fractionEditor: { getFraction },
    pulseMemoryApi,
    fractionStore,
    randomCount,
    // F5: tots els enters 1..Lg-1 són seleccionables (cap gating per fracció).
    isIntegerPulseSelectable: () => true,
    nearestPulseIndex,
    applyRandomFractionSelection: applyRandomRingFractionSelection,
    getAllowComplexFractions: () => allowComplex,
    callbacks: {
      onVChange: ({ value, input }) => handleInput({ target: input }),
      onPulsesChange: () => {
        rebuildFractionSelections();
        renderRings();
        if (isPlaying && audio) {
          applySelectionToAudio();
        }
      },
      renderNotation: () => renderNotationIfVisible()
    }
  });
}

initRandomMenu(randomBtn, randomMenu, randomize);

// All sound dropdowns (including cycleSoundSelect) are initialized by header.js via initHeader()
// No app-specific initialization needed

// Create standardized audio initializer that avoids AudioContext warnings
const _baseInitAudio = createRhythmAudioInitializer({
  getSoundSelects: () => ({
    baseSoundSelect: elements.baseSoundSelect,
    startSoundSelect: elements.startSoundSelect,
    accentSoundSelect: elements.accentSoundSelect,
    cycleSoundSelect: elements.cycleSoundSelect
  }),
  schedulingBridge,
  channels: [
    {
      id: 'accent',
      options: { allowSolo: true, label: 'Seleccionado' },
      assignment: 'accent'
    }
  ]
});

async function initAudio() {
  if (!audio) {
    audio = await _baseInitAudio();
    if (audio) {
      // F4/F4b: pulse + accent del tier estàndard, més els tres canals de
      // fracció (substitueixen 'subdivision', que App4 ja no fa servir) i
      // els tres de seleccionats fraccionats.
      setupAudioDefaults(audio, {
        channels: [
          ...CHANNEL_TIERS.RHYTHM_ACCENT,
          ...FRACTION_MIXER_CHANNELS,
          ...FRACTION_SELECTED_MIXER_CHANNELS
        ]
      });
    }

    // F4c: restaura els overrides de so per canal triats al mixer
    // (persistits a 'app4:sound:<canal>'). Aplicats AQUÍ i no al load:
    // l'àudio neix al primer gest i setChannelSound carrega el buffer
    // lazy sobre el context acabat de crear.
    if (typeof audio.setChannelSound === 'function') {
      MIXER_SOUND_CHANNEL_IDS.forEach((channelId) => {
        const saved = loadOpt(`sound:${channelId}`);
        if (saved) audio.setChannelSound(channelId, saved);
      });
    }

    // Replicar l'estat dels toggles fets abans que el motor existís (H-11):
    // re-dispara els onChange, que ara sí troben `audio`.
    audioToggleManager.applyTo();
    // F5: bucle permanent
    if (typeof audio.setLoop === 'function') {
      audio.setLoop(true);
    }
    const savedMute = loadOpt('mute');
    if (savedMute === '1' && typeof audio.setMute === 'function') {
      audio.setMute(true);
    }

    // Expose audio instance for sound dropdown preview
    if (typeof window !== 'undefined') window.__labAudio = audio;
  }
  return audio;
}

if (typeof window !== 'undefined') {
  window.__labInitAudio = initAudio;
}

// Mostrar unitats quan s'edita cada paràmetre
function bindUnit(input, unit){
  if(!input || !unit) return;
  input.addEventListener('focus', () => { unit.style.display = 'block'; });
  input.addEventListener('blur', () => { unit.style.display = 'none'; });
}

if (inputT) {
  inputT.readOnly = true;
  inputT.dataset.auto = '1';
}

bindUnit(inputLg, unitLg);
bindUnit(inputV, unitV);
bindUnit(inputT, unitT);

[inputLg, inputV].forEach(el => el.addEventListener('input', handleInput));

// BPM persistent: es desa a cada canvi (també des de tap/random via setValue)
// i el reset el neteja perquè la propera càrrega torni al default.
inputV.addEventListener('input', () => {
  const v = parseNum(inputV.value);
  if (!isNaN(v) && v > 0) saveOpt(BPM_KEY, String(v));
});

// V per defecte (o el darrer desat) ABANS del handleInput inicial: sense
// valor, computeAudioSchedulingState retorna interval=null i el play no
// arrencava fins que el random/tap omplien V.
if (inputV && !String(inputV.value).trim()) {
  const storedBpm = parseNum(loadOpt(BPM_KEY));
  inputV.value = String(Number.isFinite(storedBpm) && storedBpm > 0 ? storedBpm : DEFAULT_BPM);
}

handleInput();


function setValue(input, value){
  isUpdating = true;
  input.value = String(value);
  isUpdating = false;
}

function parseNum(val){
  if (typeof val !== 'string') return Number(val);
  let s = val.trim();
  // Si hi ha coma i no hi ha punt: format català “1.234,56” → traiem punts (milers) i passem coma a punt
  if (s.includes(',') && !s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    // En la resta de casos, NO esborrem punts (poden ser decimals); només canviem comes per punts
    s = s.replace(/,/g, '.');
  }
  const n = parseFloat(s);
    return isNaN(n) ? NaN : n;
}
// === Formula Renderer and Tooltip Setup ===
const formulaRenderer = createFormulaRenderer();
const { formatNumber: formatNumberValue, formatInteger, formatBpm: formatBpmValue } = formulaRenderer;

function formatSec(n) {
  return formatNumberValue(n);
}

const titleInfoTooltip = createInfoTooltip({
  className: 'fraction-info-bubble auto-tip-below top-bar-info-tip'
});

function buildTitleInfoContent() {
  const lgValue = parseIntSafe(inputLg?.value);
  const { numerator, denominator } = getFraction();
  const tempoValue = parseNum(inputV?.value ?? '');
  const tValue = parseNum(inputT?.value ?? '');

  return formulaRenderer.buildFormulaFragment({
    lg: lgValue,
    numerator,
    denominator,
    tempo: tempoValue,
    t: tValue
  });
}

if (titleButton) {
  titleButton.addEventListener('click', () => {
    const content = buildTitleInfoContent();
    if (!content) return;
    titleInfoTooltip.show(content, titleButton);
  });
  titleButton.addEventListener('blur', () => titleInfoTooltip.hide());
  titleButton.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' || event.key === 'Esc') {
      titleInfoTooltip.hide();
    }
  });
}



// Unified spinner behavior for number inputs (V)
function stepAndDispatch(input, dir){
  if (!input) return;
  if (dir > 0) input.stepUp(); else input.stepDown();
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
addRepeatPress(inputVUp,   () => stepAndDispatch(inputV, +1));
addRepeatPress(inputVDown, () => stepAndDispatch(inputV, -1));
// F3: Lg és un valor calculat (cicle gran × m) — sense spinners ni edició
// directa; el control de longitud és la pill "Cicles" (initCyclesParam).

function handleInput(){
  const lg = parseNum(inputLg.value);
  const v  = parseNum(inputV.value);
  const hasLg = !isNaN(lg) && lg > 0;
  const hasV  = !isNaN(v)  && v  > 0;

  if (isUpdating) return;

  refreshFractionUI({ reveal: true });

  if (hasLg && hasV) {
    const timing = fromLgAndTempo(lg, v);
    if (timing && timing.duration != null) {
      const rounded = Math.round(timing.duration * 100) / 100;
      if (inputT) setValue(inputT, rounded);
    }
  }

  // Ensure memory capacity always (preserve selections when Lg crece)
  if (hasLg) {
    ensurePulseMemory(lg);
  }

  updateFormula();
  // P-03 (adaptat): handleInput és només Lg/V/T i els anells només depenen
  // d'Lg (els canvis de fracció i de selecció re-rendericen pels seus camins).
  if (lg !== lastRenderedLg) {
    renderRings();
  }

  // A-13: push en viu col·lapsat (250ms trailing) — el bloc empeny veus,
  // resolució i transport junts; diferir-lo sencer manté la coherència
  // entre setVoices i updateTransport i cap transitòria de tecleig (bpm=2,
  // totalPulses=1) no arriba al worklet.
  if (isPlaying && audio) {
    liveTransportPush.schedule();
  }

  // Recàlcul en viu del panell ∑ si està obert (Lg, BPM i fraccions hi arriben
  // via recomputeLg → handleInput).
  refreshInfoPanelIfOpen();
}

// A-13: cos del push en viu d'App4 — llegeix l'estat fresc en disparar-se.
const liveTransportPush = createLiveTransportPush({
  isLive: () => isPlaying && !!audio,
  apply: () => {
    const scheduling = computeAudioSchedulingState();
    const selectionForAudio = applySelectionToAudio({ scheduling })
      || selectedForAudioFromState({ scheduling });
    const resolvedSelectionResolution = Number.isFinite(selectionForAudio?.resolution)
      ? Math.max(1, Math.round(selectionForAudio.resolution))
      : 1;
    const schedulingResolution = Number.isFinite(scheduling?.resolution)
      ? Math.max(1, Math.round(scheduling.resolution))
      : 1;
    const effectiveResolution = Math.max(1, resolvedSelectionResolution, schedulingResolution);
    const normalizedLg = Number.isFinite(scheduling?.lg) ? scheduling.lg : parseInt(inputLg.value);

    let effectiveTotal = scheduling.totalPulses != null ? scheduling.totalPulses : null;
    let effectivePatternBeats = scheduling.patternBeats != null ? scheduling.patternBeats : null;
    let effectiveCycleConfig = scheduling.cycleConfig ? { ...scheduling.cycleConfig } : null;
    let effectiveVoices = Array.isArray(scheduling.voices)
      ? scheduling.voices.map((voice) => (voice ? { ...voice } : voice))
      : [];

    if (Number.isFinite(normalizedLg) && normalizedLg > 0 && effectiveResolution > 1) {
      // F5: bucle permanent — mai cal el +1 de l'últim pols.
      const scaledBase = normalizedLg * effectiveResolution;
      effectiveTotal = Math.max(1, Math.round(scaledBase));
      if (Number.isFinite(effectivePatternBeats)) {
        effectivePatternBeats = Math.max(1, Math.round(effectivePatternBeats * effectiveResolution));
      }
      if (effectiveCycleConfig && Number.isFinite(effectiveCycleConfig.numerator)) {
        effectiveCycleConfig = {
          ...effectiveCycleConfig,
          numerator: Math.max(1, Math.round(effectiveCycleConfig.numerator * effectiveResolution))
        };
      }
      effectiveVoices = effectiveVoices.map((voice) => {
        if (!voice || !Number.isFinite(voice.numerator)) return voice;
        return {
          ...voice,
          numerator: Math.max(1, Math.round(voice.numerator * effectiveResolution))
        };
      });
    }

    currentAudioResolution = effectiveResolution;
    // F4: si la fracció principal ha canviat de slot en viu, re-apunta el
    // bus de cicle al canal nou abans d'empènyer veus i transport.
    if (typeof audio.setCycleChannel === 'function') {
      audio.setCycleChannel(scheduling.cycleChannel || 'subdivision');
    }
    if (typeof audio.setVoices === 'function') {
      audio.setVoices(effectiveVoices);
    }

    const transportPayload = { align: 'nextPulse' };
    if (effectiveTotal != null) {
      transportPayload.totalPulses = effectiveTotal;
    }
    const vNow = parseFloat(inputV.value);
    // A-13: V només dins de rang (paritat U-11) — cap bpm=2 transitori
    if (scheduling.validV && Number.isFinite(vNow) && vNow >= 30 && vNow <= 240) {
      const scaledBpm = effectiveResolution > 1 ? vNow * effectiveResolution : vNow;
      transportPayload.bpm = scaledBpm;
    }
    if (effectivePatternBeats != null) {
      transportPayload.patternBeats = effectivePatternBeats;
    }
    // F4: SEMPRE empènyer el cicle — amb zeros quan no hi ha fracció
    // principal, perquè desactivar-la en viu silenciï el camí de cicle
    // (sense això el worklet conservaria el n/d antic i seguiria sonant).
    transportPayload.cycle = effectiveCycleConfig || { numerator: 0, denominator: 0 };
    if (effectiveResolution != null) {
      transportPayload.baseResolution = effectiveResolution;
    }
    if (typeof audio.updateTransport === 'function' && (scheduling.validLg || scheduling.validV)) {
      audio.updateTransport(transportPayload);
    }
  }
});

function updateFormula(){
  if (!formula) return;
  const tNum = parseNum(inputT?.value ?? '');
  const tStr = isNaN(tNum)
    ? ((inputT?.value ?? '') || 'T')
    : formatSec(tNum).replace('.', ',');
  const lg = inputLg.value || 'Lg';
  const v  = inputV.value || 'V';
  formula.innerHTML = `
  <span class="fraction">
    <span class="top lg">${lg}</span>
    <span class="bottom v">${v}</span>
  </span>
  <span class="equal">=</span>
  <span class="fraction">
    <span class="top t">${tStr}</span>
    <span class="bottom">60</span>
  </span>`;

}

function handlePlaybackStop(audioInstance) {
  const iconPlay = playBtn?.querySelector('.icon-play');
  const iconStop = playBtn?.querySelector('.icon-stop');
  isPlaying = false;
  playBtn?.classList.remove('active');
  if (iconPlay) iconPlay.style.display = 'block';
  if (iconStop) iconStop.style.display = 'none';
  clearHighlights();
  stopVisualSync();
  if (audioInstance && typeof audioInstance.stop === 'function') {
    try { audioInstance.stop(); } catch {}
  }

  // F6: resetear el cursor de notació a TOTS els pentagrames apilats
  // (el controller fa fan-out de resetCursor).
  if (notationRendererController && typeof notationRendererController.resetCursor === 'function') {
    notationRendererController.resetCursor();
  }
  currentAudioResolution = 1;
}

async function startPlayback(providedAudio) {
  const lg = parseInt(inputLg.value);
  const v  = parseFloat(inputV.value);
  if (!Number.isFinite(lg) || !Number.isFinite(v) || lg <= 0 || v <= 0) {
    return false;
  }

  const audioInstance = providedAudio || await initAudio();
  if (!audioInstance) return false;

  stopVisualSync();
  audioInstance.stop();
  clearHighlights();

  const scheduling = computeAudioSchedulingState();
  if (scheduling.interval == null || scheduling.totalPulses == null) {
    return false;
  }
  const selectionForAudio = applySelectionToAudio({
    scheduling,
    instance: audioInstance
  }) || selectedForAudioFromState({ scheduling });
  const resolvedSelectionResolution = Number.isFinite(selectionForAudio?.resolution)
    ? Math.max(1, Math.round(selectionForAudio.resolution))
    : 1;
  const schedulingResolution = Number.isFinite(scheduling?.resolution)
    ? Math.max(1, Math.round(scheduling.resolution))
    : 1;
  const effectiveResolution = Math.max(1, resolvedSelectionResolution, schedulingResolution);
  const normalizedLg = Number.isFinite(scheduling?.lg) ? scheduling.lg : lg;
  let effectiveInterval = scheduling.interval;
  let effectiveTotal = scheduling.totalPulses;
  let effectivePatternBeats = Number.isFinite(scheduling?.patternBeats)
    ? scheduling.patternBeats
    : null;
  let cycleConfig = scheduling.cycleConfig ? { ...scheduling.cycleConfig } : null;
  let voices = Array.isArray(scheduling.voices)
    ? scheduling.voices.map((voice) => ({ ...voice }))
    : [];

  if (Number.isFinite(normalizedLg) && normalizedLg > 0 && effectiveResolution > 1) {
    // F5: bucle permanent — totalPulses = lg escalat (sense +1 d'endpoint).
    const scaledBase = normalizedLg * effectiveResolution;
    effectiveTotal = Math.max(1, Math.round(scaledBase));
    if (Number.isFinite(scheduling.interval)) {
      effectiveInterval = scheduling.interval / effectiveResolution;
    }
    if (Number.isFinite(effectivePatternBeats)) {
      effectivePatternBeats = Math.max(1, Math.round(effectivePatternBeats * effectiveResolution));
    }
    if (cycleConfig && Number.isFinite(cycleConfig.numerator)) {
      cycleConfig = { ...cycleConfig, numerator: Math.max(1, Math.round(cycleConfig.numerator * effectiveResolution)) };
    }
    voices = voices.map((voice) => {
      if (!voice || !Number.isFinite(voice.numerator)) return voice;
      return { ...voice, numerator: Math.max(1, Math.round(voice.numerator * effectiveResolution)) };
    });
  }

  if (!Number.isFinite(effectiveInterval) || effectiveInterval <= 0) {
    return false;
  }
  if (!Number.isFinite(effectiveTotal) || effectiveTotal <= 0) {
    return false;
  }

  currentAudioResolution = effectiveResolution;
  // F4: el bus de cicle (fracció principal) sona pel canal del seu slot.
  if (typeof audioInstance.setCycleChannel === 'function') {
    audioInstance.setCycleChannel(scheduling.cycleChannel || 'subdivision');
  }
  if (typeof audioInstance.setVoices === 'function') {
    audioInstance.setVoices(voices);
  }
  const iconPlay = playBtn?.querySelector('.icon-play');
  const iconStop = playBtn?.querySelector('.icon-stop');

  const onFinish = () => {
    handlePlaybackStop(audioInstance);
  };

  const playOptions = {};
  if (effectivePatternBeats != null) {
    playOptions.patternBeats = effectivePatternBeats;
  }
  if (cycleConfig) {
    playOptions.cycle = cycleConfig;
  }
  playOptions.baseResolution = effectiveResolution;

  // F5: bucle permanent
  if (typeof audioInstance.setLoop === 'function') {
    audioInstance.setLoop(true);
  }

  const selectionValuesForAudio = selectionForAudio.audio ?? selectionForAudio.combined;
  const selectionPayload = {
    values: selectionValuesForAudio,
    // Mantener resolución 1 evita reescalar pulsos seleccionados al iniciar play.
    resolution: 1
  };

  audioInstance.play(
    effectiveTotal,
    effectiveInterval,
    selectionPayload,
    true, // F5: loop sempre actiu
    null,
    onFinish,
    playOptions
  );

  syncVisualState();
  startVisualSync();

  isPlaying = true;
  playBtn?.classList.add('active');
  if (iconPlay) iconPlay.style.display = 'none';
  if (iconStop) iconStop.style.display = 'block';

  return true;
}

playBtn.addEventListener('click', async () => {
  try {
    const audioInstance = await initAudio();
    if (!audioInstance) return;

    if (isPlaying) {
      handlePlaybackStop(audioInstance);
      return;
    }

    clearHighlights();
    const started = await startPlayback(audioInstance);
    if (!started) {
      handlePlaybackStop(audioInstance);
    }
  } catch {}
});

function stopVisualSync() {
  visualSyncManager.stop();
  rings.clearHighlights();
}

function syncVisualState() {
  visualSyncManager.syncVisualState();
}

function startVisualSync() {
  visualSyncManager.start();
}

const menu = document.querySelector('.menu');
const optionsContent = document.querySelector('.menu .options-content');

if (menu && optionsContent) {
  menu.addEventListener('toggle', () => {
    if (menu.open) {
      // enforce solid background on open
      solidMenuBackground(optionsContent);
      optionsContent.classList.add('opening');
      optionsContent.classList.remove('closing');
      optionsContent.style.maxHeight = optionsContent.scrollHeight + "px";

      optionsContent.addEventListener('transitionend', () => {
        optionsContent.classList.remove('opening');
        optionsContent.style.maxHeight = "500px"; // estat estable
      }, { once: true });

    } else {
      optionsContent.classList.add('closing');
      optionsContent.classList.remove('opening');
      optionsContent.style.maxHeight = optionsContent.scrollHeight + "px";
      optionsContent.offsetHeight; // força reflow
      optionsContent.style.maxHeight = "0px";

      optionsContent.addEventListener('transitionend', () => {
        optionsContent.classList.remove('closing');
      }, { once: true });
    }
  });

  // Also re-apply if theme changes while menu is open
  window.addEventListener('sharedui:theme', () => {
    if (menu.open) solidMenuBackground(optionsContent);
  });
}
// Initialize mixer UI and sync accent/master controls
const mixerMenu = document.getElementById('mixerMenu');
const mixerTriggers = [playBtn, tapBtn].filter(Boolean);

// F4: un fader per fracció (frac1/frac2/frac3) en lloc del antic
// "Subdivisión" — cada slot de fracció sona sempre pel seu canal.
// F4b: cada fracció duu el seu fader de seleccionats ADJACENT ("Fracció N
// sel."): l'usuari pensa per fracció i aïllar-ne una vol dir tocar dos
// faders veïns.
// F4c: 'Seleccionado' puja al costat de 'Pulso' — són la parella del pols
// base (metrònom + sencers seleccionats), mateixa lògica de veïnatge que
// les parelles de fracció. Ordre: Pulso · Seleccionado · F1 · F1 sel. ·
// F2 · F2 sel. · F3 · F3 sel. · Master. I cada canal (menys Master) duu
// el seu selector d'instrument (withMixerSoundSelector).
initMixerMenu({
  menu: mixerMenu,
  triggers: mixerTriggers,
  channels: [
    withMixerSoundSelector({ id: 'pulse',  label: 'Pulso', allowSolo: true }),
    withMixerSoundSelector({ id: 'accent', label: 'Seleccionado', allowSolo: true }),
    ...FRACTION_MIXER_CHANNELS.flatMap((channel, index) => [
      withMixerSoundSelector(channel),
      withMixerSoundSelector(FRACTION_SELECTED_MIXER_CHANNELS[index])
    ]),
    { id: 'master', label: 'Master', allowSolo: false, isMaster: true }
  ]
});

// Initialize gamification system
import('./gamification-adapter.js').then(module => {
  module.initApp4Gamification();
});
