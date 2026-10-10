import { localizedMetadata } from '@/i18n/metadata';
import type { Metadata } from 'next';

import { LegalEntitiesAdmin } from '@/modules/legal-entities/components/legal-entities-admin';

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: 'شرکت‌های صادرکننده' });
}

export default function Page() {
  return <LegalEntitiesAdmin />;
}
