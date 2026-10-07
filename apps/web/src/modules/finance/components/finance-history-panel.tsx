'use client';
import Link from '@/components/access-link';
import { NativeSearchSelect } from '@/components/ui/native-search-select';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  FinanceHistoryItemV1,
  FinanceHistorySourceV1,
  FinanceHistoryQueryV1,
} from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/surfaces';
import { financeInboxApi } from '../api/finance-inbox-api';
import { FinanceExportActions } from './finance-export-actions';

const sourceNames: Record<FinanceHistorySourceV1, string> = {
  SALES: 'فروش',
  TICKET: 'خرید بلیت',
  RESERVATIONS: 'رزرواسیون',
  INVOICE: 'فاکتور خرید',
  OPERATIONAL: 'درخواست عملیاتی و حقوق',
};
const date = (value: string) =>
  new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Tehran',
  }).format(new Date(value));
export function FinanceHistoryPanel({
  requestId,
  source,
  compact = false,
}: {
  requestId?: string;
  source?: FinanceHistorySourceV1;
  compact?: boolean;
}) {
  const [items, setItems] = useState<readonly FinanceHistoryItemV1[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [direction, setDirection] =
    useState<FinanceHistoryQueryV1['direction']>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const serial = useRef(0);
  const load = useCallback(
    async (next?: string) => {
      const generation = ++serial.current;
      setBusy(true);
      setError('');
      try {
        const result = await financeInboxApi.history({
          ...(requestId ? { requestId } : {}),
          ...(source ? { source } : {}),
          ...(direction ? { direction } : {}),
          ...(next ? { cursor: next } : {}),
        });
        if (generation !== serial.current) return;
        setItems((previous) =>
          next ? [...previous, ...result.items] : result.items,
        );
        setCursor(result.nextCursor);
      } catch (cause) {
        if (generation !== serial.current) return;
        if (!next) {
          setItems([]);
          setCursor(null);
        }
        setError(
          cause instanceof Error ? cause.message : 'تاریخچه دریافت نشد.',
        );
      } finally {
        if (generation === serial.current) setBusy(false);
      }
    },
    [requestId, source, direction],
  );
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    const refresh = () => {
      void load();
    };
    window.addEventListener('finance-transactions-changed', refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('finance-transactions-changed', refresh);
      // Numeric request generation, not a DOM ref: invalidate outstanding responses.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      serial.current++;
    };
  }, [load]);
  return (
    <Card className={compact ? 'space-y-3 p-3' : 'space-y-4 p-5'} dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-bold">
          {compact
            ? 'تاریخچه پرداخت‌های این درخواست'
            : 'تاریخچه دریافت و پرداخت'}
        </h2>
        <Button variant="outline" disabled={busy} onClick={() => void load()}>
          به‌روزرسانی
        </Button>
      </div>
      {!compact ? (
        <FinanceExportActions
          query={{
            scope: 'HISTORY',
            historySource: source,
            requestId,
            direction,
          }}
          disabled={busy}
        />
      ) : null}
      {!compact ? (
        <div className="flex flex-wrap items-center gap-3">
          <label>
            نوع عملیات{' '}
            <NativeSearchSelect
              className="rounded-lg border bg-background p-2"
              value={direction ?? ''}
              onChange={(event) =>
                setDirection(
                  (event.target.value ||
                    undefined) as FinanceHistoryQueryV1['direction'],
                )
              }
            >
              <option value="">همه</option>
              <option value="RECEIPT">دریافت</option>
              <option value="PAYMENT">پرداخت</option>
            </NativeSearchSelect>
          </label>
          <p className="text-xs text-muted-foreground">
            هر نوبت جداگانه نمایش داده می‌شود؛ سوابق تسویه‌شده نیز باقی
            می‌مانند. تاریخ دریافت، زمان تأیید مالی است.
          </p>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {busy ? (
        <p role="status" className="text-sm text-muted-foreground">
          در حال دریافت تاریخچه…
        </p>
      ) : null}
      {!busy && !error && !items.length ? (
        <p className="text-sm text-muted-foreground">
          هنوز دریافت یا پرداختی ثبت نشده است.
        </p>
      ) : null}
      <div className="space-y-3">
        {items.map((row) => (
          <article
            key={row.source + ':' + row.id}
            className="space-y-2 rounded-xl border p-3 text-sm"
          >
            <Link
              className="text-primary"
              href={`/finance/accounting/receipts-payments/reports?source=${row.source}&recordId=${row.id}`}
            >
              حسابداری این عملیات
            </Link>
            <div className="flex flex-wrap justify-between gap-2">
              <strong>
                {row.direction === 'RECEIPT' ? 'دریافت' : 'پرداخت'} ·{' '}
                {row.title}
                {row.installment
                  ? ' · نوبت ' + row.installment.toLocaleString('fa-IR')
                  : ''}
              </strong>
              <time dateTime={row.occurredAt}>{date(row.occurredAt)}</time>
            </div>
            <dl className="grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">مبلغ این نوبت</dt>
                <dd dir="ltr" className="text-end font-bold">
                  {row.amount} {row.currencyCode}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">حساب / روش</dt>
                <dd>
                  {row.accountTitle ?? '—'} · {row.method ?? '—'}
                </dd>
              </div>
              {row.cumulativePaid !== null ? (
                <div>
                  <dt className="text-xs text-muted-foreground">
                    جمع پرداخت تا این نوبت
                  </dt>
                  <dd dir="ltr" className="text-end">
                    {row.cumulativePaid} {row.currencyCode}
                  </dd>
                </div>
              ) : null}
              {row.remainingAmount !== null ? (
                <div>
                  <dt className="text-xs text-muted-foreground">
                    مانده پس از این نوبت
                  </dt>
                  <dd dir="ltr" className="text-end">
                    {row.remainingAmount} {row.currencyCode}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-xs text-muted-foreground">شماره پیگیری</dt>
                <dd className="break-all">{row.reference ?? '—'}</dd>
              </div>
              {!compact ? (
                <div>
                  <dt className="text-xs text-muted-foreground">
                    منبع / شناسه درخواست
                  </dt>
                  <dd className="break-all">
                    {sourceNames[row.source]} · {row.requestId}
                  </dd>
                </div>
              ) : null}
            </dl>
            <FinanceExportActions
              receipt
              query={{
                scope: 'RECEIPT',
                historySource: row.source,
                recordId: row.id,
                requestId: row.requestId,
              }}
            />
          </article>
        ))}
      </div>
      {cursor ? (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => void load(cursor)}
        >
          نمایش سوابق قدیمی‌تر
        </Button>
      ) : null}
    </Card>
  );
}
