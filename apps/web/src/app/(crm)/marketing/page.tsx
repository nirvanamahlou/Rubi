import type { Metadata } from 'next';

import { MarketingWorkspace } from '@/modules/marketing/components/marketing-workspace';

export const metadata: Metadata = { title: 'مارکتینگ' };

// Graduation marker for the shared route-foundation contract: this page replaces
// ModuleFoundationWorkspace configured with foundationModules['marketing'].

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ section?: string | string[] }>;
}) {
  const { section } = await searchParams;
  const initialSection = typeof section === 'string' ? section : null;

  return (
    <MarketingWorkspace
      key={initialSection ?? 'marketing-hub'}
      initialSection={initialSection}
    />
  );
}
