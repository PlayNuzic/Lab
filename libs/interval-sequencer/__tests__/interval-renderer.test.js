/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';
import {
  createIntervalRenderer,
  DEFAULT_INTERVAL_BAR_STYLES,
  injectIntervalBarStyles
} from '../interval-renderer.js';

describe('interval-renderer', () => {
  let timelineContainer;
  let matrixContainer;
  let renderer;

  beforeEach(() => {
    // Create containers
    timelineContainer = document.createElement('div');
    timelineContainer.id = 'timeline';
    document.body.appendChild(timelineContainer);

    matrixContainer = document.createElement('div');
    matrixContainer.id = 'matrix';
    matrixContainer.style.width = '400px';
    document.body.appendChild(matrixContainer);

    // Mock getBoundingClientRect
    matrixContainer.getBoundingClientRect = () => ({
      width: 400,
      height: 200,
      left: 0,
      top: 0,
      right: 400,
      bottom: 200
    });
  });

  afterEach(() => {
    if (renderer) {
      renderer.destroy();
      renderer = null;
    }
    document.body.innerHTML = '';
  });

  describe('createIntervalRenderer', () => {
    test('creates renderer with default config', () => {
      renderer = createIntervalRenderer({
        getTimelineContainer: () => timelineContainer,
        getMatrixContainer: () => matrixContainer,
        totalSpaces: 8
      });

      expect(renderer).toBeDefined();
      expect(typeof renderer.render).toBe('function');
      expect(typeof renderer.clear).toBe('function');
    });

    test('render creates layer if not exists', () => {
      renderer = createIntervalRenderer({
        getTimelineContainer: () => timelineContainer,
        getMatrixContainer: () => matrixContainer,
        totalSpaces: 8
      });

      renderer.render([{ temporalInterval: 2 }]);

      const layer = timelineContainer.querySelector('#it-bars-layer');
      expect(layer).not.toBeNull();
      expect(layer.className).toBe('it-bars-layer');
    });

    test('render uses custom layer ID and class', () => {
      renderer = createIntervalRenderer({
        getTimelineContainer: () => timelineContainer,
        getMatrixContainer: () => matrixContainer,
        totalSpaces: 8,
        layerId: 'custom-layer',
        layerClass: 'custom-class'
      });

      renderer.render([{ temporalInterval: 2 }]);

      const layer = timelineContainer.querySelector('#custom-layer');
      expect(layer).not.toBeNull();
      expect(layer.className).toBe('custom-class');
    });

    test('render creates bars for each interval', () => {
      renderer = createIntervalRenderer({
        getTimelineContainer: () => timelineContainer,
        getMatrixContainer: () => matrixContainer,
        totalSpaces: 8
      });

      renderer.render([
        { temporalInterval: 2 },
        { temporalInterval: 3 },
        { temporalInterval: 1 }
      ]);

      const bars = timelineContainer.querySelectorAll('.it-bar');
      expect(bars).toHaveLength(3);
    });

    test('render sets correct bar positions', () => {
      renderer = createIntervalRenderer({
        getTimelineContainer: () => timelineContainer,
        getMatrixContainer: () => matrixContainer,
        totalSpaces: 8
      });

      renderer.render([
        { temporalInterval: 2 },
        { temporalInterval: 3 }
      ]);

      const bars = timelineContainer.querySelectorAll('.it-bar');
      const cellWidth = 400 / 8; // 50px

      expect(bars[0].style.left).toBe('0px');
      expect(bars[0].style.width).toBe(`${2 * cellWidth}px`);

      expect(bars[1].style.left).toBe(`${2 * cellWidth}px`);
      expect(bars[1].style.width).toBe(`${3 * cellWidth}px`);
    });

    test('render adds rest class to rest intervals', () => {
      renderer = createIntervalRenderer({
        getTimelineContainer: () => timelineContainer,
        getMatrixContainer: () => matrixContainer,
        totalSpaces: 8
      });

      renderer.render([
        { temporalInterval: 2, isRest: true }
      ]);

      const bar = timelineContainer.querySelector('.it-bar');
      expect(bar.classList.contains('it-bar--rest')).toBe(true);
    });

    test('render sets data-index attribute', () => {
      renderer = createIntervalRenderer({
        getTimelineContainer: () => timelineContainer,
        getMatrixContainer: () => matrixContainer,
        totalSpaces: 8
      });

      renderer.render([
        { temporalInterval: 2 },
        { temporalInterval: 3 }
      ]);

      const bars = timelineContainer.querySelectorAll('.it-bar');
      expect(bars[0].dataset.index).toBe('1');
      expect(bars[1].dataset.index).toBe('2');
    });

    test('render creates labels with duration', () => {
      renderer = createIntervalRenderer({
        getTimelineContainer: () => timelineContainer,
        getMatrixContainer: () => matrixContainer,
        totalSpaces: 8
      });

      renderer.render([{ temporalInterval: 5 }]);

      const label = timelineContainer.querySelector('.it-bar__label');
      expect(label.textContent).toBe('5');
    });

    test('render uses custom formatLabel', () => {
      renderer = createIntervalRenderer({
        getTimelineContainer: () => timelineContainer,
        getMatrixContainer: () => matrixContainer,
        totalSpaces: 8,
        formatLabel: (d) => `iT=${d}`
      });

      renderer.render([{ temporalInterval: 3 }]);

      const label = timelineContainer.querySelector('.it-bar__label');
      expect(label.textContent).toBe('iT=3');
    });

    test('render skips intervals with no duration', () => {
      renderer = createIntervalRenderer({
        getTimelineContainer: () => timelineContainer,
        getMatrixContainer: () => matrixContainer,
        totalSpaces: 8
      });

      renderer.render([
        { temporalInterval: 2 },
        { temporalInterval: 0 },
        { temporalInterval: 3 }
      ]);

      const bars = timelineContainer.querySelectorAll('.it-bar');
      expect(bars).toHaveLength(2);
    });

    test('render supports temporal property name', () => {
      renderer = createIntervalRenderer({
        getTimelineContainer: () => timelineContainer,
        getMatrixContainer: () => matrixContainer,
        totalSpaces: 8
      });

      renderer.render([{ temporal: 4 }]);

      const label = timelineContainer.querySelector('.it-bar__label');
      expect(label.textContent).toBe('4');
    });

    test('clear removes all bars', () => {
      renderer = createIntervalRenderer({
        getTimelineContainer: () => timelineContainer,
        getMatrixContainer: () => matrixContainer,
        totalSpaces: 8
      });

      renderer.render([{ temporalInterval: 2 }, { temporalInterval: 3 }]);
      expect(timelineContainer.querySelectorAll('.it-bar')).toHaveLength(2);

      renderer.clear();
      expect(timelineContainer.querySelectorAll('.it-bar')).toHaveLength(0);
    });

    test('getBar returns bar by index', () => {
      renderer = createIntervalRenderer({
        getTimelineContainer: () => timelineContainer,
        getMatrixContainer: () => matrixContainer,
        totalSpaces: 8
      });

      renderer.render([{ temporalInterval: 2 }, { temporalInterval: 3 }]);

      const bar = renderer.getBar(2);
      expect(bar).not.toBeNull();
      expect(bar.dataset.index).toBe('2');
    });

    test('getAllBars returns all bar elements', () => {
      renderer = createIntervalRenderer({
        getTimelineContainer: () => timelineContainer,
        getMatrixContainer: () => matrixContainer,
        totalSpaces: 8
      });

      renderer.render([{ temporalInterval: 2 }, { temporalInterval: 3 }]);

      const bars = renderer.getAllBars();
      expect(bars).toHaveLength(2);
    });

    test('highlightBar adds and removes highlight class', () => {
      jest.useFakeTimers();

      renderer = createIntervalRenderer({
        getTimelineContainer: () => timelineContainer,
        getMatrixContainer: () => matrixContainer,
        totalSpaces: 8
      });

      renderer.render([{ temporalInterval: 2 }]);
      renderer.highlightBar(1, 100);

      const bar = renderer.getBar(1);
      expect(bar.classList.contains('it-bar--highlight')).toBe(true);

      jest.advanceTimersByTime(100);
      expect(bar.classList.contains('it-bar--highlight')).toBe(false);

      jest.useRealTimers();
    });

    test('updateBarWidth changes bar width', () => {
      renderer = createIntervalRenderer({
        getTimelineContainer: () => timelineContainer,
        getMatrixContainer: () => matrixContainer,
        totalSpaces: 8
      });

      renderer.render([{ temporalInterval: 2 }]);
      renderer.updateBarWidth(1, 4);

      const bar = renderer.getBar(1);
      const cellWidth = 400 / 8;
      expect(bar.style.width).toBe(`${4 * cellWidth}px`);

      const label = bar.querySelector('.it-bar__label');
      expect(label.textContent).toBe('4');
    });

    test('destroy removes layer from DOM', () => {
      renderer = createIntervalRenderer({
        getTimelineContainer: () => timelineContainer,
        getMatrixContainer: () => matrixContainer,
        totalSpaces: 8
      });

      renderer.render([{ temporalInterval: 2 }]);
      expect(timelineContainer.querySelector('#it-bars-layer')).not.toBeNull();

      renderer.destroy();
      expect(timelineContainer.querySelector('#it-bars-layer')).toBeNull();
    });

    test('getLayer returns layer element', () => {
      renderer = createIntervalRenderer({
        getTimelineContainer: () => timelineContainer,
        getMatrixContainer: () => matrixContainer,
        totalSpaces: 8
      });

      renderer.render([{ temporalInterval: 2 }]);

      const layer = renderer.getLayer();
      expect(layer).not.toBeNull();
      expect(layer.id).toBe('it-bars-layer');
    });

    test('recalculate re-renders intervals', () => {
      renderer = createIntervalRenderer({
        getTimelineContainer: () => timelineContainer,
        getMatrixContainer: () => matrixContainer,
        totalSpaces: 8
      });

      const intervals = [{ temporalInterval: 2 }];
      renderer.render(intervals);

      // Simulate resize
      matrixContainer.getBoundingClientRect = () => ({
        width: 800,
        height: 200,
        left: 0,
        top: 0,
        right: 800,
        bottom: 200
      });

      renderer.recalculate(intervals);

      const bar = renderer.getBar(1);
      const cellWidth = 800 / 8;
      expect(bar.style.width).toBe(`${2 * cellWidth}px`);
    });
  });

  describe('DEFAULT_INTERVAL_BAR_STYLES', () => {
    test('contains expected CSS classes', () => {
      expect(DEFAULT_INTERVAL_BAR_STYLES).toContain('.it-bars-layer');
      expect(DEFAULT_INTERVAL_BAR_STYLES).toContain('.it-bar');
      expect(DEFAULT_INTERVAL_BAR_STYLES).toContain('.it-bar--rest');
      expect(DEFAULT_INTERVAL_BAR_STYLES).toContain('.it-bar--highlight');
      expect(DEFAULT_INTERVAL_BAR_STYLES).toContain('.it-bar__label');
    });

    test('contains CSS custom properties', () => {
      expect(DEFAULT_INTERVAL_BAR_STYLES).toContain('--it-bar-bg');
      expect(DEFAULT_INTERVAL_BAR_STYLES).toContain('--it-bar-border');
    });
  });

  describe('injectIntervalBarStyles', () => {
    test('injects styles into document head', () => {
      injectIntervalBarStyles();

      const style = document.getElementById('interval-bar-styles');
      expect(style).not.toBeNull();
      expect(style.textContent).toContain('.it-bar');
    });

    test('does not duplicate styles on multiple calls', () => {
      injectIntervalBarStyles();
      injectIntervalBarStyles();
      injectIntervalBarStyles();

      const styles = document.querySelectorAll('#interval-bar-styles');
      expect(styles).toHaveLength(1);
    });
  });
});
