/**
 * Fraction Recognition Exercise (Phase 2c - Exercise 4)
 *
 * Ear training exercise for rhythmic subdivisions
 * - System plays a fraction pattern (n/d)
 * - User must identify the correct fraction by listening
 * - Can replay audio unlimited times
 * - Two levels: Simple (n=1) and Complex (n varies)
 */

import { getExerciseDefinition } from './exercise-definitions.js';
import { gridFromOrigin } from '../app-common/subdivision.js';

/**
 * FractionRecognitionExercise class
 * Manages fraction ear training exercise
 */
export class FractionRecognitionExercise {
  constructor(options = {}) {
    this.exerciseId = 'fraction-recognition';
    this.definition = getExerciseDefinition(this.exerciseId);
    this.options = options;

    if (!this.definition) {
      throw new Error('Fraction recognition exercise not found');
    }

    this.currentLevel = null;
    this.currentQuestion = null;
    this.questionNumber = 0;
    this.correctCount = 0;
    this.totalAttempts = 0;
    this.listenCount = 0;
    this.results = [];
    this.isInitialized = false;
  }

  /**
   * Initialize exercise (audio system)
   */
  async initialize() {
    if (this.isInitialized) {
      return true;
    }

    try {
      // Initialize sound system
      const { init, ensureToneLoaded } = await import('../sound/index.js');
      await ensureToneLoaded();
      await init();

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize fraction recognition:', error);
      return false;
    }
  }

