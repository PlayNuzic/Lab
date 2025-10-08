/**
 * Tests for circular-timeline.js
 */

import { createCircularTimeline } from '../circular-timeline.js';

describe('createCircularTimeline', () => {
  let timeline;
  let timelineWrapper;
  let mockPulses;

  beforeEach(() => {
    // Create mock DOM elements
    timeline = {
      innerHTML: '',
      classList: {
        _classes: new Set(),
        add(className) { this._classes.add(className); },
        remove(className) { this._classes.delete(className); },
        contains(className) { return this._classes.has(className); }
      },
      appendChild: function(element) {
        // Track appended elements for verification
        if (!timeline._children) timeline._children = [];
        timeline._children.push(element);
        return element;
      },
      querySelectorAll: function(selector) {
        if (!timeline._children) return [];
        if (selector === '.bar') {
          return timeline._children.filter(el => el.className?.includes('bar'));
        }
        return [];
      },
      getBoundingClientRect: function() {
        return {
          width: 400,
          height: 400,
          top: 0,
          left: 0
        };
      },
      closest: function() { return timelineWrapper; },
      parentElement: timelineWrapper,
      offsetHeight: 400,
      querySelector: function() { return null; }
    };

    timelineWrapper = {
      classList: {
        _classes: new Set(),
        add(className) { this._classes.add(className); },
        remove(className) { this._classes.delete(className); },
        contains(className) { return this._classes.has(className); }
      },
      querySelector: function() { return null; },
      appendChild: function() {},
      getBoundingClientRect: function() {
        return {
          width: 500,
          height: 500,
          top: 0,
          left: 0
        };
      }
    };

    mockPulses = [];

    // Mock requestAnimationFrame
    global.requestAnimationFrame = function(cb) {
      cb();
      return 1;
    };

    // Mock document for DOM operations
    global.document = {
      querySelectorAll: function() { return []; },
      createElement: function(tag) {
        return {
          tagName: tag.toUpperCase(),
          className: '',
          classList: {
            _classes: new Set(),
            add(className) { this._classes.add(className); },
            remove(className) { this._classes.delete(className); },
            contains(className) { return this._classes.has(className); }
          },
          dataset: {},
          style: {},
          textContent: '',
          remove: function() {}
        };
      }
    };
  });

  afterEach(() => {
    delete global.requestAnimationFrame;
    delete global.document;
  });

  describe('render()', () => {
    it('should create pulses for given lg', () => {
      const controller = createCircularTimeline({
        timeline,
        timelineWrapper,
        getPulses: () => mockPulses
      });

      const pulses = controller.render(5, { isCircular: false, silent: true });

      expect(pulses).toHaveLength(6); // 0 to 5 inclusive
      expect(timeline._children.length).toBeGreaterThan(0);
    });

    it('should create endpoint bars', () => {
      const controller = createCircularTimeline({
        timeline,
        timelineWrapper,
        getPulses: () => mockPulses
      });

      controller.render(5, { isCircular: false, silent: true });

      const bars = timeline._children.filter(el => el.className?.includes('bar'));
      expect(bars).toHaveLength(2); // Start and end bars
    });

    it('should mark first and last pulses as endpoints', () => {
      const controller = createCircularTimeline({
        timeline,
        timelineWrapper,
        getPulses: () => mockPulses
      });

      const pulses = controller.render(5, { isCircular: false, silent: true });

      expect(pulses[0].classList.contains('endpoint')).toBe(true);
      expect(pulses[5].classList.contains('endpoint')).toBe(true);
      expect(pulses[2].classList.contains('endpoint')).toBe(false);
    });

    it('should set dataset.index for each pulse', () => {
      const controller = createCircularTimeline({
        timeline,
        timelineWrapper,
        getPulses: () => mockPulses
      });

      const pulses = controller.render(3, { isCircular: false, silent: true });

      expect(pulses[0].dataset.index).toBe(0);
      expect(pulses[1].dataset.index).toBe(1);
      expect(pulses[2].dataset.index).toBe(2);
      expect(pulses[3].dataset.index).toBe(3);
    });

    it('should clear timeline before rendering', () => {
      const controller = createCircularTimeline({
        timeline,
        timelineWrapper,
        getPulses: () => mockPulses
      });

      timeline.innerHTML = '<div>old content</div>';
      controller.render(3, { isCircular: false, silent: true });

      expect(timeline.innerHTML).toBe('');
    });

    it('should return empty array for invalid lg', () => {
      const controller = createCircularTimeline({
        timeline,
        timelineWrapper,
        getPulses: () => mockPulses
      });

      expect(controller.render(NaN, { isCircular: false })).toEqual([]);
      expect(controller.render(0, { isCircular: false })).toEqual([]);
      expect(controller.render(-5, { isCircular: false })).toEqual([]);
    });

    it('should apply linear layout when isCircular is false', () => {
      const controller = createCircularTimeline({
        timeline,
        timelineWrapper,
        getPulses: () => mockPulses
      });

      controller.render(3, { isCircular: false, silent: true });

      expect(timelineWrapper.classList.contains('circular')).toBe(false);
      expect(timeline.classList.contains('circular')).toBe(false);
    });

    it('should apply circular layout when isCircular is true', () => {
      const controller = createCircularTimeline({
        timeline,
        timelineWrapper,
        getPulses: () => mockPulses
      });

      controller.render(3, { isCircular: true, silent: true });

      expect(timelineWrapper.classList.contains('circular')).toBe(true);
      expect(timeline.classList.contains('circular')).toBe(true);
    });

    it('should position pulses with percentage in linear mode', () => {
      const controller = createCircularTimeline({
        timeline,
        timelineWrapper,
        getPulses: () => mockPulses
      });

      const pulses = controller.render(4, { isCircular: false, silent: true });

      expect(pulses[0].style.left).toBe('0%');
      expect(pulses[2].style.left).toBe('50%');
      expect(pulses[4].style.left).toBe('100%');
    });
  });

  describe('setCircular()', () => {
    it('should switch from linear to circular', () => {
      mockPulses = Array.from({ length: 5 }, (_, i) => ({
        className: 'pulse',
        dataset: { index: String(i) },
        classList: {
          _classes: new Set(),
          add(className) { this._classes.add(className); },
          remove(className) { this._classes.delete(className); },
          contains(className) { return this._classes.has(className); }
        },
        style: {}
      }));

      if (mockPulses.length > 0) mockPulses[0].classList.add('endpoint');
      if (mockPulses.length > 0) mockPulses[mockPulses.length - 1].classList.add('endpoint');

      const controller = createCircularTimeline({
        timeline,
        timelineWrapper,
        getPulses: () => mockPulses
      });

      controller.setCircular(true, { silent: true });

      expect(timelineWrapper.classList.contains('circular')).toBe(true);
      expect(timeline.classList.contains('circular')).toBe(true);
    });

    it('should switch from circular to linear', () => {
      mockPulses = Array.from({ length: 5 }, (_, i) => ({
        className: 'pulse',
        dataset: { index: String(i) },
        classList: {
          _classes: new Set(),
          add(className) { this._classes.add(className); },
          remove(className) { this._classes.delete(className); },
          contains(className) { return this._classes.has(className); }
        },
        style: {}
      }));

      const controller = createCircularTimeline({
        timeline,
        timelineWrapper,
        getPulses: () => mockPulses
      });

      // Set circular first
      controller.setCircular(true, { silent: true });
      expect(timelineWrapper.classList.contains('circular')).toBe(true);

      // Switch to linear
      controller.setCircular(false, { silent: true });
      expect(timelineWrapper.classList.contains('circular')).toBe(false);
      expect(timeline.classList.contains('circular')).toBe(false);
    });

    it('should handle empty pulses array', () => {
      const controller = createCircularTimeline({
        timeline,
        timelineWrapper,
        getPulses: () => []
      });

      expect(() => controller.setCircular(true, { silent: true })).not.toThrow();
    });
  });

  describe('showNumber()', () => {
    it('should create number label element', () => {
      mockPulses = Array.from({ length: 4 }, (_, i) => ({
        className: 'pulse',
        dataset: { index: String(i) },
        classList: { contains: () => false },
        style: {}
      }));

      const controller = createCircularTimeline({
        timeline,
        timelineWrapper,
        getPulses: () => mockPulses
      });

      controller.showNumber(2);

      const numberEl = timeline._children.find(
        el => el.className === 'pulse-number'
      );
      expect(numberEl).toBeDefined();
      expect(numberEl.textContent).toBe(2); // Number, not string
    });

    it('should use custom font size if provided', () => {
      mockPulses = Array.from({ length: 10 }, (_, i) => ({
        className: 'pulse',
        dataset: { index: String(i) },
        classList: { contains: () => false },
        style: {}
      }));

      const controller = createCircularTimeline({
        timeline,
        timelineWrapper,
        getPulses: () => mockPulses,
        getNumberFontSize: (lg) => lg > 5 ? 1.2 : 1.6
      });

      controller.showNumber(3);

      const numberEl = timeline._children.find(
        el => el.className === 'pulse-number'
      );
      expect(numberEl.style.fontSize).toBe('1.2rem'); // lg=9, > 5
    });
  });

  describe('removeNumber()', () => {
    it('should remove number label at index', () => {
      let removed = false;
      const mockNumberElement = {
        remove: function() { removed = true; }
      };

      timeline.querySelector = function(selector) {
        if (selector === '.pulse-number[data-index="2"]') {
          return mockNumberElement;
        }
        return null;
      };

      const controller = createCircularTimeline({
        timeline,
        timelineWrapper,
        getPulses: () => mockPulses
      });

      controller.removeNumber(2);

      expect(removed).toBe(true);
    });

    it('should handle non-existent number gracefully', () => {
      timeline.querySelector = function() { return null; };

      const controller = createCircularTimeline({
        timeline,
        timelineWrapper,
        getPulses: () => mockPulses
      });

      expect(() => controller.removeNumber(99)).not.toThrow();
    });
  });

  describe('updateNumbers()', () => {
    it('should show endpoints for small lg', () => {
      mockPulses = Array.from({ length: 6 }, (_, i) => ({
        className: 'pulse',
        dataset: { index: String(i) },
        classList: {
          contains: (cls) => (i === 0 || i === 5) && cls === 'endpoint'
        },
        style: {}
      }));

      const controller = createCircularTimeline({
        timeline,
        timelineWrapper,
        getPulses: () => mockPulses
      });

      controller.updateNumbers();

      // Should call appendChild for all numbers (0 to 5)
      const numberElements = timeline._children.filter(
        el => el.className === 'pulse-number'
      );
      expect(numberElements.length).toBe(6); // All numbers shown for small lg
    });

    it('should hide intermediate numbers for large lg', () => {
      // Create 100 pulses (lg >= 100 triggers hiding)
      mockPulses = Array.from({ length: 101 }, (_, i) => ({
        className: 'pulse',
        dataset: { index: String(i) },
        classList: {
          contains: (cls) => (i === 0 || i === 100) && cls === 'endpoint'
        },
        style: {}
      }));

      const controller = createCircularTimeline({
        timeline,
        timelineWrapper,
        getPulses: () => mockPulses
      });

      controller.updateNumbers();

      // Should only show endpoints (0 and 100)
      const numberElements = timeline._children.filter(
        el => el.className === 'pulse-number'
      );
      expect(numberElements.length).toBe(2); // Only endpoints
    });
  });

  describe('Edge cases', () => {
    it('should handle lg=1', () => {
      const controller = createCircularTimeline({
        timeline,
        timelineWrapper,
        getPulses: () => mockPulses
      });

      const pulses = controller.render(1, { isCircular: false, silent: true });
      expect(pulses).toHaveLength(2); // Pulses 0 and 1
    });

    it('should handle large lg values', () => {
      const controller = createCircularTimeline({
        timeline,
        timelineWrapper,
        getPulses: () => mockPulses
      });

      const pulses = controller.render(200, { isCircular: false, silent: true });
      expect(pulses).toHaveLength(201); // 0 to 200 inclusive
    });
  });
});
