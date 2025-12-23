/**
 * Tests for registry-helpers.js
 */

import {
  APP19_CONFIG,
  buildRegistryRows,
  calculateNote0RowMap,
  getApp19DefaultConfig,
  convertToApp19Keys,
  convertFromApp19Keys,
  createApp19Key,
  parseApp19Key,
  createRowId,
  parseRowId,
  calculateMidi,
  calculateRegistryScrollTop,
  buildSimpleRegistryRows,
  isBoundaryRow,
  getVisibleRegistries
} from '../registry-helpers.js';

describe('registry-helpers', () => {
  describe('APP19_CONFIG', () => {
    it('should have correct registry definitions', () => {
      expect(APP19_CONFIG.registries).toHaveLength(4);
      expect(APP19_CONFIG.registries[0]).toEqual({ id: 5, notes: { from: 7, to: 0 } });
      expect(APP19_CONFIG.registries[1]).toEqual({ id: 4, notes: { from: 11, to: 0 } });
      expect(APP19_CONFIG.registries[2]).toEqual({ id: 3, notes: { from: 11, to: 0 } });
      expect(APP19_CONFIG.registries[3]).toEqual({ id: 2, notes: { from: 11, to: 5 } });
    });

    it('should have correct visible rows', () => {
      expect(APP19_CONFIG.visibleRows).toBe(15);
    });

    it('should have correct selectable registries', () => {
      expect(APP19_CONFIG.selectableRegistries).toEqual([3, 4, 5]);
    });
  });

  describe('buildRegistryRows', () => {
    it('should build 39 rows for App19 default config', () => {
      const rows = buildRegistryRows();
      expect(rows).toHaveLength(39); // 8 + 12 + 12 + 7 = 39
    });

    it('should build rows in descending order (highest pitch first)', () => {
      const rows = buildRegistryRows();

      // First row should be 7r5 (highest)
      expect(rows[0].id).toBe('7r5');
      expect(rows[0].label).toBe('7r5');
      expect(rows[0].data).toEqual({ registry: 5, note: 7, noteInReg: 7 });

      // Last row should be 5r2 (lowest in config)
      expect(rows[38].id).toBe('5r2');
      expect(rows[38].data.registry).toBe(2);
      expect(rows[38].data.note).toBe(5);
    });

    it('should have correct rows for r5 (notes 7-0)', () => {
      const rows = buildRegistryRows();
      const r5Rows = rows.filter(r => r.data.registry === 5);

      expect(r5Rows).toHaveLength(8);
      expect(r5Rows[0].data.note).toBe(7);
      expect(r5Rows[7].data.note).toBe(0);
    });

    it('should have correct rows for r4 (notes 11-0)', () => {
      const rows = buildRegistryRows();
      const r4Rows = rows.filter(r => r.data.registry === 4);

      expect(r4Rows).toHaveLength(12);
      expect(r4Rows[0].data.note).toBe(11);
      expect(r4Rows[11].data.note).toBe(0);
    });

    it('should have correct rows for r2 (notes 11-5 only)', () => {
      const rows = buildRegistryRows();
      const r2Rows = rows.filter(r => r.data.registry === 2);

      expect(r2Rows).toHaveLength(7);
      expect(r2Rows[0].data.note).toBe(11);
      expect(r2Rows[6].data.note).toBe(5);
    });

    it('should work with custom config', () => {
      const rows = buildRegistryRows({
        registries: [
          { id: 4, notes: { from: 5, to: 0 } }
        ]
      });

      expect(rows).toHaveLength(6);
      expect(rows[0].id).toBe('5r4');
      expect(rows[5].id).toBe('0r4');
    });
  });

  describe('calculateNote0RowMap', () => {
    it('should calculate correct map for App19 default', () => {
      const rows = buildRegistryRows();
      const map = calculateNote0RowMap(rows);

      expect(map).toEqual({
        5: 7,   // 0r5 at row 7 (after 8 notes 7-0 of r5)
        4: 19,  // 0r4 at row 19 (8 + 12 - 1 = 19)
        3: 31,  // 0r3 at row 31 (8 + 12 + 12 - 1 = 31)
        2: 38   // r2 has no note 0, so uses last row (note 5 at row 38)
      });
    });

    it('should use last row for registries without note 0', () => {
      const rows = buildRegistryRows();
      const map = calculateNote0RowMap(rows);

      // r2 only has notes 11-5, no note 0 - should fallback to last row
      expect(map[2]).toBe(38);
    });

    it('should work with custom rows', () => {
      const rows = [
        { id: '2r5', data: { registry: 5, note: 2 } },
        { id: '1r5', data: { registry: 5, note: 1 } },
        { id: '0r5', data: { registry: 5, note: 0 } }
      ];

      const map = calculateNote0RowMap(rows);
      expect(map[5]).toBe(2);
    });

    it('should fallback to last row when note 0 is not present', () => {
      const rows = [
        { id: '11r2', data: { registry: 2, note: 11 } },
        { id: '10r2', data: { registry: 2, note: 10 } },
        { id: '9r2', data: { registry: 2, note: 9 } }
      ];

      const map = calculateNote0RowMap(rows);
      // No note 0, should use last row (index 2)
      expect(map[2]).toBe(2);
    });
  });

  describe('getApp19DefaultConfig', () => {
    it('should return complete config object', () => {
      const config = getApp19DefaultConfig();

      expect(config).toHaveProperty('registries');
      expect(config).toHaveProperty('visibleRows', 15);
      expect(config).toHaveProperty('selectableRegistries', [3, 4, 5]);
      expect(config).toHaveProperty('notesPerRegistry', 12);
      expect(config).toHaveProperty('midiOffset', 12);
    });
  });

  describe('convertToApp19Keys', () => {
    it('should convert module selection to App19 format', () => {
      const selected = new Map([
        ['7r5-0', { row: { registry: 5, noteInReg: 7 }, col: 0 }],
        ['4r4-3', { row: { registry: 4, noteInReg: 4 }, col: 3 }]
      ]);

      const app19Keys = convertToApp19Keys(selected);

      expect(app19Keys).toContain('5-7-0');
      expect(app19Keys).toContain('4-4-3');
    });

    it('should parse key format directly when possible', () => {
      const selected = new Map([
        ['0r3-10', {}]  // Just key, no value data
      ]);

      const app19Keys = convertToApp19Keys(selected);
      expect(app19Keys).toContain('3-0-10');
    });

    it('should return empty array for empty selection', () => {
      const selected = new Map();
      const app19Keys = convertToApp19Keys(selected);
      expect(app19Keys).toEqual([]);
    });
  });

  describe('convertFromApp19Keys', () => {
    it('should convert App19 keys to module format', () => {
      const app19Keys = ['5-7-0', '4-4-3'];
      const result = convertFromApp19Keys(app19Keys);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        rowId: '7r5',
        colIndex: 0,
        data: { registry: 5, noteInReg: 7 }
      });
      expect(result[1]).toEqual({
        rowId: '4r4',
        colIndex: 3,
        data: { registry: 4, noteInReg: 4 }
      });
    });

    it('should filter out invalid keys', () => {
      const app19Keys = ['5-7-0', 'invalid', '4-4'];
      const result = convertFromApp19Keys(app19Keys);

      expect(result).toHaveLength(1);
      expect(result[0].rowId).toBe('7r5');
    });

    it('should return empty array for empty input', () => {
      expect(convertFromApp19Keys([])).toEqual([]);
    });
  });

  describe('createApp19Key', () => {
    it('should create correct key format', () => {
      expect(createApp19Key(5, 7, 0)).toBe('5-7-0');
      expect(createApp19Key(4, 11, 10)).toBe('4-11-10');
    });
  });

  describe('parseApp19Key', () => {
    it('should parse valid keys', () => {
      expect(parseApp19Key('5-7-0')).toEqual({
        registry: 5,
        noteInReg: 7,
        pulseIndex: 0
      });
    });

    it('should return null for invalid keys', () => {
      expect(parseApp19Key('invalid')).toBeNull();
      expect(parseApp19Key('5-7')).toBeNull();
      expect(parseApp19Key('a-b-c')).toBeNull();
    });
  });

  describe('createRowId', () => {
    it('should create correct row ID format', () => {
      expect(createRowId(7, 5)).toBe('7r5');
      expect(createRowId(0, 3)).toBe('0r3');
      expect(createRowId(11, 4)).toBe('11r4');
    });
  });

  describe('parseRowId', () => {
    it('should parse valid row IDs', () => {
      expect(parseRowId('7r5')).toEqual({ noteInReg: 7, registry: 5 });
      expect(parseRowId('11r4')).toEqual({ noteInReg: 11, registry: 4 });
      expect(parseRowId('0r3')).toEqual({ noteInReg: 0, registry: 3 });
    });

    it('should return null for invalid row IDs', () => {
      expect(parseRowId('invalid')).toBeNull();
      expect(parseRowId('7-5')).toBeNull();
      expect(parseRowId('r5')).toBeNull();
    });
  });

  describe('calculateMidi', () => {
    it('should calculate correct MIDI values', () => {
      // registry * 12 + noteInReg + 12 (offset)
      expect(calculateMidi(4, 0)).toBe(60);   // 4*12 + 0 + 12 = 60 (Middle C)
      expect(calculateMidi(5, 0)).toBe(72);   // 5*12 + 0 + 12 = 72
      expect(calculateMidi(3, 11)).toBe(59);  // 3*12 + 11 + 12 = 59
    });

    it('should use custom config', () => {
      expect(calculateMidi(4, 0, { notesPerRegistry: 12, midiOffset: 0 })).toBe(48);
    });
  });

  describe('calculateRegistryScrollTop', () => {
    it('should calculate correct scroll position for r4', () => {
      const note0RowMap = { 5: 7, 4: 19, 3: 31 };
      const cellHeight = 32;

      // For r4: note0Row = 19, centerOffset = 7, target = (19-7) * 32 = 384
      const scrollTop = calculateRegistryScrollTop(4, note0RowMap, cellHeight);
      expect(scrollTop).toBe(384);
    });

    it('should calculate correct scroll position for r5', () => {
      const note0RowMap = { 5: 7, 4: 19, 3: 31 };
      const cellHeight = 32;

      // For r5: note0Row = 7, centerOffset = 7, target = (7-7) * 32 = 0
      const scrollTop = calculateRegistryScrollTop(5, note0RowMap, cellHeight);
      expect(scrollTop).toBe(0);
    });

    it('should return 0 for unknown registry', () => {
      const note0RowMap = { 5: 7, 4: 19 };
      expect(calculateRegistryScrollTop(6, note0RowMap, 32)).toBe(0);
    });

    it('should use custom visible rows', () => {
      const note0RowMap = { 4: 19 };
      const cellHeight = 32;

      // With 10 visible rows, centerOffset = 5, target = (19-5) * 32 = 448
      const scrollTop = calculateRegistryScrollTop(4, note0RowMap, cellHeight, 10);
      expect(scrollTop).toBe(448);
    });
  });

  describe('buildSimpleRegistryRows', () => {
    it('should build full registry rows', () => {
      const rows = buildSimpleRegistryRows({
        minRegistry: 4,
        maxRegistry: 5
      });

      // r5: 12 notes + r4: 12 notes = 24
      expect(rows).toHaveLength(24);
    });

    it('should use default config', () => {
      const rows = buildSimpleRegistryRows();

      // r5 + r4 + r3 = 36 notes
      expect(rows).toHaveLength(36);
      expect(rows[0].data.registry).toBe(5);
      expect(rows[0].data.note).toBe(11);
    });
  });

  describe('isBoundaryRow', () => {
    it('should return true for note 0', () => {
      expect(isBoundaryRow({ data: { note: 0 } })).toBe(true);
      expect(isBoundaryRow({ data: { noteInReg: 0 } })).toBe(true);
    });

    it('should return false for other notes', () => {
      expect(isBoundaryRow({ data: { note: 7 } })).toBe(false);
      expect(isBoundaryRow({ data: { note: 11 } })).toBe(false);
    });

    it('should return false for invalid input', () => {
      expect(isBoundaryRow(null)).toBe(false);
      expect(isBoundaryRow({})).toBe(false);
      expect(isBoundaryRow({ data: {} })).toBe(false);
    });
  });

  describe('getVisibleRegistries', () => {
    it('should return registries where note is visible', () => {
      // Note 0 in r4 should be visible from r4 (centered) and possibly r3/r5
      const visibleIn = getVisibleRegistries(0, 4, {
        minRegistry: 3,
        maxRegistry: 5
      });

      expect(visibleIn).toContain(4);
    });

    it('should return empty array for notes not visible in any registry', () => {
      // Note 0 in r1 is outside the selectable range
      const visibleIn = getVisibleRegistries(0, 1, {
        minRegistry: 3,
        maxRegistry: 5
      });

      expect(visibleIn).toEqual([]);
    });

    it('should use default config', () => {
      const visibleIn = getVisibleRegistries(0, 4);
      expect(Array.isArray(visibleIn)).toBe(true);
    });
  });

  describe('Integration: buildRegistryRows + calculateNote0RowMap', () => {
    it('should work together correctly', () => {
      const rows = buildRegistryRows();
      const note0RowMap = calculateNote0RowMap(rows);

      // Verify that note0RowMap points to actual note 0 rows
      expect(rows[note0RowMap[5]].data.note).toBe(0);
      expect(rows[note0RowMap[5]].data.registry).toBe(5);

      expect(rows[note0RowMap[4]].data.note).toBe(0);
      expect(rows[note0RowMap[4]].data.registry).toBe(4);

      expect(rows[note0RowMap[3]].data.note).toBe(0);
      expect(rows[note0RowMap[3]].data.registry).toBe(3);
    });
  });

  describe('Integration: key conversion round-trip', () => {
    it('should convert keys back and forth correctly', () => {
      const originalApp19Keys = ['5-7-0', '4-4-3', '3-11-10'];

      const moduleFormat = convertFromApp19Keys(originalApp19Keys);

      // Create a Map like the module would use
      const moduleSelected = new Map();
      moduleFormat.forEach(item => {
        moduleSelected.set(`${item.rowId}-${item.colIndex}`, {
          row: item.data,
          col: item.colIndex
        });
      });

      const backToApp19 = convertToApp19Keys(moduleSelected);

      // Should contain all original keys
      originalApp19Keys.forEach(key => {
        expect(backToApp19).toContain(key);
      });
    });
  });
});
