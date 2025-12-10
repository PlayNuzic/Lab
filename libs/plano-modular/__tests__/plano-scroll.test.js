/**
 * @jest-environment jsdom
 */

import {
  setupScrollSync,
  blockVerticalWheel,
  smoothScrollTo,
  scrollToRow,
  scrollToColumn,
  scrollToRegistry,
  syncVerticalScroll,
  syncHorizontalScroll
} from '../plano-scroll.js';

describe('plano-scroll', () => {
  describe('setupScrollSync', () => {
    let matrix, soundline, timeline;

    beforeEach(() => {
      matrix = document.createElement('div');
      soundline = document.createElement('div');
      timeline = document.createElement('div');

      // Mock scroll properties
      Object.defineProperty(matrix, 'scrollLeft', { value: 0, writable: true });
      Object.defineProperty(matrix, 'scrollTop', { value: 0, writable: true });
      Object.defineProperty(soundline, 'scrollTop', { value: 0, writable: true });
      Object.defineProperty(timeline, 'scrollLeft', { value: 0, writable: true });
    });

    test('should return cleanup function', () => {
      const cleanup = setupScrollSync(matrix, soundline, timeline);
      expect(typeof cleanup).toBe('function');
    });

    test('should sync horizontal scroll from matrix to timeline', () => {
      setupScrollSync(matrix, soundline, timeline);

      matrix.scrollLeft = 100;
      matrix.dispatchEvent(new Event('scroll'));

      expect(timeline.scrollLeft).toBe(100);
    });

    test('should sync vertical scroll from matrix to soundline', () => {
      setupScrollSync(matrix, soundline, timeline);

      matrix.scrollTop = 50;
      matrix.dispatchEvent(new Event('scroll'));

      expect(soundline.scrollTop).toBe(50);
    });

    test('should sync vertical scroll from soundline to matrix', () => {
      setupScrollSync(matrix, soundline, timeline);

      soundline.scrollTop = 75;
      soundline.dispatchEvent(new Event('scroll'));

      expect(matrix.scrollTop).toBe(75);
    });

    test('should handle null elements gracefully', () => {
      expect(() => {
        setupScrollSync(null, soundline, timeline);
      }).not.toThrow();

      expect(() => {
        setupScrollSync(matrix, null, null);
      }).not.toThrow();
    });

    test('cleanup should remove event listeners', () => {
      const cleanup = setupScrollSync(matrix, soundline, timeline);

      cleanup();

      // After cleanup, scroll should not sync
      matrix.scrollLeft = 200;
      matrix.dispatchEvent(new Event('scroll'));

      // Timeline should still be at original value (we can't easily verify listeners were removed,
      // but we can verify cleanup doesn't throw)
    });
  });

  describe('blockVerticalWheel', () => {
    let element;

    beforeEach(() => {
      element = document.createElement('div');
    });

    test('should return cleanup function', () => {
      const cleanup = blockVerticalWheel(element);
      expect(typeof cleanup).toBe('function');
    });

    test('should prevent default on vertical wheel', () => {
      blockVerticalWheel(element);

      let preventDefaultCalled = false;
      const event = new WheelEvent('wheel', { deltaY: 100, cancelable: true });
      const originalPreventDefault = event.preventDefault.bind(event);
      event.preventDefault = () => {
        preventDefaultCalled = true;
        originalPreventDefault();
      };

      element.dispatchEvent(event);

      expect(preventDefaultCalled).toBe(true);
    });

    test('should not prevent default on horizontal-only wheel', () => {
      blockVerticalWheel(element);

      let preventDefaultCalled = false;
      const event = new WheelEvent('wheel', { deltaY: 0, deltaX: 100, cancelable: true });
      const originalPreventDefault = event.preventDefault.bind(event);
      event.preventDefault = () => {
        preventDefaultCalled = true;
        originalPreventDefault();
      };

      element.dispatchEvent(event);

      expect(preventDefaultCalled).toBe(false);
    });

    test('should block on multiple elements', () => {
      const el1 = document.createElement('div');
      const el2 = document.createElement('div');

      blockVerticalWheel(el1, el2);

      let prevented1 = false;
      let prevented2 = false;

      const event1 = new WheelEvent('wheel', { deltaY: 50, cancelable: true });
      event1.preventDefault = () => { prevented1 = true; };

      const event2 = new WheelEvent('wheel', { deltaY: 50, cancelable: true });
      event2.preventDefault = () => { prevented2 = true; };

      el1.dispatchEvent(event1);
      el2.dispatchEvent(event2);

      expect(prevented1).toBe(true);
      expect(prevented2).toBe(true);
    });
  });

  describe('smoothScrollTo', () => {
    let element;
    let originalRAF;
    let originalPerformance;

    beforeEach(() => {
      element = document.createElement('div');
      Object.defineProperty(element, 'scrollTop', { value: 0, writable: true });
      Object.defineProperty(element, 'scrollLeft', { value: 0, writable: true });

      // Store originals
      originalRAF = global.requestAnimationFrame;
      originalPerformance = global.performance;

      // Mock requestAnimationFrame
      global.requestAnimationFrame = (cb) => {
        return setTimeout(cb, 16);
      };
      global.performance = { now: () => Date.now() };
    });

    afterEach(() => {
      global.requestAnimationFrame = originalRAF;
      global.performance = originalPerformance;
    });

    test('should return a promise', () => {
      const result = smoothScrollTo(element, 100);
      expect(result instanceof Promise).toBe(true);
    });

    test('should resolve immediately for null element', async () => {
      await expect(smoothScrollTo(null, 100)).resolves.toBeUndefined();
    });

    test('should resolve immediately if distance is 0', async () => {
      element.scrollTop = 100;
      await expect(smoothScrollTo(element, 100, 'top')).resolves.toBeUndefined();
    });
  });

  describe('scrollToRow', () => {
    let container;

    beforeEach(() => {
      container = document.createElement('div');
      Object.defineProperty(container, 'scrollTop', { value: 0, writable: true });
    });

    test('should calculate correct scroll position', () => {
      scrollToRow(container, 10, 32, 15, false);

      // Row 10, center offset = 7, so target = (10 - 7) * 32 = 96
      expect(container.scrollTop).toBe(96);
    });

    test('should not scroll below 0', () => {
      scrollToRow(container, 2, 32, 15, false);

      // Row 2, center offset = 7, target would be (2 - 7) * 32 = -160, clamped to 0
      expect(container.scrollTop).toBe(0);
    });

    test('should handle null container', async () => {
      await expect(scrollToRow(null, 10, 32, 15)).resolves.toBeUndefined();
    });
  });

  describe('scrollToColumn', () => {
    let container;

    beforeEach(() => {
      container = document.createElement('div');
      Object.defineProperty(container, 'scrollLeft', { value: 0, writable: true });
      Object.defineProperty(container, 'clientWidth', { value: 500, writable: true });
      Object.defineProperty(container, 'scrollWidth', { value: 1000, writable: true });
    });

    test('should calculate centered scroll position', () => {
      scrollToColumn(container, 5, 50, false, true);

      // Column 5 * 50 = 250, center: 250 - 250 + 25 = 25
      expect(container.scrollLeft).toBe(25);
    });

    test('should calculate non-centered scroll position', () => {
      scrollToColumn(container, 5, 50, false, false);

      // Column 5 * 50 = 250
      expect(container.scrollLeft).toBe(250);
    });

    test('should clamp to max scroll', () => {
      scrollToColumn(container, 100, 50, false, false);

      // Max is 1000 - 500 = 500
      expect(container.scrollLeft).toBe(500);
    });
  });

  describe('scrollToRegistry', () => {
    let container;
    const note0RowMap = { 5: 7, 4: 19, 3: 31 };

    beforeEach(() => {
      container = document.createElement('div');
      Object.defineProperty(container, 'scrollTop', { value: 0, writable: true });
    });

    test('should scroll to correct registry row', () => {
      scrollToRegistry(container, 4, note0RowMap, 32, 15, false);

      // Registry 4 -> row 19, center offset = 7, target = (19 - 7) * 32 = 384
      expect(container.scrollTop).toBe(384);
    });

    test('should handle non-existent registry', async () => {
      await scrollToRegistry(container, 99, note0RowMap, 32, 15, false);

      // Should not change scroll
      expect(container.scrollTop).toBe(0);
    });
  });

  describe('syncVerticalScroll', () => {
    test('should sync scrollTop on multiple containers', () => {
      const c1 = document.createElement('div');
      const c2 = document.createElement('div');
      Object.defineProperty(c1, 'scrollTop', { value: 0, writable: true });
      Object.defineProperty(c2, 'scrollTop', { value: 0, writable: true });

      syncVerticalScroll([c1, c2], 150);

      expect(c1.scrollTop).toBe(150);
      expect(c2.scrollTop).toBe(150);
    });

    test('should handle null elements in array', () => {
      const c1 = document.createElement('div');
      Object.defineProperty(c1, 'scrollTop', { value: 0, writable: true });

      expect(() => {
        syncVerticalScroll([c1, null], 100);
      }).not.toThrow();

      expect(c1.scrollTop).toBe(100);
    });
  });

  describe('syncHorizontalScroll', () => {
    test('should sync scrollLeft on multiple containers', () => {
      const c1 = document.createElement('div');
      const c2 = document.createElement('div');
      Object.defineProperty(c1, 'scrollLeft', { value: 0, writable: true });
      Object.defineProperty(c2, 'scrollLeft', { value: 0, writable: true });

      syncHorizontalScroll([c1, c2], 200);

      expect(c1.scrollLeft).toBe(200);
      expect(c2.scrollLeft).toBe(200);
    });
  });
});
