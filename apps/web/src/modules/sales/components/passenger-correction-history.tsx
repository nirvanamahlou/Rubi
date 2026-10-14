'use client';
import { useEffect, useState } from 'react';
import type { SalesPassengerCorrectionHistoryV1 } from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { salesApi } from '../api/client';

export const correctionFieldLabels = {
  birthDate: 'تاریخ تولد',
  passportNumber: 'شماره پاسپورت',
  passportExpiryDate: 'انقضای پاسپورت',
} as const;
export function PassengerCorrectionHistory({
  contractId,
  eventId,
}: {
  contractId: string;
  eventId?: string;
}) {
  const [items, setItems] = useState<SalesPassengerCorrectionHistoryV1[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [focus, setFocus] = useState(eventId);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void salesApi
      .passengerCorrectionHistory(contractId, undefined, focus)
      .then((result) => {
        if (active) {
          setItems(result.items);
          setCursor(result.nextCursor);
          setError('');
        }
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : 'دریافت سوابق اصلاح ناموفق بود.',
          );
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [contractId, focus]);
  async function more() {
    if (!cursor || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await salesApi.passengerCorrectionHistory(
        contractId,
        cursor,
      );
      setItems((old) => [...old, ...result.items]);
      setCursor(result.nextCursor);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'دریافت سوابق اصلاح ناموفق بود.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="grid gap-3" aria-label="سوابق اصلاح قرارداد">
      {focus ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setFocus(undefined);
            setBusy(true);
          }}
        >
          نمایش همه سوابق اصلاح
        </Button>
      ) : null}
      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : null}
      {busy ? <p role="status">در حال دریافت سوابق…</p> : null}
      {!busy && !error && !items.length ? <p>اصلاحی ثبت نشده است.</p> : null}
      {items.map((item) => (
        <article
          key={item.id}
          className="grid gap-2 rounded-xl border border-purple-300 bg-purple-50 p-3 text-slate-950 dark:bg-purple-950/30 dark:text-slate-100"
        >
          <p>
            <b>{item.actorName}</b> ·{' '}
            {new Date(item.occurredAt).toLocaleString('fa-IR', {
              timeZone: 'Asia/Tehran',
            })}{' '}
            · نسخه {item.version}
          </p>
          {item.note ? (
            <p className="whitespace-pre-wrap">
              <b>توضیحات برای رزرواسیون:</b> {item.note}
            </p>
          ) : null}
          {item.changes.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th>مسافر</th>
                    <th>فیلد اصلاح‌شده</th>
                    <th>قبل</th>
                    <th>بعد</th>
                  </tr>
                </thead>
                <tbody>
                  {item.changes.map((change) => (
                    <tr key={change.customerId + change.field}>
                      <td>{change.name}</td>
                      <td>{correctionFieldLabels[change.field]}</td>
                      <td dir="ltr">
                        {change.masked ? 'محافظت‌شده' : change.before || '—'}
                      </td>
                      <td dir="ltr">
                        {change.masked ? 'محافظت‌شده' : change.after || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </article>
      ))}
      {cursor ? (
        <Button
          type="button"
          disabled={busy}
          variant="outline"
          onClick={() => void more()}
        >
          سوابق قدیمی‌تر
        </Button>
      ) : null}
    </section>
  );
}
