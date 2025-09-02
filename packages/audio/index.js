// TimelineAudio.js - Sistema d'àudio professional per metrònom
const SAMPLE_BASE_URL = new URL('./samples/', import.meta.url);
const SOUND_URLS = {
  click1: new URL('click1.wav', SAMPLE_BASE_URL).href,
  click2: new URL('click2.wav', SAMPLE_BASE_URL).href,
  click3: new URL('click3.wav', SAMPLE_BASE_URL).href,
  click4: new URL('click4.wav', SAMPLE_BASE_URL).href,
  click5: new URL('click5.wav', SAMPLE_BASE_URL).href,
  click6: new URL('click6.wav', SAMPLE_BASE_URL).href,
};

export const soundNames = Object.keys(SOUND_URLS);

export class TimelineAudio {
  constructor() {
    this.baseKey = 'click1';
    this.accentKey = 'click2';
    this.selectKey = 'click3';
    this.base = null;
    this.accent = null;
    this.selected = null;
    this.loadSamplers();
  }

  async loadSampler(key) {
    return new Promise(resolve => {
      const sampler = new Tone.Sampler({
        urls: { C3: SOUND_URLS[key] },
        onload: () => resolve(sampler)
      }).toDestination();
    });
  }

  async loadSamplers() {
    this.base = await this.loadSampler(this.baseKey);
    this.accent = await this.loadSampler(this.accentKey);
    this.selected = await this.loadSampler(this.selectKey);
  }

  async setBase(key) {
    this.baseKey = key;
    this.base = await this.loadSampler(key);
  }

  async setAccent(key) {
    this.accentKey = key;
    this.accent = await this.loadSampler(key);
  }

  setMute(mute) {
    Tone.Destination.mute = mute;
  }

  trigger(type, time) {
    const sampler = type === 'accent' ? this.accent : type === 'selected' ? this.selected : this.base;
    sampler.triggerAttackRelease('C3', '8n', time);
  }

  schedule(pulses, interval, selectedSet, loop = false, cb, onComplete) {
    // Ensure a clean transport state before (re)scheduling
    try { Tone.Transport.stop(); } catch {}
    try { Tone.Transport.cancel(); } catch {}
    // Schedule events from timeline origin
    for (let i = 0; i < pulses; i++) {
      const time = i * interval;
      const type = i === 0 ? 'accent' : selectedSet.has(i) ? 'selected' : 'base';
      Tone.Transport.schedule(t => {
        this.trigger(type, t);
        if (cb) Tone.Draw.schedule(() => cb(i), t);
      }, time);
    }
    Tone.Transport.loop = loop;
    Tone.Transport.loopEnd = pulses * interval;
    const end = pulses * interval;
    // Notify UI precisely at the end when not looping
    if (!loop && typeof onComplete === 'function') {
      Tone.Transport.scheduleOnce(t => {
        try { Tone.Draw.schedule(() => onComplete(), t); } catch {}
      }, end);
    }
    // Start from offset 0 so the next runs always play, even after a non-loop finish
    Tone.Transport.start(undefined, 0);
    // If not looping, stop transport right after the last event to avoid drifting position
    if (!loop) {
      Tone.Transport.scheduleOnce(() => {
        try { Tone.Transport.stop(); } catch {}
        try { Tone.Transport.cancel(); } catch {}
      }, end + 0.001);
    }
  }

  stop() {
    Tone.Transport.stop();
    Tone.Transport.cancel();
  }

  async preview(key) {
    await Tone.start();
    let sampler;
    sampler = new Tone.Sampler({
      urls: { C3: SOUND_URLS[key] },
      onload: () => {
        try { sampler.triggerAttackRelease('C3', '8n'); } catch {}
        // dispose after short delay to free resources
        setTimeout(() => { try { sampler.dispose(); } catch {} }, 1000);
      }
    }).toDestination();
  }
}
