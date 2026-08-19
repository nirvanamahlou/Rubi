import type { Metadata } from 'next';

import { ModulePlaceholder } from '@/components/modules/module-placeholder';

export const metadata: Metadata = { title: 'مدیریت کاربران' };

export default function Page() {
  return <ModulePlaceholder href="/users" />;
}
