/**
 * @jest-environment jsdom
 */

import { createTIndicator } from '../t-indicator.js';

describe('createTIndicator', () => {
  let indicator;

  beforeEach(() => {
    indicator = createTIndicator();
  });

  describe('initialization', () => {
    it('should create indicator controller', () => {
      expect(indicator).toBeDefined();
      expect(indicator.updateText).toBeInstanceOf(Function);
      expect(indicator.show).toBeInstanceOf(Function);
      expect(indicator.hide).toBeInstanceOf(Function);
      expect(indicator.getElement).toBeInstanceOf(Function);
    });

    it('should expose element property', () => {
      expect(indicator.element).toBeInstanceOf(HTMLElement);
      expect(indicator.element.tagName).toBe('DIV');
    });

    it('should apply custom className', () => {
      const customIndicator = createTIndicator({
        className: 'custom-class'
      });

      expect(customIndicator.element.className).toBe('custom-class');
    });

    it('should start with empty text', () => {
      expect(indicator.element.textContent).toBe('');
    });
  });

  describe('updateText()', () => {
    it('should update text with number value', () => {
      indicator.updateText(5.234);

      expect(indicator.element.textContent).toBe('5.2');
    });

    it('should round to 1 decimal place', () => {
      indicator.updateText(3.96);

      expect(indicator.element.textContent).toBe('4');
    });

    it('should handle integer values', () => {
      indicator.updateText(10);

      expect(indicator.element.textContent).toBe('10');
    });

    it('should handle string numbers', () => {
      indicator.updateText('7.85');

      expect(indicator.element.textContent).toBe('7.9');
    });

    it('should handle empty string', () => {
      indicator.updateText('');

      expect(indicator.element.textContent).toBe('');
    });

    it('should handle null/undefined', () => {
      indicator.updateText(null);
      expect(indicator.element.textContent).toBe('');

      indicator.updateText(undefined);
      expect(indicator.element.textContent).toBe('');
    });

    it('should handle non-numeric strings', () => {
      indicator.updateText('not a number');

      expect(indicator.element.textContent).toBe('not a number');
    });

    it('should handle NaN', () => {
      indicator.updateText(NaN);

      expect(indicator.element.textContent).toBe('NaN');
    });
  });

  describe('show()', () => {
    it('should set visibility to visible', () => {
      indicator.show();

      expect(indicator.element.style.visibility).toBe('visible');
    });
  });

  describe('hide()', () => {
    it('should set visibility to hidden', () => {
      indicator.element.style.visibility = 'visible';
      indicator.hide();

      expect(indicator.element.style.visibility).toBe('hidden');
    });
  });

  describe('getElement()', () => {
    it('should return the DOM element', () => {
      const element = indicator.getElement();

      expect(element).toBe(indicator.element);
      expect(element.tagName).toBe('DIV');
    });
  });

  describe('custom formatValue', () => {
    it('should use custom formatter', () => {
      const customIndicator = createTIndicator({
        formatValue: (v) => `T=${v}s`
      });

      customIndicator.updateText(2.5);

      expect(customIndicator.element.textContent).toBe('T=2.5s');
    });

    it('should handle custom formatter returning empty string', () => {
      const customIndicator = createTIndicator({
        formatValue: (v) => v > 10 ? String(v) : ''
      });

      customIndicator.updateText(5);
      expect(customIndicator.element.textContent).toBe('');

      customIndicator.updateText(15);
      expect(customIndicator.element.textContent).toBe('15');
    });
  });

  describe('integration scenarios', () => {
    it('should handle typical workflow: update then show', () => {
      indicator.updateText(3.7);
      indicator.show();

      expect(indicator.element.textContent).toBe('3.7');
      expect(indicator.element.style.visibility).toBe('visible');
    });

    it('should handle showing before updating', () => {
      indicator.show();
      indicator.updateText(2.1);

      expect(indicator.element.textContent).toBe('2.1');
      expect(indicator.element.style.visibility).toBe('visible');
    });

    it('should handle multiple updates', () => {
      indicator.updateText(1.0);
      expect(indicator.element.textContent).toBe('1');

      indicator.updateText(2.5);
      expect(indicator.element.textContent).toBe('2.5');

      indicator.updateText('');
      expect(indicator.element.textContent).toBe('');
    });

    it('should handle show/hide cycles', () => {
      indicator.show();
      expect(indicator.element.style.visibility).toBe('visible');

      indicator.hide();
      expect(indicator.element.style.visibility).toBe('hidden');

      indicator.show();
      expect(indicator.element.style.visibility).toBe('visible');
    });
  });

  describe('edge cases', () => {
    it('should handle very small numbers', () => {
      indicator.updateText(0.001);

      expect(indicator.element.textContent).toBe('0');
    });

    it('should handle very large numbers', () => {
      indicator.updateText(9999.99);

      expect(indicator.element.textContent).toBe('10000');
    });

    it('should handle negative numbers', () => {
      indicator.updateText(-5.7);

      expect(indicator.element.textContent).toBe('-5.7');
    });

    it('should handle zero', () => {
      indicator.updateText(0);

      expect(indicator.element.textContent).toBe('0');
    });
  });
});
