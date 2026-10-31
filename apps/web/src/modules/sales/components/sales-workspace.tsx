'use client';
import { canSelfServeSalesContract } from '@nora/contracts';
import { useAccessActor } from '@/modules/iam/access-context';
import { currencySymbol } from '@/lib/currency-symbol';

import {
  Banknote,
  CalendarCheck,
  FilePlus2,
  FileText,
  ReceiptText,
  UsersRound,
  RefreshCw,
  WalletCards,
  ArrowLeft,
  CheckCheck,
  FileSpreadsheet,
  LoaderCircle,
  type LucideIcon,
} from 'lucide-react';
import Link from '@/components/access-link';
import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  SalesContractListQuery,
  SalesContractSummary,
  SalesContractPage,
  SalesDashboard,
} from '@nora/contracts';

import { Button, buttonVariants } from '@/components/ui/button';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
} from '@/components/ui/surfaces';
import { salesApi } from '../api/client';
import { ContractPayments } from './contract-payments';
import { SalesTravelDocuments } from './sales-travel-documents';
import { ContractOutputButton } from './contract-output';
import { ContractTableScroll } from './contract-table-scroll';
import { SalesReceivablesCard } from './sales-receivables-card';
import { PassengerCorrectionButton } from './passenger-correction';

export const DEFAULT_CONTRACT_PAGE_SIZE = 10;
export const DATE_FILTERED_CONTRACT_PAGE_SIZE = 10_000;

export function contractRowClassName(
  contract: Pick<
    SalesContractSummary,
    'customerDocumentDeliveryApproved' | 'reservationContractChanged'
  >,
  selected = false,
) {
  if (selected)
    return 'group cursor-pointer border-t border-primary/30 bg-blue-100/80 transition-colors hover:bg-blue-100 dark:bg-blue-950/55 dark:hover:bg-blue-900/60';
  if (contract.customerDocumentDeliveryApproved)
    return 'group border-t border-emerald-300 bg-emerald-100/70 transition-colors hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/60';
  return contract.reservationContractChanged
    ? 'group border-t border-amber-300 bg-amber-100/70 transition-colors hover:bg-amber-100 dark:bg-amber-950/40'
    : 'group border-t border-border/70 transition-colors odd:bg-muted/[0.12] hover:bg-primary/[0.055]';
}

export function ContractListContactRouteDate({
  contract,
}: {
  contract: SalesContractSummary;
}) {
  return (
    <>
      <td className="px-4 py-3 whitespace-nowrap">
        <bdi dir="ltr">{contract.customerPhone || '—'}</bdi>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <bdi>{contract.destinationName || '—'}</bdi>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {new Date(contract.createdAt).toLocaleDateString('fa-IR', {
          timeZone: 'Asia/Tehran',
        })}
      </td>
    </>
  );
}

export function ContractListNumber({
  contract,
}: {
  contract: Pick<
    SalesContractSummary,
    'contractNumber' | 'reservationContractChanged'
  >;
}) {
  return (
    <td
      className="px-4 py-3 font-bold first:pr-5 whitespace-nowrap"
      title={
        contract.reservationContractChanged
          ? [contract.contractNumber, 'اصلاح قرارداد توسط رزرواسیون'].join(
              ' · ',
            )
          : contract.contractNumber
      }
    >
      <div className="inline-flex items-center gap-2 rounded-lg border border-primary/15 bg-primary/[0.055] px-2.5 py-1.5 text-primary shadow-sm">
        <FileText className="size-3.5" />
        <span dir="ltr">{contract.contractNumber}</span>
      </div>
    </td>
  );
}

export function ContractListTravelDates({
  contract,
}: {
  contract: SalesContractSummary;
}) {
  return (
    <>
      {(['outbound', 'returning'] as const).map((direction) => {
        const value = contract.travelDates?.[direction];
        return (
          <td key={direction} className="px-4 py-3 whitespace-nowrap">
            <bdi dir="ltr">
              {value
                ? new Date(`${value.date}T00:00:00Z`).toLocaleDateString(
                    value.calendar === 'gregorian' ? 'en-GB' : 'fa-IR',
                    { timeZone: 'UTC' },
                  )
                : '—'}
            </bdi>
          </td>
        );
      })}
    </>
  );
}

