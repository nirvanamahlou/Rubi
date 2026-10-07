import type { Metadata } from 'next';
import { localizedMetadata } from '@/i18n/metadata';
import { HotelRatePacksWorkspace } from '@/modules/reservations/hotel-rates/packs-workspace';
export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: 'مدیریت گروهی نرخ‌های هتل‌ها' });
}
export default function Page() {
  return <HotelRatePacksWorkspace />;
}
