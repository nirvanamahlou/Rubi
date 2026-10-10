import type { Metadata } from 'next';
import { localizedMetadata } from '@/i18n/metadata';
import { PageHeader } from '@/components/ui/surfaces';
import { FinanceDeliveryPanel } from '@/modules/finance/components/finance-delivery-panel';

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: 'تحویل مدارک' });
}

export default function Page() {
  return (
    <main className="space-y-6">
      <PageHeader title="تحویل مدارک" />
      <FinanceDeliveryPanel />
    </main>
  );
}
