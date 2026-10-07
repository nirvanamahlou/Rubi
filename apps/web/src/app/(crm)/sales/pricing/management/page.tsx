import { localizedMetadata } from '@/i18n/metadata';
import type { Metadata } from 'next';

import { TourPricingWorkspace } from '@/modules/pricing-management/components/tour-pricing-workspace';

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: 'مدیریت قیمت پکیج‌ها' });
}

export default function Page() {
  return <TourPricingWorkspace />;
}
