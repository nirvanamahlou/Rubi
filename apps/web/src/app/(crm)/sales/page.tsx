import type { Metadata } from 'next';

import { SalesWorkspace } from '@/modules/sales/components/sales-workspace';

export const metadata: Metadata = { title: 'قراردادها، فروش و تخصیص خدمات' };

export default function Page() {
  return <SalesWorkspace />;
}
