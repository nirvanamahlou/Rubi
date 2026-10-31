'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/overlays';
import { readApi } from './read-client';
import { callDate, faNumber } from './model';
import { useDialogReturnFocus } from './use-dialog-focus';
import styles from './without-outcome-dialog.module.css';

export function WithoutOutcomeDialog({
  mode = 'without-outcome',
  branch,
  revision,
  hidden,
  canComplete,
  onClose,
  onComplete,
}: {
  mode?: 'without-outcome' | 'missed-callbacks' | 'today' | 'week';
  branch: string;
  revision: number;
  hidden: boolean;
  canComplete: boolean;
  onClose: () => void;
  onComplete: (id: string) => Promise<void>;
}) {
  const callbacks = mode === 'missed-callbacks';
  const period = mode === 'today' || mode === 'week';
  const title = period
    ? mode === 'today'
      ? 'تماس‌های امروز'
      : 'تماس‌های هفته'
    : callbacks
      ? 'تماس‌های ازدست‌رفته نیازمند تماس مجدد'
      : 'تماس‌های بدون نتیجه';
  const restoreFocus = useDialogReturnFocus();
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof readApi.withoutOutcome>
  > | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const snapshot = useRef<string | undefined>(undefined);
  useEffect(() => {
    const controller = new AbortController();
    (mode === 'today'
      ? readApi.todayCalls
      : mode === 'week'
        ? readApi.weekCalls
        : callbacks
          ? readApi.missedCallbacks
          : readApi.withoutOutcome)(
      branch,
      page,
      page === 1 ? undefined : snapshot.current,
      controller.signal,
    )
      .then((value) => {
        if (!controller.signal.aborted) {
          setResult(value);
          snapshot.current = value.meta.revision;
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setResult(null);
          setError(
            reason instanceof Error
              ? reason.message
              : 'دریافت تماس‌ها انجام نشد.',
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [branch, page, revision, retry, callbacks, mode]);
  const refresh = () => {
    setLoading(true);
    setError('');
    snapshot.current = undefined;
    setPage(1);
    setRetry((v) => v + 1);
  };
  return (
    <Dialog
      open={!hidden}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className={styles.dialog} onCloseAutoFocus={restoreFocus}>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          {period
            ? mode === 'today'
              ? 'تماس‌های امروز از ابتدای روز تا اکنون به وقت تهران؛ مستقل از فیلترهای مخاطبان.'
              : 'تماس‌های هفته از ابتدای شنبه تا اکنون به وقت تهران؛ مستقل از فیلترهای مخاطبان.'
            : callbacks
              ? 'هر ردیف یک مخاطب نیازمند تماس مجدد است؛ اطلاعات آخرین تماس بی‌پاسخ او را می‌توانید ویرایش کنید.'
              : 'هر ردیف یک تماس با نتیجه ثبت‌نشده است؛ همه سوابق شعبه انتخاب‌شده، مستقل از فیلترهای مخاطبان.'}
        </DialogDescription>
        <div className={styles.toolbar}>
          <span aria-live="polite">
            {loading
              ? 'در حال دریافت تماس‌ها…'
              : result
                ? `${faNumber(result.meta.total)} ${callbacks ? 'مخاطب' : 'تماس'}`
                : ''}
          </span>
          <button type="button" onClick={refresh} disabled={loading}>
            تازه‌سازی فهرست
          </button>
        </div>
        {error && (
          <p role="alert">
            {error}{' '}
            <button type="button" onClick={refresh}>
              تلاش مجدد
            </button>
          </p>
        )}
        {!loading && result?.data.length === 0 && (
          <p role="status">
            {period
              ? 'تماسی در این بازه در دسترسی شما وجود ندارد.'
              : callbacks
                ? 'مخاطب نیازمند تماس مجددی در دسترسی شما وجود ندارد.'
                : 'تماس بدون نتیجه‌ای در دسترسی شما وجود ندارد.'}
          </p>
        )}
        <div className={styles.scroll} aria-busy={loading}>
          <table>
            <thead>
              <tr>
                {[
                  'نام مخاطب',
                  'شماره تماس',
                  'موضوع تماس',
                  'منبع',
                  'واحد',
                  callbacks ? 'آخرین تماس بی‌پاسخ' : 'زمان تماس',
                  'تعداد تماس مخاطب',
                  'نتیجه',
                  'اقدامات',
                ].map((label) => (
                  <th key={label} scope="col">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loading &&
                result?.data.map(({ call, callCount }) => (
                  <tr key={call.id}>
                    <td>{call.name || 'مخاطب ناشناس'}</td>
                    <td dir="ltr">{call.phone || 'نامعلوم'}</td>
                    <td>{call.subject || '—'}</td>
                    <td>{call.source || 'نامشخص'}</td>
                    <td>
                      {call.answerRecipient?.label || call.operator || 'نامشخص'}
                    </td>
                    <td>{callDate(call.occurredAt)}</td>
                    <td>{faNumber(callCount)}</td>
                    <td>
                      <span className={styles.badge}>
                        {period
                          ? ((
                              {
                                ANSWERED: 'پاسخ داده شده',
                                NO_ANSWER: 'بدون پاسخ',
                                BUSY: 'مشغول',
                                FAILED: 'ناموفق',
                              } as Record<string, string>
                            )[call.outcome ?? ''] ?? 'نتیجه ثبت‌نشده')
                          : callbacks
                            ? 'نیازمند تماس مجدد'
                            : 'نتیجه ثبت‌نشده'}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        <button
                          type="button"
                          disabled={!canComplete}
                          onClick={() => void onComplete(call.id)}
                        >
                          ویرایش اطلاعات تماس
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <nav
          className={styles.pagination}
          aria-label={
            period
              ? 'صفحه‌بندی تماس‌های بازه'
              : callbacks
                ? 'صفحه‌بندی مخاطبان نیازمند تماس مجدد'
                : 'صفحه‌بندی تماس‌های بدون نتیجه'
          }
        >
          <button
            type="button"
            disabled={loading || !!error || page <= 1}
            onClick={() => {
              setLoading(true);
              setPage((v) => v - 1);
            }}
          >
            قبلی
          </button>
          <span>
            {faNumber(page)} /{' '}
            {faNumber(Math.max(1, Math.ceil((result?.meta.total ?? 0) / 20)))}
          </span>
          <button
            type="button"
            disabled={
              loading || !!error || !result || page * 20 >= result.meta.total
            }
            onClick={() => {
              setLoading(true);
              setPage((v) => v + 1);
            }}
          >
            بعدی
          </button>
        </nav>
      </DialogContent>
    </Dialog>
  );
}
