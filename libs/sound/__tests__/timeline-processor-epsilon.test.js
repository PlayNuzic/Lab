/**
 * T-01 (auditoria 2026-07-06): congela com a contracte executable el
 * mecanisme anti-doble-tret del worklet — l'epsilon 1e-9 dels comptadors
 * de polsos (while, timeline-processor.js:339) i de veus polirítmiques
 * (if, :365) amb acumulació `+=` (mai `=`).
 *
 * Fitxer PROPI (no dins index.test.js): jest aïlla el registre de mòduls
 * per fitxer, així l'import de timeline-processor.js sempre re-invoca
 * registerProcessor aquí (dins d'index.test.js un segon import serviria
 * la cache ESM i el ctor no es capturaria).
 *
 * Notes de frontera: NO es testeja la igualtat exacta a 1e-9 — després de
 * 128 restes per bloc l'error d'acumulació (~1e-16) fa aquella frontera
 * inestable per construcció. Es testegen 5e-10 (clarament dins l'epsilon:
 * ha de disparar UN cop) i 2e-9 (clarament fora: NO ha de disparar), que
 * és la garantia real de l'invariant. Cap assert sobre `time` (NaN a Node:
 * currentTime no existeix a l'AudioWorkletGlobalScope simulat).
 */

const SR = 48000;
const INTERVAL = 0.5;                 // secondsPerBeat
const BPS = (1 / SR) / INTERVAL;      // beats per sample
const BLOCK = 128 * BPS;              // beats que avança un process()

let ProcessorCtor = null;

beforeAll(async () => {
  global.sampleRate = SR;
  global.AudioWorkletProcessor = class {
    constructor() {
      this.port = { postMessage: () => {}, onmessage: null };
    }
  };
  global.registerProcessor = (_, ctor) => { ProcessorCtor = ctor; };
  await import('../timeline-processor.js');
});

afterAll(() => {
  delete global.sampleRate;
  delete global.AudioWorkletProcessor;
  delete global.registerProcessor;
});

/** Crea un processor arrencat (loop, 1/1: sense veus, cycle mínim) i un
 *  recol·lector de missatges filtrable per tipus. */
function mkProcessor() {
  const msgs = [];
  const p = new ProcessorCtor();
  p.port.postMessage = (msg) => { msgs.push(msg); };
  p.port.onmessage({
    data: {
      action: 'start',
      total: 8,
      interval: INTERVAL,
      loop: true,
      numerator: 1,
      denominator: 1,
      pattern: 8
    }
  });
  const outputs = [[new Float32Array(128)]];
  const runBlock = () => { p.process([], outputs); };
  const drain = (type) => {
    const n = msgs.filter(m => m && m.type === type).length;
    msgs.length = 0;
    return n;
  };
  return { p, runBlock, drain };
}

describe('epsilon 1e-9 del worklet — anti doble-tret (T-01)', () => {
  test('el ctor es captura via registerProcessor', () => {
    expect(typeof ProcessorCtor).toBe('function');
  });

  test('polsos: residu DINS l\'epsilon (5e-10) dispara exactament UN pols al bloc', () => {
    const { p, runBlock, drain } = mkProcessor();
    runBlock(); drain('pulse'); // flush del pols inicial (countdown neix a 0)

    // En acabar el bloc el comptador cau a ~5e-10 ≤ 1e-9 → un tret, i el
    // += 1 el deixa a ~1 (cap segon tret possible dins del mateix bloc).
    p.pulseCountdownBeats = BLOCK + 5e-10;
    runBlock();
    expect(drain('pulse')).toBe(1);
    expect(p.pulseCountdownBeats).toBeGreaterThan(0.9); // += conserva residu, no reinicia
  });

  test('polsos: residu FORA l\'epsilon (2e-9) NO dispara al bloc; dispara al següent', () => {
    const { p, runBlock, drain } = mkProcessor();
    runBlock(); drain('pulse');

    p.pulseCountdownBeats = BLOCK + 2e-9;
    runBlock();
    expect(drain('pulse')).toBe(0);   // 2e-9 > 1e-9: encara no toca

    runBlock();
    expect(drain('pulse')).toBe(1);   // al bloc següent, exactament un
  });

  test('polsos: sense deriva ni catch-up espuri en tirada llarga (3 beats → 3 polsos)', () => {
    const { p, runBlock, drain } = mkProcessor();
    runBlock(); drain('pulse');

    // 3 beats = 3/BLOCK ≈ 562.5 blocs; amb 563 blocs n'han de sortir 3
    // exactes (mai 2 per deriva ni 4 per doble-tret).
    const blocs = Math.ceil(3 / BLOCK);
    let total = 0;
    for (let i = 0; i < blocs; i++) { runBlock(); total += drain('pulse'); }
    expect(total).toBe(3);
  });

  test('veus: catch-up amb període < beatsPerSample — cap dèficit acumulat (A-12)', () => {
    const { p, runBlock, drain } = mkProcessor();
    // period 1e-5 << beatsPerSample (4.17e-5): l\'antic `if` emetia com a
    // molt 1 per sample (128/bloc) i acumulava dèficit; el while emet
    // exactament les degudes (≈ BLOCK/period per bloc).
    p.port.onmessage({
      data: { action: 'setVoices', voices: [{ id: 'vfast', numerator: 1, denominator: 100000 }] }
    });
    runBlock();
    const emeses = drain('voice');
    const esperades = BLOCK / (1 / 100000); // ≈ 533.3
    expect(Math.abs(emeses - esperades)).toBeLessThanOrEqual(1);
    expect(emeses).toBeGreaterThan(128); // l\'if antic mai passava de 128/bloc
  });

  test('veus: denominador Infinity es saneja (període mai 0 → cap bucle infinit) (A-12)', () => {
    const { p, runBlock, drain } = mkProcessor();
    p.port.onmessage({
      data: { action: 'setVoices', voices: [{ id: 'vinf', numerator: 1, denominator: Infinity }] }
    });
    const veu = p._voiceList[0];
    expect(veu.periodBeats).toBeGreaterThan(0);   // sanejat: den Infinity → 1
    expect(Number.isFinite(veu.periodBeats)).toBe(true);
    runBlock();                                    // i el bloc acaba (cap penjada)
    expect(drain('voice')).toBeGreaterThanOrEqual(1);
  });

  test('veus polirítmiques: mateix epsilon al comptador de veu (if de :365)', () => {
    const { p, runBlock, drain } = mkProcessor();
    p.port.onmessage({
      data: { action: 'setVoices', voices: [{ id: 'v1', numerator: 3, denominator: 2 }] }
    });
    runBlock();
    expect(drain('voice')).toBe(1);   // countdown neix a 0 → primer tret al primer sample

    const veu = p._voiceList[0];      // invariant 2: el hot loop itera _voiceList
    expect(veu).toBeDefined();
    expect(veu.periodBeats).toBeCloseTo(1.5, 12);

    veu.countdownBeats = BLOCK + 2e-9;
    runBlock();
    expect(drain('voice')).toBe(0);   // fora de l'epsilon: no dispara

    veu.countdownBeats = BLOCK + 5e-10;
    const subAbans = veu.subIndex;
    runBlock();
    expect(drain('voice')).toBe(1);   // dins l'epsilon: exactament un
    expect(veu.subIndex).toBe(subAbans + 1);
    expect(veu.countdownBeats).toBeGreaterThan(1.4); // += periodBeats (1.5), mai reinici
  });
});
