/**
 * @jest-environment jsdom
 */
// Guia de navegació — obrir/tancar, focus, Esc, clic a fora i blur.
import { initNavGuide } from '../nav-guide.js';

const MARKUP = `
  <main id="slide-stage"><p id="fora">slide</p></main>
  <button class="sistema-guide-link" id="btn-guia" type="button"
          aria-expanded="false" aria-controls="nav-guide">Cómo navegar</button>
  <div class="nav-guide" id="nav-guide" role="dialog" hidden>
    <button type="button" class="nav-guide__close" aria-label="Cerrar la guía">×</button>
    <p id="dins">contingut</p>
  </div>`;

const pointerdown = (el) => el.dispatchEvent(new Event('pointerdown', { bubbles: true }));
const keydown = (key) => document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));

let api, btn, panel, closeBtn;
beforeEach(() => {
  document.body.innerHTML = MARKUP;
  api = initNavGuide();
  btn = document.getElementById('btn-guia');
  panel = document.getElementById('nav-guide');
  closeBtn = panel.querySelector('.nav-guide__close');
});

describe('guia de navegació', () => {
  test('sense el marcatge no fa res i retorna null', () => {
    document.body.innerHTML = '';
    expect(initNavGuide()).toBeNull();
  });

  test('tancada per defecte; l\'enllaç l\'obre i la torna a tancar amb aria-expanded en sincronia', () => {
    expect(panel.hidden).toBe(true);
    expect(api.isOpen()).toBe(false);
    btn.click();
    expect(panel.hidden).toBe(false);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    btn.click();
    expect(panel.hidden).toBe(true);
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });

  test('en obrir, el focus va al botó ×; en tancar amb ×, torna a l\'enllaç', () => {
    btn.click();
    expect(document.activeElement).toBe(closeBtn);
    closeBtn.click();
    expect(panel.hidden).toBe(true);
    expect(document.activeElement).toBe(btn);
  });

  test('Escape tanca (i no fa res si ja està tancada)', () => {
    api.open();
    keydown('Escape');
    expect(panel.hidden).toBe(true);
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    keydown('Escape');
    expect(panel.hidden).toBe(true);
  });

  test('clic a fora tanca sense robar el focus; clic a dins o a l\'enllaç no tanca', () => {
    api.open();
    pointerdown(document.getElementById('dins'));
    expect(panel.hidden).toBe(false);
    pointerdown(btn);
    expect(panel.hidden).toBe(false);
    pointerdown(document.getElementById('fora'));
    expect(panel.hidden).toBe(true);
    expect(document.activeElement).not.toBe(btn);
  });

  test('perdre el focus amb el punter sobre un iframe (clic dins d\'una app) tanca', () => {
    const iframe = document.createElement('iframe'); document.body.appendChild(iframe);
    api.open();
    iframe.dispatchEvent(new Event('mouseover', { bubbles: true }));
    window.dispatchEvent(new Event('blur'));
    expect(panel.hidden).toBe(true);
  });

  test('perdre el focus sense punter sobre cap iframe (auto-focus d\'una app en carregar) NO tanca', () => {
    api.open();
    document.getElementById('fora').dispatchEvent(new Event('mouseover', { bubbles: true }));
    window.dispatchEvent(new Event('blur'));
    expect(panel.hidden).toBe(false);
  });
});
