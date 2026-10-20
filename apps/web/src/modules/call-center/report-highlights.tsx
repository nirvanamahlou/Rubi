'use client';
import { BarChart3, Trophy, Users } from 'lucide-react';
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
  agents,
}: {
  data: Report['data'];
  agents: Operator[];
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
  const ids = Array.from(
    new Set([
      ...data.registrations.map((a) => a.actorId),
      ...data.tasks.activity.map((a) => a.actorId),
    ]),
  );
  const activity = ids
    .map((id) => ({
      id,
      registered: data.registrations
        .filter((a) => a.actorId === id)
        .reduce((n, a) => n + a.count, 0),
      completed: data.tasks.activity
        .filter((a) => a.actorId === id && a.role === 'COMPLETED_BY')
        .reduce((n, a) => n + a.count, 0),
      open: data.tasks.activity
        .filter((a) => a.actorId === id && a.role === 'CURRENT_OWNER')
        .reduce((n, a) => n + a.count, 0),
    }))
    .sort(
      (a, b) =>
        b.completed - a.completed ||
        b.registered - a.registered ||
        (a.id ?? '').localeCompare(b.id ?? ''),
    );
  return (
    <div className={styles.highlights}>
      <article className={styles.reportCard}>
        <h3>
          <Trophy size={19} /> بیشترین پیگیری
        </h3>
        <p className={styles.formHint}>
          پنج مخاطب با بیشترین تماس خروجی در بازه و فیلتر گزارش
        </p>
        {data.topFollowUps === undefined ? (
          <p>اطلاعات رتبه‌بندی در دسترس نیست.</p>
        ) : data.topFollowUps.length === 0 ? (
          <p>تماس خروجی منطبق با فیلتر ثبت نشده است.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>رتبه</th>
                <th>نام مخاطب</th>
                <th>تعداد پیگیری تلفنی</th>
              </tr>
            </thead>
            <tbody>
              {data.topFollowUps.map((row, index) => (
                <tr key={row.contactId}>
                  <td>{faNumber(index + 1)}</td>
                  <td>{row.name}</td>
                  <td>
                    <span className={styles.rankingCount}>
                      {faNumber(row.count)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>
      <article className={styles.reportCard}>
        <h3>
          <Users size={19} /> عملکرد اپراتورها
        </h3>
        <p className={styles.formHint}>
          ثبت و انجام در بازه؛ مسئولیت باز در وضعیت فعلی شعبه
        </p>
        {!activity.length ? (
          <p>فعالیتی برای نمایش ثبت نشده است.</p>
        ) : (
          <div className={styles.operatorScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>اپراتور</th>
                  <th>ثبت تماس</th>
                  <th>انجام پیگیری</th>
                  <th>مسئول باز</th>
                </tr>
              </thead>
              <tbody>
                {activity.map((row, index) => (
                  <tr key={row.id ?? index}>
                    <td title={row.id ?? undefined}>
                      {agents.find((a) => a.id === row.id)?.displayName ??
                        (row.id ? 'کارشناس خارج از فهرست' : 'نامشخص')}
                    </td>
                    <td>{faNumber(row.registered)}</td>
                    <td>{faNumber(row.completed)}</td>
                    <td>{faNumber(row.open)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
