import { describe, expect, it } from 'vitest';
import { dashboardStackedColumns } from './stacked-columns';
describe('actual stacked customer series', () => {
  it('retains returning customers even when all first-purchase counts are zero, including buckets after eight', () => {
    const columns = dashboardStackedColumns(
      [
        { label: 'new', values: Array(10).fill(0) },
        { label: 'returning', values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
      ],
      10,
    );
    expect(columns).toHaveLength(10);
    expect(columns[9]!.positive).toBe(10);
    expect(
      columns.flatMap((c) => c.segments).reduce((sum, s) => sum + s.value, 0),
    ).toBe(55);
    expect(columns[9]!.segments[1]).toMatchObject({
      label: 'returning',
      start: 0,
      end: 10,
      value: 10,
    });
  });
  it('stacks positive and negative values independently rather than subtracting a segment from another', () => {
    const [column] = dashboardStackedColumns(
      [
        { label: 'a', values: [10] },
        { label: 'b', values: [-3] },
        { label: 'c', values: [5] },
      ],
      1,
    );
    expect(column).toMatchObject({ positive: 15, negative: -3 });
    expect(column!.segments.map((s) => [s.start, s.end])).toEqual([
      [0, 10],
      [0, -3],
      [10, 15],
    ]);
  });
});
