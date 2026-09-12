import type { Metadata } from 'next';

import { FinanceAccountingWorkspace } from '@/modules/finance/components/finance-core-workspace';

export const metadata: Metadata = { title: 'حسابداری' };

export default function Page() {
  return <FinanceAccountingWorkspace />;
}
