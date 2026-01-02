/**
 * @jest-environment jsdom
 */
// libs/soundlines/__tests__/playback-utils.test.js
// Tests per a les utilitats de playback de soundlines

import { jest } from '@jest/globals';
import {
  sleep,
  setPlayIcon,
  createPlayButtonHTML,
  createPlaybackController,
  createEEDisplayHTML,
  updateEEDisplay
} from '../playback-utils.js';

describe('sleep', () => {
  test('retorna una Promise', () => {
    const result = sleep(10);
    expect(result).toBeInstanceOf(Promise);
  });

  test('es resol després del temps especificat', async () => {
    jest.useFakeTimers();

    let resolved = false;
    sleep(100).then(() => { resolved = true; });

    expect(resolved).toBe(false);

    jest.advanceTimersByTime(100);
    await Promise.resolve(); // Permet que les microtasques s'executin

    expect(resolved).toBe(true);

    jest.useRealTimers();
  });
});

describe('setPlayIcon', () => {
  let btn;
  let iconPlay;
  let iconStop;

  beforeEach(() => {
    btn = document.createElement('button');
    iconPlay = document.createElement('svg');
    iconPlay.className = 'icon-play';
    iconStop = document.createElement('svg');
    iconStop.className = 'icon-stop';
    iconStop.style.display = 'none';

    btn.appendChild(iconPlay);
    btn.appendChild(iconStop);
  });

  test('mostra icona stop quan playing=true', () => {
    setPlayIcon(btn, true);

    expect(iconPlay.style.display).toBe('none');
    expect(iconStop.style.display).toBe('block');
  });

  test('mostra icona play quan playing=false', () => {
    setPlayIcon(btn, false);

    expect(iconPlay.style.display).toBe('block');
    expect(iconStop.style.display).toBe('none');
  });

  test('no falla sense icones', () => {
    const emptyBtn = document.createElement('button');

    expect(() => {
      setPlayIcon(emptyBtn, true);
    }).not.toThrow();
  });
});

describe('createPlayButtonHTML', () => {
  test('crea HTML amb id correcte', () => {
    const html = createPlayButtonHTML('testBtn', 'Test button');

    expect(html).toContain('id="testBtn"');
  });

  test('crea HTML amb aria-label correcte', () => {
    const html = createPlayButtonHTML('btn', 'Reproduir escala');

    expect(html).toContain('aria-label="Reproduir escala"');
  });

  test('inclou icona play', () => {
    const html = createPlayButtonHTML('btn', 'label');

    expect(html).toContain('class="icon-play"');
  });

  test('inclou icona stop oculta', () => {
    const html = createPlayButtonHTML('btn', 'label');

    expect(html).toContain('class="icon-stop"');
    expect(html).toContain('display:none');
  });

  test('inclou classes CSS correctes', () => {
    const html = createPlayButtonHTML('btn', 'label');

    expect(html).toContain('class="play soundline-play"');
  });
});

