import type { Metadata } from 'next';

import { ModulePlaceholder } from '@/components/modules/module-placeholder';

export const metadata: Metadata = { title: 'خدمات مشتریان' };

export default function Page() {
  return <ModulePlaceholder href="/customer-service" />;
}
