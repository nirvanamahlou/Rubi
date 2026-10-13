import { localizedMetadata } from '@/i18n/metadata';
import type { Metadata } from 'next';

import { AccountingNavigationWorkspace } from '@/modules/finance/components/accounting-navigation-workspace';

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: 'حسابداری' });
}

export default function Page() {
  return <AccountingNavigationWorkspace />;
}
