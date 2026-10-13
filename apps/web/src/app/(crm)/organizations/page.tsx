import { localizedMetadata } from '@/i18n/metadata';
import type { Metadata } from 'next';

import { OrganizationsWorkspace } from '@/modules/organizations/components/organizations-workspace';

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: 'مشتریان B2B' });
}

export default function Page() {
  return <OrganizationsWorkspace />;
}
