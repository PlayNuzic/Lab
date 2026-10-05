/**
 * @jest-environment jsdom
 */

// Una nota que no pot sonar ara no es guarda per després (2026-10-05).
// Test d'usuari: a App12/App15, amb l'AudioContext en pausa (Safari), les
// previsualitzacions dels clics quedaven a la cua i sonaven totes de cop en
// fer Play, al pols 0 — també les de notes ja esborrades.

import { jest } from '@jest/globals';

class FakeTimelineAudio {
  constructor() {
    this.mixer = { registerChannel: jest.fn() };
    this._ctx = null;
  }
  stop() {}
}

jest.unstable_mockModule('../index.js', () => ({ default: FakeTimelineAudio }));
jest.unstable_mockModule('../piano.js', () => ({ loadPiano: jest.fn(), resetPiano: jest.fn() }));
jest.unstable_mockModule('../flute.js', () => ({ loadFlute: jest.fn(), resetFlute: jest.fn() }));
jest.unstable_mockModule('../tone-loader.js', () => ({ ensureToneLoaded: jest.fn() }));
jest.unstable_mockModule('../sampler-pool.js', () => ({ createSamplerPool: jest.fn(), ADSR_PRESETS: {} }));

const { MelodicTimelineAudio } = await import('../melodic-audio.js');

const flush = () => new Promise((r) => setTimeout(r, 0));

function crea(state = 'running', resume) {
  const audio = new MelodicTimelineAudio();
  const ctx = {
    state,
    currentTime: 5,
    resume: jest.fn(resume ?? (async () => { ctx.state = 'running'; ctx.currentTime = 7; })),
  };
  audio._ctx = ctx;
  audio._samplerPool = { isReady: () => true, playNote: jest.fn() };
  return { audio, ctx, pool: audio._samplerPool };
}

describe('MelodicTimelineAudio — notes amb el context en pausa', () => {
  afterEach(() => jest.restoreAllMocks());

  test('context en marxa: la nota sona a l\'hora demanada', () => {
    const { audio, ctx, pool } = crea('running');
    audio.playNote(62, 0.5, 5.1);
    expect(pool.playNote).toHaveBeenCalledWith(62, 0.5, 5.1, 0.8);
    expect(ctx.resume).not.toHaveBeenCalled();
  });

  test('context en pausa: la nota no es posa a la cua; si el context torna de seguida, sona ARA', async () => {
    const { audio, ctx, pool } = crea('suspended');
    audio.playNote(69, 0.5, 5.1);
    expect(pool.playNote).not.toHaveBeenCalled();     // res programat amb el rellotge aturat
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    await flush();
    expect(pool.playNote).toHaveBeenCalledWith(69, 0.5, 7, 0.8);   // hora del context reprès
  });

  test('context en pausa i resume tardà (el Play, segons després): la nota es descarta', async () => {
    let allibera;
    const { audio, ctx, pool } = crea('suspended', () => new Promise((r) => { allibera = r; }));
    const now = jest.spyOn(performance, 'now').mockReturnValue(1000);
    audio.playNote(69, 0.5, 5.1);
    now.mockReturnValue(4000);                        // el Play arriba 3 s després
    ctx.state = 'running';
    allibera();
    await flush();
    expect(pool.playNote).not.toHaveBeenCalled();
  });

  test('context en pausa i resume refusat (sense gest): la nota es descarta', async () => {
    const { audio, pool } = crea('suspended', async () => { throw new DOMException('not allowed', 'NotAllowedError'); });
    audio.playNote(69, 0.5, 5.1);
    await flush();
    expect(pool.playNote).not.toHaveBeenCalled();
  });

  test('les notes del scheduler amb el context aturat es descarten sense reintent', async () => {
    const { audio, ctx, pool } = crea('suspended');
    audio._playScheduledNote(60, 0.5, 5.2, 0.8);
    await flush();
    expect(ctx.resume).not.toHaveBeenCalled();
    expect(pool.playNote).not.toHaveBeenCalled();
    ctx.state = 'running';
    audio._playScheduledNote(60, 0.5, 5.2, 0.8);
    expect(pool.playNote).toHaveBeenCalledWith(60, 0.5, 5.2, 0.8);
  });

  test('playChord segueix la mateixa regla', async () => {
    const { audio, pool } = crea('suspended');
    audio.playChord([60, 64, 67], 0.5, 5.1);
    expect(pool.playNote).not.toHaveBeenCalled();
    await flush();
    expect(pool.playNote.mock.calls.map((c) => [c[0], c[2]])).toEqual([[60, 7], [64, 7], [67, 7]]);
  });
});
