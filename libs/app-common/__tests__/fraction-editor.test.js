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
    const mockComputedStyle = () => ({
      width: '64px',
      getPropertyValue: () => ''
    });
    dom.window.getComputedStyle = mockComputedStyle;
    global.getComputedStyle = mockComputedStyle;
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
      mode: 'inline',
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

  test('startEmpty ignores stored values, clears storage and shows placeholders', () => {
    const load = jest.fn((key) => (key === 'n' ? '9' : key === 'd' ? '4' : null));
    const clear = jest.fn();
    const changes = [];
    const editor = createFractionEditor({
      mode: 'inline',
      host: container,
      defaults: { numerator: 6, denominator: 5 },
      storage: {
        load,
        save: jest.fn(),
        clear,
        numeratorKey: 'n',
        denominatorKey: 'd'
      },
      startEmpty: true,
      onChange: (payload) => changes.push(payload)
    });

    expect(load).toHaveBeenCalledWith('n');
    expect(load).toHaveBeenCalledWith('d');
    expect(clear).toHaveBeenCalledWith('n');
    expect(clear).toHaveBeenCalledWith('d');
    expect(editor.getFraction()).toEqual({ numerator: null, denominator: null });
    expect(changes[0]).toMatchObject({ numerator: null, denominator: null, cause: 'init' });
    const numerator = container.querySelector('input.numerator');
    const denominator = container.querySelector('input.denominator');
    expect(numerator.value).toBe('');
    expect(denominator.value).toBe('');
  });

  test('normalizes input changes and updates info bubble text', () => {
    const changes = [];
    const editor = createFractionEditor({
      mode: 'inline',
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
      mode: 'inline',
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

  test('block mode mounts without duplicating markup and supports destroy', () => {
    const blockHost = document.createElement('div');
    document.body.appendChild(blockHost);
    const controller = createFractionEditor({
      mode: 'block',
      host: blockHost,
      defaults: { numerator: 5, denominator: 8 },
      storage: {
        load: () => null,
        save: jest.fn(),
        clear: jest.fn(),
        numeratorKey: 'n',
        denominatorKey: 'd'
      }
    });

    expect(blockHost.querySelectorAll('.fraction-editor').length).toBe(1);
    const inputs = blockHost.querySelectorAll('input');
    expect(inputs).toHaveLength(2);
    expect(inputs[0].value).toBe('5');
    expect(inputs[1].value).toBe('8');

    const second = createFractionEditor({ mode: 'block', host: blockHost });
    expect(second).toBe(controller);

    controller.destroy();
    const third = createFractionEditor({ mode: 'block', host: blockHost });
    expect(third).not.toBe(controller);
  });
});
