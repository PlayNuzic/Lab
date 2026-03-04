/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';
import { renderNoteBars, wouldOverlap, removeOverlappingNotes } from '../plano-note-renderer.js';

describe('plano-note-renderer', () => {
  describe('wouldOverlap', () => {
    const notes = [
      { startSubdiv: 0, duration: 3, note: 5 },
      { startSubdiv: 5, duration: 2, note: 7 }
    ];

    it('returns true when new note overlaps existing', () => {
      expect(wouldOverlap(notes, { startSubdiv: 2, duration: 2 })).toBe(true);
    });

    it('returns true when new note overlaps second existing', () => {
      expect(wouldOverlap(notes, { startSubdiv: 4, duration: 3 })).toBe(true);
    });

    it('returns false when no overlap', () => {
      expect(wouldOverlap(notes, { startSubdiv: 3, duration: 2 })).toBe(false);
    });

    it('returns false for empty notes array', () => {
      expect(wouldOverlap([], { startSubdiv: 0, duration: 5 })).toBe(false);
    });

    it('returns false when note is exactly adjacent', () => {
      expect(wouldOverlap(notes, { startSubdiv: 3, duration: 2 })).toBe(false);
      expect(wouldOverlap(notes, { startSubdiv: 7, duration: 1 })).toBe(false);
    });

    it('overlap check ignores note row (monophonic)', () => {
      expect(wouldOverlap(notes, { startSubdiv: 1, duration: 1, note: 99 })).toBe(true);
    });
  });

  describe('removeOverlappingNotes', () => {
    const notes = [
      { startSubdiv: 0, duration: 3, note: 5 },
      { startSubdiv: 5, duration: 2, note: 7 },
      { startSubdiv: 8, duration: 1, note: 3 }
    ];

    it('removes notes that overlap with the given range', () => {
      const result = removeOverlappingNotes(notes, 4, 4);
      expect(result).toHaveLength(2);
      expect(result[0].startSubdiv).toBe(0);
      expect(result[1].startSubdiv).toBe(8);
    });

    it('keeps all notes when no overlap', () => {
      const result = removeOverlappingNotes(notes, 3, 2);
      expect(result).toHaveLength(3);
    });

    it('removes all notes when range covers everything', () => {
      const result = removeOverlappingNotes(notes, 0, 20);
      expect(result).toHaveLength(0);
    });

    it('returns new array (does not mutate original)', () => {
      const result = removeOverlappingNotes(notes, 0, 20);
      expect(notes).toHaveLength(3);
      expect(result).toHaveLength(0);
    });
  });

  describe('renderNoteBars', () => {
    let matrixContainer;

    beforeEach(() => {
      matrixContainer = document.createElement('div');
      const matrix = document.createElement('div');
      matrix.className = 'plano-matrix';
      matrixContainer.appendChild(matrix);
    });

    it('renders note bars into the matrix', () => {
      const notes = [
        { startSubdiv: 0, duration: 2, note: 5 },
        { startSubdiv: 4, duration: 3, note: 8 }
      ];

      renderNoteBars({ matrixContainer, notes, cellWidth: 20 });

      const bars = matrixContainer.querySelectorAll('.note-bar');
      expect(bars).toHaveLength(2);
    });

    it('clears existing bars before rendering', () => {
      const notes = [{ startSubdiv: 0, duration: 1, note: 0 }];

      renderNoteBars({ matrixContainer, notes, cellWidth: 20 });
      renderNoteBars({ matrixContainer, notes, cellWidth: 20 });

      const bars = matrixContainer.querySelectorAll('.note-bar');
      expect(bars).toHaveLength(1);
    });

    it('does nothing with empty notes', () => {
      renderNoteBars({ matrixContainer, notes: [], cellWidth: 20 });
      const bars = matrixContainer.querySelectorAll('.note-bar');
      expect(bars).toHaveLength(0);
    });

    it('positions bars correctly', () => {
      const notes = [{ startSubdiv: 3, duration: 2, note: 5 }];
      renderNoteBars({ matrixContainer, notes, cellWidth: 10, noteCount: 12, cellHeight: 32 });

      const bar = matrixContainer.querySelector('.note-bar');
      expect(bar.style.left).toBe('30px');
      expect(bar.style.width).toBe('20px');
    });

    it('calls onClickNote callback when bar is clicked', () => {
      const onClickNote = jest.fn();
      const notes = [{ startSubdiv: 0, duration: 1, note: 0 }];

      renderNoteBars({ matrixContainer, notes, cellWidth: 20, onClickNote });

      const bar = matrixContainer.querySelector('.note-bar');
      bar.click();
      expect(onClickNote).toHaveBeenCalledWith(0);
    });

    it('adds label with duration', () => {
      const notes = [{ startSubdiv: 0, duration: 5, note: 0 }];
      renderNoteBars({ matrixContainer, notes, cellWidth: 20 });

      const label = matrixContainer.querySelector('.note-bar__label');
      expect(label.textContent).toBe('5');
    });

    it('adds silence class for rest notes', () => {
      const notes = [{ startSubdiv: 0, duration: 2, note: 0, isRest: true }];
      renderNoteBars({ matrixContainer, notes, cellWidth: 20 });

      const bar = matrixContainer.querySelector('.note-bar');
      expect(bar.classList.contains('note-bar--silence')).toBe(true);
    });

    it('does nothing if matrixContainer is null', () => {
      expect(() => {
        renderNoteBars({ matrixContainer: null, notes: [{ startSubdiv: 0, duration: 1, note: 0 }], cellWidth: 20 });
      }).not.toThrow();
    });
  });
});
