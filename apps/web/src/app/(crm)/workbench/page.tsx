import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { WorkbenchWorkspace } from '@/modules/workbench/workbench-workspace';
import { workbenchDemoEnabled } from '@/modules/workbench/demo/demo-response';

export const metadata: Metadata = { title: 'میزکار من' };
export const dynamic = 'force-dynamic';
export default function WorkbenchPage() {
  return (
    <Suspense fallback={<p role="status">در حال بارگذاری میزکار…</p>}>
      {workbenchDemoEnabled(process.env.RUBI_WORKBENCH_DEMO) && (
        <aside className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-950">
          <p className="font-bold">محیط آزمایشی تعاملی میزکار</p>
          <p className="my-2 text-sm">
            مطابق ماکاپ، با داده ساختگی و فرم‌های قابل آزمایش؛ مستقل از حساب و
            اطلاعات واقعی. تغییرات با بازخوانی صفحه پاک می‌شوند.
          </p>
          <Link className="font-bold underline" href="/workbench/demo">
            باز کردن نسخه آزمایشی
          </Link>
        </aside>
      )}
      <WorkbenchWorkspace />
    </Suspense>
  );
}
