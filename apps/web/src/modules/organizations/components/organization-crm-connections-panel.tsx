'use client';

import { Building2, RefreshCw } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Alert, Badge, Card, Skeleton } from '@/components/ui/surfaces';
import { useOrganizationCrmConnections } from './use-organization-crm-connections';

const contractStatus: Record<string, string> = {
  DRAFT: 'پیش‌نویس',
  PENDING_CONFIRMATION: 'در انتظار تأیید',
  CONFIRMED: 'تأییدشده',
  SENT_TO_RESERVATIONS: 'ارسال‌شده به رزرو',
  IN_PROGRESS: 'در حال اجرا',
  COMPLETED: 'تکمیل‌شده',
  CANCELLED: 'لغوشده',
};
const reservationStatus: Record<string, string> = {
  NEW: 'جدید',
  WAITING_SUPPLIER: 'در انتظار تأمین‌کننده',
  SUPPLIER_CONFIRMED: 'تأیید تأمین‌کننده',
  VOUCHER_ISSUED: 'واچر صادرشده',
  CANCELLED: 'لغوشده',
};

export function OrganizationCrmConnectionsPanel({
  organizationId,
}: {
  organizationId: string;
}) {
  const { data, loading, error, refresh } =
    useOrganizationCrmConnections(organizationId);

  if (loading)
    return (
      <section className="space-y-3" aria-label="در حال دریافت ارتباطات CRM">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-48 w-full" />
      </section>
    );
  if (error)
    return (
      <Alert
        title="دریافت ارتباطات CRM ناموفق بود"
        description={error}
        tone="warning"
      />
    );
  if (!data) return null;

  const sourceCards = [
    {
      key: 'customers',
      title: 'پرونده مشتری سازمانی',
      count: data.customers.length,
      unavailable: data.unavailableSources.CUSTOMERS,
      href: '/customers',
    },
    {
      key: 'sales',
      title: 'قراردادهای فروش مرتبط',
      count: data.contracts.length,
      unavailable: data.unavailableSources.SALES,
      href: '/sales',
    },
    {
      key: 'reservations',
      title: 'درخواست‌های رزرو مرتبط',
      count: data.reservations.length,
      unavailable: data.unavailableSources.RESERVATIONS,
      href: '/reservations',
    },
    {
      key: 'finance',
      title: 'دفترکل مالی سازمان',
      count: null,
      unavailable: data.unavailableSources.FINANCE,
      href: '/finance',
    },
  ] as const;

  return (
    <section className="panel">
      <header className="panel-head">
        <div className="panel-title">
          <Building2 size={20} /> ارتباطات CRM این سازمان
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={refresh}
          aria-label="تازه‌سازی ارتباطات CRM"
        >
          <RefreshCw aria-hidden="true" className="size-4" /> تازه‌سازی
        </Button>
      </header>
      <div className="panel-body space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {sourceCards.map((source) => (
            <Card className="space-y-2 p-4" key={source.key}>
              <div className="flex items-start justify-between gap-2">
                <strong>{source.title}</strong>
                <Badge
                  className={
                    source.unavailable
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }
                >
                  {source.unavailable ? 'نیاز به اتصال' : 'متصل'}
                </Badge>
              </div>
              <p className="text-2xl font-black">
                {source.count === null
                  ? '—'
                  : source.count.toLocaleString('fa-IR')}
              </p>
              <p className="min-h-10 text-xs text-muted-foreground">
                {source.unavailable ??
                  'داده با کنترل شعبه و مجوز از Query Service سرور دریافت شد.'}
              </p>
              <Link
                className="text-sm font-semibold text-primary"
                href={source.href}
              >
                بازکردن بخش مالک
              </Link>
            </Card>
          ))}
        </div>

        <div className="agreement-table-wrap">
          <table>
            <caption>قراردادهای فروش متصل به مشتری سازمانی همین پرونده</caption>
            <thead>
              <tr>
                <th>شماره قرارداد</th>
                <th>مشتری ثبت‌شده</th>
                <th>وضعیت فروش</th>
                <th>وضعیت رزرو</th>
                <th>آخرین تغییر</th>
              </tr>
            </thead>
            <tbody>
              {data.contracts.map((contract) => (
                <tr key={contract.id}>
                  <td>
                    <bdi>{contract.contractNumber}</bdi>
                  </td>
                  <td>{contract.customerNameSnapshot}</td>
                  <td>{contractStatus[contract.status] ?? contract.status}</td>
                  <td>{contract.reservationStatus}</td>
                  <td>
                    {new Date(contract.updatedAt).toLocaleDateString('fa-IR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data.contracts.length && !data.unavailableSources.SALES ? (
          <p className="empty" role="status">
            قرارداد فروشی برای مشتری سازمانی متصل به این پرونده ثبت نشده است.
          </p>
        ) : null}

        <div className="agreement-table-wrap">
          <table>
            <caption>درخواست‌های رزرو متصل به قراردادهای همین سازمان</caption>
            <thead>
              <tr>
                <th>شماره قرارداد</th>
                <th>مسافر</th>
                <th>خدمات</th>
                <th>وضعیت</th>
                <th>زمان دریافت</th>
              </tr>
            </thead>
            <tbody>
              {data.reservations.map((reservation) => (
                <tr key={reservation.id}>
                  <td>
                    <bdi>{reservation.contractNumber}</bdi>
                  </td>
                  <td>
                    {reservation.passengerCount.toLocaleString('fa-IR')} نفر
                  </td>
                  <td>{reservation.services.join('، ') || 'ثبت‌نشده'}</td>
                  <td>
                    {reservationStatus[reservation.status] ??
                      reservation.status}
                  </td>
                  <td>
                    {new Date(reservation.receivedAt).toLocaleString('fa-IR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data.reservations.length && !data.unavailableSources.RESERVATIONS ? (
          <p className="empty" role="status">
            درخواست رزروی برای قراردادهای این سازمان ثبت نشده است.
          </p>
        ) : null}
        <p className="panel-note">
          تطبیق در Backend با شناسه واقعی Organization، Customer و Sales
          Contract انجام شده است؛ تطبیق متنی نام سازمان استفاده نمی‌شود. زمان
          دریافت: {new Date(data.observedAt).toLocaleString('fa-IR')}
        </p>
      </div>
    </section>
  );
}
