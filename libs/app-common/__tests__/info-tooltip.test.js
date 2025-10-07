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

    // Position anchor element
    anchor.getBoundingClientRect = jest.fn(() => ({
      left: 100,
      top: 50,
      right: 200,
      bottom: 80,
      width: 100,
      height: 30
    }));

    tooltip = createInfoTooltip({
      className: 'test-tooltip'
    });
  });

  afterEach(() => {
    tooltip.destroy();
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

    it('should remove auto-hide event listeners', () => {
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');

      tooltip.show('Test', anchor);
      tooltip.hide();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));

      removeEventListenerSpy.mockRestore();
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

    it('should clean up event listeners', () => {
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');

      tooltip.show('Test', anchor);
      tooltip.destroy();

      expect(removeEventListenerSpy).toHaveBeenCalled();

      removeEventListenerSpy.mockRestore();
    });
  });

  describe('auto-hide behavior', () => {
    it('should add scroll and resize listeners when shown', () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener');

      tooltip.show('Test', anchor);

      expect(addEventListenerSpy).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true });
      expect(addEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));

      addEventListenerSpy.mockRestore();
    });

    it('should allow disabling auto-hide on scroll', () => {
      const customTooltip = createInfoTooltip({
        autoHideOnScroll: false
      });
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener');

      customTooltip.show('Test', anchor);

      const scrollCalls = addEventListenerSpy.mock.calls.filter(
        call => call[0] === 'scroll'
      );
      expect(scrollCalls.length).toBe(0);

      addEventListenerSpy.mockRestore();
      customTooltip.destroy();
    });

    it('should allow disabling auto-hide on resize', () => {
      const customTooltip = createInfoTooltip({
        autoHideOnResize: false
      });
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener');

      customTooltip.show('Test', anchor);

      const resizeCalls = addEventListenerSpy.mock.calls.filter(
        call => call[0] === 'resize'
      );
      expect(resizeCalls.length).toBe(0);

      addEventListenerSpy.mockRestore();
      customTooltip.destroy();
    });
  });
});
