import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ModuleFoundationWorkspace } from '@/modules/module-foundation/components/module-foundation-workspace';
import { foundationModules } from '@/modules/module-foundation/model/foundation';
import { workbenchDemoEnabled } from '@/modules/workbench/demo/demo-response';

export const metadata: Metadata = { title: 'وظایف و اتوماسیون' };
export const dynamic = 'force-dynamic';

export default function Page() {
  if (workbenchDemoEnabled(process.env.RUBI_WORKBENCH_DEMO)) {
    redirect('/workbench/demo');
  }
  return <ModuleFoundationWorkspace config={foundationModules['tasks']} />;
}
