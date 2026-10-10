import { localizedMetadata } from '@/i18n/metadata';
import type { Metadata } from 'next';

import { SystemManagementWorkspace } from '@/modules/system-management/components/system-management-workspace';

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: 'مدیریت سیستم' });
}

export default function Page() {
  return <SystemManagementWorkspace />;
}
