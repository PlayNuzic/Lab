/**
 * @jest-environment jsdom
 */
import {
  diarioVisible, diarioUrl, initDiario, PRIMER_PASO_FRED, CODI_DEV,
} from '../diario.js';

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '<a id="btn-diario" href="#" hidden>Diario</a>';
});

const link = () => document.getElementById('btn-diario');

describe('diarioVisible', () => {
  test('sense tester no es veu mai', () => {
    expect(diarioVisible(null, 20)).toBe(false);
  });

  test('amb tester, només a partir del primer paso en fred', () => {
    expect(diarioVisible('P1-01', PRIMER_PASO_FRED - 1)).toBe(false);
    expect(diarioVisible('P1-01', PRIMER_PASO_FRED)).toBe(true);
    expect(diarioVisible('P1-01', 28.5)).toBe(true);
  });

  test('el codi DEV el veu a tots els pasos', () => {
    expect(diarioVisible(CODI_DEV, 1)).toBe(true);
  });
});

describe('diarioUrl', () => {
  test('porta el codi i el paso preomplerts', () => {
    const url = new URL(diarioUrl('P2-01', 12));
    expect(url.searchParams.get('usp')).toBe('pp_url');
    expect(url.searchParams.get('entry.1986705158')).toBe('P2-01');
    expect(url.searchParams.get('entry.1193824495')).toBe('12');
  });

  test('sense paso, només el codi', () => {
    const url = new URL(diarioUrl('P2-01', null));
    expect(url.searchParams.has('entry.1193824495')).toBe(false);
  });
});

describe('initDiario', () => {
  test('sense l\'enllaç a la pàgina no fa res', () => {
    document.body.innerHTML = '';
    expect(initDiario(document)).toBeNull();
  });

  test('tester al paso 11: es mostra amb l\'enllaç al diari', () => {
    localStorage.setItem('sistema.tester', 'P2-01');
    localStorage.setItem('sistema.paso', '11');
    initDiario(document);
    expect(link().hidden).toBe(false);
    expect(link().href).toContain('entry.1986705158=P2-01');
    expect(link().href).toContain('entry.1193824495=11');
  });

  test('segueix el paso a cada render i s\'amaga abans del paso 11', () => {
    localStorage.setItem('sistema.tester', 'P2-01');
    localStorage.setItem('sistema.paso', '12');
    initDiario(document);
    expect(link().href).toContain('entry.1193824495=12');
    localStorage.setItem('sistema.paso', '10');
    document.dispatchEvent(new CustomEvent('sistema:render'));
    expect(link().hidden).toBe(true);
  });

  test('sense tester queda amagat', () => {
    localStorage.setItem('sistema.paso', '20');
    initDiario(document);
    expect(link().hidden).toBe(true);
  });
});
