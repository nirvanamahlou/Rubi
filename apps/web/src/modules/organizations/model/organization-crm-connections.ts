import type {
  B2bCrmConnectionsV1,
  B2bCrmSalesContractV1,
  B2bCrmSalesPaymentV1,
} from '@rubi/contracts';

export interface ConnectedFinanceRow {
  id: string;
  date: string;
  title: string;
  currency: string;
  amount: string;
  direction: 'debit' | 'credit' | 'info';
  status: string;
  reference: string;
  note: string;
}

export type ConnectedFinanceTab =
  'statement' | 'invoice' | 'payments' | 'checks' | 'settlement' | 'disputes';

const paymentStatus: Record<string, string> = {
  SCHEDULED: 'برنامه‌ریزی‌شده',
  PENDING_FINANCE_CONFIRMATION: 'در انتظار تأیید مالی',
  FINANCE_CONFIRMED: 'تأییدشده مالی',
  FINANCE_REJECTED: 'ردشده مالی',
};
const settlementStatus: Record<string, string> = {
  UNPAID: 'تسویه‌نشده',
  PARTIALLY_SETTLED: 'تسویه جزئی',
  SETTLED: 'تسویه‌شده',
  OVERPAID: 'اضافه پرداخت',
};

function paymentRows(
  payments: readonly B2bCrmSalesPaymentV1[],
  checks: boolean,
): ConnectedFinanceRow[] {
  return payments
    .filter((payment) => (payment.method === 'CHECK') === checks)
    .map((payment) => ({
      id: payment.id,
      date: checks
        ? (payment.check?.dueDate ?? payment.dueAt)
        : payment.createdAt.slice(0, 10),
      title:
        payment.description?.trim() ||
        (checks ? 'چک قرارداد فروش' : 'دریافت قرارداد فروش'),
      currency: payment.currencyCode,
      amount: payment.amount,
      direction: 'credit',
      status: paymentStatus[payment.status] ?? payment.status,
      reference: payment.contractNumber,
      note: checks
        ? `${payment.check?.ownerName ?? 'صاحب چک ثبت‌نشده'} · ${payment.check?.secureIdentifier ?? 'شناسه امن ثبت‌نشده'}`
        : payment.paymentReference || 'مرجع پرداخت ثبت‌نشده',
    }));
}

export function connectedFinanceRows(
  snapshot: B2bCrmConnectionsV1,
  tab: ConnectedFinanceTab,
): readonly ConnectedFinanceRow[] {
  if (tab === 'payments') return paymentRows(snapshot.payments, false);
  if (tab === 'checks') return paymentRows(snapshot.payments, true);
  if (tab === 'disputes') return [];
  return snapshot.contracts.flatMap((contract) =>
    contract.balances.map((balance) => ({
      id: `${contract.id}:${balance.currencyCode}:${tab}`,
      date: contract.updatedAt.slice(0, 10),
      title:
        tab === 'invoice'
          ? `تعهد فروش ${contract.contractNumber}`
          : tab === 'settlement'
            ? `مانده تسویه ${contract.contractNumber}`
            : `گردش قرارداد ${contract.contractNumber}`,
      currency: balance.currencyCode,
      amount: tab === 'invoice' ? balance.amount : balance.outstanding,
      direction: tab === 'settlement' ? ('info' as const) : ('debit' as const),
      status:
        settlementStatus[contract.settlementStatus] ??
        contract.settlementStatus,
      reference: contract.contractNumber,
      note:
        tab === 'invoice'
          ? 'تعهد قطعی قرارداد فروش؛ شماره فاکتور رسمی پس از انتشار سرویس Finance نمایش داده می‌شود.'
          : `پرداخت تأییدشده: ${balance.confirmedPaid}؛ در انتظار مالی: ${balance.pendingFinance}`,
    })),
  );
}

export function filterConnectedFinanceRows(
  rows: readonly ConnectedFinanceRow[],
  filter: { currency: string; status: string; from: string; to: string },
) {
  if (filter.from && filter.to && filter.from > filter.to) return [];
  return rows.filter(
    (row) =>
      (!filter.currency || row.currency === filter.currency) &&
      (!filter.status || row.status === filter.status) &&
      (!filter.from || row.date >= filter.from) &&
      (!filter.to || row.date <= filter.to),
  );
}

const minorScale = 4;
function minor(value: string) {
  const match = /^(-?)(\d+)(?:\.(\d{1,4}))?$/.exec(value.trim());
  if (!match) return null;
  const fraction = (match[3] ?? '').padEnd(minorScale, '0');
  const result = BigInt(match[2]!) * 10_000n + BigInt(fraction || '0');
  return match[1] ? -result : result;
}
function decimal(value: bigint) {
  const sign = value < 0n ? '-' : '';
  const absolute = value < 0n ? -value : value;
  const whole = absolute / 10_000n;
  const fraction = String(absolute % 10_000n)
    .padStart(minorScale, '0')
    .replace(/0+$/, '');
  return `${sign}${whole}${fraction ? `.${fraction}` : ''}`;
}

export function connectedOutstanding(
  contracts: readonly B2bCrmSalesContractV1[],
) {
  const totals = new Map<string, bigint>();
  for (const contract of contracts)
    for (const balance of contract.balances) {
      const value = minor(balance.outstanding);
      if (value !== null)
        totals.set(
          balance.currencyCode,
          (totals.get(balance.currencyCode) ?? 0n) + value,
        );
    }
  return [...totals]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currencyCode, value]) => ({
      currencyCode,
      amount: decimal(value),
    }));
}

export function overduePaymentCount(
  payments: readonly B2bCrmSalesPaymentV1[],
  today: string,
) {
  return payments.filter(
    (payment) =>
      payment.dueAt < today &&
      ['SCHEDULED', 'PENDING_FINANCE_CONFIRMATION'].includes(payment.status),
  ).length;
}
