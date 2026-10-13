'use client';
import { useEffect, useRef, useState } from 'react';
import type {
  FinanceInboxItemV1,
  FinanceSettlementAccountV1,
  FinancePaymentMethodOptionV1,
} from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/form-controls';
import { MoneyInput } from '@/components/ui/money-input';
import { useAccessPermissions } from '@/modules/iam/access-context';
import { FinanceInboxApiError, apiRequest } from '../api/finance-inbox-api';
import { FinanceHistoryPanel } from './finance-history-panel';

type Detail = {
  version: number;
  status: string;
  remainingAmount: string;
  revisions: {
    id: string;
    action: string;
    reason: string;
    createdAt: string;
  }[];
};
const actionLabels: Record<string, string> = {
  CREATE: 'ثبت درخواست',
  REVIEW: 'شروع بررسی',
  APPROVE: 'تأیید',
  CORRECTION_REQUIRED: 'برگشت برای اصلاح',
  REJECT: 'رد درخواست',
  RESUBMIT: 'بازارسال',
  PAY: 'ثبت پرداخت',
};
export function FinancePayrollActions({
  item,
  accounts,
  methods,
  onChanged,
}: {
  item: FinanceInboxItemV1;
  accounts: readonly FinanceSettlementAccountV1[];
  methods: readonly FinancePaymentMethodOptionV1[];
  onChanged: () => void;
}) {
  const permissions = useAccessPermissions();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [methodId, setMethodId] = useState('');
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const lock = useRef(false);
  const attempt = useRef<{ action: string; payload: string } | null>(null);
  useEffect(() => {
    let active = true;
    void apiRequest<Detail>(`/finance/requests/${item.sourceReference}`)
      .then((value) => {
        if (active) setDetail(value);
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : 'دریافت سوابق ناموفق بود.',
          );
      });
    return () => {
      active = false;
    };
  }, [item.sourceReference, item.financeVersion]);
  async function act(action: string) {
    if (lock.current || !detail) return;
    if (attempt.current && attempt.current.action !== action) {
      setError('ابتدا نتیجه عملیات قبلی را با تکرار همان عملیات مشخص کنید.');
      return;
    }
    const payload =
      attempt.current?.payload ??
      JSON.stringify({
        operationId: crypto.randomUUID(),
        expectedVersion: detail.version,
        action,
        reason,
        ...(action === 'PAY'
          ? {
              paidAmount: amount,
              accountId,
              methodId,
              transferAt: new Date().toISOString(),
              paymentReference: reference,
            }
          : {}),
      });
    attempt.current = { action, payload };
    setUncertain(true);
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const value = await apiRequest<Detail>(
        `/finance/requests/${item.sourceReference}/action`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
        },
      );
      setDetail(value);
      attempt.current = null;
      setUncertain(false);
      setReason('');
      setAmount('');
      onChanged();
      window.dispatchEvent(new Event('finance-transactions-changed'));
    } catch (cause) {
      if (
        cause instanceof FinanceInboxApiError &&
        [400, 403].includes(cause.status)
      ) {
        attempt.current = null;
        setUncertain(false);
      }
      setError(
        cause instanceof Error ? cause.message : 'ثبت عملیات ناموفق بود.',
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const manage = permissions?.includes('finance.request.manage');
  const canPay = permissions?.includes('finance.payment.create');
  const status = detail?.status ?? item.status;
  return (
    <div className="space-y-3 rounded-xl border p-3">
      <p>
        {item.kind === 'PAYROLL_REQUEST'
          ? 'حقوق قابل پرداخت تأییدشده منابع انسانی'
          : 'درخواست مستقیم مالی'}{' '}
        — مانده: {detail?.remainingAmount ?? item.amount?.amount}{' '}
        {item.amount?.currencyCode}
      </p>
      <label>
        توضیح / علت برگشت
        <Textarea
          value={reason}
          disabled={busy || uncertain}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        {manage && status === 'NEW' ? (
          <Button disabled={busy} onClick={() => void act('REVIEW')}>
            شروع بررسی
          </Button>
        ) : null}
        {manage && status === 'UNDER_REVIEW' ? (
          <Button disabled={busy} onClick={() => void act('APPROVE')}>
            تأیید برای پرداخت
          </Button>
        ) : null}
        {manage && ['NEW', 'UNDER_REVIEW'].includes(status) ? (
          <>
            <Button
              disabled={busy || !reason.trim()}
              variant="outline"
              onClick={() => void act('CORRECTION_REQUIRED')}
            >
              برگشت با علت
            </Button>
            <Button
              disabled={busy || !reason.trim()}
              variant="outline"
              onClick={() => void act('REJECT')}
            >
              رد درخواست
            </Button>
          </>
        ) : null}
        {manage && status === 'CORRECTION_REQUIRED' ? (
          <Button
            disabled={busy || !reason.trim()}
            onClick={() => void act('RESUBMIT')}
          >
            بازارسال توسط درخواست‌کننده
          </Button>
        ) : null}
      </div>
      {canPay && ['APPROVED', 'PAYING'].includes(status) ? (
        <div className="space-y-2">
          <label>
            مبلغ این پرداخت
            <MoneyInput
              value={amount}
              disabled={busy || uncertain}
              onValueChange={setAmount}
            />
          </label>
          <label>
            حساب مبدأ
            <select
              className="block w-full rounded border p-2"
              value={accountId}
              disabled={busy || uncertain}
              onChange={(event) => setAccountId(event.target.value)}
            >
              <option value="">انتخاب حساب</option>
              {accounts
                .filter(
                  (account) =>
                    account.branchId === item.branchReference &&
                    account.currencyCode === item.amount?.currencyCode &&
                    account.isActive,
                )
                .map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.title}
                  </option>
                ))}
            </select>
          </label>
          <label>
            روش پرداخت
            <select
              className="block w-full rounded border p-2"
              value={methodId}
              disabled={busy || uncertain}
              onChange={(event) => setMethodId(event.target.value)}
            >
              <option value="">انتخاب روش</option>
              {methods.map((method) => (
                <option key={method.id} value={method.id}>
                  {method.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            شماره رسید / مرجع
            <Input
              value={reference}
              disabled={busy || uncertain}
              onChange={(event) => setReference(event.target.value)}
            />
          </label>
          <Button
            disabled={busy || !amount || !accountId || !methodId}
            onClick={() => void act('PAY')}
          >
            {busy ? 'در حال ثبت…' : 'ثبت پرداخت جزئی یا تسویه'}
          </Button>
        </div>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      <ol>
        {detail?.revisions.map((revision) => (
          <li key={revision.id}>
            {actionLabels[revision.action] ?? revision.action} —{' '}
            {revision.reason} —{' '}
            {new Date(revision.createdAt).toLocaleString('fa-IR', {
              timeZone: 'Asia/Tehran',
            })}
          </li>
        ))}
      </ol>
      <FinanceHistoryPanel
        requestId={item.sourceReference}
        source="OPERATIONAL"
        compact
      />
    </div>
  );
}
