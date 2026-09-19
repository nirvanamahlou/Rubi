import type { Metadata } from 'next';
import { LiveReservationQueue } from '@/modules/reservations/foundation/live-workspace';
export const metadata: Metadata = { title: 'صف عملیات رزرواسیون' };
export default function ReservationOperationsPage() {
  return <LiveReservationQueue />;
}
