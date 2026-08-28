import type { Metadata } from 'next';

import { MasterDataHub } from '@/modules/master-data/components/master-data-hub';

export const metadata: Metadata = { title: 'اطلاعات پایه' };

export default function Page() {
  return <MasterDataHub />;
}
