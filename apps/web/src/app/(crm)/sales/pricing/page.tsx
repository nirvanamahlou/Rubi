import type { Metadata } from 'next';
import { PricingManagementWorkspace } from '@/modules/pricing-management/components/pricing-management-workspace';

export const metadata: Metadata = { title: 'مدیریت قیمت و پکیج‌ها' };

export default function Page() {
  return <PricingManagementWorkspace />;
}
