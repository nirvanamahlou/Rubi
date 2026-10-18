import { localizedMetadata } from '@/i18n/metadata';
import type { Metadata } from 'next';

import { IntegrationsWorkspace } from '@/modules/integrations/components/integrations-workspace';

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: 'یکپارچه‌سازی‌ها' });
}

export default function Page() {
  return <IntegrationsWorkspace />;
}
