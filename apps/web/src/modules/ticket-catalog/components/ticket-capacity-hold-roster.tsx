'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui';
import {
  holdClock,
  holdSecondsRemaining,
  readHoldPages,
  type CapacityHoldLoader,
} from '../model/capacity-hold-roster';

type Snapshot = Awaited<ReturnType<typeof readHoldPages>>;
export function TicketCapacityHoldRoster({
  offerId,
  loadPage,
  onCapacityChange,
}: {
  offerId: string;
  loadPage: CapacityHoldLoader;
  onCapacityChange?: () => void;
}) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [problem, setProblem] = useState('');
  const [loading, setLoading] = useState(true);
  const [pageCount, setPageCount] = useState(1);
  const [retry, setRetry] = useState(0);
  const [clock, setClock] = useState(0);
  const notify = useRef(onCapacityChange);
  useEffect(() => {
    notify.current = onCapacityChange;
  }, [onCapacityChange]);
  useEffect(() => {
    const abort = new AbortController();
    let busy = false;
    let current: Snapshot | null = null;
    const noticed = new Set<string>();
    const refresh = async () => {
      if (busy || abort.signal.aborted) return;
      busy = true;
      setLoading(true);
      try {
        const result = await readHoldPages(
          loadPage,
          offerId,
          pageCount,
          abort.signal,
        );
        if (!abort.signal.aborted) {
          const previousSeats = current?.data.reduce(
            (sum, row) => sum + row.quantity,
            0,
          );
          const currentSeats = result.data.reduce(
            (sum, row) => sum + row.quantity,
            0,
          );
          if (previousSeats !== undefined && previousSeats !== currentSeats)
            notify.current?.();
          current = result;
          setSnapshot(result);
          setClock(performance.now());
          setProblem('');
        }
      } catch (cause) {
        if (!abort.signal.aborted)
          setProblem(
            cause instanceof Error
              ? cause.message
              : 'دریافت رزروهای ظرفیت انجام نشد.',
          );
      } finally {
        busy = false;
        if (!abort.signal.aborted) setLoading(false);
      }
    };
    void refresh();
    const poll = setInterval(() => void refresh(), 15000);
    const tick = setInterval(() => {
      const now = performance.now();
      setClock(now);
      if (!current) return;
      const newlyExpired = current.data.filter(
        (row) =>
          !row.paymentPendingAt &&
          holdSecondsRemaining(
            row,
            current!.serverNow,
            now - current!.receivedAt,
          ) === 0 &&
          !noticed.has(row.id + row.expiresAt),
      );
      if (newlyExpired.length) {
        newlyExpired.forEach((row) => noticed.add(row.id + row.expiresAt));
        notify.current?.();
        void refresh();
      }
    }, 1000);
    return () => {
      abort.abort();
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [offerId, loadPage, pageCount, retry]);
  return (
    <section
      aria-label="رزروهای فعال ظرفیت"
      className="mt-4 grid min-w-0 gap-2 rounded-xl border border-border p-3 text-sm"
    >
      <h3 className="font-semibold">در حال خرید و رزروهای فعال</h3>
      {problem ? (
        <div role="alert" className="grid gap-1 text-destructive">
          <p>{problem}</p>
          <p>وضعیت رزروها به‌روز نیست.</p>
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => setRetry((value) => value + 1)}
          >
            تلاش مجدد
          </Button>
        </div>
      ) : null}
      {!snapshot && loading ? (
        <p role="status">در حال دریافت رزروهای ظرفیت…</p>
      ) : null}
      {snapshot && snapshot.data.length === 0 && !problem ? (
        <p>رزرو فعالی ثبت نشده است.</p>
      ) : null}
      <ul className="grid min-w-0 gap-2">
        {snapshot?.data.map((row) => {
          const seconds = holdSecondsRemaining(
            row,
            snapshot.serverNow,
            clock - snapshot.receivedAt,
          );
          return (
            <li
              key={row.id}
              className="grid min-w-0 gap-1 rounded-lg bg-muted/40 p-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 break-words">
                  <span>شماره سفارش سایت:</span>{' '}
                  <bdi className="font-semibold">{row.externalId ?? '—'}</bdi>
                  {row.siteCode ? (
                    <>
                      {' '}
                      · <bdi>{row.siteCode}</bdi>
                    </>
                  ) : null}
                </span>
                <span className="whitespace-nowrap font-semibold">
                  {row.quantity.toLocaleString('fa-IR')} <span>صندلی</span>
                </span>
              </div>
              {row.requesterName ? (
                <p className="break-words">{row.requesterName}</p>
              ) : null}
              {row.requesterPhone ? (
                <bdi className="break-all">{row.requesterPhone}</bdi>
              ) : null}
              <p
                className={
                  row.paymentPendingAt
                    ? 'text-amber-700'
                    : 'text-muted-foreground'
                }
              >
                {row.paymentPendingAt ? (
                  'رزرو مرتبط با پرداخت؛ ظرفیت تا تعیین تکلیف خرید محفوظ است'
                ) : seconds === null ? (
                  'زمان انقضای رزرو در دسترس نیست.'
                ) : seconds === 0 ? (
                  'مهلت رزرو تمام شده؛ در حال بررسی آزادسازی ظرفیت.'
                ) : (
                  <>
                    <span>زمان باقی‌مانده تا پایان رزرو:</span>{' '}
                    <bdi className="font-semibold" dir="ltr">
                      {holdClock(seconds)}
                    </bdi>
                  </>
                )}
              </p>
              <small className="text-muted-foreground">
                <span>مهلت رزرو:</span>{' '}
                <time dateTime={row.expiresAt}>
                  {new Date(row.expiresAt).toLocaleString('fa-IR', {
                    timeZone: 'Asia/Tehran',
                  })}
                </time>
              </small>
            </li>
          );
        })}
      </ul>
      {snapshot?.hasMore ? (
        <Button
          variant="outline"
          disabled={loading}
          onClick={() => setPageCount((value) => value + 1)}
        >
          نمایش رزروهای بیشتر
        </Button>
      ) : null}
    </section>
  );
}
