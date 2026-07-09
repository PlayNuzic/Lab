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
