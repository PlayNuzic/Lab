/**
 * Ponts entre els events `sharedui:*` del header compartit i el motor
 * d'àudio de l'app (H-23). Dues peces:
 * - createSchedulingBridge: aplica perfils/valors de scheduling al motor,
 *   amb buffering si el motor encara no existeix (init mandrós).
 * - bindSharedSoundEvents: tradueix els canvis de so del header
 *   (sharedui:sound) a crides setBase/setAccent/... del motor.
 */

const MOBILE_UA_PATTERN = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobi/i;

function resolveDetail(eventOrDetail) {
  if (!eventOrDetail) return null;
  if (typeof eventOrDetail === 'object' && 'detail' in eventOrDetail && eventOrDetail.detail != null) {
    return eventOrDetail.detail;
  }
  return eventOrDetail;
}

/**
 * Heurística de dispositiu per triar el preset de scheduling del motor
 * (SCHEDULING_PRESETS a libs/sound/index.js): 'mobile' = lookAhead 0.06s,
 * 'desktop' = 0.02s. Compta com a mòbil el user-agent O una dimensió
 * mínima de viewport <= 600px (tauletes en vertical i iframes estrets del
 * sistema també necessiten el marge gran).
 *
 * @returns {'mobile'|'desktop'}
 */
function detectSchedulingProfile() {
  const ua = (typeof navigator !== 'undefined' && navigator && navigator.userAgent)
    ? navigator.userAgent
    : '';
  const hasWindow = typeof window !== 'undefined' && window != null;
  const width = hasWindow && typeof window.innerWidth === 'number' ? window.innerWidth : Infinity;
  const height = hasWindow && typeof window.innerHeight === 'number' ? window.innerHeight : Infinity;
  const minDimension = Math.min(width, height);
  const isMobile = MOBILE_UA_PATTERN.test(ua) || minDimension <= 600;
  return isMobile ? 'mobile' : 'desktop';
}

/**
 * Pont entre els events `sharedui:scheduling` (menú de rendiment del
 * header) i el motor d'àudio, pensat per a la inicialització MANDROSA del
 * motor: si un event arriba abans que l'app creï el TimelineAudio, el
 * detail es guarda a `pending` i es reprodueix quan l'app crida
 * `applyTo(audio)` dins del seu initAudio.
 *
 * `applyTo` també aplica el perfil per defecte (detectat o injectat) UNA
 * sola vegada (`defaultApplied`): si l'usuari ja ha triat valors via
 * event, el default no els trepitja.
 *
 * @param {Object} [config]
 * @param {Function} [config.getAudio] - Accessor de la instància (pot retornar null)
 * @param {'mobile'|'desktop'|'balanced'} [config.defaultProfile] - Si s'omet, detectSchedulingProfile()
 * @returns {{handleSchedulingEvent: Function, applyTo: Function, getPending: Function}}
 *   handleSchedulingEvent es registra com a listener de 'sharedui:scheduling'.
 */
export function createSchedulingBridge({ getAudio, defaultProfile } = {}) {
  const audioGetter = typeof getAudio === 'function' ? getAudio : () => null;
  const profile = defaultProfile || detectSchedulingProfile();
  let pending = null;
  let defaultApplied = false;

  const hasNumber = (value) => typeof value === 'number' && Number.isFinite(value);

  function applyDetail(audio, detail) {
    if (!audio || !detail) return false;
    const { lookAhead, updateInterval, profile: incomingProfile } = detail;
    const hasScheduling = hasNumber(lookAhead) || hasNumber(updateInterval);
    let applied = false;
    if (hasScheduling && typeof audio.setScheduling === 'function') {
      const payload = {};
      if (hasNumber(lookAhead)) payload.lookAhead = lookAhead;
      if (hasNumber(updateInterval)) payload.updateInterval = updateInterval;
      audio.setScheduling(payload);
      applied = true;
    }
    if (incomingProfile && typeof audio.setSchedulingProfile === 'function') {
      audio.setSchedulingProfile(incomingProfile);
      applied = true;
    }
    if (applied) defaultApplied = true;
    return applied;
  }

  function handleSchedulingEvent(eventOrDetail) {
    const detail = resolveDetail(eventOrDetail);
    if (!detail) return;
    const { lookAhead, updateInterval, profile: incomingProfile } = detail;
    const actionable = hasNumber(lookAhead) || hasNumber(updateInterval) || !!incomingProfile;
    if (!actionable) return;
    const audio = audioGetter();
    if (audio) {
      if (applyDetail(audio, detail)) pending = null;
    } else {
      pending = { lookAhead, updateInterval, profile: incomingProfile };
    }
  }

  function applyTo(audio) {
    if (!audio) return;
    if (pending) {
      const detail = pending;
      pending = null;
      if (applyDetail(audio, detail)) return;
    }
    if (!defaultApplied && profile && typeof audio.setSchedulingProfile === 'function') {
      audio.setSchedulingProfile(profile);
      defaultApplied = true;
    }
  }

  return {
    handleSchedulingEvent,
    applyTo,
    getPending: () => pending
  };
}

/**
 * Tradueix els canvis de so del header (event `sharedui:sound`, amb
 * detail {type, value}) a crides del motor segons el mapa de l'app,
 * p.ex. { baseSound: 'setBase', cycleSound: 'setCycle' }. Si el motor
 * encara no existeix (init mandrós) el canvi es descarta sense error —
 * els dropdowns guarden el valor a dataset i initAudio els aplica.
 *
 * @param {Object} options
 * @param {Function} options.getAudio - Accessor de la instància (pot retornar null)
 * @param {Object} options.mapping - { tipusDeDetail: nomDeMètodeDelMotor }
 * @param {EventTarget} [options.target=window] - On escoltar l'event
 * @returns {Function} Desregistra el listener
 */
export function bindSharedSoundEvents(options = {}) {
  const { getAudio, mapping } = options;
  const defaultTarget = typeof window !== 'undefined' ? window : null;
  const eventTarget = options.target && typeof options.target.addEventListener === 'function'
    ? options.target
    : defaultTarget;
  const audioGetter = typeof getAudio === 'function' ? getAudio : () => null;
  if (!eventTarget || !mapping || typeof mapping !== 'object') {
    return () => {};
  }

  const handler = async (event) => {
    const detail = resolveDetail(event) || {};
    const { type, value } = detail;
    if (!type || !(type in mapping)) return;
    const methodName = mapping[type];
    const audio = audioGetter();
    if (!audio || typeof audio[methodName] !== 'function') return;
    if (value == null) return;
    try {
      await audio[methodName](value);
    } catch {}
  };

  eventTarget.addEventListener('sharedui:sound', handler);
  return () => eventTarget.removeEventListener('sharedui:sound', handler);
}
