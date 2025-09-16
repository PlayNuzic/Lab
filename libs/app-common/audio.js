const MOBILE_UA_PATTERN = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobi/i;

function resolveDetail(eventOrDetail) {
  if (!eventOrDetail) return null;
  if (typeof eventOrDetail === 'object' && 'detail' in eventOrDetail && eventOrDetail.detail != null) {
    return eventOrDetail.detail;
  }
  return eventOrDetail;
}

export function detectSchedulingProfile() {
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
