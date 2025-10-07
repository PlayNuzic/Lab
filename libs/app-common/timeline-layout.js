export function createTimelineRenderer(config = {}) {
  const {
    timeline,
    timelineWrapper,
    getLg: providedGetLg,
    getPulses = () => [],
    getBars = () => [],
    getCycleMarkers = () => [],
    getCycleLabels = () => [],
    getPulseNumberLabels = () => [],
    setPulseNumberLabels = () => {},
    computeNumberFontRem,
    pulseNumberHideThreshold = Infinity,
    numberCircleOffset = 0,
    isCircularEnabled = () => false,
    scheduleIndicatorReveal = () => {},
    tIndicatorTransitionDelay = 0,
    requestAnimationFrame: rafFromConfig,
    createPulseNumber,
    circularLabelOffset = 36,
    callbacks = {}
  } = config;

  if (!timeline) {
    throw new Error('createTimelineRenderer requires a timeline element');
  }

  const raf = typeof rafFromConfig === 'function'
    ? rafFromConfig
    : (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
      ? (cb) => window.requestAnimationFrame(cb)
      : (cb) => setTimeout(cb, 16));

  const getLg = typeof providedGetLg === 'function'
    ? providedGetLg
    : () => {
      const pulses = getPulses();
      if (Array.isArray(pulses) && pulses.length > 0) {
        return pulses.length - 1;
      }
      return 0;
    };

  const {
    onBeforeCircularLayout,
    onAfterCircularLayout,
    onBeforeLinearLayout,
    onAfterLinearLayout,
    onAfterLayout
  } = callbacks || {};

  const defaultCreatePulseNumber = (index, fontRem, context) => {
    const label = document.createElement('div');
    label.className = 'pulse-number';
    label.dataset.index = String(index);
    label.textContent = String(index);
    const sizeRem = typeof fontRem === 'number'
      ? fontRem
      : (typeof computeNumberFontRem === 'function' ? computeNumberFontRem(context.lg) : null);
    if (Number.isFinite(sizeRem)) {
      label.style.fontSize = `${sizeRem}rem`;
    }
    if (index === 0 || index === context.lg) {
      label.classList.add('endpoint');
    }
    return label;
  };

  const makePulseNumber = typeof createPulseNumber === 'function'
    ? (index, fontRem, ctx) => createPulseNumber(index, fontRem, ctx) || null
    : (index, fontRem, ctx) => defaultCreatePulseNumber(index, fontRem, ctx);

  const removePulseNumbers = () => {
    const existing = timeline.querySelectorAll('.pulse-number');
    existing.forEach((node) => node.remove());
  };

  const showNumber = (index, fontRem, context) => {
    const label = makePulseNumber(index, fontRem, context);
    if (!label) return null;
    if (!label.dataset || label.dataset.index == null) {
      label.dataset.index = String(index);
    }
    if (!label.classList.contains('pulse-number')) {
      label.classList.add('pulse-number');
    }
    if (!label.textContent) {
      label.textContent = String(index);
    }
    if (label.parentNode !== timeline) {
      timeline.appendChild(label);
    } else {
      timeline.appendChild(label);
    }
    return label;
  };

  const updatePulseNumbers = () => {
    removePulseNumbers();
    const nextLabels = [];
    setPulseNumberLabels(nextLabels);

    const pulses = getPulses();
    if (!Array.isArray(pulses) || pulses.length === 0) {
      return;
    }

    const lg = Number(getLg());
    if (!Number.isFinite(lg) || lg < 0) {
      return;
    }

    if (lg >= pulseNumberHideThreshold) {
      return;
    }

    const fontRem = typeof computeNumberFontRem === 'function'
      ? computeNumberFontRem(lg)
      : null;

    const context = { lg };

    const appendNumber = (idx) => {
      const label = showNumber(idx, fontRem, context);
      if (label) {
        nextLabels.push(label);
      }
    };

    appendNumber(0);
    appendNumber(lg);
    for (let i = 1; i < lg; i += 1) {
      appendNumber(i);
    }
  };

  const layoutTimeline = (opts = {}) => {
    const silent = !!opts.silent;
    const pulses = getPulses() || [];
    const bars = getBars() || [];
    const cycleMarkers = getCycleMarkers() || [];
    const cycleLabels = getCycleLabels() || [];

    const lgValue = Number(getLg());
    const lg = Number.isFinite(lgValue) ? lgValue : 0;

    const wasCircular = timeline.classList.contains('circular');
    const desiredCircular = !!(typeof isCircularEnabled === 'function'
      ? isCircularEnabled({ lg })
      : isCircularEnabled);

    const delay = (!silent && wasCircular !== desiredCircular)
      ? tIndicatorTransitionDelay
      : 0;

    const queueIndicatorUpdate = () => {
      const ms = Math.max(0, Number(delay) || 0);
      scheduleIndicatorReveal(ms);
    };

    const resolveWrapper = () => {
      if (timelineWrapper) return timelineWrapper;
      if (typeof timeline.closest === 'function') {
        const closest = timeline.closest('.timeline-wrapper');
        if (closest) return closest;
      }
      return timeline.parentElement || timeline;
    };

    const wrapper = resolveWrapper();

    if (!Number.isFinite(lg) || lg <= 0) {
      if (wrapper && wrapper !== timeline && wrapper.classList) {
        wrapper.classList.remove('circular');
      }
      if (timelineWrapper && timelineWrapper.classList) {
        timelineWrapper.classList.remove('circular');
      }
      timeline.classList.remove('circular');
      if (wrapper && typeof wrapper.querySelector === 'function') {
        const guide = wrapper.querySelector('.circle-guide');
        if (guide) guide.style.opacity = '0';
      }
      queueIndicatorUpdate();
      return;
    }

    const percentForIndex = (index) => {
      if (!Number.isFinite(lg) || lg === 0) return 0;
      return (index / lg) * 100;
    };

    const percentForPosition = (position) => {
      if (!Number.isFinite(lg) || lg === 0) return 0;
      return (position / lg) * 100;
    };

    const baseContext = {
      lg,
      timeline,
      timelineWrapper,
      pulses,
      bars,
      cycleMarkers,
      cycleLabels,
      pulseNumberLabels: getPulseNumberLabels() || [],
      percentForIndex,
      percentForPosition,
      numberCircleOffset
    };

    if (desiredCircular) {
      if (timelineWrapper && timelineWrapper.classList) {
        timelineWrapper.classList.add('circular');
      } else if (wrapper && wrapper.classList) {
        wrapper.classList.add('circular');
      }
      timeline.classList.add('circular');
      if (silent) {
        timeline.classList.add('no-anim');
      }

      let guide = null;
      if (wrapper && typeof wrapper.querySelector === 'function') {
        guide = wrapper.querySelector('.circle-guide');
        if (!guide && typeof wrapper.appendChild === 'function') {
          guide = document.createElement('div');
          guide.className = 'circle-guide';
          guide.style.position = 'absolute';
          guide.style.border = '2px solid var(--line-color)';
          guide.style.borderRadius = '50%';
          guide.style.pointerEvents = 'none';
          guide.style.opacity = '0';
          wrapper.appendChild(guide);
        }
      }

      raf(() => {
        const rect = timeline.getBoundingClientRect();
        const width = rect.width || 0;
        const height = rect.height || 0;
        const cx = width / 2;
        const cy = height / 2;
        const radius = Math.min(width, height) / 2 - 1;

        const angleForIndex = (index) => {
          if (!Number.isFinite(lg) || lg === 0) return Math.PI / 2;
          return (index / lg) * 2 * Math.PI + Math.PI / 2;
        };

        const angleForPosition = (position) => {
          if (!Number.isFinite(lg) || lg === 0) return Math.PI / 2;
          return (position / lg) * 2 * Math.PI + Math.PI / 2;
        };

        const circularContext = {
          ...baseContext,
          timelineRect: rect,
          centerX: cx,
          centerY: cy,
          radius,
          angleForIndex,
          angleForPosition,
          guide
        };

        if (typeof onBeforeCircularLayout === 'function') {
          onBeforeCircularLayout(circularContext);
        }

        pulses.forEach((pulse, idx) => {
          if (!pulse) return;
          const angle = angleForIndex(idx);
          const px = cx + radius * Math.cos(angle);
          const py = cy + radius * Math.sin(angle);
          pulse.style.left = `${px}px`;
          pulse.style.top = `${py}px`;
          pulse.style.transform = 'translate(-50%, -50%)';
        });

        bars.forEach((bar, idx) => {
          if (!bar) return;
          const step = idx === 0 ? 0 : lg;
          const angle = angleForPosition(step);
          const bx = cx + radius * Math.cos(angle);
          const by = cy + radius * Math.sin(angle);
          const length = Math.min(width, height) * 0.25;
          const topPx = by - length / 2;
          bar.style.display = 'block';
          bar.style.left = `${bx - 1}px`;
          bar.style.top = `${topPx}px`;
          bar.style.height = `${length}px`;
          bar.style.transformOrigin = '50% 50%';
          bar.style.transform = `rotate(${angle + Math.PI / 2}rad)`;
        });

        const numberNodes = timeline.querySelectorAll('.pulse-number');
        numberNodes.forEach((label) => {
          if (!label) return;
          const idx = Number(label.dataset.index);
          if (!Number.isFinite(idx)) return;
          const angle = angleForIndex(idx);
          const innerRadius = radius - numberCircleOffset;
          let x = cx + innerRadius * Math.cos(angle);
          let y = cy + innerRadius * Math.sin(angle);
          if (idx === 0) x -= 16;
          else if (idx === lg) x += 16;
          if (idx === 0 || idx === lg) y += 8;
          label.style.left = `${x}px`;
          label.style.top = `${y}px`;
          label.style.transform = 'translate(-50%, -50%)';
        });

        cycleMarkers.forEach((marker) => {
          if (!marker) return;
          const pos = Number(marker.dataset.position);
          if (!Number.isFinite(pos)) return;
          const angle = angleForPosition(pos);
          const mx = cx + radius * Math.cos(angle);
          const my = cy + radius * Math.sin(angle);
          marker.style.left = `${mx}px`;
          marker.style.top = `${my}px`;
          marker.style.transformOrigin = '50% 50%';
          const transform = `translate(-50%, -50%) rotate(${angle + Math.PI / 2}rad)`;
          marker.style.transform = transform;
          marker.style.setProperty('--pulse-flash-base-transform', transform);
        });

        cycleLabels.forEach((label) => {
          if (!label) return;
          const pos = Number(label.dataset.position);
          if (!Number.isFinite(pos)) return;
          const angle = angleForPosition(pos);
          const lx = cx + (radius + circularLabelOffset) * Math.cos(angle);
          const ly = cy + (radius + circularLabelOffset) * Math.sin(angle);
          label.style.left = `${lx}px`;
          label.style.top = `${ly}px`;
          label.style.transform = 'translate(-50%, -50%)';
        });

        if (typeof onAfterCircularLayout === 'function') {
          onAfterCircularLayout(circularContext);
        }

        if (guide) {
          guide.style.left = `${cx}px`;
          guide.style.top = `${cy}px`;
          guide.style.width = `${radius * 2}px`;
          guide.style.height = `${radius * 2}px`;
          guide.style.transform = 'translate(-50%, -50%)';
          guide.style.opacity = '0';
        }

        queueIndicatorUpdate();

        if (silent) {
          void timeline.offsetHeight;
          timeline.classList.remove('no-anim');
        }
      });
    } else {
      if (timelineWrapper && timelineWrapper.classList) {
        timelineWrapper.classList.remove('circular');
      }
      timeline.classList.remove('circular');
      if (wrapper && typeof wrapper.querySelector === 'function') {
        const guide = wrapper.querySelector('.circle-guide');
        if (guide) {
          guide.style.opacity = '0';
        }
      }

      if (typeof onBeforeLinearLayout === 'function') {
        onBeforeLinearLayout(baseContext);
      }

      pulses.forEach((pulse, idx) => {
        if (!pulse) return;
        const percent = percentForIndex(idx);
        pulse.style.left = `${percent}%`;
        pulse.style.top = '50%';
        pulse.style.transform = 'translate(-50%, -50%)';
      });

      bars.forEach((bar, idx) => {
        if (!bar) return;
        const step = idx === 0 ? 0 : lg;
        const percent = percentForIndex(step);
        bar.style.display = 'block';
        bar.style.left = `${percent}%`;
        bar.style.top = '15%';
        bar.style.height = '70%';
        bar.style.transform = '';
      });

      const numberNodes = timeline.querySelectorAll('.pulse-number');
      numberNodes.forEach((label) => {
        if (!label) return;
        const idx = Number(label.dataset.index);
        if (!Number.isFinite(idx)) return;
        const percent = percentForIndex(idx);
        label.style.left = `${percent}%`;
        label.style.top = '-28px';
        label.style.transform = 'translate(-50%, 0)';
      });

      cycleMarkers.forEach((marker) => {
        if (!marker) return;
        const pos = Number(marker.dataset.position);
        if (!Number.isFinite(pos)) return;
        const percent = percentForPosition(pos);
        marker.style.left = `${percent}%`;
        marker.style.top = '50%';
        marker.style.transformOrigin = '50% 50%';
        const transform = 'translate(-50%, -50%)';
        marker.style.transform = transform;
        marker.style.setProperty('--pulse-flash-base-transform', transform);
      });

      cycleLabels.forEach((label) => {
        if (!label) return;
        const pos = Number(label.dataset.position);
        if (!Number.isFinite(pos)) return;
        const percent = percentForPosition(pos);
        label.style.left = `${percent}%`;
        label.style.top = 'calc(100% + 12px)';
        label.style.transform = 'translate(-50%, 0)';
      });

      if (typeof onAfterLinearLayout === 'function') {
        onAfterLinearLayout(baseContext);
      }

      queueIndicatorUpdate();
    }

    if (typeof onAfterLayout === 'function') {
      onAfterLayout(baseContext);
    }
  };

  return {
    updatePulseNumbers,
    layoutTimeline
  };
}
