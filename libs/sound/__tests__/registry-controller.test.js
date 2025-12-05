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

      test('returns 14 for min registry (no prev)', () => {
        const controller = createRegistryController({ min: 0 });
        controller.setRegistry(0);

        expect(controller.getTotalNotes()).toBe(14);
      });

      test('returns 13 for max registry (no next)', () => {
        const controller = createRegistryController({ max: 7 });
        controller.setRegistry(7);

        expect(controller.getTotalNotes()).toBe(13);
      });

      test('returns 15 for middle registry (full range)', () => {
        const controller = createRegistryController();
        controller.setRegistry(3);

        expect(controller.getTotalNotes()).toBe(15);
      });
    });

    describe('getOutsideNotes', () => {
      test('returns next notes only for min registry', () => {
        const controller = createRegistryController();
        controller.setRegistry(0);

        expect(controller.getOutsideNotes()).toEqual([12, 13]);
      });

      test('returns prev note only for max registry', () => {
        const controller = createRegistryController();
        controller.setRegistry(7);

        expect(controller.getOutsideNotes()).toEqual([-1]);
      });

      test('returns both prev and next for middle registry', () => {
        const controller = createRegistryController();
        controller.setRegistry(3);

        expect(controller.getOutsideNotes()).toEqual([-1, 12, 13]);
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

      test('formats current registry notes for min registry', () => {
        const controller = createRegistryController();
        controller.setRegistry(0);

        expect(controller.formatLabel(0)).toBe('0r0');
        expect(controller.formatLabel(5)).toBe('5r0');
        expect(controller.formatLabel(11)).toBe('11r0');
      });

      test('formats next registry notes for min registry', () => {
        const controller = createRegistryController();
        controller.setRegistry(0);

        expect(controller.formatLabel(12)).toBe('0r1');
        expect(controller.formatLabel(13)).toBe('1r1');
      });

      test('formats prev registry note for max registry', () => {
        const controller = createRegistryController();
        controller.setRegistry(7);

        expect(controller.formatLabel(0)).toBe('11r6');
      });

      test('formats current registry notes for max registry', () => {
        const controller = createRegistryController();
        controller.setRegistry(7);

        expect(controller.formatLabel(1)).toBe('0r7');
        expect(controller.formatLabel(12)).toBe('11r7');
      });

      test('formats full range for middle registry', () => {
        const controller = createRegistryController();
        controller.setRegistry(3);

        expect(controller.formatLabel(0)).toBe('11r2');  // prev
        expect(controller.formatLabel(1)).toBe('0r3');   // current start
        expect(controller.formatLabel(12)).toBe('11r3'); // current end
        expect(controller.formatLabel(13)).toBe('0r4');  // next
        expect(controller.formatLabel(14)).toBe('1r4');  // next
      });
    });

    describe('getNoteInRegistry', () => {
      test('returns direct index for min registry', () => {
        const controller = createRegistryController();
        controller.setRegistry(0);

        expect(controller.getNoteInRegistry(5)).toBe(5);
      });

      test('returns offset index for other registries', () => {
        const controller = createRegistryController();
        controller.setRegistry(3);

        expect(controller.getNoteInRegistry(0)).toBe(-1);
        expect(controller.getNoteInRegistry(1)).toBe(0);
        expect(controller.getNoteInRegistry(13)).toBe(12);
      });
    });

    describe('getHighlightIndex', () => {
      test('returns direct note for min registry', () => {
        const controller = createRegistryController();
        controller.setRegistry(0);

        expect(controller.getHighlightIndex(5)).toBe(5);
      });

      test('returns offset note for other registries', () => {
        const controller = createRegistryController();
        controller.setRegistry(3);

        expect(controller.getHighlightIndex(-1)).toBe(0);
        expect(controller.getHighlightIndex(0)).toBe(1);
        expect(controller.getHighlightIndex(11)).toBe(12);
      });
    });

    describe('isBoundaryNote', () => {
      test('identifies boundary notes for min registry', () => {
        const controller = createRegistryController();
        controller.setRegistry(0);

        expect(controller.isBoundaryNote(11)).toBe(false);
        expect(controller.isBoundaryNote(12)).toBe(true);
        expect(controller.isBoundaryNote(13)).toBe(true);
      });

      test('identifies boundary notes for max registry', () => {
        const controller = createRegistryController();
        controller.setRegistry(7);

        expect(controller.isBoundaryNote(0)).toBe(true);
        expect(controller.isBoundaryNote(1)).toBe(false);
      });

      test('identifies boundary notes for middle registry', () => {
        const controller = createRegistryController();
        controller.setRegistry(3);

        expect(controller.isBoundaryNote(0)).toBe(true);
        expect(controller.isBoundaryNote(1)).toBe(false);
        expect(controller.isBoundaryNote(12)).toBe(false);
        expect(controller.isBoundaryNote(13)).toBe(true);
        expect(controller.isBoundaryNote(14)).toBe(true);
      });
    });
  });
});
