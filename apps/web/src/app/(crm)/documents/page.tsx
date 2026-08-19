import type { Metadata } from 'next';

import { ModulePlaceholder } from '@/components/modules/module-placeholder';

export const metadata: Metadata = { title: 'اسناد و فایل‌ها' };

export default function Page() {
  return <ModulePlaceholder href="/documents" />;
}
