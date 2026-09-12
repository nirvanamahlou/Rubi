import type { Metadata } from 'next';
import { Suspense } from 'react';

import { CustomerAffairsWorkspace } from '@/modules/customer-affairs/components/customer-affairs-workspace';

export const metadata: Metadata = { title: 'امور مشتریان و پشتیبانی' };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CustomerAffairsWorkspace />
    </Suspense>
  );
}
