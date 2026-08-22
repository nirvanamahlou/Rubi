import type { Metadata } from 'next';

import { ModulePlaceholder } from '@/components/modules/module-placeholder';

export const metadata: Metadata = { title: 'وظایف و اتوماسیون' };

export default function Page() {
  return <ModulePlaceholder href="/tasks" />;
}
