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
  onEdit,
  editDisabled,
  hidden,
}: {
  onEdit?: ((id: string) => void) | undefined;
  editDisabled?: boolean | undefined;
  hidden?: boolean | undefined;
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
    position += data.contacts ? (source.count / data.contacts) * 100 : 0;
    return `${colors[index % colors.length]} ${start}% ${position}%`;
  });
  const gradient =
    data.contacts && sources.length
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
          onEdit={onEdit}
          editDisabled={editDisabled}
          hidden={hidden}
        />
      </article>
      <article className={styles.reportCard}>
        <h3>
          <BarChart3 size={19} /> سهم منابع آشنایی
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
                      width: `${data.contacts ? (source.count / data.contacts) * 100 : 0}%`,
                      background: colors[index % colors.length],
                    }}
                  />
                </span>
                <small>
                  {data.contacts
                    ? `${faNumber(Math.round((source.count / data.contacts) * 100))}٪`
                    : '—'}
                </small>
              </div>
            ))}
          </div>
          <div
            className={styles.sourceDonut}
            style={{ background: gradient }}
            role="img"
            aria-label={`توزیع منابع ${faNumber(data.contacts)} مخاطب؛ مقادیر در راهنمای رنگی درج شده‌اند`}
          >
            <div>
              <small>کل مخاطبان</small>
              <strong>{faNumber(data.contacts)}</strong>
            </div>
          </div>
        </div>
        {!sources.length && <p>داده‌ای برای منابع تماس وجود ندارد.</p>}
      </article>
    </div>
  );
}
