import type { Metadata } from 'next';

import { ModuleFoundationWorkspace } from '@/modules/module-foundation/components/module-foundation-workspace';
import { foundationModules } from '@/modules/module-foundation/model/foundation';

export const metadata: Metadata = { title: 'آژانس‌ها و مشتریان سازمانی' };

export default function Page() {
  return (
    <ModuleFoundationWorkspace config={foundationModules['organizations']} />
  );
}
