import type { Metadata } from 'next';
import { PackagePricingHub } from '@/modules/pricing-management/components/package-pricing-hub';

export const metadata: Metadata = { title: 'مدیریت قیمت و پکیج‌ها' };

export default function Page() {
  return <PackagePricingHub />;
}
