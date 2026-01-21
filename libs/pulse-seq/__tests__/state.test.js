/**
 * Tests for pulse-seq state management
 */
import { createPulseSeqStateManager } from '../state.js';

describe('createPulseSeqStateManager', () => {
  let fractionStore;
  let pulseMemoryApi;
  let stateManager;

  beforeEach(() => {
    fractionStore = {
      selectionState: new Map(),
      pulseSeqEntryOrder: [],
      pulseSeqEntryLookup: new Map()
    };

    pulseMemoryApi = {
      data: [],
      ensure(lg) {
        while (this.data.length <= lg) {
          this.data.push(false);
        }
      }
    };

    stateManager = createPulseSeqStateManager({ fractionStore, pulseMemoryApi });
  });

  describe('applyValidatedTokens', () => {
    test('applies integer pulses to pulseMemory', () => {
      stateManager.applyValidatedTokens([1, 3, 5], [], { lg: 8 });

      expect(pulseMemoryApi.data[1]).toBe(true);
      expect(pulseMemoryApi.data[3]).toBe(true);
      expect(pulseMemoryApi.data[5]).toBe(true);
      expect(pulseMemoryApi.data[2]).toBe(false);
      expect(pulseMemoryApi.data[4]).toBe(false);
    });

    test('clears previous pulses before applying new ones', () => {
      pulseMemoryApi.ensure(8);
      pulseMemoryApi.data[2] = true;
      pulseMemoryApi.data[4] = true;

      stateManager.applyValidatedTokens([1], [], { lg: 8 });

      expect(pulseMemoryApi.data[1]).toBe(true);
      expect(pulseMemoryApi.data[2]).toBe(false);
      expect(pulseMemoryApi.data[4]).toBe(false);
    });

    test('applies fractions to fractionStore', () => {
      const fractions = [
        { key: '1+1/2', value: 1.5, display: '1.2' },
        { key: '3+1/4', value: 3.25, display: '3.1' }
      ];

      stateManager.applyValidatedTokens([], fractions, { lg: 8 });

      expect(fractionStore.selectionState.size).toBe(2);
      expect(fractionStore.selectionState.has('1+1/2')).toBe(true);
      expect(fractionStore.selectionState.has('3+1/4')).toBe(true);
    });

    test('clears previous fractions before applying new ones', () => {
      fractionStore.selectionState.set('old+key', { key: 'old+key' });

      stateManager.applyValidatedTokens([], [{ key: 'new+key', value: 2.5 }], { lg: 8 });

      expect(fractionStore.selectionState.size).toBe(1);
      expect(fractionStore.selectionState.has('new+key')).toBe(true);
      expect(fractionStore.selectionState.has('old+key')).toBe(false);
    });

    test('ignores pulses >= lg', () => {
      stateManager.applyValidatedTokens([1, 5, 10], [], { lg: 8 });

      expect(pulseMemoryApi.data[1]).toBe(true);
      expect(pulseMemoryApi.data[5]).toBe(true);
      expect(pulseMemoryApi.data[10]).toBeUndefined();
    });

    test('handles invalid lg gracefully', () => {
      stateManager.applyValidatedTokens([1, 2], [], { lg: -1 });
      // Should not throw, pulseMemory not modified
      expect(pulseMemoryApi.data.length).toBe(0);
    });

    test('handles lg=0 gracefully', () => {
      stateManager.applyValidatedTokens([1], [], { lg: 0 });
      expect(pulseMemoryApi.data.length).toBe(0);
    });
  });

  describe('generateFieldText', () => {
    test('generates text from integers and fractions', () => {
      pulseMemoryApi.ensure(8);
      pulseMemoryApi.data[1] = true;
      pulseMemoryApi.data[3] = true;

      fractionStore.selectionState.set('2+1/2', { value: 2.5, display: '2.2' });

      const text = stateManager.generateFieldText({ lg: 8 });

      // With valid lg: integers first (sorted), then fractions (sorted by display)
      expect(text).toBe('  1  3  2.2  ');
    });

    test('returns empty format when no selections', () => {
      const text = stateManager.generateFieldText({ lg: 8 });
      expect(text).toBe('  ');
    });

    test('lists integers first, then fractions', () => {
      pulseMemoryApi.ensure(8);
      pulseMemoryApi.data[5] = true;
      pulseMemoryApi.data[1] = true;

      fractionStore.selectionState.set('3+1/2', { value: 3.5, display: '3.2' });

      const text = stateManager.generateFieldText({ lg: 8 });

      // Integers sorted (1, 5) then fractions sorted by display
      expect(text).toBe('  1  5  3.2  ');
    });

    test('updates pulseSeqRanges with positions', () => {
      pulseMemoryApi.data = [false, true, false]; // pulse 1 selected

      fractionStore.selectionState.set('2+1/2', { value: 2.5, display: '2.2', key: '2+1/2' });

      const ranges = {};
      stateManager.generateFieldText({ lg: undefined, pulseSeqRanges: ranges });

      // Ranges should be populated
      expect(Object.keys(ranges).length).toBeGreaterThan(0);
    });
  });

  describe('syncMemory', () => {
    test('ensures pulseMemory has correct size', () => {
      stateManager.syncMemory(10);
      expect(pulseMemoryApi.data.length).toBeGreaterThanOrEqual(10);
    });

    test('handles invalid lg', () => {
      stateManager.syncMemory(-5);
      expect(pulseMemoryApi.data.length).toBe(0);
    });

    test('handles NaN lg', () => {
      stateManager.syncMemory(NaN);
      expect(pulseMemoryApi.data.length).toBe(0);
    });
  });

  describe('getCurrentSelection', () => {
    test('returns current integers and fractions', () => {
      pulseMemoryApi.ensure(8);
      pulseMemoryApi.data[1] = true;
      pulseMemoryApi.data[4] = true;

      fractionStore.selectionState.set('2+1/2', { key: '2+1/2', value: 2.5 });

      const selection = stateManager.getCurrentSelection();

      expect(selection.integers).toEqual([1, 4]);
      expect(selection.fractions.length).toBe(1);
      expect(selection.fractions[0].key).toBe('2+1/2');
    });

    test('returns empty arrays when no selections', () => {
      const selection = stateManager.getCurrentSelection();

      expect(selection.integers).toEqual([]);
      expect(selection.fractions).toEqual([]);
    });
  });

  describe('clearAll', () => {
    test('clears all selections', () => {
      pulseMemoryApi.ensure(8);
      pulseMemoryApi.data[1] = true;
      pulseMemoryApi.data[3] = true;

      fractionStore.selectionState.set('2+1/2', { key: '2+1/2' });
      fractionStore.pulseSeqEntryOrder = ['1', '2+1/2', '3'];
      fractionStore.pulseSeqEntryLookup.set('1', { type: 'int' });

      stateManager.clearAll(8);

      expect(pulseMemoryApi.data[1]).toBe(false);
      expect(pulseMemoryApi.data[3]).toBe(false);
      expect(fractionStore.selectionState.size).toBe(0);
      expect(fractionStore.pulseSeqEntryOrder.length).toBe(0);
      expect(fractionStore.pulseSeqEntryLookup.size).toBe(0);
    });

    test('handles invalid lg', () => {
      fractionStore.selectionState.set('key', { key: 'key' });

      stateManager.clearAll(-1);

      // Fractions should still be cleared
      expect(fractionStore.selectionState.size).toBe(0);
    });
  });
});
