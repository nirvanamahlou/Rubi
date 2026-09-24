import type { Metadata } from 'next';

import { PackageGeneratorWorkspace } from '@/modules/pricing-management/components/package-generator-workspace';

export const metadata: Metadata = { title: 'پک جنریتور' };

export default function Page() {
  return <PackageGeneratorWorkspace />;
}
