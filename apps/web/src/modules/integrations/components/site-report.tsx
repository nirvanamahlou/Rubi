import type { SiteReport } from '../api/client';
import { Card } from '@/components/ui/surfaces';
import { dailySeries, reportCount } from '../report-model';
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
}: {
  report: SiteReport | null;
  label: string;
}) {
  return (
    <Card className="grid gap-4 p-5">
      <div>
        <h3 className="font-bold">بازدید سایت متصل</h3>
        <p className="mt-1 text-sm text-muted-foreground">{label}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <p>
          مرورگرهای یکتای کل بازه{' '}
          <strong className="block text-2xl">
            {report
              ? reportCount(report.visits.uniqueBrowsers)
              : 'داده موجود نیست'}
          </strong>
        </p>
        <p>
          تعداد بازدید صفحه{' '}
          <strong className="block text-2xl">
            {report ? reportCount(report.visits.pageViews) : 'داده موجود نیست'}
          </strong>
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        شناسه ناشناس مرورگر عمومی سایت؛ تعداد قطعی اشخاص نیست. بازدید پنل مدیریت
        و حساب کاربری محاسبه نمی‌شود. پاک‌کردن شناسه یا مرورگرهای مختلف شمارش را
        تغییر می‌دهد.
      </p>
      {report ? (
        <details>
          <summary className="cursor-pointer text-sm">
            بازدید به تفکیک روز
          </summary>
          <div className="max-h-60 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>روز</th>
                  <th>بازدید صفحه</th>
                  <th>مرورگر یکتای همان روز</th>
                </tr>
              </thead>
              <tbody>
                {report.visits.daily.map((row) => (
                  <tr key={row.date}>
                    <td>
                      {new Date(row.date + 'T12:00:00Z').toLocaleDateString(
                        'fa-IR',
                      )}
                    </td>
                    <td>{reportCount(row.views)}</td>
                    <td>{reportCount(row.visitors)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </Card>
  );
}
