/**
 * @jest-environment jsdom
 */

import { createCycleSuperscript } from '../cycle-superscript.js';

describe('cycle-superscript', () => {
  let timeline;

  beforeEach(() => {
    timeline = document.createElement('div');
    timeline.id = 'timeline';
    document.body.appendChild(timeline);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  function createPulseNumbers(count) {
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'pulse-number';
      el.dataset.index = String(i);
      el.textContent = String(i);
      timeline.appendChild(el);
    }
  }

  describe('circular mode', () => {
    it('should update all numbers with same superscript', () => {
      createPulseNumbers(4);
      const controller = createCycleSuperscript({
        timeline,
        mode: 'circular'
      });

      controller.updateAll(2);

      const numbers = timeline.querySelectorAll('.pulse-number');
      expect(numbers[0].innerHTML).toBe('0<sup>2</sup>');
      expect(numbers[1].innerHTML).toBe('1<sup>2</sup>');
      expect(numbers[2].innerHTML).toBe('2<sup>2</sup>');
      expect(numbers[3].innerHTML).toBe('3<sup>2</sup>');
    });

    it('should default to cycle 1', () => {
      createPulseNumbers(2);
      const controller = createCycleSuperscript({
        timeline,
        mode: 'circular'
      });

      controller.updateAll();

      const numbers = timeline.querySelectorAll('.pulse-number');
      expect(numbers[0].innerHTML).toBe('0<sup>1</sup>');
      expect(numbers[1].innerHTML).toBe('1<sup>1</sup>');
    });

    it('should reset to cycle 1', () => {
      createPulseNumbers(3);
      const controller = createCycleSuperscript({
        timeline,
        mode: 'circular'
      });

      controller.updateAll(5);
      controller.reset();

      const numbers = timeline.querySelectorAll('.pulse-number');
      expect(numbers[0].innerHTML).toBe('0<sup>1</sup>');
      expect(numbers[2].innerHTML).toBe('2<sup>1</sup>');
    });
  });

  describe('linear mode', () => {
    it('should calculate superscript based on position', () => {
      createPulseNumbers(8);
      const controller = createCycleSuperscript({
        timeline,
        getPulsosPerCycle: () => 4,
        mode: 'linear'
      });

      controller.updateAll();

      const numbers = timeline.querySelectorAll('.pulse-number');
      // First cycle: 0¹, 1¹, 2¹, 3¹
      expect(numbers[0].innerHTML).toBe('0<sup>1</sup>');
      expect(numbers[1].innerHTML).toBe('1<sup>1</sup>');
      expect(numbers[2].innerHTML).toBe('2<sup>1</sup>');
      expect(numbers[3].innerHTML).toBe('3<sup>1</sup>');
      // Second cycle: 0², 1², 2², 3²
      expect(numbers[4].innerHTML).toBe('0<sup>2</sup>');
      expect(numbers[5].innerHTML).toBe('1<sup>2</sup>');
      expect(numbers[6].innerHTML).toBe('2<sup>2</sup>');
      expect(numbers[7].innerHTML).toBe('3<sup>2</sup>');
    });

    it('should handle non-divisible pulse counts', () => {
      createPulseNumbers(7);
      const controller = createCycleSuperscript({
        timeline,
        getPulsosPerCycle: () => 3,
        mode: 'linear'
      });

      controller.updateAll();

      const numbers = timeline.querySelectorAll('.pulse-number');
      // Cycle 1: 0¹, 1¹, 2¹
      expect(numbers[0].innerHTML).toBe('0<sup>1</sup>');
      expect(numbers[2].innerHTML).toBe('2<sup>1</sup>');
      // Cycle 2: 0², 1², 2²
      expect(numbers[3].innerHTML).toBe('0<sup>2</sup>');
      expect(numbers[5].innerHTML).toBe('2<sup>2</sup>');
      // Cycle 3: 0³
      expect(numbers[6].innerHTML).toBe('0<sup>3</sup>');
    });
  });

  describe('createNumberElement', () => {
    it('should create element with superscript in circular mode', () => {
      const controller = createCycleSuperscript({
        timeline,
        mode: 'circular'
      });

      const el = controller.createNumberElement(5);
      expect(el.innerHTML).toBe('5<sup>1</sup>');
      expect(el.dataset.index).toBe('5');
      expect(el.className).toBe('pulse-number');
    });

    it('should create element with position-based superscript in linear mode', () => {
      const controller = createCycleSuperscript({
        timeline,
        getPulsosPerCycle: () => 3,
        mode: 'linear'
      });

      const el = controller.createNumberElement(5);
      // Index 5: cycle 2, position 2
      expect(el.innerHTML).toBe('2<sup>2</sup>');
      expect(el.dataset.index).toBe('5');
    });

    it('should mark cycle-start for position 0 in linear mode', () => {
      const controller = createCycleSuperscript({
        timeline,
        getPulsosPerCycle: () => 4,
        mode: 'linear'
      });

      const el0 = controller.createNumberElement(0);
      const el4 = controller.createNumberElement(4);
      const el1 = controller.createNumberElement(1);

      expect(el0.classList.contains('cycle-start')).toBe(true);
      expect(el4.classList.contains('cycle-start')).toBe(true);
      expect(el1.classList.contains('cycle-start')).toBe(false);
    });
  });

  describe('updateAfterRender', () => {
    it('should call updateAll after requestAnimationFrame', (done) => {
      createPulseNumbers(2);
      const controller = createCycleSuperscript({
        timeline,
        mode: 'circular'
      });

      controller.updateAfterRender(3, () => {
        const numbers = timeline.querySelectorAll('.pulse-number');
        expect(numbers[0].innerHTML).toBe('0<sup>3</sup>');
        done();
      });
    });
  });

  describe('edge cases', () => {
    it('should return no-op controller when timeline is null', () => {
      const controller = createCycleSuperscript({
        timeline: null,
        mode: 'circular'
      });

      // Should not throw
      controller.updateAll(5);
      controller.reset();
      expect(controller.getMode()).toBe('circular');
    });

    it('should handle empty timeline', () => {
      const controller = createCycleSuperscript({
        timeline,
        mode: 'circular'
      });

      // Should not throw with no pulse numbers
      controller.updateAll(1);
    });

    it('should skip elements without valid data-index', () => {
      const invalid = document.createElement('div');
      invalid.className = 'pulse-number';
      invalid.dataset.index = 'invalid';
      timeline.appendChild(invalid);

      const controller = createCycleSuperscript({
        timeline,
        mode: 'circular'
      });

      controller.updateAll(2);
      // Should not have modified invalid element
      expect(invalid.innerHTML).toBe('');
    });

    it('should handle getPulsosPerCycle returning 0 in linear mode', () => {
      createPulseNumbers(3);
      const controller = createCycleSuperscript({
        timeline,
        getPulsosPerCycle: () => 0,
        mode: 'linear'
      });

      // Should not throw
      controller.updateAll();
    });
  });

  describe('getMode', () => {
    it('should return circular mode', () => {
      const controller = createCycleSuperscript({
        timeline,
        mode: 'circular'
      });
      expect(controller.getMode()).toBe('circular');
    });

    it('should return linear mode', () => {
      const controller = createCycleSuperscript({
        timeline,
        mode: 'linear'
      });
      expect(controller.getMode()).toBe('linear');
    });
  });
});
