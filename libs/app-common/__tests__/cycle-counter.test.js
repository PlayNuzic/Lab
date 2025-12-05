/**
 * Tests for cycle-counter.js
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';
import { createCycleCounter } from '../cycle-counter.js';

describe('cycle-counter', () => {
  let element;

  beforeEach(() => {
    element = document.createElement('div');
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('createCycleCounter', () => {
    test('returns null controller when element is missing', () => {
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();

      const counter = createCycleCounter({ element: null });

      expect(consoleWarn).toHaveBeenCalled();
      expect(counter.element).toBeNull();
      expect(counter.getValue()).toBeNull();

      // Should not throw
      counter.update(1);
      counter.clear();
      counter.showTotal(3);

      consoleWarn.mockRestore();
    });

    test('creates controller with element', () => {
      const counter = createCycleCounter({ element });

      expect(counter.element).toBe(element);
    });

    describe('update', () => {
      test('shows flip-out animation immediately', () => {
        const counter = createCycleCounter({ element });

        counter.update(1);

        expect(element.classList.contains('flip-out')).toBe(true);
      });

      test('completes flip animation after duration', () => {
        const counter = createCycleCounter({ element, flipDuration: 150 });

        counter.update(1);

        // After flip-out duration
        jest.advanceTimersByTime(150);

        expect(element.classList.contains('flip-out')).toBe(false);
        expect(element.classList.contains('flip-in')).toBe(true);
        expect(element.textContent).toBe('1');

        // After flip-in duration
        jest.advanceTimersByTime(150);

        expect(element.classList.contains('flip-in')).toBe(false);
      });

      test('applies zero class when isZero is true', () => {
        const counter = createCycleCounter({ element });

        counter.update(1, true);

        expect(element.classList.contains('playing-zero')).toBe(true);
        expect(element.classList.contains('playing-active')).toBe(false);
      });

      test('applies active class when isZero is false', () => {
        const counter = createCycleCounter({ element });

        counter.update(1, false);

        expect(element.classList.contains('playing-active')).toBe(true);
        expect(element.classList.contains('playing-zero')).toBe(false);
      });

      test('uses custom class names', () => {
        const counter = createCycleCounter({
          element,
          zeroClass: 'custom-zero',
          activeClass: 'custom-active'
        });

        counter.update(1, true);
        expect(element.classList.contains('custom-zero')).toBe(true);

        counter.update(2, false);
        expect(element.classList.contains('custom-active')).toBe(true);
      });

      test('skips animation when value unchanged and already displayed', () => {
        const counter = createCycleCounter({ element });

        counter.update(1);
        jest.advanceTimersByTime(300); // Complete first animation

        element.classList.remove('flip-out', 'flip-in'); // Reset classes

        counter.update(1); // Same value

        expect(element.classList.contains('flip-out')).toBe(false);
      });
    });

    describe('updateColor', () => {
      test('updates color without animation', () => {
        const counter = createCycleCounter({ element });

        counter.updateColor(true);
        expect(element.classList.contains('playing-zero')).toBe(true);

        counter.updateColor(false);
        expect(element.classList.contains('playing-active')).toBe(true);
        expect(element.classList.contains('playing-zero')).toBe(false);
      });
    });

    describe('clear', () => {
      test('clears content and removes all classes', () => {
        const counter = createCycleCounter({ element });

        counter.update(5, true);
        jest.advanceTimersByTime(300);

        counter.clear();

        expect(element.textContent).toBe('');
        expect(element.classList.contains('flip-out')).toBe(false);
        expect(element.classList.contains('flip-in')).toBe(false);
        expect(element.classList.contains('playing-zero')).toBe(false);
        expect(element.classList.contains('playing-active')).toBe(false);
      });

      test('cancels pending animations', () => {
        const counter = createCycleCounter({ element });

        counter.update(5);

        counter.clear();

        jest.advanceTimersByTime(300);

        expect(element.textContent).toBe('');
      });

      test('resets getValue to null', () => {
        const counter = createCycleCounter({ element });

        counter.setValue(5);
        expect(counter.getValue()).toBe(5);

        counter.clear();
        expect(counter.getValue()).toBeNull();
      });
    });

    describe('showTotal', () => {
      test('shows empty when both values are 0', () => {
        const counter = createCycleCounter({ element });

        counter.showTotal(0, 0);

        expect(element.innerHTML).toBe('');
      });

      test('shows only complete cycles when no remainder', () => {
        const counter = createCycleCounter({ element });

        counter.showTotal(3, 0);

        expect(element.innerHTML).toBe('3');
      });

      test('shows complete cycles with remainder subscript', () => {
        const counter = createCycleCounter({ element });

        counter.showTotal(2, 3);

        expect(element.innerHTML).toBe('2<sub>3</sub>');
      });

      test('removes color classes', () => {
        const counter = createCycleCounter({ element });

        counter.update(1, true);
        jest.advanceTimersByTime(300);

        counter.showTotal(3);

        expect(element.classList.contains('playing-zero')).toBe(false);
        expect(element.classList.contains('playing-active')).toBe(false);
      });
    });

    describe('setValue', () => {
      test('sets value without animation', () => {
        const counter = createCycleCounter({ element });

        counter.setValue(5);

        expect(element.textContent).toBe('5');
        expect(element.classList.contains('flip-out')).toBe(false);
        expect(element.classList.contains('flip-in')).toBe(false);
      });

      test('applies color state', () => {
        const counter = createCycleCounter({ element });

        counter.setValue(1, true);
        expect(element.classList.contains('playing-zero')).toBe(true);

        counter.setValue(2, false);
        expect(element.classList.contains('playing-active')).toBe(true);
      });
    });

    describe('getValue', () => {
      test('returns null initially', () => {
        const counter = createCycleCounter({ element });

        expect(counter.getValue()).toBeNull();
      });

      test('returns current value after update', () => {
        const counter = createCycleCounter({ element });

        counter.update(7);

        expect(counter.getValue()).toBe(7);
      });

      test('returns current value after setValue', () => {
        const counter = createCycleCounter({ element });

        counter.setValue(3);

        expect(counter.getValue()).toBe(3);
      });
    });
  });
});
