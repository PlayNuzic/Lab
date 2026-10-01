/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';
import {
  getSlideInfo, readCurrentPaso, createTracker, readTester, classifyEntrada,
  tramoTemps, LONG_DWELL_MS,
} from '../analytics.js';

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
  window.clarity = jest.fn();
});

const events = () => window.clarity.mock.calls.filter(c => c[0] === 'event').map(c => c[1]);
const tags = () => Object.fromEntries(window.clarity.mock.calls.filter(c => c[0] === 'set').map(c => [c[1], c[2]]));

describe('getSlideInfo', () => {
  test('deriva section d\'un paso existent', () => {
    expect(getSlideInfo(3).section).toBe('descubriendo');
  });

  test('paso inexistent retorna nulls sense llançar', () => {
    expect(getSlideInfo(999)).toEqual({ section: null, title: null });
  });
});

describe('readCurrentPaso', () => {
  test('llegeix i parseja el float desat per slides.js', () => {
    localStorage.setItem('sistema.paso', '18.5');
    expect(readCurrentPaso()).toBe(18.5);
  });

  test('retorna null si no hi ha res desat', () => {
    expect(readCurrentPaso()).toBeNull();
  });
});

describe('readTester', () => {
  test('llegeix ?tester= de l\'URL i el recorda al navegador', () => {
    expect(readTester('?paso=3&tester=P1-03')).toBe('P1-03');
    expect(localStorage.getItem('sistema.tester')).toBe('P1-03');
  });

  test('sense paràmetre, torna l\'ID recordat (sessions en fred)', () => {
    localStorage.setItem('sistema.tester', 'P2-01');
    expect(readTester('?paso=5')).toBe('P2-01');
  });

  test('ignora IDs amb caràcters no permesos', () => {
    expect(readTester('?tester=<script>')).toBeNull();
    expect(localStorage.getItem('sistema.tester')).toBeNull();
  });

  test('?tester=off oblida l\'ID recordat (sortida del mode test)', () => {
    localStorage.setItem('sistema.tester', 'DEV');
    expect(readTester('?tester=off')).toBeNull();
    expect(localStorage.getItem('sistema.tester')).toBeNull();
    expect(readTester('?paso=3')).toBeNull();
  });
});

describe('classifyEntrada', () => {
  test('enllaç compartit amb ?paso=', () => {
    expect(classifyEntrada({ url: 'https://x.test/Lab/sistema/?paso=12', referrer: '', host: 'x.test' })).toBe('enlace_paso');
  });

  test('referrer extern', () => {
    expect(classifyEntrada({ url: 'https://x.test/Lab/sistema/', referrer: 'https://www.nuzic.org/p', host: 'x.test' })).toBe('referrer:www.nuzic.org');
  });

  test('referrer del mateix host o cap referrer → directa', () => {
    expect(classifyEntrada({ url: 'https://x.test/Lab/sistema/', referrer: 'https://x.test/Lab/', host: 'x.test' })).toBe('directa');
    expect(classifyEntrada({ url: 'https://x.test/Lab/sistema/', referrer: '', host: 'x.test' })).toBe('directa');
  });
});

test('tramoTemps agrupa els mil·lisegons en quatre trams', () => {
  expect(tramoTemps(500)).toBe('0_10s');
  expect(tramoTemps(15_000)).toBe('10_30s');
  expect(tramoTemps(45_000)).toBe('30_60s');
  expect(tramoTemps(90_000)).toBe('mas_60s');
});

