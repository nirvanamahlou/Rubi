import type { Metadata } from 'next';
import { LiveReservationQueue } from '@/modules/reservations/foundation/live-workspace';
export const metadata: Metadata = { title: 'رزرواسیون و عملیات سفر' };
export default function Page() {
  return <LiveReservationQueue />;
}
