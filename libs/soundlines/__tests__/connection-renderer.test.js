/**
 * @jest-environment jsdom
 */
// libs/soundlines/__tests__/connection-renderer.test.js
// Tests per al renderitzador de línies de connexió

import { jest } from '@jest/globals';
import { drawConnectionLines, createConnectionManager } from '../connection-renderer.js';

// Mock de soundline API
function createMockSoundline() {
  const element = document.createElement('div');
  element.className = 'soundline-container';
  element.style.height = '400px';

  return {
    element,
    getNotePosition: (noteIndex) => {
      // Simula posició vertical (0 = bottom, 11 = top)
      return ((11 - noteIndex) / 11) * 100;
    }
  };
}

// Mock de SVG amb dimensions
function createMockSvg() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.style.height = '400px';
  svg.style.width = '100px';
  return svg;
}

describe('drawConnectionLines', () => {
  let svg;
  let chromaticContainer;
  let chromaticSoundline;
  let originalGetComputedStyle;

  beforeEach(() => {
    svg = createMockSvg();
    chromaticSoundline = createMockSoundline();
    chromaticContainer = chromaticSoundline.element;

    // Afegir al DOM per tenir getBoundingClientRect
    document.body.appendChild(svg);
    document.body.appendChild(chromaticContainer);

    // Mock de getBoundingClientRect
    svg.getBoundingClientRect = () => ({
      top: 0,
      height: 400,
      width: 100
    });

    chromaticContainer.getBoundingClientRect = () => ({
      top: 0,
      height: 400
    });

    // Mock de getComputedStyle
    originalGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = () => ({
      getPropertyValue: (prop) => {
        if (prop === '--connection-length') return '80%';
        return '';
      }
    });
  });

  afterEach(() => {
    if (svg?.parentNode) svg.remove();
    if (chromaticContainer?.parentNode) chromaticContainer.remove();
    window.getComputedStyle = originalGetComputedStyle;
  });

  test('crea línies per cada nota de l\'escala', () => {
    const scaleNotes = [0, 2, 4, 5, 7, 9, 11]; // Escala Major

    drawConnectionLines({
      svg,
      chromaticContainer,
      chromaticSoundline,
      scaleNotes
    });

    const lines = svg.querySelectorAll('.connection-line');
    expect(lines.length).toBe(7);
  });

  test('assigna data-semitone correctament', () => {
    const scaleNotes = [0, 4, 7]; // Tríada

    drawConnectionLines({
      svg,
      chromaticContainer,
      chromaticSoundline,
      scaleNotes
    });

    scaleNotes.forEach(semitone => {
      const line = svg.querySelector(`[data-semitone="${semitone}"]`);
      expect(line).not.toBeNull();
    });
  });

  test('assigna data-degree correctament', () => {
    const scaleNotes = [0, 2, 4];

    drawConnectionLines({
      svg,
      chromaticContainer,
      chromaticSoundline,
      scaleNotes
    });

    const lines = svg.querySelectorAll('.connection-line');
    lines.forEach((line, index) => {
      expect(line.getAttribute('data-degree')).toBe(String(index));
    });
  });

  test('retorna false si falta svg', () => {
    const result = drawConnectionLines({
      svg: null,
      chromaticContainer,
      chromaticSoundline,
      scaleNotes: [0, 2, 4]
    });

    expect(result).toBe(false);
  });

  test('retorna false si falta chromaticContainer', () => {
    const result = drawConnectionLines({
      svg,
      chromaticContainer: null,
      chromaticSoundline,
      scaleNotes: [0, 2, 4]
    });

    expect(result).toBe(false);
  });

  test('retorna false si falta chromaticSoundline', () => {
    const result = drawConnectionLines({
      svg,
      chromaticContainer,
      chromaticSoundline: null,
      scaleNotes: [0, 2, 4]
    });

    expect(result).toBe(false);
  });

  test('retorna false si SVG té alçada zero', () => {
    svg.getBoundingClientRect = () => ({
      top: 0,
      height: 0,
      width: 100
    });

    const result = drawConnectionLines({
      svg,
      chromaticContainer,
      chromaticSoundline,
      scaleNotes: [0, 2, 4]
    });

    expect(result).toBe(false);
  });

  test('neteja SVG abans de dibuixar', () => {
    // Afegir contingut previ
    const prevLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    svg.appendChild(prevLine);

    drawConnectionLines({
      svg,
      chromaticContainer,
      chromaticSoundline,
      scaleNotes: [0, 2]
    });

    // Només les noves línies
    const lines = svg.querySelectorAll('line');
    expect(lines.length).toBe(2);
  });

  test('usa variable CSS personalitzada per llargada', () => {
    window.getComputedStyle = () => ({
      getPropertyValue: (prop) => {
        if (prop === '--custom-length') return '60%';
        return '';
      }
    });

    drawConnectionLines({
      svg,
      chromaticContainer,
      chromaticSoundline,
      scaleNotes: [0],
      cssLengthVar: '--custom-length'
    });

    const line = svg.querySelector('.connection-line');
    expect(line.getAttribute('x2')).toBe('60%');
  });

  test('retorna true en èxit', () => {
    const result = drawConnectionLines({
      svg,
      chromaticContainer,
      chromaticSoundline,
      scaleNotes: [0, 2, 4]
    });

    expect(result).toBe(true);
  });
});

