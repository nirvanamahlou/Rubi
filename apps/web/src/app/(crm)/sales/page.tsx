import { localizedMetadata } from '@/i18n/metadata';
import type { Metadata } from 'next';

import { SalesWorkspace } from '@/modules/sales/components/sales-workspace';

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: 'قراردادها، فروش و تخصیص خدمات' });
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    contract?: string;
    record?: string;
    salesPeriodAsOf?: string;
    page?: string;
  }>;
}) {
  const { contract, record, salesPeriodAsOf, page } = await searchParams;
  const reportPage =
    salesPeriodAsOf &&
    typeof page === 'string' &&
    /^[1-9]\d*$/.test(page) &&
    Number.isSafeInteger(Number(page)) &&
    Number(page) <= 214748364
      ? Number(page)
      : 1;
  return (
    <SalesWorkspace
      key={
        salesPeriodAsOf
          ? `${salesPeriodAsOf}:${reportPage}`
          : (record ?? contract ?? '')
      }
      initialReportPage={reportPage}
      initialSalesPeriodAsOf={
        typeof salesPeriodAsOf === 'string' ? salesPeriodAsOf : ''
      }
      initialContract={
        typeof contract === 'string' ? contract.slice(0, 100) : ''
      }
      initialRecord={typeof record === 'string' ? record : ''}
    />
  );
}
