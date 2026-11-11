import { retainRankedRow } from '../common/retain-ranked-row';

export function selectReportRows<Row>(
  rows: Iterable<Row>,
  total: number,
  { page, pageSize }: { page: number; pageSize: number },
  includeAllRows: boolean,
  compareRows: (left: Row, right: Row) => number,
): Row[] {
  if (includeAllRows) return [...rows].sort(compareRows);
  const offset = (page - 1) * pageSize;
  const end = offset + pageSize;
  if (offset >= total) return [];
  if (end >= total) return [...rows].sort(compareRows).slice(offset);

  type RankedRow = { row: Row; index: number };
  const compare = (left: RankedRow, right: RankedRow) =>
    compareRows(left.row, right.row) || left.index - right.index;
  const ranked: RankedRow[] = [];
  let index = 0;
  for (const row of rows) {
    retainRankedRow(ranked, { row, index }, end, compare);
    index++;
  }
  return ranked
    .sort(compare)
    .slice(offset)
    .map(({ row }) => row);
}
