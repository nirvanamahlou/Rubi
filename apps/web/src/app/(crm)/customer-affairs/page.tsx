import type { Metadata } from 'next';
import { Suspense } from 'react';

import { CustomerAffairsNoraWorkspace as CustomerAffairsWorkspace } from '@/modules/customer-affairs/components/customer-affairs-nora-workspace';

export const metadata: Metadata = { title: 'امور مشتریان و پشتیبانی' };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CustomerAffairsWorkspace />
    </Suspense>
  );
}
