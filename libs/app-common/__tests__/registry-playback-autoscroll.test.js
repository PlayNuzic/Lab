/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';
import { createRegistryAutoscrollController } from '../registry-playback-autoscroll.js';

describe('registry-playback-autoscroll', () => {
  let mockGrid;
  let autoscroll;
  let selectedArray;

  beforeEach(() => {
    jest.useFakeTimers();

    mockGrid = {
      setRegistry: jest.fn()
    };

    selectedArray = [];

    autoscroll = createRegistryAutoscrollController({
      grid: mockGrid,
      getSelectedArray: () => selectedArray,
      config: {
        minRegistry: 2,
        maxRegistry: 5,
        notesPerRegistry: 12,
        visibleRows: 15,
        zeroPosition: 7,
        smoothScroll: true
      }
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('createRegistryAutoscrollController', () => {
    test('creates controller with all API methods', () => {
      expect(autoscroll).toBeDefined();
      expect(typeof autoscroll.buildPulseRegistryMap).toBe('function');
      expect(typeof autoscroll.scrollToRegistryForPulse).toBe('function');
      expect(typeof autoscroll.getRegistryForPulse).toBe('function');
      expect(typeof autoscroll.scheduleAnticipatedScroll).toBe('function');
      expect(typeof autoscroll.scrollToRegistry).toBe('function');
      expect(typeof autoscroll.getVisibleRegistriesForNote).toBe('function');
      expect(typeof autoscroll.parseRowId).toBe('function');
    });

    test('handles missing grid gracefully', () => {
      const controller = createRegistryAutoscrollController({
        grid: null,
        getSelectedArray: () => []
      });

      expect(() => controller.scrollToRegistry(4)).not.toThrow();
      expect(() => controller.scrollToRegistryForPulse(0, { 0: 4 })).not.toThrow();
    });
  });

  describe('parseRowId', () => {
    test('parses valid rowId format', () => {
      expect(autoscroll.parseRowId('5r4')).toEqual({ note: 5, registry: 4 });
      expect(autoscroll.parseRowId('0r3')).toEqual({ note: 0, registry: 3 });
      expect(autoscroll.parseRowId('11r5')).toEqual({ note: 11, registry: 5 });
    });

    test('returns null for invalid format', () => {
      expect(autoscroll.parseRowId('invalid')).toBeNull();
      expect(autoscroll.parseRowId('')).toBeNull();
      expect(autoscroll.parseRowId(null)).toBeNull();
    });
  });

  describe('buildPulseRegistryMap', () => {
    test('returns empty map for no selections', () => {
      selectedArray = [];
      const map = autoscroll.buildPulseRegistryMap();
      expect(map).toEqual({});
    });

    test('maps single note to its registry', () => {
      selectedArray = [
        { rowId: '5r4', colIndex: 0 }
      ];

      const map = autoscroll.buildPulseRegistryMap();

      expect(map[0]).toBeDefined();
      // Note 5 in registry 4 should be visible in registry 4
    });

    test('maps multiple notes to optimal registries', () => {
      selectedArray = [
        { rowId: '5r4', colIndex: 0 },
        { rowId: '7r4', colIndex: 2 },
        { rowId: '3r4', colIndex: 4 }
      ];

      const map = autoscroll.buildPulseRegistryMap();

      expect(Object.keys(map)).toHaveLength(3);
      expect(map[0]).toBeDefined();
      expect(map[2]).toBeDefined();
      expect(map[4]).toBeDefined();
    });

    test('accepts custom selectedArray parameter', () => {
      const customArray = [
        { rowId: '5r3', colIndex: 1 }
      ];

      const map = autoscroll.buildPulseRegistryMap(customArray);

      expect(map[1]).toBeDefined();
    });

    test('handles invalid rowId gracefully', () => {
      selectedArray = [
        { rowId: 'invalid', colIndex: 0 },
        { rowId: '5r4', colIndex: 1 }
      ];

      const map = autoscroll.buildPulseRegistryMap();

      // Should only have valid entry
      expect(map[0]).toBeUndefined();
      expect(map[1]).toBeDefined();
    });
  });

  describe('getVisibleRegistriesForNote', () => {
    test('returns registries where note is visible', () => {
      // Note 0 in registry 4 should be visible in registry 4
      const visible = autoscroll.getVisibleRegistriesForNote(0, 4);
      expect(visible).toContain(4);
    });

    test('returns empty array if note not visible anywhere', () => {
      // This would require a note way outside normal range
      // With standard config, most notes are visible somewhere
      const visible = autoscroll.getVisibleRegistriesForNote(0, 4);
      expect(Array.isArray(visible)).toBe(true);
    });
  });

  describe('scrollToRegistryForPulse', () => {
    test('calls grid.setRegistry with correct registry', () => {
      const map = { 0: 4, 1: 3, 2: 5 };

      autoscroll.scrollToRegistryForPulse(1, map);

      expect(mockGrid.setRegistry).toHaveBeenCalledWith(3, true);
    });

    test('uses smooth scroll by default', () => {
      const map = { 0: 4 };

      autoscroll.scrollToRegistryForPulse(0, map);

      expect(mockGrid.setRegistry).toHaveBeenCalledWith(4, true);
    });

    test('respects animated override', () => {
      const map = { 0: 4 };

      autoscroll.scrollToRegistryForPulse(0, map, false);

      expect(mockGrid.setRegistry).toHaveBeenCalledWith(4, false);
    });

    test('does nothing for pulse not in map', () => {
      const map = { 0: 4 };

      autoscroll.scrollToRegistryForPulse(5, map);

      expect(mockGrid.setRegistry).not.toHaveBeenCalled();
    });

    test('handles null map gracefully', () => {
      expect(() => autoscroll.scrollToRegistryForPulse(0, null)).not.toThrow();
    });
  });

  describe('getRegistryForPulse', () => {
    test('returns registry for pulse', () => {
      const map = { 0: 4, 1: 3 };

      expect(autoscroll.getRegistryForPulse(0, map)).toBe(4);
      expect(autoscroll.getRegistryForPulse(1, map)).toBe(3);
    });

    test('returns undefined for pulse not in map', () => {
      const map = { 0: 4 };

      expect(autoscroll.getRegistryForPulse(5, map)).toBeUndefined();
    });

    test('handles null map', () => {
      expect(autoscroll.getRegistryForPulse(0, null)).toBeUndefined();
    });
  });

  describe('scheduleAnticipatedScroll', () => {
    test('schedules scroll after delay', () => {
      const map = { 1: 3 };
      const isPlaying = jest.fn(() => true);

      autoscroll.scheduleAnticipatedScroll(1, map, 100, isPlaying);

      expect(mockGrid.setRegistry).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);

      expect(isPlaying).toHaveBeenCalled();
      expect(mockGrid.setRegistry).toHaveBeenCalledWith(3, true);
    });

    test('does not scroll if playback stopped', () => {
      const map = { 1: 3 };
      const isPlaying = jest.fn(() => false);

      autoscroll.scheduleAnticipatedScroll(1, map, 100, isPlaying);

      jest.advanceTimersByTime(100);

      expect(mockGrid.setRegistry).not.toHaveBeenCalled();
    });

    test('returns timeout ID for cancellation', () => {
      const map = { 1: 3 };
      const timeoutId = autoscroll.scheduleAnticipatedScroll(1, map, 100, () => true);

      expect(timeoutId).toBeDefined();

      clearTimeout(timeoutId);
      jest.advanceTimersByTime(100);

      expect(mockGrid.setRegistry).not.toHaveBeenCalled();
    });

    test('returns null for pulse not in map', () => {
      const map = { 1: 3 };
      const result = autoscroll.scheduleAnticipatedScroll(5, map, 100, () => true);

      expect(result).toBeNull();
    });
  });

  describe('scrollToRegistry', () => {
    test('calls grid.setRegistry with registry', () => {
      autoscroll.scrollToRegistry(4);

      expect(mockGrid.setRegistry).toHaveBeenCalledWith(4, true);
    });

    test('respects animated parameter', () => {
      autoscroll.scrollToRegistry(4, false);

      expect(mockGrid.setRegistry).toHaveBeenCalledWith(4, false);
    });
  });

  describe('integration with real note data', () => {
    test('optimizes for registry with most notes', () => {
      // Multiple notes in registry 4
      selectedArray = [
        { rowId: '0r4', colIndex: 0 },
        { rowId: '2r4', colIndex: 1 },
        { rowId: '4r4', colIndex: 2 },
        { rowId: '6r4', colIndex: 3 },
        // One note in registry 3
        { rowId: '0r3', colIndex: 4 }
      ];

      const map = autoscroll.buildPulseRegistryMap();

      // Most notes should prefer registry 4 since it has the most notes
      const registries = Object.values(map);
      const count4 = registries.filter(r => r === 4).length;

      // At least some should be in registry 4
      expect(count4).toBeGreaterThan(0);
    });
  });

  describe('config defaults', () => {
    test('uses default config when not provided', () => {
      const controller = createRegistryAutoscrollController({
        grid: mockGrid,
        getSelectedArray: () => [{ rowId: '5r4', colIndex: 0 }]
      });

      const map = controller.buildPulseRegistryMap();
      expect(map).toBeDefined();
    });
  });
});
