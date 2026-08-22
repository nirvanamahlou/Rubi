import type { Metadata } from 'next';

import { MasterDataWorkspace } from '@/modules/master-data/components/master-data-workspace';

export const metadata: Metadata = { title: 'اطلاعات پایه' };

export default function Page() {
  return <MasterDataWorkspace />;
}
