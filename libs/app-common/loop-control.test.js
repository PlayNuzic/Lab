/**
 * @jest-environment jsdom
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import {
  createLoopController,
  createRhythmLoopController,
  createPulseMemoryLoopController
} from './loop-control.js';

describe('Loop Control Components', () => {
  let mockAudio;
  let mockLoopBtn;
  let mockState;

  beforeEach(() => {
    mockAudio = {
      setLoop: jest.fn()
    };

    mockLoopBtn = {
      classList: {
        toggle: jest.fn()
      },
      addEventListener: jest.fn()
    };

    mockState = {
      loopEnabled: false
    };
  });

  describe('createLoopController', () => {
    test('creates basic loop controller with toggle functionality', () => {
      const controller = createLoopController({
        audio: mockAudio,
        loopBtn: mockLoopBtn,
        getLoopState: () => mockState.loopEnabled,
        setLoopState: (value) => { mockState.loopEnabled = value; },
        isPlaying: () => false
      });

      expect(controller).toBeDefined();
      expect(typeof controller.toggle).toBe('function');
      expect(typeof controller.attach).toBe('function');
    });

    test('toggle changes state and updates UI', () => {
      const onToggle = jest.fn();
      const controller = createLoopController({
        audio: mockAudio,
        loopBtn: mockLoopBtn,
        getLoopState: () => mockState.loopEnabled,
        setLoopState: (value) => { mockState.loopEnabled = value; },
        onToggle,
        isPlaying: () => false
      });

      // Initial state
      expect(mockState.loopEnabled).toBe(false);

      // Toggle to enabled
      controller.toggle();
      expect(mockState.loopEnabled).toBe(true);
      expect(mockLoopBtn.classList.toggle).toHaveBeenCalledWith('active', true);
      expect(mockAudio.setLoop).toHaveBeenCalledWith(true);
      expect(onToggle).toHaveBeenCalledWith(true, { wasPlaying: false });
    });

    test('attach method adds event listener', () => {
      const controller = createLoopController({
        audio: mockAudio,
        loopBtn: mockLoopBtn,
        getLoopState: () => mockState.loopEnabled,
        setLoopState: (value) => { mockState.loopEnabled = value; },
        isPlaying: () => false
      });

      controller.attach();
      expect(mockLoopBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });
  });

  describe('createRhythmLoopController', () => {
    test('creates rhythm-specific loop controller', () => {
      const controller = createRhythmLoopController({
        audio: mockAudio,
        loopBtn: mockLoopBtn,
        state: mockState,
        isPlaying: () => false
      });

      expect(controller).toBeDefined();
      expect(typeof controller.toggle).toBe('function');
      expect(typeof controller.attach).toBe('function');
    });

    test('handles state object properly', () => {
      const controller = createRhythmLoopController({
        audio: mockAudio,
        loopBtn: mockLoopBtn,
        state: mockState,
        isPlaying: () => false
      });

      controller.toggle();
      expect(mockState.loopEnabled).toBe(true);
    });
  });

  describe('createPulseMemoryLoopController', () => {
    let mockEnsurePulseMemory;
    let mockGetLg;

    beforeEach(() => {
      mockEnsurePulseMemory = jest.fn();
      mockGetLg = jest.fn().mockReturnValue(8);
    });

    test('creates pulse memory loop controller', () => {
      const controller = createPulseMemoryLoopController({
        audio: mockAudio,
        loopBtn: mockLoopBtn,
        state: mockState,
        ensurePulseMemory: mockEnsurePulseMemory,
        getLg: mockGetLg,
        isPlaying: () => false
      });

      expect(controller).toBeDefined();
      expect(typeof controller.toggle).toBe('function');
      expect(typeof controller.attach).toBe('function');
    });

    test('ensures pulse memory on toggle', () => {
      const onToggle = jest.fn();
      const controller = createPulseMemoryLoopController({
        audio: mockAudio,
        loopBtn: mockLoopBtn,
        state: mockState,
        ensurePulseMemory: mockEnsurePulseMemory,
        getLg: mockGetLg,
        isPlaying: () => false,
        onToggle
      });

      controller.toggle();

      expect(mockGetLg).toHaveBeenCalled();
      expect(mockEnsurePulseMemory).toHaveBeenCalledWith(8);
      expect(onToggle).toHaveBeenCalledWith(true, { wasPlaying: false });
    });

    test('handles invalid Lg gracefully', () => {
      mockGetLg.mockReturnValue(NaN);

      const controller = createPulseMemoryLoopController({
        audio: mockAudio,
        loopBtn: mockLoopBtn,
        state: mockState,
        ensurePulseMemory: mockEnsurePulseMemory,
        getLg: mockGetLg,
        isPlaying: () => false
      });

      // Should not throw error with invalid Lg
      expect(() => controller.toggle()).not.toThrow();
      expect(mockEnsurePulseMemory).not.toHaveBeenCalled();
    });
  });

  describe('Audio sync behavior', () => {
    test('calls audio.setLoop when playing', () => {
      const controller = createLoopController({
        audio: mockAudio,
        loopBtn: mockLoopBtn,
        getLoopState: () => mockState.loopEnabled,
        setLoopState: (value) => { mockState.loopEnabled = value; },
        isPlaying: () => true
      });

      controller.toggle();
      expect(mockAudio.setLoop).toHaveBeenCalledWith(true);
    });

    test('calls audio.setLoop when not playing', () => {
      const controller = createLoopController({
        audio: mockAudio,
        loopBtn: mockLoopBtn,
        getLoopState: () => mockState.loopEnabled,
        setLoopState: (value) => { mockState.loopEnabled = value; },
        isPlaying: () => false
      });

      controller.toggle();
      expect(mockAudio.setLoop).toHaveBeenCalledWith(true);
    });

    test('handles missing audio gracefully', () => {
      const controller = createLoopController({
        audio: null,
        loopBtn: mockLoopBtn,
        getLoopState: () => mockState.loopEnabled,
        setLoopState: (value) => { mockState.loopEnabled = value; },
        isPlaying: () => false
      });

      // Should not throw error with null audio
      expect(() => controller.toggle()).not.toThrow();
    });

    test('handles audio with proxy setLoop method', () => {
      const proxyAudio = {
        setLoop: (enabled) => mockAudio?.setLoop?.(enabled)
      };

      const controller = createLoopController({
        audio: proxyAudio,
        loopBtn: mockLoopBtn,
        getLoopState: () => mockState.loopEnabled,
        setLoopState: (value) => { mockState.loopEnabled = value; },
        isPlaying: () => false
      });

      controller.toggle();
      expect(mockAudio.setLoop).toHaveBeenCalledWith(true);
    });
  });
});