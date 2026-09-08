import type { Metadata } from 'next';

import { ReservationInbox } from '@/modules/reservations/components/reservation-inbox';

export const metadata: Metadata = { title: 'رزرواسیون و عملیات سفر' };

export default function Page() {
  return <ReservationInbox />;
}
