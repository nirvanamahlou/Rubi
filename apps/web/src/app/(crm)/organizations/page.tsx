import type { Metadata } from 'next';

import { OrganizationsWorkspace } from '@/modules/organizations/components/organizations-workspace';

export const metadata: Metadata = { title: 'آژانس‌ها و مشتریان سازمانی' };

export default function Page() {
  return <OrganizationsWorkspace />;
}
