import { localizedMetadata } from '@/i18n/metadata';
import type { Metadata } from 'next';
import { Suspense } from 'react';

import { Skeleton } from '@/components/ui/surfaces';
import { ProfileWorkspace } from '@/modules/profile/components/profile-workspace';

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: 'پروفایل من' });
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div aria-label="در حال دریافت پروفایل" className="space-y-4">
          <Skeleton className="h-20" />
          <Skeleton className="h-64" />
        </div>
      }
    >
      <ProfileWorkspace />
    </Suspense>
  );
}
