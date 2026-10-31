/** Signed offsets keep every series and time bucket; no rolling-average proxy. */
export function dashboardStackedColumns(
  series: readonly { label: string; values: readonly number[] }[],
  count: number,
) {
  return Array.from({ length: count }, (_, index) => {
    let positive = 0,
      negative = 0;
    const segments = series.map((item, seriesIndex) => {
      const value = item.values[index] ?? 0;
      const start = value >= 0 ? positive : negative;
      const end = start + value;
      if (value >= 0) positive = end;
      else negative = end;
      return { seriesIndex, label: item.label, value, start, end };
    });
    return { positive, negative, segments };
  });
}
