/**
 * Tests for simple-visual-sync.js
 */

import { createSimpleVisualSync } from '../simple-visual-sync.js';

describe('createSimpleVisualSync', () => {
  let mockAudio;
  let isPlaying;
  let onStepCalls;
  let rafCallbacks;
  let rafId;
  let cancelledIds;

  beforeEach(() => {
    // Reset state
    isPlaying = false;
    onStepCalls = [];
    rafCallbacks = [];
    rafId = 1;
    cancelledIds = [];

    // Mock audio with getVisualState
    mockAudio = {
      getVisualState: () => ({ step: 0 })
    };

    // Mock requestAnimationFrame and cancelAnimationFrame
    global.requestAnimationFrame = (callback) => {
      rafCallbacks.push(callback);
      return rafId++;
    };

    global.cancelAnimationFrame = (id) => {
      cancelledIds.push(id);
    };
  });

  afterEach(() => {
    delete global.requestAnimationFrame;
    delete global.cancelAnimationFrame;
  });

  describe('start()', () => {
    it('should start visual sync loop', () => {
      const visualSync = createSimpleVisualSync({
        getAudio: () => mockAudio,
        getIsPlaying: () => true,
        onStep: (step) => { onStepCalls.push(step); }
      });

      visualSync.start();

      expect(rafCallbacks.length).toBeGreaterThan(0);
    });

    it('should call onStep when playing and step changes', () => {
      mockAudio.getVisualState = () => ({ step: 3 });

      const visualSync = createSimpleVisualSync({
        getAudio: () => mockAudio,
        getIsPlaying: () => true,
        onStep: (step) => { onStepCalls.push(step); }
      });

      visualSync.start();

      // Execute first RAF callback
      rafCallbacks[0]();

      expect(onStepCalls).toEqual([3]);
    });

    it('should not call onStep for same step twice', () => {
      mockAudio.getVisualState = () => ({ step: 5 });

      const visualSync = createSimpleVisualSync({
        getAudio: () => mockAudio,
        getIsPlaying: () => true,
        onStep: (step) => { onStepCalls.push(step); }
      });

      visualSync.start();

      // Execute first RAF callback
      rafCallbacks[0]();
      expect(onStepCalls).toEqual([5]);

      // Execute second RAF callback with same step
      rafCallbacks[1]();
      expect(onStepCalls).toEqual([5]); // Should not add duplicate
    });

    it('should call onStep when step changes', () => {
      let currentStep = 2;
      mockAudio.getVisualState = () => ({ step: currentStep });

      const visualSync = createSimpleVisualSync({
        getAudio: () => mockAudio,
        getIsPlaying: () => true,
        onStep: (step) => { onStepCalls.push(step); }
      });

      visualSync.start();

      // First step
      rafCallbacks[0]();
      expect(onStepCalls).toEqual([2]);

      // Second step - different
      currentStep = 3;
      rafCallbacks[1]();
      expect(onStepCalls).toEqual([2, 3]);
    });

    it('should not call onStep when not playing', () => {
      mockAudio.getVisualState = () => ({ step: 7 });

      const visualSync = createSimpleVisualSync({
        getAudio: () => mockAudio,
        getIsPlaying: () => false, // Not playing
        onStep: (step) => { onStepCalls.push(step); }
      });

      visualSync.start();
      rafCallbacks[0]();

      expect(onStepCalls).toEqual([]); // No calls
    });

    it('should handle missing audio gracefully', () => {
      const visualSync = createSimpleVisualSync({
        getAudio: () => null,
        getIsPlaying: () => true,
        onStep: (step) => { onStepCalls.push(step); }
      });

      visualSync.start();
      rafCallbacks[0]();

      expect(onStepCalls).toEqual([]); // No error, no calls
    });

    it('should handle audio without getVisualState', () => {
      const visualSync = createSimpleVisualSync({
        getAudio: () => ({}), // Audio without getVisualState
        getIsPlaying: () => true,
        onStep: (step) => { onStepCalls.push(step); }
      });

      visualSync.start();
      rafCallbacks[0]();

      expect(onStepCalls).toEqual([]); // No error, no calls
    });

    it('should handle invalid step value', () => {
      mockAudio.getVisualState = () => ({ step: NaN });

      const visualSync = createSimpleVisualSync({
        getAudio: () => mockAudio,
        getIsPlaying: () => true,
        onStep: (step) => { onStepCalls.push(step); }
      });

      visualSync.start();
      rafCallbacks[0]();

      expect(onStepCalls).toEqual([]); // No calls for invalid step
    });

    it('should continue loop after each frame', () => {
      const visualSync = createSimpleVisualSync({
        getAudio: () => mockAudio,
        getIsPlaying: () => true,
        onStep: (step) => { onStepCalls.push(step); }
      });

      visualSync.start();

      // First frame
      mockAudio.getVisualState = () => ({ step: 0 });
      rafCallbacks[0]();
      expect(rafCallbacks.length).toBe(2); // Should schedule next frame

      // Second frame
      mockAudio.getVisualState = () => ({ step: 1 });
      rafCallbacks[1]();
      expect(rafCallbacks.length).toBe(3); // Should schedule next frame
    });
  });

  describe('stop()', () => {
    it('should stop visual sync loop', () => {
      const visualSync = createSimpleVisualSync({
        getAudio: () => mockAudio,
        getIsPlaying: () => true,
        onStep: (step) => { onStepCalls.push(step); }
      });

      visualSync.start();
      visualSync.stop();

      expect(cancelledIds.length).toBeGreaterThan(0);
    });

    it('should reset lastVisualStep', () => {
      mockAudio.getVisualState = () => ({ step: 5 });

      const visualSync = createSimpleVisualSync({
        getAudio: () => mockAudio,
        getIsPlaying: () => true,
        onStep: (step) => { onStepCalls.push(step); }
      });

      visualSync.start();
      rafCallbacks[0]();
      expect(onStepCalls).toEqual([5]);

      visualSync.stop();

      // Start again with same step - should call onStep again
      visualSync.start();
      rafCallbacks[rafCallbacks.length - 1]();
      expect(onStepCalls).toEqual([5, 5]); // Called again after reset
    });

    it('should handle stop when not started', () => {
      const visualSync = createSimpleVisualSync({
        getAudio: () => mockAudio,
        getIsPlaying: () => true,
        onStep: (step) => { onStepCalls.push(step); }
      });

      expect(() => visualSync.stop()).not.toThrow();
    });

    it('should handle multiple stop calls', () => {
      const visualSync = createSimpleVisualSync({
        getAudio: () => mockAudio,
        getIsPlaying: () => true,
        onStep: (step) => { onStepCalls.push(step); }
      });

      visualSync.start();
      visualSync.stop();
      expect(() => visualSync.stop()).not.toThrow();
    });
  });

  describe('syncVisualState()', () => {
    it('should manually trigger sync', () => {
      mockAudio.getVisualState = () => ({ step: 12 });

      const visualSync = createSimpleVisualSync({
        getAudio: () => mockAudio,
        getIsPlaying: () => true,
        onStep: (step) => { onStepCalls.push(step); }
      });

      visualSync.syncVisualState();

      expect(onStepCalls).toEqual([12]);
    });

    it('should respect lastVisualStep in manual sync', () => {
      mockAudio.getVisualState = () => ({ step: 8 });

      const visualSync = createSimpleVisualSync({
        getAudio: () => mockAudio,
        getIsPlaying: () => true,
        onStep: (step) => { onStepCalls.push(step); }
      });

      visualSync.syncVisualState();
      expect(onStepCalls).toEqual([8]);

      // Same step again
      visualSync.syncVisualState();
      expect(onStepCalls).toEqual([8]); // No duplicate
    });
  });
});
