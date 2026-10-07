import { localizedMetadata } from '@/i18n/metadata';
import type { Metadata } from 'next';

import { ModulePlaceholder } from '@/components/modules/module-placeholder';

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: 'تنظیمات سیستم' });
}

export default function Page() {
  return <ModulePlaceholder href="/settings" />;
}
