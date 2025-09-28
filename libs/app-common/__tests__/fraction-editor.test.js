import { jest } from '@jest/globals';
import { JSDOM } from 'jsdom';
import createFractionEditor, { createEmptyFractionInfo } from '../fraction-editor.js';

describe('fraction-editor', () => {
  let dom;
  let document;
  let container;

  beforeEach(() => {
    dom = new JSDOM('<!doctype html><html><body></body></html>');
    ({ document } = dom.window);
    global.window = dom.window;
    global.document = document;
    global.getComputedStyle = () => ({
      getPropertyValue: () => ''
    });
    container = document.createElement('span');
    document.body.appendChild(container);
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
    delete global.getComputedStyle;
  });

  test('initializes inputs with defaults and reports initial change', () => {
    const changes = [];
    createFractionEditor({
      host: container,
      defaults: { numerator: 3, denominator: 7 },
      storage: {
        load: () => null,
        save: jest.fn(),
        clear: jest.fn(),
        numeratorKey: 'n',
        denominatorKey: 'd'
      },
      onChange: (payload) => changes.push(payload)
    });

    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ numerator: 3, denominator: 7, cause: 'init' });
    const numerator = container.querySelector('input.numerator');
    const denominator = container.querySelector('input.denominator');
    expect(numerator.value).toBe('3');
    expect(denominator.value).toBe('7');
  });

  test('normalizes input changes and updates info bubble text', () => {
    const changes = [];
    const editor = createFractionEditor({
      host: container,
      defaults: { numerator: 2, denominator: 4 },
      storage: {
        load: () => null,
        save: jest.fn(),
        clear: jest.fn(),
        numeratorKey: 'n',
        denominatorKey: 'd'
      },
      onChange: (payload) => changes.push(payload)
    });

    const { numerator, denominator, infoBubble } = editor.elements;
    numerator.value = '5';
    numerator.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    expect(changes[changes.length - 1]).toMatchObject({ numerator: 5 });

    denominator.value = '10';
    denominator.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    const lastChange = changes[changes.length - 1];
    expect(lastChange.info).toMatchObject({ isMultiple: true, reducedNumerator: 1, reducedDenominator: 2 });

    denominator.dispatchEvent(new dom.window.Event('mouseenter', { bubbles: true }));
    expect(infoBubble.classList.contains('fraction-info-bubble--visible')).toBe(true);
    expect(infoBubble.textContent).toContain('Esta fracción es múltiple de');
  });

  test('setFraction allows programmatic updates without notifying when silent', () => {
    const onChange = jest.fn();
    const editor = createFractionEditor({
      host: container,
      storage: {
        load: () => null,
        save: jest.fn(),
        clear: jest.fn(),
        numeratorKey: 'n',
        denominatorKey: 'd'
      },
      onChange
    });

    onChange.mockClear();
    const info = editor.setFraction({ numerator: 4, denominator: 8 }, { silent: true, persist: false });
    expect(onChange).not.toHaveBeenCalled();
    expect(info).toMatchObject({ numerator: 4, denominator: 8, isMultiple: true });
    expect(editor.getFraction()).toEqual({ numerator: 4, denominator: 8 });
    expect(editor.getInfo()).toMatchObject({ reducedNumerator: 1, reducedDenominator: 2 });
  });

  test('createEmptyFractionInfo returns neutral structure', () => {
    expect(createEmptyFractionInfo()).toEqual({
      numerator: null,
      denominator: null,
      reducedNumerator: null,
      reducedDenominator: null,
      isMultiple: false,
      multipleFactor: 1
    });
  });
});
