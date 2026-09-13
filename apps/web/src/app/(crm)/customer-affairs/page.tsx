import type { Metadata } from 'next';
import { Suspense } from 'react';

import { CustomerAffairsRubiWorkspace as CustomerAffairsWorkspace } from '@/modules/customer-affairs/components/customer-affairs-rubi-workspace';

export const metadata: Metadata = { title: 'امور مشتریان و پشتیبانی' };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CustomerAffairsWorkspace />
    </Suspense>
  );
}
