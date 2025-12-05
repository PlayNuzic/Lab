/**
 * Tests for spinner-repeat.js
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';
import { attachSpinnerRepeat, addRepeatPress } from '../spinner-repeat.js';

describe('spinner-repeat', () => {
  let element;
  let callback;

  beforeEach(() => {
    element = document.createElement('button');
    callback = jest.fn();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('attachSpinnerRepeat', () => {
    test('returns cleanup function when element is null', () => {
      const cleanup = attachSpinnerRepeat(null, callback);
      expect(typeof cleanup).toBe('function');
      expect(cleanup).not.toThrow();
    });

    test('calls callback immediately on mousedown', () => {
      attachSpinnerRepeat(element, callback);

      element.dispatchEvent(new MouseEvent('mousedown'));

      expect(callback).toHaveBeenCalledTimes(1);
    });

    test('calls callback immediately on touchstart', () => {
      attachSpinnerRepeat(element, callback);

      element.dispatchEvent(new TouchEvent('touchstart'));

      expect(callback).toHaveBeenCalledTimes(1);
    });

    test('starts repeating after initial delay', () => {
      attachSpinnerRepeat(element, callback);

      element.dispatchEvent(new MouseEvent('mousedown'));
      expect(callback).toHaveBeenCalledTimes(1);

      // Advance past initial delay (320ms)
      jest.advanceTimersByTime(320);

      // After initial delay, first interval tick
      jest.advanceTimersByTime(80);
      expect(callback).toHaveBeenCalledTimes(2);

      // Another interval tick
      jest.advanceTimersByTime(80);
      expect(callback).toHaveBeenCalledTimes(3);
    });

    test('stops repeating on mouseup', () => {
      attachSpinnerRepeat(element, callback);

      element.dispatchEvent(new MouseEvent('mousedown'));
      jest.advanceTimersByTime(400); // Past initial delay

      const callsBefore = callback.mock.calls.length;

      element.dispatchEvent(new MouseEvent('mouseup'));
      jest.advanceTimersByTime(200);

      expect(callback.mock.calls.length).toBe(callsBefore);
    });

    test('stops repeating on mouseleave', () => {
      attachSpinnerRepeat(element, callback);

      element.dispatchEvent(new MouseEvent('mousedown'));
      jest.advanceTimersByTime(400);

      const callsBefore = callback.mock.calls.length;

      element.dispatchEvent(new MouseEvent('mouseleave'));
      jest.advanceTimersByTime(200);

      expect(callback.mock.calls.length).toBe(callsBefore);
    });

    test('stops repeating on touchend', () => {
      attachSpinnerRepeat(element, callback);

      element.dispatchEvent(new TouchEvent('touchstart'));
      jest.advanceTimersByTime(400);

      const callsBefore = callback.mock.calls.length;

      element.dispatchEvent(new TouchEvent('touchend'));
      jest.advanceTimersByTime(200);

      expect(callback.mock.calls.length).toBe(callsBefore);
    });

    test('stops repeating on touchcancel', () => {
      attachSpinnerRepeat(element, callback);

      element.dispatchEvent(new TouchEvent('touchstart'));
      jest.advanceTimersByTime(400);

      const callsBefore = callback.mock.calls.length;

      element.dispatchEvent(new TouchEvent('touchcancel'));
      jest.advanceTimersByTime(200);

      expect(callback.mock.calls.length).toBe(callsBefore);
    });

    test('uses custom initial delay', () => {
      attachSpinnerRepeat(element, callback, { initialDelay: 500 });

      element.dispatchEvent(new MouseEvent('mousedown'));
      expect(callback).toHaveBeenCalledTimes(1);

      // Advance 320ms (default) - should NOT have started repeating
      jest.advanceTimersByTime(320);
      expect(callback).toHaveBeenCalledTimes(1);

      // Advance to 500ms - should start repeating
      jest.advanceTimersByTime(180);
      jest.advanceTimersByTime(80); // First interval
      expect(callback).toHaveBeenCalledTimes(2);
    });

    test('uses custom repeat interval', () => {
      attachSpinnerRepeat(element, callback, { repeatInterval: 50 });

      element.dispatchEvent(new MouseEvent('mousedown'));
      jest.advanceTimersByTime(320); // Past initial delay

      // With 50ms interval, should have more calls in same time
      jest.advanceTimersByTime(100);
      expect(callback.mock.calls.length).toBeGreaterThan(2);
    });

    test('cleanup function removes event listeners', () => {
      const cleanup = attachSpinnerRepeat(element, callback);

      cleanup();

      element.dispatchEvent(new MouseEvent('mousedown'));
      expect(callback).not.toHaveBeenCalled();
    });

    test('cleanup function clears pending timers', () => {
      const cleanup = attachSpinnerRepeat(element, callback);

      element.dispatchEvent(new MouseEvent('mousedown'));
      expect(callback).toHaveBeenCalledTimes(1);

      cleanup();

      jest.advanceTimersByTime(500);
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('addRepeatPress (legacy alias)', () => {
    test('is same function as attachSpinnerRepeat', () => {
      expect(addRepeatPress).toBe(attachSpinnerRepeat);
    });
  });
});
