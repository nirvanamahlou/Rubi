import { localizedMetadata } from '@/i18n/metadata';
import type { Metadata } from 'next';
import { HotelBaseRateWorkspace } from '@/modules/master-data/hotel-base-rates/workspace';

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: 'قیمت‌گذاری هتل در بازه' });
}

export default function Page() {
  return <HotelBaseRateWorkspace />;
}
