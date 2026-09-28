import type { Metadata } from 'next';

import { SystemOperationsPanel } from '@/modules/system-management/components/system-operations-panel';

export const metadata: Metadata = { title: 'عملیات مدیریت سیستم' };

export default function Page() {
  return (
    <section className="mx-auto w-full max-w-7xl space-y-5" dir="rtl">
      <div>
        <h1 className="text-2xl font-black tracking-tight">
          عملیات مدیریت سیستم
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          عملیات حساس در API مالک دوباره مجوزسنجی و ثبت Audit می‌شود.
        </p>
      </div>
      <SystemOperationsPanel />
    </section>
  );
}
