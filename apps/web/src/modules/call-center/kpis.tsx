'use client';

import { useEffect, useState } from 'react';
import { readApi, type CallKpis } from './read-client';
import { callDate, faNumber } from './model';
import styles from './workflow.module.css';

const cards = [
  ['today', 'تعداد تماس امروز', 'از ابتدای امروز تا اکنون'],
  ['week', 'تعداد تماس هفته', 'از شنبه تا اکنون'],
  ['withoutOutcome', 'تماس‌های بدون نتیجه', 'نتیجه ثبت‌نشده · همه سوابق'],
  [
    'needsFollowUp',
    'تماس‌های ازدست‌رفته نیازمند تماس مجدد',
    'شماره‌های یکتا · بدون مکالمه موفق بعدی',
  ],
] as const;

export function CallKpiCards({
  branchId,
  revision,
  onWithoutOutcome,
  onMissedCallbacks,
  onPeriod,
}: {
  branchId: string;
  revision: string;
  onWithoutOutcome?: (() => void) | undefined;
  onPeriod?: ((period: 'today' | 'week') => void) | undefined;
  onMissedCallbacks?: (() => void) | undefined;
}) {
  const [data, setData] = useState<CallKpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    async function load() {
      if (pending) return;
      pending = true;
      setLoading(true);
      try {
        const result = await readApi.kpis(branchId, controller.signal);
        if (!controller.signal.aborted) {
          setData(result);
          setError('');
        }
      } catch (reason) {
        if (!controller.signal.aborted) {
          setData(null);
          setError(
            reason instanceof Error
              ? reason.message
              : 'دریافت آمار تماس‌ها انجام نشد.',
          );
        }
      } finally {
        pending = false;
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    const timer = setInterval(() => void load(), 60000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [branchId, revision, retry]);
  return (
    <section aria-label="آمار تماس‌ها" aria-busy={loading}>
      <div className={styles.actionCards}>
        {cards.map(([key, label, description]) => (
          <article
            key={key}
            aria-label={label}
            data-tone={key}
            role={
              ((key === 'today' || key === 'week') && onPeriod) ||
              (key === 'withoutOutcome' && onWithoutOutcome) ||
              (key === 'needsFollowUp' && onMissedCallbacks)
                ? 'button'
                : undefined
            }
            tabIndex={
              ((key === 'today' || key === 'week') && onPeriod) ||
              (key === 'withoutOutcome' && onWithoutOutcome) ||
              (key === 'needsFollowUp' && onMissedCallbacks)
                ? 0
                : undefined
            }
            onClick={
              key === 'today' || key === 'week'
                ? () => onPeriod?.(key)
                : key === 'withoutOutcome'
                  ? onWithoutOutcome
                  : key === 'needsFollowUp'
                    ? onMissedCallbacks
                    : undefined
            }
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                if (key === 'today' || key === 'week') onPeriod?.(key);
                else if (key === 'withoutOutcome') onWithoutOutcome?.();
                else onMissedCallbacks?.();
              }
            }}
          >
            <span>{label}</span>
            <strong>
              {loading ? '…' : data ? faNumber(data.data[key]) : '—'}
            </strong>
            <small>{description}</small>
          </article>
        ))}
      </div>
      <p className={styles.kpiScope}>
        شعبه انتخاب‌شده · زمان تهران · مستقل از فیلترهای فهرست
        {data && !loading && <> · {callDate(data.meta.asOf)}</>}
      </p>
      {error && (
        <p role="alert">
          {error}{' '}
          <button type="button" onClick={() => setRetry((value) => value + 1)}>
            تلاش مجدد
          </button>
        </p>
      )}
    </section>
  );
}
