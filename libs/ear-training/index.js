class EarTrainingGame {
  constructor(options = {}) {
    this.randInt = options.randInt || ((a, b) => Math.floor(Math.random() * (b - a + 1)) + a);
    this.requiredToLevelUp = 5;
    this.requiredPerMode = options.requiredPerMode || null;
    this.correctPerMode = { iS: 0, iA: 0 };
    this.intervals = {
      1: [0, 1, 2, 12],                       // dissonant seconds
      2: [0, 3, 4, 12],                       // consonant thirds
      3: [0, 5, 7, 12],                       // resonant fourth & fifth
      4: [0, 5, 6, 7, 12],                    // resonant fourth, tritone & fifth
      5: [0, 8, 9, 12],                       // consonant sixths
      6: [0, 10, 11, 12],                     // dissonant sevenths
      7: [0, 1, 2, 10, 11, 12],               // extremes dissonants
      8: [0, 3, 4, 8, 9, 12],                 // consonant thirds & sixths
      9: [0, 1, 2, 3, 4, 8, 9, 10, 11, 12],   // mix dissonant & consonant
      10: [0,1,2,3,4,5,6,7,8,9,10,11,12]      // all intervals
    };
    this.start('iS', 1);
  }

  start(mode = 'iS', level = 1) {
    this.mode = mode;
    this.level = level;
    this.question = 0;
    this.correctLevel = 0;
    this.wrongLevel = 0;
    this.correctTotal = 0;
    this.wrongTotal = 0;
    this.repeat = false;
    this.history = [];
    this.correctPerMode = { iS: 0, iA: 0 };
  }

  generateQuestion() {
    this.question += 1;
    let opts = this.intervals[this.level];
    if (this.mode === 'iS') {
      opts = [...opts, ...opts.filter(n => n !== 0).map(n => -n)];
    }
    const weighted = [];
    opts.forEach(i => {
      const abs = Math.abs(i);
      const w = abs === 0 || abs === 12 ? 1 : 4;
      for(let j=0;j<w;j++) weighted.push(i);
    });
    this.currentInterval = weighted[this.randInt(0, weighted.length - 1)];
    this.note1 = 60 + this.randInt(0, 11);
    this.note2 = this.note1 + this.currentInterval;
  }

  next() {
    if (!this.repeat) {
      this.generateQuestion();
    }
    return {
      note1: this.note1,
      note2: this.note2,
      currentInterval: this.currentInterval,
      question: this.question,
      level: this.level
    };
  }

  answer(value) {
    const expected = this.currentInterval;
    const correct = value === expected;
    this.history.push({ interval: expected, value, correct, level: this.level, mode: this.mode });
    if (correct) {
      const ignore = expected === 0 || Math.abs(expected) === 12;
      if (!ignore) {
        this.correctLevel++;
        this.correctTotal++;
        this.correctPerMode[this.mode]++;
      }
      const levelUp = this.requiredPerMode
        ? (this.correctPerMode.iS >= this.requiredPerMode && this.correctPerMode.iA >= this.requiredPerMode)
        : (this.correctLevel >= this.requiredToLevelUp);
      this.repeat = false;
      return { correct: true, levelUp };
    }
    if (!this.repeat) {
      this.wrongLevel++;
      this.wrongTotal++;
      this.repeat = true;
      return { correct: false, retry: true };
    }
    this.repeat = false;
    return { correct: false, retry: false };
  }
}

export default EarTrainingGame;
