import type { Metadata } from 'next';

import { FinanceCoreWorkspace } from '@/modules/finance/components/finance-core-workspace';

export const metadata: Metadata = { title: 'مالی و خزانه‌داری' };

export default function Page() {
  return <FinanceCoreWorkspace />;
}
