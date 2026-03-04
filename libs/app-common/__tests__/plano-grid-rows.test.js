import { buildSimple12Rows } from '../plano-grid-rows.js';

describe('plano-grid-rows', () => {
  describe('buildSimple12Rows', () => {
    it('returns 12 rows by default', () => {
      const rows = buildSimple12Rows();
      expect(rows).toHaveLength(12);
    });

    it('orders rows highest-first (11 at top, 0 at bottom)', () => {
      const rows = buildSimple12Rows();
      expect(rows[0].data.note).toBe(11);
      expect(rows[11].data.note).toBe(0);
    });

    it('each row has id, label, and data.note', () => {
      const rows = buildSimple12Rows();
      rows.forEach((row, i) => {
        const expectedNote = 11 - i;
        expect(row.id).toBe(`note-${expectedNote}`);
        expect(row.label).toBe(String(expectedNote));
        expect(row.data.note).toBe(expectedNote);
      });
    });

    it('supports custom noteCount', () => {
      const rows = buildSimple12Rows(5);
      expect(rows).toHaveLength(5);
      expect(rows[0].data.note).toBe(4);
      expect(rows[4].data.note).toBe(0);
    });
  });
});
