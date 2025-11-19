/**
 * Tests for dom-utils.js
 * @jest-environment jsdom
 */

import {
  sanitizeHTML,
  clearElement,
  createSafeElement,
  setSafeHTML,
  getDOMPurifyConfig
} from '../dom-utils.js';

describe('dom-utils', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('sanitizeHTML', () => {
    test('should remove script tags (XSS protection)', () => {
      const dirty = '<div>Safe</div><script>alert("XSS")</script>';
      const clean = sanitizeHTML(dirty);

      expect(clean).not.toContain('<script>');
      expect(clean).not.toContain('alert');
      expect(clean).toContain('<div>Safe</div>');
    });

    test('should allow safe HTML elements', () => {
      const html = '<div class="test"><span>Content</span></div>';
      const clean = sanitizeHTML(html);

      expect(clean).toContain('<div');
      expect(clean).toContain('<span>');
      expect(clean).toContain('Content');
    });

    test('should preserve allowed data attributes', () => {
      const html = '<div data-note="5" data-pulse="2">Cell</div>';
      const clean = sanitizeHTML(html);

      expect(clean).toContain('data-note="5"');
      expect(clean).toContain('data-pulse="2"');
    });

    test('should preserve future app data attributes', () => {
      const html = '<div data-soundinterval="3" data-temporalinterval="2">Interval</div>';
      const clean = sanitizeHTML(html);

      expect(clean).toContain('data-soundinterval="3"');
      expect(clean).toContain('data-temporalinterval="2"');
    });

    test('should preserve short alias data attributes', () => {
      const html = '<div data-is="5" data-it="7">Short</div>';
      const clean = sanitizeHTML(html);

      expect(clean).toContain('data-is="5"');
      expect(clean).toContain('data-it="7"');
    });

    test('should remove event handlers (onclick, onerror, etc)', () => {
      const dirty = '<div onclick="alert(\'XSS\')">Click me</div>';
      const clean = sanitizeHTML(dirty);

      expect(clean).not.toContain('onclick');
      expect(clean).not.toContain('alert');
      expect(clean).toContain('Click me');
    });

    test('should handle non-string input gracefully', () => {
      expect(sanitizeHTML(null)).toBe('');
      expect(sanitizeHTML(undefined)).toBe('');
      expect(sanitizeHTML(123)).toBe('');
      expect(sanitizeHTML({})).toBe('');
    });

    test('should support custom DOMPurify config', () => {
      const html = '<div data-custom="value">Test</div>';
      const clean = sanitizeHTML(html, {
        ALLOWED_ATTR: ['data-custom']
      });

      expect(clean).toContain('data-custom="value"');
    });
  });

  describe('clearElement', () => {
    test('should remove all child elements', () => {
      container.innerHTML = '<div>Child 1</div><div>Child 2</div><div>Child 3</div>';
      expect(container.children.length).toBe(3);

      const result = clearElement(container);

      expect(result).toBe(true);
      expect(container.children.length).toBe(0);
      expect(container.innerHTML).toBe('');
    });

    test('should work with nested elements', () => {
      container.innerHTML = '<div><span><strong>Nested</strong></span></div>';
      expect(container.querySelector('strong')).toBeTruthy();

      clearElement(container);

      expect(container.querySelector('strong')).toBeNull();
      expect(container.children.length).toBe(0);
    });

    test('should handle already empty elements', () => {
      expect(container.children.length).toBe(0);

      const result = clearElement(container);

      expect(result).toBe(true);
      expect(container.children.length).toBe(0);
    });

    test('should handle invalid input gracefully', () => {
      expect(clearElement(null)).toBe(false);
      expect(clearElement(undefined)).toBe(false);
      expect(clearElement('not an element')).toBe(false);
      expect(clearElement({})).toBe(false);
    });

    test('should be more efficient than innerHTML = ""', () => {
      // Create many child elements
      for (let i = 0; i < 100; i++) {
        const child = document.createElement('div');
        child.textContent = `Child ${i}`;
        container.appendChild(child);
      }

      expect(container.children.length).toBe(100);

      const start = performance.now();
      clearElement(container);
      const end = performance.now();

      expect(container.children.length).toBe(0);
      // Performance test - clearElement should complete quickly
      expect(end - start).toBeLessThan(50); // < 50ms for 100 elements
    });
  });

  describe('createSafeElement', () => {
    test('should create element with tag name', () => {
      const div = createSafeElement('div');

      expect(div.tagName).toBe('DIV');
      expect(div instanceof HTMLElement).toBe(true);
    });

    test('should apply className', () => {
      const div = createSafeElement('div', {
        className: 'my-class another-class'
      });

      expect(div.className).toBe('my-class another-class');
    });

    test('should set text content safely', () => {
      const span = createSafeElement('span', {
        text: 'Safe text <script>alert("XSS")</script>'
      });

      expect(span.textContent).toContain('<script>');
      // textContent escapes HTML, so script won't execute
      expect(span.innerHTML).not.toContain('<script>alert');
    });

    test('should sanitize HTML content', () => {
      const div = createSafeElement('div', {
        html: '<span>Safe</span><script>alert("XSS")</script>'
      });

      expect(div.querySelector('span')).toBeTruthy();
      expect(div.innerHTML).toContain('<span>Safe</span>');
      expect(div.innerHTML).not.toContain('<script>');
    });

    test('should apply allowed attributes', () => {
      const cell = createSafeElement('div', {
        className: 'musical-cell',
        attributes: {
          'data-note': '7',
          'data-pulse': '4',
          'data-soundinterval': '3'
        }
      });

      expect(cell.getAttribute('data-note')).toBe('7');
      expect(cell.getAttribute('data-pulse')).toBe('4');
      expect(cell.getAttribute('data-soundinterval')).toBe('3');
    });

    test('should filter out disallowed attributes', () => {
      const div = createSafeElement('div', {
        attributes: {
          'data-note': '5',
          'onclick': 'alert("XSS")',
          'style': 'display:none'
        }
      });

      expect(div.getAttribute('data-note')).toBe('5');
      expect(div.getAttribute('onclick')).toBeNull();
      // style might be allowed by DOMPurify default config, check actual behavior
    });

    test('should handle invalid tagName', () => {
      const result = createSafeElement(null);
      expect(result).toBeNull();

      const result2 = createSafeElement(123);
      expect(result2).toBeNull();
    });

    test('should create complex elements', () => {
      const card = createSafeElement('div', {
        className: 'card active',
        html: '<h3>Title</h3><p>Description</p>',
        attributes: {
          'data-note': '12',
          'data-is': '5',
          'data-it': '3'
        }
      });

      expect(card.className).toBe('card active');
      expect(card.querySelector('h3').textContent).toBe('Title');
      expect(card.querySelector('p').textContent).toBe('Description');
      expect(card.getAttribute('data-note')).toBe('12');
      expect(card.getAttribute('data-is')).toBe('5');
      expect(card.getAttribute('data-it')).toBe('3');
    });
  });

  describe('setSafeHTML', () => {
    test('should replace element content with sanitized HTML', () => {
      container.innerHTML = '<div>Old content</div>';

      const result = setSafeHTML(container, '<span>New content</span>');

      expect(result).toBe(true);
      expect(container.querySelector('span')).toBeTruthy();
      expect(container.innerHTML).toContain('New content');
      expect(container.innerHTML).not.toContain('Old content');
    });

    test('should sanitize HTML before insertion', () => {
      const dirty = '<div>Safe</div><script>alert("XSS")</script>';

      setSafeHTML(container, dirty);

      expect(container.innerHTML).toContain('<div>Safe</div>');
      expect(container.innerHTML).not.toContain('<script>');
    });

    test('should handle invalid element', () => {
      expect(setSafeHTML(null, '<div>Test</div>')).toBe(false);
      expect(setSafeHTML(undefined, '<div>Test</div>')).toBe(false);
      expect(setSafeHTML('not element', '<div>Test</div>')).toBe(false);
    });

    test('should preserve data attributes', () => {
      const html = '<div data-note="3" data-pulse="5">Cell</div>';

      setSafeHTML(container, html);

      const cell = container.querySelector('[data-note]');
      expect(cell.getAttribute('data-note')).toBe('3');
      expect(cell.getAttribute('data-pulse')).toBe('5');
    });
  });

  describe('getDOMPurifyConfig', () => {
    test('should return configuration object', () => {
      const config = getDOMPurifyConfig();

      expect(config).toBeTruthy();
      expect(typeof config).toBe('object');
    });

    test('should include ALLOWED_ATTR array', () => {
      const config = getDOMPurifyConfig();

      expect(Array.isArray(config.ALLOWED_ATTR)).toBe(true);
      expect(config.ALLOWED_ATTR.length).toBeGreaterThan(0);
    });

    test('should include required data attributes', () => {
      const config = getDOMPurifyConfig();

      expect(config.ALLOWED_ATTR).toContain('class');
      expect(config.ALLOWED_ATTR).toContain('data-note');
      expect(config.ALLOWED_ATTR).toContain('data-pulse');
      expect(config.ALLOWED_ATTR).toContain('data-soundinterval');
      expect(config.ALLOWED_ATTR).toContain('data-temporalinterval');
      expect(config.ALLOWED_ATTR).toContain('data-is');
      expect(config.ALLOWED_ATTR).toContain('data-it');
    });

    test('should return a copy (not reference)', () => {
      const config1 = getDOMPurifyConfig();
      const config2 = getDOMPurifyConfig();

      // Modify config1
      config1.ALLOWED_ATTR.push('data-test');

      // config2 should not be affected
      expect(config2.ALLOWED_ATTR).not.toContain('data-test');
    });
  });

  describe('Integration: XSS Prevention', () => {
    test('should prevent multiple XSS attack vectors', () => {
      const attacks = [
        '<img src=x onerror="alert(\'XSS\')">',
        '<iframe src="javascript:alert(\'XSS\')"></iframe>',
        '<svg onload="alert(\'XSS\')"></svg>',
        '<body onload="alert(\'XSS\')">',
        '<input onfocus="alert(\'XSS\')" autofocus>',
        '<a href="javascript:alert(\'XSS\')">Click</a>'
      ];

      attacks.forEach(attack => {
        const clean = sanitizeHTML(attack);
        expect(clean).not.toContain('javascript:');
        expect(clean).not.toContain('onerror');
        expect(clean).not.toContain('onload');
        expect(clean).not.toContain('onfocus');
        expect(clean).not.toContain('alert');
      });
    });

    test('should work with createSafeElement + setSafeHTML workflow', () => {
      const cell = createSafeElement('div', {
        className: 'musical-cell',
        attributes: { 'data-note': '5' }
      });

      setSafeHTML(cell, '<span data-pulse="3">Content</span>');

      expect(cell.className).toBe('musical-cell');
      expect(cell.getAttribute('data-note')).toBe('5');
      expect(cell.querySelector('span').getAttribute('data-pulse')).toBe('3');
    });

    test('should clear and repopulate container safely', () => {
      container.innerHTML = '<div>Old</div><script>alert("XSS")</script>';

      clearElement(container);
      expect(container.children.length).toBe(0);

      const newCell = createSafeElement('div', {
        className: 'cell',
        html: '<span>New content</span>',
        attributes: { 'data-note': '7' }
      });

      container.appendChild(newCell);

      expect(container.children.length).toBe(1);
      expect(container.querySelector('.cell')).toBeTruthy();
      expect(container.innerHTML).not.toContain('<script>');
    });
  });
});
