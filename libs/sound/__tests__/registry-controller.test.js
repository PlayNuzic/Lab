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
      test('returns 13 (0-11 + top zero)', () => {
        const controller = createRegistryController();

        expect(controller.getTotalNotes()).toBe(13);
      });

      test('returns 13 for min registry', () => {
        const controller = createRegistryController({ min: 0 });
        controller.setRegistry(0);

        expect(controller.getTotalNotes()).toBe(13);
      });

      test('returns 13 for max registry', () => {
        const controller = createRegistryController({ max: 7 });
        controller.setRegistry(7);

        expect(controller.getTotalNotes()).toBe(13);
      });

      test('returns 13 for middle registry', () => {
        const controller = createRegistryController();
        controller.setRegistry(3);

        expect(controller.getTotalNotes()).toBe(13);
      });
    });

    describe('getOutsideNotes', () => {
      test('returns index 12 as boundary (note 0 of next registry)', () => {
        const controller = createRegistryController();
        controller.setRegistry(3);

        const outsideNotes = controller.getOutsideNotes();
        expect(outsideNotes).toEqual([12]);
      });

      test('returns same boundary for any registry', () => {
        const controller = createRegistryController();
        controller.setRegistry(0);

        const outsideNotes = controller.getOutsideNotes();
        expect(outsideNotes).toEqual([12]);
      });
    });

    describe('getStartMidi', () => {
      test('returns 60 for null registry', () => {
        const controller = createRegistryController();

        expect(controller.getStartMidi()).toBe(60);
      });

      test('returns midiOffset for registry 0', () => {
        const controller = createRegistryController();
        controller.setRegistry(0);

        // registry 0: 0 * 12 + 12 = 12
        expect(controller.getStartMidi()).toBe(12);
      });

      test('returns correct value for registry 3', () => {
        const controller = createRegistryController();
        controller.setRegistry(3);

        // registry 3: 3 * 12 + 12 = 48
        expect(controller.getStartMidi()).toBe(48);
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

        // note 5 in registry 3: 5 + (3*12) + 12 = 53
        const result = controller.getMidiForNote(5);

        expect(result).toEqual({ midi: 5 + 3 * 12 + 12, clampedNote: 5 });
      });

      test('clamps negative note to 0', () => {
        const controller = createRegistryController({ midiOffset: 12 });
        controller.setRegistry(3);

        const result = controller.getMidiForNote(-1);

        expect(result.clampedNote).toBe(0);
      });

      test('returns MIDI for next registry note (index 12)', () => {
        const controller = createRegistryController({ midiOffset: 12 });
        controller.setRegistry(3);

        // note 12 = note 0 of registry 4: (4*12) + 0 + 12 = 60
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

      test('formats with 0 at bottom (index 0) and 0 of next registry at top (index 12)', () => {
        const controller = createRegistryController();
        controller.setRegistry(4);

        // Index 0 = note 0 of registry 4
        expect(controller.formatLabel(0)).toBe('0<sup>4</sup>');

        // Index 1-11 = notes 1-11 of registry 4
        expect(controller.formatLabel(1)).toBe('1<sup>4</sup>');
        expect(controller.formatLabel(11)).toBe('11<sup>4</sup>');

        // Index 12 = note 0 of registry 5
        expect(controller.formatLabel(12)).toBe('0<sup>5</sup>');
      });

      test('formats correctly for registry 0', () => {
        const controller = createRegistryController();
        controller.setRegistry(0);

        // Index 0 = note 0 of registry 0
        expect(controller.formatLabel(0)).toBe('0<sup>0</sup>');

        // Index 11 = note 11 of registry 0
        expect(controller.formatLabel(11)).toBe('11<sup>0</sup>');

        // Index 12 = note 0 of registry 1
        expect(controller.formatLabel(12)).toBe('0<sup>1</sup>');
      });
    });

    describe('getNoteInRegistry', () => {
      test('returns offset from ZERO_POSITION (0)', () => {
        const controller = createRegistryController();
        controller.setRegistry(4);

        // Index 0 = note 0
        expect(controller.getNoteInRegistry(0)).toBe(0);

        // Index 5 = note 5
        expect(controller.getNoteInRegistry(5)).toBe(5);

        // Index 12 = note 12 (next registry)
        expect(controller.getNoteInRegistry(12)).toBe(12);
      });
    });

    describe('getHighlightIndex', () => {
      test('returns visual index from note offset', () => {
        const controller = createRegistryController();
        controller.setRegistry(4);

        // Note 0 is at index 0
        expect(controller.getHighlightIndex(0)).toBe(0);

        // Note 5 is at index 5
        expect(controller.getHighlightIndex(5)).toBe(5);

        // Note 12 is at index 12
        expect(controller.getHighlightIndex(12)).toBe(12);
      });
    });

    describe('isBoundaryNote', () => {
      test('index 12 is boundary (next registry), 0-11 are not', () => {
        const controller = createRegistryController();
        controller.setRegistry(4);

        // Indices 0-11 are current registry
        expect(controller.isBoundaryNote(0)).toBe(false);
        expect(controller.isBoundaryNote(6)).toBe(false);
        expect(controller.isBoundaryNote(11)).toBe(false);

        // Index 12 is next registry
        expect(controller.isBoundaryNote(12)).toBe(true);
      });

      test('boundary detection is consistent across registries', () => {
        const controller = createRegistryController();
        controller.setRegistry(0);

        expect(controller.isBoundaryNote(0)).toBe(false);
        expect(controller.isBoundaryNote(11)).toBe(false);
        expect(controller.isBoundaryNote(12)).toBe(true);
      });
    });
  });
});
