import type { Metadata } from 'next';

import { LegalEntitiesAdmin } from '@/modules/legal-entities/components/legal-entities-admin';

export const metadata: Metadata = { title: 'شرکت‌های صادرکننده' };

export default function Page() {
  return <LegalEntitiesAdmin />;
}
