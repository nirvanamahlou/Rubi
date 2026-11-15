'use client';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Link from '@/components/access-link';
import { useFinanceFiscalContext } from '../finance-fiscal-context';

export function financeRouteNeedsYear(path: string) {
  if (
    [
      '/finance',
      '/finance/accounting',
      '/finance/accounting/general-ledger',
    ].includes(path)
  )
    return false;
  if (
    path.includes('/base-information') ||
    path.includes('/general-ledger/accounts')
  )
    return false;
  if (
    path === '/finance/accounting/taxpayer-system/settings' ||
    path ===
      '/finance/accounting/general-ledger/reports/legal-reports/mappings' ||
    path.includes('/taxpayer-system/seller')
  )
    return false;
  return path.startsWith('/finance/');
}
export function FinanceFiscalBoundary({ children }: { children: ReactNode }) {
  const fiscal = useFinanceFiscalContext();
  const path = usePathname();
  if (
    fiscal?.active &&
    !fiscal.loading &&
    (!fiscal.period || fiscal.data?.isAggregate) &&
    financeRouteNeedsYear(path)
  )
    return (
      <section role="status" className="space-y-3 rounded-lg border p-5">
        <p>
          {fiscal.data?.isAggregate
            ? 'برای مشاهدهٔ اطلاعات یک سال مالی، یک شرکت را از نوار بالا انتخاب کنید.'
            : 'سال مالی: تعریف نشده'}
        </p>
        <p className="text-sm text-muted-foreground">
          سال مالی را از نوار بالا انتخاب کنید یا سال مالی پیش‌فرض شرکت را مشخص
          کنید.
        </p>
        <Link
          className="text-primary underline"
          href="/finance/accounting/general-ledger/base-information/lists/fiscal-years"
        >
          فهرست دوره‌های مالی
        </Link>
      </section>
    );
  return children;
}
