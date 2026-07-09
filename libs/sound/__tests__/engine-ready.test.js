/**
 * A-08 (auditoria 2026-07-06): el senyal motor→instruments és re-armable.
 * Abans era una promesa d'un sol ús: després d'un rebuild del graf pel
 * context 'closed', whenMelodicChannelReady retornava el bus VELL del
 * context mort. Ara sempre retorna el canal VIGENT (l'últim senyalat).
 *
 * L'ordre dels tests és significatiu (estat de mòdul compartit dins del
 * fitxer): el cas "mai senyalat → timeout null" va PRIMER.
 */

import { signalMelodicChannelReady, whenMelodicChannelReady } from '../engine-ready.js';

describe('engine-ready — senyal re-armable (A-08)', () => {
  test('mai senyalat: el timeout resol amb null (fallback explícit)', async () => {
    await expect(whenMelodicChannelReady(20)).resolves.toBeNull();
  });

  test('primer senyal: desbloqueja els que ja esperaven', async () => {
    const busA = { nom: 'busA' };
    // Timeout curt: el timer del race no es cancel·la mai (tret del codi
    // real, on és inofensiu) i amb 1500ms jest es queixaria de handle obert.
    const espera = whenMelodicChannelReady(50); // pendent abans del senyal
    signalMelodicChannelReady(busA);
    await expect(espera).resolves.toBe(busA);
  });

  test('re-senyal després d\'un rebuild: les esperes noves reben el bus NOU, no el vell', async () => {
    const busB = { nom: 'busB (post-rebuild)' };
    signalMelodicChannelReady(busB);
    await expect(whenMelodicChannelReady(1500)).resolves.toBe(busB);
    // I sense timeout també (camí timeoutMs=0/Infinity):
    await expect(whenMelodicChannelReady(0)).resolves.toBe(busB);
  });
});
