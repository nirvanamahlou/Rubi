'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  MasterDataRecord,
  SalesContractDetail,
  SalesPaymentMethod,
  SalesPaymentStatus,
} from '@rubi/contracts';

import { formatSalesMoney } from '@/components/ui/money-input';
import { Alert } from '@/components/ui/surfaces';
import { customersApi } from '@/modules/customers/api/client';
import { masterDataApi } from '@/modules/master-data/api/client';
import { salesApi } from '@/modules/sales/api/client';

const methodLabels: Record<SalesPaymentMethod, string> = {
  CASH: 'نقدی',
  POS: 'کارت‌خوان',
  BANK_TRANSFER: 'انتقال بانکی',
  ONLINE_GATEWAY: 'درگاه آنلاین',
  REMITTANCE: 'حواله',
  CUSTOMER_CREDIT: 'اعتبار مشتری',
  CHECK: 'چک',
  OTHER: 'سایر',
};

const statusLabels: Record<SalesPaymentStatus, string> = {
  SCHEDULED: 'برنامه‌ریزی‌شده',
  PENDING_FINANCE_CONFIRMATION: 'در انتظار تأیید مالی',
  FINANCE_CONFIRMED: 'تأییدشده مالی',
  FINANCE_REJECTED: 'ردشده توسط مالی',
};

function formatDate(value: string | null) {
  if (!value) return 'ثبت نشده';
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf())
    ? 'ثبت نشده'
    : parsed.toLocaleString('en-GB', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
}

export function reservationReceiptRows(
  contract: SalesContractDetail,
  banks: readonly MasterDataRecord[],
  payerName = reservationPayerName(contract),
) {
  const bankNames = new Map(banks.map(({ id, name }) => [id, name]));
  return contract.payments.map((payment) => ({
    id: payment.id,
    payer: payerName,
    method: methodLabels[payment.method],
    status: statusLabels[payment.status],
    amount: formatSalesMoney(payment.amount),
    currency: payment.currencyCode,
    transferAt: formatDate(payment.financeConfirmedAt),
    dueAt: formatDate(payment.dueAt),
    registeredAt: formatDate(payment.createdAt),
    registeredBy: payment.createdByName ?? 'ثبت نشده',
    bank: payment.check?.bankId
      ? (bankNames.get(payment.check.bankId) ?? 'بانک در دسترس نیست')
      : 'ثبت نشده',
    reference: payment.paymentReference || 'ثبت نشده',
    description: payment.description || '—',
  }));
}

export function reservationPayerName(contract: SalesContractDetail) {
  if (contract.payerCustomerId === contract.customerId)
    return contract.customerNameSnapshot;
  return (
    contract.passengersDetail.find(
      ({ customerId }) => customerId === contract.payerCustomerId,
    )?.displayNameSnapshot ?? 'نام پرداخت‌کننده در قرارداد موجود نیست'
  );
}

function isZero(value: string) {
  return /^[-+]?0+(?:\.0+)?$/.test(value.trim());
}

export function reservationReceiptSummary(contract: SalesContractDetail) {
  return {
    confirmed: contract.balances
      .filter(({ confirmedPaid }) => !isZero(confirmedPaid))
      .map(({ confirmedPaid, currencyCode }) => ({
        amount: formatSalesMoney(confirmedPaid),
        currency: currencyCode,
      })),
    pending: contract.balances
      .filter(({ pendingFinance }) => !isZero(pendingFinance))
      .map(({ pendingFinance, currencyCode }) => ({
        amount: formatSalesMoney(pendingFinance),
        currency: currencyCode,
      })),
  };
}

