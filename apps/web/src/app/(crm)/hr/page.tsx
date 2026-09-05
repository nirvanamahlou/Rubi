import type { Metadata } from 'next';
import { HrWorkspace } from '@/modules/hr/hr-workspace';
export const metadata: Metadata = { title: 'منابع انسانی | Rubi' };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const { section } = await searchParams;
  return (
    <HrWorkspace
      key={section ?? 'dashboard'}
      sectionId={section ?? 'dashboard'}
    />
  );
}
