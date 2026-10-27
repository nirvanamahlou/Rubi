import { localizedMetadata } from '@/i18n/metadata';
import type { Metadata } from 'next';
import { HrWorkspace } from '@/modules/hr/hr-workspace';
import { redirect } from 'next/navigation';
export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: 'منابع انسانی | Nora' });
}
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
  if (section === 'employee' && employee && !tab && !workspace) {
    const query = new URLSearchParams({
      section: 'employee',
      employee,
      tab: 'summary',
    });
    if (record) query.set('record', record);
    redirect(`/hr?${query.toString()}`);
  }
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
