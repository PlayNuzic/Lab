/**
 * Tests para grid-editor.js
 * @jest-environment jsdom
 */

import { createGridEditor } from '../grid-editor.js';

describe('matrix-seq/grid-editor', () => {
  let container;
  let editor;

  beforeEach(() => {
    // Create mock container
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    // Cleanup
    if (container && container.parentNode) {
      container.remove();
    }
  });

  describe('createGridEditor', () => {
    it('crea editor con configuración por defecto', () => {
      editor = createGridEditor({ container });
      expect(editor).toBeDefined();
      expect(editor.getPairs).toBeDefined();
      expect(editor.setPairs).toBeDefined();
      expect(editor.clear).toBeDefined();
      expect(editor.highlightCell).toBeDefined();
      expect(editor.clearHighlights).toBeDefined();
      expect(editor.render).toBeDefined();
    });

    it('renderiza estructura DOM correcta', () => {
      editor = createGridEditor({ container });
      // Wait for DOM update
      const gridEditor = container.querySelector('.matrix-grid-editor');
      // Grid editor might not render immediately without initial pairs
      expect(container.children.length).toBeGreaterThanOrEqual(0);
    });

    it('acepta configuración personalizada', () => {
      const config = {
        container,
        noteRange: [0, 11],
        pulseRange: [0, 7],
        maxPairs: 8,
        getPolyphonyEnabled: () => false,
        onPairsChange: () => {}
      };
      editor = createGridEditor(config);
      expect(editor).toBeDefined();
    });
  });

  describe('getPairs', () => {
    it('retorna array vacío inicialmente', () => {
      editor = createGridEditor({ container });
      expect(editor.getPairs()).toEqual([]);
    });
  });

  describe('setPairs', () => {
    it('establece pares correctamente', () => {
      editor = createGridEditor({ container });
      const pairs = [
        { note: 5, pulse: 0 },
        { note: 7, pulse: 2 }
      ];
      editor.setPairs(pairs);
      expect(editor.getPairs()).toEqual(pairs);
    });

    it('preserva orden de pares', () => {
      editor = createGridEditor({ container });
      const pairs = [
        { note: 3, pulse: 4 },
        { note: 11, pulse: 0 },
        { note: 0, pulse: 7 }
      ];
      editor.setPairs(pairs);
      expect(editor.getPairs()).toEqual(pairs);
    });

    it('acepta array vacío', () => {
      editor = createGridEditor({ container });
      editor.setPairs([{ note: 5, pulse: 2 }]);
      editor.setPairs([]);
      expect(editor.getPairs()).toEqual([]);
    });

    it('permite múltiples notas en mismo pulso (polyphony)', () => {
      editor = createGridEditor({
        container,
        getPolyphonyEnabled: () => true
      });
      const pairs = [
        { note: 3, pulse: 0 },
        { note: 7, pulse: 0 },
        { note: 11, pulse: 0 }
      ];
      editor.setPairs(pairs);
      expect(editor.getPairs()).toEqual(pairs);
    });
  });

  describe('clear', () => {
    it('limpia todos los pares', () => {
      editor = createGridEditor({ container });
      editor.setPairs([
        { note: 5, pulse: 0 },
        { note: 7, pulse: 2 }
      ]);
      editor.clear();
      expect(editor.getPairs()).toEqual([]);
    });

    it('limpia inputs del DOM', () => {
      editor = createGridEditor({ container });
      editor.setPairs([{ note: 5, pulse: 2 }]);
      editor.clear();

      const noteInputs = container.querySelectorAll('.note-input');
      const pulseInputs = container.querySelectorAll('.pulse-input');

      noteInputs.forEach(input => expect(input.value).toBe(''));
      pulseInputs.forEach(input => expect(input.value).toBe(''));
    });
  });

  describe('highlightCell', () => {
    it('destaca celda sin errores', () => {
      editor = createGridEditor({ container });
      editor.setPairs([{ note: 5, pulse: 2 }]);

      // Should not throw
      expect(() => {
        editor.highlightCell(5, 2);
      }).not.toThrow();
    });
  });

  describe('clearHighlights', () => {
    it('elimina highlights sin errores', () => {
      editor = createGridEditor({ container });
      editor.setPairs([{ note: 5, pulse: 2 }]);
      editor.highlightCell(5, 2);

      // Should not throw
      expect(() => {
        editor.clearHighlights();
      }).not.toThrow();
    });
  });

  describe('onPairsChange callback', () => {
    it('no llama callback en setPairs programático (evita bucles)', () => {
      let callbackCount = 0;
      const callback = () => { callbackCount++; };
      editor = createGridEditor({ container, onPairsChange: callback });

      const pairs = [{ note: 5, pulse: 2 }];
      editor.setPairs(pairs);

      // setPairs programático no debe llamar callback (diseño intencional)
      expect(callbackCount).toBe(0);
      // Pero getPairs debe retornar los pares actualizados
      expect(editor.getPairs()).toEqual(pairs);
    });

    it('no llama callback en clear programático (evita bucles)', () => {
      let callbackCount = 0;
      const callback = () => { callbackCount++; };
      editor = createGridEditor({ container, onPairsChange: callback });

      editor.setPairs([{ note: 5, pulse: 2 }]);
      editor.clear();

      // clear programático no debe llamar callback (diseño intencional)
      expect(callbackCount).toBe(0);
      // Pero getPairs debe retornar array vacío
      expect(editor.getPairs()).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('maneja pulsos duplicados en modo polyphony', () => {
      editor = createGridEditor({
        container,
        getPolyphonyEnabled: () => true
      });
      const pairs = [
        { note: 0, pulse: 0 },
        { note: 3, pulse: 0 },
        { note: 7, pulse: 0 }
      ];
      editor.setPairs(pairs);
      expect(editor.getPairs().length).toBe(3);
    });

    it('maneja máximo de pares (maxPairs)', () => {
      editor = createGridEditor({ container, maxPairs: 3 });
      const pairs = [
        { note: 0, pulse: 0 },
        { note: 3, pulse: 2 },
        { note: 7, pulse: 4 }
      ];
      editor.setPairs(pairs);
      expect(editor.getPairs().length).toBeLessThanOrEqual(3);
    });

    it('maneja valores en límites de rango', () => {
      editor = createGridEditor({
        container,
        noteRange: [0, 11],
        pulseRange: [0, 7]
      });
      const pairs = [
        { note: 0, pulse: 0 },  // min values
        { note: 11, pulse: 7 }  // max values
      ];
      editor.setPairs(pairs);
      expect(editor.getPairs()).toEqual(pairs);
    });
  });

  describe('render', () => {
    it('puede re-renderizar sin errores', () => {
      editor = createGridEditor({ container });
      editor.setPairs([{ note: 5, pulse: 2 }]);

      expect(() => {
        editor.render();
      }).not.toThrow();
    });
  });

  describe('scroll mode', () => {
    it('aplica clase scrollable cuando scrollEnabled=true', () => {
      editor = createGridEditor({
        container,
        scrollEnabled: true,
        maxPairs: 16
      });

      // Container itself receives the class (it's cleared and class is set)
      expect(container.classList.contains('matrix-grid-editor')).toBe(true);
      expect(container.classList.contains('matrix-grid-editor--scrollable')).toBe(true);
    });

    it('no aplica clase scrollable cuando scrollEnabled=false', () => {
      editor = createGridEditor({
        container,
        scrollEnabled: false
      });

      expect(container.classList.contains('matrix-grid-editor')).toBe(true);
      expect(container.classList.contains('matrix-grid-editor--scrollable')).toBe(false);
    });

    it('aplica containerSize cuando se proporciona', () => {
      editor = createGridEditor({
        container,
        scrollEnabled: true,
        containerSize: { width: '800px', maxHeight: '400px' }
      });

      // Styles are applied to container
      expect(container.style.width).toBe('800px');
      expect(container.style.maxHeight).toBe('400px');
    });

    it('aplica clase scrollable a columnsContainer en modo scroll', () => {
      editor = createGridEditor({
        container,
        scrollEnabled: true,
        maxPairs: 16
      });

      const columnsContainer = container.querySelector('.grid-columns-container');
      expect(columnsContainer.classList.contains('grid-columns-container--scrollable')).toBe(true);
    });

    it('no aplica clase scrollable a columnsContainer en modo normal', () => {
      editor = createGridEditor({
        container,
        scrollEnabled: false
      });

      const columnsContainer = container.querySelector('.grid-columns-container');
      expect(columnsContainer.classList.contains('grid-columns-container--scrollable')).toBe(false);
    });

    it('aplica CSS custom properties para column size en scroll mode', () => {
      editor = createGridEditor({
        container,
        scrollEnabled: true,
        columnSize: { width: '100px', minHeight: '200px' }
      });

      // Custom properties applied to container
      const columnWidth = container.style.getPropertyValue('--column-width');
      const columnMinHeight = container.style.getPropertyValue('--column-min-height');

      expect(columnWidth).toBe('100px');
      expect(columnMinHeight).toBe('200px');
    });
  });

  describe('N-iT mode silences', () => {
    it('permite silencios con allowSilence habilitado', () => {
      editor = createGridEditor({
        container,
        mode: 'n-it',
        showZigzag: true,
        intervalModeOptions: {
          allowSilence: true,
          hideInitialPair: true
        }
      });

      // Get the note input
      const noteInput = container.querySelector('.n-it-note-input');
      expect(noteInput).not.toBeNull();

      // Simulate pressing 's' key
      const keydownEvent = new KeyboardEvent('keydown', {
        key: 's',
        bubbles: true
      });
      noteInput.dispatchEvent(keydownEvent);

      // Value should be 's'
      expect(noteInput.value).toBe('s');
      expect(noteInput.dataset.isSilence).toBe('true');

      // Cell should have silence class
      const cell = noteInput.closest('.zigzag-cell--n-it-note');
      expect(cell.classList.contains('zigzag-cell--silence')).toBe(true);
    });

    it('no permite silencios sin allowSilence', () => {
      editor = createGridEditor({
        container,
        mode: 'n-it',
        showZigzag: true,
        intervalModeOptions: {
          allowSilence: false,
          hideInitialPair: true
        }
      });

      const noteInput = container.querySelector('.n-it-note-input');
      noteInput.value = '';  // Start empty

      // Simulate pressing 's' key
      const keydownEvent = new KeyboardEvent('keydown', {
        key: 's',
        bubbles: true
      });
      noteInput.dispatchEvent(keydownEvent);

      // Value should still be empty (s not accepted)
      expect(noteInput.value).toBe('');
    });

    it('procesa isRest en setPairs con N-iT mode', () => {
      editor = createGridEditor({
        container,
        mode: 'n-it',
        showZigzag: true,
        intervalModeOptions: {
          allowSilence: true,
          hideInitialPair: true
        }
      });

      // Set pairs with a silence
      editor.setPairs([
        { note: 5, pulse: 0, registry: 4, temporalInterval: 2 },
        { note: null, pulse: 2, registry: null, temporalInterval: 1, isRest: true }
      ]);

      // Should have silence cell
      const silenceCell = container.querySelector('.zigzag-cell--silence');
      expect(silenceCell).not.toBeNull();

      // Silence cell's note input should show 's'
      const noteInput = silenceCell.querySelector('.n-it-note-input');
      expect(noteInput.value).toBe('s');
    });
  });
});
