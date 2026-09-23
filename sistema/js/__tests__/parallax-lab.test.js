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
    const original = lab.getConfig(22)['multi-speed'].params.factor;  // del preset, no fixat
    const a = lab.getConfig(22);
    a['multi-speed'].params.factor = 999; // mutació local del resultat
    const b = lab.getConfig(22); // segona crida: no pot arrossegar la mutació
    expect(b['multi-speed'].params.factor).toBe(original);
  });

  test('setConfig materialitza el preset (configMutable) sense perdre la resta d\'entrades', () => {
    // El valor de fàbrica es llegeix del preset en lloc de fixar-lo: els
    // PRESETS es cuinen des del panell i canvien sovint; l'invariant que
    // aquí es prova és que setConfig no toca la resta d'entrades.
    const abans = lab.getConfig(22)['multi-speed'];
    lab.setConfig(22, 'mouse-tilt', { on: true });
    const all = lab.getConfigAll();
    expect(all[22]['mouse-tilt'].on).toBe(true);
    expect(all[22]['multi-speed']).toEqual(abans);
  });

  // Els intros de capítol i la coda porten els mateixos valors a les
  // tècniques enceses (unificats el 2026-09-23 prenent el paso 1 com a
  // referència). El paso 1 queda FORA de la comparació a posta: és la intro
  // global i evoluciona pel seu compte. Si algun altre paso n'ha de
  // divergir, que sigui una decisió explícita: treure'l d'INTROS aquí.
  test('els intros de capítol i la coda comparteixen els mateixos valors', () => {
    const RECEPTA = ['scroll-depth', 'mouse-tilt', 'depth-blur', 'text-reveal', 'focus-mode', 'bg-dim'];
    const [primer, ...INTROS] = [2, 7, 11, 17, 22, 29];
    const ref = lab.getConfig(primer);
    INTROS.forEach((paso) => {
      const cfg = lab.getConfig(paso);
      RECEPTA.forEach((id) => {
        expect({ paso, id, valor: cfg[id] }).toEqual({ paso, id, valor: ref[id] });
      });
    });
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

// ── Driver: scroll natiu amb snap ───────────────────────────────────────
// El motor ja no interpreta la roda: un contenidor natiu (.parallax-driver)
// amb snap és l'amo de l'scroll i les frases es pinten des del seu
// scrollTop. Aquí es prova el que SÍ que és nostre: les cel·les (text, app
// i sortida), la pintura des de scrollTop, el bloqueig d'entrada, el pas
// discret (teclat/cremallera), el canvi de paso per la cel·la de sortida i
// el reenviament de clics. jsdom no fa layout: l'alçada de cel·la i el
// scrollTo es simulen sobre el driver.
function harnessNav(nFrases, { nextDisabled = false } = {}) {
  document.body.innerHTML = '';
  const nav = document.createElement('div');
  nav.innerHTML = '<button id="btn-prev"></button><button id="btn-next"></button>';
  document.body.appendChild(nav);
  if (nextDisabled) document.getElementById('btn-next').disabled = true;
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

describe('Parallax Lab — driver (scroll natiu amb snap)', () => {
  let lab;
  const CELL = 500;

  // Cableja i prepara el driver per a jsdom: alçada de cel·la fixa i un
  // scrollTo que mou scrollTop i emet 'scroll' (com faria el navegador).
  function cableja(slideEl, slide) {
    const ctrl = lab.wire(slideEl, slide);
    const driver = slideEl.querySelector('.parallax-driver');
    Object.defineProperty(driver, 'clientHeight', { value: CELL, configurable: true });
    driver.scrollTo = ({ top }) => { driver.scrollTop = top; driver.dispatchEvent(new Event('scroll')); };
    return { ctrl, driver };
  }
  function drena() { for (let i = 0; i < 10; i++) jest.advanceTimersByTime(16); }
  function progres(slideEl) { return parseFloat(slideEl.style.getPropertyValue('--px-progress')) || 0; }
  function cells(driver) { return [...driver.querySelectorAll('.parallax-driver__cell')]; }

  beforeEach(async () => {
    localStorage.clear();
    document.body.innerHTML = '';
    jest.resetModules();
    jest.useFakeTimers();
    window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);
    window.cancelAnimationFrame = (id) => clearTimeout(id);
    window.__sistemaState = { editable: false };
    mockMatchMedia(false);
    await import('../parallax-lab.js');
    lab = window.__parallaxLab;
  });

  afterEach(() => {
    jest.useRealTimers();
    delete window.__sistemaState;
  });

  test('cel·les = frases + sortida (si hi ha paso següent); sense app si app-reveal és off', () => {
    const { slideEl } = harnessNav(7);
    const { driver } = cableja(slideEl, { paso: 1, apps: [] });
    const cs = cells(driver);
    expect(cs).toHaveLength(8);
    expect(cs[7].classList.contains('parallax-driver__cell--sortida')).toBe(true);
    expect(driver.querySelector('.parallax-driver__cell--app')).toBeNull();
  });

  test('a l\'últim paso no hi ha cel·la de sortida', () => {
    const { slideEl } = harnessNav(5, { nextDisabled: true });
    const { driver } = cableja(slideEl, { paso: 29, apps: [] });
    expect(cells(driver)).toHaveLength(5);
    expect(driver.querySelector('.parallax-driver__cell--sortida')).toBeNull();
  });

  test('amb app i app-reveal actiu, s\'afegeix la cel·la d\'app després de l\'última frase', () => {
    lab.setConfig(2, 'app-reveal', { on: true, params: { fraseAparicio: 8 } });
    const { slideEl } = harnessNav(7);
    const { driver } = cableja(slideEl, { paso: 2, apps: ['App11A'], aspect: '4/3' });
    const cs = cells(driver);
    expect(cs).toHaveLength(9);                        // 7 text + app + sortida
    expect(cs[7].classList.contains('parallax-driver__cell--app')).toBe(true);
    expect(cs[8].classList.contains('parallax-driver__cell--sortida')).toBe(true);
    // El progrés arriba a 1 a la cel·la d'app (total = 8 → detail.total).
    const rebuts = [];
    slideEl.addEventListener('sistema:parallax-progress', e => rebuts.push(e.detail));
    driver.scrollTo({ top: 7 * CELL }); drena();
    expect(rebuts.at(-1)).toMatchObject({ t: 1, active: 7, total: 8 });
  });

  test('l\'scroll pinta les frases des de scrollTop (posició contínua, activa amb histèresi)', () => {
    const { slideEl } = harnessNav(5);
    // Paso sense PRESET: el 1 porta focus-mode, que reescriu les opacitats.
    const { driver } = cableja(slideEl, { paso: 3, apps: [] });
    const frases = [...slideEl.querySelectorAll('.parallax-frases > p')];
    driver.scrollTo({ top: 0.4 * CELL }); drena();
    expect(progres(slideEl)).toBeCloseTo(0.1, 5);      // 0.4 / (5-1)
    expect(frases[0].classList.contains('is-active')).toBe(true);   // encara la 0 (histèresi)
    driver.scrollTo({ top: 1 * CELL }); drena();
    expect(frases[1].classList.contains('is-active')).toBe(true);
    expect(Number(frases[1].style.opacity)).toBe(1);
    expect(Number(frases[0].style.opacity)).toBeCloseTo(0.19, 2);
  });

  test('el driver neix bloquejat (sense punter) i s\'allibera passat ENTRY_LOCK_MS', () => {
    const { slideEl } = harnessNav(5);
    const { driver } = cableja(slideEl, { paso: 2, apps: [] });
    expect(driver.classList.contains('is-locked')).toBe(true);
    jest.advanceTimersByTime(650);
    expect(driver.classList.contains('is-locked')).toBe(true);
    jest.advanceTimersByTime(100);
    expect(driver.classList.contains('is-locked')).toBe(false);
  });

  test('entrar a la cel·la de sortida canvia de paso un sol cop', () => {
    const { slideEl, next } = harnessNav(5);
    const clicks = jest.fn(); next.addEventListener('click', clicks);
    const { driver } = cableja(slideEl, { paso: 1, apps: [] });
    driver.scrollTo({ top: 4 * CELL }); drena();       // última frase: res
    expect(clicks).not.toHaveBeenCalled();
    driver.scrollTo({ top: 4.3 * CELL }); drena();     // encara sota el llindar (0.6)
    expect(clicks).not.toHaveBeenCalled();
    driver.scrollTo({ top: 4.7 * CELL }); drena();
    expect(clicks).toHaveBeenCalledTimes(1);
    driver.scrollTo({ top: 5 * CELL }); drena();       // el snap acaba d'arribar: no repeteix
    expect(clicks).toHaveBeenCalledTimes(1);
  });

  test('step(±1) mou una cel·la i a la frontera escapa al paso adjacent', () => {
    const { slideEl, next, prev } = harnessNav(3);
    const clicksNext = jest.fn(); next.addEventListener('click', clicksNext);
    const clicksPrev = jest.fn(); prev.addEventListener('click', clicksPrev);
    const { ctrl, driver } = cableja(slideEl, { paso: 1, apps: [] });
    ctrl.step(1); drena();
    expect(driver.scrollTop).toBe(CELL);
    ctrl.step(1); drena();
    expect(driver.scrollTop).toBe(2 * CELL);
    ctrl.step(1); drena();                             // ja a l'última → paso següent
    expect(clicksNext).toHaveBeenCalledTimes(1);
    ctrl.step(-1); ctrl.step(-1); ctrl.step(-1); drena();
    expect(driver.scrollTop).toBe(0);
    expect(clicksPrev).toHaveBeenCalledTimes(1);
  });

  test('la cremallera del ratolí fa un pas per notch, a ritme limitat; el trackpad no s\'intercepta', () => {
    const { slideEl } = harnessNav(5);
    const { driver } = cableja(slideEl, { paso: 1, apps: [] });
    jest.spyOn(performance, 'now').mockReturnValue(1000);
    const notch = (dy) => {
      const e = new WheelEvent('wheel', { deltaY: dy, deltaMode: 0, bubbles: true, cancelable: true });
      Object.defineProperty(e, 'wheelDeltaY', { value: -dy * 1.2 });   // múltiple de 120 (Chrome)
      driver.dispatchEvent(e);
      return e;
    };
    expect(notch(100).defaultPrevented).toBe(true);
    drena();
    expect(driver.scrollTop).toBe(CELL);
    notch(100); drena();                               // dins de NOTCH_MS: ignorat
    expect(driver.scrollTop).toBe(CELL);
    performance.now.mockReturnValue(1400);
    notch(100); drena();
    expect(driver.scrollTop).toBe(2 * CELL);
    // Trackpad (wheelDeltaY no múltiple de 120): el navegador fa l'scroll natiu.
    const tp = new WheelEvent('wheel', { deltaY: 37, deltaMode: 0, bubbles: true, cancelable: true });
    Object.defineProperty(tp, 'wheelDeltaY', { value: -111 });
    driver.dispatchEvent(tp);
    expect(tp.defaultPrevented).toBe(false);
    performance.now.mockRestore();
  });

  test('un clic sobre el driver arriba a la frase de sota (hi glissa) o al botó de sota (el prem)', () => {
    const { slideEl } = harnessNav(4);
    const boto = document.createElement('button');
    boto.className = 'paso-badge';
    const premut = jest.fn(); boto.addEventListener('click', premut);
    slideEl.appendChild(boto);
    const { driver } = cableja(slideEl, { paso: 1, apps: [] });
    const frases = [...slideEl.querySelectorAll('.parallax-frases > p')];
    document.elementFromPoint = jest.fn();             // jsdom no l'implementa
    const sota = document.elementFromPoint;
    sota.mockReturnValue(frases[2]);
    driver.dispatchEvent(new MouseEvent('click', { clientX: 10, clientY: 10, bubbles: true }));
    drena();
    expect(driver.scrollTop).toBe(2 * CELL);
    sota.mockReturnValue(boto);
    driver.dispatchEvent(new MouseEvent('click', { clientX: 10, clientY: 10, bubbles: true }));
    expect(premut).toHaveBeenCalledTimes(1);
    delete document.elementFromPoint;
  });

  // CTA de la coda (paso 29): els enllaços viuen dins de les frases, i el
  // driver, que tapa el slide, ha de deixar-los passar quan la frase ja és
  // l'activa — i no abans (les atenuades no s'han llegit encara).
  function ambEnllac(nFrases = 4) {
    const { slideEl } = harnessNav(nFrases);
    const { driver } = cableja(slideEl, { paso: 29, apps: [] });
    const frases = [...slideEl.querySelectorAll('.parallax-frases > p')];
    const a = document.createElement('a');
    a.href = 'https://www.nuzic.org/sistema/';
    a.textContent = 'sistema de Nodos';
    frases[2].appendChild(a);
    const seguit = jest.fn(e => e.preventDefault());
    a.addEventListener('click', seguit);
    document.elementFromPoint = jest.fn().mockReturnValue(a);   // jsdom no l'implementa
    return { slideEl, driver, a, seguit };
  }

  test('clic a un enllaç de la frase ACTIVA: se segueix l\'enllaç', () => {
    const { driver, seguit } = ambEnllac();
    driver.scrollTo({ top: 2 * CELL });                          // frase 2 = activa
    drena();
    driver.dispatchEvent(new MouseEvent('click', { clientX: 10, clientY: 10, bubbles: true }));
    expect(seguit).toHaveBeenCalledTimes(1);
    expect(driver.scrollTop).toBe(2 * CELL);                     // no s'ha mogut
    delete document.elementFromPoint;
  });

  test('clic a un enllaç d\'una frase ATENUADA: hi glissa, no navega', () => {
    const { driver, seguit } = ambEnllac();                      // frase 0 = activa
    driver.dispatchEvent(new MouseEvent('click', { clientX: 10, clientY: 10, bubbles: true }));
    drena();
    expect(seguit).not.toHaveBeenCalled();
    expect(driver.scrollTop).toBe(2 * CELL);                     // hi ha portat
    delete document.elementFromPoint;
  });

  // El driver tapa el slide: el cursor de mà i el :hover dels enllaços (CTA
  // de la coda) els ha de posar el motor, i només a la frase activa.
  test('cursor de mà sobre un enllaç de la frase activa; es refà en canviar de frase', () => {
    const { slideEl } = harnessNav(3);
    const { driver } = cableja(slideEl, { paso: 29, apps: [] });
    const frases = [...slideEl.querySelectorAll('.parallax-frases > p')];
    const enllac = (frase, left) => {
      const a = document.createElement('a');
      a.href = 'https://playnuzic.com/'; a.textContent = 'PlayNuzic';
      a.getClientRects = () => [{ left, right: left + 100, top: 50, bottom: 80 }];
      frases[frase].appendChild(a);
      return a;
    };
    const a0 = enllac(0, 100);        // frase 0 = activa
    const a2 = enllac(2, 300);        // frase 2, encara atenuada
    const mou = (x, y) => driver.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y, bubbles: true }));

    mou(150, 60);
    expect(driver.style.cursor).toBe('pointer');
    expect(a0.classList.contains('is-hover')).toBe(true);

    mou(350, 60);                     // sobre l'enllaç d'una frase no activa: res
    expect(driver.style.cursor).toBe('');
    expect(a0.classList.contains('is-hover')).toBe(false);
    expect(a2.classList.contains('is-hover')).toBe(false);

    driver.scrollTo({ top: 2 * CELL }); drena();   // el punter no es mou; la frase 2 passa a activa
    expect(driver.style.cursor).toBe('pointer');
    expect(a2.classList.contains('is-hover')).toBe(true);

    driver.dispatchEvent(new MouseEvent('mouseleave'));
    expect(driver.style.cursor).toBe('');
    expect(a2.classList.contains('is-hover')).toBe(false);
  });

  test('activar app-reveal des del panell re-cableja el driver amb la cel·la d\'app', () => {
    const { slideEl } = harnessNav(3);
    // Paso sense PRESET (el 2 ja porta app-reveal actiu de fàbrica).
    cableja(slideEl, { paso: 3, apps: ['App11A'], aspect: '4/3' });
    expect(cells(slideEl.querySelector('.parallax-driver'))).toHaveLength(4);   // 3 + sortida
    lab.setConfig(3, 'app-reveal', { on: true });
    expect(cells(slideEl.querySelector('.parallax-driver'))).toHaveLength(5);   // 3 + app + sortida
    lab.setConfig(3, 'app-reveal', { on: false });
    expect(cells(slideEl.querySelector('.parallax-driver'))).toHaveLength(4);
  });
});