describe('createTracker — pasos', () => {
  test('marca el tag i l\'esdeveniment en el primer render', () => {
    localStorage.setItem('sistema.paso', '7');
    const tracker = createTracker();
    tracker.onRender();

    expect(window.clarity).toHaveBeenCalledWith('set', 'paso', '7');
    expect(window.clarity).toHaveBeenCalledWith('set', 'section', 'intervalos');
    expect(window.clarity).toHaveBeenCalledWith('event', 'paso_7');
  });

  test('formata els pasos *.5/*.7 com a noms d\'esdeveniment vàlids', () => {
    localStorage.setItem('sistema.paso', '18.5');
    const tracker = createTracker();
    tracker.onRender();
    expect(window.clarity).toHaveBeenCalledWith('event', 'paso_18_5');
  });

  test('ignora onRender si el pas no ha canviat', () => {
    localStorage.setItem('sistema.paso', '2');
    const tracker = createTracker();
    tracker.onRender();
    window.clarity.mockClear();
    tracker.onRender();
    expect(window.clarity).not.toHaveBeenCalled();
  });

  test('capítol completat només en avançar a un capítol posterior', () => {
    const tracker = createTracker();
    localStorage.setItem('sistema.paso', '6');
    tracker.onRender();
    localStorage.setItem('sistema.paso', '7');
    tracker.onRender();
    expect(events()).toContain('capitulo_completado_descubriendo');

    window.clarity.mockClear();
    localStorage.setItem('sistema.paso', '5');   // enrere: cap capítol completat
    tracker.onRender();
    expect(events().some(e => e.startsWith('capitulo_completado'))).toBe(false);
  });

  test('coda_alcanzada en entrar a la coda', () => {
    localStorage.setItem('sistema.paso', '29');
    createTracker().onRender();
    expect(events()).toContain('coda_alcanzada');
  });

  test('paso_N_largo si el pas segueix obert passat LONG_DWELL_MS; es cancel·la en canviar de pas', () => {
    jest.useFakeTimers();
    try {
      const tracker = createTracker();
      localStorage.setItem('sistema.paso', '3');
      tracker.onRender();
      jest.advanceTimersByTime(LONG_DWELL_MS - 1);
      expect(events()).not.toContain('paso_3_largo');
      jest.advanceTimersByTime(1);
      expect(events()).toContain('paso_3_largo');

      localStorage.setItem('sistema.paso', '4');
      tracker.onRender();
      localStorage.setItem('sistema.paso', '5');
      tracker.onRender();
      jest.advanceTimersByTime(LONG_DWELL_MS);
      expect(events()).not.toContain('paso_4_largo');
      expect(events()).toContain('paso_5_largo');
    } finally {
      jest.useRealTimers();
    }
  });

  test('aviso_girar quan el pas mostra el rotate-prompt i giro_hecho quan el viewport s\'eixampla', () => {
    document.body.innerHTML = '<div class="rotate-prompt"></div>';
    localStorage.setItem('sistema.paso', '15');
    const tracker = createTracker();
    tracker.onRender();
    expect(events()).toContain('aviso_girar');

    tracker.onViewportChange({ matches: true });    // segueix estret
    expect(events().filter(e => e === 'giro_hecho')).toHaveLength(0);
    tracker.onViewportChange({ matches: false });
    tracker.onViewportChange({ matches: false });   // un sol cop
    expect(events().filter(e => e === 'giro_hecho')).toHaveLength(1);
  });

  test('sense rotate-prompt no hi ha aviso_girar ni giro_hecho', () => {
    localStorage.setItem('sistema.paso', '15');
    const tracker = createTracker();
    tracker.onRender();
    tracker.onViewportChange({ matches: false });
    expect(events()).not.toContain('aviso_girar');
    expect(events()).not.toContain('giro_hecho');
  });

  test('si window.clarity no existeix (consentiment no concedit), no llança ni envia res', () => {
    delete window.clarity;
    localStorage.setItem('sistema.paso', '2');
    const tracker = createTracker();
    expect(() => tracker.onRender()).not.toThrow();
    expect(() => tracker.start()).not.toThrow();
  });
});

