import type { Metadata } from 'next';

import { CustomerAffairsWorkspace } from '@/modules/customer-affairs/components/customer-affairs-workspace';

export const metadata: Metadata = { title: 'امور مشتریان و پشتیبانی' };

export default function Page() {
  return <CustomerAffairsWorkspace />;
}
