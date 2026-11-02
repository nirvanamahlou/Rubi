import { describe, expect, it } from 'vitest';
import { filterNumberingRows } from './accounting-numbering-filter';

describe('numbering grid selection', () => {
  const rows = [
    {
      id: 'a',
      version: 3,
      cells: [12, '2026-07-01', 'موقت', 'عمومی', 'شرکت کیان'],
    },
    {
      id: 'b',
      version: 7,
      cells: [13, '2026-07-02', 'بررسی شده', 'عمومی', 'شرکت دیگر'],
    },
  ];
  it('intersects column filters and keeps original IDs and concurrency versions', () => {
    const selected = filterNumberingRows(
      rows,
      ['۱۲', '', 'موقت', '', 'كيان'],
      (row) => row.cells,
    );
    expect(selected).toEqual([rows[0]]);
    expect(selected[0]).toBe(rows[0]);
    expect(rows).toHaveLength(2);
  });
  it('returns no operational selection for no matches and restores all when cleared', () => {
    expect(
      filterNumberingRows(rows, ['', '', 'قطعی'], (row) => row.cells),
    ).toEqual([]);
    expect(filterNumberingRows(rows, [], (row) => row.cells)).toEqual(rows);
  });
});
