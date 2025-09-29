// libs/shared-ui/performance-audio-menu.js
(function () {
  const DETAILS_CLASS = 'nuzic-audio-perf';
  const PANEL_CLASS = 'nuzic-audio-perf-panel';
  const AUDIO = () => (window.NuzicAudioEngine || null);
  const DEFAULT_SAMPLE_RATE = 48000;
  const DEFAULT_HORIZON_MS = 120;
  const PANEL_SURFACE_CLASS = 'menu-surface';
  const SCHEDULE_FRAME_PRESETS = [1024, 1536, 2048, 3072, 4096, 6144, 8192, 12288];
  const sliderOptions = new WeakMap();

  function extractElements(container) {
    const sr = container.querySelector('#nza-sr');
    const apply = container.querySelector('#nza-apply-sr');
    const hz = container.querySelector('#nza-hz');
    const hzOut = container.querySelector('#nza-hz-out');
    const intMs = container.querySelector('#nza-int');
    return { sr, apply, hz, hzOut, intMs };
  }

  function createPanel() {
    const panel = document.createElement('div');
    panel.className = `${PANEL_CLASS} ${PANEL_SURFACE_CLASS}`;
    panel.innerHTML = `
      <div class="perf-row">
        <label for="nza-sr">Sample Rate (Hz)</label>
        <select id="nza-sr">
          <option value="48000">48 kHz</option>
          <option value="44100">44.1 kHz</option>
          <option value="22050">22.05 kHz</option>
        </select>
        <button id="nza-apply-sr" type="button">Aplicar</button>
      </div>
      <div class="perf-row">
        <label for="nza-hz">Schedule Horizon (ms)</label>
        <input id="nza-hz" type="range" min="0" max="0" step="1" value="0" />
        <output id="nza-hz-out" for="nza-hz">--</output>
      </div>
      <div class="perf-row readonly">
        <label for="nza-int">Scheduler Interval (ms)</label>
        <span id="nza-int" role="status" aria-live="polite">--</span>
      </div>
      <div class="perf-foot">Los cambios de Sample Rate solo aplican si el motor aún no inició.</div>
    `;
    return panel;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function formatSampleRate(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return String(value);
    const khz = numeric / 1000;
    const precision = Number.isInteger(khz) ? 0 : (khz < 10 ? 2 : 1);
    return `${khz.toFixed(precision)} kHz`;
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

  function ensureSampleRateOption(select, sampleRate) {
    if (!select) return;
    const sr = Number(sampleRate);
    if (!Number.isFinite(sr) || sr <= 0) return;
    const existing = Array.from(select.options).find((opt) => Number(opt.value) === sr);
    if (!existing) {
      const opt = document.createElement('option');
      opt.value = String(sr);
      opt.textContent = formatSampleRate(sr);
      select.appendChild(opt);
    }
  }

  function buildScheduleOptions(sampleRate) {
    const sr = Number(sampleRate);
    if (!Number.isFinite(sr) || sr <= 0) return [];
    const values = [];
    for (const frames of SCHEDULE_FRAME_PRESETS) {
      const ms = (frames / sr) * 1000;
      if (ms < 40 || ms > 240) continue;
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
    const sr = Number(sampleRate) || DEFAULT_SAMPLE_RATE;
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
    const { sr, hz, hzOut, intMs } = elements;
    if (!hz) return;
    const srValue = Number(sr?.value) || DEFAULT_SAMPLE_RATE;
    const options = updateSliderOptions(hz, srValue);
    const base = Number.isFinite(preferredHorizon)
      ? preferredHorizon
      : (getStoredSliderValue(hz) ?? DEFAULT_HORIZON_MS);
    const actual = setSliderToValue(hz, base);
    if (hzOut) hzOut.textContent = formatMsLabel(actual);
    if (intMs) {
      const computed = computeSchedulerIntervalMs(actual, srValue);
      intMs.textContent = formatMsLabel(computed);
    }
    return { options, actual, srValue };
  }

  function applyPerformanceInfo(elements, info) {
    const { sr } = elements;
    if (!info) {
      refreshScheduleControls(elements);
      return;
    }
    const sampleRate = Number(info.actualSampleRate || info.requestedSampleRate);
    if (sr && Number.isFinite(sampleRate)) {
      ensureSampleRateOption(sr, sampleRate);
      sr.value = String(sampleRate);
    }
    const horizon = Number(info.scheduleHorizonMs);
    refreshScheduleControls(elements, Number.isFinite(horizon) ? horizon : undefined);
  }

  function syncFromEngine(elements) {
    const { sr, hz, hzOut, intMs } = elements;
    if (!sr || !hz || !hzOut || !intMs) return;
    const engine = AUDIO();
    if (!engine) return;

    Promise.resolve(engine.configurePerformance({})).then((info) => {
      applyPerformanceInfo(elements, info || null);
    }).catch(() => {});
  }

  function wireInteractions(panel) {
    const elements = extractElements(panel);
    const { sr, apply, hz, hzOut, intMs } = elements;

    refreshScheduleControls(elements);

    if (sr) {
      sr.addEventListener('change', () => {
        refreshScheduleControls(elements);
      });
    }

    if (hz && hzOut) {
      hz.addEventListener('input', async () => {
        const selection = getSliderSelection(hz);
        if (hzOut) hzOut.textContent = formatMsLabel(selection.value);
        if (intMs) {
          const srValue = Number(sr?.value) || DEFAULT_SAMPLE_RATE;
          const computed = computeSchedulerIntervalMs(selection.value, srValue);
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

    if (apply && sr) {
      apply.addEventListener('click', async () => {
        const engine = AUDIO();
        if (!engine) return;
        try {
          const info = await engine.configurePerformance({ requestedSampleRate: +sr.value });
          applyPerformanceInfo(elements, info || null);
          console.log('[AudioPerf] SR ->', info?.actualSampleRate);
        } catch (err) {
          console.warn('[AudioPerf] sample-rate update failed', err);
        }
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
    summary.textContent = 'Rendimiento audio';
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

    wireInteractions(panel);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => install());
  } else {
    install();
  }
})();
