// libs/sound/engine-ready.js
// LA-08: senyal motor→instruments. piano.js/flute.js esperaven el bus
// melòdic amb un poll de 10×100ms sobre window.NuzicAudioEngine (fins a 1s
// de latència oculta, i el timeout queia en silenci a toDestination). Ara
// el motor senyala el bus quan el crea i els instruments esperen la
// promesa; el timeout de guarda fa el fallback un camí explícit i rar.

let resolveReady;
const readyPromise = new Promise((resolve) => { resolveReady = resolve; });

export function signalMelodicChannelReady(channel) {
  resolveReady(channel || null);
}

/**
 * Resol amb el GainNode del bus melòdic, o amb null si el motor no l'ha
 * senyalat dins del timeout (p. ex. pàgines sense TimelineAudio).
 */
export function whenMelodicChannelReady(timeoutMs = 1500) {
  if (!timeoutMs || !Number.isFinite(timeoutMs)) return readyPromise;
  return Promise.race([
    readyPromise,
    new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs))
  ]);
}
