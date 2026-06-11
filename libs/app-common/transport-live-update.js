/**
 * @fileoverview A-13: push d'edicions en viu al transport amb les
 * transitòries de tecleig col·lapsades.
 *
 * handleInput dispara per CADA tecla: escrivint '16', totalPulses=1
 * arribava al worklet abans que el 16 (salt de posició pel wrap, o 'done'
 * prematur en no-loop), i escrivint '240' el tempo passava per bpm=2 i
 * bpm=24 — i un cop el worklet agafa bpm=2, la correcció s'espera al
 * SEGÜENT pols (fins a 30s d'aparent congelació). El camp d'entrada NO es
 * clampa mai (regla del repo: tecleig lliure); només es retarda el push.
 *
 * `schedule()` és un debounce trailing: l'última tecla guanya i `apply`
 * llegeix l'estat FRESC en executar-se. `isLive` es re-comprova al
 * dispar perquè un stop durant la finestra no empenyi a un motor parat.
 */

/**
 * @param {Object} options
 * @param {Function} options.apply - Fa el push real (llegeix inputs/estat al moment d'executar-se)
 * @param {Function} [options.isLive] - Ha de seguir aplicant-se? (típicament () => isPlaying)
 * @param {number} [options.delayMs=250] - Finestra de col·lapse de transitòries
 * @returns {{ schedule: Function, cancel: Function, flush: Function }}
 */
export function createLiveTransportPush({ apply, isLive = () => true, delayMs = 250 }) {
  let timer = null;

  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (isLive()) apply();
    }, delayMs);
  }

  function cancel() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  /** Aplica ARA el push pendent (si n'hi ha i isLive ho permet). */
  function flush() {
    if (!timer) return;
    cancel();
    if (isLive()) apply();
  }

  return { schedule, cancel, flush };
}
