/**
 * P-03 (auditoria 2026-07-06): ensureAudio() sense Tone crea el context
 * d'un sol ús (unlock/priming, 44100) UNA sola vegada per sessió — abans
 * el .finally() re-nul·lava la promesa i el bloc es repetia a cada crida
 * (ready(), setBase/setAccent/..., preview()).
 *
 * Fitxer propi: l'estat run-once és de mòdul i dins d'index.test.js altres
 * tests ja haurien consumit la primera crida (comptatge no determinista).
 */

import { jest } from '@jest/globals';
import { ensureAudio } from '../index.js';

let instancies = 0;

class CountingAudioContext {
  constructor() {
    instancies++;
    this.sampleRate = 44100;
    this.state = 'running';
  }
  close() { return Promise.resolve(); }
}

describe('ensureAudio — priming run-once (P-03)', () => {
  beforeAll(() => {
    global.window = global.window || globalThis;
    window.AudioContext = CountingAudioContext;
    window.webkitAudioContext = undefined;
    delete global.Tone;
  });

  test('tres crides seguides: el context d\'un sol ús es crea NOMÉS una vegada', async () => {
    await ensureAudio();
    await ensureAudio();
    await ensureAudio();
    expect(instancies).toBe(1);
  });
});
