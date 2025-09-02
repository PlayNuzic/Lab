
const SAMPLE_BASE_URL = new URL('./samples/', import.meta.url);
const SOUND_URLS = {
  click1: new URL('click1.wav', SAMPLE_BASE_URL).href,
  click2: new URL('click2.wav', SAMPLE_BASE_URL).href,
  click3: new URL('click3.wav', SAMPLE_BASE_URL).href
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

  schedule(pulses, interval, selectedSet, loop = false, cb) {
    Tone.Transport.cancel();
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
    Tone.Transport.start();
  }

  stop() {
    Tone.Transport.stop();
    Tone.Transport.cancel();
  }

  async preview(key) {
    await Tone.start();
    new Tone.Sampler({ urls: { C3: SOUND_URLS[key] }, onload: s => s.triggerAttackRelease('C3') }).toDestination();
  }
}
