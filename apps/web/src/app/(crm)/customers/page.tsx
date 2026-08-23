import type { Metadata } from 'next';

import { CustomerWorkspace } from '@/modules/customers/components/customer-workspace';

export const metadata: Metadata = { title: 'مشتریان و مسافران' };

export default function Page() {
  return <CustomerWorkspace />;
}
