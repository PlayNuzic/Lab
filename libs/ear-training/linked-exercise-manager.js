/**
 * Linked Exercise Manager (Phase 2c)
 *
 * Manages linked exercises (Exercise 1 + Exercise 2)
 * - Executes Exercise 1 (Sequence Entry)
 * - If passed, executes Exercise 2 (Rhythm Sync) with 3 BPM repetitions
 * - Calculates combined score
 */

import { ExerciseRunner } from './exercise-runner.js';
import { getExerciseDefinition } from './exercise-definitions.js';

/**
 * LinkedExerciseManager class
 * Manages execution of two linked exercises
 */
export class LinkedExerciseManager {
  constructor(exercise1Id, exercise2Id, options = {}) {
    this.exercise1Id = exercise1Id;
    this.exercise2Id = exercise2Id;
    this.options = options;

    // Validate that exercises exist and are linked
    const def1 = getExerciseDefinition(exercise1Id);
    const def2 = getExerciseDefinition(exercise2Id);

    if (!def1) {
      throw new Error(`Exercise 1 not found: ${exercise1Id}`);
    }

    if (!def2) {
      throw new Error(`Exercise 2 not found: ${exercise2Id}`);
    }

    if (!def1.linked || def1.linkedExercise !== exercise2Id) {
      console.warn(`⚠️  Exercise 1 (${exercise1Id}) is not linked to Exercise 2 (${exercise2Id})`);
    }

    if (!def2.linked || def2.linkedExercise !== exercise1Id) {
      console.warn(`⚠️  Exercise 2 (${exercise2Id}) is not linked to Exercise 1 (${exercise1Id})`);
    }

    this.def1 = def1;
    this.def2 = def2;

    this.runner1 = null;
    this.runner2 = null;
  }

  /**
   * Initialize both exercise runners
   */
  async initialize() {
    console.log('🔧 Initializing linked exercises...');

    this.runner1 = new ExerciseRunner(this.exercise1Id, this.options);
    this.runner2 = new ExerciseRunner(this.exercise2Id, this.options);

    const init1 = await this.runner1.initialize();
    const init2 = await this.runner2.initialize();

    if (!init1 || !init2) {
      throw new Error('Failed to initialize one or both exercises');
    }

    console.log('✅ Linked exercises initialized');
    return true;
  }

  /**
   * Run linked exercises for a specific level
   * @param {number} level - Level number (1-4)
   * @returns {Promise<object>} Combined result
   */
  async runLinkedLevel(level) {
    console.log('\n' + '═'.repeat(60));
    console.log(`🎯 LINKED EXERCISE - LEVEL ${level}`);
    console.log('═'.repeat(60));

    // Part 1: Exercise 1 (Sequence Entry)
    console.log('\n📝 PART 1/2: ' + this.def1.title.toUpperCase());
    console.log('─'.repeat(60));

    const result1 = await this.runner1.runLevel(level);

    if (!result1.score.passed) {
      console.log('\n❌ Part 1 not passed. You must pass Part 1 to continue to Part 2.');
      return {
        completed: false,
        passed: false,
        part1: result1,
        part2: null,
        combinedScore: result1.score.total,
        message: 'Part 1 not passed. Try again to unlock Part 2.'
      };
    }

    console.log('\n✅ Part 1 passed! Moving to Part 2...\n');

    // Wait a moment before starting Part 2
    await this.delay(1500);

    // Part 2: Exercise 2 (Rhythm Sync) with 3 BPM repetitions
    console.log('📝 PART 2/2: ' + this.def2.title.toUpperCase());
    console.log('─'.repeat(60));

    const repetitions = this.def2.repetitionsPerLevel || 3;
    const result2 = await this.runExercise2WithRepetitions(level, repetitions);

    // Calculate combined score
    const combinedScore = this.calculateCombinedScore(result1, result2);

    const linkedResult = {
      completed: true,
      passed: result1.score.passed && result2.passed,
      part1: result1,
      part2: result2,
      combinedScore,
      totalDuration_ms: (result1.metadata.duration_ms || 0) + (result2.totalDuration_ms || 0),
      timestamp: Date.now()
    };

    // Display combined result
    this.displayLinkedResult(linkedResult);

    // Submit linked result to gamification
    await this.submitLinkedResult(linkedResult, level);

    return linkedResult;
  }

