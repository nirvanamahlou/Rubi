import type { Metadata } from 'next';
import { HrWorkspace } from '@/modules/hr/hr-workspace';
export const metadata: Metadata = { title: 'منابع انسانی | Rubi' };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    section?: string;
    tab?: string;
    workspace?: string;
    employee?: string;
    record?: string;
  }>;
}) {
  const { employee, section, tab, workspace, record } = await searchParams;
  return (
    <HrWorkspace
      sectionId={section ?? 'home'}
      tabId={tab}
      workspaceId={workspace}
      employeeId={employee}
      recordId={record}
    />
  );
}
