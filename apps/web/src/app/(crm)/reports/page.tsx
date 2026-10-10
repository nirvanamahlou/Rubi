import { localizedMetadata } from '@/i18n/metadata';
import type { Metadata } from 'next';

import { ReportingWorkspace } from '@/modules/reports/components/reporting-workspace';
import {
  parseReportingFilterState,
  parseReportingNavigation,
  reportingWorkspaceKey,
} from '@/modules/reports/model/navigation';

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: 'گزارش‌ها و خروجی‌های مدیریتی' });
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const navigation = parseReportingNavigation(params);
  const initialFilterState = parseReportingFilterState(params);
  return (
    <ReportingWorkspace
      {...navigation}
      initialFilterState={initialFilterState}
      key={reportingWorkspaceKey(
        navigation.view,
        navigation.savedFilter,
        initialFilterState,
      )}
    />
  );
}
