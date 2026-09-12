/** Explicit UI scenarios only. Never feed these rows into the Finance port or credit decisions. */
export type PreviewCurrency = 'IRR' | 'USD';
export type FinancePreviewTab =
  'statement' | 'invoice' | 'payments' | 'checks' | 'settlement' | 'disputes';
export interface FinancePreviewRow {
  id: string;
  date: string;
  title: string;
  currency: PreviewCurrency;
  amount: string;
  direction: 'debit' | 'credit' | 'info';
  status: string;
  reference: string;
  note: string;
}
const invoices: FinancePreviewRow[] = [
  {
    id: 'DEMO-INV-001',
    date: '2026-09-01',
    title: 'فاکتور نمونه خدمات پرواز',
    currency: 'IRR',
    amount: '120000000',
    direction: 'debit',
    status: 'تسویه جزئی',
    reference: 'DEMO-AGR-001',
    note: 'سررسید: ۲۰۲۶/۰۹/۱۵؛ مانده نمونه ۵۰٬۰۰۰٬۰۰۰ ریال',
  },
  {
    id: 'DEMO-INV-002',
    date: '2026-09-03',
    title: 'فاکتور نمونه خدمات هتل',
    currency: 'IRR',
    amount: '80000000',
    direction: 'debit',
    status: 'تسویه جزئی',
    reference: 'DEMO-AGR-001',
    note: 'سررسید: ۲۰۲۶/۰۹/۲۰؛ مانده نمونه ۵۰٬۰۰۰٬۰۰۰ ریال',
  },
  {
    id: 'DEMO-INV-003',
    date: '2026-09-04',
    title: 'فاکتور نمونه تور خارجی',
    currency: 'USD',
    amount: '3000',
    direction: 'debit',
    status: 'تسویه جزئی',
    reference: 'DEMO-AGR-002',
    note: 'سررسید: ۲۰۲۶/۰۹/۲۵؛ مانده نمونه ۲٬۰۰۰ دلار',
  },
];
const payments: FinancePreviewRow[] = [
  {
    id: 'DEMO-RCP-001',
    date: '2026-09-05',
    title: 'دریافت نمونه انتقال بانکی',
    currency: 'IRR',
    amount: '70000000',
    direction: 'credit',
    status: 'وصول فرضی',
    reference: 'DEMO-INV-001',
    note: 'فقط سناریوی آموزشی؛ تراکنش بانکی یا رسید واقعی ندارد.',
  },
  {
    id: 'DEMO-RCP-002',
    date: '2026-09-07',
    title: 'دریافت نمونه ارزی',
    currency: 'USD',
    amount: '1000',
    direction: 'credit',
    status: 'وصول فرضی',
    reference: 'DEMO-INV-003',
    note: 'ارز مستقل؛ هیچ تبدیل خودکاری انجام نمی‌شود.',
  },
  {
    id: 'DEMO-RCP-003',
    date: '2026-09-08',
    title: 'دریافت نمونه پرداخت نقدی',
    currency: 'IRR',
    amount: '30000000',
    direction: 'credit',
    status: 'وصول فرضی',
    reference: 'DEMO-INV-002',
    note: 'دریافت صرفاً در مانده همین سناریوی نمونه لحاظ شده است.',
  },
];
export const financePreviewRows: Record<
  FinancePreviewTab,
  readonly FinancePreviewRow[]
> = {
  invoice: invoices,
  payments,
  statement: [...invoices, ...payments].sort((a, b) =>
    a.date.localeCompare(b.date),
  ),
  checks: [
    {
      id: 'DEMO-CHK-001',
      date: '2026-09-20',
      title: 'چک نمونه دریافتنی',
      currency: 'IRR',
      amount: '25000000',
      direction: 'info',
      status: 'در انتظار وصول',
      reference: 'DEMO-INV-002',
      note: 'تاریخ نمایش‌داده‌شده سررسید است. چک وصول‌نشده از مانده کسر نمی‌شود؛ شناسه بانکی واقعی ندارد.',
    },
    {
      id: 'DEMO-CHK-002',
      date: '2026-10-05',
      title: 'چک نمونه تضمین',
      currency: 'IRR',
      amount: '100000000',
      direction: 'info',
      status: 'تضمینی',
      reference: 'DEMO-AGR-001',
      note: 'مدرک تضمین به معنای دریافت وجه نیست و در جمع دریافت‌ها محاسبه نمی‌شود.',
    },
  ],
  settlement: [
    {
      id: 'DEMO-STL-001',
      date: '2026-09-30',
      title: 'تسویه نمونه دوره شهریور — ریالی',
      currency: 'IRR',
      amount: '100000000',
      direction: 'info',
      status: 'در انتظار بررسی',
      reference: 'DEMO-INV-001 / 002',
      note: '۲۰۰٬۰۰۰٬۰۰۰ ریال فاکتور منهای ۱۰۰٬۰۰۰٬۰۰۰ ریال دریافت فرضی. مانده باز؛ پرداخت جدید محسوب نمی‌شود.',
    },
    {
      id: 'DEMO-STL-002',
      date: '2026-09-30',
      title: 'تسویه نمونه دوره شهریور — ارزی',
      currency: 'USD',
      amount: '2000',
      direction: 'info',
      status: 'در انتظار بررسی',
      reference: 'DEMO-INV-003',
      note: '۳٬۰۰۰ دلار فاکتور منهای ۱٬۰۰۰ دلار دریافت فرضی؛ مستقل از مانده ریالی.',
    },
  ],
  disputes: [
    {
      id: 'DEMO-DSP-001',
      date: '2026-09-09',
      title: 'مغایرت نمونه هزینه خدمات هتل',
      currency: 'IRR',
      amount: '5000000',
      direction: 'info',
      status: 'باز',
      reference: 'DEMO-INV-002',
      note: 'درخواست بررسی بخشی از فاکتور؛ تا نتیجه بررسی، سند اصلاحی یا تغییر مانده ایجاد نمی‌کند.',
    },
    {
      id: 'DEMO-DSP-002',
      date: '2026-09-10',
      title: 'مغایرت نمونه کارمزد ارزی',
      currency: 'USD',
      amount: '50',
      direction: 'info',
      status: 'در حال بررسی',
      reference: 'DEMO-INV-003',
      note: 'کارمزد مورد اعتراض؛ هنوز از مانده سناریوی نمونه کسر نشده است.',
    },
  ],
};
export function previewTotals(currency: PreviewCurrency) {
  const sum = (rows: readonly FinancePreviewRow[]) =>
    rows
      .filter((r) => r.currency === currency)
      .reduce((total, r) => total + BigInt(r.amount), 0n);
  const invoiced = sum(invoices),
    received = sum(payments);
  return { invoiced, received, outstanding: invoiced - received };
}
export function filterFinancePreview(
  rows: readonly FinancePreviewRow[],
  filter: { currency: string; status: string; from: string; to: string },
) {
  if (filter.from && filter.to && filter.from > filter.to) return [];
  return rows.filter(
    (r) =>
      (!filter.currency || r.currency === filter.currency) &&
      (!filter.status || r.status === filter.status) &&
      (!filter.from || r.date >= filter.from) &&
      (!filter.to || r.date <= filter.to),
  );
}
