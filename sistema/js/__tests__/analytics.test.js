/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';
import { getSlideInfo, readCurrentPaso, createTracker } from '../analytics.js';

beforeEach(() => {
  localStorage.clear();
  window.clarity = jest.fn();
});

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

describe('createTracker', () => {
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

  test('si window.clarity no existeix (consentiment no concedit), no llança ni envia res', () => {
    delete window.clarity;
    localStorage.setItem('sistema.paso', '2');
    const tracker = createTracker();
    expect(() => tracker.onRender()).not.toThrow();
  });
});
