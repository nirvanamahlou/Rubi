import { localizedMetadata } from '@/i18n/metadata';
import type { Metadata } from 'next';

import { SalesWorkspace } from '@/modules/sales/components/sales-workspace';

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: 'قراردادها، فروش و تخصیص خدمات' });
}

export default function Page() {
  return <SalesWorkspace />;
}
