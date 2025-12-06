/**
 * Tests for registry-controller.js
 */

import { jest } from '@jest/globals';
import { createRegistryController } from '../registry-controller.js';

describe('registry-controller', () => {
  describe('createRegistryController', () => {
    test('creates controller with default values', () => {
      const controller = createRegistryController();

      expect(controller.getRegistry()).toBeNull();
      expect(controller.min).toBe(0);
      expect(controller.max).toBe(7);
      expect(controller.midiOffset).toBe(12);
      expect(controller.notesPerRegistry).toBe(12);
    });

    test('creates controller with custom values', () => {
      const controller = createRegistryController({
        min: 1,
        max: 5,
        midiOffset: 24,
        notesPerRegistry: 7
      });

      expect(controller.min).toBe(1);
      expect(controller.max).toBe(5);
      expect(controller.midiOffset).toBe(24);
      expect(controller.notesPerRegistry).toBe(7);
    });

    describe('setRegistry', () => {
      test('sets registry value', () => {
        const controller = createRegistryController();

        controller.setRegistry(3);

        expect(controller.getRegistry()).toBe(3);
      });

      test('clamps to min', () => {
        const controller = createRegistryController({ min: 0, max: 7 });

        controller.setRegistry(-5);

        expect(controller.getRegistry()).toBe(0);
      });

      test('clamps to max', () => {
        const controller = createRegistryController({ min: 0, max: 7 });

        controller.setRegistry(10);

        expect(controller.getRegistry()).toBe(7);
      });

      test('handles null', () => {
        const controller = createRegistryController();
        controller.setRegistry(3);

        controller.setRegistry(null);

        expect(controller.getRegistry()).toBeNull();
      });

      test('handles empty string', () => {
        const controller = createRegistryController();
        controller.setRegistry(3);

        controller.setRegistry('');

        expect(controller.getRegistry()).toBeNull();
      });

      test('parses string values', () => {
        const controller = createRegistryController();

        controller.setRegistry('5');

        expect(controller.getRegistry()).toBe(5);
      });

      test('calls onRegistryChange callback', () => {
        const onChange = jest.fn();
        const controller = createRegistryController({ onRegistryChange: onChange });

        controller.setRegistry(3);

        expect(onChange).toHaveBeenCalledWith(3, null);
      });

      test('does not call callback when value unchanged', () => {
        const onChange = jest.fn();
        const controller = createRegistryController({ onRegistryChange: onChange });

        controller.setRegistry(3);
        onChange.mockClear();

        controller.setRegistry(3);

        expect(onChange).not.toHaveBeenCalled();
      });
    });

    describe('increment', () => {
      test('increments registry', () => {
        const controller = createRegistryController();
        controller.setRegistry(3);

        controller.increment();

        expect(controller.getRegistry()).toBe(4);
      });

      test('sets to min when null', () => {
        const controller = createRegistryController({ min: 0 });

        controller.increment();

        expect(controller.getRegistry()).toBe(0);
      });

      test('does not exceed max', () => {
        const controller = createRegistryController({ max: 7 });
        controller.setRegistry(7);

        controller.increment();

        expect(controller.getRegistry()).toBe(7);
      });
    });

    describe('decrement', () => {
      test('decrements registry', () => {
        const controller = createRegistryController();
        controller.setRegistry(3);

        controller.decrement();

        expect(controller.getRegistry()).toBe(2);
      });

      test('sets to max when null', () => {
        const controller = createRegistryController({ max: 7 });

        controller.decrement();

        expect(controller.getRegistry()).toBe(7);
      });

      test('does not go below min', () => {
        const controller = createRegistryController({ min: 0 });
        controller.setRegistry(0);

        controller.decrement();

        expect(controller.getRegistry()).toBe(0);
      });
    });

    describe('getTotalNotes', () => {
      test('returns 15 for null registry', () => {
        const controller = createRegistryController();

        expect(controller.getTotalNotes()).toBe(15);
      });

      test('returns 15 for min registry (always 15 with centered zero)', () => {
        const controller = createRegistryController({ min: 0 });
        controller.setRegistry(0);

        expect(controller.getTotalNotes()).toBe(15);
      });

      test('returns 15 for max registry (always 15 with centered zero)', () => {
        const controller = createRegistryController({ max: 7 });
        controller.setRegistry(7);

        expect(controller.getTotalNotes()).toBe(15);
      });

      test('returns 15 for middle registry', () => {
        const controller = createRegistryController();
        controller.setRegistry(3);

        expect(controller.getTotalNotes()).toBe(15);
      });
    });

    describe('getOutsideNotes', () => {
      test('returns boundary note indices (notes below 0 are previous registry)', () => {
        const controller = createRegistryController();
        controller.setRegistry(3);

        // With 0 centered at position 7, notes at indices 0-6 are previous registry
        const outsideNotes = controller.getOutsideNotes();
        expect(outsideNotes).toEqual([0, 1, 2, 3, 4, 5, 6]);
      });

      test('returns same boundary notes for any registry (structure is consistent)', () => {
        const controller = createRegistryController();
        controller.setRegistry(0);

        // Even at min registry, the structure is the same
        const outsideNotes = controller.getOutsideNotes();
        expect(outsideNotes).toEqual([0, 1, 2, 3, 4, 5, 6]);
      });
    });

    describe('getStartMidi', () => {
      test('returns 60 for null registry', () => {
        const controller = createRegistryController();

        expect(controller.getStartMidi()).toBe(60);
      });

      test('returns 0 for min registry', () => {
        const controller = createRegistryController();
        controller.setRegistry(0);

        expect(controller.getStartMidi()).toBe(0);
      });

      test('returns correct value for registry 3', () => {
        const controller = createRegistryController();
        controller.setRegistry(3);

        expect(controller.getStartMidi()).toBe(35); // 3*12 - 1
      });
    });

    describe('getMidiForNote', () => {
      test('returns 60 for null registry', () => {
        const controller = createRegistryController();

        const result = controller.getMidiForNote(0);

        expect(result).toEqual({ midi: 60, clampedNote: 0 });
      });

      test('returns MIDI for current registry note', () => {
        const controller = createRegistryController({ midiOffset: 12 });
        controller.setRegistry(3);

        const result = controller.getMidiForNote(5);

        expect(result).toEqual({ midi: 3 * 12 + 5 + 12, clampedNote: 5 });
      });

      test('returns MIDI for prev registry note (-1)', () => {
        const controller = createRegistryController({ midiOffset: 12 });
        controller.setRegistry(3);

        const result = controller.getMidiForNote(-1);

        expect(result).toEqual({ midi: 2 * 12 + 11 + 12, clampedNote: -1 });
      });

      test('clamps prev note at min registry', () => {
        const controller = createRegistryController({ midiOffset: 12 });
        controller.setRegistry(0);

        const result = controller.getMidiForNote(-1);

        expect(result.clampedNote).toBe(0);
      });

      test('returns MIDI for next registry note (12)', () => {
        const controller = createRegistryController({ midiOffset: 12 });
        controller.setRegistry(3);

        const result = controller.getMidiForNote(12);

        expect(result).toEqual({ midi: 4 * 12 + 0 + 12, clampedNote: 12 });
      });

      test('clamps next note at max registry', () => {
        const controller = createRegistryController({ midiOffset: 12 });
        controller.setRegistry(7);

        const result = controller.getMidiForNote(12);

        expect(result.clampedNote).toBe(11);
      });
    });

    describe('formatLabel', () => {
      test('returns empty string for null registry', () => {
        const controller = createRegistryController();

        expect(controller.formatLabel(0)).toBe('');
      });

      test('formats with 0 centered at position 7 (index 7)', () => {
        const controller = createRegistryController();
        controller.setRegistry(4);

        // Index 7 should be 0r4 (note 0 of registry 4)
        expect(controller.formatLabel(7)).toBe('0r4');

        // Indices above 7 (higher pitch within current registry)
        expect(controller.formatLabel(8)).toBe('1r4');
        expect(controller.formatLabel(14)).toBe('7r4');

        // Indices below 7 (lower pitch, previous registry)
        expect(controller.formatLabel(6)).toBe('11r3');
        expect(controller.formatLabel(5)).toBe('10r3');
        expect(controller.formatLabel(0)).toBe('5r3');
      });

      test('formats correctly for any registry', () => {
        const controller = createRegistryController();
        controller.setRegistry(0);

        // Index 7 should be 0r0
        expect(controller.formatLabel(7)).toBe('0r0');

        // Notes above 0r0 are in current registry
        expect(controller.formatLabel(8)).toBe('1r0');
        expect(controller.formatLabel(14)).toBe('7r0');

        // Notes below 0r0 would be in "registry -1" (negative, but still calculated)
        expect(controller.formatLabel(6)).toBe('11r-1');
        expect(controller.formatLabel(0)).toBe('5r-1');
      });
    });

    describe('getNoteInRegistry', () => {
      test('returns offset from ZERO_POSITION (7)', () => {
        const controller = createRegistryController();
        controller.setRegistry(4);

        // Index 7 is 0 (note 0 of current registry)
        expect(controller.getNoteInRegistry(7)).toBe(0);

        // Index 0 is -7 (7 notes below 0)
        expect(controller.getNoteInRegistry(0)).toBe(-7);

        // Index 14 is +7 (7 notes above 0)
        expect(controller.getNoteInRegistry(14)).toBe(7);
      });
    });

    describe('getHighlightIndex', () => {
      test('returns visual index from note offset', () => {
        const controller = createRegistryController();
        controller.setRegistry(4);

        // Note 0 (offset 0) is at index 7
        expect(controller.getHighlightIndex(0)).toBe(7);

        // Note -7 is at index 0
        expect(controller.getHighlightIndex(-7)).toBe(0);

        // Note +7 is at index 14
        expect(controller.getHighlightIndex(7)).toBe(14);
      });
    });

    describe('isBoundaryNote', () => {
      test('identifies boundary notes (indices 0-6 are previous registry)', () => {
        const controller = createRegistryController();
        controller.setRegistry(4);

        // Indices 0-6 are boundary (previous registry)
        expect(controller.isBoundaryNote(0)).toBe(true);
        expect(controller.isBoundaryNote(6)).toBe(true);

        // Index 7 is note 0 of current registry
        expect(controller.isBoundaryNote(7)).toBe(false);

        // Indices 8-14 are current registry (notes 1-7)
        expect(controller.isBoundaryNote(8)).toBe(false);
        expect(controller.isBoundaryNote(14)).toBe(false);
      });

      test('boundary detection is consistent across registries', () => {
        const controller = createRegistryController();
        controller.setRegistry(0);

        // Same pattern for any registry
        expect(controller.isBoundaryNote(6)).toBe(true);
        expect(controller.isBoundaryNote(7)).toBe(false);
        expect(controller.isBoundaryNote(8)).toBe(false);
      });
    });
  });
});
