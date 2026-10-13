import { localizedMetadata } from '@/i18n/metadata';
import type { Metadata } from 'next';

import { SalesContractForm } from '@/modules/sales/components/sales-contract-form';

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: 'قرارداد جدید فروش' });
}

export default function Page() {
  return <SalesContractForm />;
}
