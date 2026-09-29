import type { Metadata } from 'next';
import { Suspense } from 'react';

import { Skeleton } from '@/components/ui/surfaces';
import { DashboardWorkspace } from '@/modules/dashboard/components/dashboard-workspace';

export const metadata: Metadata = { title: 'داشبورد' };

export default function DashboardPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[70vh] w-full" />}>
      <DashboardWorkspace />
    </Suspense>
  );
}
