/** @jest-environment jsdom */
/**
 * Tests for gamification scoring system
 */
import { jest } from '@jest/globals';
import { ScoringSystem, MULTIPLIERS, BONUSES, getScoringSystem } from '../scoring-system.js';
import { EVENT_TYPES } from '../event-system.js';

describe('ScoringSystem', () => {
  let scoringSystem;

  beforeEach(() => {
    scoringSystem = new ScoringSystem();
    // Clear localStorage mock
    localStorage.clear();
  });

  describe('MULTIPLIERS', () => {
    test('defines streak multipliers', () => {
      expect(MULTIPLIERS.STREAK[5]).toBe(1.2);
      expect(MULTIPLIERS.STREAK[10]).toBe(1.5);
      expect(MULTIPLIERS.STREAK[20]).toBe(2.0);
      expect(MULTIPLIERS.STREAK[50]).toBe(3.0);
    });

    test('defines complexity multipliers', () => {
      expect(MULTIPLIERS.COMPLEXITY.LOW).toBe(1.0);
      expect(MULTIPLIERS.COMPLEXITY.MEDIUM).toBe(1.2);
      expect(MULTIPLIERS.COMPLEXITY.HIGH).toBe(1.5);
      expect(MULTIPLIERS.COMPLEXITY.EXPERT).toBe(2.0);
    });

    test('defines accuracy multipliers', () => {
      expect(MULTIPLIERS.ACCURACY.PERFECT).toBe(2.0);
      expect(MULTIPLIERS.ACCURACY.EXCELLENT).toBe(1.5);
      expect(MULTIPLIERS.ACCURACY.GOOD).toBe(1.2);
      expect(MULTIPLIERS.ACCURACY.NORMAL).toBe(1.0);
    });
  });

  describe('BONUSES', () => {
    test('defines all bonus types', () => {
      expect(BONUSES.FIRST_TIME).toBe(50);
      expect(BONUSES.DAILY_BONUS).toBe(100);
      expect(BONUSES.PERFECT_SESSION).toBe(200);
      expect(BONUSES.EXPLORATION).toBe(25);
      expect(BONUSES.CREATIVE).toBe(30);
    });
  });

  describe('getBaseScore', () => {
    test('returns correct base scores for event types', () => {
      expect(scoringSystem.getBaseScore(EVENT_TYPES.PRACTICE_STARTED)).toBe(10);
      expect(scoringSystem.getBaseScore(EVENT_TYPES.PRACTICE_COMPLETED)).toBe(30);
      expect(scoringSystem.getBaseScore(EVENT_TYPES.PATTERN_PLAYED)).toBe(5);
      expect(scoringSystem.getBaseScore(EVENT_TYPES.PERFECT_TIMING)).toBe(30);
      expect(scoringSystem.getBaseScore(EVENT_TYPES.PATTERN_MASTERED)).toBe(50);
    });

    test('returns 1 for unknown event type', () => {
      expect(scoringSystem.getBaseScore('unknown_event')).toBe(1);
    });
  });

  describe('calculateScore', () => {
    test('calculates basic score without multipliers', () => {
      const score = scoringSystem.calculateScore(EVENT_TYPES.PRACTICE_STARTED);

      expect(score).toBe(10);
      expect(scoringSystem.sessionScore).toBe(10);
      expect(scoringSystem.totalScore).toBe(10);
    });

    test('applies complexity multiplier for high lg', () => {
      const score = scoringSystem.calculateScore(EVENT_TYPES.PATTERN_PLAYED, {
        lg_value: 35
      });

      // Base 5 * 1.5 (high complexity) = 7.5 -> 8
      expect(score).toBe(8);
    });

    test('applies accuracy multiplier for perfect accuracy', () => {
      const score = scoringSystem.calculateScore(EVENT_TYPES.RHYTHM_MATCHED, {
        accuracy_percentage: 100
      });

      // Base 20 * 2.0 (perfect) = 40
      expect(score).toBe(40);
    });

    test('applies first time bonus', () => {
      const score = scoringSystem.calculateScore(EVENT_TYPES.PATTERN_PLAYED, {
        first_time: true
      });

      // Base 5 + 50 (first time bonus) = 55
      expect(score).toBe(55);
    });

    test('applies daily bonus', () => {
      const score = scoringSystem.calculateScore(EVENT_TYPES.DAILY_PRACTICE);

      // Base 100 + 100 (daily bonus) = 200
      expect(score).toBe(200);
    });

    test('accumulates session and total scores', () => {
      scoringSystem.calculateScore(EVENT_TYPES.PRACTICE_STARTED);
      scoringSystem.calculateScore(EVENT_TYPES.PATTERN_PLAYED);
      scoringSystem.calculateScore(EVENT_TYPES.PATTERN_PLAYED);

      expect(scoringSystem.sessionScore).toBe(10 + 5 + 5);
    });

    test('updates streak on successful events', () => {
      scoringSystem.calculateScore(EVENT_TYPES.RHYTHM_MATCHED);
      scoringSystem.calculateScore(EVENT_TYPES.RHYTHM_MATCHED);
      scoringSystem.calculateScore(EVENT_TYPES.RHYTHM_MATCHED);

      expect(scoringSystem.currentStreak).toBe(3);
    });

    test('resets streak on error', () => {
      scoringSystem.calculateScore(EVENT_TYPES.RHYTHM_MATCHED);
      scoringSystem.calculateScore(EVENT_TYPES.RHYTHM_MATCHED);
      scoringSystem.calculateScore(EVENT_TYPES.PATTERN_PLAYED, { error: true });

      expect(scoringSystem.currentStreak).toBe(0);
    });
  });

  describe('getMultipliers', () => {
    test('returns empty object when no multipliers apply', () => {
      const multipliers = scoringSystem.getMultipliers({});
      expect(Object.keys(multipliers).length).toBe(0);
    });

    test('applies streak multiplier when streak >= 5', () => {
      scoringSystem.currentStreak = 5;
      const multipliers = scoringSystem.getMultipliers({});

      expect(multipliers.streak).toBe(1.2);
    });

    test('applies higher streak multiplier for longer streaks', () => {
      scoringSystem.currentStreak = 25;
      const multipliers = scoringSystem.getMultipliers({});

      expect(multipliers.streak).toBe(2.0);
    });

    test('applies complexity multiplier based on lg', () => {
      expect(scoringSystem.getMultipliers({ lg_value: 5 }).complexity).toBe(1.0);
      expect(scoringSystem.getMultipliers({ lg_value: 15 }).complexity).toBe(1.2);
      expect(scoringSystem.getMultipliers({ lg_value: 40 }).complexity).toBe(1.5);
      expect(scoringSystem.getMultipliers({ lg_value: 60 }).complexity).toBe(2.0);
    });

    test('applies accuracy multiplier', () => {
      expect(scoringSystem.getMultipliers({ accuracy_percentage: 100 }).accuracy).toBe(2.0);
      expect(scoringSystem.getMultipliers({ accuracy_percentage: 95 }).accuracy).toBe(1.5);
      expect(scoringSystem.getMultipliers({ accuracy_percentage: 80 }).accuracy).toBe(1.2);
      expect(scoringSystem.getMultipliers({ accuracy_percentage: 50 }).accuracy).toBe(1.0);
    });
  });

  describe('getBonuses', () => {
    test('applies first time bonus', () => {
      const bonus = scoringSystem.getBonuses(EVENT_TYPES.PATTERN_PLAYED, {
        first_time: true
      });

      expect(bonus).toBe(50);
    });

    test('applies perfect session bonus', () => {
      const bonus = scoringSystem.getBonuses(EVENT_TYPES.PRACTICE_COMPLETED, {
        perfect_session: true
      });

      expect(bonus).toBe(200);
    });

    test('applies exploration bonus', () => {
      const bonus = scoringSystem.getBonuses(EVENT_TYPES.PARAMETER_CHANGED, {
        unique_parameter: true
      });

      expect(bonus).toBe(25);
    });

    test('applies creative bonus for unique patterns', () => {
      const bonus = scoringSystem.getBonuses(EVENT_TYPES.PULSE_PATTERN_CREATED, {
        pattern_uniqueness: 0.9
      });

      expect(bonus).toBe(30);
    });

    test('stacks multiple bonuses', () => {
      const bonus = scoringSystem.getBonuses(EVENT_TYPES.DAILY_PRACTICE, {
        first_time: true
      });

      expect(bonus).toBe(50 + 100); // first_time + daily
    });
  });

  describe('getSessionStats', () => {
    test('returns correct stats', () => {
      scoringSystem.calculateScore(EVENT_TYPES.PRACTICE_STARTED);
      scoringSystem.calculateScore(EVENT_TYPES.PATTERN_PLAYED, { accuracy_percentage: 90 });

      const stats = scoringSystem.getSessionStats();

      expect(stats.session_score).toBe(scoringSystem.sessionScore);
      expect(stats.total_score).toBe(scoringSystem.totalScore);
      expect(stats.current_streak).toBe(scoringSystem.currentStreak);
      expect(stats.average_accuracy).toBe(90);
    });
  });

  describe('resetSession', () => {
    test('resets session data but keeps total score', () => {
      scoringSystem.calculateScore(EVENT_TYPES.PRACTICE_STARTED);
      scoringSystem.calculateScore(EVENT_TYPES.PATTERN_PLAYED);
      const totalBefore = scoringSystem.totalScore;

      scoringSystem.resetSession();

      expect(scoringSystem.sessionScore).toBe(0);
      expect(scoringSystem.currentStreak).toBe(0);
      expect(scoringSystem.sessionStartTime).toBeNull();
      expect(scoringSystem.totalScore).toBe(totalBefore);
    });
  });

  describe('getUserLevel', () => {
    test('returns correct level for score', () => {
      scoringSystem.totalScore = 0;
      expect(scoringSystem.getUserLevel().level).toBe(1);
      expect(scoringSystem.getUserLevel().title).toBe('Principiante');

      scoringSystem.totalScore = 500;
      expect(scoringSystem.getUserLevel().level).toBe(3);
      expect(scoringSystem.getUserLevel().title).toBe('Estudiante');

      scoringSystem.totalScore = 2000;
      expect(scoringSystem.getUserLevel().level).toBe(6);
      expect(scoringSystem.getUserLevel().title).toBe('Avanzado');

      scoringSystem.totalScore = 10000;
      expect(scoringSystem.getUserLevel().level).toBe(10);
      expect(scoringSystem.getUserLevel().title).toBe('Gran Maestro');
    });

    test('includes progress percentage', () => {
      scoringSystem.totalScore = 150;
      const level = scoringSystem.getUserLevel();

      expect(level.level).toBe(2);
      expect(level.progress_percentage).toBeGreaterThan(0);
      expect(level.progress_percentage).toBeLessThan(100);
    });
  });

  describe('exportData/importData', () => {
    test('exports data correctly', () => {
      scoringSystem.calculateScore(EVENT_TYPES.PRACTICE_STARTED);

      const exported = scoringSystem.exportData();

      expect(exported.version).toBe('1.0.0');
      expect(exported.total_score).toBe(scoringSystem.totalScore);
      expect(exported.session_score).toBe(scoringSystem.sessionScore);
      expect(exported.user_level).toBeDefined();
    });

    test('imports data correctly', () => {
      const data = {
        version: '1.0.0',
        total_score: 500,
        session_score: 100,
        current_streak: 10
      };

      const result = scoringSystem.importData(data);

      expect(result).toBe(true);
      expect(scoringSystem.totalScore).toBe(500);
      expect(scoringSystem.sessionScore).toBe(100);
      expect(scoringSystem.currentStreak).toBe(10);
    });

    test('rejects incompatible version', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = scoringSystem.importData({ version: '2.0.0' });

      expect(result).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  describe('getScoringSystem singleton', () => {
    test('returns the same instance', () => {
      const instance1 = getScoringSystem();
      const instance2 = getScoringSystem();

      expect(instance1).toBe(instance2);
    });
  });
});
