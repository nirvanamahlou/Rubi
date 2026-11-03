'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/overlays';
import {
  readApi,
  type Report,
  type SearchFilters,
  type ExpertMetric,
  type ActivityDetail,
} from './read-client';
import { faNumber } from './model';
import styles from './workspace.module.css';
const columns: [ExpertMetric, string][] = [
  ['inboundAnswered', 'ورودی پاسخ‌داده‌شده'],
  ['outboundAttempts', 'تلاش خروجی'],
  ['outboundConnected', 'خروجی برقرارشده'],
  ['uniqueContacts', 'شمارهٔ مخاطب یکتا'],
  ['open', 'پیگیری باز'],
  ['overdue', 'عقب‌افتاده'],
  ['completion', 'تکمیل اطلاعات'],
];
const labels: Record<string, string> = {
  INBOUND: 'ورودی',
  OUTBOUND: 'خروجی',
  FOLLOW_UP: 'پیگیری',
  CONNECTED: 'برقرارشده',
  NOT_CONNECTED: 'برقرارنشده',
  OPEN: 'باز',
  COMPLETE: 'تکمیل‌شده',
  INCOMPLETE: 'نیازمند تکمیل',
};
export function ExpertActivity({
  data,
  branch,
  filters,
  meta,
}: {
  data: Report['data'];
  branch?: string | undefined;
  filters?: SearchFilters | undefined;
  meta?: Report['meta'] | undefined;
}) {
  const [selected, setSelected] = useState<{
      id: string;
      name: string;
      metric: ExpertMetric;
    } | null>(null),
    [page, setPage] = useState(1),
    [result, setResult] = useState<{
      key: string;
      detail: ActivityDetail | null;
      error: string;
    } | null>(null);
  const requestKey = JSON.stringify([selected, branch, filters, meta, page]);
  const current = result?.key === requestKey ? result : null;
  const detail = current?.detail ?? null;
  const error = current?.error ?? '';
  const loading = !!selected && !current;
  const generation = useRef(0);
  useEffect(() => {
    if (!selected || !branch || !filters || !meta) return;
    const abort = new AbortController(),
      g = ++generation.current;
    readApi
      .expertDetail(
        branch,
        filters,
        meta.from,
        meta.to,
        selected.id,
        selected.metric,
        page,
        abort.signal,
      )
      .then((r) => {
        if (g === generation.current && !abort.signal.aborted) {
          if (!r.data.activityDetail) throw Error('جزئیات در دسترس نیست.');
          setResult({
            key: requestKey,
            detail: r.data.activityDetail,
            error: '',
          });
        }
      })
      .catch(() => {
        if (g === generation.current && !abort.signal.aborted)
          setResult({
            key: requestKey,
            detail: null,
            error: 'دریافت جزئیات ممکن نشد؛ دوباره تلاش کنید.',
          });
      });
    return () => abort.abort();
  }, [selected, branch, filters, meta, page, requestKey]);
  const report = data.expertActivity;
  return (
    <>
      <p className={styles.formHint}>
        تماس‌های تلفنی دارای انتساب معتبر در بازه و فیلتر گزارش؛ پیگیری باز و
        عقب‌افتاده در وضعیت فعلی شعبه. ترتیب: عقب‌افتاده، باز، اطلاعات ناقص،
        نام.
      </p>
      {!report ? (
        <p>منبع گزارش کارشناسان در دسترس نیست.</p>
      ) : !report.rows.length ? (
        <p>کارشناس یا فعالیت دارای انتساب معتبر در محدودهٔ دسترسی نیست.</p>
      ) : (
        <div className={styles.operatorScroll}>
          <table className={`${styles.table} ${styles.centeredTable}`}>
            <thead>
              <tr>
                <th>کارشناس / داخلی‌ها</th>
                {columns.map(([key, label]) => (
                  <th key={key}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    {row.name}
                    <div dir="ltr">{row.extensions.join('، ') || '—'}</div>
                    {row.shared && <small>تماس چندکارشناسی</small>}
                  </td>
                  {columns.map(([metric, label]) => {
                    const count =
                      metric === 'completion' ? row.total : row[metric];
                    const text =
                      metric === 'completion'
                        ? row.completionRate === null
                          ? '—'
                          : `${faNumber(Math.round(row.completionRate * 100))}٪ (${faNumber(row.total - row.incomplete)} از ${faNumber(row.total)})`
                        : faNumber(count);
                    return (
                      <td key={metric}>
                        <button
                          type="button"
                          className={styles.rankingCount}
                          disabled={!count || !branch || !filters || !meta}
                          aria-label={`${label}؛ ${row.name}`}
                          onClick={() => {
                            setResult(null);
                            setPage(1);
                            setSelected({ id: row.id, name: row.name, metric });
                          }}
                        >
                          {text}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!!report?.unattributed && (
        <p role="status">
          {faNumber(report.unattributed)} تماس بدون انتساب معتبر در این محدوده؛
          به کارشناس حدس زده نمی‌شود.
        </p>
      )}
      <p className={styles.formHint}>
        نام و داخلی‌های فهرست فعلی HR؛ انتساب تماس از مسئولیت پاسخ یا پیشنهاد
        ثبت‌شدهٔ تماس خروجی است. تماس چندکارشناسی برای هر فرد یک‌بار محاسبه
        می‌شود؛ جمع ردیف‌ها لزوماً کل تماس‌ها نیست. شمارهٔ نامعلوم جزو مخاطب
        یکتا نیست. «—» یعنی مخرجی برای درصد وجود ندارد.
      </p>
      {selected && (
        <Dialog
          open
          onOpenChange={(v) => {
            if (!v) setSelected(null);
          }}
        >
          <DialogContent dir="rtl">
            <DialogTitle>
              {columns.find(([k]) => k === selected.metric)?.[1]} —{' '}
              {selected.name}
            </DialogTitle>
            <DialogDescription>
              زمان‌ها بر اساس تهران؛ جزئیات از همان محدودهٔ مجاز گزارش دوباره
              خوانده می‌شوند.
            </DialogDescription>
            {loading ? (
              <p role="status">در حال دریافت…</p>
            ) : error ? (
              <div role="alert">
                {error}
                <button
                  type="button"
                  onClick={() => {
                    setResult(null);
                    setSelected({ ...selected });
                  }}
                >
                  تلاش مجدد
                </button>
              </div>
            ) : (
              detail &&
              detail.actorId === selected.id &&
              detail.metric === selected.metric &&
              detail.page === page && (
                <>
                  <p>{faNumber(detail.total)} مورد</p>
                  <div className={styles.operatorScroll}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>زمان / سررسید</th>
                          <th>نوع</th>
                          <th>وضعیت</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.rows.map((r, i) => (
                          <tr key={i}>
                            <td>
                              {r.at
                                ? new Intl.DateTimeFormat('fa-IR', {
                                    timeZone: 'Asia/Tehran',
                                    dateStyle: 'short',
                                    timeStyle: 'short',
                                  }).format(new Date(r.at))
                                : 'بدون سررسید'}
                            </td>
                            <td>
                              {labels[r.kind] ?? r.kind}
                              {r.extension && ` · ${r.extension}`}
                              {r.shared && ' · چندکارشناسی'}
                            </td>
                            <td>{labels[r.result] ?? r.result}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    قبلی
                  </button>{' '}
                  {faNumber(page)} /{' '}
                  {faNumber(Math.max(1, Math.ceil(detail.total / 20)))}{' '}
                  <button
                    type="button"
                    disabled={page * 20 >= detail.total}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    بعدی
                  </button>
                </>
              )
            )}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
