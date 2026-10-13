import { localizedMetadata } from '@/i18n/metadata';
import type { Metadata } from 'next';

import { PackageGeneratorWorkspace } from '@/modules/pricing-management/components/package-generator-workspace';

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: 'پک جنریتور' });
}

export default function Page() {
  return <PackageGeneratorWorkspace />;
}
