import { dashboardNumericAxis } from '../model/numeric-axis';
import { dashboardStackedColumns } from '../model/stacked-columns';
import { trendAxisLabelIndexes } from '../model/trend-axis';

export function DashboardStackedSeriesChart({
  labels,
  series,
  title,
}: {
  labels: readonly string[];
  series: readonly { label: string; values: readonly number[] }[];
  title: string;
}) {
  const columns = dashboardStackedColumns(series, labels.length);
  const axis = dashboardNumericAxis(
    columns.flatMap((c) => [c.positive, c.negative]),
  );
  const y = (value: number) => 150 - axis.position(value) * 1.3;
  const slot = 920 / Math.max(columns.length, 1),
    width = Math.min(42, slot * 0.65);
  const colors = ['#1d4ed8', '#0284c7', '#7c3aed', '#059669'];
  const format = (value: number) =>
    new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 }).format(value);
  const summary = series
    .map(
      (item) =>
        item.label +
        ': ' +
        labels
          .map((label, i) => label + ' ' + format(item.values[i] ?? 0))
          .join('، '),
    )
    .join('؛ ');
  return (
    <figure
      aria-label={title + '. ' + summary}
      className="rounded-xl border border-border/80 bg-muted/[0.12] p-3"
      role="img"
    >
      <svg aria-hidden="true" className="h-52 w-full" viewBox="0 0 1000 190">
        {[0, 1, 2, 3, 4].map((i) => {
          const value = axis.maximum - ((axis.maximum - axis.minimum) * i) / 4;
          return (
            <g key={i}>
              <line
                className="text-border"
                stroke="currentColor"
                strokeDasharray="3 4"
                x1="50"
                x2="970"
                y1={y(value)}
                y2={y(value)}
              />
              <text
                className="fill-muted-foreground text-[9px]"
                textAnchor="end"
                x="42"
                y={y(value) + 3}
              >
                {format(value)}
              </text>
            </g>
          );
        })}
        {columns.map((column, index) => (
          <g key={index}>
            {column.segments.map((segment) => (
              <rect
                key={segment.seriesIndex}
                fill={colors[segment.seriesIndex % colors.length]}
                x={50 + slot * index + (slot - width) / 2}
                y={Math.min(y(segment.start), y(segment.end))}
                width={width}
                height={Math.abs(y(segment.start) - y(segment.end))}
              >
                <title>{`${labels[index]} · ${segment.label}: ${format(segment.value)}`}</title>
              </rect>
            ))}
          </g>
        ))}
        {[...trendAxisLabelIndexes(labels.length)].map((index) => (
          <text
            key={index}
            className="fill-muted-foreground text-[9px]"
            textAnchor="middle"
            x={50 + slot * index + slot / 2}
            y="174"
          >
            {labels[index]}
          </text>
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap justify-center gap-4 text-xs font-bold text-muted-foreground">
        {series.map((item, index) => (
          <span className="inline-flex items-center gap-1.5" key={item.label}>
            <i
              aria-hidden="true"
              className="size-2 rounded-sm"
              style={{ backgroundColor: colors[index % colors.length] }}
            />
            {item.label}
          </span>
        ))}
      </div>
      <figcaption className="sr-only">{summary}</figcaption>
    </figure>
  );
}
