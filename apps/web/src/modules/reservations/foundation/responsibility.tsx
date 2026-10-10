'use client';
import { useEffect, useState } from 'react';
import type { ReservationOperationSummaryV1 } from '@nora/contracts';
import { travelRequest } from '../components/travel-workflow-form';
import styles from './action-panel.module.css';
const time = (value: string | null) =>
  value
    ? new Date(value).toLocaleString('fa-IR', {
        timeZone: 'Asia/Tehran',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        hourCycle: 'h23',
        minute: '2-digit',
        second: '2-digit',
      })
    : 'ثبت نشده';
export function ReservationResponsibilityView({
  data,
}: {
  data: ReservationOperationSummaryV1;
}) {
  return (
    <div className={styles.responsibility} aria-label="مسئولیت و تحویل مدارک">
      <div className={styles.responsibilityItem}>
        <strong>آخرین تغییر رزرواسیون</strong>
        <span>
          {data.lastOperation
            ? (data.lastOperation.actorName ?? 'نام مسئول در دسترس نیست')
            : 'عملیاتی ثبت نشده'}
        </span>
        {data.lastOperation && (
          <time dateTime={data.lastOperation.occurredAt}>
            {time(data.lastOperation.occurredAt)}
          </time>
        )}
      </div>
      <div className={styles.responsibilityItem}>
        <strong>
          <input
            type="checkbox"
            checked={data.delivery.approved}
            disabled
            aria-label="تأیید مالی تحویل مدارک"
          />{' '}
          تحویل مدارک ·{' '}
          {data.delivery.approved ? 'تأیید مالی شده' : 'تأیید مالی نشده'}
        </strong>
        <span>
          {data.delivery.actorName ??
            (data.delivery.updatedAt
              ? 'نام مسئول در دسترس نیست'
              : 'مسئول: ثبت نشده')}
        </span>
        <time
          {...(data.delivery.updatedAt
            ? { dateTime: data.delivery.updatedAt }
            : {})}
        >
          {time(data.delivery.updatedAt)}
        </time>
      </div>
    </div>
  );
}
export function ReservationResponsibility({ id }: { id: string }) {
  const [data, setData] = useState<ReservationOperationSummaryV1 | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true,
      running = false;
    const refresh = async () => {
      if (running || document.visibilityState === 'hidden') return;
      running = true;
      try {
        const result = await travelRequest<{
          data: ReservationOperationSummaryV1;
        }>(`reservations/requests/${id}/operation-summary`);
        if (active) {
          setData(result.data);
          setError('');
        }
      } catch {
        if (active) setError('وضعیت تحویل و مسئول عملیات دریافت نشد.');
      } finally {
        running = false;
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    const resume = () => void refresh();
    window.addEventListener('reservation-workflow-changed', resume);
    window.addEventListener('focus', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('reservation-workflow-changed', resume);
      window.removeEventListener('focus', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [id]);
  if (error)
    return (
      <span role="status" className={styles.summaryLoading}>
        {error}
      </span>
    );
  if (!data)
    return (
      <span role="status" className={styles.summaryLoading}>
        دریافت وضعیت تحویل مدارک…
      </span>
    );
  return <ReservationResponsibilityView data={data} />;
}
