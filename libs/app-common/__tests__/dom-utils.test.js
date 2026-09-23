/**
 * Tests for dom-utils.js
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';
import { clearElement } from '../dom-utils.js';

describe('dom-utils', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('clearElement', () => {
    test('should remove all child elements', () => {
      container.innerHTML = '<div>Child 1</div><div>Child 2</div><div>Child 3</div>';
      expect(container.children.length).toBe(3);

      const result = clearElement(container);

      expect(result).toBe(true);
      expect(container.children.length).toBe(0);
      expect(container.innerHTML).toBe('');
    });

    test('should work with nested elements', () => {
      container.innerHTML = '<div><span><strong>Nested</strong></span></div>';
      expect(container.querySelector('strong')).toBeTruthy();

      clearElement(container);

      expect(container.querySelector('strong')).toBeNull();
      expect(container.children.length).toBe(0);
    });

    test('should handle already empty elements', () => {
      expect(container.children.length).toBe(0);

      const result = clearElement(container);

      expect(result).toBe(true);
      expect(container.children.length).toBe(0);
    });

    test('should handle invalid input gracefully', () => {
      expect(clearElement(null)).toBe(false);
      expect(clearElement(undefined)).toBe(false);
      expect(clearElement('not an element')).toBe(false);
      expect(clearElement({})).toBe(false);
    });

    // Abans això era una mesura de rellotge (`end - start < 50 ms`) i saltava
    // sola quan la màquina anava carregada — un fals positiu que feia dubtar
    // de canvis que no hi tenien res a veure. El que val la pena garantir no
    // és el temps, sinó el camí: una passada pel DOM, exactament un
    // removeChild per fill, i el subarbre buit del tot. És determinista i
    // detecta les regressions reals (tornar a `innerHTML = ''`, que no faria
    // cap removeChild, o un bucle que reescaneja la llista).
    test('should clear a large subtree in one pass (one removeChild per child)', () => {
      const CHILDREN = 500;
      for (let i = 0; i < CHILDREN; i++) {
        const child = document.createElement('div');
        const nested = document.createElement('span');
        nested.textContent = `Child ${i}`;
        child.appendChild(nested);
        container.appendChild(child);
      }
      expect(container.children.length).toBe(CHILDREN);

      const removeChild = jest.spyOn(container, 'removeChild');

      expect(clearElement(container)).toBe(true);

      expect(container.firstChild).toBeNull();
      expect(container.children.length).toBe(0);
      expect(container.innerHTML).toBe('');
      expect(removeChild).toHaveBeenCalledTimes(CHILDREN);

      removeChild.mockRestore();
    });
  });
});
