/** @jest-environment jsdom */
/**
 * Tests for gamification event system
 */
import { jest } from '@jest/globals';
import { GameEventSystem, EVENT_TYPES, getEventSystem } from '../event-system.js';

describe('GameEventSystem', () => {
  let eventSystem;

  beforeEach(() => {
    eventSystem = new GameEventSystem();
  });

  describe('EVENT_TYPES', () => {
    test('defines all expected event types', () => {
      expect(EVENT_TYPES.PRACTICE_STARTED).toBe('practice_started');
      expect(EVENT_TYPES.PRACTICE_COMPLETED).toBe('practice_completed');
      expect(EVENT_TYPES.PATTERN_PLAYED).toBe('pattern_played');
      expect(EVENT_TYPES.TAP_TEMPO_USED).toBe('tap_tempo_used');
      expect(EVENT_TYPES.TAP_TEMPO_ACCURATE).toBe('tap_tempo_accurate');
      expect(EVENT_TYPES.RHYTHM_MATCHED).toBe('rhythm_matched');
      expect(EVENT_TYPES.PERFECT_TIMING).toBe('perfect_timing');
      expect(EVENT_TYPES.PARAMETER_CHANGED).toBe('parameter_changed');
      expect(EVENT_TYPES.RANDOMIZATION_USED).toBe('randomization_used');
      expect(EVENT_TYPES.FRACTION_CREATED).toBe('fraction_created');
      expect(EVENT_TYPES.PULSE_PATTERN_CREATED).toBe('pulse_pattern_created');
      expect(EVENT_TYPES.LOOP_ACTIVATED).toBe('loop_activated');
    });
  });

  describe('trackEvent', () => {
    test('creates event with correct structure', () => {
      const event = eventSystem.trackEvent(EVENT_TYPES.PRACTICE_STARTED, {
        app_id: 'App1'
      });

      expect(event).not.toBeNull();
      expect(event.evento_id).toMatch(/^evt_/);
      expect(event.evento_tipo).toBe(EVENT_TYPES.PRACTICE_STARTED);
      expect(event.timestamp).toBeDefined();
      expect(event.app_id).toBe('App1');
      expect(event.puntuacion_base).toBe(5);
    });

    test('returns null for unknown event type', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const event = eventSystem.trackEvent('unknown_event');

      expect(event).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    test('initializes session on first event', () => {
      expect(eventSystem.sessionStartTime).toBeNull();

      eventSystem.trackEvent(EVENT_TYPES.PRACTICE_STARTED);

      expect(eventSystem.sessionStartTime).not.toBeNull();
    });

    test('increments event count', () => {
      expect(eventSystem.eventCount).toBe(0);

      eventSystem.trackEvent(EVENT_TYPES.PATTERN_PLAYED);
      eventSystem.trackEvent(EVENT_TYPES.PATTERN_PLAYED);
      eventSystem.trackEvent(EVENT_TYPES.PATTERN_PLAYED);

      expect(eventSystem.eventCount).toBe(3);
    });

    test('adds event to history', () => {
      eventSystem.trackEvent(EVENT_TYPES.PRACTICE_STARTED);
      eventSystem.trackEvent(EVENT_TYPES.PATTERN_PLAYED);

      expect(eventSystem.events.length).toBe(2);
    });

    test('calculates session duration in metadata', () => {
      eventSystem.trackEvent(EVENT_TYPES.PRACTICE_STARTED);

      // Wait a bit to have measurable duration
      const event = eventSystem.trackEvent(EVENT_TYPES.PATTERN_PLAYED);

      expect(event.metadata.session_duration).toBeDefined();
      expect(typeof event.metadata.session_duration).toBe('number');
    });
  });

  describe('calculateBasePoints', () => {
    test('returns correct points for each event type', () => {
      expect(eventSystem.calculateBasePoints(EVENT_TYPES.PRACTICE_STARTED)).toBe(5);
      expect(eventSystem.calculateBasePoints(EVENT_TYPES.PRACTICE_COMPLETED)).toBe(20);
      expect(eventSystem.calculateBasePoints(EVENT_TYPES.PERFECT_TIMING)).toBe(25);
      expect(eventSystem.calculateBasePoints(EVENT_TYPES.PATTERN_MASTERED)).toBe(40);
    });

    test('returns 1 for unknown event type', () => {
      expect(eventSystem.calculateBasePoints('unknown')).toBe(1);
    });
  });

  describe('getEventHistory', () => {
    beforeEach(() => {
      eventSystem.trackEvent(EVENT_TYPES.PRACTICE_STARTED, { app_id: 'App1' });
      eventSystem.trackEvent(EVENT_TYPES.PATTERN_PLAYED, { app_id: 'App1' });
      eventSystem.trackEvent(EVENT_TYPES.PATTERN_PLAYED, { app_id: 'App2' });
      eventSystem.trackEvent(EVENT_TYPES.TAP_TEMPO_USED, { app_id: 'App1' });
    });

    test('returns all events without filters', () => {
      const history = eventSystem.getEventHistory();
      expect(history.length).toBe(4);
    });

    test('filters by event type', () => {
      const history = eventSystem.getEventHistory({
        eventType: EVENT_TYPES.PATTERN_PLAYED
      });

      expect(history.length).toBe(2);
      history.forEach(e => {
        expect(e.evento_tipo).toBe(EVENT_TYPES.PATTERN_PLAYED);
      });
    });

    test('filters by app id', () => {
      const history = eventSystem.getEventHistory({ appId: 'App1' });

      expect(history.length).toBe(3);
      history.forEach(e => {
        expect(e.app_id).toBe('App1');
      });
    });

    test('filters by time range', () => {
      const now = Date.now();
      const history = eventSystem.getEventHistory({
        startTime: now - 10000,
        endTime: now + 10000
      });

      expect(history.length).toBe(4);
    });
  });

  describe('getSessionStats', () => {
    test('returns null when no session started', () => {
      expect(eventSystem.getSessionStats()).toBeNull();
    });

    test('returns correct stats after events', () => {
      eventSystem.trackEvent(EVENT_TYPES.PRACTICE_STARTED);
      eventSystem.trackEvent(EVENT_TYPES.PATTERN_PLAYED);
      eventSystem.trackEvent(EVENT_TYPES.PATTERN_PLAYED);

      const stats = eventSystem.getSessionStats();

      expect(stats.session_id).toBeDefined();
      expect(stats.total_events).toBe(3);
      expect(stats.total_points).toBe(5 + 3 + 3); // practice_started + 2x pattern_played
      expect(stats.events_by_type[EVENT_TYPES.PRACTICE_STARTED]).toBe(1);
      expect(stats.events_by_type[EVENT_TYPES.PATTERN_PLAYED]).toBe(2);
    });
  });

  describe('clearEvents', () => {
    test('clears all event data', () => {
      eventSystem.trackEvent(EVENT_TYPES.PRACTICE_STARTED);
      eventSystem.trackEvent(EVENT_TYPES.PATTERN_PLAYED);

      eventSystem.clearEvents();

      expect(eventSystem.events.length).toBe(0);
      expect(eventSystem.eventCount).toBe(0);
      expect(eventSystem.sessionStartTime).toBeNull();
    });
  });

  describe('event listeners', () => {
    test('notifies listeners when event is tracked', () => {
      const listener = jest.fn();
      eventSystem.addEventListener(listener);

      eventSystem.trackEvent(EVENT_TYPES.PRACTICE_STARTED);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].evento_tipo).toBe(EVENT_TYPES.PRACTICE_STARTED);
    });

    test('can remove listeners', () => {
      const listener = jest.fn();
      const listenerId = eventSystem.addEventListener(listener);

      eventSystem.removeEventListener(listenerId);
      eventSystem.trackEvent(EVENT_TYPES.PRACTICE_STARTED);

      expect(listener).not.toHaveBeenCalled();
    });

    test('handles listener errors gracefully', () => {
      const errorListener = jest.fn(() => {
        throw new Error('Listener error');
      });
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      eventSystem.addEventListener(errorListener);

      expect(() => {
        eventSystem.trackEvent(EVENT_TYPES.PRACTICE_STARTED);
      }).not.toThrow();

      consoleSpy.mockRestore();
    });
  });

  describe('exportEvents/importEvents', () => {
    test('exports events with correct structure', () => {
      eventSystem.trackEvent(EVENT_TYPES.PRACTICE_STARTED);
      eventSystem.trackEvent(EVENT_TYPES.PATTERN_PLAYED);

      const exported = eventSystem.exportEvents();

      expect(exported.version).toBe('1.0.0');
      expect(exported.export_date).toBeDefined();
      expect(exported.event_count).toBe(2);
      expect(exported.events.length).toBe(2);
    });

    test('imports events correctly', () => {
      const data = {
        version: '1.0.0',
        session_id: 12345,
        event_count: 2,
        events: [
          { evento_tipo: EVENT_TYPES.PRACTICE_STARTED, timestamp: 1000 },
          { evento_tipo: EVENT_TYPES.PATTERN_PLAYED, timestamp: 2000 }
        ]
      };

      const result = eventSystem.importEvents(data);

      expect(result).toBe(true);
      expect(eventSystem.events.length).toBe(2);
      expect(eventSystem.eventCount).toBe(2);
    });

    test('rejects incompatible version', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = eventSystem.importEvents({ version: '2.0.0' });

      expect(result).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  describe('detectPracticePatterns', () => {
    test('detects active practice', () => {
      // Simulate many events
      for (let i = 0; i < 15; i++) {
        eventSystem.trackEvent(EVENT_TYPES.PATTERN_PLAYED);
      }

      const patterns = eventSystem.detectPracticePatterns();

      expect(patterns.is_practicing_actively).toBe(true);
      expect(patterns.is_focused).toBe(true);
    });

    test('detects exploration mode', () => {
      for (let i = 0; i < 8; i++) {
        eventSystem.trackEvent(EVENT_TYPES.PARAMETER_CHANGED);
      }

      const patterns = eventSystem.detectPracticePatterns();

      expect(patterns.is_exploring).toBe(true);
    });
  });

  describe('getEventSystem singleton', () => {
    test('returns the same instance', () => {
      const instance1 = getEventSystem();
      const instance2 = getEventSystem();

      expect(instance1).toBe(instance2);
    });
  });
});