export function ContractListPassengers({
  contract,
}: {
  contract: SalesContractSummary;
}) {
  const counts = contract.passengerComposition;
  const composition = counts
    ? [
        [counts.adults, 'بزرگسال'],
        [counts.children2To6, 'کودک ۲ تا ۶ سال'],
        [counts.children6To12, 'کودک ۶ تا ۱۲ سال'],
        [counts.infants, 'نوزاد'],
        [counts.childrenUnknownAge, 'کودک (سن ثبت نشده)'],
      ]
        .filter(([count]) => Number(count) > 0)
        .map(
          ([count, label]) =>
            `${Number(count).toLocaleString('fa-IR')} ${label}`,
        )
        .join('، ')
    : '';
  return (
    <div>
      <div className="flex items-center gap-1.5 font-semibold text-foreground">
        <UsersRound className="size-4 text-primary" />
        <p>
          {(
            contract.passengerCount ?? contract.passengerNames.length
          ).toLocaleString('fa-IR')}{' '}
          مسافر
        </p>
      </div>
      {composition ? (
        <p className="mt-1 min-w-48 max-w-64 text-xs leading-5 text-muted-foreground">
          {composition}
        </p>
      ) : null}
    </div>
  );
}

export function hasContractDateFilter(query: SalesContractListQuery): boolean {
  return Boolean(
    query.createdFrom || query.createdTo || query.travelFrom || query.travelTo,
  );
}

export function ContractListAmounts({
  contract,
}: {
  contract: Pick<SalesContractSummary, 'balances'>;
}) {
  return (
    <>
      {(['amount', 'outstanding'] as const).map((field) => (
        <td key={field} className="px-4 py-3 font-semibold text-foreground">
          <div className="max-w-44 text-xs leading-5">
            {contract.balances.length
              ? contract.balances.map((balance) => (
                  <div key={balance.currencyCode}>
                    {formatMoney(balance[field], balance.currencyCode)}
                  </div>
                ))
              : '—'}
          </div>
        </td>
      ))}
    </>
  );
}

