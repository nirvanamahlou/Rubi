'use client';
import { ExpertActivity } from './expert-activity';
import type { SearchFilters } from './read-client';
import { BarChart3, Users } from 'lucide-react';
import type { Report } from './read-client';
import type { Operator } from './workflow-client';
import { faNumber } from './model';
import styles from './workspace.module.css';
const colors = [
  '#26b6c8',
  '#f4b640',
  '#5397ed',
  '#6dcaac',
  '#a569d6',
  '#8996aa',
];
export function ReportHighlights({
  data,
  branch,
  filters,
  meta,
}: {
  data: Report['data'];
  agents?: Operator[];
  branch?: string | undefined;
  filters?: SearchFilters | undefined;
  meta?: Report['meta'] | undefined;
}) {
  const sources = Array.from(
    data.sources.reduce(
      (map, source) =>
        map.set(source.label, (map.get(source.label) ?? 0) + source.count),
      new Map<string, number>(),
    ),
    ([label, count]) => ({ label, count }),
  ).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'fa'));
  let position = 0;
  const segments = sources.map((source, index) => {
    const start = position;
    position += data.calls ? (source.count / data.calls) * 100 : 0;
    return `${colors[index % colors.length]} ${start}% ${position}%`;
  });
  const gradient =
    data.calls && sources.length
      ? `conic-gradient(${segments.join(',')}, #e8edf4 ${position}% 100%)`
      : '#e8edf4';
  return (
    <div className={styles.highlights}>
      <article className={`${styles.reportCard} ${styles.expertCard}`}>
        <h3>
          <Users size={19} />
          عملکرد تماس و وضعیت پیگیری کارشناسان
        </h3>
        <ExpertActivity
          data={data}
          branch={branch}
          filters={filters}
          meta={meta}
        />
      </article>
      <article className={styles.reportCard}>
        <h3>
          <BarChart3 size={19} /> منابع تماس‌ها
        </h3>
        <div className={styles.sourceChart}>
          <div className={styles.sourceLegend}>
            {sources.map((source, index) => (
              <div key={source.label}>
                <i style={{ background: colors[index % colors.length] }} />
                <span>{source.label}</span>
                <strong>{faNumber(source.count)}</strong>
                <span className={styles.legendBar}>
                  <i
                    style={{
                      width: `${data.calls ? (source.count / data.calls) * 100 : 0}%`,
                      background: colors[index % colors.length],
                    }}
                  />
                </span>
                <small>
                  {data.calls
                    ? `${faNumber(Math.round((source.count / data.calls) * 100))}٪`
                    : '—'}
                </small>
              </div>
            ))}
          </div>
          <div
            className={styles.sourceDonut}
            style={{ background: gradient }}
            role="img"
            aria-label={`توزیع منابع ${faNumber(data.calls)} تماس؛ مقادیر در راهنمای رنگی درج شده‌اند`}
          >
            <div>
              <small>کل تماس‌ها</small>
              <strong>{faNumber(data.calls)}</strong>
            </div>
          </div>
        </div>
        {!sources.length && <p>داده‌ای برای منابع تماس وجود ندارد.</p>}
      </article>
    </div>
  );
}
