import { localizedMetadata } from '@/i18n/metadata';
import type { Metadata } from 'next';
import { Suspense } from 'react';

import { CustomerAffairsNoraWorkspace as CustomerAffairsWorkspace } from '@/modules/customer-affairs/components/customer-affairs-nora-workspace';

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: 'امور مشتریان و پشتیبانی' });
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CustomerAffairsWorkspace />
    </Suspense>
  );
}
