'use client';
import { useEffect, useState } from 'react';
import type { FinanceCustomerDocumentDeliveryAuthorizationV1 } from '@nora/contracts';
import { Button, Input } from '@/components/ui';
import { financeInboxApi } from '@/modules/finance/api/finance-inbox-api';
export function ReservationDeliveryPermit({
  contractId,
}: {
  contractId: string;
}) {
  const [decision, setDecision] =
    useState<FinanceCustomerDocumentDeliveryAuthorizationV1 | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let live = true;
    void financeInboxApi
      .reservationDocumentDelivery(contractId)
      .then((r) => {
        if (live) setDecision(r.data);
      })
      .catch((e) => {
        if (live)
          setError(e instanceof Error ? e.message : 'دریافت مجوز انجام نشد.');
      });
    return () => {
      live = false;
    };
  }, [contractId]);
  async function save() {
    if (!decision || busy) return;
    if (reason.trim().length < 5) {
      setError('دلیل مجوز رزرواسیون باید بین ۵ تا ۵۰۰ نویسه باشد.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const r = await financeInboxApi.decideReservationDocumentDelivery(
        contractId,
        {
          expectedVersion: decision.version,
          approved: !decision.approved,
          basis: 'RESERVATION_PERMISSION',
          reason: reason.trim(),
        },
      );
      setDecision(r.data);
      setReason('');
      setNotice(
        r.data.approved
          ? 'مجوز تحویل مدارک مشتری صادر شد.'
          : 'مجوز تحویل مدارک مشتری لغو شد.',
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'ثبت مجوز تحویل مدارک ناموفق بود.',
      );
    } finally {
      setBusy(false);
    }
  }
  const other = Boolean(
    decision?.approved && decision.basis !== 'RESERVATION_PERMISSION',
  );
  return (
    <section
      dir="rtl"
      className="space-y-4 rounded-2xl border border-border bg-surface p-5"
    >
      <h3 className="font-bold">مجوز تحویل مدارک</h3>
      <p className="text-sm text-muted-foreground">
        رزرواسیون با ثبت دلیل می‌تواند تحویل مدارک به مشتری را بدون تأیید دریافت
        یا تسویهٔ کامل مجاز کند.
      </p>
      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : null}
      {notice ? <p role="status">{notice}</p> : null}
      {decision ? (
        <>
          <p className="font-semibold">
            {decision.approved ? 'تحویل مدارک مجاز' : 'تحویل مدارک مسدود'}
          </p>
          {decision.basis === 'RESERVATION_PERMISSION' ? (
            <p>با مجوز رزرواسیون</p>
          ) : null}
          {decision.reason ? (
            <p className="whitespace-pre-wrap break-words">
              دلیل: {decision.reason}
            </p>
          ) : null}
          {other ? (
            <p>مجوز فعلی از مسیر دیگری صادر شده است.</p>
          ) : (
            <form
              className="grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <label className="grid gap-2">
                <span>دلیل مجوز رزرواسیون</span>
                <Input
                  required
                  minLength={5}
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={busy}
                />
              </label>
              <Button type="submit" disabled={busy || reason.trim().length < 5}>
                {decision.approved ? 'ثبت لغو مجوز' : 'صدور با مجوز رزرواسیون'}
              </Button>
            </form>
          )}
        </>
      ) : !error ? (
        <p>در حال دریافت اطلاعات…</p>
      ) : null}
    </section>
  );
}
