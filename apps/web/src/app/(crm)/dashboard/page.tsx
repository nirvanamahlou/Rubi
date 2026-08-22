import type { Metadata } from 'next';

import { DashboardShell } from '@/components/dashboard/dashboard-shell';

export const metadata: Metadata = { title: 'داشبورد' };

export default function DashboardPage() {
  return <DashboardShell />;
}
