import { localizedMetadata } from '@/i18n/metadata';
import type { Metadata } from 'next';
import { ReservationReportWorkspace } from '@/modules/reservations/reporting/workspace';

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: 'گزارش رزرواسیون' });
}
export default function Page() {
  return <ReservationReportWorkspace />;
}
