'use client';
import { isOptionalOperationReason } from '@nora/contracts';

import { currencySymbol } from '@/lib/currency-symbol';
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
import { PayingSupplierPicker } from './paying-supplier-picker';

type Detail = {
  kind: string;
  pettyFundId: string | null;
  pettyBalance: {
    funded: string;
    expenses: string;
    returned: string;
    available: string;
  } | null;
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
  PAY: 'ثبت پرداخت یا دریافت',
  CLOSE: 'بستن تنخواه',
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
  const [payingSupplierId, setPayingSupplierId] = useState('');
  const foreignPayment =
    Boolean(item.amount?.currencyCode) &&
    item.amount?.currencyCode !== 'IRR' &&
    !detail?.kind.startsWith('PETTY_CASH_');
  const [methodId, setMethodId] = useState('');
  const [receiptMethods, setReceiptMethods] = useState<
    readonly FinancePaymentMethodOptionV1[]
  >([]);
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
  useEffect(() => {
    if (detail?.kind !== 'PETTY_CASH_RETURN') return;
    let active = true;
    void apiRequest<{ data: FinancePaymentMethodOptionV1[] }>(
      '/finance/payment-methods?direction=RECEIPT',
    )
      .then((result) => {
        if (active) setReceiptMethods(result.data);
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : 'روش دریافت در دسترس نیست.',
          );
      });
    return () => {
      active = false;
    };
  }, [detail?.kind]);
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
              accountId: foreignPayment ? null : accountId,
              payingSupplierId: foreignPayment ? payingSupplierId : null,
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
  const canPay =
    permissions?.includes('finance.payment.create') &&
    (detail?.kind !== 'PETTY_CASH_RETURN' ||
      permissions.includes('finance.receipt.approve'));
  const status = detail?.status ?? item.status;
  return (
    <div className="space-y-3 rounded-xl border p-3">
      <p>
        {item.kind === 'PAYROLL_REQUEST'
          ? 'حقوق قابل پرداخت تأییدشده منابع انسانی'
          : 'درخواست مستقیم مالی'}{' '}
        — مانده: {detail?.remainingAmount ?? item.amount?.amount}{' '}
        {currencySymbol(item.amount?.currencyCode ?? '')}
      </p>
      {detail?.kind === 'PETTY_CASH_ADVANCE' ? (
        <p>شناسه تنخواه: {item.sourceReference}</p>
      ) : null}
      {detail?.pettyBalance ? (
        <div className="grid gap-2 sm:grid-cols-4" aria-label="خلاصه تنخواه">
          <p>کل تأمین: {detail.pettyBalance.funded}</p>
          <p>هزینه تأییدشده: {detail.pettyBalance.expenses}</p>
          <p>بازگشت وجه: {detail.pettyBalance.returned}</p>
          <p>مانده نزد مسئول: {detail.pettyBalance.available}</p>
        </div>
      ) : null}
      {detail?.pettyFundId ? <p>تنخواه مرجع: {detail.pettyFundId}</p> : null}
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
            {detail?.kind === 'PETTY_CASH_EXPENSE'
              ? 'تأیید مدرک و ثبت هزینه تنخواه'
              : 'تأیید برای پرداخت یا دریافت'}
          </Button>
        ) : null}
        {manage && ['NEW', 'UNDER_REVIEW'].includes(status) ? (
          <>
            <Button
              disabled={busy || !isOptionalOperationReason(reason)}
              variant="outline"
              onClick={() => void act('CORRECTION_REQUIRED')}
            >
              برگشت با علت
            </Button>
            <Button
              disabled={busy || !isOptionalOperationReason(reason)}
              variant="outline"
              onClick={() => void act('REJECT')}
            >
              رد درخواست
            </Button>
          </>
        ) : null}
        {manage &&
        detail?.kind !== 'PAYROLL_WORKSHEET' &&
        status === 'CORRECTION_REQUIRED' ? (
          <Button
            disabled={busy || !isOptionalOperationReason(reason)}
            onClick={() => void act('RESUBMIT')}
          >
            بازارسال توسط درخواست‌کننده
          </Button>
        ) : null}
      </div>
      {manage &&
      detail?.kind === 'PETTY_CASH_ADVANCE' &&
      ['APPROVED', 'PAYING', 'PAID'].includes(status) ? (
        <Button
          disabled={busy}
          variant="outline"
          onClick={() => void act('CLOSE')}
        >
          بستن تنخواه پس از تسویه
        </Button>
      ) : null}
      {canPay &&
      detail &&
      detail.kind !== 'PAYROLL_WORKSHEET' &&
      ['APPROVED', 'PAYING'].includes(status) ? (
        <div className="space-y-2">
          <label>
            مبلغ این پرداخت
            <MoneyInput
              value={amount}
              disabled={busy || uncertain}
              onValueChange={setAmount}
            />
          </label>
          {foreignPayment ? (
            <PayingSupplierPicker
              value={payingSupplierId}
              onChange={setPayingSupplierId}
              disabled={busy || uncertain}
            />
          ) : (
            <label>
              {detail?.kind === 'PETTY_CASH_RETURN'
                ? 'حساب مقصد بازگشت وجه'
                : 'حساب مبدأ'}
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
          )}
          <label>
            روش پرداخت
            <select
              className="block w-full rounded border p-2"
              value={methodId}
              disabled={busy || uncertain}
              onChange={(event) => setMethodId(event.target.value)}
            >
              <option value="">انتخاب روش</option>
              {(detail?.kind === 'PETTY_CASH_RETURN'
                ? receiptMethods
                : methods
              ).map((method) => (
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
            disabled={
              busy ||
              !amount ||
              !(foreignPayment ? payingSupplierId : accountId) ||
              !methodId
            }
            onClick={() => void act('PAY')}
          >
            {busy
              ? 'در حال ثبت…'
              : detail?.kind === 'PETTY_CASH_RETURN'
                ? 'تأیید دستی دریافت وجه برگشتی'
                : 'ثبت پرداخت جزئی یا تسویه'}
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
