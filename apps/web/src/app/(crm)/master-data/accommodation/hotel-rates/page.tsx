import type { Metadata } from 'next';
import { HotelBaseRateWorkspace } from '@/modules/master-data/hotel-base-rates/workspace';

export const metadata: Metadata = { title: 'قیمت‌گذاری هتل در بازه' };

export default function Page() {
  return <HotelBaseRateWorkspace />;
}
