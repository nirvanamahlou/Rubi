import type { Metadata } from 'next';

import { ModulePlaceholder } from '@/components/modules/module-placeholder';

export const metadata: Metadata = { title: 'اطلاعات پایه' };

export default function Page() {
  return <ModulePlaceholder href="/master-data" />;
}
