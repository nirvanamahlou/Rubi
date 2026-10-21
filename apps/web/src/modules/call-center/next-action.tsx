'use client';
import { useEffect, useState } from 'react';
import { workflowApi } from './workflow-client';
import { callDate } from './model';
import { requestLabels } from './workflow';
import styles from './workspace.module.css';

export function NextAction({
  branch,
  contactId,
  revision,
  onOpen,
}: {
  branch: string;
  contactId: string;
  revision: number;
  onOpen: () => void;
}) {
  const [data, setData] = useState<Awaited<
    ReturnType<typeof workflowApi.nextAction>
  > | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    workflowApi
      .nextAction(branch, contactId, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setData(result);
          setError('');
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setData(null);
          setError('دریافت اقدام بعدی انجام نشد.');
        }
      });
    return () => controller.abort();
  }, [branch, contactId, revision, retry]);
  return (
    <section className={styles.nextAction} aria-label="اقدام بعدی">
      <h3>اقدام بعدی</h3>
      {error ? (
        <p role="alert">
          {error}{' '}
          <button
            onClick={() => {
              setError('');
              setRetry((v) => v + 1);
            }}
          >
            تلاش مجدد
          </button>
        </p>
      ) : !data ? (
        <p role="status">در حال دریافت…</p>
      ) : data.data ? (
        <>
          <strong>{data.data.action}</strong>
          <p>درخواست: {data.data.requestTitle}</p>
          <p>
            {requestLabels[data.data.requestStatus]} ·{' '}
            {data.data.ownerName ?? 'نام مسئول در دسترس نیست'}
          </p>
          <time dateTime={data.data.dueAt}>{callDate(data.data.dueAt)}</time>
          {data.data.overdue && (
            <p className={styles.overdue}>موعد گذشته؛ نیازمند رسیدگی</p>
          )}
        </>
      ) : (
        <p>برای درخواست‌های باز این مخاطب پیگیری بازی ثبت نشده است.</p>
      )}
      <button className={styles.secondary} onClick={onOpen}>
        بررسی درخواست‌ها و ثبت نتیجه
      </button>
    </section>
  );
}
