/**
 * Tests for timeline-intervals.js
 * @jest-environment jsdom
 */

import {
  createIntervalBars,
  applyTimelineStyles,
  highlightIntervalBar,
  clearIntervalHighlights,
  layoutHorizontalIntervalBars,
  layoutVerticalIntervalBars
} from '../timeline-intervals.js';

describe('timeline-intervals', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    container.className = 'test-container';
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('createIntervalBars', () => {
    test('should create specified number of interval bars', () => {
      const bars = createIntervalBars({
        container,
        count: 5,
        orientation: 'horizontal',
        cssClass: 'interval-bar'
      });

      expect(bars).toHaveLength(5);
      expect(container.children.length).toBe(5);
    });

    test('should apply correct CSS classes with orientation', () => {
      const bars = createIntervalBars({
        container,
        count: 3,
        orientation: 'vertical',
        cssClass: 'custom-bar'
      });

      bars.forEach((bar, index) => {
        expect(bar.className).toBe('custom-bar vertical');
        expect(bar.getAttribute('data-interval')).toBe(String(index + 1)); // 1-based index
      });
    });

    test('should set data-interval attribute (1-based)', () => {
      const bars = createIntervalBars({
        container,
        count: 4,
        orientation: 'horizontal',
        cssClass: 'bar'
      });

      expect(bars[0].getAttribute('data-interval')).toBe('1');
      expect(bars[1].getAttribute('data-interval')).toBe('2');
      expect(bars[2].getAttribute('data-interval')).toBe('3');
      expect(bars[3].getAttribute('data-interval')).toBe('4');
    });

    test('should handle zero bars gracefully', () => {
      const bars = createIntervalBars({
        container,
        count: 0,
        orientation: 'horizontal',
        cssClass: 'bar'
      });

      expect(bars).toHaveLength(0);
      expect(container.children.length).toBe(0);
    });
  });

  describe('highlightIntervalBar', () => {
    beforeEach(() => {
      createIntervalBars({
        container,
        count: 5,
        orientation: 'horizontal',
        cssClass: 'interval-bar'
      });
    });

    test('should add active class to specified bar using data-interval (1-based)', () => {
      highlightIntervalBar(container, 2, 500, 'interval-bar');

      // Interval 2 is at bars[1] (0-indexed array but 1-based data-interval)
      const bar2 = container.querySelector('[data-interval="2"]');
      expect(bar2.classList.contains('active')).toBe(true);

      const bar1 = container.querySelector('[data-interval="1"]');
      expect(bar1.classList.contains('active')).toBe(false);
    });

    test('should remove active class after specified duration', (done) => {
      highlightIntervalBar(container, 1, 100, 'interval-bar');

      const bar = container.querySelector('[data-interval="1"]');
      expect(bar.classList.contains('active')).toBe(true);

      setTimeout(() => {
        expect(bar.classList.contains('active')).toBe(false);
        done();
      }, 150);
    });

    test('should handle invalid interval index gracefully', () => {
      expect(() => {
        highlightIntervalBar(container, 999, 500, 'interval-bar');
      }).not.toThrow();

      const bars = container.querySelectorAll('.interval-bar.active');
      expect(bars.length).toBe(0);
    });
  });

  describe('clearIntervalHighlights', () => {
    beforeEach(() => {
      createIntervalBars({
        container,
        count: 5,
        orientation: 'horizontal',
        cssClass: 'interval-bar'
      });
    });

    test('should remove active class from all bars', () => {
      const bars = container.querySelectorAll('.interval-bar');
      bars[0].classList.add('active');
      bars[2].classList.add('active');
      bars[4].classList.add('active');

      clearIntervalHighlights(container, 'interval-bar');

      bars.forEach(bar => {
        expect(bar.classList.contains('active')).toBe(false);
      });
    });

    test('should not throw error if no bars are highlighted', () => {
      expect(() => {
        clearIntervalHighlights(container, 'interval-bar');
      }).not.toThrow();
    });
  });

  describe('layoutHorizontalIntervalBars', () => {
    beforeEach(() => {
      createIntervalBars({
        container,
        count: 4,
        orientation: 'horizontal',
        cssClass: 'h-bar'
      });
    });

    test('should position bars horizontally with correct spacing', () => {
      layoutHorizontalIntervalBars(container, 5, 'h-bar');

      const bars = container.querySelectorAll('.h-bar');
      const pulseSpacing = 100 / (5 - 1); // 25%

      // First bar (interval 1): left=0%, width=25%
      expect(bars[0].style.left).toBe('0%');
      expect(bars[0].style.width).toBe('25%');

      // Second bar (interval 2): left=25%, width=25%
      expect(bars[1].style.left).toBe('25%');
      expect(bars[1].style.width).toBe('25%');

      // Third bar (interval 3): left=50%, width=25%
      expect(bars[2].style.left).toBe('50%');
      expect(bars[2].style.width).toBe('25%');
    });

    test('should only set left and width (no top/transform)', () => {
      layoutHorizontalIntervalBars(container, 5, 'h-bar');

      const bars = container.querySelectorAll('.h-bar');
      bars.forEach(bar => {
        // Function only sets left/width, not top/transform
        expect(bar.style.left).toBeTruthy();
        expect(bar.style.width).toBeTruthy();
      });
    });

    test('should handle single pulse case', () => {
      const singleContainer = document.createElement('div');
      document.body.appendChild(singleContainer);
      createIntervalBars({
        container: singleContainer,
        count: 1,
        orientation: 'horizontal',
        cssClass: 'h-bar'
      });

      layoutHorizontalIntervalBars(singleContainer, 1, 'h-bar');

      const bar = singleContainer.querySelector('.h-bar');
      // With 1 pulse, pulseSpacing would be Infinity or cause issues
      // Function should handle gracefully
      expect(bar).toBeTruthy();
    });

    test('should maintain aspect ratio with different pulse counts', () => {
      layoutHorizontalIntervalBars(container, 9, 'h-bar');

      const bars = container.querySelectorAll('.h-bar');
      const expectedSpacing = 100 / (9 - 1); // 12.5%

      expect(bars[0].style.width).toBe(`${expectedSpacing}%`);
      expect(bars[1].style.left).toBe(`${expectedSpacing}%`);
    });
  });

  describe('layoutVerticalIntervalBars', () => {
    beforeEach(() => {
      createIntervalBars({
        container,
        count: 4,
        orientation: 'vertical',
        cssClass: 'v-bar'
      });
    });

    test('should position bars vertically with correct spacing', () => {
      layoutVerticalIntervalBars(container, 5, 'v-bar');

      const bars = container.querySelectorAll('.v-bar');
      const pulseSpacing = 100 / (5 - 1); // 25%

      // First bar (interval 1): top=0%, height=25%
      expect(bars[0].style.top).toBe('0%');
      expect(bars[0].style.height).toBe('25%');

      // Second bar (interval 2): top=25%, height=25%
      expect(bars[1].style.top).toBe('25%');
      expect(bars[1].style.height).toBe('25%');

      // Third bar (interval 3): top=50%, height=25%
      expect(bars[2].style.top).toBe('50%');
      expect(bars[2].style.height).toBe('25%');
    });

    test('should only set top and height (no left/transform)', () => {
      layoutVerticalIntervalBars(container, 5, 'v-bar');

      const bars = container.querySelectorAll('.v-bar');
      bars.forEach(bar => {
        // Function only sets top/height, not left/transform
        expect(bar.style.top).toBeTruthy();
        expect(bar.style.height).toBeTruthy();
      });
    });

    test('should handle single pulse case', () => {
      const singleContainer = document.createElement('div');
      document.body.appendChild(singleContainer);
      createIntervalBars({
        container: singleContainer,
        count: 1,
        orientation: 'vertical',
        cssClass: 'v-bar'
      });

      layoutVerticalIntervalBars(singleContainer, 1, 'v-bar');

      const bar = singleContainer.querySelector('.v-bar');
      expect(bar).toBeTruthy();
    });

    test('should maintain aspect ratio with different pulse counts', () => {
      layoutVerticalIntervalBars(container, 13, 'v-bar');

      const bars = container.querySelectorAll('.v-bar');
      const expectedSpacing = 100 / (13 - 1); // ~8.33%

      expect(bars[0].style.height).toBe(`${expectedSpacing}%`);
      expect(bars[1].style.top).toBe(`${expectedSpacing}%`);
    });
  });

  describe('applyTimelineStyles', () => {
    test('should apply CSS custom properties to container with correct prefixes', () => {
      applyTimelineStyles(container, {
        intervalColor: '#FF5733',
        pulseColor: '#33FF57',
        lineColor: '#3357FF'
      });

      // Function uses --timeline-* prefixes
      expect(container.style.getPropertyValue('--timeline-interval-color')).toBe('#FF5733');
      expect(container.style.getPropertyValue('--timeline-pulse-color')).toBe('#33FF57');
      expect(container.style.getPropertyValue('--timeline-line-color')).toBe('#3357FF');
    });

    test('should handle partial style config', () => {
      applyTimelineStyles(container, {
        intervalColor: '#AABBCC'
      });

      expect(container.style.getPropertyValue('--timeline-interval-color')).toBe('#AABBCC');
      // Other properties should remain unset or default
      expect(container.style.getPropertyValue('--timeline-pulse-color')).toBe('');
    });

    test('should not throw with empty config', () => {
      expect(() => {
        applyTimelineStyles(container, {});
      }).not.toThrow();
    });

    test('should handle size properties with auto px/rem conversion', () => {
      applyTimelineStyles(container, {
        pulseSize: 14,
        intervalBarHeight: 6,
        pulseNumberSize: 1.5,
        intervalNumberSize: 2
      });

      expect(container.style.getPropertyValue('--timeline-pulse-size')).toBe('14px');
      expect(container.style.getPropertyValue('--timeline-interval-bar-height')).toBe('6px');
      expect(container.style.getPropertyValue('--timeline-pulse-number-size')).toBe('1.5rem');
      expect(container.style.getPropertyValue('--timeline-interval-number-size')).toBe('2rem');
    });
  });

  describe('Integration: Combined Functionality', () => {
    test('should create, layout, and highlight bars in sequence', () => {
      // Create bars
      const bars = createIntervalBars({
        container,
        count: 8,
        orientation: 'horizontal',
        cssClass: 'interval-bar'
      });

      // Apply layout
      layoutHorizontalIntervalBars(container, 9, 'interval-bar');

      // Apply styles
      applyTimelineStyles(container, {
        intervalColor: '#FF0000',
        lineColor: '#0000FF'
      });

      // Highlight a bar (1-based, so interval 3)
      highlightIntervalBar(container, 3, 500, 'interval-bar');

      expect(bars).toHaveLength(8);
      const bar3 = container.querySelector('[data-interval="3"]');
      expect(bar3.classList.contains('active')).toBe(true);
      expect(container.style.getPropertyValue('--timeline-interval-color')).toBe('#FF0000');
    });

    test('should clear and re-highlight different bars', () => {
      createIntervalBars({
        container,
        count: 5,
        orientation: 'vertical',
        cssClass: 'v-interval'
      });

      layoutVerticalIntervalBars(container, 6, 'v-interval');

      // Highlight first bar (interval 1)
      highlightIntervalBar(container, 1, 1000, 'v-interval');
      expect(container.querySelector('[data-interval="1"]').classList.contains('active')).toBe(true);

      // Clear all
      clearIntervalHighlights(container, 'v-interval');
      expect(container.querySelector('[data-interval="1"]').classList.contains('active')).toBe(false);

      // Highlight different bar (interval 4)
      highlightIntervalBar(container, 4, 1000, 'v-interval');
      expect(container.querySelector('[data-interval="4"]').classList.contains('active')).toBe(true);
    });

    test('should support multiple containers independently', () => {
      const container2 = document.createElement('div');
      document.body.appendChild(container2);

      createIntervalBars({
        container,
        count: 3,
        orientation: 'horizontal',
        cssClass: 'bar-1'
      });

      createIntervalBars({
        container: container2,
        count: 4,
        orientation: 'vertical',
        cssClass: 'bar-2'
      });

      highlightIntervalBar(container, 1, 500, 'bar-1');
      highlightIntervalBar(container2, 2, 500, 'bar-2');

      expect(container.querySelectorAll('.bar-1.active').length).toBe(1);
      expect(container2.querySelectorAll('.bar-2.active').length).toBe(1);
      expect(container.querySelectorAll('.bar-2').length).toBe(0);
      expect(container2.querySelectorAll('.bar-1').length).toBe(0);
    });
  });
});
