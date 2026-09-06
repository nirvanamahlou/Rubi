import type { Metadata } from 'next';
import { HrWorkspace } from '@/modules/hr/hr-workspace';
export const metadata: Metadata = { title: 'منابع انسانی | Rubi' };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ section?: string; tab?: string; workspace?: string }>;
}) {
  const { section, tab, workspace } = await searchParams;
  return (
    <HrWorkspace
      key={`${workspace ?? section ?? 'home'}:${tab ?? ''}`}
      sectionId={section ?? 'home'}
      tabId={tab}
      workspaceId={workspace}
    />
  );
}
