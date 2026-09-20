import type { Metadata } from 'next';

import { FinanceRequestInboxWorkspace } from '@/modules/finance/components/finance-core-workspace';

export const metadata: Metadata = { title: 'کارتابل درخواست‌ها' };

export default function Page() {
  return <FinanceRequestInboxWorkspace />;
}
