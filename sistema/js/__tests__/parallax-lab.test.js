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

// ── Frontera de frases: quan pot un gest canviar de paso ────────────────
// Regla del motor, compartida per TOTS els slides P-parallax-lab (intro de
// capítol, intro global i coda): recórrer les frases fins a l'última NO
// canvia de paso, per llarga que sigui l'empenta. Només ho fa un gest NOU
// —començat quan ja s'és al límit— que hi empenyi EDGE_ESCAPE_PX (340px)
// de més. Enrere no s'escapa mai per gest.
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

describe('Parallax Lab — frontera de frases i canvi de paso', () => {
  let lab;
  let rellotge;   // el motor mesura els gestos amb performance.now(), que
                  // els fake timers de jest NO avancen: el controlem aquí.

  // Un "gest": pausa prou llarga perquè el motor n'obri un de nou, la
  // ràfega d'events de roda, i el drenatge del lerp (rAF) fins al repòs.
  function gest(slideEl, deltaY, events = 6) {
    rellotge += 400;                                   // > GEST_RESET_MS (250)
    for (let i = 0; i < events; i++) {
      slideEl.dispatchEvent(new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true }));
    }
    for (let i = 0; i < 200; i++) jest.advanceTimersByTime(16);
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

  // Progrés publicat pel motor a l'arrel del slide (0 = primera frase,
  // 1 = última). Serveix per portar el slide al límit sense passar-se:
  // un cop hi és, el gest SEGÜENT ja pot escapar.
  function progres(slideEl) {
    return parseFloat(slideEl.style.getPropertyValue('--px-progress')) || 0;
  }

  // Recorre les frases a base de gestos fins al límit, comprovant a cada
  // pas que no s'ha canviat de paso. Retorna els gestos que ha calgut.
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

    // Inclou el gest que CREUA fins a l'última frase: com que va començar
    // abans del límit, tampoc no escapa.
    finsAlLimit(slideEl, clicks);
    expect(clicks).not.toHaveBeenCalled();
  });

  test('un cop al límit, un gest nou amb prou empenta escapa al paso següent', () => {
    const { slideEl, next } = harnessNav(7);
    const clicks = jest.fn();
    next.addEventListener('click', clicks);
    lab.wire(slideEl, { paso: 1, apps: [] });

    finsAlLimit(slideEl, clicks);
    gest(slideEl, 180, 3);                               // 540px > EDGE_ESCAPE_PX (340)
    expect(clicks).toHaveBeenCalledTimes(1);
  });

  test('al límit, una empenta curta NO escapa (cal superar EDGE_ESCAPE_PX)', () => {
    const { slideEl, next } = harnessNav(5);             // com la coda
    const clicks = jest.fn();
    next.addEventListener('click', clicks);
    lab.wire(slideEl, { paso: 29, apps: [] });

    finsAlLimit(slideEl, clicks);
    gest(slideEl, 100, 3);                               // 300px < 340px
    expect(clicks).not.toHaveBeenCalled();
  });

  test('a la primera frase, cap gest enrere canvia de paso', () => {
    const { slideEl, prev } = harnessNav(5);
    const clicks = jest.fn();
    prev.addEventListener('click', clicks);
    lab.wire(slideEl, { paso: 29, apps: [] });

    for (let i = 0; i < 6; i++) gest(slideEl, -300);
    expect(clicks).not.toHaveBeenCalled();
  });
});