export async function loadSalesWorkspace(
  api: Pick<typeof salesApi, 'dashboard' | 'list'> = salesApi,
  query: SalesContractListQuery = {},
) {
  const [dashboard, contracts] = await Promise.allSettled([
    api.dashboard(),
    api.list({
      ...query,
      page: query.page ?? 1,
      pageSize: hasContractDateFilter(query)
        ? DATE_FILTERED_CONTRACT_PAGE_SIZE
        : DEFAULT_CONTRACT_PAGE_SIZE,
      sortBy: query.sortBy ?? 'updatedAt',
      sortDirection: query.sortDirection ?? 'desc',
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
  return `${integer.replace(/\B(?=(\d{3})+(?!\d))/g, '٬')}${fraction ? `٫${fraction}` : ''} ${currencySymbol(currencyCode)}`.replace(
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
  const actor = useAccessActor();
  const [paymentContractId, setPaymentContractId] = useState<string | null>(
    null,
  );
  const [dashboard, setDashboard] = useState<SalesDashboard['data'] | null>(
    null,
  );
  const [contracts, setContracts] = useState<SalesContractPage['data']>([]);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(
    null,
  );
  const [query, setQuery] = useState<SalesContractListQuery>({});
  const [total, setTotal] = useState(0);
  const requestVersion = useRef(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dashboardError, setDashboardError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [exportNotice, setExportNotice] = useState('');
  const dateFilterApplied = hasContractDateFilter(query);
  const filtersApplied = Boolean(
    query.search ||
    query.settlementStatus ||
    query.originId ||
    query.destinationId ||
    query.agencyCustomerId ||
    (query.customerType && query.customerType !== 'ALL') ||
    dateFilterApplied,
  );
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
          <h1 className="text-2xl font-black">داشبورد قراردادها</h1>
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
      <div className="grid gap-4">
        <SalesReceivablesCard
          key={JSON.stringify(query)}
          listQuery={query}
          onApply={setQuery}
          refreshVersion={dashboard}
          formatAmount={formatMoney}
        />
      </div>
      <section
        ref={contractsSearchPanel}
        aria-label="جست‌وجو و فهرست قراردادها"
        className="relative overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-surface via-surface to-primary/5 p-4 shadow-sm sm:p-5"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-4">
          <h2 className="flex items-center gap-2 text-base font-black text-foreground">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <FileText className="size-4" />
            </span>
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
            permission="sales.export"
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
        <p className="mt-3 text-xs text-muted-foreground">
          {dateFilterApplied
            ? 'همهٔ قراردادهای بازهٔ تاریخ ثبت انتخاب‌شده نمایش داده می‌شوند.'
            : 'بدون فیلتر تاریخ، فقط ۱۰ قراردادِ آخر نمایش داده می‌شود.'}
        </p>
      </section>
      {!loading && !error && contracts.length === 0 ? (
        <EmptyState
          title={
            filtersApplied
              ? 'قراردادی با این فیلترها پیدا نشد'
              : 'اولین قرارداد سفر را ثبت کنید'
          }
          description={
            filtersApplied
              ? 'عبارت جست‌وجو یا وضعیت تسویه را تغییر دهید.'
              : 'مشتری و خدمات سفر را انتخاب کنید؛ قرارداد و پیگیری پرداخت‌ها از همین‌جا در دسترس خواهند بود.'
          }
          action={
            filtersApplied ? (
              <Button
                variant="outline"
                onClick={() => {
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
        <Card className="overflow-hidden rounded-2xl border border-border/80 bg-surface shadow-md shadow-primary/[0.035]">
          <ContractTableScroll>
            <table className="w-full min-w-[104rem] text-sm">
              <caption className="sr-only">
                فهرست قراردادهای فروش؛ عملیات هر قرارداد در ستون آخر قرار دارد.
              </caption>
              <thead className="bg-gradient-to-l from-primary/[0.10] via-muted/70 to-surface text-xs font-bold text-muted-foreground">
                <tr>
                  {[
                    'شماره',
                    'مشتری',
                    'فروشنده',
                    'شماره تلفن مشتری',
                    'مقصد',
                    'تاریخ بستن قرارداد',
                    'تاریخ رفت',
                    'تاریخ برگشت',
                    'مسافران و خدمات',
                    'وضعیت',
                    'تسویه',
                    'مبلغ کل',
                    'مانده',
                    'آخرین تغییر',
                    'عملیات',
                  ].map((label) => (
                    <th
                      className="px-4 py-3 text-start whitespace-nowrap first:pr-5 last:pl-5"
                      key={label}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contracts.map((contract) => (
                  <tr
                    className={contractRowClassName(
                      contract,
                      selectedContractId === contract.id,
                    )}
                    key={contract.id}
                    aria-selected={selectedContractId === contract.id}
                    onClick={() => setSelectedContractId(contract.id)}
                    onFocusCapture={() => setSelectedContractId(contract.id)}
                  >
                    <ContractListNumber contract={contract} />
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="grid size-8 shrink-0 place-items-center rounded-full border border-sky-500/10 bg-sky-500/10 text-xs font-black text-sky-700 dark:text-sky-300">
                          {contract.customerNameSnapshot.slice(0, 1)}
                        </span>
                        <span className="max-w-40 truncate font-semibold text-foreground">
                          {contract.customerNameSnapshot}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{contract.sellerName ?? '—'}</td>
                    <ContractListContactRouteDate contract={contract} />
                    <ContractListTravelDates contract={contract} />
                    <td className="px-4 py-3">
                      <ContractListPassengers contract={contract} />
                      <p className="mt-1 max-w-52 text-xs leading-5 text-muted-foreground">
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
                      <Badge className="rounded-full border border-primary/10 bg-primary/[0.07] px-2.5 py-1 text-primary shadow-sm">
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
                    <ContractListAmounts contract={contract} />
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(contract.updatedAt).toLocaleDateString('fa-IR')}
                    </td>
                    <td className="px-4 py-3 last:pl-5">
                      <div className="grid min-w-72 grid-cols-4 gap-1.5">
                        <PassengerCorrectionButton
                          contractId={contract.id}
                          ownerUserId={contract.ownerUserId}
                          branchId={contract.branchId}
                          status={contract.status}
                          onSaved={() => void load()}
                        />
                        <Button
                          {...(actor &&
                          canSelfServeSalesContract(actor, contract)
                            ? {}
                            : { permission: 'sales.payments.read' })}
                          size="sm"
                          variant="outline"
                          className="h-8 min-w-0 bg-surface px-2 text-xs shadow-sm"
                          onClick={() => setPaymentContractId(contract.id)}
                        >
                          <ReceiptText className="size-3.5" />
                          پرداخت‌ها
                        </Button>
                        <ContractOutputButton
                          contractId={contract.id}
                          ownerUserId={contract.ownerUserId}
                          branchId={contract.branchId}
                          label="قرارداد"
                          className="h-8 min-w-0 px-2 text-xs shadow-sm"
                        />
                        <SalesTravelDocuments
                          contractId={contract.id}
                          label="مدارک"
                          className="h-8 min-w-0 px-2 text-xs shadow-sm"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ContractTableScroll>
        </Card>
      ) : null}
      {!loading &&
      !error &&
      !dateFilterApplied &&
      total > DEFAULT_CONTRACT_PAGE_SIZE ? (
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
            {Math.ceil(total / DEFAULT_CONTRACT_PAGE_SIZE).toLocaleString(
              'fa-IR',
            )}
          </span>
          <Button
            variant="outline"
            disabled={(query.page ?? 1) * DEFAULT_CONTRACT_PAGE_SIZE >= total}
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
        </Card>
      ))}
    </section>
  );
}
