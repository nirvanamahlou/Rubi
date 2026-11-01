import { normalizeFilterText } from './accounting-list-filters';

/** The same projection drives the visible grid and its numbering selection. */
export function filterNumberingRows<T>(
  rows: T[],
  filters: string[],
  cells: (row: T) => (string | number)[],
): T[] {
  return rows.filter((row) => {
    const values = cells(row);
    return filters.every((filter, index) => {
      const value = normalizeFilterText(filter);
      if (!value) return true;
      const cell = normalizeFilterText(String(values[index] ?? ''));
      // Status is a discrete selector; other observed columns accept text.
      return index === 2 ? cell === value : cell.includes(value);
    });
  });
}
