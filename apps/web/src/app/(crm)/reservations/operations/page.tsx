import { localizedMetadata } from '@/i18n/metadata';
import type { Metadata } from 'next';
import { LiveReservationQueue } from '@/modules/reservations/foundation/live-workspace';
export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: 'صف عملیات رزرواسیون' });
}
export default function ReservationOperationsPage() {
  return <LiveReservationQueue />;
}
