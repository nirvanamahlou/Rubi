import type { Metadata } from 'next';
import Link from 'next/link';

import { ModuleFoundationWorkspace } from '@/modules/module-foundation/components/module-foundation-workspace';
import { foundationModules } from '@/modules/module-foundation/model/foundation';
import { workbenchDemoEnabled } from '@/modules/workbench/demo/demo-response';

export const metadata: Metadata = { title: 'وظایف و اتوماسیون' };
export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <>
      {workbenchDemoEnabled(process.env.RUBI_WORKBENCH_DEMO) && (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <Link href="/workbench/demo" className="font-semibold underline">
            باز کردن میزکار من
          </Link>
          <p className="mt-1 text-sm text-slate-600">
            نمونه تعاملی با اطلاعات آزمایشی؛ تغییرات با بازخوانی صفحه بازنشانی
            می‌شوند.
          </p>
        </div>
      )}
      <ModuleFoundationWorkspace config={foundationModules['tasks']} />
    </>
  );
}
