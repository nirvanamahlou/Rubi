'use client';

import {
  AlertTriangle,
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

import { Button } from '@/components/ui/button';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
} from '@/components/ui/surfaces';
import { salesApi } from '../api/client';

function formatMoney(amount: string, currencyCode: string) {
  const [integer = '0', fraction] = amount.split('.');
  return `${integer.replace(/\B(?=(\d{3})+(?!\d))/g, '٬')}${fraction ? `٫${fraction}` : ''} ${currencyCode}`;
}

export function SalesWorkspace() {
  const [dashboard, setDashboard] = useState<SalesDashboard['data'] | null>(
    null,
  );
  const [contracts, setContracts] = useState<SalesContractPage['data']>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [dashboardResponse, contractResponse] = await Promise.all([
        salesApi.dashboard(),
        salesApi.list({
          page: 1,
          pageSize: 20,
          sortBy: 'updatedAt',
          sortDirection: 'desc',
        }),
      ]);
      setDashboard(dashboardResponse.data);
      setContracts(contractResponse.data);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'دریافت اطلاعات فروش ناموفق بود.',
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const timer = globalThis.setTimeout(() => void load(), 0);
    return () => globalThis.clearTimeout(timer);
  }, [load]);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Sales · v1"
        title="فروش و قراردادها"
        description="قراردادهای واقعی، مانده تأییدشده مالی و وضعیت درخواست‌های رزرو"
        actions={
          <Button asChild>
            <Link href="/sales/contracts/new">
              <FilePlus2 className="size-4" />
              قرارداد جدید
            </Link>
          </Button>
        }
      />
      {loading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton className="h-28" key={index} />
          ))}
        </div>
      ) : null}
      {error ? (
        <ErrorState
          title="دریافت داشبورد ناموفق بود"
          description={error}
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
                'در انتظار Finance',
                String(dashboard.pendingFinancePayments),
                WalletCards,
              ],
              ['فروش ریالی', formatMoney(dashboard.rialSales, 'IRR'), Banknote],
            ] satisfies ReadonlyArray<readonly [string, string, LucideIcon]>
          ).map(([label, value, Icon]) => (
            <Card className="p-5" key={label}>
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
      {dashboard?.conversionRateStatus ===
      'AWAITING_CUSTOMER_AFFAIRS_PUBLIC_CONTRACT' ? (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-800">
          <AlertTriangle className="size-4" />
          نرخ تبدیل لید به قرارداد تا انتشار Public Contract امور مشتریان محاسبه
          نمی‌شود.
        </div>
      ) : null}
      {!loading && !error && contracts.length === 0 ? (
        <EmptyState
          title="هنوز قراردادی ثبت نشده"
          description="برای شروع، قرارداد جدید بسازید؛ عدد نمایشی یا داده ساختگی نشان داده نمی‌شود."
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
                    'مانده',
                    'آخرین تغییر',
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
