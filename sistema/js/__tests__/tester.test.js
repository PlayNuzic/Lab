/**
 * @jest-environment jsdom
 */
import { readTester, resumeKey, initResume, PASO_STORAGE_KEY, TESTER_STORAGE_KEY } from '../tester.js';

beforeEach(() => localStorage.clear());

describe('resumeKey', () => {
  test('una clau per codi; sense codi, la general', () => {
    expect(resumeKey('P1-01')).toBe('sistema.paso.P1-01');
    expect(resumeKey(null)).toBe(PASO_STORAGE_KEY);
  });
});

describe('initResume', () => {
  test('un codi nou en un navegador amb el progrés d\'un altre comença pel paso 1', () => {
    localStorage.setItem(TESTER_STORAGE_KEY, 'PP-01');
    localStorage.setItem(PASO_STORAGE_KEY, '11');
    const key = initResume('?tester=P1-02');
    expect(key).toBe('sistema.paso.P1-02');
    expect(localStorage.getItem(key)).toBeNull();
    expect(readTester('')).toBe('P1-02');
  });

  test('el codi que hi havia desat hereta el progrés anterior', () => {
    localStorage.setItem(TESTER_STORAGE_KEY, 'P1-01');
    localStorage.setItem(PASO_STORAGE_KEY, '11');
    const key = initResume('?tester=P1-01');
    expect(localStorage.getItem(key)).toBe('11');
  });

  test('també sense ?tester a l\'URL (codi desat)', () => {
    localStorage.setItem(TESTER_STORAGE_KEY, 'P1-01');
    localStorage.setItem(PASO_STORAGE_KEY, '7');
    const key = initResume('?paso=3');
    expect(key).toBe('sistema.paso.P1-01');
    expect(localStorage.getItem(key)).toBe('7');
  });

  test('no trepitja la clau d\'un codi que ja en té', () => {
    localStorage.setItem(TESTER_STORAGE_KEY, 'P1-01');
    localStorage.setItem(PASO_STORAGE_KEY, '3');
    localStorage.setItem('sistema.paso.P1-01', '9');
    expect(localStorage.getItem(initResume('?tester=P1-01'))).toBe('9');
  });

  test('sense codi, o amb ?tester=off, la clau general', () => {
    expect(initResume('')).toBe(PASO_STORAGE_KEY);
    localStorage.setItem(TESTER_STORAGE_KEY, 'P1-01');
    expect(initResume('?tester=off')).toBe(PASO_STORAGE_KEY);
    expect(localStorage.getItem(TESTER_STORAGE_KEY)).toBeNull();
  });

  test('un codi no vàlid no crea cap clau nova', () => {
    expect(initResume('?tester=<script>')).toBe(PASO_STORAGE_KEY);
  });
});
