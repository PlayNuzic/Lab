/**
 * @jest-environment jsdom
 */

import { createInfoTooltip } from '../info-tooltip.js';

describe('createInfoTooltip', () => {
  let tooltip;
  let anchor;

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = '';
    anchor = document.createElement('button');
    anchor.textContent = 'Hover me';
    document.body.appendChild(anchor);

    // Position anchor element (manual mock)
    anchor.getBoundingClientRect = () => ({
      left: 100,
      top: 50,
      right: 200,
      bottom: 80,
      width: 100,
      height: 30
    });

    tooltip = createInfoTooltip({
      className: 'test-tooltip'
    });
  });

  afterEach(() => {
    if (tooltip && tooltip.destroy) {
      tooltip.destroy();
    }
  });

  describe('initialization', () => {
    it('should create tooltip controller', () => {
      expect(tooltip).toBeDefined();
      expect(tooltip.show).toBeInstanceOf(Function);
      expect(tooltip.hide).toBeInstanceOf(Function);
      expect(tooltip.destroy).toBeInstanceOf(Function);
    });

    it('should not create element until show() is called', () => {
      expect(tooltip.getElement()).toBeNull();
    });
  });

  describe('show()', () => {
    it('should create and show tooltip with string content', () => {
      tooltip.show('Test content', anchor);

      const element = tooltip.getElement();
      expect(element).not.toBeNull();
      expect(element.textContent).toBe('Test content');
      expect(element.classList.contains('show')).toBe(true);
      expect(element.classList.contains('test-tooltip')).toBe(true);
    });

    it('should position tooltip below anchor, centered horizontally', () => {
      tooltip.show('Test', anchor);

      const element = tooltip.getElement();
      // left = anchorLeft + anchorWidth/2 = 100 + 50 = 150px
      expect(element.style.left).toBe('150px');
      // top = anchorBottom + scrollY = 80 + 0 = 80px
      expect(element.style.top).toBe('80px');
    });

    it('should append element to body', () => {
      tooltip.show('Test', anchor);

      const element = tooltip.getElement();
      expect(element.parentNode).toBe(document.body);
    });

    it('should accept DocumentFragment content', () => {
      const fragment = document.createDocumentFragment();
      const p = document.createElement('p');
      p.textContent = 'Fragment content';
      fragment.appendChild(p);

      tooltip.show(fragment, anchor);

      const element = tooltip.getElement();
      expect(element.querySelector('p')).not.toBeNull();
      expect(element.textContent).toBe('Fragment content');
    });

    it('should accept HTMLElement content', () => {
      const div = document.createElement('div');
      div.innerHTML = '<strong>Bold</strong> text';

      tooltip.show(div, anchor);

      const element = tooltip.getElement();
      expect(element.querySelector('strong')).not.toBeNull();
    });

    it('should not show if anchor is missing', () => {
      tooltip.show('Test', null);

      expect(tooltip.getElement()).toBeNull();
    });
  });

  describe('hide()', () => {
    it('should remove show class', () => {
      tooltip.show('Test', anchor);
      const element = tooltip.getElement();

      expect(element.classList.contains('show')).toBe(true);

      tooltip.hide();

      expect(element.classList.contains('show')).toBe(false);
    });
  });

  describe('destroy()', () => {
    it('should remove element from DOM', () => {
      tooltip.show('Test', anchor);
      const element = tooltip.getElement();

      expect(element.parentNode).toBe(document.body);

      tooltip.destroy();

      expect(element.parentNode).toBeNull();
      expect(tooltip.getElement()).toBeNull();
    });
  });

  describe('auto-hide behavior', () => {
    it('should allow disabling auto-hide on scroll', () => {
      const customTooltip = createInfoTooltip({
        autoHideOnScroll: false
      });

      customTooltip.show('Test', anchor);

      // Simple test: tooltip created successfully
      expect(customTooltip.getElement()).not.toBeNull();

      customTooltip.destroy();
    });

    it('should allow disabling auto-hide on resize', () => {
      const customTooltip = createInfoTooltip({
        autoHideOnResize: false
      });

      customTooltip.show('Test', anchor);

      // Simple test: tooltip created successfully
      expect(customTooltip.getElement()).not.toBeNull();

      customTooltip.destroy();
    });
  });

  describe('integration scenarios', () => {
    it('should handle showing multiple times', () => {
      tooltip.show('First', anchor);
      expect(tooltip.getElement().textContent).toBe('First');

      tooltip.show('Second', anchor);
      expect(tooltip.getElement().textContent).toBe('Second');
    });

    it('should handle hide before show', () => {
      tooltip.hide();
      // Should not crash
      expect(tooltip.getElement()).toBeNull();
    });

    it('should handle multiple destroy calls', () => {
      tooltip.show('Test', anchor);
      tooltip.destroy();
      tooltip.destroy(); // Should not crash
      expect(tooltip.getElement()).toBeNull();
    });
  });
});
