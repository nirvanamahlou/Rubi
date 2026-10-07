import { localizedMetadata } from '@/i18n/metadata';
import type { Metadata } from 'next';
import { PackagePricingHub } from '@/modules/pricing-management/components/package-pricing-hub';

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: 'مدیریت پکیج' });
}

export default function Page() {
  return <PackagePricingHub />;
}
