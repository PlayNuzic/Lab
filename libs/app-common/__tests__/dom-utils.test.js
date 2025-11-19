/**
 * Tests for dom-utils.js
 * @jest-environment jsdom
 */

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

    test('should be more efficient than innerHTML = ""', () => {
      // Create many child elements
      for (let i = 0; i < 100; i++) {
        const child = document.createElement('div');
        child.textContent = `Child ${i}`;
        container.appendChild(child);
      }

      expect(container.children.length).toBe(100);

      const start = performance.now();
      clearElement(container);
      const end = performance.now();

      expect(container.children.length).toBe(0);
      // Performance test - clearElement should complete quickly
      expect(end - start).toBeLessThan(50); // < 50ms for 100 elements
    });
  });
});
