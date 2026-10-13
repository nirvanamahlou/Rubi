import { localizedMetadata } from '@/i18n/metadata';
import type { Metadata } from 'next';

import { FinanceRequestInboxWorkspace } from '@/modules/finance/components/finance-core-workspace';

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: 'کارتابل درخواست‌ها' });
}

export default function Page() {
  return <FinanceRequestInboxWorkspace />;
}