describe('createTracker — primer scroll, guia, índex', () => {
  test('primer_scroll només un cop, amb el tram de temps des de la càrrega', () => {
    let t = 0;
    const tracker = createTracker({ now: () => t });
    const driver = document.createElement('div');
    driver.className = 'parallax-driver';
    const altre = document.createElement('div');

    tracker.onScroll({ target: altre });
    expect(events()).not.toContain('primer_scroll');

    t = 12_000;
    tracker.onScroll({ target: driver });
    tracker.onScroll({ target: driver });
    expect(events().filter(e => e === 'primer_scroll')).toHaveLength(1);
    expect(tags().t_primer_scroll).toBe('10_30s');
  });

  test('guia_abierta / indice_abierto només quan el botó queda expandit', () => {
    document.body.innerHTML = `
      <button id="btn-guia" aria-expanded="false"><span id="g-in">Cómo navegar</span></button>
      <button id="nav-title" aria-expanded="false">Capítulo</button>`;
    const tracker = createTracker();
    const guia = document.getElementById('btn-guia');
    const titol = document.getElementById('nav-title');

    tracker.onClick({ target: document.getElementById('g-in') });
    expect(events()).not.toContain('guia_abierta');
    guia.setAttribute('aria-expanded', 'true');
    tracker.onClick({ target: document.getElementById('g-in') });
    expect(events()).toContain('guia_abierta');

    titol.setAttribute('aria-expanded', 'true');
    tracker.onClick({ target: titol });
    expect(events()).toContain('indice_abierto');
  });
});

describe('createTracker — missatges de les apps (embed-mode.js)', () => {
  test('tradueix app:play/random/reset a esdeveniments amb el nom de l\'app', () => {
    const tracker = createTracker();
    tracker.onMessage({ origin: '', data: { type: 'app:play', app: 'App12' } });
    tracker.onMessage({ origin: '', data: { type: 'app:random', app: 'App25B' } });
    tracker.onMessage({ origin: '', data: { type: 'app:reset', app: 'App9' } });
    tracker.onMessage({ origin: '', data: { type: 'app:play', app: 'App12' } });
    expect(events()).toEqual(['app_play_App12', 'app_random_App25B', 'app_reset_App9', 'app_play_App12']);
  });

  test('app:edit només un cop per app', () => {
    const tracker = createTracker();
    tracker.onMessage({ origin: '', data: { type: 'app:edit', app: 'App12' } });
    tracker.onMessage({ origin: '', data: { type: 'app:edit', app: 'App12' } });
    tracker.onMessage({ origin: '', data: { type: 'app:edit', app: 'App13' } });
    expect(events()).toEqual(['app_edit_App12', 'app_edit_App13']);
  });

  test('ignora tipus desconeguts, noms d\'app estranys i orígens aliens', () => {
    const tracker = createTracker();
    tracker.onMessage({ origin: '', data: { type: 'app:resize', height: 300 } });
    tracker.onMessage({ origin: '', data: { type: 'app:play', app: '<img>' } });
    tracker.onMessage({ origin: 'https://evil.test', data: { type: 'app:play', app: 'App12' } });
    tracker.onMessage({ origin: '', data: null });
    expect(events()).toEqual([]);
  });
});

describe('createTracker — identificació', () => {
  test('amb ?tester= identifica la sessió, la marca com a test i la prioritza', () => {
    localStorage.setItem('sistema.tester', 'P3-02');
    createTracker().identify();
    expect(window.clarity).toHaveBeenCalledWith('identify', 'P3-02');
    expect(window.clarity).toHaveBeenCalledWith('upgrade', 'test-usuario');
    expect(tags().modo).toBe('test');
    expect(tags().tester).toBe('P3-02');
    expect(tags().entrada).toBeDefined();
  });

  test('l\'ID recordat torna a l\'URL sense perdre ?paso (sessions en fred)', () => {
    history.replaceState(null, '', '/Lab/sistema/?paso=4');
    localStorage.setItem('sistema.tester', 'P1-05');
    createTracker().identify();
    expect(location.search).toBe('?paso=4&tester=P1-05');
    createTracker().identify();                     // idempotent
    expect(location.search).toBe('?paso=4&tester=P1-05');
    history.replaceState(null, '', '/');
  });

  test('sense tester, modo real', () => {
    createTracker().identify();
    expect(window.clarity).not.toHaveBeenCalledWith('identify', expect.anything());
    expect(tags().modo).toBe('real');
  });

  test('?tester=off surt de l\'URL i la visita queda com a real', () => {
    history.replaceState(null, '', '/Lab/sistema/?paso=4&tester=off');
    localStorage.setItem('sistema.tester', 'DEV');
    createTracker().identify();
    expect(location.search).toBe('?paso=4');
    expect(localStorage.getItem('sistema.tester')).toBeNull();
    expect(tags().modo).toBe('real');
    history.replaceState(null, '', '/');
  });
});
