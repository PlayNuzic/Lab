/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';
import { initConsent, getConsent, resetConsent, CONSENT_KEY } from '../consent.js';

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
  delete window.clarity;
  // El jsdom és compartit entre tests: retira qualsevol script de Clarity
  // injectat per un test anterior perquè no contamini els que esperen "res".
  document.querySelectorAll('script').forEach(s => s.remove());
  // Les pàgines reals ja tenen <script> al DOM quan consent.js s'executa
  // (parallax-lab.js, slides.js...); ho repliquem perquè el snippet oficial
  // de Clarity (insertBefore contra el primer <script>) trobi on inserir-se.
  document.head.appendChild(document.createElement('script'));
});

describe('consent gate', () => {
  test('sense decisió prèvia, mostra el banner i no carrega Clarity', () => {
    initConsent();
    expect(document.querySelector('.consent-banner')).not.toBeNull();
    expect(document.querySelector('script[src*="clarity.ms"]')).toBeNull();
    expect(window.clarity).toBeUndefined();
  });

  test('el banner enllaça a la pàgina de privacitat', () => {
    initConsent();
    const link = document.querySelector('.consent-banner__link');
    expect(link).not.toBeNull();
    expect(link.getAttribute('href')).toBe('privacidad.html');
  });

  test('Acceptar: injecta l\'script de Clarity, crida consentv2 i persisteix la decisió', () => {
    initConsent();
    document.querySelector('.consent-banner__btn--accept').click();

    expect(getConsent()).toBe('granted');
    expect(document.querySelector('script[src*="clarity.ms/tag/xltk7vdfux"]')).not.toBeNull();
    expect(typeof window.clarity).toBe('function');
    const [name, payload] = window.clarity.q[0];
    expect(name).toBe('consentv2');
    expect(payload).toEqual({ ad_Storage: 'granted', analytics_Storage: 'granted' });
    expect(document.querySelector('.consent-banner')).toBeNull();
  });

  test('Rebutjar: no injecta res i persisteix la decisió', () => {
    initConsent();
    document.querySelector('.consent-banner__btn--reject').click();

    expect(getConsent()).toBe('denied');
    expect(document.querySelector('script[src*="clarity.ms"]')).toBeNull();
    expect(window.clarity).toBeUndefined();
    expect(document.querySelector('.consent-banner')).toBeNull();
  });

  test('decisió prèvia "granted": carrega Clarity sense mostrar banner', () => {
    localStorage.setItem(CONSENT_KEY, 'granted');
    initConsent();
    expect(document.querySelector('.consent-banner')).toBeNull();
    expect(document.querySelector('script[src*="clarity.ms"]')).not.toBeNull();
  });

  test('decisió prèvia "denied": no mostra banner ni carrega res', () => {
    localStorage.setItem(CONSENT_KEY, 'denied');
    initConsent();
    expect(document.querySelector('.consent-banner')).toBeNull();
    expect(document.querySelector('script[src*="clarity.ms"]')).toBeNull();
  });

  test('resetConsent esborra la decisió i revoca Clarity si és present', () => {
    localStorage.setItem(CONSENT_KEY, 'granted');
    window.clarity = jest.fn();
    resetConsent();
    expect(getConsent()).toBeNull();
    expect(window.clarity).toHaveBeenCalledWith('consent', false);
  });
});
