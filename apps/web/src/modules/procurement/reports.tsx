'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { procurementApi, type Bootstrap } from './api';
import { ProcurementExportPanel } from './export-panel';
import { formatProcurementDate } from './presentation';
import { statusLabels } from './model';
import { selectClass } from './draft-form';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-controls';
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  Skeleton,
} from '@/components/ui/surfaces';

export function reportRate(numerator: number, denominator: number) {
  return denominator > 0
    ? `${((numerator / denominator) * 100).toLocaleString('fa-IR', { maximumFractionDigits: 1 })}٪`
    : 'بدون داده';
}
function hours(seconds: string | null) {
  return seconds !== null
    ? `${(Number(seconds) / 3600).toLocaleString('fa-IR', { maximumFractionDigits: 1 })} ساعت`
    : 'بدون داده';
}
export function ProcurementReports({ bootstrap }: { bootstrap: Bootstrap }) {
  const [dimension, setDimension] = useState('currency');
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['procurement', 'reports', dimension, page],
    queryFn: () => procurementApi.reports(dimension, page),
    retry: false,
  });
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-xl font-bold">گزارش خرید و تأمین</h2>
        <FormField id="proc-report-dimension" label="تفکیک گزارش">
          <select
            id="proc-report-dimension"
            className={selectClass}
            value={dimension}
            onChange={(event) => {
              setDimension(event.target.value);
              setPage(1);
            }}
          >
            {[
              ['currency', 'ارز'],
              ['unit', 'واحد'],
              ['category', 'دسته خرید'],
              ['supplier', 'تأمین‌کننده'],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </FormField>
      </div>
      {query.isPending ? (
        <Skeleton className="h-80" />
      ) : query.isError ? (
        <Alert
          tone="error"
          title="گزارش دریافت نشد"
          description={
            query.error instanceof Error
              ? query.error.message
              : 'دریافت داده ناموفق بود.'
          }
        >
          <Button
            className="mt-3"
            variant="outline"
            onClick={() => void query.refetch()}
          >
            تلاش دوباره
          </Button>
        </Alert>
      ) : (
        <>
          <Alert
            title="مبنای گزارش: نسخه جاری سفارش‌ها، تفکیک‌شده براساس ارز"
            description="لغوشده‌ها جدا نمایش داده می‌شوند. ارزهای متفاوت با هم جمع نمی‌شوند و این گزارش وضعیت پرداخت یا تعهد تأییدشده مالی را نشان نمی‌دهد."
          />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              [
                'زمان متوسط تأیید',
                hours(query.data.performance.approvalSeconds),
              ],
              [
                'زمان ثبت درخواست تا صدور سفارش',
                hours(query.data.performance.supplySeconds),
              ],
              [
                'تحویل به‌موقع',
                reportRate(
                  query.data.performance.onTimeOrders,
                  query.data.performance.completedOrders,
                ),
              ],
              [
                'نرخ سفارش دارای مغایرت',
                reportRate(
                  query.data.performance.discrepancyOrders,
                  query.data.performance.orders,
                ),
              ],
              [
                'سفارش‌های دیرکرددار',
                query.data.performance.lateOrders.toLocaleString('fa-IR'),
              ],
              [
                'کل سفارش‌های مبنا',
                query.data.performance.orders.toLocaleString('fa-IR'),
              ],
              [
                'سفارش‌های تکمیل‌شده',
                query.data.performance.completedOrders.toLocaleString('fa-IR'),
              ],
              [
                'درخواست‌های باز',
                query.data.counts
                  .filter(
                    (row) =>
                      !['CLOSED', 'REJECTED', 'CANCELLED'].includes(row.status),
                  )
                  .reduce((total, row) => total + row.count, 0)
                  .toLocaleString('fa-IR'),
              ],
            ].map(([label, value]) => (
              <Card key={label} className="p-5">
                <h3 className="text-sm text-muted-foreground">{label}</h3>
                <p className="mt-3 text-xl font-bold">{value}</p>
              </Card>
            ))}
          </div>
          <Card className="p-5">
            <h3 className="mb-4 font-semibold">توزیع وضعیت درخواست‌ها</h3>
            {!query.data.counts.length ? (
              <p className="text-sm text-muted-foreground">
                درخواستی در محدوده دسترسی ثبت نشده است.
              </p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {query.data.counts.map((row) => (
                  <Badge key={row.status}>
                    {statusLabels[row.status as keyof typeof statusLabels] ??
                      row.status}
                    : {row.count.toLocaleString('fa-IR')}
                  </Badge>
                ))}
              </div>
            )}
          </Card>
          {!query.data.groups.items.length ? (
            <EmptyState
              title="داده سفارش برای این گزارش وجود ندارد"
              description="گزارش پس از ثبت سفارش در محدوده دسترسی شما شکل می‌گیرد."
            />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
              <table className="w-full min-w-[580px] text-right text-sm">
                <caption className="p-4 text-start font-semibold">
                  مبلغ خرید در هر گروه و ارز
                </caption>
                <thead className="border-y border-border bg-muted/40">
                  <tr>
                    {['گروه', 'ارز', 'وضعیت', 'تعداد', 'مبلغ'].map((label) => (
                      <th key={label} scope="col" className="p-4">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {query.data.groups.items.map((row, index) => (
                    <tr
                      key={`${row.label}-${row.currencyCode}-${row.cancelled}-${index}`}
                      className="border-b border-border last:border-0"
                    >
                      <td className="p-4">{row.label ?? 'بدون گروه'}</td>
                      <td className="p-4">{row.currencyCode}</td>
                      <td className="p-4">
                        {row.cancelled ? 'لغوشده (جدا از فعال)' : 'غیرلغوشده'}
                      </td>
                      <td className="p-4">
                        {row.count.toLocaleString('fa-IR')}
                      </td>
                      <td className="p-4" dir="ltr">
                        {row.amount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <nav
            aria-label="صفحه‌بندی گزارش"
            className="flex items-center justify-between"
          >
            <Button
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              قبلی
            </Button>
            <span className="text-sm">صفحه {page.toLocaleString('fa-IR')}</span>
            <Button
              variant="outline"
              disabled={!query.data.groups.hasMore}
              onClick={() => setPage(page + 1)}
            >
              بعدی
            </Button>
          </nav>
          <p className="text-xs text-muted-foreground">
            زمان گزارش: {formatProcurementDate(query.data.generatedAt, true)} ·
            تحویل به‌موقع براساس سفارش‌های تکمیل‌شده؛ نرخ مغایرت براساس
            سفارش‌های صادرشده و بسته‌شده. مبالغ گروه‌ها همه وضعیت‌ها را پوشش
            می‌دهد و لغوشده‌ها جدا هستند.
          </p>
        </>
      )}
      <ProcurementExportPanel
        bootstrap={bootstrap}
        kind="REPORT"
        query={{ dimension }}
      />
    </div>
  );
}
