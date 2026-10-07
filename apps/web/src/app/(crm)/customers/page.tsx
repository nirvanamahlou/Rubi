import { localizedMetadata } from '@/i18n/metadata';
import type { Metadata } from 'next';
import { Suspense } from 'react';

import { CustomerWorkspace } from '@/modules/customers/components/customer-workspace';

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: 'مشتریان و مسافران' });
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CustomerWorkspace />
    </Suspense>
  );
}
