import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

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

  // Marketing settings are owned by System Management. Keep old bookmarks
  // working while ensuring the hub never renders a duplicate settings UI.
  if (initialSection === 'settings') redirect('/system?module=marketing');

  return (
    <MarketingWorkspace
      key={initialSection ?? 'marketing-hub'}
      initialSection={initialSection}
    />
  );
}
