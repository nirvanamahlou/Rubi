'use client';

import {
  Banknote,
  CalendarCheck,
  FilePlus2,
  RefreshCw,
  WalletCards,
  Search,
  ArrowLeft,
  CheckCheck,
  FileSpreadsheet,
  LoaderCircle,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  SalesContractListQuery,
  SalesContractPage,
  SalesDashboard,
} from '@rubi/contracts';

import { Button, buttonVariants } from '@/components/ui/button';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
} from '@/components/ui/surfaces';
import { salesApi } from '../api/client';
import { SalesThemedSelect } from './sales-themed-select';
import { ContractPayments } from './contract-payments';
import { SalesTravelDocuments } from './sales-travel-documents';
import { ContractOutputButton } from './contract-output';

export async function loadSalesWorkspace(
  api: Pick<typeof salesApi, 'dashboard' | 'list'> = salesApi,
  query: SalesContractListQuery = {},
) {
  const [dashboard, contracts] = await Promise.allSettled([
    api.dashboard(),
    api.list({
      page: 1,
      pageSize: 20,
      sortBy: 'updatedAt',
      sortDirection: 'desc',
      ...query,
    }),
  ]);
  return { dashboard, contracts };
}

function failureMessage(reason: unknown): string {
  return reason instanceof Error
    ? reason.message
    : 'دریافت اطلاعات فروش ناموفق بود.';
}

export function formatMoney(amount: string, currencyCode: string) {
  const [integer = '0', fraction] = amount.split('.');
  return `${integer.replace(/\B(?=(\d{3})+(?!\d))/g, '٬')}${fraction ? `٫${fraction}` : ''} ${currencyCode === 'IRR' ? 'ریال' : currencyCode}`.replace(
    /\d/g,
    (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]!,
  );
}

export function paymentReferenceSearchQuery(
  reference: string,
): SalesContractListQuery {
  // Start a server-side search across authorized contracts, without stale filters/page.
  return { search: reference.trim(), page: 1 };
}

