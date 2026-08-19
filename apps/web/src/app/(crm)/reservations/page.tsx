import type { Metadata } from 'next';

import { ModulePlaceholder } from '@/components/modules/module-placeholder';

export const metadata: Metadata = { title: 'سفارش‌ها و رزرواسیون' };

export default function Page() {
  return <ModulePlaceholder href="/reservations" />;
}
