/**
 * Tests for simple-highlight-controller.js
 */

import { createSimpleHighlightController } from '../simple-highlight-controller.js';

describe('createSimpleHighlightController', () => {
  let mockPulses;

  function createMockPulse() {
    return {
      classList: {
        _classes: new Set(),
        add(className) { this._classes.add(className); },
        remove(className) { this._classes.delete(className); },
        contains(className) { return this._classes.has(className); }
      },
      offsetWidth: 100 // Mock offsetWidth for reflow
    };
  }

  beforeEach(() => {
    // Create mock pulse elements
    mockPulses = Array.from({ length: 5 }, () => createMockPulse());
  });

  describe('highlightPulse()', () => {
    it('should highlight pulse at given index', () => {
      const controller = createSimpleHighlightController({
        getPulses: () => mockPulses,
        getLoopEnabled: () => false
      });

      controller.highlightPulse(2);

      expect(mockPulses[2].classList.contains('active')).toBe(true);
      expect(mockPulses[0].classList.contains('active')).toBe(false);
      expect(mockPulses[1].classList.contains('active')).toBe(false);
      expect(mockPulses[3].classList.contains('active')).toBe(false);
      expect(mockPulses[4].classList.contains('active')).toBe(false);
    });

    it('should clear previous highlights before adding new one', () => {
      const controller = createSimpleHighlightController({
        getPulses: () => mockPulses,
        getLoopEnabled: () => false
      });

      controller.highlightPulse(1);
      expect(mockPulses[1].classList.contains('active')).toBe(true);

      controller.highlightPulse(3);
      expect(mockPulses[1].classList.contains('active')).toBe(false);
      expect(mockPulses[3].classList.contains('active')).toBe(true);
    });

    it('should handle index wrapping with modulo', () => {
      const controller = createSimpleHighlightController({
        getPulses: () => mockPulses,
        getLoopEnabled: () => false
      });

      // Index 7 should wrap to index 2 (7 % 5 = 2)
      controller.highlightPulse(7);
      expect(mockPulses[2].classList.contains('active')).toBe(true);
    });

    it('should handle negative indices', () => {
      const controller = createSimpleHighlightController({
        getPulses: () => mockPulses,
        getLoopEnabled: () => false
      });

      // -1 % 5 = -1 in JavaScript (negative modulo)
      // Our implementation just uses modulo directly, so -1 % 5 = -1
      controller.highlightPulse(-1);
      const highlightedIdx = mockPulses.findIndex(p => p.classList.contains('active'));
      // Implementation doesn't wrap negative indices, it stays negative which doesn't match any element
      expect(highlightedIdx).toBe(-1); // No element highlighted
    });

    it('should highlight both first and last pulse when loop enabled at index 0', () => {
      const controller = createSimpleHighlightController({
        getPulses: () => mockPulses,
        getLoopEnabled: () => true
      });

      controller.highlightPulse(0);

      expect(mockPulses[0].classList.contains('active')).toBe(true);
      expect(mockPulses[4].classList.contains('active')).toBe(true); // Last pulse
      expect(mockPulses[1].classList.contains('active')).toBe(false);
      expect(mockPulses[2].classList.contains('active')).toBe(false);
      expect(mockPulses[3].classList.contains('active')).toBe(false);
    });

    it('should not highlight last pulse when loop enabled but not at index 0', () => {
      const controller = createSimpleHighlightController({
        getPulses: () => mockPulses,
        getLoopEnabled: () => true
      });

      controller.highlightPulse(2);

      expect(mockPulses[2].classList.contains('active')).toBe(true);
      expect(mockPulses[4].classList.contains('active')).toBe(false);
    });

    it('should handle empty pulses array', () => {
      const controller = createSimpleHighlightController({
        getPulses: () => [],
        getLoopEnabled: () => false
      });

      expect(() => controller.highlightPulse(0)).not.toThrow();
    });

    it('should handle null pulses', () => {
      const controller = createSimpleHighlightController({
        getPulses: () => null,
        getLoopEnabled: () => false
      });

      expect(() => controller.highlightPulse(0)).not.toThrow();
    });

    it('should handle undefined pulses', () => {
      const controller = createSimpleHighlightController({
        getPulses: () => undefined,
        getLoopEnabled: () => false
      });

      expect(() => controller.highlightPulse(0)).not.toThrow();
    });

    it('should handle pulses array with null elements', () => {
      const pulsesWithNull = [mockPulses[0], null, mockPulses[2], null, mockPulses[4]];
      const controller = createSimpleHighlightController({
        getPulses: () => pulsesWithNull,
        getLoopEnabled: () => false
      });

      expect(() => controller.highlightPulse(1)).not.toThrow(); // Index 1 is null
      expect(() => controller.highlightPulse(2)).not.toThrow(); // Index 2 is valid
    });

    it('should use custom highlight class if provided', () => {
      const controller = createSimpleHighlightController({
        getPulses: () => mockPulses,
        getLoopEnabled: () => false,
        highlightClass: 'highlighted'
      });

      controller.highlightPulse(1);

      expect(mockPulses[1].classList.contains('highlighted')).toBe(true);
      expect(mockPulses[1].classList.contains('active')).toBe(false);
    });
  });

  describe('clearHighlights()', () => {
    it('should remove all highlights', () => {
      const controller = createSimpleHighlightController({
        getPulses: () => mockPulses,
        getLoopEnabled: () => false
      });

      // Highlight some pulses
      controller.highlightPulse(1);
      controller.highlightPulse(3);

      // Clear all
      controller.clearHighlights();

      mockPulses.forEach(pulse => {
        expect(pulse.classList.contains('active')).toBe(false);
      });
    });

    it('should handle empty pulses array', () => {
      const controller = createSimpleHighlightController({
        getPulses: () => [],
        getLoopEnabled: () => false
      });

      expect(() => controller.clearHighlights()).not.toThrow();
    });

    it('should handle null pulses', () => {
      const controller = createSimpleHighlightController({
        getPulses: () => null,
        getLoopEnabled: () => false
      });

      expect(() => controller.clearHighlights()).not.toThrow();
    });

    it('should remove custom highlight class', () => {
      const controller = createSimpleHighlightController({
        getPulses: () => mockPulses,
        getLoopEnabled: () => false,
        highlightClass: 'custom-highlight'
      });

      controller.highlightPulse(2);
      expect(mockPulses[2].classList.contains('custom-highlight')).toBe(true);

      controller.clearHighlights();
      expect(mockPulses[2].classList.contains('custom-highlight')).toBe(false);
    });
  });

  describe('Dynamic state changes', () => {
    it('should respect dynamic loop changes', () => {
      let currentLoopEnabled = false;
      const controller = createSimpleHighlightController({
        getPulses: () => mockPulses,
        getLoopEnabled: () => currentLoopEnabled
      });

      // Loop disabled
      controller.highlightPulse(0);
      expect(mockPulses[0].classList.contains('active')).toBe(true);
      expect(mockPulses[4].classList.contains('active')).toBe(false);

      // Enable loop
      currentLoopEnabled = true;
      controller.highlightPulse(0);
      expect(mockPulses[0].classList.contains('active')).toBe(true);
      expect(mockPulses[4].classList.contains('active')).toBe(true); // Now highlighted
    });

    it('should respect dynamic pulses array changes', () => {
      let currentPulses = mockPulses.slice(0, 3); // First 3 pulses
      const controller = createSimpleHighlightController({
        getPulses: () => currentPulses,
        getLoopEnabled: () => false
      });

      controller.highlightPulse(2);
      expect(currentPulses[2].classList.contains('active')).toBe(true);

      // Expand array
      currentPulses = mockPulses; // All 5 pulses
      controller.highlightPulse(4);
      expect(mockPulses[4].classList.contains('active')).toBe(true);
    });
  });
});
