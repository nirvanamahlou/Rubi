import type { Metadata } from 'next';

import { ReportingWorkspace } from '@/modules/reports/components/reporting-workspace';
import {
  parseReportingFilterState,
  parseReportingNavigation,
} from '@/modules/reports/model/navigation';

export const metadata: Metadata = { title: 'گزارش‌ها و خروجی‌های مدیریتی' };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <ReportingWorkspace
      {...parseReportingNavigation(params)}
      initialFilterState={parseReportingFilterState(params)}
    />
  );
}
