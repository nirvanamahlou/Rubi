import type { RequestCase } from './workflow-client';
import { callDate } from './model';
import styles from './workflow.module.css';

export function requestClosedAt(request: RequestCase) {
  if (request.status !== 'CLOSED') return null;
  let closedAt: string | null = null;
  let previous = '';
  for (const event of request.privateHistory ?? []) {
    if (event.status === 'CLOSED' && previous !== 'CLOSED') closedAt = event.at;
    if (event.status !== 'CLOSED') closedAt = null;
    previous = event.status;
  }
  return closedAt;
}

export function DossierRequestCard({
  request,
  canManage,
  onEdit,
}: {
  request: RequestCase;
  canManage: boolean;
  onEdit: () => void;
}) {
  const closedAt = requestClosedAt(request);
  return (
    <article className={styles.card}>
      <p>
        <strong>عنوان درخواست: {request.title}</strong>
      </p>
      <p style={{ whiteSpace: 'pre-wrap' }}>
        دلیل تغییر، بستن یا بازگشایی: {request.reason || 'ثبت نشده'}
      </p>
      <p>کارشناس مسئول: {request.ownerName || 'بدون مسئول'}</p>
      <p>
        اولویت:{' '}
        {(
          { NORMAL: 'عادی', HIGH: 'بالا', URGENT: 'فوری' } as Record<
            string,
            string
          >
        )[request.priority] ?? request.priority}
      </p>
      <p>
        وضعیت:{' '}
        {(
          {
            NEW: 'منتظر اقدام کارشناس',
            IN_PROGRESS: 'منتظر اقدام کارشناس',
            WAITING_CUSTOMER: 'منتظر پاسخ مشتری',
            CLOSED: 'بسته‌شده',
          } as Record<string, string>
        )[request.status] ?? request.status}
      </p>
      <p>
        تاریخ و ساعت باز شدن:{' '}
        <time dateTime={request.createdAt}>{callDate(request.createdAt)}</time>
      </p>
      {request.status === 'CLOSED' && (
        <p>
          تاریخ و ساعت بسته شدن:{' '}
          {closedAt ? (
            <time dateTime={closedAt}>{callDate(closedAt)}</time>
          ) : (
            'ثبت نشده'
          )}
        </p>
      )}
      <button type="button" disabled={!canManage} onClick={onEdit}>
        ویرایش درخواست
      </button>
    </article>
  );
}
