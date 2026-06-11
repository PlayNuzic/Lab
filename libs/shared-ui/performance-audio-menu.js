// libs/shared-ui/performance-audio-menu.js
//
// Eina de DIAGNÒSTIC d'scheduling (horitzó + offset de samples). NOMÉS en
// mode dev (?dev o localStorage nuzic-debug=1, com la resta d'eines del
// repo): en producció el sistema ja es gestiona sol — preset 'balanced' per
// defecte al motor i perfil per dispositiu via el scheduling bridge del
// header — i un alumne movent l'horitzó només empitjoraria la latència que
// el bridge ha afinat (i el canvi ni es persisteix).
//
// La fila de "Sample Rate" que hi havia aquí es va ELIMINAR (2026-06-11):
// configurePerformance({requestedSampleRate}) re-creava l'AudioContext a la
// freqüència demanada, trencant l'invariant del context únic a 44100 pinnat
// abans de crear cap node (regla de Tone; els samples del repo són 44.1k) —
// el mateix patró de contexts divergents del bug "context has been closed".
import { devLogsEnabled } from '../app-common/logger.js';

(function () {
  if (!devLogsEnabled) return;

  const DETAILS_CLASS = 'nuzic-audio-perf';
  const PANEL_CLASS = 'nuzic-audio-perf-panel';
  const AUDIO = () => (window.NuzicAudioEngine || null);
  // Invariant del repo: el context es pinna a 44100 (vegeu tone-loader.js).
  const PINNED_SAMPLE_RATE = 44100;
  const DEFAULT_HORIZON_MS = 30; // preset 'balanced' del motor (LA-01)
  const PANEL_SURFACE_CLASS = 'menu-surface';
  const SCHEDULE_FRAME_PRESETS = [1024, 1536, 2048, 3072, 4096, 6144, 8192, 12288];
  const sliderOptions = new WeakMap();

  // Freqüència REAL del motor (sincronitzada quan existeix); fins llavors,
  // la pinnada — només s'usa per quantitzar les opcions de l'slider.
  let engineSampleRate = PINNED_SAMPLE_RATE;

  function extractElements(container) {
    const hz = container.querySelector('#nza-hz');
    const hzOut = container.querySelector('#nza-hz-out');
    const intMs = container.querySelector('#nza-int');
    const offset = container.querySelector('#nza-offset');
    const offsetOut = container.querySelector('#nza-offset-out');
    return { hz, hzOut, intMs, offset, offsetOut };
  }

  function createPanel() {
    const panel = document.createElement('div');
    panel.className = `${PANEL_CLASS} ${PANEL_SURFACE_CLASS}`;
    panel.innerHTML = `
      <div class="perf-row">
        <label for="nza-hz">Schedule Horizon (ms)</label>
        <input id="nza-hz" type="range" min="0" max="0" step="1" value="0" />
        <output id="nza-hz-out" for="nza-hz">--</output>
      </div>
      <div class="perf-row readonly">
        <span>Scheduler Interval (ms)</span>
        <span id="nza-int" role="status" aria-live="polite">--</span>
      </div>
      <div class="perf-row">
        <label for="nza-offset">Sample Offset (ms)</label>
        <input id="nza-offset" type="range" min="0" max="20" step="0.5" value="6" />
        <output id="nza-offset-out" for="nza-offset">6.0 ms</output>
      </div>
      <div class="perf-foot">Eina de diagnòstic (mode dev). Els valors reals s'apliquen quan el motor existeix.</div>
    `;
    return panel;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function formatMs(value) {
    if (!Number.isFinite(value)) return '--';
    if (value >= 100) return String(Math.round(value));
    return (Math.round(value * 10) / 10).toFixed(value >= 10 ? 1 : 2);
  }

  function formatMsLabel(value) {
    const formatted = formatMs(value);
    return formatted === '--' ? formatted : `${formatted} ms`;
  }

  function buildScheduleOptions(sampleRate) {
    const sr = Number(sampleRate);
    if (!Number.isFinite(sr) || sr <= 0) return [];
    const values = [];
    for (const frames of SCHEDULE_FRAME_PRESETS) {
      const ms = (frames / sr) * 1000;
      if (ms < 20 || ms > 240) continue;
      const rounded = Math.round(ms * 10) / 10;
      if (!values.some((existing) => Math.abs(existing - rounded) < 0.05)) {
        values.push(rounded);
      }
    }
    if (!values.length) values.push(DEFAULT_HORIZON_MS);
    return values;
  }

  function updateSliderOptions(slider, sampleRate) {
    if (!slider) return [];
    const options = buildScheduleOptions(sampleRate);
    sliderOptions.set(slider, options);
    slider.min = '0';
    slider.max = String(Math.max(0, options.length - 1));
    slider.step = '1';
    slider.disabled = options.length <= 1;
    return options;
  }

  function findClosestIndex(options, target) {
    if (!options.length) return 0;
    if (!Number.isFinite(target)) return 0;
    let idx = 0;
    let diff = Math.abs(options[0] - target);
    for (let i = 1; i < options.length; i += 1) {
      const delta = Math.abs(options[i] - target);
      if (delta < diff) {
        idx = i;
        diff = delta;
      }
    }
    return idx;
  }

  function setSliderToValue(slider, target) {
    if (!slider) return null;
    const options = sliderOptions.get(slider) || [];
    const index = findClosestIndex(options, target);
    slider.value = String(index);
    const value = options[index];
    if (Number.isFinite(value)) {
      slider.dataset.actualValue = String(value);
      return value;
    }
    slider.dataset.actualValue = '';
    return null;
  }

  function getSliderSelection(slider) {
    if (!slider) return { index: 0, value: null };
    const options = sliderOptions.get(slider) || [];
    if (!options.length) return { index: 0, value: null };
    const rawIndex = Number(slider.value);
    const index = Number.isFinite(rawIndex)
      ? clamp(Math.round(rawIndex), 0, options.length - 1)
      : 0;
    const value = options[index];
    if (Number.isFinite(value)) {
      slider.dataset.actualValue = String(value);
      return { index, value };
    }
    slider.dataset.actualValue = '';
    return { index, value: null };
  }

  function getStoredSliderValue(slider) {
    if (!slider) return null;
    const stored = Number(slider.dataset.actualValue);
    return Number.isFinite(stored) ? stored : null;
  }

  function computeSchedulerIntervalMs(scheduleHorizonMs, sampleRate) {
    const horizon = Number(scheduleHorizonMs);
    const sr = Number(sampleRate) || PINNED_SAMPLE_RATE;
    if (!Number.isFinite(horizon) || horizon <= 0 || !Number.isFinite(sr) || sr <= 0) {
      return null;
    }
    const updates = Math.max(3, Math.ceil(horizon / 30));
    const horizonFrames = (horizon / 1000) * sr;
    const intervalFrames = horizonFrames / updates;
    const quantizedFrames = Math.max(128, Math.round(intervalFrames / 128) * 128);
    const intervalMs = (quantizedFrames / sr) * 1000;
    return Math.round(intervalMs);
  }

  function refreshScheduleControls(elements, preferredHorizon) {
    const { hz, hzOut, intMs } = elements;
    if (!hz) return;
    const options = updateSliderOptions(hz, engineSampleRate);
    const base = Number.isFinite(preferredHorizon)
      ? preferredHorizon
      : (getStoredSliderValue(hz) ?? DEFAULT_HORIZON_MS);
    const actual = setSliderToValue(hz, base);
    if (hzOut) hzOut.textContent = formatMsLabel(actual);
    if (intMs) {
      const computed = computeSchedulerIntervalMs(actual, engineSampleRate);
      intMs.textContent = formatMsLabel(computed);
    }
    return { options, actual };
  }

  function applyPerformanceInfo(elements, info) {
    if (!info) {
      refreshScheduleControls(elements);
      return;
    }
    const sampleRate = Number(info.actualSampleRate);
    if (Number.isFinite(sampleRate) && sampleRate > 0) {
      engineSampleRate = sampleRate;
    }
    const horizon = Number(info.scheduleHorizonMs);
    refreshScheduleControls(elements, Number.isFinite(horizon) ? horizon : undefined);
    const offsetVal = Number(info.sampleOffsetMs);
    if (elements.offset && Number.isFinite(offsetVal)) {
      elements.offset.value = String(offsetVal);
      if (elements.offsetOut) elements.offsetOut.textContent = formatMsLabel(offsetVal);
    }
  }

  function syncFromEngine(elements) {
    const { hz, hzOut, intMs } = elements;
    if (!hz || !hzOut || !intMs) return;
    const engine = AUDIO();
    if (!engine) return;

    Promise.resolve(engine.configurePerformance({})).then((info) => {
      applyPerformanceInfo(elements, info || null);
    }).catch(() => {});
  }

  function wireInteractions(panel, details) {
    const elements = extractElements(panel);
    const { hz, hzOut, intMs } = elements;

    refreshScheduleControls(elements);

    if (hz && hzOut) {
      hz.addEventListener('input', async () => {
        const selection = getSliderSelection(hz);
        if (hzOut) hzOut.textContent = formatMsLabel(selection.value);
        if (intMs) {
          const computed = computeSchedulerIntervalMs(selection.value, engineSampleRate);
          intMs.textContent = formatMsLabel(computed);
        }
        const engine = AUDIO();
        if (!engine || selection.value == null) return;
        try {
          const info = await engine.configurePerformance({ scheduleHorizonMs: selection.value });
          applyPerformanceInfo(elements, info || null);
        } catch (err) {
          console.warn('[AudioPerf] schedule update failed', err);
        }
      });
    }

    if (elements.offset && elements.offsetOut) {
      elements.offset.addEventListener('input', async () => {
        const val = Number(elements.offset.value);
        elements.offsetOut.textContent = formatMsLabel(val);
        const engine = AUDIO();
        if (!engine) return;
        try {
          await engine.configurePerformance({ sampleOffsetMs: val });
        } catch (err) {
          console.warn('[AudioPerf] sample offset update failed', err);
        }
      });
    }

    // Re-sincronitza amb el motor cada cop que s'obre el panell: si el motor
    // ha nascut després de la instal·lació, els valors mostrats deixen de
    // ser els placeholders i passen a ser els reals.
    if (details) {
      details.addEventListener('toggle', () => {
        if (details.open) syncFromEngine(elements);
      });
    }

    syncFromEngine(elements);
  }

  function install(attempt = 0) {
    const header = document.querySelector('header.top-bar');
    const optionsContent = header?.querySelector('details.menu .options-content');
    if (!optionsContent) {
      if (attempt < 10) window.setTimeout(() => install(attempt + 1), 150);
      return;
    }

    if (optionsContent.querySelector(`details.${DETAILS_CLASS}`)) return;

    const details = document.createElement('details');
    details.className = DETAILS_CLASS;

    const summary = document.createElement('summary');
    summary.textContent = 'Rendimiento audio (dev)';
    details.appendChild(summary);

    const panel = createPanel();
    details.appendChild(panel);
    optionsContent.appendChild(details);

    details.addEventListener('toggle', (event) => {
      if (!event.target.open && typeof summary.focus === 'function') {
        // ensure focus can return to the menu summary when closing
        summary.focus({ preventScroll: true });
      }
    });

    optionsContent.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && details.open) {
        details.open = false;
      }
    });

    wireInteractions(panel, details);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => install());
  } else {
    install();
  }
})();
