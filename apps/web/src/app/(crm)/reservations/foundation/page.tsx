import { localizedMetadata } from '@/i18n/metadata';
import type { Metadata } from 'next';
import { ReservationOperationsWorkspace } from '@/modules/reservations/foundation/workspace';

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: 'پیش‌نمایش رزرواسیون' });
}

/** Independent, data-free review route. The Sales-owned inbox route is unchanged. */
export default function ReservationFoundationPage() {
  return <ReservationOperationsWorkspace preview />;
}
