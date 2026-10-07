import { localizedMetadata } from '@/i18n/metadata';
import type { Metadata } from 'next';

import { OrganizationsWorkspace } from '@/modules/organizations/components/organizations-workspace';

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: 'آژانس‌ها و مشتریان سازمانی' });
}

export default function Page() {
  return <OrganizationsWorkspace />;
}
