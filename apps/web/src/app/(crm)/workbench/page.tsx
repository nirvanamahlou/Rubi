import type { Metadata } from 'next';
import { Suspense } from 'react';
import { WorkbenchWorkspace } from '@/modules/workbench/workbench-workspace';
export const metadata: Metadata = { title: 'میزکار من' };
export default function WorkbenchPage() {
  return (
    <Suspense fallback={<p role="status">در حال دریافت میزکار…</p>}>
      <WorkbenchWorkspace />
    </Suspense>
  );
}
