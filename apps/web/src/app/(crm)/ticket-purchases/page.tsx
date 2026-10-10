import { localizedMetadata } from '@/i18n/metadata';
import type { Metadata } from 'next';
import { ReservationPurchaseWorkspace } from '@/modules/reservation-purchases/workspace';
export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: 'خرید و تأمین' });
}
export default function Page() {
  return <ReservationPurchaseWorkspace />;
}
