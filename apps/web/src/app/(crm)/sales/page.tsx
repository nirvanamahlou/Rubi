import type { Metadata } from 'next';

import { ModulePlaceholder } from '@/components/modules/module-placeholder';

export const metadata: Metadata = { title: 'فروش و سرنخ‌ها' };

export default function Page() {
  return <ModulePlaceholder href="/sales" />;
}
