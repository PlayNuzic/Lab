# libs/sound

Motor d'àudio basat en Tone.js per a reproducció de ritmes.

## Fitxers

| Fitxer | Descripció |
|--------|------------|
| `index.js` | Classe `TimelineAudio` - motor principal |
| `mixer.js` | `AudioMixer` - control de canals |
| `sample-map.js` | Gestió de samples |
| `user-interaction.js` | Detecció d'interacció usuari |
| `tone-loader.js` | Carga lazy de Tone.js |

## Ús

```javascript
import TimelineAudio from '../../libs/sound/index.js';

const audio = new TimelineAudio();
await audio.ready();

// Reproduir
audio.play(totalPulses, intervalSec, selectedPulses, loop, onPulse, onComplete);

// Control
audio.stop();
audio.setTempo(bpm);
audio.setLoop(enabled);
audio.tapTempo(Date.now());
```

## Mixer

```javascript
import { getMixer } from '../../libs/sound/index.js';

const mixer = getMixer();
mixer.setChannelVolume('pulse', 0.8);
mixer.setChannelMute('accent', true);
```

## Canals disponibles
- `pulse` - Pulsos base
- `accent` - Accents
- `subdivision` - Subdivisions
