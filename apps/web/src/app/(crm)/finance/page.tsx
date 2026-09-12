import type { Metadata } from 'next';

import { FinanceCoreWorkspace } from '@/modules/finance/components/finance-core-workspace';

export const metadata: Metadata = { title: 'مالی و کارتابل درخواست‌ها' };

export default function Page() {
  return <FinanceCoreWorkspace />;
}
