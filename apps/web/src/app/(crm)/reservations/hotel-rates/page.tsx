import type { Metadata } from 'next';
import { localizedMetadata } from '@/i18n/metadata';
import { HotelRateHub } from '@/modules/reservations/hotel-rates/hotel-rate-hub';
export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: 'قیمت خرید هتل' });
}
export default function Page() {
  return <HotelRateHub />;
}
