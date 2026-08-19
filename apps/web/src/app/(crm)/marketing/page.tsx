import type { Metadata } from 'next';

import { ModulePlaceholder } from '@/components/modules/module-placeholder';

export const metadata: Metadata = { title: 'مارکتینگ' };

export default function Page() {
  return <ModulePlaceholder href="/marketing" />;
}
