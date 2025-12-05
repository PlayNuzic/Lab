/**
 * Tests for total-length-display.js
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';
import { createTotalLengthDisplay } from '../total-length-display.js';

describe('total-length-display', () => {
  let digitElement;

  beforeEach(() => {
    digitElement = document.createElement('span');
    digitElement.className = 'total-length__digit';
    document.body.appendChild(digitElement);
    jest.useFakeTimers();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.useRealTimers();
  });

  describe('basic operations', () => {
    it('should update display value without animation', () => {
      const controller = createTotalLengthDisplay({
        digitElement,
        getTotal: () => 12,
        getPulsosPerCycle: () => 4
      });

      controller.update(42);
      expect(digitElement.textContent).toBe('42');
    });

    it('should show total on showTotal()', () => {
      const controller = createTotalLengthDisplay({
        digitElement,
        getTotal: () => 16,
        getPulsosPerCycle: () => 4
      });

      controller.showTotal();
      jest.advanceTimersByTime(300);
      expect(digitElement.textContent).toBe('16');
    });

    it('should show empty value when total is invalid', () => {
      const controller = createTotalLengthDisplay({
        digitElement,
        getTotal: () => null,
        getPulsosPerCycle: () => 4
      });

      controller.showTotal();
      expect(digitElement.textContent).toBe('--');
    });

    it('should use custom empty value', () => {
      const controller = createTotalLengthDisplay({
        digitElement,
        getTotal: () => NaN,
        getPulsosPerCycle: () => 4,
        emptyValue: '?'
      });

      controller.showTotal();
      expect(digitElement.textContent).toBe('?');
    });
  });

  describe('flip animation', () => {
    it('should add flip-out class during animation', () => {
      const controller = createTotalLengthDisplay({
        digitElement,
        getTotal: () => 10,
        getPulsosPerCycle: () => 5
      });

      controller.updateWithAnimation(10);
      expect(digitElement.classList.contains('flip-out')).toBe(true);
    });

    it('should update value and add flip-in after timeout', () => {
      const controller = createTotalLengthDisplay({
        digitElement,
        getTotal: () => 10,
        getPulsosPerCycle: () => 5
      });

      controller.updateWithAnimation(99);
      jest.advanceTimersByTime(150);

      expect(digitElement.textContent).toBe('99');
      expect(digitElement.classList.contains('flip-out')).toBe(false);
      expect(digitElement.classList.contains('flip-in')).toBe(true);
    });

    it('should remove flip-in class after animation completes', () => {
      const controller = createTotalLengthDisplay({
        digitElement,
        getTotal: () => 10,
        getPulsosPerCycle: () => 5
      });

      controller.updateWithAnimation(99);
      jest.advanceTimersByTime(300);

      expect(digitElement.classList.contains('flip-in')).toBe(false);
    });

    it('should skip animation if value unchanged', () => {
      digitElement.textContent = '42';
      const controller = createTotalLengthDisplay({
        digitElement,
        getTotal: () => 42,
        getPulsosPerCycle: () => 4
      });

      controller.updateWithAnimation(42);
      expect(digitElement.classList.contains('flip-out')).toBe(false);
    });
  });

  describe('global step during playback', () => {
    it('should calculate global step correctly', () => {
      const controller = createTotalLengthDisplay({
        digitElement,
        getTotal: () => 16,
        getPulsosPerCycle: () => 4
      });

      // Cycle 1, step 0 → global step 1
      controller.updateGlobalStep(0, 1);
      jest.advanceTimersByTime(300);
      expect(controller.getGlobalStep()).toBe(1);

      // Cycle 1, step 3 → global step 4
      controller.updateGlobalStep(3, 1);
      jest.advanceTimersByTime(300);
      expect(controller.getGlobalStep()).toBe(4);

      // Cycle 2, step 0 → global step 5
      controller.updateGlobalStep(0, 2);
      jest.advanceTimersByTime(300);
      expect(controller.getGlobalStep()).toBe(5);

      // Cycle 3, step 2 → global step 11
      controller.updateGlobalStep(2, 3);
      jest.advanceTimersByTime(300);
      expect(controller.getGlobalStep()).toBe(11);
    });

    it('should apply playing-zero class on first step', () => {
      const controller = createTotalLengthDisplay({
        digitElement,
        getTotal: () => 16,
        getPulsosPerCycle: () => 4
      });

      controller.updateGlobalStep(0, 1);
      expect(digitElement.classList.contains('playing-zero')).toBe(true);
      expect(digitElement.classList.contains('playing-active')).toBe(false);
    });

    it('should apply playing-active class on other steps', () => {
      const controller = createTotalLengthDisplay({
        digitElement,
        getTotal: () => 16,
        getPulsosPerCycle: () => 4
      });

      controller.updateGlobalStep(1, 1);
      expect(digitElement.classList.contains('playing-zero')).toBe(false);
      expect(digitElement.classList.contains('playing-active')).toBe(true);
    });

    it('should use custom CSS classes', () => {
      const controller = createTotalLengthDisplay({
        digitElement,
        getTotal: () => 16,
        getPulsosPerCycle: () => 4,
        playingZeroClass: 'custom-zero',
        playingActiveClass: 'custom-active'
      });

      controller.updateGlobalStep(0, 1);
      expect(digitElement.classList.contains('custom-zero')).toBe(true);

      controller.updateGlobalStep(1, 1);
      expect(digitElement.classList.contains('custom-active')).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset global step to 0', () => {
      const controller = createTotalLengthDisplay({
        digitElement,
        getTotal: () => 16,
        getPulsosPerCycle: () => 4
      });

      controller.updateGlobalStep(2, 3);
      expect(controller.getGlobalStep()).toBe(11);

      controller.reset();
      expect(controller.getGlobalStep()).toBe(0);
    });

    it('should remove playing classes', () => {
      const controller = createTotalLengthDisplay({
        digitElement,
        getTotal: () => 16,
        getPulsosPerCycle: () => 4
      });

      controller.updateGlobalStep(1, 1);
      expect(digitElement.classList.contains('playing-active')).toBe(true);

      controller.reset();
      expect(digitElement.classList.contains('playing-zero')).toBe(false);
      expect(digitElement.classList.contains('playing-active')).toBe(false);
    });

    it('should show total after reset', () => {
      const controller = createTotalLengthDisplay({
        digitElement,
        getTotal: () => 20,
        getPulsosPerCycle: () => 4
      });

      controller.updateGlobalStep(2, 3);
      controller.reset();
      jest.advanceTimersByTime(300);

      expect(digitElement.textContent).toBe('20');
    });
  });

  describe('setPlaying', () => {
    it('should set playing state to true', () => {
      const controller = createTotalLengthDisplay({
        digitElement,
        getTotal: () => 16,
        getPulsosPerCycle: () => 4
      });

      controller.setPlaying(true);
      expect(controller.isPlaying()).toBe(true);
    });

    it('should reset when setPlaying(false)', () => {
      const controller = createTotalLengthDisplay({
        digitElement,
        getTotal: () => 16,
        getPulsosPerCycle: () => 4
      });

      controller.updateGlobalStep(2, 2);
      controller.setPlaying(false);

      expect(controller.isPlaying()).toBe(false);
      expect(controller.getGlobalStep()).toBe(0);
    });
  });

  describe('showTotal during playback', () => {
    it('should not update during playback', () => {
      const controller = createTotalLengthDisplay({
        digitElement,
        getTotal: () => 100,
        getPulsosPerCycle: () => 4
      });

      controller.updateGlobalStep(1, 1);
      jest.advanceTimersByTime(300);
      const stepValue = digitElement.textContent;

      controller.showTotal();
      // Should not change because isPlaying is true
      expect(digitElement.textContent).toBe(stepValue);
    });
  });

  describe('edge cases', () => {
    it('should return no-op controller when element is null', () => {
      const controller = createTotalLengthDisplay({
        digitElement: null,
        getTotal: () => 10,
        getPulsosPerCycle: () => 4
      });

      // Should not throw
      controller.update(5);
      controller.updateGlobalStep(1, 1);
      controller.reset();
      expect(controller.getGlobalStep()).toBe(0);
      expect(controller.isPlaying()).toBe(false);
    });

    it('should handle getPulsosPerCycle returning 0', () => {
      const controller = createTotalLengthDisplay({
        digitElement,
        getTotal: () => 10,
        getPulsosPerCycle: () => 0
      });

      // Should not throw
      controller.updateGlobalStep(1, 1);
    });

    it('should show empty value when total is 0', () => {
      const controller = createTotalLengthDisplay({
        digitElement,
        getTotal: () => 0,
        getPulsosPerCycle: () => 4
      });

      controller.showTotal();
      expect(digitElement.textContent).toBe('--');
    });
  });

  describe('clearPlayingColors', () => {
    it('should remove playing classes without resetting', () => {
      const controller = createTotalLengthDisplay({
        digitElement,
        getTotal: () => 16,
        getPulsosPerCycle: () => 4
      });

      // Cycle 2, step 2 → globalStep = (2-1)*4 + 2 + 1 = 7
      controller.updateGlobalStep(2, 2);
      expect(controller.getGlobalStep()).toBe(7);
      expect(digitElement.classList.contains('playing-active')).toBe(true);

      controller.clearPlayingColors();
      expect(digitElement.classList.contains('playing-active')).toBe(false);
      expect(controller.getGlobalStep()).toBe(7); // Should not reset
    });
  });
});
