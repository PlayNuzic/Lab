/**
 * @jest-environment jsdom
 */

import { createFormulaRenderer } from '../formula-renderer.js';

describe('createFormulaRenderer', () => {
  let renderer;

  beforeEach(() => {
    renderer = createFormulaRenderer();
  });

  describe('formatNumber', () => {
    it('should format numbers with ca-ES locale', () => {
      expect(renderer.formatNumber(1234.56)).toBe('1.234,56');
    });

    it('should round to 2 decimal places', () => {
      expect(renderer.formatNumber(1.23456)).toBe('1,23');
    });

    it('should handle integers', () => {
      expect(renderer.formatNumber(42)).toBe('42');
    });

    it('should return empty string for non-finite numbers', () => {
      expect(renderer.formatNumber(NaN)).toBe('');
      expect(renderer.formatNumber(Infinity)).toBe('');
    });
  });

  describe('formatInteger', () => {
    it('should format integers with ca-ES locale', () => {
      expect(renderer.formatInteger(1234)).toBe('1.234');
    });

    it('should round decimals to integers', () => {
      expect(renderer.formatInteger(42.7)).toBe('43');
    });

    it('should return empty string for non-finite numbers', () => {
      expect(renderer.formatInteger(NaN)).toBe('');
    });
  });

  describe('buildFormulaFragment', () => {
    it('should build fragment with Lg value', () => {
      const fragment = renderer.buildFormulaFragment({ lg: 8 });
      const tempDiv = document.createElement('div');
      tempDiv.appendChild(fragment);

      expect(tempDiv.textContent).toContain('Pulsos enteros (Lg):');
      expect(tempDiv.textContent).toContain('8');
    });

    it('should calculate fractional Lg (Lg·d/n)', () => {
      const fragment = renderer.buildFormulaFragment({
        lg: 8,
        numerator: 2,
        denominator: 3
      });
      const tempDiv = document.createElement('div');
      tempDiv.appendChild(fragment);

      expect(tempDiv.textContent).toContain('Pulsos fraccionados (Lg·d/n):');
      // 8 * 3 / 2 = 12
      expect(tempDiv.textContent).toContain('12');
    });

    it('should calculate V base from Lg and T', () => {
      const fragment = renderer.buildFormulaFragment({
        lg: 4,
        t: 2
      });
      const tempDiv = document.createElement('div');
      tempDiv.appendChild(fragment);

      expect(tempDiv.textContent).toContain('V base');
      // (4 / 2) * 60 = 120 BPM
      expect(tempDiv.textContent).toContain('120');
    });

    it('should calculate V fraction from V base and fraction', () => {
      const fragment = renderer.buildFormulaFragment({
        lg: 4,
        tempo: 60,
        numerator: 3,
        denominator: 2
      });
      const tempDiv = document.createElement('div');
      tempDiv.appendChild(fragment);

      expect(tempDiv.textContent).toContain('V 3/2');
      // 60 * (2/3) = 40 BPM
      expect(tempDiv.textContent).toContain('40');
    });

    it('should show hint when Lg is missing', () => {
      const fragment = renderer.buildFormulaFragment({});
      const tempDiv = document.createElement('div');
      tempDiv.appendChild(fragment);

      expect(tempDiv.textContent).toContain('Define una Lg válida');
    });

    it('should show hint when V is missing for formula', () => {
      const fragment = renderer.buildFormulaFragment({ lg: 4 });
      const tempDiv = document.createElement('div');
      tempDiv.appendChild(fragment);

      expect(tempDiv.textContent).toContain('Completa V para calcular');
    });
  });

  describe('custom formatters', () => {
    it('should accept custom formatNumber', () => {
      const customRenderer = createFormulaRenderer({
        formatNumber: (v) => `${v}!!`
      });

      expect(customRenderer.formatNumber(42)).toBe('42!!');
    });

    it('should accept custom formatBpm', () => {
      const customRenderer = createFormulaRenderer({
        formatBpm: (v) => `${v} beats`
      });

      expect(customRenderer.formatBpm(120)).toBe('120 beats');
    });
  });
});
