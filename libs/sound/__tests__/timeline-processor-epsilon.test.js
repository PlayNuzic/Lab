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
  // Com drain, però retorna els missatges sencers (per filtrar per id).
  const grab = (type) => {
    const arr = msgs.filter(m => m && m.type === type);
    msgs.length = 0;
    return arr;
  };
  return { p, runBlock, drain, grab };
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

  test('setVoices en viu: la veu que sobreviu conserva la fase exacta (A-11 merge)', () => {
    const { p, runBlock, drain } = mkProcessor();
    p.port.onmessage({ data: { action: 'setVoices', voices: [{ id: 'v1', numerator: 3, denominator: 2 }] } });
    for (let i = 0; i < 3; i++) runBlock();
    drain('voice');
    const abans = p.voices.get('v1');
    const cd = abans.countdownBeats;
    const sub = abans.subIndex;

    // Edició en viu: v1 es manté (mateixa raó), s'hi afegeix v2.
    p.port.onmessage({ data: { action: 'setVoices', voices: [
      { id: 'v1', numerator: 3, denominator: 2 },
      { id: 'v2', numerator: 3, denominator: 4 }
    ] } });
    const despres = p.voices.get('v1');
    expect(despres.countdownBeats).toBe(cd);   // fase intacta, cap salt
    expect(despres.subIndex).toBe(sub);
  });

  test('setVoices en viu: la veu NOVA s\'ancora a la graella del compàs (A-11)', () => {
    const { p, runBlock, drain, grab } = mkProcessor();
    p.port.onmessage({ data: { action: 'setVoices', voices: [{ id: 'v1', numerator: 3, denominator: 2 }] } });
    for (let i = 0; i < 3; i++) runBlock();
    drain('voice');

    const fase = p.measurePhaseBeats;          // ≈ 3·BLOCK ≈ 0.016 beats
    p.port.onmessage({ data: { action: 'setVoices', voices: [
      { id: 'v1', numerator: 3, denominator: 2 },
      { id: 'v2', numerator: 3, denominator: 4 }  // període 0.75
    ] } });
    const v2 = p.voices.get('v2');
    const periode = 0.75;
    // El primer tic de v2 cau al proper múltiple de 0.75 des de l'inici de
    // mesura (no a l'instant d'arribada del missatge, com feia abans).
    expect(v2.countdownBeats).toBeCloseTo(periode - (fase % periode), 9);
    expect(v2.subIndex).toBe(Math.floor(fase / periode));

    // I efectivament NO dispara al bloc següent (countdown ≈ 0.734 >> BLOCK);
    // amb el codi antic (countdown 0) hauria disparat al primer sample.
    runBlock();
    const deV2 = grab('voice').filter(m => m.id === 'v2');
    expect(deV2.length).toBe(0);
  });

  test('setVoices en repòs: cap ancoratge (start reseteja els comptadors) (A-11)', () => {
    const { p } = mkProcessor();
    p.port.onmessage({ data: { action: 'stop' } });
    p.port.onmessage({ data: { action: 'setVoices', voices: [{ id: 'v1', numerator: 3, denominator: 2 }] } });
    expect(p.voices.get('v1').countdownBeats).toBe(0); // valor d'_addVoice, intacte
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
