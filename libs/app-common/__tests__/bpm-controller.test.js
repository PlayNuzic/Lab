/**
 * Tests for bpm-controller.js
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';
import { createBpmController } from '../bpm-controller.js';

describe('bpm-controller', () => {
  let inputEl;
  let upBtn;
  let downBtn;
  let container;

  beforeEach(() => {
    inputEl = document.createElement('input');
    inputEl.type = 'number';
    upBtn = document.createElement('button');
    downBtn = document.createElement('button');
    container = document.createElement('div');
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('createBpmController', () => {
    test('returns null controller when inputEl is missing', () => {
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();

      const controller = createBpmController({ inputEl: null });

      expect(consoleWarn).toHaveBeenCalled();
      expect(controller.inputEl).toBeNull();
      expect(controller.getValue()).toBe(100);

      consoleWarn.mockRestore();
    });

    test('creates controller with default values', () => {
      const controller = createBpmController({ inputEl });

      expect(controller.getValue()).toBe(100);
      expect(controller.min).toBe(30);
      expect(controller.max).toBe(300);
      expect(inputEl.value).toBe('100');
    });

    test('creates controller with custom values', () => {
      const controller = createBpmController({
        inputEl,
        min: 40,
        max: 200,
        defaultValue: 120
      });

      expect(controller.getValue()).toBe(120);
      expect(controller.min).toBe(40);
      expect(controller.max).toBe(200);
    });

    describe('setValue', () => {
      test('updates BPM value', () => {
        const controller = createBpmController({ inputEl });

        controller.setValue(120);

        expect(controller.getValue()).toBe(120);
        expect(inputEl.value).toBe('120');
      });

      test('clamps to min value', () => {
        const controller = createBpmController({ inputEl, min: 30 });

        controller.setValue(10);

        expect(controller.getValue()).toBe(30);
      });

      test('clamps to max value', () => {
        const controller = createBpmController({ inputEl, max: 300 });

        controller.setValue(500);

        expect(controller.getValue()).toBe(300);
      });

      test('ignores NaN values', () => {
        const controller = createBpmController({ inputEl, defaultValue: 100 });

        controller.setValue('abc');

        expect(controller.getValue()).toBe(100);
      });

      test('parses string values', () => {
        const controller = createBpmController({ inputEl });

        controller.setValue('150');

        expect(controller.getValue()).toBe(150);
      });

      test('calls onChange callback', () => {
        const onChange = jest.fn();
        const controller = createBpmController({ inputEl, onChange });

        controller.setValue(150);

        expect(onChange).toHaveBeenCalledWith(150);
      });

      test('skips onChange callback when requested', () => {
        const onChange = jest.fn();
        const controller = createBpmController({ inputEl, onChange });

        controller.setValue(150, true);

        expect(onChange).not.toHaveBeenCalled();
      });

      test('does not call onChange when value unchanged', () => {
        const onChange = jest.fn();
        const controller = createBpmController({ inputEl, defaultValue: 100, onChange });

        controller.setValue(100);

        expect(onChange).not.toHaveBeenCalled();
      });
    });

    describe('increment', () => {
      test('increases BPM by 1', () => {
        const controller = createBpmController({ inputEl, defaultValue: 100 });

        controller.increment();

        expect(controller.getValue()).toBe(101);
      });

      test('does not exceed max', () => {
        const controller = createBpmController({ inputEl, defaultValue: 300, max: 300 });

        controller.increment();

        expect(controller.getValue()).toBe(300);
      });
    });

    describe('decrement', () => {
      test('decreases BPM by 1', () => {
        const controller = createBpmController({ inputEl, defaultValue: 100 });

        controller.decrement();

        expect(controller.getValue()).toBe(99);
      });

      test('does not go below min', () => {
        const controller = createBpmController({ inputEl, defaultValue: 30, min: 30 });

        controller.decrement();

        expect(controller.getValue()).toBe(30);
      });
    });

    describe('setVisible', () => {
      test('adds visible class when true', () => {
        const controller = createBpmController({ inputEl, container });

        controller.setVisible(true);

        expect(container.classList.contains('visible')).toBe(true);
      });

      test('removes visible class when false', () => {
        const controller = createBpmController({ inputEl, container });
        container.classList.add('visible');

        controller.setVisible(false);

        expect(container.classList.contains('visible')).toBe(false);
      });

      test('does nothing without container', () => {
        const controller = createBpmController({ inputEl });

        // Should not throw
        controller.setVisible(true);
      });
    });

    describe('attach', () => {
      test('handles input events', () => {
        const onChange = jest.fn();
        const controller = createBpmController({ inputEl, onChange });

        controller.attach();

        inputEl.value = '150';
        inputEl.dispatchEvent(new Event('input'));

        expect(controller.getValue()).toBe(150);
        expect(onChange).toHaveBeenCalledWith(150);
      });

      test('handles blur events', () => {
        const controller = createBpmController({ inputEl });

        controller.attach();

        inputEl.value = '120';
        inputEl.dispatchEvent(new Event('blur'));

        expect(controller.getValue()).toBe(120);
      });

      test('attaches spinner repeat to buttons', () => {
        const controller = createBpmController({ inputEl, upBtn, downBtn, defaultValue: 100 });

        controller.attach();

        upBtn.dispatchEvent(new MouseEvent('mousedown'));

        expect(controller.getValue()).toBe(101);
      });
    });

    describe('detach', () => {
      test('removes input event listeners', () => {
        const onChange = jest.fn();
        const controller = createBpmController({ inputEl, onChange, defaultValue: 100 });

        controller.attach();
        controller.detach();

        inputEl.value = '200';
        inputEl.dispatchEvent(new Event('input'));

        expect(onChange).not.toHaveBeenCalled();
        expect(controller.getValue()).toBe(100);
      });

      test('removes spinner event listeners', () => {
        const controller = createBpmController({ inputEl, upBtn, downBtn, defaultValue: 100 });

        controller.attach();
        controller.detach();

        upBtn.dispatchEvent(new MouseEvent('mousedown'));

        expect(controller.getValue()).toBe(100);
      });
    });
  });
});
