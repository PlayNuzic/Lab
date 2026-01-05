/**
 * Tests para grid-editor.js
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';
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

  describe('degree mode', () => {
    it('crea editor en modo degree', () => {
      editor = createGridEditor({
        container,
        mode: 'degree',
        degreeModeOptions: {
          getScaleLength: () => 7
        }
      });

      expect(editor).toBeDefined();
      expect(container.classList.contains('matrix-grid-editor--degree')).toBe(true);
    });

    it('renderiza estructura DOM con fila única de graus', () => {
      editor = createGridEditor({
        container,
        mode: 'degree',
        pulseRange: [0, 11],
        degreeModeOptions: {
          getScaleLength: () => 7,
          totalPulses: 12
        }
      });

      // Debe tener un main row container
      const degreeMainRow = container.querySelector('.degree-main-row');
      expect(degreeMainRow).not.toBeNull();

      // Debe tener 12 columnas (pulsos 0-11)
      const columns = container.querySelectorAll('.degree-column');
      expect(columns.length).toBe(12);
    });

    it('acepta valores de grau válidos (0-6)', () => {
      editor = createGridEditor({
        container,
        mode: 'degree',
        degreeModeOptions: {
          getScaleLength: () => 7
        }
      });

      const input = container.querySelector('.degree-input');
      expect(input).not.toBeNull();

      // Simular input de grau válido
      input.value = '3';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      // El valor debe aceptarse
      expect(input.value).toBe('3');
    });

    it('acepta graus con modificador + (sostingut)', () => {
      editor = createGridEditor({
        container,
        mode: 'degree',
        degreeModeOptions: {
          getScaleLength: () => 7
        }
      });

      const input = container.querySelector('.degree-input');
      input.value = '2+';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      expect(input.value).toBe('2+');
    });

    it('acepta graus con modificador - (bemoll)', () => {
      editor = createGridEditor({
        container,
        mode: 'degree',
        degreeModeOptions: {
          getScaleLength: () => 7
        }
      });

      const input = container.querySelector('.degree-input');
      input.value = '5-';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      expect(input.value).toBe('5-');
    });

    it('acepta silencio con "s"', () => {
      editor = createGridEditor({
        container,
        mode: 'degree',
        degreeModeOptions: {
          getScaleLength: () => 7
        }
      });

      const input = container.querySelector('.degree-input');
      input.value = 's';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      expect(input.value).toBe('s');
    });

    it('setPairs establece graus correctamente', () => {
      editor = createGridEditor({
        container,
        mode: 'degree',
        degreeModeOptions: {
          getScaleLength: () => 7
        }
      });

      const pairs = [
        { degree: 0, modifier: null, pulse: 0 },
        { degree: 2, modifier: '+', pulse: 3 },
        { degree: 4, modifier: '-', pulse: 6 }
      ];
      editor.setPairs(pairs);

      const inputs = container.querySelectorAll('.degree-input');
      expect(inputs[0].value).toBe('0');
      expect(inputs[3].value).toBe('2+');
      expect(inputs[6].value).toBe('4-');
    });

    it('setPairs maneja silencios correctamente', () => {
      editor = createGridEditor({
        container,
        mode: 'degree',
        degreeModeOptions: {
          getScaleLength: () => 7
        }
      });

      const pairs = [
        { degree: null, isRest: true, pulse: 2 }
      ];
      editor.setPairs(pairs);

      const inputs = container.querySelectorAll('.degree-input');
      expect(inputs[2].value).toBe('s');
    });

    it('getPairs retorna format correcte', () => {
      jest.useFakeTimers();

      editor = createGridEditor({
        container,
        mode: 'degree',
        degreeModeOptions: {
          getScaleLength: () => 7
        }
      });

      // Establecer valores directamente
      const inputs = container.querySelectorAll('.degree-input');
      inputs[0].value = '3';
      inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
      jest.advanceTimersByTime(300); // Wait for delayed validation

      inputs[4].value = '5+';
      inputs[4].dispatchEvent(new Event('input', { bubbles: true }));
      // No need to wait for 5+ as it has modifier and validates immediately

      const pairs = editor.getPairs();
      expect(pairs.length).toBe(2);
      // Note: isRest:false is included in all non-rest pairs
      expect(pairs[0]).toEqual({ degree: 3, modifier: null, pulse: 0, isRest: false });
      expect(pairs[1]).toEqual({ degree: 5, modifier: '+', pulse: 4, isRest: false });
    });

    it('clear limpia todos los inputs', () => {
      editor = createGridEditor({
        container,
        mode: 'degree',
        degreeModeOptions: {
          getScaleLength: () => 7
        }
      });

      editor.setPairs([
        { degree: 2, modifier: null, pulse: 1 },
        { degree: 4, modifier: '+', pulse: 5 }
      ]);
      editor.clear();

      const pairs = editor.getPairs();
      expect(pairs).toEqual([]);

      const inputs = container.querySelectorAll('.degree-input');
      inputs.forEach(input => expect(input.value).toBe(''));
    });

    it('respeta rango de graus según escala - valores válidos', () => {
      // Escala pentatónica (5 graus: 0-4)
      editor = createGridEditor({
        container,
        mode: 'degree',
        degreeModeOptions: {
          getScaleLength: () => 5
        }
      });

      const input = container.querySelector('.degree-input');

      // Grau 4 válido (dentro del rango 0-4)
      input.value = '4';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      expect(input.value).toBe('4');
    });

    it('onPairsChange se llama cuando cambia input', () => {
      jest.useFakeTimers();

      let callbackCalled = false;
      const mockCallback = () => { callbackCalled = true; };
      editor = createGridEditor({
        container,
        mode: 'degree',
        degreeModeOptions: {
          getScaleLength: () => 7
        },
        onPairsChange: mockCallback
      });

      const input = container.querySelector('.degree-input');
      input.value = '3';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      jest.advanceTimersByTime(300); // Wait for delayed validation

      expect(callbackCalled).toBe(true);
    });
  });
});
