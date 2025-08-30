import * as Tone from '../../node_modules/tone/build/Tone.js';

const SOUND_URLS = {
  click1: 'data:audio/wav;base64,UklGRgQCAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YeABAAAAAFsrllErbrp9a34pcKVUHi8FBHPYjbHukxeDBIH1jWKoK83397UjO0vcafl7bX/Qc4FafzYLDCzgD7hzmBeFQoCIirKi5cX27+sblUQjZbt57n8BdwJgqT0FFAXo2b5hnZOHAYCTh2Gd2b4F6AUUqT0CYAF37n+7eSNllUTrG/bv5cWyooiKQoAXhXOYD7gs4AsMfzaBWtBzbX/5e9xpO0u1I/f3K81iqPWNBIEXg+6TjbFz2AUEHi+lVClwa366fStullFbKwAApdRqrtWRRoKVgdePW6vi0Pv7jSdzThJs6Xz8fgtynlfVMgkIS9zFtCSWB4STgDCMf6WByfXz1B/xR41n6Xq+f3h1Tl0bOgoQFeRru92aRYYSgP+I/p9Xwvvr+xcnQZ9ibXj/f214n2InQfsX++tXwv6f/4gSgEWG3ZpruxXkChAbOk5deHW+f+l6jWfxR9Qf9fOByX+lMIyTgAeEJJbFtEvcCQjVMp5XC3L8ful8EmxzTo0n+/vi0Fur14+VgUaC1ZFqrqXUAABbK5ZRK266fWt+KXClVB4vBQRz2I2x7pMXgwSB9Y1iqCvN9/e1IztL3Gn5e21/0HOBWn82Cwws4A+4c5gXhUKAiIqyouXF9u/rG5VEI2U=',
  click2: 'data:audio/wav;base64,UklGRgQCAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YeABAAAAAGo/K276fylw4EIFBBzE7pMmgPWNu7n390843GmZf9BzmUkLDFTLc5jHgIiKJ7P27/swI2W4fgF3B1AFFMLSYZ3pgZOH4KwF6HUpAmBWfbt5JFbrG17asqKLgxeF7qYs4MYhgVp1e/l76lu1Ix/iYqiqhReDVaFz2PQZpVQYebp9VGFbK//paq5FiJWBHJzi0AgSc05Advx+W2bVMvXxxbRZi5OASJeByQoK8Ufxcr5/+mobOvn5a7vijhKA3pJXwgICJ0Eub/9/Lm8nQQICV8LekhKA4o5ru/n5Gzr6ar5/8XLxRwoKgclIl5OAWYvFtPXx1TJbZvx+QHZzTggS4tAcnJWBRYhqrv/pWytUYbp9GHmlVPQZc9hVoReDqoViqB/itSPqW/l7dXuBWsYhLODupheFi4Oyol7a6xskVrt5Vn0CYHUpBejgrJOH6YFhncLSBRQHUAF3uH4jZfsw9u8ns4iKx4BzmFTLCwyZSdBzmX/caU849/e7ufWNJoDukxzEBQTgQilw+n8rbmo/AACWwNWRBoDXjyC9+/vkOxJs2n8LckVGCQixxySWZ4AwjGe29fOsNI1nOX94ddlMChAFz92aSIH/iPmv++s+LZ9iF35teCBT+xeL1v6fqoI=',
  click3: 'data:audio/wav;base64,UklGRgQCAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YeABAAAAAJZRun0pcB4vc9jukwSBYqj39ztL+XvQc382LOBzmEKAsqL275VEu3kBd6k9BehhnQGAYZ0F6Kk9AXe7eZVE9u+yokKAc5gs4H820HP5eztL9/diqASB7pNz2B4vKXC6fZZRAABqrkaC14/i0I0nEmz8fp5XCQjFtAeEMIyBydQfjWe+f05dChBru0WG/4hXwvsXn2L/f59i+xdXwv+IRYZruwoQTl2+f41n1B+ByTCMB4TFtAkInlf8fhJsjSfi0NePRoJqrgAAllG6fSlwHi9z2O6TBIFiqPf3O0v5e9BzfzYs4HOYQoCyovbvlUS7eQF3qT0F6GGdAYBhnQXoqT0Bd7t5lUT277KiQoBzmCzgfzbQc/l7O0v392KoBIHuk3PYHi8pcLp9llEAAGquRoLXj+LQjScSbPx+nlcJCMW0B4QwjIHJ1B+NZ75/Tl0KEGu7RYb/iFfC+xefYv9/n2L7F1fC/4hFhmu7ChBOXb5/jWfUH4HJMIwHhMW0CQieV/x+EmyNJ+LQ149GgmquAACWUbp9KXAeL3PY7pMEgWKo9/c7S/l70HN/Nizgc5hCgLKi9u+VRLt5AXepPQXoYZ0BgGGdBeipPQF3u3mVRPbvsqJCgHOYLOB/NtBz+Xs='
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

  trigger(type) {
    const sampler = type === 'accent' ? this.accent : type === 'selected' ? this.selected : this.base;
    sampler.triggerAttackRelease('C3');
  }

  schedule(pulses, interval, selectedSet, loop = false, cb) {
    Tone.Transport.cancel();
    for (let i = 0; i < pulses; i++) {
      const time = i * interval;
      const type = i === 0 ? 'accent' : selectedSet.has(i) ? 'selected' : 'base';
      Tone.Transport.schedule(t => {
        this.trigger(type);
        if (cb) cb(i);
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

  preview(key) {
    new Tone.Sampler({ urls: { C3: SOUND_URLS[key] }, onload: s => s.triggerAttackRelease('C3') }).toDestination();
  }
}
