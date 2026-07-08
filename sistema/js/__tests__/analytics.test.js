/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';
import {
  getOrCreateVisitorId,
  getSlideInfo,
  readCurrentPaso,
  createTracker,
  readCookie,
} from '../analytics.js';

beforeEach(() => {
  localStorage.clear();
  document.cookie.split(';').forEach(c => {
    document.cookie = c.replace(/^ +/, '').replace(/=.*/, '=;expires=Thu, 01 Jan 1970 00:00:00 GMT');
  });
  window.umami = { track: jest.fn() };
});

describe('getOrCreateVisitorId', () => {
  test('genera un UUID i el persisteix a cookie + localStorage', () => {
    const id = getOrCreateVisitorId();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(readCookie('sistema.visitorId')).toBe(id);
    expect(localStorage.getItem('sistema.visitorId')).toBe(id);
  });

  test('reutilitza l\'id existent a cookie', () => {
    document.cookie = 'sistema.visitorId=abc-123; Path=/';
    expect(getOrCreateVisitorId()).toBe('abc-123');
  });

  test('cau a localStorage si no hi ha cookie', () => {
    localStorage.setItem('sistema.visitorId', 'from-storage');
    expect(getOrCreateVisitorId()).toBe('from-storage');
  });
});

describe('getSlideInfo', () => {
  test('deriva section/title/is_lab d\'un paso normal', () => {
    const info = getSlideInfo(3);
    expect(info.section).toBe('descubriendo');
    expect(info.is_lab).toBe(false);
  });

  test('is_lab=true per als passos P-parallax-lab', () => {
    expect(getSlideInfo(1).is_lab).toBe(true);
  });

  test('paso inexistent retorna nulls sense llançar', () => {
    expect(getSlideInfo(999)).toEqual({ section: null, title: null, is_lab: false });
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

describe('createTracker', () => {
  test('no emet res en el primer render (sense pas previ a abandonar)', () => {
    localStorage.setItem('sistema.paso', '1');
    const tracker = createTracker({ now: () => 1000 });
    tracker.onRender();
    expect(window.umami.track).not.toHaveBeenCalled();
  });

  test('emet paso_visto amb dwell_ms en canviar de pas', () => {
    let t = 1000;
    const tracker = createTracker({ now: () => t });
    localStorage.setItem('sistema.paso', '2');
    tracker.onRender(); // entra al 2
    t = 4500;
    localStorage.setItem('sistema.paso', '3');
    tracker.onRender(); // abandona el 2 → dwell 3500ms

    expect(window.umami.track).toHaveBeenCalledTimes(1);
    const [name, props] = window.umami.track.mock.calls[0];
    expect(name).toBe('paso_visto');
    expect(props.paso).toBe(2);
    expect(props.dwell_ms).toBe(3500);
    expect(props.section).toBe('descubriendo');
  });

  test('ignora onRender si el pas no ha canviat', () => {
    let t = 1000;
    const tracker = createTracker({ now: () => t });
    localStorage.setItem('sistema.paso', '2');
    tracker.onRender();
    tracker.onRender(); // mateix pas, no hauria de fer flush
    expect(window.umami.track).not.toHaveBeenCalled();
  });

  test('flush() envia el darrer pas pendent (sortida de pàgina) i és idempotent', () => {
    let t = 1000;
    const tracker = createTracker({ now: () => t });
    localStorage.setItem('sistema.paso', '4');
    tracker.onRender();
    t = 2200;
    tracker.flush();
    tracker.flush(); // pagehide + visibilitychange no han de duplicar l'enviament

    expect(window.umami.track).toHaveBeenCalledTimes(1);
    expect(window.umami.track.mock.calls[0][1].dwell_ms).toBe(1200);
  });

  test('si window.umami no existeix, no llança', () => {
    delete window.umami;
    let t = 1000;
    const tracker = createTracker({ now: () => t });
    localStorage.setItem('sistema.paso', '2');
    expect(() => tracker.onRender()).not.toThrow();
  });
});