export function SalesWorkspace() {
  const contractsSearchPanel = useRef<HTMLElement>(null);
  const [paymentContractId, setPaymentContractId] = useState<string | null>(
    null,
  );
  const [dashboard, setDashboard] = useState<SalesDashboard['data'] | null>(
    null,
  );
  const [contracts, setContracts] = useState<SalesContractPage['data']>([]);
  const [query, setQuery] = useState<SalesContractListQuery>({});
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const requestVersion = useRef(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dashboardError, setDashboardError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [exportNotice, setExportNotice] = useState('');
  async function downloadExcel() {
    setExporting(true);
    setExportError('');
    setExportNotice('');
    try {
      const blob = await salesApi.exportXlsx(query);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sales-contracts-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.append(link);
      link.click();
      link.remove();
      globalThis.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setExportNotice('فایل Excel نتایج فیلترشده برای دانلود آماده شد.');
    } catch (cause) {
      setExportError(
        cause instanceof Error
          ? cause.message
          : 'دریافت Excel ناموفق بود؛ دوباره تلاش کنید.',
      );
    } finally {
      setExporting(false);
    }
  }
  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError('');
    setDashboardError('');
    const result = await loadSalesWorkspace(salesApi, query);
    if (version !== requestVersion.current) return;
    if (result.dashboard.status === 'fulfilled')
      setDashboard(result.dashboard.value.data);
    else {
      setDashboard(null);
      setDashboardError(failureMessage(result.dashboard.reason));
    }
    if (result.contracts.status === 'fulfilled') {
      setContracts(result.contracts.value.data);
      setTotal(result.contracts.value.meta.total);
    } else {
      setContracts([]);
      setError(failureMessage(result.contracts.reason));
    }
    setLoading(false);
  }, [query]);
  useEffect(() => {
    const timer = globalThis.setTimeout(() => void load(), 0);
    return () => globalThis.clearTimeout(timer);
  }, [load]);

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-5">
      <header className="relative flex flex-wrap items-center justify-between gap-5 overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-l from-primary/10 via-surface to-surface p-6">
        <div>
          <p className="mb-2 text-xs font-bold tracking-wide text-primary">
            فروش و پیگیری سفر
          </p>
          <h1 className="text-2xl font-black">داشبورد قراردادها</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            قراردادهای قابل‌دسترسی شما · مانده بر اساس پرداخت تأییدشده مالی
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => void load()}
            aria-label="به‌روزرسانی قراردادها"
          >
            <RefreshCw className="size-4" />
          </Button>
          <Link
            className={`${buttonVariants({ size: 'sm' })} !text-white`}
            href="/sales/contracts/new"
          >
            <FilePlus2 className="size-4" />
            قرارداد جدید
          </Link>
        </div>
      </header>
      {loading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton className="h-24" key={index} />
          ))}
        </div>
      ) : null}
      {error || dashboardError ? (
        <ErrorState
          title={
            error
              ? 'فهرست قراردادها در دسترس نیست'
              : 'آمار قراردادها در دسترس نیست'
          }
          description={[error, dashboardError]
            .filter(
              (message, index, all) =>
                message && all.indexOf(message) === index,
            )
            .join(' · ')}
          action={
            <Button onClick={() => void load()} variant="outline">
              <RefreshCw className="size-4" />
              تلاش دوباره
            </Button>
          }
        />
      ) : null}
      {dashboard && !loading ? (
        <SalesDashboardMetrics dashboard={dashboard} />
      ) : null}
      {dashboard && !loading ? (
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Card className="border-primary/20 bg-primary/5 p-5">
            <div className="flex items-center gap-2 font-bold">
              <WalletCards className="size-5 text-primary" />
              مانده قابل دریافت
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              {dashboard.outstanding.length ? (
                dashboard.outstanding.map((balance) => (
                  <span
                    key={balance.currencyCode}
                    className="rounded-xl border border-primary/15 bg-surface px-4 py-2 text-lg font-black"
                  >
                    {formatMoney(balance.amount, balance.currencyCode)}
                  </span>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">
                  مانده‌ای ثبت نشده است
                </span>
              )}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              فقط پرداخت تأییدشده مالی از مانده کم می‌شود؛ ارزها جدا محاسبه
              می‌شوند.
            </p>
          </Card>
          <Card className="p-5">
            <h2 className="font-bold">پیگیری‌های فروش</h2>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              {[
                ['منتظر تأیید مالی', dashboard.pendingFinancePayments],
                ['پیگیری رزرواسیون', dashboard.pendingReservationActions],
                ['تسویه‌شده', dashboard.settledContracts],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-muted/50 p-3">
                  <p className="mb-2 text-xl font-black">
                    {Number(value).toLocaleString('fa-IR')}
                  </p>
                  <p className="text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : null}
      <section
        ref={contractsSearchPanel}
        aria-label="جست‌وجو و فهرست قراردادها"
        className="rounded-2xl border border-border bg-surface p-4 sm:p-5"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">
            قراردادها{' '}
            <span className="mr-2 text-xs font-normal text-muted-foreground">
              {!loading && !error
                ? `${total.toLocaleString('fa-IR')} نتیجه`
                : ''}
            </span>
          </h2>
          <Button
            type="button"
            variant="outline"
            disabled={loading || !!error || exporting || total === 0}
            onClick={() => void downloadExcel()}
            title="خروجی همه نتایج فیلترشده، نه فقط این صفحه"
          >
            {exporting ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="size-4" />
            )}
            {exporting ? 'در حال ساخت Excel…' : 'خروجی Excel'}
          </Button>
        </div>
        {exportError ? (
          <p role="alert" className="mb-3 text-sm text-red-600">
            {exportError}
          </p>
        ) : null}
        {exportNotice ? (
          <p role="status" className="mb-3 text-sm text-emerald-700">
            {exportNotice}
          </p>
        ) : null}
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery((current) => ({
              ...current,
              search: search.trim(),
              page: 1,
            }));
          }}
        >
          <div className="flex min-w-48 flex-1 items-center gap-2 rounded-xl border border-border px-3 focus-within:ring-2 focus-within:ring-primary/30">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              aria-label="جست‌وجوی قرارداد"
              placeholder="شماره قرارداد، نام مشتری یا شماره پیگیری پرداخت…"
              maxLength={160}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-11 w-full bg-transparent text-sm outline-none"
            />
          </div>
          <SalesThemedSelect
            label="وضعیت تسویه"
            value={query.settlementStatus ?? ''}
            onValueChange={(value) =>
              setQuery((current) => {
                const next = { ...current, page: 1 };
                if (value)
                  next.settlementStatus = value as NonNullable<
                    SalesContractListQuery['settlementStatus']
                  >;
                else delete next.settlementStatus;
                return next;
              })
            }
            options={[
              { value: '', label: 'همه وضعیت‌های تسویه' },
              { value: 'UNPAID', label: 'تسویه نشده' },
              { value: 'PARTIALLY_SETTLED', label: 'تسویه ناقص' },
              { value: 'SETTLED', label: 'تسویه شده' },
              { value: 'OVERPAID', label: 'بستانکار' },
            ]}
          />
          <Button type="submit" variant="outline" disabled={loading}>
            جست‌وجو
          </Button>
          {query.search || query.settlementStatus ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSearch('');
                setQuery({});
              }}
            >
              پاک کردن فیلترها
            </Button>
          ) : null}
        </form>
      </section>
      {!loading && !error && contracts.length === 0 ? (
        <EmptyState
          title={
            query.search || query.settlementStatus
              ? 'قراردادی با این فیلترها پیدا نشد'
              : 'اولین قرارداد سفر را ثبت کنید'
          }
          description={
            query.search || query.settlementStatus
              ? 'عبارت جست‌وجو یا وضعیت تسویه را تغییر دهید.'
              : 'مشتری و خدمات سفر را انتخاب کنید؛ قرارداد و پیگیری پرداخت‌ها از همین‌جا در دسترس خواهند بود.'
          }
          action={
            query.search || query.settlementStatus ? (
              <Button
                variant="outline"
                onClick={() => {
                  setSearch('');
                  setQuery({});
                }}
              >
                نمایش همه قراردادها
              </Button>
            ) : (
              <Link
                className={`${buttonVariants({})} !text-white`}
                href="/sales/contracts/new"
              >
                <FilePlus2 className="size-4" />
                ثبت قرارداد جدید
                <ArrowLeft className="size-4" />
              </Link>
            )
          }
        />
      ) : null}
      {contracts.length && !loading ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-muted-foreground">
                <tr>
                  {[
                    'شماره',
                    'مشتری',
                    'مسافران و خدمات',
                    'وضعیت',
                    'تسویه',
                    'مانده',
                    'آخرین تغییر',
                    'پرداخت‌ها',
                  ].map((label) => (
                    <th className="px-4 py-3 text-start" key={label}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contracts.map((contract) => (
                  <tr className="border-t border-border" key={contract.id}>
                    <td className="px-4 py-3 font-bold">
                      {contract.contractNumber}
                    </td>
                    <td className="px-4 py-3">
                      {contract.customerNameSnapshot}
                    </td>
                    <td className="px-4 py-3">
                      <p>
                        {contract.passengerNames.length.toLocaleString('fa-IR')}{' '}
                        مسافر
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {contract.services
                          .map(
                            (kind) =>
                              ({
                                FLIGHT: 'پرواز',
                                HOTEL: 'هتل',
                                VISA: 'ویزا',
                                TRANSFER: 'ترانسفر',
                                INSURANCE: 'بیمه',
                                TOUR: 'تور',
                                BUS: 'اتوبوس',
                                TRAIN: 'قطار',
                                CIP: 'CIP',
                                OTHER: 'سایر',
                              })[kind],
                          )
                          .join('، ')}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge>
                        {
                          {
                            DRAFT: 'پیش‌نویس',
                            PENDING_CONFIRMATION: 'منتظر تأیید',
                            CONFIRMED: 'تأییدشده',
                            SENT_TO_RESERVATIONS: 'ارسال به رزرواسیون',
                            IN_PROGRESS: 'در حال انجام',
                            COMPLETED: 'تکمیل‌شده',
                            CANCELLED: 'لغوشده',
                          }[contract.status]
                        }
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        className={
                          contract.settlementStatus === 'SETTLED'
                            ? 'bg-emerald-500/10 text-emerald-700'
                            : 'bg-amber-500/10 text-amber-700'
                        }
                      >
                        {contract.settlementStatus === 'SETTLED' ? (
                          <CheckCheck className="ml-1 size-3" />
                        ) : null}
                        {(
                          {
                            UNPAID: 'تسویه نشده',
                            PARTIALLY_SETTLED: 'تسویه ناقص',
                            SETTLED: 'تسویه شده',
                            OVERPAID: 'بستانکار',
                          } as Record<string, string>
                        )[contract.settlementStatus] ??
                          contract.settlementStatus}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {contract.balances
                        .map((balance) =>
                          formatMoney(
                            balance.outstanding,
                            balance.currencyCode,
                          ),
                        )
                        .join(' + ')}
                    </td>
                    <td className="px-4 py-3">
                      {new Date(contract.updatedAt).toLocaleDateString('fa-IR')}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPaymentContractId(contract.id)}
                      >
                        پرداخت‌ها و اقساط
                      </Button>
                      <div className="mt-2">
                        <ContractOutputButton contractId={contract.id} />
                        <SalesTravelDocuments contractId={contract.id} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
      {!loading && !error && total > 20 ? (
        <nav
          aria-label="صفحه‌بندی قراردادها"
          className="flex items-center justify-between"
        >
          <Button
            variant="outline"
            disabled={(query.page ?? 1) <= 1}
            onClick={() =>
              setQuery((current) => ({
                ...current,
                page: (current.page ?? 1) - 1,
              }))
            }
          >
            صفحه قبل
          </Button>
          <span className="text-sm text-muted-foreground">
            صفحه {(query.page ?? 1).toLocaleString('fa-IR')} از{' '}
            {Math.ceil(total / 20).toLocaleString('fa-IR')}
          </span>
          <Button
            variant="outline"
            disabled={(query.page ?? 1) * 20 >= total}
            onClick={() =>
              setQuery((current) => ({
                ...current,
                page: (current.page ?? 1) + 1,
              }))
            }
          >
            صفحه بعد
          </Button>
        </nav>
      ) : null}
      {paymentContractId ? (
        <ContractPayments
          key={paymentContractId}
          id={paymentContractId}
          onClose={() => setPaymentContractId(null)}
          onSaved={() => void load()}
          onSearchContracts={(reference) => {
            setSearch(reference);
            setQuery(paymentReferenceSearchQuery(reference));
            setPaymentContractId(null);
            contractsSearchPanel.current?.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
            });
          }}
        />
      ) : null}
    </div>
  );
}

const salesMetricThemes = [
  'border-blue-300/60 from-blue-500/20 via-blue-100/60 to-surface dark:via-blue-950/40',
  'border-cyan-300/60 from-cyan-500/20 via-cyan-100/60 to-surface dark:via-cyan-950/40',
  'border-amber-300/60 from-amber-500/20 via-amber-100/60 to-surface dark:via-amber-950/40',
  'border-emerald-300/60 from-emerald-500/20 via-emerald-100/60 to-surface dark:via-emerald-950/40',
];
export function SalesDashboardMetrics({
  dashboard,
}: {
  dashboard: Pick<
    SalesDashboard['data'],
    | 'todayContracts'
    | 'activeContracts'
    | 'unpaidContracts'
    | 'partiallySettledContracts'
    | 'rialSales'
  >;
}) {
  return (
    <section
      aria-label="شاخص‌های فروش"
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
    >
      {(
        [
          [
            'قرارداد امروز',
            dashboard.todayContracts.toLocaleString('fa-IR'),
            CalendarCheck,
          ],
          [
            'قرارداد فعال',
            dashboard.activeContracts.toLocaleString('fa-IR'),
            FilePlus2,
          ],
          [
            'نیازمند تسویه',
            (
              dashboard.unpaidContracts + dashboard.partiallySettledContracts
            ).toLocaleString('fa-IR'),
            WalletCards,
          ],
          ['فروش ریالی', formatMoney(dashboard.rialSales, 'IRR'), Banknote],
        ] satisfies ReadonlyArray<readonly [string, string, LucideIcon]>
      ).map(([label, value, Icon], index) => (
        <Card
          className={`${salesMetricThemes[index]} bg-gradient-to-br p-4`}
          key={label}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-muted-foreground">
              {label}
            </p>
            <Icon className="size-5 shrink-0 text-primary" aria-hidden="true" />
          </div>
          <p className="mt-3 break-words text-3xl font-black tabular-nums">
            {value}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            قراردادهای قابل‌دسترسی شما
          </p>
        </Card>
      ))}
    </section>
  );
}
