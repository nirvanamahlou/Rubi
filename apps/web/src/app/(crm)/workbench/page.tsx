import { localizedMetadata } from '@/i18n/metadata';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { WorkbenchWorkspace } from '@/modules/workbench/workbench-workspace';
export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: 'میزکار من' });
}
export default function WorkbenchPage() {
  return (
    <Suspense fallback={<p role="status">در حال دریافت میزکار…</p>}>
      <WorkbenchWorkspace />
    </Suspense>
  );
}