describe('createPlaybackController', () => {
  let chromaticBtn;
  let scaleBtn;
  let onPlayChromatic;
  let onPlayScale;
  let controller;

  beforeEach(() => {
    chromaticBtn = document.createElement('button');
    chromaticBtn.innerHTML = `
      <svg class="icon-play"></svg>
      <svg class="icon-stop" style="display:none"></svg>
    `;

    scaleBtn = document.createElement('button');
    scaleBtn.innerHTML = `
      <svg class="icon-play"></svg>
      <svg class="icon-stop" style="display:none"></svg>
    `;

    onPlayChromatic = jest.fn(async ({ shouldStop }) => {
      // Simula reproducció
      for (let i = 0; i < 5; i++) {
        if (shouldStop()) break;
        await Promise.resolve();
      }
    });

    onPlayScale = jest.fn(async ({ shouldStop }) => {
      for (let i = 0; i < 3; i++) {
        if (shouldStop()) break;
        await Promise.resolve();
      }
    });

    controller = createPlaybackController({
      chromaticBtn,
      scaleBtn,
      onPlayChromatic,
      onPlayScale
    });

    document.body.appendChild(chromaticBtn);
    document.body.appendChild(scaleBtn);
  });

  afterEach(() => {
    controller.detach();
    if (chromaticBtn?.parentNode) chromaticBtn.remove();
    if (scaleBtn?.parentNode) scaleBtn.remove();
  });

  describe('attach', () => {
    test('afegeix event listeners als botons', () => {
      controller.attach();

      chromaticBtn.click();

      expect(onPlayChromatic).toHaveBeenCalled();
    });
  });

  describe('bloqueig mutu', () => {
    test('no permet play cromàtic mentre escala reproduint', async () => {
      controller.attach();

      // Iniciar escala
      scaleBtn.click();
      await Promise.resolve();

      // Intentar cromàtic mentre escala reproduint
      chromaticBtn.click();

      expect(onPlayChromatic).not.toHaveBeenCalled();
    });

    test('no permet play escala mentre cromàtic reproduint', async () => {
      controller.attach();

      // Iniciar cromàtic
      chromaticBtn.click();
      await Promise.resolve();

      // Intentar escala mentre cromàtic reproduint
      scaleBtn.click();

      expect(onPlayScale).not.toHaveBeenCalled();
    });
  });

  describe('estat playing', () => {
    test('afegeix classe playing al botó', async () => {
      controller.attach();

      const playPromise = new Promise(resolve => {
        onPlayChromatic.mockImplementation(async () => {
          expect(chromaticBtn.classList.contains('playing')).toBe(true);
          resolve();
        });
      });

      chromaticBtn.click();
      await playPromise;
    });

    test('elimina classe playing quan acaba', async () => {
      controller.attach();

      chromaticBtn.click();
      await Promise.resolve();
      await Promise.resolve();

      // Esperar que acabi
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(chromaticBtn.classList.contains('playing')).toBe(false);
    });
  });

  describe('stopAll', () => {
    test('atura reproducció cromàtica', async () => {
      let stopCalled = false;
      onPlayChromatic.mockImplementation(async ({ shouldStop }) => {
        while (!shouldStop()) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        stopCalled = true;
      });

      controller.attach();
      chromaticBtn.click();

      await new Promise(resolve => setTimeout(resolve, 20));
      controller.stopAll();

      await new Promise(resolve => setTimeout(resolve, 20));
      expect(stopCalled).toBe(true);
    });
  });

  describe('detach', () => {
    test('elimina event listeners', () => {
      controller.attach();
      controller.detach();

      chromaticBtn.click();

      expect(onPlayChromatic).not.toHaveBeenCalled();
    });
  });

  describe('getters', () => {
    test('isPlayingChromatic retorna estat', async () => {
      controller.attach();

      expect(controller.isPlayingChromatic).toBe(false);

      chromaticBtn.click();
      await Promise.resolve();

      expect(controller.isPlayingChromatic).toBe(true);
    });

    test('isPlayingScale retorna estat', async () => {
      controller.attach();

      expect(controller.isPlayingScale).toBe(false);

      scaleBtn.click();
      await Promise.resolve();

      expect(controller.isPlayingScale).toBe(true);
    });
  });
});

describe('createEEDisplayHTML', () => {
  test('crea HTML amb etiqueta eE', () => {
    const html = createEEDisplayHTML([2, 2, 1, 2, 2, 2, 1]);

    expect(html).toContain('class="ee-label"');
    expect(html).toContain('eE:');
  });

  test('inclou números de l\'estructura', () => {
    const html = createEEDisplayHTML([2, 2, 1, 2, 2, 2, 1]);

    expect(html).toContain('class="ee-number"');
    expect(html).toContain('>2<');
    expect(html).toContain('>1<');
  });

  test('inclou funció iS', () => {
    const html = createEEDisplayHTML([3, 2, 2]);

    expect(html).toContain('class="ee-function"');
    expect(html).toContain('iS(');
    expect(html).toContain(')</span>');
  });

  test('funciona amb escales de diferent mida', () => {
    const pentatonic = createEEDisplayHTML([2, 2, 3, 2, 3]);
    const octatonic = createEEDisplayHTML([2, 1, 2, 1, 2, 1, 2, 1]);

    expect(pentatonic).toContain('>3<');
    expect(octatonic.match(/ee-number/g).length).toBe(8);
  });
});

describe('updateEEDisplay', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    container.className = 'ee-display';
  });

  test('actualitza contingut del contenidor', () => {
    updateEEDisplay(container, [2, 2, 1, 2, 2, 2, 1]);

    expect(container.innerHTML).toContain('ee-label');
    expect(container.innerHTML).toContain('ee-number');
  });

  test('mostra nous números', () => {
    updateEEDisplay(container, [3, 2, 2, 3, 2]);

    const numbers = container.querySelectorAll('.ee-number');
    expect(numbers.length).toBe(5);
    expect(numbers[0].textContent).toBe('3');
  });

  test('no falla si container és null', () => {
    expect(() => {
      updateEEDisplay(null, [2, 2, 1]);
    }).not.toThrow();
  });

  test('reemplaça contingut anterior', () => {
    container.innerHTML = '<span>Contingut anterior</span>';

    updateEEDisplay(container, [2, 2, 1]);

    expect(container.innerHTML).not.toContain('Contingut anterior');
    expect(container.innerHTML).toContain('ee-label');
  });
});
