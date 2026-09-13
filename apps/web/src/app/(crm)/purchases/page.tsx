import type { Metadata } from 'next';

import { ProcurementWorkspace } from '@/modules/procurement/workspace';

export const metadata: Metadata = { title: 'خرید و تأمین' };

export default function Page() {
  return <ProcurementWorkspace />;
}
