import type { Metadata } from 'next';

import { SystemManagementWorkspace } from '@/modules/system-management/components/system-management-workspace';

export const metadata: Metadata = { title: 'مدیریت سیستم' };

export default function Page() {
  return <SystemManagementWorkspace />;
}
