import type { SiteReport } from '../api/client';
import { Card } from '@/components/ui/surfaces';
import {
  dailySeries,
  reportCount,
  activityTitle,
  type SiteReportResult,
} from '../report-model';
import { Eye, UsersRound, Globe2, Clock3, ArrowUpRight } from 'lucide-react';
import styles from './site-report.module.css';

export function SiteTrend({
  report,
  metric,
}: {
  report: SiteReport | null;
  metric: string;
}) {
  if (!report || !report.trends[metric])
    return (
      <p className="py-10 text-muted-foreground">
        داده روند در دسترس نیست یا مجوز ندارید.
      </p>
    );
  const rows = dailySeries(report, metric),
    max = Math.max(1, ...rows.map((row) => row.value));
  const points = rows
    .map(
      (row, index) =>
        `${20 + (index * 560) / Math.max(rows.length - 1, 1)},${180 - (row.value * 150) / max}`,
    )
    .join(' ');
  return (
    <div className="grid gap-3">
      <svg
        viewBox="0 0 600 205"
        className="w-full"
        role="img"
        aria-label="روند روزانه تعداد؛ جزئیات در جدول زیر"
      >
        <path
          d="M20 20 V180 H580"
          fill="none"
          stroke="currentColor"
          opacity=".25"
        />
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="text-primary"
        />
      </svg>
      <details>
        <summary className="cursor-pointer text-sm">
          جدول روزانه این بازه
        </summary>
        <div className="max-h-60 overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th>تاریخ</th>
                <th>تعداد</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.date}>
                  <td>
                    {new Date(row.date + 'T12:00:00Z').toLocaleDateString(
                      'fa-IR',
                      { timeZone: 'Asia/Tehran' },
                    )}
                  </td>
                  <td>{reportCount(row.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
export function SiteVisits({
  report,
  label,
  siteName,
  loading,
  state,
  compact = false,
}: {
  report: SiteReport | null;
  label: string;
  siteName: string;
  loading: boolean;
  state?: SiteReportResult['state'] | undefined;
  compact?: boolean;
}) {
  const empty = loading
    ? 'در حال دریافت…'
    : state === 'forbidden'
      ? 'دسترسی گزارش فعال نیست'
      : state === 'error'
        ? 'گزارش دریافت نشد'
        : 'گزارش این سایت هنوز متصل نیست';
  const days = report?.visits.daily ?? [];
  const visitsAvailable = report && report.visits.available !== false;
  const max = Math.max(1, ...days.map((day) => day.views));
  const HistoryContainer = compact ? 'div' : 'details';
  const HistoryHeading = compact ? 'p' : 'summary';
  const history = (
    <>
      {report?.visits.coverageFrom ? (
        <p className={styles.empty}>
          ثبت بازدید از{' '}
          {new Date(report.visits.coverageFrom).toLocaleString('fa-IR', {
            timeZone: 'Asia/Tehran',
          })}{' '}
          آغاز شده است؛ پیش از آن سابقه‌ای ثبت نشده است.
        </p>
      ) : null}
      {!visitsAvailable ? (
        <p role="status" className={styles.empty}>
          {report
            ? 'ثبت بازدید این سایت هنوز فعال نشده است یا مجوز آن را ندارید.'
            : empty}
        </p>
      ) : days.length ? (
        <HistoryContainer className={styles.daily}>
          <HistoryHeading>
            جزئیات روزانه{' '}
            <span>{days.length.toLocaleString('fa-IR')} روز دارای بازدید</span>
          </HistoryHeading>
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>روز</th>
                  <th>بازدید صفحه</th>
                  <th>مرورگر یکتا</th>
                  <th className={styles.barHeading}>مقایسه بازدید</th>
                </tr>
              </thead>
              <tbody>
                {days.map((day) => (
                  <tr key={day.date}>
                    <th>
                      {new Date(day.date + 'T12:00:00Z').toLocaleDateString(
                        'fa-IR',
                        {
                          month: 'short',
                          day: 'numeric',
                          timeZone: 'Asia/Tehran',
                        },
                      )}
                    </th>
                    <td>{reportCount(day.views)}</td>
                    <td>{reportCount(day.visitors)}</td>
                    <td className={styles.barCell}>
                      <span className={styles.barTrack}>
                        <span
                          style={{ width: `${(day.views * 100) / max}%` }}
                        />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </HistoryContainer>
      ) : (
        <p className={styles.empty}>در این بازه بازدیدی ثبت نشده است.</p>
      )}
    </>
  );
  return (
    <Card className={`${styles.visits} ${compact ? styles.compact : ''}`}>
      <header className={styles.header}>
        <div className={styles.title}>
          <span className={styles.siteIcon}>
            <Globe2 aria-hidden="true" />
          </span>
          <div>
            <h3>{compact ? siteName : <>بازدید {siteName}</>}</h3>
            {!compact ? <p>{label}</p> : null}
          </div>
        </div>
        {!compact ? <span className={styles.unit}>بازه انتخاب‌شده</span> : null}
      </header>
      <div className={styles.metrics} aria-busy={loading}>
        <div className={styles.metric}>
          <span className={styles.metricIcon}>
            <UsersRound aria-hidden="true" />
          </span>
          <div>
            <span title="شناسه ناشناس مرورگر؛ معادل تعداد قطعی اشخاص نیست">
              بازدیدکننده یکتا <small>(مرورگر)</small>
            </span>
            <strong>
              {visitsAvailable
                ? reportCount(report.visits.uniqueBrowsers)
                : '—'}
            </strong>
          </div>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricIcon}>
            <Eye aria-hidden="true" />
          </span>
          <div>
            <span>بازدید صفحه</span>
            <strong>
              {visitsAvailable ? reportCount(report.visits.pageViews) : '—'}
            </strong>
          </div>
        </div>
      </div>
      {compact && visitsAvailable ? (
        <details className={styles.compactDetails}>
          <summary>جزئیات بازدید</summary>
          {history}
        </details>
      ) : (
        history
      )}
    </Card>
  );
}
export function SiteActivity({
  report,
  siteName,
  loading,
}: {
  report: SiteReport | null;
  siteName: string;
  loading: boolean;
}) {
  if (!report)
    return (
      <p className={styles.empty}>
        {loading ? 'دریافت فعالیت‌ها…' : 'فعالیت‌های این سایت در دسترس نیست.'}
      </p>
    );
  if (!report.activityAvailable)
    return <p className={styles.empty}>مجوز مشاهده فعالیت‌ها فعال نیست.</p>;
  if (!report.activity.length)
    return <p className={styles.empty}>فعالیتی در این بازه ثبت نشده است.</p>;
  return (
    <ul className={styles.activities} aria-label={`فعالیت‌های ${siteName}`}>
      {report.activity.map((row) => (
        <li
          key={
            row.id ??
            `${row.resource}:${row.externalId}:${row.version}:${row.occurredAt}`
          }
        >
          <span className={styles.activityIcon}>
            <ArrowUpRight aria-hidden="true" />
          </span>
          <div>
            <p>{activityTitle(row.resource, row.operation)}</p>
            <span>شناسه {row.externalId}</span>
          </div>
          <time
            dateTime={row.occurredAt}
            title={new Date(row.occurredAt).toLocaleString('fa-IR', {
              timeZone: 'Asia/Tehran',
            })}
          >
            <Clock3 aria-hidden="true" />
            {new Date(row.occurredAt).toLocaleTimeString('fa-IR', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'Asia/Tehran',
            })}
            <small>
              {new Date(row.occurredAt).toLocaleDateString('fa-IR', {
                month: 'short',
                day: 'numeric',
                timeZone: 'Asia/Tehran',
              })}
            </small>
          </time>
        </li>
      ))}
    </ul>
  );
}
