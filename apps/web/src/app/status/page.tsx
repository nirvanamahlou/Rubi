import type { Metadata } from 'next';

import { StatusPanel } from '@/components/status/status-panel';

export const metadata: Metadata = { title: 'وضعیت سرویس‌ها' };

export default function StatusPage() {
  return <StatusPanel />;
}
