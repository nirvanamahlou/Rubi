import { localizedMetadata } from '@/i18n/metadata';
import type { Metadata } from 'next';

import { SalesWorkspace } from '@/modules/sales/components/sales-workspace';

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: 'قراردادها، فروش و تخصیص خدمات' });
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ contract?: string; record?: string }>;
}) {
  const { contract, record } = await searchParams;
  return (
    <SalesWorkspace
      initialContract={
        typeof contract === 'string' ? contract.slice(0, 100) : ''
      }
      initialRecord={typeof record === 'string' ? record : ''}
    />
  );
}
