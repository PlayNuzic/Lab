/**
 * @jest-environment jsdom
 */
// Parallax Lab — test del motor (parallax-lab.js).
//
// El mòdul no exporta res per ES modules: tota l'API pública viu a
// window.__parallaxLab (patró exposat perquè slides.js/tweaks.js no
// l'hagin d'importar). `reduced` es llegeix un cop, a l'import, de
// window.matchMedia — cal mockejar-lo ABANS de cada import fresc del
// mòdul (jest.resetModules() + import() dinàmic) per poder cobrir tant
// el cas reduced:false com el reduced:true amb instàncies netes.
import { jest } from '@jest/globals';

function mockMatchMedia(matches) {
  window.matchMedia = jest.fn().mockImplementation((query) => ({
    matches,
    media: query,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

// Slide lab mínim amb frases (wire() exigeix .parallax-frases > p) i una
// capa de fons amb data-depth (perquè scroll-depth tingui alguna cosa on
// escriure --px-sd-*).
function harness() {
  document.body.innerHTML = '';
  const slideEl = document.createElement('article');
  slideEl.className = 'slide slide--parallax slide--parallax-lab';
  slideEl.innerHTML = `
    <div class="parallax-bg" aria-hidden="true">
      <span class="parallax-layer" data-depth="0.25">N</span>
    </div>
    <div class="parallax-content">
      <div class="parallax-frases prose"><p>una</p><p>dues</p></div>
    </div>`;
  document.body.appendChild(slideEl);
  return slideEl;
}

describe('Parallax Lab — motor (parallax-lab.js), reduced-motion OFF', () => {
  let lab;

  beforeEach(async () => {
    localStorage.clear();
    document.body.innerHTML = '';
    jest.resetModules();
    mockMatchMedia(false);
    await import('../parallax-lab.js');
    lab = window.__parallaxLab;
  });

  test('getConfig(22) retorna el preset i mai la referència viva', () => {
    const a = lab.getConfig(22);
    expect(a['multi-speed'].params.factor).toBe(2);
    a['multi-speed'].params.factor = 999; // mutació local del resultat
    const b = lab.getConfig(22); // segona crida: no pot arrossegar la mutació
    expect(b['multi-speed'].params.factor).toBe(2);
  });

  test('setConfig materialitza el preset (configMutable) sense perdre la resta d\'entrades', () => {
    lab.setConfig(22, 'mouse-tilt', { on: true });
    const all = lab.getConfigAll();
    expect(all[22]['mouse-tilt'].on).toBe(true);
    // La resta del preset de fàbrica (p.ex. multi-speed) queda intacta.
    expect(all[22]['multi-speed'].params.factor).toBe(2);
    expect(all[22]['multi-speed'].on).toBe(true);
  });

  test('aleatori() genera valors dins [min, max] alineats al step', () => {
    const cfg = lab.aleatori(9001);
    const ids = Object.keys(cfg);
    expect(ids.length).toBeGreaterThanOrEqual(2);
    expect(ids.length).toBeLessThanOrEqual(4);
    ids.forEach((id) => {
      const tech = lab.registre.find((t) => t.id === id);
      (tech.params || []).forEach((p) => {
        const v = cfg[id].params[p.key];
        expect(v).toBeGreaterThanOrEqual(p.min);
        expect(v).toBeLessThanOrEqual(p.max);
        const passos = Math.round((v - p.min) / p.step);
        expect(p.min + passos * p.step).toBeCloseTo(v, 4);
      });
    });
  });

  test('resetConfig esborra fx[paso]', () => {
    lab.setConfig(22, 'mouse-tilt', { on: true });
    expect(lab.getConfigAll()[22]).toBeDefined();
    lab.resetConfig(22);
    expect(lab.getConfigAll()[22]).toBeUndefined();
  });
});

describe('Parallax Lab — motor (parallax-lab.js), reduced-motion ON', () => {
  let lab;

  beforeEach(async () => {
    localStorage.clear();
    document.body.innerHTML = '';
    jest.resetModules();
    mockMatchMedia(true);
    await import('../parallax-lab.js');
    lab = window.__parallaxLab;
  });

  test('el gate reduced-motion impedeix aplicar tècniques moviment:true', () => {
    const slideEl = harness();
    // Persisteix scroll-depth ON abans del wire (actiu encara és null: no
    // s'aplica en viu, només es desa a fx/localStorage).
    lab.setConfig(777, 'scroll-depth', { on: true });
    lab.wire(slideEl, { paso: 777 });
    const capa = slideEl.querySelector('.parallax-layer');
    // scroll-depth és moviment:true: amb reduced=true, aplica() ha de
    // saltar-se tech.apply() i la capa no rep cap --px-sd-*.
    expect(capa.style.getPropertyValue('--px-sd-x')).toBe('');
  });
});

// ── Model de gest: un gest = una frase ──────────────────────────────────
// Contracte del motor (compartit per TOTS els slides P-parallax-lab —
// intro de capítol, intro global i coda):
//   · una empenta mou exactament una frase, per llarga que sigui (la cua
//     d'inèrcia del trackpad no n'afegeix cap més);
//   · una empenta curta (< MIN_COMMIT) torna a l'origen: mai es queda
//     entre frases;
//   · a l'última frase no es canvia de paso en arribar-hi; només ho fa un
//     gest NOU, fora del bloqueig d'arribada, que sumi EDGE_ESCAPE_PX;
//   · enrere, a la primera, res.
function harnessNav(nFrases) {
  document.body.innerHTML = '';
  const nav = document.createElement('div');
  nav.innerHTML = '<button id="btn-prev"></button><button id="btn-next"></button>';
  document.body.appendChild(nav);
  const slideEl = document.createElement('article');
  slideEl.className = 'slide slide--parallax slide--parallax-lab';
  const ps = Array.from({ length: nFrases }, (_, i) => `<p>frase ${i}</p>`).join('');
  slideEl.innerHTML = `
    <div class="parallax-bg" aria-hidden="true">
      <span class="parallax-layer" data-depth="0.25">N</span>
    </div>
    <div class="parallax-content">
      <div class="parallax-frases prose">${ps}</div>
    </div>`;
  document.body.appendChild(slideEl);
  return {
    slideEl,
    next: document.getElementById('btn-next'),
    prev: document.getElementById('btn-prev'),
  };
}

describe('Parallax Lab — model de gest i frontera de frases', () => {
  let lab;
  let rellotge;   // el motor mesura els gestos amb performance.now(), que
                  // els fake timers de jest NO avancen: el controlem aquí.

  // Progrés publicat pel motor (0 = primera frase, 1 = última).
  function progres(slideEl) {
    return parseFloat(slideEl.style.getPropertyValue('--px-progress')) || 0;
  }
  // Posició en frases, derivada del progrés.
  function frase(slideEl, total) {
    return Math.round(progres(slideEl) * (total - 1) * 1000) / 1000;
  }

  // Drena rAF (molla) i timers (tancament de gest) fins al repòs.
  function drena() {
    for (let i = 0; i < 200; i++) jest.advanceTimersByTime(16);
  }
  // Ràfega d'events de roda dins d'un mateix gest (mateix instant).
  function rafega(slideEl, deltes) {
    for (const dy of deltes) {
      slideEl.dispatchEvent(new WheelEvent('wheel', { deltaY: dy, bubbles: true, cancelable: true }));
    }
  }
  // Un GEST sencer: pausa que n'obre un de nou (i supera el bloqueig
  // d'arribada), la ràfega, i el drenatge fins al repòs.
  function gest(slideEl, deltes) {
    rellotge += 500;                                   // > GEST_GAP_MS i > ARRIVAL_LOCK_MS
    rafega(slideEl, Array.isArray(deltes) ? deltes : [deltes]);
    drena();
  }

  beforeEach(async () => {
    localStorage.clear();
    document.body.innerHTML = '';
    jest.resetModules();
    jest.useFakeTimers();
    rellotge = 0;
    jest.spyOn(performance, 'now').mockImplementation(() => rellotge);
    window.requestAnimationFrame = (cb) => setTimeout(() => cb(rellotge), 16);
    window.cancelAnimationFrame = (id) => clearTimeout(id);
    window.__sistemaState = { editable: false };
    mockMatchMedia(false);
    await import('../parallax-lab.js');
    lab = window.__parallaxLab;
  });

  afterEach(() => {
    performance.now.mockRestore();
    jest.useRealTimers();
    delete window.__sistemaState;
  });

  test('una empenta llarga avança exactament una frase', () => {
    const { slideEl } = harnessNav(7);
    lab.wire(slideEl, { paso: 1, apps: [] });
    gest(slideEl, [300, 300, 300, 300, 300, 300]);     // 1800px en un sol gest
    expect(frase(slideEl, 7)).toBe(1);
  });

  test('una empenta curta (< MIN_COMMIT) torna a la frase d\'origen', () => {
    const { slideEl } = harnessNav(7);
    lab.wire(slideEl, { paso: 1, apps: [] });
    gest(slideEl, [20]);                               // 20px < 0.12 · 260
    expect(frase(slideEl, 7)).toBe(0);
  });

  test('una empenta moderada (≥ MIN_COMMIT) avança una frase: mai queda a mig camí', () => {
    const { slideEl } = harnessNav(7);
    lab.wire(slideEl, { paso: 1, apps: [] });
    gest(slideEl, [60]);                               // 60px = 0.23 frases → compromet
    expect(frase(slideEl, 7)).toBe(1);
  });

  test('la cua d\'inèrcia (deltes decreixents) no afegeix frases', () => {
    const { slideEl } = harnessNav(7);
    lab.wire(slideEl, { paso: 1, apps: [] });
    gest(slideEl, [300, 220, 160, 110, 70, 40, 20, 10, 5]);
    expect(frase(slideEl, 7)).toBe(1);
  });

  test('una empenta nova enmig de la cua (delta que puja de cop) és un gest nou', () => {
    const { slideEl } = harnessNav(7);
    lab.wire(slideEl, { paso: 1, apps: [] });
    gest(slideEl, [300, 60, 30, 12, 8, 6, 200, 200]);  // 200 > 6·1.4+4
    expect(frase(slideEl, 7)).toBe(2);
  });

  test('un gest enrere torna una frase; dos gestos endavant en avancen dues', () => {
    const { slideEl } = harnessNav(7);
    lab.wire(slideEl, { paso: 1, apps: [] });
    gest(slideEl, 300);
    gest(slideEl, 300);
    expect(frase(slideEl, 7)).toBe(2);
    gest(slideEl, -300);
    expect(frase(slideEl, 7)).toBe(1);
  });

  test('step(±1) per teclat mou una frase i a la frontera escapa', () => {
    const { slideEl, next, prev } = harnessNav(3);
    const clicksNext = jest.fn(); next.addEventListener('click', clicksNext);
    const clicksPrev = jest.fn(); prev.addEventListener('click', clicksPrev);
    const ctrl = lab.wire(slideEl, { paso: 1, apps: [] });
    ctrl.step(1); drena();
    expect(frase(slideEl, 3)).toBe(1);
    ctrl.step(1); drena();
    ctrl.step(1); drena();                             // ja a l'última → paso següent
    expect(clicksNext).toHaveBeenCalledTimes(1);
    ctrl.step(-1); drena(); ctrl.step(-1); drena(); ctrl.step(-1); drena();
    expect(clicksPrev).toHaveBeenCalledTimes(1);
  });

  // Recorre les frases a base de gestos fins al límit, comprovant a cada
  // pas que no s'ha canviat de paso.
  function finsAlLimit(slideEl, clicks) {
    let n = 0;
    while (progres(slideEl) < 1 && n < 25) {
      gest(slideEl, 300);
      n += 1;
      expect(clicks).not.toHaveBeenCalled();
    }
    expect(progres(slideEl)).toBe(1);
    return n;
  }

  test('recórrer les frases fins a l\'última no canvia de paso (intro global, 7 frases)', () => {
    const { slideEl, next } = harnessNav(7);
    const clicks = jest.fn();
    next.addEventListener('click', clicks);
    lab.wire(slideEl, { paso: 1, apps: [] });
    expect(finsAlLimit(slideEl, clicks)).toBe(6);      // exactament un gest per frase
    expect(clicks).not.toHaveBeenCalled();
  });

  test('un cop al límit, un gest nou amb prou empenta escapa al paso següent', () => {
    const { slideEl, next } = harnessNav(7);
    const clicks = jest.fn();
    next.addEventListener('click', clicks);
    lab.wire(slideEl, { paso: 1, apps: [] });
    finsAlLimit(slideEl, clicks);
    gest(slideEl, [200, 200]);                         // 400px > EDGE_ESCAPE_PX (380)
    expect(clicks).toHaveBeenCalledTimes(1);
  });

  test('al límit, una empenta curta NO escapa (fa goma i torna)', () => {
    const { slideEl, next } = harnessNav(5);           // com la coda
    const clicks = jest.fn();
    next.addEventListener('click', clicks);
    lab.wire(slideEl, { paso: 29, apps: [] });
    finsAlLimit(slideEl, clicks);
    gest(slideEl, [100, 100]);                         // 200px < 380px
    expect(clicks).not.toHaveBeenCalled();
    expect(progres(slideEl)).toBe(1);                  // la goma s'ha recollit
  });

  test('acabat d\'arribar a l\'última frase, el rebot immediat no escapa (bloqueig d\'arribada)', () => {
    const { slideEl, next } = harnessNav(5);
    const clicks = jest.fn();
    next.addEventListener('click', clicks);
    lab.wire(slideEl, { paso: 29, apps: [] });
    finsAlLimit(slideEl, clicks);
    rellotge += 300;                                   // > GEST_GAP_MS però < ARRIVAL_LOCK_MS
    rafega(slideEl, [300, 300]);                       // 600px: escaparia si no hi hagués bloqueig
    drena();
    expect(clicks).not.toHaveBeenCalled();
  });

  test('a la primera frase, cap gest enrere canvia de paso', () => {
    const { slideEl, prev } = harnessNav(5);
    const clicks = jest.fn();
    prev.addEventListener('click', clicks);
    lab.wire(slideEl, { paso: 29, apps: [] });
    for (let i = 0; i < 4; i++) gest(slideEl, -300);
    expect(clicks).not.toHaveBeenCalled();
    expect(progres(slideEl)).toBe(0);
  });
});
