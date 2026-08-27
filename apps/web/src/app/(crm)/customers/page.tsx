import type { Metadata } from 'next';
import { Suspense } from 'react';

import { CustomerWorkspace } from '@/modules/customers/components/customer-workspace';

export const metadata: Metadata = { title: 'مشتریان و مسافران' };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CustomerWorkspace />
    </Suspense>
  );
}
