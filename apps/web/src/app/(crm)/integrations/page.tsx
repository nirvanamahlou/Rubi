import { localizedMetadata } from '@/i18n/metadata';
import type { Metadata } from 'next';

import { ModuleFoundationWorkspace } from '@/modules/module-foundation/components/module-foundation-workspace';
import { foundationModules } from '@/modules/module-foundation/model/foundation';

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: 'یکپارچه‌سازی‌ها' });
}

export default function Page() {
  return (
    <ModuleFoundationWorkspace config={foundationModules['integrations']} />
  );
}
