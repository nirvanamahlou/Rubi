import type { Metadata } from 'next';

import { SalesContractForm } from '@/modules/sales/components/sales-contract-form';

export const metadata: Metadata = { title: 'قرارداد جدید فروش' };

export default function Page() {
  return <SalesContractForm />;
}
