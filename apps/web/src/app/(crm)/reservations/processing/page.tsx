import { localizedMetadata } from '@/i18n/metadata';
import type { Metadata } from 'next';

import { ReservationInbox } from '@/modules/reservations/components/reservation-inbox';

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: 'رزرواسیون و عملیات سفر' });
}

export default function Page() {
  return <ReservationInbox />;
}