export function ReservationReceipts({ contractId }: { contractId?: string }) {
  const [contract, setContract] = useState<SalesContractDetail | null>(null);
  const [banks, setBanks] = useState<readonly MasterDataRecord[]>([]);
  const [payerName, setPayerName] = useState('');
  const [loading, setLoading] = useState(Boolean(contractId));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!contractId) return;
    let active = true;
    void salesApi
      .detail(contractId)
      .then(async (contractResponse) => {
        const [bankResponse, payerResponse] = await Promise.all([
          masterDataApi
            .list('banks', {
              search: '',
              status: 'all',
              sortBy: 'name',
              sortDirection: 'asc',
              page: 1,
              pageSize: 100,
            })
            .catch(() => ({ data: [] as MasterDataRecord[] })),
          customersApi
            .detail(contractResponse.data.payerCustomerId)
            .catch(() => null),
        ]);
        if (!active) return;
        setContract(contractResponse.data);
        setBanks(bankResponse.data);
        setPayerName(
          payerResponse?.data.displayName ??
            reservationPayerName(contractResponse.data),
        );
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : 'دریافت سوابق پرداخت قرارداد ناموفق بود.',
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [contractId]);

  const rows = useMemo(
    () =>
      contract
        ? reservationReceiptRows(
            contract,
            banks,
            payerName || reservationPayerName(contract),
          )
        : [],
    [banks, contract, payerName],
  );
  const summary = useMemo(
    () => (contract ? reservationReceiptSummary(contract) : null),
    [contract],
  );

  if (!contractId)
    return (
      <Alert
        title="شناسهٔ قرارداد در درخواست رزرواسیون موجود نیست."
        tone="error"
      />
    );
  if (loading) return <p role="status">در حال دریافت سوابق دریافت‌ها…</p>;
  if (error) return <Alert tone="error" title={error} />;
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <p className="text-xs text-muted-foreground">دریافت از طرف</p>
          <p className="mt-1 font-bold">
            {payerName || (contract ? reservationPayerName(contract) : '—')}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100">
          <p className="text-xs">مجموع دریافت تأییدشده</p>
          {summary?.confirmed.length ? (
            summary.confirmed.map(({ amount, currency }) => (
              <p key={currency} className="mt-1 font-bold" dir="ltr">
                {amount} {currency}
              </p>
            ))
          ) : (
            <p className="mt-1 font-bold">هنوز مبلغی تأیید نشده است</p>
          )}
        </div>
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="text-xs">در انتظار تأیید مالی</p>
          {summary?.pending.length ? (
            summary.pending.map(({ amount, currency }) => (
              <p key={currency} className="mt-1 font-bold" dir="ltr">
                {amount} {currency}
              </p>
            ))
          ) : (
            <p className="mt-1 font-bold">موردی وجود ندارد</p>
          )}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        فقط مبلغ تأییدشدهٔ مالی در جمع دریافت‌شده محاسبه می‌شود. تاریخ انتقال
        نیز پس از تأیید مالی ثبت می‌شود.
      </p>
      {!rows.length ? (
        <p>هنوز دریافتی یا قسطی برای این قرارداد ثبت نشده است.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="min-w-[1180px] w-full border-collapse text-sm">
            <thead className="bg-muted/60 text-muted-foreground">
              <tr>
                {[
                  'نوع عملیات دریافتی',
                  'از طرف',
                  'وضعیت',
                  'مبلغ',
                  'ارز',
                  'تاریخ انتقال',
                  'سررسید',
                  'ثبت‌شده توسط',
                  'تاریخ ثبت',
                  'بانک',
                  'شماره پیگیری',
                  'توضیحات',
                ].map((label) => (
                  <th
                    key={label}
                    className="whitespace-nowrap border-b p-3 text-start"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="whitespace-nowrap p-3 font-medium">
                    {row.method}
                  </td>
                  <td className="whitespace-nowrap p-3">{row.payer}</td>
                  <td className="whitespace-nowrap p-3">{row.status}</td>
                  <td className="whitespace-nowrap p-3" dir="ltr">
                    {row.amount}
                  </td>
                  <td className="whitespace-nowrap p-3" dir="ltr">
                    {row.currency}
                  </td>
                  <td className="whitespace-nowrap p-3" dir="ltr">
                    {row.transferAt}
                  </td>
                  <td className="whitespace-nowrap p-3" dir="ltr">
                    {row.dueAt}
                  </td>
                  <td className="whitespace-nowrap p-3">{row.registeredBy}</td>
                  <td className="whitespace-nowrap p-3" dir="ltr">
                    {row.registeredAt}
                  </td>
                  <td className="whitespace-nowrap p-3">{row.bank}</td>
                  <td className="whitespace-nowrap p-3" dir="ltr">
                    {row.reference}
                  </td>
                  <td className="min-w-48 p-3">{row.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
