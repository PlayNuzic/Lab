/**
 * @jest-environment jsdom
 */
// libs/soundlines/__tests__/highlight-system.test.js
// Tests per al sistema de highlights de soundlines

import { jest } from '@jest/globals';
import { createHighlightManager } from '../highlight-system.js';

// Mock de soundline API
function createMockSoundline() {
  const element = document.createElement('div');
  element.className = 'soundline-container';

  // Afegir números simulats (0-11)
  for (let i = 0; i < 12; i++) {
    const num = document.createElement('div');
    num.className = 'soundline-number';
    num.dataset.note = i;
    num.textContent = i;
    element.appendChild(num);
  }

  return {
    element,
    getNotePosition: (noteIndex) => {
      // Simula posició vertical (0 = bottom, 11 = top)
      return ((11 - noteIndex) / 11) * 100;
    }
  };
}

// Mock de SVG per connexions
function createMockConnectionSvg() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'connection-lines'); // SVG elements usen setAttribute per className

  // Afegir línies simulades
  const semitones = [0, 2, 4, 5, 7, 9, 11]; // Escala Major
  semitones.forEach(semitone => {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('class', 'connection-line');
    line.setAttribute('data-semitone', semitone);
    svg.appendChild(line);
  });

  return svg;
}

describe('createHighlightManager', () => {
  let manager;
  let soundline;
  let connectionSvg;

  beforeEach(() => {
    soundline = createMockSoundline();
    connectionSvg = createMockConnectionSvg();
    manager = createHighlightManager({ connectionSvg });
    document.body.appendChild(soundline.element);
    document.body.appendChild(connectionSvg);
  });

  afterEach(() => {
    if (manager) {
      manager.clearAllHighlights();
    }
    if (soundline?.element?.parentNode) {
      soundline.element.remove();
    }
    if (connectionSvg?.parentNode) {
      connectionSvg.remove();
    }
    jest.clearAllTimers();
  });

  describe('highlightNote', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('crea element highlight amb classe active', () => {
      manager.highlightNote(soundline, 5, 500, 'test');

      const highlight = soundline.element.querySelector('.note-highlight.active');
      expect(highlight).not.toBeNull();
      expect(highlight.dataset.note).toBe('5');
    });

    test('elimina highlight després de la duració', () => {
      manager.highlightNote(soundline, 5, 500, 'test');

      // Avançar temps
      jest.advanceTimersByTime(500);

      const highlight = soundline.element.querySelector('.note-highlight.active');
      expect(highlight).toBeNull();
    });

    test('gestiona múltiples highlights amb claus diferents', () => {
      manager.highlightNote(soundline, 5, 500, 'chromatic');
      manager.highlightNote(soundline, 7, 500, 'scale');

      const highlights = soundline.element.querySelectorAll('.note-highlight.active');
      expect(highlights.length).toBe(2);
    });

    test('reemplaça highlight existent amb mateixa clau i nota', () => {
      manager.highlightNote(soundline, 5, 500, 'test');
      manager.highlightNote(soundline, 5, 800, 'test'); // Mateix key i nota

      const highlights = soundline.element.querySelectorAll('.note-highlight.active');
      expect(highlights.length).toBe(1);
    });

    test('posiciona highlight segons getNotePosition', () => {
      manager.highlightNote(soundline, 0, 500, 'test');

      const highlight = soundline.element.querySelector('.note-highlight');
      expect(highlight.style.top).toBe('100%'); // nota 0 = bottom
    });
  });

  describe('highlightConnectionLine', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('afegeix classe active a la línia', () => {
      manager.highlightConnectionLine(5, 500);

      const line = connectionSvg.querySelector('[data-semitone="5"]');
      expect(line.classList.contains('active')).toBe(true);
    });

    test('elimina classe active després de duració', () => {
      manager.highlightConnectionLine(5, 500);

      jest.advanceTimersByTime(500);

      const line = connectionSvg.querySelector('[data-semitone="5"]');
      expect(line.classList.contains('active')).toBe(false);
    });

    test('no falla si no hi ha línia per al semitono', () => {
      expect(() => {
        manager.highlightConnectionLine(3, 500); // 3 no existeix a l'escala Major
      }).not.toThrow();
    });

    test('no falla sense connectionSvg', () => {
      const managerNoSvg = createHighlightManager({});

      expect(() => {
        managerNoSvg.highlightConnectionLine(5, 500);
      }).not.toThrow();
    });
  });

  describe('clearAllHighlights', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('elimina tots els highlights de notes', () => {
      manager.highlightNote(soundline, 0, 1000, 'a');
      manager.highlightNote(soundline, 5, 1000, 'b');
      manager.highlightNote(soundline, 11, 1000, 'c');

      manager.clearAllHighlights();

      const highlights = soundline.element.querySelectorAll('.note-highlight');
      expect(highlights.length).toBe(0);
    });

    test('elimina classe active de línies de connexió', () => {
      manager.highlightConnectionLine(0, 1000);
      manager.highlightConnectionLine(5, 1000);

      manager.clearAllHighlights();

      const activeLines = connectionSvg.querySelectorAll('.connection-line.active');
      expect(activeLines.length).toBe(0);
    });

    test('buida el map activeHighlights', () => {
      manager.highlightNote(soundline, 5, 1000, 'test');
      expect(manager.activeHighlights.size).toBe(1);

      manager.clearAllHighlights();
      expect(manager.activeHighlights.size).toBe(0);
    });
  });

  describe('applyHighlightColors', () => {
    test('afegeix classe highlighted a notes especificades', () => {
      const notesToHighlight = [0, 4, 7]; // Tríada Major

      manager.applyHighlightColors(soundline.element, notesToHighlight);

      const highlighted = soundline.element.querySelectorAll('.soundline-number.highlighted');
      expect(highlighted.length).toBe(3);

      highlighted.forEach(num => {
        expect(notesToHighlight).toContain(parseInt(num.dataset.note));
      });
    });

    test('elimina classe highlighted de notes no especificades', () => {
      // Primer destacar totes
      soundline.element.querySelectorAll('.soundline-number').forEach(num => {
        num.classList.add('highlighted');
      });

      // Després només algunes
      manager.applyHighlightColors(soundline.element, [0, 4]);

      const highlighted = soundline.element.querySelectorAll('.soundline-number.highlighted');
      expect(highlighted.length).toBe(2);
    });
  });

  describe('applyHighlightColorsAll', () => {
    test('afegeix classe highlighted a totes les notes', () => {
      manager.applyHighlightColorsAll(soundline.element);

      const highlighted = soundline.element.querySelectorAll('.soundline-number.highlighted');
      expect(highlighted.length).toBe(12);
    });
  });

  describe('updateChromaticHighlights', () => {
    test('destaca notes transposades correctament', () => {
      const transposedNotes = [2, 4, 6, 7, 9, 11, 1]; // Major des de D (2)
      const outputNote = 2;

      manager.updateChromaticHighlights(soundline, transposedNotes, outputNote);

      // Verificar que les notes correctes estan destacades
      const highlighted = soundline.element.querySelectorAll('.soundline-number.highlighted');
      expect(highlighted.length).toBe(7);
    });

    test('calcula displayedNote correctament amb rotació', () => {
      // Si outputNote = 5, noteIndex 0 mostra nota 5
      const transposedNotes = [5, 7, 9, 10, 0, 2, 4]; // Major des de F (5)
      const outputNote = 5;

      manager.updateChromaticHighlights(soundline, transposedNotes, outputNote);

      // noteIndex 0 mostra nota 5, que està a transposedNotes → highlighted
      const num0 = soundline.element.querySelector('[data-note="0"]');
      expect(num0.classList.contains('highlighted')).toBe(true);
    });
  });

  describe('activeHighlights getter', () => {
    test('retorna el Map intern', () => {
      expect(manager.activeHighlights).toBeInstanceOf(Map);
    });
  });
});
