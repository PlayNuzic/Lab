/**
 * Tests for Scale Selector Module
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';

import {
  SCALE_IDS,
  ALL_SCALES,
  getAllScalesWithRotations,
  SCALE_PRESETS,
  getScalesByPreset,
  filterScales,
  getRotatedScaleNotes,
  getScaleDisplayName,
  getScaleShortName,
  parseScaleValue,
  getScaleInfo,
  createScaleSelector,
  createTransposeSelector
} from '../index.js';

// ============================================================================
// SCALE_IDS Tests
// ============================================================================

describe('SCALE_IDS', () => {
  test('should contain all mother scale IDs', () => {
    expect(SCALE_IDS).toContain('CROM');
    expect(SCALE_IDS).toContain('DIAT');
    expect(SCALE_IDS).toContain('ACUS');
    expect(SCALE_IDS).toContain('ARMme');
    expect(SCALE_IDS).toContain('ARMma');
    expect(SCALE_IDS).toContain('OCT');
    expect(SCALE_IDS).toContain('HEX');
    expect(SCALE_IDS).toContain('TON');
  });

  test('should have 9 mother scales', () => {
    expect(SCALE_IDS).toContain('PENT');
    expect(SCALE_IDS.length).toBe(9);
  });
});

// ============================================================================
// ALL_SCALES Tests
// ============================================================================

describe('ALL_SCALES', () => {
  test('should be a non-empty array', () => {
    expect(Array.isArray(ALL_SCALES)).toBe(true);
    expect(ALL_SCALES.length).toBeGreaterThan(0);
  });

  test('should include all DIAT rotations (7 modes)', () => {
    const diatScales = ALL_SCALES.filter(s => s.id === 'DIAT');
    expect(diatScales.length).toBe(7);
  });

  test('should include all ACUS rotations (7 modes)', () => {
    const acusScales = ALL_SCALES.filter(s => s.id === 'ACUS');
    expect(acusScales.length).toBe(7);
  });

  test('should include all ARMme rotations (7 modes)', () => {
    const armmeScales = ALL_SCALES.filter(s => s.id === 'ARMme');
    expect(armmeScales.length).toBe(7);
  });

  test('should include all ARMma rotations (7 modes)', () => {
    const armmaScales = ALL_SCALES.filter(s => s.id === 'ARMma');
    expect(armmaScales.length).toBe(7);
  });

  test('should include OCT rotations (2 modes)', () => {
    const octScales = ALL_SCALES.filter(s => s.id === 'OCT');
    expect(octScales.length).toBe(2);
  });

  test('should include HEX rotations (2 modes)', () => {
    const hexScales = ALL_SCALES.filter(s => s.id === 'HEX');
    expect(hexScales.length).toBe(2);
  });

  test('should include TON rotation (1 mode)', () => {
    const tonScales = ALL_SCALES.filter(s => s.id === 'TON');
    expect(tonScales.length).toBe(1);
  });

  test('should include CROM rotation (1 mode)', () => {
    const cromScales = ALL_SCALES.filter(s => s.id === 'CROM');
    expect(cromScales.length).toBe(1);
  });

  test('should include PENT rotations (2 modes)', () => {
    const pentScales = ALL_SCALES.filter(s => s.id === 'PENT');
    expect(pentScales.length).toBe(2);
  });

  test('each scale should have required properties', () => {
    ALL_SCALES.forEach(scale => {
      expect(scale).toHaveProperty('id');
      expect(scale).toHaveProperty('rotation');
      expect(scale).toHaveProperty('value');
      expect(scale).toHaveProperty('name');
      expect(scale).toHaveProperty('scaleName');
      expect(scale).toHaveProperty('rotationName');
      expect(scale).toHaveProperty('intervalStructure');
      expect(scale).toHaveProperty('noteCount');
    });
  });

  test('value should be in format ID-ROTATION', () => {
    ALL_SCALES.forEach(scale => {
      expect(scale.value).toBe(`${scale.id}-${scale.rotation}`);
    });
  });

  test('total scales should be 36 (7+7+7+7+2+2+2+1+1)', () => {
    // DIAT(7) + ACUS(7) + ARMme(7) + ARMma(7) + OCT(2) + HEX(2) + PENT(2) + TON(1) + CROM(1) = 36
    expect(ALL_SCALES.length).toBe(36);
  });
});

// ============================================================================
// getAllScalesWithRotations Tests
// ============================================================================

describe('getAllScalesWithRotations', () => {
  test('should return same result as ALL_SCALES', () => {
    const result = getAllScalesWithRotations();
    expect(result.length).toBe(ALL_SCALES.length);
  });

  test('should return new array each time', () => {
    const result1 = getAllScalesWithRotations();
    const result2 = getAllScalesWithRotations();
    expect(result1).not.toBe(result2);
  });
});

// ============================================================================
// getRotatedScaleNotes Tests
// ============================================================================

describe('getRotatedScaleNotes', () => {
  test('CROM-0 should return 12 chromatic semitones', () => {
    const notes = getRotatedScaleNotes('CROM', 0);
    expect(notes).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  test('DIAT-0 (Mayor) should return major scale semitones', () => {
    const notes = getRotatedScaleNotes('DIAT', 0);
    expect(notes).toEqual([0, 2, 4, 5, 7, 9, 11]);
  });

  test('DIAT-1 (Dórica) should return dorian mode semitones', () => {
    const notes = getRotatedScaleNotes('DIAT', 1);
    expect(notes).toEqual([0, 2, 3, 5, 7, 9, 10]);
  });

  test('DIAT-2 (Frigia) should return phrygian mode semitones', () => {
    const notes = getRotatedScaleNotes('DIAT', 2);
    expect(notes).toEqual([0, 1, 3, 5, 7, 8, 10]);
  });

  test('DIAT-5 (Eolia/Menor Natural) should return minor scale semitones', () => {
    const notes = getRotatedScaleNotes('DIAT', 5);
    expect(notes).toEqual([0, 2, 3, 5, 7, 8, 10]);
  });

  test('TON-0 should return whole tone scale semitones', () => {
    const notes = getRotatedScaleNotes('TON', 0);
    expect(notes).toEqual([0, 2, 4, 6, 8, 10]);
  });

  test('OCT-0 should return octatonic scale semitones', () => {
    const notes = getRotatedScaleNotes('OCT', 0);
    expect(notes).toEqual([0, 1, 3, 4, 6, 7, 9, 10]);
  });

  test('should always start with 0', () => {
    SCALE_IDS.forEach(scaleId => {
      const maxRotations = ALL_SCALES.filter(s => s.id === scaleId).length;
      for (let rot = 0; rot < maxRotations; rot++) {
        const notes = getRotatedScaleNotes(scaleId, rot);
        expect(notes[0]).toBe(0);
      }
    });
  });
});

// ============================================================================
// getScaleDisplayName Tests
// ============================================================================

describe('getScaleDisplayName', () => {
  test('DIAT-0 should return "Mayor"', () => {
    expect(getScaleDisplayName('DIAT', 0)).toBe('Mayor');
  });

  test('DIAT-1 should return "Dórica"', () => {
    expect(getScaleDisplayName('DIAT', 1)).toBe('Dórica');
  });

  test('DIAT-5 should return "Eolia"', () => {
    expect(getScaleDisplayName('DIAT', 5)).toBe('Eolia');
  });

  test('TON-0 should return "Tonos" (single mode scale)', () => {
    expect(getScaleDisplayName('TON', 0)).toBe('Tonos');
  });

  test('CROM-0 should return "Cromática" (single mode scale)', () => {
    expect(getScaleDisplayName('CROM', 0)).toBe('Cromática');
  });

  test('ACUS-0 should return "Acústica - Acústica"', () => {
    expect(getScaleDisplayName('ACUS', 0)).toBe('Acústica - Acústica');
  });

  test('invalid scale should return "Escala"', () => {
    expect(getScaleDisplayName('INVALID', 0)).toBe('Escala');
  });
});

// ============================================================================
// getScaleShortName Tests
// ============================================================================

describe('getScaleShortName', () => {
  test('DIAT-0 should return "Mayor"', () => {
    expect(getScaleShortName('DIAT', 0)).toBe('Mayor');
  });

  test('ACUS-4 should return "Menor Mel."', () => {
    expect(getScaleShortName('ACUS', 4)).toBe('Menor Mel.');
  });

  test('TON-0 should return "Único"', () => {
    expect(getScaleShortName('TON', 0)).toBe('Único');
  });
});

// ============================================================================
// parseScaleValue Tests
// ============================================================================

describe('parseScaleValue', () => {
  test('should parse "DIAT-0" correctly', () => {
    const result = parseScaleValue('DIAT-0');
    expect(result.scaleId).toBe('DIAT');
    expect(result.rotation).toBe(0);
  });

  test('should parse "ACUS-4" correctly', () => {
    const result = parseScaleValue('ACUS-4');
    expect(result.scaleId).toBe('ACUS');
    expect(result.rotation).toBe(4);
  });

  test('should parse "ARMme-6" correctly', () => {
    const result = parseScaleValue('ARMme-6');
    expect(result.scaleId).toBe('ARMme');
    expect(result.rotation).toBe(6);
  });
});

// ============================================================================
// getScaleInfo Tests
// ============================================================================

describe('getScaleInfo', () => {
  test('should return info for "DIAT-0"', () => {
    const info = getScaleInfo('DIAT-0');
    expect(info).not.toBeNull();
    expect(info.id).toBe('DIAT');
    expect(info.rotation).toBe(0);
    expect(info.name).toBe('Mayor');
  });

  test('should return info for "ACUS-4"', () => {
    const info = getScaleInfo('ACUS-4');
    expect(info).not.toBeNull();
    expect(info.id).toBe('ACUS');
    expect(info.rotation).toBe(4);
    expect(info.rotationName).toBe('Menor Mel.');
  });

  test('should return null for invalid value', () => {
    const info = getScaleInfo('INVALID-0');
    expect(info).toBeNull();
  });
});

// ============================================================================
// filterScales Tests
// ============================================================================

describe('filterScales', () => {
  test('empty filter should return all scales', () => {
    const result = filterScales({});
    expect(result.length).toBe(ALL_SCALES.length);
  });

  test('scaleIds filter should only include specified scales', () => {
    const result = filterScales({ scaleIds: ['DIAT', 'TON'] });
    expect(result.every(s => s.id === 'DIAT' || s.id === 'TON')).toBe(true);
    expect(result.length).toBe(8); // 7 DIAT + 1 TON
  });

  test('onlyFirstRotation should return only mode 0 of each scale', () => {
    const result = filterScales({ onlyFirstRotation: true });
    expect(result.length).toBe(9); // One per mother scale (including PENT)
    expect(result.every(s => s.rotation === 0)).toBe(true);
  });

  test('rotations filter should select specific modes', () => {
    const result = filterScales({
      scaleIds: ['DIAT'],
      rotations: { DIAT: [0, 5] } // Major and Aeolian
    });
    expect(result.length).toBe(2);
    expect(result.some(s => s.rotation === 0)).toBe(true);
    expect(result.some(s => s.rotation === 5)).toBe(true);
  });

  test('rotations "all" should include all rotations', () => {
    const result = filterScales({
      scaleIds: ['DIAT'],
      rotations: { DIAT: 'all' }
    });
    expect(result.length).toBe(7);
  });

  test('minNotes filter should exclude scales with fewer notes', () => {
    const result = filterScales({ minNotes: 7 });
    expect(result.every(s => s.noteCount >= 7)).toBe(true);
  });

  test('maxNotes filter should exclude scales with more notes', () => {
    const result = filterScales({ maxNotes: 7 });
    expect(result.every(s => s.noteCount <= 7)).toBe(true);
  });

  test('combined filters should work together', () => {
    const result = filterScales({
      scaleIds: ['DIAT', 'ACUS'],
      rotations: { DIAT: [0, 1, 2], ACUS: [0] },
      minNotes: 7
    });
    expect(result.length).toBe(4); // 3 DIAT + 1 ACUS
  });
});

// ============================================================================
// SCALE_PRESETS Tests
// ============================================================================

describe('SCALE_PRESETS', () => {
  test('should have app21 preset', () => {
    expect(SCALE_PRESETS).toHaveProperty('app21');
  });

  test('should have all preset', () => {
    expect(SCALE_PRESETS).toHaveProperty('all');
  });

  test('should have diatonic preset', () => {
    expect(SCALE_PRESETS).toHaveProperty('diatonic');
  });

  test('should have heptatonic preset', () => {
    expect(SCALE_PRESETS).toHaveProperty('heptatonic');
  });

  test('should have symmetric preset', () => {
    expect(SCALE_PRESETS).toHaveProperty('symmetric');
  });

  test('should have motherScalesOnly preset', () => {
    expect(SCALE_PRESETS).toHaveProperty('motherScalesOnly');
  });
});

// ============================================================================
// getScalesByPreset Tests
// ============================================================================

describe('getScalesByPreset', () => {
  test('app21 preset should match original App21 behavior', () => {
    const result = getScalesByPreset('app21');
    // 7 DIAT modes + 7 other scales (mode 0 each)
    expect(result.length).toBe(14);

    // Check DIAT has all 7 modes
    const diatModes = result.filter(s => s.id === 'DIAT');
    expect(diatModes.length).toBe(7);

    // Check other scales have only mode 0
    const otherScales = result.filter(s => s.id !== 'DIAT');
    expect(otherScales.every(s => s.rotation === 0)).toBe(true);
  });

  test('all preset should return all scales', () => {
    const result = getScalesByPreset('all');
    expect(result.length).toBe(ALL_SCALES.length);
  });

  test('diatonic preset should return only DIAT scales', () => {
    const result = getScalesByPreset('diatonic');
    expect(result.length).toBe(7);
    expect(result.every(s => s.id === 'DIAT')).toBe(true);
  });

  test('heptatonic preset should return 7-note scales', () => {
    const result = getScalesByPreset('heptatonic');
    expect(result.every(s => s.noteCount === 7)).toBe(true);
    // DIAT(7) + ACUS(7) + ARMme(7) + ARMma(7) = 28
    expect(result.length).toBe(28);
  });

  test('symmetric preset should return symmetric scales', () => {
    const result = getScalesByPreset('symmetric');
    const expectedIds = ['CROM', 'TON', 'OCT', 'HEX'];
    expect(result.every(s => expectedIds.includes(s.id))).toBe(true);
    // CROM(1) + TON(1) + OCT(2) + HEX(2) = 6
    expect(result.length).toBe(6);
  });

  test('motherScalesOnly preset should return only first rotations', () => {
    const result = getScalesByPreset('motherScalesOnly');
    expect(result.length).toBe(9); // Including PENT
    expect(result.every(s => s.rotation === 0)).toBe(true);
  });

  test('invalid preset should return all scales', () => {
    const result = getScalesByPreset('nonexistent');
    expect(result.length).toBe(ALL_SCALES.length);
  });
});

// ============================================================================
// createScaleSelector Tests (DOM-based)
// ============================================================================

describe('createScaleSelector', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  test('should create selector with default options', () => {
    const selector = createScaleSelector({ container });
    selector.render();

    expect(container.querySelector('.scale-select')).not.toBeNull();
  });

  test('should apply preset filter', () => {
    const selector = createScaleSelector({
      container,
      preset: 'diatonic'
    });
    selector.render();

    const options = container.querySelectorAll('.scale-select option');
    expect(options.length).toBe(7);
  });

  test('should apply custom filter', () => {
    const selector = createScaleSelector({
      container,
      filter: { scaleIds: ['DIAT'], rotations: { DIAT: [0, 1] } }
    });
    selector.render();

    const options = container.querySelectorAll('.scale-select option');
    expect(options.length).toBe(2);
  });

  test('should create transpose selector when enabled', () => {
    const selector = createScaleSelector({
      container,
      enableTranspose: true
    });
    selector.render();

    expect(container.querySelector('.transpose-selector')).not.toBeNull();
    expect(container.querySelectorAll('.transpose-btn').length).toBe(12);
  });

  test('should not create transpose selector when disabled', () => {
    const selector = createScaleSelector({
      container,
      enableTranspose: false
    });
    selector.render();

    expect(container.querySelector('.transpose-selector')).toBeNull();
  });

  test('getScale should return current scale value', () => {
    const selector = createScaleSelector({
      container,
      initialScale: 'DIAT-2'
    });
    selector.render();

    expect(selector.getScale()).toBe('DIAT-2');
  });

  test('setScale should update scale', () => {
    const onScaleChange = jest.fn();
    const selector = createScaleSelector({
      container,
      initialScale: 'DIAT-0',
      onScaleChange
    });
    selector.render();

    selector.setScale('DIAT-5');
    expect(selector.getScale()).toBe('DIAT-5');
    expect(onScaleChange).toHaveBeenCalled();
  });

  test('getScaleNotes should return semitones', () => {
    const selector = createScaleSelector({
      container,
      initialScale: 'DIAT-0'
    });
    selector.render();

    expect(selector.getScaleNotes()).toEqual([0, 2, 4, 5, 7, 9, 11]);
  });

  test('getTranspose should return current transpose value', () => {
    const selector = createScaleSelector({ container });
    selector.render();

    expect(selector.getTranspose()).toBe(0);
  });

  test('setTranspose should update transpose', () => {
    const onTransposeChange = jest.fn();
    const selector = createScaleSelector({
      container,
      onTransposeChange
    });
    selector.render();

    selector.setTranspose(5);
    expect(selector.getTranspose()).toBe(5);
    expect(onTransposeChange).toHaveBeenCalledWith(5);
  });

  test('applyTranspose should add transpose to MIDI note', () => {
    const selector = createScaleSelector({ container });
    selector.render();
    selector.setTranspose(5, false);

    expect(selector.applyTranspose(60)).toBe(65);
  });

  test('destroy should clean up', () => {
    const selector = createScaleSelector({ container });
    selector.render();
    selector.destroy();

    expect(container.innerHTML).toBe('');
  });

  test('should show title when provided', () => {
    const selector = createScaleSelector({
      container,
      title: 'Test Title'
    });
    selector.render();

    const title = container.querySelector('.scale-selector-title');
    expect(title).not.toBeNull();
    expect(title.textContent).toBe('Test Title');
  });

  test('should not show title when null', () => {
    const selector = createScaleSelector({
      container,
      title: null
    });
    selector.render();

    expect(container.querySelector('.scale-selector-title')).toBeNull();
  });

  test('getAvailableScales should return configured scales', () => {
    const selector = createScaleSelector({
      container,
      preset: 'diatonic'
    });

    const scales = selector.getAvailableScales();
    expect(scales.length).toBe(7);
    expect(scales.every(s => s.id === 'DIAT')).toBe(true);
  });

  test('setAvailableScales should update scales', () => {
    const selector = createScaleSelector({
      container,
      preset: 'all'
    });
    selector.render();

    selector.setAvailableScales('diatonic');
    const options = container.querySelectorAll('.scale-select option');
    expect(options.length).toBe(7);
  });
});

// ============================================================================
// createTransposeSelector Tests (DOM-based)
// ============================================================================

describe('createTransposeSelector', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  test('should create 12 transpose buttons', () => {
    const selector = createTransposeSelector({ container });
    selector.render();

    expect(container.querySelectorAll('.transpose-btn').length).toBe(12);
  });

  test('should have initial value active', () => {
    const selector = createTransposeSelector({
      container,
      initialValue: 5
    });
    selector.render();

    const activeBtn = container.querySelector('.transpose-btn.active');
    expect(activeBtn.dataset.transpose).toBe('5');
  });

  test('getValue should return current value', () => {
    const selector = createTransposeSelector({
      container,
      initialValue: 7
    });
    selector.render();

    expect(selector.getValue()).toBe(7);
  });

  test('setValue should update value', () => {
    const onChange = jest.fn();
    const selector = createTransposeSelector({
      container,
      onChange
    });
    selector.render();

    selector.setValue(9);
    expect(selector.getValue()).toBe(9);
    expect(onChange).toHaveBeenCalledWith(9);
  });

  test('applyTranspose should add value to MIDI', () => {
    const selector = createTransposeSelector({
      container,
      initialValue: 3
    });
    selector.render();

    expect(selector.applyTranspose(60)).toBe(63);
  });

  test('should show custom label', () => {
    const selector = createTransposeSelector({
      container,
      label: 'Custom Label'
    });
    selector.render();

    const label = container.querySelector('.transpose-label');
    expect(label.textContent).toBe('Custom Label');
  });

  test('clicking button should update value', () => {
    const onChange = jest.fn();
    const selector = createTransposeSelector({
      container,
      onChange
    });
    selector.render();

    const btn = container.querySelector('.transpose-btn[data-transpose="4"]');
    btn.click();

    expect(selector.getValue()).toBe(4);
    expect(onChange).toHaveBeenCalledWith(4);
  });

  test('destroy should clean up', () => {
    const selector = createTransposeSelector({ container });
    selector.render();
    selector.destroy();

    expect(container.innerHTML).toBe('');
  });
});
