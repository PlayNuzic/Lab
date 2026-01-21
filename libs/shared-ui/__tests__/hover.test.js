/** @jest-environment jsdom */
import { attachHover } from '../hover.js';

describe('attachHover', () => {
  let element;

  beforeEach(() => {
    document.body.innerHTML = '';
    element = document.createElement('button');
    element.textContent = 'Test Button';
    document.body.appendChild(element);
    window.__hoversEnabled = true;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    window.__hoversEnabled = undefined;
  });

  test('creates hover tip element in document body', () => {
    attachHover(element, { text: 'Tooltip text' });

    const tip = document.querySelector('.hover-tip');
    expect(tip).not.toBeNull();
    expect(tip.textContent).toBe('Tooltip text');
  });

  test('shows tooltip on mouseenter', () => {
    attachHover(element, { text: 'Hover text' });

    const tip = document.querySelector('.hover-tip');
    element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    expect(tip.classList.contains('show')).toBe(true);
  });

  test('hides tooltip on mouseleave', () => {
    attachHover(element, { text: 'Hover text' });

    const tip = document.querySelector('.hover-tip');
    element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));

    expect(tip.classList.contains('show')).toBe(false);
  });

  test('respects window.__hoversEnabled flag', () => {
    window.__hoversEnabled = false;
    attachHover(element, { text: 'Hover text' });

    const tip = document.querySelector('.hover-tip');
    element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    expect(tip.classList.contains('show')).toBe(false);
  });

  test('uses data-hover-text attribute if present', () => {
    element.dataset.hoverText = 'Custom text';
    attachHover(element, { text: 'Default text' });

    const tip = document.querySelector('.hover-tip');
    element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    expect(tip.textContent).toBe('Custom text');
  });

  test('applies custom styles', () => {
    attachHover(element, {
      text: 'Styled tooltip',
      color: '#ff0000',
      background: 'blue',
      size: '1rem'
    });

    const tip = document.querySelector('.hover-tip');
    element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    expect(tip.style.color).toBe('rgb(255, 0, 0)');
    expect(tip.style.background).toBe('blue');
    expect(tip.style.fontSize).toBe('1rem');
  });

  test('uses data attributes for styles', () => {
    element.dataset.hoverColor = 'green';
    element.dataset.hoverBackground = 'yellow';
    element.dataset.hoverSize = '2rem';
    attachHover(element, { text: 'Tooltip' });

    const tip = document.querySelector('.hover-tip');
    element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    expect(tip.style.color).toBe('green');
    expect(tip.style.background).toBe('yellow');
    expect(tip.style.fontSize).toBe('2rem');
  });

  test('handles null element gracefully', () => {
    expect(() => attachHover(null)).not.toThrow();
  });

  test('hides tooltip if text is empty', () => {
    attachHover(element, { text: '' });

    const tip = document.querySelector('.hover-tip');
    element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    expect(tip.classList.contains('show')).toBe(false);
  });

  test('positions tooltip relative to element', () => {
    element.getBoundingClientRect = () => ({
      left: 100,
      top: 200,
      width: 50,
      height: 30,
      right: 150,
      bottom: 230
    });

    attachHover(element, { text: 'Positioned tooltip' });

    const tip = document.querySelector('.hover-tip');
    element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    expect(tip.style.left).toBe('125px'); // 100 + 50/2
    expect(tip.style.top).toBe('200px');
  });
});