  /**
   * Run Exercise 2 with multiple BPM repetitions
   * @param {number} level - Level number
   * @param {number} repetitions - Number of repetitions (usually 3)
   * @returns {Promise<object>} Exercise 2 result with all repetitions
   */
  async runExercise2WithRepetitions(level, repetitions) {
    // Generate ascending BPM sequence
    const bpms = this.generateBPMSequence(repetitions, this.def2.bpmRange);

    console.log(`🎵 ${repetitions} repeticiones con BPMs crecientes:`, bpms);
    console.log('');

    const repetitionResults = [];
    let totalScore = 0;

    for (let i = 0; i < repetitions; i++) {
      const bpm = bpms[i];

      console.log(`\n🔄 Repetition ${i + 1}/${repetitions} - BPM: ${bpm}`);
      console.log('─'.repeat(40));

      const result = await this.runner2.runLevel(level, bpm);

      repetitionResults.push({
        repetition: i + 1,
        bpm,
        result
      });

      totalScore += result.score.total;

      // Wait between repetitions
      if (i < repetitions - 1) {
        await this.delay(1000);
      }
    }

    const averageScore = Math.round(totalScore / repetitions);
    const allPassed = repetitionResults.every(r => r.result.score.passed);

    return {
      repetitions: repetitionResults,
      averageScore,
      passed: allPassed,
      bpms,
      totalDuration_ms: repetitionResults.reduce((sum, r) => sum + (r.result.metadata.duration_ms || 0), 0)
    };
  }

  /**
   * Generate ascending BPM sequence
   * @param {number} count - Number of BPMs to generate
   * @param {number[]} range - [min, max] BPM range
   * @returns {number[]} Array of ascending BPMs
   */
  generateBPMSequence(count, range) {
    const [min, max] = range;
    const span = max - min;

    // Divide the range into segments
    const segmentSize = span / count;

    const bpms = [];
    for (let i = 0; i < count; i++) {
      const segmentMin = min + (i * segmentSize);
      const segmentMax = min + ((i + 1) * segmentSize);

      // Random BPM within this segment
      const bpm = Math.floor(Math.random() * (segmentMax - segmentMin + 1)) + segmentMin;
      bpms.push(bpm);
    }

    // Ensure ascending order (sort just in case random didn't cooperate)
    bpms.sort((a, b) => a - b);

    return bpms;
  }

  /**
   * Calculate combined score from Part 1 and Part 2
   * @param {object} result1 - Exercise 1 result
   * @param {object} result2 - Exercise 2 result (with repetitions)
   * @returns {number} Combined score (0-100)
   */
  calculateCombinedScore(result1, result2) {
    const score1 = result1.score.total;
    const score2 = result2.averageScore;

    // Simple average
    return Math.round((score1 + score2) / 2);
  }

  /**
   * Display linked result
   * @param {object} linkedResult - Linked result object
   */
  displayLinkedResult(linkedResult) {
    console.log('\n' + '═'.repeat(60));
    console.log(linkedResult.passed ? '🏆 LINKED EXERCISE COMPLETED!' : '📊 LINKED EXERCISE FINISHED');
    console.log('═'.repeat(60));

    console.log('\n📊 RESULTS SUMMARY:');
    console.log('─'.repeat(60));

    console.log(`\nPart 1 (${this.def1.title}):`);
    console.log(`  Score: ${linkedResult.part1.score.total}/100`);
    console.log(`  Passed: ${linkedResult.part1.score.passed ? '✅' : '❌'}`);

    console.log(`\nPart 2 (${this.def2.title}):`);
    console.log(`  Average Score: ${linkedResult.part2.averageScore}/100`);
    console.log(`  Passed: ${linkedResult.part2.passed ? '✅' : '❌'}`);

    console.log(`\n📈 COMBINED SCORE: ${linkedResult.combinedScore}/100`);

    console.log('\nPart 2 Repetitions:');
    linkedResult.part2.repetitions.forEach(rep => {
      const status = rep.result.score.passed ? '✅' : '❌';
      console.log(`  ${status} Rep ${rep.repetition}: BPM ${rep.bpm} → ${rep.result.score.total}/100`);
    });

    console.log('\n' + '═'.repeat(60) + '\n');
  }

  /**
   * Submit linked result to gamification
   * @param {object} linkedResult - Linked result object
   * @param {number} level - Level number
   */
  async submitLinkedResult(linkedResult, level) {
    try {
      const { recordAttempt } = await import('../gamification/index.js');

      await recordAttempt({
        exercise_type: `linked_${this.exercise1Id}_${this.exercise2Id}_level_${level}`,
        exercise_title: `Linked: ${this.def1.title} + ${this.def2.title} - Nivel ${level}`,
        score: linkedResult.combinedScore,
        accuracy: linkedResult.combinedScore,
        metadata: {
          level,
          linked: true,
          part1_score: linkedResult.part1.score.total,
          part1_passed: linkedResult.part1.score.passed,
          part2_average_score: linkedResult.part2.averageScore,
          part2_passed: linkedResult.part2.passed,
          part2_bpms: linkedResult.part2.bpms,
          part2_repetitions: linkedResult.part2.repetitions.length,
          combined_passed: linkedResult.passed,
          total_duration_ms: linkedResult.totalDuration_ms
        }
      });

      console.log('✅ Linked result saved to database');
    } catch (error) {
      console.error('⚠️  Failed to save linked result to database:', error);
    }
  }

  /**
   * Delay utility
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Dispose of resources
   */
  dispose() {
    if (this.runner1) {
      this.runner1.dispose();
    }
    if (this.runner2) {
      this.runner2.dispose();
    }
    this.runner1 = null;
    this.runner2 = null;
  }
}
