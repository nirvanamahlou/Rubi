import type { Metadata } from 'next';

import { ModulePlaceholder } from '@/components/modules/module-placeholder';

export const metadata: Metadata = { title: 'آژانس‌ها و مشتریان سازمانی' };

export default function Page() {
  return <ModulePlaceholder href="/organizations" />;
}
