import Link from '@/components/access-link';
import type { Metadata } from 'next';

import { SystemManagementWorkspace } from '@/modules/system-management/components/system-management-workspace';

export const metadata: Metadata = { title: 'مدیریت سیستم' };

export default function Page() {
  return (
    <div className="grid gap-5">
      <Link className="rounded-xl border bg-primary/5 p-5" href="/system/users">
        <strong>مدیریت کاربران</strong>
        <p className="text-sm">تعریف کاربر، نقش و دسترسی بخش‌ها و زیربخش‌ها</p>
      </Link>
      <SystemManagementWorkspace />
    </div>
  );
}
