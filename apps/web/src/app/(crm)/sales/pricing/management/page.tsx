import type { Metadata } from 'next';

import { TourPricingWorkspace } from '@/modules/pricing-management/components/tour-pricing-workspace';

export const metadata: Metadata = { title: 'مدیریت قیمت پکیج‌ها' };

export default function Page() {
  return <TourPricingWorkspace />;
}
