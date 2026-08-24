import type { Metadata } from 'next';

import { FinanceWorkspace } from '@/modules/finance/components/finance-workspace';

export const metadata: Metadata = { title: 'مالی و خزانه‌داری' };

export default function Page() {
  return <FinanceWorkspace />;
}
