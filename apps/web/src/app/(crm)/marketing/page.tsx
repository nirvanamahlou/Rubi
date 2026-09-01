import type { Metadata } from 'next';

import { MarketingWorkspace } from '@/modules/marketing/components/marketing-workspace';

export const metadata: Metadata = { title: 'مارکتینگ' };

// Graduation marker for the shared route-foundation contract: this page replaces
// ModuleFoundationWorkspace configured with foundationModules['marketing'].

export default function Page() {
  return <MarketingWorkspace />;
}
