/**
 * @fileoverview AudioMixer — magatzem d'estat de mescla compartit per totes
 * les apps (singleton a libs/sound/index.js).
 *
 * NOMÉS estat: cap node d'àudio viu aquí. El so s'aplica quan TimelineAudio
 * consumeix l'estat via subscribe() i escriu els seus GainNode natius
 * (_applyMixerState a libs/sound/index.js). Fins al 2026-06 la classe
 * mantenia en paral·lel un graf de Tone.Volume (master + un per canal,
 * connectats a Tone.Destination) pel qual MAI passava àudio (A-17): un
 * lector podia creure raonablement que channel.node mutejava de debò.
 *
 * Contracte (LH-13):
 * - Volums sempre clampats a [0, 1]; master per defecte 0.75.
 * - Solo: si CAP canal té solo, tots els no-solo queden effectiveMuted.
 *   En treure el solo es restaura el mute previ de cada canal
 *   (_soloOverride recorda l'estat d'abans de la imposició).
 * - effectiveMuted = master.muted || channel.muted || (haySolo && !channel.solo).
 * - LA-07: els setters NO creen canals. registerChannel és l'únic camí de
 *   creació; un id desconegut (typo, o localStorage ranci rehidratat per
 *   createMixerPersistence) s'ignora en lloc de ressuscitar un canal
 *   fantasma que mixer-menu pintaria com un fader real.
 * - Tot és lineal 0-1; la conversió a dB (20·log10) és cosa del consumidor.
 */

const DEFAULT_MASTER_LABEL = 'Master';

function clampVolume(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(1, num));
}

export class AudioMixer {
  constructor({ masterLabel = DEFAULT_MASTER_LABEL } = {}) {
    this.master = {
      id: 'master',
      label: masterLabel,
      volume: 0.75,
      muted: false,
      allowSolo: false
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

  // El solo imposa mute als altres canals sense perdre el seu estat manual:
  // _soloOverride guarda el muted previ i el restaura quan el solo marxa.
  _applySoloOverride(channel, type) {
    if (!channel) return false;

    const currentType = channel._soloOverride?.type || null;
    let changed = false;

    if (!type) {
      if (currentType) {
        const previous = channel._soloOverride?.prevMuted;
        channel._soloOverride = null;
        if (previous !== undefined && channel.muted !== previous) {
          channel.muted = previous;
          changed = true;
        }
      }
      return changed;
    }

    if (currentType && currentType !== type) {
      const previous = channel._soloOverride?.prevMuted;
      channel._soloOverride = null;
      if (previous !== undefined && channel.muted !== previous) {
        channel.muted = previous;
        changed = true;
      }
    }

    const forcedMute = type === 'mute';
    if (!channel._soloOverride) {
      channel._soloOverride = { type, prevMuted: channel.muted };
    } else {
      if (channel.muted !== forcedMute) {
        channel._soloOverride.prevMuted = channel.muted;
      }
      channel._soloOverride.type = type;
    }

    if (channel.muted !== forcedMute) {
      channel.muted = forcedMute;
      changed = true;
    }

    return changed;
  }

  /** Recalcula effectiveMuted de tots els canals; retorna si res ha canviat. */
  _refreshMutes() {
    const hasSolo = this._hasSolo();
    let changed = false;
    for (const channel of this.channels.values()) {
      if (hasSolo) {
        const overrideType = channel.solo ? 'unmute' : 'mute';
        if (this._applySoloOverride(channel, overrideType)) {
          changed = true;
        }
      } else if (this._applySoloOverride(channel, null)) {
        changed = true;
      }

      const effective = !!(this.master.muted || channel.muted || (hasSolo && !channel.solo));
      if (channel.effectiveMuted !== effective) {
        channel.effectiveMuted = effective;
        changed = true;
      }
    }
    return changed;
  }

  _emit() {
    const snapshot = this.getState();
    this._listeners.forEach(listener => {
      try { listener(snapshot); } catch {}
    });
  }

  /** Subscriu un listener: rep l'estat immediatament i a cada canvi. Retorna l'unsubscribe. */
  subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    this._listeners.add(listener);
    try { listener(this.getState()); } catch {}
    return () => this._listeners.delete(listener);
  }

  /**
   * Únic camí de creació de canals (LA-07). Idempotent: si el canal ja
   * existeix, només aplica les opcions passades (label/volume/muted/solo).
   */
  registerChannel(id, options = {}) {
    if (!id) return null;
    let channel = this.channels.get(id);
    let changed = false;
    if (!channel) {
      channel = {
        id,
        label: options.label || id,
        volume: clampVolume(options.volume ?? 0.75),
        muted: !!options.muted,
        solo: !!options.solo,
        allowSolo: options.allowSolo !== false,
        effectiveMuted: false
      };
      channel._soloOverride = null;
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
          changed = true;
        }
      }
      if (typeof options.muted === 'boolean' && options.muted !== channel.muted) {
        channel.muted = options.muted;
        changed = true;
      }
      if (typeof options.solo === 'boolean' && options.solo !== channel.solo) {
        channel.solo = options.solo;
        changed = true;
      }
    }

    if (this._refreshMutes()) {
      changed = true;
    }
    if (changed) this._emit();
    return channel;
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

  /** Volum [0,1] d'un canal REGISTRAT; ids desconeguts s'ignoren (LA-07). */
  setChannelVolume(id, value) {
    const channel = this.channels.get(id);
    if (!channel) return;
    const vol = clampVolume(value);
    if (vol === channel.volume) return;
    channel.volume = vol;
    this._emit();
  }

  /** Mute manual d'un canal REGISTRAT; ids desconeguts s'ignoren (LA-07). */
  setChannelMute(id, value) {
    const channel = this.channels.get(id);
    if (!channel) return;
    const muted = !!value;
    if (muted === channel.muted) return;
    channel.muted = muted;
    this._refreshMutes();
    this._emit();
  }

  toggleChannelMute(id) {
    const channel = this.channels.get(id);
    if (!channel) return;
    this.setChannelMute(id, !channel.muted);
  }

  /** Solo exclusiu: activar-lo en un canal el treu de qualsevol altre. */
  setChannelSolo(id, value) {
    const channel = this.channels.get(id);
    if (!channel || channel.allowSolo === false) return;
    const solo = !!value;
    if (solo === channel.solo) return;
    let changed = false;
    if (solo) {
      for (const other of this.channels.values()) {
        if (other === channel) continue;
        if (other.solo) {
          other.solo = false;
          changed = true;
        }
      }
    }
    if (solo !== channel.solo) {
      channel.solo = solo;
      changed = true;
    }
    if (!changed) {
      if (this._refreshMutes()) {
        this._emit();
      }
      return;
    }
    this._refreshMutes();
    this._emit();
  }

  toggleChannelSolo(id) {
    const channel = this.channels.get(id);
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

  /** Snapshot serialitzable (master + canals en ordre de registre). */
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
