import type { Metadata } from 'next';

import { SalesContractsWorkspace } from '@/modules/sales/components/sales-contracts-workspace';

export const metadata: Metadata = { title: 'قراردادها، فروش و تخصیص خدمات' };

export default function Page() {
  return <SalesContractsWorkspace />;
}
