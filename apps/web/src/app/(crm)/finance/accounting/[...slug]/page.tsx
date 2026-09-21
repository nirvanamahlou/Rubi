import type { Metadata } from 'next';

import { AccountingNavigationWorkspace } from '@/modules/finance/components/accounting-navigation-workspace';

export const metadata: Metadata = { title: 'حسابداری' };

export default function Page() {
  return <AccountingNavigationWorkspace />;
}
