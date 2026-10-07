import type { Metadata } from 'next';

import { OrganizationsWorkspace } from '@/modules/organizations/components/organizations-workspace';

export const metadata: Metadata = { title: 'مشتریان B2B' };

export default function Page() {
  return <OrganizationsWorkspace />;
}
