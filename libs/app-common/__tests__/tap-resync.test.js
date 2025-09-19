import { computeResyncDelay } from '../audio-schedule.js';

describe('computeResyncDelay', () => {
  test('resync waits for next zero and targets step 0', () => {
    const info = computeResyncDelay({ stepIndex: 3, totalPulses: 8, bpm: 120 });
    expect(info).not.toBeNull();
    expect(info?.targetStepIndex).toBe(0);
    expect(info?.delaySeconds).toBeCloseTo((8 - 3) * (60 / 120));
  });

  test('returns null for invalid payload', () => {
    expect(computeResyncDelay({ stepIndex: -1, totalPulses: 8, bpm: 120 })).toBeNull();
    expect(computeResyncDelay({ stepIndex: 2, totalPulses: 0, bpm: 120 })).toBeNull();
    expect(computeResyncDelay({ stepIndex: 2, totalPulses: 8, bpm: 0 })).toBeNull();
  });
});
