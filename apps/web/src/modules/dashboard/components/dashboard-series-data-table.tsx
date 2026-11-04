type Series = readonly { label: string; values: readonly number[] }[];

export function dashboardSeriesSummary(
  labels: readonly string[],
  values: readonly number[],
  series: Series | undefined,
  format: (value: number) => string,
) {
  const summarize = (rows: readonly number[]) =>
    rows
      .map(
        (value, index) =>
          `${labels[index] ?? `دسته ${index + 1}`}: ${format(value)}`,
      )
      .join('، ');
  return series?.length
    ? series
        .map((item) => `${item.label}: ${summarize(item.values)}`)
        .join('؛ ')
    : summarize(values);
}

export function DashboardSeriesDataTable({
  title,
  firstColumnLabel,
  labels,
  values,
  series,
  formatValue,
}: {
  title: string;
  firstColumnLabel: string;
  labels: readonly string[];
  values: readonly number[];
  series?: Series | undefined;
  formatValue: (value: number) => string;
}) {
  const columns = series?.length ? series : [{ label: 'مقدار', values }];
  const rows = Math.max(
    labels.length,
    ...columns.map((item) => item.values.length),
  );
  return (
    <table className="w-full min-w-72 text-xs">
      <caption className="sr-only">داده‌های نمودار {title}</caption>
      <thead className="bg-muted/60 text-foreground">
        <tr>
          <th className="px-3 py-2 text-start" scope="col">
            {firstColumnLabel}
          </th>
          {columns.map((column, index) => (
            <th
              className="px-3 py-2 text-end"
              scope="col"
              key={`${column.label}-${index}`}
            >
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }, (_, index) => (
          <tr className="border-t border-border/70" key={index}>
            <th className="px-3 py-2 text-start font-medium" scope="row">
              {labels[index] ?? `دسته ${index + 1}`}
            </th>
            {columns.map((column, columnIndex) => {
              const value = column.values[index];
              return (
                <td
                  className="px-3 py-2 text-end font-bold tabular-nums"
                  key={columnIndex}
                >
                  {value === undefined ? '—' : formatValue(value)}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
