const DEFAULT_MASTER_LABEL = 'Master';

function clampVolume(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(1, num));
}

function toDecibels(value) {
  const v = clampVolume(value);
  if (v <= 0) return -Infinity;
  return 20 * Math.log10(v);
}

function hasTone() {
  return typeof Tone !== 'undefined' && Tone != null;
}

function hasToneVolume() {
  return hasTone() && typeof Tone.Volume === 'function';
}

function ensureConnect(node, destination) {
  if (!node) return;
  if (typeof node.connect === 'function' && destination) {
    try { node.connect(destination); return; } catch {}
  }
  if (typeof node.toDestination === 'function') {
    try { node.toDestination(); } catch {}
  }
}

export class AudioMixer {
  constructor({ masterLabel = DEFAULT_MASTER_LABEL } = {}) {
    this.master = {
      id: 'master',
      label: masterLabel,
      volume: 1,
      muted: false,
      allowSolo: false,
      node: null
    };
    this.channels = new Map();
    this._channelOrder = [];
    this._listeners = new Set();
  }

  _hasSolo() {
    for (const channel of this.channels.values()) {
      if (channel.solo) return true;
    }
    return false;
  }

  _ensureMasterNode() {
    if (this.master.node && !this.master.node.disposed) {
      return this.master.node;
    }

    if (!hasTone()) return null;

    if (hasToneVolume()) {
      try {
        const node = new Tone.Volume(toDecibels(this.master.volume));
        node.mute = this.master.muted;
        ensureConnect(node, Tone.Destination);
        this.master.node = node;
        return node;
      } catch {}
    }

    if (Tone?.Destination?.volume) {
      try { Tone.Destination.volume.value = toDecibels(this.master.volume); } catch {}
    }

    return null;
  }

  _ensureChannelNode(channel) {
    if (!channel) return null;
    if (channel.node && !channel.node.disposed) {
      return channel.node;
    }

    if (!hasTone()) return null;

    const masterNode = this._ensureMasterNode();

    if (hasToneVolume()) {
      try {
        const node = new Tone.Volume(toDecibels(channel.volume));
        node.mute = this._computeEffectiveMute(channel);
        ensureConnect(node, masterNode || Tone.Destination);
        channel.node = node;
        return node;
      } catch {}
    }

    return null;
  }

  _computeEffectiveMute(channel) {
    if (!channel) return !!this.master.muted;
    return !!(this.master.muted || channel.muted || (this._hasSolo() && !channel.solo));
  }

  _applyMasterVolume() {
    const node = this._ensureMasterNode();
    if (node?.volume) {
      try { node.volume.value = toDecibels(this.master.volume); } catch {}
    } else if (Tone?.Destination?.volume) {
      try { Tone.Destination.volume.value = toDecibels(this.master.volume); } catch {}
    }
  }

  _applyChannelVolume(channel) {
    const node = this._ensureChannelNode(channel);
    if (node?.volume) {
      try { node.volume.value = toDecibels(channel.volume); } catch {}
    }
  }

  _refreshMutes() {
    const hasSolo = this._hasSolo();
    if (this.master.node) {
      try { this.master.node.mute = !!this.master.muted; } catch {}
    }
    if (!this.master.node && Tone?.Destination) {
      try { Tone.Destination.mute = !!this.master.muted; } catch {}
    }
    for (const channel of this.channels.values()) {
      const effective = !!(this.master.muted || channel.muted || (hasSolo && !channel.solo));
      channel.effectiveMuted = effective;
      if (channel.node) {
        try { channel.node.mute = effective; } catch {}
      }
    }
  }

  _emit() {
    const snapshot = this.getState();
    this._listeners.forEach(listener => {
      try { listener(snapshot); } catch {}
    });
  }

  subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    this._listeners.add(listener);
    try { listener(this.getState()); } catch {}
    return () => this._listeners.delete(listener);
  }

  registerChannel(id, options = {}) {
    if (!id) return null;
    let channel = this.channels.get(id);
    let changed = false;
    if (!channel) {
      channel = {
        id,
        label: options.label || id,
        volume: clampVolume(options.volume ?? 1),
        muted: !!options.muted,
        solo: !!options.solo,
        allowSolo: options.allowSolo !== false,
        node: null,
        effectiveMuted: false
      };
      this.channels.set(id, channel);
      this._channelOrder.push(id);
      changed = true;
    } else {
      if (options.label && options.label !== channel.label) {
        channel.label = options.label;
        changed = true;
      }
      if (typeof options.allowSolo === 'boolean' && options.allowSolo !== channel.allowSolo) {
        channel.allowSolo = options.allowSolo;
        changed = true;
      }
      if (typeof options.volume === 'number') {
        const vol = clampVolume(options.volume);
        if (vol !== channel.volume) {
          channel.volume = vol;
          this._applyChannelVolume(channel);
          changed = true;
        }
      }
      if (typeof options.muted === 'boolean' && options.muted !== channel.muted) {
        channel.muted = options.muted;
        this._refreshMutes();
        changed = true;
      }
      if (typeof options.solo === 'boolean' && options.solo !== channel.solo) {
        channel.solo = options.solo;
        this._refreshMutes();
        changed = true;
      }
    }

    this._ensureChannelNode(channel);
    if (changed) this._emit();
    return channel;
  }

  getChannelNode(id, options = {}) {
    const channel = this.registerChannel(id, options);
    if (!channel) return this._ensureMasterNode();
    return this._ensureChannelNode(channel) || this._ensureMasterNode();
  }

  getChannelState(id) {
    const channel = this.channels.get(id);
    if (!channel) return null;
    const hasSolo = this._hasSolo();
    return {
      id: channel.id,
      label: channel.label,
      volume: channel.volume,
      muted: channel.muted,
      solo: channel.solo,
      allowSolo: channel.allowSolo !== false,
      effectiveMuted: !!(this.master.muted || channel.muted || (hasSolo && !channel.solo))
    };
  }

  setChannelVolume(id, value) {
    const channel = this.registerChannel(id);
    if (!channel) return;
    const vol = clampVolume(value);
    if (vol === channel.volume) return;
    channel.volume = vol;
    this._applyChannelVolume(channel);
    this._emit();
  }

  setChannelMute(id, value) {
    const channel = this.registerChannel(id);
    if (!channel) return;
    const muted = !!value;
    if (muted === channel.muted) return;
    channel.muted = muted;
    this._refreshMutes();
    this._emit();
  }

  toggleChannelMute(id) {
    const channel = this.registerChannel(id);
    if (!channel) return;
    this.setChannelMute(id, !channel.muted);
  }

  setChannelSolo(id, value) {
    const channel = this.registerChannel(id);
    if (!channel || channel.allowSolo === false) return;
    const solo = !!value;
    if (solo === channel.solo) return;
    channel.solo = solo;
    this._refreshMutes();
    this._emit();
  }

  toggleChannelSolo(id) {
    const channel = this.registerChannel(id);
    if (!channel || channel.allowSolo === false) return;
    this.setChannelSolo(id, !channel.solo);
  }

  setMasterLabel(label) {
    if (typeof label !== 'string') return;
    const trimmed = label.trim();
    if (!trimmed || trimmed === this.master.label) return;
    this.master.label = trimmed;
    this._emit();
  }

  setMasterVolume(value) {
    const vol = clampVolume(value);
    if (vol === this.master.volume) return;
    this.master.volume = vol;
    this._applyMasterVolume();
    this._emit();
  }

  getMasterVolume() {
    return this.master.volume;
  }

  setMasterMute(value) {
    const muted = !!value;
    if (muted === this.master.muted) return;
    this.master.muted = muted;
    this._refreshMutes();
    this._emit();
  }

  toggleMasterMute() {
    this.setMasterMute(!this.master.muted);
    return this.master.muted;
  }

  isMasterMuted() {
    return !!this.master.muted;
  }

  getDestination() {
    return this._ensureMasterNode() || Tone?.Destination || null;
  }

  getState() {
    const hasSolo = this._hasSolo();
    const channels = this._channelOrder
      .map(id => this.channels.get(id))
      .filter(Boolean)
      .map(channel => ({
        id: channel.id,
        label: channel.label,
        volume: channel.volume,
        muted: channel.muted,
        solo: channel.solo,
        allowSolo: channel.allowSolo !== false,
        effectiveMuted: !!(this.master.muted || channel.muted || (hasSolo && !channel.solo))
      }));
    return {
      master: {
        id: this.master.id,
        label: this.master.label,
        volume: this.master.volume,
        muted: this.master.muted,
        allowSolo: false,
        effectiveMuted: !!this.master.muted
      },
      channels
    };
  }
}

export function createMixer(options) {
  return new AudioMixer(options);
}

