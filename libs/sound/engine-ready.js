// libs/sound/engine-ready.js
// LA-08: senyal motor→instruments. piano.js/flute.js esperaven el bus
// melòdic amb un poll de 10×100ms sobre window.NuzicAudioEngine (fins a 1s
// de latència oculta, i el timeout queia en silenci a toDestination). Ara
// el motor senyala el bus quan el crea i els instruments esperen la
// promesa; el timeout de guarda fa el fallback un camí explícit i rar.
//
// A-08 (auditoria 2026-07-06): el senyal és RE-ARMABLE. Abans era una
// promesa d'un sol ús: després d'un rebuild del graf (context 'closed' pel
// SO → teardown → context nou), whenMelodicChannelReady seguia retornant el
// bus VELL del context mort i piano/flute re-disparaven "context has been
// closed". Ara cada signalMelodicChannelReady actualitza el canal vigent i
// les esperes posteriors reben SEMPRE l'últim. Limitació coneguda: els
// instruments ja carregats (loadPromise memoitzat) queden lligats al
// context mort fins a recarregar la pàgina; els que es carreguin després
// del rebuild reben el bus nou.

let latestChannel; // undefined = el motor encara no ha senyalat mai
let resolveReady;
const firstReadyPromise = new Promise((resolve) => { resolveReady = resolve; });

export function signalMelodicChannelReady(channel) {
  latestChannel = channel || null;
  resolveReady(latestChannel); // desbloqueja els que ja esperaven (1a vegada)
}

/**
 * Resol amb el GainNode del bus melòdic VIGENT (l'últim senyalat), o amb
 * null si el motor no l'ha senyalat dins del timeout (p. ex. pàgines sense
 * TimelineAudio).
 */
export function whenMelodicChannelReady(timeoutMs = 1500) {
  // Ja senyalat almenys un cop: retorna el canal vigent (post-rebuild
  // inclòs), no el que va resoldre la promesa original.
  if (latestChannel !== undefined) return Promise.resolve(latestChannel);
  if (!timeoutMs || !Number.isFinite(timeoutMs)) return firstReadyPromise;
  return Promise.race([
    firstReadyPromise,
    new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs))
  ]);
}
