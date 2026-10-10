import { localizedMetadata } from '@/i18n/metadata';
import type { Metadata } from 'next';

import { MasterDataHub } from '@/modules/master-data/components/master-data-hub';

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: 'اطلاعات پایه' });
}

export default function Page() {
  return <MasterDataHub />;
}