describe('createConnectionManager', () => {
  let svg;
  let chromaticContainer;
  let chromaticSoundline;
  let manager;
  let originalGetComputedStyle;

  beforeEach(() => {
    svg = createMockSvg();
    chromaticSoundline = createMockSoundline();
    chromaticContainer = chromaticSoundline.element;

    document.body.appendChild(svg);
    document.body.appendChild(chromaticContainer);

    svg.getBoundingClientRect = () => ({
      top: 0,
      height: 400,
      width: 100
    });

    chromaticContainer.getBoundingClientRect = () => ({
      top: 0,
      height: 400
    });

    originalGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = () => ({
      getPropertyValue: () => '80%'
    });

    manager = createConnectionManager({
      svg,
      chromaticContainer,
      chromaticSoundline,
      scaleNotes: [0, 2, 4, 5, 7, 9, 11]
    });
  });

  afterEach(() => {
    if (manager) manager.dispose();
    if (svg?.parentNode) svg.remove();
    if (chromaticContainer?.parentNode) chromaticContainer.remove();
    window.getComputedStyle = originalGetComputedStyle;
  });

  describe('redraw', () => {
    test('dibuixa línies de connexió', () => {
      manager.redraw();

      const lines = svg.querySelectorAll('.connection-line');
      expect(lines.length).toBe(7);
    });
  });

  describe('updateScaleNotes', () => {
    test('actualitza notes i redibuixa', () => {
      manager.redraw();
      expect(svg.querySelectorAll('.connection-line').length).toBe(7);

      manager.updateScaleNotes([0, 3, 7]); // Menor

      const lines = svg.querySelectorAll('.connection-line');
      expect(lines.length).toBe(3);
    });
  });

  describe('updateChromaticSoundline', () => {
    test('actualitza soundline i redibuixa', () => {
      const newSoundline = createMockSoundline();
      newSoundline.element.getBoundingClientRect = () => ({
        top: 0,
        height: 400
      });

      manager.updateChromaticSoundline(newSoundline);

      // Hauria de funcionar sense errors
      const lines = svg.querySelectorAll('.connection-line');
      expect(lines.length).toBeGreaterThan(0);
    });
  });

  describe('enableAutoResize', () => {
    test('afegeix listener de resize', () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener');

      manager.enableAutoResize();

      expect(addEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
      addEventListenerSpy.mockRestore();
    });

    test('no afegeix múltiples listeners', () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener');

      manager.enableAutoResize();
      manager.enableAutoResize();
      manager.enableAutoResize();

      expect(addEventListenerSpy).toHaveBeenCalledTimes(1);
      addEventListenerSpy.mockRestore();
    });
  });

  describe('disableAutoResize', () => {
    test('elimina listener de resize', () => {
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');

      manager.enableAutoResize();
      manager.disableAutoResize();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
      removeEventListenerSpy.mockRestore();
    });

    test('no falla si no hi ha listener', () => {
      expect(() => {
        manager.disableAutoResize();
      }).not.toThrow();
    });
  });

  describe('dispose', () => {
    test('neteja SVG', () => {
      manager.redraw();
      expect(svg.querySelectorAll('.connection-line').length).toBe(7);

      manager.dispose();

      expect(svg.innerHTML).toBe('');
    });

    test('desactiva auto-resize', () => {
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');

      manager.enableAutoResize();
      manager.dispose();

      expect(removeEventListenerSpy).toHaveBeenCalled();
      removeEventListenerSpy.mockRestore();
    });
  });
});
