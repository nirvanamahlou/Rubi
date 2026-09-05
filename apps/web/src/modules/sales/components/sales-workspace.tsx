'use client';

import {
  Banknote,
  CalendarCheck,
  FilePlus2,
  RefreshCw,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import type { SalesContractPage, SalesDashboard } from '@rubi/contracts';

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

export async function loadSalesWorkspace(
  api: Pick<typeof salesApi, 'dashboard' | 'list'> = salesApi,
) {
  const [dashboard, contracts] = await Promise.allSettled([
    api.dashboard(),
    api.list({
      page: 1,
      pageSize: 20,
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    }),
  ]);
  return { dashboard, contracts };
}

function failureMessage(reason: unknown): string {
  return reason instanceof Error
    ? reason.message
    : 'دریافت اطلاعات فروش ناموفق بود.';
}

function formatMoney(amount: string, currencyCode: string) {
  const [integer = '0', fraction] = amount.split('.');
  return `${integer.replace(/\B(?=(\d{3})+(?!\d))/g, '٬')}${fraction ? `٫${fraction}` : ''} ${currencyCode}`;
}

export function SalesWorkspace() {
  const [paymentContractId, setPaymentContractId] = useState<string | null>(
    null,
  );
  const [dashboard, setDashboard] = useState<SalesDashboard['data'] | null>(
    null,
  );
  const [contracts, setContracts] = useState<SalesContractPage['data']>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dashboardError, setDashboardError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setDashboardError('');
    const result = await loadSalesWorkspace();
    if (result.dashboard.status === 'fulfilled')
      setDashboard(result.dashboard.value.data);
    else {
      setDashboard(null);
      setDashboardError(failureMessage(result.dashboard.reason));
    }
    if (result.contracts.status === 'fulfilled')
      setContracts(result.contracts.value.data);
    else {
      setContracts([]);
      setError(failureMessage(result.contracts.reason));
    }
    setLoading(false);
  }, []);
  useEffect(() => {
    const timer = globalThis.setTimeout(() => void load(), 0);
    return () => globalThis.clearTimeout(timer);
  }, [load]);

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black">داشبورد قراردادها</h1>
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
            className={buttonVariants({ size: 'sm' })}
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
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {(
            [
              [
                'قرارداد امروز',
                String(dashboard.todayContracts),
                CalendarCheck,
              ],
              ['قرارداد فعال', String(dashboard.activeContracts), FilePlus2],
              [
                'تسویه نشده / ناقص',
                String(
                  dashboard.unpaidContracts +
                    dashboard.partiallySettledContracts,
                ),
                WalletCards,
              ],
              ['فروش ریالی', formatMoney(dashboard.rialSales, 'IRR'), Banknote],
            ] satisfies ReadonlyArray<readonly [string, string, LucideIcon]>
          ).map(([label, value, Icon]) => (
            <Card className="p-4" key={label}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="mt-2 text-2xl font-black">{value}</p>
                </div>
                <Icon className="size-5 text-primary" />
              </div>
            </Card>
          ))}
        </div>
      ) : null}
      {!loading && !error && contracts.length === 0 ? (
        <EmptyState
          title="هنوز قراردادی ثبت نشده"
          description="قراردادهای شما پس از ثبت در این بخش نمایش داده می‌شوند."
        />
      ) : null}
      {contracts.length ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-muted-foreground">
                <tr>
                  {[
                    'شماره',
                    'مشتری',
                    'مسافران',
                    'خدمات',
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
                      {contract.passengerNames.join('، ')}
                    </td>
                    <td className="px-4 py-3">
                      {contract.services.join('، ')}
                    </td>
                    <td className="px-4 py-3">
                      <Badge>{contract.status}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge>
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
      {paymentContractId ? (
        <ContractPayments
          key={paymentContractId}
          id={paymentContractId}
          onClose={() => setPaymentContractId(null)}
          onSaved={() => void load()}
        />
      ) : null}
    </div>
  );
}
