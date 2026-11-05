'use client';
import { ExpertActivity } from './expert-activity';
import { SourceShareChart } from './source-share-chart';
import type { SearchFilters } from './read-client';
import { IllustrationIcon } from '@/components/ui/illustration-icon';
import type { Report } from './read-client';
import type { Operator } from './workflow-client';
import styles from './workspace.module.css';
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
  return (
    <div className={styles.highlights}>
      <article className={`${styles.reportCard} ${styles.expertCard}`}>
        <h3>
          <IllustrationIcon kind="chart" size={28} />
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
          <IllustrationIcon kind="layers" size={28} /> سهم منابع آشنایی
        </h3>
        <SourceShareChart sources={sources} total={data.contacts} />
        {!sources.length && <p>داده‌ای برای منابع تماس وجود ندارد.</p>}
      </article>
    </div>
  );
}