  /**
   * Run a specific level
   * @param {number} levelNumber - Level number (1 or 2)
   * @returns {Promise<object>} Exercise result
   */
  async runLevel(levelNumber) {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error('Failed to initialize exercise');
      }
    }

    // Get level configuration
    const level = this.definition.levels.find(l => l.level === levelNumber);
    if (!level) {
      throw new Error(`Level ${levelNumber} not found`);
    }

    this.currentLevel = level;
    this.questionNumber = 0;
    this.correctCount = 0;
    this.results = [];

    console.log(`🎯 Starting ${this.definition.title} - Level ${levelNumber}`);
    console.log(`📝 ${level.description}`);
    console.log(`ℹ️  ${level.instructions}`);
    console.log(`🎵 ${level.questionsPerLevel} questions\n`);

    // Run all questions for this level
    for (let i = 0; i < level.questionsPerLevel; i++) {
      this.questionNumber = i + 1;

      console.log(`\n${'─'.repeat(50)}`);
      console.log(`Question ${this.questionNumber}/${level.questionsPerLevel}`);
      console.log('─'.repeat(50));

      const questionResult = await this.runQuestion();
      this.results.push(questionResult);

      if (questionResult.correct) {
        this.correctCount++;
      }
    }

    // Calculate final score
    const accuracy = (this.correctCount / level.questionsPerLevel) * 100;
    const passed = accuracy >= level.minAccuracy;

    const levelResult = {
      exerciseId: this.exerciseId,
      level: levelNumber,
      timestamp: Date.now(),
      config: {
        questionsPerLevel: level.questionsPerLevel,
        minAccuracy: level.minAccuracy,
        numeratorRange: level.numeratorRange,
        denominatorRange: level.denominatorRange,
        lgRange: level.lgRange
      },
      results: this.results,
      correctCount: this.correctCount,
      totalQuestions: level.questionsPerLevel,
      accuracy,
      passed,
      totalListenCount: this.results.reduce((sum, r) => sum + r.listenCount, 0)
    };

    // Display result
    this.displayLevelResult(levelResult);

    // Submit to gamification
    await this.submitLevelResult(levelResult);

    return levelResult;
  }

  /**
   * Run a single question
   * @returns {Promise<object>} Question result
   */
  async runQuestion() {
    // Generate question
    const question = this.generateQuestion(this.currentLevel);
    this.currentQuestion = question;
    this.listenCount = 0;

    console.log(`\n🎼 Lg: ${question.lg}`);
    console.log(`🔊 Listen to the pattern...`);

    // Play audio automatically for first time
    await this.playAudio(question);
    this.listenCount++;

    // Get user answer (in a real implementation, this would be from UI)
    // For now, we'll simulate with console prompts
    const userAnswer = await this.getUserAnswer(question);

    // Validate answer
    const correct = this.validateAnswer(
      userAnswer.numerator,
      userAnswer.denominator,
      question.numerator,
      question.denominator
    );

    const result = {
      questionNumber: this.questionNumber,
      lg: question.lg,
      correctNumerator: question.numerator,
      correctDenominator: question.denominator,
      userNumerator: userAnswer.numerator,
      userDenominator: userAnswer.denominator,
      correct,
      listenCount: this.listenCount,
      timestamp: Date.now()
    };

    // Display question result
    this.displayQuestionResult(result);

    return result;
  }

  /**
   * Generate a random question for the level
   * @param {object} level - Level configuration
   * @returns {object} Question data
   */
  generateQuestion(level) {
    const [minN, maxN] = level.numeratorRange;
    const [minD, maxD] = level.denominatorRange;
    const [minLg, maxLg] = level.lgRange;

    // Random numerator
    const numerator = Math.floor(Math.random() * (maxN - minN + 1)) + minN;

    // Random denominator
    const denominator = Math.floor(Math.random() * (maxD - minD + 1)) + minD;

    // Random Lg
    const lg = Math.floor(Math.random() * (maxLg - minLg + 1)) + minLg;

    return {
      numerator,
      denominator,
      lg
    };
  }

  /**
   * Play audio for a question
   * @param {object} question - Question data
   * @returns {Promise<void>}
   */
  async playAudio(question) {
    const { init, scheduleNote } = await import('../sound/index.js');
    await init();

    const bpm = this.definition.audioConfig?.bpm || 120;
    const loopCount = this.definition.audioConfig?.loopCount || 2;

    // Calculate subdivision using gridFromOrigin
    const subdivision = gridFromOrigin({
      lg: question.lg,
      numerator: question.numerator,
      denominator: question.denominator
    });

    if (subdivision.subdivisions.length === 0) {
      console.error('❌ Failed to generate subdivision');
      return;
    }

    // Calculate timing
    const beatDuration = (60 / bpm) * 1000; // ms per beat
    const totalDuration = (question.lg / bpm) * 60 * 1000; // ms for full Lg
    const intervalPerPulse = totalDuration / question.lg;

    console.log(`  Playing ${loopCount} cycles...`);

    // Play subdivision pattern
    const accentNote = 72; // C5 - accent for pulse 0
    const baseNote = 60;   // C4 - base for subdivisions

    for (let loop = 0; loop < loopCount; loop++) {
      const loopOffset = loop * totalDuration;

      subdivision.subdivisions.forEach(sub => {
        const timestamp = sub.position * intervalPerPulse + loopOffset;
        const isAccent = sub.subdivisionIndex === 0; // First subdivision of each cycle
        const note = isAccent ? accentNote : baseNote;

        setTimeout(() => {
          scheduleNote({
            note,
            time: 0, // Immediate
            duration: 0.1
          });
        }, timestamp);
      });
    }

    // Wait for audio to finish
    const totalPlaybackTime = loopCount * totalDuration + 500; // + 500ms buffer
    await this.delay(totalPlaybackTime);
  }

  /**
   * Get user answer (simulated for console, would be UI in real implementation)
   * @param {object} question - Question data
   * @returns {Promise<object>} User answer { numerator, denominator }
   */
  async getUserAnswer(question) {
    // In a real implementation, this would show UI with inputs
    // For testing in console, we'll simulate with random guesses or allow manual input

    console.log('\n📝 Enter your answer:');
    console.log('  (In console mode, answer is auto-revealed)');
    console.log(`  Type: answer = { numerator: X, denominator: Y }; then press Enter`);

    // For automated testing, simulate a guess
    // In real UI, this would wait for user input

    // Simulate 70% correct guess for testing
    const correctGuess = Math.random() < 0.7;

    if (correctGuess) {
      return {
        numerator: question.numerator,
        denominator: question.denominator
      };
    } else {
      // Random wrong answer
      const wrongN = Math.max(1, question.numerator + (Math.random() < 0.5 ? -1 : 1));
      const wrongD = Math.max(1, question.denominator + (Math.random() < 0.5 ? -1 : 1));
      return {
        numerator: wrongN,
        denominator: wrongD
      };
    }
  }

  /**
   * Validate user answer
   * @param {number} userN - User numerator
   * @param {number} userD - User denominator
   * @param {number} correctN - Correct numerator
   * @param {number} correctD - Correct denominator
   * @returns {boolean} True if correct
   */
  validateAnswer(userN, userD, correctN, correctD) {
    // Direct comparison (no simplification for now)
    return userN === correctN && userD === correctD;
  }

  /**
   * Display question result
   * @param {object} result - Question result
   */
  displayQuestionResult(result) {
    const symbol = result.correct ? '✅' : '❌';
    console.log(`\n${symbol} ${result.correct ? 'CORRECT' : 'INCORRECT'}`);
    console.log(`  Correct answer: ${result.correctNumerator}/${result.correctDenominator}`);
    console.log(`  Your answer:    ${result.userNumerator}/${result.userDenominator}`);
    console.log(`  Listened ${result.listenCount} time(s)`);
  }

  /**
   * Display level result
   * @param {object} levelResult - Level result
   */
  displayLevelResult(levelResult) {
    console.log('\n' + '═'.repeat(60));
    console.log(levelResult.passed ? '✅ LEVEL PASSED!' : '❌ Level not passed');
    console.log('═'.repeat(60));
    console.log(`\nCorrect: ${levelResult.correctCount}/${levelResult.totalQuestions}`);
    console.log(`Accuracy: ${Math.round(levelResult.accuracy)}%`);
    console.log(`Min required: ${levelResult.config.minAccuracy}%`);
    console.log(`Total listens: ${levelResult.totalListenCount}`);
    console.log('\nResults by question:');

    levelResult.results.forEach((r, i) => {
      const symbol = r.correct ? '✅' : '❌';
      console.log(`  ${symbol} Q${i + 1}: ${r.correctNumerator}/${r.correctDenominator} (answered: ${r.userNumerator}/${r.userDenominator})`);
    });

    console.log('═'.repeat(60) + '\n');
  }

  /**
   * Submit level result to gamification
   * @param {object} levelResult - Level result
   */
  async submitLevelResult(levelResult) {
    try {
      const { recordAttempt } = await import('../gamification/index.js');

      await recordAttempt({
        exercise_type: `${this.exerciseId}_level_${levelResult.level}`,
        exercise_title: `${this.definition.title} - Nivel ${levelResult.level}`,
        score: Math.round(levelResult.accuracy),
        accuracy: levelResult.accuracy,
        metadata: {
          level: levelResult.level,
          correct_count: levelResult.correctCount,
          total_questions: levelResult.totalQuestions,
          total_listen_count: levelResult.totalListenCount,
          passed: levelResult.passed,
          questions: levelResult.results.map(r => ({
            lg: r.lg,
            correct_fraction: `${r.correctNumerator}/${r.correctDenominator}`,
            user_fraction: `${r.userNumerator}/${r.userDenominator}`,
            correct: r.correct,
            listen_count: r.listenCount
          }))
        }
      });

      console.log('✅ Result saved to database');
    } catch (error) {
      console.error('⚠️  Failed to save result to database:', error);
    }
  }

  /**
   * Render UI (for browser integration)
   * @param {HTMLElement} container - Container element
   */
  renderUI(container) {
    if (!container) {
      console.error('❌ No container provided for UI');
      return;
    }

    const level = this.currentLevel;
    const question = this.currentQuestion;

    if (!level || !question) {
      console.error('❌ No active question to render');
      return;
    }

    container.innerHTML = `
      <div class="fraction-recognition-ui">
        <h2>${this.definition.title}</h2>
        <p class="level-description">${level.description}</p>

        <div class="question-progress">
          Question ${this.questionNumber}/${level.questionsPerLevel}
        </div>

        <div class="audio-controls">
          <button id="listen-btn" class="btn-primary">🔊 Listen</button>
          <button id="repeat-btn" class="btn-secondary">🔁 Repeat</button>
        </div>

        <div class="fraction-input">
          <label>Enter the fraction:</label>
          <div class="fraction-inputs">
            ${level.level === 2 ? `
              <input type="number" id="numerator-input" min="1" max="7" placeholder="n" />
              <span>/</span>
            ` : '<span>1 /</span>'}
            <input type="number" id="denominator-input" min="1" max="12" placeholder="d" />
          </div>
        </div>

        <button id="submit-btn" class="btn-submit">Submit Answer</button>

        <div class="progress-bar">
          ${Array.from({ length: level.questionsPerLevel }, (_, i) => {
            const completed = i < this.questionNumber - 1;
            const current = i === this.questionNumber - 1;
            const className = completed ? 'completed' : (current ? 'current' : 'pending');
            return `<div class="progress-circle ${className}"></div>`;
          }).join('')}
        </div>
      </div>
    `;

    // Event listeners would be attached here
    // For now, this is just the HTML structure
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
    this.currentLevel = null;
    this.currentQuestion = null;
    this.results = [];
    this.isInitialized = false;
  }
}
